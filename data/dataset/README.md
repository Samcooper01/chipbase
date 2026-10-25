# Chipbase OpenROAD runs

62 complete runs of the open physical design flow, OpenROAD-flow-scripts, in
the openroad/orfs container (OpenROAD 26Q3). They are the runs behind the
"Your move" and "Read the die" drills on the Chipbase site, published so that
anybody can check a number or use the runs for something else.

## What is in the archive

- `runs.json` and `runs.csv`: one row per run. Design, platform, every setting
  changed from the flow's defaults, and the measured results.
- `whatif-src/` and `pathology-src/`: for each run, the full log
  (`<run>.log`) and the reports the flow wrote (`<run>/*.rpt`), plus the
  rendered maps for the pathology runs.
- `run*.sh` and `run_pathology.sh`: the scripts that launched the runs, one
  container per group.
- `thin_grid.tcl`, `thin_grid_gcd.tcl`, `dense_grid.tcl`: the modified power
  grids some runs used. Each is the platform's or the design's own file with
  strap widths or pitches changed, and says what changed at the top.
  `gcd_grid_original.tcl` is the unmodified file, for comparison.
- `dataset.py`: the code that read every number out of the logs and built
  this archive, so any value can be checked by running it again.

## How the numbers were read

Every value comes from the line of the log or the final report that printed
it. Nothing is typed from memory, and a value a run never printed is left
empty rather than set to zero.

- **Wire** is the detailed router's routed length, printed last. Global
  routing prints an estimate earlier that can differ by more than a quarter.
- **Smallest period** is `period_min` for the real clock. The virtual clock
  the constraints create also reports one, always zero, and is excluded.
- **Worst setup slack** is `report_worst_slack`, because `report_wns` clamps
  at zero and hides the margin of a design that passes.
- **Worst drop** is reported for both the supply and the ground net. The map
  the flow saves is drawn on the ground net.
- **Congestion reports** counts two messages: global routing running extra
  iterations to clear congestion, and the placer failing its routability
  target.
- **Time** is in picoseconds on ASAP7 and nanoseconds elsewhere.

## Two properties worth knowing

The flow is deterministic here. Two independent runs of ibex, in different
containers on different days, agreed on every published metric to the last
digit, so a small difference between two runs is a real difference.

Most runs change one setting against a baseline of the same design with no
changes, which makes the set usable for sensitivity studies: the effect of
one knob, with everything else held.

## What is not in it

Runtime. Runs were executed in parallel on one machine, so wall-clock time
would measure the scheduler rather than the run.

Every launched run finished and is included.
