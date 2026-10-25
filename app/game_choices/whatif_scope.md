# What happens if: scope and plan

A drill in judgement, settled by measurement. A design is in a particular
state, something has to change, and three or four things somebody might
actually try are offered. Every option was run, and the table you see
afterwards is what those runs produced.

## The rule that makes it worth playing

**The best option is computed, not written down.** Each situation declares an
objective, such as the smallest achievable period or the fewest congestion
reports, and the loader works out which option wins from the measured
outcomes. Correct a number later and the grading follows it. Nobody can quietly
encode an opinion as the answer key.

Where two options tie on the objective, the situation must declare a
tiebreak, and the loader **refuses to load content that ties without one**
rather than grading on the order the options happen to be written in. The
repair-effort situation needs it: repairing every violating endpoint and
repairing the worst tenth reach exactly the same worst slack, and the cell
area decides between them. The routing situation needed it too until the runs
were redone, when spreading the design turned out not to clear the congestion
reports after all. The declaration stays there, because the next correction to
a number could bring the tie back.

## How a situation is made

1. Pick a state a design can genuinely be in, and a decision someone has to
   make about it.
2. Write down the alternatives a physical designer would actually consider,
   including doing nothing.
3. Run every one of them, identically, changing one thing at a time.
4. Read the metrics out of the logs and reports, never from memory.
5. Write the question so the objective is explicit, and add the caveat that
   the measurement cannot see.

That last step matters as much as the run. The timing situation's winning
option is to take back half of the interface budget, which is the best answer
on the measure and still a conversation with an architect rather than a knob,
because the budget is a promise to whatever sits on the other side of the
port. A drill that omitted that would teach a bad habit with real numbers.

## Scope of any answer here

One design, one platform, one starting point. The drill says so on every
situation, because the point of the drill is that the right move depends on which
constraint is actually binding, and a rule of thumb carried from one block to
another is how people get this wrong.

## The second batch, and where it is kept

The runs behind the first four situations were staged in a scratch directory
that was later wiped. Everything is now in `data/whatif-src`, inside the
repository and ignored by git: the script that ran it, the full log of every
run, the reports it produced, and `extract.py`, which pulls the numbers out of
those logs so no value in the drill is typed from memory.

Every situation was re-run in that batch, including the four that already
existed, so every situation now rests on one set of runs on one tool version.
Three things came out of doing that.

**The numbers reproduce exactly.** Two independent runs of ibex, days apart in
different containers, gave identical area, wire length, slack and drop, to the
last digit. That matters more than it sounds: it means a difference between two
options in this drill is a real difference and not run-to-run noise, so a two
percent gap can be reported as a two percent gap.

**One number did not reproduce, because it was never measured.** The area
situation showed 0.46 nanoseconds as the smallest period of the default run.
The run reports 0.44; 0.46 is the clock it was asked for. Area and wire matched
to the micrometre, which is what made the odd one out obvious.

**A run reports wire length more than once.** Global routing prints an estimate
and the detailed router prints what it actually laid down, and on tinyRocket
those differ by 28 percent. Every wire number in the drill is now the routed
one.

## Two things the batch deliberately does not measure

**Runtime.** The groups run in parallel on one machine, so any wall-clock
number would measure the scheduler rather than the decision.

**Anything downstream of the block.** The interface budget situation is the
clearest case: the winning option takes back a promise made to whatever sits on
the other side of the port, and no measurement inside this block can see what
that costs.

## What the second batch added, and what it changed

Situations on large designs, which was the first item on the old list. ibex
answers the routing-layer question the small block already answered, and the
answer ranks the same way with a much larger bill. Two more platforms are in
now as well: the Skywater block that finished at 92 percent when it asked for
38, and the ASAP7 block whose critical path is fifteen cells of logic and
therefore immune to every floorplan knob there is.

The options that sound clever and are not, which was the third item. Synthesis
for delay instead of area produced 21 percent more silicon out of a quarter
fewer cells, and stopped closing. The optimization pass one config switches off
turned out to be worth exactly one micrometre of wire. Relaxing a clock by 30
picoseconds moved the bottleneck to the interface rather than removing it.

Cost as a second axis, which was the fourth. The repair-effort situation is
entirely about that: the same worst slack for 9 percent less area, and the
question is where a curve flattens rather than which option wins.

## Left out on purpose

Two experiments were run and not turned into situations. The clock-tree pair
duplicated a map already in spot the pathology, and one of its two knobs did
nothing because a cluster size of 50 is larger than the block's sink count.
The minimum-routing-layer pair is half done: starting signal routing at metal3
left the small block with 96 design-rule violations after 64 detailed-routing
passes, and its log is kept as `rt_min3`, but the metal4 run was stopped at
pass 20 with 1205 violations and no sign of converging, so the situation was
skipped rather than written from an unfinished number.

## What could be added

- **A situation where the answer is to do nothing.** Every situation here has
  a move that beats standing still, which is not how the job usually goes.
- **Two knobs at once.** Everything is one variable against a baseline, and
  the interesting failures in practice are interactions.
- **A design with hard macros in a timing situation**, not only a floorplan
  one.
- **Runtime**, if the runs are ever done one at a time on a quiet machine.
