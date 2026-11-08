/* Liste de courses : on ajoute les ingrédients des idées de repas (page « Compositeur de repas ») ou des aliments à la main ; les quantités
   s'additionnent, se rangent par rayon et se cochent. Dépend de vie/aliments.js. */
(function () {
  'use strict';

  var V = window.Vie, $ = V.$, el = V.el;
  var saved = V.store.get('courses', null) || {};
  var st = {
    pers: saved.pers >= 1 && saved.pers <= 12 ? saved.pers : 1,
    vue: ['grille', 'pastilles', 'liste'].indexOf(saved.vue) >= 0 ? saved.vue : 'grille', q: '',
    items: saved.items && typeof saved.items === 'object' ? saved.items : {},     // aliment -> grammes
    fait: saved.fait && typeof saved.fait === 'object' ? saved.fait : {}          // aliment -> coché
  };
  Object.keys(st.items).forEach(function (id) { if (!V.byId[id] || !(st.items[id] > 0)) { delete st.items[id]; delete st.fait[id]; } });
  /* Les idées du compositeur de repas, si on en a composé */
  var repas = V.store.get('repas2', null) || {}, idees = Array.isArray(repas.ideas) ? repas.ideas : [];

  function garder() { V.store.set('courses', { pers: st.pers, vue: st.vue, items: st.items, fait: st.fait }); }
  function sans(t) { return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function quantite(g) { return g >= 1000 ? (Math.round(g / 100) / 10).toString().replace('.', ',') + ' kg' : Math.round(g) + ' g'; }
  function titre(idea) {
    var noms = idea.items.filter(function (i) { var f = V.byId[i.id]; return f && f.cat !== 'gras' && f.cat !== 'fruit' && f.cat !== 'graine'; }).map(function (i) { return V.byId[i.id].court; });
    return noms.length ? noms.join(', ') : 'Idée de repas';
  }
  function ajouter(id, g) {
    if (!V.byId[id] || !(g > 0)) return;
    st.items[id] = (st.items[id] || 0) + g;
    delete st.fait[id];
  }

  /* ----- Idées de repas à ajouter ----- */
  function dessinerIdees() {
    var host = $('idees');
    host.replaceChildren();
    if (!idees.length) {
      host.appendChild(el('p', 'hint', 'Composez des idées dans « Compositeur de repas » : elles apparaîtront ici, prêtes à ajouter.'));
      return;
    }
    host.appendChild(el('span', 'lab', 'Mes idées de repas'));
    var chips = el('div', 'chips');
    idees.forEach(function (idea) {
      var b = el('button', 'chip', '➕ ' + titre(idea));
      b.type = 'button';
      b.addEventListener('click', function () {
        idea.items.forEach(function (i) { ajouter(i.id, i.g * st.pers); });
        garder(); dessinerListe();
      });
      chips.appendChild(b);
    });
    host.appendChild(chips);
  }

  /* ----- La liste, par rayon ----- */
  function dessinerListe() {
    var host = $('liste'), ids = Object.keys(st.items), n = 0, fait = 0;
    host.replaceChildren();
    if (!ids.length) {
      host.appendChild(el('p', 'empty muted', 'La liste est vide. Ajoutez une idée de repas ou un aliment.'));
      $('titre').textContent = '🛒 Ma liste';
      return;
    }
    Object.keys(V.CATS).forEach(function (cat) {
      var foods = ids.map(function (id) { return V.byId[id]; }).filter(function (f) { return f.cat === cat; }), box, ul;
      if (!foods.length) return;
      foods.sort(function (a, b) { return a.court.localeCompare(b.court, 'fr'); });
      box = el('div', 'rayon');
      box.appendChild(el('h3', '', V.CATS[cat]));
      ul = el('div', 'courses');
      foods.forEach(function (f) {
        var row = el('label', 'course' + (st.fait[f.id] ? ' fait' : '')), cb = el('input'), nom = el('span', 'cn', f.emo + ' ' + f.court), q = el('input', 'cq'), rm = el('button', 'rm', '×');
        n++; if (st.fait[f.id]) fait++;
        cb.type = 'checkbox'; cb.checked = !!st.fait[f.id];
        cb.addEventListener('change', function () { st.fait[f.id] = cb.checked; garder(); dessinerListe(); });
        q.type = 'number'; q.min = '5'; q.max = '20000'; q.step = '5'; q.value = Math.round(st.items[f.id]); q.inputMode = 'numeric';
        q.setAttribute('aria-label', 'Quantité en grammes : ' + f.court);
        q.title = quantite(st.items[f.id]);
        q.addEventListener('click', function (e) { e.preventDefault(); });
        q.addEventListener('input', function () { var v = parseFloat(q.value); if (v > 0) { st.items[f.id] = v; garder(); q.title = quantite(v); } });
        rm.type = 'button'; rm.setAttribute('aria-label', 'Retirer ' + f.court);
        rm.addEventListener('click', function (e) { e.preventDefault(); delete st.items[f.id]; delete st.fait[f.id]; garder(); dessinerListe(); });
        row.appendChild(cb); row.appendChild(nom); row.appendChild(q); row.appendChild(el('span', 'cg', 'g')); row.appendChild(rm);
        ul.appendChild(row);
      });
      box.appendChild(ul);
      host.appendChild(box);
    });
    $('titre').textContent = '🛒 Ma liste · ' + fait + ' / ' + n;
  }

  /* ----- Ajouter un aliment : trois vues et une recherche ----- */
  function element(f) {
    var b;
    if (st.vue === 'grille') {
      b = el('button', 'tf');
      b.appendChild(el('span', 'tf-emo', f.emo));
      b.appendChild(el('span', 'tf-nom', f.court));
    } else if (st.vue === 'liste') {
      b = el('button', 'rowfood');
      b.appendChild(el('span', 'rf-emo', f.emo));
      b.appendChild(el('span', 'rf-nom', f.nom));
      b.appendChild(el('span', 'rf-val', f.portion + ' g'));
    } else b = el('button', 'chip', f.emo + ' ' + f.court);
    b.type = 'button';
    b.setAttribute('aria-pressed', String(f.id in st.items));
    b.setAttribute('aria-label', 'Ajouter ' + f.court);
    b.addEventListener('click', function () {
      ajouter(f.id, f.portion * st.pers);
      garder(); dessinerListe();
      b.setAttribute('aria-pressed', 'true');
    });
    return b;
  }
  function dessinerChoix() {
    var host = $('choix'), q = sans(st.q.trim());
    host.replaceChildren();
    Object.keys(V.CATS).forEach(function (cat) {
      var foods = V.FOODS.filter(function (f) { return f.cat === cat && (!q || sans(f.nom).indexOf(q) >= 0 || sans(f.court).indexOf(q) >= 0); }), box, wrap;
      if (!foods.length) return;
      box = el('div', 'pantry-group');
      box.appendChild(el('span', 'lab', V.CATS[cat]));
      wrap = el('div', st.vue === 'grille' ? 'tilegrid' : st.vue === 'liste' ? 'rowlist' : 'chips');
      foods.forEach(function (f) { wrap.appendChild(element(f)); });
      box.appendChild(wrap);
      host.appendChild(box);
    });
    if (!host.firstChild) host.appendChild(el('p', 'empty muted', 'Aucun aliment ne correspond.'));
  }
  $('vue').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    st.vue = b.getAttribute('data-v');
    Array.prototype.forEach.call($('vue').querySelectorAll('button'), function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    garder(); dessinerChoix();
  });
  Array.prototype.forEach.call($('vue').querySelectorAll('button'), function (x) { x.setAttribute('aria-pressed', String(x.getAttribute('data-v') === st.vue)); });
  $('cherche').addEventListener('input', function () { st.q = this.value; dessinerChoix(); });
  $('pers').value = st.pers;
  $('pers').addEventListener('input', function () { var v = parseInt($('pers').value, 10); if (v >= 1 && v <= 12) { st.pers = v; garder(); } });

  /* ----- Boutons ----- */
  $('decocher').addEventListener('click', function () { st.fait = {}; garder(); dessinerListe(); });
  $('vider').addEventListener('click', function () { st.items = {}; st.fait = {}; garder(); dessinerListe(); });
  $('copier').addEventListener('click', function () {
    var lignes = Object.keys(V.CATS).map(function (cat) {
      var foods = Object.keys(st.items).map(function (id) { return V.byId[id]; }).filter(function (f) { return f.cat === cat; });
      if (!foods.length) return '';
      foods.sort(function (a, b) { return a.court.localeCompare(b.court, 'fr'); });
      return V.CATS[cat] + '\n' + foods.map(function (f) { return (st.fait[f.id] ? '☑ ' : '☐ ') + f.court + ' : ' + quantite(st.items[f.id]); }).join('\n');
    }).filter(Boolean).join('\n\n');
    if (!lignes) return;
    try { navigator.clipboard.writeText(lignes); $('copier').textContent = 'Copié'; setTimeout(function () { $('copier').textContent = 'Copier'; }, 1500); } catch (e) { /* presse-papiers indisponible */ }
  });

  dessinerChoix();
  dessinerIdees();
  dessinerListe();
})();
