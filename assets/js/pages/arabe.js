(function () {
  'use strict';

  /* Données et voix : voir arabe-core.js */
  var A = window.Arabe;
  var LETTERS = A.LETTERS, ROWS = A.ROWS, GRID = A.GRID, SYLS = A.SYLS, WORD_ITEMS = A.WORD_ITEMS, QUIZ_WORDS = A.QUIZ_WORDS;
  var NROWS = A.NROWS, ALPHA = A.ALPHA, ZWJ = A.ZWJ;
  var variationsFor = A.variationsFor, h = A.h, arEl = A.arEl, shuffle = A.shuffle;
  var $ = function (id) { return document.getElementById(id); };
  var state = { mode: 'study', queue: [], i: 0, score: 0, answered: false, mistakes: [], interacted: false, reading: false, sel: null };

  function setSpeaking(on) { $('player').classList.toggle('speaking', on); }
  function showErr(msg) {
    ['errStudy', 'errQuiz', 'errAlpha'].forEach(function (id) {
      var el = $(id);
      el.textContent = msg || '';
      el.hidden = !msg;
    });
  }
  var voice = A.createVoice({ onSpeaking: setSpeaking, onError: showErr, onVoiceChange: onVoiceChange });
  var canSpeak = voice.canSpeak;
  function speak(text, rate, done) { voice.speak(text, rate, done); }
  function speakItem(item, rate) { voice.speak(item.text, rate, null); }


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
    voice.stop();
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
    voice.stop();
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
    voice.stop();
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
  /* Après un changement de voix : on la fait entendre sur l'élément courant */
  function onVoiceChange() {
    state.interacted = true;
    if (state.mode === 'study' && state.sel) speakItem(GRID[state.sel.r][state.sel.c], 0.7);
    else if (state.mode === 'alpha') speak(ALPHA[state.letter].disp, 0.7, null);
    else if ((state.mode === 'syl' || state.mode === 'word') && cur()) speakItem(cur(), 0.75);
  }

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
    voice.bind({ select: $('voiceSel'), field: $('voiceField'), notice: $('noArabic') });
  }
})();
