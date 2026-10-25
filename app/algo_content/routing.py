"""Routing algorithm catalog: grid search, line search, Steiner trees,
negotiated congestion, and the historical channel routers. The maze
(grid) search family runs live in the maze lab."""

STAGE = {
    "slug": "routing",
    "name": "Routing",
    "tagline": (
        "How a production router works, in flow order: the two-pass "
        "architecture, the global pass that plans corridors, the "
        "detailed pass that lays exact wires, the rip-up loop both "
        "converge on, and the sign-off repairs that follow. The "
        "foundations and history sit at the bottom, and the classic "
        "search kernels run live in the maze lab."
    ),
    "families": [
        {
            "id": "architecture",
            "short": "architecture",
            "name": "The architecture: two passes",
            "lead": (
                "Read this first. Production routing is a coarse "
                "capacity-planning pass followed by an exact track-level "
                "pass; every algorithm below belongs to one of them or "
                "spans both."
            ),
        },
        {
            "id": "global",
            "short": "global",
            "name": "Global routing: planning the corridors",
            "lead": (
                "The die coarsened into GCells, every net a tree, every "
                "tree a corridor priced against congestion. This pass "
                "decides where wires go, which layers they ride, and "
                "which regions are in trouble, long before any track "
                "exists."
            ),
        },
        {
            "id": "detailed",
            "short": "detailed",
            "name": "Detailed routing: exact wires in the corridors",
            "lead": (
                "Inside each corridor, real tracks, real vias, and the "
                "full design-rule deck. Bulk assignment first, "
                "point-to-point search for the rest, and a gridless "
                "escape hatch for what the track lattice cannot express."
            ),
        },
        {
            "id": "loop",
            "short": "rip-up loop",
            "name": "The universal loop: rip-up and reroute",
            "lead": (
                "Both passes converge the same way: route everything, "
                "find the conflicts, tear out and re-route until the "
                "count reaches zero. This is the iteration a PD "
                "(Physical Design) engineer watches in the log."
            ),
        },
        {
            "id": "signoff",
            "short": "sign-off",
            "name": "After routing: sign-off repairs",
            "lead": (
                "Checks that run on the finished routing and the "
                "repairs that clear them. Not searches, but algorithms "
                "every tape-out runs, and the physics is manufacturing "
                "rather than operation."
            ),
        },
        {
            "id": "historical",
            "short": "history",
            "name": "Foundations and history",
            "lead": (
                "Everything above is what production routers do. This "
                "section is where it came from: the maze-search kernels "
                "A* (A-star) descends from (all live in the maze lab), the "
                "line-search routers of the memory-starved era, and the "
                "channel routers built when wires could not cross the "
                "cell rows. Read for lineage and interviews, not for the "
                "flow."
            ),
        },
    ],
}

_LAB = "/explore/algorithms/maze-router"

