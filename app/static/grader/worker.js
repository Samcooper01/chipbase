/* The grading worker. The problem page (app.js) posts one submission; the
 * worker loads what that problem needs, grades it with grade.js, and posts
 * the scorecard back. Grading runs here, off the page's main thread, so a
 * learner's infinite loop cannot freeze the page: the page stops the worker
 * when a run passes grade.js's TIMEOUT_S.
 *
 * Messages to the page: { type: "started" } once everything is loaded and
 * the evaluator begins (the page starts its clock then, so a slow first
 * download of the Tcl runtime does not count against the script), and
 * { type: "card", card } with the result. */

import { grade } from "./grade.js";

let tclReady = null;
let stubsReady = null;

function loadScriptRuntime() {
  if (!tclReady) tclReady = import("./tcl-runtime.js").then((m) => m.loadTcl());
  if (!stubsReady) {
    stubsReady = fetch(new URL("./tclstubs.tcl", import.meta.url)).then((r) => {
      if (!r.ok) throw new Error("could not load the stub shell (" + r.status + ")");
      return r.text();
    });
  }
  return Promise.all([tclReady, stubsReady]);
}

self.onmessage = async (event) => {
  const { problem, submission, evaluatorUrl } = event.data;
  try {
    let evaluate = null;
    let tcl = null;
    let stubs = null;
    if (problem.kind !== "numeric" && evaluatorUrl) {
      evaluate = (await import(evaluatorUrl)).default;
    }
    if (problem.engine === "script") {
      [tcl, stubs] = await loadScriptRuntime();
    }
    self.postMessage({ type: "started" });
    const card = await grade(problem, submission, { evaluate, tcl, stubs });
    self.postMessage({ type: "card", card });
  } catch (err) {
    self.postMessage({
      type: "card",
      card: {
        ok: false, engine: problem.engine, error: "the grader could not load: " + (err && err.message ? err.message : err),
        log_tail: "", solved: false, score: 0, points: problem.points, checks: [], metrics: {}, notes: [],
      },
    });
  }
};
