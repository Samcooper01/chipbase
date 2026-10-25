# Reference solution.
set masters {BUF_X1 INV_X1 DFF_X1 NAND2_X1}

puts "count: [llength $masters]"
puts "first: [lindex $masters 0]"
puts "last: [lindex $masters end]"

foreach m $masters {
    puts "- $m"
}
