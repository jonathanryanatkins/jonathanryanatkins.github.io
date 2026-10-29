/*
 * Content Creation Analytics Engine: theme finder.
 *
 * findThemes(videos, topic, n) reads the titles, tags, descriptions and comments
 * of the top videos, finds the phrases that recur across several videos (weighted
 * by where they appear and how liked the comments are), groups related phrases
 * into themes, and returns the n strongest with the evidence behind each.
 *
 * video: { id, title, channel, tags: [], description, likes, commentCount, comments: [{ text, likes }] }
 */
(function (root) {
  'use strict';

  var STOP = ('a about above after again against all almost also am an and any are aren\'t as at be because been before being below between both but by can can\'t cannot could couldn\'t did didn\'t do does doesn\'t doing don\'t down during each even ever every few for from further get gets getting got had hadn\'t has hasn\'t have haven\'t having he her here hers herself him himself his how i if in into is isn\'t it it\'s its itself just let\'s like make makes made many may me might more most much must my myself need needs never no nor not now of off on once one only or other our ours out over own per please pretty quite rather really same say says see seems she should shouldn\'t since so some still such than that that\'s the their theirs them themselves then there there\'s these they they\'re this those though through thing things to too under until up upon us use used using very via want wants was wasn\'t way we we\'re were weren\'t what what\'s when where which while who whom why will with without won\'t would wouldn\'t yes yet you you\'re your yours yourself ' +
    'video videos channel subscribe subscribed like liked likes comment comments thanks thank great good best better love watch watching watched today tonight week year years month new latest people guys everyone anyone someone something everything nothing lot lots actually literally always already keep going go goes come right well know think thought feel look looking mean means part point time times day days work works sure maybe probably done every next last first second another around still ever whole real reall top ways tips explained explain guide update ' +
    'jan feb mar apr may jun jul aug sep oct nov dec january february march april june july august september october november december 2024 2025 2026 2027 uk').split(/\s+/);
  var STOPSET = {}; STOP.forEach(function (w) { STOPSET[w] = 1; });

  function clean(text) {
    return String(text || '').toLowerCase()
      .replace(/https?:\/\/\S+/g, ' ').replace(/[@#][\w-]+/g, ' ')
      .replace(/[£$€]?\d[\d,.]*\s?(k|m|bn|%)?/g, ' ')
      .replace(/[’‘]/g, "'").replace(/[^a-z' \n.!?;:,()-]/g, ' ');
  }
  function sentences(text) { return clean(text).split(/[\n.!?;:()]+|,\s|\s-\s/); }
  function tokens(s) { return s.split(/\s+/).map(function (w) { return w.replace(/^'+|'+$/g, ''); }).filter(Boolean); }
  function singular(w) { return w.length > 4 && /s$/.test(w) && !/ss$|us$|is$/.test(w) ? w.slice(0, -1) : w; }

  function grams(text, add) {
    sentences(text).forEach(function (s) {
      var t = tokens(s);
      for (var i = 0; i < t.length; i++) {
        for (var n = 1; n <= 3 && i + n <= t.length; n++) {
          var g = t.slice(i, i + n);
          if (STOPSET[g[0]] || STOPSET[g[n - 1]]) continue;
          if (g[0].length < 3 && n === 1) continue;
          // inner words of a trigram may be small joiners ("cost of living", "stocks and shares")
          if (n === 3 && STOPSET[g[1]] && ['of', 'and', 'for', 'to', 'in', 'vs'].indexOf(g[1]) === -1) continue;
          if (n === 2 && (STOPSET[g[0]] || STOPSET[g[1]])) continue;
          if (g.some(function (w) { return /'/.test(w); })) continue;
          add(g.map(singular).join(' '), n, g.join(' '));
        }
      }
    });
  }

  function findThemes(videos, topic, n) {
    n = n || 5;
    var topicWords = {};
    tokens(clean(topic)).forEach(function (w) { topicWords[singular(w)] = 1; });
    ['most', 'engaged', 'topic', 'today', 'trending', 'popular'].forEach(function (w) { topicWords[w] = 1; });

    var P = {}; // phrase -> { n, weight, videos: {}, comments: [] }
    videos.forEach(function (v) {
      function addFrom(text, w, comment) {
        var seen = {};
        grams(text, function (g, size, surface) {
          if (g.split(' ').every(function (x) { return topicWords[x]; })) return;
          if (seen[g]) return; seen[g] = 1;
          var p = P[g] || (P[g] = { phrase: g, n: size, weight: 0, videos: {}, commentHits: 0, comments: [], forms: {} });
          p.forms[surface] = (p.forms[surface] || 0) + 1;
          p.weight += w; p.videos[v.id] = 1;
          if (comment) { p.commentHits++; p.comments.push({ text: comment.text, likes: comment.likes || 0, video: v.id }); }
        });
      }
      addFrom(v.title, 3);
      (v.tags || []).forEach(function (t) { addFrom(t, 2); });
      addFrom(String(v.description || '').slice(0, 600), 1);
      (v.comments || []).forEach(function (c) { addFrom(c.text, 1 + Math.log10(1 + (c.likes || 0)) / 2, c); });
    });

    var minVideos = videos.length >= 4 ? 2 : 1;
    var list = Object.keys(P).map(function (k) {
      var p = P[k];
      p.videoCount = Object.keys(p.videos).length;
      p.score = Math.pow(p.videoCount, 1.5) * Math.log(1 + p.weight) * (p.n === 1 ? 1 : p.n === 2 ? 1.35 : 1.5) *
        (0.5 + 0.5 * Math.min(1, p.commentHits / 3)); // favour what viewers discuss, not just what creators tag
      p.display = Object.keys(p.forms).sort(function (a, b) { return p.forms[b] - p.forms[a]; })[0];
      return p;
    }).filter(function (p) { return p.videoCount >= minVideos && p.weight >= 3; });

    // drop a phrase when a longer phrase containing it carries most of its weight ("isa" inside "cash isa")
    list.forEach(function (p) {
      list.forEach(function (q) {
        if (q.n > p.n && (' ' + q.phrase + ' ').indexOf(' ' + p.phrase + ' ') > -1 && q.weight >= p.weight * 0.6) p.covered = q;
      });
    });
    list = list.filter(function (p) { return !p.covered; });
    // a single word inside several longer phrases ("rates" in mortgage, savings and interest rates) is too ambiguous to lead a theme
    list.forEach(function (p) {
      if (p.n !== 1) return;
      p.parents = list.filter(function (q) { return q.n > 1 && (' ' + q.phrase + ' ').indexOf(' ' + p.phrase + ' ') > -1; }).length;
    });
    list.sort(function (a, b) { return b.score - a.score; });

    var themes = [];
    function jaccard(a, b) {
      var ka = Object.keys(a), inter = ka.filter(function (k) { return b[k]; }).length;
      return inter / (ka.length + Object.keys(b).length - inter);
    }
    function shares(a, b) {
      var A = a.split(' '), B = b.split(' ');
      return A.some(function (w) { return w.length > 2 && B.indexOf(w) > -1; });
    }
    for (var i = 0; i < list.length && i < 120; i++) {
      var p = list[i], home = null;
      for (var t = 0; t < themes.length && !home; t++) {
        var th = themes[t];
        var related = th.phrases.some(function (q) {
          var contained = (' ' + q.phrase + ' ').indexOf(' ' + p.phrase + ' ') > -1 || (' ' + p.phrase + ' ').indexOf(' ' + q.phrase + ' ') > -1;
          var overlap = jaccard(q.videos, p.videos);
          // a longer phrase always joins the theme led by a word it contains ("mortgage rates" joins "rates")
          return (contained && (overlap >= 0.34 || (q.n === 1 && p.n > 1))) || (shares(q.phrase, p.phrase) && overlap >= 0.5);
        });
        if (related) home = th;
      }
      if (home) { home.phrases.push(p); continue; }
      if (themes.length < n) themes.push({ phrases: [p] });
    }

    var byId = {}; videos.forEach(function (v) { byId[v.id] = v; });
    var usedQuotes = {};
    return themes.map(function (th) {
      var vids = {}, comments = [], seenC = {};
      // comments matched by a specific phrase come first; ones matched only by a single common word come after
      var ordered = th.phrases.filter(function (p) { return p.n > 1; }).concat(th.phrases.filter(function (p) { return p.n === 1; }));
      var specific = {};
      ordered.forEach(function (p) {
        Object.keys(p.videos).forEach(function (k) { vids[k] = 1; });
        p.comments.forEach(function (c) {
          if (p.n > 1) specific[c.text] = 1;
          if (!seenC[c.text]) { seenC[c.text] = 1; comments.push(c); }
        });
      });
      comments.sort(function (a, b) { return (specific[b.text] ? 1 : 0) - (specific[a.text] ? 1 : 0) || b.likes - a.likes; });
      var fresh = comments.filter(function (c) { return !usedQuotes[c.text]; });
      // name the theme after its strongest specific phrase, not a bare common word
      var multi = th.phrases.filter(function (p) { return p.n > 1; }).sort(function (a, b) { return b.score - a.score; });
      var head = multi[0] || th.phrases[0];
      var question = fresh.filter(function (c) { return /\?\s*$|^(can|could|should|is|are|which|how|what|why|does|do) /i.test(c.text.trim()); })[0] || null;
      var topComment = fresh.filter(function (c) { return c !== question; })[0] || null;
      if (question) usedQuotes[question.text] = 1;
      if (topComment) usedQuotes[topComment.text] = 1;
      var videoIds = Object.keys(vids);
      var engagement = videoIds.reduce(function (s, k) { return s + (byId[k].likes || 0) + (byId[k].commentCount || 0); }, 0);
      return {
        label: label(head.display),
        terms: th.phrases.filter(function (p) { return p !== head; }).map(function (p) { return p.display; }).slice(0, 6),
        videos: videoIds,
        videoCount: videoIds.length,
        commentMentions: comments.length,
        engagement: engagement,
        topComment: topComment,
        question: question,
        score: th.phrases.reduce(function (s, p) { return s + p.score; }, 0)
      };
    }).sort(function (a, b) { return b.score - a.score; });
  }

  var ACRONYMS = { isa: 'ISA', hmrc: 'HMRC', uk: 'UK', ai: 'AI', etf: 'ETF', vat: 'VAT', nhs: 'NHS', tv: 'TV', ev: 'EV', iphone: 'iPhone', ceo: 'CEO', usa: 'USA' };
  function label(phrase) {
    return phrase.split(' ').map(function (w, i) {
      if (ACRONYMS[w]) return ACRONYMS[w];
      if (i > 0 && ['of', 'and', 'for', 'to', 'in', 'vs'].indexOf(w) > -1) return w;
      return i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w;
    }).join(' ');
  }

  var api = { findThemes: findThemes, label: label };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ThemeFinder = api;
})(this);
