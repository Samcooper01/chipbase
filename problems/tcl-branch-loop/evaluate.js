/* Evaluator: basics 4, exact-output grading. */

const EXPECTED = [
  "MET 0.12",
  "VIOLATED -0.05",
  "MET 0.30",
  "VIOLATED -0.42",
  "MET 0.08",
  "violations: 2",
];

export default async function evaluate(g) {
  const { output } = await g.runStubbedTcl();
  const { metrics, notes } = g.gradeExactOutput(output, EXPECTED);
  return { metrics, notes };
}
