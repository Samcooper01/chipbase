/* ECO lab: eco-respin (metal-only vs all-layer decision).
   Once the base (transistor) layers are on silicon, a change is cheap only if it
   can be done by re-wiring metal and vias: reusing pre-placed spare cells or moving
   connections. A change that needs new transistors (a bigger cell, a new flip-flop,
   a whole new block) forces new base-layer masks, an all-layer respin, which is slow
   and expensive. For each proposed change the learner decides which class it is,
   given the spare cells on hand. It is a judgment lab: no numbers, just the rule
   that metal-only works when a suitable spare can be wired in and all-layer is
   needed when new devices must be built. window.EcoRespin = { evaluate, mount }. */
(function () {
  "use strict";
  var ITEMS = [
    { id: "q1", change: "Swap the two inputs of an existing 2-input gate", context: "the pins are logically equivalent; only the connections move", ans: "metal", why: "No cell changes: only metal wiring is re-routed, so this is metal-only." },
    { id: "q2", change: "Insert a 2-input NAND2 (Not-AND) to gate a signal", context: "a spare NAND2 sits one row from the change site", ans: "metal", why: "A matching spare cell already exists nearby, so it is wired in with metal and vias only." },
    { id: "q3", change: "Upsize a critical inverter from X1 to X4 drive", context: "no spare of that drive strength is placed nearby", ans: "all", why: "A stronger cell has larger transistors: the base layers change. With no reachable spare of that size, it needs a respin." },
    { id: "q4", change: "Add a pipeline flip-flop to retime a path", context: "no spare flip-flops were seeded in this block", ans: "all", why: "A new sequential cell needs new transistors, and there is no spare flop to claim, so the base layers must change." },
    { id: "q5", change: "Insert a buffer on a long, slow net", context: "spare buffers are seeded throughout the block", ans: "metal", why: "Claim a spare buffer and re-route the net: metal-only." },
    { id: "q6", change: "Re-architect the multiplier datapath (hundreds of new gates)", context: "far more cells than the seeded spare pool holds", ans: "all", why: "The change dwarfs the spare pool and needs many new devices: a full all-layer respin." }
  ];
  function analyze(answers) {
    var rows = ITEMS.map(function (it, i) { return { answered: answers[i] != null, correct: answers[i] === it.ans }; });
    var answered = rows.every(function (r) { return r.answered; });
    var nCorrect = rows.filter(function (r) { return r.correct; }).length;
    return { rows: rows, answered: answered, nCorrect: nCorrect, total: ITEMS.length, pass: answered && nCorrect === ITEMS.length };
  }
  function evaluate(spec, answers) { return analyze(answers); }

  function mount(container, spec) {
    var answers = ITEMS.map(function () { return null; });
    var submitted = false, scoreObj = null;

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var leftc = document.createElement("div"); leftc.className = "mp-left"; leftc.style.maxWidth = "620px";
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "0 0 10px";
    hint.innerHTML = "The base (transistor) layers are already fabricated. For each proposed change, decide whether it can be done <b>metal-only</b> (re-wire metal and vias, reusing a spare cell) or needs an <b>all-layer respin</b> (new transistors, new mask set). The rule: metal-only when a suitable spare can be wired in, all-layer when new devices must be built. Classify every row, then <b>Submit calls</b>.";
    leftc.appendChild(hint);

    var listWrap = document.createElement("div"); leftc.appendChild(listWrap);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls"; ctrls.style.marginTop = "10px";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit calls";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); leftc.appendChild(ctrls); wrap.appendChild(leftc);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    var OK = "#15803d", BAD = "#dc2626", MET = "#0d9488", ALL = "#b45309", MUT = "#6b7280";
    var rowEls = ITEMS.map(function (it, i) {
      var row = document.createElement("div");
      row.style.cssText = "border:1px solid #e6e3da;border-radius:8px;padding:8px 10px;margin-bottom:8px;background:#fbfaf7";
      var top = document.createElement("div"); top.style.cssText = "font:600 12px/1.4 'Inter',system-ui,sans-serif;color:#1a1d26";
      top.textContent = (i + 1) + ". " + it.change;
      var ctx = document.createElement("div"); ctx.style.cssText = "font:11px/1.4 'Inter',system-ui,sans-serif;color:#6b7280;margin:2px 0 6px";
      ctx.textContent = "context: " + it.context;
      var btns = document.createElement("div"); btns.style.cssText = "display:flex;gap:8px;align-items:center;flex-wrap:wrap";
      var bMetal = document.createElement("button"); bMetal.textContent = "metal-only";
      var bAll = document.createElement("button"); bAll.textContent = "all-layer respin";
      [bMetal, bAll].forEach(function (b) { b.style.cssText = "font:700 11px 'JetBrains Mono',monospace;padding:4px 12px;border-radius:6px;cursor:pointer;border:1.5px solid #c9c6bd;background:#fff;color:#334155"; });
      var verdict = document.createElement("span"); verdict.style.cssText = "font:700 11px 'JetBrains Mono',monospace;margin-left:4px";
      var why = document.createElement("div"); why.style.cssText = "font:11px/1.5 'Inter',system-ui,sans-serif;color:#334155;margin-top:6px;display:none";
      bMetal.addEventListener("click", function () { if (submitted) return; answers[i] = "metal"; scoreObj = null; refresh(); });
      bAll.addEventListener("click", function () { if (submitted) return; answers[i] = "all"; scoreObj = null; refresh(); });
      btns.appendChild(bMetal); btns.appendChild(bAll); btns.appendChild(verdict);
      row.appendChild(top); row.appendChild(ctx); row.appendChild(btns); row.appendChild(why);
      listWrap.appendChild(row);
      return { bMetal: bMetal, bAll: bAll, verdict: verdict, why: why };
    });

    function styleBtn(b, active, activeCol) {
      if (active) b.style.cssText = "font:700 11px 'JetBrains Mono',monospace;padding:4px 12px;border-radius:6px;cursor:pointer;border:1.5px solid " + activeCol + ";background:" + activeCol + ";color:#fff";
      else b.style.cssText = "font:700 11px 'JetBrains Mono',monospace;padding:4px 12px;border-radius:6px;cursor:pointer;border:1.5px solid #c9c6bd;background:#fff;color:#334155";
    }
    function computeScore(res) { var total = Math.round(6000 + (res.nCorrect / res.total) * 4000), best = total; try { var key = "mp-best-" + (spec.id || "eco-respin"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {} return { total: total, best: best }; }
    function drawList(res) {
      ITEMS.forEach(function (it, i) {
        var el = rowEls[i], a = answers[i], r = res.rows[i];
        styleBtn(el.bMetal, a === "metal", MET); styleBtn(el.bAll, a === "all", ALL);
        if (submitted) {
          el.verdict.textContent = r.correct ? "✔ correct" : "✗ should be " + (it.ans === "metal" ? "metal-only" : "all-layer");
          el.verdict.style.color = r.correct ? OK : BAD;
          el.why.style.display = "block"; el.why.textContent = it.why;
        } else { el.verdict.textContent = ""; el.why.style.display = "none"; }
      });
    }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : (submitted ? "mp-fail" : "mp-fail")) + '">' + (submitted ? (res.pass ? "all calls correct" : res.nCorrect + " / " + res.total + " correct") : (res.answered ? "ready to submit" : "classify every row")) + '</div>';
      html += '<div class="mp-row ' + (res.answered ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.answered ? "✔" : "·") + '</span><span class="mp-label">All rows classified</span><span class="mp-detail">' + res.rows.filter(function (x) { return x.answered; }).length + " / " + res.total + '</span></div>';
      if (submitted) html += '<div class="mp-row ' + (res.pass ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.pass ? "✔" : "✗") + '</span><span class="mp-label">Correct calls</span><span class="mp-detail">' + res.nCorrect + " / " + res.total + '</span></div>';
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div><div class="mp-flow-note">Every call is right. The dividing line is whether new transistors are needed: reuse a spare and it is metal-only, build new devices and it is an all-layer respin.</div></div>';
      else if (submitted) html += '<div class="mp-score"><span class="mp-score-note">Some calls are off. Read the reason under each row, then <b>Reset</b> and try again. Ask of each: does this need a new transistor, or just new wire to a spare?</span></div>';
      else if (res.answered) html += '<div class="mp-flow mp-flow-ready"><b>Every row is classified.</b> Click <b>Submit calls</b>.</div>';
      else html += '<div class="mp-score"><span class="mp-score-note">Choose metal-only or all-layer for each change. Metal-only reuses a spare cell with new wiring; all-layer builds new devices.</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, answers); drawList(last); render(last); bSubmit.disabled = submitted || !last.answered; bSubmit.classList.toggle("mp-ready", !submitted && last.answered); }
    bSubmit.addEventListener("click", function () { if (!submitted && last && last.answered) { submitted = true; scoreObj = computeScore(last); refresh(); } });
    bReset.addEventListener("click", function () { answers = ITEMS.map(function () { return null; }); submitted = false; scoreObj = null; refresh(); });
    refresh();
  }

  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.EcoRespin = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
