"""Floorplanning algorithm catalog: every notable algorithm and
representation, from 1977 partition-driven methods through the
reinforcement-learning era. Bodies are markdown."""

STAGE = {
    "slug": "floorplanning",
    "name": "Floorplanning",
    "tagline": (
        "Arranging blocks on a die is packing, sizing, and wirelength "
        "optimization all at once, and it is NP-hard (Non-deterministic "
        "Polynomial hard) even in toy forms. Fifty years of answers: "
        "recursive partitioning, slicing trees, a zoo of non-slicing "
        "representations searched by annealing, exact mathematical "
        "programming, and lately machine learning."
    ),
    "families": [
        {
            "id": "constructive",
            "short": "constructive",
            "name": "Constructive and partition-driven methods",
            "lead": (
                "The oldest school: build the floorplan directly from the "
                "netlist's structure, cutting or growing your way to a "
                "layout instead of searching a space of candidates."
            ),
        },
        {
            "id": "slicing",
            "short": "slicing",
            "name": "Slicing floorplans",
            "lead": (
                "Restrict floorplans to recursive horizontal and vertical "
                "cuts and the problem gains beautiful structure: a binary "
                "tree, a compact algebra, and exact sizing algorithms."
            ),
        },
        {
            "id": "representations",
            "short": "representations",
            "name": "Non-slicing representations",
            "lead": (
                "From 1995 to 2004 the field raced to encode arbitrary "
                "block arrangements as small combinatorial objects that a "
                "search engine can perturb. Each entry here is one such "
                "encoding, with its own trade-off between expressiveness, "
                "solution-space size, and decode cost."
            ),
        },
        {
            "id": "engines",
            "short": "engines",
            "name": "Search engines",
            "lead": (
                "A representation only defines the space; something has to "
                "search it. These are the optimizers that drive the "
                "representations above."
            ),
        },
        {
            "id": "modern",
            "short": "modern",
            "name": "Fixed-outline and the modern era",
            "lead": (
                "Modern chips give you a fixed die and macros mixed with "
                "millions of cells. The problem statement changed, and the "
                "algorithms changed with it."
            ),
        },
    ],
}

