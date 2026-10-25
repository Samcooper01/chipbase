"""Lab registry: specs and prompts for the macro-placement engine."""

from .place_specs import (
    PLACE_WL_SPEC, PLACE_TIMING_SPEC, PLACE_CONG_SPEC, PLACE_REGION_SPEC,
    PLACE_LEGALIZE_SPEC, PLACE_SWAP_SPEC, PLACE_COMBO_SPEC,
    PLACE_MIXED_SPEC, PLACE_REGCLUSTER_SPEC, PLACE_GATESIZE_SPEC,
    PLACE_FLIP_SPEC, PLACE_FILLER_SPEC, PLACE_PAD_SPEC,
)
from .cts_specs import (
    CTS_SOURCE_SPEC, CTS_HTREE_SPEC, CTS_BUFFER_SPEC, CTS_SKEWBAL_SPEC,
    CTS_GATING_SPEC, CTS_BANKING_SPEC, CTS_USESKEW_SPEC, CTS_NDR_SPEC,
    CTS_CLUSTER_SPEC, CTS_MESH_SPEC, CTS_SPINE_SPEC, CTS_XTREE_SPEC,
    CTS_DEPTH_SPEC,
)
from .routing_specs import (
    ROUTE_MAZE_SPEC, ROUTE_GLOBAL_SPEC, ROUTE_RIPUP_SPEC, ROUTE_LAYER_SPEC,
    ROUTE_TRACK_SPEC, ROUTE_DRC_SPEC, ROUTE_VIAMIN_SPEC, ROUTE_ANTENNA_SPEC,
    ROUTE_LENGTH_SPEC, ROUTE_XTALK_SPEC, ROUTE_STEINER_SPEC, ROUTE_PINACCESS_SPEC,
)
from .sta_specs import (
    STA_SLACK_SPEC, STA_SETUPHOLD_SPEC, STA_CRITICAL_SPEC, STA_UNCERTAINTY_SPEC,
    STA_EXCEPTIONS_SPEC, STA_CORNERS_SPEC, STA_OCV_SPEC, STA_XTALK_SPEC, STA_REPORT_SPEC,
    STA_IO_SPEC, STA_BORROW_SPEC,
)
from .pv_specs import (
    PV_WIDTH_SPEC, PV_ENCLOSURE_SPEC, PV_SPACING_SPEC, PV_DENSITY_SPEC,
    PV_LVS_SPEC, PV_DEVICE_SPEC, PV_ERC_SPEC, PV_SIGNOFF_SPEC,
    PV_ANTENNA_SPEC, PV_DFM_SPEC,
)
from .eco_specs import (
    ECO_BUFFER_SPEC, ECO_VTSWAP_SPEC, ECO_PINSWAP_SPEC, ECO_CLONE_SPEC,
    ECO_HOLD_SPEC, ECO_SKEW_SPEC, ECO_METAL_SPEC, ECO_RESPIN_SPEC,
    ECO_DRV_SPEC, ECO_RESTRUCT_SPEC, ECO_LEGAL_SPEC,
)
from .synth_specs import (
    SYNTH_TWOLEVEL_SPEC, SYNTH_CONSTPROP_SPEC, SYNTH_FACTOR_SPEC,
    SYNTH_MAP_AREA_SPEC, SYNTH_MAP_DELAY_SPEC, SYNTH_RETIME_SPEC,
    SYNTH_FSM_SPEC, SYNTH_DATAPATH_SPEC,
)

MANUAL_SPEC = {   'core': {'w': 180, 'h': 180},
    'halo': 4,
    'grid': 20,
    'capacity': 0.8,
    'bgDemand': 0.26,
    'overflowTol': 0.06,
    'pins': [   {'id': 'mem', 'x': 180, 'y': 90},
                {'id': 'l2c', 'x': 0, 'y': 88},
                {'id': 'clk', 'x': 80, 'y': 0},
                {'id': 'periph', 'x': 92, 'y': 180},
                {'id': 'debug', 'x': 180, 'y': 145},
                {'id': 'jtag', 'x': 24, 'y': 0},
                {'id': 'gpio', 'x': 0, 'y': 145},
                {'id': 'pll', 'x': 135, 'y': 0}],
    'macros': [   {'id': 'l2$', 'label': 'l2$', 'w': 36, 'h': 28, 'x': 58, 'y': 69, 'fixed': None},
                  {   'id': 'l1d$',
                      'label': 'l1d$',
                      'w': 22,
                      'h': 20,
                      'x': 67,
                      'y': 43,
                      'fixed': None},
                  {   'id': 'l1i$',
                      'label': 'l1i$',
                      'w': 22,
                      'h': 18,
                      'x': 98,
                      'y': 10,
                      'fixed': None},
                  {'id': 'btb', 'label': 'btb', 'w': 16, 'h': 26, 'x': 107, 'y': 65, 'fixed': None},
                  {'id': 'exec', 'label': 'exec', 'w': 34, 'h': 24, 'x': 8, 'y': 70, 'fixed': None},
                  {'id': 'fpu', 'label': 'fpu', 'w': 22, 'h': 20, 'x': 126, 'y': 17, 'fixed': None},
                  {'id': 'alu', 'label': 'alu', 'w': 18, 'h': 14, 'x': 33, 'y': 115, 'fixed': None},
                  {   'id': 'iregs',
                      'label': 'iregs',
                      'w': 16,
                      'h': 14,
                      'x': 42,
                      'y': 3,
                      'fixed': None},
                  {   'id': 'fregs',
                      'label': 'fregs',
                      'w': 16,
                      'h': 14,
                      'x': 131,
                      'y': 55,
                      'fixed': None},
                  {'id': 'lsu', 'label': 'lsu', 'w': 20, 'h': 16, 'x': 47, 'y': 149, 'fixed': None},
                  {'id': 'ldq', 'label': 'ldq', 'w': 13, 'h': 22, 'x': 164, 'y': 60, 'fixed': None},
                  {'id': 'stq', 'label': 'stq', 'w': 13, 'h': 22, 'x': 73, 'y': 8, 'fixed': None},
                  {   'id': 'uart',
                      'label': 'uart',
                      'w': 12,
                      'h': 11,
                      'x': 128,
                      'y': 158,
                      'fixed': None},
                  {'id': 'spi', 'label': 'spi', 'w': 12, 'h': 11, 'x': 73, 'y': 152, 'fixed': None},
                  {   'id': 'timer',
                      'label': 'timer',
                      'w': 12,
                      'h': 11,
                      'x': 90,
                      'y': 131,
                      'fixed': None}],
    'nets': [   {   'id': 'anc_l2$',
                    'terminals': [{'macro': 'l2$'}, {'pin': 'mem'}],
                    'weight': 1.4,
                    'critical': True,
                    'budget': 129},
                {   'id': 'anc_exec',
                    'terminals': [{'macro': 'exec'}, {'pin': 'l2c'}],
                    'weight': 1.4,
                    'critical': True,
                    'budget': 45},
                {   'id': 'anc_iregs',
                    'terminals': [{'macro': 'iregs'}, {'pin': 'clk'}],
                    'weight': 1.4,
                    'critical': True,
                    'budget': 44},
                {   'id': 'anc_lsu',
                    'terminals': [{'macro': 'lsu'}, {'pin': 'periph'}],
                    'weight': 1.4,
                    'critical': True,
                    'budget': 66},
                {   'id': 'n0',
                    'terminals': [{'macro': 'l2$'}, {'macro': 'l1d$'}, {'macro': 'l1i$'}],
                    'weight': 1.3,
                    'critical': True,
                    'budget': 94},
                {   'id': 'n1',
                    'terminals': [   {'macro': 'iregs'},
                                     {'macro': 'alu'},
                                     {'macro': 'fpu'},
                                     {'macro': 'l1i$'}],
                    'weight': 1.2},
                {   'id': 'n2',
                    'terminals': [{'macro': 'fregs'}, {'macro': 'l1d$'}, {'macro': 'alu'}],
                    'weight': 1.2},
                {   'id': 'n3',
                    'terminals': [{'macro': 'exec'}, {'macro': 'l2$'}, {'macro': 'fpu'}],
                    'weight': 1.2},
                {'id': 'n4', 'terminals': [{'macro': 'btb'}, {'macro': 'l1d$'}], 'weight': 1},
                {   'id': 'n5',
                    'terminals': [{'macro': 'alu'}, {'macro': 'fpu'}],
                    'weight': 1.2,
                    'critical': True,
                    'budget': 45},
                {   'id': 'n6',
                    'terminals': [{'macro': 'iregs'}, {'macro': 'fregs'}],
                    'weight': 1.2,
                    'critical': True,
                    'budget': 36},
                {   'id': 'n7',
                    'terminals': [{'macro': 'lsu'}, {'macro': 'l2$'}],
                    'weight': 1,
                    'critical': True,
                    'budget': 80},
                {   'id': 'n8',
                    'terminals': [{'macro': 'ldq'}, {'macro': 'stq'}, {'macro': 'lsu'}],
                    'weight': 1.1},
                {'id': 'n9', 'terminals': [{'macro': 'ldq'}, {'pin': 'gpio'}], 'weight': 1},
                {'id': 'n10', 'terminals': [{'macro': 'uart'}, {'pin': 'periph'}], 'weight': 0.9},
                {'id': 'n11', 'terminals': [{'macro': 'spi'}, {'pin': 'debug'}], 'weight': 0.9},
                {'id': 'n12', 'terminals': [{'macro': 'timer'}, {'macro': 'fregs'}], 'weight': 0.9},
                {'id': 'n13', 'terminals': [{'macro': 'fregs'}, {'pin': 'jtag'}], 'weight': 0.8}]}

MANUAL_PROMPT = """
A **RISC-V CPU core** block: 15 hard macros - caches, register files, the
execution core, and peripherals - dropped in a **random** start position.
Arrange all 15 so the three checks pass.

- **Timing closed** - every critical net (bold) under its budget. Anchor the
  blocks to their interfaces: the **l2$** to the memory bus, the **exec** core
  to the L2 controller, the integer register file **iregs** to the clock, and
  the **lsu** to the peripheral bus. Keep tightly-coupled blocks close (alu
  with fpu, the two register files together).
- **Legality** - every macro inside the core with a keepout halo (no red).
- **No congestion overflow** - keep the routing-demand map out of the red.

Drag, **Run analysis** until all green, **Place & Route**, **Submit**.
"""

FIXED_IP_SPEC = {   'core': {'w': 180, 'h': 180},
    'halo': 4,
    'grid': 20,
    'capacity': 0.79,
    'bgDemand': 0.26,
    'overflowTol': 0.06,
    'pins': [   {'id': 'dram', 'x': 180, 'y': 90},
                {'id': 'noc', 'x': 0, 'y': 88},
                {'id': 'clk', 'x': 80, 'y': 0},
                {'id': 'mipi', 'x': 92, 'y': 180},
                {'id': 'disp', 'x': 180, 'y': 145},
                {'id': 'jtag', 'x': 24, 'y': 0},
                {'id': 'i2c_p', 'x': 0, 'y': 145},
                {'id': 'pll', 'x': 135, 'y': 0}],
    'macros': [   {   'id': 'dram_ctl',
                      'label': 'dram_ctl',
                      'w': 32,
                      'h': 30,
                      'x': 63,
                      'y': 77,
                      'fixed': True},
                  {   'id': 'line_buf',
                      'label': 'line_buf',
                      'w': 26,
                      'h': 18,
                      'x': 82,
                      'y': 50,
                      'fixed': None},
                  {   'id': 'tile_buf',
                      'label': 'tile_buf',
                      'w': 24,
                      'h': 18,
                      'x': 76,
                      'y': 125,
                      'fixed': None},
                  {   'id': 'lut_rom',
                      'label': 'lut_rom',
                      'w': 14,
                      'h': 24,
                      'x': 6,
                      'y': 30,
                      'fixed': True},
                  {   'id': 'isp_core',
                      'label': 'isp_core',
                      'w': 36,
                      'h': 26,
                      'x': 8,
                      'y': 80,
                      'fixed': True},
                  {   'id': 'denoise',
                      'label': 'denoise',
                      'w': 22,
                      'h': 20,
                      'x': 50,
                      'y': 35,
                      'fixed': None},
                  {   'id': 'demosaic',
                      'label': 'demosaic',
                      'w': 20,
                      'h': 18,
                      'x': 146,
                      'y': 51,
                      'fixed': None},
                  {   'id': 'stat0',
                      'label': 'stat0',
                      'w': 16,
                      'h': 12,
                      'x': 5,
                      'y': 114,
                      'fixed': None},
                  {   'id': 'stat1',
                      'label': 'stat1',
                      'w': 16,
                      'h': 12,
                      'x': 3,
                      'y': 3,
                      'fixed': None},
                  {   'id': 'mipi_dma',
                      'label': 'mipi_dma',
                      'w': 20,
                      'h': 16,
                      'x': 126,
                      'y': 102,
                      'fixed': None},
                  {   'id': 'in_fifo',
                      'label': 'in_fifo',
                      'w': 12,
                      'h': 24,
                      'x': 48,
                      'y': 113,
                      'fixed': None},
                  {   'id': 'out_fifo',
                      'label': 'out_fifo',
                      'w': 12,
                      'h': 24,
                      'x': 88,
                      'y': 11,
                      'fixed': None},
                  {'id': 'i2c', 'label': 'i2c', 'w': 11, 'h': 10, 'x': 122, 'y': 60, 'fixed': None},
                  {'id': 'spi', 'label': 'spi', 'w': 11, 'h': 10, 'x': 33, 'y': 166, 'fixed': None},
                  {   'id': 'ctrl',
                      'label': 'ctrl',
                      'w': 14,
                      'h': 12,
                      'x': 107,
                      'y': 24,
                      'fixed': None}],
    'nets': [   {   'id': 'anc_dram_ctl',
                    'terminals': [{'macro': 'dram_ctl'}, {'pin': 'dram'}],
                    'weight': 1.4,
                    'critical': True,
                    'budget': 118},
                {   'id': 'anc_isp_core',
                    'terminals': [{'macro': 'isp_core'}, {'pin': 'noc'}],
                    'weight': 1.4,
                    'critical': True,
                    'budget': 46},
                {   'id': 'anc_stat0',
                    'terminals': [{'macro': 'stat0'}, {'pin': 'clk'}],
                    'weight': 1.4,
                    'critical': True,
                    'budget': 36},
                {   'id': 'anc_mipi_dma',
                    'terminals': [{'macro': 'mipi_dma'}, {'pin': 'mipi'}],
                    'weight': 1.4,
                    'critical': True,
                    'budget': 54},
                {   'id': 'n0',
                    'terminals': [   {'macro': 'dram_ctl'},
                                     {'macro': 'line_buf'},
                                     {'macro': 'tile_buf'}],
                    'weight': 1.3,
                    'critical': True,
                    'budget': 108},
                {   'id': 'n1',
                    'terminals': [   {'macro': 'stat0'},
                                     {'macro': 'demosaic'},
                                     {'macro': 'denoise'},
                                     {'macro': 'tile_buf'}],
                    'weight': 1.2},
                {   'id': 'n2',
                    'terminals': [{'macro': 'stat1'}, {'macro': 'line_buf'}, {'macro': 'demosaic'}],
                    'weight': 1.2},
                {   'id': 'n3',
                    'terminals': [   {'macro': 'isp_core'},
                                     {'macro': 'dram_ctl'},
                                     {'macro': 'denoise'}],
                    'weight': 1.2},
                {   'id': 'n4',
                    'terminals': [{'macro': 'lut_rom'}, {'macro': 'line_buf'}],
                    'weight': 1},
                {   'id': 'n5',
                    'terminals': [{'macro': 'demosaic'}, {'macro': 'denoise'}],
                    'weight': 1.2,
                    'critical': True,
                    'budget': 44},
                {   'id': 'n6',
                    'terminals': [{'macro': 'stat0'}, {'macro': 'stat1'}],
                    'weight': 1.2,
                    'critical': True,
                    'budget': 63},
                {   'id': 'n7',
                    'terminals': [{'macro': 'mipi_dma'}, {'macro': 'dram_ctl'}],
                    'weight': 1,
                    'critical': True,
                    'budget': 77},
                {   'id': 'n8',
                    'terminals': [   {'macro': 'in_fifo'},
                                     {'macro': 'out_fifo'},
                                     {'macro': 'mipi_dma'}],
                    'weight': 1.1},
                {'id': 'n9', 'terminals': [{'macro': 'in_fifo'}, {'pin': 'i2c_p'}], 'weight': 1},
                {'id': 'n10', 'terminals': [{'macro': 'i2c'}, {'pin': 'mipi'}], 'weight': 0.9},
                {'id': 'n11', 'terminals': [{'macro': 'spi'}, {'pin': 'disp'}], 'weight': 0.9},
                {'id': 'n12', 'terminals': [{'macro': 'ctrl'}, {'macro': 'stat1'}], 'weight': 0.9},
                {'id': 'n13', 'terminals': [{'macro': 'stat1'}, {'pin': 'jtag'}], 'weight': 0.8}]}

FIXED_IP_PROMPT = """
An **image signal processor (ISP)** block. Three large hard-IP blocks are
already placed and **locked** (hatched): the **dram_ctl**, the **isp_core**,
and the **lut_rom**. Place the other 12 macros around them.

- **Timing closed** - critical nets under budget: the line/tile buffers near
  the fixed **dram_ctl** and **isp_core**, the stats engines to the clock, the
  **mipi_dma** to the MIPI interface, and the denoise/demosaic blocks close.
- **Legality** - movable macros inside the core, halo apart, none overlapping
  a locked IP block.
- **No congestion overflow** - keep the map out of the red.

Drag the movable macros, **Run analysis**, **Place & Route**, **Submit**.
"""

CONG_SPEC = {   'core': {'w': 180, 'h': 180},
    'halo': 4,
    'grid': 20,
    'capacity': 0.63,
    'bgDemand': 0.26,
    'overflowTol': 0.06,
    'pins': [   {'id': 'hbm', 'x': 180, 'y': 90},
                {'id': 'fabric', 'x': 0, 'y': 88},
                {'id': 'clk', 'x': 80, 'y': 0},
                {'id': 'serdes', 'x': 92, 'y': 180},
                {'id': 'pcie', 'x': 180, 'y': 145},
                {'id': 'jtag', 'x': 24, 'y': 0},
                {'id': 'mgmt', 'x': 0, 'y': 145},
                {'id': 'pll', 'x': 135, 'y': 0}],
    'macros': [   {   'id': 'pkt_buf',
                      'label': 'pkt_buf',
                      'w': 36,
                      'h': 30,
                      'x': 103,
                      'y': 69,
                      'fixed': True},
                  {   'id': 'tcam0',
                      'label': 'tcam0',
                      'w': 24,
                      'h': 20,
                      'x': 69,
                      'y': 51,
                      'fixed': False},
                  {   'id': 'tcam1',
                      'label': 'tcam1',
                      'w': 24,
                      'h': 20,
                      'x': 75,
                      'y': 114,
                      'fixed': False},
                  {   'id': 'cfg_rom',
                      'label': 'cfg_rom',
                      'w': 18,
                      'h': 28,
                      'x': 105,
                      'y': 108,
                      'fixed': False},
                  {   'id': 'xbar',
                      'label': 'xbar',
                      'w': 34,
                      'h': 24,
                      'x': 36,
                      'y': 75,
                      'fixed': True},
                  {   'id': 'sched',
                      'label': 'sched',
                      'w': 22,
                      'h': 20,
                      'x': 75,
                      'y': 86,
                      'fixed': False},
                  {   'id': 'parser',
                      'label': 'parser',
                      'w': 18,
                      'h': 16,
                      'x': 102,
                      'y': 49,
                      'fixed': False},
                  {   'id': 'meter0',
                      'label': 'meter0',
                      'w': 16,
                      'h': 14,
                      'x': 71,
                      'y': 7,
                      'fixed': True},
                  {   'id': 'meter1',
                      'label': 'meter1',
                      'w': 16,
                      'h': 14,
                      'x': 54,
                      'y': 113,
                      'fixed': False},
                  {'id': 'dma', 'label': 'dma', 'w': 20, 'h': 16, 'x': 90, 'y': 141, 'fixed': True},
                  {   'id': 'rx_fifo',
                      'label': 'rx_fifo',
                      'w': 14,
                      'h': 22,
                      'x': 49,
                      'y': 134,
                      'fixed': True},
                  {   'id': 'tx_fifo',
                      'label': 'tx_fifo',
                      'w': 14,
                      'h': 22,
                      'x': 67,
                      'y': 140,
                      'fixed': True},
                  {   'id': 'mdio',
                      'label': 'mdio',
                      'w': 12,
                      'h': 11,
                      'x': 100,
                      'y': 169,
                      'fixed': True},
                  {   'id': 'spi',
                      'label': 'spi',
                      'w': 12,
                      'h': 11,
                      'x': 165,
                      'y': 143,
                      'fixed': True},
                  {'id': 'cnt', 'label': 'cnt', 'w': 12, 'h': 11, 'x': 51, 'y': 59, 'fixed': True}],
    'nets': [   {   'id': 'ddr',
                    'terminals': [{'macro': 'pkt_buf'}, {'pin': 'hbm'}],
                    'weight': 1.5,
                    'critical': True,
                    'budget': 81},
                {   'id': 'cpu',
                    'terminals': [{'macro': 'xbar'}, {'pin': 'fabric'}],
                    'weight': 1.5,
                    'critical': True,
                    'budget': 70},
                {   'id': 'clk',
                    'terminals': [{'macro': 'meter0'}, {'pin': 'clk'}],
                    'weight': 1.3,
                    'critical': True,
                    'budget': 31},
                {   'id': 'io',
                    'terminals': [{'macro': 'dma'}, {'pin': 'serdes'}],
                    'weight': 1.3,
                    'critical': True,
                    'budget': 55},
                {   'id': 'mem_hier',
                    'terminals': [{'macro': 'pkt_buf'}, {'macro': 'tcam0'}, {'macro': 'tcam1'}],
                    'weight': 1.6},
                {   'id': 'cpu_dbus',
                    'terminals': [   {'macro': 'meter0'},
                                     {'macro': 'parser'},
                                     {'macro': 'sched'},
                                     {'macro': 'tcam1'}],
                    'weight': 1.5},
                {   'id': 'cpu_ibus',
                    'terminals': [{'macro': 'meter1'}, {'macro': 'tcam0'}, {'macro': 'parser'}],
                    'weight': 1.5},
                {   'id': 'mac_feed',
                    'terminals': [{'macro': 'xbar'}, {'macro': 'pkt_buf'}, {'macro': 'sched'}],
                    'weight': 1.5},
                {   'id': 'rom_net',
                    'terminals': [{'macro': 'cfg_rom'}, {'macro': 'tcam0'}],
                    'weight': 1.3},
                {   'id': 'alu_fpu',
                    'terminals': [{'macro': 'parser'}, {'macro': 'sched'}],
                    'weight': 1.4},
                {   'id': 'icache_dcache',
                    'terminals': [{'macro': 'tcam0'}, {'macro': 'tcam1'}],
                    'weight': 1.4},
                {   'id': 'rf_rf',
                    'terminals': [{'macro': 'meter0'}, {'macro': 'meter1'}],
                    'weight': 1},
                {   'id': 'dma_mem',
                    'terminals': [{'macro': 'dma'}, {'macro': 'pkt_buf'}],
                    'weight': 1},
                {   'id': 'fifo_dma',
                    'terminals': [{'macro': 'rx_fifo'}, {'macro': 'tx_fifo'}, {'macro': 'dma'}],
                    'weight': 1},
                {   'id': 'fifo_io',
                    'terminals': [{'macro': 'rx_fifo'}, {'pin': 'mgmt'}],
                    'weight': 0.9},
                {   'id': 'uart_io',
                    'terminals': [{'macro': 'mdio'}, {'pin': 'serdes'}],
                    'weight': 0.9},
                {'id': 'spi_io', 'terminals': [{'macro': 'spi'}, {'pin': 'pcie'}], 'weight': 0.9},
                {   'id': 'timer_rf',
                    'terminals': [{'macro': 'cnt'}, {'macro': 'meter1'}],
                    'weight': 0.9},
                {   'id': 'jtag_net',
                    'terminals': [{'macro': 'meter1'}, {'pin': 'jtag'}],
                    'weight': 0.8}]}

