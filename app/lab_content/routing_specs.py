"""Generated Routing lab specs (see the routing lab generators)."""

ROUTE_MAZE_SPEC = {   'id': 'route-maze',
    'cols': 12,
    'rows': 9,
    'blocks': [   [3, 1],
                  [3, 2],
                  [3, 3],
                  [3, 4],
                  [3, 5],
                  [7, 3],
                  [7, 4],
                  [7, 5],
                  [7, 6],
                  [7, 7],
                  [5, 7],
                  [6, 7],
                  [8, 0],
                  [8, 1],
                  [9, 4],
                  [10, 4],
                  [10, 5]],
    'source': [0, 0],
    'target': [11, 8],
    'budget': 21,
    'par': 18,
    'hint': 'Click cells to lay the wire from the source (green) to the target (red), stepping '
            'through free cells only, never through a grey blockage. Reach the target using no '
            'more wire cells than the budget - the shorter and straighter, the better.'}

ROUTE_GLOBAL_SPEC = {   'id': 'route-global',
    'cols': 7,
    'rows': 6,
    'cap': 2,
    'nets': [   {'id': 'n0', 's': [3, 2], 'd': [6, 5]},
                {'id': 'n1', 's': [6, 0], 'd': [0, 3]},
                {'id': 'n2', 's': [6, 3], 'd': [2, 1]},
                {'id': 'n3', 's': [1, 3], 'd': [6, 5]},
                {'id': 'n4', 's': [5, 5], 'd': [3, 0]},
                {'id': 'n5', 's': [3, 5], 'd': [0, 1]}],
    'start': [0, 0, 0, 0, 0, 0],
    'hint': 'Each net is drawn as an L and can bend two ways. Every tile it crosses uses one unit '
            "of that tile's track capacity; a tile turns red when more routes cross it than it can "
            'hold. Click a net to flip its bend, spreading the routes so no tile overflows.'}

ROUTE_RIPUP_SPEC = {   'id': 'route-ripup',
    'cols': 7,
    'rows': 6,
    'cap': 2,
    'nets': [   {'id': 'n0', 's': [0, 2], 'd': [6, 0]},
                {'id': 'n1', 's': [0, 2], 'd': [4, 1]},
                {'id': 'n2', 's': [2, 0], 'd': [5, 3]},
                {'id': 'n3', 's': [1, 2], 'd': [5, 1]},
                {'id': 'n4', 's': [6, 3], 'd': [3, 5]},
                {'id': 'n5', 's': [5, 1], 'd': [1, 3]}],
    'start': [0, 0, 0, 0, 0, 0],
    'hint': 'The initial routing is congested: several tiles are over capacity (red). Rip up and '
            'reroute the offending nets - click a net to flip its bend - until every tile is back '
            'within capacity.'}

ROUTE_LAYER_SPEC = {   'id': 'route-layer',
    'layers': [   {'id': 'M3', 'delay': 1.0, 'cap': 6},
                  {'id': 'M5', 'delay': 0.6, 'cap': 4},
                  {'id': 'M7', 'delay': 0.34, 'cap': 2}],
    'critBudget': 12,
    'nets': [   {'id': 'c0', 'len': 30, 'critical': True},
                {'id': 'c1', 'len': 26, 'critical': True},
                {'id': 'c2', 'len': 20, 'critical': True},
                {'id': 'u0', 'len': 14, 'critical': False},
                {'id': 'u1', 'len': 10, 'critical': False},
                {'id': 'u2', 'len': 8, 'critical': False},
                {'id': 'u3', 'len': 16, 'critical': False},
                {'id': 'u4', 'len': 6, 'critical': False},
                {'id': 'u5', 'len': 12, 'critical': False}],
    'start': [0, 0, 0, 0, 0, 0, 0, 0, 0],
    'hint': 'Each net sits on a metal layer. Upper layers are faster (lower delay per unit length) '
            'but have fewer tracks. A critical net (bold) must meet its delay budget = length '
            "times the layer's delay factor. Click a net to move it up or down a layer: put the "
            'long critical nets on the fast upper layers, fill the lower layers with the rest, and '
            'keep every layer within its track count.'}

