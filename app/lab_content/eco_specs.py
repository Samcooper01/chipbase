"""ECO (Engineering Change Order) lab specs.

Scaffold stubs, one per ECO change type. Each lab owns its engine under
app/static/labs/ and its spec dict here; the interactive model is filled in one
lab at a time. Each stub carries `title` and `todo` so the placeholder page is
informative during review.
"""

ECO_BUFFER_SPEC = {
    'id': 'eco-buffer',
    'title': 'Buffer insertion',
    'todo': 'A long, high-load net misses setup. Insert a buffer to split it so each segment drives '
            'less, sharpening the transition and cutting delay, without over-buffering.'}

ECO_VTSWAP_SPEC = {
    'id': 'eco-vtswap',
    'title': 'Threshold-voltage swap',
    'todo': 'Swap cells on the critical path to a lower-Vt (faster) variant to close setup, spending '
            'the least extra leakage.'}

ECO_PINSWAP_SPEC = {
    'id': 'eco-pinswap',
    'title': 'Pin swap',
    'todo': 'Move the late-arriving signal onto the input pin with the shorter internal delay, '
            'shortening the critical path with no new area.'}

ECO_CLONE_SPEC = {
    'id': 'eco-clone',
    'title': 'Driver cloning and load split',
    'todo': 'A driver with high fanout is slow. Clone it and split the load so each copy drives '
            'fewer sinks.'}

ECO_HOLD_SPEC = {
    'id': 'eco-hold',
    'title': 'Hold fixing (delay insertion)',
    'todo': 'Fast paths violate hold. Insert delay cells to add min-delay until hold is met, without '
            'pushing any path into a setup violation.'}

ECO_SKEW_SPEC = {
    'id': 'eco-skew',
    'title': 'Useful-skew clock ECO',
    'todo': 'Shift a flip-flop clock arrival to move slack between adjacent stages, closing a path '
            'without touching the data path.'}

ECO_METAL_SPEC = {
    'id': 'eco-metal',
    'title': 'Metal-only spare-cell ECO',
    'todo': 'Implement a small logic change by rewiring nearby spare cells, changing only metal and '
            'via layers.'}

ECO_RESPIN_SPEC = {
    'id': 'eco-respin',
    'title': 'Metal-only vs all-layer decision',
    'todo': 'For each proposed change, decide whether it fits the available spare cells (metal-only) '
            'or needs new base layers (an all-layer respin).'}

ECO_DRV_SPEC = {
    'id': 'eco-drv',
    'title': 'Electrical DRV fix (fanout, cap, transition)',
    'todo': 'A high-fanout net violates max fanout, max capacitance, and max transition. Insert '
            'buffers to split the load until every driver meets all three electrical rules.'}

ECO_RESTRUCT_SPEC = {
    'id': 'eco-restruct',
    'title': 'Logic restructuring',
    'todo': 'Close a setup path by reshaping the logic: build a balanced gate tree and keep the '
            'late-arriving signal nearest the output, without changing the function.'}

ECO_LEGAL_SPEC = {
    'id': 'eco-legal',
    'title': 'Placement ECO and legalization',
    'todo': 'ECO-inserted cells land on top of fixed cells. Legalize each into the nearest legal '
            'site-grid gap, no overlap, with the least displacement from its ideal spot.'}
