/* Compositeur de repas : on coche ce qu'on a sous la main, la page compose des idées de repas avec, et chaque aliment a ses
   variantes (un autre féculent, une autre façon de le préparer ou de le couper). Les apports sont indiqués à titre de repère.
   Dépend de vie/aliments.js. Pas de cible à saisir : les quantités sont des portions courantes, et les protéines sont indiquées dans le résultat. */
(function () {
  'use strict';

  var V = window.Vie, $ = V.$, el = V.el, clamp = V.clamp;
  var saved = V.store.get('repas2', null) || {};
  var st = {
    regime: saved.regime === 'vege' || saved.regime === 'vegan' ? saved.regime : 'tout',
    vue: ['pastilles', 'grille', 'liste'].indexOf(saved.vue) >= 0 ? saved.vue : 'grille', q: '',
    vueIdees: saved.vueIdees === 'liste' ? 'liste' : 'grille',
    pantry: Array.isArray(saved.pantry) ? saved.pantry.filter(function (id) { return V.byId[id]; }) : [],
    ideas: Array.isArray(saved.ideas) ? saved.ideas.map(nettoyer).filter(Boolean) : []
  };
  var NB_IDEES = 3;
  var enEdition = {};   // idées dont on modifie les ingrédients (les autres montrent un simple résumé)
  /* Ce qui peut servir de source de protéines dans une assiette : pas le lait, la poudre, le fromage à râper, etc. */
  var NON_PLAT = ['lait', 'lait-entier', 'lait-ecreme', 'lait-soja', 'lait-avoine', 'lait-amande', 'lait-riz', 'pst', 'petits-pois', 'pain-complet', 'baguette', 'pain-mie', 'biscottes', 'muesli', 'crepe', 'houmous', 'anchois'];
  var ROLES = [['proteine', 'Protéines'], ['feculent', 'Féculents'], ['legume', 'Légumes'], ['fruit', 'Fruits'], ['garniture', 'Graines et fruits à coque'], ['gras', 'Matières grasses']];

  function role(f) {
    if (NON_PLAT.indexOf(f.id) >= 0) return null;
    if (V.PROTEIN_CATS.indexOf(f.cat) >= 0) return 'proteine';
    return f.cat === 'feculent' ? 'feculent' : f.cat === 'legume' ? 'legume' : f.cat === 'fruit' ? 'fruit' : f.cat === 'gras' ? 'gras' : f.cat === 'graine' ? 'garniture' : null;
  }
  function pool(r) { return V.FOODS.filter(function (f) { return role(f) === r && V.allowed(f, st.regime); }); }
  function enGarde(foods) { return foods.filter(function (f) { return st.pantry.indexOf(f.id) >= 0; }); }
  function garder() { V.store.set('repas2', { regime: st.regime, vue: st.vue, vueIdees: st.vueIdees, pantry: st.pantry, ideas: st.ideas }); }
  /* Une idée relue du stockage : on écarte ce qui n'existe plus */
  function nettoyer(idea) {
    if (!idea || !Array.isArray(idea.items)) return null;
    var items = idea.items.filter(function (i) { return V.byId[i.id] && i.g > 0; }).map(function (i) {
      return { id: i.id, g: i.g, prep: V.byId[i.id].preps.indexOf(i.prep) >= 0 ? i.prep : V.byId[i.id].preps[0] };
    });
    return items.length ? { items: items } : null;
  }

  /* ================= Garde-manger ================= */
  /* Un aliment à cocher, dessiné selon la vue : pastille, tuile avec grand emoji, ou ligne de liste avec ses valeurs */
  function sans(t) { return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function element(f, membres) {
    var fam = f.famille ? V.FAMILLES[f.famille] : null, ids = membres.map(function (x) { return x.id; }), on = ids.some(function (id) { return st.pantry.indexOf(id) >= 0; }), b;
    var emoji = fam ? fam.emo : f.emo, court = fam ? fam.nom : f.court;
    function basculer(e) {
      var actif = ids.some(function (id) { return st.pantry.indexOf(id) >= 0; });
      ids.forEach(function (id) {
        var i = st.pantry.indexOf(id);
        if (actif && i >= 0) st.pantry.splice(i, 1);
        else if (!actif && i < 0) st.pantry.push(id);
      });
      e.setAttribute('aria-pressed', String(!actif));
      garder(); indice();
    }
    if (st.vue === 'grille') {
      b = el('button', 'tf');
      b.appendChild(el('span', 'tf-emo', emoji));
      b.appendChild(el('span', 'tf-nom', court));
    } else if (st.vue === 'liste') {
      b = el('button', 'rowfood');
      b.appendChild(el('span', 'rf-emo', emoji));
      b.appendChild(el('span', 'rf-nom', fam ? fam.nom + ' (' + membres.map(function (x) { return x.coupe.toLowerCase(); }).join(', ') + ')' : f.nom));
      b.appendChild(el('span', 'rf-val', fam ? membres.length + ' formes' : f.p.toString().replace('.', ',') + ' g prot. · ' + Math.round(f.kcal) + ' kcal /100 g'));
    } else {
      b = el('button', 'chip', emoji + ' ' + court);
    }
    b.type = 'button';
    b.setAttribute('aria-pressed', String(on));
    b.addEventListener('click', function () { basculer(b); });
    return b;
  }
  function dessinerGardeManger() {
    var host = $('pantry'), q = sans(st.q.trim());
    host.replaceChildren();
    ROLES.forEach(function (rl) {
      var tous = pool(rl[0]), foods = tous.filter(function (f) { return !q || sans(f.nom).indexOf(q) >= 0 || (f.famille && sans(V.FAMILLES[f.famille].nom).indexOf(q) >= 0); }), vus = {}, box, wrap;
      if (!foods.length) return;
      box = el('div', 'pantry-group');
      box.appendChild(el('span', 'lab', rl[1]));
      wrap = el('div', st.vue === 'grille' ? 'tilegrid' : st.vue === 'liste' ? 'rowlist' : 'chips');
      foods.forEach(function (f) {
        if (f.famille) {
          if (vus[f.famille]) return;
          vus[f.famille] = true;
          wrap.appendChild(element(f, tous.filter(function (x) { return x.famille === f.famille; })));
        } else wrap.appendChild(element(f, [f]));
      });
      box.appendChild(wrap);
      host.appendChild(box);
    });
    if (!host.firstChild) host.appendChild(el('p', 'empty muted', 'Aucun aliment ne correspond.'));
    indice();
  }
  function indice() {
    var n = st.pantry.filter(function (id) { return V.allowed(V.byId[id], st.regime); }).length;
    $('pantry-hint').textContent = n ? n + (n > 1 ? ' aliments cochés : les idées n’utilisent que ceux-là (et un filet d’huile d’olive).' : ' aliment coché : les idées n’utilisent que lui (et un filet d’huile d’olive).')
      : 'Rien de coché : les idées piochent dans tout ce qui existe, pour vous inspirer.';
  }

  /* ================= Composer une idée ================= */
  function tirer(liste) { return liste[Math.floor(Math.random() * liste.length)]; }
  function melanger(liste) {
    var a = liste.slice(), i, j, t;
    for (i = a.length - 1; i > 0; i--) { j = Math.floor(Math.random() * (i + 1)); t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  /* Les aliments d'un rôle : ceux qu'on a coché s'il y en a, sinon tout (quand rien n'est coché du tout) */
  function sources(r) {
    var tout = pool(r);
    if (!st.pantry.length) return tout;
    return enGarde(tout);
  }
  /* `evite` : aliments déjà pris par les autres idées, pour varier. Les quantités sont des portions courantes. */
  function composer(evite) {
    var items = [], main, fec, legs;
    var mains = melanger(sources('proteine')), fecs = melanger(sources('feculent')), legumes = melanger(sources('legume'));
    main = mains.filter(function (f) { return evite.indexOf(f.id) < 0; })[0] || mains[0];
    fec = fecs.filter(function (f) { return evite.indexOf(f.id) < 0; })[0] || fecs[0];
    legs = legumes.filter(function (f) { return evite.indexOf(f.id) < 0; }).concat(legumes).slice(0, 2).filter(function (f, i, a) { return a.indexOf(f) === i; });
    var fruit = melanger(sources('fruit'))[0];
    if (!main && !fec && !legs.length) return null;
    if (main) items.push({ id: main.id, g: main.portion });
    if (fec) items.push({ id: fec.id, g: fec.portion });
    legs.forEach(function (l, i) { items.push({ id: l.id, g: i ? 120 : 150 }); });
    var gras = enGarde(pool('gras')), fat = st.pantry.length && gras.length ? tirer(gras) : V.byId['huile-olive'], gar = melanger(sources('garniture'))[0];
    items.push({ id: fat.id, g: fat.portion });
    if (gar && (st.pantry.length || Math.random() < 0.35)) items.push({ id: gar.id, g: gar.portion });
    if (fruit && (st.pantry.length || Math.random() < 0.5)) items.push({ id: fruit.id, g: fruit.portion });
    return { items: items.map(function (i) { return { id: i.id, g: i.g, prep: tirer(V.byId[i.id].preps) }; }) };
  }

  function totalDe(items) {
    var t = { kcal: 0, p: 0, g: 0, l: 0 };
    items.forEach(function (it) { var m = V.macros(V.byId[it.id], it.g); t.kcal += m.kcal; t.p += m.p; t.g += m.g; t.l += m.l; });
    return t;
  }
  /* « Poulet grillé, patate douce en dés rôtie et brocoli vapeur » */
  function titre(idea) {
    var parts = idea.items.filter(function (i) { var c = V.byId[i.id].cat; return c !== 'gras' && c !== 'fruit'; }).map(function (i) {
      var f = V.byId[i.id];
      return f.court + (i.prep === 'nature' ? '' : ' ' + i.prep);
    });
    if (!parts.length) return 'Idée de repas';
    parts = parts.map(function (p, i) { return i ? p.replace(/^./, function (c) { return c.toLowerCase(); }) : p; }); // une seule majuscule, au début
    return parts.length === 1 ? parts[0] : parts.slice(0, -1).join(', ') + ' et ' + parts[parts.length - 1];
  }
  /* Les emojis des aliments du plat, sans l'huile, pour décorer la carte */
  function emojis(idea) {
    return idea.items.filter(function (i) { return V.byId[i.id].cat !== 'gras'; }).map(function (i) { return V.byId[i.id].emo; }).join(' ');
  }
  function manque(idea) {
    var roles = idea.items.map(function (i) { return role(V.byId[i.id]); }), m = [];
    if (roles.indexOf('proteine') < 0) m.push('une source de protéines (' + pool('proteine').slice(0, 3).map(function (f) { return f.court.toLowerCase(); }).join(', ') + '…)');
    if (roles.indexOf('feculent') < 0) m.push('un féculent (' + pool('feculent').slice(0, 3).map(function (f) { return f.court.toLowerCase(); }).join(', ') + '…)');
    if (roles.indexOf('legume') < 0) m.push('des légumes');
    return m;
  }

  /* ================= Variantes ================= */
  /* Remplace l'aliment d'une ligne par un autre du même rôle, en gardant un apport comparable */
  function changer(idea, i, id) {
    var old = idea.items[i], fo = V.byId[old.id], fn = V.byId[id], mo = V.macros(fo, old.g), g;
    if (role(fn) === 'proteine') g = mo.p > 0 ? mo.p / (fn.p / 100) : old.g;
    else if (role(fn) === 'feculent') g = mo.kcal / fn.kcal * 100;
    else if (role(fn) === 'gras' || role(fn) === 'garniture') g = fn.portion;
    else g = old.g;
    idea.items[i] = { id: id, g: V.round(clamp(g, 10, 500), 5), prep: fn.preps[0] };
  }

  /* ================= Affichage ================= */
  function nb(v, d) { return v.toFixed(d || 0).replace('.', ','); }
  function resume(idea) {
    var t = totalDe(idea.items);
    return '≈ ' + nb(t.kcal) + ' kcal · ' + nb(t.p) + ' g de protéines · ' + nb(t.g) + ' g de glucides · ' + nb(t.l) + ' g de lipides';
  }
  /* Les apports de l'idée en quatre pastilles : calories, protéines, glucides, lipides */
  function pastilles(host, idea) {
    var t = totalDe(idea.items);
    host.replaceChildren();
    [['🔥', nb(t.kcal), 'kcal', 'Calories'], ['💪', nb(t.p), 'g', 'Protéines'], ['🍚', nb(t.g), 'g', 'Glucides'], ['🥑', nb(t.l), 'g', 'Lipides']].forEach(function (x) {
      var s = el('span', 'pill');
      s.title = x[3];
      s.setAttribute('aria-label', x[3] + ' : ' + x[1] + ' ' + x[2]);
      s.appendChild(el('span', '', x[0]));
      s.appendChild(el('b', '', x[1]));
      s.appendChild(el('small', '', x[2]));
      host.appendChild(s);
    });
  }
  /* Le résumé d'une idée : une ligne par ingrédient, avec sa préparation et sa quantité */
  function lignes(host, idea) {
    host.replaceChildren();
    idea.items.forEach(function (it) {
      var f = V.byId[it.id], li = el('li');
      li.appendChild(el('span', 'n', f.emo + ' ' + f.court + (it.prep === 'nature' ? '' : ' ' + it.prep)));
      li.appendChild(el('b', '', Math.round(it.g) + ' g'));
      host.appendChild(li);
    });
  }
  function texte(idea) {
    return titre(idea) + '\n' + idea.items.map(function (i) { var f = V.byId[i.id]; return '- ' + f.court + (i.prep === 'nature' ? '' : ' ' + i.prep) + ' : ' + Math.round(i.g) + ' g'; }).join('\n') + '\n' + resume(idea);
  }

  function carte(idea, index) {
    var card = el('section', 'card idea'), emo = el('div', 'emo', emojis(idea)), h = el('h2', '', titre(idea)), sum = el('div', 'pills'), list = el('div', 'items'), compo = el('ul', 'compo'), acts = el('div', 'actions'), m = manque(idea), edit = !!enEdition[index];
    function maj() { h.textContent = titre(idea); emo.textContent = emojis(idea); pastilles(sum, idea); lignes(compo, idea); garder(); }
    pastilles(sum, idea);
    lignes(compo, idea);
    idea.items.forEach(function (it, i) {
      var f = V.byId[it.id], row = el('div', 'item'), sel = el('select'), forme = null, prep = el('select'), g = el('input'), r = role(f), alts, chez, autres;
      if (r) {
        /* Les aliments possibles, une seule ligne par famille ; ceux d'une autre ligne du repas sont écartés */
        var vusU = {};
        alts = pool(r).filter(function (x) {
          var u = V.unite(x);
          if (vusU[u]) return false;
          vusU[u] = true;
          return u === V.unite(f) || !idea.items.some(function (o) { return V.unite(V.byId[o.id]) === u; });
        });
        chez = alts.filter(function (x) { return pool(r).some(function (y) { return V.unite(y) === V.unite(x) && st.pantry.indexOf(y.id) >= 0; }); });
        autres = alts.filter(function (x) { return chez.indexOf(x) < 0; });
        var grp1 = el('optgroup'), grp2 = el('optgroup');
        grp1.label = 'Ce que j’ai'; grp2.label = chez.length ? 'Autres' : 'Variantes';
        function libelle(x) { var fam = x.famille ? V.FAMILLES[x.famille] : null; return (fam ? fam.emo + ' ' + fam.nom : x.emo + ' ' + x.court); }
        chez.forEach(function (x) { var o = el('option', '', libelle(x)); o.value = V.unite(x); grp1.appendChild(o); });
        autres.forEach(function (x) { var o = el('option', '', libelle(x)); o.value = V.unite(x); grp2.appendChild(o); });
        if (chez.length) sel.appendChild(grp1);
        if (autres.length) sel.appendChild(grp2);
        sel.value = V.unite(f);
        sel.setAttribute('aria-label', 'Aliment : ' + f.court);
        sel.addEventListener('change', function () {
          var u = sel.value, membres = pool(r).filter(function (x) { return V.unite(x) === u; });
          var cible = membres.filter(function (x) { return st.pantry.indexOf(x.id) >= 0; })[0] || membres[0];
          changer(idea, i, cible.id); rendre(); garder();
        });
        /* La forme (haché, steak, bavette, rôti…), quand l'aliment en a plusieurs */
        var formes = f.famille ? pool(r).filter(function (x) { return x.famille === f.famille; }) : [];
        if (formes.length > 1) {
          forme = el('select');
          formes.forEach(function (x) { var o = el('option', '', x.coupe); o.value = x.id; forme.appendChild(o); });
          forme.value = f.id;
          forme.setAttribute('aria-label', 'Forme : ' + V.FAMILLES[f.famille].nom);
          forme.addEventListener('change', function () { changer(idea, i, forme.value); rendre(); garder(); });
        }
      } else {
        sel.appendChild(el('option', '', f.emo + ' ' + f.court));
        sel.disabled = true;
      }
      f.preps.forEach(function (p) { var o = el('option', '', p); o.value = p; prep.appendChild(o); });
      prep.value = it.prep;
      prep.disabled = f.preps.length < 2;
      prep.setAttribute('aria-label', 'Préparation : ' + f.court);
      prep.addEventListener('change', function () { it.prep = prep.value; maj(); });
      g.type = 'number'; g.min = '5'; g.max = '1000'; g.step = '5'; g.value = Math.round(it.g); g.inputMode = 'numeric';
      g.setAttribute('aria-label', 'Quantité en grammes : ' + f.court);
      g.title = 'grammes';
      g.addEventListener('input', function () { var v = parseFloat(g.value); if (v > 0) { it.g = v; maj(); } });
      var l1 = el('div', 'l1'), l2 = el('div', 'l2');
      l1.appendChild(sel); if (forme) l1.appendChild(forme);
      l2.appendChild(prep); l2.appendChild(g);
      row.appendChild(l1); row.appendChild(l2);
      list.appendChild(row);
    });
    card.appendChild(emo); card.appendChild(h); card.appendChild(sum);
    card.appendChild(edit ? list : compo);
    if (edit) card.classList.add('edit');
    if (m.length) card.appendChild(el('p', 'hint', 'Pour compléter : ' + m.join(', ') + '.'));
    var modif = el('button', 'mini', edit ? '✔ Terminé' : '✏️ Modifier'), autre = el('button', 'mini', '↻ Autre'), copie = el('button', 'mini', 'Copier');
    modif.type = autre.type = copie.type = 'button';
    modif.addEventListener('click', function () { enEdition[index] = !enEdition[index]; rendre(); });
    autre.addEventListener('click', function () {
      var nouvelle = composer(st.ideas.map(function (x, k) { return k === index ? '' : x.items[0].id; }));
      if (nouvelle) { st.ideas[index] = nouvelle; garder(); rendre(); }
    });
    copie.addEventListener('click', function () {
      try { navigator.clipboard.writeText(texte(idea)); copie.textContent = 'Copié'; setTimeout(function () { copie.textContent = 'Copier'; }, 1500); } catch (e) { /* presse-papiers indisponible */ }
    });
    acts.appendChild(modif); acts.appendChild(autre); acts.appendChild(copie);
    card.appendChild(acts);
    return card;
  }

  function rendre() {
    var host = $('ideas');
    host.replaceChildren();
    host.className = st.vueIdees;
    if (!st.ideas.length) return;
    st.ideas.forEach(function (idea, i) { host.appendChild(carte(idea, i)); });
  }

  function trouver() {
    var ideas = [], evite = [], idea, k;
    if (st.pantry.length && !st.pantry.some(function (id) { return V.allowed(V.byId[id], st.regime); })) {
      $('ideas').replaceChildren(el('p', 'notice', 'Aucun des aliments cochés ne correspond à ce régime : cochez-en d’autres.'));
      return;
    }
    for (k = 0; k < NB_IDEES; k++) {
      idea = composer(evite);
      if (!idea) break;
      ideas.push(idea);
      if (idea.items[0]) evite.push(idea.items[0].id);
      idea.items.forEach(function (i) { if (role(V.byId[i.id]) === 'feculent') evite.push(i.id); });
    }
    if (!ideas.length) { $('ideas').replaceChildren(el('p', 'notice', 'Rien à composer avec cette sélection : cochez au moins un aliment de base.')); return; }
    st.ideas = ideas;
    enEdition = {};
    garder(); rendre();
  }

  /* ================= Entrées ================= */
  $('idees').addEventListener('click', trouver);
  $('vue-idees').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    st.vueIdees = b.getAttribute('data-v');
    Array.prototype.forEach.call($('vue-idees').querySelectorAll('button'), function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    garder(); $('ideas').className = st.vueIdees;
  });
  Array.prototype.forEach.call($('vue-idees').querySelectorAll('button'), function (x) { x.setAttribute('aria-pressed', String(x.getAttribute('data-v') === st.vueIdees)); });
  $('vue').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    st.vue = b.getAttribute('data-v');
    Array.prototype.forEach.call($('vue').querySelectorAll('button'), function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    garder(); dessinerGardeManger();
  });
  Array.prototype.forEach.call($('vue').querySelectorAll('button'), function (x) { x.setAttribute('aria-pressed', String(x.getAttribute('data-v') === st.vue)); });
  $('cherche').addEventListener('input', function () { st.q = this.value; dessinerGardeManger(); });
  $('decocher').addEventListener('click', function () { st.pantry = []; garder(); dessinerGardeManger(); });
  $('regime').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    st.regime = b.getAttribute('data-v');
    Array.prototype.forEach.call($('regime').querySelectorAll('button'), function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    st.ideas = st.ideas.filter(function (idea) { return idea.items.every(function (i) { return V.allowed(V.byId[i.id], st.regime); }); });
    garder(); dessinerGardeManger(); rendre();
  });
  Array.prototype.forEach.call($('regime').querySelectorAll('button'), function (x) { x.setAttribute('aria-pressed', String(x.getAttribute('data-v') === st.regime)); });

  dessinerGardeManger();
  rendre();
})();
