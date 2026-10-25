"""The site's glossary, read from its own page, so the tutor's definitions are
the same ones the learner sees on the site."""

import re
from html.parser import HTMLParser

from . import pages

_cache = {}


class _Glossary(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.terms, self.cur, self.field = [], None, None

    def handle_starttag(self, tag, attrs):
        cls = dict(attrs).get("class", "") or ""
        if tag == "article" and "gl-term" in cls:
            self.cur = {"term": "", "expansion": "", "definition": "", "id": dict(attrs).get("id", "")}
        elif self.cur is not None:
            if tag == "h3":
                self.field = "term"
            elif "gl-exp" in cls:
                self.field = "expansion"
            elif "gl-def" in cls:
                self.field = "definition"

    def handle_endtag(self, tag):
        if tag == "article" and self.cur is not None:
            self.cur = {k: re.sub(r"\s+", " ", v).strip() for k, v in self.cur.items()}
            self.terms.append(self.cur)
            self.cur = None
        elif tag in ("h3", "div", "p"):
            self.field = None

    def handle_data(self, data):
        if self.cur is not None and self.field:
            self.cur[self.field] += data


def terms() -> list:
    base = pages.base_url()
    if base not in _cache:
        parser = _Glossary()
        parser.feed(pages.fetch(base + "/glossary"))
        _cache[base] = parser.terms
    return _cache[base]


def _is_acronym(term: str) -> bool:
    return bool(re.fullmatch(r"[A-Z0-9]{2,}[a-z]?", term))


def mentioned_in(text: str, limit: int = 8) -> list:
    """Glossary terms that appear in a passage, longest first so that a phrase
    is preferred over a word inside it."""
    found, taken = [], []
    for t in sorted(terms(), key=lambda t: -len(t["term"])):
        flags = 0 if _is_acronym(t["term"]) else re.I
        m = re.search(r"\b%s\b" % re.escape(t["term"]), text, flags)
        if m and not any(a <= m.start() < b for a, b in taken):
            found.append(t)
            taken.append((m.start(), m.end()))
        if len(found) >= limit:
            break
    return found


def lookup(term: str) -> list:
    q = term.strip().lower()
    all_terms = terms()
    exact = [t for t in all_terms if t["term"].lower() == q or t["expansion"].lower() == q]
    if exact:
        return exact
    return [t for t in all_terms if q in t["term"].lower() or q in t["expansion"].lower()][:5]
