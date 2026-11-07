/* Musique : noyau commun aux pages d'instruments (guitare, basse, piano…). Expose window.Musique. Aucune dépendance.
   - aides DOM et stockage local ;
   - théorie : notes et orthographe, gammes et modes, accords (indépendants de l'instrument) ;
   - audio : un seul contexte, un « bus » de volume par instrument, suivi des sons programmés ;
   - notation (A B C ou Do Ré Mi) et onglets, partagés par toutes les pages. */
(function () {
  'use strict';

  var M = window.Musique = window.Musique || {};
  var SVGNS = 'http://www.w3.org/2000/svg';

  /* ================= DOM ================= */
  M.$ = function (id) { return document.getElementById(id); };
  M.el = function (tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  M.sv = function (tag, attrs, cls) {
    var e = document.createElementNS(SVGNS, tag), k;
    for (k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, attrs[k]);
    if (cls) e.setAttribute('class', cls);
    return e;
  };
  M.clamp = function (v, lo, hi) { return Math.min(hi, Math.max(lo, v)); };
  M.setPressed = function (buttons, test) {
    Array.prototype.forEach.call(buttons, function (b) { b.setAttribute('aria-pressed', String(test(b))); });
  };
  var uidN = 0;
  M.uid = function (prefix) { uidN++; return (prefix || 'm') + '-' + uidN; };

  /* ================= Stockage (ce navigateur seulement, jamais indispensable) ================= */
  M.store = {
    get: function (key, fallback) {
      try { var v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
    },
    set: function (key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* stockage indisponible */ }
    }
  };

  /* ================= Notes et orthographe ================= */
  var LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  var SOLFEGE = { C: 'Do', D: 'Ré', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' };
  var NATURAL = [0, 2, 4, 5, 7, 9, 11];          // demi-tons depuis Do pour chaque lettre
  var DEGREES = ['Unisson', 'Seconde', 'Tierce', 'Quarte', 'Quinte', 'Sixte', 'Septième', 'Octave'];
  M.LETTERS = LETTERS; M.SOLFEGE = SOLFEGE; M.NATURAL = NATURAL; M.DEGREES = DEGREES;

  /* Note = { l : indice de lettre, a : altération (+1 dièse, −1 bémol) } */
  function accStr(a) {
    var s = '', i;
    for (i = 0; i < Math.abs(a); i++) s += a > 0 ? '♯' : '♭';
    return s;
  }
  M.accStr = accStr;
  M.solfege = false;
  M.fmt = function (n) { return (M.solfege ? SOLFEGE[LETTERS[n.l]] : LETTERS[n.l]) + accStr(n.a); };
  /* « E♭ » -> « Mi♭ » selon la notation choisie */
  M.fmtName = function (s) { return (M.solfege ? SOLFEGE[s.charAt(0)] : s.charAt(0)) + s.slice(1); };
  M.pcOf = function (n) { return (((NATURAL[n.l] + n.a) % 12) + 12) % 12; };
  M.freqOf = function (midi, refA) { return (refA || 440) * Math.pow(2, (midi - 69) / 12); };

  /* Note à `degree` lettres au-dessus de `root` (0 = même lettre) et `semis` demi-tons : orthographe correcte
     (une lettre par degré), donc Mi♭ et non Ré♯ dans Do mineur. */
  M.spell = function (root, semis, degree) {
    var l = (root.l + degree) % 7;
    var pc = (M.pcOf(root) + semis) % 12;
    return { l: l, a: ((pc - NATURAL[l] + 18) % 12) - 6 };
  };

  /* Les 12 notes de départ proposées ; l'indice dans le tableau est aussi le nombre de demi-tons depuis Do */
  M.ROOTS = [
    { l: 0, a: 0 }, { l: 0, a: 1 }, { l: 1, a: 0 }, { l: 2, a: -1 }, { l: 2, a: 0 }, { l: 3, a: 0 },
    { l: 3, a: 1 }, { l: 4, a: 0 }, { l: 5, a: -1 }, { l: 5, a: 0 }, { l: 6, a: -1 }, { l: 6, a: 0 }
  ];

  /* ================= Gammes ================= */
  /* demi-tons depuis la note de départ, et degré (nombre de lettres au-dessus) de chaque note : cela permet les gammes
     à 5 ou 6 notes (pentatoniques, blues) avec une orthographe juste. Ordre habituel : courantes, autres mineures, modes. */
  var DEG7 = [0, 1, 2, 3, 4, 5, 6];
  var MAJOR_SEMIS = [0, 2, 4, 5, 7, 9, 11];
  M.MODES = [
    { id: 'ionien', group: 'Gammes courantes', name: 'Majeure (ionien)', short: 'Ionien', semis: [0, 2, 4, 5, 7, 9, 11], deg: DEG7 },
    { id: 'eolien', group: 'Gammes courantes', name: 'Mineure naturelle (éolien)', short: 'Éolien', semis: [0, 2, 3, 5, 7, 8, 10], deg: DEG7 },
    { id: 'pent-maj', group: 'Gammes courantes', name: 'Pentatonique majeure', semis: [0, 2, 4, 7, 9], deg: [0, 1, 2, 4, 5] },
    { id: 'pent-min', group: 'Gammes courantes', name: 'Pentatonique mineure', semis: [0, 3, 5, 7, 10], deg: [0, 2, 3, 4, 6] },
    { id: 'blues-min', group: 'Gammes courantes', name: 'Blues mineure', semis: [0, 3, 5, 6, 7, 10], deg: [0, 2, 3, 4, 4, 6] },
    { id: 'blues-maj', group: 'Gammes courantes', name: 'Blues majeure', semis: [0, 2, 3, 4, 7, 9], deg: [0, 1, 2, 2, 4, 5] },
    { id: 'harm', group: 'Autres mineures', name: 'Mineure harmonique', semis: [0, 2, 3, 5, 7, 8, 11], deg: DEG7 },
    { id: 'mel', group: 'Autres mineures', name: 'Mineure mélodique', semis: [0, 2, 3, 5, 7, 9, 11], deg: DEG7 },
    { id: 'dorien', group: 'Modes', name: 'Dorien', short: 'Dorien', semis: [0, 2, 3, 5, 7, 9, 10], deg: DEG7 },
    { id: 'phrygien', group: 'Modes', name: 'Phrygien', short: 'Phrygien', semis: [0, 1, 3, 5, 7, 8, 10], deg: DEG7 },
    { id: 'lydien', group: 'Modes', name: 'Lydien', short: 'Lydien', semis: [0, 2, 4, 6, 7, 9, 11], deg: DEG7 },
    { id: 'mixolydien', group: 'Modes', name: 'Mixolydien', short: 'Mixolydien', semis: [0, 2, 4, 5, 7, 9, 10], deg: DEG7 },
    { id: 'locrien', group: 'Modes', name: 'Locrien', short: 'Locrien', semis: [0, 1, 3, 5, 6, 8, 10], deg: DEG7 },
    { id: 'phryg-dom', group: 'Modes', name: 'Phrygien dominant', semis: [0, 1, 4, 5, 7, 8, 10], deg: DEG7 }
  ];
  /* Les sept lignes du tableau des décalages : les modes de Do majeur, dans l'ordre */
  M.OFFSET_ROWS = ['ionien', 'dorien', 'phrygien', 'lydien', 'mixolydien', 'eolien', 'locrien'];
  M.modeIdx = function (id) {
    for (var i = 0; i < M.MODES.length; i++) if (M.MODES[i].id === id) return i;
    return 0;
  };
  M.scaleOf = function (rootIdx, modeIdx) {
    var root = M.ROOTS[rootIdx], m = M.MODES[modeIdx];
    return m.semis.map(function (semi, k) { return M.spell(root, semi, m.deg[k]); });
  };
  /* Écarts entre notes consécutives, jusqu'à l'octave, en demi-tons */
  M.modeSteps = function (m) {
    return m.semis.map(function (s, k) { return (k + 1 < m.semis.length ? m.semis[k + 1] : 12) - s; });
  };
  /* 2 -> « +1 » (un ton), 1 -> « +½ », 3 -> « +1½ » */
  M.stepStr = function (s) { return '+' + (s >= 2 ? Math.floor(s / 2) : '') + (s % 2 ? '½' : ''); };
  /* Degré d'une note de la gamme par rapport à la majeure : 1, ♭3, ♭5, ♭7… */
  M.degLabel = function (m, k) {
    var diff = m.semis[k] - MAJOR_SEMIS[m.deg[k]], pre = '', i;
    for (i = 0; i < Math.abs(diff); i++) pre += diff < 0 ? '♭' : '♯';
    return pre + (m.deg[k] + 1);
  };

  /* ================= Accords (indépendants de l'instrument) ================= */
  /* Un instrument ajoute son doigté à cet accord : voir makeChord. */
  M.QUALITY = {
    maj: { suffix: '', plural: 'Majeurs', semis: [0, 4, 7], degrees: [0, 2, 4] },
    min: { suffix: ' min', plural: 'Mineurs', semis: [0, 3, 7], degrees: [0, 2, 4] },
    dom7: { suffix: '7', plural: 'Septièmes', semis: [0, 4, 7, 10], degrees: [0, 2, 4, 6] },
    dim: { suffix: '°', plural: 'Diminués', semis: [0, 3, 6], degrees: [0, 2, 4] }
  };
  /* Identifiant ASCII (« Amin », « F#maj », « Bbdom7 »), gardé dans le navigateur */
  M.chordId = function (root, q) {
    var id = LETTERS[root.l], i;
    for (i = 0; i < Math.abs(root.a); i++) id += root.a > 0 ? '#' : 'b';
    return id + q;
  };
  M.parseChordId = function (id) {
    var m = /^([A-G])(#{0,2}|b{0,2})(maj|min|dom7|dim)$/.exec(String(id));
    if (!m) return null;
    return { root: { l: LETTERS.indexOf(m[1]), a: m[2] ? (m[2].charAt(0) === '#' ? m[2].length : -m[2].length) : 0 }, q: m[3] };
  };
  /* Accord de base : { id, root, q, tones } plus les champs propres à l'instrument (`extra`) */
  M.makeChord = function (root, q, extra) {
    var Q = M.QUALITY[q], tones = [], k, c = { id: M.chordId(root, q), root: root, q: q, tones: tones };
    for (k = 0; k < Q.semis.length; k++) tones.push(M.spell(root, Q.semis[k], Q.degrees[k]));
    for (k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) c[k] = extra[k];
    return c;
  };
  M.chordTitle = function (c) { return M.fmt(c.root) + M.QUALITY[c.q].suffix; };
  /* Nom d'une hauteur MIDI avec son octave (« C4 »), orthographié comme les notes de l'accord `tones` si on les donne */
  M.noteName = function (midi, tones) {
    var pc = midi % 12, i;
    if (tones) for (i = 0; i < tones.length; i++) if (M.pcOf(tones[i]) === pc) return M.fmt(tones[i]) + (Math.floor(midi / 12) - 1);
    return M.fmt(M.ROOTS[pc]) + (Math.floor(midi / 12) - 1);
  };

  /* ================= Instruments ================= */
  /* Chaque instrument s'enregistre ici (voir instrument-*.js) et suit cette forme :
     { id, name, qualities, chordFor(root, q), diagram(accord), rhythms: [{ id, name, events(accord, temps) }],
       defaultRhythm, play(événement, accord, instant, secondesParTemps), chord(accord, instant, volume) } */
  M.instruments = {};
  M.registerInstrument = function (inst) { M.instruments[inst.id] = inst; return inst; };

  /* ================= Audio ================= */
  var ctx = null, master = null, buses = {}, tracking = null;
  M.audio = function () {
    if (!ctx) {
      var C = window.AudioContext || window.webkitAudioContext;
      if (C) {
        ctx = new C();
        master = ctx.createDynamicsCompressor(); // évite la saturation quand beaucoup de sons se superposent
        master.connect(ctx.destination);
      }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
  M.audioReady = function () { return !!ctx; };
  /* Sortie de volume propre à un instrument ou à la batterie (GainNode relié à la sortie générale) */
  M.bus = function (name) {
    if (!M.audio()) return null;
    if (!buses[name]) { buses[name] = ctx.createGain(); buses[name].connect(master); }
    return buses[name];
  };
  /* À appeler par un instrument pour chaque source programmée : permet de tout arrêter (aperçu d'une suite) */
  M.track = function (src) { if (tracking) tracking.push(src); };
  M.capture = function (fn) {
    var list = tracking = [];
    try { fn(); } finally { tracking = null; }
    return list;
  };
  M.stopSources = function (list) {
    list.forEach(function (s) { try { s.stop(); } catch (e) { /* déjà arrêtée */ } });
  };

  /* ================= Notation ================= */
  var KEY_NOTATION = 'tools:musique:notation', listeners = [];
  M.onNotation = function (cb) { listeners.push(cb); };
  M.setSolfege = function (on) {
    M.solfege = !!on;
    M.store.set(KEY_NOTATION, M.solfege ? 'do' : 'abc');
    listeners.forEach(function (cb) { cb(); });
  };
  /* Branche les boutons [data-notation] de la page ; à appeler avant le premier affichage */
  M.initNotation = function () {
    var buttons = document.querySelectorAll('[data-notation]');
    function sync() { M.setPressed(buttons, function (b) { return (b.getAttribute('data-notation') === 'do') === M.solfege; }); }
    M.solfege = M.store.get(KEY_NOTATION, 'abc') === 'do';
    buttons.forEach(function (b) {
      b.addEventListener('click', function () { M.setSolfege(b.getAttribute('data-notation') === 'do'); sync(); });
    });
    sync();
  };

  /* ================= Onglets ================= */
  /* names : noms des onglets ; pour chaque nom, la page contient #tab-<nom> (bouton) et #panel-<nom> (panneau).
     onShow(nom) est appelé à chaque changement. Le nom actif est gardé dans l'adresse (#nom). */
  M.tabs = function (names, onShow) {
    var T = { current: names[0] };
    function show(name, focus) {
      if (names.indexOf(name) < 0) name = names[0];
      names.forEach(function (n) {
        var on = n === name, tab = M.$('tab-' + n);
        tab.setAttribute('aria-selected', String(on));
        tab.tabIndex = on ? 0 : -1;
        M.$('panel-' + n).hidden = !on;
        if (on && focus) tab.focus();
      });
      T.current = name;
      if (onShow) onShow(name);
    }
    T.show = show;
    T.open = function (name) {
      show(name, false);
      try { history.replaceState(null, '', '#' + name); } catch (e) { /* adresse non modifiable */ }
    };
    names.forEach(function (n, i) {
      var tab = M.$('tab-' + n);
      tab.addEventListener('click', function () { T.open(n); });
      tab.addEventListener('keydown', function (e) {
        var len = names.length, k = e.key === 'ArrowRight' ? (i + 1) % len : e.key === 'ArrowLeft' ? (i + len - 1) % len : e.key === 'Home' ? 0 : e.key === 'End' ? len - 1 : -1;
        if (k < 0) return;
        e.preventDefault();
        show(names[k], true);
      });
    });
    window.addEventListener('hashchange', function () { show(location.hash.slice(1), false); });
    show(location.hash.slice(1), false);
    return T;
  };
})();
