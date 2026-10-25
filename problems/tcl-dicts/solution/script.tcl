# Reference solution.
set freqs [dict create sys_clk 500 io_clk 100 ddr_clk 800]

dict for {port freq} $freqs {
    set period [expr {1000.0 / $freq}]
    puts "$port: $period ns"
}
