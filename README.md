# Tools

Compilation de petits outils pour la maison et les proches, intégrés un à un et au style commun.
Disponible par un lien GitHub Pages.

En HTML, CSS et JS, sans compte. Site statique : aucune donnée n'est collectée ni stockée sur un serveur.

## Structure

```
index.html                       accueil : Langues et IT (le seul index)
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
  testeur-midi.html              testeur de clavier MIDI (API Web MIDI)
  calculateur-reseau.html        adresse, masque, CIDR, plage, sous-réseaux
  convertisseurs.html            JSON, Base64, URL, bases numériques, couleurs
  aide-cron.html                 explication d'une expression cron, prochaines exécutions
  comparateur-textes.html        différences entre deux textes (diff)

assets/
  css/
    base.css                     variables, thème clair/sombre, reset, composants communs
    arabe.css                    styles communs aux pages d'arabe
    memento.css                  feuilles A4 paysage imprimables (mémentos IT)
    pages/                       un fichier par page : arabe, cartes, dictee, ecriture,
                                 manette, midi, reseau, convertisseurs, cron, diff, quiz-nl
  js/
    app.js                       thème clair/sombre (icône), bouton « Installer »
    arabe-core.js                données de l'arabe et voix, partagées par les 4 pages d'arabe
    memento.js                   nombre de pages, échelle et impression des feuilles
    pages/                       un fichier par page, même noms que dans css/pages/
  icons/                         favicon.svg, icon-192/512.png, maskable-512.png, apple-touch-icon.png
```

Chaque page de `it/` et `langues/` charge `base.css`, puis sa feuille de style dédiée dans `assets/css/pages/`,
puis son script dans `assets/js/pages/` (même nom). Les mémentos utilisent `memento.css` et `memento.js`.
Correspondance des noms : syllabes → `arabe`, quiz-vocabulaire → `quiz-nl`, calculateur-reseau → `reseau`, comparateur-textes → `diff`, aide-cron → `cron`, testeur-manette → `manette`, testeur-midi → `midi` ; les autres pages portent leur propre nom.

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
- Du code écrit pour ce projet, sans bibliothèque ni service externe (hors la police arabe), et sans nom de marque dans les outils.

## Ajouter une page

1. Créer le fichier dans le bon dossier, nommé d'après son contenu (pas `index.html`).
2. Copier l'en-tête d'une page existante (manifeste, icônes, `app.js`, `base.css`, puis sa feuille dédiée si besoin).
3. Ajouter le fil d'Ariane, puis une tuile (`<a class="tile">`) dans le menu parent.

## Licence

Mémentos IT : CC BY-NC-SA 4.0 — bil150, 2026.
