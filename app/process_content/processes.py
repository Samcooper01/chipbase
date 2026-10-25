"""Foundry Processes: the fab's side of physical design.

House standard: science voice, display equations with legends, named
steps where a procedure exists, one figure per job, evidence framing."""

STAGE = {
    "slug": "processes",
    "name": "Foundry Processes",
    "tagline": (
        "What the fab hands a physical-design engineer and how it "
        "constrains every stage of the flow: the PDK (Process Design "
        "Kit) and its libraries, the transistors and the metal stack, "
        "the lithography that sets the pitches, the variation and "
        "reliability limits that define sign-off, and the open PDKs "
        "this platform runs on."
    ),
    "families": [
        {
            "id": "pdk",
            "short": "PDK",
            "name": "What the foundry gives you: the PDK (Process Design Kit)",
            "lead": (
                "Read this first. A PDK (Process Design Kit) is the "
                "contract between the fab and the design team: every "
                "geometry the tools may draw, every cell they may place, "
                "and every rule and model they must obey come from it."
            ),
        },
        {
            "id": "devices",
            "short": "devices",
            "name": "Transistors and the front end",
            "lead": (
                "The switch itself, and how its shape changed as it "
                "shrank: planar, FinFET, and gate-all-around, and why "
                "the node name stopped meaning a dimension."
            ),
        },
        {
            "id": "interconnect",
            "short": "interconnect",
            "name": "The interconnect stack",
            "lead": (
                "Ten to fifteen metal layers above the transistors, "
                "each with a pitch, a thickness, and a resistance. "
                "Routing uses these layers, and at advanced nodes so does most "
                "of the delay."
            ),
        },
        {
            "id": "litho",
            "short": "litho",
            "name": "Lithography and manufacturability",
            "lead": (
                "How patterns get onto the wafer sets what the router "
                "may draw: the resolution limit, multi-patterning, EUV "
                "(Extreme Ultraviolet), and the design-for-manufacturing "
                "rules that follow."
            ),
        },
        {
            "id": "signoff",
            "short": "sign-off",
            "name": "Variation, reliability, and sign-off",
            "lead": (
                "No two transistors are identical and no wire lasts "
                "forever. Corners, on-chip variation, electromigration, "
                "and IR (current times resistance) drop are how the flow "
                "guarantees a chip that works across the full "
                "distribution, for years."
            ),
        },
        {
            "id": "open",
            "short": "open PDKs",
            "name": "Open PDKs (Process Design Kits)",
            "lead": (
                "The process kits anyone can download, and the ones this "
                "platform's graded problems actually run on."
            ),
        },
    ],
}

