"""Everything on the site, for the front page.

The front page lists every section with what is in it, so a reader can see
the whole site at a glance and click wherever they like. Every count and
every link here is read from the section's own content, so adding a page,
a problem or a drill updates the front page with no edit to it.
"""

import re

from . import (algo_content, challenge_content, education_content, explore, games_content,
               problems, process_content)

# banner wording for a challenge, by slug; a challenge not listed here uses
# the first sentence of its own description
BANNER_TEXT = {
    "cva6-ppa": "Harden the full Gemmini design, an open-source AI "
                "accelerator, from RTL (Register Transfer Level) to GDSII (Graphic Design System II) "
                "with open tools. Entries are scored on clock speed, area and power.",
}

# the open-source tools and process kits the site is built on, for the
# front page's logo row; a kit with no logo is shown as a text mark
BUILT_ON = [
    {"name": "OpenROAD", "img": "logo_openroad.png", "url": "https://github.com/The-OpenROAD-Project/OpenROAD"},
    {"name": "Yosys", "img": "logo_yosys.png", "url": "https://github.com/YosysHQ/yosys"},
    {"name": "KLayout", "img": "logo_klayout.png", "url": "https://www.klayout.de"},
    {"name": "ASAP7", "mark": "7nm", "url": "https://github.com/The-OpenROAD-Project/asap7"},
    {"name": "Chipyard", "img": "logo_chipyard.png", "url": "https://github.com/ucb-bar/chipyard"},
    {"name": "Gemmini", "img": "logo_gemmini.png", "url": "https://github.com/ucb-bar/gemmini"},
]

# names shown on the front page that would otherwise be bare acronyms
DISPLAY = {"ECO": "ECO (Engineering Change Order)"}


def _name(text: str) -> str:
    # "AI" stays bare, as on the challenge page (Sam, 2026-10-22)
    return DISPLAY.get(text, text)


# the Foundry processes page's sections, named in full for the card
_FAMILIES = {"pdk": "Process design kits", "devices": "Devices", "interconnect": "Interconnect",
             "litho": "Lithography", "signoff": "Sign-off", "open": "Open process design kits"}


def _count_by(keys) -> list:
    """(key, how many) in order of first appearance."""
    counts: dict = {}
    for k in keys:
        counts[k] = counts.get(k, 0) + 1
    return list(counts.items())


