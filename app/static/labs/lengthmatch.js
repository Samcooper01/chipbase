/* Bus length-matching lab. A bus leaves a common driver on the left; each bit is
   a wire whose base length differs. Click a bit to fold in a serpentine detour
   that lengthens it. Bring every bit within the skew tolerance of the longest
   bit (the dashed line / green band) by lengthening the short bits, adding the
   least extra wire. window.LengthMatch = { evaluate, mount }. */
(function () {
  "use strict";
  function evaluate(spec, det) {
    var L = spec.bits.map(function (b, i) { return b.base + det[i] * spec.step; });
    var mx = Math.max.apply(null, L), mn = Math.min.apply(null, L);
    var added = det.reduce(function (s, x) { return s + x; }, 0) * spec.step;
    return { lengths: L, skew: mx - mn, maxL: mx, minL: mn, added: added, pass: (mx - mn) <= spec.tol + 1e-9 };
  }
  function mount(container, spec) {
    var PAD = 22, rowH = 50, gap = 12, W = 660, driverW = 58;
    var Hpx = PAD * 2 + spec.bits.length * (rowH + gap);
    var det = spec.bits.map(function () { return 0; }), scoreObj = null;
    var maxLen = Math.max.apply(null, spec.bits.map(function (b) { return b.base; })) + spec.maxDetour * spec.step;
    var x0 = PAD + driverW + 14, sc = (W - x0 - PAD - 92) / maxLen;

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas"); var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "pointer"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "8px 0"; hint.style.lineHeight = "1.5";
    hint.innerHTML = "This is a source-synchronous bus (e.g. a DDR byte lane) whose bits are sampled together, so their lengths must match. The bus leaves the driver on the left and each bit ends at a receiver on the right. Click a bit to add a serpentine detour; get every bit's end into the green band (within the tolerance of the longest bit).";
    left.appendChild(hint);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit design";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    function rowY(i) { return PAD + i * (rowH + gap); }
    var rows = [];
    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx);
      var tgtX = x0 + res.maxL * sc, tolX = x0 + (res.maxL - spec.tol) * sc;
      var yTop = rowY(0) + 6, yBot = rowY(spec.bits.length - 1) + rowH - 6;
      /* tolerance band + longest-bit line */
      ctx.fillStyle = "rgba(21,128,61,0.12)"; ctx.fillRect(tolX, yTop - 4, tgtX - tolX, yBot - yTop + 8);
      ctx.strokeStyle = "#15803d"; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(tgtX, yTop - 8); ctx.lineTo(tgtX, yBot + 8); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = "#15803d"; ctx.font = "700 10px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText("longest bit", tgtX, yTop - 10);
      /* bus driver block on the left */
      ctx.fillStyle = "#3b414d"; ctx.fillRect(PAD, yTop - 4, driverW, yBot - yTop + 8);
      ctx.fillStyle = "#fff"; ctx.font = "700 11px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.save(); ctx.translate(PAD + driverW / 2, (yTop + yBot) / 2); ctx.rotate(-Math.PI / 2); ctx.fillText("BUS DRIVER", 0, 0); ctx.restore();
      /* each bit */
      spec.bits.forEach(function (b, i) {
        var y = rowY(i) + rowH / 2, within = res.lengths[i] >= res.maxL - spec.tol - 1e-9;
        var baseEnd = x0 + b.base * sc, detLen = det[i] * spec.step * sc, endX = baseEnd + detLen;
        var col = within ? "#15803d" : "#dc2626";
        /* label */
        ctx.fillStyle = "#1a1d26"; ctx.font = "bold 11px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(b.id, PAD + driverW + 2, y - rowH / 2 + 10);
        /* base wire */
        ctx.strokeStyle = "#2f6fed"; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(baseEnd, y); ctx.stroke();
        /* serpentine detour */
        if (detLen > 4) {
          /* rectangular meander (square wave), the real serpentine shape: only
             right-angle segments, folded above and below the baseline */
          ctx.strokeStyle = "#d97706"; ctx.lineWidth = 3.5; ctx.lineJoin = "miter"; ctx.lineCap = "butt"; ctx.beginPath();
          var amp = rowH * 0.30, teeth = Math.max(2, det[i] * 2), sw = detLen / teeth;
          var yhi = y - amp, ylo = y + amp, level = yhi, cxp = baseEnd;
          ctx.moveTo(baseEnd, y); ctx.lineTo(baseEnd, level);          /* rise to first level */
          for (var s = 0; s < teeth; s++) {
            var nx = baseEnd + (s + 1) * sw;
            ctx.lineTo(nx, level);                                     /* horizontal run */
            if (s < teeth - 1) { level = (level === yhi) ? ylo : yhi; ctx.lineTo(nx, level); }  /* vertical step */
          }
          ctx.lineTo(endX, y);                                        /* drop back to the baseline at the receiver */
          ctx.stroke();
        }
        /* receiver dot + length */
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(endX, y, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = col; ctx.font = "700 11px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(res.lengths[i].toFixed(0), endX + 9, y);
        rows.push([PAD, rowY(i), W - PAD, rowY(i) + rowH, i]);
      });
    }
    function computeScore(res) {
      var eff = Math.max(0, 1 - res.added / (spec.bits.length * spec.maxDetour * spec.step));
      var total = Math.round(4000 + 6000 * eff), best = total;
      try { var key = "mp-best-" + (spec.id || "route-length"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {}
      return { total: total, best: best };
    }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "PASS" : "not yet") + '</div>';
      html += '<div class="mp-row ' + (res.pass ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.pass ? "✔" : "✗") + '</span><span class="mp-label">Skew within tolerance</span><span class="mp-detail">' + res.skew.toFixed(0) + " / " + spec.tol + '</span></div>';
      html += '<div class="mp-score"><span class="mp-score-note" style="font-size:11px">added wire: <b>' + res.added + '</b></span></div>';
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div>' + (scoreObj.best > scoreObj.total ? '<div class="mp-score-line">your best: ' + scoreObj.best + '</div>' : '') + '<div class="mp-flow-note">Matched. Less added wire scores higher.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>All bits matched within tolerance.</b> Click <b>Submit design</b> to score it.</div>';
      else html += '<div class="mp-score"><span class="mp-score-note">' + (spec.hint || "") + '</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { rows = []; last = evaluate(spec, det); draw(last); render(last); bSubmit.disabled = !last.pass; bSubmit.classList.toggle("mp-ready", last.pass); }
    function tap(e) {
      var r0 = canvas.getBoundingClientRect(), px = (e.touches ? e.touches[0].clientX : e.clientX) - r0.left, py = (e.touches ? e.touches[0].clientY : e.clientY) - r0.top;
      for (var i = 0; i < rows.length; i++) { var r = rows[i]; if (px >= r[0] && px <= r[2] && py >= r[1] && py <= r[3]) { det[r[4]] = (det[r[4]] + 1) % (spec.maxDetour + 1); scoreObj = null; refresh(); break; } }
      e.preventDefault();
    }
    canvas.addEventListener("mousedown", tap); canvas.addEventListener("touchstart", tap, { passive: false });
    bSubmit.addEventListener("click", function () { if (last && last.pass) { scoreObj = computeScore(last); render(last); } });
    bReset.addEventListener("click", function () { det = spec.bits.map(function () { return 0; }); scoreObj = null; refresh(); });
    refresh();
  }
  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.LengthMatch = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
