## The interview question

> "Write a script that reports how many instances of each library cell
> the design contains."

This is a real warm-up question in physical-design interviews. It tests
whether you can iterate a collection, read an attribute, accumulate into
an array or dictionary, and print a report. If you can do this cold, a
whole family of questions (count by clock domain, sum area by master,
histogram fanout) is the same shape.

## Your task

Write `script.tcl`. Loop over every cell in the design, count instances
per master (the library cell name, e.g. `BUF_X1`), and print **one line
per master**:

```
<master> <count>
```

Any line order is fine. Nothing else may be printed.

## The stub shell

Your script executes in a stubbed Synopsys-style tool shell over a small
fake design. It is graded on its **effects** (here: what it prints), so
any correct implementation passes. Supported commands:

| Command | Behavior |
| --- | --- |
| `get_cells ?pattern? ?-filter "ref_name == X"?` | collection of cell instances |
| `foreach_in_collection var coll { body }` | iterate a collection |
| `get_attribute <cell> ref_name` | the cell's master name |
| `sizeof_collection coll` | number of items |
| `puts` | ordinary printing |

Plain Tcl (Tool Command Language) is fully available: `array`, `dict`,
`foreach`, `incr`, `expr`, procs.

> **Hint:** `incr counts($master)` on a never-seen array element starts
> it at zero and bumps it to one. That idiom is the whole accumulator.
