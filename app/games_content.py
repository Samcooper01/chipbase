"""Games hub content: fast-feedback drills that train the knowledge around the
problem ladder. Each drill trains a different skill a physical designer uses.
Descriptions follow GAMES.md at the project root; `live` flips to True when a
drill's page is built, and `href` then points at it."""

GAMES = [
    {
        "id": "flash-cards",
        "title": "Command flash cards",
        "trains": "recall",
        "summary": "A card asks for one thing: what a command does, which "
        "command does it, what a line of a report is telling you, what is "
        "wrong with the line, what is missing from it, or what order the "
        "steps go in. Cards you miss return sooner and cards you know return "
        "later, on a spaced-repetition schedule.",
        "example": "set_clock_uncertainty -setup 0.15 [get_clocks clk]",
        "live": True,
        "href": "/games/flash-cards",
    },
    {
        "id": "log-forensics",
        "title": "Log forensics",
        "trains": "diagnosis",
        "summary": "The tail of a tool log is shown, ending in an error or a "
        "suspicious warning; pick the root cause or the correct next action.",
        "example": "a placement run that stops at a site mismatch",
        "live": True,
        "href": "/games/log-forensics",
    },
    {
        "id": "over-under",
        "title": "Call the number",
        "trains": "estimation",
        "summary": "A design summary is shown (cell count, core size, clock "
        "target); say whether a quality metric lands over or under a stated "
        "value.",
        "example": "is WNS (Worst Negative Slack) above zero?",
        "live": True,
        "href": "/games/over-under",
    },
    {
        "id": "what-if",
        "title": "Your move",
        "trains": "judgement",
        "summary": "A design is in a particular state and something has to "
        "change; pick the change you would make, then see what each option "
        "actually did, because every one of them was run.",
        "example": "the block misses 0.40 nanoseconds: give it area, or give it back the interface budget?",
        "live": True,
        "href": "/games/what-if",
    },
    {
        "id": "spot-the-pathology",
        "title": "Read the die",
        "trains": "perception",
        "summary": "A layout or heat-map image is shown; name the problem it "
        "contains.",
        "example": "a congestion hotspot, a clock-tree blowup, a density cliff",
        "live": True,
        "href": "/games/spot-the-pathology",
    },
]


# --- Flash-card categories ---------------------------------------------------

# Card categories on /games/flash-cards. A live category has a deck file at
# game_decks/<id>.yaml; the rest are listed as planned.
# Groups the deck tiles are shown under, in order.
FLASH_DECK_GROUPS = [
    ("fundamentals", "Fundamentals",
     "The ideas the rest of it rests on, independent of any tool."),
    ("constraints", "Constraints and timing",
     "What the design is asked to do, and how the timer reports whether it does it."),
    ("flow", "The open flow",
     "Driving OpenROAD and its reference flow: the commands, and the variables that steer them."),
    ("technology", "Technology and sign-off",
     "The library a design is built from, and the checks it must pass to be manufactured."),
    ("formats", "File formats",
     "The files a design travels in: what each one carries and how to read it."),
    ("scripting", "Scripting",
     "The language the tools are driven with."),
]

