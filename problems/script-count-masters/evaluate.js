/* Evaluator: instance-count report. Runs the submission in the stub shell
 * and grades the printed report against the true per-master counts. */

export default async function evaluate(g) {
  const { output, state } = await g.runStubbedTcl();

  const expected = {};
  for (const master of Object.values(state.cells)) expected[master] = (expected[master] || 0) + 1;

  const reported = {};
  const badLines = [];
  for (let line of output) {
    line = line.trim();
    if (!line) continue;
    const parts = g.py.splitWords(line);
    if (parts.length !== 2 || !/^\d+$/.test(parts[1].replace(/^-+/, ""))) {
      badLines.push(line);
      continue;
    }
    reported[parts[0]] = parseInt(parts[1], 10);
  }

  const notes = [];
  if (badLines.length) {
    notes.push(
      `${badLines.length} line(s) were not in '<master> <count>' form, ` +
      `e.g.: ${g.py.strRepr(badLines[0])}`
    );
  }

  const sameCounts = (a, b) => {
    const ka = Object.keys(a);
    return ka.length === Object.keys(b).length && ka.every((k) => k in b && a[k] === b[k]);
  };
  const correct = sameCounts(reported, expected) && !badLines.length ? 1 : 0;
  if (!correct && Object.keys(reported).length) {
    const missing = Object.keys(expected).filter((m) => !(m in reported)).sort();
    const extra = Object.keys(reported).filter((m) => !(m in expected)).sort();
    const wrong = Object.keys(expected).filter((m) => m in reported && expected[m] !== reported[m]).sort();
    if (missing.length) notes.push(`masters missing from your report: ${missing.join(", ")}`);
    if (extra.length) notes.push(`reported masters that do not exist: ${extra.join(", ")}`);
    if (wrong.length) notes.push(`wrong counts for: ${wrong.join(", ")}`);
  } else if (!Object.keys(reported).length) {
    notes.push("your script printed no report lines");
  }

  return {
    metrics: {
      masters_reported: Object.keys(reported).length,
      counts_correct: correct,
      cells_in_design: Object.keys(state.cells).length,
    },
    notes,
  };
}
