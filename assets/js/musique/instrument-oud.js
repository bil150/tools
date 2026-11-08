/* Instrument « oud » (arabe, six chœurs : un simple et cinq doubles) : note à la position la plus basse du manche,
   schéma de manche et son de corde pincée au plectre.
   Le manche n'a pas de frettes : les « cases » sont les demi-tons, comme sur la guitare.
   S'enregistre dans Musique.instruments.oud ; voir musique/core.js pour la forme d'un instrument.
   Dépend de musique/core.js. */
(function () {
  'use strict';

  var M = window.Musique, sv = M.sv;
  var O = { id: 'oud', name: 'Oud', qualities: ['maj', 'min', 'dom7', 'dim'] };

  /* ================= Positions ================= */
  var STRINGS = [36, 41, 45, 50, 55, 60]; // Do2 Fa2 La2 Ré3 Sol3 Do4 (accordage arabe), du chœur le plus grave au plus aigu
  var NAMES = ['C', 'F', 'A', 'D', 'G', 'C'];
  var cache = {};
  /* Pour chaque fondamentale : le chœur et la case où elle est la plus proche du sillet. midi : la hauteur jouée. */
  O.chordFor = function (root, q) {
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

  /* ================= Schéma : manche de 6 chœurs, 5 cases ================= */
  var X0 = 14, XS = 12, Y0 = 30, YF = 12;
  O.diagram = function (c) {
    var svg = sv('svg', { viewBox: '0 0 90 100', role: 'img', 'aria-label': 'Oud : note ' + M.fmt(c.root), 'class': 'bn' });
    var base = c.fret > 4 ? c.fret : 1, s, f, x = X0 + c.string * XS, w = 5 * XS;
    for (f = 0; f <= 5; f++) svg.appendChild(sv('line', { x1: X0, x2: X0 + w, y1: Y0 + f * YF, y2: Y0 + f * YF }, 'cd-line'));
    for (s = 0; s < 6; s++) svg.appendChild(sv('line', { x1: X0 + s * XS, x2: X0 + s * XS, y1: Y0, y2: Y0 + 5 * YF }, 'cd-line'));
    if (base === 1) svg.appendChild(sv('rect', { x: X0 - 1, y: Y0 - 3, width: w + 2, height: 3 }, 'cd-nut'));
    else {
      var lab = sv('text', { x: X0 + w + 6, y: Y0 + YF / 2 + 4 }, 'cd-text');
      lab.textContent = base + 'fr';
      svg.appendChild(lab);
    }
    if (c.fret === 0) svg.appendChild(sv('circle', { cx: x, cy: 18, r: 4 }, 'cd-mark'));
    else svg.appendChild(sv('circle', { cx: x, cy: Y0 + (c.fret - base + 0.5) * YF, r: 5 }, 'cd-dot'));
    return svg;
  };

  /* ================= Son : corde pincée au plectre (Karplus-Strong), chœur doublé ================= */
  var bufs = {}, bufN = 0;
  /* freq en Hz, `when` : instant audio, vol de 0 à 1, dur : durée en secondes (la corde s'éteint ensuite) */
  function pluckAt(freq, when, vol, dur) {
    var c = M.audio(), out;
    if (!c || !freq) return;
    out = M.bus('oud');
    var sr = c.sampleRate, period = Math.max(2, Math.round(sr / freq)), buf = bufs[period], k;
    if (!buf) {
      var n = Math.round(sr * 2), d, i, prev = 0, fade = Math.round(sr * 0.2);
      buf = c.createBuffer(1, n, sr);
      d = buf.getChannelData(0);
      for (i = 0; i < period; i++) { prev = prev * 0.3 + (Math.random() * 2 - 1) * 0.7; d[i] = prev; } // attaque du plectre : brillante
      for (i = period; i < n; i++) d[i] = 0.9925 * 0.5 * (d[i - period] + (i > period ? d[i - period - 1] : d[i - period]));
      for (i = 0; i < fade; i++) d[n - 1 - i] *= i / fade;
      if (bufN >= 120) { bufs = {}; bufN = 0; }
      bufs[period] = buf; bufN++;
    }
    var rate = freq / (sr / (period + 0.5)), end = dur ? when + Math.max(0.15, dur) : 0;
    for (k = 0; k < 2; k++) { // les deux cordes du chœur, très légèrement désaccordées
      var src = c.createBufferSource(), gain = c.createGain();
      src.buffer = buf;
      src.playbackRate.value = rate * (k ? 1.0012 : 0.9988);
      gain.gain.setValueAtTime(0.19 * (vol === undefined ? 1 : vol), when);
      if (end) { gain.gain.setValueAtTime(0.19 * (vol === undefined ? 1 : vol), end); gain.gain.linearRampToValueAtTime(0.0001, end + 0.25); }
      src.connect(gain); gain.connect(out);
      M.track(src);
      src.start(when);
    }
  }
  /* Pour l'oud virtuel : `delay` en secondes à partir de maintenant */
  O.pluck = function (freq, delay, vol) {
    if (M.audio()) pluckAt(freq, M.audio().currentTime + 0.01 + (delay || 0), vol);
  };
  O.note = function (midi, when, vol, dur) { pluckAt(M.freqOf(midi), when, vol, dur); };
  O.STRINGS = STRINGS;
  O.NAMES = NAMES;

  O.describe = function (c) {
    var f = c.fret === 0 ? 'corde à vide' : 'case ' + c.fret;
    return ['Note : ' + M.noteName(c.midi, c.tones) + ' (chœur ' + (c.string + 1) + ' en partant du grave, ' + M.fmtName(NAMES[c.string]) + ', ' + f + ')'];
  };

  /* Joue la note (aperçu) */
  O.chord = function (c, when, vol) {
    O.note(c.midi, when === undefined ? M.audio().currentTime : when, vol === undefined ? 1 : vol, 1.2);
  };

  M.registerInstrument(O);
})();
