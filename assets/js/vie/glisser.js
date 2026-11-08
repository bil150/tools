/* Santé/Condition Physique : déplacer une séance vers un autre jour d'une semaine. Expose Vie.glisser. Dépend de vie/aliments.js.
   Deux gestes : glisser la poignée « ⠿ » d'une séance sur un jour, ou toucher la séance puis le jour voulu (pratique au doigt).
   Déposer sur un jour qui a déjà une séance les échange. */
(function () {
  'use strict';

  var V = window.Vie;

  /* host : conteneur des jours (chaque jour est un élément .day avec data-d = index 0..6, .grip pour les séances)
     onMove(de, vers) est appelé quand on déplace ; l'appelant redessine la semaine. */
  V.glisser = function (host, onMove) {
    var drag = null, selected = -1, justDragged = false;

    function index(node) { var d = node && node.closest ? node.closest('.day') : null; return d ? Number(d.getAttribute('data-d')) : -1; }
    function jour(i) { return host.querySelector('.day[data-d="' + i + '"]'); }
    function clear() {
      Array.prototype.forEach.call(host.querySelectorAll('.drag, .over'), function (x) { x.classList.remove('drag', 'over'); });
    }
    function surLaSouris(e) { return index(document.elementFromPoint(e.clientX, e.clientY)); }

    host.addEventListener('pointerdown', function (e) {
      var grip = e.target.closest('.grip'), i;
      if (!grip) return;
      i = index(grip);
      if (i < 0) return;
      drag = { id: e.pointerId, from: i, moved: false, x: e.clientX, y: e.clientY };
      try { grip.setPointerCapture(e.pointerId); } catch (err) { /* capture indisponible */ }
      jour(i).classList.add('drag');
    });
    host.addEventListener('pointermove', function (e) {
      var over;
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.moved && Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) < 6) return;
      drag.moved = true;
      Array.prototype.forEach.call(host.querySelectorAll('.over'), function (x) { x.classList.remove('over'); });
      over = surLaSouris(e);
      if (over >= 0 && over !== drag.from) jour(over).classList.add('over');
    });
    function fin(e, annule) {
      var to;
      if (!drag || e.pointerId !== drag.id) return;
      to = annule ? -1 : surLaSouris(e);
      clear();
      if (drag.moved) {
        justDragged = true;
        setTimeout(function () { justDragged = false; }, 0);
        if (to >= 0 && to !== drag.from) onMove(drag.from, to);
      }
      drag = null;
    }
    host.addEventListener('pointerup', function (e) { fin(e, false); });
    host.addEventListener('pointercancel', function (e) { fin(e, true); });

    /* Toucher une séance, puis le jour où la mettre */
    function choisir(i) {
      if (justDragged) return;
      if (selected < 0) {
        if (jour(i) && jour(i).querySelector('.grip')) { selected = i; jour(i).classList.add('sel'); }
        return;
      }
      var depuis = selected;
      selected = -1;
      Array.prototype.forEach.call(host.querySelectorAll('.sel'), function (x) { x.classList.remove('sel'); });
      if (i !== depuis) onMove(depuis, i);
    }
    host.addEventListener('click', function (e) {
      var i = index(e.target);
      if (i >= 0) choisir(i);
    });
    host.addEventListener('keydown', function (e) {
      var i = index(e.target);
      if ((e.key === 'Enter' || e.key === ' ') && i >= 0 && e.target.classList.contains('day')) { e.preventDefault(); choisir(i); }
    });
    /* Après un redessin, plus rien n'est sélectionné */
    return { reset: function () { selected = -1; drag = null; } };
  };
})();
