# Reference solution.
proc period_ns {freq_mhz} {
    return [expr {1000.0 / $freq_mhz}]
}

set freq_list {500 100 800 250}

foreach f $freq_list {
    puts "$f MHz -> [period_ns $f] ns"
}
