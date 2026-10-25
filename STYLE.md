# Writing and working conventions for the site

Sam's standing rules for content on this site, collected while reviewing pages in 2026. The site is a
public professional reference, so it has to read like a textbook, not like a blog and not like
generated text. Apply these to every new page and, when editing a page, sweep the rest of the site
for the same faults.

## Voice

- Science voice, not literature voice: declarative, precise technical prose. State the mechanism and
  what depends on what. No rhetorical flourishes, no chiasmus, no metaphors ("running odometer"), no
  dramatic capitalization, no framing sentences such as "the mechanism deserves its own diagram".
- No verdict openers in sections that weigh evidence ("Is it actually used today?"): never lead with
  "Yes.", "No." or an opinion line. Open with a neutral sentence naming what the evidence covers and
  let the points carry the conclusion.
- Evidence framing: claims about tool usage separate open-source tools (inspectable: cite and link)
  from commercial ones (inference: say so). A claim about a commercial tool's internals is marked
  "inferred, not verified" unless the behaviour is documented or exposed as a tool option.
- Elaborations go inline: when a sentence needs more, make it one tighter sentence, not new paragraphs.

## Banned words and phrases (use plain prose instead)

flagship; earns its keep; the payoff; the catch; the frontier; honest, honestly, "the honest negative
result"; user-visible (say "documented" or "exposed as a tool option"); cautionary tale; the funeral;
museum piece; a perfect or beautiful lesson; "the whole point", "the whole story", "the whole X", "the
entire X" as emphasis; the intellectual core; comes alive; brought to life; lives here, lives in;
workhorse; powerhouse; under the hood; the magic; machinery ("the machinery behind X"); craft, crafted
as praise; prepay, prepaid; leverage; unlock; elevate; harness (the verb); showcase; seamless; robust;
rich; vibrant; landscape; realm; tapestry; testament; delve; deep dive; nestled; boasts; "not just X
but Y" and "isn't just" constructions; "getting warm". Em dashes and en dashes as punctuation.

The approved exemplar of the target voice (the machine-learning-in-routing page): "Running the router
and counting the resulting overflow and design-rule violations gives the true cost of a routing
decision in minutes."

## Equations, procedures, figures

- Equations are display blocks (`<div class="eq">`), never inline, and every block has a
  `<ul class="eq-legend">` defining every symbol; nothing appears unexplained. Only real equations go
  in an equation block: a definition list, a tuple or a sequence of steps is written as bullets or as
  numbered steps, never dressed as an equation.
- Procedures are named steps: bold "Step N: Verb." paragraphs, one action each, with formulas
  promoted to blocks and no dense parentheticals.
- Animations match the text: walkthrough captions carry the same step numbers as the prose.
- One diagram per job: concept and simulation diagrams must each earn their place; redundant figures
  are removed.
- Figure panels never overlap the drawing: compute the drawing's rightmost pixel and start the side
  panel well past it, widening the canvas if needed; the same for before-and-after layouts; check every
  frame, not only the first.
- Formal visuals: ruled tables and hairlines, small-caps labels (Strengths, Weaknesses), assertion
  blocks with a top rule; no coloured boxes.

## Acronyms

Every acronym is expanded in parentheses at every use, in prose, captions, tables and code comments
alike: "DRC (Design Rule Check)", "RTL (Register-Transfer Level)", "SRAM (Static Random-Access
Memory)". When unsure whether a token is an acronym, expand it or use a plain word.

## Working on the site

- `run.sh` serves the site on 127.0.0.1:8888 (creates a virtual environment the first time).
- The `?v=` cache-busting number on every static link (`asset_v` in `app/main.py`) is computed once at
  server start from file modification times. After changing anything under `app/static/` (JavaScript,
  CSS, images), restart the server, or the browser keeps the old file; template-only edits need no
  restart. Headless tests start with an empty cache and will not show the problem.
- The site is static: no server-side grading, database or leaderboard. `python -m app.freeze` writes
  the static site; the browser grader is checked against recorded scorecards before a publish.
- `GAMES.md` describes the games; `app/challenge_content.py` and `app/templates/challenge.html` are the
  Competition 01 page, kept in step with `README.md` and `scoring.yaml` in the harness repository
  (https://github.com/Samcooper01/systolic-array-ai-accelerator-harness).