FLASH_DECKS = [
    {
        "id": "fundamentals",
        "group": "fundamentals",
        "title": "PD fundamentals",
        "blurb": "The reasoning behind physical design rather than any tool's "
        "commands: how a check is formed, what skew and variation do to it, and "
        "what the physical effects cost.",
        "live": True,
    },
    {
        "id": "liberty",
        "group": "formats",
        "title": "Liberty timing libraries",
        "blurb": "The format that carries a library's timing and power: units, "
        "cell and pin groups, timing arcs and their conditions, delay tables, "
        "checks, and leakage.",
        "live": True,
    },
    {
        "id": "formats",
        "group": "formats",
        "title": "Layout and parasitic formats",
        "blurb": "LEF (Library Exchange Format), DEF (Design Exchange Format), "
        "SPEF (Standard Parasitic Exchange Format), and SDF (Standard Delay "
        "Format): which file answers which question.",
        "live": True,
    },
    {
        "id": "signoff",
        "group": "technology",
        "title": "Sign-off checks and violations",
        "blurb": "The checks a design must pass before tapeout: geometric rules, "
        "layout versus schematic, antenna and electrical rules, density and "
        "fill, and what each violation means.",
        "live": True,
    },
    {
        "id": "tcl",
        "group": "scripting",
        "title": "TCL for physical design",
        "blurb": "The scripting language every place-and-route and timing tool "
        "embeds: lists, procedures, patterns, files, and the patterns that make "
        "a flow script different from ordinary Tcl.",
        "live": True,
    },
    {
        "id": "cells",
        "group": "technology",
        "title": "Standard-cell library",
        "blurb": "What is in the library a design is built from: cell naming and "
        "drive strength, compound gates, sequential and clock cells, the "
        "physical-only cells, and the views each stage reads.",
        "live": True,
    },
    {
        "id": "sdc",
        "group": "constraints",
        "title": "SDC (Synopsys Design Constraints)",
        "blurb": "The constraint commands that define clocks, boundary timing, "
        "timing exceptions, and design rules for static timing analysis, as "
        "implemented and documented by OpenSTA.",
        "live": True,
    },
    {
        "id": "openroad",
        "group": "flow",
        "title": "OpenROAD flow commands",
        "blurb": "The commands that read a design, floorplan it, build its power "
        "grid, place, build the clock tree, route, and write it back out, plus "
        "test, power intent, packaging, and the checks between stages.",
        "live": True,
    },
    {
        "id": "timing-reports",
        "group": "constraints",
        "title": "Timing reports",
        "blurb": "OpenSTA's timing-report commands and their options, such as "
        "report_checks and report_clock_skew, and how to read the reports they "
        "print, using real output.",
        "live": True,
    },
    {
        "id": "orfs",
        "group": "flow",
        "title": "OpenROAD-flow-scripts variables",
        "blurb": "The make variables that steer a run of the reference flow, "
        "from the sources and the technology through utilization, density, "
        "routing layers, timing margins, and the files it writes.",
        "live": True,
    },
]


# --- Drill pages -------------------------------------------------------------

import html
import json
import re
from pathlib import Path

import yaml

DECK_DIR = Path(__file__).resolve().parent / "game_decks"
MIXED = "all"  # URL segment of the round that draws from every section


def load_deck(name: str) -> dict:
    """Read one flash-card deck (game_decks/<name>.yaml). Attaches each card's
    documentation link, its section title, and an HTML version of its
    explanation, and each section's card count."""
    deck = yaml.safe_load((DECK_DIR / f"{name}.yaml").read_text(encoding="utf-8"))
    titles = {sec["id"]: sec["title"] for sec in deck.get("sections", [])}
    # how a card's `source` becomes a link: an anchor on the reference page
    # (the default), or a path under it (one directory per module)
    join = deck.get("source_link", "anchor")
    # decks whose cards show file text rather than a command ask their own
    # question instead of the engine's default ("What does this command do?")
    default_q = deck.get("default_question")
    for card in deck["cards"]:
        # a card with its own style asks its own question, not the deck's
        if default_q and not card.get("question") and not card.get("style"):
            card["question"] = default_q
        sep = "/" if join == "path" else "#"
        card["href"] = f"{deck['reference']}{sep}{card['source']}" if card.get("source") else deck["reference"]
        card["topic"] = titles.get(card.get("section"), "")
        card["explain_html"] = re.sub(r"`([^`]+)`", r"<code>\1</code>", html.escape(card.get("explain", "")))
    for sec in deck.get("sections", []):
        in_sec = [c for c in deck["cards"] if c.get("section") == sec["id"]]
        sec["count"] = len(in_sec)
        # the shapes beyond the plain command card, named on the section tile
        sec["styles"] = [s for s in ("reading", "reverse", "bug", "blank", "order")
                         if any((c.get("style") or ("reading" if c.get("excerpt") else "command")) == s
                                for c in in_sec)]
    return deck


