# Standard-cell library deck: scope

What a physical designer has to know about the library the design is built
from: how cells are named, what the compound gates are, which sequential cells
exist, and what the physical-only cells are for.

Unlike the command decks, this one is not about one tool. It is grounded in the
open libraries shipped with OpenROAD-flow-scripts, so every claim can be
checked against a real library file:

- **Nangate45**, 135 cells: `INV_X1`, `AOI21_X2`, `DFFRS_X1`, `SDFF_X1`,
  `CLKGATE_X1`, `FILLCELL_X8`, `LOGIC0_X1`, `ANTENNA_X1`, `TAPCELL_X1`,
  `FA_X1`, `MUX2_X1`.
- **sky130 high density**, 429 cells: `sky130_fd_sc_hd__inv_1`, `__conb_1`,
  `__diode_2`, `__decap_8`, `__dlygate4sd1_1`, `__ebufn_2`, `__dfrtp_1`.
- **ASAP7**, as its flow configuration names it:
  `BUFx2_ASAP7_75t_R`, `TIEHIx1_ASAP7_75t_R`, `TAPCELL_ASAP7_75t_R`, with the
  threshold-voltage tag chosen by `ASAP7_USE_VT`.

Cards are checked against those files, against the cell-related variables in
each platform's `config.mk`, and against the OpenROAD modules that insert each
kind of physical cell (`tap`, `dpl`, `rsz`, `grt`, `cts`).

## Sections

54 cards in 7 sections.

1. **Naming and drive strength** (8). The three naming schemes above, what the
   suffix means, threshold-voltage flavours, library variants (high density
   against high speed), what a drive step costs, how tall a library's cells are
   in routing tracks, why pin names carry across nothing, and what makes a
   library's cell count.
2. **Combinational cells** (9). Why NAND (not-and) and NOR (not-or) are the
   cheap gates, why the first of those is preferred, why input counts stop at
   about four, what a compound gate such as `AOI21` computes and saves, buffers
   against inverter pairs, multiplexers, adders, and tristate buffers.
3. **Sequential cells** (8). Flip-flop variants with set and reset, scan flops,
   latches, integrated clock gating cells, multi-bit flops, retention flops,
   what a flip-flop costs against a latch, and an enable multiplexer against a
   clock gate.
4. **Clock cells** (5). Clock buffers against ordinary ones, low-power clock
   inverters, delay cells, why clock cells have matched edges, and why trees
   are built from inverters.
5. **Physical-only cells** (10). Well taps and the spacing rule behind them,
   endcaps, filler, decoupling capacitors and how they differ from filler,
   antenna diodes, tie cells, level shifters, and spare cells for a late fix.
6. **Using the library** (4). Threshold-voltage swaps, what upsizing costs
   upstream, the stage ratio that minimises delay, and buffering a long wire
   against sizing its driver.
7. **Views and characterization** (10). The files that make up a library,
   corners, per-pin limits, sites and rows, multi-height cells, excluded cells,
   the characterized range and why limits follow from it, cells that share a
   footprint, and checking a new library's views against each other.

## Out of scope

Macro libraries (memories, analog blocks), input and output cells (the pad
deck covers those), and the details of characterization itself, which belongs
in a Liberty deck if we build one.
