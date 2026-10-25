/* Synthesis lab: synth-constprop (constant propagation and dead-logic sweep).
   Two inputs are tied to constants (sel = 0, en = 1). Trace what each wire then
   carries. A gate is removed for one of three reasons:
     - its output folds to a constant  (g1 = a AND 0 = 0)
     - its output is just a copy of one input, so the gate becomes a plain wire
       (g2 = b AND 1 = b ; g3 = 0 OR c = c ; g5 = g4 OR 0 = g4)
     - its output drives nothing, so it is dead / unused  (g6 = a AND c, dangling)
   A gate that still computes a real function of two or more live signals stays
   (g4 = b XOR c). The whole output reduces to out = b XOR c. Each gate is labelled
   with the value its output carries, so the wiring is explicit.
   window.SynthConstProp = { evaluate, mount }. */
(function () {
  "use strict";
  var CONSTS = [{ id: "sel", val: 0 }, { id: "en", val: 1 }];
  var GATES = [
    { id: "g1", op: "AND", ins: ["a", "sel"], out: "0", kind: "const", why: "a AND sel(=0) folds to a constant 0" },
    { id: "g2", op: "AND", ins: ["b", "en"], out: "b", kind: "wire", why: "b AND en(=1) is just b: the gate becomes a wire" },
    { id: "g3", op: "OR", ins: ["g1", "c"], out: "c", kind: "wire", why: "g1(=0) OR c is just c: the gate becomes a wire" },
    { id: "g4", op: "XOR", ins: ["g2", "g3"], out: "b⊕c", kind: "keep", why: "a real XOR of two live signals (b and c): keep it" },
    { id: "g5", op: "OR", ins: ["g4", "sel"], out: "b⊕c", kind: "wire", why: "g4 OR sel(=0) is just g4: the gate becomes a wire" },
    { id: "g6", op: "AND", ins: ["a", "c"], out: "a·c", kind: "dead", why: "output drives nothing: it is dead (unused) logic" }
  ];
  var REMOVABLE = GATES.filter(function (g) { return g.kind !== "keep"; }).map(function (g) { return g.id; });
  function gById(id) { for (var i = 0; i < GATES.length; i++) if (GATES[i].id === id) return GATES[i]; return null; }
  function analyze(removed) {
    var wrongRemoved = removed.filter(function (id) { var g = gById(id); return g && g.kind === "keep"; });
    var missed = REMOVABLE.filter(function (id) { return removed.indexOf(id) < 0; });
    var nCorrect = GATES.filter(function (g) { var mk = removed.indexOf(g.id) >= 0; return mk === (g.kind !== "keep"); }).length;
    return { removed: removed, wrongRemoved: wrongRemoved, missed: missed, nCorrect: nCorrect, total: GATES.length, pass: wrongRemoved.length === 0 && missed.length === 0 };
  }
  function evaluate(spec, removed) { return analyze(removed || []); }

  function mount(container, spec) {
    var W = 620, Hpx = 344, dpr = window.devicePixelRatio || 1;
    var removed = [], submitted = false, scoreObj = null;
    var POS = {
      a: { x: 46, y: 56 }, b: { x: 46, y: 104 }, c: { x: 46, y: 150 }, sel: { x: 46, y: 214 }, en: { x: 46, y: 258 },
      g1: { x: 156, y: 80 }, g2: { x: 156, y: 150 }, g3: { x: 292, y: 118 }, g4: { x: 420, y: 150 }, g5: { x: 524, y: 150 }, g6: { x: 292, y: 262 }
    };
    var GW = 46, GH = 30;

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas");
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "pointer"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "8px 0"; hint.style.maxWidth = W + "px";
    hint.innerHTML = "Two inputs are tied: <b>sel = 0</b>, <b>en = 1</b>. The small label above each gate is the value its output now carries. A gate is <b>removed</b> when that value is a <b>constant</b> (g1 folds to 0), a <b>copy of one input</b> so the gate is just a wire (b AND 1 = b), or <b>unused</b> because its output drives nothing (dead logic). A gate stays only if it still computes a real function of two live signals. <b>Click every gate that gets removed</b>, then <b>Submit sweep</b>.";
    left.appendChild(hint);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit sweep";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    var OK = "#15803d", BAD = "#dc2626", MUT = "#6b7280", WIRE = "#334155", CONSTC = "#b45309", AMBER = "#b45309";
    var hits = [];
    function srcRight(id) { var p = POS[id]; if (id[0] === "g") return { x: p.x + GW / 2, y: p.y }; return { x: p.x + 16, y: p.y }; }
    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx); hits = [];
      /* input wires into gates */
      GATES.forEach(function (g) {
        var gp = POS[g.id];
        g.ins.forEach(function (inp, k) {
          var s = srcRight(inp), ty = gp.y + (k === 0 ? -7 : 7), tx = gp.x - GW / 2;
          var isConst = (inp === "sel" || inp === "en");
          ctx.strokeStyle = isConst ? CONSTC : "#9aa0aa"; ctx.lineWidth = isConst ? 1.6 : 1.4;
          ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(tx - 6, ty); ctx.lineTo(tx, ty); ctx.stroke();
        });
      });
      /* g5 -> out */
      var g5 = POS.g5; ctx.strokeStyle = WIRE; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(g5.x + GW / 2, g5.y); ctx.lineTo(g5.x + GW / 2 + 30, g5.y); ctx.stroke();
      ctx.fillStyle = "#1a1d26"; ctx.font = "700 10px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("out", g5.x + GW / 2 + 34, g5.y);
      /* g6 dangling output -> unused */
      var g6 = POS.g6; ctx.strokeStyle = "#c9c6bd"; ctx.setLineDash([4, 3]); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(g6.x + GW / 2, g6.y); ctx.lineTo(g6.x + GW / 2 + 34, g6.y); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = BAD; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(g6.x + GW / 2 + 40, g6.y, 5, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(g6.x + GW / 2 + 37, g6.y - 3); ctx.lineTo(g6.x + GW / 2 + 43, g6.y + 3); ctx.stroke();
      ctx.fillStyle = BAD; ctx.font = "7px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("unused", g6.x + GW / 2 + 48, g6.y);
      /* primary inputs */
      ["a", "b", "c"].forEach(function (id) { var p = POS[id]; ctx.fillStyle = "#eef1f7"; ctx.strokeStyle = "#334155"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(p.x, p.y, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#1a1d26"; ctx.font = "700 11px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(id, p.x, p.y); });
      /* constant inputs */
      CONSTS.forEach(function (cst) { var p = POS[cst.id]; ctx.fillStyle = "rgba(180,83,9,0.12)"; ctx.strokeStyle = CONSTC; ctx.lineWidth = 1.6; ctx.fillRect(p.x - 22, p.y - 12, 44, 24); ctx.strokeRect(p.x - 22, p.y - 12, 44, 24); ctx.fillStyle = CONSTC; ctx.font = "700 10px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(cst.id + "=" + cst.val, p.x, p.y); });
      /* gates */
      GATES.forEach(function (g) {
        var p = POS[g.id], rm = removed.indexOf(g.id) >= 0, keep = g.kind === "keep";
        /* output-value label above the gate */
        ctx.fillStyle = keep ? OK : AMBER; ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText("= " + g.out, p.x, p.y - GH / 2 - 3);
        ctx.fillStyle = rm ? "rgba(220,38,38,0.10)" : "#eef1f7"; ctx.strokeStyle = rm ? BAD : (keep ? "#334155" : "#334155"); ctx.lineWidth = rm ? 2 : 1.6;
        if (rm) ctx.setLineDash([4, 3]);
        ctx.fillRect(p.x - GW / 2, p.y - GH / 2, GW, GH); ctx.strokeRect(p.x - GW / 2, p.y - GH / 2, GW, GH); ctx.setLineDash([]);
        ctx.fillStyle = rm ? BAD : "#1a1d26"; ctx.font = "700 10px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(g.op, p.x, p.y - 4);
        ctx.fillStyle = MUT; ctx.font = "7px 'JetBrains Mono', monospace"; ctx.fillText(g.id + " (" + g.ins.join(",") + ")", p.x, p.y + 8);
        if (rm) { ctx.strokeStyle = BAD; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x - GW / 2 + 4, p.y - GH / 2 + 4); ctx.lineTo(p.x + GW / 2 - 4, p.y + GH / 2 - 4); ctx.stroke(); }
        if (submitted) { var good = (rm === (g.kind !== "keep")); ctx.fillStyle = good ? OK : BAD; ctx.font = "700 10px 'JetBrains Mono', monospace"; ctx.textBaseline = "bottom"; ctx.textAlign = "left"; ctx.fillText(good ? "✔" : "✗", p.x + GW / 2 - 4, p.y + GH / 2 + 12); }
        hits.push([p.x - GW / 2, p.y - GH / 2, p.x + GW / 2, p.y + GH / 2, g.id]);
      });
    }
    function computeScore(res) { var total = 10000, best = total; try { var key = "mp-best-" + (spec.id || "synth-constprop"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {} return { total: total, best: best }; }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "swept to minimal netlist" : res.nCorrect + " / " + res.total + " gates correct") + '</div>';
      html += '<div class="mp-row ' + (res.missed.length === 0 ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.missed.length === 0 ? "✔" : "✗") + '</span><span class="mp-label">Removed every removable gate</span><span class="mp-detail">' + (REMOVABLE.length - res.missed.length) + " / " + REMOVABLE.length + '</span></div>';
      html += '<div class="mp-row ' + (res.wrongRemoved.length === 0 ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.wrongRemoved.length === 0 ? "✔" : "✗") + '</span><span class="mp-label">Kept the real logic</span><span class="mp-detail">' + (res.wrongRemoved.length === 0 ? "yes" : "cut " + res.wrongRemoved.join(",")) + '</span></div>';
      if (submitted) { html += '<div class="mp-score"><span class="mp-score-note" style="font-size:10px">'; GATES.forEach(function (g) { var tag = g.kind === "keep" ? "keep" : g.kind === "const" ? "constant" : g.kind === "wire" ? "wire" : "dead"; html += g.id + " = " + g.out + "  (" + tag + "): " + g.why + "<br>"; }); html += '</span></div>'; }
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div><div class="mp-flow-note">Only g4 survives. g1 folded to a constant, g2/g3/g5 each became a wire (a copy of one input), and g6 was dead (its output drove nothing). The output reduces to out = b ⊕ c.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>Exactly the removable gates are marked.</b> Click <b>Submit sweep</b>.</div>';
      else if (res.wrongRemoved.length) html += '<div class="mp-score"><span class="mp-score-note">You cut g4, which still computes a real 2-input function (b ⊕ c). Keep any gate whose output label is a genuine function of two live signals.</span></div>';
      else html += '<div class="mp-score"><span class="mp-score-note">Read the label above each gate. Remove it if that value is a constant, a copy of one input (a wire), or unused. Some removable gates are still marked to keep.</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, removed); draw(last); render(last); bSubmit.disabled = submitted; bSubmit.classList.toggle("mp-ready", !submitted && last.pass); }
    function tap(e) {
      if (submitted) return; var r = canvas.getBoundingClientRect(), t = e.touches ? e.touches[0] : e, px = t.clientX - r.left, py = t.clientY - r.top;
      for (var i = 0; i < hits.length; i++) { var h = hits[i]; if (px >= h[0] && px <= h[2] && py >= h[1] && py <= h[3]) { var id = h[4], k = removed.indexOf(id); if (k >= 0) removed.splice(k, 1); else removed.push(id); scoreObj = null; refresh(); break; } }
      e.preventDefault();
    }
    canvas.addEventListener("mousedown", tap); canvas.addEventListener("touchstart", tap, { passive: false });
    bSubmit.addEventListener("click", function () { if (!submitted) { last = evaluate(spec, removed); if (last.pass) scoreObj = computeScore(last); submitted = true; refresh(); } });
    bReset.addEventListener("click", function () { removed = []; submitted = false; scoreObj = null; refresh(); });
    refresh();
  }

  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.SynthConstProp = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
