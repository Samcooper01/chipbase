"""Education section of Chipbase: detailed reference pages on the main
physical-design topics, each a single page covering everything a
physical-design engineer needs to know about that topic.

House standard: science voice, display equations with legends, small
inline visual guides, plain-word phrasing with acronyms expanded on
use. Each live topic carries a markdown `body` whose `##` headings
become the page's table of contents."""

STA_BODY = r"""
## What static timing analysis is

Static timing analysis is how the flow proves that a synchronous design
meets its clock, across every path, without simulating a single input
vector. Instead of applying stimulus and watching signals settle, it
reasons about delays directly on the circuit's structure. That is what
*static* means: the answer does not depend on the data flowing through
the chip, only on the timing of its gates and wires. It is the final
arbiter of whether a chip is fast enough to ship, and the inner-loop
oracle every optimization step consults.

It runs on four inputs:

- the **netlist**, the gates and the connections between them;
- the **timing libraries**, giving every gate's delay as a function of
  input transition time and output load;
- the **constraints**, chiefly the clock definitions and the timing of
  the chip's inputs and outputs, written in SDC (Synopsys Design
  Constraints);
- the **parasitics**, the resistance and capacitance of the wires,
  extracted from the layout once it exists.

From those it produces one number at every point in the design, the
*slack*, and a verdict for every sequential endpoint: met or violated.
The rest of this page develops all of that in full, from the graph at
its core through the delay models, clock effects, constraints, and
variation layers that make the numbers trustworthy at sign-off.

## The timing graph

Static timing models the design as a directed graph. Nodes are pins.
Edges are timing arcs carrying a delay: a gate arc from an input to an
output, and a net arc from a driver to its sinks. Two quantities
propagate through it. The **arrival time** of a node is the latest a
signal can reach it; the **required time** is the latest it may arrive
and still meet the clock. Their difference is the margin at that node.

<div class="eq">slack = required − arrival</div>

<ul class="eq-legend">
<li><code>slack</code> the timing margin: positive means met, negative means violated</li>
<li><code>required</code> the latest allowed arrival, swept backward from the constraints</li>
<li><code>arrival</code> the worst-case arrival, swept forward from the clocks</li>
</ul>

Two linear sweeps compute it for the whole design. A forward sweep sets
each node's arrival to the **maximum** over its incoming edges, so the
slowest path always wins. A backward sweep sets each node's required
time to the **minimum** over its outgoing edges. One subtraction per
node then gives slack, and the minimum-slack chain is the critical
path. The figure sweeps a small graph both ways.

<div class="walk-fig" data-walk="sta-graph"></div>

The power of this is that the number of paths can be astronomical, but
one arrival value per node summarizes every path reaching it, so two
sweeps that are linear in the circuit size replace an impossible
enumeration.

Slew (transition time) propagates through the same graph, and it is not
just along for the ride: it is what the delays are computed from. A gate
arc's delay depends on the slew arriving at its input and the load on
its output, so the timer must know a node's input slew before it can
find the arc's delay. The forward sweep therefore carries slew and
arrival together: each arc turns its input slew and load into an output
slew, that output slew becomes the next stage's input slew, and the
same numbers give the delay that advances the arrival. Slew moves
forward only; the backward required-time sweep does not need it. Rising
and falling edges propagate as separate values, and the min and max
corners attach as extra tagged values, all without changing the
two-sweep structure.

## Setup and hold: the two checks

A flip-flop captures its data input only if that input is stable across
a small window around the clock edge: the **setup time** before the
edge and the **hold time** after it. On a path from a launch flip-flop
through logic to a capture flip-flop, those two library numbers become
two checks.

<div class="eq">setup slack = (T − t<sub>su</sub>) − arrival<sub>max</sub></div>
<div class="eq">hold slack = arrival<sub>min</sub> − t<sub>hold</sub></div>

<ul class="eq-legend">
<li><code>T</code> the clock period, the time to the next capture edge</li>
<li><code>t<sub>su</sub></code>, <code>t<sub>hold</sub></code> the capture flip-flop's setup and hold times</li>
<li><code>arrival<sub>max</sub></code> latest data arrival, from the slowest path</li>
<li><code>arrival<sub>min</sub></code> earliest data arrival, from the fastest path</li>
</ul>

The asymmetry drives everything downstream. Setup is the *late* check: it uses
the maximum path delay and measures data against the *next* clock edge,
so a longer period buys margin. Hold is the *early* check: it uses the
minimum path delay and measures data against the *same* edge, so the
period cancels and no clock setting can fix a hold violation. The
figure shows the aperture and then each check in turn.

<div class="walk-fig" data-walk="setup-hold"></div>

Because the two pull in opposite directions, a legal path must satisfy
both at once: speeding a path up helps setup and hurts hold, and adding
delay does the reverse. Setup dominates the target-frequency question
and is optimized throughout the flow; hold is closed late, after the
clock tree and routing fix the real delays, by inserting delay on the
fastest paths.

## Timing paths and path groups

Every check lives on a **timing path**: a start point where a value is
launched and an end point where it is captured. Start points are
primary inputs and register clock pins; end points are register data
pins and primary outputs. That gives four kinds of path the timer must
constrain:

<table>
<thead><tr><th>path</th><th>from</th><th>to</th><th>constrained by</th></tr></thead>
<tbody>
<tr><td>register to register</td><td>a launch flip-flop</td><td>a capture flip-flop</td><td>the clock period</td></tr>
<tr><td>input to register</td><td>a primary input</td><td>a flip-flop</td><td>input delay + clock</td></tr>
<tr><td>register to output</td><td>a flip-flop</td><td>a primary output</td><td>clock + output delay</td></tr>
<tr><td>input to output</td><td>a primary input</td><td>a primary output</td><td>input and output delay</td></tr>
</tbody>
</table>

The timer collects paths into **path groups**, usually one per clock
plus a group for the input/output paths, so the report and the
optimizer can treat each clock domain on its own. A path that crosses
from one clock to another is analyzed against the relationship between
those two clocks, which is why clock definitions matter so much.

The **interface** paths, input-to-register and register-to-output, are
budgeted against the logic outside the block. That external logic is modeled
with an input or output delay relative to a **virtual clock**: a clock with
no physical pin that stands in for the timing of the off-chip or
neighbouring device. The interface budget is shared: whatever the outside
logic consumes, the block does not have. When an interface path will not
close, one option optimizes the internal logic, and another **registers the
boundary port**, placing a flip-flop right at the input or output. That
turns a long input-to-register or register-to-output path into a short one
plus a clean register-to-register path, reclaiming clock frequency, at the
cost of one extra cycle of latency through the interface. Trading latency
for frequency this way is a common interface-timing decision.

## Slack, WNS, and TNS

Slack is computed per endpoint, but a design has millions of them, so
two summary numbers describe its timing health:

- **WNS (Worst Negative Slack)**: the single worst slack in the design.
  It answers "how badly is the worst path failing?" and sets the
  frequency the design can actually run at.
- **TNS (Total Negative Slack)**: the sum of the negative slacks over
  all failing endpoints. It answers "how much failure is there?" A
  design can have a small WNS but a large TNS if many endpoints fail by
  a little, which is a different repair problem than one deep
  violation.

Both are reported per path group and per corner, and both must be clean
across the whole MCMM matrix before a chip signs off.


## Delay calculation and library models

The edges of the graph get their numbers from delay calculation, and
this is where accuracy is won or lost. A cell arc's delay is not a
constant: it is a function of two variables, the **input transition
time** (slew) and the **output load** the cell drives. A sharper input
edge and a lighter load give a faster arc.

- **NLDM (Non-Linear Delay Model)** stores each arc as a two-dimensional
  lookup table indexed by input slew and output capacitance, with the
  timer interpolating between entries. It returns both the arc delay
  and the output slew, which becomes the next stage's input slew. It is
  the standard delay model for older nodes.
- **Effective capacitance** is the fix NLDM needs on real wires. A
  resistive interconnect shields the far capacitance from the driver,
  so the cell does not see the full lumped load. The timer iterates a
  single effective capacitance that reproduces the true output
  waveform.
- **CCS (Composite Current Source)** and **ECSM (Effective Current
  Source Model)** replace the single delay number with the cell's
  output modeled as a current source over time. Capturing the waveform
  shape, not just a delay point, makes them far more accurate on the
  resistance-dominated loads and noise analysis of advanced nodes.

The interconnect itself is a circuit. Extraction turns each net into a
resistance-capacitance network, and the timer reduces that network to a
delay and an output slew, first order by the Elmore delay and more
accurately by higher-order moment matching. Slew degrades as it
propagates, so a poorly buffered net hurts every stage downstream of
it, not just its own delay.

## Clocks: latency, skew, jitter, and uncertainty

Before the clock tree is built the timer treats the clock as **ideal**,
reaching every flip-flop at the same instant. After clock tree
synthesis it uses the **propagated** clock, through the real tree, and
several clock effects enter the checks:

- **Latency** is the delay from the clock source to a flip-flop, split
  into source latency (off-chip and up to the definition point) and
  network latency (through the on-chip tree).
- **Skew** is the difference in clock arrival between the launch and
  capture flip-flops. It shifts the checks directly, and in opposite
  directions for the two checks.
- **Jitter** is cycle-to-cycle variation in the clock edge, mostly from
  the phase-locked loop generating it.
- **Uncertainty** is a lumped margin (set by `set_clock_uncertainty`)
  that folds jitter and extra guard-band into a single number,
  subtracted from the setup window and added to the hold window.

Writing the setup check with these terms shows how skew helps or hurts:

<div class="eq">setup slack = T + skew − t<sub>ck→q</sub> − delay<sub>max</sub> − t<sub>su</sub> − uncertainty</div>

<ul class="eq-legend">
<li><code>T</code> the clock period</li>
<li><code>skew</code> capture-clock latency minus launch-clock latency (positive helps setup)</li>
<li><code>t<sub>ck→q</sub></code> the launch flip-flop's clock-to-output delay</li>
<li><code>delay<sub>max</sub></code> the slowest combinational path delay</li>
<li><code>t<sub>su</sub></code>, <code>uncertainty</code> the setup time and the clock uncertainty margin</li>
</ul>

The same skew that adds to setup slack subtracts from hold slack, which
is why a clock tree that helps one check can break the other, and why
useful-skew optimization is done carefully against both.

## More sequential checks

Setup and hold are the common pair, but the timer runs several more
checks on sequential and clock structures:

- **Recovery and removal** are the setup and hold of asynchronous set
  and reset pins: the deassertion of an async control must clear the
  clock edge by a recovery time (like setup) and hold past it by a
  removal time (like hold).
- **Minimum pulse width and minimum period** ensure a clock's high and
  low phases are wide enough for the flip-flops and that the period is
  legal for the library.
- **Clock-gating checks** time the enable signal at a clock gate so the
  gated clock never produces a partial or glitched pulse.
- **Latch timing and time borrowing**: a level-sensitive latch is
  transparent while its clock is active, so data may arrive after the
  opening edge and still be captured. That lets a slow path *borrow*
  time from the next stage's budget, a flexibility flip-flops do not
  have and a bookkeeping the timer must track across phases.

## Constraints (SDC): defining the problem

The timer only knows what the constraints tell it, so the SDC (Synopsys
Design Constraints) file is half the analysis. The core commands define
the clocked world:

- `create_clock` defines a clock's period and waveform on a port or
  pin; `create_generated_clock` derives dividers, multipliers, and
  multiplexed clocks from it.
- `set_input_delay` and `set_output_delay` model the timing of logic
  outside the block, relative to a clock, so the input-to-register and
  register-to-output paths are constrained.
- `set_clock_latency` and `set_clock_uncertainty` supply the clock
  numbers above.

On top of that sit the **exceptions**, which tell the timer where the
default single-cycle assumption is wrong:

<table>
<thead><tr><th>exception</th><th>meaning</th></tr></thead>
<tbody>
<tr><td><code>set_false_path</code></td><td>this path is never timed (a logically impossible path, or an asynchronous crossing)</td></tr>
<tr><td><code>set_multicycle_path</code></td><td>this path is allowed N clock cycles, not one</td></tr>
<tr><td><code>set_max_delay</code> / <code>set_min_delay</code></td><td>a direct point-to-point delay override</td></tr>
<tr><td><code>set_case_analysis</code></td><td>a pin is tied to a constant, pruning mode-select logic</td></tr>
<tr><td><code>set_clock_groups</code></td><td>clocks are asynchronous or mutually exclusive, so cross-domain paths are not timed together</td></tr>
</tbody>
</table>

The danger runs both ways. A missing false-path or multicycle exception
makes the timer report violations that cannot happen, wasting effort
chasing impossible paths. A missing or wrong constraint leaves real
paths untimed, so the design can pass analysis and fail in silicon.
Constraint quality is its own discipline.

## Corners and modes (MCMM)

A single analysis is not enough, because delay depends on manufacturing
and environment. The libraries are characterized at **PVT** corners:
combinations of Process (fast or slow silicon), Voltage, and
Temperature. Slow-process, low-voltage, high-temperature conditions
generally make gates slow and stress setup; the fast, high-voltage,
cold corner makes them fast and stresses hold. Advanced nodes add
temperature inversion, where cold can be the slow case, so corners are
chosen from characterization rather than assumed. Interconnect adds its
own resistance-capacitance corners.

Alongside corners are **modes**: functional, test, scan, and low-power
modes, each with its own constraints. **MCMM (Multi-Corner Multi-Mode)**
analysis evaluates every enabled corner-and-mode scenario, and sign-off
requires that all of them pass. Setup is dominated by the slow corners,
hold by the fast, so a design is genuinely closed only when the whole
matrix is clean.

## On-chip variation and pessimism removal

Even within one die, no two transistors are identical, so a single
corner is optimistic about the difference between two paths on the same
chip. **OCV (On-Chip Variation)** models this by derating: slow the data
path down and speed the capture clock path up for a setup check, and
the reverse for hold, so the check sees a pessimistic split.

Flat derating over-counts, and two refinements pull the pessimism back:

- **CPPR (Common-Path Pessimism Removal)**: the launch and capture
  clocks share a common segment of the tree. Derating that shared
  segment in opposite directions is physically impossible, so the timer
  credits the double-count back. This is often the difference between a
  false hold failure and a real one.
- **AOCV (Advanced OCV)** and **POCV (Parametric OCV)** make derating
  depend on the statistics of the path rather than a flat factor. A
  deeper path averages out more variation, so it needs less margin;
  parametric OCV assigns each cell a single sigma and combines them
  statistically. Both cut the pessimism of flat OCV while staying
  conservative.

Fully statistical timing, **SSTA (Statistical Static Timing Analysis)**,
carries delay distributions through the graph and reports a slack
distribution and a yield. It is the most rigorous treatment of
variation but the heaviest, and in practice corner-based analysis with
parametric OCV is the common industrial choice.

## Crosstalk and signal-integrity timing

Neighboring wires couple through capacitance, so a switching
**aggressor** net injects charge onto a quiet or switching **victim**.
The timing effect is a **delta delay**: if the aggressor switches the
same way as the victim it speeds the victim up, and if it switches the
opposite way it slows it down. A stable victim can also see a **noise
glitch** large enough to be captured as a wrong value.

Signal-integrity-aware timing computes these delta delays and folds
them into the path delay, using timing windows to decide which
aggressors can actually align with the victim's transition. It matters
most on long, tightly packed routes at advanced nodes, and it is a
mandatory part of sign-off there.

## Static timing in the flow and at sign-off

The same computation appears in two guises. Inside synthesis,
placement, clock tree synthesis, and routing it runs *incrementally* as
the optimizer's oracle: fast, approximate, and re-evaluated after every
local change so the tool knows whether a move helped. At the end it runs
as *sign-off*: accurate delay models, extracted parasitics, the full
multi-corner multi-mode matrix, signal-integrity delta delays, and
pessimism removal, on the final layout.

Closing timing means driving WNS (Worst Negative Slack) to zero or
positive and keeping TNS (Total Negative Slack) under control at every
corner and mode, with hold fixed after the clock and routing are real.
The last iterations are targeted engineering-change-order fixes, guided
by exactly the slack reports this page has built up. Everything in
static timing analysis either feeds this graph better numbers or reads
its slack report more precisely.

## Reading a timing report

A timing report (in the open flow, `report_checks` in OpenSTA) prints
one critical path at a time as a running sum. Read it as three parts:

1. **The header**: the start point, the end point, the path group, and
   the analysis type (max for setup, min for hold).
2. **The data path**: a point-by-point accumulation of delay from the
   launch clock edge through each gate and net to the endpoint's data
   pin, ending in the **data arrival time**.
3. **The clock and constraint side**: the capture clock edge, plus or
   minus clock latency and uncertainty, and the setup or hold time,
   giving the **data required time**.

The last line subtracts the two into slack and prints MET or VIOLATED.
Learning to read this accumulation, and to see which gate or net is
eating the budget, is the core skill of timing closure and the reason
every section above matters in practice.
"""

