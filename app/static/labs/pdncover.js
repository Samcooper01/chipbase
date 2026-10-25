/* Spatial power-integrity coverage lab. The learner drags a fixed set of point
   sources (power bumps, or decoupling capacitors) over the die; the voltage
   droop at any point grows with the current there times the square of the
   distance to the nearest source. Meet the peak-droop budget.
   window.PDNCover = { evaluate, mount }.

   - bumps mode : the current field is uniform, so the sources must be SPREAD to
     cover the whole die (the worst point is the one farthest from any bump).
   - decap mode : the current field is a few switching hotspots, so the sources
     must CLUSTER on those hotspots (droop is weighted by local activity).
   Same model, opposite best placement. */
(function () {
  "use strict";

  function heatColor(r) {
    var rr = Math.max(0, r);
    var hue = 130 * (1 - Math.min(1, rr));
    var light = rr > 1 ? Math.max(42, 52 - (rr - 1) * 16) : 52;
    var a = Math.min(0.5, 0.08 + 0.36 * Math.min(1.2, rr));
    return "hsla(" + hue.toFixed(0) + ",72%," + light.toFixed(0) + "%," + a.toFixed(2) + ")";
  }

  /* local current/activity at (x,y): uniform, or a sum of gaussian hotspots */
  function currentAt(spec, x, y) {
    if (!spec.hotspots || !spec.hotspots.length) return 1;
    var c = spec.baseCurrent || 0.15;
    spec.hotspots.forEach(function (h) {
      var dx = x - h.x, dy = y - h.y, s = h.sigma || 18;
      c += h.mag * Math.exp(-(dx * dx + dy * dy) / (2 * s * s));
    });
    return c;
  }

  function droopAt(spec, sources, x, y) {
    var act = currentAt(spec, x, y);
    if (spec.dynamic) {
      /* droop is set by the local switching ACTIVITY (a fixed field), pulled
         down only within a decap's coverage ring. It does NOT blow up with
         distance, so the hot targets are stable regardless of decap placement. */
      var nearest = Infinity;
      for (var i = 0; i < sources.length; i++) { var dx = x - sources[i].x, dy = y - sources[i].y, d = Math.sqrt(dx * dx + dy * dy); if (d < nearest) nearest = d; }
      var cov = Math.max(0, Math.min(1, nearest / (spec.coverR || 20)));   /* 0 under a decap, 1 outside its ring */
      var residual = spec.residual != null ? spec.residual : 0.15;
      return spec.actScale * act * (residual + (1 - residual) * cov);
    }
    var best = Infinity;
    for (var j = 0; j < sources.length; j++) { var ex = x - sources[j].x, ey = y - sources[j].y, e2 = ex * ex + ey * ey; if (e2 < best) best = e2; }
    return spec.k * act * best;
  }

  function evaluate(spec, sources) {
    var core = spec.core, S = spec.sampleGrid || 24;
    var peak = 0, px = 0, py = 0;
    for (var gy = 0; gy <= S; gy++) for (var gx = 0; gx <= S; gx++) {
      var x = gx / S * core.w, y = gy / S * core.h;
      var d = droopAt(spec, sources, x, y);
      if (d > peak) { peak = d; px = x; py = y; }
    }
    return { peakDroop: peak, peakX: px, peakY: py, ok: peak <= spec.budget + 1e-6, pass: peak <= spec.budget + 1e-6 };
  }

  function mount(container, spec) {
    var core = spec.core, PAD = 20, MAXPX = 440;
    var sc = MAXPX / Math.max(core.w, core.h);
    var W = core.w * sc + PAD * 2, Hpx = core.h * sc + PAD * 2;
    function mx(x) { return PAD + x * sc; }
    function my(y) { return PAD + y * sc; }
    var G = spec.grid || 44;

    var sources = spec.init.map(function (p) { return { x: p.x, y: p.y }; });
    var scoreObj = null;

    /* fixed bump grid (C4 array sites) + macro keepouts, when the spec asks */
    function onMacro(x, y) {
      var ms = spec.macros || [];
      for (var i = 0; i < ms.length; i++) { var m = ms[i]; if (x >= m.x - 1 && x <= m.x + m.w + 1 && y >= m.y - 1 && y <= m.y + m.h + 1) return true; }
      return false;
    }
    function gridSites() {
      var sites = [], p = spec.snapPitch;
      for (var x = p / 2; x < core.w; x += p) for (var y = p / 2; y < core.h; y += p) if (!onMacro(x, y)) sites.push([x, y]);
      return sites;
    }
    function snapSite(px, py, self) {
      if (!spec.snapPitch) return null;
      var p = spec.snapPitch, best = null, bd = 1e9;
      gridSites().forEach(function (s) {
        var taken = sources.some(function (o) { return o !== self && Math.abs(o.x - s[0]) < 0.5 && Math.abs(o.y - s[1]) < 0.5; });
        if (taken) return;
        var d = (px - s[0]) * (px - s[0]) + (py - s[1]) * (py - s[1]);
        if (d < bd) { bd = d; best = s; }
      });
      return best;
    }

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas");
    var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = Hpx * dpr;
    canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas";
    var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);

    var legend = document.createElement("div"); legend.className = "mp-legend";
    legend.innerHTML =
      '<span class="mp-legend-title">' + (spec.mapLabel || "voltage droop") + '</span>' +
      '<span class="mp-legend-bar"></span>' +
      '<span class="mp-legend-ends"><span>low</span><span>at budget</span><span>over</span></span>';
    left.appendChild(legend);

    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bReset);
    left.appendChild(ctrls);
    wrap.appendChild(left);

    var panel = document.createElement("div"); panel.className = "mp-panel";
    wrap.appendChild(panel);
    container.appendChild(wrap);

    /* dynamic-droop view: a die-wide switching fabric (standard-cell rows and
       nets) under a droop gradient. Red regions are the worst dynamic droop -
       cover them with decaps and they recompute toward green. Each decap shows
       its coverage ring. Reads as an activity/transient problem, not the
       smooth static bowl. */
    function drawActivity() {
      var tw = core.w / G, th = core.h / G;
      /* 1. dynamic-droop gradient FIRST (worst / uncovered switching = red) */
      for (var gy = 0; gy < G; gy++) for (var gx = 0; gx < G; gx++) {
        var x = (gx + 0.5) * tw, y = (gy + 0.5) * th;
        ctx.fillStyle = heatColor(droopAt(spec, sources, x, y) / spec.budget);
        ctx.fillRect(mx(gx * tw), my(gy * th), tw * sc + 0.7, th * sc + 0.7);
      }
      /* 2. standard-cell rows ON TOP, bold enough to read over the gradient */
      var rowH = 9, cs = 20240607; function crnd() { cs = (cs * 1103515245 + 12345) & 0x7fffffff; return cs / 0x7fffffff; }
      ctx.strokeStyle = "rgba(30,34,46,0.55)"; ctx.lineWidth = 1;
      for (var ry = 2; ry + rowH <= core.h; ry += rowH) {
        var cx = 2; while (cx < core.w - 3) { var cw = 5 + Math.floor(crnd() * 4) * 2; if (cx + cw > core.w - 2) cw = core.w - 2 - cx; if (cw < 3) break; ctx.strokeRect(mx(cx), my(ry + 1), cw * sc, (rowH - 2) * sc); cx += cw + 1.6; }
      }
      /* 3. die-wide signal nets ON TOP, thick and bold */
      var seed = 4242; function rn() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
      ctx.lineJoin = "miter"; ctx.lineCap = "round";
      var ns = 22;
      for (var k = 0; k < ns; k++) {
        var horiz = rn() < 0.5, span = horiz ? core.w : core.h;
        var a = rn() * (horiz ? core.h : core.w), s0 = rn() * span * 0.5, e0 = Math.min(span, s0 + (0.35 + rn() * 0.55) * span);
        var jog = (rn() - 0.5) * 14, mid = (s0 + e0) / 2;
        /* white casing so the net reads over any heat colour, then a bold core */
        for (var pass = 0; pass < 2; pass++) {
          ctx.strokeStyle = pass === 0 ? "rgba(255,255,255,0.8)" : "rgba(23,37,84,0.92)";
          ctx.lineWidth = pass === 0 ? 3.4 : 1.8;
          ctx.beginPath();
          if (horiz) { ctx.moveTo(mx(s0), my(a)); ctx.lineTo(mx(mid), my(a)); ctx.lineTo(mx(mid), my(a + jog)); ctx.lineTo(mx(e0), my(a + jog)); }
          else { ctx.moveTo(mx(a), my(s0)); ctx.lineTo(mx(a), my(mid)); ctx.lineTo(mx(a + jog), my(mid)); ctx.lineTo(mx(a + jog), my(e0)); }
          ctx.stroke();
        }
      }
      ctx.lineCap = "butt";
      /* 4. decap coverage rings */
      var cr = (spec.coverR || 20) * sc;
      sources.forEach(function (s) {
        ctx.strokeStyle = "rgba(124,58,237,0.6)"; ctx.setLineDash([4, 3]); ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(mx(s.x), my(s.y), cr, 0, 6.283); ctx.stroke(); ctx.setLineDash([]);
      });
    }

    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx);
      ctx.fillStyle = "#fdfdfd"; ctx.fillRect(mx(0), my(0), core.w * sc, core.h * sc);
      if (spec.dynamic) {
        drawActivity();
      } else {
        var tw = core.w / G, th = core.h / G;
        for (var gy = 0; gy < G; gy++) for (var gx = 0; gx < G; gx++) {
          var x = (gx + 0.5) * tw, y = (gy + 0.5) * th;
          ctx.fillStyle = heatColor(droopAt(spec, sources, x, y) / spec.budget);
          ctx.fillRect(mx(gx * tw), my(gy * th), tw * sc + 0.7, th * sc + 0.7);
        }
      }
      /* bump-array grid sites overlaid as hollow "landing slots" so the
         possible bump locations are obvious */
      if (spec.snapPitch) {
        ctx.strokeStyle = "rgba(60,66,82,0.4)"; ctx.lineWidth = 1;
        gridSites().forEach(function (s) { ctx.beginPath(); ctx.arc(mx(s[0]), my(s[1]), 2.6, 0, Math.PI * 2); ctx.stroke(); });
      }
      /* fixed macros (bump keepouts): no C4 landing over them */
      (spec.macros || []).forEach(function (m) {
        var X = mx(m.x), Y = my(m.y), Wp = m.w * sc, Hp = m.h * sc;
        ctx.fillStyle = "#e7e4db"; ctx.fillRect(X, Y, Wp, Hp);
        ctx.save(); ctx.beginPath(); ctx.rect(X, Y, Wp, Hp); ctx.clip();
        ctx.strokeStyle = "rgba(120,125,135,0.5)"; ctx.lineWidth = 1; ctx.beginPath();
        for (var d = 0; d < Wp + Hp; d += 7) { ctx.moveTo(X + d, Y); ctx.lineTo(X + d - Hp, Y + Hp); }
        ctx.stroke(); ctx.restore();
        ctx.strokeStyle = "#7b8089"; ctx.lineWidth = 1.5; ctx.strokeRect(X, Y, Wp, Hp);
        ctx.fillStyle = "#4b5059"; ctx.font = "bold 10px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(m.label || m.id, X + Wp / 2, Y + Hp / 2); ctx.textBaseline = "alphabetic";
      });
      /* plain hotspot rings only for the non-dynamic (heat-map) mode */
      if (!spec.dynamic) (spec.hotspots || []).forEach(function (h) {
        ctx.strokeStyle = "rgba(180,40,40,0.5)"; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.arc(mx(h.x), my(h.y), (h.sigma || 18) * sc, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      });
      ctx.strokeStyle = "#1a1d26"; ctx.lineWidth = 1.6; ctx.strokeRect(mx(0), my(0), core.w * sc, core.h * sc);
      /* (dynamic mode intentionally has no worst-point marker: read the red
         regions of the map and blanket them) */
      if (res && !res.ok && !spec.dynamic) {
        ctx.strokeStyle = "#dc2626"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(mx(res.peakX), my(res.peakY), 6, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(mx(res.peakX) - 8, my(res.peakY)); ctx.lineTo(mx(res.peakX) + 8, my(res.peakY));
        ctx.moveTo(mx(res.peakX), my(res.peakY) - 8); ctx.lineTo(mx(res.peakX), my(res.peakY) + 8); ctx.stroke();
      }
      /* sources: bumps are round C4 balls; decaps are little capacitor cells */
      var R = spec.sourceR || 7;
      sources.forEach(function (s) {
        var X = mx(s.x), Y = my(s.y);
        if (spec.sourceShape === "rect") {
          var w = 6, h = 4;                                   /* small decap fill-cell body */
          ctx.fillStyle = spec.sourceFill || "rgba(124,58,237,0.9)";
          ctx.strokeStyle = "#2a1a4a"; ctx.lineWidth = 0.9;
          ctx.beginPath(); ctx.rect(X - w, Y - h, 2 * w, 2 * h); ctx.fill(); ctx.stroke();
          /* capacitor-plate glyph inside the cell */
          ctx.strokeStyle = "rgba(255,255,255,0.92)"; ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.moveTo(X - 4, Y); ctx.lineTo(X - 1.5, Y);          /* left lead */
          ctx.moveTo(X - 1.5, Y - h + 1.4); ctx.lineTo(X - 1.5, Y + h - 1.4);   /* plate 1 */
          ctx.moveTo(X + 1.5, Y - h + 1.4); ctx.lineTo(X + 1.5, Y + h - 1.4);   /* plate 2 */
          ctx.moveTo(X + 1.5, Y); ctx.lineTo(X + 4, Y);          /* right lead */
          ctx.stroke();
        } else {
          var grad = ctx.createRadialGradient(X - R * 0.35, Y - R * 0.35, R * 0.2, X, Y, R);
          grad.addColorStop(0, "rgba(120,160,255,0.98)"); grad.addColorStop(1, spec.sourceFill || "rgba(37,99,235,0.95)");
          ctx.fillStyle = grad;
          ctx.beginPath(); ctx.arc(X, Y, R, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = "#fdfdfd"; ctx.lineWidth = 1.5; ctx.stroke();
        }
      });
    }

    function computeScore(res) {
      var margin = Math.max(0, Math.min(1, (spec.budget - res.peakDroop) / spec.budget));
      var total = Math.round(4000 + 6000 * margin);
      var best = total;
      try {
        var key = "mp-best-" + (spec.id || "cover");
        var prev = parseInt(window.localStorage.getItem(key) || "0", 10);
        best = Math.max(prev, total); window.localStorage.setItem(key, String(best));
      } catch (e) { /* private mode */ }
      return { total: total, best: best, margin: Math.round(spec.budget - res.peakDroop) };
    }

    function row(label, ok, detail) {
      return '<div class="mp-row ' + (ok ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (ok ? "✔" : "✗") +
        '</span><span class="mp-label">' + label + '</span><span class="mp-detail">' + detail + '</span></div>';
    }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "PASS" : "not yet") + '</div>';
      html += row(spec.checkLabel || "Peak droop under budget", res.ok, res.peakDroop.toFixed(0) + " / " + spec.budget + " mV");
      html += '<div class="mp-crit-head">' + (sources.length) + ' ' + (spec.sourceName || "sources") + ' to place</div>';
      html += '<div class="mp-crit">' + (spec.hint || "") + '</div>';
      if (res.pass) {
        if (scoreObj) {
          html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div>' +
            '<div class="mp-score-line">droop margin &middot; ' + scoreObj.margin + ' mV</div>' +
            (scoreObj.best > scoreObj.total ? '<div class="mp-score-line">your best: ' + scoreObj.best + '</div>' : '') +
            '<div class="mp-flow-note">Budget met. Even out the droop for a higher score.</div></div>';
        } else {
          html += '<div class="mp-flow mp-flow-ready"><b>Budget met.</b> Click <b>Submit design</b> to score it.</div>';
        }
      } else {
        html += '<div class="mp-score"><span class="mp-score-note">The crosshair marks the worst-droop point. Move a ' + (spec.sourceName2 || "source") + ' toward it.</span></div>';
      }
      panel.innerHTML = html;
    }

    var last = null;
    function refresh() { last = evaluate(spec, sources); draw(last); render(last); bSubmit.disabled = !last.pass; bSubmit.classList.toggle("mp-ready", last.pass); }

    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit design";
    ctrls.insertBefore(bSubmit, bReset);

    /* dragging point sources */
    var drag = null;
    function pt(e) { var r = canvas.getBoundingClientRect(); var cx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left, cy = (e.touches ? e.touches[0].clientY : e.clientY) - r.top; return [(cx - PAD) / sc, (cy - PAD) / sc]; }
    function pick(p) { var R = (spec.sourceR || 7) / sc + 6 / sc, best = null, bd = 1e9; sources.forEach(function (s) { var d = Math.abs(s.x - p[0]) + Math.abs(s.y - p[1]); if (d < bd && d < R + 8) { bd = d; best = s; } }); return best; }
    function down(e) { var p = pt(e), s = pick(p); if (s) { drag = { s: s }; scoreObj = null; e.preventDefault(); } }
    function move(e) {
      if (!drag) return;
      var p = pt(e);
      if (spec.snapPitch) { var s = snapSite(p[0], p[1], drag.s); if (s) { drag.s.x = s[0]; drag.s.y = s[1]; } }
      else { drag.s.x = Math.max(0, Math.min(core.w, p[0])); drag.s.y = Math.max(0, Math.min(core.h, p[1])); }
      refresh(); e.preventDefault();
    }
    function up() { drag = null; }
    canvas.addEventListener("mousedown", down); window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    canvas.addEventListener("touchstart", down, { passive: false }); canvas.addEventListener("touchmove", move, { passive: false }); canvas.addEventListener("touchend", up);

    bSubmit.addEventListener("click", function () { if (last && last.pass) { scoreObj = computeScore(last); render(last); } });
    bReset.addEventListener("click", function () { sources = spec.init.map(function (p) { return { x: p.x, y: p.y }; }); scoreObj = null; refresh(); });

    refresh();
  }

  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.PDNCover = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
