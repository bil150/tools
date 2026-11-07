/* Piano : assemble les modules communs de assets/js/musique/ (voir core.js). Même organisation que la page guitare,
   sans accordeur. Ajoute seulement ce qui est propre au piano : le clavier virtuel. */
(function () {
  'use strict';

  var M = window.Musique, P = M.instruments.piano, $ = M.$, el = M.el;
  var FROM = 48, TO = 83;                      // trois octaves : Do3 à Si5

  /* ================= Piano virtuel ================= */
  /* On joue les touches à la souris, au doigt ou avec le clavier de l'ordinateur ; on peut aussi choisir un accord pour
     voir ses notes sur le clavier et l'entendre. */
  var vp = { root: 0, q: 'maj', show: true, base: 60 }, kb, chordLabel;

  function chord() { return P.chordFor(M.ROOTS[vp.root], vp.q); }
  function now() { return M.audio().currentTime + 0.01; }
  function playKey(midi) { if (M.audio()) P.note(midi, now(), 1, 1.2); }

  function renderVirtual() {
    var host = $('padHost'), card = el('div', 'card'), controls = el('div', 'inputs'), c = chord();
    var idRoot = M.uid('vproot'), idQ = M.uid('vpq'), fRoot = el('div', 'field small'), fQ = el('div', 'field small'), selRoot = el('select'), qSeg = el('div', 'seg');
    var wrap = el('div', 'kb-wrap'), actions = el('div', 'actions'), bChord = el('button', 'btn', 'Jouer l’accord'), bArp = el('button', 'btn ghost', 'Arpège');
    var bDown = el('button', 'btn ghost', 'Octave plus grave'), bUp = el('button', 'btn ghost', 'Octave plus aiguë');
    var tones = {};

    c.tones.forEach(function (t) { tones[M.pcOf(t)] = t; });
    kb = M.Keyboard.create({
      from: FROM, to: TO, keyW: 36, height: 170, label: 'Piano virtuel, trois octaves',
      mark: function (m) {
        var t = vp.show && c.notes.indexOf(m) >= 0 ? tones[m % 12] : null;
        return t ? { label: M.fmt(t), fill: t.l, root: M.pcOf(t) === M.pcOf(c.root) } : null;
      },
      onKey: playKey
    });
    kb.svg.setAttribute('tabindex', '0');
    kb.svg.addEventListener('pointerdown', function () { kb.svg.focus({ preventScroll: true }); });
    M.Keyboard.bindKeys(kb.svg, function () { return vp.base; }, playKey);
    wrap.appendChild(kb.svg);

    card.appendChild(el('h2', '', 'Piano virtuel'));
    card.appendChild(el('p', 'muted', 'Touchez les touches pour les jouer. Au clavier de l’ordinateur : A W S E D F T G Y H U J K O L P jouent les notes à partir du Do central (touche A). Choisissez un accord pour voir ses notes sur le clavier et l’entendre.'));
    selRoot.id = idRoot;
    M.ROOTS.forEach(function (r, i) { var o = el('option', '', M.fmt(r)); o.value = i; selRoot.appendChild(o); });
    selRoot.value = vp.root;
    fRoot.appendChild(el('label', '', 'Accord')); fRoot.firstChild.setAttribute('for', idRoot); fRoot.appendChild(selRoot);
    qSeg.setAttribute('role', 'group'); qSeg.setAttribute('aria-labelledby', idQ);
    var lq = el('span', 'lab', 'Famille'); lq.id = idQ;
    P.qualities.forEach(function (q) {
      var b = el('button', '', M.QUALITY[q].plural);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(q === vp.q));
      b.addEventListener('click', function () { vp.q = q; renderVirtual(); hearChord(); });
      qSeg.appendChild(b);
    });
    fQ.appendChild(lq); fQ.appendChild(qSeg);
    controls.appendChild(fRoot); controls.appendChild(fQ);
    selRoot.addEventListener('change', function () { vp.root = Number(selRoot.value); renderVirtual(); hearChord(); });

    chordLabel = el('p', 'seqtext', M.chordTitle(c) + ' : ' + c.notes.map(function (m) { return M.noteName(m, c.tones); }).join(' · '));
    [bChord, bArp, bDown, bUp].forEach(function (b) { b.type = 'button'; actions.appendChild(b); });
    bChord.addEventListener('click', hearChord);
    bArp.addEventListener('click', function () {
      if (!M.audio()) return;
      var t = now(), cc = chord();
      [cc.bass].concat(cc.notes).forEach(function (m, i) { P.note(m, t + i * 0.18, 1, 1.4); });
    });
    bDown.addEventListener('click', function () { vp.base = Math.max(36, vp.base - 12); octaveLabel(); });
    bUp.addEventListener('click', function () { vp.base = Math.min(84, vp.base + 12); octaveLabel(); });
    function octaveLabel() { hintOct.textContent = 'Touches de l’ordinateur : à partir de ' + M.noteName(vp.base); }
    var hintOct = el('p', 'muted');
    octaveLabel();

    [controls, chordLabel, wrap, actions, hintOct].forEach(function (n) { card.appendChild(n); });
    host.replaceChildren(card);
  }

  function hearChord() { if (M.audio()) P.chord(chord(), now(), 1); }

  /* ================= Assemblage ================= */
  M.initNotation();
  M.ChordSheet.mount($('sheetHost'), {
    instrument: P,
    hint: 'Main droite : l’accord en position fondamentale ; main gauche : la fondamentale, deux octaves plus bas. Touchez un accord pour l’entendre.'
  });
  renderVirtual();
  M.onNotation(renderVirtual);

  M.Scales.mount($('scalesHost'), {
    board: M.boards.keyboard({ from: FROM, to: TO }),
    play: playKey
  });

  var tabs;
  var composer = M.Composer.mount($('composerHost'), {
    id: 'piano',
    instruments: [P, M.instruments.guitar, M.instruments.bass],
    diagram: 'piano',
    onIdeas: function () { tabs.open('harmonie'); }
  });
  var harmony = M.Harmony.mount($('harmonieHost'), {
    instrument: P,
    getTempo: composer.getTempo,
    onSend: function (ids) { composer.setSteps(ids); tabs.open('composer'); }
  });

  /* Quand on quitte un onglet, tout ce qui sonne s'arrête (lecture, aperçus) */
  tabs = M.tabs(['accords', 'virtuelle', 'manche', 'composer', 'harmonie'], function (name) {
    if (name !== 'composer') { composer.stop(); M.Drums.stopLoop(); }
    if (name !== 'harmonie') harmony.stop();
  });
})();
