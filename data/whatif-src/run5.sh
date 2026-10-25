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

N45=./designs/nangate45/gcd/config.mk
A7=./designs/asap7/gcd/config.mk
SKY=./designs/sky130hd/gcd/config.mk
IBEX=./designs/nangate45/ibex/config.mk

case "$1" in
g1)  # what a sign-off margin costs
  run m_hold05 $N45 nangate45 gcd HOLD_SLACK_MARGIN=0.05
  run m_hold10 $N45 nangate45 gcd HOLD_SLACK_MARGIN=0.10
  run m_setup05 $N45 nangate45 gcd SETUP_SLACK_MARGIN=0.05
  ;;
g2)  # the two passes global placement runs on your behalf
  run pl_notd    $N45 nangate45 gcd GPL_TIMING_DRIVEN=0
  run pl_nord    $N45 nangate45 gcd GPL_ROUTABILITY_DRIVEN=0
  run pl_neither $N45 nangate45 gcd GPL_TIMING_DRIVEN=0 GPL_ROUTABILITY_DRIVEN=0
  ;;
g3)  # the shape of the die
  run fp_ar2  $N45 nangate45 gcd CORE_ASPECT_RATIO=2.0
  run fp_ar05 $N45 nangate45 gcd CORE_ASPECT_RATIO=0.5
  ;;
g4)  # giving up the lowest routing layer
  run rt_min3 $N45 nangate45 gcd MIN_ROUTING_LAYER=metal3
  run rt_min4 $N45 nangate45 gcd MIN_ROUTING_LAYER=metal4 MIN_CLK_ROUTING_LAYER=metal5
  ;;
g5)  # the arithmetic mapping the design turned off
  run sy_adder     $N45 nangate45 gcd ADDER_MAP_FILE=./platforms/nangate45/cells_adders.v
  run sy_adder_spd $N45 nangate45 gcd ADDER_MAP_FILE=./platforms/nangate45/cells_adders.v ABC_AREA=0
  ;;
g6)  # density on a real core
  run ibex_u35 $IBEX nangate45 ibex CORE_UTILIZATION=35
  run ibex_u65 $IBEX nangate45 ibex CORE_UTILIZATION=65
  ;;
g7)  # asking the Skywater block for something it can reach
  run sky_p26 $SKY sky130hd gcd SDC_FILE=$(sdc sky_p26 sky130hd gcd 2.6)
  run sky_p30 $SKY sky130hd gcd SDC_FILE=$(sdc sky_p30 sky130hd gcd 3.0)
  ;;
g8)  # two knobs on the clock tree
  run ct_bufdist $N45 nangate45 gcd CTS_BUF_DISTANCE=1
  run ct_cluster $N45 nangate45 gcd CTS_CLUSTER_SIZE=50
  ;;
g9)  # the interface budget on the block that is now limited by it
  run a7_io10 $A7 asap7 gcd SDC_FILE=$(sdc a7_io10 asap7 gcd 340 0.1)
  run a7_io05 $A7 asap7 gcd SDC_FILE=$(sdc a7_io05 asap7 gcd 340 0.05)
  ;;
g10) # the repair transforms, on the block that is being pushed
  run rp_noclone $N45 nangate45 gcd SDC_FILE=$(sdc rp_noclone nangate45 gcd 0.40) SKIP_GATE_CLONING=1
  run rp_noswap  $N45 nangate45 gcd SDC_FILE=$(sdc rp_noswap nangate45 gcd 0.40) SKIP_PIN_SWAP=1
  ;;
esac
echo "GROUP $1 DONE"
