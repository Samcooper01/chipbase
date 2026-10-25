## Lesson: numbers live inside `expr`

Since every value is a string, the language does **no math on its own**:
`set x 2+3` stores the five-character string `2+3`. Math happens inside
the `expr` command:

```tcl
set width 240
set area [expr {$width * 150}]
```

Two new pieces of syntax here:

- **Square brackets `[...]` run a command and paste its result in.**
  This is command substitution, and it is how you chain everything in
  this language: `[expr ...]`, and later `[get_cells ...]`.
- **Always wrap the expression in braces `{...}`.** `expr {$a * $b}` is
  the correct idiom. It is faster and safer than the unbraced form
  (unbraced expressions get substituted twice, a classic source of bugs
  and even security holes in tool scripts). Make it a reflex now.

**The integer-division trap.** Operators follow C rules:

```tcl
expr {1000 / 800}     ;# 1     (both integers -> integer division!)
expr {1000.0 / 800}   ;# 1.25  (one float makes it float math)
```

You already met this trap warning in the clock-creation interview
problem. This is where it comes from.

## Task

Your starter file defines:

```tcl
set width 240
set height 150
set cell_area 21600.0
```

Compute and print **exactly** these three lines (a rectangular core,
its utilization, and its half perimeter):

```
core area: 36000
utilization: 0.6
half perimeter: 390
```

- core area = width × height
- utilization = cell area ÷ core area
- half perimeter = width + height

Note `utilization` prints as `0.6`: that only happens if the division is
done in floating point (`cell_area` is already `21600.0` for exactly
this reason).