FLOORPLANNING_BODY = r"""
## What floorplanning is

Floorplanning is the first physical step of the flow. It fixes the size
and shape of the die, the location of the large blocks and memories, the
ring of input and output cells, and the power grid, all before a single
standard cell is placed. It turns a synthesized netlist and a set of
area and timing targets into a physical frame that every later stage
works inside. Its decisions are expensive to undo, so the floorplan sets
the ceiling on the quality the rest of the flow can reach.

<div class="walk-fig" data-walk="fp-overview"></div>

## The inputs and the die

A floorplan starts from the gate-level netlist, the area of every
standard cell and macro, the timing constraints, and a target die. The
engineer sets:

- the **core area**, where standard cells and macros go, and the **die
  area** around it that holds the input and output cells and the seal
  ring;
- the **aspect ratio**, the width-to-height ratio of the core;
- the **utilization**, the fraction of the core filled by cells.

Inside the core, standard cells do not float freely. They sit in **rows**
of a fixed height, aligned to a grid of **placement sites**. Every cell
in the library is built to that row height and to an integer number of
site widths, so a cell fills a whole number of sites in one row, and the
power and ground rails run horizontally along the row edges. The number
of rows follows from the core height:

<div class="eq">rows = core height / row height</div>

<ul class="eq-legend">
<li><code>core height</code> the vertical extent of the core area</li>
<li><code>row height</code> the fixed height of a standard-cell row, set by the cell library</li>
</ul>

Placement, the power rails, and later legalization all snap to this row
and site grid, so the die and core fixed here set the coordinate frame
for everything that follows.

<div class="walk-fig" data-walk="fp-die"></div>

## Aspect ratio and utilization

Utilization is the fraction of the core area occupied by cells:

<div class="eq">utilization = cell area / core area</div>

<ul class="eq-legend">
<li><code>cell area</code> the total area of the standard cells and macros to be placed</li>
<li><code>core area</code> the area available to place them in</li>
</ul>

It fixes the size of the die, and through that the two competing costs of
the floorplan. A low utilization leaves wide gaps between cells: wires
stay short and the router has spare tracks, but the die is large and each
die costs more. A high utilization shrinks the die, but the same wires
now share fewer routing tracks, so congestion rises and the router either
detours signals or fails to finish. The floorplan sets the point where
the design still routes and closes timing on the smallest die.

The size effect is direct. One square millimetre of cell area at 70
percent utilization needs a core of 1 / 0.70 = 1.43 square millimetres;
raising utilization to 85 percent shrinks the core to 1.18 square
millimetres, a 17 percent smaller die, while giving the router 15 fewer
percentage points of empty area to route in. The starting value is chosen
from how much routing the design demands:

<table>
<thead><tr><th>design character</th><th>typical starting utilization</th><th>reason</th></tr></thead>
<tbody>
<tr><td>control logic, few wide buses</td><td>70 to 80 percent</td><td>routing demand is moderate, so area is the limit</td></tr>
<tr><td>routing-heavy: wide buses, high fanout</td><td>55 to 70 percent</td><td>routing tracks run out before cell area does</td></tr>
<tr><td>macro-dominated</td><td>set by macro packing</td><td>the macros and their channels fix the area, not cell fill</td></tr>
</tbody>
</table>

Aspect ratio is the width-to-height ratio of the core:

<div class="eq">aspect ratio = core width / core height</div>

<ul class="eq-legend">
<li><code>core width</code>, <code>core height</code> the two side lengths of the core rectangle</li>
</ul>

A near-square core, with an aspect ratio close to 1, is the usual
default: it keeps the longest cross-core wire short and balances the
horizontal and vertical routing demand. A non-square ratio is chosen when
the block must abut a neighbour of a fixed shape, fit a package outline,
or carry a wide interface along one edge. An elongated core lengthens the
standard-cell rows and the worst-case wire, which costs timing on the
paths that cross the chip.

<div class="walk-fig" data-walk="fp-aspect"></div>

## Macros and blocks

Hard macros, such as memories, analog blocks, and purchased IP
(Intellectual Property), have fixed shapes and internal layouts. They
must be placed deliberately, by hand or by a macro placer, before the
standard cells. Their placement dominates the floorplan: a memory in the
wrong corner forces long buses across the die and walls off routing
behind it.

Three rules keep macro placement out of trouble:

<table>
<thead><tr><th>rule</th><th>what it means</th><th>why</th></tr></thead>
<tbody>
<tr><td>push macros to the core edge</td><td>line the macros along the boundary, logic in the centre</td><td>leaves one connected region for standard cells, with no walled-off islands</td></tr>
<tr><td>face the pins inward</td><td>orient each macro so its pin side looks at the logic that uses it</td><td>shortens the buses to and from the macro</td></tr>
<tr><td>leave channels between macros</td><td>a gap wide enough for the crossing buses plus buffers</td><td>a too-narrow channel congests and cannot be buffered</td></tr>
</tbody>
</table>

Around each macro the floorplan adds a **keepout halo**, a margin no
standard cell may enter. The halo reserves room for the macro's pins and
their access, keeps cells off the edge where routing is densest, and
leaves space to buffer the signals entering and leaving.

When many macros must fit a tight, fixed die outline, the floorplan is also
a **packing** problem: the macros have to sit legally, with no overlap and
none spilling past the outline, at high utilization. A common approach packs
them into columns, largest first, filling each column before starting the
next. Reaching the target utilization by leaving macros overlapping or
outside the outline is not a legal floorplan, so packing density and
legality are judged together with the quality rules above.

<div class="walk-fig" data-walk="fp-macros"></div>

## Partitioning

A large system-on-chip is too big to floorplan as one flat block, so it
is split into a hierarchy of blocks that are floorplanned and
implemented separately, then assembled at the top level. Partitioning
decides that split.

The quality of a split is measured by its **cut size**: the number of
nets that have pins in more than one block. Partitioning minimises the
cut while keeping the block areas balanced, so that few connections cross
between blocks and no single block dominates the die. Fewer crossing nets
mean shorter top-level wiring and cleaner timing at the boundaries, where
signals are slowest to close.

In practice the partition follows the design's register-transfer
hierarchy, the functional blocks the design was written as, refined by
how tightly parts are connected and how large each block should be. A
good partition is balanced in size, has clean and narrow interfaces, and
keeps high-bandwidth communication inside a block rather than across its
edge. Each block is then assigned a region of the die, which is where
partitioning meets the floorplan.

<div class="walk-fig" data-walk="fp-partition"></div>

## The power delivery network

Before cells are placed, the floorplan lays down the power grid: rings
around the core, straps across it on the upper metal layers, and rails
feeding the standard-cell rows. The grid is a hierarchy from wide upper
metal down to the narrow rails, carrying current from the package into
every cell. Two limits size it.

The first is the supply voltage lost in the grid's own resistance, the
IR (current times resistance) drop:

<div class="eq">V<sub>drop</sub> = I &times; R</div>

<ul class="eq-legend">
<li><code>V<sub>drop</sub></code> the supply voltage lost between the package and the cell</li>
<li><code>I</code> the current drawn through that part of the grid</li>
<li><code>R</code> the resistance of the metal carrying it</li>
</ul>

The drop is budgeted to a small fraction of the supply, commonly a few
percent, because a cell that sees a lower voltage switches more slowly
and loses timing. A wider or denser grid lowers R and the drop. The
second limit is **electromigration**: too high a current density in a
wire slowly moves metal atoms over the chip's life and eventually opens
the wire, so every segment has a maximum current density it must stay
under.

Both limits push toward more and wider metal, but the power grid competes
with signal routing for the same upper layers, so its density is a
floorplan-level trade-off between a quiet supply and routable space.

The IR drop above is the static average. Current also swings sharply as
blocks switch, and when demand spikes faster than the package and grid can
respond, the local supply sags for a moment: dynamic voltage droop.
**Decoupling capacitors** (decaps), placed as filler cells near switching
logic, hold a small reservoir of charge that feeds these fast spikes
locally until the grid catches up. Enough decap is budgeted into the
floorplan to keep the droop inside the same voltage margin as the static
drop.

The grid is not one uniform mesh. Different regions draw different current:
a dense, high-activity block needs a tighter mesh than a quiet one. A
uniform grid sized for the worst region wastes routing space everywhere
else, and one sized for the average starves the hot spots, so the mesh
density is set **per region** to that region's current and voltage-drop
budget.

At the bottom of the hierarchy, the mesh straps drop through via arrays
onto the thin metal-1 power rails that run along each standard-cell row, and
every cell taps its rail. That last stretch of supply, from the nearest
strap along the rail to the cell, is a local IR drop of its own, so the
strap pitch is chosen so no cell sits too far from a strap.

<div class="walk-fig" data-walk="fp-pdn"></div>

## Power domains and multi-voltage

Not all of a chip runs at one voltage. To save power, blocks that can
tolerate it run on a lower supply, and blocks that are idle are switched
off entirely. The floorplan groups the logic into **voltage domains**, each
a contiguous region on its own power grid, so a whole domain can be
supplied at a different voltage or powered down as a unit.

Special cells guard the domain boundaries:

<table>
<thead><tr><th>cell</th><th>sits where</th><th>what it does</th></tr></thead>
<tbody>
<tr><td>level shifter</td><td>on a signal crossing between two voltages</td><td>translates the logic levels so the receiving domain reads them correctly</td></tr>
<tr><td>isolation cell</td><td>on a signal leaving a domain that can power off</td><td>clamps that signal to a safe constant, so on logic downstream never sees a floating input while the domain is dark</td></tr>
<tr><td>retention register</td><td>inside a domain that can power off</td><td>keeps the domain's state in a small always-on latch, so it resumes without a full reset</td></tr>
</tbody>
</table>

Placing each domain as one contiguous region, with short boundaries and its
special cells accounted for, is a floorplan decision. A domain scattered
across the die needs a long, leaky boundary and a tangled power grid.

## Thermal-aware floorplanning

Power turns into heat, and heat is not spread evenly: a block that switches
hard, a processor core or a high-speed interface, is a hot spot.
Temperature raises both transistor delay and leakage, and higher leakage
raises temperature further, so a dense cluster of hot logic can run away.
The floorplan spreads the heat by keeping the highest-power blocks apart
rather than packing them together, and by leaving cooler logic or
whitespace between them to carry heat away. This pulls against wirelength,
which wants related hot blocks close, so thermal-aware floorplanning is a
trade-off between a short net and an even temperature map.

## Input and output placement

The input and output cells sit in the die periphery, or, for a flip-chip
part, in an area array of bumps across the whole die. Their placement
sets where signals enter and leave, so it constrains the internal layout.
For a block inside a larger chip, the pin locations on its boundary are a
contract with the parent design; placing each pin near the logic that
drives or receives it shortens the top-level routing.

The pins of a bus belong together. A wide interface, a memory bus or a
high-speed serial link (SerDes - Serializer/Deserializer), is placed as one
contiguous block of pins on the boundary, right beside the datapath that
drives it, so the whole bundle stays local and its bits can be kept
length-matched. Scattering a bus's pins around the edge forces long, skewed
top-level routes.

<div class="walk-fig" data-walk="fp-io"></div>

Two packaging styles set how the connections are made:

<table>
<thead><tr><th></th><th>wire-bond periphery</th><th>flip-chip area array</th></tr></thead>
<tbody>
<tr><td>connections</td><td>a ring of pads at the die edge</td><td>solder bumps over the whole die area</td></tr>
<tr><td>count</td><td>limited by the die perimeter</td><td>many more, limited by die area</td></tr>
<tr><td>supply</td><td>enters only at the edge, weaker</td><td>enters across the area, much stronger</td></tr>
<tr><td>typical use</td><td>lower pin-count, lower-cost parts</td><td>high-performance, high pin-count parts</td></tr>
</tbody>
</table>

Most high-performance parts are flip-chip: the die is turned face-down
and bonded through the bump array, which gives many more connections and,
because power can enter anywhere across the area, a much stronger supply.

The flip-chip bumps are not spread evenly by default. Because the supply
enters through them, the bump array is placed to match the chip's current
map: more power bumps over high-current blocks, fewer over quiet ones, and
none where a bump is disallowed, such as a keepout over a sensitive macro. A
bump pattern that ignores where the current is actually drawn leaves a hot
block starved even when the total bump count looks sufficient.

<div class="walk-fig" data-walk="fp-flipchip"></div>

## Placement blockages and regions

Blockages tell the placer where it may not put cells, and regions tell it
where certain cells must go. Together they shape congestion and timing
before placement begins.

<table>
<thead><tr><th>control</th><th>effect</th><th>used for</th></tr></thead>
<tbody>
<tr><td>hard blockage</td><td>no cell may be placed in the area</td><td>over a macro, or a sensitive analog region</td></tr>
<tr><td>soft blockage</td><td>cells are discouraged but allowed if needed</td><td>steering placement away from a region without forbidding it</td></tr>
<tr><td>partial blockage</td><td>caps the cell density in the area</td><td>relieving a congestion hotspot</td></tr>
<tr><td>region / group</td><td>pins named logic into a specific area</td><td>keeping a functional block or a datapath together</td></tr>
</tbody>
</table>

<div class="walk-fig" data-walk="fp-blockages"></div>

## Why the floorplan decides the flow

A floorplan is judged not by itself but by what it lets the rest of the
flow achieve. A good one delivers:

- short reachable wirelength, so placement and routing start close to
  their targets;
- a routable congestion map, with routing tracks where the wires need
  them;
- a power grid that meets its voltage-drop and electromigration limits;
- macro and pin positions that let timing close without long detours.

Because every later stage works inside the frame the floorplan fixes, a
weak floorplan cannot be rescued by good placement or routing, and its
decisions are expensive to undo once cells are placed. That is why
floorplanning, though it places nothing small, is the stage that most
determines the final result.

<div class="walk-fig" data-walk="fp-quality"></div>
"""

