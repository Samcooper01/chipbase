/* Evaluator: clock-tree buffer/fanout trade-off. Levelized-tree model: stage
 * delay grows with fanout, buffer count shrinks with fanout, and the three
 * budgets pull in different directions. */

const BUFFERS = {
  // name: [intrinsic delay ps, delay per fanout ps, power per buffer µW]
  BUF_X2: [28.0, 9.0, 0.9],
  BUF_X4: [34.0, 4.5, 1.6],
  BUF_X8: [42.0, 2.6, 2.9],
};
const SINKS = 2000;

export default async function evaluate(g) {
  const values = g.parseTclSets(g.read("cts.tcl"));

  const bufferName = values.clock_buffer;
  if (!(typeof bufferName === "string" && bufferName in BUFFERS)) {
    const got = bufferName === undefined ? "None"
      : typeof bufferName === "number" ? g.py.floatRepr(bufferName) : g.py.strRepr(bufferName);
    g.fail(`\`set clock_buffer\` must be one of ${Object.keys(BUFFERS).join(", ")} - got: ${got}`);
  }
  let fanout = g.requireNumber(values, "max_fanout", "2", "64");
  if (fanout !== Math.trunc(fanout)) g.fail("`set max_fanout` must be a whole number");
  fanout = Math.trunc(fanout);

  const [intrinsic, slope, powerEachUw] = BUFFERS[bufferName];

  const depth = Math.max(1, Math.ceil(Math.log(SINKS) / Math.log(fanout)));
  const stageDelay = intrinsic + slope * fanout;
  const insertionDelay = depth * stageDelay;
  const skew = 8.0 + 0.30 * stageDelay + 3.0 * depth;
  const nBuffers = fanout > 1 ? Math.ceil(SINKS / (fanout - 1)) : SINKS;
  const powerMw = (nBuffers * powerEachUw) / 1000.0;

  const notes = [
    `tree: ${depth} levels of ${bufferName}, ${nBuffers} buffers, ` +
    `stage delay ${g.py.fixed(stageDelay, 0)} ps`,
  ];
  if (skew > 65) {
    notes.push(
      "Skew-bound: each stage is too slow/sloppy. Lower the fanout or " +
      "use a stronger buffer."
    );
  }
  if (insertionDelay > 550) {
    notes.push(
      "Latency-bound: stages are slow and/or the tree is deep. A " +
      "stronger buffer or different fanout shortens the path."
    );
  }
  if (powerMw > 0.30) {
    notes.push(
      "Power-bound: too many buffers (or too costly a buffer). Raise " +
      "the fanout so fewer buffers cover all sinks."
    );
  }

  return {
    metrics: {
      clock_buffer: bufferName,
      max_fanout: fanout,
      tree_depth: depth,
      buffer_count: nBuffers,
      insertion_delay_ps: g.py.round(insertionDelay, 1),
      skew_ps: g.py.round(skew, 1),
      clock_power_mw: g.py.round(powerMw, 3),
    },
    notes,
  };
}