ROUTE_TRACK_SPEC = {   'id': 'route-track',
    'axis': 20,
    'tracks': 3,
    'wires': [   {'id': 'w0', 'x0': 0, 'x1': 6},
                 {'id': 'w1', 'x0': 4, 'x1': 10},
                 {'id': 'w2', 'x0': 8, 'x1': 14},
                 {'id': 'w3', 'x0': 12, 'x1': 18},
                 {'id': 'w4', 'x0': 2, 'x1': 5},
                 {'id': 'w5', 'x0': 7, 'x1': 11},
                 {'id': 'w6', 'x0': 13, 'x1': 17},
                 {'id': 'w7', 'x0': 1, 'x1': 3},
                 {'id': 'w8', 'x0': 15, 'x1': 20}],
    'hint': 'Every wire is a fixed horizontal span; two wires on the same track collide if their '
            'spans overlap. Click a wire to move it to another track. Pack all nine wires onto the '
            'three available tracks with no overlaps - it is exactly solvable, so find the '
            'assignment that fits.'}

ROUTE_DRC_SPEC = {   'id': 'route-drc',
    'channel': 64,
    'minSpace': 3,
    'minWidth': 3,
    'blockage': {'x0': 28, 'x1': 34},
    'wires': [   {'id': 'n0', 'x': 6, 'w': 6},
                 {'id': 'n1', 'x': 12, 'w': 4},
                 {'id': 'n2', 'x': 30, 'w': 4},
                 {'id': 'n3', 'x': 37, 'w': 5},
                 {'id': 'n4', 'x': 44, 'w': 4}],
    'hint': 'The wires violate the minimum-spacing rule and one sits on a routing blockage (grey). '
            'Drag each wire sideways so every neighbouring gap is at least the minimum spacing, no '
            'wire overlaps the blockage, and all stay inside the channel.'}

ROUTE_VIAMIN_SPEC = {   'id': 'route-viamin',
    'cols': 13,
    'rows': 9,
    'blocks': [   [4, 0],
                  [4, 1],
                  [4, 2],
                  [4, 3],
                  [4, 4],
                  [4, 5],
                  [8, 3],
                  [8, 4],
                  [8, 5],
                  [8, 6],
                  [8, 7],
                  [8, 8]],
    'source': [0, 1],
    'target': [12, 7],
    'viaBudget': 5,
    'par': 4,
    'hint': 'Route the wire from S to T. Horizontal runs are on one layer and vertical runs on '
            'another, so every turn is a via (a layer change). Reach the target with no more vias '
            'than the budget - prefer long straight runs over a wiggly shortest path, even if it '
            'means a few more cells.'}

ROUTE_ANTENNA_SPEC = {   'id': 'route-antenna',
    'layers': ['M1', 'M2', 'M3'],
    'lengthLimit': 12,
    'jumpBudget': 2,
    'areaBudget': 12,
    'nets': [   {'id': 'a0', 'layer': 0, 'length': 30, 'diodeArea': 8},
                {'id': 'a1', 'layer': 1, 'length': 26, 'diodeArea': 6},
                {'id': 'a2', 'layer': 2, 'length': 24, 'diodeArea': 5},
                {'id': 'a3', 'layer': 0, 'length': 22, 'diodeArea': 4},
                {'id': 'a4', 'layer': 2, 'length': 20, 'diodeArea': 3},
                {'id': 'n5', 'layer': 1, 'length': 8, 'diodeArea': 5}],
    'hint': "Each net's antenna is the metal connected to its gate, drawn at the layer it runs on. "
            'It is over the limit (red) when the metal is too long. A layer jump breaks the '
            'antenna by carrying the far metal up to the next layer, so it only works if there is '
            'a layer above - a net already on the top layer (M3) has nowhere to jump and can only '
            'use a diode, which drains the charge at the gate but costs area. Jumps use limited '
            'upper-layer slots. Fix every net, jump the lower-layer nets whose diode would cost '
            'the most, and diode the rest.'}

