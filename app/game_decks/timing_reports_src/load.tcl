# Load the routed gcd design with a given constraint file.
set R /OpenROAD-flow-scripts/flow/results/nangate45/gcd/base
set P /OpenROAD-flow-scripts/flow/platforms/nangate45
read_liberty $P/lib/NangateOpenCellLibrary_typical.lib
read_db $R/6_final.odb
read_sdc $::sdc_file
read_spef $R/6_final.spef
proc rep {name cmd} {
  # cmd is a list, so names with brackets or dollar signs are passed intact.
  # with_output_to_variable must be given the command itself (not via uplevel).
  with_output_to_variable txt $cmd
  set fh [open /out/$name.txt w]; puts $fh "% [join $cmd { }]"; puts -nonewline $fh $txt; close $fh
}
