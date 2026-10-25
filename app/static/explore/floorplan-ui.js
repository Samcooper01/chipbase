/* Interactive layer for the floorplan sandbox explorable: canvas
   rendering, macro dragging and rotation, the sliders, and the stats
   panel. All geometry and forecasting lives in floorplan-core.js. */

(function () {
  "use strict";

  var F = FloorplanCore;
  var CW = 680, CH = 560;  /* canvas size, screen pixels */
  var MARGIN = 30;         /* room outside the die for the pin-group labels */

  var MACRO_COLORS = { A: "#16a34a", B: "#2563eb", C: "#d97706", D: "#db2777" };
  var RED = "#dc2626";

  var canvas = document.getElementById("fp-canvas");
  var ctx = canvas.getContext("2d");

  /* Canvas palette from the page's --cv-* variables (the Sandboxes
     theme sets them), falling back to the light site palette. */
  function themeColor(name, fallback) {
    var v = getComputedStyle(canvas).getPropertyValue(name).trim();
    return v || fallback;
  }
  var T = {
    bg: themeColor("--cv-bg", "#f3f4f6"),
    die: themeColor("--cv-die", "#fdfdfd"),
    grid: themeColor("--cv-grid", "rgba(15,23,42,0.05)"),
    block: themeColor("--cv-block", "#c3cad4"),
    blockEdge: themeColor("--cv-block-edge", "#8b94a3"),
    ink: themeColor("--cv-ink", "#1a1d26"),
    muted: themeColor("--cv-muted", "#5f6470"),
    halo: themeColor("--cv-halo", "rgba(95,100,112,0.55)"),
    outline: themeColor("--cv-outline", "#1a1d26"),
    ring: themeColor("--cv-ring", "#ffffff"),
    port: themeColor("--cv-port", "#7c3aed"),
  };
  var INK = T.ink, MUT = T.muted, PORT = T.port;
  var statsEl = document.getElementById("fp-stats");
  var hintEl = document.getElementById("fp-hint");
  var utilEl = document.getElementById("fp-util");
  var arEl = document.getElementById("fp-ar");

  var state = {
    util: 0.70,
    ar: 1.0,
    forecast: "rudy",
    showWires: false,
    macros: [],
    presets: F.presets(),
  };
  var result = null;
  var view = { s: 1, ox: 0, oy: 0 };  /* micrometers to pixels */
  var drag = null;

  /* ----- setup ----- */

  function setupCanvas() {
    var dpr = window.devicePixelRatio || 1;
    canvas.style.width = CW + "px";
    canvas.style.height = CH + "px";
    canvas.width = CW * dpr;
    canvas.height = CH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function loadPreset(key) {
    state.macros = state.presets[key].macros.map(function (m) {
      return { id: m.id, cx: m.cx, cy: m.cy, rot: m.rot };
    });
    update();
  }

  function update() {
    result = F.evaluate(state);
    var d = result.die;
    view.s = Math.min((CW - 2 * MARGIN) / d.w, (CH - 2 * MARGIN) / d.h);
    view.ox = (CW - d.w * view.s) / 2;
    view.oy = (CH - d.h * view.s) / 2;
    draw();
    updateStats();
  }

  function X(um) { return view.ox + um * view.s; }
  function Y(um) { return view.oy + um * view.s; }

  /* ----- drawing ----- */

  /* congestion ramp: transparent below half-used, then green, amber,
     red, saturating at 130% of supply */
  function heat(r) {
    if (r < 0.5) return null;
    var t = Math.min(1, (r - 0.5) / 0.8);
    var c0, c1, u;
    if (t < 0.5) { c0 = [22, 163, 74]; c1 = [217, 119, 6]; u = t / 0.5; }
    else { c0 = [217, 119, 6]; c1 = [220, 38, 38]; u = (t - 0.5) / 0.5; }
    var rgb = c0.map(function (v, i) { return Math.round(v + (c1[i] - v) * u); });
    return "rgba(" + rgb.join(",") + "," + (0.15 + 0.55 * t).toFixed(3) + ")";
  }

  function draw() {
    var d = result.die, bw = d.bw, bh = d.bh, s = view.s;
    ctx.fillStyle = T.bg;
    ctx.fillRect(0, 0, CW, CH);
    ctx.fillStyle = T.die;
    ctx.fillRect(X(0), Y(0), d.w * s, d.h * s);

    /* congestion heat map, one square per forecast bin */
    for (var b = 0; b < result.ratio.length; b++) {
      var col = heat(result.ratio[b]);
      if (!col) continue;
      var bx = b % d.nx, by = (b / d.nx) | 0;
      ctx.fillStyle = col;
      ctx.fillRect(X(bx * bw), Y(by * bh), bw * s + 0.5, bh * s + 0.5);
    }

    /* faint bin grid */
    ctx.strokeStyle = T.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var gx = 0; gx <= d.nx; gx++) { ctx.moveTo(X(gx * bw), Y(0)); ctx.lineTo(X(gx * bw), Y(d.h)); }
    for (var gy = 0; gy <= d.ny; gy++) { ctx.moveTo(X(0), Y(gy * bh)); ctx.lineTo(X(d.w), Y(gy * bh)); }
    ctx.stroke();

    if (state.showWires) drawWires();

    /* macros: halo, body, pin edge, label */
    var bad = overlapping();
    result.macros.forEach(function (m) {
      var color = MACRO_COLORS[m.id];
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = T.halo;
      ctx.lineWidth = 1;
      ctx.strokeRect(X(m.x - F.HALO), Y(m.y - F.HALO), (m.w + 2 * F.HALO) * s, (m.h + 2 * F.HALO) * s);
      ctx.setLineDash([]);

      ctx.fillStyle = T.block;
      ctx.globalAlpha = drag && drag.id === m.id ? 0.8 : 1;
      ctx.fillRect(X(m.x), Y(m.y), m.w * s, m.h * s);
      ctx.globalAlpha = 1;
      ctx.lineWidth = bad[m.id] ? 2.5 : 1;
      ctx.strokeStyle = bad[m.id] ? RED : T.blockEdge;
      ctx.strokeRect(X(m.x), Y(m.y), m.w * s, m.h * s);

      var p = m.pin;
      ctx.strokeStyle = color;
      ctx.lineWidth = 5;
      ctx.lineCap = "butt";
      ctx.beginPath();
      ctx.moveTo(X(p.x0), Y(p.y0));
      ctx.lineTo(X(p.x1), Y(p.y1));
      ctx.stroke();

      ctx.fillStyle = INK;
      ctx.font = "600 12px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(m.label, X(m.x + m.w / 2), Y(m.y + m.h / 2) - 7);
      ctx.fillStyle = MUT;
      ctx.font = "11px system-ui, sans-serif";
      ctx.fillText("pins " + sideWord(m.side), X(m.x + m.w / 2), Y(m.y + m.h / 2) + 8);
    });

    /* input/output pin groups on the die boundary */
    F.PORTS.forEach(function (p) {
      var seg = F.portSegment(p, d);
      ctx.strokeStyle = PORT;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(X(seg.x0), Y(seg.y0));
      ctx.lineTo(X(seg.x1), Y(seg.y1));
      ctx.stroke();
      ctx.fillStyle = PORT;
      ctx.font = "600 11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      var mx = (seg.x0 + seg.x1) / 2, my = (seg.y0 + seg.y1) / 2;
      if (p.side === "N") ctx.fillText(p.label, X(mx), Y(0) - 12);
      else {
        ctx.save();
        ctx.translate(p.side === "W" ? X(0) - 13 : X(d.w) + 13, Y(my));
        ctx.rotate(p.side === "W" ? -Math.PI / 2 : Math.PI / 2);
        ctx.fillText(p.label, 0, 0);
        ctx.restore();
      }
    });

    /* logic clusters: one controller per memory, plus the hub */
    F.CLUSTERS.forEach(function (c) {
      var pt = result.clusters[c];
      var hub = c === "hub";
      ctx.beginPath();
      ctx.arc(X(pt.x), Y(pt.y), hub ? 9 : 6, 0, Math.PI * 2);
      ctx.fillStyle = hub ? INK : MACRO_COLORS[c];
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = T.ring;
      ctx.stroke();
      if (hub) {
        ctx.fillStyle = INK;
        ctx.font = "600 11px system-ui, sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText("hub", X(pt.x) + 12, Y(pt.y));
      }
    });

    /* die outline last, so it sits on top */
    ctx.strokeStyle = T.outline;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(X(0), Y(0), d.w * s, d.h * s);
  }

  function netColor(net) {
    var n = F.NETS[net];
    if (n.a.macro) return MACRO_COLORS[n.a.macro];
    if (n.a.cluster && n.a.cluster !== "hub") return MACRO_COLORS[n.a.cluster];
    return PORT;
  }

  /* RUDY (Rectangular Uniform wire DensitY) mode: straight fly lines,
     one per connection. Trial-route mode: the routed paths themselves. */
  function drawWires() {
    var d = result.die, bw = d.bw, bh = d.bh;
    ctx.save();
    ctx.lineWidth = 1.2;
    if (result.routes) {
      result.routes.forEach(function (r, i) {
        var x = r.from % d.nx, y = (r.from / d.nx) | 0;
        ctx.strokeStyle = netColor(result.conns[i].net);
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        ctx.moveTo(X((x + 0.5) * bw), Y((y + 0.5) * bh));
        /* edges come in travel order: step to whichever end of the
           next edge is not the pen's current bin */
        r.route.forEach(function (id) {
          var ex, ey, ex2, ey2;
          if (id > 0) {
            var e = id - 1, row = (e / (d.nx - 1)) | 0, col = e % (d.nx - 1);
            ex = col; ey = row; ex2 = col + 1; ey2 = row;
          } else {
            var v = -id - 1, vr = (v / d.nx) | 0, vc = v % d.nx;
            ex = vc; ey = vr; ex2 = vc; ey2 = vr + 1;
          }
          if (ex === x && ey === y) { x = ex2; y = ey2; }
          else { x = ex; y = ey; }
          ctx.lineTo(X((x + 0.5) * bw), Y((y + 0.5) * bh));
        });
        ctx.stroke();
      });
    } else {
      result.conns.forEach(function (c) {
        ctx.strokeStyle = netColor(c.net);
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.moveTo(X(c.a.x), Y(c.a.y));
        ctx.lineTo(X(c.b.x), Y(c.b.y));
        ctx.stroke();
      });
    }
    ctx.restore();
  }

  function sideWord(side) {
    return { N: "up", S: "down", E: "right", W: "left" }[side];
  }

  function overlapping() {
    var bad = {}, ms = result.macros;
    for (var i = 0; i < ms.length; i++) {
      for (var j = i + 1; j < ms.length; j++) {
        var a = ms[i], b = ms[j];
        if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) {
          bad[a.id] = true; bad[b.id] = true;
        }
      }
    }
    return bad;
  }

  /* ----- stats ----- */

  function pct(v) { return Math.round(v * 100) + "%"; }

  function updateStats() {
    var m = result.metrics, d = result.die;
    var rows = [
      "die " + d.w + " × " + d.h + " micrometers (" +
        (m.coreArea / 1e6).toFixed(3) + " square millimeters)",
      "core utilization " + pct(m.util) + " (cells plus macros ÷ core); " +
        "cell density in the space left free " + pct(m.density),
      "estimated wirelength " + (m.hpwl / 1000).toFixed(1) + " millimeters (half-perimeter)" +
        (m.routedWL !== null ? "; trial-routed " + (m.routedWL / 1000).toFixed(1) + " millimeters" : ""),
      "peak congestion " + pct(m.peak) + " of supply; " +
        m.overPct.toFixed(1) + "% of bins over 100%",
    ];
    var html = rows.map(function (r) { return '<div class="mstat-row">' + r + "</div>"; }).join("");
    if (result.warnings.length) {
      html += '<div class="mstat-total">' + result.warnings.map(function (w) {
        return '<div><span class="mstat-fail">illegal:</span> ' + w + "</div>";
      }).join("") + "</div>";
    } else {
      html += '<div class="mstat-total">floorplan is legal</div>';
    }
    statsEl.innerHTML = html;
    document.getElementById("fp-util-val").textContent = Math.round(state.util * 100) + "%";
    document.getElementById("fp-ar-val").textContent = state.ar.toFixed(2);
  }

  function hint(text) {
    hintEl.textContent = text;
    setTimeout(function () {
      if (hintEl.textContent === text) hintEl.textContent = "";
    }, 4000);
  }

  /* ----- dragging and rotating ----- */

  function toMicrometers(ev) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: (ev.clientX - rect.left - view.ox) / view.s,
      y: (ev.clientY - rect.top - view.oy) / view.s,
      px: ev.clientX, py: ev.clientY,
    };
  }

  function macroAt(p) {
    for (var i = result.macros.length - 1; i >= 0; i--) {
      var m = result.macros[i];
      if (p.x >= m.x && p.x < m.x + m.w && p.y >= m.y && p.y < m.y + m.h) return m;
    }
    return null;
  }

  function stateOf(id) {
    for (var i = 0; i < state.macros.length; i++) if (state.macros[i].id === id) return state.macros[i];
    return null;
  }

  canvas.addEventListener("pointerdown", function (ev) {
    var p = toMicrometers(ev);
    var m = macroAt(p);
    if (!m) return;
    canvas.setPointerCapture(ev.pointerId);
    drag = { id: m.id, dx: p.x - (m.x + m.w / 2), dy: p.y - (m.y + m.h / 2),
             sx: p.px, sy: p.py, moved: false };
    draw();
  });

  canvas.addEventListener("pointermove", function (ev) {
    var p = toMicrometers(ev);
    if (!drag) {
      canvas.style.cursor = macroAt(p) ? "grab" : "default";
      return;
    }
    if (!drag.moved && Math.abs(p.px - drag.sx) + Math.abs(p.py - drag.sy) < 4) return;
    drag.moved = true;
    canvas.style.cursor = "grabbing";
    var ms = stateOf(drag.id), d = result.die;
    ms.cx = (p.x - drag.dx) / d.w;
    ms.cy = (p.y - drag.dy) / d.h;
    update();
  });

  function endDrag() {
    if (!drag) return;
    var id = drag.id, moved = drag.moved;
    drag = null;
    if (!moved) {
      /* a click without a drag turns the macro a quarter turn clockwise */
      var ms = stateOf(id);
      ms.rot = (ms.rot + 1) % 4;
    } else {
      /* store the snapped, clamped position so the macro stays put */
      var g = null;
      result.macros.forEach(function (m) { if (m.id === id) g = m; });
      var s = stateOf(id), d = result.die;
      s.cx = (g.x + g.w / 2) / d.w;
      s.cy = (g.y + g.h / 2) / d.h;
    }
    canvas.style.cursor = "grab";
    update();
  }
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  /* ----- controls ----- */

  utilEl.addEventListener("input", function () {
    state.util = +utilEl.value / 100;
    update();
  });
  arEl.addEventListener("input", function () {
    state.ar = +arEl.value / 100;
    update();
  });

  document.getElementById("fp-preset").addEventListener("change", function (ev) {
    loadPreset(ev.target.value);
  });
  document.getElementById("fp-reset").addEventListener("click", function () {
    state.util = 0.70; state.ar = 1.0;
    utilEl.value = 70; arEl.value = 100;
    loadPreset(document.getElementById("fp-preset").value);
    hint("Preset restored at 70% utilization, square die.");
  });

  document.querySelectorAll("input[name='fp-forecast']").forEach(function (radio) {
    radio.addEventListener("change", function (ev) {
      state.forecast = ev.target.value;
      update();
    });
  });
  document.getElementById("fp-wires").addEventListener("change", function (ev) {
    state.showWires = ev.target.checked;
    draw();
  });

  /* ----- go ----- */

  setupCanvas();
  loadPreset("middle");
})();
