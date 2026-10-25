"""Build the browser engine's copy of a design: the flattened, synthesized
netlist, every cell's size, the memory macros' pin positions, the flow's own
settings for the design, and which part of the design each cell belongs to,
as one compact JSON file.

Everything is read from an OpenROAD-flow-scripts checkout: the netlist a
real run synthesized (results/.../1_2_yosys.v), the ASAP7 libraries and
layout abstracts, and the flow's own Yosys, which does the flattening so
the connectivity is the tool's, not ours.

    python3 app/design_build/build_design.py --flow <ORFS>/flow --design riscv32i \
        --run cal1138_45dac80e --out app/static/explore/designs/riscv32i-net.json

Each design's entry in SPECS below says how its cells are grouped:
  "names": by the instance name's hierarchy prefix, for a netlist that kept
           its module names (riscv32i);
  "cones": for a netlist whose logic lost its names in synthesis, the
           registers are grouped by name and every logic cell joins the
           group of the nearest register its output feeds.
The flow settings are copied from the design's config.mk and constraint.sdc.
"""
import argparse, collections, glob, gzip, json, os, re, subprocess, tempfile


SPECS = {
    "riscv32i": {
        "top": "riscv_top", "grouping": "names",
        "groups": ["logic", "register file", "arithmetic logic unit", "next-address adder (+ 4)",
                   "branch target adder", "program counter", "data memory logic", "memory macro"],
        "prefixes": [("riscv.dp.rf", 1), ("riscv.dp.alu", 2), ("riscv.dp.pcadder", 3),
                     ("riscv.dp.pcimm", 4), ("riscv.dp.pcreg", 5), ("dmem", 6)],
        "macro_group": 7,
        # config.mk: CORE_UTILIZATION 62, CORE_MARGIN 5, MACRO_PLACE_HALO 2;
        # io.tcl keeps the pins off the left, right and top edges;
        # constraint.sdc: clk_io_pct 0.125, clock latency 142.965
        "flow": {"util": 0.62, "margin": 5.0, "halo": 2.0, "pins": "bottom", "ioPct": 0.125, "latency": 142.965,
                 "clock": "clk"},
    },
    "gcd": {
        "top": "gcd", "grouping": "cones",
        "groups": ["logic to the outputs", "register A and its logic", "register B and its logic",
                   "control state machine"],
        "prefixes": [("dpath.a_reg", 1), ("dpath.b_reg", 2), ("ctrl.state", 3)],
        # config.mk: CORE_UTILIZATION 65, CORE_MARGIN 0.5, PLACE_DENSITY 0.35;
        # no pin constraints; constraint.sdc: clk_io_pct 0.2, clock latency 36.225
        "flow": {"util": 0.65, "margin": 0.5, "halo": 0.0, "pins": "all", "ioPct": 0.2, "latency": 36.225,
                 "clock": "clk"},
    },
    "aes": {
        "top": "aes_cipher_top", "grouping": "cones",
        "groups": ["logic to the outputs", "state bytes and their round logic", "key expansion",
                   "input text register", "output text register", "round counter and control"],
        "prefixes": [("sa", 1), ("u0.", 2), ("text_in_r", 3), ("text_out", 4), ("dcnt", 5), ("ld_r", 5), ("done", 5)],
        # config.mk: CORE_UTILIZATION 70, CORE_MARGIN 2, PLACE_DENSITY 0.65;
        # no pin constraints; constraint.sdc: clk_io_pct 0.2, clock latency 77.930
        "flow": {"util": 0.70, "margin": 2.0, "halo": 0.0, "pins": "all", "ioPct": 0.2, "latency": 77.93,
                 "clock": "clk"},
    },
}


def cone_groups(cells, types, groups, nets, clock):
    """Give every unnamed logic cell (group 0) the group of the nearest named
    register its output feeds: a breadth-first search backwards from every
    register's inputs at once, so each cell is claimed by whichever register
    reaches it first. Cells that feed only the outputs keep group 0."""
    drv_of, loads_of = {}, collections.defaultdict(list)     # net -> driver cell; cell -> nets it reads
    for ni, net in enumerate(nets):
        if ni == clock:
            continue
        for k in range(0, len(net), 2):
            c, pin = net[k], net[k + 1]
            if c < 0:
                continue
            if types[cells[c]]["dirs"][pin] == "O":
                drv_of[ni] = c
            else:
                loads_of[c].append(ni)
    frontier = [c for c in range(len(cells)) if groups[c] != 0]
    while frontier:
        nxt = []
        for c in frontier:
            for ni in loads_of[c]:
                d = drv_of.get(ni)
                if d is not None and groups[d] == 0:
                    groups[d] = groups[c]
                    nxt.append(d)
        frontier = nxt


def lef_sizes(paths):
    size = {}
    for f in paths:
        cur = None
        for line in open(f, errors="ignore"):
            m = re.match(r"\s*MACRO\s+(\S+)", line)
            if m:
                cur = m.group(1)
                continue
            m = re.match(r"\s*SIZE\s+([\d.]+)\s+BY\s+([\d.]+)", line)
            if m and cur and cur not in size:
                size[cur] = (float(m.group(1)), float(m.group(2)))
    return size


