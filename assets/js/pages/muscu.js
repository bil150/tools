/* Programme musculation : un exemple de semaine découpé selon le nombre de jours (corps entier, haut/bas, push/pull/jambes), ou une
   semaine composée soi-même (séances, exercices, séries et répétitions, jours). Dépend de vie/aliments.js et vie/glisser.js. */
(function () {
  'use strict';

  var V = window.Vie, $ = V.$, el = V.el;
  var saved = V.store.get('muscu', null) || {};
  var st = {
    jours: saved.jours >= 2 && saved.jours <= 6 ? saved.jours : 4,
    perso: saved.perso && typeof saved.perso === 'object' ? saved.perso : {},   // semaines réarrangées ou composées, par nombre de jours
    edition: false                                                             // mode « composer moi-même »
  };
  var JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

  var EX = {
    squat: 'Squat', couche: 'Développé couché', incline: 'Développé incliné haltères', militaire: 'Développé militaire', lateral: 'Élévations latérales',
    triceps: 'Extensions triceps poulie', tractions: 'Tractions', rowing: 'Rowing barre', tirage: 'Tirage horizontal', tirageV: 'Tirage vertical',
    facepull: 'Face pull', curl: 'Curl biceps', marteau: 'Curl marteau', sdt: 'Soulevé de terre roumain', presse: 'Presse à cuisses', fentes: 'Fentes',
    legcurl: 'Leg curl', mollets: 'Mollets debout', gainage: 'Gainage', pompes: 'Pompes', dips: 'Dips', abdos: 'Crunchs', hipthrust: 'Hip thrust',
    oiseau: 'Oiseau haltères', extjambes: 'Leg extension'
  };
  /* Séances : [exercice, séries × répétitions] */
  var SEANCES = {
    fullA: { e: '🏋️', nom: 'Corps entier A', c: 'c3', ex: [['squat', '3 × 8'], ['couche', '3 × 8'], ['rowing', '3 × 10'], ['militaire', '2 × 10'], ['gainage', '3 × 40 s']] },
    fullB: { e: '🏋️', nom: 'Corps entier B', c: 'c3', ex: [['sdt', '3 × 8'], ['incline', '3 × 10'], ['tirageV', '3 × 10'], ['fentes', '2 × 10 par jambe'], ['curl', '2 × 12'], ['triceps', '2 × 12']] },
    fullC: { e: '🏋️', nom: 'Corps entier C', c: 'c3', ex: [['presse', '3 × 10'], ['tirage', '3 × 10'], ['incline', '3 × 10'], ['lateral', '2 × 15'], ['mollets', '3 × 15']] },
    haut: { e: '💪', nom: 'Haut du corps', c: 'c5', ex: [['couche', '3 × 6-8'], ['rowing', '3 × 8'], ['militaire', '3 × 8-10'], ['tirageV', '3 × 10'], ['curl', '2 × 12'], ['triceps', '2 × 12']] },
    bas: { e: '🦵', nom: 'Bas du corps', c: 'c4', ex: [['squat', '4 × 6-8'], ['sdt', '3 × 8'], ['fentes', '3 × 10'], ['legcurl', '3 × 12'], ['mollets', '4 × 12'], ['gainage', '3 × 45 s']] },
    push: { e: '🤜', nom: 'Push : pectoraux, épaules, triceps', c: 'c1', ex: [['couche', '4 × 6-8'], ['incline', '3 × 8-10'], ['militaire', '3 × 8-10'], ['lateral', '3 × 12-15'], ['triceps', '3 × 10-12']] },
    pull: { e: '🧗', nom: 'Pull : dos, biceps', c: 'c6', ex: [['tractions', '4 × 6-8'], ['rowing', '4 × 8'], ['tirage', '3 × 10-12'], ['facepull', '3 × 15'], ['curl', '3 × 10-12'], ['marteau', '2 × 12']] },
    legs: { e: '🦵', nom: 'Jambes', c: 'c2', ex: [['squat', '4 × 6-8'], ['sdt', '3 × 8-10'], ['presse', '3 × 10-12'], ['fentes', '3 × 10'], ['legcurl', '3 × 12'], ['mollets', '4 × 12-15']] },
    libre: { e: '📝', nom: 'Séance libre', c: 'c2', ex: [] }
  };
  /* Le découpage selon le nombre de jours : [jour de la semaine, séance] */
  var SPLITS = {
    2: { nom: 'Corps entier', j: [[0, 'fullA'], [3, 'fullB']] },
    3: { nom: 'Corps entier', j: [[0, 'fullA'], [2, 'fullB'], [4, 'fullC']] },
    4: { nom: 'Haut / Bas', j: [[0, 'haut'], [1, 'bas'], [3, 'haut'], [4, 'bas']] },
    5: { nom: 'Push / Pull / Jambes + Haut / Bas', j: [[0, 'push'], [1, 'pull'], [2, 'legs'], [4, 'haut'], [5, 'bas']] },
    6: { nom: 'Push / Pull / Jambes, deux fois', j: [[0, 'push'], [1, 'pull'], [2, 'legs'], [3, 'push'], [4, 'pull'], [5, 'legs']] }
  };

  /* La semaine : 7 cases, chacune vide (null) ou { k : séance, ex : exercices choisis, facultatif }. Les anciennes sauvegardes gardent la clé seule. */
  function entree(x) {
    var ex;
    if (x === null || x === undefined) return null;
    if (typeof x === 'string') return SEANCES[x] ? { k: x } : undefined;
    if (!x || !SEANCES[x.k]) return undefined;
    if (!Array.isArray(x.ex)) return { k: x.k };
    ex = x.ex.filter(function (e) { return Array.isArray(e) && EX[e[0]] && typeof e[1] === 'string'; }).map(function (e) { return [e[0], e[1].slice(0, 24)]; });
    return { k: x.k, ex: ex };
  }
  function base() {
    var a = [null, null, null, null, null, null, null];
    SPLITS[st.jours].j.forEach(function (x) { a[x[0]] = { k: x[1] }; });
    return a;
  }
  function courante() {
    var c = st.perso[st.jours], a;
    if (!Array.isArray(c) || c.length !== 7) return base();
    a = c.map(entree);
    return a.indexOf(undefined) >= 0 ? base() : a;
  }
  function exercices(e) { return e.ex ? e.ex : SEANCES[e.k].ex; }
  function ecrire(a) { st.perso[st.jours] = a; afficher(); }
  function deplacer(de, vers) {
    var a = courante().slice(), t = a[de];
    a[de] = a[vers];
    a[vers] = t;
    ecrire(a);
  }
  function ajouter(d, k) { var a = courante().slice(); a[d] = { k: k }; ecrire(a); }
  function retirer(d) { var a = courante().slice(); a[d] = null; ecrire(a); }
  /* Modifier les exercices d'une séance : on en fait une copie propre à ce jour */
  function modifier(d, fn) {
    var a = courante().slice(), e = a[d], ex = exercices(e).map(function (x) { return [x[0], x[1]]; });
    fn(ex);
    a[d] = { k: e.k, ex: ex };
    ecrire(a);
  }

  function mini(texte, aria, fn) {
    var b = el('button', 'mini', texte);
    b.type = 'button';
    b.setAttribute('aria-label', aria);
    b.addEventListener('click', function (e) { e.stopPropagation(); fn(); });
    return b;
  }
  function choix(libelle, aria, options, fn) {
    var s = el('select', 'add');
    s.setAttribute('aria-label', aria);
    s.appendChild(el('option', '', libelle));
    s.firstChild.value = '';
    options.forEach(function (o) { var x = el('option', '', o[1]); x.value = o[0]; s.appendChild(x); });
    s.addEventListener('click', function (e) { e.stopPropagation(); });
    s.addEventListener('change', function () { if (s.value) fn(s.value); });
    return s;
  }

  function afficher() {
    var host = $('week'), plan = courante(), sp = SPLITS[st.jours], d, e, s, t, ul, perso = Array.isArray(st.perso[st.jours]);
    host.replaceChildren();
    for (d = 0; d < 7; d++) {
      e = plan[d];
      s = e ? SEANCES[e.k] : null;
      t = el('div', 'day ' + (s ? 'tile-b ' + s.c : 'rest'));
      t.setAttribute('data-d', d);
      t.tabIndex = 0;
      t.appendChild(el('span', 'dn', JOURS[d]));
      (function (jour) {
        if (s) {
          var grip = el('button', 'grip', '⠿');
          grip.type = 'button';
          grip.setAttribute('aria-label', 'Déplacer ' + s.nom + ' du ' + JOURS[jour].toLowerCase());
          t.appendChild(grip);
          t.appendChild(el('span', 'e', s.e));
          t.appendChild(el('b', 'nom', s.nom));
          ul = el('ul', 'ex');
          exercices(e).forEach(function (x, i) {
            var li = el('li');
            li.appendChild(el('span', '', EX[x[0]]));
            if (st.edition) {
              var champ = el('input', 'reps');
              champ.type = 'text'; champ.value = x[1]; champ.maxLength = 24;
              champ.setAttribute('aria-label', 'Séries et répétitions : ' + EX[x[0]]);
              champ.addEventListener('click', function (ev) { ev.stopPropagation(); });
              champ.addEventListener('change', function () { modifier(jour, function (ex) { ex[i][1] = champ.value.trim() || '3 × 10'; }); });
              li.appendChild(champ);
              li.appendChild(mini('×', 'Retirer ' + EX[x[0]], function () { modifier(jour, function (ex) { ex.splice(i, 1); }); }));
            } else li.appendChild(el('em', '', x[1]));
            ul.appendChild(li);
          });
          t.appendChild(ul);
          if (st.edition) {
            var ctrl = el('div', 'ctrl');
            ctrl.appendChild(choix('+ Exercice', 'Ajouter un exercice', Object.keys(EX).map(function (k) { return [k, EX[k]]; }), function (k) { modifier(jour, function (ex) { ex.push([k, '3 × 10']); }); }));
            ctrl.appendChild(mini('Retirer la séance', 'Retirer la séance du ' + JOURS[jour].toLowerCase(), function () { retirer(jour); }));
            t.appendChild(ctrl);
          }
        } else {
          t.appendChild(el('span', 'e', '😴'));
          t.appendChild(el('b', '', 'Repos'));
          if (st.edition) t.appendChild(choix('+ Ajouter une séance', 'Ajouter une séance le ' + JOURS[jour].toLowerCase(), Object.keys(SEANCES).map(function (k) { return [k, SEANCES[k].nom]; }), function (k) { ajouter(jour, k); }));
        }
      })(d);
      host.appendChild(t);
    }
    $('titre').textContent = '🏋️ Ma semaine · ' + (perso ? 'à ma façon' : sp.nom);
    $('remise').hidden = !perso;
    $('edition').setAttribute('aria-pressed', String(st.edition));
    $('vide').hidden = !st.edition;
    if (glisseur) glisseur.reset();
    suggestions();
    V.store.set('muscu', { jours: st.jours, perso: st.perso });
  }

  /* Suggestions : un réglage en un geste, selon le temps dont on dispose */
  var SUGG = [
    { e: '🌱', nom: 'Débuter', jours: 3, txt: 'Corps entier, 3 jours' },
    { e: '💪', nom: 'Prendre du muscle', jours: 4, txt: 'Haut / Bas, 4 jours' },
    { e: '🚀', nom: 'Progresser vite', jours: 5, txt: 'Push / Pull / Jambes + Haut / Bas' },
    { e: '🔥', nom: 'Volume maximum', jours: 6, txt: 'Push / Pull / Jambes, deux fois' }
  ];
  function suggestions() {
    var host = $('sugg');
    host.replaceChildren();
    SUGG.forEach(function (x, i) {
      var b = el('button', 'tile-b w2 c' + (i % 6 + 1));
      b.type = 'button';
      b.setAttribute('aria-pressed', String(x.jours === st.jours));
      b.appendChild(el('span', 'e', x.e));
      b.appendChild(el('b', '', x.nom));
      b.appendChild(el('span', 't', x.txt));
      b.addEventListener('click', function () { st.jours = x.jours; synchroniser(); afficher(); });
      host.appendChild(b);
    });
  }

  /* Export : une séance répétée chaque semaine, avec ses exercices en description */
  $('cal-export').addEventListener('click', function () {
    var plan = courante(), seances = [], duree = V.clamp(parseFloat($('cal-duree').value) || 60, 20, 180);
    plan.forEach(function (e, d) {
      var s;
      if (!e) return;
      s = SEANCES[e.k];
      seances.push({ jour: d, titre: s.e + ' ' + s.nom, desc: exercices(e).map(function (x) { return EX[x[0]] + ' : ' + x[1]; }).join('\n'), min: duree });
    });
    if (!seances.length) return;
    V.calendrier.telecharger('musculation.ics', V.calendrier.ics(seances, { nom: 'Musculation', heure: $('cal-heure').value, semaines: parseFloat($('cal-sem').value) }));
  });

  var glisseur = V.glisser($('week'), deplacer);
  var box = $('jours');
  function synchroniser() {
    Array.prototype.forEach.call(box.querySelectorAll('button'), function (b) { b.setAttribute('aria-pressed', String(Number(b.getAttribute('data-v')) === st.jours)); });
  }
  box.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    st.jours = Number(b.getAttribute('data-v'));
    synchroniser(); afficher();
  });
  $('remise').addEventListener('click', function () { delete st.perso[st.jours]; afficher(); });
  $('edition').addEventListener('click', function () { st.edition = !st.edition; afficher(); });
  $('vide').addEventListener('click', function () { ecrire([null, null, null, null, null, null, null]); });
  synchroniser();
  afficher();
})();
