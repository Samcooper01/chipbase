## Lesson: tables of key → value

The modern key-value structure is the `dict`:

```tcl
set freqs [dict create sys_clk 500 io_clk 100 ddr_clk 800]

dict get $freqs io_clk        ;# 100
dict set freqs spi_clk 25     ;# add/overwrite (name, no $: it modifies)
dict exists $freqs usb_clk    ;# 0
dict size $freqs              ;# 4
```

Iteration walks entries **in insertion order** (that is guaranteed,
and this task depends on it):

```tcl
dict for {port freq} $freqs {
    puts "$port runs at $freq MHz"
}
```

You will also meet the older `array` in real tool scripts
(`set counts(BUF_X1) 7`, `$counts(BUF_X1)`, `array names counts`).
Arrays are fine for accumulators (you used one shape of this in the
instance-counting interview problem), but they cannot be passed around
as values; dicts can. New code: prefer dicts.

This problem is the direct rehearsal for the clock-creation interview
question: same table, same loop, same unit conversion, just `puts`
instead of `create_clock`.

## Task

The starter defines:

```tcl
set freqs [dict create sys_clk 500 io_clk 100 ddr_clk 800]
```

Loop with `dict for` and print each clock's period in nanoseconds
(1000.0 ÷ megahertz), **exactly**:

```
sys_clk: 2.0 ns
io_clk: 10.0 ns
ddr_clk: 1.25 ns
```

> **Hint:** if you get `2` instead of `2.0`, you fell into the
> integer-division trap from Basics 2.
