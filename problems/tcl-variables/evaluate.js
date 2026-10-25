/* Evaluator: basics 1, exact-output grading. */

const EXPECTED = [
  "design: gcd",
  "cells: 547",
  "gcd has 547 cells",
];

export default async function evaluate(g) {
  const { output } = await g.runStubbedTcl();
  const { metrics, notes } = g.gradeExactOutput(output, EXPECTED);
  return { metrics, notes };
}
