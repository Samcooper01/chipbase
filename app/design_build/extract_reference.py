"""Read one real run's reference numbers from its own logs and reports, for a
design page's "real OpenROAD" column. Every value names the file it comes
from, so nothing on the page is typed in by hand.

    python3 app/design_build/extract_reference.py <ORFS>/flow <design> <run>

prints the numbers as JSON, ready for the design's engine.reference.
"""
import json, re, sys


def main():
    flow, design, run = sys.argv[1:4]
    logs = f"{flow}/logs/asap7/{design}/{run}"
    reps = f"{flow}/reports/asap7/{design}/{run}"
    res = f"{flow}/results/asap7/{design}/{run}"
    read = lambda p: open(p, errors="ignore").read()
    js = lambda p: json.load(open(p))
    report = js(f"{logs}/6_report.json")
    grt, drt = js(f"{logs}/5_1_grt.json"), js(f"{logs}/5_2_route.json")
    cls = lambda k: report.get(f"finish__design__instance__{k}", 0)

    # die: the finished layout's DIEAREA (6_final.def)
    d = read(f"{res}/6_final.def")
    dbu = int(re.search(r"UNITS DISTANCE MICRONS (\d+)", d).group(1))
    x0, y0, x1, y1 = map(int, re.search(r"DIEAREA \( (-?\d+) (-?\d+) \) \( (-?\d+) (-?\d+) \)", d).groups())

    # placement: 3_3_place_gp.log and 3_5_place_dp.log
    gp, dp, fp = read(f"{logs}/3_3_place_gp.log"), read(f"{logs}/3_5_place_dp.log"), read(f"{logs}/2_1_floorplan.log")
    table = re.findall(r"^\s*\d+\s*\|\s*[\d.]+\s*\|\s*([\d.e+]+)\s*\|", gp, re.M)
    first = lambda pat, text, conv=float: conv(re.search(pat, text).group(1))
    allf = lambda pat, text: [float(v) for v in re.findall(pat, text)]
    density = first(r"GPL-0023\] Placement target density:\s+([\d.]+)", gp)   # the target it actually used

    # clock tree: 4_1_cts.log
    cts = read(f"{logs}/4_1_cts.log")
    clusters = allf(r"Total number of sinks after clustering: (\d+)", cts)
    levels = allf(r"Max level of the clock tree: (\d+)", cts)
    delay = allf(r"Total number of delay buffers: (\d+)", cts)

    # repair: 2_1_floorplan.log and 3_3_place_gp.log
    ports = sum(allf(r"RSZ-002[78]\] Inserted (\d+) \S+ (?:input|output) buffers", gp))
    design_buf = re.search(r"RSZ-0038\] Inserted (\d+) buffers in (\d+) nets", gp)
    resized = sum(allf(r"RSZ-0051\] Resized (\d+) instances", fp)) + sum(allf(r"RSZ-0039\] Resized (\d+) instances", gp))

    # timing and power: 6_finish.rpt
    fin = read(f"{reps}/6_finish.rpt")
    period = float(read(f"{res}/clock_period.txt").strip())
    wns, tns = first(r"worst slack max (\S+)", fin), first(r"tns max (\S+)", fin)
    power, ptab = {}, fin[fin.index("report_power"):]
    for g in ("Sequential", "Combinational", "Clock", "Macro", "Total"):
        m = re.search(rf"^{g}\s+([-\d.e+]+)\s+([-\d.e+]+)\s+([-\d.e+]+)\s+([-\d.e+]+)", ptab, re.M)
        power[g.lower()] = [float(v) * 1e3 for v in m.groups()]      # watts to milliwatts
    gates = worst_path_gates(fin, wns)

    # routing: 5_2_route.log for the per-layer split
    rl = read(f"{logs}/5_2_route.log")
    layers = {m.group(1): float(m.group(2)) for m in re.finditer(r"Total wire length on LAYER (M\d) = (\d+) um", rl)}

    out = {
        "die": round((x1 - x0) / dbu, 2),
        "rows": report.get("finish__design__rows") or js(f"{logs}/4_1_cts.json").get("cts__design__rows"),
        "density": round(density, 3),
        "globalHpwl": round(float(table[-1])) if table else None,
        "legalHpwl": round(first(r"legalized HPWL\s+([\d.]+)", dp)),
        "improvedHpwl": round(allf(r"HPWL after\s+([\d.]+)", dp)[-1]) if allf(r"HPWL after\s+([\d.]+)", dp) else None,
        "avgDisp": first(r"average displacement\s+([\d.]+)", dp),
        "maxDisp": first(r"max displacement\s+([\d.]+)", dp),
        "placeWns": [round(v * 1e12, 1) for v in allf(r"GPL-0106\] Timing-driven: worst slack (\S+)", gp)],
        "cts": {"clusters": int(max(clusters)) if clusters else None, "buffers": int(cls("count__class:clock_buffer")),
                "levels": int(max(levels)) if levels else None, "skew": round(grt["globalroute__clock__skew__setup"], 1),
                "delayBuffers": int(delay[-1]) if delay else 0},
        "route": {"global": grt["globalroute__global_route__wirelength"], "detailed": drt["detailedroute__route__wirelength"],
                  "globalVias": grt["globalroute__global_route__vias"], "vias": drt["detailedroute__route__vias"],
                  "layers": {k: v for k, v in layers.items() if k in ("M2", "M3", "M4", "M5", "M6", "M7")}},
        "repair": {"buffers": int(cls("count__class:timing_repair_buffer")),
                   "bufferArea": round(cls("area__class:timing_repair_buffer"), 1), "ports": int(ports),
                   "design": int(design_buf.group(1)) if design_buf else 0,
                   "designNets": int(design_buf.group(2)) if design_buf else 0, "resized": int(resized)},
        "timing": {"period": period, "wns": wns, "tns": tns, "gates": gates},
        # totals from 6_report.json, which keeps more digits than the report's table
        "power": {"total": round(report["finish__power__total"] * 1e3, 2),
                  "internal": round(report["finish__power__internal__total"] * 1e3, 2),
                  "switching": round(report["finish__power__switching__total"] * 1e3, 2),
                  "leakage": round(report["finish__power__leakage__total"] * 1e3, 3),
                  "groups": {g: round(power[g][3], 2) for g in ("sequential", "combinational", "clock", "macro")},
                  "detail": {g: [round(v, 6) for v in power[g][:3]] for g in ("sequential", "combinational", "clock", "macro")}},
        "area": {"die": round(report["finish__design__die__area"], 2), "core": round(report["finish__design__core__area"], 2),
                 "macro": round(cls("area__class:macro"), 2),
                 "std": round(sum(v for k, v in report.items() if k.startswith("finish__design__instance__area__class:")
                                  and not k.endswith((":macro", ":fill_cell"))), 1)},
        "finish": {"fillers": int(cls("count__class:fill_cell")), "fillArea": round(cls("area__class:fill_cell"), 1)},
    }
    print(json.dumps(out, indent=1))


def worst_path_gates(rpt, wns):
    """How many gates the worst setup path goes through, in 6_finish.rpt's
    report_checks listing: the distinct instances between its start and end."""
    for block in re.split(r"\n(?=Startpoint:)", rpt):
        m = re.search(r"^\s*(-?[\d.]+)\s+slack \((?:VIOLATED|MET)\)", block, re.M)
        if not m or abs(float(m.group(1)) - wns) > 0.01 or "Path Type: max" not in block:
            continue
        data = block.split("data arrival time")[0]
        insts = []
        for line in data.splitlines():
            p = re.search(r"\s[\^v]\s+(\S+)/(\S+)\s+\((\S+)\)", line)
            if p and (not insts or insts[-1] != p.group(1)):
                insts.append(p.group(1))
        return max(0, len(insts) - 1)             # every instance but the path's end
    return None


if __name__ == "__main__":
    main()
