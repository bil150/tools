/* Comparateur de textes : différences ligne par ligne, mots modifiés surlignés,
   vue côte à côte ou unifiée, export au format « diff unifié ».
   Algorithme : plus longue sous-séquence commune, après retrait du début et de la fin identiques.
   Aucune dépendance. */
(function () {
  'use strict';

  var MAX_CELLS = 9000000; // limite de la table de calcul (≈ 3000 × 3000 lignes différentes)
  var CONTEXT = 3;         // lignes de contexte autour d'une différence
  var MAX_WORDS_LEN = 1500; // au-delà, pas de comparaison mot à mot

  /* ---------- Calcul ---------- */

  function splitLines(text) {
    if (text === '') return [];
    var lines = text.replace(/\r\n?/g, '\n').split('\n');
    if (lines[lines.length - 1] === '') lines.pop(); // saut de ligne final
    return lines;
  }

  function keyOf(opts) {
    return function (line) {
      var s = line;
      if (opts.trim) s = s.replace(/^\s+|\s+$/g, '');
      if (opts.spaces) s = s.replace(/\s+/g, ' ');
      if (opts.nocase) s = s.toLowerCase();
      return s;
    };
  }

  /* Opérations [{ t: 'eq' | 'del' | 'add', i, j }] entre deux séquences de clés */
  function diffSeq(a, b) {
    var n = a.length, m = b.length, p = 0, s = 0, ops = [], i, j;
    while (p < n && p < m && a[p] === b[p]) p++;
    while (s < n - p && s < m - p && a[n - 1 - s] === b[m - 1 - s]) s++;
    for (i = 0; i < p; i++) ops.push({ t: 'eq', i: i, j: i });

    var N = n - p - s, M = m - p - s;
    if (N === 0) {
      for (j = 0; j < M; j++) ops.push({ t: 'add', j: p + j });
    } else if (M === 0) {
      for (i = 0; i < N; i++) ops.push({ t: 'del', i: p + i });
    } else {
      if ((N + 1) * (M + 1) > MAX_CELLS) throw new Error('Les textes sont trop différents et trop longs pour être comparés ici.');
      var W = M + 1, L = new Uint32Array((N + 1) * W);
      for (i = N - 1; i >= 0; i--) {
        for (j = M - 1; j >= 0; j--) {
          L[i * W + j] = a[p + i] === b[p + j]
            ? L[(i + 1) * W + j + 1] + 1
            : Math.max(L[(i + 1) * W + j], L[i * W + j + 1]);
        }
      }
      i = 0; j = 0;
      while (i < N && j < M) {
        if (a[p + i] === b[p + j]) { ops.push({ t: 'eq', i: p + i, j: p + j }); i++; j++; }
        else if (L[(i + 1) * W + j] >= L[i * W + j + 1]) { ops.push({ t: 'del', i: p + i }); i++; }
        else { ops.push({ t: 'add', j: p + j }); j++; }
      }
      for (; i < N; i++) ops.push({ t: 'del', i: p + i });
      for (; j < M; j++) ops.push({ t: 'add', j: p + j });
    }
    for (i = 0; i < s; i++) ops.push({ t: 'eq', i: n - s + i, j: m - s + i });
    return ops;
  }

  /* Deux lignes -> segments [{ text, changed }] pour chacune, mot à mot */
  function wordDiff(x, y) {
    var re = /\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu;
    var tx = x.match(re) || [], ty = y.match(re) || [];
    var ops = diffSeq(tx, ty), left = [], right = [];
    function push(list, text, changed) {
      var last = list[list.length - 1];
      if (last && last.changed === changed) last.text += text; else list.push({ text: text, changed: changed });
    }
    ops.forEach(function (o) {
      if (o.t === 'eq') { push(left, tx[o.i], false); push(right, ty[o.j], false); }
      else if (o.t === 'del') push(left, tx[o.i], true);
      else push(right, ty[o.j], true);
    });
    return { left: left, right: right };
  }

  /* Regroupe les opérations en blocs : { eq: ligne } ou { dels: [...], adds: [...] } */
  function toBlocks(ops, A, B) {
    var blocks = [], k = 0;
    while (k < ops.length) {
      if (ops[k].t === 'eq') {
        blocks.push({ kind: 'eq', a: ops[k].i, b: ops[k].j, text: A[ops[k].i] });
        k++;
        continue;
      }
      var dels = [], adds = [];
      while (k < ops.length && ops[k].t !== 'eq') {
        if (ops[k].t === 'del') dels.push({ no: ops[k].i, text: A[ops[k].i] });
        else adds.push({ no: ops[k].j, text: B[ops[k].j] });
        k++;
      }
      var pairs = Math.min(dels.length, adds.length);
      for (var q = 0; q < pairs; q++) {
        if (dels[q].text.length <= MAX_WORDS_LEN && adds[q].text.length <= MAX_WORDS_LEN) {
          var w = wordDiff(dels[q].text, adds[q].text);
          dels[q].segs = w.left; adds[q].segs = w.right;
        }
      }
      blocks.push({ kind: 'chg', dels: dels, adds: adds });
    }
    return blocks;
  }

  function stats(ops) {
    var s = { add: 0, del: 0, eq: 0 };
    ops.forEach(function (o) { s[o.t]++; });
    return s;
  }

  /* Texte au format « diff unifié » */
  function unifiedText(ops, A, B, nameA, nameB) {
    var out = ['--- ' + nameA, '+++ ' + nameB], ranges = [], k;
    var aPos = [], bPos = [], ai = 0, bi = 0;
    ops.forEach(function (o, idx) { aPos[idx] = ai; bPos[idx] = bi; if (o.t !== 'add') ai++; if (o.t !== 'del') bi++; });
    for (k = 0; k < ops.length; k++) {
      if (ops[k].t === 'eq') continue;
      var lo = Math.max(0, k - CONTEXT), hi = Math.min(ops.length - 1, k + CONTEXT), last = ranges[ranges.length - 1];
      if (last && lo <= last[1] + 1) last[1] = hi; else ranges.push([lo, hi]);
    }
    ranges.forEach(function (r) {
      var aLen = 0, bLen = 0, body = [];
      for (k = r[0]; k <= r[1]; k++) {
        var o = ops[k];
        if (o.t === 'eq') { body.push(' ' + A[o.i]); aLen++; bLen++; }
        else if (o.t === 'del') { body.push('-' + A[o.i]); aLen++; }
        else { body.push('+' + B[o.j]); bLen++; }
      }
      out.push('@@ -' + (aPos[r[0]] + (aLen ? 1 : 0)) + ',' + aLen + ' +' + (bPos[r[0]] + (bLen ? 1 : 0)) + ',' + bLen + ' @@');
      out = out.concat(body);
    });
    return out.join('\n') + '\n';
  }

  /* ---------- Affichage ---------- */

  function init() {
    var $ = function (id) { return document.getElementById(id); };
    function el(tag, cls, text) {
      var e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text != null) e.textContent = text;
      return e;
    }
    function cell(tag, cls, lineNo) { return el(tag, cls, lineNo == null ? '' : String(lineNo + 1)); }

    function content(item, kind) {
      var td = el('td', 'code ' + kind);
      if (item && item.segs) {
        item.segs.forEach(function (seg) {
          if (seg.changed) td.appendChild(el('mark', kind, seg.text));
          else td.appendChild(document.createTextNode(seg.text));
        });
      } else if (item) {
        td.textContent = item.text;
      }
      return td;
    }

    /* Visibilité : seules les lignes proches d'une différence, le reste est replié */
    function visibleRows(blocks, onlyDiffs) {
      var keep = blocks.map(function () { return true; });
      if (onlyDiffs) {
        keep = blocks.map(function (b) { return b.kind === 'chg'; });
        blocks.forEach(function (b, idx) {
          if (b.kind !== 'chg') return;
          for (var d = 1; d <= CONTEXT; d++) {
            if (idx - d >= 0) keep[idx - d] = true;
            if (idx + d < blocks.length) keep[idx + d] = true;
          }
        });
      }
      var rows = [], hidden = 0;
      blocks.forEach(function (b, idx) {
        if (keep[idx]) {
          if (hidden) { rows.push({ fold: hidden }); hidden = 0; }
          rows.push(b);
        } else hidden++;
      });
      if (hidden) rows.push({ fold: hidden });
      return rows;
    }

    function foldRow(n, cols) {
      var tr = el('tr', 'fold'), td = el('td', null, '… ' + n + (n > 1 ? ' lignes identiques' : ' ligne identique'));
      td.colSpan = cols;
      tr.appendChild(td);
      return tr;
    }

    function renderSide(rows) {
      var t = el('table', 'diff side');
      rows.forEach(function (r) {
        if (r.fold) { t.appendChild(foldRow(r.fold, 4)); return; }
        if (r.kind === 'eq') {
          var tr = el('tr');
          tr.appendChild(cell('td', 'no', r.a)); tr.appendChild(content({ text: r.text }, 'eq'));
          tr.appendChild(cell('td', 'no', r.b)); tr.appendChild(content({ text: r.text }, 'eq'));
          t.appendChild(tr);
          return;
        }
        var n = Math.max(r.dels.length, r.adds.length);
        for (var q = 0; q < n; q++) {
          var d = r.dels[q], a = r.adds[q], row = el('tr');
          row.appendChild(cell('td', 'no' + (d ? ' del' : ''), d ? d.no : null)); row.appendChild(content(d, d ? 'del' : 'void'));
          row.appendChild(cell('td', 'no' + (a ? ' add' : ''), a ? a.no : null)); row.appendChild(content(a, a ? 'add' : 'void'));
          t.appendChild(row);
        }
      });
      return t;
    }

    function renderUnified(rows) {
      var t = el('table', 'diff uni');
      function line(a, b, sign, item, kind) {
        var tr = el('tr');
        tr.appendChild(cell('td', 'no', a)); tr.appendChild(cell('td', 'no', b));
        tr.appendChild(el('td', 'sign ' + kind, sign));
        tr.appendChild(content(item, kind));
        t.appendChild(tr);
      }
      rows.forEach(function (r) {
        if (r.fold) { t.appendChild(foldRow(r.fold, 4)); return; }
        if (r.kind === 'eq') { line(r.a, r.b, ' ', { text: r.text }, 'eq'); return; }
        r.dels.forEach(function (d) { line(d.no, null, '−', d, 'del'); });
        r.adds.forEach(function (a) { line(null, a.no, '+', a, 'add'); });
      });
      return t;
    }

    var last = null;
    function update() {
      var out = $('out'), err = $('err'), summary = $('summary');
      var opts = { trim: $('optTrim').checked, spaces: $('optSpaces').checked, nocase: $('optCase').checked };
      var A = splitLines($('textA').value), B = splitLines($('textB').value);
      out.innerHTML = ''; err.hidden = true; last = null;
      $('copy').disabled = true;
      if (!A.length && !B.length) { summary.textContent = 'Saisissez ou collez deux textes à comparer.'; return; }
      try {
        var key = keyOf(opts), ops = diffSeq(A.map(key), B.map(key)), s = stats(ops);
        last = { ops: ops, A: A, B: B };
        summary.textContent = s.add + ' ligne(s) ajoutée(s) · ' + s.del + ' supprimée(s) · ' + s.eq + ' identique(s)';
        if (!s.add && !s.del) { out.appendChild(el('p', 'notice', 'Les deux textes sont identiques' + (opts.trim || opts.spaces || opts.nocase ? ' avec ces options.' : '.'))); return; }
        $('copy').disabled = false;
        var rows = visibleRows(toBlocks(ops, A, B), $('optOnly').checked);
        var wrap = el('div', 'scroll');
        wrap.appendChild($('viewSide').getAttribute('aria-pressed') === 'true' ? renderSide(rows) : renderUnified(rows));
        out.appendChild(wrap);
      } catch (e) {
        summary.textContent = '';
        err.textContent = e.message; err.hidden = false;
      }
    }

    function setView(side) {
      $('viewSide').setAttribute('aria-pressed', String(side));
      $('viewUni').setAttribute('aria-pressed', String(!side));
      update();
    }

    var timer = null;
    function later() { clearTimeout(timer); timer = setTimeout(update, 150); }
    ['textA', 'textB'].forEach(function (id) { $(id).addEventListener('input', later); });
    ['optTrim', 'optSpaces', 'optCase', 'optOnly'].forEach(function (id) { $(id).addEventListener('change', update); });
    $('viewSide').addEventListener('click', function () { setView(true); });
    $('viewUni').addEventListener('click', function () { setView(false); });
    $('swap').addEventListener('click', function () {
      var t = $('textA').value; $('textA').value = $('textB').value; $('textB').value = t; update();
    });
    $('clear').addEventListener('click', function () { $('textA').value = ''; $('textB').value = ''; update(); });
    $('copy').addEventListener('click', function () {
      if (!last) return;
      var txt = unifiedText(last.ops, last.A, last.B, 'texte A', 'texte B'), b = $('copy'), old = b.textContent;
      var done = function () { b.textContent = 'Copié'; setTimeout(function () { b.textContent = old; }, 1200); };
      if (navigator.clipboard) navigator.clipboard.writeText(txt).then(done, function () {});
    });
    update();
  }

  if (typeof document !== 'undefined') init();
  if (typeof module !== 'undefined') {
    module.exports = { splitLines: splitLines, diffSeq: diffSeq, wordDiff: wordDiff, toBlocks: toBlocks, stats: stats, unifiedText: unifiedText, keyOf: keyOf };
  }
})();
