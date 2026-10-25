# Reference solution: 500 MHz → 2.0 ns period.

create_clock -period 2.0 -name clk [get_ports clk]

set_input_delay 0.6 -clock clk [remove_from_collection [all_inputs] [get_ports clk]]

set_output_delay 0.7 -clock clk [all_outputs]
