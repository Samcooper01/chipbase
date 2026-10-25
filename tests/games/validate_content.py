#!/usr/bin/env python3
"""Check every drill's content against the rules the decks are held to.

Run from the project root:  python3 tests/games/validate_content.py

The rules are the ones that keep the content honest rather than merely
consistent: a question with only one plausible answer teaches nothing, a
correct answer that is visibly the longest can be picked without reading, a
missing hint makes a card all-or-nothing, and an unexpanded acronym is a
private joke. Failures are printed and the exit code is non-zero.
"""

import glob
import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "app"
DASHES = ("—", "–")
ACRONYMS = r"\b(SDC|STA|CTS|PDN|DRC|LVS|GRT|DPL|RSZ|IFP|ABC|LEF|DEF|SPEF|SDF|GDS|GDSII|" \
           r"CDL|OASIS|ECO|NDR|LVF|CCS|NLDM|OCV|ICG|DFT|PDK|EM|IR|ESD|DFM|CMP|PPA|ATPG|TCL|EDA)\b(?!\s*\()"


def fail(bucket, item_id, message):
    bucket.append("%s: %s" % (item_id, message))


def check_choice(item, bucket, *, answer="answer", wrong="wrong", need_hint=True):
    if item.get("style") == "order":
        if len(item.get("items", [])) < 3:
            fail(bucket, item["id"], "ordering item needs at least three steps")
        return
    wrongs = item.get(wrong) or []
    if len(wrongs) != 3:
        fail(bucket, item["id"], "has %d wrong answers, expected 3" % len(wrongs))
    if len(set(wrongs) | {item.get(answer)}) != len(wrongs) + 1:
        fail(bucket, item["id"], "an option is repeated")
    if wrongs and len(str(item.get(answer, ""))) > max(len(w) for w in wrongs) + 10:
        fail(bucket, item["id"], "the correct answer is the longest option")
    if need_hint and not item.get("hint"):
        fail(bucket, item["id"], "has no hint")


def check_prose(item, bucket, keys):
    for key in keys:
        text = item.get(key) or ""
        for dash in DASHES:
            if dash in text:
                fail(bucket, item["id"], "%s contains a dash character" % key)
        for match in re.finditer(ACRONYMS, text):
            fail(bucket, item["id"], "%s has an unexpanded acronym: %s" % (key, match.group()))


