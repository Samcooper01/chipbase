/* ECO lab: eco-hold (hold fixing by delay insertion).
   A hold check compares data launched by one clock edge against the SAME capture
   edge: the new data must not race through the logic and reach the capture flop
   before that flop has safely held the previous value. A short data path (or a
   clock that reaches the capture flop later than the launch flop, positive skew)
   makes data arrive too early and violates hold. The fix is to slow the data path
   down by inserting delay cells. But the same path is still checked for setup
   against the NEXT edge, so adding too much delay makes data arrive too late and
   breaks setup. The path delay must land in a window: at least enough for hold, at
   most what setup allows. The learner inserts the fewest delay cells that put the
   path in the window. window.EcoHold = { evaluate, mount }. */
(function () {
  "use strict";
  var T = 1.5, TCQ = 0.3, TSU = 0.3, THOLD = 0.5, SKEW = 0.5, BASE = 0.3, DCELL = 0.3, NSLOT = 6;
  var LO = THOLD + SKEW - TCQ;      // min path delay to meet hold  = 0.70
  var HI = T + SKEW - TCQ - TSU;    // max path delay before setup breaks = 1.40
  function analyze(n) {
    var tpath = BASE + DCELL * n;
    var holdSlack = TCQ + tpath - THOLD - SKEW;
    var setupSlack = T + SKEW - TCQ - TSU - tpath;
    var holdOK = holdSlack >= -1e-9, setupOK = setupSlack >= -1e-9;
    return { n: n, tpath: tpath, holdSlack: holdSlack, setupSlack: setupSlack, holdOK: holdOK, setupOK: setupOK, pass: holdOK && setupOK };
  }
  function evaluate(spec, filled) {
    var n = 0; for (var i = 0; i < filled.length; i++) if (filled[i]) n++;
    return analyze(n);
  }

  function mount(container, spec) {
    var W = 660, Hpx = 340, dpr = window.devicePixelRatio || 1;
    var filled = []; for (var i = 0; i < NSLOT; i++) filled.push(false);
    var submitted = false, scoreObj = null;
    var wy = 84, x0 = 64, x1 = W - 96, clkY = 156;
    var sx0 = x0 + 46, sx1 = x1 - 46, slotStep = (sx1 - sx0) / (NSLOT - 1);
    function slotX(i) { return sx0 + i * slotStep; }

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas");
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "pointer"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "8px 0"; hint.style.maxWidth = W + "px";
    hint.innerHTML = "The capture clock arrives <b>later</b> than the launch clock (positive skew), so freshly launched data reaches the capture flip-flop too early and <b>hold fails</b>. Insert <b>delay cells</b> into the data path to make the data arrive later. But the same path still has to meet <b>setup</b> against the next edge, so too much delay breaks setup. <b>Click a slot</b> on the path to add or remove a delay cell, and land the path delay inside the window. Use the fewest cells that pass both, then <b>Submit fix</b>.";
    left.appendChild(hint);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit fix";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    var MET = "#3b82f6", DLY = "#7c3aed", OK = "#15803d", BAD = "#dc2626", DIM = "#334155", MUT = "#6b7280", CLK = "#0d9488";
    var hits = [];
    function ff(x, label) {
      ctx.fillStyle = "#eef1f7"; ctx.strokeStyle = "#334155"; ctx.lineWidth = 1.6; ctx.fillRect(x, wy - 24, 46, 48); ctx.strokeRect(x, wy - 24, 46, 48);
      ctx.fillStyle = "#1a1d26"; ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(label, x + 23, wy - 8);
      ctx.fillStyle = MUT; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.fillText("D  Q", x + 23, wy + 8);
      /* clock triangle on the bottom edge */
      ctx.strokeStyle = "#334155"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x + 15, wy + 24); ctx.lineTo(x + 23, wy + 16); ctx.lineTo(x + 31, wy + 24); ctx.stroke();
    }
    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx); hits = [];
      /* flip-flops */
      ff(x0 - 46, "launch"); ff(x1, "capture");
      /* data path */
      ctx.strokeStyle = MET; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0, wy); ctx.lineTo(x1, wy); ctx.stroke();
      ctx.fillStyle = MUT; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText("data path", (x0 + x1) / 2, wy - 30);
      /* slots + delay cells */
      for (var s = 0; s < NSLOT; s++) {
        var x = slotX(s), on = filled[s];
        if (on) {
          ctx.fillStyle = "rgba(124,58,237,0.15)"; ctx.strokeStyle = DLY; ctx.lineWidth = 1.8; ctx.fillRect(x - 12, wy - 11, 24, 22); ctx.strokeRect(x - 12, wy - 11, 24, 22);
          ctx.fillStyle = DLY; ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("Δ", x, wy);
        } else {
          ctx.strokeStyle = "#c9c6bd"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, wy - 7); ctx.lineTo(x, wy + 7); ctx.stroke();
        }
        hits.push([x - 13, wy - 24, x + 13, wy + 24, s]);
      }
      ctx.fillStyle = MUT; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText("click a slot to add or remove a delay cell (Δ = " + DCELL.toFixed(1) + " each)", (x0 + x1) / 2, wy + 30);
      /* clock net with skew */
      ctx.strokeStyle = CLK; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(40, clkY); ctx.lineTo(W - 40, clkY); ctx.stroke();
      ctx.fillStyle = CLK; ctx.font = "700 8px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.fillText("clock", 40, clkY - 4);
      /* launch clock branch (no skew) */
      var lcx = x0 - 46 + 23;
      ctx.beginPath(); ctx.moveTo(lcx, clkY); ctx.lineTo(lcx, wy + 24); ctx.stroke();
      ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText("arrives t=0", lcx, clkY + 3);
      /* capture clock branch (skew delay bump) */
      var ccx = x1 + 23;
      ctx.beginPath(); ctx.moveTo(ccx, clkY); ctx.lineTo(ccx, clkY + 14); ctx.stroke();
      ctx.strokeStyle = DLY; ctx.lineWidth = 1.8; ctx.strokeRect(ccx - 9, clkY + 14, 18, 14);
      ctx.fillStyle = DLY; ctx.font = "700 7px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("skew", ccx, clkY + 21);
      ctx.strokeStyle = CLK; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(ccx, clkY + 28); ctx.lineTo(ccx, wy + 24); ctx.stroke();
      ctx.fillStyle = CLK; ctx.font = "700 8px 'JetBrains Mono', monospace"; ctx.textBaseline = "top"; ctx.fillText("arrives t=+" + SKEW.toFixed(1), ccx, wy + 30 > clkY + 32 ? clkY + 32 : clkY + 32);
      /* path-delay window bar */
      drawWindow(res);
    }
    function drawWindow(res) {
      var bx = 60, bw = W - 120, by = 250, bh = 26, tmax = 2.1;
      function px(t) { return bx + (t / tmax) * bw; }
      ctx.fillStyle = "#5a606e"; ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.fillText("data-path delay window", bx, by - 6);
      /* zones */
      ctx.fillStyle = "rgba(220,38,38,0.12)"; ctx.fillRect(bx, by, px(LO) - bx, bh);
      ctx.fillStyle = "rgba(21,128,61,0.16)"; ctx.fillRect(px(LO), by, px(HI) - px(LO), bh);
      ctx.fillStyle = "rgba(220,38,38,0.12)"; ctx.fillRect(px(HI), by, bx + bw - px(HI), bh);
      ctx.strokeStyle = "#c9c6bd"; ctx.lineWidth = 1; ctx.strokeRect(bx, by, bw, bh);
      /* window edges */
      ctx.strokeStyle = OK; ctx.lineWidth = 1.4; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(px(LO), by - 3); ctx.lineTo(px(LO), by + bh + 3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px(HI), by - 3); ctx.lineTo(px(HI), by + bh + 3); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = BAD; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top";
      ctx.fillText("too fast: hold fails", (bx + px(LO)) / 2, by + bh + 4);
      ctx.fillText("too slow: setup fails", (px(HI) + bx + bw) / 2, by + bh + 4);
      ctx.fillStyle = OK; ctx.textBaseline = "bottom";
      ctx.fillText("hold floor " + LO.toFixed(2), px(LO), by - 4);
      ctx.fillText("setup ceiling " + HI.toFixed(2), px(HI), by - 4);
      /* current marker */
      var mx = px(res.tpath), col = res.pass ? OK : BAD;
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(mx, by - 2); ctx.lineTo(mx - 6, by - 12); ctx.lineTo(mx + 6, by - 12); ctx.closePath(); ctx.fill();
      ctx.fillStyle = col; ctx.lineWidth = 2; ctx.fillRect(mx - 1, by, 2, bh);
      ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText("path " + res.tpath.toFixed(2) + " (" + res.n + " cell" + (res.n === 1 ? "" : "s") + ")", mx, by - 13);
    }
    function computeScore(res) { var total = Math.round(Math.max(6000, 10000 - (res.n - 2) * 2000)), best = total; try { var key = "mp-best-" + (spec.id || "eco-hold"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {} return { total: total, best: best }; }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "hold met, setup safe" : (!res.holdOK ? "hold violated" : "setup broken")) + '</div>';
      html += '<div class="mp-row ' + (res.holdOK ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.holdOK ? "✔" : "✗") + '</span><span class="mp-label">Hold slack &ge; 0</span><span class="mp-detail">' + (res.holdSlack >= 0 ? "+" : "") + res.holdSlack.toFixed(2) + '</span></div>';
      html += '<div class="mp-row ' + (res.setupOK ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.setupOK ? "✔" : "✗") + '</span><span class="mp-label">Setup slack &ge; 0</span><span class="mp-detail">' + (res.setupSlack >= 0 ? "+" : "") + res.setupSlack.toFixed(2) + '</span></div>';
      html += '<div class="mp-score"><span class="mp-score-note" style="font-size:11px">delay cells: ' + res.n + ' &middot; path delay ' + res.tpath.toFixed(2) + ' (window ' + LO.toFixed(2) + " to " + HI.toFixed(2) + ')</span></div>';
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div><div class="mp-flow-note">Hold is met and setup still holds. Fewer delay cells score higher: the minimum delay that clears the hold floor leaves the most setup margin and the least added area and power.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>Both checks pass.</b> Fewer cells score higher. Click <b>Submit fix</b>.</div>';
      else if (!res.holdOK) html += '<div class="mp-score"><span class="mp-score-note">Data still arrives too early. Add delay cells until the path delay reaches the hold floor (' + LO.toFixed(2) + ').</span></div>';
      else html += '<div class="mp-score"><span class="mp-score-note">Too much delay now: data misses the next edge and setup fails. Remove cells until the path delay drops back under the setup ceiling (' + HI.toFixed(2) + ').</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, filled); draw(last); render(last); bSubmit.disabled = submitted || !last.pass; bSubmit.classList.toggle("mp-ready", !submitted && last.pass); }
    function tap(e) {
      if (submitted) return; var r = canvas.getBoundingClientRect(), t = e.touches ? e.touches[0] : e, px = t.clientX - r.left, py = t.clientY - r.top;
      for (var i = 0; i < hits.length; i++) { var h = hits[i]; if (px >= h[0] && px <= h[2] && py >= h[1] && py <= h[3]) { filled[h[4]] = !filled[h[4]]; scoreObj = null; refresh(); break; } }
      e.preventDefault();
    }
    canvas.addEventListener("mousedown", tap); canvas.addEventListener("touchstart", tap, { passive: false });
    bSubmit.addEventListener("click", function () { if (!submitted && last && last.pass) { submitted = true; scoreObj = computeScore(last); refresh(); } });
    bReset.addEventListener("click", function () { for (var i = 0; i < NSLOT; i++) filled[i] = false; submitted = false; scoreObj = null; refresh(); });
    refresh();
  }

  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.EcoHold = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
