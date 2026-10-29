# Tools

Petits outils perso en HTML/CSS/JS, sans compte. Site statique : aucune donnée n'est collectée ni stockée sur un serveur.

## Structure

```
index.html                     accueil (le seul index)
assets/
  css/
    base.css                   variables, reset, mise en page, composants communs
    memento.css                feuilles A4 paysage imprimables (mémentos IT)
    pages/arabe.css            styles propres à la page d'arabe
  js/
    memento.js                 nombre de pages, échelle et impression des feuilles
    pages/arabe.js             lecture, alphabet et quiz d'écoute
langues/
  langues.html                 menu des langues
  ar/arabe.html                menu arabe
  ar/syllabes.html             tableau des syllabes, alphabet, quiz
it/
  it.html                      menu informatique
  memento-linux.html  memento-windows.html  memento-applicatifs.html
```

## Conventions

- Chaque page : `base.css` d'abord, puis la feuille de style dédiée. Pas de `<style>` ni de `<script>` en ligne.
- Un seul index à la racine ; les autres pages portent le nom de leur contenu.
- Un fil d'Ariane en tête de chaque page (`<nav class="topbar">`).
- Un mémento = `<header class="toolbar">` + des `<div class="sheet" id data-face data-cols>`.
  `memento.js` construit les barres de réglage et peut répartir le contenu sur 1 à 8 pages.
- Couleurs et rayons viennent des variables de `base.css` ; les feuilles imprimées restent blanches.

## Ajouter une page

1. Créer le fichier dans le bon dossier, nommé d'après son contenu (pas `index.html`).
2. Copier l'en-tête d'une page existante : `base.css`, puis sa feuille dédiée si besoin.
3. Ajouter le fil d'Ariane, puis une tuile (`<a class="tile">`) dans le menu parent.
4. Pour un mémento : ajouter les `.sheet` ; `memento.js` fournit les réglages (pages, colonnes, échelle).

## Licence

Mémentos IT : CC BY-NC-SA 4.0 — bil150, 2026.
