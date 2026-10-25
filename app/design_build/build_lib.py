"""Build the browser engine's cell library, shared by every design: for each
cell type the designs use, every usable size of the same gate (the resizer's
choices), the clock tree's and the repair's buffers, and the memory macro,
it keeps each pin's capacitance and load limit, each timing arc's rising and
falling delay and slew tables with the arc's sense, the flip-flops' setup
and hold tables, each output's logic function and energy table, and leakage.

Read from the same fast-corner (RVT FF) Liberty files the real runs used,
with every library's units brought to picoseconds, femtofarads, picowatts
and femtojoules.

    python3 app/design_build/build_lib.py --flow <ORFS>/flow \
        --net app/static/explore/designs/riscv32i-net.json \
        --net app/static/explore/designs/gcd-net.json \
        --net app/static/explore/designs/aes-net.json \
        --out app/static/explore/designs/asap7-lib.json
"""
import re
import argparse, glob, json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
import liberty

EXTRA = ["BUFx16f_ASAP7_75t_R", "BUFx24_ASAP7_75t_R",     # the clock tree's buffers
         "BUFx2_ASAP7_75t_R", "BUFx3_ASAP7_75t_R", "BUFx6f_ASAP7_75t_R"]   # and the repair's

# The resizer may swap a gate for a stronger or weaker version of itself, so
# every drive strength of each gate the design uses comes along, except the
# ones the platform tells the tools not to use (DONT_USE_CELLS in ASAP7's
# config.mk: *x1p*, *xp*, SDF*, ICG*).
def family(name):
    return re.sub(r"x(p?\d+)(p\d+)?f?$", "", name.replace("_ASAP7_75t_R", ""))


def dont_use(name):
    return bool(re.search(r"x1p|xp", name)) or name.startswith(("SDF", "ICG"))


# Libraries do not share units: the standard cells use picoseconds and
# femtofarads, the memory nanoseconds and picofarads. Everything is brought
# to ps, fF, pW and fJ here, axes included.
TIME = {"1ps": 1.0, "1ns": 1000.0}
CAP = {"ff": 1.0, "pf": 1000.0}
LEAK = {"1pW": 1.0, "1nW": 1e3, "1uW": 1e6, "1mW": 1e9}
AXIS = {"input_net_transition": "slew", "input_transition_time": "slew", "related_pin_transition": "slew",
        "constrained_pin_transition": "slew", "total_output_net_capacitance": "load"}


class Units:
    def __init__(self, lib):
        a = lib["attrs"]
        self.t = TIME[a.get("time_unit", "1ps").replace('"', "")]
        cu = a.get("capacitive_load_unit", [["1", "ff"]])[0]
        self.c = float(cu[0]) * CAP[cu[1].lower()]
        self.leak = LEAK[a.get("leakage_power_unit", "1pW").replace('"', "")]
        self.axes = {}
        for g in lib["groups"]:
            if g["type"] in ("lu_table_template", "power_lut_template"):
                v = [g["attrs"].get("variable_1"), g["attrs"].get("variable_2")]
                self.axes[g["args"][0]] = [AXIS.get(x, "slew") for x in v if x]

    def table(self, g, kind):
        """a table in common units, with its axes named"""
        t = liberty.table(g)
        ax = self.axes.get(g.get("args", [""])[0] if g.get("args") else "", ["slew", "load"])[:max(1, len([x for x in (t["i1"], t["i2"]) if x]))]
        scale = {"slew": self.t, "load": self.c}
        t["i1"] = [x * scale[ax[0]] for x in t["i1"]]
        if t["i2"] and len(ax) > 1:
            t["i2"] = [x * scale[ax[1]] for x in t["i2"]]
        vs = self.t if kind == "time" else self.c          # energy is capacitance times volts squared
        t["v"] = [[x * vs for x in row] for row in t["v"]]
        t["ax"] = ax
        return t


