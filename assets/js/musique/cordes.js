/* Cordes à balayer : un instrument virtuel fait uniquement de lignes (guitare, basse…).
   Expose Musique.StringPad. Dépend de musique/core.js.

   Par défaut : cordes horizontales, la grave en haut, l'aiguë en bas, comme un instrument vu par le musicien. Balayer le
   doigt (ou la souris) en travers des lignes les joue, dans l'ordre où elles sont croisées ; toucher une ligne la pince.
   Deux réglages la retournent comme on veut : l'orientation (horizontale ou verticale) et le côté de la corde grave.
   Le dessin prend toute la largeur du cadre. Les réglages sont gardés dans le navigateur.

   Musique.StringPad.mount(container, opts) -> { render, strum }
   opts : id (clé de sauvegarde), title, strings (nombre de cordes), fret(s) -> case jouée sur la corde s (−1 : corde muette),
          label(s) -> nom de la note affiché, sound(s, fret, volume, délai en secondes) joue la corde. */
(function () {
  'use strict';

  var M = window.Musique, el = M.el, sv = M.sv, clamp = M.clamp;
  var P = M.StringPad = {};
  var VH_H = 300, VH_V = 340; // hauteur du dessin selon l'orientation (la largeur suit l'écran)

  P.mount = function (container, opts) {
    var n = opts.strings, key = 'tools:' + opts.id + ':virtuelle';
    var vg = { vert: false, flip: false, paths: [], vib: [], raf: 0, w: 600, h: VH_H }, ptr = null, i;
    var order0 = [];
    for (i = 0; i < n; i++) { vg.vib.push(null); order0.push(i); }
    var saved = M.store.get(key, null);
    if (saved) { vg.vert = saved.vert === true; vg.flip = saved.flip === true; }

    /* ----- Construction ----- */
    var card = el('div', 'card'), inputs = el('div', 'inputs'), vgBox = el('div', 'vg'), actions = el('div', 'actions');
    var svg = sv('svg', { viewBox: '0 0 600 ' + VH_H, tabindex: '0', role: 'group', 'aria-label': n + ' cordes à gratter' });
    var idOr = M.uid('vgo'), idFl = M.uid('vgf');
    var fOr = el('div', 'field small'), fFl = el('div', 'field small'), orSeg = el('div', 'seg'), flSeg = el('div', 'seg');
    var bDown = el('button', 'btn'), bUp = el('button', 'btn ghost');

    card.appendChild(el('h2', '', opts.title || 'Instrument virtuel'));
    card.appendChild(el('p', 'muted', 'Glissez le doigt (ou la souris) en travers des lignes pour gratter, dans un sens ou dans l’autre, ou touchez une ligne pour la pincer. Choisissez de quoi poser la main gauche. Par défaut, c’est vu par le musicien (corde grave en haut) ; retournez-le comme vous voulez avec les deux réglages. Au clavier : 1 à ' + n + ' pincent une corde (1 = la plus aiguë), les flèches grattent.'));
    function seg(host, id, items, attr) {
      host.setAttribute('role', 'group'); host.setAttribute('aria-labelledby', id);
      items.forEach(function (it) { var b = el('button', '', it[1]); b.type = 'button'; b.setAttribute(attr, it[0]); host.appendChild(b); });
    }
    var lOr = el('span', 'lab', 'Orientation'); lOr.id = idOr;
    seg(orSeg, idOr, [['h', 'Horizontale'], ['v', 'Verticale']], 'data-o');
    fOr.appendChild(lOr); fOr.appendChild(orSeg);
    var lFl = el('span', 'lab', 'Corde grave'); lFl.id = idFl;
    seg(flSeg, idFl, [['start', 'En haut'], ['end', 'En bas']], 'data-f');
    fFl.appendChild(lFl); fFl.appendChild(flSeg);
    inputs.appendChild(fOr); inputs.appendChild(fFl);
    bDown.type = bUp.type = 'button';
    actions.appendChild(bDown); actions.appendChild(bUp);
    vgBox.appendChild(svg);
    card.appendChild(inputs); card.appendChild(vgBox); card.appendChild(actions);
    container.appendChild(card);

    /* ----- Géométrie ----- */
    var spacing = Math.min(60, (VH_H - 80) / Math.max(1, n - 1)); // l'écart des cordes en horizontal
    /* Position de la corde s (0 = grave) sur l'axe qui traverse les cordes : y si horizontale, x si verticale */
    function cross(s) {
      var k = vg.flip ? n - 1 - s : s;
      return vg.vert ? 50 + k * (vg.w - 100) / (n - 1) : (VH_H - spacing * (n - 1)) / 2 + k * spacing;
    }
    function a0() { return vg.vert ? 40 : 56; }
    function a1() { return vg.vert ? vg.h - 50 : vg.w - 44; }
    /* Cordes dans l'ordre où elles se présentent quand on balaie dans le sens des positions croissantes */
    function order() { var o = order0.slice(); return vg.flip ? o.reverse() : o; }
    function width(s) { return 3.6 - s * (2.5 / (n - 1)); }
    /* Tracé d'une corde ; `bend` : décalage du milieu pendant la vibration (0 = droite) */
    function path(s, bend) {
      var c = cross(s), s0 = a0(), s1 = a1(), m = (s0 + s1) / 2;
      return vg.vert
        ? 'M' + c + ' ' + s0 + ' Q' + (c + bend) + ' ' + m + ' ' + c + ' ' + s1
        : 'M' + s0 + ' ' + c + ' Q' + m + ' ' + (c + bend) + ' ' + s1 + ' ' + c;
    }

    function render() {
      var s, c, off, t, p, nm;
      vg.w = Math.max(280, Math.round(svg.clientWidth || 600));
      vg.h = vg.vert ? VH_V : VH_H;
      svg.style.height = vg.h + 'px';
      svg.setAttribute('viewBox', '0 0 ' + vg.w + ' ' + vg.h);
      svg.replaceChildren();
      vg.paths = [];
      for (s = 0; s < n; s++) {
        c = cross(s);
        off = opts.fret(s) < 0;
        t = sv('text', vg.vert ? { x: c, y: 18 } : { x: vg.w - 18, y: c }, 'vg-s');
        t.textContent = String(n - s);
        svg.appendChild(t);
        p = sv('path', { d: path(s, 0), 'stroke-width': width(s) }, 'vg-str' + (off ? ' off' : ''));
        svg.appendChild(p);
        vg.paths.push(p);
        nm = sv('text', vg.vert ? { x: c, y: vg.h - 20 } : { x: 26, y: c }, 'vg-n' + (off ? ' off' : ''));
        nm.textContent = off ? '×' : (opts.label(s) || '·');
        svg.appendChild(nm);
      }
    }

    function syncUi() {
      M.setPressed(orSeg.querySelectorAll('button'), function (b) { return (b.getAttribute('data-o') === 'v') === vg.vert; });
      M.setPressed(flSeg.querySelectorAll('button'), function (b) { return (b.getAttribute('data-f') === 'end') === vg.flip; });
      flSeg.children[0].textContent = vg.vert ? 'À gauche' : 'En haut';
      flSeg.children[1].textContent = vg.vert ? 'À droite' : 'En bas';
      bDown.textContent = vg.vert ? 'Gratter vers la droite →' : 'Gratter vers le bas ↓';
      bUp.textContent = vg.vert ? 'Gratter vers la gauche ←' : 'Gratter vers le haut ↑';
      render();
      M.store.set(key, { vert: vg.vert, flip: vg.flip });
    }

    /* ----- Vibration à l'écran ----- */
    function frame(now) {
      var alive = false, s, v, dt, a;
      for (s = 0; s < n; s++) {
        v = vg.vib[s];
        if (!v) continue;
        dt = (now - v.t0) / 1000;
        if (dt < 0) { alive = true; continue; }
        a = v.a * Math.exp(-dt * 3.2);
        if (a < 0.15) { vg.vib[s] = null; vg.paths[s].setAttribute('d', path(s, 0)); continue; }
        alive = true;
        vg.paths[s].setAttribute('d', path(s, 2 * a * Math.sin(dt * 2 * Math.PI * (11 + s))));
      }
      vg.raf = alive ? requestAnimationFrame(frame) : 0;
    }

    /* ----- Jeu ----- */
    function pluckString(s, vol, delay) {
      var f = opts.fret(s);
      if (f < 0) return;
      opts.sound(s, f, vol, delay || 0);
      vg.vib[s] = { t0: performance.now() + (delay || 0) * 1000, a: 10 * vol };
      if (!vg.raf) vg.raf = requestAnimationFrame(frame);
    }
    /* `forward` : dans le sens des positions croissantes à l'écran (vers le bas ou vers la droite) */
    function strum(forward, vol) {
      var o = order(), k = 0;
      if (!forward) o.reverse();
      o.forEach(function (s) { if (opts.fret(s) >= 0) pluckString(s, vol, (k++) * 0.022); });
    }
    /* Position du doigt sur l'axe qui traverse les cordes, dans les unités du dessin */
    function point(e) {
      var r = svg.getBoundingClientRect();
      return vg.vert ? (e.clientX - r.left) * vg.w / r.width : (e.clientY - r.top) * vg.h / r.height;
    }

    svg.addEventListener('pointerdown', function (e) {
      var x = point(e), near = -1, best = 18, s;
      ptr = { id: e.pointerId, x: x, t: e.timeStamp, skip: -1 };
      try { svg.setPointerCapture(e.pointerId); } catch (err) { /* capture indisponible */ }
      for (s = 0; s < n; s++) if (Math.abs(x - cross(s)) < best) { best = Math.abs(x - cross(s)); near = s; }
      if (near >= 0) { pluckString(near, 0.8, 0); ptr.skip = near; } // toucher une ligne la pince
      svg.focus({ preventScroll: true });
    });
    svg.addEventListener('pointermove', function (e) {
      if (!ptr || e.pointerId !== ptr.id) return;
      var x = point(e), prev = ptr.x, dt = Math.max(1, e.timeStamp - ptr.t), vol, s, c, k = 0, hit, o = order(), j;
      if (x === prev) return;
      vol = clamp(0.45 + Math.abs(x - prev) / dt * 0.25, 0.45, 1.1); // plus on balaie vite, plus ça sonne fort
      if (x < prev) o.reverse(); // on joue les cordes dans l'ordre où le doigt les croise
      for (j = 0; j < n; j++) {
        s = o[j];
        c = cross(s);
        hit = (prev < c && c <= x) || (x <= c && c < prev);
        if (!hit) continue;
        if (s === ptr.skip) { ptr.skip = -1; continue; } // déjà pincée au toucher
        pluckString(s, vol, (k++) * 0.008);
      }
      ptr.x = x;
      ptr.t = e.timeStamp;
    });
    function end(e) { if (ptr && e.pointerId === ptr.id) ptr = null; }
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
    svg.addEventListener('keydown', function (e) {
      var d = e.key.length === 1 ? e.key.charCodeAt(0) - 48 : 0;
      if (d >= 1 && d <= n) { pluckString(n - d, 0.85, 0); return; }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); strum(true, 0.9); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); strum(false, 0.8); }
    });
    bDown.addEventListener('click', function () { strum(true, 0.9); });
    bUp.addEventListener('click', function () { strum(false, 0.8); });
    orSeg.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { vg.vert = b.getAttribute('data-o') === 'v'; syncUi(); } });
    flSeg.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { vg.flip = b.getAttribute('data-f') === 'end'; syncUi(); } });
    /* Le dessin prend toute la largeur du cadre : on le refait quand cette largeur change (écran, rotation, onglet affiché) */
    function refit() { if (svg.clientWidth && Math.round(svg.clientWidth) !== vg.w) render(); }
    if (window.ResizeObserver) new ResizeObserver(refit).observe(svg);
    else window.addEventListener('resize', refit);

    syncUi();
    return { render: render, strum: strum, pluck: pluckString };
  };
})();