# what each card style asks of the player, for the line above the card
STYLE_NOTES = {
    "command": "a command to explain",
    "reading": "real tool output to read",
    "reverse": "a description whose command you name",
    "bug": "a snippet with a fault to find",
    "blank": "a command with a gap to fill",
    "order": "steps to put in order",
}


# the same names, short, for the chips on a section tile
STYLE_CHIPS = {
    "reading": "read the output",
    "reverse": "name the command",
    "bug": "find the fault",
    "blank": "fill the gap",
    "order": "put in order",
}


def styles_note(cards) -> str:
    """One sentence naming the kinds of card in this round."""
    seen = []
    for card in cards:
        style = card.get("style") or ("reading" if card.get("excerpt") else "command")
        if style not in seen:
            seen.append(style)
    parts = [STYLE_NOTES[s] for s in seen if s in STYLE_NOTES]
    if len(parts) == 1:
        return f"Each card shows {parts[0]}."
    return "The cards come in more than one shape: " + ", ".join(parts[:-1]) + ", and " + parts[-1] + "."


CASE_DIR = Path(__file__).resolve().parent / "game_logs"


def load_forensics() -> dict:
    """Read the log-forensics cases (game_logs/forensics.yaml). Each case is a
    real log tail with a question about it, and is played through the same
    engine as a flash card."""
    data = yaml.safe_load((CASE_DIR / "forensics.yaml").read_text(encoding="utf-8"))
    # the flash-card engine keys browser progress on this; without it every
    # case was being saved under "pdleet-fc-undefined"
    data["deck"] = "log-forensics"
    titles = {sec["id"]: sec["title"] for sec in data.get("sections", [])}
    for case in data["cards"]:
        case["href"] = f"{data['reference']}#{case['source']}" if case.get("source") else data["reference"]
        # the chip on the card names the stage whose log this is, since the
        # section is already the page's heading
        case["topic"] = case.get("stage") or titles.get(case.get("section"), "")
        case["explain_html"] = re.sub(r"`([^`]+)`", r"<code>\1</code>", html.escape(case.get("explain", "")))
    for sec in data.get("sections", []):
        sec["count"] = sum(1 for c in data["cards"] if c.get("section") == sec["id"])
    return data


def _json(obj) -> str:
    """JSON safe to embed inside a <script> element."""
    return json.dumps(obj).replace("</", "<\\/")


def page_context(path: str):
    """Template context for the drill page at /games/<path>, or None.

    flash-cards                    -> pick a card category
    flash-cards/<deck>             -> pick a section of that deck
    flash-cards/<deck>/<section>   -> play that section's cards
    """
    parts = [p for p in path.strip("/").split("/") if p]
    if parts and parts[0] == "log-forensics":
        return forensics_context(parts)
    if parts and parts[0] == "contribute":
        return contribute_context(parts)
    if parts and parts[0] == "over-under":
        return overunder_context(parts)
    if parts and parts[0] == "spot-the-pathology":
        return pathology_context(parts)
    if parts and parts[0] == "what-if":
        return whatif_context(parts)
    if not parts or parts[0] != "flash-cards" or len(parts) > 3:
        return None
    game = next(g for g in GAMES if g["id"] == "flash-cards")
    if len(parts) == 1:
        groups = []
        for gid, title, blurb in FLASH_DECK_GROUPS:
            decks = []
            for meta in FLASH_DECKS:
                if meta.get("group") != gid:
                    continue
                entry = dict(meta)
                if meta["live"]:
                    deck = load_deck(meta["id"])
                    entry["cards"] = len(deck["cards"])
                    entry["sections"] = sum(
                        1 for sec in deck.get("sections", [])
                        if any(c.get("section") == sec["id"] for c in deck["cards"])
                    )
                decks.append(entry)
            if decks:
                groups.append({"title": title, "blurb": blurb, "decks": decks})
        return {"template": "games_fc_decks.html", "game": game, "groups": groups,
                "total": sum(d.get("cards", 0) for g in groups for d in g["decks"])}
    meta = next((d for d in FLASH_DECKS if d["id"] == parts[1] and d["live"]), None)
    if meta is None:
        return None
    deck = load_deck(meta["id"])
    if len(parts) == 2:
        return {"template": "games_fc_sections.html", "game": game, "meta": meta, "deck": deck,
                "style_names": STYLE_CHIPS, "total": len(deck["cards"])}
    if parts[2] == MIXED:
        # Every section at once; new cards are shuffled across sections.
        section = {"id": MIXED, "title": "All sections", "count": len(deck["cards"])}
        play = deck
    else:
        section = next((s for s in deck.get("sections", []) if s["id"] == parts[2]), None)
        if section is None or not section["count"]:
            return None
        play = dict(deck, cards=[c for c in deck["cards"] if c.get("section") == section["id"]])
    return {"template": "games_flashcards.html", "game": game, "meta": meta, "deck": deck,
            "section": section, "play": play, "deck_json": _json(play),
            "styles_note": styles_note(play["cards"]), "mixed": section["id"] == MIXED}


