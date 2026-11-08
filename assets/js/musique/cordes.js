/* Cordes à balayer : un instrument virtuel fait uniquement de lignes (guitare, basse…).
   Expose Musique.StringPad. Dépend de musique/core.js.

   Par défaut : cordes horizontales, la grave en haut, l'aiguë en bas, comme un instrument vu par le musicien. Balayer le
   doigt (ou la souris) en travers des lignes les joue, dans l'ordre où elles sont croisées ; toucher une ligne la pince.
   Deux réglages la retournent comme on veut : l'orientation (horizontale ou verticale) et le côté de la corde grave.
   Le dessin prend toute la largeur du cadre. Les réglages sont gardés dans le navigateur.

   Musique.StringPad.mount(container, opts) -> { render, strum }
   opts : id (clé de sauvegarde), title, strings (nombre de cordes), fret(s) -> case jouée sur la corde s (−1 : corde muette),
          label(s) -> nom de la note affiché, sound(s, fret, volume, délai en secondes) joue la corde,
          side (facultatif) : élément posé contre le début du manche (à gauche en horizontal, au-dessus en vertical),
          inputs (facultatif) : élément ajouté aux réglages au-dessus du dessin,
          neck() (facultatif) -> doigté { frets, base, barre } dessiné sur le début du manche, ou null pour les cordes à vide,
          fretting (facultatif) : manche jouable du doigt, { active(), momentary(), sound(), base(), shift(±1), set(corde, case), release(corde) } ;
          quand active(), les cases sont une grille où l'on touche pour poser un doigt, avec deux flèches pour avancer sur le
          manche. momentary() : le doigt ne tient la corde que pendant l'appui (release est alors appelé au relâchement).
          sound() : poser un doigt fait sonner la note (utile à la souris, qui n'a qu'un pointeur) ; sinon c'est le grattage qui joue. */
