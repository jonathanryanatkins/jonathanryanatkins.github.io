/*
 * Natural Language to SQL: rule-based translator.
 *
 * translate(question, schema) turns a plain English question into a single
 * SQLite SELECT statement over one table, plus a plain English reading of
 * how the question was understood.
 *
 * schema: [{ name, rowCount, columns: [{ name, type: 'number'|'text'|'date', values: [lowercase distinct text values] }] }]
 * returns: { ok: true, table, interpretation, steps: [], sql } or { ok: false, message }
 */
(function (root) {
  'use strict';

  var STOP_VALUES = { 'a': 1, 'an': 1, 'the': 1, 'and': 1, 'or': 1, 'of': 1, 'in': 1, 'on': 1, 'by': 1, 'to': 1, 'is': 1, 'are': 1, 'for': 1, 'with': 1, 'n/a': 1, 'na': 1, 'none': 1, 'null': 1, 'yes': 1, 'no': 1, 'all': 1, 'each': 1, 'per': 1, 'top': 1, 'show': 1, 'list': 1 };

  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function q(name) { return '"' + String(name).replace(/"/g, '""') + '"'; }
  function lit(v) { return "'" + String(v).replace(/'/g, "''") + "'"; }
  function words(s) { return String(s).replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function dn(c) {
    var w = words(c.name), m = w.match(UNITS);
    return m ? w.replace(UNITS, '') + ' (' + m[1] + ')' : w;
  }
  function fmtNum(n) { return Number(n).toLocaleString('en-GB'); }

  function parseNumber(s) {
    if (s == null) return null;
    var m = String(s).toLowerCase().replace(/[£$€,\s]/g, '').match(/^(-?\d+(?:\.\d+)?)(k|m|bn|b)?$/);
    if (!m) return null;
    var n = parseFloat(m[1]);
    if (m[2] === 'k') n *= 1e3; else if (m[2] === 'm') n *= 1e6; else if (m[2] === 'b' || m[2] === 'bn') n *= 1e9;
    return n;
  }

  var UNITS = /\s(mins|minutes|min|secs|seconds|hrs|hours|days|gbp|usd|eur|pct|percent|count|num|no)$/;
  function aliasesFor(name) {
    var base = words(name);
    var set = {};
    set[base] = 1;
    var stripped = base.replace(UNITS, '');
    if (stripped !== base && stripped.length > 2) { set[stripped] = 1; set[stripped + 's'] = 1; }
    if (/s$/.test(base) && base.length > 3) set[base.replace(/ies$/, 'y').replace(/s$/, '')] = 1;
    else { set[base + 's'] = 1; if (/y$/.test(base)) set[base.replace(/y$/, 'ies')] = 1; }
    return Object.keys(set).sort(function (a, b) { return b.length - a.length; });
  }

  // Column aliases for one table: full name, plural, unit-free name, and the last word when no other column shares it.
  function columnItems(table, tableAliases) {
    var items = table.columns.map(function (c) { return { col: c, aliases: aliasesFor(c.name) }; });
    var lastCount = {};
    items.forEach(function (it) {
      var w = words(it.col.name).replace(UNITS, '').split(' ');
      it.last = w.length > 1 ? w[w.length - 1] : null;
      if (it.last) lastCount[it.last] = (lastCount[it.last] || 0) + 1;
    });
    items.forEach(function (it) {
      if (it.last && lastCount[it.last] === 1 && it.last.length > 3 && !STOP_VALUES[it.last]) {
        it.aliases.push(it.last);
        if (!/s$/.test(it.last)) it.aliases.push(it.last + 's');
      }
      var base = words(it.col.name);
      // a plural like "clients" belongs to the table, not the "client" column
      it.aliases = it.aliases.filter(function (a) { return a === base || tableAliases.indexOf(a) === -1; });
      it.aliases.sort(function (a, b) { return b.length - a.length; });
    });
    return items;
  }

  // Find every place a column (or table) name is mentioned, longest alias first, no overlaps.
  function findMentions(text, items) {
    var found = [];
    items.forEach(function (it) {
      it.aliases.forEach(function (al) {
        var re = new RegExp('\\b' + escRe(al) + '\\b', 'g'), m;
        while ((m = re.exec(text))) found.push({ item: it, start: m.index, end: m.index + al.length, text: al });
      });
    });
    found.sort(function (a, b) { return a.start - b.start || (b.end - b.start) - (a.end - a.start); });
    var out = [], lastEnd = -1;
    found.forEach(function (f) { if (f.start >= lastEnd) { out.push(f); lastEnd = f.end; } });
    return out;
  }

  function overlaps(span, spans) {
    return spans.some(function (s) { return span.start < s.end && s.start < span.end; });
  }

  var NUM = '(?:[£$€]\\s?)?-?\\d[\\d,]*(?:\\.\\d+)?\\s?(?:k|m|bn)?\\b';
  var OPS = [
    { re: 'greater than or equal to|at least|no less than|>=|minimum of', op: '>=', say: 'at least' },
    { re: 'less than or equal to|at most|no more than|<=|maximum of|up to', op: '<=', say: 'at most' },
    { re: 'greater than|more than|over|above|exceeds|exceeding|>', op: '>', say: 'more than' },
    { re: 'less than|fewer than|under|below|<', op: '<', say: 'less than' }
  ];

  function lower(c) {
    if (!c._lower) c._lower = (c.values || []).map(function (v) { return String(v).toLowerCase(); });
    return c._lower;
  }
  function display(c, v) {
    var i = lower(c).indexOf(v);
    return i > -1 ? String(c.values[i]) : v;
  }

  function translate(question, schema) {
    if (!question || !question.trim()) return { ok: false, message: 'Type a question first.' };
    if (!schema || !schema.length) return { ok: false, message: 'Upload a file or load the sample data first.' };

    var raw = question.trim();
    var text = ' ' + raw.toLowerCase().replace(/[?!]+$/g, '').replace(/\s+/g, ' ') + ' ';
    var steps = [];

    // ---- 1. Pick the table ------------------------------------------------
    var best = null;
    schema.forEach(function (t, i) {
      var score = 0;
      var tm = findMentions(text, [{ aliases: aliasesFor(t.name) }]);
      score += tm.length * 5;
      score += findMentions(text, columnItems(t, aliasesFor(t.name))).length * 2;
      t.columns.forEach(function (c) {
        if (c.type !== 'text' || !c.values) return;
        c.values.forEach(function (v) {
          v = String(v).toLowerCase();
          if (v.length > 2 && !STOP_VALUES[v] && new RegExp('\\b' + escRe(v) + '\\b').test(text)) score += 1;
        });
      });
      if (!best || score > best.score) best = { table: t, score: score, index: i };
    });
    var table = best.table;
    if (schema.length > 1) steps.push('Used the ' + table.name + ' table, as it best matches the words in the question.');

    var tAliases = aliasesFor(table.name);
    var colItems = columnItems(table, tAliases);
    var all = findMentions(text, colItems.concat([{ isTable: true, aliases: tAliases }]));
    var mentions = all.filter(function (m) { return !m.item.isTable; });
    var used = []; // spans already consumed by a clause
    var numericCols = table.columns.filter(function (c) { return c.type === 'number'; });
    var dateCols = table.columns.filter(function (c) { return c.type === 'date'; });

    function mentionAfter(pos, pred, maxGap) {
      for (var i = 0; i < mentions.length; i++) {
        var m = mentions[i];
        if (m.start >= pos && (!pred || pred(m.item.col)) && (maxGap == null || m.start - pos <= maxGap)) return m;
      }
      return null;
    }
    function mentionBefore(pos, pred, maxGap) {
      for (var i = mentions.length - 1; i >= 0; i--) {
        var m = mentions[i];
        if (m.end <= pos && (!pred || pred(m.item.col)) && (maxGap == null || pos - m.end <= maxGap)) return m;
      }
      return null;
    }
    var isNum = function (c) { return c.type === 'number'; };
    var notNum = function (c) { return c.type !== 'number'; };

    var where = [], whereSay = [];

    // ---- 2. Numeric comparisons ("employees over 10,000", "more than 10k employees") ----
    OPS.forEach(function (o) {
      var re = new RegExp('\\b(?:is |are |was |with |has |have )?(' + o.re + ')\\s+(' + NUM + ')', 'g'), m;
      while ((m = re.exec(text))) {
        var span = { start: m.index, end: m.index + m[0].length };
        if (overlaps(span, used)) continue;
        var n = parseNumber(m[2]);
        if (n == null) continue;
        var col = mentionBefore(span.start, isNum, 25) || mentionAfter(span.end, isNum, 6);
        if (!col && numericCols.length === 1) col = { item: { col: numericCols[0] }, start: span.start, end: span.start };
        if (!col) continue;
        where.push(q(col.item.col.name) + ' ' + o.op + ' ' + n);
        whereSay.push(dn(col.item.col) + ' is ' + o.say + ' ' + fmtNum(n));
        used.push(span, { start: col.start, end: col.end });
      }
    });
    var between = /\bbetween\s+(\S+)\s+and\s+(\S+)/g, bm;
    while ((bm = between.exec(text))) {
      var a = parseNumber(bm[1]), b = parseNumber(bm[2]);
      var bspan = { start: bm.index, end: bm.index + bm[0].length };
      if (a == null || b == null || overlaps(bspan, used)) continue;
      var bc = mentionBefore(bspan.start, isNum, 25) || mentionAfter(bspan.end, isNum, 6);
      if (!bc) continue;
      where.push(q(bc.item.col.name) + ' BETWEEN ' + a + ' AND ' + b);
      whereSay.push(dn(bc.item.col) + ' is between ' + fmtNum(a) + ' and ' + fmtNum(b));
      used.push(bspan, { start: bc.start, end: bc.end });
    }

    // ---- 3. Dates ("after 2026-10-01", "before 1 Nov 2026") -----------------
    if (dateCols.length) {
      var dre = /\b(after|since|from|before|until|prior to|on)\s+(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})/g, dm;
      while ((dm = dre.exec(text))) {
        var dspan = { start: dm.index, end: dm.index + dm[0].length };
        var iso = dm[2];
        if (/\//.test(iso)) { var p = iso.split('/'); iso = p[2] + '-' + ('0' + p[1]).slice(-2) + '-' + ('0' + p[0]).slice(-2); }
        var dc = mentionBefore(dspan.start, function (c) { return c.type === 'date'; }, 25);
        var dcol = dc ? dc.item.col : dateCols[0];
        var dop = { after: '>', since: '>=', from: '>=', before: '<', until: '<=', 'prior to': '<', on: '=' }[dm[1]];
        where.push(q(dcol.name) + ' ' + dop + ' ' + lit(iso));
        whereSay.push(dn(dcol) + ' is ' + { '>': 'after', '>=': 'on or after', '<': 'before', '<=': 'on or before', '=': 'on' }[dop] + ' ' + iso);
        used.push(dspan); if (dc) used.push({ start: dc.start, end: dc.end });
      }
    }

    // months ("in October", "during March 2026")
    if (dateCols.length) {
      var MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];
      var mre = new RegExp('\\b(?:in|during|for)\\s+(' + MONTHS.join('|') + '|' + MONTHS.map(function (x) { return x.slice(0, 3); }).join('|') + ')\\b(?:\\s+(\\d{4}))?', 'g'), mm;
      while ((mm = mre.exec(text))) {
        var mspan = { start: mm.index, end: mm.index + mm[0].length };
        if (overlaps(mspan, used)) continue;
        var mi = MONTHS.findIndex(function (x) { return x.indexOf(mm[1]) === 0; });
        var mc = mentionBefore(mspan.start, function (c) { return c.type === 'date'; }, 25);
        var mcol = mc ? mc.item.col : dateCols[0];
        var mnum = ('0' + (mi + 1)).slice(-2);
        where.push("strftime('%m', " + q(mcol.name) + ") = " + lit(mnum) + (mm[2] ? " AND strftime('%Y', " + q(mcol.name) + ") = " + lit(mm[2]) : ''));
        whereSay.push(dn(mcol) + ' falls in ' + MONTHS[mi].charAt(0).toUpperCase() + MONTHS[mi].slice(1) + (mm[2] ? ' ' + mm[2] : ''));
        used.push(mspan);
      }
    }

    // ---- 4. Explicit equality ("stage is 4", "owner = 'Priya S.'") ---------
    mentions.forEach(function (m) {
      var rest = text.slice(m.end);
      var em = rest.match(/^\s*(?:is|=|==|equals|equal to|of)\s+('([^']+)'|"([^"]+)"|(-?[\d.,]+[km]?)\b|([a-z][\w&./-]*))/);
      if (!em) return;
      var span = { start: m.start, end: m.end + em[0].length };
      if (overlaps(span, used)) return;
      var val = em[2] || em[3] || em[4] || em[5];
      var col = m.item.col;
      if (/^(more|less|greater|fewer|over|under|above|below|at|between|the|a|an|not)$/.test(val)) return;
      if (col.type === 'number') {
        var n = parseNumber(val);
        if (n == null) return;
        where.push(q(col.name) + ' = ' + n);
        whereSay.push(dn(col) + ' is ' + fmtNum(n));
      } else {
        var known = lower(col).filter(function (v) { return v === val; })[0];
        if (known === val) { where.push('LOWER(' + q(col.name) + ') = ' + lit(val)); whereSay.push(dn(col) + ' is "' + display(col, val) + '"'); }
        else { where.push('LOWER(' + q(col.name) + ') LIKE ' + lit('%' + val + '%')); whereSay.push(dn(col) + ' contains "' + val + '"'); }
      }
      used.push(span);
    });
    // "stage 4" with a bare number straight after a numeric column name
    mentions.forEach(function (m) {
      if (m.item.col.type !== 'number') return;
      var em = text.slice(m.end).match(/^\s(\d+)\b(?!\s*(?:k|m|%))/);
      if (!em) return;
      var span = { start: m.start, end: m.end + em[0].length };
      if (overlaps(span, used)) return;
      if (/\b(top|first|bottom|last)\s*$/.test(text.slice(0, m.start))) return;
      where.push(q(m.item.col.name) + ' = ' + em[1]);
      whereSay.push(dn(m.item.col) + ' is ' + em[1]);
      used.push(span);
    });

    // ---- 4b. Yes/no columns ("have not had a summary sent", "with summary sent") ----
    mentions.forEach(function (m) {
      var c = m.item.col;
      if (c.type !== 'text' || overlaps(m, used)) return;
      var vals = lower(c);
      if (!vals.length || !vals.every(function (v) { return /^(yes|no|y|n|true|false|0|1|)$/.test(v); })) return;
      var yes = vals.filter(function (v) { return /^(yes|y|true|1)$/.test(v); })[0] || 'yes';
      var no = vals.filter(function (v) { return /^(no|n|false|0)$/.test(v); })[0] || 'no';
      var before = text.slice(Math.max(0, m.start - 30), m.start);
      var neg = /\b(not|no|without|never|missing|hasn't|haven't|hasnt|havent|wasn't|weren't|isn't|aren't|un)\b[^.]*$/.test(before);
      var pos = /\b(have|has|had|with|been|where|that)\b[^.]*$/.test(before);
      if (!neg && !pos) return;
      var v = neg ? no : yes;
      where.push('LOWER(' + q(c.name) + ') = ' + lit(v));
      whereSay.push(dn(c) + ' is "' + display(c, v) + '"');
      used.push({ start: m.start, end: m.end });
    });

    // ---- 5. Values mentioned on their own ("in Retail", "for Halden Logistics") ----
    var valueHits = [];
    table.columns.forEach(function (c) {
      if (c.type !== 'text' || !c.values) return;
      lower(c).forEach(function (v) {
        if (v.length < 2 || STOP_VALUES[v] || /^[\d.,\s]+$/.test(v)) return;
        var re = new RegExp('(^|[^\\w])(' + escRe(v) + ')(?=$|[^\\w])', 'g'), m;
        while ((m = re.exec(text))) {
          var s = m.index + m[1].length;
          valueHits.push({ col: c, value: v, start: s, end: s + v.length });
        }
      });
    });
    valueHits.sort(function (a, b) { return (b.end - b.start) - (a.end - a.start); });
    var valueByCol = {};
    valueHits.forEach(function (h) {
      if (overlaps(h, used)) return;
      // a value that is only a column's own name is a column mention, not a filter
      if (mentions.some(function (m) { return m.start === h.start && m.end === h.end; })) return;
      used.push(h);
      var g0 = (valueByCol[h.col.name] = valueByCol[h.col.name] || { col: h.col, vals: [], pos: [] });
      if (g0.vals.indexOf(h.value) === -1) { g0.vals.push(h.value); g0.pos.push(h.start); }
    });
    Object.keys(valueByCol).forEach(function (k) {
      var g = valueByCol[k];
      g.vals = g.vals.map(function (v, i) { return [v, g.pos[i]]; }).sort(function (a, b) { return a[1] - b[1]; }).map(function (x) { return x[0]; });
      if (g.vals.length === 1) {
        where.push('LOWER(' + q(g.col.name) + ') = ' + lit(g.vals[0]));
        whereSay.push(dn(g.col) + ' is "' + display(g.col, g.vals[0]) + '"');
      } else {
        where.push('LOWER(' + q(g.col.name) + ') IN (' + g.vals.map(lit).join(', ') + ')');
        whereSay.push(dn(g.col) + ' is ' + g.vals.map(function (v) { return '"' + display(g.col, v) + '"'; }).join(' or '));
      }
      // drop the column mention if it only introduced this value ("sector retail")
    });

    // ---- 6. Grouping ("by owner", "per sector", "for each stage") ----------
    var group = null, orderFromBy = null;
    var gre = /\b(?:grouped by|group by|broken down by|split by|for each|per|by|each|across)\s+/g, gm;
    while ((gm = gre.exec(text))) {
      var before = text.slice(Math.max(0, gm.index - 12), gm.index);
      if (/(sort|sorted|order|ordered|rank|ranked)\s*$/.test(before)) continue;
      var gc = mentionAfter(gm.index + gm[0].length, null, 0);
      if (!gc || overlaps(gc, used)) continue;
      used.push({ start: gm.index, end: gc.end });
      if (gc.item.col.type !== 'text' && /\b(top|bottom|first|last|highest|lowest|largest|smallest|biggest|rank|ranked)\b/.test(text)) {
        orderFromBy = gc.item.col;
      } else group = gc.item.col;
      break;
    }

    // ---- 7. Aggregation -----------------------------------------------------
    var agg = null; // { fn, col, distinct }
    var am;
    if ((am = text.match(/\b(how many|number of|count of|count the|count)\b\s*(?:different|distinct|unique)\s+/))) {
      var dc2 = mentionAfter(am.index + am[0].length, null, 0);
      if (dc2) { agg = { fn: 'COUNT', col: dc2.item.col, distinct: true }; used.push({ start: dc2.start, end: dc2.end }); }
    }
    if (!agg && /\b(how many|number of|count of|count the|count|total number)\b/.test(text)) agg = { fn: 'COUNT' };
    var aggWords = [
      { re: /\b(average|avg|mean)\b/, fn: 'AVG', say: 'average' },
      { re: /\b(total|sum of|sum)\b/, fn: 'SUM', say: 'total' },
      { re: /\b(maximum|max)\b/, fn: 'MAX', say: 'highest' },
      { re: /\b(minimum|min)\b/, fn: 'MIN', say: 'lowest' }
    ];
    if (!agg) {
      aggWords.some(function (w) {
        var m = text.match(w.re);
        if (!m) return false;
        var c = mentionAfter(m.index, isNum, 30);
        if (!c && numericCols.length === 1) c = { item: { col: numericCols[0] } };
        if (!c) return false;
        agg = { fn: w.fn, col: c.item.col };
        if (c.start != null) used.push({ start: c.start, end: c.end });
        return true;
      });
    }

    // ---- 8. Superlatives, top N, ordering -----------------------------------
    var limit = null, order = null, superlative = false;
    var lm = text.match(/\b(top|first|bottom|last)\s+(\d+)\b/) || text.match(/\b(\d+)\s+(highest|largest|biggest|lowest|smallest|most|least)\b/);
    if (lm) {
      limit = parseInt(/^\d+$/.test(lm[1]) ? lm[1] : lm[2], 10);
      var lowWord = /^(bottom|lowest|smallest|least)$/.test(lm[1]) || /^(lowest|smallest|least)$/.test(lm[2]);
      order = { dir: lowWord ? 'ASC' : 'DESC' };
    }
    var sm = text.match(/\b(highest|largest|biggest|most|greatest|lowest|smallest|least|fewest|oldest|newest|latest|earliest)\b\s*(?:number of\s+)?/);
    if (sm) {
      var low = /^(lowest|smallest|least|fewest|oldest|earliest)$/.test(sm[1]);
      if (!order) order = { dir: low ? 'ASC' : 'DESC' };
      var scol = mentionAfter(sm.index, function (c) { return c.type !== 'text'; }, 25);
      if (!scol && /^(oldest|newest|latest|earliest)$/.test(sm[1]) && dateCols.length) scol = { item: { col: dateCols[0] } };
      var who = text.match(/\b(?:which|who|what)\s+/);
      var wcol = who ? mentionAfter(who.index + who[0].length, notNum, 0) : null;
      if (!group && !agg && wcol && (!scol || /\b(most|fewest|least)\b/.test(sm[1]) && !scol)) {
        group = wcol.item.col; agg = { fn: 'COUNT' }; limit = 1;
        used.push({ start: wcol.start, end: wcol.end });
        order = { dir: low ? 'ASC' : 'DESC' };
        scol = null;
      }
      if (scol) {
        order.col = scol.item.col;
        if (scol.start != null) used.push({ start: scol.start, end: scol.end });
        var rowQ = /\b(which|who)\b/.test(text) || /\bwhat\s+(?!is\b|are\b|was\b|were\b)[a-z]+\s+(has|have|had|is|are|was|with)\b/.test(text);
        if (!group && !agg && !limit && rowQ) { limit = 1; superlative = true; }
        if (!group && !agg && !limit && !/\b(list|show|sort|order|rank)\b/.test(text)) {
          agg = { fn: low ? 'MIN' : 'MAX', col: scol.item.col }; order = null;
        }
      }
    }
    var om = text.match(/\b(?:sort|sorted|order|ordered|rank|ranked)\s+(?:them\s+|it\s+|results\s+)?by\s+/);
    if (om) {
      var oc = mentionAfter(om.index + om[0].length, null, 4);
      if (oc) {
        order = order || {};
        order.col = oc.item.col;
        used.push({ start: om.index, end: oc.end });
        var tail = text.slice(oc.end, oc.end + 30);
        if (/\b(desc|descending|highest|largest|biggest|most|newest|latest|z to a|reverse)\b/.test(tail)) order.dir = 'DESC';
        else if (/\b(asc|ascending|lowest|smallest|least|oldest|earliest|a to z|alphabetical)\b/.test(tail)) order.dir = 'ASC';
        else order.dir = order.dir || (oc.item.col.type === 'text' ? 'ASC' : 'DESC');
      }
    }
    if (orderFromBy) { order = order || { dir: 'DESC' }; order.col = orderFromBy; }
    if (!order && /\b(alphabetical|alphabetically|a to z)\b/.test(text)) order = { dir: 'ASC' };
    if (!limit) { var fm = text.match(/\b(?:limit|only|just)\s+(\d+)\b/); if (fm) limit = parseInt(fm[1], 10); }

    // ---- 9. Distinct ("list the unique sectors", "which owners are there") --
    var distinct = false;
    if (!agg && /\b(unique|distinct|different)\b/.test(text)) distinct = true;

    // ---- 10. Columns to show -------------------------------------------------
    var selectCols = [];
    mentions.forEach(function (m) {
      if (overlaps(m, used)) return;
      if (selectCols.indexOf(m.item.col) === -1) selectCols.push(m.item.col);
    });
    // a column named right before one of its own values ("sector retail") was a filter label, not a column to show
    selectCols = selectCols.filter(function (c) {
      if (!valueByCol[c.name]) return true;
      var ms = mentions.filter(function (m) { return m.item.col === c; });
      return !ms.every(function (m) { return /^\s*(?:is\s+|of\s+|=\s*)?$/.test(text.slice(m.end, m.end + 4).replace(/\w.*$/, '')) && valueHitsStartNear(m.end); });
    });
    function valueHitsStartNear(pos) { return valueHits.some(function (h) { return h.start > pos && h.start - pos <= 5; }); }

    var hasShowWord = /\b(show|list|display|everything|all rows|all records|all the data)\b/.test(text) || all.some(function (m) { return m.item.isTable; });
    var understood = where.length || group || agg || order || limit || selectCols.length || distinct;
    if (!understood && !hasShowWord) {
      return {
        ok: false,
        message: 'I could not match this question to the ' + table.name + ' table. Try naming one of its columns, for example: ' +
          table.columns.slice(0, 4).map(function (c) { return c.name; }).join(', ') + '.'
      };
    }

    // ---- 11. Build SQL and the plain English reading --------------------------
    var select, say;
    var colList = function (cs) { return cs.map(function (c) { return q(c.name); }).join(', '); };
    var nameList = function (cs) {
      var n = cs.map(dn);
      return n.length > 1 ? n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1] : n[0];
    };
    var aggExpr = null, aggAlias = null, aggSay = null;
    if (agg) {
      if (agg.fn === 'COUNT') {
        aggExpr = agg.distinct ? 'COUNT(DISTINCT ' + q(agg.col.name) + ')' : 'COUNT(*)';
        aggAlias = agg.distinct ? 'distinct_' + words(agg.col.name).replace(/ /g, '_') : 'count';
        aggSay = agg.distinct ? 'count the different ' + dn(agg.col) + ' values' : 'count the rows';
      } else {
        aggExpr = (agg.fn === 'AVG' ? 'ROUND(AVG(' + q(agg.col.name) + '), 2)' : agg.fn + '(' + q(agg.col.name) + ')');
        aggAlias = { AVG: 'average_', SUM: 'total_', MAX: 'max_', MIN: 'min_' }[agg.fn] + words(agg.col.name).replace(/ /g, '_');
        aggSay = { AVG: 'work out the average ', SUM: 'add up the ', MAX: 'find the highest ', MIN: 'find the lowest ' }[agg.fn] + dn(agg.col);
      }
    }

    if (group) {
      if (!agg) { aggExpr = 'COUNT(*)'; aggAlias = 'count'; aggSay = 'count the rows'; }
      select = q(group.name) + ', ' + aggExpr + ' AS ' + q(aggAlias);
      say = aggSay.charAt(0).toUpperCase() + aggSay.slice(1) + ' for each ' + dn(group);
      if (!order) order = { dir: 'DESC', alias: aggAlias };
      else if (!order.col || order.col !== group) order.alias = aggAlias;
    } else if (agg) {
      select = aggExpr + ' AS ' + q(aggAlias);
      say = aggSay.charAt(0).toUpperCase() + aggSay.slice(1);
      order = null; limit = null;
    } else if (distinct) {
      var dcols = selectCols.length ? selectCols : [table.columns[0]];
      select = 'DISTINCT ' + colList(dcols);
      say = 'List the unique ' + nameList(dcols) + ' values';
      if (!order) order = { col: dcols[0], dir: 'ASC' };
    } else {
      if (selectCols.length && order && order.col && selectCols.indexOf(order.col) === -1) selectCols.push(order.col);
      select = selectCols.length ? colList(selectCols) : '*';
      say = superlative ? 'Find the row with the ' + (order.dir === 'DESC' ? 'highest ' : 'lowest ') + dn(order.col)
        : 'Show ' + (selectCols.length ? nameList(selectCols) : 'every column');
    }

    var sql = 'SELECT ' + select + '\nFROM ' + q(table.name);
    if (where.length) sql += '\nWHERE ' + where.join('\n  AND ');
    if (group) sql += '\nGROUP BY ' + q(group.name);
    if (order && (order.col || order.alias)) {
      var ocol = order.alias && (!order.col || order.col !== group) ? q(order.alias) : q(order.col.name);
      sql += '\nORDER BY ' + ocol + ' ' + (order.dir || 'ASC');
    } else if (order && !group && !agg) {
      var first = selectCols[0] || table.columns[0];
      sql += '\nORDER BY ' + q(first.name) + ' ' + (order.dir || 'ASC');
      order.col = first;
    }
    var autoLimit = false;
    if (limit) sql += '\nLIMIT ' + limit;
    else if (!agg && !group) { sql += '\nLIMIT 100'; autoLimit = true; }
    sql += ';';

    if (!superlative) say += (group || agg ? ' in ' : ' from ') + 'the ' + table.name + ' table';
    if (whereSay.length) say += ', only where ' + whereSay.join(' and ');
    if (order && !superlative && (order.col || order.alias) && !(agg && !group)) {
      var oname = order.alias && (!order.col || order.col !== group) ? (agg ? aggSay.replace(/^(count the|add up the|work out the|find the) /, '') : 'count') : dn(order.col);
      if (order.alias === 'count' || (agg && agg.fn === 'COUNT' && order.alias)) oname = 'count';
      say += ', sorted by ' + oname + (order.dir === 'DESC' ? ' from highest to lowest' : ' from lowest to highest');
      if (order.col && order.col.type === 'text' && !order.alias) say = say.replace(/ from lowest to highest$/, ' from A to Z').replace(/ from highest to lowest$/, ' from Z to A');
    }
    if (limit === 1 && !superlative) say += ', keeping only the ' + (order && order.dir === 'ASC' ? 'lowest' : 'highest');
    else if (limit && !superlative) say += ', keeping the ' + (order && order.dir === 'ASC' ? 'first ' : 'top ') + limit;
    say += '.';
    if (autoLimit && (table.rowCount || 0) > 100) steps.push('Showing up to 100 rows. Ask for "top N" or add a filter to narrow it down.');
    Object.keys(valueByCol).forEach(function (k) {
      steps.push('Read ' + valueByCol[k].vals.map(function (v) { return '"' + display(valueByCol[k].col, v) + '"'; }).join(' and ') + ' as ' + (valueByCol[k].vals.length > 1 ? 'values' : 'a value') + ' in the ' + dn(valueByCol[k].col) + ' column.');
    });
    if (where.some(function (w) { return /LOWER\(/.test(w); })) steps.push('Text matches ignore upper and lower case.');

    return { ok: true, table: table.name, interpretation: say, steps: steps, sql: sql };
  }

  var api = { translate: translate, parseNumber: parseNumber };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NL2SQL = api;
})(this);
