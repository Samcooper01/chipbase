# Reference solution: drive create_clock from the table.
set clock_freqs [dict create sys_clk 500 io_clk 100 ddr_clk 800]

dict for {port freq_mhz} $clock_freqs {
    set period_ns [expr {1000.0 / $freq_mhz}]
    create_clock -name $port -period $period_ns [get_ports $port]
}
