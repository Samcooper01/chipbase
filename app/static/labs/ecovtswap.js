/* ECO lab: eco-vtswap (threshold-voltage swap).
   A multi-Vt library carries each cell in several threshold-voltage flavours. A
   LOWER threshold makes the cell faster (less delay) but leaks much more. A path
   built entirely of high-Vt (HVT) cells misses setup; the ECO swaps cells to a
   faster flavour to close it, spending the least leakage. Making every cell the
   fastest (LVT) meets timing but blows the leakage budget, so the move is to
   swap only the critical (largest-delay) cells, and only as far down in Vt as
   needed. window.EcoVtSwap = { evaluate, mount }. */
(function () {
  "use strict";
  var TCQ = 0.3, REQUIRED = 4.0, BUDGET = 12;
  var VT = [
    { key: "HVT", dfac: 1.0, leak: 1, col: "#15803d" },
    { key: "SVT", dfac: 0.78, leak: 3, col: "#b45309" },
    { key: "LVT", dfac: 0.62, leak: 9, col: "#dc2626" }
  ];
  var CELLS = [
    { id: "U1", cell: "INV", d: 1.2 }, { id: "U2", cell: "NAND2", d: 0.6 },
    { id: "U3", cell: "NOR2", d: 1.0 }, { id: "U4", cell: "AOI21", d: 0.5 },
    { id: "U5", cell: "BUF", d: 0.9 }
  ];
  function analyze(vt) {
    var arr = TCQ, leak = 0, rows = [];
    CELLS.forEach(function (c, i) { var del = c.d * VT[vt[i]].dfac; arr += del; leak += VT[vt[i]].leak; rows.push({ del: del, arr: arr }); });
    var slack = REQUIRED - arr;
    return { rows: rows, arrival: arr, slack: slack, leak: leak, timeOK: slack >= -1e-9, budgetOK: leak <= BUDGET, pass: slack >= -1e-9 && leak <= BUDGET };
  }
  function evaluate(spec, vt) { return analyze(vt); }

  function mount(container, spec) {
    var vt = CELLS.map(function () { return 0; }), submitted = false, scoreObj = null;

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left"; left.style.maxWidth = "560px";
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "0 0 8px";
    hint.innerHTML = "The path is all high-Vt (HVT) cells and misses setup. Click a cell's Vt to cycle <b>HVT &rarr; SVT &rarr; LVT</b>: a lower threshold cuts that cell's delay but leaks more (HVT 1x, SVT 3x, LVT 9x). Close setup (slack &ge; 0) while staying under the leakage budget (" + BUDGET + "). Swapping every cell to LVT meets timing but busts the budget, so swap only the cells that matter, and only as far as needed.";
    left.appendChild(hint);
    var table = document.createElement("table"); table.style.cssText = "border-collapse:collapse;font:12px/1.5 'JetBrains Mono',monospace;width:100%";
    var head = document.createElement("tr");
    head.innerHTML = '<th style="text-align:left;padding:3px 8px;color:#5a606e;font-size:10px">cell</th>'
      + '<th style="text-align:left;padding:3px 8px;color:#5a606e;font-size:10px">Vt</th>'
      + '<th style="text-align:right;padding:3px 8px;color:#5a606e;font-size:10px">delay</th>'
      + '<th style="text-align:right;padding:3px 8px;color:#5a606e;font-size:10px">arrival</th>'
      + '<th style="text-align:right;padding:3px 8px;color:#5a606e;font-size:10px">leak</th>';
    table.appendChild(head);
    var bodyRows = CELLS.map(function () { var tr = document.createElement("tr"); tr.style.borderTop = "1px solid #e6e3da"; table.appendChild(tr); return tr; });
    left.appendChild(table);
    var summ = document.createElement("div"); summ.style.cssText = "margin-top:10px;font:12px/1.6 'JetBrains Mono',monospace"; left.appendChild(summ);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls"; ctrls.style.marginTop = "10px";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit swaps";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    function computeScore(res) { var total = Math.round(Math.max(4000, Math.min(10000, 10000 - (res.leak - 10) * 500))), best = total; try { var key = "mp-best-" + (spec.id || "eco-vtswap"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {} return { total: total, best: best }; }
    function drawTable(res) {
      CELLS.forEach(function (c, i) {
        var v = VT[vt[i]], tr = bodyRows[i];
        tr.innerHTML = '<td style="padding:5px 8px;font-weight:700">' + c.id + " " + c.cell + '</td>'
          + '<td style="padding:5px 8px" data-vt></td>'
          + '<td style="padding:5px 8px;text-align:right">' + res.rows[i].del.toFixed(2) + '</td>'
          + '<td style="padding:5px 8px;text-align:right;font-weight:700">' + res.rows[i].arr.toFixed(2) + '</td>'
          + '<td style="padding:5px 8px;text-align:right;color:' + (v.leak >= 9 ? "#dc2626" : v.leak >= 3 ? "#b45309" : "#15803d") + '">' + v.leak + 'x</td>';
        var cellV = tr.querySelector("[data-vt]");
        var btn = document.createElement("button"); btn.textContent = v.key;
        btn.style.cssText = "font:700 11px 'JetBrains Mono',monospace;padding:2px 12px;border-radius:6px;cursor:pointer;color:#fff;border:none;background:" + v.col;
        btn.addEventListener("click", function () { if (submitted) return; vt[i] = (vt[i] + 1) % 3; scoreObj = null; refresh(); });
        cellV.appendChild(btn);
      });
    }
    function bar(label, val, lim, invert) {
      var ok = invert ? val <= lim + 1e-9 : val >= -1e-9;
      var col = ok ? "#15803d" : "#dc2626";
      var detail = invert ? val + " / " + lim : (val >= 0 ? "+" : "") + val.toFixed(2);
      return '<div style="display:flex;justify-content:space-between"><span>' + label + '</span><span style="font-weight:700;color:' + col + '">' + detail + '</span></div>';
    }
    function render(res) {
      summ.innerHTML = bar("setup slack (required " + REQUIRED.toFixed(1) + " - arrival " + res.arrival.toFixed(2) + ")", res.slack, 0, false)
        + bar("total leakage vs budget", res.leak, BUDGET, true);
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "closed" : "not yet") + '</div>';
      html += '<div class="mp-row ' + (res.timeOK ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.timeOK ? "✔" : "✗") + '</span><span class="mp-label">Setup met</span><span class="mp-detail">' + (res.slack >= 0 ? "+" : "") + res.slack.toFixed(2) + '</span></div>';
      html += '<div class="mp-row ' + (res.budgetOK ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.budgetOK ? "✔" : "✗") + '</span><span class="mp-label">Leakage in budget</span><span class="mp-detail">' + res.leak + " / " + BUDGET + '</span></div>';
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div><div class="mp-flow-note">Setup closed with the least leakage: the biggest-delay cells swapped to SVT, the small ones left HVT, and no LVT spent where SVT was enough.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>Closed within budget.</b> Less leakage scores higher. Click <b>Submit swaps</b>.</div>';
      else if (!res.timeOK) html += '<div class="mp-score"><span class="mp-score-note">Still too slow. Swap the largest-delay cells to a faster Vt (SVT first). Their delay drops the most for the leakage spent.</span></div>';
      else html += '<div class="mp-score"><span class="mp-score-note">Over the leakage budget: you swapped too many cells, or reached for LVT (9x) where SVT (3x) would do. Back off the least useful swaps.</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, vt); drawTable(last); render(last); bSubmit.disabled = submitted || !last.pass; bSubmit.classList.toggle("mp-ready", !submitted && last.pass); }
    bSubmit.addEventListener("click", function () { if (!submitted && last && last.pass) { submitted = true; scoreObj = computeScore(last); refresh(); } });
    bReset.addEventListener("click", function () { vt = CELLS.map(function () { return 0; }); submitted = false; scoreObj = null; refresh(); });
    refresh();
  }

  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.EcoVtSwap = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
