# Fake design for this problem: three clock inputs plus some data ports.
set ::DB(ports) [dict create \
    sys_clk  in \
    io_clk   in \
    ddr_clk  in \
    rst_n    in \
    data_in  in \
    data_out out \
]
