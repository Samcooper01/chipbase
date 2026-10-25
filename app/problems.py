"""Problem registry: every problem is a directory under problems/ with a
problem.yaml manifest, a description.md lesson, starter files the learner
edits, and (for graded problems) an evaluate.js that turns a submission
into metrics. Grading rubrics live in the manifest as a list of checks
against those metrics."""

from dataclasses import asdict, dataclass, field
from pathlib import Path

import markdown
import yaml

from . import config

# Display order of topic groups on the problem index - mirrors the order of
# the physical-design flow itself.
TOPIC_ORDER = [
    "Floorplanning",
    "Placement",
    "Clock Tree Synthesis",
    "Routing",
    "Timing Constraints",
    "Timing Analysis",
    "Scripting Basics",
    "Scripting",
    "Sign-off",
    "ECO",
]

DIFFICULTY_ORDER = {"easy": 0, "medium": 1, "hard": 2}


@dataclass
class Check:
    id: str
    label: str
    metric: str
    op: str  # one of: between, <=, >=, ~=
    min: float | None = None
    max: float | None = None
    value: float | None = None
    tolerance: float = 1e-9
    weight: float = 1.0


@dataclass
class EditableFile:
    path: str
    language: str = "text"


@dataclass
class Problem:
    id: str
    title: str
    topic: str
    difficulty: str
    points: int
    engine: str  # sim | script | openroad | quiz
    kind: str  # files | numeric
    order: int
    directory: Path
    checks: list[Check]
    editable: list[EditableFile] = field(default_factory=list)
    numeric: dict = field(default_factory=dict)
    platform: str | None = None  # process-design-kit name, real-tool engine only
    description_html: str = ""
    starter_files: dict[str, str] = field(default_factory=dict)

    @property
    def sort_key(self):
        topic_rank = (
            TOPIC_ORDER.index(self.topic) if self.topic in TOPIC_ORDER else 99
        )
        return (topic_rank, self.order, DIFFICULTY_ORDER.get(self.difficulty, 9))


def _load_one(pdir: Path) -> Problem | None:
    manifest_path = pdir / "problem.yaml"
    if not manifest_path.is_file():
        return None
    manifest = yaml.safe_load(manifest_path.read_text())

    checks = [Check(**c) for c in manifest.get("checks", [])]
    editable = [EditableFile(**e) for e in manifest.get("editable", [])]

    description_md = (pdir / "description.md").read_text() if (pdir / "description.md").is_file() else ""
    description_html = markdown.markdown(
        description_md, extensions=["fenced_code", "tables"]
    )

    starter_files = {}
    starter_dir = pdir / "starter"
    for entry in editable:
        starter_path = starter_dir / entry.path
        starter_files[entry.path] = (
            starter_path.read_text() if starter_path.is_file() else ""
        )

    return Problem(
        id=manifest["id"],
        title=manifest["title"],
        topic=manifest.get("topic", "Misc"),
        difficulty=manifest.get("difficulty", "easy"),
        points=int(manifest.get("points", 100)),
        engine=manifest.get("engine", "sim"),
        kind=manifest.get("kind", "files"),
        order=int(manifest.get("order", 0)),
        directory=pdir,
        checks=checks,
        editable=editable,
        numeric=manifest.get("numeric", {}) or {},
        platform=manifest.get("platform"),
        description_html=description_html,
        starter_files=starter_files,
    )


def grading_data(problem: Problem) -> dict:
    """What the browser grader (static/grader/grade.js) needs to grade one
    problem: the rubric, the points, the editable files with their starters,
    and the problem's assets (the fake design a script problem runs over).
    The problem's own evaluate.js is loaded beside it."""
    assets = {}
    assets_dir = problem.directory / "assets"
    if assets_dir.is_dir():
        for path in sorted(assets_dir.iterdir()):
            if path.is_file():
                assets[path.name] = path.read_text()
    return {
        "id": problem.id,
        "engine": problem.engine,
        "kind": problem.kind,
        "points": problem.points,
        "checks": [asdict(c) for c in problem.checks],
        "editable": [{"path": e.path, "language": e.language} for e in problem.editable],
        "starter": problem.starter_files,
        "numeric": problem.numeric,
        "assets": assets,
    }