def catalog() -> dict:
    # ---- read and understand
    topics = [t for t in education_content.TOPICS if t.get("live")]
    education = {
        "title": "Education", "href": "/education", "count": len(topics), "unit": "reference pages",
        "blurb": "One page per topic, covering what a physical design engineer needs to know about it.",
        # each topic page's note is how many sections it has (its "## " headings)
        "items": [{"title": _name(t["name"]), "href": "/education/" + t["slug"],
                   "note": "%d sections" % len(re.findall(r"^## ", t["body"], re.M))} for t in topics],
    }
    stages = list(algo_content.STAGES.items())
    algorithms = {
        "title": "Methods and algorithms", "href": "/explore/algorithms",
        "count": algo_content.total_algo_count(), "unit": "algorithm pages",
        "blurb": "The classic algorithms behind every flow stage: what each does, where it came from, and where it is used.",
        "items": [{"title": s["stage"]["name"] if isinstance(s["stage"], dict) else str(s["stage"]),
                   "href": "/explore/algorithms/" + slug, "note": "%d pages" % len(s["algorithms"])}
                  for slug, s in stages],
    }
    processes = {
        "title": "Foundry processes", "href": "/explore/processes", "count": len(process_content.ENTRIES),
        "unit": "pages",
        "blurb": "What sits underneath the flow: process design kits, cell libraries, metal stacks, variation.",
        # the page's own sections (its family filter), each with its page count,
        # in the order the page lists them
        "items": [{"title": _FAMILIES.get(f, f), "href": "/explore/processes", "note": "%d pages" % n}
                  for f, n in _count_by(e["family"] for e in process_content.ENTRIES)],
    }
    from . import glossary as gloss
    g = gloss.load()
    glossary = {
        "title": "Glossary", "href": "/glossary", "count": g["count"], "unit": "terms",
        "blurb": "Every term and acronym the site uses, defined once and linked to the pages that use it.",
        "items": [{"title": c["title"], "href": "/glossary", "note": "%d" % len(c["terms"])} for c in g["categories"]],
    }

    # ---- try it yourself
    all_problems = problems.load_all()
    probs = {
        "title": "Problems", "href": "/problems", "count": len(all_problems), "unit": "graded problems",
        "blurb": "Small tasks graded like a judge, some by a real OpenROAD run on a real netlist.",
        "items": [{"title": topic, "href": "/problems", "note": "%d" % len(plist)}
                  for topic, plist in problems.grouped_by_topic(all_problems)],
        # filled in by the page from the browser's record of solved problems
        "progress_of": [p.id for p in all_problems],
    }
    # the Sandboxes hub's two boxes: the walkthrough's stages as one line,
    # then each whole design you can take through the flow in the browser
    walks = [e for e in explore.EXPLORABLES if e["live"] and e.get("kind") == "example"]
    designs = [e for e in explore.EXPLORABLES if e["live"] and e.get("kind") == "open"]
    sandboxes = {
        "title": "Sandboxes", "href": "/sandboxes", "count": 1 + len(designs), "unit": "walkthrough and designs",
        "blurb": "One real block walked through every stage of the flow, and whole designs to take through it yourself, in your browser.",
        "items": [{"title": "The OpenROAD flow walkthrough", "href": "/sandboxes", "note": "%d stages" % len(walks)}]
                 + [{"title": e["title"], "href": e["href"], "note": "design"} for e in designs],
    }
    games = {
        "title": "Games", "href": "/games", "count": None, "unit": "",
        "blurb": "Fast drills on the knowledge around the problems, every question built from a real run.",
        "items": [{"title": d["title"], "href": d["href"], "note": d.get("stat", "")} for d in games_content.hub_games() if d["live"]],
    }
    games["count"] = games_content.hub_totals()["questions"]
    games["unit"] = "questions"
    chs = challenge_content.all_challenges()
    challenges = {
        "title": "Challenges", "href": "/challenges", "count": len(chs), "unit": "open" if len(chs) == 1 else "challenges",
        "blurb": "Open design competitions: one design, one score, leaders reproduced from their containers.",
        "items": [{"title": _name(c["title"]), "href": "/challenges", "note": c.get("status", "")} for c in chs],
    }

    # ---- help and records
    from . import dataset
    manifest = dataset.load()
    helpers = [
        {"title": "Tutor", "href": "/tutor", "blurb": "Highlight a passage, copy a reference, and ask your own model about it."},
        {"title": "Progress", "href": "/progress", "blurb": "What you have solved, drilled and walked through, in one place."},
        {"title": "Open data", "href": "/data",
         "blurb": "The %s OpenROAD runs behind the drills, with every log and report." % (len(manifest["runs"]) if manifest else "published")},
    ]

    stats = [
        (len(all_problems), "graded problems"),
        (len(topics), "reference pages"),
        (algo_content.total_algo_count(), "algorithm pages"),
        (games["count"], "drill questions"),
        (len(manifest["runs"]) if manifest else 0, "published runs"),
    ]
    return {
        "groups": [
            {"id": "do", "title": "Try it yourself", "sections": [probs, sandboxes, games]},
            {"id": "read", "title": "Read and understand", "sections": [education, algorithms, processes, glossary]},
        ],
        "helpers": helpers,
        "stats": stats,
        # the open challenge gets its own banner at the top of the page
        "challenge": _banner(chs),
        "built_on": BUILT_ON,
    }


def _banner(chs):
    live = [c for c in chs if c.get("status") == "open"] or chs
    if not live:
        return None
    c = live[0]
    first = BANNER_TEXT.get(c.get("slug")) or re.split(r"(?<=[.!?])\s+", c.get("tagline", "").strip())[0]
    # No entries have been scored yet, so the three places are shown open. The
    # reference flow sits at a figure of merit of exactly 1.000 by definition,
    # because every entry is measured as a ratio against it. When scored
    # entries exist they replace the open places, best first.
    entries = c.get("entries") or []
    podium = sorted(entries, key=lambda e: -e["fom"])[:3]
    podium += [None] * (3 - len(podium))
    return {"title": _name(c["title"]), "blurb": first, "status": c.get("status", ""), "href": "/challenges",
            "more": len(chs) - 1, "podium": podium, "baseline_fom": "1.000"}
