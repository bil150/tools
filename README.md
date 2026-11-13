# Tools

Petits outils pour la maison et les proches, en HTML, CSS et JS : sans compte, sans serveur, aucune donnée collectée (tout reste dans le navigateur). Publié sur GitHub Pages.

## Contenu

| Dossier | Outils |
|---|---|
| `langues/` | arabe (syllabes, cartes, dictée, écriture), néerlandais (quiz de vocabulaire) |
| `it/` | mémentos imprimables (GNU/Linux, Windows, Dev), testeur de manette, calculateur réseau, convertisseurs, aide cron, comparateur de textes |
| `vie/` | Santé/Condition physique : protéines et calories, repas, courses, sommeil, allure, minuteur, programmes course et musculation |
| `musique/` | guitare, basse, oud, piano, boîte à rythmes, testeur MIDI |
| `arts-plastiques/` | Étude d'image (grille, valeurs, pipette, recette de mélange de peinture) ; Pantin (mannequin 3D, poses, croquis chronométré, lumière) ; Couleur (cercle chromatique, simulateur de mélange, palette limitée, températures et neutres, théorie) ; Glossaire |

`index.html` est le seul index. Dans `assets/` : `css/` (`base.css` commun, un fichier par section, `pages/` une feuille par page), `js/` (`app.js` pour le thème et le bouton « Installer », modules communs, `pages/` un script par page), `icons/` et `vendor/pdfjs/`.

Une page charge `base.css`, puis `css/pages/<nom>.css` et `js/pages/<nom>.js`. Noms courts : syllabes → `arabe`, quiz-vocabulaire → `quiz-nl`, calculateur-reseau → `reseau`, comparateur-textes → `diff`, aide-cron → `cron`, testeur-manette → `manette`, testeur-midi → `midi`. Les mémentos utilisent `memento.css` et `memento.js`.

## Pages d'instruments

