/* Couleur : cercle chromatique interactif (harmonies), cercle du peintre (rouge, jaune, bleu) ou de l'écran (rouge, vert, bleu).
   Sur écran, les couleurs ne sont qu'une approximation : l'outil montre les relations entre couleurs, pas la teinte d'un tube.
   Aucune donnée ne quitte le navigateur. */

const $ = (id) => document.getElementById(id);
const NS = 'tools:arts:couleur:';
const readJSON = (k) => { try { return JSON.parse(localStorage.getItem(NS + k)); } catch (e) { return null; } };
const writeJSON = (k, v) => { try { localStorage.setItem(NS + k, JSON.stringify(v)); } catch (e) { /* stockage indisponible : sans importance */ } };
const mod = (v, m) => ((v % m) + m) % m;
const SVGNS = 'http://www.w3.org/2000/svg';

/* ---------- Couleurs ---------- */
function hsv(h, s, v) {
  const f = (n) => { const k = mod(n + h / 60, 6); return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return [f(5), f(3), f(1)];
}
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const NAMES = {
  ryb: ['Jaune', 'Jaune orangé', 'Orange', 'Rouge orangé', 'Rouge', 'Rouge violacé', 'Violet', 'Violet bleuté', 'Bleu', 'Vert bleuté', 'Vert', 'Jaune verdâtre'],
  rgb: ['Rouge', 'Orange', 'Jaune', 'Chartreuse', 'Vert', 'Vert d’eau', 'Cyan', 'Azur', 'Bleu', 'Violet', 'Magenta', 'Rose'],
};
const CATS = ['primaire', 'tertiaire', 'secondaire', 'tertiaire'];
// Explication propre au cercle affiché
const SYNTH = {
  ryb: ['Synthèse soustractive · peinture', 'Chaque pigment absorbe une part de la lumière : plus on mélange, plus c’est sombre, et les trois primaires donnent un noir chromatique. Les complémentaires se neutralisent en gris ou en brun. L’imprimerie utilise cyan, magenta et jaune ; le peintre, rouge, jaune et bleu.'],
  rgb: ['Synthèse additive · lumière', 'On ajoute des lumières : rouge + vert = jaune, et les trois primaires donnent du blanc. Les complémentaires s’additionnent en blanc. Écrans, projecteurs, éclairage de scène.'],
};

const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const gam = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const clamp01 = (v) => Math.min(1, Math.max(0, v));
// OKLab : pour des dégradés clair → foncé réguliers à l'œil
function toOklab([r, g, b]) {
  r = lin(r); g = lin(g); b = lin(b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
}
function fromOklab([L, A, B]) {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.2914855480 * B) ** 3;
  return [
    clamp01(gam(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)),
    clamp01(gam(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)),
    clamp01(gam(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)),
  ];
}
// Même luminance, sans teinte : pour voir les valeurs
function toGray([r, g, b]) { const y = gam(0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)); return [y, y, y]; }
const css = (c) => 'rgb(' + c.map((v) => Math.round(clamp01(v) * 255)).join(' ') + ')';

// Cercle du peintre : 12 couleurs de référence à l'aspect peint (jaune en haut, primaires jaune, rouge, bleu à 120°),
// interpolées en OKLab entre deux repères pour 24 secteurs ou le continu.
const RYB12 = ['#F4E500', '#FDC60B', '#F18E1C', '#EA621F', '#E32322', '#C4037D', '#6D398B', '#444E99', '#2A71B0', '#0696BB', '#008E5B', '#8CBB26'].map((h) => toOklab(hex(h)));
function rybColor(a) {
  a = mod(a, 360);
  const i = Math.floor(a / 30), t = (a - i * 30) / 30, p = RYB12[i], q = RYB12[(i + 1) % 12];
  return fromOklab(p.map((v, k) => v + (q[k] - v) * t));
}

/* ---------- État ---------- */
const HARM = {
  comp: { label: 'Complémentaire', off: [0, 180] },
  fausse: { label: 'Fausse complémentaire', off: [0, 150] },   // une seule voisine de la complémentaire
  split: { label: 'Fausses complémentaires', off: [0, 150, 210] },
  triade: { label: 'Triade', off: [0, 120, 240] },
  analogue: { label: 'Analogue', off: [-30, 0, 30] },
  carre: { label: 'Carré', off: [0, 90, 180, 270] },
  rect: { label: 'Rectangle', off: [0, 60, 180, 240] },
};
const st = {
  harm: HARM[readJSON('harmonie')] ? readJSON('harmonie') : 'comp',
  mode: readJSON('cercle:mode') === 'rgb' ? 'rgb' : 'ryb',
  style: ['anneau', 'centre', 'disques'].indexOf(readJSON('cercle:style')) !== -1 ? readJSON('cercle:style') : 'centre',
  sat: [1, 0.75, 0.5, 0.25].indexOf(readJSON('saturation')) !== -1 ? readJSON('saturation') : 1,
  pas: [12, 24, 0].indexOf(readJSON('decoupage')) !== -1 ? readJSON('decoupage') : 12,
  gris: readJSON('gris') === true,
  base: Number.isFinite(readJSON('depart')) ? mod(readJSON('depart'), 360) : 0,
};

const step = () => (st.pas ? 360 / st.pas : 1);
const snap = (a) => mod(Math.round(a / step()) * step(), 360);
const pure = (a) => (st.mode === 'ryb' ? rybColor(a) : hsv(mod(a, 360), 1, 1));
// Saturation : même clarté, la couleur va vers le gris (OKLab, a et b réduits)
function desat(c, s) { if (s >= 1) return c; const l = toOklab(c); return fromOklab([l[0], l[1] * s, l[2] * s]); }
const colorAt = (a, s = st.sat) => desat(pure(a), s);
const shown = (c) => (st.gris ? toGray(c) : c);
const harmAngles = () => HARM[st.harm].off.map((o) => mod(st.base + o, 360));
function nameOf(a) {
  const i = mod(Math.round(a / 30), 12), exact = Math.abs(mod(a + 15, 30) - 15) < 0.01;
  return { name: NAMES[st.mode][i], cat: exact ? CATS[i % 4] : '' };
}

/* ---------- Dessin du cercle ---------- */
// Un seul anneau épais, à la saturation choisie au curseur
const R_OUT = 100, R_IN = 60, R_MARK = 80;
const pt = (a, r) => [r * Math.sin(a * Math.PI / 180), -r * Math.cos(a * Math.PI / 180)];
const f2 = (v) => v.toFixed(2);
function sector(a0, a1, ro, ri) {
  const [x0, y0] = pt(a0, ro), [x1, y1] = pt(a1, ro), [x2, y2] = pt(a1, ri), [x3, y3] = pt(a0, ri);
  const big = a1 - a0 > 180 ? 1 : 0;
  return `M${f2(x0)} ${f2(y0)}A${ro} ${ro} 0 ${big} 1 ${f2(x1)} ${f2(y1)}L${f2(x2)} ${f2(y2)}A${ri} ${ri} 0 ${big} 0 ${f2(x3)} ${f2(y3)}Z`;
}
const el = (tag, attrs) => { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };

const wheel = $('wheel');
const P3 = [0, 120, 240];   // primaires : jaune, rouge, bleu (RYB) ou rouge, vert, bleu (RGB) ; secondaires à +60°
const poly = (ps) => 'M' + ps.map((p) => f2(p[0]) + ' ' + f2(p[1])).join('L') + 'Z';

// Primaires au centre : triangle des primaires (trois losanges) et triangles des secondaires sur ses côtés, en hexagone
function drawCentre() {
  const r = 52, g = el('g', { class: 'centre' });
  P3.forEach((a) => {
    const P = pt(a, r), Q = pt(a + 120, r), S = pt(a + 60, r);
    g.appendChild(el('path', { d: poly([P, pt(a + 60, r / 2), [0, 0], pt(a - 60, r / 2)]), fill: css(shown(colorAt(a))) }));
    g.appendChild(el('path', { d: poly([P, S, Q]), fill: css(shown(colorAt(a + 60))) }));
  });
  wheel.appendChild(g);
}

// Disques superposés : synthèse soustractive (RYB, sur fond blanc) ou additive (RGB, sur fond noir).
// Chaque zone est peinte de sa couleur : deux primaires donnent la secondaire, les trois donnent le noir (RYB) ou le blanc (RGB).
function drawDisques() {
  // Disques larges et bien superposés : la zone centrale garde la place d'un nom sur deux lignes
  const rgb = st.mode === 'rgb', R = 54, D = 27;
  wheel.appendChild(el('circle', { class: 'fond', cx: 0, cy: 0, r: 99, fill: rgb ? '#000' : '#fff' }));
  const defs = el('defs', {}), ids = P3.map((a, i) => 'disc' + i);
  const C = P3.map((a) => pt(a, D));
  ids.forEach((id, i) => { const cp = el('clipPath', { id }); cp.appendChild(el('circle', { cx: f2(C[i][0]), cy: f2(C[i][1]), r: R })); defs.appendChild(cp); });
  wheel.appendChild(defs);
  const disc = (i, fill) => el('circle', { cx: f2(C[i][0]), cy: f2(C[i][1]), r: R, fill });
  const clip = (id, child) => { const g = el('g', { 'clip-path': 'url(#' + id + ')' }); g.appendChild(child); return g; };
  P3.forEach((a, i) => wheel.appendChild(disc(i, css(shown(colorAt(a))))));
  P3.forEach((a, i) => { const j = (i + 1) % 3; wheel.appendChild(clip(ids[i], disc(j, css(shown(colorAt(a + 60)))))); });
  const centre = rgb ? [1, 1, 1] : desat([0.2, 0.17, 0.17], st.sat);
  wheel.appendChild(clip(ids[0], clip(ids[1], disc(2, css(shown(centre))))));
  // Un fin liseré de la couleur du fond sépare les zones
  C.forEach((c) => wheel.appendChild(el('circle', { class: 'lisere', cx: f2(c[0]), cy: f2(c[1]), r: R, stroke: rgb ? '#000' : '#fff' })));
  // Le nom de chaque zone, en noir ou en blanc selon la clarté du fond
  const label = (p, txt, c, cls = 'zone') => {
    const t = el('text', { class: cls, x: f2(p[0]), y: f2(p[1]), fill: toGray(c)[0] > 0.5 ? '#000' : '#fff' });
    t.textContent = txt; wheel.appendChild(t);
  };
  P3.forEach((a) => {
    label(pt(a, 57), nameOf(a).name, shown(colorAt(a)));
    label(pt(a + 60, 43), nameOf(a + 60).name, shown(colorAt(a + 60)));
  });
  if (rgb) label([0, 0], 'Blanc', shown(centre));
  else { label([0, -3.4], 'Noir', shown(centre), 'zone petit'); label([0, 3.4], 'chromatique', shown(centre), 'zone petit'); }   // noir obtenu par mélange, pas un noir de tube
}

