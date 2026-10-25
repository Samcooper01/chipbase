"""Interactive in-browser labs: problems the learner solves by direct
manipulation (drag macros, adjust a floorplan) with instant, transparent
analytical grading. No tools or licenses required.

Each lab is a spec consumed by a reusable JS engine under
static/labs/. This module is the registry."""

from . import labs as _l

LABS = _l.LABS


def get_lab(lab_id: str):
    return LABS.get(lab_id)

