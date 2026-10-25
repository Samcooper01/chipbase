# Reference solution: medium buffer, moderate fanout.
# depth 3, stage delay 106 ps → insertion 318 ps, skew ≈ 49 ps,
# 134 buffers → 0.21 mW. All three budgets met.

set clock_buffer BUF_X4
set max_fanout   16