function drawWheel() {
  wheel.textContent = '';
  wheel.classList.toggle('fixe', st.style === 'disques');
  if (st.style === 'disques') { drawDisques(); return; }
  const ring = el('g', { class: st.pas ? 'ring' : 'ring continu' });
  const n = st.pas || 360, w = 360 / n;
  for (let i = 0; i < n; i++) {
    const a = i * w, over = st.pas ? 0 : 0.6;   // en continu, un léger chevauchement évite les filets entre secteurs
    ring.appendChild(el('path', { d: sector(a - w / 2, a + w / 2 + over, R_OUT, R_IN), fill: css(shown(colorAt(a))) }));
  }
  wheel.appendChild(ring);
  const angs = harmAngles();
  const pts = angs.map((a) => pt(a, R_MARK));
  if (st.style === 'centre') drawCentre();
  else {   // anneau seul : les repères sont reliés par un trait
    const order = pts.map((p, i) => i).sort((i, j) => angs[i] - angs[j]);
    const d = order.map((i, k) => (k ? 'L' : 'M') + f2(pts[i][0]) + ' ' + f2(pts[i][1])).join('') + (pts.length > 2 ? 'Z' : '');
    wheel.appendChild(el('path', { class: 'link', d }));
  }
  angs.forEach((a, i) => {
    const isBase = HARM[st.harm].off[i] === 0;
    wheel.appendChild(el('circle', { class: isBase ? 'mark base' : 'mark', cx: f2(pts[i][0]), cy: f2(pts[i][1]), r: isBase ? 8 : 6.5, fill: css(shown(colorAt(a))) }));
  });
}

/* ---------- Tuiles ---------- */
function drawTiles() {
  const angs = harmAngles();
  const ul = $('swatches'); ul.textContent = '';
  // Une ligne par couleur : nom et rang, puis la couleur et 4 éclaircies régulières (OKLab).
  // En peinture, le blanc refroidit et ternit : indicatif seulement. Pas d'assombrissement : le noir change la teinte d'une peinture.
  angs.forEach((a) => {
    const c = colorAt(a), n = nameOf(a);
    const li = document.createElement('li');
    const head = document.createElement('div'); head.className = 'sw-head';
    const b = document.createElement('b'); b.textContent = n.name;
    const cat = document.createElement('span'); cat.className = 'cat'; cat.textContent = n.cat;
    head.append(b, cat);
    const lab = toOklab(c), row = document.createElement('div');
    row.className = 'gamme'; row.setAttribute('role', 'img'); row.setAttribute('aria-label', n.name + ', valeurs de plus en plus claires');
    [0, 0.2, 0.4, 0.6, 0.8].forEach((k) => {
      const mix = lab.map((v, j) => v + ([1, 0, 0][j] - v) * k);
      const s = document.createElement('span'); s.style.background = css(shown(fromOklab(mix))); row.appendChild(s);
    });
    li.append(head, row); ul.appendChild(li);
  });
  wheel.setAttribute('aria-label', 'Cercle chromatique, ' + HARM[st.harm].label.toLowerCase() + ' : ' + angs.map((a) => nameOf(a).name).join(', ') + '. Glissez sur l’anneau ou utilisez les flèches pour tourner.');
}

function render() {
  st.base = snap(st.base);
  $('hue').step = String(step());
  $('hue').value = String(st.base);
  $('sat').value = String(st.sat * 100);
  $('satOut').textContent = st.sat * 100 + ' %';
  $('synthTitle').textContent = SYNTH[st.mode][0];
  $('synthText').textContent = SYNTH[st.mode][1];
  $('harmSel').value = st.harm;
  // En disques superposés, l'harmonie ne s'affiche pas : ses tuiles se retirent
  $('tileHarmonie').hidden = $('tileCouleurs').hidden = st.style === 'disques';
  document.querySelectorAll('#modeSeg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === st.mode)));
  document.querySelectorAll('#pasSeg button').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.v) === st.pas)));
  document.querySelectorAll('#styleSeg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === st.style)));
  $('pasSeg').hidden = st.style === 'disques';
  $('optGris').setAttribute('aria-pressed', String(st.gris));
  drawWheel(); drawTiles();
}
function save() {
  writeJSON('harmonie', st.harm); writeJSON('cercle:mode', st.mode); writeJSON('decoupage', st.pas);
  writeJSON('gris', st.gris); writeJSON('depart', st.base); writeJSON('saturation', st.sat); writeJSON('cercle:style', st.style);
}
const update = () => { render(); save(); };

$('harmSel').addEventListener('change', (e) => { st.harm = e.target.value; update(); });
document.querySelectorAll('#modeSeg button').forEach((b) => b.addEventListener('click', () => { st.mode = b.dataset.v; update(); }));
document.querySelectorAll('#pasSeg button').forEach((b) => b.addEventListener('click', () => { st.pas = Number(b.dataset.v); update(); }));
document.querySelectorAll('#styleSeg button').forEach((b) => b.addEventListener('click', () => { st.style = b.dataset.v; update(); }));
$('optGris').addEventListener('click', () => { st.gris = !st.gris; update(); });
$('hue').addEventListener('input', (e) => { st.base = Number(e.target.value); update(); });
$('sat').addEventListener('input', (e) => { st.sat = Number(e.target.value) / 100; update(); });

/* ---------- Glisser sur le cercle ---------- */
// On attrape le repère le plus proche ; l'harmonie tourne pour qu'il suive le doigt.
let grab = null;
function angleFromEvent(e) {
  const m = wheel.getScreenCTM(); if (!m) return null;
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
  return { a: mod(Math.atan2(p.x, -p.y) * 180 / Math.PI, 360), r: Math.hypot(p.x, p.y) };
}
wheel.addEventListener('pointerdown', (e) => {
  if (st.style === 'disques') return;   // les disques ne tournent pas
  const q = angleFromEvent(e); if (!q || q.r < R_IN - 10) return;
  const off = HARM[st.harm].off;
  let best = 0, bestD = 999;
  off.forEach((o, i) => { const d = Math.abs(mod(q.a - (st.base + o) + 180, 360) - 180); if (d < bestD) { bestD = d; best = i; } });
  grab = bestD < 20 ? off[best] : 0;   // loin de tout repère : c'est la couleur de départ qui vient là
  wheel.setPointerCapture(e.pointerId);
  st.base = q.a - grab; update();
});
wheel.addEventListener('pointermove', (e) => {
  if (grab === null) return;
  const q = angleFromEvent(e); if (!q) return;
  const nb = snap(q.a - grab); if (nb !== st.base) { st.base = nb; update(); }
});
const release = () => { grab = null; };
wheel.addEventListener('pointerup', release);
wheel.addEventListener('pointercancel', release);
wheel.addEventListener('keydown', (e) => {
  const s = st.pas ? step() : 5, by = { ArrowRight: s, ArrowUp: s, ArrowLeft: -s, ArrowDown: -s }[e.key];
  if (by === undefined) return;
  e.preventDefault(); st.base = mod(st.base + by * (e.shiftKey ? 3 : 1), 360); update();
});

/* ---------- Vues, disposition, thème : comme les autres outils d'Arts plastiques ---------- */
const TABS = { cercle: $('tabCercle'), melange: $('tabMelange'), temperature: $('tabTemp'), theorie: $('tabTheorie') };
const VIEWS = { cercle: $('viewCercle'), melange: $('viewMelange'), temperature: $('viewTemp'), theorie: $('viewTheorie') };
let view = 'cercle';
function setView(v, keepHash) {
  // #palette : le simulateur, directement en mode « Toute la palette »
  if (v === 'palette') { mx.mode = 'pal'; v = 'melange'; keepHash = true; }
  view = TABS[v] ? v : 'cercle';
  Object.keys(TABS).forEach((k) => {
    TABS[k].setAttribute('aria-selected', String(k === view)); TABS[k].tabIndex = k === view ? 0 : -1;
    VIEWS[k].hidden = k !== view;
  });
  if (view === 'melange') renderMix();
  if (view === 'temperature') renderTemp();
  if (view === 'theorie') renderTheory();
  if (!keepHash && history.replaceState) { try { history.replaceState(null, '', '#' + view); } catch (_) { /* sans importance */ } }
}
Object.keys(TABS).forEach((k) => TABS[k].addEventListener('click', () => setView(k)));
const tabKeys = Object.keys(TABS);
tabKeys.forEach((k) => TABS[k].addEventListener('keydown', (e) => {
  const i = tabKeys.indexOf(k), to = { ArrowDown: i + 1, ArrowRight: i + 1, ArrowUp: i - 1, ArrowLeft: i - 1, Home: 0, End: tabKeys.length - 1 }[e.key];
  if (to === undefined) return;
  e.preventDefault();
  const n = tabKeys[(to + tabKeys.length) % tabKeys.length]; setView(n); TABS[n].focus();
}));

