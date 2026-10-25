# Layout and parasitic formats deck: scope

The files a design travels in, and a physical designer reads all of them: LEF
(Library Exchange Format), DEF (Design Exchange Format), SPEF (Standard
Parasitic Exchange Format), SDF (Standard Delay Format), GDSII (Graphic Design
System II), and the netlists.

53 cards in 8 sections.

Grounding: the LEF (Library Exchange Format) cards quote the Nangate45
technology and macro files shipped with OpenROAD-flow-scripts. The DEF (Design
Exchange Format), SPEF (Standard Parasitic Exchange Format), and SDF (Standard
Delay Format) cards quote a real gcd run on Nangate45 in the `openroad/orfs`
image (OpenROAD 26Q3): its `6_final.def`, `6_final.spef`, and an SDF (Standard
Delay Format) file written by OpenSTA from the routed design. The GDSII
(Graphic Design System II) and netlist cards describe the formats as the open
tools write them.

## Sections

1. **LEF (Library Exchange Format) technology** (9): layers and their rules,
   electrical properties, spacing tables, the site, database units against the
   manufacturing grid, the bus and hierarchy characters, non-routing layers,
   fixed vias against generate rules, and the resistance of a cut.
2. **LEF (Library Exchange Format) macros** (8): class, size in sites and rows,
   symmetry and the layout cell an abstract stands for, pins and ports,
   obstructions, antenna areas, and supply rails that connect by abutment.
3. **DEF (Design Exchange Format)** (10): database units, die area and rows,
   components with their placement status, source and orientation, routing
   tracks, non-default rules, nets and the geometry of a route, special nets,
   and pins.
4. **SPEF (Standard Parasitic Exchange Format)** (6): the per-net structure,
   the name map, units, grounded against coupling capacitance, and the net read
   as a resistor network.
5. **SDF (Standard Delay Format)** (6): cell delays, timing checks,
   interconnect delays, conditional arcs, the header that fixes the corner, and
   how a value triplet is written.
6. **GDSII (Graphic Design System II) and mask data** (5): the hierarchy of
   structures and elements, layer and datatype numbers and the map that
   produces them, the abstract against the full layout, OASIS (Open Artwork
   System Interchange Standard), and comparing two layouts shape by shape.
7. **Netlists** (3): a gate-level Verilog netlist, escaped identifiers, and the
   transistor-level netlist that layout versus schematic compares against.
8. **How they fit together** (6): which file answers which question, LEF
   (Library Exchange Format) against DEF (Design Exchange Format), SPEF
   (Standard Parasitic Exchange Format) against SDF (Standard Delay Format),
   the database against portable files, the netlist against the layout file,
   and the four views a finished block hands up.

## Out of scope

Writing parsers, the formats' full grammars, and the binary encoding of GDSII
(Graphic Design System II) records.