CONG_PROMPT = """
A **network switch** block. Most of it is placed and **locked** (hatched), and
legality and timing are already green. But the routing-demand map has a **red
hotspot**: too much wiring is piled into the crowded center. **Six** blocks are
unlocked and jammed into that jam - the two **tcam** lookup arrays, the
**sched**, the **parser**, the **meter1** rate meter, and the **cfg_rom**.
Spread them out to reopen the routing channels.

- **No congestion overflow** is the failing check. All six movable blocks feed
  nets that cross the center, so clustering them stacks the wire demand. Drag
  them apart until no tile is red. Moving one is not enough: the hotspot only
  clears once the whole group is spread.
- **Legality** stays green while the movable blocks stay in the core, a halo
  apart, and off each other.
- **Timing** is set entirely by the locked blocks, so it stays green no matter
  where you drop the six.

**Run analysis** to re-check, then **Place & Route** and **Submit**. This is
the congestion-relief loop when a dense region will not route.
"""

KEEP_SPEC = {   'core': {'w': 180, 'h': 180},
    'halo': 4,
    'grid': 20,
    'capacity': 0.75,
    'bgDemand': 0.26,
    'overflowTol': 0.06,
    'pins': [   {'id': 'adc', 'x': 180, 'y': 90},
                {'id': 'dsp_bus', 'x': 0, 'y': 88},
                {'id': 'clk', 'x': 80, 'y': 0},
                {'id': 'dac', 'x': 92, 'y': 180},
                {'id': 'host', 'x': 180, 'y': 145},
                {'id': 'jtag', 'x': 24, 'y': 0},
                {'id': 'gpio', 'x': 0, 'y': 145},
                {'id': 'pll', 'x': 135, 'y': 0}],
    'blockages': [   {'x': 34, 'y': 44, 'w': 40, 'h': 42, 'label': 'RF/ADC keepout'},
                     {'x': 118, 'y': 104, 'w': 34, 'h': 38, 'label': 'PLL keepout'}],
    'macros': [   {   'id': 'modem_mem',
                      'label': 'modem_mem',
                      'w': 34,
                      'h': 30,
                      'x': 145,
                      'y': 1,
                      'fixed': None},
                  {   'id': 'fft_buf',
                      'label': 'fft_buf',
                      'w': 22,
                      'h': 20,
                      'x': 50,
                      'y': 106,
                      'fixed': None},
                  {   'id': 'sym_buf',
                      'label': 'sym_buf',
                      'w': 22,
                      'h': 20,
                      'x': 73,
                      'y': 137,
                      'fixed': None},
                  {   'id': 'coef_rom',
                      'label': 'coef_rom',
                      'w': 16,
                      'h': 26,
                      'x': 27,
                      'y': 99,
                      'fixed': None},
                  {   'id': 'fft_core',
                      'label': 'fft_core',
                      'w': 32,
                      'h': 24,
                      'x': 135,
                      'y': 146,
                      'fixed': None},
                  {   'id': 'viterbi',
                      'label': 'viterbi',
                      'w': 20,
                      'h': 20,
                      'x': 53,
                      'y': 2,
                      'fixed': None},
                  {   'id': 'deint',
                      'label': 'deint',
                      'w': 18,
                      'h': 16,
                      'x': 82,
                      'y': 21,
                      'fixed': None},
                  {   'id': 'llr0',
                      'label': 'llr0',
                      'w': 16,
                      'h': 14,
                      'x': 102,
                      'y': 82,
                      'fixed': None},
                  {   'id': 'llr1',
                      'label': 'llr1',
                      'w': 16,
                      'h': 14,
                      'x': 99,
                      'y': 111,
                      'fixed': None},
                  {   'id': 'rf_dma',
                      'label': 'rf_dma',
                      'w': 18,
                      'h': 14,
                      'x': 161,
                      'y': 90,
                      'fixed': None},
                  {   'id': 'rx_fifo',
                      'label': 'rx_fifo',
                      'w': 13,
                      'h': 22,
                      'x': 7,
                      'y': 60,
                      'fixed': None},
                  {   'id': 'tx_fifo',
                      'label': 'tx_fifo',
                      'w': 13,
                      'h': 22,
                      'x': 124,
                      'y': 25,
                      'fixed': None},
                  {'id': 'i2c', 'label': 'i2c', 'w': 12, 'h': 11, 'x': 57, 'y': 159, 'fixed': None},
                  {'id': 'spi', 'label': 'spi', 'w': 12, 'h': 11, 'x': 167, 'y': 74, 'fixed': None},
                  {   'id': 'agc',
                      'label': 'agc',
                      'w': 13,
                      'h': 12,
                      'x': 138,
                      'y': 62,
                      'fixed': None}],
    'nets': [   {   'id': 'anc_modem_mem',
                    'terminals': [{'macro': 'modem_mem'}, {'pin': 'adc'}],
                    'weight': 1.4,
                    'critical': True,
                    'budget': 120},
                {   'id': 'anc_fft_core',
                    'terminals': [{'macro': 'fft_core'}, {'pin': 'dsp_bus'}],
                    'weight': 1.4,
                    'critical': True,
                    'budget': 65},
                {   'id': 'anc_llr0',
                    'terminals': [{'macro': 'llr0'}, {'pin': 'clk'}],
                    'weight': 1.4,
                    'critical': True,
                    'budget': 34},
                {   'id': 'anc_rf_dma',
                    'terminals': [{'macro': 'rf_dma'}, {'pin': 'dac'}],
                    'weight': 1.4,
                    'critical': True,
                    'budget': 43},
                {   'id': 'n0',
                    'terminals': [   {'macro': 'modem_mem'},
                                     {'macro': 'fft_buf'},
                                     {'macro': 'sym_buf'}],
                    'weight': 1.3,
                    'critical': True,
                    'budget': 109},
                {   'id': 'n1',
                    'terminals': [   {'macro': 'llr0'},
                                     {'macro': 'deint'},
                                     {'macro': 'viterbi'},
                                     {'macro': 'sym_buf'}],
                    'weight': 1.2},
                {   'id': 'n2',
                    'terminals': [{'macro': 'llr1'}, {'macro': 'fft_buf'}, {'macro': 'deint'}],
                    'weight': 1.2},
                {   'id': 'n3',
                    'terminals': [   {'macro': 'fft_core'},
                                     {'macro': 'modem_mem'},
                                     {'macro': 'viterbi'}],
                    'weight': 1.2},
                {   'id': 'n4',
                    'terminals': [{'macro': 'coef_rom'}, {'macro': 'fft_buf'}],
                    'weight': 1},
                {   'id': 'n5',
                    'terminals': [{'macro': 'deint'}, {'macro': 'viterbi'}],
                    'weight': 1.2,
                    'critical': True,
                    'budget': 51},
                {   'id': 'n6',
                    'terminals': [{'macro': 'llr0'}, {'macro': 'llr1'}],
                    'weight': 1.2,
                    'critical': True,
                    'budget': 47},
                {   'id': 'n7',
                    'terminals': [{'macro': 'rf_dma'}, {'macro': 'modem_mem'}],
                    'weight': 1,
                    'critical': True,
                    'budget': 79},
                {   'id': 'n8',
                    'terminals': [{'macro': 'rx_fifo'}, {'macro': 'tx_fifo'}, {'macro': 'rf_dma'}],
                    'weight': 1.1},
                {'id': 'n9', 'terminals': [{'macro': 'rx_fifo'}, {'pin': 'gpio'}], 'weight': 1},
                {'id': 'n10', 'terminals': [{'macro': 'i2c'}, {'pin': 'dac'}], 'weight': 0.9},
                {'id': 'n11', 'terminals': [{'macro': 'spi'}, {'pin': 'host'}], 'weight': 0.9},
                {'id': 'n12', 'terminals': [{'macro': 'agc'}, {'macro': 'llr1'}], 'weight': 0.9},
                {'id': 'n13', 'terminals': [{'macro': 'llr1'}, {'pin': 'jtag'}], 'weight': 0.8}]}

KEEP_PROMPT = """
A **wireless modem** block with **two reserved analog regions** (hatched red).
In a real chip these hold sensitive analog blocks ringed with guard bands, so
digital macros must stay clear of both: the **RF/ADC keepout** for the RF
front-end and its data converters, and a separate **PLL keepout** for the
clock generator. Arrange all 15 macros in the space that is left.

- **Legality** - every macro inside the core, halo apart, and **clear of both
  keepouts** (a macro on either one turns red).
- **Timing closed** - critical nets under budget: the **modem_mem** to the ADC
  interface, the **fft_core** to the DSP bus, the **llr0** to the clock, the
  **rf_dma** to the DAC, plus the tightly-coupled compute (viterbi, deint).
- **No congestion overflow** - routing has to thread between the two keepouts,
  so plan the channels around them.

Drag, **Run analysis**, **Place & Route**, **Submit**.
"""

FO_SPEC = {   'core': {'w': 120, 'h': 200},
    'halo': 4,
    'grid': 20,
    'capacity': 0.9,
    'bgDemand': 0.22,
    'overflowTol': 0.06,
    'pins': [   {'id': 'flash_if', 'x': 120, 'y': 78},
                {'id': 'ahb', 'x': 0, 'y': 104},
                {'id': 'clk', 'x': 48, 'y': 0},
                {'id': 'apb', 'x': 64, 'y': 200},
                {'id': 'swd', 'x': 120, 'y': 146},
                {'id': 'jtag', 'x': 16, 'y': 0},
                {'id': 'gpio_p', 'x': 0, 'y': 164},
                {'id': 'pll', 'x': 88, 'y': 0}],
    'macros': [   {   'id': 'sram0',
                      'label': 'sram0',
                      'w': 28,
                      'h': 22,
                      'x': 76,
                      'y': 22,
                      'fixed': None},
                  {   'id': 'sram1',
                      'label': 'sram1',
                      'w': 24,
                      'h': 20,
                      'x': 67,
                      'y': 84,
                      'fixed': None},
                  {   'id': 'dcache',
                      'label': 'dcache',
                      'w': 22,
                      'h': 18,
                      'x': 6,
                      'y': 4,
                      'fixed': None},
                  {   'id': 'icache',
                      'label': 'icache',
                      'w': 22,
                      'h': 18,
                      'x': 7,
                      'y': 97,
                      'fixed': None},
                  {   'id': 'boot_rom',
                      'label': 'boot_rom',
                      'w': 14,
                      'h': 20,
                      'x': 10,
                      'y': 28,
                      'fixed': None},
                  {'id': 'tcm', 'label': 'tcm', 'w': 20, 'h': 16, 'x': 28, 'y': 181, 'fixed': None},
                  {'id': 'cpu', 'label': 'cpu', 'w': 26, 'h': 22, 'x': 88, 'y': 172, 'fixed': None},
                  {'id': 'alu', 'label': 'alu', 'w': 16, 'h': 14, 'x': 71, 'y': 116, 'fixed': None},
                  {'id': 'fpu', 'label': 'fpu', 'w': 18, 'h': 16, 'x': 53, 'y': 151, 'fixed': None},
                  {'id': 'aes', 'label': 'aes', 'w': 18, 'h': 16, 'x': 95, 'y': 59, 'fixed': None},
                  {'id': 'sha', 'label': 'sha', 'w': 16, 'h': 14, 'x': 39, 'y': 121, 'fixed': None},
                  {   'id': 'trng',
                      'label': 'trng',
                      'w': 12,
                      'h': 12,
                      'x': 108,
                      'y': 10,
                      'fixed': None},
                  {   'id': 'regs',
                      'label': 'regs',
                      'w': 14,
                      'h': 12,
                      'x': 99,
                      'y': 91,
                      'fixed': None},
                  {'id': 'dbg', 'label': 'dbg', 'w': 14, 'h': 12, 'x': 8, 'y': 154, 'fixed': None},
                  {'id': 'crc', 'label': 'crc', 'w': 12, 'h': 11, 'x': 66, 'y': 178, 'fixed': None},
                  {   'id': 'dma0',
                      'label': 'dma0',
                      'w': 16,
                      'h': 13,
                      'x': 42,
                      'y': 99,
                      'fixed': None},
                  {   'id': 'dma1',
                      'label': 'dma1',
                      'w': 16,
                      'h': 13,
                      'x': 36,
                      'y': 67,
                      'fixed': None},
                  {   'id': 'rx_fifo',
                      'label': 'rx_fifo',
                      'w': 12,
                      'h': 18,
                      'x': 92,
                      'y': 134,
                      'fixed': None},
                  {   'id': 'tx_fifo',
                      'label': 'tx_fifo',
                      'w': 12,
                      'h': 18,
                      'x': 47,
                      'y': 6,
                      'fixed': None},
                  {'id': 'usb', 'label': 'usb', 'w': 16, 'h': 14, 'x': 71, 'y': 62, 'fixed': None},
                  {'id': 'can', 'label': 'can', 'w': 14, 'h': 12, 'x': 86, 'y': 4, 'fixed': None},
                  {   'id': 'uart',
                      'label': 'uart',
                      'w': 11,
                      'h': 10,
                      'x': 106,
                      'y': 120,
                      'fixed': None},
                  {'id': 'spi', 'label': 'spi', 'w': 11, 'h': 10, 'x': 9, 'y': 64, 'fixed': None},
                  {'id': 'i2c', 'label': 'i2c', 'w': 11, 'h': 10, 'x': 35, 'y': 165, 'fixed': None},
                  {   'id': 'gpio',
                      'label': 'gpio',
                      'w': 11,
                      'h': 10,
                      'x': 38,
                      'y': 140,
                      'fixed': None}],
    'nets': [   {   'id': 'anc_sram0',
                    'terminals': [{'macro': 'sram0'}, {'pin': 'flash_if'}],
                    'weight': 1.4,
                    'critical': True,
                    'budget': 37},
                {   'id': 'anc_cpu',
                    'terminals': [{'macro': 'cpu'}, {'pin': 'ahb'}],
                    'weight': 1.4,
                    'critical': True,
                    'budget': 73},
                {   'id': 'anc_regs',
                    'terminals': [{'macro': 'regs'}, {'pin': 'clk'}],
                    'weight': 1.4,
                    'critical': True,
                    'budget': 58},
                {   'id': 'anc_dma0',
                    'terminals': [{'macro': 'dma0'}, {'pin': 'apb'}],
                    'weight': 1.4,
                    'critical': True,
                    'budget': 49},
                {   'id': 'n4',
                    'terminals': [{'macro': 'cpu'}, {'macro': 'dcache'}, {'macro': 'icache'}],
                    'weight': 1.5,
                    'critical': True,
                    'budget': 80},
                {   'id': 'n5',
                    'terminals': [{'macro': 'sram0'}, {'macro': 'sram1'}, {'macro': 'dcache'}],
                    'weight': 1.4,
                    'critical': True,
                    'budget': 80},
                {   'id': 'n6',
                    'terminals': [{'macro': 'cpu'}, {'macro': 'tcm'}],
                    'weight': 1.4,
                    'critical': True,
                    'budget': 51},
                {   'id': 'n7',
                    'terminals': [{'macro': 'cpu'}, {'macro': 'alu'}, {'macro': 'fpu'}],
                    'weight': 1.4,
                    'critical': True,
                    'budget': 66},
                {   'id': 'n8',
                    'terminals': [{'macro': 'aes'}, {'macro': 'sha'}, {'macro': 'trng'}],
                    'weight': 1.3},
                {   'id': 'n9',
                    'terminals': [{'macro': 'dma1'}, {'macro': 'aes'}, {'macro': 'crc'}],
                    'weight': 1.2},
                {'id': 'n10', 'terminals': [{'macro': 'cpu'}, {'macro': 'boot_rom'}], 'weight': 1},
                {   'id': 'n11',
                    'terminals': [{'macro': 'regs'}, {'macro': 'dbg'}],
                    'weight': 1.2,
                    'critical': True,
                    'budget': 36},
                {   'id': 'n12',
                    'terminals': [{'macro': 'cpu'}, {'macro': 'regs'}],
                    'weight': 1.3,
                    'critical': True,
                    'budget': 74},
                {   'id': 'n13',
                    'terminals': [{'macro': 'dma0'}, {'macro': 'sram0'}, {'macro': 'dma1'}],
                    'weight': 1.2},
                {'id': 'n14', 'terminals': [{'macro': 'dma1'}, {'macro': 'sram1'}], 'weight': 1.1},
                {   'id': 'n15',
                    'terminals': [{'macro': 'usb'}, {'macro': 'dma0'}, {'macro': 'tx_fifo'}],
                    'weight': 1.1},
                {'id': 'n16', 'terminals': [{'macro': 'can'}, {'macro': 'rx_fifo'}], 'weight': 1},
                {   'id': 'n17',
                    'terminals': [{'macro': 'rx_fifo'}, {'macro': 'tx_fifo'}, {'macro': 'dma1'}],
                    'weight': 1},
                {   'id': 'n18',
                    'terminals': [{'macro': 'icache'}, {'macro': 'boot_rom'}],
                    'weight': 0.9},
                {'id': 'n19', 'terminals': [{'macro': 'sha'}, {'macro': 'dma1'}], 'weight': 0.9},
                {'id': 'n20', 'terminals': [{'macro': 'uart'}, {'pin': 'apb'}], 'weight': 0.9},
                {'id': 'n21', 'terminals': [{'macro': 'spi'}, {'pin': 'swd'}], 'weight': 0.9},
                {'id': 'n22', 'terminals': [{'macro': 'i2c'}, {'pin': 'gpio_p'}], 'weight': 0.9},
                {'id': 'n23', 'terminals': [{'macro': 'gpio'}, {'pin': 'gpio_p'}], 'weight': 0.8},
                {'id': 'n24', 'terminals': [{'macro': 'usb'}, {'pin': 'swd'}], 'weight': 0.9},
                {'id': 'n25', 'terminals': [{'macro': 'can'}, {'pin': 'apb'}], 'weight': 0.9},
                {'id': 'n26', 'terminals': [{'macro': 'dbg'}, {'pin': 'jtag'}], 'weight': 0.8},
                {'id': 'n27', 'terminals': [{'macro': 'fpu'}, {'macro': 'alu'}], 'weight': 1.1}]}

FO_PROMPT = """
An **IoT microcontroller** on a **tall, narrow fixed outline** packed with
**25 macros** - caches and memories, the CPU and its accelerators (AES, SHA,
TRNG, FPU), DMA engines, and a full set of peripherals. The die is deliberately
small and far taller than it is wide, so at this block count simply **fitting
everything legally** is the hard part.

- **Legality** - all 25 macros inside the tall core with a halo. The narrow
  width fits only a couple of blocks across, so every loose macro eats room the
  next one needs. Pack in columns, largest blocks first.
- **Timing closed** - critical nets under budget: the **sram0** to the flash
  interface, the **cpu** to the AHB bus and its caches, the **regs** to the
  clock, and the **dma0** to the APB bus.
- **No congestion overflow** - a slim, dense die crowds its routing easily, so
  watch the demand map as you pack.

Drag, **Run analysis**, **Place & Route**, **Submit**.
"""

