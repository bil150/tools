/* Dictée : on entend une syllabe ou un mot et on l'écrit en assemblant des morceaux d'écriture
   arabe dans le bon ordre. Pas besoin de clavier arabe. */
(function () {
  'use strict';

  var A = window.Arabe;
  var $ = function (id) { return document.getElementById(id); };
  var h = A.h;
  var state = { mode: 'syl', queue: [], i: 0, score: 0, answered: false, mistakes: [], placed: [], tiles: [], interacted: false };

  var voice = A.createVoice({
    onSpeaking: function (on) { $('player').classList.toggle('speaking', on); },
    onError: function (msg) { $('err').textContent = msg || ''; $('err').hidden = !msg; }
  });

  function cur() { return state.queue[state.i]; }
  function pool() { return state.mode === 'word' ? A.QUIZ_WORDS : A.SYLS; }
  function buildRound() { return A.shuffle(pool()).slice(0, 10); }

  /* ---------- Morceaux ----------
     Les morceaux de la réponse, plus deux ou trois intrus pris dans d'autres éléments. */
  function tilesFor(item) {
    var own = item.parts.map(function (p, k) { return { id: 'o' + k, text: p[0] }; });
    var seen = {};
    own.forEach(function (t) { seen[t.text] = true; });
    var decoys = [];
    A.shuffle(pool()).forEach(function (o) {
      o.parts.forEach(function (p) {
        if (decoys.length < 3 && !seen[p[0]]) { seen[p[0]] = true; decoys.push({ id: 'd' + decoys.length, text: p[0] }); }
      });
    });
    return A.shuffle(own.concat(decoys));
  }

  function tileButton(t, onClick) {
    var b = h('button', 'tile');
    b.type = 'button';
    b.appendChild(h('span', 'ar', t.text));
    b.addEventListener('click', onClick);
    return b;
  }

  /* ---------- Affichage ---------- */
  function renderTiles() {
    var line = $('line'), bank = $('bank');
    line.innerHTML = ''; bank.innerHTML = '';
    state.placed.forEach(function (t) {
      var b = tileButton(t, function () { if (!state.answered) unplace(t); });
      b.disabled = state.answered;
      line.appendChild(b);
    });
    if (!state.placed.length) line.appendChild(h('span', 'placeholder', 'Touchez les morceaux dans l’ordre de lecture'));
    state.tiles.forEach(function (t) {
      var used = state.placed.indexOf(t) >= 0;
      var b = tileButton(t, function () { if (!state.answered) place(t); });
      b.disabled = used || state.answered;
      b.classList.toggle('used', used);
      bank.appendChild(b);
    });
    $('check').disabled = state.answered || !state.placed.length;
    $('undo').disabled = state.answered || !state.placed.length;
  }
  function place(t) { state.interacted = true; if (state.placed.indexOf(t) < 0) state.placed.push(t); renderTiles(); }
  function unplace(t) { state.placed.splice(state.placed.indexOf(t), 1); renderTiles(); }

  function updateProgress() {
    var total = state.queue.length;
    $('qCount').textContent = 'Question ' + (state.i + 1) + ' / ' + total;
    $('scoreTxt').textContent = 'Score ' + state.score;
    $('barFill').style.width = ((state.i + (state.answered ? 1 : 0)) / total * 100) + '%';
  }

  function render() {
    var t = cur();
    state.answered = false; state.placed = []; state.tiles = tilesFor(t);
    updateProgress();
    $('feedback').hidden = true; $('feedback').innerHTML = '';
    $('next').hidden = true; $('check').hidden = false; $('skip').hidden = false; $('undo').hidden = false;
    $('prompt').textContent = state.mode === 'word' ? 'Écrivez le mot que vous entendez.' : 'Écrivez la syllabe que vous entendez.';
    $('line').classList.remove('good', 'bad');
    renderTiles();
    if (state.interacted) setTimeout(function () { voice.speak(t.text, 0.7, null); }, 200);
  }

  function finish(correct, skipped) {
    if (state.answered) return;
    var t = cur();
    state.answered = true;
    if (correct) state.score++; else state.mistakes.push(t);
    updateProgress();
    $('line').classList.add(correct ? 'good' : 'bad');
    var fb = $('feedback');
    fb.className = 'feedback ' + (correct ? 'good' : 'bad');
    fb.innerHTML = '';
    fb.appendChild(h('p', 'verdict', correct ? 'Bonne écriture !' : (skipped ? 'Voici la réponse.' : 'Pas tout à fait.')));
    var line = h('div', 'fb-line');
    line.appendChild(A.arEl(t));
    var txt = h('div');
    txt.appendChild(h('div', 'tr', t.tr));
    txt.appendChild(h('div', 'dsc', t.desc));
    line.appendChild(txt);
    fb.appendChild(line);
    fb.hidden = false;
    $('check').hidden = true; $('skip').hidden = true; $('undo').hidden = true;
    var nx = $('next');
    nx.textContent = state.i === state.queue.length - 1 ? 'Voir le résultat' : 'Question suivante';
    nx.hidden = false;
    renderTiles();
    nx.focus();
  }

  function check() {
    if (state.answered || !state.placed.length) return;
    var written = state.placed.map(function (p) { return p.text; }).join('');
    finish(written === cur().text, false);
  }

  function next() {
    if (!state.answered) return;
    if (state.i >= state.queue.length - 1) { showResult(); return; }
    state.i++;
    render();
  }

  function showResult() {
    voice.stop();
    $('stage').hidden = true; $('result').hidden = false;
    var total = state.queue.length, ratio = state.score / total;
    $('barFill').style.width = '100%';
    $('finalScore').textContent = state.score;
    $('finalTotal').textContent = total;
    $('finalMsg').textContent = ratio === 1 ? 'Sans faute.'
      : ratio >= 0.7 ? 'Très bien. Quelques écritures à revoir.'
      : ratio >= 0.4 ? 'Pas mal. Retournez au tableau des syllabes, puis recommencez.'
      : 'Prenez votre temps : écoutez chaque syllabe dans le tableau, puis réessayez.';
    var list = $('missList');
    list.innerHTML = '';
    $('missBlock').hidden = !state.mistakes.length;
    $('retry').hidden = !state.mistakes.length;
    state.mistakes.forEach(function (t) {
      var li = h('li'), left = h('span', 'txt'), info = h('span');
      left.appendChild(A.arEl(t));
      info.appendChild(h('b', null, t.tr));
      info.appendChild(document.createElement('br'));
      info.appendChild(h('span', 'dsc', t.desc));
      left.appendChild(info);
      var b = h('button', 'btn ghost', 'Écouter');
      b.type = 'button';
      b.addEventListener('click', function () { state.interacted = true; voice.speak(t.text, 0.7, null); });
      li.appendChild(left); li.appendChild(b);
      list.appendChild(li);
    });
    window.scrollTo(0, 0);
  }

  function start(queue) {
    state.queue = queue; state.i = 0; state.score = 0; state.mistakes = [];
    $('stage').hidden = false; $('result').hidden = true;
    render();
  }
  function setMode(m) {
    voice.stop();
    state.mode = m;
    $('mSyl').setAttribute('aria-pressed', String(m === 'syl'));
    $('mWord').setAttribute('aria-pressed', String(m === 'word'));
    start(buildRound());
  }

  function init() {
    if (!voice.canSpeak) $('noSpeech').hidden = false;
    else voice.bind({ select: $('voiceSel'), field: $('voiceField'), notice: $('noArabic'), onVoiceChange: null });
    $('mSyl').addEventListener('click', function () { state.interacted = true; setMode('syl'); });
    $('mWord').addEventListener('click', function () { state.interacted = true; setMode('word'); });
    $('play').addEventListener('click', function () { state.interacted = true; voice.speak(cur().text, 0.7, null); });
    $('slow').addEventListener('click', function () { state.interacted = true; voice.speak(cur().text, 0.45, null); });
    $('check').addEventListener('click', check);
    $('skip').addEventListener('click', function () { state.interacted = true; finish(false, true); });
    $('undo').addEventListener('click', function () { state.placed.pop(); renderTiles(); });
    $('next').addEventListener('click', next);
    $('again').addEventListener('click', function () { state.interacted = true; start(buildRound()); });
    $('retry').addEventListener('click', function () { state.interacted = true; start(A.shuffle(state.mistakes)); });
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey || $('stage').hidden) return;
      var tag = e.target && e.target.tagName;
      if (tag === 'SELECT') return;
      if (e.key === 'Enter' && !state.answered && state.placed.length && tag !== 'BUTTON') check();
      else if (e.key === 'Backspace' && !state.answered) { state.placed.pop(); renderTiles(); }
      else if ((e.key === 'r' || e.key === 'R') && cur()) voice.speak(cur().text, 0.7, null);
    });
    start(buildRound());
  }

  init();
})();
