# Spot the pathology: scope and plan

A drill in perception. The flow draws a heat map at the end of every run, and
reading one quickly is a skill nobody teaches: the pathologies are obvious to
an eye that has seen them and invisible to one that has not.

18 maps in 6 families, built entirely from images the flow had already rendered.

## Where the images come from

Every run of OpenROAD-flow-scripts writes about ten images into its reports
directory: congestion, voltage drop, placement, clocks, routing, the worst
path, and the clock tree. The runs made for log forensics and over/under left
158 of them in the games session's scratchpad, from sixteen runs, and this
drill is assembled from those. No new runs were needed.

An item names the run it came from, and the reveal quotes the number behind
the picture, so a colour can always be traced to a measurement.

## Rules the content is held to

- **Healthy maps are half the content.** Six of the sixteen runs changed
  something that never touched the layout, so their maps are healthy examples
  of the same design. A drill made only of faults teaches the wrong reflex,
  which is to find something wrong in everything.
- **Every item carries a written description** of what the map shows. It is
  the reveal text, and it is what a screen reader gets instead of the image.
- **The question is what the picture says**, not whether something is wrong.
  One item's answer is that the pattern is the design's own architecture.

## The three shapes

| Style | What it shows | How it is answered |
|---|---|---|
| `name` | one map | four readings of it, pick one |
| `pair` | two maps of the same design | say which is healthy |
| `spot` | one map | click the region the question asks for |

A `spot` item stores its targets as fractions of the image, `{x, y, w, h}`
with the origin at the top left, so they survive any rendered size. A click
inside any target counts, because "click a tile at capacity" usually has
several right answers. The reveal draws every target and marks where the
click landed, so a miss still teaches where to look.

## A click item can be answered without a pointer

The map is divided into nine numbered parts, drawn faintly over it, and
pressing 1 to 9 picks one. A pick counts when the centre of any target lies
inside the part chosen: a coarser question than a click, but the same
question. Every item also carries a written description of the map, and each
figure links to the image at full size, since the originals are 1099 pixels
and the page shows them at 560.

## Click targets are measured, not judged

A `spot` item's targets are found by reading the pixels, not by eye. The hot
tiles in the congestion map are the connected clusters of deep red, and the
empty margins in the sparse placement are rectangles verified to contain no
drawn cell at all. The little scripts that do it live with the images, and the
reason is fairness: a target placed by eye is a target the player can be
marked wrong for missing by a hair.

One item was dropped for failing that test. It asked for a click on the green
channels between the repeated blocks of the cipher, and no measurement could
separate those channels from the margin around the block, so any target set
would have been arbitrary. The map is still in the drill, as a question about
what the pattern means.

## The best item in the set

The voltage-drop pair. The two maps look equally alarming, because each map
normalizes its colours to its own range, and their legends read 3.698 and
13.921 millivolts. Reading the scale before reacting to the colour is the
lesson, and it applies to every heat map any tool draws.

## How it scales

1. **Fifteen of the sixteen whole-design views** are still unused, and most
   sky130 maps. The worst-path views have a family of their own now, with two
   of sixteen used.
2. **Bigger designs.** The ibex and jpeg runs kept only their reports, so
   their maps are gone with the containers. About an hour of runs would bring
   back the most visually interesting material in the project.
3. **Routing and resizer maps**, which no item uses yet.
4. **More spot items**, which are the shape that actually trains the eye and
   the one this drill has fewest of.

## The second batch, and where it is kept

The first batch of images was staged in a scratch directory that was later
wiped, which cost 158 rendered maps and every log behind them. The second
batch lives in `data/pathology-src`, inside the repository and ignored by git,
with each run's images, its full log, and a `.numbers.txt` holding the metrics
greped out of it. Nothing that can be re-derived is trusted to memory.

That batch added two processes the drill had barely touched. The same small
design, gcd, was run on the Skywater 130 nanometre high density library and on
ASAP7 (Arizona State University 7 nanometre predictive process design kit),
which gives four items:

