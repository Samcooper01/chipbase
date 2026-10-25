/* The toolkit every problem's evaluate.js receives.
 *
 * An evaluator is one function, `export default async function evaluate(g)`,
 * that reads the submitted files through `g`, computes metrics, and returns
 * `{ metrics, notes }`. It never imports anything: all it needs arrives in
 * `g`, so the same file runs in the browser's grading worker and in the Node
 * tests.
 *
 *   g.read(path)                 a submitted file's text (fails if missing)
 *   g.fail(message)              stop grading with a message for the learner
 *   g.parseTclSets(text)         `set name value` lines, read as data
 *   g.requireNumber(values, name, lo, hi)
 *                                a numeric setting, within sane bounds; the
 *                                bounds are written as the message should
 *                                print them ("1.0", "2")
 *   g.gradeExactOutput(lines, expected)
 *                                compare printed output line by line
 *   g.runStubbedTcl()            run script.tcl in the stub tool shell over
 *                                design.tcl; resolves to { output, state, trace }
 *   g.py                         Python-compatible formatting (pyformat.js)
 */

import * as py from "./pyformat.js";

export class GradeFailure extends Error {}

function fail(message) {
  throw new GradeFailure(message);
}

const SET_RE = /^\s*set\s+(\w+)\s+(\S+)\s*(?:;.*|#.*)?$/;

/** `set name value` assignments from a Tcl (Tool Command Language) script,
 * treated purely as text. Numeric values become numbers; anything else stays
 * a string. Comment lines are ignored. */
function parseTclSets(text) {
  const values = {};
  for (const line of py.splitlines(text)) {
    if (line.trim().startsWith("#")) continue;
    const m = SET_RE.exec(line);
    if (!m) continue;
    const raw = m[2].replace(/^["{}]+|["{}]+$/g, "");
    const num = py.parseFloatPy(raw);
    values[m[1]] = num === null ? raw : num;
  }
  return values;
}

function requireNumber(values, name, lo, hi) {
  if (!(name in values)) fail(`could not find \`set ${name} <value>\` in your script`);
  const value = values[name];
  if (typeof value !== "number") fail(`\`set ${name}\` must be a number, got: ${value}`);
  if (lo !== undefined && value < Number(lo)) {
    fail(`\`set ${name}\` is ${py.floatRepr(value)}, below the sane minimum of ${lo}`);
  }
  if (hi !== undefined && value > Number(hi)) {
    fail(`\`set ${name}\` is ${py.floatRepr(value)}, above the sane maximum of ${hi}`);
  }
  return value;
}

/** Compare printed output to the expected lines (whitespace trimmed, blank
 * lines ignored). The notes point at the first line that differs. */
function gradeExactOutput(outputLines, expectedLines) {
  const got = outputLines.map((l) => l.trim()).filter((l) => l);
  const exp = expectedLines.map((e) => e.trim());
  const correct = got.length === exp.length && got.every((l, i) => l === exp[i]);
  const notes = [];
  if (!correct) {
    if (!got.length) {
      notes.push("your script printed nothing");
    } else {
      let found = false;
      for (let i = 0; i < exp.length; i++) {
        if (i >= got.length) {
          notes.push(`output ends too early - line ${i + 1} should be: ${py.strRepr(exp[i])}`);
          found = true;
          break;
        }
        if (got[i] !== exp[i]) {
          notes.push(`line ${i + 1}: expected ${py.strRepr(exp[i])}, got ${py.strRepr(got[i])}`);
          found = true;
          break;
        }
      }
      if (!found) {
        notes.push(`extra output after the expected lines, starting with: ${py.strRepr(got[exp.length])}`);
      }
    }
  }
  return { metrics: { lines_printed: got.length, output_correct: correct ? 1 : 0 }, notes };
}

/** Run the learner's script in the stub tool shell and read back the fake
 * design. The stub shell returns the design state as its Tcl result, apart
 * from anything the script prints, so a script's output can never be
 * mistaken for the grader's data. */
async function runStubbedTcl(tcl, files, assets, stubs, scriptPath = "script.tcl", designPath = "design.tcl") {
  const work = { [designPath]: assets[designPath], [scriptPath]: files[scriptPath], "tclstubs.tcl": stubs };
  for (const [path, text] of Object.entries(work)) {
    if (text === undefined) fail(`expected file ${path} was not submitted`);
  }
  const runner = [
    "source /work/tclstubs.tcl",
    `source /work/${designPath}`,
    `source /work/${scriptPath}`,
    "dump_state",
  ].join("\n");
  const run = await tcl.run(work, runner);
  if (run.code === "exit") {
    fail("your script called exit, so it stopped before the grader could read the design - remove the exit");
  }
  if (run.code === "1") fail(`your script raised an error in the stub shell: ${run.result.trim()}`);
  if (run.code !== "0") fail(`your script ended with an unexpected Tcl return code (${run.code}) - a break, continue or return outside a loop or procedure?`);

  const state = { cells: {}, ports: {}, nets: {}, clocks: {} };
  const trace = [];
  for (const line of run.result.split("\n")) {
    const parts = line.split("|");
    if (parts[0] === "cell") state.cells[parts[1]] = parts[2];
    else if (parts[0] === "port") state.ports[parts[1]] = parts[2];
    else if (parts[0] === "net") state.nets[parts[1]] = py.parseFloatPy(parts[2]);
    else if (parts[0] === "clock") {
      const period = py.parseFloatPy(parts[2]);
      if (period === null) fail(`clock ${parts[1]} has a period that is not a number: ${py.strRepr(parts[2])}`);
      state.clocks[parts[1]] = { period, port: parts[3] };
    } else if (parts[0] === "trace") trace.push(parts.slice(1));
  }
  return { output: py.splitlines(run.stdout), state, trace };
}

/** The `g` object for one grading run. */
export function makeToolkit({ files, assets, tcl, stubs }) {
  return {
    py,
    fail,
    parseTclSets,
    requireNumber,
    gradeExactOutput,
    read(path) {
      if (!(path in files)) fail(`expected file ${path} was not submitted`);
      return files[path];
    },
    runStubbedTcl(scriptPath, designPath) {
      if (!tcl) fail("this problem's grader needs the Tcl runtime, which did not load");
      return runStubbedTcl(tcl, files, assets, stubs, scriptPath, designPath);
    },
  };
}