Guitare, basse, oud et piano partagent leurs onglets et leur code (`assets/js/musique/`, modules attachés à `window.Musique`, chargés avec `defer`) : noyau (`core.js`), un fichier par instrument (`instrument-*.js`), puis les onglets (clavier, gammes, accordeur, fiche d'accords, Composer, harmonie) et la boîte à rythmes (`batterie.js`).

Un instrument s'enregistre avec `Musique.registerInstrument({ id, name, qualities, chordFor, diagram, rhythms, defaultRhythm, play, chord })`. Pour en ajouter un : écrire son `instrument-*.js`, puis le donner à `Musique.Composer.mount` dans la page (modèle : `assets/js/pages/guitare.js`).

## Étude d'image

Importer une image, pointer une couleur, obtenir la recette à mélanger avec ses propres tubes. Aucun tube n'est préenregistré.

- **Vues** (adresses `#grille`, `#valeurs`, `#pipette`, `#couleurs`, `#parametres`) : mise en grille (carreaux carrés ; 1 à 100 colonnes, décimales permises ; carreau au demi-pixel et décalage au pixel près, Maj ×10 ; lettres A1…, export PNG, export des carreaux en PNG ou ZIP), niveaux de gris, pipette (un clic fixe le pixel) avec couleur cible, recette et conseil, tubes et nuancier, paramètres.
- **Moteur** (`melange-moteur.js`) : CIE L\*a\*b\*, écart ΔE2000, mélange Kubelka-Munk par canal, recette de 1 à 3 tubes cochés : celle qui a le meilleur ΔE, et à ΔE équivalent (0,3) la plus simple. Résultats **indicatifs**, jamais totalement précis : la méthode et ses limites sont dans Paramètres.
- **Pas de tubes noirs** (Paramètres, actif par défaut, noirs chromatiques uniquement) et **pas de tubes métallisés, irisés ni fluorescents** (idem) : ces tubes sont écartés de la recette et du Conseil ; Paramètres explique pourquoi. L’effet vient du champ « effect » du nuancier ou du tube, sinon du nom ou du code pigment ; « (imit) » désigne une imitation ordinaire.
- **Inventaire** : chaque tube est « je l'ai » (coché, sert au calcul), « à acquérir » (liste de courses) ou catalogue ; un tube terminé passe « à racheter » ; les listes « je les ai » et « à acquérir » se copient.
- **Recette** : « Proposer une autre composition » (éteint s’il n’y en a pas) ; « Modifier la composition » rend la liste éditable (peinture et parts), avec cible et ΔE en direct.
- **Conseil** : quand ΔE ≥ 2,5, une tuile fermée propose, à l'ouverture, les peintures non cochées de vos nuanciers qui rapprocheraient la couleur (« Ajouter inventaire » ou « Ajouter à la liste de courses »).
- **Nuanciers** (`nuancier.js`) : un tube a un groupe (la marque, saisie par l'utilisateur) ; import et export JSON, format et prompt pour une IA dans la fenêtre « Nuanciers » ; 1 000 tubes au maximum.
- **Nuancier du fabricant** (image ou PDF, zoom) : un clic lit la couleur ; sur un PDF avec texte, « Lire une zone » remplit nom, code pigment, durabilité et opacité (`lecture-tube.js`, sans OCR). pdf.js n'est chargé qu'à ce moment-là.
- **Navigation** (grille, valeurs, pipette) : l'image est toujours entière ; zoom (molette, deux doigts, + / − / 0) et déplacement, miniature avec le cadre de la zone vue.
- **Peintures de l'image** : les tubes qu'il faut pour toute l'image, de 8 couleurs à tous les points ; vos peintures d'abord, puis plusieurs propositions (+1, +2… tubes) avec leur ΔE moyen ; copier, « Ajouter inventaire », « Ajouter à la liste de courses ». Un bouton copier discret accompagne chaque peinture.
- **Interface** : la page tient à l'écran sans défiler (tablette, ordinateur) ; menu d'icônes, disposition rapide (sous l'image, à droite, image seule) et thèmes (couleurs du site par défaut, gris neutre, papier, contraste) ; changements animés (View Transitions).
- **Stockage** (`localStorage`, clés `tools:arts:melangeur:*`) : tubes et réglages de grille, jamais les images. Paramètres : espace utilisé, export/import des tubes, vider le cache, supprimer les données de l'outil (et seulement elles).

## Pantin

Mannequin d’atelier en bois (pièces tournées, rotules ; forme masculine ou féminine) en 3D (`arts-plastiques/pantin.html`, three.js r185 en copie locale dans `assets/vendor/three`, chargé seulement sur cette page) : 28 poses dont 7 « Écrans » avec téléphone, tablette, chaise ou borne (`assets/js/pantin-poses.js`, angles du mouvement en degrés ; lien direct `?pose=…&vue=…`) posées au sol automatiquement, rotation et zoom au doigt, vues rapides, proportions de 6 à 9 têtes, croquis chronométré (30 s à 5 min, séance), lumière réglable et rendu en 2 ou 3 valeurs, export PNG. Mêmes menu, dispositions et thèmes qu'Étude d'image (`assets/css/pages/arts-atelier.css`, commun aux deux pages) ; réglages dans `tools:arts:pantin:*`.

## Couleur

Page `arts-plastiques/couleur.html` (mêmes menu, dispositions et thèmes). **Cercle chromatique** : deux cercles, en 12, 24 secteurs ou continu. Peintre (RYB, synthèse soustractive : jaune, rouge, bleu à 120°, 12 couleurs de référence d'aspect peint interpolées en OKLab) pour composer ; Lumière (RGB, synthèse additive) pour l'éclairage. Trois styles au choix : anneau seul, primaires au centre (triangle des primaires et hexagone des secondaires), disques superposés (soustractive sur fond blanc pour RYB, additive sur fond noir pour RGB, nom de chaque zone). Réglages du cercle dans une barre compacte sous lui (RYB/RGB, style en icônes, 12/24/continu, valeurs en gris) ; trois tuiles : Harmonie (liste, couleur de départ, saturation), Couleurs (nom, rang et valeurs de chaque couleur), explication de la synthèse du cercle affiché. En disques superposés, seules l'explication et la barre restent. Saturation réglable (100 à 25 %, vers le gris de même clarté). Harmonies complémentaire, complémentaires adjacentes, triade, analogue, carré, rectangle, à tourner au doigt, aux curseurs ou aux flèches ; nom et rang (primaire, secondaire, tertiaire) de chaque couleur, valeurs indicatives vers le blanc (pas d'assombrissement : le noir change la teinte d'une peinture), vue en valeurs (gris de même luminance). Les couleurs d'écran sont indicatives : l'outil montre des relations, pas la teinte d'un tube. Réglages dans `tools:arts:couleur:*`.

**Simulateur de mélange** (`couleur.html#melange`) : 2 ou 3 couleurs et leurs parts ; résultat en grand avec le rapport simplifié (ex. 3 : 1), les pourcentages et la valeur (L*), gamme de tous les mélanges (bande de 21 cases pour 2 couleurs, triangle au douzième pour 3) où un clic choisit les proportions, vue en valeurs. Au départ : 3 couleurs, cyan, magenta et jaune primaires. Parts − et + à appui maintenu (répétition qui accélère), repère à faire glisser sur la bande ou le triangle. Deux sources : couleurs génériques par défaut (31 couleurs courantes rangées par familles, dont les primaires jaune, rouge, bleu, magenta et cyan ; nom d'usage et code pigment du Colour Index, sans marque, teintes approximatives) ou inventaire (tubes de Couleurs physiques avec pigment et groupe, lus dans `tools:arts:melangeur:atelier` sans être modifiés) ; choix dans un panneau avec recherche (sans accents, tous les mots), familles, clavier . Mode « Toute la palette » (palette limitée) : de 2 à 8 couleurs (− N +, la couleur ajoutée est celle qui agrandit le plus la zone atteignable), blanc en plus ou non, palettes prêtes (primaires CMJ, primaires RJB, terres) ; planche des mélanges deux à deux et au blanc (4 doses) ; cercle de la zone atteignable (tous les mélanges au sixième, teinte OKLab jaune en haut, saturation vers le bord, enveloppe convexe, tubes cerclés) ; teintes franches et hors d'atteinte nommées. Calcul par le moteur de l'Étude d'image (`melange-moteur.js`, Kubelka-Munk simplifié, fonction `mix` exportée) : indicatif.

**Températures et neutres** (`couleur.html#temperature`) : une couleur (génériques ou inventaire) ; une action à la fois (Réchauffer, Refroidir, Griser) ; couleur + ajout = résultat en grand, la couleur ajoutée étant la voisine côté orange (55° en OKLab) ou côté bleu (235°), ou la complémentaire, choisie dans la source ; 5 doses de « un peu » à « beaucoup » (jusqu’au mélange le plus neutre pour griser), recette en parts simples ; jauge de température avant → après. Le cercle propose aussi la fausse complémentaire (une voisine de la complémentaire) et les fausses complémentaires (les deux).

**Théorie des couleurs** (`couleur.html#theorie`) : cartes de notions, textes et illustrations originaux, générés par l’outil : primaires, secondaires, tertiaires (cercle du peintre, rang mis en évidence) ; le dilemme des complémentaires (complémentaire et fausse complémentaire côte à côte) ; chaud et froid relatifs (même couleur sur une voisine plus chaude ou plus froide) ; valeur × saturation pour une teinte, avec vue en gris ; les 7 contrastes (de la couleur en soi, clair-obscur, chaud-froid, complémentaires, simultané avec gris à relier, qualité, quantité). Source citée une seule fois en bas de page : J. Itten, *L’Art de la couleur* (1961).

## Glossaire

Page `arts-plastiques/glossaire.html` (section « Référence », en fin du menu Arts plastiques) : 137 termes d’atelier en 7 thèmes (couleur, méthodes et techniques, matériaux et produits, supports et outils, dessin, composition, sujets et genres), définitions courtes rédigées pour le site (`assets/js/glossaire-data.js`). Recherche sans accents ni majuscules (tous les mots), filtre par thème (mémorisé dans `tools:arts:glossaire:theme`), renvois automatiques entre termes (sauf ceux qui sont aussi des mots courants), lien « Voir dans l’outil » vers la page du site qui l’illustre, lien direct `glossaire.html#terme-glacis`.

## Publication

Le site est servi dans un sous-dossier (`https://<utilisateur>.github.io/<depot>/`) : chemins **relatifs**, noms de fichiers en minuscules. Après `git push`, Réglages du dépôt → Pages → « Deploy from a branch », branche `main`, dossier `/ (root)`. `.nojekyll` désactive Jekyll.

`manifest.webmanifest` et les icônes permettent l'ajout à l'écran d'accueil (Android : « Installer l'application » ; iPhone : Partager → « Sur l'écran d'accueil »). Le site n'est pas prévu pour fonctionner hors connexion. Le thème suit l'appareil ; le bouton lune/soleil le force et le mémorise.

## Conventions

- Chaque page : `base.css` d'abord, puis sa feuille ; ni `<style>` ni `<script>` en ligne. Un fil d'Ariane (`<nav class="topbar">`) en tête.
- Couleurs via les variables de `base.css` (`light-dark()`).
- Ajouter une page : créer le fichier (nommé d'après son contenu, pas `index.html`) dans le bon dossier, copier l'en-tête d'une page existante, puis ajouter une tuile dans le menu parent.
- Code écrit pour ce projet, sans bibliothèque ni service externe (hors pdf.js, three.js et la police arabe Noto Naskh Arabic, en copie locale avec leur licence), et sans nom de marque dans les outils.
- **Poids du projet : 5 Mo au maximum** (hors `.git` ; environ 2,3 Mo, dont 1,4 Mo pour pdf.js).

## Licence

CC BY-NC-SA 4.0 — bil150, 2026.
