/* Poses du pantin. Une pose ne donne que les articulations qui s'écartent de la pose neutre (debout, bras le long du corps).
   Angles en degrés, dans le vocabulaire du mouvement (le script les traduit en rotations) :
   - tronc, bassin, cou, tête, corps entier : [fléchir vers l'avant, pencher vers sa gauche, tourner vers sa gauche]
   - épaule, hanche : [lever vers l'avant, écarter du corps, tourner vers l'extérieur]
   - coude, genou : [plier]
   - poignet : [plier, tourner la paume : + vers l'avant (supination), − vers l'arrière (pronation)]
   - cheville : [pointe du pied vers le haut]
   Côtés : G = gauche du pantin, D = droite du pantin. sol : 'pieds' (posé au sol, par défaut), ou une hauteur en têtes.
   accessoire : 'tabouret' ou 'chaise' (sous le bassin), 'borne' (écran que touche la main droite).
   tient : objet dans une main, { D: 'telephone' } ou { G: 'tablette' }. vue : angle de caméra conseillé [tour, hauteur] en degrés. */
export const POSES = [
  // ---------- Debout ----------
  { id: 'repos', nom: 'Debout, au repos', famille: 'Debout',
    j: { epauleG: [0, 8, 0], epauleD: [0, 8, 0], coudeG: [10], coudeD: [10] } },
  { id: 'contrapposto', nom: 'Contrapposto', famille: 'Debout',
    j: { bassin: [0, 7, 6], taille: [0, -5, -3], thorax: [0, -6, -4], cou: [0, 4, 0], tete: [4, 6, 8],
      hancheD: [0, -3, 0], hancheG: [8, 4, 6], genouG: [22], chevilleG: [8],
      epauleG: [6, 10, 0], coudeG: [18], epauleD: [-4, 12, 0], coudeD: [12] } },
  { id: 'hanches', nom: 'Mains sur les hanches', famille: 'Debout',
    j: { epauleG: [-45, 0, -90], epauleD: [-45, 0, -90], coudeG: [100], coudeD: [100], poignetG: [0], poignetD: [0],
      hancheG: [0, 6, 0], hancheD: [0, 6, 0] } },
  { id: 'unejambe', nom: 'Appui sur une jambe', famille: 'Debout',
    j: { hancheG: [75, 4, 10], genouG: [95], chevilleG: [-10], epauleG: [10, 45, 0], epauleD: [10, 45, 0], coudeG: [20], coudeD: [20],
      taille: [0, -3, 0] } },
  { id: 'tabouret', nom: 'Assis sur un tabouret', famille: 'Debout', accessoire: 'tabouret',
    j: { hancheG: [88, 6, 0], hancheD: [88, 6, 0], genouG: [92], genouD: [92], chevilleG: [4], chevilleD: [4],
      taille: [6, 0, 0], epauleG: [28, 6, 0], epauleD: [28, 6, 0], coudeG: [52], coudeD: [52], tete: [6, 0, 0] } },
  { id: 'accroupi', nom: 'Accroupi', famille: 'Debout',
    j: { corps: [18, 0, 0], hancheG: [110, 14, 8], hancheD: [110, 14, 8], genouG: [138], genouD: [138], chevilleG: [22], chevilleD: [22],
      taille: [14, 0, 0], thorax: [8, 0, 0], tete: [-20, 0, 0], epauleG: [55, 8, 0], epauleD: [55, 8, 0], coudeG: [45], coudeD: [45] } },
  { id: 'genoux', nom: 'À genoux', famille: 'Debout',
    j: { genouG: [92], genouD: [92], chevilleG: [-40], chevilleD: [-40], epauleG: [8, 10, 0], epauleD: [8, 10, 0], coudeG: [25], coudeD: [25] } },

  // ---------- Mouvement ----------
  { id: 'marche', nom: 'Marche', famille: 'Mouvement',
    j: { hancheG: [24, 0, 0], genouG: [8], chevilleG: [10], hancheD: [-16, 0, 0], genouD: [22], chevilleD: [-12],
      epauleD: [22, 6, 0], coudeD: [22], epauleG: [-20, 6, 0], coudeG: [12], thorax: [0, 0, -6], tete: [0, 0, 4] } },
  { id: 'course', nom: 'Course', famille: 'Mouvement', sol: 0.35,
    j: { corps: [14, 0, 0], hancheG: [62, 0, 0], genouG: [95], chevilleG: [10], hancheD: [-28, 0, 0], genouD: [55], chevilleD: [-25],
      epauleG: [-45, 8, 0], coudeG: [95], epauleD: [55, 8, 0], coudeD: [95], thorax: [0, 0, -10], tete: [-10, 0, 6] } },
  { id: 'saut', nom: 'Saut, bras en l’air', famille: 'Mouvement', sol: 0.9,
    j: { hancheG: [40, 8, 0], hancheD: [40, 8, 0], genouG: [85], genouD: [85], chevilleG: [-30], chevilleD: [-30],
      epauleG: [165, 18, 0], epauleD: [165, 18, 0], coudeG: [10], coudeD: [10], tete: [-15, 0, 0], thorax: [-8, 0, 0] } },
  { id: 'lancer', nom: 'Lancer', famille: 'Mouvement',
    j: { corps: [0, 0, -15], hancheG: [32, 6, 0], genouG: [18], hancheD: [-14, 4, 0], genouD: [12],
      taille: [0, 4, -25], thorax: [-6, 6, -20], tete: [0, 0, 35],
      epauleD: [10, 100, 30], coudeD: [95], poignetD: [-20], epauleG: [70, 20, 0], coudeG: [20] } },
  { id: 'coupdepied', nom: 'Coup de pied', famille: 'Mouvement',
    j: { corps: [-8, 0, 0], hancheD: [85, 0, 0], genouD: [12], chevilleD: [-30], hancheG: [-4, 0, 0], genouG: [10],
      epauleG: [20, 60, 0], epauleD: [-20, 55, 0], coudeG: [30], coudeD: [30], tete: [10, 0, 0] } },
  { id: 'tirer', nom: 'Tirer une corde', famille: 'Mouvement',
    j: { corps: [-18, 0, 0], hancheG: [40, 4, 0], hancheD: [10, 4, 0], genouG: [38], genouD: [40], chevilleG: [6], chevilleD: [20],
      taille: [6, 0, 0], epauleG: [72, 0, 0], epauleD: [64, 0, 0], coudeG: [22], coudeD: [36], tete: [12, 0, 0] } },

  // ---------- Expressif ----------
  { id: 'brasleves', nom: 'Bras levés', famille: 'Expressif',
    j: { epauleG: [170, 22, 0], epauleD: [170, 22, 0], coudeG: [8], coudeD: [8], tete: [-18, 0, 0], thorax: [-6, 0, 0] } },
  { id: 'penche', nom: 'Penché en avant', famille: 'Expressif',
    j: { corps: [62, 0, 0], hancheG: [55, 4, 0], hancheD: [55, 4, 0], genouG: [12], genouD: [12], chevilleG: [-10], chevilleD: [-10],
      taille: [10, 0, 0], thorax: [8, 0, 0], tete: [-30, 0, 0], epauleG: [70, 6, 0], epauleD: [70, 6, 0], coudeG: [10], coudeD: [10] } },
  { id: 'torsion', nom: 'Se retourner', famille: 'Expressif', vue: [20, 8],
    j: { taille: [0, 0, 22], thorax: [0, 0, 24], cou: [0, 0, 15], tete: [0, 0, 28], hancheG: [6, 4, 0], genouG: [14],
      epauleD: [35, 10, 0], coudeD: [40], epauleG: [-20, 14, 0], coudeG: [20] } },
  { id: 'etirer', nom: 'S’étirer', famille: 'Expressif',
    j: { taille: [0, 10, 0], thorax: [0, 14, 0], tete: [0, 8, 0], epauleD: [175, 10, 0], coudeD: [5], epauleG: [150, 30, 0], coudeG: [50],
      hancheD: [0, 18, 0], hancheG: [0, -2, 0] } },
  { id: 'reflechir', nom: 'Réfléchir, main au menton', famille: 'Expressif',
    j: { hancheG: [6, 2, 0], genouG: [12], tete: [12, 0, -6], cou: [6, 0, 0],
      epauleD: [35, 0, -45], coudeD: [135], poignetD: [-10], epauleG: [25, 0, -80], coudeG: [95] } },

  // ---------- Raccourcis (difficiles à dessiner) ----------
  { id: 'pointer', nom: 'Bras tendu vers vous', famille: 'Raccourcis', vue: [0, 5],
    j: { epauleD: [90, 8, 0], coudeD: [2], epauleG: [0, 12, 0], coudeG: [15], thorax: [4, 0, 8], tete: [4, 0, 0], hancheG: [8, 0, 0], genouG: [10] } },
  { id: 'dos', nom: 'Allongé sur le dos', famille: 'Raccourcis', vue: [0, 30],
    j: { corps: [-90, 0, 0], hancheG: [40, 6, 0], genouG: [80], hancheD: [0, 8, 0], epauleG: [0, 30, 0], epauleD: [0, 30, 0], coudeG: [20], coudeD: [20],
      chevilleG: [10], chevilleD: [-20] } },
  { id: 'cote', nom: 'Allongé sur le côté', famille: 'Raccourcis', vue: [-90, 20],
    // couché sur le flanc gauche : jambe du dessous à peine pliée, jambe du dessus pliée devant, genou posé au sol ;
    // bras du dessous allongé devant, sous la tête, main du dessus posée devant la poitrine
    j: { corps: [0, 90, 0], hancheG: [20, 0, 0], genouG: [25], chevilleG: [-10], hancheD: [70, -26, 0], genouD: [85], chevilleD: [-20],
      epauleG: [95, 0, 0], coudeG: [30], epauleD: [70, -20, 0], coudeD: [60], poignetD: [20, -60], taille: [6, 0, 0], tete: [4, -6, 0] } },

  // ---------- Écrans (la vie de tous les jours) ----------
  { id: 'teldebout', nom: 'Debout, regarde son téléphone', famille: 'Écrans', tient: { D: 'telephone' },
    j: { epauleD: [15, 5, 0], coudeD: [100], poignetD: [10, 90], epauleG: [0, 6, 0], coudeG: [12],
      hancheG: [6, 3, 0], genouG: [14], cou: [15, 0, 0], tete: [25, 0, 0] } },
  { id: 'telassis', nom: 'Assis, au téléphone', famille: 'Écrans', accessoire: 'chaise', tient: { D: 'telephone' },
    j: { hancheG: [88, 6, 0], hancheD: [88, 6, 0], genouG: [88], genouD: [88], taille: [8, 0, 0],
      epauleD: [25, 5, 0], coudeD: [95], poignetD: [10, 90], epauleG: [22, 8, 0], coudeG: [50], cou: [18, 0, 0], tete: [25, 0, 0] } },
  { id: 'teldos', nom: 'Couché sur le dos, téléphone au-dessus', famille: 'Écrans', tient: { D: 'telephone' }, vue: [60, 25],
    j: { corps: [-90, 0, 0], epauleD: [60, 10, 0], coudeD: [80], poignetD: [60, 90], epauleG: [0, 25, 0], coudeG: [20],
      hancheG: [45, 4, 0], genouG: [90], hancheD: [0, 6, 0], tete: [20, 0, 0] } },
  { id: 'telventre', nom: 'Couché sur le ventre, sur les coudes', famille: 'Écrans', tient: { D: 'telephone' }, vue: [60, 20],
    j: { corps: [90, 0, 0], taille: [-20, 0, 0], thorax: [-25, 0, 0], epauleG: [45, 10, 0], epauleD: [45, 10, 0], coudeG: [90], coudeD: [90],
      poignetD: [0, 90], cou: [10, 0, 0], tete: [10, 0, 0], genouG: [70], genouD: [40] } },
  { id: 'borne', nom: 'Debout, commande à une borne', famille: 'Écrans', accessoire: 'borne', vue: [130, 12],
    j: { epauleD: [48, 4, 0], coudeD: [30], poignetD: [0, 0], epauleG: [0, 6, 0], coudeG: [10],
      hancheG: [6, 3, 0], genouG: [12], tete: [10, 0, 0] } },
  { id: 'tablette', nom: 'Debout, tablette en main', famille: 'Écrans', tient: { G: 'tablette' },
    j: { epauleG: [20, 0, 0], coudeG: [95], poignetG: [20, 90], epauleD: [30, 0, -20], coudeD: [80], poignetD: [10, -30],
      cou: [15, 0, 0], tete: [20, 0, 0], hancheD: [5, 3, 0], genouD: [12] } },
  { id: 'tabletteassis', nom: 'Assis, tablette en main', famille: 'Écrans', accessoire: 'chaise', tient: { G: 'tablette' },
    j: { hancheG: [88, 6, 0], hancheD: [88, 6, 0], genouG: [88], genouD: [88], taille: [8, 0, 0],
      epauleG: [20, 0, 0], coudeG: [95], poignetG: [20, 90], epauleD: [30, 0, -20], coudeD: [80], poignetD: [10, -30], cou: [18, 0, 0], tete: [22, 0, 0] } }
];
