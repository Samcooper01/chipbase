# Liberty timing libraries deck: scope

Liberty carries a cell library's timing and power. The deck is checked against
the Nangate45 library shipped with OpenROAD-flow-scripts
(`NangateOpenCellLibrary_typical.lib`), and the reading cards quote it: the
header units, the `DFF_X1` cell with its `ff` group and supply pins, a hold
check on pin D, and the state-dependent leakage tables.

Liberty is a Synopsys format whose specification is licensed, so the behaviour
described here is what the open timer OpenSTA implements, and answers link to
its command reference.

## Sections

53 cards in 8 sections.

1. **Library header** (9): units, the delay model, the characterization
   conditions, the library-level default limits, the measurement thresholds and
   the transition derate, the supply rail voltage map, wire-load estimates, and
   the text against the compiled form of the same library.
2. **Cell and pin groups** (7): area and drive strength, the `ff` group that
   makes a cell sequential, supply pins, a pin's input capacitance, the boolean
   `function` expression, fanout load as the unit a fanout limit counts, and
   how a cell is kept out of a design.
3. **Special cells** (5): the `latch` group against the `ff` group, an
   asynchronous preset, a tristate output, an integrated clock gating cell with
   its state table, and a scan flop with the multiplexer built in.
4. **Timing arcs** (7): `related_pin` and `timing_type`, which direction an arc
   runs, unateness, conditional arcs with `when` and `sdf_cond`, the range of
   arc types, and a minimum pulse width constraint.
5. **Delay tables and models** (7): the two axes, the four tables per arc,
   shared templates, what a current-source model adds, interpolation against
   extrapolation past the edge, the ordering of the `values` rows, and the
   variation tables of LVF (Liberty Variation Format).
6. **Constraints and limits** (6): setup and hold, recovery and removal,
   constraint tables, the per-pin limits repair must meet, negative constraint
   values, and which of three sources of a limit applies.
7. **Power** (5): leakage per state and which value is used when the state is
   unknown, internal switching energy and its table axes, and the supply a
   table was characterized against.
8. **Reading a library** (7): cards quoting the real file, including a latch
   cell, a clock gate's state table, and a pulse width lookup.

## Out of scope

Writing or characterizing a library, the full attribute list (hundreds of
attributes, most never read by a physical designer), and statistical models.