METRIC_DIR = Path(__file__).resolve().parent / "game_metrics"


def load_overunder() -> dict:
    """Read the over/under summaries (game_metrics/overunder.yaml). Each one is
    a real run, a question about one of its metrics, and the measured value."""
    data = yaml.safe_load((METRIC_DIR / "overunder.yaml").read_text(encoding="utf-8"))
    titles = {sec["id"]: sec["title"] for sec in data.get("sections", [])}
    for item in data["items"]:
        item["answer"] = "over" if item["value"] > item["threshold"] else "under"
        item["topic"] = titles.get(item.get("section"), "")
        item["href"] = data["reference"]
        item["explain_html"] = re.sub(r"`([^`]+)`", r"<code>\1</code>", html.escape(item.get("explain", "")))
    for sec in data.get("sections", []):
        sec["count"] = sum(1 for i in data["items"] if i.get("section") == sec["id"])
    return data


IMAGE_DIR = Path(__file__).resolve().parent / "game_images"


CHOICE_DIR = Path(__file__).resolve().parent / "game_choices"


def load_whatif() -> dict:
    """Read the what-happens-if situations (game_choices/whatif.yaml). Each
    option carries the outcome a real run produced, and the best option is
    worked out from those numbers rather than written down."""
    data = yaml.safe_load((CHOICE_DIR / "whatif.yaml").read_text(encoding="utf-8"))
    titles = {sec["id"]: sec["title"] for sec in data.get("sections", [])}
    for item in data["items"]:
        obj = item["objective"]
        key, direction = obj["metric"], obj.get("direction", "min")
        tie = obj.get("tiebreak")

        def wins(candidate, champion, metric=key, way=direction):
            new, old = candidate["outcome"].get(metric), champion["outcome"].get(metric)
            if new is None:
                return False
            if old is None:
                return True
            return new > old if way == "max" else new < old

        best = None
        for opt in item["options"]:
            if best is None:
                best = opt
            elif wins(opt, best):
                best = opt
            elif tie and opt["outcome"].get(key) == best["outcome"].get(key) \
                    and wins(opt, best, tie["metric"], tie.get("direction", "min")):
                best = opt
        # a tie on the objective with nothing to break it would make the answer
        # a matter of ordering, so say so rather than grading on luck
        joint = [o for o in item["options"]
                 if o["outcome"].get(key) == best["outcome"].get(key)] if best else []
        if len(joint) > 1 and not tie:
            raise ValueError(
                "what-if item %s ties on %s with no tiebreak: %s"
                % (item["id"], key, ", ".join(o["id"] for o in joint)))
        item["best"] = best["id"] if best else None
        item["topic"] = titles.get(item.get("section"), "")
        item["explain_html"] = re.sub(r"`([^`]+)`", r"<code>\1</code>", html.escape(item.get("explain", "")))
    for sec in data.get("sections", []):
        sec["count"] = sum(1 for i in data["items"] if i.get("section") == sec["id"])
    return data


