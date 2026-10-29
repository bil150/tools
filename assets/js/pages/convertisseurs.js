/* Formateur et convertisseurs : JSON, Base64, URL, bases numériques, couleurs.
   Tout est calculé dans le navigateur, avec les API standards. Aucune dépendance. */
(function () {
  'use strict';

  var encoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;

  /* ---------- JSON ---------- */
  function jsonFormat(text) { return JSON.stringify(JSON.parse(text), null, 2); }
  function jsonMinify(text) { return JSON.stringify(JSON.parse(text)); }

  /* ---------- Base64 (texte UTF-8) ---------- */
  function toBase64(text, urlSafe) {
    var bytes = encoder.encode(text), bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    var s = btoa(bin);
    return urlSafe ? s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : s;
  }
  function fromBase64(text) {
    var s = text.trim().replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  }

  /* ---------- Bases numériques ---------- */
  function parseBase(text, base) {
    var t = text.trim().toLowerCase().replace(/[\s_]/g, ''), neg = false;
    if (t[0] === '-') { neg = true; t = t.slice(1); }
    var prefix = { 2: '0b', 8: '0o', 16: '0x' }[base];
    if (prefix && t.indexOf(prefix) === 0) t = t.slice(2);
    if (!t) throw new Error('Saisissez un nombre.');
    var n = BigInt(0), b = BigInt(base);
    for (var i = 0; i < t.length; i++) {
      var d = parseInt(t[i], 36);
      if (isNaN(d) || d >= base) throw new Error('Le caractère « ' + t[i] + ' » n’existe pas en base ' + base + '.');
      n = n * b + BigInt(d);
    }
    return neg ? -n : n;
  }

  /* ---------- Couleurs ---------- */
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function parseColor(text) {
    var t = text.trim().toLowerCase(), m;
    if ((m = /^#?([0-9a-f]{3})$/.exec(t))) {
      return { r: parseInt(m[1][0] + m[1][0], 16), g: parseInt(m[1][1] + m[1][1], 16), b: parseInt(m[1][2] + m[1][2], 16) };
    }
    if ((m = /^#?([0-9a-f]{6})$/.exec(t))) {
      return { r: parseInt(m[1].slice(0, 2), 16), g: parseInt(m[1].slice(2, 4), 16), b: parseInt(m[1].slice(4, 6), 16) };
    }
    if ((m = /^rgb\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})\s*\)$/.exec(t))) {
      var r = +m[1], g = +m[2], b = +m[3];
      if (r > 255 || g > 255 || b > 255) throw new Error('Chaque composante RGB va de 0 à 255.');
      return { r: r, g: g, b: b };
    }
    if ((m = /^hsl\(\s*(\d{1,3})(?:deg)?[\s,]+(\d{1,3})%?[\s,]+(\d{1,3})%?\s*\)$/.exec(t))) {
      if (+m[1] > 360 || +m[2] > 100 || +m[3] > 100) throw new Error('HSL : teinte 0–360, saturation et luminosité 0–100 %.');
      return hslToRgb(+m[1], +m[2], +m[3]);
    }
    throw new Error('Format non reconnu. Exemples : #3366cc, rgb(51, 102, 204), hsl(217, 80%, 51%).');
  }
  function rgbToHsl(c) {
    var r = c.r / 255, g = c.g / 255, b = c.b / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, h = 0, s = 0, d = max - min;
    if (d) {
      s = d / (1 - Math.abs(2 * l - 1));
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60; if (h < 0) h += 360;
    }
    return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
  }
  function hslToRgb(h, s, l) {
    s /= 100; l /= 100;
    var c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2, r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
    return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
  }
  function toHex(c) {
    return '#' + [c.r, c.g, c.b].map(function (v) { return ('0' + clamp(v, 0, 255).toString(16)).slice(-2); }).join('');
  }

  /* ---------- Interface ---------- */
  function init() {
    var $ = function (id) { return document.getElementById(id); };

    function show(errId, msg) { var e = $(errId); e.textContent = msg || ''; e.hidden = !msg; }
    function run(errId, fn) { try { show(errId); fn(); } catch (e) { show(errId, e.message); } }

    /* onglets */
    var tabs = [].slice.call(document.querySelectorAll('.seg button[data-tab]'));
    function openTab(name) {
      tabs.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.tab === name)); });
      [].forEach.call(document.querySelectorAll('.panel'), function (p) { p.hidden = p.id !== 'p-' + name; });
    }
    tabs.forEach(function (b) { b.addEventListener('click', function () { openTab(b.dataset.tab); }); });

    /* copier */
    [].forEach.call(document.querySelectorAll('[data-copy]'), function (b) {
      b.addEventListener('click', function () {
        var src = $(b.dataset.copy), old = b.textContent;
        var done = function () { b.textContent = 'Copié'; setTimeout(function () { b.textContent = old; }, 1200); };
        if (navigator.clipboard) navigator.clipboard.writeText(src.value).then(done, function () { src.select(); });
        else { src.select(); }
      });
    });

    /* JSON */
    function jsonDo(fn) { run('jsonErr', function () { $('jsonOut').value = fn($('jsonIn').value); }); }
    $('jsonFormat').addEventListener('click', function () { jsonDo(jsonFormat); });
    $('jsonMin').addEventListener('click', function () { jsonDo(jsonMinify); });

    /* Base64 */
    function b64(encode) {
      run('b64Err', function () {
        var v = $('b64In').value;
        $('b64Out').value = encode ? toBase64(v, $('b64Safe').checked) : fromBase64(v);
      });
    }
    $('b64Enc').addEventListener('click', function () { b64(true); });
    $('b64Dec').addEventListener('click', function () { b64(false); });

    /* URL */
    $('urlEnc').addEventListener('click', function () { run('urlErr', function () { $('urlOut').value = encodeURIComponent($('urlIn').value); }); });
    $('urlDec').addEventListener('click', function () { run('urlErr', function () { $('urlOut').value = decodeURIComponent($('urlIn').value.replace(/\+/g, ' ')); }); });

    /* Bases */
    function bases() {
      var out = $('baseOut');
      run('baseErr', function () {
        out.innerHTML = '';
        if ($('baseIn').value.trim() === '') return;
        var n = parseBase($('baseIn').value, Number($('baseFrom').value));
        [['Binaire (2)', 2], ['Octal (8)', 8], ['Décimal (10)', 10], ['Hexadécimal (16)', 16]].forEach(function (p) {
          var row = document.createElement('div'), lab = document.createElement('span'), val = document.createElement('code');
          row.className = 'hrow'; lab.textContent = p[0]; val.textContent = n.toString(p[1]).toUpperCase();
          row.appendChild(lab); row.appendChild(val); out.appendChild(row);
        });
      });
    }
    $('baseIn').addEventListener('input', bases);
    $('baseFrom').addEventListener('change', bases);

    /* Couleurs */
    function colors() {
      var out = $('colOut'), text = $('colIn').value;
      run('colErr', function () {
        out.innerHTML = '';
        $('swatch').style.background = 'transparent';
        if (text.trim() === '') return;
        var c = parseColor(text), h = rgbToHsl(c);
        $('swatch').style.background = toHex(c);
        [['Hexadécimal', toHex(c)], ['RGB', 'rgb(' + c.r + ', ' + c.g + ', ' + c.b + ')'], ['HSL', 'hsl(' + h.h + ', ' + h.s + '%, ' + h.l + '%)']].forEach(function (p) {
          var row = document.createElement('div'), lab = document.createElement('span'), val = document.createElement('code');
          row.className = 'hrow'; lab.textContent = p[0]; val.textContent = p[1];
          row.appendChild(lab); row.appendChild(val); out.appendChild(row);
        });
      });
    }
    $('colIn').addEventListener('input', colors);
    $('colPick').addEventListener('input', function () { $('colIn').value = $('colPick').value; colors(); });

    openTab('json');
    bases(); colors();
  }

  if (typeof document !== 'undefined') init();
  if (typeof module !== 'undefined') {
    module.exports = {
      jsonFormat: jsonFormat, jsonMinify: jsonMinify, toBase64: toBase64, fromBase64: fromBase64,
      parseBase: parseBase, parseColor: parseColor, rgbToHsl: rgbToHsl, toHex: toHex
    };
  }
})();