PIN_SPEC = {   'core': {'w': 180, 'h': 180},
    'halo': 4,
    'grid': 20,
    'mode': 'pins',
    'pinPitch': 10,
    'capacity': 0.76,
    'bgDemand': 0.24,
    'overflowTol': 0.06,
    'pins': [   {'id': 'dq0', 'x': 18, 'y': 0, 'fixed': False},
                {'id': 'ck', 'x': 34, 'y': 0, 'fixed': False},
                {'id': 'dqs', 'x': 50, 'y': 0, 'fixed': False},
                {'id': 'dq1', 'x': 66, 'y': 0, 'fixed': False},
                {'id': 'dq2', 'x': 82, 'y': 0, 'fixed': False},
                {'id': 'rst', 'x': 98, 'y': 0, 'fixed': False},
                {'id': 'cke', 'x': 114, 'y': 0, 'fixed': False},
                {'id': 'ca', 'x': 130, 'y': 0, 'fixed': False},
                {'id': 'dq3', 'x': 146, 'y': 0, 'fixed': False},
                {'id': 'zq', 'x': 162, 'y': 0, 'fixed': False}],
    'macros': [   {   'id': 'lane0',
                      'label': 'lane0',
                      'w': 30,
                      'h': 22,
                      'x': 18,
                      'y': 12,
                      'fixed': True},
                  {'id': 'pll', 'label': 'pll', 'w': 26, 'h': 22, 'x': 78, 'y': 12, 'fixed': True},
                  {   'id': 'lane1',
                      'label': 'lane1',
                      'w': 30,
                      'h': 24,
                      'x': 138,
                      'y': 66,
                      'fixed': True},
                  {   'id': 'ctl',
                      'label': 'ctl',
                      'w': 34,
                      'h': 24,
                      'x': 120,
                      'y': 144,
                      'fixed': True},
                  {   'id': 'lane2',
                      'label': 'lane2',
                      'w': 30,
                      'h': 24,
                      'x': 24,
                      'y': 144,
                      'fixed': True},
                  {   'id': 'ca_blk',
                      'label': 'ca_blk',
                      'w': 26,
                      'h': 22,
                      'x': 12,
                      'y': 112,
                      'fixed': True},
                  {   'id': 'lane3',
                      'label': 'lane3',
                      'w': 24,
                      'h': 30,
                      'x': 12,
                      'y': 60,
                      'fixed': True}],
    'nets': [   {   'id': 'dq0',
                    'terminals': [{'pin': 'dq0'}, {'macro': 'lane0'}],
                    'weight': 1.4,
                    'critical': True,
                    'budget': 39},
                {   'id': 'ck',
                    'terminals': [{'pin': 'ck'}, {'macro': 'pll'}],
                    'weight': 1.3,
                    'critical': True,
                    'budget': 39},
                {   'id': 'dqs',
                    'terminals': [{'pin': 'dqs'}, {'macro': 'pll'}, {'macro': 'lane0'}],
                    'weight': 1.1},
                {   'id': 'dq1',
                    'terminals': [{'pin': 'dq1'}, {'macro': 'lane1'}],
                    'weight': 1.4,
                    'critical': True,
                    'budget': 43},
                {   'id': 'dq2',
                    'terminals': [{'pin': 'dq2'}, {'macro': 'lane2'}],
                    'weight': 1.4,
                    'critical': True,
                    'budget': 40},
                {'id': 'rst', 'terminals': [{'pin': 'rst'}, {'macro': 'ctl'}], 'weight': 1},
                {'id': 'cke', 'terminals': [{'pin': 'cke'}, {'macro': 'ctl'}], 'weight': 1},
                {   'id': 'ca',
                    'terminals': [{'pin': 'ca'}, {'macro': 'ca_blk'}],
                    'weight': 1.2,
                    'critical': True,
                    'budget': 41},
                {   'id': 'dq3',
                    'terminals': [{'pin': 'dq3'}, {'macro': 'lane3'}],
                    'weight': 1.4,
                    'critical': True,
                    'budget': 40},
                {'id': 'zq', 'terminals': [{'pin': 'zq'}, {'macro': 'lane2'}], 'weight': 0.9}],
    'parWL': 402}

PIN_PROMPT = """
A **DDR memory-controller PHY** block. The internal macros are placed and
**locked** (hatched): four data byte lanes (**lane0**-**lane3**), the clock
**pll**, the command/address block **ca_blk**, and the controller **ctl**. Your
job is the block's **I/O pins**: drag each boundary pin to the die edge nearest
the macro it serves so its wire stays short. All ten pins start bunched on the
top edge, which is wrong for most of them.

- **Timing closed** - each high-speed net (bold) under budget. A data pin
  belongs beside its lane (**dq0** to lane0, **dq1** to lane1, **dq2** to
  lane2, **dq3** to lane3), the clock **ck** by the pll, and **ca** by the
  command/address block. Put each pin on the boundary closest to its block.
- **Legality** - every pin stays on the die edge and keeps a pitch from its
  neighbours. Where pins share an edge (**rst**/**cke** by the controller,
  **dq2**/**zq** by lane2), spread them apart.
- **No congestion overflow** - pins crowded on one side make their wires fan
  across the die and pile up. Moving each to its own edge relieves it.

Drag the pins, **Run analysis**, **Place & Route**, **Submit**.
"""

PIN2_SPEC = {   'core': {'w': 260, 'h': 170},
    'halo': 4,
    'grid': 20,
    'mode': 'pins',
    'pinPitch': 8,
    'capacity': 0.63,
    'bgDemand': 0.2,
    'overflowTol': 0.06,
    'pins': [   {'id': 'txb0', 'x': 8, 'y': 0, 'fixed': False},
                {'id': 'txb1', 'x': 61.75, 'y': 0, 'fixed': False},
                {'id': 'txb2', 'x': 115.5, 'y': 0, 'fixed': False},
                {'id': 'txb3', 'x': 169.25, 'y': 0, 'fixed': False},
                {'id': 'txb4', 'x': 223, 'y': 0, 'fixed': False},
                {'id': 'rxb0', 'x': 260, 'y': 16.75, 'fixed': False},
                {'id': 'rxb1', 'x': 260, 'y': 70.5, 'fixed': False},
                {'id': 'rxb2', 'x': 260, 'y': 124.25, 'fixed': False},
                {'id': 'rxb3', 'x': 252, 'y': 170, 'fixed': False},
                {'id': 'rxb4', 'x': 198.25, 'y': 170, 'fixed': False},
                {'id': 'hs0', 'x': 144.5, 'y': 170, 'fixed': False},
                {'id': 'hs1', 'x': 90.75, 'y': 170, 'fixed': False},
                {'id': 'hs2', 'x': 37, 'y': 170, 'fixed': False},
                {'id': 'hs3', 'x': 0, 'y': 153.25, 'fixed': False},
                {'id': 'ck0', 'x': 0, 'y': 99.5, 'fixed': False},
                {'id': 'ck1', 'x': 0, 'y': 45.75, 'fixed': False},
                {'id': 'vddh0', 'x': 260, 'y': 60, 'fixed': True},
                {'id': 'vss0', 'x': 130, 'y': 170, 'fixed': True}],
    'macros': [   {   'id': 'tx_dp',
                      'label': 'tx_dp',
                      'w': 26,
                      'h': 22,
                      'x': 14,
                      'y': 14,
                      'fixed': True},
                  {   'id': 'rx_dp',
                      'label': 'rx_dp',
                      'w': 26,
                      'h': 22,
                      'x': 14,
                      'y': 134,
                      'fixed': True},
                  {'id': 'pll', 'label': 'pll', 'w': 22, 'h': 18, 'x': 62, 'y': 16, 'fixed': True},
                  {   'id': 'pll2',
                      'label': 'pll2',
                      'w': 22,
                      'h': 18,
                      'x': 62,
                      'y': 136,
                      'fixed': True},
                  {'id': 'mac', 'label': 'mac', 'w': 30, 'h': 28, 'x': 104, 'y': 71, 'fixed': True},
                  {   'id': 'serdes0',
                      'label': 'serdes0',
                      'w': 30,
                      'h': 20,
                      'x': 150,
                      'y': 16,
                      'fixed': True},
                  {   'id': 'serdes1',
                      'label': 'serdes1',
                      'w': 30,
                      'h': 20,
                      'x': 150,
                      'y': 134,
                      'fixed': True},
                  {   'id': 'serdes2',
                      'label': 'serdes2',
                      'w': 30,
                      'h': 20,
                      'x': 208,
                      'y': 16,
                      'fixed': True},
                  {   'id': 'serdes3',
                      'label': 'serdes3',
                      'w': 30,
                      'h': 20,
                      'x': 208,
                      'y': 134,
                      'fixed': True}],
    'nets': [   {   'id': 'txbus',
                    'terminals': [   {'pin': 'txb0'},
                                     {'pin': 'txb1'},
                                     {'pin': 'txb2'},
                                     {'pin': 'txb3'},
                                     {'pin': 'txb4'},
                                     {'macro': 'tx_dp'}],
                    'weight': 1.9,
                    'critical': True,
                    'budget': 74},
                {   'id': 'rxbus',
                    'terminals': [   {'pin': 'rxb0'},
                                     {'pin': 'rxb1'},
                                     {'pin': 'rxb2'},
                                     {'pin': 'rxb3'},
                                     {'pin': 'rxb4'},
                                     {'macro': 'rx_dp'}],
                    'weight': 1.9,
                    'critical': True,
                    'budget': 74},
                {   'id': 'hs0',
                    'terminals': [{'pin': 'hs0'}, {'macro': 'serdes0'}],
                    'weight': 1.5,
                    'critical': True,
                    'budget': 48},
                {   'id': 'hs1',
                    'terminals': [{'pin': 'hs1'}, {'macro': 'serdes1'}],
                    'weight': 1.5,
                    'critical': True,
                    'budget': 48},
                {   'id': 'hs2',
                    'terminals': [{'pin': 'hs2'}, {'macro': 'serdes2'}],
                    'weight': 1.5,
                    'critical': True,
                    'budget': 48},
                {   'id': 'hs3',
                    'terminals': [{'pin': 'hs3'}, {'macro': 'serdes3'}],
                    'weight': 1.5,
                    'critical': True,
                    'budget': 48},
                {   'id': 'ck0',
                    'terminals': [{'pin': 'ck0'}, {'macro': 'pll'}],
                    'weight': 1.3,
                    'critical': True,
                    'budget': 47},
                {   'id': 'ck1',
                    'terminals': [{'pin': 'ck1'}, {'macro': 'pll2'}],
                    'weight': 1.3,
                    'critical': True,
                    'budget': 47}],
    'parWL': 440}

PIN2_PROMPT = """
A **4-lane SerDes transceiver** on a **wide die**: a much harder I/O-planning
job. The internal macros are placed and **locked** (hatched): the transmit and
receive datapaths (**tx_dp**, **rx_dp**) on the left, two clock PLLs, the centre
**mac**, and four high-speed lanes (**serdes0**-**serdes3**) on the right. Two
power pins (**vddh0**, **vss0**, grey) are fixed and will not move. You place
the **16 I/O pins**, which start spread around the boundary.

The new twist is **buses**. The transmit bus (**txb0**-**txb4**) is a single
net to **tx_dp**, and the receive bus (**rxb0**-**rxb4**) a single net to
**rx_dp**. A bus is only short when all five of its pins sit **together** next
to their datapath, so each must be packed as a contiguous block on the left
edge beside its macro, the transmit bus up by **tx_dp** and the receive bus
down by **rx_dp**.

- **Timing closed** - the two bus nets and the six single high-speed nets
  (bold) under budget. Group each bus against its datapath, put each lane's
  **hs** pin beside its lane, and each **ck** by its PLL.
- **Legality** - every pin on the die edge, a pitch apart, and clear of the two
  fixed power pins.
- **No congestion overflow** - a scattered bus fans a thick bundle of wires
  across the die. Grouping each bus by its macro keeps the demand local.

Drag the pins, **Run analysis**, **Place & Route**, **Submit**.
"""

PDN_RING_SPEC = {
    "core": {"w": 120, "h": 120},
    "vdd": 1000,
    "irBudget": 50,
    "routingDemand": 0.62,
    "globalK": 7.0,
    "localK": 0.05,
    "ringK": 25,
    "grid": 40,
    "ring": {"min": 1, "max": 10, "step": 0.5, "default": 2, "unit": "µm"},
    "stripeW": {"min": 0.3, "max": 3, "step": 0.1, "default": 0.5, "unit": "µm"},
    "pitch": {"min": 4, "max": 20, "step": 1, "default": 16, "unit": "µm"},
    "macros": [
        {"id": "cpu", "label": "cpu", "x": 14, "y": 14, "w": 30, "h": 24},
        {"id": "sram", "label": "sram", "x": 80, "y": 16, "w": 26, "h": 20},
        {"id": "dsp", "label": "dsp", "x": 16, "y": 80, "w": 24, "h": 26},
        {"id": "io", "label": "io", "x": 76, "y": 80, "w": 30, "h": 24},
    ],
}

PDN_RING_PROMPT = """
Size the **power delivery network** for a block with four hard macros
(**cpu**, **sram**, **dsp**, **io**) already placed. Use the three sliders to
set the power **ring** and the **mesh** of stripes, and watch the **IR-drop
map**: current enters at the ring and droops toward the centre.

The starting mesh is far too weak - the centre is deep in the red.

- **Static IR drop under budget** - the worst droop must stay under the budget
  (in millivolts). Widen the **ring** to lift the whole die, widen the
  **stripes** to raise the centre, and tighten the **pitch** to cut the droop
  between stripes.
- **Signal routing closes** - every power stripe is a track the signals cannot
  use, and the macros block routing over their own footprint. Once IR drop is
  met, run **Place & Route**: build the mesh too heavy and the signal routing
  runs out of tracks and fails. A denser mesh helps IR but starves routing.

The two budgets pull against each other, so lean on a **wide ring and a tight
pitch** rather than fat stripes to hit the IR budget without walling off the
tracks. Run **Place & Route**, then **Submit design** for a score.
"""

PDN_BUMPS_SPEC = {
    "core": {"w": 180, "h": 180},
    "k": 0.05, "budget": 55, "grid": 50, "sampleGrid": 30, "sourceR": 7,
    "snapPitch": 20, "baseCurrent": 0.35,
    "sourceName": "bumps", "sourceName2": "bump", "sourceFill": "rgba(37,99,235,0.9)",
    "mapLabel": "IR-drop map (current × distance to nearest bump)",
    "checkLabel": "Peak IR drop under budget",
    "hint": "Bumps land on the C4 grid slots and cannot sit on a macro keepout. Put bumps on the high-current hotspots, then spread the rest and ring the macros.",
    "macros": [
        {"id": "cpu", "label": "cpu", "x": 30, "y": 30, "w": 40, "h": 36},
        {"id": "mem", "label": "mem", "x": 120, "y": 20, "w": 30, "h": 26},
        {"id": "gpu", "label": "gpu", "x": 108, "y": 108, "w": 42, "h": 38},
        {"id": "dsp", "label": "dsp", "x": 22, "y": 120, "w": 32, "h": 30},
        {"id": "io", "label": "io", "x": 150, "y": 64, "w": 24, "h": 22},
        {"id": "acc", "label": "acc", "x": 66, "y": 142, "w": 28, "h": 24},
        {"id": "pll", "label": "pll", "x": 86, "y": 70, "w": 22, "h": 20},
    ],
    "hotspots": [
        {"x": 90, "y": 30, "mag": 1.5, "sigma": 22},
        {"x": 150, "y": 150, "mag": 1.4, "sigma": 22},
        {"x": 30, "y": 90, "mag": 1.3, "sigma": 22},
    ],
    "init": [
        {"x": 10, "y": 10}, {"x": 10, "y": 30}, {"x": 30, "y": 10}, {"x": 10, "y": 50}, {"x": 50, "y": 10},
        {"x": 10, "y": 70}, {"x": 70, "y": 10}, {"x": 30, "y": 70}, {"x": 50, "y": 70}, {"x": 10, "y": 90},
        {"x": 90, "y": 10}, {"x": 30, "y": 90}, {"x": 90, "y": 30}, {"x": 70, "y": 70}, {"x": 50, "y": 90},
        {"x": 90, "y": 50}, {"x": 10, "y": 110}, {"x": 110, "y": 10}, {"x": 30, "y": 110}, {"x": 70, "y": 90},
    ],
}

PDN_BUMPS_PROMPT = """
Place the **power bumps** (the flip-chip C4 - Controlled Collapse Chip
Connection - bumps) on the **C4 array grid** (the hollow slots) to feed the mesh
from the package. This block's **power demand is not uniform**: the dashed
circles are high-current regions that draw far more, so for the same distance
the droop there is worse. Bumps cannot land on a macro, which is a bump
**keepout**.

All the bumps start piled in one corner, so most of the die is deep in the red.

- **Peak IR (current times resistance) drop under budget** - the worst point
  (marked with a crosshair) must come under budget. Put bumps **on the
  high-current hotspots** first, then spread the rest to cover the die and
  **ring the macro keepouts**. Match the bump density to the demand: more bumps
  where the current is high.

Drag each bump onto a grid slot, then **Submit design** for a score.
"""

PDN_DECAP_SPEC = {
    "core": {"w": 120, "h": 120},
    "budget": 50, "sampleGrid": 40, "sourceR": 5,
    "baseCurrent": 0.05, "dynamic": True, "coverR": 10, "actScale": 40, "residual": 0.2,
    "sourceName": "decaps", "sourceName2": "decap", "sourceShape": "rect", "sourceFill": "rgba(124,58,237,0.92)",
    "mapLabel": "switching-activity map (fixed) · red = busiest, blanket it",
    "checkLabel": "Peak dynamic droop under budget",
    "hint": "Each decap only calms a small area, so a red region takes several to blanket. The three lumpy red regions do not move: cover every red bit of each one.",
    "hotspots": [
        {"x": 28, "y": 28, "mag": 1.8, "sigma": 8}, {"x": 50, "y": 26, "mag": 1.5, "sigma": 8}, {"x": 30, "y": 50, "mag": 1.6, "sigma": 8},
        {"x": 92, "y": 44, "mag": 1.6, "sigma": 8}, {"x": 94, "y": 68, "mag": 1.5, "sigma": 8}, {"x": 72, "y": 58, "mag": 1.4, "sigma": 8},
        {"x": 42, "y": 90, "mag": 1.7, "sigma": 8}, {"x": 66, "y": 92, "mag": 1.6, "sigma": 8}, {"x": 88, "y": 84, "mag": 1.5, "sigma": 8},
    ],
    "init": [
        {"x": 8, "y": 8}, {"x": 16, "y": 8}, {"x": 24, "y": 8}, {"x": 32, "y": 8}, {"x": 40, "y": 8},
        {"x": 8, "y": 15}, {"x": 16, "y": 15}, {"x": 24, "y": 15}, {"x": 32, "y": 15}, {"x": 40, "y": 15},
        {"x": 8, "y": 22}, {"x": 16, "y": 22}, {"x": 24, "y": 22}, {"x": 40, "y": 22},
    ],
}

PDN_DECAP_PROMPT = """
Place the **decoupling capacitors** (decaps) that hold the rail voltage during
peak switching. This is a **dynamic** problem, not a static one: a few
high-activity regions toggle hard and pull a fast current transient (di/dt),
drawn as the busy red **switching nets**. The dynamic droop spikes right at
those hotspots, not evenly across the die.

Each decap has a **coverage ring**: it can only supply the fast charge to
switching within its reach. The decaps start piled in a corner, far from the
action, so every hotspot is screaming red.

- **Peak dynamic droop under budget** - drop a decap on each switching hotspot
  so its coverage ring reaches it. A covered hotspot calms down and turns
  **green**; one left outside every ring stays red and over budget. A decap far
  from any switching does nothing.

Drag each decap onto a hotspot, then **Submit design** for a score.
"""

PDN_REGIONS_SPEC = {
    "core": {"w": 150, "h": 120},
    "vdd": 1000,
    "ringK": 30,
    "coreK": 5,
    "openFrac": 0.85,
    "grid": 48,
    "ring": {"min": 1, "max": 10, "step": 0.5, "default": 2, "unit": "µm"},
    "density": {"min": 0.05, "max": 0.5, "step": 0.01, "default": 0.1, "unit": ""},
    "regions": [
        {"id": "logic", "label": "logic", "x": 0, "y": 0, "w": 50, "h": 120, "J": 1.0, "budget": 65, "demand": 0.72},
        {"id": "core", "label": "core", "x": 50, "y": 0, "w": 50, "h": 120, "J": 2.4, "budget": 42, "demand": 0.45},
        {"id": "accel", "label": "accel", "x": 100, "y": 0, "w": 50, "h": 120, "J": 1.5, "budget": 55, "demand": 0.60},
    ],
}

PDN_REGIONS_PROMPT = """
A harder **power grid** job: this block has three power regions with
**different needs**. The centre **core** is hot and voltage-sensitive (high
current, a tight IR (current times resistance) drop budget); the **logic**
region draws little power but is packed with signals; the **accel** sits in
between. Each region shows its current multiplier and its own budget.

Set a **mesh density per region** (plus the global **ring**). One uniform
setting cannot win:

- **Each region under its own IR-drop budget** - the hot core needs a dense
  local mesh to hold its tight budget; the cooler regions need far less.
- **Signal routing closes in every region** - a dense mesh steals tracks, and
  the routing-heavy **logic** region cannot take a heavy mesh. Crank density
  everywhere and its routing fails. Run **Place & Route** to check each region.

Widen the **ring** to lift every region at once, then give each region only the
density it needs: heavy on the core, light on logic. **Place & Route**, then
**Submit design**.
"""