PLACEMENT_BODY = r"""
## What placement is

Placement assigns every standard cell a legal location in the rows of
the core, taking the floorplan as fixed. It is where the netlist becomes
a physical arrangement, and it decides most of the wirelength, and
therefore most of the delay and power, before routing runs. A modern
block has millions of cells, so placement is a large numerical
optimization, not a hand process.

## Wirelength: the objective

The quantity placement minimizes is total wirelength, estimated for each
net before routing exists by its half-perimeter wire length:

<div class="eq">HPWL = (x<sub>max</sub> − x<sub>min</sub>) + (y<sub>max</sub> − y<sub>min</sub>)</div>

<ul class="eq-legend">
<li><code>HPWL</code> the Half-Perimeter Wire Length of one net</li>
<li><code>x<sub>max</sub>, x<sub>min</sub></code> the extreme pin x-coordinates on the net</li>
<li><code>y<sub>max</sub>, y<sub>min</sub></code> the extreme pin y-coordinates on the net</li>
</ul>

The half-perimeter of the bounding box is exact for two- and three-pin
nets and a good estimate otherwise, and summed over all nets it is the
placer's cost. Minimizing it pulls connected cells together while
density limits push them apart.

## Global placement

Global placement finds an approximate, slightly overlapping arrangement
that minimizes wirelength subject to spreading cells out. Two families
dominate. **Analytical placers** model wirelength and density as smooth
functions and solve for the minimum, either by quadratic optimization
with a spreading force, or by nonlinear solvers on modern
GPU-accelerated tools. **Force-directed** placers treat nets as springs
pulling cells together against a repulsive density force. Both end with
cells roughly where they belong but not yet on legal sites.

## Legalization

Legalization snaps the overlapping global-placement result onto legal
standard-cell sites in the rows, moving each cell as little as possible
so wirelength is barely disturbed. Cells sit in fixed-height rows
aligned to the power rails, and legalization removes overlaps and
off-grid positions. The figure shows cells resolved into rows.

<div class="walk-fig" data-walk="stdcell-rows"></div>

## Detailed placement

Detailed placement is a local cleanup pass on the legal result, recovering
the quality legalization had to give up, without breaking legality. It has a
few distinct moves:

- **swapping** two neighbouring cells, when trading their positions shortens
  the nets through them;
- **sliding** a cell along its row into nearby whitespace;
- **flipping** a cell's orientation. Mirroring a cell left-to-right swaps
  which edge its input and output pins sit on, so a pin can be turned to
  face its partner across the net and shorten the connection.

It can also **pad** a cell, reserving a little extra space beside a
pin-dense cell so the router has room to reach every pin. Padding relieves a
local pin-access hotspot at the cost of a little area, so it is applied only
where pin access is tight, not across the whole block.

## Density and congestion

Wirelength alone would pile cells into a heap, so placement enforces a
density limit per region and, in congestion-aware mode, spreads cells
out of areas the router would overflow. A congestion map (estimated by a
quick trial global route, or by an analytical measure) tells the placer
where to open space. Trading a little wirelength for routability here
prevents unroutable hotspots later.

## Timing-driven placement

Pure wirelength does not know which nets are timing-critical.
Timing-driven placement weights nets by their timing slack, pulling the
cells on critical paths closer while letting slack paths stretch. It
runs static timing incrementally as it places, so the arrangement is
optimized for the paths that actually set the clock, not just for total
wire.

## Clock-aware placement

A register's position decides how far the clock has to travel to reach it.
If the flip-flops that share a clock are scattered across the block, the
clock tree that serves them is long: more buffers, more power, and harder
to balance for skew. Clock-aware placement pulls the registers of a clock
into tighter clusters as it places them, shortening the tree that clock
tree synthesis will later build on top of the placement. It trades a little
data-path wirelength for a smaller, lower-power, easier-to-balance clock,
so it is placement done with the next stage in mind.

## Mixed-size placement

When movable macros sit alongside standard cells, the placer must handle
both scales at once. Mixed-size placement floats the macros during
global placement, then fixes them and places the sea of cells around
them. Getting the macro and cell placement to agree is the hardest part
of placing a modern block, and it links placement back to the
floorplanning decisions above.

## Filler and tap cells

When the real cells are placed, gaps remain between them in the rows, and
two kinds of always-present cells fill those gaps. **Filler cells** are
dummy cells with no logic that continue the power rails and the wells
across the gaps, so each row stays electrically continuous and
manufacturable; the decoupling-capacitor fillers from the power work sit
here too. **Tap cells** (well taps) tie the wells and substrate to the
supply and ground at a regular pitch, which a design rule requires: no
transistor may be farther than a fixed distance from a tap, or the chip
risks latch-up. Both are inserted after placement on a fixed spacing, and
both are checked again at physical verification.

## Placement regions and constraints

Sometimes the placer must be told where certain cells may or may not go. A
**region** (or guide) pulls a named group of cells toward a chosen area
without forbidding other cells from sharing it. A **fence** is exclusive: it
reserves an area for one group and keeps every other cell out. These
constraints keep a functional block, a power domain, or a datapath together,
or hold cells away from a sensitive area, so the placer still minimizes
wirelength but does it inside the boundaries the floorplan set, not freely
across the whole die.

## Placement and the downstream flow

Placement hands routing a congestion map it must live with and hands
timing the delays it will try to close. A placement that ignores
congestion routes badly, and one that ignores timing closes slowly.
Because it sets wirelength, placement is the largest single lever on
power and performance after the floorplan, and every later stage is
shaped by it.
"""

