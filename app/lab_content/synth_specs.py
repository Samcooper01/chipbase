"""Lab specs for the Logic Synthesis topic.

Each spec is the small piece of per-lab data the engine reads at mount time.
During scaffolding these carry only id/title/todo; engines are filled in one at
a time.
"""

SYNTH_TWOLEVEL_SPEC = {
    'id': 'synth-twolevel',
    'title': 'Two-level minimization',
    'todo': 'Cover every 1 of a Boolean function with the fewest prime implicants, taking the '
            'essential ones first, to reach the minimal sum-of-products form.'}

SYNTH_CONSTPROP_SPEC = {
    'id': 'synth-constprop',
    'title': 'Constant propagation and dead-logic sweep',
    'todo': 'Tie inputs to constants, propagate the constants through the network, and remove the '
            'gates that became constant or unused.'}

SYNTH_FACTOR_SPEC = {
    'id': 'synth-factor',
    'title': 'Common-subexpression extraction',
    'todo': 'Factor a shared subexpression so it is built once and reused, cutting the total gate '
            'and literal count without changing the function.'}

SYNTH_MAP_AREA_SPEC = {
    'id': 'synth-map-area',
    'title': 'Technology mapping for area',
    'todo': 'Cover a decomposed NAND/inverter subject graph with library cells so every node is '
            'covered at the least total cell area.'}

SYNTH_MAP_DELAY_SPEC = {
    'id': 'synth-map-delay',
    'title': 'Technology mapping: area vs delay',
    'todo': 'Cover the same subject graph under a delay cost, spending area on the critical path so '
            'the output arrival meets the target.'}

SYNTH_RETIME_SPEC = {
    'id': 'synth-retime',
    'title': 'Retiming',
    'todo': 'Relocate flip-flops across combinational logic to balance the pipeline stages and '
            'minimize the clock period, without changing behavior.'}

SYNTH_FSM_SPEC = {
    'id': 'synth-fsm',
    'title': 'FSM state encoding',
    'todo': 'Assign codes to the states of a finite-state machine so that related states are close, '
            'minimizing the next-state logic.'}

SYNTH_DATAPATH_SPEC = {
    'id': 'synth-datapath',
    'title': 'Datapath operator selection',
    'todo': 'Pick an adder architecture (ripple-carry, carry-select, carry-lookahead) that meets the '
            'delay target at the least area.'}
