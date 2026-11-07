/* Composer : écrire une suite d'accords (pour noter une idée ou pour avoir un accompagnement) et la jouer en boucle avec
   un groupe : un ou plusieurs instruments (guitare, piano, basse…) et la batterie.
   Expose Musique.Composer. Dépend de musique/core.js et musique/batterie.js. Il ne connaît aucun instrument en particulier :
   la page lui donne la liste de ceux qu'elle propose (voir Musique.instruments).

   Musique.Composer.mount(container, opts) construit toute l'interface et renvoie un contrôleur.
   opts : id (clé de sauvegarde, ex. « guitare »), instruments (liste), diagram (instrument dont on montre les schémas),
          onIdeas (facultatif : fonction appelée par le bouton « Besoin d'idées ? »).
   Contrôleur : setSteps(ids), getSteps(), render(), stop(), isPlaying(). */
(function () {
  'use strict';

  var M = window.Musique, el = M.el, clamp = M.clamp, D = M.Drums;
  var C = M.Composer = {};
  var MAX_STEPS = 32, BPM_MIN = 40, BPM_MAX = 220;

  C.mount = function (container, opts) {
    var instruments = opts.instruments, byId = {}, key = 'tools:' + opts.id + ':suite', chordCache = {};
    var st = { steps: [], sel: -1, bpm: 90, beats: 4, loop: true, diagram: opts.diagram || instruments[0].id, quality: 'maj', voices: {},
      playing: false, timer: null, idx: 0, stepStart: 0, evs: [], ev: 0, now: -1 };
    instruments.forEach(function (inst, i) {
      byId[inst.id] = inst;
      st.voices[inst.id] = { on: i === 0, rhythm: inst.defaultRhythm, vol: 100 };
    });

    /* ----- Accords : un accord enregistré est un identifiant ; chaque instrument en donne son doigté ----- */
    function chordOf(inst, id) {
      var k = inst.id + '|' + id, p;
      if (!(k in chordCache)) { p = M.parseChordId(id); chordCache[k] = p ? inst.chordFor(p.root, p.q) : null; }
      return chordCache[k];
    }
    function valid(id) { return instruments.some(function (inst) { return !!chordOf(inst, id); }); }
    function diagInst() { return byId[st.diagram] || instruments[0]; }
    function rhythmOf(inst, id) {
      var i;
      for (i = 0; i < inst.rhythms.length; i++) if (inst.rhythms[i].id === id) return inst.rhythms[i];
      return inst.rhythms[0];
    }

    /* ----- Sauvegarde ----- */
    function save() {
      M.store.set(key, { steps: st.steps, bpm: st.bpm, beats: st.beats, loop: st.loop, diagram: st.diagram, quality: st.quality, voices: st.voices, drums: D.data() });
    }
    function load() {
      var d = M.store.get(key, null);
      if (!d || typeof d !== 'object') return;
      if (Array.isArray(d.steps)) st.steps = d.steps.filter(valid).slice(0, MAX_STEPS);
      if (isFinite(d.bpm)) st.bpm = clamp(Math.round(d.bpm), BPM_MIN, BPM_MAX);
      if (d.beats === 2 || d.beats === 4) st.beats = d.beats;
      st.loop = d.loop !== false;
      if (byId[d.diagram]) st.diagram = d.diagram;
      if (M.QUALITY[d.quality]) st.quality = d.quality;
      if (d.voices && typeof d.voices === 'object') {
        instruments.forEach(function (inst) {
          var v = d.voices[inst.id];
          if (!v) return;
          st.voices[inst.id].on = v.on === true;
          if (inst.rhythms.some(function (r) { return r.id === v.rhythm; })) st.voices[inst.id].rhythm = v.rhythm;
          if (isFinite(v.vol)) st.voices[inst.id].vol = clamp(Math.round(v.vol), 0, 100);
        });
      }
      D.apply(d.drums);
    }
    load();

    /* ================= Interface ================= */
    var cardAdd = el('section', 'card'), cardSeq = el('section', 'card'), cardBand = el('section', 'card'), drumHost = el('div');
    var idBpm = M.uid('bpm');

    /* ----- Ajouter un accord ----- */
    cardAdd.setAttribute('aria-label', 'Ajouter un accord');
    cardAdd.appendChild(el('h2', '', 'Ajouter un accord'));
    var addBar = el('div', 'inputs'), qSeg = el('div', 'seg'), dSeg = el('div', 'seg'), grid = el('div', 'chords');
    qSeg.setAttribute('role', 'group'); qSeg.setAttribute('aria-label', 'Famille d’accords');
    dSeg.setAttribute('role', 'group'); dSeg.setAttribute('aria-label', 'Schémas affichés');
    var fq = el('div', 'field small'), fd = el('div', 'field small');
    fq.appendChild(el('span', 'lab', 'Famille')); fq.appendChild(qSeg);
    fd.appendChild(el('span', 'lab', 'Schémas'));  fd.appendChild(dSeg);
    addBar.appendChild(fq);
    if (instruments.length > 1) addBar.appendChild(fd);
    cardAdd.appendChild(addBar);
    cardAdd.appendChild(grid);
    if (opts.onIdeas) {
      var ideas = el('button', 'btn ghost', 'Besoin d’idées ? Voir les suites harmoniques');
      ideas.type = 'button';
      ideas.addEventListener('click', opts.onIdeas);
      cardAdd.appendChild(ideas);
    }

    /* ----- Ma suite d'accords ----- */
    cardSeq.setAttribute('aria-label', 'Ma suite d’accords');
    cardSeq.appendChild(el('h2', '', 'Ma suite d’accords'));
    var empty = el('p', 'muted', 'Touchez un accord ci-dessus pour l’ajouter. Écrivez une suite pour noter une idée, ou pour avoir un accompagnement : elle est gardée dans ce navigateur.');
    var seq = el('ol', 'seq'), seqText = el('p', 'seqtext'), edit = el('div', 'actions');
    seq.setAttribute('aria-label', 'Suite d’accords');
    function mk(label, aria) { var b = el('button', 'btn ghost', label); b.type = 'button'; if (aria) b.setAttribute('aria-label', aria); return b; }
    var bLeft = mk('◀', 'Déplacer l’accord choisi vers la gauche'), bRight = mk('▶', 'Déplacer l’accord choisi vers la droite');
    var bDup = mk('Dupliquer'), bDel = mk('Retirer'), bClear = mk('Tout effacer');
    [bLeft, bRight, bDup, bDel, bClear].forEach(function (b) { edit.appendChild(b); });

    var transport = el('div', 'transport'), play = el('button', 'btn play', 'Jouer'), tempo = el('div', 'tempo');
    play.type = 'button';
    var tHead = el('label', '', 'Tempo'); tHead.setAttribute('for', idBpm);
    var tRow = el('div', 'tempo-row'), bMinus = mk('−', 'Ralentir de 1'), bPlus = mk('+', 'Accélérer de 1'), bpmIn = el('input'), bTap = mk('Tap');
    var unit = el('span', 'muted', 'BPM'), slider = el('input');
    bMinus.className = bPlus.className = 'btn ghost step';
    bpmIn.type = 'number'; bpmIn.id = idBpm; bpmIn.min = String(BPM_MIN); bpmIn.max = String(BPM_MAX); bpmIn.step = '1'; bpmIn.inputMode = 'numeric';
    bTap.title = 'Tapez en rythme pour régler le tempo';
    slider.type = 'range'; slider.min = String(BPM_MIN); slider.max = String(BPM_MAX); slider.step = '1';
    slider.setAttribute('aria-label', 'Tempo');
    [bMinus, bpmIn, bPlus, unit, bTap].forEach(function (n) { tRow.appendChild(n); });
    tempo.appendChild(tHead); tempo.appendChild(tRow); tempo.appendChild(slider);

    var beatsField = el('div', 'field small'), beatsSeg = el('div', 'seg'), loopLab = el('label', 'check'), loopIn = el('input');
    beatsSeg.setAttribute('role', 'group'); beatsSeg.setAttribute('aria-label', 'Durée d’un accord');
    [2, 4].forEach(function (n) {
      var b = el('button', '', n + ' temps');
      b.type = 'button'; b.setAttribute('data-beats', n);
      b.addEventListener('click', function () { st.beats = n; syncTransport(); save(); });
      beatsSeg.appendChild(b);
    });
    beatsField.appendChild(el('span', 'lab', 'Durée d’un accord')); beatsField.appendChild(beatsSeg);
    loopIn.type = 'checkbox';
    loopLab.appendChild(loopIn); loopLab.appendChild(document.createTextNode(' Boucler'));
    [play, tempo, beatsField, loopLab].forEach(function (n) { transport.appendChild(n); });
    var hint = el('p', 'muted');

    [empty, seq, seqText, edit, transport, hint].forEach(function (n) { cardSeq.appendChild(n); });

    /* ----- Instruments ----- */
    cardBand.setAttribute('aria-label', 'Instruments');
    cardBand.appendChild(el('h2', '', 'Instruments'));
    cardBand.appendChild(el('p', 'muted', 'Cochez les instruments qui jouent la suite, puis choisissez leur rythme. Plusieurs peuvent jouer en même temps.'));
    var bandRows = el('div', 'band');
    cardBand.appendChild(bandRows);

    container.appendChild(cardAdd);
    container.appendChild(cardSeq);
    container.appendChild(cardBand);
    container.appendChild(drumHost);

    /* ----- Dessin ----- */
    function tile(inst, c) {
      var b = el('button', 'chord-btn');
      b.type = 'button';
      b.setAttribute('aria-label', 'Accord ' + M.chordTitle(c));
      b.appendChild(el('b', '', M.chordTitle(c)));
      if (inst.diagram) b.appendChild(inst.diagram(c));
      return b;
    }

    function renderPalette() {
      var inst = diagInst();
      qSeg.replaceChildren(); dSeg.replaceChildren(); grid.replaceChildren();
      if (inst.qualities.indexOf(st.quality) < 0) st.quality = inst.qualities[0];
      inst.qualities.forEach(function (q) {
        var b = el('button', '', M.QUALITY[q].plural);
        b.type = 'button';
        b.setAttribute('aria-pressed', String(q === st.quality));
        b.addEventListener('click', function () { st.quality = q; renderPalette(); save(); });
        qSeg.appendChild(b);
      });
      instruments.forEach(function (i) {
        var b = el('button', '', i.name);
        b.type = 'button';
        b.setAttribute('aria-pressed', String(i.id === st.diagram));
        b.addEventListener('click', function () { st.diagram = i.id; render(); save(); });
        dSeg.appendChild(b);
      });
      M.ROOTS.forEach(function (root) {
        var c = inst.chordFor(root, st.quality);
        if (!c) return;
        var b = tile(inst, c);
        b.addEventListener('click', function () { add(c.id); });
        grid.appendChild(b);
      });
    }

    function markNow(idx) {
      st.now = idx;
      Array.prototype.forEach.call(seq.querySelectorAll('.slot'), function (b, i) { b.classList.toggle('now', i === idx); });
    }

    function renderSeq() {
      var has = st.steps.length > 0, sel = st.sel >= 0, inst = diagInst();
      seq.replaceChildren();
      st.steps.forEach(function (id, i) {
        var c = chordOf(inst, id) || chordOf(instruments[0], id), li = el('li'), b = el('button', 'slot');
        b.type = 'button';
        b.setAttribute('aria-pressed', String(i === st.sel));
        b.setAttribute('aria-label', 'Accord ' + (i + 1) + ' : ' + M.chordTitle(c));
        b.appendChild(el('span', 'num', String(i + 1)));
        b.appendChild(el('b', '', M.chordTitle(c)));
        if (inst.diagram && chordOf(inst, id)) b.appendChild(inst.diagram(c));
        b.addEventListener('click', function () { st.sel = i; renderSeq(); preview(id); });
        li.appendChild(b);
        seq.appendChild(li);
      });
      if (st.playing) markNow(st.now);
      empty.hidden = has;
      seq.hidden = seqText.hidden = edit.hidden = !has;
      seqText.textContent = st.steps.map(function (id) { return M.chordTitle(chordOf(inst, id) || chordOf(instruments[0], id)); }).join(' – ');
      bLeft.disabled = !sel || st.sel === 0;
      bRight.disabled = !sel || st.sel === st.steps.length - 1;
      bDup.disabled = bDel.disabled = !sel;
      bClear.disabled = !has;
      syncTransport();
    }

    function hasSound() {
      return D.state.on || instruments.some(function (i) { return st.voices[i.id].on; });
    }
    function syncTransport() {
      var has = st.steps.length > 0;
      bpmIn.value = st.bpm;
      slider.value = st.bpm;
      loopIn.checked = st.loop;
      M.setPressed(beatsSeg.querySelectorAll('button'), function (b) { return Number(b.getAttribute('data-beats')) === st.beats; });
      play.disabled = !has && !st.playing;
      hint.textContent = !hasSound() ? 'Aucun son : cochez un instrument ou la batterie.' : '';
    }

    function renderBand() {
      bandRows.replaceChildren();
      instruments.forEach(function (inst) {
        var v = st.voices[inst.id], row = el('div', 'brow'), lab = el('label', 'check'), on = el('input'), sel = el('select'), vol = el('input');
        var idSel = M.uid('rh'), f1 = el('div', 'field'), f2 = el('div', 'field');
        on.type = 'checkbox'; on.checked = v.on;
        lab.appendChild(on); lab.appendChild(el('b', '', ' ' + inst.name));
        on.addEventListener('change', function () { v.on = on.checked; row.classList.toggle('off', !v.on); syncTransport(); save(); });
        sel.id = idSel;
        inst.rhythms.forEach(function (r) { var o = el('option', '', r.name); o.value = r.id; sel.appendChild(o); });
        sel.value = v.rhythm;
        sel.addEventListener('change', function () { v.rhythm = sel.value; save(); });
        f1.appendChild(el('label', '', 'Rythme de ' + inst.name.toLowerCase())); f1.firstChild.setAttribute('for', idSel); f1.appendChild(sel);
        vol.type = 'range'; vol.min = '0'; vol.max = '100'; vol.step = '1'; vol.value = v.vol;
        vol.setAttribute('aria-label', 'Volume : ' + inst.name);
        vol.addEventListener('input', function () { v.vol = Number(vol.value); applyVolumes(); save(); });
        f2.className = 'field vol';
        f2.appendChild(el('label', '', 'Volume')); f2.appendChild(vol);
        row.className = 'brow' + (v.on ? '' : ' off');
        row.appendChild(lab); row.appendChild(f1); row.appendChild(f2);
        bandRows.appendChild(row);
      });
    }

    function render() { renderPalette(); renderSeq(); renderBand(); drums.render(); }

    /* ----- Son ----- */
    function applyVolumes() {
      if (!M.audioReady()) return;
      instruments.forEach(function (inst) { var b = M.bus(inst.id); if (b) b.gain.value = st.voices[inst.id].vol / 100; });
    }
    /* Écoute un accord avec les instruments cochés (ou, à défaut, celui dont on voit les schémas) */
    function preview(id) {
      if (!M.audio()) return;
      applyVolumes();
      var list = instruments.filter(function (i) { return st.voices[i.id].on; }), t = M.audio().currentTime + 0.02;
      if (!list.length) list = [diagInst()];
      list.forEach(function (inst) { var c = chordOf(inst, id); if (c) inst.chord(c, t, 1); });
    }

    /* ----- Édition de la suite ----- */
    function add(id) {
      if (st.steps.length >= MAX_STEPS) return;
      st.steps.push(id);
      st.sel = st.steps.length - 1;
      renderSeq();
      save();
      preview(id);
    }
    bLeft.addEventListener('click', function () { var s = st.steps, i = st.sel, t = s[i]; s[i] = s[i - 1]; s[i - 1] = t; st.sel--; renderSeq(); save(); });
    bRight.addEventListener('click', function () { var s = st.steps, i = st.sel, t = s[i]; s[i] = s[i + 1]; s[i + 1] = t; st.sel++; renderSeq(); save(); });
    bDup.addEventListener('click', function () {
      if (st.steps.length >= MAX_STEPS) return;
      st.steps.splice(st.sel + 1, 0, st.steps[st.sel]); st.sel++; renderSeq(); save();
    });
    bDel.addEventListener('click', function () {
      st.steps.splice(st.sel, 1);
      st.sel = Math.min(st.sel, st.steps.length - 1);
      renderSeq(); save();
    });
    bClear.addEventListener('click', function () { stop(); st.steps = []; st.sel = -1; renderSeq(); save(); });

    /* ----- Tempo ----- */
    function setBpm(v) {
      if (!isFinite(v)) return;
      st.bpm = clamp(Math.round(v), BPM_MIN, BPM_MAX);
      bpmIn.value = st.bpm;
      slider.value = st.bpm;
      save();
    }
    bMinus.addEventListener('click', function () { setBpm(st.bpm - 1); });
    bPlus.addEventListener('click', function () { setBpm(st.bpm + 1); });
    slider.addEventListener('input', function () { setBpm(Number(slider.value)); });
    bpmIn.addEventListener('input', function () { var v = Number(bpmIn.value); if (isFinite(v) && v >= BPM_MIN && v <= BPM_MAX) { st.bpm = Math.round(v); slider.value = st.bpm; save(); } });
    bpmIn.addEventListener('change', function () { setBpm(Number(bpmIn.value) || st.bpm); });
    var taps = [];
    bTap.addEventListener('click', function () {
      var now = performance.now();
      if (taps.length && now - taps[taps.length - 1] > 2000) taps = [];
      taps.push(now);
      if (taps.length > 6) taps.shift();
      if (taps.length >= 2) setBpm(60000 * (taps.length - 1) / (taps[taps.length - 1] - taps[0]));
    });
    loopIn.addEventListener('change', function () { st.loop = loopIn.checked; save(); });

    /* ----- Lecture ----- */
    /* Coups d'un accord pour tous les instruments cochés, plus ceux de la batterie, triés par instant.
       p0 : position (en temps) de ce passage dans la mesure, pour que la batterie reste calée sur les mesures. */
    function stepEvents(id, beats, p0) {
      var evs = [];
      instruments.forEach(function (inst) {
        var v = st.voices[inst.id], c;
        if (!v.on) return;
        c = chordOf(inst, id);
        if (!c) return;
        rhythmOf(inst, v.rhythm).events(c, beats).forEach(function (e) { e.voice = inst; e.chord = c; evs.push(e); });
      });
      if (D.state.on) D.events(p0, beats).forEach(function (e) { evs.push(e); });
      return evs.sort(function (a, b) { return a.at - b.at; });
    }

    function loadStep() {
      if (st.idx >= st.steps.length) st.idx = 0;
      if (!st.steps.length) { stop(); return; }
      st.evs = stepEvents(st.steps[st.idx], st.beats, (st.idx * st.beats) % 4);
      st.ev = 0;
      var idx = st.idx;
      setTimeout(function () { if (st.playing) markNow(idx); }, Math.max(0, (st.stepStart - M.audio().currentTime) * 1000));
    }

    /* Planificateur : programme à l'avance (150 ms) les coups à venir sur l'horloge audio, ce qui garde un rythme régulier */
    function tick() {
      var ctx = M.audio(), spb = 60 / st.bpm, horizon = ctx.currentTime + 0.15, e, t, end;
      for (;;) {
        if (st.ev >= st.evs.length) {
          end = st.stepStart + st.beats * spb;
          if (end >= horizon) return;
          if (st.idx + 1 >= st.steps.length) {
            if (!st.loop) { stop(); return; }
            st.idx = -1;
          }
          st.idx++;
          st.stepStart = end;
          loadStep();
          if (!st.playing) return;
          continue;
        }
        e = st.evs[st.ev];
        t = st.stepStart + e.at * spb;
        if (t >= horizon) return;
        if (e.drum) D.play(e.drum, t, e.vol); else e.voice.play(e, e.chord, t, spb);
        st.ev++;
      }
    }

    function start() {
      var ctx = M.audio();
      if (!st.steps.length || !ctx) return;
      if (D.isLooping && D.isLooping()) D.stopLoop();
      applyVolumes();
      st.idx = 0;
      st.stepStart = ctx.currentTime + 0.1;
      st.playing = true;
      loadStep();
      st.timer = setInterval(tick, 25);
      play.textContent = 'Arrêter';
    }
    function stop() {
      st.playing = false;
      if (st.timer) { clearInterval(st.timer); st.timer = null; }
      markNow(-1);
      play.textContent = 'Jouer';
    }
    play.addEventListener('click', function () { if (st.playing) stop(); else start(); });
    window.addEventListener('pagehide', stop);

    /* ----- Batterie ----- */
    var drums = D.mount(drumHost, {
      getTempo: function () { return st.bpm; },
      onChange: function () { syncTransport(); save(); },
      beforePlay: function () { stop(); },
      onSuggest: function (style) {
        setBpm(style.bpm);
        instruments.forEach(function (inst) {
          var r = style.accomp && style.accomp[inst.id];
          if (r && inst.rhythms.some(function (x) { return x.id === r; })) st.voices[inst.id].rhythm = r;
        });
        renderBand();
        save();
      }
    });

    M.onNotation(function () { renderPalette(); renderSeq(); });
    render();

    return {
      setSteps: function (ids) {
        stop();
        st.steps = ids.filter(valid).slice(0, MAX_STEPS);
        st.sel = -1;
        renderSeq();
        save();
      },
      getSteps: function () { return st.steps.slice(); },
      getTempo: function () { return st.bpm; },
      render: render,
      stop: stop,
      isPlaying: function () { return st.playing; }
    };
  };
})();
