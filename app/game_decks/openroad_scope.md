# OpenROAD flow commands deck: scope

OpenROAD defines 440 Tcl (Tool Command Language) commands in the build used
here (OpenROAD 26Q3, the `openroad/orfs` Docker image). Most are not flow
commands: they belong to the graphical interface, debug hooks, distributed
workers, research passes, or the SDC (Synopsys Design Constraints) and timing
reporting sets that already have their own decks.

Two measurements set the tier of each command:

- **Used by the flow.** Of the 440, **107 appear in the OpenROAD-flow-scripts
  stage scripts** (`flow/scripts/*.tcl` in the same image). That is evidence of
  what a run actually calls, not an opinion.
- **Stage-defining.** A command that performs a flow stage (`global_placement`,
  `clock_tree_synthesis`, `detailed_route`) is core even when a script calls it
  once.

Tiers:

- **Core**: performs or configures a flow stage, or is called in every run.
  Two or three cards each, one per commonly confused option.
- **Secondary**: real but occasional, or a narrower variant. One card each.
- **Out of scope**: see the last section.

Sources: the command signatures printed by the tool's own `help`, and the
module documentation in the
[OpenROAD repository](https://github.com/The-OpenROAD-Project/OpenROAD)
(`src/<module>/README.md`). The `man` pages are not installed in this image.
Unlike SDC, these commands are OpenROAD's own, so the deck is OpenROAD's by
definition.

## 1. Reading and writing a design

| Command | What it does | Tier | Done |
|---|---|---|---|
| `read_lef` | Reads technology and cell geometry (Library Exchange Format) | Core | 1 |
| `read_liberty` | Reads timing and power data for the cells | Core | 1 |
| `read_verilog` | Reads the synthesized netlist | Core | 1 |
| `link_design` | Binds the netlist to the libraries and builds the design | Core |  |
| `read_def` / `write_def` | Reads and writes placed and routed layout (Design Exchange Format) | Core | 1 |
| `read_db` / `write_db` | Reads and writes OpenROAD's own database | Core | 2 |
| `write_verilog` | Writes the netlist after the tool has changed it | Core | 1 |
| `write_abstract_lef` | Writes a block abstract for use in a larger design | Secondary | 1 |
| `write_cdl` | Writes a netlist for layout-versus-schematic checking | Secondary | 1 |

## 2. Floorplan

| Command | What it does | Tier | Done |
|---|---|---|---|
| `initialize_floorplan` | Creates the die and core area and the placement rows | Core | 2 |
| `make_tracks` | Creates the routing tracks on each layer | Core | 1 |
| `place_pins` | Places the block's I/O (Input/Output) pins on the boundary | Core | 1 |
| `set_io_pin_constraint` | Restricts where given pins may be placed | Secondary | 1 |
| `place_macro` | Places one macro at a given location | Core | 1 |
| `rtl_macro_placer` | Places all macros automatically from the netlist hierarchy | Core | 1 |
| `set_macro_halo` / `set_macro_extension` | Keeps standard cells away from macro edges | Secondary | 1 |
| `tapcell` / `place_tapcells` | Inserts well-tap and endcap cells into the rows | Core | 1 |
| `cut_rows` | Cuts placement rows around macros and blockages | Secondary | 1 |
| `create_blockage` / `create_obstruction` | Marks areas where placement or routing may not go | Secondary | 1 |
| `write_macro_placement` / `write_pin_placement` | Writes the macro and pin locations for reuse | Secondary |  |

## 3. Power delivery network

| Command | What it does | Tier | Done |
|---|---|---|---|
| `add_global_connection` / `global_connect` | Connects cell power pins to the supply nets by pattern | Core | 2 |
| `define_pdn_grid` | Starts the definition of a power grid for the core or a macro | Core | 1 |
| `add_pdn_stripe` | Adds straps on a layer, including the follow-pin rails | Core | 2 |
| `add_pdn_ring` | Adds a ring around the core or a macro | Secondary |  |
| `add_pdn_connect` | Defines which layer pairs the grid vias connect | Core | 1 |
| `pdngen` | Builds the grid that the definitions describe | Core | 1 |
| `repair_pdn_vias` | Removes vias that violate design rules | Secondary | 1 |
| `insert_decap` | Inserts decoupling capacitors into the gaps | Secondary |  |
| `analyze_power_grid` | Computes IR (current times resistance) drop on the grid | Core | 1 |
| `check_power_grid` | Checks the grid is fully connected before analysis | Secondary | 1 |

## 4. Placement

| Command | What it does | Tier | Done |
|---|---|---|---|
| `global_placement` | Spreads cells to minimize wirelength; density and timing driven | Core | 2 |
| `detailed_placement` | Legalizes cells onto rows and sites | Core | 1 |
| `check_placement` | Reports cells that are not legally placed | Core | 1 |
| `improve_placement` | Local reordering to reduce wirelength after legalization | Secondary | 1 |
| `set_placement_padding` | Reserves empty sites beside cells for routing and repair | Core | 1 |
| `filler_placement` / `remove_fillers` | Fills and clears the gaps between placed cells | Core | 1 |
| `cluster_flops` | Groups flip-flops so the clock tree can drive them together | Secondary | 1 |
| `balance_row_usage` | Evens out how full the placement rows are | Secondary | 1 |
| `optimize_mirroring` | Flips cells to shorten connections without moving them | Secondary | 1 |

## 5. Clock tree synthesis

| Command | What it does | Tier | Done |
|---|---|---|---|
| `clock_tree_synthesis` | Builds the clock tree with buffers to balance skew | Core | 3 |
| `configure_cts_characterization` / `set_cts_config` | Sets the buffer list and the characterization used | Secondary | 1 |
| `report_cts` | Reports the tree that was built: buffers, sinks, depth | Secondary | 1 |
| `repair_clock_nets` | Repairs long clock nets before the tree is built | Secondary | 1 |
| `repair_clock_inverters` | Splits or duplicates inverters in the clock network | Secondary | 1 |

## 6. Optimization and repair

| Command | What it does | Tier | Done |
|---|---|---|---|
| `repair_design` | Fixes design-rule violations: slew, capacitance, fanout, long wires | Core | 3 |
| `repair_timing` | Fixes setup and hold violations by sizing, buffering, and cloning | Core | 3 |
| `repair_tie_fanout` | Duplicates tie cells so each drives few loads | Secondary | 1 |
| `buffer_ports` | Adds buffers at the block's input and output ports | Secondary | 1 |
| `remove_buffers` | Removes buffers so later steps can rebuild them | Secondary | 1 |
| `set_dont_use` / `reset_dont_use` / `report_dont_use` | Excludes library cells from optimization | Core | 1 |
| `set_dont_touch` / `unset_dont_touch` | Protects instances and nets from being changed | Core | 1 |
| `insert_buffer` | Inserts one buffer on a net by hand | Secondary |  |
| `eliminate_dead_logic` | Removes logic that drives nothing | Secondary | 1 |
| `set_opt_config` | Sets limits that the repair commands obey | Secondary |  |

## 7. Routing

| Command | What it does | Tier | Done |
|---|---|---|---|
| `set_routing_layers` | Sets the layer range routing may use, for signals and clocks | Core | 1 |
| `set_global_routing_layer_adjustment` | Reduces the capacity of a layer, to steer the router | Core | 1 |
| `global_route` | Assigns nets to routing regions and reports congestion | Core | 2 |
| `pin_access` | Works out how pins can be reached before detailed routing | Secondary | 1 |
| `detailed_route` | Routes every net to real wires and vias, obeying design rules | Core | 1 |
| `set_routing_alpha` | Trades wirelength against delay when building route trees | Secondary | 1 |
| `create_ndr` / `assign_ndr` | Defines and applies non-default rules (wider, spaced nets) | Secondary | 2 |
| `write_guides` / `read_guides` | Writes and reads the global-route result | Secondary |  |
| `check_antennas` | Reports antenna-rule violations from long metal on a gate | Core | 1 |
| `repair_antennas` | Inserts diodes to fix antenna violations | Core | 1 |

## 8. Parasitics and layer resistance and capacitance

| Command | What it does | Tier | Done |
|---|---|---|---|
| `set_wire_rc` | Sets the per-length resistance and capacitance used for estimates | Core | 1 |
| `set_layer_rc` / `report_layer_rc` | Sets and reports resistance and capacitance per layer | Secondary | 2 |
| `estimate_parasitics` | Estimates parasitics from placement or from global routing | Core | 2 |
| `extract_parasitics` | Extracts parasitics from the detailed route (OpenRCX) | Core | 1 |
| `write_spef` / `read_spef` | Writes and reads extracted parasitics (SPEF) | Core | 1 |
| `define_process_corner` / `define_rcx_corners` | Defines the corners extraction runs for | Secondary | 1 |

## 9. Design reports and checks

| Command | What it does | Tier | Done |
|---|---|---|---|
| `report_design_area` | Reports the area used and the utilization | Core | 1 |
| `report_cell_usage` | Reports how many of each kind of cell are used | Secondary | 1 |
| `report_wire_length` | Reports total wirelength | Secondary | 1 |
| `report_floating_nets` | Reports nets with no driver | Secondary | 1 |
| `report_long_wires` | Reports the longest nets in the design | Secondary | 1 |
| `report_buffers` | Reports the buffers in the design | Secondary | 1 |
| `design_is_routed` / `all_pins_placed` | Checks that a stage finished, for use in scripts | Secondary |  |
| `report_constant` / `report_overdriven_nets` | Reports constant nets and nets with several drivers | Secondary |  |

## 14. Reading real output (8 cards, built)

Eight cards show a real excerpt from the stage logs of a gcd run (nangate45,
the `openroad/orfs` image) and ask what it says: global-route congestion, the
placer's overflow and wirelength, detailed-route iterations and per-layer wire
length, the antenna check with no diode cell available, why no tap cells were
inserted, where the design area grew, and the clock tree that was built. The
logs and the card generator are in `openroad_src/`. The same logs are the
source material for the separate log-forensics game.

## 10. DFT (Design for Test) scan insertion

| Command | What it does | Tier | Done |
|---|---|---|---|
| `set_dft_config` | Sets chain length, chain count, clock mixing, and the scan port name patterns | Core | 1 |
| `scan_replace` | Swaps each flip-flop for its scan-enabled equivalent from the library | Core | 1 |
| `execute_dft_plan` | Stitches the scan chains into the netlist | Core | 1 |
| `report_dft_plan` | Shows the chains that would be built, before committing to them | Core | 1 |
| `report_dft_config` | Reports the current settings | Secondary | 1 |
| `scan_opt` | Reorders the chain to shorten its wiring after placement | Secondary | 1 |

## 11. Power intent (UPF)

| Command | What it does | Tier | Done |
|---|---|---|---|
| `read_upf` / `write_upf` | Reads and writes the power intent (Unified Power Format) | Core | 1 |
| `create_power_domain` | Declares a set of instances that share a supply | Core | 1 |
| `create_power_switch` / `map_power_switch` / `define_power_switch_cell` | Declares a switch that turns a domain's supply on and off, and binds it to a library cell | Core | 2 |
| `set_isolation` | Declares isolation cells that hold a shut-off domain's outputs at a known value | Core | 1 |
| `set_level_shifter` / `set_level_shifter_cell` | Declares shifters between domains at different voltages | Core | 1 |
| `set_level_shifter_strategy` / `set_level_shifter_threshold` | Sets when a shifter is required | Secondary |  |
| `use_interface_cell` | Chooses the library cells that implement an isolation or shifter strategy | Secondary | 1 |
| `create_voltage_domain` / `set_domain_area` / `set_domain_voltage` | Gives a domain its region and its voltage | Core | 2 |
| `report_voltage_domains` | Reports the domains that are defined | Secondary | 1 |
| `create_logic_port` | Declares a control port used by the power intent | Secondary |  |

## 12. Chip-level pads and bumps

| Command | What it does | Tier | Done |
|---|---|---|---|
| `make_io_sites` | Creates the pad rows around the die, plus the corner sites | Core | 1 |
| `place_pad` / `place_pads` | Places I/O (Input/Output) pad cells into a pad row | Core | 1 |
| `place_corners` | Places the corner cells that join the pad rows | Core | 1 |
| `place_io_fill` | Fills the gaps between pads so the rings are continuous | Core | 1 |
| `place_io_terminals` | Creates the terminals on the pad instances | Secondary |  |
| `connect_by_abutment` | Connects the pad ring's power and signal rails where pads touch | Core | 1 |
| `place_bondpad` | Places bond pads on the I/O (Input/Output) cells for wire bonding | Secondary | 1 |
| `make_io_bump_array` | Creates the flip-chip bump array over the die | Core | 1 |
| `assign_io_bump` | Assigns a net, and an I/O (Input/Output) cell, to one bump | Core | 1 |
| `remove_io_bump` / `remove_io_bump_array` / `remove_io_rows` | Removes bumps or pad rows again | Secondary | 1 |
| `rdl_route` | Routes the redistribution layer from bumps to pads | Core | 1 |

## 13. 3D packaging (3DBlox)

| Command | What it does | Tier | Done |
|---|---|---|---|
| `read_3dbx` | Reads a 3DBlox design description: the dies and how they stack | Core | 1 |
| `read_3dbv` / `write_3dbv` | Reads and writes the 3DBlox view of a die | Core |  |
| `read_3dblox_bmap` | Reads the mapping between 3DBlox names and the design's | Secondary |  |
| `check_3dblox` | Checks the stack description for errors | Core | 1 |
| `add_3dblox_alignment_marker_rule` | Declares how two dies' markers must line up when bonded | Secondary | 1 |
| `check_axioms` / `check_ip` | Checks the stack against its rules and its IP (Intellectual Property) blocks | Secondary |  |

## Out of scope

- The SDC (Synopsys Design Constraints) commands and the OpenSTA reporting
  commands: their own decks.
- Graphical interface (`save_image`, `create_menu_item`, `select`, `focus_net`),
  debug hooks (`*_debug`, `set_debug_level`), and distributed workers
  (`run_worker`, `add_worker_address`).
- Metrics commands used by the flow's own reporting (`report_*_metric`).
- Research and experimental passes (`triton_part_*`, `resynth_genetic`,
  `simulated_annealing_debug`, `evaluate_*`).
- Parasitic-model building (`gen_rcx_model`, `bench_wires`, `write_rules`).
DFT (Design for Test), power intent, pads and bumps, and 3D packaging are in
scope, as sections 10 to 13. Unlike sections 1 to 9, most of their commands do
not appear in the flow scripts, because the default flow does not run them;
their tiers come from what each command does rather than from that measurement.
