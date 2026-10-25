# Session charter: Games (interactive labs)

You own the interactive, graded labs at `/lab/<id>` and the problem index at
`/problems`. Build and polish labs; do not touch the other two areas
(guided tours or education material).

## What you own (edit freely)

- `app/lab_content/` : `labs.py` (LABS registry, prompts), `place_specs.py`,
  `cts_specs.py`, `routing_specs.py`, `sta_specs.py`, `pv_specs.py`.
- `app/static/labs/` : every lab engine (one JavaScript file per lab).
- `app/grader.py`, `app/problems.py` (the `PLANNED_TYPES` lineup and the
  `Problem` model).
- `app/templates/lab.html`, `index.html`, `problem.html`.

## Do not touch (shared shell, coordinator-owned)

`app/main.py`, `templates/base.html`, `templates/home.html`,
`static/style.css`, `static/app.js`. Routes for labs already exist, so you
should not need `main.py`. If you need a new shared style class, add it in a
clearly commented block and flag it, or ask the coordinator. Concurrent edits to
these files clobber (this is not a git repository).

## Current status

- 76 lab items, about 59 engine files, all reachable.
- Everything is real EXCEPT the 8 Physical Verification labs, which are
  scaffold stubs that render "under construction".

## To do, in priority order

1. Build the 8 Physical Verification lab engines. Each is self-contained in its
   own engine file (put the scenario and rules as constants inside the engine,
   read only `id` and `title` from the spec) so several can be built in parallel
   without touching shared files. For each lab, also write a real prompt: put it
   in `labs.py` as the `PV_*_PROMPT` constant.

   | id | engine file | window global | mechanic (see `pv_specs.py` `todo`) |
   |---|---|---|---|
   | pv-width-spacing | `pvwidth.js` | `PvWidth` | click shapes that break minimum width or spacing |
   | pv-enclosure | `pvenclosure.js` | `PvEnclosure` | find under-enclosed vias and below-minimum-area shapes |
   | pv-spacing-table | `pvspacing.js` | `PvSpacing` | triage spacings against a width-keyed table and end-of-line rule |
   | pv-density | `pvdensity.js` | `PvDensity` | add fill so each window lands in the density band |
   | pv-lvs-connectivity | `pvlvs.js` | `PvLvs` | find the short (merged nets) or open (broken net) |
   | pv-device-match | `pvdevice.js` | `PvDevice` | find the device that does not match the schematic |
   | pv-erc-ties | `pverc.js` | `PvErc` | find floating inputs, insert tie-high / tie-low cells |
   | pv-signoff | `pvsignoff.js` | `PvSignoff` | go / no-go gate: ready only when every check passes |

2. Optional: a quality pass on existing labs.

## Lab engine conventions (match the reworked Static Timing Analysis labs)

- Structure: an immediately-invoked function that sets
  `window.<Global> = { evaluate, mount }` and also
  `module.exports = api` for headless testing.
- `mount(container, spec)` builds the document object model. Reuse the shared
  classes: `mp-wrap`, `mp-left`, `mp-canvas`, `mp-controls`, `mp-submit`,
  `mp-ready`, `mp-panel`, `mp-verdict`, `mp-pass`, `mp-fail`, `mp-row`, `mp-ok`,
  `mp-bad`, `mp-score`, `mp-flow`; use `pdn-controls` / `pdn-slider` for sliders.
- `evaluate(spec, state)` is a pure function returning at least `{ pass }`; keep
  it testable in Node.
- Prefer a real decision or an identify-the-defect mechanic over a bare slider.
  A single slider whose whole task is to reach a value has been rejected before.
- Canvas: scale by `devicePixelRatio`.
- A long instruction line must wrap. Set the hint element's `maxWidth` to the
  canvas width, because the left column sizes to its widest child.
- Draw guide lines (a deadline, an edge marker) AFTER the shapes, or the shapes
  paint over them.
- Submit button: enable it (add `mp-ready`) only when the design is correct, and
  make sure `render` never throws when submitted. Reference a value on the
  evaluate result, not on `spec`, inside `render` (a real bug we hit: `render`
  read `spec.canon` when the value lived on the result, so the click threw and
  the panel never updated).

## Verify before claiming done

- Node headless test each engine: call `evaluate` for the key cases, AND
  simulate `mount` plus a submit click through a small document-object-model
  shim to confirm the panel renders without throwing. Testing `evaluate` alone
  is not enough.
- Restart the server so the cache-bust version updates, then `curl` the page.
- Server run and restart: it runs via `run.sh` (uvicorn on 127.0.0.1 port 8888).
  To restart, stop the background task first, then relaunch
  `.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8888`. Never use
  pkill. The cache-bust version is computed at startup, so restart after editing
  any Python or static file.

## Writing rules (from the global instructions)

Never use an em dash. Expand every acronym on every use, for example
"DRC (Design Rule Check)", including in code comments and figure labels. No
LaTeX in any output; use plain text or Unicode. Cite any web source with a link
at first mention.
