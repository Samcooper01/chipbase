/* ECO lab: eco-drv (electrical design-rule violation ECO).
   A net that fans out to many sinks violates the electrical design rules: too many
   loads for one driver (max fanout), too much capacitance on the net (max
   capacitance), and, because the driver cannot charge that load quickly, too slow a
   slew (max transition). These are not slack violations, they are electrical limits
   every net must meet regardless of timing. The fix is to reduce the load each
   driver sees by inserting buffers that partition the fanout. But the driver that
   feeds the buffers now sees them as its own load, so over-buffering makes that top
   driver violate in turn: the buffering has to be balanced, and a very wide net
   needs a tree. The learner inserts the fewest buffers that clear all three rules at
   every driver. window.EcoDrv = { evaluate, mount }. */
(function () {
  "use strict";
  var N = 12, FMAX = 5, CMAX = 4, T0 = 0.05, TK = 0.1, TMAX = 0.45, NSLOT = 6;
  function sizes(n, b) { var base = (n / b) | 0, rem = n % b, a = []; for (var i = 0; i < b; i++) a.push(base + (i < rem ? 1 : 0)); return a; }
  function analyze(B) {
    var drivers = [];
    if (B === 0) drivers.push({ name: "driver", fanout: N, load: N });
    else { drivers.push({ name: "driver", fanout: B, load: B }); sizes(N, B).forEach(function (s, i) { drivers.push({ name: "buf " + (i + 1), fanout: s, load: s }); }); }
    var pass = true, nBad = 0;
    drivers.forEach(function (d) {
      d.cap = d.load; d.slew = T0 + TK * d.load;
      d.fOK = d.fanout <= FMAX; d.cOK = d.cap <= CMAX; d.sOK = d.slew <= TMAX + 1e-9;
      d.ok = d.fOK && d.cOK && d.sOK; if (!d.ok) { pass = false; nBad++; }
    });
    return { B: B, drivers: drivers, pass: pass, nBad: nBad };
  }
  function evaluate(spec, filled) { var n = 0; for (var i = 0; i < filled.length; i++) if (filled[i]) n++; return analyze(n); }

  function mount(container, spec) {
    var W = 640, Hpx = 360, dpr = window.devicePixelRatio || 1;
    var filled = []; for (var i = 0; i < NSLOT; i++) filled.push(false);
    var submitted = false, scoreObj = null;
    var drvX = 66, drvY = 184, slotX = 300, sinkX = 590;
    function sinkY(i) { return 34 + i * ((330 - 34) / (N - 1)); }
    function slotY(k) { return 44 + k * ((320 - 44) / (NSLOT - 1)); }

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas");
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "pointer"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "8px 0"; hint.style.maxWidth = W + "px";
    hint.innerHTML = "One driver fans out to " + N + " sinks and breaks the electrical rules: <b>max fanout</b> (&le; " + FMAX + " loads), <b>max capacitance</b> (&le; " + CMAX + " units), and <b>max transition</b> (slew &le; " + TMAX.toFixed(2) + "). These are limits every net must meet, timing aside. <b>Click a buffer slot</b> to split the net: each buffer re-drives a share of the sinks, cutting the load per driver. But the driver now feeds the buffers, so <b>too many</b> buffers makes it violate in turn. Clear all three rules at <b>every</b> driver with the fewest buffers, then <b>Submit fix</b>.";
    left.appendChild(hint);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit fix";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    var MET = "#3b82f6", BUF = "#2563eb", OK = "#15803d", BAD = "#dc2626", MUT = "#6b7280";
    var PAL = ["#0d9488", "#7c3aed", "#b45309", "#2563eb", "#be185d", "#4d7c0f"];
    var hits = [];
    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx); hits = [];
      var B = res.B, active = [];
      for (var k = 0; k < NSLOT; k++) if (filled[k]) active.push(k);
      /* sinks */
      var sz = B > 0 ? sizes(N, B) : [N], grpOf = [], gi = 0, left2 = sz[0];
      for (var s = 0; s < N; s++) { grpOf.push(gi); if (--left2 === 0 && gi < sz.length - 1) { gi++; left2 = sz[gi]; } }
      /* wires */
      if (B === 0) {
        for (var s2 = 0; s2 < N; s2++) { ctx.strokeStyle = "rgba(220,38,38,0.5)"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(drvX + 22, drvY); ctx.lineTo(sinkX - 8, sinkY(s2)); ctx.stroke(); }
      } else {
        active.forEach(function (slot, j) {
          var by = slotY(slot), col = PAL[j % PAL.length];
          ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(drvX + 22, drvY); ctx.lineTo(slotX - 12, by); ctx.stroke();
          for (var s3 = 0; s3 < N; s3++) if (grpOf[s3] === j) { ctx.strokeStyle = col; ctx.globalAlpha = 0.55; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(slotX + 12, by); ctx.lineTo(sinkX - 8, sinkY(s3)); ctx.stroke(); ctx.globalAlpha = 1; }
        });
      }
      /* sink dots */
      for (var s4 = 0; s4 < N; s4++) { var col4 = B === 0 ? "#c9c6bd" : PAL[grpOf[s4] % PAL.length]; ctx.fillStyle = col4; ctx.beginPath(); ctx.arc(sinkX, sinkY(s4), 4, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = MUT; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(N + " sinks", sinkX + 16, sinkY(N - 1) + 18);
      /* driver */
      var dvOK = res.drivers[0].ok;
      ctx.fillStyle = "#eef1f7"; ctx.strokeStyle = dvOK ? "#334155" : BAD; ctx.lineWidth = dvOK ? 1.6 : 2.4; ctx.fillRect(drvX - 22, drvY - 18, 44, 36); ctx.strokeRect(drvX - 22, drvY - 18, 44, 36);
      ctx.fillStyle = "#1a1d26"; ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("drv", drvX, drvY - 3);
      ctx.font = "7px 'JetBrains Mono', monospace"; ctx.fillStyle = dvOK ? "#2d6a4f" : BAD; ctx.fillText("f" + res.drivers[0].fanout + " c" + res.drivers[0].cap, drvX, drvY + 8);
      /* buffer slots */
      for (var k2 = 0; k2 < NSLOT; k2++) {
        var y = slotY(k2), on = filled[k2];
        if (on) {
          var j2 = active.indexOf(k2), bd = res.drivers[1 + j2], bok = bd.ok, col = PAL[j2 % PAL.length];
          ctx.fillStyle = "#fff"; ctx.strokeStyle = bok ? col : BAD; ctx.lineWidth = bok ? 1.8 : 2.6;
          ctx.beginPath(); ctx.moveTo(slotX - 12, y - 10); ctx.lineTo(slotX + 12, y); ctx.lineTo(slotX - 12, y + 10); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = bok ? "#2d6a4f" : BAD; ctx.font = "7px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("f" + bd.fanout + " c" + bd.cap + (bok ? "" : " !"), slotX + 16, y);
        } else { ctx.strokeStyle = "#c9c6bd"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(slotX - 8, y); ctx.lineTo(slotX + 8, y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(slotX, y - 8); ctx.lineTo(slotX, y + 8); ctx.stroke(); }
        hits.push([slotX - 16, y - 12, slotX + 40, y + 12, k2]);
      }
      ctx.fillStyle = MUT; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText("click a slot to add or remove a buffer", slotX, 332);
    }
    function computeScore(res) { var total = Math.round(Math.max(6000, 10000 - (res.B - 3) * 1500)), best = total; try { var key = "mp-best-" + (spec.id || "eco-drv"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {} return { total: total, best: best }; }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "electrical rules met" : res.nBad + " driver" + (res.nBad === 1 ? "" : "s") + " still violating") + '</div>';
      res.drivers.forEach(function (d) {
        html += '<div class="mp-row ' + (d.ok ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (d.ok ? "✔" : "✗") + '</span><span class="mp-label">' + d.name + '</span><span class="mp-detail" style="font-size:10px">fan ' + d.fanout + "/" + FMAX + '  cap ' + d.cap + "/" + CMAX + '  slew ' + d.slew.toFixed(2) + "/" + TMAX.toFixed(2) + '</span></div>';
      });
      html += '<div class="mp-score"><span class="mp-score-note" style="font-size:11px">buffers inserted: ' + res.B + '</span></div>';
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div><div class="mp-flow-note">Every driver now meets max fanout, max capacitance, and max transition. The buffers split the load so no single driver is overloaded. The fewest buffers that clear the rules is the cheapest fix in area and power.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>All three rules pass at every driver.</b> Fewer buffers score higher. Click <b>Submit fix</b>.</div>';
      else if (res.B <= 2) html += '<div class="mp-score"><span class="mp-score-note">A driver is still overloaded: too many sinks give it too much capacitance and too slow a slew. Add buffers to split the fanout into smaller groups.</span></div>';
      else html += '<div class="mp-score"><span class="mp-score-note">Now the main driver feeds too many buffers and violates its own limits. Remove a buffer, or in a real design add a second level (a buffer tree).</span></div>';
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
  if (typeof window !== "undefined") window.EcoDrv = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
