/* Programme course à pied : un exemple de semaine selon le niveau, le nombre de jours et l'objectif, ou une semaine composée soi-même
   (ajouter, retirer, régler la durée, déplacer une séance). Dépend de vie/aliments.js et vie/glisser.js. */
(function () {
  'use strict';

  var V = window.Vie, $ = V.$, el = V.el, clamp = V.clamp;
  var saved = V.store.get('course', null) || {};
  var st = {
    niveau: [0, 1, 2].indexOf(saved.niveau) >= 0 ? saved.niveau : 1,
    jours: saved.jours >= 2 && saved.jours <= 6 ? saved.jours : 3,
    objectif: [0, 1, 2, 3].indexOf(saved.objectif) >= 0 ? saved.objectif : 0,
    perso: saved.perso && typeof saved.perso === 'object' ? saved.perso : {},   // semaines réarrangées ou composées, par nombre de jours
    edition: false                                                             // mode « composer moi-même »
  };
  var JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  var TYPES = ['footing', 'court', 'longue', 'fractionne', 'seuil', 'cotes'];
  var NOMS = { footing: 'Footing facile', court: 'Footing court', longue: 'Sortie longue', fractionne: 'Fractionné', seuil: 'Allure soutenue', cotes: 'Côtes' };

  /* Les jours de course et leur séance, selon le nombre de jours */
  var SEMAINES = {
    2: [[2, 'footing'], [5, 'longue']],
    3: [[1, 'footing'], [3, 'fractionne'], [5, 'longue']],
    4: [[0, 'footing'], [2, 'fractionne'], [4, 'footing'], [6, 'longue']],
    5: [[0, 'footing'], [1, 'fractionne'], [3, 'footing'], [4, 'cotes'], [6, 'longue']],
    6: [[0, 'footing'], [1, 'fractionne'], [2, 'court'], [3, 'seuil'], [5, 'footing'], [6, 'longue']]
  };
  /* Durées en minutes par niveau (débutant, intermédiaire, confirmé) */
  var FOOTING = [25, 40, 50], COURT = [20, 30, 35], LONGUE = [35, 60, 80], FRACT = [35, 50, 60], SEUIL = [30, 45, 55], COTES = [30, 45, 55];
  /* Plus l'objectif est long, plus la sortie longue l'est */
  var COEF_LONGUE = [1, 1, 1.2, 1.5];

  function seance(type, n) {
    var db = n === 0;
    if (type === 'footing') return { e: '🐢', nom: NOMS.footing, min: FOOTING[n], c: 'c4', det: db ? 'Allure où l’on peut parler. Alternez course et marche si besoin.' : 'Allure où l’on peut parler.' };
    if (type === 'court') return { e: '🐢', nom: NOMS.court, min: COURT[n], c: 'c4', det: 'Allure très facile, pour récupérer.' };
    if (type === 'longue') return { e: '🐘', nom: NOMS.longue, min: V.round(LONGUE[n] * COEF_LONGUE[st.objectif], 5), c: 'c5', det: 'Allure facile et régulière.' };
    if (type === 'fractionne') {
      return { e: '⚡', nom: NOMS.fractionne, min: FRACT[n], c: 'c1',
        det: ['6 × 1 min rapide, 1 min 30 de trot', '8 × 2 min rapide, 1 min 30 de trot', '6 × 4 min soutenu, 2 min de trot'][n] + '. Échauffement et retour au calme inclus.' };
    }
    if (type === 'seuil') {
      return db ? seance('footing', 0) : { e: '🔥', nom: NOMS.seuil, min: SEUIL[n], c: 'c3',
        det: ['', '20 min soutenu : on ne parle plus que par mots', '2 × 15 min soutenu, 3 min de trot'][n] + '. Échauffement inclus.' };
    }
    return db ? seance('footing', 0) : { e: '⛰️', nom: NOMS.cotes, min: COTES[n], c: 'c2',
      det: ['', '8 × 30 s en côte, retour en marchant', '10 × 45 s en côte, retour en trottinant'][n] + '. Échauffement inclus.' };
  }

  /* La semaine : 7 cases, chacune vide (null) ou { t : type, min : durée choisie, facultative }. Les anciennes sauvegardes gardent le type seul. */
  function entree(x) {
    if (x === null || x === undefined) return null;
    if (typeof x === 'string') return TYPES.indexOf(x) >= 0 ? { t: x } : undefined;
    return x && TYPES.indexOf(x.t) >= 0 ? (x.min > 0 ? { t: x.t, min: clamp(Math.round(x.min), 5, 300) } : { t: x.t }) : undefined;
  }
  function base() {
    var a = [null, null, null, null, null, null, null];
    SEMAINES[st.jours].forEach(function (x) { a[x[0]] = { t: x[1] }; });
    return a;
  }
  function courante() {
    var c = st.perso[st.jours], a;
    if (!Array.isArray(c) || c.length !== 7) return base();
    a = c.map(entree);
    return a.indexOf(undefined) >= 0 ? base() : a;
  }
  function ecrire(a) { st.perso[st.jours] = a; afficher(); }
  function deplacer(de, vers) {
    var a = courante().slice(), t = a[de];
    a[de] = a[vers];
    a[vers] = t;
    ecrire(a);
  }
  function ajouter(d, type) { var a = courante().slice(); a[d] = { t: type }; ecrire(a); }
  function retirer(d) { var a = courante().slice(); a[d] = null; ecrire(a); }
  function duree(d, delta) {
    var a = courante().slice(), e = a[d], s = seance(e.t, st.niveau);
    a[d] = { t: e.t, min: clamp((e.min || s.min) + delta, 5, 300) };
    ecrire(a);
  }

  function mini(texte, aria, fn) {
    var b = el('button', 'mini', texte);
    b.type = 'button';
    b.setAttribute('aria-label', aria);
    b.addEventListener('click', function (e) { e.stopPropagation(); fn(); });
    return b;
  }

  function afficher() {
    var host = $('week'), plan = courante(), total = 0, d, e, s, t, n = st.niveau, perso = Array.isArray(st.perso[st.jours]);
    host.replaceChildren();
    for (d = 0; d < 7; d++) {
      e = plan[d];
      s = e ? seance(e.t, n) : null;
      if (s && e.min) s.min = e.min;
      t = el('div', 'day ' + (s ? 'tile-b ' + s.c : 'rest'));
      t.setAttribute('data-d', d);
      t.tabIndex = 0;
      t.appendChild(el('span', 'dn', JOURS[d]));
      (function (jour) {
        if (s) {
          total += s.min;
          var grip = el('button', 'grip', '⠿');
          grip.type = 'button';
          grip.setAttribute('aria-label', 'Déplacer ' + s.nom + ' du ' + JOURS[jour].toLowerCase());
          t.appendChild(grip);
          t.appendChild(el('span', 'e', s.e));
          t.appendChild(el('b', 'nom', s.nom));
          t.appendChild(el('span', 't', s.min + ' min'));
          t.appendChild(el('span', 't sm', s.det));
          if (st.edition) {
            var ctrl = el('div', 'ctrl');
            ctrl.appendChild(mini('−5 min', 'Raccourcir de 5 minutes', function () { duree(jour, -5); }));
            ctrl.appendChild(mini('+5 min', 'Allonger de 5 minutes', function () { duree(jour, 5); }));
            ctrl.appendChild(mini('Retirer', 'Retirer la séance du ' + JOURS[jour].toLowerCase(), function () { retirer(jour); }));
            t.appendChild(ctrl);
          }
        } else {
          t.appendChild(el('span', 'e', '😴'));
          t.appendChild(el('b', '', 'Repos'));
          if (st.edition) {
            var sel = el('select', 'add');
            sel.setAttribute('aria-label', 'Ajouter une séance le ' + JOURS[jour].toLowerCase());
            sel.appendChild(el('option', '', '+ Ajouter une séance'));
            sel.firstChild.value = '';
            TYPES.forEach(function (k) { var o = el('option', '', NOMS[k]); o.value = k; sel.appendChild(o); });
            sel.addEventListener('click', function (ev) { ev.stopPropagation(); });
            sel.addEventListener('change', function () { if (sel.value) ajouter(jour, sel.value); });
            t.appendChild(sel);
          }
        }
      })(d);
      host.appendChild(t);
    }
    $('titre').textContent = '🏃 Ma semaine · ' + V.duree(total) + ' de course';
    $('remise').hidden = !perso;
    $('edition').setAttribute('aria-pressed', String(st.edition));
    $('vide').hidden = !st.edition;
    if (glisseur) glisseur.reset();
    suggestions();
    V.store.set('course', { niveau: st.niveau, jours: st.jours, objectif: st.objectif, perso: st.perso });
  }

  /* Suggestions : un réglage complet en un geste */
  var SUGG = [
    { e: '🌱', nom: 'Reprendre en douceur', niveau: 0, jours: 3, objectif: 0 },
    { e: '🏁', nom: 'Mon premier 5 km', niveau: 0, jours: 3, objectif: 1 },
    { e: '🎯', nom: 'Passer au 10 km', niveau: 1, jours: 4, objectif: 2 },
    { e: '🏅', nom: 'Préparer un semi', niveau: 2, jours: 5, objectif: 3 },
    { e: '⏱️', nom: 'Peu de temps, régulier', niveau: 1, jours: 2, objectif: 0 }
  ];
  var NIVEAUX = ['Débutant', 'Intermédiaire', 'Confirmé'], OBJECTIFS = ['rester en forme', '5 km', '10 km', 'semi-marathon'];
  function suggestions() {
    var host = $('sugg');
    host.replaceChildren();
    SUGG.forEach(function (x, i) {
      var b = el('button', 'tile-b w2 c' + (i % 6 + 1)), on = x.niveau === st.niveau && x.jours === st.jours && x.objectif === st.objectif;
      b.type = 'button';
      b.setAttribute('aria-pressed', String(on));
      b.appendChild(el('span', 'e', x.e));
      b.appendChild(el('b', '', x.nom));
      b.appendChild(el('span', 't', NIVEAUX[x.niveau] + ' · ' + x.jours + ' jours · ' + OBJECTIFS[x.objectif]));
      b.addEventListener('click', function () { st.niveau = x.niveau; st.jours = x.jours; st.objectif = x.objectif; synchroniser(); afficher(); });
      host.appendChild(b);
    });
  }
  function synchroniser() {
    ['niveau', 'jours'].forEach(function (k) {
      Array.prototype.forEach.call($(k).querySelectorAll('button'), function (b) { b.setAttribute('aria-pressed', String(Number(b.getAttribute('data-v')) === st[k])); });
    });
    $('objectif').value = String(st.objectif);
  }

  /* Export : une séance répétée chaque semaine */
  $('cal-export').addEventListener('click', function () {
    var plan = courante(), seances = [];
    plan.forEach(function (e, d) {
      var s;
      if (!e) return;
      s = seance(e.t, st.niveau);
      if (e.min) s.min = e.min;
      seances.push({ jour: d, titre: s.e + ' ' + s.nom, desc: s.min + ' min. ' + s.det, min: s.min });
    });
    if (!seances.length) return;
    V.calendrier.telecharger('course-a-pied.ics', V.calendrier.ics(seances, { nom: 'Course à pied', heure: $('cal-heure').value, semaines: parseFloat($('cal-sem').value) }));
  });

  var glisseur = V.glisser($('week'), deplacer);
  function seg(id, key) {
    $(id).addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      st[key] = Number(b.getAttribute('data-v'));
      synchroniser(); afficher();
    });
  }
  seg('niveau', 'niveau');
  seg('jours', 'jours');
  $('objectif').addEventListener('change', function () { st.objectif = Number(this.value); afficher(); });
  $('remise').addEventListener('click', function () { delete st.perso[st.jours]; afficher(); });
  $('edition').addEventListener('click', function () { st.edition = !st.edition; afficher(); });
  $('vide').addEventListener('click', function () { ecrire([null, null, null, null, null, null, null]); });
  synchroniser();
  afficher();
})();
