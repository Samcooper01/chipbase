"""chipbase-tutor: an MCP (Model Context Protocol) server that turns a passage
highlighted on Chipbase into the context a model needs to explain it.

The learner highlights text on a Chipbase page and clicks "Copy reference".
The reference is a quote followed by a source line naming the page. Pasted
into a prompt, it lets the model call resolve_reference, which fetches that
page, finds the passage, and returns the section it sits in, what comes
before and after it, the page's outline, and the site's own definitions of
the terms it uses. The model does the explaining; the server makes sure it is
explaining the right thing, in the page's own terms.

Run with:  chipbase-tutor            (stdio, for any MCP client)
Configure: CHIPBASE_URL=https://...  (the site to read; defaults to a local copy)
"""

import functools
import urllib.error
from typing import Any

from mcp.server.mcpserver import MCPServer

from . import glossary, pages

INSTRUCTIONS = """\
Use these tools when the user quotes a passage from Chipbase, a site for
learning chip physical design. A Chipbase reference looks like a quoted
passage followed by a line such as:
  (Chipbase: Static Timing Analysis > Setup and hold, https://.../education/static-timing-analysis)
and often a third line beginning "Around it:" with the text around the passage.
When you see one, call resolve_reference with that address, the quoted text,
and the "Around it" text (if there is one) as context, before answering, and explain using the section it returns: the page's
own framing, terms and examples. Use read_section or page_outline to look
further, and define for the site's definition of a term. If the passage is
not found, say so and answer from the quote alone."""

server = MCPServer("chipbase-tutor", title="Chipbase tutor", instructions=INSTRUCTIONS, version="0.1.1")

MAX_SECTION = 6000


def _trim(text: str, limit: int = MAX_SECTION) -> str:
    return text if len(text) <= limit else text[:limit].rsplit(" ", 1)[0] + " [section continues]"


def _explained(fn):
    """Return a refusal or an unreachable page as a plain message the model can
    relay, rather than a bare tool failure it cannot explain to the learner."""
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except ValueError as exc:
            return {"found": False, "error": str(exc)}
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            return {"found": False, "error": "could not reach %s: %s" % (pages.base_url(), exc),
                    "hint": "Set CHIPBASE_URL to the address of the Chipbase site you are reading."}
    return wrapper


def _outline(page: dict) -> list:
    return [{"level": s["level"], "heading": s["heading"]} for s in page["sections"] if s["heading"]]


@server.tool()
@_explained
def resolve_reference(url: str, quote: str, context: str = "") -> dict[str, Any]:
    """Find a quoted passage on a Chipbase page and return the context around it.

    Call this first whenever the user pastes a Chipbase reference (a quote
    followed by a "Chipbase:" source line). Pass the page address from the
    source line, the quoted text exactly as pasted, and, if the reference has
    an "Around it:" line, that text as context.

    Returns the page title, the heading path to the passage, the paragraph it
    is in with the paragraphs either side, the full section, the page outline,
    and the site's glossary definitions of terms in the passage.
    """
    page = pages.read(url)
    spot = pages.locate(page, quote)
    result = {"page": page["title"], "url": page["url"], "found": spot["found"], "matched": spot["how"],
              "outline": _outline(page)}
    if not spot["found"]:
        # Some pages draw their content in the browser, where the server's copy
        # cannot show it; the reference then carries the passage's surroundings.
        ctx = " ".join(context.split())
        if ctx:
            result.update({"found": True, "matched": "from the reference's context",
                           "section_path": [], "passage": quote, "section_text": _trim(ctx),
                           "note": ("This page builds its content in the browser, so the tutor could not "
                                    "read it; section_text is the text around the passage, as the "
                                    "reference carried it from the page.")})
            try:
                result["terms"] = glossary.mentioned_in(ctx)
            except Exception:
                result["terms"] = []
            return result
        result["note"] = ("The passage is not on the page as it is now. The page may have changed "
                          "since the reference was copied; answer from the quote and say so.")
        return result
    if "embedded" in spot:
        result.update({"section_path": [], "passage": spot["embedded"],
                       "note": "This page draws its content in the browser; the passage was found in that content."})
        text = spot["embedded"]
    else:
        sec = page["sections"][spot["section"]]
        paras, i = sec["paragraphs"], spot["paragraph"]
        result.update({
            "section_path": sec["trail"],
            "passage": paras[i] if paras else "",
            "before": paras[i - 1] if i > 0 else "",
            "after": paras[i + 1] if i + 1 < len(paras) else "",
            "section_text": _trim("\n\n".join(paras)),
        })
        text = " ".join(paras[max(0, i - 1): i + 2])
    try:
        result["terms"] = glossary.mentioned_in(text)
    except Exception:
        result["terms"] = []
    return result


@server.tool()
@_explained
def read_section(url: str, heading: str) -> dict[str, Any]:
    """Read one section of a Chipbase page by its heading, for following up on a
    passage: the section before or after, or one named in the page outline."""
    page = pages.read(url)
    want = heading.strip().lower()
    match = next((s for s in page["sections"] if s["heading"].lower() == want), None) or \
        next((s for s in page["sections"] if want in s["heading"].lower()), None)
    if match is None:
        return {"page": page["title"], "url": page["url"], "found": False, "outline": _outline(page)}
    return {"page": page["title"], "url": page["url"], "found": True, "section_path": match["trail"],
            "section_text": _trim("\n\n".join(match["paragraphs"]))}


@server.tool()
@_explained
def page_outline(url: str) -> dict[str, Any]:
    """The headings of a Chipbase page in order, to see where a passage sits in
    the whole argument of the page."""
    page = pages.read(url)
    return {"page": page["title"], "url": page["url"], "outline": _outline(page)}


@server.tool()
@_explained
def define(term: str) -> dict[str, Any]:
    """The Chipbase glossary's definition of a term or acronym, so an explanation
    uses the same meaning the site does."""
    hits = glossary.lookup(term)
    return {"term": term, "found": bool(hits), "entries": hits,
            "glossary": pages.base_url() + "/glossary"}


@server.prompt()
def explain(reference: str) -> str:
    """Explain a passage copied from Chipbase with its "Copy reference" button."""
    return (
        "I am reading Chipbase and do not understand this passage:\n\n"
        + reference.strip()
        + "\n\nCall resolve_reference with the page address, the quote and any \"Around it\" text first. Then explain "
        "the passage using that section's own terms and examples: say what idea it is making, "
        "show it with a small concrete case, and say which earlier idea on the page it depends "
        "on if I seem to be missing it. Keep numbers to ones the page gives or ones you work out "
        "step by step. Finish with one short question I can answer to check I have it."
    )


def main():
    server.run("stdio")


if __name__ == "__main__":
    main()