- **The warm congestion map that is fine.** ASAP7 gcd fills out the palette
  and uses 12.73 percent of its routing resource, with zero overflow on every
  layer and zero routing violations. The lesson is that the colour scale is
  relative and the log is not.
- **The worst path that is all gates.** The same run misses by 42.82
  picoseconds on a 310 picosecond clock, and every net on the path costs
  under half a picosecond against 10 to 30 picoseconds a gate. The map draws
  distance, and distance is not what the path is spending.
- **The clock tree by quadrant.** Five buffers, 34 sinks, four coloured
  branches that follow position and not function.
- **Preferred routing directions.** The Skywater render, packed at 92 percent
  utilization, where no long wire turns a corner because turning means
  changing layer.

The same batch brought in two real cores on Nangate45, tinyRocket and ibex.
tinyRocket is the first design in the drill with hard macros, which is a
different kind of picture and gives two items of its own: the keep-out halo,
which turns 2481 square micrometres of macro into 11928 square micrometres of
floorplan, and the congestion map, where the macros read hot because they
block the lower layers while the halo beside them reads cold because nothing
is wired there. Its clock view gives a third, on the voids that appear when
only one cell in seven is drawn.

ibex contributes the counterweight the placement family needed. Its cells
leave a corner of the die bare at 51 percent utilization and the run is
perfectly healthy, which is the answer to the reflex the oversized-die item
trains. And the two cores together give the voltage pair the earlier one could
not: same process, same 1.1 volt supply, so the legends compare and the
colours still do not.

Both cores also settled a small question about what the flow actually saves.
The legend maximum on `final_ir_drop.webp` matches the ground net in both runs,
8.866 against 8.87 millivolts and 14.419 against 14.4, so the map is ground
bounce and not supply droop. Two independent runs agreeing is why the claim is
in an item at all.

## Reading the flow's own drawing script

The four runs rendered forty maps between them and the first pass used nine.
The second pass went back to `save_images.tcl` in the container and read what
each view actually draws, which changed what could honestly be asked about
three of them:

- The placement view switches fill cells off. The black gaps between cells are
  free row space, not badly placed silicon, which is exactly the thing worth
  looking at, because free row space is where repair has to fit.
- The clock view draws sequential cells, clock tree cells and macros, and
  nothing else. The voids are combinational logic.
- The resizer view highlights by instance name: yellow for the `input` and
  `output` port buffers, red for `rebuffer` cells from setup repair, green for
  hold fixes. So the colours separate routine work from work the timing asked
  for, and the interior reds are the ones that mean something.

One item was corrected as a result. The macro congestion item first explained
the hot macros as wires crossing them on the layers left free. The routing view
of the same run shows almost nothing crossing either macro: one wire clips a
corner. The honest explanation is that the macro's own metal blocks the tracks,
and a tile with nothing left to give reads full whether or not a signal is ever
routed there.

## Measuring click targets, second time

`data/pathology-src/measure.py` is the replacement for the scripts lost with
the scratchpad. It takes an image and a named colour test, finds connected
clusters and prints them as fractional boxes ready to paste. The nine
rebuffer cells in the ASAP7 resizer view came out at about three percent of
the image across, too small to click fairly, so each was padded out to six
percent around its measured centre and the overlapping ones merged. Padding is
a tolerance in the player's favour and is recorded here so it is not mistaken
for a measurement.

## Where the drill stands

Forty-two items over six families: congestion 11, placement 9, routing 7,
power 5, clocks 5, paths 5. By shape, 27 name, 9 pair, 6 spot. The harness in
`tests/games` now plays every item in every drill rather than one round of
each, which is what caught that coverage was thin in the first place.

## Two different numbers both called wire length

A run reports `Total wirelength` from global routing and `Total wire length`
from the detailed router, and on tinyRocket they differ by 28 percent: 698087
micrometres estimated against 500952 actually routed. An early draft quoted
the estimate. Every wire number in the drill is now the routed length, read
from the last time the flow prints it, and the same care applies to any metric
the flow reports more than once during a run.

## Out of scope

Images from commercial tools, which cannot be published, and any map drawn by
hand. If the flow did not render it from a real run, it does not go in.
