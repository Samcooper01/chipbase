"""Content for the Foundry Processes section of Explore: what the fab
gives a PD (Physical Design) engineer and how it constrains the flow.

Mirrors the algo_content shape (a STAGE dict with families, and a list
of entries with markdown bodies) so the same catalog and detail
templates render it."""

from . import processes as _p

STAGE = _p.STAGE
ENTRIES = _p.ENTRIES


def get_entry(slug: str):
    for i, e in enumerate(ENTRIES):
        if e["slug"] == slug:
            prev_e = ENTRIES[i - 1] if i > 0 else None
            next_e = ENTRIES[i + 1] if i + 1 < len(ENTRIES) else None
            return {"algo": e, "prev": prev_e, "next": next_e}
    return None


def count() -> int:
    return len(ENTRIES)
