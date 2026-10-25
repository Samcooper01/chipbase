"""Synthesis algorithm catalog: the logic optimization that makes a
Boolean network smaller while it is still abstract, and the technology
mapping that covers it with real library cells."""

STAGE = {
    "slug": "synthesis",
    "name": "Synthesis",
    "tagline": (
        "Turn register transfer level code into a network of real library "
        "cells. Two jobs, in order: make the logic smaller while it is "
        "still abstract, then cover it with the cells the process actually "
        "has, trading area against delay."
    ),
    "families": [
        {
            "id": "logic",
            "name": "Logic optimization",
            "lead": (
                "Before any library is chosen, make the Boolean logic "
                "smaller: fewer product terms, shared subexpressions, and "
                "a structure that the mapper can cover well."
            ),
        },
        {
            "id": "mapping",
            "name": "Technology mapping",
            "lead": (
                "Cover the optimized network with standard cells from the "
                "library, so that every piece of logic is built exactly "
                "once, at the least area or the least delay the library "
                "allows."
            ),
        },
    ],
}

ALGORITHMS = [
    {
        "slug": "quine-mccluskey",
        "card": "Find every prime implicant, then pick the fewest that cover all ones.",
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "level": "foundational",
        "name": "Quine-McCluskey Two-Level Minimization",
        "family": "logic",
        "year": "1952 to 1956",
        "who": "Quine; McCluskey",
        "chips": [
            ("diff-easy", "exact two-level minimum"),
            ("diff-hard", "exponential in the inputs"),
        ],
        "summary": (
            "List every prime implicant of a function, then choose the "
            "fewest that cover all of its ones. Exact, and the yardstick "
            "every later minimizer is measured against."
        ),
        "lab": None,
        "refs": [
            ("Wikipedia: Quine-McCluskey algorithm",
             "https://en.wikipedia.org/wiki/Quine%E2%80%93McCluskey_algorithm"),
            ("Wikipedia: Espresso heuristic logic minimizer",
             "https://en.wikipedia.org/wiki/Espresso_heuristic_logic_minimizer"),
        ],
        "body": """
## The idea

Any Boolean function can be written as a sum of products: an OR of AND
terms, which is a two-level circuit. The smallest such form uses the
fewest product terms, each as large as possible. Quine (1952) and
McCluskey (1956) split the search into two phases.

**Find every prime implicant.** Start from the minterms, the input
combinations for which the function is 1. Group them by how many ones
they contain, and merge any two terms that differ in exactly one bit;
that bit becomes a don't-care. Repeat on the merged terms until nothing
merges. A term that never merged into a larger one is a prime
implicant: it cannot grow without covering an input where the function
is 0.

**Choose a cover.** Build a table with one row per prime and one
column per minterm. A prime that is the only one covering some minterm
is essential and is taken first. What remains is a set-covering
problem: pick the fewest primes whose rows cover every remaining
column, solved exactly for small functions by branching over the
choices.

## Watch it work: a four-input function

Ten minterms on a Karnaugh map, the grid view of a four-input function
in which neighbouring cells differ in one input. The walkthrough runs
both phases: two merging passes that find six prime implicants, then
the prime chart, the two essential primes, and the last choice that
completes the cover.

<div class="walk-fig" data-walk="quine-mccluskey"></div>

## The fine print

Both phases blow up. The number of prime implicants can grow
exponentially with the number of inputs, on the order of 3ⁿ ÷ n in the
worst case, and set covering is NP-hard (Non-deterministic
Polynomial-time hard). Exact minimization is practical only for small
functions. The heuristic successor, Espresso (Brayton, Hachtel,
McMullen and Sangiovanni-Vincentelli, 1984), never lists all the
primes: it repeatedly expands, reduces and removes redundant terms from
a cover, and reaches near-minimum results on functions with dozens of
inputs.

## Where you meet it today

Two-level forms still describe programmable logic arrays and the local
function of each node inside a multilevel network, and minimizers
descended from Espresso still simplify those local functions.
""",
    },
    {
        "slug": "kernel-extraction",
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "level": "foundational",
        "name": "Kernel Extraction and Algebraic Factoring",
        "family": "logic",
        "year": "1982",
        "who": "Brayton and McMullen",
        "chips": [
            ("diff-easy", "algebraic, so fast"),
            ("diff-medium", "misses Boolean identities"),
        ],
        "summary": (
            "Treat logic expressions as polynomials, find their kernels, "
            "and pull out the divisors that several expressions share. "
            "The core move of multilevel logic optimization."
        ),
        "lab": None,
        "refs": [
            ("Wikipedia: Logic optimization",
             "https://en.wikipedia.org/wiki/Logic_optimization"),
            ("ABC, the Berkeley logic synthesis and verification tool",
             "https://github.com/berkeley-abc/abc"),
        ],
        "body": """
## The idea

Two-level forms waste gates: the same subexpression is built again in
every output that needs it. Multilevel optimization factors expressions
and builds each shared factor once. Brayton and McMullen (1982) made
the search for shared factors tractable by treating Boolean expressions
as ordinary algebraic polynomials, deliberately ignoring Boolean
identities such as a · a = a.

Divide an expression by a single product term (a cube). If the
quotient is cube-free, meaning no single literal divides all of its
terms, the quotient is a **kernel** of the expression and the cube is
its **co-kernel**. Their central result: two expressions can share a
common divisor of more than one term only if some kernel of one and
some kernel of the other intersect in more than one term. Finding
shared factors therefore reduces to intersecting sets of kernels. The
optimizer picks the divisor that saves the most literals, makes it a
new node, substitutes it everywhere it divides, and repeats.

A small case: f = ac + ad + bc + bd has the kernel c + d (co-kernels
a and b), and factoring gives f = (a + b)(c + d), four literals instead
of eight.

## Watch it work: two expressions, one shared factor

Two expressions written flat as sums of products. The walkthrough divides by a cube to find
a kernel, lists every kernel of both expressions, intersects them, and extracts the shared
divisor as a new node, taking the network from twelve literals to seven.

<div class="walk-fig" data-walk="kernel-extraction"></div>

## The fine print

Algebraic division cannot use Boolean identities, so it misses
factorizations that depend on them, for example ones that use
a · ā = 0 or the don't-care conditions of the surrounding logic.
Boolean division and don't-care simplification recover some of these
at a higher cost. Literal count is only a proxy for area, and it says
nothing about delay.

## Where you meet it today

Kernel extraction was the backbone of the Berkeley multilevel synthesis
systems of the late 1980s. Fast extract, a quicker algebraic extraction
in the same spirit, is still the `fx` command in ABC, the Berkeley tool
that Yosys calls for optimization and mapping.
""",
    },
    {
        "slug": "aig-rewriting",
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "level": "industry",
        "name": "And-Inverter Graph Rewriting",
        "family": "logic",
        "year": "2006",
        "who": "Mishchenko, Chatterjee, Brayton",
        "chips": [
            ("diff-easy", "fast, scales to millions of gates"),
            ("diff-medium", "local and structural"),
        ],
        "summary": (
            "Build all logic from two-input AND gates and inverters, then "
            "swap small subgraphs for smaller precomputed equivalents. The "
            "workhorse of open-source synthesis."
        ),
        "lab": None,
        "refs": [
            ("Wikipedia: And-inverter graph",
             "https://en.wikipedia.org/wiki/And-inverter_graph"),
            ("ABC, the Berkeley logic synthesis and verification tool",
             "https://github.com/berkeley-abc/abc"),
        ],
        "body": """
## The idea

An and-inverter graph builds every function from one kind of node, a
two-input AND, with inversion marked on the edges. The uniformity makes
it compact and cheap to manipulate. Structural hashing merges any two
AND nodes with the same inputs as the graph is built, so identical
logic is never stored twice.

Rewriting (Mishchenko, Chatterjee and Brayton, 2006) walks the graph.
At each node it enumerates small cuts: sets of up to four nodes that
separate this node from the rest of the logic. Each cut implements some
four-input function. Up to permuting and negating the inputs and the
output, there are only 222 distinct four-input functions, and an optimal
and-inverter structure for each one is computed once and stored. If the
stored structure, after sharing whatever logic already exists in the
graph, uses fewer nodes than the logic it would replace, the swap is
made. Repeated passes of rewriting, together with balancing (which
reduces depth) and refactoring (which collapses larger cuts and factors
them again), make up the standard optimization scripts.

## Watch it work: one cut, swapped for a smaller structure

f = ab + ac as an and-inverter graph of three nodes. The walkthrough picks a cut, computes
the function it implements, looks up the stored optimal structure for that function, and
swaps it in when it is smaller.

<div class="walk-fig" data-walk="aig-rewriting"></div>

## The fine print

Rewriting is local and structural: the result depends on the structure
it starts from, and it cannot find an optimization that needs a wider
view than a four-input cut. Keeping several equivalent structures
("structural choices") and letting the mapper choose among them softens
this. Node count is a proxy for area; delay is handled by balancing and
by the mapper that follows.

## Where you meet it today

ABC implements it, and the OpenROAD flow's own ABC script
(`abc_speed.script`) alternates `&st` (structural hashing), `&syn2`
(rewriting and balancing), `&dch` (structural choices) and `&nf`
(mapping). Every design synthesized in the open flow, including the
runs behind this site's drills, passed through it.
""",
    },
    {
        "slug": "tree-covering",
        "card": "Cover each tree with library cells at least cost, node by node.",
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "level": "foundational",
        "name": "Tree Covering by Dynamic Programming",
        "family": "mapping",
        "year": "1987",
        "who": "Keutzer (DAGON)",
        "chips": [
            ("diff-easy", "optimal on each tree"),
            ("diff-medium", "tree boundaries cost area"),
        ],
        "summary": (
            "Break the network into trees and cover each one with library "
            "gates by dynamic programming. Optimal on every tree, in time "
            "linear in its size."
        ),
        "lab": None,
        "refs": [
            ("Wikipedia: Logic synthesis",
             "https://en.wikipedia.org/wiki/Logic_synthesis"),
            ("ABC, the Berkeley logic synthesis and verification tool",
             "https://github.com/berkeley-abc/abc"),
        ],
        "body": """
## The idea

Express the design and every library cell as graphs of the same simple
gates; Keutzer's DAGON (1987) used two-input NAND gates and inverters.
Mapping then means covering the design graph with cell patterns, so
that every node is covered and every cell's inputs connect to other
cells' outputs.

On a tree this has an exact solution by dynamic programming. Visit the
nodes from the inputs toward the output. At each node, try every
library pattern that matches with this node as its root. The cost of a
match is the cell's area plus the best costs already computed at the
nodes that feed the match's inputs:

<div class="eq">cost(v) = min over matches m at v of [ area(m) + Σ cost(u) ]</div>

<ul class="eq-legend">
<li><code>cost(v)</code> least total area that implements the subtree rooted at node v</li>
<li><code>m</code> a library cell pattern that matches with v as its root</li>
<li><code>area(m)</code> the area of that cell</li>
<li><code>u</code> the nodes feeding the inputs of the match, whose best costs are already known</li>
</ul>

The best cost at the root is the optimal cover of the tree, and the
chosen matches are recovered by walking back from the root. For a fixed
library the time is linear in the size of the tree.

## Watch it work: a tree, a library, and the cheapest cover

f = abc decomposed into NAND gates and inverters, and a library of five cells with areas.
The walkthrough computes the best cost at every node from the inputs up, then walks back from
the root to recover the cheapest cover.

<div class="walk-fig" data-walk="tree-covering"></div>

## The fine print

Real networks are directed acyclic graphs, not trees. A node with
several fanouts is cut into tree boundaries, and the cover is optimal
only within each tree. Covering across the boundaries could share or
duplicate logic better, but covering a general directed acyclic graph
optimally is NP-hard (Non-deterministic Polynomial-time hard). The
result also depends on how the design was decomposed into simple gates.
Delay-oriented versions use arrival time instead of area as the cost.

## Where you meet it today

Tree covering is the textbook method and the basis of the first
generation of library mappers; ABC's standard-cell mapper extends the
same dynamic programming from trees to cuts of the full graph (the next
page).
""",
    },
    {
        "slug": "cut-based-mapping",
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "level": "industry",
        "name": "Cut-Based Mapping with Priority Cuts",
        "family": "mapping",
        "year": "2007",
        "who": "Mishchenko, Cho, Chatterjee, Brayton",
        "chips": [
            ("diff-easy", "works on the whole graph"),
            ("diff-medium", "heuristic area recovery"),
        ],
        "summary": (
            "Keep the best few small cuts at every node of the whole graph, "
            "map for minimum delay first, then recover area wherever the "
            "timing allows."
        ),
        "lab": None,
        "refs": [
            ("ABC, the Berkeley logic synthesis and verification tool",
             "https://github.com/berkeley-abc/abc"),
            ("Yosys, the open-source synthesis suite",
             "https://github.com/YosysHQ/yosys"),
        ],
        "body": """
## The idea

Instead of splitting the network into trees, cut-based mapping works on
the entire directed acyclic graph. A cut of a node is a set of nodes
that separates it from the primary inputs. A small cut, a handful of
inputs, defines a local function that a single library cell might
implement.

Enumerating every cut explodes on large designs, so priority cuts
(Mishchenko, Cho, Chatterjee and Brayton, 2007) keep only the best few
cuts at each node, ranked by delay and then area, and build each node's
cuts from the kept cuts of its fanins. Mapping then runs in passes. The
first pass picks, at every node, the cut and matching cell that give
the earliest arrival time, which fixes the best delay the structure can
reach. Later passes revisit the nodes that are not on the critical path
and choose cheaper cuts wherever their slack allows. This is area
recovery, guided by area flow (a node's area shared among its fanouts)
and by the exact area a choice adds locally.

## Watch it work: delay first, then area recovery

A small network with one shared node and two outputs. The walkthrough enumerates the cuts,
maps every node for the earliest arrival, then recovers area within a timing budget, and
shows why tree covering could not reach the fast answer here.

<div class="walk-fig" data-walk="cut-based-mapping"></div>

## The fine print

Keeping only a few cuts per node is a heuristic: a cut dropped early
might have led to a better mapping. Area recovery is heuristic too.
Mapping on one fixed structure inherits that structure's limits, which
is why mapping with structural choices keeps several equivalent
structures for the mapper to choose among.

## Where you meet it today

Cut-based mapping drives ABC's modern mappers, including `&nf`, the
standard-cell mapper that the OpenROAD flow's synthesis script runs
after each round of rewriting.
""",
    },
]
