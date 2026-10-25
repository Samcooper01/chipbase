## The interview question

> "The design has several clock inputs, each at a different frequency.
> Write a script that creates all the clocks from a frequency table,
> instead of copy-pasting `create_clock` lines."

Interviewers love this one because it catches two things at once: can
you drive constraint commands from a data structure (the mark of someone
who has maintained a real constraint methodology), and do you convert
**megahertz to nanoseconds** without dropping a factor of a thousand.

## Your task

The frequency table is given at the top of the starter file:

```tcl
set clock_freqs [dict create sys_clk 500 io_clk 100 ddr_clk 800]
```

Ports `sys_clk`, `io_clk`, and `ddr_clk` exist in the design. Loop over
the table and create one clock per entry where:

- the clock **name** equals the port name,
- the clock sits **on** that port,
- the **period is in nanoseconds** computed from the frequency in
  megahertz.

No hard-coded three-lines-in-a-row solutions: that passes the grader
here, but write the loop - it is the whole point of the exercise, and
the follow-up interview question is always "now do it for 40 clocks".

## The stub shell

Graded on the final clock state of the fake design. Supported commands:
`create_clock -name <n> -period <ns> [get_ports <p>]`, `get_ports`,
`get_clocks`, `foreach_in_collection`, plus all of plain Tcl (Tool
Command Language): `dict for`, `expr`, `foreach`.

> **Hint:** period in ns = 1000.0 ÷ frequency in MHz. Use `1000.0`, not
> `1000`: integer division is the other classic trap here.
