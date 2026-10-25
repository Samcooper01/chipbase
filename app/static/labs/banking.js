/* Multi-bit flip-flop banking lab. Merge two nearby single-bit flops into a
   2-bit bank so they share a clock buffer (saves clock power). The pair snaps to
   its midpoint, changing each flop's data-net length. Click a candidate merge
   (dashed link) to bank the pair; each flop can be in at most one bank. Hit the
   merge target with the total data-wirelength increase under budget.
   window.Banking = { evaluate, mount }. */
(function () {
  "use strict";
  function man(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
  function mid(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
  function evaluate(spec, active) {
    var byId = {}; spec.flops.forEach(function (f) { byId[f.id] = f; });
    var used = {}, conflict = false, merges = 0, wl = 0;
    active.forEach(function (ci) {
      var p = spec.cands[ci], a = byId[p[0]], b = byId[p[1]];
      if (used[p[0]] || used[p[1]]) conflict = true;
      used[p[0]] = used[p[1]] = true; merges++;
      var m = mid(a, b);
      wl += (man(m, { x: a.ax, y: a.y2 }) + man(m, { x: b.ax, y: b.y2 })) - (man(a, { x: a.ax, y: a.y2 }) + man(b, { x: b.ax, y: b.y2 }));
    });
    return { merges: merges, wl: wl, conflict: conflict, used: used,
      mergesOK: merges >= spec.target, wlOK: wl <= spec.wlBudget + 1e-6,
      pass: !conflict && merges >= spec.target && wl <= spec.wlBudget + 1e-6 };
  }
  function mount(container, spec) {
    var core = spec.core, PAD = 24, MAXPX = 460;
    var sc = MAXPX / Math.max(core.w, core.h);
    var W = core.w * sc + PAD * 2, Hpx = core.h * sc + PAD * 2;
    function mx(x) { return PAD + x * sc; } function my(y) { return PAD + y * sc; }
    var byId = {}; spec.flops.forEach(function (f) { byId[f.id] = f; });
    var active = [], scoreObj = null;
    function isActive(ci) { return active.indexOf(ci) >= 0; }

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas"); var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "pointer"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "8px 0";
    hint.innerHTML = "Dashed links are candidate merges. Click one to bank the pair (they snap together and share a clock). Grey lines are data nets to each flop's anchor.";
    left.appendChild(hint);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit design";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    function drawnPos(f) {   // where a flop is drawn (its bank midpoint if merged)
      for (var i = 0; i < active.length; i++) { var p = spec.cands[active[i]]; if (p[0] === f.id || p[1] === f.id) return mid(byId[p[0]], byId[p[1]]); }
      return { x: f.x, y: f.y };
    }
    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx);
      ctx.fillStyle = "#fdfdfd"; ctx.fillRect(mx(0), my(0), core.w * sc, core.h * sc);
      /* data nets */
      spec.flops.forEach(function (f) { var d = drawnPos(f); ctx.strokeStyle = "rgba(90,96,110,0.4)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(mx(d.x), my(d.y)); ctx.lineTo(mx(f.ax), my(f.y2)); ctx.stroke(); ctx.fillStyle = "#8a90a0"; ctx.beginPath(); ctx.arc(mx(f.ax), my(f.y2), 2, 0, Math.PI * 2); ctx.fill(); });
      /* candidate links: only for still-available pairs (both flops free). An
         active merge is drawn as a bank below; a candidate that shares a flop
         with an active merge is unselectable, so its link is hidden too. */
      spec.cands.forEach(function (p, ci) {
        if (isActive(ci) || res.used[p[0]] || res.used[p[1]]) return;
        var a = byId[p[0]], b = byId[p[1]];
        ctx.strokeStyle = "rgba(120,125,135,0.6)"; ctx.setLineDash([4, 3]); ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(mx(a.x), my(a.y)); ctx.lineTo(mx(b.x), my(b.y)); ctx.stroke(); ctx.setLineDash([]);
      });
      /* active banks */
      active.forEach(function (ci) {
        var p = spec.cands[ci], a = byId[p[0]], b = byId[p[1]], m = mid(a, b);
        ctx.fillStyle = "rgba(217,119,6,0.16)"; ctx.strokeStyle = "#d97706"; ctx.lineWidth = 1.6;
        ctx.fillRect(mx(m.x) - 13, my(m.y) - 8, 26, 16); ctx.strokeRect(mx(m.x) - 13, my(m.y) - 8, 26, 16);
        ctx.fillStyle = "#7c3a06"; ctx.font = "700 7px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillText("2-bit", mx(m.x), my(m.y) - 10);
      });
      /* flops */
      spec.flops.forEach(function (f) {
        var d = drawnPos(f), merged = res.used[f.id];
        ctx.fillStyle = merged ? "rgba(217,119,6,0.5)" : "rgba(13,148,136,0.25)";
        ctx.fillRect(mx(d.x) - 5, my(d.y) - 4, 10, 8); ctx.strokeStyle = merged ? "#7c3a06" : "#0d9488"; ctx.lineWidth = 1; ctx.strokeRect(mx(d.x) - 5, my(d.y) - 4, 10, 8);
        ctx.fillStyle = "#134e4a"; ctx.font = "6px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(f.id, mx(d.x), my(d.y));
      });
      ctx.strokeStyle = "#1a1d26"; ctx.lineWidth = 1.6; ctx.strokeRect(mx(0), my(0), core.w * sc, core.h * sc);
    }
    function computeScore(res) {
      var eff = Math.max(0, Math.min(1, (spec.wlBudget - res.wl) / Math.max(1, spec.wlBudget - spec.wlPar + 10)));
      var total = Math.round(4000 + 6000 * eff), best = total;
      try { var key = "mp-best-" + (spec.id || "cts-banking"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {}
      return { total: total, best: best };
    }
    function rowc(l, ok, d) { return '<div class="mp-row ' + (ok ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (ok ? "✔" : "✗") + '</span><span class="mp-label">' + l + '</span><span class="mp-detail">' + d + '</span></div>'; }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "PASS" : "not yet") + '</div>';
      html += rowc("Banks (clock power saved)", res.mergesOK, res.merges + " / " + spec.target + " merges");
      html += rowc("Data wirelength in budget", res.wlOK, (res.wl >= 0 ? "+" : "") + res.wl.toFixed(0) + " / " + spec.wlBudget);
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div>' + (scoreObj.best > scoreObj.total ? '<div class="mp-score-line">your best: ' + scoreObj.best + '</div>' : '') + '<div class="mp-flow-note">Banked without stretching the data nets. Bank the tight pairs, leave the far ones single.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>Enough banks, within budget.</b> Click <b>Submit design</b> to score it.</div>';
      else html += '<div class="mp-score"><span class="mp-score-note">' + (spec.hint || "") + '</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, active); draw(last); render(last); bSubmit.disabled = !last.pass; bSubmit.classList.toggle("mp-ready", last.pass); }
    function tap(e) {
      var r0 = canvas.getBoundingClientRect(), px = (e.touches ? e.touches[0].clientX : e.clientX) - r0.left, py = (e.touches ? e.touches[0].clientY : e.clientY) - r0.top;
      var bestC = -1, bestD = 15;
      spec.cands.forEach(function (p, ci) { var a = byId[p[0]], b = byId[p[1]], m = mid(a, b); var dd = Math.hypot(px - mx(m.x), py - my(m.y)); if (dd < bestD) { bestD = dd; bestC = ci; } });
      if (bestC >= 0) {
        var k = active.indexOf(bestC);
        if (k >= 0) active.splice(k, 1);
        else { var p = spec.cands[bestC]; var u = evaluate(spec, active).used; if (!u[p[0]] && !u[p[1]]) active.push(bestC); }   // block conflicting merges
        scoreObj = null; refresh();
      }
      e.preventDefault();
    }
    canvas.addEventListener("mousedown", tap); canvas.addEventListener("touchstart", tap, { passive: false });
    bSubmit.addEventListener("click", function () { if (last && last.pass) { scoreObj = computeScore(last); render(last); } });
    bReset.addEventListener("click", function () { active = []; scoreObj = null; refresh(); });
    refresh();
  }
  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.Banking = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
