"""Finishing algorithm catalog: the last steps between a routed block and
a file a foundry can build. Fill for manufacturability, extraction and
power-grid analysis for electrical sign-off, and the rule and
connectivity checks of physical verification."""

STAGE = {
    "slug": "finishing",
    "name": "Finishing",
    "tagline": (
        "The last distance to a file a foundry can build: fill the empty "
        "metal, turn the drawn wires back into resistors and capacitors, "
        "prove the power supply holds up, then prove the layout obeys every "
        "rule of the process and is still the circuit synthesis wrote."
    ),
    "families": [
        {
            "id": "manufacture",
            "name": "Preparing the layout for manufacture",
            "lead": (
                "A correct layout can still be unbuildable. Polishing "
                "needs even metal density, so the empty space is filled "
                "before the layout is final."
            ),
        },
        {
            "id": "electrical",
            "name": "Electrical sign-off",
            "lead": (
                "Turn the drawn metal back into electricity: the "
                "resistance and capacitance of every wire, and how far the "
                "power supply sags under load."
            ),
        },
        {
            "id": "verification",
            "name": "Physical verification",
            "lead": (
                "The last two proofs before tapeout: every shape obeys the "
                "foundry's geometric rules, and the layout connects "
                "exactly as the netlist says."
            ),
        },
    ],
}