ROUTE_LENGTH_SPEC = {   'id': 'route-length',
    'step': 2,
    'tol': 4,
    'maxDetour': 8,
    'bits': [   {'id': 'b0', 'base': 40},
                {'id': 'b1', 'base': 34},
                {'id': 'b2', 'base': 30},
                {'id': 'b3', 'base': 38},
                {'id': 'b4', 'base': 28},
                {'id': 'b5', 'base': 36}],
    'hint': 'Every bit of a bus should arrive together. Each bit has a base route length; click a '
            'bit to add a serpentine detour (in steps) that lengthens it. Bring the spread between '
            'the longest and shortest bit within the skew tolerance, adding as little extra wire '
            'as you can - lengthen the short bits up toward the longest.'}

ROUTE_XTALK_SPEC = {   'id': 'route-xtalk',
    'limit': 0.6,
    'trackBudget': 6,
    'factors': [1.0, 0.5, 0.2],
    'tracks': [0, 1, 2],
    'labels': ['default', '+spacing', 'shield'],
    'nets': [   {'id': 'v0', 'coupling': 2.4},
                {'id': 'v1', 'coupling': 1.0},
                {'id': 'v2', 'coupling': 0.5},
                {'id': 'v3', 'coupling': 2.2},
                {'id': 'v4', 'coupling': 0.9},
                {'id': 'v5', 'coupling': 0.4}],
    'hint': 'Each victim net picks up crosstalk from the aggressors beside it. Click a net to '
            'cycle its routing: default, extra spacing (halves the coupling, +1 track), or a '
            "grounded shield (cuts it to a fifth, +2 tracks). Get every net's crosstalk under the "
            'limit while the total extra tracks stay within budget - so spend shields only where '
            'spacing is not enough.'}


ROUTE_STEINER_SPEC = {   'id': 'route-steiner',
    'grid': {'w': 18, 'h': 15},
    'root': {'x': 4, 'y': 7},
    'pins': [   {'x': 15, 'y': 2},
                {'x': 16, 'y': 7},
                {'x': 14, 'y': 12},
                {'x': 10, 'y': 3},
                {'x': 11, 'y': 11},
                {'x': 8, 'y': 13},
                {'x': 2, 'y': 13}],
    'start': [0, 0, 0, 0, 0, 1, 1],
    'wlTarget': 47,
    'par': 42,
    'hint': 'This is ONE net with several pins. Each pin reaches the root by an L that can bend '
            "two ways. Where two pins' wires run along the same track, the metal is shared and "
            'counted once - that shared trunk is what makes a Steiner tree short. Click a pin to '
            'flip its bend so the routes funnel onto common trunks, shrinking the total (union) '
            'wire under target.'}

ROUTE_PINACCESS_SPEC = {   'id': 'route-pinaccess',
    'tracks': 6,
    'pins': [   {'id': 'p0', 'candidates': [0, 1]},
                {'id': 'p1', 'candidates': [0, 1, 2]},
                {'id': 'p2', 'candidates': [1, 2]},
                {'id': 'p3', 'candidates': [3, 4]},
                {'id': 'p4', 'candidates': [3, 4, 5]},
                {'id': 'p5', 'candidates': [4, 5]}],
    'hint': 'Each standard-cell pin can be reached (a via dropped onto it) from only a few routing '
            'tracks - its candidate access points. Two pins that grab the same track collide, so '
            'the router cannot access both. Click a pin to move its access point to another of its '
            'tracks, so every pin lands on its own track.'}
