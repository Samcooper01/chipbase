/* Synthesis lab: synth-fsm (state encoding).
   A finite-state machine's states must be given binary codes stored in the state
   flip-flops. The encoding sets how much next-state logic is needed: the more bits
   that flip on a transition, the more logic to compute them. A good proxy for the
   cost is the total Hamming distance summed over all transitions, so states that
   transition into one another want codes that differ in as few bits as possible.
   The learner assigns a distinct 2-bit code to each of four states to minimize that
   total. Transitions form a ring plus a chord, so the ring wants a Gray-code order
   while the chord pulls two opposite states together: minimum total distance 6.
   window.SynthFsm = { evaluate, mount }. */
(function () {
  "use strict";
  var STATES = ["S0", "S1", "S2", "S3"];
  var CODES = ["00", "01", "10", "11"];
  var EDGES = [["S0", "S1"], ["S1", "S2"], ["S2", "S3"], ["S3", "S0"], ["S0", "S2"]];
  var MINCOST = 6;
  function hd(a, b) { var n = 0; for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) n++; return n; }
  function analyze(assign) {
    var used = {}, dup = false;
    STATES.forEach(function (s) { var c = assign[s]; if (used[c]) dup = true; used[c] = (used[c] || 0) + 1; });
    var distinct = !dup;
    var cost = 0, edgeHD = EDGES.map(function (e) { var d = hd(assign[e[0]], assign[e[1]]); cost += d; return d; });
    return { distinct: distinct, cost: cost, edgeHD: edgeHD, used: used, pass: distinct && cost <= MINCOST };
  }
  function evaluate(spec, assign) { return analyze(assign || {}); }

  function mount(container, spec) {
    var W = 560, Hpx = 330, dpr = window.devicePixelRatio || 1;
    var assign = { S0: "00", S1: "10", S2: "01", S3: "11" }; // a non-minimal start
    var submitted = false, scoreObj = null;
    var cx = 236, cy = 150, R = 92, rad = 26;
    var POS = { S0: { x: cx, y: cy - R }, S1: { x: cx + R + 20, y: cy }, S2: { x: cx, y: cy + R }, S3: { x: cx - R - 20, y: cy } };

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas");
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "pointer"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "8px 0"; hint.style.maxWidth = W + "px";
    hint.innerHTML = "Each state of this machine needs a distinct 2-bit code. The <b>next-state logic</b> is smaller when a transition flips fewer bits, so the cost is the total <b>Hamming distance</b> (bits that change) summed over every transition. <b>Click a state</b> to cycle its code (00 → 01 → 10 → 11); all four codes must stay distinct. The transitions form a ring plus one chord, so give the ring a Gray-code order (neighbours differ by one bit). Reach the minimum total distance, then <b>Submit encoding</b>.";
    left.appendChild(hint);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit encoding";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    var OK = "#15803d", BAD = "#dc2626", MUT = "#6b7280", EDGE = "#9aa0aa";
    var hits = [];
    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx); hits = [];
      /* edges with arrows + HD labels */
      EDGES.forEach(function (e, i) {
        var a = POS[e[0]], b = POS[e[1]], dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy);
        var ux = dx / len, uy = dy / len, ax = a.x + ux * rad, ay = a.y + uy * rad, bx = b.x - ux * rad, by = b.y - uy * rad;
        var d = res.edgeHD[i], hot = d >= 2;
        ctx.strokeStyle = hot ? BAD : EDGE; ctx.lineWidth = hot ? 2.2 : 1.6; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
        /* arrowhead */
        ctx.fillStyle = hot ? BAD : EDGE; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - ux * 8 - uy * 4, by - uy * 8 + ux * 4); ctx.lineTo(bx - ux * 8 + uy * 4, by - uy * 8 - ux * 4); ctx.closePath(); ctx.fill();
        ctx.fillStyle = hot ? BAD : "#5a606e"; ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(String(d), (ax + bx) / 2 + uy * 10, (ay + by) / 2 - ux * 10);
      });
      /* states */
      STATES.forEach(function (s) {
        var p = POS[s], code = assign[s], conflict = res.used[code] > 1;
        ctx.fillStyle = conflict ? "rgba(220,38,38,0.12)" : "#eef1f7"; ctx.strokeStyle = conflict ? BAD : "#334155"; ctx.lineWidth = conflict ? 2.4 : 1.8;
        ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#1a1d26"; ctx.font = "700 11px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(s, p.x, p.y - 6);
        ctx.font = "700 13px 'JetBrains Mono', monospace"; ctx.fillStyle = conflict ? BAD : "#2563eb"; ctx.fillText(code, p.x, p.y + 8);
        hits.push([p.x - rad, p.y - rad, p.x + rad, p.y + rad, s]);
      });
      ctx.fillStyle = MUT; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText("edge number = bits that flip on that transition (red = 2 bits)", 20, Hpx - 18);
    }
    function computeScore(res) { var total = Math.round(Math.max(6000, 10000 - (res.cost - MINCOST) * 1500)), best = total; try { var key = "mp-best-" + (spec.id || "synth-fsm"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {} return { total: total, best: best }; }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "minimal encoding" : (!res.distinct ? "codes not distinct" : "distance above minimum")) + '</div>';
      html += '<div class="mp-row ' + (res.distinct ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.distinct ? "✔" : "✗") + '</span><span class="mp-label">All codes distinct</span><span class="mp-detail">' + (res.distinct ? "yes" : "duplicate") + '</span></div>';
      html += '<div class="mp-row ' + (res.distinct && res.cost <= MINCOST ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.distinct && res.cost <= MINCOST ? "✔" : "✗") + '</span><span class="mp-label">Total Hamming distance</span><span class="mp-detail">' + res.cost + " (min " + MINCOST + ")</span></div>";
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div><div class="mp-flow-note">The ring got a Gray-code order, so every ring transition flips one bit. Only the chord S0→S2 must flip two bits, giving total distance ' + MINCOST + ': the least next-state logic this machine allows.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>Minimum total distance.</b> Click <b>Submit encoding</b>.</div>';
      else if (!res.distinct) html += '<div class="mp-score"><span class="mp-score-note">Two states share a code. Each state needs a unique code. Cycle one of the duplicates to a free code.</span></div>';
      else html += '<div class="mp-score"><span class="mp-score-note">Some transitions flip two bits (red). Give the ring S0→S1→S2→S3→S0 a Gray-code order so each step changes only one bit.</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, assign); draw(last); render(last); bSubmit.disabled = submitted || !last.pass; bSubmit.classList.toggle("mp-ready", !submitted && last.pass); }
    function tap(e) {
      if (submitted) return; var r = canvas.getBoundingClientRect(), t = e.touches ? e.touches[0] : e, px = t.clientX - r.left, py = t.clientY - r.top;
      for (var i = 0; i < hits.length; i++) { var h = hits[i]; if (px >= h[0] && px <= h[2] && py >= h[1] && py <= h[3]) { var s = h[4], idx = CODES.indexOf(assign[s]); assign[s] = CODES[(idx + 1) % CODES.length]; scoreObj = null; refresh(); break; } }
      e.preventDefault();
    }
    canvas.addEventListener("mousedown", tap); canvas.addEventListener("touchstart", tap, { passive: false });
    bSubmit.addEventListener("click", function () { if (!submitted && last && last.pass) { submitted = true; scoreObj = computeScore(last); refresh(); } });
    bReset.addEventListener("click", function () { assign = { S0: "00", S1: "10", S2: "01", S3: "11" }; submitted = false; scoreObj = null; refresh(); });
    refresh();
  }

  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.SynthFsm = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
