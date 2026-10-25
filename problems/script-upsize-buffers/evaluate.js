/* Evaluator: batch buffer upsize. Runs the submission in the stub shell and
 * grades the final design state: sweep complete, no collateral damage. */

// What the untouched part of the design must still look like afterwards.
const PROTECTED = {
  u_clkb0: "BUF_X2",
  u_clkb1: "BUF_X2",
  u_inv0: "INV_X1",
  u_inv1: "INV_X1",
  u_ff0: "DFF_X1",
  u_ff1: "DFF_X1",
  u_ff2: "DFF_X1",
};

export default async function evaluate(g) {
  const { state, trace } = await g.runStubbedTcl();
  const cells = state.cells;
  const masters = Object.values(cells);

  const bufx1Remaining = masters.filter((m) => m === "BUF_X1").length;
  const bufx2Count = masters.filter((m) => m === "BUF_X2").length;
  const damaged = Object.keys(PROTECTED).filter((name) => cells[name] !== PROTECTED[name]).sort();
  const othersUntouched = damaged.length ? 0 : 1;

  const notes = [`your script issued ${trace.length} tool command(s) that modified the design`];
  if (bufx1Remaining) notes.push(`${bufx1Remaining} BUF_X1 instance(s) were never upsized`);
  if (damaged.length) {
    notes.push(
      "collateral damage - these instances were modified but should not " +
      `have been: ${damaged.join(", ")}`
    );
  }

  return {
    metrics: {
      bufx1_remaining: bufx1Remaining,
      bufx2_count: bufx2Count,
      others_untouched: othersUntouched,
    },
    notes,
  };
}
