"""Placement algorithm catalog: partitioning foundations, min-cut and
annealing eras, the analytical lineage that owns the present, and the
legalization/detailed-placement steps that make results real."""

STAGE = {
    "slug": "placement",
    "name": "Placement",
    "tagline": (
        "Give millions of standard cells exact positions so that "
        "wirelength is short, timing closes, and the router can finish. "
        "Placement research runs from 1970 graph partitioning through "
        "annealing to today's electrostatics-based analytical solvers "
        "running on GPUs (Graphics Processing Units)."
    ),
    "families": [
        {
            "id": "partitioning",
            "name": "Partitioning foundations",
            "lead": (
                "Before anything is placed, netlists get cut into pieces. "
                "These three algorithms are the cutting tools the whole "
                "field leans on, in placement and far beyond."
            ),
        },
        {
            "id": "mincut",
            "name": "Min-cut placement",
            "lead": (
                "Recursively bipartition netlist and die together and let "
                "cut minimization stand in for wirelength. The dominant "
                "school of the 1980s and 1990s, and the engine of the "
                "last great min-cut placer in 2000."
            ),
        },
        {
            "id": "annealing",
            "name": "Simulated annealing placement",
            "lead": (
                "For a decade the quality king: move cells at random, "
                "accept uphill moves with cooling probability, and let "
                "the physics metaphor grind out excellent placements "
                "slowly."
            ),
        },
        {
            "id": "analytical",
            "name": "Analytical global placement",
            "lead": (
                "Model wirelength as a differentiable function and "
                "descend it. From quadratic solvers of the late 1980s to "
                "the electrostatics formulation that powers OpenROAD and "
                "GPU (Graphics Processing Unit) placers today, this "
                "lineage won."
            ),
        },
        {
            "id": "legalization",
            "name": "Legalization and detailed placement",
            "lead": (
                "Global placement leaves cells overlapping and off-row. "
                "These algorithms snap everything legal and then polish "
                "locally, where the last percent of quality lives."
            ),
        },
    ],
}

