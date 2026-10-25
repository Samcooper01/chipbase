# Stub tool shell for script-writing problems, run by the browser grader
# (toolkit.js) in Tcl compiled to WebAssembly. Fakes the small command set
# of a Synopsys-style physical-design shell over an in-memory fake design,
# so a learner's script can be executed and graded on its EFFECTS (final
# design state plus printed output) without any real tool in the loop.
#
# The fake design database lives in the global DB array:
#   DB(cells)  dict: instance name -> master (library cell) name
#   DB(ports)  dict: port name -> direction (in | out)
#   DB(nets)   dict: net name -> fanout count
#   DB(clocks) dict: clock name -> {period <ns> port <name>}
# A problem's design.tcl overwrites these after this file is sourced.

set ::DB(cells) [dict create]
set ::DB(ports) [dict create]
set ::DB(nets) [dict create]
set ::DB(clocks) [dict create]
set ::TRACE {}

proc _match_filter {master filter} {
    if {![regexp {^\s*ref_name\s*(==|!=|=~)\s*"?([^"\s]+)"?\s*$} $filter -> op val]} {
        error "the stub shell supports only ref_name filters (==, !=, =~), got: $filter"
    }
    switch -- $op {
        == { return [expr {$master eq $val}] }
        != { return [expr {$master ne $val}] }
        =~ { return [string match $val $master] }
    }
}

proc get_cells {args} {
    set pattern *
    set filter ""
    for {set i 0} {$i < [llength $args]} {incr i} {
        set a [lindex $args $i]
        if {$a eq "-filter"} {
            incr i
            set filter [lindex $args $i]
        } elseif {$a eq "-quiet"} {
            # accepted and ignored
        } else {
            set pattern $a
        }
    }
    set result {}
    dict for {name master} $::DB(cells) {
        if {![string match $pattern $name]} { continue }
        if {$filter ne "" && ![_match_filter $master $filter]} { continue }
        lappend result $name
    }
    return $result
}

proc get_ports {args} {
    set pattern [expr {[llength $args] ? [lindex $args 0] : "*"}]
    if {$pattern eq "-quiet"} { set pattern [lindex $args 1] }
    set result {}
    dict for {name dir} $::DB(ports) {
        if {[string match $pattern $name]} { lappend result $name }
    }
    return $result
}

proc all_inputs {} {
    set result {}
    dict for {name dir} $::DB(ports) {
        if {$dir eq "in"} { lappend result $name }
    }
    return $result
}

proc all_outputs {} {
    set result {}
    dict for {name dir} $::DB(ports) {
        if {$dir eq "out"} { lappend result $name }
    }
    return $result
}

proc get_nets {args} {
    set pattern [expr {[llength $args] ? [lindex $args 0] : "*"}]
    set result {}
    dict for {name fanout} $::DB(nets) {
        if {[string match $pattern $name]} { lappend result $name }
    }
    return $result
}

proc get_clocks {args} {
    set pattern [expr {[llength $args] ? [lindex $args 0] : "*"}]
    set result {}
    dict for {name info} $::DB(clocks) {
        if {[string match $pattern $name]} { lappend result $name }
    }
    return $result
}

proc foreach_in_collection {varName coll body} {
    uplevel 1 [list foreach $varName $coll $body]
}

proc sizeof_collection {coll} {
    return [llength $coll]
}

proc get_attribute {obj attr} {
    set obj [lindex $obj 0]
    if {[dict exists $::DB(cells) $obj]} {
        switch -- $attr {
            ref_name  { return [dict get $::DB(cells) $obj] }
            full_name { return $obj }
        }
    }
    if {[dict exists $::DB(ports) $obj]} {
        switch -- $attr {
            direction { return [dict get $::DB(ports) $obj] }
            full_name { return $obj }
        }
    }
    if {[dict exists $::DB(nets) $obj]} {
        switch -- $attr {
            fanout    { return [dict get $::DB(nets) $obj] }
            full_name { return $obj }
        }
    }
    if {[dict exists $::DB(clocks) $obj]} {
        switch -- $attr {
            period { return [dict get $::DB(clocks) $obj period] }
        }
    }
    error "unknown attribute '$attr' for object '$obj' in the stub shell"
}

proc size_cell {cell new_master} {
    set cell [lindex $cell 0]
    if {![dict exists $::DB(cells) $cell]} {
        error "size_cell: no cell named '$cell' in the design"
    }
    if {$new_master eq ""} {
        error "size_cell: empty master name"
    }
    dict set ::DB(cells) $cell $new_master
    lappend ::TRACE [list size_cell $cell $new_master]
    return 1
}

proc create_clock {args} {
    set name ""
    set period ""
    set ports {}
    for {set i 0} {$i < [llength $args]} {incr i} {
        set a [lindex $args $i]
        switch -- $a {
            -name   { incr i; set name [lindex $args $i] }
            -period { incr i; set period [lindex $args $i] }
            default { set ports [concat $ports $a] }
        }
    }
    if {$period eq ""} { error "create_clock requires -period" }
    set port [lindex $ports 0]
    if {$port ne "" && ![dict exists $::DB(ports) $port]} {
        error "create_clock: no port named '$port' in the design"
    }
    if {$name eq ""} { set name $port }
    if {$name eq ""} { error "create_clock needs -name or a target port" }
    dict set ::DB(clocks) $name [dict create period $period port $port]
    lappend ::TRACE [list create_clock $name $period $port]
    return $name
}

# The design state after the learner's script, returned as the Tcl result
# rather than printed, so nothing the script prints can be mistaken for it.
# One record per line: cell|name|master, port|name|dir, net|name|fanout,
# clock|name|period|port, trace|command|args...
proc dump_state {} {
    set lines {}
    dict for {n m} $::DB(cells)  { lappend lines "cell|$n|$m" }
    dict for {n d} $::DB(ports)  { lappend lines "port|$n|$d" }
    dict for {n f} $::DB(nets)   { lappend lines "net|$n|$f" }
    dict for {n c} $::DB(clocks) {
        lappend lines "clock|$n|[dict get $c period]|[dict get $c port]"
    }
    foreach t $::TRACE { lappend lines "trace|[join $t |]" }
    return [join $lines \n]
}