def merged(groups, a, b, U, kind="time"):
    """the larger of two tables, point by point (rise and fall)"""
    ta = [U.table(g, kind) for g in groups if g["type"] == a]
    tb = [U.table(g, kind) for g in groups if g["type"] == b]
    ts = ta + tb
    if not ts:
        return None
    out = {"i1": ts[0]["i1"], "i2": ts[0]["i2"], "ax": ts[0]["ax"], "v": [row[:] for row in ts[0]["v"]]}
    for t in ts[1:]:
        if t["i1"] == out["i1"] and t["i2"] == out["i2"]:
            out["v"] = [[max(x, y) for x, y in zip(r, s)] for r, s in zip(out["v"], t["v"])]
    return out


def rounded(t):
    if t:
        t["v"] = [[round(x, 3) for x in row] for row in t["v"]]
    return t


def edges(groups, rise, fall, U, kind="time"):
    """a rising-edge and a falling-edge table, each the worst over the
    arc's conditions; a side the library leaves out borrows the other"""
    r = merged(groups, rise, rise, U, kind)
    f = merged(groups, fall, fall, U, kind)
    return rounded(r or f), rounded(f or r)


def mid(t):
    """a table's value near the middle of its range: a typical operating point"""
    v = t["v"]
    return v[len(v) // 2][len(v[0]) // 2] if v and v[0] else 0.0


def cell_data(cell, U):
    a = cell["attrs"]
    out = {"area": float(a.get("area", 0)), "leak": float(a.get("cell_leakage_power", 0)) * U.leak,
           "pins": {}, "arcs": [], "checks": []}
    energies = []
    for p in (g for g in cell["groups"] if g["type"] in ("pin", "bus")):
        # a bus can list its bits as pins, or carry the timing itself; the
        # engine looks a bit like rd_out[3] up as rd_out when it has to
        pins = [p] if p["type"] == "pin" else ([g for g in p["groups"] if g["type"] == "pin"] or [p])
        for pin in pins:
            name = pin["args"][0]
            pa = pin["attrs"]
            cap = pa.get("capacitance") or pa.get("rise_capacitance") or "0"
            out["pins"][name] = {"dir": pa.get("direction", "input")[0].upper(), "cap": float(cap) * U.c}
            if "max_capacitance" in pa:
                out["pins"][name]["maxCap"] = float(pa["max_capacitance"]) * U.c
            if pa.get("clock") == "true":
                out["pins"][name]["clock"] = True
            if "function" in pa:        # the logic the pin computes, for switching activity
                out["pins"][name]["fn"] = pa["function"].replace('"', "").strip()
            for t in (g for g in pin["groups"] if g["type"] == "timing"):
                ta = t["attrs"]
                rel = ta.get("related_pin", "").strip()
                tt = ta.get("timing_type", "combinational")
                if tt in ("setup_rising", "hold_rising", "setup_falling", "hold_falling"):
                    r, f = edges(t["groups"], "rise_constraint", "fall_constraint", U)
                    if r:
                        # the check for a rising data edge and for a falling one
                        out["checks"].append({"pin": name, "clk": rel, "type": tt.split("_")[0], "tr": r, "tf": f})
                elif tt in ("combinational", "rising_edge", "falling_edge", "combinational_rise", "combinational_fall"):
                    dr, df = edges(t["groups"], "cell_rise", "cell_fall", U)
                    sr, sf = edges(t["groups"], "rise_transition", "fall_transition", U)
                    if dr and sr:
                        # sense: does the output edge follow the input edge (positive),
                        # invert it (negative), or can it do either (non)
                        sense = ta.get("timing_sense", "non_unate").replace('"', "").split("_")[0]
                        for r in rel.split():
                            out["arcs"].append({"from": r, "to": name, "clk": tt.endswith("edge"), "sense": sense,
                                                "dr": dr, "df": df, "sr": sr, "sf": sf})
            tabs = []
            for ip in (g for g in pin["groups"] if g["type"] == "internal_power"):
                ts = [U.table(x, "energy") for x in ip["groups"] if x["type"] in ("rise_power", "fall_power", "power")]
                if ts:
                    e = sum(mid(t) for t in ts) / len(ts)
                    energies.append((name, pa.get("direction", "input"), e))
                    tabs += [t for t in ts if t["i2"]]
            # an output's energy per switch against its load: the mean of its
            # two-dimensional tables (rise and fall, every related input)
            if pa.get("direction") == "output" and tabs:
                same = [t for t in tabs if t["i1"] == tabs[0]["i1"] and t["i2"] == tabs[0]["i2"]]
                out["pins"][name]["eTab"] = rounded({"i1": same[0]["i1"], "i2": same[0]["i2"], "ax": same[0]["ax"],
                    "v": [[sum(t["v"][i][j] for t in same) / len(same) for j in range(len(same[0]["i2"]))]
                          for i in range(len(same[0]["i1"]))]})

    # a flip-flop's state: its two internal variables and what the clock loads into them
    for g in cell["groups"]:
        if g["type"] == "ff":
            ga = g["attrs"]
            out["ff"] = {"vars": [v.strip() for v in g["args"][0].split(",")] if len(g["args"]) == 1 else g["args"],
                         "next": ga.get("next_state", "").replace('"', ""), "clk": ga.get("clocked_on", "").replace('"', "")}

    # energy per switching event: on outputs for logic, on the clock pin for flops
    out_e = [e for n, d, e in energies if d == "output"]
    clk_e = [e for n, d, e in energies if out["pins"].get(n, {}).get("clock")]
    out["eOut"] = sum(out_e) / len(out_e) if out_e else 0.0
    out["eClk"] = sum(clk_e) / len(clk_e) if clk_e else 0.0
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--flow", required=True)
    ap.add_argument("--net", required=True, action="append", help="a design's net JSON; give one per design")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    lib_dir = os.path.join(a.flow, "platforms", "asap7", "lib", "NLDM")
    want = set(t["n"] for net in a.net for t in json.load(open(net))["types"]) | set(EXTRA)
    fams = set(family(n) for n in want if n.endswith("_ASAP7_75t_R"))
    files = sorted(f for f in glob.glob(lib_dir + "/asap7sc7p5t_*_RVT_FF_nldm_*.lib*") if "FAKE" not in f)
    files.append(lib_dir + "/fakeram7_256x32.lib")
    cells, units = {}, None
    for f in files:
        L = liberty.parse(f)
        U = Units(L)
        if units is None and "nom_voltage" in L["attrs"]:
            units = {"time": L["attrs"].get("time_unit"), "voltage": float(L["attrs"]["nom_voltage"]),
                     "leakage": L["attrs"].get("leakage_power_unit")}
        for c in (g for g in L["groups"] if g["type"] == "cell"):
            nm = c["args"][0]
            size_of = nm.endswith("_ASAP7_75t_R") and family(nm) in fams and not dont_use(nm)
            if (nm in want or size_of) and nm not in cells:
                cells[nm] = cell_data(c, U)
                cells[nm]["family"] = family(nm) if nm.endswith("_ASAP7_75t_R") else nm
                cells[nm]["dontUse"] = dont_use(nm)
    missing = sorted(want - set(cells))
    units = {"time": "ps", "cap": "fF", "leakage": "pW", "energy": "fJ", "voltage": units["voltage"]}
    out = {"meta": {"corner": "RVT FF, as the real runs used", "units": units,
                    "asap7": "ASAP7 library data: BSD 3-Clause License, Copyright 2020 Lawrence T. Clark, "
                             "Vinay Vashishtha, or Arizona State University"},
           "cells": cells}
    with open(a.out, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    arcs = sum(len(c["arcs"]) for c in cells.values())
    print(f"{len(cells)} cells, {arcs} arcs, missing {missing}, units {units} -> {a.out} "
          f"({os.path.getsize(a.out) // 1024} KB)")


if __name__ == "__main__":
    main()
