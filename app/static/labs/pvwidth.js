/* Physical Verification lab: pv-width-spacing.
   An interactive minimum-width and minimum-spacing check. The layout has metal
   wires, some too thin (below minimum width) and some too close (below minimum
   spacing). The learner fixes them: drag a wire to move it, or drag its bottom
   edge to change its thickness, until every wire meets minimum width and every
   gap meets minimum spacing. window.PvWidth = { evaluate, mount }. */
(function () {
  "use strict";
  var WMIN = 0.10, SMIN = 0.10, LAYH = 1.00, SCALE = 300; // micrometres; pixels per micrometre
  var INIT = [ { top: 0.05, thick: 0.14 }, { top: 0.29, thick: 0.06 }, { top: 0.50, thick: 0.12 }, { top: 0.67, thick: 0.12 } ];

  function gapsOf(wires) { var g = []; for (var i = 0; i < wires.length - 1; i++) g.push(wires[i + 1].top - (wires[i].top + wires[i].thick)); return g; }
  function evaluate(spec, wires) {
    var widthBad = [], spaceBad = [];
    wires.forEach(function (w, i) { if (w.thick < WMIN - 1e-9) widthBad.push(i); });
    gapsOf(wires).forEach(function (g, i) { if (g < SMIN - 1e-9) spaceBad.push(i); });
    return { widthBad: widthBad, spaceBad: spaceBad, gaps: gapsOf(wires),
      widthOK: widthBad.length === 0, spaceOK: spaceBad.length === 0,
      pass: widthBad.length === 0 && spaceBad.length === 0 };
  }

  function mount(container, spec) {
    var W = 600, Hpx = 372, dpr = window.devicePixelRatio || 1;
    var wires = INIT.map(function (w) { return { top: w.top, thick: w.thick }; });
    var drag = null, scoreObj = null, submitted = false;
    var lx = 150, ly = 30, boxW = 300, boxH = LAYH * SCALE, wx = lx + 16, ww = boxW - 32;

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas");
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "8px 0"; hint.style.maxWidth = W + "px";
    hint.innerHTML = "Drag a wire to <b>move it</b>, or drag its <b>bottom edge</b> to change its <b>thickness</b>. Make every wire at least the minimum width W<sub>min</sub> = " + WMIN.toFixed(2) + " thick, and every gap at least the minimum spacing S<sub>min</sub> = " + SMIN.toFixed(2) + ". Dimensions in micrometres.";
    left.appendChild(hint);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit fixes";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    var MET = "#3b82f6", METE = "#1d4ed8", OK = "#15803d", BAD = "#dc2626", DIM = "#334155", MUT = "#8a90a0";
    function py(muY) { return ly + muY * SCALE; }

    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx);
      /* layout window */
      ctx.fillStyle = "#f6f5f0"; ctx.fillRect(lx, ly, boxW, boxH); ctx.strokeStyle = "#c9c6bd"; ctx.lineWidth = 1; ctx.strokeRect(lx, ly, boxW, boxH);
      ctx.fillStyle = MUT; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.fillText("metal layer", lx, ly - 4);
      /* gap markers (draw first, behind wires' labels) */
      res.gaps.forEach(function (g, i) {
        var y0 = py(wires[i].top + wires[i].thick), y1 = py(wires[i + 1].top), bad = g < SMIN - 1e-9;
        if (y1 - y0 > 1) { ctx.fillStyle = bad ? "rgba(220,38,38,0.14)" : "rgba(21,128,61,0.10)"; ctx.fillRect(wx, y0, ww, y1 - y0); }
        var mx = lx + boxW + 12;
        ctx.strokeStyle = bad ? BAD : OK; ctx.fillStyle = bad ? BAD : OK; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(mx, y0); ctx.lineTo(mx, y1); ctx.stroke();
        [[y0, 1], [y1, -1]].forEach(function (p) { ctx.beginPath(); ctx.moveTo(mx, p[0]); ctx.lineTo(mx - 3, p[0] + 4 * p[1]); ctx.lineTo(mx + 3, p[0] + 4 * p[1]); ctx.closePath(); ctx.fill(); });
        ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("gap " + g.toFixed(2) + (bad ? " < " + SMIN.toFixed(2) : ""), mx + 6, (y0 + y1) / 2);
      });
      /* wires */
      wires.forEach(function (w, i) {
        var y = py(w.top), h = w.thick * SCALE, bad = w.thick < WMIN - 1e-9;
        ctx.fillStyle = MET; ctx.fillRect(wx, y, ww, h);
        ctx.strokeStyle = bad ? BAD : METE; ctx.lineWidth = bad ? 2.2 : 1.2; ctx.strokeRect(wx, y, ww, h);
        /* resize grip on bottom edge */
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; for (var k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(wx + ww / 2 - 8, y + h - 3 + k * 2); ctx.lineTo(wx + ww / 2 + 8, y + h - 3 + k * 2); ctx.stroke(); }
        /* thickness label (left) */
        ctx.fillStyle = bad ? BAD : DIM; ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
        ctx.fillText("w" + (i + 1) + " " + w.thick.toFixed(2) + (bad ? " < " + WMIN.toFixed(2) : ""), lx - 8, y + h / 2);
      });
      /* min reference note */
      ctx.fillStyle = MUT; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "top";
      ctx.fillText("drag body = move    drag bottom edge = resize", lx, ly + boxH + 6);
    }
    function computeScore() { var total = 10000, best = total; try { var key = "mp-best-" + (spec.id || "pv-width-spacing"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {} return { total: total, best: best }; }
    function render(res) {
      var nw = res.widthBad.length, ns = res.spaceBad.length;
      var html = '<div class="mp-verdict ' + (submitted && res.pass ? "mp-pass" : (res.pass ? "mp-pass" : "mp-fail")) + '">' + (res.pass ? "clean" : (nw + ns) + " violation" + (nw + ns === 1 ? "" : "s")) + '</div>';
      html += '<div class="mp-row ' + (res.widthOK ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.widthOK ? "✔" : "✗") + '</span><span class="mp-label">Every wire &ge; W_min</span><span class="mp-detail">' + (wires.length - nw) + " / " + wires.length + '</span></div>';
      html += '<div class="mp-row ' + (res.spaceOK ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.spaceOK ? "✔" : "✗") + '</span><span class="mp-label">Every gap &ge; S_min</span><span class="mp-detail">' + (res.gaps.length - ns) + " / " + res.gaps.length + '</span></div>';
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div><div class="mp-flow-note">Every wire meets minimum width and every gap meets minimum spacing. The layer is design-rule clean.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>No violations left.</b> Click <b>Submit fixes</b>.</div>';
      else if (nw) html += '<div class="mp-score"><span class="mp-score-note">A red-outlined wire is thinner than W_min. Drag its bottom edge down to thicken it to at least ' + WMIN.toFixed(2) + '.</span></div>';
      else html += '<div class="mp-score"><span class="mp-score-note">A red gap is narrower than S_min. Drag one of the two wires away to open the gap to at least ' + SMIN.toFixed(2) + '.</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, wires); draw(last); render(last); bSubmit.disabled = submitted || !last.pass; bSubmit.classList.toggle("mp-ready", !submitted && last.pass); }

    function pick(px, pyv) {
      for (var i = 0; i < wires.length; i++) {
        var y = py(wires[i].top), h = wires[i].thick * SCALE;
        if (px < wx - 2 || px > wx + ww + 2) continue;
        if (pyv >= y + h - 6 && pyv <= y + h + 6) return { i: i, mode: "resize" };
        if (pyv >= y && pyv <= y + h) return { i: i, mode: "move", grab: pyv - y };
      }
      return null;
    }
    function evtXY(e) { var r = canvas.getBoundingClientRect(); var t = e.touches ? e.touches[0] : e; return [t.clientX - r.left, t.clientY - r.top]; }
    function down(e) { if (submitted) return; var p = evtXY(e); drag = pick(p[0], p[1]); if (drag) e.preventDefault(); }
    function move(e) {
      var p = evtXY(e);
      if (!drag) { var hv = pick(p[0], p[1]); canvas.style.cursor = hv ? (hv.mode === "resize" ? "ns-resize" : "move") : "default"; return; }
      var i = drag.i, w = wires[i];
      var upper = i > 0 ? wires[i - 1].top + wires[i - 1].thick : 0;
      var lower = i < wires.length - 1 ? wires[i + 1].top : LAYH;
      if (drag.mode === "move") {
        var nt = (p[1] - drag.grab - ly) / SCALE;
        nt = Math.max(upper, Math.min(lower - w.thick, nt));
        w.top = nt;
      } else {
        var nb = (p[1] - ly) / SCALE;
        var nthick = nb - w.top;
        nthick = Math.max(0.02, Math.min(lower - w.top, nthick));
        w.thick = nthick;
      }
      scoreObj = null; refresh(); e.preventDefault();
    }
    function up() { drag = null; }
    canvas.addEventListener("mousedown", down); canvas.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    canvas.addEventListener("touchstart", down, { passive: false }); canvas.addEventListener("touchmove", move, { passive: false }); window.addEventListener("touchend", up);
    bSubmit.addEventListener("click", function () { if (!submitted && last && last.pass) { submitted = true; scoreObj = computeScore(); refresh(); } });
    bReset.addEventListener("click", function () { wires = INIT.map(function (w) { return { top: w.top, thick: w.thick }; }); submitted = false; scoreObj = null; refresh(); });
    refresh();
  }

  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.PvWidth = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
