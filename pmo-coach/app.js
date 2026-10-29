/* Program Creation & PMO Coach: application logic. */
(function () {
  'use strict';

  // ---------- utilities ----------
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pad(n) { return ('0' + n).slice(-2); }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function today() { return iso(new Date()); }
  function addDays(n) { var d = new Date(); d.setDate(d.getDate() + n); return iso(d); }
  function parseISO(s) { var m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function fmt(s) { var d = parseISO(s); return d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''; }
  function fmtShort(s) { var d = parseISO(s); return d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''; }
  function daysFromToday(s) { var d = parseISO(s); if (!d) return null; var t = parseISO(today()); return Math.round((d - t) / 864e5); }
  function lines(v) { return String(v || '').split('\n').map(function (x) { return x.replace(/^\s*([-*•]|\d+[.)])\s*/, '').trim(); }).filter(Boolean); }
  function uid() { return 'p' + Math.random().toString(36).slice(2, 8); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  // ---------- state ----------
  var KEY = 'pmo_coach_v1';
  var state = { program: null, source: '' };
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable: keep in memory */ } }
  function load() { try { var s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.program) state = s; } catch (e) { /* ignore */ } }

  function blankProgram() {
    return { name: '', organisation: '', sponsor: '', manager: '', problem: '', objectives: [], scopeIn: '', scopeOut: '', benefits: [], costs: '', timeline: '', risks: [], projects: [] };
  }
  function blankStatus() { return { date: '', rag: 'None', summary: '', pathToGreen: '', actionsThisWeek: [], completedLastWeek: [], raid: [], critical: [] }; }
  function sampleProgram() {
    var p = clone(window.SAMPLE_PROGRAM);
    p.projects.forEach(function (pr) {
      pr.start = addDays(pr.start); pr.end = addDays(pr.end);
      var s = pr.status;
      s.date = addDays(s.date);
      s.actionsThisWeek.forEach(function (a) { a.due = addDays(a.due); });
      s.raid.forEach(function (r) { r.due = addDays(r.due); });
      s.critical.forEach(function (c) { c.date = addDays(c.date); });
    });
    return p;
  }
  function ensureProjects(p) {
    p.projects.forEach(function (pr) {
      if (!pr.id) pr.id = uid();
      if (!pr.status) pr.status = blankStatus();
    });
  }
  function project(id) { return state.program && state.program.projects.filter(function (p) { return p.id === id; })[0]; }

  // ---------- routing ----------
  var view = $('#view');
  function go(h) { if (location.hash === h) render(); else location.hash = h; }
  window.addEventListener('hashchange', render);
  function render() {
    var h = location.hash.replace(/^#\/?/, '').split('/');
    var v = h[0] || 'home';
    var navV = v === 'slide' || v === 'edit' ? 'dashboard' : v;
    $$('#nav a').forEach(function (a) { if (a.getAttribute('data-v') === navV) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    view.oninput = null; view.onclick = null;
    if (v === 'coach') renderCoach(Number(h[1] || 0));
    else if (v === 'case') renderCase();
    else if (v === 'dashboard') renderDashboard();
    else if (v === 'slide') renderSlide(h[1]);
    else if (v === 'edit') renderEdit(h[1]);
    else renderHome();
    window.scrollTo(0, 0);
  }

  function needProgram() {
    view.innerHTML = '<div class="card pad"><h1>No program yet</h1><p class="lead">Upload a business case, build one with the coach, or explore the sample program.</p><div class="btn-row" style="margin-top:14px"><a class="btn btn-primary" href="#/">Get started</a><button class="btn btn-outline" id="useSample">Explore the sample program</button></div></div>';
    $('#useSample').onclick = loadSample;
  }
  function loadSample() { state = { program: sampleProgram(), source: 'sample' }; save(); go('#/dashboard'); }

  var flash = '';
  function flashHtml() { var f = flash; flash = ''; return f; }

  // ---------- home ----------
  function renderHome() {
    var p = state.program;
    view.innerHTML = flashHtml() +
      '<section><h1>Program Creation &amp; PMO Coach</h1><p class="lead">Turn a business case into a running program. Upload the business case you have, or let the coach take you through writing one, then manage every project from a single RAG dashboard with a status slide for each.</p>' +
      '<div class="steps-line" style="margin-top:14px"><span><b>1</b> Business case</span><span><b>2</b> Program dashboard</span><span><b>3</b> Project status slides</span></div></section>' +
      (p ? '<div class="alert info" style="display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;justify-content:space-between"><span>You are working on <b>' + esc(p.name || 'an untitled program') + '</b>' + (state.source === 'sample' ? ' (sample)' : '') + '.</span><span class="btn-row"><a class="btn btn-sm btn-primary" href="#/dashboard">Open dashboard</a><button class="btn btn-sm btn-quiet" id="startOver">Start a new program</button></span></div>' : '') +
      '<div class="grid2">' +
      '<section class="card option" aria-labelledby="o1"><span class="ico"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg></span>' +
      '<h2 id="o1">I have a business case</h2><p>Upload it and the coach will pull out the program name, sponsor, objectives, benefits, costs, risks and projects, then show you what is missing.</p>' +
      '<div class="drop" id="drop"><span>Drag your file here or</span><label class="btn btn-primary" for="file">Choose a file<input type="file" id="file" class="sr-only" accept=".docx,.pdf,.txt,.md,.json"></label><span class="note">Word (.docx), PDF, text or Markdown. Read in your browser, never uploaded.</span></div>' +
      '<div id="uploadMsg" aria-live="polite"></div></section>' +
      '<section class="card option" aria-labelledby="o2"><span class="ico"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 5h16v11H8l-4 4z"/><path d="M8 9h8M8 12h5"/></svg></span>' +
      '<h2 id="o2">Coach me through it</h2><p>Answer ten short sets of questions. At each step you get tips on what good looks like and live checks, such as whether your objectives are measurable and dated.</p>' +
      '<div class="btn-row" style="margin-top:auto"><button class="btn btn-primary" id="startCoach">Start the coach</button></div></section>' +
      '<section class="card option" aria-labelledby="o3"><span class="ico"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10M7 13h6M7 17h8"/></svg></span>' +
      '<h2 id="o3">Explore the sample program</h2><p>A six-project digital onboarding program at a fictional bank, with Red, Amber and Green projects, RAID logs and critical paths already filled in.</p>' +
      '<div class="btn-row" style="margin-top:auto"><button class="btn btn-outline" id="sample">Open the sample</button></div></section>' +
      '</div>' +
      '<footer>Everything runs in your browser and is saved only on this device. Use Export on the dashboard to keep a copy or move it to another device.</footer>';

    var drop = $('#drop');
    ['dragenter', 'dragover'].forEach(function (e) { drop.addEventListener(e, function (ev) { ev.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (e) { drop.addEventListener(e, function (ev) { ev.preventDefault(); drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function (ev) { if (ev.dataTransfer.files[0]) readUpload(ev.dataTransfer.files[0]); });
    $('#file').addEventListener('change', function (ev) { if (ev.target.files[0]) readUpload(ev.target.files[0]); ev.target.value = ''; });
    $('#startCoach').onclick = function () {
      if (!state.program || state.source === 'sample') state = { program: blankProgram(), source: 'user' };
      save(); go('#/coach/0');
    };
    $('#sample').onclick = loadSample;
    if ($('#startOver')) $('#startOver').onclick = function () {
      if (!confirm('Start a new program? The current one will be replaced on this device.')) return;
      state = { program: blankProgram(), source: 'user' }; save(); go('#/coach/0');
    };
  }

  // ---------- reading files ----------
  function loadScript(src) {
    return new Promise(function (ok, fail) {
      if ($('script[src="' + src + '"]')) return ok();
      var s = document.createElement('script'); s.src = src; s.onload = ok;
      s.onerror = function () { fail(new Error('A file reader could not load.')); };
      document.head.appendChild(s);
    });
  }
  function fileText(f) {
    var ext = (f.name.split('.').pop() || '').toLowerCase();
    if (ext === 'txt' || ext === 'md') return f.text();
    if (ext === 'docx') {
      return Promise.all([loadScript('vendor/mammoth.browser.min.js'), f.arrayBuffer()]).then(function (r) {
        return window.mammoth.extractRawText({ arrayBuffer: r[1] }).then(function (x) { return x.value; });
      });
    }
    if (ext === 'pdf') {
      return Promise.all([loadScript('vendor/pdf.min.js'), f.arrayBuffer()]).then(function (r) {
        var lib = window.pdfjsLib;
        lib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
        return lib.getDocument({ data: new Uint8Array(r[1]), isEvalSupported: false }).promise.then(function (pdf) {
          var pages = [];
          for (var i = 1; i <= Math.min(pdf.numPages, 60); i++) pages.push(pdf.getPage(i).then(function (pg) { return pg.getTextContent(); }));
          return Promise.all(pages).then(function (contents) {
            return contents.map(function (c) {
              var out = '', lastY = null;
              c.items.forEach(function (it) {
                var y = it.transform ? Math.round(it.transform[5]) : null;
                if (lastY !== null && y !== lastY) out += '\n';
                out += it.str; if (it.hasEOL) out += '\n';
                lastY = y;
              });
              return out;
            }).join('\n');
          });
        });
      });
    }
    return Promise.reject(new Error('That file type is not supported. Use Word (.docx), PDF, text or Markdown.'));
  }

  function readUpload(f) {
    var msg = $('#uploadMsg');
    msg.innerHTML = '<p class="note">Reading ' + esc(f.name) + '...</p>';
    if (/\.json$/i.test(f.name)) {
      f.text().then(function (t) {
        var j = JSON.parse(t);
        if (!j || !j.program || !Array.isArray(j.program.projects)) throw new Error('This is not a program export from this app.');
        state = { program: j.program, source: 'user' }; ensureProjects(state.program); save(); go('#/dashboard');
      }).catch(function (e) { msg.innerHTML = '<div class="alert err">' + esc(e.message) + '</div>'; });
      return;
    }
    fileText(f).then(function (text) {
      if (!text || text.trim().length < 40) throw new Error('No readable text was found in ' + f.name + '. If it is a scanned PDF, copy the text into a .txt file instead.');
      var r = CaseParser.parse(text);
      var p = blankProgram();
      ['name', 'sponsor', 'manager', 'problem', 'objectives', 'scopeIn', 'scopeOut', 'benefits', 'costs', 'timeline', 'risks'].forEach(function (k) { if (r[k]) p[k] = r[k]; });
      p.projects = (r.projects || []).map(function (x) { return { id: uid(), name: x.name, lead: x.lead || '', goal: x.goal || '', start: '', end: '', status: blankStatus() }; });
      state = { program: p, source: 'user' }; save();
      var labels = { name: 'Program name', sponsor: 'Sponsor', problem: 'Background', objectives: 'Objectives', scopeIn: 'Scope', benefits: 'Benefits', costs: 'Costs', timeline: 'Timeline', risks: 'Risks', projects: 'Projects' };
      var found = Object.keys(labels).map(function (k) { return '<span class="tag ' + (r.found.indexOf(k) > -1 ? 'yes' : 'no') + '">' + labels[k] + '</span>'; }).join('');
      flash = '<div class="alert ok"><b>Read ' + esc(f.name) + '.</b> Green sections were found; amber ones are missing and worth adding. Review everything below, then create your dashboard.<div class="found" style="margin-top:8px">' + found + '</div></div>';
      go('#/coach/9');
    }).catch(function (e) { msg.innerHTML = '<div class="alert err">' + esc(e.message) + '</div>'; });
  }

  // ---------- coach ----------
  var hasNum = /\d/;
  var hasDate = /\b(19|20)\d{2}\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|\bq[1-4]\b|\bwithin\s+\w+\s+(day|week|month|year)s?|\bby\s+(the\s+)?(end|close)\b|\b\d+\s+(weeks?|months?|years?)\b/i;
  var hasMoney = /[£$€]\s?\d|\d\s?(k|m|bn|million|thousand)\b/i;
  function short(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 3) + '...' : s; }

  var STEPS = [
    {
      key: 'basics', title: 'Program basics', intro: 'Name the program and the people accountable for it.',
      tips: ['Use a name that says what changes, for example "Digital Customer Onboarding" rather than "Project Phoenix".', 'The sponsor is the one senior person accountable for the benefits. Avoid naming a committee.', 'The program manager runs it day to day and owns this dashboard.'],
      form: function (p) {
        return '<div class="two">' + inp('name', 'Program name', p.name, 'For example: Finance Systems Modernisation') + inp('organisation', 'Organisation', p.organisation, 'Your organisation or division') + '</div>' +
          '<div class="two">' + inp('sponsor', 'Sponsor', p.sponsor, 'Name and role') + inp('manager', 'Program manager', p.manager, 'Name and role') + '</div>';
      },
      checks: function (p) {
        return [[!!p.name.trim(), 'Program has a name'], [!!p.sponsor.trim(), 'A single sponsor is named'], [!!p.manager.trim(), 'A program manager is named']];
      }
    },
    {
      key: 'problem', title: 'Background and case for change', intro: 'Why does this program need to happen, and why now?',
      tips: ['Describe the situation today with evidence: volumes, costs, times, complaints.', 'Say what happens if you do nothing.', 'Keep it to a short paragraph a senior reader can absorb in a minute.'],
      form: function (p) { return area('problem', 'What is the problem or opportunity?', p.problem, 'For example: Month-end close takes 12 working days and relies on 40 spreadsheets...', 'A paragraph is enough.'); },
      checks: function (p) { return [[p.problem.trim().length >= 120, 'Enough detail for a reader new to the topic (around two sentences or more)'], [hasNum.test(p.problem), 'Backed by at least one number']]; }
    },
    {
      key: 'objectives', title: 'Objectives', intro: 'What will be true when the program succeeds?',
      tips: ['Write each objective so it can be measured: from what, to what, by when.', 'Three to five objectives is usually right.', 'Start with a verb: reduce, increase, remove, launch.'],
      form: function (p) { return area('objectives', 'Objectives, one per line', p.objectives.join('\n'), 'Reduce month-end close from 12 to 5 working days by December 2027', 'Each line becomes one objective.'); },
      checks: function (p) {
        var o = p.objectives, out = [[o.length >= 2, 'At least two objectives']];
        o.forEach(function (x) {
          var ok = hasNum.test(x) && hasDate.test(x);
          out.push([ok, '"' + esc(short(x, 50)) + '" ' + (ok ? 'is measurable and dated' : 'needs ' + (!hasNum.test(x) ? 'a measure' : '') + (!hasNum.test(x) && !hasDate.test(x) ? ' and ' : '') + (!hasDate.test(x) ? 'a date' : ''))]);
        });
        return out;
      }
    },
    {
      key: 'scope', title: 'Scope', intro: 'Draw the boundary so everyone knows what is included and what is not.',
      tips: ['Being explicit about what is out of scope prevents scope creep later.', 'Name products, teams, systems or geographies.'],
      form: function (p) { return area('scopeIn', 'In scope', p.scopeIn, 'Products, systems, teams and locations included', '') + area('scopeOut', 'Out of scope', p.scopeOut, 'What this program will not change', ''); },
      checks: function (p) { return [[!!p.scopeIn.trim(), 'In-scope items listed'], [!!p.scopeOut.trim(), 'Out-of-scope items listed']]; }
    },
    {
      key: 'benefits', title: 'Benefits', intro: 'What value will the organisation get, and how will you measure it?',
      tips: ['Quantify each benefit: £ saved, revenue gained, hours released, satisfaction scores.', 'Separate cash benefits from non-cash benefits.', 'Each benefit should have an owner after the program closes.'],
      form: function (p) { return area('benefits', 'Benefits, one per line', p.benefits.join('\n'), '£1.2m annual saving in finance effort', ''); },
      checks: function (p) {
        var b = p.benefits, out = [[b.length >= 2, 'At least two benefits']];
        b.forEach(function (x) { var ok = hasNum.test(x); out.push([ok, '"' + esc(short(x, 50)) + '" ' + (ok ? 'is quantified' : 'needs a number')]); });
        return out;
      }
    },
    {
      key: 'costs', title: 'Costs and funding', intro: 'What will it cost and where does the money come from?',
      tips: ['Give a total and the main cost lines (technology, people, other).', 'Include contingency, typically 10 to 20% for change programs.', 'State the payback period or return if you can.'],
      form: function (p) { return area('costs', 'Costs, funding and payback', p.costs, 'Total investment £3.5m over two years: technology £2.1m, people £1.1m, contingency £0.3m...', ''); },
      checks: function (p) { return [[hasMoney.test(p.costs), 'A total cost is stated'], [/contingenc/i.test(p.costs), 'Contingency is included'], [/payback|return|roi|npv/i.test(p.costs), 'Payback or return is stated']]; }
    },
    {
      key: 'timeline', title: 'Timeline and milestones', intro: 'When will the main phases and milestones happen?',
      tips: ['List phases with dates or quarters: mobilise, design, build, test, launch.', 'Mark the dates that matter most to the sponsor.'],
      form: function (p) { return area('timeline', 'Phases and key milestones', p.timeline, 'Discovery Q1 2027, build Q2 to Q3 2027, go live December 2027', ''); },
      checks: function (p) { var m = (p.timeline.match(new RegExp(hasDate.source, 'gi')) || []).length; return [[m >= 1, 'Includes dates'], [m >= 2, 'At least two milestones are dated']]; }
    },
    {
      key: 'risks', title: 'Key risks', intro: 'What could stop the program delivering its objectives?',
      tips: ['Write risks as cause and effect: "If X happens, then Y".', 'Three to six key risks is enough at business case stage.', 'You will manage risks in detail in each project\'s RAID log later.'],
      form: function (p) { return area('risks', 'Risks, one per line', p.risks.join('\n'), 'Key finance staff may leave during the change, delaying testing', ''); },
      checks: function (p) { return [[p.risks.length >= 3, 'At least three key risks'], [p.risks.some(function (r) { return /if |could|may |might|because/i.test(r); }), 'Risks describe what could happen']]; }
    },
    {
      key: 'projects', title: 'Projects', intro: 'Break the program into the projects that will deliver it. Each one gets a line on the dashboard and its own status slide.',
      tips: ['Each project needs one accountable lead and a one-line goal.', 'Aim for 3 to 8 projects; more than that usually means some should be grouped.', 'Projects should together cover everything in scope.'],
      form: function (p) {
        return '<div class="rows" id="projRows">' + p.projects.map(projRow).join('') + '</div>' +
          '<div><button type="button" class="btn btn-outline btn-sm" id="addProj">Add a project</button></div>';
      },
      checks: function (p) {
        var pr = p.projects, out = [[pr.length >= 2, 'At least two projects']];
        if (pr.length) {
          out.push([pr.every(function (x) { return x.lead && x.lead.trim(); }), 'Every project has a lead']);
          out.push([pr.every(function (x) { return x.goal && x.goal.trim(); }), 'Every project has a goal']);
        }
        if (pr.length > 8) out.push([false, 'More than eight projects: consider grouping some']);
        return out;
      }
    },
    { key: 'review', title: 'Review', intro: 'Check the strength of your business case before creating the program dashboard.', tips: [] }
  ];

  function inp(k, label, v, ph) { return '<label class="field" for="f-' + k + '">' + label + '<input class="in" id="f-' + k + '" data-k="' + k + '" value="' + esc(v) + '" placeholder="' + esc(ph) + '"></label>'; }
  function area(k, label, v, ph, hint) { return '<label class="field" for="f-' + k + '">' + label + (hint ? '<span class="hint">' + hint + '</span>' : '') + '<textarea class="in" id="f-' + k + '" data-k="' + k + '" placeholder="' + esc(ph) + '">' + esc(v) + '</textarea></label>'; }
  function projRow(pr, i) {
    var k = pr.id || ('new' + i);
    return '<div class="row-card" data-pid="' + esc(k) + '"><div class="two">' +
      '<label class="field">Project name<input class="in" data-f="name" value="' + esc(pr.name) + '" placeholder="For example: ERP Implementation"></label>' +
      '<label class="field">Project lead<input class="in" data-f="lead" value="' + esc(pr.lead) + '" placeholder="Name"></label></div>' +
      '<label class="field">Goal<input class="in" data-f="goal" value="' + esc(pr.goal) + '" placeholder="What this project delivers, in one sentence"></label>' +
      '<div class="two"><label class="field">Start date<input class="in" type="date" data-f="start" value="' + esc(pr.start) + '"></label>' +
      '<label class="field">End date<input class="in" type="date" data-f="end" value="' + esc(pr.end) + '"></label></div>' +
      '<button type="button" class="btn btn-quiet btn-sm rm" data-rm="1">Remove project</button></div>';
  }

  function readStep(step) {
    var p = state.program;
    $$('[data-k]', view).forEach(function (el) {
      var k = el.getAttribute('data-k');
      p[k] = Array.isArray(p[k]) ? lines(el.value) : el.value;
    });
    if (step.key === 'projects') {
      var old = {}; p.projects.forEach(function (x) { old[x.id] = x; });
      p.projects = $$('#projRows .row-card', view).map(function (row) {
        var id = row.getAttribute('data-pid'), base = old[id] || { id: uid(), status: blankStatus() };
        ['name', 'lead', 'goal', 'start', 'end'].forEach(function (f) { base[f] = $('[data-f=' + f + ']', row).value.trim(); });
        if (!old[id]) row.setAttribute('data-pid', base.id);
        return base;
      }).filter(function (x) { return x.name || x.lead || x.goal; });
    }
    save();
  }

  function checksHtml(list) {
    return '<div class="checks">' + list.map(function (c) {
      return '<div class="check ' + (c[0] ? 'pass' : 'fail') + '"><span class="i" aria-hidden="true">' + (c[0] ? '✓' : '!') + '</span><span><span class="sr-only">' + (c[0] ? 'Done: ' : 'To improve: ') + '</span>' + c[1] + '</span></div>';
    }).join('') + '</div>';
  }

  function allChecks(p) {
    return STEPS.slice(0, -1).map(function (s, i) { return { step: s, i: i, list: s.checks(p) }; });
  }

  function renderCoach(i) {
    if (state.program && state.source === 'sample') {
      view.innerHTML = '<div class="card pad"><h1>You are viewing the sample program</h1><p class="lead">Start your own program with the coach. This replaces the sample on this device; you can reload the sample any time from the Start page.</p>' +
        '<div class="btn-row" style="margin-top:14px"><button class="btn btn-primary" id="newProg">Start my own program</button><a class="btn btn-quiet" href="#/dashboard">Back to the sample dashboard</a></div></div>';
      $('#newProg').onclick = function () { state = { program: blankProgram(), source: 'user' }; save(); render(); };
      return;
    }
    if (!state.program) { state = { program: blankProgram(), source: 'user' }; save(); }
    var p = state.program;
    i = Math.max(0, Math.min(STEPS.length - 1, i || 0));
    var step = STEPS[i];
    var all = allChecks(p);
    var stepper = '<nav class="card stepper" aria-label="Coach steps">' + STEPS.map(function (s, k) {
      var done = k < STEPS.length - 1 && all[k].list.every(function (c) { return c[0]; });
      return '<button type="button" data-go="' + k + '" class="' + (done ? 'done' : '') + '"' + (k === i ? ' aria-current="step"' : '') + '><span class="n">' + (done ? '✓' : k + 1) + '</span>' + s.title + '</button>';
    }).join('') + '</nav>';

    var body;
    if (step.key === 'review') {
      var flat = []; all.forEach(function (a) { flat = flat.concat(a.list); });
      var passed = flat.filter(function (c) { return c[0]; }).length;
      var pct = flat.length ? Math.round(passed / flat.length * 100) : 0;
      body = '<div class="card pad form"><div><h1 style="font-size:24px">Review your business case</h1><p class="lead">' + step.intro + '</p></div>' +
        '<div class="score"><b style="font-size:28px">' + pct + '%</b><span class="bar" aria-hidden="true"><span style="width:' + pct + '%"></span></span><span class="note">' + passed + ' of ' + flat.length + ' checks passed</span></div>' +
        all.map(function (a) {
          return '<div style="border-top:1px solid var(--line-soft);padding-top:12px;display:flex;flex-direction:column;gap:6px"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><h2 style="font-size:16px">' + a.step.title + '</h2><button type="button" class="btn btn-quiet btn-sm" data-go="' + a.i + '">Edit</button></div>' + checksHtml(a.list) + '</div>';
        }).join('') +
        '<div class="btn-row" style="border-top:1px solid var(--line-soft);padding-top:16px"><a class="btn btn-outline" href="#/case">View business case</a><button type="button" class="btn btn-primary" id="mkDash"' + (p.projects.length ? '' : ' disabled') + '>Create program dashboard</button>' +
        (p.projects.length ? '' : '<span class="note">Add at least one project first.</span>') + '</div></div>';
    } else {
      body = '<div class="card pad form" id="stepForm"><div><span class="note">Step ' + (i + 1) + ' of ' + STEPS.length + '</span><h1 style="font-size:24px">' + step.title + '</h1><p class="lead">' + step.intro + '</p></div>' +
        step.form(p) +
        '<div class="coachbox"><span class="k">Coach</span><ul>' + step.tips.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul><span class="k" style="margin-top:4px">Checks</span><div id="liveChecks">' + checksHtml(step.checks(p)) + '</div></div>' +
        '<div class="btn-row">' + (i > 0 ? '<button type="button" class="btn btn-quiet" data-go="' + (i - 1) + '">Back</button>' : '') +
        '<button type="button" class="btn btn-primary" data-go="' + (i + 1) + '">Save and continue</button></div></div>';
    }
    view.innerHTML = flashHtml() + '<div class="coach">' + stepper + '<div>' + body + '</div></div>';

    view.oninput = onCoachInput;
    function onCoachInput() {
      if (!$('#liveChecks')) return;
      readStep(step);
      $('#liveChecks').innerHTML = checksHtml(step.checks(state.program));
    }
    $$('[data-go]', view).forEach(function (b) {
      b.onclick = function () { if (step.key !== 'review') readStep(step); go('#/coach/' + b.getAttribute('data-go')); };
    });
    if ($('#addProj')) $('#addProj').onclick = function () {
      $('#projRows').insertAdjacentHTML('beforeend', projRow({ name: '', lead: '', goal: '', start: '', end: '' }, $$('#projRows .row-card').length));
      $$('#projRows .row-card').slice(-1)[0].querySelector('input').focus();
    };
    if ($('#projRows')) {
      if (!p.projects.length) $('#addProj').click();
      $('#projRows').addEventListener('click', function (e) {
        if (e.target.getAttribute('data-rm')) { e.target.closest('.row-card').remove(); onCoachInput(); }
      });
    }
    if ($('#mkDash')) $('#mkDash').onclick = function () { ensureProjects(state.program); save(); go('#/dashboard'); };
  }

  // ---------- business case document ----------
  function caseSections(p) {
    return [
      ['Background and case for change', p.problem ? '<p>' + esc(p.problem) + '</p>' : ''],
      ['Objectives', p.objectives.length ? '<ul>' + p.objectives.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : ''],
      ['Scope', p.scopeIn || p.scopeOut ? '<p><b>In scope:</b> ' + (esc(p.scopeIn) || '<span class="missing">Not yet defined</span>') + '</p><p style="margin-top:4px"><b>Out of scope:</b> ' + (esc(p.scopeOut) || '<span class="missing">Not yet defined</span>') + '</p>' : ''],
      ['Benefits', p.benefits.length ? '<ul>' + p.benefits.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : ''],
      ['Costs and funding', p.costs ? '<p>' + esc(p.costs) + '</p>' : ''],
      ['Timeline and milestones', p.timeline ? '<p>' + esc(p.timeline) + '</p>' : ''],
      ['Key risks', p.risks.length ? '<ul>' + p.risks.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : ''],
      ['Projects', p.projects.length ? '<table><thead><tr><th>Project</th><th>Lead</th><th>Goal</th><th>Dates</th></tr></thead><tbody>' + p.projects.map(function (x) {
        return '<tr><td><b>' + esc(x.name) + '</b></td><td>' + esc(x.lead) + '</td><td>' + esc(x.goal) + '</td><td>' + (x.start || x.end ? esc(fmt(x.start)) + ' to ' + esc(fmt(x.end)) : '') + '</td></tr>';
      }).join('') + '</tbody></table>' : '']
    ];
  }
  function caseDocHtml(p) {
    return '<h1>' + esc(p.name || 'Untitled program') + '</h1><div class="meta">Business case' + (p.organisation ? ' · ' + esc(p.organisation) : '') + '<br>Sponsor: ' + (esc(p.sponsor) || 'not named') + ' · Program manager: ' + (esc(p.manager) || 'not named') + ' · ' + fmt(today()) + '</div>' +
      caseSections(p).map(function (s) { return '<h3>' + s[0] + '</h3>' + (s[1] || '<p><span class="missing">Not yet written</span></p>'); }).join('');
  }
  function caseMarkdown(p) {
    var md = '# ' + (p.name || 'Untitled program') + '\n\nBusiness case' + (p.organisation ? ', ' + p.organisation : '') + '\n\nSponsor: ' + (p.sponsor || 'not named') + '  \nProgram manager: ' + (p.manager || 'not named') + '\n';
    var list = function (a) { return a.map(function (x) { return '- ' + x; }).join('\n'); };
    md += '\n## Background and case for change\n\n' + (p.problem || '') + '\n\n## Objectives\n\n' + list(p.objectives) + '\n\n## Scope\n\nIn scope: ' + (p.scopeIn || '') + '\n\nOut of scope: ' + (p.scopeOut || '') +
      '\n\n## Benefits\n\n' + list(p.benefits) + '\n\n## Costs and funding\n\n' + (p.costs || '') + '\n\n## Timeline and milestones\n\n' + (p.timeline || '') + '\n\n## Key risks\n\n' + list(p.risks) +
      '\n\n## Projects\n\n| Project | Lead | Goal |\n|---|---|---|\n' + p.projects.map(function (x) { return '| ' + [x.name, x.lead, x.goal].map(function (c) { return String(c || '').replace(/\|/g, '/'); }).join(' | ') + ' |'; }).join('\n') + '\n';
    return md;
  }
  function download(name, type, content) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type: type }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  function slug(s) { return (String(s || 'program').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'program'); }

  function renderCase() {
    var p = state.program;
    if (!p) return needProgram();
    view.innerHTML = '<div class="btn-row no-print" style="justify-content:space-between"><div><h1 style="font-size:24px">Business case</h1>' + (state.source === 'sample' ? '<p class="note">Sample program</p>' : '') + '</div>' +
      '<div class="btn-row"><button class="btn btn-quiet btn-sm" id="dlWord">Download Word</button><button class="btn btn-quiet btn-sm" id="dlMd">Download Markdown</button><button class="btn btn-quiet btn-sm" id="print">Print or save as PDF</button>' +
      (state.source === 'sample' ? '' : '<a class="btn btn-outline btn-sm" href="#/coach/9">Edit in coach</a>') + '<a class="btn btn-primary btn-sm" href="#/dashboard">Program dashboard</a></div></div>' +
      '<article class="card doc" id="doc">' + caseDocHtml(p) + '</article>';
    $('#dlMd').onclick = function () { download(slug(p.name) + '-business-case.md', 'text/markdown', caseMarkdown(p)); };
    $('#dlWord').onclick = function () {
      var html = '<html><head><meta charset="utf-8"><style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt}h1{font-size:20pt;color:#1F4E79}h3{color:#1F4E79;font-size:12pt;margin-top:14pt}table{border-collapse:collapse}td,th{border:1px solid #999;padding:4pt 6pt;vertical-align:top}.missing{color:#8A5A00}</style></head><body>' + caseDocHtml(p) + '</body></html>';
      download(slug(p.name) + '-business-case.doc', 'application/msword', html);
    };
    $('#print').onclick = function () { window.print(); };
  }

  // ---------- dashboard ----------
  function overallRag(p) {
    var r = p.projects.map(function (x) { return x.status && x.status.rag || 'None'; });
    if (r.indexOf('Red') > -1) return 'Red';
    if (r.indexOf('Amber') > -1) return 'Amber';
    if (r.length && r.every(function (x) { return x === 'Green'; })) return 'Green';
    return r.indexOf('Green') > -1 ? 'Amber' : 'None';
  }
  function ragChip(r, big) { var l = r === 'None' || !r ? 'Not reported' : r; return '<span class="rag ' + (r || 'None') + (big ? ' big' : '') + '">' + l + '</span>'; }
  function ago(d) {
    var n = daysFromToday(d);
    if (n === null) return '';
    if (n === 0) return 'today'; if (n === -1) return 'yesterday'; if (n < 0) return (-n) + ' days ago'; return 'in ' + n + ' days';
  }
  var STALE_DAYS = 7;

  function renderDashboard() {
    var p = state.program;
    if (!p) return needProgram();
    ensureProjects(p);
    var ragCount = { Green: 0, Amber: 0, Red: 0, None: 0 };
    var stale = 0, latest = '';
    p.projects.forEach(function (x) {
      var s = x.status; ragCount[s.rag || 'None']++;
      if (s.date && daysFromToday(s.date) < -STALE_DAYS) stale++;
      if (s.date && s.date > latest) latest = s.date;
    });
    var overall = overallRag(p);

    var rows = p.projects.map(function (x) {
      var s = x.status, ptg;
      if (!s.date) ptg = '<span class="note">No status reported yet</span>';
      else if (s.rag === 'Green') ptg = '<b>On track.</b> <small>' + esc(s.summary) + '</small>';
      else ptg = s.pathToGreen ? esc(s.pathToGreen) + '<small>Status: ' + esc(s.summary) + '</small>' : '<span class="stale">Path to green not provided</span><small>' + esc(s.summary) + '</small>';
      var late = s.date && daysFromToday(s.date) < -STALE_DAYS;
      return '<tr><td><a class="pname" href="#/slide/' + x.id + '">' + esc(x.name) + '</a><small style="display:block;color:var(--muted);font-size:12px;margin-top:2px">' + esc(short(x.goal, 90)) + '</small></td>' +
        '<td>' + (esc(x.lead) || '<span class="note">No owner</span>') + '</td><td>' + ragChip(s.rag) + '</td><td class="ptg">' + ptg + '</td>' +
        '<td style="white-space:nowrap">' + (s.date ? fmt(s.date) + '<small style="display:block;color:var(--muted);font-size:12px">' + ago(s.date) + '</small>' + (late ? '<span class="stale">Update overdue</span>' : '') : '<span class="note">None</span>') + '</td>' +
        '<td><div class="btn-row" style="flex-wrap:nowrap"><a class="btn btn-outline btn-sm" href="#/slide/' + x.id + '">Status slide</a><a class="btn btn-quiet btn-sm" href="#/edit/' + x.id + '">Update</a></div></td></tr>';
    }).join('');

    // critical path across projects, next 45 days
    var ms = [];
    p.projects.forEach(function (x) { (x.status.critical || []).forEach(function (c) { var d = daysFromToday(c.date); if (d !== null && d >= -7 && d <= 45) ms.push({ c: c, pr: x }); }); });
    ms.sort(function (a, b) { return a.c.date < b.c.date ? -1 : 1; });
    var raidCount = { Risk: 0, Assumption: 0, Issue: 0, Dependency: 0, Decision: 0 };
    p.projects.forEach(function (x) { (x.status.raid || []).forEach(function (r) { raidCount[r.type] = (raidCount[r.type] || 0) + 1; }); });

    view.innerHTML = '<section class="card pad"><div class="prog-head"><div><span class="note">' + (state.source === 'sample' ? 'Sample program · ' : '') + esc(p.organisation || 'Program dashboard') + '</span><h1>' + esc(p.name || 'Untitled program') + '</h1>' +
      '<div class="kv"><span>Sponsor: <b>' + (esc(p.sponsor) || 'not named') + '</b></span><span>Program manager: <b>' + (esc(p.manager) || 'not named') + '</b></span>' + (latest ? '<span>Latest status report: <b>' + fmt(latest) + '</b></span>' : '') + '</div></div>' +
      '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;margin-left:auto;text-align:right"><span class="note">Overall program status</span>' + ragChip(overall, true) + '<span class="note">Worst project status sets the program status</span></div></div></section>' +
      '<section class="tiles" aria-label="Project status counts">' +
      tile(p.projects.length, 'Projects', '') + tile(ragCount.Green, 'Green', 'var(--g-dot)') + tile(ragCount.Amber, 'Amber', 'var(--a-dot)') + tile(ragCount.Red, 'Red', 'var(--r-dot)') +
      tile(ragCount.None, 'Not reported', 'var(--n-dot)') + tile(stale, 'Reports overdue', '') + '</section>' +
      '<section class="card" aria-labelledby="h-proj"><div class="pad" style="padding-bottom:4px;display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px;align-items:center"><h2 id="h-proj">Projects</h2>' +
      '<div class="btn-row"><a class="btn btn-quiet btn-sm" href="#/case">Business case</a><button class="btn btn-quiet btn-sm" id="export">Export program</button></div></div>' +
      '<div class="tbl-box"><table class="grid"><thead><tr><th scope="col">Project</th><th scope="col">Owner</th><th scope="col">RAG</th><th scope="col">Path to green</th><th scope="col">Last status report</th><th scope="col">Status slide</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="6" class="note">No projects yet. Add them in the coach.</td></tr>') + '</tbody></table></div></section>' +
      '<div class="side">' +
      '<section class="card pad" aria-labelledby="h-cp"><h2 id="h-cp">Critical path: next 45 days</h2><p class="note" style="margin:4px 0 6px">Milestones across all projects.</p>' +
      (ms.length ? '<ul class="list">' + ms.slice(0, 10).map(function (m) {
        return '<li><span class="d">' + fmtShort(m.c.date) + '</span><span>' + esc(m.c.milestone) + ' ' + stateHtml(m.c.state) + '<small>' + esc(m.pr.name) + ' · ' + esc(m.c.owner) + '</small></span></li>';
      }).join('') + '</ul>' : '<p class="note">No milestones in the next 45 days.</p>') + '</section>' +
      '<section class="card pad" aria-labelledby="h-coach"><h2 id="h-coach">PMO coach</h2><p class="note" style="margin:4px 0 10px">What to chase this week.</p>' + coachTips(p) +
      '<h2 style="font-size:15px;margin-top:16px">RAID across the program</h2><div class="raidbar" style="margin-top:8px">' + Object.keys(raidCount).map(function (k) { var pl = { Risk: 'Risks', Assumption: 'Assumptions', Issue: 'Issues', Dependency: 'Dependencies', Decision: 'Decisions' }; return '<span><b>' + raidCount[k] + '</b> ' + (raidCount[k] === 1 ? k : pl[k]) + '</span>'; }).join('') + '</div></section>' +
      '</div>';
    $('#export').onclick = function () { download(slug(p.name) + '-program.json', 'application/json', JSON.stringify({ app: 'pmo-coach', version: 1, program: p }, null, 2)); };
  }
  function tile(v, l, col) { return '<div class="card tile"><span class="v">' + v + '</span><span class="l">' + (col ? '<i class="dot" style="background:' + col + '" aria-hidden="true"></i>' : '') + l + '</span></div>'; }
  function stateHtml(s) {
    if (!s) return '';
    var c = /off/i.test(s) ? 'state-off' : /risk/i.test(s) ? 'state-risk' : /done|complete/i.test(s) ? 'state-ok' : 'state-ok';
    return '<span class="' + c + '" style="font-size:12px">(' + esc(s) + ')</span>';
  }
  function coachTips(p) {
    var tips = [];
    p.projects.forEach(function (x) {
      var s = x.status;
      if (!s.date) tips.push(['!', '<b>' + esc(x.name) + '</b> has no status yet. Ask ' + (esc(x.lead) || 'the lead') + ' for a first report.']);
      else {
        if (daysFromToday(s.date) < -STALE_DAYS) tips.push(['!', '<b>' + esc(x.name) + '</b> last reported ' + ago(s.date) + '. Request an update.']);
        if (s.rag !== 'Green' && !s.pathToGreen) tips.push(['!', '<b>' + esc(x.name) + '</b> is ' + s.rag + ' with no path to green.']);
        else if (s.rag !== 'Green' && !hasDate.test(s.pathToGreen) && !/\b(monday|tuesday|wednesday|thursday|friday|week|sprint|month)\b/i.test(s.pathToGreen)) tips.push(['i', 'The path to green for <b>' + esc(x.name) + '</b> has no date. Ask when it will be back to Green.']);
        if (s.rag === 'Red') tips.push(['i', 'Put <b>' + esc(x.name) + '</b> on the next steering group agenda.']);
        var overdue = (s.critical || []).filter(function (c) { return daysFromToday(c.date) < 0 && !/done|complete/i.test(c.state || ''); });
        if (overdue.length) tips.push(['!', '<b>' + esc(x.name) + '</b> has ' + overdue.length + ' critical path milestone' + (overdue.length > 1 ? 's' : '') + ' past due.']);
        if (!(s.raid || []).length) tips.push(['i', '<b>' + esc(x.name) + '</b> has an empty RAID log. Every project carries some risk.']);
      }
    });
    if (!tips.length) return '<p class="note">Nothing to chase. Every project has a current status and a clear plan.</p>';
    return '<ul class="coachlist">' + tips.slice(0, 7).map(function (t) {
      return '<li><span class="rag ' + (t[0] === '!' ? 'Amber' : 'None') + '" style="padding:0;width:20px;height:20px;justify-content:center" aria-hidden="true"></span><span>' + t[1] + '</span></li>';
    }).join('') + '</ul>';
  }

  // ---------- status slide ----------
  function renderSlide(id) {
    var p = state.program, x = project(id);
    if (!p) return needProgram();
    if (!x) { go('#/dashboard'); return; }
    var s = x.status, idx = p.projects.indexOf(x);
    var prev = p.projects[idx - 1], next = p.projects[idx + 1];
    var CAP = 6;
    function more(n) { return n > CAP ? '<p class="note" style="font-size:.85em">+' + (n - CAP) + ' more on the dashboard</p>' : ''; }
    var statusLine = !s.date ? 'No status reported yet.' :
      esc(s.summary) + (s.rag !== 'Green' && s.pathToGreen ? ' <b>Path to green:</b> ' + esc(s.pathToGreen) : '');

    view.innerHTML = '<div class="btn-row no-print" style="justify-content:space-between">' +
      '<div class="btn-row"><a class="btn btn-quiet btn-sm" href="#/dashboard">Back to dashboard</a>' +
      (prev ? '<a class="btn btn-quiet btn-sm" href="#/slide/' + prev.id + '">Previous project</a>' : '') + (next ? '<a class="btn btn-quiet btn-sm" href="#/slide/' + next.id + '">Next project</a>' : '') + '</div>' +
      '<div class="btn-row"><span class="note">Slide ' + (idx + 1) + ' of ' + p.projects.length + '</span><button class="btn btn-quiet btn-sm" id="print">Print or save as PDF</button><a class="btn btn-primary btn-sm" href="#/edit/' + x.id + '">Update status</a></div></div>' +
      '<div class="slide-wrap"><article class="slide" aria-label="Status slide for ' + esc(x.name) + '">' +
      '<div class="s-head"><div><h2>' + esc(x.name) + '</h2><div class="sub">' + esc(p.name) + ' · Project lead: <b style="color:var(--ink)">' + (esc(x.lead) || 'not named') + '</b></div></div>' +
      '<div class="s-meta">' + ragChip(s.rag) + '<span>Status report: <b style="color:var(--ink)">' + (s.date ? fmt(s.date) : 'not yet reported') + '</b></span></div></div>' +
      '<div class="s-goal"><span class="s-k">Goal</span> ' + (esc(x.goal) || '<span class="missing">Add a goal in the coach</span>') + '</div>' +
      '<div class="s-status ' + (s.rag || 'None') + '"><span class="s-k">Status</span> ' + statusLine + '</div>' +
      '<div class="s-grid"><div class="s-col">' +
      box('Actions this week', s.actionsThisWeek.length ? '<table><thead><tr><th>Action</th><th>Owner</th><th>Due</th></tr></thead><tbody>' + s.actionsThisWeek.slice(0, CAP).map(function (a) {
        return '<tr><td>' + esc(a.text) + '</td><td>' + esc(a.owner) + '</td><td style="white-space:nowrap">' + esc(fmtShort(a.due)) + '</td></tr>';
      }).join('') + '</tbody></table>' + more(s.actionsThisWeek.length) : '') +
      box('Completed last week', s.completedLastWeek.length ? '<ul>' + s.completedLastWeek.slice(0, CAP).map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>' + more(s.completedLastWeek.length) : '') +
      '</div><div class="s-col">' +
      box('RAID', s.raid.length ? '<table><thead><tr><th>Type</th><th>Description</th><th>Owner</th><th>Next step</th></tr></thead><tbody>' + s.raid.slice(0, CAP).map(function (r) {
        return '<tr><td class="s-type">' + esc(r.type) + '</td><td>' + esc(r.description) + '</td><td>' + esc(r.owner) + '</td><td>' + esc(r.nextStep) + (r.due ? ' <span style="color:var(--muted);white-space:nowrap">(' + esc(fmtShort(r.due)) + ')</span>' : '') + '</td></tr>';
      }).join('') + '</tbody></table>' + more(s.raid.length) : '') +
      box('Critical path', s.critical.length ? '<table><thead><tr><th>Milestone</th><th>Date</th><th>Owner</th><th>Status</th></tr></thead><tbody>' + s.critical.slice(0, CAP).map(function (c) {
        return '<tr><td>' + esc(c.milestone) + '</td><td style="white-space:nowrap">' + esc(fmt(c.date)) + '</td><td>' + esc(c.owner) + '</td><td>' + stateHtml(c.state).replace(/[()]/g, '') + '</td></tr>';
      }).join('') + '</tbody></table>' + more(s.critical.length) : '') +
      '</div></div>' +
      '<div class="s-foot"><span>' + esc(p.organisation || '') + '</span><span>Program Creation &amp; PMO Coach</span></div>' +
      '</article></div>';
    $('#print').onclick = function () { window.print(); };
  }
  function box(title, inner) { return '<section class="s-box"><span class="s-k">' + title + '</span>' + (inner || '<span class="note" style="font-size:.95em">None recorded</span>') + '</section>'; }

  // ---------- status editor ----------
  var REPEAT = {
    actions: { title: 'Actions this week', fields: [['text', 'Action', 'text', 2], ['owner', 'Owner', 'text', 1], ['due', 'Due', 'date', 1]] },
    raid: { title: 'RAID log', fields: [['type', 'Type', ['Risk', 'Assumption', 'Issue', 'Dependency', 'Decision'], 1], ['description', 'Description', 'text', 2], ['owner', 'Owner', 'text', 1], ['nextStep', 'Next step', 'text', 2], ['due', 'Due', 'date', 1]] },
    critical: { title: 'Critical path', fields: [['milestone', 'Milestone', 'text', 2], ['date', 'Date', 'date', 1], ['owner', 'Owner', 'text', 1], ['state', 'Status', ['On track', 'At risk', 'Off track', 'Complete'], 1]] }
  };
  function repRow(kind, item) {
    var f = REPEAT[kind].fields;
    return '<div class="row-card" data-row="' + kind + '"><div class="two" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">' + f.map(function (d) {
      var v = item[d[0]] || '', ctl;
      if (Array.isArray(d[2])) ctl = '<select class="in" data-f="' + d[0] + '">' + d[2].map(function (o) { return '<option' + (o === v ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select>';
      else ctl = '<input class="in" type="' + d[2] + '" data-f="' + d[0] + '" value="' + esc(v) + '">';
      return '<label class="field"' + (d[3] > 1 ? ' style="grid-column:span 2"' : '') + '>' + d[1] + ctl + '</label>';
    }).join('') + '</div><button type="button" class="btn btn-quiet btn-sm rm" data-rm="1">Remove</button></div>';
  }
  function repeater(kind, items) {
    return '<section style="display:flex;flex-direction:column;gap:10px"><h2 style="font-size:16px">' + REPEAT[kind].title + '</h2><div class="rows" data-rows="' + kind + '">' + items.map(function (it) { return repRow(kind, it); }).join('') + '</div>' +
      '<div><button type="button" class="btn btn-outline btn-sm" data-add="' + kind + '">Add</button></div></section>';
  }

  function renderEdit(id) {
    var p = state.program, x = project(id);
    if (!p) return needProgram();
    if (!x) { go('#/dashboard'); return; }
    var s = x.status;
    view.innerHTML = '<div class="btn-row no-print"><a class="btn btn-quiet btn-sm" href="#/slide/' + x.id + '">Back to status slide</a></div>' +
      '<form class="card pad form" id="statusForm" novalidate><div><span class="note">' + esc(p.name) + '</span><h1 style="font-size:24px">Update status: ' + esc(x.name) + '</h1><p class="lead">This updates the status slide and the project\'s line on the program dashboard.</p></div>' +
      '<div class="two"><label class="field">Project lead<input class="in" id="e-lead" value="' + esc(x.lead) + '"></label><label class="field">Date of this status report<input class="in" type="date" id="e-date" value="' + esc(s.date || today()) + '"></label>' +
      '<label class="field">RAG status<select class="in" id="e-rag">' + ['Green', 'Amber', 'Red'].map(function (r) { return '<option' + (s.rag === r ? ' selected' : '') + '>' + r + '</option>'; }).join('') + '</select></label></div>' +
      '<label class="field">Project goal<input class="in" id="e-goal" value="' + esc(x.goal) + '"></label>' +
      '<label class="field">Status in one line<span class="hint">What is the headline this week? Keep it to one sentence.</span><input class="in" id="e-summary" maxlength="220" value="' + esc(s.summary) + '"></label>' +
      '<label class="field" id="ptgField">Path to green<span class="hint">Required for Amber and Red: what will be done, by whom and by when to get back to Green.</span><textarea class="in" id="e-ptg" style="min-height:80px">' + esc(s.pathToGreen) + '</textarea></label>' +
      '<div class="coachbox" id="editCoach" aria-live="polite"></div>' +
      repeater('actions', s.actionsThisWeek) +
      '<label class="field">Completed last week<span class="hint">One per line.</span><textarea class="in" id="e-done" style="min-height:90px">' + esc(s.completedLastWeek.join('\n')) + '</textarea></label>' +
      repeater('raid', s.raid) + repeater('critical', s.critical) +
      '<div id="saveMsg" aria-live="polite"></div>' +
      '<div class="btn-row"><button type="submit" class="btn btn-primary">Save status</button><a class="btn btn-quiet" href="#/slide/' + x.id + '">Cancel</a></div></form>';

    function coach() {
      var rag = $('#e-rag').value, ptg = $('#e-ptg').value.trim(), sum = $('#e-summary').value.trim(), list = [];
      list.push([!!sum, 'One-line status written']);
      if (sum.length > 160) list.push([false, 'The status line is long. Aim for one sentence under 160 characters.']);
      if (rag !== 'Green') {
        list.push([!!ptg, 'Path to green provided']);
        if (ptg) list.push([hasDate.test(ptg) || /\b(monday|tuesday|wednesday|thursday|friday|next week|this week|sprint|end of (the )?month)\b/i.test(ptg), 'Path to green says when it will be back to Green']);
      }
      list.push([$$('[data-rows=actions] .row-card').length > 0, 'At least one action for this week']);
      list.push([$$('[data-rows=raid] .row-card').length > 0, 'RAID log has at least one entry']);
      $('#editCoach').innerHTML = '<span class="k">Coach</span>' + checksHtml(list);
      $('#ptgField').style.opacity = rag === 'Green' ? .6 : 1;
    }
    coach();
    var form = $('#statusForm');
    form.addEventListener('input', coach);
    form.addEventListener('click', function (e) {
      var add = e.target.getAttribute('data-add');
      if (add) { $('[data-rows=' + add + ']').insertAdjacentHTML('beforeend', repRow(add, {})); coach(); }
      if (e.target.getAttribute('data-rm')) { e.target.closest('.row-card').remove(); coach(); }
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var rag = $('#e-rag').value, ptg = $('#e-ptg').value.trim();
      if (rag !== 'Green' && !ptg) {
        $('#saveMsg').innerHTML = '<div class="alert warn">A ' + rag + ' project needs a path to green before it can be saved.</div>';
        $('#e-ptg').focus(); return;
      }
      function rowsOf(kind) {
        return $$('[data-rows=' + kind + '] .row-card').map(function (row) {
          var o = {}; $$('[data-f]', row).forEach(function (el) { o[el.getAttribute('data-f')] = el.value.trim(); }); return o;
        }).filter(function (o) { return Object.keys(o).some(function (k) { return o[k] && !(k === 'type' || k === 'state'); }); });
      }
      x.lead = $('#e-lead').value.trim(); x.goal = $('#e-goal').value.trim();
      x.status = {
        date: $('#e-date').value || today(), rag: rag, summary: $('#e-summary').value.trim(), pathToGreen: rag === 'Green' ? '' : ptg,
        actionsThisWeek: rowsOf('actions'), completedLastWeek: lines($('#e-done').value), raid: rowsOf('raid'), critical: rowsOf('critical').sort(function (a, b) { return (a.date || '') < (b.date || '') ? -1 : 1; })
      };
      save(); go('#/slide/' + x.id);
    });
  }

  load();
  render();
})();