PDN_STATIC_SPEC = {
    "id": "pdn-static",
    "core": {"w": 160, "h": 160}, "grid": 48, "sampleGrid": 28,
    "ringK": 25, "a8": 4, "a5": 3, "irBudget": 55,
    "cov5": 1.0, "cov8": 0.15, "demand": 0.55, "openFrac": 0.85, "baseCurrent": 0.8,
    "hotspots": [
        {"x": 55, "y": 55, "mag": 1.3, "sigma": 24},
        {"x": 120, "y": 112, "mag": 1.1, "sigma": 24},
    ],
    "ring": {"min": 1, "max": 10, "step": 0.5, "default": 2, "unit": "µm", "label": "Power ring width"},
    "d8": {"min": 0.05, "max": 0.4, "step": 0.01, "default": 0.08, "unit": "", "label": "M8 top-strap density"},
    "d5": {"min": 0.05, "max": 0.4, "step": 0.01, "default": 0.08, "unit": "", "label": "M5 mid-strap density"},
}

PDN_STATIC_PROMPT = """
A static IR (current times resistance) drop run flagged a **violation** over a
**non-uniform current map** (the dashed circles are the high-current regions).
You close it by sizing the **metal stack**, not one layer: current flows from
the ring down through the coarse top straps, the finer mid straps, and the
fixed M1 (metal-1) follow-pin rails to the cells, and each layer adds
resistance.

You have three knobs: the **ring**, the **M8 top-strap density** (vertical,
coarse), and the **M5 mid-strap density** (horizontal, finer). The map starts
deep in the red.

- **Peak IR drop under budget** - **M8** is dedicated power metal and cheap for
  routing, so lean on it (and the ring) for the die-wide drop. But M8 is coarse
  and cannot fix the **local** drop at the hotspots on its own: that needs
  **M5**.
- **Signal routing closes** - **M5 shares its layers with the signals**, so its
  density eats routing tracks. Use only as much M5 as routing can afford. Run
  **Place & Route** to check.

Max the ring and M8, then thread in just enough M5 to pull the hotspots under
budget without breaking routing. **Place & Route**, then **Submit design**.
"""

PDN_RAIL_SPEC = {
    "id": "pdn-rail",
    "model": "rail",
    "core": {"w": 120, "h": 120}, "grid": 40, "rowHeight": 10,
    "meshFixed": 6, "railK": 0.03, "viaK": 25, "irBudget": 22,
    "strapCov": 1.5, "viaCov": 0.03, "demand": 0.55, "openFrac": 0.85,
    "mapLabel": "local IR drop (cell to nearest strap drop)",
    "hint": "The row height and rail width are fixed by the library. Your knobs are the strap pitch and the vias per drop; both cut the drop but add blockage.",
    "failNote": "Tighten the strap pitch and add vias per drop to cut the local drop; back off if the routing runs out of tracks.",
    "sliders": [
        {"key": "strapPitch", "label": "Strap pitch (mesh drops to rails)", "min": 4, "max": 30, "step": 1, "default": 28, "unit": "µm"},
        {"key": "viaCount", "label": "Vias per rail drop", "min": 1, "max": 8, "step": 1, "default": 1, "unit": ""},
    ],
}

PDN_RAIL_PROMPT = """
Hook the standard-cell rows up to the power mesh. The rows and their **metal-1
(M1) power rails** are fixed by the library: the rail pitch is the row height
and the rail width is set by the cells, so you **cannot change the rails
themselves**. What you tune is the connection down to them from the mesh.

Every cell pulls its current along the M1 rail to the nearest point where a
mesh **strap drops a via array** down to that rail. The **local IR (current
times resistance) drop** is the rail travel to that drop plus the via-stack
resistance, so it is worst for a cell sitting midway between two drops.

The mesh starts dropping to the rails only rarely and with a single via each,
so the mid-row is red.

- **Local IR drop under budget** - tighten the **strap pitch** so no cell is
  far along its rail from a drop, and add **vias per drop** to lower the
  via-stack resistance.
- **Routing closes** - the straps and via arrays sit on tracks the signals
  need. A very tight pitch and fat via arrays both eat tracks, so do not
  over-stitch: keep the routing closing.

Balance the two, then **Submit design** for a score.
"""

PDN_EM_SPEC = {
    "id": "pdn-em",
    "model": "em",
    "core": {"w": 120, "h": 120}, "grid": 40,
    "trunkI": 12, "midI": 6, "leafI": 3, "jMax": 3.0,
    "nTrunk": 1, "nMid": 2, "nLeaf": 4,
    "covPerW": 0.03, "demand": 0.45, "openFrac": 0.85,
    "mapLabel": "per-branch current density vs the EM limit",
    "hint": "Current is highest in the trunk and lowest in the leaves, and density is current / width. Size each level to its own current: fat trunk, medium branches, thin leaves. One uniform width either fails EM in the trunk or wastes so much metal that routing fails.",
    "failNote": "A red level carries too much current per unit width - widen that level. If routing fails, some level is wider than its current needs.",
    "sliders": [
        {"key": "trunkW", "label": "Trunk stripe width (I=12)", "min": 1, "max": 8, "step": 0.5, "default": 1, "unit": "µm"},
        {"key": "midW", "label": "Branch stripe width (I=6)", "min": 0.5, "max": 6, "step": 0.5, "default": 0.5, "unit": "µm"},
        {"key": "leafW", "label": "Leaf stripe width (I=3)", "min": 0.5, "max": 4, "step": 0.25, "default": 0.5, "unit": "µm"},
    ],
}

PDN_EM_PROMPT = """
Sign the power grid off for **electromigration (EM)**: over its lifetime, metal
carrying too much current per unit width erodes and fails. The grid is a
hierarchy - a high-current **trunk** feeds medium **branches**, which feed
low-current **leaves** - and the **current density** in each is its current
divided by its width, which must stay under the EM limit at every level.

Every level starts too narrow, so all three are over the limit (red).

- **Current density under the EM limit at each level** - density is current /
  width, and the trunk carries four times a leaf's current, so it needs a much
  wider stripe. Size **each level to its own current**.
- **Routing closes** - every stripe blocks routing tracks. One uniform width
  cannot win: wide enough for the trunk wastes so much metal on the many leaves
  that routing fails, thin enough to route leaves the trunk over the EM limit.

Match each level's width to its current with the least metal, then **Submit
design**.
"""

BLOCK_SIZE_SPEC = {
    "id": "block-sizing",
    "cellArea": 5000, "areaMax": 6600, "routableCap": 0.85, "wireBudget": 172, "refMax": 150,
    "util": {"min": 0.50, "max": 0.92, "step": 0.01, "default": 0.55, "label": "Utilization"},
    "aspect": {"min": 0.5, "max": 2.0, "step": 0.05, "default": 1.4, "label": "Aspect ratio (w:h)"},
}

BLOCK_SIZE_PROMPT = """
Before placement you have to **size the block**. The gate netlist has a fixed
total cell area; you choose how densely to pack it (**utilization**) and the
die's **aspect ratio**. Utilization sets the core area, a fuller die is smaller
and cheaper, and aspect sets its shape. The dashed square is the area budget.

The block starts too loose and a bit oblong: the die overflows the budget and
the wires run too long.

- **Fits the area budget** - a bigger die costs more silicon. Pack tighter
  (raise utilization) to bring the core under the budget.
- **Routable** - too dense a die, or too skewed a shape, congests the routing.
  Keep utilization under the routable limit and the aspect near square.
- **Timing closes** - a big or oblong die stretches the longest wires; a small,
  square die keeps them short.

Push utilization as high as it will still route, keep the block square, then
**Submit design**. The tightest routable square scores best.
"""

# Neutral, shuffled labels so the two clusters are NOT given away by the block
# names: the learner must read the wires (nets) to find the grouping.
_PLABEL = {"a0": "u4", "a1": "u1", "a2": "u8", "a3": "u2", "a4": "u6",
           "b0": "u9", "b1": "u3", "b2": "u0", "b3": "u7", "b4": "u5"}

PLACE_WL_PROMPT = """
**Wirelength-driven placement.** After floorplanning fixed the die and pins, you
place the standard **cells**. Drag them to minimize the **total wirelength**
(the sum of every net's span) under the target. The cells start scattered, so
the nets run long.

- **Wirelength under target** - cells that share a net (a line between them)
  want to sit close; a cell wired to a boundary pin (square) wants to sit near
  that pin. Cluster each connected group and pull it toward its pin.
- **Legality** - cells inside the die, not overlapping.

Shorter total wirelength scores higher. **Submit design** when under target.
"""

PLACE_TIMING_PROMPT = """
**Timing-driven placement.** Some nets are on the critical path (drawn bold) and
must stay under a tight delay budget, which here means a short wire. Placing for
raw wirelength is not enough: the critical nets have to be short even if it
crowds other cells.

The cells start scattered, so the critical nets are long and red.

- **Timing closes** - pull the cells on each bold critical net tightly together
  (and next to its pin) so its wire comes under budget.
- **Legality** - cells inside the die, not overlapping.

Close every critical net, then **Submit design**. Shorter wire scores higher.
"""

PLACE_CONG_PROMPT = """
**Congestion-driven placement.** Packing cells tightly gives short wires but a
**dense** region will not route. The heat map shows cell density per tile; no
tile may exceed the limit. The cells start piled into one corner, so that region
is deep in the red.

- **Density under limit** - spread the cells out so no tile is over the limit
  (out of the red).
- **Wirelength under target** - but do not scatter them to the winds: the chain
  of connected cells still has to come under the wirelength target.

Balance spreading against wirelength, then **Submit design**.
"""

PLACE_REGION_PROMPT = """
**Region-constrained placement.** This block has two kinds of region:

- **Hard fences** (red, solid): the **secure** and **analog** boxes. Their
  assigned cells must stay **inside**, and no other cell may enter (the region
  is exclusive). A rigid constraint.
- **Soft guide** (purple, dashed): the **dsp** box. Its cells are *encouraged*
  inside, but they may spill out if it helps wirelength, and other cells may
  share the area. A preference, not a rule.

Place everything to minimize wirelength while honoring the regions. The hard-fence
cells start outside their boxes and some cells sit inside a fence they do not
belong to, so the hard-fence check fails.

- **Hard fences respected** - every assigned cell inside its fence, and no
  foreign cell inside a hard fence.
- **Soft guide** - keep the dsp cells in their guide if you can (it is only a
  preference; spilling one is allowed).
- **Wirelength under target**, and **legality** (in bounds, no overlap).

**Submit design** once the hard fences are clean and wirelength is under target.
"""

PLACE_COMBO_PROMPT = """
**Full global placement.** The real job: satisfy all three objectives at once.
Place the cells so:

- **Timing closes** - the bold critical path stays under its budget (keep those
  cells tight and short).
- **Density under limit** - no tile on the heat map goes over the limit (the
  cells cannot all pile up).
- **Wirelength under target** - the total wire stays under target (connected
  cells want to be close).

They pull against each other: clustering for wirelength and timing drives the
density up, while spreading for density lengthens the wires. Find the balance
that clears all three, then **Submit design**.
"""

PLACE_LEGALIZE_PROMPT = """
**Row legalization.** Global placement dropped the cells wherever wirelength was
lowest, so they overlap and sit off the standard-cell rows. Legalize them: drag
each cell onto a row (it snaps to the nearest one) and slide it sideways so no
two cells overlap - while moving each as little as possible from its
global-placement spot (the dashed ghost).

- **On a row, no overlap** - every cell on a row line, none overlapping.
- **Displacement in budget** - the total distance moved from the ghosts must
  stay under budget, so nudge, do not relocate. Legalization should barely
  disturb the placement.

Legalize with the least movement, then **Submit design**.
"""

PLACE_SWAP_PROMPT = """
**Detailed placement: cell swapping.** The cells are already legal, sitting in a
row of slots, but the order is poor so the wires are long. Improve it with the
one detailed-placement move available here: **click one cell, then another, to
swap their slots**.

- **Wirelength under target** - reorder the cells so the ones that share a net
  (and the ones wired to an end pin) sit next to each other, shrinking the total
  wire under the target.

Swap your way under the target, then **Submit design**.
"""

PLACE_FLIP_PROMPT = """
**Detailed placement: cell flipping.** The cells are already placed in their
legal slots and cannot move. But each one can be **mirrored** (flipped
horizontally), which swaps the sides its pins sit on: the blue input pin **A**
and the red output pin **Y** trade edges. A cell whose partner sits on the far
side wastes wire reaching around itself.

- **Wirelength under target** - click cells to flip them so each pin faces the
  cell (or boundary pin) it wires to, pulling the nets short and dropping total
  wirelength under target.

The cells start in a poor orientation. Reorient them, then **Submit design**.
"""

PLACE_FILLER_PROMPT = """
**Filler and tap-cell insertion.** Placement leaves gaps between the cells in
each row. Two finishing steps close the design out:

- **Rows continuous** - fill every gap with filler cells so the follow-pin power
  rails and the wells stay unbroken. An exposed site breaks the rail (you can
  see the gap in it). Use the filler tool: click a gap to fill it.
- **Every site within tap reach** - drop well-tap cells so no point in a row is
  farther than the tap reach (the green band), the rule that prevents latch-up.
  Taps only fit in the gaps, never over a placed cell, and each one costs area,
  so cover every site with as **few taps** as you can. Use the tap tool.

Fill the rows and tie the wells, then **Submit design**.
"""

PLACE_PAD_PROMPT = """
**Cell padding for routability.** The cells are placed in a fixed order, packed
tight. A cluster of pin-heavy cells in the middle is a local routing hotspot:
too many pins fall in one window for the router to reach them. The fix is **cell
padding** - reserving extra space around the crowded cells so their pins spread
out.

- **Local density under limit** - click a cell to add padding; it spreads the
  cluster and drops the local pin density (the heat) under the limit.
- **Wirelength under target** - every pad you add lengthens the nets, so do not
  over-pad.
- **Row fits in core** - padding also pushes the row wider; it must stay inside
  the core edge.

Pad just enough to clear the hotspot without blowing the wire or the row, then
**Submit design**.
"""

CTS_SOURCE_PROMPT = """
**Clock source balancing.** This is a star clock: one root buffer drives every
flip-flop clock pin directly, and each sink's clock arrives later the farther it
sits from the root. Skew is the spread between the earliest and latest arrival.

- **Skew under target** - drag the root to the point that makes the nearest and
  farthest sinks as equal as possible.
- **Latency in budget** - the farthest arrival (insertion delay) must also stay
  under budget.

Notice the floor: even the best-placed star has real skew, because the sinks are
spread out. That is exactly why real clocks use trees, not a star. Balance it,
then **Submit design**.
"""

CTS_HTREE_PROMPT = """
**H-tree construction.** The root drives four tap points, one per quadrant of a
4x4 grid of sinks, and each tap drives its quadrant. Balance the tree:

- **Skew under target** - drag each tap toward the centre of its quadrant to
  shrink that quadrant's spread, and keep all four root-to-tap arms the same
  length. That symmetry is what makes the H-tree the classic near-zero-skew
  structure.
- **Latency in budget** - keep the longest path within budget.

Make it symmetric, then **Submit design**.
"""

CTS_BUFFER_PROMPT = """
**Clock buffer insertion.** The root cannot drive the whole clock tree at once:
past a load limit, its transition (slew) degrades. Break the tree into regions
with buffers by clicking the internal hubs.

- **Every driver under the slew load** - a buffer re-drives everything below it,
  splitting the load. Every driver (the root and each buffer) must drive a load
  under the limit, so too few buffers leaves a region overloaded.
- **Buffers within budget** - buffers cost power, and you have a budget. You
  cannot just buffer every hub: over-buffering busts the budget.

The catch is that where you buffer matters. A buffer high in the tree covers a
big subtree but may still be overloaded; buffers lower down each cover less.
Find a minimal set of hubs that puts every driver under the limit without
exceeding the budget, then **Submit design**.
"""

CTS_SKEWBAL_PROMPT = """
**Skew balancing (delay matching).** The clock reaches the sinks at different
times. Add delay on the early branches to lift them up to the latest sink.

- **Skew under target** - click an edge to add a delay buffer on it, which lifts
  every sink below it. Balance the early paths up until all sinks arrive
  together.
- **Latency in budget** - do not lift past the budget.
- Delay on a higher, shared edge lifts many sinks at once, so prefer it over
  padding each leaf: use the **fewest delay buffers**.

Balance the arrivals, then **Submit design**.
"""

CTS_GATING_PROMPT = """
**Clock gating.** The clock network toggles every cycle and burns a large share
of a chip's dynamic power, including in registers that are not doing useful work
that cycle. A clock-gating cell (an ICG, Integrated Clock Gating cell) fixes
that: it watches a register bank's enable signal and, on the cycles the bank is
idle, holds the bank's clock still so those flip-flops stop toggling and stop
drawing switching power.

Each register bank below shows two numbers: its **clock power** (what it burns
free-running) and its **idle fraction** (the share of cycles it sits idle).
Gating a bank therefore saves idle fraction times clock power. Click a bank to
gate it.

The catch is the cost. Every gating cell you add carries its own overhead (its
leakage and area), charged once. Banks driven by the same enable signal form an
**enable domain** (the columns), and all the banks in one domain share a single
gating cell. So:

- Gating the first bank in a domain inserts its gating cell and pays the
  overhead once.
- Gating the other banks in that same domain is then free savings: no new cell.
- Opening a new domain just to gate a rarely-idle bank can cost more overhead
  than that bank saves.

**Net power saved past target** - net savings is everything the gated banks
save, minus one overhead charge for each domain you gate. Gate the idle-heavy
banks, sweep up the other banks in domains you have already opened, and leave the
barely-idle lone banks free-running. Beat the target, then **Submit design**.
"""

CTS_BANKING_PROMPT = """
**Multi-bit flip-flop banking.** Merging two nearby single-bit flip-flops into a
2-bit bank lets them share one clock buffer, cutting clock power. But the pair
snaps to its midpoint, so its data nets change length.

- **Enough banks** - click a candidate merge (dashed link) to bank the pair.
  Each flip-flop can be in at most one bank. Reach the merge target.
- **Data wirelength in budget** - banking tight pairs is cheap, but banking
  flip-flops that sit far apart stretches their data nets past the budget.

Bank the tight pairs, leave the far ones single, then **Submit design**.
"""

CTS_USESKEW_PROMPT = """
**Useful skew.** Three flip-flops, A then B then C, with logic on each hop. The
path A to B is failing setup. B is the shared flip-flop, and intentionally
skewing its clock trades slack between the neighbouring paths.

- Delaying B's clock gives the data more time to arrive at B, so **setup A to B**
  improves. But the same later clock launches **B to C** later (hurting its
  setup) and shifts B's own capture edge (hurting **hold A to B**).
- **All four checks positive** - slide the skew into the window where setup and
  hold on both paths are met at once.

Borrowing time this way is useful skew. Find the window, then **Submit design**.
"""

CTS_NDR_PROMPT = """
**Non-default-rule (NDR) clock routing.** The clock trunk runs a long way and
must arrive clean, so it is routed with a non-default rule instead of a normal
signal wire.

- **Transition (slew)** - widen the trunk to cut its resistance and clean up the
  transition.
- **Crosstalk delay** - add spacing or grounded shield wires between the trunk
  and the aggressor nets beside it to cut coupling.
- **Routing tracks in budget** - width, spacing, and shields all spend routing
  tracks, so you cannot over-build.

Find the width, spacing, and shielding that clears slew and crosstalk inside the
track budget, then **Submit design**.
"""

CTS_CLUSTER_PROMPT = """
**Clustered buffer tree.** Real sinks are scattered, not on a neat grid, so a
clock-tree tool places a tap buffer (a merge point) for each cluster and drives
the taps from the root. Here you drag the taps.

- **Skew under target** - drag each tap buffer. Every sink is captured by its
  nearest tap, so moving a tap reshapes its cluster. Spread the taps so each one
  owns a compact group of nearby sinks (small tap-to-sink hops), and balance the
  root-to-tap arms so no cluster sits far while another sits close. Both together
  drive the skew down.
- **Latency in budget** - keep the longest path within budget.

Place and balance the taps, then **Submit design**.
"""

CTS_MESH_PROMPT = """
**Clock mesh.** Instead of a tree, the clock wires are shorted into a mesh and
the clock is injected at a few driver points. The clock load is **not uniform**:
the background heat map shows where it is heavy (red) - regions dense with
switching flip-flops droop badly unless a driver sits close, while cool regions
tolerate being far from one.

- **Worst droop under target** - each node's skew is its clock load times its
  distance to the nearest driver. Click mesh nodes to inject drivers, and
  concentrate them on the hot regions so their distance there is small. A node's
  ring turns red when its droop is over the limit.
- **Drivers within the power budget** - every driver burns power, so cover the
  load with the fewest drivers you can.

The lesson is that the heavy regions need drivers packed in close while the light
regions can be sparse. A mesh buys low skew and robustness at the cost of clock
power. Place the drivers where the load is, then **Submit design**.
"""

CTS_SPINE_PROMPT = """
**Clock spine (fishbone).** A vertical spine (trunk) is driven at one point, and
each sink is fed by a horizontal rib from the spine at its row. A path is the
spine travel from the drive point to the sink's row, plus the rib length to the
sink.

- **Skew under target** - drag the spine sideways to balance the rib lengths
  (put it near the middle of the sinks' columns), and drag the drive point up or
  down to balance the spine travel (near the middle of the rows).
- **Latency in budget** - keep the longest path within budget.

Balance the fishbone, then **Submit design**.
"""