/* ---------- Simulateur de mélange ---------- */
// Deux sources : l'inventaire (tubes saisis dans Étude d'image › Couleurs physiques, lus sans jamais être modifiés)
// ou des couleurs génériques fournies ici (noms et codes pigments courants, sans marque ; teintes approximatives).
// Le mélange est calculé par le moteur de l'Étude d'image (Kubelka-Munk simplifié) : indicatif, à vérifier sur la palette.
// Les couleurs les plus courantes sur une palette de peintre, dans l'ordre d'une palette (blancs, jaunes, rouges, violets,
// bleus, verts, terres, gris et noir). Noms d'usage et codes pigments du Colour Index : génériques, communs à tous les fabricants.
// Rangées par familles (titres du sélecteur). Les primaires sont celles vendues sous ce nom pour mélanger :
// jaune, rouge, bleu (cercle du peintre) et magenta, cyan (primaires d'imprimerie).
const GEN_FAMILLES = [
  ['Blanc', [['Blanc de titane', 'PW6', '#F5F4EF']]],
  ['Primaires', [
    ['Jaune primaire', 'PY74', '#F6D312'],
    ['Rouge primaire', 'PR254', '#D7262B'],
    ['Bleu primaire', 'PB15:3', '#1A5FA8'],
    ['Magenta primaire', 'PR122', '#C8287A'],
    ['Cyan primaire', 'PB15:3 + PW6', '#0E8FC6'],
  ]],
  ['Jaunes et orangés', [
    ['Jaune citron', 'PY3', '#F3E23B'],
    ['Jaune de cadmium clair', 'PY35', '#F6CF1A'],
    ['Jaune de cadmium moyen', 'PY35', '#F5B30F'],
    ['Ocre jaune', 'PY43', '#C8913A'],
    ['Orange de cadmium', 'PO20', '#EC6A1E'],
  ]],
  ['Rouges et violets', [
    ['Rouge de cadmium clair', 'PR108', '#DC3B25'],
    ['Rouge de cadmium foncé', 'PR108', '#B42628'],
    ['Alizarine cramoisie', 'PR83', '#8E1D33'],
    ['Magenta de quinacridone', 'PR122', '#B8306E'],
    ['Violet de dioxazine', 'PV23', '#4B2A5E'],
  ]],
  ['Bleus', [
    ['Bleu outremer', 'PB29', '#2E3F95'],
    ['Bleu de cobalt', 'PB28', '#2F5DA8'],
    ['Bleu céruléen', 'PB35', '#3D8CC4'],
    ['Bleu de phtalocyanine', 'PB15:3', '#1B4E8C'],
    ['Bleu de Prusse', 'PB27', '#1D2F4A'],
  ]],
  ['Verts', [
    ['Vert de phtalocyanine', 'PG7', '#11685A'],
    ['Vert émeraude', 'PG18', '#1E6E5C'],
    ['Vert oxyde de chrome', 'PG17', '#607C45'],
  ]],
  ['Terres', [
    ['Terre de Sienne naturelle', 'PBr7', '#B5743A'],
    ['Terre de Sienne brûlée', 'PBr7', '#87442A'],
    ['Rouge anglais', 'PR101', '#9E3F2C'],
    ['Terre d’ombre naturelle', 'PBr7', '#6C5A3F'],
    ['Terre d’ombre brûlée', 'PBr7', '#533A2B'],
  ]],
  ['Gris et noir', [
    ['Gris de Payne', 'PB29 + PBk9', '#3D4752'],
    ['Noir d’ivoire', 'PBk9', '#24221F'],
  ]],
];
const GENERIQUES = GEN_FAMILLES.flatMap(([fam, arr]) => arr.map(([name, pig, hx]) => ({ id: 'g:' + name, name, pig, hex: hx, fam })));

function readInventaire() {
  try {
    const d = JSON.parse(localStorage.getItem('tools:arts:melangeur:atelier'));
    const list = d && Array.isArray(d.tubes) ? d.tubes : [];
    return list.filter((t) => t && typeof t.hex === 'string' && /^#[0-9a-f]{6}$/i.test(t.hex) && typeof t.id === 'string')
      .map((t) => ({ id: 'i' + t.id, name: String(t.name || 'Sans nom').slice(0, 60), pig: String(t.pigment || '').slice(0, 30), hex: t.hex, group: String(t.group || '').slice(0, 40), have: !!t.active }));
  } catch (e) { return []; }
}
const DEF_GEN = ['g:Cyan primaire', 'g:Magenta primaire', 'g:Jaune primaire', 'g:Rouge primaire', 'g:Bleu outremer', 'g:Vert de phtalocyanine', 'g:Ocre jaune', 'g:Terre de Sienne brûlée'];   // départ : les trois primaires d'imprimerie
const PAL_MAX = 8;   // « Toute la palette » : de 2 à 8 couleurs
const mx0 = readJSON('melange2') || {};
const mx = {
  src: mx0.src === 'inv' ? 'inv' : 'gen',
  n: mx0.n === 2 ? 2 : 3,
  gris: false,
  // chaque emplacement : une couleur de la source (id)
  slots: [0, 1, 2].map((i) => {
    const s = mx0.slots && mx0.slots[i];
    // par défaut : cyan, magenta et jaune primaires
    return { id: s && typeof s.id === 'string' && s.id ? s.id : DEF_GEN[i] };
  }),
  parts: [0, 1, 2].map((i) => (mx0.parts && Number.isInteger(mx0.parts[i]) && mx0.parts[i] >= 0 && mx0.parts[i] <= 99 ? mx0.parts[i] : 1)),
  // « Toute la palette » : ses propres couleurs (3 ou 4), le blanc en plus ou non
  mode: mx0.mode === 'pal' ? 'pal' : 'mix',
  pn: Number.isInteger(mx0.pn) && mx0.pn >= 2 && mx0.pn <= PAL_MAX ? mx0.pn : 3,
  blanc: mx0.blanc !== false,
  pslots: Array.from({ length: PAL_MAX }, (_, i) => i).map((i) => { const p = mx0.pslots && mx0.pslots[i]; return { id: p && typeof p.id === 'string' && p.id ? p.id : DEF_GEN[i] }; }),
};
const saveMix = () => writeJSON('melange2', { src: mx.src, n: mx.n, slots: mx.slots, parts: mx.parts, mode: mx.mode, pn: mx.pn, blanc: mx.blanc, pslots: mx.pslots });
const S = () => (mx.mode === 'pal' ? mx.pslots : mx.slots);   // emplacements du mode affiché
const NN = () => (mx.mode === 'pal' ? mx.pn : mx.n);
let inventaire = readInventaire();
const pool = () => (mx.src === 'inv' ? inventaire : GENERIQUES);
// Couleur d'un emplacement ; si elle n'existe plus dans la source, une couleur par défaut de cette source
function slotColor(i) {
  const list = pool(), s = S()[i];
  let c = list.find((p) => p.id === s.id);
  if (!c) c = mx.src === 'gen' ? list.find((p) => p.id === DEF_GEN[i]) : list.filter((t) => t.have).concat(list.filter((t) => !t.have))[i] || list[0];
  return c ? { name: c.name, pig: [c.pig, c.group].filter(Boolean).join(' · '), hex: c.hex } : { name: 'Aucun tube', pig: '', hex: '#808080' };
}
const rgb8 = (hx) => ({ r: parseInt(hx.slice(1, 3), 16), g: parseInt(hx.slice(3, 5), 16), b: parseInt(hx.slice(5, 7), 16) });
// Mélange de couleurs (hex) en proportions w (somme quelconque) → [r, g, b] 0..1
function mixOf(hexes, w) {
  const MM = window.MelangeMoteur, sum = w.reduce((a, b) => a + b, 0);
  if (!MM || !sum) return [0.5, 0.5, 0.5];
  const P = hexes.map((h) => MM.prepareTube(rgb8(h))), idx = [], ws = [];
  w.forEach((v, i) => { if (v > 0) { idx.push(i); ws.push(v / sum); } });
  const out = [0, 0, 0]; MM.mix(P, idx, ws, out);
  return out.map((v) => clamp01(gam(v)));
}
const showMix = (c) => (mx.gris ? toGray(c) : c);
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
function reduceParts(p) { const g = p.reduce((a, b) => gcd(a, b), 0) || 1; return p.map((v) => v / g); }

// Liste des emplacements : couleur (clic : sélecteur), parts − n +
function buildSlots() {
  const ul = $('slots'); ul.textContent = '';
  $('noTubes').hidden = !(mx.src === 'inv' && !inventaire.length);
  for (let i = 0; i < NN(); i++) {
    const c = slotColor(i), li = document.createElement('li');
    // La couleur choisie : pastille, nom, pigment ; un clic ouvre le sélecteur
    const sel = document.createElement('button');
    sel.type = 'button'; sel.className = 'slot-pick'; sel.setAttribute('aria-haspopup', 'dialog');
    sel.setAttribute('aria-label', 'Couleur ' + (i + 1) + ' : ' + c.name + '. Changer');
    const sw = document.createElement('span'); sw.className = 'slot-sw'; sw.style.background = c.hex;
    const tx = document.createElement('span'); tx.className = 'slot-tx';
    const nm = document.createElement('b'); nm.textContent = c.name;
    const pg = document.createElement('small'); pg.textContent = c.pig;
    tx.append(nm, pg);
    const chev = document.createElementNS(SVGNS, 'svg'); chev.setAttribute('viewBox', '0 0 24 24'); chev.setAttribute('aria-hidden', 'true'); chev.classList.add('chev');
    chev.appendChild(el('path', { d: 'M7 10l5 5 5-5' }));
    sel.append(sw, tx, chev);
    sel.addEventListener('click', () => openPicker(i, sel));
    // Ses parts : − n + ; un appui maintenu répète, de plus en plus vite
    const st8 = document.createElement('div'); st8.className = 'parts';
    const mk = (txt, d, lab) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = txt; b.setAttribute('aria-label', lab); b.dataset.slot = i; b.dataset.d = d; return b; };
    const out = document.createElement('output'); out.textContent = mx.parts[i]; out.setAttribute('aria-label', mx.parts[i] + (mx.parts[i] > 1 ? ' parts' : ' part'));
    st8.append(mk('−', -1, 'Une part de moins de ' + c.name), out, mk('+', 1, 'Une part de plus de ' + c.name));
    if (mx.mode === 'pal') li.append(sel); else li.append(sel, st8);
    ul.appendChild(li);
  }
}
/* Sélecteur : recherche sans accents ni majuscules (tous les mots doivent se retrouver), pastilles, clavier */
const picker = $('picker'), pickerQ = $('pickerQ'), pickerList = $('pickerList');
const fold = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
let pick = null;   // { slot, trigger, items: [{ id, li }], active }
function openPicker(i, trigger, target) {
  if (pick && pick.slot === i) { closePicker(); return; }
  pick = { slot: i, trigger, target: target || null, items: [], active: 0 };
  pickerQ.value = '';
  fillPicker();
  picker.hidden = false;
  placePicker();
  requestAnimationFrame(() => picker.classList.add('open'));
  trigger.setAttribute('aria-expanded', 'true');
  pickerQ.focus({ preventScroll: true });
}
function closePicker(refocus) {
  if (!pick) return;
  const t = pick.trigger; pick = null;
  picker.classList.remove('open');
  setTimeout(() => { if (!pick) picker.hidden = true; }, 160);
  if (t) { t.setAttribute('aria-expanded', 'false'); if (refocus && t.isConnected) t.focus(); }
}
function placePicker() {
  if (!pick) return;
  if (window.matchMedia('(max-width: 640px)').matches) { picker.removeAttribute('style'); return; }   // feuille en bas d'écran
  const r = pick.trigger.getBoundingClientRect(), w = Math.max(r.width, 300), h = Math.min(420, window.innerHeight - 32);
  const below = window.innerHeight - r.bottom - 12, up = below < 260 && r.top > below;
  picker.style.left = Math.max(12, Math.min(r.left, window.innerWidth - w - 12)) + 'px';
  picker.style.width = w + 'px';
  picker.style.maxHeight = Math.min(h, (up ? r.top : below) - 8) + 'px';
  picker.style.top = up ? 'auto' : r.bottom + 6 + 'px';
  picker.style.bottom = up ? window.innerHeight - r.top + 6 + 'px' : 'auto';
  picker.classList.toggle('up', up);
}
function fillPicker() {
  const words = fold(pickerQ.value).split(/\s+/).filter(Boolean);
  const match = (t) => { const hay = fold([t.name, t.pig, t.group, t.fam, t.hex].join(' ')); return words.every((w) => hay.indexOf(w) !== -1); };
  const list = pool().filter(match), cur = pick.target ? pick.target.get() : S()[pick.slot].id;
  pickerList.textContent = ''; pick.items = [];
  const groups = mx.src === 'inv' ? [['Je l’ai', list.filter((t) => t.have)], ['Autres tubes', list.filter((t) => !t.have)]] : GEN_FAMILLES.map(([fam]) => [fam, list.filter((t) => t.fam === fam)]);
  groups.forEach(([lab, arr]) => {
    if (!arr.length) return;
    if (lab) { const h = document.createElement('li'); h.className = 'picker-group'; h.setAttribute('role', 'presentation'); h.textContent = lab; pickerList.appendChild(h); }
    arr.forEach((t) => addPickItem(t.id, t.name, [t.pig, t.group].filter(Boolean).join(' · '), t.hex, t.id === cur));
  });
  if (!list.length) { const e = document.createElement('li'); e.className = 'picker-empty'; e.setAttribute('role', 'presentation'); e.textContent = mx.src === 'inv' && !inventaire.length ? 'Aucun tube dans l’inventaire.' : 'Aucune couleur trouvée.'; pickerList.appendChild(e); }
  const sel = pick.items.findIndex((it) => it.on);
  setActive(words.length ? 0 : Math.max(0, sel), !words.length);
}
function addPickItem(id, name, sub, hx, on) {
  const li = document.createElement('li');
  li.className = 'picker-item'; li.setAttribute('role', 'option'); li.setAttribute('aria-selected', String(on));
  li.id = 'pk' + pick.items.length;
  const sw = document.createElement('span'); sw.className = 'pk-sw'; sw.style.background = hx;
  const tx = document.createElement('span'); tx.className = 'pk-tx';
  const b = document.createElement('b'); b.textContent = name;
  const s = document.createElement('small'); s.textContent = sub;
  tx.append(b, s); li.append(sw, tx);
  const k = pick.items.length;
  li.addEventListener('pointermove', () => { if (pick && pick.active !== k) setActive(k); });
  li.addEventListener('click', () => choosePick(k));
  pickerList.appendChild(li);
  pick.items.push({ id, li, on });
}
function setActive(k, center) {
  if (!pick || !pick.items.length) return;
  pick.active = Math.max(0, Math.min(pick.items.length - 1, k));
  pick.items.forEach((it, j) => it.li.classList.toggle('active', j === pick.active));
  const li = pick.items[pick.active].li;
  pickerQ.setAttribute('aria-activedescendant', li.id);
  li.scrollIntoView({ block: center ? 'center' : 'nearest' });
}
function choosePick(k) {
  if (!pick) return;
  const it = pick.items[k], slot = pick.slot;
  if (pick.target) { const tg = pick.target; closePicker(); tg.set(it.id); return; }
  S()[slot].id = it.id;
  closePicker(); saveMix(); renderMix();
  const t = $('slots').querySelectorAll('.slot-pick')[slot]; if (t) t.focus();
}
pickerQ.addEventListener('input', fillPicker);
pickerQ.addEventListener('keydown', (e) => {
  if (!pick) return;
  if (e.key === 'ArrowDown') { e.preventDefault(); setActive(pick.active + 1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(pick.active - 1); }
  else if (e.key === 'Enter') { e.preventDefault(); choosePick(pick.active); }
  else if (e.key === 'Escape') { e.preventDefault(); if (pickerQ.value) { pickerQ.value = ''; fillPicker(); } else closePicker(true); }
  else if (e.key === 'Tab') closePicker();
});
document.addEventListener('pointerdown', (e) => { if (pick && !picker.contains(e.target) && !pick.trigger.contains(e.target)) closePicker(); });
window.addEventListener('resize', placePicker);
document.addEventListener('scroll', (e) => { if (pick && !picker.contains(e.target)) placePicker(); }, true);

// Parts − et + : un clic = une part ; appui maintenu = ça continue, de plus en plus vite (comme Carreau et Décalage
// de l'Étude d'image). Pendant l'appui, seuls les chiffres changent : les boutons restent sous le doigt.
let partsHold = null;
function partsStep(i, d) {
  const v = Math.max(0, Math.min(99, mx.parts[i] + d));
  if (v === mx.parts[i]) return false;
  mx.parts[i] = v; renderMix(true); return true;
}
function partsStop() {
  if (!partsHold) return;
  clearTimeout(partsHold.t); partsHold = null; saveMix(); renderMix();
}
function partsTick() {
  const el2 = Date.now() - partsHold.t0;
  if (!partsStep(partsHold.i, partsHold.d * (el2 > 2500 ? 2 : 1))) { partsStop(); return; }
  partsHold.t = setTimeout(partsTick, Math.max(40, 140 - el2 / 15));
}
$('slots').addEventListener('pointerdown', (e) => {
  const b = e.target.closest && e.target.closest('.parts button');
  if (!b || e.button !== 0) return;
  e.preventDefault();
  partsStop();
  partsHold = { i: Number(b.dataset.slot), d: Number(b.dataset.d), t0: 0, t: 0 };
  partsStep(partsHold.i, partsHold.d);
  partsHold.t = setTimeout(() => { if (partsHold) { partsHold.t0 = Date.now(); partsTick(); } }, 350);
  try { b.setPointerCapture(e.pointerId); } catch (_) { /* sans importance */ }
});
['pointerup', 'pointercancel'].forEach((ev) => document.addEventListener(ev, partsStop));
window.addEventListener('blur', partsStop);
$('slots').addEventListener('contextmenu', (e) => { if (e.target.closest && e.target.closest('.parts button')) e.preventDefault(); });
// Clavier (Entrée, Espace) : une part par appui
$('slots').addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('.parts button');
  if (b && e.detail === 0 && partsStep(Number(b.dataset.slot), Number(b.dataset.d))) { saveMix(); renderMix(); }
});


