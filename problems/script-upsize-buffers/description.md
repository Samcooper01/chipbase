## The interview question

> "Timing sign-off found a family of weak drivers. Write a script that
> replaces every `BUF_X1` in the design with `BUF_X2`."

The batch cell-swap is *the* canonical ECO (Engineering Change Order)
scripting question: select by attribute, mutate each match, touch nothing
else. In real life this shape shows up constantly: swapping to
low-leakage cells at the end of the flow, upsizing a clock-buffer family,
downgrading over-designed drivers to save power.

## Your task

Write `script.tcl` so that after it runs:

- **zero** `BUF_X1` instances remain,
- every one of them is now `BUF_X2`,
- **no other instance is modified** (collateral damage is an automatic
  interview fail: your selection must be precise).

The design contains 5 `BUF_X1`, 2 `BUF_X2`, 2 `INV_X1`, and 3 `DFF_X1`
instances.

## The stub shell

Graded on the final state of the fake design, so both selection styles
pass:

```tcl
# style 1: let the tool filter
foreach_in_collection c [get_cells -filter "ref_name == BUF_X1"] { ... }

# style 2: filter yourself
foreach_in_collection c [get_cells] {
    if {[get_attribute $c ref_name] eq "BUF_X1"} { ... }
}
```

Supported commands: `get_cells` (with optional glob pattern and
`-filter "ref_name ==|!=|=~ <value>"`), `foreach_in_collection`,
`get_attribute <cell> ref_name`, `sizeof_collection`, and the mutator:

```tcl
size_cell <cell> <new_master>
```

> **Hint:** the trap in style 2 is `==` vs `eq`. In Tcl (Tool Command
> Language), `==` inside `expr` does numeric-ish comparison; string
> comparison wants `eq`.