CTS_BODY = r"""
## What clock tree synthesis is

Clock tree synthesis builds the network that carries the clock from its
source to the clock pin of every flip-flop. Placement leaves the clock
as a single ideal net; clock tree synthesis replaces it with a real,
buffered tree that reaches thousands of sinks. Its goal is to make the
clock arrive at every flip-flop at nearly the same time, because the
spread in arrival, the skew, is subtracted directly from the timing
budget of every path.

## Skew, latency, and insertion delay

Three numbers describe a clock tree:

- **Skew** is the difference in clock arrival time between two
  flip-flops. Low skew is the primary goal, because skew eats setup and
  hold margin.
- **Latency**, or **insertion delay**, is the delay from the source to a
  flip-flop. It is the price of driving the tree, and it is kept as
  equal as possible across sinks.
- **Transition (slew)** at each clock pin must stay sharp, or the
  flip-flops see a slow, uncertain edge.

Skew and latency trade off: a deeper, more buffered tree can balance
skew tightly but adds latency, and latency itself interacts with
variation, so the two are optimized together.

## Balancing from the source

The simplest clock network is a **star**: one driver at the source wired
straight to every flip-flop. Balancing it means positioning that source so
its distances to the sinks are as even as possible. But a star has an
irreducible skew floor, because the sinks sit at different distances and one
driver cannot equalize them, and a single gate cannot drive thousands of
loads in any case. That floor is exactly why real clocks are built as
buffered trees, which the rest of this page develops.

## The H-tree and balanced trees

The cleanest way to reach many sinks at equal delay is geometric
symmetry. An H-tree places the source at the center and branches in
nested H shapes so that every root-to-leaf path is the same length, and
therefore the same delay. An **X-tree** is its diagonal cousin: its
branches run at 45 degrees, so each leaf's distance is the straight-line
(Euclidean) distance rather than the longer right-angle path, which gives
shorter, lower-latency balanced routes where diagonal routing is allowed.
Real designs are not perfectly regular, so production tools build balanced
trees by clustering sinks and equalizing path delays rather than drawing a
literal H, but the H-tree is the ideal the balancing chases. The figure
builds one.

<div class="walk-fig" data-walk="cts-htree"></div>

## Clock buffers and inverter pairs

No single gate can drive thousands of far loads, so the tree is buffered
at every level. Clock buffers (often balanced inverter pairs) restore
drive strength and keep the edge sharp, and their delays are what the
tool tunes to equalize path latency. Because the clock switches every
cycle, these buffers are a large share of a chip's dynamic power, which
is why clock networks are designed with as few buffers as the skew
target allows.

## Tree topologies and clustering

A production clock tree is grown by clustering: nearby sinks are grouped,
each cluster is driven by a buffer, the buffers are themselves clustered,
and the process repeats up to the source. The tool balances the delay
from each buffer to its sinks at every level. This clustering is what
lets an irregular sink distribution still reach low skew, where a rigid
H-tree could not.

Clustering can grow into several shapes, each trading skew, power, and
tolerance to variation:

<table>
<thead><tr><th>topology</th><th>what it is</th><th>trade-off</th></tr></thead>
<tbody>
<tr><td>H-tree / X-tree</td><td>a symmetric branching tree, H- or X-shaped, to equal-length leaves</td><td>very low, predictable skew, but rigid: best for regular arrays</td></tr>
<tr><td>clustered buffer tree</td><td>the general balanced tree grown by clustering</td><td>handles any sink distribution: the common default</td></tr>
<tr><td>clock mesh</td><td>a grid of clock wire shorting many buffers together over the block</td><td>very low skew and strong tolerance to variation, at high wire and power cost</td></tr>
<tr><td>spine (fishbone)</td><td>one or a few driven trunks with ribs tapping off to the sinks</td><td>simple and low-skew along the spine: suits structured datapaths in rows</td></tr>
</tbody>
</table>

A mesh is chosen where skew must be tiny and the power budget allows it, a
tree where power matters more, and a spine where the sinks line up in rows.

## Useful skew

Zero skew is not always the best target. Deliberately delaying the
capture clock of a tight path buys it setup time, and deliberately
advancing it relaxes a hold-critical path. This **useful skew**, or clock
skew scheduling, spends the clock arrival times as an optimization
variable, borrowing time from paths with margin to give to paths without
it. It must be applied carefully, because the same shift that helps setup
hurts hold.

## Clock power and multiple clocks

Because the clock switches every cycle, it is one of the largest power
consumers on a chip, and two techniques cut that power. Most designs
**gate** the clock, switching it off to idle blocks with clock-gating
cells; clock tree synthesis must build the tree through these gates and
check that the enable timing never lets a partial clock pulse through.
The second lever is **multi-bit flip-flop banking**: several single-bit
flip-flops that share a clock are merged into one multi-bit cell with a
single shared clock input, so the tree drives one clock load instead of
many, cutting buffers and power. Banking only works for flip-flops close
enough to merge without hurting their data timing, so it is done with
placement in view.

Designs with several clocks, or with generated and divided clocks, need a
tree per clock and careful handling where the domains meet.

## Non-default-rule clock routing

The clock is not routed with ordinary signal wires. Its trunks use
non-default rules: they are **widened**, because a wide, low-resistance wire
carries the sharp edge the flip-flops need and eases electromigration on a
net that switches every cycle, and they are given **extra spacing or
grounded shield wires** on each side so neighbouring signals cannot couple
noise onto the clock and jitter it. This spends routing-track budget, since
a wide, shielded trunk takes the room of several ordinary tracks, so it is
spent on the clock, where a clean and quiet edge matters most.

## Variation on the clock

Because the clock path feeds both the launch and capture side of every
check, variation on it matters twice. On-chip variation is applied to
clock paths, and common-path pessimism removal credits back the shared
part of the launch and capture routes. Clock jitter from the source and
duty-cycle distortion in the tree are budgeted as uncertainty. A clock
tree is signed off across the same corners as the data paths.

A structural defence against variation is to give every source-to-sink path
the same **number of buffer stages**. When two paths pass through the same
count of similar buffers, a process or voltage shift speeds or slows both
together, so most of the variation is common to them and cancels in the skew
between them. A tree with unequal depth to different sinks loses that
cancellation, so a variation-tolerant clock balances buffer levels, not only
total delay.

## Where clock tree synthesis sits in the flow

Clock tree synthesis runs after placement and before, or interleaved
with, routing, because it must know where the flip-flops are but its
buffers change placement and timing. After it, the clock is propagated
rather than ideal, hold violations become real and must be fixed, and
the design carries the insertion delay and skew that the rest of sign-off
accounts for.
"""

