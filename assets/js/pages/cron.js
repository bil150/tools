/* Aide à la syntaxe cron : explication champ par champ et prochaines exécutions.
   Format à 5 champs : minute heure jour-du-mois mois jour-de-la-semaine. Aucune dépendance. */
(function () {
  'use strict';

  var MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  var DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

  var FIELDS = [
    { name: 'Minute', min: 0, max: 59, unit: 'minute', plural: 'minutes' },
    { name: 'Heure', min: 0, max: 23, unit: 'heure', plural: 'heures' },
    { name: 'Jour du mois', min: 1, max: 31, unit: 'jour', plural: 'jours' },
    { name: 'Mois', min: 1, max: 12, unit: 'mois', plural: 'mois', keys: MONTH_KEYS, base: 1 },
    { name: 'Jour de la semaine', min: 0, max: 7, unit: 'jour de la semaine', plural: 'jours de la semaine', keys: DAY_KEYS, base: 0 }
  ];
  var SHORT = {
    '@yearly': '0 0 1 1 *', '@annually': '0 0 1 1 *', '@monthly': '0 0 1 * *',
    '@weekly': '0 0 * * 0', '@daily': '0 0 * * *', '@midnight': '0 0 * * *', '@hourly': '0 * * * *'
  };

  /* ---------- Analyse ---------- */

  function value(token, f) {
    if (/^\d+$/.test(token)) return Number(token);
    var i = f.keys ? f.keys.indexOf(token.toLowerCase()) : -1;
    if (i < 0) throw new Error('« ' + token + ' » n’est pas une valeur valable pour le champ « ' + f.name + ' ».');
    return i + f.base;
  }

  /* Un champ -> { set, star, text } ; lève une Error en français si invalide */
  function parseField(text, f) {
    var set = {}, star = text === '*', parts = text.split(',');
    parts.forEach(function (part) {
      if (part === '') throw new Error('Le champ « ' + f.name + ' » contient une valeur vide.');
      var m = /^([^/]+)(?:\/(\d+))?$/.exec(part);
      if (!m) throw new Error('Syntaxe invalide dans le champ « ' + f.name + ' » : « ' + part + ' ».');
      var step = m[2] === undefined ? 1 : Number(m[2]), range = m[1], lo, hi;
      if (step < 1) throw new Error('Le pas doit être supérieur à 0 (champ « ' + f.name + ' »).');
      if (range === '*') { lo = f.min; hi = f.max; }
      else if (range.indexOf('-') > 0) {
        var ends = range.split('-');
        if (ends.length !== 2) throw new Error('Plage invalide dans le champ « ' + f.name + ' » : « ' + range + ' ».');
        lo = value(ends[0], f); hi = value(ends[1], f);
      } else {
        lo = value(range, f);
        hi = m[2] === undefined ? lo : f.max;
      }
      if (lo < f.min || hi > f.max) throw new Error('Le champ « ' + f.name + ' » accepte des valeurs de ' + f.min + ' à ' + f.max + '.');
      if (lo > hi) throw new Error('Plage à l’envers dans le champ « ' + f.name + ' » : « ' + range + ' ».');
      for (var v = lo; v <= hi; v += step) set[f.name === 'Jour de la semaine' && v === 7 ? 0 : v] = true;
    });
    return { set: set, star: star, text: text };
  }

  function parse(expr) {
    var t = (expr || '').trim().replace(/\s+/g, ' ');
    if (SHORT[t.toLowerCase()]) t = SHORT[t.toLowerCase()];
    var parts = t.split(' ');
    if (t === '') throw new Error('Saisissez une expression cron.');
    if (parts.length !== 5) throw new Error('Il faut 5 champs séparés par des espaces (minute heure jour mois jour-de-semaine) ; ' + parts.length + ' trouvé(s).');
    return parts.map(function (p, i) { return parseField(p, FIELDS[i]); });
  }

  /* ---------- Explication ---------- */

  function label(f, v) {
    if (f.name === 'Mois') return MONTHS[v - 1];
    if (f.name === 'Jour de la semaine') return DAYS[v % 7];
    if (f.name === 'Heure') return v + ' h';
    return String(v);
  }
  function describe(text, f) {
    if (text === '*') return 'Chaque ' + f.unit;
    return text.split(',').map(function (part) {
      var m = /^([^/]+)(?:\/(\d+))?$/.exec(part), range = m[1], step = m[2] ? Number(m[2]) : 0, s;
      if (range === '*') s = 'toutes les ' + step + ' ' + f.plural;
      else if (range.indexOf('-') > 0) {
        var e = range.split('-');
        s = 'de ' + label(f, value(e[0], f)) + ' à ' + label(f, value(e[1], f));
        if (step) s += ', toutes les ' + step + ' ' + f.plural;
      } else {
        s = label(f, value(range, f));
        if (step) s = 'à partir de ' + s + ', toutes les ' + step + ' ' + f.plural;
      }
      return s;
    }).join(' ; ').replace(/^./, function (c) { return c.toUpperCase(); });
  }

  /* ---------- Prochaines exécutions ---------- */

  function sorted(set) { return Object.keys(set).map(Number).sort(function (a, b) { return a - b; }); }

  function nextRuns(spec, from, count) {
    var runs = [], minutes = sorted(spec[0].set), hours = sorted(spec[1].set);
    var d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    for (var guard = 0; guard < 366 * 8 && runs.length < count; guard++, d.setDate(d.getDate() + 1)) {
      if (!spec[3].set[d.getMonth() + 1]) continue;
      var domOk = !!spec[2].set[d.getDate()], dowOk = !!spec[4].set[d.getDay()];
      // si le jour du mois et le jour de la semaine sont tous deux restreints, l'un OU l'autre suffit
      var dayOk = (spec[2].star || spec[4].star) ? (domOk && dowOk) : (domOk || dowOk);
      if (!dayOk) continue;
      for (var h = 0; h < hours.length && runs.length < count; h++) {
        for (var k = 0; k < minutes.length && runs.length < count; k++) {
          var t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hours[h], minutes[k]);
          if (t > from) runs.push(t);
        }
      }
    }
    return runs;
  }

  /* ---------- Interface ---------- */

  function init() {
    var $ = function (id) { return document.getElementById(id); };
    function el(tag, text) { var e = document.createElement(tag); if (text != null) e.textContent = text; return e; }
    var when = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    function update() {
      var err = $('err'), out = $('out'), expr = $('expr').value;
      try {
        var spec = parse(expr), tokens = (SHORT[expr.trim().toLowerCase()] || expr.trim().replace(/\s+/g, ' ')).split(' ');
        err.hidden = true; out.hidden = false;

        var body = $('rows'); body.innerHTML = '';
        FIELDS.forEach(function (f, i) {
          var tr = el('tr');
          tr.appendChild(el('td', f.name));
          var c = el('td', tokens[i]); c.className = 'mono'; tr.appendChild(c);
          tr.appendChild(el('td', describe(tokens[i], f)));
          var r = el('td', f.min + ' à ' + f.max); r.className = 'muted'; tr.appendChild(r);
          body.appendChild(tr);
        });

        var list = $('runs'); list.innerHTML = '';
        var runs = nextRuns(spec, new Date(), 10);
        if (!runs.length) list.appendChild(el('li', 'Aucune exécution dans les 8 prochaines années (date impossible, par exemple le 31 février).'));
        runs.forEach(function (d) { list.appendChild(el('li', when.format(d))); });
      } catch (e) {
        out.hidden = true;
        err.hidden = expr.trim() === '';
        err.textContent = e.message;
      }
    }

    $('expr').addEventListener('input', update);
    [].forEach.call(document.querySelectorAll('[data-expr]'), function (b) {
      b.addEventListener('click', function () { $('expr').value = b.dataset.expr; update(); });
    });
    update();
  }

  if (typeof document !== 'undefined') init();
  if (typeof module !== 'undefined') module.exports = { parse: parse, describe: describe, nextRuns: nextRuns, FIELDS: FIELDS };
})();