ALGORITHMS = [
    {
        "slug": "metal-fill",
        "card": "Add unconnected metal until every window's density is in range.",
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "level": "industry",
        "name": "Metal Fill for Density Control",
        "family": "manufacture",
        "year": "1998",
        "who": "Kahng, Robins, Singh, Zelikovsky",
        "chips": [
            ("diff-easy", "required by every foundry"),
            ("diff-medium", "adds coupling capacitance"),
        ],
        "summary": (
            "Divide the die into windows and add unconnected metal shapes "
            "until every window's density is inside the foundry's range, "
            "so polishing leaves each layer flat."
        ),
        "lab": None,
        "refs": [
            ("Wikipedia: Chemical-mechanical polishing",
             "https://en.wikipedia.org/wiki/Chemical-mechanical_polishing"),
            ("OpenROAD density fill (source)",
             "https://github.com/The-OpenROAD-Project/OpenROAD/tree/master/src/fin"),
        ],
        "body": """
## The idea

After each metal layer is patterned, chemical-mechanical polishing
grinds it flat. The polish removes material unevenly where the metal
density varies: sparse regions dish and dense regions stay high. The
resulting thickness variation changes wire resistance and can spoil the
layers built on top. Foundries therefore require the density in every
window of a fixed size to stay within a range:

<div class="eq">minimum ≤ metal area in window ÷ window area ≤ maximum</div>

<ul class="eq-legend">
<li><code>window</code> a square region of fixed size; the checks slide it across the die at fixed steps</li>
<li><code>metal area</code> the area of all shapes on the layer inside the window, fill included</li>
<li><code>minimum, maximum</code> the density range the foundry's rules allow for that layer</li>
</ul>

Fill insertion adds rectangles of metal, connected to no signal, in the
empty space until every window complies. Kahng, Robins, Singh and
Zelikovsky (1998) posed this as an optimization. Because the windows
overlap at fixed offsets, they divide the die into tiles smaller than a
window and decide how much fill each tile receives, by linear
programming for an exact answer (keeping every window in range while
evening out the density) and by faster Monte Carlo and greedy methods
for large layouts.

## Watch it work: windows, violations, and greedy fill

One metal layer divided into tiles, with a density rule checked in overlapping windows. The
walkthrough computes every window's density, marks the windows that are too empty, and fills
the emptiest window first until every window passes.

<div class="walk-fig" data-walk="metal-fill"></div>

## The fine print

Fill is not free. Every added shape adds capacitance to the signal
wires beside it, so timing-aware fill keeps its distance from critical
nets, and extraction has to run after fill to see the effect. Fill can
float or be tied to a supply; floating fill is simpler to insert, but
its coupling is harder to model.

## Where you meet it today

OpenROAD's `density_fill` inserts fill from a set of per-layer rules,
and the finishing walkthrough on this site runs it before the final
timing and power checks.
""",
    },
    {
        "slug": "parasitic-extraction",
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "level": "industry",
        "name": "Parasitic Extraction",
        "family": "electrical",
        "year": "1991 onward",
        "who": "Nabors and White (FastCap); pattern-based extractors",
        "chips": [
            ("diff-easy", "fast with pattern tables"),
            ("diff-hard", "accuracy against speed"),
        ],
        "summary": (
            "Turn the drawn wires back into resistors and capacitors. Field "
            "solvers compute exact values for small structures; production "
            "extractors match every wire to precomputed patterns."
        ),
        "lab": None,
        "refs": [
            ("Wikipedia: Parasitic extraction",
             "https://en.wikipedia.org/wiki/Parasitic_extraction"),
            ("OpenRCX, OpenROAD's parasitic extractor (source)",
             "https://github.com/The-OpenROAD-Project/OpenROAD/tree/master/src/rcx"),
        ],
        "body": """
## The idea

After routing, timing and power depend on the resistance and
capacitance of the real wires, not on estimates. Resistance is local:

<div class="eq">R = R<sub>sheet</sub> × length ÷ width</div>

<ul class="eq-legend">
<li><code>R</code> resistance of one straight wire segment</li>
<li><code>R<sub>sheet</sub></code> sheet resistance of the layer, set by its material and thickness</li>
<li><code>length, width</code> the drawn dimensions of the segment</li>
</ul>

plus the resistance of every via along the way. Capacitance is not
local. Each wire couples to the substrate, to the layers above and
below, and to its neighbors on the same layer, and at small pitches the
neighbor coupling dominates. The exact answer comes from solving the
electrostatic field around the conductors. Field solvers such as
FastCap (Nabors and White, 1991) do this with boundary elements
accelerated by multipole expansions, but even so they are far too slow
for the billions of wire segments on a chip.

Production extractors are therefore pattern-based. Before any design is
extracted, a field solver characterizes a library of typical
cross-sections for the process (a wire with neighbors at various
spacings, with and without metal above and below) into tables. The
extractor then scans the layout, identifies the configuration around
each segment, looks up its capacitance, and writes a netlist of
resistors and capacitors for the timer.

## Watch it work: one wire, turned into resistors and capacitors

One routed net beside two neighbours, with illustrative values. The walkthrough computes
each segment's resistance from its shape, looks up its capacitance in a pattern table, and
assembles the network that timing analysis reads.

<div class="walk-fig" data-walk="parasitic-extraction"></div>

## The fine print

Pattern tables are only as good as their coverage. Unusual geometry
falls between the patterns, so accuracy is checked by comparing against
a field solver on sample structures. Coupling capacitance also depends
on whether the neighbors switch at the same time; extraction reports it
as separate coupling capacitors and leaves the interpretation to timing
analysis.

## Where you meet it today

OpenRCX, OpenROAD's extractor, works from a per-process rules file of
this kind, and `extract_parasitics` runs in the flow's final report
before sign-off timing. The timing catalog's interconnect pages pick up
where extraction leaves off.
""",
    },
    {
        "slug": "power-grid-voltage-drop",
        "card": "Solve the grid as resistors to find how far the supply sags.",
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "level": "foundational",
        "name": "Static Power-Grid Voltage Drop",
        "family": "electrical",
        "year": "1990s onward",
        "who": "many; Qian, Nassif, Sapatnekar (random walks)",
        "chips": [
            ("diff-easy", "one linear system"),
            ("diff-medium", "millions of unknowns"),
        ],
        "summary": (
            "Model the power grid as a resistor network with a current "
            "drawn at every cell, solve one large sparse linear system, and "
            "read how far the supply sags at each cell."
        ),
        "lab": None,
        "refs": [
            ("Wikipedia: IR (current times resistance) drop",
             "https://en.wikipedia.org/wiki/IR_drop"),
            ("PDNSim, OpenROAD's power grid analyzer (source)",
             "https://github.com/The-OpenROAD-Project/OpenROAD/tree/master/src/psm"),
        ],
        "body": """
## The idea

Every cell draws current from the power grid, and every stripe and via
of the grid has resistance, so the voltage a cell actually receives is
lower than the supply at the pads. Static analysis replaces each cell
with its average current and the grid with its resistances, then
applies Kirchhoff's current law at every node of the grid. The result
is one linear system:

<div class="eq">G · v = i</div>

<ul class="eq-legend">
<li><code>G</code> the conductance matrix of the grid: one row per node, sparse and symmetric</li>
<li><code>v</code> the unknown voltage at each node, with the pads held at the supply voltage</li>
<li><code>i</code> the current drawn at each node by the cells attached to it</li>
</ul>

The drop at a node is the supply voltage minus its solved voltage, and
the report is the worst drop and where it occurs. With the pads fixed,
the matrix is symmetric positive definite and very sparse, which suits
preconditioned conjugate gradient or sparse direct factorization.
Random-walk methods (Qian, Nassif and Sapatnekar, 2003) estimate the
voltage at chosen nodes without solving the whole system.

## Watch it work: a small grid, solved sweep by sweep

A seven-by-seven power grid with pads at the corners and a hotspot near the middle, with
illustrative values. The walkthrough writes Kirchhoff's current law at every node, solves the
system by repeated sweeps until it settles, and then adds a pad to show one fix.

<div class="walk-fig" data-walk="power-grid-voltage-drop"></div>

## The fine print

Static analysis uses average currents, so it misses the short, large
surges when many cells switch at once. Dynamic analysis simulates the
grid's resistance, capacitance and inductance over time with switching
current waveforms, at a much higher cost. The currents themselves come
from power analysis, and are only as good as the switching activity it
assumed.

## Where you meet it today

PDNSim in OpenROAD (`analyze_power_grid`) solves this system on the
built grid, and the Gemmini challenge on this site requires the
worst-case static drop to stay under a pinned limit.
""",
    },
    {
        "slug": "design-rule-checking",
        "card": "Sweep a line across the layout, comparing only nearby shapes.",
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "level": "foundational",
        "name": "Design Rule Checking by Plane Sweep",
        "family": "verification",
        "year": "1977 onward",
        "who": "Baird; Bentley and Ottmann (plane sweep)",
        "chips": [
            ("diff-easy", "every shape, every rule"),
            ("diff-hard", "billions of shapes"),
        ],
        "summary": (
            "Check every polygon against the foundry's width, spacing and "
            "enclosure rules, with a scanline sweep that only ever compares "
            "shapes that are near each other."
        ),
        "lab": None,
        "refs": [
            ("Wikipedia: Design rule checking",
             "https://en.wikipedia.org/wiki/Design_rule_checking"),
            ("KLayout, the open-source layout viewer and checker",
             "https://www.klayout.de"),
        ],
        "body": """
## The idea

A foundry's rules are geometric: the minimum width of a shape, the
minimum spacing between shapes, the minimum enclosure of a via by the
metal around it, the minimum area, and many conditional variants, such
as a spacing that grows with the width of the wires and the length they
run side by side. Many rules are written as operations on layers
(grow, shrink, intersect, subtract) followed by a measurement.

Checking them means measuring distances between edges. Comparing every
pair of shapes is quadratic, hopeless for billions of shapes. The
standard remedy is a plane sweep. Sort all edges by coordinate and move
a scanline across the layout, keeping only the shapes that currently
cross a band around the line. A width or spacing check compares an edge
only with its neighbors in that active set, so the work grows with the
number of shapes times the local density instead of with the square of
the count. Bentley and Ottmann's 1979 sweep for reporting geometric
intersections is the classic form of the method, and Baird's work on
fast layout artwork analysis (1977) brought such techniques to
integrated circuit layout.

## Watch it work: a sweep line and its active set

Eight shapes on one metal layer and two rules. The walkthrough sweeps a line across the
layout, compares each new shape only with the shapes still near the line, and finds every
violation with a fraction of the comparisons that checking every pair needs.

<div class="walk-fig" data-walk="design-rule-checking"></div>

## The fine print

A modern process has thousands of rules, many of them conditional, so
the rule deck is itself a program. Hierarchical checking, which checks
each cell once and then only the places where instances meet, is what
makes full-chip runs feasible. Rule decks are written in tool-specific
languages and are usually the foundry's intellectual property.

## Where you meet it today

KLayout and Magic run open rule decks; OpenROAD's detailed router
checks and repairs its own routing rules as it works; and the finishing
walkthrough on this site runs the deck on every polygon before
tapeout.
""",
    },
    {
        "slug": "layout-versus-schematic",
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "level": "foundational",
        "name": "Layout Versus Schematic by Partition Refinement",
        "family": "verification",
        "year": "1983",
        "who": "Ebeling and Zajicek",
        "chips": [
            ("diff-easy", "a graph comparison"),
            ("diff-medium", "hard to explain a mismatch"),
        ],
        "summary": (
            "Extract the circuit the layout actually builds and compare it "
            "with the netlist, refining a partition of devices and nets "
            "until each one is matched with its twin."
        ),
        "lab": None,
        "refs": [
            ("Wikipedia: Layout versus schematic",
             "https://en.wikipedia.org/wiki/Layout_Versus_Schematic"),
            ("Netgen, the open-source netlist comparison tool",
             "http://opencircuitdesign.com/netgen/"),
        ],
        "body": """
## The idea

Layout versus schematic proves that the layout is the intended circuit.
It runs in two steps.

**Extraction.** Recognize devices from how the layers overlap (a
transistor where polysilicon crosses diffusion) and trace connectivity
through metal and vias, producing a netlist of what the layout actually
builds.

**Comparison.** Decide whether the extracted netlist and the reference
netlist are the same circuit. Treat each one as a graph whose nodes are
devices and nets, and the question becomes graph isomorphism, which has
no known polynomial-time algorithm in general. Circuits, though, are
far from adversarial. Ebeling and Zajicek (1983) label every node with
local invariants (device type, number of connections), then repeatedly
relabel each node from the labels of its neighbors, refining the
partition. A node whose label is unique in both graphs is matched with
its twin. When refinement stalls on symmetric groups, such as identical
devices in parallel, one pair is matched by choice and refinement
continues.

## Watch it work: refining labels until every node has a twin

A two-input NAND gate as the designer drew it and as the layout was extracted, with other
names. The walkthrough labels devices and nets, refines the labels round by round until
every node is matched, then adds a short to show refinement failing.

<div class="walk-fig" data-walk="layout-versus-schematic"></div>

## The fine print

When the netlists differ, the algorithm stops with groups it cannot
match, and turning those groups into a readable cause ("this net is
shorted to that one") is the hard, heuristic part. Extraction depends
on a process-specific rule deck describing how layers form devices. The
Gemmini challenge on this site checks the layout's connectivity against
the netlist directly, because the ASAP7 (Arizona State University 7 nanometer
predictive) kit has no open deck for
this check.

## Where you meet it today

Netgen, the open-source comparison tool from the Magic flow, compares
netlists by iterative refinement of this kind, and KLayout offers
netlist comparison alongside its rule checks.
""",
    },
]
