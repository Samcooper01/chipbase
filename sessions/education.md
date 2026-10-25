# Session charter: Educational material (topic pages)

You own the deep topic pages at `/education/<slug>`. Bring the thin topics up to
the depth and quality of the Static Timing Analysis page, and fill the gaps. Do
not touch the other two areas (games or guided tours).

## What you own (edit freely)

- `app/education_content/education.py` : the topic bodies (large raw-string
  HTML constants such as `STA_BODY`, `FLOORPLANNING_BODY`, ...) and the `TOPICS`
  list that binds slug, name, tagline, blurb, and body.
- `app/templates/education_hub.html`, `education_guide.html`.

## Do not touch (shared shell, coordinator-owned)

`app/main.py`, `templates/base.html`, `templates/home.html`,
`static/style.css`, `static/app.js`. The education routes already exist. If you
need a new shared style, flag it for the coordinator. Concurrent edits to these
files clobber (this is not a git repository).

## Current status

Six live topic pages, very uneven in depth (character counts of the body):

- Static Timing Analysis: about 18,600 (the reference for depth and structure).
- Floorplanning about 5,900, Placement about 4,100, Clock Tree Synthesis about
  4,300, Routing about 4,300, Physical Verification about 4,100 (all thin).
- Engineering Change Order has a lab and a topic slot but NO education page.

## To do, in priority order

1. Deepen the five thin topics (Floorplanning, Placement, Clock Tree Synthesis,
   Routing, Physical Verification) toward the depth and section structure of the
   Static Timing Analysis body. Match its use of section headings, worked
   examples, equation blocks with legends, stepped procedures, and figures.
2. Add an Engineering Change Order education page: write an `ECO_BODY` constant
   and a `TOPICS` entry with slug `eco` (the topic ordering already lists it).
3. Where a topic has matching interactive labs, reference them so a reader can
   jump from the concept to the exercise.

## Writing style (this is load-bearing here)

Read these memory files before writing and follow them exactly:

- `~/.claude/projects/-home-sam-Geetus2-0/memory/pd-leet-writing-style.md` :
  science voice, equation blocks with legends, stepped procedures, formal
  visuals.
- `~/.claude/projects/-home-sam-Geetus2-0/memory/pd-leet-ai-tells.md` : the list
  of banned "artificial-intelligence tell" words; use plain textbook prose.

Also, from the global instructions:

- Never use an em dash.
- Expand every acronym on every single use, including in headings, figure
  labels, and captions, for example "LVS (Layout Versus Schematic)". This rule
  is absolute and is one Sam checks for.
- No LaTeX. Bodies are HTML, so typeset equations as styled spans and rows, not
  as raw math markup.
- Cite any web source (a tool, a project, a library) with a link in the HTML at
  first mention.

## Body format

Each body is a raw-string HTML constant assigned into a `TOPICS` entry. Open
`STA_BODY` and mirror its structure: the same kinds of section wrappers,
callouts, equation blocks, and figure treatment. Keep the science voice; do not
pad with filler.

## Verify before claiming done

- Restart the server, then `curl` and read `/education/<slug>` for each page you
  changed; check that acronyms are expanded and there are no em dashes.
- Server run and restart: it runs via `run.sh` (uvicorn on 127.0.0.1 port 8888).
  To restart, stop the background task first, then relaunch
  `.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8888`. Never use
  pkill. Template-only edits need no restart; a Python edit (a new body) does.