def load_all() -> list[Problem]:
    """Load every problem directory (names starting with an underscore are
    shared libraries or templates, not problems). Re-read on each call so a
    problem author can edit files and refresh the browser."""
    problems = []
    if not config.PROBLEMS_DIR.is_dir():
        return problems
    for pdir in sorted(config.PROBLEMS_DIR.iterdir()):
        if not pdir.is_dir() or pdir.name.startswith("_"):
            continue
        problem = _load_one(pdir)
        if problem is not None:
            problems.append(problem)
    problems.sort(key=lambda p: p.sort_key)
    return problems


def get(problem_id: str) -> Problem | None:
    for problem in load_all():
        if problem.id == problem_id:
            return problem
    return None


def grouped_by_topic(problems: list[Problem]) -> list[tuple[str, list[Problem]]]:
    groups: dict[str, list[Problem]] = {}
    for problem in problems:
        groups.setdefault(problem.topic, []).append(problem)
    ordered = sorted(
        groups.items(),
        key=lambda kv: TOPIC_ORDER.index(kv[0]) if kv[0] in TOPIC_ORDER else 99,
    )
    return ordered


# The six Education topics, in flow order, are the headers on the problem
# index. Each problem's manifest topic maps onto one of them; anything that
# does not (scripting practice) falls into a trailing group.
EDU_TOPIC_ORDER = [
    "Logic Synthesis",
    "Floorplanning",
    "Placement",
    "Clock Tree Synthesis",
    "Routing",
    "Static Timing Analysis",
    "Physical Verification",
    "ECO",
]

EDU_TOPIC = {
    "Logic Synthesis": "Logic Synthesis",
    "Floorplanning": "Floorplanning",
    "Placement": "Placement",
    "Clock Tree Synthesis": "Clock Tree Synthesis",
    "Routing": "Routing",
    "Timing Analysis": "Static Timing Analysis",
    "Timing Constraints": "Static Timing Analysis",
    "Static Timing Analysis": "Static Timing Analysis",
    "Sign-off": "Physical Verification",
    "Physical Verification": "Physical Verification",
    "ECO": "ECO",
}

