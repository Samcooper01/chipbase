/* ECO lab: eco-skew (useful-skew clock ECO).
   A flip-flop sits between two logic stages: stage A feeds into it, stage B leaves
   it. If stage A is setup-critical (negative slack) but stage B has slack to spare,
   retarding the shared flop's clock lends time to stage A (it captures on a later
   edge) at the cost of stage B (it launches later). This is useful skew: no logic
   changes, only the clock arrival at that one flop moves, transferring slack from
   the loose stage to the tight one. Skew too far and stage B goes negative, so
   there is a window. The interaction is direct: clicking a stage donates timing
   margin to the OTHER stage (which is implemented as clock skew on the shared flop,
   shown on its clock branch). Clicking stage B moves time to stage A; clicking
   stage A moves time back to stage B. window.EcoSkew = { evaluate, mount }. */
(function () {
  "use strict";
  var T = 2.0, TCQ = 0.3, TSU = 0.3, TA = 1.6, TB = 1.0, STEP = 0.1, MINSTEP = -3, MAXSTEP = 6;
  function analyze(n) {
    var skew = STEP * n;
    var slackA = T + skew - TCQ - TA - TSU;   // later capture clock helps stage A
    var slackB = T - skew - TCQ - TB - TSU;   // ... and hurts stage B
    var aOK = slackA >= -1e-9, bOK = slackB >= -1e-9;
    return { n: n, skew: skew, slackA: slackA, slackB: slackB, aOK: aOK, bOK: bOK, min: Math.min(slackA, slackB), pass: aOK && bOK };
  }
  function evaluate(spec, n) { return analyze(n | 0); }

  function mount(container, spec) {
    var W = 680, Hpx = 340, dpr = window.devicePixelRatio || 1;
    var steps = 0, submitted = false, scoreObj = null;
    var wy = 66, clkStripY = 150;
    var A_L = 80, A_R = 250, B_L = 350, B_R = 520;

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas");
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "pointer"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "8px 0"; hint.style.maxWidth = W + "px";
    hint.innerHTML = "The middle flip-flop <b>FF2</b> is shared by two stages. Stage A into it is too slow and <b>misses setup</b>. Stage B out of it has slack to spare. There is a fixed total time to split between them, and moving FF2's clock edge decides the split. <b>Click a stage to lend its timing margin to the other</b>: click <b>stage B</b> to move time into stage A, or click <b>stage A</b> to move it back to stage B. Under the hood this retards or advances FF2's clock (shown on its clock branch). Make <b>both</b> stages pass, and prefer the balanced split. Then <b>Submit skew</b>.";
    left.appendChild(hint);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit skew";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    var MET = "#3b82f6", DLY = "#7c3aed", OK = "#15803d", BAD = "#dc2626", DIM = "#334155", MUT = "#6b7280", CLK = "#0d9488";
    var hits = [];
    function ff(x, label, hl) {
      ctx.fillStyle = hl ? "rgba(124,58,237,0.12)" : "#eef1f7"; ctx.strokeStyle = hl ? DLY : "#334155"; ctx.lineWidth = hl ? 2 : 1.6; ctx.fillRect(x, wy - 22, 44, 44); ctx.strokeRect(x, wy - 22, 44, 44);
      ctx.fillStyle = "#1a1d26"; ctx.font = "700 10px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(label, x + 22, wy - 4);
      ctx.fillStyle = MUT; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.fillText("D  Q", x + 22, wy + 10);
      ctx.strokeStyle = "#334155"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x + 14, wy + 22); ctx.lineTo(x + 22, wy + 14); ctx.lineTo(x + 30, wy + 22); ctx.stroke();
      return { cxClk: x + 22, right: x + 44, left: x };
    }
    function logicBlock(x0, x1, label, sub, tight, donate) {
      var y = wy, h = 34;
      ctx.beginPath(); ctx.moveTo(x0, y - h / 2); ctx.lineTo(x1 - 10, y - h / 2); ctx.lineTo(x1, y); ctx.lineTo(x1 - 10, y + h / 2); ctx.lineTo(x0, y + h / 2); ctx.closePath();
      ctx.fillStyle = tight ? "rgba(220,38,38,0.10)" : "rgba(21,128,61,0.08)"; ctx.strokeStyle = tight ? BAD : OK; ctx.lineWidth = 1.6; ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#1a1d26"; ctx.font = "700 10px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(label, (x0 + x1) / 2, y - 6);
      ctx.fillStyle = MUT; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.fillText(sub, (x0 + x1) / 2, y + 7);
      /* clickable "lend" affordance below the block */
      ctx.fillStyle = "#2563eb"; ctx.font = "700 8px 'JetBrains Mono', monospace"; ctx.textBaseline = "top"; ctx.fillText(donate, (x0 + x1) / 2, y + h / 2 + 6);
    }
    function wire(x0, x1) { ctx.strokeStyle = MET; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(x0, wy); ctx.lineTo(x1, wy); ctx.stroke(); }
    var GX0 = 250, GX1 = 452;
    function gaugeX(step) { return GX0 + (step - MINSTEP) / (MAXSTEP - MINSTEP) * (GX1 - GX0); }

    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx); hits = [];
      var f1 = ff(30, "FF1");
      logicBlock(A_L, A_R, "logic A", "t = " + TA.toFixed(1), true, "click: lend time to B →");
      wire(A_R, 300);
      var f2 = ff(300, "FF2", true);
      logicBlock(B_L, B_R, "logic B", "t = " + TB.toFixed(1), false, "← click: lend time to A");
      wire(B_R, 560);
      var f3 = ff(560, "FF3");
      hits.push([A_L, wy - 24, A_R, wy + 28, "A"]);
      hits.push([B_L, wy - 24, B_R, wy + 28, "B"]);
      /* clock trunk */
      ctx.strokeStyle = CLK; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(20, clkStripY); ctx.lineTo(W - 20, clkStripY); ctx.stroke();
      ctx.fillStyle = CLK; ctx.font = "700 8px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.fillText("clock", 20, clkStripY - 4);
      [f1.cxClk, f3.cxClk].forEach(function (cx) { ctx.strokeStyle = CLK; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(cx, clkStripY); ctx.lineTo(cx, wy + 22); ctx.stroke(); });
      /* FF2 clock branch: a signed skew gauge (advance <- 0 -> retard), read-only */
      ctx.fillStyle = "#5a606e"; ctx.font = "700 8px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.fillText("FF2 clock skew (set by the lending above)", GX0, clkStripY - 20);
      ctx.strokeStyle = "#c9c6bd"; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(GX0, clkStripY); ctx.lineTo(GX1, clkStripY); ctx.stroke(); ctx.lineCap = "butt";
      var zx = gaugeX(0);
      ctx.strokeStyle = "#9aa0aa"; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(zx, clkStripY - 12); ctx.lineTo(zx, clkStripY + 12); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = "#9aa0aa"; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText("0", zx, clkStripY + 6);
      ctx.textAlign = "left"; ctx.fillText("earlier (helps B)", GX0, clkStripY + 6);
      ctx.textAlign = "right"; ctx.fillText("later (helps A)", GX1, clkStripY + 6);
      /* colour the applied span from 0 to current */
      var mx = gaugeX(res.n), spanCol = res.skew >= 0 ? DLY : "#0e7490";
      ctx.strokeStyle = spanCol; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(zx, clkStripY); ctx.lineTo(mx, clkStripY); ctx.stroke(); ctx.lineCap = "butt";
      ctx.fillStyle = spanCol; ctx.beginPath(); ctx.arc(mx, clkStripY, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = spanCol; ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText((res.skew >= 0 ? "+" : "") + res.skew.toFixed(1), mx, clkStripY - 9);
      /* branch from gauge to FF2 clock pin */
      ctx.strokeStyle = CLK; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(GX1, clkStripY); ctx.lineTo(f2.cxClk, clkStripY); ctx.lineTo(f2.cxClk, wy + 22); ctx.stroke();
      /* slack seesaw bars */
      bar(210, "stage A setup slack  (into FF2)", res.slackA, res.aOK);
      bar(262, "stage B setup slack  (out of FF2)", res.slackB, res.bOK);
    }
    function bar(y, label, slack, ok) {
      var bx = 40, bw = W - 80, cx = bx + bw / 2, sc = bw / 2 / 1.0;
      ctx.fillStyle = "#5a606e"; ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.fillText(label, bx, y - 5);
      ctx.fillStyle = "#eceae2"; ctx.fillRect(bx, y, bw, 18); ctx.strokeStyle = "#c9c6bd"; ctx.lineWidth = 1; ctx.strokeRect(bx, y, bw, 18);
      ctx.strokeStyle = "#9aa0aa"; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(cx, y - 3); ctx.lineTo(cx, y + 21); ctx.stroke(); ctx.setLineDash([]);
      var w = Math.max(-bw / 2, Math.min(bw / 2, slack * sc));
      ctx.fillStyle = ok ? "rgba(21,128,61,0.55)" : "rgba(220,38,38,0.55)";
      if (w >= 0) ctx.fillRect(cx, y, w, 18); else ctx.fillRect(cx + w, y, -w, 18);
      ctx.fillStyle = ok ? OK : BAD; ctx.font = "700 10px 'JetBrains Mono', monospace"; ctx.textAlign = w >= 0 ? "left" : "right"; ctx.textBaseline = "middle";
      ctx.fillText((slack >= 0 ? "+" : "") + slack.toFixed(2), w >= 0 ? cx + w + 6 : cx + w - 6, y + 9);
      ctx.fillStyle = "#9aa0aa"; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText("0", cx, y + 20);
    }
    function computeScore(res) { var total = Math.round(Math.max(6000, Math.min(10000, 6000 + res.min * 40000))), best = total; try { var key = "mp-best-" + (spec.id || "eco-skew"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {} return { total: total, best: best }; }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "both stages meet setup" : (!res.aOK ? "stage A still fails" : "stage B now fails")) + '</div>';
      html += '<div class="mp-row ' + (res.aOK ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.aOK ? "✔" : "✗") + '</span><span class="mp-label">Stage A slack &ge; 0</span><span class="mp-detail">' + (res.slackA >= 0 ? "+" : "") + res.slackA.toFixed(2) + '</span></div>';
      html += '<div class="mp-row ' + (res.bOK ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.bOK ? "✔" : "✗") + '</span><span class="mp-label">Stage B slack &ge; 0</span><span class="mp-detail">' + (res.slackB >= 0 ? "+" : "") + res.slackB.toFixed(2) + '</span></div>';
      html += '<div class="mp-score"><span class="mp-score-note" style="font-size:11px">FF2 clock skew ' + (res.skew >= 0 ? "+" : "") + res.skew.toFixed(1) + ' (' + (res.skew > 0 ? "time lent from stage B to stage A" : res.skew < 0 ? "time lent from stage A to stage B" : "no skew applied yet") + ')</span></div>';
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div><div class="mp-flow-note">Slack moved from the loose stage to the tight one with no logic change, just the shared clock edge. Balancing the two slacks (equal margin on each side) leaves the most room against timing spread on both stages.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>Both stages pass.</b> Balanced slack scores higher. Click <b>Submit skew</b>.</div>';
      else if (!res.aOK) html += '<div class="mp-score"><span class="mp-score-note">Stage A is still short. Click <b>stage B</b> to lend more of its spare time to stage A.</span></div>';
      else html += '<div class="mp-score"><span class="mp-score-note">You lent too much: stage B is now negative. Click <b>stage A</b> to give some time back to stage B.</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, steps); draw(last); render(last); bSubmit.disabled = submitted || !last.pass; bSubmit.classList.toggle("mp-ready", !submitted && last.pass); }
    function tap(e) {
      if (submitted) return; var r = canvas.getBoundingClientRect(), t = e.touches ? e.touches[0] : e, px = t.clientX - r.left, py = t.clientY - r.top;
      for (var i = 0; i < hits.length; i++) { var h = hits[i]; if (px >= h[0] && px <= h[2] && py >= h[1] && py <= h[3]) {
        if (h[4] === "B") steps = Math.min(MAXSTEP, steps + 1);     // lend time from B to A: retard FF2 clock
        else if (h[4] === "A") steps = Math.max(MINSTEP, steps - 1); // lend time from A to B: advance FF2 clock
        scoreObj = null; refresh(); break;
      } }
      e.preventDefault();
    }
    canvas.addEventListener("mousedown", tap); canvas.addEventListener("touchstart", tap, { passive: false });
    bSubmit.addEventListener("click", function () { if (!submitted && last && last.pass) { submitted = true; scoreObj = computeScore(last); refresh(); } });
    bReset.addEventListener("click", function () { steps = 0; submitted = false; scoreObj = null; refresh(); });
    refresh();
  }

  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.EcoSkew = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
