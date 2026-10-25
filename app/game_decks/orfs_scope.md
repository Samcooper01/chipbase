# OpenROAD-flow-scripts variables deck: scope

OpenROAD-flow-scripts (the reference flow built on OpenROAD) is driven by
make variables set in a design's `config.mk` and its platform's `config.mk`.
The flow documents **244 variables**
([FlowVariables.md](https://github.com/The-OpenROAD-Project/OpenROAD-flow-scripts/blob/master/docs/user/FlowVariables.md),
copied from the `openroad/orfs` image alongside this file).

Tiers come from measurement, as in the OpenROAD deck. Counting `export VAR=`
across every design and platform configuration shipped in the same image:

- **124 of the 244 are actually set** by at least one configuration.
- **Core**: set by 8 or more configurations, or required in every design. Two
  or three cards each.
- **Secondary**: set by 1 to 7 configurations. One card each.
- **Out of scope**: the 120 variables no shipped configuration sets. They are
  mostly developer switches, alternative synthesis front ends, and per-tool
  argument passthroughs.

The deck's sections follow the flow's own staging. A variable used by several
stages is taught once, in the stage where it is first read.

## 1. Design and platform

`DESIGN_NAME` (75), `PLATFORM` (75), `DESIGN_NICKNAME` (61), `VERILOG_FILES`
(74), `VERILOG_INCLUDE_DIRS` (18), `SDC_FILE` (75), `ADDITIONAL_LEFS` (24),
`ADDITIONAL_LIBS` (21), `ADDITIONAL_GDS` (14), `LIB_FILES` (10), `SC_LEF` (8),
`TECH_LEF` (7), `GDS_FILES` (11), `BLOCKS` (4).

## 2. Synthesis

`SYNTH_HIERARCHICAL` (20), `ABC_AREA` (21), `ABC_DRIVER_CELL` (7),
`ABC_LOAD_IN_FF` (7), `ABC_CLOCK_PERIOD_IN_PS` (4), `SYNTH_MINIMUM_KEEP_SIZE`
(13), `ADDER_MAP_FILE` (11), `CLKGATE_MAP_FILE` (6), `LATCH_MAP_FILE` (7),
`TIEHI_CELL_AND_PORT` (7), `TIELO_CELL_AND_PORT` (7), `MIN_BUF_CELL_AND_PORTS`
(7), `SYNTH_HDL_FRONTEND` (10), `SYNTH_NETLIST_FILES` (4),
`SWAP_ARITH_OPERATORS` (31).

## 3. Floorplan

`CORE_UTILIZATION` (53), `CORE_ASPECT_RATIO` (28), `CORE_MARGIN` (31),
`DIE_AREA` (22), `CORE_AREA` (22), `PLACE_SITE` (9), `MACRO_PLACE_HALO` (29),
`MACRO_WRAPPERS` (8), `MACRO_PLACEMENT_TCL` (2), the `RTLMP_*` macro-placer
controls (3 each), `IO_CONSTRAINTS` (19), `PDN_TCL` (15), `TAPCELL_TCL` (8),
`FLOORPLAN_DEF` (1), `MAKE_TRACKS` (1).

## 4. Placement

`PLACE_DENSITY` (41), `PLACE_DENSITY_LB_ADDON` (34),
`CELL_PAD_IN_SITES_GLOBAL_PLACEMENT`, `CELL_PAD_IN_SITES_DETAIL_PLACEMENT`,
`IO_PLACER_H` (7), `IO_PLACER_V` (7), `PLACE_PINS_ARGS` (4),
`GLOBAL_PLACEMENT_ARGS` (1), `GPL_TIMING_DRIVEN` (1), `CLUSTER_FLOPS` (1),
`BALANCE_ROWS` (1), `ENABLE_DPO` (3), `DONT_USE_CELLS` (8).

## 5. Clock tree synthesis

`CTS_CLUSTER_SIZE` (7), `CTS_CLUSTER_DIAMETER` (7), `CTS_BUF_DISTANCE` (3),
`CTS_ARGS` (1), `CTS_LIB_NAME` (1), `SKIP_CTS_REPAIR_TIMING` (1).

## 6. Routing

`MIN_ROUTING_LAYER` (8), `MAX_ROUTING_LAYER` (11), `MIN_CLK_ROUTING_LAYER` (5),
`ROUTING_LAYER_ADJUSTMENT` (3), `FASTROUTE_TCL` (16), `DISABLE_VIA_GEN` (1),
`ENABLE_RESISTANCE_AWARE` (1).

## 7. Timing and optimization

`TNS_END_PERCENT` (45), `SETUP_SLACK_MARGIN` (3), `HOLD_SLACK_MARGIN` (5),
`CAP_MARGIN`, `SLEW_MARGIN`, `SKIP_GATE_CLONING` (8), `SKIP_LAST_GASP` (1),
`SKIP_INCREMENTAL_REPAIR` (4), `RECOVER_POWER` (4), `MATCH_CELL_FOOTPRINT` (3),
`OPT_POST_GRT_WNS` (8).

## 8. Finishing and outputs

`FILL_CELLS` (9), `USE_FILL` (4), `FILL_CONFIG` (4), `PWR_NETS_VOLTAGES` (8),
`GND_NETS_VOLTAGES` (8), `IR_DROP_LAYER` (7), `GDS_ALLOW_EMPTY` (5),
`SEAL_GDS` (4), `CDL_FILE` (3), `KLAYOUT_TECH_FILE` (7), `RCX_RULES` (6),
`CORNER` (5), `PROCESS` (7).

## 9. Running the flow

`OPENROAD_HIERARCHICAL` (32), `SKIP_REPORT_METRICS` (1), `LEC_CHECK` (2),
`REMOVE_CELLS_FOR_LEC` (4), `GPL_RANDOM_SEED` (2), `SYNTH_REPEATABLE_BUILD`
(1), `ASAP7_USE_VT` (4), `CORNERS` (1).

## What a card looks like

A variable is not a command, so the question changes. Cards show a line from a
configuration file, for example `export PLACE_DENSITY = 0.60`, and ask what it
does. Where a wrong value has a characteristic consequence, the wrong answers
are the confusions that cause it: density against utilization, a margin that
tightens rather than relaxes, a layer limit that excludes rather than includes.

## Out of scope

The 120 documented variables that no shipped configuration sets, the
autotuner's own variables, and the build and continuous-integration variables
of the repository, which are not part of running a design through the flow.
