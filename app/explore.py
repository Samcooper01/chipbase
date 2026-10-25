"""Registries for the Explore section.

SECTIONS drives the Explore hub page: each entry is one subtopic card
(Algorithms is the first; games, guided tours, and future subtopics are
added here). CATEGORIES and EXPLORABLES drive the Algorithms subtopic:
interactive visualizations grouped by the flow stage whose algorithms
they teach. Planned entries render as dimmed cards so structure is
visible before every piece exists."""

SECTIONS = [
    {
        "id": "algorithms",
        "title": "Methods & Algorithms",
        "href": "/explore/algorithms",
        "live": True,
        "tags": ["interactive", "5 flow stages"],
        "blurb": (
            "The methods and algorithms of every flow stage, cataloged and "
            "made interactive. Watch Lee's wavefront flood a routing grid, "
            "race it against A* (A-star), Hadlock, and Soukup in the maze "
            "lab, and read sixty years of routing ideas from line search "
            "to negotiated congestion."
        ),
        "foot": "Enter the section →",
    },
    {
        "id": "processes",
        "title": "Foundry Processes",
        "href": "/explore/processes",
        "live": True,
        "tags": ["reference", "6 topics"],
        "blurb": (
            "The fab's side of physical design: what a PDK (Process "
            "Design Kit) contains, how transistors and the metal stack "
            "changed shape as they shrank, why lithography sets the "
            "router's rules, and how corners, variation, and "
            "reliability define sign-off. Ends with the open PDKs this "
            "platform runs on."
        ),
        "foot": "Enter the processes section →",
    },
    {
        "id": "games",
        "title": "Games",
        "href": None,
        "live": False,
        "tags": [],
        "blurb": (
            "Fast-feedback drills that make the knowledge stick: command "
            "flash cards with spaced repetition, log forensics (why did "
            "my run die?), metric over/under guessing, and "
            "spot-the-layout-pathology."
        ),
        "foot": "Coming after the methods section fills out",
    },
    {
        "id": "guided-tours",
        "title": "Guided tours",
        "href": None,
        "live": False,
        "tags": [],
        "blurb": (
            "Follow a real design through the whole flow, stage by stage: "
            "annotated snapshots of an actual OpenROAD run, from "
            "synthesized netlist to routed layout, with the metrics "
            "explained at every step."
        ),
        "foot": "Planned",
    },
]

CATEGORIES = [
    {
        "name": "Synthesis",
        "slug": "synthesis",
        "hub": False,
        "blurb": (
            "Where the netlist comes from. Read the register transfer "
            "level description, turn it into logic, and cover that logic "
            "with the cells this process actually has. Nothing physical "
            "is decided here, and yet the die size already is: the area "
            "every later stage divides up is whatever synthesis produced."
        ),
    },
    {
        "name": "Floorplanning",
        "slug": "floorplanning",
        "hub": False,
        "blurb": (
            "The opening move of the backend. Carve the die into core and "
            "margins, shape the block, drop the macros, plan the power "
            "grid. Every later stage inherits its geometry from decisions "
            "made here, and a bad floorplan cannot be optimized away."
        ),
    },
    {
        "name": "Placement",
        "slug": "placement",
        "hub": False,
        "blurb": (
            "Millions of standard cells receive exact positions on the "
            "rows. Wirelength, timing, and routability are mostly decided "
            "here, long before a single wire exists: placement is where "
            "the flow's optimization muscle lives."
        ),
    },
    {
        "name": "Clock Tree Synthesis",
        "slug": "cts",
        "hub": False,
        "blurb": (
            "The clock must reach every flip-flop at almost the same "
            "instant. Build the buffer tree that distributes it, trading "
            "skew against insertion delay against power on the wire that "
            "toggles every single cycle."
        ),
    },
    {
        "name": "Routing",
        "slug": "routing",
        "hub": True,
        "blurb": (
            "Connect every pin of every net with real wires on the metal "
            "stack: dodge the macros, dodge each other, honor the design "
            "rules. Sixty years of algorithms about finding paths through "
            "a crowded grid."
        ),
    },
    {
        "name": "Timing Analysis",
        "slug": "timing",
        "hub": False,
        "blurb": (
            "The referee of the whole flow. Propagate arrival and "
            "required times through every path and prove the chip meets "
            "its clock, without simulating a single vector. Every stage "
            "above optimizes against its verdict."
        ),
    },
    {
        "name": "Finishing",
        "slug": "finishing",
        "hub": False,
        "blurb": (
            "The last distance to a file a foundry can build. Fill the "
            "empty metal so the wafer polishes flat, swap every abstract "
            "for the cell's real polygons, then prove the result obeys "
            "every rule of the process and is still the circuit synthesis "
            "wrote."
        ),
    },
]
CATEGORY_ORDER = [c["name"] for c in CATEGORIES]

