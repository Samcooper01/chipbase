/* Physical Verification lab: pv-device-match (LVS device matching).
   After LVS (Layout Versus Schematic) matches the connectivity, it pairs the
   devices found in the layout with the devices in the schematic and checks that
   each pair agrees: same device type (NMOS vs PMOS) and same size (width and
   length). A device can also be missing (in the schematic, not the layout) or
   extra (in the layout, not the schematic). The learner classifies each device.
   window.PvDevice = { evaluate, mount }. */
(function () {
  "use strict";
  var OPTIONS = ["match", "wrong size", "wrong type", "missing", "extra"];
  var OPTCOL = ["#15803d", "#b45309", "#dc2626", "#7c3aed", "#0f9d8c"];
  /* each device: schematic spec and extracted (layout) spec; null = not present on that side */
  var DEVICES = [
    { id: "M1", sch: { t: "NMOS", w: 0.20, l: 0.05 }, ext: { t: "NMOS", w: 0.20, l: 0.05 } },
    { id: "M2", sch: { t: "PMOS", w: 0.40, l: 0.05 }, ext: { t: "PMOS", w: 0.30, l: 0.05 } },
    { id: "M3", sch: { t: "NMOS", w: 0.15, l: 0.05 }, ext: { t: "PMOS", w: 0.15, l: 0.05 } },
    { id: "M4", sch: { t: "NMOS", w: 0.25, l: 0.05 }, ext: null },
    { id: "M5", sch: null, ext: { t: "NMOS", w: 0.10, l: 0.05 } },
    { id: "M6", sch: { t: "PMOS", w: 0.60, l: 0.10 }, ext: { t: "PMOS", w: 0.60, l: 0.10 } },
    { id: "M7", sch: { t: "NMOS", w: 0.20, l: 0.05 }, ext: { t: "NMOS", w: 0.20, l: 0.10 } }
  ];
  function correctOf(d) {
    if (d.sch && !d.ext) return 3;               // missing
    if (!d.sch && d.ext) return 4;               // extra
    if (d.sch.t !== d.ext.t) return 2;           // wrong type
    if (d.sch.w !== d.ext.w || d.sch.l !== d.ext.l) return 1; // wrong size
    return 0;                                    // match
  }
  function evaluate(spec, choices) {
    var wrong = [];
    DEVICES.forEach(function (d, i) { if (choices[i] !== correctOf(d)) wrong.push(i); });
    return { wrong: wrong, pass: wrong.length === 0 };
  }

  function mount(container, spec) {
    var choices = DEVICES.map(function () { return 0; }), submitted = false, scoreObj = null;

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left"; left.style.maxWidth = "640px";
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "0 0 8px";
    hint.innerHTML = "LVS has paired each layout device with its schematic device. Compare the two sides and click a row to set its verdict: <b>match</b>, <b>wrong size</b> (width or length differ), <b>wrong type</b> (NMOS vs PMOS), <b>missing</b> (in the schematic, not the layout), or <b>extra</b> (in the layout, not the schematic). Dimensions in micrometres.";
    left.appendChild(hint);

    function specStr(s) { return s ? (s.t + "  W " + s.w.toFixed(2) + "  L " + s.l.toFixed(2)) : "—  (no device)"; }
    var table = document.createElement("table");
    table.style.cssText = "border-collapse:collapse;font:12px/1.5 'JetBrains Mono',monospace;width:100%";
    var head = document.createElement("tr");
    head.innerHTML = '<th style="text-align:left;padding:4px 8px;color:#5a606e;font-size:10px">device</th>'
      + '<th style="text-align:left;padding:4px 8px;color:#5a606e;font-size:10px">schematic</th>'
      + '<th style="text-align:left;padding:4px 8px;color:#5a606e;font-size:10px">extracted (layout)</th>'
      + '<th style="text-align:left;padding:4px 8px;color:#5a606e;font-size:10px">your verdict</th>';
    table.appendChild(head);
    var rowEls = DEVICES.map(function (d, i) {
      var tr = document.createElement("tr"); tr.style.cssText = "cursor:pointer;border-top:1px solid #e6e3da";
      tr.addEventListener("click", function () { if (submitted) return; choices[i] = (choices[i] + 1) % OPTIONS.length; refresh(); });
      var mismatch = d.sch && d.ext && (d.sch.t !== d.ext.t || d.sch.w !== d.ext.w || d.sch.l !== d.ext.l);
      tr.innerHTML = '<td style="padding:6px 8px;font-weight:700">' + d.id + '</td>'
        + '<td style="padding:6px 8px;color:' + (d.sch ? "#1a1d26" : "#9aa0aa") + '">' + specStr(d.sch) + '</td>'
        + '<td style="padding:6px 8px;color:' + (d.ext ? "#1a1d26" : "#9aa0aa") + '">' + specStr(d.ext) + '</td>'
        + '<td style="padding:6px 8px" data-verdict></td>';
      table.appendChild(tr); return tr;
    });
    left.appendChild(table);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls"; ctrls.style.marginTop = "10px";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit verdicts";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    function computeScore() { var total = 10000, best = total; try { var key = "mp-best-" + (spec.id || "pv-device-match"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {} return { total: total, best: best }; }
    function drawVerdicts() {
      DEVICES.forEach(function (d, i) {
        var cell = rowEls[i].querySelector("[data-verdict]"), ch = choices[i], col = OPTCOL[ch];
        var mark = "";
        if (submitted) { var ok = ch === correctOf(d); mark = ' <span style="color:' + (ok ? "#15803d" : "#dc2626") + '">' + (ok ? "✔" : "✗") + '</span>'; }
        cell.innerHTML = '<span style="display:inline-block;min-width:78px;text-align:center;padding:2px 8px;border-radius:10px;font-weight:700;color:#fff;background:' + col + '">' + OPTIONS[ch] + '</span>' + mark;
      });
    }
    function render(res) {
      var html;
      if (!submitted) {
        html = '<div class="mp-verdict" style="background:#eceae2;color:#5a606e">classify each device</div>';
        html += '<div class="mp-score"><span class="mp-score-note">Check the type and both dimensions on every paired device, and watch for a device present on only one side.</span></div>';
      } else {
        var nOK = DEVICES.length - res.wrong.length;
        html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "correct" : nOK + " / " + DEVICES.length) + '</div>';
        DEVICES.forEach(function (d, i) {
          var good = res.wrong.indexOf(i) < 0;
          html += '<div class="mp-row ' + (good ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (good ? "✔" : "✗") + '</span><span class="mp-label">' + d.id + '</span><span class="mp-detail">' + OPTIONS[correctOf(d)] + '</span></div>';
        });
        if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div><div class="mp-flow-note">Every device matched by type and size, with no missing or extra device. LVS device check is clean.</div></div>';
        else if (!res.pass) html += '<div class="mp-score"><span class="mp-score-note">Red rows are misjudged. A device can match connectivity yet differ in size or type, and a device on only one side is missing or extra.</span></div>';
      }
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, choices); drawVerdicts(); rowEls.forEach(function (tr, i) { tr.style.background = submitted ? (choices[i] === correctOf(DEVICES[i]) ? "rgba(21,128,61,0.06)" : "rgba(220,38,38,0.06)") : "transparent"; }); render(last); bSubmit.disabled = submitted; bSubmit.classList.toggle("mp-ready", !submitted); }
    bSubmit.addEventListener("click", function () { if (!submitted) { submitted = true; if (evaluate(spec, choices).pass) scoreObj = computeScore(); refresh(); } });
    bReset.addEventListener("click", function () { choices = DEVICES.map(function () { return 0; }); submitted = false; scoreObj = null; refresh(); });
    refresh();
  }

  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.PvDevice = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
