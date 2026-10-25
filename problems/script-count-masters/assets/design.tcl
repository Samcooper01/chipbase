# Fake design for this problem: 14 instances over 5 masters.
set ::DB(cells) [dict create \
    u_drv0   BUF_X1 \
    u_drv1   BUF_X1 \
    u_drv2   BUF_X1 \
    u_clkb0  BUF_X2 \
    u_clkb1  BUF_X2 \
    u_inv0   INV_X1 \
    u_inv1   INV_X1 \
    u_ff0    DFF_X1 \
    u_ff1    DFF_X1 \
    u_ff2    DFF_X1 \
    u_ff3    DFF_X1 \
    u_nand0  NAND2_X1 \
    u_nand1  NAND2_X1 \
    u_nand2  NAND2_X1 \
]
