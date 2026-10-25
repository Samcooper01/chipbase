## Lesson: name your logic

`proc` defines a command of your own:

```tcl
proc period_ns {freq_mhz} {
    return [expr {1000.0 / $freq_mhz}]
}

puts [period_ns 500]    ;# 2.0
```

Three parts: the name, the argument list (`{freq_mhz}`; several
arguments would be `{a b c}`, defaults look like `{a {b 10}}`), and the
body. `return` hands back the value; call it like any built-in via
`[...]` substitution.

**Scope:** variables inside a procedure are local. A procedure does not
see your script's variables unless you pass them in (or reach out with
`global`/`upvar`, which exist and which you will meet in other people's
scripts, but passing arguments is the clean habit).

Why this matters in real flows: every serious tool setup is a library of
these (`report_worst_paths 10`, `upsize_cells BUF_X1 BUF_X2`). The
interview follow-up to almost any scripting question is "now wrap it in
a proc so the team can reuse it".

## Task

Define `period_ns` exactly as the concept above (frequency in megahertz
in, period in nanoseconds back), then loop over the list in the starter
and print one line per frequency, **exactly**:

```
500 MHz -> 2.0 ns
100 MHz -> 10.0 ns
800 MHz -> 1.25 ns
250 MHz -> 4.0 ns
```

The grader only checks the output, but the point is the shape: compute
in the proc, format in the loop.
