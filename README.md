# Tools

Petits outils pour la maison et les proches, en HTML, CSS et JS : sans compte, sans serveur, aucune donnée collectée (tout reste dans le navigateur). Publié sur GitHub Pages.

## Contenu

| Dossier | Outils |
|---|---|
| `langues/` | arabe (syllabes, cartes, dictée, écriture), néerlandais (quiz de vocabulaire) |
| `it/` | mémentos imprimables (GNU/Linux, Windows, Dev), testeur de manette, calculateur réseau, convertisseurs, aide cron, comparateur de textes |
| `vie/` | Santé/Condition physique : protéines et calories, repas, courses, sommeil, allure, minuteur, programmes course et musculation |
| `musique/` | guitare, basse, oud, piano, boîte à rythmes, testeur MIDI |
| `arts-plastiques/` | Étude d'image : grille, valeurs, pipette, recette de mélange de peinture |

`index.html` est le seul index. Dans `assets/` : `css/` (`base.css` commun, un fichier par section, `pages/` une feuille par page), `js/` (`app.js` pour le thème et le bouton « Installer », modules communs, `pages/` un script par page), `icons/` et `vendor/pdfjs/`.

Une page charge `base.css`, puis `css/pages/<nom>.css` et `js/pages/<nom>.js`. Noms courts : syllabes → `arabe`, quiz-vocabulaire → `quiz-nl`, calculateur-reseau → `reseau`, comparateur-textes → `diff`, aide-cron → `cron`, testeur-manette → `manette`, testeur-midi → `midi`. Les mémentos utilisent `memento.css` et `memento.js`.

## Pages d'instruments

Guitare, basse, oud et piano partagent leurs onglets et leur code (`assets/js/musique/`, modules attachés à `window.Musique`, chargés avec `defer`) : noyau (`core.js`), un fichier par instrument (`instrument-*.js`), puis les onglets (clavier, gammes, accordeur, fiche d'accords, Composer, harmonie) et la boîte à rythmes (`batterie.js`).

Un instrument s'enregistre avec `Musique.registerInstrument({ id, name, qualities, chordFor, diagram, rhythms, defaultRhythm, play, chord })`. Pour en ajouter un : écrire son `instrument-*.js`, puis le donner à `Musique.Composer.mount` dans la page (modèle : `assets/js/pages/guitare.js`).

## Étude d'image

Importer une image, pointer une couleur, obtenir la recette à mélanger avec ses propres tubes. Aucun tube n'est préenregistré.

- **Vues** (adresses `#grille`, `#valeurs`, `#pipette`, `#couleurs`, `#parametres`) : mise en grille (carreaux carrés, lettres A1…, export PNG, export des carreaux en PNG ou ZIP), niveaux de gris, pipette (un clic fixe le pixel) avec couleur cible, recette et conseil, tubes et nuancier, paramètres.
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

## Publication

Le site est servi dans un sous-dossier (`https://<utilisateur>.github.io/<depot>/`) : chemins **relatifs**, noms de fichiers en minuscules. Après `git push`, Réglages du dépôt → Pages → « Deploy from a branch », branche `main`, dossier `/ (root)`. `.nojekyll` désactive Jekyll.

`manifest.webmanifest` et les icônes permettent l'ajout à l'écran d'accueil (Android : « Installer l'application » ; iPhone : Partager → « Sur l'écran d'accueil »). Le site n'est pas prévu pour fonctionner hors connexion. Le thème suit l'appareil ; le bouton lune/soleil le force et le mémorise.

## Conventions

- Chaque page : `base.css` d'abord, puis sa feuille ; ni `<style>` ni `<script>` en ligne. Un fil d'Ariane (`<nav class="topbar">`) en tête.
- Couleurs via les variables de `base.css` (`light-dark()`).
- Ajouter une page : créer le fichier (nommé d'après son contenu, pas `index.html`) dans le bon dossier, copier l'en-tête d'une page existante, puis ajouter une tuile dans le menu parent.
- Code écrit pour ce projet, sans bibliothèque ni service externe (hors la police arabe et pdf.js en copie locale), et sans nom de marque dans les outils.
- **Poids du projet : 5 Mo au maximum** (hors `.git` ; environ 2,3 Mo, dont 1,4 Mo pour pdf.js).

## Licence

CC BY-NC-SA 4.0 — bil150, 2026.
