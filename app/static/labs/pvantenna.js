/* Physical Verification lab: pv-antenna (antenna ratio check).
   During plasma etch, charge collects on the conductor connected to a gate
   before an upper layer or a diode can drain it. The antenna ratio is the
   accumulated metal area divided by the gate-oxide area it connects to; above
   the limit, the charge can damage the gate. Two fixes: LAYER-JUMP part of the
   route to a higher layer so less area accumulates on the offending layer
   (preferred, free), or add a protection DIODE that drains the charge (always
   works, but costs area and adds leakage, so it is a last resort). The learner
   reads each net's ratio and picks the minimal fix. window.PvAntenna = {evaluate, mount}. */
(function () {
  "use strict";
  var LIMIT = 400;
  var NETS = [
    { id: "net_a", G: 4, A: 1200, jumpA: 1200 },
    { id: "net_b", G: 4, A: 2000, jumpA: 1100 },
    { id: "net_c", G: 3, A: 3600, jumpA: 3200 },
    { id: "net_d", G: 4, A: 800, jumpA: 800 },
    { id: "net_e", G: 4, A: 2800, jumpA: 1200 },
    { id: "net_f", G: 2, A: 2000, jumpA: 1200 }
  ];
  function ratio(n) { return n.A / n.G; }
  function jumpRatio(n) { return n.jumpA / n.G; }
  function correctOf(n) { return ratio(n) <= LIMIT ? "ok" : (jumpRatio(n) <= LIMIT ? "jump" : "diode"); }
  function effRatio(n, d) { return d === "ok" ? ratio(n) : (d === "jump" ? jumpRatio(n) : 0); }
  function evaluate(spec, disp) {
    var wrong = [];
    NETS.forEach(function (n) { if ((disp[n.id] || "ok") !== correctOf(n)) wrong.push(n.id); });
    return { wrong: wrong, pass: wrong.length === 0 };
  }

  function mount(container, spec) {
    var W = 620, dpr = window.devicePixelRatio || 1;
    var disp = {}; NETS.forEach(function (n) { disp[n.id] = "ok"; });
    var submitted = false, scoreObj = null;
    var top = 54, rowH = 46, x0 = 150, scale = 0.20, barMax = 300;
    var Hpx = top + NETS.length * rowH + 16;
    var limitX = x0 + LIMIT * scale;

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas");
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "pointer"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "8px 0"; hint.style.maxWidth = W + "px";
    hint.innerHTML = "The <b>antenna ratio</b> is a net's metal area divided by the gate area it drives. Any net over the limit (<b>" + LIMIT + "</b>) can damage the gate during etch. Click a net to cycle its fix: <b>OK</b> (already under the limit), <b>jump</b> (route part to a higher layer, dropping the on-layer area), or <b>diode</b> (drain the charge). Prefer a jump when it gets the net under the limit; use a diode only when jumping cannot (a diode costs area and leakage).";
    left.appendChild(hint);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit fixes";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    var OK = "#15803d", BAD = "#dc2626", DIM = "#334155", MUT = "#9aa0aa", DCOL = { ok: "#15803d", jump: "#2563eb", diode: "#b45309" };
    var hits = [];
    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx);
      /* limit line */
      ctx.strokeStyle = "#c23c32"; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(limitX, top - 16); ctx.lineTo(limitX, top + NETS.length * rowH - 6); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = "#c23c32"; ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText("limit " + LIMIT, limitX, top - 18);
      hits = [];
      NETS.forEach(function (n, i) {
        var y = top + i * rowH, by = y + 8, R = ratio(n), d = disp[n.id], eff = effRatio(n, d), resolved = eff <= LIMIT + 1e-9;
        /* label */
        ctx.fillStyle = "#1a1d26"; ctx.font = "bold 10px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(n.id, 12, by + 8);
        ctx.fillStyle = "#8a90a0"; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.fillText("gate " + n.G + ", metal " + n.A, 12, by + 20);
        /* raw ratio outline */
        ctx.strokeStyle = "#d0ccc2"; ctx.lineWidth = 1; ctx.strokeRect(x0, by, Math.min(barMax, R * scale), 16);
        /* effective bar */
        ctx.fillStyle = resolved ? "rgba(21,128,61,0.5)" : "rgba(220,38,38,0.55)"; ctx.fillRect(x0, by, Math.min(barMax, eff * scale), 16);
        ctx.fillStyle = resolved ? OK : BAD; ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("ratio " + Math.round(eff), x0 + Math.min(barMax, R * scale) + 6, by + 8);
        /* options hint text */
        ctx.fillStyle = MUT; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.fillText("R=" + R + "  jump→" + Math.round(jumpRatio(n)) + "  diode→0", 12, by + 30);
        /* disposition chip */
        var chx = x0 + barMax + 78, chw = 66, chy = by - 1, dd = d;
        ctx.fillStyle = "#fff"; ctx.strokeStyle = DCOL[dd]; ctx.lineWidth = 1.6; ctx.fillRect(chx, chy, chw, 18); ctx.strokeRect(chx, chy, chw, 18);
        ctx.fillStyle = DCOL[dd]; ctx.font = "700 10px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(dd === "ok" ? "OK" : (dd === "jump" ? "jump" : "diode"), chx + chw / 2, chy + 9);
        if (submitted) { var good = res.wrong.indexOf(n.id) < 0; ctx.fillStyle = good ? OK : BAD; ctx.font = "700 11px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.fillText(good ? "✔" : "✗", chx + chw + 6, chy + 9); }
        hits.push([8, y, W - 8, y + rowH - 4, n.id]);
      });
    }
    function computeScore() { var total = 10000, best = total; try { var key = "mp-best-" + (spec.id || "pv-antenna"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {} return { total: total, best: best }; }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "antenna clean" : res.wrong.length + " wrong") + '</div>';
      var over = NETS.filter(function (n) { return ratio(n) > LIMIT; }).length;
      html += '<div class="mp-row ' + (res.pass ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.pass ? "✔" : "✗") + '</span><span class="mp-label">Every net dispositioned right</span><span class="mp-detail">' + (NETS.length - res.wrong.length) + " / " + NETS.length + '</span></div>';
      html += '<div class="mp-score"><span class="mp-score-note" style="font-size:11px">' + over + ' of ' + NETS.length + ' nets exceed the limit and need a fix</span></div>';
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div><div class="mp-flow-note">Every net is under the limit, with a layer-jump wherever it was enough and a diode only where the area could not be reduced far enough. Diodes were not spent where a jump would do.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>Every net is under the limit.</b> Click <b>Submit fixes</b>.</div>';
      else html += '<div class="mp-score"><span class="mp-score-note">Check each net: leave it OK only if its ratio is already at or under ' + LIMIT + '; jump if that brings it under; and use a diode only when even the jumped ratio stays over the limit. Using a diode where a jump would do is marked wrong.</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, disp); draw(last); render(last); bSubmit.disabled = submitted || !last.pass; bSubmit.classList.toggle("mp-ready", !submitted && last.pass); }
    function tap(e) {
      if (submitted) return; var r = canvas.getBoundingClientRect(), t = e.touches ? e.touches[0] : e, px = t.clientX - r.left, py = t.clientY - r.top;
      var order = ["ok", "jump", "diode"];
      for (var i = 0; i < hits.length; i++) { var h = hits[i]; if (px >= h[0] && px <= h[2] && py >= h[1] && py <= h[3]) { disp[h[4]] = order[(order.indexOf(disp[h[4]]) + 1) % 3]; scoreObj = null; refresh(); break; } }
      e.preventDefault();
    }
    canvas.addEventListener("mousedown", tap); canvas.addEventListener("touchstart", tap, { passive: false });
    bSubmit.addEventListener("click", function () { if (!submitted && last && last.pass) { submitted = true; scoreObj = computeScore(); refresh(); } });
    bReset.addEventListener("click", function () { NETS.forEach(function (n) { disp[n.id] = "ok"; }); submitted = false; scoreObj = null; refresh(); });
    refresh();
  }

  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.PvAntenna = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
