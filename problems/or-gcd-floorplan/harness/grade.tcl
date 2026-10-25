# Grading harness (fixed - the learner never edits this file).
# Loads the sky130hd platform data and the synthesized gcd netlist, runs
# the learner's floorplan.tcl, then measures the resulting floorplan
# straight out of the OpenROAD design database and writes metrics.json.

set platform $::env(PDLEET_PLATFORM_DIR)

read_lef $platform/lef/sky130_fd_sc_hd.tlef
read_lef $platform/lef/sky130_fd_sc_hd_merged.lef
read_liberty $platform/lib/sky130_fd_sc_hd__tt_025C_1v80.lib

read_verilog gcd_synth.v
link_design gcd
read_sdc gcd_synth.sdc

# ---- the submission ----
source floorplan.tcl
# ------------------------

set block [ord::get_db_block]

set utilization 0.0
set aspect_ratio 0.0
set core_w_um 0.0
set core_h_um 0.0
catch {
    set dbu [$block getDbUnitsPerMicron]
    set core [$block getCoreArea]
    set core_w_um [expr {double([$core dx]) / $dbu}]
    set core_h_um [expr {double([$core dy]) / $dbu}]
    set core_area [expr {$core_w_um * $core_h_um}]

    set cell_area 0.0
    foreach inst [$block getInsts] {
        set master [$inst getMaster]
        set w [expr {double([$master getWidth]) / $dbu}]
        set h [expr {double([$master getHeight]) / $dbu}]
        set cell_area [expr {$cell_area + $w * $h}]
    }
    if {$core_area > 0} {
        set utilization [expr {$cell_area / $core_area}]
    }
    if {$core_w_um > 0} {
        set aspect_ratio [expr {$core_h_um / $core_w_um}]
    }
}

set tracks_ok 0
catch {
    if {[llength [$block getTrackGrids]] > 0} { set tracks_ok 1 }
}

# Every block-level pin must be placed, on one of the agreed metal layers.
set pins_total 0
set pins_placed 0
set layer_violations 0
catch {
    foreach bterm [$block getBTerms] {
        incr pins_total
        set placed 0
        foreach bpin [$bterm getBPins] {
            set status [$bpin getPlacementStatus]
            if {$status eq "PLACED" || $status eq "FIRM" || $status eq "LOCKED"} {
                set placed 1
                foreach box [$bpin getBoxes] {
                    set layer [$box getTechLayer]
                    if {$layer ne "NULL"} {
                        set lname [$layer getName]
                        if {$lname ne "met2" && $lname ne "met3"} {
                            incr layer_violations
                        }
                    }
                }
            }
        }
        if {$placed} { incr pins_placed }
    }
}
set pins_ok 0
if {$pins_total > 0 && $pins_placed == $pins_total && $layer_violations == 0} {
    set pins_ok 1
}

set fp [open metrics.json w]
puts $fp "{"
puts $fp "  \"metrics\": {"
puts $fp [format "    \"utilization\": %.4f," $utilization]
puts $fp [format "    \"aspect_ratio\": %.4f," $aspect_ratio]
puts $fp [format "    \"core_width_um\": %.2f," $core_w_um]
puts $fp [format "    \"core_height_um\": %.2f," $core_h_um]
puts $fp [format "    \"tracks_ok\": %d," $tracks_ok]
puts $fp [format "    \"pins_placed\": %d," $pins_placed]
puts $fp [format "    \"pins_total\": %d," $pins_total]
puts $fp [format "    \"pins_ok\": %d" $pins_ok]
puts $fp "  },"
puts $fp [format "  \"notes\": \[\"real OpenROAD run: %d of %d pins placed, %d pin-layer violations\"\]" \
    $pins_placed $pins_total $layer_violations]
puts $fp "}"
close $fp
