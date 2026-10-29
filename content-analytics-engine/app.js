/* Content Creation Analytics Engine: page logic. */
(function () {
  'use strict';

  var API = 'https://www.googleapis.com/youtube/v3/';
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function num(n) { return Number(n || 0).toLocaleString('en-GB'); }
  function short(n) {
    n = Number(n || 0);
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'm';
    if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + 'k';
    return String(n);
  }
  function trim(s, n) { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 3).replace(/\s+\S*$/, '') + '...' : s; }
  function ago(iso) {
    var h = Math.max(0, (Date.now() - new Date(iso).getTime()) / 36e5);
    if (h < 1) return 'under an hour ago';
    if (h < 48) return Math.round(h) + (Math.round(h) === 1 ? ' hour ago' : ' hours ago');
    return Math.round(h / 24) + ' days ago';
  }

  // ---------- topic to search terms ----------
  var FILLER = /\b(what|which|are|is|the|most|highly|engaged|engaging|engagement|topics?|themes?|trending|popular|viral|hot|today|todays|today's|right now|this week|currently|latest|videos?|youtube|content|about|on|in|for|of|top|best)\b/gi;
  var REGION_WORDS = { GB: /\b(uk|united kingdom|britain|british|england)\b/i, US: /\b(us|usa|united states|america|american)\b/i, IE: /\bireland|irish\b/i, AE: /\b(uae|dubai|emirates)\b/i, AU: /\baustralia\b/i, CA: /\bcanada\b/i, IN: /\bindia\b/i };
  function deriveTerms(topic) {
    var t = topic.replace(FILLER, ' ').replace(/[^\w\s'&-]/g, ' ').replace(/\s+/g, ' ').trim();
    Object.keys(REGION_WORDS).forEach(function (r) { if (r !== 'GB') return; t = t.replace(REGION_WORDS[r], 'UK'); });
    return t || topic.trim();
  }
  function regionFromTopic(topic) {
    for (var r in REGION_WORDS) if (REGION_WORDS[r].test(topic)) return r;
    return null;
  }
  var termsEdited = false;
  $('topic').addEventListener('input', function () {
    if (!termsEdited) $('terms').value = deriveTerms($('topic').value);
    var r = regionFromTopic($('topic').value);
    if (r) $('region').value = r;
  });
  $('terms').addEventListener('input', function () { termsEdited = !!$('terms').value.trim(); });
  document.querySelectorAll('.ex').forEach(function (b) {
    b.addEventListener('click', function () { termsEdited = false; $('topic').value = b.textContent; $('topic').dispatchEvent(new Event('input')); $('topic').focus(); });
  });

  // ---------- key ----------
  function key() { return $('apikey').value.trim(); }
  function syncKey() {
    var k = key();
    $('keyStatus').textContent = k ? 'Added: live YouTube data' : 'Not added: you will see the demo';
    $('modeNote').textContent = k ? 'Uses about 110 of your 10,000 free daily YouTube quota units.' : 'No key added, so this runs the demo with sample results.';
    try { if (k) sessionStorage.setItem('ccae_key', k); else sessionStorage.removeItem('ccae_key'); } catch (e) { /* storage unavailable */ }
  }
  try { var saved = sessionStorage.getItem('ccae_key'); if (saved) { $('apikey').value = saved; } } catch (e) { /* storage unavailable */ }
  $('apikey').addEventListener('input', syncKey);
  syncKey();

  // ---------- progress ----------
  var STEPS = [
    ['search', 'Searching YouTube', 'Videos on your topic in the time window'],
    ['rank', 'Ranking by engagement', 'Likes plus comments, top 10 kept'],
    ['read', 'Reading the videos', 'Titles, descriptions and comments'],
    ['themes', 'Finding the themes', 'Five suggested topics']
  ];
  function progress(active, failed, detail) {
    $('progress').innerHTML = STEPS.map(function (s, i) {
      var cls = i < active ? 'done' : i === active ? (failed ? 'fail' : 'active') : '';
      var sub = i === active && detail ? detail : s[2];
      return '<div class="pstep ' + cls + '"><span class="dot" aria-hidden="true"></span><span>' + s[1] + '<small>' + esc(sub) + '</small></span></div>';
    }).join('');
  }
  function alertMsg(kind, msg) { $('alert').innerHTML = msg ? '<div class="alert ' + kind + '">' + msg + '</div>' : ''; }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // ---------- YouTube ----------
  function yt(path, params) {
    params.key = key();
    var qs = Object.keys(params).filter(function (k) { return params[k] !== '' && params[k] != null; })
      .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&');
    return fetch(API + path + '?' + qs).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) {
          var reason = (j.error && j.error.errors && j.error.errors[0] && j.error.errors[0].reason) || '';
          var e = new Error((j.error && j.error.message) || ('YouTube returned ' + r.status));
          e.reason = reason; e.status = r.status; throw e;
        }
        return j;
      });
    }, function () { var e = new Error('Could not reach YouTube. Check your connection.'); e.reason = 'network'; throw e; });
  }
  function friendly(e) {
    var r = e.reason || '';
    if (/keyInvalid|badRequest/.test(r) || /API key not valid/i.test(e.message)) return 'YouTube did not accept the API key. Check it was copied in full.';
    if (/quotaExceeded|dailyLimitExceeded/.test(r)) return 'This API key has used its YouTube quota for today. It resets at midnight Pacific time.';
    if (/accessNotConfigured|SERVICE_DISABLED/.test(r) || /has not been used|is disabled/i.test(e.message)) return 'The YouTube Data API v3 is not enabled for this key\'s project. Enable it in the Google Cloud console and try again.';
    if (/forbidden|ipRefererBlocked|referer/i.test(r + e.message)) return 'This key is restricted and does not allow requests from this site.';
    return esc(e.message);
  }

  function liveRun(terms, region, hours) {
    var after = new Date(Date.now() - hours * 36e5).toISOString();
    progress(0);
    return yt('search', {
      part: 'snippet', type: 'video', q: terms, order: 'viewCount', publishedAfter: after,
      regionCode: region, relevanceLanguage: region === 'GB' || region === 'US' || region === 'IE' || region === 'AU' || region === 'CA' ? 'en' : '', maxResults: 50, safeSearch: 'moderate'
    }).then(function (s) {
      var ids = (s.items || []).map(function (i) { return i.id && i.id.videoId; }).filter(Boolean);
      if (!ids.length) { var e = new Error('none'); e.reason = 'noResults'; throw e; }
      progress(1, false, 'Checking likes and comments on ' + ids.length + ' videos');
      return yt('videos', { part: 'snippet,statistics', id: ids.join(','), maxResults: 50 });
    }).then(function (v) {
      var vids = (v.items || []).filter(function (x) { return x.snippet && x.snippet.liveBroadcastContent === 'none'; }).map(function (x) {
        var st = x.statistics || {};
        var th = x.snippet.thumbnails || {};
        return {
          id: x.id, title: x.snippet.title, channel: x.snippet.channelTitle, published: x.snippet.publishedAt,
          description: x.snippet.description || '', tags: x.snippet.tags || [],
          views: Number(st.viewCount || 0), likes: Number(st.likeCount || 0), commentCount: Number(st.commentCount || 0),
          likesHidden: st.likeCount == null, commentsOff: st.commentCount == null,
          thumb: (th.medium || th.default || {}).url || '', url: 'https://www.youtube.com/watch?v=' + x.id, comments: []
        };
      });
      vids.forEach(function (x) { x.engagement = x.likes + x.commentCount; });
      vids.sort(function (a, b) { return b.engagement - a.engagement; });
      var top = vids.slice(0, 10);
      progress(2, false, 'Reading comments on ' + top.length + ' videos');
      var done = 0;
      return Promise.all(top.map(function (x) {
        if (x.commentsOff || !x.commentCount) return Promise.resolve();
        return yt('commentThreads', { part: 'snippet', videoId: x.id, maxResults: 100, order: 'relevance', textFormat: 'plainText' }).then(function (c) {
          x.comments = (c.items || []).map(function (i) {
            var s = i.snippet.topLevelComment.snippet;
            return { text: s.textDisplay || s.textOriginal || '', likes: Number(s.likeCount || 0) };
          });
        }).catch(function () { /* comments disabled or restricted: carry on with the rest */ }).then(function () {
          done++; progress(2, false, 'Read comments on ' + done + ' of ' + top.length + ' videos');
        });
      })).then(function () { return { videos: top, searched: vids.length }; });
    });
  }

  function demoRun() {
    var vids = window.DEMO_VIDEOS.map(function (d) {
      return {
        id: d.id, title: d.title, channel: d.channel, published: new Date(Date.now() - d.hoursAgo * 36e5).toISOString(),
        description: d.description, tags: d.tags, views: d.views, likes: d.likes, commentCount: d.commentCount, thumb: '', url: '',
        engagement: d.likes + d.commentCount, comments: d.comments.map(function (c) { return { text: c[0], likes: c[1] }; })
      };
    }).sort(function (a, b) { return b.engagement - a.engagement; });
    progress(0); return wait(550).then(function () {
      progress(1, false, 'Checking likes and comments on 50 videos'); return wait(550);
    }).then(function () {
      progress(2, false, 'Reading comments on 10 videos'); return wait(650);
    }).then(function () { return { videos: vids, searched: 50 }; });
  }

  // ---------- run ----------
  var busy = false;
  $('form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (busy) return;
    var live = !!key();
    var topic = $('topic').value.trim();
    if (!topic && live) { $('topic').focus(); $('topic').setAttribute('aria-invalid', 'true'); return; }
    if (!topic) { topic = window.DEMO_TOPIC; $('topic').value = topic; $('terms').value = deriveTerms(topic); }
    $('topic').removeAttribute('aria-invalid');
    var terms = $('terms').value.trim() || deriveTerms(topic);
    var region = $('region').value, hours = Number($('window').value);

    busy = true; $('runBtn').disabled = true; $('runBtn').textContent = 'Analysing...';
    $('progressWrap').hidden = false; $('results').hidden = true; alertMsg('', '');
    if (!live && topic !== window.DEMO_TOPIC) {
      alertMsg('info', 'No API key added, so this shows the demo for "' + esc(window.DEMO_TOPIC) + '". Add a free YouTube API key above to analyse your own topic with live data.');
    }

    var run = live ? liveRun(terms, region, hours) : demoRun();
    run.then(function (r) {
      progress(3);
      return wait(live ? 50 : 450).then(function () {
        var themes = ThemeFinder.findThemes(r.videos, topic + ' ' + terms, 5);
        progress(4);
        render(r, themes, { live: live, terms: live ? terms : deriveTerms(window.DEMO_TOPIC), region: live ? region : 'GB', hours: live ? hours : 24 });
        if (live && r.videos.length < 10) alertMsg('info', 'Only ' + r.videos.length + ' videos matched in this window. Widen the time window or broaden the search terms for stronger themes.');
        else if (live || topic === window.DEMO_TOPIC) alertMsg('', '');
      });
    }).catch(function (err) {
      var at = err.reason === 'noResults' ? 0 : $('progress').querySelectorAll('.done').length;
      progress(at, true);
      alertMsg('err', err.reason === 'noResults' ?
        'No videos found for "' + esc(terms) + '" in this window. Try broader search terms or a longer time window.' : friendly(err));
    }).then(function () {
      busy = false; $('runBtn').disabled = false; $('runBtn').textContent = "Find today's themes";
    });
  });

  // ---------- render ----------
  var REGION_NAME = { GB: 'the UK', US: 'the US', IE: 'Ireland', AE: 'the UAE', AU: 'Australia', CA: 'Canada', IN: 'India', '': 'all regions' };
  var WINDOW_NAME = { 24: 'the last 24 hours', 48: 'the last 48 hours', 168: 'the last 7 days' };
  var TITLES = [
    function (l) { return l + ': what it means for you this week'; },
    function (l) { return 'Your ' + l.toLowerCase() + ' questions, answered'; },
    function (l) { return l + ' explained in 5 minutes'; },
    function (l) { return 'Everyone is talking about ' + l.toLowerCase() + '. Here is what to do'; },
    function (l) { return 'The truth about ' + l.toLowerCase() + ' right now'; }
  ];

  function render(r, themes, o) {
    var vids = r.videos;
    $('modeBadge').textContent = o.live ? 'Live YouTube data' : 'Demo data';
    $('summaryText').textContent = 'From the ' + vids.length + ' most engaged videos for "' + o.terms + '" published in ' + WINDOW_NAME[o.hours] + ' in ' + REGION_NAME[o.region] +
      ' (out of ' + r.searched + ' found), drawing on ' + num(vids.reduce(function (s, v) { return s + v.comments.length; }, 0)) + ' comments.';

    if (!themes.length) {
      $('themes').innerHTML = '<div class="card theme"><p class="note">Not enough shared discussion across these videos to find themes. Try a broader topic or a longer time window.</p></div>';
    } else {
      $('themes').innerHTML = themes.map(function (t, i) {
        var meter = '';
        for (var k = 0; k < vids.length; k++) meter += '<i class="' + (k < t.videoCount ? 'on' : '') + '"></i>';
        var angle = t.question ? 'Answer the question viewers keep asking: "' + esc(trim(t.question.text, 150)) + '"'
          : 'Explain what is changing with ' + esc(t.label.toLowerCase()) + ' and what your viewers should do about it now.';
        return '<article class="card theme">' +
          '<div class="theme-top"><span class="rank" aria-label="Rank ' + (i + 1) + '">' + (i + 1) + '</span><div><h3>' + esc(t.label) + '</h3>' +
          '<div class="why">In ' + t.videoCount + ' of the top ' + vids.length + ' videos, ' + t.commentMentions + ' viewer comments, ' + short(t.engagement) + ' likes and comments on those videos</div></div></div>' +
          '<div class="meter" role="img" aria-label="Appears in ' + t.videoCount + ' of ' + vids.length + ' videos">' + meter + '</div>' +
          (t.terms.length ? '<div class="chips">' + t.terms.map(function (x) { return '<span class="chip">' + esc(x) + '</span>'; }).join('') + '</div>' : '') +
          '<div class="idea"><span class="k">Suggested angle</span><p>' + angle + '</p></div>' +
          '<div class="idea"><span class="k">Starter title</span><p>' + esc(TITLES[i % TITLES.length](t.label)) + '</p></div>' +
          (t.topComment && t.topComment !== t.question ? '<blockquote>"' + esc(trim(t.topComment.text, 160)) + '"<span>Top viewer comment on this theme, ' + num(t.topComment.likes) + ' likes</span></blockquote>' : '') +
          '</article>';
      }).join('');
    }

    var max = Math.max.apply(null, vids.map(function (v) { return v.engagement; }).concat([1]));
    $('videos').innerHTML = '<thead><tr><th scope="col">#</th><th scope="col">Video</th><th scope="col">Published</th><th scope="col" class="num">Views</th><th scope="col" class="num">Likes</th><th scope="col" class="num">Comments</th><th scope="col">Engagement (likes + comments)</th></tr></thead><tbody>' +
      vids.map(function (v, i) {
        var thumb = v.thumb ? '<img class="thumb" src="' + esc(v.thumb) + '" alt="" loading="lazy">' : '<span class="thumb" aria-hidden="true">' + (o.live ? '' : 'Demo') + '</span>';
        var title = v.url ? '<a href="' + esc(v.url) + '" target="_blank" rel="noopener">' + esc(v.title) + '</a>' : '<span style="font-weight:500">' + esc(v.title) + '</span>';
        return '<tr><td>' + (i + 1) + '</td><td><div class="vid">' + thumb + '<div>' + title + '<small>' + esc(v.channel) + '</small></div></div></td>' +
          '<td style="white-space:nowrap">' + ago(v.published) + '</td><td class="num">' + short(v.views) + '</td>' +
          '<td class="num">' + (v.likesHidden ? 'Hidden' : num(v.likes)) + '</td><td class="num">' + (v.commentsOff ? 'Off' : num(v.commentCount)) + '</td>' +
          '<td><div class="eng"><span class="track"><span class="fill" style="width:' + (v.engagement / max * 100) + '%"></span></span><b>' + short(v.engagement) + '</b></div></td></tr>';
      }).join('') + '</tbody>';

    $('results').hidden = false;
    $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  $('terms').value = '';
})();
