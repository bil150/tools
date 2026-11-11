/* Pantin : mannequin articulé en 3D (three.js, copie locale), une série de poses pour s'entraîner à dessiner,
   un croquis chronométré et une lumière réglable pour étudier les valeurs. Aucune donnée ne quitte le navigateur. */
import * as THREE from '../../vendor/three/three.module.min.js';
import { POSES } from '../pantin-poses.js';

const $ = (id) => document.getElementById(id);
const NS = 'tools:arts:pantin:';
const readJSON = (k) => { try { return JSON.parse(localStorage.getItem(NS + k)); } catch (e) { return null; } };
const writeJSON = (k, v) => { try { localStorage.setItem(NS + k, JSON.stringify(v)); } catch (e) { /* stockage indisponible : sans importance */ } };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const reduceMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

/* ---------- Réglages gardés ---------- */
const DEF = { heads: 7.5, az: 300, el: 40, rendu: 'continu', ombre: true, sol: true, matiere: 'bois', forme: 'homme', duree: 60, seance: true };
const opts = Object.assign({}, DEF, readJSON('reglages') || {});
opts.heads = clamp(+opts.heads || DEF.heads, 6, 9);
opts.az = clamp(+opts.az || 0, 0, 360); opts.el = clamp(+opts.el || DEF.el, 5, 85);
if (['continu', '3', '2'].indexOf(opts.rendu) === -1) opts.rendu = DEF.rendu;
if (['gris', 'bois'].indexOf(opts.matiere) === -1) opts.matiere = DEF.matiere;
if (['homme', 'femme'].indexOf(opts.forme) === -1) opts.forme = DEF.forme;
if ([30, 60, 120, 300].indexOf(+opts.duree) === -1) opts.duree = DEF.duree;
const save = () => writeJSON('reglages', opts);

/* ---------- Scène ---------- */
const canvas = $('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
const hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 0.55);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = sun.shadow.camera.bottom = -7;
sun.shadow.camera.right = sun.shadow.camera.top = 7;
sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 60;
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);
// Sol : il reçoit l'ombre ; une grille légère (posée juste au-dessus) donne l'échelle et la perspective
// Sol d'une seule teinte (gris neutre) qui se fond au loin dans l'horizon ; ciel en dégradé : les deux suivent le thème
const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 1, metalness: 0 }));
scene.fog = new THREE.Fog(0x808080, 40, 140);
// ciel : un dôme autour de la caméra, clair à l'horizon et plus soutenu en haut ; l'horizon a la couleur du brouillard,
// le sol s'y fond sans ligne visible
const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() } },
  vertexShader: 'varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform vec3 top; uniform vec3 horizon; varying vec3 vDir;
