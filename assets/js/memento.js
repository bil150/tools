/* Mementos imprimables : réglages de mise en page, ajustement automatique et impression.

   Contrat HTML :
     <header class="toolbar"><h1>Titre</h1></header>
     <div class="sheet" id="sheet1" data-face="Recto — page 1" data-cols="4">
       <div class="doc-title">…</div>
       <section class="cat"><div class="subbanner">…</div><div class="mc"><div class="group">…</div></div></section>
       <div class="credits">…</div>
     </div>

   Le nombre de pages est réglable : le contenu (blocs .group) est alors réparti sur N feuilles
   de hauteur équilibrée, puis l'échelle de chaque feuille est ajustée.
   Les réglages sont mémorisés par page web dans localStorage. */
(function () {
  'use strict';

  var SCALE_MIN = 40, SCALE_MAX = 230, COLS = [3, 4, 5, 6], MAX_PAGES = 8;
  var HINT = 'Choisissez le nombre de pages, puis réglez chaque feuille : glissez l’échelle, ou cliquez sur « Ajuster auto », jusqu’au badge vert. ' +
    'Dans la boîte d’impression : orientation Paysage, marges Aucune, échelle 100 %, et graphiques d’arrière-plan activés.';
  var PAGES_KEY = 'memento:' + location.pathname + ':pages';

  var host;          // conteneur des feuilles
  var original = []; // feuilles d'origine (copies)
  var model = [];    // contenu à répartir : [{ el, sub, groups }]
  var titleEl, creditsEl, defCols = 4;
  var bars = [];
  var pagesSel;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function labelled(text, control) {
    var l = el('label', null, text + ' ');
    l.appendChild(control);
    return l;
  }
  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) { /* stockage indisponible : on continue sans */ }
    return null;
  }
  function options(select, values, selected) {
    values.forEach(function (n) {
      var o = el('option', null, String(n));
      o.selected = n === selected;
      select.appendChild(o);
    });
    return select;
  }

  /* ---------- Ajustement ---------- */

  /* Le contenu tient si le dernier bloc se termine avant le padding bas de la feuille. */
  function fits(sheet) {
    var cats = sheet.querySelectorAll('.cat');
    var last = cats[cats.length - 1];
    if (!last) return true;
    var limit = sheet.getBoundingClientRect().bottom - parseFloat(getComputedStyle(sheet).paddingBottom);
    return last.getBoundingClientRect().bottom <= limit + 1;
  }

  /* ---------- Impression ---------- */

  function printSheet(sheet) {
    document.body.setAttribute('data-only', '1');
    sheet.classList.add('print-only');
    window.print();
  }
  function printAll() {
    document.body.removeAttribute('data-only');
    window.print();
  }
  function resetPrint() {
    document.body.removeAttribute('data-only');
    document.querySelectorAll('.print-only').forEach(function (s) { s.classList.remove('print-only'); });
  }

  /* ---------- Barre de réglage d'une feuille ---------- */

  function buildBar(sheet, index) {
    var bar = el('div', 'sheet-bar');
    bar.appendChild(el('span', 'face', sheet.dataset.face || 'Page ' + (index + 1)));

    var range = el('input', 'sc');
    range.type = 'range'; range.min = SCALE_MIN; range.max = SCALE_MAX; range.step = 1; range.value = 100;
    var value = el('span', 'scv', '100%');
    var lScale = labelled('Échelle', range);
    lScale.appendChild(value);

    var select = options(el('select', 'cl'), COLS, Number(sheet.dataset.cols) || defCols);
    var badge = el('span', 'fit');
    var auto = el('button', 'btn ghost', 'Ajuster auto'); auto.type = 'button';
    var print = el('button', 'btn', 'Imprimer'); print.type = 'button';

    [lScale, labelled('Colonnes', select), badge, auto, print].forEach(function (n) { bar.appendChild(n); });
    sheet.parentNode.insertBefore(bar, sheet);

    var key = 'memento:' + location.pathname + '#' + host.querySelectorAll('.sheet').length + ':' + sheet.id;

    function apply() {
      sheet.style.setProperty('--s', range.value / 100);
      sheet.style.setProperty('--c', select.value);
      value.textContent = range.value + '%';
      var ok = fits(sheet);
      badge.textContent = ok ? 'tient sur la page' : 'déborde';
      badge.className = 'fit ' + (ok ? 'ok' : 'over');
      store(key, range.value + '|' + select.value);
    }
    function fit() {
      var lo = SCALE_MIN, hi = SCALE_MAX, best = SCALE_MIN;
      for (var i = 0; i < 14; i++) {
        var mid = (lo + hi) / 2;
        range.value = Math.round(mid);
        apply();
        if (fits(sheet)) { best = Math.round(mid); lo = mid; } else { hi = mid; }
      }
      range.value = best;
      apply();
    }

    range.addEventListener('input', apply);
    select.addEventListener('change', apply);
    auto.addEventListener('click', fit);
    print.addEventListener('click', function () { printSheet(sheet); });

    var saved = store(key);
    if (saved) {
      var parts = saved.split('|');
      range.value = parts[0];
      select.value = parts[1];
      apply();
    } else {
      apply();
      fit();
    }
    bars.push({ select: select, fit: fit });
  }

  /* ---------- Répartition du contenu sur N pages ---------- */

  function extractModel() {
    original.forEach(function (sheet) {
      sheet.querySelectorAll('.cat').forEach(function (cat) {
        var mc = cat.querySelector('.mc');
        model.push({
          el: cat,
          sub: cat.querySelector('.subbanner'),
          groups: mc ? [].slice.call(mc.children) : []
        });
      });
    });
    titleEl = original[0].querySelector('.doc-title');
    creditsEl = original[0].querySelector('.credits');
    defCols = Number(original[0].dataset.cols) || 4;
  }

  /* Hauteur de chaque bloc à l'échelle 1, dans une colonne de la largeur utile. */
  function measure() {
    var probe = el('div', 'sheet probe');
    probe.style.width = 'calc((283mm - ' + ((defCols - 1) * 1.2) + 'em) / ' + defCols + ')';
    var mc = el('div', 'mc');
    probe.appendChild(mc);
    document.body.appendChild(probe);

    var units = [];
    model.forEach(function (cat, ci) {
      var head = 0;
      if (cat.sub) {
        var c = cat.sub.cloneNode(true);
        probe.insertBefore(c, mc);
        head = c.getBoundingClientRect().height * defCols; // l'en-tête occupe toute la largeur
        probe.removeChild(c);
      }
      cat.groups.forEach(function (g, gi) {
        var c = g.cloneNode(true);
        mc.appendChild(c);
        units.push({ ci: ci, gi: gi, w: c.getBoundingClientRect().height + 7 + (gi === 0 ? head : 0) });
        mc.removeChild(c);
      });
    });
    document.body.removeChild(probe);
    return units;
  }

  function paginate(n) {
    var units = measure();
    var total = units.reduce(function (s, u) { return s + u.w; }, 0);
    var target = total / n, cum = 0;
    units.forEach(function (u) {
      u.page = Math.min(n - 1, Math.floor((cum + u.w / 2) / target));
      cum += u.w;
    });

    var sheets = [];
    for (var p = 0; p < n; p++) {
      var sheet = el('div', 'sheet');
      sheet.id = 'sheet' + (p + 1);
      sheet.dataset.face = 'Page ' + (p + 1) + ' / ' + n;
      sheet.dataset.cols = defCols;
      if (titleEl) {
        var t = titleEl.cloneNode(true);
        var sub = t.querySelector('.doc-sub');
        if (sub) sub.textContent = 'Page ' + (p + 1) + ' / ' + n;
        sheet.appendChild(t);
      }
      var lastCi = -1, mc = null;
      units.filter(function (u) { return u.page === p; }).forEach(function (u) {
        var cat = model[u.ci];
        if (u.ci !== lastCi) {
          var wrap = cat.el.cloneNode(false);
          if (cat.sub) {
            var head = cat.sub.cloneNode(true);
            var title = head.querySelector('.sub-title');
            if (u.gi > 0 && title) title.textContent += ' (suite)';
            wrap.appendChild(head);
          }
          mc = el('div', 'mc');
          wrap.appendChild(mc);
          sheet.appendChild(wrap);
          lastCi = u.ci;
        }
        mc.appendChild(cat.groups[u.gi].cloneNode(true));
      });
      if (creditsEl) sheet.appendChild(creditsEl.cloneNode(true));
      sheets.push(sheet);
    }
    return sheets;
  }

  /* ---------- Rendu ---------- */

  function render(n) {
    bars = [];
    host.innerHTML = '';
    var sheets = n === original.length
      ? original.map(function (s) { return s.cloneNode(true); })
      : paginate(n);
    sheets.forEach(function (s) { host.appendChild(s); });
    host.querySelectorAll('.sheet').forEach(buildBar);
    pagesSel.value = String(n);
    store(PAGES_KEY, String(n));
  }

  function buildToolbar() {
    var bar = document.querySelector('.toolbar');
    if (!bar) { pagesSel = el('select'); return; }

    var counts = [];
    for (var i = 1; i <= MAX_PAGES; i++) counts.push(i);
    pagesSel = options(el('select', 'pages'), counts, original.length);
    pagesSel.addEventListener('change', function () { render(Number(pagesSel.value)); });

    var allCols = el('select', 'cols-all');
    allCols.appendChild(el('option', null, '—'));
    options(allCols, COLS, -1);
    allCols.addEventListener('change', function () {
      var v = allCols.value;
      if (v === '—') return;
      bars.forEach(function (b) { b.select.value = v; b.fit(); });
      allCols.selectedIndex = 0;
    });

    var reset = el('button', 'btn ghost', 'Mise en page d’origine'); reset.type = 'button';
    reset.addEventListener('click', function () { render(original.length); });
    var printBtn = el('button', 'btn', 'Tout imprimer'); printBtn.type = 'button';
    printBtn.addEventListener('click', printAll);

    [labelled('Pages', pagesSel), labelled('Colonnes (toutes)', allCols), reset, printBtn].forEach(function (n) { bar.appendChild(n); });
    bar.appendChild(el('p', 'hint', HINT));
  }

  function init() {
    var sheets = [].slice.call(document.querySelectorAll('.sheet'));
    if (!sheets.length) return;
    host = el('div', 'sheets');
    sheets[0].parentNode.insertBefore(host, sheets[0]);
    original = sheets.map(function (s) { return s.cloneNode(true); });
    sheets.forEach(function (s) { s.parentNode.removeChild(s); });

    extractModel();
    buildToolbar();
    var n = Number(store(PAGES_KEY));
    render(n >= 1 && n <= MAX_PAGES ? n : original.length);
  }

  window.addEventListener('afterprint', resetPrint);
  if (document.readyState === 'complete') init();
  else window.addEventListener('load', init);
})();
