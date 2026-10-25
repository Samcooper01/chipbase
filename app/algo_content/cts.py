"""Clock Tree Synthesis algorithm catalog: from geometric H-trees
through exact zero-skew construction to meshes and multisource hybrids."""

STAGE = {
    "slug": "cts",
    "name": "Clock Tree Synthesis",
    "tagline": (
        "Deliver one signal to a million flip-flops at almost the same "
        "instant, on the wire that toggles every cycle and burns a big "
        "slice of the power budget. The algorithms run from geometric "
        "symmetry through provably zero-skew tree construction to "
        "deliberately redundant meshes."
    ),
    "families": [
        {
            "id": "trees",
            "name": "Balanced tree construction",
            "lead": (
                "Build a tree whose root-to-leaf delays match. Four "
                "algorithms, in rising order of sophistication: symmetry, "
                "recursive geometric balance, exact delay balance, and "
                "provably minimal-wire zero skew."
            ),
        },
        {
            "id": "optimization",
            "name": "Skew as a resource",
            "lead": (
                "Zero skew is neither free nor always right. These "
                "methods buffer real trees against real loads, and spend "
                "skew deliberately where it buys timing."
            ),
        },
        {
            "id": "structures",
            "name": "Redundant structures",
            "lead": (
                "When variation is the enemy, add wire: meshes and "
                "hybrid schemes trade power for robustness by shorting "
                "many paths together."
            ),
        },
    ],
}

