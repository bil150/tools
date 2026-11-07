/* Fiche d'accords : tous les accords d'un instrument (12 fondamentales × familles) avec leurs schémas, et le détail de
   l'accord choisi. Expose Musique.ChordSheet. Dépend de musique/core.js.

   Musique.ChordSheet.mount(container, opts) -> { render }
   opts : instrument (voir Musique.instruments), hint (texte d'aide sous le détail, facultatif).
   Si l'instrument fournit describe(accord), ses lignes s'ajoutent au détail (notes à jouer, position…). */
(function () {
  'use strict';

  var M = window.Musique, el = M.el;
  var F = M.ChordSheet = {};

  F.mount = function (container, opts) {
    var inst = opts.instrument, selected = inst.chordFor(M.ROOTS[0], inst.qualities[0]), tiles = [];

    var detail = el('div', 'card'), row = el('div', 'detail'), big = el('div', 'big'), info = el('div', 'info');
    var title = el('h2'), notes = el('p', 'muted'), lines = el('div', 'dlines'), actions = el('div', 'actions');
    var bPlay = el('button', 'btn', 'Jouer');
    bPlay.type = 'button';
    actions.appendChild(bPlay);
    info.appendChild(title); info.appendChild(notes); info.appendChild(lines); info.appendChild(actions);
    if (opts.hint) info.appendChild(el('p', 'muted', opts.hint));
    row.appendChild(big); row.appendChild(info);
    detail.appendChild(row);
    detail.setAttribute('aria-live', 'polite');
    container.appendChild(detail);

    var groups = el('div', 'sheet-groups');
    container.appendChild(groups);

    function renderDetail() {
      var c = selected;
      title.textContent = M.chordTitle(c);
      notes.textContent = 'Notes de l’accord : ' + c.tones.map(M.fmt).join(' · ');
      big.replaceChildren(inst.diagram(c, true));
      lines.replaceChildren();
      if (inst.describe) inst.describe(c).forEach(function (t) { lines.appendChild(el('p', '', t)); });
      tiles.forEach(function (x) { x.btn.setAttribute('aria-pressed', String(x.c.id === c.id)); });
    }

    function select(c, play) {
      selected = c;
      renderDetail();
      if (play) hear();
    }
    function hear() { if (M.audio()) inst.chord(selected, M.audio().currentTime + 0.02, 1); }

    function render() {
      tiles = [];
      groups.replaceChildren();
      inst.qualities.forEach(function (q) {
        var card = el('section', 'card'), grid = el('div', 'chords');
        card.setAttribute('aria-label', 'Accords ' + M.QUALITY[q].plural.toLowerCase());
        card.appendChild(el('h2', '', 'Accords ' + M.QUALITY[q].plural.toLowerCase()));
        M.ROOTS.forEach(function (root) {
          var c = inst.chordFor(root, q);
          if (!c) return;
          var b = el('button', 'chord-btn');
          b.type = 'button';
          b.setAttribute('aria-label', 'Accord ' + M.chordTitle(c));
          b.appendChild(el('b', '', M.chordTitle(c)));
          b.appendChild(inst.diagram(c));
          b.addEventListener('click', function () { select(c, true); });
          grid.appendChild(b);
          tiles.push({ btn: b, c: c });
        });
        card.appendChild(grid);
        groups.appendChild(card);
      });
      selected = inst.chordFor(selected.root, selected.q) || selected;
      renderDetail();
    }

    bPlay.addEventListener('click', hear);
    M.onNotation(render);
    render();
    return { render: render };
  };
})();
