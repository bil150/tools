/* Instrument « piano » : accord en position fondamentale (main droite) avec la basse à la main gauche, schéma de clavier,
   son de piano électrique synthétisé et rythmes d'accompagnement.
   S'enregistre dans Musique.instruments.piano ; voir musique/core.js pour la forme d'un instrument.
   Dépend de musique/core.js. */
(function () {
  'use strict';

  var M = window.Musique, sv = M.sv;
  var P = { id: 'piano', name: 'Piano', qualities: ['maj', 'min', 'dom7', 'dim'], defaultRhythm: 'noires' };

  /* ================= Voicings ================= */
  /* notes : main droite, de Do4 (60) à Si4 pour la fondamentale, puis les notes de l'accord vers l'aigu ;
     bass : la fondamentale, une à deux octaves plus bas (main gauche). Numéros MIDI. */
  var cache = {};
  P.chordFor = function (root, q) {
    var id = M.chordId(root, q), pc, c;
    if (cache[id]) return cache[id];
    if (Math.abs(root.a) > 1) return null;
    pc = M.pcOf(root);
    c = M.makeChord(root, q, { bass: 36 + pc, notes: M.QUALITY[q].semis.map(function (s) { return 60 + pc + s; }) });
    cache[id] = c;
    return c;
  };

  /* ================= Schéma : clavier de deux octaves (Do4 à Si5) ================= */
  var WHITE = [0, 2, 4, 5, 7, 9, 11], BLACK_AFTER = { 1: 0, 3: 1, 6: 3, 8: 4, 10: 5 }; // note noire -> touche blanche qui la précède
  var KW = 10;
  P.diagram = function (c) {
    var svg = sv('svg', { viewBox: '0 0 ' + 14 * KW + ' 52', role: 'img', 'aria-label': 'Clavier : accord ' + M.chordTitle(c), 'class': 'pk' });
    var on = {}, m, o, pc, i;
    c.notes.forEach(function (n) { on[n] = true; });
    for (m = 60; m < 84; m++) {
      o = Math.floor((m - 60) / 12); pc = (m - 60) % 12;
      i = WHITE.indexOf(pc);
      if (i >= 0) svg.appendChild(sv('rect', { x: (o * 7 + i) * KW, y: 2, width: KW, height: 48 }, 'pk-w' + (on[m] ? ' on' : '')));
    }
    for (m = 60; m < 84; m++) {
      o = Math.floor((m - 60) / 12); pc = (m - 60) % 12;
      if (BLACK_AFTER[pc] !== undefined) svg.appendChild(sv('rect', { x: (o * 7 + BLACK_AFTER[pc]) * KW + KW * 0.68, y: 2, width: KW * 0.62, height: 30 }, 'pk-b' + (on[m] ? ' on' : '')));
    }
    return svg;
  };

  /* ================= Son : piano électrique ================= */
  /* midi, instant audio, volume 0..1, durée en secondes */
  function note(midi, when, vol, dur) {
    var ctx = M.audio(), out;
    if (!ctx) return;
    out = M.bus('piano');
    var freq = M.freqOf(midi), len = Math.min(2.4, dur * 1.2 + 0.35), g = ctx.createGain(), f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = Math.min(9000, freq * 6);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.2 * vol), when + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.006 + len);
    [[1, 1, 'triangle'], [2, 0.35, 'sine'], [3, 0.12, 'sine']].forEach(function (h) {
      var osc = ctx.createOscillator(), hg = ctx.createGain();
      osc.type = h[2];
      osc.frequency.value = freq * h[0];
      hg.gain.value = h[1];
      osc.connect(hg); hg.connect(f);
      osc.start(when); osc.stop(when + len + 0.1);
      M.track(osc);
    });
    f.connect(g); g.connect(out);
  }

  P.note = note;

  /* ================= Rythmes ================= */
  /* Coups d'un accord sur `beats` temps : { at, notes : numéros MIDI, dur : en temps, vol } */
  function hit(c, at, dur, vol, bass) { return { at: at, notes: (bass ? [c.bass] : []).concat(c.notes), dur: dur, vol: vol }; }
  P.rhythms = [
    { id: 'noires', name: 'Accords à chaque temps', events: function (c, beats) {
      var evs = [], k;
      for (k = 0; k < beats; k++) evs.push(hit(c, k, 0.9, k ? 0.75 : 1, k % 2 === 0));
      return evs;
    } },
    { id: 'tenu', name: 'Accords tenus (un par accord)', events: function (c, beats) { return [hit(c, 0, beats, 1, true)]; } },
    { id: 'croches', name: 'Croches : accords pulsés', events: function (c, beats) {
      var evs = [], k;
      for (k = 0; k < beats * 2; k++) evs.push(hit(c, k / 2, 0.45, k % 2 ? 0.6 : 0.85, k % 2 === 0));
      return evs;
    } },
    { id: 'contretemps', name: 'Contretemps (accords sur les « et »)', events: function (c, beats) {
      var evs = [{ at: 0, notes: [c.bass], dur: beats, vol: 0.9 }], k;
      for (k = 0; k < beats; k++) evs.push(hit(c, k + 0.5, 0.4, 0.8, false));
      return evs;
    } },
    { id: 'arpege', name: 'Arpège : basse puis notes de l’accord', events: function (c, beats) {
      var evs = [], seq = [c.bass].concat(c.notes, c.notes.slice(1, -1).reverse()), k;
      for (k = 0; k < beats * 2; k++) evs.push({ at: k / 2, notes: [seq[k % seq.length]], dur: 1.2, vol: k === 0 ? 1 : 0.75 });
      return evs;
    } }
  ];

  P.describe = function (c) {
    return ['Main droite : ' + c.notes.map(function (m) { return M.noteName(m, c.tones); }).join(' · '), 'Main gauche : ' + M.noteName(c.bass, c.tones)];
  };

  P.play = function (e, c, when, spb) {
    e.notes.forEach(function (m, i) { note(m, when + i * 0.004, e.vol, e.dur * spb); });
  };
  /* Joue l'accord entier (aperçu), légèrement arpégé comme un accord tenu à la main */
  P.chord = function (c, when, vol) {
    var t = when === undefined ? M.audio().currentTime : when;
    [c.bass].concat(c.notes).forEach(function (m, i) { note(m, t + i * 0.02, vol === undefined ? 1 : vol, 1.4); });
  };

  M.registerInstrument(P);
})();
