/* Script commun à toutes les pages (chargé dans <head>, sans defer) :
   - thème clair / sombre (suit l'appareil par défaut, choix mémorisé dans ce navigateur) ;
   - bouton « Installer » quand le navigateur propose d'ajouter le site à l'écran d'accueil. */
(function () {
  'use strict';

  var KEY = 'tools:theme';
  var root = document.documentElement;

  /* ---------- Thème ---------- */
  function read() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function write(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* stockage indisponible */ } }
  function apply(theme) {
    if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
    else root.removeAttribute('data-theme');
  }
  function effective() {
    var t = root.getAttribute('data-theme');
    if (t) return t;
    return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  apply(read()); // immédiat, avant l'affichage : pas de flash

  /* ---------- Icônes du bouton de thème (tracés simples, couleur du texte) ---------- */
  var SVG = 'http://www.w3.org/2000/svg';
  var ICONS = {
    moon: ['M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z'],
    sun: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M12 2v2', 'M12 20v2', 'M4.9 4.9l1.4 1.4', 'M17.7 17.7l1.4 1.4', 'M2 12h2', 'M20 12h2', 'M4.9 19.1l1.4-1.4', 'M17.7 6.3l1.4-1.4']
  };
  function icon(name) {
    var svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    ICONS[name].forEach(function (d) {
      var p = document.createElementNS(SVG, 'path');
      p.setAttribute('d', d);
      svg.appendChild(p);
    });
    return svg;
  }

  /* ---------- Boutons de la barre du haut ---------- */
  function addButton(bar, label, onClick) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'tbtn';
    b.textContent = label;
    b.addEventListener('click', onClick);
    bar.appendChild(b);
    return b;
  }

  var installEvent = null, installBtn = null, bar = null;
  var isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;

  function showInstall() {
    if (!bar || installBtn || standalone) return;
    installBtn = addButton(bar, 'Installer', function () {
      if (installEvent) {
        installEvent.prompt();
        installEvent = null;
        installBtn.remove();
        installBtn = null;
      } else {
        // iPhone / iPad : pas de fenêtre d'installation, il faut passer par le menu de partage
        alert('Dans Safari : touchez le bouton Partager, puis « Sur l’écran d’accueil ».');
      }
    });
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    installEvent = e;
    showInstall();
  });
  window.addEventListener('appinstalled', function () {
    if (installBtn) { installBtn.remove(); installBtn = null; }
  });

  function ready() {
    bar = document.querySelector('.topbar');
    if (!bar) return;
    var themeBtn = addButton(bar, '', function () {
      var next = effective() === 'dark' ? 'light' : 'dark';
      apply(next);
      write(next);
      refresh();
      window.dispatchEvent(new Event('themechange'));
    });
    themeBtn.classList.add('icon');
    function refresh() {
      var dark = effective() === 'dark';
      var label = dark ? 'Passer en mode clair' : 'Passer en mode sombre';
      themeBtn.replaceChildren(icon(dark ? 'sun' : 'moon'));
      themeBtn.setAttribute('aria-label', label);
      themeBtn.title = label;
    }
    refresh();
    if (window.matchMedia) {
      matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
        if (!root.getAttribute('data-theme')) { refresh(); window.dispatchEvent(new Event('themechange')); }
      });
    }
    if (installEvent || (isIos && !standalone)) showInstall();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();

})();
