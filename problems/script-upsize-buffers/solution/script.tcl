# Reference solution: select with a filter, mutate each match.

foreach_in_collection cell [get_cells -filter "ref_name == BUF_X1"] {
    size_cell $cell BUF_X2
}
