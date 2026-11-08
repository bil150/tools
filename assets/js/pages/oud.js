/* Oud : assemble les modules communs de assets/js/musique/ (voir core.js). Même organisation que la page basse.
   Ajoute seulement ce qui est propre à l'oud : la main gauche de l'oud virtuel (manche à six chœurs, ou une case barrée). */
(function () {
  'use strict';

  var M = window.Musique, O = M.instruments.oud, $ = M.$, el = M.el;
  var OPEN = O.STRINGS;                                              // Do2 Fa2 La2 Ré3 Sol3 Do4 (accordage arabe)
  var OPEN_NOTES = [{ l: 0, a: 0 }, { l: 3, a: 0 }, { l: 5, a: 0 }, { l: 1, a: 0 }, { l: 4, a: 0 }, { l: 0, a: 0 }];

  /* ================= Oud virtuel ================= */
  /* Comme la guitare : la main gauche a deux modes. « Barré » : une case appuyée sur les six chœurs à la fois (mini
     sélecteur contre le manche). « Manche » : une grille où l'on pose les doigts soi-même, avec des flèches pour avancer sur
     le manche, et deux façons de tenir les cordes (maintenu ou touché). */
  var KEY = 'tools:oud:main-gauche';
  var left = { mode: 'neck', hold: 'keep', fret: 0, frets: [0, 0, 0, 0, 0, 0], base: 1, prev: {}, btns: [] };
  var saved = M.store.get(KEY, null);
  if (saved && saved.mode === 'barre') left.mode = 'barre';
  left.sound = saved && typeof saved.sound === 'boolean' ? saved.sound : !!(window.matchMedia && matchMedia('(pointer: fine)').matches); // souris : la note sonne à l'appui
  if (saved && saved.hold === 'touch') left.hold = 'touch';   // 'keep' : le doigt reste posé ; 'touch' : seulement pendant l'appui
  var picker = el('div', 'vg-pick'), pad;
  var modeBox = el('div', 'field small'), modeSeg = el('div', 'seg'), holdBox = el('div', 'field small'), holdSeg = el('div', 'seg'), soundBox = el('div', 'field small'), soundSeg = el('div', 'seg');
  picker.setAttribute('role', 'group');
  picker.setAttribute('aria-label', 'Case appuyée sur les six chœurs');

  /* Un jeu de boutons « seg » : items [valeur, texte], `attr` reçoit la valeur, `pick` est appelé au clic */
  function segment(box, seg, label, items, attr, pick) {
    var lab = el('span', 'lab', label), id = M.uid('vgb');
    lab.id = id;
    seg.setAttribute('role', 'group');
    seg.setAttribute('aria-labelledby', id);
    items.forEach(function (it) {
      var b = el('button', '', it[1]);
      b.type = 'button';
      b.setAttribute(attr, it[0]);
      b.addEventListener('click', function () { pick(it[0]); });
      seg.appendChild(b);
    });
    box.appendChild(lab);
    box.appendChild(seg);
  }

  function renderPicker() {
    var f;
    left.btns = [];
    picker.replaceChildren();
    for (f = 0; f <= 12; f++) {
      (function (f) {
        var b = el('button', 'vg-ch', String(f));
        b.type = 'button';
        b.setAttribute('aria-label', f === 0 ? 'Cordes à vide' : 'Case ' + f);
        b.addEventListener('click', function () { left.fret = f; syncLeft(); pad.render(); });
        picker.appendChild(b);
        left.btns.push({ btn: b, f: f });
      })(f);
    }
    syncLeft();
  }

  function syncLeft() {
    left.btns.forEach(function (x) { x.btn.setAttribute('aria-pressed', String(x.f === left.fret)); });
    M.setPressed(modeSeg.querySelectorAll('button'), function (b) { return b.getAttribute('data-m') === left.mode; });
    M.setPressed(holdSeg.querySelectorAll('button'), function (b) { return b.getAttribute('data-h') === left.hold; });
    picker.hidden = left.mode !== 'barre';
    M.setPressed(soundSeg.querySelectorAll('button'), function (b) { return (b.getAttribute('data-s') === 'on') === left.sound; });
    holdBox.hidden = soundBox.hidden = left.mode !== 'neck';
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

  /* En passant d'un mode à l'autre, la grille reprend la case barrée (ou les cordes à vide) */
  function setMode(m) {
    if (m === left.mode) return;
    if (m === 'neck') {
      left.frets = left.hold === 'keep' ? [left.fret, left.fret, left.fret, left.fret, left.fret, left.fret] : [0, 0, 0, 0, 0, 0];
      left.base = M.clamp(left.fret, 1, pad.maxBase());
      left.prev = {};
    }
    left.mode = m;
    store();
    syncLeft();
    pad.render();
  }

  function fretOf(s) { return left.mode === 'neck' ? left.frets[s] : left.fret; }

  function initVirtual() {
    var inputs = document.createDocumentFragment();
    segment(modeBox, modeSeg, 'Main gauche', [['neck', 'Manche'], ['barre', 'Barré']], 'data-m', setMode);
    segment(holdBox, holdSeg, 'Doigts', [['keep', 'Maintenu'], ['touch', 'Touché']], 'data-h', setHold);
    inputs.appendChild(modeBox);
    segment(soundBox, soundSeg, 'Son à l’appui', [['off', 'Non'], ['on', 'Oui']], 'data-s', function (v) { left.sound = v === 'on'; store(); syncLeft(); });
    inputs.appendChild(holdBox);
    inputs.appendChild(soundBox);
    pad = M.StringPad.mount($('padHost'), {
      id: 'oud', title: 'Oud virtuel', strings: 6, side: picker, inputs: inputs,
      fret: fretOf,
      neck: function () {
        if (left.mode === 'neck') return { frets: left.frets, base: left.base, barre: null };
        return { frets: [left.fret, left.fret, left.fret, left.fret, left.fret, left.fret], base: left.fret > 3 ? left.fret : 1, barre: left.fret > 0 ? { fret: left.fret, from: 0, to: 5 } : null };
      },
      fretting: {
        active: function () { return left.mode === 'neck'; },
        momentary: function () { return left.hold === 'touch'; },
        sound: function () { return left.sound; },
        base: function () { return left.base; },
        shift: function (d) { left.base = M.clamp(left.base + d, 1, pad.maxBase()); },
        set: function (s, f) {
          if (left.hold === 'touch') { if (!(s in left.prev)) left.prev[s] = left.frets[s]; left.frets[s] = f; }
          else left.frets[s] = left.frets[s] === f ? 0 : f; // maintenu : le même appui relève le doigt
        },
        release: function (s) { if (s in left.prev) { left.frets[s] = left.prev[s]; delete left.prev[s]; } }
      },
      label: function (s) { return M.fmt(M.ROOTS[(OPEN[s] + fretOf(s)) % 12]); },
      sound: function (s, f, vol, delay) { O.pluck(M.freqOf(OPEN[s] + f), delay, vol); }
    });
    M.onNotation(function () { renderPicker(); pad.render(); });
    renderPicker();
  }

  /* ================= Assemblage ================= */
  M.initNotation();
  M.ChordSheet.mount($('sheetHost'), {
    instrument: O,
    notes: true,
    hint: 'Chaque note est placée à la case la plus proche du sillet. Touchez une note pour l’entendre.'
  });
  initVirtual();

  M.Scales.mount($('scalesHost'), {
    board: M.boards.fretboard({ open: OPEN, names: OPEN_NOTES, frets: 12, label: 'oud' }),
    play: function (midi) { O.pluck(M.freqOf(midi), 0); }
  });

  var tuner = M.Tuner.mount($('tunerHost'), { tunings: [
    { midi: [36, 41, 45, 50, 55, 60], names: ['C', 'F', 'A', 'D', 'G', 'C'], label: 'Arabe' },
    { midi: [38, 43, 47, 52, 57, 62], names: ['D', 'G', 'B', 'E', 'A', 'D'], label: 'Un ton plus haut (turc)' },
    { midi: [35, 40, 44, 49, 54, 59], names: ['B', 'E', 'G♯', 'C♯', 'F♯', 'B'], label: 'Demi-ton plus bas' }
  ] });

  /* Quand on quitte un onglet, le micro de l'accordeur s'arrête */
  M.tabs(['accords', 'virtuelle', 'manche', 'accordeur'], function (name) {
    if (name !== 'accordeur') tuner.stop();
  });
})();