void main() { float h = smoothstep(0.0, 0.75, normalize(vDir).y); gl_FragColor = vec4(mix(horizon, top, h), 1.0);
#include <colorspace_fragment>
}`
}));
sky.scale.setScalar(150); sky.renderOrder = -1; sky.frustumCulled = false;
scene.add(sky);
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
scene.add(floor);
const grid = new THREE.GridHelper(24, 24, 0x888888, 0x888888);
grid.material.transparent = true; grid.material.opacity = 0.25;
grid.position.y = 0.01; scene.add(grid);

/* ---------- Matières et rendus (continu, 3 tons, 2 tons : pour étudier les valeurs) ---------- */
const MATIERE = { gris: 0xc9c9c9, bois: 0xffffff };   // le bois tient sa couleur de la texture (fil du bois)
// Fil du bois dessiné une fois : veines dans le sens de la longueur des pièces (comme un mannequin d'atelier en hêtre)
function woodTexture() {
  const W = 256, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#d6b88e'; g.fillRect(0, 0, W, H);
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 90; i++) {
    const x0 = rnd() * W, w = 0.6 + rnd() * 2.2, a = 0.05 + rnd() * 0.16, amp = 2 + rnd() * 7, f = 1 + rnd() * 3;
    g.strokeStyle = 'rgba(120,80,40,' + a.toFixed(3) + ')'; g.lineWidth = w;
    g.beginPath();
    for (let y = 0; y <= H; y += 8) { const x = x0 + Math.sin(y / H * Math.PI * 2 * f + i) * amp; if (y) g.lineTo(x, y); else g.moveTo(x, y); }
    g.stroke();
  }
  for (let i = 0; i < 260; i++) { g.fillStyle = 'rgba(255,240,215,' + (rnd() * 0.06).toFixed(3) + ')'; g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 3, 6 + rnd() * 30); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}
const WOOD = woodTexture();
function toonRamp(n) {
  const data = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) { const v = Math.round(255 * (n === 2 ? [0.25, 1][i] : [0.18, 0.55, 1][i])); data.set([v, v, v, 255], i * 4); }
  const t = new THREE.DataTexture(data, n, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true;
  return t;
}
const RAMPS = { 3: toonRamp(3), 2: toonRamp(2) };
// trois matières : le pantin, les meubles (gris neutre), les écrans (sombres)
function makeMaterials() {
  const bois = opts.matiere === 'bois';
  const mk = (color, map) => opts.rendu === 'continu'
    ? new THREE.MeshStandardMaterial({ color, map: map || null, roughness: 0.62, metalness: 0 })
    : new THREE.MeshToonMaterial({ color: map ? 0xd6b88e : color, gradientMap: RAMPS[opts.rendu] });
  return { fig: mk(bois ? MATIERE.bois : MATIERE.gris, bois ? WOOD : null), prop: mk(0x9c9c9c), dark: mk(0x2b2b2b) };
}
let mats = makeMaterials();

/* ---------- Le pantin d'atelier : pièces de bois fuselées reliées par des rotules ---------- */
// Unité : la hauteur de la tête. À 7,5 têtes : genou à 2, hanche à 3,9, coude à la taille, poignet à l'entrejambe,
// bout des doigts à mi-cuisse, épaules larges de 2 têtes. Le réglage des proportions étire tout sauf la tête.
const BASE = { pied: 0.3, jambe: 1.75, cuisse: 1.85, hancheY: 0.15, taille: 0.4, abdomen: 0.35, thorax: 1.45, epauleY: 1.25,
  cou: 0.3, bras: 1.4, avantBras: 1.15, main: 0.75, epauleX: 0.82, hancheX: 0.45 };
let joints = {}, held = {}, tips = {}, figure = null, props = [];

function part(geo, parent, pos, scale, mat, rot) {
  const m = new THREE.Mesh(geo, mats[mat || 'fig']);
  m.userData.mat = mat || 'fig';
  m.castShadow = true; m.receiveShadow = true;
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  if (scale) m.scale.set(scale[0], scale[1], scale[2]);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  parent.add(m);
  return m;
}
const BALL = new THREE.SphereGeometry(1, 32, 20);
// pièce tournée (comme au tour à bois) : profil [rayon, hauteur] de bas en haut
const lathe = (pts) => new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), 40);
// segment de membre qui descend depuis l'articulation : r0 en haut, rb renflement, r1 en bas
function limb(len, r0, rb, r1, gapTop, gapBot) {
  const a = -gapTop, b = -len + gapBot, h = a - b;
  return lathe([[0, b], [r1 * 0.75, b], [r1, b + h * 0.06], [rb * 0.92, b + h * 0.55], [rb, b + h * 0.72], [r0, a - h * 0.06], [r0 * 0.75, a], [0, a]]);
}
function joint(name, parent, pos, side) {
  const g = new THREE.Group();
  g.position.set(pos[0], pos[1], pos[2]);
  g.userData = { name, side: side || 0 };
  parent.add(g);
  joints[name] = g;
  return g;
}
// pied en coin : profil de côté (avant = +z), extrudé sur la largeur
function footGeo(len) {
  const s = new THREE.Shape(), k = len / 1.05, y0 = -BASE.pied + 0.035;
  s.moveTo(-0.22, y0); s.lineTo(0.78 * k, y0); s.quadraticCurveTo(0.9 * k, y0, 0.88 * k, y0 + 0.08);
  s.quadraticCurveTo(0.8 * k, y0 + 0.17, 0.42 * k, 0.0 - 0.1); s.quadraticCurveTo(0.12, 0.04, -0.12, 0.02);
  s.quadraticCurveTo(-0.28, 0.0, -0.28, -0.12); s.quadraticCurveTo(-0.28, y0, -0.22, y0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.035, bevelSegments: 3, curveSegments: 10 });
  g.rotateY(-Math.PI / 2); g.translate(0.15, 0, 0);
  return g;
}

function buildFigure() {
  if (figure) { scene.remove(figure); figure.traverse((o) => { if (o.geometry && o.geometry !== BALL) o.geometry.dispose(); }); }
  joints = {}; held = {}; tips = {};
  const k = (opts.heads - 1) / (7.5 - 1);   // étirement du corps (la tête garde sa taille)
  const L = {}; Object.keys(BASE).forEach((n) => { L[n] = BASE[n] * k; });
  L.epauleX = BASE.epauleX; L.hancheX = BASE.hancheX; L.pied = BASE.pied;
  // forme féminine : épaules plus étroites, taille plus fine, bassin plus large, poitrine, membres plus fins
  const F = opts.forme === 'femme';
  const W = F ? { thorax: 0.9, taille: 0.84, bassin: 1.2, membre: 0.88, cuisse: 1.04, cou: 0.88 } : { thorax: 1.04, taille: 1, bassin: 1.05, membre: 1, cuisse: 1, cou: 1 };
  if (F) { L.epauleX = 0.7; L.hancheX = 0.52; }

  figure = new THREE.Group();
  scene.add(figure);
  const corps = joint('corps', figure, [0, 0, 0]);
  // bassin : bloc tourné, plus large que profond, qui se resserre vers l'entrejambe
  const bassin = joint('bassin', corps, [0, 0, 0]);
  part(lathe([[0, -0.46], [0.26, -0.45], [0.5, -0.32], [0.6, -0.1], [0.6, 0.12], [0.53, 0.32], [0.36, 0.42], [0, 0.44]]), bassin, [0, 0, 0], [W.bassin, 1, F ? 0.72 : 0.68]);
  // abdomen : pièce courte entre bassin et thorax, la taille plie ici
  const taille = joint('taille', bassin, [0, L.taille, 0]);
  part(lathe([[0, -0.12], [0.36, -0.1], [0.44, 0.06], [0.43, L.abdomen * 0.7], [0.3, L.abdomen + 0.05], [0, L.abdomen + 0.08]]), taille, [0, 0, 0], [W.taille, 1, 0.72 * (F ? 0.92 : 1)]);
  // thorax : cage en bloc, évasée vers les épaules, aplatie d'avant en arrière
  const thorax = joint('thorax', taille, [0, L.abdomen, 0]);
  const T = L.thorax;
  // forme féminine : seulement une ondulation douce du buste (taille fine, galbe au milieu), sans seins
  const prof = F
    ? [[0, 0], [0.38, 0], [0.5, T * 0.14], [0.66, T * 0.5], [0.7, T * 0.64], [0.64, T * 0.8], [0.62, T * 0.88], [0.44, T * 0.97], [0, T]]
    : [[0, 0], [0.42, 0], [0.55, T * 0.12], [0.68, T * 0.45], [0.74, T * 0.72], [0.68, T * 0.88], [0.46, T * 0.97], [0, T]];
  part(lathe(prof), thorax, [0, 0, -0.02], [W.thorax, 1, F ? 0.66 : 0.64]);
  const cou = joint('cou', thorax, [0, T, -0.04]);
  part(lathe([[0, -0.2], [0.2, -0.2], [0.18, L.cou * 0.5], [0.17, L.cou + 0.05], [0, L.cou + 0.06]]), cou, [0, 0, 0], [W.cou, 1, W.cou]);
  part(BALL, cou, [0, 0.02, 0], [0.19, 0.12, 0.19]);
  // tête : œuf sans visage, pointe (menton) vers le bas et l'avant
  const tete = joint('tete', cou, [0, L.cou, 0]);
  part(lathe([[0, 0], [0.16, 0.03], [0.27, 0.18], [0.34, 0.42], [0.36, 0.64], [0.33, 0.82], [0.22, 0.95], [0, 1]]), tete, [0, -0.06, 0.08], [1, 1, 1.18], 'fig', [-0.3, 0, 0]);
  [['G', 1], ['D', -1]].forEach(([s, sd]) => {
    // bras
    const ep = joint('epaule' + s, thorax, [sd * L.epauleX, L.epauleY, -0.04], sd);
    part(BALL, ep, [0, 0, 0], [0.235, 0.235, 0.235]);
    part(limb(L.bras, 0.2 * W.membre, 0.21 * W.membre, 0.13 * W.membre, 0.12, 0.08), ep);
    const co = joint('coude' + s, ep, [0, -L.bras, 0], sd);
    part(BALL, co, [0, 0, 0], [0.14, 0.14, 0.14]);
    part(limb(L.avantBras, 0.155 * W.membre, 0.165 * W.membre, 0.1 * W.membre, 0.07, 0.06), co);
    const po = joint('poignet' + s, co, [0, -L.avantBras, 0], sd);
    part(BALL, po, [0, 0, 0], [0.1, 0.1, 0.1]);
    // main en palette (paume vers le corps quand le bras pend), pouce vers l'avant
    const M = L.main;
    part(BALL, po, [0, -M * 0.3, 0.0], [0.085, M * 0.3, 0.2]);
    part(BALL, po, [-sd * 0.012, -M * 0.66, 0.0], [0.07, M * 0.31, 0.185]);
    part(lathe([[0, -0.3], [0.045, -0.28], [0.055, -0.1], [0.05, 0], [0, 0.01]]), po, [-sd * 0.04, -M * 0.16, 0.15], [1, M / 0.75, 1], 'fig', [-0.3, 0, -sd * 0.2]);
    tips[s] = new THREE.Object3D(); tips[s].position.set(0, -M, 0); po.add(tips[s]);   // bout des doigts (pour la borne)
    // jambe
    const ha = joint('hanche' + s, bassin, [sd * L.hancheX, -L.hancheY, 0], sd);
    part(BALL, ha, [0, 0, 0], [0.28, 0.28, 0.28]);
    part(limb(L.cuisse, 0.32 * W.cuisse, 0.31 * W.cuisse, 0.18, 0.12, 0.1), ha);
    const ge = joint('genou' + s, ha, [0, -L.cuisse, 0], sd);
    part(BALL, ge, [0, 0, 0], [0.19, 0.19, 0.19]);
    part(limb(L.jambe, 0.19 * W.membre, 0.215 * W.membre, 0.115 * W.membre, 0.08, 0.08), ge);
    const ch = joint('cheville' + s, ge, [0, -L.jambe, 0], sd);
    part(BALL, ch, [0, 0, 0], [0.12, 0.12, 0.12]);
    part(footGeo(1.05 * Math.max(1, k * 0.9)), ch);
  });
  // objets tenus en main (téléphone, tablette) : rangés près des mains, montrés selon la pose
  const hold = (name, s, w, h) => {
    const g = new THREE.Group(); g.visible = false;
    const sd = s === 'G' ? 1 : -1;
    part(new THREE.BoxGeometry(0.045, h, w), g, [0, 0, 0], null, 'dark');
    part(new THREE.BoxGeometry(0.01, h * 0.9, w * 0.88), g, [-sd * 0.026, 0, 0], null, 'prop');   // l'écran, côté paume
    joints['poignet' + s].add(g);
    held[name + s] = g;
    return g;
  };
  ['G', 'D'].forEach((s) => {
    const sd = s === 'G' ? 1 : -1;
    hold('telephone', s, 0.33, 0.68).position.set(-sd * 0.13, -L.main * 0.48, 0.03);
    hold('tablette', s, 1.05, 0.75).position.set(-sd * 0.13, -L.main * 0.55, -0.3);
  });
}

/* ---------- Poses : angles du mouvement → rotations, puis le pantin est posé au sol ---------- */
const D2R = Math.PI / 180;
const AXES = {   // pour chaque famille d'articulations : comment [a, b, c] devient une rotation
  tronc: (a, s) => [a[0], (a[2] || 0), -(a[1] || 0)],                    // fléchir (x), tourner (y), pencher (z)
  membre: (a, s) => [-a[0], (a[2] || 0) * s, (a[1] || 0) * s],            // lever vers l'avant, tourner, écarter
  coude: (a) => [-a[0], 0, 0],
  genou: (a) => [a[0], 0, 0],
  poignet: (a, s) => [-a[0], (a[1] || 0) * s, 0],                         // fléchir, tourner la paume (pronation / supination)
  cheville: (a) => [-a[0], 0, 0]
};
function kind(name) {
  if (/^(corps|bassin|taille|thorax|cou|tete)$/.test(name)) return 'tronc';
  if (/^(epaule|hanche)/.test(name)) return 'membre';
  return name.replace(/[GD]$/, '');
}
function targetRotations(pose) {
  const out = {};
  Object.keys(joints).forEach((n) => {
    const a = (pose.j && pose.j[n]) || [0, 0, 0];
    const r = AXES[kind(n)](a, joints[n].userData.side || 1);
    out[n] = r.map((v) => v * D2R);
  });
  return out;
}
let current = POSES[0], shown = null, anim = null;
// poignet : la paume tourne d'abord (autour de l'avant-bras), puis la main se plie
function setRotations(rot) { Object.keys(rot).forEach((n) => { joints[n].rotation.set(rot[n][0], rot[n][1], rot[n][2], /^poignet/.test(n) ? 'XYZ' : 'YXZ'); }); }
// boîte englobante des seules pièces visibles (les objets rangés dans la main ne comptent pas)
const box = new THREE.Box3();
function boxOf(obj, out) {
  out.makeEmpty();
  obj.updateMatrixWorld(true);
  obj.traverseVisible((o) => { if (o.isMesh) out.expandByObject(o); });
  return out;
}
function showHeld(pose) {
  Object.keys(held).forEach((n) => { held[n].visible = !!(pose.tient && pose.tient[n.slice(-1)] === n.slice(0, -1)); });
}
// Meubles et accessoires : posés d'après le pantin une fois au sol (gris neutre, ils ne comptent pas dans le cadrage)
function prop(geo, pos, rot, mat) {
  const m = new THREE.Mesh(geo, mats[mat || 'prop']);
  m.userData.mat = mat || 'prop';
  m.position.set(pos[0], pos[1], pos[2]);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  m.castShadow = m.receiveShadow = true;
  scene.add(m); props.push(m);
  return m;
}
// plaque aux angles arrondis (largeur, hauteur, épaisseur, rayon des angles), centrée
function slab(w, h, d, r) {
  const sh = new THREE.Shape(), x = -w / 2, y = -h / 2;
  r = Math.min(r, w / 2, h / 2);
  sh.moveTo(x + r, y); sh.lineTo(x + w - r, y); sh.quadraticCurveTo(x + w, y, x + w, y + r); sh.lineTo(x + w, y + h - r);
  sh.quadraticCurveTo(x + w, y + h, x + w - r, y + h); sh.lineTo(x + r, y + h); sh.quadraticCurveTo(x, y + h, x, y + h - r);
  sh.lineTo(x, y + r); sh.quadraticCurveTo(x, y, x + r, y);
  const b = Math.min(0.04, d / 4);
  const g = new THREE.ExtrudeGeometry(sh, { depth: d - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 8 });
  g.translate(0, 0, -(d - 2 * b) / 2);
  return g;
}
function clearProps() { props.forEach((m) => { scene.remove(m); m.geometry.dispose(); }); props = []; }
const pelvisBox = new THREE.Box3();
function placeProps(pose) {
  clearProps();
  const acc = pose.accessoire;
  const pb = boxOf(joints.bassin.children[0], pelvisBox);
  const pc = new THREE.Vector3(); pb.getCenter(pc);
  if (acc === 'tabouret' || acc === 'chaise') {
    const h = Math.max(0.3, pb.min.y), r = acc === 'tabouret' ? 0.8 : 0;
    const cz = pc.z - 0.15;
    if (acc === 'tabouret') {
      prop(new THREE.CylinderGeometry(r, r, 0.14, 32), [pc.x, h - 0.07, cz]);
      [0, 1, 2].forEach((i) => {
        const a = i * Math.PI * 2 / 3 + 0.4, x = pc.x + Math.cos(a) * r * 0.62, z = cz + Math.sin(a) * r * 0.62;
        prop(new THREE.CylinderGeometry(0.06, 0.07, h - 0.14, 12), [x, (h - 0.14) / 2, z]);
      });
    } else {
      const w = 1.9, d = 1.8, sz = pb.min.z - 0.15 + d / 2;   // le fond de l'assise touche le bas du dos
      prop(new THREE.BoxGeometry(w, 0.14, d), [pc.x, h - 0.07, sz]);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([i, j]) => prop(new THREE.BoxGeometry(0.12, h - 0.14, 0.12), [pc.x + i * (w / 2 - 0.1), (h - 0.14) / 2, sz + j * (d / 2 - 0.1)]));
      const bz = sz - d / 2 + 0.06, bh = 2.3;
      [-1, 1].forEach((i) => prop(new THREE.BoxGeometry(0.12, bh, 0.12), [pc.x + i * (w / 2 - 0.1), h + bh / 2, bz]));
      prop(new THREE.BoxGeometry(w, 0.7, 0.1), [pc.x, h + bh - 0.45, bz]);
    }
  }
  if (acc === 'borne') {
    // borne de commande : colonne droite aux angles arrondis (environ 1,90 m), grand écran vertical,
    // lecteur de carte et fente à ticket dessous, sur un pied ; le bout des doigts de la main droite touche l'écran
    const t = new THREE.Vector3(); tips.D.getWorldPosition(t);
    const W = 2.4, H = 8.2, D = 0.9, front = t.z + 0.03, cz = front + D / 2, x = t.x;
    prop(slab(2.9, 0.14, 1.5, 0.12), [x, 0.07, cz + 0.1]);                          // pied
    prop(slab(W, H - 0.14, D, 0.3), [x, 0.14 + (H - 0.14) / 2, cz]);                 // colonne
    const sy = clamp(t.y + 0.6, 4.2, 6.2);                                           // écran : le doigt touche sa partie basse
    prop(slab(W - 0.36, 3.7, 0.04, 0.12), [x, sy, front - 0.01], null, 'dark');
    prop(slab(0.8, 0.5, 0.32, 0.08), [x, sy - 2.35, front - 0.14]);                  // lecteur de carte
    prop(slab(0.5, 0.18, 0.02, 0.06), [x, sy - 2.35, front - 0.31], null, 'dark');
    prop(slab(0.9, 0.08, 0.02, 0.03), [x, sy - 2.95, front - 0.01], null, 'dark');  // fente à ticket
  }
}
function placeOnGround(pose) {
  showHeld(pose);
  figure.position.set(0, 0, 0);
  boxOf(figure, box);
  const lift = typeof pose.sol === 'number' ? pose.sol : 0;
  figure.position.y = -box.min.y + lift;
  figure.position.x = -(box.min.x + box.max.x) / 2;   // centré sur la grille
  figure.position.z = -(box.min.z + box.max.z) / 2;
  boxOf(figure, box);
  placeProps(pose);
}
// Passage d'une pose à l'autre : court (respecte « moins d'animations »)
function applyPose(pose, instant) {
  const to = targetRotations(pose);
  const from = {};
  Object.keys(joints).forEach((n) => { const r = joints[n].rotation; from[n] = [r.x, r.y, r.z]; });
  current = pose;
  if (instant || reduceMotion.matches || !shown) {
    setRotations(to); placeOnGround(pose); shown = pose; frameCamera(pose); render(); return;
  }
  const t0 = performance.now(), dur = 380;
  if (anim) cancelAnimationFrame(anim);
  const step = (t) => {
    const u = Math.min(1, (t - t0) / dur), e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
    const mid = {};
    Object.keys(to).forEach((n) => { mid[n] = to[n].map((v, i) => from[n][i] + (v - from[n][i]) * e); });
    setRotations(mid); placeOnGround(u < 1 ? { tient: pose.tient } : pose); render();
    if (u < 1) anim = requestAnimationFrame(step); else { anim = null; shown = pose; placeOnGround(pose); frameCamera(pose); render(); }
  };
  anim = requestAnimationFrame(step);
}

/* ---------- Caméra : tourner autour du pantin (doigt, souris, clavier), zoomer (deux doigts, molette) ---------- */
const cam = { az: 20, el: 8, dist: 22, target: new THREE.Vector3(0, 3.8, 0) };
function updateCamera() {
  const a = cam.az * D2R, e = cam.el * D2R;
  camera.position.set(cam.target.x + cam.dist * Math.cos(e) * Math.sin(a), cam.target.y + cam.dist * Math.sin(e), cam.target.z + cam.dist * Math.cos(e) * Math.cos(a));
  camera.lookAt(cam.target);
  sky.position.copy(camera.position);
}
function fitDistance() {
  const s = new THREE.Vector3(); box.getSize(s);
  const r = Math.max(s.x, s.y, s.z) * 0.5 / 0.82;   // demi-taille, avec une marge de 18 %
  const vf = camera.fov * D2R, hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
  return clamp(r / Math.tan(Math.min(vf, hf) / 2) + Math.max(s.x, s.z) * 0.5, 6, 60);
}
function frameCamera() {
  const c = new THREE.Vector3(); box.getCenter(c);
  cam.target.copy(c);
  cam.dist = fitDistance();
  updateCamera();
}
const VIEWS = { face: [0, 6], troisquarts: [35, 10], profil: [90, 6], dos: [180, 6], dessus: [25, 55] };
function setViewAngles(v) { cam.az = v[0]; cam.el = v[1]; cam.dist = fitDistance(); updateCamera(); render(); }

const ptr = {}; let pinch = null;
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* sans importance */ }
  ptr[e.pointerId] = { x: e.clientX, y: e.clientY };
  const ids = Object.keys(ptr);
  if (ids.length === 2) { const a = ptr[ids[0]], b = ptr[ids[1]]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, dist: cam.dist }; }
});
canvas.addEventListener('pointermove', (e) => {
  const p = ptr[e.pointerId]; if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY;
  const ids = Object.keys(ptr);
  if (ids.length === 2 && pinch) {
    const a = ptr[ids[0]], b = ptr[ids[1]];
    cam.dist = clamp(pinch.dist * pinch.d / (Math.hypot(a.x - b.x, a.y - b.y) || 1), 6, 60);
  } else {
    cam.az = (cam.az - dx * 0.45 + 360) % 360;
    cam.el = clamp(cam.el + dy * 0.35, -10, 85);
  }
  updateCamera(); render();
});
const endPtr = (e) => { delete ptr[e.pointerId]; if (Object.keys(ptr).length < 2) pinch = null; };
canvas.addEventListener('pointerup', endPtr);
canvas.addEventListener('pointercancel', endPtr);
canvas.addEventListener('wheel', (e) => { e.preventDefault(); cam.dist = clamp(cam.dist * Math.exp(e.deltaY * (e.deltaMode ? 0.05 : 0.0015)), 6, 60); updateCamera(); render(); }, { passive: false });
canvas.addEventListener('keydown', (e) => {
  const d = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, 5], ArrowDown: [0, -5] }[e.key];
  if (d) { e.preventDefault(); cam.az = (cam.az + d[0] + 360) % 360; cam.el = clamp(cam.el + d[1], -10, 85); updateCamera(); render(); return; }
  if (e.key === '+' || e.key === '=') { e.preventDefault(); cam.dist = clamp(cam.dist / 1.2, 6, 60); updateCamera(); render(); }
  if (e.key === '-') { e.preventDefault(); cam.dist = clamp(cam.dist * 1.2, 6, 60); updateCamera(); render(); }
});

/* ---------- Lumière, sol, ombre, couleur du fond (suit le thème) ---------- */
function applyLight() {
  const a = opts.az * D2R, e = opts.el * D2R, c = cam.target;
  sun.position.set(c.x + 20 * Math.cos(e) * Math.sin(a), c.y + 20 * Math.sin(e), c.z + 20 * Math.cos(e) * Math.cos(a));
  sun.target.position.copy(c);
  sun.castShadow = opts.ombre;
  // en 2 ou 3 valeurs, peu de lumière d'ambiance : la face à l'ombre tombe franchement dans le ton sombre
  hemi.intensity = opts.rendu === 'continu' ? 0.55 : 0.08;
  sun.intensity = opts.rendu === 'continu' ? 2.2 : 2.6;
  grid.visible = opts.sol;
}
function applyBackground() {
  const bg = getComputedStyle(document.querySelector('.stage-frame')).backgroundColor || 'rgb(240,240,240)';
  const c = new THREE.Color(bg), lum = c.r * 0.3 + c.g * 0.59 + c.b * 0.11, light = lum > 0.5;
  // gris sans teinte, clairs ou sombres selon le thème : haut du ciel, horizon, sol
  const gray = (v) => { const h = Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0'); return '#' + h + h + h; };
  const top = light ? gray(0.62) : gray(0.07), horizon = light ? gray(0.93) : gray(0.32);
  sky.material.uniforms.top.value.set(top); sky.material.uniforms.horizon.value.set(horizon);
  scene.background = new THREE.Color(horizon);
  scene.fog.color.set(horizon);
  floor.material.color.set(light ? gray(0.68) : gray(0.2));
  grid.material.color.set(lum > 0.5 ? 0x000000 : 0xffffff);
  grid.material.opacity = 0.12;
}
function applyMaterial() {
  Object.values(mats).forEach((m) => m.dispose());
  mats = makeMaterials();
  figure.traverse((o) => { if (o.isMesh) o.material = mats[o.userData.mat || 'fig']; });
  props.forEach((o) => { o.material = mats[o.userData.mat || 'prop']; });
}

/* ---------- Rendu à la demande, taille du canevas ---------- */
let pending = false;
function render() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => { pending = false; applyLight(); renderer.render(scene, camera); });
}
function resize() {
  const f = canvas.parentElement, w = Math.max(1, f.clientWidth), h = Math.max(1, f.clientHeight);
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  if (box && !box.isEmpty()) { cam.dist = fitDistance(); updateCamera(); }
  render();
}
if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas.parentElement);

/* ---------- Poses : liste, précédente / suivante, au hasard sans répétition ---------- */
const sel = $('poseSel');
const families = [...new Set(POSES.map((p) => p.famille))];
families.forEach((f) => {
  const og = document.createElement('optgroup'); og.label = f;
  POSES.filter((p) => p.famille === f).forEach((p) => { const o = document.createElement('option'); o.value = p.id; o.textContent = p.nom; og.appendChild(o); });
  sel.appendChild(og);
});
let bag = [];
function showPose(p, fromBag) {
  if (!fromBag) bag = bag.filter((id) => id !== p.id);
  sel.value = p.id;
  $('poseName').textContent = p.nom;
  $('poseFam').textContent = p.famille + ' · ' + (POSES.indexOf(p) + 1) + ' / ' + POSES.length;
  writeJSON('pose', p.id);
  applyPose(p);
  if (p.vue && !(showPose.first && q.get('vue'))) { cam.az = p.vue[0]; cam.el = p.vue[1]; cam.dist = fitDistance(); updateCamera(); render(); }
}
function randomPose() {
  if (!bag.length) bag = POSES.map((p) => p.id).filter((id) => id !== current.id);
  const i = Math.floor(Math.random() * bag.length), id = bag.splice(i, 1)[0];
  showPose(POSES.find((p) => p.id === id), true);
}
function stepPose(d) { const i = POSES.indexOf(current); showPose(POSES[(i + d + POSES.length) % POSES.length]); }
sel.addEventListener('change', () => showPose(POSES.find((p) => p.id === sel.value)));
$('posePrev').addEventListener('click', () => stepPose(-1));
$('poseNext').addEventListener('click', () => stepPose(1));
$('poseRand').addEventListener('click', randomPose);
document.addEventListener('keydown', (e) => {
  if (e.target.closest && e.target.closest('input, select, textarea, [contenteditable]')) return;
  if (e.key === 'PageDown' || (e.key === 'ArrowRight' && e.target !== canvas)) { stepPose(1); }
  else if (e.key === 'PageUp' || (e.key === 'ArrowLeft' && e.target !== canvas)) { stepPose(-1); }
  else if (e.key === ' ' && e.target === document.body) { e.preventDefault(); toggleTimer(); }
});

/* ---------- Vue, proportions ---------- */
document.querySelectorAll('[data-vue]').forEach((b) => b.addEventListener('click', () => setViewAngles(VIEWS[b.dataset.vue])));
$('heads').value = opts.heads;
$('headsOut').textContent = String(opts.heads).replace('.', ',');
$('heads').addEventListener('input', () => {
  opts.heads = +$('heads').value; $('headsOut').textContent = String(opts.heads).replace('.', ',');
  buildFigure(); setRotations(targetRotations(current)); placeOnGround(current); frameCamera(); render(); save();
});

/* ---------- Lumière et rendu ---------- */
function bindRange(id, key, fmt) {
  const el = $(id), out = $(id + 'Out');
  el.value = opts[key]; out.textContent = fmt(opts[key]);
  el.addEventListener('input', () => { opts[key] = +el.value; out.textContent = fmt(opts[key]); render(); save(); });
}
bindRange('lightAz', 'az', (v) => v + '°');
bindRange('lightEl', 'el', (v) => v + '°');
function bindSeg(id, key, onChange) {
  const btns = document.querySelectorAll('#' + id + ' [data-v]');
  const sync = () => btns.forEach((b) => b.setAttribute('aria-pressed', String(String(opts[key]) === b.dataset.v)));
  btns.forEach((b) => b.addEventListener('click', () => { opts[key] = isNaN(+b.dataset.v) ? b.dataset.v : (key === 'duree' ? +b.dataset.v : b.dataset.v); sync(); save(); onChange(); }));
  sync();
}
bindSeg('renduSeg', 'rendu', () => { applyMaterial(); render(); });
bindSeg('matiereSeg', 'matiere', () => { applyMaterial(); render(); });
bindSeg('formeSeg', 'forme', () => { buildFigure(); setRotations(targetRotations(current)); placeOnGround(current); frameCamera(); render(); });
function bindSwitch(id, key) { const el = $(id); el.checked = !!opts[key]; el.addEventListener('change', () => { opts[key] = el.checked; render(); save(); }); }
bindSwitch('optOmbre', 'ombre');
bindSwitch('optSol', 'sol');
document.querySelectorAll('[data-lumiere]').forEach((b) => b.addEventListener('click', () => {
  const v = { gauche: [300, 40], droite: [60, 40], face: [0, 30], contre: [180, 35], dessus: [30, 80], rasante: [90, 8] }[b.dataset.lumiere];
  opts.az = v[0]; opts.el = v[1]; $('lightAz').value = v[0]; $('lightEl').value = v[1];
  $('lightAzOut').textContent = v[0] + '°'; $('lightElOut').textContent = v[1] + '°'; render(); save();
}));

/* ---------- Croquis chronométré : 30 s à 5 min, la pose change à la fin (séance) ---------- */
const timer = { left: opts.duree, running: false, started: false, id: null, count: 0, last: 0 };
const fmtTime = (s) => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
function showTimer() {
  const t = fmtTime(Math.ceil(timer.left));
  $('timerOut').textContent = t; $('timerChip').textContent = t;
  $('timerChip').hidden = !timer.started;
  $('timerGo').textContent = timer.running ? 'Pause' : (timer.started ? 'Reprendre' : 'Démarrer');
  $('timerGo').setAttribute('aria-pressed', String(timer.running));
  $('seanceCount').textContent = timer.count ? timer.count + (timer.count > 1 ? ' poses dessinées' : ' pose dessinée') : '';
}
function beep() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ac = beep.ac || (beep.ac = new AC()), o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = 880; g.gain.setValueAtTime(0.0001, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.15, ac.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.35);
    o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.4);
  } catch (e) { /* pas de son : sans importance */ }
}
function tick() {
  const now = performance.now(), dt = (now - timer.last) / 1000; timer.last = now;
  timer.left = Math.max(0, timer.left - dt);
  if (timer.left <= 0) {
    beep(); timer.count++;
    if (opts.seance) { randomPose(); timer.left = opts.duree; }
    else { stopTimer(); timer.left = opts.duree; timer.started = false; }
  }
  showTimer();
}
function startTimer() { if (timer.running) return; timer.running = true; timer.started = true; timer.last = performance.now(); timer.id = setInterval(tick, 200); showTimer(); }
function stopTimer() { timer.running = false; clearInterval(timer.id); timer.id = null; showTimer(); }
function toggleTimer() { if (timer.running) stopTimer(); else startTimer(); }
$('timerGo').addEventListener('click', toggleTimer);
$('timerReset').addEventListener('click', () => { stopTimer(); timer.left = opts.duree; timer.count = 0; timer.started = false; showTimer(); });
bindSeg('dureeSeg', 'duree', () => { timer.left = opts.duree; showTimer(); });
const seanceSw = $('optSeance'); seanceSw.checked = opts.seance;
seanceSw.addEventListener('change', () => { opts.seance = seanceSw.checked; save(); });

/* ---------- Export PNG ---------- */
$('exportBtn').addEventListener('click', () => {
  renderer.render(scene, camera);
  canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'pantin-' + current.id + '.png';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, 'image/png');
});

/* ---------- Vues (Poses, Croquis, Lumière), disposition, thème : comme les autres outils d'Arts plastiques ---------- */
const TABS = { poses: $('tabPoses'), croquis: $('tabCroquis'), lumiere: $('tabLumiere') };
const TILES = { poses: ['tilePose', 'tileVue', 'tileProp'], croquis: ['tileTimer', 'tilePose', 'tileSeance'], lumiere: ['tileLumiere', 'tileRendu', 'tileVue'] };
const ALL = [...new Set(Object.values(TILES).flat())];
let view = 'poses';
function setView(v, keepHash) {
  view = TABS[v] ? v : 'poses';
  Object.keys(TABS).forEach((k) => { TABS[k].setAttribute('aria-selected', String(k === view)); TABS[k].tabIndex = k === view ? 0 : -1; });
  ALL.forEach((id) => { $(id).hidden = TILES[view].indexOf(id) === -1; });
  // l'ordre des tuiles suit la vue
  TILES[view].forEach((id, i) => { $(id).style.order = i; });
  if (!keepHash && history.replaceState) { try { history.replaceState(null, '', '#' + view); } catch (_) { /* sans importance */ } }
}
Object.keys(TABS).forEach((k) => TABS[k].addEventListener('click', () => setView(k)));
const tabKeys = Object.keys(TABS);
Object.keys(TABS).forEach((k) => TABS[k].addEventListener('keydown', (e) => {
  const i = tabKeys.indexOf(k), to = { ArrowDown: i + 1, ArrowRight: i + 1, ArrowUp: i - 1, ArrowLeft: i - 1, Home: 0, End: tabKeys.length - 1 }[e.key];
  if (to === undefined) return;
  e.preventDefault(); e.stopPropagation();
  const n = tabKeys[(to + tabKeys.length) % tabKeys.length]; setView(n); TABS[n].focus();
}));
window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (TABS[v] && v !== view) setView(v, true); });

const LAYOUTS = ['below', 'right', 'focus'];
function setLayout(l, noSave) {
  l = LAYOUTS.indexOf(l) !== -1 ? l : 'below';
  $('dash').dataset.layout = l;
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
  applyBackground(); render();
}
document.querySelectorAll('button[data-palette]').forEach((b) => b.addEventListener('click', () => setTheme(b.dataset.palette)));
window.addEventListener('themechange', () => { applyBackground(); render(); });
if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { applyBackground(); render(); });

/* ---------- Démarrage ---------- */
buildFigure();
setLayout(readJSON('disposition'), true);
setTheme(readJSON('theme'), true);
setView(location.hash.slice(1), true);
resize();
// un lien peut donner la pose et le point de vue : pantin.html?pose=marche&vue=profil
const q = new URLSearchParams(location.search);
const start = POSES.find((p) => p.id === q.get('pose')) || POSES.find((p) => p.id === readJSON('pose')) || POSES[0];
const v0 = VIEWS[q.get('vue')] || VIEWS.troisquarts;
cam.az = v0[0]; cam.el = v0[1];
showPose.first = true; showPose(start); showPose.first = false;
showTimer();
document.documentElement.classList.add('pantin-pret');