ROUTING_BODY = r"""
## What routing is

Routing connects the pins of every net with actual metal, turning a
placed netlist into a fully wired layout. It runs on the fixed grid of
metal layers the process provides, and it must connect every net while
obeying thousands of design rules and avoiding shorts. On a large block
it is the most time-consuming stage of the flow, and it is split into
global routing, which plans, and detailed routing, which draws.

## The routing grid, layers, and tracks

Routing happens on a stack of metal layers, alternating preferred
directions (one layer horizontal, the next vertical), connected by vias.
Each layer has a track pitch set by lithography. Lower layers are thin,
dense, and resistive, used for short local connections; upper layers are
thick and fast, used for long wires, the clock, and power. But the thick
upper layers have a wider pitch, so they carry far fewer tracks than the
dense lower layers. Those fast tracks are scarce, which is why the router
cannot simply put every net up high: **layer assignment** spends the fast
upper tracks on the long and timing-critical nets and leaves short local
nets on the lower layers.

## Global routing

Global routing plans each net's route coarsely, assigning it to a
sequence of routing regions (tiles) without drawing exact wires. It
builds a congestion map of supply and demand per tile and spreads nets
to keep any tile from overflowing its track capacity. Modern global
routers use negotiated-congestion routing: nets rip up and reroute
repeatedly, paying a rising cost for crowded tiles until the congestion
resolves. The figure runs that negotiation.

<div class="walk-fig" data-walk="pathfinder-idea"></div>

## Steiner trees and net topology

A multi-pin net is not a single wire but a tree, and the shortest tree
connecting a set of pins is a rectilinear Steiner tree, which may add
branch points beyond the pins. Routers build a low-cost Steiner topology
for each net first, then route its two-pin segments. A good topology
decides most of a net's wirelength before any detailed wire is drawn.

<div class="walk-fig" data-walk="steiner-idea"></div>

## Track assignment

Between global and detailed routing, track assignment commits each
global route to specific tracks on each layer. The core constraint is that
two wires on the **same track collide if their spans overlap** along it, so
this is a packing problem: the non-overlapping wire segments are packed onto
each track, and segments that would overlap are pushed to different tracks,
using as few tracks as the layer allows. It hands detailed routing a nearly
complete solution, leaving mainly the local connections and rule-fixing to
finish.

## Maze routing

To connect one point to another around obstacles, detailed routers use
**maze routing** (Lee's algorithm). It floods a wavefront outward from the
source across the routing grid, labelling each reached cell with its
distance from the source, until the wave reaches the target; then it
backtraces from the target down the decreasing distances, which is
guaranteed to trace a shortest legal path. Maze routing always finds a route
if one exists, at the cost of searching many cells, so production routers
steer the wave toward the target and confine it to a small window rather
than flooding the whole grid.

## Detailed routing and design rules

Detailed routing draws the exact wire and via geometry on legal tracks,
obeying the full design-rule set: spacing, width, via rules, minimum
area, and end-of-line rules, among many others. This is the hardest part
of routing at advanced nodes, where the rules are numerous and interacting.

Because adjacent layers run in perpendicular preferred directions, every
turn from a horizontal run to a vertical one costs a **via**, and each via
adds resistance and delay and is a small yield risk. So the router also
minimizes vias, taking fewer layer changes on a route where it can. This
sits in tension with the reliability practice of doubling vias: a route uses
as few vias as it can, then doubles the ones it must keep.

**Pin access** is often the limiting difficulty. Each pin exposes only a few
legal points where a wire may land on it, its access tracks, and the pins of
neighbouring cells compete for the same nearby tracks, so the router has to
choose access points that do not block one another.

## Congestion, rip-up, and reroute

Routing rarely succeeds in one pass. Where wires collide or a region has
too little capacity, the router rips up offending nets and reroutes them
along costlier but legal paths, repeating until no violations remain.
Congestion that cannot be resolved sends the design back to placement or
the floorplan, which is why congestion is watched from placement onward.

## Timing-, crosstalk-, and manufacturing-aware routing

A wire is a circuit, so routing is not only about connectivity.
Timing-driven routing keeps critical nets short and on fast layers.
Crosstalk-aware routing spaces or shields aggressive nets so coupling
does not corrupt timing or signals. Manufacturing-aware routing follows
the extra rules of multi-patterning and inserts redundant vias and wire
spreading to raise yield. Some nets must also be **length-matched**: the
bits of a wide bus, or the two wires of a differential pair, are routed to
nearly equal length, adding deliberate detours (serpentines) to the short
ones, so they arrive together and their skew stays within budget. This
matters most for synchronous buses and high-speed interfaces. Each of these
adds a cost term to the same routing search.

## Antenna and via reliability

During manufacturing, a long metal wire connected only to a gate can
collect charge that damages the gate oxide, the antenna effect. Routing
fixes it by breaking the wire with a jump to another layer or by adding a
diode. Vias, the connections between layers, are a reliability and yield
concern too, so routers prefer redundant double vias where space allows.

## Where routing sits in the flow

Routing is the last construction stage before sign-off. It produces the
final geometry that extraction turns into parasitics, which feed the
sign-off timing, signal-integrity, and reliability checks. A design that
will not route cleanly is not done, no matter how good its timing looked
before, so routability is a constraint the whole flow is steered toward.
"""

