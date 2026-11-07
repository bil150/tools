/* Batterie : sons synthétisés (bruit filtré et oscillateurs, sans échantillon), styles et grille éditable.
   Expose Musique.Drums. Dépend de musique/core.js. Indépendante de l'instrument : Composer lui demande les coups
   d'une mesure (events) et les joue (play).
   Un style est une grille de pas : 16 pas = doubles-croches ; 12 pas = croches ternaires (shuffle, swing, 12/8).
   Chaque caractère d'une ligne vaut une intensité : . éteint, o fantôme, x normal, X accentué.
   Les styles sont des versions simplifiées, faites pour être modifiées. */
(function () {
  'use strict';

  var M = window.Musique, $ = M.$, el = M.el, clamp = M.clamp;
  var D = M.Drums = {};

  var DRUM_LEVELS = [0, 0.4, 0.75, 1];
  var DRUM_CHAR = { '.': 0, o: 0.4, x: 0.75, X: 1 };
  var noiseBuf = null;

  /* ================= Sons ================= */
  function noiseBuffer(ctx) {
    if (!noiseBuf) {
      var n = ctx.sampleRate, d, i;
      noiseBuf = ctx.createBuffer(1, n, n);
      d = noiseBuf.getChannelData(0);
      for (i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  }
  /* Enveloppe : monte en `att` secondes, puis retombe en `dur` */
  function dEnv(g, t, att, dur, peak) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + att);
    g.gain.exponentialRampToValueAtTime(0.0001, t + att + dur);
  }
  /* Bruit filtré : o = { type, freq, q, att, dur, gain } */
  function noiseHit(t, vol, o) {
    var ctx = M.audio(), out = M.bus('drums');
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), att = o.att || 0.002;
    s.buffer = noiseBuffer(ctx);
    f.type = o.type; f.frequency.value = o.freq; f.Q.value = o.q || 0.7;
    dEnv(g, t, att, o.dur, vol * (o.gain === undefined ? 1 : o.gain));
    s.connect(f); f.connect(g); g.connect(out);
    s.start(t, Math.random() * 0.5);
    s.stop(t + att + o.dur + 0.05);
    M.track(s);
  }
  /* Son tonal qui glisse de f0 à f1 : o = { type, f0, f1, sweep, dur, gain } */
  function toneHit(t, vol, o) {
    var ctx = M.audio(), out = M.bus('drums');
    var osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f0, t);
    osc.frequency.exponentialRampToValueAtTime(o.f1, t + (o.sweep || o.dur / 2));
    dEnv(g, t, 0.002, o.dur, vol * o.gain);
    osc.connect(g); g.connect(out);
    osc.start(t); osc.stop(t + o.dur + 0.05);
    M.track(osc);
  }

  var DRUMS = {
    kick: { name: 'Grosse caisse', play: function (t, v) {
      toneHit(t, v, { f0: 150, f1: 45, sweep: 0.08, dur: 0.4, gain: 1 });
      noiseHit(t, v, { type: 'lowpass', freq: 3000, dur: 0.02, gain: 0.15 });
    } },
    snare: { name: 'Caisse claire', play: function (t, v) {
      toneHit(t, v, { type: 'triangle', f0: 230, f1: 170, dur: 0.12, gain: 0.5 });
      noiseHit(t, v, { type: 'bandpass', freq: 1900, q: 0.6, dur: 0.2, gain: 0.9 });
    } },
    rim: { name: 'Rim (cross-stick)', play: function (t, v) {
      toneHit(t, v, { type: 'triangle', f0: 900, f1: 650, dur: 0.05, gain: 0.6 });
      noiseHit(t, v, { type: 'highpass', freq: 2500, dur: 0.03, gain: 0.3 });
    } },
    clap: { name: 'Claquement de mains', play: function (t, v) {
      [0, 0.011, 0.022].forEach(function (d, i) { noiseHit(t + d, v, { type: 'bandpass', freq: 1500, q: 1.5, dur: i === 2 ? 0.14 : 0.03, gain: 0.8 }); });
    } },
    hat: { name: 'Charleston fermé', play: function (t, v) { noiseHit(t, v, { type: 'highpass', freq: 7000, dur: 0.045, gain: 0.45 }); } },
    ohat: { name: 'Charleston ouvert', play: function (t, v) { noiseHit(t, v, { type: 'highpass', freq: 6500, dur: 0.3, gain: 0.4 }); } },
    ride: { name: 'Cymbale ride', play: function (t, v) {
      noiseHit(t, v, { type: 'highpass', freq: 5500, dur: 0.6, gain: 0.28 });
      toneHit(t, v, { f0: 3300, f1: 3200, dur: 0.35, gain: 0.07 });
    } },
    crash: { name: 'Cymbale crash', play: function (t, v) { noiseHit(t, v, { type: 'highpass', freq: 3500, att: 0.004, dur: 1.3, gain: 0.5 }); } },
    tom: { name: 'Tom', play: function (t, v) { toneHit(t, v, { f0: 190, f1: 100, dur: 0.3, gain: 0.8 }); } },
    shaker: { name: 'Shaker', play: function (t, v) { noiseHit(t, v, { type: 'bandpass', freq: 8000, q: 1, att: 0.02, dur: 0.05, gain: 0.3 }); } },
    doum: { name: 'Doum (darbouka grave)', play: function (t, v) { toneHit(t, v, { f0: 140, f1: 90, sweep: 0.05, dur: 0.3, gain: 1 }); } },
    tek: { name: 'Tek (darbouka aiguë)', play: function (t, v) {
      toneHit(t, v, { f0: 950, f1: 700, dur: 0.05, gain: 0.5 });
      noiseHit(t, v, { type: 'highpass', freq: 3200, dur: 0.05, gain: 0.3 });
    } },
    ka: { name: 'Ka (darbouka douce)', play: function (t, v) {
      toneHit(t, v, { f0: 1150, f1: 850, dur: 0.04, gain: 0.3 });
      noiseHit(t, v, { type: 'highpass', freq: 3500, dur: 0.03, gain: 0.2 });
    } },
    kra: { name: 'Krakeb (castagnettes gnawa)', play: function (t, v) {
      [0, 0.018].forEach(function (d) { noiseHit(t + d, v, { type: 'bandpass', freq: 5200, q: 4, dur: 0.04, gain: 0.6 }); });
    } },
    tbel: { name: 'Tbel (grosse caisse gnawa)', play: function (t, v) {
      toneHit(t, v, { f0: 100, f1: 55, sweep: 0.1, dur: 0.55, gain: 1 });
      noiseHit(t, v, { type: 'lowpass', freq: 700, dur: 0.05, gain: 0.2 });
    } }
  };
  var DRUM_ORDER = ['kick', 'snare', 'rim', 'clap', 'hat', 'ohat', 'ride', 'crash', 'tom', 'shaker', 'doum', 'tek', 'ka', 'kra', 'tbel'];

  /* ================= Styles ================= */
  /* bpm : tempo conseillé ; accomp : rythme conseillé pour chaque instrument (clé = id de l'instrument, voir RHYTHMS) */
  var STYLES = [
    { id: 'pop', group: 'Pop, rock, metal', name: 'Pop', bpm: 100, steps: 16, accomp: { guitar: 'folk', piano: 'croches', bass: 'croches' },
      desc: 'Grosse caisse sur 1 et 3, caisse claire et claquement de mains sur 2 et 4, charleston en croches.',
      rows: { kick: 'X.......X.x.....', snare: '....X.......X...', clap: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' } },
    { id: 'rock', group: 'Pop, rock, metal', name: 'Rock', bpm: 120, steps: 16, accomp: { guitar: 'temps', piano: 'noires', bass: 'croches' },
      desc: 'Charleston en croches accentué, grosse caisse qui pousse, crash sur le premier temps.',
      rows: { kick: 'X.......X.X.....', snare: '....X.......X...', hat: 'X.x.x.x.X.x.x.x.', crash: 'X...............' } },
    { id: 'metal', group: 'Pop, rock, metal', name: 'Metal', bpm: 100, steps: 16, accomp: { guitar: 'temps', piano: 'noires', bass: 'galop' },
      desc: 'Double grosse caisse en doubles-croches, caisse claire sur 2 et 4, crash sur le premier temps.',
      rows: { kick: 'XxXxXxXxXxXxXxXx', snare: '....X.......X...', hat: 'x.x.x.x.x.x.x.x.', crash: 'X...............' } },
    { id: 'blues', group: 'Blues, jazz, country', name: 'Blues (shuffle)', bpm: 90, steps: 12, accomp: { guitar: 'shuffle', piano: 'noires', bass: 'shuffle' },
      desc: 'Shuffle ternaire : charleston en « long-court », caisse claire sur 2 et 4.',
      rows: { kick: 'X.....X.....', snare: '...X.....X..', hat: 'x.xx.xx.xx.x' } },
    { id: 'jazz', group: 'Blues, jazz, country', name: 'Jazz (swing)', bpm: 130, steps: 12, accomp: { guitar: 'plaque', piano: 'contretemps', bass: 'marche' },
      desc: 'Ride swing, charleston au pied sur 2 et 4, grosse caisse très légère, quelques notes fantômes à la caisse claire.',
      rows: { ride: 'X..x.oX..x.o', hat: '...x.....x..', kick: 'o..o..o..o..', snare: '..o.......o.' } },
    { id: 'country', group: 'Blues, jazz, country', name: 'Country (train)', bpm: 110, steps: 16, accomp: { guitar: 'folk', piano: 'noires', bass: 'quinte' },
      desc: 'Grosse caisse sur 1 et 3, caisse claire sur 2 et 4 précédée de notes fantômes, charleston en croches.',
      rows: { kick: 'X.......X.......', snare: '...oX......oX...', hat: 'x.x.x.x.x.x.x.x.' } },
    { id: 'funk', group: 'Groove et latin', name: 'Funk', bpm: 100, steps: 16, accomp: { guitar: 'temps', piano: 'contretemps', bass: 'funk' },
      desc: 'Charleston en doubles-croches, grosse caisse syncopée, notes fantômes à la caisse claire.',
      rows: { kick: 'X..x..x...x.x...', snare: '....X..o.o..X..o', hat: 'XoxoXoxoXoxoXoxo', ohat: '..............x.' } },
    { id: 'reggae', group: 'Groove et latin', name: 'Reggae (one drop)', bpm: 76, steps: 16, accomp: { guitar: 'skank', piano: 'contretemps', bass: 'reggae' },
      desc: 'Le temps 3 est seul marqué : grosse caisse et rim ensemble, charleston en croches.',
      rows: { kick: '........X.......', rim: '........X.......', hat: 'x.x.x.x.x.x.x.x.' } },
    { id: 'disco', group: 'Groove et latin', name: 'Disco', bpm: 118, steps: 16, accomp: { guitar: 'temps', piano: 'croches', bass: 'disco' },
      desc: 'Grosse caisse à chaque temps, claquement de mains sur 2 et 4, charleston ouvert sur les contretemps.',
      rows: { kick: 'X...X...X...X...', clap: '....x.......x...', hat: 'x...x...x...x...', ohat: '..x...x...x...x.' } },
    { id: 'bossa', group: 'Groove et latin', name: 'Bossa nova', bpm: 120, steps: 16, accomp: { guitar: 'arpege', piano: 'arpege', bass: 'quinte' },
      desc: 'Grosse caisse sur 1 et 3 avec un décalage, rim sur la clave 3-2, charleston en croches.',
      rows: { kick: 'X.....x.X.....x.', rim: 'X..x..x...x..x..', hat: 'x.x.x.x.x.x.x.x.' } },
    { id: 'gnawa', group: 'Maroc et Orient', name: 'Gnawa', bpm: 85, steps: 12, accomp: { guitar: 'arpege', piano: 'arpege', bass: 'shuffle' },
      desc: 'Rythme ternaire : krakeb (castagnettes métalliques) en continu, tbel (grosse caisse) qui marque les temps.',
      rows: { kra: 'XooXooXooXoo', tbel: 'X.....X.x...' } },
    { id: 'chaabi', group: 'Maroc et Orient', name: 'Chaabi (Maroc)', bpm: 110, steps: 16, accomp: { guitar: 'folk', piano: 'croches', bass: 'croches' },
      desc: 'Darbouka entraînante : doum sur 1 et 3, teks syncopés, krakeb léger en croches.',
      rows: { doum: 'X.......X.X.....', tek: '..x...x.....x.x.', kra: 'o.o.o.o.o.o.o.o.' } },
    { id: 'maqsum', group: 'Maroc et Orient', name: 'Maqsum', bpm: 100, steps: 16, accomp: { guitar: 'folk', piano: 'contretemps', bass: 'croches' },
      desc: 'Le rythme de base de la musique arabe : doum, tek, tek, doum, tek.',
      rows: { doum: 'X.......X.......', tek: '..x...x.....x...', ka: '....o.....o...o.' } },
    { id: 'baladi', group: 'Maroc et Orient', name: 'Baladi', bpm: 100, steps: 16, accomp: { guitar: 'folk', piano: 'croches', bass: 'croches' },
      desc: 'Doum doum, tek, doum, tek : un rythme populaire, plus lourd que le maqsum.',
      rows: { doum: 'X.x.....X.......', tek: '......x.....x...', ka: '....o.....o...o.' } },
    { id: 'saidi', group: 'Maroc et Orient', name: 'Saïdi', bpm: 105, steps: 16, accomp: { guitar: 'folk', piano: 'croches', bass: 'croches' },
      desc: 'Rythme de Haute-Égypte : doum, tek, doum doum, tek.',
      rows: { doum: 'X.....x.x.......', tek: '..x.........x...', ka: '....o.....o...o.' } }
  ];

  /* ================= État ================= */
  var state = { on: false, style: 'pop', vol: 70, steps: 16, dirty: false, rows: [] };
  var loop = { playing: false, timer: null, barStart: 0, j: 0 };
  D.STYLES = STYLES; D.NAMES = DRUMS; D.state = state;
  D.stopLoop = function () {}; D.isLooping = function () { return false; }; // remplacés par mount()

  function styleById(id) {
    for (var i = 0; i < STYLES.length; i++) if (STYLES[i].id === id) return STYLES[i];
    return STYLES[0];
  }
  D.style = styleById;
  function loadStyle(id) {
    var st = styleById(id);
    state.style = st.id;
    state.steps = st.steps;
    state.rows = Object.keys(st.rows).map(function (inst) {
      return { inst: inst, mute: false, cells: st.rows[inst].split('').map(function (ch) { return DRUM_CHAR[ch] || 0; }) };
    });
    state.dirty = false;
  }
  D.load = loadStyle;
  loadStyle(state.style);

  D.play = function (inst, when, vol) {
    var out;
    if (!DRUMS[inst] || !M.audio()) return;
    out = M.bus('drums');
    out.gain.value = 0.6 * state.vol / 100;
    DRUMS[inst].play(when, vol);
  };

  /* Coups d'un passage de `beats` temps qui commence à la position `p0` (en temps) de la mesure */
  D.events = function (p0, beats) {
    var evs = [], per = 4 / state.steps;
    state.rows.forEach(function (row) {
      if (row.mute) return;
      row.cells.forEach(function (v, j) {
        var pos = j * per;
        if (v > 0 && pos >= p0 - 1e-9 && pos < p0 + beats - 1e-9) evs.push({ at: pos - p0, drum: row.inst, vol: v });
      });
    });
    return evs;
  };

  D.data = function () {
    return { on: state.on, style: state.style, vol: state.vol, dirty: state.dirty,
      rows: state.rows.map(function (r) { return { inst: r.inst, mute: r.mute, cells: r.cells }; }) };
  };
  D.apply = function (d) {
    if (!d || typeof d !== 'object') return;
    if (STYLES.some(function (s) { return s.id === d.style; })) loadStyle(d.style);
    state.on = d.on === true;
    if (isFinite(d.vol)) state.vol = clamp(Math.round(d.vol), 0, 100);
    if (d.dirty === true && Array.isArray(d.rows) && d.rows.length) {
      var ok = d.rows.every(function (r) {
        return r && DRUMS[r.inst] && Array.isArray(r.cells) && r.cells.length === state.steps &&
          r.cells.every(function (v) { return typeof v === 'number' && v >= 0 && v <= 1; });
      });
      if (ok) {
        state.rows = d.rows.map(function (r) { return { inst: r.inst, mute: r.mute === true, cells: r.cells.slice() }; });
        state.dirty = true;
      }
    }
  };

  /* ================= Interface ================= */
  function levelName(v) { return v <= 0 ? 'éteint' : v <= 0.4 ? 'fantôme' : v <= 0.75 ? 'normal' : 'accentué'; }
  function nextLevel(v) {
    var i = 0, k;
    for (k = 0; k < DRUM_LEVELS.length; k++) if (Math.abs(DRUM_LEVELS[k] - v) < Math.abs(DRUM_LEVELS[i] - v)) i = k;
    return DRUM_LEVELS[(i + 1) % DRUM_LEVELS.length];
  }
  function paintCell(btn, row, j) {
    var v = row.cells[j];
    btn.style.setProperty('--v', v);
    if (v > 0) btn.setAttribute('data-on', ''); else btn.removeAttribute('data-on');
    btn.setAttribute('aria-label', DRUMS[row.inst].name + ', pas ' + (j + 1) + ' : ' + levelName(v));
  }

  /* Construit la carte « Batterie » dans `container`.
     opts : getTempo() -> BPM ; onChange() après chaque modification (pour sauvegarder) ;
            onSuggest(style) pour appliquer le tempo et les rythmes conseillés ; beforePlay() avant l'écoute seule. */
  D.mount = function (container, opts) {
    opts = opts || {};
    var card = el('section', 'card'), inputs = el('div', 'inputs'), idStyle = M.uid('dstyle'), idVol = M.uid('dvol');
    var on = el('input'), onLab = el('label', 'check'), fStyle = el('div', 'field'), fVol = el('div', 'field');
    var sel = el('select'), vol = el('input'), volVal = el('b', '', String(state.vol)), desc = el('p', 'muted');
    var scroll = el('div', 'scroll'), grid = el('div', 'dgrid'), actions = el('div', 'actions');
    var test = el('button', 'btn ghost', 'Écouter la batterie seule'), suggest = el('button', 'btn ghost', 'Tempo et rythmes conseillés');
    var reset = el('button', 'btn ghost', 'Remettre le style d’origine'), add = el('select');

    card.setAttribute('aria-label', 'Batterie');
    card.appendChild(el('h2', '', 'Batterie'));
    on.type = 'checkbox';
    onLab.appendChild(on);
    onLab.appendChild(document.createTextNode(' Jouer avec la batterie'));
    sel.id = idStyle;
    fStyle.appendChild(el('label', '', 'Style')); fStyle.firstChild.setAttribute('for', idStyle); fStyle.appendChild(sel);
    vol.type = 'range'; vol.min = '0'; vol.max = '100'; vol.step = '1'; vol.id = idVol;
    var volLab = el('label'); volLab.setAttribute('for', idVol);
    volLab.appendChild(document.createTextNode('Volume : ')); volLab.appendChild(volVal); volLab.appendChild(document.createTextNode(' %'));
    fVol.appendChild(volLab); fVol.appendChild(vol);
    inputs.appendChild(onLab); inputs.appendChild(fStyle); inputs.appendChild(fVol);
    card.appendChild(inputs);
    card.appendChild(desc);
    scroll.appendChild(grid);
    card.appendChild(scroll);
    [test, suggest, reset].forEach(function (b) { b.type = 'button'; actions.appendChild(b); });
    add.setAttribute('aria-label', 'Ajouter un instrument');
    actions.appendChild(add);
    card.appendChild(actions);
    card.appendChild(el('p', 'muted', 'Touchez une case pour changer son intensité : fantôme, normale, accentuée, puis éteinte. Les styles sont simplifiés : adaptez-les à votre goût.'));
    container.appendChild(card);

    var grp = null, grpName = '';
    STYLES.forEach(function (s) {
      if (s.group !== grpName) { grpName = s.group; grp = el('optgroup'); grp.label = grpName; sel.appendChild(grp); }
      var o = el('option', '', s.name);
      o.value = s.id;
      grp.appendChild(o);
    });

    function changed() { if (opts.onChange) opts.onChange(); }
    function fillAdd() {
      var used = state.rows.map(function (r) { return r.inst; }), first = el('option', '', '+ Ajouter un instrument');
      first.value = '';
      add.replaceChildren(first);
      DRUM_ORDER.forEach(function (inst) {
        if (used.indexOf(inst) >= 0) return;
        var o = el('option', '', DRUMS[inst].name);
        o.value = inst;
        add.appendChild(o);
      });
      add.value = '';
    }
    function describe() { desc.textContent = styleById(state.style).desc + (state.dirty ? ' (rythme modifié)' : ''); }

    function render() {
      var per = state.steps / 4, head = el('div', 'drow head'), j;
      grid.replaceChildren();
      grid.style.setProperty('--cols', state.steps);
      head.appendChild(el('span', 'dlab-h', 'Temps'));
      for (j = 0; j < state.steps; j++) {
        var h = el('span', 'dh' + (j % per === 0 ? ' beat' : ''), j % per === 0 ? String(j / per + 1) : '');
        h.setAttribute('data-j', j);
        head.appendChild(h);
      }
      grid.appendChild(head);
      state.rows.forEach(function (row, ri) {
        var r = el('div', 'drow' + (row.mute ? ' muted' : '')), lab = el('div', 'dlab'), name = DRUMS[row.inst].name;
        var m = el('button', 'dm', 'M'), x = el('button', 'dx', '×');
        lab.appendChild(el('span', 'dn', name));
        m.type = x.type = 'button';
        m.setAttribute('data-act', 'mute'); m.setAttribute('data-r', ri);
        m.setAttribute('aria-pressed', String(row.mute)); m.setAttribute('aria-label', 'Couper : ' + name); m.title = 'Couper cet instrument';
        x.setAttribute('data-act', 'del'); x.setAttribute('data-r', ri);
        x.setAttribute('aria-label', 'Retirer : ' + name); x.title = 'Retirer cet instrument';
        lab.appendChild(m); lab.appendChild(x);
        r.appendChild(lab);
        row.cells.forEach(function (v, k) {
          var c = el('button', 'dcell' + (k % per === 0 ? ' beat' : ''));
          c.type = 'button';
          c.setAttribute('data-act', 'cell'); c.setAttribute('data-r', ri); c.setAttribute('data-j', k);
          paintCell(c, row, k);
          r.appendChild(c);
        });
        grid.appendChild(r);
      });
      describe();
      on.checked = state.on;
      vol.value = state.vol;
      volVal.textContent = state.vol;
      sel.value = state.style;
      fillAdd();
    }

    /* ----- Écoute de la batterie seule ----- */
    function markCol(j, when) {
      setTimeout(function () {
        if (!loop.playing) return;
        Array.prototype.forEach.call(grid.querySelectorAll('.dcell, .dh'), function (c) {
          c.classList.toggle('cur', Number(c.getAttribute('data-j')) === j);
        });
      }, Math.max(0, (when - M.audio().currentTime) * 1000));
    }
    function tickLoop() {
      var ctx = M.audio(), spb = 60 / (opts.getTempo ? opts.getTempo() : 90), horizon = ctx.currentTime + 0.15, per = 4 / state.steps, t;
      for (;;) {
        t = loop.barStart + loop.j * per * spb;
        if (t >= horizon) return;
        state.rows.forEach(function (row) { if (!row.mute && row.cells[loop.j] > 0) D.play(row.inst, t, row.cells[loop.j]); });
        markCol(loop.j, t);
        loop.j++;
        if (loop.j >= state.steps) { loop.j = 0; loop.barStart += 4 * spb; }
      }
    }
    function startLoop() {
      var ctx = M.audio();
      if (!ctx) return;
      if (opts.beforePlay) opts.beforePlay();
      loop.playing = true;
      loop.barStart = ctx.currentTime + 0.1;
      loop.j = 0;
      loop.timer = setInterval(tickLoop, 25);
      test.textContent = 'Arrêter la batterie';
    }
    function stopLoop() {
      loop.playing = false;
      if (loop.timer) { clearInterval(loop.timer); loop.timer = null; }
      Array.prototype.forEach.call(grid.querySelectorAll('.cur'), function (c) { c.classList.remove('cur'); });
      test.textContent = 'Écouter la batterie seule';
    }
    D.stopLoop = stopLoop;
    D.isLooping = function () { return loop.playing; };

    /* ----- Événements ----- */
    sel.addEventListener('change', function () { loadStyle(this.value); render(); changed(); });
    on.addEventListener('change', function () { state.on = this.checked; changed(); });
    vol.addEventListener('input', function () { state.vol = Number(this.value); volVal.textContent = state.vol; changed(); });
    test.addEventListener('click', function () { if (loop.playing) stopLoop(); else startLoop(); });
    reset.addEventListener('click', function () { loadStyle(state.style); render(); changed(); });
    suggest.addEventListener('click', function () { if (opts.onSuggest) opts.onSuggest(styleById(state.style)); });
    add.addEventListener('change', function () {
      if (!this.value) return;
      var cells = [], j;
      for (j = 0; j < state.steps; j++) cells.push(0);
      state.rows.push({ inst: this.value, mute: false, cells: cells });
      state.dirty = true;
      render();
      changed();
    });
    grid.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button') : null;
      if (!b) return;
      var act = b.getAttribute('data-act'), row = state.rows[Number(b.getAttribute('data-r'))], j;
      if (!row) return;
      if (act === 'cell') {
        j = Number(b.getAttribute('data-j'));
        row.cells[j] = nextLevel(row.cells[j]);
        state.dirty = true;
        paintCell(b, row, j);
        describe();
        if (row.cells[j] > 0 && M.audio()) D.play(row.inst, M.audio().currentTime + 0.01, row.cells[j]);
      } else if (act === 'mute') {
        row.mute = !row.mute;
        b.setAttribute('aria-pressed', String(row.mute));
        b.parentNode.parentNode.classList.toggle('muted', row.mute);
      } else if (act === 'del') {
        state.rows.splice(state.rows.indexOf(row), 1);
        state.dirty = true;
        render();
      }
      changed();
    });
    window.addEventListener('pagehide', stopLoop);

    render();
    return { render: render, stop: stopLoop };
  };
})();
