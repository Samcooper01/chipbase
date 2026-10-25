/* Evaluator: basics 3, exact-output grading. */

const EXPECTED = [
  "count: 4",
  "first: BUF_X1",
  "last: NAND2_X1",
  "- BUF_X1",
  "- INV_X1",
  "- DFF_X1",
  "- NAND2_X1",
];

export default async function evaluate(g) {
  const { output } = await g.runStubbedTcl();
  const { metrics, notes } = g.gradeExactOutput(output, EXPECTED);
  return { metrics, notes };
}
