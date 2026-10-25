/* The live part of a design page: the knobs, the browser engine running in
   a worker, and the result drawn as it comes back. The engine's numbers are
   shown beside a real run of the flow, so it is always clear which is which. */

/* the version stamp this script was loaded with, passed on to the modules
   it loads later so a new release is never served from an old cache */
var DESIGN_ENGINE_VERSION = (document.currentScript && document.currentScript.src.split("?")[1]) || "";

window.DesignEngineUI = function (D, root) {
  "use strict";
  var E = D.engine, knobsEl = root.querySelector("#dz-knobs"), resEl = root.querySelector("#dz-result");
  var worker = new Worker(E.worker), runId = 0, last = null, frame = -1, playing = null, view = "cells";
  var COLORS = ["#94a3b8", "#8b5cf6", "#2563eb", "#0d9488", "#0891b2", "#d97706", "#475569", "#64748b"];
  var STAGES = ["floorplan", "placement", "cts", "routing", "timing", "finish"];

  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function fmt(n) { return Math.round(n).toLocaleString("en-US"); }
  function f1(n) { return (Math.round(n * 10) / 10).toFixed(1); }
  function mw(w) { return (w * 1e3).toFixed(2) + " mW"; }
  function ps(v) { return (v < 0 ? "−" : "") + f1(Math.abs(v)) + " ps"; }

  /* ----- the knobs ----- */
  var state = {};
  knobsEl.innerHTML = '<div class="dz-engine-note"><strong>These numbers come from a simplified engine running in ' +
    "your browser, not from OpenROAD.</strong> It works on this design's real synthesized netlist and the real " +
    "library's cell sizes, delays and energies, and runs smaller versions of the real algorithms, so the whole flow " +
    "takes a few seconds. Each result is shown beside a real run of the flow, so you can see how close it gets. " +
    '<a href="#dz-how">How the engine works, and what it leaves out</a>.</div>' +
    '<div class="dz-knobs">' + E.knobs.map(function (k) {
      state[k.k] = k.value;
      var ctl = k.kind === "select"
        ? '<select data-k="' + k.k + '">' + k.options.map(function (o) {
            return '<option value="' + o[0] + '"' + (o[0] === k.value ? " selected" : "") + ">" + esc(o[1]) + "</option>";
          }).join("") + "</select>"
        : '<input type="range" data-k="' + k.k + '" min="' + k.min + '" max="' + k.max + '" step="' + k.step +
          '" value="' + k.value + '"><output data-o="' + k.k + '"></output>';
      return '<label class="dz-knob"><span class="dz-kname">' + esc(k.label) + "</span>" + ctl +
        '<span class="dz-khelp">' + esc(k.help) + " <em>" + esc(k.flow) + ".</em></span></label>";
    }).join("") + "</div>" +
    '<div class="dz-run"><button class="btn btn-submit" type="button" id="dz-go">Run the flow</button>' +
    '<button class="ff-reset" type="button" id="dz-reset">back to the flow\'s settings</button>' +
    '<span class="dz-status" id="dz-status"></span></div>';
  function showKnob(k) {
    var o = knobsEl.querySelector('[data-o="' + k.k + '"]');
    if (!o) return;
    var v = state[k.k];
    o.textContent = k.pct ? Math.round(v * 100) + "%" : k.unit !== undefined ? fmt(v) + (k.unit ? " " + k.unit : "") : (+v).toFixed(2);
  }
  E.knobs.forEach(showKnob);
  function read(el) {
    var k = el.getAttribute("data-k");
    if (!k) return null;
    state[k] = el.tagName === "SELECT" ? el.value : +el.value;
    E.knobs.forEach(function (kk) { if (kk.k === k) showKnob(kk); });
    return k;
  }
  knobsEl.addEventListener("input", function (ev) { read(ev.target); });
  knobsEl.querySelector("#dz-go").addEventListener("click", run);
  /* a run takes a few seconds, so letting go of a knob runs it */
  knobsEl.addEventListener("change", function (ev) { if (read(ev.target)) run(); });
  knobsEl.querySelector("#dz-reset").addEventListener("click", function () {
    E.knobs.forEach(function (k) {
      state[k.k] = k.value;
      knobsEl.querySelector('[data-k="' + k.k + '"]').value = k.value;
      showKnob(k);
    });
    run();
  });

  /* ----- the result area ----- */
  var VIEWS = [["cells", "Cells"], ["clock", "Clock tree"], ["congestion", "Routing congestion"], ["path", "Worst path"]];
  resEl.innerHTML =
    '<div class="dz-res">' +
    '<div class="dz-canvas-wrap"><div class="dz-views" role="tablist">' + VIEWS.map(function (v) {
      return '<button type="button" role="tab" data-view="' + v[0] + '"' + (v[0] === view ? ' class="dz-on"' : "") + ">" + v[1] + "</button>";
    }).join("") + "</div>" +
    '<canvas id="dz-canvas" width="560" height="560" aria-label="The layout the engine produced"></canvas>' +
    '<div class="dz-scrub"><button class="ff-reset" type="button" id="dz-play">replay placement</button>' +
    '<input type="range" id="dz-frame" min="0" max="0" value="0"><span id="dz-flabel"></span></div>' +
    '<p class="dz-vnote" id="dz-vnote"></p><div class="dz-legend" id="dz-legend"></div>' +
    '<div class="dz-pathinfo" id="dz-pathinfo"></div></div>' +
    '<div class="dz-metrics" id="dz-metrics"><div class="dz-empty">running</div></div></div>' +
    '<div class="dz-cards">' +
    '<div class="dz-card"><h3>Timing</h3><div id="dz-timing" class="dz-empty">running</div></div>' +
    '<div class="dz-card"><h3>Power</h3><div id="dz-power" class="dz-empty">running</div></div></div>';
  var canvas = resEl.querySelector("#dz-canvas"), slider = resEl.querySelector("#dz-frame");
  var flabel = resEl.querySelector("#dz-flabel"), status = knobsEl.querySelector("#dz-status");
  var scrub = resEl.querySelector(".dz-scrub"), vnote = resEl.querySelector("#dz-vnote");
  var pathInfoEl = resEl.querySelector("#dz-pathinfo"), hoverStage = -1;
  /* the three-dimensional view, further down the page: its code (and the
     graphics library under it) loads with the first finished run */
  var host3d = root.querySelector("#dz-3d"), view3d = null;
  function draw3d(msg) {
    if (!host3d) return;
    if (view3d) return view3d.then(function (v) { v.update(msg); });
    host3d.innerHTML = '<div class="dz-empty">drawing</div>';
    view3d = import("/static/explore/layout3d.js" + (DESIGN_ENGINE_VERSION ? "?" + DESIGN_ENGINE_VERSION : "")).then(function (m) { return m.mountLayout3D(host3d); });
    view3d.then(function (v) { v.update(msg); }).catch(function (e) {
      host3d.innerHTML = '<div class="dz-empty">this browser could not draw it: ' + esc(e && e.message || e) + "</div>";
    });
  }

  function stageState(k, text, on) {
    var li = root.querySelector('.dz-stages li[data-stage="' + k + '"] .dz-state');
    if (li) { li.textContent = text; li.parentNode.classList.toggle("dz-done", !!on); }
  }

  function run() {
    runId++;
    if (playing) { clearInterval(playing); playing = null; }
    status.textContent = "running";
    STAGES.forEach(function (s, i) { stageState(s, i ? "waiting" : "running", false); });
    worker.postMessage({ type: "run", id: runId, net: E.net, lib: E.lib, knobs: state, want3d: !!host3d });
  }

  var NEXT = { placement: "cts", cts: "routing", routing: "timing", timing: "finish" };
  worker.onmessage = function (ev) {
    var msg = ev.data;
    if (msg.type === "error") { status.textContent = "the engine stopped: " + msg.message; return; }
    if (msg.id !== runId) return;                 /* an older run, overtaken by a newer one */
    if (msg.type === "progress") {
      var p = msg.p;
      if (p.stage === "floorplan") { stageState("floorplan", "done", true); stageState("placement", "running", false); }
      if (p.step) status.textContent = "placing: " + p.step.label + ", overflow " + Math.round(p.step.overflow * 100) + "%";
      if (p.done) {
        stageState(p.stage, "done", true);
        if (NEXT[p.stage]) stageState(NEXT[p.stage], "running", false);
        status.textContent = { placement: "building the clock tree", cts: "routing", routing: "repairing and timing",
                               timing: "power and finishing" }[p.stage] || status.textContent;
      }
      return;
    }
    last = msg;
    var M = msg.metrics, T = msg.ms;
    stageState("floorplan", "done, " + Math.round(M.ms.floorplan) + " ms", true);
    stageState("placement", "done, " + fmt(T.placement - M.ms.floorplan) + " ms", true);
    stageState("cts", "done, " + fmt(T.cts) + " ms", true);
    stageState("routing", "done, " + fmt(T.routing) + " ms", true);
    stageState("timing", "done, " + fmt(T.timing) + " ms", true);
    stageState("finish", "done, " + fmt(T.finish) + " ms", true);
    status.textContent = "done in " + (Object.keys(T).reduce(function (a, k) { return a + T[k]; }, 0) / 1000).toFixed(1) + " s";
    slider.max = String(msg.frames.length);
    metrics(msg);
    timingCard(msg);
    powerCard(msg);
    hoverStage = -1;
    pathInfo(msg);
    swDraw();
    draw3d(msg);
    if (view === "cells") play(); else draw(msg.frames.length);
  };

  /* ----- drawing ----- */
  function heat(r) {                               /* routing demand over capacity, as a colour */
    if (r < 0.5) return null;
    if (r < 0.8) return "rgba(250, 204, 21, " + (0.25 + (r - 0.5)) + ")";
    if (r < 1.0) return "rgba(249, 115, 22, 0.65)";
    return "rgba(220, 38, 38, 0.85)";
  }
  function draw(k) {
    var R = last; if (!R) return;
    frame = k;
    var dpr = window.devicePixelRatio || 1, size = canvas.clientWidth || 560;
    if (canvas.width !== Math.round(size * dpr)) { canvas.width = Math.round(size * dpr); canvas.height = canvas.width; }
    var ctx = canvas.getContext("2d"), fp = R.fp, mg = (fp.die.W - fp.W) / 2;
    var S = canvas.width / fp.die.W;
    function X(x) { return (mg + x) * S; }
    function Y(y) { return canvas.height - (mg + y) * S; }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#eef1f4"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff"; ctx.fillRect(X(0), Y(fp.H), fp.W * S, fp.H * S);
    ctx.strokeStyle = "#b8692e"; ctx.lineWidth = Math.max(1, dpr); ctx.strokeRect(X(0), Y(fp.H), fp.W * S, fp.H * S);
    /* halos, then the memories */
    fp.macros.forEach(function (m) {
      ctx.setLineDash([4 * dpr, 3 * dpr]); ctx.strokeStyle = "#94a3b8";
      ctx.strokeRect(X(m.x - 2), Y(m.y + m.h + 2), (m.w + 4) * S, (m.h + 4) * S);
      ctx.setLineDash([]);
      ctx.fillStyle = "#64748b"; ctx.fillRect(X(m.x), Y(m.y + m.h), m.w * S, m.h * S);
      ctx.strokeStyle = "#334155"; ctx.strokeRect(X(m.x), Y(m.y + m.h), m.w * S, m.h * S);
    });
    /* the pins, each a short tick out from the core edge it sits on */
    ctx.fillStyle = "#7c3aed";
    var tick = Math.max(3 * dpr, mg * S * 0.6);
    fp.pins.forEach(function (p) {
      var side = p.side || "b";
      if (side === "b") ctx.fillRect(X(p.x) - 0.6 * dpr, Y(0), 1.2 * dpr, tick);
      else if (side === "t") ctx.fillRect(X(p.x) - 0.6 * dpr, Y(fp.H) - tick, 1.2 * dpr, tick);
      else if (side === "l") ctx.fillRect(X(0) - tick, Y(p.y) - 0.6 * dpr, tick, 1.2 * dpr);
      else ctx.fillRect(X(fp.W), Y(p.y) - 0.6 * dpr, tick, 1.2 * dpr);
    });
    /* the cells: a placement iteration, or the legal result; faint under
       the other views, so what they draw stands out */
    var legal = k >= R.frames.length, P = legal ? R.legal : R.frames[k], h = fp.rowH, faint = view !== "cells";
    for (var i = 0; i < P.x.length; i++) {
      ctx.fillStyle = faint ? "#cbd5e1" : COLORS[R.group[i]];
      var w = R.w[i];
      ctx.globalAlpha = faint ? (view === "path" ? 0.45 : 0.8) : legal ? 0.95 : 0.7;
      ctx.fillRect(X(P.x[i] - w / 2), Y(P.y[i] + h / 2), Math.max(0.8, w * S), Math.max(0.8, h * S));
    }
    ctx.globalAlpha = 1;
    if (view === "clock") drawClock(ctx, R, X, Y, dpr);
    if (view === "congestion") {
      var Rt = R.route;
      for (var j = 0; j < Rt.ny; j++) for (var q = 0; q < Rt.nx; q++) {
        var col = heat(Rt.ratio[j * Rt.nx + q]);
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(X(q * Rt.gc), Y((j + 1) * Rt.gc), Rt.gc * S + 0.5, Rt.gc * S + 0.5);
      }
    }
    if (view === "path") drawPath(ctx, R, X, Y, dpr);
    slider.value = String(k);
    flabel.textContent = legal ? "legalized: every cell on a row" : R.history[k].label + ", overflow " +
      Math.round(R.history[k].overflow * 100) + "%";
    scrub.style.display = view === "cells" ? "" : "none";
    pathInfoEl.style.display = view === "path" ? "" : "none";
    legend(R);
  }
  function drawClock(ctx, R, X, Y, dpr) {
    var s = R.cts.segs, LEVEL = ["#1e3a8a", "#1d4ed8", "#3b82f6", "#60a5fa", "#93c5fd"];
    for (var i = 0; i < s.length; i += 5) {
      var lv = s[i + 4];
      ctx.strokeStyle = lv === 9 ? "rgba(217, 119, 6, 0.55)" : lv < 0 ? "#7c3aed" : LEVEL[Math.min(LEVEL.length - 1, lv)];
      ctx.lineWidth = (lv === 9 ? 0.6 : lv < 0 ? 1.6 : Math.max(0.8, 2.4 - 0.4 * lv)) * dpr;
      ctx.beginPath();
      if (lv === 9) { ctx.moveTo(X(s[i]), Y(s[i + 1])); ctx.lineTo(X(s[i + 2]), Y(s[i + 3])); }
      else {                                       /* branches run in straight pieces: across, then up or down */
        ctx.moveTo(X(s[i]), Y(s[i + 1])); ctx.lineTo(X(s[i + 2]), Y(s[i + 1])); ctx.lineTo(X(s[i + 2]), Y(s[i + 3]));
      }
      ctx.stroke();
    }
    var b = R.cts.bufs;
    for (i = 0; i < b.length; i += 3) {
      var kind = b[i + 2], sz = (kind === 1 ? 3 : 4.5) * dpr;
      ctx.fillStyle = kind === 1 ? "#d97706" : kind === 2 ? "#7c3aed" : "#1e3a8a";
      ctx.fillRect(X(b[i]) - sz / 2, Y(b[i + 1]) - sz / 2, sz, sz);
    }
  }
  /* The worst path, split into stages: each gate on it, with the wire into
     it and its own delay. The path is stored as pins in order: where it
     launches, then each gate's input and output, then where it ends. */
  function pathStages(T) {
    var p = T.path, st = [];
    for (var i = 1; i < p.length; i += 2) {
      var inp = p[i], out = p[i + 1];
      st.push({ n: st.length + 1, inp: inp, out: out || null, wire: inp.t - p[i - 1].t,
                gate: out ? out.t - inp.t : 0, from: p[i - 1] });
    }
    return st;
  }
  function timeColour(f) {                         /* early teal, through amber, to late red */
    var a = [13, 148, 136], b = [245, 158, 11], c = [220, 38, 38], u = f < 0.5 ? f * 2 : (f - 0.5) * 2;
    var x = f < 0.5 ? a : b, y = f < 0.5 ? b : c;
    return "rgb(" + [0, 1, 2].map(function (k) { return Math.round(x[k] + (y[k] - x[k]) * u); }).join(",") + ")";
  }
  function drawPath(ctx, R, X, Y, dpr) {
    var p = R.timing.path;
    if (!p.length) return;
    var t0 = p[0].t, t1 = p[p.length - 1].t, span = Math.max(1, t1 - t0), st = pathStages(R.timing);
    function frac(t) { return Math.max(0, Math.min(1, (t - t0) / span)); }
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    /* each wire as it would run: across, then up or down, with an arrow on
       its longer leg pointing the way the signal goes */
    st.forEach(function (s, k) {
      var a = s.from, b = s.inp, ax = X(a.x), ay = Y(a.y), bx = X(b.x), by = Y(b.y);
      var colour = timeColour(frac((a.t + b.t) / 2)), hot = k === hoverStage;
      ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = (hot ? 7 : 5) * dpr;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, ay); ctx.lineTo(bx, by); ctx.stroke();
      ctx.strokeStyle = colour; ctx.lineWidth = (hot ? 4 : 2.4) * dpr;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, ay); ctx.lineTo(bx, by); ctx.stroke();
      var horiz = Math.abs(bx - ax) >= Math.abs(by - ay), len = horiz ? Math.abs(bx - ax) : Math.abs(by - ay);
      if (len > 18 * dpr) {
        var mx = horiz ? (ax + bx) / 2 : bx, my = horiz ? ay : (ay + by) / 2;
        var dx = horiz ? Math.sign(bx - ax) : 0, dy = horiz ? 0 : Math.sign(by - ay), h = 5 * dpr;
        ctx.fillStyle = colour; ctx.beginPath();
        ctx.moveTo(mx + dx * h, my + dy * h);
        ctx.lineTo(mx - dx * h - dy * h * 0.8, my - dy * h + dx * h * 0.8);
        ctx.lineTo(mx - dx * h + dy * h * 0.8, my - dy * h - dx * h * 0.8);
        ctx.fill();
      }
    });
    /* the gates, numbered in order; where markers would pile up, a dot */
    var placed = [], r = 7.5 * dpr;
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "700 " + Math.round(9 * dpr) + "px system-ui, sans-serif";
    st.forEach(function (s, k) {
      if (!s.out) return;
      var x = X(s.inp.x), y = Y(s.inp.y), colour = timeColour(frac(s.out.t)), hot = k === hoverStage;
      var room = hot || placed.every(function (q) { return Math.hypot(q[0] - x, q[1] - y) > 2 * r; });
      if (room) {
        placed.push([x, y]);
        ctx.fillStyle = "#fff"; ctx.strokeStyle = colour; ctx.lineWidth = (hot ? 3 : 2) * dpr;
        ctx.beginPath(); ctx.arc(x, y, hot ? r * 1.35 : r, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#1f2933"; ctx.fillText(String(s.n), x, y + 0.5 * dpr);
      } else {
        ctx.fillStyle = colour; ctx.beginPath(); ctx.arc(x, y, 2.6 * dpr, 0, 7); ctx.fill();
      }
    });
    /* where it starts and where it must arrive, labelled */
    var first = p[0], last = p[p.length - 1];
    function tag(q, text, colour) {
      var x = X(q.x), y = Y(q.y);
      ctx.fillStyle = colour; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2 * dpr;
      ctx.beginPath(); ctx.arc(x, y, 6 * dpr, 0, 7); ctx.fill(); ctx.stroke();
      ctx.font = "600 " + Math.round(11 * dpr) + "px system-ui, sans-serif";
      var w = ctx.measureText(text).width + 12 * dpr, h = 18 * dpr;
      var lx = Math.min(canvas.width - w - 4 * dpr, Math.max(4 * dpr, x - w / 2));
      var ly = y - h - 12 * dpr < 4 * dpr ? y + 12 * dpr : y - h - 12 * dpr;
      if (ly + h > canvas.height - 4 * dpr) ly = y - h - 12 * dpr;
      ctx.fillStyle = colour; ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(lx, ly, w, h, 4 * dpr); else ctx.rect(lx, ly, w, h);
      ctx.fill();
      ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.fillText(text, lx + w / 2, ly + h / 2 + 0.5 * dpr);
    }
    tag(first, "starts: " + describe(first), "#0d9488");
    tag(last, "ends: " + describe(last), "#dc2626");
  }
  function describe(q) { return q.port ? "pin " + q.port : q.type + " " + q.pin; }

  /* under the canvas, in the path view: where the time goes, and each stage */
  function pathInfo(R) {
    var T = R.timing, p = T.path, st = pathStages(T);
    if (!p.length) { pathInfoEl.innerHTML = ""; return; }
    var launch = p[0].t, gates = 0, wires = 0, nGates = 0;
    st.forEach(function (s) { wires += s.wire; gates += s.gate; if (s.out) nGates++; });
    var end = Math.max(T.arrival, T.required), Wd = 1000, sc = Wd / (end * 1.02);
    var segs = ['<rect x="0" y="8" width="' + launch * sc + '" height="26" fill="#cbd5e1"><title>clock arrival and launch: ' +
      f1(launch) + ' ps</title></rect>'];
    st.forEach(function (s) {
      var x0 = s.from.t * sc, xw = s.inp.t * sc;
      segs.push('<rect x="' + x0 + '" y="8" width="' + Math.max(0, xw - x0) + '" height="26" fill="#7dd3fc"><title>wire into ' +
        esc(s.out ? "gate " + s.n : "the end") + ": " + f1(s.wire) + " ps</title></rect>");
      if (s.out) segs.push('<rect x="' + xw + '" y="8" width="' + Math.max(0, s.out.t * sc - xw) + '" height="26" fill="' +
        timeColour((s.out.t - launch) / Math.max(1, p[p.length - 1].t - launch)) + '" stroke="#fff" stroke-width="1">' +
        "<title>gate " + s.n + ", " + esc(s.out.type) + ": " + f1(s.gate) + " ps</title></rect>");
    });
    var rq = T.required * sc, ar = T.arrival * sc, late = T.arrival > T.required;
    if (late) segs.push('<rect x="' + rq + '" y="4" width="' + (ar - rq) + '" height="34" fill="none" stroke="#dc2626" ' +
      'stroke-width="2" stroke-dasharray="4 3"/>');
    segs.push('<line x1="' + rq + '" x2="' + rq + '" y1="0" y2="42" stroke="#1f2933" stroke-width="2"/>');
    var rows = st.map(function (s, k) {
      return '<tr data-stage="' + k + '"><td class="dz-pn">' + (s.out ? s.n : "end") + "</td><td>" +
        esc(s.out ? s.out.type : describe(s.inp)) + '</td><td class="dz-pw">' + f1(s.wire) + '</td><td class="dz-pg">' +
        (s.out ? f1(s.gate) : "") + "</td><td>" + fmt(s.out ? s.out.t : s.inp.t) + "</td></tr>";
    }).join("");
    pathInfoEl.innerHTML =
      "<h4>Where the time goes</h4>" +
      '<svg class="dz-pbar" viewBox="0 0 ' + Wd + ' 42" preserveAspectRatio="none" role="img" ' +
      'aria-label="The path\'s time, from the clock edge to where it must arrive">' + segs.join("") + "</svg>" +
      '<div class="dz-pbaxis"><span>0, the clock edge</span><span>must arrive by ' + fmt(T.required) + " ps" +
      (late ? ", " + f1(T.arrival - T.required) + " ps late" : ", " + f1(T.required - T.arrival) + " ps to spare") + "</span></div>" +
      '<div class="dz-pkey"><span><i style="background:#cbd5e1"></i>clock and launch ' + f1(launch) + " ps</span>" +
      '<span><i style="background:linear-gradient(90deg,#0d9488,#f59e0b,#dc2626)"></i>' + nGates + " gates, " + f1(gates) + " ps</span>" +
      '<span><i style="background:#7dd3fc"></i>' + st.length + " wires, " + f1(wires) + " ps</span></div>" +
      '<div class="dz-ptable"><table><thead><tr><th>#</th><th>gate</th><th>wire in</th><th>gate</th><th>arrives</th></tr>' +
      "</thead><tbody>" + rows + "</tbody></table></div>" +
      '<p class="dz-cnote">All times in picoseconds. Point at a row to find that gate on the layout.</p>';
  }
  pathInfoEl.addEventListener("mouseover", function (ev) {
    var tr = ev.target.closest && ev.target.closest("tr[data-stage]");
    var k = tr ? +tr.getAttribute("data-stage") : -1;
    if (k === hoverStage) return;
    pathInfoEl.querySelectorAll("tr.dz-hot").forEach(function (x) { x.classList.remove("dz-hot"); });
    if (tr) tr.classList.add("dz-hot");
    hoverStage = k;
    if (last && view === "path") draw(frame);
  });
  pathInfoEl.addEventListener("mouseleave", function () {
    hoverStage = -1;
    pathInfoEl.querySelectorAll("tr.dz-hot").forEach(function (x) { x.classList.remove("dz-hot"); });
    if (last && view === "path") draw(frame);
  });
  function play() {
    if (playing) clearInterval(playing);
    var k = 0;
    draw(0);
    playing = setInterval(function () {
      k++;
      draw(k);
      if (k >= last.frames.length) { clearInterval(playing); playing = null; }
    }, 260);
  }
  slider.addEventListener("input", function () {
    if (playing) { clearInterval(playing); playing = null; }
    draw(+slider.value);
  });
  resEl.querySelector("#dz-play").addEventListener("click", play);
  resEl.querySelector(".dz-views").addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-view]");
    if (!b) return;
    view = b.getAttribute("data-view");
    resEl.querySelectorAll(".dz-views button").forEach(function (x) { x.classList.toggle("dz-on", x === b); });
    if (playing) { clearInterval(playing); playing = null; }
    if (last) draw(view === "cells" ? frame : last.frames.length);
  });
  window.addEventListener("resize", function () { if (frame >= 0) draw(frame); });

  function legend(R) {
    var el = resEl.querySelector("#dz-legend"), items = [], note = "";
    function sw(c, t) { items.push('<span><i style="background:' + c + '"></i>' + t + "</span>"); }
    if (view === "cells") {
      var used = {};
      for (var i = 0; i < R.group.length; i++) used[R.group[i]] = (used[R.group[i]] || 0) + 1;
      Object.keys(used).forEach(function (g) { sw(COLORS[g], esc(R.groups[g]) + " (" + fmt(used[g]) + ")"); });
      if (R.fp.macros.length) sw("#64748b", "memory macro (" + R.fp.macros.length + ")");
      sw("#7c3aed", "pins (" + R.fp.pins.length + ")");
      note = R.grouping === "cones"
        ? "Every standard cell, coloured by the register its logic feeds: synthesis kept names only for this " +
          "design's registers, so each logic cell takes the colour of the nearest register its output reaches."
        : "Every standard cell, coloured by the part of the design it belongs to.";
    } else if (view === "clock") {
      sw("#1e3a8a", "branch buffers"); sw("#d97706", "cluster buffers (" + R.cts.clusters + ")");
      sw("rgba(217, 119, 6, 0.55)", "wires to the flip-flops");
      if (R.fp.macros.length) sw("#7c3aed", "the memories' own tree");
      note = "The clock tree: an H-tree of " + R.cts.levels + " levels over " + R.cts.clusters +
        " clusters of flip-flops, each cluster fed by its own buffer.";
    } else if (view === "congestion") {
      sw("rgba(250, 204, 21, 0.5)", "half to 80% of the tracks used"); sw("rgba(249, 115, 22, 0.65)", "80 to 100%");
      sw("rgba(220, 38, 38, 0.85)", "more wires than tracks");
      note = "How full each 1 micrometer square of routing is, after global routing.";
    } else {
      sw("linear-gradient(90deg,#0d9488,#f59e0b,#dc2626)", "early to late along the path");
      sw("#fff;border:2px solid #b45309", "gates, numbered in order");
      var nG = R.timing.path.filter(function (q, i) { return q.type && i % 2 === 0 && i > 0; }).length;
      note = "The slowest path the engine found, through " + nG + " gates. Each wire is drawn the way it " +
        "would run on the chip, across and then up or down, with an arrow the way the signal goes.";
    }
    el.innerHTML = items.join("");
    vnote.textContent = note;
  }

  /* ----- the numbers, engine beside the real run ----- */
  /* ----- the numbers, engine beside the real run, one dropdown per stage.
     Each closed dropdown still shows its headline number; which ones are
     open is kept from one run to the next. ----- */
  var openSecs = {};
  function metrics(R) {
    var M = R.metrics, ref = E.reference, C = R.cts, Rt = R.route, rc = R.repair.counts, T = R.timing, P = R.power;
    var A = R.area, atRef = T.period === ref.timing.period;
    function row(label, mine, real, note) {
      return "<tr><th>" + label + "</th><td>" + mine + "</td><td>" + (real || "") + "</td>" +
        '<td class="dz-mnote">' + (note || "") + "</td></tr>";
    }
    function sec(key, name, headMine, headReal, rows) {
      return '<details class="dz-msec2" data-sec="' + key + '"' + (openSecs[key] ? " open" : "") + ">" +
        '<summary><span class="dz-mname">' + name + '</span><span class="dz-mval">' + headMine + "</span>" +
        '<span class="dz-mval dz-mref">' + (headReal || "") + "</span></summary>" +
        '<table class="ff-table dz-mtable"><tbody>' + rows + "</tbody></table></details>";
    }
    function um(v) { return fmt(v) + " µm"; }
    function um2(v) { return fmt(v) + " µm²"; }
    var repairBufs = rc.ports + rc.design + rc.timing, stages = pathStages(T);
    var nGates = stages.filter(function (st) { return st.out; }).length;
    var stdNow = A.std + A.repair + A.cts, dieArea = M.die.W * M.die.H, coreArea = M.core.W * M.core.H;
    var layerRows = ["M2", "M3", "M4", "M5", "M6", "M7"].map(function (l) {
      var n = +l.slice(1);
      return row("Metal " + n + (n % 2 ? ", up and down" : ", across"), um(Rt.layerLen[l]), um(ref.route.layers[l]),
                 n === 2 ? "the real split is the detailed router's" : "");
    }).join("");
    var NAMES = { macro: "memories", combinational: "logic", clock: "clock tree", sequential: "flip-flops" };
    var powerRows = ["macro", "combinational", "clock", "sequential"].filter(function (g) {
      return g !== "macro" || R.fp.macros.length;
    }).map(function (g) {
      var G = P.groups[g], d = ref.power.detail[g];
      return row(NAMES[g][0].toUpperCase() + NAMES[g].slice(1), mw(G.total), ref.power.groups[g].toFixed(2) + " mW",
                 "internal " + (G.internal * 1e3).toFixed(2) + ", switching " + (G.switching * 1e3).toFixed(2) +
                 " (real " + d[0].toFixed(2) + ", " + d[1].toFixed(2) + ")");
    }).join("");
    var totalMs = Object.keys(R.ms).reduce(function (a, k) { return a + R.ms[k]; }, 0);

    resEl.querySelector("#dz-metrics").innerHTML =
      '<div class="dz-mhead"><span></span><span>this engine</span><span>real OpenROAD</span></div>' +
      sec("floorplan", "Floorplan", f1(M.die.W) + " × " + f1(M.die.H) + " µm", f1(ref.die) + " µm square",
        row("Die area", um2(dieArea), um2(ref.area.die), "") +
        row("Core area", um2(coreArea), um2(ref.area.core), "the die less a margin all round") +
        row("Utilization", Math.round(M.util * 100) + "%", Math.round(ref.util * 100) + "%",
            R.fp.macros.length ? "cells and memories, over the core" : "cells, over the core") +
        row("Rows", fmt(M.rows), fmt(ref.rows), "each 0.27 µm tall") +
        (R.fp.macros.length ? row("Memories", R.fp.macros.length + ", " + um2(A.macro),
            R.fp.macros.length + ", " + um2(ref.area.macro), "") : "") +
        row("Pins", fmt(R.fp.pins.length), "", R.fp.pinMode === "all" ? "on all four edges" : "all on the bottom edge")) +
      sec("placement", "Placement", um(M.legalHpwl), um(ref.legalHpwl),
        row("Wirelength, global placement", um(M.globalHpwl), um(ref.globalHpwl), "half-perimeter of every net") +
        row("Wirelength, legalized", um(M.legalHpwl), um(ref.legalHpwl),
            "the real flow's detailed placer then improves it to " + fmt(ref.improvedHpwl)) +
        row("Density target", M.density.used.toFixed(2) + (M.density.used > M.density.asked + 1e-9 ? " (asked " +
            M.density.asked.toFixed(2) + ")" : ""), ref.density.toFixed(3),
            M.density.used > M.density.asked + 1e-9 ? "raised to the uniform density, as the real placer does" : "") +
        row("Iterations", fmt(M.iterations), "", "until overflow is under 10%") +
        row("Final overflow", Math.round(M.overflow * 100) + "%", "", "cell area over the density target") +
        row("Peak bin density", Math.round(M.peakDensity * 100) + "%", "", "after legalization") +
        row("Cell move when legalized", "avg " + f1(M.avgDisp) + ", max " + f1(M.maxDisp) + " µm",
            "avg " + f1(ref.avgDisp) + ", max " + f1(ref.maxDisp) + " µm", M.failed ? M.failed + " cells found no spot" : "") +
        row("Timing-driven passes", String(R.placeTiming.length), "2", "the worst 10% of nets pull harder") +
        row("Worst slack at those passes", R.placeTiming.map(function (x) { return ps(x.wns); }).join(", "),
            ref.placeWns.map(ps).join(", "), "estimated, before any repair")) +
      sec("cts", "Clock tree", ps(C.skew) + " skew", ps(ref.cts.skew),
        row("Clusters of flip-flops", fmt(C.clusters), ref.cts.clusters ? fmt(ref.cts.clusters) : "none",
            (ref.cts.clusters ? "" : "the real tool does not cluster so few flip-flops; ") + "up to " + state.ctsSize + ", at most " +
            state.ctsDiam + " µm across") +
        row("H-tree levels", String(C.levels), String(ref.cts.levels), "") +
        row("Clock buffers", fmt(C.buffers), fmt(ref.cts.buffers), "") +
        (R.fp.macros.length ? row("Delay buffers", String(C.delayBuffers), String(ref.cts.delayBuffers),
            "slowing the memories' tree to match") : "") +
        row("Skew between flip-flops", ps(C.skew), ps(ref.cts.skew), "latest clock arrival minus earliest") +
        row("Clock arrival at flip-flops", f1(C.minLat) + " to " + f1(C.maxLat) + " ps", "", "") +
        row("Clock wire", um(C.wireLen), "", "")) +
      sec("routing", "Routing", um(Rt.total), um(ref.route.global),
        row("Wirelength", um(Rt.total), um(ref.route.global), "global routing; the detailed router's is " +
            um(ref.route.detailed)) +
        row("Signal and clock", um(Rt.signal) + " + " + um(Rt.clock), "", "") +
        row("Vias", fmt(Rt.vias), fmt(ref.route.globalVias), "the detailed router's: " + fmt(ref.route.vias)) +
        layerRows +
        row("Overfull edges", fmt(Rt.overEdges), "", "places with more wires than tracks") +
        row("Overflow", fmt(Rt.overflow), "", "wires beyond the tracks, summed")) +
      sec("repair", "Repair", fmt(repairBufs) + " buffers", fmt(ref.repair.buffers),
        row("Buffers at the ports", fmt(rc.ports), fmt(ref.repair.ports), "one on every pin but the clock") +
        row("Buffers for load limits", fmt(rc.design) + " on " + fmt(rc.designNets) + " nets",
            fmt(ref.repair.design) + " on " + fmt(ref.repair.designNets) + " nets", "too much load, or edges too slow") +
        row("Buffers for speed", fmt(rc.timing), "", (rc.splits || 0) + " of them splitting a failing net's load") +
        row("Critical pins fed directly", fmt(rc.isolated || 0) + " nets", "", "taken out of a load buffer tree") +
        row("Gates made stronger", fmt(rc.upsized + (rc.timingResized || 0)), fmt(ref.repair.resized),
            rc.upsized + " for their load, " + (rc.timingResized || 0) + " on failing paths") +
        row("Area added", um2(rc.area), "", "")) +
      sec("timing", "Timing", ps(T.wns), atRef ? ps(ref.timing.wns) : "",
        row("Clock period", fmt(T.period) + " ps", fmt(ref.timing.period) + " ps", fmt(1e6 / T.period) + " MHz") +
        row("Worst slack", ps(T.wns), atRef ? ps(ref.timing.wns) : "", T.wns < 0
            ? "negative: the slowest path is late" : "positive: every path makes it") +
        row("Total negative slack", ps(T.tns), atRef ? ps(ref.timing.tns) : "", "every late path's lateness, summed") +
        row("Failing endpoints", fmt(T.failing) + " of " + fmt(T.endpoints), "", "") +
        row("Worst path", nGates + " gates", ref.timing.gates + " gates", "the real count includes its buffers") +
        row("Arrives, and must by", fmt(T.arrival) + ", " + fmt(T.required) + " ps", "", "") +
        row("Worst slack, repair pass by pass", T.history.map(function (v) { return Math.round(v); }).join(", ") + " ps", "",
            "each pass makes the gates on failing paths stronger")) +
      sec("power", "Power", mw(P.total), ref.power.total.toFixed(2) + " mW",
        row("Total", mw(P.total), ref.power.total.toFixed(2) + " mW", "") +
        powerRows +
        row("Internal", mw(P.internal), ref.power.internal.toFixed(2) + " mW", "inside the cells") +
        row("Switching", mw(P.switching), ref.power.switching.toFixed(2) + " mW", "charging the wires and pins") +
        row("Leakage", mw(P.leakage), ref.power.leakage.toFixed(2) + " mW", "") +
        row("Switching activity", P.activity.toFixed(2) + " a cycle", "", "average over the nets, as OpenSTA estimates it")) +
      sec("area", "Area", um2(stdNow), um2(ref.area.std),
        row("Standard cells", um2(stdNow), um2(ref.area.std), "the real figure also has tap and tie cells") +
        row("from the netlist", um2(A.std), "", "") +
        row("added by the repair", um2(A.repair), "", "") +
        row("added by the clock tree", um2(A.cts), "", "") +
        row("Memories", um2(A.macro), um2(ref.area.macro), "") +
        row("Utilization, finished", Math.round((stdNow + A.macro) / coreArea * 100) + "%",
            Math.round((ref.area.std + ref.area.macro) / ref.area.core * 100) + "%", "before fillers")) +
      sec("finish", "Finishing", um2(R.finish.fillerArea) + " filler", um2(ref.finish.fillArea),
        row("Filler area", um2(R.finish.fillerArea), um2(ref.finish.fillArea), "every gap left on the rows") +
        row("Filler cells", "about " + fmt(R.finish.fillers), fmt(ref.finish.fillers), "the engine counts four sites each")) +
      sec("engine", "Engine time", (totalMs / 1000).toFixed(1) + " s", "",
        ["placement", "cts", "routing", "timing", "finish"].map(function (k) {
          return row({ placement: "Floorplan and placement", cts: "Clock tree", routing: "Routing",
                       timing: "Repair and timing", finish: "Power and finishing" }[k], fmt(R.ms[k]) + " ms", "", "");
        }).join("") + row("Total", fmt(totalMs) + " ms", "", "in your browser")) +
      '<p class="dz-mfoot">The real column is ' + esc(ref.what) +
      ". It matches this engine only when the knobs are at the flow's settings; move them and it stays as a fixed " +
      "reference.</p>";
    resEl.querySelectorAll(".dz-msec2").forEach(function (d) {
      d.addEventListener("toggle", function () { openSecs[d.getAttribute("data-sec")] = d.open; });
    });
  }

  function timingCard(R) {
    var T = R.timing, H = T.hist, max = Math.max.apply(null, H.bins), W = 300, Hh = 76, bw = W / H.bins.length;
    var zero = (0 - H.lo) / Math.max(1e-9, H.hi - H.lo) * W;
    var bars = H.bins.map(function (n, i) {
      var v = H.lo + (i + 0.5) * (H.hi - H.lo) / H.bins.length, h = n ? Math.max(2, n / max * Hh) : 0;
      return '<rect x="' + (i * bw + 1) + '" y="' + (Hh - h) + '" width="' + (bw - 2) + '" height="' + h +
        '" fill="' + (v < 0 ? "#dc2626" : "#16a34a") + '"/>';
    }).join("");
    var axis = zero > 0 && zero < W ? '<line x1="' + zero + '" x2="' + zero + '" y1="0" y2="' + Hh +
      '" stroke="#334155" stroke-dasharray="3 2" vector-effect="non-scaling-stroke"/>' : "";
    var cells = pathStages(T).filter(function (st) { return st.out; });
    var start = T.path[0], end = T.path[T.path.length - 1];
    resEl.querySelector("#dz-timing").className = "";
    resEl.querySelector("#dz-timing").innerHTML =
      '<p class="dz-big ' + (T.wns < 0 ? "dz-bad" : "dz-good") + '">' + ps(T.wns) + ' <span>worst slack at ' +
      fmt(T.period) + " ps</span></p>" +
      '<svg class="dz-hist" viewBox="0 0 ' + W + " " + Hh + '" preserveAspectRatio="none" role="img" ' +
      'aria-label="How many paths end with each slack">' + bars + axis + "</svg>" +
      '<div class="dz-haxis"><span>' + ps(H.lo) + "</span>" + (zero > 0 && zero < W ? "<span>0 at the dashed line</span>" : "") +
      "<span>" + ps(H.hi) + "</span></div>" +
      '<p class="dz-cnote">Slack at each of the ' + fmt(T.endpoints) + " path ends: red ones are late.</p>" +
      '<p class="dz-cnote">The worst path starts at ' + esc(start.port ? "input " + start.port : start.type + " " + start.pin) +
      " and ends at " + esc(end.port ? "output " + end.port : end.type + " " + end.pin) + ", through " + cells.length +
      " gates: it arrives at " + fmt(T.arrival) + " ps and must by " + fmt(T.required) +
      ' ps. <a href="#" id="dz-showpath">Show it on the layout</a>.</p>';
    resEl.querySelector("#dz-showpath").addEventListener("click", function (ev) {
      ev.preventDefault();
      resEl.querySelector('[data-view="path"]').click();
      canvas.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function powerCard(R) {
    var G = R.power.groups, ref = E.reference.power.groups;
    var NAMES = { macro: "memories", combinational: "logic", clock: "clock tree", sequential: "flip-flops" };
    var max = Math.max.apply(null, Object.keys(G).map(function (g) { return Math.max(G[g].total * 1e3, ref[g]); }));
    var rows = ["macro", "combinational", "clock", "sequential"].filter(function (g) {
      return g !== "macro" || R.fp.macros.length;
    }).map(function (g) {
      var mine = G[g].total * 1e3;
      return '<div class="dz-prow"><span>' + NAMES[g] + "</span>" +
        '<div class="dz-pbars"><i class="dz-pm" style="width:' + (mine / max * 100) + '%"></i>' +
        '<i class="dz-pr" style="width:' + (ref[g] / max * 100) + '%"></i></div>' +
        "<b>" + mine.toFixed(2) + " <em>" + ref[g].toFixed(2) + "</em></b></div>";
    }).join("");
    resEl.querySelector("#dz-power").className = "";
    resEl.querySelector("#dz-power").innerHTML =
      '<p class="dz-big">' + mw(R.power.total) + " <span>at " + fmt(1e6 / R.timing.period) + " MHz</span></p>" +
      '<div class="dz-plegend"><span><i class="dz-pm"></i>this engine</span><span><i class="dz-pr"></i>real run (mW)</span></div>' +
      rows +
      '<p class="dz-cnote">Internal ' + mw(R.power.internal) + ", switching " + mw(R.power.switching) +
      ", leakage " + mw(R.power.leakage) + ". Like OpenSTA, the engine assumes each input switches 0.1 times " +
      "a cycle and works out every other net's rate from the logic (here " + R.power.activity.toFixed(2) +
      " switches a cycle on average).</p>";
  }

  /* ----- the clock sweep: the whole flow again at a range of clock periods,
     your other settings kept, beside the real flow's own sweep ----- */
  var SW = E.sweep, swEl = root.querySelector("#dz-sweep"), swWorker = null, swPoints = [], swKey = null, swRunning = false;
  function otherKnobs() {
    return E.knobs.filter(function (k) { return k.k !== "period"; }).map(function (k) { return k.k + "=" + state[k.k]; }).join("&");
  }
  function atFlow() { return E.knobs.every(function (k) { return k.k === "period" || state[k.k] === k.value; }); }
  if (SW && swEl) {
    swEl.innerHTML =
      '<div class="dz-swrun"><button class="btn btn-submit" type="button" id="dz-swgo">Run the sweep</button>' +
      '<span class="dz-status" id="dz-swstatus">' + SW.periods.length + " runs of the whole flow, about " +
      Math.max(1, Math.round(SW.periods.length * (SW.secondsPerRun || 1.3))) + " seconds</span></div>" +
      '<div class="dz-swkey"><span><i class="dz-swe"></i>this engine</span><span><i class="dz-swr"></i>real OpenROAD runs</span>' +
      '<span><i class="dz-swy"></i>your current clock</span><span class="dz-swhint">click any point to use that clock</span></div>' +
      '<div class="dz-swcharts" id="dz-swcharts"></div>' +
      '<p class="dz-swread" id="dz-swread"></p><p class="dz-cnote dz-swreal">' + esc(SW.realNote) + "</p>" +
      '<p class="dz-cnote" id="dz-swknobs"></p>';
    swEl.querySelector("#dz-swgo").addEventListener("click", sweep);
    swEl.querySelector("#dz-swcharts").addEventListener("click", function (ev) {
      var t = ev.target.closest && ev.target.closest("[data-period]");
      if (!t) return;
      var v = +t.getAttribute("data-period"), k = E.knobs.filter(function (x) { return x.k === "period"; })[0];
      state.period = v;
      knobsEl.querySelector('[data-k="period"]').value = v;
      showKnob(k);
      run();
      swDraw();
    });
    swDraw();
  }
  function sweep() {
    if (swWorker) swWorker.terminate();
    swWorker = new Worker(E.worker);
    swPoints = []; swKey = otherKnobs(); swRunning = true;
    var queue = SW.periods.slice(), n = queue.length, st = swEl.querySelector("#dz-swstatus");
    swEl.querySelector("#dz-swgo").textContent = "Run it again";
    function next() {
      if (!queue.length) { swRunning = false; st.textContent = "done: " + n + " runs"; swDraw(); return; }
      var period = queue.shift(), knobs = {};
      Object.keys(state).forEach(function (k) { knobs[k] = state[k]; });
      knobs.period = period;
      st.textContent = "running " + (n - queue.length) + " of " + n + ": " + fmt(period) + " ps";
      swWorker.postMessage({ type: "run", id: period, net: E.net, lib: E.lib, knobs: knobs, lite: true });
    }
    swWorker.onmessage = function (ev) {
      var m = ev.data;
      if (m.type === "error") { st.textContent = "the engine stopped: " + m.message; swRunning = false; return; }
      if (m.type !== "done") return;
      swPoints.push(m);
      swPoints.sort(function (a, b) { return a.period - b.period; });
      swDraw();
      next();
    };
    swDraw();
    next();
  }
  /* one chart: clock period across, a result up; the engine as a line, the real runs as rings */
  function swChart(title, unit, key, digits, opts) {
    /* the clock axis spans the sweep, a little padded, with gridlines at a round step */
    var allP = SW.periods.concat(SW.real.map(function (r) { return r.period; }));
    var p0 = Math.min.apply(null, allP), p1 = Math.max.apply(null, allP), padP = (p1 - p0) * 0.04;
    var W = 360, H = 210, L = 50, Rm = 10, T = 26, B = 34, xs = [p0 - padP, p1 + padP];
    var xraw = (p1 - p0) / 5, xmag = Math.pow(10, Math.floor(Math.log10(xraw))), xf = xraw / xmag;
    var xstep = (xf <= 1 ? 1 : xf <= 2 ? 2 : xf <= 5 ? 5 : 10) * xmag;
    var vals = swPoints.map(function (p) { return p[key]; }).concat(SW.real.map(function (r) { return r[key]; }));
    if (opts.zero) vals.push(0);
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), pad = (hi - lo) * 0.1 || 1;
    lo -= pad; hi += pad;
    function X(v) { return L + (v - xs[0]) / (xs[1] - xs[0]) * (W - L - Rm); }
    function Y(v) { return T + (hi - v) / (hi - lo) * (H - T - B); }
    /* about five gridlines, at a step of 1, 2 or 5 times a power of ten */
    var raw = (hi - lo) / 5, mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag;
    var step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * mag;
    var o = ['<svg viewBox="0 0 ' + W + " " + H + '" class="dz-swsvg" role="img" aria-label="' + esc(title) + ' against clock period">'];
    o.push('<text class="dz-swt" x="' + L + '" y="15">' + esc(title) + " (" + unit + ")</text>");
    if (opts.zero && lo < 0) {
      o.push('<rect x="' + L + '" y="' + Y(0) + '" width="' + (W - L - Rm) + '" height="' + (Y(lo) - Y(0)) + '" fill="#fef2f2"/>');
      o.push('<text class="dz-swlate" x="' + (W - Rm - 4) + '" y="' + (Y(lo) - 5) + '" text-anchor="end">late</text>');
    }
    for (var v = Math.ceil(lo / step) * step; v <= hi; v += step) {
      o.push('<line x1="' + L + '" x2="' + (W - Rm) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" class="dz-swgrid' +
        (opts.zero && Math.abs(v) < step / 2 ? " dz-swzero" : "") + '"/>');
      o.push('<text class="dz-swax" x="' + (L - 5) + '" y="' + (Y(v) + 3) + '" text-anchor="end">' +
        (Math.abs(v) < step / 2 ? "0" : (+v.toFixed(digits)).toLocaleString("en-US")) + "</text>");
    }
    for (var xv = Math.ceil(xs[0] / xstep) * xstep; xv <= xs[1]; xv += xstep) {
      o.push('<text class="dz-swax" x="' + X(xv) + '" y="' + (H - B + 14) + '" text-anchor="middle">' + fmt(xv) + "</text>");
    }
    o.push('<text class="dz-swax" x="' + (L + (W - L - Rm) / 2) + '" y="' + (H - 4) + '" text-anchor="middle">clock period (ps)</text>');
    o.push('<line x1="' + X(state.period) + '" x2="' + X(state.period) + '" y1="' + T + '" y2="' + (H - B) + '" class="dz-swyou"/>');
    SW.real.forEach(function (r) {
      o.push('<circle cx="' + X(r.period) + '" cy="' + Y(r[key]) + '" r="4.5" class="dz-swrp" data-period="' + r.period + '">' +
        "<title>real run at " + fmt(r.period) + " ps: " + (+r[key].toFixed(digits)).toLocaleString("en-US") + " " + unit + "</title></circle>");
    });
    if (swPoints.length > 1) o.push('<polyline class="dz-swline" points="' + swPoints.map(function (p) {
      return X(p.period) + "," + Y(p[key]); }).join(" ") + '"/>');
    swPoints.forEach(function (p) {
      o.push('<circle cx="' + X(p.period) + '" cy="' + Y(p[key]) + '" r="3.8" class="dz-swep" data-period="' + p.period + '">' +
        "<title>this engine at " + fmt(p.period) + " ps: " + (+p[key].toFixed(digits)).toLocaleString("en-US") + " " + unit + "</title></circle>");
    });
    o.push("</svg>");
    return '<div class="dz-swchart">' + o.join("") + "</div>";
  }
  function swDraw() {
    if (!SW || !swEl) return;
    swEl.querySelector("#dz-swcharts").innerHTML =
      swChart("Worst slack", "ps", "wns", 1, { zero: true }) +
      swChart("Power", "mW", "power", 2, {}) +
      swChart("Standard-cell area", "µm²", "area", 0, {});
    /* the reading: where the engine first closes timing, found between its points */
    var read = "", pts = swPoints;
    if (pts.length === SW.periods.length) {
      var cross = null;
      for (var i = 1; i < pts.length; i++) {
        if (pts[i - 1].wns < 0 && pts[i].wns >= 0) {
          var a = pts[i - 1], b = pts[i];
          cross = a.period + (0 - a.wns) / (b.wns - a.wns) * (b.period - a.period);
        }
      }
      var first = pts[0], lastp = pts[pts.length - 1];
      if (pts.every(function (p) { return p.wns >= 0; })) read = "The engine closes timing at every clock in this range.";
      else if (pts.every(function (p) { return p.wns < 0; })) read = "The engine does not close timing anywhere in this range; " +
        "its best worst slack is " + ps(Math.max.apply(null, pts.map(function (p) { return p.wns; }))) + ".";
      else read = "The engine closes timing from a clock of about " + fmt(cross) + " ps (" + fmt(1e6 / cross) + " MHz) and slower.";
      read += " From " + fmt(first.period) + " to " + fmt(lastp.period) + " ps its power falls from " + first.power.toFixed(1) +
        " to " + lastp.power.toFixed(1) + " mW.";
      /* against the real runs, over the clocks both cover */
      var rs = SW.real.slice().sort(function (a, b) { return a.period - b.period; }), rf = rs[0], rl = rs[rs.length - 1];
      function at(period) { return pts.filter(function (p) { return p.period === period; })[0]; }
      var ef = at(rf.period), el = at(rl.period);
      if (ef && el) {
        read += " Between " + fmt(rf.period) + " and " + fmt(rl.period) + " ps the real flow buys speed with area: it adds " +
          fmt(rf.area - rl.area) + " µm² of cells and " + fmt(rf.buffers - rl.buffers) + " buffers to meet the faster clock, " +
          "and its worst slack at " + fmt(rf.period) + " ps is still only " + ps(rf.wns) + ". The engine adds " +
          fmt(ef.area - el.area) + " µm² and " + fmt(ef.buffers - el.buffers) + " buffers there, and its slack at " +
          fmt(rf.period) + " ps is " + ps(ef.wns) + ". Both repairs make gates stronger and split loads behind " +
          "buffers; the real one can also copy gates, swap pins and place its changes more carefully, which is " +
          "why it holds on better at the fastest clocks.";
      }
    }
    swEl.querySelector("#dz-swread").textContent = read;
    var kn = swEl.querySelector("#dz-swknobs");
    var notes = [];
    if (!atFlow()) notes.push("Your other knobs are not at the flow's settings, so the real runs are a reference, not a match.");
    if (swKey !== null && swKey !== otherKnobs() && !swRunning) notes.push("You have changed a knob since the sweep ran; run it again to update the engine's line.");
    notes.push("The real area also counts about 18 µm² of tap and tie cells the engine does not place.");
    kn.textContent = notes.join(" ");
  }

  run();
};
