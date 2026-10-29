/* Testeur de clavier MIDI (API Web MIDI) : notes sur un clavier de piano, vélocité, contrôleurs,
   molette de hauteur, pression, changements de programme, journal des messages.
   Les noms de matériel déclarés par les appareils ne sont pas affichés (ils contiennent souvent une marque).
   Les messages système (horloge, signal de présence) sont masqués par défaut. */
(function () {
  'use strict';

  var NOTES = ['Do', 'Do♯', 'Ré', 'Ré♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si'];
  var BLACK = { 1: true, 3: true, 6: true, 8: true, 10: true };
  var FIRST = 21, LAST = 108; // 88 touches, de La 0 à Do 8
  var CONTROLS = {
    0: 'Sélection de banque', 1: 'Molette de modulation', 2: 'Souffle', 4: 'Pédale continue', 5: 'Durée de glissé',
    7: 'Volume', 8: 'Balance', 10: 'Panoramique', 11: 'Expression', 64: 'Pédale de sustain', 65: 'Glissé activé',
    66: 'Pédale tonale', 67: 'Pédale douce', 71: 'Résonance', 72: 'Relâchement', 73: 'Attaque', 74: 'Brillance',
    91: 'Réverbération', 93: 'Chorus', 120: 'Tout son coupé', 121: 'Réinitialiser les contrôleurs', 123: 'Toutes les notes coupées'
  };
  var SYSTEM = { 0xF8: 'Horloge', 0xFA: 'Démarrage', 0xFB: 'Reprise', 0xFC: 'Arrêt', 0xFE: 'Signal de présence', 0xFF: 'Réinitialisation' };

  /* ---------- Décodage ---------- */
  function noteName(n) { return NOTES[n % 12] + ' ' + (Math.floor(n / 12) - 1); }

  /* data : tableau d'octets MIDI -> description du message */
  function parse(data) {
    var status = data[0], d1 = data[1] || 0, d2 = data[2] || 0;
    if (status >= 0xF0) return { type: 'system', code: status, label: SYSTEM[status] || 'Message système' };
    var type = status & 0xF0, channel = (status & 0x0F) + 1;
    switch (type) {
      case 0x80: return { type: 'off', channel: channel, note: d1, velocity: d2 };
      case 0x90: return d2 === 0 ? { type: 'off', channel: channel, note: d1, velocity: 0 } : { type: 'on', channel: channel, note: d1, velocity: d2 };
      case 0xA0: return { type: 'poly', channel: channel, note: d1, value: d2 };
      case 0xB0: return { type: 'cc', channel: channel, controller: d1, value: d2 };
      case 0xC0: return { type: 'program', channel: channel, program: d1 };
      case 0xD0: return { type: 'pressure', channel: channel, value: d1 };
      case 0xE0: return { type: 'bend', channel: channel, value: ((d2 << 7) | d1) - 8192 };
      default: return { type: 'other', channel: channel };
    }
  }

  function describe(m) {
    switch (m.type) {
      case 'on': return 'Note enfoncée · ' + noteName(m.note) + ' (' + m.note + ') · vélocité ' + m.velocity;
      case 'off': return 'Note relâchée · ' + noteName(m.note) + ' (' + m.note + ')';
      case 'poly': return 'Pression sur la touche · ' + noteName(m.note) + ' · ' + m.value;
      case 'cc': return (CONTROLS[m.controller] || 'Contrôleur ' + m.controller) + ' · ' + m.value;
      case 'program': return 'Changement de programme · ' + m.program;
      case 'pressure': return 'Pression globale · ' + m.value;
      case 'bend': return 'Hauteur (molette) · ' + m.value;
      case 'system': return m.label;
      default: return 'Message';
    }
  }

  /* ---------- Son de contrôle (optionnel) ---------- */
  function createSynth() {
    var ctx = null, voices = {};
    function ensure() {
      if (!ctx) { var C = window.AudioContext || window.webkitAudioContext; if (C) ctx = new C(); }
      if (ctx && ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    return {
      on: function (note, velocity) {
        var c = ensure();
        if (!c) return;
        this.off(note);
        var osc = c.createOscillator(), gain = c.createGain();
        osc.type = 'triangle';
        osc.frequency.value = 440 * Math.pow(2, (note - 69) / 12);
        gain.gain.setValueAtTime(0, c.currentTime);
        gain.gain.linearRampToValueAtTime(0.25 * (velocity / 127), c.currentTime + 0.01);
        osc.connect(gain); gain.connect(c.destination);
        osc.start();
        voices[note] = { osc: osc, gain: gain };
      },
      off: function (note) {
        var v = voices[note];
        if (!v || !ctx) return;
        v.gain.gain.cancelScheduledValues(ctx.currentTime);
        v.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
        v.osc.stop(ctx.currentTime + 0.3);
        delete voices[note];
      },
      all: function () { var self = this; Object.keys(voices).forEach(function (n) { self.off(Number(n)); }); },
      unlock: ensure
    };
  }

  /* ---------- Page ---------- */
  function init() {
    var $ = function (id) { return document.getElementById(id); };
    function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

    var access = null, synth = createSynth();
    var stats = { notes: 0, messages: 0, min: 127, max: 0, sum: 0 };
    var keys = {}, held = {}, controls = {}, logCount = 0;

    /* Clavier de 88 touches : les touches blanches en ligne, les noires superposées */
    var piano = $('piano'), whites = [], i;
    for (i = FIRST; i <= LAST; i++) if (!BLACK[i % 12]) whites.push(i);
    var step = 100 / whites.length;
    whites.forEach(function (n) {
      var k = el('div', 'key white');
      k.title = noteName(n);
      if (n % 12 === 0) k.appendChild(el('span', 'oct', 'Do ' + (Math.floor(n / 12) - 1)));
      piano.appendChild(k); keys[n] = k;
    });
    for (i = FIRST; i <= LAST; i++) {
      if (!BLACK[i % 12]) continue;
      var k = el('div', 'key black');
      var pos = whites.indexOf(i - 1) + 1;
      k.style.left = (pos * step - step * 0.3) + '%';
      k.style.width = (step * 0.6) + '%';
      k.title = noteName(i);
      piano.appendChild(k); keys[i] = k;
    }

    function setKey(n, on, velocity) {
      var k = keys[n];
      if (!k) return;
      k.classList.toggle('on', on);
      k.style.setProperty('--v', on ? (0.35 + 0.65 * velocity / 127).toFixed(2) : 0);
    }

    function showLast(m) {
      $('lastNote').textContent = noteName(m.note);
      $('lastNum').textContent = String(m.note);
      $('lastVel').textContent = m.type === 'on' ? String(m.velocity) : '—';
      $('lastCh').textContent = String(m.channel);
    }

    function updateStats() {
      $('statNotes').textContent = String(stats.notes);
      $('statMsgs').textContent = String(stats.messages);
      $('statVel').textContent = stats.notes ? stats.min + ' à ' + stats.max + ' (moyenne ' + Math.round(stats.sum / stats.notes) + ')' : '—';
      $('statHeld').textContent = String(Object.keys(held).length);
    }

    function control(m) {
      var row = controls[m.controller];
      if (!row) {
        var box = el('div', 'ctl');
        var name = el('span', 'name', (CONTROLS[m.controller] || 'Contrôleur ' + m.controller) + ' (' + m.controller + ')');
        var val = el('span', 'val', '0');
        var bar = el('div', 'meter'), fill = el('i');
        bar.appendChild(fill);
        box.appendChild(name); box.appendChild(val); box.appendChild(bar);
        $('ctls').appendChild(box);
        $('ctlsEmpty').hidden = true;
        row = controls[m.controller] = { val: val, fill: fill };
      }
      row.val.textContent = String(m.value);
      row.fill.style.width = (m.value / 127 * 100) + '%';
    }

    function addLog(text) {
      var log = $('log'), li = el('li', null, text);
      log.insertBefore(li, log.firstChild);
      if (++logCount > 40) { log.removeChild(log.lastChild); logCount--; }
    }

    function onMessage(port, ev) {
      var m = parse(ev.data);
      stats.messages++;
      if (m.type === 'system' && !$('optSystem').checked) { updateStats(); return; }

      if (m.type === 'on') {
        stats.notes++; stats.sum += m.velocity;
        stats.min = Math.min(stats.min, m.velocity); stats.max = Math.max(stats.max, m.velocity);
        held[m.note] = true; setKey(m.note, true, m.velocity); showLast(m);
        if ($('optSound').checked) synth.on(m.note, m.velocity);
      } else if (m.type === 'off') {
        delete held[m.note]; setKey(m.note, false, 0); showLast(m);
        synth.off(m.note);
      } else if (m.type === 'cc') {
        control(m);
        if (m.controller === 64) $('pedal').classList.toggle('on', m.value >= 64);
        if (m.controller === 123 || m.controller === 120) {
          Object.keys(held).forEach(function (n) { setKey(Number(n), false, 0); });
          held = {}; synth.all();
        }
      } else if (m.type === 'bend') {
        $('bendVal').textContent = String(m.value);
        $('bendFill').style.left = ((m.value + 8192) / 16383 * 100) + '%';
      } else if (m.type === 'pressure' || m.type === 'poly') {
        $('pressVal').textContent = String(m.value);
        $('pressFill').style.width = (m.value / 127 * 100) + '%';
      } else if (m.type === 'program') {
        $('progVal').textContent = String(m.program);
      }
      updateStats();
      addLog('Entrée ' + (port.index + 1) + ' · canal ' + (m.channel || '—') + ' · ' + describe(m));
    }

    /* ---------- Connexion ---------- */
    var ports = [];
    function refreshPorts() {
      ports = [];
      access.inputs.forEach(function (input) { ports.push(input); });
      ports.forEach(function (p, idx) {
        p.index = idx;
        p.onmidimessage = function (ev) { onMessage(p, ev); };
      });
      $('devices').textContent = ports.length
        ? ports.length + (ports.length > 1 ? ' entrées MIDI détectées' : ' entrée MIDI détectée') + '. Jouez une note pour tester.'
        : 'Aucune entrée MIDI détectée. Branchez ou allumez votre clavier : il apparaîtra automatiquement.';
    }

    function connect() {
      $('err').hidden = true;
      navigator.requestMIDIAccess({ sysex: false }).then(function (a) {
        access = a;
        $('start').hidden = true;
        $('panel').hidden = false;
        a.onstatechange = refreshPorts;
        refreshPorts();
      }, function () {
        $('err').textContent = 'L’accès au MIDI a été refusé. Autorisez-le dans les réglages du site, puis réessayez.';
        $('err').hidden = false;
      });
    }

    function reset() {
      stats = { notes: 0, messages: 0, min: 127, max: 0, sum: 0 };
      Object.keys(held).forEach(function (n) { setKey(Number(n), false, 0); });
      held = {}; synth.all();
      $('log').innerHTML = ''; logCount = 0;
      $('ctls').innerHTML = ''; controls = {}; $('ctlsEmpty').hidden = false;
      ['lastNote', 'lastNum', 'lastVel', 'lastCh', 'progVal'].forEach(function (id) { $(id).textContent = '—'; });
      $('bendVal').textContent = '0'; $('bendFill').style.left = '50%';
      $('pressVal').textContent = '0'; $('pressFill').style.width = '0';
      $('pedal').classList.remove('on');
      updateStats();
    }

    if (!navigator.requestMIDIAccess) {
      $('start').hidden = true;
      $('unsupported').hidden = false;
      return;
    }
    $('start').addEventListener('click', connect);
    $('reset').addEventListener('click', reset);
    $('optSound').addEventListener('change', function () { if ($('optSound').checked) synth.unlock(); else synth.all(); });
    reset();
  }

  if (typeof document !== 'undefined') init();
  if (typeof module !== 'undefined') module.exports = { parse: parse, noteName: noteName, describe: describe };
})();
