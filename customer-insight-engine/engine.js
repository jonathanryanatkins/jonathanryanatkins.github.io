/*
 * Customer Insight Engine: complaint classifier.
 *
 * A transparent, evidence-based classifier. Each category has a set of weighted
 * cue patterns; a complaint's score for a category is the sum of the cues it
 * contains. The highest score is the primary category, a close runner-up is the
 * secondary, and every matched phrase is returned as evidence so a reviewer can
 * see exactly why a ticket landed where it did.
 *
 * classify(text) -> { primary, secondary, confidence, scores, evidence: [{start, end, category, cue}], themes: [] }
 */
(function (root) {
  'use strict';

  var CATEGORIES = ['Communication', 'Clerical', 'Misdiagnosis', 'Malpractice'];

  function cues(list) {
    return list.map(function (c) { return { re: new RegExp(c[0], 'gi'), w: c[1], name: c[2] }; });
  }

  var LEX = {
    Communication: cues([
      ["\\b(did not|didn't|could not|couldn't|do not|don't) (really )?(understand|know what)\\b", 3, 'did not understand'],
      ["\\b(I|she|he|we|my \\w+) understood\\b", 2.5, 'misunderstood meaning'],
      ["\\bunderstood nothing\\b|\\bnot (clear|understand)\\b", 2, 'unclear'],
      ["\\b(nobody|no one|not) (explain(ed)?|told us what)\\b|\\bwithout explaining what\\b|\\bnobody used simple\\b", 2.5, 'not explained'],
      ["\\bexplain(ed|ing)? (it )?(slowly|clearly|again|with care|simply)\\b|\\bone sentence of explanation\\b", 1.5, 'explanation needed'],
      ["\\bmedical (words|terms)\\b|\\btoo technical\\b|\\bcomplicated way\\b|\\babbreviations?\\b|\\bjargon\\b|\\bstatistics\\b", 3, 'medical jargon'],
      ["\\bwhat [\\w\" ]{1,25} means\\b|\\bmeans the same\\b|\\bbig difference\\b", 2, 'meaning of a term'],
      ["\\binterpreters?\\b|\\btranslat(e|ion)\\b|\\bsomeone who (speaks|can speak)\\b|\\b(arabic|hindi|bengali) speaker\\b", 3, 'interpreter or translation'],
      ["\\b(only|all) in english\\b|\\benglish only\\b|\\bin english and arabic\\b|\\bonly english\\b|\\bin my language\\b", 2.5, 'English-only materials'],
      ["\\b(first|second|native|own) language\\b|\\bnot native\\b|\\bmy (limited|slow) english\\b|\\benglish (is|was) (slow|not perfect)\\b|\\blanguage barrier\\b|\\baccent\\b|\\bpronunciation\\b|\\bspeak(ing)? only to me in english\\b", 2.5, 'second language'],
      ["\\b(very )?fast\\b|\\bquickly\\b|\\bslowly\\b|\\brepeat(ed)?\\b|\\bhang up\\b", 1.2, 'pace of speech'],
      ["\\brude\\b|\\bshout(ed)?\\b|\\bloud voice\\b|\\bhumiliat\\w*\\b|\\bdisrespect\\w*\\b|\\binterrupted\\b|\\bnot heard\\b|\\bdid not look at me\\b|\\bcold\\b|\\bexcluded\\b|\\bpatience\\b", 2, 'tone and respect'],
      ["\\binstructions?\\b|\\bleaflet\\b|\\bwritten plan\\b|\\binstructions sheet\\b|\\bprinted sheet\\b|\\bteach-back\\b|\\bcheck(ed)? (I|what the family) understood\\b|\\bconfirmed with\\b", 1.5, 'instructions'],
      ["\\b(different|one clear) (update|person)\\b|\\bguessing\\b|\\bconfus(ed|ion|ing)\\b|\\bthe way the news was given\\b", 1.5, 'confusion'],
      ["\\bno real consent\\b|\\bwhat (she|he|I) (is|am) signing\\b|\\bpointed where to sign\\b|\\bnobody explained this means\\b", 3, 'consent not understood'],
      ["\\b(said|told|asked)[^.]{0,40}\\band (she|he|I|my \\w+) (understood|did not know)\\b", 2, 'misheard'],
      ["\\bI said\\b[^.]{0,40}\\b(she|he) wrote\\b|\\bhe wrote\\b|\\bshe wrote\\b", 2.5, 'misrecorded words'],
      ["\\bI thought\\b|\\b(she|he|we|my \\w+) thought (it|this|the|she|he)\\b|\\bcould have said\\b|\\bspent (weeks|the weekend) (thinking|in fear)\\b", 2, 'wrong impression formed'],
      ["\\bsimple (words|english|list)\\b|\\bclear(er)? (instructions|language|words)\\b|\\bcommunication must\\b|\\bconfusion about simple words\\b", 2, 'plain language']
    ]),
    Clerical: cues([
      ["\\binvoices?\\b|\\bitemised\\b|\\bcharged\\b|\\bcharge\\b|\\brefund\\b|\\breceipt\\b|\\bdeposit\\b|\\bpay(ment)?s?\\b|\\bbill(ing)?\\b|\\bdirhams\\b|\\bfee\\b", 2, 'billing'],
      ["\\binsurance (claim|approval|refused)\\b|\\bpre-approval\\b|\\bpolicy number\\b|\\bcoded\\b|\\bthe code\\b|\\broom category\\b|\\bapproved by my insurance\\b", 3, 'insurance administration'],
      ["\\bappointments?\\b|\\bbook(ing|ed)\\b|\\bSMS\\b|\\bnot on the list\\b|\\bon leave\\b|\\bdate was changed\\b|\\bwaited \\d+ hours past\\b|\\bnot confirmed in the system\\b", 2, 'booking and scheduling'],
      ["\\b(patient )?records?\\b|\\bfile\\b|\\bwristband\\b|\\bspell(ed|ing)\\b|\\bemirates id\\b|\\bregistered as\\b|\\bduplicate\\b|\\bmerge\\b|\\bbirth notification\\b", 2.5, 'records and identity'],
      ["\\bsent to the wrong\\b|\\bnot uploaded\\b|\\bwas not uploaded\\b|\\breferral letter\\b|\\bdischarge summary\\b|\\breport (was )?sent\\b|\\bno report received\\b|\\bcollect a CD\\b", 3, 'documents and referrals'],
      ["\\bthe system\\b|\\bportal showed\\b|\\bsystem message\\b|\\bnot updated\\b|\\bnobody takes ownership\\b|\\bcall back\\b|\\btransferring my call\\b|\\bfront desk\\b|\\bpoor follow-up\\b", 1.5, 'process and follow-up'],
      ["\\bnot ready\\b|\\bdifferent brand\\b|\\bsubstitution\\b|\\bpackage\\b", 1.5, 'service administration']
    ]),
    Misdiagnosis: cues([
      ["\\bmisdiagnos\\w*\\b|\\bdiagnosed (with|as)\\b|\\bdiagnosis\\b", 2.5, 'diagnosis'],
      ["\\b(told|said) (me |us )?(it is|it's|my|that|the)\\b[^.]{0,40}\\b(and sent|sent (me|us|him|her) home)\\b|\\bsent (me|us|him|her) home\\b", 2.5, 'sent home'],
      ["\\b(later|then|after)\\b[^.]{0,60}\\b(found|showed|confirmed|diagnosed)\\b|\\b(another|second|other) (hospital|clinic|doctor|neurologist|radiologist)\\b[^.]{0,40}\\b(found|diagnosed|confirmed|removed|said)\\b", 3, 'later found to be different'],
      ["\\bno (scan|test|ct|urine test|biopsy)\\b|\\bwithout (any )?(scan|test|dermoscopy)\\b|\\bdid not (order|do) (a |any )?(scan|test)\\b|\\bnot do any test\\b|\\bshould have been done\\b|\\bif the test was done\\b", 3, 'test not done'],
      ["\\bvisible on the first\\b|\\bread as normal\\b|\\bno abnormality\\b|\\bwarning ignored\\b|\\bcan miss\\b|\\bwas called benign\\b|\\bmiss(ed)? (the |a |an )?(diagnosis|fracture|bleed|stones?|nodule|signs?|important|condition)\\b|\\bmade the doctor miss\\b|\\bnot considered\\b", 3, 'finding missed'],
      ["\\b(he|she|it) (had|was|is) (an? )?(\\w+ ){0,2}(aneurysm|stroke|heart attack|fracture|sepsis|dengue|appendicitis|melanoma|ectopic|gallstones|stone)\\b", 2, 'actual condition found later'],
      ["\\bdelay in diagnosis\\b|\\btook my symptoms seriously\\b|\\bnot take my symptoms seriously\\b|\\bdid not listen to me\\b", 2, 'symptoms dismissed'],
      ["\\b(it is|just|only) (acid reflux|a stomach bug|viral|teething|anxiety|migraine|gastritis|sprained|eczema|vitamin deficiency|muscle strain)\\b|\\bwas (told|diagnosed)[^.]{0,30}(is|as) (anxiety|gastritis|eczema)\\b|\\bwas diagnosed as\\b|\\bwrote muscle strain\\b", 2.5, 'wrong diagnosis given']
    ]),
    Malpractice: cues([
      ["\\bnegligen\\w*\\b|\\bbelow standard\\b|\\bneglected\\b|\\bshould never happen\\b", 3, 'negligence'],
      ["\\bwrong (knee|side|site|patient|type|dose)\\b|\\boperated on my (left|right)\\b|\\banother patient's medicine\\b|\\bdose calculated for a different\\b|\\badult dose\\b|\\bmedication error\\b|\\bmisread the chart\\b", 4, 'wrong treatment given'],
      ["\\bswab (was )?left\\b|\\bleft inside\\b|\\bsurgical count\\b|\\btoo tight\\b|\\bpressure injury\\b|\\bbed sore\\b|\\bnot (moved|turned)\\b|\\bIV line was left\\b|\\bsplinted incorrectly\\b|\\bnot repaired correctly\\b", 4, 'harm from care'],
      ["\\bwithout (my agreement|explaining or asking|supervision)\\b|\\bnot present for\\b|\\bjunior doctor performed\\b|\\btrainee without supervision\\b|\\bno senior review\\b", 3.5, 'unsupervised or unconsented care'],
      ["\\bdid not check (my ID|the weight|the prescription)\\b|\\bnurse did not check\\b|\\bdid not do a check\\b|\\ballergy (alert|was written)\\b|\\bhe is allergic to\\b|\\bfailed to check\\b|\\bnot documented\\b|\\bnobody documented\\b", 3, 'safety check missed'],
      ["\\bsecond (operation|surgery)\\b|\\bin ICU for\\b|\\bsevere reaction\\b|\\bhypoglycaemia\\b|\\bneeded (drainage|surgery|antibiotics)\\b|\\bhiding the error\\b|\\binvestigation\\b|\\bwant a (full )?(review|investigation)\\b|\\baftercare advice was negligent\\b", 2, 'serious outcome']
    ])
  };

  var THEMES = [
    { name: 'Medical jargon and abbreviations', re: /\bmedical (words|terms)\b|\btoo technical\b|\babbreviations?\b|\bjargon\b|\bstatistics\b|\b(IUGR|DNR|GDM|OGTT|CTG|PRN|BID|INR)\b|\bnil by mouth\b|\bpush fluids\b|\bdegenerative\b|\bnonspecific\b|\bnext of kin\b|\bhistory of fits\b|\ballergies to agents\b|\bconversion to open\b|\bvitamin K\b|\bweight bearing\b|\bresume normal activity\b|\bstable\b.*\bguarded\b|\bcath\b|\bwhat [\w" ]{1,25} means\b/i },
    { name: 'Words misheard or misrecorded', re: /\b(I|she|he|we|my \w+) understood\b|\bunderstood "|\bhe wrote\b|\bshe wrote\b|\bwrote "|\baccent\b|\bpronunciation\b|\bunderstood (the|it|treatment)\b/i },
    { name: 'No interpreter available', re: /\binterpreters?\b|\btranslat(e|ion)\b|\bsomeone who (speaks|can speak)\b|\b(arabic|hindi|bengali) speaker\b|\bnot allowed to translate\b/i },
    { name: 'Instructions and medication advice', re: /\binstructions?\b|\bdischarg(e|ed) with\b|\bdischarge instructions\b|\bdose\b|\btake (the|twice|once)\b|\bwith food\b|\bas needed\b|\breturn if worse\b|\bdrowsy\b|\bcreams?\b|\bmedicines?\b|\btablets?\b|\binhaler\b/i },
    { name: 'Consent not understood', re: /\bconsent\b|\bsign(ed|ing)?\b|\bDNR\b/i },
    { name: 'Difficult news delivered poorly', re: /\bstage three\b|\btumour\b|\bno further options\b|\bstillbirth\b|\bend of life\b|\bDNR\b|\bcritical\b|\bradiotherapy\b|\bthe way the news\b/i },
    { name: 'Tone and respect', re: /\brude\b|\bshout(ed)?\b|\bloud voice\b|\bhumiliat\w*\b|\bdisrespect\w*\b|\binterrupted\b|\bnot heard\b|\bdid not look at me\b|\bhang up\b|\bpatience\b|\bexcluded\b|\bcold\b|\bblamed\b|\byou can google\b/i },
    { name: 'English-only written materials', re: /\b(only|all) in english\b|\benglish only\b|\bin english and arabic\b|\breads bengali\b|\bin my language\b|\bprinted sheet\b|\bleaflet\b/i },
    { name: 'Speaking too fast', re: /\b(very |too )?fast\b|\bquickly\b|\bslowly\b|\brepeat\b/i }
  ];

  function classify(text) {
    text = String(text || '');
    var scores = {}, evidence = [];
    CATEGORIES.forEach(function (cat) {
      scores[cat] = 0;
      var seen = {};
      LEX[cat].forEach(function (c) {
        c.re.lastIndex = 0;
        var m, hits = 0;
        while ((m = c.re.exec(text))) {
          if (!m[0]) { c.re.lastIndex++; continue; }
          evidence.push({ start: m.index, end: m.index + m[0].length, category: cat, cue: c.name });
          hits++;
        }
        // repeated hits of one cue add a little, not a lot
        if (hits) scores[cat] += c.w * (1 + Math.min(hits - 1, 2) * 0.25);
        if (hits) seen[c.name] = 1;
      });
      scores[cat] = Math.round(scores[cat] * 10) / 10;
    });

    var ranked = CATEGORIES.slice().sort(function (a, b) { return scores[b] - scores[a]; });
    var top = scores[ranked[0]], second = scores[ranked[1]];
    var total = CATEGORIES.reduce(function (s, c) { return s + scores[c]; }, 0);
    var primary = top > 0 ? ranked[0] : 'Unclassified';
    var secondary = top > 0 && second >= Math.max(2.5, top * 0.45) ? ranked[1] : null;
    var share = total ? top / total : 0;
    var confidence = top === 0 ? 'None' : (share >= 0.6 && top >= 5 ? 'High' : share >= 0.42 && top >= 3 ? 'Medium' : 'Low');

    var themes = [];
    if (scores.Communication > 0) {
      THEMES.forEach(function (t) { if (t.re.test(text)) themes.push(t.name); });
    }

    // keep evidence spans tidy: drop spans fully inside a longer span
    evidence.sort(function (a, b) { return a.start - b.start || (b.end - b.start) - (a.end - a.start); });
    var tidy = [], lastEnd = -1;
    evidence.forEach(function (e) { if (e.start >= lastEnd) { tidy.push(e); lastEnd = e.end; } });

    return { primary: primary, secondary: secondary, confidence: confidence, scores: scores, evidence: tidy, themes: themes };
  }

  var api = { classify: classify, CATEGORIES: CATEGORIES, THEMES: THEMES.map(function (t) { return t.name; }) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.InsightEngine = api;
})(this);
