# The Nangate45 gcd design's own grid (designs/nangate45/gcd/grid_strategy-M1-M4-M7.tcl)
# with the upper straps narrowed and the pitches kept:
# metal4: 0.48 wide -> 0.20 wide, pitch 28 unchanged
# metal7: 1.40 wide -> 0.40 wide (the narrowest the rules allow), pitch 15 unchanged
####################################
# global connections
####################################
add_global_connection -net {VDD} -inst_pattern {.*} -pin_pattern {^VDD$} -power
add_global_connection -net {VDD} -inst_pattern {.*} -pin_pattern {^VDDPE$}
add_global_connection -net {VDD} -inst_pattern {.*} -pin_pattern {^VDDCE$}
add_global_connection -net {VSS} -inst_pattern {.*} -pin_pattern {^VSS$} -ground
add_global_connection -net {VSS} -inst_pattern {.*} -pin_pattern {^VSSE$}
global_connect
####################################
# voltage domains
####################################
set_voltage_domain -name {CORE} -power {VDD} -ground {VSS}
####################################
# standard cell grid
####################################
define_pdn_grid -name {grid} -voltage_domains {CORE}
add_pdn_stripe -grid {grid} -layer {metal1} -width {0.17} -pitch {2.4} -offset {0} -followpins
add_pdn_stripe -grid {grid} -layer {metal4} -width {0.20} -pitch {28.0} -offset {2}
add_pdn_stripe -grid {grid} -layer {metal7} -width {0.40} -pitch {15.0} -offset {2}
add_pdn_connect -grid {grid} -layers {metal1 metal4}
add_pdn_connect -grid {grid} -layers {metal4 metal7}