CTS_XTREE_PROMPT = """
**X-tree.** An X-tree distributes the clock like an H-tree but along straight
diagonal wires instead of right-angle segments, so the paths are measured as
straight-line (Euclidean) distance. The root drives four quadrant taps.

- **Skew under target** - drag each tap toward the centre of its quadrant and
  keep the four diagonal arms equal. The same symmetry as the H-tree gives
  near-zero skew, now on diagonal routing.
- **Latency in budget** - keep the longest path within budget.

Make the diagonals symmetric, then **Submit design**.
"""

CTS_DEPTH_PROMPT = """
**Buffer-level balancing (on-chip variation).** Balancing the nominal delay is
not enough. Two clock paths that reach their flip-flops through a different
**number of buffer stages** drift apart under on-chip variation, because process,
voltage, and temperature shift each buffer a little and those shifts do not
cancel unless the paths see the same stages. So a robust clock tree gives every
sink the **same buffer depth**.

- **Heavy branches buffered (slew)** - the bold branches carry too much load to
  drive directly, so each one needs a buffer. That buffer also gives its sinks a
  stage.
- **Every path same depth (OCV)** - the light branches would otherwise reach
  their sinks with fewer stages. Add matching buffers on the shallow branches so
  every sink passes through the same number of stages. The on-chip-variation
  skew shown is the per-stage jitter times the stage mismatch; it must reach
  zero.

Placement matters: put each matching buffer where it lifts only the shallow
sinks. Buffering an edge that also feeds a deep sink raises that sink too and
unbalances it again. Match the depths, then **Submit design**.
"""

ROUTE_MAZE_PROMPT = """
**Maze routing (Lee's algorithm).** This is the classic maze router, in its two
real steps.

- **Run the wave (expansion).** Click **Run wave**: a wavefront floods out from
  the source, labelling every reachable cell with its distance from S and
  flowing around the grey blockages. The label on a cell is the length of the
  shortest path to it, so when the wave reaches the target its label is the
  shortest route length.
- **Backtrace the path.** Starting at the target, click your way back to the
  source, each step moving to a neighbour whose label is exactly one lower. That
  downhill walk is a guaranteed shortest path. Click the tip's previous cell to
  undo a step.

Because the path follows the wave's gradient, it is always shortest - there is
no "drawing a wandering line". Run the wave, trace it back to S, then
**Submit design**.
"""

ROUTE_GLOBAL_PROMPT = """
**Global routing and congestion.** Each net is routed as an L across the tile
grid and can bend two ways. Every tile a route crosses uses one unit of that
tile's track capacity, and a tile overflows when more routes cross it than it can
hold.

- **No tile over capacity** - click a net's route to flip its bend, spreading the
  routes so the congestion heat map has no red (over-capacity) tiles.

This is the core of global routing: choosing coarse routes so the design is
congestion-feasible before detailed routing. Clear the overflow, then
**Submit design**.
"""

ROUTE_RIPUP_PROMPT = """
**Rip-up and reroute.** The design comes in already routed, but congested:
several tiles carry more routes than their capacity (red). Rip up and reroute the
offending nets.

- **No tile over capacity** - click a net to flip its bend and pull it off the
  overloaded tiles, without pushing a different tile over.

This is the loop a router runs to resolve congestion. Clear every overflow, then
**Submit design**.
"""

ROUTE_LAYER_PROMPT = """
**Layer assignment.** Each net sits on a metal layer. Upper layers are faster
(lower delay per unit length) but have far fewer tracks; lower layers are slow
but plentiful.

- **Critical nets meet delay** - a critical net's delay is its length times the
  layer's delay factor, and must be under budget. The long critical nets need the
  fast upper layers.
- **Layers within track count** - each layer holds only so many nets, so you
  cannot pile everything onto the fast layers.

Click a net to move it up a layer. Put the long critical nets high, fill the
lower layers with the rest, then **Submit design**.
"""

ROUTE_TRACK_PROMPT = """
**Track assignment.** Within a routing channel, each wire is a fixed horizontal
span and must sit on a track. Two wires on the same track collide if their spans
overlap.

- **No overlaps on a track** - click a wire to move it to another track. Pack
  every wire onto the available tracks with no two overlapping on the same one.

This is the interval-packing step between global and detailed routing. Fit them
all, then **Submit design**.
"""

ROUTE_DRC_PROMPT = """
**Design-rule-clean routing.** The wires in this channel break two design rules:
some are closer than the minimum spacing, and one sits on a routing blockage.

- **Minimum spacing met** - drag the wires apart so every neighbouring gap is at
  least the minimum spacing.
- **No blockage or edge violation** - keep every wire off the grey blockage and
  inside the channel.

Detailed routing is not done until the geometry is design-rule clean. Fix the
violations, then **Submit design**.
"""

ROUTE_VIAMIN_PROMPT = """
**Via minimization.** Routing is preferred-direction: horizontal runs go on one
metal layer and vertical runs on another, so every turn in the wire is a via (a
layer change), and vias cost resistance and yield.

- **Source connected to target** - lay wire from S to T.
- **Vias within budget** - the route's via count is the fewest turns a path
  through your wire takes. Favour long straight runs; a wiggly shortest path racks
  up vias, while a slightly longer, straighter route uses fewer.

Route it with few vias, then **Submit design**.
"""

ROUTE_ANTENNA_PROMPT = """
**Antenna-rule fixing.** Each net's antenna is the run of metal connected to its
gate, drawn as a bar on the layer it runs on (the faint lines above it are the
higher layers). During fabrication a metal run that is too long collects charge
that can damage the gate, so any net whose bar passes the dashed limit (red) must
be fixed. There are two fixes, and which one a net needs is physical:

- **Layer jump** carries the far part of the metal up to the next layer, leaving
  only a short stub on the gate's layer. It needs a layer above to jump to, so a
  net whose metal is already on the **top layer** has nowhere to go and cannot
  jump. Jumps cost no area but use limited upper-layer slots.
- **Diode** adds a small device at the gate that drains the charge. It always
  works, but costs area.

Click a net to cycle its fix (top-layer nets only offer none / diode). Fix every
net, keep jumps within their slots and diode area within budget - so jump the
lower-layer nets whose diode would cost the most, and diode the rest (and the
top-layer ones). Then **Submit design**.
"""

ROUTE_LENGTH_PROMPT = """
**Bus length matching.** You do not length-match every bus. It matters for a
**matched group** of signals that are captured together - above all a
**source-synchronous bus**, such as a DDR memory byte lane, where the data bits
are sampled against a forwarded strobe (DQS), so skew between the bits eats the
timing window directly. SerDes pairs and other clock-forwarded interfaces need
the same. The router is handed the group as a length- (or delay-) match
constraint and tunes the bits to meet it.

Ordinary on-chip nets are not length-matched: each is timed on its own by static
timing analysis, and buffering fixes the slow ones. Here you tune one matched
group.

- **Skew within tolerance** - the bus leaves a common driver and each bit ends at
  a receiver. Click a bit to fold in a serpentine detour (the real "trombone"
  tuning trick) that lengthens it. Bring every bit within the skew tolerance of
  the longest bit.
- Add as little extra wire as you can.

Match the group, then **Submit design**.
"""

ROUTE_XTALK_PROMPT = """
**Crosstalk-aware routing.** Each victim net picks up crosstalk from the
aggressor nets beside it, and coupling over the limit corrupts the signal.

- **Every net under the crosstalk limit** - click a net to cycle its routing:
  default, extra spacing (halves the coupling, costs one track), or a grounded
  shield (cuts it to a fifth, costs two tracks).
- **Extra tracks within budget** - shielding everything would blow the routing
  budget, so shield only the nets where spacing is not enough and space the rest.

Bring every net under the limit within budget, then **Submit design**.
"""

ROUTE_STEINER_PROMPT = """
**Multi-pin (Steiner) routing.** A net usually connects more than two pins, and
the trick is to make the branches **share** metal. This is one net: a root and
several pins, each reaching the root by an L that can bend two ways.

- **Tree wire under target** - where two pins' wires run along the same track,
  the metal is shared and counted once. Click a pin to flip its L so the routes
  funnel onto common trunks (drawn orange). That shared trunk is what makes a
  Steiner tree short: routing every pin independently (a star) uses far more
  wire than letting them share a spine.

Funnel the routes to share, bringing the total under target, then
**Submit design**.
"""

ROUTE_PINACCESS_PROMPT = """
**Pin access.** A standard-cell pin is a small metal shape, and the router can
only drop a via onto it from a few nearby routing tracks - the pin's candidate
access points. When neighbouring cells crowd together, their pins compete for
the same tracks.

- **Every pin on its own track** - each column is a routing track, each row a
  pin; a hollow dot is a track the pin could use, the filled dot is the one it
  uses now. Two pins on the same track collide (red), because a single vertical
  track cannot access both. Click a pin to move it to another candidate track so
  every pin has a clear one.

This local competition for access points is one of the hardest parts of detailed
routing at advanced nodes. Give every pin its own track, then **Submit design**.
"""

STA_SLACK_PROMPT = """
**Slack and maximum frequency.** Data leaves the launch flip-flop after
clock-to-Q, runs through the logic, and must arrive before the capture edge with
setup margin. **Setup slack = (period - setup) - arrival.**

- Drag the clock period down. As it shrinks, the capture edge moves left and
  slack falls toward zero. Find the smallest period that still has slack >= 0 -
  the reciprocal of that period is the path's maximum frequency.

Push to the limit (slack just above zero), then **Submit design**.
"""

STA_SETUPHOLD_PROMPT = """
**Setup and hold.** A flip-flop needs its data both late enough and early enough.

- **Hold** - the data must not arrive until the hold time after the launch edge,
  so the path cannot be too fast.
- **Setup** - the data must arrive before the next capture edge minus setup, so
  the path cannot be too slow.

Drag the data-path delay into the window where both hold slack and setup slack
are non-negative, then **Submit design**.
"""

STA_CRITICAL_PROMPT = """
**Critical path.** A combinational cone connects FF_A to FF_Z through gates, each
with its own delay. Several paths run through it, all with the **same number of
gates** - so you cannot spot the worst one by counting. You have to add up the
gate delays.

- Click FF_A, then follow one path's gates to FF_Z; the delay sums as you go
  (click the last gate again to back up). Trace each path to compare their sums.
- **Submit the path with the largest total delay** - arrival = clock-to-Q plus
  the gate-delay sum, and the biggest arrival has the least slack. That is the
  critical path, the one you would fix first.
"""

STA_UNCERTAINTY_PROMPT = """
**Clock uncertainty.** Real clocks jitter and skew, so sign-off reserves a
**clock-uncertainty** guardband before the setup window (the pink band). Required
time = period - setup - uncertainty.

- Drag the clock period to the smallest value that still meets timing WITH the
  uncertainty included. Notice the maximum frequency is lower than the raw path
  delay alone would suggest - the margin is not free.

Find the limit, then **Submit design**.
"""

STA_EXCEPTIONS_PROMPT = """
**Timing exceptions (triage).** The default single-cycle analysis flags a pile of
violations. Your job is to triage each path into what it really is:

- **single-cycle** - an ordinary path that is fine as reported.
- **multicycle-N** - the data is only sampled every N clocks (a slow pipeline, a
  config word updated every few cycles). Read the note for the exact N.
- **false path** - never a real functional path: a synchronizer stage, a
  scan/test-only path, an asynchronous or quasi-static crossing.
- **REAL violation** - a genuine single-cycle functional path that is simply too
  slow. This is a real bug: it goes back for a fix (resize, restructure), you do
  **not** exception it.

Read each path's note and classify it. The trap: false-pathing a real functional
violation makes the number green but hides a bug that will fail in silicon.
Triage them all, then **Submit triage**.
"""

STA_CORNERS_PROMPT = """
**Multi-corner sign-off.** The same path is signed off at every corner. Its
delay scales with the corner (process, voltage, temperature): setup is worst at
the **slow** corner, hold is worst at the **fast** corner, and sign-off must
pass both checks at every corner.

- **Hold does not depend on the clock period.** Sliding the period alone can
  never fix the fast-corner hold violation you start with. You have to add
  **min-delay** (a hold buffer) on the path until the fast-corner hold slack
  turns positive.
- But that added delay lengthens the **slow-corner** path, so it raises the
  period you need to still meet setup. Over-add and the slow corner fails setup.

Balance the two knobs (period and added min-delay) so every corner meets setup
**and** hold, then **Submit design**. Less added delay and a faster clock score
higher.
"""

STA_OCV_PROMPT = """
**On-chip variation and CPPR.** A launch flip-flop feeds combinational logic
into a capture flip-flop. On-chip variation (OCV) derates the **launch** clock
path late (slow, x dLate) and the **capture** clock path early (fast, x dEarly)
so the analysis is pessimistic. Here it drives the path negative.

- Both clocks first travel a **common trunk** of buffers, then split to the two
  flip-flops. That shared trunk cannot be slow for launch and fast for capture at
  the same instant, so the derate difference on it is **fake pessimism**.
- **Common-path pessimism removal (CPPR)** credits it back. The credit is the
  shared wire delay times the derate spread: **credit = (shared delay) x (dLate -
  dEarly)**. The divergent branches after the split are real skew and earn no
  credit.

Click the clock-tree segments that are **shared** by both flip-flops (the whole
trunk from the source to the split), then **Submit sign-off**. Identify the full
common path and no branch segment.
"""

STA_XTALK_PROMPT = """
**Crosstalk delta-delay.** A victim net transitions inside its **switching
window** (the green band). Coupled aggressors can inject extra delay, but **not
every aggressor counts**. Only the ones that meet both tests belong in the
worst-case **setup** budget:

- **Temporal alignment.** The aggressor must switch **inside the victim window**.
  One whose window cannot overlap the transition injects nothing.
- **Direction.** It must switch the **opposite** way. Opposite switching roughly
  doubles the effective coupling capacitance (Miller effect) and **slows** the
  victim. A **same-direction** aggressor speeds the victim up, which eases setup,
  so it is left out of the setup budget.

Each contributor adds **delta = k x Cc** (its coupling capacitance sets the
size). Click the aggressors that qualify. The budget is summed from their
coupling caps and added to the arrival. Watch how a nominal slack that looks
comfortable shrinks to the real margin once the aligned, opposite aggressors are
counted. Select exactly the contributors, then **Submit sign-off**. (Hold is the
mirror case: same-direction aligned aggressors are the risk there.)
"""

STA_REPORT_PROMPT = """
**Reading a timing report.** Below is a **real** `report_checks` path, taken
verbatim from an OpenROAD / OpenSTA run on the ASAP7 predictive PDK (process
design kit) - a register-to-register path from a real place-and-route run.

Read it and answer the questions. Each one needs you to interpret the report,
not just copy a line:

- The **Path Type** tells you whether this is a setup (max) or hold (min) check.
- The **data-arrival path** ends at "data arrival time"; the **data-required
  path** (clock edge, uncertainty, reconvergence pessimism, library setup time)
  ends at "data required time". **Slack = required - arrival**, which the tool
  prints on the last line.
- The **clock period is not printed as a number.** Infer it: it is the capture
  clock edge time minus the launch clock edge time.

Answer all three, then **Submit answers**. Report literacy is most of the
day-to-day STA (static timing analysis) job.
"""

STA_IO_PROMPT = """
**Interface (input/output) timing.** Register-to-register paths live entirely
inside the chip, but an **I/O path** is only partly yours. Part of the clock
period is spent off-chip, and STA (static timing analysis) captures that with
`set_input_delay` / `set_output_delay` (specified relative to a clock, often a
**virtual** one that models the far device):

- **Input path:** off-chip launch (the source's clock-to-Q plus board routing =
  the **input delay**) + your internal logic + capture setup.
- **Output path:** your clock-to-Q + your internal logic + the **output delay**
  (the far device's setup plus board routing).

The **clock period is fixed.** Each interface path is drawn as a budget bar
against the capture edge. For every path, pick the **cheapest** fix that makes it
fit:

- **Leave it** if the bar already fits.
- **Optimize the logic** when your internal logic is the bottleneck (this shrinks
  the internal segment to its floor).
- **Register the boundary port** (a flop at the pin) only when the off-chip
  delay is so large the path cannot fit **even with optimized logic**. This
  breaks the external delay off the internal budget, but it **costs one extra
  cycle of latency**, so do not use it where optimizing would have been enough.

Aim each fix at the real bottleneck (read the budget split), then **Submit
fixes**. Over-fixing (registering when optimizing would do) is marked wrong.
"""

STA_BORROW_PROMPT = """
**Time borrowing with transparent latches.** The circuit is a chain of
combinational-logic stages between sequential elements, ending in a capture
flip-flop. An edge-triggered **flip-flop** has a hard deadline at the clock edge:
a stage slower than one period fails, and a fast stage's early slack is wasted.

A level-sensitive **latch** is *transparent* for a fixed window **W** after the
edge (the clock high phase, shown in green). Data arriving late flows straight
through, so the stage feeding a latch can **borrow** time past the edge - repaid
because the next stage then starts that much later.

- **Click a sequential element to switch it between flip-flop and latch.** Under
  each logic cloud, a gauge shows that stage against its clock edge and the
  latch's transparent window.
- Put a **latch** only where a stage **overruns its edge** (so the overrun can
  borrow). Leave the rest as **flip-flops**: a latch adds hold / min-delay race
  risk, so using one where the stage already fits is a needless cost.
- The endpoint is a fixed flip-flop, and it works out because the **average**
  stage delay fits the period even though some stages do not.

Find the **fewest latches** that let every stage be captured, then **Submit
design**. Over-latching (a latch where a flip-flop would do) is marked wrong.
"""

# --- Physical Verification (scaffold stubs; interactive model built later) ---
PV_WIDTH_PROMPT = """
**Minimum width and spacing.** DRC (Design Rule Check) measures every shape on a
layer against the foundry's geometric rules. This metal layer breaks two of them,
and you fix the geometry until it is clean:

- **Minimum width, W<sub>min</sub> = 0.10.** A wire's width is its thickness, the
  narrow dimension. A wire thinner than W<sub>min</sub> is a violation. Drag a
  wire's **bottom edge** to make it thicker.
- **Minimum spacing, S<sub>min</sub> = 0.10.** Spacing is the gap between two
  separate shapes. A gap smaller than S<sub>min</sub> is a violation. Drag a wire
  to **move it** and open the gap.

Each wire shows its thickness and each gap its size; a value at or above the
minimum is legal (green), below it is a violation (red). Fix every violation, then
**Submit fixes**. Dimensions in micrometres.
"""

PV_ENCLOSURE_PROMPT = """
**Via enclosure and minimum area.** DRC (Design Rule Check) enforces two more
geometric rules on this layer, and you fix the geometry until it is clean:

- **Via enclosure, E<sub>min</sub> = 10 nm.** A via is a small cut connecting two
  metal layers. The metal around it must extend past the cut on **every side** by
  at least E<sub>min</sub>, so the via still lands on metal when the two layers
  shift slightly during manufacturing. A via whose metal is too small on any side
  is under-enclosed. Grow the metal to enclose it.
- **Minimum area, A<sub>min</sub> = 2000 nm&sup2;.** A shape smaller than
  A<sub>min</sub> cannot be patterned reliably. Enlarge a sliver shape until its
  area reaches the minimum.

Each shape reports its enclosure or its area; green is legal, red is a violation.
**Drag a shape's corner handle** to grow it about its centre. Fix every
violation, then **Submit fixes**. Dimensions in nanometres.
"""

PV_SPACING_PROMPT = """
**Width-dependent and end-of-line spacing.** Minimum spacing is not a single
number. Two rules make the required gap depend on context, and you judge each
marked spacing against them:

- **Width-dependent spacing (the fat-wire rule).** The wider a neighbour is, the
  more spacing it needs. The required gap is set by the **wider** of the two
  shapes, read from the rule table: at most 0.10 wide needs 0.10, up to 0.20
  needs 0.14, and wider than 0.20 needs 0.20.
- **End-of-line spacing.** A wire **end** (a narrow tip) needs more clearance
  than a wire side: at least 0.16, whatever the width.

The consequence is that the same gap can be legal in one place and a violation
in another. Read each marked spacing against the table and its context, click it
to mark it **legal** or a **violation**, then **Submit triage**. Dimensions in
micrometres.
"""

PV_DENSITY_PROMPT = """
**Density and metal fill.** After each metal layer is patterned it is polished
flat by CMP (Chemical Mechanical Polishing). The polish only stays planar where
the metal density is even, so the foundry divides the die into **windows** and
requires each window's density to sit inside a band, here **30% to 70%**.

- **Below the floor (too sparse).** In a nearly empty window the polish removes
  too much, an effect called erosion, and the surface dips. The fix is to add
  **dummy metal fill** until the window reaches the minimum.
- **Above the ceiling (too dense).** A very full window polishes unevenly too:
  wide metal dishes in the middle. Fill cannot fix this, because fill only
  **adds** metal. A window that is genuinely over the ceiling is a routing
  problem, fixed by spreading the wires out or by **slotting** (cutting holes
  into wide metal to remove area), not by fill. So in this lab a window goes over
  the ceiling only if you over-fill it, and the fix is to remove that fill.

**Fill is not free, and it is not "fill every gap".** Dummy metal placed next to
a signal wire adds **capacitance** to that net, which slows it and costs power.
So fill is added only to reach the density target, kept clear of timing-critical
nets, and never packed into every empty site. Fill tied to a power or ground rail
(**grounded fill**) also shields its neighbours; **floating fill** mainly loads
them.

The die below is a grid of cells: **dark cells are existing metal**, fixed by the
design. Thick lines divide it into **density windows**, and each window's density
is the fraction of its cells that hold metal. **Click an empty cell** to drop in
a dummy-fill cell, **click a fill cell** to remove it. Fill the sparse windows up
to the band without pushing any window past the ceiling, then **Submit fill**.
"""

