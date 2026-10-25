/* The front page's "try it" band: riscv32i through the browser engine, with
   two of its knobs. It reads the design's own file (window.DESIGN, from
   designs/riscv32i.js) for the knobs and the real run, and runs the same
   worker as the design page, so the numbers here match that page exactly.
   Nothing loads until the first press of Run: the netlist and library are
   about 1.8 MB between them. */

(function () {
  "use strict";
  var root = document.getElementById("try"), D = window.DESIGN;
  if (!root || !D || !D.engine) return;
  var E = D.engine, ref = E.reference;
  var SHOWN = ["period", "util", "macros"];        /* the knobs offered here; the rest stay at the flow's values */
  var SHORT = { macros: "Memories" };              /* labels shortened to fit one line here */
  var COLORS = ["#94a3b8", "#8b5cf6", "#2563eb", "#0d9488", "#0891b2", "#d97706", "#475569", "#64748b"];
  var STAGES = ["floorplan", "placement", "cts", "routing", "timing", "finish"];

  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function fmt(n) { return Math.round(n).toLocaleString("en-US"); }
  function f1(n) { return (Math.round(n * 10) / 10).toFixed(1); }
  function ps(v) { return (v < 0 ? "−" : "+") + f1(Math.abs(v)) + " ps"; }

  /* ----- the knobs and the run button ----- */
  var state = {}, ctl = root.querySelector("#hc-try-ctl");
  E.knobs.forEach(function (k) { state[k.k] = k.value; });
  ctl.innerHTML = E.knobs.filter(function (k) { return SHOWN.indexOf(k.k) >= 0; }).map(function (k) {
    var input = k.kind === "select"
      ? '<select data-k="' + k.k + '">' + k.options.map(function (o) {
          return '<option value="' + o[0] + '"' + (o[0] === k.value ? " selected" : "") + ">" + esc(o[1]) + "</option>";
        }).join("") + "</select>"
      : '<input type="range" data-k="' + k.k + '" min="' + k.min + '" max="' + k.max + '" step="' + k.step +
        '" value="' + k.value + '"><output data-o="' + k.k + '"></output>';
    return '<label class="hc-try-knob" title="' + esc(k.help) + '"><span class="hc-try-kname">' + esc(SHORT[k.k] || k.label) + "</span>" +
      input + "</label>";
  }).join("") +
    '<div class="hc-try-go"><button class="cc-btn cc-btn-primary" type="button" id="hc-try-run">Run the flow</button>' +
    '<span class="hc-try-status" id="hc-try-status" aria-live="polite"></span></div>';
  function show(k) {
    var o = ctl.querySelector('[data-o="' + k + '"]');
    o.textContent = k === "util" ? Math.round(state.util * 100) + "%" : fmt(state[k]) + " ps";
  }
  ["period", "util"].forEach(show);
  ctl.addEventListener("input", function (ev) {
    var k = ev.target.getAttribute("data-k");
    if (!k) return;
    if (ev.target.tagName === "SELECT") state[k] = ev.target.value;
    else { state[k] = +ev.target.value; show(k); }
  });
  var status = ctl.querySelector("#hc-try-status"), runBtn = ctl.querySelector("#hc-try-run");
  runBtn.addEventListener("click", run);
  /* the button beside the 3D still runs the same flow */
  var run3d = root.querySelector("#hc-try-run3d");
  if (run3d) run3d.addEventListener("click", function () { if (!runBtn.disabled) run(); });

  /* ----- the stages, the picture and the numbers ----- */
  var canvas = root.querySelector("#hc-try-canvas"), still = root.querySelector("#hc-try-still");
  var label = root.querySelector("#hc-try-label"), legendEl = root.querySelector("#hc-try-legend");
  var table = root.querySelector("#hc-try-table");
  /* a stage's progress ("run" or "done") is kept apart from which stage the
     picture shows, so the two never overwrite each other */
  function stage(k, st) {
    var li = root.querySelector('.hc-try-stages [data-stage="' + k + '"]');
    if (li) li.setAttribute("data-state", st || "");
  }

  var ROWS = [
    ["Die", function (R) { return f1(R.metrics.die.W) + " µm square"; }, f1(ref.die) + " µm square"],
    ["Wire, routed", function (R) { return fmt(R.route.total) + " µm"; }, fmt(ref.route.global) + " µm"],
    ["Clock tree buffers", function (R) { return fmt(R.cts.buffers); }, fmt(ref.cts.buffers)],
    ["Worst slack", function (R) {
      return ps(R.timing.wns) + (R.timing.wns >= 0 ? ' <span class="hc-try-ok">met</span>' : ' <span class="hc-try-bad">missed</span>');
    }, ps(ref.timing.wns)],
    ["Power", function (R) { return (R.power.total * 1e3).toFixed(1) + " mW"; }, ref.power.total.toFixed(1) + " mW"],
    ["Time to run", function (R) {
      return (Object.keys(R.ms).reduce(function (a, k) { return a + R.ms[k]; }, 0) / 1000).toFixed(1) + " s";
    }, ref.runSeconds ? "about " + Math.round(ref.runSeconds / 60) + " minutes" : ""],
  ];
  function fill(R) {
    table.innerHTML = '<thead><tr><th></th><th>Your run</th><th>Real OpenROAD run</th></tr></thead><tbody>' +
      ROWS.map(function (r) {
        return "<tr><th>" + r[0] + "</th><td>" + (R ? r[1](R) : '<span class="hc-try-dim">·</span>') +
          "</td><td>" + r[2] + "</td></tr>";
      }).join("") + "</tbody>";
  }
  fill(null);

  /* ----- running ----- */
  var worker = null, runId = 0, last = null, timer = null, busy = false;
  var NEXT = { floorplan: "placement", placement: "cts", cts: "routing", routing: "timing", timing: "finish" };
  function run() {
    if (!worker) {
      worker = new Worker(E.worker);
      worker.onmessage = onMessage;
      status.textContent = "loading the netlist and library";
    } else status.textContent = "running";
    runId++;
    if (timer) { clearInterval(timer); timer = null; }
    runBtn.disabled = true;
    busy = true;
    STAGES.forEach(function (s, i) { stage(s, i ? "" : "run"); });
    pick(null);
    worker.postMessage({ type: "run", id: runId, net: E.net, lib: E.lib, knobs: state, want3d: true });
  }
  function onMessage(ev) {
    var msg = ev.data;
    if (msg.type === "error") {
      status.textContent = "the engine stopped: " + msg.message;
      runBtn.disabled = false; busy = false; pick(shown);
      return;
    }
    if (msg.id !== runId) return;
    if (msg.type === "progress") {
      var p = msg.p;
      if (p.stage === "floorplan") { stage("floorplan", "done"); stage("placement", "run"); }
      if (p.step) status.textContent = "placing: " + p.step.label;
      if (p.done) {
        stage(p.stage, "done");
        if (NEXT[p.stage]) stage(NEXT[p.stage], "run");
        status.textContent = { placement: "building the clock tree", cts: "routing", routing: "repairing and timing",
                               timing: "power and finishing" }[p.stage] || status.textContent;
      }
      return;
    }
    last = msg;
    busy = false;
    STAGES.forEach(function (s) { stage(s, "done"); });
    runBtn.disabled = false;
    runBtn.textContent = "Run it again";
    status.textContent = "done. Click a stage to see it";
    fill(msg);
    still.hidden = true;
    canvas.hidden = false;
    replay();
    draw3d(msg);
  }

  /* ----- the three-dimensional view under the band: its code, and the
     graphics library under it, load with the first finished run ----- */
  var host3d = root.querySelector("#hc-try-3dhost"), view3d = null;
  var VERSION = (document.currentScript && document.currentScript.src.split("?")[1]) || "";
  function draw3d(msg) {
    if (!view3d) {
      view3d = import("/static/explore/layout3d.js" + (VERSION ? "?" + VERSION : "")).then(function (m) {
        return m.mountLayout3D(host3d);
      });
    }
    view3d.then(function (v) { v.update(msg); }).catch(function (e) {
      host3d.innerHTML = '<div class="hc-try-3dwait">this browser could not draw it: ' + esc(e && e.message || e) + "</div>";
    });
  }

  /* ----- the picture: each stage of the run, one at a time. A finished run
     plays placement spreading the cells out, then lands on the clock tree;
     after that, each stage's button shows that stage. ----- */
  var shown = null;
  function pick(k) {
    shown = k;
    root.querySelectorAll(".hc-try-stages button").forEach(function (b) {
      var on = b.parentNode.getAttribute("data-stage") === k;
      b.disabled = !last || busy;
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }
  root.querySelector(".hc-try-stages").addEventListener("click", function (ev) {
    var b = ev.target.closest("button");
    if (!b || !last || busy) return;
    var k = b.parentNode.getAttribute("data-stage");
    if (timer) { clearInterval(timer); timer = null; }
    if (k === "placement") replay(false);
    else { pick(k); draw(k); }
  });

  function replay(thenClock) {
    var R = last, k = 0, n = R.frames.length;
    pick("placement");
    draw("placement", 0);
    timer = setInterval(function () {
      k++;
      if (k <= n) draw("placement", k);
      else {
        clearInterval(timer); timer = null;
        if (thenClock !== false) { pick("cts"); draw("cts"); }
      }
    }, 180);
  }

  /* one picture per stage; k is the placement iteration while it plays */
  function draw(view, k) {
    var R = last, fp = R.fp, mg = (fp.die.W - fp.W) / 2;
    var dpr = window.devicePixelRatio || 1, size = canvas.clientWidth || 460;
    if (canvas.width !== Math.round(size * dpr)) { canvas.width = Math.round(size * dpr); canvas.height = canvas.width; }
    var ctx = canvas.getContext("2d"), S = canvas.width / fp.die.W, h = fp.rowH;
    function X(x) { return (mg + x) * S; }
    function Y(y) { return canvas.height - (mg + y) * S; }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#eef1f4"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff"; ctx.fillRect(X(0), Y(fp.H), fp.W * S, fp.H * S);

    /* the floorplan shows the empty rows; the finished chip has every gap on
       them filled with filler cells, drawn as the rows' own shade */
    if (view === "floorplan" || view === "finish") {
      ctx.fillStyle = view === "finish" ? "#dfe4ea" : "rgba(148, 163, 184, 0.35)";
      for (var r = 0; r < fp.rows; r++) {
        if (view === "finish") ctx.fillRect(X(0), Y((r + 1) * h), fp.W * S, Math.max(0.6, h * S - 0.4 * dpr));
        else if (r % 2 === 0) ctx.fillRect(X(0), Y((r + 1) * h), fp.W * S, Math.max(0.5, h * S));
      }
    }
    ctx.strokeStyle = "#b8692e"; ctx.lineWidth = Math.max(1, dpr); ctx.strokeRect(X(0), Y(fp.H), fp.W * S, fp.H * S);
    fp.macros.forEach(function (m) {
      if (view === "floorplan") {                 /* the halo the cells must keep clear of */
        ctx.setLineDash([4 * dpr, 3 * dpr]); ctx.strokeStyle = "#94a3b8";
        ctx.strokeRect(X(m.x - 2), Y(m.y + m.h + 2), (m.w + 4) * S, (m.h + 4) * S);
        ctx.setLineDash([]);
      }
      ctx.fillStyle = "#64748b"; ctx.fillRect(X(m.x), Y(m.y + m.h), m.w * S, m.h * S);
      ctx.strokeStyle = "#334155"; ctx.strokeRect(X(m.x), Y(m.y + m.h), m.w * S, m.h * S);
    });
    ctx.fillStyle = "#7c3aed";
    var tick = Math.max(3 * dpr, mg * S * 0.6);
    fp.pins.forEach(function (p) {
      var side = p.side || "b";
      if (side === "b") ctx.fillRect(X(p.x) - 0.6 * dpr, Y(0), 1.2 * dpr, tick);
      else if (side === "t") ctx.fillRect(X(p.x) - 0.6 * dpr, Y(fp.H) - tick, 1.2 * dpr, tick);
      else if (side === "l") ctx.fillRect(X(0) - tick, Y(p.y) - 0.6 * dpr, tick, 1.2 * dpr);
      else ctx.fillRect(X(fp.W), Y(p.y) - 0.6 * dpr, tick, 1.2 * dpr);
    });

    /* the cells: none yet at the floorplan, in colour for placement and the
       finished chip, faint under what the other stages draw */
    if (view !== "floorplan") {
      var spreading = view === "placement" && k !== undefined && k < R.frames.length;
      var P = spreading ? R.frames[k] : R.legal, faint = view === "cts" || view === "routing" || view === "timing";
      for (var i = 0; i < P.x.length; i++) {
        ctx.fillStyle = faint ? "#cbd5e1" : COLORS[R.group[i]];
        ctx.globalAlpha = faint ? (view === "timing" ? 0.45 : 0.8) : spreading ? 0.7 : 0.95;
        var w = R.w[i];
        ctx.fillRect(X(P.x[i] - w / 2), Y(P.y[i] + h / 2), Math.max(0.8, w * S), Math.max(0.8, h * S));
      }
      ctx.globalAlpha = 1;
    }
    if (view === "cts") drawClock(ctx, R, X, Y, dpr);
    if (view === "routing") {
      var Rt = R.route;
      for (var j = 0; j < Rt.ny; j++) for (var q = 0; q < Rt.nx; q++) {
        var col = heat(Rt.ratio[j * Rt.nx + q]);
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(X(q * Rt.gc), Y((j + 1) * Rt.gc), Rt.gc * S + 0.5, Rt.gc * S + 0.5);
      }
    }
    if (view === "timing") drawPath(ctx, R, X, Y, dpr);
    caption(view, k);
  }

  function heat(r) {                               /* routing demand over capacity, as a colour */
    if (r < 0.5) return null;
    if (r < 0.8) return "rgba(250, 204, 21, " + (0.25 + (r - 0.5)) + ")";
    if (r < 1.0) return "rgba(249, 115, 22, 0.65)";
    return "rgba(220, 38, 38, 0.85)";
  }
  function drawClock(ctx, R, X, Y, dpr) {
    var s = R.cts.segs, LEVEL = ["#1e3a8a", "#1d4ed8", "#3b82f6", "#60a5fa", "#93c5fd"];
    for (var i = 0; i < s.length; i += 5) {
      var lv = s[i + 4];
      if (lv === 9) continue;                      /* the wires into each flip-flop are too fine to read here */
      ctx.strokeStyle = lv < 0 ? "#7c3aed" : LEVEL[Math.min(LEVEL.length - 1, lv)];
      ctx.lineWidth = (lv < 0 ? 1.6 : Math.max(1, 2.6 - 0.4 * lv)) * dpr;
      ctx.beginPath();
      ctx.moveTo(X(s[i]), Y(s[i + 1])); ctx.lineTo(X(s[i + 2]), Y(s[i + 1])); ctx.lineTo(X(s[i + 2]), Y(s[i + 3]));
      ctx.stroke();
    }
    var b = R.cts.bufs;
    for (i = 0; i < b.length; i += 3) {
      var kind = b[i + 2], sz = (kind === 1 ? 3 : 4.5) * dpr;
      ctx.fillStyle = kind === 1 ? "#d97706" : kind === 2 ? "#7c3aed" : "#1e3a8a";
      ctx.fillRect(X(b[i]) - sz / 2, Y(b[i + 1]) - sz / 2, sz, sz);
    }
  }
  /* the worst path: pins in order (where it launches, each gate's input and
     output, where it ends), each wire drawn across then up or down and
     coloured by when the signal gets there, early teal to late red */
  function drawPath(ctx, R, X, Y, dpr) {
    var p = R.timing.path;
    if (!p.length) return;
    var t0 = p[0].t, span = Math.max(1, p[p.length - 1].t - t0);
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    for (var i = 1; i < p.length; i++) {
      var a = p[i - 1], b = p[i], col = timeColour(Math.max(0, Math.min(1, ((a.t + b.t) / 2 - t0) / span)));
      ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 5 * dpr;
      ctx.beginPath(); ctx.moveTo(X(a.x), Y(a.y)); ctx.lineTo(X(b.x), Y(a.y)); ctx.lineTo(X(b.x), Y(b.y)); ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = 2.4 * dpr;
      ctx.beginPath(); ctx.moveTo(X(a.x), Y(a.y)); ctx.lineTo(X(b.x), Y(a.y)); ctx.lineTo(X(b.x), Y(b.y)); ctx.stroke();
    }
    [[p[0], "#0d9488"], [p[p.length - 1], "#dc2626"]].forEach(function (e) {
      ctx.fillStyle = "#fff"; ctx.strokeStyle = e[1]; ctx.lineWidth = 2.5 * dpr;
      ctx.beginPath(); ctx.arc(X(e[0].x), Y(e[0].y), 6 * dpr, 0, 7); ctx.fill(); ctx.stroke();
    });
  }
  function timeColour(f) {
    var a = [13, 148, 136], b = [245, 158, 11], c = [220, 38, 38], u = f < 0.5 ? f * 2 : (f - 0.5) * 2;
    var x = f < 0.5 ? a : b, y = f < 0.5 ? b : c;
    return "rgb(" + [0, 1, 2].map(function (k) { return Math.round(x[k] + (y[k] - x[k]) * u); }).join(",") + ")";
  }

  /* what the picture shows, in words, and its key */
  function caption(view, k) {
    var R = last, items = [];
    function sw(c, t) { items.push('<span><i style="background:' + c + '"></i>' + t + "</span>"); }
    var text = "";
    if (view === "floorplan") {
      text = "Floorplan: a " + f1(R.metrics.die.W) + " µm die, " + fmt(R.fp.rows) + " empty rows, the memories and the pins";
      sw("rgba(148, 163, 184, 0.6)", "rows"); sw("#64748b", "memories (" + R.fp.macros.length + ")");
      sw("#7c3aed", "pins (" + fmt(R.fp.pins.length) + ")");
    } else if (view === "placement") {
      var spreading = k !== undefined && k < R.frames.length;
      text = spreading ? "Placement, " + R.history[k].label + ": the cells spreading out"
                       : "Placement: all " + fmt(R.legal.x.length) + " cells on rows";
      var used = {};
      for (var i = 0; i < R.group.length; i++) used[R.group[i]] = 1;
      Object.keys(used).forEach(function (g) { sw(COLORS[g], esc(R.groups[g])); });
    } else if (view === "cts") {
      text = "Clock tree: " + fmt(R.cts.buffers) + " buffers in a " + R.cts.levels + "-level H-tree";
      sw("#1e3a8a", "clock branches"); sw("#d97706", "cluster buffers (" + fmt(R.cts.clusters) + ")");
    } else if (view === "routing") {
      text = "Routing: " + fmt(R.route.total) + " µm of wire, and how full each 1 µm tile is";
      sw("rgba(250, 204, 21, 0.5)", "half to 80% full"); sw("rgba(249, 115, 22, 0.65)", "80 to 100%");
      sw("rgba(220, 38, 38, 0.85)", "more wires than tracks");
    } else if (view === "timing") {
      text = "Timing: the worst path, slack " + ps(R.timing.wns);
      sw("#0d9488", "where it starts"); sw("#dc2626", "where it must arrive in time");
    } else {
      text = "Finished: every gap on the rows filled, about " + fmt(R.finish.fillers) + " filler cells";
      sw("#dfe4ea", "fillers"); sw(COLORS[1], "cells, coloured by block as in Place");
    }
    if (view !== "floorplan") sw("#64748b", "memories");
    label.textContent = text;
    legendEl.innerHTML = items.join("");
  }
  window.addEventListener("resize", function () {
    if (last && !timer && shown) draw(shown);
  });
})();
