/* Calculateur d'allure : distance, temps et allure, on en renseigne deux et le troisième se calcule ; estimation du temps sur d'autres
   distances (formule de Riegel, exposant 1,06). Dépend de vie/aliments.js (aides). */
(function () {
  'use strict';

  var V = window.Vie, $ = V.$, el = V.el;
  var saved = V.store.get('allure', null) || {};
  var st = { mode: ['allure', 'temps', 'distance'].indexOf(saved.mode) >= 0 ? saved.mode : 'allure' };
  var PRESETS = [['5 km', 5], ['10 km', 10], ['Semi', 21.0975], ['Marathon', 42.195]];

  function n(id) { var v = parseFloat($(id).value); return isFinite(v) ? v : 0; }
  function pad(v) { return (v < 10 ? '0' : '') + v; }
  /* Durées : « 1:23:45 » ; allures : « 5:30 » */
  function temps(sec) {
    var s = Math.round(sec), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60);
    return (h ? h + ':' + pad(m) : m) + ':' + pad(s % 60);
  }
  function allure(secParKm) { var s = Math.round(secParKm); return Math.floor(s / 60) + ':' + pad(s % 60); }
  function km(v) { return (Math.round(v * 100) / 100).toString().replace('.', ','); }

  function tuile(emoji, valeur, unite, texte, cls) {
    var t = el('div', 'tile-b ' + cls), b = el('b', '', valeur);
    t.appendChild(el('span', 'e', emoji));
    if (unite) b.appendChild(el('small', '', ' ' + unite));
    t.appendChild(b);
    t.appendChild(el('span', 't', texte));
    return t;
  }

  function calculer() {
    var mode = st.mode, d = n('dist'), t = n('t-h') * 3600 + n('t-m') * 60 + n('t-s'), a = n('a-m') * 60 + n('a-s');
    if (mode === 'allure') { if (d > 0 && t > 0) a = t / d; else return null; }
    else if (mode === 'temps') { if (d > 0 && a > 0) t = a * d; else return null; }
    else if (a > 0 && t > 0) d = t / a; else return null;
    return { d: d, t: t, a: a };
  }

  function afficher() {
    var r = calculer(), host = $('stats'), pr = $('preds');
    $('f-distance').hidden = st.mode === 'distance';
    $('f-temps').hidden = st.mode === 'temps';
    $('f-allure').hidden = st.mode === 'allure';
    host.replaceChildren(); pr.replaceChildren();
    $('err').hidden = !!r;
    $('result').hidden = $('pred').hidden = !r;
    if (!r) { $('err').textContent = 'Renseignez des valeurs supérieures à zéro.'; return; }
    host.appendChild(tuile('🏃', allure(r.a), 'min/km', 'Allure', 'w2 c1'));
    host.appendChild(tuile('⚡', (3600 / r.a).toFixed(1).replace('.', ','), 'km/h', 'Vitesse', 'w2 c5'));
    host.appendChild(tuile('⏱️', temps(r.t), '', 'Temps', 'w2 c3'));
    host.appendChild(tuile('📏', km(r.d), 'km', 'Distance', 'w2 c4'));
    PRESETS.forEach(function (p, i) {
      var t2 = r.t * Math.pow(p[1] / r.d, 1.06);
      pr.appendChild(tuile(['🏁', '🎯', '🏅', '🏆'][i], temps(t2), '', p[0] + ' · ' + allure(t2 / p[1]) + ' /km', 'w2 c' + (i + 2)));
    });
    V.store.set('allure', { mode: st.mode });
  }

  /* Distances courantes en pastilles */
  PRESETS.forEach(function (p) {
    var b = el('button', 'chip', p[0]);
    b.type = 'button';
    b.addEventListener('click', function () { $('dist').value = p[1]; afficher(); });
    $('presets').appendChild(b);
  });
  ['dist', 't-h', 't-m', 't-s', 'a-m', 'a-s'].forEach(function (id) { $(id).addEventListener('input', afficher); });
  $('mode').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    st.mode = b.getAttribute('data-v');
    Array.prototype.forEach.call($('mode').querySelectorAll('button'), function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    afficher();
  });
  Array.prototype.forEach.call($('mode').querySelectorAll('button'), function (x) { x.setAttribute('aria-pressed', String(x.getAttribute('data-v') === st.mode)); });
  afficher();
})();
