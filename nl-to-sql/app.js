/* Natural Language to SQL: page logic.
 * Loads files into an in-browser SQLite database (sql.js), translates questions
 * with the built-in rule-based translator (nl2sql.js) or, optionally, Claude via
 * the visitor's own API key, then runs the SQL and shows the result. */
(function () {
  'use strict';

  var CLAUDE_MODEL = 'claude-sonnet-5-5';
  var MAX_SHOW = 1000;

  var SQL = null, db = null;
  var schema = []; // [{ name, rowCount, columns: [{ name, type, values }] , sample: [[...]] }]
  var lastResult = null;
  var usingSample = false;

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function qi(n) { return '"' + String(n).replace(/"/g, '""') + '"'; }

  // ---------- database ----------
  var ready = initSqlJs({ locateFile: function (f) { return 'vendor/' + f; } }).then(function (S) {
    SQL = S; db = new SQL.Database();
  }).catch(function (e) {
    status('err', 'The in-browser database could not start: ' + e.message);
  });

  function status(kind, msg) {
    $('loadStatus').innerHTML = msg ? '<div class="alert ' + kind + '">' + esc(msg) + '</div>' : '';
  }

  function safeName(raw, taken) {
    var n = String(raw).toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'table';
    if (/^\d/.test(n)) n = 't_' + n;
    var base = n, i = 2;
    while (taken.indexOf(n) > -1) n = base + '_' + i++;
    return n;
  }

  function toISO(v) {
    if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
    var s = String(v).trim(), m;
    if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ][\d:.]+Z?)?$/))) return m[1] + '-' + m[2] + '-' + m[3];
    if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2); // UK day/month/year
    return null;
  }
  function toNum(v) {
    if (typeof v === 'number') return isFinite(v) ? v : null;
    var s = String(v).trim().replace(/^[£$€]/, '').replace(/,/g, '');
    if (s === '' || !/^-?\d+(\.\d+)?$/.test(s)) return null;
    return Number(s);
  }

  // rows: array of arrays, headers: array of strings
  function addTable(rawName, headers, rows) {
    var taken = schema.map(function (t) { return t.name; });
    var name = safeName(rawName, taken);
    var seen = {};
    headers = headers.map(function (h, i) {
      var n = String(h == null ? '' : h).trim() || 'column_' + (i + 1);
      var b = n, k = 2;
      while (seen[n.toLowerCase()]) n = b + '_' + k++;
      seen[n.toLowerCase()] = 1;
      return n;
    });
    rows = rows.filter(function (r) { return r.some(function (v) { return v !== '' && v != null; }); });

    var cols = headers.map(function (h, i) {
      var vals = rows.map(function (r) { return r[i]; }).filter(function (v) { return v !== '' && v != null; });
      var type = 'text';
      if (vals.length && vals.every(function (v) { return toNum(v) !== null; })) type = 'number';
      else if (vals.length && vals.every(function (v) { return toISO(v) !== null; })) type = 'date';
      return { name: h, type: type };
    });
    var data = rows.map(function (r) {
      return cols.map(function (c, i) {
        var v = r[i];
        if (v === '' || v == null) return null;
        if (c.type === 'number') return toNum(v);
        if (c.type === 'date') return toISO(v);
        return v instanceof Date ? toISO(v) : String(v);
      });
    });
    cols.forEach(function (c, i) {
      if (c.type !== 'text') return;
      var set = {}, out = [];
      for (var r = 0; r < data.length && out.length < 1000; r++) {
        var v = data[r][i];
        if (v != null && !set[v.toLowerCase()]) { set[v.toLowerCase()] = 1; out.push(v); }
      }
      c.values = out;
    });

    db.run('CREATE TABLE ' + qi(name) + ' (' + cols.map(function (c) {
      return qi(c.name) + ' ' + (c.type === 'number' ? 'REAL' : 'TEXT');
    }).join(', ') + ')');
    db.run('BEGIN');
    var st = db.prepare('INSERT INTO ' + qi(name) + ' VALUES (' + cols.map(function () { return '?'; }).join(',') + ')');
    data.forEach(function (r) { st.run(r); });
    st.free();
    db.run('COMMIT');

    schema.push({ name: name, rowCount: data.length, columns: cols, sample: data.slice(0, 3) });
    return name;
  }

  function parseDelimited(text, fileName) {
    var res = Papa.parse(text, { skipEmptyLines: 'greedy' });
    if (!res.data.length) throw new Error(fileName + ' looks empty.');
    return addTable(fileName, res.data[0], res.data.slice(1));
  }

  function loadXlsx() {
    if (window.XLSX) return Promise.resolve();
    return new Promise(function (ok, fail) {
      var s = document.createElement('script');
      s.src = 'vendor/xlsx.full.min.js';
      s.onload = ok; s.onerror = function () { fail(new Error('The Excel reader could not load.')); };
      document.head.appendChild(s);
    });
  }

  function readFile(file) {
    var ext = (file.name.split('.').pop() || '').toLowerCase();
    if (['csv', 'tsv', 'txt'].indexOf(ext) > -1) {
      return file.text().then(function (t) { return [parseDelimited(t, file.name)]; });
    }
    if (ext === 'json') {
      return file.text().then(function (t) {
        var j = JSON.parse(t), made = [];
        var sets = Array.isArray(j) ? [[file.name, j]] : Object.keys(j).filter(function (k) { return Array.isArray(j[k]); }).map(function (k) { return [k, j[k]]; });
        if (!sets.length) throw new Error(file.name + ' needs to be a list of records, or an object holding lists of records.');
        sets.forEach(function (s) {
          var recs = s[1].filter(function (r) { return r && typeof r === 'object'; });
          var keys = [];
          recs.forEach(function (r) { Object.keys(r).forEach(function (k) { if (keys.indexOf(k) === -1) keys.push(k); }); });
          made.push(addTable(s[0], keys, recs.map(function (r) {
            return keys.map(function (k) { var v = r[k]; return v != null && typeof v === 'object' ? JSON.stringify(v) : v; });
          })));
        });
        return made;
      });
    }
    if (['xlsx', 'xls'].indexOf(ext) > -1) {
      return Promise.all([loadXlsx(), file.arrayBuffer()]).then(function (r) {
        var wb = XLSX.read(r[1], { type: 'array', cellDates: true });
        var made = [];
        wb.SheetNames.forEach(function (sn) {
          var rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '', raw: true, blankrows: false });
          if (rows.length < 2) return;
          var tname = wb.SheetNames.length > 1 ? file.name.replace(/\.[^.]+$/, '') + '_' + sn : file.name;
          made.push(addTable(tname, rows[0], rows.slice(1)));
        });
        if (!made.length) throw new Error(file.name + ' has no sheets with a header row and data.');
        return made;
      });
    }
    if (['db', 'sqlite', 'sqlite3'].indexOf(ext) > -1) {
      return file.arrayBuffer().then(function (buf) {
        var src = new SQL.Database(new Uint8Array(buf)), made = [];
        var tabs = src.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
        (tabs[0] ? tabs[0].values : []).forEach(function (t) {
          var res = src.exec('SELECT * FROM ' + qi(t[0]));
          if (res[0]) made.push(addTable(t[0], res[0].columns, res[0].values));
        });
        src.close();
        if (!made.length) throw new Error(file.name + ' has no tables.');
        return made;
      });
    }
    return Promise.reject(new Error(file.name + ': this file type is not supported. Use CSV, TSV, Excel, JSON or SQLite.'));
  }

  function handleFiles(list) {
    var files = Array.prototype.slice.call(list || []);
    if (!files.length) return;
    if (usingSample) { resetAll(); }
    status('', '');
    ready.then(function () {
      var made = [], errors = [];
      return files.reduce(function (p, f) {
        return p.then(function () {
          return readFile(f).then(function (n) { made = made.concat(n); }).catch(function (e) { errors.push(e.message); });
        });
      }, Promise.resolve()).then(function () {
        renderTables();
        if (errors.length) status('err', errors.join(' '));
        else status('', '');
      });
    });
  }

  function resetAll() {
    if (db) { db.close(); db = new SQL.Database(); }
    schema = []; usingSample = false;
  }

  function removeTable(name) {
    db.run('DROP TABLE IF EXISTS ' + qi(name));
    schema = schema.filter(function (t) { return t.name !== name; });
    if (!schema.length) usingSample = false;
    renderTables();
  }

  // ---------- rendering: tables and examples ----------
  function renderTables() {
    var box = $('tables');
    if (!schema.length) {
      box.innerHTML = '<p class="empty">No tables loaded yet.</p>';
      $('askBtn').disabled = true;
      renderExamples();
      return;
    }
    box.innerHTML = schema.map(function (t, i) {
      return '<div class="tcard">' +
        '<div class="tcard-top"><strong>' + esc(t.name) + '</strong><span class="meta">' + t.rowCount.toLocaleString('en-GB') + ' rows, ' + t.columns.length + ' columns</span>' +
        '<span class="actions"><button type="button" class="icon-btn" data-preview="' + i + '" aria-expanded="false">Preview</button>' +
        '<button type="button" class="icon-btn" data-remove="' + i + '" aria-label="Remove ' + esc(t.name) + '">Remove</button></span></div>' +
        '<div class="cols">' + t.columns.map(function (c) {
          return '<span class="col-chip">' + esc(c.name) + '<b>' + { number: '123', date: 'date', text: 'abc' }[c.type] + '</b></span>';
        }).join('') + '</div>' +
        '<div class="preview" id="pv' + i + '" hidden></div>' +
        '</div>';
    }).join('');
    $('askBtn').disabled = false;
    renderExamples();
  }

  function renderExamples() {
    var ex = [];
    if (usingSample) {
      ex = ['Total contract value by owner', 'Which client has the most open roles?', 'Show clients in London',
        'Top 3 clients by contract value', 'How many sessions by session type?', 'Which sessions have not had a summary sent?',
        'Average duration by session type', 'How many sessions were in October?'];
    } else if (schema.length) {
      var t = schema[0];
      var num = t.columns.filter(function (c) { return c.type === 'number'; });
      var txt = t.columns.filter(function (c) { return c.type === 'text' && c.values && c.values.length > 1 && c.values.length < t.rowCount; });
      var w = function (c) { return c.name.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/ (gbp|usd|eur|mins|pct)$/, ''); };
      ex.push('How many rows are in ' + t.name.replace(/_/g, ' ') + '?');
      if (txt[0]) ex.push('How many ' + t.name.replace(/_/g, ' ') + ' by ' + w(txt[0]) + '?');
      if (num[0] && txt[0]) ex.push('Total ' + w(num[0]) + ' by ' + w(txt[0]));
      if (num[0]) ex.push('Top 5 by ' + w(num[0]));
      if (num[1] && txt[0]) ex.push('Average ' + w(num[1]) + ' per ' + w(txt[0]));
      if (txt[0] && txt[0].values[0]) ex.push('Show rows where ' + w(txt[0]) + ' is ' + txt[0].values[0]);
      if (txt[1]) ex.push('List the unique ' + w(txt[1]) + ' values');
    }
    $('examples').innerHTML = ex.length ? ex.map(function (e) {
      return '<button type="button" class="ex">' + esc(e) + '</button>';
    }).join('') : '<p class="empty">Examples appear once a table is loaded.</p>';
  }

  function previewHtml(t) {
    var res = db.exec('SELECT * FROM ' + qi(t.name) + ' LIMIT 5');
    return res[0] ? tableHtml(res[0].columns, res[0].values) : '<p class="empty" style="padding:10px">No rows.</p>';
  }

  function tableHtml(cols, rows) {
    var numeric = cols.map(function (_, i) {
      return rows.length > 0 && rows.every(function (r) { return r[i] == null || typeof r[i] === 'number'; });
    });
    return '<table><thead><tr>' + cols.map(function (c, i) { return '<th scope="col"' + (numeric[i] ? ' class="num"' : '') + '>' + esc(c) + '</th>'; }).join('') +
      '</tr></thead><tbody>' + rows.map(function (r) {
        return '<tr>' + r.map(function (v, i) {
          return '<td' + (numeric[i] ? ' class="num"' : '') + '>' + (v == null ? '<span style="color:#8A9592">null</span>' : esc(fmt(v))) + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table>';
  }
  function fmt(v) {
    if (typeof v !== 'number') return v;
    return Number.isInteger(v) ? v.toLocaleString('en-GB') : v.toLocaleString('en-GB', { maximumFractionDigits: 2 });
  }

  // ---------- translate ----------
  function engine() { return document.querySelector('input[name=engine]:checked').value; }

  function ask() {
    var question = $('question').value.trim();
    if (!question) { $('question').focus(); return; }
    if (!schema.length) { status('warn', 'Upload a file or load the sample data first.'); return; }
    var btn = $('askBtn');
    if (engine() === 'claude') {
      var key = $('apikey').value.trim();
      if (!key) { showInterpError('Add your Anthropic API key to use Claude, or switch to the built-in translator.'); $('apikey').focus(); return; }
      btn.disabled = true; btn.innerHTML = '<span class="spinner" aria-hidden="true"></span> Asking Claude';
      $('engineUsed').textContent = 'Translated by Claude';
      translateWithClaude(question, key).then(function (r) {
        showInterpretation(r); runSql(r.sql);
      }).catch(function (e) {
        showInterpError(e.message); clearResult();
      }).then(function () { btn.disabled = false; btn.textContent = 'Translate and run'; });
      return;
    }
    $('engineUsed').textContent = 'Translated by the built-in translator';
    var r = NL2SQL.translate(question, schema);
    if (!r.ok) { showInterpError(r.message); clearResult(); return; }
    showInterpretation(r);
    runSql(r.sql);
  }

  function showInterpretation(r) {
    $('interp').innerHTML =
      '<div style="display:flex;flex-direction:column;gap:6px"><span class="sql-label" style="font-weight:500">In plain English</span>' +
      '<p class="reading">' + esc(r.interpretation) + '</p></div>' +
      (r.steps && r.steps.length ? '<ul class="steps">' + r.steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' : '') +
      '<div class="sql-wrap"><div class="sql-label"><label for="sqlBox">SQL query that will run</label>' +
      '<span class="btn-row"><button type="button" class="btn btn-quiet" id="copySql">Copy SQL</button>' +
      '<button type="button" class="btn btn-outline" id="runSql">Run edited SQL</button></span></div>' +
      '<textarea class="sql" id="sqlBox" spellcheck="false">' + esc(r.sql) + '</textarea></div>';
  }
  function showInterpError(msg) {
    $('interp').innerHTML = '<div class="alert warn">' + esc(msg) + '</div>';
  }
  function clearResult() { $('result').innerHTML = '<p class="placeholder">Results from the query will appear here.</p>'; lastResult = null; }

  // ---------- run ----------
  function readOnly(sql) {
    var s = sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').trim().replace(/;\s*$/, '');
    if (/;/.test(s.replace(/'(?:[^']|'')*'/g, '').replace(/"(?:[^"]|"")*"/g, ''))) return 'Run one query at a time.';
    if (!/^(select|with)\b/i.test(s)) return 'Only read-only SELECT queries can run here.';
    if (/\b(insert|update|delete|drop|alter|create|attach|detach|pragma|replace|vacuum)\b/i.test(s.replace(/'(?:[^']|'')*'/g, '').replace(/"(?:[^"]|"")*"/g, ''))) return 'Only read-only SELECT queries can run here.';
    return null;
  }

  function runSql(sql) {
    var problem = readOnly(sql);
    if (problem) { $('result').innerHTML = '<div class="alert err">' + esc(problem) + '</div>'; return; }
    var t0 = performance.now(), res;
    try { res = db.exec(sql); }
    catch (e) {
      $('result').innerHTML = '<div class="alert err">The database could not run this query: ' + esc(e.message) + '</div>';
      lastResult = null; return;
    }
    var ms = performance.now() - t0;
    var out = res[0] || { columns: [], values: [] };
    lastResult = out;
    var n = out.values.length;
    var html = '<div class="result-meta"><span>' + n.toLocaleString('en-GB') + (n === 1 ? ' row' : ' rows') + ' returned in ' + (ms < 1 ? '<1' : Math.round(ms)) + ' ms</span>' +
      (n ? '<button type="button" class="btn btn-quiet" id="dlCsv">Download CSV</button>' : '') + '</div>';
    if (!n) html += '<p class="placeholder">No rows matched. Try loosening the filters in your question.</p>';
    else if (n === 1 && out.columns.length === 1) {
      html += '<div><div class="big-answer">' + esc(fmt(out.values[0][0])) + '</div><div class="big-label">' + esc(out.columns[0].replace(/_/g, ' ')) + '</div></div>';
    } else {
      html += '<div class="table-box">' + tableHtml(out.columns, out.values.slice(0, MAX_SHOW)) + '</div>';
      if (n > MAX_SHOW) html += '<p class="note">Showing the first ' + MAX_SHOW.toLocaleString('en-GB') + ' rows. Download the CSV for all of them.</p>';
    }
    $('result').innerHTML = html;
  }

  function downloadCsv() {
    if (!lastResult) return;
    var line = function (r) { return r.map(function (v) { var s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(','); };
    var csv = [line(lastResult.columns)].concat(lastResult.values.map(line)).join('\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'query-result.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  // ---------- Claude ----------
  function translateWithClaude(question, key) {
    var desc = schema.map(function (t) {
      return 'Table "' + t.name + '" (' + t.rowCount + ' rows)\n' + t.columns.map(function (c) {
        return '  - "' + c.name + '" ' + c.type.toUpperCase() + (c.type === 'text' && c.values && c.values.length <= 12 ? ' values: ' + c.values.slice(0, 12).join(' | ') : '');
      }).join('\n') + '\n  sample rows: ' + JSON.stringify(t.sample);
    }).join('\n\n');
    var system = 'You translate plain English questions into a single SQLite query over the tables below. ' +
      'Reply with JSON only, no code fences, in exactly this shape: {"interpretation": "...", "steps": ["..."], "sql": "..."}. ' +
      '"interpretation" is one or two plain sentences, in British English, saying what the query will return, written for a non-technical reader. ' +
      '"steps" lists any assumptions you made (which table or column you chose, how you read an ambiguous word); it may be empty. ' +
      'Rules for "sql": one read-only SELECT (or WITH ... SELECT) statement, SQLite dialect, identifiers in double quotes, ' +
      'case-insensitive text comparisons using LOWER(), dates are stored as ISO text YYYY-MM-DD, add LIMIT 100 to queries that list rows, ' +
      'format it on several lines for readability. Do not use em dashes. If the question cannot be answered from these tables, ' +
      'return an empty "sql" and explain why in "interpretation".\n\nTables:\n' + desc;
    return fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 1024, system: system, messages: [{ role: 'user', content: question }] })
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) throw new Error('Claude returned an error: ' + ((j.error && j.error.message) || r.status));
        var text = (j.content || []).filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('');
        var m = text.replace(/^```(?:json)?\s*|\s*```$/g, '').match(/\{[\s\S]*\}/);
        if (!m) throw new Error('Claude did not return a query this time. Try rephrasing the question.');
        var out = JSON.parse(m[0]);
        if (!out.sql) throw new Error(out.interpretation || 'Claude could not turn this into a query.');
        return { interpretation: out.interpretation || '', steps: out.steps || [], sql: out.sql.trim() };
      });
    }, function () {
      throw new Error('Could not reach the Anthropic API. Check your connection and API key.');
    });
  }

  // ---------- sample ----------
  function loadSample() {
    status('', '');
    ready.then(function () {
      resetAll();
      return Promise.all(['clients', 'sessions'].map(function (n) {
        return fetch('sample/' + n + '.csv').then(function (r) { if (!r.ok) throw new Error('Sample data could not load.'); return r.text(); })
          .then(function (t) { return [n, t]; });
      }));
    }).then(function (files) {
      files.forEach(function (f) { parseDelimited(f[1], f[0]); });
      usingSample = true;
      renderTables();
      $('question').focus();
    }).catch(function (e) { status('err', e.message); });
  }

  // ---------- events ----------
  var drop = $('drop');
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { handleFiles(e.dataTransfer.files); });
  $('file').addEventListener('change', function (e) { handleFiles(e.target.files); e.target.value = ''; });
  $('sample').addEventListener('click', loadSample);

  $('tables').addEventListener('click', function (e) {
    var p = e.target.closest('[data-preview]'), r = e.target.closest('[data-remove]');
    if (p) {
      var i = Number(p.getAttribute('data-preview')), box = $('pv' + i), open = box.hidden;
      if (open) box.innerHTML = previewHtml(schema[i]);
      box.hidden = !open; p.setAttribute('aria-expanded', String(open)); p.textContent = open ? 'Hide' : 'Preview';
    } else if (r) removeTable(schema[Number(r.getAttribute('data-remove'))].name);
  });

  $('examples').addEventListener('click', function (e) {
    var b = e.target.closest('.ex');
    if (!b) return;
    $('question').value = b.textContent;
    ask();
  });
  $('askBtn').addEventListener('click', ask);
  $('clearBtn').addEventListener('click', function () {
    $('question').value = ''; $('engineUsed').textContent = '';
    $('interp').innerHTML = '<p class="placeholder">Ask a question and the interpretation and SQL query will appear here.</p>';
    clearResult(); $('question').focus();
  });
  $('question').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); ask(); }
  });
  $('interp').addEventListener('click', function (e) {
    if (e.target.id === 'runSql') { $('engineUsed').textContent = 'Edited by you'; runSql($('sqlBox').value); }
    if (e.target.id === 'copySql' && navigator.clipboard) {
      navigator.clipboard.writeText($('sqlBox').value).then(function () {
        e.target.textContent = 'Copied'; setTimeout(function () { e.target.textContent = 'Copy SQL'; }, 1500);
      });
    }
  });
  $('result').addEventListener('click', function (e) { if (e.target.id === 'dlCsv') downloadCsv(); });

  document.querySelectorAll('input[name=engine]').forEach(function (r) {
    r.addEventListener('change', function () { $('keybox').classList.toggle('show', engine() === 'claude'); });
  });
  try { var saved = sessionStorage.getItem('nl2sql_key'); if (saved) $('apikey').value = saved; } catch (e) { /* storage unavailable */ }
  $('apikey').addEventListener('input', function () {
    try { sessionStorage.setItem('nl2sql_key', $('apikey').value.trim()); } catch (e) { /* storage unavailable */ }
  });
})();
