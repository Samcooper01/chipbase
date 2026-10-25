## The task

Global placement takes one knob here: **target density** - how tightly
the placer may pack cells into each region of the core (0 = spread out
completely, 1 = pack solid). Edit `place.tcl`:

```tcl
set target_density <0.05 … 0.99>
```

Find a value where **both** quality metrics pass:

- **HPWL (Half-Perimeter Wire Length)** - the standard placement
  wirelength estimate: for each net, half the perimeter of the bounding
  box around its pins, summed over all nets. Long wires mean more delay,
  more buffers, more power.
- **Congestion overflow** - the percentage of routing demand that exceeds
  routing supply in the worst regions. Too much and the detailed router
  simply cannot finish (or finishes with a pile of DRC (Design Rule
  Check) violations).

## The tension

Pack cells **tighter** (higher density) and connected cells sit closer
together → wirelength drops. But the wires still need metal tracks above
those tightly packed cells, and pin density rises → congestion explodes.
Spread cells **out** (lower density) and the router breathes easily - but
every net gets longer.

Real placers expose exactly this knob (for example `-density` in
OpenROAD's global placer), and choosing it is a routine tuning task.

## The model

This problem grades with the **instant model** engine - a calibrated
analytical stand-in for a placer run, so you get feedback in
milliseconds. For a fixed netlist it computes:

> wirelength = 1,200,000 × (0.55 ÷ density)^0.8 µm
> overflow = 0.5 + 25 × max(0, density − 0.62)^1.3 %

The shape is what matters: wirelength falls monotonically with density,
congestion is flat until a knee and then takes off. That is faithful to
how the real trade-off behaves.

> **Hint:** there is a comfortable band, not a single magic value. Find
> where the wirelength check *starts* passing and where the congestion
> check *stops* passing.
