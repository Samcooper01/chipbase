# SDC (Synopsys Design Constraints) deck: scope

The complete SDC 2.1 command set, grouped the way the standard groups it, with
a proposed tier for each command. Sources: the command list in the
[Synopsys SDC application note](https://users.ece.utexas.edu/~mcdermot/vlsi1/VLSI2_SP_2017/synopsys/doc/Design_Compiler/sdc.pdf),
checked against the commands defined in the open-source timer
[OpenSTA](https://github.com/parallaxsw/OpenSTA/blob/master/sdc/Sdc.tcl).

Tiers (proposed, to be decided):

- **Core**: written or read in almost every block's constraints. Several cards
  each, one per flag or behaviour that is commonly confused.
- **Secondary**: appears in real constraints, less often. One or two cards each.
- **Legacy**: obsolete, synthesis-only, or tool-specific. One card at most,
  saying what replaced it, or left out.

"Done" counts the cards already written in `sdc.yaml`.

## 1. Object access (finding things in the design)

| Command | What it does | Tier | Done |
|---|---|---|---|
| `get_ports` | Returns top-level ports matching a pattern | Core | 2 |
| `get_pins` | Returns instance pins (for example `u1/A`) | Core | 2 |
| `get_cells` | Returns cell instances | Core | 2 |
| `get_nets` | Returns nets | Core | 1 |
| `get_clocks` | Returns defined clocks (clock objects, not the pins they sit on) | Core | 1 |
| `all_inputs` | Returns every input port | Core | 1 |
| `all_outputs` | Returns every output port | Core | 1 |
| `all_clocks` | Returns every defined clock | Core | 1 |
| `all_registers` | Returns sequential cells, or their clock / data / output pins | Core | 1 |
| `current_design` | Sets or returns the design the constraints apply to | Secondary | 1 |
| `get_libs` | Returns loaded libraries | Secondary | 1 |
| `get_lib_cells` | Returns library cells (for example `lib/BUF_X2`) | Secondary | 1 |
| `get_lib_pins` | Returns library cell pins | Secondary | 1 |

## 2. General purpose

| Command | What it does | Tier | Done |
|---|---|---|---|
| `set_units` | Declares the units used in the file (time, capacitance, resistance, ...) | Core | 1 |
| `current_instance` | Sets the hierarchy level that later object names are relative to | Secondary | 1 |
| `set_hierarchy_separator` | Sets the character that separates hierarchy levels in names | Secondary | 1 |
| `set`, `expr`, `list` | Tcl (Tool Command Language) basics allowed in SDC | Legacy | |

## 3. Clocks

| Command | What it does | Tier | Done |
|---|---|---|---|
| `create_clock` | Defines a clock: period, waveform, the pins or ports it enters at | Core | 4 |
| `create_generated_clock` | Defines a clock derived from another (divider, multiplier, PLL (Phase-Locked Loop)) | Core | 5 |
| `set_clock_uncertainty` | Margin for jitter and skew on setup and hold checks | Core | 2 |
| `set_clock_latency` | Source latency (before the clock pin) or estimated network latency | Core | 2 |
| `set_propagated_clock` | Uses real clock-tree delays instead of ideal clocks | Core | 1 |
| `set_clock_transition` | Slew assumed at register clock pins while clocks are ideal | Core | 1 |
| `set_clock_groups` | Declares clocks asynchronous or exclusive, so paths between them are not timed | Core | 3 |
| `set_clock_gating_check` | Setup and hold requirements on the enable of a clock-gating cell | Secondary | 1 |
| `set_sense` | Sets the unateness of a clock (or data) through a pin; replaces `set_clock_sense` | Secondary | 2 |
| `set_ideal_network` | Treats a high-fanout net (reset, scan enable) as ideal: no delay, no design-rule fixing | Secondary | 1 |
| `set_ideal_latency` | Latency on an ideal network | Secondary | 1 |
| `set_ideal_transition` | Transition on an ideal network | Secondary | 1 |
| `set_clock_sense` | Deprecated in SDC 2.1 in favour of `set_sense` | Legacy |  |

## 4. Input and output constraints

| Command | What it does | Tier | Done |
|---|---|---|---|
| `set_input_delay` | Arrival time of an input relative to a clock (the off-chip part of the path) | Core | 4 |
| `set_output_delay` | Time an output must be ready before the capturing clock edge off-chip | Core | 3 |
| `set_driving_cell` | Models the cell that drives an input port, for realistic input slew | Core | 2 |
| `set_input_transition` | Fixed slew at an input port | Core | 1 |
| `set_load` | Capacitance on an output port (or net) | Core | 2 |
| `set_drive` | Drive resistance of an input port (older alternative to `set_driving_cell`) | Secondary | 1 |
| `set_fanout_load` | Fanout load on an output port, for fanout design rules | Legacy |  |
| `set_port_fanout_number` | Number of external fanouts on a port, for wire-load estimation | Legacy |  |

## 5. Timing exceptions

| Command | What it does | Tier | Done |
|---|---|---|---|
| `set_false_path` | Removes paths from timing analysis | Core | 2 |
| `set_multicycle_path` | Allows a path several clock cycles (setup N, usually hold N-1) | Core | 3 |
| `set_max_delay` | Overrides the maximum delay allowed on a path | Core | 2 |
| `set_min_delay` | Overrides the minimum delay required on a path | Core | 1 |
| `group_path` | Puts paths into a named group for reporting and optimization priority | Core | 2 |
| `set_disable_timing` | Breaks a timing arc through a cell (for example to cut a loop) | Core | 2 |
| `set_case_analysis` | Holds a pin at a constant (mode select, test mode) and propagates it | Core | 2 |
| `set_max_time_borrow` | Limits how much time a latch path may borrow | Secondary | 1 |
| `set_data_check` | Setup and hold check between two data pins (not a clock) | Secondary | 1 |
| `set_min_pulse_width` | Minimum high or low pulse width on a clock pin | Secondary | 1 |

## 6. Design rules

| Command | What it does | Tier | Done |
|---|---|---|---|
| `set_max_transition` | Largest slew allowed on a net or pin | Core | 3 |
| `set_max_capacitance` | Largest load capacitance a driver may see | Core | 1 |
| `set_max_fanout` | Largest fanout a driver may have | Core | 1 |
| `set_min_capacitance` | Smallest load capacitance allowed | Secondary | 1 |

## 7. Environment and derating

| Command | What it does | Tier | Done |
|---|---|---|---|
| `set_timing_derate` | Scales delays for on-chip variation (early / late, cell / net) | Core | 2 |
| `set_operating_conditions` | Selects the library operating condition (process, voltage, temperature) | Secondary | 2 |
| `set_logic_zero`, `set_logic_one`, `set_logic_dc` | Ties a port to 0, 1, or don't-care (mainly synthesis) | Legacy | |
| `set_resistance` | Resistance on a net | Legacy |  |
| `set_max_area` | Area target for synthesis | Legacy |  |
| `set_min_porosity` | Routing porosity for block abstracts (old place-and-route use) | Legacy |  |
| `set_wire_load_model`, `set_wire_load_mode`, `set_wire_load_selection_group`, `set_wire_load_min_block_size` | Statistical wire-load models used before placement; physical synthesis replaced them | Legacy | |

## 8. Power and multiple voltages

| Command | What it does | Tier | Done |
|---|---|---|---|
| `set_voltage` | Sets the supply voltage on a power net | Secondary | 1 |
| `create_voltage_area` | Defines a region of the die for a voltage domain | Secondary | 1 |
| `set_level_shifter_strategy`, `set_level_shifter_threshold` | How level shifters are inserted between voltage domains | Legacy | |
| `set_max_dynamic_power`, `set_max_leakage_power` | Power targets for synthesis | Legacy | |

## Not in the standard

Commands OpenSTA adds that are not part of SDC, such as `read_sdc`,
`write_sdc`, `unset_*`, `delete_clock`, and `set_pvt`, are out of scope for this
deck. They belong in an OpenROAD deck.