def main():
    problems = []

    for path in sorted(glob.glob(str(APP / "game_decks" / "*.yaml"))):
        deck = yaml.safe_load(Path(path).read_text())
        ids = [c["id"] for c in deck["cards"]]
        if len(ids) != len(set(ids)):
            problems.append("%s: duplicate card ids" % Path(path).name)
        sections = {s["id"] for s in deck["sections"]}
        for card in deck["cards"]:
            if card.get("section") not in sections:
                fail(problems, card["id"], "unknown section %r" % card.get("section"))
            check_choice(card, problems)
            check_prose(card, problems, ("answer", "hint", "explain"))

    forensics = yaml.safe_load((APP / "game_logs" / "forensics.yaml").read_text())
    for case in forensics["cards"]:
        check_choice(case, problems)
        check_prose(case, problems, ("answer", "hint", "explain"))
        if case.get("style") != "order" and not case.get("excerpt"):
            fail(problems, case["id"], "a forensics case needs a real log excerpt")

    over = yaml.safe_load((APP / "game_metrics" / "overunder.yaml").read_text())
    calls = [("over" if i["value"] > i["threshold"] else "under") for i in over["items"]]
    if abs(calls.count("over") - calls.count("under")) > max(2, len(calls) // 8):
        problems.append("over-under: the answers are lopsided (%d over, %d under)"
                        % (calls.count("over"), calls.count("under")))
    for item in over["items"]:
        check_prose(item, problems, ("hint", "explain"))
        if item["value"] == item["threshold"]:
            fail(problems, item["id"], "the value equals the threshold, so neither answer is right")

    path_items = yaml.safe_load((APP / "game_images" / "pathology.yaml").read_text())
    for item in path_items["items"]:
        check_prose(item, problems, ("explain", "describe"))
        if not item.get("describe"):
            fail(problems, item["id"], "no written description, so the map is unreadable without sight")
        files = [item["image"]] if item.get("image") else list(item.get("images", {}).values())
        for name in files:
            if not (APP / "static" / "games" / "pathology" / name).exists():
                fail(problems, item["id"], "missing image %s" % name)
        if item["style"] == "name":
            check_choice(item, problems, need_hint=False)
        if item["style"] == "spot":
            for target in item.get("targets", []):
                if not (0 <= target["x"] < target["x"] + target["w"] <= 1
                        and 0 <= target["y"] < target["y"] + target["h"] <= 1):
                    fail(problems, item["id"], "a target falls outside the image")
        if item["style"] == "pair" and item.get("answer") not in {"a", "b"}:
            fail(problems, item["id"], "a pair item must answer a or b")

    whatif = yaml.safe_load((APP / "game_choices" / "whatif.yaml").read_text())
    for item in whatif["items"]:
        check_prose(item, problems, ("explain", "situation"))
        key = item["objective"]["metric"]
        values = [o["outcome"].get(key) for o in item["options"]]
        if any(v is None for v in values):
            fail(problems, item["id"], "an option has no value for the objective")
        best = min(values) if item["objective"].get("direction", "min") == "min" else max(values)
        if values.count(best) > 1 and not item["objective"].get("tiebreak"):
            fail(problems, item["id"], "options tie on the objective with no tiebreak")
        if len(item["options"]) < 3:
            fail(problems, item["id"], "a situation needs at least three options")
        # a value with a comma in it, written unquoted inside a flow mapping,
        # is silently cut in half by the parser and the rest becomes a key
        for row in item.get("start", []):
            if set(row) != {"label", "value"}:
                fail(problems, item["id"],
                     "a start row has stray keys, so a value was cut at a comma: %s"
                     % ", ".join(k for k in row if k not in {"label", "value"}))
        # YAML reads a bare on, off, yes or no as a boolean, so an option
        # called off becomes False and can no longer be matched by its name
        for opt in item["options"]:
            if not isinstance(opt["id"], str):
                fail(problems, item["id"], "option id %r is not a string; quote it or rename it" % opt["id"])
        declared = {m["key"] for m in item.get("metrics", [])}
        for metric in item.get("metrics", []):
            if not set(metric) <= {"key", "label", "unit"}:
                fail(problems, item["id"], "a metric has stray keys: %s" % metric)
        for opt in item["options"]:
            extra = set(opt["outcome"]) - declared
            if extra:
                fail(problems, item["id"],
                     "option %s measures %s, which no column shows"
                     % (opt["id"], ", ".join(sorted(extra))))

    # the glossary: every entry complete, in a real subject, with no dash, and
    # any acronym the glossary defines expanded wherever a definition uses it
    gloss = yaml.safe_load((APP / "glossary" / "glossary.yaml").read_text())
    cats = {c["id"] for c in gloss["categories"]}
    defined = sorted({t["term"] for t in gloss["terms"] if t.get("expansion") and re.fullmatch(r"[A-Z0-9]{2,}", t["term"])},
                     key=len, reverse=True)
    seen_terms = set()
    for t in gloss["terms"]:
        tid = "glossary " + t.get("term", "?")
        for key in ("term", "category", "definition"):
            if not t.get(key):
                fail(problems, tid, "has no %s" % key)
        if t.get("category") not in cats:
            fail(problems, tid, "unknown subject %s" % t.get("category"))
        if t["term"].lower() in seen_terms:
            fail(problems, tid, "is defined twice")
        seen_terms.add(t["term"].lower())
        text = str(t.get("definition", ""))
        if any(d in text for d in DASHES):
            fail(problems, tid, "definition contains a dash character")
        for acro in defined:
            if acro == t["term"]:
                continue
            for m in re.finditer(r"\b%s\b(?!\s*\()" % re.escape(acro), text):
                fail(problems, tid, "uses %s without expanding it" % acro)

    counts = {
        "flash cards": sum(len(yaml.safe_load(Path(p).read_text())["cards"])
                           for p in glob.glob(str(APP / "game_decks" / "*.yaml"))),
        "forensics": len(forensics["cards"]),
        "over / under": len(over["items"]),
        "pathology": len(path_items["items"]),
        "what happens if": len(whatif["items"]),
        "glossary": len(gloss["terms"]),
    }
    for name, n in counts.items():
        print("%-16s %4d items" % (name, n))
    print("%-16s %4d items" % ("total", sum(counts.values())))

    if problems:
        print("\n%d problems:" % len(problems))
        for line in problems:
            print("  " + line)
        return 1
    print("\nall content rules pass")
    return 0


if __name__ == "__main__":
    sys.exit(main())
