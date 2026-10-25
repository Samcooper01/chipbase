/* Clock gating insertion lab. Each register bank has a clock power and an idle
   fraction. Gate the idle banks with Integrated Clock Gating (ICG) cells to save
   dynamic power. Banks in the same enable domain share one ICG, so extra banks
   in an already-gated domain are free savings, but opening a new ICG for a
   barely-idle bank wastes overhead. Beat the net-savings target.
   window.ClkGate = { evaluate, mount }. */
(function () {
  "use strict";
  function evaluate(spec, gated) {
    var gset = {}; gated.forEach(function (g) { gset[g] = true; });
    var save = 0, doms = {};
    spec.banks.forEach(function (b) { if (gset[b.id]) { save += b.idle * b.power; doms[b.domain] = true; } });
    var nDom = Object.keys(doms).length, overhead = nDom * spec.icgCost, net = save - overhead;
    return { save: save, overhead: overhead, nDom: nDom, net: net, gset: gset, domsGated: doms,
      pass: net >= spec.target - 1e-6 };
  }
  function mount(container, spec) {
    var PAD = 24;
    var domains = []; spec.banks.forEach(function (b) { if (domains.indexOf(b.domain) < 0) domains.push(b.domain); });
    var colW = 118, hBank = 30, vGap = 8, topY = PAD + 44;
    var maxInDom = Math.max.apply(null, domains.map(function (d) { return spec.banks.filter(function (b) { return b.domain === d; }).length; }));
    var W = domains.length * colW + PAD * 2, Hpx = topY + maxInDom * (hBank + vGap) + 20;
    var gated = [], scoreObj = null;
    function toggle(id) { var k = gated.indexOf(id); if (k >= 0) gated.splice(k, 1); else gated.push(id); }

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas"); var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "pointer"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "8px 0";
    hint.innerHTML = "Click a register bank to gate it (insert an ICG on its enable domain). Banks in a domain share one ICG. Each bank shows its idle fraction and clock power.";
    left.appendChild(hint);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit design";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    var boxes = [];
    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx);
      boxes = [];
      domains.forEach(function (dom, di) {
        var cx = PAD + di * colW + colW / 2;
        var active = !!res.domsGated[dom];
        /* clock feed + ICG cell for the domain */
        ctx.strokeStyle = "#5a606e"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(cx, PAD + 4); ctx.lineTo(cx, topY - 6); ctx.stroke();
        if (active) {
          ctx.fillStyle = "rgba(21,128,61,0.85)"; ctx.strokeStyle = "#14532d"; ctx.lineWidth = 1.4;
          ctx.fillRect(cx - 16, PAD + 8, 32, 18); ctx.strokeRect(cx - 16, PAD + 8, 32, 18);
          ctx.fillStyle = "#fff"; ctx.font = "700 8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("ICG", cx, PAD + 17);
        } else {
          ctx.fillStyle = "#9aa0aa"; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("free-run", cx, PAD + 17);
        }
        ctx.fillStyle = "#5a606e"; ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillText(dom, cx, topY - 10);
        var bs = spec.banks.filter(function (b) { return b.domain === dom; });
        bs.forEach(function (b, bi) {
          var y = topY + bi * (hBank + vGap), x = cx - colW / 2 + 12, w = colW - 24;
          var on = res.gset[b.id];
          ctx.fillStyle = on ? "rgba(21,128,61,0.22)" : "rgba(37,99,237,0.10)"; ctx.fillRect(x, y, w, hBank);
          ctx.strokeStyle = on ? "#15803d" : "#8a90a0"; ctx.lineWidth = on ? 2 : 1.2; ctx.strokeRect(x, y, w, hBank);
          ctx.fillStyle = "#1a1d26"; ctx.font = "bold 9px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
          ctx.fillText(b.id + (on ? " gated" : ""), x + 5, y + 11);
          ctx.font = "8px 'JetBrains Mono', monospace"; ctx.fillStyle = "#5a606e";
          ctx.fillText("idle " + (b.idle * 100).toFixed(0) + "%  pwr " + b.power, x + 5, y + 23);
          boxes.push([x, y, x + w, y + hBank, b.id]);
        });
      });
    }
    function computeScore(res) {
      var par = spec.netPar || spec.target, eff = Math.max(0, Math.min(1, res.net / par));
      var total = Math.round(4000 + 6000 * eff), best = total;
      try { var key = "mp-best-" + (spec.id || "cts-gating"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {}
      return { total: total, best: best };
    }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "PASS" : "not yet") + '</div>';
      html += '<div class="mp-row ' + (res.pass ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.pass ? "✔" : "✗") + '</span><span class="mp-label">Net power saved past target</span><span class="mp-detail">' + res.net.toFixed(1) + " / " + spec.target + '</span></div>';
      html += '<div class="mp-score" style="font-size:11px"><span class="mp-score-note">gross saved <b>' + res.save.toFixed(1) + '</b> &minus; ' + res.nDom + ' ICG &times; ' + spec.icgCost + ' = <b>' + res.net.toFixed(1) + '</b> net</span></div>';
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div>' + (scoreObj.best > scoreObj.total ? '<div class="mp-score-line">your best: ' + scoreObj.best + '</div>' : '') + '<div class="mp-flow-note">Good gating. Gate the free-riders in open domains; skip lone low-idle banks.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>Net savings beat the target.</b> Click <b>Submit design</b> to score it.</div>';
      else html += '<div class="mp-score"><span class="mp-score-note">' + (spec.hint || "") + '</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, gated); draw(last); render(last); bSubmit.disabled = !last.pass; bSubmit.classList.toggle("mp-ready", last.pass); }
    function tap(e) {
      var r0 = canvas.getBoundingClientRect(), px = (e.touches ? e.touches[0].clientX : e.clientX) - r0.left, py = (e.touches ? e.touches[0].clientY : e.clientY) - r0.top;
      for (var i = 0; i < boxes.length; i++) { var b = boxes[i]; if (px >= b[0] && px <= b[2] && py >= b[1] && py <= b[3]) { toggle(b[4]); scoreObj = null; refresh(); break; } }
      e.preventDefault();
    }
    canvas.addEventListener("mousedown", tap); canvas.addEventListener("touchstart", tap, { passive: false });
    bSubmit.addEventListener("click", function () { if (last && last.pass) { scoreObj = computeScore(last); render(last); } });
    bReset.addEventListener("click", function () { gated = []; scoreObj = null; refresh(); });
    refresh();
  }
  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.ClkGate = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
