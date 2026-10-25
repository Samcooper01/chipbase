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

A7=./designs/asap7/gcd/config.mk
SKY=./designs/sky130hd/gcd/config.mk
N45=./designs/nangate45/gcd/config.mk
IBEX=./designs/nangate45/ibex/config.mk
ROCKET=./designs/nangate45/tinyRocket/config.mk

case "$1" in
a7)   # the ASAP7 block that misses by 42.82 picoseconds on a 310 picosecond clock
  run a7_base  $A7 asap7 gcd
  run a7_relax $A7 asap7 gcd SDC_FILE=$(sdc a7_relax asap7 gcd 340)
  run a7_room  $A7 asap7 gcd CORE_UTILIZATION=45
  run a7_gasp  $A7 asap7 gcd SKIP_LAST_GASP=0
  ;;
sky)  # the Skywater block that asked for 38 percent and finished at 92
  run sky_base $SKY sky130hd gcd
  run sky_u25  $SKY sky130hd gcd CORE_UTILIZATION=25
  run sky_u18  $SKY sky130hd gcd CORE_UTILIZATION=18
  ;;
n45)  # what actually makes a block smaller
  run n45_base $N45 nangate45 gcd
  run n45_abc0 $N45 nangate45 gcd ABC_AREA=0
  run n45_u70  $N45 nangate45 gcd CORE_UTILIZATION=70
  run n45_tns1 $N45 nangate45 gcd TNS_END_PERCENT=1
  ;;
ibexclk)  # how much faster a closed block can actually be pushed
  run ibex_base $IBEX nangate45 ibex
  run ibex_20   $IBEX nangate45 ibex SDC_FILE=$(sdc ibex_20 nangate45 ibex 2.0)
  run ibex_18   $IBEX nangate45 ibex SDC_FILE=$(sdc ibex_18 nangate45 ibex 1.8)
  ;;
ibexres)  # routing layers and the power grid on a real core
  # the clock layer range has to move down with the signal range: the tool
  # will not accept a clock range of one layer
  run ibex_m4    $IBEX nangate45 ibex MAX_ROUTING_LAYER=metal4 MIN_CLK_ROUTING_LAYER=metal3
  run ibex_m4_sp $IBEX nangate45 ibex MAX_ROUTING_LAYER=metal4 MIN_CLK_ROUTING_LAYER=metal3 CORE_UTILIZATION=35
  run ibex_thin  $IBEX nangate45 ibex PDN_TCL=/out/thin_grid.tcl
  ;;
rocket)   # what the macro keep-out is worth
  run rk_half $ROCKET nangate45 tinyRocket MACRO_PLACE_HALO="11.2 7.56"
  run rk_min  $ROCKET nangate45 tinyRocket MACRO_PLACE_HALO="2.0 2.0"
  ;;
t1)       # the four levers on a gcd block asked for 0.40 instead of 0.46
  run t1_asis   $N45 nangate45 gcd SDC_FILE=$(sdc t1_asis nangate45 gcd 0.40)
  run t1_room   $N45 nangate45 gcd SDC_FILE=$(sdc t1_room nangate45 gcd 0.40) CORE_UTILIZATION=40
  run t1_io     $N45 nangate45 gcd SDC_FILE=$(sdc t1_io nangate45 gcd 0.40 0.1)
  run t1_spread $N45 nangate45 gcd SDC_FILE=$(sdc t1_spread nangate45 gcd 0.40) PLACE_DENSITY_LB_ADDON=0.30
  ;;
t2)       # the same block held to the lowest layers
  run t2_m3    $N45 nangate45 gcd MAX_ROUTING_LAYER=metal3 MIN_CLK_ROUTING_LAYER=metal2
  run t2_m3_sp $N45 nangate45 gcd MAX_ROUTING_LAYER=metal3 MIN_CLK_ROUTING_LAYER=metal2 CORE_UTILIZATION=35
  run t2_m5    $N45 nangate45 gcd MAX_ROUTING_LAYER=metal5
  ;;
t3)       # the thinned supply grid, and what brings the drop back
  run t3_thin $N45 nangate45 gcd PDN_TCL=/out/thin_grid_gcd.tcl
  run t3_slow $N45 nangate45 gcd PDN_TCL=/out/thin_grid_gcd.tcl SDC_FILE=$(sdc t3_slow nangate45 gcd 0.92)
  run t3_sp   $N45 nangate45 gcd PDN_TCL=/out/thin_grid_gcd.tcl CORE_UTILIZATION=35
  ;;
jpeg)     # the large design the power caveat names, on the grid the platform ships
  run jpeg_base ./designs/nangate45/jpeg/config.mk nangate45 jpeg
  ;;
esac
echo "GROUP $1 DONE"
