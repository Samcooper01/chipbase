# Floorplan recipe for gcd on sky130hd - runs inside a real OpenROAD
# session; technology data and the synthesized netlist are already loaded.
#
# TODO:
#   1. Fix the utilization (as given, the core is almost all empty space).
#   2. Create the routing tracks.
#   3. Place the block pins on the agreed layers (met3 horizontal,
#      met2 vertical).

initialize_floorplan -utilization 20 \
                     -aspect_ratio 1.0 \
                     -core_space 2 \
                     -site unithd
