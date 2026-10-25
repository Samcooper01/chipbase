"""Reading a Chipbase page and finding a highlighted passage in it.

A page is fetched as HTML and turned into sections: each heading, the heading
path above it, and the paragraphs under it. A quote is then located in those
paragraphs, first exactly and then approximately, so a reference still
resolves after small edits to the page. Pages that draw their content in the
browser carry that content as JSON inside the HTML, which is searched as a
last resort.
"""

import json
import os
import re
import urllib.parse
import urllib.request
from difflib import SequenceMatcher
from html.parser import HTMLParser

DEFAULT_BASE = "http://127.0.0.1:8888"
BLOCK = {"p", "li", "td", "th", "pre", "blockquote", "dd", "dt", "figcaption", "caption", "tr", "div", "section", "article"}
HEADINGS = {"h1": 1, "h2": 2, "h3": 3, "h4": 4}
SKIP = {"script", "style", "nav", "noscript", "svg", "button", "select", "textarea"}  # never void elements


def base_url() -> str:
    return os.environ.get("CHIPBASE_URL", DEFAULT_BASE).rstrip("/")


def allowed_hosts() -> set:
    hosts = {urllib.parse.urlparse(base_url()).netloc}
    extra = os.environ.get("CHIPBASE_HOSTS", "")
    hosts |= {h.strip() for h in extra.split(",") if h.strip()}
    return hosts


def normalize_url(url: str) -> str:
    """Accept a full address or a site path; refuse anything off the site."""
    url = url.strip().strip("<>()\"'")
    if url.startswith("/"):
        url = base_url() + url
    parts = urllib.parse.urlparse(url)
    if parts.scheme not in ("http", "https"):
        raise ValueError("only http and https addresses can be read")
    if parts.netloc not in allowed_hosts():
        raise ValueError("%s is not a Chipbase address this tutor is configured to read (%s)"
                         % (parts.netloc, ", ".join(sorted(allowed_hosts()))))
    return urllib.parse.urlunparse(parts._replace(fragment=""))


def fetch(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "chipbase-tutor"})
    with urllib.request.urlopen(request, timeout=15) as response:
        return response.read().decode("utf-8", "replace")


class _Reader(HTMLParser):
    """Collects the page title, the headings and the text blocks inside <main>."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title = ""
        self.in_title = False
        self.in_main = 0
        self.skip = 0
        self.json_script = False
        self.json_text = []
        self.heading = None        # (level, [text]) while inside a heading
        self.buf = []
        self.items = []            # ("h", level, text) or ("p", text)

    def _flush(self):
        text = re.sub(r"\s+", " ", "".join(self.buf)).strip()
        if text:
            self.items.append(("p", text))
        self.buf = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "title":
            self.in_title = True
        if tag == "main":
            self.in_main += 1
        if tag == "script" and "json" in (attrs.get("type") or ""):
            self.json_script = True
        if tag in SKIP:
            self.skip += 1
            return
        if not self.in_main or self.skip:
            return
        if tag in HEADINGS:
            self._flush()
            self.heading = (HEADINGS[tag], [])
        elif tag in BLOCK or tag == "br":
            self._flush()

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
        if tag == "script":
            self.json_script = False
        if tag in SKIP:
            self.skip = max(0, self.skip - 1)
            return
        if tag == "main":
            self._flush()
            self.in_main = max(0, self.in_main - 1)
        if not self.in_main or self.skip:
            return
        if tag in HEADINGS and self.heading:
            text = re.sub(r"\s+", " ", "".join(self.heading[1])).strip()
            if text:
                self.items.append(("h", self.heading[0], text))
            self.heading = None
        elif tag in BLOCK:
            self._flush()

    def handle_data(self, data):
        if self.in_title:
            self.title += data
        if self.json_script:
            self.json_text.append(data)
            return
        if not self.in_main or self.skip:
            return
        if self.heading:
            self.heading[1].append(data)
        else:
            self.buf.append(data)


def _json_strings(blobs):
    """Every string inside the page's embedded JSON, for pages drawn in the browser."""
    out = []

    def walk(v):
        if isinstance(v, str):
            if len(v) > 20:
                out.append(re.sub(r"\s+", " ", v).strip())
        elif isinstance(v, dict):
            for x in v.values():
                walk(x)
        elif isinstance(v, list):
            for x in v:
                walk(x)

    for blob in blobs:
        try:
            walk(json.loads(blob))
        except ValueError:
            continue
    return out


def read(url: str) -> dict:
    """The page as a title plus a list of sections."""
    url = normalize_url(url)
    reader = _Reader()
    reader.feed(fetch(url))
    reader._flush()
    title = reader.title.strip()
    sections, trail = [], []
    current = {"heading": "", "level": 0, "trail": [], "paragraphs": []}
    for item in reader.items:
        if item[0] == "h":
            level, text = item[1], item[2]
            if current["paragraphs"] or current["heading"]:
                sections.append(current)
            trail = [t for t in trail if t[0] < level] + [(level, text)]
            current = {"heading": text, "level": level, "trail": [t[1] for t in trail], "paragraphs": []}
        else:
            current["paragraphs"].append(item[1])
    if current["paragraphs"] or current["heading"]:
        sections.append(current)
    h1 = next((s["heading"] for s in sections if s["level"] == 1), "")
    return {"url": url, "title": h1 or re.sub(r"\s*-\s*Chipbase\s*$|^Chipbase\s*-\s*", "", title),
            "sections": sections, "embedded": _json_strings(reader.json_text)}


def _norm(s: str) -> str:
    s = s.lower().replace("’", "'").replace("“", '"').replace("”", '"')
    s = re.sub(r"\s+", " ", s)
    return s.strip(" \"'.,;:")


def locate(page: dict, quote: str) -> dict:
    """Find the quote: section index, paragraph index and how it was matched."""
    q = _norm(quote)
    if not q:
        return {"found": False, "how": "empty quote"}
    for si, sec in enumerate(page["sections"]):
        for pi, para in enumerate(sec["paragraphs"]):
            if q in _norm(para):
                return {"found": True, "how": "exact", "section": si, "paragraph": pi}
    # a selection can run across two paragraphs: try each section's text joined up
    for si, sec in enumerate(page["sections"]):
        if q in _norm(" ".join(sec["paragraphs"])):
            return {"found": True, "how": "exact, across paragraphs", "section": si, "paragraph": 0}
    # approximate: the page may have been edited since the reference was copied
    best = (0.0, None, None)
    for si, sec in enumerate(page["sections"]):
        for pi, para in enumerate(sec["paragraphs"]):
            p = _norm(para)
            if len(p) < len(q) * 0.5:
                ratio = SequenceMatcher(None, q, p).ratio()
            else:
                m = SequenceMatcher(None, p, q, autojunk=False)
                block = max(m.get_matching_blocks(), key=lambda b: b.size)
                start = max(0, block.a - block.b)
                ratio = SequenceMatcher(None, q, p[start:start + len(q)]).ratio()
            if ratio > best[0]:
                best = (ratio, si, pi)
    if best[0] >= 0.75:
        return {"found": True, "how": "approximate (%.0f%% match)" % (best[0] * 100),
                "section": best[1], "paragraph": best[2]}
    for text in page["embedded"]:
        if q in _norm(text):
            return {"found": True, "how": "in the page's embedded content", "embedded": text}
    return {"found": False, "how": "not found on the page"}
