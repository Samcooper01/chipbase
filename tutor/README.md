# chipbase-tutor

An MCP (Model Context Protocol) server for learning chip physical design with
[Chipbase](http://127.0.0.1:8888). It does not explain anything itself: your
own model does that. What it adds is the one thing your model is missing when
you get stuck on a page, which is exactly what you were reading.

## How it works

1. On any Chipbase page, highlight the passage you do not understand.
2. Click **Copy reference**. You get a quote with a source line:

   ```
   > "Static timing analysis is how the flow proves that a synchronous design meets its clock"
   > (Chipbase: Static Timing Analysis > What static timing analysis is, http://127.0.0.1:8888/education/static-timing-analysis)
   ```

3. Paste it into your prompt and ask your question.

Your model calls `resolve_reference`, which fetches that page, finds the
passage, and returns the section it sits in, the paragraphs before and after
it, the page's outline, and the site's own definitions of the terms it uses.
The answer then builds on the page's framing and terminology instead of a
generic explanation from somewhere else.

The quote still resolves if the page has been edited slightly since you
copied it. If it no longer appears at all, the tool says so and the model
answers from the quote alone.

## Tools

| tool | what it returns |
|---|---|
| `resolve_reference(url, quote)` | the section around a quoted passage, its neighbours, the page outline and glossary definitions of terms in it |
| `read_section(url, heading)` | one section of a page by its heading, for following up |
| `page_outline(url)` | the headings of a page in order |
| `define(term)` | the Chipbase glossary entry for a term or acronym |

There is also an `explain` prompt. Give it a copied reference and it asks the
model to explain the passage in the page's own terms, with a small worked
case, and to finish with one question that checks you have understood it.

## Install

Python 3.10 or later.

```bash
cd tutor
python3 -m venv .venv
.venv/bin/pip install -e .
```

Then register it with your MCP client. The server reads the site at
`CHIPBASE_URL`, which defaults to a local copy on port 8888.

**Claude Code**

```bash
claude mcp add chipbase-tutor -e CHIPBASE_URL=http://127.0.0.1:8888 -- /path/to/tutor/.venv/bin/chipbase-tutor
```

**Claude Desktop**, in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "chipbase-tutor": {
      "command": "/path/to/tutor/.venv/bin/chipbase-tutor",
      "env": { "CHIPBASE_URL": "http://127.0.0.1:8888" }
    }
  }
}
```

Any other MCP client works the same way: run `chipbase-tutor` over stdio.

## What it will and will not read

It only fetches pages on the configured Chipbase site, plus any hosts listed
in `CHIPBASE_HOSTS` (comma separated). Any other address is refused with a
message saying why. It sends nothing anywhere except requests for the pages
you reference.

The worked examples under Sandboxes draw their steps in the browser, so only
their introductions can be looked up. For a passage from a step, the quote
and heading in the reference are what your model has to work with.

## Tests

With a copy of the site running:

```bash
CHIPBASE_URL=http://127.0.0.1:8891 tutor/.venv/bin/python tutor/tests/test_roundtrip.py
```

This starts the server over a real MCP connection and checks that a copied
reference resolves to the right section, that an edited quote still
resolves, that an absent one is reported as absent, that an address off the
site is refused with the reason, and that `define` and the `explain` prompt
work. `tests/games/check_pages.js` covers the site side: it selects text on a
page and checks the reference the button copies.