PV_BODY = r"""
## What physical verification is

Physical verification is the set of checks that confirm a finished layout
is manufacturable and correct before it is sent to the foundry. It comes
after routing, on the final geometry, and it is the last gate before
tapeout. Its two central checks are design-rule checking and
layout-versus-schematic, supported by electrical, density, reliability,
and lithography checks. A chip does not tape out until every one of them
is clean.

## Design rule checking

Design rule checking (DRC - Design Rule Check) verifies that the layout
geometry obeys every rule the foundry publishes. The checker compares the
drawn shapes against the rule deck and reports every violation by location
and rule. Passing DRC means the shapes can be printed and will not short or
open due to geometry.

A handful of rule families recur, and each is a thing the layout must get
right:

<table>
<thead><tr><th>rule</th><th>what it requires</th><th>why</th></tr></thead>
<tbody>
<tr><td>minimum width and spacing</td><td>every shape at least a minimum width, and at least a minimum gap to the next shape</td><td>narrower lines print unreliably; shapes too close short together</td></tr>
<tr><td>via enclosure</td><td>the metal on both layers must surround the via cut by a margin, not just touch it</td><td>a cut at the edge of its metal can miss the layer and open the connection</td></tr>
<tr><td>minimum area</td><td>each shape must cover at least a minimum area, not only meet the width</td><td>tiny slivers do not etch or fill reliably</td></tr>
<tr><td>width-dependent spacing</td><td>a wider wire needs a larger gap to its neighbours than a narrow one</td><td>wide metal couples more and blooms more in lithography, so it needs extra room</td></tr>
<tr><td>end-of-line (EOL) spacing</td><td>the tip of a narrow line needs extra clearance, and often extra via enclosure</td><td>line ends round off and pull back when printed, so they need a margin the sides do not</td></tr>
</tbody>
</table>

At advanced nodes these multiply into thousands of interacting rules, but
the families above are the ones a layout meets over and over.

## Layout versus schematic

Layout-versus-schematic (LVS - Layout Versus Schematic) proves that the
layout implements the intended circuit. It extracts a netlist from the
layout geometry, extracts a reference netlist from the schematic or
gate-level design, and compares the two device by device and net by net.
A clean LVS means the silicon will connect exactly the transistors and
nets the design specifies. A mismatch, an extra device, a swapped
connection, a missing net, is a functional bug that must be fixed.

The comparison is not only about wiring. Each device must also **match** in
type and size: a transistor with the wrong width, length, or threshold
flavour is an LVS (Layout Versus Schematic) error even when it is connected
correctly, because a differently sized device computes the same logic with
the wrong drive, delay, or leakage. So LVS is both structural (the same
devices wired the same way) and parametric (every device's properties agree
with the schematic), which also underlies the analog demand that matched
devices, such as the two halves of a differential pair, be laid out
identically.

## Antenna rules

During fabrication, metal is built one layer at a time, and a partially
built wire connected only to a transistor gate can accumulate charge
that breaks down the thin gate oxide. Antenna rules bound the ratio of
connected metal area to gate area at each manufacturing step. Violations
are fixed by adding a jog to a higher layer or a small protection diode.
The figure shows the repair.

<div class="walk-fig" data-walk="antenna-repair"></div>

## Electrical rule checks

Electrical rule checking (ERC - Electrical Rule Check) catches
connectivity mistakes that are electrically illegal even if they pass
geometric rules: floating gates, unconnected inputs, shorts between
power and ground, and pins driven by conflicting sources. It is a
lightweight but important guard against wiring errors that DRC and LVS
alone might not flag.

A gate input that must hold a constant is not wired straight to a power or
ground rail, because that ties a delicate transistor gate directly to the
noisy supply and can stress it. Instead a **tie-high** or **tie-low** cell
drives the constant through a small dedicated transistor, giving the gate a
clean, protected fixed value. So the fix for an input that should be a
constant is not "route it to the rail" but "insert a tie cell", and ERC
flags both inputs left floating and, at some nodes, inputs tied straight to
a rail instead of through a tie cell.

## Density and metal fill

The foundry requires each layer's metal density to fall within a window,
because chemical-mechanical polishing planarizes better on a uniform
surface. Sparse areas are filled with electrically inert metal shapes,
and over-dense areas must be relieved. Fill is inserted late and then
re-checked, because it changes the parasitics that timing signed off on,
so it is added with awareness of the sensitive nets.

## Lithography and manufacturability

At advanced nodes the drawn shape and the printed shape differ, so
manufacturability checks go beyond fixed spacings. Lithography-friendly
rules, recommended patterns, and multi-patterning color constraints all
constrain what may be drawn, and design-for-manufacturing checks flag
patterns that would print poorly or yield badly. The figure shows the
resolution limit that drives these rules.

<div class="walk-fig" data-walk="litho-limit"></div>

A common design-for-manufacturing improvement is **via doubling**. A single
via can fail to form during fabrication, or crack over the chip's life, and
either way it opens the net. Where the layout has room, the tool replaces a
lone via with two or more cuts in parallel, a **redundant via**, so the
connection survives if one cut fails. It changes no logic and is inserted
late wherever space allows, raising yield and long-term reliability.

## Reliability sign-off

Beyond geometry and connectivity, the layout is checked against the
physical limits that govern how long the chip survives. Electromigration
limits the current density a wire may carry before it degrades, and IR
(current times resistance) drop limits how far the supply voltage may
sag under load. These reliability checks run on the extracted power grid
and signal wires and must pass across the operating corners.

## Sign-off and tapeout

Physical verification is the convergence point of the flow. Only when
DRC, LVS, antenna, electrical, density, lithography, and reliability
checks are all clean, across every required corner, is the design signed
off and the final layout, as a GDSII (Graphic Data System II) or OASIS
file, sent to the foundry. Everything upstream exists to reach this
clean state.
"""