ENTRIES = [
    # ---------------------------------------------------------- PDK
    {
        "slug": "pdk-anatomy",
        "level": "foundational",
        "name": "Anatomy of a PDK (Process Design Kit)",
        "family": "pdk",
        "year": "",
        "who": "every foundry",
        "chips": [("diff-easy", "the contract with the fab")],
        "summary": (
            "The files a foundry ships and what each one tells the flow: "
            "technology rules and layers, cell geometry, timing and power "
            "models, verification decks, and parasitic tables."
        ),
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "refs": [
            ("SkyWater SKY130 PDK documentation",
             "https://skywater-pdk.readthedocs.io/"),
            ("OpenROAD platform configuration (what the flow reads from a PDK (Process Design Kit))",
             "https://openroad-flow-scripts.readthedocs.io/en/latest/user/FlowVariables.html"),
        ],
        "body": """
## The idea

A PDK (Process Design Kit) is everything a design team needs to
produce a manufacturable layout for one process without knowing how
the process is built. Its contents map onto the flow's stages almost
one to one:

<div class="walk-fig" data-walk="pdk-map"></div>

A kit has four parts:

- Technology description: the layer stack, routing pitches and
  directions, via definitions, and the design rules the tools enforce
  during layout; delivered as a technology LEF (Library Exchange
  Format) file for place-and-route plus rule files for the sign-off
  tools.
- Cell library: the standard cells (and often memories and I/O
  (Input/Output) cells) as abstract geometry for placement and routing
  (cell LEF (Library Exchange Format)), timing and power models
  (Liberty), and full layout for the final tape-out (GDSII (Graphic
  Design System II) or OASIS (Open Artwork System Interchange
  Standard)).
- Verification decks: the DRC (Design Rule Check), LVS (Layout
  Versus Schematic), and antenna rule decks the sign-off tools run
  against the finished layout.
- Models: transistor SPICE (Simulation Program with Integrated
  Circuit Emphasis) models for circuit simulation, and
  parasitic-extraction tables (resistance and capacitance per layer
  and geometry) so the timing tools can estimate wire delay.

The place-and-route flow reads only the abstractions: it never sees a
transistor. It sees cells as boxes with pins and blockages, layers as
track grids with capacities and rules, and timing as lookup tables.
The full geometry is merged in only at the end, when the routed
abstract layout is combined with the cell layouts into the tape-out
database.

## The files, with SKY130 examples

Every kind of file below is a real, public file from the SKY130 kit
as packaged in the OpenROAD flow's `sky130hd` platform (the platform
this site's graded problems run on). Open one to see what the flow
actually reads.

| file kind | what it holds | who reads it | SKY130 example |
|---|---|---|---|
| technology LEF (Library Exchange Format) | layers, pitches, directions, via definitions, spacing tables, antenna parameters | floorplan, place, CTS (Clock Tree Synthesis), route | [sky130_fd_sc_hd.tlef](https://github.com/The-OpenROAD-Project/OpenROAD-flow-scripts/blob/master/flow/platforms/sky130hd/lef/sky130_fd_sc_hd.tlef) |
| cell LEF (Library Exchange Format) | per cell: size, site, pin shapes and layers, obstructions | floorplan, place, CTS (Clock Tree Synthesis), route | [sky130_fd_sc_hd_merged.lef](https://github.com/The-OpenROAD-Project/OpenROAD-flow-scripts/blob/master/flow/platforms/sky130hd/lef/sky130_fd_sc_hd_merged.lef) |
| Liberty (.lib) | per cell and arc: delay and slew tables, power, leakage, at one PVT (Process, Voltage, Temperature) corner | synthesis, place, CTS (Clock Tree Synthesis), STA (Static Timing Analysis) | [sky130_fd_sc_hd__tt_025C_1v80.lib](https://github.com/The-OpenROAD-Project/OpenROAD-flow-scripts/blob/master/flow/platforms/sky130hd/lib/sky130_fd_sc_hd__tt_025C_1v80.lib) (typical corner; the [full library](https://github.com/google/skywater-pdk-libs-sky130_fd_sc_hd) ships every corner) |
| parasitic tables | wire resistance and capacitance per layer and pattern for extraction | STA (Static Timing Analysis) after routing | [rcx_patterns.rules](https://github.com/The-OpenROAD-Project/OpenROAD-flow-scripts/blob/master/flow/platforms/sky130hd/rcx_patterns.rules); the pre-route estimates in [setRC.tcl](https://github.com/The-OpenROAD-Project/OpenROAD-flow-scripts/blob/master/flow/platforms/sky130hd/setRC.tcl) |
| DRC (Design Rule Check) deck | every geometric rule the layout must satisfy | sign-off | [sky130hd.lydrc](https://github.com/The-OpenROAD-Project/OpenROAD-flow-scripts/blob/master/flow/platforms/sky130hd/drc/sky130hd.lydrc) (KLayout deck); the rules themselves in the [SKY130 periphery rules](https://github.com/google/skywater-pdk/blob/main/docs/rules/periphery.rst) |
| LVS (Layout Versus Schematic) deck | device and connectivity extraction to compare layout against netlist | sign-off | [sky130hd.lylvs](https://github.com/The-OpenROAD-Project/OpenROAD-flow-scripts/blob/master/flow/platforms/sky130hd/lvs/sky130hd.lylvs) |
| cell layouts, GDSII (Graphic Design System II) | full mask geometry of every cell, merged with the routing at tape-out | sign-off, tape-out | [sky130_fd_sc_hd.gds](https://github.com/The-OpenROAD-Project/OpenROAD-flow-scripts/blob/master/flow/platforms/sky130hd/gds/sky130_fd_sc_hd.gds) |
| SPICE (Simulation Program with Integrated Circuit Emphasis) models | transistor and device models for circuit simulation and characterization | library characterization, analog design | [sky130_fd_pr primitives](https://github.com/google/skywater-pdk-libs-sky130_fd_pr) |
| flow configuration | which of the above the flow uses, plus site, rows, power-grid recipe | the flow itself | [config.mk](https://github.com/The-OpenROAD-Project/OpenROAD-flow-scripts/blob/master/flow/platforms/sky130hd/config.mk), [pdn.tcl](https://github.com/The-OpenROAD-Project/OpenROAD-flow-scripts/blob/master/flow/platforms/sky130hd/pdn.tcl) (power grid) |

The upstream kit lives at the [SkyWater PDK (Process Design Kit) repository](https://github.com/google/skywater-pdk); the
[open_pdks](https://github.com/RTimothyEdwards/open_pdks) project packages it into the directory layout most open
tools expect.

## Where each file is consumed

**[Technology LEF (Library Exchange Format)](https://github.com/The-OpenROAD-Project/OpenROAD-flow-scripts/blob/master/flow/platforms/sky130hd/lef/sky130_fd_sc_hd.tlef)** is read at floorplanning
and drives every later stage: routing layer names, preferred
directions, pitches, minimum widths and spacings, via rules, and
antenna parameters. The router's track grid is built from it.

**[Cell LEF (Library Exchange Format)](https://github.com/The-OpenROAD-Project/OpenROAD-flow-scripts/blob/master/flow/platforms/sky130hd/lef/sky130_fd_sc_hd_merged.lef)** is read with the technology LEF (Library Exchange Format): each cell's size, pin
shapes and layers, and internal obstructions. Placement legalizes to
the site width and row height it defines; the router accesses the
pins it draws.

**[Liberty (.lib)](https://github.com/The-OpenROAD-Project/OpenROAD-flow-scripts/blob/master/flow/platforms/sky130hd/lib/sky130_fd_sc_hd__tt_025C_1v80.lib)** is read by synthesis and by STA (Static Timing
Analysis): per cell, per arc, delay and output slew as tables of input
slew and output load, plus leakage and switching power, at one PVT (Process, Voltage, Temperature)
(Process, Voltage, Temperature) corner per file.

**[Parasitic tables](https://github.com/The-OpenROAD-Project/OpenROAD-flow-scripts/blob/master/flow/platforms/sky130hd/rcx_patterns.rules)** (in OpenROAD, the RCX (Resistance-Capacitance
eXtraction) rules file) are read after routing to turn wire geometry
into resistances and capacitances for the timing tools.

**[DRC (Design Rule Check)](https://github.com/The-OpenROAD-Project/OpenROAD-flow-scripts/blob/master/flow/platforms/sky130hd/drc/sky130hd.lydrc) and [LVS (Layout Versus Schematic)](https://github.com/The-OpenROAD-Project/OpenROAD-flow-scripts/blob/master/flow/platforms/sky130hd/lvs/sky130hd.lylvs) decks**
are read by the sign-off tools on the merged layout: DRC (Design Rule Check) proves every
shape obeys the rules, LVS (Layout Versus Schematic) proves the drawn transistors and wires
match the netlist.

## Pros, cons, and the trade-off

<div class="pros-cons">
<div class="pc-card pc-pros">
<h3>Strengths of the abstraction</h3>
<ul>
<li><strong>Portability</strong>: the same flow runs on any process that ships the same file kinds; changing PDK (Process Design Kit) is changing inputs, not tools.</li>
<li><strong>Scale</strong>: boxes-with-pins and lookup tables let a router handle billions of shapes that no transistor-level tool could.</li>
<li><strong>Protection</strong>: the foundry discloses rules and models, not how the process is built.</li>
</ul>
</div>
<div class="pc-card pc-cons">
<h3>Weaknesses</h3>
<ul>
<li><strong>Abstraction gaps</strong>: LEF (Library Exchange Format) capacities approximate real rules; a route legal in the abstraction can fail sign-off DRC (Design Rule Check).</li>
<li><strong>Corner explosion</strong>: one Liberty file per corner, and modern nodes need dozens.</li>
<li><strong>Kit quality varies</strong>: a poorly characterized library or an incomplete deck costs the design team weeks, and they cannot fix it themselves.</li>
</ul>
</div>
</div>

<div class="tradeoff-box">
<h3>The trade-off</h3>
<p>The PDK (Process Design Kit) trades fidelity for tractability at every interface: the flow works on abstractions precisely so that it can work at all, and every abstraction is a place where the sign-off tools may later disagree. Knowing which file feeds which stage is knowing where those disagreements can come from.</p>
</div>

## Where to see one

- <strong>Open source</strong>: the [SkyWater SKY130 PDK (Process Design Kit)](https://skywater-pdk.readthedocs.io/) publishes every file kind above and
  is the process this platform's graded problems run on; its
  documentation is the most complete public tour of a PDK (Process
  Design Kit).
- <strong>The flow's view</strong>: OpenROAD's platform directories
  show exactly which PDK (Process Design Kit) files a place-and-route flow consumes and
  which it ignores.
- <strong>Commercial kits</strong>: structurally the same, delivered
  under NDA (Non-Disclosure Agreement), with far larger libraries and
  many more corners.
""",
    },
    {
        "slug": "standard-cell-library",
        "level": "foundational",
        "name": "The Standard-Cell Library",
        "family": "pdk",
        "year": "",
        "who": "foundry and library vendors",
        "chips": [("diff-easy", "what placement places")],
        "summary": (
            "Fixed-height, variable-width logic cells on a common site "
            "grid, characterized into timing and power tables: the "
            "vocabulary every digital design is written in, and the "
            "geometry that placement and routing take as given."
        ),
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "refs": [
            ("SKY130 standard cell library (sky130_fd_sc_hd)",
             "https://skywater-pdk.readthedocs.io/en/main/contents/libraries/sky130_fd_sc_hd/README.html"),
            ("Liberty format (Synopsys, open specification)",
             "https://www.synopsys.com/community/interoperability-programs/tap-in.html"),
        ],
        "body": """
## The idea

A standard-cell library is a set of pre-designed logic gates and
flip-flops that share one physical convention, so that any of them
can be placed next to any other and wired by the same router. At the
die level the convention looks like this:

<div class="walk-fig" data-walk="stdcell-rows"></div>

And inside one cell:

<div class="walk-fig" data-walk="stdcell-anatomy"></div>

Every cell in the library has the same height and a width that is an
integer number of placement sites; VDD (positive supply) and VSS
(ground) rails run along its top and bottom edges so that abutting
rows share rails (alternate rows are flipped); and its pin shapes
fall on routing tracks so the router can reach them (the pin-access
page in routing covers when it cannot). The footprint follows from
two process pitches and two library choices:

- Cell height is the library's chosen number of routing tracks times
  the metal pitch of the finest routing layer. Heights of 7, 9, or 12
  tracks are common; fewer tracks is denser but leaves less room for
  pins and fins.
- Cell width is an integer number of placement sites, so placement is
  discrete.
- One site is one transistor column, so its width is the process's
  contacted gate pitch, and a wider cell holds more or larger devices.

The same logical function comes in several *drive strengths* (wider
transistors, more sites, more current) and often several *threshold
voltage* flavours (low, standard, high; faster and leakier versus
slower and thriftier), so the optimizer can trade delay, area, and
power cell by cell.

## Characterization

Every cell is characterized by circuit simulation into a Liberty
table:

<div class="eq">delay(arc) = table[input slew][output load], slew_out(arc) = table[input slew][output load]</div>
<ul class="eq-legend">
<li><code>arc</code> one input-to-output timing path of the cell (rise and fall separately)</li>
<li><code>input slew</code> how fast the driving signal transitions; a slower input makes the cell slower</li>
<li><code>output load</code> the capacitance the cell drives (wire plus fan-in of the next cells); more load, more delay</li>
<li>one table set per PVT (Process, Voltage, Temperature) corner; power and leakage are tabulated the same way</li>
</ul>

STA (Static Timing Analysis) never simulates; it looks up these
tables along every path. The tables' accuracy at the corners of their
range is a common source of sign-off surprises.

## What the flow assumes about cells

- <strong>Placement</strong> treats a cell as a rectangle of known
  height and width that must sit on a site in a row with the right
  orientation; nothing inside matters.
- <strong>Routing</strong> sees the pin shapes and the internal
  blockages, and must reach every pin legally.
- <strong>Timing</strong> sees only the Liberty tables.
- <strong>Sign-off</strong> finally merges the full cell layouts and
  checks them together with the routing.

## Pros, cons, and the trade-off

<div class="pros-cons">
<div class="pc-card pc-pros">
<h3>Strengths</h3>
<ul>
<li><strong>Automation</strong>: fixed height and site grid make placement a discrete problem tools solve at scale.</li>
<li><strong>Reuse</strong>: one characterized library serves every design on the process.</li>
<li><strong>Optimization knobs</strong>: drive strengths and threshold flavours let the flow trade power, delay, and area per instance.</li>
</ul>
</div>
<div class="pc-card pc-cons">
<h3>Weaknesses</h3>
<ul>
<li><strong>Density ceiling</strong>: a fixed-height template wastes area against custom layout for datapaths and memories.</li>
<li><strong>Library quality bounds design quality</strong>: pin access, drive granularity, and table accuracy are decided before the design begins.</li>
<li><strong>Corner cost</strong>: characterization at every corner is expensive, so kits ship fewer corners than designs would like.</li>
</ul>
</div>
</div>

<div class="tradeoff-box">
<h3>The trade-off</h3>
<p>The standard cell is the abstraction that made digital design automatic: a fixed physical template in exchange for the ability to place and route millions of instances by algorithm. Everything the flow does well follows from it, and so does its density gap against hand layout.</p>
</div>

## Where to see one

- <strong>Open source</strong>: the [SKY130 high-density library](https://skywater-pdk.readthedocs.io/en/main/contents/libraries/sky130_fd_sc_hd/README.html) publishes every cell's layout,
  LEF (Library Exchange Format), and Liberty tables; it is the library
  the platform's graded problems place and route.
- <strong>Commercial</strong>: foundry and third-party libraries follow
  the same template with more cells, more drive strengths, more
  threshold flavours, and many more corners.
""",
    },
    {
        "slug": "metal-stack-design-rules",
        "level": "foundational",
        "name": "The Metal Stack and Design Rules",
        "family": "pdk",
        "year": "",
        "who": "every foundry",
        "chips": [("diff-easy", "the router's world, defined")],
        "summary": (
            "The layers a process offers, their pitches and preferred "
            "directions, and the width, spacing, enclosure, and area rules "
            "that make a shape manufacturable: the constraints the router "
            "and the DRC (Design Rule Check) deck agree on."
        ),
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "refs": [
            ("SKY130 design rules (periphery)",
             "https://skywater-pdk.readthedocs.io/en/main/rules/periphery.html"),
            ("LEF/DEF language reference (Si2)",
             "https://si2.org/oa-lefdef/"),
        ],
        "body": """
## The idea

The metal stack is the list of wiring layers a process offers, from
the fine local layers just above the transistors to the thick global
layers at the top, and the vias that connect them. Each layer has a
routing pitch, a preferred direction, and a thickness that sets its
resistance:

<div class="walk-fig" data-walk="metal-stack"></div>

Each layer is described by a handful of parameters, and each via by
a few more:

- Pitch: the distance between adjacent routing tracks; the
  router's grid on that layer.
- Direction: horizontal or vertical preferred routing, alternating
  layer by layer so crossings are cheap and parallel runs are far
  apart.
- Thickness: thin lower layers for density, thick upper layers
  for low resistance (power, clocks, long signals); resistance per
  length scales inversely with width times thickness.
- Minimum width and spacing: the smallest wire and the smallest
  gap the layer can print.
- Via cut size, enclosure, and spacing: how large a via is, how
  far the metal above and below must extend beyond it, and how close
  two vias may sit; enclosure is the rule that makes pin access hard.

## The rules that matter to a router

The full DRC (Design Rule Check) deck has hundreds of rules; a
handful account for nearly everything the router deals with:

- Minimum width and spacing: a wire may be no narrower than the
  layer's minimum, and two shapes no closer than the minimum spacing,
  which grows for wider or longer parallel runs (spacing tables).
- Via enclosure: the metal above and below a via must extend
  beyond the cut, sometimes more on two opposite sides than the other
  two.
- End-of-line spacing: the end of a wire needs extra clearance
  from shapes it points at.
- Minimum area: a metal shape below a certain area cannot be
  reliably manufactured, so tiny stubs must be enlarged.
- Antenna ratios: per-layer limits on collecting metal area
  versus gate area (see the routing section's antenna page).
- Density: each layer must be filled to within a window-averaged
  range so the polishing step is uniform; the flow inserts dummy
  metal fill after routing.

The router honours these in its own model (LEF (Library Exchange
Format) rules and spacing tables); the sign-off DRC (Design Rule
Check) deck is the authority, and any difference between the two
surfaces as violations to repair.

## Pros, cons, and the trade-off

<div class="pros-cons">
<div class="pc-card pc-pros">
<h3>Strengths of the stack design</h3>
<ul>
<li><strong>Alternating directions</strong> make routing tractable: any two points connect with at most a few layer changes.</li>
<li><strong>Layered thickness</strong> lets one process serve dense local wiring and low-resistance global wiring at once.</li>
<li><strong>Rules as a contract</strong>: a layout that passes DRC (Design Rule Check) will manufacture, without the designer knowing the process.</li>
</ul>
</div>
<div class="pc-card pc-cons">
<h3>Weaknesses</h3>
<ul>
<li><strong>Rule count grows every node</strong>: hundreds of rules with context dependence, which routers approximate and DRC (Design Rule Check) enforces exactly.</li>
<li><strong>Vias are expensive</strong>: resistance, area, and blocked tracks on two layers for every layer change.</li>
<li><strong>Lower layers keep getting slower</strong>: as pitches shrink, thin-wire resistance climbs faster than gate delay falls.</li>
</ul>
</div>
</div>

<div class="tradeoff-box">
<h3>The trade-off</h3>
<p>The metal stack is the process's answer to a contradiction: wires must be dense where the logic is and fast where the distances are. Splitting the stack by thickness resolves it, at the price of vias between the regimes and a rule deck that grows with every node.</p>
</div>

## Where to see one

- <strong>Open source</strong>: the [SKY130 periphery rules](https://skywater-pdk.readthedocs.io/en/main/rules/periphery.html) list every rule with a diagram; the
  process has 5 metal layers plus local interconnect, small enough to
  read in one sitting.
- <strong>The router's copy</strong>: the technology LEF (Library
  Exchange Format) in any OpenROAD platform directory shows the
  subset of rules a router models.
- <strong>Advanced nodes</strong>: 10 to 15 metal layers and rule
  decks in the thousands of rules, under NDA (Non-Disclosure
  Agreement).
""",
    },
    # ---------------------------------------------------- devices
    {
        "slug": "transistor-evolution",
        "level": "foundational",
        "name": "Planar, FinFET, Gate-All-Around",
        "family": "devices",
        "year": "1960s onward",
        "who": "the industry",
        "chips": [("diff-easy", "the switch, three shapes")],
        "summary": (
            "How the MOSFET (Metal-Oxide-Semiconductor Field-Effect "
            "Transistor) changed shape to keep switching off as it "
            "shrank: planar to FinFET (2011) to gate-all-around "
            "nanosheets (2022), and what each shape means for cell "
            "design."
        ),
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "refs": [
            ("FinFET (Wikipedia)", "https://en.wikipedia.org/wiki/FinFET"),
            ("Gate-all-around FET (Wikipedia)",
             "https://en.wikipedia.org/wiki/Gate-all-around_FET"),
        ],
        "body": """
## The idea

A MOSFET (Metal-Oxide-Semiconductor Field-Effect Transistor) is a
switch: a gate electrode, separated from a semiconductor channel by a
thin insulator, controls whether current flows between source and
drain. Scaling the gate length makes the switch faster and smaller,
but past a point the gate loses control of the channel: current leaks
even when the switch is off. Each generation of transistor geometry
is a way of giving the gate more control:

<div class="walk-fig" data-walk="transistor-shapes"></div>

The measure that matters is how much of the channel's surface the
gate touches relative to the channel volume it must control:

- Planar: the gate touches the channel on one side only (the top);
  control degrades as gate length shrinks (short-channel effects).
- FinFET: the channel is a thin vertical fin and the gate wraps
  three sides; strong control, and drive current comes in quanta of
  fins.
- Gate-all-around (GAA), nanosheet: the channel is a stack of
  thin horizontal sheets and the gate surrounds each on all four
  sides; the best control, and drive strength tunes continuously with
  sheet width.

## What each shape means for physical design

- Planar (through 28/22 nm): device width is continuous, so
  cell designers size transistors freely; layout is the classic
  diffusion-and-poly picture.
- FinFET (22/16 nm to 5/3 nm): width is quantized in fins, so
  drive strengths come in integer steps and cell heights are counted
  in fins (a 6-track cell might allow 2 fins per device). Fin pitch and
  the fixed gate pitch make cell layout a grid problem, and the
  library's drive-strength granularity coarsens.
- Gate-all-around nanosheet (3/2 nm onward): sheet width is
  continuous again, so drive tunes finely, and stacking sheets gives
  more current per footprint. Successors under development stack an
  n-type device on top of a p-type one (CFET (Complementary Field-Effect Transistor)),
  halving cell footprint again.

The node name attached to each of these (7 nm, 5 nm, 3 nm) no longer
corresponds to any drawn dimension; see the node-naming page.

## Pros, cons, and the trade-off

<div class="pros-cons">
<div class="pc-card pc-pros">
<h3>Strengths of each step</h3>
<ul>
<li><strong>FinFET</strong> restored off-state control and let scaling continue for a decade; it also raised drive per footprint.</li>
<li><strong>Gate-all-around</strong> extends control further and gives back continuous width tuning.</li>
<li><strong>Both</strong> reduce leakage per switch, the dominant power term at the end of the planar era.</li>
</ul>
</div>
<div class="pc-card pc-cons">
<h3>Weaknesses</h3>
<ul>
<li><strong>Fin quantization</strong> made cell design and drive-strength tuning coarser and constrained library architecture.</li>
<li><strong>Process complexity and cost</strong> rise sharply at each transition; nanosheet stacks are among the hardest structures ever manufactured.</li>
<li><strong>Parasitic capacitance</strong> of wrapped gates is high, so the delay win per node has shrunk while wire delay grew.</li>
</ul>
</div>
</div>

<div class="tradeoff-box">
<h3>The trade-off</h3>
<p>Every transistor generation trades manufacturing complexity for gate control. For the physical-design engineer the visible consequence is the library: continuous sizing gave way to fin counts and is coming back as sheet widths, and the cell template follows the device.</p>
</div>

## Where it stands today

- <strong>Production</strong>: FinFET is the production device from 16/14 nm
  through 5/4 nm at every leading foundry; gate-all-around nanosheets
  entered production at 3 nm (Samsung, 2022) and 2 nm (TSMC and Intel
  announced for 2025).
- <strong>Open PDKs (Process Design Kits)</strong>: SKY130 and the
  other open kits are planar; ASAP7 (Arizona State University 7 nm
  predictive PDK (Process Design Kit)) is a FinFET model kit and is where the fin-count
  library structure can be studied openly.
""",
    },
    {
        "slug": "node-naming",
        "level": "foundational",
        "name": "What a Node Name Means",
        "family": "devices",
        "year": "",
        "who": "foundry marketing; industry roadmaps",
        "chips": [("diff-easy", "7 nm is not 7 nm")],
        "summary": (
            "Node names stopped tracking any physical dimension around "
            "the 22 nm generation. What actually defines a node: gate "
            "pitch, metal pitch, fin or sheet pitch, cell height, and the "
            "density metric that follows from them."
        ),
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "refs": [
            ("Semiconductor device fabrication: technology nodes (Wikipedia)",
             "https://en.wikipedia.org/wiki/Semiconductor_device_fabrication#Technology_nodes"),
            ("IRDS (International Roadmap for Devices and Systems)",
             "https://irds.ieee.org/"),
        ],
        "body": """
## The idea

Through the 1990s a node name was the drawn gate length: a 350 nm
process had 350 nm gates. Once gate length stopped shrinking in step
with density (around 22 nm), the names kept counting down as
marketing labels for successive generations. Nothing in a modern
"3 nm" process measures 3 nm. What defines a node is a set of pitches
and the density they permit:

<div class="walk-fig" data-walk="node-pitches"></div>

<div class="eq">cell area ≈ contacted gate pitch × cell height ; cell height = tracks × metal pitch</div>
<ul class="eq-legend">
<li><code>contacted gate pitch (CPP)</code> the distance from one transistor gate to the next including the contact between them; sets cell width per transistor</li>
<li><code>metal pitch (MP)</code> the pitch of the finest routing layer; with the track count it sets cell height</li>
<li><code>tracks</code> how many routing tracks tall a standard cell is (from 12 in older nodes down to 5 or 6 in the newest); fewer tracks per cell is where much recent density came from</li>
<li><code>fin / sheet pitch</code> for FinFET and gate-all-around devices, how many fins or sheets fit under the cell height, which bounds drive strength</li>
</ul>

Two processes with the same name can differ by 30 percent in
density, and one foundry's "7 nm" can match another's "10 nm". Public
comparisons therefore use CPP (Contacted Poly Pitch), MP (Metal
Pitch), and a density figure such as transistors per square
millimetre for a standard cell mix.

## Why it matters to a physical-design engineer

- Design rules follow pitches, not names: the router's grid, the
  cell library's height, and the multi-patterning constraints all come
  from CPP (Contacted Poly Pitch) and MP (Metal Pitch).
- Track height sets library architecture: a 6-track cell has room
  for fewer fins and fewer pin-access points than a 9-track cell, so
  the same node offers different libraries with different
  density-versus-performance points.
- Cross-foundry comparisons by name are meaningless; compare the
  numbers.

## Pros, cons, and the trade-off

<div class="pros-cons">
<div class="pc-card pc-pros">
<h3>What names still do</h3>
<ul>
<li><strong>Order generations</strong> within one foundry: N5 is newer and denser than N7.</li>
<li><strong>Anchor roadmaps</strong> and public discussion, even if loosely.</li>
</ul>
</div>
<div class="pc-card pc-cons">
<h3>What they no longer do</h3>
<ul>
<li><strong>Measure anything</strong>: no drawn feature matches the number.</li>
<li><strong>Compare foundries</strong>: the same name means different pitches at different fabs.</li>
<li><strong>Predict cost or performance</strong>: those depend on the pitches, the device, and the library, not the label.</li>
</ul>
</div>
</div>

<div class="tradeoff-box">
<h3>The trade-off</h3>
<p>The name is a convenient fiction that survived because it is convenient. A physical-design engineer works in pitches, track heights, and rule decks; the number on the slide is for the slide.</p>
</div>

## Where to look it up

- The [IRDS (International Roadmap for Devices and Systems)](https://irds.ieee.org/) tabulates the pitches behind each
  generation.
- Foundry technology pages give CPP (Contacted Poly Pitch), MP (Metal
  Pitch), and density figures; independent teardown analyses measure
  them.
- For open kits, the pitches are in the technology LEF (Library
  Exchange Format): SKY130's finest metal pitch and ASAP7 (Arizona
  State University 7 nm predictive PDK (Process Design Kit))'s can be read directly.
""",
    },
    # ------------------------------------------------ interconnect
    {
        "slug": "beol-and-damascene",
        "level": "research",
        "name": "The BEOL (Back End Of Line) Stack and Damascene Copper",
        "family": "interconnect",
        "year": "1997 onward",
        "who": "IBM (copper damascene, 1997); the industry",
        "chips": [("diff-easy", "how wires are actually made")],
        "summary": (
            "The back end of line builds the interconnect one layer at a "
            "time by dual damascene: etch trenches and via holes into "
            "dielectric, line and fill with copper, polish flat. The "
            "process order is why vias, fill, and antenna rules exist."
        ),
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "refs": [
            ("Damascene process (Wikipedia)",
             "https://en.wikipedia.org/wiki/Copper_interconnects#Damascene_process"),
            ("Back end of line (Wikipedia)",
             "https://en.wikipedia.org/wiki/Back_end_of_line"),
        ],
        "body": """
## The idea

The FEOL (Front End Of Line) builds the transistors; the BEOL (Back
End Of Line) builds everything above them: the metal layers, the
vias, and the dielectric between. Since 1997 the metal has been
copper, and copper cannot be etched cleanly, so each layer is made by
*damascene*: carve the pattern into the dielectric, fill it with
metal, polish away the excess:

<div class="walk-fig" data-walk="damascene"></div>

One BEOL (Back End Of Line) layer is built in six steps:

**Step 1 (deposit).** A slab of dielectric goes over the finished
layer below.

**Step 2 (pattern and etch).** Lithography defines the via holes down
to the layer below and the wire trenches, and both are etched into the
slab before any metal exists (dual damascene). The multi-patterning
constraints of the routing section act here, and the plasma etch is
where the antenna effect deposits its charge.

**Step 3 (barrier and seed).** A thin tantalum-based liner coats every
surface so copper cannot diffuse into the dielectric, plus a copper
seed for plating. The liner conducts poorly and does not thin with the
pitch; at fine widths it consumes a large fraction of the wire's
cross-section.

**Step 4 (fill).** Copper is electroplated, filling via and trench in
one step and overfilling the surface.

**Step 5 (polish).** CMP (Chemical-Mechanical Polishing) planarizes
the surface. It thins wide metal and dishes sparse regions, which is
why density rules and dummy fill exist.

**Step 6 (cap).** A dielectric cap seals the copper before the next
layer's slab is deposited.

The process repeats for every layer, thin layers first at fine pitch,
thick layers last at coarse pitch, and each layer's etch is a plasma
step: the antenna effect (routing section) is the charge those etches
deposit on wires that already connect to gates.

## What the process order explains

- Vias are separate objects with their own rules because they are
  separate holes etched before the trench above them.
- Wide wires are thinner than drawn after CMP (Chemical-Mechanical
  Polishing), so their resistance is worse than area suggests
  (dishing); spacing tables and slotting rules follow.
- Density fill is required so CMP (Chemical-Mechanical Polishing)
  sees a uniform surface; the flow inserts floating dummy metal after
  routing, and it adds capacitance the extractor must see.
- Barrier thickness does not scale with pitch, so at advanced
  nodes the conducting copper core of a minimum wire is a shrinking
  fraction of its cross-section, and resistance per length rises
  faster than geometry alone predicts.

## Pros, cons, and the trade-off

<div class="pros-cons">
<div class="pc-card pc-pros">
<h3>Strengths</h3>
<ul>
<li><strong>Copper</strong>: about 40 percent lower resistivity than the aluminium it replaced, and better electromigration life.</li>
<li><strong>Dual damascene</strong>: via and wire in one metallization step, fewer process steps per layer.</li>
<li><strong>Planar every layer</strong>: CMP (Chemical-Mechanical Polishing) makes stacks of 15 layers manufacturable.</li>
</ul>
</div>
<div class="pc-card pc-cons">
<h3>Weaknesses</h3>
<ul>
<li><strong>Barrier overhead</strong> at fine pitch, driving the search for barrier-less metals (cobalt, ruthenium) on the lowest layers.</li>
<li><strong>Dielectric constant</strong>: the low-k materials that cut capacitance are mechanically weak.</li>
<li><strong>Design-rule consequences</strong>: fill, density, dishing, and via rules exist to keep this process in its window, and the design pays for each.</li>
</ul>
</div>
</div>

<div class="tradeoff-box">
<h3>The trade-off</h3>
<p>Damascene copper made the many-layer stack possible and defined the interconnect era; its process window is why the metal rules look the way they do. At the finest pitches its own liner is now the limit, and the industry is changing metals on the bottom layers to escape it.</p>
</div>

## Where it stands today

- Copper dual damascene is the BEOL (Back End Of Line) of every
  process from 180 nm to the current leading edge.
- Cobalt and ruthenium replace copper on the lowest, finest layers at
  some foundries from the 10/7 nm generations onward, because their
  thin or absent liners beat copper's at that width.
- The rules a physical-design engineer meets (fill, density, via
  enclosure, antenna) all trace to steps in this sequence.
""",
    },
    {
        "slug": "wire-rc-scaling",
        "level": "research",
        "name": "Wire Resistance, Capacitance, and Why Interconnect Dominates",
        "family": "interconnect",
        "year": "",
        "who": "the scaling arithmetic",
        "chips": [("diff-hard", "the delay moved into the wires")],
        "summary": (
            "Shrinking a wire raises its resistance faster than it lowers "
            "its capacitance, so wire delay grew as gate delay fell. The "
            "RC (Resistance-Capacitance) arithmetic, and the consequences: "
            "buffering, layer promotion, and timing that depends on "
            "routing."
        ),
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "refs": [
            ("Elmore delay (Wikipedia)",
             "https://en.wikipedia.org/wiki/Elmore_delay"),
            ("Interconnect scaling: ITRS/IRDS interconnect chapters",
             "https://irds.ieee.org/"),
        ],
        "body": """
## The idea

A wire is a distributed resistance and capacitance. Its delay to
first order is the Elmore delay, and for a uniform wire that scales
with the square of its length:

<div class="eq">delay ≈ 0.38 × r × c × L² (unbuffered wire) ; r = ρ / (w × t) ; c ≈ ε × (t / s + w / h)</div>
<ul class="eq-legend">
<li><code>r</code> resistance per unit length: resistivity ρ over cross-section (width w times thickness t); halving width and thickness together quadruples r</li>
<li><code>c</code> capacitance per unit length: sidewall coupling to neighbours at spacing s plus plate capacitance to the layers above and below at distance h; it barely falls with scaling because everything shrinks together</li>
<li><code>L</code> wire length; the quadratic term is why long wires are broken with buffers into segments whose delay adds linearly</li>
<li><code>ρ</code> effective resistivity, which itself rises at fine widths (electron scattering at surfaces and grain boundaries, plus the non-scaling barrier)</li>
</ul>

<div class="walk-fig" data-walk="rc-scaling"></div>

Scaling shrinks a gate and makes it faster; scaling shrinks a wire's
cross-section and makes it slower per unit length, while the chip's
long wires stay long. Around the 130 nm generation the delay of a
global wire overtook a gate delay, and at advanced nodes even local
wires matter: timing is decided by routing, which is why the flow
iterates routing and STA (Static Timing Analysis) together.

## The consequences the flow lives with

- Buffering: a long wire is split into segments with repeaters
  so delay grows linearly with length instead of quadratically;
  repeater insertion is a placement-and-routing-time optimization.
- Layer promotion: critical long nets move to thick upper metal
  where r is several times lower (the layer-assignment page in
  routing).
- Timing depends on routing: pre-route timing estimates carry
  wireload models or Steiner estimates; post-route parasitics from
  extraction are the truth, and the two can differ enough to reopen
  closure.
- Coupling capacitance between neighbours is a large fraction of
  c at fine pitch, which is why crosstalk-aware routing exists.

## Pros, cons, and the trade-off

<div class="pros-cons">
<div class="pc-card pc-pros">
<h3>What still improves</h3>
<ul>
<li><strong>Local wires</strong> shrink with the cells they connect, so their absolute delay stays tolerable.</li>
<li><strong>Thick upper layers</strong> keep global delay in check when critical nets are promoted.</li>
<li><strong>Buffering</strong> converts the L² problem into a linear one at the cost of area and power.</li>
</ul>
</div>
<div class="pc-card pc-cons">
<h3>What gets worse</h3>
<ul>
<li><strong>Resistance per length</strong> of minimum wires rises faster than geometry predicts, because of resistivity and barrier effects.</li>
<li><strong>Via resistance</strong> becomes a significant fraction of path delay at fine pitch.</li>
<li><strong>Power</strong>: charging wire capacitance is a large share of dynamic power, and repeaters add more.</li>
</ul>
</div>
</div>

<div class="tradeoff-box">
<h3>The trade-off</h3>
<p>Scaling helped transistors and hurt wires, and the flow's architecture is the response: routing-aware placement, timing-driven routing, repeaters, and layer promotion all exist because delay moved into the interconnect. A physical-design engineer's job is largely managing that migration.</p>
</div>

## Where to see the numbers

- Per-layer r and c values are in every PDK (Process Design Kit)'s
  parasitic tables; for SKY130 they are public, and OpenROAD's RCX
  (Resistance-Capacitance eXtraction) rules file lists them.
- The IRDS (International Roadmap for Devices and Systems)
  interconnect chapters chart resistivity and delay trends across
  generations.
""",
    },
    # -------------------------------------------------- lithography
    {
        "slug": "lithography-limit",
        "level": "foundational",
        "name": "Lithography: the Resolution Limit and Multi-Patterning",
        "family": "litho",
        "year": "",
        "who": "the industry; ASML (Advanced Semiconductor Materials Lithography)",
        "chips": [("diff-easy", "why pitches are what they are")],
        "summary": (
            "One exposure prints features no finer than a limit set by "
            "wavelength and optics. Immersion 193 nm reached that limit "
            "around 80 nm pitch; everything finer needed multiple "
            "patterning until EUV (Extreme Ultraviolet) arrived, and the "
            "router inherits the constraints of whichever is used."
        ),
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "refs": [
            ("Multiple patterning (Wikipedia)",
             "https://en.wikipedia.org/wiki/Multiple_patterning"),
            ("Extreme ultraviolet lithography (Wikipedia)",
             "https://en.wikipedia.org/wiki/Extreme_ultraviolet_lithography"),
        ],
        "body": """
## The idea

Every layer's pattern is projected from a mask onto photoresist on
the wafer. Optics limit how fine a pitch one exposure can resolve:

<div class="eq">minimum half-pitch = k1 × λ / NA</div>
<ul class="eq-legend">
<li><code>λ</code> the light's wavelength: 193 nm for the deep-ultraviolet scanners that carried the industry from 90 nm to 7 nm, 13.5 nm for EUV (Extreme Ultraviolet)</li>
<li><code>NA</code> numerical aperture of the projection lens; immersion (water between lens and wafer) raised it to about 1.35 at 193 nm</li>
<li><code>k1</code> a process factor with a physical floor of 0.25 for a single exposure; resolution enhancement (phase-shift masks, optical proximity correction, off-axis illumination) pushes k1 toward that floor</li>
</ul>

At 193 nm immersion the floor gives a minimum pitch near 76 to 80 nm.
The 20 nm generation needed finer metal than that, so the industry
turned to *multiple patterning*: splitting one layer across two or
more exposures (LELE (Litho-Etch-Litho-Etch)) or defining the pitch
with self-aligned spacers (SADP (Self-Aligned Double Patterning)).
Each carries a design constraint, coloring for the former, a fixed
line grid for the latter, that the router must model; the routing
section's multi-patterning page works through both.

<div class="walk-fig" data-walk="litho-limit"></div>

## EUV (Extreme Ultraviolet)

EUV (Extreme Ultraviolet) lithography at 13.5 nm resolves in one
exposure what needed three or four 193 nm exposures. It entered high
volume at the 7/5 nm generations (2019 onward) and removed
multi-patterning from many critical layers, simplifying the rules the
router sees. It brings its own limits: photon shot noise (stochastic
defects) at low dose, mask defects, throughput, and cost per layer,
so foundries still reserve it for the layers that need it and keep
193 nm for the rest. High-NA (numerical aperture 0.55) EUV (Extreme Ultraviolet) tools,
arriving in the mid-2020s, extend single-exposure resolution once
more.

## What the physical-design engineer inherits

- Which layers are multi-patterned decides whether the router
  faces coloring constraints or a fixed line grid on those layers.
- Rule complexity follows the patterning: forbidden pitches,
  restricted jogs, and cut-mask spacing rules trace directly to how the
  layer is printed.
- OPC (Optical Proximity Correction) happens after tape-out, when
  the mask shop distorts the drawn shapes so the printed ones match;
  the design sees it only as the DFM (Design For Manufacturability)
  rules and recommended patterns that keep OPC (Optical Proximity Correction) solvable.

## Pros, cons, and the trade-off

<div class="pros-cons">
<div class="pc-card pc-pros">
<h3>Strengths</h3>
<ul>
<li><strong>Multi-patterning</strong> extended 193 nm optics through four generations no one expected them to reach.</li>
<li><strong>EUV (Extreme Ultraviolet)</strong> restored single exposure on critical layers and simplified their design rules.</li>
</ul>
</div>
<div class="pc-card pc-cons">
<h3>Weaknesses</h3>
<ul>
<li><strong>Multi-patterning</strong> multiplies mask cost, process steps, and overlay error, and pushes constraints into design.</li>
<li><strong>EUV (Extreme Ultraviolet)</strong> tools cost hundreds of millions each, and stochastic defects set a dose-versus-throughput trade every layer negotiates.</li>
</ul>
</div>
</div>

<div class="tradeoff-box">
<h3>The trade-off</h3>
<p>Resolution has been bought twice: first with design constraints (multi-patterning), then with capital (EUV (Extreme Ultraviolet)). Either way the router pays in rules, and knowing how a layer is printed is knowing why its rules look the way they do.</p>
</div>

## Where it stands today

- 193 nm immersion prints the majority of layers at every node;
  EUV (Extreme Ultraviolet) prints the critical layers at 7 nm and
  below at the leading foundries.
- Multi-patterning persists on layers where EUV (Extreme Ultraviolet)
  is not used, and returns even for EUV (Extreme Ultraviolet) at the finest pitches of the
  newest nodes.
- Open PDKs (Process Design Kits) are single-patterned; the ASAP7
  (Arizona State University 7 nm predictive PDK (Process Design Kit)) kit models EUV (Extreme Ultraviolet)
  (Extreme Ultraviolet) single exposure on its critical layers by
  design.
""",
    },
    {
        "slug": "dfm-rules",
        "level": "research",
        "name": "Design for Manufacturability",
        "family": "litho",
        "year": "2000s onward",
        "who": "foundries; DFM (Design For Manufacturability) tool vendors",
        "chips": [("diff-easy", "beyond pass/fail rules")],
        "summary": (
            "Rules that trade yield rather than legality: recommended "
            "spacings, redundant vias, metal fill, and lithography "
            "hotspot avoidance. Passing DRC (Design Rule Check) makes a "
            "layout manufacturable; DFM makes it manufacturable often."
        ),
        "extra_scripts": [],
        "refs": [
            ("Design for manufacturability (Wikipedia)",
             "https://en.wikipedia.org/wiki/Design_for_manufacturability#Design_for_IC_manufacturing"),
        ],
        "body": """
## The idea

DRC (Design Rule Check) rules are pass or fail: a shape either
manufactures or it does not. DFM (Design For Manufacturability)
rules describe the region between "will manufacture" and "will
manufacture with high yield". They are recommended, scored, or
enforced only where the design can afford them:

Yield is the probability that no defect on the die is fatal, taken
over every defect mechanism: particle-induced shorts and opens, via
failures, lithographic hotspots (shapes that print marginally), and
CMP (Chemical-Mechanical Polishing) non-uniformity. DFM (Design For
Manufacturability) raises the odds for each mechanism by adding
margin above the minimum rule wherever the layout has room: wider
spacing, wider wires, doubled vias, uniform density.

## The main DFM (Design For Manufacturability) practices

**Redundant vias.** A single via is a single point of failure; where
space allows, the router places two cuts in parallel so one void does
not open the net. Post-route via doubling is standard.

**Wire spreading and widening.** After routing, non-critical wires
are pushed apart and widened wherever the neighbourhood is empty,
lowering short and open probability at no cost in area.

**Metal fill and density.** Floating dummy shapes bring every layer's
density into the CMP (Chemical-Mechanical Polishing) window; the
filler must keep spacing from signal wires and is included in
parasitic extraction.

**Lithography hotspot avoidance.** Some rule-legal patterns print
marginally after OPC (Optical Proximity Correction); pattern
libraries and lithography simulation flag them, and the router avoids
or repairs them.

**Recommended rules.** Larger-than-minimum spacings and enclosures
tabulated by the foundry, applied opportunistically.

## Pros, cons, and the trade-off

<div class="pros-cons">
<div class="pc-card pc-pros">
<h3>Strengths</h3>
<ul>
<li><strong>Yield</strong>: measurable improvement per practice, at little cost where the design has slack.</li>
<li><strong>Reliability</strong>: redundant vias and wider wires also lengthen electromigration life.</li>
<li><strong>Automatable</strong>: via doubling, spreading, and fill are post-route passes needing no design change.</li>
</ul>
</div>
<div class="pc-card pc-cons">
<h3>Weaknesses</h3>
<ul>
<li><strong>Costs where the design is tight</strong>: in congested regions there is no room for margin, and the yield exposure concentrates there.</li>
<li><strong>Timing side effects</strong>: fill and doubled vias add capacitance; spreading changes coupling; the timing must be re-checked.</li>
<li><strong>Foundry-specific</strong>: what helps yield depends on the process, so DFM (Design For Manufacturability) decks are among the most proprietary parts of a kit.</li>
</ul>
</div>
</div>

<div class="tradeoff-box">
<h3>The trade-off</h3>
<p>DFM (Design For Manufacturability) converts unused layout slack into yield. It is free where the design is loose and impossible where it is tight, which is exactly where defects matter most, so it is a statistical improvement layered on a deterministic rule set rather than a replacement for it.</p>
</div>

## Where it appears in the flow

- <strong>Open source</strong>: OpenROAD's flow runs metal fill after
  routing and supports via doubling in the detailed router; the SKY130
  PDK (Process Design Kit) publishes its density rules and fill
  requirements.
- <strong>Commercial</strong>: exposed as tool options. Sign-off DFM (Design For
  Manufacturability) checks and post-route DFM (Design For Manufacturability) optimization are
  standard flow steps; the scoring decks are foundry-proprietary.
""",
    },
    # ------------------------------------------------------ signoff
    {
        "slug": "pvt-corners",
        "level": "foundational",
        "name": "PVT (Process, Voltage, Temperature) Corners and Multi-Corner Sign-Off",
        "family": "signoff",
        "year": "",
        "who": "every sign-off flow",
        "chips": [("diff-easy", "the chip must work everywhere")],
        "summary": (
            "Transistors vary with manufacturing, supply voltage, and "
            "temperature. Sign-off proves timing at the extreme "
            "combinations, the corners, and modern flows check dozens of "
            "them, each with its own Liberty tables and parasitics."
        ),
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "refs": [
            ("Process corners (Wikipedia)",
             "https://en.wikipedia.org/wiki/Process_corners"),
        ],
        "body": """
## The idea

No chip is built at nominal conditions. Manufacturing shifts every
transistor's speed within a distribution, the supply sags and spikes,
and the die runs anywhere from cold start to full load. Sign-off does
not analyze the distribution; it analyzes its bounding box, the
corners:

A corner is one combination of three settings, and sign-off means
timing is clean at every required combination:

- Process: the transistor speed bin: SS (Slow n-type, Slow p-type),
  TT (Typical, Typical), FF (Fast, Fast), and the skewed SF and FS
  combinations; each has its own Liberty tables.
- Voltage: nominal supply plus and minus its tolerance, and any
  low-power operating modes.
- Temperature: the specified range, typically minus 40 to 125 °C
  for industrial and automotive parts; at advanced nodes delay can
  worsen at low temperature (temperature inversion), so both ends must
  be checked.

<div class="walk-fig" data-walk="pvt-corners"></div>

Setup (maximum delay) is traditionally worst at slow-process, low-
voltage, high-temperature; hold (minimum delay) at fast-process,
high-voltage, low-temperature. Wire parasitics have their own corners
(thin or thick metal, high or low dielectric), and every RC (Resistance-Capacitance)
(Resistance-Capacitance) corner multiplies the count. Modern sign-off
runs tens of corners, and multi-mode analysis (functional, test, low
power) multiplies again.

## How the flow handles it

**Step 1 (define).** The design specification fixes the voltage and
temperature ranges and which process bins must yield.

**Step 2 (characterize).** The library ships one Liberty file per
process-voltage-temperature point; missing points are interpolated or
derated.

**Step 3 (analyze).** STA (Static Timing Analysis) runs at every
corner (multi-corner, multi-mode); the worst setup and worst hold
across corners are the sign-off numbers.

**Step 4 (close).** Optimization must fix a violation at one corner
without opening one at another; hold fixes at the fast corner (added
delay) and setup fixes at the slow corner (removed delay) pull in
opposite directions.

## Pros, cons, and the trade-off

<div class="pros-cons">
<div class="pc-card pc-pros">
<h3>Strengths</h3>
<ul>
<li><strong>Guarantee</strong>: a chip clean at the corners works throughout the box, without statistical modeling.</li>
<li><strong>Tool simplicity</strong>: each corner is an ordinary STA (Static Timing Analysis) run.</li>
</ul>
</div>
<div class="pc-card pc-cons">
<h3>Weaknesses</h3>
<ul>
<li><strong>Pessimism</strong>: real chips rarely sit at a corner; designing for the box leaves performance on the table.</li>
<li><strong>Corner explosion</strong>: dozens of corners times modes means long sign-off runs and large characterization cost.</li>
<li><strong>Corners do not cover everything</strong>: within-die variation is handled separately (see the on-chip variation page).</li>
</ul>
</div>
</div>

<div class="tradeoff-box">
<h3>The trade-off</h3>
<p>Corner-based sign-off buys certainty with pessimism: bounding the distribution is simple and safe, and it wastes the margin between the corner and the typical chip. Every advanced-node flow spends effort clawing that margin back without giving up the guarantee.</p>
</div>

## Where to see it

- <strong>Open source</strong>: SKY130 ships Liberty files at several
  corners (for example tt_025C_1v80, ss_100C_1v60, ff_n40C_1v95); the
  OpenROAD flow's platform configuration selects which are used for
  setup and hold.
- <strong>Commercial</strong>: multi-corner multi-mode analysis is a
  standard sign-off feature; large designs check tens of scenarios.
""",
    },
    {
        "slug": "on-chip-variation",
        "level": "research",
        "name": "On-Chip Variation and Derating",
        "family": "signoff",
        "year": "2000s onward",
        "who": "sign-off methodology; tool vendors",
        "chips": [("diff-hard", "variation inside one die")],
        "summary": (
            "Corners bound die-to-die variation, but two paths on the "
            "same die also differ. OCV (On-Chip Variation) derates "
            "launch and capture paths in opposite directions; AOCV and "
            "POCV refine the pessimism by depth and by statistics."
        ),
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "refs": [
            ("Statistical static timing analysis (Wikipedia)",
             "https://en.wikipedia.org/wiki/Statistical_static_timing_analysis"),
        ],
        "body": """
## The idea

A corner assumes every transistor on the die is at the same point of
the distribution. They are not: random dopant fluctuation, line-edge
roughness, and local layout effects make neighbouring devices differ.
The danger is a timing check whose two sides see different variation:
if the launching clock path is slow and the capturing clock path is
fast, a hold check that passed at the corner can fail on silicon. OCV (On-Chip Variation)
(On-Chip Variation) guards against it by derating the two sides in
opposite directions:

<div class="eq">setup check: launch path × (1 + d), capture path × (1 − d) ; hold check: launch × (1 − d), capture × (1 + d)</div>
<ul class="eq-legend">
<li><code>d</code> the derate, a percentage from the foundry (a few to about ten percent per stage); early stages are sped up and late stages slowed down for setup, and the reverse for hold</li>
<li><code>launch path</code> the clock path to the launching flop plus the data path</li>
<li><code>capture path</code> the clock path to the capturing flop</li>
</ul>

<div class="walk-fig" data-walk="ocv-derate"></div>

Flat OCV (On-Chip Variation) is pessimistic: it derates every stage
by the full amount, but variation partially averages out over a long
path. Two refinements return that pessimism:

- AOCV (Advanced On-Chip Variation) makes the derate a table of
  path depth (more stages, smaller derate) and physical distance
  (farther apart, larger derate).
- POCV (Parametric On-Chip Variation) or SOCV (Statistical
  On-Chip Variation) gives each cell a delay sigma from the library
  and propagates variance along the path (root-sum-square), so the
  path's spread grows with the square root of depth, as it does
  physically. This is the practical form of statistical timing
  analysis that survived.

CPPR (Common Path Pessimism Removal) handles the other artefact:
the part of the clock path shared by launch and capture cannot vary
in opposite directions, so its derating is removed.

## Pros, cons, and the trade-off

<div class="pros-cons">
<div class="pc-card pc-pros">
<h3>Strengths</h3>
<ul>
<li><strong>Catches real failures</strong>: within-die mismatch on short paths is a genuine hold-failure mechanism.</li>
<li><strong>Refinable</strong>: AOCV (Advanced On-Chip Variation) and POCV (Parametric On-Chip Variation) recover much of flat OCV (On-Chip Variation)'s pessimism without losing safety.</li>
</ul>
</div>
<div class="pc-card pc-cons">
<h3>Weaknesses</h3>
<ul>
<li><strong>Flat OCV (On-Chip Variation) is crude</strong>: uniform derates over-margin long paths and drive unnecessary fixes.</li>
<li><strong>Library dependence</strong>: POCV (Parametric On-Chip Variation) needs per-cell sigma characterization the library must ship.</li>
<li><strong>Complexity</strong>: derate tables, CPPR (Common Path Pessimism Removal), and multi-corner interaction make sign-off setups intricate and error-prone.</li>
</ul>
</div>
</div>

<div class="tradeoff-box">
<h3>The trade-off</h3>
<p>On-chip variation methodology is a ladder of pessimism reduction: flat derates are safe and wasteful, statistical propagation is tighter and more demanding. Each rung buys margin back at the cost of characterization and setup complexity, and advanced nodes climb it because the margin is worth more than the effort.</p>
</div>

## Where to see it

- <strong>Open source</strong>: OpenSTA (the timing engine inside
  OpenROAD) supports timing derates and CPPR (Common Path Pessimism
  Removal); its statistical modes are limited compared with commercial
  tools.
- <strong>Commercial</strong>: exposed as tool options. AOCV (Advanced On-Chip
  Variation) and POCV (Parametric On-Chip Variation) are standard
  sign-off options, and foundries supply the derate tables and sigma
  libraries per node.
""",
    },
    {
        "slug": "em-ir-reliability",
        "level": "research",
        "name": "Electromigration and IR (Current Times Resistance) Drop",
        "family": "signoff",
        "year": "",
        "who": "every sign-off flow",
        "chips": [("diff-easy", "the wires have to survive")],
        "summary": (
            "Two failure modes of the power and signal wires: "
            "electromigration, where current slowly moves metal atoms "
            "until a wire opens or shorts, and IR drop, where resistance "
            "in the supply network lowers the voltage cells actually see. "
            "Both are checked at sign-off and both shape the power grid."
        ),
        "extra_scripts": ["/static/explore/walkthrough.js"],
        "refs": [
            ("Electromigration (Wikipedia)",
             "https://en.wikipedia.org/wiki/Electromigration"),
            ("IR drop analysis in OpenROAD (psm)",
             "https://openroad.readthedocs.io/en/latest/main/src/psm/README.html"),
        ],
        "body": """
## The idea

**Electromigration** is momentum transfer from electrons to metal
atoms: at high current density, atoms drift downstream, forming
voids (opens) upstream and hillocks (shorts) downstream over months
or years. The lifetime model is Black's equation:

<div class="eq">MTTF (Mean Time To Failure) = A × J^(−n) × exp(Ea / (k × T))</div>
<ul class="eq-legend">
<li><code>MTTF</code> mean time to failure of the wire segment</li>
<li><code>J</code> current density (current per cross-section); the dominant design lever, and the reason every layer has a maximum current per width in the PDK (Process Design Kit)</li>
<li><code>n</code> an exponent near 2 for copper; halving current density roughly quadruples life</li>
<li><code>Ea, T</code> activation energy and absolute temperature; hotter wires fail sooner, so limits are specified at the operating temperature</li>
</ul>

**IR (current times resistance) drop** is Ohm's law in the power grid: current drawn by cells
flows through the resistance of the supply wires, and the voltage at a
cell is the pad voltage minus that drop. Cells at lower voltage are
slower, and if the drop is large enough, timing sign-off at the
nominal corner is invalid:

<div class="eq">V(cell) = V(pad) − sum over the supply path of I × R</div>
<ul class="eq-legend">
<li><code>I</code> current through each grid segment: the sum of the demand of everything downstream; static (average) for the DC (Direct Current) check, switching peaks for the dynamic check</li>
<li><code>R</code> the segment's resistance, from the metal stack: thick top layers are cheap, thin lower layers expensive, and vias between them count</li>
</ul>

<div class="walk-fig" data-walk="ir-drop"></div>

## How the flow addresses both

**Step 1 (grid design).** Floorplanning builds the power grid: rings
and stripes on thick upper metal, denser rails on lower layers, via
stacks between. Wider and denser buys lower drop and higher current
capacity, at the cost of routing tracks.

**Step 2 (analyze).** After placement (estimated switching) and after
routing (extracted resistances), a power-integrity tool solves the
grid for static and dynamic IR (current times resistance) drop and
checks each segment's current density against the electromigration
limits.

**Step 3 (repair).** Widen or add stripes, add vias, spread
high-current cells, or add decoupling capacitance for dynamic drop;
for signal electromigration, widen the wire or lower the driver's
current.

**Step 4 (sign off).** Drop within the budget assumed by the timing
corners; every segment under its electromigration limit at the
target lifetime and temperature.

## Pros, cons, and the trade-off

<div class="pros-cons">
<div class="pc-card pc-pros">
<h3>Strengths of the methodology</h3>
<ul>
<li><strong>Well modeled</strong>: both effects reduce to resistances and currents the flow already extracts.</li>
<li><strong>Grid design is a lever</strong>: over-designing the grid buys margin directly.</li>
</ul>
</div>
<div class="pc-card pc-cons">
<h3>Weaknesses</h3>
<ul>
<li><strong>Grid area versus routing</strong>: every stripe is tracks the router loses; dense grids fight congestion.</li>
<li><strong>Dynamic drop depends on activity</strong>: the worst switching pattern is hard to know, so vectorless analysis is pessimistic and vector-based analysis is only as good as its vectors.</li>
<li><strong>Advanced-node margins shrink</strong>: lower supply voltage makes the same drop a larger fraction, and thinner wires carry less current.</li>
</ul>
</div>
</div>

<div class="tradeoff-box">
<h3>The trade-off</h3>
<p>The power grid is metal spent on nothing but delivering voltage, and every track it takes is one the signals cannot use. Electromigration and IR (current times resistance) drop analysis decide how much of that tax is enough, and at low supply voltages the answer keeps rising.</p>
</div>

## Where to see it

- <strong>Open source</strong>: OpenROAD's [power-integrity module](https://openroad.readthedocs.io/en/latest/main/src/psm/README.html) computes static IR (current times resistance)
  drop on the built grid; the flow reports the worst drop per supply
  net.
- <strong>The process</strong>: current-density limits per layer and
  via are part of every PDK (Process Design Kit)'s reliability rules.
- <strong>Commercial</strong>: exposed as tool options. Static and dynamic IR (current times resistance)
  drop and electromigration sign-off are standard tools in every
  tape-out flow.
""",
    },
    # --------------------------------------------------------- open
    {
        "slug": "open-pdks",
        "level": "foundational",
        "name": "Open PDKs (Process Design Kits): SKY130, GF180, IHP SG13G2",
        "family": "open",
        "year": "2020 onward",
        "who": "SkyWater and Google; GlobalFoundries; IHP",
        "chips": [("diff-easy", "the kits anyone can download")],
        "summary": (
            "Manufacturable process kits published under open licenses, "
            "with real fabrication available through shuttle programs. "
            "SKY130 is the process this platform's graded problems run "
            "on."
        ),
        "extra_scripts": [],
        "refs": [
            ("SkyWater SKY130 PDK", "https://github.com/google/skywater-pdk"),
            ("GlobalFoundries GF180MCU PDK", "https://github.com/google/gf180mcu-pdk"),
            ("IHP SG13G2 open PDK", "https://github.com/IHP-GmbH/IHP-Open-PDK"),
            ("Efabless / chipIgnite shuttles (SKY130, GF180)", "https://efabless.com/"),
        ],
        "body": """
## The idea

Until 2020, every manufacturable PDK (Process Design Kit) was under
NDA (Non-Disclosure Agreement), which meant no open tool could be
tested end to end on a real process and no student could tape out
without a university agreement. Three kits changed that:

- SKY130 (SkyWater, with Google; released 2020): a 130 nm CMOS (Complementary Metal-Oxide-Semiconductor)
  (Complementary Metal-Oxide-Semiconductor) process with 5 metal
  layers plus local interconnect, several standard-cell libraries,
  and public DRC (Design Rule Check) and LVS (Layout Versus Schematic)
  decks. Manufactured through Efabless shuttles. The most used open
  kit and the one the OpenROAD flow targets first.
- GF180MCU (GlobalFoundries, with Google; released 2022): a
  180 nm process aimed at microcontrollers, higher voltage options,
  also on shuttle programs.
- IHP SG13G2 (IHP (Innovations for High Performance
  Microelectronics), Germany; released 2023): a 130 nm SiGe
  (Silicon-Germanium) BiCMOS (Bipolar CMOS (Complementary Metal-Oxide-Semiconductor)) process with high-speed
  bipolar devices, open with active development and multi-project
  wafer runs; notable for its open assembly-level data.

All three publish the full file set described on the PDK (Process
Design Kit) anatomy page, under Apache-2.0 style licenses.

## What they are and are not

They are real, mature, manufacturable processes: chips designed on
them work. They are not advanced nodes: single-patterned, planar
transistors, few metal layers, and rule decks small enough to read.
That is exactly what makes them teachable, and it is why the graded
problems on this platform run on SKY130 with the OpenROAD flow: every
metric a problem grades is produced by real tools on a real kit.

## Pros, cons, and the trade-off

<div class="pros-cons">
<div class="pc-card pc-pros">
<h3>Strengths</h3>
<ul>
<li><strong>Real silicon</strong>: shuttle programs turn a passing layout into a packaged chip.</li>
<li><strong>Complete and inspectable</strong>: every file kind, readable rules, public libraries.</li>
<li><strong>Tool development</strong>: open EDA (Electronic Design Automation) tools can finally be validated end to end.</li>
</ul>
</div>
<div class="pc-card pc-cons">
<h3>Weaknesses</h3>
<ul>
<li><strong>Old nodes</strong>: 130 to 180 nm, so advanced-node effects (multi-patterning, FinFET libraries, deep metal stacks) are absent.</li>
<li><strong>Smaller libraries</strong> and fewer corners than commercial kits.</li>
<li><strong>Kit maturity varies</strong>: documentation gaps and deck bugs are fixed by the community rather than a foundry support desk.</li>
</ul>
</div>
</div>

<div class="tradeoff-box">
<h3>The trade-off</h3>
<p>Open PDKs (Process Design Kits) trade node advancement for openness, and for teaching and tool development that is the right trade: everything on this site that runs a real tool runs it against one of these kits, and everything it grades is therefore real.</p>
</div>

## Where to start

- The [SKY130 documentation](https://skywater-pdk.readthedocs.io/) for the process; the OpenROAD flow's
  sky130hd platform for the flow's view of it.
- [Efabless](https://efabless.com/) for shuttle schedules on SKY130 and GF180MCU.
- The [IHP open PDK (Process Design Kit) repository](https://github.com/IHP-GmbH/IHP-Open-PDK) for SG13G2.
""",
    },
    {
        "slug": "asap7-predictive-pdk",
        "level": "research",
        "name": "ASAP7: the Predictive 7 nm PDK (Process Design Kit)",
        "family": "open",
        "year": "2016",
        "who": "Arizona State University with ARM",
        "chips": [("diff-easy", "advanced-node structure, openly")],
        "summary": (
            "A fictional but realistic 7 nm FinFET process kit for "
            "research and teaching: EUV (Extreme Ultraviolet) single "
            "exposure on critical layers, fin-quantized libraries, a "
            "9-layer stack. Not manufacturable, but the only open place "
            "to see advanced-node structure end to end."
        ),
        "extra_scripts": [],
        "refs": [
            ("ASAP7 PDK (GitHub)", "https://github.com/The-OpenROAD-Project/asap7"),
            ("Clark et al., 'ASAP7: a 7-nm finFET predictive process design kit' (search)",
             "https://scholar.google.com/scholar?q=ASAP7+7nm+finFET+predictive+process+design+kit+Clark"),
        ],
        "body": """
## The idea

Advanced-node PDKs (Process Design Kits) are secret, so research and
teaching on advanced-node physical design had no realistic target.
ASAP7 (Arizona State University 7 nm predictive PDK (Process Design Kit)), released in
2016 by Arizona State University with ARM, is a *predictive* kit: a
process that does not exist at any foundry, designed to have the
structure and rules of a plausible 7 nm FinFET node.

- Devices: FinFET, with drive strength in fin counts; the
  standard-cell libraries come in fin-count variants and threshold
  flavours, exactly the quantized structure of real FinFET libraries.
- Lithography assumptions: EUV (Extreme Ultraviolet) single
  exposure on the critical lower layers, so its rules avoid LELE (Litho-Etch-Litho-Etch)
  (Litho-Etch-Litho-Etch) coloring; a 7.5-track cell height.
- Metal stack: 9 metal layers with realistic pitches, thin lower
  layers and thick upper ones.
- Complete kit: LEF (Library Exchange Format), Liberty at several
  corners, DRC (Design Rule Check) and LVS (Layout Versus Schematic)
  decks for open tools, SPICE (Simulation Program with Integrated
  Circuit Emphasis) models, and parasitic tables.

It is the platform on which the fin-quantized library structure, the
sub-10-track cell, the deep stack, and advanced-node routing behaviour
(pin access above all) can be studied with open tools.

## What it is not

Not manufacturable: no fab implements it, so no chip results. Its
rules are simplified relative to any real 7 nm kit, and its models are
predictive rather than measured. Results on ASAP7 (Arizona State
University 7 nm predictive PDK (Process Design Kit)) show trends and structure, not
absolute numbers a foundry would sign.

## Pros, cons, and the trade-off

<div class="pros-cons">
<div class="pc-card pc-pros">
<h3>Strengths</h3>
<ul>
<li><strong>Only open advanced-node structure</strong>: FinFET libraries, deep stack, fine pitches, all inspectable.</li>
<li><strong>Complete enough for the full flow</strong>: OpenROAD runs RTL (Register Transfer Level) to GDSII (Graphic Design System II) on it.</li>
<li><strong>Common research baseline</strong>: widely used in publications, so results are comparable.</li>
</ul>
</div>
<div class="pc-card pc-cons">
<h3>Weaknesses</h3>
<ul>
<li><strong>Not real</strong>: no silicon, and rule simplifications mean real-kit surprises are absent.</li>
<li><strong>Aging assumptions</strong>: a 2016 view of 7 nm; real nodes moved on.</li>
<li><strong>Library gaps</strong>: fewer cells and corners than production kits, and known DRC (Design Rule Check) deck limitations.</li>
</ul>
</div>
</div>

<div class="tradeoff-box">
<h3>The trade-off</h3>
<p>ASAP7 (Arizona State University 7 nm predictive PDK (Process Design Kit)) trades reality for access: it is the only way to see advanced-node physical design in the open, and everything learned on it must be read as structure and trend rather than as sign-off truth.</p>
</div>

## Where to start

- The [ASAP7 repository](https://github.com/The-OpenROAD-Project/asap7) and OpenROAD's asap7 platform, which
  runs the full flow on the kit's libraries.
- The original paper describes the assumptions behind every rule and
  is the right companion for reading the deck.
""",
    },
]