# "kind" places each explorable. An "example" is a stage of the OpenROAD
# flow walkthrough: one fixed design, every choice already made. An "open"
# one is a whole design the reader takes through the flow in the browser;
# those two kinds are the Sandboxes hub's two boxes. An "algorithm"
# sandbox is a single stage's method to play with: it is listed on the
# algorithms page and in the nav, not on the hub.
EXPLORABLES = [
    {
        "id": "synthesis-flow",
        "title": "Synthesizing a block, end to end",
        "category": "Synthesis",
        "kind": "example",
        "href": "/explore/examples/synthesis",
        "live": True,
        "foot": "7 steps \u00b7 the design tile4m",
        "blurb": (
            "Where every other example starts. Read the source, turn the "
            "always blocks into logic, choose how the adders carry, map "
            "the registers and then the logic onto real cells, and write "
            "out the netlist the floorplan example opens on its first "
            "step. Watch the cell count climb before it falls."
        ),
    },
    {
        "id": "floorplan-flow",
        "title": "Floorplanning a block, end to end",
        "category": "Floorplanning",
        "kind": "example",
        "href": "/explore/examples/floorplan",
        "live": True,
        "foot": "11 steps · the design tile4m",
        "blurb": (
            "Every step a physical design engineer takes on one small "
            "block, in order: read the design in, size the die, make rows "
            "and tracks, place the pins and the memories, add halos, build "
            "the power grid, insert the tap cells, forecast the congestion, "
            "and write the floorplan out. Real commands, one fixed design, "
            "and what to check at every step."
        ),
    },
    {
        "id": "placement-flow",
        "title": "Placing a block, end to end",
        "category": "Placement",
        "kind": "example",
        "href": "/explore/examples/placement",
        "live": True,
        "foot": "7 steps · the design tile4m",
        "blurb": (
            "The same block, picked up from the floorplan it just left: "
            "prepare the netlist, spread every cell with the analytic "
            "placer, buffer the long wires, then snap it all onto rows "
            "with as little movement as possible. Watch the density map "
            "fill in and the peak bin come back under the line."
        ),
    },
    {
        "id": "cts-flow",
        "title": "Building the clock tree, end to end",
        "category": "Clock Tree Synthesis",
        "kind": "example",
        "href": "/explore/examples/cts",
        "live": True,
        "foot": "7 steps · the design tile4m",
        "blurb": (
            "The same block again, now with a real clock. Group the "
            "flip-flops, branch out from the clock port until every "
            "group is reached equally, and watch the tree build itself "
            "level by level. Then measure what it cost: insertion "
            "delay, skew, and the hold violations that only appear once "
            "the clock stops being ideal."
        ),
    },
    {
        "id": "routing-flow",
        "title": "Routing a block, end to end",
        "category": "Routing",
        "kind": "example",
        "href": "/explore/examples/routing",
        "live": True,
        "foot": "7 steps · the design tile4m",
        "blurb": (
            "The same block, now drawn in metal. Find where a via may "
            "land on every pin, give each net a corridor and watch the "
            "congestion clear, repair timing against the corridors, "
            "fix the antennas that could destroy a gate in the factory, "
            "then turn it all into exact shapes on exact tracks until "
            "no design rule is broken."
        ),
    },
    {
        "id": "timing-flow",
        "title": "Signing off the timing, end to end",
        "category": "Timing Analysis",
        "kind": "example",
        "href": "/explore/examples/timing",
        "live": True,
        "foot": "7 steps · the design tile4m",
        "blurb": (
            "The same block, finished and measured. Extract the "
            "parasitics from the metal that was actually drawn, find "
            "out what that did to the clock, then walk the worst path "
            "gate by gate and ask the only question that matters: did "
            "the data arrive before it was required? Setup, hold, and "
            "the whole design at once."
        ),
    },
    {
        "id": "finish-flow",
        "title": "Finishing the block, end to end",
        "category": "Finishing",
        "kind": "example",
        "href": "/explore/examples/finish",
        "live": True,
        "foot": "8 steps · the design tile4m",
        "blurb": (
            "The same block, taken from signed off to taped out. Fill "
            "the empty metal and find out what that did to the timing, "
            "solve the power grid for how far the supply sags, stream "
            "the real layout of every cell into one file, then "
            "run the rule deck on every polygon and prove, transistor by "
            "transistor, that the layout is the netlist."
        ),
    },
    {
        "id": "riscv32i-design",
        "title": "riscv32i",
        "category": "Whole design",
        "kind": "open",
        "href": "/explore/designs/riscv32i",
        "live": True,
        "foot": "a 32-bit processor · 7 nanometer process",
        "blurb": (
            "A small, real processor for the RISC-V (Reduced Instruction "
            "Set Computer, fifth generation) instruction set, taken through the whole "
            "OpenROAD flow with settings you choose, and the result laid "
            "out in front of you: the layout, the timing, the area, the "
            "power."
        ),
    },
    {
        "id": "aes-design",
        "title": "aes",
        "category": "Whole design",
        "kind": "open",
        "href": "/explore/designs/aes",
        "live": True,
        "foot": "an encryption core · 7 nanometer process",
        "blurb": (
            "An AES (Advanced Encryption Standard) encryption core: about "
            "fourteen thousand cells of dense logic and no memories, where "
            "congestion and power, not memories, shape the layout."
        ),
    },
    {
        "id": "gcd-design",
        "title": "gcd",
        "category": "Whole design",
        "kind": "open",
        "href": "/explore/designs/gcd",
        "live": True,
        "foot": "a greatest-common-divisor unit · 7 nanometer process",
        "blurb": (
            "The smallest whole design: a unit that finds the greatest "
            "common divisor of two numbers, a few hundred cells in all. "
            "Small enough to see every cell and every wire, and the "
            "design the OpenROAD flow uses to check itself."
        ),
    },
    {
        "id": "floorplan-sandbox",
        "title": "The Floorplan Sandbox",
        "category": "Floorplanning",
        "kind": "algorithm",
        "href": "/explore/algorithms/floorplan-sandbox",
        "live": True,
        "blurb": (
            "Drag memory macros around a die, tune utilization and aspect "
            "ratio, and watch wirelength and a live congestion forecast "
            "react to every move. Compare a fast wire-density estimate "
            "against a trial global route and see which one catches the "
            "jammed channel."
        ),
    },
    {
        "id": "maze-router",
        "title": "The Maze Router",
        "category": "Routing",
        "kind": "algorithm",
        "href": "/explore/algorithms/maze-router",
        "live": True,
        "blurb": (
            "Watch Lee's wavefront flood a routing grid, race it against "
            "A* (A-star), draw your own blockages, and discover why the "
            "order you route nets in changes the answer."
        ),
    },
    {
        "id": "analytical-placement",
        "title": "Analytical Placement",
        "category": "Placement",
        "kind": "algorithm",
        "href": None,
        "live": False,
        "blurb": (
            "Drag cells on a die and watch wirelength and overlap respond "
            "live; then let the quadratic solver pull the design into "
            "place, one iteration at a time."
        ),
    },
    {
        "id": "clock-tree-balancer",
        "title": "The Clock Tree Balancer",
        "category": "Clock Tree Synthesis",
        "kind": "algorithm",
        "href": None,
        "live": False,
        "blurb": (
            "Build a buffer tree over scattered flip-flops and watch skew "
            "collapse as the tree balances; break it on purpose and see "
            "which sinks suffer."
        ),
    },
    {
        "id": "sta-walkthrough",
        "title": "Arrival vs Required",
        "category": "Timing Analysis",
        "kind": "algorithm",
        "href": None,
        "live": False,
        "blurb": (
            "Step arrival and required times through a real path, edge by "
            "edge, and watch slack emerge (and go negative) as you tighten "
            "the clock."
        ),
    },
]