ECO_BODY = r"""
## What an engineering change order is

An engineering change order (ECO) is a small, targeted change applied to a design
that is already implemented, placed and routed and mostly closed, without
re-running the whole flow. The change is made in place, disturbing as little of
the existing layout as possible, and then the affected part is re-verified. Two
situations call for it: a late need to close the last few timing or design-rule
violations, and a late need to change the logic itself, to fix a bug or add a
small feature, after the design is already built.

The reason to work this way, rather than editing the source and re-implementing,
is that re-implementation throws away the placement, routing, and closure already
achieved and can move violations somewhere new. An ECO preserves that work and
touches only what must change. For a functional change there is a second reason:
a change confined to the metal and via layers reuses the more expensive transistor
masks, so the silicon revision is cheaper and faster.

## The two kinds of ECO

<table>
<thead><tr><th>kind</th><th>what changes</th><th>why</th></tr></thead>
<tbody>
<tr><td>timing ECO</td><td>the implementation, not the logic (the netlist stays logically equivalent)</td><td>close setup, hold, or electrical violations</td></tr>
<tr><td>functional ECO</td><td>the logic itself</td><td>fix a functional bug or add a feature after implementation</td></tr>
</tbody>
</table>

A timing ECO must not change what the circuit computes; every move below leaves
the logic function untouched. A functional ECO does change the logic, and so it
carries an extra obligation: proving that the changed netlist matches the
intended new function, with a logic equivalence check (LEC).

## Setup ECO: making a path faster

When a register-to-register path arrives too late (a setup violation), the ECO
speeds it up. The moves, from cheapest to most disruptive:

<table>
<thead><tr><th>move</th><th>what it does</th><th>cost</th></tr></thead>
<tbody>
<tr><td>gate upsizing</td><td>swap a cell for a stronger drive of the same function, cutting its delay into the load</td><td>more area and power on that cell</td></tr>
<tr><td>buffer insertion</td><td>split a long, high-load net so each segment drives less, cutting delay and sharpening the transition</td><td>a new cell to place and route</td></tr>
<tr><td>threshold-voltage (Vt) swap</td><td>swap a cell for a lower-Vt (faster) variant of the same footprint</td><td>higher leakage on that cell</td></tr>
<tr><td>pin swap</td><td>move the late-arriving signal onto the input pin with the shorter internal delay to the output</td><td>none: same cell, only the connection changes</td></tr>
<tr><td>driver cloning / load splitting</td><td>duplicate a driver and split its fanout so each copy drives fewer loads</td><td>a duplicated cell</td></tr>
<tr><td>restructure or layer promotion</td><td>reroute the critical net on a faster (upper) metal layer, or restructure local logic</td><td>routing resources and effort</td></tr>
</tbody>
</table>

The two footprint-preserving moves, the threshold-voltage swap and the pin swap,
are preferred first because they change no placement: a lower-Vt cell drops into
the same site, and a pin swap changes only wiring. Upsizing and buffering add or
grow cells and so need a little placement and routing. Every setup move trades
against power (upsizing and lower Vt raise it) and against the hold checks, which
it can newly violate, so the path is re-timed after the change.

The pin swap works because the inputs of a gate are logically interchangeable but
not electrically equal. Inside a CMOS (Complementary Metal-Oxide-Semiconductor)
gate the inputs drive a series stack of transistors between the output node and
the supply rail. In a NAND (Not-AND) gate that stack is the NMOS (n-type
Metal-Oxide-Semiconductor) pull-down path from the output down to GND (ground).
The input that switches the transistor nearest the output is fast: the lower
transistors turned on earlier and already pulled the internal stack nodes down, so
the last transition only has to move the small output node. The input that
switches the transistor nearest the rail is slow: it must discharge the whole
stack at the last moment. The pin-to-output delay therefore depends on stack
position, so the tool assigns the latest-arriving signal to the pin closest to the
output and pushes the earlier signals onto the slower pins.

Logic restructuring is the deepest of these moves, because it changes the
shape of the logic rather than just the cells. A path can be slow simply
because it runs through too many gates in series, and a late-arriving
signal buried deep in that chain then passes through every one of them.
Restructuring rebuilds the **same** function as a shallower, more balanced
tree, and puts the latest-arriving signal nearest the output so it sees the
fewest gates after it. It closes timing with no change in what the logic
computes, but it disturbs more of the netlist than the local moves above,
so it is reached for when those are not enough.

## Hold ECO: adding delay

A hold violation means data reaches the capture flip-flop too early, before the
clock edge has safely latched the previous value. Unlike setup, the fix is to
make the path slower, by inserting delay cells or buffers on the fast path until
the earliest arrival clears the hold requirement.

<div class="eq">hold slack = earliest data arrival &minus; hold requirement</div>

<ul class="eq-legend">
<li><code>earliest data arrival</code> the fastest a signal can reach the capture flip-flop</li>
<li><code>hold requirement</code> the time after the clock edge the input must stay stable</li>
</ul>

Hold is fixed late, after routing, because it depends on the real clock and wire
delays that only exist once the clock tree and routes are built. The delay must
be added without pushing the same path or a neighbour into a setup violation, so
hold-fixing cells are placed where there is slack to spare, and the path is
checked against both setup and hold afterward. Because hold cells are numerous
and small, they are a large share of late ECO activity.

## Clock ECO and useful skew

Instead of changing the data path, an ECO can shift a flip-flop's clock arrival.
Delaying the capture clock gives a late path more time (helping setup) at the
expense of the next stage; advancing it does the reverse. Moving slack between
adjacent stages this way is called useful skew, and as a late change it is done
by editing the clock tree near that flip-flop.

## Electrical and design-rule ECO

Some late violations are electrical rather than path timing. A net that switches
too slowly (a maximum-transition violation), drives too much capacitance (a
maximum-capacitance violation), or fans out to too many loads (a maximum-fanout
violation) is fixed with the same buffering, driver-cloning, and upsizing moves,
splitting the load so no driver is overloaded. An antenna violation found late is fixed by adding a protection diode or
jumping the route to another layer. These are ECOs in the same sense: local,
in-place, re-verified.

## Functional ECO and spare cells

A functional ECO changes the logic after the design is built. The difficulty is
that the base transistor layers are already committed, so there is nowhere to put
new gates unless they were provided in advance. They are: designers scatter
**spare cells**, unused gates and flip-flops, across the layout before tapeout
exactly so a later change has something to use.

A **metal-only ECO** implements the logic change by rewiring these spare cells,
changing only the metal and via masks. The transistor masks are untouched, so the
revision needs only a few new masks and a short turnaround. It works only when the
change can be built from the spare cells that happen to be nearby and of the right
type.

When the change is too large or the right spares are not close enough, the ECO
must add real cells, which requires new base layers: an **all-layer ECO**, a full
mask set and a long, expensive turnaround. Part of doing a functional ECO is
deciding which case applies.

<table>
<thead><tr><th></th><th>metal-only ECO</th><th>all-layer ECO</th></tr></thead>
<tbody>
<tr><td>uses</td><td>pre-placed spare cells, rewired</td><td>newly added cells</td></tr>
<tr><td>masks changed</td><td>metal and via only</td><td>full stack, including transistors</td></tr>
<tr><td>cost and time</td><td>few masks, days</td><td>full mask set, weeks</td></tr>
<tr><td>limit</td><td>needs suitable spares nearby</td><td>none, but expensive</td></tr>
</tbody>
</table>

## Doing an ECO with minimal disturbance

Whichever move is used, the point of an ECO is to change little. The affected
region is opened for edits and the rest of the block is frozen (marked
don't-touch), so the existing placement and routing stay intact. The changed
nets are rerouted on spare tracks with as little rip-up as possible.

Any cell an ECO inserts still has to be **legalized**: snapped onto a legal
site on the placement grid, in a standard-cell row, without overlapping the
cells already there. The placer first drops the new cell at its ideal spot,
where timing and wirelength want it, but that spot is usually already
occupied, so legalization moves the cell to the nearest free, on-grid gap.
It moves each cell as little as possible, because displacement from the
ideal spot erodes the very timing the ECO was trying to fix, and on a
packed die the nearest legal gap is often in an adjacent row. A large or
scattered change defeats the purpose, so ECOs are kept small and are often
batched so one revision carries several fixes.

## Verifying an ECO

An ECO is not done when the edit is made; it is done when the change is proven not
to have broken anything.

- **Timing:** re-run static timing analysis (STA) on the changed paths, checking
  both setup and hold, since a setup fix can create a hold problem and a hold fix
  can create a setup problem.
- **Physical:** re-run the design-rule check (DRC) and the layout-versus-schematic
  check (LVS) on the changed region, because new cells and routes can break
  spacing or connectivity.
- **Function:** for a functional ECO, run a logic equivalence check (LEC) to prove
  the edited netlist implements exactly the intended change and nothing else.

Only when the changed region passes these, with the rest of the block untouched,
is the ECO signed off.
"""

