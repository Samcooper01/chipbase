# Game ideas for Chipbase

A running list of game modes that could live alongside the graded problem
ladder. Each entry notes the skill it trains and what it would take to
build on the current skeleton (which already has three engines: numeric
quiz, instant analytical model, and real
[OpenROAD](https://theopenroadproject.org) runs).

The strongest theme: each game trains a *different* skill a working
physical designer actually uses. Recall, diagnosis, estimation,
perception, optimization, review. The problem ladder teaches doing; the
games make the surrounding knowledge stick.

## 1. Command flash cards (the lead idea)

**Trains: recall.** You are shown a real tool command, for example
`report_checks -path_delay min` or `set_false_path -from [get_ports rst_n]`
or `global_placement -density 0.7`, and answer a multiple-choice question:
what does this do? Four options, one right, the wrong ones plausible
(that is where the authoring craft lives).

Variants that fall out almost for free once a card bank exists:

- **Reverse mode**: shown the goal ("report the worst hold path"), pick
  the command that does it.
- **Fill the flag**: the command is shown with one flag blanked out;
  pick the flag that completes the stated intent.
- **Spot the bug**: four near-identical command lines, one is subtly
  wrong (misspelled flag, wrong unit, wrong collection); find it.
- **Which tool**: does this command belong to
  [OpenSTA](https://github.com/parallaxsw/OpenSTA), the router, the
  placer, or the synthesis tool?

Two mechanics make it a game rather than a worksheet:

- **Spaced repetition** ([Anki](https://apps.ankiweb.net)-style, for
  example the SM-2 (SuperMemo 2) scheduling algorithm): cards you miss
  come back sooner, cards you know recede. Needs one small table
  (user, card, ease, interval, due date).
- **Streaks and timed rounds**: a daily 10-card round with a streak
  counter is a proven retention hook.

Deck sources: the OpenROAD and OpenSTA command documentation, the SDC
(Synopsys Design Constraints) command set, and OpenROAD-flow-scripts
configuration variables. A large part of the OpenROAD deck is
auto-generatable from the tools' own help text and docs, with hand-written
distractors where it matters. (This merges the standalone "flash card game
for scripting commands" entry on the idea list into the platform.)

Build cost: **low**. One new engine kind (`choice`: question bank on
disk, server picks due cards, checks the answer id), one scheduler table,
one card-style page. No EDA (Electronic Design Automation) tools in the
loop.

## 2. Log forensics ("why did my run die?")

**Trains: diagnosis.** You are shown the tail of a real tool log (an
error, or a suspicious warning) and answer a multiple-choice question:
what is the root cause, or what is the right next action? Nobody teaches
reading logs, yet it is half the job. Cards are cheap to author by
harvesting real failures from OpenROAD-flow-scripts runs (missing
liberty file, unconstrained clock, congestion abort, site mismatch).
Build cost: **low** (same `choice` engine as flash cards; content is the
work).

## 3. Over/under: guess the metric

**Trains: estimation.** Shown a design summary (cell count, core size,
clock target) or a floorplan image, guess a quality metric within a
tolerance band, or simply over/under a shown value: will WNS (Worst
Negative Slack) be positive? Is utilization above 70%? Calibrated
intuition about orders of magnitude separates seniors from juniors.
Build cost: **low to medium** (numeric-guess engine exists; images need
the harness to dump pictures, which OpenROAD's `save_image` can do).

## 4. Spot the pathology (visual)

**Trains: perception.** Shown a layout or heat-map image, identify the
problem from options: congestion hotspot, clock tree blowup, bad pin
placement, density cliff. Layout pathologies are eye-obvious but
metric-invisible, which is exactly why this is worth drilling (and it
connects to the human-in-the-loop visual-inspection idea on the idea
list: this game *produces* a trained eye). Build cost: **medium**
(image-generation pipeline in the harness, then the `choice` engine).

## 5. PPA (Power, Performance, Area) golf

**Trains: optimization.** Open-ended ranked mode on top of existing
problems: smallest core area that still passes every check, best
wirelength, fewest buffers. Score is the metric itself, not pass/fail,
with a per-problem leaderboard. This is the "contest" energy of a coding
judge, and it is the mode where the real-OpenROAD engine shines because
the metric is measured, not modeled. Build cost: **low** (submissions
already store metrics; add a ranking view and a `golf: <metric>` flag in
the manifest).

## 6. Speedrun mode

**Trains: efficiency.** Existing problems under constraints: solve
within a time limit, or with a budget of N grading runs (each "Run" costs
a token). Teaches deliberate debugging instead of spray-and-pray
iteration. Build cost: **low** (bookkeeping on the existing flow).

## 7. Order the flow

**Trains: structure.** Sequencing puzzles for beginners: put the stages
in order (synthesis, floorplan, placement, clock tree synthesis, routing,
fill, sign-off), or "at which stage does this artifact/step/error
belong?" Build cost: **low** (a `choice` variant with ordered answers).

## 8. Constraint-file bug hunt

**Trains: review.** Shown a complete SDC (Synopsys Design Constraints)
file with one planted, realistic bug (a generated-clock mistake, a
missing exception, a wrong-unit delay), identify the buggy line from
options. The end-game version verifies with a real OpenSTA run instead
of an answer key. Build cost: **low** for the answer-key version,
**medium** for tool-verified.

## 9. Procedural drills

**Trains: fluency.** The existing numeric quiz engine, but with seeded
random parameters so every attempt is a fresh instance: setup and hold
slack arithmetic, utilization math, track counts. Grind-able, and the
generator is a few lines per drill. Build cost: **low** (extend the quiz
engine with a per-attempt seed).

## 10. Daily challenge

**Trains: habit.** One card or problem per day, same for everyone, with
a streak counter and a tiny daily leaderboard. A retention layer over
everything above rather than a game of its own. Build cost: **low**.

## Suggested build order

1. **Flash cards** (`choice` engine + scheduler + a first ~50-card
   OpenROAD/SDC (Synopsys Design Constraints) deck): highest value per
   effort, and the engine unlocks games 2, 4, 7, and 8.
2. **PPA (Power, Performance, Area) golf** on the existing gcd floorplan
   problem: pure backend, shows off real-tool grading.
3. **Log forensics** deck: content harvesting, no new code.
4. **Daily challenge + streaks** once there is enough content to rotate.
