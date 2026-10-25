# Timing constraints for the 500 MHz block.
# TODO: fix the period, fix the input-delay value, stop constraining the
# clock port as data, and add the missing output delays.

create_clock -period 4.0 -name clk [get_ports clk]

set_input_delay 1.0 -clock clk [all_inputs]
