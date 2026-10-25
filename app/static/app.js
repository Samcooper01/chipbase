/* Chipbase client logic: editors, grading in the browser, the scorecard,
   and the record of solved problems. Uses the vendored CodeMirror editor
   when present and falls back to a plain text area otherwise. */

(function () {
  "use strict";

  /* ----- solved problems, kept in this browser (no accounts) -----
     One storage key maps each problem id to
     { status: "solved" | "attempted", best: points, points: max, at: ISO date }.
     A submission can raise a record but never lower it: once solved, always
     solved, and the best score stays the best. */

  var STORE_KEY = "pdleet-problems";

  function readAll() {
    try {
      var v = JSON.parse(window.localStorage.getItem(STORE_KEY) || "{}");
      return v && typeof v === "object" ? v : {};
    } catch (e) { return {}; }
  }

  function record(id, card) {
    var all = readAll(), prev = all[id] || {};
    all[id] = {
      status: prev.status === "solved" || card.solved ? "solved" : "attempted",
      best: Math.max(prev.best || 0, card.score || 0),
      points: card.points,
      at: new Date().toISOString(),
    };
    try { window.localStorage.setItem(STORE_KEY, JSON.stringify(all)); } catch (e) { return null; }
    return all[id];
  }

  window.ChipbaseProblems = { all: readAll, record: record };

  /* ----- problem page ----- */

  var dataEl = document.getElementById("problem-data");
  if (!dataEl) return; // not on a problem page

  var pdata = JSON.parse(dataEl.textContent);
  var editors = {}; // path -> {get: fn, set: fn}

  function showSolvedChip() {
    var chip = document.getElementById("solved-chip");
    var rec = readAll()[pdata.id];
    if (chip && rec && rec.status === "solved") chip.hidden = false;
  }
  showSolvedChip();

  function buildEditors() {
    var tabsEl = document.getElementById("file-tabs");
    var editorsEl = document.getElementById("editors");
    if (!tabsEl || !editorsEl) return;

    pdata.editable.forEach(function (file, i) {
      var tab = document.createElement("button");
      tab.className = "tab" + (i === 0 ? " active" : "");
      tab.textContent = file.path;
      tab.dataset.path = file.path;
      tabsEl.appendChild(tab);

      var slot = document.createElement("div");
      slot.className = "editor-slot" + (i === 0 ? " active" : "");
      slot.dataset.path = file.path;
      editorsEl.appendChild(slot);

      var starter = pdata.starter[file.path] || "";

      if (window.CodeMirror) {
        var cm = CodeMirror(slot, {
          value: starter,
          mode: file.language === "tcl" ? "tcl" : null,
          theme: "default",
          lineNumbers: true,
          indentUnit: 4,
          viewportMargin: Infinity,
        });
        editors[file.path] = {
          get: function () { return cm.getValue(); },
          set: function (v) { cm.setValue(v); },
          refresh: function () { cm.refresh(); },
        };
      } else {
        var ta = document.createElement("textarea");
        ta.className = "fallback-editor";
        ta.spellcheck = false;
        ta.value = starter;
        slot.appendChild(ta);
        editors[file.path] = {
          get: function () { return ta.value; },
          set: function (v) { ta.value = v; },
          refresh: function () {},
        };
      }

      tab.addEventListener("click", function () {
        tabsEl.querySelectorAll(".tab").forEach(function (t) { t.classList.remove("active"); });
        editorsEl.querySelectorAll(".editor-slot").forEach(function (s) { s.classList.remove("active"); });
        tab.classList.add("active");
        slot.classList.add("active");
        editors[file.path].refresh();
      });
    });
  }

  if (pdata.kind === "files") buildEditors();

  var resetBtn = document.getElementById("btn-reset");
  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      pdata.editable.forEach(function (file) {
        editors[file.path].set(pdata.starter[file.path] || "");
      });
    });
  }

  /* ----- grading ----- */

  var runBtn = document.getElementById("btn-run");
  var submitBtn = document.getElementById("btn-submit");
  var statusEl = document.getElementById("run-status");
  var resultsEl = document.getElementById("results");

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = String(s);
    return d.innerHTML;
  }

  function collectSubmission() {
    if (pdata.kind === "numeric") {
      var v = document.getElementById("numeric-answer").value;
      return { answer: v === "" ? null : parseFloat(v) };
    }
    var files = {};
    pdata.editable.forEach(function (file) {
      files[file.path] = editors[file.path].get();
    });
    return { files: files };
  }

  function renderCard(card, recorded) {
    var html = "";
    if (!card.ok) {
      html += '<div class="banner banner-rejected">Grading error</div>';
      html += '<div class="error-box">' + esc(card.error || "unknown error") + "</div>";
      if (card.log_tail) {
        html += '<details class="log-box"><summary>tool log (tail)</summary><pre>' +
          esc(card.log_tail) + "</pre></details>";
      }
      resultsEl.innerHTML = html;
      resultsEl.classList.remove("hidden");
      return;
    }

    if (card.solved) {
      html += '<div class="banner banner-accepted">✓ Accepted - ' + card.score + " / " +
        card.points + " pts" + (recorded ? "<small>saved in this browser</small>" : "") + "</div>";
    } else {
      html += '<div class="banner banner-rejected">✗ Not accepted - ' + card.score + " / " +
        card.points + " pts" + (recorded ? "<small>saved in this browser</small>" : "") + "</div>";
    }

    html += '<ul class="check-list">';
    card.checks.forEach(function (c) {
      html += '<li class="' + (c.passed ? "check-pass" : "check-fail") + '">' +
        '<span class="check-mark">' + (c.passed ? "✓" : "✗") + "</span>" +
        '<span class="check-label">' + esc(c.label) +
        ' <span class="check-detail">' + esc(c.detail) + "</span></span></li>";
    });
    html += "</ul>";

    var metricKeys = Object.keys(card.metrics || {});
    if (metricKeys.length) {
      html += '<table class="metrics-table">';
      metricKeys.forEach(function (k) {
        html += "<tr><td>" + esc(k) + "</td><td>" + esc(card.metrics[k]) + "</td></tr>";
      });
      html += "</table>";
    }

    if (card.notes && card.notes.length) {
      html += '<ul class="notes-list">';
      card.notes.forEach(function (n) { html += "<li>" + esc(n) + "</li>"; });
      html += "</ul>";
    }

    if (card.log_tail) {
      html += '<details class="log-box"><summary>tool log (tail)</summary><pre>' +
        esc(card.log_tail) + "</pre></details>";
    }

    resultsEl.innerHTML = html;
    resultsEl.classList.remove("hidden");
  }

  /* Grading runs in a module worker (static/grader/worker.js), kept between
     runs so the Tcl runtime loads once. The clock starts when the worker
     reports the evaluator has started; past TIMEOUT_S the worker is stopped
     and a fresh one is made for the next run. */
  var TIMEOUT_S = 10;
  var LOAD_TIMEOUT_S = 60;
  var worker = null;

  function freshWorker() {
    if (worker) worker.terminate();
    worker = new Worker(pdata.worker_url, { type: "module" });
    return worker;
  }

  function gradeInWorker(submission) {
    return new Promise(function (resolve) {
      var w = worker || freshWorker();
      var timer = null;
      function finish(card, broken) {
        clearTimeout(timer);
        w.onmessage = null;
        w.onerror = null;
        if (broken) { w.terminate(); if (worker === w) worker = null; }
        resolve(card);
      }
      function stopped(message) {
        finish({ ok: false, error: message, points: pdata.points }, true);
      }
      timer = setTimeout(function () {
        stopped("the grader did not load within " + LOAD_TIMEOUT_S + " seconds - check your connection and try again");
      }, LOAD_TIMEOUT_S * 1000);
      w.onmessage = function (e) {
        if (e.data.type === "started") {
          clearTimeout(timer);
          timer = setTimeout(function () {
            stopped(pdata.engine === "script"
              ? "your script did not finish within " + TIMEOUT_S + " seconds - infinite loop?"
              : "the grading run timed out");
          }, TIMEOUT_S * 1000);
        } else if (e.data.type === "card") {
          finish(e.data.card, false);
        }
      };
      w.onerror = function (e) {
        stopped("the grader could not start: " + (e.message || "the browser refused to run it"));
      };
      w.postMessage({ problem: pdata, submission: submission, evaluatorUrl: pdata.evaluator_url });
    });
  }

  function doGrade(save) {
    runBtn.disabled = true;
    submitBtn.disabled = true;
    statusEl.textContent = "grading…";
    gradeInWorker(collectSubmission()).then(function (card) {
      statusEl.textContent = card.elapsed_s !== undefined ? card.elapsed_s + " s" : "";
      var saved = save && card.ok ? record(pdata.id, card) : null;
      renderCard(card, !!saved);
      if (saved) showSolvedChip();
    }).finally(function () {
      runBtn.disabled = false;
      submitBtn.disabled = false;
    });
  }

  if (runBtn) runBtn.addEventListener("click", function () { doGrade(false); });
  if (submitBtn) submitBtn.addEventListener("click", function () { doGrade(true); });
})();
