/* The grader: one submission in, one scorecard out. It runs in the visitor's
 * browser (inside worker.js) and in the Node tests, and it behaves the same
 * in both.
 *
 * Three engines produce a metrics dictionary, then the rubric turns metrics
 * into a scorecard:
 *
 *   quiz    - the learner submits a number; the metric is the answer itself.
 *   sim     - the problem's evaluate.js reads the submitted files as data and
 *             computes metrics from a calibrated analytical model.
 *   script  - the same, but evaluate.js runs the submitted script in the stub
 *             tool shell (Tcl compiled to WebAssembly, over a fake design)
 *             and grades what the script did.
 *
 * Problems graded by a real OpenROAD run cannot be graded in a browser.
 *
 * A scorecard has the shape of a coding-judge verdict: each rubric check is
 * a test case with pass or fail and a detail line.
 */

import * as py from "./pyformat.js";
import { GradeFailure, makeToolkit } from "./toolkit.js";

export const MAX_FILE_BYTES = 200_000;
// the browser stops a grading run that takes longer than this (worker.js)
export const TIMEOUT_S = 10;

function fmt(x) {
  if (typeof x === "number") {
    if (Number.isInteger(x) && Math.abs(x) < 1e15) return String(x);
    return py.general(x, 4);
  }
  return String(x);
}

function checkDetail(check, got) {
  if (got === undefined || got === null) return `metric '${check.metric}' was not produced by the run`;
  const g = fmt(got);
  if (check.op === "between") return `got ${g} (need ${fmt(check.min)} ≤ value ≤ ${fmt(check.max)})`;
  if (check.op === "<=") return `got ${g} (need ≤ ${fmt(check.value)})`;
  if (check.op === ">=") return `got ${g} (need ≥ ${fmt(check.value)})`;
  if (check.op === "~=") return `got ${g} (need ${fmt(check.value)} ± ${fmt(check.tolerance)})`;
  return `got ${g}`;
}

function checkPasses(check, got) {
  if (typeof got !== "number") return false;
  if (check.op === "between") return check.min <= got && got <= check.max;
  if (check.op === "<=") return got <= check.value;
  if (check.op === ">=") return got >= check.value;
  if (check.op === "~=") return Math.abs(got - check.value) <= check.tolerance;
  return false;
}

function applyRubric(problem, metrics) {
  let total = 0;
  let passed = 0;
  const checks = problem.checks.map((check) => {
    const got = metrics[check.metric];
    const ok = checkPasses(check, got);
    total += check.weight;
    if (ok) passed += check.weight;
    return { id: check.id, label: check.label, passed: ok, detail: checkDetail(check, got) };
  });
  const solved = checks.length > 0 && checks.every((c) => c.passed);
  const score = total > 0 ? py.round((problem.points * passed) / total) : 0;
  return { checks, solved, score };
}

function errorCard(problem, message) {
  return {
    ok: false, engine: problem.engine, error: message, log_tail: "",
    solved: false, score: 0, points: problem.points, checks: [], metrics: {}, notes: [],
  };
}

/** Only files declared editable are graded; a missing file falls back to its
 * starter, as it would if the learner never touched it. */
function sanitizeFiles(problem, files) {
  const clean = {};
  for (const entry of problem.editable) {
    const content = (files || {})[entry.path] ?? problem.starter[entry.path] ?? "";
    if (new TextEncoder().encode(content).length > MAX_FILE_BYTES) {
      throw new GradeFailure(`file ${entry.path} exceeds the size limit`);
    }
    clean[entry.path] = content;
  }
  return clean;
}

/**
 * Grade one submission.
 *   problem     - the problem's grading data (problem.html's payload)
 *   submission  - { answer } for a quiz, { files } otherwise
 *   runtime     - { evaluate, tcl, stubs }: the problem's evaluator function,
 *                 and for script problems the Tcl runtime and stub shell
 */
export async function grade(problem, submission, runtime) {
  const started = Date.now();
  let payload;
  try {
    if (problem.kind === "numeric") {
      const answer = submission.answer;
      if (answer === null || answer === undefined || Number.isNaN(answer)) {
        return errorCard(problem, "no numeric answer was given");
      }
      payload = { metrics: { answer: Number(answer) }, notes: [] };
    } else if (problem.engine === "sim" || problem.engine === "script") {
      const files = sanitizeFiles(problem, submission.files);
      const g = makeToolkit({ files, assets: problem.assets || {}, tcl: runtime.tcl, stubs: runtime.stubs });
      payload = await runtime.evaluate(g);
    } else if (problem.engine === "openroad") {
      return errorCard(problem, "this problem is graded by a real OpenROAD run, which cannot run in a browser");
    } else {
      return errorCard(problem, `unknown grading engine '${problem.engine}'`);
    }
  } catch (err) {
    if (err instanceof GradeFailure) return errorCard(problem, err.message);
    return errorCard(problem, `the grader hit an internal error: ${err && err.message ? err.message : err}`);
  }

  const metrics = payload.metrics || {};
  const rubric = applyRubric(problem, metrics);
  return {
    ok: true,
    engine: problem.engine,
    metrics,
    notes: payload.notes || [],
    log_tail: "",
    checks: rubric.checks,
    solved: rubric.solved,
    score: rubric.score,
    points: problem.points,
    elapsed_s: py.round((Date.now() - started) / 1000, 2),
  };
}