ALGORITHMS = [
    # ----- partitioning -----
    {
        "slug": "kernighan-lin",
        "card": "Swap the best pair, lock it, repeat; keep the best run of swaps.",
        "level": "foundational",
        "name": "Kernighan-Lin Partitioning",
        "family": "partitioning",
        "year": "1970",
        "who": "Kernighan and Lin",
        "chips": [
            ("diff-easy", "the founding heuristic"),
            ("diff-medium", "O(n²·log n) per pass"),
        ],
        "summary": (
            "Improve a bipartition by tentatively swapping the "
            "best-gain pair of nodes, locking them, and continuing; then "
            "keep the best prefix of the whole swap sequence. Hill "
            "climbing that can climb out of shallow local minima."
        ),
        "lab": None,
        "refs": [
            ("Wikipedia: Kernighan-Lin algorithm",
             "https://en.wikipedia.org/wiki/Kernighan%E2%80%93Lin_algorithm"),
        ],
        "body": """
## The idea

Split a graph's vertices into two equal halves so that as few edges as
possible cross. Kernighan and Lin's 1970 heuristic starts from any
balanced split and improves it in *passes*. Within a pass: compute for
every vertex its *gain* (cut edges removed minus cut edges created if it
switched sides). Pick the pair of unlocked vertices, one per side, whose
swap has the best combined gain; swap them *tentatively*; lock them;
recompute gains; repeat until everything is locked. Now look back over
the sequence of tentative swaps and keep the prefix whose cumulative
gain was maximal, undoing the rest. Run passes until one yields no
improvement.

The prefix trick is the essential mechanism of the method: individual swaps in the
middle of a pass may be losing moves, but committing to the best prefix
lets the algorithm walk *through* a bad region to a better one, which
pure greedy improvement cannot do.

## Cost and character

Each pass costs roughly O(n²·log n) with the classic implementation
(choosing the best pair dominates). Quality is respectable on small
graphs; on large ones it is slow and myopic, which is what its
descendants fixed. Fiduccia-Mattheyses reformulated it for hypergraphs
at linear time per pass; multilevel methods wrapped it in coarsening.

## Where you meet it today

As the ancestor invoked in every partitioning lecture, in interview
questions, and conceptually inside every refinement pass of modern
partitioners: the gain-bucket sweep with a best-prefix rollback is
still recognizably Kernighan-Lin.
""",
    },
    {
        "slug": "fiduccia-mattheyses",
        "level": "foundational",
        "name": "Fiduccia-Mattheyses Partitioning",
        "family": "partitioning",
        "year": "1982",
        "who": "Fiduccia and Mattheyses",
        "chips": [
            ("diff-easy", "linear time per pass"),
            ("diff-easy", "hypergraph-native"),
        ],
        "summary": (
            "Single-vertex moves, a gain-bucket data structure, and "
            "true hypergraph cut handling make Kernighan-Lin's idea run "
            "in linear time per pass. The refinement engine of physical "
            "design ever since."
        ),
        "lab": None,
        "refs": [
            ("Wikipedia: Fiduccia-Mattheyses algorithm",
             "https://en.wikipedia.org/wiki/Fiduccia%E2%80%93Mattheyses_algorithm"),
        ],
        "body": """
## The idea

Three upgrades to Kernighan-Lin, each decisive. First, move *single*
vertices instead of swapping pairs, with a balance constraint keeping
the sides within tolerance; this halves the bookkeeping and lets sizes
breathe. Second, netlists are *hypergraphs* (one net can connect many
cells), and Fiduccia-Mattheyses computes gains on hyperedges correctly:
a net contributes to the cut once, and only moves that empty a net's
last cell from one side change its cut status. Third, the *gain bucket*:
an array of doubly linked lists indexed by gain value, so selecting the
best-gain movable vertex, moving it, and updating its neighbors' gains
all run in amortized constant time. A full pass, every vertex moved once
with the best-prefix rollback, costs time linear in total pin count.

## Why it took over

Linear passes made iterated refinement affordable on real netlists, and
the algorithm is straightforward to engineer: tie-breaking rules, balance
tolerances, and multi-way extensions all slot in cleanly. Alone it is
still a local method (quality degrades on huge graphs as single moves
cannot see far), which is exactly the weakness multilevel partitioning
repairs by running Fiduccia-Mattheyses at every coarsening level.

## Where you meet it today

Inside effectively every serious partitioner (hMETIS and its relatives
run Fiduccia-Mattheyses-style refinement at each level), inside min-cut
placers like Capo, in clustering flows, and in any tool that says
"FM refinement" in its documentation: that is this algorithm, forty
years on.
""",
    },
    {
        "slug": "multilevel-partitioning",
        "level": "industry",
        "name": "Multilevel Partitioning (hMETIS)",
        "family": "partitioning",
        "year": "1997",
        "who": "Karypis, Kumar, et al.",
        "chips": [
            ("diff-easy", "quality and scale at once"),
            ("diff-easy", "the standard tool"),
        ],
        "summary": (
            "Coarsen the hypergraph by clustering, partition the small "
            "version, then uncoarsen while refining at every level. The "
            "V-cycle that made million-node partitioning routine."
        ),
        "lab": None,
        "refs": [
            ("hMETIS project page",
             "http://glaros.dtc.umn.edu/gkhome/metis/hmetis/overview"),
            ("Karypis et al., 'Multilevel hypergraph partitioning: applications in VLSI domain' (search)",
             "https://scholar.google.com/scholar?q=Karypis+multilevel+hypergraph+partitioning+VLSI"),
        ],
        "body": """
## The idea

Flat refinement sees only one move at a time; good cuts on big graphs
require moving whole regions. The multilevel paradigm gets there in
three phases. **Coarsen**: repeatedly merge strongly connected vertex
clusters (heavy-edge matching and its hypergraph analogues), producing
a hierarchy of ever-smaller graphs that preserve the original's cut
structure. **Initial partition**: split the smallest graph, where even
expensive methods are cheap. **Uncoarsen and refine**: project the
partition back level by level, running Fiduccia-Mattheyses refinement
at each, so single-vertex moves at a coarse level correspond to bulk
region moves in the original.

The result is better cuts *and* near-linear total
runtime, because most refinement happens on small graphs and each level
starts from an already-good projection. hMETIS packaged the idea for
hypergraphs with careful matching schemes and V-cycle iteration and set
benchmark records that stood for years.

## Where you meet it today

Everywhere netlists get cut: min-cut placement (Capo's bisection
engine), physical hierarchy generation and clustering before macro
placement, multi-die and multi-FPGA (Field-Programmable Gate Array)
system partitioning, parallel simulation load balancing. The multilevel
V-cycle also escaped partitioning entirely: multilevel placement (the
mPL page) and multigrid-flavored solvers in analytical placement are
the same instinct applied to different objectives.
""",
    },
    # ----- mincut -----
    {
        "slug": "min-cut-placement",
        "card": "Slice die and netlist together so few nets cross each cut.",
        "level": "foundational",
        "name": "Min-Cut Placement",
        "family": "mincut",
        "year": "1977",
        "who": "Breuer",
        "chips": [
            ("diff-easy", "constructive and scalable"),
            ("diff-medium", "cut as wirelength proxy"),
        ],
        "summary": (
            "Recursively slice the die and the netlist together, "
            "assigning cells to regions so few nets cross each cut line. "
            "The placement school that partitioning built."
        ),
        "lab": None,
        "refs": [
            ("Breuer, 'A class of min-cut placement algorithms' (search)",
             "https://scholar.google.com/scholar?q=Breuer+class+of+min-cut+placement+algorithms"),
        ],
        "body": """
## The idea

Identical DNA to min-cut floorplanning, applied at cell granularity.
Cut the die with a vertical line; bipartition the netlist with a
partitioner (Kernighan-Lin then, Fiduccia-Mattheyses and multilevel
later) so the two cell sets match the two regions' capacities and few
nets cross; recurse with alternating cut directions until regions hold
a handful of cells each, then order cells within rows. Every net that
crosses a cut must physically cross that line on the die, so total cut
over the hierarchy lower-bounds and correlates with routed wirelength.

Cut sequencing is a real design space: strict alternation, quadrature
(cut the larger dimension), and bisection versus quadrisection all
change results, as does how region capacities absorb differing cell
widths.

## Strengths and the structural flaw

Strengths: deterministic, fast, naturally hierarchical, and congestion
falls out of it (cut counts *are* crossing demand, so capacity-aware
partitioning controls routability directly). The flaw: decisions are
irrevocable and locally blind. A net cut at level one is charged once,
though its endpoints may drift far apart in later levels; conversely
cells that should hug a fixed pin can be exiled early. Terminal
propagation (next page) is the classic repair.

## Where you meet it today

The pure form is retired, but its skeleton persists in placers that
warm-start analytical engines with a partitioning pass, in
congestion-driven region budgeting, and in Capo, the method's
definitive final form.
""",
    },
    {
        "slug": "terminal-propagation",
        "level": "research",
        "name": "Terminal Propagation",
        "family": "mincut",
        "year": "1985",
        "who": "Dunlop and Kernighan",
        "chips": [
            ("diff-easy", "fixes min-cut's blindness"),
        ],
        "summary": (
            "When recursing into a region, project outside connections "
            "onto its boundary as fixed pseudo-terminals, so the "
            "partitioner inside feels the pull of the world outside."
        ),
        "lab": None,
        "refs": [
            ("Dunlop and Kernighan, 'A procedure for placement of standard-cell VLSI circuits' (search)",
             "https://scholar.google.com/scholar?q=Dunlop+Kernighan+procedure+placement+standard-cell+VLSI"),
        ],
        "body": """
## The idea

Raw min-cut placement partitions each region in isolation: a cell inside region R connected
heavily to cells far outside R gets sorted by purely internal logic, and
wirelength suffers. Dunlop
and Kernighan's terminal propagation fixes this with one mechanism.
When partitioning region R, take every net that connects R's cells to
cells already assigned elsewhere; project each such external
connection's position onto R's boundary; and create there a fixed
*pseudo-terminal* belonging to that net. The partitioner now sees these
terminals as immovable members of one side, so its cut objective
naturally pulls the net's internal cells toward the side nearest their
external partners. Nets whose projection lands ambiguously in the
middle band are left unpropagated to avoid noise.

## Why it was decisive

This one change converts min-cut from a pure netlist clusterer into a
genuinely *geometric* placer: information flows top-down through the
recursion, and each local cut now optimizes a sensible surrogate of
global wirelength. Published results moved min-cut placement from
curiosity to industrial standard, and the technique became mandatory in
every serious min-cut placer afterward, including Capo. The idea also
generalized: analytical placers doing region-wise refinement use the
same project-and-fix trick when solving subproblems.

## Where you meet it today

Inside any partitioning-based placement or clustering flow worth its
salt, and as a beautiful interview answer to "how do you make local
optimization respect global context?"
""",
    },
    {
        "slug": "capo",
        "level": "research",
        "name": "Capo",
        "family": "mincut",
        "year": "2000",
        "who": "Caldwell, Kahng, Markov",
        "chips": [
            ("diff-easy", "min-cut's final form"),
            ("diff-easy", "routability-driven"),
        ],
        "summary": (
            "A fast, clean, open min-cut placer: multilevel bisection "
            "with terminal propagation, careful tolerance control, and "
            "end-case placers, tuned until min-cut ran out of road."
        ),
        "lab": None,
        "refs": [
            ("Caldwell, Kahng, Markov, 'Can recursive bisection alone produce routable placements?' (search)",
             "https://scholar.google.com/scholar?q=Caldwell+Kahng+Markov+recursive+bisection+routable+placements"),
        ],
        "body": """
## The idea

Capo is the min-cut school engineered to its logical conclusion, built
around the question in its founding paper's title: can recursive
bisection *alone* produce routable placements? Its answers: use
state-of-the-art multilevel Fiduccia-Mattheyses bisection at every
level; propagate terminals rigorously; manage balance tolerances
dynamically (loose early for freedom, tight late for legality); handle
the end-case with exact or enumerative placers when regions shrink to a
few cells; and treat whitespace as a managed resource, distributing it
where congestion needs it rather than packing rows solid.

That last point made Capo famous for *routability*: placements that
routers could actually finish, at a time when denser-looking placements
from other tools drowned in overflow. Capo shipped as reliable open
source, became the standard academic baseline for a decade, and its
benchmarks and evaluation discipline (the same group drove standard
wirelength contests) shaped how placers are compared.

## The verdict history delivered

On pure wirelength, analytical placers eventually and decisively won:
smooth optimization simply sees more than recursive cutting. But Capo's
virtues, determinism, speed, congestion sanity, whitespace discipline,
migrated into the winners. Modern analytical flows quietly contain
min-cut ideas in their clustering and their density management.

## Where you meet it today

In the literature as the strongest min-cut reference, in courses as the
worked example of engineering a heuristic carefully, and in the design
of every benchmark suite it helped standardize.
""",
    },
    # ----- annealing -----
    {
        "slug": "timberwolf",
        "card": "Annealing for cell rows: random moves under a cooling schedule.",
        "level": "foundational",
        "name": "TimberWolf",
        "family": "annealing",
        "year": "1985",
        "who": "Sechen and Sangiovanni-Vincentelli",
        "chips": [
            ("diff-easy", "quality king of its era"),
            ("diff-hard", "runtime scales brutally"),
        ],
        "summary": (
            "The definitive simulated-annealing placer: cell moves and "
            "swaps across rows under a cooling schedule, with range "
            "windows shrinking as temperature falls."
        ),
        "lab": None,
        "refs": [
            ("Sechen and Sangiovanni-Vincentelli, 'The TimberWolf placement and routing package' (search)",
             "https://scholar.google.com/scholar?q=Sechen+Sangiovanni+TimberWolf+placement+routing+package"),
            ("Wikipedia: Simulated annealing",
             "https://en.wikipedia.org/wiki/Simulated_annealing"),
        ],
        "body": """
## The idea

Apply simulated annealing (see the Floorplanning catalog's engine page)
directly to cell placement. TimberWolf's move set: displace a random
cell to a random location within a *range window*; swap two cells; flip
a cell's orientation. Cost: estimated wirelength (half-perimeter per
net) plus penalties for row-length imbalance and overlap, all evaluated
incrementally per move. The critical part is the schedule: high initial
temperature, geometric cooling, and, TimberWolf's signature, the range
window shrinking with temperature, so early moves reorganize the chip
globally while late moves polish locally. Later versions refined the
schedule empirically and added row-based bookkeeping that kept
per-move evaluation cheap.

## Its reign and its ceiling

Through the late 1980s and the 1990s TimberWolf and its descendants
were the quality standard; when runtime was affordable, nothing beat a
long anneal, and version after version won benchmark comparisons. The
ceiling was arithmetic: acceptable schedules need move counts that grow
super-linearly with cell count, and at hundreds of thousands of cells
the wall-clock became indefensible against analytical methods that
solve for all positions simultaneously. Annealing retreated from
general placement to the niches where its indifference to cost-function
shape still wins.

## Where you meet it today

Detailed-placement refinement on small windows, macro packing and
analog placement (where cost functions are lumpy and object counts
small), FPGA (Field-Programmable Gate Array) placement in the classic
VPR (Versatile Place and Route) tool, and every course's placement
chapter as the canonical annealing case study.
""",
    },
    # ----- analytical -----
    {
        "slug": "proud",
        "card": "Treat nets as springs and solve for every cell position at once.",
        "level": "research",
        "name": "PROUD",
        "family": "analytical",
        "year": "1988",
        "who": "Tsay, Kuh, Hsu",
        "chips": [
            ("diff-easy", "quadratic solve at scale"),
            ("diff-medium", "needs fixed anchors"),
        ],
        "summary": (
            "Model nets as springs and solve the resulting sparse linear "
            "system for all cell coordinates at once, then partition and "
            "re-solve regionally. Analytical placement's opening move."
        ),
        "lab": None,
        "refs": [
            ("Tsay, Kuh, Hsu, 'PROUD: a sea-of-gates placement algorithm' (search)",
             "https://scholar.google.com/scholar?q=Tsay+Kuh+PROUD+sea-of-gates+placement"),
        ],
        "body": """
## The idea

Replace each multi-pin net with two-pin springs (a clique or star
model). Total squared wirelength becomes, per axis, the quadratic form

<div class="eq">Φ(x) = x'Qx − 2 b'x</div>

<ul class="eq-legend">
<li><code>x</code> vector of all movable cell coordinates (one axis at a time)</li>
<li><code>Q</code> sparse connectivity matrix: the graph Laplacian of the spring network</li>
<li><code>b</code> constant pull exerted by fixed objects: pads and pins</li>
</ul>

where Q is the sparse, symmetric, positive
semi-definite graph Laplacian of connectivity and b carries the pull of
*fixed* objects: pads and pins. Setting the gradient to zero gives a
sparse linear system; solving it (successive over-relaxation then,
preconditioned conjugate gradients now) yields, in one shot, the
placement minimizing squared wirelength. This is also the
physical equilibrium of a spring network, and the numerical linear
algebra scales to enormous netlists.

One catch defines everything after: without constraints, minimizing
springs collapses all cells toward the anchors' centroid, a placement
that is optimal and useless. PROUD's answer was hierarchical: solve
globally, split the die, assign cells to halves by their solved
coordinates, then re-solve each half with the other half's cells
projected onto the boundary as fixed anchors (terminal propagation,
analytically reborn), recursing until regions are small.

## Why it mattered

PROUD demonstrated that placement could be *numerics* instead of
combinatorics, at sea-of-gates scale, years before annealing hit its
wall. Its solve-partition-resolve loop is the direct template for
GORDIAN and the quadratic school that followed.

## Where you meet it today

As the historical opening of the lineage that leads through GORDIAN,
FastPlace, and ePlace to every modern placer's quadratic warm start.
""",
    },
    {
        "slug": "gordian",
        "level": "research",
        "name": "GORDIAN",
        "family": "analytical",
        "year": "1991",
        "who": "Kleinhans, Sigl, Johannes, Antreich",
        "chips": [
            ("diff-easy", "constraints, done right"),
            ("diff-medium", "quadratic pull to center"),
        ],
        "summary": (
            "Global quadratic optimization with explicit center-of-mass "
            "constraints per region, refined by recursive partitioning; "
            "final placement by slicing-style area assignment. The "
            "quadratic school's canonical form."
        ),
        "lab": None,
        "refs": [
            ("Kleinhans et al., 'GORDIAN: VLSI placement by quadratic programming and slicing optimization' (search)",
             "https://scholar.google.com/scholar?q=GORDIAN+VLSI+placement+quadratic+programming+slicing"),
        ],
        "body": """
## The idea

GORDIAN keeps PROUD's spring mathematics but disciplines the collapse
problem with *constraints* instead of pure recursion. Cells are
assigned (by partitioning) to regions; each region contributes a linear
constraint fixing the center of mass of its cells to the region's
center. Minimizing the global quadratic objective subject to these
constraints is still a linear-algebra problem (the constraints
eliminate variables), and crucially the optimization stays *global*:
every cell still feels every spring, unlike pure divide-and-conquer
where regions go blind to each other. As partitioning refines regions,
constraints multiply, and the continuous placement gradually
disciplines itself into spread-out form; a final step converts region
populations into a legal arrangement via slicing-style area assignment,
with linear wirelength re-optimization (GORDIAN-L) as a refinement.

## Why it is the reference point

The center-of-mass constraint is the cleanest early answer to
analytical placement's central question, how to reconcile smooth
wirelength with non-overlap, and the solve-partition-constrain-resolve
loop became the canonical architecture: BonnPlace and a generation of
quadratic placers are recognizably GORDIAN-shaped. Its separation of
concerns (global numerics for wirelength, combinatorial assignment for
area) is the same division modern placers keep, with density penalties
replacing hard constraints.

## Where you meet it today

In every lecture as *the* quadratic placement algorithm, and in the
architecture of successors: partitioning-constrained quadratic
placement remained industrially competitive well into the 2000s and
its skeleton is visible inside FastPlace, SimPL-class placers, and the
warm-start phases of current tools.
""",
    },
    {
        "slug": "kraftwerk",
        "level": "research",
        "name": "Kraftwerk (Force-Directed Placement)",
        "family": "analytical",
        "year": "1998",
        "who": "Eisenmann and Johannes",
        "chips": [
            ("diff-easy", "elegant physics"),
            ("diff-medium", "convergence needs care"),
        ],
        "summary": (
            "Add to the spring system an explicit spreading force "
            "computed from cell density via a Poisson equation, and "
            "iterate: each solve moves cells as if charged, until "
            "density evens out."
        ),
        "lab": None,
        "refs": [
            ("Eisenmann and Johannes, 'Generic global placement and floorplanning' (search)",
             "https://scholar.google.com/scholar?q=Eisenmann+Johannes+generic+global+placement+floorplanning"),
            ("Kraftwerk2 journal version (search)",
             "https://scholar.google.com/scholar?q=Spindler+Schlichtmann+Johannes+Kraftwerk2+force-directed"),
        ],
        "body": """
## The idea

Where GORDIAN spreads cells with constraints, Kraftwerk spreads them
with *forces*. Compute the current cell-density field over the die;
treat overfilled areas as positive charge; solve a Poisson equation to
get the potential this charge creates; its negative gradient is a
spreading force field. Add each cell's local spreading force to the
spring system as a constant pull and re-solve the quadratic; cells
migrate from dense areas toward empty ones. Recompute density, forces,
solve again; iterate until the density is acceptably even. Fixed
obstacles simply appear as permanent charge, so macros and blockages
repel cells with no special code.

The formulation is uniform: one mechanism handles
spreading, obstacle avoidance, and even timing weights (stronger
springs on critical nets). Kraftwerk2 later gave the scheme a firmer
footing (bound-to-bound net model making the quadratic model exact for
half-perimeter wirelength, and a better-behaved two-force iteration
with provable-flavored convergence behavior).

## Trade-offs

Against GORDIAN-style constraint refinement, force iteration is
simpler, faster per step, and more flexible; its risks are oscillation
and drift (forces are recomputed from stale density, and naive
schedules orbit instead of settling), which the second-generation
formulation largely tamed.

## Where you meet it today

Its density-as-potential idea, solved by fast Poisson methods, is the
direct ancestor of ePlace's electrostatics, today's dominant
formulation; and 'force-directed' remains the umbrella name for this
entire way of thinking about spreading.
""",
    },
    {
        "slug": "fastplace",
        "level": "research",
        "name": "FastPlace",
        "family": "analytical",
        "year": "2004",
        "who": "Viswanathan and Chu",
        "chips": [
            ("diff-easy", "order-of-magnitude speedups"),
        ],
        "summary": (
            "Quadratic placement made fast: a hybrid net model that "
            "kills clique blowup, cell shifting with anchor springs for "
            "spreading, and cheap local refinement, delivering "
            "competitive wirelength at a fraction of the runtime."
        ),
        "lab": None,
        "refs": [
            ("Viswanathan and Chu, 'FastPlace: efficient analytical placement using cell shifting, iterative local refinement and a hybrid net model' (search)",
             "https://scholar.google.com/scholar?q=Viswanathan+Chu+FastPlace+cell+shifting+hybrid+net+model"),
        ],
        "body": """
## The idea

By 2004 analytical placement's quality was established and its runtime
was the battleground. FastPlace attacked every cost center. The
*hybrid net model* replaces cliques on large nets with a star (one
virtual node) and keeps cliques only for small nets, provably
equivalent in the quadratic sense but collapsing the number of spring
terms from quadratic to linear in pin count, which alone transforms
solver time. *Cell shifting* handles spreading without heavy computation:
examine density row by row, stretch overfilled stripes so cells shift
toward whitespace, then add for each cell a light *anchor spring* to
its shifted position and re-solve; a few solve-shift rounds spread the
design smoothly. *Iterative local refinement* then trades squared for
real objectives: quick greedy moves of cells between neighboring bins
driven by half-perimeter wirelength gain.

## What it proved

Competitive wirelength at speedups reported as an order of magnitude or
more over contemporary annealing and min-cut placers, and the paper's
components became standard vocabulary: hybrid net models are simply how
quadratic placers are built now, and anchor-spring iteration became the
backbone of the SimPL/ComPLx generation (anchors to legalized shadow
placements) and of today's warm starts.

## Where you meet it today

Its net model and anchor mechanics are used in most placers' quadratic
phases; FastPlace itself, with its detailed-placement companion
FastDP, remained a widely used academic baseline for years.
""",
    },
    {
        "slug": "aplace-ntuplace",
        "level": "research",
        "name": "APlace and NTUplace (Log-Sum-Exp Placement)",
        "family": "analytical",
        "year": "2004",
        "who": "Kahng and Wang; Chen et al.",
        "chips": [
            ("diff-easy", "true wirelength, smoothed"),
            ("diff-medium", "nonlinear optimization"),
        ],
        "summary": (
            "Stop squaring: approximate half-perimeter wirelength "
            "directly with the smooth log-sum-exp function, add a "
            "bell-shaped density penalty, and descend with nonlinear "
            "optimization. The nonlinear school that closed the "
            "wirelength gap."
        ),
        "lab": None,
        "refs": [
            ("Kahng and Wang, 'Implementation and extensibility of an analytic placer (APlace)' (search)",
             "https://scholar.google.com/scholar?q=Kahng+Wang+APlace+analytic+placer"),
            ("Chen et al., 'NTUplace3: an analytical placer for large-scale mixed-size designs' (search)",
             "https://scholar.google.com/scholar?q=NTUplace3+analytical+placer+mixed-size"),
        ],
        "body": """
## The idea

Quadratic placement optimizes the wrong function: squared spring length
over-penalizes long nets and only approximates the half-perimeter
wirelength (HPWL) that flows actually care about. The nonlinear school
optimizes a *smoothed HPWL (Half-Perimeter Wire Length)* directly. Per
net, max(x) is approximated by the log-sum-exp function

<div class="eq">max(x) ≈ γ · log Σ exp(x_i / γ)</div>

<ul class="eq-legend">
<li><code>x_i</code> the pin coordinates of one net (per axis)</li>
<li><code>γ</code> smoothing parameter: smaller means closer to the true maximum, and sharper to optimize</li>
</ul>

(and min analogously), which is differentiable everywhere and approaches the true maximum as γ shrinks. Overlap is
handled by a smoothed density model: each cell spreads its area into
bins through a bell-shaped kernel, and a penalty term punishes bins
above target density. The sum, smoothed wirelength plus weighted
density penalty, is minimized by conjugate-gradient descent inside a
multilevel scheme (cluster, place, uncluster, refine), with the penalty
weight and γ tightened as placement matures.

## What it changed

APlace demonstrated the formulation's power by winning placement
contests of its era; NTUplace3 hardened it for mixed-size designs with
macros and legalization-aware refinements. Together they established
the template, objective-plus-penalty nonlinear optimization under a
multilevel schedule, that defines modern placement. ePlace kept exactly
this skeleton and swapped the density model for electrostatics; the
wirelength side today often uses the weighted-average smoothing as an
alternative to log-sum-exp, but the architecture is unchanged.

## Where you meet it today

As the direct parents of ePlace/RePlAce and DREAMPlace: the math in
those placers' wirelength gradients is this page's math, running on a
GPU (Graphics Processing Unit).
""",
    },
    {
        "slug": "mpl-multilevel",
        "level": "research",
        "name": "mPL (Multilevel Placement)",
        "family": "analytical",
        "year": "2000s",
        "who": "Chan, Cong, Sze, et al.",
        "chips": [
            ("diff-easy", "scale through hierarchy"),
        ],
        "summary": (
            "The multilevel V-cycle applied to placement itself: cluster "
            "the netlist, place coarse, interpolate down, and relax at "
            "every level with nonlinear optimization."
        ),
        "lab": None,
        "refs": [
            ("Chan, Cong, Sze, 'Multilevel generalized force-directed method for circuit placement' (search)",
             "https://scholar.google.com/scholar?q=Chan+Cong+Sze+multilevel+generalized+force-directed+placement"),
        ],
        "body": """
## The idea

The same medicine multilevel partitioning gave Fiduccia-Mattheyses,
administered to analytical placement. Build a hierarchy by clustering
(connectivity-driven, best-choice clustering in the mature versions);
place the coarsest netlist, where any optimizer is affordable;
*interpolate* positions down a level (declustered cells inherit and
perturb their cluster's location); relax with the level's optimizer
(mPL's lineage used generalized force-directed and nonlinear-
programming formulations with density control); repeat to the bottom.
Coarse levels make the global decisions cheaply; fine levels only
polish, so total runtime grows gently while quality benefits from the
long-range moves that flat descent struggles to discover.

## Why the paradigm stuck

Multilevel structure buys three things at once: speed (most iterations
run on small problems), stability (each level starts near a sensible
solution), and escape from local minima (a cluster move at level three
is a thousand-cell reorganization no flat local step would find). The
mPL series carried the flag through the placement-contest era with
consistently strong results, and the paradigm was absorbed wholesale:
APlace and NTUplace are multilevel, and modern GPU (Graphics
Processing Unit) placers keep a coarsening flavor in their multi-
resolution density grids.

## Where you meet it today

As the reason 'multilevel' is assumed background in every placement
paper since, and directly in tools whose ancestry passes through the
UCLA (University of California, Los Angeles) placement group's line.
""",
    },
    {
        "slug": "eplace",
        "level": "industry",
        "name": "ePlace (Electrostatic Placement)",
        "family": "analytical",
        "year": "2014",
        "who": "Lu, Chen, Chang, et al.",
        "chips": [
            ("diff-easy", "the modern formulation"),
            ("diff-easy", "Nesterov + FFT elegance"),
        ],
        "summary": (
            "Cells become positive charge, density becomes electric "
            "potential solved by fast Fourier transform, and Nesterov's "
            "accelerated gradient descends smoothed wirelength plus "
            "system energy. The formulation modern placement runs on."
        ),
        "lab": None,
        "refs": [
            ("Lu et al., 'ePlace: electrostatics-based placement using fast Fourier transform and Nesterov's method' (search)",
             "https://scholar.google.com/scholar?q=ePlace+electrostatics+placement+Nesterov+FFT"),
        ],
        "body": """
## The idea

ePlace perfected the density half of nonlinear placement with a physics
analogy carried to completion. Treat every cell (and every filler
element occupying whitespace) as positive charge proportional to its
area. The density constraint 'spread evenly' becomes the electrostatic
statement 'this charge system should reach zero potential energy'.
Solve Poisson's equation for the potential and field of the current
charge distribution, efficiently and exactly on a grid by fast Fourier
transform; each cell then feels a force, the field times its charge,
pushing it from crowded regions toward empty ones, including away from
macros (also modeled as charge). The total objective, smoothed
wirelength plus a weighted electrostatic energy, is minimized by
Nesterov's accelerated gradient method with a clever
Lipschitz-constant-based step size, the penalty weight rising steadily
so wirelength dominates early and legality dominates late.

## Why it won

Every ingredient is principled: the energy is a globally smooth,
well-behaved density measure (no bell-kernel locality artifacts), the
FFT (Fast Fourier Transform) makes each gradient evaluation
near-linear, and Nesterov acceleration converges in hundreds rather
than thousands of iterations. Benchmarks of its era showed clear
wirelength wins over the log-sum-exp-plus-bell-kernel generation, and
the formulation remained effective across mixed-size, large-macro, and
routability-driven variants.

## Where you meet it today

Directly: RePlAce (next page) is its tuned open-source descendant
inside OpenROAD, and DREAMPlace is this exact mathematics recast onto
GPUs (Graphics Processing Units). When someone says 'modern analytical
placement', they mean this.
""",
    },
    {
        "slug": "replace",
        "level": "industry",
        "name": "RePlAce",
        "family": "analytical",
        "year": "2018",
        "who": "Cheng, Kahng, Kang, Wang",
        "chips": [
            ("diff-easy", "OpenROAD's global placer"),
            ("diff-easy", "routability-driven"),
        ],
        "summary": (
            "ePlace hardened for practice: dynamic step control, "
            "density-function refinements, and routability-driven "
            "inflation, shipped open source and adopted as OpenROAD's "
            "global placement."
        ),
        "lab": None,
        "refs": [
            ("Cheng et al., 'RePlAce: advancing solution quality and routability validation in global placement' (search)",
             "https://scholar.google.com/scholar?q=RePlAce+advancing+solution+quality+routability+global+placement"),
            ("OpenROAD gpl (RePlAce) source",
             "https://github.com/The-OpenROAD-Project/OpenROAD"),
        ],
        "body": """
## The idea

RePlAce takes the ePlace formulation and does the unglamorous work that
separates a paper from a tool. Contributions include dynamic step-size
and density-penalty scheduling that adapt per iteration instead of
following a fixed script; a constraint-oriented local-density function
sharpening behavior near macros and dense regions; and, decisively for
practice, *routability-driven* placement: run a fast global-routing
congestion estimate periodically, inflate cells in congested tiles so
the electrostatic system naturally thins those regions, and iterate
until estimated overflow subsides. The result posted state-of-the-art
wirelength on standard benchmark suites while producing placements
routers could finish, and the code was released openly.

## Why you have already used it

This is `global_placement` in OpenROAD: the flow that grades this
site's real-tool problem runs RePlAce's descendant (the gpl module)
every time. Its target-density knob is exactly the `-density` argument
discussed in this site's placement-density problem, and its congestion
feedback is why lowering density relieves overflow there.

## Where you meet it today

In every OpenROAD-flow-scripts run, as the standard open baseline in
placement research, and as the immediate ancestor of the GPU (Graphics
Processing Unit) generation: DREAMPlace began life by reimplementing
exactly this optimization as a neural-network-style computation graph.
""",
    },
    {
        "slug": "dreamplace",
        "level": "industry",
        "name": "DREAMPlace",
        "family": "analytical",
        "year": "2019",
        "who": "Lin, Pan, et al.",
        "chips": [
            ("diff-easy", "30x+ GPU speedups"),
            ("diff-easy", "placement as deep learning"),
        ],
        "summary": (
            "The observation that analytical placement's math is the "
            "math of training a neural network, so run it on GPU deep "
            "learning infrastructure: same quality, tens of times "
            "faster."
        ),
        "lab": None,
        "refs": [
            ("Lin et al., 'DREAMPlace: deep learning toolkit-enabled GPU acceleration for modern VLSI placement' (search)",
             "https://scholar.google.com/scholar?q=DREAMPlace+deep+learning+toolkit+GPU+acceleration+placement"),
            ("DREAMPlace source repository",
             "https://github.com/limbo018/DREAMPlace"),
        ],
        "body": """
## The idea

Look at ePlace's inner loop with a machine-learning engineer's eyes:
millions of parameters (cell coordinates), a differentiable scalar
objective (smoothed wirelength plus electrostatic energy), gradient
descent with momentum-like acceleration. That *is* neural-network
training, minus the network. DREAMPlace therefore implements placement
inside a deep-learning toolkit: coordinates become the trainable
tensor, wirelength and density become custom differentiable operators
(with hand-written CUDA (Compute Unified Device Architecture) kernels
for the net-model gradients and the FFT (Fast Fourier Transform)
Poisson solve), and the framework's optimizers and infrastructure do
the rest.

The result is reproducible: same solution quality as
RePlAce, speedups reported around thirty times and beyond on large
designs, turning multi-hour global placements into minutes. And
because the implementation *is* a differentiable pipeline, research
riffs come cheap: new objectives (timing, routability terms) are new
loss functions; later versions added GPU-accelerated detailed
placement and legalization stages.

## Why it matters beyond speed

It reframed placement culturally: EDA (Electronic Design Automation)
algorithms as differentiable programs on commodity accelerator
infrastructure, opening the door to hybrid schemes where learned
models and classical optimization share one computation graph. Much of
current machine-learning-for-placement research builds directly on
this codebase.

## Where you meet it today

The open-source repository is actively developed and widely forked;
its ideas are visibly absorbed into vendor tools' GPU placement
offerings.
""",
    },
    # ----- legalization -----
    {
        "slug": "tetris-legalization",
        "card": "Sort cells, then drop each into the nearest free legal slot.",
        "level": "foundational",
        "name": "Tetris Legalization",
        "family": "legalization",
        "year": "2002",
        "who": "Hill",
        "chips": [
            ("diff-easy", "simple and fast"),
            ("diff-medium", "greedy displacement"),
        ],
        "summary": (
            "Sort cells (typically by x), then place each in turn at the "
            "nearest legal free slot across the rows, like dropping "
            "Tetris pieces. Crude, quick, everywhere."
        ),
        "lab": None,
        "refs": [
            ("Hill, patent/description of the Tetris-style legalizer (search)",
             "https://scholar.google.com/scholar?q=Tetris+legalization+placement+Hill"),
        ],
        "body": """
## The idea

Global placement ends with cells hovering in continuous positions,
overlapping freely. Tetris legalization makes them legal with the
simplest scheme that works. Sort all cells, usually left to right by
their global x-coordinate. Process them in order; for each cell, scan
candidate rows near its desired y, find in each the leftmost legal free
interval at or right of the frontier, and commit the cell to the
position minimizing its displacement. Because cells are placed in
sorted order and each row fills monotonically, bookkeeping is a per-row
frontier pointer: the pass runs in near-linear time, and the
falling-blocks feel of cells sliding into the next free slot earned the
name.

## Trade-offs

Speed and reliability are the method's strengths: it always terminates, handles any mess
the global placer emits, and is trivial to implement correctly. The
weakness is quality: decisions are greedy and irrevocable, so a locally
convenient slot for an early cell can force a chain of large
displacements later, and wirelength damage concentrates unpredictably.
In dense designs the frontier can also drift rightward, smearing the
placement. Hence the standard pairing: Tetris (or a sibling) for a
fast first legalization, then Abacus-style or window-based refinement
to repair the damage.

## Where you meet it today

As the quick legalizer inside countless flows and teaching codebases,
as the standard 'baseline legalizer' in papers, and conceptually
whenever someone needs any-legal-solution-now before optimizing.
""",
    },
    {
        "slug": "abacus",
        "level": "industry",
        "name": "Abacus",
        "family": "legalization",
        "year": "2008",
        "who": "Spindler, Schlichtmann, Johannes",
        "chips": [
            ("diff-easy", "row-optimal placement"),
            ("diff-easy", "quadratic-programming clusters"),
        ],
        "summary": (
            "Legalize cell by cell, but within each candidate row solve "
            "exactly: cluster colliding cells and position clusters to "
            "minimize total squared displacement by dynamic programming "
            "over merges."
        ),
        "lab": None,
        "refs": [
            ("Spindler, Schlichtmann, Johannes, 'Abacus: fast legalization of standard cell circuits with minimal movement' (search)",
             "https://scholar.google.com/scholar?q=Abacus+fast+legalization+standard+cell+minimal+movement"),
        ],
        "body": """
## The idea

Abacus keeps Tetris's outer loop (sort cells by x, insert one at a
time, try rows near the target) but replaces the greedy 'nearest free
slot' with an exact inner solution. When a cell is inserted into a
row, place every cell in that row optimally, in order, minimizing the
sum of squared displacements from desired positions. This is solvable
exactly and incrementally by *clustering*: a new cell wants its
desired x; if it would overlap its left neighbor cluster, merge them,
and the merged cluster's optimal position is a weighted average of its
members' desires (the quadratic optimum), possibly cascading further
merges leftward. Each insertion is amortized cheap; the row is always
optimally packed for the current membership; the cell finally commits
to whichever candidate row yielded the smallest cost.

## Why it became the default

Displacement drops dramatically versus Tetris (the paper reports large
average-movement reductions), which preserves the global placer's
carefully optimized wirelength and timing intent; runtime stays
near-linear in practice; and the algorithm is compact enough to
implement in an afternoon. It slots cleanly after any analytical
placer.

## Where you meet it today

Abacus or a close variant is the standard-cell legalizer in most
academic flows and many production ones; OpenROAD's detailed placer
performs Abacus-style row legalization before its optimization passes.
Its cluster-merge mathematics also reappears in single-row
optimization inside detailed placement.
""",
    },
    {
        "slug": "detailed-placement",
        "level": "industry",
        "name": "Detailed Placement Optimization",
        "family": "legalization",
        "year": "1990s onward",
        "who": "many; e.g. FastDP, Domino",
        "chips": [
            ("diff-easy", "the last percent"),
            ("diff-medium", "a bag of local methods"),
        ],
        "summary": (
            "After legality: local swaps, single-row dynamic "
            "programming, independent-set matching, and window "
            "re-placement, iterated until wirelength stops improving."
        ),
        "lab": None,
        "refs": [
            ("Pan, Viswanathan, Chu, 'An efficient and effective detailed placement algorithm (FastDP)' (search)",
             "https://scholar.google.com/scholar?q=Pan+Viswanathan+Chu+FastDP+detailed+placement"),
            ("Doll, Johannes, Antreich, 'Iterative placement improvement by network flow methods (Domino)' (search)",
             "https://scholar.google.com/scholar?q=Domino+iterative+placement+improvement+network+flow"),
        ],
        "body": """
## The idea

Once cells are legal, a family of local optimizations grinds out the
remaining wirelength, each attacking a different move structure:

- **Global swap / vertical swap**: for each cell, compute its optimal
  region (the median box of its connected pins); if a better position
  there exists, swap with the occupant or shift into whitespace.
- **Local reordering**: within a window of a few consecutive cells in
  one row, try all permutations and keep the best.
- **Single-row optimization**: fix cell order in a row and solve
  positions exactly (the Abacus clustering mathematics, or linear-time
  slack redistribution) to minimize wirelength with cells sliding
  within free space.
- **Independent-set matching**: find many mutually non-interacting
  cells of equal width, then solve their optimal one-to-one assignment
  to their current slot set as a bipartite matching, achieving a
  simultaneous multi-cell move no greedy pass would find.
- **Window rip-up and re-place (Domino style)**: free all cells in a
  small region and re-place them optimally via network-flow or
  enumeration.

Engines like FastDP orchestrate these in converging rounds; modern
variants add timing awareness (weight nets by criticality) and
routability terms (respect cell padding and pin-access spacing).

## Why it matters

Individually tiny, collectively decisive: detailed placement routinely
recovers several percent of wirelength and fixes the local pathologies
(pin-access conflicts, row-end congestion) that global optimization
cannot see. In OpenROAD this is the `detailed_placement` step (the dpl
module, with its own swap and reordering passes).

## Where you meet it today

Every flow, every tool, immediately after legalization, and again
after any engineering change order touches the placement.
""",
    },
]
