/* Antenna-rule fixing lab, shown physically. Each net's antenna is the metal
   connected to its gate, drawn as a bar on the layer it runs on; the faint lines
   above it are the higher layers. It violates when the metal is longer than the
   limit (past the dashed line). Two fixes:
     - Layer jump: carry the far part of the metal up to the NEXT layer, leaving
       only a short stub on the gate's layer. Needs a layer above, so a net
       already on the top layer cannot jump.
     - Diode: a small device at the gate that drains the charge. Always works but
       costs area.
   Jumps use limited upper-layer slots; diodes cost area. Fix every net.
   window.Antenna = { evaluate, mount }. */
(function () {
  "use strict";
  function evaluate(spec, fix) {
    var top = spec.layers.length - 1, unfixed = [], jumps = 0, area = 0;
    spec.nets.forEach(function (n, i) {
      var viol = n.length > spec.lengthLimit + 1e-9, jumpOK = n.layer < top, fixed = false;
      if (fix[i] === 1) { fixed = true; area += n.diodeArea; }
      if (fix[i] === 2 && jumpOK) { fixed = true; jumps++; }
      if (viol && !fixed) unfixed.push(n.id);
    });
    return { unfixed: unfixed, jumps: jumps, area: area, top: top,
      fixedOK: unfixed.length === 0, jumpOK: jumps <= spec.jumpBudget, areaOK: area <= spec.areaBudget,
      pass: unfixed.length === 0 && jumps <= spec.jumpBudget && area <= spec.areaBudget };
  }
  function mount(container, spec) {
    var PAD = 18, laneH = 66, gap = 6, W = 500, top = spec.layers.length - 1;
    var Hpx = PAD * 2 + spec.nets.length * (laneH + gap);
    var metalX0 = PAD + 78, sc = (W - metalX0 - PAD - 96) / Math.max.apply(null, spec.nets.map(function (n) { return n.length; }));
    var limitX = metalX0 + spec.lengthLimit * sc;
    var fix = spec.nets.map(function () { return 0; }), scoreObj = null;

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas"); var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "pointer"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "8px 0"; hint.style.lineHeight = "1.5";
    hint.innerHTML = "Click a net to cycle its fix. The bar is the metal on its layer; faint lines above are higher layers. A <b>jump</b> lifts the far metal to the next layer up (needs room above), a <b>diode</b> drains it at the gate (costs area). A net on the top layer has no room to jump.";
    left.appendChild(hint);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit design";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    var lanes = [];
    function laneTop(i) { return PAD + i * (laneH + gap); }
    function layerY(i, L) { return laneTop(i) + 14 + (top - L) * 15; }   // top layer highest in the lane
    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx);
      lanes = [];
      spec.nets.forEach(function (n, i) {
        var lt = laneTop(i), viol = n.length > spec.lengthLimit + 1e-9, jumpOK = n.layer < top, f = fix[i];
        var fixedByJump = f === 2 && jumpOK, fixedByDiode = f === 1;
        /* layer guide lines (faint), labelled at the left */
        for (var L = 0; L <= top; L++) {
          var gy = layerY(i, L);
          ctx.strokeStyle = "rgba(120,125,135,0.22)"; ctx.setLineDash([2, 3]); ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(metalX0, gy); ctx.lineTo(W - PAD, gy); ctx.stroke(); ctx.setLineDash([]);
          ctx.fillStyle = "#9aa0aa"; ctx.font = "7px 'JetBrains Mono', monospace"; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(spec.layers[L], metalX0 - 4, gy);
        }
        /* limit line */
        ctx.strokeStyle = "rgba(220,38,38,0.5)"; ctx.setLineDash([3, 3]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(limitX, lt + 6); ctx.lineTo(limitX, lt + laneH - 6); ctx.stroke(); ctx.setLineDash([]);
        /* gate box + net id */
        var gy0 = layerY(i, 0);
        ctx.fillStyle = "#3b414d"; ctx.fillRect(PAD + 8, gy0 - 7, 20, 14); ctx.fillStyle = "#fff"; ctx.font = "700 8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(n.id, PAD + 18, gy0);
        /* connector from gate up to the metal's layer */
        var my = layerY(i, n.layer);
        ctx.strokeStyle = "#5a606e"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(PAD + 28, gy0); ctx.lineTo(metalX0, gy0); ctx.moveTo(metalX0, gy0); ctx.lineTo(metalX0, my); ctx.stroke();
        var endX = metalX0 + n.length * sc;
        if (fixedByDiode) {
          /* whole metal fine; diode device at the gate */
          ctx.strokeStyle = "#15803d"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(metalX0, my); ctx.lineTo(endX, my); ctx.stroke();
          ctx.fillStyle = "#d97706"; ctx.beginPath(); ctx.moveTo(PAD + 30, gy0 + 10); ctx.lineTo(PAD + 40, gy0 + 10); ctx.lineTo(PAD + 35, gy0 + 2); ctx.closePath(); ctx.fill();
          ctx.fillStyle = "#7c3a06"; ctx.font = "700 8px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("diode +" + n.diodeArea, endX + 6, my);
        } else if (fixedByJump) {
          /* short stub on this layer, far metal jumped up one layer */
          var upY = layerY(i, n.layer + 1);
          ctx.strokeStyle = "#15803d"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(metalX0, my); ctx.lineTo(limitX, my); ctx.stroke();
          ctx.strokeStyle = "#2563eb"; ctx.beginPath(); ctx.moveTo(limitX, upY); ctx.lineTo(endX, upY); ctx.stroke();
          ctx.strokeStyle = "#ea580c"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(limitX, my); ctx.lineTo(limitX, upY); ctx.stroke();
          ctx.fillStyle = "#ea580c"; ctx.beginPath(); ctx.arc(limitX, (my + upY) / 2, 3.5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#1d4ed8"; ctx.font = "700 8px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("jump ↑ " + spec.layers[n.layer + 1], endX + 6, upY);
        } else {
          /* unfixed metal on its layer */
          ctx.strokeStyle = viol ? "#dc2626" : "#15803d"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(metalX0, my); ctx.lineTo(endX, my); ctx.stroke();
          if (viol && !jumpOK) { ctx.fillStyle = "#dc2626"; ctx.font = "700 8px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("top layer: diode only", endX + 6, my); }
          else if (viol) { ctx.fillStyle = "#dc2626"; ctx.font = "700 8px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("too long", endX + 6, my); }
        }
        lanes.push([PAD, lt, W - PAD, lt + laneH, i]);
      });
    }
    function computeScore(res) {
      var eff = Math.max(0, Math.min(1, (spec.areaBudget - res.area) / spec.areaBudget + 0.15));
      var total = Math.round(5000 + 5000 * eff), best = total;
      try { var key = "mp-best-" + (spec.id || "route-antenna"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {}
      return { total: total, best: best };
    }
    function rowc(l, ok, d) { return '<div class="mp-row ' + (ok ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (ok ? "✔" : "✗") + '</span><span class="mp-label">' + l + '</span><span class="mp-detail">' + d + '</span></div>'; }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "PASS" : "not yet") + '</div>';
      html += rowc("Every antenna fixed", res.fixedOK, res.fixedOK ? "all clear" : res.unfixed.length + " over limit");
      html += rowc("Layer jumps within slots", res.jumpOK, res.jumps + " / " + spec.jumpBudget);
      html += rowc("Diode area within budget", res.areaOK, res.area + " / " + spec.areaBudget);
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div>' + (scoreObj.best > scoreObj.total ? '<div class="mp-score-line">your best: ' + scoreObj.best + '</div>' : '') + '<div class="mp-flow-note">Fixed. Jump the lower-layer nets whose diode would cost most; the top-layer ones must diode.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>Every antenna fixed within budget.</b> Click <b>Submit design</b> to score it.</div>';
      else html += '<div class="mp-score"><span class="mp-score-note">' + (spec.hint || "") + '</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, fix); draw(last); render(last); bSubmit.disabled = !last.pass; bSubmit.classList.toggle("mp-ready", last.pass); }
    function tap(e) {
      var r0 = canvas.getBoundingClientRect(), px = (e.touches ? e.touches[0].clientX : e.clientX) - r0.left, py = (e.touches ? e.touches[0].clientY : e.clientY) - r0.top;
      for (var i = 0; i < lanes.length; i++) { var L = lanes[i]; if (px >= L[0] && px <= L[2] && py >= L[1] && py <= L[3]) {
        var n = spec.nets[L[4]], jumpOK = n.layer < top;
        fix[L[4]] = jumpOK ? (fix[L[4]] + 1) % 3 : (fix[L[4]] === 1 ? 0 : 1);   // top-layer nets: only none/diode
        scoreObj = null; refresh(); break;
      } }
      e.preventDefault();
    }
    canvas.addEventListener("mousedown", tap); canvas.addEventListener("touchstart", tap, { passive: false });
    bSubmit.addEventListener("click", function () { if (last && last.pass) { scoreObj = computeScore(last); render(last); } });
    bReset.addEventListener("click", function () { fix = spec.nets.map(function () { return 0; }); scoreObj = null; refresh(); });
    refresh();
  }
  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.Antenna = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
