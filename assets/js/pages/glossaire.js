/* Glossaire d'arts plastiques : recherche (sans accents ni majuscules, tous les mots), filtre par thème,
   renvois entre termes (un mot défini ailleurs devient un lien vers sa fiche), liens vers les outils du site. */
import { THEMES, TERMES } from '../glossaire-data.js';

const $ = (id) => document.getElementById(id);
const NS = 'tools:arts:glossaire:';
const fold = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const slug = (t) => 'terme-' + fold(t).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const items = TERMES.map(([theme, term, def, link]) => ({ theme, term, def, link, id: slug(term), hay: fold(term + ' ' + def) }));
// Renvois : chaque terme, cherché tel quel dans les définitions des autres (mots entiers, sans tenir compte de la casse).
// Sauf les termes qui sont aussi des mots courants (« ce qui est dessous », « la touche »…) : le lien tromperait.
const NO_REF = new Set(['Dessous', 'Ton', 'Nuance', 'Touche', 'Format', 'Contour', 'Étude', 'Panneau', 'Plans']);
const refs = items.filter((it) => !NO_REF.has(it.term)).sort((a, b) => b.term.length - a.term.length)
  .map((it) => ({ it, re: new RegExp('(?<![\\p{L}])' + esc(it.term) + '(?![\\p{L}])', 'iu') }));

let theme = 'Tous';
try { const t = JSON.parse(localStorage.getItem(NS + 'theme')); if (t === 'Tous' || THEMES.indexOf(t) !== -1) theme = t; } catch (e) { /* sans importance */ }

// Définition avec ses renvois : première occurrence de chaque autre terme, sans chevauchement
function defNodes(it) {
  const found = [];
  refs.forEach(({ it: other, re }) => {
    if (other === it) return;
    const m = re.exec(it.def);
    if (m && !found.some((f) => m.index < f.end && m.index + m[0].length > f.start)) found.push({ start: m.index, end: m.index + m[0].length, other });
  });
  found.sort((a, b) => a.start - b.start);
  const out = []; let pos = 0;
  found.forEach((f) => {
    if (f.start > pos) out.push(document.createTextNode(it.def.slice(pos, f.start)));
    const a = document.createElement('a'); a.href = '#' + f.other.id; a.className = 'gl-ref'; a.textContent = it.def.slice(f.start, f.end);
    a.addEventListener('click', (e) => { e.preventDefault(); goTo(f.other); });
    out.push(a); pos = f.end;
  });
  if (pos < it.def.length) out.push(document.createTextNode(it.def.slice(pos)));
  return out;
}

function render() {
  const words = fold($('glQ').value).split(/\s+/).filter(Boolean);
  const list = $('glList'); list.textContent = '';
  let n = 0;
  (theme === 'Tous' ? THEMES : [theme]).forEach((th) => {
    const its = items.filter((it) => it.theme === th && words.every((w) => it.hay.indexOf(w) !== -1));
    if (!its.length) return;
    n += its.length;
    const sec = document.createElement('section'); sec.className = 'gl-sec';
    const h = document.createElement('h2'); h.textContent = th; sec.appendChild(h);
    const dl = document.createElement('dl');
    its.forEach((it) => {
      const row = document.createElement('div'); row.className = 'gl-item'; row.id = it.id;
      const dt = document.createElement('dt'); dt.textContent = it.term;
      const dd = document.createElement('dd'); dd.append(...defNodes(it));
      if (it.link) {
        const a = document.createElement('a'); a.className = 'gl-tool'; a.href = it.link; a.textContent = 'Voir dans l’outil →';
        dd.append(' ', a);
      }
      row.append(dt, dd); dl.appendChild(row);
    });
    sec.appendChild(dl); list.appendChild(sec);
  });
  if (!n) { const p = document.createElement('p'); p.className = 'gl-empty'; p.textContent = 'Aucun terme trouvé.'; list.appendChild(p); }
  $('glCount').textContent = n + (n > 1 ? ' termes' : ' terme');
  document.querySelectorAll('#glThemes button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === theme)));
}

// Aller à un terme : on enlève ce qui le cacherait, on le montre et on le fait briller un instant
function goTo(it) {
  const row0 = document.getElementById(it.id);
  if (!row0) { $('glQ').value = ''; setTheme('Tous'); }
  const row = document.getElementById(it.id); if (!row) return;
  row.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash');
  if (history.replaceState) { try { history.replaceState(null, '', '#' + it.id); } catch (_) { /* sans importance */ } }
}
function setTheme(t) {
  theme = t;
  try { localStorage.setItem(NS + 'theme', JSON.stringify(t)); } catch (e) { /* sans importance */ }
  render();
}

['Tous'].concat(THEMES).forEach((t) => {
  const b = document.createElement('button'); b.type = 'button'; b.dataset.v = t; b.textContent = t;
  b.addEventListener('click', () => setTheme(t));
  $('glThemes').appendChild(b);
});
$('glQ').addEventListener('input', render);
$('glQ').addEventListener('keydown', (e) => { if (e.key === 'Escape') { $('glQ').value = ''; render(); } });

render();
// Lien direct vers un terme : glossaire.html#terme-glacis
const start = items.find((it) => '#' + it.id === location.hash);
if (start) goTo(start);
