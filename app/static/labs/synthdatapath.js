/* Synthesis lab: synth-datapath (operator selection).
   A datapath chains four adds: out = ((((v+w)+x)+y)+z). The path delay is the sum of
   the four adders' delays. Each add can be built three ways, drawn as its actual
   gate-level structure so the trade-off is visible, not just a number:
     - ripple-carry : one row of full adders, the carry ripples cell to cell (small
       area, long carry path, slow).
     - carry-select : two ripple rows (for carry-in 0 and 1) plus a mux that picks
       the right one the moment the carry-in is known (about double the area, faster).
     - carry-lookahead : full adders with a separate lookahead block that computes all
       the carries in parallel (most area, shortest delay).
   The learner picks an architecture per adder to meet a delay target at least area.
   All ripple is cheapest but too slow; the best mix here is three carry-select plus
   one carry-lookahead (delay 14, area 19). window.SynthDatapath = { evaluate, mount }. */
(function () {
  "use strict";
  var NAD = 4, TARGET = 14, OPT_AREA = 19;
  var ORDER = ["ripple", "cselect", "lookahead"];
  var ARCH = {
    ripple: { name: "ripple-carry", area: 2, delay: 6 },
    cselect: { name: "carry-select", area: 4, delay: 4 },
    lookahead: { name: "carry-lookahead", area: 7, delay: 2 }
  };
  function analyze(sel) {
    var delay = 0, area = 0; sel.forEach(function (k) { delay += ARCH[k].delay; area += ARCH[k].area; });
    return { sel: sel, delay: delay, area: area, delayOK: delay <= TARGET, pass: delay <= TARGET && area <= OPT_AREA };
  }
  function evaluate(spec, sel) { return analyze(sel || []); }

  function mount(container, spec) {
    var W = 620, Hpx = 336, dpr = window.devicePixelRatio || 1;
    var sel = ["ripple", "ripple", "ripple", "ripple"], submitted = false, scoreObj = null;
    var slotW = 138, slotH = 116, sx0 = 20, sy = 58, gap = 12;
    var OPER = ["v+w", "+x", "+y", "+z"];

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas");
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "pointer"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "8px 0"; hint.style.maxWidth = W + "px";
    hint.innerHTML = "The datapath chains four adds, out = ((((v+w)+x)+y)+z), so the path delay is the sum of the four adders' delays. Each adder is drawn as its real structure: <b>ripple-carry</b> is one row of full adders with the carry rippling cell to cell (small, slow); <b>carry-select</b> is two ripple rows plus a mux that picks the answer as soon as the carry-in is known (bigger, faster); <b>carry-lookahead</b> adds a block that computes every carry in parallel (biggest, fastest). <b>Click an adder</b> to change its architecture. Meet the delay target (" + TARGET + ") at the <b>least total area</b>: do not make every adder fast, only spend where you must. Then <b>Submit datapath</b>.";
    left.appendChild(hint);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit datapath";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    var MET = "#3b82f6", OK = "#15803d", BAD = "#dc2626", MUT = "#6b7280", FA = "#334155", CARRY = "#dc2626", LA = "#7c3aed", MUX = "#0d9488";
    var hits = [];
    function faCell(x, y) { ctx.fillStyle = "#eef1f7"; ctx.strokeStyle = FA; ctx.lineWidth = 1; ctx.fillRect(x, y, 15, 12); ctx.strokeRect(x, y, 15, 12); ctx.fillStyle = "#5a606e"; ctx.font = "6px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("FA", x + 7.5, y + 6); }
    function drawRipple(ox, oy, ow) {
      var y = oy + 20, x0 = ox + 12, step = 26;
      /* carry chain entering left, snaking through 3 FAs, exiting right */
      ctx.strokeStyle = CARRY; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(x0 - 8, y + 16);
      for (var i = 0; i < 3; i++) { var fx = x0 + i * step; ctx.lineTo(fx, y + 16); ctx.lineTo(fx, y + 12); ctx.lineTo(fx + 15, y + 12); ctx.lineTo(fx + 15, y + 16); }
      ctx.lineTo(x0 + 3 * step, y + 16); ctx.stroke();
      for (var j = 0; j < 3; j++) faCell(x0 + j * step, y);
      ctx.fillStyle = CARRY; ctx.font = "6px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText("carry ripples → (long path)", x0 - 8, y + 20);
    }
    function drawCselect(ox, oy, ow) {
      var x0 = ox + 10, step = 24, yt = oy + 8, yb = oy + 30;
      for (var i = 0; i < 3; i++) { faCell(x0 + i * step, yt); faCell(x0 + i * step, yb); }
      ctx.fillStyle = MUT; ctx.font = "6px 'JetBrains Mono', monospace"; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText("cin=0", x0 - 2, yt + 6); ctx.fillText("cin=1", x0 - 2, yb + 6);
      /* mux */
      var mx = x0 + 3 * step + 6, my = oy + 24;
      ctx.fillStyle = "rgba(13,148,136,0.14)"; ctx.strokeStyle = MUX; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(mx, my - 12); ctx.lineTo(mx + 14, my - 6); ctx.lineTo(mx + 14, my + 6); ctx.lineTo(mx, my + 12); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "#9aa0aa"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0 + 3 * step, yt + 6); ctx.lineTo(mx, my - 6); ctx.moveTo(x0 + 3 * step, yb + 6); ctx.lineTo(mx, my + 6); ctx.stroke();
      ctx.fillStyle = MUX; ctx.font = "6px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText("mux", mx + 6, my + 13);
    }
    function drawLookahead(ox, oy, ow) {
      var y = oy + 10, x0 = ox + 14, step = 26;
      for (var i = 0; i < 3; i++) faCell(x0 + i * step, y);
      var lx = x0 - 2, lw = 3 * step - 4, ly = oy + 42;
      ctx.fillStyle = "rgba(124,58,237,0.14)"; ctx.strokeStyle = LA; ctx.lineWidth = 1.4; ctx.fillRect(lx, ly, lw, 16); ctx.strokeRect(lx, ly, lw, 16);
      ctx.fillStyle = LA; ctx.font = "7px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("carry-lookahead", lx + lw / 2, ly + 8);
      /* parallel carry lines from CLA up to each FA */
      ctx.strokeStyle = LA; ctx.lineWidth = 1; for (var j = 0; j < 3; j++) { var fx = x0 + j * step + 7; ctx.beginPath(); ctx.moveTo(fx, ly); ctx.lineTo(fx, y + 12); ctx.stroke(); }
      ctx.fillStyle = LA; ctx.font = "6px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText("all carries in parallel", lx, ly + 18);
    }
    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx); hits = [];
      for (var i = 0; i < NAD; i++) {
        var bx = sx0 + i * (slotW + gap), a = ARCH[sel[i]];
        /* operand feeding in */
        ctx.fillStyle = "#1a1d26"; ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText(OPER[i], bx + slotW / 2, sy - 4);
        /* slot box */
        ctx.fillStyle = "#fbfaf7"; ctx.strokeStyle = "#c9c6bd"; ctx.lineWidth = 1.4; ctx.fillRect(bx, sy, slotW, slotH); ctx.strokeRect(bx, sy, slotW, slotH);
        ctx.fillStyle = "#1a1d26"; ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText("A" + (i + 1) + "  " + a.name, bx + 6, sy + 5);
        if (sel[i] === "ripple") drawRipple(bx, sy + 16, slotW);
        else if (sel[i] === "cselect") drawCselect(bx, sy + 16, slotW);
        else drawLookahead(bx, sy + 16, slotW);
        ctx.fillStyle = MUT; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.fillText("area " + a.area + " · delay " + a.delay, bx + 6, sy + slotH - 4);
        /* chain arrow to next */
        if (i < NAD - 1) { ctx.strokeStyle = MET; ctx.lineWidth = 2; var ax = bx + slotW, ay = sy + slotH / 2; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + gap, ay); ctx.stroke(); }
        else { ctx.strokeStyle = "#334155"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx + slotW, sy + slotH / 2); ctx.lineTo(bx + slotW + 8, sy + slotH / 2); ctx.stroke(); ctx.fillStyle = "#1a1d26"; ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("out", bx + slotW + 12, sy + slotH / 2); }
        hits.push([bx, sy, bx + slotW, sy + slotH, i]);
      }
      /* delay bar */
      var by = 214, bx0 = 30, bw = W - 120, tmax = 24, sc = bw / tmax, lim = bx0 + TARGET * sc;
      ctx.fillStyle = "#5a606e"; ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.fillText("path delay (sum of the four adders)", bx0, by - 4);
      ctx.fillStyle = "#eceae2"; ctx.fillRect(bx0, by, bw, 18); ctx.strokeStyle = "#c9c6bd"; ctx.lineWidth = 1; ctx.strokeRect(bx0, by, bw, 18);
      var dw = Math.min(bw, res.delay * sc); ctx.fillStyle = res.delayOK ? "rgba(21,128,61,0.55)" : "rgba(220,38,38,0.55)"; ctx.fillRect(bx0, by, dw, 18);
      ctx.strokeStyle = "#c23c32"; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(lim, by - 6); ctx.lineTo(lim, by + 24); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = "#c23c32"; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText("target " + TARGET, lim, by - 4);
      ctx.fillStyle = res.delayOK ? OK : BAD; ctx.font = "700 11px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("delay " + res.delay + "  ·  area " + res.area, bx0, by + 34);
    }
    function computeScore(res) { var total = Math.round(Math.max(6000, 10000 - (res.area - OPT_AREA) * 900)), best = total; try { var key = "mp-best-" + (spec.id || "synth-datapath"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {} return { total: total, best: best }; }
    function render(res) {
      var counts = { ripple: 0, cselect: 0, lookahead: 0 }; res.sel.forEach(function (k) { counts[k]++; });
      var head = res.pass ? "meets target at least area" : (res.delayOK ? "meets target, but larger than needed" : "too slow");
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + head + '</div>';
      html += '<div class="mp-row ' + (res.delayOK ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.delayOK ? "✔" : "✗") + '</span><span class="mp-label">Path delay &le; target</span><span class="mp-detail">' + res.delay + " / " + TARGET + '</span></div>';
      html += '<div class="mp-row ' + (res.pass ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.pass ? "✔" : "✗") + '</span><span class="mp-label">Total area</span><span class="mp-detail">' + res.area + " (min " + OPT_AREA + ")</span></div>";
      html += '<div class="mp-score"><span class="mp-score-note" style="font-size:11px">' + counts.ripple + ' ripple · ' + counts.cselect + ' carry-select · ' + counts.lookahead + ' lookahead</span></div>';
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div><div class="mp-flow-note">Three carry-select adders plus one lookahead: delay 14 meets the target at area 19. Making all four lookahead would be faster than needed and cost far more; one fast adder is enough to pull the sum under the target.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>Meets the target.</b> Click <b>Submit datapath</b>.</div>';
      else if (!res.delayOK) html += '<div class="mp-score"><span class="mp-score-note">Too slow (delay ' + res.delay + ' &gt; ' + TARGET + '). Ripple adders have the long carry path. Move some adders to carry-select or lookahead to shorten the sum.</span></div>';
      else html += '<div class="mp-score"><span class="mp-score-note">You meet the target but spent too much area (' + res.area + ' &gt; ' + OPT_AREA + '). Some adders are faster than the target needs. Use the cheapest architecture on each adder that still keeps the total delay in range.</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, sel); draw(last); render(last); bSubmit.disabled = submitted || !last.pass; bSubmit.classList.toggle("mp-ready", !submitted && last.pass); }
    function tap(e) {
      if (submitted) return; var r = canvas.getBoundingClientRect(), t = e.touches ? e.touches[0] : e, px = t.clientX - r.left, py = t.clientY - r.top;
      for (var i = 0; i < hits.length; i++) { var h = hits[i]; if (px >= h[0] && px <= h[2] && py >= h[1] && py <= h[3]) { var cur = ORDER.indexOf(sel[h[4]]); sel[h[4]] = ORDER[(cur + 1) % ORDER.length]; scoreObj = null; refresh(); break; } }
      e.preventDefault();
    }
    canvas.addEventListener("mousedown", tap); canvas.addEventListener("touchstart", tap, { passive: false });
    bSubmit.addEventListener("click", function () { if (!submitted && last && last.pass) { submitted = true; scoreObj = computeScore(last); refresh(); } });
    bReset.addEventListener("click", function () { sel = ["ripple", "ripple", "ripple", "ripple"]; submitted = false; scoreObj = null; refresh(); });
    refresh();
  }

  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.SynthDatapath = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
