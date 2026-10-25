# Build the OpenROAD deck's "Reading real output" cards from the real stage logs
# of an OpenROAD-flow-scripts run (gcd, nangate45, openroad/orfs image). Each
# excerpt is cut verbatim from a log in output/; a gap is shown as "...".
import os
OUT = os.environ.get("OR_LOGS", os.path.join(os.path.dirname(os.path.abspath(__file__)), "output"))

def grab(parts):
    out = []
    for fname, ranges in parts:
        lines = open(os.path.join(OUT, fname)).read().split("\n")
        prev = None
        for a, b in ranges:
            if prev is not None and a > prev + 1:
                out.append("   ...")
            out.extend(lines[a - 1:b])
            prev = b
        out.append("")
    while out and out[-1] == "":
        out.pop()
    return "\n".join(out)

CARDS = [
 dict(id="ord-congestion", parts=[("5_1_grt.log", [(154, 171)])],
  hint="Compare Demand with Resource on each layer, and read the last column.",
  question="What does this global routing report say about congestion?",
  answer="Nothing is congested: every layer is well under its capacity.",
  wrong=["metal2 is congested, since it is more than half used.",
         "The design is 20.63% routed, and the rest has failed.",
         "6258 tracks are needed but only 1291 of them exist."],
  explain="Resource is the tracks available and Demand the tracks the router wants; the last columns count the tiles where demand exceeds capacity, and they are all zero. metal2 and metal3 carry the routing because the upper layers are reserved for the power grid and longer nets.",
  source="grt"),
 dict(id="ord-gpl-overflow", parts=[("3_3_place_gp.log", [(60, 71)])],
  hint="Overflow measures how much density exceeds the target. Watch it, and watch wirelength.",
  question="What is the placer doing over these iterations?",
  answer="Spreading cells apart: overflow is still high and wirelength has grown.",
  wrong=["Shortening wires: wirelength has come down since iteration 0.",
         "Finishing: the numbers have stopped changing, so it has converged.",
         "Routing the congested areas, which is why the penalty keeps rising."],
  explain="Overflow is the density excess over the target; placement ends when it reaches the target, not when wirelength stops moving. Wirelength rose from 1457 to about 1810 because the cells started piled together and are being pushed apart. The penalty grows each iteration to force that spreading.",
  source="gpl"),
 dict(id="ord-drt-iterations", parts=[("5_2_route.log", [(348, 354)])],
  hint="Each line is one pass over the design. Read the last two.",
  question="What happened in the router's last iterations?",
  answer="The last pass cleared the nine violations that remained before it.",
  wrong=["Nine violations are left in the finished routing.",
         "The router stopped at 100% complete without checking rules.",
         "Nine nets out of a hundred could not be routed at all."],
  explain="Detailed routing repeats over the design, ripping up and rerouting what violates the rules. A run is only finished when the violation count reaches zero, which is what the last line confirms.",
  source="drt"),
 dict(id="ord-drt-layers", parts=[("5_2_route.log", [(386, 396)])],
  hint="One layer has no wire at all. Ask what else that layer is needed for.",
  question="Why is the wire length on metal1 zero?",
  answer="Routing was restricted to metal2 and above, leaving metal1 alone.",
  wrong=["This technology has no routing tracks defined on metal1.",
         "The router failed on metal1 and moved the wires up a layer.",
         "metal1 wiring is counted under vias rather than wire length."],
  explain="The platform sets the routing layers, and metal1 is left out because the standard cells' own pins and power rails already occupy it. The wire length concentrates on metal2 and metal3, the lowest layers the router may use.",
  source="drt"),
 dict(id="ord-antenna",
  parts=[("5_2_route.log", [(420, 424)])],
  hint="Three different messages here: read the warning together with the counts.",
  question="What do these lines say together?",
  answer="No antenna violations were found, and no diode cell exists to fix any.",
  wrong=["Violations were found and then fixed by inserting diode cells.",
         "The check could not run, because no diode cell was available.",
         "The first check found violations and the second one found none."],
  explain="The warning says the library has no cell of the antenna-diode class, so repair would have nothing to insert. Here it does not matter: the checks report zero net and zero pin violations. The check runs twice because the flow checks before and after attempting repair.",
  source="ant"),
 dict(id="ord-tapcell", parts=[("2_3_floorplan_tapcell.log", [(10, 12)])],
  hint="Compare the tap spacing the flow asked for with the size of this core.",
  question="The flow ran tapcell with -distance 120 on a core of 1162 square microns. Why no tap cells?",
  answer="The core is far smaller than 120 microns across, so no tap fits the spacing.",
  wrong=["The library has no well-tap cell, so only endcaps could be placed.",
         "Tap cells are only inserted around macros, and this design has none.",
         "The endcap cells already contain the well taps that the rows need."],
  explain="A core of 1162 square microns is about 34 microns square, and taps are placed on a checkerboard every 120 microns, so none land inside. The 48 endcaps are a separate insertion that terminates the rows. On a larger die the same command would insert many taps.",
  source="tap"),
 dict(id="ord-area-growth",
  parts=[("2_3_floorplan_tapcell.log", [(12, 12)]), ("5_2_route.log", [(425, 425)])],
  hint="The first line is after tap insertion, the second after routing. Ask what ran in between.",
  question="Why did the design area grow between these two stages?",
  answer="Cells were added in between: buffers, resized gates, a clock tree.",
  wrong=["Routing added wires, and wire area counts towards the design area.",
         "Filler cells were inserted, which count towards the design area.",
         "The core area shrank, so the same cells now use a larger share."],
  explain="Design area counts the instances, not the wires, and the stages in between all add or enlarge cells. Between the two lines came placement, repair, clock tree synthesis, and timing repair, all of which add or enlarge cells. Fillers are added after routing, later than the second line.",
  source="rsz"),
 dict(id="ord-cts-tree", parts=[("4_1_cts.log", [(16, 18), (21, 22), (30, 41)])],
  hint="Read the levels: each one splits the sinks and says which way it cuts.",
  question="What did clock tree synthesis build here?",
  answer="One H-tree over 35 sinks, split twice, from a single buffer type.",
  wrong=["One tree per sink, 35 in all, each with its own buffer.",
         "A clock mesh covering 35 sinks, stopping at 15 buffers.",
         "Two clock trees, one per level, sharing the same 35 sinks."],
  explain="An H-tree splits the sink region in half at each level, alternating vertical and horizontal, so the path to every leaf is about the same length. Here two levels take 35 sinks down to sub-regions small enough for the stopping rule, which allows at most 15 sinks.",
  source="cts"),
]

def yaml_str(s):
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'
out = ["", "  # ---------------------------------------------------------------- Reading real output", ""]
for c in CARDS:
    ex = grab(c["parts"])
    out.append(f"  - id: {c['id']}")
    out.append("    section: reading")
    out.append(f"    question: {yaml_str(c['question'])}")
    out.append("    excerpt: |2-")
    out += ["      " + l if l else "" for l in ex.split("\n")]
    out.append(f"    hint: {yaml_str(c['hint'])}")
    out.append(f"    answer: {yaml_str(c['answer'])}")
    out.append("    wrong:")
    out += [f"      - {yaml_str(w)}" for w in c["wrong"]]
    out.append(f"    explain: {yaml_str(c['explain'])}")
    out.append(f"    source: {c['source']}")
    out.append("")
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "reading_cards.yaml"), "w").write("\n".join(out))
print(len(CARDS), "cards")
