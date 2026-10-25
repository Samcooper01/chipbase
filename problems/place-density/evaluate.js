/* Evaluator: placement density trade-off. A calibrated analytical model of
 * the wirelength-vs-congestion tension around the density knob. */

export default async function evaluate(g) {
  const values = g.parseTclSets(g.read("place.tcl"));
  const density = g.requireNumber(values, "target_density", "0.05", "0.99");

  const hpwlUm = 1_200_000.0 * (0.55 / density) ** 0.8;
  const overflowPct = 0.5 + 25.0 * Math.max(0.0, density - 0.62) ** 1.3;

  const notes = [`placer packed cells to ${g.py.fixed(density, 2)} of local capacity`];
  if (hpwlUm > 1_150_000) {
    notes.push(
      "Wirelength-bound: cells are spread too thin, nets got long. " +
      "Raise the target density."
    );
  }
  if (overflowPct > 2.5) {
    notes.push(
      "Congestion-bound: routing demand exceeds supply over the packed " +
      "regions. Lower the target density."
    );
  }

  return {
    metrics: {
      target_density: density,
      hpwl_um: g.py.round(hpwlUm),
      congestion_overflow_pct: g.py.round(overflowPct, 2),
    },
    notes,
  };
}
