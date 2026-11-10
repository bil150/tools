/* Nuanciers : lecture, validation et écriture du format JSON d'échange (sans DOM, sans dépendance).
   Un nuancier = les tubes d'un groupe, le groupe étant une marque saisie par l'utilisateur (rien n'est préenregistré).
   Ce module est la seule source des règles de validation d'un tube : la page l'utilise aussi pour son stockage. */
(function (g) {
  'use strict';

  var LIGHT = ['I', 'II', 'III'];              // durabilité, échelle ASTM
  var OPAC = ['T', 'ST', 'SO', 'O'];           // transparente, semi-transparente, semi-opaque, opaque
  var MAX = { name: 60, pigment: 20, group: 40, tubes: 1000 };

  function str(v, max) { return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : ''; }

  function parseHex(s) {
    var m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(s).trim());
    if (!m) return null;
    var h = m[1];
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return '#' + h.toLowerCase();
  }

  // « II », « ii », « ASTM II », 2 → 'II' ; autre chose → '' (une autre échelle n'est pas convertie)
  function lightOf(v) {
    var t = String(v == null ? '' : v).toUpperCase().replace(/^ASTM\s*/, '').trim();
    t = { 1: 'I', 2: 'II', 3: 'III' }[t] || t;
    return LIGHT.indexOf(t) !== -1 ? t : '';
  }
  function opacOf(v) {
    var t = String(v == null ? '' : v).toUpperCase().trim();
    return OPAC.indexOf(t) !== -1 ? t : '';
  }

  // Effet de surface : 'metal' (métallisé), 'iri' (irisé, nacré), 'fluo' (fluorescent), 'none' (aucun, imposé) ou '' (non indiqué : détection automatique).
  function effectOf(v) {
    var t = String(v == null ? '' : v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    if (/^(metal|metallic|metallique|metallise|metallisee)$/.test(t)) return 'metal';
    if (/^(iri|iridescent|iridescente|irise|irisee|pearl|pearlescent|nacre|nacree|interference)$/.test(t)) return 'iri';
    if (/^(fluo|fluorescent|fluorescente|neon|dayglo|day-glo)$/.test(t)) return 'fluo';
    if (/^(none|aucun|aucune|normal|non)$/.test(t)) return 'none';
    return '';
  }
  // Effet retenu pour un tube : celui qui est indiqué ; sinon, d'après le nom ou le code pigment (PM… métalliques, PW20 mica).
  // Retourne 'metal', 'iri', 'fluo' ou '' (aucun). L'indication « none » l'emporte sur la détection.
  function effectKind(t) {
    var e = effectOf(t && t.effect);
    if (e === 'metal' || e === 'iri' || e === 'fluo') return e;
    if (e === 'none') return '';
    var name = String((t && t.name) || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''), pig = String((t && t.pigment) || '');
    if (/fluo|neon|day-?glo/.test(name)) return 'fluo';
    if (/irid|irise|pearl|perle|\bnacr|interfer|shimmer/.test(name) || /(^|[^A-Za-z])PW20(?![0-9])/i.test(pig)) return 'iri';   // « \bnacr » : pas « quinacridone »
    // « (imit) » : imitation, une couleur ordinaire qui imite le métal (pas de pigment métallique) ;
    // « Green Gold », « Gold yellow », « Gold ochre » : des couleurs ordinaires dont le nom évoque l'or
    var plain = /\bimit(ation)?\b/.test(name), nm = name.replace(/\b(green|yellow|olive|brown|red|orange)\s+(gold|copper|bronze|silver)\b/g, ' ').replace(/\b(gold|copper|bronze)\s+(yellow|ochre|orange|brown|green|red)\b/g, ' ');
    if (!plain && (/metal|glitter|paillet|\b(gold|silver|copper|bronze)\b/.test(nm) || /(^|[^A-Za-z])PM[0-9]/i.test(pig))) return 'metal';
    return '';
  }

  // Un tube brut → { tube } nettoyé, ou { error } avec la raison du refus.
  function cleanTube(t, fileGroup) {
    if (!t || typeof t !== 'object' || Array.isArray(t)) return { error: 'entrée invalide (un objet est attendu)' };
    var name = str(t.name, MAX.name);
    if (!name) return { error: 'nom manquant' };
    var hex = typeof t.hex === 'string' ? parseHex(t.hex) : null;
    if (!hex) return { error: 'couleur « hex » absente ou invalide (attendu : #RRGGBB)' };
    return {
      tube: {
        name: name,
        pigment: str(t.pigment, MAX.pigment),
        hex: hex,
        light: lightOf(t.light),
        opac: opacOf(t.opac),
        effect: effectOf(t.effect),
        group: str(t.group != null && t.group !== '' ? t.group : fileGroup, MAX.group)
      }
    };
  }

  // Texte d'un fichier ou collé → { tubes, errors, groups }. Tolère les balises ```json et le texte autour (réponses d'IA).
  function parse(text) {
    var res = { tubes: [], errors: [], groups: [], fatal: '' };
    var raw = String(text == null ? '' : text).trim();
    if (!raw) { res.fatal = 'Rien à importer.'; return res; }
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
    var data;
    try { data = JSON.parse(raw); }
    catch (e) {
      var a = raw.search(/[{[]/), b = Math.max(raw.lastIndexOf('}'), raw.lastIndexOf(']'));
      try { data = a >= 0 && b > a ? JSON.parse(raw.slice(a, b + 1)) : undefined; } catch (e2) { data = undefined; }
      if (data === undefined) { res.fatal = 'JSON invalide : ' + String(e.message).slice(0, 120); return res; }
    }
    var list = Array.isArray(data) ? data : data && Array.isArray(data.tubes) ? data.tubes : null;
    if (!list) { res.fatal = 'Aucune liste « tubes » dans ce JSON.'; return res; }
    var fileGroup = !Array.isArray(data) ? str(data.group, MAX.group) : '';
    if (list.length > MAX.tubes) { res.fatal = 'Trop de tubes (' + list.length + ', maximum ' + MAX.tubes + ').'; return res; }
    var seen = {};
    list.forEach(function (raw2, i) {
      var r = cleanTube(raw2, fileGroup);
      if (r.error) { res.errors.push({ index: i + 1, name: raw2 && typeof raw2.name === 'string' ? raw2.name.slice(0, 40) : '', reason: r.error }); return; }
      var key = r.tube.group.toLowerCase() + '|' + r.tube.name.toLowerCase();
      if (seen[key]) { res.errors.push({ index: i + 1, name: r.tube.name, reason: 'doublon dans le fichier (même groupe et même nom)' }); return; }
      seen[key] = true;
      res.tubes.push(r.tube);
    });
    var gs = {};
    res.tubes.forEach(function (t) { gs[t.group] = true; });
    res.groups = Object.keys(gs);
    return res;
  }

  // Tubes de la page → objet à écrire. group : nom d'un groupe (le fichier porte alors ce groupe), '' pour « sans groupe »,
  // ou null pour tous les groupes (chaque tube porte alors son groupe).
  function build(tubes, group) {
    var out = { type: 'nuancier', version: 1 };
    if (group) out.group = group;
    out.tubes = tubes.map(function (t) {
      var o = {};
      if (group === null && t.group) o.group = t.group;
      o.name = t.name; o.pigment = t.pigment || ''; o.hex = t.hex; o.light = t.light || ''; o.opac = t.opac || '';
      if (t.effect) o.effect = t.effect;
      return o;
    });
    return out;
  }

  // Exemple fictif : sert à la documentation et au modèle téléchargeable (jamais ajouté aux tubes).
  function example() {
    return {
      type: 'nuancier', version: 1, group: 'Ma marque',
      tubes: [
        { name: 'Exemple bleu', pigment: 'PB29', hex: '#1F3A93', light: 'I', opac: 'ST' },
        { name: 'Exemple jaune', pigment: 'PY35', hex: '#F2C500', light: 'I', opac: 'O' },
        { name: 'Exemple vert (deux pigments)', pigment: 'PG7/PY3', hex: '#2E8B57', light: '', opac: '' }
      ]
    };
  }

  // Texte à donner à une IA, avec le document du fabricant, pour obtenir un fichier prêt à importer.
  function prompt() {
    return [
      'Tu prépares un nuancier de peinture au format JSON pour l’outil « Étude d’image ». À partir du document du fabricant que je te joins (tableau, PDF, texte ou capture), réponds UNIQUEMENT avec un objet JSON valide : aucun texte avant ou après, aucune balise de code.',
      '',
      'Format exact :',
      JSON.stringify({
        type: 'nuancier', version: 1, group: '<nom de la marque>',
        tubes: [{ name: '<nom commercial>', pigment: '<codes Colour Index séparés par « / », ou "">', hex: '<#RRGGBB>', light: '<I, II, III ou "">', opac: '<T, ST, SO, O ou "">', effect: '<metal, iri, fluo ou "">' }]
      }, null, 2),
      '',
      'Règles :',
      '1. N’invente JAMAIS une valeur. Un tube dont la couleur n’est pas fournie dans le document n’est pas inclus. Pour tout autre champ non fourni, mets une chaîne vide "".',
      '2. "hex" : la couleur en sRGB sur 7 caractères (#RRGGBB, majuscules). Si le document donne du RVB, convertis-le en hexadécimal. Si le document ne donne que du CMJN, convertis avec R = 255 × (1 − C) × (1 − K), et de même pour V et B, en pourcentages ramenés entre 0 et 1.',
      '3. "name" : le nom commercial tel qu’écrit dans le document, 60 caractères au maximum.',
      '4. "pigment" : le ou les codes Colour Index (ex. "PB29", "PR122/PV19"), 20 caractères au maximum.',
      '5. "light" : la durabilité sur l’échelle ASTM : "I" (excellente), "II" (très bonne) ou "III" (insuffisante). Si le fabricant utilise une autre échelle (étoiles, Blue Wool, lettres…), ne la convertis pas : "".',
      '6. "opac" : "T" (transparente), "ST" (semi-transparente), "SO" (semi-opaque) ou "O" (opaque), sinon "".',
      '7. "effect" : "metal" si le fabricant indique une peinture métallisée (or, argent, cuivre, bronze, métallique), "iri" si elle est irisée, nacrée ou à interférence, "fluo" si elle est fluorescente, sinon "" (peinture ordinaire ou non indiqué).',
      '8. "group" au niveau du fichier : la marque, 40 caractères au maximum. Si le document mélange plusieurs marques, ajoute un champ "group" dans chaque tube à la place.',
      '9. Un seul objet par tube, dans l’ordre du document, sans doublon (même nom dans le même groupe).',
      '',
      'Mon document :'
    ].join('\n');
  }

  var api = { parse: parse, build: build, cleanTube: cleanTube, effectOf: effectOf, effectKind: effectKind, example: example, prompt: prompt, MAX: MAX, LIGHT: LIGHT, OPAC: OPAC, parseHex: parseHex };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else g.Nuancier = api;
})(typeof window !== 'undefined' ? window : globalThis);
