/* Instrument « guitare » : doigtés (accords ouverts de la feuille, formes barrées pour les autres fondamentales),
   schémas d'accords, son de corde pincée (Karplus-Strong) et rythmes de grattage.
   S'enregistre dans Musique.instruments.guitar ; voir musique/core.js pour la forme d'un instrument.
   Dépend de musique/core.js. */
(function () {
  'use strict';

  var M = window.Musique, el = M.el, sv = M.sv;
  var LETTERS = M.LETTERS;

  var G = { id: 'guitar', name: 'Guitare', qualities: ['maj', 'min', 'dom7', 'dim'], defaultRhythm: 'folk' };

  /* Cordes à vide (E2 A2 D3 G3 B3 E4), de la plus grave à la plus aiguë */
  G.OPEN = [40, 45, 50, 55, 59, 64];
  G.OPEN_NOTES = [{ l: 2, a: 0 }, { l: 5, a: 0 }, { l: 1, a: 0 }, { l: 4, a: 0 }, { l: 6, a: 0 }, { l: 2, a: 0 }];
  var OPEN = G.OPEN;

  /* ================= Doigtés ================= */
  /* frets : une valeur par corde, de la plus grave à la plus aiguë (−1 = non jouée, 0 = à vide).
     base : case du haut du schéma. barre : { fret, from, to } (indices de cordes). */
  function chord(letter, q, frets, base, barre) {
    return M.makeChord({ l: LETTERS.indexOf(letter), a: 0 }, q, { frets: frets, base: base || 1, barre: barre || null });
  }
  /* Les 21 accords ouverts de la feuille (onglet Accords de la page) */
  G.CHORDS = {
    maj: [
      chord('A', 'maj', [-1, 0, 2, 2, 2, 0]), chord('E', 'maj', [0, 2, 2, 1, 0, 0]),
      chord('D', 'maj', [-1, -1, 0, 2, 3, 2]), chord('G', 'maj', [3, 2, 0, 0, 0, 3]),
      chord('C', 'maj', [-1, 3, 2, 0, 1, 0]), chord('F', 'maj', [1, 3, 3, 2, 1, 1], 1, { fret: 1, from: 0, to: 5 }),
      chord('B', 'maj', [-1, 2, 4, 4, 4, 2], 1, { fret: 2, from: 1, to: 5 })
    ],
    min: [
      chord('A', 'min', [-1, 0, 2, 2, 1, 0]), chord('E', 'min', [0, 2, 2, 0, 0, 0]),
      chord('D', 'min', [-1, -1, 0, 2, 3, 1]), chord('G', 'min', [3, 5, 5, 3, 3, 3], 3, { fret: 3, from: 0, to: 5 }),
      chord('C', 'min', [-1, 3, 5, 5, 4, 3], 3, { fret: 3, from: 1, to: 5 }), chord('F', 'min', [1, 3, 3, 1, 1, 1], 1, { fret: 1, from: 0, to: 5 }),
      chord('B', 'min', [-1, 2, 4, 4, 3, 2], 1, { fret: 2, from: 1, to: 5 })
    ],
    dom7: [
      chord('A', 'dom7', [-1, 0, 2, 0, 2, 0]), chord('E', 'dom7', [0, 2, 0, 1, 0, 0]),
      chord('D', 'dom7', [-1, -1, 0, 2, 1, 2]), chord('G', 'dom7', [3, 2, 0, 0, 0, 1]),
      chord('C', 'dom7', [-1, 3, 2, 3, 1, 0]), chord('F', 'dom7', [1, 3, 1, 2, 1, 1], 1, { fret: 1, from: 0, to: 5 }),
      chord('B', 'dom7', [-1, 2, 4, 2, 4, 2], 1, { fret: 2, from: 1, to: 5 })
    ]
  };
  var CHORD_CACHE = {};
  G.CHORDS.maj.concat(G.CHORDS.min, G.CHORDS.dom7).forEach(function (c) { CHORD_CACHE[c.id] = c; });

  /* Doigtés de toutes les fondamentales : les accords ouverts ci-dessus quand ils existent, sinon une forme de Mi
     (fondamentale sur la 6e corde) ou de La (sur la 5e) barrée plus haut sur le manche. Le diminué n'a pas de corde à vide. */
  var BARRE_SHAPES = {
    E: { maj: [0, 2, 2, 1, 0, 0], min: [0, 2, 2, 0, 0, 0], dom7: [0, 2, 0, 1, 0, 0] },
    A: { maj: [-1, 0, 2, 2, 2, 0], min: [-1, 0, 2, 2, 1, 0], dom7: [-1, 0, 2, 0, 2, 0] }
  };
  G.chordFor = function (root, q) {
    var id = M.chordId(root, q), pc, nE, nA, n, frets, barre, c;
    if (CHORD_CACHE[id]) return CHORD_CACHE[id];
    if (Math.abs(root.a) > 1) return null; // pas de doigté pour les doubles altérations
    pc = M.pcOf(root);
    nE = (pc - 4 + 12) % 12;
    nA = (pc - 9 + 12) % 12;
    if (q === 'dim') {
      n = Math.min(nA, nE);
      frets = nA <= nE ? [-1, nA, nA + 1, nA + 2, nA + 1, -1] : [nE, nE + 1, nE + 2, nE, -1, -1];
      c = M.makeChord(root, q, { frets: frets, base: Math.max(1, n), barre: null });
    } else {
      var useE = nE <= nA, shape = BARRE_SHAPES[useE ? 'E' : 'A'][q];
      n = useE ? nE : nA;
      frets = shape.map(function (f) { return f < 0 ? -1 : f + n; });
      barre = n > 0 ? { fret: n, from: useE ? 0 : 1, to: 5 } : null;
      c = M.makeChord(root, q, { frets: frets, base: Math.max(1, n), barre: barre });
    }
    CHORD_CACHE[id] = c;
    return c;
  };

  /* Fréquences jouées, de la corde grave à l'aiguë (0 : corde non jouée) */
  G.freqs = function (c) {
    var out = [], s;
    for (s = 0; s < 6; s++) out.push(c.frets[s] >= 0 ? M.freqOf(OPEN[s] + c.frets[s]) : 0);
    return out;
  };
  /* Note (orthographe de l'accord) sonnant sur la corde s, ou null */
  G.toneAt = function (c, s) {
    var pc = (OPEN[s] + c.frets[s]) % 12, k;
    for (k = 0; k < c.tones.length; k++) if (M.pcOf(c.tones[k]) === pc) return c.tones[k];
    return null;
  };

  /* ================= Schéma d'accord ================= */
  var DX = 18, DS = 15, DY = 36, DF = 20; // 1re corde en x, écart des cordes, sillet en y, hauteur d'une case
  G.diagram = function (c, interactive) {
    var svg = sv('svg', { viewBox: '0 0 134 150', role: 'img', 'aria-label': 'Schéma de l’accord ' + M.chordTitle(c) });
    var s, f, x, y, w = 5 * DS;
    for (f = 0; f <= 5; f++) svg.appendChild(sv('line', { x1: DX, x2: DX + w, y1: DY + f * DF, y2: DY + f * DF }, 'cd-line'));
    for (s = 0; s < 6; s++) svg.appendChild(sv('line', { x1: DX + s * DS, x2: DX + s * DS, y1: DY, y2: DY + 5 * DF, 'data-s': s }, 'cd-line cd-str'));
    if (c.base === 1) svg.appendChild(sv('rect', { x: DX - 1, y: DY - 4, width: w + 2, height: 4 }, 'cd-nut'));
    else {
      var lab = sv('text', { x: DX + w + 9, y: DY + DF / 2 + 4 }, 'cd-text');
      lab.textContent = c.base + 'fr';
      svg.appendChild(lab);
    }
    for (s = 0; s < 6; s++) {
      x = DX + s * DS;
      if (c.frets[s] === 0) svg.appendChild(sv('circle', { cx: x, cy: 22, r: 4 }, 'cd-mark'));
      else if (c.frets[s] < 0) {
        svg.appendChild(sv('line', { x1: x - 4, y1: 18, x2: x + 4, y2: 26 }, 'cd-mark'));
        svg.appendChild(sv('line', { x1: x - 4, y1: 26, x2: x + 4, y2: 18 }, 'cd-mark'));
      }
    }
    var b = c.barre;
    if (b) {
      y = DY + (b.fret - c.base + 0.5) * DF;
      svg.appendChild(sv('rect', { x: DX + b.from * DS - 6.5, y: y - 6.5, width: (b.to - b.from) * DS + 13, height: 13, rx: 6.5 }, 'cd-dot'));
    }
    for (s = 0; s < 6; s++) {
      f = c.frets[s];
      if (f <= 0 || (b && f === b.fret && s >= b.from && s <= b.to)) continue;
      svg.appendChild(sv('circle', { cx: DX + s * DS, cy: DY + (f - c.base + 0.5) * DF, r: 6.5 }, 'cd-dot'));
    }
    if (interactive) {
      for (s = 0; s < 6; s++) {
        if (c.frets[s] < 0) continue;
        svg.appendChild(sv('rect', { x: DX + s * DS - 7.5, y: 10, width: 15, height: DY + 5 * DF - 10, 'data-s': s }, 'cd-hit'));
      }
    }
    return svg;
  };

  /* ================= Son : corde pincée (Karplus-Strong) ================= */
  var cache = {}, cacheN = 0;
  /* `freq` en Hz, `delay` en secondes à partir de maintenant, `vol` de 0 à 1 */
  G.pluck = function (freq, delay, vol) {
    var c = M.audio(), out;
    if (!c || !freq) return;
    out = M.bus('guitar');
    var sr = c.sampleRate, period = Math.max(2, Math.round(sr / freq)), buf = cache[period];
    if (!buf) {
      var n = Math.round(sr * 2.4), d, i, prev = 0, fade = Math.round(sr * 0.25);
      buf = c.createBuffer(1, n, sr);
      d = buf.getChannelData(0);
      for (i = 0; i < period; i++) { prev = prev * 0.45 + (Math.random() * 2 - 1) * 0.55; d[i] = prev; }
      for (i = period; i < n; i++) d[i] = 0.996 * 0.5 * (d[i - period] + (i > period ? d[i - period - 1] : d[i - period]));
      for (i = 0; i < fade; i++) d[n - 1 - i] *= i / fade;
      if (cacheN >= 120) { cache = {}; cacheN = 0; } // les mêmes notes reviennent souvent : on garde les tampons déjà calculés
      cache[period] = buf; cacheN++;
    }
    var src = c.createBufferSource(), gain = c.createGain();
    src.buffer = buf;
    src.playbackRate.value = freq / (sr / (period + 0.5)); // corrige l'arrondi de la période
    gain.gain.value = 0.3 * (vol === undefined ? 1 : vol);
    src.connect(gain); gain.connect(out);
    M.track(src);
    src.start(c.currentTime + (delay || 0));
  };
  function pluckAt(freq, when, vol) { G.pluck(freq, Math.max(0, when - M.audio().currentTime), vol); }

  /* Grattage immédiat de fréquences (de la grave à l'aiguë), `gap` secondes entre deux cordes */
  G.strum = function (freqs, gap) {
    var k = 0, i;
    for (i = 0; i < freqs.length; i++) if (freqs[i]) G.pluck(freqs[i], (k++) * gap);
  };

  /* Un coup de grattoir à l'instant audio `when` : 'd' vers le bas (toutes les cordes), 'u' vers le haut (les 4 plus aiguës) */
  function strumAt(c, dir, when, vol) {
    var freqs = G.freqs(c), order = [], s;
    for (s = 0; s < 6; s++) if (freqs[s]) order.push(s);
    if (dir === 'u') order = order.slice(-4).reverse();
    order.forEach(function (str, i) { pluckAt(freqs[str], when + i * (dir === 'u' ? 0.012 : 0.018), vol); });
  }

  /* ================= Rythmes ================= */
  /* Chaque rythme renvoie les coups d'un accord sur `beats` temps : { at : position en temps, dir : 'd' | 'u' }
     ou { at, str : corde pincée }, avec un volume. */
  function played(c) {
    var out = [], s;
    for (s = 0; s < 6; s++) if (c.frets[s] >= 0) out.push(s);
    return out;
  }
  G.rhythms = [
    { id: 'folk', name: 'Folk : bas, bas, haut, haut, bas, haut', events: function (c, beats) {
      var evs = [];
      [[0, 'd'], [1, 'd'], [1.5, 'u'], [2.5, 'u'], [3, 'd'], [3.5, 'u']].forEach(function (p) {
        if (p[0] < beats) evs.push({ at: p[0], dir: p[1], vol: p[1] === 'u' ? 0.6 : p[0] === 0 ? 1 : 0.85 });
      });
      return evs;
    } },
    { id: 'plaque', name: 'Accords plaqués (un coup par accord)', events: function () { return [{ at: 0, dir: 'd', vol: 1 }]; } },
    { id: 'shuffle', name: 'Shuffle (blues) : bas, haut en triolet', events: function (c, beats) {
      var evs = [], k;
      for (k = 0; k < beats; k++) { evs.push({ at: k, dir: 'd', vol: k % 2 ? 0.85 : 1 }); evs.push({ at: k + 2 / 3, dir: 'u', vol: 0.55 }); }
      return evs;
    } },
    { id: 'skank', name: 'Contretemps (reggae)', events: function (c, beats) {
      var evs = [], k;
      for (k = 0; k < beats; k++) evs.push({ at: k + 0.5, dir: 'u', vol: 0.8 });
      return evs;
    } },
    { id: 'temps', name: 'Un coup vers le bas à chaque temps', events: function (c, beats) {
      var evs = [], k;
      for (k = 0; k < beats; k++) evs.push({ at: k, dir: 'd', vol: k === 0 ? 1 : 0.85 });
      return evs;
    } },
    { id: 'arpege', name: 'Arpège', events: function (c, beats) {
      var evs = [], p = played(c), cycle = p.slice(), i, k; // aller-retour sur les cordes jouées, une corde par croche
      for (i = p.length - 2; i > 0; i--) cycle.push(p[i]);
      for (k = 0; k < beats * 2; k++) evs.push({ at: k / 2, str: cycle[k % cycle.length], vol: k === 0 ? 1 : 0.8 });
      return evs;
    } }
  ];

  /* Joue un coup produit par un rythme, à l'instant audio `when` */
  G.play = function (e, c, when) {
    if (e.str !== undefined) pluckAt(G.freqs(c)[e.str], when, e.vol);
    else strumAt(c, e.dir, when, e.vol);
  };
  /* Joue l'accord entier (aperçu) à l'instant `when` */
  G.chord = function (c, when, vol) { strumAt(c, 'd', when === undefined ? M.audio().currentTime : when, vol === undefined ? 1 : vol); };

  M.registerInstrument(G);
})();
