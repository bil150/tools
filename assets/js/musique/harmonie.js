/* Suites harmoniques : roue des accords, accords de chaque tonalité et suites classiques.
   Expose Musique.Harmony. Dépend de musique/core.js. Indépendant de l'instrument : la page donne celui dont on montre les
   schémas et qu'on entend (voir Musique.instruments).

   Roue : 12 positions rangées par quintes (Do, Sol, Ré, La…), sur trois anneaux. Anneau intérieur : l'accord majeur de la
   tonalité ; au milieu : son relatif mineur ; à l'extérieur : l'accord diminué de son 7e degré. Une tonalité utilise sept
   accords voisins : IV, I, V (majeurs), ii, vi, iii (mineurs) et vii° (diminué).

   Musique.Harmony.mount(container, opts) construit l'interface et renvoie { render, stop }.
   opts : instrument (accords, schémas, son), getTempo() -> BPM, onSend(ids) appelé par « Envoyer dans Composer ». */
(function () {
  'use strict';

  var M = window.Musique, el = M.el, sv = M.sv, setPressed = M.setPressed;
  var H = M.Harmony = {};

  var CIRCLE = [{ l: 0, a: 0 }, { l: 4, a: 0 }, { l: 1, a: 0 }, { l: 5, a: 0 }, { l: 2, a: 0 }, { l: 6, a: 0 },
    { l: 3, a: 1 }, { l: 1, a: -1 }, { l: 5, a: -1 }, { l: 2, a: -1 }, { l: 6, a: -1 }, { l: 3, a: 0 }];
  var SHARP_ORDER = [3, 0, 4, 1, 5, 2, 6];   // fa do sol ré la mi si : ordre d'apparition des dièses
  var FLAT_ORDER = [6, 2, 5, 1, 4, 0, 3];    // si mi la ré sol do fa : ordre d'apparition des bémols
  var NUMERALS = { i: 0, ii: 1, iii: 2, iv: 3, v: 4, vi: 5, vii: 6 };

  /* Suites en degrés : majuscule = accord majeur, minuscule = mineur, ° = diminué, 7 = septième de dominante, b = abaissé */
  var PROGS = {
    major: [
      { name: 'Les trois accords', f: ['I', 'IV', 'V', 'I'], d: 'La base du rock, du blues et de la folk.' },
      { name: 'Pop', f: ['I', 'V', 'vi', 'IV'], d: 'La suite la plus répandue en pop : lumineuse, elle retombe sur la tonique.' },
      { name: 'Pop, version mélancolique', f: ['vi', 'IV', 'I', 'V'], d: 'Les mêmes accords, en commençant par le relatif mineur.' },
      { name: 'Années 50', f: ['I', 'vi', 'IV', 'V'], d: 'Le « doo-wop » : tonique, relatif mineur, sous-dominante, dominante.' },
      { name: 'Cadence jazz', f: ['ii', 'V7', 'I'], d: 'La cadence parfaite du jazz : ii – V – I.' },
      { name: 'Boucle jazz', f: ['I', 'vi', 'ii', 'V7'], d: 'Un tour qui revient sans cesse sur la tonique.' },
      { name: 'Canon', f: ['I', 'V', 'vi', 'iii', 'IV', 'I', 'IV', 'V'], d: 'Huit accords qui descendent par degrés, comme le canon de Pachelbel.' },
      { name: 'Rock mixolydien', f: ['I', 'bVII', 'IV', 'I'], d: 'Emprunte le VII abaissé (hors tonalité) : un son plus rock, moins sage.' },
      { name: 'Blues en 12 mesures', f: ['I7', 'I7', 'I7', 'I7', 'IV7', 'IV7', 'I7', 'I7', 'V7', 'IV7', 'I7', 'V7'], d: 'La grille du blues, en accords de septième.' }
    ],
    minor: [
      { name: 'Épique', f: ['i', 'VI', 'III', 'VII'], d: 'Très utilisée en pop sombre et en musique de film.' },
      { name: 'Cadence andalouse', f: ['i', 'VII', 'VI', 'V'], d: 'La descente typique du flamenco, qui se termine sur la dominante majeure.' },
      { name: 'Mineur classique', f: ['i', 'iv', 'V', 'i'], d: 'La dominante majeure tire fortement vers la tonique.' },
      { name: 'Boucle rock', f: ['i', 'VII', 'VI', 'VII'], d: 'Une boucle simple qui descend puis remonte.' },
      { name: 'Vers le relatif majeur', f: ['i', 'iv', 'VII', 'III'], d: 'La suite monte vers le relatif majeur, plus lumineux.' },
      { name: 'Cadence jazz mineure', f: ['ii°', 'V7', 'i'], d: 'La version mineure de la cadence jazz : ii° – V – i.' },
      { name: 'Blues mineur', f: ['i', 'i', 'i', 'i', 'iv', 'iv', 'i', 'i', 'V7', 'iv', 'i', 'V7'], d: 'La grille du blues en 12 mesures, en mineur (accords simples).' }
    ]
  };
  H.PROGS = PROGS;

  H.mount = function (container, opts) {
    var inst = opts.instrument, hw = { pos: 0, minor: false, gb: false }, prev = { srcs: [], timers: [], btn: null };

    /* ================= Théorie ================= */
    function majorScale(root) { return M.MODES[0].semis.map(function (s, k) { return M.spell(root, s, k); }); } // MODES[0] : majeure
    function wheelRoot(q) { return q === 6 && hw.gb ? { l: 4, a: -1 } : CIRCLE[q]; }
    function chordFor(root, q) { return inst.chordFor(root, q); }
    /* Accord de la case (anneau, position) de la roue */
    function wheelChord(ring, q) {
      var sc = majorScale(wheelRoot(q));
      return ring === 'maj' ? chordFor(sc[0], 'maj') : ring === 'min' ? chordFor(sc[5], 'min') : chordFor(sc[6], 'dim');
    }
    /* Tonique de la tonalité choisie : la majeure de la position, ou son relatif mineur */
    function keyTonic() { var sc = majorScale(wheelRoot(hw.pos)); return hw.minor ? sc[5] : sc[0]; }
    /* Nom court pour la roue : « C », « Am », « B° » */
    function wheelLabel(c, ring) { return M.fmt(c.root) + (ring === 'min' ? 'm' : ring === 'dim' ? '°' : ''); }

    /* Les 7 accords de la tonalité dans la roue : { 'maj3': 'IV', ... } */
    function wheelMembers() {
      var q = hw.pos, p = (q + 11) % 12, n = (q + 1) % 12, m = {};
      if (!hw.minor) {
        m['maj' + p] = 'IV'; m['maj' + q] = 'I'; m['maj' + n] = 'V';
        m['min' + p] = 'ii'; m['min' + q] = 'vi'; m['min' + n] = 'iii'; m['dim' + q] = 'vii°';
      } else {
        m['min' + q] = 'i'; m['dim' + q] = 'ii°'; m['maj' + q] = 'III';
        m['min' + p] = 'iv'; m['min' + n] = 'v'; m['maj' + p] = 'VI'; m['maj' + n] = 'VII';
      }
      return m;
    }

    /* Armure de la position q : nombre et noms des altérations */
    function signature(q) {
      var flats = q > 6 || (q === 6 && hw.gb), n = q === 0 ? 0 : flats ? (q === 6 ? 6 : 12 - q) : q, order = flats ? FLAT_ORDER : SHARP_ORDER, notes = [], k;
      for (k = 0; k < n; k++) notes.push(M.fmt({ l: order[k], a: flats ? -1 : 1 }));
      return { n: n, flats: flats, text: n === 0 ? 'Aucune altération' : n + ' ' + (flats ? 'bémol' : 'dièse') + (n > 1 ? 's' : '') + ' : ' + notes.join(' ') };
    }
    function sigShort(s) { return s.n ? s.n + (s.flats ? ' ♭' : ' ♯') : 'sans altération'; }

    /* Accord d'un degré (« V7 », « ii° », « bVII ») dans la tonalité de tonique `tonic` ; null si impossible */
    function romanChord(tonic, minor, token) {
      var m = /^(b|♭)?(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)(°|7)?$/.exec(token);
      if (!m) return null;
      var low = m[2] === m[2].toLowerCase(), d = NUMERALS[m[2].toLowerCase()];
      var semis = M.MODES[minor ? 1 : 0].semis[d] - (m[1] ? 1 : 0);
      var q = m[3] === '°' ? 'dim' : m[3] === '7' && !low ? 'dom7' : low ? 'min' : 'maj';
      return chordFor(M.spell(tonic, semis, d), q);
    }
    /* Les sept accords de la tonalité (plus le V majeur en mineur) : { roman, fn, chord } */
    function keyChords() {
      var t = keyTonic(), out = [];
      var spec = hw.minor
        ? [['i', 'Tonique'], ['ii°', 'Sous-dominante'], ['III', 'Tonique'], ['iv', 'Sous-dominante'], ['v', 'Dominante'], ['VI', 'Sous-dominante'], ['VII', 'Dominante'], ['V', 'Dominante (V majeur)']]
        : [['I', 'Tonique'], ['ii', 'Sous-dominante'], ['iii', 'Tonique'], ['IV', 'Sous-dominante'], ['V', 'Dominante'], ['vi', 'Tonique'], ['vii°', 'Dominante']];
      spec.forEach(function (s) { var c = romanChord(t, hw.minor, s[0]); if (c) out.push({ roman: s[0], fn: s[1], chord: c }); });
      return out;
    }

    /* ================= Interface ================= */
    var idKey = M.uid('hkey'), idMode = M.uid('hmode');
    var cardWheel = el('div', 'card'), cardTiles = el('section', 'card'), cardProgs = el('section', 'card');
    var harm = el('div', 'harm'), wheelBox = el('div', 'wheel'), info = el('div', 'hinfo');
    var svg = sv('svg', { viewBox: '0 0 420 420', role: 'img', 'aria-label': 'Roue des accords : douze tonalités rangées par quintes, sur trois anneaux' });
    var inputs = el('div', 'inputs'), fKey = el('div', 'field'), fMode = el('div', 'field small'), selKey = el('select'), modeSeg = el('div', 'seg');
    var gbLab = el('label', 'check'), gb = el('input'), gbText = el('span'), sigP = el('p', 'hsig'), relP = el('p', 'muted');
    var tiles = el('div', 'dtiles'), tilesNote = el('p', 'muted'), progs = el('div', 'progs');

    cardWheel.appendChild(el('h2', '', 'Roue des accords'));
    cardWheel.appendChild(el('p', 'muted', 'Les tonalités sont rangées par quintes. Chaque tonalité utilise sept accords voisins sur la roue : trois majeurs (IV, I, V) à l’intérieur, trois mineurs (ii, vi, iii) au milieu et un diminué (vii°) à l’extérieur. Touchez un accord pour l’entendre et choisir la tonalité.'));
    wheelBox.appendChild(svg);
    selKey.id = idKey;
    fKey.appendChild(el('label', '', 'Tonalité')); fKey.firstChild.setAttribute('for', idKey); fKey.appendChild(selKey);
    modeSeg.setAttribute('role', 'group'); modeSeg.setAttribute('aria-labelledby', idMode);
    var modeLab = el('span', 'lab', 'Mode'); modeLab.id = idMode;
    ['major', 'minor'].forEach(function (m) {
      var b = el('button', '', m === 'major' ? 'Majeur' : 'Mineur');
      b.type = 'button'; b.setAttribute('data-hmode', m);
      b.addEventListener('click', function () { hw.minor = m === 'minor'; render(); });
      modeSeg.appendChild(b);
    });
    fMode.appendChild(modeLab); fMode.appendChild(modeSeg);
    inputs.appendChild(fKey); inputs.appendChild(fMode);
    gb.type = 'checkbox';
    gbLab.appendChild(gb); gbLab.appendChild(document.createTextNode(' ')); gbLab.appendChild(gbText);
    info.appendChild(inputs); info.appendChild(gbLab); info.appendChild(sigP); info.appendChild(relP);
    harm.appendChild(wheelBox); harm.appendChild(info);
    cardWheel.appendChild(harm);

    cardTiles.setAttribute('aria-label', 'Accords de la tonalité');
    cardTiles.appendChild(el('h2', '', 'Accords de la tonalité'));
    cardTiles.appendChild(tiles); cardTiles.appendChild(tilesNote);

    cardProgs.setAttribute('aria-label', 'Suites possibles');
    cardProgs.appendChild(el('h2', '', 'Suites possibles'));
    cardProgs.appendChild(el('p', 'muted', 'Chaque suite est donnée en degrés (chiffres romains : majuscule = majeur, minuscule = mineur, ° = diminué), puis dans la tonalité choisie. Écoutez-la, ou envoyez-la dans Composer pour la jouer avec un rythme et la boîte à rythmes.'));
    cardProgs.appendChild(progs);
    container.appendChild(cardWheel); container.appendChild(cardTiles); container.appendChild(cardProgs);

    /* Secteur d'anneau (angles en degrés, 0 = droite, sens horaire) */
    function sectorPath(cx, cy, r0, r1, a0, a1) {
      function pt(r, a) { var t = a * Math.PI / 180; return (cx + r * Math.cos(t)).toFixed(1) + ' ' + (cy + r * Math.sin(t)).toFixed(1); }
      return 'M' + pt(r1, a0) + ' A' + r1 + ' ' + r1 + ' 0 0 1 ' + pt(r1, a1) + ' L' + pt(r0, a1) + ' A' + r0 + ' ' + r0 + ' 0 0 0 ' + pt(r0, a0) + ' Z';
    }

    function renderWheel() {
      var cx = 210, cy = 210, members = wheelMembers(), tonicKey = (hw.minor ? 'min' : 'maj') + hw.pos;
      var rings = [['maj', 72, 112, 17], ['min', 112, 152, 15], ['dim', 152, 190, 13]];
      svg.replaceChildren();
      rings.forEach(function (rg) {
        var ring = rg[0], q;
        for (q = 0; q < 12; q++) {
          var c = wheelChord(ring, q), a0 = q * 30 - 105, a1 = q * 30 - 75, mid = (q * 30 - 90) * Math.PI / 180, rm = (rg[1] + rg[2]) / 2;
          var key = ring + q, roman = members[key], hue = (50 + q * 30) % 360, light = ring === 'maj' ? 62 : ring === 'min' ? 72 : 82;
          var g = sv('g', { 'data-ring': ring, 'data-q': q }), cls = 'cw-seg ' + (roman ? 'on' : 'off') + (key === tonicKey ? ' tonic' : '');
          var path = sv('path', { d: sectorPath(cx, cy, rg[1], rg[2], a0, a1) }, cls);
          path.style.fill = 'hsl(' + hue + ' ' + (ring === 'maj' ? 70 : ring === 'min' ? 60 : 45) + '% ' + light + '%)';
          g.appendChild(path);
          var label = c ? wheelLabel(c, ring) : '—', fs = rg[3] * (label.length > 4 ? 0.65 : label.length > 2 ? 0.8 : 1);
          var tx = cx + rm * Math.cos(mid), ty = cy + rm * Math.sin(mid) - (roman ? 5 : 0);
          var t = sv('text', { x: tx.toFixed(1), y: ty.toFixed(1), 'font-size': fs.toFixed(1) }, 'cw-t');
          t.textContent = label;
          g.appendChild(t);
          if (roman) {
            var n = sv('text', { x: tx.toFixed(1), y: (ty + 13).toFixed(1) }, 'cw-n');
            n.textContent = roman;
            g.appendChild(n);
          }
          svg.appendChild(g);
        }
      });
      var sig = signature(hw.pos);
      var c1 = sv('text', { x: cx, y: cy - 10 }, 'cw-c1'), c2 = sv('text', { x: cx, y: cy + 14 }, 'cw-c2');
      c1.textContent = M.fmt(keyTonic()) + (hw.minor ? ' mineur' : ' majeur');
      c2.textContent = sigShort(sig);
      svg.appendChild(c1); svg.appendChild(c2);
    }

    function render() {
      var tonic = keyTonic(), sig = signature(hw.pos), q, rel;
      selKey.replaceChildren();
      for (q = 0; q < 12; q++) {
        var sc = majorScale(wheelRoot(q)), t = hw.minor ? sc[5] : sc[0];
        var o = el('option', '', M.fmt(t) + (hw.minor ? ' mineur' : ' majeur') + ' · ' + sigShort(signature(q)));
        o.value = q;
        selKey.appendChild(o);
      }
      selKey.value = hw.pos;
      setPressed(modeSeg.querySelectorAll('button'), function (b) { return (b.getAttribute('data-hmode') === 'minor') === hw.minor; });
      gbLab.hidden = hw.pos !== 6;
      gb.checked = hw.gb;
      gbText.textContent = 'Écrire en bémols (' + M.fmt({ l: 4, a: -1 }) + ' plutôt que ' + M.fmt({ l: 3, a: 1 }) + ')';
      sigP.textContent = M.fmt(tonic) + (hw.minor ? ' mineur' : ' majeur') + ' · ' + sig.text;
      rel = majorScale(wheelRoot(hw.pos));
      relP.textContent = hw.minor ? 'Relatif majeur : ' + M.fmt(rel[0]) + ' majeur (mêmes notes, autre tonique).' : 'Relatif mineur : ' + M.fmt(rel[5]) + ' mineur (mêmes notes, autre tonique).';
      renderWheel();
      tiles.replaceChildren();
      keyChords().forEach(function (k) {
        var b = el('button', 'chord-btn');
        b.type = 'button';
        b.setAttribute('aria-label', 'Accord ' + M.chordTitle(k.chord) + ', ' + k.roman + ', ' + k.fn);
        b.appendChild(el('b', '', M.chordTitle(k.chord)));
        if (inst.diagram) b.appendChild(inst.diagram(k.chord));
        b.appendChild(el('small', 'rn', k.roman + ' · ' + k.fn));
        b.addEventListener('click', function () { hear(k.chord); });
        tiles.appendChild(b);
      });
      tilesNote.textContent = hw.minor
        ? 'En mineur, on remplace souvent le v mineur par un V majeur : il tire plus fort vers la tonique.'
        : 'Tonique : repos. Sous-dominante : mouvement qui s’éloigne. Dominante : tension qui demande à revenir sur la tonique.';
      renderProgs();
    }

    function hear(c) { if (c && M.audio()) inst.chord(c, M.audio().currentTime + 0.02, 1); }

    /* ----- Suites ----- */
    function stopPreview() {
      M.stopSources(prev.srcs);
      prev.timers.forEach(clearTimeout);
      prev.srcs = []; prev.timers = [];
      Array.prototype.forEach.call(progs.querySelectorAll('.pc.now'), function (c) { c.classList.remove('now'); });
      if (prev.btn) { prev.btn.textContent = 'Écouter'; prev.btn = null; }
    }

    function playProg(btn, chords, chips) {
      var again = prev.btn === btn, ctx;
      stopPreview();
      if (again || !(ctx = M.audio())) return;
      var dur = 2 * 60 / (opts.getTempo ? opts.getTempo() : 90), t0 = ctx.currentTime + 0.1;
      prev.srcs = M.capture(function () {
        chords.forEach(function (c, i) {
          inst.chord(c, t0 + i * dur, 1);
          inst.chord(c, t0 + i * dur + dur / 2, 0.8);
        });
      });
      chords.forEach(function (c, i) {
        prev.timers.push(setTimeout(function () {
          Array.prototype.forEach.call(chips, function (ch, k) { ch.classList.toggle('now', k === i); });
        }, Math.max(0, (t0 + i * dur - ctx.currentTime) * 1000)));
      });
      prev.timers.push(setTimeout(stopPreview, (chords.length * dur + 0.4) * 1000));
      prev.btn = btn;
      btn.textContent = 'Arrêter';
    }

    function renderProgs() {
      var tonic = keyTonic();
      stopPreview();
      progs.replaceChildren();
      (hw.minor ? PROGS.minor : PROGS.major).forEach(function (p) {
        var chords = p.f.map(function (tk) { return romanChord(tonic, hw.minor, tk); });
        if (chords.some(function (c) { return !c; })) return;
        var card = el('div', 'prog'), chips = el('div', 'pchips'), acts = el('div', 'actions'), btns = [];
        card.appendChild(el('h3', '', p.name));
        card.appendChild(el('p', 'muted', p.f.join(' – ')));
        chords.forEach(function (c, i) {
          var b = el('button', 'pc');
          b.type = 'button';
          b.appendChild(el('b', '', M.chordTitle(c)));
          b.appendChild(el('small', '', p.f[i]));
          b.addEventListener('click', function () { hear(c); });
          chips.appendChild(b);
          btns.push(b);
        });
        card.appendChild(chips);
        card.appendChild(el('p', 'muted', p.d));
        var playB = el('button', 'btn ghost', 'Écouter'), send = el('button', 'btn ghost', 'Envoyer dans Composer');
        playB.type = send.type = 'button';
        playB.addEventListener('click', function () { playProg(playB, chords, btns); });
        send.addEventListener('click', function () { stopPreview(); if (opts.onSend) opts.onSend(chords.map(function (c) { return c.id; })); });
        acts.appendChild(playB); acts.appendChild(send);
        card.appendChild(acts);
        progs.appendChild(card);
      });
    }

    svg.addEventListener('click', function (e) {
      var g = e.target.closest ? e.target.closest('[data-ring]') : null;
      if (!g) return;
      var ring = g.getAttribute('data-ring'), q = Number(g.getAttribute('data-q')), c = wheelChord(ring, q);
      hw.pos = q;
      hw.minor = ring === 'min';
      render();
      hear(c);
    });
    selKey.addEventListener('change', function () { hw.pos = Number(this.value); render(); });
    gb.addEventListener('change', function () { hw.gb = this.checked; render(); });

    M.onNotation(render);
    render();
    return { render: render, stop: stopPreview };
  };
})();
