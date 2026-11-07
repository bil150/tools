/* Clavier de piano : dessin de touches cliquables avec repères, et touches de l'ordinateur.
   Expose Musique.Keyboard. Dépend de musique/core.js. Sert au piano virtuel et à l'affichage des gammes sur le piano.

   Musique.Keyboard.create(opts) -> { svg, redraw() }
   opts : from, to (numéros MIDI, inclus ; commencer sur un Do), keyW (largeur d'une touche blanche), height,
          mark(midi) -> null ou { label, fill, root } : repère posé sur la touche. fill : indice de lettre (0..6) pour la
          couleur de la note, ou −1 pour simplement éclairer la touche ; root : contour de la note de départ.
          onKey(midi) appelé dès qu'on touche une touche. */
(function () {
  'use strict';

  var M = window.Musique, sv = M.sv;
  var K = M.Keyboard = {};
  var WHITE_PC = [0, 2, 4, 5, 7, 9, 11];

  function isBlack(m) { return WHITE_PC.indexOf(m % 12) < 0; }
  K.create = function (opts) {
    var from = opts.from, to = opts.to, kw = opts.keyW || 34, h = opts.height || 150, bw = kw * 0.62, bh = h * 0.6;
    var nWhite = 0, m;
    for (m = from; m <= to; m++) if (!isBlack(m)) nWhite++;
    var svg = sv('svg', { viewBox: '0 0 ' + nWhite * kw + ' ' + h, role: 'group', 'aria-label': opts.label || 'Clavier de piano' });
    svg.classList.add('kb');

    function whiteX(midi) { var n = 0, k; for (k = from; k < midi; k++) if (!isBlack(k)) n++; return n * kw; }

    function redraw() {
      svg.replaceChildren();
      var marks = [], x, mk;
      for (m = from; m <= to; m++) {
        if (isBlack(m)) continue;
        x = whiteX(m);
        mk = opts.mark ? opts.mark(m) : null;
        svg.appendChild(sv('rect', { x: x, y: 1, width: kw, height: h - 2, 'data-midi': m }, 'kb-w' + (mk && mk.fill === -1 ? ' hl' : '')));
        if (mk && mk.fill !== -1) marks.push({ m: m, cx: x + kw / 2, cy: h - 20, mk: mk });
      }
      for (m = from; m <= to; m++) {
        if (!isBlack(m)) continue;
        x = whiteX(m - 1) + kw - bw / 2; // centrée sur la limite entre la touche blanche qui précède et la suivante
        mk = opts.mark ? opts.mark(m) : null;
        svg.appendChild(sv('rect', { x: x, y: 1, width: bw, height: bh, 'data-midi': m }, 'kb-b' + (mk && mk.fill === -1 ? ' hl' : '')));
        if (mk && mk.fill !== -1) marks.push({ m: m, cx: x + bw / 2, cy: bh - 16, mk: mk });
      }
      marks.forEach(function (o) {
        var circle = sv('circle', { cx: o.cx, cy: o.cy, r: 12 }, 'kb-dot n' + o.mk.fill + (o.mk.root ? ' root' : '')), t = sv('text', { x: o.cx, y: o.cy }, 'kb-lbl' + (o.mk.label && o.mk.label.length > 2 ? ' long' : ''));
        t.textContent = o.mk.label || '';
        circle.setAttribute('pointer-events', 'none');
        t.setAttribute('pointer-events', 'none');
        svg.appendChild(circle); svg.appendChild(t);
      });
    }

    /* On joue dès le toucher (souris ou doigt), sans attendre le relâchement */
    svg.addEventListener('pointerdown', function (e) {
      var t = e.target.closest ? e.target.closest('[data-midi]') : null;
      if (!t || !opts.onKey) return;
      e.preventDefault();
      opts.onKey(Number(t.getAttribute('data-midi')));
    });

    redraw();
    return { svg: svg, redraw: redraw };
  };

  /* Touches de l'ordinateur : A W S E D F T G Y H U J K O L P ; jouent les notes à partir de `base` (un Do).
     `target` doit pouvoir recevoir le clavier (tabindex). onKey(midi) est appelé une seule fois par appui. */
  var KEYMAP = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14, p: 15, ';': 16 };
  K.bindKeys = function (target, getBase, onKey) {
    target.addEventListener('keydown', function (e) {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      var off = KEYMAP[e.key.toLowerCase()];
      if (off === undefined) return;
      e.preventDefault();
      onKey(getBase() + off);
    });
  };
})();
