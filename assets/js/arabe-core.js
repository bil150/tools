/* Arabe : données et outils communs aux pages (syllabes, cartes, dictée, écriture).
   Expose window.Arabe. Aucune dépendance. */
(function () {
  'use strict';

  /* ---------- Signes ---------- */
  var F = 'َ', D = 'ُ', K = 'ِ', FT = 'ً', DT = 'ٌ', KT = 'ٍ', SU = 'ْ', SH = 'ّ';
  var ALIF = 'ا', WAW = 'و', YA = 'ي';
  var ZWJ = '‍';

  /* ---------- Le tableau du livre ---------- */
  var LETTERS = [
    { ch: 'ب', tr: 'b', n: 'bâ' },
    { ch: 'ت', tr: 't', n: 'tâ' },
    { ch: 'ث', tr: 'th', n: 'thâ' }
  ];
  var ROWS = [
    { id: 'fatha', name: 'Fatha', hint: '« a » bref', mk: function (l) { return { parts: [[l.ch + F]], tr: l.tr + 'a' }; } },
    { id: 'damma', name: 'Damma', hint: '« ou » bref', mk: function (l) { return { parts: [[l.ch + D]], tr: l.tr + 'ou' }; } },
    { id: 'kasra', name: 'Kasra', hint: '« i » bref', mk: function (l) { return { parts: [[l.ch + K]], tr: l.tr + 'i' }; } },
    { id: 'tfatha', name: 'Tanwîn fatha', hint: '« an »', mk: function (l) { return { parts: [[l.ch + (l.noAlif ? '' : ALIF) + FT]], tr: l.tr + 'an' }; } },
    { id: 'tdamma', name: 'Tanwîn damma', hint: '« oun »', mk: function (l) { return { parts: [[l.ch + DT]], tr: l.tr + 'oun' }; } },
    { id: 'tkasra', name: 'Tanwîn kasra', hint: '« in »', mk: function (l) { return { parts: [[l.ch + KT]], tr: l.tr + 'in' }; } },
    { id: 'alif', name: 'Alif', hint: '« â » long', mk: function (l) { return { parts: [[l.ch + F], [ALIF, 1]], tr: l.tr + 'â' }; } },
    { id: 'waw', name: 'Waw', hint: '« oû » long', mk: function (l) { return { parts: [[l.ch + D], [WAW, 1]], tr: l.tr + 'oû' }; } },
    { id: 'ya', name: 'Ya', hint: '« î » long', mk: function (l) { return { parts: [[l.ch + K], [YA, 1]], tr: l.tr + 'î' }; } },
    { id: 'sukun', name: 'Soukoun', hint: 'sans voyelle', mk: function (l) { return { parts: [[l.ch + SU]], tr: l.tr }; } },
    { id: 'shadda', name: 'Chadda', hint: 'lettre doublée', mk: function (l) { return { parts: [[l.ch + SH + F]], tr: l.tr + l.tr + 'a' }; } }
  ];
  var WORDS = [
    { parts: [['ب' + F], [ALIF, 1], ['ت' + F]], tr: 'bâta', fr: 'il a passé la nuit' },
    { parts: [['ت' + F], [ALIF, 1], ['ب' + F]], tr: 'tâba', fr: 'il s’est repenti' },
    { parts: [['ث' + D + 'ب' + D], [WAW, 1], ['ت' + DT]], tr: 'thouboût', fr: 'la preuve, la fermeté' }
  ];
  /* Mots d'entraînement en plus du tableau : uniquement les lettres du livre (ب ت ث)
     avec les voyelles, tanwîn, chadda et lettres de prolongation déjà étudiés. */
  var MORE_WORDS = [
    { parts: [['ب' + F], [ALIF, 1], ['ب' + DT]], tr: 'bâb', fr: 'la porte' },
    { parts: [['ت' + D], [WAW, 1], ['ت' + DT]], tr: 'toût', fr: 'la mûre' },
    { parts: [['أ' + F + 'ث' + F], [ALIF, 1], ['ث' + DT]], tr: 'athâth', fr: 'les meubles' },
    { parts: [['أ' + F + 'ب' + DT]], tr: 'ab', fr: 'le père' },
    { parts: [['ث' + F + 'ب' + F], [ALIF, 1], ['ت' + DT]], tr: 'thabât', fr: 'la stabilité' },
    { parts: [['ب' + F + 'ث' + SH + F]], tr: 'baththa', fr: 'il a diffusé' },
    { parts: [['ث' + F + 'ب' + F + 'ت' + F]], tr: 'thabata', fr: 'il est resté ferme' },
    { parts: [['ث' + F], [ALIF, 1], ['ب' + K + 'ت' + DT]], tr: 'thâbit', fr: 'stable, ferme' }
  ];

  function textOf(parts) { return parts.map(function (p) { return p[0]; }).join(''); }
  function wordItem(w, extra) {
    var item = { kind: 'word', parts: w.parts, tr: w.tr, text: textOf(w.parts), rowId: 'word', fr: w.fr, desc: w.fr };
    for (var k in extra) item[k] = extra[k];
    return item;
  }

  var GRID = [];  // GRID[r][c]
  var SYLS = [];  // toutes les syllabes du tableau
  ROWS.forEach(function (row, r) {
    GRID[r] = [];
    LETTERS.forEach(function (l, c) {
      var m = row.mk(l);
      var item = { kind: 'syl', parts: m.parts, tr: m.tr, text: textOf(m.parts), r: r, c: c, rowId: row.id, desc: row.name + ' · ' + row.hint };
      GRID[r][c] = item;
      SYLS.push(item);
    });
  });
  GRID[ROWS.length] = WORDS.map(function (w, c) { return wordItem(w, { r: ROWS.length, c: c }); });
  var WORD_ITEMS = GRID[ROWS.length];
  var QUIZ_WORDS = WORD_ITEMS.concat(MORE_WORDS.map(function (w) { return wordItem(w); }));
  var NROWS = ROWS.length + 1;

  /* ---------- Alphabet complet (ordre arabe) ----------
     ch : base des variations ; nj : ne se lie pas à la lettre suivante ;
     dots : [nombre de points, position] pour l'écriture à la main */
  var ALPHA = [
    { disp: 'ا', ch: 'أ', tr: 'ʾ', n: 'alif', noAlif: true, nj: true, dots: [0] },
    { disp: 'ب', tr: 'b', n: 'bâ', dots: [1, 'dessous'] },
    { disp: 'ت', tr: 't', n: 'tâ', dots: [2, 'dessus'] },
    { disp: 'ث', tr: 'th', n: 'thâ', dots: [3, 'dessus'] },
    { disp: 'ج', tr: 'dj', n: 'djîm', dots: [1, 'dessous'] },
    { disp: 'ح', tr: 'ḥ', n: 'ḥâ', dots: [0] },
    { disp: 'خ', tr: 'kh', n: 'khâ', dots: [1, 'dessus'] },
    { disp: 'د', tr: 'd', n: 'dâl', nj: true, dots: [0] },
    { disp: 'ذ', tr: 'dh', n: 'dhâl', nj: true, dots: [1, 'dessus'] },
    { disp: 'ر', tr: 'r', n: 'râ', nj: true, dots: [0] },
    { disp: 'ز', tr: 'z', n: 'zây', nj: true, dots: [1, 'dessus'] },
    { disp: 'س', tr: 's', n: 'sîn', dots: [0] },
    { disp: 'ش', tr: 'ch', n: 'chîn', dots: [3, 'dessus'] },
    { disp: 'ص', tr: 'ṣ', n: 'ṣâd', dots: [0] },
    { disp: 'ض', tr: 'ḍ', n: 'ḍâd', dots: [1, 'dessus'] },
    { disp: 'ط', tr: 'ṭ', n: 'ṭâ', dots: [0] },
    { disp: 'ظ', tr: 'ẓ', n: 'ẓâ', dots: [1, 'dessus'] },
    { disp: 'ع', tr: 'ʿ', n: 'ʿayn', dots: [0] },
    { disp: 'غ', tr: 'gh', n: 'ghayn', dots: [1, 'dessus'] },
    { disp: 'ف', tr: 'f', n: 'fâ', dots: [1, 'dessus'] },
    { disp: 'ق', tr: 'q', n: 'qâf', dots: [2, 'dessus'] },
    { disp: 'ك', tr: 'k', n: 'kâf', dots: [0] },
    { disp: 'ل', tr: 'l', n: 'lâm', dots: [0] },
    { disp: 'م', tr: 'm', n: 'mîm', dots: [0] },
    { disp: 'ن', tr: 'n', n: 'noûn', dots: [1, 'dessus'] },
    { disp: 'ه', tr: 'h', n: 'hâ', dots: [0] },
    { disp: 'و', tr: 'w', n: 'wâw', nj: true, dots: [0] },
    { disp: 'ي', tr: 'y', n: 'yâ', dots: [2, 'dessous'] }
  ];
  ALPHA.forEach(function (l) { if (!l.ch) l.ch = l.disp; });

  function variationsFor(l) {
    return ROWS.map(function (row, r) {
      var m = row.mk(l);
      return { kind: 'syl', parts: m.parts, tr: m.tr, text: textOf(m.parts), r: r, rowId: row.id, desc: row.name + ' · ' + row.hint };
    });
  }

  /* ---------- Petits outils ---------- */
  function h(tag, cls, text) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  }
  /* Texte arabe d'un élément ; les lettres de prolongation portent la classe « lv » */
  function arEl(item, cls) {
    var s = h('span', 'ar' + (cls ? ' ' + cls : ''));
    s.lang = 'ar';
    s.dir = 'rtl';
    item.parts.forEach(function (p) { s.appendChild(h('span', p[1] ? 'lv' : null, p[0])); });
    return s;
  }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ---------- Voix (synthèse vocale du système) ----------
     opts.onSpeaking(bool) : la voix parle ou s'arrête ; opts.onError(message | '') */
  var ERR = {
    'language-unavailable': 'Cet appareil n’a pas de voix arabe. Installez-en une dans les réglages de synthèse vocale.',
    'voice-unavailable': 'La voix choisie n’est pas disponible. Choisissez une autre voix arabe dans la liste.',
    'not-allowed': 'Le navigateur a bloqué le son. Touchez de nouveau le bouton.',
    'synthesis-unavailable': 'La synthèse vocale est indisponible ici. Essayez avec Chrome ou Safari.',
    'synthesis-failed': 'La synthèse vocale a échoué. Essayez avec Chrome ou Safari.',
    'silent': 'Pas de son ? Vérifiez le volume et le mode silencieux, puis qu’une voix arabe est installée.',
    'other': 'Le son n’a pas pu démarrer.'
  };

  function createVoice(opts) {
    var synth = window.speechSynthesis;
    var can = !!(synth && window.SpeechSynthesisUtterance);
    var chosen = null, current = null;
    var onSpeaking = (opts && opts.onSpeaking) || function () {};
    var onError = (opts && opts.onError) || function () {};

    function speak(text, rate, done) {
      if (!can) { if (done) done(); return; }
      try { synth.cancel(); } catch (e) { /* rien */ }
      var u = new SpeechSynthesisUtterance(text), started = false;
      u.lang = chosen ? chosen.lang : 'ar-SA';
      if (chosen) u.voice = chosen;
      u.rate = rate || 0.75;
      current = u;
      u.onstart = function () { started = true; onError(''); if (current === u) onSpeaking(true); };
      u.onend = function () { if (current === u) { onSpeaking(false); if (done) done(true); } };
      u.onerror = function (ev) {
        if (current !== u) return;
        onSpeaking(false);
        var code = ev && ev.error;
        if (code !== 'canceled' && code !== 'interrupted') onError(ERR[code] || ERR.other);
        if (done) done(false);
      };
      setTimeout(function () {
        if (current !== u) return;
        try { synth.resume(); } catch (e) { /* rien */ }
        synth.speak(u);
      }, 40);
      setTimeout(function () { if (current === u && !started) onError(ERR.silent); }, 2500);
    }

    function stop() {
      current = null;
      onSpeaking(false);
      try { if (synth) synth.cancel(); } catch (e) { /* rien */ }
    }

    /* Liste des voix arabes : els = { select, field, notice } (éléments du DOM) */
    function bind(els) {
      if (!can) return;
      function load() {
        var all = synth.getVoices();
        if (!all.length) return;
        var vs = all.filter(function (v) { return /^ar([-_]|$)/i.test(v.lang); });
        var keep = chosen ? chosen.voiceURI : null;
        els.select.innerHTML = '';
        if (els.notice) els.notice.hidden = vs.length > 0;
        if (!vs.length) { if (els.field) els.field.hidden = true; return; }
        vs.sort(function (a, b) { return a.name.localeCompare(b.name); });
        vs.forEach(function (v) {
          var o = document.createElement('option');
          o.value = v.voiceURI;
          o.textContent = v.name + ' (' + v.lang + ')';
          els.select.appendChild(o);
        });
        chosen = vs.filter(function (v) { return v.voiceURI === keep; })[0] || vs[0];
        els.select.value = chosen.voiceURI;
        if (els.field) els.field.hidden = false;
      }
      els.select.addEventListener('change', function () {
        var list = synth.getVoices();
        for (var k = 0; k < list.length; k++) if (list[k].voiceURI === els.select.value) chosen = list[k];
        if (opts && opts.onVoiceChange) opts.onVoiceChange();
      });
      load();
      if (typeof synth.addEventListener === 'function') synth.addEventListener('voiceschanged', load);
      else synth.onvoiceschanged = load;
    }

    return { canSpeak: can, speak: speak, stop: stop, bind: bind };
  }

  window.Arabe = {
    F: F, D: D, K: K, FT: FT, DT: DT, KT: KT, SU: SU, SH: SH, ALIF: ALIF, WAW: WAW, YA: YA, ZWJ: ZWJ,
    LETTERS: LETTERS, ROWS: ROWS, GRID: GRID, SYLS: SYLS, WORD_ITEMS: WORD_ITEMS, QUIZ_WORDS: QUIZ_WORDS, NROWS: NROWS,
    ALPHA: ALPHA, textOf: textOf, variationsFor: variationsFor, h: h, arEl: arEl, shuffle: shuffle, createVoice: createVoice
  };
})();
