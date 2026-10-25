// Checks the browser grader against the Python grader it replaced.
//
// golden.json holds the Python grader's scorecards for 349 submissions,
// recorded on 2026-09-29 just before that grader was removed: every
// problem's solution and starter, each number in the solution scaled up and
// down in turn, an empty file, garbage, a script error, an early exit, an
// extra printed line, non-ASCII output, output on standard error, and quiz
// answers on both sides of the rubric's window. It is a fixed record now;
// add cases by hand. This runs each one through static/grader/grade.js with
// the problem's evaluate.js and the WebAssembly Tcl runtime, exactly as the
// browser does, and compares every field of the scorecard. The only
// differences allowed are the ones listed in INTENDED, each a deliberate
// change with its reason.
//
//   node tests/grader/check_grader.mjs

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const GRADER = join(ROOT, "app", "static", "grader");
const { grade } = await import(pathToFileURL(join(GRADER, "grade.js")));
const { loadTcl } = await import(pathToFileURL(join(GRADER, "tcl-runtime.js")));

// Differences from the Python grader that are improvements, not regressions.
const INTENDED = {
  // Python ran the script in a tclsh process; exit ended the process before
  // the design was read and the learner saw "internal error". The browser
  // runtime knows the script called exit and says so.
  "early-exit": (py, js) =>
    py.error === "the stub shell produced no final state (internal error)" &&
    js.error === "your script called exit, so it stopped before the grader could read the design - remove the exit",
};

const data = JSON.parse(execFileSync(join(ROOT, ".venv", "bin", "python"), ["-c", `
import json
from app import problems
print(json.dumps({p.id: problems.grading_data(p) for p in problems.load_all()}))
`], { cwd: ROOT, encoding: "utf8" }));
const golden = JSON.parse(readFileSync(join(ROOT, "tests", "grader", "golden.json"), "utf8"));
const tcl = await loadTcl();
const stubs = readFileSync(join(GRADER, "tclstubs.tcl"), "utf8");
const evaluators = {};

function same(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

let pass = 0;
let intended = 0;
const failures = [];
for (const c of golden) {
  const problem = data[c.problem];
  if (!(c.problem in evaluators) && problem.kind !== "numeric") {
    evaluators[c.problem] = (await import(pathToFileURL(join(ROOT, "problems", c.problem, "evaluate.js")))).default;
  }
  const card = await grade(problem, c.submission, { evaluate: evaluators[c.problem], tcl, stubs });
  delete card.elapsed_s;
  const want = c.card;
  const fields = [...new Set([...Object.keys(want), ...Object.keys(card)])];
  const differing = fields.filter((f) => !same(want[f], card[f]));
  if (!differing.length) {
    pass++;
  } else if (INTENDED[c.case] && differing.every((f) => f === "error") && INTENDED[c.case](want, card)) {
    intended++;
  } else {
    failures.push({ problem: c.problem, case: c.case, diffs: differing.map((f) => ({ field: f, python: want[f], browser: card[f] })) });
  }
}

for (const f of failures.slice(0, 20)) {
  console.log(`FAIL ${f.problem} / ${f.case}`);
  for (const d of f.diffs) console.log(`  ${d.field}\n    python:  ${JSON.stringify(d.python)}\n    browser: ${JSON.stringify(d.browser)}`);
}
console.log(`${pass} identical, ${intended} intended differences, ${failures.length} failures, of ${golden.length} cases`);
process.exit(failures.length ? 1 : 0);
