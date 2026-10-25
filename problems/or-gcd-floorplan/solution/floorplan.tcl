# Reference solution: the canonical three-step floorplan recipe.

initialize_floorplan -utilization 62 \
                     -aspect_ratio 1.0 \
                     -core_space 2 \
                     -site unithd

make_tracks

place_pins -hor_layers met3 -ver_layers met2
