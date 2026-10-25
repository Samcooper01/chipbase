/* STA: critical path, gate level. Several equal-length paths run from FF_A
   through gates to FF_Z; you cannot spot the worst by counting gates, you must
   ADD UP the gate delays. Trace a path gate by gate (the delay sums as you go),
   then submit the path with the largest delay - the least-slack, critical path.
   window.StaCritical = { evaluate, mount }. */
(function () {
  "use strict";
  function build(spec) {
    var N = {}; spec.nodes.forEach(function (n) { N[n.id] = n; });
    var adj = {}, eset = {}; spec.edges.forEach(function (e) { (adj[e[0]] = adj[e[0]] || []).push(e[1]); eset[e[0] + ">" + e[1]] = true; });
    return { N: N, adj: adj, eset: eset };
  }
  function allPaths(spec) {
    var g = build(spec), out = [];
    (function dfs(cur, path) { if (spec.sinks.indexOf(cur) >= 0) { out.push(path.slice()); return; } (g.adj[cur] || []).forEach(function (nx) { dfs(nx, path.concat(nx)); }); })(spec.sources[0], [spec.sources[0]]);
    return out;
  }
  function pathDelay(spec, path) { var g = build(spec); return path.reduce(function (s, id) { return s + (g.N[id].d || 0); }, 0); }
  function evaluate(spec, path) {
    var g = build(spec);
    var valid = path.length >= 2 && spec.sources.indexOf(path[0]) >= 0 && spec.sinks.indexOf(path[path.length - 1]) >= 0;
    for (var i = 1; i < path.length && valid; i++) if (!g.eset[path[i - 1] + ">" + path[i]]) valid = false;
    var gd = pathDelay(spec, path), arrival = spec.tcq + gd, slack = (spec.period - spec.tsetup) - arrival;
    var arrs = allPaths(spec).map(function (p) { return spec.tcq + pathDelay(spec, p); });
    var maxArr = Math.max.apply(null, arrs);
    return { valid: valid, complete: valid, gateSum: gd, arrival: arrival, slack: slack, maxArr: maxArr,
      isCritical: valid && Math.abs(arrival - maxArr) < 1e-9, pass: valid && Math.abs(arrival - maxArr) < 1e-9 };
  }
  function mount(container, spec) {
    var PAD = 14, W = 540, Hpx = 260;
    var g = build(spec), paths = allPaths(spec), maxArr = Math.max.apply(null, paths.map(function (p) { return spec.tcq + pathDelay(spec, p); }));
    var path = [], submitted = false, scoreObj = null;

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas"); var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "pointer"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "8px 0";
    hint.innerHTML = "Click FF_A, then follow one path's gates to FF_Z - the delay sums as you go (click the last gate again to back up). Trace each path, then submit the one with the largest total delay.";
    left.appendChild(hint);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bClear = document.createElement("button"); bClear.className = "btn btn-ghost"; bClear.textContent = "Clear trace";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit as critical";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bClear); ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    function nodeBox(n) { return n.type === "ff" ? { w: 44, h: 48 } : { w: 42, h: 26 }; }
    function nodeAt(px, py) { for (var i = 0; i < spec.nodes.length; i++) { var n = spec.nodes[i], b = nodeBox(n); if (px >= n.x - b.w / 2 && px <= n.x + b.w / 2 && py >= n.y - b.h / 2 && py <= n.y + b.h / 2) return n.id; } return null; }
    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx);
      /* edges */
      var pset = {}; for (var i = 1; i < path.length; i++) pset[path[i - 1] + ">" + path[i]] = true;
      spec.edges.forEach(function (e) { var a = g.N[e[0]], b = g.N[e[1]], on = pset[e[0] + ">" + e[1]]; ctx.strokeStyle = on ? "#d97706" : "rgba(120,125,135,0.5)"; ctx.lineWidth = on ? 3 : 1.4; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); });
      /* nodes */
      spec.nodes.forEach(function (n) {
        var b = nodeBox(n), inPath = path.indexOf(n.id) >= 0, isLast = path[path.length - 1] === n.id;
        if (n.type === "ff") {
          var fw = 44, fh = 48, x = n.x - fw / 2, y = n.y - fh / 2;
          ctx.fillStyle = inPath ? "rgba(217,119,6,0.3)" : "rgba(13,148,136,0.25)"; ctx.fillRect(x, y, fw, fh);
          ctx.strokeStyle = isLast ? "#d97706" : "#0d9488"; ctx.lineWidth = isLast ? 3 : 2.2; ctx.strokeRect(x, y, fw, fh);
          /* clock-input triangle (flip-flop symbol) on the left edge */
          ctx.fillStyle = isLast ? "#d97706" : "#0d9488"; ctx.beginPath(); ctx.moveTo(x, n.y - 7); ctx.lineTo(x + 9, n.y); ctx.lineTo(x, n.y + 7); ctx.closePath(); ctx.fill();
          /* D and Q pin hints */
          ctx.fillStyle = "#134e4a"; ctx.font = "7px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText("D", x + 3, y + 3); ctx.textAlign = "right"; ctx.fillText("Q", x + fw - 3, y + 3);
          ctx.fillStyle = "#0d9488"; ctx.font = "700 8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText("flip-flop", n.x, y - 3);
          ctx.fillStyle = "#134e4a"; ctx.font = "bold 10px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(n.id, n.x, n.y);
        }
        else { ctx.fillStyle = inPath ? "rgba(217,119,6,0.28)" : "rgba(37,99,237,0.14)"; ctx.fillRect(n.x - 21, n.y - 13, 42, 26); ctx.strokeStyle = isLast ? "#d97706" : "#2f6fed"; ctx.lineWidth = isLast ? 2.6 : 1.4; ctx.strokeRect(n.x - 21, n.y - 13, 42, 26); ctx.fillStyle = "#1a1d26"; ctx.font = "bold 9px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(n.id, n.x, n.y - 4); ctx.fillStyle = "#7c3a06"; ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.fillText(n.d.toFixed(1), n.x, n.y + 6); }
      });
      /* running sum banner */
      ctx.fillStyle = "#1a1d26"; ctx.font = "700 11px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "top";
      var doneP = res.complete;
      ctx.fillText("traced Σ gate delay = " + res.gateSum.toFixed(1) + (doneP ? "   arrival = tcq + Σ = " + res.arrival.toFixed(1) : "   (reach FF_Z to finish)"), PAD, Hpx - 20);
    }
    function computeScore() { var total = 10000, best = total; try { var key = "mp-best-" + (spec.id || "sta-critical"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {} return { total: total, best: best }; }
    function render(res) {
      var html;
      if (!submitted) {
        html = '<div class="mp-verdict" style="background:#eceae2;color:#5a606e">trace &amp; add</div>';
        html += '<div class="mp-row"><span class="mp-mark">&sum;</span><span class="mp-label">Traced gate delay</span><span class="mp-detail">' + res.gateSum.toFixed(1) + '</span></div>';
        if (res.complete) html += '<div class="mp-row"><span class="mp-mark">&middot;</span><span class="mp-label">Arrival (tcq + &Sigma;)</span><span class="mp-detail">' + res.arrival.toFixed(2) + '</span></div>';
        html += '<div class="mp-score"><span class="mp-score-note">' + (res.complete ? "Path complete. Trace the others too, then submit the largest-delay one as critical." : spec.hint) + '</span></div>';
      } else {
        var ok = res.pass;
        html = '<div class="mp-verdict ' + (ok ? "mp-pass" : "mp-fail") + '">' + (ok ? "correct" : "not the worst") + '</div>';
        html += '<div class="mp-row ' + (ok ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (ok ? "✔" : "✗") + '</span><span class="mp-label">Traced arrival</span><span class="mp-detail">' + res.arrival.toFixed(2) + " (worst = " + res.maxArr.toFixed(2) + ")</span></div>";
        html += '<div class="mp-row ' + (res.slack < 0 ? "mp-bad" : "mp-ok") + '"><span class="mp-mark">' + (res.slack < 0 ? "✗" : "✔") + '</span><span class="mp-label">Slack of this path</span><span class="mp-detail">' + (res.slack >= 0 ? "+" : "") + res.slack.toFixed(2) + '</span></div>';
        if (ok && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div><div class="mp-flow-note">The biggest gate-delay sum is the critical path' + (res.slack < 0 ? " - and its slack is negative, so this design fails until it is fixed." : ".") + '</div></div>';
        else if (!ok) html += '<div class="mp-score"><span class="mp-score-note">A different path has a larger delay sum (worst arrival ' + res.maxArr.toFixed(2) + '). Reset and add up each path again.</span></div>';
      }
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, path); draw(last); render(last); bSubmit.disabled = submitted || !last.complete; bClear.disabled = submitted || path.length === 0; bSubmit.classList.toggle("mp-ready", !submitted && last.complete); }
    function tap(e) {
      if (submitted) return; var r0 = canvas.getBoundingClientRect(); var id = nodeAt((e.touches ? e.touches[0].clientX : e.clientX) - r0.left, (e.touches ? e.touches[0].clientY : e.clientY) - r0.top);
      if (!id) { e.preventDefault(); return; }
      if (path.length === 0) { if (spec.sources.indexOf(id) >= 0) path = [id]; }
      else if (id === path[path.length - 1]) { path.pop(); }        // click last again = back up
      else if (path.indexOf(id) < 0 && g.eset[path[path.length - 1] + ">" + id]) path.push(id);
      refresh(); e.preventDefault();
    }
    canvas.addEventListener("mousedown", tap); canvas.addEventListener("touchstart", tap, { passive: false });
    bClear.addEventListener("click", function () { if (!submitted) { path = []; refresh(); } });
    bSubmit.addEventListener("click", function () { if (!submitted && last.complete) { submitted = true; if (evaluate(spec, path).pass) scoreObj = computeScore(); refresh(); } });
    bReset.addEventListener("click", function () { path = []; submitted = false; scoreObj = null; refresh(); });
    refresh();
  }
  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.StaCritical = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