// Gamme : bande de la couleur 1 à la couleur 2, ou triangle de tous les mélanges de 3 couleurs.
// On glisse le repère (souris, doigt) ou on le pousse aux flèches : les parts suivent.
const chart = $('mixChart');
const TRI = [[0, -86], [-99, 86], [99, 86]];   // sommets : couleur 1 en haut, 2 en bas à gauche, 3 en bas à droite
const N_TRI = 12, N_BAND = 20;
function drawChart(hexes, w) {
  chart.textContent = '';
  const sum = w.reduce((a, b) => a + b, 0) || 1;
  if (mx.n === 2) {
    chart.setAttribute('viewBox', '-104 -24 208 64');
    const x0 = -100, wd = 200, cw = wd / (N_BAND + 1);
    const clip = el('clipPath', { id: 'bandClip' }); clip.appendChild(el('rect', { x: x0, y: -14, width: wd, height: 28, rx: 6 }));
    const defs = el('defs', {}); defs.appendChild(clip); chart.appendChild(defs);
    const g = el('g', { 'clip-path': 'url(#bandClip)' });
    for (let k = 0; k <= N_BAND; k++) {
      const t = k / N_BAND;   // part de la couleur 2
      g.appendChild(el('rect', { x: f2(x0 + k * cw), y: -14, width: f2(cw + 0.3), height: 28, fill: css(showMix(mixOf(hexes, [1 - t, t]))) }));
    }
    chart.appendChild(g);
    chart.appendChild(el('rect', { class: 'chart-frame', x: x0, y: -14, width: wd, height: 28, rx: 6 }));
    const t = w[1] / sum, xp = x0 + cw / 2 + t * (wd - cw);
    chart.appendChild(el('line', { class: 'chart-line', x1: f2(xp), y1: -19, x2: f2(xp), y2: 19 }));
    chart.appendChild(el('circle', { class: 'chart-knob', cx: f2(xp), cy: 0, r: 8, fill: css(showMix(mixOf(hexes, w))) }));
    [[x0, 'Plus de ' + slotColor(0).name.toLowerCase(), 'start'], [x0 + wd, 'Plus de ' + slotColor(1).name.toLowerCase(), 'end']].forEach(([x, txt, anchor]) => {
      const tx = el('text', { class: 'chart-label', x, y: 31, 'text-anchor': anchor }); tx.textContent = txt; chart.appendChild(tx);
    });
    chart.setAttribute('aria-valuemin', '0'); chart.setAttribute('aria-valuemax', '100');
    chart.setAttribute('aria-valuenow', String(Math.round(t * 100)));
    chart.setAttribute('aria-valuetext', Math.round((1 - t) * 100) + ' % ' + slotColor(0).name + ', ' + Math.round(t * 100) + ' % ' + slotColor(1).name);
    $('gamutHelp').textContent = 'Glissez sur la bande pour doser.';
    return;
  }
  chart.setAttribute('viewBox', '-112 -106 224 222');
  const P = (a, b, c) => [(a * TRI[0][0] + b * TRI[1][0] + c * TRI[2][0]) / N_TRI, (a * TRI[0][1] + b * TRI[1][1] + c * TRI[2][1]) / N_TRI];
  for (let a = 0; a < N_TRI; a++) for (let b = 0; a + b < N_TRI; b++) {
    const c = N_TRI - 1 - a - b;
    chart.appendChild(el('path', { d: poly([P(a + 1, b, c), P(a, b + 1, c), P(a, b, c + 1)]), fill: css(showMix(mixOf(hexes, [a + 1 / 3, b + 1 / 3, c + 1 / 3]))) }));
    if (c > 0) {
      chart.appendChild(el('path', { d: poly([P(a + 1, b + 1, c - 1), P(a + 1, b, c), P(a, b + 1, c)]), fill: css(showMix(mixOf(hexes, [a + 2 / 3, b + 2 / 3, c - 1 / 3]))) }));
    }
  }
  chart.appendChild(el('path', { class: 'chart-frame', d: poly(TRI) }));
  const m = P(N_TRI * w[0] / sum, N_TRI * w[1] / sum, N_TRI * w[2] / sum);
  chart.appendChild(el('circle', { class: 'chart-knob', cx: f2(m[0]), cy: f2(m[1]), r: 7, fill: css(showMix(mixOf(hexes, w))) }));
  [[0, 0, -94, 'middle'], [1, -99, 102, 'start'], [2, 99, 102, 'end']].forEach(([i, x, y, anchor]) => {
    const tx = el('text', { class: 'chart-label', x, y, 'text-anchor': anchor }); tx.textContent = slotColor(i).name; chart.appendChild(tx);
  });
  chart.removeAttribute('aria-valuenow'); chart.removeAttribute('aria-valuemin'); chart.removeAttribute('aria-valuemax');
  chart.setAttribute('aria-valuetext', w.map((v, i) => Math.round(v / sum * 100) + ' % ' + slotColor(i).name).join(', '));
  $('gamutHelp').textContent = 'Glissez dans le triangle pour doser : plus le repère est près d’une couleur, plus elle domine.';
}
function setFromPoint(e) {
  const m = chart.getScreenCTM(); if (!m) return false;
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
  let next;
  if (mx.n === 2) {
    const k = Math.round(Math.min(1, Math.max(0, (p.x + 100) / 200)) * N_BAND);
    next = reduceParts([N_BAND - k, k]);
  } else {
    // coordonnées barycentriques du point, ramenées dans le triangle et arrondies au douzième
    const [A, B, C] = TRI, det = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]);
    const l1 = ((B[1] - C[1]) * (p.x - C[0]) + (C[0] - B[0]) * (p.y - C[1])) / det;
    const l2 = ((C[1] - A[1]) * (p.x - C[0]) + (A[0] - C[0]) * (p.y - C[1])) / det;
    const q = [l1, l2, 1 - l1 - l2].map((v) => Math.max(0, v)), s = q[0] + q[1] + q[2];
    const pr = q.map((v) => Math.round(v / s * N_TRI));
    if (!pr.some((v) => v > 0)) return false;
    next = reduceParts(pr);
  }
  if (next.every((v, i) => v === mx.parts[i])) return false;
  next.forEach((v, i) => { mx.parts[i] = v; });
  renderMix();
  return true;
}
let dragging = false;
chart.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  dragging = true; chart.setPointerCapture(e.pointerId); chart.classList.add('dragging');
  setFromPoint(e);
});
chart.addEventListener('pointermove', (e) => { if (dragging) setFromPoint(e); });
const endDrag = () => { if (!dragging) return; dragging = false; chart.classList.remove('dragging'); saveMix(); };
chart.addEventListener('pointerup', endDrag);
chart.addEventListener('pointercancel', endDrag);
// Clavier (2 couleurs) : ← → déplacent d'un vingtième vers l'une ou l'autre couleur
chart.addEventListener('keydown', (e) => {
  if (mx.n !== 2) return;
  const d = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
  if (d === undefined) return;
  e.preventDefault();
  const sum = mx.parts[0] + mx.parts[1] || 1;
  const k = Math.max(0, Math.min(N_BAND, Math.round(mx.parts[1] / sum * N_BAND) + d));
  const r = reduceParts([N_BAND - k, k]); mx.parts[0] = r[0]; mx.parts[1] = r[1];
  saveMix(); renderMix();
});