PV_LVS_PROMPT = """
**Shorts and opens.** LVS (Layout Versus Schematic) checks that the layout
connects things exactly as the schematic says. It extracts the connectivity from
the drawn metal and compares it to the schematic net list. Two defects break the
match:

- A **short** is metal that joins two **different** nets, so they read as one.
  The fix is to remove the metal bridging them.
- An **open** is a **missing** connection inside a net, so the net's terminals
  are not all joined. The fix is to add metal to connect them.

Each pad on the grid is labelled with the net it belongs to. **Click a
connection** (between two pads, horizontal along a row or vertical between rows)
to add metal (shown dashed) or remove it (shown solid). Audit every connection:
join each net's own pads and keep different nets apart, then **Submit layout**.

A short can **cascade**: metal that ties net X to net Y through a pad of net Z
merges all three, so one bad bridge can report as several shorts. Adding a
connection between different nets creates a short of its own, so connect only
what the schematic groups together.
"""

PV_DEVICE_PROMPT = """
**Device matching.** Once LVS (Layout Versus Schematic) has matched the
connectivity, it pairs each device in the layout with its device in the
schematic and checks that the two agree. A pair can fail in several ways, and a
device can also be present on only one side:

- **match** - same type and same size on both sides.
- **wrong size** - the width or the length differs (a mis-drawn transistor).
- **wrong type** - one side is NMOS and the other PMOS.
- **missing** - the schematic has the device but the layout does not.
- **extra** - the layout has a device the schematic does not.

Read each row's schematic and extracted specification, click the row to set its
verdict, and get every device right. A device can match on connectivity yet
still differ in size or type, so check the type and both dimensions. Then
**Submit verdicts**.
"""

PV_ERC_PROMPT = """
**Floating nodes and tie cells.** ERC (Electrical Rule Check) flags every gate
input that is not properly driven, but the correct fix depends on **what the
input is**. Each flagged pin gets one of four dispositions:

- **Leave it** if the input is already **driven** by a real net. Tying a driven
  input makes the tie cell fight the driver, a contention short.
- **Tie-high** or **tie-low** a floating **control** input that must hold a
  constant: high for a logic 1, low for a logic 0. A constant does not go
  straight to a rail; it goes through a **tie cell** (which protects the gate
  oxide).
- **Route a net** to a floating **data** input. A dangling data pin is a real
  **open** (a missing connection). It must be wired to its signal; tying it off
  would only hide the bug.

The slice is drawn with real cell symbols (NAND, AND, OR, inverter, and a
flip-flop with an unused async reset). Click a flagged pin to cycle its
disposition, using the **netlist** on the right to read each pin's role, then
**Submit fixes**.
"""

PV_SIGNOFF_PROMPT = """
**Tapeout sign-off gate.** The final go / no-go review, and it takes judgment:
the status a check reports is not the same as whether it blocks tapeout. For each
check, read the context and give it a disposition:

- **Sign off** - genuinely clean **and** run on the current database.
- **Waive** - it has violations, but a **valid waiver** applies: violations inside
  a licensed IP (Intellectual Property) macro with a signed vendor waiver, or on
  structures outside the die such as scribe-line process monitors.
- **Fix** - a real blocker. An open violation with no waiver; a functional
  mismatch that **cannot** be waived (an LVS - Layout Versus Schematic - mismatch
  is a real connectivity error, not a paperwork problem); or a result that reads
  **clean but is stale** (run before the last change), which must be re-run.

The traps are the ones that require thinking: a red violation pill can be a
legitimate waiver, an LVS waiver request must be **refused**, and a green
“clean” pill can still be stale. Disposition every check, then **Submit
sign-off**. You clear the gate only when each call is correct.
"""

PV_ANTENNA_PROMPT = """
**Antenna ratio and diodes.** During etch, charge builds up on the conductor
connected to a gate before an upper layer or a diode can drain it. The **antenna
ratio** is the net's metal area divided by the gate-oxide area it drives; above
the limit the charge can damage the gate. For each net, pick the minimal fix:

- **OK** - the ratio is already at or under the limit.
- **Jump** - route part of the net to a higher layer so less area accumulates on
  the offending layer. Preferred, because it is free. Valid when the jumped ratio
  falls under the limit.
- **Diode** - add a protection diode that drains the charge. It always works but
  costs area and adds leakage, so it is a **last resort**, used only when jumping
  cannot get the net under the limit.

Read each net's ratio (and its jumped ratio), then disposition it. Using a diode
where a jump would do is marked wrong. Then **Submit fixes**.
"""

PV_DFM_PROMPT = """
**Redundant vias (via doubling).** This is a DFM (Design for Manufacturability)
step, a recommended rule rather than a hard one. A single via between two metal
layers is a yield risk: if that one cut voids or breaks, the net opens. Doubling
a via into a redundant pair means a single cut failure does not open the
connection.

- **Double** every via that has **room** beside it for a second cut (click it).
- **Leave single** any via that is **boxed in** by neighbouring metal: a second
  cut there would break the spacing rule.

Doubling a blocked via creates a spacing violation; leaving a via single where
there was room misses the yield improvement. Double all the feasible vias and no
others, then **Submit vias**.
"""

ECO_BUFFER_PROMPT = """
**Buffer insertion.** A driver reaches a far flip-flop through a long wire, and
the path misses setup. On an unbuffered wire every segment carries all of the
load downstream of it, so the delay grows with the **square** of the length: long
nets are quadratically slow.

Inserting a **buffer** splits the wire. Each buffer re-drives the signal, so the
piece after it starts fresh and the driver upstream sees only the load up to the
buffer. Splitting one long quadratic into several shorter pieces cuts the delay
sharply. But each buffer adds its own fixed delay, so past a point more buffers
make the path slower again: there is an optimum.

Click a tick on the wire to add or remove a buffer, watch the far-sink delay move
against the limit, and get it at or under the limit with as few buffers as you
can. Then **Submit buffers**.
"""

ECO_VTSWAP_PROMPT = """
**Threshold-voltage swap.** A multi-Vt (threshold-voltage) library carries each
cell in several flavours. A **lower** threshold makes the cell faster (less
delay) but leaks far more current. The path here is built entirely of high-Vt
(HVT) cells and misses setup.

Click a cell's Vt to cycle **HVT -> SVT -> LVT**. Each step down cuts that cell's
delay but multiplies its leakage (HVT 1x, SVT 3x, LVT 9x). Close the setup path
(slack at or above zero) while keeping total leakage under the budget.

Swapping every cell to the fastest LVT meets timing but busts the leakage budget,
so the move is selective: swap the **largest-delay** cells first (they buy the
most speed per unit leakage), and only as far down in Vt as needed. Reach
positive slack at the least leakage, then **Submit swaps**.
"""

ECO_PINSWAP_PROMPT = """
**Pin swap.** A multi-input gate's inputs are logically interchangeable, but they
are not electrically equal: each input pin has its own pin-to-output delay. The
gate's output is ready at the **worst** of (signal arrival + that pin's delay)
across all inputs. If the latest-arriving signal happens to sit on the slowest
pin, the path through the gate is longer than it needs to be.

The fix costs no area: just rewire. Move the late signal onto a **faster** pin
and push the early signals onto the slower pins. Nothing about the cell changes,
only which wire lands on which input.

Click two input pins to swap the signals feeding them. Get the output at or under
the required time, then **Submit wiring**.
"""

ECO_CLONE_PROMPT = """
**Driver cloning and load split.** A single driver feeds a large number of sinks.
Its delay grows with the total capacitive load it drives, so a high-fanout net is
slow: one gate is trying to charge every sink at once.

**Cloning** the driver makes identical copies of it, all fed by the same upstream
signal, and splits the sinks among the copies. Each copy then drives only its
share of the load, so each is faster. The gain comes from **balancing** the split:
if one copy is left carrying most of the sinks, its delay still dominates and the
net is no faster. The worst copy sets the timing.

Click a sink to move it to the next driver copy. Balance the fanout across the
three drivers so the worst copy's delay meets the limit, then **Submit split**.
"""

ECO_HOLD_PROMPT = """
**Hold fixing.** A hold check compares data launched by one clock edge against the
**same** capture edge: the newly launched value must not race through the logic and
reach the capture flip-flop before that flop has safely held its previous value.
Here the capture clock arrives later than the launch clock (positive clock skew),
so the data gets there too early and the path misses hold.

The fix is to slow the data path down by inserting **delay cells**. But the same
path is still checked for **setup** against the **next** edge, so adding too much
delay makes the data arrive too late and breaks setup instead. The path delay must
land inside a window: at least the hold floor, at most the setup ceiling.

Click a slot on the data path to add or remove a delay cell. Watch the path-delay
marker move between the hold floor and the setup ceiling, land it inside the green
window, and use the **fewest** cells that pass both (less added area and power, and
more setup margin left over). Then **Submit fix**.
"""

ECO_SKEW_PROMPT = """
**Useful-skew clock ECO.** A flip-flop sits between two logic stages: one stage
feeds into it, the other leaves it. When the stage feeding it is setup-critical but
the stage leaving it has slack to spare, you can **retard that flop's clock**: a
later capture edge lends time to the tight stage, at the cost of the loose one,
which now launches later. This is useful skew. The data path is untouched, only the
clock arrival at one flop moves, transferring slack from where it is plentiful to
where it is scarce.

Skew too far and the loose stage goes negative in turn, so there is a window.

Think of it as one fixed pool of time split between the two stages, with the shared
clock edge deciding the split. **Click a stage to lend its timing margin to the
other**: click **stage B** to move time into the tight stage A, or click **stage A**
to move it back to stage B. Under the hood each click retards or advances FF2's
clock, shown on its clock branch. Land **both** stages at or above zero, and prefer
the **balanced** point (equal margin on each side, the safest against timing
spread). Then **Submit skew**.
"""

ECO_METAL_PROMPT = """
**Metal-only spare-cell ECO.** Once the base (transistor) layers are fabricated, a
late change can touch only the metal and via layers: no new transistors. Designs are
seeded with **spare cells**, unused gates of fixed types scattered around, precisely
so late fixes have something to wire up. A real metal-only ECO is a **batch** of
small fixes competing for one shared pool of spares.

The block is already placed and wired. Most of the cells (the grey hatched ones:
flip-flops, a multiplexer, an AND-OR-Invert, and the rest) are functional logic in
use. Their transistors are committed, so they **cannot** be re-wired. Only the idle
**spare cells** scattered among them can be claimed.

Three changes here share that spare pool. Site 1 needs a 2-input AND, built as a
spare **NAND2** (Not-AND) feeding a spare **inverter**. Site 2 needs a **buffer**,
one spare cell. Site 3 needs a 2-input OR, built as a spare **NOR2** (Not-OR)
feeding a spare **inverter**. Because only metal wire is added, the cost is the
length of that wire, and a spare can serve **only one** change, so the two inverters
must be different cells.

Click a change to make it active, then click spare cells to wire them into it.
Clicking a functional cell explains why it is off limits. Get every change built
from the right types and keep the **total** added wire at or under budget by claiming
spares near each site. Then **Submit ECO**.
"""

ECO_RESPIN_PROMPT = """
**Metal-only vs all-layer decision.** With the base (transistor) layers already on
silicon, a change is cheap only when it can be done by re-wiring metal and vias:
reusing a pre-placed spare cell or moving connections. A change that needs new
transistors (a stronger cell, a new flip-flop, a whole new block) forces new
base-layer masks: an **all-layer respin**, which is slow and costly.

For each proposed change, decide the class it falls into, given the spare cells on
hand. The dividing question is always the same: does this need a new transistor, or
just new wire to a spare that already exists?

Classify every row as metal-only or all-layer, then **Submit calls**.
"""

ECO_DRV_PROMPT = """
**Electrical design-rule violation (DRV) fix.** Not every violation is a slack
violation. Every net also has to meet **electrical** rules, whatever the timing:
**max fanout** (a driver may drive only so many loads), **max capacitance** (a net
may carry only so much load capacitance), and **max transition** (the signal edge
must be sharp enough, which fails when a driver cannot charge its load quickly).

The net here fans out to many sinks and breaks all three at once. The fix is to cut
the load each driver sees by inserting **buffers** that split the fanout: each buffer
re-drives a share of the sinks. But the original driver now drives the buffers, so
its own fanout and capacitance climb with the buffer count. Over-buffer and it
violates in turn, which is why a very wide net needs a buffer **tree**, not a flat
row.

Click a slot to add or remove a buffer, and clear **all three rules at every
driver** with the fewest buffers. Then **Submit fix**.
"""

ECO_RESTRUCT_PROMPT = """
**Logic restructuring.** A path can be slow because of the **shape** of the logic,
not the strength of the cells. A deep chain of gates adds one gate delay per level,
and a late-arriving signal buried deep in it then passes through many more gates on
its way to the output. Restructuring rebuilds the **same function** with a better
shape, so it changes no cell sizes and no thresholds.

Two levers set the delay. **Balance** the tree so it is shallow: combining the early
signals first keeps the depth low. And put the **latest-arriving** signal closest to
the output, so it sees the fewest gates after it.

These signals combine through 2-input gates, and each gate's output is ready at the
later of its two inputs plus one gate delay. Signal **s5 arrives late**, so keep it
for the final gate. Click two nodes to combine them, build the tree down to one
output at or under the required time, then **Submit tree**.
"""

ECO_LEGAL_PROMPT = """
**Placement ECO and legalization.** When an ECO inserts new cells, the placer first
drops them at their **ideal** position, where timing and wirelength want them. Those
spots normally land on top of cells that are already placed, and may not sit on the
placement **site grid**, so the layout is illegal. Legalization repairs it: every
cell has to end up **inside a standard-cell row, aligned to the site grid, and not
overlapping** any other cell.

The catch is displacement. Moving a cell away from its ideal spot erodes the timing
and wirelength the placer chose, so a legalizer moves each cell as **little** as
possible: it snaps to the nearest legal gap, not just any gap. On a packed die the
nearest gap is often not in the cell's own row, so a legalizer will hop to an
**adjacent row**, and displacement counts that vertical move too.

The placer has already dropped **four** ECO cells onto a full die at their ideal
spots, and every one lands on occupied sites, so all four start **illegal** (shown
red, with a dashed marker at each cell's ideal). Pick a cell, then click a site to
move its left edge into a free gap wide enough for it, with no overlap. Some cells
have no close gap in their own row, so the smallest move is into a neighbouring row.
Keep the **total** displacement at or under budget, then **Submit placement**.
"""

SYNTH_TWOLEVEL_PROMPT = """
**Two-level minimization.** Any Boolean function can be written as a sum of products
(an OR of AND terms). The smallest two-level form uses the fewest, largest product
terms that still cover every input for which the function is 1. Those largest terms
are the **prime implicants**, and the job is to pick a set of them that covers all
the 1s at the **least total cost** (literals).

The map on the left shows the 1s of a 4-variable function. Each prime implicant on
the right is a largest group of 1s, worth its number of literals (a bigger group
spans more 1s with fewer literals, so it is cheaper).

A 1 that only one implicant can cover is **essential**: that implicant must be in
the cover. Take the essentials first, then cover whatever 1s remain with the fewest
extra literals. Click implicants to build the cover, reach full coverage at minimum
cost, then **Submit cover**.
"""

SYNTH_CONSTPROP_PROMPT = """
**Constant propagation and dead-logic sweep.** Real designs strap configuration
inputs to fixed values: a mode pin held low, an unused feature disabled. Those
constants flow through the logic, and the label above each gate shows the value its
output then carries.

Here **sel = 0** and **en = 1** are tied. A gate is removed for one of three reasons:

- its output **folds to a constant** (g1 = a AND 0 = 0),
- its output is just a **copy of one input**, so the gate is really a **wire**
  (g2 = b AND 1 = b; an AND with 1, or an OR with 0, passes its other input
  unchanged),
- its output is **unused**, driving nothing: **dead** logic (g6).

A gate stays only if it still computes a real function of two live signals (g4 =
b XOR c). So g2 is not "dead", it just collapses to a wire: the gate does no work, so
it is deleted and b connects straight through. Click every gate that gets removed,
then **Submit sweep**. The whole output reduces to out = b XOR c.
"""

SYNTH_FACTOR_PROMPT = """
**Common-subexpression extraction.** When the same subexpression appears in several
places, building it once and reusing it is cheaper than building it every time. This
is how multi-level logic beats flat two-level form on size.

The rows are the design's product terms; a dot means the term contains that literal.
A shared subexpression is a **rectangle**: a set of terms that all contain a set of
literals. Extracting it builds the shared factor once, and each term reuses it. Its
worth is

    value = R x L - R - L

for a rectangle of R terms and L literals: the R x L shared literals removed, minus
the L literals to build the factor once and the R wires that replace it.

Click term rows and literal columns to select a rectangle (every selected cell must
be filled). Find the rectangle with the greatest value, then **Submit factor**.
"""

SYNTH_MAP_AREA_PROMPT = """
**Technology mapping for area.** After the logic is simplified, it must be built from
real standard-cell library gates. Mapping covers the technology-independent network
with library cells so that **every node is covered exactly once**, at the **least
total area**.

The subject graph is a real network of primitive gates: g1 = AND(a,b),
g2 = AND(g1,c), g3 = OR(g2,d), g4 = INV(g3) = out. Each library cell matches a real
pattern of these gates: **AND3** is the two chained ANDs, **NOR2** is the OR feeding
the inverter, **AOI21** is the AND-OR-INV run, and the small cells cover one gate
each.

A cell that spans several gates is usually cheaper per gate, but the biggest match is
**not always best**: grabbing the AOI21 covers three gates cheaply yet leaves g1
stranded as its own AND2, and that total loses to covering the two ANDs as one AND3
and the OR-INV as one NOR2. The least-area cover is a **balance**.

Click cells to build a valid cover (every gate covered exactly once, none covered
twice), reach the minimum area, then **Submit mapping**.
"""

SYNTH_MAP_DELAY_PROMPT = """
**Technology mapping: area vs delay.** The smallest mapping is not always the right
one. The circuit is a **wide AND**: ten 2-input AND gates chained into an 11-input
AND. Mapping groups the chain into library AND cells, where a group of **k** gates
becomes one **AND(k+1)** cell (up to AND4). A wider cell does more in a single logic
level, so it is **faster**, but it costs more **area**. The output arrival is the sum
of the cell delays along the chain, and it must meet a target.

The cheapest mapping, every gate its own AND2, is **too slow**. The fastest, all
AND4, **over-spends** area for speed the target does not need. The right answer widens
the cells **just enough** to meet the target.

Click a boundary between two gates to merge them into one wider cell, or split again.
Meet the arrival target at the **least area**, then **Submit mapping**. This is why
the cost function is an input to synthesis: the same logic maps to a different netlist
when the block is timing-limited rather than area-limited.
"""

SYNTH_RETIME_PROMPT = """
**Retiming.** A pipeline is a chain of combinational gates split into stages by
registers, and its **clock period** is set by the slowest stage: the longest run of
gate delay between two adjacent registers. Retiming relocates registers across the
gates, without changing what the circuit computes at its inputs and outputs, so the
stages are balanced and the slowest one is as fast as possible.

This chain has fixed input and output registers and **two movable internal
registers** (three stages). They start bunched near the end, so one stage carries
almost all the delay. Click a boundary between two gates to move a register there.
Moving a register earlier shortens the stage after it and lengthens the one before,
so it is a balancing act.

Keep exactly two internal registers (a pipeline's register count is fixed, it sets
the latency), balance the three stages to the smallest possible period, then
**Submit retiming**.
"""

SYNTH_FSM_PROMPT = """
**FSM state encoding.** A finite-state machine's states each need a binary code
stored in the state flip-flops, and the choice of codes decides how much next-state
logic is built. Every bit that flips on a transition is a bit the logic must compute,
so a good proxy for the cost is the total **Hamming distance** (the number of bits
that change) summed over all transitions. States that transition into one another
want codes that differ in as few bits as possible.

Click a state to cycle its 2-bit code; all four codes must stay distinct. The
transitions form a ring plus one chord, so give the ring a **Gray-code** order (each
step changes one bit). Reach the minimum total distance, then **Submit encoding**.
"""

SYNTH_DATAPATH_PROMPT = """
**Datapath operator selection.** An arithmetic operator like + is not one circuit.
The same addition can be built three ways, and the lab draws each as its real
gate-level structure so you can see the trade-off:

- **ripple-carry**: one row of full adders, the carry rippling from cell to cell.
  Small area, but the long carry path makes it slow.
- **carry-select**: two ripple rows (one assuming carry-in 0, one assuming 1) plus a
  mux that picks the right answer the moment the carry-in is known. About double the
  area, but faster.
- **carry-lookahead**: full adders plus a block that computes every carry in parallel.
  The most area, the shortest delay.

The datapath chains four adds, out = ((((v+w)+x)+y)+z), so the path delay is the sum
of the four adders' delays. Click an adder to change its architecture. Meet the delay
target at the **least total area**: making every adder fast is wasteful, so spend the
fast architectures only where you must. Then **Submit datapath**.
"""