# Families shown on the Methods page for a stage with more than four, when the
# first four in catalog order would leave out something a reader expects:
# routing keeps its founding algorithm (Lee, under foundations and history).
FEATURED = {
    "routing": ["architecture", "global", "detailed", "historical"],
}


def grouped():
    """Categories in flow order, each with its explorables (live first).
    A category whose algorithm catalog has content gets a hub button and
    a cataloged-algorithm count; the hand-written routing catalog counts
    until its registry module lands."""
    from . import algo_content

    groups = []
    for cat in CATEGORIES:
        items = [e for e in EXPLORABLES if e["category"] == cat["name"]]
        if items:
            items.sort(key=lambda e: (not e["live"], e["title"]))
            cat = dict(cat)
            count = algo_content.algo_count(cat["slug"])
            cat["algo_count"] = count
            cat["hub"] = bool(count) or cat["slug"] == "routing"
            # the end-to-end walkthrough is listed under Sandboxes; the Methods
            # page keeps only a pointer to it and the stage's other sandboxes
            walks = [e for e in items if (e.get("href") or "").startswith("/explore/examples/")]
            cat["walkthrough"] = walks[0] if walks else None
            cat["sandboxes"] = [e for e in items if e["live"] and e not in walks]
            # the catalog's families, by display name, for the index at the
            # top of the page (only families that have pages yet)
            stage = algo_content.get_stage(cat["slug"])
            if stage:
                used = {a.get("family") for a in stage["algorithms"]}
                cat["families"] = [f["name"] for f in stage["stage"].get("families", []) if f["id"] in used]
                # one algorithm per family for the Methods page, a short tour
                # of the stage's schools of thought: the family's first
                # foundational entry, or its first entry if none is
                # foundational (the full list is the stage's catalog page)
                cat["highlights"] = []
                for fam in stage["stage"].get("families", []):
                    members = [a for a in stage["algorithms"] if a.get("family") == fam["id"]]
                    if not members:
                        continue
                    pick = next((a for a in members if a.get("level") == "foundational"), members[0])
                    cat["highlights"].append({
                        "fid": fam["id"], "family": fam["name"], "name": pick["name"], "slug": pick["slug"],
                        "year": pick.get("year", ""), "level": pick.get("level", ""),
                        # the short card blurb when there is one: the full summary
                        # is for the catalog page
                        "summary": pick.get("card") or pick.get("summary", ""), "more": len(members) - 1})
                # the Methods page shows one row: four families, the first four
                # unless the stage names its own (FEATURED)
                want = FEATURED.get(cat["slug"])
                shown = [h for h in cat["highlights"] if h["fid"] in want] if want else cat["highlights"]
                cat["shown"] = shown[:4]
            groups.append((cat, items))
    return groups


def sandboxes(kind=None):
    """Explorables in flow order (stage by stage), each paired with its
    category, for the Sandboxes hub page. Pass a kind ("example" or
    "open") to get just that box."""
    from . import algo_content

    out = []
    # whole designs first: they span every stage, so they sit ahead of the
    # per-stage sandboxes under a heading of their own
    whole = {"name": "Whole design", "slug": "design", "hub": False, "catalog": False}
    for e in EXPLORABLES:
        if e["category"] == whole["name"] and (kind is None or e.get("kind", "open") == kind):
            out.append((whole, e))
    for cat in CATEGORIES:
        # only link a stage's methods page when its catalog exists
        cat = dict(cat, catalog=algo_content.get_stage(cat["slug"]) is not None)
        for e in EXPLORABLES:
            if e["category"] == cat["name"] and (kind is None or e.get("kind", "open") == kind):
                out.append((cat, e))
    return out