function renderMix(keepSlots) {
  inventaire = readInventaire();   // l'inventaire a pu changer dans l'autre page
  const pal = mx.mode === 'pal';
  document.querySelectorAll('#modeMix button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === mx.mode)));
  $('modeMix').dataset.mode = mx.mode;   // le fond glisse sous l'option choisie
  document.querySelectorAll('#srcSeg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === mx.src)));
  // nombre de couleurs : 2 ou 3 pour un mélange, 3 ou 4 pour une palette
  const opts = [2, 3];
  $('nSeg').hidden = pal; $('palN').hidden = !pal;
  $('palNOut').textContent = mx.pn + ' couleurs';
  $('palMinus').disabled = mx.pn <= 2; $('palPlus').disabled = mx.pn >= PAL_MAX;
  document.querySelectorAll('#nSeg button').forEach((b) => { const v = opts[Number(b.dataset.k)]; b.dataset.v = v; b.textContent = v + ' couleurs'; b.setAttribute('aria-pressed', String(v === NN())); });
  $('mixGris').setAttribute('aria-pressed', String(mx.gris));
  $('genNote').hidden = mx.src !== 'gen';
  $('frameMix').hidden = pal; $('framePal').hidden = !pal;
  $('tileMixRes').hidden = pal; $('tilePal').hidden = !pal;
  $('presets').hidden = !pal || mx.src !== 'gen';   // palettes prêtes : faites de couleurs génériques
  $('palBlanc').hidden = !pal;
  $('palBlanc').setAttribute('aria-pressed', String(mx.blanc));
  if (pal) { buildSlots(); renderPal(); return; }
  if (keepSlots) document.querySelectorAll('#slots .parts output').forEach((o, i) => { o.textContent = mx.parts[i]; });
  else buildSlots();
  const cols = [], w = [];
  for (let i = 0; i < mx.n; i++) { cols.push(slotColor(i)); w.push(mx.parts[i]); }
  const hexes = cols.map((c) => c.hex), sum = w.reduce((a, b) => a + b, 0);
  const res = sum ? mixOf(hexes, w) : null;
  // Résultat en grand, avec le rapport simplifié des parts (ex. 3 : 1)
  $('mixRes').style.background = res ? css(showMix(res)) : 'transparent';
  const ratio = sum ? reduceParts(w).join(' : ') : '—';
  $('mixRatio').textContent = ratio;
  $('mixRatio').style.color = res && toGray(showMix(res))[0] > 0.5 ? '#000' : '#fff';
  $('mixRes').setAttribute('aria-label', 'Résultat du mélange, ' + ratio);
  const ul = $('mixParts'); ul.textContent = '';
  cols.forEach((c, i) => {
    const li = document.createElement('li');
    const sw = document.createElement('span'); sw.className = 'mini-sw'; sw.style.background = css(showMix(hex(c.hex)));
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = c.name;
    const pc = document.createElement('b'); pc.textContent = sum ? Math.round(w[i] / sum * 100) + ' %' : '—';
    li.append(sw, nm, pc); ul.appendChild(li);
  });
  // Valeur : clarté L* du mélange, de 0 (noir) à 100 (blanc)
  $('mixVal').textContent = res && window.MelangeMoteur ? Math.round(window.MelangeMoteur.rgbToLab({ r: Math.round(res[0] * 255), g: Math.round(res[1] * 255), b: Math.round(res[2] * 255) })[0]) + ' / 100' : '—';
  drawChart(hexes, sum ? w : w.map(() => 1));
}
document.querySelectorAll('#srcSeg button').forEach((b) => b.addEventListener('click', () => {
  if (mx.src === b.dataset.v) return;
  mx.src = b.dataset.v; inventaire = readInventaire();
  // chaque emplacement reprend une couleur de la nouvelle source (les tubes qu'on a d'abord)
  const list = pool(), firsts = list.filter((t) => t.have).concat(list.filter((t) => !t.have));
  S().forEach((s, i) => {
    if (list.some((t) => t.id === s.id)) return;
    const def = mx.src === 'gen' ? DEF_GEN[i] : firsts[i] && firsts[i].id;
    s.id = def || '';
  });
  saveMix(); renderMix();
}));
document.querySelectorAll('#nSeg button').forEach((b) => b.addEventListener('click', () => {
  mx.n = Number(b.dataset.v);
  saveMix(); renderMix();
}));
// Palette : − N + ; une couleur ajoutée est celle qui étend le plus la zone atteignable
function palCount(d) {
  const n = Math.max(2, Math.min(PAL_MAX, mx.pn + d));
  if (n === mx.pn) return;
  if (n > mx.pn) { const id = bestNext(mx.pn); if (id) mx.pslots[mx.pn].id = id; }
  mx.pn = n; saveMix(); renderMix();
}
$('palMinus').addEventListener('click', () => palCount(-1));
$('palPlus').addEventListener('click', () => palCount(1));
document.querySelectorAll('#modeMix button').forEach((b) => b.addEventListener('click', () => { closePicker(); mx.mode = b.dataset.v; saveMix(); renderMix(); }));
$('palBlanc').addEventListener('click', () => { mx.blanc = !mx.blanc; saveMix(); renderMix(); });

/* ---------- Toute la palette ---------- */
// Palettes connues (couleurs génériques) ; le blanc s'ajoute par le bouton « + blanc ».
const PRESETS = {
  cmj: ['Cyan primaire', 'Magenta primaire', 'Jaune primaire'],
  rjb: ['Jaune primaire', 'Rouge primaire', 'Bleu primaire'],
  terres: ['Ocre jaune', 'Terre de Sienne brûlée', 'Bleu outremer'],
};
document.querySelectorAll('#presets button').forEach((b) => b.addEventListener('click', () => {
  const names = PRESETS[b.dataset.p]; if (!names) return;
  mx.src = 'gen'; mx.pn = names.length; mx.blanc = true;
  names.forEach((n, i) => { mx.pslots[i].id = 'g:' + n; });
  saveMix(); renderMix();
}));

const BLANC = '#F5F4EF';   // blanc de titane générique
// Position d'une couleur sur le cercle : teinte OKLab (jaune en haut, comme le cercle du peintre), saturation vers le bord
const R_GAMUT = 86, C_MAX = 0.26;
function gamutPt(c) {
  const [, A, B] = toOklab(c), C = Math.hypot(A, B), h = Math.atan2(B, A) * 180 / Math.PI;
  return { p: pt(mod(110 - h, 360), Math.min(1, C / C_MAX) * R_GAMUT), C, ang: mod(110 - h, 360) };
}
// Enveloppe convexe (chaîne monotone d'Andrew) : la forme de la zone atteignable
function hull(ps) {
  const p = ps.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  p.forEach((q) => { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); });
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
const HUE12 = ['jaune', 'jaune orangé', 'orange', 'rouge', 'carmin', 'magenta', 'violet', 'bleu', 'azur', 'bleu vert', 'vert bleu', 'vert'];
// Aire d'un polygone (formule du lacet)
function area(P) { let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a) / 2; }
// Zone atteignable (aire de l'enveloppe) d'un jeu de couleurs : échantillonnage plus léger que l'affichage (au quart, 2 doses de blanc)
function reachArea(hx) {
  const n = hx.length, STEP = n > 5 ? 2 : n > 3 ? 3 : 4, tints = mx.blanc ? [0, 0.5] : [0], ps = [];
  const rec = (k, left, w) => {
    if (k === n - 1) {
      w[k] = left;
      tints.forEach((t) => { const ww = w.map((v) => v / STEP); ps.push(gamutPt(t ? mixOf(hx.concat([BLANC]), ww.map((v) => v * (1 - t)).concat([t])) : mixOf(hx, ww)).p); });
      return;
    }
    for (let v = 0; v <= left; v++) { w[k] = v; rec(k + 1, left - v, w); }
  };
  rec(0, STEP, new Array(n).fill(0));
  return area(hull(ps));
}
// Couleur à ajouter : parmi la source affichée, celle qui agrandit le plus la zone des k premières
function bestNext(k) {
  const base = Array.from({ length: k }, (_, i) => slotColor(i)), taken = new Set(base.map((c) => c.hex.toLowerCase()));
  let best = null, bestA = -1;
  pool().forEach((t) => {
    if (taken.has(t.hex.toLowerCase())) return;
    const a = reachArea(base.map((c) => c.hex).concat([t.hex]));
    if (a > bestA) { bestA = a; best = t.id; }
  });
  return best;
}
function renderPal() {
  const n = mx.pn, cols = [], hx = [];
  for (let i = 0; i < n; i++) { const c = slotColor(i); cols.push(c); hx.push(c.hex); }
  const tints = mx.blanc ? [0, 0.25, 0.5, 0.75] : [0];
  const withW = (w, t) => (t ? mixOf(hx.concat([BLANC]), w.map((v) => v * (1 - t)).concat([t])) : mixOf(hx, w));

  // Planche : un bloc par paire de couleurs, 9 cases de l'une à l'autre, puis une rangée par dose de blanc
  const pl = $('palPlanche'); pl.textContent = '';
  const pairs = []; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pairs.push([i, j]);
  const CELL = 20, COLS = 9, BW = CELL * COLS, GAPX = 20, LAB = 13, BH = LAB + CELL * tints.length + 12;
  const perRow = n > 4 ? 3 : n > 2 ? 2 : 1, rows = Math.ceil(pairs.length / perRow);
  pl.setAttribute('viewBox', '0 0 ' + (BW * perRow + GAPX) + ' ' + rows * BH);
  pairs.forEach(([i, j], k) => {
    const x0 = (k % perRow) * (BW + GAPX), y0 = Math.floor(k / perRow) * BH;
    const t = el('text', { class: 'pl-label', x: x0, y: y0 + 9 }); t.textContent = cols[i].name + ' + ' + cols[j].name; pl.appendChild(t);
    tints.forEach((tw, r) => {
      for (let c = 0; c < COLS; c++) {
        const a = 1 - c / (COLS - 1), w = hx.map((_, q) => (q === i ? a : q === j ? 1 - a : 0));
        pl.appendChild(el('rect', { x: x0 + c * CELL, y: y0 + LAB + r * CELL, width: CELL + 0.3, height: CELL + 0.3, fill: css(showMix(withW(w, tw))) }));
      }
    });
    pl.appendChild(el('rect', { class: 'pl-frame', x: x0, y: y0 + LAB, width: BW, height: CELL * tints.length }));
  });

  // Cercle : tous les mélanges (pas d'un sixième, avec les doses de blanc), et la forme qui les entoure
  const wh = $('palWheel'); wh.textContent = '';
  for (let a = 0; a < 360; a += 3) {   // anneau de repère : les teintes du cercle, à saturation moyenne
    const h = (110 - a) * Math.PI / 180;
    wh.appendChild(el('path', { class: 'pw-ring', d: sector(a - 1.5, a + 1.6, 100, 93), fill: css(showMix(fromOklab([0.72, 0.13 * Math.cos(h), 0.13 * Math.sin(h)]))) }));
  }
  wh.appendChild(el('circle', { class: 'pw-disc', cx: 0, cy: 0, r: R_GAMUT }));
  const STEP = n <= 4 ? 6 : n <= 6 ? 4 : 3, pts = [], best = new Array(12).fill(0), seen = new Set();
  const rec = (k, left, w) => {
    if (k === n - 1) { w[k] = left; tints.forEach((t) => {
      const key = w.join(',') + '|' + t; if (seen.has(key)) return; seen.add(key);
      const c = withW(w.map((v) => v / STEP), t), g = gamutPt(c);
      pts.push({ c, g });
      const sec = mod(Math.round(g.ang / 30), 12); if (g.C > best[sec]) best[sec] = g.C;
    }); return; }
    for (let v = 0; v <= left; v++) { w[k] = v; rec(k + 1, left - v, w); }
  };
  rec(0, STEP, new Array(n).fill(0));
  const H = hull(pts.map((q) => q.g.p));
  if (H.length > 2) wh.appendChild(el('path', { class: 'pw-hull', d: poly(H) }));
  pts.forEach((q) => wh.appendChild(el('circle', { class: 'pw-dot', cx: f2(q.g.p[0]), cy: f2(q.g.p[1]), r: 2.4, fill: css(showMix(q.c)) })));
  cols.forEach((c) => { const g = gamutPt(hex(c.hex)); wh.appendChild(el('circle', { class: 'pw-tube', cx: f2(g.p[0]), cy: f2(g.p[1]), r: 5, fill: css(showMix(hex(c.hex))) })); });

  // Ce que la palette atteint (teintes franches) et ce qui lui échappe
  const vives = HUE12.filter((_, k) => best[k] >= 0.09), absentes = HUE12.filter((_, k) => best[k] < 0.035);
  $('palReach').textContent = (vives.length ? 'Teintes franches : ' + vives.join(', ') + '. ' : 'Aucune teinte franche : une palette sourde. ')
    + (absentes.length ? 'Hors d’atteinte ou très ternes : ' + absentes.join(', ') + '.' : 'Toutes les teintes sont atteignables, au moins ternes.');
  $('palPlanche').setAttribute('aria-label', 'Planche des mélanges de ' + cols.map((c) => c.name).join(', ') + (mx.blanc ? ' et du blanc' : ''));
}
$('mixGris').addEventListener('click', () => { mx.gris = !mx.gris; renderMix(); });
window.addEventListener('storage', (e) => { if (e.key !== 'tools:arts:melangeur:atelier') return; if (view === 'melange') renderMix(); if (view === 'temperature') renderTemp(); });
window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (v === 'palette') { setView(v, true); renderMix(); } else if (TABS[v] && v !== view) setView(v, true); });

