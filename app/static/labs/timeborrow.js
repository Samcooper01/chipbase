/* STA: time borrowing with transparent latches. Shown as a real circuit: a
   launch element, combinational-logic clouds, and a capture flip-flop, with
   clickable sequential elements in between. Each intermediate element is either
   an edge-triggered FLIP-FLOP (hard deadline at the clock edge: a stage slower
   than one period fails) or a level-sensitive LATCH (transparent for a fixed
   window W after the edge, so a slow stage can BORROW time past the edge, repaid
   by the next stage starting late). The clock is FIXED (its high phase = W). The
   task: click each element to pick flip-flop or latch so the chain closes with
   the FEWEST latches - latches enable borrowing but add hold risk, so use them
   only where a stage overruns its edge. window.StaBorrow = { evaluate, mount }. */
(function () {
  "use strict";
  function simulate(spec, choices) {
    var d = spec.delays, T = spec.T, W = spec.W, n = d.length, blocks = [], start = 0, pass = true, maxBorrow = 0;
    for (var i = 0; i < n; i++) {
      var fin = start + d[i], cycleEnd = (i + 1) * T, isFinal = i === n - 1;
      var isLatch = !isFinal && choices[i] === "latch";
      var deadline = isLatch ? cycleEnd + W : cycleEnd;
      var borrow = Math.max(0, fin - cycleEnd), ok = fin <= deadline + 1e-9;
      if (!ok) pass = false; if (isLatch && borrow > maxBorrow) maxBorrow = borrow;
      blocks.push({ name: spec.names[i], d: d[i], start: start, finish: fin, cycleEnd: cycleEnd, deadline: deadline, borrow: borrow, ok: ok, isLatch: isLatch, isFinal: isFinal });
      start = isLatch ? Math.max(cycleEnd, fin) : cycleEnd;
    }
    return { blocks: blocks, pass: pass, maxBorrow: maxBorrow };
  }
  function canonical(spec) {
    var d = spec.delays, T = spec.T, n = d.length, start = 0, c = [];
    for (var i = 0; i < n - 1; i++) { var fin = start + d[i], ce = (i + 1) * T; if (fin <= ce + 1e-9) { c.push("ff"); start = ce; } else { c.push("latch"); start = Math.max(ce, fin); } }
    return c;
  }
  function evaluate(spec, choices) {
    var sim = simulate(spec, choices), canon = canonical(spec);
    var status = canon.map(function (cc, i) { return choices[i] === cc ? "ok" : (choices[i] === "latch" ? "overlatch" : "underlatch"); });
    var minimal = status.every(function (s) { return s === "ok"; });
    return { blocks: sim.blocks, simPass: sim.pass, maxBorrow: sim.maxBorrow, canon: canon, status: status, pass: sim.pass && minimal, nLatch: choices.filter(function (c) { return c === "latch"; }).length };
  }
  function mount(container, spec) {
    var n = spec.delays.length, T = spec.T, W = spec.W, dpr = window.devicePixelRatio || 1;
    var choices = spec.delays.slice(0, n - 1).map(function () { return "ff"; }), submitted = false, scoreObj = null;
    var CW = 660, Hpx = 236, scale = 72, elemW = 44, elemH = 46, elemY = 46, wireY = elemY + 23;
    var elemX = [], gap = (CW - 16 - (n + 1) * elemW) / n, x = 8;
    for (var e = 0; e <= n; e++) { elemX.push(x); x += elemW + gap; }
    function cloudCx(i) { return (elemX[i] + elemW + elemX[i + 1]) / 2; }
    var PAL = ["#2a5cc8", "#0f9d8c", "#b45309", "#7c3aed", "#be185d"];

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas");
    canvas.width = CW * dpr; canvas.height = Hpx * dpr; canvas.style.width = CW + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "pointer"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "8px 0"; hint.style.maxWidth = CW + "px";
    hint.innerHTML = "Click a sequential element to switch it between <b>flip-flop</b> (hard clock edge) and <b>latch</b> (transparent for W after the edge, so the incoming stage can borrow time). Make the fewest latches that let every stage be captured. The endpoint is a fixed flip-flop.";
    left.appendChild(hint);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit design";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    var elemHit = [];
    function seqElem(k, res) {
      var x0 = elemX[k], isSrc = k === 0, isEnd = k === n;
      var chosenLatch = !isEnd && !isSrc && choices[k - 1] === "latch";
      var kind = chosenLatch ? "latch" : "ff"; // src drawn as ff-like source
      var clickable = !isSrc && !isEnd;
      var stat = clickable && submitted ? res.status[k - 1] : null;
      var frame = stat === "overlatch" || stat === "underlatch" ? "#dc2626" : (stat === "ok" ? "#15803d" : "#334155");
      ctx.fillStyle = chosenLatch ? "#eafaf6" : "#eef1f7"; ctx.strokeStyle = frame; ctx.lineWidth = clickable ? 2 : 1.6; ctx.fillRect(x0, elemY, elemW, elemH); ctx.strokeRect(x0, elemY, elemW, elemH);
      /* clock symbol */
      var cx = x0 + 12, cy = elemY + elemH;
      if (kind === "ff") { ctx.strokeStyle = "#334155"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(cx - 6, cy); ctx.lineTo(cx, cy - 10); ctx.lineTo(cx + 6, cy); ctx.stroke(); }
      else { ctx.strokeStyle = "#0f9d8c"; ctx.lineWidth = 1.6; ctx.strokeRect(cx - 6, cy - 7, 12, 7); }
      ctx.fillStyle = "#334155"; ctx.font = "bold 9px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; if (!isSrc) ctx.fillText("D", x0 + 3, wireY); ctx.textAlign = "right"; if (!isEnd) ctx.fillText("Q", x0 + elemW - 3, wireY);
      ctx.fillStyle = "#1a1d26"; ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText(isSrc ? "launch" : (isEnd ? "capture" : ("reg " + k)), x0 + elemW / 2, elemY - 13);
      ctx.fillStyle = chosenLatch ? "#0f7a6c" : "#6b7280"; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.fillText(isEnd ? "flip-flop (fixed)" : (isSrc ? "flip-flop" : (chosenLatch ? "latch" : "flip-flop")), x0 + elemW / 2, elemY - 2);
      if (clickable) { ctx.strokeStyle = "#b9c0cc"; ctx.setLineDash([2, 2]); ctx.lineWidth = 1; ctx.strokeRect(x0 - 3, elemY - 3, elemW + 6, elemH + 6); ctx.setLineDash([]); elemHit.push([x0 - 6, elemY - 14, x0 + elemW + 6, elemY + elemH + 4, k - 1]); }
    }
    function logicCloud(i) {
      var xl = elemX[i] + elemW, xr = elemX[i + 1], cxm = (xl + xr) / 2, cym = wireY, w = Math.min(56, xr - xl - 14), h = 26, col = PAL[i % PAL.length];
      ctx.beginPath(); ctx.moveTo(cxm - w / 2, cym - h / 2); ctx.lineTo(cxm + w / 2 - 7, cym - h / 2); ctx.lineTo(cxm + w / 2, cym); ctx.lineTo(cxm + w / 2 - 7, cym + h / 2); ctx.lineTo(cxm - w / 2, cym + h / 2); ctx.lineTo(cxm - w / 2 + 7, cym); ctx.closePath();
      ctx.fillStyle = "#fff5e6"; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.fillStyle = "#92400e"; ctx.font = "700 8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(spec.delays[i].toFixed(2), cxm, cym);
    }
    var gaugeY = 150, gaugeH = 22;
    function gauge(i, b) {
      var cx = cloudCx(i), gx0 = cx - T * scale / 2, col = PAL[i % PAL.length];
      var cycleStart = i * T, inRel = b.start - cycleStart, finRel = b.finish - cycleStart, dlRel = b.deadline - cycleStart;
      var showW = b.isLatch ? W : 0, edgeX = gx0 + T * scale;
      ctx.strokeStyle = "#d4d0c4"; ctx.lineWidth = 1; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(cx, elemY + elemH + 3); ctx.lineTo(cx, gaugeY - 11); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = "#ecebe4"; ctx.fillRect(gx0, gaugeY, T * scale, gaugeH); ctx.strokeStyle = "#c9c6bd"; ctx.lineWidth = 1; ctx.strokeRect(gx0, gaugeY, T * scale, gaugeH);
      if (showW > 0) { ctx.fillStyle = "rgba(15,157,140,0.20)"; ctx.fillRect(edgeX, gaugeY, showW * scale, gaugeH); ctx.strokeStyle = "#0f9d8c"; ctx.strokeRect(edgeX, gaugeY, showW * scale, gaugeH); }
      var bx = gx0 + inRel * scale, bw = (finRel - inRel) * scale, dlX = gx0 + dlRel * scale;
      ctx.fillStyle = col; ctx.fillRect(bx, gaugeY + 3, bw, gaugeH - 6);
      if (bx + bw > dlX + 0.5) { ctx.fillStyle = "rgba(220,38,38,0.65)"; ctx.fillRect(Math.max(bx, dlX), gaugeY + 3, bx + bw - Math.max(bx, dlX), gaugeH - 6); }
      ctx.strokeStyle = "#c23c32"; ctx.lineWidth = 1.6; ctx.setLineDash([3, 2]); ctx.beginPath(); ctx.moveTo(edgeX, gaugeY - 4); ctx.lineTo(edgeX, gaugeY + gaugeH + 4); ctx.stroke(); ctx.setLineDash([]);
      if (inRel > 1e-9) { ctx.fillStyle = "#b45309"; ctx.font = "7px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText("starts +" + inRel.toFixed(2), Math.max(bx, gx0 + 12), gaugeY - 1); }
      ctx.fillStyle = "#1a1d26"; ctx.font = "700 8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText("stage " + b.name, cx, gaugeY - 11);
      var msg = !b.ok ? "overruns edge!" : (b.borrow > 1e-9 ? "borrows " + b.borrow.toFixed(2) : (b.isFinal ? "caught by edge" : "fits, no borrow"));
      ctx.fillStyle = b.ok ? "#0f7a6c" : "#dc2626"; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(msg, cx, gaugeY + gaugeH + 4);
    }
    function draw(res) {
      ctx.clearRect(0, 0, CW, Hpx); elemHit = [];
      ctx.strokeStyle = "#8a90a0"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(elemX[0] + elemW, wireY); ctx.lineTo(elemX[n], wireY); ctx.stroke();
      for (var i = 0; i < n; i++) logicCloud(i);
      for (var s = 0; s <= n; s++) seqElem(s, res);
      res.blocks.forEach(function (b, i) { gauge(i, b); });
      var ly = Hpx - 18;
      ctx.fillStyle = "#ecebe4"; ctx.fillRect(10, ly, 20, 10); ctx.fillStyle = "#5a606e"; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("one clock cycle", 34, ly + 5);
      ctx.fillStyle = "rgba(15,157,140,0.4)"; ctx.fillRect(140, ly, 16, 10); ctx.fillStyle = "#0f7a6c"; ctx.fillText("latch open (W=" + W.toFixed(2) + ")", 160, ly + 5);
      ctx.fillStyle = "#c23c32"; ctx.fillText("| clock edge", 300, ly + 5);
      ctx.fillStyle = "#dc2626"; ctx.fillRect(384, ly, 16, 10); ctx.fillStyle = "#dc2626"; ctx.fillText("missed capture", 404, ly + 5);
    }
    function computeScore() { var total = 10000, best = total; try { var key = "mp-best-" + (spec.id || "sta-borrow"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {} return { total: total, best: best }; }
    function render(res) {
      var nFail = res.blocks.filter(function (b) { return !b.ok; }).length;
      var html;
      if (!submitted) {
        var ready = res.pass;
        html = '<div class="mp-verdict" style="background:' + (ready ? "#efe7fb" : "#eceae2") + ';color:' + (ready ? "#6b30c9" : "#5a606e") + '">' + (ready ? "ready to submit" : "build the pipeline") + '</div>';
        var note;
        if (!res.simPass) note = "A red stage overruns its clock edge. Make the boundary right after a slow stage a <b>latch</b> so the overrun can borrow into the next stage.";
        else if (!res.pass) note = "Every stage is captured, but you used more latches than needed. A latch where the stage already fits by the edge adds needless hold risk - switch that one back to a <b>flip-flop</b>.";
        else note = "Every stage is captured with the fewest latches. Click <b>Submit design</b>.";
        html += '<div class="mp-score"><span class="mp-score-note">' + note + '</span></div>';
        html += '<div class="mp-score"><span class="mp-score-note" style="font-size:11px">' + (res.blocks.length - nFail) + " / " + res.blocks.length + ' stages captured &middot; ' + res.nLatch + ' latch(es) used &middot; avg stage ' + spec.avg.toFixed(2) + ' ns (period ' + T.toFixed(2) + ')</span></div>';
      } else {
        html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "PASS" : "not yet") + '</div>';
        res.canon.forEach(function (cc, i) {
          var st = res.status[i], good = st === "ok";
          var msg = good ? (cc === "latch" ? "latch - needed, this stage borrows" : "flip-flop - fine, stage fits its edge") : (st === "underlatch" ? "should be a LATCH: this stage overruns its edge and must borrow" : "over-latched: a flip-flop works here; a needless latch adds hold risk");
          html += '<div class="mp-row ' + (good ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (good ? "✔" : "✗") + '</span><span class="mp-label">reg ' + (i + 1) + '</span></div>';
          html += '<div class="mp-score"><span class="mp-score-note" style="font-size:11px">' + msg + '</span></div>';
        });
        if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div><div class="mp-flow-note">Only the boundaries after a slow stage need to be latches, so the overrun can borrow into the next stage; the fast stage stays a flip-flop. Flip-flops everywhere would fail the slow stages even though the average delay fits the period.</div></div>';
        else if (!res.simPass) html += '<div class="mp-score"><span class="mp-score-note">A red stage overruns its capture edge. A flip-flop there gives a hard deadline it cannot meet - make that boundary a latch so the stage can borrow into the next cycle.</span></div>';
        else html += '<div class="mp-score"><span class="mp-score-note">The chain closes, but you used more latches than needed. A latch where the stage already fits by the edge adds hold/min-delay risk for no benefit - switch it back to a flip-flop.</span></div>';
      }
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, choices); draw(last); render(last); bSubmit.disabled = submitted || !last.pass; bSubmit.classList.toggle("mp-ready", !submitted && last.pass); }
    function tap(e) { var r0 = canvas.getBoundingClientRect(), px = (e.touches ? e.touches[0].clientX : e.clientX) - r0.left, py = (e.touches ? e.touches[0].clientY : e.clientY) - r0.top; for (var i = 0; i < elemHit.length; i++) { var h = elemHit[i]; if (px >= h[0] && px <= h[2] && py >= h[1] && py <= h[3]) { choices[h[4]] = choices[h[4]] === "latch" ? "ff" : "latch"; submitted = false; scoreObj = null; refresh(); break; } } e.preventDefault(); }
    canvas.addEventListener("mousedown", tap); canvas.addEventListener("touchstart", tap, { passive: false });
    bSubmit.addEventListener("click", function () { if (!submitted) { submitted = true; if (evaluate(spec, choices).pass) scoreObj = computeScore(); refresh(); } });
    bReset.addEventListener("click", function () { choices = spec.delays.slice(0, n - 1).map(function () { return "ff"; }); submitted = false; scoreObj = null; refresh(); });
    refresh();
  }
  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.StaBorrow = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