def macro_pins(lef, macro):
    """pin name -> centre of its first shape, for one macro"""
    text = open(lef).read()
    body = text[text.index("MACRO " + macro):]
    body = body[:body.index("END " + macro)]
    pins = {}
    for m in re.finditer(r"PIN\s+(\S+)(.*?)END\s+\1", body, re.S):
        r = re.search(r"RECT\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)", m.group(2))
        if r:
            x0, y0, x1, y1 = map(float, r.groups())
            pins[m.group(1)] = (round((x0 + x1) / 2, 3), round((y0 + y1) / 2, 3))
    return pins


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--flow", required=True, help="OpenROAD-flow-scripts/flow")
    ap.add_argument("--design", required=True, choices=sorted(SPECS))
    ap.add_argument("--run", required=True, help="run name under results/asap7/<design>")
    ap.add_argument("--names", help="also write each cell's instance name here, in cell order (for debugging)")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    S = SPECS[a.design]
    flow = os.path.abspath(a.flow)
    plat = os.path.join(flow, "platforms", "asap7")
    tmp = tempfile.mkdtemp()

    # the typical-corner libraries, for pin directions (Yosys reads plain text)
    libs = []
    for f in sorted(glob.glob(plat + "/lib/NLDM/asap7sc7p5t_*_RVT_TT_nldm_*.lib*")):
        if "FAKE" in f:
            continue
        out = os.path.join(tmp, os.path.basename(f).replace(".gz", ""))
        opener = gzip.open if f.endswith(".gz") else open
        with opener(f, "rt") as src, open(out, "w") as dst:
            dst.write(src.read())
        libs.append(out)
    libs.append(plat + "/lib/NLDM/fakeram7_256x32.lib")

    netlist = f"{flow}/results/asap7/{a.design}/{a.run}/1_2_yosys.v"
    js = os.path.join(tmp, "flat.json")
    yosys = os.path.join(flow, "..", "tools", "install", "yosys", "bin", "yosys")
    script = "".join(f"read_liberty -lib {l}; " for l in libs) + \
        f"read_verilog {netlist}; hierarchy -top {S['top']}; " \
        "setattr -mod -unset keep_hierarchy *; flatten; opt_clean; " + f"write_json {js}"
    subprocess.run([yosys, "-q", "-p", script], check=True)
    top = json.load(open(js))["modules"][S["top"]]

    size = lef_sizes(glob.glob(plat + "/lef/*.lef"))
    mpins = macro_pins(plat + "/lef/fakeram7_256x32.lef", "fakeram7_256x32")

    # the ports, one entry per bit
    ports, bitport = [], {}
    for pname, p in top["ports"].items():
        for i, b in enumerate(p["bits"]):
            nm = pname if len(p["bits"]) == 1 else f"{pname}[{i}]"
            bitport[b] = len(ports)
            ports.append({"n": nm, "d": "I" if p["direction"] == "input" else "O"})

    # cells: their type, pins, and which named part of the design they are
    types, tindex = [], {}
    cells, groups, names = [], [], []
    GROUPS = S["groups"]
    def group_of(name, typ):
        if "fakeram" in typ: return S["macro_group"]
        n = name.replace("\\", "")
        for pre, g in S["prefixes"]:
            if n.startswith(pre): return g
        return 0
    netpins = collections.defaultdict(list)
    for name, c in top["cells"].items():
        typ = c["type"]
        if typ.startswith("$"):
            continue
        if typ not in tindex:
            w, h = size[typ]
            pins, dirs = [], []
            for pn, bits in c["connections"].items():
                for i, _ in enumerate(bits):
                    pins.append(pn if len(bits) == 1 else f"{pn}[{i}]")
                    dirs.append("O" if c["port_directions"][pn] == "output" else "I")
            t = {"n": typ, "w": w, "h": h, "pins": pins, "dirs": "".join(dirs)}
            if "fakeram" in typ:
                t["macro"] = True
                t["off"] = [mpins.get(p, (w / 2, h / 2)) for p in pins]
            tindex[typ] = len(types)
            types.append(t)
        ti = tindex[typ]
        ci = len(cells)
        cells.append(ti)
        names.append(name)
        groups.append(group_of(name, typ))
        k = 0
        for pn, bits in c["connections"].items():
            for b in bits:
                if isinstance(b, int):
                    netpins[b].append((ci, k))
                k += 1
    for b, pi in bitport.items():
        netpins[b].append((-1, pi))

    # nets with at least two ends; the clock is marked, placement skips it
    nets, clock = [], -1
    clkbit = top["ports"][S["flow"]["clock"]]["bits"][0]
    for b, ends in netpins.items():
        if len(ends) < 2:
            continue
        if b == clkbit:
            clock = len(nets)
        nets.append([v for e in ends for v in e])

    if S["grouping"] == "cones":
        cone_groups(cells, types, groups, nets, clock)

    out = {
        "meta": {
            "design": a.design, "flow": S["flow"], "grouping": S["grouping"],
            "source": f"synthesized netlist of OpenROAD-flow-scripts run {a.run}, flattened with the flow's own Yosys",
            "asap7": "ASAP7 library data: BSD 3-Clause License, Copyright 2020 Lawrence T. Clark, "
                     "Vinay Vashishtha, or Arizona State University",
            "rowH": 0.27, "site": 0.054,
        },
        "groups": GROUPS, "types": types, "cells": cells, "cellGroup": groups,
        "ports": ports, "nets": nets, "clockNet": clock,
    }
    with open(a.out, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    if a.names:
        with open(a.names, "w") as f:
            json.dump(names, f)
    n_std = sum(1 for c in cells if not types[c].get("macro"))
    print(f"{len(cells)} cells ({n_std} standard, {len(cells) - n_std} macros), {len(types)} types, "
          f"{len(nets)} nets, {len(ports)} port bits, clock net {clock} -> {a.out} "
          f"({os.path.getsize(a.out) // 1024} KB)")


if __name__ == "__main__":
    main()
