"""Aggregator for the per-stage algorithm content modules.

Each stage module exposes STAGE (metadata + family definitions) and
ALGORITHMS (the entries, each carrying markdown body content). Stage
modules are added as they are authored; everything downstream discovers
them through STAGES so a new stage is just a new module import here."""

import importlib

_STAGE_MODULE_NAMES = [
    "synthesis",
    "floorplanning",
    "placement",
    "cts",
    "routing",
    "timing",
    "finishing",
]

STAGES = {}
for _name in _STAGE_MODULE_NAMES:
    try:
        _mod = importlib.import_module(f".{_name}", __name__)
    except ImportError:
        continue
    STAGES[_mod.STAGE["slug"]] = {
        "stage": _mod.STAGE,
        "algorithms": _mod.ALGORITHMS,
    }


def get_stage(slug: str):
    return STAGES.get(slug)


def get_algo(stage_slug: str, algo_slug: str):
    entry = STAGES.get(stage_slug)
    if entry is None:
        return None
    for i, algo in enumerate(entry["algorithms"]):
        if algo["slug"] == algo_slug:
            prev_algo = entry["algorithms"][i - 1] if i > 0 else None
            next_algo = (
                entry["algorithms"][i + 1]
                if i + 1 < len(entry["algorithms"])
                else None
            )
            return {"algo": algo, "prev": prev_algo, "next": next_algo}
    return None


def algo_count(stage_slug: str) -> int:
    entry = STAGES.get(stage_slug)
    return len(entry["algorithms"]) if entry else 0


def total_algo_count() -> int:
    return sum(len(e["algorithms"]) for e in STAGES.values())
