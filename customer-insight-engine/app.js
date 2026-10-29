/* Customer Insight Engine: dashboard logic. */
(function () {
  'use strict';

  var CATS = InsightEngine.CATEGORIES;
  var COLOURS = { Communication: '#2a78d6', Clerical: '#eb6834', Misdiagnosis: '#1baf7a', Malpractice: '#eda100' };
  var SEQ = ['#F2F6FC', '#D6E5F8', '#ADCBF0', '#7BABE6', '#4A89DA', '#2A6BC2', '#1C4E93'];
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var SEV_RANK = { Critical: 4, High: 3, Medium: 2, Low: 1 };

  var state = { data: [], sample: true, dept: '', cat: '', search: '', selected: null, sourceName: '' };
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pct(n, d) { return d ? Math.round(n / d * 100) : 0; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function hasComm(t) { return t.c.primary === 'Communication' || t.c.secondary === 'Communication'; }
  function swatch(cat) { return '<i class="swatch" style="background:' + (COLOURS[cat] || '#B9B8C6') + '" aria-hidden="true"></i>'; }

  // ---------- data ----------
  function fromSample() {
    var cols = window.TICKET_COLUMNS;
    return window.TICKETS_RAW.map(function (r, i) {
      var o = {}; cols.forEach(function (c, k) { o[c] = r[k]; });
      return mk({
        id: 'SB-' + (1001 + i), date: o.date, dept: o.department, channel: o.channel,
        pLang: o.patient_language, sLang: o.staff_language, severity: o.severity, label: o.reviewer_label, text: o.complaint
      });
    });
  }
  function mk(t) { t.c = InsightEngine.classify(t.text); t.month = /^\d{4}-\d{2}/.test(t.date || '') ? t.date.slice(0, 7) : ''; return t; }

  function fromUpload(rows, fields) {
    var pick = function (re) { return fields.filter(function (f) { return re.test(f); })[0]; };
    var textCol = pick(/complaint|feedback|comment|description|details|message|text|narrative|issue/i);
    if (!textCol) {
      var avg = fields.map(function (f) {
        var tot = 0; rows.forEach(function (r) { tot += String(r[f] || '').length; });
        return [f, tot / Math.max(rows.length, 1)];
      }).sort(function (a, b) { return b[1] - a[1]; });
      if (avg[0] && avg[0][1] > 25) textCol = avg[0][0];
    }
    if (!textCol) throw new Error('Could not find a column of complaint text. Name it "complaint" or "feedback" and try again.');
    var c = {
      id: pick(/^(id|ticket|ref|reference|case)/i), date: pick(/date|received|created|opened/i),
      dept: pick(/department|dept|ward|unit|service|specialty/i), sev: pick(/severity|priority|risk/i),
      label: pick(/category|label|classification|type/i), p: pick(/patient.*lang|^language$|first.?language/i),
      s: pick(/staff.*lang|clinician.*lang/i), ch: pick(/channel|source|via/i)
    };
    return rows.filter(function (r) { return String(r[textCol] || '').trim(); }).map(function (r, i) {
      var d = c.date ? toISO(r[c.date]) : '';
      var lab = c.label ? normLabel(r[c.label]) : '';
      var sev = c.sev ? normSev(r[c.sev]) : '';
      return mk({
        id: c.id && r[c.id] ? String(r[c.id]) : 'C-' + (1001 + i), date: d, dept: c.dept ? String(r[c.dept] || '').trim() : '',
        channel: c.ch ? r[c.ch] : '', pLang: c.p ? String(r[c.p] || '').trim() : '', sLang: c.s ? String(r[c.s] || '').trim() : '',
        severity: sev, label: lab, text: String(r[textCol]).trim()
      });
    });
  }
  function toISO(v) {
    var s = String(v || '').trim(), m;
    if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return m[1] + '-' + m[2] + '-' + m[3];
    if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
    return '';
  }
  function normLabel(v) {
    var s = String(v || '').toLowerCase();
    if (/comm/.test(s)) return 'Communication';
    if (/cleric|admin|billing/.test(s)) return 'Clerical';
    if (/diagnos/.test(s)) return 'Misdiagnosis';
    if (/malpractice|neglig/.test(s)) return 'Malpractice';
    return '';
  }
  function normSev(v) {
    var s = String(v || '').toLowerCase();
    if (/crit/.test(s)) return 'Critical'; if (/high/.test(s)) return 'High';
    if (/med/.test(s)) return 'Medium'; if (/low/.test(s)) return 'Low';
    return '';
  }

  // ---------- filtering ----------
  function inView() {
    return state.data.filter(function (t) { return !state.dept || t.dept === state.dept; });
  }
  function inTable(base) {
    var q = state.search.toLowerCase();
    return base.filter(function (t) {
      return (!state.cat || t.c.primary === state.cat) && (!q || t.text.toLowerCase().indexOf(q) > -1 || t.id.toLowerCase().indexOf(q) > -1);
    });
  }

  // ---------- render ----------
  function render() {
    var base = inView();
    var tbl = inTable(base);
    $('filterCount').textContent = plural(tbl.length, 'complaint') + ' in view';
    renderKpis(base);
    renderCatBars(base);
    renderTrend(base);
    renderThemes(base);
    renderLangHeat(base);
    renderDeptHeat(base);
    renderInsights(base);
    renderTable(tbl);
    renderDetail();
  }

  function setupFilters() {
    var depts = {};
    state.data.forEach(function (t) { if (t.dept) depts[t.dept] = 1; });
    $('deptFilter').innerHTML = '<option value="">All departments</option>' + Object.keys(depts).sort().map(function (d) {
      return '<option>' + esc(d) + '</option>';
    }).join('');
    $('deptFilter').value = '';
    $('catChips').innerHTML = ['All'].concat(CATS).map(function (c) {
      var v = c === 'All' ? '' : c;
      return '<button type="button" class="chip" data-cat="' + v + '" aria-pressed="' + (state.cat === v) + '">' + (v ? swatch(v) : '') + c + '</button>';
    }).join('');
  }
  function syncChips() {
    document.querySelectorAll('#catChips .chip').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-cat') === state.cat)); });
  }

  function renderKpis(base) {
    var n = base.length;
    var comm = base.filter(function (t) { return t.c.primary === 'Communication'; }).length;
    var factor = base.filter(hasComm).length;
    var sevKnown = base.filter(function (t) { return t.severity; });
    var serious = sevKnown.filter(function (t) { return SEV_RANK[t.severity] >= 3; });
    var seriousComm = serious.filter(hasComm).length;
    var labelled = base.filter(function (t) { return t.label; });
    var agree = labelled.filter(function (t) { return t.label === t.c.primary; }).length;
    var review = base.filter(function (t) { return t.c.confidence === 'Low' || t.c.confidence === 'None'; }).length;
    var months = base.map(function (t) { return t.month; }).filter(Boolean).sort();
    var span = months.length ? monthName(months[0]) + ' to ' + monthName(months[months.length - 1]) : 'In the current view';

    var k = [
      ['Complaints', n.toLocaleString('en-GB'), span],
      ['Communication as main cause', pct(comm, n) + '%', plural(comm, 'complaint') + '; ' + pct(factor, n) + '% involve communication at all'],
      sevKnown.length ? ['High or critical severity', serious.length.toLocaleString('en-GB'), pct(seriousComm, serious.length) + '% of these involve communication'] :
        ['Communication involved', factor.toLocaleString('en-GB'), 'as main or secondary cause'],
      labelled.length ? ['Agreement with reviewers', pct(agree, labelled.length) + '%', agree + ' of ' + labelled.length + ' reviewer labels matched'] :
        ['Worth a human check', review.toLocaleString('en-GB'), 'low-confidence classifications']
    ];
    $('kpis').innerHTML = k.map(function (x) {
      return '<div class="card kpi"><span class="label">' + x[0] + '</span><span class="value">' + x[1] + '</span><span class="sub">' + esc(x[2]) + '</span></div>';
    }).join('');
  }
  function monthName(ym) { return MONTHS[Number(ym.slice(5, 7)) - 1] + ' ' + ym.slice(0, 4); }

  function counts(list, key) {
    var o = {}; list.forEach(function (t) { var k = key(t); if (k) o[k] = (o[k] || 0) + 1; }); return o;
  }

  function renderCatBars(base) {
    var c = counts(base, function (t) { return t.c.primary; });
    var max = Math.max.apply(null, CATS.map(function (k) { return c[k] || 0; }).concat([1]));
    var extra = c.Unclassified ? '<p class="note" style="margin-top:6px">' + plural(c.Unclassified, 'complaint') + ' had no recognisable cues and are unclassified.</p>' : '';
    $('catBars').innerHTML = CATS.map(function (k) {
      var v = c[k] || 0;
      return '<button type="button" class="catbar" data-cat="' + k + '" aria-pressed="' + (state.cat === k) + '" aria-label="' + k + ': ' + v + ' complaints, ' + pct(v, base.length) + ' percent. Select to filter.">' +
        '<span class="name">' + swatch(k) + k + '</span>' +
        '<span class="track"><span class="fill" style="display:block;width:' + (v / max * 100) + '%;background:' + COLOURS[k] + '"></span></span>' +
        '<span class="num">' + v + ' <span>(' + pct(v, base.length) + '%)</span></span></button>';
    }).join('') + extra;
  }

  function roundedTop(x, y, w, h, r) {
    r = Math.min(r, h, w / 2);
    return 'M' + x + ',' + (y + h) + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + 'V' + (y + h) + 'Z';
  }

  function renderTrend(base) {
    $('trendLegend').innerHTML = CATS.map(function (k) { return '<span>' + swatch(k) + k + '</span>'; }).join('');
    var months = {};
    base.forEach(function (t) { if (t.month) { months[t.month] = months[t.month] || {}; months[t.month][t.c.primary] = (months[t.month][t.c.primary] || 0) + 1; } });
    var keys = Object.keys(months).sort();
    if (!keys.length) { $('trend').innerHTML = '<p class="note">No dates found in this data.</p>'; return; }
    if (keys.length > 18) keys = keys.slice(-18);
    var W = 640, H = 260, L = 34, R = 8, T = 22, B = 30;
    var totals = keys.map(function (m) { return CATS.reduce(function (s, c) { return s + (months[m][c] || 0); }, 0); });
    var maxT = Math.max.apply(null, totals.concat([1]));
    var step = maxT <= 5 ? 1 : maxT <= 12 ? 2 : maxT <= 30 ? 5 : maxT <= 60 ? 10 : Math.ceil(maxT / 5 / 10) * 10;
    var top = Math.ceil(maxT / step) * step;
    var plotH = H - T - B, plotW = W - L - R;
    var y = function (v) { return T + plotH - v / top * plotH; };
    var bw = Math.min(56, plotW / keys.length * 0.56);
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="Stacked columns of monthly complaints by category">';
    for (var g = 0; g <= top; g += step) {
      svg += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(g) + '" y2="' + y(g) + '" stroke="#ECEBF1" stroke-width="1"/>' +
        '<text x="' + (L - 8) + '" y="' + (y(g) + 4) + '" text-anchor="end" font-size="11" fill="#6A6980">' + g + '</text>';
    }
    keys.forEach(function (m, i) {
      var cx = L + plotW * (i + 0.5) / keys.length, x = cx - bw / 2, acc = 0;
      var present = CATS.filter(function (c) { return months[m][c]; });
      present.forEach(function (c, j) {
        var v = months[m][c], y0 = y(acc), y1 = y(acc + v), h = y0 - y1;
        var gap = j < present.length - 1 ? 2 : 0; // surface gap above each segment
        var tip = '<b>' + monthName(m) + '</b><br>' + c + ': ' + v + ' of ' + totals[i];
        var d = j === present.length - 1 ? roundedTop(x, y1, bw, h, 4) : 'M' + x + ',' + y1 + 'h' + bw + 'v' + (h - gap) + 'h-' + bw + 'Z';
        if (j < present.length - 1) d = 'M' + x + ',' + (y1 + gap) + 'h' + bw + 'v' + (h - gap) + 'h-' + bw + 'Z';
        svg += '<path d="' + d + '" fill="' + COLOURS[c] + '" data-tip="' + esc(tip) + '" tabindex="0" aria-label="' + esc(monthName(m) + ', ' + c + ', ' + v) + '"></path>';
        acc += v;
      });
      svg += '<text x="' + cx + '" y="' + (y(totals[i]) - 6) + '" text-anchor="middle" font-size="12" font-weight="600" fill="#16151F">' + totals[i] + '</text>' +
        '<text x="' + cx + '" y="' + (H - 10) + '" text-anchor="middle" font-size="12" fill="#55546A">' + MONTHS[Number(m.slice(5, 7)) - 1] + '</text>';
    });
    svg += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(0) + '" y2="' + y(0) + '" stroke="#C9C8D4"/></svg>';
    $('trend').innerHTML = svg;
  }

  function themeCounts(base) {
    var o = {};
    base.forEach(function (t) { t.c.themes.forEach(function (th) { o[th] = (o[th] || 0) + 1; }); });
    return Object.keys(o).map(function (k) { return [k, o[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
  }

  function renderThemes(base) {
    var list = themeCounts(base);
    if (!list.length) { $('themes').innerHTML = '<p class="note">No communication themes in this view.</p>'; return; }
    var max = list[0][1];
    $('themes').innerHTML = list.map(function (x) {
      return '<div class="theme"><span>' + esc(x[0]) + '</span><span class="track"><span class="fill" style="display:block;width:' + (x[1] / max * 100) + '%"></span></span><span class="n">' + x[1] + '</span></div>';
    }).join('');
  }

  function seqColour(v, max) {
    if (!v) return { bg: 'transparent', fg: '#B9B8C6' };
    var i = Math.min(SEQ.length - 1, Math.max(1, Math.ceil(v / max * (SEQ.length - 1))));
    return { bg: SEQ[i], fg: i >= 4 ? '#FFFFFF' : '#16151F' };
  }
  function seqKey(max) {
    return '<div class="seq-key"><span>Fewer</span>' + SEQ.slice(1).map(function (c) { return '<i style="background:' + c + '"></i>'; }).join('') + '<span>More (max ' + max + ')</span></div>';
  }

  function heatTable(rows, cols, get, opts) {
    var max = 1;
    rows.forEach(function (r) { cols.forEach(function (c) { max = Math.max(max, get(r, c)); }); });
    var h = '<table class="heat"><thead><tr><th scope="col"><span class="sr-only">' + esc(opts.corner) + '</span></th>' +
      cols.map(function (c) { return '<th scope="col">' + (opts.colHead ? opts.colHead(c) : esc(c)) + '</th>'; }).join('') + '<th scope="col">Total</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      var tot = 0;
      h += '<tr><th scope="row">' + esc(r) + '</th>' + cols.map(function (c) {
        var v = get(r, c), s = seqColour(v, max); tot += v;
        return '<td class="' + (v ? '' : 'zero') + '" style="background:' + s.bg + ';color:' + s.fg + '" data-tip="' + esc('<b>' + r + '</b><br>' + opts.tipCol + ': ' + c + '<br>' + v + ' complaints') + '">' + (v || '·') + '</td>';
      }).join('') + '<td class="total">' + tot + '</td></tr>';
    });
    return h + '</tbody></table>' + seqKey(max);
  }

  function renderLangHeat(base) {
    var comm = base.filter(hasComm).filter(function (t) { return t.pLang && t.sLang; });
    if (!comm.length) { $('langHeat').innerHTML = '<p class="note">Language details are not available for these complaints.</p>'; return; }
    var pc = counts(comm, function (t) { return t.pLang; }), sc = counts(comm, function (t) { return t.sLang; });
    var rows = Object.keys(pc).sort(function (a, b) { return pc[b] - pc[a] || a.localeCompare(b); }).slice(0, 10);
    var cols = Object.keys(sc).sort(function (a, b) { return sc[b] - sc[a] || a.localeCompare(b); }).slice(0, 8);
    var grid = {};
    comm.forEach(function (t) { var k = t.pLang + '|' + t.sLang; grid[k] = (grid[k] || 0) + 1; });
    $('langHeat').innerHTML = '<p class="note" style="margin-bottom:8px">Rows: patient language. Columns: staff language.</p>' +
      heatTable(rows, cols, function (r, c) { return grid[r + '|' + c] || 0; }, { corner: 'Patient language by staff language', tipCol: 'Staff language' });
  }

  function renderDeptHeat(base) {
    var dc = counts(base, function (t) { return t.dept; });
    var rows = Object.keys(dc).sort(function (a, b) { return dc[b] - dc[a] || a.localeCompare(b); });
    if (!rows.length) { $('deptHeat').innerHTML = '<p class="note">Department details are not available for these complaints.</p>'; return; }
    var grid = {};
    base.forEach(function (t) { var k = t.dept + '|' + t.c.primary; grid[k] = (grid[k] || 0) + 1; });
    $('deptHeat').innerHTML = heatTable(rows, CATS, function (r, c) { return grid[r + '|' + c] || 0; },
      { corner: 'Department by category', tipCol: 'Category', colHead: function (c) { return swatch(c) + ' ' + c; } });
  }

  var ACTIONS = {
    'Medical jargon and abbreviations': 'Adopt a plain-language standard for clinical conversations and written advice, avoiding abbreviations such as PRN, IUGR or DNR without explanation.',
    'Words misheard or misrecorded': 'Introduce read-back at triage and handover: staff repeat key symptoms, pain scores and history to the patient before recording them.',
    'No interpreter available': 'Provide 24-hour telephone or video interpreting covering the most common patient languages, and ban relatives as interpreters for consent.',
    'Instructions and medication advice': 'Use teach-back for every discharge and medication explanation, with translated, pictorial instruction sheets.',
    'Consent not understood': 'Require interpreter-supported consent where the patient is not confident in English, with a short check that the risks were understood.',
    'Difficult news delivered poorly': 'Train senior clinicians in breaking bad news in a second language, in a private room with family present and time for questions.',
    'Tone and respect': 'Run respect and patience training for front-desk and phone teams, focused on speakers of English as a second language.',
    'English-only written materials': 'Translate core leaflets and discharge sheets into the main patient languages.',
    'Speaking too fast': 'Coach staff to slow down, pause and check understanding, especially on the phone and through speakers.'
  };

  function renderInsights(base) {
    var n = base.length, out = [];
    if (!n) { $('insights').innerHTML = '<li><span></span><span>No complaints in this view.</span></li>'; return; }
    var comm = base.filter(function (t) { return t.c.primary === 'Communication'; }).length;
    var factor = base.filter(hasComm).length;
    out.push(['chat', '<b>Communication is the leading issue:</b> ' + pct(comm, n) + '% of complaints are mainly about communication, and ' + pct(factor, n) + '% involve it as a main or secondary cause.']);

    var th = themeCounts(base);
    if (th.length) {
      var fac = Math.max(factor, 1);
      out.push(['list', '<b>Top communication themes:</b> ' + th.slice(0, 3).map(function (x) { return esc(x[0].toLowerCase()) + ' (' + pct(x[1], fac) + '%)'; }).join(', ') + '.']);
    }

    var depts = counts(base.filter(hasComm), function (t) { return t.dept; });
    var all = counts(base, function (t) { return t.dept; });
    var topD = Object.keys(depts).sort(function (a, b) { return depts[b] - depts[a]; })[0];
    if (topD && !state.dept) out.push(['building', '<b>' + esc(topD) + '</b> has the most complaints involving communication (' + depts[topD] + ' of its ' + all[topD] + ').']);

    var serious = base.filter(function (t) { return SEV_RANK[t.severity] >= 3; });
    if (serious.length) {
      var clinical = base.filter(function (t) { return (t.c.primary === 'Misdiagnosis' || t.c.primary === 'Malpractice') && t.c.scores.Communication > 0; }).length;
      out.push(['alert', '<b>Language affects clinical safety:</b> ' + pct(serious.filter(hasComm).length, serious.length) + '% of high or critical complaints involve communication, and ' + plural(clinical, 'misdiagnosis or malpractice complaint') + ' also describe not being understood.']);
    }

    var pairs = counts(base.filter(hasComm).filter(function (t) { return t.pLang && t.sLang; }), function (t) { return t.pLang + ' speaking patients with ' + t.sLang + ' speaking staff'; });
    var topP = Object.keys(pairs).sort(function (a, b) { return pairs[b] - pairs[a]; })[0];
    var pl = counts(base.filter(hasComm), function (t) { return t.pLang; });
    var topL = Object.keys(pl).sort(function (a, b) { return pl[b] - pl[a]; }).slice(0, 4);
    if (topL.length) out.push(['globe', '<b>Languages to prioritise:</b> ' + topL.map(esc).join(', ') + ' speaking patients raise the most communication complaints' + (topP && pairs[topP] > 1 ? '; the most frequent pairing is ' + esc(topP) + ' (' + pairs[topP] + ').' : '.')]);

    if (th.length) {
      out.push(['target', '<b>Suggested focus:</b> ' + th.slice(0, 2).map(function (x) { return ACTIONS[x[0]]; }).filter(Boolean).join(' ')]);
    }
    var icons = {
      chat: '<path d="M4 5h16v11H8l-4 4z"/>', list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
      building: '<path d="M3 21h18M5 21V7l7-4 7 4v14"/>', alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v4M12 17v.01"/>',
      globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>', target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'
    };
    $('insights').innerHTML = out.map(function (o) {
      return '<li><span class="ico"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' + icons[o[0]] + '</svg></span><span>' + o[1] + '</span></li>';
    }).join('');
  }

  function catPill(cat) { return cat ? '<span class="pill">' + swatch(cat) + cat + '</span>' : '<span class="note">None</span>'; }

  function renderTable(list) {
    var hasLabel = state.data.some(function (t) { return t.label; });
    var hasSev = state.data.some(function (t) { return t.severity; });
    var shown = list.slice(0, 500);
    var h = '<thead><tr><th scope="col">Ticket</th><th scope="col">Date</th><th scope="col">Department</th><th scope="col">Engine category</th><th scope="col">Secondary</th><th scope="col">Confidence</th>' +
      (hasSev ? '<th scope="col">Severity</th>' : '') + (hasLabel ? '<th scope="col">Reviewer</th>' : '') + '<th scope="col">Complaint</th></tr></thead><tbody>';
    if (!shown.length) h += '<tr><td colspan="9" class="note" style="padding:16px">No complaints match these filters.</td></tr>';
    shown.forEach(function (t) {
      var match = t.label ? (t.label === t.c.primary ? '<span class="match">Agrees</span>' : '<span class="nomatch">' + esc(t.label) + '</span>') : '';
      h += '<tr class="' + (state.selected === t.id ? 'sel' : '') + '"><td><button type="button" class="open" data-id="' + esc(t.id) + '">' + esc(t.id) + '</button></td>' +
        '<td style="white-space:nowrap">' + esc(t.date || '') + '</td><td>' + esc(t.dept || '') + '</td><td>' + catPill(t.c.primary === 'Unclassified' ? '' : t.c.primary) + '</td>' +
        '<td>' + (t.c.secondary ? catPill(t.c.secondary) : '') + '</td><td>' + t.c.confidence + '</td>' +
        (hasSev ? '<td>' + (t.severity ? '<span class="pill sev-' + t.severity + '">' + t.severity + '</span>' : '') + '</td>' : '') +
        (hasLabel ? '<td>' + match + '</td>' : '') +
        '<td class="snip">' + esc(t.text.length > 120 ? t.text.slice(0, 117) + '...' : t.text) + '</td></tr>';
    });
    h += '</tbody>';
    $('tickets').innerHTML = h;
    if (list.length > 500) $('tickets').insertAdjacentHTML('afterend', '');
  }

  function highlight(text, ev) {
    var out = '', pos = 0;
    ev.forEach(function (e) {
      if (e.start < pos) return;
      out += esc(text.slice(pos, e.start)) + '<mark style="border-color:' + COLOURS[e.category] + '" title="' + esc(e.category + ': ' + e.cue) + '">' + esc(text.slice(e.start, e.end)) + '</mark>';
      pos = e.end;
    });
    return out + esc(text.slice(pos));
  }

  function resultHtml(text, c, t) {
    var maxS = Math.max.apply(null, CATS.map(function (k) { return c.scores[k]; }).concat([1]));
    var meta = t ? '<div class="meta-grid">' +
      [['Date', t.date], ['Department', t.dept], ['Channel', t.channel], ['Patient language', t.pLang], ['Staff language', t.sLang], ['Severity', t.severity], ['Reviewer label', t.label]]
        .filter(function (x) { return x[1]; }).map(function (x) { return '<span>' + x[0] + ': <b>' + esc(x[1]) + '</b></span>'; }).join('') + '</div>' : '';
    return (t ? '<h3>' + esc(t.id) + '</h3>' : '') + meta +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center"><span style="font-weight:500">Engine result:</span>' +
      (c.primary === 'Unclassified' ? '<span class="pill">Unclassified</span>' : catPill(c.primary)) +
      (c.secondary ? '<span class="note">with secondary</span>' + catPill(c.secondary) : '') + '<span class="note">Confidence: ' + c.confidence + '</span></div>' +
      '<div><div class="legend" style="margin-bottom:6px">' + CATS.map(function (k) { return '<span><i class="swatch" style="background:' + COLOURS[k] + ';height:3px;width:14px;border-radius:0"></i>' + k + ' cue</span>'; }).join('') + '</div>' +
      '<p class="evidence">' + highlight(text, c.evidence) + '</p></div>' +
      '<div class="scores" aria-label="Category scores">' + CATS.map(function (k) {
        return '<div class="score"><span>' + k + '</span><span class="track"><span class="fill" style="display:block;width:' + (c.scores[k] / maxS * 100) + '%;background:' + COLOURS[k] + '"></span></span><span class="v">' + c.scores[k] + '</span></div>';
      }).join('') + '</div>' +
      (c.themes.length ? '<div class="tags"><span class="note" style="margin-right:4px">Communication themes:</span>' + c.themes.map(function (x) { return '<span class="pill">' + esc(x) + '</span>'; }).join('') + '</div>' : '');
  }

  function renderDetail() {
    var t = state.data.filter(function (x) { return x.id === state.selected; })[0];
    $('detail').innerHTML = t ? '<div class="detail">' + resultHtml(t.text, t.c, t) +
      '<div><button type="button" class="btn btn-quiet" id="closeDetail">Close ticket</button></div></div>' : '';
  }

  function renderAccuracy() {
    var lab = state.data.filter(function (t) { return t.label; });
    if (!lab.length) { $('accuracy').textContent = 'Your file has no category column, so there are no reviewer labels to compare against.'; return; }
    var ok = lab.filter(function (t) { return t.label === t.c.primary; }).length;
    $('accuracy').textContent = state.sample ?
      'On this sample the engine agrees with the reviewer label on ' + ok + ' of ' + lab.length + ' tickets. The cues were written with this sample in view, so treat that as an upper bound; a separate check on unseen complaints also performed well, but real complaints will be messier and a human should review low-confidence results.' :
      'On your file the engine agrees with your existing category on ' + ok + ' of ' + lab.length + ' complaints (' + pct(ok, lab.length) + '%).';
  }

  // ---------- data loading ----------
  function useData(data, sample, name) {
    state.data = data; state.sample = sample; state.dept = ''; state.cat = ''; state.search = ''; state.selected = null; state.sourceName = name || '';
    $('search').value = '';
    $('resetData').hidden = sample;
    $('dataNotice').textContent = sample ?
      'All tickets are synthesised for demonstration. The hospital, patients, staff and events are invented. English is the working language of the hospital and the second language of almost every patient and clinician in this sample.' :
      'Showing ' + plural(data.length, 'complaint') + ' from ' + name + '. The file was read in your browser and has not been uploaded anywhere.';
    $('orgLabel').lastChild.textContent = sample ? ' Saffron Bay Hospital, Dubai (fictional)' : ' ' + name;
    setupFilters(); renderAccuracy(); render();
  }

  $('upload').addEventListener('change', function (e) {
    var f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    Papa.parse(f, {
      header: true, skipEmptyLines: 'greedy',
      complete: function (res) {
        try {
          var data = fromUpload(res.data, res.meta.fields || []);
          if (!data.length) throw new Error('No complaints found in ' + f.name + '.');
          useData(data, false, f.name);
        } catch (err) {
          $('dataNotice').textContent = err.message;
        }
      },
      error: function () { $('dataNotice').textContent = 'Could not read ' + f.name + '.'; }
    });
  });
  $('resetData').addEventListener('click', function () { useData(fromSample(), true); });

  // ---------- events ----------
  $('deptFilter').addEventListener('change', function (e) { state.dept = e.target.value; render(); });
  function setCat(c) { state.cat = state.cat === c ? '' : c; syncChips(); render(); }
  $('catChips').addEventListener('click', function (e) { var b = e.target.closest('[data-cat]'); if (b) { state.cat = b.getAttribute('data-cat'); syncChips(); render(); } });
  $('catBars').addEventListener('click', function (e) { var b = e.target.closest('[data-cat]'); if (b) setCat(b.getAttribute('data-cat')); });
  $('search').addEventListener('input', function (e) { state.search = e.target.value.trim(); render(); });
  $('tickets').addEventListener('click', function (e) {
    var b = e.target.closest('[data-id]');
    if (!b) return;
    state.selected = b.getAttribute('data-id'); render();
    $('detail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
  $('detail').addEventListener('click', function (e) { if (e.target.id === 'closeDetail') { state.selected = null; render(); } });

  var EXAMPLES = [
    'The nurse explained my discharge medicines very fast in English and I did not understand which tablet to stop. There was no interpreter and the leaflet was only in English.',
    'I was charged twice for the same blood test and the billing team keep transferring my call.',
    'My mother was told her chest pain is only anxiety and sent home. Two days later another hospital found she had a heart attack.',
    'The nurse gave my son the wrong dose of antibiotic because she did not check the weight. He needed treatment in ICU.'
  ];
  var exI = 0;
  $('tryExample').addEventListener('click', function () { $('tryText').value = EXAMPLES[exI++ % EXAMPLES.length]; classifyTry(); });
  $('tryBtn').addEventListener('click', classifyTry);
  function classifyTry() {
    var txt = $('tryText').value.trim();
    if (!txt) { $('tryText').focus(); return; }
    var c = InsightEngine.classify(txt);
    $('tryResult').innerHTML = '<div class="detail">' + resultHtml(txt, c) +
      (c.primary === 'Unclassified' ? '<p class="note">No cues matched. Try describing what happened in a sentence or two.</p>' : '') + '</div>';
  }

  // tooltip
  var tip = $('tip');
  function showTip(el, x, y) { tip.innerHTML = el.getAttribute('data-tip'); tip.style.opacity = 1; place(x, y); }
  function place(x, y) {
    var r = tip.getBoundingClientRect(), nx = x + 14, ny = y + 14;
    if (nx + r.width > window.innerWidth - 8) nx = x - r.width - 14;
    if (ny + r.height > window.innerHeight - 8) ny = y - r.height - 14;
    tip.style.left = nx + 'px'; tip.style.top = ny + 'px';
  }
  document.addEventListener('mousemove', function (e) {
    var el = e.target.closest && e.target.closest('[data-tip]');
    if (el) showTip(el, e.clientX, e.clientY); else tip.style.opacity = 0;
  });
  document.addEventListener('focusin', function (e) {
    var el = e.target.closest && e.target.closest('[data-tip]');
    if (el) { var r = el.getBoundingClientRect(); showTip(el, r.right, r.top); } else tip.style.opacity = 0;
  });

  useData(fromSample(), true);
})();