PLACE_MIXED_PROMPT = """
**Mixed-size placement.** Real placement is not a clean field of identical cells.
Large hard macros (the grey blocks: a memory, a multiplier, a signal-processing
core) are already fixed in the floorplan, and the standard cells have to be
placed in the gaps around them.

- **No overlap with the macros** - a standard cell may not sit on top of a fixed
  macro, so the routing channels between the macros are where the cells go.
- **Wirelength under target** - place each cell near the macro or pin its net
  reaches, threading around the blockages, so the total wire stays under target.

Fit the cells into the channels and pull each toward its connection, then
**Submit design**.
"""

PLACE_REGCLUSTER_PROMPT = """
**Clock-aware placement: register clustering.** The teal cells are registers
(flip-flops) that all share one clock. If they are scattered, the clock tree
that reaches every one of them is long and burns power. So group them.

- **Registers clustered** - keep all the registers inside one tight box (the
  dashed clock-group outline). Its span - width plus height - must stay under
  the limit, so the clock tree stays short.
- **Wirelength under target** - each register also drives a data cell that must
  reach its boundary pin, which pulls the registers apart. Keep total wire under
  target anyway.

Pack the registers together for the clock while still letting the data reach its
pins, then **Submit design**.
"""

PLACE_GATESIZE_PROMPT = """
**Gate sizing (timing optimization).** This is a real register-to-register
timing path analyzed with static timing analysis (STA). Data leaves the **launch
flip-flop** after its clock-to-Q delay, runs through a small combinational cone
that splits and reconverges, and must reach the **capture flip-flop** with setup
margin before the next clock edge. Each combinational gate has a drive-strength
slider.

When you run timing, arrival times propagate forward along the arcs. Where paths
reconverge, the arrival is the **latest** of the incoming arcs - that is the
critical path. Required times propagate backward from the setup constraint, and
the slack at each node is required minus arrival.

- **Setup slack >= 0** - the data must arrive at the capture flip-flop no later
  than the clock period minus setup. The critical path (the least-slack chain,
  highlighted) is what fails first, so a gate left small on one branch can make
  that branch critical even when the other is fast.
- **Area in budget** - the total drive strength must stay under budget, so you
  cannot simply make every gate huge.

Two catches mirror logical-effort sizing. A gate driving a heavy load is slow,
so the stages near the capture flip-flop want more drive. And a bigger gate has
a bigger input capacitance that loads whatever drives it: sizing one gate up
speeds its own arc but slows the arc feeding it.

Running timing prints a **per-arc timing report** for the critical path, like a
`report_timing` from a static-timing tool: each stage shows the cell and its
drive size, its output load (Cout), the signal **slew** (transition), the arc
**delay**, and the cumulative **arrival**, ending with the required time and the
slack. Read it to see exactly how a size change moves the numbers: upsizing a
gate drops that row's Cout ratio, so its slew and delay fall, while the row above
it gains load and its delay rises. The net effect on the endpoint arrival is what
you are steering.

Work the way the real flow does: adjust the drive strengths, then click **Run
timing** to regenerate the report. The report, slack, and verdict update only
when you run timing, and any later change marks them out of date until you run
again. Once the slack is positive, **Submit design**.
"""

def _pblocks(rows):
    return [{"id": r[0], "label": _PLABEL.get(r[0], r[0]), "w": 22, "h": 18, "x": r[1], "y": r[2]} for r in rows]

def _pnets(pairs):
    return [{"terminals": [{"block": b} for b in t]} for t in pairs]

PARTITION_SPEC = {
    "id": "partition-mincut",
    "core": {"w": 200, "h": 140}, "regions": 2, "halo": 3,
    "cutTarget": 2, "cutMax": 10, "balanceTol": 0.3,
    "regionNames": ["region 1", "region 2"],
    "blocks": _pblocks([
        ["a0", 20, 20], ["b0", 55, 20], ["a1", 95, 20], ["b1", 135, 20], ["a2", 170, 20],
        ["b2", 20, 95], ["a3", 60, 95], ["b3", 100, 95], ["a4", 140, 95], ["b4", 175, 95],
    ]),
    "nets": _pnets([
        ["a0", "a1"], ["a1", "a2"], ["a0", "a2"], ["a2", "a3"], ["a3", "a4"], ["a1", "a3"],
        ["b0", "b1"], ["b1", "b2"], ["b0", "b2"], ["b2", "b3"], ["b3", "b4"], ["b1", "b3"],
        ["a4", "b0"], ["a0", "b3"],
    ]),
}

PARTITION_PROMPT = """
**Partition** this block for hierarchy: sort the sub-blocks into two regions so
that as few nets as possible are **cut** across the boundary. A cut net has to
be carried between the regions, which costs wiring and timing, so a good
partition keeps tightly-connected logic together. Keep the two regions
**balanced** in area.

The blocks form two tightly-connected groups but start scrambled across the
boundary, so many nets are cut (shown in red).

- **Cut nets at or under target** - drag the tightly-connected blocks into the
  same region. A red net crosses the boundary; group its blocks to uncut it.
- **Regions balanced** - keep the two regions roughly equal in total block
  area; do not dump everything on one side.
- **Legality** - blocks inside the die, not overlapping.

Fewer cuts scores higher. **Submit design** once balanced and under target.
"""

THERMAL_SPEC = {
    "id": "thermal",
    "core": {"w": 200, "h": 160}, "halo": 3, "ambient": 25, "tMax": 85, "sigma": 26, "sampleGrid": 30,
    "blocks": [
        {"id": "h0", "label": "gpu", "w": 24, "h": 20, "x": 80, "y": 66, "power": 45},
        {"id": "h1", "label": "cpu", "w": 24, "h": 20, "x": 108, "y": 66, "power": 45},
        {"id": "c0", "label": "l2$", "w": 24, "h": 20, "x": 15, "y": 15, "power": 12},
        {"id": "c1", "label": "dma", "w": 24, "h": 20, "x": 170, "y": 15, "power": 12},
        {"id": "c2", "label": "sram", "w": 24, "h": 20, "x": 15, "y": 125, "power": 12},
        {"id": "c3", "label": "io", "w": 24, "h": 20, "x": 170, "y": 125, "power": 12},
    ],
    "nets": [
        {"id": "gpu-cpu", "terminals": [{"block": "h0"}, {"block": "h1"}], "critical": True, "budget": 95},
        {"id": "gpu-l2$", "terminals": [{"block": "h0"}, {"block": "c0"}], "critical": True, "budget": 60},
        {"id": "cpu-sram", "terminals": [{"block": "h1"}, {"block": "c2"}], "critical": True, "budget": 60},
        {"id": "gpu-dma", "terminals": [{"block": "h0"}, {"block": "c1"}]},
        {"id": "cpu-io", "terminals": [{"block": "h1"}, {"block": "c3"}]},
    ],
}

THERMAL_PROMPT = """
**Thermal-aware placement.** Each block dissipates power (shown in mW) and heats
the die around it - the **gpu** and **cpu** run hot. The temperature map is the
ambient plus every block's heat, so putting the hot blocks together builds a
**hotspot**. But the bold **critical nets** want connected blocks close for
timing, and the two hot blocks are wired to each other, so you are squeezed.

The blocks start piled together: the centre is over the temperature limit and
the cool blocks are stranded far from what they drive.

- **Peak temperature under limit** - spread the high-power blocks apart to cool
  the hotspot (the red crosshair marks the hottest point).
- **Timing closes** - keep blocks joined by a bold net close enough. The
  gpu-to-cpu net means the two hot blocks can be neither too close (heat) nor
  too far (timing): find the middle distance.
- **Legality** - blocks in bounds, not overlapping.

Drag the blocks, then **Submit design**. More thermal headroom scores higher.
"""

ORIENT_SPEC = {
    "id": "macro-orient",
    "core": {"w": 180, "h": 180}, "parWL": 144,
    "pins": [
        {"id": "w1", "x": 0, "y": 53}, {"id": "w2", "x": 0, "y": 123},
        {"id": "e1", "x": 180, "y": 53}, {"id": "e2", "x": 180, "y": 123},
        {"id": "t", "x": 90, "y": 0}, {"id": "b", "x": 90, "y": 180},
    ],
    "macros": [
        {"id": "m0", "label": "sram0", "w": 26, "h": 26, "x": 25, "y": 40, "edge": "N"},
        {"id": "m1", "label": "sram1", "w": 26, "h": 26, "x": 25, "y": 110, "edge": "N"},
        {"id": "m2", "label": "acc0", "w": 26, "h": 26, "x": 129, "y": 40, "edge": "N"},
        {"id": "m3", "label": "acc1", "w": 26, "h": 26, "x": 129, "y": 110, "edge": "N"},
        {"id": "m4", "label": "pll", "w": 26, "h": 26, "x": 77, "y": 22, "edge": "N"},
        {"id": "m5", "label": "io", "w": 26, "h": 26, "x": 77, "y": 132, "edge": "N"},
    ],
    "nets": [
        {"id": "sram0>W", "terminals": [{"macro": "m0"}, {"pin": "w1"}], "critical": True, "budget": 33},
        {"id": "sram1>W", "terminals": [{"macro": "m1"}, {"pin": "w2"}], "critical": True, "budget": 33},
        {"id": "acc0>E", "terminals": [{"macro": "m2"}, {"pin": "e1"}], "critical": True, "budget": 33},
        {"id": "acc1>E", "terminals": [{"macro": "m3"}, {"pin": "e2"}], "critical": True, "budget": 33},
        {"id": "pll>clk", "terminals": [{"macro": "m4"}, {"pin": "t"}], "critical": True, "budget": 30},
        {"id": "io>pad", "terminals": [{"macro": "m5"}, {"pin": "b"}], "critical": True, "budget": 30},
    ],
}

ORIENT_PROMPT = """
**Orient the macros** so their pins face what they connect to. Each macro keeps
its pins on one edge (the orange bar), and the macros are fixed in place: you
**click a macro to rotate** it, cycling the pin edge N -> E -> S -> W. A pin
facing the wrong way forces the wire to wrap around the macro, which blows the
net's budget.

Every macro starts with its pins facing up (the wrong way for most), so the
nets run long and red.

- **All pins reach their target in budget** - rotate each macro until its orange
  pin bar faces the boundary pin it drives, so the wire runs straight there
  instead of wrapping around.

Click each macro to rotate it, then **Submit design**. Shorter total wire scores
higher.
"""

def _vblocks(rows):
    return [{"id": r[0], "label": r[0], "w": 22, "h": 18, "x": r[1], "y": r[2],
             "domain": "core" if r[0][0] == "c" else "io"} for r in rows]

VDOMAIN_SPEC = {
    "id": "vdomain",
    "core": {"w": 200, "h": 140}, "halo": 3, "crossBudget": 150,
    "domains": [
        {"id": "core", "name": "core 0.8V", "color": "rgb(37,99,235)"},
        {"id": "io", "name": "io 1.2V", "color": "rgb(217,119,6)"},
    ],
    "blocks": _vblocks([
        ["c0", 20, 20], ["i0", 60, 20], ["c1", 100, 20], ["i1", 140, 20],
        ["c2", 20, 85], ["i2", 60, 85], ["c3", 100, 85], ["i3", 140, 85],
    ]),
    "nets": [{"terminals": [{"block": a}, {"block": b}]} for (a, b) in [
        ("c0", "c1"), ("c1", "c2"), ("c2", "c3"), ("c0", "c2"),
        ("i0", "i1"), ("i1", "i2"), ("i2", "i3"), ("i0", "i2"),
        ("c3", "i0"), ("c2", "i1"),
    ]],
}

VDOMAIN_PROMPT = """
Floorplan a **multi-voltage** block. Every block belongs to a fixed **voltage
domain**: the blue **core** runs at 0.8V, the orange **io** at 1.2V. A domain
cannot be scattered - each must occupy its own contiguous region - and the few
nets that cross between domains need a **level shifter**, so they should be
short.

The blocks start interleaved, so the two domains overlap and the cross-domain
wires are long.

- **Domains kept separate** - group each colour into its own region so the two
  dashed domain boxes do not overlap. A power domain has to be one contiguous
  area, not fragmented.
- **Level-shifter nets short** - the red nets cross between domains. Put the
  blocks they connect near the shared boundary so those wires stay short.
- **Legality** - blocks inside the die, not overlapping.

Shorter cross-domain wire scores higher. **Submit design** once the domains are
separated and the crossings are short.
"""

