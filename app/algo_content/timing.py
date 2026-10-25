"""Timing Analysis algorithm catalog: the graph computation at the
heart of sign-off, the interconnect models feeding it, the pessimism
and statistics refinements, and the optimization algorithms that act on
its verdicts."""

STAGE = {
    "slug": "timing",
    "name": "Timing Analysis",
    "tagline": (
        "Prove that a billion paths meet the clock without simulating a "
        "single vector. One graph algorithm at the core, wrapped in "
        "delay models, pessimism control, statistics, and the "
        "optimization loops that spend its slack reports."
    ),
    "families": [
        {
            "id": "core",
            "name": "The core computation",
            "lead": (
                "Static timing is a longest-path computation on a "
                "directed acyclic graph plus a delay model for its "
                "edges. These two pages are the foundation."
            ),
        },
        {
            "id": "interconnect",
            "name": "Interconnect analysis",
            "lead": (
                "Past the first micron, wires are circuits. Reducing "
                "extracted RC (Resistance-Capacitance) networks to "
                "usable delays is its own algorithmic field."
            ),
        },
        {
            "id": "refinement",
            "name": "Pessimism and statistics",
            "lead": (
                "Corner-based worst-casing lies in both directions. "
                "These methods remove provably impossible pessimism and "
                "model variation statistically."
            ),
        },
        {
            "id": "optimization",
            "name": "Timing optimization",
            "lead": (
                "Analysis is only half the loop: these algorithms spend "
                "area and power to buy back slack, guided by the "
                "timer's own gradients."
            ),
        },
    ],
}

