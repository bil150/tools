/* Écriture à la main : lettres arabes et signes de voyelle (harakat) sur des lignes de guidage.
   Deux canevas superposés : « guide » (lignes et modèle) et « ink » (le tracé de l'utilisateur).
   Le tracé est conservé en coordonnées relatives, il suit donc le redimensionnement de la page.
   Pour l'impression et l'enregistrement, tout est redessiné avec une palette claire. */
(function () {
  'use strict';

  var A = window.Arabe;
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- Signes de voyelle ---------- */
  var MARKS = [
    { id: 'none', name: 'Aucun', s: '', help: '' },
    { id: 'fatha', name: 'Fatha — a', s: A.F, help: 'Fatha : petit trait incliné, écrit au-dessus de la lettre.' },
    { id: 'damma', name: 'Damma — ou', s: A.D, help: 'Damma : petit « و » écrit au-dessus de la lettre.' },
    { id: 'kasra', name: 'Kasra — i', s: A.K, help: 'Kasra : petit trait incliné, écrit sous la lettre, juste sous la ligne d’écriture.' },
    { id: 'tfatha', name: 'Tanwîn fatha — an', s: A.FT, help: 'Tanwîn fatha : deux petits traits inclinés au-dessus de la lettre.' },
    { id: 'tdamma', name: 'Tanwîn damma — oun', s: A.DT, help: 'Tanwîn damma : deux dammas, l’une près de l’autre, au-dessus de la lettre.' },
    { id: 'tkasra', name: 'Tanwîn kasra — in', s: A.KT, help: 'Tanwîn kasra : deux petits traits inclinés sous la lettre.' },
    { id: 'sukun', name: 'Soukoun — sans voyelle', s: A.SU, help: 'Soukoun : petit cercle ouvert au-dessus de la lettre.' },
    { id: 'shadda', name: 'Chadda — lettre doublée', s: A.SH, help: 'Chadda : petit « ش » sans points, au-dessus de la lettre.' },
    { id: 'shadda-f', name: 'Chadda + fatha', s: A.SH + A.F, help: 'Chadda au-dessus de la lettre, puis la fatha juste au-dessus de la chadda.' },
    { id: 'shadda-d', name: 'Chadda + damma', s: A.SH + A.D, help: 'Chadda au-dessus de la lettre, puis la damma juste au-dessus de la chadda.' },
    { id: 'shadda-k', name: 'Chadda + kasra', s: A.SH + A.K, help: 'Chadda au-dessus de la lettre ; la kasra se place sous la lettre.' }
  ];
  var FORMS = { iso: 'Isolée', ini: 'Initiale', med: 'Médiane', fin: 'Finale' };

  /* ---------- Palettes (canevas : pas de light-dark(), on résout les couleurs ici) ---------- */
  var PALETTES = {
    light: { ink: '#14213D', soft: '#C4CAD6', mid: '#8A94A8', base: '#5F6980', model: '#14213D', blue: '#1D4ED8', red: '#C8372D', paper: '#FFFFFF' },
    dark: { ink: '#E8ECF4', soft: '#2F3A4D', mid: '#4A566C', base: '#8794AB', model: '#E8ECF4', blue: '#7DA2FF', red: '#FF8A80', paper: '#171E2B' }
  };

  var state = {
    letter: 1, form: 'iso', mark: 'none', free: '',
    size: 80, rows: 4, model: 'gray', every: 'first', pen: 5, color: 'ink',
    strokes: [], drawing: null, printing: false
  };

  var guide = $('guide'), ink = $('ink'), stack = $('stack');
  var gctx = guide.getContext('2d'), ictx = ink.getContext('2d');
  var W = 0, H = 0, rowH = 0, dpr = 1;

  function palette() {
    if (state.printing) return PALETTES.light;
    var t = document.documentElement.getAttribute('data-theme');
    var dark = t ? t === 'dark' : (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    return dark ? PALETTES.dark : PALETTES.light;
  }
  function family() {
    var f = getComputedStyle(document.documentElement).getPropertyValue('--ar').trim();
    return f || '"Noto Naskh Arabic", serif';
  }

  /* ---------- Texte à écrire ---------- */
  function glyphText() {
    if (state.free.trim()) return state.free.trim();
    var l = A.ALPHA[state.letter], m = MARKS.filter(function (x) { return x.id === state.mark; })[0];
    var base = m.s ? l.ch : l.disp, s = base + m.s;
    if (state.form === 'ini') return s + A.ZWJ;
    if (state.form === 'med') return A.ZWJ + s + A.ZWJ;
    if (state.form === 'fin') return A.ZWJ + s;
    return s;
  }

  function renderInfo() {
    var box = $('info'), l = A.ALPHA[state.letter], m = MARKS.filter(function (x) { return x.id === state.mark; })[0];
    box.innerHTML = '';
    function line(text, cls) { var p = A.h('p', cls, text); box.appendChild(p); }
    if (state.free.trim()) {
      line('Mot saisi. Les signes de voyelle du mot sont écrits par-dessus, comme dans votre texte.');
      return;
    }
    var pts = l.dots[0] === 0 ? 'aucun point' : l.dots[0] + (l.dots[0] > 1 ? ' points ' : ' point ') + (l.dots[1] === 'dessus' ? 'au-dessus' : 'en dessous') + ' de la lettre';
    line(l.disp + ' — ' + l.n + ' · son : ' + l.tr + ' · ' + pts + '.');
    if (state.form !== 'iso' && l.nj) line('Cette lettre ne se lie pas à la lettre suivante : sa forme ne change pas dans le mot.', 'muted');
    if (m.help) line(m.help);
  }

  /* ---------- Géométrie ---------- */
  function metrics() {
    gctx.font = state.size + 'px ' + family();
    gctx.direction = 'rtl';
    var asc = gctx.measureText('ا').actualBoundingBoxAscent || state.size * 0.75;
    var desc = gctx.measureText('ج').actualBoundingBoxDescent || state.size * 0.45;
    var body = gctx.measureText('س').actualBoundingBoxAscent || state.size * 0.4;
    var marks = state.size * 0.42;
    var yBase = marks + asc + state.size * 0.1;
    return { asc: asc, desc: desc, body: body, marks: marks, yBase: yBase, rowH: yBase + desc + state.size * 0.24 };
  }

  function resize() {
    dpr = window.devicePixelRatio || 1;
    var oldW = W;
    W = Math.max(280, Math.floor(stack.clientWidth));
    var m = metrics();
    rowH = m.rowH;
    H = Math.ceil(rowH * state.rows);
    [guide, ink].forEach(function (c) {
      c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
      c.style.width = W + 'px'; c.style.height = H + 'px';
    });
    gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ictx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return oldW;
  }

  /* ---------- Dessin des guides ---------- */
  function line(ctx, y, dash, color, width) {
    ctx.save();
    ctx.setLineDash(dash);
    ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke();
    ctx.restore();
  }

  function drawGuide() {
    var p = palette(), m = metrics(), text = glyphText(), r;
    gctx.clearRect(0, 0, W, H);
    gctx.fillStyle = p.paper; gctx.fillRect(0, 0, W, H);

    for (r = 0; r < state.rows; r++) {
      var y0 = r * rowH, yb = y0 + m.yBase;
      line(gctx, y0 + m.yBase - m.asc - m.marks, [6, 5], p.soft, 1);   // signes du dessus
      line(gctx, yb - m.asc, [2, 4], p.mid, 1);                        // lettres hautes
      line(gctx, yb - m.body, [2, 4], p.mid, 1);                       // corps
      line(gctx, yb, [], p.base, 1.6);                                 // ligne d'écriture
      line(gctx, yb + m.desc, [2, 4], p.mid, 1);                       // lettres qui descendent
      if (r < state.rows - 1) line(gctx, y0 + rowH - 1, [], p.soft, 1);

      if (state.model === 'none' || (state.every === 'first' && r > 0)) continue;
      gctx.save();
      gctx.font = state.size + 'px ' + family();
      gctx.direction = 'rtl'; gctx.textAlign = 'right'; gctx.textBaseline = 'alphabetic';
      var w = gctx.measureText(text).width, gap = state.size * 0.5, pad = 14;
      for (var x = W - pad; x - w > 0; x -= w + gap) {
        if (state.model === 'gray') {
          gctx.globalAlpha = 0.22; gctx.fillStyle = p.model; gctx.fillText(text, x, yb);
        } else {
          gctx.setLineDash([2, 4]); gctx.lineWidth = 1.4; gctx.strokeStyle = p.model; gctx.strokeText(text, x, yb);
        }
        if (w + gap <= 0) break;
      }
      gctx.restore();
    }
  }

  /* ---------- Tracé ---------- */
  function strokeColor(key) { return palette()[key === 'ink' ? 'ink' : key]; }

  function drawStroke(s) {
    var pts = s.pts.map(function (q) { return [q[0] * W, q[1]]; });
    ictx.save();
    ictx.lineCap = 'round'; ictx.lineJoin = 'round';
    ictx.strokeStyle = strokeColor(s.c); ictx.fillStyle = strokeColor(s.c);
    ictx.lineWidth = s.w;
    if (pts.length === 1) {
      ictx.beginPath(); ictx.arc(pts[0][0], pts[0][1], s.w / 2, 0, Math.PI * 2); ictx.fill();
    } else {
      ictx.beginPath(); ictx.moveTo(pts[0][0], pts[0][1]);
      for (var i = 1; i < pts.length - 1; i++) {
        ictx.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
      }
      var last = pts[pts.length - 1];
      ictx.lineTo(last[0], last[1]);
      ictx.stroke();
    }
    ictx.restore();
  }
  function drawInk() {
    ictx.clearRect(0, 0, W, H);
    state.strokes.forEach(drawStroke);
    if (state.drawing) drawStroke(state.drawing);
  }

  function point(e) {
    var rect = ink.getBoundingClientRect();
    return [(e.clientX - rect.left) / rect.width, e.clientY - rect.top];
  }
  function down(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    try { ink.setPointerCapture(e.pointerId); } catch (err) { /* rien */ }
    state.drawing = { c: state.color, w: state.pen, pts: [point(e)] };
    drawInk();
  }
  function move(e) {
    if (!state.drawing) return;
    var evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    (evs.length ? evs : [e]).forEach(function (ev) { state.drawing.pts.push(point(ev)); });
    drawInk();
  }
  function up() {
    if (!state.drawing) return;
    state.strokes.push(state.drawing);
    state.drawing = null;
    drawInk();
  }

  /* ---------- Rendu complet ---------- */
  function renderAll() {
    resize();
    drawGuide();
    drawInk();
  }

  /* ---------- Commandes ---------- */
  function exportPng() {
    state.printing = true;
    drawGuide(); drawInk();
    var out = document.createElement('canvas');
    out.width = guide.width; out.height = guide.height;
    var c = out.getContext('2d');
    c.drawImage(guide, 0, 0); c.drawImage(ink, 0, 0);
    state.printing = false;
    drawGuide(); drawInk();
    out.toBlob(function (blob) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'ecriture-arabe.png';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    });
  }

  function buildLetters() {
    var box = $('letters');
    A.ALPHA.forEach(function (l, i) {
      var b = A.h('button', 'lbtn');
      b.type = 'button';
      b.setAttribute('aria-label', l.n);
      b.setAttribute('aria-pressed', String(i === state.letter));
      var s = A.h('span', 'ar', l.disp); s.lang = 'ar';
      b.appendChild(s);
      b.appendChild(A.h('small', null, l.n));
      b.addEventListener('click', function () {
        state.letter = i; state.free = ''; $('free').value = '';
        [].forEach.call(box.children, function (c, k) { c.setAttribute('aria-pressed', String(k === i)); });
        change();
      });
      box.appendChild(b);
    });
  }

  function change() { renderInfo(); renderAll(); }

  function bindRange(id, key, valId, fn) {
    $(id).addEventListener('input', function () {
      state[key] = Number($(id).value);
      $(valId).textContent = $(id).value;
      if (fn) fn(); else change();
    });
  }

  function init() {
    buildLetters();
    MARKS.forEach(function (m) { var o = A.h('option', null, m.name); o.value = m.id; $('mark').appendChild(o); });
    $('mark').addEventListener('change', function () { state.mark = $('mark').value; change(); });
    $('free').addEventListener('input', function () {
      state.free = $('free').value;
      $('mark').disabled = !!state.free.trim();
      change();
    });
    [].forEach.call(document.querySelectorAll('[data-form]'), function (b) {
      b.addEventListener('click', function () {
        state.form = b.dataset.form;
        [].forEach.call(document.querySelectorAll('[data-form]'), function (c) { c.setAttribute('aria-pressed', String(c === b)); });
        change();
      });
    });
    bindRange('size', 'size', 'sizeVal');
    bindRange('rows', 'rows', 'rowsVal');
    bindRange('pen', 'pen', 'penVal', function () { /* n'affecte que les prochains traits */ });
    $('model').addEventListener('change', function () { state.model = $('model').value; drawGuide(); });
    $('every').addEventListener('change', function () { state.every = $('every').value; drawGuide(); });
    $('color').addEventListener('change', function () { state.color = $('color').value; });
    $('undo').addEventListener('click', function () { state.strokes.pop(); drawInk(); });
    $('clear').addEventListener('click', function () { state.strokes = []; drawInk(); });
    $('save').addEventListener('click', exportPng);
    $('print').addEventListener('click', function () { window.print(); });

    ink.addEventListener('pointerdown', down);
    ink.addEventListener('pointermove', move);
    ink.addEventListener('pointerup', up);
    ink.addEventListener('pointercancel', up);
    ink.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') up(); });

    window.addEventListener('beforeprint', function () { state.printing = true; drawGuide(); drawInk(); });
    window.addEventListener('afterprint', function () { state.printing = false; drawGuide(); drawInk(); });
    window.addEventListener('themechange', function () { drawGuide(); drawInk(); });
    if (window.ResizeObserver) {
      new ResizeObserver(function () { if (Math.floor(stack.clientWidth) !== W) renderAll(); }).observe(stack);
    } else window.addEventListener('resize', renderAll);

    renderInfo();
    renderAll();
    // la police arabe arrive parfois après : on redessine quand elle est prête
    if (document.fonts && document.fonts.load) {
      document.fonts.load('48px ' + family(), 'ابت').then(renderAll, function () {});
      document.fonts.ready.then(renderAll);
    }
  }

  init();
})();
