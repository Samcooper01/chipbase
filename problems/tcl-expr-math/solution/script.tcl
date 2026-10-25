# Reference solution.
set width 240
set height 150
set cell_area 21600.0

set core_area [expr {$width * $height}]
set utilization [expr {$cell_area / $core_area}]
set half_perimeter [expr {$width + $height}]

puts "core area: $core_area"
puts "utilization: $utilization"
puts "half perimeter: $half_perimeter"
