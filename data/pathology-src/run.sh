#!/bin/bash
# Regenerate heat maps for the perception drill, keeping the images this time.
source /OpenROAD-flow-scripts/env.sh >/dev/null 2>&1
cd /OpenROAD-flow-scripts/flow
OUT=/out; mkdir -p $OUT

run () {   # run <label> <config> <platform> <design> [overrides...]
  local label=$1 cfg=$2 plat=$3 dsg=$4; shift 4
  echo "=== $label ==="
  timeout 7200 make DESIGN_CONFIG=$cfg FLOW_VARIANT=$label "$@" > $OUT/$label.log 2>&1
  echo "$label rc=$?"
  local r=reports/$plat/$dsg/$label
  if [ -d "$r" ]; then
    mkdir -p $OUT/$label
    cp $r/*.webp $OUT/$label/ 2>/dev/null
    cp $r/*.rpt $OUT/$label/ 2>/dev/null
  fi
  grep -hE "IFP-0105|Design area|Total wire length =|Percentage drop|Total power  |CTS-0018|CTS-0028|period_min" \
    $OUT/$label.log reports/$plat/$dsg/$label/6_finish.rpt 2>/dev/null | sort -u > $OUT/$label.numbers.txt
}

run sky_gcd   ./designs/sky130hd/gcd/config.mk      sky130hd  gcd
run a7_gcd    ./designs/asap7/gcd/config.mk         asap7     gcd
run n45_rocket ./designs/nangate45/tinyRocket/config.mk nangate45 tinyRocket
run n45_ibex  ./designs/nangate45/ibex/config.mk    nangate45 ibex
chmod -R a+rw $OUT 2>/dev/null
echo ALLDONE
