/* Lecture du texte d'un tube dans un nuancier (sans DOM, sans dépendance).
   Reçoit les lignes de texte d'une zone (extraites d'un PDF) et en tire, pour UN tube :
   le nom, le code pigment (Colour Index : PB29, PBr7, PR122…), la durabilité (échelle ASTM I à III)
   et la transparence / opacité (T, ST, SO, O). Ce qui n'est pas reconnu reste vide : rien n'est deviné. */
(function (g) {
  'use strict';

  // Colour Index : P + famille (B bleu, Br brun, Bk noir, G vert, O orange, R rouge, V violet, W blanc, Y jaune, M métal) + numéro.
  var PIGMENT = /\bP(Br|Bk|B|G|O|R|V|W|Y|M)\s?-?\s?(\d{1,3}(?::\d)?)(?!\d)/gi;

  // « ASTM I », « LF : II », « Lightfastness III », « Solidité à la lumière 2 »…
  var LIGHT = /(?:ASTM|\bLF\b|L\.F\.|light\s*-?\s*fast\w*|solidit[ée]\w*(?:\s+à\s+la\s+lumi[èe]re)?|durabilit[ée]\w*)\W{0,15}?(III|II|I|3|2|1)(?![A-Za-z0-9])/gi;

  var LABELS = /\b(?:transparen(?:cy|ce)|opacit(?:y|é))\b\W{0,6}(ST|SO|T|O)\b/gi;   // « Opacity : ST », « Opacité : SO »
  var WORDS = /\b(?:semi[\s-]?opa(?:que|co)|semi[\s-]?transparent[es]?|semi[\s-]?transluc\w*|translucide?s?|translucent|opaque[s]?|opaco|transparent[es]?|transparente?s?)\b/gi;

  function normPigment(fam, num) {
    fam = fam.toLowerCase();
    return 'P' + (fam === 'br' ? 'Br' : fam === 'bk' ? 'Bk' : fam.toUpperCase()) + num;
  }

  function lightCode(v) { return { 1: 'I', 2: 'II', 3: 'III', I: 'I', II: 'II', III: 'III' }[String(v).toUpperCase()] || ''; }

  function opacityOf(text) {
    var m, t = text.toLowerCase();
    if (/semi[\s-]?opa(?:que|co)/.test(t)) return 'SO';
    if (/semi[\s-]?transparent|semi[\s-]?transluc|translucide?|translucent/.test(t)) return 'ST';
    if (/\bopaque|\bopaco/.test(t)) return 'O';
    if (/\btransparent/.test(t)) return 'T';
    LABELS.lastIndex = 0;
    m = LABELS.exec(text);                       // abréviation seulement quand elle suit un libellé
    if (m) return m[1];
    if (/(^|[^A-Za-z])ST([^A-Za-z]|$)/.test(text)) return 'ST';   // « ST » et « SO » isolés, en majuscules
    if (/(^|[^A-Za-z])SO([^A-Za-z]|$)/.test(text)) return 'SO';
    return '';
  }

  // lines : tableau de chaînes (une par ligne de texte de la zone, de haut en bas).
  function parseTubeText(lines) {
    lines = (lines || []).map(function (l) { return String(l).replace(/\s+/g, ' ').trim(); }).filter(Boolean);
    var all = lines.join(' \n ');
    var out = { name: '', pigment: '', light: '', opac: '' };

    var codes = [], m;
    PIGMENT.lastIndex = 0;
    while ((m = PIGMENT.exec(all))) {
      var c = normPigment(m[1], m[2].replace(/\s/g, ''));
      if (codes.indexOf(c) === -1) codes.push(c);
    }
    out.pigment = codes.slice(0, 3).join('/').slice(0, 20);

    LIGHT.lastIndex = 0;
    m = LIGHT.exec(all);
    if (m) out.light = lightCode(m[1]);

    out.opac = opacityOf(all);

    // Nom : la première ligne qui garde des lettres une fois les informations reconnues retirées.
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i]
        .replace(PIGMENT, ' ').replace(LIGHT, ' ').replace(LABELS, ' ').replace(WORDS, ' ')
        .replace(/\b(?:ASTM|lightfast\w*|pigments?|opacit(?:y|é)|transparen(?:cy|ce)|solidit[ée]\w*|durabilit[ée]\w*)\b\s*:?/gi, ' ')
        .replace(/^\s*(?:nom|name|couleur|colou?r)\s*:\s*/i, '')
        .replace(/[|•·•·()[\]{}]/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/^[\s\-–—:;,./]+|[\s\-–—:;,./]+$/g, '');
      if (/[A-Za-zÀ-ÿ]{3,}/.test(l)) { out.name = l.slice(0, 60); break; }
    }
    return out;
  }

  var api = { parseTubeText: parseTubeText };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else g.LectureTube = api;
})(typeof window !== 'undefined' ? window : globalThis);
