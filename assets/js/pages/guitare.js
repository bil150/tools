/* Guitare : assemble les modules communs de assets/js/musique/ (voir core.js) et ajoute ce qui est propre à la guitare :
   la feuille des accords ouverts et la main gauche de la guitare virtuelle. */
(function () {
  'use strict';

  var M = window.Musique, G = M.instruments.guitar, $ = M.$, el = M.el;
  var OPEN = G.OPEN, OPEN_NOTES = G.OPEN_NOTES, CHORDS = G.CHORDS;
  var ALL_CHORDS = CHORDS.maj.concat(CHORDS.min, CHORDS.dom7);

  /* ================= Onglet Accords : la feuille d'accords ouverts ================= */
  var selected = ALL_CHORDS[0], sheetBtns = []; // sheetBtns : { btn, c } pour l'état « pressé »

  function renderSheet() {
    var groups = { maj: 'chordsMaj', min: 'chordsMin', dom7: 'chordsDom7' };
    sheetBtns = [];
    Object.keys(groups).forEach(function (g) {
      var host = $(groups[g]);
      host.replaceChildren();
      CHORDS[g].forEach(function (c) {
        var b = el('button', 'chord-btn');
        b.type = 'button';
        b.setAttribute('aria-pressed', String(c === selected));
        b.setAttribute('aria-label', 'Accord ' + M.chordTitle(c));
        b.appendChild(el('b', '', M.chordTitle(c)));
        b.appendChild(G.diagram(c, false));
        b.addEventListener('click', function () { selectChord(c, true); });
        host.appendChild(b);
        sheetBtns.push({ btn: b, c: c });
      });
    });
  }

  function renderDetail() {
    var c = selected, big = $('chordBig'), grid = $('chordStrings'), s, cell, t;
    $('chordName').textContent = M.chordTitle(c);
    $('chordNotes').textContent = 'Notes de l’accord : ' + c.tones.map(M.fmt).join(' · ');
    big.replaceChildren(G.diagram(c, true));
    grid.replaceChildren();
    for (s = 0; s < 6; s++) {
      cell = el('div', 'sc' + (c.frets[s] < 0 ? ' off' : ''));
      cell.appendChild(el('small', '', M.fmt(OPEN_NOTES[s])));
      cell.appendChild(el('b', '', c.frets[s] < 0 ? '×' : String(c.frets[s])));
      t = c.frets[s] < 0 ? null : G.toneAt(c, s);
      var nt = el('span', 'nt', t ? M.fmt(t) : '–');
      if (t) nt.style.background = 'var(--n' + t.l + ')';
      cell.appendChild(nt);
      grid.appendChild(cell);
    }
  }

  function selectChord(c, play) {
    selected = c;
    renderDetail();
    sheetBtns.forEach(function (x) { x.btn.setAttribute('aria-pressed', String(x.c === c)); });
    if (play) G.strum(G.freqs(c), 0.045);
  }

  function initSheet() {
    $('chordStrum').addEventListener('click', function () { G.strum(G.freqs(selected), 0.045); });
    $('chordArp').addEventListener('click', function () { G.strum(G.freqs(selected), 0.22); });
    $('chordBig').addEventListener('click', function (e) {
      var s = e.target.getAttribute && e.target.getAttribute('data-s');
      if (s === null || s === undefined || !e.target.classList.contains('cd-hit')) return;
      s = Number(s);
      G.pluck(M.freqOf(OPEN[s] + selected.frets[s]), 0);
      var line = $('chordBig').querySelector('.cd-str[data-s="' + s + '"]');
      line.classList.add('ring');
      setTimeout(function () { line.classList.remove('ring'); }, 350);
    });
    M.onNotation(function () { renderSheet(); renderDetail(); });
    renderSheet();
    renderDetail();
  }

  /* ================= Onglet Guitare virtuelle ================= */
  var left = { chord: CHORDS.min[1], pal: [] };   // la main gauche : un accord, ou null pour les cordes à vide
  var leftHost = $('leftHost'), pad;

  function renderLeft() {
    var card = el('section', 'card'), title = el('h2'), open = el('button', 'chip-btn open', 'À vide');
    open.type = 'button';
    open.setAttribute('aria-pressed', String(!left.chord));
    open.addEventListener('click', function () { setLeft(null); });
    title.appendChild(document.createTextNode('Main gauche : '));
    title.appendChild(el('span', '', left.chord ? M.chordTitle(left.chord) : 'cordes à vide'));
    card.setAttribute('aria-label', 'Main gauche');
    card.appendChild(title);
    card.appendChild(open);
    left.pal = [];
    ['maj', 'min', 'dom7'].forEach(function (g) {
      var grid = el('div', 'chords');
      CHORDS[g].forEach(function (c) {
        var b = el('button', 'chord-btn');
        b.type = 'button';
        b.setAttribute('aria-pressed', String(c === left.chord));
        b.setAttribute('aria-label', 'Accord ' + M.chordTitle(c));
        b.appendChild(el('b', '', M.chordTitle(c)));
        b.appendChild(G.diagram(c, false));
        b.addEventListener('click', function () { setLeft(c); });
        grid.appendChild(b);
        left.pal.push({ btn: b, c: c });
      });
      card.appendChild(grid);
    });
    leftHost.replaceChildren(card);
  }

  function setLeft(c) {
    left.chord = c;
    renderLeft();
    pad.render();
    pad.strum(true, 0.7);
  }

  function initVirtual() {
    pad = M.StringPad.mount($('padHost'), {
      id: 'guitare', title: 'Guitare virtuelle', strings: 6,
      fret: function (s) { return left.chord ? left.chord.frets[s] : 0; },
      label: function (s) { var n = left.chord ? G.toneAt(left.chord, s) : OPEN_NOTES[s]; return n ? M.fmt(n) : null; },
      sound: function (s, f, vol, delay) { G.pluck(M.freqOf(OPEN[s] + f), delay, vol); }
    });
    M.onNotation(function () { renderLeft(); pad.render(); });
    renderLeft();
  }

  /* ================= Assemblage ================= */
  M.initNotation();
  initSheet();
  initVirtual();

  M.Scales.mount($('scalesHost'), {
    board: M.boards.fretboard({ open: OPEN, names: OPEN_NOTES, frets: 12, label: 'guitare' }),
    play: function (midi) { G.pluck(M.freqOf(midi), 0); }
  });

  var tuner = M.Tuner.mount($('tunerHost'), { tunings: [
    { midi: [40, 45, 50, 55, 59, 64], names: ['E', 'A', 'D', 'G', 'B', 'E'] },
    { midi: [38, 45, 50, 55, 59, 64], names: ['D', 'A', 'D', 'G', 'B', 'E'], label: 'Drop D' },
    { midi: [39, 44, 49, 54, 58, 63], names: ['E♭', 'A♭', 'D♭', 'G♭', 'B♭', 'E♭'], label: 'Demi-ton plus bas' },
    { midi: [38, 45, 50, 55, 57, 62], names: ['D', 'A', 'D', 'G', 'A', 'D'], label: 'DADGAD' }
  ] });

  var tabs;
  var composer = M.Composer.mount($('composerHost'), {
    id: 'guitare',
    instruments: [G, M.instruments.piano, M.instruments.bass],
    diagram: 'guitar',
    onIdeas: function () { tabs.open('harmonie'); }
  });
  var harmony = M.Harmony.mount($('harmonieHost'), {
    instrument: G,
    getTempo: composer.getTempo,
    onSend: function (ids) { composer.setSteps(ids); tabs.open('composer'); }
  });

  /* Quand on quitte un onglet, tout ce qui sonne s'arrête (micro, lecture, aperçus) */
  tabs = M.tabs(['accords', 'virtuelle', 'manche', 'accordeur', 'composer', 'harmonie'], function (name) {
    if (name !== 'accordeur') tuner.stop();
    if (name !== 'composer') { composer.stop(); M.Drums.stopLoop(); }
    if (name !== 'harmonie') harmony.stop();
  });
})();
