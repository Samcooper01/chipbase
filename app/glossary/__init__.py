"""The glossary: every term and acronym the site uses, defined once.

Definitions live in glossary.yaml. The "appears in" links are worked out here
by searching the site's own reading pages and flash-card decks for each term,
so they follow the content instead of being kept up to date by hand.
"""

import html
import re
from functools import lru_cache
from pathlib import Path

import yaml

HERE = Path(__file__).resolve().parent


def slug(term: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", term.lower()).strip("-")


def _is_acronym(term: str) -> bool:
    return bool(re.fullmatch(r"[A-Z0-9]{2,}[a-z]?", term))


def _text(fragment: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", " ", fragment))


@lru_cache(maxsize=1)
def _corpus():
    """(title, href, text) for every page a term can be found on."""
    from .. import education_content, games_content

    pages = []
    for topic in education_content.TOPICS:
        if topic.get("live"):
            pages.append((topic["name"], "/education/" + topic["slug"], _text(str(topic.get("body", "")))))
    for deck in games_content.FLASH_DECKS:
        if not deck["live"]:
            continue
        try:
            data = games_content.load_deck(deck["id"])
        except Exception:
            continue
        words = []
        for card in data.get("cards", []):
            for key in ("command", "prompt", "answer", "explain", "question", "excerpt"):
                if card.get(key):
                    words.append(str(card[key]))
        pages.append((deck["title"] + " flash cards", "/games/flash-cards/" + deck["id"], " ".join(words)))

    from .. import algo_content, process_content
    for stage_slug, stage in algo_content.STAGES.items():
        for algo in stage["algorithms"]:
            text = " ".join(str(algo.get(k, "")) for k in ("name", "summary", "body"))
            pages.append((algo["name"], "/explore/algorithms/%s/%s" % (stage_slug, algo["slug"]), text))
    for entry in process_content.ENTRIES:
        text = " ".join(str(entry.get(k, "")) for k in ("name", "summary", "body"))
        pages.append((entry["name"], "/explore/processes/" + entry["slug"], text))

    drills = [("game_choices/whatif.yaml", "Your move", "/games/what-if", ("situation", "explain", "caveat")),
              ("game_images/pathology.yaml", "Read the die", "/games/spot-the-pathology", ("question", "answer", "explain", "describe"))]
    for path, title, href, keys in drills:
        data = yaml.safe_load((HERE.parent / path).read_text(encoding="utf-8"))
        text = " ".join(str(item.get(k, "")) for item in data.get("items", []) for k in keys)
        pages.append((title, href, text))
    return pages


def _appears_in(entry: dict, limit: int = 6) -> list:
    needles = entry.get("match") or [entry["term"]]
    found = []
    for title, href, text in _corpus():
        for needle in needles:
            if _is_acronym(needle):
                hit = re.search(r"\b%s\b" % re.escape(needle), text)
            else:
                hit = re.search(r"\b%s\b" % re.escape(needle), text, re.I)
            if hit:
                found.append({"title": title, "href": href})
                break
        if len(found) >= limit:
            break
    return found


@lru_cache(maxsize=1)
def load() -> dict:
    data = yaml.safe_load((HERE / "glossary.yaml").read_text(encoding="utf-8"))
    by_cat = {c["id"]: dict(c, terms=[]) for c in data["categories"]}
    terms = []
    for entry in data["terms"]:
        entry = dict(entry)
        entry["id"] = slug(entry["term"])
        entry["appears_in"] = _appears_in(entry)
        terms.append(entry)
        by_cat[entry["category"]]["terms"].append(entry)
    for cat in by_cat.values():
        cat["terms"].sort(key=lambda t: t["term"].lower())
    letters = sorted({t["term"][0].upper() for t in terms})
    return {"categories": list(by_cat.values()), "terms": sorted(terms, key=lambda t: t["term"].lower()),
            "letters": letters, "count": len(terms)}
