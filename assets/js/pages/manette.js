/* Testeur de manette (API Gamepad) : état en direct des boutons, sticks et axes,
   compteur d'appuis, zone morte et test de vibration.
   Les libellés sont volontairement neutres. Le nom déclaré par la manette n'est pas affiché. */
(function () {
  'use strict';

  /* Disposition « standard » du navigateur, par indice de bouton */
  var BUTTONS = [
    'Bouton bas', 'Bouton droite', 'Bouton gauche', 'Bouton haut',
    'Épaule gauche', 'Épaule droite', 'Gâchette gauche', 'Gâchette droite',
    'Sélection', 'Démarrer', 'Clic stick gauche', 'Clic stick droit',
    'Croix haut', 'Croix bas', 'Croix gauche', 'Croix droite', 'Accueil'
  ];
  var AXES = ['Stick gauche, horizontal', 'Stick gauche, vertical', 'Stick droit, horizontal', 'Stick droit, vertical'];
  var STICKS = [
    { name: 'Stick gauche', x: 0, y: 1, click: 10 },
    { name: 'Stick droit', x: 2, y: 3, click: 11 }
  ];
  var ZONE = 120, RADIUS = 53; // taille de la zone et amplitude maximale du point, en px

  var $ = function (id) { return document.getElementById(id); };
  var state = { index: null, built: '', counts: [], was: [], deadzone: 0.1, ticks: 0, rate: 0, lastTs: 0, since: 0 };
  var cells = [], bars = [], vals = [], dots = [], zones = [], deads = [];

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function fmt(v) { return (v < 0 ? '−' : ' ') + Math.abs(v).toFixed(2).replace('.', ','); }

  function pads() {
    var list = navigator.getGamepads ? navigator.getGamepads() : [];
    return Array.prototype.filter.call(list, function (p) { return p && p.connected; });
  }
  function current() {
    var list = pads();
    for (var i = 0; i < list.length; i++) if (list[i].index === state.index) return list[i];
    return null;
  }

  /* ---------- Sélecteur de manette ---------- */
  function refresh() {
    var list = pads(), sel = $('padSel');
    $('waiting').hidden = list.length > 0;
    $('panel').hidden = list.length === 0;
    sel.innerHTML = '';
    list.forEach(function (p) {
      var o = el('option', null, 'Manette ' + (p.index + 1) + ' — ' + p.buttons.length + ' boutons, ' + p.axes.length + ' axes');
      o.value = String(p.index);
      sel.appendChild(o);
    });
    if (!list.length) { state.index = null; state.built = ''; return; }
    var keep = list.some(function (p) { return p.index === state.index; });
    if (!keep) state.index = list[0].index;
    sel.value = String(state.index);
  }

  /* ---------- Construction de l'affichage ---------- */
  function build(pad) {
    var std = pad.mapping === 'standard';
    state.built = pad.index + ':' + pad.buttons.length + ':' + pad.axes.length;
    state.counts = pad.buttons.map(function () { return 0; });
    state.was = pad.buttons.map(function () { return false; });
    $('info').textContent = std
      ? 'Disposition standard : les boutons portent leur nom.'
      : 'Disposition non standard : les boutons et axes sont numérotés.';

    var grid = $('buttons');
    grid.innerHTML = '';
    cells = [];
    pad.buttons.forEach(function (b, i) {
      var c = el('div', 'pbtn');
      c.appendChild(el('i', 'fill'));
      c.appendChild(el('span', 'name', std && BUTTONS[i] ? BUTTONS[i] : 'Bouton ' + i));
      var n = el('span', 'cnt', '0');
      c.appendChild(n);
      grid.appendChild(c);
      cells.push({ box: c, fill: c.firstChild, cnt: n });
    });

    var sticks = $('sticks');
    sticks.innerHTML = '';
    dots = []; zones = []; deads = [];
    if (std || pad.axes.length >= 2) {
      STICKS.forEach(function (s) {
        if (pad.axes.length <= s.y) return;
        var w = el('div', 'stick');
        var z = el('div', 'zone');
        var dead = el('div', 'dead');
        var dot = el('div', 'dot');
        z.appendChild(dead); z.appendChild(dot);
        w.appendChild(z);
        w.appendChild(el('span', null, s.name));
        sticks.appendChild(w);
        dots.push({ dot: dot, def: s });
        zones.push(w);
        deads.push(dead);
      });
    }

    var axes = $('axes');
    axes.innerHTML = '';
    bars = []; vals = [];
    pad.axes.forEach(function (v, i) {
      var a = el('div', 'axis');
      a.appendChild(el('span', null, std && AXES[i] ? AXES[i] : 'Axe ' + i));
      var val = el('span', 'val', '0,00');
      a.appendChild(val);
      var bar = el('div', 'bar');
      var mark = el('i');
      bar.appendChild(mark);
      a.appendChild(bar);
      axes.appendChild(a);
      bars.push(mark); vals.push(val);
    });
    setDeadzoneSize();

    var rumble = $('rumble');
    var can = !!(pad.vibrationActuator && pad.vibrationActuator.playEffect);
    rumble.disabled = !can;
    rumble.title = can ? '' : 'Vibration non prise en charge par cette manette ou ce navigateur';
  }

  function setDeadzoneSize() {
    var d = Math.round(state.deadzone * RADIUS * 2);
    deads.forEach(function (e) { e.style.width = d + 'px'; e.style.height = d + 'px'; });
    $('deadVal').textContent = state.deadzone.toFixed(2).replace('.', ',');
  }

  /* ---------- Boucle d'affichage ---------- */
  function frame(now) {
    var pad = current();
    if (pad) {
      if (state.built !== pad.index + ':' + pad.buttons.length + ':' + pad.axes.length) build(pad);

      pad.buttons.forEach(function (b, i) {
        var c = cells[i];
        if (!c) return;
        var pressed = b.pressed || b.value > 0.5;
        if (pressed && !state.was[i]) { state.counts[i]++; c.cnt.textContent = String(state.counts[i]); }
        state.was[i] = pressed;
        c.box.classList.toggle('on', b.pressed);
        c.fill.style.width = Math.round(b.value * 100) + '%';
      });

      pad.axes.forEach(function (v, i) {
        if (!bars[i]) return;
        var shown = Math.abs(v) < state.deadzone ? 0 : v;
        vals[i].textContent = fmt(shown);
        bars[i].style.left = ((v + 1) / 2 * 100) + '%';
      });
      dots.forEach(function (d, k) {
        var x = pad.axes[d.def.x] || 0, y = pad.axes[d.def.y] || 0;
        if (Math.hypot(x, y) < state.deadzone) { x = 0; y = 0; }
        d.dot.style.transform = 'translate(' + (x * RADIUS) + 'px,' + (y * RADIUS) + 'px)';
        var pressed = pad.buttons[d.def.click] && pad.buttons[d.def.click].pressed;
        zones[k].classList.toggle('pressed', !!pressed);
      });

      if (pad.timestamp !== state.lastTs) { state.ticks++; state.lastTs = pad.timestamp; }
      if (now - state.since >= 1000) {
        state.rate = Math.round(state.ticks * 1000 / (now - state.since));
        state.ticks = 0; state.since = now;
        $('rate').textContent = 'Mises à jour de l’état : ' + state.rate + ' par seconde.';
      }
    }
    requestAnimationFrame(frame);
  }

  /* ---------- Événements ---------- */
  function init() {
    if (!navigator.getGamepads) {
      $('waiting').hidden = true;
      $('unsupported').hidden = false;
      return;
    }
    window.addEventListener('gamepadconnected', refresh);
    window.addEventListener('gamepaddisconnected', refresh);
    $('padSel').addEventListener('change', function () {
      state.index = Number($('padSel').value);
      state.built = '';
    });
    $('dead').addEventListener('input', function () {
      state.deadzone = Number($('dead').value);
      setDeadzoneSize();
    });
    $('reset').addEventListener('click', function () {
      state.counts = state.counts.map(function () { return 0; });
      cells.forEach(function (c) { c.cnt.textContent = '0'; });
    });
    $('rumble').addEventListener('click', function () {
      var pad = current(), err = $('rumbleErr');
      err.hidden = true;
      if (!pad || !pad.vibrationActuator) return;
      pad.vibrationActuator.playEffect('dual-rumble', { duration: 600, strongMagnitude: 1, weakMagnitude: 0.6 })
        .catch(function () {
          err.textContent = 'La vibration n’a pas pu démarrer.';
          err.hidden = false;
        });
    });
    refresh();
    requestAnimationFrame(frame);
  }

  init();
})();
