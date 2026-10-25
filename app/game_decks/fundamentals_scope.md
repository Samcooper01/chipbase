# PD fundamentals deck: scope

Concepts rather than commands: the reasoning a physical designer applies, and
the ground interviews cover. Each card names the open command that shows the
effect where one exists, so an idea stays attached to something observable.

This deck is deliberately tool-independent. Where the other decks teach what a
command does, this one teaches why the command exists.

78 cards in 9 sections.

## Sections

1. **Timing basics** (12): how the setup and hold checks are formed, what slack
   measures, what makes a path critical, launch against capture, the register's
   own three parameters, metastability as a probability argument, the fastest
   frequency the design could take, half-cycle and inter-clock paths, a false
   path against a multicycle one, and time borrowing through a latch.
2. **Clocking** (11): latency against skew, which check skew helps and which it
   hurts, jitter, useful skew, clock domain crossings, the clock-gating check,
   tree structures (tree, spine, mesh), what insertion delay costs, what gating
   actually saves, duty-cycle distortion, and reset domain crossing.
3. **Variation and corners** (9): why several corners, on-chip variation, clock
   reconvergence pessimism, the direction of derating, multi-corner
   multi-mode, aging margin, library corners against parasitic corners,
   temperature inversion, and depth-dependent (advanced and parametric)
   variation.
4. **Signal integrity** (7): crosstalk delta delay against noise, the geometric
   defences, why a slow transition costs three separate things, the noise
   margin a glitch has to cross, switching windows, and when a glitch matters.
5. **Power and current** (9): where power goes, why the clock dominates, why
   voltage drop slows a design, what electromigration really is, what a
   decoupling capacitor does, power gating against clock gating, the activity
   factor, glitch power, and the leakage-temperature loop.
6. **Physical effects** (11): quadratic wire delay, fanout, why utilization is
   not pushed to the limit, congestion, what a buffer costs, why the floorplan
   decides the outcome, pin access, the metal stack, via resistance, macro
   orientation and channels, and advanced-node quantization and coloring.
7. **Flow reasoning** (10): flat against hierarchical, abstracts, why late fixes
   are engineering change orders, why closure iterates, why early timing is
   optimistic, the three-way PPA (Power, Performance, Area) trade, metal-only
   against all-layer changes, implementation against sign-off correlation,
   interface budgeting, and why setup is fixed before hold.
8. **Test concepts** (5): why scan exists, what a coverage number counts, at-speed
   against stuck-at test, what scan costs the layout, and why test mode needs
   its own constraints.
9. **Interfaces and budgeting** (4): splitting a period across a boundary,
   source-synchronous against system-synchronous interfaces, what a block's
   timing model hides, and feedthrough paths.

## Out of scope

Device physics below the level a physical designer acts on, analog design, and
architecture. Anything that is a command belongs in one of the tool decks.