/* ---------- Températures et neutres ---------- */
// Température : direction de la teinte (OKLab) entre l'orange, le plus chaud (55°), et le bleu, le plus froid (235°).
// Réchauffer = ajouter la couleur voisine côté orange ; refroidir = la voisine côté bleu ; griser = un peu de la complémentaire.
// Les couleurs ajoutées sont choisies dans la source affichée (génériques ou inventaire). Calcul indicatif.
const WARM_H = 55, COOL_H = 235;
const t0 = readJSON('temperature') || {};
const tmp = {
  id: typeof t0.id === 'string' ? t0.id : 'g:Rouge de cadmium clair', gris: false,
  act: ['warm', 'cool', 'grey'].indexOf(t0.act) !== -1 ? t0.act : 'warm',
  dose: Number.isInteger(t0.dose) && t0.dose >= 0 && t0.dose <= 4 ? t0.dose : 1,
};
const saveT = () => writeJSON('temperature', { id: tmp.id, act: tmp.act, dose: tmp.dose });
const lch = (c) => { const [L, A, B] = toOklab(c); return { L, C: Math.hypot(A, B), h: mod(Math.atan2(B, A) * 180 / Math.PI, 360) }; };
const hdiff = (a, b) => { const d = mod(b - a, 360); return d > 180 ? d - 360 : d; };   // de a vers b, au plus court
const showT = (c) => (tmp.gris ? toGray(c) : c);
function tBase() {
  const list = pool();
  return list.find((p) => p.id === tmp.id) || list.find((p) => p.id === 'g:Rouge de cadmium clair') || list[0] || null;
}
// Couleur voisine dans la direction d'une teinte cible (chaud ou froid) ; aucune si la base y est déjà
function towards(base, target) {
  const lb = lch(hex(base.hex)), way = hdiff(lb.h, target);
  if (Math.abs(way) < 15 || lb.C < 0.03) return null;
  let best = null, bs = Infinity;
  pool().forEach((t) => {
    if (t.hex.toLowerCase() === base.hex.toLowerCase()) return;
    const l = lch(hex(t.hex)); if (l.C < 0.05) return;
    const d = hdiff(lb.h, l.h);
    if (Math.sign(d) !== Math.sign(way) || Math.abs(d) < 10 || Math.abs(d) > Math.abs(way) + 40) return;
    const sc = Math.abs(d) - 60 * l.C;   // proche en teinte, et assez vive
    if (sc < bs) { bs = sc; best = t; }
  });
  return best;
}
// Complémentaire : la couleur la plus opposée en teinte, assez vive pour griser vite
function complement(base) {
  const lb = lch(hex(base.hex)); if (lb.C < 0.03) return null;
  let best = null, bs = Infinity;
  pool().forEach((t) => {
    const l = lch(hex(t.hex)); if (l.C < 0.04) return;
    const sc = Math.abs(180 - Math.abs(hdiff(lb.h, l.h))) - 40 * l.C;
    if (sc < bs) { bs = sc; best = t; }
  });
  return best && Math.abs(hdiff(lb.h, lch(hex(best.hex)).h)) > 120 ? best : null;
}
// Rapport simple (au plus 12 parts) le plus proche d'une part f d'ajout : [parts de base, parts ajoutées]
function ratio(f) {
  let best = [1, 0], be = 1;
  for (let a = 1; a <= 12; a++) for (let b = 1; b <= 12; b++) { const e = Math.abs(b / (a + b) - f); if (e < be - 1e-9) { be = e; best = [a, b]; } }
  return reduceParts(best);
}
const partsTxt = (n) => n + (n > 1 ? ' parts' : ' part');
// Une action à la fois : réchauffer, refroidir ou griser ; une dose de « un peu » à « beaucoup » ;
// couleur + ajout = résultat en grand, et la jauge de température avant → après.
const ACTS = ['warm', 'cool', 'grey'];
const DOSES = [0.08, 0.14, 0.22, 0.33, 0.5];   // part de la couleur ajoutée (réchauffer, refroidir)
const tempLabel = (c) => { const l = lch(c), w = Math.cos(hdiff(l.h, WARM_H) * Math.PI / 180); return l.C < 0.03 ? 'grise' : w > 0.3 ? 'chaude' : w < -0.3 ? 'froide' : 'intermédiaire'; };
const warmth = (c) => { const l = lch(c); return l.C < 0.03 ? 0 : Math.cos(hdiff(l.h, WARM_H) * Math.PI / 180) * Math.min(1, l.C / 0.08); };
function eqTerm(color, txt, sub, cls) {
  const d = document.createElement('div'); d.className = 't-term' + (cls ? ' ' + cls : '');
  const sw = document.createElement('span'); sw.className = 't-rsw'; sw.style.background = css(showT(color));
  const t = document.createElement('span'); t.className = 't-tn'; t.textContent = txt;
  d.append(sw, t);
  if (sub) { const s = document.createElement('small'); s.textContent = sub; d.appendChild(s); }
  return d;
}
const eqOp = (c) => { const o = document.createElement('span'); o.className = 't-op'; o.textContent = c; return o; };
function renderTemp() {
  inventaire = readInventaire();
  document.querySelectorAll('#tSrcSeg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === mx.src)));
  document.querySelectorAll('#tAct button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === tmp.act)));
  $('tAct').dataset.i = String(ACTS.indexOf(tmp.act));
  $('tGris').setAttribute('aria-pressed', String(tmp.gris));
  const base = tBase(), pk = $('tPick'), eq = $('tEq'), ds = $('tDose');
  pk.textContent = ''; eq.textContent = ''; ds.textContent = '';
  if (!base) { pk.textContent = 'Aucun tube dans l’inventaire'; $('tSentence').textContent = ''; return; }

  // bouton de la couleur : pastille, nom, pigment
  const sw = document.createElement('span'); sw.className = 'slot-sw'; sw.style.background = css(showT(hex(base.hex)));
  const tx = document.createElement('span'); tx.className = 'slot-tx';
  const nm = document.createElement('b'); nm.textContent = base.name;
  const pg = document.createElement('small'); pg.textContent = [base.pig, base.group].filter(Boolean).join(' · ');
  tx.append(nm, pg);
  const chev = document.createElementNS(SVGNS, 'svg'); chev.setAttribute('viewBox', '0 0 24 24'); chev.setAttribute('aria-hidden', 'true'); chev.classList.add('chev');
  chev.appendChild(el('path', { d: 'M7 10l5 5 5-5' }));
  pk.append(sw, tx, chev);
  pk.setAttribute('aria-label', 'Votre couleur : ' + base.name + '. Changer');

  const bh = hex(base.hex);
  const agent = tmp.act === 'warm' ? towards(base, WARM_H) : tmp.act === 'cool' ? towards(base, COOL_H) : complement(base);
  const mixT = (f) => mixOf([base.hex, agent.hex], [1 - f, f]);
  const verb = { warm: 'réchauffer', cool: 'refroidir', grey: 'griser' }[tmp.act];

  // Doses : pour griser, jusqu'au mélange le plus neutre avec la complémentaire
  let fr = DOSES;
  if (agent && tmp.act === 'grey') {
    let fStar = 0.5, cMin = Infinity;
    for (let f = 0.02; f <= 0.7; f += 0.02) { const c = lch(mixT(f)).C; if (c < cMin) { cMin = c; fStar = f; } }
    fr = [0.2, 0.4, 0.6, 0.8, 1].map((k) => fStar * k);
  }
  const dose = Math.max(0, Math.min(fr.length - 1, tmp.dose));

  if (!agent) {
    eq.appendChild(eqTerm(bh, base.name, '', 'res'));
    const why = tmp.act === 'warm' ? 'Elle est déjà du côté le plus chaud.' : tmp.act === 'cool' ? 'Elle est déjà du côté le plus froid.'
      : lch(bh).C < 0.03 ? 'Elle est déjà neutre.' : 'Pas de complémentaire dans cette liste.';
    $('tSentence').textContent = 'Impossible de ' + verb + ' cette couleur : ' + why.charAt(0).toLowerCase() + why.slice(1);
    const p = document.createElement('p'); p.className = 't-none'; p.textContent = why; ds.appendChild(p);
    setGauge(bh, bh);
    return;
  }
  const f = fr[dose], res = mixT(f), r = ratio(f);
  eq.append(
    eqTerm(bh, partsTxt(r[0]), base.name),
    eqOp('+'),
    eqTerm(hex(agent.hex), partsTxt(r[1]), agent.name),
    eqOp('='),
    eqTerm(res, 'Résultat', '', 'res'),
  );
  // Cases de dose : chacune montre son résultat
  fr.forEach((fk, k) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 't-step'; b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(k === dose));
    const rk = ratio(fk);
    b.setAttribute('aria-label', partsTxt(rk[1]) + ' de ' + agent.name + ' pour ' + partsTxt(rk[0]));
    b.style.background = css(showT(mixT(fk)));
    b.addEventListener('click', () => { tmp.dose = k; saveT(); renderTemp(); });
    ds.appendChild(b);
  });
  $('tSentence').textContent = 'Pour la ' + verb + ' : ajoutez ' + partsTxt(r[1]) + ' de ' + agent.name + ' pour ' + partsTxt(r[0]) + ' de votre couleur.';
  setGauge(bh, res);
}
// Jauge : repère pâle = la couleur de départ, repère plein = le résultat
function setGauge(from, to) {
  const pos = (c) => ((warmth(c) + 1) / 2 * 100).toFixed(1) + '%';
  $('tMark0').style.left = pos(from); $('tMark').style.left = pos(to);
  const a = tempLabel(from), b = tempLabel(to);
  $('tTemp').textContent = a === b ? a : a + ' → ' + b;
}
document.querySelectorAll('#tAct button').forEach((b) => b.addEventListener('click', () => { tmp.act = b.dataset.v; saveT(); renderTemp(); }));
$('tPick').addEventListener('click', () => openPicker('temp', $('tPick'), {
  get: () => tmp.id,
  set: (id) => { tmp.id = id; saveT(); renderTemp(); $('tPick').focus(); },
}));
document.querySelectorAll('#tSrcSeg button').forEach((b) => b.addEventListener('click', () => {
  if (mx.src === b.dataset.v) return;
  mx.src = b.dataset.v; saveMix(); renderTemp();
}));
$('tGris').addEventListener('click', () => { tmp.gris = !tmp.gris; renderTemp(); });

