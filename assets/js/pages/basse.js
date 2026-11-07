/* Basse : assemble les modules communs de assets/js/musique/ (voir core.js). Même organisation que la page guitare.
   Ajoute seulement ce qui est propre à la basse : la main gauche de la basse virtuelle (une case, sur les quatre cordes). */
(function () {
  'use strict';

  var M = window.Musique, B = M.instruments.bass, $ = M.$, el = M.el;
  var OPEN = B.STRINGS;                                              // Mi1 La1 Ré2 Sol2
  var OPEN_NOTES = [{ l: 2, a: 0 }, { l: 5, a: 0 }, { l: 1, a: 0 }, { l: 4, a: 0 }];

  function now() { return M.audio().currentTime + 0.01; }

  /* ================= Basse virtuelle ================= */
  var left = { fret: 0 }, pad, leftHost = $('leftHost');

  function renderLeft() {
    var card = el('section', 'card'), grid = el('div', 'frets'), f;
    card.setAttribute('aria-label', 'Main gauche');
    card.appendChild(el('h2', '', 'Main gauche : ' + (left.fret === 0 ? 'cordes à vide' : 'case ' + left.fret)));
    card.appendChild(el('p', 'muted', 'La case choisie est appuyée sur les quatre cordes à la fois, comme un barré : chaque ligne affiche la note qu’elle joue.'));
    for (f = 0; f <= 12; f++) {
      (function (f) {
        var b = el('button', 'chip-btn', f === 0 ? 'À vide' : String(f));
        b.type = 'button';
        b.setAttribute('aria-pressed', String(f === left.fret));
        b.addEventListener('click', function () { left.fret = f; renderLeft(); pad.render(); pad.strum(true, 0.7); });
        grid.appendChild(b);
      })(f);
    }
    card.appendChild(grid);
    leftHost.replaceChildren(card);
  }

  function initVirtual() {
    pad = M.StringPad.mount($('padHost'), {
      id: 'basse', title: 'Basse virtuelle', strings: 4,
      fret: function () { return left.fret; },
      label: function (s) { return M.fmt(M.ROOTS[(OPEN[s] + left.fret) % 12]); },
      sound: function (s, f, vol, delay) { if (M.audio()) B.note(OPEN[s] + f, M.audio().currentTime + 0.01 + delay, vol, 0.9); }
    });
    M.onNotation(function () { renderLeft(); pad.render(); });
    renderLeft();
  }

  /* ================= Assemblage ================= */
  M.initNotation();
  M.ChordSheet.mount($('sheetHost'), {
    instrument: B,
    hint: 'La basse joue la fondamentale de l’accord, à la case la plus proche du sillet. Touchez un accord pour l’entendre.'
  });
  initVirtual();

  M.Scales.mount($('scalesHost'), {
    board: M.boards.fretboard({ open: OPEN, names: OPEN_NOTES, frets: 12, label: 'basse' }),
    play: function (midi) { if (M.audio()) B.note(midi, now(), 1, 0.9); }
  });

  var tuner = M.Tuner.mount($('tunerHost'), { tunings: [
    { midi: [28, 33, 38, 43], names: ['E', 'A', 'D', 'G'] },
    { midi: [26, 33, 38, 43], names: ['D', 'A', 'D', 'G'], label: 'Drop D' },
    { midi: [27, 32, 37, 42], names: ['E♭', 'A♭', 'D♭', 'G♭'], label: 'Demi-ton plus bas' }
  ] });

  var tabs;
  var composer = M.Composer.mount($('composerHost'), {
    id: 'basse',
    instruments: [B, M.instruments.guitar, M.instruments.piano],
    diagram: 'bass',
    onIdeas: function () { tabs.open('harmonie'); }
  });
  var harmony = M.Harmony.mount($('harmonieHost'), {
    instrument: B,
    getTempo: composer.getTempo,
    onSend: function (ids) { composer.setSteps(ids); tabs.open('composer'); }
  });

  /* Quand on quitte un onglet, tout ce qui sonne s'arrête (micro, lecture, aperçus) */
  tabs = M.tabs(['accords', 'virtuelle', 'manche', 'accordeur', 'composer', 'harmonie'], function (name) {
    if (name !== 'accordeur') tuner.stop();
    if (name !== 'composer') { composer.stop(); M.Drums.stopLoop(); }
    if (name !== 'harmonie') harmony.stop();
  });
})();
