/* Evaluator: basics 6, exact-output grading. */

const EXPECTED = [
  "500 MHz -> 2.0 ns",
  "100 MHz -> 10.0 ns",
  "800 MHz -> 1.25 ns",
  "250 MHz -> 4.0 ns",
];

export default async function evaluate(g) {
  const { output } = await g.runStubbedTcl();
  const { metrics, notes } = g.gradeExactOutput(output, EXPECTED);
  return { metrics, notes };
}
