set sdc_file /out/fail.sdc
source /out/load.tcl
rep fail_checks     [list report_checks]
rep fail_min        [list report_checks -path_delay min]
rep fail_wns        [list report_wns]
rep fail_tns        [list report_tns]
rep fail_worst      [list report_worst_slack -max]
rep fail_end        [list report_checks -format end -group_path_count 6]
rep fail_min_end    [list report_checks -path_delay min -format end -group_path_count 4]
rep fail_summary    [list report_checks -format summary -group_path_count 6]
rep fail_types      [list report_check_types]
rep fail_skew       [list report_clock_skew]
rep fail_min_period [list report_clock_min_period]
rep fail_fields     [list report_checks -fields {slew cap fanout}]
