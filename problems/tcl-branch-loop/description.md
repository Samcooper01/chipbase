## Lesson: branching, and the comparison trap

`if` evaluates its condition like `expr` does (so brace it), and the
`else` keyword must sit on the same line as the closing brace:

```tcl
if {$slack < 0} {
    puts "violated"
} elseif {$slack < 0.05} {
    puts "marginal"
} else {
    puts "fine"
}
```

**The comparison trap you were warned about in the buffer-upsize
problem lives here.** Inside a condition:

- `==` and `!=` compare **numerically** when both sides look like
  numbers. `{"07" == 7}` is true.
- `eq` and `ne` compare **as strings**, always. `{"07" eq "7"}` is
  false.

For cell masters, port names, and anything text, use `eq`/`ne`. For
slack values and counts, use `<`, `<=`, `==`. Using `==` on strings is
the single most common bug in beginner tool scripts, and it works just
often enough to bite you late.

**Counting** uses `incr`:

```tcl
set violations 0
incr violations        ;# adds 1
incr violations 5      ;# adds 5
```

Loop + branch + counter is the skeleton of half of all real tool
scripts: "walk everything, classify, tally".

## Task

The starter defines a list of timing slacks in nanoseconds:

```tcl
set slacks {0.12 -0.05 0.30 -0.42 0.08}
```

Walk the list. For each value print `MET <value>` if the slack is zero
or positive, `VIOLATED <value>` if negative. After the loop print the
violation count. **Exactly**:

```
MET 0.12
VIOLATED -0.05
MET 0.30
VIOLATED -0.42
MET 0.08
violations: 2
```
