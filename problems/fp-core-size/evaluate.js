/* Evaluator: floorplan sizing. Reads the two dimensions and computes
 * utilization and aspect ratio for a fixed total standard-cell area. */

const TOTAL_CELL_AREA_UM2 = 48_400.0;

export default async function evaluate(g) {
  const values = g.parseTclSets(g.read("floorplan.tcl"));
  const width = g.requireNumber(values, "core_width", "1.0", "100000.0");
  const height = g.requireNumber(values, "core_height", "1.0", "100000.0");

  const coreArea = width * height;
  const utilization = TOTAL_CELL_AREA_UM2 / coreArea;
  const aspectRatio = height / width;

  const notes = [];
  if (utilization < 0.60) {
    notes.push(
      "Utilization is low - the core is bigger than it needs to be. " +
      "Shrink it (or reason backwards from a target utilization)."
    );
  } else if (utilization > 0.72) {
    notes.push(
      "Utilization is high - the router and the optimizer will have no " +
      "room to work. Grow the core."
    );
  }
  if (!(aspectRatio >= 0.60 && aspectRatio <= 1.67)) {
    notes.push("The core is very elongated - rebalance width vs height.");
  }

  return {
    metrics: {
      core_width_um: width,
      core_height_um: height,
      core_area_um2: g.py.round(coreArea, 1),
      utilization: g.py.round(utilization, 4),
      aspect_ratio: g.py.round(aspectRatio, 4),
    },
    notes,
  };
}