ALGORITHMS = [
    {
        "slug": "sta-propagation",
        "card": "Push arrival times forward, required times back: slack everywhere.",
        "level": "foundational",
        "name": "Static Timing Propagation",
        "family": "core",
        "year": "1980s",
        "who": "Hitchcock and others",
        "chips": [
            ("diff-easy", "linear-time and exhaustive"),
            ("diff-easy", "the sign-off computation"),
        ],
        "summary": (
            "Levelize the circuit graph, push worst-case arrival times "
            "forward and required times backward; slack at every node "
            "falls out. Covers every path implicitly, no vectors "
            "needed."
        ),
        "lab": None,
        "refs": [
            ("Wikipedia: Static timing analysis",
             "https://en.wikipedia.org/wiki/Static_timing_analysis"),
            ("OpenSTA (open-source static timing engine)",
             "https://github.com/parallaxsw/OpenSTA"),
        ],
        "body": """
## The idea

Simulating enough vectors to exercise a billion paths is impossible;
static timing sidesteps input patterns entirely. Model the design as a
directed acyclic graph: nodes are pins, edges are gate arcs (input pin
to output pin, with delay from characterized libraries) and net arcs
(driver to sinks, with interconnect delay). Process nodes in
topological order, propagating **arrival time**: each node's arrival
is the maximum over incoming edges of source arrival plus edge delay
(maximum for setup analysis; a parallel minimum propagation serves
hold). Then sweep backward propagating **required time** from the
constraints at endpoints (capture clock edge minus setup, as this
site's slack quiz drills). Then, at every node:

<div class="eq">slack = required − arrival</div>

<ul class="eq-legend">
<li><code>slack</code> timing margin at the node: positive means met, negative means violated</li>
<li><code>required</code> latest allowed arrival, propagated backward from the constraints</li>
<li><code>arrival</code> actual worst-case arrival, propagated forward from the clocks</li>
</ul>

Negative slack marks the violating cone, and the worst path is
recovered by walking maximizing predecessors.

Two sweeps of the graph, linear in circuit size, cover *every* path
implicitly. Rising and falling
transitions propagate as separate values, slews propagate alongside
arrivals (each arc's delay depends on input slew and output load), and
multiple clocks, exceptions (false paths, multicycles), and
min/max corners multiply the bookkeeping without changing the
algorithm.

## The fine print

Exhaustiveness buys conservatism: the timer happily reports paths that
no logic value could ever sensitize (false paths), which is why
exception commands exist and why the SDC (Synopsys Design Constraints)
file, as this site's constraints problem insists, is half the
analysis.

## Where you meet it today

`report_checks` in OpenSTA, inside every synthesis, placement, and
routing optimization loop as the incremental oracle, and at sign-off,
where this computation is the final word on shipping.
""",
    },
    {
        "slug": "elmore-delay",
        "level": "foundational",
        "name": "Elmore Delay",
        "family": "core",
        "year": "1948",
        "who": "Elmore; Rubinstein, Penfield, Horowitz",
        "chips": [
            ("diff-easy", "closed-form and additive"),
            ("diff-medium", "pessimistic on real wires"),
        ],
        "summary": (
            "Delay to a node in an RC (Resistance-Capacitance) tree: "
            "sum over resistances on the path, each times all the "
            "capacitance downstream of it. Crude, robust, and the "
            "estimator inside forty years of layout algorithms."
        ),
        "lab": None,
        "refs": [
            ("Wikipedia: Elmore delay",
             "https://en.wikipedia.org/wiki/Elmore_delay"),
        ],
        "body": """
## The formula

For an RC (Resistance-Capacitance) tree driven at the root, the Elmore
delay to sink k is:

<div class="eq">T(k) = Σ over nodes i of R(path to k ∩ path to i) · C(i)</div>

<ul class="eq-legend">
<li><code>T(k)</code> Elmore delay estimate from the root to sink k</li>
<li><code>i</code> runs over every node of the RC (Resistance-Capacitance) tree</li>
<li><code>R(...)</code> resistance shared by the root-to-k and root-to-i paths</li>
<li><code>C(i)</code> capacitance hanging at node i</li>
</ul>

read as: walk the resistive path from root to k; each resistance R
carries a charging burden equal to *all* capacitance C downstream of
it, wherever it hangs. Equivalently, it is the first moment of the
network's impulse response, the mean of the delay distribution used as
if it were the delay. Derived by Elmore in 1948 for amplifiers, it
entered VLSI (Very Large Scale Integration) when Rubinstein, Penfield,
and Horowitz gave the tree formulation and bounds in 1983.

## Why algorithms love it

Closed form, linear-time for all sinks in one traversal, and
*additive*: extend a wire and delay updates incrementally, which is
exactly what an inner optimization loop needs when it evaluates
thousands of candidate topologies. It is also provably conservative in
the useful direction for RC trees (an upper bound on 50 percent
delay), and, most importantly, it ranks alternatives with high
*fidelity*: the topology Elmore prefers is almost always the topology
accurate simulation prefers.

## Its limits

Resistive shielding is invisible to it (downstream capacitance behind
big resistance counts fully, so it overestimates, sometimes badly on
resistive nets), slew is not modeled, and inductance does not exist.
Sign-off therefore moved to moment matching (next page) and library-
characterized gate models decades ago.

## Where you meet it today

Inside zero-skew clock construction (the Clock Tree Synthesis
catalog's merge equations are Elmore algebra), inside van Ginneken
buffering, in placement and routing cost functions, and in every
back-of-envelope wire-delay estimate anyone scribbles.
""",
    },
    {
        "slug": "awe-prima",
        "card": "Shrink a huge resistor-capacitor network to a small matching model.",
        "level": "research",
        "name": "Moment Matching: AWE and PRIMA",
        "family": "interconnect",
        "year": "1990, 1997",
        "who": "Pillage and Rohrer; Odabasioglu, Celik, Pileggi",
        "chips": [
            ("diff-easy", "orders beyond Elmore"),
            ("diff-medium", "numerical care required"),
        ],
        "summary": (
            "Approximate a huge extracted RC (Resistance-Capacitance) "
            "network by a small system matching its first moments: AWE "
            "(Asymptotic Waveform Evaluation) opened the field, PRIMA "
            "(Passive Reduced-order Interconnect Macromodeling "
            "Algorithm) made it stable and passive."
        ),
        "lab": None,
        "refs": [
            ("Pillage and Rohrer, 'Asymptotic waveform evaluation for timing analysis' (search)",
             "https://scholar.google.com/scholar?q=Pillage+Rohrer+asymptotic+waveform+evaluation"),
            ("Odabasioglu, Celik, Pileggi, 'PRIMA: passive reduced-order interconnect macromodeling algorithm' (search)",
             "https://scholar.google.com/scholar?q=PRIMA+passive+reduced-order+interconnect+macromodeling"),
        ],
        "body": """
## The idea

An extracted net at sign-off is thousands of RC
(Resistance-Capacitance) elements; simulating each with full accuracy
per timing arc is unaffordable, and Elmore's single moment is too
crude. Moment matching splits the difference. The network's response
expands as a Taylor series whose coefficients, the *moments*, are
computable by cheap recursive tree traversals (each moment is an
Elmore-like pass over the results of the previous one). AWE
(Asymptotic Waveform Evaluation) fits a low-order pole-zero model, a
handful of exponentials, whose moments match the first 2q of the
network via the Padé approximation, then reads delay and slew off the
small model. Accuracy at q of three or four approaches full simulation
on typical nets at a tiny fraction of the cost; Elmore is exactly the
q equals one case.

## From AWE to PRIMA

Raw Padé fitting is numerically treacherous: it can produce *unstable*
or non-physical models (poles in the wrong half-plane) from perfectly
passive wiring. The Krylov-subspace generation that followed cured the
numerics, and PRIMA (Passive Reduced-order Interconnect Macromodeling
Algorithm) added the decisive structural guarantee: its congruence-
transformation projection provably preserves *passivity*, so reduced
models remain stable in any surrounding circuit, which made reduction
safe to automate at scale.

## Where you meet it today

Inside every sign-off timer's interconnect engine: delay calculators
reduce each net's parasitics to a compact model (moment-based methods
and their descendants, with effective-capacitance techniques for the
gate side), and the same mathematics underlies model-order reduction
across electronics far beyond timing.
""",
    },
    {
        "slug": "cppr",
        "card": "Remove pessimism from clock paths that launch and capture share.",
        "level": "industry",
        "name": "Common Path Pessimism Removal",
        "family": "refinement",
        "year": "1990s onward",
        "who": "industry methodology",
        "chips": [
            ("diff-easy", "pure pessimism recovery"),
            ("diff-medium", "computationally delicate"),
        ],
        "summary": (
            "When launch and capture clocks share tree segments, "
            "worst-casing one early and one late double-counts "
            "variation the shared wire cannot exhibit; credit it back, "
            "exactly."
        ),
        "lab": None,
        "refs": [
            ("Common path pessimism removal overview (search)",
             "https://scholar.google.com/scholar?q=common+path+pessimism+removal+CPPR+timing"),
        ],
        "body": """
## The problem

On-chip-variation analysis derates delays: for a setup check, the
launch clock path is taken slow and the capture clock path fast (and
the reverse for hold), so any single-corner optimism is covered. But
launch and capture clocks flow through the *same tree*: from the
source down to the last common buffer, the two paths are literally the
same wires and cells. Deriting that shared prefix slow in one role and
fast in the other asserts that identical silicon is simultaneously at
two different corners, physically impossible, and the resulting
pessimism (the derate delta across the common segment) can eat a
meaningful slice of the cycle at advanced nodes, failing paths that
are actually fine.

## The fix

For each launch/capture flop pair, find the *common point*: the last
cell the two clock paths share. Compute the pessimism credit, the
difference between the slow-derated and fast-derated delay of the
shared prefix, and add it back to the slack of every check between
that pair. Exactness is per-path-pair, which is the computational rub:
naively it multiplies analysis by the number of flop pairs, so timers
use branch-point bookkeeping, caching, and on-demand exact
recomputation for near-critical paths to keep runtime civil. The
mechanism matters most for hold checks (where both paths are short and
the shared fraction large) and for anything with deep shared clock
spines.

## Where you meet it today

Enabled in every serious sign-off run (the timer reports slack with
and without the credit), in OpenSTA and commercial engines alike, and
in methodology arguments about derate values, where this credit is
what keeps on-chip-variation margins from compounding into fantasy.
""",
    },
    {
        "slug": "ssta",
        "level": "research",
        "name": "Statistical Static Timing Analysis",
        "family": "refinement",
        "year": "2000s",
        "who": "Visweswariah et al.; Chang and Sapatnekar",
        "chips": [
            ("diff-easy", "variation modeled statistically"),
            ("diff-hard", "the max of Gaussians is not Gaussian"),
        ],
        "summary": (
            "Propagate delay distributions instead of corner numbers: "
            "arrival times become random variables, slack becomes a "
            "yield curve. Canonical first-order forms made it "
            "tractable; adoption stayed selective."
        ),
        "lab": None,
        "refs": [
            ("Visweswariah et al., 'First-order incremental block-based statistical timing analysis' (search)",
             "https://scholar.google.com/scholar?q=Visweswariah+first-order+incremental+block-based+statistical+timing"),
            ("Wikipedia: Statistical static timing analysis",
             "https://en.wikipedia.org/wiki/Statistical_static_timing_analysis"),
        ],
        "body": """
## The idea

Corners answer 'does the chip work if *everything* is slow?', a
question no die ever poses; process variation is partly random and
per-device, and worst-casing every device simultaneously is both
pessimistic (independent randomness averages out) and, for hold
checks, potentially optimistic (correlations cut both ways).
Statistical static timing analysis replaces each delay with a random
variable. The canonical first-order form writes every timing quantity
as a nominal value plus sensitivities to shared global sources of
variation (per-layer, per-region, per-parameter) plus an independent
random term. Addition of such forms is exact and trivial; the crux is
**max**: the maximum of two Gaussians is not Gaussian, so block-based
engines re-approximate each max back into canonical form using
Clark's classical moment formulas, keeping correlation tracking (two
paths sharing a common prefix stay properly correlated through the
shared sensitivities). Two sweeps as usual, and the output is a slack
*distribution* per endpoint: parametric yield versus frequency rather
than one brittle number.

## Adoption

A wave of 2000s research promised statistical sign-off; industry
mostly settled elsewhere. Foundry statistical models are hard to get
and validate, methodology inertia is real, and cheaper compromises
(pessimism-controlled corners, advanced on-chip-variation derating
tables, which are themselves statistical data in disguise) captured
much of the benefit. Statistical engines thrive where the question is
genuinely distributional: memory characterization, yield-versus-
frequency binning, variation-aware library and clock analysis.

## Where you meet it today

Inside advanced on-chip-variation methodologies (learned or
table-based derates), vendor statistical modes, and any conversation
about why sign-off corners keep multiplying.
""",
    },
    {
        "slug": "van-ginneken",
        "card": "Place buffers on a net optimally, bottom-up, pruning weak options.",
        "level": "research",
        "name": "Van Ginneken Buffer Insertion",
        "family": "optimization",
        "year": "1990",
        "who": "van Ginneken; Lillis et al.",
        "chips": [
            ("diff-easy", "provably optimal placement"),
            ("diff-easy", "elegant dynamic program"),
        ],
        "summary": (
            "Given a routed net and legal buffer positions, choose "
            "where to insert buffers to maximize required time at the "
            "driver: solved exactly, bottom-up, by propagating "
            "(capacitance, required-time) candidates and pruning the "
            "dominated ones."
        ),
        "lab": None,
        "refs": [
            ("van Ginneken, 'Buffer placement in distributed RC-tree networks for minimal Elmore delay' (search)",
             "https://scholar.google.com/scholar?q=van+Ginneken+buffer+placement+RC-tree+minimal+Elmore+delay"),
            ("Lillis, Cheng, Lin, buffer insertion with sizing and wire sizing extensions (search)",
             "https://scholar.google.com/scholar?q=Lillis+Cheng+Lin+optimal+wire+sizing+buffer+insertion"),
        ],
        "body": """
## The idea

Long wires are quadratically slow (double the length, quadruple the
Elmore delay), and the cure is buffering: break the wire into segments
each driven afresh. Where exactly to break is an optimization with an
exponential-looking choice space, and van Ginneken solved it exactly
with a dynamic program of striking economy. Walk the routed tree from
the sinks toward the driver. At every point carry a set of
*candidates*, pairs (C, Q): the downstream capacitance this subtree
presents, and the required arrival time achievable at this point given
the buffering decisions below. Wire segments transform candidates
(capacitance grows, required time degrades by Elmore terms); at a
legal buffer site, each candidate spawns an alternative where a buffer
is inserted (capacitance resets to the buffer's input capacitance,
required time pays the buffer delay); at merges, candidate sets
combine. The key to tractability: *prune dominated candidates*, any
pair worse in both coordinates than a rival dies. The surviving
frontier stays small (linear in sites for the classic case), and at
the driver the best candidate, unwound, is the provably optimal
buffering: quadratic time in the original formulation, later sharpened
to near-linear.

## Extensions

Lillis and colleagues folded in buffer *sizing* from a discrete
library and inverting buffers with polarity tracking; later work added
slew and cost constraints and wire sizing. The candidate-propagation-
with-pruning pattern generalized into a small industry of layout
optimizations.

## Where you meet it today

Buffering is a dominant fraction of cell count on modern chips, and
every physical-synthesis engine's repair-timing step (OpenROAD's
resizer included) runs recognizable descendants of this dynamic
program over its nets.
""",
    },
    {
        "slug": "gate-sizing",
        "level": "industry",
        "name": "Gate Sizing (Logical Effort and Lagrangian Methods)",
        "family": "optimization",
        "year": "1999; 1980s onward",
        "who": "Sutherland and Sproull; Fishburn and Dunlop",
        "chips": [
            ("diff-easy", "closed-form intuition"),
            ("diff-medium", "discrete reality"),
        ],
        "summary": (
            "Choose each gate's drive strength: logical effort gives "
            "the closed-form theory (equalize effort per stage), convex "
            "and Lagrangian formulations give the optimizer, and "
            "library reality makes it discrete."
        ),
        "lab": None,
        "refs": [
            ("Sutherland, Sproull, Harris, 'Logical Effort' (book overview)",
             "https://en.wikipedia.org/wiki/Logical_effort"),
            ("Fishburn and Dunlop, 'TILOS: a posynomial programming approach to transistor sizing' (search)",
             "https://scholar.google.com/scholar?q=Fishburn+Dunlop+TILOS+posynomial+transistor+sizing"),
        ],
        "body": """
## The theory: logical effort

Model a gate's delay as

<div class="eq">delay = g · h + p</div>

<ul class="eq-legend">
<li><code>g</code> logical effort: how much worse than an inverter the gate's topology drives</li>
<li><code>h</code> electrical effort: output load divided by input capacitance</li>
<li><code>p</code> parasitic delay: the gate's intrinsic, load-independent cost</li>
</ul>
 Along a
path, total delay is minimized when every stage bears the **same
stage effort**, the geometric mean of the path's total effort, with
optimal stage effort near 4 (whence the folklore fanout-of-four rule
and the formula for how many stages a heavy load deserves). Ten
minutes of algebra explains buffer chains, why reordering logic helps,
and roughly how big everything should be, the single most useful
piece of theory in a circuit designer's pocket.

## The optimization

Real sizing is a global problem: gates share loads, so sizes couple.
With continuous sizes and Elmore-style delays the problem is
*posynomial*, convex after a change of variables, so exact optimums
are computable (the TILOS line: greedy sensitivity sizing guided by
this structure; later, full geometric programming). Production
methods must instead pick from a *discrete* library of drive strengths
and thresholds under characterized (non-posynomial) delays, so modern
sizers use Lagrangian relaxation: dualize the timing constraints,
let per-arc multipliers price criticality, then sweep the netlist
choosing each gate's cheapest size given its prices, iterating
multiplier updates, scalable to millions of cells and the shape of
most published industrial sizers.

## Where you meet it today

Every synthesis and physical-synthesis tool's sizing passes
(OpenROAD's resizer among them), power-recovery loops that downsize
off-critical gates, and interviews, where logical effort is the
canonical 'show me you understand delay' topic.
""",
    },
    {
        "slug": "retiming",
        "level": "research",
        "name": "Retiming",
        "family": "optimization",
        "year": "1991",
        "who": "Leiserson and Saxe",
        "chips": [
            ("diff-easy", "provably optimal period"),
            ("diff-medium", "verification and reset care"),
        ],
        "summary": (
            "Move registers across combinational logic without changing "
            "function: minimum feasible clock period reduces to "
            "shortest-path feasibility, solved exactly on the circuit "
            "graph."
        ),
        "lab": None,
        "refs": [
            ("Leiserson and Saxe, 'Retiming synchronous circuitry' (search)",
             "https://scholar.google.com/scholar?q=Leiserson+Saxe+retiming+synchronous+circuitry"),
            ("Wikipedia: Retiming",
             "https://en.wikipedia.org/wiki/Retiming"),
        ],
        "body": """
## The idea

Registers are movable. Pushing a register backward through a gate
(from its output to all its inputs) or forward likewise leaves every
input-output behavior of the circuit unchanged, only the internal
pipeline alignment shifts. Retiming asks: what assignment of register
moves minimizes the clock period? Leiserson and Saxe formalized it on
a graph whose edges carry register counts w(e) and whose nodes carry
gate delays: a retiming assigns each node an integer lag r(v), and each edge's
register count becomes

<div class="eq">w'(e) = w(e) + r(head) − r(tail)</div>

<ul class="eq-legend">
<li><code>w(e)</code> registers originally on edge e</li>
<li><code>w'(e)</code> registers on edge e after retiming</li>
<li><code>r(v)</code> integer lag assigned to node v: how many registers moved across it</li>
</ul>

Legality plus a target period T translate into difference constraints, non-negative registers
everywhere, and at least one register on any path whose combinational
delay exceeds T. Difference-constraint systems are shortest-path
feasibility (Bellman-Ford detects the negative cycle that means
'impossible'), so the minimum achievable T is found exactly by binary
search over T with a feasibility solve at each step, with the classic
W and D matrices organizing path delays.

## Caveats

Function is preserved; *everything else* needs care: initial state
must be recomputed and may not exist for a given move set, reset and
scan logic constrain moves, verification tools must be told
(sequential rather than combinational equivalence), and delays on real
chips depend on the placement the retimer just changed. Hence its
practical home: pipeline balancing during synthesis with conservative
scopes, and FPGA (Field-Programmable Gate Array) flows, where the
regular fabric keeps post-move delays predictable and architectures
with many registers make moves cheap.

## Where you meet it today

Synthesis options (`retime`), FPGA compilers doing it aggressively by
default, and the theory course, where it is the standard example of a
layout-adjacent problem solved exactly by graph algorithms.
""",
    },
]