def load_pathology() -> dict:
    """Read the spot-the-pathology maps (game_images/pathology.yaml). Each item
    names an image the flow rendered, and the run that produced it."""
    data = yaml.safe_load((IMAGE_DIR / "pathology.yaml").read_text(encoding="utf-8"))
    data["image_base"] = "/static/games/pathology/"
    titles = {sec["id"]: sec["title"] for sec in data.get("sections", [])}
    for item in data["items"]:
        item["topic"] = titles.get(item.get("section"), "")
        item["explain_html"] = re.sub(r"`([^`]+)`", r"<code>\1</code>", html.escape(item.get("explain", "")))
    for sec in data.get("sections", []):
        sec["count"] = sum(1 for i in data["items"] if i.get("section") == sec["id"])
    return data


def hub_totals():
    """Numbers for the Games header. Counted from the content, never typed in,
    so the header cannot drift away from what is actually on the site."""
    decks = [load_deck(d["id"]) for d in FLASH_DECKS if d["live"]]
    pathology = load_pathology()
    maps = set()
    for item in pathology["items"]:
        maps |= set([item["image"]] if item.get("image") else item["images"].values())
    return {
        "questions": (sum(len(d["cards"]) for d in decks)
                      + len(load_forensics()["cards"])
                      + len(load_overunder()["items"])
                      + len(load_whatif()["items"])
                      + len(pathology["items"])),
        "maps": len(maps),
        "logs": len(load_forensics()["cards"]),
    }


def hub_games():
    """The drills for the Games hub, each with a line of its current size."""
    games = [dict(g) for g in GAMES]
    for game in games:
        if game["id"] == "flash-cards":
            decks = [load_deck(d["id"]) for d in FLASH_DECKS if d["live"]]
            game["stat"] = "%d cards in %d decks" % (
                sum(len(d["cards"]) for d in decks), len(decks))
        elif game["id"] == "log-forensics":
            data = load_forensics()
            game["stat"] = "%d cases in %d stages" % (
                len(data["cards"]), len(data["sections"]))
        elif game["id"] == "over-under":
            data = load_overunder()
            game["stat"] = "%d summaries in %d families" % (
                len(data["items"]), len(data["sections"]))
        elif game["id"] == "what-if":
            data = load_whatif()
            game["stat"] = "%d situations in %d kinds" % (
                len(data["items"]), len(data["sections"]))
        elif game["id"] == "spot-the-pathology":
            data = load_pathology()
            game["stat"] = "%d maps in %d families" % (
                len(data["items"]), len(data["sections"]))
    return games


def forensics_context(parts):
    """Template context for the log-forensics drill.

    log-forensics             -> pick a stage
    log-forensics/<section>   -> work through that stage's cases
    """
    if len(parts) > 2:
        return None
    game = next(g for g in GAMES if g["id"] == "log-forensics")
    data = load_forensics()
    if len(parts) == 1:
        # the stages, gathered under the kind of thing that went wrong
        groups = []
        for grp in data.get("groups", []):
            stages = [s for s in data["sections"] if s.get("group") == grp["id"]]
            if stages:
                groups.append(dict(grp, stages=stages,
                                   cases=sum(s["count"] for s in stages)))
        return {"template": "games_lf_sections.html", "game": game, "data": data,
                "groups": groups, "total": len(data["cards"])}
    if parts[1] == MIXED:
        section = {"id": MIXED, "title": "Every stage", "count": len(data["cards"])}
        play = data
    else:
        section = next((s for s in data.get("sections", []) if s["id"] == parts[1]), None)
        if section is None or not section["count"]:
            return None
        play = dict(data, cards=[c for c in data["cards"] if c.get("section") == section["id"]])
    return {"template": "games_lf_play.html", "game": game, "data": data, "section": section,
            "play": play, "deck_json": _json(play), "mixed": section["id"] == MIXED}


