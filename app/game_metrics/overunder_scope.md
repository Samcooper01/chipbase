# Over / under: scope and plan

A drill in calibration. A summary of a real run is shown, then a question
about one of its metrics, and the player says whether the true value lands
over or under a stated number. The value is then revealed on a scale against
that number.

The skill is knowing roughly what a metric should be. That is what makes a
physical designer notice a run has gone wrong before any check does, and it is
the thing courses never teach because it only comes from seeing numbers.

41 summaries in 5 families, and growing with each run measured.

## Rules the content is held to

- **Every value is measured.** No estimates, no plausible-looking numbers. If
  a value is in here, a run produced it and the run is named below.
- **The threshold is chosen to make the question worth asking.** A question
  whose answer is obvious from the summary teaches nothing, and one that turns
  on a coin flip teaches nothing either. The useful ones are a factor of about
  1.5 to 3 away from the truth.
- **The explanation says what drives the number**, not merely what it was, so
  a wrong call still leaves a rule of thumb behind.
- Over and under are kept in rough balance, so the drill cannot be beaten by
  always answering one way. It is 4 and 4 today.

## Where today's numbers come from

All from the `openroad/orfs` container, OpenROAD 26Q3, harvested from the runs
made for the log forensics drill:

| Run | What it is | Numbers it supplies |
|---|---|---|
| `good` | gcd on Nangate45, default settings | 3605 micrometres of wire, 716 square micrometres, 0.38 percent drop |
| `big_die` | the same at 8 percent utilization | 6099 micrometres of wire |
| `congest` | the same on metal1 to metal3 | 3908 micrometres of wire |
| `tight_clock` | the same at a 0.30 nanosecond target | 945 square micrometres |
| `thin_pdn` | the same with starved power straps | 1.14 percent drop |
| `sky_signoff` | gcd on sky130 high density | 5400 square micrometres |
| `aes_tight` | aes on Nangate45, metal1 to metal4 | 274995 micrometres of wire, 9.9 percent drop, 107 clock buffers, 3771 repair buffers |
| `n45_ibex` | ibex, a RISC-V core, on Nangate45 | 14871 instances, 262811 micrometres of wire, 31 milliwatts, 424 clock buffers, 2.18 nanosecond minimum period |
| `n45_jpeg` | jpeg, an image encoder, on Nangate45 | 56230 instances at 85 percent utilization, 568656 micrometres of wire, 585 milliwatts, 6.9 percent voltage drop, 12618 inverters, misses its target at 1.11 nanoseconds |
| `a7_gcd` | gcd on ASAP7, 7 nanometre, at 0.77 volts | 306 instances, 46 square micrometres, 778 micrometres of wire, 1.45 milliwatts, 331.69 picosecond minimum period |

| `sky_aes` | aes on sky130 high density | 11141 instances, 126974 square micrometres, 590541 micrometres of wire, 562 registers, 3.74 nanosecond minimum period |
| `n45_gcd_u30`, `n45_gcd_u70` | gcd on Nangate45 at 30 and 70 percent utilization | with the default run, a three-point sweep: area within 2 percent, wire length spread 22 percent, minimum period within 5 percent |

| `n45_aes_plain` | aes on Nangate45 with nothing changed, run as a control | 222438 micrometres of wire, 434 milliwatts, 9.28 percent voltage drop |

That control exists because an explanation had outrun its evidence. An item
blamed the 9.9 percent drop on the current the design draws, while the run it
came from also had its routing restricted, so the claim could not be
separated from the mutation. The control drops 9.28 percent with nothing
changed, which settles it: the current is the cause. The pair also produced a
new item, since the restricted run routes 24 percent more wire than the
control.

One run in that batch gave nothing and is recorded so it is not repeated:
`n45_gcd_slow` set `ABC_CLOCK_PERIOD_IN_PS` to 900 to see whether a relaxed
synthesis target produced a smaller netlist, and came out identical to the
default run in every respect. The flow extracts the period for synthesis from
the constraints file, so the override never took. Changing the constraint
itself is the way to ask that question.

The gcd block now exists on three processes, which is the most valuable thing
in the set: 46 square micrometres at 7 nanometres, 716 at 45, and 5400 at 130,
drawing 1.45, 2.62 and 9.38 milliwatts on supplies of 0.77, 1.1 and 1.8 volts.
Each of those ladders is a question that intuition gets wrong.

Every figure above was read out of a log with `grep`, not remembered. That
rule earned itself: two clock periods in the first draft were written from
memory and were wrong, the aes runs being constrained at 0.82 nanoseconds
rather than 0.40 and the sky130 run at 1.10 rather than 1.20. Both were caught
by checking `FLW-0007` in each log, which is where the flow prints the period
it actually used. Any new item quotes a number that can be grepped back out of
the run that produced it.

## Families

1. **Area and utilization**: what a design occupies, and what changes it.
2. **Wires and routing**: how much metal it takes to connect.
3. **Power and voltage drop**: what it draws, and what the grid does with it.
4. **Counts and the cell mix**: how many cells a layout really holds, how much
   of that is filler, how large a clock tree gets, and how much of a die is
   buffers the designer never wrote.
5. **Speed**: the smallest period a block can hold, and what moves it.

## How the content scales

The flow is a measuring instrument: every run writes its metrics, and a run of
a new design on a new platform is a handful of new summaries. The ladder:

1. **More designs on Nangate45**: ibex, jpeg, swerv. Each gives area, wire
   length, power, drop, cell count, and clock tree size at a size the gcd
   block cannot illustrate.
2. **The same designs across platforms**: sky130 high density and ASAP7. The
   most valuable questions in the drill are the cross-process ones, because
   that is where intuition is most often wrong.
3. **Sweeps rather than single runs**: the first one is in, three utilization
   points on gcd, and it produced the most surprising result in the set. Area
   moves 2 percent and the minimum period 4.5 percent across the normal range,
   against 69 percent more wire when utilization is pushed to the absurd. Most
   of what a knob can do lives outside the range anyone would choose. More
   sweeps, on clock period and on a larger design, are the next ones worth
   running.
4. **Metrics not yet used**: instance count growth from synthesis to final,
   clock tree buffer count and depth, worst slack, total negative slack,
   detailed routing violations along the way, runtime per stage.

## Deliberately left for later

**A confidence level on each call.** The real skill is not being right, it is
knowing how sure to be, and that wants a proper scoring rule so that confident
and wrong costs more than unsure and wrong. The engine keeps the call and the
rendering apart so this can be added without reworking either. It needs a
decision about the scale (three levels, or a percentage) before it is built.

**Comparison questions**, where two runs are shown and the player says which
has more of something. Same data, different shape, and often a better question
than an absolute threshold.

## Out of scope

Numbers from commercial tools, which cannot be published, and any metric whose
value depends on the machine rather than the design (runtime in seconds,
memory in megabytes) unless the question is explicitly about those.
