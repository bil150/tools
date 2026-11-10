# Tools

Compilation de petits outils pour la maison et les proches, intégrés un à un et au style commun.
Disponible par un lien GitHub Pages.

En HTML, CSS et JS, sans compte. Site statique : aucune donnée n'est collectée ni stockée sur un serveur.

## Structure

```
index.html                       accueil : Langues, IT, Santé/Condition Physique, Musique et Arts plastiques (le seul index)
manifest.webmanifest             nom, couleurs et icônes du raccourci mobile
.nojekyll                        désactive Jekyll sur GitHub Pages
README.md

langues/
  langues.html                   menu des langues
  ar/
    arabe.html                   menu arabe
    syllabes.html                tableau des syllabes, alphabet, quiz d'écoute et de mots
    cartes.html                  cartes à retourner (alphabet, syllabes, mots)
    dictee.html                  dictée : assembler les morceaux d'une écriture entendue
    ecriture.html                écriture à la main avec harakat et lignes de guidage
  nl/
    neerlandais.html             menu néerlandais
    quiz-vocabulaire.html        quiz illustré : vêtements, couleurs, visage, émotions, fréquences, saisons (choix multiple ou saisie)

it/
  it.html                        menu informatique
  memento-linux.html             mémento GNU/Linux
  memento-windows.html           mémento Windows
  memento-applicatifs.html       mémento Dev & Applicatifs
  testeur-manette.html           testeur de manette (API Gamepad)
  calculateur-reseau.html        adresse, masque, CIDR, plage, sous-réseaux
  convertisseurs.html            JSON, Base64, URL, bases numériques, couleurs
  aide-cron.html                 explication d'une expression cron, prochaines exécutions
  comparateur-textes.html        différences entre deux textes (diff)

vie/
  vie.html                       menu Santé/Condition Physique
  proteines.html                 besoin en calories et en protéines selon le sport et l'objectif ; sources animales et végétales
  repas.html                     compositeur de repas : idées à partir de ce qu'on a, avec variantes d'aliment et de préparation
  sommeil.html                   heures de coucher ou de réveil en cycles de sommeil de 90 min
  courses.html                   liste de courses : ingrédients des idées de repas ou aliments à la main, par rayon, à cocher
  allure.html                    calculateur d'allure (distance, temps, allure) et estimation sur d'autres distances
  minuteur.html                  minuteur d'intervalles (travail, repos, tours) avec signal sonore
  course.html                    programme de course à pied de la semaine (niveau, jours, objectif)
  muscu.html                     programme de musculation de la semaine (corps entier, haut/bas, push/pull/jambes)

musique/
  musique.html                   menu musique
  guitare.html                   guitare : accords ouverts, guitare virtuelle (six lignes à balayer), manche et gammes,
                                 accordeur (micro), Composer, suites harmoniques
  basse.html                     basse : mêmes onglets que la guitare (quatre cordes)
  oud.html                       oud : notes, oud virtuel, manche et gammes, accordeur (six chœurs, accordage arabe, sans frettes) ; ni Composer ni suites harmoniques
  piano.html                     piano : mêmes onglets, sans accordeur ; clavier virtuel
  boite-a-rythmes.html           boîte à rythmes : styles, variations, mesures éditables, tempo (accompagne aussi le Composer)
  testeur-midi.html              testeur de clavier MIDI (API Web MIDI)

arts-plastiques/
  arts-plastiques.html           menu arts plastiques : section « Étude d'image » (tuiles vers les sous-vues de l'outil : #grille, #valeurs, #pipette, #couleurs)
  etude-image.html               étude d'image : menu latéral d'icônes (Mise en grille, Perception des valeurs, Aperçu & pipette, Couleurs physiques – Peinture, Paramètres)

assets/
  css/
    base.css                     variables, thème clair/sombre, reset, composants communs
    vie.css                      styles communs des pages « Santé/Condition Physique » (chiffres clés, barres, tableaux)
    musique.css                  styles communs des pages d'instruments (onglets, schémas, Composer, boîte à rythmes, roue, gammes…)
    arabe.css                    styles communs aux pages d'arabe
    memento.css                  feuilles A4 paysage imprimables (mémentos IT)
    pages/                       un fichier par page : arabe, cartes, dictee, ecriture,
                                 manette, midi, guitare, basse, piano, reseau, convertisseurs, cron, diff, quiz-nl,
                                 arts-plastiques (menu), etude-image
  js/
    app.js                       thème clair/sombre (icône), bouton « Installer »
    arabe-core.js                données de l'arabe et voix, partagées par les 4 pages d'arabe
    memento.js                   nombre de pages, échelle et impression des feuilles
    melange-moteur.js            moteur de l'étude d'image (mélange de peinture), sans DOM : CIE L*a*b*, écart ΔE2000, mélange Kubelka-Munk, solveur
    lecture-tube.js              lecture du texte d'un tube (nom, code pigment, durabilité, opacité), sans DOM
    nuancier.js                  nuanciers : validation d'un tube, lecture et écriture du JSON d'échange, prompt pour une IA, sans DOM
    musique/                     modules communs des pages d'instruments (voir « Pages d'instruments »)
    vie/aliments.js              base d'aliments (calories et macros pour 100 g) et aides communes aux pages « Santé/Condition Physique »
    vie/calendrier.js            export d'une semaine de séances au format iCalendar (.ics), créé sur l'appareil
    vie/glisser.js               déplacer une séance d'un jour à l'autre (glisser ou toucher) pour les programmes course et musculation
    pages/                       un fichier par page, même noms que dans css/pages/
  icons/                         favicon.svg, icon-192/512.png, maskable-512.png, apple-touch-icon.png
  vendor/pdfjs/                  pdf.js 3.11.174 (Mozilla, Apache-2.0) : copie locale, chargée seulement pour lire un nuancier PDF (voir « Étude d'image »)
```