def overunder_context(parts):
    """Template context for the over/under drill.

    over-under            -> pick a family of metrics
    over-under/<section>  -> call that family's summaries
    """
    if len(parts) > 2:
        return None
    game = next(g for g in GAMES if g["id"] == "over-under")
    data = load_overunder()
    if len(parts) == 1:
        return {"template": "games_ou_sections.html", "game": game, "data": data,
                "total": len(data["items"])}
    if parts[1] == MIXED:
        section = {"id": MIXED, "title": "Every metric", "count": len(data["items"])}
        play = data
    else:
        section = next((s for s in data.get("sections", []) if s["id"] == parts[1]), None)
        if section is None or not section["count"]:
            return None
        play = dict(data, items=[i for i in data["items"] if i.get("section") == section["id"]])
    return {"template": "games_ou_play.html", "game": game, "data": data, "section": section,
            "play": play, "data_json": _json(play), "mixed": section["id"] == MIXED}


# What a suggestion can be about. The label is what the issue records.
IDEA_KINDS = [
    ("drill", "A whole drill that does not exist yet"),
    ("question", "A question for a drill that does exist"),
    ("topic", "A topic the drills never ask about"),
    ("wrong", "Something already here that is wrong"),
]


def contribute_context(parts):
    """Template context for /games/contribute, the page for asking for a drill
    or sending a question. The form opens a GitHub issue on the site's
    repository; nothing sent reaches the content files by itself, and a
    question only goes live once its answer can be checked against a run."""
    if len(parts) > 1:
        return None
    return {"template": "games_contribute.html",
            "kinds": IDEA_KINDS,
            "drills": [{"id": g["id"], "title": g["title"]} for g in GAMES if g["live"]],
            "game": {"title": "Suggest a drill", "href": "/games/contribute"}}


def pathology_context(parts):
    """Template context for the spot-the-pathology drill.

    spot-the-pathology            -> pick a family of maps
    spot-the-pathology/<section>  -> read that family's maps
    """
    if len(parts) > 2:
        return None
    game = next(g for g in GAMES if g["id"] == "spot-the-pathology")
    data = load_pathology()
    if len(parts) == 1:
        return {"template": "games_pa_sections.html", "game": game, "data": data,
                "total": len(data["items"])}
    if parts[1] == MIXED:
        section = {"id": MIXED, "title": "Every map", "count": len(data["items"])}
        play = data
    else:
        section = next((s for s in data.get("sections", []) if s["id"] == parts[1]), None)
        if section is None or not section["count"]:
            return None
        play = dict(data, items=[i for i in data["items"] if i.get("section") == section["id"]])
    return {"template": "games_pa_play.html", "game": game, "data": data, "section": section,
            "play": play, "data_json": _json(play), "mixed": section["id"] == MIXED}


def whatif_context(parts):
    """Template context for the what-happens-if drill.

    what-if            -> pick a kind of situation
    what-if/<section>  -> work through that kind
    """
    if len(parts) > 2:
        return None
    game = next(g for g in GAMES if g["id"] == "what-if")
    data = load_whatif()
    if len(parts) == 1:
        return {"template": "games_wi_sections.html", "game": game, "data": data,
                "total": len(data["items"])}
    if parts[1] == MIXED:
        section = {"id": MIXED, "title": "Every situation", "count": len(data["items"])}
        play = data
    else:
        section = next((s for s in data.get("sections", []) if s["id"] == parts[1]), None)
        if section is None or not section["count"]:
            return None
        play = dict(data, items=[i for i in data["items"] if i.get("section") == section["id"]])
    return {"template": "games_wi_play.html", "game": game, "data": data, "section": section,
            "play": play, "data_json": _json(play), "mixed": section["id"] == MIXED}
