## Lesson: the list is THE data structure

Tool shells hand you almost everything as a list: the cells matching a
pattern, the ports of the design, the clocks. In Tcl (Tool Command
Language), a list is just a string of whitespace-separated words, and
braces make literal ones:

```tcl
set masters {BUF_X1 INV_X1 DFF_X1 NAND2_X1}
```

The core list commands:

```tcl
llength $masters          ;# 4          (number of items)
lindex $masters 0         ;# BUF_X1     (zero-based indexing)
lindex $masters end       ;# NAND2_X1   ('end' is a real index)
lappend masters AOI21_X1  ;# append in place (note: no $ on the name)
```

`lappend` takes the **name** of the variable (no `$`) because it
modifies it. Reading commands take the **value** (`$masters`).

**Iteration** is `foreach`:

```tcl
foreach m $masters {
    puts "master: $m"
}
```

The body runs once per item with `m` bound to it. In tool scripts you
will constantly write this exact loop over `[get_cells ...]` (the shell
variant `foreach_in_collection` from the interview problems behaves the
same way).

One brace rule to internalize: the opening `{` of a body must sit **on
the same line** as the command (`foreach ... {`). Unlike C, putting it
on the next line is a syntax error, because a newline ends a command.

## Task

Starting from the list in the starter file, print **exactly**:

```
count: 4
first: BUF_X1
last: NAND2_X1
- BUF_X1
- INV_X1
- DFF_X1
- NAND2_X1
```

First three lines via `llength` and `lindex` (use `end` for the last),
then one `- ` line per item via `foreach`.