Chaque page de `it/`, `langues/` et `musique/` (hors pages d'instruments, décrites plus haut) charge `base.css`, puis sa feuille de style dédiée dans `assets/css/pages/`,
puis son script dans `assets/js/pages/` (même nom). Les mémentos utilisent `memento.css` et `memento.js`.
Correspondance des noms : syllabes → `arabe`, quiz-vocabulaire → `quiz-nl`, calculateur-reseau → `reseau`, comparateur-textes → `diff`, aide-cron → `cron`, testeur-manette → `manette`, testeur-midi → `midi` ; les autres pages portent leur propre nom.

## Pages d'instruments (guitare, basse, oud, piano)

Les pages ont les mêmes onglets et partagent leur code, rangé dans `assets/js/musique/`. Une page d'instrument ne contient
que ce qui est propre à l'instrument ; tout le reste est un module qui construit sa propre interface dans un conteneur.
Tous les modules s'attachent à `window.Musique` et se chargent avec `defer`, dans cet ordre.

```
core.js                  noyau : aides DOM, stockage, théorie (notes, gammes, accords), audio (un « bus » par instrument),
                         notation A B C / Do Ré Mi, onglets
batterie.js              boîte à rythmes : sons synthétisés, 22 styles à variations, mesures éditables, sauvegarde commune (Musique.Drums)
instrument-guitare.js    un fichier par instrument : doigtés, schéma d'accord, son, rythmes (guitare, piano, basse, oud)
instrument-piano.js
instrument-basse.js
instrument-oud.js
clavier.js               clavier de piano cliquable, touches de l'ordinateur
gammes.js                onglet « gammes » : notes naturelles, gammes, décalages ; afficheurs manche à cordes et clavier
accordeur.js             onglet « accordeur » : micro, détection de hauteur, notes de référence
cordes.js                instrument virtuel fait de lignes à balayer (N cordes)
fiche.js                 fiche des accords d'un instrument (12 fondamentales × familles) avec leurs schémas
composer.js              Composer : suite d'accords jouée par un ou plusieurs instruments et la boîte à rythmes
harmonie.js              roue des accords, accords de chaque tonalité et suites classiques
```

Un instrument est un objet enregistré avec `Musique.registerInstrument` :
`{ id, name, qualities, chordFor(root, q), diagram(accord), rhythms: [{ id, name, events(accord, temps) }], defaultRhythm,
play(événement, accord, instant, secondesParTemps), chord(accord, instant, volume) }`.
Composer, la fiche d'accords et les suites harmoniques n'en demandent pas davantage : pour ajouter un instrument, on écrit
son fichier `instrument-*.js`, puis on le donne à `Musique.Composer.mount` dans la page.

Une page assemble ces modules (voir `assets/js/pages/guitare.js`) : `M.initNotation()`, un `mount` par onglet, puis `M.tabs` qui
arrête ce qui sonne quand on change d'onglet. Dans le HTML, chaque onglet est un bouton `#tab-<nom>` et un panneau
`#panel-<nom>` contenant un conteneur vide.

## Étude d'image

Importer une image, pointer une couleur, obtenir la recette à mélanger avec ses propres tubes. Tout se calcule dans le navigateur.

- **Vues** : Mise en grille (carreaux carrés : colonnes, couleur, épaisseur et style du trait, lettres A1, B1… ; export PNG avec la grille ; carreaux choisis au clic ou saisis « A1, C1:C3 », exportés en PNG un par un, en ZIP s'il y en a plusieurs), Perception des valeurs (niveaux de gris),
  Aperçu & pipette (un clic ou un toucher fixe le pixel ; le simple survol ne change rien), Couleurs physiques – Peinture (tubes et nuancier du fabricant, image ou PDF), Paramètres.
  Chaque vue a une adresse (`etude-image.html#grille`, `#valeurs`, `#pipette`, `#couleurs`, `#parametres`).
- **Résultats indicatifs** : jamais totalement précis ; la seule valeur sûre est la perception de plusieurs personnes devant la peinture réelle. La méthode et ses limites sont expliquées dans Paramètres.
- **Moteur** (`assets/js/melange-moteur.js`) : couleurs en CIE L*a*b*, écart en ΔE2000, mélange Kubelka-Munk par canal
  (rouge, vert, bleu en lumière linéaire). Chaque tube n'est connu que par sa couleur de référence : K/S s'en déduit, et la diffusion S
  est estimée d'après la clarté du tube. C'est une approximation à vérifier sur la palette, pas une mesure.
  Le solveur teste les tubes activés (1 à 3 par recette), cherche les proportions qui minimisent ΔE2000 et préfère la recette la plus simple à qualité proche.
- **Aucun tube préenregistré** : l'utilisateur saisit les siens (nom, code pigment CI facultatif, couleur de référence), à la main ou en cliquant sur le **nuancier du fabricant**
  (une image ou un PDF, chargé une fois et gardé pour tous les ajouts ; moyenne de 5 × 5 pixels ; pages d'un PDF au choix ; zoom ×1 à ×8 : boutons, Ctrl + molette, deux doigts, glisser, clavier). Le PDF est lu par pdf.js, chargé seulement à ce moment-là.
- **Lecture d'une zone** (`assets/js/lecture-tube.js`) : sur un PDF contenant du texte, on entoure l'entrée d'un tube ; le texte de la zone est lu dans le PDF (aucun OCR) et rempli dans le formulaire du tube en cours d'ajout : nom, code pigment (Colour Index), durabilité (ASTM I à III), transparence / opacité. Rien n'est deviné ni créé en dehors de ce formulaire ; la couleur se lit toujours d'un clic. Les images (photo, scan) n'ont pas de texte lisible sans OCR : non pris en charge.
- **Nuanciers et groupes** (`assets/js/nuancier.js`) : un tube peut avoir un **groupe**, qui est la marque, saisie par l'utilisateur (rien n'est préenregistré). La liste se regroupe par marque (case pour cocher tout un groupe). La fenêtre « Nuanciers » permet d'**importer** un JSON (fichier ou texte collé, aperçu avant import, entrées refusées listées avec leur raison, mise à jour sans doublon par groupe + nom, option « remplacer les tubes de ces groupes », tubes importés non cochés par défaut), d'**exporter** un groupe ou tous (téléchargement ou copie) et d'afficher le **format du fichier avec un prompt à donner à une IA** pour fabriquer un nuancier à partir du document d'un fabricant. 1 000 tubes au maximum. Le module `nuancier.js` est aussi la seule source des règles de validation d'un tube.
- **Durabilité et transparence / opacité** : saisies pour chaque tube d'après la fiche du fabricant, affichées en pastilles ; la recette indique la durabilité du tube le moins durable. Ce sont des informations : elles n'entrent pas dans le calcul.
- **Disposition et animations** : une tuile de disposition rapide sous le menu (réglages sous l'image, à droite, ou image seule). Les changements de vue et de disposition sont animés
  par le navigateur (View Transitions : fondu, déplacement et changement de taille des blocs ; repli en fondu CSS ailleurs ; rien si l'utilisateur demande moins d'animations).
  Aucune couleur sur les tuiles ni autour des images (gris neutre) : on y juge des couleurs.
- **Stockage** (`localStorage`, clés `tools:arts:melangeur:atelier`, `…:grille` et `…:disposition` (préfixe d'origine conservé)) : tubes et réglages de grille. Les images ne sont jamais enregistrées.
  Paramètres : espace utilisé, export / import des tubes en JSON, « Vider le cache » (image de travail et sélection, tubes conservés),
  « Supprimer les données sur cet appareil » (uniquement les clés de cet outil : les autres outils du site partagent la même origine et gardent les leurs).

## Publication sur GitHub Pages

Le site est servi dans un sous-dossier (`https://<utilisateur>.github.io/<depot>/`) : tous les chemins sont donc **relatifs**, sans `/` au début.
Les noms de fichiers sont en minuscules (GitHub Pages distingue les majuscules).

1. Commiter et pousser.
2. Réglages du dépôt, onglet Pages : source « Deploy from a branch », branche `main`, dossier `/ (root)`.

Le fichier `.nojekyll` désactive le traitement Jekyll de GitHub.

### Raccourci sur mobile

Le fichier `manifest.webmanifest` et les icônes permettent d'ajouter le site à l'écran d'accueil.
Sur Android (Chrome) : menu, puis « Installer l'application » ou « Ajouter à l'écran d'accueil » (un bouton « Installer » peut aussi apparaître en haut de la page).
Sur iPhone et iPad : Partager, puis « Sur l'écran d'accueil ».
Le site n'est pas prévu pour fonctionner sans connexion.

### Thème

Le thème suit l'appareil. Le bouton en forme de lune ou de soleil, en haut à droite de chaque page, le force ; le choix est gardé dans ce navigateur.

## Conventions

- Chaque page : `base.css` d'abord, puis la feuille de style dédiée. Pas de `<style>` ni de `<script>` en ligne.
- Un seul index à la racine ; les autres pages portent le nom de leur contenu.
- Un fil d'Ariane en tête de chaque page (`<nav class="topbar">`) : `app.js` y ajoute les boutons du thème et d'installation.
- Les couleurs viennent des variables de `base.css` (`light-dark()`). Les feuilles imprimées et le clavier de piano gardent des couleurs fixes.
- Un mémento = `<header class="toolbar">` + des `<div class="sheet" id data-face data-cols>`.
  `memento.js` construit les barres de réglage et peut répartir le contenu sur 1 à 8 pages.
- **Poids du projet : 5 Mo au maximum** (hors .git ; 2,3 Mo aujourd'hui, dont 1,4 Mo pour pdf.js). Tout ajout de fichier lourd (bibliothèque, données de langue, images) doit tenir dans ce plafond.
- Du code écrit pour ce projet, sans bibliothèque ni service externe (hors la police arabe, et pdf.js en copie locale pour lire un nuancier PDF), et sans nom de marque dans les outils.

## Ajouter une page

1. Créer le fichier dans le bon dossier, nommé d'après son contenu (pas `index.html`).
2. Copier l'en-tête d'une page existante (manifeste, icônes, `app.js`, `base.css`, puis sa feuille dédiée si besoin).
3. Ajouter le fil d'Ariane, puis une tuile (`<a class="tile">`) dans le menu parent.

## Licence

Mémentos IT : CC BY-NC-SA 4.0 — bil150, 2026.
