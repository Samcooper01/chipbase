"""The run dataset: every OpenROAD run behind the drills, published as data.

The drills on this site quote numbers from real runs of the open flow. This
module turns those runs into something another person can use: a manifest
that says, for every run, which design and platform it was, what was changed
from the flow's defaults, what it measured, and which drill items cite it.

Nothing in the manifest is typed by hand. The changes are read from the run
scripts that launched the runs, the clock is read back out of each log, and
every metric is greped from the log or the final report. A metric the run
never printed stays empty, so a missing number cannot be read as a zero.

    python3 -m app.dataset build     # writes data/dataset/{runs.json,runs.csv,README.md} and the archive

The page at /data reads runs.json, so it has to be rebuilt after new runs land.
"""

import csv
import io
import json
import re
import shlex
import sys
import tarfile
import time
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
SOURCES = {"whatif-src": DATA / "whatif-src", "pathology-src": DATA / "pathology-src"}
OUT = DATA / "dataset"
ARCHIVE = "chipbase-openroad-runs.tar.gz"

# Files a visitor may fetch from the source folders, by suffix. Anything else
# (the sqlite file, stray scratch files) is never served.
SERVABLE = {".log", ".rpt", ".sh", ".tcl", ".py", ".sdc", ".webp", ".json", ".csv", ".md", ".gz"}

PLATFORM_NAMES = {
    "nangate45": "Nangate45 (45 nanometre open cell library)",
    "sky130hd": "Skywater 130 nanometre, high density library",
    "asap7": "ASAP7 (Arizona State University 7 nanometre predictive process design kit)",
}
# ASAP7 reports time in picoseconds, the other two platforms in nanoseconds.
TIME_UNIT = {"asap7": "ps", "nangate45": "ns", "sky130hd": "ns"}

COLUMNS = [
    ("label", "run name", ""), ("design", "design", ""), ("platform", "platform", ""),
    ("changes", "changed from the defaults", ""), ("clock", "requested clock", "time"),
    ("instances", "instances", "count"), ("area", "cell area", "um2"),
    ("utilization", "utilization", "percent"), ("wire", "routed wire", "um"),
    ("floor", "smallest period", "time"), ("slack", "worst setup slack", "time"),
    ("tns", "total negative slack", "time"), ("power", "total power", "mW"),
    ("drop_vdd", "worst drop, supply net", "percent"), ("drop_vss", "worst drop, ground net", "percent"),
    ("usage", "routing resource used", "percent"), ("congestion", "congestion reports", "count"),
    ("violations", "routing violations", "count"), ("clock_buffers", "clock buffers", "count"),
    ("used_by", "cited by", ""),
]


# ---- reading one run -------------------------------------------------------

def _last(pattern, text, cast=float):
    hits = re.findall(pattern, text, re.M)
    return cast(hits[-1]) if hits else None


def measure(log: str, rpt: str) -> dict:
    """Every number the dataset publishes, each from the line that printed it."""
    drops = re.findall(r"Percentage drop\s*:\s*([\d.]+)", log)
    usage = re.findall(r"^Total\s+\d+\s+\d+\s+([\d.]+)%", log, re.M)
    power = _last(r"Total power\s+:\s+([\d.e+-]+)", log)
    return {
        "clock": _last(r"FLW-0007\] clock \S+ period ([\d.]+)", log),
        "instances": _last(r"IFP-0105\] Number of instances:\s+(\d+)", log, int),
        "area": _last(r"Design area (\d+) um\^2", log, int),
        "utilization": _last(r"Design area \d+ um\^2 (\d+)% utilization", log, int),
        # the detailed router's figure, printed last; global routing prints an estimate earlier
        "wire": _last(r"Total wire length = (\d+) um", log, int),
        # the virtual clock also reports a period_min of 0.00, so it is excluded by name
        "floor": _last(r"^(?!vclk_)\S+ period_min = ([\d.]+)", rpt),
        # report_wns clamps at zero; worst_slack carries the margin of a passing design
        "slack": _last(r"worst slack max (-?[\d.]+)", rpt),
        "tns": _last(r"tns max (-?[\d.]+)", rpt),
        "power": round(power * 1000, 2) if power is not None else None,
        "drop_vdd": float(drops[0]) if drops else None,
        "drop_vss": float(drops[1]) if len(drops) > 1 else None,
        "usage": float(usage[-1]) if usage else None,
        "congestion": log.count("GRT-0101") + log.count("GPL-0089") if log else None,
        "violations": _last(r"DRT-0199\]\s+Number of violations = (\d+)", log, int),
        "clock_buffers": _last(r"CTS-0018\]\s+Created (\d+) clock buffers", log, int),
    }


