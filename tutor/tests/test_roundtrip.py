"""End-to-end: a reference copied from the site, resolved through a real MCP
(Model Context Protocol) connection to the server.

Run against a running copy of the site:
    CHIPBASE_URL=http://127.0.0.1:8891 tutor/.venv/bin/python tutor/tests/test_roundtrip.py [ref-file]

The reference file is what the site's "Copy reference" button produced (the
site tests write one); without it, a reference is built from a live page.
"""

import asyncio
import json
import os
import re
import sys

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

BASE = os.environ.get("CHIPBASE_URL", "http://127.0.0.1:8888")
REF = re.compile(r'^> "(?P<quote>.+?)"\n> \(Chipbase: (?P<where>.+), (?P<url>https?://\S+)\)\n?'
                 r'(?:> Around it: "(?P<context>.*)"\n?)?\s*$', re.S)
failures = []


def check(name, ok, detail=""):
    print("%-44s %s" % (name, "ok" if ok else "FAIL " + detail))
    if not ok:
        failures.append(name)


def payload(result):
    """The tool's returned dictionary, from structured content or its text block."""
    data = getattr(result, "structuredContent", None) or getattr(result, "structured_content", None)
    if data:
        return data.get("result", data) if isinstance(data, dict) and set(data) == {"result"} else data
    for block in result.content:
        if getattr(block, "type", "") == "text":
            return json.loads(block.text)
    return {}


async def main(ref_text):
    params = StdioServerParameters(command=sys.executable, args=["-m", "chipbase_tutor.server"],
                                   env={**os.environ, "CHIPBASE_URL": BASE})
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools = {t.name for t in (await session.list_tools()).tools}
            check("server lists its four tools", tools >= {"resolve_reference", "read_section", "page_outline", "define"},
                  str(sorted(tools)))
            prompts = {p.name for p in (await session.list_prompts()).prompts}
            check("server offers the explain prompt", "explain" in prompts, str(prompts))

            m = REF.match(ref_text)
            check("copied reference parses", bool(m), repr(ref_text))
            if not m:
                return
            r = payload(await session.call_tool("resolve_reference", {"url": m["url"], "quote": m["quote"],
                                                                       "context": m["context"] or ""}))
            check("the passage is found", r.get("found") is True, str(r.get("matched")))
            heading = m["where"].split(" > ")[-1]
            check("in the section the reference names", heading in r.get("section_path", []) or heading == r.get("page"),
                  "%s vs %s" % (heading, r.get("section_path")))
            check("with the section text around it", len(r.get("section_text", "")) > len(m["quote"]))

            edited = m["quote"].replace("is how", "is the way", 1) if "is how" in m["quote"] else m["quote"][:-6] + "ing"
            r2 = payload(await session.call_tool("resolve_reference", {"url": m["url"], "quote": edited}))
            check("a slightly edited quote still resolves", r2.get("found") is True, str(r2.get("matched")))

            r3 = payload(await session.call_tool("resolve_reference", {"url": m["url"], "quote": "a sentence this page has never contained about bananas"}))
            check("an absent quote is reported as absent", r3.get("found") is False)

            off = payload(await session.call_tool("resolve_reference", {"url": "https://example.com/x", "quote": "anything"}))
            check("an address off the site is refused, with the reason", off.get("found") is False and "not a Chipbase address" in off.get("error", ""),
                  str(off))

            # a page that draws its content in the browser: the server's copy
            # does not have the passage, so the reference's context answers it
            built = BASE + "/explore/designs/riscv32i"
            quote = "Every number marked"
            ctx = ("This is not OpenROAD. Every number marked \"this engine\", every picture of your layout, and the "
                   "three-dimensional view come from a small program written for this site.")
            r4 = payload(await session.call_tool("resolve_reference", {"url": built, "quote": quote, "context": ctx}))
            check("a browser-built page resolves from the context", r4.get("found") is True and
                  r4.get("matched") == "from the reference's context" and "small program" in r4.get("section_text", ""),
                  str(r4)[:160])
            r5 = payload(await session.call_tool("resolve_reference", {"url": built, "quote": quote}))
            check("without the context it is reported as absent", r5.get("found") is False, str(r5)[:120])

            d = payload(await session.call_tool("define", {"term": "WNS"}))
            check("define returns the glossary entry", d.get("found") and d["entries"][0]["expansion"] == "Worst Negative Slack",
                  str(d)[:120])

            p = await session.get_prompt("explain", {"reference": ref_text})
            text = p.messages[0].content.text
            check("the explain prompt carries the reference", m["quote"] in text and "resolve_reference" in text)


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else None
    if path and os.path.exists(path):
        ref = open(path).read()
    else:
        ref = ('> "Static timing analysis is how the flow proves"\n'
               "> (Chipbase: Static Timing Analysis > What static timing analysis is, %s/education/static-timing-analysis)\n" % BASE)
    asyncio.run(main(ref))
    print("\n%s" % ("%d failures" % len(failures) if failures else "round trip passes"))
    sys.exit(1 if failures else 0)
