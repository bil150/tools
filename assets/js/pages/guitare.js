/* Guitare : assemble les modules communs de assets/js/musique/ (voir core.js) et ajoute ce qui est propre à la guitare :
   la feuille des accords ouverts et la main gauche de la guitare virtuelle. */
(function () {
  'use strict';

  var M = window.Musique, G = M.instruments.guitar, $ = M.$, el = M.el, clamp = M.clamp;
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
  /* La main gauche a deux modes : « accord » (un accord du mini sélecteur, ou null pour les cordes à vide) et « manche »
     (une grille où l'on pose les doigts soi-même, avec des flèches pour avancer sur le manche). */
  var KEY = 'tools:guitare:main-gauche';
  var left = { mode: 'chord', hold: 'keep', chord: CHORDS.min[1], frets: [0, 0, 0, 0, 0, 0], base: 1, prev: {}, btns: [] };
  var saved = M.store.get(KEY, null);
  if (saved && saved.mode === 'neck') left.mode = 'neck';
  left.sound = saved && typeof saved.sound === 'boolean' ? saved.sound : !!(window.matchMedia && matchMedia('(pointer: fine)').matches); // souris : la note sonne à l'appui
  if (saved && saved.hold === 'touch') left.hold = 'touch';   // 'keep' : le doigt reste posé ; 'touch' : seulement pendant l'appui
  var picker = el('div', 'vg-pick'), modeBox = el('div', 'field small'), modeSeg = el('div', 'seg'), holdBox = el('div', 'field small'), holdSeg = el('div', 'seg'), soundBox = el('div', 'field small'), soundSeg = el('div', 'seg'), pad;
  picker.setAttribute('role', 'group');
  picker.setAttribute('aria-label', 'Accord de la main gauche');

  /* Mini sélecteur posé contre le début du manche : une ligne par fondamentale, trois colonnes (majeur, mineur, 7e), plus « À vide » */
  function renderPicker() {
    var open = el('button', 'vg-ch open', 'À vide');
    left.btns = [];
    picker.replaceChildren();
    CHORDS.maj.forEach(function (_, i) {
      [CHORDS.maj[i], CHORDS.min[i], CHORDS.dom7[i]].forEach(function (c) {
        var b = el('button', 'vg-ch', M.chordTitle(c));
        b.type = 'button';
        b.setAttribute('aria-label', 'Accord ' + M.chordTitle(c));
        b.addEventListener('click', function () { setLeft(c); });
        picker.appendChild(b);
        left.btns.push({ btn: b, c: c });
      });
    });
    open.type = 'button';
    open.addEventListener('click', function () { setLeft(null); });
    picker.appendChild(open);
    left.btns.push({ btn: open, c: null });
    syncLeft();
  }

  function syncLeft() {
    left.btns.forEach(function (x) { x.btn.setAttribute('aria-pressed', String(x.c === left.chord)); });
    M.setPressed(modeSeg.querySelectorAll('button'), function (b) { return b.getAttribute('data-m') === left.mode; });
    M.setPressed(holdSeg.querySelectorAll('button'), function (b) { return b.getAttribute('data-h') === left.hold; });
    picker.hidden = left.mode !== 'chord';
    M.setPressed(soundSeg.querySelectorAll('button'), function (b) { return (b.getAttribute('data-s') === 'on') === left.sound; });
    holdBox.hidden = soundBox.hidden = left.mode !== 'neck';
  }

  function setLeft(c) {
    left.chord = c;
    syncLeft();
    pad.render();
  }

  function store() { M.store.set(KEY, { mode: left.mode, hold: left.hold, sound: left.sound }); }

  /* Maintenu / touché : en changeant, la grille repart des cordes à vide */
  function setHold(h) {
    if (h === left.hold) return;
    left.hold = h;
    left.frets = [0, 0, 0, 0, 0, 0];
    left.prev = {};
    store();
    syncLeft();
    pad.render();
  }

  /* En passant d'un mode à l'autre, la grille reprend le doigté de l'accord en cours (ou les cordes à vide) */
  function setMode(m) {
    if (m === left.mode) return;
    if (m === 'neck') {
      left.frets = left.chord && left.hold === 'keep' ? left.chord.frets.slice() : [0, 0, 0, 0, 0, 0];
      left.prev = {};
      left.base = clamp(left.chord ? left.chord.base : 1, 1, pad.maxBase());
    }
    left.mode = m;
    store();
    syncLeft();
    pad.render();
  }

  function fretOf(s) { return left.mode === 'neck' ? left.frets[s] : left.chord ? left.chord.frets[s] : 0; }

  function initVirtual() {
    var lab = el('span', 'lab', 'Main gauche'), id = M.uid('vgm');
    lab.id = id;
    modeSeg.setAttribute('role', 'group');
    modeSeg.setAttribute('aria-labelledby', id);
    [['chord', 'Accord'], ['neck', 'Manche']].forEach(function (it) {
      var b = el('button', '', it[1]);
      b.type = 'button';
      b.setAttribute('data-m', it[0]);
      b.addEventListener('click', function () { setMode(it[0]); });
      modeSeg.appendChild(b);
    });
    modeBox.appendChild(lab);
    modeBox.appendChild(modeSeg);
    var hlab = el('span', 'lab', 'Doigts'), hid = M.uid('vgh'), inputs = document.createDocumentFragment();
    hlab.id = hid;
    holdSeg.setAttribute('role', 'group');
    holdSeg.setAttribute('aria-labelledby', hid);
    [['keep', 'Maintenu'], ['touch', 'Touché']].forEach(function (it) {
      var b = el('button', '', it[1]);
      b.type = 'button';
      b.setAttribute('data-h', it[0]);
      b.addEventListener('click', function () { setHold(it[0]); });
      holdSeg.appendChild(b);
    });
    holdBox.appendChild(hlab);
    holdBox.appendChild(holdSeg);
    inputs.appendChild(modeBox);
    var slab = el('span', 'lab', 'Son à l’appui'), sid = M.uid('vgs');
    slab.id = sid;
    soundSeg.setAttribute('role', 'group');
    soundSeg.setAttribute('aria-labelledby', sid);
    [['off', 'Non'], ['on', 'Oui']].forEach(function (it) {
      var b = el('button', '', it[1]);
      b.type = 'button';
      b.setAttribute('data-s', it[0]);
      b.addEventListener('click', function () { left.sound = it[0] === 'on'; store(); syncLeft(); });
      soundSeg.appendChild(b);
    });
    soundBox.appendChild(slab);
    soundBox.appendChild(soundSeg);
    inputs.appendChild(holdBox);
    inputs.appendChild(soundBox);
    pad = M.StringPad.mount($('padHost'), {
      id: 'guitare', title: 'Guitare virtuelle', strings: 6, side: picker, inputs: inputs,
      fret: fretOf,
      neck: function () { return left.mode === 'neck' ? { frets: left.frets, base: left.base, barre: null } : left.chord; },
      fretting: {
        active: function () { return left.mode === 'neck'; },
        momentary: function () { return left.hold === 'touch'; },
        sound: function () { return left.sound; },
        base: function () { return left.base; },
        shift: function (d) { left.base = clamp(left.base + d, 1, pad.maxBase()); },
        set: function (s, f) {
          if (left.hold === 'touch') { if (!(s in left.prev)) left.prev[s] = left.frets[s]; left.frets[s] = f; }
          else left.frets[s] = left.frets[s] === f ? 0 : f; // maintenu : le même appui relève le doigt
        },
        release: function (s) { if (s in left.prev) { left.frets[s] = left.prev[s]; delete left.prev[s]; } }
      },
      label: function (s) {
        var f = fretOf(s), n;
        if (left.mode === 'neck') return f < 0 ? null : M.fmt(M.ROOTS[(OPEN[s] + f) % 12]);
        n = left.chord ? G.toneAt(left.chord, s) : OPEN_NOTES[s];
        return n ? M.fmt(n) : null;
      },
      sound: function (s, f, vol, delay) { G.pluck(M.freqOf(OPEN[s] + f), delay, vol); }
    });
    M.onNotation(function () { renderPicker(); pad.render(); });
    renderPicker();
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
