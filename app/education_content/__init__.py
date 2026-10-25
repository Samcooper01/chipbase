"""Education section of Chipbase: detailed reference pages on the main
physical-design topics, each a single page covering everything a
physical-design engineer needs to know about that topic, with a table
of contents and inline visual guides.

Distinct from Explore (interactive labs and method catalogs) and from
Problems (the graded judge). This is the reference-knowledge layer."""

import html
import re

import markdown as _markdown

from . import education as _e

TOPICS = _e.TOPICS


def get_topic(slug: str):
    for i, t in enumerate(TOPICS):
        if t["slug"] == slug:
            return t
    return None


def live_topics():
    return [t for t in TOPICS if t.get("live")]


def chapters(topic) -> list:
    """The sections of a topic's page, in order, as (title, anchor) pairs: the
    books on its shelf in the Education library. The headings are read from
    the page exactly as it renders them, and the anchors follow the rule the
    page's own script uses to name its headings ("sec-" and the heading text,
    lowercase, with every run of other characters turned into one hyphen), so
    a book always opens its section."""
    rendered = _markdown.markdown(topic.get("body", ""), extensions=["fenced_code", "tables"])
    out = []
    for inner in re.findall(r"<h2[^>]*>(.*?)</h2>", rendered, re.S):
        text = html.unescape(re.sub(r"<[^>]+>", "", inner)).strip()
        anchor = "sec-" + re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
        out.append((text, anchor))
    return out