ALGORITHMS = [
    {
        "slug": "h-tree",
        "card": "A nested H makes every leaf equidistant: zero skew by construction.",
        "level": "foundational",
        "name": "H-Tree and X-Tree",
        "family": "trees",
        "year": "1980s",
        "who": "folklore and many authors",
        "chips": [
            ("diff-easy", "zero skew by symmetry"),
            ("diff-medium", "assumes uniform sinks"),
        ],
        "summary": (
            "Route the clock as a recursively nested H: every leaf is "
            "geometrically equidistant from the root, so skew is zero by "
            "construction, as long as loads are uniform."
        ),
        "lab": None,
        "refs": [
            ("Wikipedia: H tree",
             "https://en.wikipedia.org/wiki/H_tree"),
        ],
        "body": """
## The idea

Perfect symmetry needs no analysis. Draw an H; drive it from the exact
center; the four tips are equidistant from the driver by construction.
Put a smaller H at each tip and recurse: after k levels, 4^k endpoints
all see identical wire length, identical topology, identical delay.
Skew, the difference in clock arrival between sinks, is zero not
because anything was computed but because nothing distinguishes one
leaf from another. The X-tree variant uses diagonal branches for
shorter paths where 45-degree routing is allowed.

## Where symmetry breaks

The construction assumes what real chips never provide: sinks arranged
uniformly, identical loads at every tip, homogeneous wire layers, and
no blockages forcing detours. Any asymmetry in load or route converts
directly into skew, and pure H-trees also spend a lot of wire reaching
regions that may contain few flip-flops. So in practice the H-tree
survives as the *top* of the network: a symmetric spine distributing
the clock to a grid of regional tap points, below which load-aware
algorithms (the next three pages) take over, or a mesh shorts the taps
together.

## Where you meet it today

Top-level clock distribution of high-performance processors, standard
figures in every textbook, and as the mental model for why 'balanced'
and 'symmetric' are the first words anyone says about clock networks.
""",
    },
    {
        "slug": "method-of-means-and-medians",
        "level": "foundational",
        "name": "Method of Means and Medians",
        "family": "trees",
        "year": "1990",
        "who": "Jackson, Srinivasan, Kuh",
        "chips": [
            ("diff-easy", "first real-sink algorithm"),
            ("diff-medium", "balances length, not delay"),
        ],
        "summary": (
            "Recursively split the actual sink set by the median "
            "coordinate and route from the region's center of mass to "
            "each half's center: geometric balance for arbitrary sink "
            "placements."
        ),
        "lab": None,
        "refs": [
            ("Jackson, Srinivasan, Kuh, 'Clock routing for high-performance ICs' (search)",
             "https://scholar.google.com/scholar?q=Jackson+Srinivasan+Kuh+clock+routing+high+performance"),
        ],
        "body": """
## The idea

Take the sinks where they actually are. Compute their center of mass
(the *mean*); split the set into two equal halves by the *median* in x
(or y, alternating per level); route from the center of mass to each
half's center of mass; recurse within each half until single sinks
remain. Every sink ends up reached through the same number of levels,
and because each split halves the population geometrically, path
lengths to the two sides of every branch are roughly equal, so skew is
roughly controlled, for real, arbitrary sink distributions, which the
H-tree could never handle.

## Its place in history

This 1990 algorithm effectively founded clock *routing* as an
algorithmic field: before it, balanced clocks meant hand-drawn
symmetry; after it, clock trees were computed from the netlist's
actual geometry. Its limits were understood immediately: it balances
*wire length statistically*, not delay, ignores capacitive load
differences, and guarantees nothing. Within two years both gaps were
closed: exact zero-skew construction using the Elmore delay model (next
page), then provably minimum-wirelength zero skew (the page after).

## Where you meet it today

As the classic first lecture in clock synthesis, as a fast constructor
inside larger systems (its top-down recursion still seeds some tools'
initial topologies), and conceptually in every 'bipartition the sinks
and recurse' clock heuristic since.
""",
    },
    {
        "slug": "exact-zero-skew",
        "level": "research",
        "name": "Exact Zero-Skew Tree Construction",
        "family": "trees",
        "year": "1991",
        "who": "Tsay",
        "chips": [
            ("diff-easy", "zero skew in the model"),
            ("diff-easy", "delay-aware merging"),
        ],
        "summary": (
            "Merge subtrees bottom-up, computing from the Elmore delay "
            "model the exact tapping point on the connecting wire that "
            "equalizes both sides' delays, adding wire length only when "
            "geometry demands it."
        ),
        "lab": None,
        "refs": [
            ("Tsay, 'Exact zero skew' (search)",
             "https://scholar.google.com/scholar?q=Tsay+exact+zero+skew+ICCAD+1991"),
        ],
        "body": """
## The idea

Stop balancing geometry and balance *delay*. Model every wire segment
as resistance and capacitance and use the Elmore delay model (see its
page in the Timing Analysis catalog) to compute signal delay through
the tree. Then build bottom-up: pair up sinks (or subtrees), connect
each pair with a wire, and solve exactly for the *tapping point* along
that wire where the driver must attach so that Elmore delay to every
sink on the left equals delay to every sink on the right. The balance
equation is quadratic in the tap position and accounts for both sides'
downstream capacitance, so a heavily loaded side correctly receives
the shorter wire arm. If even placing the tap at one end cannot
balance (one side much faster), *elongate*: add serpentine wire to the
fast side until balance holds. Recurse pairing merged subtrees until
one root remains: a tree with exactly zero skew in the model.

## Why it was a landmark

It converted clock synthesis from heuristic balancing into exact
construction: skew is eliminated by algebra, not statistics, load
asymmetry included. The remaining inefficiency was that merge
*locations* were chosen without foresight, so wire was sometimes
wasted; characterizing all optimal merge locations is precisely what
the Deferred-Merge Embedding (next page) added a year later.

## Where you meet it today

The tapping-point balance computation is the arithmetic core inside
essentially every tree-based clock synthesizer's merge step, whatever
topology surrounds it.
""",
    },
    {
        "slug": "deferred-merge-embedding",
        "level": "industry",
        "name": "Deferred-Merge Embedding",
        "family": "trees",
        "year": "1992",
        "who": "Chao, Hsu, Ho; Boese, Kahng; Edahiro",
        "chips": [
            ("diff-easy", "optimal wirelength zero skew"),
            ("diff-easy", "the standard algorithm"),
        ],
        "summary": (
            "Do not commit merge points early: propagate, bottom-up, the "
            "entire segment of feasible zero-skew locations, and only "
            "embed exact positions on the way back down. Minimal wire, "
            "zero skew, and the algorithm real tools descend from."
        ),
        "lab": None,
        "refs": [
            ("Chao, Hsu, Ho, 'Zero skew clock net routing' (search)",
             "https://scholar.google.com/scholar?q=Chao+Hsu+Ho+zero+skew+clock+routing+DME"),
            ("Edahiro, 'A clustering-based optimization algorithm in zero-skew routings' (search)",
             "https://scholar.google.com/scholar?q=Edahiro+clustering+zero-skew+routing"),
        ],
        "body": """
## The idea

Tsay's method balances each merge exactly but *places* each merge point
greedily, freezing geometry too early. Deferred-Merge Embedding (DME)
observes that for any two subtrees, the set of points where a zero-skew
merge is possible at minimal wire cost is not one point but a *segment*:
in Manhattan geometry, loci of equal distance are diagonal line
segments (tilted 45 degrees), and intersecting the delay-balance
condition with them yields a *merging segment*. So run two passes.
**Bottom-up**: for each pairing, compute and store the merging segment,
built from the children's segments, without choosing any point.
**Top-down**: place the root wherever its segment allows (or at the
clock source), then walk down choosing for each child the point of its
merging segment nearest the parent's chosen point. Every choice is then
provably wire-minimal for the given topology, and skew is exactly zero
in the Elmore model.

Topology choice (which sinks pair with which) remains a degree of
freedom; the Greedy-DME / clustering variants (Edahiro's, notably)
choose pairings by nearest-neighbor clustering at each level and made
the pipeline fast and practical.

## Why it is the canonical algorithm

It is an exactly optimal (for wire, given topology and
model) polynomial-time construction for a problem industry runs daily.
Extensions handle bounded skew (segments become regions), buffered
merges, obstacle avoidance, and slew constraints.

## Where you meet it today

Directly inside modern clock synthesizers: OpenROAD's TritonCTS builds
its trees on DME-style construction with clustering and buffering
layered on. When this site's clock-tree problem talks about balanced
merges, this is the method behind the words.
""",
    },
    {
        "slug": "buffered-cts",
        "card": "Insert and balance buffers so the tree meets slew and load limits.",
        "level": "industry",
        "name": "Buffered Clock Tree Synthesis",
        "family": "optimization",
        "year": "1990s onward",
        "who": "many",
        "chips": [
            ("diff-easy", "what real tools ship"),
            ("diff-medium", "many constraints at once"),
        ],
        "summary": (
            "Real trees insert buffers level by level to meet slew and "
            "load limits, cluster sinks under capacitance budgets, and "
            "balance the buffered structure, the practical layer over "
            "the geometric algorithms."
        ),
        "lab": None,
        "refs": [
            ("TritonCTS in OpenROAD (clock tree synthesis module)",
             "https://github.com/The-OpenROAD-Project/OpenROAD"),
            ("Alpert et al., buffered clock and interconnect synthesis literature (search)",
             "https://scholar.google.com/scholar?q=Alpert+buffered+clock+tree+synthesis"),
        ],
        "body": """
## The idea

A bare wire tree cannot drive ten thousand flip-flops: signal edges
would slump hopelessly. Practical clock synthesis therefore interleaves
electrical engineering with the geometric algorithms:

- **Sink clustering**: group nearby flip-flops so each cluster's total
  capacitance and spread fit what one buffer can drive with acceptable
  slew (this site's clock-tree problem plays exactly this game with
  its max-fanout knob).
- **Buffer insertion**: place a buffer at each cluster head and at
  intermediate levels, re-balancing the tree so *buffered* delays, not
  just wire delays, match; buffer input capacitance becomes the load
  the next level up must balance.
- **Slew and load rule enforcement**: every net in the tree must meet
  maximum transition and maximum capacitance limits across corners,
  which bounds level fanout and wire span.
- **Level balancing**: keep every root-to-sink path through the same
  number of buffer stages, because stage-count mismatch converts
  process variation directly into skew (on-chip variation derating).

Characterized buffer delay tables replace closed-form Elmore terms in
the balance equations, but the merge mathematics remains DME-shaped
underneath.

## Where you meet it today

This *is* `clock_tree_synthesis` in OpenROAD (TritonCTS clusters
sinks, builds DME-style topology, inserts and sizes buffers) and its
commercial counterparts. The skew/insertion-delay/power triangle you
tuned in this site's instant-model problem is precisely the trade
space these steps navigate.
""",
    },
    {
        "slug": "useful-skew",
        "level": "research",
        "name": "Useful Skew and Clock Scheduling",
        "family": "optimization",
        "year": "1990",
        "who": "Fishburn",
        "chips": [
            ("diff-easy", "skew as an asset"),
            ("diff-medium", "verification complexity"),
        ],
        "summary": (
            "Zero skew is not optimal: deliberately arriving early at "
            "some flops and late at others steals time from fast paths "
            "for slow ones. Formulated as an optimization over arrival "
            "offsets, solvable exactly."
        ),
        "lab": None,
        "refs": [
            ("Fishburn, 'Clock skew optimization' (search)",
             "https://scholar.google.com/scholar?q=Fishburn+clock+skew+optimization+1990"),
        ],
        "body": """
## The idea

A path from flip-flop A to flip-flop B must fit its logic delay between
A's launch edge and B's capture edge. If the clock reaches B a little
*late*, the path gains exactly that much time; the price is paid by
paths leaving B, which lose the same amount. Skew is therefore a
*budget to allocate* rather than noise to eliminate. Fishburn formulated it:
let t_i be each flop's clock arrival offset. With T the clock
period, every setup constraint becomes

<div class="eq">t_j − t_i ≥ delay_max(i→j) − T + setup</div>

and every hold constraint becomes

<div class="eq">t_i − t_j ≥ hold − delay_min(i→j)</div>

<ul class="eq-legend">
<li><code>t_i, t_j</code> clock arrival offsets at the launching and capturing flip-flops</li>
<li><code>T</code> the clock period being minimized</li>
<li><code>delay_max/min</code> slowest and fastest path delay from flop i to flop j</li>
<li><code>setup, hold</code> the capturing flip-flop's timing requirements</li>
</ul>

Minimizing T subject to these difference constraints is a linear
program, and pure
feasibility questions reduce to shortest-path computations on the
constraint graph (negative cycle means infeasible). The optimal
schedule can cut the period below what zero skew permits, bounded by
the mean cycle delay around the worst loop.

## From schedule to silicon

Computing offsets is the easy half; *implementing* them means the
clock tree must deliver prescribed non-zero skews: bounded-skew and
prescribed-skew extensions of Deferred-Merge Embedding, or explicit
delay insertion near specific flops. Modern tools apply the idea
locally and conservatively (concurrent clock and data optimization):
nudge arrivals at flops on critical paths, within tight windows,
re-verifying hold everywhere, because aggressive schedules multiply
verification corners and variation risk.

## Where you meet it today

As 'useful skew' options in every commercial flow, in
clock-and-datapath co-optimization steps, and in interview questions
about why zero skew is not the objective, merely the safe default.
""",
    },
    {
        "slug": "clock-mesh",
        "card": "Short a grid of clock wire together: tiny skew, high power.",
        "level": "industry",
        "name": "Clock Mesh",
        "family": "structures",
        "year": "1990s onward",
        "who": "industry practice; analysis literature",
        "chips": [
            ("diff-easy", "variation-proof"),
            ("diff-hard", "power-expensive"),
        ],
        "summary": (
            "Short a whole grid of clock wire together and drive it from "
            "many points: local skew collapses because neighboring sinks "
            "share metal, at a steep cost in wire, buffers, and power."
        ),
        "lab": None,
        "refs": [
            ("Clock mesh analysis and optimization literature (search)",
             "https://scholar.google.com/scholar?q=clock+mesh+skew+analysis+optimization"),
        ],
        "body": """
## The idea

Trees are efficient and fragile: each sink hangs off one path, so any
variation along that path (device, wire, voltage, temperature) lands
directly in its arrival time. A mesh inverts the trade. Lay a grid of
horizontal and vertical clock wire over the region; drive the grid at
many points from a balanced pre-tree; connect each flip-flop to the
nearest grid segment. Now every sink is electrically connected to
every other through many parallel paths: local variation is averaged
away by sheer copper, and nearby sinks, the pairs that matter most for
short-path timing, see nearly identical arrivals no matter what the
drivers do. Measured and simulated local skews on meshes sit far below
comparable trees, and tolerance to voltage droop and variation
is the objective the structure serves.

The bill: enormous wire capacitance switching every cycle (clock power
multiplies), many strong drivers, and analysis pain, since a
multi-driven shorted grid is one giant coupled circuit requiring
careful extraction and simulation rather than simple tree traversal.

## Where you meet it today

High-performance microprocessors and anywhere timing margins are worth
more than milliwatts: server cores, high-speed datapaths. Design
questions become mesh pitch, driver placement, and stub lengths, an
optimization literature of its own.
""",
    },
    {
        "slug": "multisource-cts",
        "level": "industry",
        "name": "Multisource and Hybrid Clock Trees",
        "family": "structures",
        "year": "2010s",
        "who": "industry methodology",
        "chips": [
            ("diff-easy", "the modern compromise"),
            ("diff-medium", "methodology-heavy"),
        ],
        "summary": (
            "A balanced top structure delivers the clock to many "
            "regional tap drivers; below them, ordinary local trees "
            "serve the flops. Mesh-like robustness where it matters, "
            "tree-like power where it does not."
        ),
        "lab": None,
        "refs": [
            ("Multisource clock tree synthesis methodology literature (search)",
             "https://scholar.google.com/scholar?q=multisource+clock+tree+synthesis+MSCTS+methodology"),
        ],
        "body": """
## The idea

Between the low-power tree and the high-power mesh is the structure most
advanced chips actually use. Build a deliberately balanced *top*
network, an H-tree spine or a coarse mesh, that delivers the clock with
tightly matched delay to dozens or hundreds of *tap points* spread
across the block. At each tap, a driver launches a conventional local
subtree synthesized by the usual process (clustered, buffered,
DME-based) over its neighborhood's flip-flops. Because every local
subtree hangs from a low-skew, variation-averaged source and spans only
a small region with few buffer stages, cross-chip variation
accumulates over far less depth: global skew approaches mesh quality
while total switched capacitance stays near tree levels. When the top
layer is a true shorted mesh, the scheme is mesh-plus-local-trees;
with a balanced tree top it is usually called multisource clock tree
synthesis.

The engineering difficulties are in the seams: choosing tap count and placement
(coverage versus top-level load), balancing unequal subtree insertion
delays against a common budget, and modeling the top structure
accurately enough for sign-off across corners.

## Where you meet it today

Default methodology for large, high-frequency SoC (System on Chip)
blocks in advanced nodes; every major commercial platform offers a
multisource flow, and the structure question (pure tree, multisource,
or mesh?) is a standard early clock-architecture decision, made
exactly along the power-versus-variation axis this catalog keeps
returning to.
""",
    },
]
