/* Evaluator: batch clock creation. Runs the submission in the stub shell and
 * grades the final clock state: names, ports, periods. */

const EXPECTED = {
  sys_clk: 1000.0 / 500, // 2.0 ns
  io_clk: 1000.0 / 100, // 10.0 ns
  ddr_clk: 1000.0 / 800, // 1.25 ns
};
const TOL_NS = 0.001;

export default async function evaluate(g) {
  const { state } = await g.runStubbedTcl();
  const clocks = state.clocks;

  const problemsFound = [];
  for (const [name, wantPeriod] of Object.entries(EXPECTED)) {
    if (!(name in clocks)) {
      problemsFound.push(`no clock named ${name}`);
      continue;
    }
    const got = clocks[name];
    if (got.port !== name) {
      problemsFound.push(`clock ${name} sits on port '${got.port}', expected '${name}'`);
    }
    if (Math.abs(got.period - wantPeriod) > TOL_NS) {
      problemsFound.push(
        `clock ${name}: period ${g.py.floatRepr(got.period)} ns, expected ` +
        `${g.py.floatRepr(wantPeriod)} ns (megahertz-to-nanoseconds conversion?)`
      );
    }
  }
  const extra = Object.keys(clocks).filter((c) => !(c in EXPECTED)).sort();
  if (extra.length) problemsFound.push(`unexpected extra clock(s): ${extra.join(", ")}`);

  const clocksCorrect = !problemsFound.length && Object.keys(clocks).length === Object.keys(EXPECTED).length ? 1 : 0;

  return {
    metrics: {
      clocks_created: Object.keys(clocks).length,
      clocks_correct: clocksCorrect,
    },
    notes: problemsFound.length ? problemsFound : ["all three clocks look right"],
  };
}