def complete(m: dict) -> bool:
    """A run counts only if it reached the end: routed, reported and timed."""
    return all(m.get(k) is not None for k in ("area", "wire", "floor", "slack", "violations"))


# ---- what each run changed -------------------------------------------------

_SDC = re.compile(r"SDC_FILE=\$\(sdc \S+ \S+ \S+ ([\d.]+)(?: ([\d.]+))?\)")


def launch_lines() -> dict:
    """label -> (platform, design, {variable: value}) from the scripts that ran them.

    Several scripts relaunched the same run after an interruption; the
    settings are identical, so the last definition read is kept."""
    runs = {}
    scripts = sorted(SOURCES["whatif-src"].glob("run*.sh")) + [SOURCES["pathology-src"] / "run.sh"]
    for script in scripts:
        if not script.exists():
            continue
        for line in script.read_text().splitlines():
            line = line.strip()
            if not line.startswith("run ") or line.startswith("run ()"):
                continue
            line = line.split(";;")[0]
            line = _SDC.sub(lambda m: "CLOCK=%s%s" % (m.group(1), " IO_FRACTION=%s" % m.group(2) if m.group(2) else ""), line)
            parts = shlex.split(line)
            label, platform, design = parts[1], parts[3], parts[4]
            changes = dict(p.split("=", 1) for p in parts[5:] if "=" in p)
            for key, value in list(changes.items()):
                if value.startswith("/out/"):          # a file shipped alongside the runs
                    changes[key] = value[len("/out/"):]
            runs[label] = (platform, design, changes)
    return runs


def citations() -> dict:
    """label -> the drill items whose source line names it."""
    cited = {}
    sources = [("app/game_choices/whatif.yaml", "/games/what-if"),
               ("app/game_images/pathology.yaml", "/games/spot-the-pathology")]
    for path, href in sources:
        data = yaml.safe_load((ROOT / path).read_text())
        for item in data.get("items", []):
            for label in re.split(r"[,\s]+|\bagainst\b", str(item.get("source", ""))):
                label = label.strip()
                if label:
                    cited.setdefault(label, []).append({"id": item["id"], "href": href})
    return cited


# ---- the manifest ----------------------------------------------------------

def build_manifest() -> dict:
    launched, cited = launch_lines(), citations()
    runs, skipped = [], []
    for folder, path in SOURCES.items():
        for log_path in sorted(path.glob("*.log")):
            label = log_path.stem
            if label not in launched:
                continue                                   # driver logs and scratch files
            platform, design, changes = launched[label]
            rpt_path = path / label / "6_finish.rpt"
            log = log_path.read_text(errors="replace")
            rpt = rpt_path.read_text(errors="replace") if rpt_path.exists() else ""
            m = measure(log, rpt)
            if not complete(m):
                skipped.append(label)
                continue
            reports = sorted(p.name for p in (path / label).glob("*") if p.suffix in SERVABLE) if (path / label).is_dir() else []
            runs.append(dict(
                label=label, folder=folder, design=design, platform=platform,
                platform_name=PLATFORM_NAMES.get(platform, platform),
                time_unit=TIME_UNIT.get(platform, "ns"), changes=changes,
                used_by=cited.get(label, []), log="%s/%s.log" % (folder, label),
                reports=["%s/%s/%s" % (folder, label, r) for r in reports], **m))
    runs.sort(key=lambda r: (r["design"], r["platform"], bool(r["changes"]), r["label"]))
    return {
        "built": time.strftime("%Y-%m-%d"),
        "tool": "OpenROAD-flow-scripts in the openroad/orfs container (OpenROAD 26Q3)",
        "columns": [{"key": k, "label": l, "unit": u} for k, l, u in COLUMNS],
        "runs": runs,
        "skipped": sorted(skipped),
        "archive": ARCHIVE,
    }


def _csv(manifest: dict) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf)
    keys = [c["key"] for c in manifest["columns"]] + ["time_unit", "log"]
    writer.writerow(keys)
    for run in manifest["runs"]:
        row = []
        for key in keys:
            value = run.get(key)
            if key == "changes":
                value = "; ".join("%s=%s" % kv for kv in value.items())
            elif key == "used_by":
                value = "; ".join(u["id"] for u in value)
            row.append("" if value is None else value)
        writer.writerow(row)
    return buf.getvalue()


