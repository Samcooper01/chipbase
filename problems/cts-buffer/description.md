## The task

CTS (Clock Tree Synthesis) must deliver the clock to **2000 flip-flop
sinks**. You control two knobs in `cts.tcl`:

```tcl
set clock_buffer <BUF_X2 | BUF_X4 | BUF_X8>
set max_fanout   <2 … 64>
```

The tree is built as levels of identical buffers, each driving at most
`max_fanout` children, until every sink is reached. Hit **all three**
budgets:

- **Skew** ≤ 65 ps - the spread in clock arrival between the earliest and
  latest sink. Skew eats directly into every setup and hold margin.
- **Insertion delay** ≤ 550 ps - source-to-sink latency through the tree.
  Deep, slow trees make the clock arrive late everywhere; that inflates
  the impact of on-chip variation and complicates interface timing.
- **Clock power** ≤ 0.30 mW - the clock tree toggles *every cycle*; it is
  routinely one of the biggest single power consumers on the chip.

## The physics of the trade-off

Each buffer's stage delay grows with the load it drives - roughly
"intrinsic delay + slope × fanout". The three buffer flavors differ:

| Buffer | Intrinsic delay (ps) | Delay per fanout (ps) | Power per buffer (µW) |
| --- | --- | --- | --- |
| `BUF_X2` (small) | 28 | 9.0 | 0.9 |
| `BUF_X4` (medium) | 34 | 4.5 | 1.6 |
| `BUF_X8` (large) | 42 | 2.6 | 2.9 |

- **High fanout, small buffer**: few buffers (cheap power), but each stage
  is slow and sloppy → skew and insertion delay blow up.
- **Low fanout**: fast crisp stages, but the tree needs *many* levels and
  a small army of buffers → power blows up.
- **Bigger buffers** tolerate fanout better but each one costs more power.

## The model

Graded by the **instant model** engine (calibrated stand-in for a CTS
(Clock Tree Synthesis) run):

> depth = ceil(log(2000) ÷ log(max_fanout))
> stage delay = intrinsic + slope × max_fanout
> insertion delay = depth × stage delay
> skew = 8 + 0.30 × stage delay + 3 × depth
> buffers = ceil(2000 ÷ (max_fanout − 1)); power = buffers × per-buffer power

> **Hint:** the middle buffer with a middling fanout is a good place to
> start - then reason about *which* budget fails and turn the knob that
> targets it.
