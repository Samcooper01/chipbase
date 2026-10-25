# Sign-off checks and violations deck: scope

The checks a design must pass before it can be manufactured, and what each
violation means. Unlike the command decks, this is not one tool's interface:
every foundry writes its own rules. The deck therefore teaches the families and
the reasons, using two real rule decks as the worked examples.

Grounding, all shipped inside the `openroad/orfs` image:

- **sky130 high density DRC (Design Rule Check) runset**, 918 lines of KLayout
  rules: `m1.1 : min. m1 width : 0.14um`, `m1.2` spacing, `m1.3ab` wide-metal
  spacing, `m1.4` enclosure of the contact, `m1.6` minimum area, `m1.7` minimum
  hole area, `vpp.5a` a maximum-density rule.
- **ASAP7 DRC runset**, 561 lines, whose names encode the check type:
  `WELL.W.1` width, `WELL.S.1` spacing, `WELL.A.1A` area, `GATE.S.1` an exact
  gate pitch of 54 nm, `FIN.W.1` an exact fin width of 7 nm.
- **sky130 LVS (Layout Versus Schematic) runset**: `extract_devices(mos4(...))`
  for each transistor flavour, the `connect` statements that build nets, and
  the CDL (Circuit Description Language) netlist it compares against.
- **OpenROAD's own checks**: `check_antennas`, `repair_antennas`,
  `analyze_power_grid`, and `density_fill`.

## Sections

56 cards in 7 sections.

1. **Rule families and naming** (3). Width, spacing, area, enclosure, and how
   two processes name them; rules that fix a dimension exactly rather than as a
   minimum.
2. **Geometry rules** (12). Wide-metal spacing, enclosure, minimum area and
   holes, end of line, redundant vias, slotting, recommended against required
   rules, minimum cut counts, minimum step and notch, multiple-patterning
   colouring, a violation created only by two cells abutting, and why a
   geometric violation blocks a tapeout outright.
3. **Connectivity and LVS (Layout Versus Schematic)** (9). Device extraction,
   the comparison against the intended netlist, shorts, opens, device property
   mismatches and tolerances, domain-crossing checks, a hard macro treated as a
   black box, and the supplies a netlist leaves implicit.
4. **Electrical and reliability** (11). Antenna and its fixes, floating nodes,
   electromigration on supplies and on signals, static against dynamic voltage
   drop, timing at the voltage a cell actually sees, latch-up, guard rings, and
   electrostatic discharge.
5. **Density and fill** (8). Why polishing needs even density, maximum-density
   rules, the sliding window, dummy poly and diffusion, where fill sits in the
   order of the flow, what fill does to timing, and tied against floating fill.
6. **DFM (Design for Manufacturing)** (3). Critical area and random defects,
   lithography hotspots that break no rule, and the planarity argument behind
   the density rules.
7. **Running the checks** (10). Which tool runs what, how results are counted,
   what a waiver is, corners, late fixes, the order the checks run in, block
   against chip-level checking, keeping the rule deck version straight, and why
   the checks must hold on one final database.

## Out of scope

Writing rule decks (a runset language deck would be its own thing), analog and
mixed-signal checks, packaging-level checks, and the reliability simulations
that follow sign-off.