README = """# Chipbase OpenROAD runs

{n} complete runs of the open physical design flow, OpenROAD-flow-scripts, in
the openroad/orfs container (OpenROAD 26Q3). They are the runs behind the
"Your move" and "Read the die" drills on the Chipbase site, published so that
anybody can check a number or use the runs for something else.

## What is in the archive

- `runs.json` and `runs.csv`: one row per run. Design, platform, every setting
  changed from the flow's defaults, and the measured results.
- `whatif-src/` and `pathology-src/`: for each run, the full log
  (`<run>.log`) and the reports the flow wrote (`<run>/*.rpt`), plus the
  rendered maps for the pathology runs.
- `run*.sh` and `run_pathology.sh`: the scripts that launched the runs, one
  container per group.
- `thin_grid.tcl`, `thin_grid_gcd.tcl`, `dense_grid.tcl`: the modified power
  grids some runs used. Each is the platform's or the design's own file with
  strap widths or pitches changed, and says what changed at the top.
  `gcd_grid_original.tcl` is the unmodified file, for comparison.
- `dataset.py`: the code that read every number out of the logs and built
  this archive, so any value can be checked by running it again.

## How the numbers were read

Every value comes from the line of the log or the final report that printed
it. Nothing is typed from memory, and a value a run never printed is left
empty rather than set to zero.

- **Wire** is the detailed router's routed length, printed last. Global
  routing prints an estimate earlier that can differ by more than a quarter.
- **Smallest period** is `period_min` for the real clock. The virtual clock
  the constraints create also reports one, always zero, and is excluded.
- **Worst setup slack** is `report_worst_slack`, because `report_wns` clamps
  at zero and hides the margin of a design that passes.
- **Worst drop** is reported for both the supply and the ground net. The map
  the flow saves is drawn on the ground net.
- **Congestion reports** counts two messages: global routing running extra
  iterations to clear congestion, and the placer failing its routability
  target.
- **Time** is in picoseconds on ASAP7 and nanoseconds elsewhere.

## Two properties worth knowing

The flow is deterministic here. Two independent runs of ibex, in different
containers on different days, agreed on every published metric to the last
digit, so a small difference between two runs is a real difference.

Most runs change one setting against a baseline of the same design with no
changes, which makes the set usable for sensitivity studies: the effect of
one knob, with everything else held.

## What is not in it

Runtime. Runs were executed in parallel on one machine, so wall-clock time
would measure the scheduler rather than the run.

{skipped}
"""


def build(verbose=True):
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = build_manifest()
    skipped = ("Runs that did not finish are left out: " + ", ".join(manifest["skipped"]) + ".") \
        if manifest["skipped"] else "Every launched run finished and is included."
    readme = README.format(n=len(manifest["runs"]), skipped=skipped)
    (OUT / "runs.json").write_text(json.dumps(manifest, indent=1))
    (OUT / "runs.csv").write_text(_csv(manifest))
    (OUT / "README.md").write_text(readme)

    with tarfile.open(OUT / ARCHIVE, "w:gz") as tar:
        base = "chipbase-openroad-runs"
        for name in ("runs.json", "runs.csv", "README.md"):
            tar.add(OUT / name, arcname="%s/%s" % (base, name))
        for extra in sorted(SOURCES["whatif-src"].glob("*.sh")) + sorted(SOURCES["whatif-src"].glob("*.tcl")):
            tar.add(extra, arcname="%s/%s" % (base, extra.name))
        tar.add(Path(__file__), arcname="%s/dataset.py" % base)
        tar.add(SOURCES["pathology-src"] / "run.sh", arcname="%s/run_pathology.sh" % base)
        for run in manifest["runs"]:
            folder = SOURCES[run["folder"]]
            tar.add(folder / ("%s.log" % run["label"]), arcname="%s/%s" % (base, run["log"]))
            if (folder / run["label"]).is_dir():
                tar.add(folder / run["label"], arcname="%s/%s/%s" % (base, run["folder"], run["label"]))
    if verbose:
        size = (OUT / ARCHIVE).stat().st_size / 1e6
        print("%d runs, %d skipped, archive %.1f MB" % (len(manifest["runs"]), len(manifest["skipped"]), size))
    return manifest


# ---- used by the web page --------------------------------------------------

def load() -> dict | None:
    path = OUT / "runs.json"
    return json.loads(path.read_text()) if path.exists() else None


def resolve_file(rel: str) -> Path | None:
    """The file behind /data/files/<rel>, or None if it is not one we publish."""
    rel = rel.strip("/")
    head = rel.split("/", 1)[0]
    base = OUT if head == "dataset" else SOURCES.get(head)
    if base is None:
        return None
    target = (base / rel.split("/", 1)[1]).resolve() if "/" in rel else None
    if target is None or not target.is_file() or target.suffix not in SERVABLE:
        return None
    if base.resolve() not in target.parents:
        return None
    return target


if __name__ == "__main__":
    if sys.argv[1:] == ["build"]:
        build()
    else:
        print(__doc__)
