/* Gammes sur l'instrument : notes naturelles ou gamme choisie (pentatoniques, blues, modes…), tableau de la gamme et
   tableau des décalages. Expose Musique.Scales et Musique.boards. Dépend de musique/core.js et musique/clavier.js.

   Musique.Scales.mount(container, opts) construit l'onglet.
   opts : board (afficheur, voir Musique.boards), play(midi) appelé quand on touche une note.
   Un afficheur est { render(hôte, info, play), hint(vue) } : info(pc) donne, pour une hauteur (0 à 11), la note à afficher
   { note, degree, root, label } ou null ; play(midi) joue une note.
   Afficheurs fournis : Musique.boards.fretboard({ open, names, frets, label }) pour un manche à cordes
   et Musique.boards.keyboard({ from, to }) pour un clavier. */
(function () {
  'use strict';

  var M = window.Musique, el = M.el, sv = M.sv, fmt = M.fmt, setPressed = M.setPressed;
  var S = M.Scales = {};
  M.boards = {};

  /* ================= Afficheur : manche à cordes ================= */
  /* open : numéros MIDI des cordes à vide, de la plus grave à la plus aiguë ; names : notes de ces cordes
     (affichées à droite) ; frets : nombre de cases ; label : nom de l'instrument pour les lecteurs d'écran. */
  M.boards.fretboard = function (cfg) {
    var open = cfg.open, names = cfg.names, n = open.length, frets = cfg.frets || 12;
    var FB = { x0: 44, w: 64, y0: 34, gap: 34 };
    return {
      hint: function (view) {
        return view === 'natural'
          ? 'Les notes naturelles, sans dièse ni bémol, de la case 0 (corde à vide) à la case ' + frets + '. Touchez une case pour l’entendre.'
          : 'Contour rouge : note de départ. Touchez une case pour l’entendre.';
      },
      render: function (host, info, play) {
        var W = FB.x0 + frets * FB.w + 40, H = FB.y0 + (n - 1) * FB.gap + 30;
        var svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Manche de ' + (cfg.label || 'guitare') + ', ' + frets + ' cases' });
        var f, s, x, top = FB.y0 - 16, bottom = FB.y0 + (n - 1) * FB.gap + 16, mid = FB.y0 + (n - 1) * FB.gap / 2;
        function cx(fr) { return fr === 0 ? FB.x0 - 24 : FB.x0 + (fr - 0.5) * FB.w; }
        function cy(str) { return FB.y0 + (n - 1 - str) * FB.gap; } // la corde aiguë est en haut

        svg.appendChild(sv('rect', { x: FB.x0, y: top, width: frets * FB.w, height: bottom - top }, 'fb-body'));
        [3, 5, 7, 9].forEach(function (fr) { svg.appendChild(sv('circle', { cx: cx(fr), cy: mid, r: 5 }, 'fb-inlay')); });
        if (frets >= 12) {
          svg.appendChild(sv('circle', { cx: cx(12), cy: mid - FB.gap, r: 5 }, 'fb-inlay'));
          svg.appendChild(sv('circle', { cx: cx(12), cy: mid + FB.gap, r: 5 }, 'fb-inlay'));
        }
        for (f = 0; f <= frets; f++) {
          x = FB.x0 + f * FB.w;
          svg.appendChild(sv('line', { x1: x, x2: x, y1: top, y2: bottom }, f === 0 ? 'fb-nut' : 'fb-fret'));
          if (f > 0) { var num = sv('text', { x: cx(f), y: top - 6 }, 'fb-num'); num.textContent = f; svg.appendChild(num); }
        }
        for (s = 0; s < n; s++) {
          svg.appendChild(sv('line', { x1: FB.x0, x2: FB.x0 + frets * FB.w, y1: cy(s), y2: cy(s), 'stroke-width': 1 + (n - 1 - s) * (n < 6 ? 0.55 : 0.35) }, 'fb-string'));
          var nm = sv('text', { x: W - 16, y: cy(s) }, 'fb-sname');
          nm.textContent = fmt(names[s]);
          svg.appendChild(nm);
        }
        for (s = 0; s < n; s++) {
          for (f = 0; f <= frets; f++) {
            var hit = info((open[s] + f) % 12);
            if (!hit) continue;
            svg.appendChild(sv('circle', { cx: cx(f), cy: cy(s), r: 13 }, 'fb-dot n' + hit.note.l + (hit.root ? ' root' : '')));
            var t = sv('text', { x: cx(f), y: cy(s) }, 'fb-lbl' + (hit.label.length > 2 ? ' long' : ''));
            t.textContent = hit.label;
            svg.appendChild(t);
          }
        }
        for (s = 0; s < n; s++) {
          for (f = 0; f <= frets; f++) {
            svg.appendChild(sv('rect', {
              x: f === 0 ? FB.x0 - 44 : FB.x0 + (f - 1) * FB.w, y: cy(s) - FB.gap / 2,
              width: f === 0 ? 40 : FB.w, height: FB.gap, 'data-s': s, 'data-f': f
            }, 'fb-hit'));
          }
        }
        svg.addEventListener('click', function (e) {
          var t = e.target;
          if (!t.classList || !t.classList.contains('fb-hit')) return;
          play(open[Number(t.getAttribute('data-s'))] + Number(t.getAttribute('data-f')));
        });
        host.replaceChildren(svg);
      }
    };
  };

  /* ================= Afficheur : clavier ================= */
  M.boards.keyboard = function (cfg) {
    return {
      hint: function () { return 'Touchez une touche pour l’entendre. Les touches blanches de gauche à droite sont, de Do en Si, les notes naturelles.'; },
      render: function (host, info, play) {
        var kb = M.Keyboard.create({
          from: cfg.from, to: cfg.to, keyW: 34, height: 150, label: 'Clavier de piano',
          mark: function (m) { var i = info(m % 12); return i ? { label: i.label, fill: i.note.l, root: i.root } : null; },
          onKey: play
        });
        kb.svg.classList.add('scroll-w');
        host.replaceChildren(kb.svg);
      }
    };
  };

  /* ================= Onglet ================= */
  S.mount = function (container, opts) {
    var st = { view: 'natural', root: 0, mode: 0, label: 'names' };
    var idRoot = M.uid('root'), idMode = M.uid('mode'), idView = M.uid('view'), idLab = M.uid('lab');

    function info(pc) {
      var notes, k, n;
      if (st.view === 'natural') {
        k = M.NATURAL.indexOf(pc);
        return k < 0 ? null : { note: { l: k, a: 0 }, degree: -1, root: false, label: fmt({ l: k, a: 0 }) };
      }
      notes = M.scaleOf(st.root, st.mode);
      for (k = 0; k < notes.length; k++) {
        n = notes[k];
        if (M.pcOf(n) === pc) return { note: n, degree: k, root: k === 0, label: st.label === 'degrees' ? M.degLabel(M.MODES[st.mode], k) : fmt(n) };
      }
      return null;
    }

    /* ----- Construction ----- */
    var card = el('div', 'card'), inputs = el('div', 'inputs'), boardHost = el('div'), scroll = el('div', 'scroll'), hint = el('p', 'muted'), legend = el('ul', 'legend');
    var fView = el('div', 'field small'), fRoot = el('div', 'field'), fMode = el('div', 'field'), fLab = el('div', 'field small');
    var viewSeg = el('div', 'seg'), labSeg = el('div', 'seg'), selRoot = el('select'), selMode = el('select');
    var scaleCard = el('section', 'card'), scaleTitle = el('h2'), scaleScroll = el('div', 'scroll'), scaleTbl = el('table', 'tbl'), scalePattern = el('p', 'muted');
    var offCard = el('section', 'card'), offScroll = el('div', 'scroll'), offTbl = el('table', 'tbl offsets');

    function seg(host, id, items, attr) {
      host.setAttribute('role', 'group'); host.setAttribute('aria-labelledby', id);
      items.forEach(function (it) {
        var b = el('button', '', it[1]);
        b.type = 'button'; b.setAttribute(attr, it[0]);
        host.appendChild(b);
      });
    }
    var vLab = el('span', 'lab', 'Affichage'); vLab.id = idView;
    seg(viewSeg, idView, [['natural', 'Notes naturelles'], ['scale', 'Gamme']], 'data-view');
    fView.appendChild(vLab); fView.appendChild(viewSeg);
    selRoot.id = idRoot; selMode.id = idMode;
    fRoot.appendChild(el('label', '', 'Note de départ')); fRoot.firstChild.setAttribute('for', idRoot); fRoot.appendChild(selRoot);
    fMode.appendChild(el('label', '', 'Gamme')); fMode.firstChild.setAttribute('for', idMode); fMode.appendChild(selMode);
    var lLab = el('span', 'lab', 'Étiquettes'); lLab.id = idLab;
    seg(labSeg, idLab, [['names', 'Notes'], ['degrees', 'Degrés']], 'data-label');
    fLab.appendChild(lLab); fLab.appendChild(labSeg);
    [fView, fRoot, fMode, fLab].forEach(function (f) { inputs.appendChild(f); });
    scroll.appendChild(boardHost);
    card.appendChild(inputs); card.appendChild(scroll); card.appendChild(hint); card.appendChild(legend);

    scaleCard.setAttribute('aria-label', 'Détail de la gamme');
    scaleScroll.appendChild(scaleTbl);
    scaleCard.appendChild(scaleTitle); scaleCard.appendChild(scaleScroll); scaleCard.appendChild(scalePattern);
    scaleCard.appendChild(el('p', 'muted', 'Le motif est le même quelle que soit la note de départ : seules les notes changent, en respectant les demi-tons naturels (Mi–Fa et Si–Do). Une gamme peut commencer n’importe où : sa position n’est pas fixée par la note de départ.'));
    offCard.setAttribute('aria-label', 'Décalages');
    offCard.appendChild(el('h2', '', 'Décalages'));
    offCard.appendChild(el('p', 'muted', 'Les sept notes de Do majeur, lues en commençant ailleurs : chaque ligne est un mode. Touchez une ligne pour l’afficher.'));
    offScroll.appendChild(offTbl); offCard.appendChild(offScroll);
    container.appendChild(card); container.appendChild(scaleCard); container.appendChild(offCard);

    /* ----- Dessin ----- */
    function renderLegend() {
      var k;
      legend.replaceChildren();
      legend.setAttribute('aria-label', 'Correspondance entre les noms de notes');
      for (k = 0; k < 7; k++) legend.appendChild(el('li', 'nb' + k, M.SOLFEGE[M.LETTERS[k]] + ' = ' + M.LETTERS[k]));
    }

    function renderScale() {
      scaleCard.hidden = st.view !== 'scale';
      if (st.view !== 'scale') return;
      var m = M.MODES[st.mode], notes = M.scaleOf(st.root, st.mode), steps = M.modeSteps(m), n = notes.length;
      scaleTitle.textContent = fmt(M.ROOTS[st.root]) + ' · ' + m.name;
      scaleTbl.replaceChildren();
      function addRow(title, build) {
        var row = el('tr'), k;
        row.appendChild(el('th', '', title));
        for (k = 0; k <= n; k++) row.appendChild(build(k));
        scaleTbl.appendChild(row);
      }
      addRow('Degré', function (i) {
        var cell = el('td');
        cell.appendChild(document.createTextNode(i === n ? '8' : M.degLabel(m, i)));
        cell.appendChild(el('small', '', M.DEGREES[i === n ? 7 : m.deg[i]]));
        return cell;
      });
      addRow('Note', function (i) { var note = notes[i % n]; return el('td', 'nb' + note.l + (i % n === 0 ? ' root' : ''), fmt(note)); });
      addRow('Écart', function (i) { return el('td', 'step', i === 0 ? '—' : M.stepStr(steps[i - 1])); });
      scalePattern.textContent = 'Motif : ' + steps.map(M.stepStr).join('  ') + '  (+1 = un ton, +½ = un demi-ton)';
    }

    function renderOffsets() {
      var r, k;
      offTbl.replaceChildren();
      for (r = 0; r < 7; r++) {
        (function (r) {
          var mi = M.modeIdx(M.OFFSET_ROWS[r]), tr = el('tr'), th = el('th'), b = el('button', '', fmt({ l: r, a: 0 }) + ' · ' + M.MODES[mi].short);
          b.type = 'button';
          b.addEventListener('click', function () { st.view = 'scale'; st.root = M.NATURAL[r]; st.mode = mi; sync(); });
          th.appendChild(b);
          tr.appendChild(th);
          for (k = 0; k < 7; k++) tr.appendChild(el('td', 'nb' + ((r + k) % 7), fmt({ l: (r + k) % 7, a: 0 })));
          if (st.view === 'scale' && st.root === M.NATURAL[r] && st.mode === mi) tr.className = 'sel';
          offTbl.appendChild(tr);
        })(r);
      }
    }

    function fillSelects() {
      var i, grp = null, grpName = '';
      selRoot.replaceChildren(); selMode.replaceChildren();
      for (i = 0; i < 12; i++) { var o = el('option', '', fmt(M.ROOTS[i])); o.value = i; selRoot.appendChild(o); }
      for (i = 0; i < M.MODES.length; i++) {
        if (M.MODES[i].group !== grpName) { grpName = M.MODES[i].group; grp = el('optgroup'); grp.label = grpName; selMode.appendChild(grp); }
        var m = el('option', '', M.MODES[i].name); m.value = i; grp.appendChild(m);
      }
      selRoot.value = st.root; selMode.value = st.mode;
    }

    function sync() {
      var scale = st.view === 'scale';
      fRoot.hidden = fMode.hidden = fLab.hidden = !scale;
      selRoot.value = st.root;
      selMode.value = st.mode;
      setPressed(viewSeg.querySelectorAll('button'), function (b) { return b.getAttribute('data-view') === st.view; });
      setPressed(labSeg.querySelectorAll('button'), function (b) { return b.getAttribute('data-label') === st.label; });
      opts.board.render(boardHost, info, opts.play);
      hint.textContent = opts.board.hint(st.view);
      renderScale();
      renderOffsets();
    }

    viewSeg.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { st.view = b.getAttribute('data-view'); sync(); } });
    labSeg.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { st.label = b.getAttribute('data-label'); sync(); } });
    selRoot.addEventListener('change', function () { st.root = Number(this.value); sync(); });
    selMode.addEventListener('change', function () { st.mode = Number(this.value); sync(); });

    function render() { fillSelects(); renderLegend(); sync(); }
    M.onNotation(render);
    render();
    return { render: render };
  };
})();
