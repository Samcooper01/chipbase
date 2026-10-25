/* The engine behind every worked-example flow page (floorplanning,
   placement, clock tree synthesis, routing, timing analysis).

   A stage supplies only its content, as window.FLOW_STAGE:
     key      a short name, used for the saved-progress key
     steps    [{ n, title, line, intro, command, commandNote, reference,
                 button, run, widget, onShow }]
     epilogue optional closing panel, shown with the finished banner
   where `line` is the one-liner in the step track, `command` and
   `commandNote` may be strings or functions of the stage model, `run`
   returns { log, figure, report }, `widget` is extra markup placed
   above the command, and `onShow` runs once its workspace exists.

   Everything else (the track, unlocking, the log, the drawings, the
   reports, saved progress) is here and identical on every page. */

(function () {
  "use strict";

  var S = window.FLOW_STAGE;
  if (!S) return;
  var STEPS = S.steps;
  var LAST = STEPS[STEPS.length - 1].n;
  var STORE = "pdleet." + S.key + ".progress";

  var done = {};
  var viewing = STEPS[0].n;
  var busy = {};

  function esc(t) { return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function val(v) { return typeof v === "function" ? v() : v; }

  /* a script may carry comments explaining the order of its commands;
     they are shown the way an editor would show them, set back from the
     commands themselves */
  function script(t) {
    return String(t).split("\n").map(function (line) {
      var e = esc(line);
      return /^\s*#/.test(line) ? '<span class="ff-sc-note">' + e + "</span>" : e;
    }).join("\n");
  }

  function load() {
    try { done = JSON.parse(localStorage.getItem(STORE) || "{}") || {}; } catch (e) { done = {}; }
  }
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(done)); } catch (e) { /* private window: progress just is not kept */ }
  }

  /* ----- the page skeleton ----- */

  var trackEl = document.getElementById("flow-track");
  var worksEl = document.getElementById("flow-works");

  function trackHtml() {
    return STEPS.map(function (st) {
      return '<li class="ff-step ff-locked" data-step="' + st.n + '">' +
        '<span class="ff-num">' + st.n + "</span>" +
        '<div class="ff-name">' + esc(st.title) + "</div>" +
        '<div class="ff-line">' + esc(st.line) + "</div>" +
        '<div class="ff-status">locked</div></li>';
    }).join("");
  }

  function sectionHtml(st) {
    var cmd = val(st.command), note = val(st.commandNote), ref = val(st.reference);
    return '<section class="pane ff-work" data-work="' + st.n + '" hidden>' +
      "<h2>Step " + st.n + " · " + esc(st.title) + "</h2>" +
      val(st.intro) +
      (st.widget || "") +
      (cmd ? "<h3>The command</h3>" + '<div class="ff-script">' + script(cmd) + "</div>" : "") +
      (note ? "<p>" + note + "</p>" : "") +
      (ref || "") +
      '<div class="ff-actions"><button class="btn btn-submit" id="flow-run-' + st.n + '">' + esc(st.button) + "</button>" +
      '<span class="run-status">' + esc(st.runNote || "The same values every time, for now.") + "</span></div>" +
      '<div class="ff-log" id="flow-log-' + st.n + '" hidden></div>' +
      '<div class="ff2-draw ff2-empty" id="flow-fig-' + st.n + '"><div class="ff2-placeholder">Nothing yet. Press <strong>' +
      esc(st.button) + "</strong> to run this step.</div></div>" +
      '<div id="flow-rep-' + st.n + '" hidden></div>' +
      (st.n < LAST
        ? '<div class="ff-actions"><button class="btn btn-submit" id="flow-next-' + st.n + '" hidden>Continue to step ' + (st.n + 1) + " →</button></div>"
        : '<div class="ff3-finished" id="flow-finished" hidden><strong>' + esc(S.finishedTitle || "Stage complete.") + "</strong> " +
          (S.finishedNote || "") + "</div>" +
          /* an optional closing panel: what a production flow does differently */
          (S.epilogue ? '<div class="ff-epilogue" id="flow-epilogue" hidden>' + val(S.epilogue) + "</div>" : "")) +
      '<p class="ff-free">' + (S.footNote || "") +
      ' <button class="ff-reset" type="button">Start this example over</button></p>' +
      "</section>";
  }

  /* ----- the step machine ----- */

  function firstOpen() {
    for (var i = 0; i < STEPS.length; i++) if (!done[STEPS[i].n]) return STEPS[i].n;
    return LAST + 1;
  }
  function reachable(n) { return !!done[n] || n === firstOpen(); }

  function refreshTrack() {
    var open = firstOpen();
    trackEl.querySelectorAll(".ff-step").forEach(function (li) {
      var n = +li.getAttribute("data-step");
      var st = li.querySelector(".ff-status");
      li.classList.remove("ff-done", "ff-current", "ff-locked", "ff-viewing", "ff-clickable");
      if (done[n]) { li.classList.add("ff-done"); st.textContent = "done"; }
      else if (n === open) { li.classList.add("ff-current"); st.textContent = "current"; }
      else { li.classList.add("ff-locked"); st.textContent = "locked"; }
      if (reachable(n)) {
        li.classList.add("ff-clickable");
        li.setAttribute("tabindex", "0");
        li.setAttribute("role", "button");
      } else {
        li.removeAttribute("tabindex");
        li.removeAttribute("role");
      }
      if (n === viewing) li.classList.add("ff-viewing");
    });
  }

  function show(n) {
    if (!reachable(n)) return;
    viewing = n;
    worksEl.querySelectorAll("[data-work]").forEach(function (sec) {
      sec.hidden = +sec.getAttribute("data-work") !== n;
    });
    refreshTrack();
  }

  function complete(n) {
    done[n] = true;
    save();
    refreshTrack();
    var next = document.getElementById("flow-next-" + n);
    if (next) next.hidden = false;
    if (n === LAST) {
      var fin = document.getElementById("flow-finished");
      if (fin) fin.hidden = false;
      var epi = document.getElementById("flow-epilogue");
      if (epi) epi.hidden = false;
    }
  }

  function playLog(el, lines, instant, then) {
    el.innerHTML = "";
    el.hidden = false;
    var i = 0;
    /* a long log (a real tool report) plays faster, so the wait stays
       about the same however much the command prints */
    var pace = lines.length > 24 ? 35 : 90;
    (function next() {
      if (i >= lines.length) { then(); return; }
      var ln = lines[i++];
      var div = document.createElement("div");
      div.className = "ff-log-" + ln.k;
      div.textContent = (ln.k === "cmd" ? "> " : "") + ln.t;
      el.appendChild(div);
      el.scrollTop = el.scrollHeight;
      if (instant) next();
      else setTimeout(next, ln.k === "cmd" ? 170 : pace);
    })();
  }

  function run(st, instant) {
    if (busy[st.n]) return;
    busy[st.n] = true;
    var res = st.run();
    var rep = document.getElementById("flow-rep-" + st.n);
    rep.hidden = true;
    playLog(document.getElementById("flow-log-" + st.n), res.log, instant, function () {
      var fig = document.getElementById("flow-fig-" + st.n);
      if (res.figure) {
        fig.innerHTML = res.figure;
        fig.classList.remove("ff2-empty");
        fig.hidden = false;
      } else {
        fig.hidden = true;
      }
      rep.innerHTML = res.report;
      rep.hidden = false;
      document.getElementById("flow-run-" + st.n).textContent = st.againLabel || "Run again";
      busy[st.n] = false;
      if (res.after) res.after();
      complete(st.n);
    });
  }

  /* ----- go ----- */

  trackEl.innerHTML = trackHtml();
  worksEl.innerHTML = STEPS.map(sectionHtml).join("");

  STEPS.forEach(function (st) {
    document.getElementById("flow-run-" + st.n).addEventListener("click", function () { run(st, false); });
    var next = document.getElementById("flow-next-" + st.n);
    if (next) next.addEventListener("click", function () { show(st.n + 1); window.scrollTo(0, 0); });
    if (st.onShow) st.onShow();
  });

  trackEl.querySelectorAll(".ff-step").forEach(function (li) {
    var n = +li.getAttribute("data-step");
    li.addEventListener("click", function () { show(n); });
    li.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); show(n); }
    });
  });

  document.querySelectorAll(".ff-reset").forEach(function (b) {
    b.addEventListener("click", function () {
      done = {};
      save();
      window.location.reload();
    });
  });

  load();
  STEPS.forEach(function (st) { if (done[st.n]) run(st, true); });
  refreshTrack();
  show(Math.min(firstOpen(), LAST));
})();
