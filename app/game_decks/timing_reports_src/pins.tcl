set sdc_file /OpenROAD-flow-scripts/flow/results/nangate45/gcd/base/6_final.sdc
source /out/load.tcl
set path [lindex [find_timing_paths -path_delay max] 0]
set ep [get_property $path endpoint]
set inst [get_cells -of_objects $ep]
rep slack_pin    [list report_slack $ep]
rep arrival_pin  [list report_arrival $ep]
rep required_pin [list report_required $ep]
rep slews_pin    [list report_slews $ep]
rep instance     [list report_instance $inst]
rep checks_clock [list report_checks -format full_clock]
rep checks_input [list report_checks -from [all_inputs] -format full]
rep power_top    [list report_power -highest_power_instances 5]
