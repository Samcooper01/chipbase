# TCL for physical design deck: scope

TCL (Tool Command Language) is the scripting language embedded in every
place-and-route and timing tool, commercial and open, so the same skills move
between them. This deck covers the language as it is actually used in tool
scripts, not Tcl in general.

65 cards in 10 sections.

Where the scope came from: **51 Tcl commands appear in the 3540 lines of Tcl**
that OpenROAD-flow-scripts ships (`flow/scripts` and `flow/platforms`), most
used being `set` (287), `if` (223), `puts` (72), `source` (72), `foreach` (65),
`for` (55), `file` (50), `proc` (49), `lappend` (37), and `expr` (36). That
measurement fixed the core. On top of it the deck covers the idioms a script
meets in a commercial tool as well: collections rather than lists,
`foreach_in_collection`, `get_object_name`, capturing a report's output, and
the cost of querying the database inside a loop.

Cards follow the official [Tcl manual](https://www.tcl-lang.org/man/tcl8.6/TclCmd)
and each answer links to that command's page.

## Sections

1. **Variables and substitution** (8). The three kinds of bracket, quotes
   against braces, why `expr` is a command, why every value is a string, string
   against numeric comparison, delimiting a variable name, and the global
   namespace.
2. **Lists** (8). Building and taking lists apart, `lsearch` and what it
   returns, why list commands return a new list rather than changing one,
   joining and merging, and why passing a variable beats building a command as
   a string.
3. **Control flow** (6). Conditions and loops, the brace rules, `for` and
   `while` as ordinary commands, leaving or skipping a pass, and `switch` with
   patterns and fall-through.
4. **Procedures and scope** (6). Optional and variadic arguments, what a
   procedure returns when it says nothing, `global`, `upvar` for a caller's
   variable, and namespaces as protection against replacing a tool command.
5. **Strings and patterns** (7). Glob matching against regular expressions,
   `regsub` and its return value, collecting every match, `string map`, the
   small string operations that parse a report line, and formatted columns.
6. **Dictionaries and arrays** (6). The modern value-based form against the
   older variable-based one, walking pairs in order, nested paths, and counting
   and collecting into keys that do not exist yet.
7. **Files, processes, and the environment** (8). Reading and writing, the
   line-reading loop and its off-by-one trap, the `file` ensemble and building
   paths, `exec` and what a non-zero exit status does, `source`, and
   `$::env(...)` as the bridge from make.
8. **Errors and robustness** (6). `catch` and its options dictionary, failing
   early with `error`, `try` with a cleanup block, the stack trace, and
   `info exists` for optional settings.
9. **Tool objects and collections** (4). Why a collection is not a list, the
   tool's own loop over one, passing objects rather than names with brackets in
   them, and capturing a report's text into a variable.
10. **Tcl in tool scripts** (6). Building arguments conditionally and expanding
    them with `{*}`, unitless numbers, iterating path objects instead of
    parsing reports, gating a flow between stages, and why a query inside a
    loop is the usual reason a script is slow.

## Out of scope

Tcl's event loop, channels beyond simple file input and output, threads,
packages, and object systems. None appear in a flow script, and none are needed
to read or write one.
