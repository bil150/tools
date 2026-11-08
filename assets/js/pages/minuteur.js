/* Minuteur d'intervalles : préparation, puis des tours de travail et de repos, avec un signal sonore à chaque changement et un compte à
   rebours sur les 3 dernières secondes. L'écran reste allumé quand le navigateur le permet. Dépend de vie/aliments.js (aides). */
(function () {
  'use strict';

  var V = window.Vie, $ = V.$, el = V.el, clamp = V.clamp;
  var saved = V.store.get('minuteur', null) || {};
  var r = {
    prep: saved.prep >= 0 ? saved.prep : 5, trav: saved.trav >= 0 ? saved.trav : 40, rep: saved.rep >= 0 ? saved.rep : 20, tours: saved.tours >= 1 ? saved.tours : 8,
    son: saved.son !== false
  };
  var run = { seq: [], i: 0, fin: 0, reste: 0, timer: 0, actif: false, bips: -1, ctx: null, lock: null };
  var NOMS = { prep: 'Prépare-toi', travail: 'Travail', repos: 'Repos', fin: 'Terminé' };

  var PRESETS = [
    { e: '🔥', nom: 'Tabata', txt: '20 s / 10 s × 8', prep: 5, trav: 20, rep: 10, tours: 8 },
    { e: '⚡', nom: '30 / 30', txt: '30 s / 30 s × 10', prep: 5, trav: 30, rep: 30, tours: 10 },
    { e: '🏃', nom: '1 min / 1 min', txt: '1 min / 1 min × 8', prep: 5, trav: 60, rep: 60, tours: 8 },
    { e: '⏲️', nom: 'Chaque minute', txt: '1 min × 10', prep: 5, trav: 60, rep: 0, tours: 10 },
    { e: '😮‍💨', nom: 'Repos 90 s', txt: 'Entre deux séries', prep: 0, trav: 0, rep: 90, tours: 1 },
    { e: '🧘', nom: 'Repos 2 min', txt: 'Entre deux séries lourdes', prep: 0, trav: 0, rep: 120, tours: 1 }
  ];

  /* La séquence des phases : une préparation, puis travail et repos pour chaque tour (sans repos après le dernier tour de travail) */
  function sequence() {
    var s = [], k;
    if (r.prep > 0) s.push({ t: 'prep', s: r.prep, tour: 0 });
    for (k = 1; k <= r.tours; k++) {
      if (r.trav > 0) s.push({ t: 'travail', s: r.trav, tour: k });
      if (r.rep > 0 && (k < r.tours || r.trav === 0)) s.push({ t: 'repos', s: r.rep, tour: k });
    }
    return s;
  }
  function total(seq) { return seq.reduce(function (a, p) { return a + p.s; }, 0); }
  function mmss(sec) { var s = Math.max(0, Math.ceil(sec)); return (Math.floor(s / 60) < 10 ? '0' : '') + Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + s % 60; }

  /* ----- Son ----- */
  function audio() {
    var C = window.AudioContext || window.webkitAudioContext;
    if (!run.ctx && C) run.ctx = new C();
    if (run.ctx && run.ctx.state === 'suspended') run.ctx.resume();
    return run.ctx;
  }
  function bip(freq, dur) {
    var c, o, g;
    if (!r.son) return;
    c = audio();
    if (!c) return;
    o = c.createOscillator(); g = c.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, c.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g); g.connect(c.destination);
    o.start(); o.stop(c.currentTime + dur + 0.05);
  }
  function vibre(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* non pris en charge */ } }

  /* ----- Écran allumé pendant le minuteur ----- */
  function garderEveille(oui) {
    try {
      if (oui && navigator.wakeLock && !run.lock) navigator.wakeLock.request('screen').then(function (l) { run.lock = l; l.addEventListener('release', function () { run.lock = null; }); }, function () { /* refusé */ });
      else if (!oui && run.lock) { run.lock.release(); run.lock = null; }
    } catch (e) { /* non pris en charge */ }
  }

  /* ----- Affichage ----- */
  function peindre(phase, reste, dur, tour) {
    var box = $('minu');
    box.className = 'card minu ph-' + phase;
    $('phase').textContent = NOMS[phase] || 'Prêt';
    $('temps').textContent = mmss(reste);
    $('tour').textContent = phase === 'fin' ? 'Bien joué !' : (tour ? 'Tour ' + tour + ' / ' + r.tours : '');
    $('barre').querySelector('i').style.width = dur > 0 ? Math.min(100, (1 - reste / dur) * 100) + '%' : '0%';
  }
  function pret() {
    var seq = sequence(), p = seq[0];
    run.seq = seq; run.i = 0; run.reste = p ? p.s : 0;
    peindre(p ? p.t : 'prep', run.reste, p ? p.s : 0, p ? p.tour : 0);
    $('phase').textContent = 'Prêt';
    $('go').textContent = 'Démarrer';
    $('resume').textContent = seq.length ? 'Durée totale : ' + mmss(total(seq)) + ' · ' + r.tours + (r.tours > 1 ? ' tours' : ' tour') : 'Réglez au moins une durée.';
  }

  function tic() {
    var reste = (run.fin - performance.now()) / 1000, p = run.seq[run.i];
    if (reste <= 0) {
      run.i++;
      if (run.i >= run.seq.length) { arreter(true); return; }
      p = run.seq[run.i];
      run.fin += p.s * 1000;
      if (run.fin < performance.now()) run.fin = performance.now() + p.s * 1000;
      run.bips = -1;
      bip(p.t === 'travail' ? 880 : 520, 0.35); vibre(p.t === 'travail' ? 200 : 100);
      reste = (run.fin - performance.now()) / 1000;
    }
    if (reste <= 3.05 && Math.ceil(reste) !== run.bips && reste > 0) { run.bips = Math.ceil(reste); if (run.i < run.seq.length) bip(660, 0.12); }
    run.reste = reste;
    peindre(p.t, reste, p.s, p.tour);
  }
  function demarrer() {
    var p;
    if (!run.seq.length) return;
    audio();
    p = run.seq[run.i];
    run.fin = performance.now() + run.reste * 1000;
    run.actif = true;
    run.timer = setInterval(tic, 100);
    garderEveille(true);
    $('go').textContent = 'Pause';
    if (run.i === 0 && run.reste >= p.s - 0.2) { bip(p.t === 'travail' ? 880 : 520, 0.35); vibre(100); }
    tic();
  }
  function pause() {
    clearInterval(run.timer);
    run.timer = 0; run.actif = false;
    run.reste = Math.max(0, (run.fin - performance.now()) / 1000);
    garderEveille(false);
    $('go').textContent = 'Reprendre';
  }
  function arreter(fini) {
    clearInterval(run.timer);
    run.timer = 0; run.actif = false;
    garderEveille(false);
    if (fini) { peindre('fin', 0, 1, 0); bip(988, 0.3); setTimeout(function () { bip(988, 0.3); }, 400); vibre(300); $('go').textContent = 'Recommencer'; run.i = run.seq.length; }
    else pret();
  }

  /* ----- Réglages ----- */
  var champs = { 'r-prep': 'prep', 'r-trav': 'trav', 'r-rep': 'rep', 'r-tours': 'tours' };
  function lire() {
    Object.keys(champs).forEach(function (id) {
      var v = parseInt($(id).value, 10), max = id === 'r-tours' ? 99 : id === 'r-prep' ? 60 : 3600;
      r[champs[id]] = clamp(isFinite(v) ? v : 0, id === 'r-tours' ? 1 : 0, max);
    });
  }
  function ecrire() { Object.keys(champs).forEach(function (id) { $(id).value = r[champs[id]]; }); }
  function garder() { V.store.set('minuteur', r); }
  Object.keys(champs).forEach(function (id) {
    $(id).addEventListener('input', function () { lire(); garder(); if (run.actif) arreter(false); else pret(); });
  });

  function preregler() {
    PRESETS.forEach(function (p, i) {
      var b = el('button', 'tile-b w2 c' + (i % 6 + 1));
      b.type = 'button';
      b.appendChild(el('span', 'e', p.e));
      b.appendChild(el('b', '', p.nom));
      b.appendChild(el('span', 't', p.txt));
      b.addEventListener('click', function () { r.prep = p.prep; r.trav = p.trav; r.rep = p.rep; r.tours = p.tours; ecrire(); garder(); if (run.actif) arreter(false); else pret(); });
      $('presets').appendChild(b);
    });
  }

  $('go').addEventListener('click', function () {
    if (run.actif) pause();
    else if (run.i >= run.seq.length) { pret(); demarrer(); }
    else demarrer();
  });
  $('raz').addEventListener('click', function () { arreter(false); });
  $('son').addEventListener('click', function () { r.son = !r.son; $('son').setAttribute('aria-pressed', String(r.son)); $('son').textContent = r.son ? '🔔 Son' : '🔕 Muet'; garder(); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden && run.actif) { garderEveille(true); tic(); } });
  window.addEventListener('pagehide', function () { clearInterval(run.timer); garderEveille(false); });

  ecrire();
  $('son').setAttribute('aria-pressed', String(r.son));
  $('son').textContent = r.son ? '🔔 Son' : '🔕 Muet';
  preregler();
  pret();
})();
