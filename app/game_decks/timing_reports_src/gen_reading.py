# Build the "Reading a report" cards from real OpenSTA output, verbatim.
# Each excerpt is a list of (file, [(first_line, last_line), ...]); line numbers
# are 1-based and inclusive. A gap between ranges is shown as a "..." line.
import os
OUT = os.environ.get("STA_OUT", os.path.join(os.path.dirname(os.path.abspath(__file__)), "output"))
def grab(parts):
    out = []
    for fname, ranges in parts:
        lines = open(os.path.join(OUT, fname + ".txt")).read().split("\n")
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
 dict(id="r-type", hint="Look at the Path Type line, and at which library time the capture side uses.", parts=[("fail_min", [(2, 7), (20, 31)])],
  question="Which kind of check does this path report?",
  answer="A hold check: the path type is min, with a library hold time.",
  wrong=["A setup check: the path ends at the D pin of a flip-flop.",
         "A setup check: the path starts and ends at the same register.",
         "A minimum pulse width check on the register's clock pin."],
  explain="`Path Type: max` is a setup check and `Path Type: min` a hold check. The capture side confirms it: a setup report subtracts `library setup time`, a hold report adds `library hold time`. A path from a register back to itself is common in hold reports.",
  source="report_checks"),
 dict(id="r-slack", hint="The two lines just above the final rule are the two numbers being compared.", parts=[("fail_checks", [(31, 41)])],
  question="How is the slack of -0.06 obtained?",
  answer="The data required time, 0.42, minus the data arrival time, 0.48.",
  wrong=["The data arrival time, 0.48, minus the data required time, 0.42.",
         "The clock period, 0.38, minus the data arrival time, 0.48, plus 0.04.",
         "The data required time, 0.42, minus the setup time, 0.03, minus 0.45."],
  explain="Setup slack is required minus arrival: the data must arrive before the required time, so a later arrival gives a negative slack. For a hold check the order reverses, arrival minus required.",
  source="report_checks"),
 dict(id="r-required", hint="Follow the capture side down: the edge time, then the clock tree, then the library time.", parts=[("fail_checks", [(31, 36)])],
  question="Why is the data required time 0.42 when the clock period is 0.38?",
  answer="The capture clock reaches the register 0.07 late, and setup takes back 0.03.",
  wrong=["The 0.03 setup time is added to the period, and pessimism adds 0.01.",
         "Clock reconvergence pessimism adds 0.04 to the capture edge.",
         "The launch register's clock-to-output delay is added to the period."],
  explain="The capture edge occurs at 0.38 at the clock source, but it arrives at the register's clock pin through the clock tree, 0.07 later, at 0.45. The data must arrive the setup time before that: 0.45 minus 0.03 is 0.42.",
  source="report_checks"),
 dict(id="r-network", hint="Compare the launch side and the capture side line by line.", parts=[("fail_checks", [(11, 14), (31, 34)])],
  question="Both clock edges show a clock network delay of 0.07. What does that mean for this path?",
  answer="The clock reaches both registers equally late, so no skew.",
  wrong=["The path loses 0.14 ns to the clock tree, 0.07 on each side.",
         "The clocks are still ideal, so the tree delay is only an estimate.",
         "The path is launched and captured by two different clocks."],
  explain="The launch side adds 0.07 to the arrival and the capture side adds 0.07 to the required time, so the two cancel. `(propagated)` means the delay was computed through the built clock tree; an estimate would read `(ideal)`.",
  source="report_checks"),
 dict(id="r-stage", hint="The Delay column is per stage, and the Cap and Fanout columns say why a stage is slow.", parts=[("fail_fields", [(9, 29)])],
  question="Which logic gate, after the launching flip-flop, adds the most delay, and why?",
  answer="_854_, the AOI21_X4, at 0.07: it drives a fanout of 16 and 35.73 fF.",
  wrong=["_755_, the NAND2_X4, at 0.03: it drives the most fanout, 14 pins.",
         "place79, the BUF_X1, at 0.03: every buffer adds delay by design.",
         "_897_, the INV_X1, at 0.01: the last gate sets the arrival time."],
  explain="The Delay column shows each stage's contribution, and the Cap and Fanout columns explain it: _854_ drives the largest load in the path, and its output slew of 0.05 is also the slowest, which slows the next stage. Capacitance here is in femtofarads, the unit this library uses.",
  source="report_checks"),
 dict(id="r-hold-unc", hint="Work out what the required time would be without the extra line in the middle.", parts=[("fail_min", [(11, 31)])],
  question="What makes this hold check fail?",
  answer="The 0.15 clock uncertainty pushes the required time past the 0.19 arrival.",
  wrong=["The data path is too slow to reach the register before the clock edge.",
         "The register's hold time is too large for a path this short.",
         "Clock reconvergence pessimism adds 0.15 to the required time."],
  explain="For hold, the data must arrive after the required time. Without uncertainty the required time would be 0.07 and the check would pass; the 0.15 of hold uncertainty moves it to 0.22. A hold violation is fixed by adding delay to the data path, not by speeding it up.",
  source="report_checks"),
 dict(id="r-crpr", hint="CRPR (Clock Reconvergence Pessimism Removal) credits back pessimism on the shared clock path. Ask what would create pessimism in the first place.", parts=[("fail_min", [(20, 26)])],
  question="What does the clock reconvergence pessimism line of 0.00 mean here?",
  answer="There was no early and late difference on the shared clock path to remove.",
  wrong=["Clock reconvergence pessimism removal is turned off for this run.",
         "The two registers share no part of their clock tree at all.",
         "The clock arrives at the register with zero delay from its source."],
  explain="CRPR (Clock Reconvergence Pessimism Removal) credits back the difference between late and early delay on the part of the clock tree that launch and capture share, since one buffer cannot be early and late at once. With no derating or variation in this run, early and late delays are equal and the credit is 0.",
  source="report_checks"),
 dict(id="r-end", hint="Look at the command line at the top: something there limits how many rows appear.", parts=[("fail_end", [(1, 24)])],
  question="What does this report tell you about the number of failing endpoints?",
  answer="At least 6 fail in each group; the list stops at the count asked for.",
  wrong=["Exactly 6 endpoints fail setup in each group, and no others do.",
         "12 endpoints fail hold, the worst of them by 0.06 ns.",
         "Each endpoint listed needs 0.42 ns more time to pass setup."],
  explain="`-group_path_count 6` limits the list to 6 per group, so it cannot show how many fail in total. `report_tns`, or `-slack_max 0` with a large count, answers that.",
  source="report_checks"),
 dict(id="r-wns-tns", hint="One number is the worst single failure and the other is a sum. Divide one by the other.", parts=[("fail_wns", [(1, 2)]), ("fail_tns", [(1, 2)])],
  question="What do these two numbers tell you together?",
  answer="The worst failure is small, but at least 37 endpoints fail.",
  wrong=["One endpoint fails setup by 2.18 ns and the rest by 0.06 ns.",
         "The design fails setup by 2.18 ns on average at each endpoint.",
         "Setup passes everywhere; only the hold checks fail."],
  explain="WNS (Worst Negative Slack) is the deepest failure and TNS (Total Negative Slack) the sum over failing endpoints. No endpoint fails by more than 0.06, so a total of 2.18 needs at least 2.18 / 0.06, about 37, failing endpoints. Both lines say `max`, so these are setup numbers.",
  source="report_tns"),
 dict(id="r-check-setup", hint="These are warnings about missing constraints, not about failing timing.", parts=[("broken_check_setup", [(1, 7), (22, 25)])],
  question="What does this output say must be fixed before the slack can be trusted?",
  answer="An input delay on req_msg[5] and output delays on 18 ports are missing.",
  wrong=["18 output ports fail their setup checks and need faster paths.",
         "18 registers have no clock reaching their clock pins.",
         "The design contains 18 combinational loops that break timing."],
  explain="Ports with no input or output delay are not timed, so their paths never appear in slack reports; a clean `report_wns` can hide them. The 18 unconstrained endpoints are the same 18 output ports.",
  source="check_setup"),
 dict(id="r-check-types", hint="Compare the four slack values with the worst hold and worst setup slack from the path reports.", parts=[("fail_types", [(1, 7)])],
  question="This first table lists each group twice. Which lines are hold and which are setup?",
  answer="The first core_clock and vclk_core_clock lines are hold; the second pair is setup.",
  wrong=["The first core_clock and vclk_core_clock lines are setup; the second pair is hold.",
         "The first pair is rising-edge checks and the second falling-edge checks.",
         "The first pair is the clocks' own paths and the second inter-clock paths."],
  explain="The table has no labels, so compare it with the path reports: -0.04 is the worst hold slack from `report_checks -path_delay min`, and -0.06 is the worst setup slack. Min (hold) is printed first, then max (setup).",
  source="report_check_types"),
 dict(id="r-skew", hint="Skew is a difference. Look at the two latency lines and at what sits between them.", parts=[("clock_skew", [(1, 10)])],
  question="What does this clock skew report show?",
  answer="Both clock pins see the same 0.07 latency, so setup skew is 0.",
  wrong=["Setup skew is 0.14 ns, the sum of source and target latency.",
         "The clock tree is not built yet, so skew is 0 by assumption.",
         "The virtual clock has a skew problem, since no paths were found."],
  explain="Skew is the target latency minus the source latency, adjusted by CRPR (Clock Reconvergence Pessimism Removal). The virtual clock reaches no registers, so it has no register pairs to compare, which is normal.",
  source="report_clock_skew"),
 dict(id="r-min-period", hint="Compare the period reported here with the 0.38 ns the clock was given.", parts=[("fail_min_period", [(1, 3)])],
  question="The clock is defined with a 0.38 ns period. What does this report tell you?",
  answer="Its register paths need 0.44 ns, so 0.38 cannot be met yet.",
  wrong=["The design meets 0.38 ns with 0.06 ns of margin to spare.",
         "The clock's minimum pulse width is 0.44 ns at the registers.",
         "The fmax value of 2267.21 is the frequency in kilohertz."],
  explain="The minimum period comes from the worst same-edge register-to-register paths. fmax is its inverse, in megahertz: 1 / 0.441 ns is about 2267 MHz (megahertz). The virtual clock has no register paths, so it shows 0 and infinity.",
  source="report_clock_min_period"),
 dict(id="r-parasitics", hint="Annotation comes from the parasitics file, so ask what those 22 drivers are missing.", parts=[("parasitic_ann", [(1, 3)])],
  question="What does this output tell you about the parasitics that were read?",
  answer="22 driver nets have no parasitics, so their wires are ignored.",
  wrong=["22 driver cells are missing from the netlist that was read.",
         "22 cells have no timing data in the library that was read.",
         "22 nets have parasitics but were never routed in the layout."],
  explain="These nets got nothing from the SPEF (Standard Parasitic Exchange Format) file. A net without parasitics is timed with pin capacitance only, which is optimistic. `-report_unannotated` lists the nets, so they can be checked before the timing is trusted.",
  source="report_parasitic_annotation"),
 dict(id="r-pin-slack", hint="Each pair is two numbers separated by a colon: min first, then max.", parts=[("slack_pin", [(2, 3)])],
  question="report_slack on the D pin of dpath.a_reg.out[9] prints this. What is the setup slack for rising data on core_clock?",
  answer="0.02: each pair is printed min:max, and max is the setup check.",
  wrong=["0.15: each pair is printed setup:hold, so setup comes first.",
         "0.04: the f value is the setup slack and r the hold slack.",
         "0.26: the largest max value on the pin is the setup slack."],
  explain="`r` and `f` are rising and falling data; each gives min:max slack. Min is the hold check and max the setup check, so rising data has 0.15 of hold slack and 0.02 of setup slack, matching the 0.02 in the path report for this endpoint.",
  source="report_slack"),
]

def yaml_str(s):
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'
out = ["", "  # ---------------------------------------------------------------- Reading a report", ""]
for c in CARDS:
    ex = grab(c["parts"])
    out.append(f"  - id: {c['id']}")
    out.append("    section: reading")
    out.append(f"    question: {yaml_str(c['question'])}")
    out.append("    excerpt: |2-")  # explicit indent: excerpts may start with spaces
    out += ["      " + l if l else "" for l in ex.split("\n")]
    out.append(f"    hint: {yaml_str(c['hint'])}")
    out.append(f"    answer: {yaml_str(c['answer'])}")
    out.append("    wrong:")
    out += [f"      - {yaml_str(w)}" for w in c["wrong"]]
    out.append(f"    explain: {yaml_str(c['explain'])}")
    out.append(f"    source: {c['source']}")
    out.append("")
open(os.path.join(OUT, "reading_cards.yaml"), "w").write("\n".join(out))
print(len(CARDS), "cards")
