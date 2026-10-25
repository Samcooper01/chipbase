/* Evaluator: basics 2, exact-output grading. */

const EXPECTED = [
  "core area: 36000",
  "utilization: 0.6",
  "half perimeter: 390",
];

export default async function evaluate(g) {
  const { output } = await g.runStubbedTcl();
  const { metrics, notes } = g.gradeExactOutput(output, EXPECTED);
  if (metrics.output_correct !== 1 &&
      output.some((ln) => ln.includes("utilization") && !ln.includes("0.6"))) {
    notes.push(
      "utilization not 0.6? Check for the integer-division trap: one " +
      "operand must be a float."
    );
  }
  return { metrics, notes };
}