(function () {
  'use strict';

  var M = window.Musique, el = M.el, sv = M.sv, clamp = M.clamp;
  var P = M.StringPad = {};
  var VH_H = 300, VH_V = 340; // hauteur du dessin selon l'orientation (la largeur suit l'écran)
  /* Taille du manche : nombre de cases dessinées sous les cordes (à partir du sillet ou de la case `base`) et largeur maximale d'une case */
  var SIZES = [{ id: 's', name: 'Petit', frets: 4, fw: 30 }, { id: 'm', name: 'Moyen', frets: 5, fw: 40 }, { id: 'l', name: 'Grand', frets: 6, fw: 54 }];

  P.mount = function (container, opts) {
    var n = opts.strings, key = 'tools:' + opts.id + ':virtuelle';
    var vg = { vert: false, flip: false, paths: [], vib: [], raf: 0, w: 600, h: VH_H }, ptr = null, i;
    var order0 = [];
    for (i = 0; i < n; i++) { vg.vib.push(null); order0.push(i); }
    var saved = M.store.get(key, null);
    vg.size = 'm';
    if (saved) { vg.vert = saved.vert === true; vg.flip = saved.flip === true; if (saved.size === 's' || saved.size === 'l') vg.size = saved.size; }
    function size() { return SIZES.filter(function (z) { return z.id === vg.size; })[0]; }

    /* ----- Construction ----- */
    var card = el('div', 'card vg-card'), inputs = el('div', 'inputs'), vgBox = el('div', 'vg'), actions = el('div', 'actions vg-actions');
    var prefs = el('details', 'vg-prefs'), prefsIn = el('div', 'inputs');
    var svg = sv('svg', { viewBox: '0 0 600 ' + VH_H, tabindex: '0', role: 'group', 'aria-label': (opts.title || 'Instrument virtuel') + ' : ' + n + ' cordes à gratter' });
    var idOr = M.uid('vgo'), idFl = M.uid('vgf');
    var fOr = el('div', 'field small'), fFl = el('div', 'field small'), orSeg = el('div', 'seg'), flSeg = el('div', 'seg');
    var bDown = el('button', 'btn'), bUp = el('button', 'btn ghost');

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
    if (opts.inputs) inputs.appendChild(opts.inputs);
    prefsIn.appendChild(fOr); prefsIn.appendChild(fFl);
    var fZ = el('div', 'field small'), zSeg = el('div', 'seg'), idZ = M.uid('vgz'), lZ = el('span', 'lab', 'Taille du manche');
    lZ.id = idZ;
    seg(zSeg, idZ, SIZES.map(function (z) { return [z.id, z.name]; }), 'data-z');
    fZ.appendChild(lZ); fZ.appendChild(zSeg);
    if (opts.neck) prefsIn.appendChild(fZ);
    bDown.type = bUp.type = 'button';
    actions.appendChild(bDown); actions.appendChild(bUp);
    if (opts.side) vgBox.appendChild(opts.side);
    vgBox.appendChild(svg);
    prefs.appendChild(el('summary', '', 'Affichage'));
    prefs.appendChild(prefsIn);
    if (opts.inputs) card.appendChild(inputs);
    card.appendChild(vgBox); card.appendChild(actions); card.appendChild(prefs);
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

    /* Début du manche : les cases de la taille choisie sous les cordes, avec le doigté posé (opts.neck). Il suit l'orientation : le sillet
       est du côté de a0() et les cases s'éloignent le long des cordes. Les positions sont données en (al, cr) : `al` le long
       des cordes, `cr` en travers. */
    function neckGeo() {
      var z = size(), fw = clamp(Math.round((a1() - a0()) * 0.6 / z.frets), 22, z.fw), lo = cross(0), hi = cross(n - 1);
      return { a: a0(), fw: fw, frets: z.frets, len: fw * z.frets, c0: Math.min(lo, hi) - 12, c1: Math.max(lo, hi) + 12, nav: Math.min(lo, hi) - 28 };
    }
    function xy(al, cr) { return vg.vert ? { x: cr, y: al } : { x: al, y: cr }; }
    function navAl(g, dir) { return g.a + g.len * (dir < 0 ? 0.2 : 0.8); } // position des flèches « reculer » et « avancer »

    /* Fond de touche : distingue la zone des cases (main gauche) de celle du grattage (main droite) */
    function drawBoard() {
      var g = neckGeo(), p = xy(g.a, g.c0), q = xy(g.a + g.len, g.c1);
      svg.appendChild(sv('rect', { x: Math.min(p.x, q.x), y: Math.min(p.y, q.y), width: Math.abs(q.x - p.x), height: Math.abs(q.y - p.y), rx: 6 }, 'vg-board'));
    }

    function drawNeck() {
      var ch = opts.neck(), fr = !!(opts.fretting && opts.fretting.active()), base = fr ? opts.fretting.base() : ch ? ch.base : 1;
      var g = neckGeo(), a = g.a, k, f, s, e, t, b, node, r = fr ? 7.5 : 6.5, mid = (cross(0) + cross(n - 1)) / 2, gap = Math.abs(cross(1) - cross(0));
      function line(al, cls) { // un trait en travers du manche
        var p = xy(al, g.c0), q = xy(al, g.c1);
        return sv('line', { x1: p.x, y1: p.y, x2: q.x, y2: q.y }, cls);
      }
      function dot(al, cr, rad, cls) { var p = xy(al, cr); return sv('circle', { cx: p.x, cy: p.y, r: rad }, cls); }
      var grp = sv('g', { 'pointer-events': 'none' });
      for (k = 1; k <= g.frets; k++) grp.appendChild(line(a + k * g.fw, 'vg-fret'));
      grp.appendChild(line(a, base === 1 ? 'vg-nut' : 'vg-fret'));
      if (fr) {
        for (k = 0; k < g.frets; k++) { // repères du manche et numéro de chaque case
          f = base + k;
          if (f === 3 || f === 5 || f === 7 || f === 9) grp.appendChild(dot(a + (k + 0.5) * g.fw, mid, 4, 'vg-inlay'));
          if (f === 12) { grp.appendChild(dot(a + (k + 0.5) * g.fw, mid - gap, 4, 'vg-inlay')); grp.appendChild(dot(a + (k + 0.5) * g.fw, mid + gap, 4, 'vg-inlay')); }
          p = xy(a + (k + 0.5) * g.fw, g.c1 + 12);
          t = sv('text', { x: p.x, y: p.y }, 'vg-s');
          t.textContent = String(f);
          grp.appendChild(t);
        }
        [-1, 1].forEach(function (dir) { // deux flèches pour avancer ou reculer sur le manche
          var al = navAl(g, dir), tip = xy(al + dir * 5, g.nav), p1 = xy(al - dir * 4, g.nav - 5), p2 = xy(al - dir * 4, g.nav + 5);
          grp.appendChild(dot(al, g.nav, 11, 'vg-nav'));
          grp.appendChild(sv('path', { d: 'M' + tip.x + ' ' + tip.y + 'L' + p1.x + ' ' + p1.y + 'L' + p2.x + ' ' + p2.y + 'Z' }, 'vg-arrow'));
        });
        var pm = xy(a + g.len / 2, g.nav);
        t = sv('text', { x: pm.x, y: pm.y }, 'vg-s vg-range');
        t.textContent = base + '–' + (base + g.frets - 1);
        grp.appendChild(t);
      } else if (base > 1) {
        var p = xy(a + g.fw / 2, g.c0 - (vg.vert ? 4 : 8));
        t = sv('text', { x: p.x, y: p.y }, 'vg-s');
        t.textContent = base + 'fr';
        grp.appendChild(t);
      }
      if (ch) {
        b = ch.barre;
        if (b && b.fret - base < g.frets) {
          var p0 = Math.min(cross(b.from), cross(b.to)) - r, p1 = Math.max(cross(b.from), cross(b.to)) + r, al = a + (b.fret - base + 0.5) * g.fw;
          grp.appendChild(sv('rect', vg.vert
            ? { x: p0, y: al - r, width: p1 - p0, height: 2 * r, rx: r }
            : { x: al - r, y: p0, width: 2 * r, height: p1 - p0, rx: r }, 'vg-dot'));
        }
        for (s = 0; s < n; s++) {
          f = ch.frets[s];
          if (f <= 0 || f < base || f - base >= g.frets || (b && f === b.fret && s >= b.from && s <= b.to)) continue;
          grp.appendChild(dot(a + (f - base + 0.5) * g.fw, cross(s), r, 'vg-dot'));
        }
      }
      svg.appendChild(grp);
    }

    /* Manche jouable : un appui sur une case pose le doigt sur cette corde (le même appui le relève), un appui juste avant
       le sillet la remet à vide, les flèches font avancer la fenêtre de cases. Renvoie vrai si l'appui a été pris en charge. */
    /* Case de la grille sous le point `p`, { s, f } (f = 0 avant le sillet), ou null hors de la grille */
    function cellAt(p) {
      var g = neckGeo(), s, k = -1, best = 1e9, d;
      if (p.a < g.a - 16 || p.a > g.a + g.len || p.c < g.c0 || p.c > g.c1) return null;
      for (s = 0; s < n; s++) { d = Math.abs(p.c - cross(s)); if (d < best) { best = d; k = s; } }
      return { s: k, f: p.a < g.a ? 0 : opts.fretting.base() + Math.floor((p.a - g.a) / g.fw) };
    }
    /* Mode « touché » : le doigt ne tient la corde que pendant l'appui, et on peut le glisser d'une case à l'autre.
       fingers : pointeur -> corde qu'il tient. */
    var fingers = {};
    function touchNeck(p, e) {
      var g = neckGeo(), cell, dir;
      if (!(opts.fretting && opts.fretting.active())) return false;
      for (dir = -1; dir <= 1; dir += 2) {
        if (Math.abs(p.c - g.nav) < 16 && Math.abs(p.a - navAl(g, dir)) < 16) { opts.fretting.shift(dir); render(); return true; }
      }
      cell = cellAt(p);
      if (!cell) return false;
      opts.fretting.set(cell.s, cell.f);
      render();
      if (opts.fretting.momentary()) { // touché : le doigt tient la corde tant qu'on appuie. Dans les deux modes, poser un doigt est silencieux : c'est le grattage qui joue
        fingers[e.pointerId] = cell;
        try { svg.setPointerCapture(e.pointerId); } catch (err) { /* capture indisponible */ }
      }
      if (opts.fretting.sound()) pluckString(cell.s, 0.8, 0);
      return true;
    }
    function slideNeck(p, e) {
      var cell = cellAt(p), cur = fingers[e.pointerId];
      if (!cell || (cell.s === cur.s && cell.f === cur.f)) return;
      opts.fretting.release(cur.s);
      opts.fretting.set(cell.s, cell.f);
      fingers[e.pointerId] = cell;
      render();
      if (opts.fretting.sound()) pluckString(cell.s, 0.8, 0);
    }
    function liftNeck(e) {
      var cur = fingers[e.pointerId];
      if (!cur) return false;
      delete fingers[e.pointerId];
      opts.fretting.release(cur.s);
      render();
      return true;
    }

    function render() {
      var s, c, off, t, p, nm;
      vg.w = Math.max(280, Math.round(svg.clientWidth || 600));
      vg.h = vg.vert ? VH_V : VH_H;
      svg.style.height = vg.h + 'px';
      svg.setAttribute('viewBox', '0 0 ' + vg.w + ' ' + vg.h);
      svg.replaceChildren();
      vg.paths = [];
      vg.names = [];
      if (opts.neck) drawBoard();
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
        vg.names.push(nm);
      }
      if (opts.neck) drawNeck();
    }

    function syncUi() {
      M.setPressed(orSeg.querySelectorAll('button'), function (b) { return (b.getAttribute('data-o') === 'v') === vg.vert; });
      M.setPressed(flSeg.querySelectorAll('button'), function (b) { return (b.getAttribute('data-f') === 'end') === vg.flip; });
      vgBox.classList.toggle('vert', vg.vert);
      flSeg.children[0].textContent = vg.vert ? 'À gauche' : 'En haut';
      flSeg.children[1].textContent = vg.vert ? 'À droite' : 'En bas';
      bDown.textContent = vg.vert ? 'Gratter vers la droite →' : 'Gratter vers le bas ↓';
      bUp.textContent = vg.vert ? 'Gratter vers la gauche ←' : 'Gratter vers le haut ↑';
      render();
      M.setPressed(zSeg.querySelectorAll('button'), function (b) { return b.getAttribute('data-z') === vg.size; });
      M.store.set(key, { vert: vg.vert, flip: vg.flip, size: vg.size });
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
    /* Le nom de la note s'éclaire un instant quand la corde sonne */
    function flash(s, delay) {
      setTimeout(function () {
        var t = vg.names[s];
        if (!t) return;
        t.classList.add('hit');
        clearTimeout(t.hitTimer);
        t.hitTimer = setTimeout(function () { t.classList.remove('hit'); }, 260);
      }, delay * 1000);
    }
    function pluckString(s, vol, delay) {
      var f = opts.fret(s);
      if (f < 0) return;
      opts.sound(s, f, vol, delay || 0);
      flash(s, delay || 0);
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

    /* Position du doigt : « a » le long des cordes, « c » en travers */
    function pos(e) {
      var r = svg.getBoundingClientRect();
      return vg.vert ? { a: (e.clientY - r.top) * vg.h / r.height, c: (e.clientX - r.left) * vg.w / r.width } : { a: (e.clientX - r.left) * vg.w / r.width, c: (e.clientY - r.top) * vg.h / r.height };
    }
    /* Quand le manche est jouable, la zone des notes (noms, sillet et cases) ne sonne jamais : seul le reste des cordes se gratte */
    function silent(a) {
      var g;
      if (!(opts.fretting && opts.fretting.active())) return false;
      g = neckGeo();
      return a < g.a + g.len || a > a1();
    }
    svg.addEventListener('pointerdown', function (e) {
      var x = point(e), near = -1, best = 18, s, p = pos(e);
      if (touchNeck(p, e)) {
        svg.focus({ preventScroll: true });
        return;
      }
      if (silent(p.a)) { svg.focus({ preventScroll: true }); return; }
      ptr = { id: e.pointerId, x: x, t: e.timeStamp, skip: -1 };
      try { svg.setPointerCapture(e.pointerId); } catch (err) { /* capture indisponible */ }
      for (s = 0; s < n; s++) if (Math.abs(x - cross(s)) < best) { best = Math.abs(x - cross(s)); near = s; }
      if (near >= 0) { pluckString(near, 0.8, 0); ptr.skip = near; } // toucher une ligne la pince
      svg.focus({ preventScroll: true });
    });
    svg.addEventListener('pointermove', function (e) {
      if (fingers[e.pointerId]) { slideNeck(pos(e), e); return; }
      if (!ptr || e.pointerId !== ptr.id) return;
      var x = point(e), prev = ptr.x, dt = Math.max(1, e.timeStamp - ptr.t), vol, s, c, k = 0, hit, o = order(), j;
      if (silent(pos(e).a)) { ptr.x = x; ptr.t = e.timeStamp; return; } // le doigt passe sur la zone des notes : rien ne sonne
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
    function end(e) {
      if (liftNeck(e)) return;
      if (ptr && e.pointerId === ptr.id) ptr = null;
    }
    svg.addEventListener('contextmenu', function (e) { e.preventDefault(); }); // l'appui long ne doit ni sélectionner ni ouvrir de menu
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
    zSeg.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { vg.size = b.getAttribute('data-z'); syncUi(); } });
    flSeg.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { vg.flip = b.getAttribute('data-f') === 'end'; syncUi(); } });
    /* Le dessin prend toute la largeur du cadre : on le refait quand cette largeur change (écran, rotation, onglet affiché) */
    function refit() { if (svg.clientWidth && Math.round(svg.clientWidth) !== vg.w) render(); }
    if (window.ResizeObserver) new ResizeObserver(refit).observe(svg);
    else window.addEventListener('resize', refit);

    syncUi();
    /* Dernière case de départ de la fenêtre du manche : on voit toujours jusqu'à la case 12 */
    function maxBase() { return 12 - size().frets + 1; }
    return { render: render, strum: strum, pluck: pluckString, maxBase: maxBase };
  };
})();
