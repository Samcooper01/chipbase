#!/bin/bash
# Run the alternatives for the "Your move" drill. One group per container, so
# the runs cannot share a flow directory and cannot contaminate each other.
# Runtime is deliberately not collected: the groups run in parallel, so any
# wall-clock number here would measure the machine, not the decision.
source /OpenROAD-flow-scripts/env.sh >/dev/null 2>&1
cd /OpenROAD-flow-scripts/flow
OUT=/out; mkdir -p $OUT/sdc

sdc () {    # sdc <name> <platform> <design-dir> <period> [io_pct]
  local out=$OUT/sdc/$1.sdc
  sed -e "s/^set clk_period .*/set clk_period $4/" \
      -e "${5:+s/^set clk_io_pct .*/set clk_io_pct $5/}" \
      designs/$2/$3/constraint.sdc > $out
  echo $out
}

run () {    # run <label> <config> <platform> <results-dir-name> [overrides...]
  local label=$1 cfg=$2 plat=$3 dsg=$4; shift 4
  echo "=== $label : $* ==="
  timeout 14400 make DESIGN_CONFIG=$cfg FLOW_VARIANT=$label "$@" > $OUT/$label.log 2>&1
  echo "$label rc=$?"
  mkdir -p $OUT/$label
  cp reports/$plat/$dsg/$label/*.rpt $OUT/$label/ 2>/dev/null
  chmod -R a+rw $OUT 2>/dev/null
}

JPEG=./designs/nangate45/jpeg/config.mk

case "$1" in
jpeg2)    # the large design whose supply actually sags
  run jpeg_grid $JPEG nangate45 jpeg PDN_TCL=/out/dense_grid.tcl
  run jpeg_slow $JPEG nangate45 jpeg SDC_FILE=$(sdc jpeg_slow nangate45 jpeg 2.0)
  run jpeg_room $JPEG nangate45 jpeg CORE_UTILIZATION=40
  ;;
esac
echo "GROUP $1 DONE"
