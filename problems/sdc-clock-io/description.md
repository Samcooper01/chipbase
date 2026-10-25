## The task

A block arrives with this port list:

| Port | Direction |
| --- | --- |
| `clk` | input (the clock) |
| `rst_n`, `valid_in`, `data_in[7:0]` | inputs |
| `valid_out`, `data_out[7:0]` | outputs |

Marketing promised **500 MHz**. Write the SDC (Synopsys Design
Constraints) file that tells STA (Static Timing Analysis) what "meeting
timing" even means:

1. Create a clock named `clk` on port `clk` with the right period (the
   unit here is **nanoseconds**).
2. Budget **0.6 ns** of input delay for every data input, relative to
   `clk` - that's the launch time the upstream block consumes.
3. Budget **0.7 ns** of output delay for every output, relative to `clk`
   - the setup time the downstream block will need.

## Why this matters

Without constraints, timing analysis is meaningless: the tool would
happily report that an unconstrained path "meets timing" at any frequency.
The SDC (Synopsys Design Constraints) file is the *contract* - every
synthesis, placement, clock-tree, and routing step optimizes against it.
Garbage in, garbage timing closure out.

## The classic gotcha

`[all_inputs]` includes **the clock port itself**. Constraining `clk` with
`set_input_delay` treats it as a *data* pin - the timer then analyzes a
nonsense path through the clock port, and real tools will spray warnings
(or worse, quietly mis-time paths). Exclude it:

```tcl
[remove_from_collection [all_inputs] [get_ports clk]]
```

The grader explicitly checks that you did **not** apply input delay to
`clk`.

## Useful commands

`create_clock`, `set_input_delay`, `set_output_delay`,
`[all_inputs]`, `[all_outputs]`, `[get_ports ...]`,
`[remove_from_collection ...]`

> **Hint:** period in ns = 1000 ÷ frequency in MHz.