ALGORITHMS = [
    # ----- constructive -----
    {
        "slug": "min-cut-floorplanning",
        "card": "Split netlist and die together so connected blocks land side by side.",
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "level": "foundational",
        "name": "Min-Cut Floorplanning",
        "family": "constructive",
        "year": "1977",
        "who": "Breuer; Lauther",
        "chips": [
            ("diff-easy", "fast and scalable"),
            ("diff-medium", "wirelength by proxy"),
        ],
        "summary": (
            "Recursively bipartition the netlist while bipartitioning the "
            "die: blocks that talk end up near each other because cutting "
            "their connection would have been expensive."
        ),
        "lab": None,
        "refs": [
            ("Breuer, 'A class of min-cut placement algorithms' (search)",
             "https://scholar.google.com/scholar?q=Breuer+min-cut+placement+1977"),
            ("Lauther, 'A min-cut placement algorithm for general cell assemblies' (search)",
             "https://scholar.google.com/scholar?q=Lauther+min-cut+placement+general+cell+1979"),
        ],
        "body": """
## The idea

Min-cut floorplanning couples two recursions. A netlist partitioner
splits the design into two groups while cutting as few nets as
possible, and the die is split into two regions. One group is assigned
to each region, and the process recurses on each half until every
region holds a single block.

The connection to wirelength is indirect. At each level the algorithm
minimizes one quantity, computed entirely from the netlist and the
current partition:

<div class="eq">cut(level) = number of nets whose two groups fall on opposite sides of that level's cut line</div>
<ul class="eq-legend">
<li><code>groups</code> the two block sets the partitioner produced at this level</li>
<li><code>cut line</code> the single line splitting the current region; which nets cross it depends only on which group each block was assigned to, so the count is a netlist quantity</li>
</ul>

Any net counted in cut(level) must be routed across that level's line,
so minimizing cuts at every level shortens a hierarchy of crossings.
The physical length of each crossing is not read from the netlist: it
comes from the geometry. Because the die is halved into regions of
known size at each level, a cut made early spans a large region and a
cut made deep spans a small one, so the span at each level is just the
region dimension the recursion has reached. That geometric weight is
why coarse-level cuts matter most and the recursion minimizes them
first; the netlist supplies only the counts, the bisection supplies the
spans.

The partitioner inside is whatever the state of the art offers:
Kernighan-Lin in the early years, Fiduccia-Mattheyses after 1982,
multilevel partitioners today. All three have pages in the placement
catalog.

## The recipe

**Step 1 (partition the netlist).** Split the current block set into
two groups of roughly equal size, minimizing the number of nets with
endpoints in both groups.

**Step 2 (split the region).** Cut the current die region into two
sub-regions with one line, alternating direction (vertical, then
horizontal) between levels so regions stay compact.

**Step 3 (assign and recurse).** Assign one group to each sub-region.
Repeat Steps 1 and 2 on each (group, region) pair.

**Step 4 (stop).** Recursion ends when a region holds a single block,
which now has a position.

## Watch it work: recursive bisection

Eight blocks and ten nets on one die. The walkthrough runs the
recursion level by level with the cut-net count computed at each
level, shows why minimizing cuts shortens wirelength, and ends on the
shape-blindness that limits the method.

<div class="walk-fig" data-walk="mincut-fp"></div>

## Pros, cons, and the trade-off

<div class="pros-cons">
<div class="pc-card pc-pros">
<h3>Strengths</h3>
<ul>
<li><strong>Constructive and fast</strong>: one top-down pass with a fast partitioner, near-linear in block count, no iteration.</li>
<li><strong>Wirelength-aware by construction</strong>: minimizing cuts at every level directly reduces the crossing hierarchy.</li>
<li><strong>Scales</strong>: the recursion and the partitioners inside it both scale to millions of objects, which is why the idea became the backbone of standard-cell placement.</li>
</ul>
</div>
<div class="pc-card pc-cons">
<h3>Weaknesses</h3>
<ul>
<li><strong>Shape-blind</strong>: the recursion assigns regions, not shapes, so large or oddly shaped macros overflow the small leaf regions.</li>
<li><strong>Greedy and local</strong>: a net cut at the top level is accounted once, though its final length depends on decisions made much deeper.</li>
<li><strong>No global optimization</strong>: each cut is locally optimal, with no mechanism to revisit an early split that later proves costly.</li>
</ul>
</div>
</div>

<div class="tradeoff-box">
<h3>The trade-off</h3>
<p>Min-cut floorplanning trades global optimality for speed and scale. Recursive bisection cannot reason about block shapes or revisit early cuts, but it produces a wirelength-aware placement in a single fast pass. That trade sent the idea into standard-cell placement, where blocks are uniform and small, and left macro floorplanning to methods that reason about shapes directly.</p>
</div>

## Is it actually used today?

The evidence for min-cut splits between macro floorplanning, where it
is historical, and placement, where its descendants are standard.

- <strong>Floorplanning</strong>: rarely for macro placement, because
  it is shape-blind. Modern macro floorplanners reason about shapes
  and use annealing or analytical methods.
- <strong>Placement</strong>: the recursive-bisection idea, with
  multilevel partitioners inside, was the dominant standard-cell
  placement approach for decades and remains in the literature and in
  some flows (see the placement catalog).
- <strong>The partitioners</strong>: Kernighan-Lin,
  Fiduccia-Mattheyses, and multilevel partitioning are documented,
  in use, and covered on their own placement pages.
""",
    },
    {
        "slug": "cluster-growth",
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "level": "foundational",
        "name": "Cluster Growth",
        "family": "constructive",
        "year": "1970s",
        "who": "folk method, many variants",
        "chips": [
            ("diff-easy", "simplest possible"),
            ("diff-hard", "greedy, no lookahead"),
        ],
        "summary": (
            "Seed the layout with one block, then repeatedly attach the "
            "unplaced block with the strongest connection to what is "
            "already placed. Greedy, linear, and a surprisingly good "
            "baseline."
        ),
        "lab": None,
        "refs": [
            ("Kahng, Lienig, Markov, Hu, 'VLSI Physical Design' textbook, chapter 3",
             "https://link.springer.com/book/10.1007/978-90-481-9591-6"),
        ],
        "body": """
## The idea

Cluster growth builds a floorplan one block at a time. Pick a seed
block, place it, then repeat a greedy loop: score every unplaced
block by its connectivity to the blocks already placed, attach the
highest-scoring block in the best open position next to the growing
cluster, and continue until every block is placed.

Each unplaced block gets a *connectivity score*: its total connection
to the blocks already placed.

<div class="eq">score(u) = sum over placed blocks p of weight(u, p)</div>
<ul class="eq-legend">
<li><code>u</code> an unplaced block being considered</li>
<li><code>weight(u, p)</code> the connectivity between u and an already-placed block p (number of shared nets, or a net-weighted count)</li>
<li>the block with the highest connectivity score is the most tied to the current cluster, so attaching it next keeps strongly connected blocks close; ties are broken toward the higher-degree block</li>
</ul>

The chosen block is then placed in the open slot next to the cluster
with the least *added-wire cost*: the wire that slot would add.

<div class="eq">added-wire cost(s) = sum over placed blocks p of weight(u, p) × distance(s, p)</div>
<ul class="eq-legend">
<li><code>s</code> an empty grid slot next to a block already placed</li>
<li><code>weight(u, p)</code> the connectivity between the chosen block u and placed block p</li>
<li><code>distance(s, p)</code> the Manhattan distance from slot s to placed block p</li>
</ul>

The block is placed in the slot with the lowest added-wire cost.

A linear-ordering refinement improves the seed-and-grow behavior:
first compute a good one-dimensional order of all blocks (repeatedly
append the block with the most connections to the ordered prefix and
the fewest to the rest), then fold that order into rows on the die.

## The recipe

**Step 1 (seed).** Choose a seed, usually the highest-degree block or
one tied to fixed pins, and place it.

**Step 2 (score).** Compute each unplaced block's connectivity score,
its total connection to the placed set.

**Step 3 (attach).** Take the block with the highest connectivity
score and place it in the open adjacent slot with the lowest
added-wire cost.

**Step 4 (repeat).** Return to Step 2 until every block is placed.

## Watch it work: seed and grow

Nine blocks with weighted connections. The walkthrough picks the
seed by degree, then attaches blocks one at a time with the score
arithmetic shown at each step, and ends on the role the result plays
in a real flow.

<div class="walk-fig" data-walk="cluster-fp"></div>

## Pros, cons, and the trade-off

<div class="pros-cons">
<div class="pc-card pc-pros">
<h3>Strengths</h3>
<ul>
<li><strong>Linear and simple</strong>: one greedy pass, trivial to implement, fast on any block count.</li>
<li><strong>Legal from nothing</strong>: produces a complete, legal floorplan without a starting solution.</li>
<li><strong>Good starting point</strong>: an annealer seeded from a cluster-growth floorplan needs far less cooling than one seeded from a random scatter.</li>
</ul>
</div>
<div class="pc-card pc-cons">
<h3>Weaknesses</h3>
<ul>
<li><strong>Greedy and final</strong>: every choice is committed with no global view and no backtracking, so quality trails search-based methods on hard instances.</li>
<li><strong>Seed-sensitive</strong>: a poor seed or an early misplacement propagates through the rest of the growth.</li>
<li><strong>Shape-agnostic</strong>: the basic method treats blocks as slots and does not reason about differing block shapes.</li>
</ul>
</div>
</div>

<div class="tradeoff-box">
<h3>The trade-off</h3>
<p>Cluster growth trades solution quality for speed and simplicity. It cannot search or reconsider, so it will not find a strong floorplan on its own. What it does provide is a legal, connectivity-aware starting point in linear time, which is exactly what an iterative method needs before it begins. That role, not standalone quality, is why the method persists.</p>
</div>

## Is it actually used today?

The evidence for cluster growth is as a construction step and a
baseline, not as a standalone floorplanner.

- <strong>Initial construction</strong>: iterative floorplanners and
  placers use a greedy constructive pass to build the starting
  solution before search begins.
- <strong>Fast prototyping</strong>: quick-estimate modes that need a
  legal floorplan without the cost of search.
- <strong>Teaching and baselines</strong>: the standard first
  comparison point against which search-based floorplanners are
  measured.
""",
    },
    {
        "slug": "rectangular-dualization",
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "level": "research",
        "name": "Rectangular Dualization",
        "family": "constructive",
        "year": "1984",
        "who": "Kozminski and Kinnen",
        "chips": [
            ("diff-medium", "graph-theoretic"),
            ("diff-medium", "adjacency-driven"),
        ],
        "summary": (
            "Start from the desired adjacency graph (which blocks should "
            "touch which), and construct a floorplan that realizes it as "
            "a rectangular dissection, using planar graph theory."
        ),
        "lab": None,
        "refs": [
            ("Kozminski and Kinnen, 'An algorithm for finding a rectangular dual of a planar graph' (search)",
             "https://scholar.google.com/scholar?q=Kozminski+Kinnen+rectangular+dual+planar+graph"),
            ("Wikipedia: Floorplan theory and rectangular dissections",
             "https://en.wikipedia.org/wiki/Floorplan_(microelectronics)"),
        ],
        "body": """
## The idea

Most methods optimize wirelength and let adjacency fall where it may.
Rectangular dualization inverts the question. Suppose you already know
which blocks must be adjacent: heavy buses between them, shared power
domains, abutted datapaths. Represent that as a graph: one vertex per block, one edge per
required adjacency.

A *rectangular dual* of that graph is a dissection of the die into one
rectangle per block whose shared walls are exactly the graph's edges.
Two rectangles share a wall when, and only when, their blocks are
joined by an edge; no two rectangles touch otherwise.

Graph theory gives an exact test for when such a floorplan exists.
Treat the adjacency graph as a *planar triangulated graph*: planar,
with every internal face a triangle. It has a rectangular dual if and
only if it contains no *separating triangle*, a three-cycle with graph
vertices both inside and outside it. A separating triangle makes a
dual impossible, and its absence guarantees one can be built.

Kozminski and Kinnen gave the construction algorithm in 1984. Later
work added sizing: once the topology is fixed, choosing wall positions
so each block reaches its required area is a linear program.

## The recipe

**Step 1 (extract adjacency).** From the netlist and constraints,
build the adjacency graph: one node per block, one edge per required
adjacency.

**Step 2 (planarize and triangulate).** Reduce the graph to a planar
triangulated graph, the form the existence theorem applies to.

**Step 3 (check).** Test for a separating triangle. If one exists, no
rectangular dual exists and the adjacency requirement must be relaxed.

**Step 4 (construct).** Build the rectangular dual, one rectangle per
node, with a shared wall for every edge.

**Step 5 (size).** Solve a linear program for the wall positions so
every block reaches its target area, keeping all adjacencies fixed.

## Watch it work: graph to floorplan and back

A four-block adjacency graph, its rectangular dual, the check that
every edge is a shared wall, the separating-triangle case that has no
dual, and the area-sizing step.

<div class="walk-fig" data-walk="rectdual-fp"></div>

## Pros, cons, and the trade-off

<div class="pros-cons">
<div class="pc-card pc-pros">
<h3>Strengths</h3>
<ul>
<li><strong>Adjacency is exact</strong>: when the specification is which blocks must touch, the dual realizes it precisely, which no wirelength method guarantees.</li>
<li><strong>A decidable condition</strong>: the separating-triangle test says exactly whether a valid floorplan exists.</li>
<li><strong>Sizing is tractable</strong>: with the topology fixed, meeting target areas is a linear program.</li>
</ul>
</div>
<div class="pc-card pc-cons">
<h3>Weaknesses</h3>
<ul>
<li><strong>Needs a planar adjacency requirement</strong>: real netlists are neither planar nor triangulated, so a preprocessing step must extract one, and quality depends on that extraction.</li>
<li><strong>Adjacency, not wirelength</strong>: the method optimizes literal adjacency, while most designs care about total wirelength.</li>
<li><strong>Can be infeasible</strong>: a separating triangle means the requested adjacencies simply cannot all be met.</li>
</ul>
</div>
</div>

<div class="tradeoff-box">
<h3>The trade-off</h3>
<p>Rectangular dualization models adjacency exactly and models nothing else. When adjacency is the specification, it is the method that fits: it provides a clear feasibility test and tractable area sizing. When the specification is wirelength, the adjacency graph must first be derived from the netlist, and the quality of the result is bounded by the quality of that derivation.</p>
</div>

## Is it actually used today?

The evidence for rectangular dualization is in adjacency-driven
domains and in floorplan theory, not in mainstream wirelength-driven
flows.

- <strong>Analog and constraint-driven layout</strong>: floorplans
  with matching, symmetry, and abutment requirements, where adjacency
  is part of the specification.
- <strong>Related domains</strong>: some 3D-integration partitioning
  work and architectural floorplanning use rectangular duals.
- <strong>Floorplan theory</strong>: the duals reappear in mosaic
  floorplan enumeration, where counting floorplans is counting certain
  duals.
""",
    },
    # ----- slicing -----
    {
        "slug": "slicing-polish-annealing",
        "card": "Encode cuts as a Polish expression and let annealing reshape it.",
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "level": "foundational",
        "name": "Slicing Trees and Polish Expressions",
        "family": "slicing",
        "year": "1986",
        "who": "Wong and Liu",
        "chips": [
            ("diff-easy", "the classic"),
            ("diff-easy", "clean search space"),
            ("diff-medium", "slicing-only"),
        ],
        "summary": (
            "Represent a floorplan as recursive cuts encoded in a "
            "normalized Polish expression, and let simulated annealing "
            "perturb the expression. The single most taught floorplanning "
            "algorithm ever."
        ),
        "lab": None,
        "refs": [
            ("Wong and Liu, 'A new algorithm for floorplan design' (search)",
             "https://scholar.google.com/scholar?q=Wong+Liu+new+algorithm+floorplan+design+1986"),
            ("Wikipedia: Floorplan (microelectronics), slicing floorplans",
             "https://en.wikipedia.org/wiki/Floorplan_(microelectronics)"),
        ],
        "body": """
## The idea

A slicing floorplan is one that can be built by recursive guillotine
cuts: each cut runs straight across the whole current rectangle,
splitting it into two, and each piece is cut again. That recursion is
a binary tree: leaves are blocks, and every internal node is one cut,
horizontal (H, top and bottom) or vertical (V, left and right).

Write the tree in postorder, children before their node, and you get
a *Polish expression*: a string like `12H3V`, read "1 above 2, that
group beside 3". The string and the tree hold the same information,
but the string is a compact encoding a search can edit directly.

Wong and Liu's method runs simulated annealing on that string. Its
two structural properties keep the search clean:

- **Normalized**: no two identical cut operators appear in a row, so
  each normalized expression encodes exactly one floorplan with no
  redundant encodings of the same layout.
- **Balloting property**: every prefix of the string has more
  operands than operators, which is exactly the condition for the
  string to decode to a valid binary tree.

## The recipe

**Step 1 (encode).** Represent the current floorplan as a normalized
Polish expression.

**Step 2 (perturb).** Apply one of three moves, each designed to keep
the expression normalized and valid:

- **M1**: swap two adjacent operands (blocks).
- **M2**: invert a chain of cut operators (H becomes V and back).
- **M3**: swap an adjacent operand and operator, with a legality
  check that preserves normalization and the balloting property.

**Step 3 (evaluate).** Decode the expression to a floorplan in one
tree walk and compute its cost, area plus weighted wirelength.

**Step 4 (accept or reject).** Apply the simulated-annealing
acceptance rule, and repeat from Step 2 while cooling.

## Watch it work: floorplan, tree, expression

The running example through all three views: a slicing floorplan, its
slicing tree, the Polish expression as the tree's postorder, an
annealing move editing the string, the properties that keep it valid,
and the pinwheel that no slicing floorplan can produce.

<div class="walk-fig" data-walk="slicing-fp"></div>

## Pros, cons, and the trade-off

<div class="pros-cons">
<div class="pc-card pc-pros">
<h3>Strengths</h3>
<ul>
<li><strong>Compact, complete encoding</strong>: every normalized expression is one floorplan and every move stays valid, so the search space is closed under the moves.</li>
<li><strong>Cheap evaluation</strong>: decoding and cost are a single linear tree walk.</li>
<li><strong>Exact sizing and soft blocks</strong>: block areas and flexible aspect ratios are handled exactly inside the slicing structure (see the Stockmeyer page).</li>
</ul>
</div>
<div class="pc-card pc-cons">
<h3>Weaknesses</h3>
<ul>
<li><strong>Not every packing is slicing</strong>: the pinwheel and other arrangements cannot be produced by guillotine cuts, so the space excludes some optimal packings.</li>
<li><strong>Density gap</strong>: on hard-block problems that need those non-slicing packings, slicing solutions can trail in area.</li>
<li><strong>Annealing cost</strong>: many moves and a cooling schedule, with the usual tuning.</li>
</ul>
</div>
</div>

<div class="tradeoff-box">
<h3>The trade-off</h3>
<p>Slicing restricts the floorplan space to what guillotine cuts can produce. That restriction excludes some optimal packings, but it buys a compact and complete encoding, cheap evaluation, exact sizing, and clean handling of soft blocks. For problems dominated by soft macros, where area planning matters more than the last percent of packing density, slicing solutions are provably close to optimal, which is why the method remained competitive after non-slicing representations arrived.</p>
</div>

## Is it actually used today?

The evidence for slicing and Polish expressions is in teaching,
hierarchical planning, and soft-macro area planning.

- <strong>Teaching</strong>: the standard first floorplanning
  algorithm in physical-design courses, for its clean encoding and
  moves.
- <strong>Hierarchical planning</strong>: the top levels of many
  hierarchical planners, where the block count is small and slicing
  structure is natural.
- <strong>Soft-macro area planning</strong>: problems where flexible
  block shapes and area budgets matter more than dense hard-block
  packing.
""",
    },
    {
        "slug": "stockmeyer",
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "level": "research",
        "name": "Stockmeyer's Shape-Curve Algorithm",
        "family": "slicing",
        "year": "1983",
        "who": "Stockmeyer",
        "chips": [
            ("diff-easy", "provably optimal"),
            ("diff-easy", "polynomial time"),
        ],
        "summary": (
            "Given a slicing tree, choose every block's orientation (and "
            "shape, for soft blocks) to minimize total area, exactly, in "
            "polynomial time, by merging shape curves up the tree."
        ),
        "lab": None,
        "refs": [
            ("Stockmeyer, 'Optimal orientations of cells in slicing floorplan designs' (search)",
             "https://scholar.google.com/scholar?q=Stockmeyer+optimal+orientations+slicing+floorplan+1983"),
        ],
        "body": """
## The idea

Fix the slicing topology and ask a narrower question: each hard block
can be placed as W x H or rotated to H x W, so which combination of
orientations minimizes the chip's bounding box? There are 2 to the
power of the block count combinations, but Stockmeyer showed the
optimum is computable exactly in polynomial time.

The tool is the *shape curve*: for each subtree, the set of
non-dominated (width, height) pairs it can realize, kept as a
staircase sorted by width. A leaf's curve has at most two points, one
per orientation. An internal node's curve is built by combining its children's, point
by point. Take one point (w1, h1) from one child curve and (w2, h2)
from the other; the combined dimensions depend only on the cut
direction:

| cut | combined width | combined height |
|-----|:---:|:---:|
| V (subtrees side by side) | w1 + w2 | max(h1, h2) |
| H (subtrees stacked) | max(w1, w2) | h1 + h2 |

The two rules are the same relation with width and height exchanged: a
vertical cut adds the widths and lets the taller subtree set the
height, and a horizontal cut does the reverse.

The combined points are computed over all pairs of child points, and
dominated points (some other point is no wider and no taller) are
discarded, so each node's curve stays a short staircase. Merging two
staircases is linear in their size. At the root, pick the point of
least area and walk back down the tree, reading off which child
choices produced it.

## The recipe

**Step 1 (leaf curves).** Give each block a shape curve: its
orientations as (width, height) points.

**Step 2 (merge up).** At each internal node, combine the two child
curves with the V or H rule above, over all pairs of points, and drop
dominated points. Propagate to the root.

**Step 3 (pick).** At the root curve, choose the point of least area
(or the best point that fits the target die).

**Step 4 (trace back).** Walk down the tree, and at each node read off
which child options produced the chosen point, giving every block's
orientation.

## Watch it work: merging shape curves

Two rotatable blocks combined at a vertical cut. The walkthrough plots
each block's shape curve, merges them by the V rule (width adds,
height takes the maximum), discards the dominated point, forms the
staircase, and traces the minimum-area point back to the block
orientations that achieve it.

<div class="walk-fig" data-walk="stockmeyer-fp"></div>

## Pros, cons, and the trade-off

<div class="pros-cons">
<div class="pc-card pc-pros">
<h3>Strengths</h3>
<ul>
<li><strong>Exact and polynomial</strong>: the optimal orientation and sizing, with no heuristic and no tuning, from a linear-time merge per node.</li>
<li><strong>Handles soft blocks</strong>: a soft block's curve is a piecewise hyperbola sampled into a staircase, so flexible aspect ratios are sized exactly too.</li>
<li><strong>Composes with search</strong>: an annealer explores topologies while this merge sizes each candidate optimally.</li>
</ul>
</div>
<div class="pc-card pc-cons">
<h3>Weaknesses</h3>
<ul>
<li><strong>Slicing only</strong>: the dynamic program depends on the binary, single-cut structure of a slicing tree.</li>
<li><strong>Sizing, not placement</strong>: it chooses orientations for a fixed topology; it does not decide the topology itself.</li>
<li><strong>Staircase growth</strong>: soft-block curves sampled finely make the staircases longer, trading accuracy for merge cost.</li>
</ul>
</div>
</div>

<div class="tradeoff-box">
<h3>The trade-off</h3>
<p>Stockmeyer's algorithm is one of the few physical-design problems that is simply solved: given a slicing topology, the optimal orientation and sizing follow exactly in polynomial time. The condition is the whole point. For non-slicing floorplans the same orientation problem is NP-hard, so the guillotine structure is not just convenient, it is what makes the dynamic program compose at all.</p>
</div>

## Is it actually used today?

The evidence for Stockmeyer's algorithm is inside slicing-based
floorplanning and in teaching.

- <strong>Slicing floorplanners</strong>: the sizing engine inside
  every slicing-based floorplanner, run for each candidate topology
  the search proposes.
- <strong>Soft-macro area estimation</strong>: fast, exact area and
  aspect-ratio estimates for flexible blocks.
- <strong>Teaching</strong>: the canonical example of dynamic
  programming on trees in physical design.
""",
    },
    # ----- representations -----
    {
        "slug": "sequence-pair",
        "card": "Two orderings of the blocks encode every left-of and below relation.",
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "level": "research",
        "name": "Sequence Pair",
        "family": "representations",
        "year": "1995",
        "who": "Murata, Fujiyoshi, Nakatake, Kajitani",
        "chips": [
            ("diff-easy", "fully general"),
            ("diff-medium", "O(n²) naive decode"),
        ],
        "summary": (
            "Two permutations of the block names encode, for every pair "
            "of blocks, whether one is left of or below the other. The "
            "first practical encoding of arbitrary (non-slicing) "
            "floorplans, and still the most cited."
        ),
        "lab": None,
        "refs": [
            ("Murata et al., 'VLSI module placement based on rectangle-packing by the sequence-pair' (search)",
             "https://scholar.google.com/scholar?q=Murata+sequence-pair+rectangle+packing+VLSI"),
            ("Fast sequence-pair evaluation via longest common subsequence, Tang-Wong (search)",
             "https://scholar.google.com/scholar?q=Tang+Wong+FAST-SP+sequence+pair+longest+common+subsequence"),
        ],
        "body": """
## The idea

Write the block names down twice, in two different orders: a pair of
permutations (P+, P-). That pair, with no coordinates at all, encodes
the relative position of every pair of blocks, through one rule
comparing how the two blocks are ordered in the two sequences:

| order of a and b | relation |
|---|---|
| a before b in both P+ and P- | a is to the left of b |
| a before b in P+, after b in P- | a is above b |

(The other two cases are the mirror images: b left of a, or b above
a.) Every pair of blocks gets exactly one horizontal or vertical
relation, so a sequence pair fixes a complete arrangement, a floorplan
topology with no geometry yet.

Decoding turns those relations into coordinates. The left-of
relations form a horizontal constraint graph and the above relations a
vertical one; the longest path to each block gives its x and y, and
the longest overall paths give the chip's width and height. Naively
that is quadratic per evaluation. The FAST-SP refinement computes it
in O(n log log n) time by way of a longest common subsequence, which
made sequence pairs fast enough for serious annealing.

## The recipe

**Step 1 (encode).** Represent the arrangement as a sequence pair
(P+, P-).

**Step 2 (relate).** For every pair of blocks, apply the rule above to
get one left-of or above relation.

**Step 3 (build graphs).** Collect the left-of relations into a
horizontal constraint graph and the above relations into a vertical
one.

**Step 4 (pack).** Longest paths in the two graphs give every block's
coordinates, an overlap-free packing, plus the chip dimensions.

**Step 5 (perturb).** For annealing, swap two names in one sequence,
in both, or rotate a block, then decode and evaluate.

## Watch it work: two orderings become a floorplan

Four blocks and a sequence pair. The walkthrough states the rule with
a worked case, derives every pairwise relation, packs the relations
into coordinates by longest path, shows the resulting floorplan, and
ends on a move.

<div class="walk-fig" data-walk="seqpair-fp"></div>

## Pros, cons, and the trade-off

<div class="pros-cons">
<div class="pc-card pc-pros">
<h3>Strengths</h3>
<ul>
<li><strong>Complete</strong>: every arrangement of blocks, slicing or not, has a sequence pair, so non-slicing packings like the pinwheel are representable.</li>
<li><strong>Sound</strong>: every pair decodes to a legal, overlap-free packing.</li>
<li><strong>Ergonomic</strong>: moves are simple name swaps, and fixed-block, abutment, and symmetry constraints map to restrictions on the sequences.</li>
</ul>
</div>
<div class="pc-card pc-cons">
<h3>Weaknesses</h3>
<ul>
<li><strong>Redundant search space</strong>: (n!) squared encodings, far more than the number of distinct packings, so annealing revisits many encodings of the same floorplan.</li>
<li><strong>Decode cost</strong>: the naive longest-path decode is quadratic; fast decoding (FAST-SP) is needed for large instances.</li>
<li><strong>Encoding, not an optimizer</strong>: it represents floorplans; a separate search chooses among them.</li>
</ul>
</div>
</div>

<div class="tradeoff-box">
<h3>The trade-off</h3>
<p>Sequence pairs trade a large, redundant search space for completeness and simplicity. Unlike slicing trees, they can represent any packing, and their moves and constraint handling are straightforward, which is why they became the default representation for two decades. The price is that (n!) squared encodings collapse onto far fewer distinct floorplans, so the search wanders, and fast decoding is required to make each step cheap.</p>
</div>

## Is it actually used today?

The evidence for sequence pairs is broad: macro placement, analog
layout, and as the standard research baseline.

- <strong>Macro placement</strong>: a common representation in macro
  placers and floorplanners, research and industrial.
- <strong>Analog layout</strong>: symmetry and matching constraints
  map to restrictions on the sequences, which suits analog placement.
- <strong>Baseline</strong>: the representation every new floorplan
  encoding is compared against, and a standard teaching example of
  non-slicing floorplanning.
""",
    },
    {
        "slug": "bounded-sliceline-grid",
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "level": "research",
        "name": "Bounded-Sliceline Grid",
        "family": "representations",
        "year": "1996",
        "who": "Nakatake, Fujiyoshi, Murata, Kajitani",
        "chips": [
            ("diff-medium", "grid-based"),
            ("diff-medium", "meta-grid states"),
        ],
        "summary": (
            "Place blocks into cells of an abstract n-by-n grid of "
            "'slicelines'; relative order between grid cells defines the "
            "geometry. From the same lab as the sequence pair, one year "
            "later."
        ),
        "lab": None,
        "refs": [
            ("Nakatake et al., 'Module placement on BSG-structure and IC layout applications' (search)",
             "https://scholar.google.com/scholar?q=Nakatake+bounded+sliceline+grid+BSG+module+placement"),
        ],
        "body": """
## The idea

The Bounded-Sliceline Grid (BSG) abstracts the die into an n-by-n grid
of *rooms* separated by horizontal and vertical sliceline segments,
and assigns the n blocks to distinct rooms, leaving the rest empty.
Room adjacency defines the relations: a block whose room is west of
another's is to the left of it, and a block whose room is north of
another's is above it.

Decoding runs longest-path on the induced horizontal and vertical
constraint graphs to produce coordinates, the same packing step used
for the sequence pair. Unlike a literal grid, the slicelines are
elastic: each room stretches to fit its block and empty rooms collapse,
so the grid encodes topology and the packing supplies geometry.

## The recipe

**Step 1 (assign).** Place the n blocks into n distinct rooms of an
n-by-n grid, leaving the rest empty.

**Step 2 (relate).** Read a left-of relation from each west-east room
adjacency and an above relation from each north-south adjacency.

**Step 3 (pack).** Longest paths on the horizontal and vertical
constraint graphs give each block's coordinates; elastic rooms stretch
to fit and empty rooms collapse.

**Step 4 (perturb).** For annealing, swap two blocks' rooms, move a
block to an empty room, or rotate a block. Only local relations change,
which the incremental evaluator exploits.

## Watch it work: rooms to floorplan

Four blocks in a 3-by-3 room grid. The walkthrough assigns blocks to
rooms, reads the relations off the grid, packs them into a floorplan
by longest path, and shows a room-swap move re-decoding to a new
layout.

<div class="walk-fig" data-walk="bsg-fp"></div>

## Pros, cons, and the trade-off

<div class="pros-cons">
<div class="pc-card pc-pros">
<h3>Strengths</h3>
<ul>
<li><strong>Complete</strong>: with a large enough grid, every packing is representable.</li>
<li><strong>Local moves</strong>: a room operation changes only a few relations, so incremental re-evaluation is cheap.</li>
<li><strong>Explicit rooms</strong>: the room structure makes symmetry and matching constraints easy to state, which suits analog placement.</li>
</ul>
</div>
<div class="pc-card pc-cons">
<h3>Weaknesses</h3>
<ul>
<li><strong>Emptiness</strong>: an n-by-n grid has n squared rooms for n blocks, so the state carries a large amount of empty space.</li>
<li><strong>Grid size is a knob</strong>: too small excludes solutions, too large bloats the search space.</li>
<li><strong>Overshadowed</strong>: the sequence pair, from the same lab a year earlier, encodes the same generality with no empty rooms.</li>
</ul>
</div>
</div>

<div class="tradeoff-box">
<h3>The trade-off</h3>
<p>The BSG (Bounded-Sliceline Grid) trades a larger, sparser state for local moves and an explicit room structure. The room viewpoint makes constraints easy to express and each move cheap to evaluate, but the n-by-n grid for n blocks carries much emptiness, and its size must be tuned. Against its sibling the sequence pair, which represents the same set of packings with no empty rooms, that overhead is why it saw less adoption.</p>
</div>

## Is it actually used today?

The evidence for the BSG (Bounded-Sliceline Grid) is mostly in the
literature and in constraint-driven placement.

- <strong>Literature</strong>: one pole of the representation-design
  space, and a standard comparison point in floorplan-representation
  studies.
- <strong>Constraint-driven placement</strong>: the room and relation
  viewpoint resurfaces where explicit rooms make constraints natural.
- <strong>Analog floorplanning</strong>: some analog placers use
  room-based structures because symmetry and matching constraints are
  easy to state on rooms.
""",
    },
    {
        "slug": "o-tree",
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "level": "research",
        "name": "O-Tree",
        "family": "representations",
        "year": "1999",
        "who": "Guo, Cheng, Otten",
        "chips": [
            ("diff-easy", "tiny encoding"),
            ("diff-easy", "linear decode"),
            ("diff-medium", "compacted floorplans only"),
        ],
        "summary": (
            "An ordered tree encodes left-edge abutment: each block leans "
            "against its parent, and a depth-first traversal with a "
            "contour structure decodes the packing in linear time."
        ),
        "lab": None,
        "refs": [
            ("Guo, Cheng, Otten, 'An O-tree representation of non-slicing floorplan' (search)",
             "https://scholar.google.com/scholar?q=Guo+Cheng+Otten+O-tree+non-slicing+floorplan"),
            ("An O-tree overview (IJAREEIE)", "https://www.ijareeie.com/upload/april/39_O%20Tree.pdf"),
        ],
        "body": """
## The idea

Restrict attention to *admissible* packings: those where no block can
slide further left or down. Every good final floorplan is admissible,
because slack on the left or bottom is wasted area. In such a packing,
every block's left edge leans on something: another block's right
edge, or the die wall. That leaning relation is a tree, the die wall
is the root, and each block's parent is the block it abuts on the
left.

The O-tree records exactly this ordered tree. Its shape encodes in 2n
bits as a bracket sequence (descend to a child = open, ascend = close),
plus the block permutation in traversal order:

<div class="eq">O-tree size = 2n (tree shape) + n log n (permutation) = n(2 + log n) bits</div>
<ul class="eq-legend">
<li><code>2n</code> the tree shape, one open and one close bracket per block</li>
<li><code>n log n</code> the permutation of block names, log n bits each</li>
<li>this is the smallest encoding of any classic floorplan representation</li>
</ul>

Decoding walks the tree depth-first. A block's x-coordinate is its
parent's right edge; its y-coordinate is found by pushing it down onto
the *contour*, the skyline of everything placed so far. The contour is
maintained so each placement costs amortized constant time, making the
whole decode linear. Moves are tree surgeries: delete a subtree and
reinsert it elsewhere.

## The recipe

**Step 1 (encode).** Record the left-edge leaning tree as a bracket
sequence plus a block permutation.

**Step 2 (traverse).** Walk the tree depth-first in the permutation
order.

**Step 3 (place).** Set each block's x to its parent's right edge, and
its y to the contour height over its width, then update the contour.

**Step 4 (perturb).** For annealing, delete a subtree and reinsert it
elsewhere, alternating horizontal and vertical tree views.

## Watch it work: leaning tree and contour decode

Four blocks in an admissible packing. The walkthrough shows the
left-edge leaning that defines the tree, the tree and its bracket
encoding, and the depth-first decode that pushes each block down onto
the contour.

<div class="walk-fig" data-walk="otree-fp"></div>

**Why go through the tree at all?** The point is not to draw one
floorplan. A floorplanner searches over millions of candidate
arrangements, and it needs each candidate to be cheap to store, cheap
to change, and legal by construction. The O-tree is built for exactly
that:

- <strong>The tree is the small thing you search over, not the
  packing.</strong> The annealer never stores or edits x,y
  coordinates. It edits the tree, which is just the horizontal
  "who-leans-on-whom" order in a handful of bits. One move is "detach a
  subtree and reattach it under a different parent," meaning "make this
  block lean on a different block."
- <strong>The packing is regenerated, never kept.</strong> The tree
  records only horizontal order. Vertical position is thrown away and
  recomputed at decode time by dropping each block down onto the
  contour (the skyline of what is already placed). So the expensive
  part, the actual coordinates, is derived on demand from the cheap
  part.
- <strong>Every decode is already legal.</strong> Because x comes from
  the parent's right edge and y comes from resting on the contour, no
  two blocks can overlap and no gaps are left on the left or bottom.
  There is no separate legalization or overlap-removal pass, and the
  whole decode is linear time.

That is the payoff of the round trip: mutate a tiny tree, decode a
guaranteed-legal packed floorplan in linear time, score it, keep or
reject, repeat. The tree carries the state; the contour rebuilds the
geometry.

## Pros, cons, and the trade-off

<div class="pros-cons">
<div class="pc-card pc-pros">
<h3>Strengths</h3>
<ul>
<li><strong>Smallest encoding</strong>: n(2 + log n) bits, less than any other classic representation.</li>
<li><strong>Linear decode</strong>: the contour makes each placement amortized constant time.</li>
<li><strong>Packed search space</strong>: it represents only admissible (compacted) floorplans, so every state is a candidate a designer would accept for area.</li>
</ul>
</div>
<div class="pc-card pc-cons">
<h3>Weaknesses</h3>
<ul>
<li><strong>Compacted only</strong>: it cannot express floorplans that need slack, such as whitespace targets or fixed pin positions.</li>
<li><strong>Asymmetric</strong>: the tree captures horizontal abutment directly while vertical positions emerge from the contour, an asymmetry its successor removed.</li>
<li><strong>Tree-surgery moves</strong>: deleting and reinserting subtrees is more involved than a name swap.</li>
</ul>
</div>
</div>

<div class="tradeoff-box">
<h3>The trade-off</h3>
<p>The O-tree trades expressiveness for efficiency. By representing only admissible packings it gets the smallest encoding and a linear decode, and every state is already compacted. The cost is that it cannot describe floorplans with deliberate slack, and its horizontal-vertical asymmetry makes some moves awkward, both of which its direct descendant, the B*-tree, set out to fix.</p>
</div>

## Is it actually used today?

The evidence for the O-tree is chiefly through its descendant and in
the literature.

- <strong>Through the B*-tree</strong>: the B*-tree took the O-tree's
  compacted-packing philosophy, bound it to a binary tree, and became
  the representation of choice for a generation of packers. Read that
  page next.
- <strong>Literature</strong>: a standard reference point in
  floorplan-representation studies, cited for its minimal encoding and
  linear decode.
""",
    },
    {
        "slug": "b-star-tree",
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "level": "research",
        "name": "B*-Tree",
        "family": "representations",
        "year": "2000",
        "who": "Chang, Chang, Wu, Wu",
        "chips": [
            ("diff-easy", "linear decode"),
            ("diff-easy", "the standard packer"),
            ("diff-medium", "compacted floorplans only"),
        ],
        "summary": (
            "A binary tree where left child means 'adjacent to my right' "
            "and right child means 'above me, same x'. Decodes by "
            "preorder traversal against a contour. The practical favorite "
            "for hard-block packing ever since."
        ),
        "lab": None,
        "refs": [
            ("Chang et al., 'B*-trees: a new representation for non-slicing floorplans' (DAC 2000)",
             "https://www.researchgate.net/publication/3854652_B-Trees_a_new_representation_for_non-slicing_floorplans"),
        ],
        "body": """
## The idea

The B*-tree is the O-tree's successor. It keeps the same world of
compacted, pushed-to-the-lower-left packings, but records it as an
ordered *binary* tree. That change removes the O-tree's awkward
asymmetry, where horizontal order lived in the tree and vertical order
had to be recovered separately. Here both directions fall out of two
crisp child rules.

Every node is a block, and the root is the block in the bottom-left
corner. The two children mean different geometric things:

<table>
<thead><tr><th>relation</th><th>meaning in the packing</th><th>gives the child's</th></tr></thead>
<tbody>
<tr><td><strong>left child</strong></td><td>the block immediately to the parent's right</td><td>x = parent's right edge</td></tr>
<tr><td><strong>right child</strong></td><td>the block above the parent at the same x</td><td>x = parent's x</td></tr>
</tbody>
</table>

So the tree fixes every block's x-coordinate outright. The y-coordinate
is the one thing left to compute, and it comes from dropping the block
onto the contour (the skyline of everything placed so far, the same
structure introduced on the O-tree page). Every compacted packing maps
to exactly one B*-tree and every B*-tree decodes to exactly one packing:
a clean bijection with no wasted encodings.

## The recipe

**Step 1 (root).** Put the bottom-left block at the origin, x = 0, y = 0.

**Step 2 (traverse).** Visit the tree in preorder: node, then left
subtree, then right subtree.

**Step 3 (place x).** A left child takes its parent's right edge as its
x. A right child keeps its parent's x.

**Step 4 (place y).** Drop the block onto the contour over its width,
then update the contour. Maintaining it as a doubly linked list makes
each placement amortized constant time, so the whole decode is linear.

**Step 5 (perturb).** For annealing, use three tree moves: rotate a
block (swap width and height), move a node to another position, or swap
two nodes. Each is a constant-time surgery followed by a re-decode.

## Watch it work: two child rules and a contour decode

Five blocks. The walkthrough reads the two child rules off the packing,
draws the packing and its binary tree side by side, then decodes the
tree in preorder, taking each x from the child rule and each y from the
contour.

<div class="walk-fig" data-walk="bstar-fp"></div>

**How it improves on the O-tree.** The two representations cover the
same space of compacted packings and both decode in linear time, so
the gain is not asymptotic, and the B*-tree is not the shorter or more
balanced tree. In fact it can be taller: the O-tree is a general tree
where a column of blocks sharing an x-coordinate is one node with many
siblings, and the B*-tree turns those siblings into a long right-going
chain. Height does not matter either way, since the decode visits each
node once against the contour and never walks a path from the root.
The real advantages are structural:

- <strong>Fixed branching.</strong> A binary tree has at most two
  children per node, always. The O-tree's variable arity needs a
  variable bracket sequence plus a permutation and more bookkeeping in
  its moves. A binary tree is a simpler, more regular structure to
  store and mutate.
- <strong>Both axes are first-class pointers.</strong> This is where
  the O-tree's asymmetry is removed. The O-tree makes horizontal order
  explicit as parent-child links but leaves vertical order implicit in
  the sibling ordering. The B*-tree assigns one pointer to each axis:
  the left child is the x-relation (the block to the right), the right
  child is the y-relation (the block stacked above at the same x).
- <strong>Simpler, faster moves.</strong> Rotate, move, and swap are
  plain binary-tree surgeries. There is no sibling-list splicing, no
  bracket-sequence to re-normalize, and no wall or dummy node to
  special-case, because the B*-tree's root is a real block.

**Why the binary tree helps.** The tree is the small object the
annealer searches over: a few pointers, mutated by three simple moves.
The geometry is regenerated on demand, and because the encoding is a
bijection onto compacted packings, the search space is exactly the set
of legal floorplans, far smaller than the sequence pair's (n!)² pairs.
Every decode is legal by construction and runs in linear time, so the
annealer can afford to try enormous numbers of candidates.

## Pros, cons, and the trade-off

<div class="pros-cons">
<div class="pc-card pc-pros">
<h3>Strengths</h3>
<ul>
<li><strong>Both axes from the tree</strong>: x from the child rule, y from the contour, with none of the O-tree's asymmetry.</li>
<li><strong>Simple moves</strong>: rotate, move, swap are all constant-time tree surgeries, ideal for annealing.</li>
<li><strong>Tight bijection</strong>: the search space is exactly the compacted packings, much smaller than the sequence pair's.</li>
<li><strong>Extends well</strong>: published variants handle fixed outlines, soft blocks, rectilinear blocks, 3D stacks, and analog symmetry.</li>
</ul>
</div>
<div class="pc-card pc-cons">
<h3>Weaknesses</h3>
<ul>
<li><strong>Compacted only</strong>: like the O-tree it cannot express floorplans that need deliberate slack or fixed absolute positions.</li>
<li><strong>Fixed-outline is a bolt-on</strong>: hitting a target aspect ratio needs extra work, since the raw representation only minimizes area.</li>
<li><strong>Local moves</strong>: tree surgeries make small geometric changes, so escaping a bad basin can take many moves.</li>
</ul>
</div>
</div>

<div class="tradeoff-box">
<h3>The trade-off</h3>
<p>The B*-tree trades the sequence pair's expressiveness for a much smaller, always-legal search space. By representing only compacted packings it gets both coordinates from one binary tree, constant-time moves, and a linear decode, which is why it became the default engine for area-driven annealing. The price is that it cannot describe floorplans with intentional whitespace or fixed positions, and meeting a fixed outline needs added structure rather than falling out for free.</p>
</div>

## Is it actually used today?

The B*-tree is the most widely built non-slicing floorplan
representation in the research literature.

- <strong>Academic macro floorplanners</strong>: it is the default
  representation for area-driven simulated-annealing packers and the
  baseline that new representations are measured against.
- <strong>Analog and mixed-signal placement</strong>: symmetry-island
  and constraint-aware B*-tree variants are a common backbone for
  analog device placement research.
- <strong>A family, not one algorithm</strong>: published extensions
  cover fixed outlines, soft and rectilinear blocks, bus-driven
  placement, and 3D stacking, so the same core encoding reappears
  across many problems.
- <strong>Note on production tools</strong>: commercial floorplanners
  do not publish their internal representations, so their use of a
  B*-tree specifically is not verifiable. The open-source and academic
  evidence above is what is confirmable.
""",
    },
    {
        "slug": "corner-block-list",
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "level": "research",
        "name": "Corner Block List",
        "family": "representations",
        "year": "2000",
        "who": "Hong, Huang, Cai, Gu, Dong, Cheng, Gu",
        "chips": [
            ("diff-easy", "linear decode"),
            ("diff-medium", "mosaic floorplans"),
        ],
        "summary": (
            "Describe a mosaic floorplan by repeatedly deleting the "
            "top-right corner block and recording how it was attached: "
            "orientation bit, insertion list, junction count."
        ),
        "lab": None,
        "refs": [
            ("Hong et al., 'Corner block list: an effective and efficient topological representation of non-slicing floorplan' (search)",
             "https://scholar.google.com/scholar?q=Hong+corner+block+list+non-slicing+floorplan+ICCAD+2000"),
        ],
        "body": """
## The idea

The corner block list describes a *mosaic* floorplan: a dissection of
the die into exactly n rooms, one block per room, with no empty space
and every internal junction a T rather than a crossing. Its reason to
exist is that mosaic floorplans include *non-slicing* ones, layouts no
sequence of straight cuts can produce, which slicing trees cannot
represent at all.

The encoding comes from a demolition. Repeatedly delete the block in
the *top-right corner*. Each corner block is attached in one of two
ways, and each deletion records three things:

<table>
<thead><tr><th>list</th><th>records</th></tr></thead>
<tbody>
<tr><td><strong>S</strong></td><td>the block names, in the order they are inserted (reverse of deletion)</td></tr>
<tr><td><strong>L</strong></td><td>each block's orientation: H if it spans the top, V if it spans the right</td></tr>
<tr><td><strong>T</strong></td><td>how many T-junctions the block's inner edge covers</td></tr>
</tbody>
</table>

Replaying the three lists in order rebuilds the floorplan exactly, and
both the demolition and the rebuild run in linear time. A T-count above
zero is precisely where non-slicing structure appears: a block whose
edge straddles more than one neighbor.

One structural difference from the O-tree and B*-tree is worth naming.
Those decode a *compacted packing* whose geometry depends on the block
sizes. A corner block list fixes the *room structure* independent of
sizes: the blocks are poured into the rooms afterward. That makes it
natural for soft blocks and for keeping a topology fixed while
dimensions change.

## The recipe

**Step 1 (find the corner).** Take the block in the top-right corner of
the current floorplan.

**Step 2 (record).** Append its name to S, its orientation (H for top,
V for right) to L, and the number of T-junctions its inner edge covers
to T.

**Step 3 (delete).** Remove it, letting the covered neighbors expand
into the freed space, and repeat from Step 1 until one block remains.

**Step 4 (decode).** To rebuild, start from the base block and insert
the rest in order: an H block enters along the top covering its T
top-boundary junctions, a V block enters along the right covering its T
right-boundary junctions.

## Watch it work: the pinwheel, encoded and rebuilt

The five-room pinwheel is the canonical non-slicing floorplan. The
walkthrough names its corner block, lays out the three lists, then
decodes them insertion by insertion, showing the T-junction each block
covers as it enters.

<div class="walk-fig" data-walk="cbl-fp"></div>

## Pros, cons, and the trade-off

<div class="pros-cons">
<div class="pc-card pc-pros">
<h3>Strengths</h3>
<ul>
<li><strong>Non-slicing native</strong>: it represents mosaic floorplans, including the non-slicing ones slicing trees cannot express.</li>
<li><strong>Size-independent topology</strong>: it fixes the room structure, not a packing, so blocks can be resized without changing the representation.</li>
<li><strong>Linear encode and decode</strong>: both the corner-block demolition and the insertion rebuild are linear time.</li>
<li><strong>Clean combinatorics</strong>: mosaic floorplans are counted by the Baxter numbers, and corner-block-style encodings are how those bijections are proved.</li>
</ul>
</div>
<div class="pc-card pc-cons">
<h3>Weaknesses</h3>
<ul>
<li><strong>Empty space needs dummies</strong>: a mosaic room cannot be vacant, so whitespace must be modeled as explicit dummy blocks.</li>
<li><strong>Redundancy</strong>: several corner block lists can map to the same floorplan unless extra rules are imposed, which its successors tightened.</li>
<li><strong>Two-part decode</strong>: fixing rooms first and sizing after is an extra step compared to the packing-native trees.</li>
</ul>
</div>
</div>

<div class="tradeoff-box">
<h3>The trade-off</h3>
<p>The corner block list trades the packing trees' directness for reach and flexibility. It captures non-slicing mosaic floorplans and keeps the topology independent of block sizes, at the cost of modeling empty space with dummy blocks and tolerating some encoding redundancy. Where the O-tree and B*-tree hand you a finished packing, the corner block list hands you a room structure to be sized, which is the right currency for soft blocks and combinatorial enumeration.</p>
</div>

## Is it actually used today?

The corner block list is chiefly a research and theory representation,
and the ancestor of a family of mosaic encodings.

- <strong>Mosaic and soft-block floorplanning</strong>: it is a
  reference representation for non-slicing floorplans where topology
  should survive resizing.
- <strong>Enumeration theory</strong>: it appears in the combinatorial
  literature on counting floorplans, tied to the Baxter numbers.
- <strong>A family, refined by successors</strong>: twin binary
  sequences and later mosaic encodings tightened its dummy-block and
  redundancy weaknesses, so its ideas persist through descendants more
  than through direct use.
- <strong>Note on production tools</strong>: commercial floorplanners
  do not publish their internal representations, so any specific use of
  a corner block list there is not verifiable. The evidence above is
  the academic record.
""",
    },
    {
        "slug": "transitive-closure-graph",
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "level": "research",
        "name": "Transitive Closure Graph",
        "family": "representations",
        "year": "2001",
        "who": "Lin and Chang",
        "chips": [
            ("diff-easy", "fully general"),
            ("diff-medium", "richer move effects"),
        ],
        "summary": (
            "Keep the horizontal and vertical constraint graphs "
            "themselves, transitively closed, as the representation; "
            "moves edit the graphs directly with geometric meaning."
        ),
        "lab": None,
        "refs": [
            ("Lin and Chang, 'TCG: a transitive closure graph-based representation for non-slicing floorplans' (search)",
             "https://scholar.google.com/scholar?q=Lin+Chang+TCG+transitive+closure+graph+floorplan+DAC+2001"),
            ("TCG-S (Transitive Closure Graph with Sequence) extension (search)",
             "https://scholar.google.com/scholar?q=Lin+Chang+TCG-S+orthogonal+coupling"),
        ],
        "body": """
## The idea

Every representation on these pages eventually produces two constraint
graphs: a horizontal one saying "block a is left of block b" and a
vertical one saying "a is below b". The transitive closure graph skips
the encoding and *keeps the graphs themselves* as the representation.

For every pair of blocks it stores exactly one relation, left-of or
below, as a directed edge in one of two graphs:

<table>
<thead><tr><th>graph</th><th>edge i to j means</th></tr></thead>
<tbody>
<tr><td><strong>Ch</strong> (horizontal)</td><td>block i is left of block j</td></tr>
<tr><td><strong>Cv</strong> (vertical)</td><td>block i is below block j</td></tr>
</tbody>
</table>

Both graphs are kept *transitively closed*: if a is left of b and b is
left of c, the edge a to c is materialized too. Because every pair sits
in exactly one graph, the two graphs together fix the relative position
of everything, with no coordinates stored.

Decoding is a longest-path pass. Weight each Ch node by its block width
and the longest path to a node is its x-coordinate; do the same on Cv
with heights for y. The longest path overall gives the chip width and
height. It is the same packing step the sequence pair uses, run
directly on the stored graphs.

## The recipe

**Step 1 (relations).** For each pair of blocks, record one edge: left-of
in Ch or below in Cv.

**Step 2 (close).** Add every edge implied by transitivity, so both
graphs are transitively closed and acyclic.

**Step 3 (pack x).** Longest path on Ch weighted by widths gives every
x-coordinate.

**Step 4 (pack y).** Longest path on Cv weighted by heights gives every
y-coordinate.

**Step 5 (perturb).** For annealing, edit the graphs directly: reverse
an edge (make b left of a), move a relation between the graphs (turn
left-of into below), rotate a block, or swap two vertices. Restore the
closure locally and the graphs stay acyclic, so the result is always
feasible.

## Watch it work: two graphs and a longest-path pack

Four blocks. The walkthrough reads the left-of and below relations off
the placement, builds the horizontal graph Ch and the vertical graph
Cv (marking the edge that transitive closure adds), then packs by
longest path on each graph to recover the coordinates.

<div class="walk-fig" data-walk="tcg-fp"></div>

## Pros, cons, and the trade-off

<div class="pros-cons">
<div class="pc-card pc-pros">
<h3>Strengths</h3>
<ul>
<li><strong>Relations are explicit</strong>: the geometry is readable straight off the graphs, no decoding from permutations.</li>
<li><strong>Constraints are just edges</strong>: abutment, alignment, and boundary requirements are added as required edges, which the sequence pair cannot do as directly.</li>
<li><strong>Always feasible</strong>: the closed graphs are acyclic by construction, so every move yields a legal placement.</li>
<li><strong>Fully general</strong>: it represents all packings including those with slack, and is provably interconvertible with the sequence pair.</li>
</ul>
</div>
<div class="pc-card pc-cons">
<h3>Weaknesses</h3>
<ul>
<li><strong>Large state</strong>: the closure holds up to n(n-1)/2 edges per graph, more memory than the tree representations.</li>
<li><strong>Bookkeeping per move</strong>: each move must restore the transitive closure, which costs more than a tree surgery.</li>
<li><strong>Evaluation overhead</strong>: carrying the closure around motivated the TCG-S variant, which couples the graphs with a sequence for faster, incremental cost updates.</li>
</ul>
</div>
</div>

<div class="tradeoff-box">
<h3>The trade-off</h3>
<p>The transitive closure graph trades compactness for transparency and constraint power. Where the tree representations store a few pointers and derive relations on decode, this stores all the relations explicitly and keeps them closed. That makes placement constraints as simple as adding an edge and keeps every move feasible, at the cost of larger state and closure bookkeeping. It is the representation to reach for when constraints, not raw encoding size, dominate.</p>
</div>

## Is it actually used today?

The transitive closure graph is a general-purpose research
representation and the sequence pair's main rival for non-slicing
floorplans.

- <strong>Constraint-heavy floorplanning</strong>: it is a natural fit
  where abutment, alignment, boundary, and bus-planning constraints
  must be enforced, since each reads directly as a required edge.
- <strong>Sequence-pair alternative</strong>: it appears throughout the
  2000s floorplanning literature as the graph-based counterpart to the
  sequence pair, with the TCG-S variant added for speed.
- <strong>Analog and constrained placement</strong>: the explicit
  relations make it a common base for symmetry- and
  constraint-aware placement research.
- <strong>Note on production tools</strong>: commercial floorplanners
  do not publish their internal representations, so any specific use
  there is not verifiable. The evidence above is the academic record.
""",
    },
    {
        "slug": "twin-binary-sequences",
        "level": "research",
        "name": "Twin Binary Sequences",
        "family": "representations",
        "year": "2003",
        "who": "Young, Chu, Shen",
        "chips": [
            ("diff-easy", "no redundancy"),
            ("diff-medium", "mosaic floorplans"),
        ],
        "summary": (
            "A pair of binary sequences with a twin property gives a "
            "one-to-one, no-waste encoding of mosaic floorplans, fixing "
            "the redundancy and dummy-block issues of earlier mosaic "
            "codes."
        ),
        "lab": None,
        "refs": [
            ("Young, Chu, Shen, 'Twin binary sequences: a non-redundant representation for general non-slicing floorplan' (search)",
             "https://scholar.google.com/scholar?q=Young+Chu+Shen+twin+binary+sequences+floorplan"),
        ],
        "body": """
## The idea

Mosaic floorplans have a hidden binary-tree skeleton: slice off blocks
from one corner and the branching pattern of the demolition forms a
tree. Twin Binary Sequences capture a mosaic floorplan as a block
permutation plus two bit sequences derived from *twin binary trees*, a
classical combinatorial pairing in which two labeled trees are twins
when their in-order traversals agree and their bit labelings are
complementary. The twin condition is exactly what makes the encoding
tight: every valid tuple corresponds to one and only one mosaic
floorplan, and every mosaic floorplan to one tuple.

Non-redundancy is the headline. The sequence pair wanders an (n!)²
space; corner block lists admit multiple encodings of the same
floorplan; twin binary sequences are a bijection, so the annealer never
wastes a move revisiting the same floorplan under a different name. The
authors also gave a linear-time decode and showed how to insert empty
rooms where beneficial *without* the guesswork dummy blocks of the
corner block list, closing the gap between mosaic and general packings.

## Trade-offs

The bookkeeping is more delicate than a tree you can freely rotate: moves
must preserve the twin property, and the combinatorial correspondence
takes longer to internalize than "left child means to my right". In
exchange you search the smallest possible space for mosaic topologies.

## Where you meet it today

In the theory of floorplan enumeration (twin binary trees are how mosaic
floorplans were tied to Baxter numbers) and in floorplanners that prize
non-redundant search spaces. It marks the endpoint of the
mosaic-encoding line that corner block lists began.
""",
    },
    {
        "slug": "corner-sequence",
        "level": "research",
        "name": "Corner Sequence",
        "family": "representations",
        "year": "2003",
        "who": "Lin, Chang, Lin",
        "chips": [
            ("diff-easy", "incremental decode"),
            ("diff-medium", "compacted floorplans"),
        ],
        "summary": (
            "Encode a packing as the order in which blocks are pushed "
            "into the bottom-left corner region, enabling constant-time "
            "incremental updates during annealing moves."
        ),
        "lab": None,
        "refs": [
            ("Lin, Chang, Lin, 'Corner sequence: a P-admissible floorplan representation with a worst-case linear-time packing scheme' (search)",
             "https://scholar.google.com/scholar?q=corner+sequence+P-admissible+floorplan+representation"),
        ],
        "body": """
## The idea

The Corner Sequence describes a packing as a construction order: blocks
enter one at a time, each placed into a *corner* of the region already
built (a concave notch of the current skyline), recorded together with
which corner it took. Maintaining the set of available corners as blocks
arrive is cheap, so decoding a full sequence is worst-case linear, and,
crucially, an annealing move that alters a suffix of the sequence can
re-decode only that suffix: the prefix's geometry is untouched.

That incrementality is the representation's reason to exist. Annealers
spend nearly all their time evaluating candidate floorplans; a
representation that turns most moves into partial re-evaluations
multiplies the effective iteration budget without touching the cooling
schedule.

## Trade-offs

Like the O-tree and B*-tree, the corner sequence is confined to the
P-admissible world of compacted packings: decode always yields a
bottom-left-pushed arrangement, ideal for area but requiring extensions
for slack-hungry constraints. Its search space and solution quality are
on par with the B*-tree family; the differentiation is evaluation speed
under long move chains, and a construction viewpoint that some
constraint types (place block X in the bottom-left region, keep Y on the
boundary) express naturally.

## Where you meet it today

In the efficiency-focused corner of the literature and inside packers
where evaluation throughput is the bottleneck. Conceptually it also
bridges toward online and constructive packing heuristics, since its
decode *is* a constructive packer replayed from a script.
""",
    },
    {
        "slug": "adjacent-constraint-graph",
        "level": "research",
        "name": "Adjacent Constraint Graph",
        "family": "representations",
        "year": "2004",
        "who": "Zhou and Wang",
        "chips": [
            ("diff-easy", "fully general"),
            ("diff-medium", "sparse graphs"),
        ],
        "summary": (
            "Keep constraint graphs like the Transitive Closure Graph, "
            "but store only adjacency-level edges, keeping the structure "
            "sparse while remaining a complete representation."
        ),
        "lab": None,
        "refs": [
            ("Zhou and Wang, 'ACG: adjacent constraint graph for general floorplans' (search)",
             "https://scholar.google.com/scholar?q=Zhou+Wang+ACG+adjacent+constraint+graph+floorplan"),
        ],
        "body": """
## The idea

The Transitive Closure Graph carries every pairwise relation, up to
n(n-1) edges of mostly redundant information. The Adjacent Constraint
Graph asks: what is the *least* we can store and still be a
constraint-graph representation? Its answer: keep only relations between
blocks that are adjacent in the packing sense (no third block's
projection separates them), subject to structural rules that ban
redundant and crossing patterns. The result is a sparse pair of graphs
that still determines the packing uniquely and decodes with the usual
longest-path computation.

Sparsity buys three things: less memory, cheaper moves (fewer edges to
fix up after a perturbation), and a cleaner geometric reading, since an
edge now means "these two blocks actually see each other", which is the
level at which physical constraints like abutment and channel insertion
live.

## Trade-offs

Maintaining the structural invariants under arbitrary moves is the
delicate part; move design is more constrained than in the
free-swapping sequence pair world. The representation sits deliberately
between extremes: complete like the sequence pair and Transitive
Closure Graph, sparse like the trees, at the cost of invariants more
intricate than either.

## Where you meet it today

In the later representation literature and in floorplanners for which
adjacency is semantically load-bearing (channel planning, bus-driven
floorplanning, some analog work). Historically it closes the 1995-2004
representation race: after the Adjacent Constraint Graph, the field's
energy moved from inventing encodings to the fixed-outline and
analytical problems of the modern era.
""",
    },
    # ----- engines -----
    {
        "slug": "simulated-annealing",
        "card": "Accept some worse moves, cool slowly, and settle near a good optimum.",
        "level": "foundational",
        "name": "Simulated Annealing",
        "family": "engines",
        "year": "1983",
        "who": "Kirkpatrick, Gelatt, Vecchi",
        "chips": [
            ("diff-easy", "the universal engine"),
            ("diff-medium", "tuning-sensitive"),
        ],
        "summary": (
            "Accept worse solutions with probability exp(-Δcost / T) and "
            "cool T slowly: the metaheuristic that powered every "
            "representation on this page for forty years."
        ),
        "lab": None,
        "refs": [
            ("Wikipedia: Simulated annealing",
             "https://en.wikipedia.org/wiki/Simulated_annealing"),
            ("Kirkpatrick, Gelatt, Vecchi, 'Optimization by simulated annealing', Science 1983 (search)",
             "https://scholar.google.com/scholar?q=Kirkpatrick+Gelatt+Vecchi+optimization+simulated+annealing+1983"),
        ],
        "body": """
## The idea

Floorplanning cost functions are rugged: full of local minima separated
by ridges that greedy improvement cannot cross. Simulated annealing,
borrowed from the statistical mechanics of cooling metals, escapes them
with one rule. Propose a random move (any of the perturbations described
on the representation pages). If it improves the cost, accept it. If it
worsens the cost by Δ, accept it anyway with probability
exp(−Δ / T), where T is a temperature that starts high (almost
everything accepted, free exploration) and is lowered slowly (the system
settles into a deep basin).

The theory is reassuring at infinite patience (with slow enough cooling,
convergence to the global optimum has been proved) and silent at
practical schedules, where manual tuning takes over: initial temperature chosen
so a target fraction of moves accept, geometric cooling (T multiplied by
0.85 to 0.99 per stage), moves-per-stage scaled with problem size, and
cost normalization so area and wirelength terms trade off stably.

## Why floorplanning married it

The representation zoo exists *because* annealing only needs three
things: a state encoding, a move set, and a cost evaluator. Polish
expressions, sequence pairs, and B*-trees are all answers to "what state
and moves give annealing the best-shaped space?" Nothing else matches
its indifference to cost-function ugliness: add a fixed-outline penalty,
a wirelength estimate, a thermal term, and the engine does not care.

## Where you meet it today

Still the reference optimizer for hard-block packing and analog
placement, and inside modern hierarchical macro placers (the leaf-level
packer of Hier-RTLMP anneals). Its weakness, runtime that scales poorly
to millions of movable objects, is exactly the gap analytical placement
grew to fill.
""",
    },
    {
        "slug": "genetic-floorplanning",
        "level": "research",
        "name": "Genetic and Evolutionary Floorplanning",
        "family": "engines",
        "year": "1986 onward",
        "who": "Cohoon and Paris; many successors",
        "chips": [
            ("diff-medium", "population-based"),
            ("diff-medium", "crossover is the hard part"),
        ],
        "summary": (
            "Evolve a population of floorplans with selection, mutation, "
            "and crossover. Attractive in principle, tricky in practice: "
            "recombining two floorplans meaningfully is the eternal "
            "obstacle."
        ),
        "lab": None,
        "refs": [
            ("Cohoon and Paris, 'Genetic placement' (search)",
             "https://scholar.google.com/scholar?q=Cohoon+Paris+genetic+placement+1986"),
            ("Wikipedia: Genetic algorithm",
             "https://en.wikipedia.org/wiki/Genetic_algorithm"),
        ],
        "body": """
## The idea

Where annealing walks one solution through the search space, a genetic
algorithm maintains a *population*. Each generation: evaluate everyone
(area, wirelength), select parents biased toward the fit, produce
children by *crossover* (splice two parents' encodings) and *mutation*
(the same local moves annealers use), and replace the weak. Diversity in
the population plays the role temperature plays in annealing.

All the floorplan encodings on these pages have been used as genomes:
Polish expressions, sequence pairs, trees. The recurring difficulty is
crossover. Splicing two permutations naively produces duplicates and
omissions, so permutation-preserving operators (order crossover,
partially matched crossover) are required; even then, half of parent A's
packing logic rarely *means* anything glued to half of parent B's, so
offspring often decode to poor floorplans and the algorithm degenerates
into parallel mutation-only search, which annealing does with less
overhead.

## Assessment

Population methods are worthwhile when evaluations parallelize across
a cluster trivially, when multi-objective trade-off fronts are the goal
(area versus wirelength versus temperature Pareto sets fall out
naturally from a population), or when hybridized: memetic designs that
apply local annealing to each offspring have posted respectable
results. As a straight replacement for annealing on single-objective
packing, the published record says: comparable at best, usually behind.

## Where you meet it today

Multi-objective floorplanning research, thermal-aware and
3D-integration studies with exotic cost mixtures, and as the standard
"other metaheuristic" baseline in papers. Its population viewpoint also
prefigured today's approach of sampling many reinforcement-learning
rollouts in parallel.
""",
    },
    {
        "slug": "ilp-floorplanning",
        "level": "research",
        "name": "Integer Linear Programming Floorplanning",
        "family": "engines",
        "year": "1991",
        "who": "Sutanthavibul, Shragowitz, Rosen",
        "chips": [
            ("diff-easy", "exact within the model"),
            ("diff-hard", "explodes past ~tens of blocks"),
        ],
        "summary": (
            "Write non-overlap as big-M constraints with binary "
            "left/right/above/below choices and let a solver find the "
            "provably optimal floorplan - for small instances."
        ),
        "lab": None,
        "refs": [
            ("Sutanthavibul, Shragowitz, Rosen, 'An analytical approach to floorplan design and optimization' (search)",
             "https://scholar.google.com/scholar?q=Sutanthavibul+Shragowitz+Rosen+analytical+floorplan+design+optimization"),
            ("Wikipedia: Integer programming",
             "https://en.wikipedia.org/wiki/Integer_programming"),
        ],
        "body": """
## The idea

State floorplanning as constraints and hand it to mathematics. Block i
has continuous variables (x_i, y_i) and possibly a rotation bit. For
every pair (i, j), non-overlap means at least one of four relations
holds: i left of j, i right of j, i below j, i above j. Encode the
choice with two binary variables per pair and *big-M* constraints such
as:

<div class="eq">x_i + w_i ≤ x_j + M · (p_ij + q_ij)</div>

<ul class="eq-legend">
<li><code>x_i, w_i</code> block i's position and width (continuous variables)</li>
<li><code>p_ij, q_ij</code> binary variables selecting which relation holds for the pair</li>
<li><code>M</code> a constant large enough to disable the inequality when not selected</li>
</ul>

where the binaries switch each inequality on or off and M is a
sufficiently large constant. Add die bounds, minimize chip width times
height (linearized, or minimize the half-perimeter with a fixed aspect),
and a branch-and-bound Integer Linear Programming solver returns the
*optimal* floorplan, with a certificate.

## The wall

The formulation carries O(n²) binaries, and big-M constraints produce
notoriously loose linear relaxations, so branch-and-bound trees explode:
practical exactness ends somewhere in the tens of blocks even with
modern commercial solvers. The 1991 paper already prescribed the
survival strategy: solve successive small subproblems (add a few blocks
at a time to a partial floorplan), trading global optimality for
tractability.

## Why it still matters

Exactness is valuable at the scale where it is achievable: channel-level
subproblems, datapath tiles, calibrating heuristics (how far from
optimal is my annealer on 15-block instances?), and constraint-dense
corners of a design where feasibility itself is the question. The linear
programming *relaxation* also survives inside heuristics: fix a
topology from any representation and the optimal sizing/position
problem becomes an ordinary linear program, solved exactly in
milliseconds.

## Where you meet it today

Optimality studies, analog and datapath tile assembly, and as the
sizing subroutine inside topology-searching floorplanners.
""",
    },
    # ----- modern -----
    {
        "slug": "fixed-outline-parquet",
        "card": "Annealing retooled to fit a fixed outline instead of minimizing area.",
        "level": "industry",
        "name": "Fixed-Outline Floorplanning (Parquet)",
        "family": "modern",
        "year": "2001",
        "who": "Adya and Markov",
        "chips": [
            ("diff-easy", "the modern problem statement"),
            ("diff-medium", "feasibility, not just area"),
        ],
        "summary": (
            "Modern floorplanning is not 'minimize area' but 'fit inside "
            "this exact rectangle'. Parquet reframed annealing around "
            "outline-violation penalties and slack-driven moves."
        ),
        "lab": None,
        "refs": [
            ("Adya and Markov, 'Fixed-outline floorplanning: enabling hierarchical design' (search)",
             "https://scholar.google.com/scholar?q=Adya+Markov+fixed-outline+floorplanning+enabling+hierarchical+design"),
        ],
        "body": """
## The idea

Classical floorplanning minimized die area with a free outline: pack
tight, and whatever bounding box results, results. Real methodology
inverted this in the era of hierarchical design: the top level hands
each partition a *fixed* rectangle, and the floorplanner's first job is
to *fit*, with wirelength as the objective and area as a constraint.
Adya and Markov named the problem, showed classic annealers fail at it
surprisingly often (packing tightly toward one corner is not the same
skill as filling a prescribed aspect ratio), and built Parquet to solve
it.

## How Parquet does it

The engine is familiar, sequence pairs or B*-trees under simulated
annealing, with three decisive changes:

- **Cost**: replace pure area with wirelength plus a penalty for
  exceeding the fixed outline in either dimension.
- **Slack-driven moves**: compute each block's horizontal and vertical
  slack (how far it can move without pushing the outline). Blocks with
  zero slack in the violating direction are the ones pinning the
  overflow; move *those*, into the direction with room. This targets
  repair instead of hoping random moves stumble onto it.
- **Aspect-ratio awareness**: soft blocks reshape within their allowed
  ranges to relieve whichever dimension is tight.

## Why it mattered

Fixed-outline feasibility is what makes hierarchical physical design
composable: a parent can budget rectangles to children and trust them
to comply. Parquet became the standard reference implementation, the
benchmark generator's companion, and the default comparison target for
a decade of fixed-outline papers.

## Where you meet it today

Every serious floorplanner is fixed-outline now; the problem statement
is Parquet's enduring legacy. The tool itself persists in academic
suites (with its companion benchmarks) and inside hierarchical flows
that still anneal block-level partitions.
""",
    },
    {
        "slug": "analytical-floorplanning",
        "level": "industry",
        "name": "Analytical and Force-Directed Floorplanning",
        "family": "modern",
        "year": "1990s onward",
        "who": "many; placement-derived",
        "chips": [
            ("diff-easy", "scales far past annealing"),
            ("diff-medium", "legalization gap"),
        ],
        "summary": (
            "Treat block positions as continuous variables: minimize "
            "smooth wirelength with attractive forces, push overlap out "
            "with repulsive or density terms, then legalize. The bridge "
            "between floorplanning and modern placement."
        ),
        "lab": None,
        "refs": [
            ("Eisenmann and Johannes, 'Generic global placement and floorplanning' (search)",
             "https://scholar.google.com/scholar?q=Eisenmann+Johannes+generic+global+placement+floorplanning+DAC+1998"),
            ("Force-directed placement overview (Wikipedia: force-directed graph drawing)",
             "https://en.wikipedia.org/wiki/Force-directed_graph_drawing"),
        ],
        "body": """
## The idea

Drop combinatorics entirely. Let every block's center be a continuous
(x, y), model each net as springs pulling its pins together (a quadratic
wirelength objective, minimized by solving a sparse linear system), and
handle the one thing springs get catastrophically wrong, everything
collapsing onto one point, with a counterforce: repulsion computed from
local density, added each iteration until blocks spread into an
overlap-light arrangement. Iterate solve-spread until stable, then snap
to a legal floorplan.

This is force-directed *placement* mathematics (Eisenmann and Johannes'
formulation, and the quadratic engines of the Placement catalog) applied
at block granularity, and the two fields genuinely merged here: a
floorplan with a thousand macros and a placement with a thousand
clusters are the same computation.

## Trade-offs

Analytical methods are the only ones indifferent to object count:
thousands of blocks cost a few sparse solves. Wirelength, being the
actual objective rather than a side effect, tends to beat annealed
packings on connected designs. The weaknesses are geometric: smooth
models ignore exact non-overlap, so a *legalization* step must convert
the fuzzy result into disjoint rectangles (constraint-graph adjustment,
or handing the topology to a packer), and hard fixed-outline plus odd
aspect ratios can strain the density model.

## Where you meet it today

Everywhere the block count is large or blocks mix with standard cells:
mixed-size placement engines treat macros as huge cells inside the
analytical solve, which is how most modern flows actually floorplan.
The electrostatics refinement of this idea (ePlace and RePlAce in the
Placement catalog) is the current state of the art, and OpenROAD's
macro-aware global placement is exactly this lineage in production.
""",
    },
    {
        "slug": "hier-rtlmp",
        "level": "industry",
        "name": "Hierarchical Macro Placement (Hier-RTLMP)",
        "family": "modern",
        "year": "2023",
        "who": "Kahng, Varadarajan, et al.; OpenROAD",
        "chips": [
            ("diff-easy", "runs in OpenROAD today"),
            ("diff-easy", "dataflow-aware"),
        ],
        "summary": (
            "Cluster the netlist by RTL (Register Transfer Level) "
            "hierarchy and dataflow, anneal clusters hierarchically with "
            "guidance costs, and pin macros to sensible edges: the "
            "practical open-source answer for macro-heavy chips."
        ),
        "lab": None,
        "refs": [
            ("Hier-RTLMP paper (arXiv)",
             "https://arxiv.org/abs/2304.11761"),
            ("OpenROAD macro placement documentation",
             "https://github.com/The-OpenROAD-Project/OpenROAD"),
        ],
        "body": """
## The idea

Real chips arrive with hundreds of memory macros and a logical
hierarchy that already encodes designer intent. Hier-RTLMP, the macro
placer in OpenROAD, leans into both. It builds a *physical hierarchy*
by clustering the netlist, guided by the RTL (Register Transfer Level)
module tree and by dataflow analysis (which clusters feed which through
how many registers), producing a tree of clusters whose leaves are
macro groups and standard-cell clusters.

Placement then proceeds top-down through the tree. Each cluster's
children are shaped (tileable aspect-ratio ranges computed from their
contents) and placed inside the parent's outline by simulated annealing
on a packing representation, with a cost that mixes wirelength,
outline fit, congestion proxies, and *guidance* terms: dataflow
affinities pull talkative clusters together, boundary and corner biases
push macro arrays to die edges so the core stays open for standard
cells, and blockage awareness respects what floorplanners actually
fear. Leaf level places the individual macros; standard-cell regions
are left for the global placer.

## Why the hierarchy matters

Flat annealing over hundreds of macros plus abstract cell area is slow
and aimless; the hierarchy cuts the problem into annealing runs of
manageable size *and* injects structural knowledge annealing cannot
discover: this cache belongs with that datapath because the RTL
(Register Transfer Level) tree and the dataflow say so. It is the same divide-and-guide instinct as min-cut
floorplanning, rebuilt with modern clustering and cost design.

## Where you meet it today

Type `rtl_macro_placer` in OpenROAD: this is the production macro
placement of the open-source flow, and its papers document strong
results against both human floorplans and flat automatic ones on
industrial testcases.
""",
    },
    {
        "slug": "rl-floorplanning",
        "level": "industry",
        "name": "Reinforcement-Learning Floorplanning (AlphaChip)",
        "family": "modern",
        "year": "2021",
        "who": "Mirhoseini, Goldie, et al. (Google)",
        "chips": [
            ("diff-easy", "learns across designs"),
            ("diff-hard", "contested benchmarks"),
        ],
        "summary": (
            "A neural policy places macros one at a time on a grid, "
            "trained by reinforcement learning against a "
            "wirelength-and-congestion reward, transferring experience "
            "between chips. Famous, deployed, and vigorously debated."
        ),
        "lab": None,
        "refs": [
            ("Mirhoseini et al., 'A graph placement methodology for fast chip design', Nature 2021",
             "https://www.nature.com/articles/s41586-021-03544-w"),
            ("AlphaChip open-source release (circuit_training)",
             "https://github.com/google-research/circuit_training"),
        ],
        "body": """
## The idea

Frame macro placement as a sequential game. The state: the netlist (as
a graph), the partially placed floorplan, and which macro is next. The
action: choose a grid cell for that macro. After all macros are placed,
standard cells are spread by a fast force-directed method, and the
episode's *reward* is a mixture of negative half-perimeter wirelength
and congestion and density penalties. A policy network, with a graph
neural network encoding the netlist and a convolutional view of the
occupancy grid, is trained by reinforcement learning across thousands
of episodes, and, the headline claim, across *designs*: pretraining on
a corpus of chips lets the policy zero-shot or quickly fine-tune on a
new one, getting better with experience the way annealing never does.

## The reception

The Nature 2021 paper reported human-competitive or better macro
placements in hours and use in Google's TPU (Tensor Processing Unit)
production flows; the code was released as circuit training, and the
approach was later branded AlphaChip. It also ignited one of EDA's
(Electronic Design Automation's) sharpest reproducibility debates:
independent evaluations (notably by Cheng, Kahng, et al.) reported that
strong classical baselines, tuned annealing among them, match or beat
the published results on open benchmarks, and disputes over
preprocessing (netlist clustering, placement seeds) and baseline
strength ran through journals for years. Read both sides.

## Why it matters regardless

Whatever the final scorecard, the work moved the field: learned
placement is now a standing research area, the state-action-reward
framing of floorplanning is standard vocabulary, and every major EDA
vendor has since shipped some machine-learning-guided floorplanning or
design-space exploration. It is the first floorplanning algorithm whose
skill is a trained artifact rather than a coded procedure.

## Where you meet it today

The open-source circuit training repository, vendor
reinforcement-learning offerings, and a lively benchmark literature
(MacroPlacement, among others) that this controversy productively
forced into existence.
""",
    },
]
