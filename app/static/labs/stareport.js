/* STA: reading a real timing report. The report is verbatim report_checks
   output from OpenROAD / OpenSTA on the ASAP7 predictive PDK (a PipeMesh
   design). The learner reads it and answers questions that require
   interpreting it: setup vs hold (Path Type), the clock period (which the report
   does NOT print as a number - it is the capture clock edge minus the launch
   clock edge), and the slack (data required time - data arrival time, which the
   tool then prints as the slack line). window.StaReport = { evaluate, mount }. */
(function () {
  "use strict";
  function evaluate(spec, answers) {
    var perQ = spec.questions.map(function (q, i) { return answers[i] != null && answers[i] === q.correct; });
    var allCorrect = perQ.every(function (b) { return b; }) && answers.length === spec.questions.length;
    return { perQ: perQ, allCorrect: allCorrect, pass: allCorrect };
  }
  function mount(container, spec) {
    var answers = spec.questions.map(function () { return null; }), submitted = false, scoreObj = null;

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";

    /* source caption with tool citations (first mention) */
    var cap = document.createElement("div"); cap.style.cssText = "font-size:11px;color:#5a606e;margin:0 0 6px";
    cap.innerHTML = 'Real <code>report_checks</code> output from <a href="https://theopenroadproject.org" target="_blank" rel="noopener">OpenROAD</a> / <a href="https://github.com/parallaxsw/OpenSTA" target="_blank" rel="noopener">OpenSTA</a> &middot; ' + spec.source;
    left.appendChild(cap);

    /* report viewer: verbatim monospace, terminal styling */
    var view = document.createElement("pre");
    view.style.cssText = "background:#1b1e27;color:#d7dbe4;border:1px solid #2c2f3a;border-radius:6px;padding:12px 14px;margin:0;overflow-x:auto;font:12px/1.5 'JetBrains Mono',monospace;white-space:pre;max-height:none";
    var lines = spec.reportText.split("\n");
    lines.forEach(function (ln) {
      var span = document.createElement("span"); span.style.display = "block";
      if (/slack \(MET\)/.test(ln)) { span.style.color = "#6ee7a8"; span.style.fontWeight = "700"; }
      else if (/slack \(VIOLATED\)/.test(ln)) { span.style.color = "#ff7a7a"; span.style.fontWeight = "700"; }
      else if (/^(Startpoint|Endpoint|Path Type|Path Group):/.test(ln)) { span.style.color = "#9ecbff"; }
      else if (/^Fanout|^-----/.test(ln)) { span.style.color = "#6b7280"; }
      span.textContent = ln.length ? ln : " ";
      view.appendChild(span);
    });
    left.appendChild(view);

    /* questions */
    var qWrap = document.createElement("div"); qWrap.style.marginTop = "12px";
    var qEls = spec.questions.map(function (q, qi) {
      var card = document.createElement("div"); card.style.cssText = "margin-bottom:10px";
      var qt = document.createElement("div"); qt.className = "mp-legend-title"; qt.style.display = "block"; qt.style.margin = "0 0 5px";
      qt.textContent = (qi + 1) + ". " + q.q; card.appendChild(qt);
      var row = document.createElement("div"); row.className = "mp-controls";
      var btns = q.opts.map(function (opt, oi) {
        var b = document.createElement("button"); b.className = "btn"; b.textContent = opt;
        b.addEventListener("click", function () { if (!submitted) { answers[qi] = oi; refresh(); } });
        row.appendChild(b); return b;
      });
      card.appendChild(row); qWrap.appendChild(card); return { btns: btns };
    });
    left.appendChild(qWrap);

    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit answers";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    function computeScore() { var total = 10000, best = total; try { var key = "mp-best-" + (spec.id || "sta-report"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {} return { total: total, best: best }; }
    function render(res) {
      var html;
      if (!submitted) {
        var answered = answers.filter(function (a) { return a != null; }).length;
        html = '<div class="mp-verdict" style="background:#eceae2;color:#5a606e">read the report</div>';
        html += '<div class="mp-score"><span class="mp-score-note">' + spec.hint + '</span></div>';
        html += '<div class="mp-score"><span class="mp-score-note" style="font-size:11px">' + answered + " / " + spec.questions.length + ' answered</span></div>';
      } else {
        var nOK = res.perQ.filter(function (b) { return b; }).length, ok = res.allCorrect;
        html = '<div class="mp-verdict ' + (ok ? "mp-pass" : "mp-fail") + '">' + (ok ? "correct" : nOK + " / " + spec.questions.length) + '</div>';
        spec.questions.forEach(function (q, i) {
          var good = res.perQ[i];
          html += '<div class="mp-row ' + (good ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (good ? "✔" : "✗") + '</span><span class="mp-label">Q' + (i + 1) + ' &middot; ' + q.opts[q.correct] + '</span></div>';
          html += '<div class="mp-score"><span class="mp-score-note" style="font-size:11px">' + q.why + '</span></div>';
        });
        if (ok && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div><div class="mp-flow-note">You read a real sign-off report: max = setup, the period is the capture edge minus the launch edge, and slack = required &minus; arrival.</div></div>';
        else if (!ok) html += '<div class="mp-score"><span class="mp-score-note">Re-read the highlighted parts of the report and try again.</span></div>';
      }
      panel.innerHTML = html;
    }
    function refresh() {
      qEls.forEach(function (qe, qi) { qe.btns.forEach(function (b, oi) {
        var cls = "btn";
        if (submitted) { if (oi === spec.questions[qi].correct) cls += " mp-ready"; else if (answers[qi] === oi) cls += ""; b.disabled = true; }
        else if (answers[qi] === oi) cls += " mp-submit";
        if (submitted && answers[qi] === oi && oi !== spec.questions[qi].correct) b.style.outline = "2px solid #dc2626"; else b.style.outline = "";
        b.className = cls;
      }); });
      bSubmit.disabled = submitted || answers.some(function (a) { return a == null; });
      render(evaluate(spec, answers));
    }
    bSubmit.addEventListener("click", function () { if (!submitted && answers.every(function (a) { return a != null; })) { submitted = true; if (evaluate(spec, answers).allCorrect) scoreObj = computeScore(); refresh(); } });
    bReset.addEventListener("click", function () { answers = spec.questions.map(function () { return null; }); submitted = false; scoreObj = null; qEls.forEach(function (qe) { qe.btns.forEach(function (b) { b.style.outline = ""; }); }); refresh(); });
    refresh();
  }
  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.StaReport = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
