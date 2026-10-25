# Generate real OpenSTA report text for the Timing reports flash-card deck.
# Runs inside the openroad/orfs image after the gcd flow has finished.
set R /OpenROAD-flow-scripts/flow/results/nangate45/gcd/base
set P /OpenROAD-flow-scripts/flow/platforms/nangate45
foreach lib [glob $P/lib/NangateOpenCellLibrary_typical.lib] { read_liberty $lib }
read_db $R/6_final.odb
read_sdc $R/6_final.sdc
source $P/setRC.tcl
if {[file exists $R/6_final.spef]} { read_spef $R/6_final.spef } else { estimate_parasitics -placement }
set_propagated_clock [all_clocks]

proc rep {name body} {
  set f /out/$name.txt
  set fh [open $f w]; puts $fh "% $body"; close $fh
  with_output_to_variable txt { uplevel 1 $body }
  set fh [open $f a]; puts -nonewline $fh $txt; close $fh
}
rep units            {report_units}
rep checks_max       {report_checks}
rep checks_min       {report_checks -path_delay min}
rep checks_clock     {report_checks -format full_clock}
rep checks_clock_exp {report_checks -format full_clock_expanded}
rep checks_fields    {report_checks -fields {slew cap fanout input_pin}}
rep checks_end       {report_checks -format end -group_path_count 5}
rep checks_summary   {report_checks -format summary -group_path_count 5}
rep checks_short     {report_checks -path_delay min_max -format short}
rep checks_ep        {report_checks -group_path_count 3 -endpoint_path_count 2 -format end}
rep checks_input     {report_checks -from [all_inputs] -format full}
rep checks_output    {report_checks -to [all_outputs] -format full}
rep checks_uncon     {report_checks -unconstrained -format end -group_path_count 3}
rep checks_digits    {report_checks -digits 4 -format end}
rep wns              {report_wns}
rep tns              {report_tns}
rep worst_max        {report_worst_slack -max}
rep worst_min        {report_worst_slack -min}
rep check_types      {report_check_types}
rep check_types_viol {report_check_types -violators}
rep check_types_drv  {report_check_types -max_slew -max_capacitance -max_fanout}
rep clock_skew       {report_clock_skew}
rep clock_skew_hold  {report_clock_skew -hold}
rep clock_latency    {report_clock_latency}
rep clock_min_period {report_clock_min_period}
rep clock_props      {report_clock_properties}
rep check_setup      {check_setup -verbose}
rep disabled_edges   {report_disabled_edges}
rep power            {report_power}
rep parasitic_ann    {report_parasitic_annotation}
rep activity_ann     {report_activity_annotation}
# pin- and net-level: pick the worst setup path's endpoint and one net on it
set path [lindex [find_timing_paths -path_delay max] 0]
set ep [get_property $path endpoint]
set ep_name [get_full_name $ep]
set fh [open /out/_names.txt w]; puts $fh "endpoint $ep_name"; close $fh
rep slack_pin        "report_slack $ep_name"
rep arrival_pin      "report_arrival $ep_name"
rep required_pin     "report_required $ep_name"
rep slews_pin        "report_slews $ep_name"
set inst [get_cells -of_objects [get_pins $ep_name]]
set inst_name [get_full_name $inst]
rep instance         "report_instance $inst_name"
set dnet [get_nets -of_objects [get_pins $ep_name]]
set dnet_name [get_full_name $dnet]
set fh [open /out/_names.txt a]; puts $fh "instance $inst_name\nnet $dnet_name"; close $fh
rep net              "report_net $dnet_name"
set drv [get_pins -of_objects $dnet -filter "direction==output"]
set drv_name [get_full_name $drv]
set drv_inst [get_full_name [get_cells -of_objects $drv]]
set fh [open /out/_names.txt a]; puts $fh "driver $drv_name"; close $fh
rep edges            "report_edges -to $drv_name"
rep dcalc            "report_dcalc -to $drv_name"
rep lib_cell         "report_lib_cell [get_full_name [get_lib_cells -of_objects [get_cells $drv_inst]]]"
# a failing design: tighten the clock so setup violates, then report again
create_clock -name core_clock -period 0.25 [get_ports clk]
set_propagated_clock [all_clocks]
rep fail_checks      {report_checks}
rep fail_wns         {report_wns}
rep fail_tns         {report_tns}
rep fail_end         {report_checks -format end -group_path_count 5}
rep fail_viol        {report_check_types -violators}
rep fail_min_period  {report_clock_min_period}
