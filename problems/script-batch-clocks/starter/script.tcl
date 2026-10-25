# Create one clock per entry in this table. Clock name = port name,
# period in nanoseconds from the frequency in megahertz.
set clock_freqs [dict create sys_clk 500 io_clk 100 ddr_clk 800]

# Available: create_clock -name <n> -period <ns> [get_ports <p>],
# plus plain Tcl: dict for {k v} $clock_freqs { ... }, expr.
#
# TODO: write the loop.
