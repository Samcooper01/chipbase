# Timing reports deck: scope

The reporting and analysis commands of OpenSTA, the open-source static timing
analyzer used by OpenROAD, grouped by what a report is used for, with a
tier for each. Source: the
[OpenSTA command reference](https://github.com/parallaxsw/OpenSTA/blob/master/doc/Commands.md).
Unlike SDC (Synopsys Design Constraints), these commands are not a standard:
each timer names and formats its reports differently, so this deck is
explicitly OpenSTA's.

Tiers:

- **Core**: run in almost every timing session. Several cards each, one per
  commonly confused option.
- **Secondary**: used for debugging or sign-off checks. One or two cards each.
- **Out of scope**: scripting internals and commands that do not report timing.

"Done" counts the cards written, by the command each card links to (the 15
report-reading cards are counted under the command whose output they show).

## 1. Path reports

| Command | What it does | Tier | Done |
|---|---|---|---|
| `report_checks` | Reports timing paths: start and end points, each stage's delay, arrival, required time, slack | Core | 21 |
| `find_timing_paths` | Returns path objects for scripting instead of printing them | Secondary | 1 |

`report_checks` carries most of the deck. Its options that are commonly
confused: `-path_delay min / max / min_max` (hold versus setup),
`-format full / full_clock / full_clock_expanded / end / summary / short`,
`-fields slew / capacitance / fanout / input_pin / net`,
`-group_path_count` versus `-endpoint_path_count`, `-unique_paths_to_endpoint`,
`-slack_max` / `-slack_min`, `-sort_by_slack`, `-path_group`,
`-from / -through / -to`, `-unconstrained`, and `-digits`.

## 2. Summary numbers

| Command | What it does | Tier | Done |
|---|---|---|---|
| `report_wns` | Worst negative slack; reports zero when every path passes | Core | 1 |
| `report_tns` | Total negative slack, summed over failing endpoints | Core | 2 |
| `report_worst_slack` | Worst slack, positive or negative | Core | 1 |
| `report_check_types` | Slack of every check type: setup, hold, recovery, removal, slew, capacitance, fanout, pulse width | Core | 4 |

## 3. Pin-level timing

| Command | What it does | Tier | Done |
|---|---|---|---|
| `report_slack` | Min / max, rise / fall slack at one pin, per clock | Secondary | 2 |
| `report_arrival` | Arrival times at one pin, per clock | Secondary | 1 |
| `report_required` | Required times at one pin, per clock | Secondary | 1 |

## 4. Clock reports

| Command | What it does | Tier | Done |
|---|---|---|---|
| `report_clock_skew` | Largest clock-arrival difference between registers that share a path | Core | 2 |
| `report_clock_latency` | Clock network latency to the registers | Core | 1 |
| `report_clock_min_period` | Smallest period (largest frequency) each clock could run at | Secondary | 2 |
| `report_clock_properties` | Period and edge times of every defined clock | Secondary | 1 |

## 5. Checking the constraints

| Command | What it does | Tier | Done |
|---|---|---|---|
| `check_setup` | Sanity checks: unclocked registers, unconstrained endpoints, missing I/O (Input/Output) delays, loops, undefined generated-clock sources | Core | 4 |
| `report_disabled_edges` | Timing arcs that are disabled, and why (constraint, constant, or loop) | Secondary | 1 |

## 6. Delay and electrical detail

| Command | What it does | Tier | Done |
|---|---|---|---|
| `report_dcalc` | How one arc's delay was calculated, for debugging delay values | Secondary | 1 |
| `report_slews` | Slews at a pin | Secondary | 1 |
| `report_net` | A net's connections and capacitance | Secondary | 1 |
| `report_instance` | An instance's pins and connections | Secondary | 1 |
| `report_edges` | Timing arcs and their delays between pins | Secondary | 1 |
| `report_lib_cell` | A library cell's pins and timing arcs | Secondary | 1 |
| `report_units` | Units used for command values and reports | Secondary | 1 |

## 7. Annotation and power

| Command | What it does | Tier | Done |
|---|---|---|---|
| `report_parasitic_annotation` | How completely extracted parasitics (SPEF (Standard Parasitic Exchange Format)) cover the nets | Secondary | 2 |
| `report_annotated_delay` | How completely SDF (Standard Delay Format) delays cover the arcs | Secondary | 1 |
| `report_annotated_check` | How completely SDF (Standard Delay Format) timing checks are covered | Secondary | 1 |
| `report_activity_annotation` | Which pins have switching activity from simulation or `set_power_activity` | Secondary | 1 |
| `report_power` | Internal, switching, and leakage power by group | Secondary | 1 |

## 8. Reading a report (15 cards, built)

Cards that show an excerpt of real report output and ask a question about it,
instead of asking what a command does: whether a path is setup or hold, how the
slack and the required time are derived, what the clock network delay and CRPR
(Clock Reconvergence Pessimism Removal) lines mean, which stage dominates the
delay, what WNS (Worst Negative Slack) and TNS (Total Negative Slack) say
together, and how to read `check_setup`, `report_check_types`,
`report_clock_skew`, `report_clock_min_period`, `report_parasitic_annotation`,
and `report_slack` output.

Every excerpt is real OpenROAD 26Q3 output from the gcd example design on the
Nangate45 library (placed, clock-tree built, routed, parasitics extracted), run
in the `openroad/orfs` Docker image, and was checked line by line against the
raw output. Three runs supply them: the original constraints, a failing variant
(both clocks at 0.38 ns and 0.15 ns of hold uncertainty), and a broken variant
(output delays removed). The scripts, raw output, and the card generator are in
`timing_reports_src/`.

The engine supports this card type through two optional card fields,
`question` and `excerpt`.

## Out of scope

Scripting and session commands (`with_output_to_variable`, `log_begin`,
`suppress_msg`, `get_property`), netlist editing (`make_instance`,
`connect_pin`, `replace_cell`), file readers and writers (`read_*`, `write_*`),
and the SDC constraint commands, which have their own deck.
