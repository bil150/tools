/* Étude d’image : image de référence (mise en grille, perception des valeurs, pipette), couleurs physiques (peinture),
   recette de mélange (moteur dans ../melange-moteur.js), paramètres et sauvegardes.
   Tout reste dans le navigateur : rien n'est envoyé nulle part. */
(function () {
  'use strict';

  var MAX_SIDE = 1600;                      // l'image est réduite au-delà, pour garder une page fluide
  var NS = 'tools:arts:melangeur:';         // préfixe des clés de stockage (nom d'origine conservé pour ne pas perdre les tubes déjà saisis)
  var KEY_TUBES = NS + 'atelier'; // clé d'origine conservée : les tubes déjà saisis restent lisibles
  var KEY_GRID = NS + 'grille';
  var KEY_LAYOUT = NS + 'disposition';
  var KEY_THEME = NS + 'theme';
  var KEY_OPTS = NS + 'reglages';
  var MAX_TUBES = 1000;

  var $ = function (id) { return document.getElementById(id); };
  var drop = $('drop'), canvas = $('canvas'), dropMsg = $('dropMsg');
  var file = $('file'), pick = $('pick'), info = $('info'), err = $('err'), exportBtn = $('exportBtn');
  var ctx = canvas.getContext('2d');

  // Pixels d'origine (réduits), conservés hors écran : base des modes, de la pipette et de l'export.
  var source = null, sourceCtx = null, imageName = '';
  var gray = null;          // version en niveaux de gris, calculée à la demande
  var mode = 'grid';        // 'grid' | 'values' | 'pick'
  var picked = null;        // point fixé par un clic ou un toucher : { x, y }
  var dragging = false;
  var exporting = false;    // vrai pendant l'export : pas de viseur sur l'image enregistrée

  /* ---------- Outils ---------- */

  function showError(msg) { err.textContent = msg; err.hidden = !msg; }

  function clampInt(v, min, max, def) {
    v = parseInt(v, 10);
    if (isNaN(v)) return def;
    return Math.min(max, Math.max(min, v));
  }
  function clampNum(v, min, max, def) {
    v = parseFloat(v);
    if (isNaN(v)) return def;
    return Math.min(max, Math.max(min, v));
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function hex2(n) { return (n < 16 ? '0' : '') + n.toString(16).toUpperCase(); }
  function parseHex(s) {
    var m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(s).trim());
    if (!m) return null;
    var h = m[1];
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }
  function toHex(c) { return '#' + hex2(c.r).toLowerCase() + hex2(c.g).toLowerCase() + hex2(c.b).toLowerCase(); }
  function rgbCss(c) { return 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')'; }

  // Stockage du navigateur : chaque accès est protégé (navigation privée, stockage bloqué…).
  var storageOk = true;
  function readJSON(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { storageOk = false; return null; }
  }
  function writeJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (e) { storageOk = false; return false; }
  }

  function download(blob, filename) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  // Rapport entre pixels du canvas et pixels affichés : garde des traits d'épaisseur constante à l'écran.
  function scaleOf(cv) {
    var w = cv.offsetWidth * (cv.zoom || 1);   // largeur affichée, zoom compris
    if (!(w > 0)) return 1;
    var k = cv.width / w;
    return cv === canvas ? Math.max(1, k) : Math.max(0.1, k); // le nuancier zoomé peut dépasser sa résolution : viseur plus petit en pixels de l'image
  }
  function scale() { return scaleOf(canvas); }

  // Lit un fichier image (type vérifié) : onOk(img, nom) ou onErr(message).
  function loadImageFile(f, onOk, onErr) {
    if (!f) return;
    if (!/^image\//.test(f.type)) { onErr('Ce fichier n’est pas une image.'); return; }
    var url = URL.createObjectURL(f);
    var img = new Image();
    img.onload = function () { URL.revokeObjectURL(url); onOk(img, f.name); };
    img.onerror = function () { URL.revokeObjectURL(url); onErr('Impossible de lire cette image.'); };
    img.src = url;
  }

  // Zone de dépôt de fichier : surlignage au survol, puis onFile(fichier).
  function bindDrop(zone, onFile) {
    ['dragenter', 'dragover'].forEach(function (t) {
      zone.addEventListener(t, function (e) { e.preventDefault(); zone.classList.add('over'); });
    });
    ['dragleave', 'drop'].forEach(function (t) {
      zone.addEventListener(t, function (e) { e.preventDefault(); zone.classList.remove('over'); });
    });
    zone.addEventListener('drop', function (e) { onFile(e.dataTransfer.files[0]); });
  }

  // Réduit une image à MAX_SIDE et la pose sur un fond blanc (images transparentes) ; retourne le canvas.
  function shrinkToCanvas(img) {
    var w = img.naturalWidth, h = img.naturalHeight;
    var k = Math.min(1, MAX_SIDE / Math.max(w, h));
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * k));
    c.height = Math.max(1, Math.round(h * k));
    var x = c.getContext('2d', { willReadFrequently: true });
    x.fillStyle = '#fff';
    x.fillRect(0, 0, c.width, c.height);
    x.drawImage(img, 0, 0, c.width, c.height);
    return c;
  }

  /* ---------- Réglages de la grille ---------- */

  // La grille est toujours carrée : seul le nombre de colonnes se règle, la taille du carreau en découle
  // et le nombre de lignes suit la hauteur de l'image.
  var GRID_DEFAULT = { cols: 4, color: '#000000', width: 1, dash: 'solid', letters: false };
  var DASHES = ['solid', 'dash', 'dot'];

  function cleanGrid(g) {
    g = g && typeof g === 'object' ? g : {};
    var d = GRID_DEFAULT;
    return {
      cols: clampInt(g.cols, 1, 40, d.cols),
      color: typeof g.color === 'string' && parseHex(g.color) ? toHex(parseHex(g.color)) : d.color,
      // 1,5 px était l'ancien trait par défaut : il passe à 1 px (le nouveau défaut) tant qu'on ne l'a pas réglé depuis (v2)
      width: g.v !== 2 && g.width === 1.5 ? d.width : clampNum(g.width, 0.5, 8, d.width),
      dash: DASHES.indexOf(g.dash) !== -1 ? g.dash : d.dash,
      letters: g.letters === true,
      v: 2
    };
  }
  var grid = cleanGrid(readJSON(KEY_GRID));
  function saveGrid() { writeJSON(KEY_GRID, grid); }

  var gridCols = $('gridCols'), gridColor = $('gridColor'), gridWidth = $('gridWidth');

  function syncGridUI() {
    gridCols.value = grid.cols;
    gridColor.value = grid.color;
    gridWidth.value = grid.width;
    $('gridLetters').checked = grid.letters;
    $('gridWidthVal').textContent = String(grid.width).replace('.', ',') + ' px';
    Array.prototype.forEach.call(document.querySelectorAll('.dashes [data-dash]'), function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.dash === grid.dash));
    });
  }
  function gridChanged() { saveGrid(); syncGridUI(); render(); }

  Array.prototype.forEach.call(document.querySelectorAll('.dashes [data-dash]'), function (b) {
    b.addEventListener('click', function () { grid.dash = b.dataset.dash; gridChanged(); });
  });
  gridColor.addEventListener('input', function () { grid.color = gridColor.value; gridChanged(); });
  gridWidth.addEventListener('input', function () { grid.width = clampNum(gridWidth.value, 0.5, 8, 1.5); gridChanged(); });
  $('gridLetters').addEventListener('change', function () { grid.letters = this.checked; gridChanged(); });

  // Colonnes : saisie directe, ou boutons − et + aux deux bouts du champ
  gridCols.addEventListener('input', function () {
    grid.cols = clampInt(gridCols.value, 1, 40, grid.cols); // sans réécrire le champ pendant la frappe
    saveGrid(); render();
  });
  gridCols.addEventListener('change', function () {   // valeur relue et ramenée aux limites
    grid.cols = clampInt(gridCols.value, 1, 40, grid.cols);
    gridChanged();
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('.stepper button') : null;
    if (!b) return;
    grid.cols = clampInt(grid.cols + parseInt(b.dataset.step, 10), 1, 40, grid.cols);
    gridChanged();
  });

  // Nombre de lignes qui en résulte (peut être fractionnaire : la dernière rangée est alors coupée par le bord)
  function updateRowsInfo() {
    var info = $('rowsInfo');
    if (!source) { info.textContent = ''; return; }
    var n = source.height / (source.width / grid.cols);
    var txt = Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : n.toFixed(1).replace('.', ',');
    info.textContent = '× ' + txt + (n > 1.05 ? ' lignes' : ' ligne') + ', carreaux carrés';
  }

  /* ---------- Carreaux : repères (lettres), sélection et export ---------- */

  // Un carreau se nomme comme une case d'échiquier : colonne en lettres (A…Z, AA…), ligne en chiffres (A1, B1, A2…).
  // Les carreaux sont carrés, comptés depuis le coin haut gauche ; la dernière rangée peut être coupée par le bord.
  var MAX_CHUNKS = 1500;
  var selected = {};         // carreaux choisis : { 'colonne,ligne': true }
  var selectedCols = 0;      // nombre de colonnes pour lequel la sélection a été faite (elle n'a plus de sens si on le change)

  function colLabel(c) {
    var s = '';
    for (c += 1; c > 0; c = Math.floor((c - 1) / 26)) s = String.fromCharCode(65 + (c - 1) % 26) + s;
    return s;
  }
  function colIndex(letters) {
    var n = 0;
    for (var i = 0; i < letters.length; i++) n = n * 26 + letters.charCodeAt(i) - 64;
    return n - 1;
  }
  function chunkName(c, r) { return colLabel(c) + (r + 1); }
  function cellSize() { return source.width / grid.cols; }
  // Même règle que le tracé des traits : une rangée existe tant que son bord haut est dans l'image.
  function gridRowCount() { return Math.max(1, Math.ceil((source.height - 0.5) / cellSize())); }

  function cellRect(c, r) {
    var cell = cellSize();
    var x0 = Math.round(cell * c), x1 = Math.min(source.width, Math.round(cell * (c + 1)));
    var y0 = Math.round(cell * r), y1 = Math.min(source.height, Math.round(cell * (r + 1)));
    return { x0: x0, y0: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
  }

  function selectedList() {   // triés par ligne puis par colonne
    return Object.keys(selected).map(function (k) { var p = k.split(','); return [+p[0], +p[1]]; })
      .sort(function (a, b) { return a[1] - b[1] || a[0] - b[0]; });
  }

  // « A1, B2 » → carreaux ; accepte aussi les blocs « A1:C2 ». Retourne { set, bad } (bad : références refusées).
  function parseRefs(text) {
    var set = {}, bad = [], cols = grid.cols, rows = source ? gridRowCount() : 0;
    text.toUpperCase().split(/[\s,;]+/).filter(Boolean).forEach(function (tok) {
      var m = /^([A-Z]{1,2})(\d{1,4})(?::([A-Z]{1,2})(\d{1,4}))?$/.exec(tok);
      if (!m) { bad.push(tok); return; }
      var c0 = colIndex(m[1]), r0 = +m[2] - 1, c1 = m[3] ? colIndex(m[3]) : c0, r1 = m[4] ? +m[4] - 1 : r0;
      var ca = Math.min(c0, c1), cb = Math.max(c0, c1), ra = Math.min(r0, r1), rb = Math.max(r0, r1);
      if (ca < 0 || ra < 0 || cb >= cols || rb >= rows) { bad.push(tok); return; }
      for (var r = ra; r <= rb; r++) for (var c = ca; c <= cb; c++) set[c + ',' + r] = true;
    });
    return { set: set, bad: bad };
  }

  var chunkRefs = $('chunkRefs'), chunkBusy = false;

  function updateChunkUI() {
    var has = !!source, n = has ? selectedList().length : 0;
    if (has && gridRowCount() * grid.cols > MAX_CHUNKS) $('chunkAll').title = 'Trop de carreaux (' + MAX_CHUNKS + ' au maximum) : réduisez le nombre de colonnes.';
    else $('chunkAll').removeAttribute('title');
    $('chunkCount').textContent = has ? (n ? n + (n > 1 ? ' carreaux choisis' : ' carreau choisi') : 'Aucun carreau choisi')
      + ' sur ' + gridRowCount() * grid.cols : '';
    if (document.activeElement !== chunkRefs) chunkRefs.value = selectedList().map(function (p) { return chunkName(p[0], p[1]); }).join(', ');
    chunkRefs.classList.remove('bad');
    $('chunkClear').disabled = !n || chunkBusy;
    $('chunkSel').disabled = !n || chunkBusy;
    $('chunkAll').disabled = !has || chunkBusy || gridRowCount() * grid.cols > MAX_CHUNKS;
  }

  function resetSelection() { selected = {}; selectedCols = grid.cols; }

  chunkRefs.addEventListener('change', function () {
    if (!source) { chunkRefs.value = ''; return; }
    var res = parseRefs(chunkRefs.value);
    if (res.bad.length) {
      chunkRefs.classList.add('bad');
      $('chunkCount').textContent = 'Référence inconnue : ' + res.bad.slice(0, 3).join(', ');
      chunkRefs.select(); // le texte refusé est sélectionné : on retape par-dessus
      return;
    }
    selected = res.set;
    chunkRefs.blur();
    render();
  });
  $('chunkClear').addEventListener('click', function () { selected = {}; render(); });

  // Au clic dans le champ, tout le texte est sélectionné : ce qu'on tape remplace la liste au lieu de s'y ajouter.
  var refsSelectOnMouseup = false;
  chunkRefs.addEventListener('focus', function () { chunkRefs.select(); refsSelectOnMouseup = true; });
  chunkRefs.addEventListener('mouseup', function (e) {
    if (refsSelectOnMouseup) { e.preventDefault(); refsSelectOnMouseup = false; } // sinon le navigateur annule la sélection
  });

  // Un clic sur un carreau (mode Mise en grille) le choisit ou le retire.
  canvas.addEventListener('click', function (e) {
    if (suppressClick) { suppressClick = false; return; }   // c'était un déplacement de l'image, pas un choix de carreau
    if (mode !== 'grid' || !source) return;
    var p = pointFrom(e), cell = cellSize(), c = Math.min(grid.cols - 1, Math.floor(p.x / cell)), r = Math.floor(p.y / cell);
    if (r >= gridRowCount()) return;
    var k = c + ',' + r;
    if (selected[k]) delete selected[k]; else selected[k] = true;
    render();
  });

  /* Archive ZIP minimale (fichiers non compressés : des PNG le sont déjà), écrite ici pour ne dépendre de rien. */
  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(u8) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function makeZip(files) {   // files : [{ name, data: Uint8Array }]
    var enc = new TextEncoder(), parts = [], central = [], offset = 0, d = new Date(), cdSize = 0;
    var dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    var dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    files.forEach(function (f) {
      var name = enc.encode(f.name), crc = crc32(f.data), size = f.data.length;
      var lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); // 0x0800 : noms en UTF-8
      lh.setUint16(8, 0, true); lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, size, true); lh.setUint32(22, size, true);
      lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(lh.buffer, name, f.data);
      var ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
      ch.setUint16(10, 0, true); ch.setUint16(12, dosTime, true); ch.setUint16(14, dosDate, true);
      ch.setUint32(16, crc, true); ch.setUint32(20, size, true); ch.setUint32(24, size, true);
      ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
      central.push(ch.buffer, name);
      cdSize += 46 + name.length;
      offset += 30 + name.length + size;
    });
    var end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    return new Blob(parts.concat(central, [end.buffer]), { type: 'application/zip' });
  }

  // Découpe l'image d'origine (couleurs intactes, sans traits ni lettres) : un PNG par carreau.
  function cropPng(c, r) {
    var rc = cellRect(c, r), cv = document.createElement('canvas');
    cv.width = rc.w; cv.height = rc.h;
    cv.getContext('2d').drawImage(source, rc.x0, rc.y0, rc.w, rc.h, 0, 0, rc.w, rc.h);
    return new Promise(function (resolve) { cv.toBlob(resolve, 'image/png'); });
  }

  function exportChunks(list) {   // list : [[colonne, ligne], …]
    if (!source || !list.length || chunkBusy) return;
    chunkBusy = true;
    updateChunkUI();
    var files = [];
    list.reduce(function (chain, p) {
      return chain.then(function () {
        return cropPng(p[0], p[1]).then(function (blob) { return blob.arrayBuffer(); }).then(function (buf) {
          files.push({ name: imageName + '-' + chunkName(p[0], p[1]) + '.png', data: new Uint8Array(buf) });
        });
      });
    }, Promise.resolve()).then(function () {
      if (files.length === 1) download(new Blob([files[0].data], { type: 'image/png' }), files[0].name);
      else download(makeZip(files), imageName + '-carreaux.zip');
    }).catch(function () {
      showError('L’export des carreaux a échoué.');
    }).then(function () {
      chunkBusy = false;
      updateChunkUI();
    });
  }

  $('chunkSel').addEventListener('click', function () { exportChunks(selectedList()); });
  $('chunkAll').addEventListener('click', function () {
    var rows = gridRowCount(), all = [];
    for (var r = 0; r < rows; r++) for (var c = 0; c < grid.cols; c++) all.push([c, r]);
    exportChunks(all);
  });

  /* ---------- Niveaux de gris ---------- */

  // Luminance relative (sRGB linéaire) puis recodage en sRGB : le gris affiché a la même clarté perçue que la couleur.
  function makeGray() {
    var w = source.width, h = source.height;
    var data = sourceCtx.getImageData(0, 0, w, h);
    var px = data.data, i, lin = new Float32Array(256), enc = new Uint8ClampedArray(4096);
    for (i = 0; i < 256; i++) {
      var c = i / 255;
      lin[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }
    for (i = 0; i < 4096; i++) {
      var y = i / 4095;
      enc[i] = Math.round(255 * (y <= 0.0031308 ? 12.92 * y : 1.055 * Math.pow(y, 1 / 2.4) - 0.055));
    }
    for (i = 0; i < px.length; i += 4) {
      var Y = 0.2126 * lin[px[i]] + 0.7152 * lin[px[i + 1]] + 0.0722 * lin[px[i + 2]];
      var g = enc[Math.round(Y * 4095)];
      px[i] = px[i + 1] = px[i + 2] = g;
    }
    var out = document.createElement('canvas');
    out.width = w; out.height = h;
    out.getContext('2d').putImageData(data, 0, 0);
    return out;
  }

  /* ---------- Dessin ---------- */

  function drawGrid() {
    var w = canvas.width, h = canvas.height, s = scale(), i, p;
    var lw = grid.width * s;
    var dash = [], cap = 'butt';
    if (grid.dash === 'dash') dash = [Math.max(lw * 4, 6 * s), Math.max(lw * 3, 4 * s)];
    else if (grid.dash === 'dot') { dash = [0.01, Math.max(lw * 2.2, 4 * s)]; cap = 'round'; }

    // Carreaux carrés, comptés depuis le coin haut gauche : le côté se déduit du nombre de colonnes.
    var cell = w / grid.cols;
    ctx.save();
    ctx.lineCap = cap;
    ctx.setLineDash(dash);
    ctx.strokeStyle = grid.color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    for (i = 1; i < grid.cols; i++) { p = Math.round(cell * i); ctx.moveTo(p, 0); ctx.lineTo(p, h); }
    for (i = 1; cell * i < h - 0.5; i++) { p = Math.round(cell * i); ctx.moveTo(0, p); ctx.lineTo(w, p); }
    ctx.stroke();
    ctx.restore();

    var rows = gridRowCount(), c, r;

    // Lettres : le nom du carreau (A1, B1…) dans son coin haut gauche, dans la couleur de la grille.
    if (grid.letters && cell / s >= 28) {
      var fs = Math.max(11 * s, Math.min(cell * 0.2, 26 * s)), pad = 4 * s + lw / 2;
      ctx.save();
      ctx.font = '700 ' + fs + 'px system-ui, -apple-system, "Segoe UI", sans-serif';
      ctx.textBaseline = 'top';
      ctx.fillStyle = grid.color;
      for (r = 0; r < rows; r++) for (c = 0; c < grid.cols; c++) {
        ctx.fillText(chunkName(c, r), Math.round(cell * c) + pad, Math.round(cell * r) + pad);
      }
      ctx.restore();
    }

    // Carreaux choisis : un cadre épais à l'intérieur (aucun voile, pour ne pas changer les couleurs de l'image).
    if (!exporting) {
      var sw = Math.max(3 * s, lw * 2.5);
      ctx.save();
      ctx.strokeStyle = grid.color;
      ctx.lineWidth = sw;
      ctx.setLineDash([]);
      selectedList().forEach(function (q) {
        var rc = cellRect(q[0], q[1]);
        ctx.strokeRect(rc.x0 + sw / 2, rc.y0 + sw / 2, Math.max(1, rc.w - sw), Math.max(1, rc.h - sw));
      });
      ctx.restore();
    }
  }

  // Viseur en réticule sur le canvas cv (contexte cx) : cercle, branches, vide au centre pour voir le pixel visé.
  function drawSightOn(cx, cv, pt) {
    var s = scaleOf(cv), x = pt.x + 0.5, y = pt.y + 0.5;
    var r = 14 * s, gap = 4 * s;
    cx.save();
    [['rgba(255,255,255,.9)', 3.5 * s], ['rgba(0,0,0,.9)', 1.25 * s]].forEach(function (st) {
      cx.strokeStyle = st[0];
      cx.lineWidth = st[1];
      cx.beginPath();
      cx.arc(x, y, r, 0, Math.PI * 2);
      cx.moveTo(x - r - 6 * s, y); cx.lineTo(x - gap, y);
      cx.moveTo(x + gap, y);       cx.lineTo(x + r + 6 * s, y);
      cx.moveTo(x, y - r - 6 * s); cx.lineTo(x, y - gap);
      cx.moveTo(x, y + gap);       cx.lineTo(x, y + r + 6 * s);
      cx.stroke();
    });
    cx.restore();
  }
  function drawSight(pt) { drawSightOn(ctx, canvas, pt); }

  function render() {
    if (source && selectedCols !== grid.cols) resetSelection(); // les carreaux ont changé de taille : l'ancienne sélection n'a plus de sens
    updateRowsInfo();
    updateChunkUI();
    if (!source) return;
    var base = source;
    if (mode === 'values') {
      if (!gray) gray = makeGray();
      base = gray;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(base, 0, 0);
    if (mode === 'grid') drawGrid();
    if (mode === 'pick' && picked && !exporting) drawSight(picked);
    drawThumb(base);
  }

  // Quand la taille affichée change, on redessine pour garder des traits fins et nets (au plus une fois par image affichée).
  function afterFrame(fn) {
    var pending = false;
    return function () {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () { pending = false; fn(); });
    };
  }
  if (window.ResizeObserver) new ResizeObserver(afterFrame(render)).observe(canvas);

  /* ---------- Transitions : changements de vue, de disposition et de taille sans à-coup ---------- */

  // Le navigateur anime lui-même le passage de l'ancien état au nouveau (fondu, déplacement et changement de taille des blocs
  // nommés dans le CSS), sur le processeur graphique. Sans cette fonction, ou si l'utilisateur a demandé moins d'animations,
  // le changement est immédiat.
  var reduceMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function morph(update, instant) {
    if (!instant && document.startViewTransition && !(reduceMotion && reduceMotion.matches)) {
      var t = document.startViewTransition(update);
      // Une transition interrompue par la suivante (touches enchaînées) rejette ses promesses : c'est normal, on l'ignore.
      var ignore = function () {};
      t.ready.catch(ignore); t.finished.catch(ignore); t.updateCallbackDone.catch(ignore);
    } else {
      update();
    }
  }

  /* ---------- Export de l'image affichée ---------- */

  // Enregistre ce qu'on voit (grille comprise en mode Grille, niveaux de gris en mode Valeurs), sans le viseur.
  exportBtn.addEventListener('click', function () {
    if (!source) return;
    exporting = true;
    render();
    canvas.toBlob(function (blob) {
      if (blob) download(blob, imageName + ({ grid: '-grille', values: '-valeurs', pick: '' }[mode] || '') + '.png');
    }, 'image/png'); // le canvas est copié à l'appel : on peut le redessiner tout de suite
    exporting = false;
    render();
  });

  /* ---------- Menu latéral : sous-vues ---------- */

  // Grille, Valeurs et Aperçu & pipette partagent la vue image (image + tuiles à droite) ;
  // Couleurs physiques et Paramètres ont chacun leur vue.
  var tabs = { grid: $('tabGrid'), values: $('tabValues'), pick: $('tabPick'), couleurs: $('tabCouleurs'), settings: $('tabSettings') };
  var tabOrder = ['grid', 'values', 'pick', 'couleurs', 'settings'];
  var panelOf = { grid: 'viewMix', values: 'viewMix', pick: 'viewMix', couleurs: 'viewCouleurs', settings: 'viewSettings' };
  var sideTiles = {
    grid: ['tileCols', 'tileColor', 'tileLine', 'tileChunks', 'tileNav'],
    values: ['tileNav'],
    pick: ['tileRecipe', 'tileTarget', 'tileNav']   // la recette d'abord : c'est l'essentiel
  };
  var allTiles = sideTiles.grid.concat(sideTiles.pick).filter(function (id, i, a) { return a.indexOf(id) === i; });
  // Adresses courtes, utilisées par les liens du menu Arts plastiques (etude-image.html#grille…).
  var slugOf = { grid: 'grille', values: 'valeurs', pick: 'pipette', couleurs: 'couleurs', settings: 'parametres' };
  var viewOfSlug = {};
  tabOrder.forEach(function (k) { viewOfSlug[slugOf[k]] = k; });
  var view = 'grid';

  function setView(v, keepHash, instant) {
    view = v; // tout de suite : la vue courante est connue même si l'animation n'a pas encore commencé
    morph(function () { applyView(v, keepHash); }, instant);
  }

  function applyView(v, keepHash) {
    view = v;
    tabOrder.forEach(function (k) {
      tabs[k].setAttribute('aria-selected', String(k === v));
      tabs[k].tabIndex = k === v ? 0 : -1;
    });
    ['viewMix', 'viewCouleurs', 'viewSettings'].forEach(function (id) { $(id).hidden = id !== panelOf[v]; });
    dragging = false;
    if (panelOf[v] === 'viewMix') {
      mode = v;
      $('dash').dataset.mode = v;
      allTiles.forEach(function (id) { $(id).hidden = sideTiles[v].indexOf(id) === -1; });
      drop.classList.toggle('mode-pick', v === 'pick');
      drop.classList.toggle('mode-grid', v === 'grid');
      drop.classList.toggle('mode-values', v === 'values');
      canvas.tabIndex = v === 'pick' ? 0 : -1;
      render();
    }
    $('layoutBox').hidden = panelOf[v] !== 'viewMix'; // la disposition ne concerne que la vue de l'image
    updateSuggest();
    if (v === 'settings') updateStorageInfo();
    if (!keepHash && window.history && history.replaceState) {
      try { history.replaceState(null, '', '#' + slugOf[v]); } catch (_) { /* sans importance */ }
    }
  }

  /* ---------- Disposition rapide (sous le menu) ---------- */

  // 'below' : tuiles sous l'image (par défaut) ; 'right' : tuiles à droite ; 'focus' : image seule.
  var LAYOUTS = ['below', 'right', 'focus'];
  var layout = LAYOUTS.indexOf(readJSON(KEY_LAYOUT)) !== -1 ? readJSON(KEY_LAYOUT) : 'below';

  function setLayout(l, noSave, instant) {
    layout = LAYOUTS.indexOf(l) !== -1 ? l : 'below';
    if (!noSave) writeJSON(KEY_LAYOUT, layout);
    morph(function () {
      $('dash').dataset.layout = layout;
      Array.prototype.forEach.call(document.querySelectorAll('[data-layout]'), function (b) {
        if (b.tagName === 'BUTTON') b.setAttribute('aria-pressed', String(b.dataset.layout === layout));
      });
      render();
    }, instant);
  }
  Array.prototype.forEach.call(document.querySelectorAll('button[data-layout]'), function (b) {
    b.addEventListener('click', function () { setLayout(b.dataset.layout); });
  });

  /* Thème de la page : « site » (défaut, comme les autres pages), « gris » (neutre), « papier », « contraste » */
  var THEMES = ['site', 'gris', 'papier', 'contraste'];
  function setTheme(t, noSave) {
    t = THEMES.indexOf(t) !== -1 ? t : 'site';
    if (t === 'site') document.documentElement.removeAttribute('data-palette'); else document.documentElement.setAttribute('data-palette', t);
    if (!noSave) writeJSON(KEY_THEME, t);
    Array.prototype.forEach.call(document.querySelectorAll('button[data-palette]'), function (b) { b.setAttribute('aria-pressed', String(b.dataset.palette === t)); });
  }
  Array.prototype.forEach.call(document.querySelectorAll('button[data-palette]'), function (b) {
    b.addEventListener('click', function () { setTheme(b.dataset.palette); });
  });
  setTheme(readJSON(KEY_THEME), true);

  window.addEventListener('hashchange', function () {
    var v = viewOfSlug[location.hash.slice(1)];
    if (v && v !== view) setView(v, true);
  });

  tabOrder.forEach(function (k) {
    tabs[k].addEventListener('click', function () { setView(k); });
    tabs[k].addEventListener('keydown', function (e) {
      var i = tabOrder.indexOf(k), n = tabOrder.length, to = -1;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') to = (i + 1) % n;
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') to = (i + n - 1) % n;
      else if (e.key === 'Home') to = 0;
      else if (e.key === 'End') to = n - 1;
      if (to < 0) return;
      e.preventDefault();
      setView(tabOrder[to]);
      tabs[tabOrder[to]].focus();
    });
  });

  /* ---------- Pipette : un clic (ou un toucher) fixe le point, le simple survol ne change rien ---------- */

  function pointFrom(e) {
    var r = canvas.getBoundingClientRect();
    var x = Math.floor((e.clientX - r.left) * canvas.width / r.width);
    var y = Math.floor((e.clientY - r.top) * canvas.height / r.height);
    return {
      x: Math.min(canvas.width - 1, Math.max(0, x)),
      y: Math.min(canvas.height - 1, Math.max(0, y))
    };
  }

  // Valeur exacte du pixel dans l'image d'origine (jamais dans le canvas affiché, qui porte le viseur).
  function pixelAt(pt) {
    var d = sourceCtx.getImageData(pt.x, pt.y, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2] };
  }

  /* ---------- Couleur cible ---------- */

  var target = null; // { r, g, b } : couleur à reproduire, utilisée par la recette
  var targetKey = '';

  function pct(v) { return Math.round(v * 100) + ' %'; }

  // Synthèse soustractive simple : C, M, J = 1 − R, V, B ; le noir K en est la part commune.
  function toCmy(c) { return [1 - c.r / 255, 1 - c.g / 255, 1 - c.b / 255]; }
  function toCmyk(c) {
    var cmy = toCmy(c), k = Math.min(cmy[0], cmy[1], cmy[2]);
    if (k >= 1) return [0, 0, 0, 1];
    return [(cmy[0] - k) / (1 - k), (cmy[1] - k) / (1 - k), (cmy[2] - k) / (1 - k), k];
  }

  function updateTarget() {
    target = picked && source ? pixelAt(picked) : null;
    $('target').hidden = $('tNote').hidden = !target;
    $('targetEmpty').hidden = !!target;
    // La recette n'est recalculée que si la couleur cible a réellement changé.
    var key = target ? target.r + ',' + target.g + ',' + target.b : '';
    if (key !== targetKey) { targetKey = key; scheduleRecipe(); }
    if (!target) return;
    var cmy = toCmy(target), cmyk = toCmyk(target);
    $('tSwatch').style.background = rgbCss(target);
    $('tHex').textContent = '#' + hex2(target.r) + hex2(target.g) + hex2(target.b);
    $('tRgb').textContent = target.r + ', ' + target.g + ', ' + target.b;
    $('tCmy').textContent = cmy.map(pct).join(' · ');
    $('tCmyk').textContent = cmyk.map(pct).join(' · ');
    $('tPos').textContent = picked.x + ', ' + picked.y;
  }

  function refresh() {
    render();
    updateTarget();
  }

  /* Pointeurs sur l'image. Pipette : un appui fixe le point, le glisser l'affine (le survol ne change rien).
     Grille et valeurs : zoomé, un glisser déplace l'image. Partout : deux doigts zooment et déplacent,
     le bouton du milieu de la souris déplace. */
  var iPtr = {}, iPinch = null, suppressClick = false, pickBefore = null;
  canvas.addEventListener('pointerdown', function (e) {
    if (!source || (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 1)) return;
    if (Object.keys(iPtr).length >= 2) return;
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* sans importance */ }
    var middle = e.pointerType === 'mouse' && e.button === 1;
    if (middle) e.preventDefault();
    iPtr[e.pointerId] = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false, pan: middle || mode !== 'pick' };
    if (Object.keys(iPtr).length === 2) {
      // deux doigts : c'est un zoom, pas un pointage ; le premier doigt n'a donc pas déplacé le point
      if (dragging) { dragging = false; picked = pickBefore; refresh(); }
      Object.keys(iPtr).forEach(function (id) { iPtr[id].moved = true; });
      iPinch = izPinchStart(); suppressClick = true;
      return;
    }
    if (mode === 'pick' && !middle) { pickBefore = picked; dragging = true; picked = pointFrom(e); refresh(); }
  });
  canvas.addEventListener('pointermove', function (e) {
    var p = iPtr[e.pointerId];
    if (!p) return;
    var dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (iPinch && Object.keys(iPtr).length === 2) { izPinchMove(); return; }
    if (dragging && !p.pan) { picked = pointFrom(e); refresh(); return; }   // pipette : on affine le point
    if (!p.pan) return;
    if (!p.moved && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) < 5) return;   // petit tremblement : toujours un clic
    p.moved = true; suppressClick = true;
    if (iz > 1) { itx += dx; ity += dy; izApply(); }
  });
  function endDrag(e) {
    delete iPtr[e.pointerId];
    if (Object.keys(iPtr).length < 2) iPinch = null;
    if (!Object.keys(iPtr).length) dragging = false;
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  // Au clavier : flèches pour déplacer le viseur d'un pixel (Maj : dix pixels).
  canvas.addEventListener('keydown', function (e) {
    if (!source) return;
    if (e.key === '+' || e.key === '=') { e.preventDefault(); izZoomCenter(1.5); return; }
    if (e.key === '-' || e.key === '_') { e.preventDefault(); izZoomCenter(1 / 1.5); return; }
    if (e.key === '0') { e.preventDefault(); izReset(); return; }
    if (mode !== 'pick') return;
    var d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!d) return;
    e.preventDefault();
    var k = e.shiftKey ? 10 : 1;
    var from = picked || { x: Math.floor(canvas.width / 2), y: Math.floor(canvas.height / 2) };
    picked = {
      x: Math.min(canvas.width - 1, Math.max(0, from.x + d[0] * k)),
      y: Math.min(canvas.height - 1, Math.max(0, from.y + d[1] * k))
    };
    refresh();
    izReveal(picked);
  });

  /* ---------- Zoom et déplacement dans l'image, tuile Navigation ---------- */

  // L'image tient entière dans sa zone (cadre dimensionné ici) ; zoomer agrandit le canvas dans ce cadre par une transformation :
  // aucun pixel de l'image n'est recalculé, la pipette lit toujours l'image d'origine.
  var imgFrame = $('imgFrame'), navMap = $('navMap'), navThumb = $('navThumb');
  var FIT = window.matchMedia ? window.matchMedia('(min-width: 641px) and (min-height: 560px)') : { matches: false };
  var iz = 1, itx = 0, ity = 0, izDrawn = 1, thumbKey = '';
  var IZ_MAX = 16;

  function fitFrame() {
    imgFrame.hidden = canvas.hidden;
    if (canvas.hidden) { imgFrame.style.width = imgFrame.style.height = ''; updateNav(); return; }
    var availW = drop.clientWidth, availH = FIT.matches ? drop.clientHeight : Math.round(window.innerHeight * 0.8);
    var ar = canvas.width / canvas.height, w = Math.max(1, Math.min(availW, availH * ar));
    imgFrame.style.width = Math.floor(w) + 'px';
    imgFrame.style.height = Math.floor(w / ar) + 'px';
    izApply();
  }
  function izApply() {
    var fw = imgFrame.clientWidth, fh = imgFrame.clientHeight;
    iz = Math.min(IZ_MAX, Math.max(1, iz));
    itx = Math.min(0, Math.max(fw - fw * iz, itx));   // l'image ne quitte jamais le cadre
    ity = Math.min(0, Math.max(fh - fh * iz, ity));
    canvas.style.transform = iz === 1 ? '' : 'translate(' + itx + 'px,' + ity + 'px) scale(' + iz + ')';
    canvas.zoom = iz;
    // au-delà de la résolution de l'image, on montre les vrais pixels plutôt qu'un flou
    canvas.style.imageRendering = iz * fw / Math.max(1, canvas.width) > 2 ? 'pixelated' : '';
    imgFrame.classList.toggle('zoomed', iz > 1);
    if (iz !== izDrawn) { izDrawn = iz; render(); }   // traits de la grille et viseur gardent leur taille à l'écran
    updateNav();
  }
  function izReset() { iz = 1; itx = ity = 0; izApply(); }
  // Change le zoom en gardant fixe le point (fx, fy) du cadre
  function izZoomAt(z, fx, fy) {
    z = Math.min(IZ_MAX, Math.max(1, z));
    var k = z / iz;
    itx = fx - (fx - itx) * k; ity = fy - (fy - ity) * k; iz = z;
    izApply();
  }
  function izZoomCenter(f) { izZoomAt(iz * f, imgFrame.clientWidth / 2, imgFrame.clientHeight / 2); }
  // Ramène dans le cadre le point pt de l'image (viseur déplacé au clavier)
  function izReveal(pt) {
    if (iz === 1) return;
    var fw = imgFrame.clientWidth, fh = imgFrame.clientHeight, m = 24;
    var sx = (pt.x + 0.5) / canvas.width * fw * iz + itx, sy = (pt.y + 0.5) / canvas.height * fh * iz + ity;
    if (sx < m) itx += m - sx; else if (sx > fw - m) itx -= sx - (fw - m);
    if (sy < m) ity += m - sy; else if (sy > fh - m) ity -= sy - (fh - m);
    izApply();
  }
  function izPinchStart() {
    var ids = Object.keys(iPtr), a = iPtr[ids[0]], b = iPtr[ids[1]], r = imgFrame.getBoundingClientRect();
    var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    return { d: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), z: iz, ux: (mx - r.left - itx) / iz, uy: (my - r.top - ity) / iz };
  }
  function izPinchMove() {
    var ids = Object.keys(iPtr), a = iPtr[ids[0]], b = iPtr[ids[1]], r = imgFrame.getBoundingClientRect();
    var z = Math.min(IZ_MAX, Math.max(1, iPinch.z * Math.hypot(a.x - b.x, a.y - b.y) / iPinch.d));
    iz = z;   // le point de l'image qui était entre les doigts le reste, même quand les doigts se déplacent
    itx = (a.x + b.x) / 2 - r.left - iPinch.ux * z; ity = (a.y + b.y) / 2 - r.top - iPinch.uy * z;
    izApply();
  }
  // Molette : zoom autour du curseur (la page ne défile pas) ; sur téléphone, la page défile : Ctrl + molette zoome.
  imgFrame.addEventListener('wheel', function (e) {
    if (!source) return;
    var r = imgFrame.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey || FIT.matches) {
      e.preventDefault();
      izZoomAt(iz * Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.0025)), e.clientX - r.left, e.clientY - r.top);
    } else if (iz > 1) {
      e.preventDefault();
      itx -= e.deltaX; ity -= e.deltaY; izApply();
    }
  }, { passive: false });

  // Tuile Navigation : niveau de zoom, miniature et cadre de la partie visible
  function updateNav() {
    var has = !!source && !canvas.hidden;
    navMap.hidden = !has; $('navEmpty').hidden = has;
    $('izLevel').textContent = '×' + String(Math.round(iz * 10) / 10).replace('.', ',');
    $('izLevel').disabled = !has || iz === 1;
    $('izOut').disabled = !has || iz <= 1;
    $('izIn').disabled = !has || iz >= IZ_MAX;
    if (!has) return;
    var fw = imgFrame.clientWidth, fh = imgFrame.clientHeight, box = $('navBox');
    if (!fw || !fh) return;
    box.style.left = (-itx / (fw * iz) * 100) + '%';
    box.style.top = (-ity / (fh * iz) * 100) + '%';
    box.style.width = (100 / iz) + '%';
    box.style.height = (100 / iz) + '%';
  }
  // Miniature : l'image affichée (couleur ou valeurs), sans grille ni viseur ; redessinée seulement quand elle change
  var thumbSeq = 0;
  function drawThumb(base) {
    var tile = $('tileNav');
    if (!source || tile.hidden) return;
    var maxW = Math.max(60, tile.clientWidth - 32), ar = source.width / source.height;
    var w = Math.round(Math.min(maxW, 150 * ar)), hh = Math.round(w / ar);
    var key = thumbSeq + '|' + mode + '|' + w;
    if (key === thumbKey) return;
    thumbKey = key;
    navMap.style.width = w + 'px'; navMap.style.height = hh + 'px';
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    navThumb.width = Math.round(w * dpr); navThumb.height = Math.round(hh * dpr);
    var x = navThumb.getContext('2d');
    x.imageSmoothingQuality = 'high';
    x.drawImage(base, 0, 0, navThumb.width, navThumb.height);
    updateNav();
  }
  // Toucher ou glisser sur la miniature : la vue se centre sur ce point (à l'échelle 1, on zoome d'abord ×2)
  var navDrag = false;
  function navGo(e) {
    var r = navMap.getBoundingClientRect(), fw = imgFrame.clientWidth, fh = imgFrame.clientHeight;
    var fx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), fy = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    if (iz === 1) iz = 2;
    itx = fw / 2 - fx * fw * iz; ity = fh / 2 - fy * fh * iz;
    izApply();
  }
  navMap.addEventListener('pointerdown', function (e) {
    if (!source || (e.pointerType === 'mouse' && e.button !== 0)) return;
    navDrag = true;
    try { navMap.setPointerCapture(e.pointerId); } catch (_) { /* sans importance */ }
    navGo(e);
  });
  navMap.addEventListener('pointermove', function (e) { if (navDrag) navGo(e); });
  navMap.addEventListener('pointerup', function () { navDrag = false; });
  navMap.addEventListener('pointercancel', function () { navDrag = false; });
  $('izIn').addEventListener('click', function () { izZoomCenter(1.5); });
  $('izOut').addEventListener('click', function () { izZoomCenter(1 / 1.5); });
  $('izLevel').addEventListener('click', izReset);
  if (window.ResizeObserver) new ResizeObserver(afterFrame(fitFrame)).observe(drop);
  if (FIT.addEventListener) FIT.addEventListener('change', fitFrame);

  /* ---------- Importation de l'image ---------- */

  function setImage(img, name) {
    var w = img.naturalWidth, h = img.naturalHeight;
    source = shrinkToCanvas(img);
    sourceCtx = source.getContext('2d', { willReadFrequently: true });
    var cw = source.width, ch = source.height, k = cw / w;

    gray = null; picked = null; resetSelection();
    imageName = (name.replace(/\.[^.]*$/, '').replace(/[^\w\-]+/g, '-').replace(/^-+|-+$/g, '') || 'image').slice(0, 60);
    canvas.width = cw; canvas.height = ch;
    canvas.style.setProperty('--ar', String(cw / ch));
    canvas.hidden = false;
    dropMsg.hidden = true;
    drop.classList.add('has-image');
    iz = 1; itx = ity = 0; thumbSeq++; thumbKey = '';
    fitFrame();
    exportBtn.disabled = false;
    $('ppBtn').disabled = false;

    info.textContent = name + ' — ' + w + ' × ' + h + ' px' + (k < 1 ? ' (réduite à ' + cw + ' × ' + ch + ')' : '');
    pick.textContent = 'Changer d’image';
    refresh();
  }

  // Retire l'image de travail et la sélection (utilisé par « Vider le cache » et « Supprimer les données »).
  function clearImage() {
    source = sourceCtx = gray = picked = null;
    selected = {};
    imageName = '';
    canvas.hidden = true;
    dropMsg.hidden = false;
    drop.classList.remove('has-image');
    iz = 1; itx = ity = 0;
    canvas.style.transform = '';
    fitFrame();
    exportBtn.disabled = true;
    $('ppBtn').disabled = true;
    info.textContent = '';
    pick.textContent = 'Choisir une image';
    showError('');
    refresh();
  }

  function load(f) {
    showError('');
    loadImageFile(f, setImage, showError);
  }

  pick.addEventListener('click', function () { file.click(); });
  file.addEventListener('change', function () {
    load(file.files[0]);
    file.value = ''; // permet de re-choisir le même fichier
  });
  bindDrop(drop, load);
  // Évite que le navigateur ouvre l'image si elle est lâchée à côté de la zone
  window.addEventListener('dragover', function (e) { e.preventDefault(); });
  window.addEventListener('drop', function (e) { e.preventDefault(); });

  /* ---------- Couleurs physiques : tubes de peinture ---------- */

  // Aucun tube n'est préenregistré : l'utilisateur saisit les siens.
  var tubes = [];           // [{ id, name, pigment, hex, light, opac, group, active }] ; group = marque (facultative)
  var editingId = null;     // id du tube en cours de modification, ou null pour un ajout

  var tubeForm = $('tubeForm'), tubeList = $('tubes');
  var fName = $('tubeName'), fPig = $('tubePig'), fPick = $('tubePick'), fHex = $('tubeHex');
  var fR = $('tubeR'), fG = $('tubeG'), fB = $('tubeB'), tubeErr = $('tubeErr');

  function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  // Durabilité (solidité à la lumière, échelle ASTM : I excellente, II très bonne, III insuffisante)
  // et transparence / opacité : indications du fabricant, facultatives.
  var LIGHT = { I: ['ASTM I', 'Excellente'], II: ['ASTM II', 'Très bonne'], III: ['ASTM III', 'Insuffisante'] };
  var OPAC = { T: 'Transparente', ST: 'Semi-transparente', SO: 'Semi-opaque', O: 'Opaque' };
  var LIGHT_RANK = { I: 1, II: 2, III: 3 };

  // Les règles de validation d'un tube sont celles de nuancier.js (une seule source, aussi pour les fichiers importés).
  function cleanTube(t) {
    if (!t || typeof t !== 'object') return null;
    var r = Nuancier.cleanTube(t, '');
    if (r.error) return null;
    var c = r.tube;
    c.id = typeof t.id === 'string' && t.id ? t.id.slice(0, 40) : newId();
    c.active = t.active !== false;               // « je l'ai » : la peinture sert au calcul
    c.want = t.want === true && !c.active;       // « à acquérir » : jamais en même temps que « je l'ai »
    return c;
  }

  // Liste de tubes issue d'un stockage ou d'un fichier : validée, plafonnée, identifiants uniques.
  function cleanTubeList(list) {
    if (!Array.isArray(list)) return [];
    var seen = {};
    return list.slice(0, MAX_TUBES).map(cleanTube).filter(Boolean).map(function (t) {
      if (seen[t.id]) t.id = newId();
      seen[t.id] = true;
      return t;
    });
  }

  /* Réglage « noir chromatique uniquement » : actif par défaut. Un tube noir (pigment PBk, ou couleur neutre très sombre) n'est alors
     ni utilisé dans le calcul ni proposé : le noir se fabrique en mélangeant des couleurs. */
  var opts = { chromaticBlack: true, noEffects: true };
  (function () { var o = readJSON(KEY_OPTS); opts.chromaticBlack = !(o && o.chromaticBlack === false); opts.noEffects = !(o && o.noEffects === false); })();
  function saveOpts() { writeJSON(KEY_OPTS, opts); }
  var blackCache = {};
  // Un tube noir : son nom le dit (black, noir…), ou son pigment n'est fait que de noirs (PBk), ou sa couleur est très sombre et
  // sans teinte. Un pigment noir mélangé à d'autres (terre d'ombre, gris de Payne en mélange…) ne suffit pas : ce n'est pas un noir.
  var BLACK_WORDS = /(^|[^a-z])(black|noir|nero|negro|schwarz|zwart|preto)([^a-z]|$)/;
  function isBlackTube(t) {
    var k = t.name + '|' + t.hex + '|' + t.pigment;
    if (blackCache.hasOwnProperty(k)) return blackCache[k];
    var name = String(t.name || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    var codes = String(t.pigment || '').split(/[\/,+\s]+/).filter(Boolean);
    // un métallisé à base de pigment noir (graphite, étain, argent) est d'abord un métallisé : seul son nom peut en faire un noir
    var effect = !!Nuancier.effectKind(t);
    var black = BLACK_WORDS.test(name) || (!effect && codes.length > 0 && codes.every(function (c) { return /^PBk\d*$/i.test(c); }));
    if (!black && !effect && window.MelangeMoteur) {
      var lab = window.MelangeMoteur.rgbToLab(parseHex(t.hex));
      black = lab[0] <= 25 && Math.sqrt(lab[1] * lab[1] + lab[2] * lab[2]) <= 8;   // très sombre et sans teinte
    }
    return (blackCache[k] = black);
  }
  function blackExcluded(t) { return opts.chromaticBlack && isBlackTube(t); }

  /* Réglage « sans métallisé ni irisé » : actif par défaut. L'effet vient du tube (champ « Effet ») ou, à défaut, de son nom ou de son
     code pigment (Nuancier.effectKind). Un tube à effet n'est alors ni utilisé ni proposé : une couleur unique ne peut pas le représenter. */
  function effectExcluded(t) { return opts.noEffects && !!Nuancier.effectKind(t); }
  function excludedTube(t) { return blackExcluded(t) || effectExcluded(t); }

  function loadTubes() {
    var d = readJSON(KEY_TUBES);
    return d && Array.isArray(d.tubes) ? cleanTubeList(d.tubes) : [];
  }
  function saveTubes() {
    storageOk = writeJSON(KEY_TUBES, { v: 1, tubes: tubes });
    $('storeWarn').hidden = storageOk;
    scheduleRecipe(); // les tubes activés ont peut-être changé
  }

  function updateCount() {
    var n = tubes.length, a = tubes.filter(function (t) { return t.active; }).length, w = tubes.filter(function (t) { return t.want; }).length;
    $('tubeCount').textContent = n
      ? n + (n > 1 ? ' tubes' : ' tube') + ' · ' + a + (a > 1 ? ' activés' : ' activé') + (w ? ' · ' + w + ' à acquérir' : '')
      : 'Aucun tube pour l’instant.';
    updateListBar();
  }

  /* Statut d'une peinture : « je l'ai » (cochée, sert au calcul), « à acquérir » ou « catalogue » (ni l'un ni l'autre). */
  var listFilter = 'all';   // filtre de la liste : all | have | want | cat
  function statusOf(t) { return t.active ? 'have' : t.want ? 'want' : 'cat'; }
  function setStatus(t, st) { t.active = st === 'have'; t.want = st === 'want'; }
  // Recherche : nom, groupe, pigment ou code couleur ; sans accents ni majuscules, tous les mots doivent se retrouver
  var listQuery = [];
  function fold(v) { return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
  function matchesQuery(t) {
    if (!listQuery.length) return true;
    var hay = fold([t.name, t.group, t.pigment, t.hex].join(' '));
    return listQuery.every(function (w) { return hay.indexOf(w) !== -1; });
  }
  function matchesFilter(t) { return (listFilter === 'all' || statusOf(t) === listFilter) && matchesQuery(t); }
  var searchBox = $('tubeSearch'), searchTimer = null;
  searchBox.addEventListener('input', function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () { listQuery = fold(searchBox.value).split(/\s+/).filter(Boolean); renderTubes(); }, 120);
  });
  searchBox.addEventListener('keydown', function (e) {   // Échap vide la recherche
    if (e.key === 'Escape' && searchBox.value) { e.preventDefault(); searchBox.value = ''; listQuery = []; renderTubes(); }
  });

  // Barre de filtre : effectifs, et copie de la liste à acquérir (liste de courses)
  function updateListBar() {
    var bar = $('listBar'), cnt = { all: tubes.length, have: 0, want: 0, cat: 0 };
    tubes.forEach(function (t) { cnt[statusOf(t)]++; });
    bar.hidden = !tubes.length;
    Array.prototype.forEach.call(document.querySelectorAll('#tubeFilter [data-filter]'), function (b) {
      var k = b.dataset.filter;
      b.textContent = ({ all: 'Tous', have: 'Je les ai', want: 'À acquérir', cat: 'Catalogue' })[k] + ' · ' + cnt[k];
      b.setAttribute('aria-pressed', String(k === listFilter));
    });
    $('wantCopy').hidden = !cnt.want;
    $('haveCopy').hidden = !cnt.have;
  }
  Array.prototype.forEach.call(document.querySelectorAll('#tubeFilter [data-filter]'), function (b) {
    b.addEventListener('click', function () { listFilter = b.dataset.filter; renderTubes(); });
  });
  // Copie d'une liste de peintures (je les ai / à acquérir) : marque, nom, pigments, couleur
  function copyStatusList(st, title) {
    var list = tubes.filter(function (t) { return statusOf(t) === st; });
    var lines = [title + ' (' + list.length + ')'].concat(list.map(function (t) {
      return (t.group ? t.group + ' · ' : '') + t.name + (t.pigment ? ' (' + t.pigment + ')' : '') + ' · ' + t.hex.toUpperCase();
    }));
    copyText(lines.join('\n'), $('wantCopyMsg'));
  }
  $('wantCopy').addEventListener('click', function () { copyStatusList('want', 'À acquérir'); });
  $('haveCopy').addEventListener('click', function () { copyStatusList('have', 'Je les ai'); });

  // Pastilles « ASTM I » et « Opaque » d'un tube (null si rien n'est indiqué).
  function tubeTags(t) {
    var noir = blackExcluded(t), ef = Nuancier.effectKind(t);
    if (!t.light && !t.opac && !t.want && !noir && !ef) return null;
    var box = el('span', 'tags');
    if (noir) { var n = el('span', 'tag', 'Noir exclu'); n.title = 'Pas de tubes noirs (Paramètres) : ce tube n’est ni utilisé ni proposé'; box.appendChild(n); }
    if (ef) {
      var ex = opts.noEffects, en = el('span', 'tag', (ef === 'metal' ? 'Métallisé' : ef === 'iri' ? 'Irisé' : 'Fluorescent') + (ex ? ' exclu' : ''));
      en.title = 'Aspect qui dépend de la lumière : une couleur unique ne peut pas le représenter' + (ex ? ' (Paramètres : pas de tubes métallisés, irisés ni fluorescents) — ce tube n’est ni utilisé ni proposé' : '');
      box.appendChild(en);
    }
    if (t.want) { var w = el('span', 'tag want', 'À acquérir'); w.title = 'Peinture à acquérir : elle ne sert pas au calcul tant qu’elle n’est pas cochée'; box.appendChild(w); }
    if (t.light) { var a = el('span', 'tag', LIGHT[t.light][0]); a.title = 'Durabilité : ' + LIGHT[t.light][0] + ' – ' + LIGHT[t.light][1]; box.appendChild(a); }
    if (t.opac) { var b = el('span', 'tag', OPAC[t.opac]); b.title = 'Transparence / opacité : ' + OPAC[t.opac]; box.appendChild(b); }
    return box;
  }

  var openGroups = {};      // groupes ouverts ou fermés, gardé d'un affichage à l'autre
  var groupUI = [];         // groupes affichés : { list, box (case « tout »), cnt }
  var lastGroup = '';       // dernier groupe saisi : proposé pour le tube suivant

  function groupNames() {
    var seen = {}, out = [];
    tubes.forEach(function (t) { if (t.group && !seen[t.group]) { seen[t.group] = true; out.push(t.group); } });
    return out.sort(function (a, b) { return a.localeCompare(b, 'fr'); });
  }

  function tubeItem(t) {
    var li = el('li', 'tube' + (t.active ? '' : t.want ? ' want' : ' off'));
    var use = el('label', 'use');
    var cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = t.active;
    cb.setAttribute('aria-label', 'Je possède « ' + t.name + ' » : l’utiliser dans le calcul');
    cb.addEventListener('change', function () {
      var hadWant = t.want;
      t.active = cb.checked;
      if (t.active) t.want = false;   // on l'a : ce n'est plus « à acquérir »
      saveTubes();
      if ((hadWant && t.active) || listFilter !== 'all') { renderTubes(); return; }   // l'étiquette ou la liste filtrée change
      li.classList.toggle('off', !t.active);
      wantBtn.hidden = t.active;
      rebuy.hidden = !t.active;
      updateCount(); updateGroupStates();
    });
    use.appendChild(cb);

    var chip = el('span', 'chip');
    chip.style.background = t.hex;
    var meta = el('span', 'meta');
    meta.appendChild(el('b', null, t.name));
    meta.appendChild(el('span', null, (t.pigment ? t.pigment + ' · ' : '') + t.hex.toUpperCase()));
    var tg = tubeTags(t);
    if (tg) meta.appendChild(tg);

    var acts = el('span', 'acts');
    var wantBtn = el('button', 'tbtn wantbtn', 'À acquérir'); wantBtn.type = 'button';
    wantBtn.setAttribute('aria-pressed', String(!!t.want));
    wantBtn.hidden = t.active;   // une peinture qu'on a ne peut pas être « à acquérir » : le bouton n'est pas affiché
    wantBtn.setAttribute('aria-label', (t.want ? 'Retirer « ' : 'Marquer « ') + t.name + (t.want ? ' » des peintures à acquérir' : ' » à acquérir'));
    wantBtn.addEventListener('click', function () {
      setStatus(t, t.want ? 'cat' : 'want');
      saveTubes(); renderTubes();
    });
    var edit = el('button', 'tbtn', 'Modifier'); edit.type = 'button';
    edit.setAttribute('aria-label', 'Modifier « ' + t.name + ' »');
    edit.addEventListener('click', function () { openForm(t); });
    var del = el('button', 'tbtn del', 'Supprimer'); del.type = 'button';
    del.setAttribute('aria-label', 'Supprimer « ' + t.name + ' »');
    del.addEventListener('click', function () {
      if (!window.confirm('Supprimer le tube « ' + t.name + ' » ?')) return;
      tubes = tubes.filter(function (x) { return x !== t; });
      if (editingId === t.id) closeForm();
      saveTubes(); renderTubes();
    });
    // Peinture qu'on a : quand le tube est terminé, elle repart dans la liste à acquérir
    var rebuy = el('button', 'tbtn rebuy', 'À racheter'); rebuy.type = 'button';
    rebuy.hidden = !t.active;
    rebuy.title = 'Tube terminé : le mettre dans la liste à acquérir';
    rebuy.setAttribute('aria-label', '« ' + t.name + ' » est terminé : le mettre à acquérir');
    rebuy.addEventListener('click', function () { setStatus(t, 'want'); saveTubes(); renderTubes(); });
    acts.appendChild(copyButton(t)); acts.appendChild(wantBtn); acts.appendChild(rebuy); acts.appendChild(edit); acts.appendChild(del);

    li.appendChild(use); li.appendChild(chip); li.appendChild(meta); li.appendChild(acts);
    return li;
  }

  // Case du groupe : cochée si tous les tubes le sont, « partielle » si une partie seulement.
  function updateGroupStates() {
    groupUI.forEach(function (u) {
      var a = u.list.filter(function (t) { return t.active; }).length;
      u.box.checked = a > 0 && a === u.list.length;
      u.box.indeterminate = a > 0 && a < u.list.length;
      var all = u.all || u.list, aAll = all.filter(function (t) { return t.active; }).length, w = all.filter(function (t) { return t.want; }).length;
      u.cnt.textContent = aAll + ' / ' + all.length + (w ? ' · ' + w + ' à acquérir' : '');
    });
  }

  // Menus qui proposent les groupes existants : saisie du formulaire et export.
  function refreshGroupLists() {
    var dl = $('groupList');
    dl.textContent = '';
    groupNames().forEach(function (g) { var o = document.createElement('option'); o.value = g; dl.appendChild(o); });
  }

  function renderTubes() {
    tubeList.textContent = '';
    groupUI = [];
    if (tubes.length && !tubes.some(matchesFilter)) {
      tubeList.appendChild(el('p', 'muted', listQuery.length ? 'Aucune peinture ne correspond à la recherche.' : 'Aucun tube dans cette liste.'));
    } else if (!tubes.some(function (t) { return t.group; })) {
      // aucun groupe : liste simple, comme avant
      var flat = el('ul', 'glist');
      tubes.filter(matchesFilter).forEach(function (t) { flat.appendChild(tubeItem(t)); });
      tubeList.appendChild(flat);
    } else {
      groupNames().concat(tubes.some(function (t) { return !t.group; }) ? [''] : []).forEach(function (g) {
        var all = tubes.filter(function (t) { return t.group === g; });
        var list = all.filter(matchesFilter);   // ce que la liste montre, selon le filtre
        if (!list.length) return;
        var det = el('details', 'grp');
        // un grand nuancier s'ouvre fermé ; pendant une recherche, les groupes qui ont un résultat s'ouvrent
        det.open = listQuery.length ? true : openGroups.hasOwnProperty(g) ? openGroups[g] : list.length <= 40;
        det.addEventListener('toggle', function () { if (!listQuery.length) openGroups[g] = det.open; });

        var sum = el('summary');
        var lab = el('label', 'use');
        var box = document.createElement('input');
        box.type = 'checkbox';
        box.setAttribute('aria-label', 'Utiliser tous les tubes de « ' + (g || 'sans groupe') + ' »');
        lab.addEventListener('click', function (e) { e.stopPropagation(); });   // la case ne doit pas plier le groupe
        box.addEventListener('change', function () {
          list.forEach(function (t) { t.active = box.checked; if (t.active) t.want = false; });   // on les a : plus « à acquérir »
          saveTubes(); renderTubes();
        });
        lab.appendChild(box);
        var cnt = el('span', 'gcount');
        var exp = el('button', 'tbtn', 'Exporter'); exp.type = 'button';
        exp.setAttribute('aria-label', 'Exporter le nuancier « ' + (g || 'sans groupe') + ' »');
        exp.addEventListener('click', function (e) { e.stopPropagation(); e.preventDefault(); openNuancierModal('exp', g); });
        sum.appendChild(lab); sum.appendChild(el('b', 'gname', g || 'Sans groupe')); sum.appendChild(cnt); sum.appendChild(exp);

        var ul = el('ul', 'glist');
        list.forEach(function (t) { ul.appendChild(tubeItem(t)); });
        det.appendChild(sum); det.appendChild(ul);
        tubeList.appendChild(det);
        groupUI.push({ list: list, all: all, box: box, cnt: cnt });
      });
    }
    updateGroupStates();
    updateCount();
    refreshGroupLists();
  }

  /* Formulaire : sélecteur, HEX et RVB restent synchronisés */
  function showFormError(msg) { tubeErr.textContent = msg; tubeErr.hidden = !msg; }

  function setFormColor(c, except) {
    if (except !== fPick) fPick.value = toHex(c);
    if (except !== fHex) fHex.value = toHex(c);
    if (except !== fR) fR.value = c.r;
    if (except !== fG) fG.value = c.g;
    if (except !== fB) fB.value = c.b;
  }
  function formColorFromRgb() {
    var v = [fR, fG, fB].map(function (f) { return f.value === '' ? null : clampInt(f.value, 0, 255, 0); });
    if (v.indexOf(null) !== -1) return null;
    return { r: v[0], g: v[1], b: v[2] };
  }

  fPick.addEventListener('input', function () { setFormColor(parseHex(fPick.value), fPick); });
  fHex.addEventListener('input', function () {
    var c = parseHex(fHex.value);
    if (c) setFormColor(c, fHex);
  });
  fHex.addEventListener('change', function () {
    var c = parseHex(fHex.value);
    if (c) setFormColor(c); else fHex.value = fPick.value; // saisie invalide : on revient à la couleur valide
  });
  [fR, fG, fB].forEach(function (f) {
    f.addEventListener('input', function () {
      var c = formColorFromRgb();
      if (c) setFormColor(c, f);
    });
    f.addEventListener('change', function () {
      f.value = clampInt(f.value, 0, 255, 0);
      var c = formColorFromRgb();
      if (c) setFormColor(c);
    });
  });

  // quiet : ouvre le formulaire sans déplacer le focus ni la page (lecture d'une couleur sur le nuancier)
  function openForm(t, quiet) {
    editingId = t ? t.id : null;
    $('tubeFormTitle').textContent = t ? 'Modifier le tube' : 'Nouveau tube';
    $('tubeSave').textContent = t ? 'Enregistrer' : 'Ajouter le tube';
    fName.value = t ? t.name : '';
    fPig.value = t ? t.pigment : '';
    $('tubeGroup').value = t ? t.group : lastGroup;   // un nouveau tube reprend le groupe du précédent
    $('tubeLight').value = t ? t.light : '';
    $('tubeOpac').value = t ? t.opac : '';
    $('tubeEffect').value = t ? t.effect || '' : '';
    $('tubeStatus').value = t ? statusOf(t) : 'have';
    setFormColor(parseHex(t ? t.hex : '#808080'));
    showFormError('');
    tubeForm.hidden = false;
    if (quiet) return;
    tubeForm.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    fName.focus();
  }
  function closeForm() {
    editingId = null;
    tubeForm.hidden = true;
    showFormError('');
  }

  $('tubeNew').addEventListener('click', function () {
    if (tubes.length >= MAX_TUBES) { showFormError('Limite de ' + MAX_TUBES + ' tubes atteinte.'); tubeForm.hidden = false; return; }
    openForm(null);
  });
  $('tubeCancel').addEventListener('click', closeForm);

  tubeForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = fName.value.trim();
    var c = parseHex(fHex.value) || formColorFromRgb();
    if (!name) { showFormError('Indiquez le nom du tube.'); fName.focus(); return; }
    if (!c) { showFormError('La couleur n’est pas valide.'); return; }
    var pigment = fPig.value.trim().toUpperCase();
    var found = editingId && tubes.filter(function (x) { return x.id === editingId; })[0];
    var light = $('tubeLight').value, opac = $('tubeOpac').value;
    light = LIGHT.hasOwnProperty(light) ? light : ''; opac = OPAC.hasOwnProperty(opac) ? opac : '';
    var effect = Nuancier.effectOf($('tubeEffect').value);
    var group = $('tubeGroup').value.replace(/\s+/g, ' ').trim().slice(0, Nuancier.MAX.group);
    lastGroup = group;
    var st = ['have', 'want', 'cat'].indexOf($('tubeStatus').value) !== -1 ? $('tubeStatus').value : 'have';
    if (found) {
      found.name = name; found.pigment = pigment; found.hex = toHex(c); found.light = light; found.opac = opac; found.effect = effect; found.group = group;
      setStatus(found, st);
    } else {
      var nt = { id: newId(), name: name, pigment: pigment, hex: toHex(c), light: light, opac: opac, effect: effect, group: group, active: true, want: false };
      setStatus(nt, st);
      tubes.push(nt);
    }
    saveTubes(); renderTubes(); closeForm();
  });

  /* ---------- Nuanciers : un nuancier = les tubes d'un groupe (une marque), échangé en JSON ---------- */

  var nmEl = $('nuancierModal'), nmOpener = null, nmParsed = null;
  var nmTabs = { imp: $('nmTabImp'), exp: $('nmTabExp'), doc: $('nmTabDoc') };
  var nmPanels = { imp: $('nmImp'), exp: $('nmExp'), doc: $('nmDoc') };

  function nmShowTab(k) {
    Object.keys(nmTabs).forEach(function (id) {
      nmTabs[id].setAttribute('aria-selected', String(id === k));
      nmTabs[id].tabIndex = id === k ? 0 : -1;
      nmPanels[id].hidden = id !== k;
    });
  }
  Object.keys(nmTabs).forEach(function (k) { nmTabs[k].addEventListener('click', function () { nmShowTab(k); }); });

  function openNuancierModal(tab, group) {
    nmOpener = document.activeElement;
    nmFillExport(group);
    nmShowTab(tab || 'imp');
    if (!nmEl.open) nmEl.showModal();
  }
  nmEl.addEventListener('close', function () {
    if (nmOpener && nmOpener.focus && document.contains(nmOpener)) nmOpener.focus();
  });
  nmEl.addEventListener('click', function (e) { if (e.target === nmEl) nmEl.close(); });   // clic sur le fond
  $('nmClose').addEventListener('click', function () { nmEl.close(); });
  $('nmOpen').addEventListener('click', function () { openNuancierModal('imp'); });

  // Copie dans le presse-papiers ; cb(true) seulement si elle a vraiment eu lieu
  function writeClip(text, cb) {
    function fallback() {
      var ta = document.createElement('textarea'), ok = false;
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      cb(ok);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { cb(true); }, fallback); else fallback();
  }
  function copyText(text, msgEl) {
    writeClip(text, function (ok) {
      msgEl.textContent = ok ? 'Copié' : 'Copie impossible';   // on n'annonce « Copié » que si c'est vrai
      if (ok) setTimeout(function () { msgEl.textContent = ''; }, 1600);
    });
  }
  // Petit bouton « copier » à côté d'une peinture : copie son nom (et sa marque)
  var IC_COPY = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/></svg>';
  var IC_COPIED = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 13l4 4L19 7"/></svg>';
  function copyButton(t) {
    var b = el('button', 'tbtn copybtn'); b.type = 'button'; b.innerHTML = IC_COPY;
    b.title = 'Copier le nom'; b.setAttribute('aria-label', 'Copier « ' + tubeLabel(t) + ' »');
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      writeClip(tubeLabel(t), function (ok) {
        if (!ok) return;
        b.innerHTML = IC_COPIED; b.classList.add('done'); b.title = 'Copié';
        setTimeout(function () { b.innerHTML = IC_COPY; b.classList.remove('done'); b.title = 'Copier le nom'; }, 1200);
      });
    });
    return b;
  }

  /* Importer */
  function tkey(t) { return t.group.toLowerCase() + '|' + t.name.toLowerCase(); }

  // Résultat d'un import sans rien modifier : nouvelle liste de tubes et décompte. Même groupe + même nom : mise à jour
  // (le tube garde son identifiant et son état coché) ; un tube nouveau n'est coché que si on le demande.
  function computeImport(parsed, opts) {
    var old = {};
    tubes.forEach(function (t) { old[tkey(t)] = t; });
    var replaced = {};
    if (opts.replace) parsed.groups.forEach(function (g) { if (g) replaced[g] = true; });   // « sans groupe » n'est jamais remplacé
    var next = tubes.filter(function (t) { return !replaced[t.group]; }).map(function (t) { return Object.assign({}, t); });
    var at = {};
    next.forEach(function (t, i) { at[tkey(t)] = i; });
    var added = 0, updated = 0;
    parsed.tubes.forEach(function (p) {
      var k = tkey(p);
      if (at.hasOwnProperty(k)) {
        var t = next[at[k]];
        t.name = p.name; t.pigment = p.pigment; t.hex = p.hex; t.light = p.light; t.opac = p.opac; t.effect = p.effect; t.group = p.group;
        updated++;
      } else {
        var o = old[k];
        next.push({ id: o ? o.id : newId(), name: p.name, pigment: p.pigment, hex: p.hex, light: p.light, opac: p.opac, effect: p.effect, group: p.group, active: o ? o.active : opts.activate, want: o ? o.want : false });
        at[k] = next.length - 1;
        if (o) updated++; else added++;
      }
    });
    var kept = {};
    next.forEach(function (t) { kept[t.id] = true; });
    return { next: next, added: added, updated: updated, removed: tubes.filter(function (t) { return !kept[t.id]; }).length };
  }

  function nmPreview() {
    var box = $('nmPreview'), list = $('nmErrors'), go = $('nmDoImport');
    var text = $('nmPaste').value;
    nmParsed = null; go.disabled = true; list.textContent = '';
    if (!text.trim()) { box.hidden = true; go.textContent = 'Importer'; return; }
    var parsed = Nuancier.parse(text);
    box.hidden = false;
    if (parsed.fatal) { box.className = 'err'; box.textContent = parsed.fatal; go.textContent = 'Importer'; return; }
    var plan = computeImport(parsed, { activate: $('nmActivate').checked, replace: $('nmReplace').checked });
    parsed.errors.slice(0, 8).forEach(function (e) {
      list.appendChild(el('li', null, 'Entrée ' + e.index + (e.name ? ' « ' + e.name + ' »' : '') + ' : ' + e.reason));
    });
    if (parsed.errors.length > 8) list.appendChild(el('li', null, '… et ' + (parsed.errors.length - 8) + ' autres entrées refusées.'));
    if (!parsed.tubes.length) { box.className = 'err'; box.textContent = 'Aucun tube valide.'; go.textContent = 'Importer'; return; }
    if (plan.next.length > MAX_TUBES) { box.className = 'err'; box.textContent = 'Cet import dépasserait ' + MAX_TUBES + ' tubes.'; return; }
    box.className = 'notice';
    var g = parsed.groups.map(function (x) { return x || 'sans groupe'; });
    box.textContent = parsed.tubes.length + (parsed.tubes.length > 1 ? ' tubes valides' : ' tube valide') + ' · ' +
      (g.length > 1 ? 'groupes : ' : 'groupe : ') + g.join(', ') + ' · ' + plan.added + ' nouveau' + (plan.added > 1 ? 'x' : '') +
      ', ' + plan.updated + ' mis à jour' + (plan.removed ? ', ' + plan.removed + ' retiré' + (plan.removed > 1 ? 's' : '') : '') +
      (parsed.errors.length ? ' · ' + parsed.errors.length + ' refusé' + (parsed.errors.length > 1 ? 's' : '') : '');
    nmParsed = parsed;
    go.disabled = false;
    go.textContent = 'Importer ' + parsed.tubes.length + (parsed.tubes.length > 1 ? ' tubes' : ' tube');
  }
  var nmTimer = null;
  $('nmPaste').addEventListener('input', function () { clearTimeout(nmTimer); nmTimer = setTimeout(nmPreview, 150); });
  ['nmActivate', 'nmReplace'].forEach(function (id) { $(id).addEventListener('change', nmPreview); });
  // Fichier JSON choisi ou déposé : son texte va dans la zone « Ou collez le JSON », puis l'aperçu
  $('nmPick').addEventListener('click', function () { $('nmFile').click(); });
  bindDrop($('nmDrop'), nmReadFile);
  $('nmFile').addEventListener('change', function () {
    var f = this.files[0];
    this.value = '';
    nmReadFile(f);
  });
  function nmReadFile(f) {
    if (!f) return;
    $('nmFileName').textContent = f.name;
    if (f.size > 4 * 1024 * 1024) { $('nmPaste').value = ''; nmPreview(); $('nmPreview').hidden = false; $('nmPreview').className = 'err'; $('nmPreview').textContent = 'Fichier trop volumineux (4 Mo au maximum).'; return; }
    var rd = new FileReader();
    rd.onload = function () { $('nmPaste').value = String(rd.result); nmPreview(); };
    rd.onerror = function () { $('nmPreview').hidden = false; $('nmPreview').className = 'err'; $('nmPreview').textContent = 'Impossible de lire ce fichier.'; };
    rd.readAsText(f);
  }
  $('nmClear').addEventListener('click', function () { $('nmPaste').value = ''; $('nmFileName').textContent = 'ou déposez-le ici'; nmPreview(); });
  $('nmDoImport').addEventListener('click', function () {
    if (!nmParsed) return;
    var plan = computeImport(nmParsed, { activate: $('nmActivate').checked, replace: $('nmReplace').checked });
    if (plan.next.length > MAX_TUBES) return;
    tubes = plan.next;
    saveTubes(); renderTubes();
    var n = $('tubeNote');
    n.textContent = plan.added + ' tube' + (plan.added > 1 ? 's' : '') + ' ajouté' + (plan.added > 1 ? 's' : '') + ', ' + plan.updated + ' mis à jour' + (plan.removed ? ', ' + plan.removed + ' retiré' + (plan.removed > 1 ? 's' : '') : '') + '.' +
      ($('nmActivate').checked ? '' : ' Cochez ceux que vous possédez.');
    n.hidden = false;
    $('nmPaste').value = ''; nmPreview();
    nmEl.close();
  });

  /* Exporter */
  function nmFillExport(group) {
    var sel = $('nmGroup'), cur = group === undefined ? sel.value : (group === null ? '*' : group);
    sel.textContent = '';
    function opt(v, label) { var o = document.createElement('option'); o.value = v; o.textContent = label; sel.appendChild(o); }
    opt('*', 'Tous les groupes (' + tubes.length + ')');
    groupNames().forEach(function (g) { opt(g, g + ' (' + tubes.filter(function (t) { return t.group === g; }).length + ')'); });
    var none = tubes.filter(function (t) { return !t.group; }).length;
    if (none) opt('', 'Sans groupe (' + none + ')');
    sel.value = Array.prototype.some.call(sel.options, function (o) { return o.value === cur; }) ? cur : '*';
    nmExportInfo();
  }
  function nmExportData() {
    var v = $('nmGroup').value;
    var list = v === '*' ? tubes : tubes.filter(function (t) { return t.group === v; });
    return { list: list, file: Nuancier.build(list, v === '*' ? null : v), name: v === '*' ? 'tous' : (v || 'sans-groupe') };
  }
  function nmExportInfo() {
    var d = nmExportData();
    $('nmDownload').disabled = $('nmCopy').disabled = !d.list.length;
    $('nmExpInfo').textContent = d.list.length ? d.list.length + (d.list.length > 1 ? ' tubes seront exportés.' : ' tube sera exporté.') : 'Aucun tube à exporter.';
  }
  $('nmGroup').addEventListener('change', nmExportInfo);
  $('nmDownload').addEventListener('click', function () {
    var d = nmExportData();
    if (!d.list.length) return;
    var slug = d.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'nuancier';
    download(new Blob([JSON.stringify(d.file, null, 2)], { type: 'application/json' }), 'nuancier-' + slug + '.json');
  });
  $('nmCopy').addEventListener('click', function () { copyText(JSON.stringify(nmExportData().file, null, 2), $('nmCopyMsg')); });

  /* Format et prompt */
  $('nmExample').textContent = JSON.stringify(Nuancier.example(), null, 2);
  $('nmPrompt').value = Nuancier.prompt();
  $('nmCopyPrompt').addEventListener('click', function () { copyText($('nmPrompt').value, $('nmDocMsg')); });
  $('nmCopyExample').addEventListener('click', function () { copyText($('nmExample').textContent, $('nmDocMsg')); });
  $('nmModel').addEventListener('click', function () {
    download(new Blob([JSON.stringify(Nuancier.example(), null, 2)], { type: 'application/json' }), 'nuancier-modele.json');
  });

  /* ---------- Nuancier du fabricant : une image de couleurs, chargée une fois pour tous les ajouts ---------- */

  // Distincte de l'image de référence. Reste en mémoire pendant la visite (jamais enregistrée) ;
  // un clic ou un toucher lit la couleur et la met dans le formulaire du tube (ouvert au besoin).
  var chart = $('chart'), chartCtx = chart.getContext('2d');
  var chartSrc = null, chartPt = null, chartDragging = false;
  var CHART_RADIUS = 2; // moyenne d'un carré de 5 × 5 pixels : une photo ou un scan a du grain

  function chartRender() {
    if (!chartSrc) return;
    chartCtx.clearRect(0, 0, chart.width, chart.height);
    chartCtx.drawImage(chartSrc, 0, 0);
    if (chartPt) drawSightOn(chartCtx, chart, chartPt);
  }

  function chartColorAt(pt) {
    var x0 = Math.max(0, pt.x - CHART_RADIUS), y0 = Math.max(0, pt.y - CHART_RADIUS);
    var w = Math.min(chartSrc.width, pt.x + CHART_RADIUS + 1) - x0, h = Math.min(chartSrc.height, pt.y + CHART_RADIUS + 1) - y0;
    var d = chartSrc.getContext('2d').getImageData(x0, y0, w, h).data, n = w * h, r = 0, g = 0, b = 0;
    for (var i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
    return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
  }

  function chartPick(pt) {
    chartPt = pt;
    var c = chartColorAt(pt);
    $('chartSwatch').style.background = rgbCss(c);
    $('chartHex').textContent = toHex(c).toUpperCase();
    if (tubeForm.hidden) openForm(null, true);   // aucun formulaire ouvert : on en démarre un nouveau
    setFormColor(c);
    chartRender();
  }

  function chartPointFrom(e) {
    var r = chart.getBoundingClientRect();
    return {
      x: Math.min(chart.width - 1, Math.max(0, Math.floor((e.clientX - r.left) * chart.width / r.width))),
      y: Math.min(chart.height - 1, Math.max(0, Math.floor((e.clientY - r.top) * chart.height / r.height)))
    };
  }

  // src : canvas déjà dessiné (image réduite, ou page de PDF rendue)
  function setChartCanvas(src) {
    chartSrc = src;
    chartPt = null;
    chart.width = chartSrc.width; chart.height = chartSrc.height;
    chartZoomEl.style.setProperty('--ar', String(chart.width / chart.height));
    chartZoomEl.hidden = false;
    $('zoombar').hidden = false;
    chart.hidden = false;
    czReset();
    $('chartMsg').hidden = true;
    $('chartDrop').classList.add('has-image');
    $('chartPick').textContent = 'Changer de nuancier';
    $('chartWide').hidden = false;
    $('chartSwatch').style.background = '';
    $('chartHex').textContent = '—';
    chart.tabIndex = 0;
    zoneMessage(zoneMode ? (pdfDoc ? 'Entourez un tube. Un clic lit toujours la couleur.' : 'Lecture automatique : réservée aux PDF contenant du texte.') : '');
    chartRender();
  }
  function setChart(img) { closePdf(); setChartCanvas(shrinkToCanvas(img)); }

  function chartError(msg) { $('chartErr').textContent = msg; $('chartErr').hidden = !msg; }

  function clearChart() {
    closePdf();
    chartSrc = chartPt = null;
    setZoneMode(false);
    chart.hidden = true;
    chartZoomEl.hidden = true;
    $('zoombar').hidden = true;
    czReset();
    chart.tabIndex = -1;
    $('chartMsg').hidden = false;
    $('chartDrop').classList.remove('has-image');
    $('chartPick').textContent = 'Choisir le nuancier';
    $('chartWide').hidden = true;
    setChartWide(false, true);
    $('chartSwatch').style.background = '';
    $('chartHex').textContent = '—';
    chartError('');
  }

  /* Nuancier au format PDF : lu avec pdf.js (copie locale dans assets/vendor/pdfjs, licence Apache-2.0),
     chargé seulement à la première ouverture d'un PDF. Une page à la fois est dessinée, puis lue comme une image. */
  var PDF_MAX_SIDE = 2400;                 // les nuanciers ont beaucoup de petits échantillons : on dessine plus grand
  var PDF_MAX_BYTES = 60 * 1024 * 1024;
  var pdfDoc = null, pdfPage = 1, pdfToken = 0, pdfjsLoading = null;
  var pdfPageObj = null, pdfVp = null;   // page affichée et son cadrage (pour lire le texte d'une zone)

  function ensurePdfJs() {
    if (window.pdfjsLib) return Promise.resolve();
    if (!pdfjsLoading) {
      pdfjsLoading = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = '../assets/vendor/pdfjs/pdf.min.js';
        s.onload = function () {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = '../assets/vendor/pdfjs/pdf.worker.min.js';
          resolve();
        };
        s.onerror = function () { pdfjsLoading = null; reject(new Error('chargement')); };
        document.head.appendChild(s);
      });
    }
    return pdfjsLoading;
  }

  function closePdf() {
    pdfToken++;
    if (pdfDoc) { try { pdfDoc.destroy(); } catch (_) { /* sans importance */ } }
    pdfDoc = null; pdfPageObj = pdfVp = null;
    $('chartPager').hidden = true;
  }

  function updatePager() {
    var n = pdfDoc ? pdfDoc.numPages : 0;
    $('chartPager').hidden = n < 2;
    $('pgInfo').textContent = pdfPage + ' / ' + n;
    $('pgPrev').disabled = pdfPage <= 1;
    $('pgNext').disabled = pdfPage >= n;
  }

  // Dessine la page courante dans un canvas blanc (les fonds transparents d'un PDF seraient noirs une fois lus) puis l'affiche.
  function renderPdfPage() {
    var token = ++pdfToken, doc = pdfDoc;
    return doc.getPage(pdfPage).then(function (page) {
      var base = page.getViewport({ scale: 1 });
      var vp = page.getViewport({ scale: Math.min(4, PDF_MAX_SIDE / Math.max(base.width, base.height)) });
      pdfPageObj = page; pdfVp = vp;
      var c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(vp.width)); c.height = Math.max(1, Math.round(vp.height));
      var x = c.getContext('2d', { willReadFrequently: true });
      x.fillStyle = '#fff';
      x.fillRect(0, 0, c.width, c.height);
      return page.render({ canvasContext: x, viewport: vp }).promise.then(function () {
        if (token !== pdfToken) return;      // un autre PDF ou une autre page a été demandé entre-temps
        setChartCanvas(c);
        updatePager();
      });
    });
  }

  function loadPdf(f) {
    if (f.size > PDF_MAX_BYTES) { chartError('PDF trop volumineux (60 Mo au maximum).'); return; }
    $('chartHex').textContent = 'Lecture du PDF…';
    var fresh;
    ensurePdfJs().then(function () {
      return f.arrayBuffer();
    }).then(function (buf) {
      return window.pdfjsLib.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise;
    }).then(function (doc) {
      closePdf();
      pdfDoc = doc; pdfPage = 1; fresh = true;
      return renderPdfPage();
    }).catch(function (e) {
      $('chartHex').textContent = chartSrc ? $('chartHex').textContent : '—';
      if (fresh) closePdf();
      var name = e && e.name;
      chartError(name === 'PasswordException' ? 'Ce PDF est protégé par un mot de passe.'
        : name === 'InvalidPDFException' ? 'Ce fichier n’est pas un PDF valide.'
        : e && e.message === 'chargement' ? 'Lecteur de PDF introuvable.'
        : 'Impossible de lire ce PDF.');
    }).then(function () {
      if ($('chartHex').textContent === 'Lecture du PDF…') $('chartHex').textContent = '—';
    });
  }

  function pdfGo(delta) {
    if (!pdfDoc) return;
    var p = Math.min(pdfDoc.numPages, Math.max(1, pdfPage + delta));
    if (p === pdfPage) return;
    pdfPage = p;
    updatePager();
    renderPdfPage().catch(function () { chartError('Impossible de lire cette page.'); });
  }
  $('pgPrev').addEventListener('click', function () { pdfGo(-1); });
  $('pgNext').addEventListener('click', function () { pdfGo(1); });

  // Nuancier agrandi : pleine largeur au-dessus de la liste des tubes
  function setChartWide(on, instant) {
    $('chartWide').setAttribute('aria-pressed', String(on));
    morph(function () { document.querySelector('.couleurs').classList.toggle('wide', on); }, instant);
  }
  $('chartWide').addEventListener('click', function () { setChartWide($('chartWide').getAttribute('aria-pressed') !== 'true'); });

  function loadChart(f) {
    chartError('');
    if (!f) return;
    if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) { loadPdf(f); return; }
    if (!/^image\//.test(f.type)) { chartError('Ce fichier n’est ni une image ni un PDF.'); return; }
    loadImageFile(f, setChart, chartError);
  }

  $('chartPick').addEventListener('click', function () { $('chartFile').click(); });
  $('chartDrop').addEventListener('click', function () { if (!chartSrc) $('chartFile').click(); });
  drop.addEventListener('click', function () { if (!source) file.click(); });
  $('chartFile').addEventListener('change', function () { loadChart(this.files[0]); this.value = ''; });
  bindDrop($('chartDrop'), loadChart);

  /* Zone de lecture : on entoure l'entrée d'UN tube dans le nuancier PDF ; le texte de la zone (nom, code pigment, durabilité,
     transparence / opacité) est lu dans le PDF lui-même, sans reconnaissance de caractères, et rempli dans le formulaire du
     tube en cours d'ajout. Rien d'autre n'est créé ni modifié ; la couleur se lit toujours d'un clic sur l'échantillon. */
  var zoneMode = false;

  function zoneMessage(msg) {
    var el2 = $('zoneInfo');
    el2.textContent = msg;
    el2.hidden = !msg;
  }
  function setZoneMode(on) {
    zoneMode = on;
    $('chartZone').setAttribute('aria-pressed', String(on));
    chartZoomEl.classList.toggle('zoning', on);
    $('zoneBox').hidden = true;
    zoneMessage(on ? (pdfDoc ? 'Entourez un tube. Un clic lit toujours la couleur.' : 'Lecture automatique : réservée aux PDF contenant du texte.') : '');
  }
  $('chartZone').addEventListener('click', function () { setZoneMode(!zoneMode); });

  function drawZone(p, e) {
    var r = chartZoomEl.getBoundingClientRect(), b = $('zoneBox');
    var x0 = Math.max(r.left, Math.min(p.sx, e.clientX)), x1 = Math.min(r.right, Math.max(p.sx, e.clientX));
    var y0 = Math.max(r.top, Math.min(p.sy, e.clientY)), y1 = Math.min(r.bottom, Math.max(p.sy, e.clientY));
    b.style.left = (x0 - r.left) + 'px'; b.style.top = (y0 - r.top) + 'px';
    b.style.width = (x1 - x0) + 'px'; b.style.height = (y1 - y0) + 'px';
    b.hidden = false;
  }

  function finishZone(p, e) {
    var a = chartPointFrom({ clientX: p.sx, clientY: p.sy }), b = chartPointFrom(e);
    var z = { x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), y0: Math.min(a.y, b.y), y1: Math.max(a.y, b.y) };
    if (z.x1 - z.x0 < 6 || z.y1 - z.y0 < 6) { $('zoneBox').hidden = true; return; }
    readZone(z);
  }

  // Texte du PDF dont le centre tombe dans la zone (coordonnées du canvas), regroupé par lignes de haut en bas.
  function readZone(z) {
    if (!pdfDoc || !pdfPageObj || !pdfVp) {
      zoneMessage('Cette image n’a pas de texte que l’outil sache lire : la lecture automatique ne fonctionne que sur un PDF contenant du texte.');
      return;
    }
    if (!window.LectureTube) { zoneMessage('Lecteur de texte introuvable.'); return; }
    var token = pdfToken, pageNo = pdfPage, page = pdfPageObj, vp = pdfVp;
    page.getTextContent().then(function (tc) {
      if (token !== pdfToken || pageNo !== pdfPage) return;   // un autre PDF ou une autre page a été ouvert entre-temps
      var items = [];
      tc.items.forEach(function (it) {
        if (!it.str || !it.str.trim()) return;
        var m = window.pdfjsLib.Util.transform(vp.transform, it.transform);
        var h = Math.hypot(m[2], m[3]) || 10, w = (it.width || 0) * vp.scale;
        var cx = m[4] + w / 2, cy = m[5] - h / 2;
        if (cx >= z.x0 && cx <= z.x1 && cy >= z.y0 && cy <= z.y1) items.push({ s: it.str, x: m[4], y: cy, h: h });
      });
      items.sort(function (a, b) { return a.y - b.y || a.x - b.x; });
      var lines = [], cur = null;
      items.forEach(function (it) {
        if (cur && Math.abs(it.y - cur.y) <= it.h * 0.6) cur.parts.push(it);
        else { cur = { y: it.y, parts: [it] }; lines.push(cur); }
      });
      var text = lines.map(function (l) {
        return l.parts.sort(function (a, b) { return a.x - b.x; }).map(function (p) { return p.s; }).join(' ');
      });
      applyTubeText(window.LectureTube.parseTubeText(text), text.length);
    }).catch(function () { zoneMessage('Impossible de lire le texte de cette zone.'); });
  }

  // Remplit le formulaire du tube en cours d'ajout, avec ce qui a été reconnu seulement.
  function applyTubeText(res, nbLines) {
    if (!(res.name || res.pigment || res.light || res.opac)) {
      zoneMessage(nbLines ? 'Aucun nom de tube ni code reconnu dans cette zone.' : 'Aucun texte dans cette zone.');
      return;
    }
    if (tubeForm.hidden) openForm(null, true);    // pas de formulaire ouvert : un nouveau tube démarre
    if (res.name) fName.value = res.name;
    if (res.pigment) fPig.value = res.pigment;
    if (res.light) $('tubeLight').value = res.light;
    if (res.opac) $('tubeOpac').value = res.opac;
    zoneMessage('Lu : ' + [res.name, res.pigment, res.light ? LIGHT[res.light][0] : '', res.opac ? OPAC[res.opac] : ''].filter(Boolean).join(' · '));
  }

  /* Zoom et déplacement du nuancier : le canvas garde sa résolution, un cadre le recadre (transformation CSS, sans redessin). */
  var chartZoomEl = $('chartZoom');
  var cz = 1, ctx0 = 0, cty = 0;     // zoom (1 = image entière) et décalage, en pixels de l'écran
  var CZ_MAX = 8;

  function czView() { return { w: chartZoomEl.clientWidth, h: chartZoomEl.clientHeight }; }

  function czApply() {
    var v = czView();
    cz = Math.min(CZ_MAX, Math.max(1, cz));
    ctx0 = Math.min(0, Math.max(v.w - v.w * cz, ctx0));   // l'image ne quitte jamais le cadre
    cty = Math.min(0, Math.max(v.h - v.h * cz, cty));
    chart.style.transform = cz === 1 ? '' : 'translate(' + ctx0 + 'px,' + cty + 'px) scale(' + cz + ')';
    chart.zoom = cz;
    // Au-delà de la résolution de l'image, on montre les vrais pixels plutôt qu'un flou
    chart.style.imageRendering = cz * chart.offsetWidth / Math.max(1, chart.width) > 2 ? 'pixelated' : '';
    $('zoomLevel').textContent = '×' + String(Math.round(cz * 10) / 10).replace('.', ',');
    $('zoomOut').disabled = cz <= 1;
    $('zoomIn').disabled = cz >= CZ_MAX;
    chartZoomEl.classList.toggle('zoomed', cz > 1);
    $('zoneBox').hidden = true;   // le rectangle ne suit pas le zoom : on le retire
    chartRender();
  }
  function czReset() { cz = 1; ctx0 = cty = 0; czApply(); }
  // Change le zoom en gardant fixe le point (fx, fy) du cadre
  function czZoomAt(z, fx, fy) {
    z = Math.min(CZ_MAX, Math.max(1, z));
    var k = z / cz;
    ctx0 = fx - (fx - ctx0) * k; cty = fy - (fy - cty) * k; cz = z;
    czApply();
  }
  function czZoomCenter(factor) { var v = czView(); czZoomAt(cz * factor, v.w / 2, v.h / 2); }
  // Ramène dans le cadre le point pt de l'image (déplacement au clavier)
  function czReveal(pt) {
    var v = czView(), m = 24;
    var sx = pt.x / chart.width * v.w * cz + ctx0, sy = pt.y / chart.height * v.h * cz + cty;
    if (sx < m) ctx0 += m - sx; else if (sx > v.w - m) ctx0 -= sx - (v.w - m);
    if (sy < m) cty += m - sy; else if (sy > v.h - m) cty -= sy - (v.h - m);
    czApply();
  }

  $('zoomIn').addEventListener('click', function () { czZoomCenter(1.5); });
  $('zoomOut').addEventListener('click', function () { czZoomCenter(1 / 1.5); });
  $('zoomLevel').addEventListener('click', czReset);

  // Molette : Ctrl (ou le pincement d'un pavé tactile) zoome autour du curseur ; zoomé, la molette seule déplace l'image ;
  // à l'échelle 1, elle fait défiler la page comme d'habitude.
  chartZoomEl.addEventListener('wheel', function (e) {
    if (!chartSrc) return;
    var r = chartZoomEl.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      czZoomAt(cz * Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top);
    } else if (cz > 1) {
      e.preventDefault();
      ctx0 -= e.shiftKey ? e.deltaY : e.deltaX; cty -= e.shiftKey ? 0 : e.deltaY;
      czApply();
    }
  }, { passive: false });

  // Pointeurs : un clic sans mouvement lit la couleur ; un glissement déplace l'image zoomée ; deux doigts zooment.
  var cPtr = {}, cPinch = null;
  function pinchStart() {
    var ids = Object.keys(cPtr), a = cPtr[ids[0]], b = cPtr[ids[1]], r = chartZoomEl.getBoundingClientRect();
    var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    return { d: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), z: cz, ux: (mx - r.left - ctx0) / cz, uy: (my - r.top - cty) / cz };
  }
  chart.addEventListener('pointerdown', function (e) {
    if (!chartSrc || (e.pointerType === 'mouse' && e.button !== 0) || Object.keys(cPtr).length >= 2) return;
    try { chart.setPointerCapture(e.pointerId); } catch (_) { /* sans importance */ }
    cPtr[e.pointerId] = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false, zone: zoneMode };
    if (Object.keys(cPtr).length === 2) {
      Object.keys(cPtr).forEach(function (id) { cPtr[id].moved = true; cPtr[id].zone = false; });   // deux doigts : ce n'est plus un clic
      cPinch = pinchStart();
    }
  });
  chart.addEventListener('pointermove', function (e) {
    var p = cPtr[e.pointerId];
    if (!p) return;
    var dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (cPinch && Object.keys(cPtr).length === 2) {
      var ids = Object.keys(cPtr), a = cPtr[ids[0]], b = cPtr[ids[1]], r = chartZoomEl.getBoundingClientRect();
      var z = Math.min(CZ_MAX, Math.max(1, cPinch.z * Math.hypot(a.x - b.x, a.y - b.y) / cPinch.d));
      cz = z;   // le point de l'image qui était entre les doigts le reste, même quand les doigts se déplacent
      ctx0 = (a.x + b.x) / 2 - r.left - cPinch.ux * z; cty = (a.y + b.y) / 2 - r.top - cPinch.uy * z;
      czApply();
      return;
    }
    if (!p.moved && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) < 5) return;   // petit tremblement : toujours un clic
    p.moved = true;
    if (p.zone) drawZone(p, e);
    else if (cz > 1) { ctx0 += dx; cty += dy; czApply(); }
  });
  function endPointer(e, cancelled) {
    var p = cPtr[e.pointerId];
    if (!p) return;
    delete cPtr[e.pointerId];
    if (Object.keys(cPtr).length < 2) cPinch = null;
    if (p.zone && p.moved && !cancelled) finishZone(p, e);
    else if (!p.moved && !cancelled && chartSrc) chartPick(chartPointFrom(e));
  }
  chart.addEventListener('pointerup', function (e) { endPointer(e, false); });
  chart.addEventListener('pointercancel', function (e) { endPointer(e, true); });

  // Clavier : flèches = déplacer le viseur (Maj : dix pixels) ; + et − zooment ; 0 ajuste.
  chart.addEventListener('keydown', function (e) {
    if (!chartSrc) return;
    if (e.key === '+' || e.key === '=') { e.preventDefault(); czZoomCenter(1.5); return; }
    if (e.key === '-' || e.key === '_') { e.preventDefault(); czZoomCenter(1 / 1.5); return; }
    if (e.key === '0') { e.preventDefault(); czReset(); return; }
    var d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!d) return;
    e.preventDefault();
    var k = e.shiftKey ? 10 : 1, from = chartPt || { x: Math.floor(chart.width / 2), y: Math.floor(chart.height / 2) };
    chartPick({ x: Math.min(chart.width - 1, Math.max(0, from.x + d[0] * k)), y: Math.min(chart.height - 1, Math.max(0, from.y + d[1] * k)) });
    czReveal(chartPt);
  });
  // Si le cadre change de taille (agrandir, rotation), on recadre et on redessine
  if (window.ResizeObserver) new ResizeObserver(afterFrame(czApply)).observe(chartZoomEl);

  /* ---------- Recette : solveur ---------- */

  var Moteur = window.MelangeMoteur;
  var recipeTimer = null;

  // Qualité de la recette selon l'écart ΔE2000 (≈ 1 : à peine visible ; 2 à 5 : visible de près ; > 10 : couleur différente)
  function quality(de) {
    if (de < 1) return ['Excellent', 'good'];
    if (de < 2.5) return ['Très bon', 'good'];
    if (de < 5) return ['Bon', ''];
    if (de < 10) return ['Approximatif', ''];
    return ['Éloigné', 'bad'];
  }

  function showRecipeMessage(msg, withCouleurs) {
    lastRecipe = null; solved = adj = null; adjOpen = false; updateEditBtn(); updateSuggest(); updateNext();
    $('recipe').hidden = true;
    $('recipeEmptyBox').hidden = false;
    $('recipeEmpty').textContent = msg;
    $('goCouleurs').hidden = !withCouleurs;
  }

  function scheduleRecipe() {
    clearTimeout(recipeTimer);
    recipeTimer = setTimeout(computeRecipe, 90); // laisse la main au glissement du doigt sur l'image
  }

  function computeRecipe() {
    if (!Moteur) return;
    if (!target) { showRecipeMessage('Fixez une couleur.', false); return; }
    var active = tubes.filter(function (t) { return t.active && !excludedTube(t); });
    if (!active.length) {
      var some = tubes.filter(function (t) { return t.active; });   // des tubes cochés, mais tous écartés ?
      var hasB = some.some(blackExcluded), hasE = some.some(effectExcluded);
      showRecipeMessage(some.length ? (hasB && hasE ? 'Ni noirs ni effets (métallisés, irisés, fluorescents) : cochez des couleurs.' : hasB ? 'Pas de tubes noirs : cochez des couleurs.' : 'Pas de métallisés, irisés ni fluorescents : cochez des couleurs.') : tubes.length ? 'Activez des tubes.' : 'Ajoutez des tubes.', true);
      return;
    }
    var res = Moteur.solve(target, active.map(function (t) { return { id: t.id, rgb: parseHex(t.hex) }; }));
    solved = { res: res, active: active }; adj = null;   // nouvelle couleur ou nouveaux tubes : on repart de la recette calculée
    renderRecipe(res, active);
  }

  /* ---------- Liste déroulante avec recherche : défilante, filtrée au fil de la frappe, utilisable au clavier ---------- */

  var COMBO_MAX = 150;   // lignes affichées au plus (la recherche affine le reste)
  var comboOpen = null;  // liste actuellement ouverte : { close }
  function normText(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  var CARET = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

  // o : { options: [{ id, label, name, sub, hex, key }], value, placeholder, label, fk, onPick(id) } → bouton qui ouvre la liste
  function makeCombo(o) {
    var cur = null;
    o.options.forEach(function (x) { if (x.id === o.value) cur = x; });
    var btn = el('button', 'combo-btn'); btn.type = 'button';
    btn.setAttribute('aria-haspopup', 'listbox'); btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-label', o.label);
    if (o.fk) btn.dataset.fk = o.fk;
    if (cur) { var c0 = el('span', 'chip sm'); c0.style.background = cur.hex; btn.appendChild(c0); }
    btn.appendChild(el('span', 'combo-txt', cur ? cur.label : o.placeholder));
    var caret = el('span', 'combo-caret'); caret.innerHTML = CARET; btn.appendChild(caret);

    var pop = null, input, list, shown = [], act = 0, uid = 'cb' + Math.random().toString(36).slice(2, 8);

    function place() {
      var r = btn.getBoundingClientRect(), vh = window.innerHeight, vw = window.innerWidth;
      var w = Math.min(Math.max(r.width, 260), vw - 16), left = Math.min(Math.max(8, r.left), vw - w - 8);
      var below = vh - r.bottom - 8, above = r.top - 8, up = below < 220 && above > below;
      pop.style.width = w + 'px'; pop.style.left = left + 'px';
      list.style.maxHeight = Math.max(120, Math.min(300, (up ? above : below) - 64)) + 'px';
      if (up) { pop.style.top = 'auto'; pop.style.bottom = (vh - r.top + 4) + 'px'; }
      else { pop.style.bottom = 'auto'; pop.style.top = (r.bottom + 4) + 'px'; }
    }
    function setAct(k, scroll) {
      var items = list.querySelectorAll('[role="option"]');
      if (!items.length) { input.removeAttribute('aria-activedescendant'); return; }
      act = Math.max(0, Math.min(items.length - 1, k));
      Array.prototype.forEach.call(items, function (li, q) { li.classList.toggle('on', q === act); });
      input.setAttribute('aria-activedescendant', items[act].id);
      if (scroll) items[act].scrollIntoView({ block: 'nearest' });
    }
    function pick(x) { close(true); if (x.id !== o.value) o.onPick(x.id); }
    function render(first) {
      var words = normText(input.value).split(/\s+/).filter(Boolean);
      shown = o.options.filter(function (x) { return words.every(function (w) { return x.key.indexOf(w) !== -1; }); });
      list.textContent = '';
      shown.slice(0, COMBO_MAX).forEach(function (x, k) {
        var li = el('li', 'combo-opt'); li.id = uid + '-' + k; li.setAttribute('role', 'option'); li.dataset.id = x.id;
        li.setAttribute('aria-selected', String(x.id === o.value));
        var ch = el('span', 'chip sm'); ch.style.background = x.hex;
        li.appendChild(ch); li.appendChild(el('span', 'combo-name', x.name));
        if (x.sub) li.appendChild(el('span', 'combo-sub', x.sub));
        if (x.id === o.value) li.appendChild(el('span', 'combo-check', '✓'));
        li.addEventListener('mousedown', function (e) { e.preventDefault(); });   // garde le focus dans le champ de recherche
        li.addEventListener('click', function () { pick(x); });
        li.addEventListener('mousemove', function () { if (act !== k) setAct(k, false); });
        list.appendChild(li);
      });
      if (!shown.length) list.appendChild(el('li', 'combo-empty', 'Aucune peinture'));
      else if (shown.length > COMBO_MAX) list.appendChild(el('li', 'combo-empty', 'Affinez la recherche (' + shown.length + ' résultats)'));
      var sel = first ? shown.slice(0, COMBO_MAX).map(function (x) { return x.id; }).indexOf(o.value) : -1;
      setAct(sel < 0 ? 0 : sel, true);
    }
    function onOutside(e) { if (pop && !pop.contains(e.target) && !btn.contains(e.target)) close(false); }
    function onMove(e) { if (pop && !(e.target && e.target.nodeType === 1 && pop.contains(e.target))) place(); }
    function close(focusBtn) {
      if (!pop) return;
      document.removeEventListener('pointerdown', onOutside, true);
      window.removeEventListener('resize', onMove);
      document.removeEventListener('scroll', onMove, true);
      pop.remove(); pop = null; comboOpen = null;
      btn.setAttribute('aria-expanded', 'false');
      if (focusBtn && document.contains(btn)) btn.focus();
    }
    function open() {
      if (comboOpen) comboOpen.close(false);
      pop = el('div', 'combo-pop');
      input = document.createElement('input');
      input.type = 'search'; input.className = 'combo-search'; input.placeholder = 'Rechercher…'; input.autocomplete = 'off'; input.spellcheck = false;
      input.setAttribute('role', 'combobox'); input.setAttribute('aria-expanded', 'true'); input.setAttribute('aria-controls', uid + '-list');
      input.setAttribute('aria-label', 'Rechercher une peinture');
      list = el('ul', 'combo-list'); list.id = uid + '-list'; list.setAttribute('role', 'listbox'); list.setAttribute('aria-label', o.label);
      pop.appendChild(input); pop.appendChild(list);
      document.body.appendChild(pop);
      btn.setAttribute('aria-expanded', 'true');
      comboOpen = { close: close };
      input.addEventListener('input', function () { render(false); });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown') { e.preventDefault(); setAct(act + 1, true); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setAct(act - 1, true); }
        else if (e.key === 'Enter') { e.preventDefault(); var x = shown[act]; if (x) pick(x); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
        else if (e.key === 'Tab') close(false);
      });
      render(true); place();
      document.addEventListener('pointerdown', onOutside, true);
      window.addEventListener('resize', onMove);
      document.addEventListener('scroll', onMove, true);
      input.focus();
    }
    btn.addEventListener('click', function () { if (pop) close(true); else open(); });
    btn.addEventListener('keydown', function (e) { if (e.key === 'ArrowDown' && !pop) { e.preventDefault(); open(); } });
    return btn;
  }
  // Tri colorimétrique, pour cette liste seulement : d'abord les neutres du plus clair au plus sombre, puis les teintes dans l'ordre
  // de l'arc-en-ciel (rouge, orange, jaune, vert, cyan, bleu, violet, magenta), de la plus claire à la plus sombre à teinte voisine.
  var HUE_STEP = 14;    // degrés : des teintes voisines sont rangées par clarté
  var NEUTRAL_C = 9;    // chroma L*C*h en dessous duquel une couleur est considérée neutre
  function sortPaints(list) {
    var info = list.map(function (o) {
      var lab = window.MelangeMoteur ? window.MelangeMoteur.rgbToLab(parseHex(o.hex)) : [50, 0, 0];
      var c = Math.sqrt(lab[1] * lab[1] + lab[2] * lab[2]), h = (Math.atan2(lab[2], lab[1]) * 180 / Math.PI + 360) % 360;
      return { o: o, L: lab[0], neutral: c < NEUTRAL_C, bucket: Math.floor(h / HUE_STEP) };
    });
    info.sort(function (a, b) {
      if (a.neutral !== b.neutral) return a.neutral ? -1 : 1;
      if (!a.neutral && a.bucket !== b.bucket) return a.bucket - b.bucket;
      return (b.L - a.L) || a.o.name.localeCompare(b.o.name, 'fr');
    });
    return info.map(function (x) { return x.o; });
  }
  function paintOption(t) { return { id: t.id, label: tubeLabel(t), name: t.name, sub: t.group, hex: t.hex, key: normText(t.name + ' ' + t.group + ' ' + t.pigment) }; }

  /* ---------- Modifier la composition : une autre composition, ou la liste éditable (peinture et parts) ---------- */

  var solved = null;     // dernière recette calculée : { res, active }
  var adj = null;        // composition modifiée : { rows: [{ id, parts }], variant: numéro de la composition choisie ou null (à la main), exact } ; null = celle du calcul
  var adjOpen = false;   // la liste de la recette est en cours de modification
  var adjFocus = null;   // contrôle à re-focaliser après l'affichage (la liste est reconstruite à chaque changement)
  var adjBtn = $('adjBtn'), adjPanel = $('adjPanel');
  var IC_EDIT = adjBtn.querySelector('svg').outerHTML;
  var IC_DONE = '<svg class="ic" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 13l4 4L19 7"/></svg>';

  function gcdN(a, b) { return b ? gcdN(b, a % b) : a; }
  function activeById(id) { var a = solved ? solved.active : []; for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i]; return null; }
  function rowsFromRes(res) {
    var p = res.parts || res.items.map(function (it) { return Math.max(1, Math.round(it.weight * 10)); });
    return res.items.map(function (it, i) { return { id: it.id, parts: p[i] }; });
  }
  function adjRowsNow() { return adj ? adj.rows : rowsFromRes(solved.res); }
  function touchAdj(a) { a.variant = null; a.exact = null; }   // modifiée à la main : plus une composition du calcul
  function ensureAdj() { if (!adj) adj = { rows: rowsFromRes(solved.res), variant: 0 }; return adj; }

  // Affiche la composition (même calcul que le solveur : Moteur.evaluate) ; le Conseil suit la recette affichée.
  function showAdj() {
    if (!solved) return;
    if (adj && adj.exact) { renderRecipe(adj.exact, solved.active); return; }   // composition choisie : le résultat exact du calcul
    var rows = adj ? adj.rows.filter(function (r) { return activeById(r.id); }) : [];
    if (!adj || !rows.length) { adj = null; renderRecipe(solved.res, solved.active); return; }
    var tot = rows.reduce(function (s, r) { return s + r.parts; }, 0), g = rows.reduce(function (a, r) { return gcdN(a, r.parts); }, 0);
    var ev = Moteur.evaluate(target, rows.map(function (r) { return { rgb: parseHex(activeById(r.id).hex) }; }), rows.map(function (r) { return r.parts; }));
    var res = {
      items: rows.map(function (r) { return { index: solved.active.indexOf(activeById(r.id)), id: r.id, weight: r.parts / tot }; }),
      mixRgb: ev.mixRgb, de: ev.de, parts: rows.map(function (r) { return r.parts / g; })
    };
    renderRecipe(res, solved.active);
  }

  function altsNow() { return solved ? (solved.res.alternatives || []) : []; }
  function curVariant() { return adj && adj.variant != null ? adj.variant : 0; }   // à la main : on repart de la première

  function pickVariant(k) {
    var a = altsNow()[k];
    adj = !a || k === 0 ? null : { rows: rowsFromRes(a), variant: k, exact: a };
    showAdj();
  }

  // « Proposer une autre composition » : éteint s'il n'y en a pas d'autre avec les peintures cochées, actif sinon ; chaque clic passe à la suivante
  function updateNext() {
    var n = altsNow().length, b = $('adjNext'), manual = !!adj && adj.variant == null;
    b.disabled = n < 2;
    b.title = n < 2 ? 'Aucune autre composition avec vos peintures cochées' : 'Composition ' + (curVariant() + 1) + ' sur ' + n + ' : cliquer pour la suivante';
    $('adjCount').textContent = manual ? 'Modifiée · ' : n > 1 ? (curVariant() + 1) + ' sur ' + n + ' · ' : '';
  }
  $('adjNext').addEventListener('click', function () { var n = altsNow().length; if (n > 1) pickVariant((curVariant() + 1) % n); });

  // Le bouton change avec l'état : « Modifier la composition » (fermé) / « Terminer » (ouvert)
  function updateEditBtn() {
    adjBtn.setAttribute('aria-expanded', String(adjOpen));
    adjBtn.innerHTML = (adjOpen ? IC_DONE : IC_EDIT) + '<span>' + (adjOpen ? 'Terminer' : 'Modifier la composition') + '</span>';
    adjBtn.title = adjOpen ? 'Terminer la modification' : 'Changer les peintures et les parts à la main';
  }
  adjBtn.addEventListener('click', function () { adjOpen = !adjOpen; updateEditBtn(); showAdj(); });

  // Pied de la liste en modification : ajouter une peinture, rétablir
  function renderAdjFoot() {
    adjPanel.hidden = !adjOpen || !solved;
    if (adjPanel.hidden) return;
    var rows = adjRowsNow(), box = $('adjAddBox');
    var rest = solved.active.filter(function (t) { return !rows.some(function (r) { return r.id === t.id; }); });
    box.textContent = '';
    box.hidden = !rest.length || rows.length >= 6;   // 6 peintures au plus
    if (!box.hidden) {
      box.appendChild(makeCombo({
        options: sortPaints(rest.map(paintOption)), value: null, placeholder: 'Ajouter une peinture…', label: 'Ajouter une peinture à la composition',
        onPick: function (id) { edit(function (a) { a.rows.push({ id: id, parts: 1 }); }, 'num:' + rows.length); }
      }));
    }
    $('adjReset').disabled = !adj;
  }
  function edit(fn, fk) { var a = ensureAdj(); fn(a); touchAdj(a); adjFocus = fk || null; showAdj(); }
  $('adjReset').addEventListener('click', function () { adj = null; adjFocus = 'next'; showAdj(); });

  // Une ligne de la recette en modification : peinture (liste), parts (− / saisie / +), retrait
  function editRow(it, i, res, active) {
    var rows = adjRowsNow(), r = rows[i], t = active[it.index];
    var li = el('li', 'mixitem editing');
    var chip = el('span', 'chip'); chip.style.background = t.hex;
    var head = el('span', 'medit-head'), ctrl = el('span', 'medit-ctrl');

    var sel = makeCombo({
      options: sortPaints(active.filter(function (u) { return u.id === r.id || !rows.some(function (q) { return q.id === u.id; }); }).map(paintOption)),
      value: r.id, placeholder: '', label: 'Peinture de la ligne ' + (i + 1), fk: 'sel:' + i,
      onPick: function (id) { edit(function (a) { a.rows[i].id = id; }, 'sel:' + i); }
    });
    sel.classList.add('mselect');
    var del = el('button', 'tbtn', '✕'); del.type = 'button'; del.dataset.fk = 'del:' + i;
    del.setAttribute('aria-label', 'Retirer « ' + t.name + ' » de la composition');
    del.disabled = rows.length < 2;
    del.addEventListener('click', function () { edit(function (a) { a.rows.splice(i, 1); }, 'sel:' + Math.max(0, Math.min(i, rows.length - 2))); });
    head.appendChild(sel); head.appendChild(del);

    var minus = el('button', 'tbtn pstep', '−'), plus = el('button', 'tbtn pstep', '+'), num = document.createElement('input');
    minus.type = plus.type = 'button'; minus.dataset.fk = 'minus:' + i; plus.dataset.fk = 'plus:' + i;
    minus.setAttribute('aria-label', 'Moins de parts'); plus.setAttribute('aria-label', 'Plus de parts');
    num.type = 'number'; num.min = '1'; num.max = '99'; num.step = '1'; num.value = String(r.parts); num.className = 'pnum'; num.dataset.fk = 'num:' + i;
    num.setAttribute('aria-label', 'Parts de ' + t.name); num.setAttribute('inputmode', 'numeric');
    function setParts(v, fk) { edit(function (a) { a.rows[i].parts = clampInt(v, 1, 99, a.rows[i].parts); }, fk); }
    minus.addEventListener('click', function () { setParts(r.parts - 1, 'minus:' + i); });
    plus.addEventListener('click', function () { setParts(r.parts + 1, 'plus:' + i); });
    num.addEventListener('change', function () { setParts(num.value, 'num:' + i); });
    var bar = el('span', 'bar2'), fill = document.createElement('i');
    fill.style.width = Math.round(it.weight * 100) + '%'; bar.appendChild(fill);
    ctrl.appendChild(minus); ctrl.appendChild(num); ctrl.appendChild(plus);
    ctrl.appendChild(el('span', 'ulabel', r.parts > 1 ? 'parts' : 'part'));
    ctrl.appendChild(bar); ctrl.appendChild(el('span', 'pc', Math.round(it.weight * 100) + ' %'));

    li.appendChild(chip); li.appendChild(head); li.appendChild(ctrl);
    return li;
  }

  // Durabilité du mélange, à titre d'information : celle du tube le moins durable parmi ceux qui en ont une.
  // Un tube sans indication n'est pas compté (étoile *). La transparence / opacité n'est pas combinée : elle reste
  // affichée tube par tube, car la moyenner serait un calcul de plus, non vérifié.
  function renderMixTags(res, active) {
    var box = $('rTags'), rated, partial, tag;
    box.textContent = '';
    var used = res.items.map(function (it) { return { t: active[it.index], w: it.weight }; });

    rated = used.filter(function (u) { return u.t.light; });
    if (rated.length) {
      partial = rated.length < used.length;
      var worst = rated.reduce(function (m, u) { return LIGHT_RANK[u.t.light] > LIGHT_RANK[m] ? u.t.light : m; }, rated[0].t.light);
      tag = el('span', 'tag', 'Durabilité ' + LIGHT[worst][0] + (partial ? ' *' : ''));
      tag.title = 'Celle du tube le moins durable du mélange (' + LIGHT[worst][1] + ')' + (partial ? ' ; * certains tubes n’ont pas d’indication' : '');
      box.appendChild(tag);
    }

    box.hidden = !box.childNodes.length;
  }

  function renderRecipe(res, active) {
    lastRecipe = { res: res, active: active }; updateSuggest(); updateNext();
    $('recipeEmptyBox').hidden = true;
    $('recipe').hidden = false;
    $('rTarget').style.background = rgbCss(target);
    $('rMix').style.background = rgbCss(res.mixRgb);

    var q = quality(res.de);
    $('rDe').className = 'de ' + q[1];
    $('rDeVal').textContent = 'ΔE ' + res.de.toFixed(1).replace('.', ',');
    $('rDeLab').textContent = q[0];
    $('rDeFill').style.width = Math.max(4, Math.round((1 - Math.min(res.de, 20) / 20) * 100)) + '%';

    renderMixTags(res, active);

    var list = $('rList');
    list.textContent = '';
    res.items.forEach(function (it, i) {
      var t = active[it.index];
      if (adjOpen && solved) { list.appendChild(editRow(it, i, res, active)); return; }
      var li = el('li', 'mixitem');
      var chip = el('span', 'chip'); chip.style.background = t.hex;
      var nm = el('span', 'nm', t.name);
      if (t.group) nm.appendChild(el('span', 'gname-inline', t.group));
      var tg = tubeTags(t);
      if (tg) nm.appendChild(tg);
      nm.appendChild(copyButton(t));
      var pc = el('span', 'pc', Math.round(it.weight * 100) + ' %');
      var bar = el('span', 'bar2'); var fill = document.createElement('i');
      fill.style.width = Math.round(it.weight * 100) + '%'; bar.appendChild(fill);
      var pt = el('span', 'pt', res.parts && res.items.length > 1 ? res.parts[i] + (res.parts[i] > 1 ? ' parts' : ' part') : '');
      li.appendChild(chip); li.appendChild(nm); li.appendChild(pc); li.appendChild(bar); li.appendChild(pt);
      list.appendChild(li);
    });
    renderAdjFoot();
    if (adjFocus) {   // la liste vient d'être reconstruite : on rend le focus au contrôle utilisé
      var k = adjFocus, f = k === 'next' ? $('adjNext') : $('rList').querySelector('[data-fk="' + k + '"]');
      adjFocus = null;
      if (f && !f.disabled) f.focus();
    }
  }

  /* ---------- Conseil : peintures de la collection (non cochées) qui rapprocheraient la couleur ---------- */

  // Quand l'écart ΔE de la recette atteint SUGGEST_FROM, la tuile « Conseil » apparaît, fermée. À l'ouverture seulement, on cherche
  // parmi les tubes des nuanciers qu'on n'a pas cochés celui qui, ajouté aux tubes cochés, donnerait la couleur la plus proche.
  // Même moteur que la recette, rien de plus.
  var SUGGEST_FROM = 2.5;     // à partir de cet écart ΔE, on conseille
  var SUGGEST_TOP = 5;        // nombre de conseils montrés quand la tuile est ouverte
  var SUGGEST_OWNED = 5;      // tubes cochés les plus proches de la cible, gardés avec ceux de la recette (+ les plus clairs et sombres)
  var SUGGEST_NEAR = 60;      // peintures candidates les plus proches de la cible par leur propre couleur
  var SUGGEST_EXTREME = 4;    // + les plus claires et les plus sombres (blancs et noirs règlent la clarté)
  var SUGGEST_MIN_GAIN = 0.3; // gain de ΔE minimal pour qu'une peinture soit conseillée
  var lastRecipe = null;      // { res, active } : dernier calcul de recette
  var suggestToken = 0;       // change à chaque nouveau calcul : un calcul périmé s'arrête

  function fmtDe(v) { return v.toFixed(1).replace('.', ','); }
  function tubeLabel(t) { return t.name + (t.group ? ' (' + t.group + ')' : ''); }

  function updateSuggest() {
    var tile = $('tileSuggest');
    var show = !!(lastRecipe && Moteur && mode === 'pick' && panelOf[view] === 'viewMix' && lastRecipe.res.de >= SUGGEST_FROM);
    tile.hidden = !show;
    suggestToken++;   // annule le calcul en cours
    $('sgTeaser').textContent = ''; $('sgList').textContent = '';   // l'ancien conseil n'est plus valable
    if (show && tile.open) runSuggest();   // fermée : rien n'est calculé, et rien n'est montré
  }
  $('tileSuggest').addEventListener('toggle', function () {
    if (this.open && !this.hidden && lastRecipe) { suggestToken++; runSuggest(); }
    else suggestToken++;   // refermée : on arrête la recherche
  });

  function runSuggest() {
    var token = suggestToken, base = lastRecipe.res, active = lastRecipe.active;
    var teaser = $('sgTeaser'), body = $('sgList');
    body.textContent = '';
    var inactive = tubes.filter(function (t) { return !t.active && !excludedTube(t); });
    if (!inactive.length) {
      teaser.textContent = 'Importez un nuancier pour recevoir un conseil.';
      var b = el('button', 'btn ghost', 'Nuanciers'); b.type = 'button';
      b.addEventListener('click', function () { openNuancierModal('imp'); });
      body.appendChild(el('p', 'muted', 'Les peintures de vos nuanciers que vous n’avez pas cochées sont comparées à la couleur cible.'));
      body.appendChild(b);
      return;
    }
    teaser.textContent = 'Recherche de peintures…';

    var tl = Moteur.rgbToLab(target), labs = {};
    function labOf(t) { return labs[t.id] || (labs[t.id] = Moteur.rgbToLab(parseHex(t.hex))); }
    function dist(t) { return Moteur.deltaE76(labOf(t), tl); }
    function uniq(list) { var seen = {}; return list.filter(function (t) { if (seen[t.id]) return false; seen[t.id] = true; return true; }); }
    function byL(a, b) { return labOf(a)[0] - labOf(b)[0]; }

    // tubes cochés gardés : ceux de la recette, les plus proches de la cible, le plus clair et le plus sombre
    var ownedSub = uniq(base.items.map(function (it) { return active[it.index]; })
      .concat(active.slice().sort(function (a, b) { return dist(a) - dist(b); }).slice(0, SUGGEST_OWNED))
      .concat(active.slice().sort(byL).slice(0, 2), active.slice().sort(byL).slice(-2)));
    // peintures candidates : les plus proches de la cible, et les extrêmes de clarté
    var sortedL = inactive.slice().sort(byL);
    var cands = uniq(inactive.slice().sort(function (a, b) { return dist(a) - dist(b); }).slice(0, SUGGEST_NEAR)
      .concat(sortedL.slice(0, SUGGEST_EXTREME), sortedL.slice(-SUGGEST_EXTREME)));

    var found = [], i = 0;
    (function step() {
      if (token !== suggestToken) return;   // la couleur ou les tubes ont changé : ce calcul est périmé
      var end = Math.min(cands.length, i + 6);
      for (; i < end; i++) {
        var c = cands[i];
        var r = Moteur.solve(target, ownedSub.map(toEng).concat([toEng(c)]));
        if (r.items.some(function (it) { return it.id === c.id; }) && base.de - r.de >= SUGGEST_MIN_GAIN) found.push({ t: c, res: r });
      }
      if (i < cands.length) { teaser.textContent = 'Recherche de peintures… ' + Math.round(i / cands.length * 100) + ' %'; setTimeout(step, 0); return; }
      showSuggestions(found.sort(function (a, b) { return a.res.de - b.res.de; }).slice(0, SUGGEST_TOP), base, ownedSub);
    })();
  }
  function toEng(t) { return { id: t.id, rgb: parseHex(t.hex) }; }

  function showSuggestions(list, base, ownedSub) {
    var teaser = $('sgTeaser'), body = $('sgList');
    body.textContent = '';
    if (!list.length) {
      teaser.textContent = 'Aucune peinture de vos nuanciers ne rapproche la couleur.';
      return;
    }
    var first = list[0];
    teaser.textContent = 'Ajoutez « ' + tubeLabel(first.t) + ' » : ΔE ' + fmtDe(base.de) + ' → ' + fmtDe(first.res.de);
    var byId = {};
    ownedSub.concat(list.map(function (x) { return x.t; })).forEach(function (t) { byId[t.id] = t; });
    var ul = el('ul', 'sglist');
    list.forEach(function (x) {
      var li = el('li', 'sgitem');
      var chip = el('span', 'chip'); chip.style.background = x.t.hex;
      var nm = el('span', 'nm', x.t.name);
      if (x.t.group) nm.appendChild(el('span', 'gname-inline', x.t.group));
      var tg = tubeTags(x.t); if (tg) nm.appendChild(tg);
      var de = el('span', 'sgde');
      de.appendChild(el('b', null, 'ΔE ' + fmtDe(x.res.de)));
      de.appendChild(el('span', 'muted', '−' + fmtDe(base.de - x.res.de)));
      // Deux façons de s'en servir : je l'ai (elle entre dans la recette) ou je dois l'acquérir (marquée, hors calcul)
      var acts = el('span', 'sgacts');
      acts.appendChild(copyButton(x.t));
      var add = el('button', 'tbtn', 'Ajouter inventaire'); add.type = 'button';
      add.setAttribute('aria-label', 'Ajouter « ' + tubeLabel(x.t) + ' » à l’inventaire : l’utiliser dans la recette');
      add.addEventListener('click', function () { setStatus(x.t, 'have'); saveTubes(); renderTubes(); });
      acts.appendChild(add);
      if (!x.t.want) {
        var want = el('button', 'tbtn', 'Ajouter à la liste de courses'); want.type = 'button';
        want.setAttribute('aria-label', 'Ajouter « ' + tubeLabel(x.t) + ' » à la liste de courses');
        want.addEventListener('click', function () { setStatus(x.t, 'want'); saveTubes(); renderTubes(); });
        acts.appendChild(want);
      }
      var mix = el('span', 'sgmix', x.res.items.map(function (it) { return (byId[it.id] ? byId[it.id].name : '?') + ' ' + Math.round(it.weight * 100) + ' %'; }).join(' · '));
      li.appendChild(chip); li.appendChild(nm); li.appendChild(de); li.appendChild(mix); li.appendChild(acts);
      ul.appendChild(li);
    });
    body.appendChild(ul);
    body.appendChild(el('p', 'muted note', 'Indicatif : même calcul que la recette, avec une peinture de plus.'));
  }

  /* ---------- Peintures de l'image : ce qu'on a, et ce qu'on pourrait ajouter (plusieurs propositions) ---------- */

  // Précision : nombre de couleurs de l'image prises en compte ; au maximum, tous ses points (image réduite à 128 px de côté).
  var PP_LEVELS = [8, 16, 32, 64, 128, 'all'];
  var ppEl = $('ppModal'), ppOpener = null, ppSel = null, ppRes = null, ppPick = 0, ppToken = 0, ppCache = {};

  function ppLevelLabel(i) { return PP_LEVELS[i] === 'all' ? 'tous les points' : PP_LEVELS[i] + ' couleurs'; }
  function ppGroups() {
    var names = [];
    tubes.forEach(function (t) { if (t.group && names.indexOf(t.group) === -1) names.push(t.group); });
    names.sort(function (a, b) { return a.localeCompare(b, 'fr'); });
    if (tubes.some(function (t) { return !t.group; })) names.push('');
    return names;
  }
  // Collections étudiées : toutes cochées au départ ; vos peintures cochées comptent toujours
  function ppFillColls() {
    var box = $('ppColls'), names = ppGroups();
    if (!ppSel) ppSel = {};
    box.textContent = '';
    names.forEach(function (g) {
      if (!ppSel.hasOwnProperty(g)) ppSel[g] = true;
      var lab = el('label', 'coll'), cb = document.createElement('input');
      cb.type = 'checkbox'; cb.checked = !!ppSel[g];
      cb.addEventListener('change', function () { ppSel[g] = cb.checked; ppCompute(); });
      lab.appendChild(cb); lab.appendChild(el('span', null, g || 'Sans groupe'));
      box.appendChild(lab);
    });
    if (!names.length) box.appendChild(el('span', 'muted', 'Aucune collection.'));
  }
  // Couleurs de l'image au niveau de précision choisi (gardées tant que l'image ne change pas)
  function ppTargets(i) {
    var key = thumbSeq + '|' + i;
    if (ppCache[key]) return ppCache[key];
    var side = PP_LEVELS[i] === 'all' ? 128 : 64, k = Math.min(1, side / Math.max(source.width, source.height));
    var w = Math.max(1, Math.round(source.width * k)), hh = Math.max(1, Math.round(source.height * k));
    var c = document.createElement('canvas'); c.width = w; c.height = hh;
    var cx = c.getContext('2d', { willReadFrequently: true });
    cx.drawImage(source, 0, 0, w, hh);
    var data = cx.getImageData(0, 0, w, hh).data;
    ppCache = {};
    return (ppCache[key] = PP_LEVELS[i] === 'all' ? Moteur.allPoints(data) : Moteur.palette(data, PP_LEVELS[i]));
  }
  function ppCompute() {
    var body = $('ppBody'), token = ++ppToken, i = +$('ppLevel').value;
    $('ppLevelOut').textContent = ppLevelLabel(i);
    ppRes = null; $('ppProps').textContent = ''; $('ppKey').hidden = true;
    $('ppCopyAll').hidden = $('ppWantAll').hidden = true;
    body.textContent = '';
    if (!source || !Moteur) { body.appendChild(el('p', 'muted', 'Choisissez d’abord une image.')); return; }
    var pool = tubes.filter(function (t) { return (t.active || ppSel[t.group]) && !excludedTube(t); });
    if (!pool.length) { body.appendChild(el('p', 'muted', tubes.length ? 'Cochez au moins une collection.' : 'Aucune peinture : importez un nuancier ou ajoutez des tubes.')); return; }
    body.appendChild(el('p', 'muted', 'Calcul…'));
    setTimeout(function () {   // laisse s'afficher « Calcul… »
      if (token !== ppToken) return;
      var targets = ppTargets(i);
      var res = Moteur.propose(targets, pool.map(function (t) { return { id: t.id, rgb: parseHex(t.hex), owned: t.active }; }), { maxExtra: 6 });
      if (token !== ppToken) return;
      res.points = targets.length;
      ppRes = res;
      // proposition retenue d'abord : chaque achat doit faire gagner au moins 1 ΔE en moyenne
      var best = -1, bv = Infinity;
      res.proposals.forEach(function (p, k) { if (p.mean == null) return; var v = p.mean + p.n; if (v < bv) { bv = v; best = k; } });
      ppPick = Math.max(0, best);
      ppRender();
    }, 30);
  }
  function ppTube(id) { for (var i = 0; i < tubes.length; i++) if (tubes[i].id === id) return tubes[i]; return null; }
  function ppLists() {
    var p = ppRes.proposals[ppPick];
    var have = ppRes.have.filter(function (id) { return ppTube(id) && (p.use[id] || 0) > 0; });
    var buy = ppRes.adds.slice(0, p.n).filter(function (id) { return ppTube(id); });
    return { p: p, have: have, buy: buy };
  }
  function ppRender() {
    var props = $('ppProps'), body = $('ppBody');
    props.textContent = ''; body.textContent = '';
    if (!ppRes) return;
    if (!ppRes.have.length && !ppRes.adds.length) { body.appendChild(el('p', 'muted', 'Aucune peinture ne rapproche les couleurs de l’image.')); return; }
    ppRes.proposals.forEach(function (p, k) {
      if (p.mean == null) return;   // rien de possédé : pas de proposition « sans achat »
      var b = el('button', 'tbtn'); b.type = 'button';
      // ΔE moyen, son appréciation (même échelle que la recette), et part de l'image rendue presque à l'identique (gain sur la précédente)
      var prev = k > 0 ? ppRes.proposals[k - 1] : null, gain = prev && prev.mean != null ? Math.round((p.cover - prev.cover) * 100) : null;
      b.appendChild(el('b', null, p.n === 0 ? 'Sans achat' : '+' + p.n + (p.n > 1 ? ' tubes' : ' tube')));
      b.appendChild(el('span', null, 'ΔE ' + fmtDe(p.mean) + ' · ' + quality(p.mean)[0]));
      b.appendChild(el('span', null, Math.round(p.cover * 100) + ' % fidèle' + (gain ? ' (+' + gain + ' %)' : '')));
      b.title = 'Écart moyen avec l’image : ΔE ' + fmtDe(p.mean);
      b.setAttribute('aria-pressed', String(k === ppPick));
      b.addEventListener('click', function () { ppPick = k; ppRender(); });
      props.appendChild(b);
    });
    $('ppKey').hidden = false;
    var L = ppLists();
    // Bilan de la proposition choisie, présenté comme dans la tuile Recette : ΔE, appréciation, barre ; puis la phrase qui l'explique
    var q = quality(L.p.mean), sum = el('div', 'de pp-de ' + q[1]);
    sum.appendChild(el('span', 'de-val', 'ΔE ' + fmtDe(L.p.mean)));
    sum.appendChild(el('span', 'de-lab', q[0]));
    var bar = el('span', 'de-bar'), fill = document.createElement('i');
    fill.style.width = Math.max(4, Math.round((1 - Math.min(L.p.mean, 20) / 20) * 100)) + '%';
    bar.setAttribute('aria-hidden', 'true'); bar.appendChild(fill); sum.appendChild(bar);
    body.appendChild(sum);
    body.appendChild(el('p', 'pp-why', 'Avec ces peintures, chaque couleur de l’image est obtenue en moyenne à ΔE ' + fmtDe(L.p.mean) +
      ' près (' + q[0].toLowerCase() + ') ; ' + Math.round(L.p.cover * 100) + ' % de l’image est reproduite presque à l’identique (ΔE sous 3). ' +
      'Même échelle que la recette : sous 1 excellent, sous 2,5 très bon, sous 5 bon, sous 10 approximatif, au-delà éloigné.'));
    function section(title, ids, buying) {
      if (!ids.length) return;
      body.appendChild(el('h3', null, title + ' · ' + ids.length));
      var ul = el('ul', 'pplist');
      ids.forEach(function (id) {
        var t = ppTube(id), li = el('li', 'ppitem');
        var chip = el('span', 'chip'); chip.style.background = t.hex;
        var nm = el('span', 'nm', t.name);
        if (t.group) nm.appendChild(el('span', 'gname-inline', t.group));
        var tg = tubeTags(t); if (tg) nm.appendChild(tg);
        var u = Math.round((L.p.use[id] || 0) * 100);
        var acts = el('span', 'sgacts');
        acts.appendChild(copyButton(t));
        if (buying && !t.active) {
          var add = el('button', 'tbtn', 'Ajouter inventaire'); add.type = 'button';
          add.setAttribute('aria-label', 'Ajouter « ' + tubeLabel(t) + ' » à l’inventaire');
          add.addEventListener('click', function () { setStatus(t, 'have'); saveTubes(); renderTubes(); ppRender(); });
          acts.appendChild(add);
          if (!t.want) {
            var want = el('button', 'tbtn', 'Ajouter à la liste de courses'); want.type = 'button';
            want.setAttribute('aria-label', 'Ajouter « ' + tubeLabel(t) + ' » à la liste de courses');
            want.addEventListener('click', function () { setStatus(t, 'want'); saveTubes(); renderTubes(); ppRender(); });
            acts.appendChild(want);
          }
        }
        li.appendChild(chip); li.appendChild(nm);
        li.appendChild(el('span', 'muted ppuse', 'Sert pour ' + (u < 1 ? 'moins de 1' : u) + ' % de l’image'));
        li.appendChild(acts);
        ul.appendChild(li);
      });
      body.appendChild(ul);
    }
    section('Je les ai', L.have, false);
    section('À acquérir', L.buy, true);
    if (!L.buy.length) body.appendChild(el('p', 'muted note', L.p.n === 0 ? 'Rien à acheter pour cette proposition.' : ''));
    body.appendChild(el('p', 'muted note', ppRes.points + ' couleurs de l’image prises en compte (' + ppLevelLabel(+$('ppLevel').value) + ').'));
    $('ppCopyAll').hidden = false;
    $('ppWantAll').hidden = !L.buy.some(function (id) { var t = ppTube(id); return !t.active && !t.want; });
  }
  function ppText() {
    var L = ppLists();
    function line(id) { var t = ppTube(id); return '- ' + tubeLabel(t) + (t.pigment ? ' (' + t.pigment + ')' : ''); }
    return ['Peintures de l’image' + (imageName ? ' — ' + imageName : '') + ' · ΔE ' + fmtDe(L.p.mean) + ' (' + quality(L.p.mean)[0] + '), ' + Math.round(L.p.cover * 100) + ' % fidèle', '', 'Je les ai (' + L.have.length + ')']
      .concat(L.have.map(line), ['', 'À acquérir (' + L.buy.length + ')'], L.buy.map(line)).join('\n');
  }
  function openPp() {
    if (!source) return;
    ppOpener = document.activeElement;
    ppFillColls();
    if (!ppEl.open) ppEl.showModal();
    ppCompute();
  }
  ppEl.addEventListener('close', function () { ppToken++; if (ppOpener && ppOpener.focus && document.contains(ppOpener)) ppOpener.focus(); });
  ppEl.addEventListener('click', function (e) { if (e.target === ppEl) ppEl.close(); });
  $('ppClose').addEventListener('click', function () { ppEl.close(); });
  $('ppBtn').addEventListener('click', openPp);
  $('ppLevel').addEventListener('input', function () { $('ppLevelOut').textContent = ppLevelLabel(+this.value); });
  $('ppLevel').addEventListener('change', ppCompute);
  $('ppCopyAll').addEventListener('click', function () { if (ppRes) copyText(ppText(), $('ppMsg')); });
  $('ppWantAll').addEventListener('click', function () {
    if (!ppRes) return;
    ppLists().buy.forEach(function (id) { var t = ppTube(id); if (t && !t.active) setStatus(t, 'want'); });
    saveTubes(); renderTubes(); ppRender();
  });

  $('goCouleurs').addEventListener('click', function () { setView('couleurs'); tabs.couleurs.focus(); });

  /* ---------- Paramètres : stockage, sauvegardes, maintenance ---------- */

  var QUOTA_BYTES = 5 * 1024 * 1024; // ordre de grandeur courant du stockage local d'un site

  function formatBytes(n) {
    if (n < 1024) return n + ' octets';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1).replace('.', ',') + ' Ko';
    return (n / 1024 / 1024).toFixed(2).replace('.', ',') + ' Mo';
  }

  // Volume des données de cet outil seules (les autres pages du site ont les leurs).
  function storageUsed() {
    var total = 0;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(NS) === 0) total += (k.length + (localStorage.getItem(k) || '').length) * 2; // UTF-16
      }
    } catch (e) { storageOk = false; }
    return total;
  }

  function updateStorageInfo() {
    var used = storageUsed();
    $('storeUsed').textContent = storageOk ? formatBytes(used) : 'Indisponible';
    $('storeBarFill').style.width = Math.min(100, Math.max(used ? 2 : 0, used / QUOTA_BYTES * 100)) + '%';
    var n = tubes.length;
    $('storeDetail').textContent = n + (n > 1 ? ' tubes' : ' tube') + ' · sur ~5 Mo';
    $('storeWarn').hidden = storageOk;
  }

  var setMsg = $('setMsg');
  function say(msg, bad) {
    setMsg.textContent = msg;
    setMsg.className = bad ? 'err' : 'notice';
    setMsg.hidden = !msg;
  }

  // Exporter les tubes : tubes et réglages de grille dans un fichier .json
  $('expCouleurs').addEventListener('click', function () {
    var data = {
      app: 'etude-image', version: 1, exportedAt: new Date().toISOString(),
      tubes: tubes, grille: grid
    };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    download(blob, 'tubes-peinture-' + new Date().toISOString().slice(0, 10) + '.json');
    say('Tubes exportés (' + tubes.length + (tubes.length > 1 ? ' tubes' : ' tube') + ').', false);
  });

  // Importer des tubes : remplace la palette actuelle (après confirmation si elle n'est pas vide)
  $('impCouleurs').addEventListener('click', function () { $('impFile').click(); });
  $('impFile').addEventListener('change', function () {
    var f = this.files[0];
    this.value = '';
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) { say('Fichier trop volumineux (2 Mo au maximum).', true); return; }
    var reader = new FileReader();
    reader.onerror = function () { say('Impossible de lire ce fichier.', true); };
    reader.onload = function () {
      var data;
      try { data = JSON.parse(String(reader.result)); } catch (e) { say('Ce fichier n’est pas un JSON valide.', true); return; }
      if (!data || typeof data !== 'object' || !Array.isArray(data.tubes)) { say('Ce fichier ne contient pas de tubes.', true); return; }
      var imported = cleanTubeList(data.tubes);
      if (!imported.length) { say('Aucun tube valide dans ce fichier.', true); return; }
      if (tubes.length && !window.confirm('Remplacer les ' + tubes.length + ' tubes actuels par les ' + imported.length + ' du fichier ?')) return;
      tubes = imported;
      if (data.grille) grid = cleanGrid(data.grille);
      closeForm();
      saveTubes(); saveGrid(); renderTubes(); syncGridUI(); render();
      updateStorageInfo();
      say(imported.length + (imported.length > 1 ? ' tubes importés.' : ' tube importé.'), false);
    };
    reader.readAsText(f);
  });

  // Vider le cache : image de travail et sélection ; les tubes et les réglages ne sont pas touchés
  $('clearCache').addEventListener('click', function () {
    clearImage();
    clearChart();
    say('Images (référence et nuancier) et sélection effacées. Vos tubes sont conservés.', false);
  });

  // Calcul : noir chromatique uniquement
  $('optBlack').checked = opts.chromaticBlack;
  $('optBlack').addEventListener('change', function () {
    opts.chromaticBlack = this.checked;
    saveOpts();
    renderTubes(); scheduleRecipe();
  });
  $('optEffects').checked = opts.noEffects;
  $('optEffects').addEventListener('change', function () {
    opts.noEffects = this.checked;
    saveOpts();
    renderTubes(); scheduleRecipe();
  });

  // Zone de danger : efface les données de cet outil sur cet appareil (et seulement elles)
  $('wipeAll').addEventListener('click', function () {
    if (!window.confirm('Supprimer toutes les données de cet outil sur cet appareil (tubes, réglages de grille, image) ?\n\nCette action est définitive. Pensez à exporter vos tubes avant.')) return;
    try {
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(NS) === 0) keys.push(k);
      }
      keys.forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) { storageOk = false; }
    tubes = [];
    opts.chromaticBlack = true; $('optBlack').checked = true;   // les réglages par défaut reviennent
    opts.noEffects = true; $('optEffects').checked = true;
    grid = cleanGrid(null);
    closeForm();
    clearImage();
    clearChart();
    setLayout('below', true, true);
    setTheme('site', true);
    renderTubes(); syncGridUI(); scheduleRecipe();
    updateStorageInfo();
    say('Données supprimées sur cet appareil.', false);
  });

  /* ---------- Démarrage ---------- */

  tubes = loadTubes();
  $('storeWarn').hidden = storageOk;
  renderTubes();
  syncGridUI();

  // Vue de départ : celle de l'adresse (#grille, #valeurs, #pipette, #couleurs, #parametres), sinon la grille.
  setLayout(layout, true, true);
  setView(viewOfSlug[location.hash.slice(1)] || 'grid', true, true);
  computeRecipe();
})();
