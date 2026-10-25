set sdc_file /out/broken.sdc
source /out/load.tcl
rep broken_check_setup [list check_setup -verbose]
rep broken_uncon       [list report_checks -unconstrained -format end -group_path_count 3]
