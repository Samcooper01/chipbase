/* Physical Verification lab: pv-signoff (tapeout sign-off gate).
   The final go / no-go review, as a judgment problem. Each check reports a
   status, but the status alone does not decide the outcome. The learner reads
   the context and gives each check the right disposition:
     - SIGN OFF: genuinely clean AND run on the current database.
     - WAIVE: has violations, but a valid waiver applies (vendor IP with a signed
       waiver, or structures outside the die such as scribe-line monitors).
     - FIX: a real blocker - an open violation with no waiver, a functional
       mismatch that cannot be waived (LVS), or a "clean" result that is STALE
       (run before the last change), which must be re-run.
   Traps: a green "clean" pill can still be stale, an LVS waiver must be refused,
   and a violation pill can be a legitimate waiver. window.PvSignoff = {evaluate, mount}. */
(function () {
  "use strict";
  var CHECKS = [
    { id: "drc_ip", name: "DRC — SRAM macro", status: "12 violations", ok: false, note: "All inside the licensed SRAM macro; vendor waiver SR-4471 is on file and current.", correct: "waive" },
    { id: "drc_sig", name: "DRC — signal route", status: "1 violation", ok: false, note: "Metal-2 spacing on net clk_div. No waiver.", correct: "fix" },
    { id: "lvs", name: "LVS", status: "1 mismatch", ok: false, note: "One device mismatch. The block owner has requested a waiver to save a respin.", correct: "fix" },
    { id: "ant", name: "Antenna", status: "2 violations", ok: false, note: "On scribe-line process-monitor structures, outside the die seal ring.", correct: "waive" },
    { id: "den", name: "Density and fill", status: "clean", ok: true, note: "All windows in band, run on tonight's final database.", correct: "signoff" },
    { id: "erc", name: "ERC", status: "clean", ok: true, note: "Clean, but this run predates the last timing ECO. The database has changed since.", correct: "fix" },
    { id: "em", name: "Electromigration", status: "clean", ok: true, note: "Clean on the final database.", correct: "signoff" }
  ];
  var OPTS = [["signoff", "Sign off"], ["waive", "Waive"], ["fix", "Fix"]];
  var OCOL = { signoff: "#15803d", waive: "#b45309", fix: "#dc2626" };
  function evaluate(spec, choices) {
    var wrong = [];
    CHECKS.forEach(function (c) { if (choices[c.id] !== c.correct) wrong.push(c.id); });
    var chosen = CHECKS.filter(function (c) { return choices[c.id]; }).length;
    return { wrong: wrong, chosen: chosen, allChosen: chosen === CHECKS.length, pass: wrong.length === 0 && chosen === CHECKS.length };
  }

  function mount(container, spec) {
    var choices = {}, submitted = false, scoreObj = null;

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left"; left.style.maxWidth = "620px";
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "0 0 10px";
    hint.innerHTML = "The tapeout gate. For each check, read the note and give it a disposition: <b>Sign off</b> (clean and run on the current database), <b>Waive</b> (has violations but a valid waiver applies), or <b>Fix</b> (a real blocker). The status pill alone is not enough: a violation can be validly waived, a functional (LVS) mismatch can never be waived, and a “clean” result run before the last change is stale and must be re-run.";
    left.appendChild(hint);
    var list = document.createElement("div"); list.style.cssText = "display:flex;flex-direction:column;gap:8px"; left.appendChild(list);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls"; ctrls.style.marginTop = "12px";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit sign-off";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    function statusPill(c) {
      var bg = c.ok ? "rgba(21,128,61,0.15)" : "rgba(220,38,38,0.15)", fg = c.ok ? "#15803d" : "#dc2626";
      return '<span style="display:inline-block;padding:2px 9px;border-radius:11px;font:700 10px \'JetBrains Mono\',monospace;background:' + bg + ';color:' + fg + '">' + c.status + '</span>';
    }
    function drawList() {
      list.innerHTML = "";
      CHECKS.forEach(function (c) {
        var row = document.createElement("div");
        var bad = submitted && choices[c.id] !== c.correct;
        row.style.cssText = "border:1px solid " + (submitted ? (bad ? "#dc2626" : "#15803d") : "#e6e3da") + ";border-radius:8px;padding:9px 12px;background:" + (submitted ? (bad ? "rgba(220,38,38,0.05)" : "rgba(21,128,61,0.05)") : "#faf9f5");
        var head = document.createElement("div"); head.style.cssText = "display:flex;align-items:center;gap:10px;margin-bottom:3px";
        head.innerHTML = '<span style="font:700 12px \'JetBrains Mono\',monospace;color:#1a1d26;min-width:180px">' + c.name + '</span>' + statusPill(c);
        row.appendChild(head);
        var note = document.createElement("div"); note.style.cssText = "font:11px/1.4 'JetBrains Mono',monospace;color:#5a606e;margin-bottom:6px"; note.textContent = c.note; row.appendChild(note);
        var brow = document.createElement("div"); brow.style.cssText = "display:flex;gap:6px;align-items:center";
        OPTS.forEach(function (o) {
          var b = document.createElement("button"); b.textContent = o[1];
          var sel = choices[c.id] === o[0];
          b.style.cssText = "font:700 11px 'JetBrains Mono',monospace;padding:3px 12px;border-radius:6px;cursor:pointer;border:1.5px solid " + (sel ? OCOL[o[0]] : "#c9c6bd") + ";background:" + (sel ? OCOL[o[0]] : "#fff") + ";color:" + (sel ? "#fff" : "#5a606e");
          b.addEventListener("click", function () { if (submitted) return; choices[c.id] = o[0]; refresh(); });
          brow.appendChild(b);
        });
        if (submitted) { var tag = document.createElement("span"); tag.style.cssText = "margin-left:8px;font:700 11px 'JetBrains Mono',monospace;color:" + (bad ? "#dc2626" : "#15803d"); tag.textContent = bad ? "✗ " + OPTS.filter(function (o) { return o[0] === c.correct; })[0][1] : "✔"; brow.appendChild(tag); }
        row.appendChild(brow); list.appendChild(row);
      });
    }
    function computeScore() { var total = 10000, best = total; try { var key = "mp-best-" + (spec.id || "pv-signoff"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {} return { total: total, best: best }; }
    function render(res) {
      var html;
      if (!submitted) {
        html = '<div class="mp-verdict" style="background:#eceae2;color:#5a606e">disposition each check</div>';
        html += '<div class="mp-score"><span class="mp-score-note">Do not just react to the pill. A violation may carry a valid waiver, an LVS mismatch can never be waived, and a stale “clean” must be re-run.</span></div>';
        html += '<div class="mp-score"><span class="mp-score-note" style="font-size:11px">' + res.chosen + " / " + CHECKS.length + ' dispositioned</span></div>';
      } else {
        var nOK = CHECKS.length - res.wrong.length;
        html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "signed off" : nOK + " / " + CHECKS.length) + '</div>';
        if (res.pass && scoreObj) {
          var fixes = CHECKS.filter(function (c) { return c.correct === "fix"; }).length, waivers = CHECKS.filter(function (c) { return c.correct === "waive"; }).length;
          html += '<div class="mp-row mp-ok"><span class="mp-mark">✔</span><span class="mp-label">Blockers sent back to fix</span><span class="mp-detail">' + fixes + '</span></div>';
          html += '<div class="mp-row mp-ok"><span class="mp-mark">✔</span><span class="mp-label">Valid waivers accepted</span><span class="mp-detail">' + waivers + '</span></div>';
          html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div><div class="mp-flow-note">You refused the LVS waiver and the stale ERC sign-off, fixed the real violations, and accepted only the legitimate waivers. Once the blockers return clean the chip is cleared to tape out.</div></div>';
        } else {
          html += '<div class="mp-row mp-bad"><span class="mp-mark">✗</span><span class="mp-label">Wrong dispositions</span><span class="mp-detail">' + res.wrong.length + '</span></div>';
          html += '<div class="mp-score"><span class="mp-score-note">Red rows are misjudged. Re-read their notes: a functional (LVS) mismatch is never waivable, a clean result that predates the last change is stale (fix / re-run), a vendor-IP or outside-die violation with a valid waiver is waivable, and only a current clean check is signed off.</span></div>';
        }
      }
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, choices); drawList(); render(last); bSubmit.disabled = submitted || !last.allChosen; bSubmit.classList.toggle("mp-ready", !submitted && last.allChosen); }
    bSubmit.addEventListener("click", function () { if (!submitted && last && last.allChosen) { submitted = true; if (evaluate(spec, choices).pass) scoreObj = computeScore(); refresh(); } });
    bReset.addEventListener("click", function () { choices = {}; submitted = false; scoreObj = null; refresh(); });
    refresh();
  }

  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.PvSignoff = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
