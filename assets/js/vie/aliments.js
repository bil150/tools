/* Santé/Condition Physique : base d'aliments et aides communes aux pages protéines, repas et sommeil. Expose window.Vie. Aucune dépendance.
   Les valeurs sont des moyennes indicatives pour 100 g d'aliment tel que mangé (cuit pour la viande, le poisson, les légumineuses,
   les féculents et la plupart des légumes), arrondies. Elles varient selon la marque, la cuisson et la pièce : ce sont des repères,
   pas des mesures. */
(function () {
  'use strict';

  var V = window.Vie = {};

  /* ================= Aides ================= */
  V.$ = function (id) { return document.getElementById(id); };
  V.el = function (tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  /* Stockage local : tout est gardé dans le navigateur, jamais envoyé. Une lecture ou une écriture qui échoue est ignorée. */
  V.store = {
    get: function (key, fallback) {
      try { var v = localStorage.getItem('tools:vie:' + key); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
    },
    set: function (key, value) { try { localStorage.setItem('tools:vie:' + key, JSON.stringify(value)); } catch (e) { /* stockage indisponible */ } }
  };
  V.clamp = function (v, lo, hi) { return Math.min(hi, Math.max(lo, v)); };
  V.round = function (v, step) { return Math.round(v / step) * step; };
  /* « 1 h 05 » à partir d'un nombre de minutes */
  V.duree = function (min) { var h = Math.floor(min / 60), m = Math.round(min % 60); return h + ' h ' + (m < 10 ? '0' : '') + m; };

  /* ================= Aliments ================= */
  /* cat : viande, poisson, oeuf-lait, legumineuse, soja, graine, feculent, legume, fruit, gras */
  V.CATS = {
    viande: 'Viandes', poisson: 'Poissons et fruits de mer', 'oeuf-lait': 'Œufs et produits laitiers',
    legumineuse: 'Légumineuses', soja: 'Soja et dérivés', graine: 'Graines, oléagineux et céréales',
    feculent: 'Féculents', legume: 'Légumes', fruit: 'Fruits', gras: 'Matières grasses'
  };
  /* Les tableaux de sources de protéines, dans l'ordre d'affichage */
  V.TABLES = [
    { id: 'viande', nom: 'Viandes (cuites)', cats: ['viande'] },
    { id: 'poisson', nom: 'Poissons et fruits de mer', cats: ['poisson'] },
    { id: 'oeuf-lait', nom: 'Œufs et produits laitiers', cats: ['oeuf-lait'] },
    { id: 'vegetal', nom: 'Solutions végétales', cats: ['legumineuse', 'soja', 'graine'] }
  ];
  V.PROTEIN_CATS = ['viande', 'poisson', 'oeuf-lait', 'legumineuse', 'soja'];

  /* [id, nom, cat, kcal, protéines, glucides, lipides, portion habituelle en g] pour 100 g */
  var RAW = [
    ['poulet', 'Poulet, blanc cuit', 'viande', 165, 31, 0, 3.6, 120],
    ['poulet-cuisse', 'Poulet, cuisse sans peau, cuite', 'viande', 200, 26, 0, 10, 130],
    ['dinde', 'Dinde, blanc cuit', 'viande', 150, 30, 0, 3, 120],
    ['boeuf-hache', 'Bœuf haché 5 % MG, cuit', 'viande', 170, 27, 0, 7, 125],
    ['rumsteck', 'Bœuf, rumsteck grillé', 'viande', 185, 29, 0, 7, 130],
    ['bavette', 'Bœuf, bavette grillée', 'viande', 190, 28, 0, 8, 130],
    ['boeuf-roti', 'Bœuf, rôti cuit', 'viande', 160, 29, 0, 4.5, 120],
    ['veau', 'Veau, escalope cuite', 'viande', 165, 31, 0, 4, 120],
    ['agneau', 'Agneau, gigot maigre cuit', 'viande', 200, 28, 0, 9, 120],
    ['lapin', 'Lapin, cuit', 'viande', 170, 31, 0, 5, 120],

    ['saumon', 'Saumon, cuit', 'poisson', 206, 22, 0, 12, 120],
    ['cabillaud', 'Cabillaud ou colin, cuit', 'poisson', 105, 23, 0, 1, 130],
    ['thon-boite', 'Thon au naturel, égoutté', 'poisson', 115, 26, 0, 1, 110],
    ['sardines', 'Sardines à l’huile, égouttées', 'poisson', 210, 25, 0, 11, 90],
    ['maquereau', 'Maquereau, cuit', 'poisson', 260, 24, 0, 18, 100],
    ['truite', 'Truite, cuite', 'poisson', 165, 23, 0, 7.5, 120],

    ['oeuf', 'Œuf entier, cuit', 'oeuf-lait', 150, 12.5, 1, 10.5, 55],
    ['blanc-oeuf', 'Blanc d’œuf, cuit', 'oeuf-lait', 52, 11, 0.7, 0.2, 70],
    ['skyr', 'Skyr nature', 'oeuf-lait', 63, 11, 4, 0.2, 150],
    ['fromage-blanc', 'Fromage blanc 0 %', 'oeuf-lait', 48, 8, 4, 0.2, 150],
    ['cottage', 'Fromage cottage', 'oeuf-lait', 98, 11, 3.4, 4.3, 125],
    ['lait', 'Lait demi-écrémé', 'oeuf-lait', 46, 3.3, 4.8, 1.6, 250],

    ['lentilles', 'Lentilles, cuites', 'legumineuse', 115, 9, 20, 0.4, 150],
    ['pois-chiches', 'Pois chiches, cuits', 'legumineuse', 165, 9, 27, 2.6, 150],
    ['haricots-rouges', 'Haricots rouges, cuits', 'legumineuse', 125, 8.7, 22, 0.5, 150],
    ['haricots-blancs', 'Haricots blancs, cuits', 'legumineuse', 140, 9.7, 25, 0.5, 150],
    ['pois-casses', 'Pois cassés, cuits', 'legumineuse', 118, 8.3, 21, 0.4, 150],
    ['edamame', 'Edamame, cuits', 'legumineuse', 120, 12, 9, 5, 100],
    ['petits-pois', 'Petits pois, cuits', 'legumineuse', 80, 5.4, 14, 0.4, 100],

    ['tofu', 'Tofu ferme nature', 'soja', 120, 12.5, 2, 7, 125],
    ['tempeh', 'Tempeh', 'soja', 190, 19, 8, 11, 100],
    ['seitan', 'Seitan', 'soja', 140, 22, 5, 2, 100],
    ['pst', 'Protéines de soja texturées, sèches', 'soja', 330, 50, 15, 1, 40],
    ['lait-soja', 'Lait de soja nature', 'soja', 40, 3.3, 1, 1.8, 250],

    ['amandes', 'Amandes', 'graine', 580, 21, 22, 50, 30],
    ['cacahuetes', 'Cacahuètes', 'graine', 567, 26, 16, 49, 30],
    ['beurre-cacahuete', 'Beurre de cacahuète', 'graine', 590, 25, 20, 50, 20],
    ['courge', 'Graines de courge', 'graine', 560, 30, 11, 49, 20],
    ['chanvre', 'Graines de chanvre décortiquées', 'graine', 553, 31, 9, 49, 20],
    ['chia', 'Graines de chia', 'graine', 486, 17, 42, 31, 15],
    ['avoine', 'Flocons d’avoine, secs', 'graine', 370, 13, 60, 7, 50],

    ['riz', 'Riz blanc, cuit', 'feculent', 130, 2.7, 28, 0.3, 180],
    ['riz-complet', 'Riz complet, cuit', 'feculent', 125, 2.7, 26, 1, 180],
    ['pates', 'Pâtes, cuites', 'feculent', 150, 5.5, 30, 1, 180],
    ['pates-completes', 'Pâtes complètes, cuites', 'feculent', 150, 6, 29, 1.5, 180],
    ['pomme-de-terre', 'Pommes de terre vapeur', 'feculent', 80, 2, 17, 0.1, 200],
    ['patate-douce', 'Patate douce, cuite', 'feculent', 90, 2, 21, 0.1, 200],
    ['semoule', 'Semoule, cuite', 'feculent', 130, 4.5, 26, 0.5, 180],
    ['boulgour', 'Boulgour, cuit', 'feculent', 85, 3, 18, 0.2, 180],
    ['quinoa', 'Quinoa, cuit', 'feculent', 120, 4.4, 21, 1.9, 180],
    ['pain-complet', 'Pain complet', 'feculent', 250, 9, 45, 3, 60],

    ['brocoli', 'Brocoli, cuit', 'legume', 35, 2.4, 4, 0.4, 150],
    ['haricots-verts', 'Haricots verts, cuits', 'legume', 30, 1.8, 5, 0.2, 150],
    ['epinards', 'Épinards, cuits', 'legume', 25, 3, 1.5, 0.5, 150],
    ['carottes', 'Carottes, cuites', 'legume', 35, 0.8, 7, 0.2, 150],
    ['courgette', 'Courgette, cuite', 'legume', 20, 1.2, 3, 0.3, 150],
    ['chou-fleur', 'Chou-fleur, cuit', 'legume', 25, 2, 3, 0.3, 150],
    ['champignons', 'Champignons, cuits', 'legume', 30, 3, 2, 0.5, 120],
    ['poivron', 'Poivron, cru', 'legume', 28, 1, 5.5, 0.3, 100],
    ['tomate', 'Tomate, crue', 'legume', 20, 0.9, 3.5, 0.2, 120],
    ['salade', 'Salade verte', 'legume', 15, 1.3, 2, 0.2, 60],
    ['roquette', 'Roquette', 'legume', 25, 2.6, 3.7, 0.7, 40],
    ['mache', 'Mâche', 'legume', 20, 2, 2, 0.4, 40],
    ['concombre', 'Concombre, cru', 'legume', 12, 0.6, 2.2, 0.1, 100],
    ['radis', 'Radis, cru', 'legume', 16, 0.7, 3.4, 0.1, 60],
    ['celeri', 'Céleri-branche, cru', 'legume', 14, 0.7, 3, 0.2, 80],
    ['fenouil', 'Fenouil, cru', 'legume', 31, 1.2, 7, 0.2, 120],
    ['endive', 'Endive, crue', 'legume', 17, 1.3, 3, 0.2, 100],
    ['betterave', 'Betterave, cuite', 'legume', 44, 1.7, 10, 0.2, 100],
    ['navet', 'Navet, cuit', 'legume', 22, 0.7, 5, 0.1, 150],
    ['aubergine', 'Aubergine, cuite', 'legume', 35, 0.8, 7, 0.3, 150],
    ['poireau', 'Poireau, cuit', 'legume', 30, 0.8, 6, 0.3, 150],
    ['butternut', 'Courge butternut, cuite', 'legume', 40, 0.9, 9, 0.1, 150],
    ['potiron', 'Potiron, cuit', 'legume', 25, 0.7, 5, 0.1, 150],
    ['chou', 'Chou blanc ou rouge, cuit', 'legume', 28, 1.3, 5.5, 0.2, 150],
    ['choux-bruxelles', 'Choux de Bruxelles, cuits', 'legume', 36, 2.6, 7, 0.5, 150],
    ['kale', 'Chou kale, cuit', 'legume', 35, 2.9, 4, 1, 100],
    ['pak-choi', 'Pak-choï, cuit', 'legume', 12, 1.6, 2, 0.2, 150],
    ['blettes', 'Blettes, cuites', 'legume', 20, 1.9, 4, 0.1, 150],
    ['asperges', 'Asperges, cuites', 'legume', 22, 2.4, 4, 0.2, 150],
    ['artichaut', 'Artichaut, cuit', 'legume', 53, 2.9, 12, 0.3, 120],
    ['mais', 'Maïs doux, cuit', 'legume', 96, 3.4, 21, 1.5, 100],
    ['oignon', 'Oignon, cuit', 'legume', 44, 1.4, 10, 0.2, 60],

    ['banane', 'Banane', 'fruit', 90, 1.1, 20, 0.3, 120],
    ['pomme', 'Pomme', 'fruit', 52, 0.3, 12, 0.2, 150],
    ['orange', 'Orange', 'fruit', 47, 0.9, 10, 0.1, 150],
    ['fruits-rouges', 'Fruits rouges', 'fruit', 45, 0.8, 8, 0.4, 100],
    ['poire', 'Poire', 'fruit', 57, 0.4, 15, 0.1, 150],
    ['fraise', 'Fraises', 'fruit', 32, 0.7, 7.7, 0.3, 150],
    ['framboise', 'Framboises', 'fruit', 52, 1.2, 12, 0.7, 100],
    ['myrtilles', 'Myrtilles', 'fruit', 57, 0.7, 14, 0.3, 100],
    ['kiwi', 'Kiwi', 'fruit', 61, 1.1, 15, 0.5, 100],
    ['mangue', 'Mangue', 'fruit', 60, 0.8, 15, 0.4, 150],
    ['ananas', 'Ananas', 'fruit', 50, 0.5, 13, 0.1, 150],
    ['peche', 'Pêche', 'fruit', 39, 0.9, 9.5, 0.3, 150],
    ['abricot', 'Abricots', 'fruit', 48, 1.4, 11, 0.4, 100],
    ['clementine', 'Clémentines', 'fruit', 47, 0.8, 12, 0.3, 100],
    ['raisin', 'Raisin', 'fruit', 69, 0.7, 18, 0.2, 100],
    ['cerises', 'Cerises', 'fruit', 63, 1.1, 16, 0.2, 100],
    ['pasteque', 'Pastèque', 'fruit', 30, 0.6, 7.6, 0.2, 200],
    ['melon', 'Melon', 'fruit', 34, 0.8, 8, 0.2, 200],
    ['figue', 'Figues fraîches', 'fruit', 74, 0.8, 19, 0.3, 80],
    ['datte', 'Dattes', 'fruit', 280, 2.5, 75, 0.4, 30],
    ['grenade', 'Grenade', 'fruit', 83, 1.7, 19, 1.2, 100],
    ['prune', 'Prunes', 'fruit', 46, 0.7, 11, 0.3, 100],
    ['pamplemousse', 'Pamplemousse', 'fruit', 42, 0.8, 11, 0.1, 150],
    ['papaye', 'Papaye', 'fruit', 43, 0.5, 11, 0.3, 150],

    ['huile-olive', 'Huile d’olive', 'gras', 900, 0, 0, 100, 10],
    ['beurre', 'Beurre', 'gras', 740, 0.7, 0.6, 82, 10],
    ['avocat', 'Avocat', 'gras', 160, 2, 8.5, 14.7, 70],
    /* Viandes, volailles et abats (cuits) */
    ['dinde-hachee', 'Dinde hachée, cuite', 'viande', 150, 27, 0, 4, 125],
    ['boeuf-hache-15', 'Bœuf haché 15 % MG, cuit', 'viande', 220, 26, 0, 12, 125],
    ['entrecote', 'Bœuf, entrecôte grillée', 'viande', 270, 27, 0, 18, 150],
    ['agneau-cotelette', 'Agneau, côtelettes grillées', 'viande', 290, 25, 0, 21, 120],
    ['agneau-hache', 'Agneau haché, cuit', 'viande', 250, 25, 0, 17, 125],
    ['merguez', 'Merguez, cuite', 'viande', 270, 16, 1, 23, 100],
    ['foie-volaille', 'Foie de volaille, cuit', 'viande', 170, 25, 1, 6.5, 80],
    ['pintade', 'Pintade, cuite', 'viande', 160, 27, 0, 5, 120],
    ['canard', 'Canard, cuit sans peau', 'viande', 200, 26, 0, 10, 120],
    /* Poissons */
    ['merlu', 'Merlu, cuit', 'poisson', 100, 21, 0, 1.5, 130],
    ['lieu', 'Lieu noir, cuit', 'poisson', 100, 22, 0, 1, 130],
    ['bar', 'Bar, cuit', 'poisson', 125, 24, 0, 3, 130],
    ['dorade', 'Dorade, cuite', 'poisson', 135, 22, 0, 5, 130],
    ['thon-frais', 'Thon frais, cuit', 'poisson', 185, 29, 0, 6.5, 130],
    ['saumon-fume', 'Saumon fumé', 'poisson', 180, 22, 0, 10, 50],
    ['haddock', 'Haddock, cuit', 'poisson', 100, 22, 0, 1, 130],
    ['anchois', 'Anchois à l’huile, égouttés', 'poisson', 210, 29, 0, 10, 30],
    ['hareng', 'Hareng, cuit', 'poisson', 200, 23, 0, 12, 100],
    /* Laitiers */
    ['yaourt', 'Yaourt nature', 'oeuf-lait', 55, 4, 6, 1.5, 125],
    ['yaourt-grec', 'Yaourt grec nature', 'oeuf-lait', 100, 6, 4, 6, 125],
    ['lait-entier', 'Lait entier', 'oeuf-lait', 65, 3.2, 4.7, 3.6, 250],
    ['lait-ecreme', 'Lait écrémé', 'oeuf-lait', 35, 3.4, 5, 0.1, 250],
    /* Légumineuses */
    ['feves', 'Fèves, cuites', 'legumineuse', 110, 7.6, 19, 0.4, 100],
    ['lentilles-corail', 'Lentilles corail, cuites', 'legumineuse', 115, 9, 20, 0.4, 150],
    ['flageolets', 'Flageolets, cuits', 'legumineuse', 120, 8, 20, 0.5, 150],
    ['haricots-noirs', 'Haricots noirs, cuits', 'legumineuse', 132, 8.9, 24, 0.5, 150],
    ['houmous', 'Houmous', 'legumineuse', 230, 8, 14, 17, 40],
    ['falafel', 'Falafels', 'legumineuse', 330, 13, 32, 18, 80],
    /* Graines, fruits à coque et boissons végétales */
    ['noix', 'Noix', 'graine', 650, 15, 14, 65, 25],
    ['cajou', 'Noix de cajou', 'graine', 580, 18, 30, 44, 30],
    ['pistaches', 'Pistaches', 'graine', 570, 20, 28, 45, 30],
    ['noisettes', 'Noisettes', 'graine', 630, 15, 17, 61, 30],
    ['tournesol', 'Graines de tournesol', 'graine', 580, 21, 20, 51, 20],
    ['sesame', 'Graines de sésame', 'graine', 570, 18, 23, 50, 10],
    ['lin', 'Graines de lin', 'graine', 530, 18, 29, 42, 15],
    ['tahini', 'Tahini (purée de sésame)', 'graine', 600, 17, 21, 54, 20],
    ['puree-amande', 'Purée d’amande', 'graine', 620, 21, 19, 55, 20],
    ['lait-avoine', 'Lait d’avoine', 'graine', 45, 1, 7, 1.5, 250],
    ['lait-amande', 'Lait d’amande', 'graine', 25, 0.9, 1, 1.5, 250],
    ['lait-riz', 'Lait de riz', 'graine', 50, 0.3, 10, 1, 250],
    /* Pains, céréales et féculents */
    ['baguette', 'Baguette (pain blanc)', 'feculent', 270, 9, 55, 1.5, 60],
    ['pain-mie', 'Pain de mie', 'feculent', 270, 8, 50, 4, 50],
    ['wrap', 'Wrap (tortilla)', 'feculent', 300, 8, 50, 7, 60],
    ['couscous', 'Couscous, cuit', 'feculent', 120, 4, 24, 0.5, 180],
    ['polenta', 'Polenta, cuite', 'feculent', 70, 1.6, 15, 0.3, 200],
    ['millet', 'Millet, cuit', 'feculent', 120, 3.5, 23, 1, 180],
    ['sarrasin', 'Sarrasin, cuit', 'feculent', 92, 3.4, 20, 0.6, 180],
    ['orge', 'Orge perlé, cuit', 'feculent', 123, 2.3, 28, 0.4, 180],
    ['gnocchis', 'Gnocchis, cuits', 'feculent', 150, 4, 32, 0.5, 180],
    ['muesli', 'Muesli', 'feculent', 360, 10, 62, 6, 50],
    ['biscottes', 'Biscottes', 'feculent', 400, 11, 72, 6, 30],
    ['crepe', 'Crêpe nature', 'feculent', 190, 6, 28, 6, 70],
    /* Légumes */
    ['panais', 'Panais, cuit', 'legume', 71, 1.3, 17, 0.3, 100],
    ['topinambour', 'Topinambour, cuit', 'legume', 75, 2, 15, 0.1, 120],
    ['rutabaga', 'Rutabaga, cuit', 'legume', 37, 1.1, 8.6, 0.2, 150],
    ['celeri-rave', 'Céleri-rave, cuit', 'legume', 35, 1.2, 7, 0.3, 150],
    ['radis-noir', 'Radis noir, cru', 'legume', 18, 0.7, 3.6, 0.1, 80],
    ['cresson', 'Cresson, cru', 'legume', 11, 2.3, 1.3, 0.1, 40],
    ['echalote', 'Échalote', 'legume', 72, 2.5, 15, 0.1, 30],
    ['courge-spaghetti', 'Courge spaghetti, cuite', 'legume', 31, 0.6, 7, 0.6, 150],
    /* Fruits */
    ['citron', 'Citron', 'fruit', 29, 1.1, 9, 0.3, 50],
    ['litchi', 'Litchis', 'fruit', 66, 0.8, 17, 0.4, 100],
    ['coco', 'Noix de coco, chair', 'fruit', 354, 3.3, 15, 33, 30],
    ['passion', 'Fruit de la passion', 'fruit', 97, 2.2, 23, 0.7, 50],
    ['goyave', 'Goyave', 'fruit', 68, 2.6, 14, 1, 100],
    ['mures', 'Mûres', 'fruit', 43, 1.4, 10, 0.5, 100],
    ['groseilles', 'Groseilles', 'fruit', 56, 1.4, 14, 0.2, 80],
    ['nectarine', 'Nectarine', 'fruit', 44, 1.1, 11, 0.3, 150],
    ['raisins-secs', 'Raisins secs', 'fruit', 300, 3, 79, 0.5, 30],
    ['abricots-secs', 'Abricots secs', 'fruit', 240, 3.4, 63, 0.5, 30],
    ['pruneaux', 'Pruneaux', 'fruit', 240, 2.2, 64, 0.4, 30],
    ['figues-seches', 'Figues sèches', 'fruit', 250, 3.3, 64, 0.9, 30],
    /* Matières grasses */
    ['huile-colza', 'Huile de colza', 'gras', 900, 0, 0, 100, 10],
    ['huile-coco', 'Huile de coco', 'gras', 890, 0, 0, 99, 10],
    ['creme', 'Crème fraîche épaisse', 'gras', 300, 2.5, 3, 30, 20],
    ['creme-legere', 'Crème fraîche légère', 'gras', 160, 3, 4, 15, 20],
    ['margarine', 'Margarine', 'gras', 720, 0.2, 0.4, 80, 10],
    ['mayonnaise', 'Mayonnaise', 'gras', 700, 1, 2, 77, 15],
    ['olives', 'Olives vertes', 'gras', 145, 1, 4, 15, 30]
  ];

  V.FOODS = RAW.map(function (r) {
    var animal = r[2] === 'viande' || r[2] === 'poisson' || r[2] === 'oeuf-lait' || ['beurre', 'creme', 'creme-legere', 'mayonnaise'].indexOf(r[0]) >= 0;
    return { id: r[0], nom: r[1], cat: r[2], kcal: r[3], p: r[4], g: r[5], l: r[6], portion: r[7],
      animal: animal,                                  // vrai : contient de la viande, du poisson, un œuf ou du lait
      vege: r[2] !== 'viande' && r[2] !== 'poisson',   // végétarien : sans viande ni poisson
      vegan: !animal };
  });
  /* Nom court, pour composer le nom d'un plat */
  var COURT = {
    'agneau-cotelette': 'Côtelettes d’agneau', 'agneau-hache': 'Agneau haché', 'dinde-hachee': 'Dinde hachée', 'boeuf-hache-15': 'Bœuf haché 15 %', entrecote: 'Entrecôte',
    'foie-volaille': 'Foie de volaille', 'thon-frais': 'Thon frais', 'saumon-fume': 'Saumon fumé', 'lait-entier': 'Lait entier', 'lait-ecreme': 'Lait écrémé',
    'yaourt-grec': 'Yaourt grec', 'lentilles-corail': 'Lentilles corail', 'haricots-noirs': 'Haricots noirs', feves: 'Fèves', 'lait-avoine': 'Lait d’avoine',
    'lait-amande': 'Lait d’amande', 'lait-riz': 'Lait de riz', 'puree-amande': 'Purée d’amande', baguette: 'Baguette', 'pain-mie': 'Pain de mie', 'celeri-rave': 'Céleri-rave',
    'radis-noir': 'Radis noir', 'courge-spaghetti': 'Courge spaghetti', passion: 'Fruit de la passion', 'raisins-secs': 'Raisins secs', 'abricots-secs': 'Abricots secs',
    'figues-seches': 'Figues sèches', 'huile-colza': 'Huile de colza', 'huile-coco': 'Huile de coco', 'creme-legere': 'Crème légère', creme: 'Crème fraîche', tahini: 'Tahini', 'noix-cajou': 'Noix de cajou',
    'boeuf-hache': 'Bœuf haché', rumsteck: 'Steak de bœuf', bavette: 'Bavette de bœuf', 'boeuf-roti': 'Rôti de bœuf', poulet: 'Blanc de poulet', 'poulet-cuisse': 'Cuisse de poulet', veau: 'Veau', agneau: 'Gigot d’agneau', 'thon-boite': 'Thon',
    oeuf: 'Œuf', 'blanc-oeuf': 'Blanc d’œuf', 'fromage-blanc': 'Fromage blanc', cottage: 'Fromage cottage', 'pois-chiches': 'Pois chiches',
    'haricots-rouges': 'Haricots rouges', 'haricots-blancs': 'Haricots blancs', 'pois-casses': 'Pois cassés', riz: 'Riz', 'riz-complet': 'Riz complet',
    pates: 'Pâtes', 'pates-completes': 'Pâtes complètes', 'pomme-de-terre': 'Pommes de terre', 'patate-douce': 'Patate douce', epinards: 'Épinards',
    'choux-bruxelles': 'Choux de Bruxelles', 'pak-choi': 'Pak-choï', mache: 'Mâche', mais: 'Maïs doux', butternut: 'Courge butternut', 'haricots-verts': 'Haricots verts', 'chou-fleur': 'Chou-fleur', 'huile-olive': 'Huile d’olive', tofu: 'Tofu', 'fruits-rouges': 'Fruits rouges'
  };
  /* Façons de le préparer ou de le couper : chaque liste est accordée avec l'aliment (« rôties » pour les pommes de terre) */
  var POTATO = ['en dés rôties au four', 'en rondelles sautées', 'en purée', 'vapeur', 'en frites au four', 'en rondelles rôties', 'écrasées à l’huile d’olive'];
  var RIZ = ['nature', 'en pilaf', 'sauté aux légumes', 'froid en salade'];
  var PATES = ['al dente', 'sautées aux légumes', 'froides en salade', 'gratinées au four'];
  var GRAIN = ['nature', 'en taboulé', 'en pilaf'];
  var PREPS = {
    'dinde-hachee': ['en boulettes', 'en steak haché', 'en sauce tomate'], 'boeuf-hache-15': ['en steak', 'en boulettes', 'en sauce tomate'], entrecote: ['grillée', 'poêlée'],
    'agneau-cotelette': ['grillées', 'poêlées', 'au four'], 'agneau-hache': ['en boulettes', 'en kefta', 'en sauce tomate'], merguez: ['grillées', 'poêlées', 'au four'],
    'foie-volaille': ['poêlé', 'sauté à l’oignon'], pintade: ['rôtie au four', 'mijotée'], canard: ['rôti au four', 'poêlé'],
    merlu: ['vapeur', 'en papillote', 'au four', 'poêlé'], lieu: ['vapeur', 'en papillote', 'au four', 'poêlé'], bar: ['au four', 'grillé', 'en papillote'], dorade: ['au four', 'grillée', 'en papillote'],
    'thon-frais': ['grillé', 'poêlé mi-cuit'], 'saumon-fume': ['en tranches'], haddock: ['poché', 'au four'], anchois: ['en salade', 'en tartinade'], hareng: ['grillé', 'au four'],
    yaourt: ['nature', 'aux herbes'], 'yaourt-grec': ['nature', 'en sauce aux herbes'],
    feves: ['en purée', 'en salade', 'mijotées'], 'lentilles-corail': ['en dahl', 'en soupe', 'en curry'], flageolets: ['mijotés', 'en salade'],
    'haricots-noirs': ['en chili', 'en salade', 'mijotés'], houmous: ['nature', 'en tartinade'], falafel: ['au four', 'en wrap', 'en salade'], tahini: ['nature', 'en sauce'],
    wrap: ['garni', 'grillé'], couscous: ['nature', 'aux légumes', 'en taboulé'], polenta: ['crémeuse', 'grillée'], millet: ['nature', 'en salade', 'en pilaf'], sarrasin: ['nature', 'en salade'],
    orge: ['nature', 'en salade'], gnocchis: ['poêlés', 'à la sauce tomate'],
    panais: ['rôti au four', 'en purée'], topinambour: ['rôti au four', 'en purée', 'vapeur'], rutabaga: ['rôti au four', 'en purée'], 'celeri-rave': ['en purée', 'rôti au four', 'râpé cru'],
    'radis-noir': ['cru en rondelles', 'râpé'], cresson: ['en salade'], echalote: ['émincée poêlée', 'rôtie au four'], 'courge-spaghetti': ['rôtie au four', 'sautée'],
    'pomme-de-terre': POTATO,
    'patate-douce': ['rôtie en dés au four', 'sautée en rondelles', 'en purée', 'vapeur', 'en frites au four', 'écrasée'],
    riz: RIZ, 'riz-complet': RIZ, pates: PATES, 'pates-completes': PATES, semoule: GRAIN, boulgour: GRAIN, quinoa: ['nature', 'en salade', 'en pilaf'],
    brocoli: ['vapeur', 'rôti au four', 'sauté à l’ail'], 'haricots-verts': ['vapeur', 'sautés à l’ail', 'en salade'],
    epinards: ['sautés à l’ail', 'vapeur', 'en gratin au four'], carottes: ['rôties au four', 'râpées', 'en rondelles vapeur', 'en purée'],
    courgette: ['en rondelles sautées', 'rôtie au four', 'en spaghettis'], 'chou-fleur': ['rôti au four', 'en purée', 'en semoule', 'vapeur'],
    champignons: ['sautés', 'rôtis au four'], poivron: ['rôti au four', 'cru en lanières', 'sauté'], tomate: ['crue en rondelles', 'rôtie au four', 'en sauce'],
    salade: ['assaisonnée'], roquette: ['en salade'], mache: ['en salade'],
    concombre: ['cru en rondelles', 'en dés en salade'], radis: ['cru en rondelles'], celeri: ['cru en bâtonnets', 'en salade'],
    fenouil: ['rôti au four', 'cru en lamelles', 'braisé'], endive: ['crue en salade', 'braisée', 'rôtie au four'],
    betterave: ['en salade', 'rôtie au four', 'râpée'], navet: ['rôti au four', 'en purée', 'glacé à la poêle'],
    aubergine: ['rôtie au four', 'en rondelles grillée', 'en dés sautée', 'en purée fumée'], poireau: ['vapeur', 'fondu à la poêle', 'en vinaigrette'],
    butternut: ['rôtie au four', 'en purée', 'en dés sautée', 'en soupe'], potiron: ['rôti au four', 'en purée', 'en soupe'],
    chou: ['sauté', 'braisé', 'en salade'], 'choux-bruxelles': ['rôtis au four', 'sautés à la poêle', 'vapeur'], kale: ['sauté', 'rôti croustillant', 'en salade'],
    'pak-choi': ['sauté', 'vapeur'], blettes: ['sautées', 'vapeur'], asperges: ['vapeur', 'rôties au four', 'poêlées'],
    artichaut: ['vapeur', 'en cœurs poêlés'], mais: ['en grains vapeur', 'en salade', 'grillé'], oignon: ['rôti au four', 'caramélisé', 'émincé poêlé'],
    poulet: ['grillé', 'rôti au four', 'sauté en dés', 'en brochettes', 'émincé à la poêle'], dinde: ['émincée à la poêle', 'grillée', 'rôtie au four'],
    'boeuf-hache': ['en steak', 'en boulettes', 'en sauce tomate'], rumsteck: ['grillé', 'en lamelles sautées'],
    bavette: ['grillée', 'sautée en lamelles', 'marinée au four'], 'boeuf-roti': ['au four', 'en tranches fines'], 'poulet-cuisse': ['rôtie au four', 'grillée', 'mijotée', 'en brochettes'],
    veau: ['poêlé', 'en lamelles sautées'], agneau: ['rôti au four', 'en brochettes'], lapin: ['rôti au four', 'mijoté à la moutarde'],
    saumon: ['au four', 'poêlé', 'en papillote', 'vapeur'], cabillaud: ['vapeur', 'en papillote', 'au four'], 'thon-boite': ['en salade', 'émietté'],
    sardines: ['en salade', 'écrasées en tartinade'], maquereau: ['grillé', 'au four'], truite: ['au four', 'poêlée', 'en papillote'],
    oeuf: ['dur', 'poché', 'au plat', 'en omelette', 'brouillé'], 'blanc-oeuf': ['en omelette', 'brouillé'],
    skyr: ['nature', 'aux herbes'], 'fromage-blanc': ['nature', 'aux herbes'], cottage: ['nature', 'aux herbes'],
    lentilles: ['mijotées', 'en salade', 'en dahl', 'en curry'], 'pois-chiches': ['rôtis au four', 'en salade', 'en curry', 'en houmous'],
    'haricots-rouges': ['en chili', 'en salade', 'mijotés'], 'haricots-blancs': ['à la tomate', 'en salade', 'en soupe'], 'pois-casses': ['en soupe', 'en purée'],
    edamame: ['vapeur salés', 'en salade'], tofu: ['sauté en dés', 'grillé mariné', 'brouillé', 'rôti au four'],
    tempeh: ['grillé', 'émietté poêlé', 'mariné au four'], seitan: ['en lamelles sautées', 'grillé', 'en brochettes'],
    avocat: ['en tranches', 'écrasé']
  };
  /* Base halal : pas de porc ni de produit qui en dérive, pas d'alcool, pas de fruits de mer discutés (crevettes, moules), pas de fromage à présure
     animale (emmental, parmesan) ni de poudre de lactosérum. La viande est à choisir halal. */
  /* Un emoji par aliment (à défaut, un par catégorie) */
  var EMO = {
    'dinde-hachee': '🦃', entrecote: '🥩', 'boeuf-hache-15': '🥩', 'agneau-cotelette': '🥩', 'agneau-hache': '🥩', merguez: '🥩', 'foie-volaille': '🥩', pintade: '🍗', canard: '🦆',
    merlu: '🐟', lieu: '🐟', bar: '🐟', dorade: '🐟', 'thon-frais': '🐟', 'saumon-fume': '🐟', haddock: '🐟', anchois: '🐟', hareng: '🐟',
    yaourt: '🥛', 'yaourt-grec': '🥛', 'lait-entier': '🥛', 'lait-ecreme': '🥛', feves: '🫘', 'lentilles-corail': '🫘', flageolets: '🫘', 'haricots-noirs': '🫘', houmous: '🥣', falafel: '🧆',
    noix: '🌰', cajou: '🥜', pistaches: '🥜', noisettes: '🌰', tournesol: '🌻', sesame: '🌱', lin: '🌱', tahini: '🥣', 'puree-amande': '🥜', 'lait-avoine': '🥛', 'lait-amande': '🥛', 'lait-riz': '🥛',
    baguette: '🥖', 'pain-mie': '🍞', wrap: '🌯', couscous: '🥘', polenta: '🌽', millet: '🌾', sarrasin: '🌾', orge: '🌾', gnocchis: '🍝', muesli: '🥣', biscottes: '🍞', crepe: '🥞',
    panais: '🥕', topinambour: '🥔', rutabaga: '🥔', 'celeri-rave': '🥬', 'radis-noir': '⚫', cresson: '🥬', echalote: '🧅', 'courge-spaghetti': '🎃',
    citron: '🍋', litchi: '🔴', coco: '🥥', passion: '🟡', goyave: '🍈', mures: '🫐', groseilles: '🔴', nectarine: '🍑', 'raisins-secs': '🍇', 'abricots-secs': '🍑', pruneaux: '🟣', 'figues-seches': '🟤',
    'huile-colza': '🟡', 'huile-coco': '🥥', creme: '🥛', 'creme-legere': '🥛', margarine: '🧈', mayonnaise: '🥫', olives: '🫒',
    poulet: '🍗', 'poulet-cuisse': '🍗', bavette: '🥩', 'boeuf-roti': '🥩', dinde: '🦃', 'boeuf-hache': '🥩', rumsteck: '🥩', veau: '🥩', agneau: '🥩', lapin: '🐇',
    saumon: '🐟', cabillaud: '🐟', 'thon-boite': '🐟', sardines: '🐟', maquereau: '🐟', truite: '🐟',
    oeuf: '🥚', 'blanc-oeuf': '🥚', skyr: '🥛', 'fromage-blanc': '🥛', cottage: '🥛', lait: '🥛',
    lentilles: '🫘', 'pois-chiches': '🫘', 'haricots-rouges': '🫘', 'haricots-blancs': '🫘', 'pois-casses': '🟢', edamame: '🌱', 'petits-pois': '🟢',
    tofu: '⬜', tempeh: '🟫', seitan: '🌾', pst: '🌱', 'lait-soja': '🥛',
    amandes: '🥜', cacahuetes: '🥜', 'beurre-cacahuete': '🥜', courge: '🌱', chanvre: '🌿', chia: '⚫', avoine: '🌾',
    riz: '🍚', 'riz-complet': '🍚', pates: '🍝', 'pates-completes': '🍝', 'pomme-de-terre': '🥔', 'patate-douce': '🍠', semoule: '🌾', boulgour: '🌾', quinoa: '🌾', 'pain-complet': '🍞',
    brocoli: '🥦', 'haricots-verts': '🟢', epinards: '🥬', carottes: '🥕', courgette: '🥒', 'chou-fleur': '⚪', champignons: '🍄', poivron: '🫑', tomate: '🍅', salade: '🥬',
    roquette: '🥬', mache: '🥬', concombre: '🥒', radis: '🔴', celeri: '🥬', fenouil: '🌿', endive: '🥬', betterave: '🟣', navet: '⚪', aubergine: '🍆', poireau: '🥬',
    butternut: '🎃', potiron: '🎃', chou: '🥬', 'choux-bruxelles': '🥬', kale: '🥬', 'pak-choi': '🥬', blettes: '🥬', asperges: '🌿', artichaut: '🌿', mais: '🌽', oignon: '🧅',
    banane: '🍌', pomme: '🍎', orange: '🍊', 'fruits-rouges': '🍓', poire: '🍐', fraise: '🍓', framboise: '🍓', myrtilles: '🫐', kiwi: '🥝', mangue: '🥭', ananas: '🍍', peche: '🍑', abricot: '🍑',
    clementine: '🍊', raisin: '🍇', cerises: '🍒', pasteque: '🍉', melon: '🍈', figue: '🟣', datte: '🌴', grenade: '🔴', prune: '🟣', pamplemousse: '🍊', papaye: '🟠', 'huile-olive': '🫒', beurre: '🧈', avocat: '🥑'
  };
  var EMO_CAT = { viande: '🥩', poisson: '🐟', 'oeuf-lait': '🥛', legumineuse: '🫘', soja: '🌱', graine: '🥜', feculent: '🌾', legume: '🥬', fruit: '🍎', gras: '🫒' };
  V.FOODS.forEach(function (f) {
    f.emo = EMO[f.id] || EMO_CAT[f.cat] || '';
    f.court = COURT[f.id] || f.nom.split(',')[0];
    f.preps = PREPS[f.id] || ['nature'];
  });
  /* Plusieurs formes d'un même aliment : on choisit l'aliment, puis sa forme (bœuf : haché, steak, bavette, rôti) */
  V.FAMILLES = {
    boeuf: { nom: 'Bœuf', emo: '🥩', membres: [['boeuf-hache', 'Haché'], ['boeuf-hache-15', 'Haché 15 %'], ['rumsteck', 'Steak'], ['entrecote', 'Entrecôte'], ['bavette', 'Bavette'], ['boeuf-roti', 'Rôti']] },
    agneau: { nom: 'Agneau', emo: '🥩', membres: [['agneau', 'Gigot'], ['agneau-cotelette', 'Côtelettes'], ['agneau-hache', 'Haché']] },
    poulet: { nom: 'Poulet', emo: '🍗', membres: [['poulet', 'Blanc'], ['poulet-cuisse', 'Cuisse']] },
    dinde: { nom: 'Dinde', emo: '🦃', membres: [['dinde', 'Escalope'], ['dinde-hachee', 'Hachée']] },
    saumon: { nom: 'Saumon', emo: '🐟', membres: [['saumon', 'Cuit'], ['saumon-fume', 'Fumé']] },
    thon: { nom: 'Thon', emo: '🐟', membres: [['thon-boite', 'En boîte'], ['thon-frais', 'Frais']] },
    'poisson-blanc': { nom: 'Poisson blanc', emo: '🐟', membres: [['cabillaud', 'Cabillaud'], ['merlu', 'Merlu'], ['lieu', 'Lieu'], ['bar', 'Bar'], ['dorade', 'Dorade']] },
    yaourt: { nom: 'Yaourt', emo: '🥛', membres: [['yaourt', 'Nature'], ['yaourt-grec', 'Grec']] },
    lentilles: { nom: 'Lentilles', emo: '🫘', membres: [['lentilles', 'Vertes'], ['lentilles-corail', 'Corail']] },
    haricots: { nom: 'Haricots', emo: '🫘', membres: [['haricots-rouges', 'Rouges'], ['haricots-blancs', 'Blancs'], ['haricots-noirs', 'Noirs']] },
    riz: { nom: 'Riz', emo: '🍚', membres: [['riz', 'Blanc'], ['riz-complet', 'Complet']] },
    pates: { nom: 'Pâtes', emo: '🍝', membres: [['pates', 'Blanches'], ['pates-completes', 'Complètes']] }
  };
  Object.keys(V.FAMILLES).forEach(function (k) {
    V.FAMILLES[k].membres.forEach(function (m) {
      var f = V.FOODS.filter(function (x) { return x.id === m[0]; })[0];
      if (f) { f.famille = k; f.coupe = m[1]; }
    });
  });
  /* L'unité qu'on choisit : la famille si l'aliment en a une, sinon lui-même */
  V.unite = function (f) { return f.famille || f.id; };
  V.byId = {};
  V.FOODS.forEach(function (f) { V.byId[f.id] = f; });

  /* Régimes : tout, végétarien (ni viande ni poisson), végétalien (aucun produit animal) */
  V.allowed = function (food, regime) {
    return regime === 'vegan' ? food.vegan : regime === 'vege' ? food.vege : true;
  };
  /* Apports de `g` grammes de l'aliment `food` */
  V.macros = function (food, g) {
    var k = g / 100;
    return { kcal: food.kcal * k, p: food.p * k, g: food.g * k, l: food.l * k };
  };
})();
