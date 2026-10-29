(function () {
  'use strict';

  /* ---------- Données : le tableau du livre ---------- */
  var F = 'َ', D = 'ُ', K = 'ِ', FT = 'ً', DT = 'ٌ', KT = 'ٍ', SU = 'ْ', SH = 'ّ';
  var ALIF = 'ا', WAW = 'و', YA = 'ي';
  var LETTERS = [
    { ch: 'ب', tr: 'b', n: 'bâ' },
    { ch: 'ت', tr: 't', n: 'tâ' },
    { ch: 'ث', tr: 'th', n: 'thâ' }
  ];
  var ROWS = [
    { id: 'fatha', name: 'Fatha', hint: '« a » bref', mk: function (l) { return { parts: [[l.ch + F]], tr: l.tr + 'a' }; } },
    { id: 'damma', name: 'Damma', hint: '« ou » bref', mk: function (l) { return { parts: [[l.ch + D]], tr: l.tr + 'ou' }; } },
    { id: 'kasra', name: 'Kasra', hint: '« i » bref', mk: function (l) { return { parts: [[l.ch + K]], tr: l.tr + 'i' }; } },
    { id: 'tfatha', name: 'Tanwîn fatha', hint: '« an »', mk: function (l) { return { parts: [[l.ch + (l.noAlif ? '' : ALIF) + FT]], tr: l.tr + 'an' }; } },
    { id: 'tdamma', name: 'Tanwîn damma', hint: '« oun »', mk: function (l) { return { parts: [[l.ch + DT]], tr: l.tr + 'oun' }; } },
    { id: 'tkasra', name: 'Tanwîn kasra', hint: '« in »', mk: function (l) { return { parts: [[l.ch + KT]], tr: l.tr + 'in' }; } },
    { id: 'alif', name: 'Alif', hint: '« â » long', mk: function (l) { return { parts: [[l.ch + F], [ALIF, 1]], tr: l.tr + 'â' }; } },
    { id: 'waw', name: 'Waw', hint: '« oû » long', mk: function (l) { return { parts: [[l.ch + D], [WAW, 1]], tr: l.tr + 'oû' }; } },
    { id: 'ya', name: 'Ya', hint: '« î » long', mk: function (l) { return { parts: [[l.ch + K], [YA, 1]], tr: l.tr + 'î' }; } },
    { id: 'sukun', name: 'Soukoun', hint: 'sans voyelle', mk: function (l) { return { parts: [[l.ch + SU]], tr: l.tr }; } },
    { id: 'shadda', name: 'Chadda', hint: 'lettre doublée', mk: function (l) { return { parts: [[l.ch + SH + F]], tr: l.tr + l.tr + 'a' }; } }
  ];
  var WORDS = [
    { parts: [['ب' + F], [ALIF, 1], ['ت' + F]], tr: 'bâta', fr: 'il a passé la nuit' },
    { parts: [['ت' + F], [ALIF, 1], ['ب' + F]], tr: 'tâba', fr: 'il s’est repenti' },
    { parts: [['ث' + D + 'ب' + D], [WAW, 1], ['ت' + DT]], tr: 'thouboût', fr: 'la preuve, la fermeté' }
  ];

  function textOf(parts) { return parts.map(function (p) { return p[0]; }).join(''); }

  var GRID = [];      // GRID[r][c]
  var SYLS = [];      // toutes les syllabes
  ROWS.forEach(function (row, r) {
    GRID[r] = [];
    LETTERS.forEach(function (l, c) {
      var m = row.mk(l);
      var item = { kind: 'syl', parts: m.parts, tr: m.tr, text: textOf(m.parts), r: r, c: c, rowId: row.id, desc: row.name + ' · ' + row.hint };
      GRID[r][c] = item;
      SYLS.push(item);
    });
  });
  GRID[ROWS.length] = WORDS.map(function (w, c) {
    return { kind: 'word', parts: w.parts, tr: w.tr, text: textOf(w.parts), r: ROWS.length, c: c, rowId: 'word', fr: w.fr, desc: w.fr };
  });
  var WORD_ITEMS = GRID[ROWS.length];

  /* Mots d'entraînement en plus du tableau : uniquement les lettres du livre (ب ت ث)
     avec les voyelles, tanwîn, chadda et lettres de prolongation déjà étudiés. */
  var MORE_WORDS = [
    { parts: [['ب' + F], [ALIF, 1], ['ب' + DT]], tr: 'bâb', fr: 'la porte' },
    { parts: [['ت' + D], [WAW, 1], ['ت' + DT]], tr: 'toût', fr: 'la mûre' },
    { parts: [['أ' + F + 'ث' + F], [ALIF, 1], ['ث' + DT]], tr: 'athâth', fr: 'les meubles' },
    { parts: [['أ' + F + 'ب' + DT]], tr: 'ab', fr: 'le père' },
    { parts: [['ث' + F + 'ب' + F], [ALIF, 1], ['ت' + DT]], tr: 'thabât', fr: 'la stabilité' },
    { parts: [['ب' + F + 'ث' + SH + F]], tr: 'baththa', fr: 'il a diffusé' },
    { parts: [['ث' + F + 'ب' + F + 'ت' + F]], tr: 'thabata', fr: 'il est resté ferme' },
    { parts: [['ث' + F], [ALIF, 1], ['ب' + K + 'ت' + DT]], tr: 'thâbit', fr: 'stable, ferme' }
  ];
  var QUIZ_WORDS = WORD_ITEMS.concat(MORE_WORDS.map(function (w) {
    return { kind: 'word', parts: w.parts, tr: w.tr, text: textOf(w.parts), rowId: 'word', fr: w.fr, desc: w.fr };
  }));
  var NROWS = ROWS.length + 1;

  /* Alphabet complet (ordre arabe). ch = base des variations, nj = ne se lie pas à la lettre suivante */
  var ZWJ = '‍';
  var ALPHA = [
    { disp: 'ا', ch: 'أ', tr: 'ʾ', n: 'alif', noAlif: true, nj: true },
    { disp: 'ب', tr: 'b', n: 'bâ' },
    { disp: 'ت', tr: 't', n: 'tâ' },
    { disp: 'ث', tr: 'th', n: 'thâ' },
    { disp: 'ج', tr: 'dj', n: 'djîm' },
    { disp: 'ح', tr: 'ḥ', n: 'ḥâ' },
    { disp: 'خ', tr: 'kh', n: 'khâ' },
    { disp: 'د', tr: 'd', n: 'dâl', nj: true },
    { disp: 'ذ', tr: 'dh', n: 'dhâl', nj: true },
    { disp: 'ر', tr: 'r', n: 'râ', nj: true },
    { disp: 'ز', tr: 'z', n: 'zây', nj: true },
    { disp: 'س', tr: 's', n: 'sîn' },
    { disp: 'ش', tr: 'ch', n: 'chîn' },
    { disp: 'ص', tr: 'ṣ', n: 'ṣâd' },
    { disp: 'ض', tr: 'ḍ', n: 'ḍâd' },
    { disp: 'ط', tr: 'ṭ', n: 'ṭâ' },
    { disp: 'ظ', tr: 'ẓ', n: 'ẓâ' },
    { disp: 'ع', tr: 'ʿ', n: 'ʿayn' },
    { disp: 'غ', tr: 'gh', n: 'ghayn' },
    { disp: 'ف', tr: 'f', n: 'fâ' },
    { disp: 'ق', tr: 'q', n: 'qâf' },
    { disp: 'ك', tr: 'k', n: 'kâf' },
    { disp: 'ل', tr: 'l', n: 'lâm' },
    { disp: 'م', tr: 'm', n: 'mîm' },
    { disp: 'ن', tr: 'n', n: 'noûn' },
    { disp: 'ه', tr: 'h', n: 'hâ' },
    { disp: 'و', tr: 'w', n: 'wâw', nj: true },
    { disp: 'ي', tr: 'y', n: 'yâ' }
  ];
  ALPHA.forEach(function (l) { if (!l.ch) l.ch = l.disp; });

  function variationsFor(l) {
    return ROWS.map(function (row, r) {
      var m = row.mk(l);
      return { kind: 'syl', parts: m.parts, tr: m.tr, text: textOf(m.parts), r: r, rowId: row.id, desc: row.name + ' · ' + row.hint };
    });
  }

  /* ---------- Outils ---------- */
  var synth = window.speechSynthesis;
  var canSpeak = !!(synth && window.SpeechSynthesisUtterance);
  var $ = function (id) { return document.getElementById(id); };
  var state = { mode: 'study', queue: [], i: 0, score: 0, answered: false, mistakes: [], voice: null, interacted: false, current: null, reading: false, sel: null };

  function h(tag, cls, text) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  }
  function arEl(item, cls) {
    var s = h('span', 'ar' + (cls ? ' ' + cls : ''));
    s.lang = 'ar';
    s.dir = 'rtl';
    item.parts.forEach(function (p) { s.appendChild(h('span', p[1] ? 'lv' : null, p[0])); });
    return s;
  }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ---------- Voix ---------- */
  function setSpeaking(on) { $('player').classList.toggle('speaking', on); }

  function loadVoices() {
    if (!canSpeak) return;
    var all = synth.getVoices();
    if (!all.length) return;
    var vs = all.filter(function (v) { return /^ar([-_]|$)/i.test(v.lang); });
    var sel = $('voiceSel');
    var keep = state.voice ? state.voice.voiceURI : null;
    sel.innerHTML = '';
    $('noArabic').hidden = vs.length > 0;
    if (!vs.length) { $('voiceField').hidden = true; return; }
    vs.sort(function (a, b) { return a.name.localeCompare(b.name); });
    vs.forEach(function (v) {
      var o = document.createElement('option');
      o.value = v.voiceURI;
      o.textContent = v.name + ' (' + v.lang + ')';
      sel.appendChild(o);
    });
    var chosen = vs.filter(function (v) { return v.voiceURI === keep; })[0] || vs[0];
    sel.value = chosen.voiceURI;
    state.voice = chosen;
    $('voiceField').hidden = false;
  }

  function showErr(msg) {
    ['errStudy', 'errQuiz', 'errAlpha'].forEach(function (id) {
      var el = $(id);
      el.textContent = msg || '';
      el.hidden = !msg;
    });
  }
  var ERR = {
    'language-unavailable': 'Cet appareil n’a pas de voix arabe. Installez-en une dans les réglages de synthèse vocale, ou ouvrez le fichier dans Chrome ou Safari.',
    'voice-unavailable': 'La voix choisie n’est pas disponible. Choisissez une autre voix arabe dans la liste.',
    'not-allowed': 'Le navigateur a bloqué le son. Touchez de nouveau le bouton.',
    'synthesis-unavailable': 'La synthèse vocale est indisponible ici. Ouvrez le fichier dans Chrome ou Safari.',
    'synthesis-failed': 'La synthèse vocale a échoué. Ouvrez le fichier dans Chrome ou Safari.',
    'silent': 'Pas de son ? Vérifiez le volume et le mode silencieux, puis qu’une voix arabe est installée. Sinon, ouvrez le fichier dans Chrome ou Safari.',
    'other': 'Le son n’a pas pu démarrer. Ouvrez le fichier dans Chrome ou Safari.'
  };

  function speak(text, rate, done) {
    if (!canSpeak) { if (done) done(); return; }
    try { synth.cancel(); } catch (e) {}
    var u = new SpeechSynthesisUtterance(text);
    u.lang = state.voice ? state.voice.lang : 'ar-SA';
    if (state.voice) u.voice = state.voice;
    u.rate = rate || 0.75;
    state.current = u;
    var started = false;
    u.onstart = function () { started = true; showErr(''); if (state.current === u) setSpeaking(true); };
    u.onend = function () { if (state.current === u) { setSpeaking(false); if (done) done(true); } };
    u.onerror = function (ev) {
      if (state.current !== u) return;
      setSpeaking(false);
      var code = ev && ev.error;
      if (code !== 'canceled' && code !== 'interrupted') showErr(ERR[code] || ERR.other);
      if (done) done(false);
    };
    setTimeout(function () {
      if (state.current !== u) return;
      try { synth.resume(); } catch (e) {}
      synth.speak(u);
    }, 40);
    setTimeout(function () { if (state.current === u && !started) showErr(ERR.silent); }, 2500);
  }
  function speakItem(item, rate) { speak(item.text, rate, null); }

  /* ---------- Mode tableau ---------- */
  function buildGrid() {
    var g = $('grid');
    g.innerHTML = '';
    LETTERS.forEach(function (l) {
      var hd = h('div', 'gh');
      hd.appendChild(arEl({ parts: [[l.ch]] }));
      hd.appendChild(h('small', null, l.n));
      g.appendChild(hd);
    });
    g.appendChild(h('div', 'corner', 'Ligne'));
    for (var r = 0; r < NROWS; r++) {
      for (var c = 0; c < 3; c++) {
        (function (r, c) {
          var item = GRID[r][c];
          var b = h('button', 'cell' + (item.kind === 'word' ? ' word' : ''));
          b.type = 'button';
          b.id = 'cell-' + r + '-' + c;
          b.setAttribute('aria-label', item.tr);
          b.appendChild(arEl(item));
          b.addEventListener('click', function () { state.interacted = true; stopReading(); selectCell(r, c, true); });
          g.appendChild(b);
        })(r, c);
      }
      var lab = h('div', 'rowlab');
      if (r < ROWS.length) { lab.appendChild(h('b', null, ROWS[r].name)); lab.appendChild(h('span', null, ROWS[r].hint)); }
      else { lab.appendChild(h('b', null, 'Mots')); lab.appendChild(h('span', null, 'à lire en entier')); }
      g.appendChild(lab);
    }
  }

  function selectCell(r, c, withSound) {
    if (state.sel) {
      var old = $('cell-' + state.sel.r + '-' + state.sel.c);
      if (old) old.classList.remove('on');
    }
    state.sel = { r: r, c: c };
    var cell = $('cell-' + r + '-' + c);
    if (cell) cell.classList.add('on');
    var item = GRID[r][c];
    var dAr = $('dAr');
    dAr.innerHTML = '';
    item.parts.forEach(function (p) { dAr.appendChild(h('span', p[1] ? 'lv' : null, p[0])); });
    $('dTr').textContent = item.tr;
    $('dDsc').textContent = item.desc;
    if (withSound) speakItem(item, 0.7);
  }

  function setReading(on) {
    state.reading = on;
    $('stopRead').disabled = !on;
    $('readCols').disabled = on;
    $('readRows').disabled = on;
    $('aRead').disabled = on;
    $('aStop').disabled = !on;
  }
  function stopReading() {
    if (!state.reading) return;
    setReading(false);
    state.current = null;
    setSpeaking(false);
    try { synth && synth.cancel(); } catch (e) {}
  }
  function readSequence(seq) {
    if (!canSpeak) return;
    setReading(true);
    var k = 0;
    (function step() {
      if (!state.reading || k >= seq.length) { setReading(false); return; }
      var pos = seq[k++];
      selectCell(pos[0], pos[1], false);
      var cell = $('cell-' + pos[0] + '-' + pos[1]);
      if (cell && cell.scrollIntoView) cell.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      speak(GRID[pos[0]][pos[1]].text, 0.7, function (ok) {
        if (!state.reading) return;
        if (!ok) { setReading(false); return; }
        setTimeout(step, 350);
      });
    })();
  }
  function colsSeq() {
    var s = [];
    for (var c = 0; c < 3; c++) for (var r = 0; r < NROWS; r++) s.push([r, c]);
    return s;
  }
  function rowsSeq() {
    var s = [];
    for (var r = 0; r < NROWS; r++) for (var c = 0; c < 3; c++) s.push([r, c]);
    return s;
  }

  /* ---------- Mode alphabet ---------- */
  function buildAlpha() {
    var g = $('agrid');
    g.innerHTML = '';
    ALPHA.forEach(function (l, i) {
      var b = h('button', 'lbtn');
      b.type = 'button';
      b.id = 'letter-' + i;
      b.setAttribute('aria-label', l.n);
      b.appendChild(arEl({ parts: [[l.disp]] }));
      b.appendChild(h('small', null, l.n));
      b.addEventListener('click', function () { state.interacted = true; stopReading(); selectLetter(i, true); });
      g.appendChild(b);
    });
  }

  function markVar(k) {
    Array.prototype.forEach.call($('vgrid').children, function (c, j) { c.classList.toggle('on', j === k); });
  }

  function selectLetter(i, withSound) {
    var l = ALPHA[i];
    if (state.letter != null) {
      var old = $('letter-' + state.letter);
      if (old) old.classList.remove('on');
    }
    state.letter = i;
    $('letter-' + i).classList.add('on');
    $('aBig').textContent = l.disp;
    $('aName').textContent = l.n;
    $('aDsc').textContent = 'Son : ' + l.tr + (l.nj ? ' · ne se lie pas à la lettre suivante' : '');

    var f = $('forms');
    f.innerHTML = '';
    [['Isolée', l.disp], ['Initiale', l.disp + ZWJ], ['Médiane', ZWJ + l.disp + ZWJ], ['Finale', ZWJ + l.disp]].forEach(function (p) {
      var c = h('div', 'form');
      c.appendChild(arEl({ parts: [[p[1]]] }));
      c.appendChild(h('small', null, p[0]));
      f.appendChild(c);
    });

    var vg = $('vgrid');
    vg.innerHTML = '';
    var items = variationsFor(l);
    state.alphaItems = items;
    items.forEach(function (it, k) {
      var b = h('button', 'vcard');
      b.type = 'button';
      b.setAttribute('aria-label', it.tr + ', ' + it.desc);
      b.appendChild(arEl(it));
      b.appendChild(h('span', 'tr', it.tr));
      b.appendChild(h('small', null, it.desc));
      b.addEventListener('click', function () { state.interacted = true; stopReading(); markVar(k); speakItem(it, 0.7); });
      vg.appendChild(b);
    });
    if (withSound) speak(l.disp, 0.7, null);
  }

  function readAlpha() {
    if (!canSpeak || !state.alphaItems) return;
    var items = state.alphaItems;
    setReading(true);
    var k = 0;
    (function step() {
      if (!state.reading || k >= items.length) { setReading(false); return; }
      var idx = k++;
      markVar(idx);
      var card = $('vgrid').children[idx];
      if (card && card.scrollIntoView) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      speak(items[idx].text, 0.7, function (ok) {
        if (!state.reading) return;
        if (!ok) { setReading(false); return; }
        setTimeout(step, 350);
      });
    })();
  }

  /* ---------- Modes quiz ---------- */
  function pickOne(arr) { return arr.length ? arr[Math.floor(Math.random() * arr.length)] : null; }

  function buildQuiz() {
    return shuffle(state.mode === 'word' ? QUIZ_WORDS : SYLS).slice(0, 10);
  }

  function optionsFor(t) {
    if (t.kind === 'word') {
      var others = shuffle(QUIZ_WORDS.filter(function (x) { return x.text !== t.text; })).slice(0, 3);
      return shuffle([t].concat(others));
    }
    var sameLetter = SYLS.filter(function (x) { return x.c === t.c && x.rowId !== t.rowId; });
    var sameRow = SYLS.filter(function (x) { return x.rowId === t.rowId && x.c !== t.c; });
    var chosen = [t];
    function add(x) { if (x && chosen.every(function (y) { return y.text !== x.text; })) chosen.push(x); }
    add(pickOne(sameLetter));
    add(pickOne(sameRow));
    add(pickOne(sameLetter));
    var guard = 0;
    while (chosen.length < 4 && guard++ < 50) add(pickOne(SYLS));
    return shuffle(chosen);
  }

  function startRound(list) {
    state.queue = list;
    state.i = 0;
    state.score = 0;
    state.mistakes = [];
    $('stage').hidden = false;
    $('result').hidden = true;
    renderQuestion();
  }
  function cur() { return state.queue[state.i]; }

  function updateProgress() {
    var total = state.queue.length;
    $('qCount').textContent = 'Question ' + (state.i + 1) + ' / ' + total;
    $('scoreTxt').textContent = 'Score ' + state.score;
    $('barFill').style.width = ((state.i + (state.answered ? 1 : 0)) / total * 100) + '%';
  }

  function renderQuestion() {
    var t = cur();
    state.answered = false;
    updateProgress();
    $('feedback').hidden = true;
    $('feedback').innerHTML = '';
    $('next').hidden = true;
    $('play').setAttribute('aria-label', t.kind === 'word' ? 'Écouter le mot' : 'Écouter la syllabe');
    $('prompt').textContent = t.kind === 'word' ? 'Quel mot entendez-vous ?' : 'Quelle syllabe entendez-vous ?';

    var fb = $('fallback');
    if (!canSpeak) { fb.hidden = false; fb.textContent = t.tr; } else { fb.hidden = true; }

    var opts = $('opts');
    opts.innerHTML = '';
    optionsFor(t).forEach(function (o, idx) {
      var b = h('button', 'opt');
      b.type = 'button';
      b.dataset.text = o.text;
      b.appendChild(h('span', 'k', String(idx + 1)));
      b.appendChild(arEl(o));
      b.addEventListener('click', function () { state.interacted = true; choose(b, o); });
      opts.appendChild(b);
    });

    if (state.interacted) setTimeout(function () { speakItem(t, 0.75); }, 200);
  }

  function choose(btn, o) {
    if (state.answered) return;
    var t = cur();
    var ok = o.text === t.text;
    Array.prototype.forEach.call($('opts').children, function (b) {
      b.disabled = true;
      if (b.dataset.text === t.text) b.classList.add('good');
      else if (b === btn) b.classList.add('bad');
    });
    state.answered = true;
    if (ok) state.score++; else state.mistakes.push(t);
    updateProgress();

    var fb = $('feedback');
    fb.className = 'feedback ' + (ok ? 'good' : 'bad');
    fb.innerHTML = '';
    fb.appendChild(h('p', 'verdict', ok ? 'Bonne réponse !' : 'Pas tout à fait.'));
    var line = h('div', 'fb-line');
    line.appendChild(arEl(t));
    var txt = h('div');
    txt.appendChild(h('div', 'tr', t.tr));
    txt.appendChild(h('div', 'muted', t.desc));
    line.appendChild(txt);
    fb.appendChild(line);
    if (!ok) {
      var yours = h('p', 'muted', 'Vous avez choisi : ' + o.tr + (o.kind === 'syl' ? ' (' + o.desc + ')' : ''));
      fb.appendChild(yours);
    }
    fb.hidden = false;

    var nx = $('next');
    nx.textContent = state.i === state.queue.length - 1 ? 'Voir le résultat' : 'Question suivante';
    nx.hidden = false;
    nx.focus();
  }

  function goNext() {
    if (!state.answered) return;
    if (state.i >= state.queue.length - 1) { showResult(); return; }
    state.i++;
    renderQuestion();
  }

  function showResult() {
    try { synth && synth.cancel(); } catch (e) {}
    setSpeaking(false);
    $('stage').hidden = true;
    $('result').hidden = false;
    var total = state.queue.length;
    $('barFill').style.width = '100%';
    $('finalScore').textContent = state.score;
    $('finalTotal').textContent = total;
    var ratio = state.score / total;
    $('finalMsg').textContent = ratio === 1 ? 'Sans faute. Votre oreille est bien réglée.'
      : ratio >= 0.7 ? 'Très bien. Quelques sons à réécouter.'
      : ratio >= 0.4 ? 'Pas mal. Retournez au tableau, écoutez les sons ci-dessous et recommencez.'
      : 'Prenez votre temps : écoutez chaque syllabe dans le tableau, y compris en mode lent, puis réessayez.';
    var list = $('missList');
    list.innerHTML = '';
    $('missBlock').hidden = !state.mistakes.length;
    $('retry').hidden = !state.mistakes.length;
    state.mistakes.forEach(function (t) {
      var li = h('li');
      var left = h('span', 'txt');
      left.appendChild(arEl(t));
      var info = h('span');
      info.appendChild(h('b', null, t.tr));
      info.appendChild(document.createElement('br'));
      info.appendChild(h('span', 'muted', t.desc));
      left.appendChild(info);
      var b = h('button', 'btn ghost', 'Écouter');
      b.type = 'button';
      b.setAttribute('aria-label', 'Écouter ' + t.tr);
      b.addEventListener('click', function () { state.interacted = true; speakItem(t, 0.7); });
      li.appendChild(left);
      li.appendChild(b);
      list.appendChild(li);
    });
    window.scrollTo(0, 0);
  }

  /* ---------- Modes ---------- */
  function setMode(m) {
    stopReading();
    try { synth && synth.cancel(); } catch (e) {}
    setSpeaking(false);
    state.mode = m;
    $('mStudy').setAttribute('aria-pressed', String(m === 'study'));
    $('mAlpha').setAttribute('aria-pressed', String(m === 'alpha'));
    $('mSyl').setAttribute('aria-pressed', String(m === 'syl'));
    $('mWord').setAttribute('aria-pressed', String(m === 'word'));
    $('study').hidden = m !== 'study';
    $('alpha').hidden = m !== 'alpha';
    var quiz = m === 'syl' || m === 'word';
    $('quizWrap').hidden = !quiz;
    if (quiz) startRound(buildQuiz());
  }

  /* ---------- Événements ---------- */
  $('mStudy').addEventListener('click', function () { state.interacted = true; setMode('study'); });
  $('mAlpha').addEventListener('click', function () { state.interacted = true; setMode('alpha'); });
  $('mSyl').addEventListener('click', function () { state.interacted = true; setMode('syl'); });
  $('aHear').addEventListener('click', function () { state.interacted = true; stopReading(); speak(ALPHA[state.letter].disp, 0.7, null); });
  $('aRead').addEventListener('click', function () { state.interacted = true; readAlpha(); });
  $('aStop').addEventListener('click', stopReading);
  $('mWord').addEventListener('click', function () { state.interacted = true; setMode('word'); });
  $('readCols').addEventListener('click', function () { state.interacted = true; readSequence(colsSeq()); });
  $('readRows').addEventListener('click', function () { state.interacted = true; readSequence(rowsSeq()); });
  $('stopRead').addEventListener('click', stopReading);
  $('play').addEventListener('click', function () { state.interacted = true; speakItem(cur(), 0.75); });
  $('slow').addEventListener('click', function () { state.interacted = true; speakItem(cur(), 0.45); });
  $('next').addEventListener('click', function () { state.interacted = true; goNext(); });
  $('again').addEventListener('click', function () { state.interacted = true; startRound(buildQuiz()); });
  $('retry').addEventListener('click', function () { state.interacted = true; startRound(shuffle(state.mistakes)); });
  $('voiceSel').addEventListener('change', function () {
    var id = $('voiceSel').value;
    var vs = synth.getVoices();
    for (var k = 0; k < vs.length; k++) if (vs[k].voiceURI === id) state.voice = vs[k];
    state.interacted = true;
    if (state.mode === 'study' && state.sel) speakItem(GRID[state.sel.r][state.sel.c], 0.7);
    else if (state.mode === 'alpha') speak(ALPHA[state.letter].disp, 0.7, null);
    else if ((state.mode === 'syl' || state.mode === 'word') && cur()) speakItem(cur(), 0.75);
  });

  document.addEventListener('keydown', function (e) {
    state.interacted = true;
    var tag = e.target && e.target.tagName;
    if (tag === 'SELECT' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (state.mode === 'study' || state.mode === 'alpha' || $('stage').hidden) return;
    if (!state.answered && /^[1-4]$/.test(e.key)) {
      var b = $('opts').children[Number(e.key) - 1];
      if (b) b.click();
    } else if (e.key === 'r' || e.key === 'R') {
      speakItem(cur(), 0.75);
    }
  });

  /* ---------- Démarrage ---------- */
  buildGrid();
  selectCell(0, 0, false);
  buildAlpha();
  selectLetter(1, false);
  if (!canSpeak) {
    $('noSpeech').hidden = false;
    $('readCols').disabled = true;
    $('readRows').disabled = true;
    $('aRead').disabled = true;
  } else {
    loadVoices();
    if (typeof synth.addEventListener === 'function') synth.addEventListener('voiceschanged', loadVoices);
    else synth.onvoiceschanged = loadVoices;
  }
})();
