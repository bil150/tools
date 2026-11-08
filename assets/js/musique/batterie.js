/* Boîte à rythmes : sons synthétisés (bruit filtré et oscillateurs, sans échantillon), styles et grille éditable.
   Expose Musique.Drums. Dépend de musique/core.js. Indépendante de l'instrument : la page « Boîte à rythmes » la monte et la
   modifie ; Composer lui demande les coups du motif (events) et les joue (play). Elle est la même partout (une seule sauvegarde).
   Un style est une grille de pas : 16 pas = doubles-croches ; 12 pas = croches ternaires (shuffle, swing, 12/8). Une mesure dure
   en général 4 temps ; `len` donne une autre durée en temps (2/4, 6/4, 8/4, 9/8 = 4,5 temps, 10/8 = 5 temps) et `groups` le
   découpage de la mesure en pas (3+2+2+3 pour le samaï thaqil).
   Chaque caractère d'une ligne vaut une intensité : . éteint, o fantôme, x normal, X accentué.
   Chaque style a des variations, et un motif peut compter plusieurs mesures (jusqu'à 8), éditées une à une.
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

  /* Plusieurs carrés désaccordés puis filtrés : le « métal » des charlestons synthétiques. o = { freqs, hp, dur, gain } */
  function metalHit(t, vol, o) {
    var ctx = M.audio(), out = M.bus('drums'), g = ctx.createGain(), f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = o.hp;
    o.freqs.forEach(function (fr) {
      var osc = ctx.createOscillator();
      osc.type = 'square'; osc.frequency.value = fr;
      osc.connect(f);
      osc.start(t); osc.stop(t + o.dur + 0.06);
      M.track(osc);
    });
    dEnv(g, t, 0.001, o.dur, vol * o.gain);
    f.connect(g); g.connect(out);
  }
  /* Trois kits électroniques de synthèse maison : « sec » net et court, « rond » profond et plein, « vif » percutant et brillant */
  var KITS = {
    sec: { kick: { f0: 170, f1: 55, sweep: 0.06, dur: 0.35, gain: 1, click: 0.15 }, kick2: { f0: 240, f1: 70, sweep: 0.04, dur: 0.2, gain: 1, click: 0.3 },
      snare: { type: 'square', f0: 330, f1: 220, tdur: 0.08, tgain: 0.3, nf: 2400, ndur: 0.12, ngain: 0.7 },
      clap: { freq: 1600, q: 1.4, gap: 0.012, tail: 0.16, gain: 0.65 },
      hat: { freqs: [330, 447, 592, 688, 904, 1010], hp: 9200, dur: 0.035, gain: 0.1 }, ohat: { freqs: [330, 447, 592, 688, 904, 1010], hp: 9000, dur: 0.22, gain: 0.09 },
      tom: { f0: 330, f1: 150, sweep: 0.1, dur: 0.28, gain: 0.8 } },
    rond: { kick: { f0: 130, f1: 38, sweep: 0.12, dur: 0.75, gain: 1, click: 0.2 }, kick2: { f0: 220, f1: 52, sweep: 0.05, dur: 0.28, gain: 1, click: 0.25 },
      snare: { type: 'triangle', f0: 310, f1: 190, tdur: 0.14, tgain: 0.55, nf: 1800, ndur: 0.18, ngain: 0.7 },
      clap: { freq: 1250, q: 1.2, gap: 0.009, tail: 0.22, gain: 0.7 },
      hat: { freqs: [271, 389, 563, 611, 839, 953], hp: 7500, dur: 0.05, gain: 0.12 }, ohat: { freqs: [271, 389, 563, 611, 839, 953], hp: 7000, dur: 0.34, gain: 0.1 },
      tom: { f0: 260, f1: 110, sweep: 0.15, dur: 0.45, gain: 0.8 } },
    vif: { kick: { f0: 180, f1: 46, sweep: 0.04, dur: 0.42, gain: 1, click: 0.4 }, kick2: { f0: 260, f1: 60, sweep: 0.03, dur: 0.22, gain: 1, click: 0.45 },
      snare: { type: 'triangle', f0: 260, f1: 170, tdur: 0.1, tgain: 0.4, nf: 2200, ndur: 0.22, ngain: 0.95 },
      clap: { freq: 1000, q: 0.9, gap: 0.014, tail: 0.28, gain: 0.8 },
      hat: { freqs: [243, 417, 509, 701, 877, 1103], hp: 8200, dur: 0.06, gain: 0.14 }, ohat: { freqs: [243, 417, 509, 701, 877, 1103], hp: 7600, dur: 0.42, gain: 0.12 },
      tom: { f0: 220, f1: 90, sweep: 0.12, dur: 0.4, gain: 0.85 } }
  };
  var KIT_NAMES = [['sec', 'Sec : net et court'], ['rond', 'Rond : profond et plein'], ['vif', 'Vif : percutant et brillant']];
  /* Anciens noms des kits dans les sauvegardes déjà faites */
  var KIT_ANCIENS = { '700': 'sec', '800': 'rond', '900': 'vif' };
  function kit() { return KITS[state.kit] || KITS.rond; }

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
    } },
    ekick: { name: 'Grosse caisse synthé (profonde)', play: function (t, v) {
      var k = kit().kick;
      toneHit(t, v, { f0: k.f0, f1: k.f1, sweep: k.sweep, dur: k.dur, gain: k.gain });
      noiseHit(t, v, { type: 'lowpass', freq: 1200, dur: 0.01, gain: k.click });
    } },
    ekick2: { name: 'Grosse caisse synthé (sèche)', play: function (t, v) {
      var k = kit().kick2;
      toneHit(t, v, { f0: k.f0, f1: k.f1, sweep: k.sweep, dur: k.dur, gain: k.gain });
      noiseHit(t, v, { type: 'highpass', freq: 4000, dur: 0.012, gain: k.click });
    } },
    esnare: { name: 'Caisse claire synthé', play: function (t, v) {
      var k = kit().snare;
      toneHit(t, v, { type: k.type, f0: k.f0, f1: k.f1, dur: k.tdur, gain: k.tgain });
      noiseHit(t, v, { type: 'highpass', freq: k.nf, dur: k.ndur, gain: k.ngain });
    } },
    eclap: { name: 'Clap synthé', play: function (t, v) {
      var k = kit().clap;
      [0, k.gap, 2 * k.gap, 3 * k.gap].forEach(function (d, i) { noiseHit(t + d, v, { type: 'bandpass', freq: k.freq, q: k.q, dur: i === 3 ? k.tail : 0.025, gain: k.gain }); });
    } },
    ehat: { name: 'Charleston synthé fermé', play: function (t, v) { metalHit(t, v, kit().hat); } },
    eohat: { name: 'Charleston synthé ouvert', play: function (t, v) { metalHit(t, v, kit().ohat); } },
    etom: { name: 'Tom synthé', play: function (t, v) { toneHit(t, v, kit().tom); } }
  };
  var DRUM_ORDER = ['kick', 'snare', 'rim', 'clap', 'hat', 'ohat', 'ride', 'crash', 'tom', 'shaker', 'doum', 'tek', 'ka', 'kra', 'tbel', 'ekick', 'ekick2', 'esnare', 'eclap', 'ehat', 'eohat', 'etom'];

  /* ================= Styles ================= */
  /* bpm : tempo conseillé ; accomp : rythme conseillé pour chaque instrument (clé = id de l'instrument, voir RHYTHMS) */
  var ELEC = 'Électronique', ARABE = 'Maghreb, Égypte et Levant', ACC = { guitar: 'folk', piano: 'croches', bass: 'croches' };
  var STYLES = [
    { id: 'pop', group: 'Pop, rock, metal', name: 'Pop', bpm: 100, steps: 16, accomp: { guitar: 'folk', piano: 'croches', bass: 'croches' },
      desc: 'Grosse caisse sur 1 et 3, caisse claire et claquement de mains sur 2 et 4, charleston en croches.',
      rows: { kick: 'X.......X.x.....', snare: '....X.......X...', clap: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' } },
    { id: 'rock', group: 'Pop, rock, metal', name: 'Rock', bpm: 120, steps: 16, accomp: { guitar: 'temps', piano: 'noires', bass: 'croches' },
      desc: 'Charleston en croches accentué, grosse caisse qui pousse, crash sur le premier temps.',
      rows: { kick: 'X.......X.X.....', snare: '....X.......X...', hat: 'X.x.x.x.X.x.x.x.', crash: 'X...............' } },
    { id: 'metal', group: 'Pop, rock, metal', name: 'Metal/Punk', bpm: 100, steps: 16, accomp: { guitar: 'temps', piano: 'noires', bass: 'galop' },
      desc: 'Du metal (double grosse caisse, caisse claire sur 2 et 4, crash sur le premier temps) au punk (droit et rapide). Variations metal : blast beats, D-beat, thrash, death, black, doom, breakdown… Variations punk : classique, skate punk, D-beat, hardcore, pop-punk, crust, garage…',
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
    { id: 'gnawa', group: 'Maghreb, Égypte et Levant', name: 'Gnawa', bpm: 85, steps: 12, accomp: { guitar: 'arpege', piano: 'arpege', bass: 'shuffle' },
      desc: 'Rythme ternaire : krakeb (castagnettes métalliques) en continu, tbel (grosse caisse) qui marque les temps.',
      rows: { kra: 'XooXooXooXoo', tbel: 'X.....X.x...' } },
    { id: 'chaabi', group: 'Maghreb, Égypte et Levant', name: 'Chaabi (Maroc)', bpm: 110, steps: 16, accomp: { guitar: 'folk', piano: 'croches', bass: 'croches' },
      desc: 'Darbouka entraînante : doum sur 1 et 3, teks syncopés, krakeb léger en croches.',
      rows: { doum: 'X.......X.X.....', tek: '..x...x.....x.x.', kra: 'o.o.o.o.o.o.o.o.' } },
    { id: 'maqsum', group: 'Maghreb, Égypte et Levant', name: 'Maqsum', bpm: 100, steps: 16, accomp: { guitar: 'folk', piano: 'contretemps', bass: 'croches' },
      desc: 'Le rythme de base de la musique arabe : doum, tek, tek, doum, tek.',
      rows: { doum: 'X.......X.......', tek: '..x...x.....x...', ka: '....o.....o...o.' } },
    { id: 'baladi', group: 'Maghreb, Égypte et Levant', name: 'Baladi', bpm: 100, steps: 16, accomp: { guitar: 'folk', piano: 'croches', bass: 'croches' },
      desc: 'Doum doum, tek, doum, tek : un rythme populaire, plus lourd que le maqsum.',
      rows: { doum: 'X.x.....X.......', tek: '......x.....x...', ka: '....o.....o...o.' } },
    { id: 'saidi', group: 'Maghreb, Égypte et Levant', name: 'Saïdi', bpm: 105, steps: 16, accomp: { guitar: 'folk', piano: 'croches', bass: 'croches' },
      desc: 'Rythme de Haute-Égypte : doum, tek, doum doum, tek.',
      rows: { doum: 'X.....x.x.......', tek: '..x.........x...', ka: '....o.....o...o.' } },
    /* Rythmes arabes et égyptiens (iqa'at), notés en D = doum, T = tek. Seuls les motifs recoupés par plusieurs sources sont gardés.
       Les mesures de 2/4, 6/4, 8/4, 9/8 ou 10/8 ont leur propre durée (len, en temps) et leur découpage (groups). */
    { id: 'ciftetelli', group: ARABE, name: 'Ciftetelli (8/4)', bpm: 90, steps: 16, len: 8, accomp: ACC,
      desc: 'Cycle lent de danse, accentué 3+3+2 : D . T T . T T . D . D . T . . .',
      rows: { doum: 'X.......X.X.....', tek: '..xx.xx.....x...' }, groups: [3, 3, 2, 3, 3, 2] },
    { id: 'malfuf', group: ARABE, name: 'Malfuf (2/4)', bpm: 130, steps: 8, len: 2, accomp: ACC,
      desc: 'Deux temps rapides, 3+3+2 : D . . T . . T . — le rythme entraînant des marches et des danses folkloriques.',
      rows: { doum: 'X.......', tek: '...x..x.' }, groups: [3, 3, 2] },
    /* Électronique : sons de synthèse maison, motifs génériques du genre */
    { id: 'house', group: ELEC, name: 'House', bpm: 124, steps: 16, accomp: { guitar: 'temps', piano: 'contretemps', bass: 'croches' }, desc: '',
      rows: { ekick: 'X...X...X...X...', eclap: '....x.......x...', eohat: '..X...X...X...X.', ehat: 'x.x.x.x.x.x.x.x.' } },
    { id: 'techno', group: ELEC, name: 'Techno', bpm: 132, steps: 16, accomp: { guitar: 'temps', piano: 'noires', bass: 'noires' }, desc: '',
      rows: { ekick2: 'X...X...X...X...', ehat: 'xxxxxxxxxxxxxxxx', eohat: '..x...x...x...x.', eclap: '....x.......x...' } },
    { id: 'electro', group: ELEC, name: 'Électro', bpm: 126, steps: 16, accomp: { guitar: 'temps', piano: 'noires', bass: 'disco' }, desc: '',
      rows: { ekick: 'X.....X...X.....', eclap: '....x.......x...', ehat: 'x.x.x.x.x.x.x.x.', etom: '..............x.' } },
    { id: 'dnb', group: ELEC, name: 'Drum & bass', bpm: 170, steps: 16, accomp: { guitar: 'temps', piano: 'noires', bass: 'croches' }, desc: '',
      rows: { ekick2: 'X.........X.....', esnare: '....X.......X...', ehat: 'x.x.x.x.x.x.x.x.' } },
    { id: 'dubstep', group: ELEC, name: 'Dubstep', bpm: 140, steps: 16, accomp: { guitar: 'plaque', piano: 'noires', bass: 'racines' }, desc: '',
      rows: { ekick: 'X...............', esnare: '........X.......', ehat: 'x.x.x.x.x.x.x.x.' } }
  ];

  /* Durée d'une mesure en temps (4 par défaut), et découpage en groupes de pas pour l'affichage (un groupe = un « temps ») */
  function lenOf(st) { return st.len || 4; }
  function groupsOf(st) {
    if (st.groups) return st.groups;
    var n = Math.ceil(lenOf(st)), g = [], k;
    for (k = 0; k < n; k++) g.push(st.steps / n);
    return g;
  }

  /* ================= Variations ================= */
  /* Chaque style a une variation de base (« Classique »), quelques variations écrites à la main (mêmes lignes de pas que
     le style, une mesure), puis deux variations avec roulement fabriquées pour tous les styles : 2 et 4 mesures dont la
     dernière finit par un roulement. Une variation est une suite de mesures ; chaque mesure donne ses lignes de pas. */
  var ALT = {
    pop: [
      { name: 'Demi-temps', rows: { kick: 'X.........x.....', snare: '........X.......', hat: 'x.x.x.x.x.x.x.x.' } },
      { name: 'Charleston en doubles-croches', rows: { kick: 'X.......X.x.....', snare: '....X.......X...', clap: '....x.......x...', hat: 'xoxoxoxoxoxoxoxo' } }
    ],
    rock: [
      { name: 'Ride', rows: { kick: 'X.......X.X.....', snare: '....X.......X...', ride: 'x.x.x.x.x.x.x.x.', crash: 'X...............' } },
      { name: 'Grosse caisse syncopée', rows: { kick: 'X..x..x.X.X.....', snare: '....X.......X...', hat: 'X.x.x.x.X.x.x.x.' } }
    ],
    metal: [
      { name: 'Blast beat', rows: { kick: 'x.x.x.x.x.x.x.x.', snare: '.x.x.x.x.x.x.x.x', hat: 'xxxxxxxxxxxxxxxx', crash: 'X...............' } },
      { name: 'Blast beat « hammer » (tout ensemble)', rows: { kick: 'xxxxxxxxxxxxxxxx', snare: 'xxxxxxxxxxxxxxxx', ride: 'x.x.x.x.x.x.x.x.', crash: 'X...............' } },
      { name: 'D-beat', bpm: 170, rows: { kick: 'X..X.X..X..X.X..', snare: '..X...X...X...X.', hat: 'x.x.x.x.x.x.x.x.' } },
      { name: 'D-beat (charleston ouvert)', bpm: 170, rows: { kick: 'X..X.X..X..X.X..', snare: '..X...X...X...X.', ohat: 'x.x.x.x.x.x.x.x.' } },
      { name: 'Skank beat (thrash)', rows: { kick: 'X.......X.......', snare: '..x...x...x...x.', hat: 'x.x.x.x.x.x.x.x.', crash: 'X...............' } },
      { name: 'Thrash au galop', rows: { kick: 'X.xxX.xxX.xxX.xx', snare: '....X.......X...', hat: 'x.x.x.x.x.x.x.x.', crash: 'X...............' } },
      { name: 'Double pédale death metal', rows: { kick: 'XxxxXxxxXxxxXxxx', snare: '....X.......X...', hat: 'x.x.x.x.x.x.x.x.', crash: 'X.......X.......' } },
      { name: 'Heavy metal classique', rows: { kick: 'X...X...X...X...', snare: '....X.......X...', hat: 'x.x.x.x.x.x.x.x.', crash: 'X...............' } },
      { name: 'Power metal (double pédale en croches)', rows: { kick: 'X.X.X.X.X.X.X.X.', snare: '....X.......X...', hat: 'x.x.x.x.x.x.x.x.', crash: 'X...............' } },
      { name: 'Groove metal', rows: { kick: 'X..x..x.X..x..x.', snare: '....X.......X...', hat: 'x.x.x.x.x.x.x.x.', ohat: '...............x' } },
      { name: 'Metalcore', rows: { kick: 'X.x.X.xxX.x.X.xx', snare: '....X.......X...', hat: 'x.x.x.x.x.x.x.x.', crash: 'X...............' } },
      { name: 'Breakdown lourd (demi-temps)', rows: { kick: 'X.xx.x..X.xx.x..', snare: '........X.......', crash: 'X.......X.......' } },
      { name: 'Doom (lent et pesant)', rows: { kick: 'X...............', snare: '........X.......', ride: 'x.......x.......', crash: 'X...............' } },
      { name: 'Punk : classique', bpm: 180, rows: { kick: 'X.......X.......', snare: '....X.......X...', hat: 'x.x.x.x.x.x.x.x.' } },
      { name: 'Punk : Skate punk (rapide)', bpm: 180, rows: { kick: 'X...X...X...X...', snare: '..x...x...x...x.', hat: 'x.x.x.x.x.x.x.x.' } },
      { name: 'Punk : Hardcore', bpm: 180, rows: { kick: 'X.x.X.x.X.x.X.x.', snare: '....X.......X...', hat: 'x.x.x.x.x.x.x.x.' } },
      { name: 'Punk : Pop-punk (charleston accentué)', bpm: 180, rows: { kick: 'X...X.x.X...X...', snare: '....X.......X...', hat: 'X.x.X.x.X.x.X.x.' } },
      { name: 'Punk : Garage (toms)', bpm: 180, rows: { kick: 'X.......X.......', snare: '....X.......X...', tom: '..x...x...x...x.' } },
    ],
    blues: [
      { name: 'Slow blues', rows: { kick: 'X.....X.....', snare: '...X.....X..', hat: 'x..x..x..x..' } },
      { name: 'Shuffle au ride', rows: { kick: 'X.....X.....', snare: '...X.....X..', ride: 'x.xx.xx.xx.x' } }
    ],
    jazz: [
      { name: 'Ballade', rows: { ride: 'X.....X.....', hat: '...x.....x..', kick: 'o...........' } },
      { name: 'Caisse claire qui dialogue', rows: { ride: 'X..x.oX..x.o', hat: '...x.....x..', kick: 'o..o..o..o..', snare: '..o...o...o.' } }
    ],
    country: [
      { name: 'Train rapide', rows: { kick: 'X...X...X...X...', snare: '..o.X.o...o.X.o.', hat: 'x.x.x.x.x.x.x.x.' } },
      { name: 'Ballade', rows: { kick: 'X.......X.......', rim: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' } }
    ],
    house: [
      { name: 'Deep (charleston léger)', rows: { ekick: 'X...X...X...X...', eclap: '....o.......o...', ehat: 'o.x.o.x.o.x.o.x.', eohat: '..o...o...o...o.' } },
      { name: 'Charleston en doubles-croches', rows: { ekick: 'X...X...X...X...', eclap: '....x.......x...', ehat: 'xoxoxoxoxoxoxoxo', eohat: '..X...X...X...X.' } },
      { name: 'Clap sur chaque contretemps', rows: { ekick: 'X...X...X...X...', eclap: '..x.x...x.x.x...', eohat: '..X...X...X...X.' } }
    ],
    techno: [
      { name: 'Minimal', rows: { ekick2: 'X...X...X...X...', ehat: '..x...x...x...x.', eclap: '................' } },
      { name: 'Industriel (toms)', rows: { ekick2: 'X...X...X...X...', ehat: 'xxxxxxxxxxxxxxxx', etom: '..x...x...x...x.' } },
      { name: 'Rapide (grosse caisse roulante)', rows: { ekick2: 'X...X...X...X.xx', ehat: 'x.x.x.x.x.x.x.x.', eohat: '..x...x...x...x.', eclap: '....x.......x...' } }
    ],
    electro: [
      { name: 'Toms en réponse', rows: { ekick: 'X.....X...X.....', eclap: '....x.......x...', ehat: 'x.x.x.x.x.x.x.x.', etom: '.......x......xx' } },
      { name: 'Grosse caisse à contretemps', rows: { ekick: 'X..x..X...X..x..', eclap: '....x.......x...', ehat: 'x.x.x.x.x.x.x.x.' } }
    ],
    dnb: [
      { name: 'Rouleur', rows: { ekick2: 'X.........x.X...', esnare: '....X.......X...', ehat: 'x.x.x.x.x.x.x.x.' } },
      { name: 'Liquide (charleston ouvert)', rows: { ekick2: 'X.........X.....', esnare: '....X.......X...', ehat: 'x.x.x.x.x.x.x.x.', eohat: '..x.....x.......' } },
    ],
    dubstep: [
      { name: 'Demi-temps lourd', rows: { ekick: 'X.......x.......', esnare: '........X.......', ehat: 'x.x.x.x.x.x.x.x.' } },
      { name: 'Grosse caisse décalée', rows: { ekick: 'X.....x.........', esnare: '........X.......', ehat: 'x.x.x.x.x.x.x.x.', etom: '..............x.' } }
    ],
    funk: [
      { name: 'Syncopé', rows: { kick: 'X..x..x..x.x....', snare: '....X..o.o..X.o.', hat: 'xxxxxxxxxxxxxxxx', ohat: '..............x.' } },
      { name: 'Demi-temps', rows: { kick: 'X.......x.x.....', snare: '........X..o...o', hat: 'XoxoXoxoXoxoXoxo' } }
    ],
    reggae: [
      { name: 'Steppers (grosse caisse à chaque temps)', rows: { kick: 'X...X...X...X...', rim: '........X.......', hat: 'x.x.x.x.x.x.x.x.' } },
      { name: 'Rockers', rows: { kick: 'X.....x.X.....x.', rim: '........X.......', hat: 'x.x.x.x.x.x.x.x.' } }
    ],
    disco: [
      { name: 'Charleston en doubles-croches', rows: { kick: 'X...X...X...X...', clap: '....x.......x...', hat: 'xoxoxoxoxoxoxoxo', ohat: '..x...x...x...x.' } },
      { name: 'Charleston ouvert sur chaque temps', rows: { kick: 'X...X...X...X...', snare: '....X.......X...', hat: 'xx.xxx.xxx.xxx.x', ohat: '..X...X...X...X.' } },
      { name: 'Disco-funk', rows: { kick: 'X...X..xX...X...', clap: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', ohat: '..x...x...x...x.' } }
    ],
    bossa: [
      { name: 'Grosse caisse continue', rows: { kick: 'X..x..X.X..x..X.', rim: 'X..x..x...x..x..', hat: 'x.x.x.x.x.x.x.x.' } },
      { name: 'Légère (shaker)', rows: { kick: 'X.....x.X.....x.', rim: 'X..x..x...x..x..', shaker: 'xoxoxoxoxoxoxoxo' } }
    ],
    gnawa: [
      { name: 'Lent', rows: { kra: 'XooXooXooXoo', tbel: 'X.....X.....' } },
      { name: 'Soutenu', rows: { kra: 'XxoXxoXxoXxo', tbel: 'X..x..X.x...' } }
    ],
    chaabi: [
      { name: 'Rapide', rows: { doum: 'X...X...X.X.....', tek: '..x...x...x.x...', kra: 'o.o.o.o.o.o.o.o.' } },
      { name: 'Avec ka', rows: { doum: 'X.......X.X.....', tek: '..x...x.....x.x.', ka: '.o.o.o.o.o.o.o.o', kra: 'o.o.o.o.o.o.o.o.' } }
    ],
    maqsum: [
      { name: 'Orné', rows: { doum: 'X.......X.......', tek: '..x...x.....x...', ka: '.o.o.o.o.o.o.o.o' } },
      { name: 'Léger', rows: { doum: 'X.......X.......', tek: '..o...o.....o...' } }
    ],
    baladi: [
      { name: 'Orné', rows: { doum: 'X.x.....X.......', tek: '......x.....x...', ka: '.o..o.o..o.o..o.' } },
      { name: 'Masmoudi (plus lourd)', rows: { doum: 'X.X.....X.X.....', tek: '......x.....x...', ka: '....o.....o...o.' } }
    ],
    saidi: [
      { name: 'Orné', rows: { doum: 'X.....x.x.......', tek: '..x.........x...', ka: '.o.o.o.o.o.o.o.o' } },
      { name: 'Rapide', rows: { doum: 'X.....x.X.....x.', tek: '..x...x.....x...' } }
    ]
  };

  /* Les deux sons du roulement : caisse claire puis tom ; darbouka (tek puis doum) pour le Maghreb, l'Égypte et le Levant ; krakeb puis tbel pour le gnawa */
  function fillPair(st) {
    if (st.id === 'gnawa') return ['kra', 'tbel'];
    if (st.group === ELEC) return ['esnare', 'etom'];
    return st.group === 'Maghreb, Égypte et Levant' ? ['tek', 'doum'] : ['snare', 'tom'];
  }
  /* La mesure `rows` avec, sur son dernier temps, un roulement à la place du rythme */
  function withFill(st, rows) {
    var gr = groupsOf(st), per = gr[gr.length - 1], from = st.steps - per, pair = fillPair(st), half = Math.ceil(per / 2), out = {}, blank = new Array(st.steps + 1).join('.'), k;
    Object.keys(rows).forEach(function (inst) {
      var chars = rows[inst].split('');
      if (inst !== pair[0] && inst !== pair[1]) for (k = from; k < st.steps; k++) chars[k] = '.';
      out[inst] = chars.join('');
    });
    pair.forEach(function (inst, i) {
      var chars = (out[inst] || blank).split('');
      for (k = 0; k < per; k++) chars[from + k] = i === 0 ? (k < half ? 'x' : '.') : (k < half ? '.' : k === per - 1 ? 'X' : 'x');
      out[inst] = chars.join('');
    });
    return out;
  }
  function variationsOf(st) {
    if (!st.variations) {
      var fill = withFill(st, st.rows);
      st.variations = [{ name: 'Classique', bars: [st.rows] }];
      (ALT[st.id] || []).forEach(function (a) { st.variations.push({ name: a.name, bars: [a.rows], bpm: a.bpm }); });
      st.variations.push({ name: 'Avec roulement (2 mesures)', bars: [st.rows, fill] });
      st.variations.push({ name: 'Avec roulement (4 mesures)', bars: [st.rows, st.rows, st.rows, fill] });
    }
    return st.variations;
  }

  /* ================= État ================= */
  /* rows : une ligne par instrument ; cells : les pas de toutes les mesures bout à bout (bars × steps).
     cur : la mesure affichée dans la grille. */
  var MAX_BARS = 8, BPM_MIN = 40, BPM_MAX = 220;
  var state = { on: false, style: 'pop', variation: 0, kit: 'rond', bpm: 100, vol: 70, steps: 16, len: 4, groups: [4, 4, 4, 4], bars: 1, cur: 0, dirty: false, rows: [] };
  var loop = { playing: false, timer: null, barStart: 0, j: 0 };
  D.STYLES = STYLES; D.NAMES = DRUMS; D.state = state;
  D.stopLoop = function () {}; D.isLooping = function () { return false; }; // remplacés par mount()

  function styleById(id) {
    for (var i = 0; i < STYLES.length; i++) if (STYLES[i].id === id) return STYLES[i];
    return STYLES[0];
  }
  D.style = styleById;
  D.variations = function (id) { return variationsOf(styleById(id)); };
  /* Tempo conseillé d'une variation : le sien s'il en a un (le punk va plus vite que le metal), sinon celui du style */
  D.tempoOf = function (id, vi) {
    var st = styleById(id), v = variationsOf(st)[vi];
    return v && v.bpm ? v.bpm : st.bpm;
  };
  function loadStyle(id, vi) {
    var st = styleById(id), vars = variationsOf(st), v = vars[vi > 0 && vi < vars.length ? vi : 0], order = [], blank = new Array(st.steps + 1).join('.');
    state.style = st.id;
    state.variation = vars.indexOf(v);
    state.steps = st.steps;
    state.len = lenOf(st);
    state.groups = groupsOf(st);
    state.bars = v.bars.length;
    state.cur = 0;
    v.bars.forEach(function (bar) { Object.keys(bar).forEach(function (inst) { if (order.indexOf(inst) < 0) order.push(inst); }); });
    state.rows = order.map(function (inst) {
      var cells = [];
      v.bars.forEach(function (bar) { (bar[inst] || blank).split('').forEach(function (ch) { cells.push(DRUM_CHAR[ch] || 0); }); });
      return { inst: inst, mute: false, cells: cells };
    });
    state.dirty = false;
  }
  D.load = loadStyle;
  loadStyle(state.style, 0);

  D.play = function (inst, when, vol) {
    var out;
    if (!DRUMS[inst] || !M.audio()) return;
    out = M.bus('drums');
    out.gain.value = 0.6 * state.vol / 100;
    DRUMS[inst].play(when, vol);
  };

  /* Longueur du motif en temps : le Composer s'en sert pour garder la boîte à rythmes calée sur ses mesures */
  D.length = function () { return state.len * state.bars; };

  /* Coups d'un passage de `beats` temps qui commence à la position `p0` (en temps) du motif ; le motif reboucle s'il est plus court */
  D.events = function (p0, beats) {
    var evs = [], per = state.len / state.steps, total = D.length();
    state.rows.forEach(function (row) {
      if (row.mute) return;
      row.cells.forEach(function (v, j) {
        var pos, k;
        if (v <= 0) return;
        for (k = 0, pos = j * per; pos < p0 + beats - 1e-9; k++, pos = j * per + k * total) {
          if (pos >= p0 - 1e-9) evs.push({ at: pos - p0, drum: row.inst, vol: v });
        }
      });
    });
    return evs;
  };

  D.data = function () {
    return { on: state.on, style: state.style, variation: state.variation, kit: state.kit, bars: state.bars, bpm: state.bpm, vol: state.vol, dirty: state.dirty,
      rows: state.rows.map(function (r) { return { inst: r.inst, mute: r.mute, cells: r.cells }; }) };
  };
  D.apply = function (d) {
    if (!d || typeof d !== 'object') return;
    if (STYLES.some(function (s) { return s.id === d.style; })) loadStyle(d.style, Number(d.variation) || 0);
    state.on = d.on === true;
    if (isFinite(d.vol)) state.vol = clamp(Math.round(d.vol), 0, 100);
    if (KITS[KIT_ANCIENS[d.kit] || d.kit]) state.kit = KIT_ANCIENS[d.kit] || d.kit;
    if (isFinite(d.bpm)) state.bpm = clamp(Math.round(d.bpm), BPM_MIN, BPM_MAX);
    if (d.dirty === true && Array.isArray(d.rows) && d.rows.length) {
      var bars = isFinite(d.bars) ? clamp(Math.round(d.bars), 1, MAX_BARS) : 1, len = bars * state.steps;
      var ok = d.rows.every(function (r) {
        return r && DRUMS[r.inst] && Array.isArray(r.cells) && r.cells.length === len &&
          r.cells.every(function (v) { return typeof v === 'number' && v >= 0 && v <= 1; });
      });
      if (ok) {
        state.rows = d.rows.map(function (r) { return { inst: r.inst, mute: r.mute === true, cells: r.cells.slice() }; });
        state.bars = bars;
        state.cur = 0;
        state.dirty = true;
      }
    }
  };

  /* La boîte à rythmes est la même sur toutes les pages : elle se garde seule dans le navigateur */
  var KEY = 'tools:musique:boite-a-rythmes';
  D.save = function () { M.store.set(KEY, D.data()); };
  D.apply(M.store.get(KEY, null));

  /* ================= Interface ================= */
  function levelName(v) { return v <= 0 ? 'éteint' : v <= 0.4 ? 'fantôme' : v <= 0.75 ? 'normal' : 'accentué'; }
  function nextLevel(v) {
    var i = 0, k;
    for (k = 0; k < DRUM_LEVELS.length; k++) if (Math.abs(DRUM_LEVELS[k] - v) < Math.abs(DRUM_LEVELS[i] - v)) i = k;
    return DRUM_LEVELS[(i + 1) % DRUM_LEVELS.length];
  }
  function paintCell(btn, row, j) {
    var v = row.cells[state.cur * state.steps + j];
    btn.style.setProperty('--v', v);
    if (v > 0) btn.setAttribute('data-on', ''); else btn.removeAttribute('data-on');
    btn.setAttribute('aria-label', DRUMS[row.inst].name + (state.bars > 1 ? ', mesure ' + (state.cur + 1) : '') + ', pas ' + (j + 1) + ' : ' + levelName(v));
  }

  /* Construit la boîte à rythmes dans `container` : style, variation, tempo, volume, mesures et grille.
     opts : onChange() après chaque modification (facultatif ; la sauvegarde est faite ici). */
  D.mount = function (container, opts) {
    opts = opts || {};
    var card = el('section', 'card'), inputs = el('div', 'inputs'), idStyle = M.uid('dstyle'), idVol = M.uid('dvol');
    var fStyle = el('div', 'field'), fVol = el('div', 'field'), fTempo = el('div', 'field'), tempo = el('input'), tempoVal = el('b', '', String(state.bpm)), idTempo = M.uid('dtempo');
    var sel = el('select'), vol = el('input'), volVal = el('b', '', String(state.vol)), desc = el('p', 'muted');
    var scroll = el('div', 'scroll'), grid = el('div', 'dgrid'), actions = el('div', 'actions');
    var test = el('button', 'btn play', 'Jouer'), suggest = el('button', 'btn ghost', 'Tempo conseillé');
    var reset = el('button', 'btn ghost', 'Remettre la variation d’origine'), add = el('select');
    var fVar = el('div', 'field'), selVar = el('select'), idVar = M.uid('dvar'), barsBox = el('div', 'dbars');
    var fKit = el('div', 'field'), selKit = el('select'), idKit = M.uid('dkit');

    card.setAttribute('aria-label', 'Boîte à rythmes');
    tempo.type = 'range'; tempo.min = String(BPM_MIN); tempo.max = String(BPM_MAX); tempo.step = '1'; tempo.id = idTempo;
    var tempoLab = el('label'); tempoLab.setAttribute('for', idTempo);
    tempoLab.appendChild(document.createTextNode('Tempo : ')); tempoLab.appendChild(tempoVal); tempoLab.appendChild(document.createTextNode(' BPM'));
    fTempo.appendChild(tempoLab); fTempo.appendChild(tempo);
    sel.id = idStyle;
    fStyle.appendChild(el('label', '', 'Style')); fStyle.firstChild.setAttribute('for', idStyle); fStyle.appendChild(sel);
    vol.type = 'range'; vol.min = '0'; vol.max = '100'; vol.step = '1'; vol.id = idVol;
    var volLab = el('label'); volLab.setAttribute('for', idVol);
    volLab.appendChild(document.createTextNode('Volume : ')); volLab.appendChild(volVal); volLab.appendChild(document.createTextNode(' %'));
    fVol.appendChild(volLab); fVol.appendChild(vol);
    selVar.id = idVar;
    fVar.appendChild(el('label', '', 'Variation')); fVar.firstChild.setAttribute('for', idVar); fVar.appendChild(selVar);
    selKit.id = idKit;
    KIT_NAMES.forEach(function (k) { var o = el('option', '', k[1]); o.value = k[0]; selKit.appendChild(o); });
    fKit.appendChild(el('label', '', 'Kit électronique')); fKit.firstChild.setAttribute('for', idKit); fKit.appendChild(selKit);
    inputs.appendChild(fStyle); inputs.appendChild(fVar); inputs.appendChild(fKit); inputs.appendChild(fTempo); inputs.appendChild(fVol);
    card.appendChild(inputs);
    card.appendChild(barsBox);
    scroll.appendChild(grid);
    card.appendChild(scroll);
    [test, suggest, reset].forEach(function (b) { b.type = 'button'; actions.appendChild(b); });
    card.insertBefore(actions, inputs);
    actions = el('div', 'actions');
    add.setAttribute('aria-label', 'Ajouter un instrument');
    actions.appendChild(add);
    card.appendChild(actions);
    card.appendChild(el('p', 'muted', 'Touchez une case pour changer son intensité : fantôme, normale, accentuée, puis éteinte ; clic droit (ou appui long) pour la vider d’un coup. Chaque mesure se compose séparément : ajoutez-en pour varier le rythme (roulement, refrain…). Les styles sont simplifiés : adaptez-les à votre goût.'));
    container.appendChild(card);

    var grp = null, grpName = '';
    STYLES.forEach(function (s) {
      if (s.group !== grpName) { grpName = s.group; grp = el('optgroup'); grp.label = grpName; sel.appendChild(grp); }
      var o = el('option', '', s.name);
      o.value = s.id;
      grp.appendChild(o);
    });

    function changed() { D.save(); if (opts.onChange) opts.onChange(); }
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
    function describe() {
      var v = variationsOf(styleById(state.style))[state.variation];
      desc.textContent = styleById(state.style).desc + (state.variation > 0 && v ? ' Variation : ' + v.name + '.' : '') + (state.dirty ? ' (rythme modifié)' : '');
    }
    function fillVar() {
      selVar.replaceChildren();
      variationsOf(styleById(state.style)).forEach(function (v, i) { var o = el('option', '', v.name); o.value = i; selVar.appendChild(o); });
      selVar.value = state.variation;
    }
    /* Choix de la mesure affichée, et ajout / retrait de mesures */
    function renderBars() {
      var b, bAdd = el('button', 'btn ghost', 'Ajouter une mesure'), bDel = el('button', 'btn ghost', 'Retirer cette mesure');
      barsBox.replaceChildren();
      barsBox.appendChild(el('span', 'lab', state.bars > 1 ? 'Mesure' : 'Mesures'));
      for (b = 0; b < state.bars; b++) {
        (function (b) {
          var c = el('button', 'chip-btn dbar', String(b + 1));
          c.type = 'button';
          c.setAttribute('aria-pressed', String(b === state.cur));
          c.setAttribute('aria-label', 'Mesure ' + (b + 1) + ' sur ' + state.bars);
          c.addEventListener('click', function () { state.cur = b; render(); });
          barsBox.appendChild(c);
        })(b);
      }
      bAdd.type = bDel.type = 'button';
      bAdd.title = 'Insère après celle-ci une copie de la mesure affichée';
      bAdd.disabled = state.bars >= MAX_BARS;
      bDel.disabled = state.bars <= 1;
      bAdd.addEventListener('click', function () {
        var off = state.cur * state.steps;
        state.rows.forEach(function (row) { row.cells.splice.apply(row.cells, [off + state.steps, 0].concat(row.cells.slice(off, off + state.steps))); });
        state.bars++; state.cur++; state.dirty = true;
        render(); changed();
      });
      bDel.addEventListener('click', function () {
        var off = state.cur * state.steps;
        state.rows.forEach(function (row) { row.cells.splice(off, state.steps); });
        state.bars--; state.cur = Math.min(state.cur, state.bars - 1); state.dirty = true;
        render(); changed();
      });
      barsBox.appendChild(bAdd); barsBox.appendChild(bDel);
    }

    function render() {
      var starts = {}, at = 0, off = state.cur * state.steps, head = el('div', 'drow head'), j;
      state.groups.forEach(function (g, i) { starts[at] = i + 1; at += g; });
      grid.replaceChildren();
      grid.style.setProperty('--cols', state.steps);
      head.appendChild(el('span', 'dlab-h', 'Temps'));
      for (j = 0; j < state.steps; j++) {
        var h = el('span', 'dh' + (starts[j] ? ' beat' : ''), starts[j] ? String(starts[j]) : '');
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
        row.cells.slice(off, off + state.steps).forEach(function (v, k) {
          var c = el('button', 'dcell' + (starts[k] ? ' beat' : ''));
          c.type = 'button';
          c.setAttribute('data-act', 'cell'); c.setAttribute('data-r', ri); c.setAttribute('data-j', k);
          paintCell(c, row, k);
          r.appendChild(c);
        });
        grid.appendChild(r);
      });
      describe();
      fillVar();
      renderBars();
      selKit.value = state.kit;
      fKit.hidden = styleById(state.style).group !== ELEC; // le kit ne concerne que les styles électroniques
      tempo.value = state.bpm;
      tempoVal.textContent = state.bpm;
      vol.value = state.vol;
      volVal.textContent = state.vol;
      sel.value = state.style;
      fillAdd();
    }

    /* ----- Écoute de la boîte à rythmes seule ----- */
    function markCol(j, when) {
      setTimeout(function () {
        if (!loop.playing) return;
        var bar = Math.floor(j / state.steps), local = j % state.steps;
        if (bar !== state.cur) { state.cur = bar; render(); }
        Array.prototype.forEach.call(grid.querySelectorAll('.dcell, .dh'), function (c) {
          c.classList.toggle('cur', Number(c.getAttribute('data-j')) === local);
        });
      }, Math.max(0, (when - M.audio().currentTime) * 1000));
    }
    function tickLoop() {
      var ctx = M.audio(), spb = 60 / state.bpm, horizon = ctx.currentTime + 0.15, per = state.len / state.steps, t;
      for (;;) {
        t = loop.barStart + loop.j * per * spb;
        if (t >= horizon) return;
        state.rows.forEach(function (row) { if (!row.mute && row.cells[loop.j] > 0) D.play(row.inst, t, row.cells[loop.j]); });
        markCol(loop.j, t);
        loop.j++;
        if (loop.j >= state.steps * state.bars) { loop.j = 0; loop.barStart += D.length() * spb; }
      }
    }
    function startLoop() {
      var ctx = M.audio();
      if (!ctx) return;
      loop.playing = true;
      loop.barStart = ctx.currentTime + 0.1;
      loop.j = 0;
      loop.timer = setInterval(tickLoop, 25);
      test.textContent = 'Arrêter';
    }
    function stopLoop() {
      loop.playing = false;
      if (loop.timer) { clearInterval(loop.timer); loop.timer = null; }
      Array.prototype.forEach.call(grid.querySelectorAll('.cur'), function (c) { c.classList.remove('cur'); });
      test.textContent = 'Jouer';
    }
    D.stopLoop = stopLoop;
    D.isLooping = function () { return loop.playing; };

    /* ----- Événements ----- */
    sel.addEventListener('change', function () { loadStyle(this.value, 0); state.bpm = styleById(this.value).bpm; render(); changed(); });
    selKit.addEventListener('change', function () {
      var ctx;
      state.kit = this.value;
      changed();
      ctx = M.audio();
      if (ctx) { D.play('ekick', ctx.currentTime + 0.02, 1); D.play('esnare', ctx.currentTime + 0.3, 1); D.play('ehat', ctx.currentTime + 0.5, 1); }
    });
    selVar.addEventListener('change', function () {
      loadStyle(state.style, Number(this.value));
      if (variationsOf(styleById(state.style)).some(function (v) { return v.bpm; })) state.bpm = D.tempoOf(state.style, state.variation);
      render(); changed();
    });
    tempo.addEventListener('input', function () { state.bpm = Number(this.value); tempoVal.textContent = state.bpm; changed(); });
    vol.addEventListener('input', function () { state.vol = Number(this.value); volVal.textContent = state.vol; changed(); });
    test.addEventListener('click', function () { if (loop.playing) stopLoop(); else startLoop(); });
    reset.addEventListener('click', function () { loadStyle(state.style, state.variation); render(); changed(); });
    suggest.addEventListener('click', function () { state.bpm = D.tempoOf(state.style, state.variation); render(); changed(); });
    add.addEventListener('change', function () {
      if (!this.value) return;
      var cells = [], j;
      for (j = 0; j < state.steps * state.bars; j++) cells.push(0);
      state.rows.push({ inst: this.value, mute: false, cells: cells });
      state.dirty = true;
      render();
      changed();
    });
    grid.addEventListener('contextmenu', function (e) {
      var b = e.target.closest ? e.target.closest('.dcell') : null, row, idx;
      if (!b) return;
      e.preventDefault();
      row = state.rows[Number(b.getAttribute('data-r'))];
      if (!row) return;
      idx = state.cur * state.steps + Number(b.getAttribute('data-j'));
      if (row.cells[idx] === 0) return;
      row.cells[idx] = 0;
      state.dirty = true;
      paintCell(b, row, Number(b.getAttribute('data-j')));
      describe();
      changed();
    });
    grid.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button') : null;
      if (!b) return;
      var act = b.getAttribute('data-act'), row = state.rows[Number(b.getAttribute('data-r'))], j;
      if (!row) return;
      if (act === 'cell') {
        j = Number(b.getAttribute('data-j'));
        var idx = state.cur * state.steps + j;
        row.cells[idx] = nextLevel(row.cells[idx]);
        state.dirty = true;
        paintCell(b, row, j);
        describe();
        if (row.cells[idx] > 0 && M.audio()) D.play(row.inst, M.audio().currentTime + 0.01, row.cells[idx]);
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
