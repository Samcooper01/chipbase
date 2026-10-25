"""Physical Verification lab specs.

These are SCAFFOLD stubs. Each lab has its own engine file under
app/static/labs/ and its own spec dict here. The interactive model for each is
filled in later (one lab per subagent), so keep each spec self-contained: a
subagent building a lab edits only its engine file and its own spec dict below.

Each stub carries `title` and `todo` so the placeholder page is informative
during review; the real model fields (geometry, rules, netlists, ...) are added
when the lab is built.
"""

PV_WIDTH_SPEC = {
    'id': 'pv-width-spacing',
    'title': 'Minimum width and spacing',
    'todo': 'Click the shapes that violate minimum width or minimum spacing. Some tight gaps are '
            'still legal - check against the rule values (W_min, S_min), not by eye.',
    'hint': 'Placeholder. The minimum-width / minimum-spacing DRC (Design Rule Check) model is not '
            'built yet.'}

PV_ENCLOSURE_SPEC = {
    'id': 'pv-enclosure',
    'title': 'Via enclosure and minimum area',
    'todo': 'Find the vias not fully enclosed by metal on both layers and the shapes below the '
            'minimum-area rule.',
    'hint': 'Placeholder. The via-enclosure / minimum-area DRC (Design Rule Check) model is not '
            'built yet.'}

PV_SPACING_SPEC = {
    'id': 'pv-spacing-table',
    'title': 'Width-dependent and end-of-line spacing',
    'todo': 'Wide wires need more spacing and a wire end needs more clearance than its side. Triage '
            'each spacing against the width-keyed spacing table and the EOL (End of Line) rule.',
    'hint': 'Placeholder. The width-dependent / EOL (End of Line) spacing model is not built yet.'}

PV_DENSITY_SPEC = {
    'id': 'pv-density',
    'title': 'Density and metal fill',
    'todo': 'Add metal fill so every density window lands within the [min, max] band for CMP '
            '(Chemical Mechanical Polishing) planarity, without pushing any window over the ceiling.',
    'hint': 'Placeholder. The density / metal-fill model is not built yet.'}

PV_LVS_SPEC = {
    'id': 'pv-lvs-connectivity',
    'title': 'Shorts and opens',
    'todo': 'Compare the layout connectivity to the schematic and find the defect: a short (two nets '
            'merged) or an open (one net broken in two). Click the offending shape.',
    'hint': 'Placeholder. The LVS (Layout Versus Schematic) connectivity model is not built yet.'}

PV_DEVICE_SPEC = {
    'id': 'pv-device-match',
    'title': 'Device matching',
    'todo': 'Find the device that does not match the schematic: wrong width/length (W/L), wrong '
            'type, or a missing / extra device.',
    'hint': 'Placeholder. The LVS (Layout Versus Schematic) device-matching model is not built yet.'}

PV_ERC_SPEC = {
    'id': 'pv-erc-ties',
    'title': 'Floating nodes and tie cells',
    'todo': 'Find gate inputs left floating and insert tie-high / tie-low cells where the ERC '
            '(Electrical Rule Check) requires them.',
    'hint': 'Placeholder. The ERC (Electrical Rule Check) tie-cell model is not built yet.'}

PV_SIGNOFF_SPEC = {
    'id': 'pv-signoff',
    'title': 'Tapeout sign-off gate',
    'todo': 'The go / no-go gate: mark the design tapeout-ready only when DRC (Design Rule Check), '
            'LVS (Layout Versus Schematic), antenna, and density all pass.',
    'hint': 'Placeholder. The tapeout sign-off gate model is not built yet.'}

PV_ANTENNA_SPEC = {
    'id': 'pv-antenna',
    'title': 'Antenna ratio and diodes',
    'todo': 'Read each net antenna ratio against the limit; layer-jump where that clears it, add a '
            'protection diode only where jumping cannot.'}

PV_DFM_SPEC = {
    'id': 'pv-dfm-vias',
    'title': 'Redundant vias (via doubling)',
    'todo': 'Double every via that has room for a redundant cut; leave boxed-in vias single so no '
            'spacing rule breaks.'}
