/* Protéines et besoins : calcule le besoin journalier en calories et en protéines selon le profil, le sport et l'objectif,
   puis range les aliments qui apportent des protéines. Dépend de vie/aliments.js. Le résultat est gardé dans le navigateur
   pour que la page « Repas » connaisse la cible de protéines par repas. */
(function () {
  'use strict';

  var V = window.Vie, $ = V.$, el = V.el;
  var p = V.store.get('profil', null) || {};
  var st = { sexe: p.sexe === 'f' ? 'f' : 'h', repas: [1, 2, 3, 4, 5].indexOf(p.repas) >= 0 ? p.repas : 3, regime: 'tout', tri: 'p', sens: -1, vue: p.vue === 'tableau' || p.vue === 'cartes' ? p.vue : 'grille' };

  /* Multiplicateur d'activité (par rapport au métabolisme de base) selon la fréquence : sédentaire à très actif */
  var FACTEURS = [1.2, 1.375, 1.55, 1.725, 1.9];
  /* Fourchettes de protéines en g par kg et par jour : [type de sport][fréquence 0..4] = [mini, maxi] */
  var PROT = {
    aucun: [[0.8, 1.0], [0.9, 1.1], [1.0, 1.2], [1.1, 1.3], [1.2, 1.4]],
    endurance: [[0.9, 1.1], [1.0, 1.3], [1.2, 1.6], [1.4, 1.7], [1.5, 1.8]],
    force: [[1.0, 1.3], [1.2, 1.6], [1.6, 2.0], [1.6, 2.2], [1.8, 2.2]],
    mixte: [[1.0, 1.2], [1.1, 1.5], [1.4, 1.8], [1.5, 2.0], [1.6, 2.1]]
  };

  function lire() {
    var age = parseFloat($('age').value), poids = parseFloat($('poids').value), taille = parseFloat($('taille').value);
    if (!(age >= 15 && age <= 100)) return { err: 'Âge : entre 15 et 100 ans.' };
    if (!(poids >= 35 && poids <= 250)) return { err: 'Poids : entre 35 et 250 kg.' };
    if (!(taille >= 130 && taille <= 230)) return { err: 'Taille : entre 130 et 230 cm.' };
    return { age: age, poids: poids, taille: taille, sport: $('sport').value, freq: Number($('freq').value), objectif: $('objectif').value };
  }

  function calculer(d) {
    var bmr = 10 * d.poids + 6.25 * d.taille - 5 * d.age + (st.sexe === 'h' ? 5 : -161);   // Mifflin-St Jeor
    var tdee = bmr * FACTEURS[d.freq];
    var kcal = d.objectif === 'muscle' ? tdee * 1.1 : d.objectif === 'perte' ? Math.max(tdee * 0.85, bmr) : tdee;
    var f = PROT[d.sport === 'aucun' ? 'aucun' : d.sport][d.freq], lo = f[0], hi = f[1];
    if (d.objectif === 'muscle' && d.sport !== 'aucun') lo = Math.max(lo, 1.6);
    if (d.objectif === 'perte') { lo += 0.2; hi += 0.2; }            // garder le muscle quand on mange moins
    if (d.age >= 65) { lo = Math.max(lo, 1.0); hi = Math.max(hi, 1.2); }
    hi = Math.min(hi, 2.4); lo = Math.min(lo, hi);
    var gkg = (lo + hi) / 2, prot = gkg * d.poids;
    var lip = Math.max(kcal * 0.27 / 9, d.poids * 0.8);                // environ un quart des calories, au moins 0,8 g/kg
    var glu = Math.max(0, (kcal - prot * 4 - lip * 9) / 4);
    return { bmr: bmr, tdee: tdee, kcal: kcal, lo: lo, hi: hi, gkg: gkg, prot: prot, protMin: lo * d.poids, protMax: hi * d.poids, lip: lip, glu: glu };
  }

  function stat(emoji, valeur, unite, texte, cls) {
    var s = el('div', 'tile-b ' + cls), b = el('b', '', valeur);
    s.appendChild(el('span', 'e', emoji));
    if (unite) b.appendChild(el('small', '', ' ' + unite));
    s.appendChild(b);
    s.appendChild(el('span', 't', texte));
    return s;
  }
  function g(v) { return String(Math.round(v)); }

  function afficher(d, r) {
    var host = $('stats');
    host.replaceChildren();
    host.appendChild(stat('🍗', g(r.prot), 'g', 'Protéines par jour', 'w2 c1'));
    host.appendChild(stat('🍽️', g(r.prot / st.repas), 'g', 'Par repas (' + st.repas + (st.repas > 1 ? ' repas)' : ' repas)'), 'w2 c2'));
    host.appendChild(stat('🔥', g(r.kcal), 'kcal', d.objectif === 'muscle' ? 'Pour prendre du muscle' : d.objectif === 'perte' ? 'Pour perdre de la graisse' : 'Pour garder votre poids', 'w2 c3'));
    host.appendChild(stat('📏', g(r.protMin) + '–' + g(r.protMax), 'g', 'Fourchette protéines', 'w2 c4'));
    host.appendChild(stat('⚖️', r.gkg.toFixed(1).replace('.', ','), 'g/kg', 'Protéines par kilo', 'c5'));
    host.appendChild(stat('🏃', g(r.tdee), 'kcal', 'Dépense du jour', 'c6'));
    host.appendChild(stat('🫀', g(r.bmr), 'kcal', 'Métabolisme de base', 'c4'));
    host.appendChild(stat('🍚', g(r.glu) + ' · ' + g(r.lip), 'g', 'Glucides · lipides', 'c2'));
  }

  function maj() {
    var d = lire(), r;
    $('err').hidden = !d.err;
    if (d.err) { $('err').textContent = d.err; $('result').hidden = true; return; }
    $('result').hidden = false;
    r = calculer(d);
    afficher(d, r);
    V.store.set('profil', { sexe: st.sexe, repas: st.repas, age: d.age, poids: d.poids, taille: d.taille, sport: d.sport, freq: d.freq, objectif: d.objectif,
      prot: r.prot, kcal: r.kcal, vue: st.vue });
    tableaux();
  }

  /* ================= Tableaux de sources ================= */
  var COULEUR = { viande: 'c1', poisson: 'c5', 'oeuf-lait': 'c3', legumineuse: 'c4', soja: 'c4', graine: 'c2' };
  function tableaux() {
    var host = $('tables');
    host.replaceChildren();
    V.TABLES.forEach(function (t) {
      var foods = V.FOODS.filter(function (f) { return t.cats.indexOf(f.cat) >= 0 && V.allowed(f, st.regime) && f.p >= 3; });
      if (!foods.length) return;
      foods.sort(function (a, b) {
        var r = st.tri === 'd' ? a.p / a.kcal - b.p / b.kcal : st.tri === 'k' ? a.kcal - b.kcal : st.tri === 'a' ? a.court.localeCompare(b.court, 'fr') : a.p - b.p;
        return (r || a.court.localeCompare(b.court, 'fr')) * st.sens;
      });
      var sec = el('div'), wrap = el('div', 'scroll'), tbl = el('table', 'tbl'), thead = el('thead'), tr = el('tr'), tbody = el('tbody');
      sec.appendChild(el('h3', '', t.nom));
      if (st.vue === 'grille') { // tuiles compactes : emoji, nom, protéines pour 100 g
        var grille = el('div', 'tilegrid');
        foods.forEach(function (f) {
          var tl = el('div', 'tf'), val = el('b', 'tf-val', f.p.toString().replace('.', ',') + ' g');
          tl.style.background = 'var(--' + COULEUR[f.cat] + ')';
          tl.title = f.nom + ' : ' + f.kcal + ' kcal pour 100 g';
          tl.appendChild(el('span', 'tf-emo', f.emo));
          tl.appendChild(val);
          tl.appendChild(el('span', 'tf-nom', f.court));
          grille.appendChild(tl);
        });
        sec.appendChild(grille);
        host.appendChild(sec);
        return;
      }
      if (st.vue === 'cartes') {
        var cartes = el('div', 'bento foods');
        foods.forEach(function (f) {
          var c = el('div', 'tile-b ' + COULEUR[f.cat]), b = el('b', '', f.p.toString().replace('.', ','));
          b.appendChild(el('small', '', ' g'));
          c.appendChild(el('span', 'e', f.emo));
          c.appendChild(b);
          c.appendChild(el('span', 't', f.court));
          c.appendChild(el('span', 't sm', g(f.kcal) + ' kcal /100 g'));
          cartes.appendChild(c);
        });
        sec.appendChild(cartes);
        host.appendChild(sec);
        return;
      }
      [['a', 'Aliment'], ['p', 'Protéines /100 g'], ['k', 'kcal /100 g'], ['d', 'Protéines /100 kcal']].forEach(function (h) {
        var th = el('th'), b = el('button', 'th-tri', h[1] + (st.tri === h[0] ? (st.sens < 0 ? ' ↓' : ' ↑') : ''));
        b.type = 'button';
        b.addEventListener('click', function () { trier(h[0]); });
        th.setAttribute('aria-sort', st.tri === h[0] ? (st.sens < 0 ? 'descending' : 'ascending') : 'none');
        th.appendChild(b);
        tr.appendChild(th);
      });
      thead.appendChild(tr);
      foods.forEach(function (f) {
        var row = el('tr'), nom = el('td', '', f.emo + ' ' + f.nom);
        if (f.cat === 'oeuf-lait' && f.id === 'oeuf') nom.appendChild(el('span', 'tag', '1 œuf ≈ 6 g'));
        row.appendChild(nom);
        row.appendChild(el('td', 'strong', f.p.toString().replace('.', ',') + ' g'));
        row.appendChild(el('td', '', g(f.kcal)));
        row.appendChild(el('td', '', (f.p / f.kcal * 100).toFixed(1).replace('.', ',') + ' g'));
        tbody.appendChild(row);
      });
      tbl.appendChild(thead); tbl.appendChild(tbody); wrap.appendChild(tbl); sec.appendChild(wrap);
      host.appendChild(sec);
    });
  }

  /* ================= Entrées ================= */
  function seg(id, key, num) {
    var box = $(id);
    box.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      st[key] = num ? Number(b.getAttribute('data-v')) : b.getAttribute('data-v');
      Array.prototype.forEach.call(box.querySelectorAll('button'), function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      maj();
    });
    Array.prototype.forEach.call(box.querySelectorAll('button'), function (x) {
      x.setAttribute('aria-pressed', String((num ? Number(x.getAttribute('data-v')) : x.getAttribute('data-v')) === st[key]));
    });
  }
  /* Valeurs retrouvées de la dernière visite */
  [['age', p.age], ['poids', p.poids], ['taille', p.taille]].forEach(function (x) { if (x[1]) $(x[0]).value = x[1]; });
  [['sport', p.sport], ['freq', p.freq], ['objectif', p.objectif]].forEach(function (x) { if (x[1] !== undefined && x[1] !== null) $(x[0]).value = String(x[1]); });
  seg('sexe', 'sexe'); seg('repas', 'repas', true); seg('regime', 'regime'); seg('vue', 'vue');
  ['age', 'poids', 'taille'].forEach(function (id) { $(id).addEventListener('input', maj); });
  ['sport', 'freq', 'objectif'].forEach(function (id) { $(id).addEventListener('change', maj); });
  /* Trier : une clé (protéines, densité, calories, nom) et un sens ; les protéines, la densité vont du plus riche au moins riche, les calories et les noms du plus bas au plus haut */
  function trier(cle) {
    if (cle === st.tri) st.sens = -st.sens; else { st.tri = cle; st.sens = cle === 'k' || cle === 'a' ? 1 : -1; }
    $('tri').value = st.tri;
    $('sens').textContent = st.sens < 0 ? '↓' : '↑';
    tableaux();
  }
  $('tri').addEventListener('change', function () { var c = this.value; st.tri = ''; trier(c); });
  $('sens').addEventListener('click', function () { st.sens = -st.sens; $('sens').textContent = st.sens < 0 ? '↓' : '↑'; tableaux(); });
  maj();
})();
