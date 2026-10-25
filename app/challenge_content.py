"""Content for the Challenges tab.

A challenge is different from a Problem: a Problem teaches one knob with a
known optimum. This challenge hands you a fixed design and a fixed evaluator and
lets you optimize by ANY open-source means, then ranks the legal entries on a
composite cost. There is no revealed optimum; you see your percentile.

The flow is whatever the entrant wants (open tools only). An entry is a git
repository holding that flow; the official run builds every entry on the reference
machine, and the evaluator re-derives every metric from the layout it built. This module is data only; the runnable harness and the
submission intake are a later build.
"""

CHALLENGES = [
    {
        "slug": "cva6-ppa",
        "title": "Chipbase Competition 01: Systolic Array AI Accelerator",
        "tagline": (
            "Harden Gemmini, an open-source AI "
            "accelerator built around a 16 by 16 systolic array, on ASAP7 "
            "(Arizona State University's 7 nm predictive process) with any open "
            "tools. Partition, place, and route it however you like; entries are scored "
            "on clock speed, area and power."
        ),
        "status": "open",
        "design": {
            "name": "Gemmini, from the University of California, Berkeley",
            "summary": (
                "A systolic-array accelerator: a 16 by 16 grid of "
                "multiply-accumulate processing elements (PEs), fed by a banked "
                "scratchpad of SRAM (Static Random-Access Memory) and draining into a banked accumulator. The "
                "array's wide buses on three of its edges are what make the "
                "floorplan matter."
            ),
        },
        "allowed": [
            "Any open-source tools, stock or patched.",
            "Your own tooling: write custom placers, routers, scripts, or anything else, as long as it is open source and in your repository.",
            "Enter alone or as a team.",
            "Submit again when you improve: your best score counts.",
            "Any partition: harden blocks at any granularity, reuse the reference blocks, or run flat.",
            "Any optimization: floorplan, block shapes, pins, sizing, buffering, clock gating, manual placement.",
        ],
        "notallowed": [
            "Commercial or proprietary tools, libraries, or IP (Intellectual Property).",
            "Changing the design's function or interface (checked by equivalence against the pinned synthesis of the golden RTL).",
            "Changing synthesis in any way: the evaluator re-synthesizes each module with the pinned settings, and your netlist must be equivalent to it. Retiming, scan insertion, and adding, removing, duplicating, or merging registers are therefore out, beyond the occasional load-splitting copy the pinned synthesis itself makes.",
            "Anything fetched from outside: your build must run offline, from your repository and the fixed inputs only.",
        ],
        # constraints split: what entrants set vs what is fixed for everyone
        "constraints_free": [
            "Clock period: a faster clock scores better",
            "Die size, aspect ratio, and utilization",
            "I/O (Input/Output) pin placement",
            "Clock tree targets and useful skew",
            "Cell choices, including the threshold-voltage mix",
            "Power grid design (straps, pitch, layers), as long as it meets the IR drop limit",
            "Any other knob in the flow: tool settings, scripts, effort levels, anything not in the fixed list",
        ],
        "constraints_fixed": [
            "One clock, on the clock port: you choose its period and nothing else about it",
            "Input and output paths: input to register and register to output within 80 percent of your period, input to output within 60 percent",
            "Every path is timed: there are no false or multicycle paths",
            "No clock uncertainty, input drive, or output load: the same ideal conditions for every entry",
            "Operating corners: setup at the slow corner, hold at the fast, power at the typical",
            "Wire resistance and capacitance per layer, pinned for M2 through M9",
            "Switching activity for power: one pinned file for everyone",
            "IR drop limit: 110 mV worst-case static drop",
        ],
        "howitworks": [
            "Clone the harness, start the pinned container, and run `./setup.sh` inside it:",
            "Optional: `./run_baseline.sh` reproduces the reference in 5 to 6 hours, then `./evaluate.sh baseline/` should score 1.000, confirming your machine matches it.",
            "Make the flow your own: edit or replace the reference flow in `flow/`. `run_baseline.sh` runs it, both here and in the official run, where `reproduce/run.sh` copies its result to `/result`. Here are some places to start:",
            "Build and score your flow inside the container:",
            "Once you are ready to submit, push your source, without build outputs, and open an issue on the harness repository with your repository, the commit, and your `eval_work/mine/evaluation.json`.",
        ],
        # linked under step 3: files in the harness repository to build an entry from
        "start_points": [
            {"label": "The reference top level", "kind": "blob", "path": "flow/gemmini/config_tight2.mk",
             "note": "every script and setting the reference uses"},
            {"label": "The reference floorplan", "kind": "blob", "path": "flow/gemmini/macro_place_tight2.tcl",
             "note": "where every block and memory sits"},
            {"label": "The floorplan editor", "kind": "tree", "path": "flow/fpedit",
             "note": "draws floorplans and writes placement scripts"},
            {"label": "The reference as an entry", "kind": "tree", "path": "reproduce",
             "note": "a Dockerfile and run script; point them at your flow"},
            {"label": "The submission spec", "kind": "blob", "path": "submission/README.md",
             "note": "what `run.sh` must write"},
        ],
        # the score weights, shown in the equation, the weights table and the score explorer;
        # keep in step with scoring.yaml (cost: weights a, b, g)
        "weights": {"T": 0.30, "A": 0.50, "P": 0.20},
        "cost_why": (
            "The factors multiply rather than add, so a gain on any axis moves "
            "your score and no single term drowns the others. The weights are "
            "fixed before the competition opens and do not change once entries "
            "arrive: area 0.50, speed 0.30, power 0.20. Area counts most because "
            "the die is almost all blocks and memories, so its size comes down to "
            "how you partition, shape and pack them. Speed is won mostly inside "
            "the blocks. Power moves least: most of it is drawn inside the blocks, "
            "by logic the pinned synthesis fixes."
        ),
        "evaluator": (
            "The evaluator is what scores you. It is fixed, it uses the tools pinned "
            "in versions.lock, and it computes every number from your layouts "
            "itself; anything your own flow reports is ignored. It runs the same "
            "way on your machine (./evaluate.sh baseline/) and in the official "
            "run, and in a fresh clone of the harness it reproduces the reference "
            "numbers exactly. Steps marked GATE decide pass or fail: miss any "
            "gate and the entry is not ranked. The other steps produce the "
            "numbers the score is built from."
        ),
        "eval_steps": [
            {"title": "Build your entry", "gate": False,
             "body": "The official runner clones your repository at the commit you submit, builds its container, and runs your flow with no network, 16 threads, and 64 GB of memory. Your flow writes result/: the top-level DEF (Design Exchange Format) layout, the top-level netlist, period.txt, and, for every block you hardened, its DEF layout and netlist. Only these files are read: any parasitics, timing models, abstracts, or reports your flow writes are ignored. Locally, judge/run_entry.sh runs every step here; ./evaluate.sh baseline/ runs every step from Blocks on, on the result you built."},
            {"title": "Compute budget", "gate": True,
             "body": "The official runner checks that the longest dependency chain (a block, then the block that contains it, then the top) is 12 hours or less. The chain comes from the per-step times your flow writes to result/runtime.json, as run_baseline.sh does for the reference (5.6 hours); a flow that writes none is judged on its wall-clock time. The official run keeps the tool logs, so the reported times can be checked against them, and a person reviews the flow of every leading entry before it is certified. judge/run_entry.sh reports this gate locally, in judge.json."},
            {"title": "Blocks", "gate": True,
             "body": "Reads every hardened block's layout, extracts its parasitics with the pinned rules, and derives its own abstract and its own fast-corner and slow-corner timing models for the levels above. Each block must be placement-legal and fully routed. Children are processed before the blocks that contain them."},
            {"title": "Timing, legality, routing, area", "gate": True,
             "body": "Reads the top-level layout with the evaluator's block models in place, extracts its parasitics, and times it with OpenSTA at your declared period with propagated clocks: setup at the slow corner (0.63 V, 100 °C), hold at the fast corner. Checks that no cell or macro overlaps, that everything is on the placement grid, and that no net is unrouted. The die area comes from the layout's outline."},
            {"title": "Power", "gate": False,
             "body": "Total power at the typical corner with a fixed 1,000 ps reference clock, from the pinned switching activity: one tiled matrix multiply, C = relu(scale × (A × B + D)) at 128 by 128 by 128, simulated on the golden RTL. Activity is applied per flip-flop by register name (99.97% of the reference's flip-flops are covered) and propagated through the rest. A slower clock does not lower your power score."},
            {"title": "Power integrity", "gate": True,
             "body": "Static IR drop analysis of your power grid with OpenROAD, using that power; the worst drop must be at most 110 mV. The reference's is 84.4 mV."},
            {"title": "Design rules", "gate": True,
             "body": "Every layout, block and top, is checked with the detailed router's own rule checker against the technology's routing and via rules. Any short, or any via spacing, enclosure, or off-grid violation, fails the entry. The checker's other findings (end-of-line keep-out and spacing, corner and metal spacing, minimum width) are reported as counts but do not fail the entry: run standalone, the checker reports them on every block of the reference even where the router's own sign-off found none. The open ASAP7 KLayout deck is not a gate for the same reason; it is available for information."},
            {"title": "Logic equivalence", "gate": True,
             "body": "For every module you submit, the evaluator runs the pinned synthesis itself: the golden RTL through the pinned Yosys with the pinned settings, with your other hardened blocks and the SRAM macros as black boxes. Your final netlist of that module must be equivalent to the result. The proof cuts the black boxes and every register, pairs each flip-flop with the synthesized register of the same name, and has ABC prove the whole module. A module the prover cannot finish is checked with 2,000,000 random vectors instead: it passes, and the report says it was checked, not proven. Every reference block and the reference top are proven, in seconds to minutes each. Keep synthesis as pinned: the gate is what you did after it."},
            {"title": "Layout matches netlist", "gate": True,
             "body": "The pin-level connectivity of every layout is compared with that of the netlist that passed equivalence, net by net. ASAP7 has no open transistor-level LVS (Layout Versus Schematic) deck, so this compares the connectivity the layout declares; opens and shorts in the metal are caught by routing and the design-rule check."},
            {"title": "Score", "gate": False,
             "body": "The figure of merit from your clock period, die area, and power against the reference values (6,391 ps, 628,065 µm², 1.3455 W). The report lists every gate's result and details, every metric, and the score, and evaluation.json holds the same as JSON (JavaScript Object Notation) for the leaderboard."},
        ],
        "eval_note": (
            "The evaluator is deterministic: the same result always gets the "
            "same numbers. Its own runtime does not count toward your budget; "
            "on the reference it takes about an hour."
        ),
        "eval_open_runtime": "",
        "submission": (
            "A git repository of source that builds your layout from the pinned "
            "RTL, with nothing prebuilt. The official run builds the result from "
            "it, so the layout is never committed: the reference result is "
            "about 2.4 GB, and GitHub refuses any file over 100 MB. The harness "
            "has the full submission spec."
        ),
        # the checks the evaluation steps do not already cover
        "honesty": [
            ("No shipped answers.",
             "Your repository may carry scripts, tools, and floorplan constraints: block and macro locations, pin placement, and placement regions. It may not carry a finished standard-cell placement, routing, or gate netlist, and your flow must synthesize from the pinned RTL, the same RTL everyone downloads. The official run mounts that RTL at /design and builds with no network, a person reads the flow of every leading entry before it is certified, and the tool logs are kept, so a run too fast to be real is examined."),
            ("Every layer is charged for its wires.",
             "M2 through M7 have calibrated resistance and capacitance in the flow. M8 and M9 have no calibrated values in stock OpenROAD-flow-scripts, so the evaluator uses our pinned values for them, derived from the ASAP7 layer geometry. You may route on M8 and M9, and those wires are charged at the pinned values, never at zero."),
            ("The evaluator is the same one you run.",
             "The evaluator is public, and everyone can run it locally as often as they like. If you find a gap in it, report it on the harness repository."),
        ],
        "requirements": [
            "A Linux machine on x86-64.",
            "16 threads and 64 GB of memory: the same limits the official run builds under.",
            "About 120 GB of free disk, counting Docker's own storage: the reference run takes about 40 GB, the official-runner test in step 4 about 45 GB while it runs, and each evaluation about 16 GB. Deleting a run's work folder frees most of its 40 GB.",
            "Docker, or any OCI (Open Container Initiative) container runtime.",
            "Git and Python 3 on your machine itself, outside the container, and a repository for your entry.",
        ],
        # the open stack every entrant builds on (real project logos, linked)
        "stack": [
            {"img": "logo_gemmini.png", "name": "Gemmini",
             "role": "the accelerator design",
             "url": "https://github.com/ucb-bar/gemmini"},
            {"mark": "7nm", "name": "ASAP7",
             "role": "the 7 nm process kit",
             "url": "https://github.com/The-OpenROAD-Project/asap7"},
            {"img": "logo_yosys.png", "name": "Yosys",
             "role": "logic synthesis",
             "url": "https://github.com/YosysHQ/yosys"},
            {"img": "logo_openroad.png", "name": "OpenROAD",
             "role": "place and route",
             "url": "https://github.com/The-OpenROAD-Project/OpenROAD"},
            {"img": "logo_klayout.png", "name": "KLayout",
             "role": "layout and design rules",
             "url": "https://www.klayout.de"},
        ],
        # exactly what is pinned, and where to read it
        "pins": [
            {"what": "OpenROAD-flow-scripts",
             "detail": "the flow and the ASAP7 platform files",
             "ref": "bde10c7",
             "url": "https://github.com/The-OpenROAD-Project/OpenROAD-flow-scripts/tree/bde10c79a2389ffe9c5d73445f177f81262059f9"},
            {"what": "Gemmini RTL",
             "detail": "generated with Chipyard 1.11.0 and firtool 1.61.0, and shipped in the harness as fixed Verilog",
             "ref": "8c8b38b",
             "url": "https://github.com/ucb-bar/gemmini/tree/8c8b38b9dea3e4d6ba9695346a883b2094bd7388"},
            {"what": "FakeRAM2.0 (memory macros)",
             "detail": "the SRAM macros for the scratchpad and accumulator",
             "ref": "8e6cd66",
             "url": "https://github.com/The-OpenROAD-Project/FakeRAM2.0/tree/8e6cd664f8d5f42ae684c8846a536f66c9d22ae8"},
            {"what": "ASAP7 PDK (Process Design Kit)",
             "detail": "inside the flow, pinned by the commit above",
             "ref": "flow/platforms/asap7",
             "url": "https://github.com/The-OpenROAD-Project/OpenROAD-flow-scripts/tree/bde10c79a2389ffe9c5d73445f177f81262059f9/flow/platforms/asap7"},
        ],
        "repo_url": "https://github.com/Samcooper01/systolic-array-ai-accelerator-harness",
        "quickstart_code": (
            "git clone https://github.com/Samcooper01/systolic-array-ai-accelerator-harness\n"
            "cd systolic-array-ai-accelerator-harness\n"
            "\n"
            "# the pinned image: OpenROAD-flow-scripts at the challenge commit\n"
            "DIGEST=sha256:6bc088ee563c76374f7ef5d0a3244d607a6162c8979f1815f92eef683c1169a4\n"
            "docker run --rm -it \\\n"
            "  -v \"$PWD\":/work -w /work \\\n"
            "  openroad/orfs@$DIGEST bash\n"
            "\n"
            "# inside the container:\n"
            "./setup.sh                # links the container's tools and checks them"
        ),
        # step 4: build and score inside the container while iterating; once before submitting, the official
        # runner (judge/run_entry.sh), outside the container, which builds the commit and scores it in the
        # pinned image
        "iterate_code": (
            "./run_baseline.sh          # runs your flow, as reproduce/run.sh does,\n"
            "                           # into baseline/ (5 to 6 hours for the reference)\n"
            "./evaluate.sh baseline/    # checks every gate and scores it (about an hour)"
        ),
        "presubmit_text": "Before you submit, test it once the way the official run will: commit, then run the official runner in a terminal on your own machine, outside the container (for an entry that is not a fork of the harness, add its path and commit):",
        "selftest_code": (
            "git add -A && git commit -m \"my entry\"\n"
            "# builds your commit's container and runs it with no network under the\n"
            "# 12 hour budget, then scores it (6 to 7 hours for the reference),\n"
            "# writing eval_work/mine/evaluation.json\n"
            "judge/run_entry.sh"
        ),
        "submit_how": (
            "To send it in, open an issue on the harness repository with your "
            "repository, the commit to build, and the evaluation.json from your "
            "test with the official runner (eval_work/mine/evaluation.json). The official run builds your repository at that "
            "commit and scores what it builds; your own numbers are checked "
            "against its run."
        ),
        "links": [
            {"label": "Challenge harness", "url": "https://github.com/Samcooper01/systolic-array-ai-accelerator-harness",
             "note": "the pinned inputs, the reference flow, the evaluator, and the submission spec, in one repository to clone"},
            {"label": "OpenROAD-flow-scripts @ bde10c7", "url": "https://github.com/The-OpenROAD-Project/OpenROAD-flow-scripts/tree/bde10c79a2389ffe9c5d73445f177f81262059f9",
             "note": "the exact flow and PDK the harness pins"},
            {"label": "Gemmini", "url": "https://github.com/ucb-bar/gemmini",
             "note": "the accelerator generator the design comes from"},
            {"label": "Chipyard", "url": "https://github.com/ucb-bar/chipyard",
             "note": "the framework Gemmini's RTL is generated in"},
            {"label": "ASAP7 PDK", "url": "https://github.com/The-OpenROAD-Project/asap7",
             "note": "the process design kit"},
            {"label": "OpenROAD", "url": "https://github.com/The-OpenROAD-Project/OpenROAD",
             "note": "place and route, timing, extraction, and DRC (Design Rule Check)"},
            {"label": "Yosys", "url": "https://github.com/YosysHQ/yosys",
             "note": "synthesis"},
            {"label": "OpenSTA", "url": "https://github.com/The-OpenROAD-Project/OpenSTA",
             "note": "the static timing engine the timing gate uses"},
            {"label": "ABC", "url": "https://github.com/berkeley-abc/abc",
             "note": "the logic-equivalence prover the gate uses, through Yosys"},
            {"label": "KLayout", "url": "https://www.klayout.de",
             "note": "layout viewing and DRC"},
        ],
    },
]

_BY_SLUG = {c["slug"]: c for c in CHALLENGES}


def all_challenges():
    return CHALLENGES


def get(slug: str):
    return _BY_SLUG.get(slug)