ALGORITHMS = [
    {
        "slug": "global-detailed-routing",
        "card": "Plan corridors on a coarse grid, then draw exact wires in them.",
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "scope": "both",
        "level": "industry",
        "name": "Global + Detailed Routing (the Two-Pass Flow)",
        "family": "architecture",
        "year": "modern flow",
        "who": "FastRoute, TritonRoute, and peers",
        "chips": [
            ("diff-easy", "how real tools do it"),
        ],
        "summary": (
            "Plan capacity on a coarse grid over the whole metal stack, "
            "then assign exact tracks and vias under the full design "
            "rules: the division of labor every modern router uses."
        ),
        "lab": None,
        "refs": [
            ("OpenROAD (FastRoute-based global router and TritonRoute detailed router)",
             "https://github.com/The-OpenROAD-Project/OpenROAD"),
            ("TritonRoute: an initial detailed router for advanced VLSI technologies (search)",
             "https://scholar.google.com/scholar?q=TritonRoute+initial+detailed+router+advanced+technologies"),
        ],
        "body": """
## The idea

Routing a billion-cell grid across fifteen metal layers in one search
is hopeless, so production flows split the problem by resolution.

<div class="walk-fig" data-walk="twopass-idea"></div>

**Global routing** overlays a coarse grid (GCells, thousands of tracks
abstracted into per-edge capacities), decomposes every multi-pin net
into Steiner segments (FLUTE), and assigns each segment a
coarse-grained path with congestion-negotiated costs, PathFinder
economics over the GCell graph, with layers, vias, and preferred
directions priced in. Its outputs are route *guides*: corridors per
net, plus the congestion maps that placement iterates against.

**Detailed routing** then works within the guides, clip by clip: the
die is partitioned into windows of a few GCells each, and the search
runs inside one clip at a time, many in parallel, with everything
outside a clip treated as fixed context. It assigns exact tracks,
exact via positions, and exact geometry under the full weight of the
design rules, spacing tables, end-of-line rules, via enclosures, and
at advanced nodes far stranger constraints. An A*-family point search
over the track graph does the pathfinding; a rip-up-and-reroute loop
driven by DRC (Design Rule Check) violation counts grinds the layout
legal over dozens of iterations, shifting the clip origins between
iterations so that violations on clip seams land mid-clip the next
time. The figure above walks why this windowing is both necessary and
sound.

## Watch it work: coarse plan, exact finish

One multi-pin net and one two-pin net on a 10 x 10 GCell grid, with
a macro blocking their crossing except two gaps. Every step of the
global pass, from FLUTE (Fast Lookup Table Estimation) decomposition
through the PathFinder negotiation to the frozen guides, with every
number computed from the stated costs. The gap arithmetic mirrors the
PathFinder and ILP (Integer Linear Programming) pages: one mechanism,
three levels.

<div class="walk-fig" data-walk="twopass"></div>

## Pros, cons, and the trade-off

<div class="pros-cons">
<div class="pc-card pc-pros">
<h3>Strengths</h3>
<ul>
<li><strong>The only known road to scale</strong>: coarse capacity planning plus windowed exact legality is how billions of segments become tractable.</li>
<li><strong>Right information at each level</strong>: global sees congestion everywhere coarsely; detailed sees one window sharply under full rules.</li>
<li><strong>Placement feedback</strong>: global's congestion maps drive routability-aware placement long before detail exists.</li>
<li><strong>Parallelism</strong>: detailed routing partitions naturally into regions routed concurrently.</li>
</ul>
</div>
<div class="pc-card pc-cons">
<h3>Weaknesses</h3>
<ul>
<li><strong>Abstraction mismatch</strong>: GCell capacities approximate real rules, so guides sometimes promise what tracks cannot deliver, surfacing as late violations.</li>
<li><strong>Handoff information loss</strong>: decisions optimal at coarse resolution can be locally poor; repair loops pay for it.</li>
<li><strong>Two engines to maintain</strong>: distinct codebases, cost models, and failure modes that must stay consistent.</li>
<li><strong>Guide rigidity</strong>: detailed routers must occasionally violate or renegotiate guides, complicating both sides.</li>
</ul>
</div>
</div>

<div class="tradeoff-box">
<h3>The trade-off</h3>
<p>The two-pass split is a deliberate act of information hiding: solve congestion where the whole chip is visible but rules are not, then solve legality where rules are total but vision is local. The seam between the passes costs iterations, and no one has found a cheaper place to put the seam.</p>
</div>

## Is it actually used today?

The two-pass architecture is documented in every
routing tool, open source and commercial: separate commands, separate
reports.

- <strong>Open source</strong>: `global_route` and `detailed_route` in
  OpenROAD are [FastRoute](https://openroad.readthedocs.io/en/latest/main/src/grt/README.html) lineage and [TritonRoute](https://openroad.readthedocs.io/en/latest/main/src/drt/README.html) respectively; every
  OpenROAD-flow-scripts run on this site's real-tool problems executes
  exactly this handoff.
- <strong>Commercial</strong>: every production sign-off flow runs the
  same architecture under proprietary names.
- <strong>Watch it</strong>: in any routing log, the global overflow
  report followed by detailed routing's violations shrinking per
  iteration is the two passes handing off in real time.
""",
    },
    {
        "slug": "steiner-flute",
        "card": "Shortest tree for a multi-pin net, built fast from lookup tables.",
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "scope": "global",
        "level": "industry",
        "name": "Rectilinear Steiner Trees and FLUTE",
        "family": "global",
        "year": "2004-2008",
        "who": "Chu and Wong (FLUTE); Hanan, Hwang (theory)",
        "chips": [
            ("diff-medium", "NP-hard exactly"),
            ("diff-easy", "near-optimal in microseconds"),
        ],
        "summary": (
            "The minimum-wirelength tree connecting a multi-pin net may "
            "add junction points that are not pins. Exact is NP-hard "
            "(Non-deterministic Polynomial hard); FLUTE's lookup tables "
            "made near-optimal trees effectively free."
        ),
        "lab": None,
        "refs": [
            ("Wikipedia: Rectilinear Steiner tree",
             "https://en.wikipedia.org/wiki/Rectilinear_Steiner_tree"),
            ("FLUTE project page (Chu, Iowa State University)",
             "https://home.engineering.iastate.edu/~cnchu/flute.html"),
        ],
        "body": """
## The idea

Connect n pins with rectilinear wire of minimum total length. The
optimum may add *Steiner points*: junctions at none of the pins (a
plus-sign junction joining four pins beats any pin-to-pin chaining).
Hanan's theorem restricts the candidates to the grid of the pins' x
and y coordinates; exact optimization is still NP-hard
(Non-deterministic Polynomial hard), with the exact solver
[GeoSteiner](http://www.geosteiner.com) practical into the tens of
pins.


## FLUTE's move

Real netlists are dominated by low-degree nets, and FLUTE (Fast LookUp
Table Estimation) exploits exactly that. For every pin count up to
nine, all *positional orderings* of pins fall into finitely many
groups; FLUTE precomputes, per group, the small set of potentially
optimal tree topologies as wirelength vectors. At runtime: sort the
pins, look up the group, evaluate a handful of vectors, emit the best
tree, microseconds per net, optimal for up to nine pins and
near-optimal beyond via recursive net breaking.

## The recipe

**Step 1 (canonicalize).** Sort the net's pins and reduce their
coordinates to the *position sequence* that captures only their
relative order: nets with the same relative order share the same
optimal tree shapes, whatever their absolute coordinates.

**Step 2 (look up).** Use the position sequence to index the
precomputed table, which stores, for every relative order up to 9
pins, the handful of potentially-optimal tree topologies as
wirelength formulas in the pin coordinates.

**Step 3 (evaluate and pick).** Evaluate each candidate formula with
the actual coordinates and keep the cheapest: an exact RSMT
(Rectilinear Steiner Minimal Tree) for up to 9 pins, in microseconds,
with the NP (Nondeterministic Polynomial time) hard search computed in advance
when the table was built.

**Step 4 (break big nets).** For more than 9 pins, split the net
into overlapping groups of at most 9, solve each by lookup, and
merge: near-optimal in practice.

## Where the choice comes from: the table

The table below is an illustrative mock of FLUTE's stored data for the
four-pin configuration used in the walkthrough (pins at (7,1), (2,5),
(12,5), (7,9)). Sorting the coordinates gives x = (2, 7, 7, 12) and
y = (1, 5, 5, 9); the positional ordering of the pins selects a group,
and the group stores a small set of candidate topologies as wirelength
formulas over sorted-coordinate differences. At runtime each formula
is evaluated and the minimum is selected.

<table>
<thead>
<tr><th>Candidate topology</th><th>Stored wirelength formula</th><th>Evaluated here</th><th></th></tr>
</thead>
<tbody>
<tr><td>Pin-to-pin chain, no junction</td><td>(x4 − x1) + 2(y2 − y1) + (y4 − y1)</td><td>26</td><td></td></tr>
<tr><td>Trunk along y1 with three stubs</td><td>(x4 − x1) + (y2 − y1) + (y3 − y1) + (y4 − y1)</td><td>26</td><td></td></tr>
<tr><td>Cross junction at (x2, y2)</td><td>(x4 − x1) + (y4 − y1)</td><td>18</td><td><strong>selected</strong></td></tr>
</tbody>
</table>

The real table differs only in scale and encoding: all potentially
optimal topologies per group are precomputed (there are finitely many
for each degree up to nine), stored as coefficient vectors, and
evaluated in a few additions per candidate. The choice of tree is
therefore a table lookup plus a minimum, not a search.

This resolves the apparent conflict with NP-hardness
(Non-deterministic Polynomial hardness). Hardness is a statement
about growth with pin count; for any fixed degree the problem is
finite, and the table construction solves it exhaustively once,
offline. Nets of degree nine or below therefore receive the exact
optimum at runtime; approximation enters only through net breaking
for higher-degree nets.

## Watch it work: why junctions win

Four pins, one net. Watch the Hanan grid appear, the best pin-to-pin spanning tree get measured, and one Steiner junction beat it by 30 percent.

<div class="walk-fig" data-walk="steiner"></div>

## Different pins, different trees

The gallery below computes every tree it shows. Two five-pin
configurations receive different optimal topologies because their
positional orderings select different table groups; an eight-pin net
is solved by net breaking; and a final frame places a macro on the
plane to show the division of labor: the table's topology is
obstacle-blind, and the router re-embeds blocked segments around the
obstacle, paying measured extra length.

<div class="walk-fig" data-walk="steiner-gallery"></div>

## Pros, cons, and the trade-off

<div class="pros-cons">
<div class="pc-card pc-pros">
<h3>Strengths</h3>
<ul>
<li><strong>Effectively free</strong>: microseconds per net; wirelength-optimal through nine pins, near-optimal beyond.</li>
<li><strong>The enabling primitive</strong>: global routing, placement wirelength estimation, and congestion maps all stand on cheap Steiner trees.</li>
<li><strong>Deterministic and simple to integrate</strong>: a lookup and a few comparisons; no search, no tuning.</li>
<li><strong>Theory-backed</strong>: Hanan's grid limits the candidates, and Hwang's bound guarantees even a plain spanning tree is within 50 percent of optimal (a few percent in practice).</li>
</ul>
</div>
<div class="pc-card pc-cons">
<h3>Weaknesses</h3>
<ul>
<li><strong>Degree ceiling</strong>: past nine pins the table ends; recursive net breaking is good but no longer near-exact.</li>
<li><strong>Pure wirelength objective</strong>: timing-critical nets want shallow or buffered topologies, which need different constructions.</li>
<li><strong>Congestion-blind</strong>: topologies are chosen before routing knows where the crowds are; routers must bend or rebuild the tree afterward.</li>
<li><strong>Rectilinear only</strong>: diagonal-capable technologies need other techniques.</li>
</ul>
</div>
</div>

<div class="tradeoff-box">
<h3>The trade-off</h3>
<p>Decompose-then-route is an approximation everybody accepts: fix a near-optimal tree topology cheaply, then route its two-pin edges with the maze router. FLUTE made the first half so cheap that the approximation became the universal architecture.</p>
</div>

## Is it actually used today?

The evidence for Steiner-tree construction spans every stage of the
physical-design flow, open source and commercial.

- <strong>Global routing</strong>: [FastRoute](https://openroad.readthedocs.io/en/latest/main/src/grt/README.html) inside OpenROAD decomposes
  every multi-pin net through FLUTE-style Steiner topologies before
  routing segments; commercial global routers do the equivalent.
- <strong>Placement and estimation</strong>: placers and congestion
  estimators call Steiner evaluators millions of times per run;
  FLUTE's cost profile is what makes that affordable.
- <strong>Research baselines</strong>: [GeoSteiner](http://www.geosteiner.com) remains the exact-optimum
  reference against which heuristic trees are scored.
""",
    },
    {
        "slug": "pattern-routing",
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "scope": "global",
        "level": "industry",
        "name": "Pattern Routing",
        "family": "global",
        "year": "2000",
        "who": "Kastner, Bozorgzadeh, Sarrafzadeh; Pan and Chu (FastRoute)",
        "chips": [
            ("diff-easy", "constant work per net"),
        ],
        "summary": (
            "Route most nets from a tiny library of fixed shapes, L and "
            "Z patterns priced against the congestion map, and fall back "
            "to maze search only for the few nets no pattern fits. The "
            "reason global routing is fast."
        ),
        "lab": None,
        "refs": [
            ("Kastner, Bozorgzadeh, Sarrafzadeh, 'Pattern routing' (search)",
             "https://scholar.google.com/scholar?q=Kastner+pattern+routing+predictable"),
            ("FastRoute in OpenROAD (grt)",
             "https://openroad.readthedocs.io/en/latest/main/src/grt/README.html"),
        ],
        "body": """
## The idea

A maze or A* (A-star) search earns its cost when the route is hard,
but most nets are not hard: on a mostly open die, the best route
between two pins is almost always a straight line, a single-bend L,
or a two-bend Z. Pattern routing takes that observation literally.
Instead of searching the grid, it enumerates a fixed library of
candidate shapes between the pins, prices each against the current
congestion map, and commits the cheapest:

<div class="eq">cost(candidate) = wirelength + sum of price(cell) over cells crossed</div>
<ul class="eq-legend">
<li><code>wirelength</code> cells the shape occupies; every 1-bend and 2-bend candidate between two pins has the same, minimal wirelength</li>
<li><code>price(cell)</code> congestion penalty from nets already routed, the same negotiated prices the PathFinder family maintains</li>
</ul>

Because every candidate already has minimal wirelength, the
congestion penalties alone separate them: the pattern that threads
between crowded regions wins.

## The recipe

**Step 1 (enumerate).** Generate the candidates: the two L shapes
(one bend, at either corner of the pins' bounding box) and the Z
shapes (two bends, one per intermediate column or row).

**Step 2 (price).** Evaluate each candidate's cost with the equation
above: a walk over its cells, no queue and no wavefront. The work
per candidate is constant in the region's size.

**Step 3 (commit or escalate).** Commit the cheapest candidate and
add its usage to the congestion map. If every candidate is blocked
or exceeds a congestion threshold, hand the net to a real maze or
A* (A-star) search: patterns for the bulk, search for the few.

## Watch it work: pricing the shape library

One net, a congestion map from earlier nets (red cells, +2 each),
and the candidate library priced one family per step: the two Ls,
then the Zs, then the commit. Every cost in the captions is computed
from the map.

<div class="walk-fig" data-walk="pattern-route"></div>

## Pros, cons, and the trade-off

<div class="pros-cons">
<div class="pc-card pc-pros">
<h3>Strengths</h3>
<ul>
<li><strong>Speed</strong>: constant work per net for the vast majority of nets; the reason global routers finish in minutes, not days.</li>
<li><strong>Predictability</strong>: a pattern's shape is known before routing, so wirelength and timing estimates made at placement hold.</li>
<li><strong>Composes with negotiation</strong>: pattern costs read the same congestion prices rip-up iterations maintain, so the two machineries share one currency.</li>
<li><strong>Trivially parallel</strong>: nets price their candidates independently.</li>
</ul>
</div>
<div class="pc-card pc-cons">
<h3>Weaknesses</h3>
<ul>
<li><strong>Blind outside its library</strong>: a net whose best route needs three bends is invisible to the pattern set; only the fallback saves it.</li>
<li><strong>Fallback cliff</strong>: in dense regions the fallback rate climbs and the speed advantage erodes.</li>
<li><strong>Quality ceiling</strong>: committing shapes net by net can lock in congestion that a global view would have avoided; rip-up iterations must repair it.</li>
</ul>
</div>
</div>

<div class="tradeoff-box">
<h3>The trade-off</h3>
<p>Pattern routing bets that routing cost is concentrated in a small fraction of nets, and wins the bet on real designs: the easy majority is dispatched by arithmetic, and the full price of search is paid only where search earns it. It is the scheduling insight of the two-pass flow applied one level down.</p>
</div>

## Is it actually used today?

The evidence for pattern routing comes from open-source global
routers, commercial architecture and patents, and the academic
lineage.

- <strong>Open source</strong>: [FastRoute](https://openroad.readthedocs.io/en/latest/main/src/grt/README.html), the global router inside OpenROAD,
  routes nets by L and Z patterns with congestion-priced selection,
  escalating to monotonic and maze routing only under congestion.
- <strong>Commercial</strong>: inferred, not verified. The global
  routers in Innovus, Fusion Compiler, and Aprisa do not publish
  their internals; what is public is that they run congestion-driven,
  negotiation-style global routing with cheap early passes and
  expensive escalation, and that vendor patents describe
  pattern-based candidate routing. That the fast early pass is
  literally L and Z enumeration is a reasonable inference from the
  architecture and the academic lineage, not a documented fact.
- <strong>The lineage</strong>: Kastner, Bozorgzadeh, and
  Sarrafzadeh's pattern-routing work (2000) framed the predictability
  argument; FastRoute (2006 onward) made the pattern-first pyramid
  the standard architecture.
""",
    },
    {
        "slug": "pathfinder",
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "scope": "global",
        "level": "industry",
        "name": "PathFinder Negotiated Congestion",
        "family": "global",
        "year": "1995",
        "who": "McMurchie and Ebeling",
        "chips": [
            ("diff-easy", "converges in practice"),
            ("diff-easy", "principled pricing"),
        ],
        "summary": (
            "Let every net route through congestion at first, but make "
            "each resource's price grow with present and historical "
            "overuse; nets with alternatives get priced out, and the "
            "net that truly needs a resource outbids the rest."
        ),
        "lab": None,
        "refs": [
            ("McMurchie and Ebeling, 'PathFinder: a negotiation-based performance-driven router for FPGAs' (ACM)",
             "https://dl.acm.org/doi/10.1145/201310.201328"),
        ],
        "body": """
## The idea

Rip-up and reroute with the economics made explicit. Every routing
resource (a wire segment, a grid edge) carries a cost with three
factors: its base cost, a *present congestion* multiplier that grows
with how many nets currently occupy it beyond capacity, and a
*historical congestion* term that accumulates a little every iteration
the resource stays overused. Each iteration, every net is ripped and
re-routed by shortest path (an A*-family search) under current prices,
overuse temporarily permitted. Early on, prices are gentle: nets take
their ideal paths and pile up. As iterations proceed, contested
resources grow expensive; nets with good alternatives peel away
voluntarily; the history term ensures chronically contested resources
stay pricey even when momentarily free, breaking the oscillations that
plague naive rip-up. What remains on a scarce resource is the net that
values it most, precisely the negotiation the name promises.

## Watch it work: prices doing the planning

Three nets and two routing resources: the preferred gap A, capacity
one, and the longer alternative gap B, two tracks wide (rows 2 and 3),
capacity two: enough for every net that ends up there to have its own
crossing cell. The
right panel shows each resource's current price, usage, and overuse.
Every decision in the animation is computed from one stated model:

<div class="eq">cost(net, gap) = detour(net, gap) + price(gap)</div>
<ul class="eq-legend">
<li><code>detour</code> extra wirelength the net pays to reach that gap, fixed by geometry (derived below)</li>
<li><code>price(gap)</code> price(A) starts at 0 and rises by 2 × overuse after each iteration; gap B is never overused, so price(B) stays 0</li>
</ul>

### Where the detour numbers come from

Both pins of each net sit on a single row, and the wall admits
crossings only at gap A (a single track on row 6) and gap B (two
tracks, on rows 2 and 3). To cross on a track that is not the net's
own row, a net must leave its row to reach the track, cross, and come
back. Each row of offset costs one step down and one step back up, so
the extra wirelength over the straight, wall-free path is twice the
row offset:

<div class="eq">detour(net, track) = 2 × |row(net) − row(track)|</div>
<ul class="eq-legend">
<li><code>row(net)</code> the row the net's two pins share (N1: row 5, N2: row 7, N3: row 3)</li>
<li><code>row(track)</code> the row the net crosses the wall on (gap A: row 6; gap B: rows 2 and 3, one net per track)</li>
<li><code>2 ×</code> one departure from the net's row plus one return after crossing</li>
</ul>

For N1 on row 5, that gives 2 × |5 − 6| = 2 through gap A. Inside
gap B, N3 sits level with the row 3 track (2 × |3 − 3| = 0, it
crosses without leaving its row) and claims it every iteration, so
the track gap B offers N1 is row 2: 2 × |5 − 2| = 6. N3's pair
therefore flips relative to N1's: 6 through A, 0 through B. These
detours are pure
geometry; negotiation never changes them, it only changes the prices
added on top. The animation derives the numbers on N1's first
decision step: both candidate paths are drawn (chosen path solid,
rejected path dashed) with row numbers labeled along the left edge.

Each net independently picks the cheaper gap at the posted price. The
captions show every net's arithmetic per iteration; convergence and
the winner follow from the numbers.

<div class="walk-fig" data-walk="pathfinder"></div>

## Pros, cons, and the trade-off

<div class="pros-cons">
<div class="pc-card pc-pros">
<h3>Strengths</h3>
<ul>
<li><strong>Principled pricing</strong>: present plus historical congestion costs solve the oscillation problem that naive rip-up cannot.</li>
<li><strong>Reliable in practice</strong>: converges dependably on real FPGA (Field-Programmable Gate Array) and chip workloads.</li>
<li><strong>Timing-driven naturally</strong>: critical nets simply negotiate harder through cost weighting.</li>
<li><strong>Parallelizable</strong>: nets route independently within an iteration, which modern multi-core routers exploit.</li>
</ul>
</div>
<div class="pc-card pc-cons">
<h3>Weaknesses</h3>
<ul>
<li><strong>No convergence theorem</strong>: reliability is empirical; adversarial instances can thrash.</li>
<li><strong>Iteration cost</strong>: hard congestion means many full-netlist passes.</li>
<li><strong>Schedule tuning</strong>: how fast prices rise governs quality-versus-runtime and is set by hand.</li>
<li><strong>Born for fixed fabrics</strong>: the cleanest fit is FPGA routing's fixed resource graph; chip adaptations blend it with other methods.</li>
</ul>
</div>
</div>

<div class="tradeoff-box">
<h3>The trade-off</h3>
<p>PathFinder turns global coordination into local economics: no planner assigns resources, prices do. Nets with alternatives get priced out of contested wires, and the net that truly needs a resource outbids the rest. It is the intellectual core of congestion-driven routing, twenty-five years on.</p>
</div>

## Is it actually used today?

The evidence for PathFinder spans FPGA (Field-Programmable Gate
Array) compilation, chip global routing, and the field's vocabulary.

- <strong>FPGA (Field-Programmable Gate Array) compilation</strong>:
  [VPR (Versatile Place and Route)](https://verilogtorouter.org) and the industrial FPGA routers descended from it run
  PathFinder-family negotiated congestion as the routing algorithm,
  full stop.
- <strong>Chip global routing</strong>: the per-edge overflow costs
  and history terms inside [FastRoute](https://openroad.readthedocs.io/en/latest/main/src/grt/README.html) and its commercial peers are
  PathFinder economics applied to a Steiner-decomposed problem.
- <strong>The vocabulary</strong>: when any tool's documentation says
  "negotiation-based" or "history cost", it is citing this algorithm.
""",
    },
    {
        "slug": "layer-assignment",
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "scope": "global",
        "level": "industry",
        "name": "Layer Assignment and Via Minimization",
        "family": "global",
        "year": "1984-2009",
        "who": "Pinter (via minimization); Xu, Zhang, Chu (FastRoute 4.0)",
        "chips": [
            ("diff-easy", "vias are the currency"),
        ],
        "summary": (
            "Decide which metal layer each route segment rides: merge "
            "staircases to cut via count, promote critical runs to thick "
            "low-resistance metal, and respect per-layer capacity and "
            "preferred direction."
        ),
        "lab": None,
        "refs": [
            ("Xu, Zhang, Chu, 'FastRoute 4.0' (search)",
             "https://scholar.google.com/scholar?q=FastRoute+4.0+via+minimization+layer+assignment"),
            ("Pinter, 'Optimal layer assignment for interconnect' (search)",
             "https://scholar.google.com/scholar?q=Pinter+optimal+layer+assignment+interconnect"),
            ("FastRoute in OpenROAD (grt)",
             "https://openroad.readthedocs.io/en/latest/main/src/grt/README.html"),
        ],
        "body": """
## The idea

A modern stack has ten or more metal layers, each with a preferred
direction, a track capacity, and its own electrical character: thin,
resistive wires on the bottom layers, thick fast ones on top. A 2D
route says where a net goes; layer assignment decides which layer
each segment rides, and every change of layer costs a via. The
per-net objective:

<div class="eq">cost(assignment) = sum over segments of r(layer) × length + v × vias</div>
<ul class="eq-legend">
<li><code>r(layer)</code> resistance per unit length on the segment's layer; thick top metal is several times lower than the thin bottom layers</li>
<li><code>v</code> the cost of one via: added resistance, and blocked tracks on both layers it connects</li>
<li>subject to each layer's track capacity per region and its preferred direction</li>
</ul>

Two classic moves fall out of the same objective. *Via minimization*
assigns consecutive segments to the same layer so staircases merge
into long straight runs (the constrained version of this problem is
NP (Nondeterministic Polynomial time) hard, but per-net dynamic
programming is exact and fast). *Promotion* moves a timing-critical
run to thick top metal, paying a taller via stack for several times
less resistance.

## The recipe

**Step 1 (route in 2D).** Run global routing on a single collapsed
plane, all metal layers folded into one: every net gets a 2D tree,
which is its corridor of GCells with the cell centers connected. Each
straight run of the tree will become one or more layer-assigned
segments; the tree's turns are where vias may be needed.

**Step 2 (assign per net, by dynamic programming).** Walk each net's
tree; for every segment and every legal layer, keep the cheapest
cost of the subtree so far. The best leaf-to-root combination is
exact for that net under the current capacities.

**Step 3 (respect capacity).** Deduct each assignment from its
layer's per-region capacity; when a layer fills, later nets price it
accordingly, congestion handling again, now in the third dimension.

## Watch it work: the same net, three assignments

One net whose 2D geometry never changes; only the layers do. The
walkthrough steps through the naive direction-matched assignment
segment by segment, totals its vias and resistance, removes vias by
allowing short wrong-way runs, promotes the long run to thick metal
with the via-stack cost included, and ends on the per-segment
decision rule and why dynamic programming solves it. Every via count
and resistance figure in the captions is computed from the drawn
assignment.

<div class="walk-fig" data-walk="layer-assign"></div>

## Pros, cons, and the trade-off

<div class="pros-cons">
<div class="pc-card pc-pros">
<h3>Strengths</h3>
<ul>
<li><strong>Exact per net</strong>: dynamic programming over a net's tree finds that net's optimal assignment in linear time.</li>
<li><strong>Big electrical wins</strong>: promoting a long critical run to thick metal is one of the cheapest timing fixes in the flow.</li>
<li><strong>Fewer vias, better yield</strong>: vias are a dominant failure and resistance source; minimizing them helps everything downstream.</li>
<li><strong>Separable</strong>: 2D routing plus layer assignment decomposes a 3D search that would otherwise be far more expensive.</li>
</ul>
</div>
<div class="pc-card pc-cons">
<h3>Weaknesses</h3>
<ul>
<li><strong>Per-net exactness is not global optimality</strong>: nets assigned in sequence contend for layer capacity; ordering effects return.</li>
<li><strong>The 2D bet can lose</strong>: a route optimal on the collapsed plane may have no good layer embedding in a crowded stack.</li>
<li><strong>Capacity abstraction</strong>: per-region layer capacities approximate real track and via-rule interactions; errors surface in detailed routing.</li>
</ul>
</div>
</div>

<div class="tradeoff-box">
<h3>The trade-off</h3>
<p>Layer assignment is the flow's second act of dimensional information hiding: solve the plan in two dimensions where congestion is visible, then solve the stack per net where electrical cost is visible. The seam costs the same kind of repair iterations as the global-to-detailed seam, and earns the same speed.</p>
</div>

## Is it actually used today?

The evidence for layer assignment comes from open-source global
routers, user-level commercial controls, and the academic lineage.

- <strong>Open source</strong>: [FastRoute](https://openroad.readthedocs.io/en/latest/main/src/grt/README.html) in OpenROAD follows the
  FastRoute 4.0 architecture: 2D routing first, then via-aware layer
  assignment by per-net dynamic programming.
- <strong>Commercial</strong>: partly documented, partly inferred.
  That commercial flows assign layers with resistance-aware promotion
  of critical nets is documented at the user level (layer-promotion
  and non-default-rule controls are exposed in every major tool). That
  the internal engine is 2D routing followed by per-net dynamic
  programming, as in FastRoute 4.0, is inference from the academic
  lineage; the vendors do not publish it.
- <strong>The lineage</strong>: constrained via minimization was
  formalized in the channel era (Pinter, 1984, and contemporaries);
  the modern per-net dynamic-programming form is the FastRoute 4.0
  (2009) design.
""",
    },
    {
        "slug": "timing-crosstalk-routing",
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "scope": "both",
        "level": "industry",
        "name": "Timing-Driven and Crosstalk-Aware Routing",
        "family": "global",
        "year": "1990s onward",
        "who": "many; production routers",
        "chips": [
            ("diff-easy", "the cost function carries slack"),
        ],
        "summary": (
            "Not a new search: the same negotiation with a cost function "
            "that carries timing slack and coupling. Critical nets are "
            "weighted to win contested resources, and coupling terms, "
            "spacing, and shielding keep aggressors away from them."
        ),
        "lab": None,
        "refs": [
            ("Hu, Sapatnekar, 'A survey on multi-net global routing for "
             "integrated circuits' (search)",
             "https://scholar.google.com/scholar?q=Hu+Sapatnekar+survey+multi-net+global+routing"),
            ("FastRoute in OpenROAD (grt), timing-driven mode",
             "https://openroad.readthedocs.io/en/latest/main/src/grt/README.html"),
        ],
        "body": """
## The idea

Every routing search on these pages minimizes a cost. Timing-driven
routing changes nothing about the search and everything about the
cost: it makes wire on a critical path more expensive than the same
wire on a path with slack, so when nets contest a resource the
critical one wins and the others detour. Crosstalk-aware routing
adds a second term for the coupling between a net and its
neighbours, so aggressors are priced away from sensitive victims:

<div class="eq">cost(net, edge) = w(net) × length(edge) + price(edge) + k × coupling(net, edge)</div>
<ul class="eq-legend">
<li><code>w(net)</code> timing weight, raised for nets on failing or near-failing paths as reported by STA (Static Timing Analysis)</li>
<li><code>price(edge)</code> the congestion price of the PathFinder negotiation, unchanged</li>
<li><code>coupling(net, edge)</code> parallel run length beside switching neighbours divided by the spacing to them; the capacitance that injects noise and shifts delay</li>
<li><code>k</code> how much a unit of coupling is worth against a unit of wirelength, tuned per design</li>
</ul>

The two effects can oppose each other: escaping an aggressor may
require a detour that adds delay. Because both enter the same cost,
the router weighs the trade for each net, and the weights encode
which matters more.

## The recipe

**Step 1 (weight).** Run STA (Static Timing Analysis) on the current
routing (or an estimate); raise w(net) for nets on paths with the
worst slack.

**Step 2 (route under the weights).** Re-run the negotiation. Weighted
nets take shorter, lower-coupling routes; unweighted nets absorb the
detours.

**Step 3 (control coupling).** For nets that remain sensitive, apply
non-default spacing (a wider gap to neighbours), or shield them with
grounded wires on both sides so aggressors couple to a wire that
never switches.

**Step 4 (iterate).** Re-run STA (Static Timing Analysis); repeat until the timing and noise
reports are clean. In production this loop runs inside the router's
rip-up iterations.

## Watch it work: one critical net and one aggressor

Net C is routed plainly, then weighted as critical, then joined by an
aggressor on the adjacent track. The walkthrough shows the coupling
model, the spacing fix, the shielding fix, and the detour-versus-
coupling trade the cost function decides.

<div class="walk-fig" data-walk="timing-xtalk"></div>

## Pros, cons, and the trade-off

<div class="pros-cons">
<div class="pc-card pc-pros">
<h3>Strengths</h3>
<ul>
<li><strong>Same engine</strong>: no new search algorithm; every existing router becomes timing-driven by changing its cost.</li>
<li><strong>Directly targets sign-off</strong>: the weights come from the same STA (Static Timing Analysis) that will judge the design.</li>
<li><strong>Graduated tools</strong>: weighting, spacing, and shielding form a ladder from free to expensive, applied only where needed.</li>
</ul>
</div>
<div class="pc-card pc-cons">
<h3>Weaknesses</h3>
<ul>
<li><strong>Chicken and egg</strong>: accurate slack needs routed parasitics, which need the routing the slack is meant to steer; early iterations run on estimates.</li>
<li><strong>Weight tuning is manual</strong>: too little and critical nets lose; too much and everything else detours into congestion.</li>
<li><strong>Coupling is a moving target</strong>: an aggressor's route can change in the next iteration, so noise closure can oscillate.</li>
<li><strong>Shielding and spacing cost capacity</strong>: every protected net consumes tracks other nets needed.</li>
</ul>
</div>
</div>

<div class="tradeoff-box">
<h3>The trade-off</h3>
<p>Timing-driven routing is the router's cost function learning what the design cares about. It costs iterations and capacity, and it can never be better than the timing estimate feeding it, but it is how routing stops being a wirelength problem and becomes part of timing closure.</p>
</div>

## Is it actually used today?

The evidence for timing-driven and crosstalk-aware routing comes
from open-source router options, commercial user-level controls, and
the sign-off flow itself.

- <strong>Open source</strong>: [FastRoute](https://openroad.readthedocs.io/en/latest/main/src/grt/README.html) in OpenROAD has a
  timing-driven mode that raises the weight of critical nets from
  the STA (Static Timing Analysis) engine; the OpenROAD flow's
  repair stages apply non-default rules and spacing to nets that
  fail noise or timing checks.
- <strong>Commercial</strong>: documented. Every production router
  exposes timing-driven routing, crosstalk-aware routing, non-default
  rules, and shielding as options, and signoff noise analysis feeds
  back into routing repair; the internal weighting schedules are
  proprietary.
- <strong>The flow</strong>: timing closure at advanced nodes is a
  routing-STA (Static Timing Analysis) loop; a router that ignored slack would not close.
""",
    },
    {
        "slug": "ilp-global-routing",
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "scope": "global",
        "level": "research",
        "name": "ILP and Flow-Based Global Routing",
        "family": "global",
        "year": "2006",
        "who": "Cho and Pan (BoxRouter); Wu, Davoodi, Linderoth (GRIP)",
        "chips": [
            ("diff-hard", "optimal but does not scale"),
        ],
        "summary": (
            "Write global routing down as an integer linear program: one "
            "binary variable per candidate path, capacity constraints per "
            "edge, provable optimality per instance. Intractable at full "
            "scale, indispensable as a gold standard."
        ),
        "lab": None,
        "refs": [
            ("Cho, Pan, 'BoxRouter' (search)",
             "https://scholar.google.com/scholar?q=Cho+Pan+BoxRouter+global+routing+ILP"),
            ("Wu, Davoodi, Linderoth, 'GRIP: global routing via integer "
             "programming' (search)",
             "https://scholar.google.com/scholar?q=GRIP+global+routing+integer+programming"),
        ],
        "body": """
## The idea

Every other page in this catalog searches or negotiates. This one
declares. Give each net a set of candidate paths, attach one binary
variable to each, and state the whole problem as an ILP (Integer
Linear Programming) instance:

<div class="eq">minimize sum of cost(net, path) × x(net, path)</div>
<ul class="eq-legend">
<li><code>x(net, path)</code> 1 if the net uses that candidate path, else 0</li>
<li><code>cost(net, path)</code> the path's wirelength or detour</li>
</ul>

subject to two families of constraints:

<div class="eq">sum over paths of x(net, path) = 1 for every net</div>
<div class="eq">sum over paths crossing e of x(net, path) ≤ capacity(e) for every edge e</div>
<ul class="eq-legend">
<li><code>capacity(e)</code> how many wires the GCell edge e can carry</li>
</ul>

A solver then returns a routing and a *certificate*: no
feasible assignment of the given candidates is cheaper. Congestion
is not negotiated over iterations; it is a constraint the answer
satisfies from birth. The relaxation of the same program (allowing
fractional x) is a multi-commodity flow, whose solution bounds how
good any routing can be.

## From drawn paths to the program

The encoding is an incidence table, built before the program exists.
A pattern enumerator draws each net's candidates on the GCell graph
and stores every candidate as its explicit list of edges plus its
cost. Each stored path then becomes one table row:

<div class="eq">uses(p, e) = 1 if stored path p crosses edge e, else 0</div>
<ul class="eq-legend">
<li><code>p</code> one drawn candidate; its geometry is fixed and known before the program is written</li>
<li><code>e</code> a GCell edge with scarce capacity; only these need columns</li>
</ul>

For the two-net example in the walkthrough, with the gap A and gap B
crossings as the two scarce edges:

| variable | cost (detour) | uses gap A | uses gap B |
|----------|:---:|:---:|:---:|
| x(N1, A) | 2 | 1 | 0 |
| x(N1, B) | 6 | 0 | 1 |
| x(N2, A) | 2 | 1 | 0 |
| x(N2, B) | 8 | 0 | 1 |

The whole program reads off this table. Across each net's pair of
rows, the pick-one constraint: x(N1, A) + x(N1, B) = 1. Down each
edge's column, summing the rows that hold a 1, the capacity
constraint: x(N1, A) + x(N2, A) ≤ 1 for gap A. The objective weights
each variable by its cost column. The solver never sees geometry,
only the table, and when it returns x(N1, B) = 1 the route is read
back by lookup: the stored edge list behind that row is N1's route.
This is also why the optimality certificate is only as strong as the
menu: a path nobody drew has no row.

The flow-based encoding is the alternative that lets the solver
build routes instead of choosing them: one variable per net per
GCell edge, with conservation constraints (a net's chosen edges must
pair up at every GCell except its two pins) forcing any feasible
assignment to trace a connected path. It needs no enumeration and
can find routes outside any menu, at the price of far more
variables. Column generation bridges the two: solve with a small
menu, let the relaxation's dual prices steer a shortest-path oracle
to a missing cheaper candidate, add it as a new row, and repeat.

## The recipe

**Step 1 (candidates).** Generate a small candidate set per net,
typically the L and Z patterns of pattern routing.

**Step 2 (declare).** Emit the objective and constraints above.

**Step 3 (solve, within a budget).** Hand the program to an ILP
(Integer Linear Programming) solver. Because the full-chip program is
intractable, production-adjacent systems bound the instance:
BoxRouter solves exact programs inside progressively growing boxes
around congested regions; GRIP partitions the die and solves the
pieces near-optimally.

## Watch it work: two nets, declared and solved

The two-net bottleneck from the PathFinder page, taken from drawn
geometry to proven answer: the walkthrough enumerates each net's
candidates, reduces them to the incidence table the program actually
sees, reads the constraints off the table, solves, and looks the
winning routes back up. The solver proves the same allocation the
negotiation converges to.

<div class="walk-fig" data-walk="ilp-route"></div>

## Pros, cons, and the trade-off

<div class="pros-cons">
<div class="pc-card pc-pros">
<h3>Strengths</h3>
<ul>
<li><strong>Provable optimality</strong>: the only approach on these pages that returns a certificate, within the candidate set.</li>
<li><strong>Gold standard</strong>: near-optimal ILP solutions calibrate every heuristic router; contest benchmarks are scored against them.</li>
<li><strong>Constraints are first-class</strong>: capacity, and anything else linear, is declared once instead of encoded into cost schedules.</li>
<li><strong>Sound bounds</strong>: the flow relaxation lower-bounds the achievable wirelength before any router runs.</li>
</ul>
</div>
<div class="pc-card pc-cons">
<h3>Weaknesses</h3>
<ul>
<li><strong>Does not scale</strong>: integer programming is NP (Nondeterministic Polynomial time) hard, and millions of nets produce programs no solver finishes.</li>
<li><strong>Only as good as its candidates</strong>: a route outside the enumerated set is invisible, optimality certificate notwithstanding.</li>
<li><strong>Windowing reintroduces heuristics</strong>: box growth and partitioning schedules are hand-tuned, the mechanism the declaration was meant to remove.</li>
</ul>
</div>
</div>

<div class="tradeoff-box">
<h3>The trade-off</h3>
<p>The ILP view trades scalability for truth: it cannot route a full chip, but it is how the field knows what the right answer looks like. Heuristic routers are validated by approaching ILP (Integer Linear Programming) results on instances small enough to solve, and the exact methods are applied to the hard windows where negotiation fails to converge.</p>
</div>

## Is it actually used today?

The evidence for ILP (Integer Linear Programming) routing comes
from benchmarking, windowed exact solvers, and bounds analysis rather
than production mainlines.

- <strong>Benchmarking</strong>: GRIP-family solvers produced
  near-optimal results on the ISPD (International Symposium on
  Physical Design) global-routing contest benchmarks, and remain the
  reference heuristic routers are measured against.
- <strong>Windowed exact solving</strong>: the BoxRouter idea,
  exact programs on bounded congested regions inside a heuristic
  outer loop, recurs in academic routers and in commercial
  congestion-repair passes.
- <strong>Bounds and analysis</strong>: multi-commodity-flow
  relaxations supply lower bounds used to judge routability and
  router quality in research.
""",
    },
    {
        "slug": "gpu-routing",
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "scope": "global",
        "level": "research",
        "name": "GPU-Parallel Routing",
        "family": "global",
        "year": "2020s",
        "who": "GAMER, FastGR, InstantGR (CUHK and peers)",
        "chips": [("diff-hard", "parallelizing a sequential search")],
        "summary": (
            "Make the router data-parallel: relax whole wavefront rings "
            "at once on a GPU (Graphics Processing Unit) and route "
            "batches of non-overlapping nets in the same pass. Wins the "
            "recent academic contests; not yet the production path."
        ),
        "lab": None,
        "refs": [
            ("Guo, Young et al., 'GAMER: GPU-accelerated maze routing' (search)",
             "https://scholar.google.com/scholar?q=GAMER+GPU+accelerated+maze+routing"),
            ("'InstantGR' / 'FastGR' GPU global routing (search)",
             "https://scholar.google.com/scholar?q=InstantGR+FastGR+GPU+global+routing"),
        ],
        "body": """
## The idea

Routing looks sequential: nets are routed one after another, and a
maze search settles one cell at a time. Both appearances are
misleading, and GPU (Graphics Processing Unit) routing exploits the
two hidden layers of parallelism:

A *ring* is all cells at the same distance from the source, and every
cell in a ring relaxes its neighbours independently of the others.
That independence is what enables the parallelism, and it changes what a "step"
costs:

| model | what one step does | steps to reach the target |
|---|---|---|
| sequential (one CPU (Central Processing Unit) core) | settle one cell from the priority queue | one per settled cell: hundreds or thousands, most never on the path |
| ring-parallel (GPU (Graphics Processing Unit)) | relax every cell of the current ring at once, one thread per cell | one per ring, which is just the path length |

The work is identical; only the schedule changes. A search that
settles hundreds of cells finishes in a few dozen parallel steps,
and the wider the wavefront, the more threads are busy.

The second layer is across nets: nets whose regions do not overlap
cannot conflict, so a batch of them routes in the same pass, with
collisions detected afterwards and the losers re-queued, a
speculative form of the standard rip-up discipline.

## The recipe

**Step 1 (parallel relaxation).** Replace the priority queue with
iterated sweeps: in each sweep, every frontier cell updates its
neighbours simultaneously (GAMER's formulation). One sweep per ring.

**Step 2 (batch nets).** Partition the nets into batches of
non-overlapping bounding regions; launch each batch as one GPU pass.

**Step 3 (resolve speculatively).** After a batch, detect nets whose
routes collided on a resource, keep the winners, and re-queue the
losers for the next batch at updated congestion prices, the
PathFinder economics unchanged, only scheduled differently.

## Watch it work: whose thread is each cell?

One net on a 30 x 20 grid with two walls, the same wave run twice.
Sequentially, one thread owns every cell, one per step; on the GPU
(Graphics Processing Unit), each frontier cell is colored by the
thread that owns it, so a step's parallelism is countable. Then the
net-batching axis and the current status. Every number is computed
from the same wave.

<div class="walk-fig" data-walk="gpu-route"></div>

## Pros, cons, and the trade-off

<div class="pros-cons">
<div class="pc-card pc-pros">
<h3>Strengths</h3>
<ul>
<li><strong>Order-of-magnitude speedups</strong> reported on academic benchmarks against CPU (Central Processing Unit) global routers.</li>
<li><strong>The economics survive</strong>: PathFinder pricing works unchanged; only the schedule parallelizes.</li>
<li><strong>Rides hardware trends</strong>: routing inherits the GPU (Graphics Processing Unit) performance curve instead of the stalled single-thread curve.</li>
</ul>
</div>
<div class="pc-card pc-cons">
<h3>Weaknesses</h3>
<ul>
<li><strong>Memory</strong>: a full-chip routing database strains GPU (Graphics Processing Unit) memory; academic results are on global routing's coarse graph, not the detailed rule deck.</li>
<li><strong>Speculation wastes work</strong> when batches collide heavily, exactly in the congested regions where routing is hard.</li>
<li><strong>Determinism</strong>: production flows demand run-to-run reproducibility, which parallel speculative schedules must be engineered to preserve.</li>
</ul>
</div>
</div>

<div class="tradeoff-box">
<h3>The trade-off</h3>
<p>GPU (Graphics Processing Unit) routing changes no answer, only the clock: the same negotiation, scheduled for thousands of threads. The research has settled that the core parallelism works; what remains between contest benchmarks and production is the full rule deck, the memory footprint, and determinism, which is engineering rather than algorithm.</p>
</div>

## Is it actually used today?

The evidence for GPU (Graphics Processing Unit) routing comes from
academic contests and papers, not yet from production flows.

- <strong>Research</strong>: GAMER (GPU-accelerated maze routing) and
  the GPU global routers descended from it (FastGR, InstantGR) hold
  the recent ISPD (International Symposium on Physical Design)
  contest results with large speedups over CPU (Central Processing
  Unit) baselines.
- <strong>Production</strong>: inferred, not verified. Commercial
  routers advertise CPU parallelism (distributed and multi-threaded);
  vendor GPU (Graphics Processing Unit) claims so far center on
  analysis and simulation tools rather than the router itself.
- <strong>Open source</strong>: [InstantGR](https://github.com/cuhk-eda/InstantGR) is a fully open-source
  GPU (Graphics Processing Unit) global router with state-of-the-art
  contest results. OpenROAD's mainline routers remain CPU
  implementations; its GPU work so far is placement-side.
""",
    },
    {
        "slug": "ml-routing",
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "scope": "both",
        "level": "research",
        "name": "Machine Learning in Routing",
        "family": "global",
        "year": "2018 onward",
        "who": "RouteNet lineage; CircuitNet; many groups",
        "chips": [("diff-hard", "a strong, verifiable baseline to beat")],
        "summary": (
            "Learned congestion prediction, net ordering, and cost "
            "tuning: an active literature, and a negative result so "
            "far: unlike placement, no learned component ships inside a "
            "production router's search."
        ),
        "lab": None,
        "refs": [
            ("Xie et al., 'RouteNet: routability prediction' (search)",
             "https://scholar.google.com/scholar?q=RouteNet+routability+prediction+DRC+hotspot"),
            ("CircuitNet dataset",
             "https://circuitnet.github.io/"),
        ],
        "body": """
## The idea

Everything a router does is steered by heuristics, and each one is a
candidate for a learned replacement:

| lever | today, hand-tuned | learned proposal |
|---|---|---|
| congestion prediction | RUDY (Rectangular Uniform wire DensitY)-style analytic maps; trial global routing | CNN (Convolutional Neural Network) / GNN (Graph Neural Network) hotspot models from the placement (RouteNet lineage) |
| net ordering | criticality and fanout heuristics | learned ordering policies (RL (Reinforcement Learning)) |
| cost weights | congestion price schedules tuned per node | learned per-region weights |
| rip-up victims | overflow bookkeeping | learned victim scoring |

The first row is the most developed. A model maps placement features
(cell density, pin density, net bounding boxes) to the congestion
hotspot map, which is otherwise known only after routing. An accurate
prediction lets the router price those cells from the first
iteration rather than finding them through overflow, and lets
placement improve routability before routing runs. The second use is
where the approach is applied in practice.

## The recipe (the prediction loop)

**Step 1 (featurize).** Rasterize the placement into feature
channels (density, pins, net boxes) or build the netlist graph.

**Step 2 (predict).** The model outputs a hotspot map with no
routing run at all.

**Step 3 (route under the prediction).** Candidates are priced with
the predicted cells pre-charged, so routes steer around trouble
before any overflow exists.

**Step 4 (verify and retrain).** Routing runs, and the actual
congestion is compared with the prediction. Every completed run is
labeled training data for the next model. The same low-cost
verification that supplies these labels also sets the accuracy the
model must exceed to be useful.

## Why routing resists learning

Routing has a property placement lacks: its quality can be checked
exactly and cheaply. Running the router and counting the resulting
overflow and design-rule violations gives the true cost of a routing
decision in minutes. The classical search is also near-optimal per
net, so a learned component must outperform a baseline whose own
result is quickly verifiable. Mispredictions carry a cost: an
unpredicted hotspot leads routes into congestion, an over-predicted
hotspot forces unnecessary detours, and the negotiation must run in
both cases to correct the routing. Learned models therefore reduce
the number of iterations the loop needs; none has replaced the
loop.

## Watch it work: predict, route, verify

One net on a 30 x 20 placement through the full loop: features, the
predicted hotspot map, three candidates priced against it, the
measured congestion after routing with correct predictions, missed
hotspots, and false positives counted, and the cost of each
prediction error. Every value is computed from the stated model.

<div class="walk-fig" data-walk="ml-route"></div>

## Pros, cons, and the trade-off

<div class="pros-cons">
<div class="pc-card pc-pros">
<h3>Strengths</h3>
<ul>
<li><strong>Accurate prediction</strong>: placement-stage congestion models are accurate enough to guide routability-driven placement.</li>
<li><strong>Low labeling cost</strong>: every completed routing run yields labeled training data, so data collection is inexpensive.</li>
<li><strong>Room to improve</strong>: net ordering, cost weights, and rip-up selection remain hand-tuned, leaving scope for learned replacements.</li>
</ul>
</div>
<div class="pc-card pc-cons">
<h3>Weaknesses</h3>
<ul>
<li><strong>Strong verifiable baseline</strong>: negotiated search is near-optimal per net and its cost is cheap to check, setting a high bar.</li>
<li><strong>Prediction error costs iterations</strong>: the negotiation must correct any routing the model steered incorrectly.</li>
<li><strong>Limited generalization</strong>: a model trained on one design family and process node loses accuracy on another, as the rule deck and pitches change.</li>
</ul>
</div>
</div>

<div class="tradeoff-box">
<h3>The trade-off</h3>
<p>Machine learning is applied to routing where the cost balance favors it: predicting expensive outcomes cheaply, before routing runs. Inside the router the classical search remains, because it can be verified more cheaply than a model can be trusted. The open direction is not replacing the search but determining, earlier and more accurately, what it is asked to route.</p>
</div>

## Is it actually used today?

The evidence for machine learning in routing splits by where the
model sits.

- <strong>Before routing</strong>: documented in commercial tools.
  Production placers use machine-learning congestion and routability
  prediction, and the research line (RouteNet, the [CircuitNet](https://circuitnet.github.io/)
  dataset) is active and reproducible.
- <strong>Inside the router</strong>: no production router documents
  a learned component in its search or negotiation; reported uses are
  limited to prediction and parameter tuning.
- <strong>Compared with placement</strong>: reinforcement-learning
  macro placement has been published as a production result (Nature,
  2021); routing has no equivalent, for the verification reasons
  above.
""",
    },
    {
        "slug": "a-star",
        "card": "Best-first search guided by an estimate of the remaining cost.",
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "scope": "both",
        "level": "industry",
        "name": "A* (A-star) Search",
        "family": "detailed",
        "year": "1968",
        "who": "Hart, Nilsson, Raphael",
        "chips": [
            ("diff-easy", "shortest path guaranteed"),
            ("diff-easy", "explores little"),
            ("diff-easy", "generalizes to real costs"),
        ],
        "summary": (
            "Best-first search ordered by cost-so-far plus an "
            "admissible estimate of cost-to-go. The skeleton production "
            "routers actually use, because the cost can price vias, "
            "bends, and congestion, not just distance."
        ),
        "lab": {"href": _LAB + "?algo=astar", "label": "Open in the maze lab →"},
        "refs": [
            ("Wikipedia: A* search algorithm",
             "https://en.wikipedia.org/wiki/A*_search_algorithm"),
        ],
        "body": """
## The idea

Keep Lee's grid and guarantee but stop expanding blindly. Maintain a
priority queue ordered by

<div class="eq">f = g + h</div>

<ul class="eq-legend">
<li><code>f</code> the cell's priority in the queue: settle lowest first</li>
<li><code>g</code> cost of the cheapest path the search has found so far to this cell; provably optimal once the cell is settled</li>
<li><code>h</code> estimate of the remaining cost from this cell to the target</li>
</ul>
 Always settle the queue's cheapest cell; when the target is
settled, the traced path is optimal, provided h never overestimates
(*admissibility*). On a unit grid the Manhattan distance is such an
estimate, and the search leans hard toward the target: cells pointing
away carry large f and wait in the queue, mostly forever.

## How the queue is built

g is not known in advance; it is computed incrementally during the
search. Each pop removes the queue entry with the minimum f. At that
point the entry's g value is optimal: every remaining entry has f at
least as large, h never overestimates, and edge costs are
non-negative, so no path through any remaining entry can reach the
popped cell at lower cost. Each push inserts the popped cell's
unvisited neighbors into the queue, assigning g by accumulation
(the parent's g plus the edge cost) and h by evaluating the distance
estimate. If a neighbor is already queued with a larger g, its entry
is updated in place (relaxation).

The two quantities depend on disjoint inputs. g depends only on the
source and the edges traversed; Dijkstra's algorithm computes the same
quantity with no target information. h depends only on the coordinates
of the current cell and of the target, both available before the
search begins.

The exact recipe, one iteration at a time:

**Step 1: Pop.** Take the queue's head, the entry with the smallest f
anywhere. Its g is now final.

**Step 2: Inherit g.** Every free, unsettled neighbor n of the popped
cell gets its g from the cell that just found it:

<div class="eq">g(n) = g(popped) + 1</div>
<ul class="eq-legend">
<li><code>n</code> the neighbor cell being discovered</li>
<li><code>g(popped)</code> the just-settled cell's final cost, known from Step 1</li>
<li><code>+ 1</code> the cost of the single step between them (unit grid)</li>
</ul>

**Step 3: Compute h.** From the target's coordinates alone, no search
knowledge needed:

<div class="eq">h(n) = |x_T − x_n| + |y_T − y_n|</div>
<ul class="eq-legend">
<li><code>x_n, y_n</code> the neighbor cell's coordinates</li>
<li><code>x_T, y_T</code> the target pin's coordinates, known in advance</li>
</ul>

**Step 4: File by f.** The entry (n, g, h, f = g + h) joins the queue
in sorted position. If n is already queued from an earlier, more
expensive discovery, update that entry instead: lower its g and f and
repoint its parent to the cheaper route (this update is called
relaxation).

**Step 5: Repeat.** Until the popped cell is the target itself.

Watch the loop run below, with every g and h computed explicitly in
the caption: grid on the left, the actual queue on the right.

<div class="walk-fig" data-walk="astar-queue"></div>

The family portrait, visible live in the maze lab: Lee is A* with
h = 0 (no guidance, maximal flood); Hadlock is in effect A* with the
sharpest admissible unit-grid estimate (detour counting); A* with
Manhattan distance sits between on pure grids, and pulls far ahead the
moment costs stop being uniform.

## Why production routers are A*-shaped

Real routing cost is not step count. A via between layers costs more
than a straight step; a wrong-way segment on a layer with a preferred
direction costs more still; a bend costs; a congested edge in
negotiated-congestion schemes costs a *price* that rises every
iteration. A* absorbs all of it: g becomes accumulated weighted cost,
h any lower bound (usually distance times cheapest per-unit cost), and
optimality-within-the-model survives.

## Pros, cons, and the trade-off

<div class="pros-cons">
<div class="pc-card pc-pros">
<h3>Strengths</h3>
<ul>
<li><strong>Optimal with an admissible estimate</strong>: admissibility preserves the shortest-path guarantee on any non-negative cost graph.</li>
<li><strong>Cost-general</strong>: vias, bends, layer direction, congestion prices, timing weights: anything expressible as edge cost slots in unchanged. This is why it won.</li>
<li><strong>Efficient</strong>: exploration concentrates along the corridor the estimate points down.</li>
<li><strong>Extensible</strong>: bidirectional, multi-source and multi-sink (route to a whole partial net), and windowed variants are all standard engineering.</li>
</ul>
</div>
<div class="pc-card pc-cons">
<h3>Weaknesses</h3>
<ul>
<li><strong>Estimate quality is everything</strong>: on heavily weighted graphs a plain distance bound is weak, and the search fattens back toward Dijkstra.</li>
<li><strong>Priority-queue overhead</strong>: per-cell work exceeds Lee's plain queue; on tiny uniform grids Hadlock is leaner.</li>
<li><strong>Speed temptations cost optimality</strong>: production implementations sometimes use inflated (inadmissible) estimates, trading the guarantee for runtime, deliberately.</li>
<li><strong>Still two-pin per search</strong>: multi-terminal nets arrive via Steiner decomposition.</li>
</ul>
</div>
</div>

<div class="tradeoff-box">
<h3>The trade-off</h3>
<p>A* is the compromise that ended the argument: it keeps Lee's guarantee whenever the estimate is admissible, approaches Hadlock's economy on pure grids, and, unlike either, carries arbitrary real-world costs. Everything else in this family is now a special case or a teaching example.</p>
</div>

## Is it actually used today?

The verifiable evidence comes from the open-source toolchain, where
the code and documentation can actually be read; the commercial
evidence is inference from architecture and patents.

- <strong>Open-source detailed routing</strong>: [TritonRoute](https://openroad.readthedocs.io/en/latest/main/src/drt/README.html) documents an A*-based
  search; [Dr. CU](https://github.com/cuhk-eda/dr-cu) runs Dijkstra
  (A* with a zero estimate) over a sparse grid graph.
- <strong>Open-source global routing</strong>: [FastRoute](https://openroad.readthedocs.io/en/latest/main/src/grt/README.html)'s point-to-point engine
  is cost-weighted maze search of exactly this family.
- <strong>Open-source FPGA (Field-Programmable Gate Array)
  routing</strong>:
  [VPR (Versatile Place and Route)](https://verilogtorouter.org) documents its router as A*-directed expansion under
  PathFinder cost updates.
- <strong>Commercial routers</strong>: proprietary and
  uninspectable. Consistent literature and industry description point
  to the same A*-family kernels, but for closed tools that is
  inference, not inspection.
- <strong>The caveat</strong>: production versions everywhere
  are heavily engineered variants (multi-sink targets, search windows,
  sometimes deliberately inadmissible estimates), so "A*" names the
  kernel, not a textbook implementation.
""",
    },
    {
        "slug": "track-assignment",
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "scope": "detailed",
        "level": "industry",
        "name": "Track Assignment",
        "family": "detailed",
        "year": "2002",
        "who": "Batterywala, Shenoy, Nicholls, Zhou",
        "chips": [
            ("diff-easy", "left-edge reborn"),
        ],
        "summary": (
            "Between global and detailed routing: bulk-place each net's "
            "long straight segments onto physical tracks by interval "
            "packing, so the expensive point-to-point search only handles "
            "short connections and repairs."
        ),
        "lab": None,
        "refs": [
            ("Batterywala et al., 'Track assignment: a desirable "
             "intermediate step' (search)",
             "https://scholar.google.com/scholar?q=Batterywala+track+assignment+intermediate+step+global+detailed"),
            ("TritonRoute in OpenROAD (drt)",
             "https://openroad.readthedocs.io/en/latest/main/src/drt/README.html"),
        ],
        "body": """
## The idea

Global routing does not produce wires. It produces, for every net, a
*corridor*: the chain of coarse GCells the net's wire is allowed to
pass through, chosen for congestion and length at a resolution where
the whole die is visible. Each GCell spans many real tracks, so a
corridor fixes which columns and rows the wire will occupy but not
which track it sits on. The figure builds the idea up from one net:

<div class="walk-fig" data-walk="corridor-idea"></div>

Detailed routing must turn those corridors into exact geometry. Running the full point-to-point
search for every millimeter of every net wastes its power: most of a
long net is one straight run whose position barely matters within
its corridor. Track assignment is the intermediate pass that
bulk-places those long runs. Each net's straight piece inside a
region (an *iroute*) is an interval with a fixed extent; tracks are
rows; two iroutes conflict when their extents overlap:

<div class="eq">iroute → interval [l, r] on some track of its panel</div>
<ul class="eq-legend">
<li><code>panel</code> a horizontal (or vertical) strip of the die, one track-pitch tall stack of parallel tracks</li>
<li><code>[l, r]</code> the iroute's extent along the panel, fixed by its global route guide</li>
</ul>

This is the left-edge problem again, six decades on: sort by left
endpoint, first-fit into tracks. Production formulations add weights
for via count, pin alignment, and overlap with blockages, and solve
the same packing greedily or as a small assignment problem per
panel.

## The recipe

**Step 1 (extract and sort).** Cut the die into panels aligned with
the routing layers' preferred directions. Within each panel, extract
each net's iroute from its route guide: the long straight run between
the net's pin columns, whose extent [l, r] the guide fixes and whose
track is still free. Sort the iroutes by left endpoint (by length or
criticality in weighted forms).

**Step 2 (place).** Sweep the sorted list and place each iroute on
the first track where it fits without overlap, exactly the left-edge
sweep. Its endpoints are recorded as future vias where the pin
connections will land.

**Step 3 (hand off).** Fix the assigned trunks. The detail router
now only connects pins to trunks, short perpendicular stubs landing
on those vias, and repairs local rule violations: short searches
instead of long ones.

## Watch it work: packing iroutes

One panel, four tracks, five nets crossing it. The walkthrough
follows the stage from what global routing handed over (pins and
route guides) through iroute extraction, the sort, one placement per
step with the fit test's arithmetic, the check against the guides,
and the pin-to-trunk hand-off to detailed routing.

<div class="walk-fig" data-walk="track-assign"></div>

## Pros, cons, and the trade-off

<div class="pros-cons">
<div class="pc-card pc-pros">
<h3>Strengths</h3>
<ul>
<li><strong>Search where it pays</strong>: the expensive A* (A-star) search is spent on short pin connections, not on kilometers of straight trunk.</li>
<li><strong>Proven core</strong>: the interval-packing engine is the left-edge greedy, simple, near-linear, and well understood.</li>
<li><strong>Panel parallelism</strong>: panels are independent and are assigned concurrently.</li>
<li><strong>Better starting point</strong>: detail routing that starts from assigned trunks converges in fewer rip-up iterations.</li>
</ul>
</div>
<div class="pc-card pc-cons">
<h3>Weaknesses</h3>
<ul>
<li><strong>Commitments made blind</strong>: trunks are placed before full design rules are checked; some assignments must be torn up later anyway.</li>
<li><strong>Panel boundaries</strong>: nets crossing panels need consistent assignments on both sides, which the per-panel view complicates.</li>
<li><strong>Weighted reality</strong>: the clean optimality of pure interval packing disappears once via and alignment costs enter; production versions are heuristic.</li>
</ul>
</div>
</div>

<div class="tradeoff-box">
<h3>The trade-off</h3>
<p>Track assignment inserts one more resolution between the corridor and the coordinate, buying detail routing a massive head start at the cost of commitments made without full rule knowledge. It is also the field's cleanest example of an algorithm outliving its era: the channel router died, and its greedy heart was reborn inside the flow that replaced it.</p>
</div>

## Is it actually used today?

The evidence for track assignment comes from open-source detailed
routers, vendor publications, and the algorithm's lineage.

- <strong>Open source</strong>: [TritonRoute](https://openroad.readthedocs.io/en/latest/main/src/drt/README.html), OpenROAD's detailed
  router, runs an explicit track-assignment stage between reading the
  route guides and the DRC (Design Rule Check) driven search
  iterations.
- <strong>Commercial</strong>: better evidenced than most internals.
  The 2002 Batterywala et al. paper proposing the stage came out of
  Synopsys, and vendor documentation and patents describe track
  assignment as a step between global and detailed routing. The
  exact packing heuristics inside Innovus, Fusion Compiler, and
  Aprisa are proprietary; that the stage exists is documented, how it
  is solved is inference.
- <strong>The lineage</strong>: the packing core is the left-edge
  algorithm of 1971, covered on its own page in the historical
  family.
""",
    },
    {
        "slug": "pin-access",
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "scope": "detailed",
        "level": "industry",
        "name": "Pin Access Analysis",
        "family": "detailed",
        "year": "2010s",
        "who": "TritonRoute (Kahng, Wang, Xu); commercial routers",
        "chips": [
            ("diff-hard", "the dominant failure at 7 nm and below"),
        ],
        "summary": (
            "Before any search, enumerate every legal via position on "
            "every cell pin under the full rule deck, so the detailed "
            "router targets pre-checked access points instead of "
            "discovering, deep in a maze expansion, that a pin cannot be "
            "reached."
        ),
        "lab": None,
        "refs": [
            ("Kahng, Wang, Xu, 'TritonRoute: an initial detailed router "
             "for advanced VLSI technologies' (search)",
             "https://scholar.google.com/scholar?q=TritonRoute+initial+detailed+router+advanced+VLSI+pin+access"),
            ("TritonRoute in OpenROAD (drt)",
             "https://openroad.readthedocs.io/en/latest/main/src/drt/README.html"),
        ],
        "body": """
## The idea

At advanced nodes the hardest part of a route is often its last few
tracks. Cell pins on M1 are slivers one track wide, on-track
positions are few, and a via onto the pin must satisfy enclosure,
spacing, and end-of-line rules against every neighbouring shape in
the cell. A maze search that discovers this at the pin, after
expanding thousands of cells, has wasted the expansion and may still
find no legal landing. Pin access analysis moves the problem in front
of the search:

<div class="eq">access(pin) = { (track, via pattern) : the via is legal under the full rule deck }</div>
<ul class="eq-legend">
<li><code>track</code> a routing track on the layer above the pin that crosses the pin shape</li>
<li><code>via pattern</code> a specific via geometry (cut, enclosures) placed at that crossing</li>
<li><code>legal</code> passes enclosure, spacing to every neighbouring shape, and end-of-line rules; checked against real geometry, not a capacity abstraction</li>
</ul>

The set is computed once per pin, before routing, and the router
then targets the set instead of the pin shape. A pin whose set is
empty is reported as unroutable before a single net is searched, at
the point where moving or flipping the cell is still cheap.

## The recipe

**Step 1 (enumerate).** For each pin, list every candidate access
point: each track on the layer above that crosses the pin shape,
combined with each allowed via pattern.

**Step 2 (check rules).** Test each candidate against the deck: via
enclosure by the pin metal, spacing to neighbouring pins and
blockages, end-of-line and minimum-area rules. Discard failures.

**Step 3 (record).** Store the survivors as the pin's access-point
set, with a preference order (on-track over off-track, fewer vias
over more). Report pins with empty sets.

**Step 4 (route to the set).** During detailed routing, the search
for a net terminates at any recorded access point of its pin,
committing that point's via pattern. Enclosure and spacing at the
pin need not be reasoned about in the search: the point is legal by
construction.

## Watch it work: one pin, seven candidates

A standard cell with a one-track-wide pin, a neighbouring pin, and an
M1 blockage. The walkthrough enumerates the candidates on the M2
tracks, applies enclosure and spacing, records the survivors, routes
to one, and ends on the empty-set failure that this pass exists to
catch.

<div class="walk-fig" data-walk="pin-access"></div>

## Pros, cons, and the trade-off

<div class="pros-cons">
<div class="pc-card pc-pros">
<h3>Strengths</h3>
<ul>
<li><strong>Precomputed legality</strong>: the expensive rule checking at pins runs once, before the search, the same economics as FLUTE (Fast Lookup Table Estimation)'s lookup table.</li>
<li><strong>Early failure reporting</strong>: an unreachable pin is known before routing, when the fix (move, flip, swap pin, change cell) is cheap.</li>
<li><strong>Cleaner convergence</strong>: routes that end at pre-checked points do not generate the pin-area violation churn that dominates rip-up iterations at advanced nodes.</li>
</ul>
</div>
<div class="pc-card pc-cons">
<h3>Weaknesses</h3>
<ul>
<li><strong>Context blindness</strong>: access points are checked against the cell's own geometry; a neighbouring cell's routing can still invalidate one, so some checking recurs in the search.</li>
<li><strong>Combinatorial at scale</strong>: pins times tracks times via patterns is large; production implementations prune aggressively and cache per cell type.</li>
<li><strong>Library dependence</strong>: a poorly designed cell library has pins with tiny access sets no router can fix; the pass exposes the problem but cannot solve it.</li>
</ul>
</div>
</div>

<div class="tradeoff-box">
<h3>The trade-off</h3>
<p>Pin access analysis is the acknowledgement that, at advanced nodes, the search space's boundary is harder than its interior. It buys the search legal endpoints at the cost of a preprocessing pass and some duplicated checking, and it moves the field's most common failure from a late surprise to an early report.</p>
</div>

## Is it actually used today?

The evidence for pin access analysis comes from open-source detailed
routers, the routing literature, and the failure statistics engineers
meet at advanced nodes.

- <strong>Open source</strong>: [TritonRoute](https://openroad.readthedocs.io/en/latest/main/src/drt/README.html), OpenROAD's detailed router,
  runs an explicit pin-access stage that enumerates and rule-checks
  access points per pin before its search iterations; the stage is
  documented in the TritonRoute papers.
- <strong>Commercial</strong>: partly documented, partly inferred.
  Commercial detailed routers report pin-access failures and expose
  pin-access options at the user level; that they precompute
  access-point sets in the same way is inference from the academic
  lineage.
- <strong>The failure statistics</strong>: at 7 nm and below, pin
  access and via-rule violations, not congestion, dominate detailed
  routing DRC (Design Rule Check) reports, which is why the pass
  exists.
""",
    },
    {
        "slug": "gridless-routing",
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "scope": "detailed",
        "level": "industry",
        "name": "Gridless (Shape-Based) Routing",
        "family": "detailed",
        "year": "1985-2001",
        "who": "Finch et al.; Cong, Fang, Khoo (multilevel gridless)",
        "chips": [
            ("diff-hard", "any coordinate, huge search space"),
        ],
        "summary": (
            "Drop the track lattice: store the layout as geometric shapes "
            "and search corner points, so wires can sit at any coordinate. "
            "Slower than gridded search, but the only model that fits "
            "off-grid pins, analog constraints, and non-uniform widths."
        ),
        "lab": None,
        "refs": [
            ("Cong, Fang, Khoo, 'MARS: multilevel full-chip gridless "
             "routing' (search)",
             "https://scholar.google.com/scholar?q=Cong+MARS+multilevel+gridless+routing"),
            ("Ousterhout, 'Corner stitching' (search)",
             "https://scholar.google.com/scholar?q=Ousterhout+corner+stitching+layout"),
        ],
        "body": """
## The idea

Gridded routers buy their speed from a fiction: that every wire sits
on a track of fixed pitch and width. Where the fiction holds, the
search space is small and every candidate position is legal by
construction. Where it breaks, off-grid macro pins, analog devices,
wires of non-standard width, the gridded model cannot even represent
the answer. Gridless (shape-based) routing drops the lattice: the
layout is stored as geometric shapes in a spatial structure
(corner-stitched tile planes are the classic), and the router
searches positions derived from the geometry itself:

<div class="eq">search space = corner points and escape lines of existing shapes</div>
<ul class="eq-legend">
<li><code>corner points</code> candidate turning positions generated where shapes end or spacing bands intersect, instead of at fixed grid crossings</li>
</ul>

Legality is checked against real geometry with real spacing rules,
so any coordinate is reachable and any width routable. The price is
the search space: shape corners vastly outnumber track crossings,
and every candidate needs geometric queries instead of array
lookups.

## The recipe

**Step 1 (model).** Maintain the layout as shapes in a spatial data
structure supporting fast region queries (corner stitching, tile
trees).

**Step 2 (generate).** From the current point, generate candidate
moves to the corner points and escape lines of nearby shapes,
expanded by the required spacing, the gridless descendant of
line-search escape points (Hightower's algorithm was gridless before
the word existed).

**Step 3 (search and legalize).** Run A* (A-star) over the generated
points, checking each candidate segment against the real shapes; the
result needs no snapping because it was legal at birth.

## Watch it work: the pin between the tracks

A macro pin at y = 4.45, between track 4 and track 5. The walkthrough
steps through both models: first the gridded lattice, its route, and
its blind spot at the off-grid pin; then the shape-based model built
up piece by piece, the spacing band, the corner points and escape
line generated from the geometry, and the search legs that meet the
pin exactly.

<div class="walk-fig" data-walk="gridless-route"></div>

## Pros, cons, and the trade-off

<div class="pros-cons">
<div class="pc-card pc-pros">
<h3>Strengths</h3>
<ul>
<li><strong>Complete expressiveness</strong>: off-grid pins, arbitrary widths, and analog spacing constraints are first-class, not special cases.</li>
<li><strong>Legal by construction</strong>: candidates are checked against real geometry, so no post-route snapping or violation wave.</li>
<li><strong>No pitch quantization</strong>: wires sit exactly where the geometry wants them, which matters where every nanometer of spacing is negotiated.</li>
</ul>
</div>
<div class="pc-card pc-cons">
<h3>Weaknesses</h3>
<ul>
<li><strong>Slow</strong>: geometric queries per candidate and a far larger candidate set; orders of magnitude behind gridded search on digital workloads.</li>
<li><strong>Complex tooling</strong>: spatial structures, incremental rule engines, and escape-point generation are hard to build and harder to make fast.</li>
<li><strong>Poor fit for uniform problems</strong>: on a standard-cell die where everything is on pitch, the generality buys nothing.</li>
</ul>
</div>
</div>

<div class="tradeoff-box">
<h3>The trade-off</h3>
<p>Gridded and gridless routing are the same search with different vocabularies: one enumerates a lattice, the other the geometry itself. The lattice wins wherever the design is regular, which is why digital detail routing is gridded; the geometry wins wherever the design is not, which is why analog routers never had a choice.</p>
</div>

## Is it actually used today?

The evidence for gridless routing splits by domain: analog and
custom layout, digital detailed routing, and the academic lineage.

- <strong>Analog and custom layout</strong>: the routers in
  custom-design environments (Cadence Virtuoso's space-based router
  and peers) are shape-based, because analog constraints,
  symmetry, matching, arbitrary widths, do not quantize.
- <strong>Digital, at the edges</strong>: production detailed routers
  stay gridded for speed but carry gridless logic for off-grid
  pin access and local repair; open-source TritonRoute handles
  off-grid pin access as a special case within a gridded model.
- <strong>The lineage</strong>: gridless PCB (Printed Circuit Board)
  routers appeared in the mid-1980s; Cong's multilevel gridless work
  (MARS, 2001) is the standard full-chip academic reference, and
  corner stitching (Ousterhout, 1984) is the data structure that made
  the model practical.
""",
    },
    {
        "slug": "ndr-multipatterning",
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "scope": "detailed",
        "level": "industry",
        "name": "Non-Default Rules and Multi-Patterning-Aware Routing",
        "family": "detailed",
        "year": "2000s-2010s",
        "who": "many; advanced-node routers",
        "chips": [
            ("diff-hard", "the process becomes part of the routing model"),
        ],
        "summary": (
            "Two ways the manufacturing process constrains routing: named "
            "rule sets that give chosen nets wider wires and spacing, and "
            "at sub-lithographic pitches, multi-patterning constraints "
            "that turn a metal layer into a mask-coloring problem the "
            "router must keep solvable."
        ),
        "lab": None,
        "refs": [
            ("Pan, Yu, Gao, 'Design for manufacturing with emerging "
             "nanolithography' (search)",
             "https://scholar.google.com/scholar?q=Pan+Yu+Gao+design+for+manufacturing+emerging+nanolithography"),
            ("Non-default rules in OpenROAD (LEF NONDEFAULTRULE)",
             "https://openroad.readthedocs.io/en/latest/main/src/drt/README.html"),
        ],
        "body": """
## The idea

Default routing assumes every wire is minimum width at minimum
spacing. Two departures from that assumption are routine at
advanced nodes, and both change what the router must model.

A *non-default rule* (NDR (Non-Default Rule)) is a named rule set (width, spacing,
via choice) attached to chosen nets. Wider wire has lower resistance;
wider spacing has lower coupling. The router must honour the rule in
its search: an NDR (Non-Default Rule) net blocks the neighbouring tracks its spacing
requires and consumes several nets' worth of capacity.

*Multi-patterning* arises when the wire pitch is below what one
lithography exposure can print. With LELE (Litho-Etch-Litho-Etch)
double patterning, one layer is printed as two masks, and any two
shapes closer than the single-mask pitch must be on different masks:

<div class="eq">shapes closer than the coloring distance must receive different masks</div>
<ul class="eq-legend">
<li><code>coloring distance</code> the spacing below which two shapes cannot share a mask; above it, mask choice is free</li>
<li>the layout's shapes and these adjacencies form a <em>conflict graph</em>; the layer is manufacturable only if that graph is 2-colorable (bipartite)</li>
</ul>

An odd cycle in the conflict graph cannot be colored no matter how
the masks are assigned. The smallest is a triangle: three shapes
each within the coloring distance of the other two, for instance two
wires on adjacent tracks plus a third shape that runs beside one of
them on a neighbouring track and ends too close to the other on its
own track. Every spacing rule can be satisfied while the coloring is
impossible; the router must avoid closing such cycles.
SADP (Self-Aligned Double Patterning) removes the coloring problem
by defining the pitch with a deposited spacer, at the price of
confining wires to a fixed one-dimensional grid with heavy
restrictions on jogs and wrong-way segments. The figure below walks
through both processes and what each looks like from the router's
side:

<div class="walk-fig" data-walk="mpt-idea"></div>

## The recipe

**Step 1 (assign rules).** Attach NDRs (Non-Default Rules) to the nets that need them:
clocks, timing-critical or noise-sensitive signals. Ration them; each
costs the capacity of several default nets.

**Step 2 (route with widened footprints).** In the search, an NDR (Non-Default Rule)
net occupies its width plus its spacing halo; it tapers to default
width only to reach minimum-size pins.

**Step 3 (route coloring-aware).** On multi-patterned layers, track
the conflict graph as segments are placed; price or forbid moves that
would create an odd cycle. Assign masks (color) at the end, or leave
the layout provably colorable for the mask tool.

## Watch it work: rules and colors on one layer

Default tracks, then an NDR (Non-Default Rule) wire and its footprint, then the same
tracks under two-mask coloring: alternating masks, an odd-cycle
conflict, its resolution by re-routing, and the SADP (Self-Aligned Double Patterning) alternative.

<div class="walk-fig" data-walk="ndr-mpt"></div>

## Pros, cons, and the trade-off

<div class="pros-cons">
<div class="pc-card pc-pros">
<h3>Strengths</h3>
<ul>
<li><strong>NDRs (Non-Default Rules) are precise</strong>: resistance and coupling are fixed for exactly the nets that need it, with no global cost.</li>
<li><strong>Coloring-aware routing prevents rather than repairs</strong>: an odd cycle avoided during routing costs nothing; one found afterwards costs a re-route.</li>
<li><strong>Manufacturability by construction</strong>: a router that keeps the conflict graph bipartite hands the mask tool a solvable problem.</li>
</ul>
</div>
<div class="pc-card pc-cons">
<h3>Weaknesses</h3>
<ul>
<li><strong>NDRs (Non-Default Rules) eat capacity</strong>: a double-width, double-spaced net costs roughly four tracks; over-use congests the design.</li>
<li><strong>Coloring interacts with everything</strong>: pin access, vias, and neighbouring cells all add conflict-graph edges; the router's view is never complete.</li>
<li><strong>Node-specific complexity</strong>: LELE (Litho-Etch-Litho-Etch), SADP (Self-Aligned Double Patterning), and triple patterning each need different tooling, and the rules change with every process.</li>
</ul>
</div>
</div>

<div class="tradeoff-box">
<h3>The trade-off</h3>
<p>Both features are the same admission: at advanced nodes the router cannot treat wires as abstract tracks, because the process determines what a legal wire is. NDRs (Non-Default Rules) buy electrical quality with capacity; multi-patterning awareness buys manufacturability with a harder search. Neither is optional once the node demands it.</p>
</div>

## Is it actually used today?

The evidence for non-default rules and multi-patterning-aware
routing comes from the LEF (Library Exchange Format) and DEF (Design
Exchange Format) standards, open-source router support,
and the requirements of advanced-node processes.

- <strong>Open source</strong>: NDRs (Non-Default Rules) are part of the LEF (Library
  Exchange Format) and DEF (Design Exchange Format) standards, and
  [TritonRoute](https://openroad.readthedocs.io/en/latest/main/src/drt/README.html) honours NONDEFAULTRULE nets in its search; the
  open-source flow does not target multi-patterned nodes, so
  coloring-aware routing has no open reference implementation.
- <strong>Commercial</strong>: documented for NDRs (rule
  definition and per-net assignment are standard flow steps).
  Coloring-aware routing is required at every LELE (Litho-Etch-Litho-Etch) node and is
  documented at the feature level; the internal conflict-graph
  handling is proprietary.
- <strong>The process</strong>: every node below roughly 20 nm has
  used some form of multi-patterning on its densest layers until
  EUV (Extreme Ultraviolet) lithography relaxed it on some layers;
  the routing constraint follows the process.
""",
    },
    {
        "slug": "bus-routing",
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "scope": "detailed",
        "level": "industry",
        "name": "Bus Routing",
        "family": "detailed",
        "year": "1990s onward",
        "who": "many; commercial bus routers",
        "chips": [
            ("diff-easy", "many nets, one shape"),
        ],
        "summary": (
            "Route a group of nets as one structured object: a single "
            "trunk topology replicated on adjacent tracks with bit order "
            "preserved, and, where skew matters, serpentine length "
            "matching. Memory interfaces and datapaths depend on it."
        ),
        "lab": None,
        "refs": [
            ("Bus routing (search)",
             "https://scholar.google.com/scholar?q=bus+routing+algorithm+physical+design+length+matching"),
        ],
        "body": """
## The idea

A bus is a set of nets the designer intends to behave as one:
address and data lines, a datapath's word, the bits of a matched
interface. Routed as independent nets they will not: each bit takes
its own cheapest path, topologies diverge, lengths spread, and bits
end up coupling to different neighbours. Bus routing treats the group
as one object with three properties to preserve:

<div class="eq">bus route = one topology × ordered adjacent tracks × (optionally) matched lengths</div>
<ul class="eq-legend">
<li><code>one topology</code> every bit follows the same shape (same bends, same side of every obstacle)</li>
<li><code>ordered adjacent tracks</code> bit i beside bit i+1, order preserved; a bus cannot twist without crossings</li>
<li><code>matched lengths</code> for skew-sensitive groups, every bit within a tolerance of the longest, achieved by adding serpentine meanders to the shorter ones</li>
</ul>

## The recipe

**Step 1 (group).** Identify the bus by name pattern or explicit
constraint; fix its bit order and its track-spacing rule.

**Step 2 (route the trunk).** Route one representative bit, or a
single trunk as wide as the whole group, through the ordinary
global and detailed routers.

**Step 3 (replicate).** Copy the trunk onto adjacent tracks for the
remaining bits, staggering the bends so the bits never cross, and
resolve the fan-in and fan-out at the pins.

**Step 4 (match, if required).** Add serpentine meanders to the
shorter bits until all lengths are within tolerance.

## Watch it work: four bits around a macro

The same four bits routed independently and as a bus, then the
mechanism and the length-matching step.

<div class="walk-fig" data-walk="bus-route"></div>

## Pros, cons, and the trade-off

<div class="pros-cons">
<div class="pc-card pc-pros">
<h3>Strengths</h3>
<ul>
<li><strong>Matched electrical behaviour</strong>: same topology, same neighbours, similar lengths; the bits arrive together.</li>
<li><strong>Predictable coupling</strong>: bits couple mainly to each other, which the designer can budget for.</li>
<li><strong>Cheaper than the sum of its parts</strong>: one trunk search replaces N searches, and no crossings means no vias among the bits.</li>
</ul>
</div>
<div class="pc-card pc-cons">
<h3>Weaknesses</h3>
<ul>
<li><strong>Rigid</strong>: a bus needs a contiguous band of tracks; in a congested region no such band may exist.</li>
<li><strong>Length matching costs area</strong>: serpentines are wire that exists only to be long.</li>
<li><strong>Special-case tooling</strong>: a separate engine or mode, with its own constraints, sitting beside the ordinary router.</li>
</ul>
</div>
</div>

<div class="tradeoff-box">
<h3>The trade-off</h3>
<p>Bus routing trades the individual optimality of each net for the collective behaviour of the group. Where the group's skew and coupling matter more than any one bit's wirelength, memory interfaces above all, that trade is the whole point.</p>
</div>

## Is it actually used today?

The evidence for bus routing comes from commercial tool features and
the interfaces that require it.

- <strong>Commercial</strong>: documented. The major place-and-route
  tools ship dedicated bus-routing modes and constraints (bus
  grouping, spacing, length matching), and custom-layout tools have
  bus routers with interactive control; the internal algorithms are
  proprietary.
- <strong>Open source</strong>: no dedicated bus router in the
  OpenROAD flow; equivalent structure is approximated with
  non-default rules and net grouping.
- <strong>The interfaces</strong>: DDR (Double Data Rate) memory
  buses, high-speed serial lanes, and matched clock groups are
  specified with skew budgets that only bus-style routing meets.
""",
    },
    {
        "slug": "rip-up-and-reroute",
        "card": "Tear out nets that block each other and route them again.",
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "scope": "both",
        "level": "industry",
        "name": "Rip-Up and Reroute",
        "family": "loop",
        "year": "1970s onward",
        "who": "many",
        "chips": [
            ("diff-medium", "heuristic"),
            ("diff-easy", "universally used"),
        ],
        "summary": (
            "Sequential routing is order-dependent and greedy: when nets "
            "block each other, tear out the offenders and route them "
            "again under updated costs. The iterative repair loop every "
            "router runs."
        ),
        "lab": {"href": _LAB, "label": "See net ordering in the maze lab →"},
        "refs": [
            ("Rip-up and reroute literature survey (search)",
             "https://scholar.google.com/scholar?q=rip-up+and+reroute+routing+survey"),
        ],
        "body": """
## The idea

Nets are routed one at a time, and each committed route becomes an
obstacle for the nets after it. The outcome therefore depends on
routing order, and selecting an optimal order is intractable: the
joint routing problem is NP-hard (Non-deterministic Polynomial hard).
Rip-up and reroute replaces order selection with iterative repair.

**Step 1: Route.** Route every net sequentially, accepting failures
and over-capacity resources rather than stopping.

**Step 2: Select victims.** Identify nets to remove: failed nets,
nets through over-capacity regions, or nets whose removal unblocks
another.

**Step 3: Rip up.** Delete the victims' routes; their resources
return to the pool.

**Step 4: Reprice.** Update costs so contested resources appear
expensive and freed space appears available. The pricing rule is the
main design variable; PathFinder's present-plus-history scheme is its
principled form.

**Step 5: Reroute.** Route the victims again under the new costs,
possibly in a new order. Return to Step 2 until no violations remain
or an iteration limit is reached.

### How victims are identified

Blockers are not deduced in advance; they are observed or discovered:

- <strong>Overflow bookkeeping</strong>: every resource tracks
  occupancy versus capacity, so over-capacity resources and the nets
  occupying them are read directly from tables.
- <strong>Probe routing</strong>: a failed net is searched again with
  committed nets penalized instead of forbidden. The minimum-penalty
  path it finds crosses specific committed nets, and those are, by
  construction, the nets whose removal unblocks it along its best
  corridor. The failed net's own search produces the victim list.
- <strong>Violation ownership</strong>: in detailed routing, each DRC
  (Design Rule Check) violation involves shapes owned by specific
  nets; those nets, plus neighbors within a window around the
  violation, are selected.
- <strong>Or no selection at all</strong>: PathFinder rips every net
  every iteration and lets pricing resolve contention, removing the
  question entirely.

## Watch it work: commit, regret, repair

Two nets contend for one preferred gap. The frames follow one full
repair cycle: the initial order commits the gap to the wrong net, the
rip-up returns it to the pool, and the reroute produces the better
allocation, with total wirelength measured before and after.

<div class="walk-fig" data-walk="ripup"></div>

## Convergence behavior

No convergence or optimality guarantee exists; the loop is a
heuristic. Two nets can evict each other indefinitely unless the
pricing carries memory, so history terms (costs that accumulate on
repeatedly contested resources) are the standard remedy, with
iteration limits as the backstop. Variants differ in victim selection
(worst overflow first, history-weighted, conflict-graph-guided) and
in granularity (single nets versus whole regions). With
history-bearing costs, the loop converges quickly on production
designs; instances that thrash exist but are rare in practice.

## Pros, cons, and the trade-off

<div class="pros-cons">
<div class="pc-card pc-pros">
<h3>Strengths</h3>
<ul>
<li><strong>Universal</strong>: composes with any router, cost
scheme, or technology; it is a control loop with no assumptions
about the search inside it.</li>
<li><strong>Anytime behavior</strong>: every iteration ends with a
complete routing; the loop can stop whenever the result is
acceptable.</li>
<li><strong>Simple to construct</strong>: victim selection plus
re-invocation of an existing router.</li>
<li><strong>Empirically reliable</strong>: with history-bearing
costs it converges quickly on production designs.</li>
</ul>
</div>
<div class="pc-card pc-cons">
<h3>Weaknesses</h3>
<ul>
<li><strong>No guarantees</strong>: neither convergence nor solution
quality is provable in general.</li>
<li><strong>Oscillation risk</strong>: mutual eviction cycles require
history costs or iteration limits to break.</li>
<li><strong>Heuristic victim selection</strong>: the choice of what
to rip is unprincipled, and poor choices waste iterations.</li>
<li><strong>Can mask upstream problems</strong>: a placement that
should be repaired is sometimes routed around instead, at a
wirelength and runtime cost.</li>
</ul>
</div>
</div>

<div class="tradeoff-box">
<h3>The trade-off</h3>
<p>Sequential routing commits resources in an order that cannot be
chosen optimally in advance. Rip-up and reroute replaces order
selection with iteration: commit cheaply, measure the resulting
contention, reprice, and re-commit. Guarantees are surrendered;
in exchange, the loop reaches allocations that no computable
single-pass order would find, and it does so on every production
design routed today.</p>
</div>

## Is it actually used today?

The evidence for rip-up-and-reroute comes from router architecture
documentation, open source and commercial.

- <strong>Detailed routing</strong>: [TritonRoute](https://openroad.readthedocs.io/en/latest/main/src/drt/README.html)'s convergence is a
  rip-up-and-reroute loop driven by DRC (Design Rule Check) violation
  counts, iterated until clean; commercial detailed routers share the
  structure.
- <strong>Global routing</strong>: overflow-driven rip-up under
  rising congestion costs is the core of [FastRoute](https://openroad.readthedocs.io/en/latest/main/src/grt/README.html) and its peers.
- <strong>Observable</strong>: the per-iteration violation and
  overflow counts in any routing log are this loop's progress
  metric.
""",
    },
    {
        "slug": "antenna-repair",
        "card": "Stop long wires charging gates during etch, with diodes or layer hops.",
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "scope": "detailed",
        "level": "industry",
        "name": "Antenna Effect Repair",
        "family": "signoff",
        "year": "1990s onward",
        "who": "every sign-off flow",
        "chips": [
            ("diff-easy", "manufacturing physics, not operation"),
        ],
        "summary": (
            "During plasma etch, a long metal wire connected to a gate but "
            "not yet to its driver collects charge that can rupture the "
            "gate oxide. The check is an area ratio per layer; the "
            "repairs are diode insertion and layer hopping."
        ),
        "lab": None,
        "refs": [
            ("Antenna effect (Wikipedia)",
             "https://en.wikipedia.org/wiki/Antenna_effect"),
            ("Antenna checking and repair in OpenROAD (ant)",
             "https://openroad.readthedocs.io/en/latest/main/src/ant/README.html"),
        ],
        "body": """
## The idea

The antenna effect is a manufacturing hazard, not an operating one.
Layers are fabricated bottom up. When a metal layer is plasma-etched,
its wires collect charge; a wire already connected downward to a
transistor gate, but not yet connected to the driver that will
eventually discharge it (the driver's connection arrives on a higher
layer, later), can only discharge through the gate's thin oxide, and
enough charge ruptures it. The check is a ratio, evaluated per layer
for every net:

<div class="eq">antenna ratio(net, layer) = collecting metal area on that layer / connected gate area</div>
<ul class="eq-legend">
<li><code>collecting metal area</code> the area of the net's wire on the layer being etched (some processes use perimeter or side-wall area instead)</li>
<li><code>connected gate area</code> total gate oxide area the wire is connected to through lower layers at that point in fabrication</li>
<li>the ratio must stay below a process-specified limit; violations are per net, per layer</li>
</ul>

## The recipe

**Step 1 (check).** After detailed routing, compute the ratio for
every net on every layer using the fabrication order (only metal
connected to the gate through lower layers counts).

**Step 2 (repair by diode).** For a violating net, insert a small
reverse-biased diode connected to the net near the gate; during etch
it drains the charge into the substrate, in operation it is off and
adds only a little capacitance. Requires a free placement site.

**Step 3 (repair by layer hopping).** Alternatively, break the long
run by jumping to a higher layer and back near the gate: only the
short lower piece touches the gate during the lower layer's etch, and
the long upper piece is etched after the gate is already connected
to the driver's diffusion. Costs vias and a track on another layer.

**Step 4 (iterate).** Re-check; repeat until no violations remain.

## Watch it work: one long wire, one gate

A driver, a long M2 run, and a gate. The walkthrough shows the etch
charge, the ratio arithmetic against the limit, and both repairs.

<div class="walk-fig" data-walk="antenna-repair"></div>

## Pros, cons, and the trade-off

<div class="pros-cons">
<div class="pc-card pc-pros">
<h3>Strengths</h3>
<ul>
<li><strong>Cheap check</strong>: an area ratio per net per layer, computed in one pass over the routing.</li>
<li><strong>Diodes are local and simple</strong>: one cell near the gate, no re-routing.</li>
<li><strong>Layer hopping needs no area</strong>: the repair happens in the routing itself.</li>
</ul>
</div>
<div class="pc-card pc-cons">
<h3>Weaknesses</h3>
<ul>
<li><strong>Diodes need sites</strong>: in a dense region there may be no free placement site near the gate.</li>
<li><strong>Diodes add load</strong>: extra capacitance on the net, which matters on critical paths.</li>
<li><strong>Hopping consumes routing resources</strong>: vias and upper-layer tracks in a possibly congested region, and it can perturb timing.</li>
</ul>
</div>
</div>

<div class="tradeoff-box">
<h3>The trade-off</h3>
<p>Antenna repair is a small algorithm with an outsized place in the flow because its failure mode is silent: a violated ratio does not fail simulation, it fails on the wafer. The two repairs trade area against routing resources, and every sign-off flow runs the check because no other stage will catch it.</p>
</div>

## Is it actually used today?

The evidence for antenna checking and repair comes from open-source
tools, the process design kits that define the limits, and the
sign-off checklist.

- <strong>Open source</strong>: OpenROAD includes an [antenna checker and repair](https://openroad.readthedocs.io/en/latest/main/src/ant/README.html) module that computes ratios per net and layer and
  inserts diodes; the flow scripts run it after detailed routing.
- <strong>The process</strong>: every PDK (Process Design Kit)
  specifies antenna rules and ratio limits, and foundry sign-off
  requires a clean antenna check.
- <strong>Commercial</strong>: documented. Antenna checking and
  repair (diode insertion, layer hopping) are standard sign-off
  steps in every production flow.
""",
    },
    {
        "slug": "lee",
        "card": "Breadth-first wavefront from the source until it reaches the target.",
        "scope": "both",
        "level": "foundational",
        "name": "Lee Algorithm",
        "family": "historical",
        "year": "1961",
        "who": "Lee",
        "chips": [
            ("diff-easy", "shortest path guaranteed"),
            ("diff-hard", "explores the most"),
        ],
        "summary": (
            "Breadth-first wavefront expansion: rings radiate from the "
            "source until one touches the target, then the path traces "
            "back. The founding algorithm of the field."
        ),
        "lab": {"href": _LAB + "?algo=bfs", "label": "Open in the maze lab →"},
        "extra_scripts": ["/static/explore/lee-walkthrough.js"],
        "refs": [
            ("Wikipedia: Lee algorithm",
             "https://en.wikipedia.org/wiki/Lee_algorithm"),
            ("TritonRoute journal paper (documents its A*-based search)",
             "https://vlsicad.ucsd.edu/Publications/Journals/j133.pdf"),
            ("OpenROAD detailed-routing documentation",
             "https://openroad.readthedocs.io/en/latest/main/src/drt/README.html"),
        ],
        "body": """
## The idea

Model the routing surface as a grid of cells, some blocked. From the
source cell, expand a wave: mark every free neighbor with distance 1,
their free neighbors with distance 2, and so on, a breadth-first search
whose frontier forms rings of equal distance. The moment the target is
labeled, stop and *backtrace*: from the target, repeatedly step to any
neighbor with a smaller label until the source is reached. The labels
guarantee each step descends by exactly one, so the traced path's
length equals the target's label, which breadth-first order guarantees
is the minimum possible.

<div class="walk-fig" data-mode="model"></div>

## Watch it work: the wave

Step through the expansion below. Each press of **Step** advances one
distance ring; the number in each cell is its distance from the source.
Three things to notice as you go: the wave spreads in *every*
direction, including away from the target; it flows around the wall
through the single gap like water; and the moment the target gets a
label, that label *is* the shortest-path length, no checking required.

<div class="walk-fig" data-mode="expand"></div>

## Watch it work: the backtrace

Now run the second phase. Starting at the target, each step moves to
any neighbor whose label is exactly one smaller, downhill on the
distance field, until the source is reached. Where two neighbors tie,
either choice is fine: every downhill walk has exactly the same length,
which is why Lee needs no tie-breaking cleverness to stay optimal.

<div class="walk-fig" data-mode="trace"></div>

## Pros, cons, and the trade-off

<div class="pros-cons">
<div class="pc-card pc-pros">
<h3>Strengths</h3>
<ul>
<li><strong>Complete</strong>: if any path exists, the wave finds it.
No configuration, no luck.</li>
<li><strong>Optimal</strong>: the found path is provably shortest;
the target's label is the proof.</li>
<li><strong>Simple</strong>: a queue, a grid, and two passes. Easy to
implement correctly, easy to trust.</li>
<li><strong>Unconditionally robust</strong>: any obstacle shape, any
pin placement, no tuning parameters at all.</li>
</ul>
</div>
<div class="pc-card pc-cons">
<h3>Weaknesses</h3>
<ul>
<li><strong>Explores everything</strong>: the wave visits cells
proportional to the <em>area</em> around the pins, not the path
length. Thousands of cells settled for a two-hundred-cell route.</li>
<li><strong>Memory per cell</strong>: a label for every grid cell
(classically softened by Akers' trick of storing labels modulo 3,
since the sequence 1,1,2,2,... still backtraces).</li>
<li><strong>Two pins at a time</strong>: multi-terminal nets need a
Steiner decomposition first.</li>
<li><strong>Uniform costs only</strong>: no natural way to price vias,
bends, or congestion. That upgrade is exactly what A* (A-star)
adds.</li>
</ul>
</div>
</div>

<div class="tradeoff-box">
<h3>The trade-off</h3>
<p>Lee sits at the certainty-over-speed extreme of maze routing. Every
successor pays for its exploration savings by giving something up:
Hadlock and A* (A-star) keep the guarantees but need grid structure or
an admissible estimate, Soukup surrenders shortest paths, Hightower
surrenders completeness. Reach for Lee when being right matters more
than being fast, and as the fallback when cleverer searches fail. See
it live in the maze lab: Macro maze preset, watch the cells-explored
counter.</p>
</div>

## Lineage

Everything in this family is an answer to Lee's exploration cost:
Hadlock reorders the wave by detours, Soukup abandons breadth-first
sprinting until blocked, and A* (A-star) prices distance-to-go into
the queue. All keep his grid, his backtrace, and usually his
guarantee.

## Is it actually used today?

The literal 1961 algorithm and what ships differ on one point: cost
uniformity. Production routing costs are never uniform (a via costs more than a straight
step, wrong-way segments on a directioned layer cost more still,
congested edges carry penalties), and the moment edges are weighted,
plain breadth-first search stops being correct: real routers run
Dijkstra and A* (A-star) instead ([TritonRoute](https://openroad.readthedocs.io/en/latest/main/src/drt/README.html) documents an A*-based
search; [Dr. CU](https://github.com/cuhk-eda/dr-cu) runs Dijkstra over a sparse grid graph). What survives
of Lee:

- **The skeleton.** Wavefront expansion plus backtrace is still the
  structure of every point-to-point engine, which is why the field
  calls that method "maze routing" in his honor.
- **The last rung of the escalation ladder.** Detailed routers try
  pattern routes first and widen the search when they fail; the final
  explore-everything rung is Lee-like in spirit, though even it runs
  weighted.
- **Genuinely uniform-cost niches.** Single-layer escape routing, some
  package and printed-circuit-board subproblems, and quick
  reachability checks still use the plain breadth-first form.

Lee is used today the way Dijkstra is used in navigation: nobody runs
the textbook version, everybody runs its descendants.
""",
    },
    {
        "slug": "hadlock",
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "scope": "detailed",
        "level": "foundational",
        "name": "Hadlock's Algorithm",
        "family": "historical",
        "year": "1977",
        "who": "Hadlock",
        "chips": [
            ("diff-easy", "shortest path guaranteed"),
            ("diff-easy", "explores little"),
        ],
        "summary": (
            "Order the search by detour number, how many moves a path "
            "has spent walking away from the target; minimal detours "
            "still means shortest path, found with far fewer cells "
            "settled."
        ),
        "lab": {"href": _LAB + "?algo=hadlock", "label": "Open in the maze lab →"},
        "refs": [
            ("Wikipedia: Hadlock's algorithm",
             "https://en.wikipedia.org/wiki/Hadlock%27s_algorithm"),
        ],
        "body": """
## The idea

On an obstacle-free grid, the shortest path length equals the
Manhattan distance M between the pins. Obstacles force *detours*:
moves that increase the distance to the target. For any path with d
detour moves,

<div class="eq">path length = M + 2d</div>
<ul class="eq-legend">
<li><code>M</code> Manhattan distance between the two pins</li>
<li><code>d</code> number of detour moves: steps that increase the distance to the target</li>
</ul>

because each step away from the target must be compensated by one
additional step toward it. Minimizing path length is therefore
equivalent to minimizing detour count. Hadlock's algorithm expands
cells in order of detour count: all cells reachable with zero detours
first, then one, then two. The implementation is a zero-one
breadth-first search over a double-ended queue (deque): moves that
reduce the distance to the target join the front (cost 0, current
detour level), moves that increase it join the back (cost 1, next
level). The deque therefore stays sorted by detour count without a
priority queue, holding at most two consecutive detour values at any
moment.

## The recipe

**Step 1 (label by detour).** Give the source detour number d = 0.
A cell's detour number is how many of the moves on its best path so
far led away from the target (Manhattan distance to the target
increased).

**Step 2 (expand cheapest first, with a deque).** Take the cell with
the smallest d. For each free neighbour: if the move goes toward the
target, the neighbour keeps the same d and goes to the front of the
deque (double-ended queue); if it goes away, the neighbour gets
d + 1 and goes to the back. The front of the deque therefore always
holds the current detour level.

**Step 3 (stop at the target).** The first time the target is
reached, its path has the minimum detour count, and by the identity
length = M + 2d (M the Manhattan distance) it is a shortest path.
Backtrace as in Lee.

## Watch it work: the deque in action

The scenario matches the A* page's queue diagram, so the two data
structures can be compared directly. The right panel shows the deque
itself, front at the top. Pops always occur at the front. A neighbor
that reduces the distance to the target enters at the front with an
unchanged detour count (cost 0); a neighbor that increases it enters
at the back with detour count + 1 (cost 1). The panel shows the
resulting invariant directly: at any moment the deque holds at most
two consecutive detour values, front to back, which is why no
priority queue is needed.

<div class="walk-fig" data-walk="hadlock-deque"></div>

## Exploration cost, and the exact relation to A*

Cells with detour count zero form a staircase-shaped corridor between
the pins; the search expands outside it only where obstacles impose a
higher detour count. On this site's macro-maze benchmark, Hadlock
settles 769 cells versus 2,843 for Lee at equal path length.

The relation to A* (A-star) is an identity, not an analogy. A path
reaching cell n with t toward-moves and a away-moves has
g(n) = t + a and h(n) = M − t + a, so

<div class="eq">f(n) = g(n) + h(n) = M + 2 · d(n)</div>
<ul class="eq-legend">
<li><code>f, g, h</code> the A* quantities: priority, cost so far, Manhattan estimate</li>
<li><code>d(n)</code> detour count of the best known path to cell n</li>
</ul>

Expansion by detour count is therefore the same ordering as A* under
the Manhattan estimate. The count difference (769 versus 1,208 on the
macro maze) comes only from how ties are broken among cells with
equal f:

- Cells with equal f can be expanded in any order without affecting
  the path length. Only the settled-cell count changes.
- Both algorithms must settle every cell with f below the final path
  length. The difference comes from the last f level, where the search
  stops as soon as the target is settled.
- Within that level, Hadlock expands the most recently discovered cell
  first (the deque is last-in-first-out for toward-moves), so it runs
  down one corridor straight to the target.
- A* breaks ties by smaller h, which spreads work across several
  frontier branches and settles more cells before reaching the
  target.

## Pros, cons, and the trade-off

<div class="pros-cons">
<div class="pc-card pc-pros">
<h3>Strengths</h3>
<ul>
<li><strong>Shortest path guaranteed</strong>: expansion in f order
with an admissible estimate preserves optimality.</li>
<li><strong>Minimal exploration on uniform grids</strong>:
settled-cell counts at or below A* on the bundled benchmarks, due to
detour-level tie-breaking.</li>
<li><strong>No parameters</strong>: no heuristic choice and no
weights; grid geometry fully determines behavior.</li>
<li><strong>Simple tooling</strong>: a double-ended queue with
constant-time operations replaces a priority queue.</li>
</ul>
</div>
<div class="pc-card pc-cons">
<h3>Weaknesses</h3>
<ul>
<li><strong>Unit-cost grids only</strong>: the identity
path length = M + 2d requires equal step costs and the Manhattan
metric.</li>
<li><strong>No cost generality</strong>: via, bend, layer-direction,
and congestion costs cannot be expressed as detour counts; the
cost-general form of the same ordering is A*.</li>
<li><strong>Two-pin searches</strong>: multi-terminal nets require a
Steiner decomposition first.</li>
<li><strong>Few implementations</strong>: the A* family offers far
more existing implementations and extensions.</li>
</ul>
</div>
</div>

<div class="tradeoff-box">
<h3>The trade-off</h3>
<p>Hadlock is optimal and maximally directed for uniform-cost grids,
but the identity path length = M + 2d holds only when every step costs
the same. Weighted edges (vias, direction penalties, congestion
prices) invalidate the identity; the general formulation of the same
f-ordered expansion is A* with an admissible estimate. Production
routing graphs are weighted, so production tools use A*.</p>
</div>

## Is it actually used today?

The evidence on Hadlock's algorithm covers open-source tools,
commercial documentation, and the teaching literature.

- <strong>Why not</strong>: production routing graphs are
  cost-weighted (vias, layer direction, congestion), and detour
  counting measures only uniform steps. Production point-to-point
  search uses cost-general Dijkstra and A* (A-star) engines.
- <strong>Where it appears</strong>: teaching, where it isolates the
  effect of search ordering from cost modeling; specialized
  uniform-cost grid problems; and analysis, since on unit grids it is
  A* with the Manhattan estimate plus a specific tie-breaking rule.
- <strong>Interactive</strong>: it runs in this site's maze lab; its
  settled-cell counts on the bundled presets are the lowest of the
  four algorithms.
""",
    },
    {
        "slug": "soukup",
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "scope": "detailed",
        "level": "foundational",
        "name": "Soukup's Algorithm",
        "family": "historical",
        "year": "1978",
        "who": "Soukup",
        "chips": [
            ("diff-medium", "path not guaranteed shortest"),
            ("diff-easy", "fastest of the classics"),
        ],
        "summary": (
            "Sprint greedily straight toward the target; when stuck, "
            "fall back to a Lee-style escape wave just long enough to "
            "get closer, then sprint again. Roughly 10-50x faster than "
            "Lee in its day, minus the shortest-path guarantee."
        ),
        "lab": {"href": _LAB + "?algo=soukup", "label": "Open in the maze lab →"},
        "refs": [
            ("Soukup, 'Fast maze router' (search)",
             "https://scholar.google.com/scholar?q=Soukup+fast+maze+router+DAC+1978"),
        ],
        "body": """
## The idea

Soukup's router alternates between two modes. In *sprint* mode it
moves greedily: from the current cell, step to a free, unvisited
neighbor that reduces the distance to the target, marking cells
visited along the way. Sprinting costs one cell visit per cell of
progress and requires no queue or labels. When no free improving
neighbor exists, the router switches to *escape* mode, and escape mode
is [Lee's algorithm](/explore/algorithms/routing/lee): the same
breadth-first wave, expanding ring by ring, except that it starts from
the set of all visited cells instead of a single source, and it is cut
short at the first cell whose distance to the target is smaller than
the stuck point's. The sprint resumes from that cell. Soukup is
therefore Lee's algorithm used sparingly: full wave expansion only in
the short stretches where greed fails.

## The recipe

**Step 1 (sprint).** From the current cell, move straight toward the
target (the neighbour that reduces distance), without a queue and
without labels, as long as such a move is free.

**Step 2 (escape on collision).** When the sprint hits an obstacle,
switch to a Lee-style breadth-first wave from the stall cell,
expanding ring by ring until the wave reaches any cell from which a
toward-the-target move is free again.

**Step 3 (resume and repeat).** Sprint again from that cell.
Alternate the two modes until the target is reached, then backtrace.
The escape waves guarantee completeness; the sprints forfeit the
shortest-path guarantee.

## Watch it work: sprint, stall, escape

Sprint moves are green, one frame each. Escapes step ring by ring:
the amber cells are Lee's wave grown from the visited set, and each
carries its Manhattan distance to the target. The stuck cell is red
and shows the threshold. The wave stops at the first cell whose label
is smaller than the threshold; that inequality, visible in the
numbers, is the entire selection criterion.

<div class="walk-fig" data-walk="soukup"></div>

## Completeness without optimality

The escape wave is an exhaustive breadth-first search from the visited
set, so if any path to the target exists, the escape finds a cell
strictly closer to it. Each escape therefore decreases the minimum
distance achieved, the loop terminates, and the router is complete.
Optimality does not hold: sprint moves are committed without comparing
path costs, so the concatenation of sprint segments and escape paths
is in general longer than a shortest path. The maze lab quantifies the
overhead on its presets: 200 versus Lee's 194 on the macro maze, 144
versus 114 on the shared channel.

## Pros, cons, and the trade-off

<div class="pros-cons">
<div class="pc-card pc-pros">
<h3>Strengths</h3>
<ul>
<li><strong>Fast</strong>: the 1978 paper reports 10-50x speedups over
Lee; open regions are traversed at one cell visit per cell of
progress, with no search.</li>
<li><strong>Complete</strong>: the breadth-first escape is exhaustive,
so a route is found whenever one exists.</li>
<li><strong>Minimal state</strong>: no frontier structure during
sprints; memory stays small.</li>
<li><strong>Architecture-setting</strong>: inexpensive directed
progress with an exact fallback became the standard organization of
later routers.</li>
</ul>
</div>
<div class="pc-card pc-cons">
<h3>Weaknesses</h3>
<ul>
<li><strong>Not shortest</strong>: sprint moves are committed without
cost comparison; the measured overhead appears in the maze lab's
congested presets.</li>
<li><strong>No quality bound</strong>: path shape depends on sprint
order and obstacle geometry; the detour is not bounded.</li>
<li><strong>Uniform costs only</strong>: like the other pure-grid
classics, via, bend, and congestion costs have no representation.</li>
<li><strong>Superseded as an engine</strong>: cost-weighted A*
(A-star) with pattern-route front ends took its role.</li>
</ul>
</div>
</div>

<div class="tradeoff-box">
<h3>The trade-off</h3>
<p>Soukup removes exactly one of Lee's guarantees: optimality.
Completeness is preserved by the escape wave, and runtime falls
because open regions are traversed without search. Its lasting
contribution is architectural: modern routers use the same structure,
inexpensive directed attempts first, exhaustive search only on
failure.</p>
</div>

## Is it actually used today?

The evidence separates the literal Soukup algorithm from its two-mode
structure; the two have had different fates.

- <strong>Pattern routing uses the same structure</strong>: modern
  global and detailed routers attempt L-, Z-, and U-shaped
  connections directly and escalate to maze search only on failure.
- <strong>Its deployment era was real</strong>: printed-circuit-board
  and early gate-array routers of the 1980s shipped Soukup-style
  hybrids when Lee's runtime was unaffordable.
- <strong>Interactive</strong>: it runs in this site's maze lab; the
  congested presets show the wirelength cost of committing sprint
  moves without cost comparison.
""",
    },
    {
        "slug": "mikami-tabuchi",
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "scope": "detailed",
        "level": "foundational",
        "name": "Mikami-Tabuchi Line Search",
        "family": "historical",
        "year": "1968",
        "who": "Mikami and Tabuchi",
        "chips": [
            ("diff-easy", "finds a path if one exists"),
            ("diff-medium", "paths not shortest"),
        ],
        "summary": (
            "Shoot probe lines from both pins; from every point of every "
            "probe, shoot perpendiculars next iteration; when source and "
            "target families intersect, join. Complete like Lee, far "
            "lighter on memory."
        ),
        "lab": None,
        "refs": [
            ("Mikami and Tabuchi, 'A computer program for optimal routing of printed circuit connectors' (search)",
             "https://scholar.google.com/scholar?q=Mikami+Tabuchi+computer+program+optimal+routing+printed+circuit"),
        ],
        "body": """
## The idea

Grid methods pay for the routing plane cell by cell; in 1968 that
memory was the binding constraint. Mikami and Tabuchi's router stores
*line segments* instead. Level 0: through each pin, draw the maximal
free horizontal and vertical lines. Level i + 1: from every point of
every level-i line, draw the perpendicular free lines, each recording
its parent. Two families grow, one rooted at each pin. When a line
from the source family intersects a line from the target family, a
route exists: follow parent pointers from the crossing back to both
pins. Memory is proportional to the number of segments; on the
scenario below, the level-0 state is 4 segments where Lee would store
138 cell labels.

## The recipe

**Step 1 (level-0 trial lines).** Through the source, draw the
maximal free horizontal and vertical line segments; do the same
through the target. These four lines are level 0 of two families.

**Step 2 (test for intersection).** If any source-family line
crosses any target-family line, a path exists: follow the two lines
to the crossing.

**Step 3 (probe and iterate).** Otherwise, from every grid point on
every current line, draw the maximal free perpendicular segments:
these are the next level (level i + 1). Return to Step 2. Every
free point of the plane is eventually covered, so a path is found
whenever one exists.

## Watch it work: probes until the families cross

The frames follow one search: level-0 trial lines, level-1
perpendicular probes, the first inter-family intersection, and the
joined path.

<div class="walk-fig" data-walk="mikami"></div>

## Bends, length, and completeness

The crossing level determines the path's shape. Joining a level-i
source line with a level-j target line produces a path with

<div class="eq">segments = i + j + 2,&nbsp;&nbsp;&nbsp;bends = i + j + 1</div>
<ul class="eq-legend">
<li><code>i, j</code> probe levels of the two crossing lines (0 for the initial trial lines through the pins)</li>
</ul>

Because levels expand in order, the first crossing found has minimum
total level, so the method minimizes bend count. Path length is not
controlled: a low-bend route can be long, and no length guarantee
exists. Completeness matches Lee: probing from every point of every
line eventually sweeps every reachable cell, so a route is found
whenever one exists.

## Pros, cons, and the trade-off

<div class="pros-cons">
<div class="pc-card pc-pros">
<h3>Strengths</h3>
<ul>
<li><strong>Complete</strong>: level expansion covers every reachable
cell; a route is found whenever one exists.</li>
<li><strong>Memory proportional to segments</strong>: typically orders
of magnitude below cell count.</li>
<li><strong>Minimum bend count</strong>: the first crossing has
minimum total level, and bends equal total level plus one.</li>
<li><strong>Bidirectional</strong>: both pins grow families, halving
the effective search depth.</li>
</ul>
</div>
<div class="pc-card pc-cons">
<h3>Weaknesses</h3>
<ul>
<li><strong>Not shortest</strong>: path length is uncontrolled; only
bends are minimized.</li>
<li><strong>Probe growth</strong>: perpendiculars from every point of
every line multiply rapidly in cluttered regions.</li>
<li><strong>No cost model</strong>: weighted edges, vias, and
congestion prices have no representation on continuous segments.</li>
<li><strong>Superseded on-chip</strong>: cell grids and A* (A-star)
took over once memory stopped being the constraint.</li>
</ul>
</div>
</div>

<div class="tradeoff-box">
<h3>The trade-off</h3>
<p>Mikami-Tabuchi keeps Lee's completeness while replacing the cell
grid with a segment set, exchanging length optimality for minimal
memory and minimal bend count. The constraint that motivated the
design, memory, disappeared; grid methods absorbed its on-chip niche,
and the segment representation persisted where planes are sparse.</p>
</div>

## Is it actually used today?

The evidence for Mikami-Tabuchi splits by domain: chip routing, and
the adjacent territories where the line representation persists.

- <strong>Printed-circuit-board lineage</strong>: line probing powered
  board autorouters long after chip routers moved to grids, and
  escape-line reasoning persists in board-level pin-escape
  heuristics.
- <strong>Package and escape routing</strong>: sparse, obstacle-light
  planes where segment representations remain efficient.
- <strong>Teaching</strong>: the standard pairing with Hightower,
  which prunes the same probe scheme to a single escape point per
  line and loses completeness in exchange for speed.
""",
    },
    {
        "slug": "hightower",
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "scope": "detailed",
        "level": "foundational",
        "name": "Hightower's Algorithm",
        "family": "historical",
        "year": "1969",
        "who": "Hightower",
        "chips": [
            ("diff-medium", "can miss existing paths"),
            ("diff-easy", "very fast and lean"),
        ],
        "summary": (
            "Line search that probes only from carefully chosen escape "
            "points past each blocking obstacle rather than from every "
            "point: faster and leaner than Mikami-Tabuchi, but "
            "completeness is sacrificed."
        ),
        "lab": None,
        "refs": [
            ("Hightower, 'A solution to line-routing problems on the continuous plane' (search)",
             "https://scholar.google.com/scholar?q=Hightower+solution+line+routing+problems+continuous+plane"),
        ],
        "body": """
## The idea

Mikami-Tabuchi's completeness comes from brute breadth: perpendiculars
from *every* point of every line. Hightower kept the bidirectional
line-probing skeleton but probes only from *escape points*: for each
blocked line, choose the point just past the edge of the obstacle that
blocked it, and shoot the single perpendicular there that escapes the
blockage. One or two new lines per iteration instead of hundreds; the
data structure stays tiny and the router runs blisteringly fast on the
sparse boards of its era.


## The recipe

**Step 1 (escape lines).** Through the source and through the
target, draw the maximal free horizontal and vertical lines, as in
Mikami-Tabuchi, and test for a crossing between the two families.

**Step 2 (escape points, not every point).** If they do not cross,
pick a single *escape point* per line: a point just past the edge of
the obstacle that blocked the line, chosen so a perpendicular line
through it can clear that obstacle. Draw the perpendicular through
that one point only.

**Step 3 (iterate, without a guarantee).** Repeat from the new
lines. Memory stays tiny because only one point per line spawns a
probe, but the heuristic choice can skip the very point a path
needs: unlike Mikami-Tabuchi, the search can fail on a routable
net.

## Watch it work: escape points only

The frames follow the Mikami-Tabuchi walkthrough's progression on the
same scenario: level-0 trial lines, probes, the first inter-family
intersection, and the joined path. The difference is the probe rule:
one chosen escape point per blocked line instead of every point.

<div class="walk-fig" data-walk="hightower"></div>

## Pros, cons, and the trade-off

<div class="pros-cons">
<div class="pc-card pc-pros">
<h3>Strengths</h3>
<ul>
<li><strong>Very fast</strong>: constant new segments per iteration; the leanest of all the classics.</li>
<li><strong>Minimal memory</strong>: even fewer segments than Mikami-Tabuchi.</li>
<li><strong>Effective on sparse boards</strong>: on the low-obstacle problems of its era, it almost always connected.</li>
<li><strong>Architecturally influential</strong>: prune hard, keep an exact fallback: the layered structure every later router adopted.</li>
</ul>
</div>
<div class="pc-card pc-cons">
<h3>Weaknesses</h3>
<ul>
<li><strong>Incomplete</strong>: staggered-baffle configurations exist where the only escape passes through points the heuristic never probes; it reports failure on routable pins.</li>
<li><strong>Needs a safety net</strong>: practical deployments backed it with a maze router for the misses.</li>
<li><strong>Fragile heuristic</strong>: escape-point choice determines the outcome, and no choice rule is safe.</li>
<li><strong>Same cost-model limits</strong> as all line search: no weighted edges, no via pricing.</li>
</ul>
</div>
</div>

<div class="tradeoff-box">
<h3>The trade-off</h3>
<p>Hightower stands one sacrifice beyond Soukup in the taxonomy: Soukup gave up shortest paths, Hightower gives up finding paths at all. In exchange it was the fastest thing of its decade, and its real bequest is the pattern of a fast unsafe method guarded by a slow safe one.</p>
</div>

## Is it actually used today?

The evidence for Hightower's algorithm is historical and
pedagogical rather than from shipping tools.

- <strong>Its niche closed</strong>: incompleteness is disqualifying
  for silicon sign-off, and the boards sparse enough for it to shine
  stopped being the hard problem.
- <strong>Its pattern shipped everywhere</strong>: try-cheap-first
  with an exact fallback is the standing architecture of modern
  routing (pattern route, then windowed search, then full maze).
- <strong>Its role now</strong>: the cautionary example in every
  routing lecture, paired with Mikami-Tabuchi to show exactly what
  completeness costs and buys.
""",
    },
    {
        "slug": "left-edge",
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "scope": "detailed",
        "level": "foundational",
        "name": "Left-Edge Channel Routing",
        "family": "historical",
        "year": "1971",
        "who": "Hashimoto and Stevens; Deutsch (dogleg)",
        "chips": [
            ("diff-easy", "optimal track count (no vertical conflicts)"),
        ],
        "summary": (
            "Sort net segments by left endpoint and pack them greedily "
            "into tracks like interval scheduling, respecting vertical "
            "constraints; dogleg splitting breaks the cycles. The "
            "classic of the channel-routing era."
        ),
        "lab": None,
        "refs": [
            ("Wikipedia: Left edge algorithm",
             "https://en.wikipedia.org/wiki/Left_edge_algorithm"),
            ("Deutsch, 'A dogleg channel router' (search)",
             "https://scholar.google.com/scholar?q=Deutsch+dogleg+channel+router"),
        ],
        "body": """
## The setting

Standard-cell chips of the 1970s and 1980s alternated rows of cells
with empty *channels*: rectangular routing regions with pins fixed on
the top and bottom edges. Inside a channel every net is wired the same
way: one horizontal *trunk* on one of the channel's tracks, plus
vertical stubs connecting the trunk to its pins. The number of tracks
used is the channel's height, so every track saved was chip area
saved. Channel routing was the central detailed-routing problem of
its era, and left-edge is its classic algorithm.

<div class="walk-fig" data-walk="channel-chip"></div>

## The abstraction: nets become intervals

Ignore the vertical stubs and each net reduces to the horizontal span
between its leftmost and rightmost pin:

<div class="eq">net &rarr; interval [l, r]</div>
<ul class="eq-legend">
<li><code>l</code> column of the net's leftmost pin</li>
<li><code>r</code> column of the net's rightmost pin</li>
</ul>

Two nets can share a track exactly when their intervals do not
overlap. Packing intervals into the fewest tracks under that rule is
interval-graph coloring, one of the few coloring problems a greedy
algorithm solves optimally.

## The recipe

**Step 1 (sort).** Sort the intervals by left endpoint. The sort key
is the algorithm's name.

**Step 2 (first fit).** Take the intervals in sorted order. For each,
scan the existing tracks from the top and place the trunk on the
first track that fits:

<div class="eq">[l, r] fits on a track when r_last &lt; l</div>
<ul class="eq-legend">
<li><code>r_last</code> right endpoint of the last interval already placed on that track</li>
</ul>

**Step 3 (open).** If no track fits, open a new track below the
existing ones and place the trunk there.

The result is provably optimal, measured against the channel's
*density*:

<div class="eq">density = max over columns c of the number of intervals crossing c</div>
<ul class="eq-legend">
<li><code>crossing c</code> an interval [l, r] crosses column c when l &le; c &le; r</li>
</ul>

Every net crossing a column needs its own track at that column, so no
routing can use fewer tracks than the density. And the greedy sweep
never uses more: it opens a new track only when every existing track
overlaps the current interval's left endpoint, which means that many
intervals cross that column at once. Tracks used equals density.

### Vertical constraints and doglegs

Where two nets have pins in the same column, the net pinned on top
must run its trunk above the net pinned on the bottom, or their
vertical stubs would overlap. These *vertical constraints* restrict
which track the greedy may choose; while they stay acyclic the sweep
survives. Cycles (net A above net B in one column, B above A in
another) make one-trunk-per-net routing impossible. Deutsch's dogleg
router (1976) breaks the cycles by splitting a net's trunk at pin
columns into several pieces on different tracks, in practice landing
within a track or two of density even on hard channels; his benchmark
channel, "Deutsch's difficult example", became the standard test of
the era.

## Watch it work: the greedy sweep

Six nets. The walkthrough shows the channel, then the sorted interval
list, then one placement per step with the fit test's arithmetic
spelled out; the final frame checks the result against the density
bound. Vertical constraints are left out so the optimality argument
is visible in pure form.

<div class="walk-fig" data-walk="leftedge"></div>

## Pros, cons, and the trade-off

<div class="pros-cons">
<div class="pc-card pc-pros">
<h3>Strengths</h3>
<ul>
<li><strong>Provably optimal</strong> track count when vertical constraints are absent: greedy meets the density lower bound.</li>
<li><strong>Near-linear and simple</strong>: a sort and one sweep.</li>
<li><strong>A reusable idea</strong>: interval packing by left edge solves problems far beyond channels.</li>
<li><strong>Extensible</strong>: doglegs handle constraint cycles with small overhead.</li>
</ul>
</div>
<div class="pc-card pc-cons">
<h3>Weaknesses</h3>
<ul>
<li><strong>Its world is gone</strong>: over-the-cell routing on many metal layers dissolved channels decades ago.</li>
<li><strong>Model rigidity</strong>: one trunk per net (absent doglegs), fixed pins on two edges: strong assumptions modern layouts violate everywhere.</li>
<li><strong>Vertical-constraint cycles</strong> defeat the pure algorithm; dogleg splitting is required.</li>
<li><strong>Two-layer thinking</strong>: the elegant optimality does not survive many-layer freedom.</li>
</ul>
</div>
</div>

<div class="tradeoff-box">
<h3>The trade-off</h3>
<p>Left-edge is exactness inside a restricted model: within the channel abstraction it is provably optimal, and when the abstraction was no longer used the optimality lost its application while the packing idea moved into other problems. A perfect lesson in how algorithms outlive the worlds that created them.</p>
</div>

## Is it actually used today?

The evidence for left-edge separates chip signal routing, where the
channel model it was built for ended decades ago, from the places the
interval-packing core still runs.

- <strong>Inside detailed routers</strong>: track assignment, packing
  route segments into tracks within a panel, is interval packing, and
  left-edge-style sweeps are standard tooling there.
- <strong>Beyond routing</strong>: register allocation over live
  ranges, interval scheduling, and channel-like resource assignment
  problems reuse the identical greedy argument.
- <strong>Teaching and exams</strong>: the cleanest optimality proof
  in physical design, and a perennial interview and homework
  favorite.
""",
    },
    {
        "slug": "x-architecture",
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "scope": "both",
        "level": "research",
        "name": "The X Architecture: Diagonal Routing",
        "family": "historical",
        "year": "2001-2006",
        "who": "the X Initiative (Teig; Toshiba, Cadence, and partners)",
        "chips": [("diff-easy", "the research direction that lost")],
        "summary": (
            "Add 45-degree wiring layers and cut wirelength about 20 "
            "percent: the geometry worked, the arithmetic was real, and "
            "manufacturing plus the ecosystem killed it anyway. The "
            "catalog's example of a research direction that was not adopted."
        ),
        "lab": None,
        "refs": [
            ("Teig, 'The X architecture' (search)",
             "https://scholar.google.com/scholar?q=Teig+X+architecture+diagonal+interconnect+SLIP"),
            ("X Initiative (Wikipedia)",
             "https://en.wikipedia.org/wiki/X_Initiative"),
        ],
        "body": """
## The idea

Manhattan wiring pays |dx| + |dy| for every connection. Allow wires
at 45 degrees and the same connection costs less:

<div class="eq">octilinear length = |dx − dy| + min(dx, dy) × √2, versus Manhattan dx + dy</div>
<ul class="eq-legend">
<li><code>dx, dy</code> the connection's horizontal and vertical spans</li>
<li>for a square connection (dx = dy) the saving is 1 − √2/2 ≈ 29 percent; averaged over real nets the X Initiative's studies claimed around 20 percent wirelength, with matching delay and power</li>
</ul>

The X architecture (announced 2001 by a consortium around Simplex's
Steve Teig, with Toshiba and Cadence among the members) proposed
exactly this: keep the lower layers Manhattan, and run the upper
routing layers at 45 degrees. Chips were actually fabricated; the
geometry and the routers worked.

## Why it lost

Nothing in the mathematics failed. Everything around it did:

- Lithography, masks, and OPC (Optical Proximity Correction) were
  built and tuned for two orthogonal directions; diagonal features
  printed worse and cost more at exactly the time subwavelength
  printing was getting hard.
- Vias between diagonal and Manhattan layers, and the enclosure
  rules around them, were awkward and area-hungry.
- Every router, extractor, DRC (Design Rule Check) deck, library,
  and downstream tool assumed rectilinear geometry; the whole
  ecosystem had to change at once for one benefit.

By the mid-2000s the initiative faded. The lesson generalizes and is
worth carrying: in physical design, a real 20 percent improvement
loses to the cost of changing everything simultaneously. The
ecosystem outweighs the geometry.

## Watch it work: the saving, then the reasons it was dropped

The Manhattan route, the octilinear route with the saving computed
from the drawn spans, and the reasons it died.

<div class="walk-fig" data-walk="x-arch"></div>

## Pros, cons, and the trade-off

<div class="pros-cons">
<div class="pc-card pc-pros">
<h3>Strengths</h3>
<ul>
<li><strong>Provable wirelength saving</strong>: the reduction is a geometric fact, about 20 percent averaged over real nets.</li>
<li><strong>Demonstrated in silicon</strong>: octilinear routers were built and chips were fabricated with diagonal layers.</li>
<li><strong>Industrial backing</strong>: the effort was a consortium of established companies, not a single research group.</li>
</ul>
</div>
<div class="pc-card pc-cons">
<h3>Weaknesses</h3>
<ul>
<li><strong>Manufacturing</strong>: subwavelength lithography favors two orthogonal directions, and later nodes tightened that preference (multi-patterning and SADP (Self-Aligned Double Patterning) are one-directional by construction).</li>
<li><strong>Layer interfaces</strong>: vias and spacing rules between diagonal and Manhattan layers consumed part of the wirelength saving.</li>
<li><strong>Ecosystem cost</strong>: every router, extractor, library, and rule deck assumed rectilinear geometry, so the cost of changing all of them exceeded the benefit.</li>
</ul>
</div>
</div>

<div class="tradeoff-box">
<h3>The trade-off</h3>
<p>A routing improvement is adopted only if its benefit exceeds the cost of changing the tools and process around it. The X architecture offered a real 20 percent wirelength reduction, but required the lithography, the via rules, and the entire tool flow to change at once, and that cost was higher than the saving. Later nodes moved in the opposite direction, toward stricter one-directional layers.</p>
</div>

## Is it actually used today?

The evidence for the X architecture is historical.

- <strong>Then</strong>: consortium chips were fabricated in the
  early 2000s and octilinear routing tools existed commercially for
  a time.
- <strong>Now</strong>: no production process offers diagonal
  routing layers; advanced-node lithography (multi-patterning, SADP
  (Self-Aligned Double Patterning)) moved layers toward stricter
  one-directional geometry, the opposite direction.
- <strong>The residue</strong>: octilinear Steiner trees survive in
  the research literature, and the episode survives as the standard
  cautionary example in routing courses.
""",
    },
]
