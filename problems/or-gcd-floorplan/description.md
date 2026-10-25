## The task

No model this time. Your script runs inside a **real
[OpenROAD](https://theopenroadproject.org) session** on this machine, on a
real synthesized netlist (`gcd` - a greatest-common-divisor block, ~550
cells) mapped to the open **sky130hd** standard-cell library (SkyWater
130 nm process). The grader measures the floorplan you actually built, by
querying the OpenROAD design database after your script finishes.

When your `floorplan.tcl` runs, the harness has already loaded the
technology data and the netlist. You must:

1. **Initialize the floorplan** - carve out the die and core, and fill
   the core with standard-cell rows on the `unithd` site. Land the
   *measured* utilization in **0.55-0.70** with an aspect ratio between
   0.75 and 1.34.
2. **Create routing tracks** - the grid the router will ride on.
3. **Place the block pins** - horizontal-layer pins on `met3`, vertical
   on `met2` (the sky130hd convention).

## The commands

```tcl
initialize_floorplan -utilization <percent> \
                     -aspect_ratio <h/w> \
                     -core_space <margin µm> \
                     -site unithd

make_tracks

place_pins -hor_layers met3 -ver_layers met2
```

Notes that will save you a retry:

- `-utilization` takes a **percentage** (60, not 0.60). The tool computes
  the core area from the netlist's total cell area, then snaps rows to
  the site grid - so the measured utilization lands *near* your request,
  not exactly on it.
- `-core_space` is the margin between core and die edge (a couple of µm
  is fine here); production flows reserve it for the power ring.
- Pin placement at this stage is provisional (cells aren't placed yet);
  production flows re-run pin placement later against the placed
  netlist. A plain `make_tracks` uses the track offsets from the
  technology LEF (Library Exchange Format) file; OpenROAD-flow-scripts
  overrides some per-layer offsets in production.

## Why this problem exists

The three steps above are *the* canonical floorplan recipe - the same
sequence OpenROAD-flow-scripts runs as its floorplan stage. Once this
feels routine, every later stage (placement, clock tree, routing) builds
on a floorplan you know how to control.

Expect a few seconds per grade - you are paying for a real tool launch.
