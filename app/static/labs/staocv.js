/* STA: on-chip variation (OCV) and common-path pessimism removal (CPPR).
   A launch flip-flop feeds combinational logic into a capture flip-flop. OCV
   derates the LAUNCH clock path late (slow, x dLate) and the CAPTURE clock path
   early (fast, x dEarly) to be pessimistic. But both clocks travel a COMMON
   trunk of buffers before diverging; that shared trunk cannot be slow for launch
   and fast for capture at the same instant, so the derate difference on it is
   fake pessimism. CPPR credits it back: credit = (shared wire delay) x (dLate -
   dEarly). The learner clicks the shared trunk segments to identify the common
   path; branch segments are NOT shared and earn no credit.
   window.StaOcv = { evaluate, mount }. */
(function () {
  "use strict";
  function sums(spec) {
    var c = 0, l = 0, k = 0;
    spec.segs.forEach(function (s) { if (s.kind === "common") c += s.delay; else if (s.kind === "launch") l += s.delay; else k += s.delay; });
    return { c: c, l: l, k: k };
  }
  function evaluate(spec, shared) {
    var sm = sums(spec), spread = spec.dLate - spec.dEarly;
    var launchClk = (sm.c + sm.l) * spec.dLate, captureClk = (sm.c + sm.k) * spec.dEarly;
    var arrival = launchClk + spec.tcq + spec.dataDelay, required = spec.T + captureClk - spec.tsetup;
    var slackRaw = required - arrival;
    var creditDelay = 0, wrong = [], missing = [];
    spec.segs.forEach(function (s) {
      var sel = shared.indexOf(s.id) >= 0;
      if (s.kind === "common") { if (sel) creditDelay += s.delay; else missing.push(s.id); }
      else if (sel) wrong.push(s.id);
    });
    var credit = creditDelay * spread, slack = slackRaw + credit, fullCredit = sm.c * spread;
    var selectionCorrect = wrong.length === 0 && missing.length === 0;
    return { sm: sm, spread: spread, launchClk: launchClk, captureClk: captureClk, arrival: arrival, required: required,
      slackRaw: slackRaw, credit: credit, creditDelay: creditDelay, fullCredit: fullCredit, slack: slack,
      wrong: wrong, missing: missing, selectionCorrect: selectionCorrect,
      met: slack >= -1e-9, pass: selectionCorrect && slack >= -1e-9 };
  }
  function mount(container, spec) {
    var W = 640, Hpx = 372, dpr = window.devicePixelRatio || 1;
    var shared = [], scoreObj = null;
    var common = spec.segs.filter(function (s) { return s.kind === "common"; });

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas");
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "pointer"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "8px 0";
    hint.innerHTML = "Click the clock-tree segments that are <b>shared</b> by both flip-flops (the common trunk before the split). CPPR credits back the pessimism on exactly those wires. Branch segments after the split are not shared.";
    left.appendChild(hint);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit sign-off";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    /* ---- geometry ---- */
    var yClk = 244, xSrc = 34, xSplit = 250;
    var lff = { x: 150, y: 40, w: 46, h: 54 }, cff = { x: 452, y: 40, w: 46, h: 54 };
    var lffClk = { x: lff.x + 16, y: lff.y + lff.h }, cffClk = { x: cff.x + 16, y: cff.y + cff.h };
    var nC = common.length, trunkX = [];
    for (var i = 0; i <= nC; i++) trunkX.push(xSrc + 14 + (xSplit - xSrc - 14) * i / nC);
    /* map seg id -> screen segment + hitbox */
    var geo = {};
    common.forEach(function (s, idx) {
      var x1 = trunkX[idx], x2 = trunkX[idx + 1];
      geo[s.id] = { type: "trunk", x1: x1, x2: x2, y: yClk, mx: (x1 + x2) / 2, hit: [x1, yClk - 14, x2, yClk + 16] };
    });
    var lb = spec.segs.filter(function (s) { return s.kind === "launch"; })[0];
    var kb = spec.segs.filter(function (s) { return s.kind === "capture"; })[0];
    geo[lb.id] = { type: "branch", x1: xSplit, y1: yClk, x2: lffClk.x, y2: lffClk.y, mx: (xSplit + lffClk.x) / 2, my: (yClk + lffClk.y) / 2 };
    geo[lb.id].hit = [geo[lb.id].mx - 30, geo[lb.id].my - 16, geo[lb.id].mx + 30, geo[lb.id].my + 16];
    geo[kb.id] = { type: "branch", x1: xSplit, y1: yClk, x2: cffClk.x, y2: cffClk.y, mx: (xSplit + cffClk.x) / 2, my: (yClk + cffClk.y) / 2 };
    geo[kb.id].hit = [geo[kb.id].mx - 30, geo[kb.id].my - 16, geo[kb.id].mx + 30, geo[kb.id].my + 16];

    function isShared(id) { return shared.indexOf(id) >= 0; }
    function ff(box, label, submitted, ok) {
      ctx.fillStyle = "#eef1f7"; ctx.strokeStyle = "#334155"; ctx.lineWidth = 2; ctx.fillRect(box.x, box.y, box.w, box.h); ctx.strokeRect(box.x, box.y, box.w, box.h);
      /* clock triangle at bottom-left clock pin */
      var cx = box.x + 16, cy = box.y + box.h;
      ctx.strokeStyle = "#334155"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(cx - 7, cy); ctx.lineTo(cx, cy - 11); ctx.lineTo(cx + 7, cy); ctx.stroke();
      ctx.fillStyle = "#334155"; ctx.font = "bold 10px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText("D", box.x + 4, box.y + 16); ctx.textAlign = "right"; ctx.fillText("Q", box.x + box.w - 4, box.y + 16);
      ctx.fillStyle = "#1a1d26"; ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(label, box.x + box.w / 2, box.y - 13);
      ctx.fillStyle = "#6b7280"; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textBaseline = "bottom"; ctx.fillText("flip-flop", box.x + box.w / 2, box.y - 1);
    }
    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx);
      /* ---------- data path: LFF -> comb logic -> CFF ---------- */
      var dy = lff.y + 20;
      ctx.strokeStyle = "#8a90a0"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(lff.x + lff.w, dy); ctx.lineTo(lff.x + lff.w + 26, dy); ctx.stroke();
      /* comb cloud */
      var clx = lff.x + lff.w + 26, cw = cff.x - clx - 26, ccx = clx + cw / 2, ccy = dy;
      ctx.fillStyle = "#fff5e6"; ctx.strokeStyle = "#d97706"; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(ccx, ccy, cw / 2, 22, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#92400e"; ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("combinational", ccx, ccy - 6); ctx.fillText("logic  " + spec.dataDelay.toFixed(2) + " ns", ccx, ccy + 6);
      ctx.strokeStyle = "#8a90a0"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(clx + cw, dy); ctx.lineTo(cff.x, dy); ctx.stroke();
      ff(lff, "launch", false); ff(cff, "capture", false);

      /* ---------- clock source ---------- */
      ctx.fillStyle = "#2a5cc8"; ctx.beginPath(); ctx.moveTo(xSrc - 8, yClk - 9); ctx.lineTo(xSrc + 8, yClk); ctx.lineTo(xSrc - 8, yClk + 9); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#2a5cc8"; ctx.font = "700 8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText("clk", xSrc, yClk - 11);

      /* ---------- trunk (common) segments ---------- */
      common.forEach(function (s) {
        var g = geo[s.id], sel = isShared(s.id);
        if (sel) { ctx.strokeStyle = "rgba(21,128,61,0.85)"; ctx.lineWidth = 11; ctx.beginPath(); ctx.moveTo(g.x1, g.y); ctx.lineTo(g.x2, g.y); ctx.stroke(); }
        ctx.strokeStyle = "#2a5cc8"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(g.x1, g.y); ctx.lineTo(g.x2, g.y); ctx.stroke();
        /* buffer triangle at the right end (not at the split) */
        if (g.x2 < xSplit - 1) { ctx.fillStyle = "#2a5cc8"; ctx.beginPath(); ctx.moveTo(g.x2 - 6, g.y - 6); ctx.lineTo(g.x2 + 5, g.y); ctx.lineTo(g.x2 - 6, g.y + 6); ctx.closePath(); ctx.fill(); }
        ctx.fillStyle = sel ? "#15803d" : "#334155"; ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(s.delay.toFixed(2), g.mx, g.y + 6);
      });
      /* split node */
      ctx.fillStyle = "#1a1d26"; ctx.beginPath(); ctx.arc(xSplit, yClk, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#6b7280"; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText("split", xSplit, yClk + 6);

      /* ---------- branches (not shared) ---------- */
      [lb, kb].forEach(function (s, idx) {
        var g = geo[s.id], sel = isShared(s.id);
        if (sel) { ctx.strokeStyle = "rgba(220,38,38,0.85)"; ctx.lineWidth = 11; ctx.beginPath(); ctx.moveTo(g.x1, g.y1); ctx.lineTo(g.x2, g.y2); ctx.stroke(); }
        ctx.strokeStyle = "#7c8aa5"; ctx.setLineDash([5, 3]); ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(g.x1, g.y1); ctx.lineTo(g.x2, g.y2); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = sel ? "#dc2626" : "#5a606e"; ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(s.delay.toFixed(2), g.mx + (idx ? 14 : -14), g.my);
      });
      /* derate annotations */
      ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textAlign = "center";
      ctx.fillStyle = "#9f1239"; ctx.fillText("launch clk  x" + spec.dLate.toFixed(2) + " (late)", geo[lb.id].mx - 30, geo[lb.id].my - 24);
      ctx.fillStyle = "#1d4ed8"; ctx.fillText("capture clk  x" + spec.dEarly.toFixed(2) + " (early)", geo[kb.id].mx + 24, geo[kb.id].my - 24);
      ctx.fillStyle = "#6b7280"; ctx.textAlign = "left"; ctx.fillText("shared trunk: derated BOTH ways -> fake pessimism", xSrc, yClk + 22);

      /* ---------- credit math + slack bars ---------- */
      var my0 = 288;
      ctx.fillStyle = "#1a1d26"; ctx.font = "700 10px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText("CPPR credit = shared delay (" + res.creditDelay.toFixed(2) + ") x (" + spec.dLate.toFixed(2) + " - " + spec.dEarly.toFixed(2) + ") = +" + res.credit.toFixed(3) + " ns", xSrc, my0);
      /* two slack bars */
      var barX = xSrc, barW = W - xSrc - 20, zero = barX + barW * 0.52, scl = 520;
      function bar(yy, label, v, faded) {
        ctx.fillStyle = "#eceae2"; ctx.fillRect(barX, yy, barW, 18);
        ctx.strokeStyle = "#c9c6bd"; ctx.lineWidth = 1; ctx.strokeRect(barX, yy, barW, 18);
        ctx.strokeStyle = "#9aa0aa"; ctx.beginPath(); ctx.moveTo(zero, yy - 3); ctx.lineTo(zero, yy + 21); ctx.stroke();
        var s = Math.max(-barW * 0.5, Math.min(barW * 0.46, v * scl));
        ctx.fillStyle = v >= 0 ? (faded ? "rgba(21,128,61,0.35)" : "rgba(21,128,61,0.6)") : (faded ? "rgba(220,38,38,0.35)" : "rgba(220,38,38,0.6)");
        ctx.fillRect(v >= 0 ? zero : zero + s, yy + 3, Math.abs(s), 12);
        ctx.fillStyle = "#1a1d26"; ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(label, barX + 4, yy - 8);
        ctx.textAlign = "right"; ctx.fillStyle = v >= 0 ? "#15803d" : "#dc2626"; ctx.fillText((v >= 0 ? "+" : "") + v.toFixed(3), barX + barW - 4, yy - 8);
      }
      bar(316, "raw OCV slack (shared derate double-counted)", res.slackRaw, true);
      bar(348, "signed-off slack (after CPPR credit)", res.slack, false);
    }
    function computeScore() { var total = 10000, best = total; try { var key = "mp-best-" + (spec.id || "sta-ocv"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {} return { total: total, best: best }; }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "PASS" : "not yet") + '</div>';
      var selOK = res.selectionCorrect;
      html += '<div class="mp-row ' + (selOK ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (selOK ? "✔" : "✗") + '</span><span class="mp-label">Common path identified</span><span class="mp-detail">' + (common.length - res.missing.length) + " / " + common.length + '</span></div>';
      html += '<div class="mp-row ' + (res.met ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.met ? "✔" : "✗") + '</span><span class="mp-label">Signed-off slack &ge; 0</span><span class="mp-detail">' + (res.slack >= 0 ? "+" : "") + res.slack.toFixed(3) + '</span></div>';
      html += '<div class="mp-score"><span class="mp-score-note" style="font-size:11px">launch clk ' + res.launchClk.toFixed(3) + ' &middot; capture clk ' + res.captureClk.toFixed(3) + ' &middot; arrival ' + res.arrival.toFixed(3) + ' &middot; required ' + res.required.toFixed(3) + '</span></div>';
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div><div class="mp-flow-note">The whole shared trunk (' + res.fullCredit.toFixed(3) + ' ns of pessimism) credited back. The divergent branches stay derated - that skew is real.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>Common path fully credited, slack positive.</b> Click <b>Submit sign-off</b>.</div>';
      else if (res.wrong.length) html += '<div class="mp-score"><span class="mp-score-note">A red segment is a branch AFTER the split. It is not shared by both flip-flops, so its derate is real skew, not pessimism. CPPR cannot credit it. Unclick it.</span></div>';
      else if (res.missing.length) html += '<div class="mp-score"><span class="mp-score-note">Part of the shared trunk is still uncredited. Click every segment from the clock source up to the split so the full common-path pessimism is removed.</span></div>';
      else html += '<div class="mp-score"><span class="mp-score-note">' + (spec.hint || "") + '</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, shared); draw(last); render(last); bSubmit.disabled = !last.pass; bSubmit.classList.toggle("mp-ready", last.pass); }
    function tap(e) {
      var r0 = canvas.getBoundingClientRect(), px = (e.touches ? e.touches[0].clientX : e.clientX) - r0.left, py = (e.touches ? e.touches[0].clientY : e.clientY) - r0.top;
      for (var id in geo) { if (!geo.hasOwnProperty(id)) continue; var h = geo[id].hit; if (px >= h[0] && px <= h[2] && py >= h[1] && py <= h[3]) { var j = shared.indexOf(id); if (j >= 0) shared.splice(j, 1); else shared.push(id); scoreObj = null; refresh(); break; } }
      e.preventDefault();
    }
    canvas.addEventListener("mousedown", tap); canvas.addEventListener("touchstart", tap, { passive: false });
    bSubmit.addEventListener("click", function () { if (last && last.pass) { scoreObj = computeScore(); render(last); } });
    bReset.addEventListener("click", function () { shared = []; scoreObj = null; refresh(); });
    refresh();
  }
  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.StaOcv = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
