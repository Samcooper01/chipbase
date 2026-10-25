"""Pull the numbers for a what-if option out of the run it came from.

Nothing here is read from memory: every field names the line it was greped
from, and a field with no line stays blank so a missing measurement cannot be
mistaken for a zero.
"""
import glob
import os
import re
import sys


def last(pattern, text, group=1, cast=float):
    hits = re.findall(pattern, text, re.M)
    return cast(hits[-1]) if hits else None


def metrics(label):
    log = open("%s.log" % label, errors="replace").read() if os.path.exists("%s.log" % label) else ""
    rpt = ""
    for path in glob.glob("%s/6_finish.rpt" % label):
        rpt = open(path, errors="replace").read()
    drops = re.findall(r"Percentage drop\s*:\s*([\d.]+)", log)
    grt = re.findall(r"^Total\s+\d+\s+\d+\s+([\d.]+)%", log, re.M)
    return {
        "label": label,
        "instances": last(r"IFP-0105\] Number of instances:\s+(\d+)", log, cast=int),
        "area": last(r"Design area (\d+) um\^2", log, cast=int),
        "util": last(r"Design area \d+ um\^2 (\d+)% utilization", log, cast=int),
        "wire": last(r"Total wire length = (\d+) um", log, cast=int),
        # the virtual clock also reports a period_min, always 0.00, so pick
        # the real one by excluding the vclk_ name the flow gives the virtual
        "period_min": last(r"^(?!vclk_)\S+ period_min = ([\d.]+)", rpt),
        # report_wns clamps at zero, so a design that passes shows 0.00 there
        # and its real margin only in report_worst_slack
        "wns": last(r"wns max (-?[\d.]+)", rpt),
        "slack": last(r"worst slack max (-?[\d.]+)", rpt),
        "tns": last(r"tns max (-?[\d.]+)", rpt),
        "power": last(r"Total power\s+:\s+([\d.e+-]+)", log),
        "drop_vdd": float(drops[0]) if drops else None,
        "drop_vss": float(drops[1]) if len(drops) > 1 else None,
        "drc": last(r"DRT-0199\]\s+Number of violations = (\d+)", log, cast=int),
        "grt_total": float(grt[-1]) if grt else None,
        "buffers": last(r"CTS-0018\]\s+Created (\d+) clock buffers", log, cast=int),
        "done": "Number of violations" in log and "6_report" in log,
    }


COLS = ["label", "instances", "area", "util", "wire", "period_min", "slack", "wns", "tns",
        "power", "drop_vdd", "drop_vss", "drc", "grt_total", "buffers", "done"]

if __name__ == "__main__":
    labels = sys.argv[1:] or sorted(
        f[:-4] for f in os.listdir(".") if f.endswith(".log") and "driver" not in f)
    print(" | ".join("%-11s" % c for c in COLS))
    for label in labels:
        m = metrics(label)
        print(" | ".join("%-11s" % ("" if m[c] is None else m[c]) for c in COLS))
