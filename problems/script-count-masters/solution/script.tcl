# Reference solution: accumulate in an array, then print.

array set counts {}
foreach_in_collection cell [get_cells] {
    set master [get_attribute $cell ref_name]
    incr counts($master)
}
foreach master [array names counts] {
    puts "$master $counts($master)"
}