/* ---------- Théorie des couleurs ---------- */
// Illustrations générées ici (cercle du peintre de l'onglet Cercle) ; textes originaux.
const ryb = (a) => rybColor(mod(a, 360));
const div = (cls, bg) => { const d = document.createElement('div'); if (cls) d.className = cls; if (bg) d.style.background = css(bg); return d; };
const RYB_NAMES = NAMES.ryb;
let thPrimRank = 0;

function thPrim() {
  const svg = $('thPrimFig'); svg.textContent = '';
  for (let i = 0; i < 12; i++) {
    const on = thPrimRank === 1 ? i % 2 === 1 : i % 4 === thPrimRank;
    svg.appendChild(el('path', { class: on ? 'th-sec on' : 'th-sec', d: sector(i * 30 - 15, i * 30 + 15, 100, 56), fill: css(ryb(i * 30)) }));
  }
  if (thPrimRank === 0) svg.appendChild(el('path', { class: 'th-link', d: poly([pt(0, 52), pt(120, 52), pt(240, 52)]) }));
  if (thPrimRank === 2) svg.appendChild(el('path', { class: 'th-link', d: poly([pt(60, 52), pt(180, 52), pt(300, 52)]) }));
  const lines = {
    0: ['Jaune, rouge, bleu', 'ne s’obtiennent par aucun mélange'],
    2: ['Jaune + rouge = orange', 'Rouge + bleu = violet', 'Bleu + jaune = vert'],
    1: ['Primaire + secondaire voisine', 'ex. jaune + orange = jaune orangé'],
  }[thPrimRank];
  lines.forEach((t, k) => {
    const tx = el('text', { class: 'th-center', x: 0, y: (k - (lines.length - 1) / 2) * 11 + 3 }); tx.textContent = t; svg.appendChild(tx);
  });
  document.querySelectorAll('#thPrimSeg button').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.v) === thPrimRank)));
  const names = []; for (let i = 0; i < 12; i++) if (thPrimRank === 1 ? i % 2 === 1 : i % 4 === thPrimRank) names.push(RYB_NAMES[i]);
  svg.setAttribute('aria-label', 'Cercle du peintre ; en évidence : ' + names.join(', '));
}
// Dilemme des complémentaires : la couleur et trois partenaires (cercle du peintre) : la complémentaire exacte,
// la fausse complémentaire (voisine à 30°) et la fausse complémentaire décalée (45°, 60° ou 75°, même côté),
// cette dernière en nuance pure, pastel (éclaircie au blanc) ou rompue (grisée). Le motif fin fait vibrer.
let thCompMode = 'carre', thCompGap = 45, thCompNu = 'pastel';
// Nom d'une teinte du cercle (au plus proche des 12), avec sa nuance
function thName(ang) {
  const n = RYB_NAMES[mod(Math.round(mod(ang, 360) / 30), 12)].toLowerCase();
  return thCompNu === 'pastel' ? n + ' pâle' : thCompNu === 'rompue' ? n + ' rompu' : n;
}
// Nuance : pastel = éclaircie au blanc et adoucie ; rompue = grisée à clarté égale (OKLab)
function nuance(c) {
  if (thCompNu === 'pastel') { const [L, A, B] = toOklab(c); return fromOklab([L + (1 - L) * 0.55, A * 0.55, B * 0.55]); }
  if (thCompNu === 'rompue') return desat(c, 0.45);
  return c;
}
function thComp() {
  const a = Number($('thCompHue').value), base = ryb(a);
  const fill = (id, ang, noteId, nu) => {
    const box = $(id), inner = box.querySelector('span'), p = nu ? nuance(ryb(ang)) : ryb(ang), A = css(base), B = css(p);
    inner.style.background = B; inner.hidden = thCompMode !== 'carre';
    box.style.background = thCompMode === 'rayures' ? 'repeating-linear-gradient(90deg, ' + A + ' 0 9px, ' + B + ' 9px 18px)'
      : thCompMode === 'damier' ? 'repeating-conic-gradient(' + A + ' 0 25%, ' + B + ' 0 50%) 0 0 / 22px 22px' : A;
    const name = nu ? thName(ang) : RYB_NAMES[mod(ang, 360) / 30].toLowerCase();
    box.setAttribute('aria-label', RYB_NAMES[a / 30] + ' et ' + name);
    $(noteId).textContent = name;
  };
  fill('thCompA', a + 180, 'thCompAn', false);              // complémentaire exacte, pure : la référence
  fill('thCompB', a + 150, 'thCompBn', false);              // fausse complémentaire : voisine à 30°, pure
  fill('thCompC', a + 180 - thCompGap, 'thCompCn', true);   // décalée : plus loin, même côté, avec sa nuance
  document.querySelectorAll('#thCompMode button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.v === thCompMode)));
  document.querySelectorAll('#thCompGap button').forEach((x) => x.setAttribute('aria-pressed', String(Number(x.dataset.v) === thCompGap)));
  document.querySelectorAll('#thCompNu button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.v === thCompNu)));
}
function thTemp() {
  const c = Number($('thTempHue').value), fig = $('thTempFig'); fig.textContent = '';
  // voisine plus chaude : vers l'orange (60°) ; plus froide : vers le bleu (240°), sur le cercle du peintre
  const step = (target) => { const d = hdiff(c, target); return Math.abs(d) < 1 ? null : c + Math.sign(d) * 60; };
  const w = step(60), k = step(240);
  [[w, 'Entourée d’une couleur plus chaude, elle paraît plus froide.'], [k, 'Entourée d’une couleur plus froide, elle paraît plus chaude.']].forEach(([n, txt]) => {
    const row = div('th-trow');
    const box = div('th-surround', n === null ? ryb(c) : ryb(n)); box.appendChild(div('th-in', ryb(c)));
    const p = document.createElement('p'); p.textContent = n === null ? 'C’est déjà la couleur la plus ' + (txt.indexOf('chaude,') !== -1 ? 'chaude.' : 'froide.') : txt;
    row.append(box, p); fig.appendChild(row);
  });
}
function thVal() {
  const a = Number($('thValHue').value), g = $('thValFig'); g.textContent = '';
  const [, A, B] = toOklab(ryb(a)), n = Math.hypot(A, B) || 1, gris = $('thValGris').checked;
  [0.92, 0.82, 0.72, 0.62, 0.52, 0.42, 0.32].forEach((L) => {
    [0.1, 0.25, 0.45, 0.65, 0.85, 1].forEach((s) => {
      const C = s * 0.17, c = fromOklab([L, A / n * C, B / n * C]);
      g.appendChild(div('', gris ? toGray(c) : c));
    });
  });
}
// Les 7 contrastes : une tuile chacun (numéro, titre, grande illustration, phrase) ; le simultané en grand
function thSeven() {
  const box = $('thSeven'); box.textContent = '';
  let num = 0;
  const head = (title) => {
    const h = div('th-c-head');
    const n = document.createElement('span'); n.className = 'th-num'; n.textContent = String(++num);
    const t = document.createElement('h3'); t.textContent = title;
    h.append(n, t); return h;
  };
  const item = (title, text, fig, wide) => {
    const it = document.createElement('article'); it.className = wide ? 'th-c th-c-wide' : 'th-c';
    const f = div('th-c-fig'); fig(f);
    if (!wide) {
      const p = document.createElement('p'); p.textContent = text;
      it.append(f, head(title), p); box.appendChild(it); return;
    }
    // Large : titre, puis le texte (amorce, exemples) à gauche et les figures à droite
    const body = div('th-wide-body'), tx = div('th-wide-txt');
    text.forEach((t, i) => { const p = document.createElement('p'); if (i === 0) p.className = 'th-lead'; p.textContent = t; tx.appendChild(p); });
    body.append(tx, f); it.append(head(title), body); box.appendChild(it);
  };
  // Bande de couleurs ; poids (flex) et étiquettes facultatifs, écrites en noir ou blanc selon le fond
  const row = (f, cols, flex, labels) => {
    const r = div('th-strip');
    cols.forEach((c, i) => {
      const d = div('', c); if (flex) d.style.flex = flex[i];
      if (labels) { d.textContent = labels[i]; d.style.color = toGray(c)[0] > 0.55 ? '#000' : '#fff'; }
      r.appendChild(d);
    });
    f.appendChild(r);
  };
  item('De la couleur en soi', 'Des couleurs pures et franches, côte à côte : le contraste le plus simple, le plus éclatant.', (f) => row(f, [ryb(0), ryb(120), ryb(240)]));
  item('Clair-obscur', 'L’opposition du clair et du foncé ; il fonctionne même sans couleur.', (f) => row(f, [0.96, 0.78, 0.6, 0.42, 0.24, 0.1].map((L) => fromOklab([L, 0, 0]))));
  item('Chaud-froid', 'Une couleur chaude face à une froide : l’une avance, l’autre recule.', (f) => {
    const s = div('th-split'); s.append(div('', ryb(60)), div('', ryb(255))); f.appendChild(s);
  });
  item('Des complémentaires', 'Deux opposées du cercle : elles s’exaltent côte à côte et se neutralisent en mélange.', (f) => {
    // deux moitiés, chacune portant un éclat de l'autre
    const s = div('th-split th-split-dots');
    const a = div('', ryb(120)), b = div('', ryb(300));
    a.appendChild(div('th-dot', ryb(300))); b.appendChild(div('th-dot', ryb(120)));
    s.append(a, b); f.appendChild(s);
  });
  item('De qualité', 'Une couleur vive entourée de ses versions ternies paraît plus lumineuse encore.', (f) => {
    const s = div('th-surround th-qual', desat(ryb(120), 0.3)); s.appendChild(div('th-in', ryb(120))); f.appendChild(s);
  });
  item('De quantité', 'L’équilibre vient des surfaces : une couleur lumineuse en petite quantité tient tête à une sombre plus étendue.', (f) => {
    f.classList.add('th-qty');
    row(f, [ryb(0), ryb(180)], [1, 3], ['1', '3']);
    row(f, [ryb(60), ryb(240)], [1, 2], ['1', '2']);
    row(f, [ryb(120), ryb(300)], [1, 1], ['1', '1']);
  });
  // Contraste simultané : textes et figures originaux. Fonds très saturés (rouge vif, vert émeraude vif, bleu profond) :
  // l’effet se voit d’autant mieux que le fond est vif, étendu, et que le gris est de clarté voisine.
  item('Simultané', [
    'L’œil ne voit jamais une couleur seule : il la compare à ce qui l’entoure et ajoute de lui-même la complémentaire du fond.',
    'Un même gris posé sur du rouge semble verdir ; posé sur du vert, il semble rosir. Cochez « Relier » : c’est bien le même gris.',
    'Entre complémentaires, l’effet s’additionne : l’orange posé sur le bleu gagne en éclat.',
  ], (f) => {
    const r = div('th-sim'); const g = fromOklab([0.62, 0, 0]);
    const fig = (bg, inner, cap) => {
      const fg = document.createElement('figure'); fg.className = 'th-simf';
      const s2 = div('th-surround', bg); s2.appendChild(div('th-in', inner));
      const fc = document.createElement('figcaption'); fc.textContent = cap;
      fg.append(s2, fc); return fg;
    };
    r.append(
      fig(hex('#E8202A'), g, 'Gris sur rouge vif : il tire vers le vert'),
      fig(hex('#00A060'), g, 'Le même gris sur vert vif : il tire vers le rouge'),
      fig(hex('#1D3FC4'), hex('#FF7A00'), 'Orange sur bleu profond : plus éclatant'),
    );
    const bridge = div('th-bridge', g); bridge.hidden = true; r.appendChild(bridge);
    const lab = document.createElement('label'); lab.className = 'switch th-sw';
    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.addEventListener('change', () => { bridge.hidden = !cb.checked; });
    const sp = document.createElement('span'); sp.textContent = 'Relier les deux gris'; lab.append(cb, sp);
    f.append(r, lab);
  }, true);
}
function renderTheory() { thPrim(); thComp(); thTemp(); thVal(); thSeven(); }
document.querySelectorAll('#thPrimSeg button').forEach((b) => b.addEventListener('click', () => { thPrimRank = Number(b.dataset.v); thPrim(); }));
$('thCompHue').addEventListener('input', thComp);
document.querySelectorAll('#thCompMode button').forEach((x) => x.addEventListener('click', () => { thCompMode = x.dataset.v; thComp(); }));
document.querySelectorAll('#thCompGap button').forEach((x) => x.addEventListener('click', () => { thCompGap = Number(x.dataset.v); thComp(); }));
document.querySelectorAll('#thCompNu button').forEach((x) => x.addEventListener('click', () => { thCompNu = x.dataset.v; thComp(); }));
$('thTempHue').addEventListener('input', thTemp);
$('thValHue').addEventListener('input', thVal);
$('thValGris').addEventListener('change', thVal);

const LAYOUTS = ['below', 'right', 'focus'];
function setLayout(l, noSave) {
  l = LAYOUTS.indexOf(l) !== -1 ? l : 'below';
  document.querySelectorAll('.dash').forEach((d) => { d.dataset.layout = l; });
  document.querySelectorAll('button[data-layout]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.layout === l)));
  if (!noSave) writeJSON('disposition', l);
}
document.querySelectorAll('button[data-layout]').forEach((b) => b.addEventListener('click', () => setLayout(b.dataset.layout)));
const THEMES = ['site', 'gris', 'papier', 'contraste'];
function setTheme(t, noSave) {
  t = THEMES.indexOf(t) !== -1 ? t : 'site';
  if (t === 'site') document.documentElement.removeAttribute('data-palette'); else document.documentElement.setAttribute('data-palette', t);
  if (!noSave) writeJSON('theme', t);
  document.querySelectorAll('button[data-palette]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.palette === t)));
}
document.querySelectorAll('button[data-palette]').forEach((b) => b.addEventListener('click', () => setTheme(b.dataset.palette)));

/* ---------- Démarrage ---------- */
setLayout(readJSON('disposition'), true);
setTheme(readJSON('theme'), true);
setView(location.hash.slice(1), true);
render();
