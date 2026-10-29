/* Calculateur de réseau IPv4 : réseau, plage, masques, découpage en sous-réseaux, appartenance.
   Arithmétique sur des entiers non signés de 32 bits. Aucune dépendance. */
(function () {
  'use strict';

  var MAX_ROWS = 64; // sous-réseaux affichés au maximum

  /* ---------- Calcul ---------- */

  /* "192.168.1.10" -> entier, ou null si la forme est invalide */
  function parseIp(text) {
    var m = /^\s*(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\s*$/.exec(text || '');
    if (!m) return null;
    var n = 0;
    for (var i = 1; i <= 4; i++) {
      var o = Number(m[i]);
      if (o > 255) return null;
      n = n * 256 + o;
    }
    return n;
  }
  function ipText(n) {
    return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
  }
  function maskOf(prefix) { return prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0; }

  /* "/24", "24" ou "255.255.255.0" -> préfixe 0..32, ou null */
  function parsePrefix(text) {
    var t = (text || '').trim();
    if (/^\/?\d{1,2}$/.test(t)) {
      var p = Number(t.replace('/', ''));
      return p <= 32 ? p : null;
    }
    var m = parseIp(t);
    if (m === null) return null;
    for (var p2 = 0; p2 <= 32; p2++) if (maskOf(p2) === m) return p2;
    return null; // masque non contigu
  }

  function bits(n) {
    var s = (n >>> 0).toString(2);
    while (s.length < 32) s = '0' + s;
    return s;
  }

  function kind(n) {
    var a = n >>> 24, b = (n >>> 16) & 255;
    if (n === 0xFFFFFFFF) return 'Diffusion générale (255.255.255.255)';
    if (a === 0) return 'Réservée (« ce réseau »)';
    if (a === 10) return 'Privée';
    if (a === 127) return 'Boucle locale';
    if (a === 169 && b === 254) return 'Lien local (attribuée automatiquement)';
    if (a === 172 && b >= 16 && b <= 31) return 'Privée';
    if (a === 192 && b === 168) return 'Privée';
    if (a === 100 && b >= 64 && b <= 127) return 'Partagée (opérateur)';
    if (a >= 224 && a <= 239) return 'Multidiffusion';
    if (a >= 240) return 'Réservée';
    return 'Publique';
  }
  function klass(n) {
    var a = n >>> 24;
    return a < 128 ? 'A' : a < 192 ? 'B' : a < 224 ? 'C' : a < 240 ? 'D' : 'E';
  }

  function calc(ip, prefix) {
    var mask = maskOf(prefix);
    var net = (ip & mask) >>> 0;
    var bcast = (net | (~mask >>> 0)) >>> 0;
    var total = Math.pow(2, 32 - prefix);
    var first, last, hosts;
    if (prefix <= 30) { first = net + 1; last = bcast - 1; hosts = total - 2; }
    else if (prefix === 31) { first = net; last = bcast; hosts = 2; }
    else { first = ip; last = ip; hosts = 1; }
    return {
      ip: ip, prefix: prefix, mask: mask, wildcard: (~mask) >>> 0,
      net: net, bcast: bcast, first: first, last: last, total: total, hosts: hosts,
      cls: klass(ip), kind: kind(ip)
    };
  }

  function subnets(r, newPrefix) {
    var count = Math.pow(2, newPrefix - r.prefix), size = Math.pow(2, 32 - newPrefix), list = [];
    for (var i = 0; i < Math.min(count, MAX_ROWS); i++) {
      var net = r.net + i * size;
      list.push(calc(net >>> 0, newPrefix));
    }
    return { count: count, list: list };
  }

  function contains(r, ip) { return ((ip & r.mask) >>> 0) === r.net; }

  /* ---------- Affichage ---------- */

  function init() {
    var $ = function (id) { return document.getElementById(id); };
    function el(tag, cls, text) {
      var e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text != null) e.textContent = text;
      return e;
    }
    var fmt = function (n) { return n.toLocaleString('fr-FR'); };

    function row(dl, label, value) {
      dl.appendChild(el('dt', null, label));
      var dd = el('dd');
      if (value && value.nodeType) dd.appendChild(value); else dd.textContent = value;
      dl.appendChild(dd);
    }
    function binary(n, prefix) {
      var s = bits(n), box = el('span', 'bin');
      for (var g = 0; g < 4; g++) {
        var part = s.slice(g * 8, g * 8 + 8), start = g * 8, k = Math.max(0, Math.min(8, prefix - start));
        var w = el('span', 'octet');
        if (k > 0) w.appendChild(el('b', null, part.slice(0, k)));
        if (k < 8) w.appendChild(document.createTextNode(part.slice(k)));
        box.appendChild(w);
      }
      return box;
    }

    function update() {
      var err = $('err'), out = $('result');
      var ip = parseIp($('ip').value), prefix = parsePrefix($('mask').value);
      err.hidden = true;
      if (ip === null || prefix === null) {
        out.hidden = true;
        err.textContent = ip === null
          ? 'Adresse invalide : saisissez quatre nombres de 0 à 255 séparés par des points.'
          : 'Masque invalide : saisissez un CIDR (24, /24) ou un masque continu (255.255.255.0).';
        err.hidden = ($('ip').value.trim() === '' && $('mask').value.trim() === '');
        return;
      }
      out.hidden = false;
      var r = calc(ip, prefix), dl = $('facts');
      dl.innerHTML = '';
      row(dl, 'Adresse réseau', ipText(r.net) + '/' + r.prefix);
      row(dl, 'Masque', ipText(r.mask));
      row(dl, 'Masque inverse', ipText(r.wildcard));
      row(dl, 'Première adresse', ipText(r.first));
      row(dl, 'Dernière adresse', ipText(r.last));
      row(dl, 'Diffusion', r.prefix >= 31 ? 'aucune adresse de diffusion distincte' : ipText(r.bcast));
      row(dl, 'Adresses au total', fmt(r.total));
      row(dl, 'Machines possibles', fmt(r.hosts));
      row(dl, 'Classe', r.cls);
      row(dl, 'Type', r.kind);
      row(dl, 'Adresse, en binaire', binary(r.ip, r.prefix));
      row(dl, 'Masque, en binaire', binary(r.mask, r.prefix));

      // découpage
      var sel = $('split'), keep = sel.value;
      sel.innerHTML = '';
      sel.appendChild(el('option', null, 'Ne pas découper')).value = '';
      for (var p = r.prefix + 1; p <= Math.min(32, r.prefix + 12); p++) {
        var o = el('option', null, '/' + p + ' — ' + fmt(Math.pow(2, p - r.prefix)) + ' sous-réseaux');
        o.value = String(p);
        sel.appendChild(o);
      }
      if (keep && Number(keep) > r.prefix) sel.value = keep;
      renderSplit(r);
      renderContains(r);
      lastResult = r;
    }

    var lastResult = null;
    function renderSplit(r) {
      var box = $('splitOut'), p = Number($('split').value);
      box.innerHTML = '';
      if (!p) return;
      var s = subnets(r, p), t = el('table'), head = el('tr');
      ['N°', 'Réseau', 'Plage utilisable', 'Diffusion'].forEach(function (h) { head.appendChild(el('th', null, h)); });
      t.appendChild(head);
      s.list.forEach(function (n, i) {
        var tr = el('tr');
        tr.appendChild(el('td', null, String(i + 1)));
        tr.appendChild(el('td', 'mono', ipText(n.net) + '/' + n.prefix));
        tr.appendChild(el('td', 'mono', n.first === n.last ? ipText(n.first) : ipText(n.first) + ' → ' + ipText(n.last)));
        tr.appendChild(el('td', 'mono', n.prefix >= 31 ? '—' : ipText(n.bcast)));
        t.appendChild(tr);
      });
      box.appendChild(el('div', 'scroll')).appendChild(t);
      if (s.count > MAX_ROWS) box.appendChild(el('p', 'muted', 'Les ' + MAX_ROWS + ' premiers sous-réseaux sur ' + fmt(s.count) + ' sont affichés.'));
    }
    function renderContains(r) {
      var out = $('inOut'), txt = $('other').value.trim();
      out.hidden = txt === '';
      out.className = 'verdict';
      if (txt === '') return;
      var o = parseIp(txt);
      if (o === null) { out.textContent = 'Adresse invalide.'; out.classList.add('no'); return; }
      var yes = contains(r, o);
      out.textContent = ipText(o) + (yes ? ' appartient à ' : ' n’appartient pas à ') + ipText(r.net) + '/' + r.prefix + '.';
      out.classList.add(yes ? 'yes' : 'no');
    }

    ['ip', 'mask'].forEach(function (id) { $(id).addEventListener('input', update); });
    $('split').addEventListener('change', function () { if (lastResult) renderSplit(lastResult); });
    $('other').addEventListener('input', function () { if (lastResult) renderContains(lastResult); });
    update();
  }

  if (typeof document !== 'undefined') init();
  if (typeof module !== 'undefined') module.exports = { parseIp: parseIp, parsePrefix: parsePrefix, calc: calc, ipText: ipText, subnets: subnets, contains: contains };
})();
