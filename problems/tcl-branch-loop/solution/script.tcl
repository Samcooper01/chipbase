# Reference solution.
set slacks {0.12 -0.05 0.30 -0.42 0.08}

set violations 0
foreach s $slacks {
    if {$s < 0} {
        puts "VIOLATED $s"
        incr violations
    } else {
        puts "MET $s"
    }
}
puts "violations: $violations"
