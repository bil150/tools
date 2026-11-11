/* Moteur colorimétrique de l’étude d’image (mélange de peinture ; sans dépendance, sans DOM).

   - Espace de calcul : CIE L*a*b* (D65) ; écart mesuré en ΔE CIEDE2000.
   - Modèle de mélange : Kubelka-Munk, canal par canal (rouge, vert, bleu en lumière linéaire).
     Chaque tube est connu par sa couleur de référence seule : on en déduit K/S = (1 − R)² / 2R.
     Le coefficient de diffusion S n'est pas mesurable ici ; il est estimé à partir de la clarté du tube
     (S = 1 + 5·Y : un blanc diffuse bien plus qu'un pigment sombre). La durabilité et la transparence / opacité des tubes
     ne servent pas au calcul : ce sont de simples informations. C'est une approximation :
     le résultat est un point de départ à vérifier sur la palette, pas une mesure.
   - Solveur : cherche les tubes (1 à 3) et leurs proportions qui minimisent l'écart avec la cible. */
(function (g) {
  'use strict';

  var RAD = Math.PI / 180;
  var R_MIN = 0.004, R_MAX = 0.996;      // bornes de réflectance (évite K/S infini ou nul)
  var MAX_TUBES_IN_MIX = 3;
  var TUBE_PENALTY = 0.35;               // ΔE « payé » par tube supplémentaire : sert à ordonner les autres compositions
  var SAME_ENOUGH = 0.3;                 // ΔE : à 0,3 près de la meilleure recette, c'est équivalent (invisible) ; la plus simple est alors proposée
  var MIN_SHARE = 0.02;                  // en dessous de 2 %, un tube est écarté
  var MAX_VARIANTS = 5;                  // nombre de recettes différentes proposées (la meilleure et ses alternatives)

  /* ---------- Conversions ---------- */

  var LIN = new Float64Array(256);
  (function () {
    for (var i = 0; i < 256; i++) {
      var c = i / 255;
      LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }
  })();

  function toSrgb8(l) {
    l = l <= 0 ? 0 : l >= 1 ? 1 : l;
    var v = l <= 0.0031308 ? 12.92 * l : 1.055 * Math.pow(l, 1 / 2.4) - 0.055;
    return Math.round(v * 255);
  }

  function f(t) { return t > 0.008856451679 ? Math.cbrt(t) : 7.787037037 * t + 16 / 116; }

  // RVB linéaire (0..1) → L*a*b* (blanc D65)
  function labFromLinear(r, gr, b) {
    var X = (0.4124564 * r + 0.3575761 * gr + 0.1804375 * b) / 0.95047;
    var Y = 0.2126729 * r + 0.7151522 * gr + 0.0721750 * b;
    var Z = (0.0193339 * r + 0.1191920 * gr + 0.9503041 * b) / 1.08883;
    var fx = f(X), fy = f(Y), fz = f(Z);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }

  function rgbToLab(c) { return labFromLinear(LIN[c.r], LIN[c.g], LIN[c.b]); }

  /* ---------- Écarts de couleur ---------- */

  function deltaE76(a, b) {
    var dl = a[0] - b[0], da = a[1] - b[1], db = a[2] - b[2];
    return Math.sqrt(dl * dl + da * da + db * db);
  }

  function hueDeg(b, a) {
    if (a === 0 && b === 0) return 0;
    var h = Math.atan2(b, a) / RAD;
    return h < 0 ? h + 360 : h;
  }

  // CIEDE2000 (Sharma, Wu, Dalal 2005)
  function deltaE2000(x, y) {
    var L1 = x[0], a1 = x[1], b1 = x[2], L2 = y[0], a2 = y[1], b2 = y[2];
    var C1 = Math.sqrt(a1 * a1 + b1 * b1), C2 = Math.sqrt(a2 * a2 + b2 * b2);
    var Cm7 = Math.pow((C1 + C2) / 2, 7);
    var G = 0.5 * (1 - Math.sqrt(Cm7 / (Cm7 + 6103515625))); // 25^7
    var a1p = (1 + G) * a1, a2p = (1 + G) * a2;
    var C1p = Math.sqrt(a1p * a1p + b1 * b1), C2p = Math.sqrt(a2p * a2p + b2 * b2);
    var h1p = hueDeg(b1, a1p), h2p = hueDeg(b2, a2p);
    var dLp = L2 - L1, dCp = C2p - C1p, dhp = 0, hpm;
    var CC = C1p * C2p;
    if (CC !== 0) {
      dhp = h2p - h1p;
      if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360;
    }
    var dHp = 2 * Math.sqrt(CC) * Math.sin(dhp * RAD / 2);
    var Lpm = (L1 + L2) / 2, Cpm = (C1p + C2p) / 2;
    if (CC === 0) hpm = h1p + h2p;
    else if (Math.abs(h1p - h2p) <= 180) hpm = (h1p + h2p) / 2;
    else hpm = (h1p + h2p + (h1p + h2p < 360 ? 360 : -360)) / 2;
    var T = 1 - 0.17 * Math.cos((hpm - 30) * RAD) + 0.24 * Math.cos(2 * hpm * RAD)
      + 0.32 * Math.cos((3 * hpm + 6) * RAD) - 0.20 * Math.cos((4 * hpm - 63) * RAD);
    var dTheta = 30 * Math.exp(-Math.pow((hpm - 275) / 25, 2));
    var Cpm7 = Math.pow(Cpm, 7);
    var Rc = 2 * Math.sqrt(Cpm7 / (Cpm7 + 6103515625));
    var lm = (Lpm - 50) * (Lpm - 50);
    var Sl = 1 + 0.015 * lm / Math.sqrt(20 + lm);
    var Sc = 1 + 0.045 * Cpm, Sh = 1 + 0.015 * Cpm * T;
    var Rt = -Math.sin(2 * dTheta * RAD) * Rc;
    var tl = dLp / Sl, tc = dCp / Sc, th = dHp / Sh;
    return Math.sqrt(tl * tl + tc * tc + th * th + Rt * tc * th);
  }

  /* ---------- Kubelka-Munk ---------- */

  // Tube { r, g, b } (sRGB 0..255) → K et S par canal.
  function prepareTube(c) {
    var lin = [LIN[c.r], LIN[c.g], LIN[c.b]];
    var Y = 0.2126729 * lin[0] + 0.7151522 * lin[1] + 0.0721750 * lin[2];
    var S = 1 + 5 * Y;
    var K = [0, 0, 0];
    for (var i = 0; i < 3; i++) {
      var R = Math.min(R_MAX, Math.max(R_MIN, lin[i]));
      K[i] = (1 - R) * (1 - R) / (2 * R) * S;   // K = (K/S) × S
    }
    return { K: K, S: S };
  }

  // Mélange des tubes P[idx[i]] en proportions w[i] (somme 1) → réflectance par canal dans out.
  function mix(P, idx, w, out) {
    var sumS = 0, k0 = 0, k1 = 0, k2 = 0, i, p;
    for (i = 0; i < idx.length; i++) {
      p = P[idx[i]];
      sumS += w[i] * p.S;
      k0 += w[i] * p.K[0]; k1 += w[i] * p.K[1]; k2 += w[i] * p.K[2];
    }
    var ks = [k0 / sumS, k1 / sumS, k2 / sumS];
    for (i = 0; i < 3; i++) out[i] = 1 + ks[i] - Math.sqrt(ks[i] * ks[i] + 2 * ks[i]);
    return out;
  }

  /* ---------- Solveur ---------- */

  // Rapport de parties entières simple (ex. 3 : 1) si une approximation à ±4 % existe, sinon null.
  function parts(ws) {
    if (ws.length === 1) return [1];
    for (var N = ws.length; N <= 24; N++) {
      var p = ws.map(function (w) { return Math.max(1, Math.round(w * N)); });
      var s = p.reduce(function (a, b) { return a + b; }, 0);
      var ok = ws.every(function (w, i) { return Math.abs(p[i] / s - w) <= 0.04; });
      if (!ok) continue;
      var d = p.reduce(gcd);
      return p.map(function (v) { return v / d; });
    }
    return null;
  }
  function gcd(a, b) { return b ? gcd(b, a % b) : a; }

  /* tubes : [{ id, rgb: { r, g, b } }] — cible : { r, g, b }.
     Retourne { items: [{ index, id, weight }], mixRgb, de, parts } ou null s'il n'y a aucun tube. */
  function solve(target, tubes) {
    var n = tubes.length;
    if (!n) return null;
    var P = tubes.map(function (t) { return prepareTube(t.rgb); });
    var tLab = rgbToLab(target);
    var tmp = [0, 0, 0];

    function labOf(idx, w) { mix(P, idx, w, tmp); return labFromLinear(tmp[0], tmp[1], tmp[2]); }
    function e76(idx, w) { return deltaE76(labOf(idx, w), tLab); }
    function e00(idx, w) { return deltaE2000(labOf(idx, w), tLab); }

    // Phase 1 : balayage grossier (pas de 5 %), écart rapide ; on garde le meilleur point de chaque combinaison.
    var pool = [], i, j, k, s, t;
    for (i = 0; i < n; i++) pool.push({ idx: [i], w: [1], e: e76([i], [1]) });

    var pairs = [];
    for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) {
      var bp = null;
      for (s = 1; s < 20; s++) {
        var wp = [s / 20, 1 - s / 20], ep = e76([i, j], wp);
        if (!bp || ep < bp.e) bp = { idx: [i, j], w: wp, e: ep };
      }
      pairs.push(bp);
    }
    pool = pool.concat(pairs);

    function bestTriple(i, j, k) {
      var b = null;
      for (var a = 1; a < 19; a++) for (var c = 1; a + c < 20; c++) {
        var w = [a / 20, c / 20, 1 - (a + c) / 20], e = e76([i, j, k], w);
        if (!b || e < b.e) b = { idx: [i, j, k], w: w, e: e };
      }
      return b;
    }
    if (MAX_TUBES_IN_MIX >= 3 && n >= 3) {
      var combos = n * (n - 1) * (n - 2) / 6;
      if (combos * 171 <= 2200000) {
        for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) for (k = j + 1; k < n; k++) pool.push(bestTriple(i, j, k));
      } else {
        // Beaucoup de tubes : on complète seulement les meilleures paires par un troisième tube.
        pairs.sort(function (a, b) { return a.e - b.e; });
        pairs.slice(0, 10).forEach(function (p) {
          for (k = 0; k < n; k++) {
            if (p.idx.indexOf(k) !== -1) continue;
            var ids = [p.idx[0], p.idx[1], k].sort(function (a, b) { return a - b; });
            pool.push(bestTriple(ids[0], ids[1], ids[2]));
          }
        });
      }
    }

    pool.sort(function (a, b) { return a.e - b.e; });

    // Phase 2 : affinage fin, par transferts de proportion, sur les meilleures candidates, en ΔE2000.
    function refine(c) {
      var w = c.w.slice(), best = e00(c.idx, w), step = 0.05, m = w.length;
      if (m === 1) return { idx: c.idx, w: w, e: best };
      while (step > 0.002) {
        var improved = false;
        for (var a = 0; a < m; a++) for (var b = 0; b < m; b++) {
          if (a === b) continue;
          var d = Math.min(step, w[b]);
          if (d <= 1e-9) continue;
          w[a] += d; w[b] -= d;
          var e = e00(c.idx, w);
          if (e < best - 1e-9) { best = e; improved = true; } else { w[a] -= d; w[b] += d; }
        }
        if (!improved) step /= 2;
      }
      return { idx: c.idx, w: w, e: best };
    }

    // Une part sous MIN_SHARE n'est pas dosable : on écarte ce tube puis on réaffine les autres (et non l'inverse :
    // retirer la part après coup, sans réajuster, fausserait le mélange — une pointe de pigment fort pèse lourd).
    function prune(c) {
      var cur = refine(c);
      while (cur.idx.length > 1) {
        var lo = 0, q;
        for (q = 1; q < cur.w.length; q++) if (cur.w[q] < cur.w[lo]) lo = q;
        if (cur.w[lo] >= MIN_SHARE) break;
        var idx = cur.idx.slice(), w = cur.w.slice();
        idx.splice(lo, 1); w.splice(lo, 1);
        var tot = w.reduce(function (x, y) { return x + y; }, 0);
        cur = refine({ idx: idx, w: w.map(function (v) { return v / tot; }) });
      }
      return cur;
    }

    // Candidates : les meilleures de chaque taille (1, 2 et 3 tubes), pour que la recette la plus simple ne soit jamais écartée d'avance
    var bySize = [[], [], [], []];
    pool.forEach(function (c) { bySize[c.idx.length].push(c); });   // pool est déjà trié par écart
    var finalists = bySize[1].slice(0, 3).concat(bySize[2].slice(0, 6), bySize[3].slice(0, 6)).map(prune);

    // Une recette terminée : parts minuscules écartées, proportions renormalisées et triées, écart réel recalculé.
    function finish(c) {
      var idx = [], w = [], i;
      for (i = 0; i < c.idx.length; i++) if (c.w[i] >= MIN_SHARE) { idx.push(c.idx[i]); w.push(c.w[i]); }
      var tot = w.reduce(function (x, y) { return x + y; }, 0);
      w = w.map(function (v) { return v / tot; });
      var order = idx.map(function (_, q) { return q; }).sort(function (x, y) { return w[y] - w[x]; });
      idx = order.map(function (q) { return idx[q]; });
      w = order.map(function (q) { return w[q]; });
      mix(P, idx, w, tmp);
      var lab = labFromLinear(tmp[0], tmp[1], tmp[2]);
      return {
        items: idx.map(function (ti, q) { return { index: ti, id: tubes[ti].id, weight: w[q] }; }),
        mixRgb: { r: toSrgb8(tmp[0]), g: toSrgb8(tmp[1]), b: toSrgb8(tmp[2]) },
        de: deltaE2000(lab, tLab),
        parts: parts(w)
      };
    }

    // Toutes les recettes terminées, une seule par ensemble de tubes (la plus proche de la cible)
    var byKey = {}, all = [];
    finalists.forEach(function (c) {
      var r = finish(c), key = r.items.map(function (it) { return it.id; }).sort().join('|');
      if (!byKey[key] || r.de < byKey[key].de) byKey[key] = r;
    });
    Object.keys(byKey).forEach(function (k) { all.push(byKey[k]); });

    // La recette proposée : celle qui a le meilleur ΔE ; parmi celles qui l'égalent (à SAME_ENOUGH près, invisible), celle qui contient
    // le moins de peintures ; à nombre égal de peintures, la plus proche de la cible.
    var bestDe = all.reduce(function (m, r) { return Math.min(m, r.de); }, Infinity);
    var main = all.filter(function (r) { return r.de <= bestDe + SAME_ENOUGH; }).sort(function (a, b) {
      return a.items.length - b.items.length || a.de - b.de;
    })[0];
    // Les autres compositions : d'autres ensembles de tubes, des plus simples et proches aux plus éloignées
    var others = all.filter(function (r) { return r !== main; }).sort(function (a, b) {
      return (a.de + TUBE_PENALTY * (a.items.length - 1)) - (b.de + TUBE_PENALTY * (b.items.length - 1));
    });
    var result = main;
    result.alternatives = [main].concat(others).slice(0, MAX_VARIANTS);
    return result;
  }

  /* Évalue une recette composée à la main : tubes [{ rgb }] et proportions (relatives, de somme quelconque > 0).
     Retourne { mixRgb, de } avec le même calcul que le solveur, ou null si toutes les proportions sont nulles. */
  function evaluate(target, tubes, weights) {
    var tot = weights.reduce(function (x, y) { return x + y; }, 0);
    if (!(tot > 0) || !tubes.length) return null;
    var P = tubes.map(function (t) { return prepareTube(t.rgb); });
    var idx = tubes.map(function (_, i) { return i; });
    var w = weights.map(function (v) { return v / tot; }), tmp = [0, 0, 0];
    mix(P, idx, w, tmp);
    var lab = labFromLinear(tmp[0], tmp[1], tmp[2]);
    return { mixRgb: { r: toSrgb8(tmp[0]), g: toSrgb8(tmp[1]), b: toSrgb8(tmp[2]) }, de: deltaE2000(lab, rgbToLab(target)) };
  }

  /* ---------- Peintures pour toute une image ---------- */

  /* Couleurs dominantes d'une image : data = pixels RGBA (Uint8ClampedArray d'un ImageData), k couleurs au plus.
     Découpe médiane dans L*a*b* puis quelques passes de k-moyennes. Retourne [{ rgb, weight }] (somme des poids : 1). */
  function palette(data, k) {
    var px = [], i, n = data.length / 4;
    for (i = 0; i < n; i++) {
      if (data[i * 4 + 3] < 128) continue;
      var lr = LIN[data[i * 4]], lg = LIN[data[i * 4 + 1]], lb = LIN[data[i * 4 + 2]];
      px.push({ lin: [lr, lg, lb], lab: labFromLinear(lr, lg, lb) });
    }
    if (!px.length) return [];
    function spread(b) {
      var m = [0, 0, 0], v = [0, 0, 0], j, a;
      for (j = 0; j < b.length; j++) for (a = 0; a < 3; a++) m[a] += b[j].lab[a];
      for (a = 0; a < 3; a++) m[a] /= b.length;
      for (j = 0; j < b.length; j++) for (a = 0; a < 3; a++) v[a] += Math.pow(b[j].lab[a] - m[a], 2);
      return { axis: v[0] >= v[1] && v[0] >= v[2] ? 0 : v[1] >= v[2] ? 1 : 2, total: v[0] + v[1] + v[2] };
    }
    var boxes = [px];
    while (boxes.length < k) {
      var bi = -1, bs = 1e-9, bax = 0;
      for (i = 0; i < boxes.length; i++) {
        if (boxes[i].length < 2) continue;
        var s = spread(boxes[i]);
        if (s.total > bs) { bs = s.total; bi = i; bax = s.axis; }
      }
      if (bi < 0) break;
      var box = boxes[bi].slice().sort(function (p, q) { return p.lab[bax] - q.lab[bax]; });
      boxes.splice(bi, 1, box.slice(0, box.length >> 1), box.slice(box.length >> 1));
    }
    function centre(list) {
      var t = [0, 0, 0];
      list.forEach(function (p) { t[0] += p.lin[0]; t[1] += p.lin[1]; t[2] += p.lin[2]; });
      var m = [t[0] / list.length, t[1] / list.length, t[2] / list.length];
      return { lin: m, lab: labFromLinear(m[0], m[1], m[2]) };
    }
    var cs = boxes.map(centre), pass, groups;
    for (pass = 0; pass < 5; pass++) {
      groups = cs.map(function () { return []; });
      px.forEach(function (p) {
        var b = 0, bd = Infinity;
        for (var c = 0; c < cs.length; c++) { var d = deltaE76(p.lab, cs[c].lab); if (d < bd) { bd = d; b = c; } }
        groups[b].push(p);
      });
      cs = cs.map(function (c, q) { return groups[q].length ? centre(groups[q]) : c; });
    }
    return cs.map(function (c, q) {
      return { rgb: { r: toSrgb8(c.lin[0]), g: toSrgb8(c.lin[1]), b: toSrgb8(c.lin[2]) }, weight: groups[q].length / px.length };
    }).filter(function (c) { return c.weight > 0; }).sort(function (a, b) { return b.weight - a.weight; });
  }

  /* Tous les points d'une image : chaque pixel compte. Les pixels identiques à 4 niveaux près par canal sont réunis
     (moyenne exacte, poids = leur part de l'image) pour que le calcul reste rapide. Retourne [{ rgb, weight }]. */
  function allPoints(data) {
    var bins = {}, n = 0, i;
    for (i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      n++;
      var key = (data[i] >> 2) + ',' + (data[i + 1] >> 2) + ',' + (data[i + 2] >> 2), b = bins[key];
      if (!b) b = bins[key] = { r: 0, g: 0, b: 0, n: 0 };
      b.r += data[i]; b.g += data[i + 1]; b.b += data[i + 2]; b.n++;
    }
    return Object.keys(bins).map(function (k) {
      var b = bins[k];
      return { rgb: { r: Math.round(b.r / b.n), g: Math.round(b.g / b.n), b: Math.round(b.b / b.n) }, weight: b.n / n };
    }).sort(function (a, b) { return b.weight - a.weight; });
  }

  /* Propositions de peintures pour reproduire une liste de couleurs (targets : [{ rgb, weight }]).
     pool : [{ id, rgb, owned }]. D'abord les peintures possédées utiles, puis, une à une, celle qui améliore le plus l'ensemble ;
     chaque ajout est une proposition (« sans achat », « +1 », « +2 »…). On s'arrête quand un ajout n'apporte presque plus rien :
     inutile d'acheter une peinture que d'autres permettent déjà d'obtenir.
     Pour chaque proposition : écart moyen (ΔE2000, mélanges de 1 ou 2 peintures, pondéré par la part de l'image), part de l'image
     à moins de ΔE 3, et part de l'image où sert chaque peinture. Retourne { have: [ids], adds: [ids], proposals: [...] }. */
  function propose(targets, pool, opts) {
    opts = opts || {};
    var maxExtra = opts.maxExtra == null ? 6 : opts.maxExtra, MAXSET = 14, MIN_GAIN = opts.minGain || 0.3;
    var T = targets.length, wsum = targets.reduce(function (s, t) { return s + t.weight; }, 0) || 1;
    var W = targets.map(function (t) { return t.weight / wsum; });
    var tLab = targets.map(function (t) { return rgbToLab(t.rgb); });
    var P = pool.map(function (t) { return prepareTube(t.rgb); });
    var tmp = [0, 0, 0], q;
    var STEPS = 19;

    function singleLab(p) { mix(P, [p], [1], tmp); return labFromLinear(tmp[0], tmp[1], tmp[2]); }
    function pairLabs(p, m) {
      var out = [];
      for (var s = 1; s <= STEPS; s++) { mix(P, [p, m], [s / (STEPS + 1), 1 - s / (STEPS + 1)], tmp); out.push(labFromLinear(tmp[0], tmp[1], tmp[2])); }
      return out;
    }
    function bestOver(labs) {   // écart rapide minimal, par couleur, sur une liste de mélanges
      var out = new Float64Array(T).fill(Infinity);
      for (var j = 0; j < labs.length; j++) { var l = labs[j]; for (q = 0; q < T; q++) { var e = deltaE76(l, tLab[q]); if (e < out[q]) out[q] = e; } }
      return out;
    }
    var sing = pool.map(function (_, p) { return bestOver([singleLab(p)]); });
    var cur = new Float64Array(T);
    for (q = 0; q < T; q++) cur[q] = deltaE76([100, 0, 0], tLab[q]);   // sans peinture : le support blanc
    var chosen = [], inSet = {}, withSet = {};

    // candidates : proches d'une couleur importante de l'image, plus les plus claires, sombres et vives
    function shortlist(ids) {
      if (ids.length <= 60) return ids.slice();
      var score = {}, labs = {};
      ids.forEach(function (p) { score[p] = 0; labs[p] = singleLab(p); });
      var top = T > 100 ? 3 : 8;
      for (q = 0; q < T; q++) ids.slice().sort(function (a, b) { return sing[a][q] - sing[b][q]; }).slice(0, top).forEach(function (p) { score[p] += W[q]; });
      var keep = ids.filter(function (p) { return score[p] > 0; }).sort(function (a, b) { return score[b] - score[a]; }).slice(0, 60);
      var byL = ids.slice().sort(function (a, b) { return labs[a][0] - labs[b][0]; });
      var byC = ids.slice().sort(function (a, b) { return Math.hypot(labs[b][1], labs[b][2]) - Math.hypot(labs[a][1], labs[a][2]); });
      byL.slice(0, 4).concat(byL.slice(-4), byC.slice(0, 8)).forEach(function (p) { if (keep.indexOf(p) === -1) keep.push(p); });
      return keep;
    }
    function bestWith(c) {
      if (withSet[c]) return withSet[c];
      var b = Float64Array.from(sing[c]);
      chosen.forEach(function (m) { var pb = bestOver(pairLabs(c, m)); for (q = 0; q < T; q++) if (pb[q] < b[q]) b[q] = pb[q]; });
      return (withSet[c] = b);
    }
    function score(c) { var b = bestWith(c), s = 0; for (q = 0; q < T; q++) s += W[q] * Math.min(cur[q], b[q]); return s; }
    function mean() { var s = 0; for (q = 0; q < T; q++) s += W[q] * cur[q]; return s; }
    function take(c) {
      var b = bestWith(c);
      for (q = 0; q < T; q++) if (b[q] < cur[q]) cur[q] = b[q];
      chosen.push(c); inSet[c] = true;
      Object.keys(withSet).forEach(function (k) {
        var kk = +k; if (inSet[kk]) return;
        var pb = bestOver(pairLabs(kk, c)), arr = withSet[kk];
        for (q = 0; q < T; q++) if (pb[q] < arr[q]) arr[q] = pb[q];
      });
    }
    function greedy(ids, limit, minGain) {
      var picked = [], cands = shortlist(ids);
      while (picked.length < limit && chosen.length < MAXSET) {
        var base = mean(), bc = -1, bs = Infinity;
        for (var i = 0; i < cands.length; i++) {
          if (inSet[cands[i]]) continue;
          var s = score(cands[i]);
          if (s < bs) { bs = s; bc = cands[i]; }
        }
        if (bc < 0 || base - bs < minGain) break;
        take(bc); picked.push(bc);
      }
      return picked;
    }

    var ownedIds = [], otherIds = [];
    pool.forEach(function (p, k) { (p.owned ? ownedIds : otherIds).push(k); });
    var haveIdx = greedy(ownedIds, MAXSET, MIN_GAIN / 2);
    var addIdx = maxExtra > 0 ? greedy(otherIds, maxExtra, MIN_GAIN) : [];

    // Bilan de chaque proposition : meilleur mélange de 1 ou 2 peintures pour chaque couleur (ΔE2000)
    function assess(idxList) {
      var mixes = [];
      idxList.forEach(function (p, a) {
        mixes.push({ lab: singleLab(p), ids: [p], w: [1] });
        for (var b = a + 1; b < idxList.length; b++) {
          var m = idxList[b], labs = pairLabs(p, m);
          labs.forEach(function (l, s) { mixes.push({ lab: l, ids: [p, m], w: [(s + 1) / (STEPS + 1), 1 - (s + 1) / (STEPS + 1)] }); });
        }
      });
      var tot = 0, cover = 0, use = {};
      for (q = 0; q < T; q++) {
        var best = null, be = Infinity;
        for (var j = 0; j < mixes.length; j++) { var e = deltaE76(mixes[j].lab, tLab[q]); if (e < be) { be = e; best = mixes[j]; } }
        if (!best) continue;
        var de = deltaE2000(best.lab, tLab[q]);
        tot += W[q] * de; if (de < 3) cover += W[q];
        best.ids.forEach(function (p, i) { if (best.w[i] >= 0.05) use[pool[p].id] = (use[pool[p].id] || 0) + W[q]; });
      }
      return { mean: idxList.length ? tot : null, cover: idxList.length ? cover : 0, use: use };
    }
    var proposals = [];
    for (var n = 0; n <= addIdx.length; n++) {
      var a = assess(haveIdx.concat(addIdx.slice(0, n)));
      proposals.push({ n: n, mean: a.mean, cover: a.cover, use: a.use });
    }
    return { have: haveIdx.map(function (k) { return pool[k].id; }), adds: addIdx.map(function (k) { return pool[k].id; }), proposals: proposals };
  }

  var api = {
    rgbToLab: rgbToLab, deltaE76: deltaE76, deltaE2000: deltaE2000,
    prepareTube: prepareTube, solve: solve, evaluate: evaluate, parts: parts, palette: palette, allPoints: allPoints, propose: propose
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else g.MelangeMoteur = api;
})(typeof window !== 'undefined' ? window : globalThis);
