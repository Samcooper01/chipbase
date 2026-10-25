# Log forensics: scope

A drill in reading the last lines of a run and saying what went wrong. It
trains the thing a physical designer does most days and which no course
teaches: working backwards from a message to a cause.

## How the cases are made

Every case is a real run of the gcd design on Nangate45 in the `openroad/orfs`
container (OpenROAD 26Q3), broken one way at a time. Each runs in its own flow
variant, so the failures do not contaminate each other, and the excerpt is the
tail of the log that run produced, copied verbatim. The driver script and the
raw logs live in the games session's scratchpad under `logf/`.

The breakages are ordinary make overrides or an edited constraints file:

| Case | What was changed |
|---|---|
| `bad_lib` | `LIB_FILES` set to a path that does not exist |
| `bad_techlef` | `TECH_LEF` set to a path that does not exist |
| `bad_site` | `PLACE_SITE` set to a site the technology file does not define |
| `no_clock` | every `create_clock` line deleted from the constraints |
| `no_io` | every input and output delay deleted from the constraints |
| `fast_clock` | the clock period set to 0.10 nanoseconds |
| `hold_unc` | 0.30 nanoseconds of hold uncertainty added |
| `tiny_die` | utilization raised to 95 percent, placement density to 0.99 |
| `no_buffers` | every buffer and clock buffer excluded from the library |

A `bad_port` case was attempted (a clock on a port name that does not exist)
but the edit did not take, because the constraints file names the port through
a variable. That run came out identical to the good one and was dropped rather
than dressed up as a failure. It is worth redoing with the right edit.

The good run is kept too, and one case is drawn from it: a warning in a run
that passed.

41 cases in 9 sections.

## Second and third rounds

A second set of runs added the stages the first round missed. Each is again a
single override on the same design:

| Case | What was changed | What it produced |
|---|---|---|
| `bad_port` | the clock's port name set to one that does not exist | a virtual clock, and 35 unclocked registers |
| `wrong_top` | `DESIGN_NAME` set to a name with no source directory | the same make message as a missing file, from a different cause |
| `undef_module` | an instance of a module no file defines | the hierarchy check stopping at that instance |
| `latch_infer` | extra logic inserted into the source | implicit one-bit declarations and an out-of-bounds range select |
| `no_clkbuf` | `CTS_BUF_LIST` set to a cell that does not exist | the clock tree stage failing on a missing master |
| `bad_pdn` | a grid definition naming a layer the technology lacks | the power grid stage failing |
| `few_layers` | `MAX_ROUTING_LAYER` lowered without the clock's minimum | a configuration conflict caught at the floorplan |

Three attempts to squeeze the routing by lowering the maximum routing layer
were rejected at the floorplan, because the platform's minimum clock layer sat
above the new maximum. Lowering the clock's minimum to match was not enough
either: the tool would not accept a clock range of a single layer. A range of
two layers worked, and that run supplies the congestion report and the
detailed-route iteration table.

That run also closed with no violations, which says something about the design
rather than the method: gcd has 521 instances and will route on three layers.
A case showing a route that genuinely fails needs a larger design.

| Case | What was changed | What it produced |
|---|---|---|
| `congest` | routing limited to metal1 through metal3 | a real congestion report, and a route that still closed |
| `ant_off` | the same, with antenna repair skipped | (in progress when this was written) |

## Fourth round: filling the thin stages

| Case | What was changed | What it produced |
|---|---|---|
| `tight_clock` | the clock period cut from 0.46 to 0.30 nanoseconds | setup repair running 785 iterations for 0.003 nanoseconds |
| `false_all` | a false path from the clock to itself | a design with nothing left to time, and a clean check |
| `big_die` | utilization dropped to 8 percent | longer wires and more repair buffers, on a run that closed |
| `bad_pins` | port layers named that do not exist | the port placer stopping |
| `tiny_bufdist` | clock buffers forced every micrometre | a deeper tree and more area, for nothing |
| `multi_drive` | a net driven from two places in the source | the netlist check refusing to pass it on |

| `adjust` | routing layer capacities cut by 90 percent | the placer's own routability estimate, printed before any routing |

Four of that round gave nothing usable and are recorded so they are not
repeated: `low_density` (a placement density below the utilization is simply
accepted), `real_latch` (the inferred latch was optimized away, since nothing
read it), `big_cluster` (the clustering limits made no visible difference on a
design with 35 sinks), and `bad_driver` (a driver cell that does not exist is
silently ignored, leaving no evidence in the log).

The aes design squeezed onto four routing layers closed as well, with 275000
micrometres of wire and no violations. So the open flow routes both of these
designs on a thin stack, and a case showing a route that genuinely fails is
not going to come from taking layers away. It would need a design that is
dense to begin with, or a floorplan deliberately starved of area.

That run was not wasted: its detailed router passed through 5434, 2304, 1925,
100 and finally 0 violations, which is the convergence trajectory a real
design shows and which gcd is too small to produce. That is now the routing
deck's closing case.

## Fifth round: sign-off, other shapes, and the machine

Sign-off needed a platform with a rule deck, so this round ran the sky130 high
density version of the same design all the way through the KLayout design-rule
and layout-versus-schematic checks, and a nangate45 run with a deliberately
starved power grid.

| Case | What was changed | What it produced |
|---|---|---|
| `sky_signoff` | the sky130 platform, taken through `drc` and `lvs` | a clean rule count with its deck listed, and a layout-versus-schematic check that stopped while reading the netlist |
| `thin_pdn` | power straps narrowed to 0.2 and spread to a 40 micrometre pitch | the voltage drop tripling on the same power |
| `dfull` | three megabytes of space for the results directory | a stream error on closing a database, never mentioning the disk |
| `oom` | the container limited to 300 megabytes of memory | the router killed mid-pass, with only an exit code to say so |

The two machine failures are run with docker flags rather than make overrides:
a small `--tmpfs` over the results directory, and `--memory=300m`.

Three cases in this round are ordering cases rather than diagnoses, the first
in the drill to use that shape: the order a run prints its message families,
the order to check a design that closes too well, and the order to work
through hold violations that appear everywhere.

## Sections

By the stage the failure appears in: files and configuration, constraints,
floorplan and placement, clock tree, timing closure, and routing and sign-off.

## Out of scope

Failures of the container or the machine (out of memory, disk full, a killed
job), and anything specific to a commercial tool's licensing or job system.
The reasoning is the point, not the message text.
