/* Santé/Condition Physique : export d'une semaine de séances vers un agenda, au format iCalendar (.ics, RFC 5545, format ouvert).
   Tout se fait dans le navigateur : le fichier est créé sur l'appareil, rien n'est envoyé. Expose Vie.calendrier. Dépend de vie/aliments.js. */
(function () {
  'use strict';

  var V = window.Vie;

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function local(d) { return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + 'T' + pad(d.getHours()) + pad(d.getMinutes()) + '00'; }
  function utc(d) { return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z'; }
  /* Texte iCalendar : \ ; , et retours à la ligne sont échappés */
  function texte(t) { return String(t).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  /* Une ligne ne dépasse pas 75 octets : on la coupe, la suite commence par une espace (sans couper un caractère en deux) */
  function plier(ligne) {
    var enc = new TextEncoder(), dec = new TextDecoder(), out = [], cur = '', n = 0, ch, len, limite = 75;
    for (ch of ligne) {
      len = enc.encode(ch).length;
      if (n + len > limite) { out.push(cur); cur = ' '; n = 1; limite = 75; }
      cur += ch; n += len;
    }
    out.push(cur);
    return out.join('\r\n');
  }
  function uid() {
    var a = new Uint32Array(4), i, s = '';
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(a); else for (i = 0; i < 4; i++) a[i] = Math.floor(Math.random() * 4294967296);
    for (i = 0; i < 4; i++) s += a[i].toString(16);
    return s + '@tools.local';
  }

  /* Prochaine date (aujourd'hui comprise) tombant tel jour de la semaine (0 = lundi) */
  function prochain(jour, heure, minute) {
    var d = new Date(), delta = (jour - ((d.getDay() + 6) % 7) + 7) % 7;
    d.setDate(d.getDate() + delta);
    d.setHours(heure, minute, 0, 0);
    return d;
  }

  /* seances : [{ jour 0..6, titre, desc, min }] ; opts : { nom, heure 'HH:MM', semaines } -> texte .ics (une répétition hebdomadaire par séance) */
  function ics(seances, opts) {
    var h = String(opts.heure || '18:00').split(':'), hh = Number(h[0]) || 18, mm = Number(h[1]) || 0, nb = V.clamp(Math.round(opts.semaines) || 1, 1, 104);
    var now = new Date(), lignes = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Tools//Sante et condition physique//FR', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:' + texte(opts.nom || 'Séances')];
    seances.forEach(function (s) {
      var debut = prochain(s.jour, hh, mm), fin = new Date(debut.getTime() + (s.min || 60) * 60000);
      lignes.push('BEGIN:VEVENT', 'UID:' + uid(), 'DTSTAMP:' + utc(now), 'DTSTART:' + local(debut), 'DTEND:' + local(fin),
        'RRULE:FREQ=WEEKLY;COUNT=' + nb, 'SUMMARY:' + texte(s.titre));
      if (s.desc) lignes.push('DESCRIPTION:' + texte(s.desc));
      lignes.push('END:VEVENT');
    });
    lignes.push('END:VCALENDAR');
    return lignes.map(plier).join('\r\n') + '\r\n';
  }

  /* Propose le fichier au téléchargement */
  function telecharger(nomFichier, contenu) {
    var blob = new Blob([contenu], { type: 'text/calendar;charset=utf-8' }), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = nomFichier;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  V.calendrier = { ics: ics, telecharger: telecharger };
})();