SYNTHESIS_BODY = r"""
## What logic synthesis is

Logic synthesis turns a register-transfer level (RTL) description, which says what a
circuit should compute, into a gate-level netlist built from a standard-cell library,
optimized for power, performance, and area. It is the front of the physical-design
flow: the netlist it produces is what floorplanning, placement, clock tree synthesis,
and routing then implement. If synthesis builds bloated or slow logic, no amount of
good placement recovers it, so the quality of results is set here first.

Synthesis works in three passes. It first simplifies the logic with no knowledge of
the target library, then maps that logic onto real library cells, and alongside both
it optimizes the sequential elements, the flip-flops. The passes are kept apart
because they answer different questions with different cost models.

<table>
<thead><tr><th>pass</th><th>question it answers</th><th>example moves</th></tr></thead>
<tbody>
<tr><td>technology-independent optimization</td><td>what is the smallest logic that computes this function</td><td>Boolean minimization, factoring, constant propagation</td></tr>
<tr><td>technology mapping</td><td>which library cells cover that logic most cheaply</td><td>decompose, match, cover for area or for delay</td></tr>
<tr><td>sequential optimization</td><td>where should the registers sit, and how should state be encoded</td><td>retiming, state encoding</td></tr>
</tbody>
</table>

## Technology-independent optimization

Before any library is chosen, synthesis works on an abstract Boolean network and
shrinks it. The cost it minimizes is the amount of logic, counted as literals (each
appearance of a variable or its complement) or as gates.

**Two-level minimization.** Any Boolean function can be written as a sum of products
(SOP), an OR of AND terms. The minimal two-level form uses the fewest, largest
product terms that still cover every input combination for which the function is 1.
Those largest terms are the prime implicants, and choosing the smallest set of prime
implicants that covers all the 1s is the classic minimization problem.

<div class="eq">cost = number of product terms, then total literals</div>
<ul class="eq-legend">
<li><b>product term</b>: one AND of some inputs, a single gate in the AND plane</li>
<li><b>prime implicant</b>: a product term that cannot be made larger (fewer literals) while still covering only 1s</li>
</ul>

A term that covers a 1 no other chosen term covers is essential and must be taken.
The rest are chosen to cover what is left at the least cost.

**Multi-level optimization and factoring.** Two-level form is rarely the smallest
overall. Multi-level logic shares subexpressions: if the same term appears in several
places it is built once and fanned out. Factoring pulls a common factor out of an
expression, turning a flat sum of products into a smaller multi-level structure.

<div class="eq">a·c + a·d + b·c + b·d  =  (a + b)·(c + d)</div>

The left side uses eight literals in four product terms. The right uses four literals
in two small gates. Same function, less logic.

**Constant propagation and dead-logic removal.** When an input is tied to a constant
(a mode pin strapped, an unused feature disabled), that constant flows through the
network: an AND with a constant 0 is 0, an OR with a constant 1 is 1, and so on.
Gates whose outputs become constant, and gates whose outputs no longer drive
anything, are swept away. This is often the cheapest large win, because a tied
configuration can remove whole cones of logic.

## Technology mapping

Now the optimized network is turned into real cells. It is first decomposed into a
canonical base of simple gates, typically 2-input NAND (Not-AND) gates and inverters,
which forms an and-inverter graph. Then the library cells (inverter, NAND2, NOR2
(Not-OR), AOI21 (AND-OR-Invert), and larger complex gates) are used to <i>cover</i>
that graph: choose a set of cell-sized patterns that tile every node, each node
covered once, at the least cost.

<div class="eq">area cost = Σ (area of each chosen cell)</div>
<ul class="eq-legend">
<li><b>cover</b>: an assignment of library cells to the nodes of the decomposed graph so that together they compute the same function</li>
<li>a complex cell such as AOI21 (AND-OR-Invert) covers several base nodes at once, usually cheaper than the equivalent separate gates</li>
</ul>

For a tree, dynamic programming from the leaves up gives the provably cheapest cover.
A general graph with reconvergent fanout is harder, and is covered heuristically.

**Area versus delay.** The smallest cover is usually not the fastest. Under a delay
cost the mapper spends area to shorten the critical path: it picks larger, stronger
cells on the late paths and may duplicate logic so signals arrive in parallel rather
than in series.

<div class="eq">delay cost = latest arrival time at the output</div>

The same decomposed graph, mapped once for area and once for delay, gives two
different netlists. Which one is right depends on whether the block is area-limited or
timing-limited, which is why the cost function is an input to synthesis, not a fixed
rule.

## Sequential optimization

**Retiming.** A pipeline's clock period is set by its slowest combinational stage, the
longest run of logic between two flip-flops. Retiming relocates flip-flops across
combinational gates, without changing what the circuit computes at its inputs and
outputs, so the stages are balanced and the slowest one is as fast as possible.

<div class="eq">clock period ≥ longest combinational delay between adjacent registers</div>

Moving a register earlier shortens the stage after it and lengthens the stage before
it, so retiming is a balancing act: push registers off the heavy stage onto the light
one until no single stage dominates.

**State encoding.** A finite-state machine (FSM) has a set of named states, and the
synthesizer must assign each a binary code stored in the state flip-flops. The
encoding decides how much next-state and output logic is needed: codes that place
related states close together make the transition logic simpler. Dense binary uses
the fewest flip-flops. One-hot (one flip-flop per state) uses the most flip-flops but
often the least and fastest next-state logic. The right encoding depends on the
machine.

## Datapath and operator selection

An arithmetic operator like + in the register-transfer level (RTL) is not one
circuit: it has many gate-level implementations that compute the same result with
very different power, performance, and area. An adder can be a ripple-carry chain
(small, but the carry ripples through every bit, so it is slow) or a carry-lookahead
or carry-select structure (larger, but the carry is computed in parallel, so it is
fast). Synthesis selects the architecture that meets the delay target at the least
area, which is why the same + can synthesize to very different gate counts in a
timing-critical block versus an area-critical one.

## Where synthesis hands off

The gate-level netlist goes to floorplanning and placement, and its timing is later
re-checked in static timing analysis (STA). Some optimizations do not end at
synthesis: timing-driven restructuring and gate sizing return as engineering change
order (ECO) moves once the design is placed and real wire delays are known, so the
ECO topic revisits them with layout in hand. In the open-source flow,
<a href="https://yosyshq.net/yosys/">Yosys</a> performs synthesis and calls
<a href="https://github.com/berkeley-abc/abc">ABC</a> for the
technology-independent optimization and technology mapping described above.
"""


TOPICS = [
    {
        "slug": "logic-synthesis",
        "shelf": "From register transfer level code to a netlist of real library cells.",
        "name": "Logic Synthesis",
        "live": True,
        "tagline": (
            "Turn a register-transfer level description into a gate-level "
            "netlist: simplify the Boolean logic, map it onto library cells "
            "for area or delay, and place the registers well."
        ),
        "blurb": (
            "Logic synthesis: technology-independent optimization (Boolean "
            "minimization, factoring, constant propagation), technology "
            "mapping (covering a network with library cells for area or "
            "delay), and sequential optimization (retiming, state encoding), "
            "plus how an operator like an adder is chosen."
        ),
        "body": SYNTHESIS_BODY,
    },
    {
        "slug": "static-timing-analysis",
        "shelf": "Proving every path meets the clock, and reading the reports that say so.",
        "name": "Static Timing Analysis",
        "live": True,
        "tagline": (
            "Everything a physical-design engineer needs to know about "
            "proving a design meets its clock: the timing graph and "
            "slack, setup and hold, delay models, clocks and skew, "
            "constraints, corners and variation, crosstalk, and "
            "sign-off."
        ),
        "blurb": (
            "The analysis at the heart of sign-off, covered end to end: "
            "slack, setup and hold, timing paths, delay calculation, "
            "clock effects, constraints, multi-corner analysis, on-chip "
            "variation, crosstalk, and how to read a timing report."
        ),
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "body": STA_BODY,
    },
    {
        "slug": "floorplanning",
        "shelf": "The die, the macros, the power grid and the pins, before any cell is placed.",
        "name": "Floorplanning",
        "live": True,
        "tagline": (
            "The first physical step: fixing the die, the macros, the "
            "power grid, and the I/O before a single cell is placed, and "
            "why this stage sets the ceiling for the whole flow."
        ),
        "blurb": (
            "Placing the big blocks, the I/O, and the power grid before "
            "a single standard cell lands: aspect ratio, utilization, "
            "macro placement, partitioning, and why this stage decides "
            "the rest of the flow."
        ),
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "body": FLOORPLANNING_BODY,
    },
    {
        "slug": "placement",
        "shelf": "Putting every cell in its place: wirelength, density, legality and timing.",
        "name": "Placement",
        "live": True,
        "tagline": (
            "Turning the netlist into an arrangement: minimizing "
            "wirelength with global placement, snapping cells legal, and "
            "cleaning up, under density, congestion, and timing."
        ),
        "blurb": (
            "Assigning every standard cell a legal location that keeps "
            "wires short and the design routable: the wirelength "
            "objective, global placement, legalization, detailed "
            "placement, and timing-driven placement."
        ),
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "body": PLACEMENT_BODY,
    },
    {
        "slug": "clock-tree-synthesis",
        "shelf": "Delivering the clock to every flip-flop at nearly the same moment.",
        "name": "Clock Tree Synthesis",
        "live": True,
        "tagline": (
            "Delivering the clock to every flip-flop at nearly the same "
            "time: skew and latency, the H-tree, buffering, useful skew, "
            "and clock gating."
        ),
        "blurb": (
            "Delivering the clock to every flip-flop with low skew and "
            "controlled latency: skew and insertion delay, the H-tree, "
            "buffering, clustering, useful skew, and clock gating."
        ),
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "body": CTS_BODY,
    },
    {
        "slug": "routing",
        "shelf": "Connecting every net with real metal, under every design rule.",
        "name": "Routing",
        "live": True,
        "tagline": (
            "Connecting every net with real metal on the layer grid: "
            "global routing, Steiner topology, track assignment, "
            "detailed routing, and the rules that make it hard."
        ),
        "blurb": (
            "Connecting every net through the metal stack without "
            "shorts or design-rule violations: the routing grid, global "
            "routing, Steiner trees, track assignment, detailed routing, "
            "and antenna rules."
        ),
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "body": ROUTING_BODY,
    },
    {
        "slug": "physical-verification",
        "shelf": "The last checks before tapeout: rules, connectivity, antennas and density.",
        "name": "Physical Verification",
        "live": True,
        "tagline": (
            "The last gate before tapeout: proving the layout is "
            "manufacturable and matches the circuit, through DRC, LVS, "
            "antenna, density, and reliability checks."
        ),
        "blurb": (
            "The final checks that a layout is manufacturable and "
            "matches its schematic: DRC (Design Rule Check), LVS (Layout "
            "Versus Schematic), antenna rules, density and fill, and "
            "reliability sign-off."
        ),
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "body": PV_BODY,
    },
    {
        "slug": "eco",
        "shelf": "Late, targeted fixes to a built design, disturbing as little as possible.",
        "name": "ECO",
        "live": True,
        "tagline": (
            "Late, targeted change to a design that is already built: close "
            "the last violations or fix the logic in place, disturbing as "
            "little as possible, then re-verify."
        ),
        "blurb": (
            "Engineering change orders: the timing moves (resize, buffer, "
            "threshold-voltage swap, pin swap, cloning, hold-delay insertion), "
            "the functional changes (metal-only spare-cell rewiring versus an "
            "all-layer respin), and how an ECO is scoped and re-verified."
        ),
        "body": ECO_BODY,
    },
]
