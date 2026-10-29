/*
 * Business case parser: pulls the parts of a program business case out of
 * plain text (from Word, PDF, Markdown or text files) by recognising headings.
 * Whatever it finds pre-fills the coach, where the user reviews and completes it.
 */
(function (root) {
  'use strict';

  var SECTIONS = [
    ['sponsor', /^(executive )?sponsor|^(program|programme|project) (sponsor|owner)|^accountable/i],
    ['projects', /project(s| list| breakdown| portfolio)?$|workstreams?|work ?packages?|initiatives|components|delivery (plan|structure)|projects (in|within)/i],
    ['objectives', /objective|goals?$|aims?$|purpose|outcomes?$|success (criteria|measures)/i],
    ['scope', /scope/i],
    ['benefits', /benefit|value|return on|roi\b|business impact/i],
    ['costs', /cost|budget|investment|funding|financial|commercial/i],
    ['timeline', /timeline|milestone|schedule|timescale|roadmap|high.level plan|key dates|phasing/i],
    ['risks', /risk|issues?$|assumptions|dependenc|constraints/i],
    ['problem', /background|problem|context|current (state|situation)|case for change|executive summary|opportunity|introduction|overview|rationale|strategic (case|fit)|why/i],
    ['name', /^(program|programme|project) (name|title)$|^title$/i]
  ];

  function isBullet(l) { return /^\s*([-*•▪◦–]|\d+[.)]|[a-z][.)])\s+/.test(l); }
  function stripBullet(l) { return l.replace(/^\s*([-*•▪◦–]|\d+[.)]|[a-z][.)])\s+/, '').trim(); }

  function headingOf(line, next) {
    var l = line.trim();
    if (!l || l.length > 70) return null;
    var md = l.match(/^#{1,6}\s+(.+)$/);
    if (md) return md[1].trim();
    var num = l.match(/^(\d+(\.\d+)*)[.)]?\s+([A-Z][^.]{2,60})$/);
    if (num && !/[.;]$/.test(l) && l.split(/\s+/).length <= 8) return num[3].trim();
    if (/:$/.test(l) && l.split(/\s+/).length <= 7) return l.replace(/:$/, '').trim();
    if (/^[A-Z0-9 &/,'()-]{4,}$/.test(l) && /[A-Z]{3}/.test(l)) return l;
    if (!isBullet(l) && !/[.;,]$/.test(l) && l.split(/\s+/).length <= 6 && /^[A-Z]/.test(l) && next && next.trim().length > l.length) {
      // a short title-like line followed by longer text
      if (SECTIONS.some(function (s) { return s[1].test(l); })) return l;
    }
    return null;
  }

  function classify(h) {
    var t = h.replace(/^[\d.\s]+/, '').trim();
    for (var i = 0; i < SECTIONS.length; i++) if (SECTIONS[i][1].test(t)) return SECTIONS[i][0];
    return null;
  }

  function listFrom(lines) {
    var bullets = lines.filter(isBullet).map(stripBullet).filter(Boolean);
    if (bullets.length) return bullets;
    // Word exports often drop bullet characters: several short lines are separate items
    var plain = lines.map(function (l) { return l.trim(); }).filter(Boolean);
    if (plain.length > 1 && plain.every(function (l) { return l.length < 220 && !/[.]\s+[A-Z]/.test(l); })) return plain.map(function (l) { return l.replace(/[.;]$/, ''); });
    var text = lines.join(' ').replace(/\s+/g, ' ').trim();
    if (!text) return [];
    return text.split(/(?<=[.;])\s+(?=[A-Z])/).map(function (s) { return s.replace(/[.;]$/, '').trim(); }).filter(function (s) { return s.length > 3; });
  }
  function para(lines) { return lines.map(function (l) { return isBullet(l) ? stripBullet(l) : l.trim(); }).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim(); }

  var NAME_RE = "([A-Z][a-zA-Z'’.-]+(?:\\s+[A-Z][a-zA-Z'’.-]+){0,2})";
  function project(line) {
    var l = line.replace(/\s+/g, ' ').trim(), lead = '';
    var cells = l.split(/\s*[|\t]\s*/).filter(Boolean);
    if (cells.length >= 3) return { name: cells[0], lead: cells.length > 2 ? cells[1] : '', goal: cells.slice(2).join(' ') };
    var lm = l.match(new RegExp('\\(?\\b(?:lead|owner|led by|project manager|pm|accountable)\\s*[:\\-–]?\\s*' + NAME_RE + '\\)?', 'i'));
    if (lm) { lead = lm[1].replace(/[.,;]$/, ''); l = l.replace(lm[0], '').replace(/\s*[,;(]\s*$/, '').replace(/\(\s*\)/, '').trim(); }
    var parts = l.split(/\s*(?::|\s[-–—]\s)\s*/);
    var name = parts[0], goal = parts.slice(1).join(': ');
    if (!goal && name.split(' ').length > 8) {
      var s = name.split(/(?<=\.)\s+/); name = s[0].split(/\s+/).slice(0, 6).join(' '); goal = l;
    }
    return { name: name.replace(/[.,;]$/, '').trim(), lead: lead, goal: goal.replace(/^[,;]\s*/, '').trim() };
  }

  function parse(text) {
    var lines = String(text || '').replace(/\r/g, '').split('\n');
    var out = { found: [] }, current = null, buckets = {}, preamble = [];
    lines.forEach(function (line, i) {
      var nxt = ''; for (var j = i + 1; j < lines.length; j++) { if (lines[j].trim()) { nxt = lines[j]; break; } }
      var h = headingOf(line, nxt);
      var cls = h ? classify(h) : null;
      if (h && !out._title && !cls) out._title = h;
      if (h) { current = cls; if (cls && !buckets[cls]) buckets[cls] = []; return; }
      if (!line.trim()) return;
      if (current) buckets[current].push(line); else preamble.push(line);
    });

    var all = lines.join('\n');
    var sp = all.match(/(?:executive\s+)?sponsor\s*[:\-–]\s*([^\n]+)/i);
    if (sp) out.sponsor = sp[1].trim();
    else if (buckets.sponsor) out.sponsor = para(buckets.sponsor).split(/(?<=\.)\s/)[0];
    var nm = all.match(/(?:program|programme|project)\s+name\s*[:\-–]\s*([^\n]+)/i);
    if (nm) out.name = nm[1].trim();
    else if (buckets.name) out.name = para(buckets.name);
    else {
      var first = (out._title || preamble[0] || '').replace(/^(business case|outline business case|full business case)\s*[:\-–]?\s*/i, '').trim();
      if (first && first.length < 90) out.name = first.replace(/\s*[:\-–]\s*business case$/i, '');
    }
    var pm = all.match(/(?:program|programme|project)\s+(?:manager|director|lead)\s*[:\-–]\s*([^\n]+)/i);
    if (pm) out.manager = pm[1].trim();

    if (buckets.problem) out.problem = para(buckets.problem);
    if (buckets.objectives) out.objectives = listFrom(buckets.objectives);
    if (buckets.benefits) out.benefits = listFrom(buckets.benefits);
    if (buckets.risks) out.risks = listFrom(buckets.risks);
    if (buckets.costs) out.costs = para(buckets.costs);
    if (buckets.timeline) out.timeline = para(buckets.timeline);
    if (buckets.scope) {
      var sIn = [], sOut = [], mode = 'in';
      buckets.scope.forEach(function (l) {
        if (/out of scope|excluded|exclusions|not in scope/i.test(l)) { mode = 'out'; var r = l.replace(/.*?(out of scope|excluded|exclusions|not in scope)\s*[:\-–]?\s*/i, ''); if (r) sOut.push(r); return; }
        if (/^\s*in scope\s*[:\-–]?/i.test(l)) { mode = 'in'; var r2 = l.replace(/^\s*in scope\s*[:\-–]?\s*/i, ''); if (r2) sIn.push(r2); return; }
        (mode === 'in' ? sIn : sOut).push(isBullet(l) ? stripBullet(l) : l.trim());
      });
      out.scopeIn = sIn.join('; ').replace(/\s+/g, ' ').trim();
      out.scopeOut = sOut.join('; ').replace(/\s+/g, ' ').trim();
    }
    if (buckets.projects) {
      var items = buckets.projects.filter(isBullet);
      if (!items.length) items = buckets.projects.filter(function (l) { return /[|\t]|:|\s[-–—]\s/.test(l) && l.trim().length > 5; });
      out.projects = items.map(function (l) { return project(isBullet(l) ? stripBullet(l) : l); })
        .filter(function (p) { return p.name && !/^(project|name|workstream)$/i.test(p.name); }).slice(0, 15);
    }
    if (!out.problem && preamble.length > 1) out.problem = para(preamble.slice(1)).slice(0, 1200);

    ['name', 'sponsor', 'problem', 'objectives', 'scopeIn', 'benefits', 'costs', 'timeline', 'risks', 'projects'].forEach(function (k) {
      var v = out[k];
      if (v && (!Array.isArray(v) || v.length)) out.found.push(k);
    });
    delete out._title;
    return out;
  }

  var api = { parse: parse };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CaseParser = api;
})(this);
