/* Instrument « basse » (4 cordes) : fondamentale de l'accord à la position la plus basse du manche, schéma de manche,
   son de basse synthétisé et lignes de basse (racines, quinte, marche, reggae, funk…).
   S'enregistre dans Musique.instruments.bass ; voir musique/core.js pour la forme d'un instrument.
   Dépend de musique/core.js. */
(function () {
  'use strict';

  var M = window.Musique, sv = M.sv;
  var B = { id: 'bass', name: 'Basse', qualities: ['maj', 'min', 'dom7', 'dim'], defaultRhythm: 'croches' };

  /* ================= Positions ================= */
  var STRINGS = [28, 33, 38, 43]; // Mi1 La1 Ré2 Sol2 (numéros MIDI), de la plus grave à la plus aiguë
  var cache = {};
  /* Pour chaque fondamentale : la corde et la case où elle est la plus proche du sillet. midi : la hauteur jouée. */
  B.chordFor = function (root, q) {
    var id = M.chordId(root, q), pc, best = null, c;
    if (cache[id]) return cache[id];
    if (Math.abs(root.a) > 1) return null;
    pc = M.pcOf(root);
    STRINGS.forEach(function (open, s) {
      var f = (((pc - open) % 12) + 12) % 12;
      if (!best || f < best.fret) best = { string: s, fret: f, midi: open + f };
    });
    c = M.makeChord(root, q, { string: best.string, fret: best.fret, midi: best.midi });
    cache[id] = c;
    return c;
  };

  /* ================= Schéma : manche de 4 cordes, 5 cases ================= */
  var X0 = 14, XS = 17, Y0 = 30, YF = 12;
  B.diagram = function (c) {
    var svg = sv('svg', { viewBox: '0 0 80 100', role: 'img', 'aria-label': 'Basse : fondamentale de ' + M.chordTitle(c), 'class': 'bn' });
    var base = c.fret > 4 ? c.fret : 1, s, f, x = X0 + c.string * XS;
    for (f = 0; f <= 5; f++) svg.appendChild(sv('line', { x1: X0, x2: X0 + 3 * XS, y1: Y0 + f * YF, y2: Y0 + f * YF }, 'cd-line'));
    for (s = 0; s < 4; s++) svg.appendChild(sv('line', { x1: X0 + s * XS, x2: X0 + s * XS, y1: Y0, y2: Y0 + 5 * YF }, 'cd-line'));
    if (base === 1) svg.appendChild(sv('rect', { x: X0 - 1, y: Y0 - 3, width: 3 * XS + 2, height: 3 }, 'cd-nut'));
    else {
      var lab = sv('text', { x: X0 + 3 * XS + 7, y: Y0 + YF / 2 + 4 }, 'cd-text');
      lab.textContent = base + 'fr';
      svg.appendChild(lab);
    }
    if (c.fret === 0) svg.appendChild(sv('circle', { cx: x, cy: 18, r: 4 }, 'cd-mark'));
    else svg.appendChild(sv('circle', { cx: x, cy: Y0 + (c.fret - base + 0.5) * YF, r: 5.5 }, 'cd-dot'));
    return svg;
  };

  /* ================= Son : basse électrique ================= */
  /* midi, instant audio, volume 0..1, durée en secondes */
  function note(midi, when, vol, dur) {
    var ctx = M.audio(), out;
    if (!ctx) return;
    out = M.bus('bass');
    var freq = M.freqOf(midi), d = Math.max(0.12, dur), g = ctx.createGain(), f = ctx.createBiquadFilter();
    var saw = ctx.createOscillator(), sub = ctx.createOscillator(), sg = ctx.createGain();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(1100, when);
    f.frequency.exponentialRampToValueAtTime(280, when + 0.18);
    saw.type = 'sawtooth'; saw.frequency.value = freq;
    sub.type = 'sine'; sub.frequency.value = freq;
    sg.gain.value = 0.8;
    saw.connect(f); sub.connect(sg); sg.connect(f);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.5 * vol), when + 0.008);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.32 * vol), when + 0.12);
    g.gain.setValueAtTime(Math.max(0.0002, 0.32 * vol), Math.max(when + 0.12, when + d - 0.06));
    g.gain.exponentialRampToValueAtTime(0.0001, when + d + 0.08);
    f.connect(g); g.connect(out);
    saw.start(when); sub.start(when);
    saw.stop(when + d + 0.15); sub.stop(when + d + 0.15);
    M.track(saw); M.track(sub);
  }

  B.note = note;
  B.STRINGS = STRINGS;

  /* ================= Lignes de basse ================= */
  /* Notes relatives à la fondamentale */
  function third(c) { return c.q === 'min' || c.q === 'dim' ? 3 : 4; }
  function fifth(c) { return c.q === 'dim' ? 6 : 7; }
  function sixth(c) { return c.q === 'dom7' ? 10 : 9; }
  function n(c, at, off, dur, vol) { return { at: at, midi: c.midi + off, dur: dur, vol: vol }; }
  /* Coups d'un accord sur `beats` temps : { at : position en temps, midi, dur : en temps, vol } */
  B.rhythms = [
    { id: 'croches', name: 'Croches sur la fondamentale', events: function (c, beats) {
      var evs = [], k;
      for (k = 0; k < beats * 2; k++) evs.push(n(c, k / 2, 0, 0.45, k % 2 ? 0.65 : 0.95));
      return evs;
    } },
    { id: 'racines', name: 'Fondamentale tenue (une note par accord)', events: function (c, beats) { return [n(c, 0, 0, beats * 0.95, 1)]; } },
    { id: 'noires', name: 'Fondamentale à chaque temps', events: function (c, beats) {
      var evs = [], k;
      for (k = 0; k < beats; k++) evs.push(n(c, k, 0, 0.9, k ? 0.8 : 1));
      return evs;
    } },
    { id: 'quinte', name: 'Fondamentale et quinte (country, bossa)', events: function (c, beats) {
      var evs = [], k;
      for (k = 0; k < beats; k++) evs.push(n(c, k, k % 2 ? fifth(c) : 0, 0.9, k ? 0.8 : 1));
      return evs;
    } },
    { id: 'marche', name: 'Marche (jazz) : fondamentale, tierce, quinte, sixte', events: function (c, beats) {
      var evs = [], steps = [0, third(c), fifth(c), sixth(c)], k;
      for (k = 0; k < beats; k++) evs.push(n(c, k, steps[k % 4], 0.95, k ? 0.8 : 1));
      return evs;
    } },
    { id: 'shuffle', name: 'Shuffle (blues, gnawa) : notes en triolet', events: function (c, beats) {
      var evs = [], k, off;
      for (k = 0; k < beats; k++) {
        off = k % 2 ? fifth(c) : 0;
        evs.push(n(c, k, off, 0.6, 1));
        evs.push(n(c, k + 2 / 3, off, 0.3, 0.6));
      }
      return evs;
    } },
    { id: 'reggae', name: 'Reggae : temps 3 marqué', events: function (c, beats) {
      var evs = [n(c, 0, 0, 0.45, 0.8)];
      if (beats > 2) evs.push(n(c, 2, 0, 1.4, 1));
      if (beats > 3) evs.push(n(c, 3.5, fifth(c), 0.4, 0.7));
      return evs;
    } },
    { id: 'funk', name: 'Funk : doubles-croches syncopées', events: function (c, beats) {
      var evs = [], pat = [[0, 0, 0.4, 1], [0.75, 0, 0.2, 0.5], [1.5, 12, 0.4, 0.8], [2, 0, 0.4, 1], [2.75, 0, 0.2, 0.5], [3.5, 0, 0.4, 0.8]];
      pat.forEach(function (p) { if (p[0] < beats) evs.push(n(c, p[0], p[1], p[2], p[3])); });
      return evs;
    } },
    { id: 'disco', name: 'Disco : fondamentale et octave', events: function (c, beats) {
      var evs = [], k;
      for (k = 0; k < beats * 2; k++) evs.push(n(c, k / 2, k % 2 ? 12 : 0, 0.4, k % 2 ? 0.7 : 0.95));
      return evs;
    } },
    { id: 'galop', name: 'Galop (metal) : doubles-croches', events: function (c, beats) {
      var evs = [], k;
      for (k = 0; k < beats * 4; k++) evs.push(n(c, k / 4, 0, 0.2, k % 4 === 0 ? 1 : 0.7));
      return evs;
    } }
  ];

  B.describe = function (c) {
    var string = M.fmtName(['E', 'A', 'D', 'G'][c.string]), f = c.fret === 0 ? 'corde à vide' : 'case ' + c.fret;
    return ['Fondamentale : ' + M.noteName(c.midi, c.tones) + ' (corde de ' + string + ', ' + f + ')'];
  };

  B.play = function (e, c, when, spb) { note(e.midi, when, e.vol, e.dur * spb); };
  /* Joue la fondamentale (aperçu) */
  B.chord = function (c, when, vol) {
    note(c.midi, when === undefined ? M.audio().currentTime : when, vol === undefined ? 1 : vol, 1.2);
  };

  M.registerInstrument(B);
})();
