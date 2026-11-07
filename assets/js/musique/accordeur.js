/* Accordeur : microphone analysé dans le navigateur (détection de hauteur YIN) et notes de référence.
   Expose Musique.Tuner. Dépend de musique/core.js. Rien n'est enregistré ni envoyé.

   Musique.Tuner.mount(container, opts) construit l'onglet.
   opts : tunings : [{ midi : numéros MIDI des cordes (de la plus grave à la plus aiguë), names : leurs noms (« E♭ »),
          label : nom de l'accordage (facultatif, « Standard » par défaut) }]. */
(function () {
  'use strict';

  var M = window.Musique, el = M.el, clamp = M.clamp;
  var T = M.Tuner = {};

  /* ================= Détection de hauteur (YIN) ================= */
  /* buf : échantillons du micro ; fmin, fmax : plage cherchée en Hz ; renvoie la fréquence fondamentale en Hz, ou −1. */
  T.detectPitch = function (buf, sr, fmin, fmax) {
    var W = buf.length >> 1;
    var minTau = Math.max(2, Math.floor(sr / fmax)), maxTau = Math.min(W - 1, Math.floor(sr / fmin));
    var d = new Float32Array(maxTau + 1), run = 0, tau, j, sum, diff;
    d[0] = 1;
    for (tau = 1; tau <= maxTau; tau++) {
      sum = 0;
      for (j = 0; j < W; j++) { diff = buf[j] - buf[j + tau]; sum += diff * diff; }
      run += sum;
      d[tau] = run ? sum * tau / run : 1;
    }
    var best = -1;
    for (tau = minTau; tau < maxTau; tau++) {
      if (d[tau] < 0.15) {
        while (tau + 1 < maxTau && d[tau + 1] < d[tau]) tau++;
        best = tau;
        break;
      }
    }
    if (best < 0) return -1;
    var a = d[best - 1], b = d[best], c = d[best + 1], den = a - 2 * b + c;
    return sr / (best + (den ? (a - c) / (2 * den) : 0));
  };

  T.mount = function (container, opts) {
    var tunings = opts.tunings;
    var st = { tuning: 0, refA: 440, auto: true, target: 0, stream: null, src: null, analyser: null, buf: null, timer: null, hist: [], lastGood: 0, tone: null };
    var ctx = null;

    /* ----- Construction ----- */
    var card = el('div', 'card'), inputs = el('div', 'inputs'), idTun = M.uid('tun'), idRef = M.uid('ref'), idMode = M.uid('tmode');
    var fTun = el('div', 'field'), fRef = el('div', 'field small'), fMode = el('div', 'field small');
    var selTun = el('select'), ref = el('input'), modeSeg = el('div', 'seg');
    var mic = el('button', 'btn start', 'Activer le microphone'), err = el('p', 'err');
    var reading = el('div', 'reading'), note = el('span', 'big-note', '—'), cents = el('span', 'cents'), freq = el('span', 'muted');
    var gauge = el('div', 'gauge'), zone = el('span', 'zone'), midMark = el('span', 'mid'), needle = el('i', 'needle');
    var status = el('p', 'status', 'Activez le microphone, puis pincez une corde.'), strings = el('div', 'tstrings');

    selTun.id = idTun;
    fTun.appendChild(el('label', '', 'Accordage')); fTun.firstChild.setAttribute('for', idTun); fTun.appendChild(selTun);
    ref.type = 'number'; ref.id = idRef; ref.min = '415'; ref.max = '466'; ref.step = '1'; ref.value = '440'; ref.inputMode = 'numeric';
    fRef.appendChild(el('label', '', 'La de référence (Hz)')); fRef.firstChild.setAttribute('for', idRef); fRef.appendChild(ref);
    modeSeg.setAttribute('role', 'group'); modeSeg.setAttribute('aria-labelledby', idMode);
    var mLab = el('span', 'lab', 'Corde visée'); mLab.id = idMode;
    [['auto', 'Auto'], ['manual', 'Manuelle']].forEach(function (m) {
      var b = el('button', '', m[1]);
      b.type = 'button'; b.setAttribute('data-tmode', m[0]);
      b.setAttribute('aria-pressed', String(m[0] === 'auto'));
      b.addEventListener('click', function () {
        st.auto = m[0] === 'auto';
        M.setPressed(modeSeg.querySelectorAll('button'), function (x) { return x === b; });
        markTarget(-1);
      });
      modeSeg.appendChild(b);
    });
    fMode.appendChild(mLab); fMode.appendChild(modeSeg);
    inputs.appendChild(fTun); inputs.appendChild(fRef); inputs.appendChild(fMode);
    mic.type = 'button';
    err.setAttribute('role', 'alert'); err.hidden = true;
    reading.appendChild(note); reading.appendChild(cents); reading.appendChild(freq);
    gauge.className = 'gauge'; gauge.setAttribute('aria-hidden', 'true');
    gauge.appendChild(zone); gauge.appendChild(midMark); gauge.appendChild(needle);
    status.setAttribute('aria-live', 'polite');
    [inputs, mic, err, reading, gauge, status, strings,
      el('p', 'muted', 'Touchez une corde pour entendre la note de référence (et la viser en mode manuel). Le microphone est utilisé uniquement dans cette page : le son n’est ni enregistré ni envoyé.')
    ].forEach(function (n) { card.appendChild(n); });
    container.appendChild(card);

    /* ----- Calculs ----- */
    function cur() { return tunings[st.tuning]; }
    function tuningLabel(i) { var t = tunings[i]; return (t.label || 'Standard') + ' (' + t.names.map(M.fmtName).join(' ') + ')'; }
    function stringFreq(i) { return M.freqOf(cur().midi[i], st.refA); }
    function noteLabel(i) { return M.fmtName(cur().names[i]) + (Math.floor(cur().midi[i] / 12) - 1); }
    function fmtHz(f) { return f.toFixed(1).replace('.', ',') + ' Hz'; }
    /* Plage cherchée : un peu en dessous de la corde la plus grave, jusqu'à bien au-dessus de la plus aiguë */
    function range() {
      var mi = cur().midi;
      return [Math.max(25, 0.8 * M.freqOf(mi[0], st.refA)), 1.8 * M.freqOf(mi[mi.length - 1], st.refA)];
    }

    /* ----- Affichage ----- */
    function renderStrings() {
      var i, n = cur().midi.length;
      selTun.replaceChildren();
      tunings.forEach(function (t, k) { var o = el('option', '', tuningLabel(k)); o.value = k; selTun.appendChild(o); });
      selTun.value = st.tuning;
      strings.replaceChildren();
      strings.style.setProperty('--n', n);
      for (i = 0; i < n; i++) {
        (function (i) {
          var b = el('button', 'tstr');
          b.type = 'button';
          b.appendChild(el('small', '', 'Corde ' + (n - i)));
          b.appendChild(el('b', '', noteLabel(i)));
          b.addEventListener('click', function () {
            if (!st.auto) { st.target = i; markTarget(-1); }
            playTone(stringFreq(i));
          });
          strings.appendChild(b);
        })(i);
      }
      markTarget(-1);
    }
    /* Surligne la corde visée ; `ok` : indice de la corde accordée, ou −1 */
    function markTarget(ok) {
      Array.prototype.forEach.call(strings.children, function (b, i) {
        b.classList.toggle('target', !st.auto && i === st.target);
        b.classList.toggle('ok', i === ok);
      });
    }
    function showIdle(text) {
      note.textContent = '—';
      cents.textContent = '';
      freq.textContent = '';
      gauge.className = 'gauge';
      needle.style.left = '50%';
      status.className = 'status';
      status.textContent = text;
      markTarget(-1);
    }
    function showReading(f) {
      var i, best = 0, bestC = Infinity, c, n = cur().midi.length;
      if (st.auto) {
        for (i = 0; i < n; i++) {
          c = Math.abs(1200 * Math.log(f / stringFreq(i)) / Math.LN2);
          if (c < bestC) { bestC = c; best = i; }
        }
        st.target = best;
      }
      var target = st.target, cts = 1200 * Math.log(f / stringFreq(target)) / Math.LN2, inTune = Math.abs(cts) <= 5;
      note.textContent = noteLabel(target);
      cents.textContent = (cts > 0 ? '+' : cts < 0 ? '−' : '') + Math.round(Math.abs(cts)) + ' cents';
      freq.textContent = fmtHz(f);
      gauge.className = 'gauge live' + (inTune ? ' ok' : '');
      needle.style.left = (50 + clamp(cts, -50, 50)) + '%';
      status.className = 'status' + (inTune ? ' ok' : '');
      status.textContent = inTune ? 'Accordée' : cts < 0 ? 'Trop grave : serrez la corde' : 'Trop aigu : desserrez la corde';
      markTarget(inTune ? target : -1);
    }

    /* ----- Son de référence ----- */
    function stopTone() {
      var t;
      if (!st.tone || !ctx) return;
      t = ctx.currentTime;
      st.tone.gain.gain.cancelScheduledValues(t);
      st.tone.gain.gain.setTargetAtTime(0, t, 0.03);
      st.tone.osc.stop(t + 0.2);
      st.tone = null;
    }
    function playTone(f) {
      var c = M.audio();
      if (!c) return;
      ctx = c;
      stopTone();
      var osc = c.createOscillator(), gain = c.createGain(), t = c.currentTime;
      osc.type = 'triangle';
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.3, t + 0.03);
      gain.gain.setValueAtTime(0.3, t + 2);
      gain.gain.linearRampToValueAtTime(0, t + 2.5);
      osc.connect(gain); gain.connect(M.bus('tuner'));
      osc.start(t); osc.stop(t + 2.6);
      st.tone = { osc: osc, gain: gain, until: performance.now() + 2700 };
    }

    /* ----- Microphone ----- */
    function tick() {
      var now = performance.now(), i, sum = 0, rms, f, r;
      if (st.tone && now < st.tone.until) return; // le son de référence ne doit pas être « entendu » par le micro
      st.analyser.getFloatTimeDomainData(st.buf);
      for (i = 0; i < st.buf.length; i++) sum += st.buf[i] * st.buf[i];
      rms = Math.sqrt(sum / st.buf.length);
      r = range();
      f = rms < 0.01 ? -1 : T.detectPitch(st.buf, ctx.sampleRate, r[0], r[1]);
      if (f > 0) {
        st.hist.push(f);
        if (st.hist.length > 5) st.hist.shift();
        var sorted = st.hist.slice().sort(function (a, b) { return a - b; });
        st.lastGood = now;
        showReading(sorted[sorted.length >> 1]);
      } else if (now - st.lastGood > 700) {
        st.hist = [];
        showIdle('Pincez une corde.');
      }
    }
    function stopMic() {
      if (st.timer) { clearInterval(st.timer); st.timer = null; }
      if (st.src) { st.src.disconnect(); st.src = null; }
      if (st.stream) { st.stream.getTracks().forEach(function (t) { t.stop(); }); st.stream = null; }
      st.hist = [];
      stopTone();
      mic.textContent = 'Activer le microphone';
      showIdle('Activez le microphone, puis pincez une corde.');
    }
    function micError(msg) { err.textContent = msg; err.hidden = false; }
    function startMic() {
      err.hidden = true;
      if (!window.isSecureContext) return micError('Le microphone exige une connexion sécurisée (https).');
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return micError('Ce navigateur ne permet pas d’utiliser le microphone.');
      var c = M.audio(); // créé ici, pendant le geste de l'utilisateur
      if (!c) return micError('Ce navigateur ne prend pas en charge l’audio.');
      ctx = c;
      navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
        .then(function (stream) {
          st.stream = stream;
          st.src = c.createMediaStreamSource(stream);
          st.analyser = c.createAnalyser();
          st.analyser.fftSize = range()[0] < 60 ? 8192 : 4096; // les notes graves (basse) demandent une fenêtre plus longue
          st.analyser.smoothingTimeConstant = 0;
          st.buf = new Float32Array(st.analyser.fftSize);
          st.src.connect(st.analyser); // jamais relié aux haut-parleurs
          st.lastGood = performance.now();
          st.timer = setInterval(tick, 60);
          mic.textContent = 'Arrêter le microphone';
          showIdle('Pincez une corde.');
        })
        .catch(function (e) {
          var n = e && e.name;
          if (n === 'NotAllowedError' || n === 'SecurityError') micError('L’accès au microphone est refusé. Autorisez-le dans les réglages du navigateur, puis réessayez.');
          else if (n === 'NotFoundError') micError('Aucun microphone n’a été trouvé.');
          else micError('Impossible d’utiliser le microphone.');
        });
    }

    mic.addEventListener('click', function () { if (st.stream) stopMic(); else startMic(); });
    selTun.addEventListener('change', function () { st.tuning = Number(this.value); st.target = 0; st.hist = []; renderStrings(); });
    ref.addEventListener('change', function () {
      var v = Number(this.value);
      st.refA = isFinite(v) ? clamp(Math.round(v), 415, 466) : 440;
      this.value = st.refA;
    });
    window.addEventListener('pagehide', stopMic);
    M.onNotation(renderStrings);
    renderStrings();
    return { stop: stopMic, isListening: function () { return !!st.stream; } };
  };
})();