# Skeleton of the real, engineer-facing problem TYPES planned under each
# Education topic, organized into named sub-groups. These are the tasks a PD
# engineer actually does, each meant to be graded by a run on the learner's
# layout. Some are live interactive labs (they carry an "href"); the rest are
# planned. This drives the problem-index skeleton.
PLANNED_TYPES = {
    "Logic Synthesis": [
        {
            "group": "Technology-independent optimization",
            "blurb": "Shrink the Boolean logic before any library is chosen: "
            "fewer product terms, shared subexpressions, and no redundant gates.",
            "items": [
                {"title": "Two-level minimization", "blurb": "Cover every 1 of a function with the fewest prime implicants, essentials first.", "href": "/lab/synth-twolevel"},
                {"title": "Constant propagation and dead-logic sweep", "blurb": "Tie inputs to constants, propagate, and remove the gates that go constant or unused.", "href": "/lab/synth-constprop"},
                {"title": "Common-subexpression extraction", "blurb": "Factor a shared term so it is built once, cutting gate and literal count.", "href": "/lab/synth-factor"},
            ],
        },
        {
            "group": "Technology mapping",
            "blurb": "Cover the optimized network with real standard-cell library "
            "gates, trading area against delay.",
            "items": [
                {"title": "Technology mapping for area", "blurb": "Cover a NAND/inverter subject graph with library cells at the least total area.", "href": "/lab/synth-map-area"},
                {"title": "Technology mapping: area vs delay", "blurb": "Cover the same graph for delay: spend area on the critical path to meet the target.", "href": "/lab/synth-map-delay"},
            ],
        },
        {
            "group": "Sequential optimization",
            "blurb": "Place and encode the state elements so the pipeline is "
            "balanced and the state logic is small.",
            "items": [
                {"title": "Retiming", "blurb": "Move flip-flops across logic to balance stages and shrink the clock period, behavior unchanged.", "href": "/lab/synth-retime"},
                {"title": "FSM state encoding", "blurb": "Assign state codes so related states are close, minimizing next-state logic.", "href": "/lab/synth-fsm"},
            ],
        },
        {
            "group": "Datapath synthesis",
            "blurb": "Choose the gate-level implementation of an arithmetic "
            "operator to hit the delay target at least area.",
            "items": [
                {"title": "Datapath operator selection", "blurb": "Pick an adder architecture (ripple, carry-select, lookahead) for the delay target at least area.", "href": "/lab/synth-datapath"},
            ],
        },
    ],
    "Floorplanning": [
        {
            "group": "Macro placement",
            "blurb": "Position a block's hard macros on the die - the core "
            "skill of floorplanning. Each lab is a distinct chip and a "
            "distinct constraint, worked entirely in the browser: drag the "
            "macros, run the checks, place and route, and submit for a score.",
            "items": [
                {
                    "title": "Manual macro placement",
                    "blurb": "Place a RISC-V core's macros by hand so the "
                    "design routes with no congestion overflow and closes "
                    "timing.",
                    "href": "/lab/macro-placement-1",
                },
                {
                    "title": "Macro placement around fixed IP",
                    "blurb": "Place an image-signal-processor's logic around "
                    "three locked hard-IP blocks you cannot move.",
                    "href": "/lab/macro-fixed-ip",
                },
                {
                    "title": "Placement with a keepout",
                    "blurb": "Place a wireless-modem's macros around two "
                    "reserved analog guard regions (the RF/ADC and PLL) they "
                    "cannot overlap.",
                    "href": "/lab/macro-keepout",
                },
                {
                    "title": "Congestion relief",
                    "blurb": "Fix a network-switch floorplan with a routing "
                    "hotspot by spreading the unlocked macros to reopen the "
                    "routing channels.",
                    "href": "/lab/macro-congestion",
                },
                {
                    "title": "Fixed-outline packing",
                    "blurb": "Pack 25 macros into a deliberately small, tall "
                    "die at high utilization, where fitting them legally is "
                    "the challenge.",
                    "href": "/lab/macro-fixed-outline",
                },
                {
                    "title": "Macro orientation and pin access",
                    "blurb": "Rotate each macro so its pin edge faces what it "
                    "connects to, instead of forcing the wire to wrap around "
                    "the block.",
                    "href": "/lab/macro-orient",
                },
            ],
        },
        {
            "group": "Pin placement",
            "blurb": "Place a block's boundary I/O pins on the die edge so the "
            "nets to the logic that drives and receives them stay short.",
            "items": [
                {
                    "title": "DDR PHY pin placement",
                    "blurb": "Place a DDR memory PHY's I/O pins on the die edge "
                    "next to the byte lane, clock, or controller each one "
                    "serves, to minimize wirelength and close the high-speed "
                    "nets.",
                    "href": "/lab/pin-placement",
                },
                {
                    "title": "SerDes bus and I/O placement",
                    "blurb": "The hard one: a wide SerDes die with two data "
                    "buses that must each be packed as a contiguous block by "
                    "their datapath, plus lane and clock pins, around fixed "
                    "power pins.",
                    "href": "/lab/pin-placement-2",
                },
            ],
        },
        {
            "group": "Power grid design",
            "blurb": "Build the power delivery network that feeds the block "
            "without starving it or blocking the signal routing, then close it "
            "against the voltage-drop and reliability budgets.",
            "items": [
                {
                    "title": "Power ring and mesh sizing",
                    "blurb": "Size the core power ring and the upper-metal "
                    "stripe width and pitch so the network meets its static "
                    "IR (current times resistance) drop budget without eating "
                    "the routing tracks.",
                    "href": "/lab/pdn-ring-mesh",
                },
                {
                    "title": "Regional mesh: per-domain IR drop",
                    "blurb": "The hard one: a die split into power regions with "
                    "different currents and different IR-drop budgets. Reinforce "
                    "the mesh per region, since a uniform grid either starves "
                    "the hot core or over-blocks the routing-heavy logic.",
                    "href": "/lab/pdn-regions",
                },
                {
                    "title": "Standard-cell rail hookup",
                    "blurb": "Size the metal-1 power rails and the via straps "
                    "up to the mesh so every cell meets its local IR (current "
                    "times resistance) drop without walling off the M1 tracks.",
                    "href": "/lab/pdn-rail",
                },
                {
                    "title": "Power bump placement (flip-chip)",
                    "blurb": "Place the power bump array that feeds the mesh "
                    "from the package so current enters evenly and no region is "
                    "starved of it.",
                    "href": "/lab/pdn-bumps",
                },
                {
                    "title": "Static IR-drop closure",
                    "blurb": "Close a flagged IR-drop violation on a non-uniform "
                    "current map by sizing the whole metal stack: lean on the "
                    "cheap coarse top straps for the global drop and thread just "
                    "enough routing-hungry mid straps for the local hotspots.",
                    "href": "/lab/pdn-static",
                },
                {
                    "title": "Decap insertion for dynamic droop",
                    "blurb": "Place decoupling capacitors on the switching "
                    "hotspots to hold the rail voltage during peak current, "
                    "meeting the dynamic voltage-droop budget.",
                    "href": "/lab/pdn-decap",
                },
                {
                    "title": "Electromigration-safe sizing",
                    "blurb": "Widen the high-current stripes and grow their "
                    "via arrays so the current density stays under the "
                    "electromigration (EM) limit for the grid's rated "
                    "lifetime.",
                    "href": "/lab/pdn-em",
                },
            ],
        },
        {
            "group": "Block sizing",
            "blurb": "Choose the die and core geometry before placement: "
            "area, aspect ratio, and how densely to pack.",
            "items": [
                {
                    "title": "Die and utilization sizing",
                    "blurb": "Choose the utilization and aspect ratio to hit an "
                    "area target while staying routable and meeting timing: the "
                    "tightest routable square wins.",
                    "href": "/lab/block-sizing",
                },
            ],
        },
        {
            "group": "Partitioning",
            "blurb": "Split the design into regions for hierarchy, keeping "
            "tightly-connected logic together so few nets cross the cuts.",
            "items": [
                {
                    "title": "Min-cut partitioning",
                    "blurb": "Sort the sub-blocks into two balanced regions so "
                    "as few nets as possible are cut across the boundary.",
                    "href": "/lab/partition-mincut",
                },
            ],
        },
        {
            "group": "Power domains",
            "blurb": "Floorplan multiple voltage domains: keep each domain "
            "contiguous and keep the level-shifter nets between them short.",
            "items": [
                {
                    "title": "Voltage-domain floorplanning",
                    "blurb": "Group each voltage domain into its own contiguous "
                    "region and place the cross-domain blocks near the shared "
                    "boundary so the level-shifter nets stay short.",
                    "href": "/lab/vdomain",
                },
            ],
        },
        {
            "group": "Thermal",
            "blurb": "Place blocks so the die stays under its temperature limit "
            "while timing still closes.",
            "items": [
                {
                    "title": "Thermal-aware placement",
                    "blurb": "Spread the high-power blocks to cool the hotspot "
                    "while keeping the critical nets short: two hot blocks wired "
                    "together can be neither too close nor too far.",
                    "href": "/lab/thermal",
                },
            ],
        },
    ],
    "Placement": [
        {
            "group": "Global placement",
            "blurb": "Arrange the standard cells across the die - short wires, "
            "closed timing, and a routable density.",
            "items": [
                {
                    "title": "Wirelength-driven placement",
                    "blurb": "Drag the cells to minimize total wirelength: cluster "
                    "connected cells and pull them toward the pins they reach.",
                    "href": "/lab/place-wl",
                },
                {
                    "title": "Timing-driven placement",
                    "blurb": "Pull the cells on the critical nets tightly together "
                    "so those paths come under their delay budget.",
                    "href": "/lab/place-timing",
                },
                {
                    "title": "Congestion-driven placement",
                    "blurb": "Spread the cells so no region's density exceeds the "
                    "routable limit, while keeping wirelength under target.",
                    "href": "/lab/place-cong",
                },
                {
                    "title": "Full global placement (all three)",
                    "blurb": "The real job: hit the wirelength target, close the "
                    "critical path, and stay under the density limit all at once, "
                    "balancing objectives that pull against each other.",
                    "href": "/lab/place-combo",
                },
                {
                    "title": "Mixed-size placement",
                    "blurb": "Place the standard cells in the channels around fixed "
                    "hard macros, threading the wires past the blockages.",
                    "href": "/lab/place-mixed",
                },
            ],
        },
        {
            "group": "Clock-aware placement",
            "blurb": "Place with the clock network in mind, not just the data "
            "nets - group the flip-flops so the clock tree stays short.",
            "items": [
                {
                    "title": "Register clustering (clock-aware)",
                    "blurb": "Pack the registers that share a clock into one tight "
                    "cluster to shorten the clock tree, while their data nets still "
                    "reach the boundary pins.",
                    "href": "/lab/place-regcluster",
                },
            ],
        },
        {
            "group": "Legalization",
            "blurb": "Snap the global-placement result onto the legal rows with "
            "no overlap, disturbing it as little as possible.",
            "items": [
                {
                    "title": "Row legalization",
                    "blurb": "Drag the overlapping, off-grid cells onto the rows "
                    "with no overlap and minimal displacement from their global "
                    "spots.",
                    "href": "/lab/place-legalize",
                },
            ],
        },
        {
            "group": "Detailed placement",
            "blurb": "Local, discrete moves that shave the last of the "
            "wirelength after global placement and legalization.",
            "items": [
                {
                    "title": "Cell swapping",
                    "blurb": "Swap cells between legal slots to reorder them and "
                    "shrink the total wirelength under target.",
                    "href": "/lab/place-swap",
                },
                {
                    "title": "Cell flipping (orientation)",
                    "blurb": "Mirror cells in place so their input and output pins "
                    "face the cells they connect to, shortening the wires.",
                    "href": "/lab/place-flip",
                },
                {
                    "title": "Cell padding for routability",
                    "blurb": "Pad the pin-heavy cells in a congestion hotspot to "
                    "spread their pins, trading a little wirelength for a routable "
                    "local density.",
                    "href": "/lab/place-pad",
                },
            ],
        },
        {
            "group": "Filler and tap insertion",
            "blurb": "The finishing pass after cells are placed and legalized: "
            "close the gaps and tie the wells so the rows are manufacturable.",
            "items": [
                {
                    "title": "Filler and tap-cell insertion",
                    "blurb": "Fill every gap for rail and well continuity, and drop "
                    "well taps so every site is within the latch-up reach, with as "
                    "few taps as possible.",
                    "href": "/lab/place-filler",
                },
            ],
        },
        {
            "group": "Constrained placement",
            "blurb": "Place cells under region and fence constraints, not just "
            "for wirelength.",
            "items": [
                {
                    "title": "Region-constrained placement",
                    "blurb": "Keep the fenced cells inside their region box while "
                    "minimizing wirelength for the rest.",
                    "href": "/lab/place-region",
                },
            ],
        },
    ],
    "Routing": [
        {
            "group": "Global routing and congestion",
            "blurb": "Decide the coarse routes and relieve congestion before the "
            "detailed router runs.",
            "items": [
                {"title": "Global routing and congestion", "blurb": "Choose each net's coarse route so no routing tile exceeds its track capacity.", "href": "/lab/route-global"},
                {"title": "Rip-up and reroute", "blurb": "Reroute the offending nets of a congested design until every tile is back within capacity.", "href": "/lab/route-ripup"},
            ],
        },
        {
            "group": "Layer and track assignment",
            "blurb": "Assign nets to metal layers and to tracks within a channel.",
            "items": [
                {"title": "Layer assignment", "blurb": "Put long, critical nets on the fast upper layers to meet delay, within each layer's scarce track count.", "href": "/lab/route-layer"},
                {"title": "Track assignment", "blurb": "Pack the channel's wires onto tracks with no two overlapping spans on the same track.", "href": "/lab/route-track"},
            ],
        },
        {
            "group": "Detailed routing and design rules",
            "blurb": "Find the actual paths and lay the real geometry: shortest-path "
            "routing, design-rule clean, few vias, no antennas.",
            "items": [
                {"title": "Maze routing", "blurb": "Lee's algorithm: flood a distance wave from the source, then backtrace the shortest path down the gradient around blockages.", "href": "/lab/route-maze"},
                {"title": "Multi-pin (Steiner) routing", "blurb": "Connect a net's several pins through a shared branch point, placed at the median for the least total wire.", "href": "/lab/route-steiner"},
                {"title": "Design-rule-clean routing", "blurb": "Fix minimum-spacing and blockage violations so the wires pass design-rule checks.", "href": "/lab/route-drc"},
                {"title": "Via minimization", "blurb": "Route with the fewest layer changes: every turn in a preferred-direction route is a via.", "href": "/lab/route-viamin"},
                {"title": "Antenna-rule fixing", "blurb": "Fix antenna-ratio violations with diodes or layer jumps at minimum cost.", "href": "/lab/route-antenna"},
                {"title": "Pin access", "blurb": "Give every crowded cell pin its own access track so the router can drop a via onto each one.", "href": "/lab/route-pinaccess"},
            ],
        },
        {
            "group": "Special-net routing",
            "blurb": "The nets that need extra care: matched buses and crosstalk-sensitive signals.",
            "items": [
                {"title": "Bus length matching", "blurb": "Tune a matched group (a source-synchronous / DDR byte-lane bus) with serpentine detours so every bit arrives within the skew tolerance.", "href": "/lab/route-length"},
                {"title": "Crosstalk-aware routing", "blurb": "Space or shield victim nets to keep crosstalk under the limit within a track budget.", "href": "/lab/route-xtalk"},
            ],
        },
    ],
    "Clock Tree Synthesis": [
        {
            "group": "Clock tree structure",
            "blurb": "Distribute the clock from the source to every flip-flop "
            "with balanced path lengths - the root of low skew.",
            "items": [
                {
                    "title": "Clock source balancing",
                    "blurb": "Place the clock root so a star clock's path lengths "
                    "to every sink are as equal as possible, minimizing skew.",
                    "href": "/lab/cts-source",
                },
                {
                    "title": "H-tree construction",
                    "blurb": "Position the tap points of an H-tree over a sink grid "
                    "so every root-to-sink path matches, the classic zero-skew "
                    "structure.",
                    "href": "/lab/cts-htree",
                },
                {
                    "title": "X-tree construction",
                    "blurb": "The H-tree's diagonal cousin: balance four quadrant "
                    "taps with straight-line (Euclidean) routing instead of "
                    "right-angle segments.",
                    "href": "/lab/cts-xtree",
                },
                {
                    "title": "Clustered buffer tree",
                    "blurb": "Cluster irregularly-placed sinks and balance a "
                    "buffered tree over them, compact clusters with equal arms - "
                    "what a real CTS tool builds.",
                    "href": "/lab/cts-cluster",
                },
                {
                    "title": "Clock mesh",
                    "blurb": "Inject drivers into a shorted clock grid; the fewest, "
                    "best-spread drivers that bring the covering radius (skew) "
                    "under target, trading power for robustness.",
                    "href": "/lab/cts-mesh",
                },
                {
                    "title": "Clock spine (fishbone)",
                    "blurb": "Place a central spine and its drive point so the "
                    "ribbed rows of sinks arrive balanced, the ASIC middle ground "
                    "between tree and mesh.",
                    "href": "/lab/cts-spine",
                },
            ],
        },
        {
            "group": "Buffering and skew",
            "blurb": "Drive the tree cleanly and equalize arrival times across "
            "the sinks.",
            "items": [
                {
                    "title": "Clock buffer insertion",
                    "blurb": "Insert buffers to split the tree into regions so no "
                    "driver's transition (slew) blows the load limit, with as few "
                    "buffers as possible.",
                    "href": "/lab/cts-buffer",
                },
                {
                    "title": "Skew balancing (delay matching)",
                    "blurb": "Add delay on the early branches to lift them up to the "
                    "latest sink, using shared edges to spend the fewest buffers.",
                    "href": "/lab/cts-skewbal",
                },
                {
                    "title": "Buffer-level balancing (OCV)",
                    "blurb": "Give every sink the same number of buffer stages so "
                    "on-chip variation tracks across paths, adding matching "
                    "buffers on the shallow branches without over-raising deep sinks.",
                    "href": "/lab/cts-depth",
                },
            ],
        },
        {
            "group": "Clock power",
            "blurb": "The clock is often the largest power sink - cut its dynamic "
            "and switching power.",
            "items": [
                {
                    "title": "Clock gating insertion",
                    "blurb": "Gate idle register banks with ICG cells, sharing one "
                    "gate per enable domain, for the most net power saved.",
                    "href": "/lab/cts-gating",
                },
                {
                    "title": "Multi-bit flip-flop banking",
                    "blurb": "Merge nearby flops into multi-bit banks that share a "
                    "clock buffer, without stretching their data nets past budget.",
                    "href": "/lab/cts-banking",
                },
            ],
        },
        {
            "group": "Advanced clock techniques",
            "blurb": "Trade skew deliberately and route the clock with special "
            "rules.",
            "items": [
                {
                    "title": "Useful skew",
                    "blurb": "Skew one flip-flop's clock to borrow time and close a "
                    "failing setup path, without breaking hold or the next path.",
                    "href": "/lab/cts-useskew",
                },
                {
                    "title": "Non-default-rule clock routing",
                    "blurb": "Size the clock trunk's width, spacing, and shielding "
                    "to meet slew and crosstalk within a routing-track budget.",
                    "href": "/lab/cts-ndr",
                },
            ],
        },
    ],
    "Static Timing Analysis": [
        {
            "group": "Slack and timing paths",
            "blurb": "The fundamentals: what slack is, the two checks, and the "
            "path that limits the clock.",
            "items": [
                {"title": "Slack and maximum frequency", "blurb": "Push the clock period down until setup slack reaches zero - that is the path's max frequency.", "href": "/lab/sta-slack"},
                {"title": "Setup and hold", "blurb": "Land the data-path delay in the window where both setup (not too slow) and hold (not too fast) are met.", "href": "/lab/sta-setuphold"},
                {"title": "Critical path", "blurb": "Identify the least-slack path among several - the one that sets the design's speed.", "href": "/lab/sta-critical"},
                {"title": "Interface (I/O) timing", "blurb": "Budget the off-chip part of an input/output path (set_input_delay / set_output_delay), and register the boundary to reclaim frequency.", "href": "/lab/sta-io"},
            ],
        },
        {
            "group": "Clocking",
            "blurb": "How real clock behaviour and timing constraints shape the analysis.",
            "items": [
                {"title": "Clock uncertainty", "blurb": "Budget the clock-uncertainty guardband (jitter/skew) into the period and see the max frequency drop.", "href": "/lab/sta-uncertainty"},
                {"title": "Timing exceptions", "blurb": "Apply multicycle and false-path exceptions so real paths are analyzed and false alarms cleared - without hiding real bugs.", "href": "/lab/sta-exceptions"},
                {"title": "Time borrowing (latches)", "blurb": "See how a transparent latch lets a slow stage borrow time past the clock edge, where a flip-flop would fail.", "href": "/lab/sta-borrow"},
            ],
        },
        {
            "group": "Variation and signal integrity",
            "blurb": "Sign-off across corners and the effects that steal timing margin.",
            "items": [
                {"title": "Multi-corner sign-off", "blurb": "Meet setup at every corner; the slow corner limits the frequency, not the typical one.", "href": "/lab/sta-corners"},
                {"title": "On-chip variation and CPPR", "blurb": "Recover pessimistic OCV margin with common-path pessimism removal.", "href": "/lab/sta-ocv"},
                {"title": "Crosstalk delta-delay", "blurb": "Add the worst-case crosstalk delta to the path and re-close timing.", "href": "/lab/sta-xtalk"},
            ],
        },
        {
            "group": "Report literacy",
            "blurb": "Reading the timing report - most of the day-to-day STA job.",
            "items": [
                {"title": "Reading a timing report", "blurb": "Read the arrival and required paths and compute the slack.", "href": "/lab/sta-report"},
            ],
        },
    ],
    "Physical Verification": [
        {
            "group": "Design rule checks",
            "blurb": "The geometric rules a layout must obey to be manufacturable: "
            "width, spacing, enclosure, area, and density.",
            "items": [
                {"title": "Minimum width and spacing", "blurb": "Find the shapes that violate minimum width or spacing, checking the rule values, not by eye.", "href": "/lab/pv-width-spacing"},
                {"title": "Via enclosure and minimum area", "blurb": "Find the under-enclosed vias and the shapes below minimum area.", "href": "/lab/pv-enclosure"},
                {"title": "Width-dependent and end-of-line spacing", "blurb": "Triage each spacing against the width-keyed table and the end-of-line rule.", "href": "/lab/pv-spacing-table"},
                {"title": "Density and metal fill", "blurb": "Add fill so every window lands in the density band for CMP (Chemical Mechanical Polishing) planarity.", "href": "/lab/pv-density"},
            ],
        },
        {
            "group": "Layout versus schematic",
            "blurb": "Proving the extracted layout netlist matches the intended "
            "schematic: connectivity and devices.",
            "items": [
                {"title": "Shorts and opens", "blurb": "Find the short (merged nets) or open (broken net) against the schematic.", "href": "/lab/pv-lvs-connectivity"},
                {"title": "Device matching", "blurb": "Find the device that does not match: wrong size, wrong type, or missing.", "href": "/lab/pv-device-match"},
            ],
        },
        {
            "group": "Antenna and manufacturability",
            "blurb": "Charge-damage protection and yield-oriented recommended "
            "rules, checked before tapeout.",
            "items": [
                {"title": "Antenna ratio and diodes", "blurb": "Read each net's antenna ratio; layer-jump where it clears the limit, add a diode only where it cannot.", "href": "/lab/pv-antenna"},
                {"title": "Redundant vias (via doubling)", "blurb": "Double every via that has room for a redundant cut; leave boxed-in vias single.", "href": "/lab/pv-dfm-vias"},
            ],
        },
        {
            "group": "Electrical rules and sign-off",
            "blurb": "Electrical correctness and the final go / no-go gate before "
            "tapeout.",
            "items": [
                {"title": "Floating nodes and tie cells", "blurb": "Find floating gate inputs and insert tie-high / tie-low cells.", "href": "/lab/pv-erc-ties"},
                {"title": "Tapeout sign-off gate", "blurb": "Mark the design ready only when DRC (Design Rule Check), LVS (Layout Versus Schematic), antenna, and density all pass.", "href": "/lab/pv-signoff"},
            ],
        },
    ],
    "ECO": [
        {
            "group": "Setup timing ECO",
            "blurb": "Speed up a path that arrives too late, in place, without "
            "changing the logic.",
            "items": [
                {"title": "Gate sizing to close a setup path", "blurb": "Size the cells on a path so data reaches the capture flip-flop with positive setup slack.", "href": "/lab/place-gatesize"},
                {"title": "Buffer insertion", "blurb": "Split a long, high-load net with a buffer so each segment drives less.", "href": "/lab/eco-buffer"},
                {"title": "Threshold-voltage swap", "blurb": "Swap critical cells to a faster low-Vt variant, spending the least leakage.", "href": "/lab/eco-vtswap"},
                {"title": "Pin swap", "blurb": "Put the late signal on the faster input pin, shortening the path with no new area.", "href": "/lab/eco-pinswap"},
                {"title": "Driver cloning and load split", "blurb": "Clone a high-fanout driver and split its load.", "href": "/lab/eco-clone"},
                {"title": "Logic restructuring", "blurb": "Reshape the logic into a balanced tree with the late signal nearest the output, same function.", "href": "/lab/eco-restruct"},
            ],
        },
        {
            "group": "Electrical ECO",
            "blurb": "Fix electrical design-rule violations (max fanout, capacitance, "
            "and transition), not slack.",
            "items": [
                {"title": "Electrical DRV fix (fanout, cap, transition)", "blurb": "Split a high-fanout net with buffers until every driver meets all three electrical rules.", "href": "/lab/eco-drv"},
            ],
        },
        {
            "group": "Hold timing ECO",
            "blurb": "Add delay so early-arriving data clears the hold requirement.",
            "items": [
                {"title": "Hold fixing (delay insertion)", "blurb": "Insert delay cells on fast paths to meet hold without breaking setup.", "href": "/lab/eco-hold"},
            ],
        },
        {
            "group": "Clock ECO",
            "blurb": "Shift a clock arrival to move slack between stages.",
            "items": [
                {"title": "Useful-skew clock ECO", "blurb": "Retard or advance a flop's clock to lend slack to the tighter stage.", "href": "/lab/eco-skew"},
            ],
        },
        {
            "group": "Functional ECO",
            "blurb": "Change the logic itself with the least disturbance, "
            "metal-only where the spare cells allow it.",
            "items": [
                {"title": "Metal-only spare-cell ECO", "blurb": "Implement a logic change by rewiring nearby spare cells, metal and via only.", "href": "/lab/eco-metal"},
                {"title": "Metal-only vs all-layer decision", "blurb": "Decide per change whether it fits the spares (metal-only) or needs a full respin.", "href": "/lab/eco-respin"},
            ],
        },
        {
            "group": "Placement ECO",
            "blurb": "Legalize ECO-inserted cells back onto the site grid with the "
            "least displacement.",
            "items": [
                {"title": "Placement ECO and legalization", "blurb": "Snap inserted cells into the nearest legal gap, no overlap, minimal displacement from ideal.", "href": "/lab/eco-legal"},
            ],
        },
    ],
}


def grouped_by_education(
    problems: list[Problem],
) -> tuple[list[tuple[str, list[Problem]]], list[Problem]]:
    """Group problems under the six Education topics (always all six, even
    when empty), returning that ordered list plus any problems that map to
    no Education topic (scripting practice)."""
    buckets: dict[str, list[Problem]] = {name: [] for name in EDU_TOPIC_ORDER}
    extras: list[Problem] = []
    for problem in problems:
        edu = EDU_TOPIC.get(problem.topic)
        if edu:
            buckets[edu].append(problem)
        else:
            extras.append(problem)
    groups = [(name, buckets[name]) for name in EDU_TOPIC_ORDER]
    return groups, extras
