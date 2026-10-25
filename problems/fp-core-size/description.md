## The task

You are floorplanning a small digital block. Synthesis says the block's
standard cells add up to **48,400 µm²** of cell area. Your job: pick the
**core width and height** (in µm) so the block is neither wastefully empty
nor impossibly crowded.

Edit `floorplan.tcl` and set:

```tcl
set core_width  <µm>
set core_height <µm>
```

## What you're balancing

**Utilization** is the fraction of the core area actually covered by
standard cells:

> utilization = total cell area ÷ (core width × core height)

- **Too low** (say under 0.50): you're taping out empty silicon - area is
  money, and long wires between spread-out cells hurt timing and power.
- **Too high** (say over 0.80): the router runs out of space. Every signal
  still has to get from cell to cell through the metal stack, and the
  placer also needs slack space for buffers, sizing moves, and ECO
  (Engineering Change Order) fixes late in the flow.

A comfortable starting point for a typical block is **60-72%** - exactly
the window this problem grades.

**Aspect ratio** (height ÷ width) matters too: a long, skinny core gives
the router lots of capacity in one direction and almost none in the other,
and it makes timing across the long dimension painful. Staying within
roughly 0.6-1.67 (that is, no worse than about 1 : 1.67 either way) keeps
routing resources balanced.

## Grading

The grader computes utilization and aspect ratio from your two numbers and
checks both windows. This one is graded by the **instant model** engine  - 
pure arithmetic, no layout tool - because at this stage the math *is* the
whole story.

> **Hint:** work backwards. Pick a target utilization inside the window,
> compute the core area it implies, then choose a width/height split with
> a sane aspect ratio.
