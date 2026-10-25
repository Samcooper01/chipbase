# Session charter: Guided tours (the Explore section)

You own the `/explore` ecosystem: the method and algorithm explainers, the
foundry-process chapters, and the interactive demonstrations. Do not touch the
other two areas (games or education material).

## What you own (edit freely)

- `app/explore.py` : the `EXPLORABLES` list (interactive demos) and the explore
  categories.
- `app/algo_content/` : `floorplanning.py`, `placement.py`, `cts.py`,
  `routing.py`, `timing.py` (each defines a `STAGE` with a list of algorithm
  explainers).
- `app/process_content/processes.py` : the foundry-process chapters.
- `app/templates/explore.html`, `explore_hub.html`, `algo_catalog.html`,
  `algo_page.html`, `maze_router.html`.
- `app/static/explore/`, `app/static/catalog.js`.

## Do not touch (shared shell, coordinator-owned)

`app/main.py`, `templates/base.html`, `templates/home.html`,
`static/style.css`, `static/app.js`. One dependency to note: a NEW interactive
demo needs its own route in `main.py` (the Maze Router has a dedicated route).
Do not add it yourself; write the demo template and JavaScript, then ask the
coordinator to wire the route. Concurrent edits to shared files clobber (this is
not a git repository).

## Current status

- Method and algorithm explainers, per stage: floorplanning 21, placement 19,
  routing 24 (rich); clock tree synthesis 8, timing 8 (thin).
- Foundry-process chapters: about 7, substantial.
- Interactive demos: 1 of 5 is live (the Maze Router). Four are planned and
  currently marked not live: the Floorplan Sandbox, Analytical Placement, the
  Clock Tree Balancer, and Arrival versus Required.
- The top-level "Games" and "Guided tours" landing categories are not built.

## To do, in priority order

1. Build the four planned interactive demos. Mirror the live Maze Router as the
   reference (its template is `maze_router.html`; its logic lives in a file
   under `static/explore/`). Each new demo is a template plus a JavaScript file
   you own; the route in `main.py` is the one thing to hand to the coordinator.
   Flip its `live` flag in `EXPLORABLES` when done.
2. Expand the clock tree synthesis and timing algorithm explainers toward parity
   with floorplanning, placement, and routing.
3. Optional: build the "Guided tours" landing category, a step-by-step
   end-to-end walk through the flow.

## Conventions

- Algorithm explainer pattern: each module exports a `STAGE` dict with a `slug`,
  a name, and a list of algorithm entries (each with its own slug, name, and
  body). Follow the existing entries in `routing.py` or `placement.py`.
- Foundry-process chapter pattern: follow the existing chapters in
  `process_content/processes.py`.
- Interactive demo pattern: a canvas-driven explainer like the Maze Router,
  self-contained in its own JavaScript file under `static/explore/`.

## Writing rules (from the global instructions)

Never use an em dash. Expand every acronym on every use, for example
"PDK (Process Design Kit)", including in figure labels and captions. No LaTeX;
use plain text, Unicode, or styled HTML. Cite any web source (a tool, a project,
a library) with a link at first mention.

## Verify before claiming done

- Restart the server, then `curl` and read the relevant `/explore/...` page.
- Server run and restart: it runs via `run.sh` (uvicorn on 127.0.0.1 port 8888).
  To restart, stop the background task first, then relaunch
  `.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8888`. Never use
  pkill. The cache-bust version is computed at startup, so restart after editing
  any Python or static file.
