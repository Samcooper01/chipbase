/* ECO lab: eco-restruct (logic restructuring ECO).
   Some setup paths are slow not because the cells are weak but because the logic is
   shaped badly: a deep chain of gates adds one gate delay per level, and a
   late-arriving signal buried deep in the chain then passes through many more gates
   before the output. Restructuring rebuilds the same function with a better shape.
   Two levers matter: BALANCE the tree so it is shallow (a balanced tree of the same
   inputs is log-depth, not linear), and put the LATEST-arriving signal closest to
   the output so it sees the fewest gates. Here several signals combine through
   2-input gates; the learner picks which pair to combine at each step, building the
   gate tree. Each gate's output is ready at max(its inputs) + one gate delay, so the
   final arrival is set by the worst root-to-output path. window.EcoRestruct =
   { evaluate, mount }. */
(function () {
  "use strict";
  var DG = 0.4, REQ = 3.0;
  var LEAVES = [
    { label: "s1", arr: 0.0 }, { label: "s2", arr: 0.2 }, { label: "s3", arr: 0.4 },
    { label: "s4", arr: 0.6 }, { label: "s5", arr: 2.5, late: true }
  ];
  function arrivalOf(node) { return node.children ? Math.max(arrivalOf(node.children[0]), arrivalOf(node.children[1])) + DG : node.arr; }
  function evaluate(spec, root) {
    if (!root) return { complete: false, arr: null, slack: null, pass: false };
    var a = arrivalOf(root);
    return { complete: true, arr: a, slack: REQ - a, pass: a <= REQ + 1e-9 };
  }

  function mount(container, spec) {
    var W = 640, Hpx = 380, dpr = window.devicePixelRatio || 1;
    var submitted = false, scoreObj = null, sel = null, nextId = 0;
    var BOTTOM = 340, VSTEP = 58, nodes = [];

    function reset() {
      nodes = []; nextId = 0; sel = null;
      var span = W - 120, x0 = 70;
      LEAVES.forEach(function (L, i) {
        nodes.push({ id: nextId++, label: L.label, arr: L.arr, late: L.late, children: null, alive: true, x: x0 + (LEAVES.length === 1 ? 0 : i * span / (LEAVES.length - 1)), y: BOTTOM });
      });
    }
    reset();
    function alive() { return nodes.filter(function (n) { return n.alive; }); }
    function valOf(n) { return n.children ? Math.max(valOf(n.children[0]), valOf(n.children[1])) + DG : n.arr; }

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas");
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "pointer"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "8px 0"; hint.style.maxWidth = W + "px";
    hint.innerHTML = "The same function can be built as a deep chain (slow) or a balanced tree (fast). These signals combine through 2-input gates. Each gate's output is ready at <b>the later of its two inputs, plus one gate delay</b> (" + DG.toFixed(1) + "). <b>Click two nodes</b> to combine them into a gate; repeat until one output remains. Signal <b>s5 arrives late</b> (" + LEAVES[4].arr.toFixed(1) + "), so keep it for <b>last</b> (nearest the output, fewest gates after it), and combine the early signals first so the tree stays shallow. Get the output at or under the required time (" + REQ.toFixed(1) + "), then <b>Submit tree</b>.";
    left.appendChild(hint);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit tree";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    var OK = "#15803d", BAD = "#dc2626", MUT = "#6b7280", SEL = "#2563eb", LATE = "#b45309", EDGE = "#9aa0aa";
    var hits = [];
    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx); hits = [];
      var only = alive().length === 1 ? alive()[0] : null;
      /* edges */
      ctx.strokeStyle = EDGE; ctx.lineWidth = 1.6;
      nodes.forEach(function (n) { if (n.children) n.children.forEach(function (c) { ctx.beginPath(); ctx.moveTo(n.x, n.y + 13); ctx.lineTo(c.x, c.y - 13); ctx.stroke(); }); });
      /* nodes */
      nodes.forEach(function (n) {
        var v = valOf(n), isAlive = n.alive, isSel = sel === n.id, isRoot = only && n.id === only.id;
        var w = 52, h = 26, col = n.late ? LATE : (n.children ? "#334155" : "#0d9488");
        var border = isSel ? SEL : (isRoot ? (res.pass ? OK : BAD) : (isAlive ? col : "#c9c6bd"));
        ctx.fillStyle = isAlive ? "#fff" : "#f4f2ec"; ctx.strokeStyle = border; ctx.lineWidth = isSel || isRoot ? 2.6 : (isAlive ? 1.8 : 1.1);
        ctx.fillRect(n.x - w / 2, n.y - h / 2, w, h); ctx.strokeRect(n.x - w / 2, n.y - h / 2, w, h);
        ctx.fillStyle = "#1a1d26"; ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(n.children ? "gate" : n.label, n.x, n.y - 4);
        ctx.font = "8px 'JetBrains Mono', monospace"; ctx.fillStyle = n.late && !n.children ? LATE : MUT; ctx.fillText((n.late && !n.children ? "late " : "") + v.toFixed(2), n.x, n.y + 7);
        if (isAlive) hits.push([n.x - w / 2, n.y - h / 2, n.x + w / 2, n.y + h / 2, n.id]);
      });
      /* output marker */
      if (only) { ctx.fillStyle = res.pass ? OK : BAD; ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText("output", only.x, only.y - 15); }
      /* status line */
      ctx.fillStyle = MUT; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "top";
      ctx.fillText(only ? "one output node: submit when it meets timing" : (sel != null ? "pick a second node to combine" : "click two nodes to combine them into a gate"), 12, Hpx - 16);
    }
    function computeScore(res) { var total = Math.round(Math.max(6000, Math.min(10000, 6000 + res.slack * 40000))), best = total; try { var key = "mp-best-" + (spec.id || "eco-restruct"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {} return { total: total, best: best }; }
    function render(res) {
      var av = alive().length;
      var head = !res.complete ? "keep combining (" + av + " nodes left)" : (res.pass ? "meets timing" : "too slow");
      var html = '<div class="mp-verdict ' + (res.complete && res.pass ? "mp-pass" : "mp-fail") + '">' + head + '</div>';
      html += '<div class="mp-row ' + (res.complete ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.complete ? "✔" : "·") + '</span><span class="mp-label">One output built</span><span class="mp-detail">' + av + ' node' + (av === 1 ? "" : "s") + ' left</span></div>';
      if (res.complete) html += '<div class="mp-row ' + (res.pass ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.pass ? "✔" : "✗") + '</span><span class="mp-label">Output &le; required</span><span class="mp-detail">' + res.arr.toFixed(2) + " / " + REQ.toFixed(1) + '</span></div>';
      if (res.complete && res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div><div class="mp-flow-note">Same logic, better shape. The early signals were combined first so the tree stayed shallow, and the late signal s5 was kept for last so it passes through only one gate. That is the lowest the output can reach: a late input must clear at least one gate.</div></div>';
      else if (res.complete && res.pass) html += '<div class="mp-flow mp-flow-ready"><b>Output meets the required time.</b> Fewer gates after the late signal scores higher. Click <b>Submit tree</b>.</div>';
      else if (res.complete) html += '<div class="mp-score"><span class="mp-score-note">Too slow. The late signal s5 is passing through too many gates. Reset, combine the early signals into a shallow tree first, and fold s5 in last.</span></div>';
      else html += '<div class="mp-score"><span class="mp-score-note">Combine the two earliest-arriving nodes first to keep the tree balanced, and save the late signal s5 for the final gate.</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { var av = alive(); var root = av.length === 1 ? av[0] : null; last = evaluate(spec, root); draw(last); render(last); bSubmit.disabled = submitted || !(last.complete && last.pass); bSubmit.classList.toggle("mp-ready", !submitted && last.complete && last.pass); }
    function combine(aId, bId) {
      var a = nodes.filter(function (n) { return n.id === aId; })[0], b = nodes.filter(function (n) { return n.id === bId; })[0];
      a.alive = false; b.alive = false;
      nodes.push({ id: nextId++, label: "g", children: [a, b], alive: true, x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - VSTEP });
    }
    function tap(e) {
      if (submitted) return; var r = canvas.getBoundingClientRect(), t = e.touches ? e.touches[0] : e, px = t.clientX - r.left, py = t.clientY - r.top;
      for (var i = 0; i < hits.length; i++) { var h = hits[i]; if (px >= h[0] && px <= h[2] && py >= h[1] && py <= h[3]) {
        var id = h[4]; if (sel == null) sel = id; else if (sel === id) sel = null; else { combine(sel, id); sel = null; scoreObj = null; } refresh(); break;
      } }
      e.preventDefault();
    }
    canvas.addEventListener("mousedown", tap); canvas.addEventListener("touchstart", tap, { passive: false });
    bSubmit.addEventListener("click", function () { if (!submitted && last && last.complete && last.pass) { submitted = true; scoreObj = computeScore(last); refresh(); } });
    bReset.addEventListener("click", function () { reset(); submitted = false; scoreObj = null; refresh(); });
    refresh();
  }

  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.EcoRestruct = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
