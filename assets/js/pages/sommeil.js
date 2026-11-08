/* Sommeil et réveil : propose des heures de coucher ou de réveil qui tombent à la fin d'un cycle de sommeil (90 min en
   moyenne), en tenant compte du temps pour s'endormir et de la durée de sommeil conseillée pour l'âge. Dépend de vie/aliments.js. */
(function () {
  'use strict';

  var V = window.Vie, $ = V.$, el = V.el;
  var CYCLE = 90;
  var saved = V.store.get('sommeil', null) || {};
  var st = { mode: saved.mode === 'coucher' ? 'coucher' : 'reveil' };

  /* Durée de sommeil conseillée par tranche d'âge, en heures [mini, maxi] */
  function reco(age) {
    if (age < 14) return [9, 11];
    if (age < 18) return [8, 10];
    if (age < 65) return [7, 9];
    return [7, 8];
  }
  function hhmm(min) {
    min = ((Math.round(min) % 1440) + 1440) % 1440;
    var h = Math.floor(min / 60), m = min % 60;
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }
  function lire() {
    var h = $('heure').value.split(':');
    if (h.length < 2 || isNaN(h[0]) || isNaN(h[1])) return null;
    return Number(h[0]) * 60 + Number(h[1]);
  }

  function afficher() {
    var t = lire(), age = parseFloat($('age').value) || 30, lat = Number($('latence').value), r = reco(age), host = $('times'), n;
    $('latence-v').textContent = lat;
    host.replaceChildren();
    $('titre').textContent = st.mode === 'reveil' ? 'Heures de coucher pour vous réveiller à ' + ($('heure').value || '…') : 'Heures de réveil si vous vous couchez à ' + ($('heure').value || '…');
    if (t === null) return;
    /* Du plus de sommeil au moins : 6 à 3 cycles pour se coucher (la plus tôt d'abord), l'inverse pour se réveiller */
    var cycles = st.mode === 'reveil' ? [6, 5, 4, 3] : [3, 4, 5, 6];
    cycles.forEach(function (n) {
      var duree = n * CYCLE, h = duree / 60, heure = st.mode === 'reveil' ? t - duree - lat : t + lat + duree;
      var row = el('div', 'time'), b = el('b', '', hhmm(heure)), d = el('div', 'd'), badge, cls = 'time';
      d.textContent = n + ' cycles · ' + V.duree(duree) + ' de sommeil';
      if (h >= r[0] && h <= r[1]) { cls += ' best'; badge = 'Dans le repère'; }
      else if (h < r[0]) { cls += ' short'; badge = 'Court'; }
      else { badge = 'Long'; }
      row.className = cls;
      row.appendChild(b); row.appendChild(d); row.appendChild(el('span', 'badge', badge));
      host.appendChild(row);
    });
    $('reco').textContent = 'Repère à ' + Math.round(age) + ' ans : environ ' + r[0] + ' à ' + r[1] + ' h de sommeil, soit ' + Math.ceil(r[0] * 60 / CYCLE) + ' à ' + Math.floor(r[1] * 60 / CYCLE) + ' cycles.';
    V.store.set('sommeil', { mode: st.mode, age: age, latence: lat });
  }

  function mode(m) {
    st.mode = m;
    Array.prototype.forEach.call($('mode').querySelectorAll('button'), function (x) { x.setAttribute('aria-pressed', String(x.getAttribute('data-v') === m)); });
    $('lab-heure').textContent = m === 'reveil' ? 'Je me réveille à' : 'Je me couche à';
    afficher();
  }

  $('mode').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) mode(b.getAttribute('data-v')); });
  ['heure', 'age', 'latence'].forEach(function (id) { $(id).addEventListener('input', afficher); });
  $('maintenant').addEventListener('click', function () {
    var d = new Date();
    $('heure').value = (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
    mode('coucher');
  });
  if (saved.age) $('age').value = saved.age;
  if (saved.latence !== undefined) $('latence').value = saved.latence;
  mode(st.mode);
})();
