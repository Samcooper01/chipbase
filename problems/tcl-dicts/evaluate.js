/* Evaluator: basics 5, exact-output grading. */

const EXPECTED = [
  "sys_clk: 2.0 ns",
  "io_clk: 10.0 ns",
  "ddr_clk: 1.25 ns",
];

export default async function evaluate(g) {
  const { output } = await g.runStubbedTcl();
  const { metrics, notes } = g.gradeExactOutput(output, EXPECTED);
  return { metrics, notes };
}
