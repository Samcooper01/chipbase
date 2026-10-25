/* Synthesis lab: synth-retime (retiming).
   A pipeline is a chain of combinational gates split into stages by registers. The
   clock period is set by the slowest stage: the longest run of gate delay between
   two adjacent registers. Retiming relocates registers across the gates, keeping the
   circuit's behavior at its inputs and outputs, to balance the stages so the slowest
   one is as fast as possible. Here the chain has fixed input and output registers and
   two movable internal registers (three stages). Gate delays 3,1,2,4,1,2; the best
   balance places the internal registers after gate 2 and gate 4, period 6.
   window.SynthRetime = { evaluate, mount }. */
(function () {
  "use strict";
  var D = [3, 1, 2, 4, 1, 2];
  var NREG = 2, OPT_PERIOD = 6;
  var P = [0]; for (var i = 0; i < D.length; i++) P.push(P[i] + D[i]);
  function analyze(slots) {
    var s = slots.slice().sort(function (a, b) { return a - b; });
    var bounds = [0].concat(s).concat([D.length]);
    var stages = [];
    for (var i = 0; i < bounds.length - 1; i++) stages.push(P[bounds[i + 1]] - P[bounds[i]]);
    var period = Math.max.apply(null, stages);
    return { stages: stages, bounds: bounds, period: period, count: slots.length, pass: slots.length === NREG && period <= OPT_PERIOD };
  }
  function evaluate(spec, slots) { return analyze(slots || []); }

  function mount(container, spec) {
    var W = 640, Hpx = 300, dpr = window.devicePixelRatio || 1;
    var slots = [4, 5], submitted = false, scoreObj = null; // start bunched at the end (bad balance)
    var gy = 116, gw = 52, gx0 = 96, gstep = 74;
    function gateCX(i) { return gx0 + i * gstep; }               // i: 0..5
    function slotX(pos) { return gateCX(pos - 1) + gstep / 2; }   // boundary after gate `pos` (1..5)

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas");
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "pointer"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "8px 0"; hint.style.maxWidth = W + "px";
    hint.innerHTML = "This pipeline is a chain of gates with fixed input and output registers and <b>two movable internal registers</b>, splitting it into three stages. The <b>clock period</b> is the slowest stage (the most gate delay between two adjacent registers). Right now the registers are bunched near the end, so one stage is huge. <b>Click a boundary</b> (between two gates) to move a register there: relocating registers does not change what the circuit computes, only where the stage cuts fall. Balance the three stages to make the slowest one as fast as possible (exactly two internal registers), then <b>Submit retiming</b>.";
    left.appendChild(hint);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit retiming";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    var MET = "#3b82f6", REG = "#0d9488", OK = "#15803d", BAD = "#dc2626", MUT = "#6b7280";
    var hits = [];
    function reg(x, fixed) {
      ctx.fillStyle = fixed ? "#e7efee" : "rgba(13,148,136,0.16)"; ctx.strokeStyle = REG; ctx.lineWidth = 2; ctx.fillRect(x - 8, gy - 22, 16, 44); ctx.strokeRect(x - 8, gy - 22, 16, 44);
      ctx.strokeStyle = REG; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x - 5, gy + 22); ctx.lineTo(x, gy + 16); ctx.lineTo(x + 5, gy + 22); ctx.stroke();
    }
    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx); hits = [];
      var startX = gx0 - gstep / 2 - 6, endX = gateCX(5) + gstep / 2 + 6;
      /* wire */
      ctx.strokeStyle = MET; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(startX, gy); ctx.lineTo(endX, gy); ctx.stroke();
      /* gates */
      for (var i = 0; i < 6; i++) {
        var x = gateCX(i);
        ctx.fillStyle = "#eef1f7"; ctx.strokeStyle = "#334155"; ctx.lineWidth = 1.6; ctx.fillRect(x - gw / 2, gy - 15, gw, 30); ctx.strokeRect(x - gw / 2, gy - 15, gw, 30);
        ctx.fillStyle = "#1a1d26"; ctx.font = "700 10px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("g" + (i + 1), x, gy - 3);
        ctx.fillStyle = MUT; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.fillText("d=" + D[i], x, gy + 8);
      }
      /* fixed input/output registers */
      reg(startX, true); reg(endX, true);
      ctx.fillStyle = MUT; ctx.font = "7px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText("in reg", startX, gy + 24); ctx.fillText("out reg", endX, gy + 24);
      /* boundary slots */
      for (var pos = 1; pos <= 5; pos++) {
        var sxp = slotX(pos), has = slots.indexOf(pos) >= 0;
        if (has) reg(sxp, false);
        else { ctx.strokeStyle = "#c9c6bd"; ctx.setLineDash([3, 3]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(sxp, gy - 20); ctx.lineTo(sxp, gy + 20); ctx.stroke(); ctx.setLineDash([]); }
        hits.push([sxp - 12, gy - 24, sxp + 12, gy + 24, pos]);
      }
      /* stage brackets + sums */
      var by = gy + 54;
      for (var k = 0; k < res.bounds.length - 1; k++) {
        var a = res.bounds[k], b = res.bounds[k + 1];
        var xa = (a === 0 ? startX : slotX(a)), xb = (b === 6 ? endX : slotX(b));
        var isMax = res.stages[k] === res.period;
        ctx.strokeStyle = isMax ? BAD : "#9aa0aa"; ctx.lineWidth = isMax ? 2.4 : 1.4;
        ctx.beginPath(); ctx.moveTo(xa + 3, by); ctx.lineTo(xb - 3, by); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(xa + 3, by - 4); ctx.lineTo(xa + 3, by + 4); ctx.moveTo(xb - 3, by - 4); ctx.lineTo(xb - 3, by + 4); ctx.stroke();
        ctx.fillStyle = isMax ? BAD : "#5a606e"; ctx.font = "700 10px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(String(res.stages[k]), (xa + xb) / 2, by + 5);
      }
      ctx.fillStyle = MUT; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText("stage delays (red = the stage that sets the clock period)", gx0 - 40, by + 22);
    }
    function computeScore(res) { var total = Math.round(Math.max(6000, 10000 - (res.period - OPT_PERIOD) * 1500)), best = total; try { var key = "mp-best-" + (spec.id || "synth-retime"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {} return { total: total, best: best }; }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "balanced, period minimized" : (res.count !== NREG ? "need exactly " + NREG + " registers" : "period above minimum")) + '</div>';
      html += '<div class="mp-row ' + (res.count === NREG ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.count === NREG ? "✔" : "✗") + '</span><span class="mp-label">Internal registers</span><span class="mp-detail">' + res.count + " / " + NREG + '</span></div>';
      html += '<div class="mp-row ' + (res.count === NREG && res.period <= OPT_PERIOD ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.count === NREG && res.period <= OPT_PERIOD ? "✔" : "✗") + '</span><span class="mp-label">Clock period</span><span class="mp-detail">' + res.period + " (min " + OPT_PERIOD + ")</span></div>";
      html += '<div class="mp-score"><span class="mp-score-note" style="font-size:11px">stages: ' + res.stages.join(" · ") + '</span></div>';
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div><div class="mp-flow-note">The registers sit after gate 2 and gate 4, so the three stages are as even as the gate delays allow and the slowest is only ' + OPT_PERIOD + '. No logic changed, only where the registers fall.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>Balanced at the minimum period.</b> Click <b>Submit retiming</b>.</div>';
      else if (res.count !== NREG) html += '<div class="mp-score"><span class="mp-score-note">A pipeline register count is fixed (it sets the latency). Place exactly ' + NREG + ' internal registers, moving them, not adding or removing.</span></div>';
      else html += '<div class="mp-score"><span class="mp-score-note">One stage is too long (red). Move a register toward the heavy stage to shorten it, spreading the delay more evenly across the three stages.</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, slots); draw(last); render(last); bSubmit.disabled = submitted || !last.pass; bSubmit.classList.toggle("mp-ready", !submitted && last.pass); }
    function tap(e) {
      if (submitted) return; var r = canvas.getBoundingClientRect(), t = e.touches ? e.touches[0] : e, px = t.clientX - r.left, py = t.clientY - r.top;
      for (var i = 0; i < hits.length; i++) { var h = hits[i]; if (px >= h[0] && px <= h[2] && py >= h[1] && py <= h[3]) { var pos = h[4], k = slots.indexOf(pos); if (k >= 0) slots.splice(k, 1); else slots.push(pos); scoreObj = null; refresh(); break; } }
      e.preventDefault();
    }
    canvas.addEventListener("mousedown", tap); canvas.addEventListener("touchstart", tap, { passive: false });
    bSubmit.addEventListener("click", function () { if (!submitted && last && last.pass) { submitted = true; scoreObj = computeScore(last); refresh(); } });
    bReset.addEventListener("click", function () { slots = [4, 5]; submitted = false; scoreObj = null; refresh(); });
    refresh();
  }

  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.SynthRetime = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