LABS = {
    "macro-placement-1": {
        "id": "macro-placement-1",
        "title": "Manual macro placement",
        "topic": "Floorplanning",
        "topic_slug": "floorplanning",
        "difficulty": "medium",
        "engine": "macroplace",
        "prompt": MANUAL_PROMPT,
        "spec": MANUAL_SPEC,
    },
    "macro-fixed-ip": {
        "id": "macro-fixed-ip",
        "title": "Macro placement around fixed IP",
        "topic": "Floorplanning",
        "topic_slug": "floorplanning",
        "difficulty": "medium",
        "engine": "macroplace",
        "prompt": FIXED_IP_PROMPT,
        "spec": FIXED_IP_SPEC,
    },
    "macro-congestion": {
        "id": "macro-congestion",
        "title": "Congestion relief",
        "topic": "Floorplanning",
        "topic_slug": "floorplanning",
        "difficulty": "medium",
        "engine": "macroplace",
        "prompt": CONG_PROMPT,
        "spec": CONG_SPEC,
    },
    "macro-keepout": {
        "id": "macro-keepout",
        "title": "Placement with a keepout",
        "topic": "Floorplanning",
        "topic_slug": "floorplanning",
        "difficulty": "medium",
        "engine": "macroplace",
        "prompt": KEEP_PROMPT,
        "spec": KEEP_SPEC,
    },
    "macro-fixed-outline": {
        "id": "macro-fixed-outline",
        "title": "Fixed-outline packing",
        "topic": "Floorplanning",
        "topic_slug": "floorplanning",
        "difficulty": "medium",
        "engine": "macroplace",
        "prompt": FO_PROMPT,
        "spec": FO_SPEC,
    },
    "pin-placement": {
        "id": "pin-placement",
        "title": "Pin placement",
        "topic": "Floorplanning",
        "topic_slug": "floorplanning",
        "difficulty": "medium",
        "engine": "macroplace",
        "prompt": PIN_PROMPT,
        "spec": PIN_SPEC,
    },
    "pin-placement-2": {
        "id": "pin-placement-2",
        "title": "SerDes bus and I/O placement",
        "topic": "Floorplanning",
        "topic_slug": "floorplanning",
        "difficulty": "hard",
        "engine": "macroplace",
        "prompt": PIN2_PROMPT,
        "spec": PIN2_SPEC,
    },
    "pdn-ring-mesh": {
        "id": "pdn-ring-mesh",
        "title": "Power ring and mesh sizing",
        "topic": "Floorplanning",
        "topic_slug": "floorplanning",
        "difficulty": "medium",
        "engine": "pdnsize",
        "prompt": PDN_RING_PROMPT,
        "spec": PDN_RING_SPEC,
    },
    "pdn-regions": {
        "id": "pdn-regions",
        "title": "Regional mesh: per-domain IR drop",
        "topic": "Floorplanning",
        "topic_slug": "floorplanning",
        "difficulty": "hard",
        "engine": "pdnregions",
        "prompt": PDN_REGIONS_PROMPT,
        "spec": PDN_REGIONS_SPEC,
    },
    "pdn-rail": {
        "id": "pdn-rail",
        "title": "Standard-cell rail hookup",
        "topic": "Floorplanning",
        "topic_slug": "floorplanning",
        "difficulty": "medium",
        "engine": "pdnparam",
        "prompt": PDN_RAIL_PROMPT,
        "spec": PDN_RAIL_SPEC,
    },
    "pdn-bumps": {
        "id": "pdn-bumps",
        "title": "Power bump placement",
        "topic": "Floorplanning",
        "topic_slug": "floorplanning",
        "difficulty": "medium",
        "engine": "pdncover",
        "prompt": PDN_BUMPS_PROMPT,
        "spec": PDN_BUMPS_SPEC,
    },
    "pdn-static": {
        "id": "pdn-static",
        "title": "Static IR-drop closure",
        "topic": "Floorplanning",
        "topic_slug": "floorplanning",
        "difficulty": "hard",
        "engine": "pdnstack",
        "prompt": PDN_STATIC_PROMPT,
        "spec": PDN_STATIC_SPEC,
    },
    "pdn-decap": {
        "id": "pdn-decap",
        "title": "Decap insertion for dynamic droop",
        "topic": "Floorplanning",
        "topic_slug": "floorplanning",
        "difficulty": "medium",
        "engine": "pdncover",
        "prompt": PDN_DECAP_PROMPT,
        "spec": PDN_DECAP_SPEC,
    },
    "pdn-em": {
        "id": "pdn-em",
        "title": "Electromigration-safe sizing",
        "topic": "Floorplanning",
        "topic_slug": "floorplanning",
        "difficulty": "hard",
        "engine": "pdnparam",
        "prompt": PDN_EM_PROMPT,
        "spec": PDN_EM_SPEC,
    },
    "block-sizing": {
        "id": "block-sizing",
        "title": "Die and utilization sizing",
        "topic": "Floorplanning",
        "topic_slug": "floorplanning",
        "difficulty": "medium",
        "engine": "blocksize",
        "prompt": BLOCK_SIZE_PROMPT,
        "spec": BLOCK_SIZE_SPEC,
    },
    "partition-mincut": {
        "id": "partition-mincut",
        "title": "Min-cut partitioning",
        "topic": "Floorplanning",
        "topic_slug": "floorplanning",
        "difficulty": "medium",
        "engine": "partition",
        "prompt": PARTITION_PROMPT,
        "spec": PARTITION_SPEC,
    },
    "vdomain": {
        "id": "vdomain",
        "title": "Voltage-domain floorplanning",
        "topic": "Floorplanning",
        "topic_slug": "floorplanning",
        "difficulty": "medium",
        "engine": "vdomain",
        "prompt": VDOMAIN_PROMPT,
        "spec": VDOMAIN_SPEC,
    },
    "macro-orient": {
        "id": "macro-orient",
        "title": "Macro orientation and pin access",
        "topic": "Floorplanning",
        "topic_slug": "floorplanning",
        "difficulty": "medium",
        "engine": "orient",
        "prompt": ORIENT_PROMPT,
        "spec": ORIENT_SPEC,
    },
    "thermal": {
        "id": "thermal",
        "title": "Thermal-aware placement",
        "topic": "Floorplanning",
        "topic_slug": "floorplanning",
        "difficulty": "medium",
        "engine": "thermal",
        "prompt": THERMAL_PROMPT,
        "spec": THERMAL_SPEC,
    },
    "place-wl": {
        "id": "place-wl", "title": "Wirelength-driven placement",
        "topic": "Placement", "topic_slug": "placement", "difficulty": "medium",
        "engine": "place", "prompt": PLACE_WL_PROMPT, "spec": PLACE_WL_SPEC,
    },
    "place-timing": {
        "id": "place-timing", "title": "Timing-driven placement",
        "topic": "Placement", "topic_slug": "placement", "difficulty": "medium",
        "engine": "place", "prompt": PLACE_TIMING_PROMPT, "spec": PLACE_TIMING_SPEC,
    },
    "place-cong": {
        "id": "place-cong", "title": "Congestion-driven placement",
        "topic": "Placement", "topic_slug": "placement", "difficulty": "medium",
        "engine": "place", "prompt": PLACE_CONG_PROMPT, "spec": PLACE_CONG_SPEC,
    },
    "place-combo": {
        "id": "place-combo", "title": "Full global placement (all three)",
        "topic": "Placement", "topic_slug": "placement", "difficulty": "hard",
        "engine": "place", "prompt": PLACE_COMBO_PROMPT, "spec": PLACE_COMBO_SPEC,
    },
    "place-region": {
        "id": "place-region", "title": "Region-constrained placement",
        "topic": "Placement", "topic_slug": "placement", "difficulty": "medium",
        "engine": "place", "prompt": PLACE_REGION_PROMPT, "spec": PLACE_REGION_SPEC,
    },
    "place-legalize": {
        "id": "place-legalize", "title": "Row legalization",
        "topic": "Placement", "topic_slug": "placement", "difficulty": "medium",
        "engine": "legalize", "prompt": PLACE_LEGALIZE_PROMPT, "spec": PLACE_LEGALIZE_SPEC,
    },
    "place-swap": {
        "id": "place-swap", "title": "Cell swapping",
        "topic": "Placement", "topic_slug": "placement", "difficulty": "easy",
        "engine": "swap", "prompt": PLACE_SWAP_PROMPT, "spec": PLACE_SWAP_SPEC,
    },
    "place-flip": {
        "id": "place-flip", "title": "Cell flipping (orientation)",
        "topic": "Placement", "topic_slug": "placement", "difficulty": "medium",
        "engine": "flip", "prompt": PLACE_FLIP_PROMPT, "spec": PLACE_FLIP_SPEC,
    },
    "place-pad": {
        "id": "place-pad", "title": "Cell padding for routability",
        "topic": "Placement", "topic_slug": "placement", "difficulty": "medium",
        "engine": "pad", "prompt": PLACE_PAD_PROMPT, "spec": PLACE_PAD_SPEC,
    },
    "place-filler": {
        "id": "place-filler", "title": "Filler and tap-cell insertion",
        "topic": "Placement", "topic_slug": "placement", "difficulty": "easy",
        "engine": "filler", "prompt": PLACE_FILLER_PROMPT, "spec": PLACE_FILLER_SPEC,
    },
    "place-mixed": {
        "id": "place-mixed", "title": "Mixed-size placement",
        "topic": "Placement", "topic_slug": "placement", "difficulty": "medium",
        "engine": "place", "prompt": PLACE_MIXED_PROMPT, "spec": PLACE_MIXED_SPEC,
    },
    "place-regcluster": {
        "id": "place-regcluster", "title": "Register clustering (clock-aware)",
        "topic": "Placement", "topic_slug": "placement", "difficulty": "hard",
        "engine": "place", "prompt": PLACE_REGCLUSTER_PROMPT, "spec": PLACE_REGCLUSTER_SPEC,
    },
    "place-gatesize": {
        "id": "place-gatesize", "title": "Gate sizing to close a setup path",
        "topic": "ECO", "topic_slug": "eco", "difficulty": "hard",
        "engine": "gatesize", "prompt": PLACE_GATESIZE_PROMPT, "spec": PLACE_GATESIZE_SPEC,
    },
    "eco-buffer": {
        "id": "eco-buffer", "title": "Buffer insertion", "topic": "ECO", "topic_slug": "eco",
        "difficulty": "medium", "engine": "ecobuffer", "prompt": ECO_BUFFER_PROMPT, "spec": ECO_BUFFER_SPEC,
    },
    "eco-vtswap": {
        "id": "eco-vtswap", "title": "Threshold-voltage swap", "topic": "ECO", "topic_slug": "eco",
        "difficulty": "medium", "engine": "ecovtswap", "prompt": ECO_VTSWAP_PROMPT, "spec": ECO_VTSWAP_SPEC,
    },
    "eco-pinswap": {
        "id": "eco-pinswap", "title": "Pin swap", "topic": "ECO", "topic_slug": "eco",
        "difficulty": "medium", "engine": "ecopinswap", "prompt": ECO_PINSWAP_PROMPT, "spec": ECO_PINSWAP_SPEC,
    },
    "eco-clone": {
        "id": "eco-clone", "title": "Driver cloning and load split", "topic": "ECO", "topic_slug": "eco",
        "difficulty": "medium", "engine": "ecoclone", "prompt": ECO_CLONE_PROMPT, "spec": ECO_CLONE_SPEC,
    },
    "eco-hold": {
        "id": "eco-hold", "title": "Hold fixing (delay insertion)", "topic": "ECO", "topic_slug": "eco",
        "difficulty": "hard", "engine": "ecohold", "prompt": ECO_HOLD_PROMPT, "spec": ECO_HOLD_SPEC,
    },
    "eco-skew": {
        "id": "eco-skew", "title": "Useful-skew clock ECO", "topic": "ECO", "topic_slug": "eco",
        "difficulty": "hard", "engine": "ecoskew", "prompt": ECO_SKEW_PROMPT, "spec": ECO_SKEW_SPEC,
    },
    "eco-metal": {
        "id": "eco-metal", "title": "Metal-only spare-cell ECO", "topic": "ECO", "topic_slug": "eco",
        "difficulty": "hard", "engine": "ecometal", "prompt": ECO_METAL_PROMPT, "spec": ECO_METAL_SPEC,
    },
    "eco-respin": {
        "id": "eco-respin", "title": "Metal-only vs all-layer decision", "topic": "ECO", "topic_slug": "eco",
        "difficulty": "medium", "engine": "ecorespin", "prompt": ECO_RESPIN_PROMPT, "spec": ECO_RESPIN_SPEC,
    },
    "eco-drv": {
        "id": "eco-drv", "title": "Electrical DRV fix (fanout, cap, transition)", "topic": "ECO", "topic_slug": "eco",
        "difficulty": "medium", "engine": "ecodrv", "prompt": ECO_DRV_PROMPT, "spec": ECO_DRV_SPEC,
    },
    "eco-restruct": {
        "id": "eco-restruct", "title": "Logic restructuring", "topic": "ECO", "topic_slug": "eco",
        "difficulty": "hard", "engine": "ecorestruct", "prompt": ECO_RESTRUCT_PROMPT, "spec": ECO_RESTRUCT_SPEC,
    },
    "eco-legal": {
        "id": "eco-legal", "title": "Placement ECO and legalization", "topic": "ECO", "topic_slug": "eco",
        "difficulty": "medium", "engine": "ecolegal", "prompt": ECO_LEGAL_PROMPT, "spec": ECO_LEGAL_SPEC,
    },
    "synth-twolevel": {
        "id": "synth-twolevel", "title": "Two-level minimization", "topic": "Logic Synthesis", "topic_slug": "logic-synthesis",
        "difficulty": "medium", "engine": "synthtwolevel", "prompt": SYNTH_TWOLEVEL_PROMPT, "spec": SYNTH_TWOLEVEL_SPEC,
    },
    "synth-constprop": {
        "id": "synth-constprop", "title": "Constant propagation and dead-logic sweep", "topic": "Logic Synthesis", "topic_slug": "logic-synthesis",
        "difficulty": "medium", "engine": "synthconstprop", "prompt": SYNTH_CONSTPROP_PROMPT, "spec": SYNTH_CONSTPROP_SPEC,
    },
    "synth-factor": {
        "id": "synth-factor", "title": "Common-subexpression extraction", "topic": "Logic Synthesis", "topic_slug": "logic-synthesis",
        "difficulty": "hard", "engine": "synthfactor", "prompt": SYNTH_FACTOR_PROMPT, "spec": SYNTH_FACTOR_SPEC,
    },
    "synth-map-area": {
        "id": "synth-map-area", "title": "Technology mapping for area", "topic": "Logic Synthesis", "topic_slug": "logic-synthesis",
        "difficulty": "hard", "engine": "synthmaparea", "prompt": SYNTH_MAP_AREA_PROMPT, "spec": SYNTH_MAP_AREA_SPEC,
    },
    "synth-map-delay": {
        "id": "synth-map-delay", "title": "Technology mapping: area vs delay", "topic": "Logic Synthesis", "topic_slug": "logic-synthesis",
        "difficulty": "hard", "engine": "synthmapdelay", "prompt": SYNTH_MAP_DELAY_PROMPT, "spec": SYNTH_MAP_DELAY_SPEC,
    },
    "synth-retime": {
        "id": "synth-retime", "title": "Retiming", "topic": "Logic Synthesis", "topic_slug": "logic-synthesis",
        "difficulty": "hard", "engine": "synthretime", "prompt": SYNTH_RETIME_PROMPT, "spec": SYNTH_RETIME_SPEC,
    },
    "synth-fsm": {
        "id": "synth-fsm", "title": "FSM state encoding", "topic": "Logic Synthesis", "topic_slug": "logic-synthesis",
        "difficulty": "medium", "engine": "synthfsm", "prompt": SYNTH_FSM_PROMPT, "spec": SYNTH_FSM_SPEC,
    },
    "synth-datapath": {
        "id": "synth-datapath", "title": "Datapath operator selection", "topic": "Logic Synthesis", "topic_slug": "logic-synthesis",
        "difficulty": "medium", "engine": "synthdatapath", "prompt": SYNTH_DATAPATH_PROMPT, "spec": SYNTH_DATAPATH_SPEC,
    },
    "cts-source": {
        "id": "cts-source", "title": "Clock source balancing",
        "topic": "Clock Tree Synthesis", "topic_slug": "clock-tree-synthesis", "difficulty": "easy",
        "engine": "clkbalance", "prompt": CTS_SOURCE_PROMPT, "spec": CTS_SOURCE_SPEC,
    },
    "cts-htree": {
        "id": "cts-htree", "title": "H-tree construction",
        "topic": "Clock Tree Synthesis", "topic_slug": "clock-tree-synthesis", "difficulty": "medium",
        "engine": "htree", "prompt": CTS_HTREE_PROMPT, "spec": CTS_HTREE_SPEC,
    },
    "cts-xtree": {
        "id": "cts-xtree", "title": "X-tree construction",
        "topic": "Clock Tree Synthesis", "topic_slug": "clock-tree-synthesis", "difficulty": "medium",
        "engine": "htree", "prompt": CTS_XTREE_PROMPT, "spec": CTS_XTREE_SPEC,
    },
    "cts-cluster": {
        "id": "cts-cluster", "title": "Clustered buffer tree",
        "topic": "Clock Tree Synthesis", "topic_slug": "clock-tree-synthesis", "difficulty": "hard",
        "engine": "clktree", "prompt": CTS_CLUSTER_PROMPT, "spec": CTS_CLUSTER_SPEC,
    },
    "cts-mesh": {
        "id": "cts-mesh", "title": "Clock mesh",
        "topic": "Clock Tree Synthesis", "topic_slug": "clock-tree-synthesis", "difficulty": "medium",
        "engine": "clkmesh", "prompt": CTS_MESH_PROMPT, "spec": CTS_MESH_SPEC,
    },
    "cts-spine": {
        "id": "cts-spine", "title": "Clock spine (fishbone)",
        "topic": "Clock Tree Synthesis", "topic_slug": "clock-tree-synthesis", "difficulty": "medium",
        "engine": "clkspine", "prompt": CTS_SPINE_PROMPT, "spec": CTS_SPINE_SPEC,
    },
    "cts-buffer": {
        "id": "cts-buffer", "title": "Clock buffer insertion",
        "topic": "Clock Tree Synthesis", "topic_slug": "clock-tree-synthesis", "difficulty": "medium",
        "engine": "clkbuf", "prompt": CTS_BUFFER_PROMPT, "spec": CTS_BUFFER_SPEC,
    },
    "cts-skewbal": {
        "id": "cts-skewbal", "title": "Skew balancing (delay matching)",
        "topic": "Clock Tree Synthesis", "topic_slug": "clock-tree-synthesis", "difficulty": "medium",
        "engine": "clkskew", "prompt": CTS_SKEWBAL_PROMPT, "spec": CTS_SKEWBAL_SPEC,
    },
    "cts-depth": {
        "id": "cts-depth", "title": "Buffer-level balancing (OCV)",
        "topic": "Clock Tree Synthesis", "topic_slug": "clock-tree-synthesis", "difficulty": "hard",
        "engine": "clkdepth", "prompt": CTS_DEPTH_PROMPT, "spec": CTS_DEPTH_SPEC,
    },
    "cts-gating": {
        "id": "cts-gating", "title": "Clock gating insertion",
        "topic": "Clock Tree Synthesis", "topic_slug": "clock-tree-synthesis", "difficulty": "medium",
        "engine": "clkgate", "prompt": CTS_GATING_PROMPT, "spec": CTS_GATING_SPEC,
    },
    "cts-banking": {
        "id": "cts-banking", "title": "Multi-bit flip-flop banking",
        "topic": "Clock Tree Synthesis", "topic_slug": "clock-tree-synthesis", "difficulty": "hard",
        "engine": "banking", "prompt": CTS_BANKING_PROMPT, "spec": CTS_BANKING_SPEC,
    },
    "cts-useskew": {
        "id": "cts-useskew", "title": "Useful skew",
        "topic": "Clock Tree Synthesis", "topic_slug": "clock-tree-synthesis", "difficulty": "hard",
        "engine": "useskew", "prompt": CTS_USESKEW_PROMPT, "spec": CTS_USESKEW_SPEC,
    },
    "cts-ndr": {
        "id": "cts-ndr", "title": "Non-default-rule clock routing",
        "topic": "Clock Tree Synthesis", "topic_slug": "clock-tree-synthesis", "difficulty": "medium",
        "engine": "clkndr", "prompt": CTS_NDR_PROMPT, "spec": CTS_NDR_SPEC,
    },
    "route-maze": {
        "id": "route-maze", "title": "Maze routing", "topic": "Routing", "topic_slug": "routing",
        "difficulty": "easy", "engine": "maze", "prompt": ROUTE_MAZE_PROMPT, "spec": ROUTE_MAZE_SPEC,
    },
    "route-global": {
        "id": "route-global", "title": "Global routing and congestion", "topic": "Routing", "topic_slug": "routing",
        "difficulty": "medium", "engine": "groute", "prompt": ROUTE_GLOBAL_PROMPT, "spec": ROUTE_GLOBAL_SPEC,
    },
    "route-ripup": {
        "id": "route-ripup", "title": "Rip-up and reroute", "topic": "Routing", "topic_slug": "routing",
        "difficulty": "hard", "engine": "groute", "prompt": ROUTE_RIPUP_PROMPT, "spec": ROUTE_RIPUP_SPEC,
    },
    "route-layer": {
        "id": "route-layer", "title": "Layer assignment", "topic": "Routing", "topic_slug": "routing",
        "difficulty": "medium", "engine": "layerassign", "prompt": ROUTE_LAYER_PROMPT, "spec": ROUTE_LAYER_SPEC,
    },
    "route-track": {
        "id": "route-track", "title": "Track assignment", "topic": "Routing", "topic_slug": "routing",
        "difficulty": "medium", "engine": "trackassign", "prompt": ROUTE_TRACK_PROMPT, "spec": ROUTE_TRACK_SPEC,
    },
    "route-drc": {
        "id": "route-drc", "title": "Design-rule-clean routing", "topic": "Routing", "topic_slug": "routing",
        "difficulty": "medium", "engine": "drcroute", "prompt": ROUTE_DRC_PROMPT, "spec": ROUTE_DRC_SPEC,
    },
    "route-viamin": {
        "id": "route-viamin", "title": "Via minimization", "topic": "Routing", "topic_slug": "routing",
        "difficulty": "hard", "engine": "viamin", "prompt": ROUTE_VIAMIN_PROMPT, "spec": ROUTE_VIAMIN_SPEC,
    },
    "route-antenna": {
        "id": "route-antenna", "title": "Antenna-rule fixing", "topic": "Routing", "topic_slug": "routing",
        "difficulty": "medium", "engine": "antenna", "prompt": ROUTE_ANTENNA_PROMPT, "spec": ROUTE_ANTENNA_SPEC,
    },
    "route-length": {
        "id": "route-length", "title": "Bus length matching", "topic": "Routing", "topic_slug": "routing",
        "difficulty": "medium", "engine": "lengthmatch", "prompt": ROUTE_LENGTH_PROMPT, "spec": ROUTE_LENGTH_SPEC,
    },
    "route-xtalk": {
        "id": "route-xtalk", "title": "Crosstalk-aware routing", "topic": "Routing", "topic_slug": "routing",
        "difficulty": "hard", "engine": "xtalkroute", "prompt": ROUTE_XTALK_PROMPT, "spec": ROUTE_XTALK_SPEC,
    },
    "route-steiner": {
        "id": "route-steiner", "title": "Multi-pin (Steiner) routing", "topic": "Routing", "topic_slug": "routing",
        "difficulty": "medium", "engine": "steiner", "prompt": ROUTE_STEINER_PROMPT, "spec": ROUTE_STEINER_SPEC,
    },
    "route-pinaccess": {
        "id": "route-pinaccess", "title": "Pin access", "topic": "Routing", "topic_slug": "routing",
        "difficulty": "medium", "engine": "pinaccess", "prompt": ROUTE_PINACCESS_PROMPT, "spec": ROUTE_PINACCESS_SPEC,
    },
    "sta-slack": {
        "id": "sta-slack", "title": "Slack and maximum frequency", "topic": "Static Timing Analysis", "topic_slug": "static-timing-analysis",
        "difficulty": "easy", "engine": "staslack", "prompt": STA_SLACK_PROMPT, "spec": STA_SLACK_SPEC,
    },
    "sta-setuphold": {
        "id": "sta-setuphold", "title": "Setup and hold", "topic": "Static Timing Analysis", "topic_slug": "static-timing-analysis",
        "difficulty": "medium", "engine": "stasetuphold", "prompt": STA_SETUPHOLD_PROMPT, "spec": STA_SETUPHOLD_SPEC,
    },
    "sta-critical": {
        "id": "sta-critical", "title": "Critical path", "topic": "Static Timing Analysis", "topic_slug": "static-timing-analysis",
        "difficulty": "easy", "engine": "stacritical", "prompt": STA_CRITICAL_PROMPT, "spec": STA_CRITICAL_SPEC,
    },
    "sta-uncertainty": {
        "id": "sta-uncertainty", "title": "Clock uncertainty", "topic": "Static Timing Analysis", "topic_slug": "static-timing-analysis",
        "difficulty": "medium", "engine": "staslack", "prompt": STA_UNCERTAINTY_PROMPT, "spec": STA_UNCERTAINTY_SPEC,
    },
    "sta-exceptions": {
        "id": "sta-exceptions", "title": "Timing exceptions", "topic": "Static Timing Analysis", "topic_slug": "static-timing-analysis",
        "difficulty": "hard", "engine": "staexceptions", "prompt": STA_EXCEPTIONS_PROMPT, "spec": STA_EXCEPTIONS_SPEC,
    },
    "sta-corners": {
        "id": "sta-corners", "title": "Multi-corner sign-off", "topic": "Static Timing Analysis", "topic_slug": "static-timing-analysis",
        "difficulty": "medium", "engine": "stacorners", "prompt": STA_CORNERS_PROMPT, "spec": STA_CORNERS_SPEC,
    },
    "sta-ocv": {
        "id": "sta-ocv", "title": "On-chip variation and CPPR", "topic": "Static Timing Analysis", "topic_slug": "static-timing-analysis",
        "difficulty": "hard", "engine": "staocv", "prompt": STA_OCV_PROMPT, "spec": STA_OCV_SPEC,
    },
    "sta-xtalk": {
        "id": "sta-xtalk", "title": "Crosstalk delta-delay", "topic": "Static Timing Analysis", "topic_slug": "static-timing-analysis",
        "difficulty": "hard", "engine": "staxtalk", "prompt": STA_XTALK_PROMPT, "spec": STA_XTALK_SPEC,
    },
    "sta-report": {
        "id": "sta-report", "title": "Reading a timing report", "topic": "Static Timing Analysis", "topic_slug": "static-timing-analysis",
        "difficulty": "easy", "engine": "stareport", "prompt": STA_REPORT_PROMPT, "spec": STA_REPORT_SPEC,
    },
    "sta-io": {
        "id": "sta-io", "title": "Interface (I/O) timing", "topic": "Static Timing Analysis", "topic_slug": "static-timing-analysis",
        "difficulty": "medium", "engine": "iotiming", "prompt": STA_IO_PROMPT, "spec": STA_IO_SPEC,
    },
    "sta-borrow": {
        "id": "sta-borrow", "title": "Time borrowing (latches)", "topic": "Static Timing Analysis", "topic_slug": "static-timing-analysis",
        "difficulty": "hard", "engine": "timeborrow", "prompt": STA_BORROW_PROMPT, "spec": STA_BORROW_SPEC,
    },
    "pv-width-spacing": {
        "id": "pv-width-spacing", "title": "Minimum width and spacing", "topic": "Physical Verification", "topic_slug": "physical-verification",
        "difficulty": "medium", "engine": "pvwidth", "prompt": PV_WIDTH_PROMPT, "spec": PV_WIDTH_SPEC,
    },
    "pv-enclosure": {
        "id": "pv-enclosure", "title": "Via enclosure and minimum area", "topic": "Physical Verification", "topic_slug": "physical-verification",
        "difficulty": "medium", "engine": "pvenclosure", "prompt": PV_ENCLOSURE_PROMPT, "spec": PV_ENCLOSURE_SPEC,
    },
    "pv-spacing-table": {
        "id": "pv-spacing-table", "title": "Width-dependent and end-of-line spacing", "topic": "Physical Verification", "topic_slug": "physical-verification",
        "difficulty": "hard", "engine": "pvspacing", "prompt": PV_SPACING_PROMPT, "spec": PV_SPACING_SPEC,
    },
    "pv-density": {
        "id": "pv-density", "title": "Density and metal fill", "topic": "Physical Verification", "topic_slug": "physical-verification",
        "difficulty": "medium", "engine": "pvdensity", "prompt": PV_DENSITY_PROMPT, "spec": PV_DENSITY_SPEC,
    },
    "pv-lvs-connectivity": {
        "id": "pv-lvs-connectivity", "title": "Shorts and opens", "topic": "Physical Verification", "topic_slug": "physical-verification",
        "difficulty": "hard", "engine": "pvlvs", "prompt": PV_LVS_PROMPT, "spec": PV_LVS_SPEC,
    },
    "pv-device-match": {
        "id": "pv-device-match", "title": "Device matching", "topic": "Physical Verification", "topic_slug": "physical-verification",
        "difficulty": "medium", "engine": "pvdevice", "prompt": PV_DEVICE_PROMPT, "spec": PV_DEVICE_SPEC,
    },
    "pv-erc-ties": {
        "id": "pv-erc-ties", "title": "Floating nodes and tie cells", "topic": "Physical Verification", "topic_slug": "physical-verification",
        "difficulty": "medium", "engine": "pverc", "prompt": PV_ERC_PROMPT, "spec": PV_ERC_SPEC,
    },
    "pv-signoff": {
        "id": "pv-signoff", "title": "Tapeout sign-off gate", "topic": "Physical Verification", "topic_slug": "physical-verification",
        "difficulty": "easy", "engine": "pvsignoff", "prompt": PV_SIGNOFF_PROMPT, "spec": PV_SIGNOFF_SPEC,
    },
    "pv-antenna": {
        "id": "pv-antenna", "title": "Antenna ratio and diodes", "topic": "Physical Verification", "topic_slug": "physical-verification",
        "difficulty": "medium", "engine": "pvantenna", "prompt": PV_ANTENNA_PROMPT, "spec": PV_ANTENNA_SPEC,
    },
    "pv-dfm-vias": {
        "id": "pv-dfm-vias", "title": "Redundant vias (via doubling)", "topic": "Physical Verification", "topic_slug": "physical-verification",
        "difficulty": "easy", "engine": "pvdfm", "prompt": PV_DFM_PROMPT, "spec": PV_DFM_SPEC,
    },
}
