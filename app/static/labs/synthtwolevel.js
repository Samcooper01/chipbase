/* Synthesis lab: synth-twolevel (two-level minimization).
   A Boolean function is given as its 1s on a 4-variable Karnaugh map. Every prime
   implicant (a largest possible group of 1s) is offered in a palette. The learner
   picks a set of prime implicants that covers every 1, at the least total cost
   (literals). A 1 that only one implicant covers forces that implicant (it is
   essential); the rest are chosen to cover what is left cheaply. Picking a redundant
   implicant, or a small one where a large one would do, raises the cost. Function:
   F(a,b,c,d) = sum m(0,1,2,5,6,7,8,9,10,14); minimum cover cd' + b'c' + a'bd, 7
   literals. window.SynthTwoLevel = { evaluate, mount }. */
(function () {
  "use strict";
  var ONSET = [0, 1, 2, 5, 6, 7, 8, 9, 10, 14];
  var OPT_COST = 7;
  var PIS = [
    { id: "p1", label: "cd'", lits: 2, cov: [2, 6, 10, 14] },
    { id: "p2", label: "b'd'", lits: 2, cov: [0, 2, 8, 10] },
    { id: "p3", label: "b'c'", lits: 2, cov: [0, 1, 8, 9] },
    { id: "p4", label: "a'c'd", lits: 3, cov: [1, 5] },
    { id: "p5", label: "a'bd", lits: 3, cov: [5, 7] },
    { id: "p6", label: "a'bc", lits: 3, cov: [6, 7] }
  ];
  var onsetSet = {}; ONSET.forEach(function (m) { onsetSet[m] = true; });
  function analyze(sel) {
    var covered = {}, cost = 0, terms = 0;
    PIS.forEach(function (p) { if (sel.indexOf(p.id) >= 0) { p.cov.forEach(function (m) { covered[m] = true; }); cost += p.lits; terms++; } });
    var uncovered = ONSET.filter(function (m) { return !covered[m]; });
    var allCov = uncovered.length === 0;
    return { covered: covered, uncovered: uncovered, allCov: allCov, cost: cost, terms: terms, pass: allCov && cost <= OPT_COST };
  }
  function evaluate(spec, sel) { return analyze(sel || []); }

  function mount(container, spec) {
    var W = 580, Hpx = 336, dpr = window.devicePixelRatio || 1;
    var sel = [], submitted = false, scoreObj = null;
    var kx = 74, ky = 74, cell = 48;
    var rowAB = [[0, 0], [0, 1], [1, 1], [1, 0]], colCD = [[0, 0], [0, 1], [1, 1], [1, 0]];
    var labAB = ["00", "01", "11", "10"], labCD = ["00", "01", "11", "10"];
    function mterm(r, c) { var a = rowAB[r][0], b = rowAB[r][1], cc = colCD[c][0], d = colCD[c][1]; return a * 8 + b * 4 + cc * 2 + d; }

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas");
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "pointer"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "8px 0"; hint.style.maxWidth = W + "px";
    hint.innerHTML = "The map shows the <b>1s</b> of a 4-variable function. Each item on the right is a <b>prime implicant</b>, a largest group of 1s, worth its number of literals. <b>Click implicants</b> to build a cover: every 1 must be covered (they turn green), at the <b>least total literals</b>. A 1 that only one implicant can cover forces that implicant. Avoid redundant picks and small implicants where a large one covers the same 1s. Reach full coverage at minimum cost, then <b>Submit cover</b>.";
    left.appendChild(hint);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit cover";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    var OK = "#15803d", BAD = "#dc2626", MUT = "#6b7280", SEL = "#2563eb";
    var hits = [];
    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx); hits = [];
      /* axis labels */
      ctx.fillStyle = MUT; ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("cd", kx - 34, ky - 16); ctx.fillText("ab", kx - 34, ky + 2 * cell);
      for (var c = 0; c < 4; c++) ctx.fillText(labCD[c], kx + c * cell + cell / 2, ky - 14);
      for (var r = 0; r < 4; r++) ctx.fillText(labAB[r], kx - 18, ky + r * cell + cell / 2);
      /* cells */
      for (var r2 = 0; r2 < 4; r2++) for (var c2 = 0; c2 < 4; c2++) {
        var m = mterm(r2, c2), on = onsetSet[m], x = kx + c2 * cell, y = ky + r2 * cell;
        var covered = res.covered[m];
        if (on) { ctx.fillStyle = covered ? "rgba(21,128,61,0.22)" : "rgba(220,38,38,0.16)"; }
        else ctx.fillStyle = "#f4f2ec";
        ctx.fillRect(x, y, cell, cell); ctx.strokeStyle = "#c9c6bd"; ctx.lineWidth = 1; ctx.strokeRect(x, y, cell, cell);
        ctx.fillStyle = on ? (covered ? OK : BAD) : "#b8b4aa"; ctx.font = "700 15px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(on ? "1" : "0", x + cell / 2, y + cell / 2 - 3);
        ctx.fillStyle = "#b8b4aa"; ctx.font = "7px 'JetBrains Mono', monospace"; ctx.textBaseline = "top"; ctx.fillText("m" + m, x + 3, y + 3);
      }
      /* palette */
      var px = kx + 4 * cell + 40, pw = W - px - 16;
      ctx.fillStyle = "#5a606e"; ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.fillText("prime implicants", px, ky - 14);
      PIS.forEach(function (p, i) {
        var y = ky + i * 34, on = sel.indexOf(p.id) >= 0;
        ctx.fillStyle = on ? "rgba(37,99,237,0.10)" : "#faf9f5"; ctx.strokeStyle = on ? SEL : "#c9c6bd"; ctx.lineWidth = on ? 2.2 : 1.2;
        ctx.fillRect(px, y, pw, 28); ctx.strokeRect(px, y, pw, 28);
        ctx.fillStyle = "#1a1d26"; ctx.font = "700 12px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(p.label, px + 8, y + 10);
        ctx.fillStyle = MUT; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.fillText(p.lits + " literals, covers " + p.cov.length, px + 8, y + 21);
        hits.push([px, y, px + pw, y + 28, p.id]);
      });
    }
    function computeScore(res) { var total = Math.round(Math.max(6000, 10000 - (res.cost - OPT_COST) * 1500)), best = total; try { var key = "mp-best-" + (spec.id || "synth-twolevel"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {} return { total: total, best: best }; }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "minimal cover" : (res.allCov ? "covered but not minimal" : "not fully covered")) + '</div>';
      html += '<div class="mp-row ' + (res.allCov ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.allCov ? "✔" : "✗") + '</span><span class="mp-label">All 1s covered</span><span class="mp-detail">' + (ONSET.length - res.uncovered.length) + " / " + ONSET.length + '</span></div>';
      html += '<div class="mp-row ' + (res.allCov && res.cost <= OPT_COST ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.allCov && res.cost <= OPT_COST ? "✔" : "✗") + '</span><span class="mp-label">Literal cost</span><span class="mp-detail">' + res.cost + " (min " + OPT_COST + ")</span></div>";
      html += '<div class="mp-score"><span class="mp-score-note" style="font-size:11px">terms: ' + res.terms + '</span></div>';
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div><div class="mp-flow-note">Every 1 is covered with the fewest literals. Two implicants were essential (a 1 only they could cover), and the last group of 1s was taken by the single largest implicant that reached them.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>Full coverage at minimum cost.</b> Click <b>Submit cover</b>.</div>';
      else if (!res.allCov) html += '<div class="mp-score"><span class="mp-score-note">Some 1s (red) are still uncovered. Add implicants that reach them. Start with any 1 that only one implicant can cover: that implicant is forced.</span></div>';
      else html += '<div class="mp-score"><span class="mp-score-note">Covered, but the cost is above the minimum (' + OPT_COST + '). You have a redundant implicant, or a small one where a larger implicant covers the same 1s. Drop the extra literals.</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, sel); draw(last); render(last); bSubmit.disabled = submitted || !last.pass; bSubmit.classList.toggle("mp-ready", !submitted && last.pass); }
    function tap(e) {
      if (submitted) return; var r = canvas.getBoundingClientRect(), t = e.touches ? e.touches[0] : e, px = t.clientX - r.left, py = t.clientY - r.top;
      for (var i = 0; i < hits.length; i++) { var h = hits[i]; if (px >= h[0] && px <= h[2] && py >= h[1] && py <= h[3]) { var id = h[4], k = sel.indexOf(id); if (k >= 0) sel.splice(k, 1); else sel.push(id); scoreObj = null; refresh(); break; } }
      e.preventDefault();
    }
    canvas.addEventListener("mousedown", tap); canvas.addEventListener("touchstart", tap, { passive: false });
    bSubmit.addEventListener("click", function () { if (!submitted && last && last.pass) { submitted = true; scoreObj = computeScore(last); refresh(); } });
    bReset.addEventListener("click", function () { sel = []; submitted = false; scoreObj = null; refresh(); });
    refresh();
  }

  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.SynthTwoLevel = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
