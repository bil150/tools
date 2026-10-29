/* Cartes à retourner : alphabet, syllabes et mots. La progression n'est pas conservée :
   elle sert à réviser pendant la séance. */
(function () {
  'use strict';

  var A = window.Arabe;
  var $ = function (id) { return document.getElementById(id); };
  var state = { deck: 'alpha', dir: 'ar', cards: [], i: 0, flipped: false, known: {}, review: {}, interacted: false };

  var voice = A.createVoice({
    onError: function (msg) { $('err').textContent = msg || ''; $('err').hidden = !msg; }
  });

  /* ---------- Séries ---------- */
  function build(deck) {
    if (deck === 'alpha') {
      return A.ALPHA.map(function (l) {
        return { text: l.disp, parts: [[l.disp]], tr: l.n, sound: 'Son : ' + l.tr, key: l.disp };
      });
    }
    if (deck === 'syl') {
      return A.SYLS.map(function (s) { return { text: s.text, parts: s.parts, tr: s.tr, sound: s.desc, key: s.text }; });
    }
    return A.QUIZ_WORDS.map(function (w) { return { text: w.text, parts: w.parts, tr: w.tr, sound: w.fr, key: w.text }; });
  }

  function visible() {
    var hide = $('optHide').checked;
    return state.cards.filter(function (c) { return !(hide && state.known[c.key]); });
  }
  function current() { var v = visible(); return v.length ? v[Math.min(state.i, v.length - 1)] : null; }

  /* ---------- Affichage ---------- */
  function face(kind, c) {
    var box = A.h('div', 'face ' + kind);
    if (kind === 'arabic') {
      box.appendChild(A.arEl({ parts: c.parts }, 'big'));
    } else {
      box.appendChild(A.h('div', 'tr big', c.tr));
      box.appendChild(A.h('div', 'dsc', c.sound));
    }
    return box;
  }

  function render() {
    var card = $('card'), c = current(), v = visible();
    card.innerHTML = '';
    var done = !c;
    ['again', 'know', 'prev', 'next', 'listen', 'shuffle'].forEach(function (id) { $(id).disabled = done && id !== 'shuffle'; });
    if (done) {
      card.appendChild(A.h('div', 'face done', 'Toutes les cartes sont sues. Décochez « Cacher les cartes déjà sues » pour les revoir.'));
      $('count').textContent = '';
      return;
    }
    var showArabic = (state.dir === 'ar') !== state.flipped;
    card.appendChild(face(showArabic ? 'arabic' : 'reading', c));
    card.classList.toggle('is-known', !!state.known[c.key]);
    card.classList.toggle('is-review', !!state.review[c.key]);
    card.setAttribute('aria-label', state.flipped ? 'Revenir à l’autre face' : 'Retourner la carte');
    var n = Object.keys(state.known).length, r = Object.keys(state.review).length;
    $('count').textContent = 'Carte ' + (Math.min(state.i, v.length - 1) + 1) + ' / ' + v.length + ' · sues : ' + n + ' · à revoir : ' + r;
    if (showArabic && $('optSpeak').checked && state.interacted) speak(c);
  }

  function speak(c) {
    if (!voice.canSpeak) return;
    voice.speak(c.text, 0.7, null);
  }

  /* ---------- Actions ---------- */
  function go(delta) {
    var v = visible();
    if (!v.length) return;
    state.i = (state.i + delta + v.length) % v.length;
    state.flipped = false;
    render();
  }
  function flip() { state.interacted = true; state.flipped = !state.flipped; render(); }
  function mark(kind) {
    var c = current();
    if (!c) return;
    state.interacted = true;
    if (kind === 'know') { state.known[c.key] = true; delete state.review[c.key]; }
    else { state.review[c.key] = true; delete state.known[c.key]; }
    if ($('optHide').checked && kind === 'know') { state.flipped = false; render(); return; }
    go(1);
  }
  function setDeck(d) {
    state.deck = d; state.cards = build(d); state.i = 0; state.flipped = false; state.known = {}; state.review = {};
    [].forEach.call(document.querySelectorAll('[data-deck]'), function (b) { b.setAttribute('aria-pressed', String(b.dataset.deck === d)); });
    render();
  }
  function setDir(d) {
    state.dir = d; state.flipped = false;
    [].forEach.call(document.querySelectorAll('[data-dir]'), function (b) { b.setAttribute('aria-pressed', String(b.dataset.dir === d)); });
    render();
  }

  function init() {
    if (!voice.canSpeak) {
      $('noSpeech').hidden = false;
      $('listen').hidden = true;
      $('optSpeak').parentNode.hidden = true;
    } else {
      voice.bind({ select: $('voiceSel'), field: $('voiceField'), notice: $('noArabic') });
    }
    [].forEach.call(document.querySelectorAll('[data-deck]'), function (b) { b.addEventListener('click', function () { setDeck(b.dataset.deck); }); });
    [].forEach.call(document.querySelectorAll('[data-dir]'), function (b) { b.addEventListener('click', function () { setDir(b.dataset.dir); }); });
    $('card').addEventListener('click', flip);
    $('know').addEventListener('click', function () { mark('know'); });
    $('again').addEventListener('click', function () { mark('review'); });
    $('prev').addEventListener('click', function () { state.interacted = true; go(-1); });
    $('next').addEventListener('click', function () { state.interacted = true; go(1); });
    $('listen').addEventListener('click', function () { state.interacted = true; var c = current(); if (c) speak(c); });
    $('shuffle').addEventListener('click', function () { state.interacted = true; state.cards = A.shuffle(state.cards); state.i = 0; state.flipped = false; render(); });
    $('optHide').addEventListener('change', function () { state.i = 0; render(); });
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var tag = e.target && e.target.tagName;
      if (tag === 'SELECT' || tag === 'INPUT') return;
      if (e.key === 'ArrowRight') { go(1); }
      else if (e.key === 'ArrowLeft') { go(-1); }
      else if (e.key === 's' || e.key === 'S') { mark('know'); }
      else if (e.key === 'r' || e.key === 'R') { mark('review'); }
      else if (e.key === ' ' && tag !== 'BUTTON') { e.preventDefault(); flip(); }
    });
    setDeck('alpha');
  }

  init();
})();
