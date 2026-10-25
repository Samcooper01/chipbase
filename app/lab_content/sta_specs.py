"""Generated Static Timing Analysis lab specs (see the STA lab generators)."""

STA_SLACK_SPEC = {   'id': 'sta-slack',
    'tcq': 0.3,
    'tsetup': 0.2,
    'stages': [   {'n': 'g0', 'd': 0.5},
                  {'n': 'g1', 'd': 0.4},
                  {'n': 'g2', 'd': 0.6},
                  {'n': 'g3', 'd': 0.35},
                  {'n': 'g4', 'd': 0.25}],
    'periodMin': 2.4,
    'periodMax': 5.0,
    'periodStep': 0.05,
    'periodStart': 4.5,
    'marginBand': 0.12,
    'hint': 'Data leaves the launch flip-flop after clock-to-Q, runs through the logic, and must '
            'arrive before the capture edge with setup margin. Setup slack = required (period '
            'minus setup) minus arrival. Drag the clock period down: as it shrinks, the capture '
            'edge moves left and slack falls. Find the smallest period that still has slack >= 0 - '
            'that is the maximum frequency.'}

STA_SETUPHOLD_SPEC = {   'id': 'sta-setuphold',
    'tcq': 0.3,
    'tsetup': 0.2,
    'thold': 0.55,
    'period': 2.5,
    'dMin': 0.0,
    'dMax': 2.4,
    'dStep': 0.05,
    'dStart': 2.3,
    'hint': 'A flip-flop needs data both LATE enough (hold) and EARLY enough (setup). Hold: data '
            'must not arrive until thold after the launch edge, so the path cannot be too fast. '
            'Setup: data must arrive before the next capture edge minus setup, so it cannot be too '
            'slow. Drag the data-path delay into the window where both hold slack and setup slack '
            'are non-negative.'}

STA_CRITICAL_SPEC = {   'id': 'sta-critical',
    'tcq': 0.3,
    'tsetup': 0.2,
    'period': 3.9,
    'nodes': [   {'id': 'FF_A', 'type': 'ff', 'x': 30, 'y': 120},
                 {'id': 'g0', 'type': 'gate', 'd': 0.6, 'x': 110, 'y': 120},
                 {'id': 'a1', 'type': 'gate', 'd': 1.5, 'x': 205, 'y': 50},
                 {'id': 'a2', 'type': 'gate', 'd': 0.9, 'x': 300, 'y': 50},
                 {'id': 'a3', 'type': 'gate', 'd': 0.5, 'x': 395, 'y': 50},
                 {'id': 'b1', 'type': 'gate', 'd': 0.9, 'x': 205, 'y': 120},
                 {'id': 'b2', 'type': 'gate', 'd': 0.9, 'x': 300, 'y': 120},
                 {'id': 'b3', 'type': 'gate', 'd': 0.9, 'x': 395, 'y': 120},
                 {'id': 'c1', 'type': 'gate', 'd': 1.2, 'x': 205, 'y': 190},
                 {'id': 'c2', 'type': 'gate', 'd': 0.6, 'x': 300, 'y': 190},
                 {'id': 'c3', 'type': 'gate', 'd': 0.8, 'x': 395, 'y': 190},
                 {'id': 'FF_Z', 'type': 'ff', 'x': 480, 'y': 120}],
    'edges': [   ['FF_A', 'g0'],
                 ['g0', 'a1'],
                 ['a1', 'a2'],
                 ['a2', 'a3'],
                 ['a3', 'FF_Z'],
                 ['g0', 'b1'],
                 ['b1', 'b2'],
                 ['b2', 'b3'],
                 ['b3', 'FF_Z'],
                 ['g0', 'c1'],
                 ['c1', 'c2'],
                 ['c2', 'c3'],
                 ['c3', 'FF_Z']],
    'sources': ['FF_A'],
    'sinks': ['FF_Z'],
    'hint': 'Every path runs from FF_A through the same number of gates, so you cannot spot the '
            'critical one by counting - you have to ADD UP the gate delays. Click FF_A, then '
            'follow the gates of one path to FF_Z; the running delay sums as you go. Trace each '
            'path, then submit the one with the largest delay (the least slack) - that is the '
            'critical path.'}

STA_UNCERTAINTY_SPEC = {   'id': 'sta-uncertainty',
    'tcq': 0.3,
    'tsetup': 0.2,
    'uncertainty': 0.35,
    'stages': [   {'n': 'g0', 'd': 0.5},
                  {'n': 'g1', 'd': 0.4},
                  {'n': 'g2', 'd': 0.6},
                  {'n': 'g3', 'd': 0.4}],
    'periodMin': 2.2,
    'periodMax': 5.0,
    'periodStep': 0.05,
    'periodStart': 4.5,
    'marginBand': 0.12,
    'hint': 'Real clocks are not perfect: jitter and skew make the effective capture edge '
            'uncertain, so sign-off reserves a clock-uncertainty guardband before the setup window '
            '(the pink band). Required time = period minus setup minus uncertainty. Find the '
            'smallest period that still meets timing WITH the uncertainty included - notice the '
            'max frequency is lower than the ideal path delay would suggest.'}

STA_EXCEPTIONS_SPEC = {   'id': 'sta-exceptions',
    'period': 2.5,
    'tsetup': 0.2,
    'options': [   'single-cycle',
                   'multicycle-2',
                   'multicycle-3',
                   'multicycle-4',
                   'false path',
                   'REAL violation'],
    'optionCycles': [1, 2, 3, 4, 0, 1],
    'paths': [   {   'id': 'core_state → core_next',
                     'delay': 2.05,
                     'correct': 0,
                     'note': 'main FSM next-state, ordinary single-cycle logic'},
                 {   'id': 'cfg_reg → dp_ctrl',
                     'delay': 8.6,
                     'correct': 3,
                     'note': 'CPU config word; firmware writes it at most once every 4 clocks'},
                 {   'id': 'mac_a → mac_result',
                     'delay': 4.4,
                     'correct': 1,
                     'note': 'pipelined multiply-accumulate, result sampled every 2nd clock'},
                 {   'id': 'arst_sync1 → arst_sync2',
                     'delay': 3.1,
                     'correct': 4,
                     'note': 'second stage of a 2-flop async-reset synchronizer (metastability '
                             'guard)'},
                 {   'id': 'scan_en → scan_ff',
                     'delay': 3.3,
                     'correct': 4,
                     'note': 'scan-enable, asserted only in test mode; constant in mission mode'},
                 {   'id': 'alu_op → alu_res',
                     'delay': 2.62,
                     'correct': 5,
                     'note': 'ordinary single-cycle ALU path - functional, just too slow'},
                 {   'id': 'rd_data → out_reg',
                     'delay': 1.9,
                     'correct': 0,
                     'note': 'read-data capture, ordinary single-cycle logic'}],
    'hint': 'Each reported path is one of: fine as a single-cycle path, a genuine multicycle path '
            '(read the note for how many clocks), a false path (synchronizers, scan/test, async or '
            'quasi-static crossings), or a REAL violation that must go back for a fix. Triage each '
            'correctly - and do NOT false-path a real functional violation, that just hides a bug.'}

STA_CORNERS_SPEC = {   'id': 'sta-corners',
    'arrival': 1.4,
    'tsetup': 0.2,
    'thold': 0.9,
    'corners': [   {'n': 'fast / cold', 'mult': 0.55},
                   {'n': 'typical', 'mult': 1.0},
                   {'n': 'slow / hot', 'mult': 1.4}],
    'periodMin': 2.0,
    'periodMax': 4.2,
    'periodStep': 0.05,
    'periodStart': 3.5,
    'aMin': 0.0,
    'aMax': 0.8,
    'aStep': 0.05,
    'aStart': 0.0,
    'hint': "The same path is signed off at every corner. Its delay scales with the corner "
            '(process, voltage, temperature). Setup is worst at the SLOW corner (longest delay); '
            'hold is worst at the FAST corner (shortest delay). Two facts make this non-trivial: '
            'hold does NOT depend on the clock period, so sliding the period can never fix a '
            'fast-corner hold violation - you must add min-delay (a hold buffer). But that added '
            'delay lengthens the slow-corner path, raising the period you need for setup. Balance '
            'the two knobs so every corner meets both checks.'}

STA_OCV_SPEC = {   'id': 'sta-ocv',
    'T': 3.0,
    'tsetup': 0.15,
    'tcq': 0.1,
    'dataDelay': 2.52,
    'dLate': 1.1,
    'dEarly': 0.9,
    'segs': [   {'id': 'c0', 'delay': 0.4, 'kind': 'common'},
                {'id': 'c1', 'delay': 0.3, 'kind': 'common'},
                {'id': 'c2', 'delay': 0.3, 'kind': 'common'},
                {'id': 'lb', 'delay': 0.35, 'kind': 'launch'},
                {'id': 'kb', 'delay': 0.3, 'kind': 'capture'}],
    'hint': 'On-chip variation (OCV) derates the launch clock late (slow) and the capture clock '
            'early (fast) to be pessimistic, which drives this path negative. But both clocks run '
            'through a COMMON trunk of buffers before they split; that shared trunk cannot be slow '
            'for launch and fast for capture at the same instant, so the derate difference on it is '
            'fake pessimism. Common-path pessimism removal (CPPR) credits it back: credit = shared '
            'wire delay times (dLate minus dEarly). Click the shared trunk segments to identify the '
            'common path. Branch segments after the split are real skew and earn no credit.'}

STA_XTALK_SPEC = {   'id': 'sta-xtalk',
    'arrival': 2.1,
    'tsetup': 0.15,
    'T': 2.6,
    'k': 0.006,
    'tMin': 1.85,
    'tMax': 2.8,
    'victimNet': 'd_q',
    'victimWin': [2.05, 2.15],
    'aggr': [   {'id': 'a1', 'name': 'aggr n7', 'cc': 28, 'dir': 'opp', 'win': [2.0, 2.2]},
                {'id': 'a2', 'name': 'aggr n12', 'cc': 18, 'dir': 'opp', 'win': [2.1, 2.3]},
                {'id': 'a3', 'name': 'aggr n3', 'cc': 25, 'dir': 'opp', 'win': [2.45, 2.65]},
                {'id': 'a4', 'name': 'aggr n21', 'cc': 20, 'dir': 'same', 'win': [2.05, 2.18]},
                {'id': 'a5', 'name': 'aggr n9', 'cc': 10, 'dir': 'opp', 'win': [2.08, 2.16]}],
    'hint': "A victim net transitions inside its switching window (the green band). Coupled "
            'aggressors inject extra delay, but only the ones that switch INSIDE the victim window '
            '(temporal alignment) AND in the OPPOSITE direction (Miller effect, which slows the '
            'victim) belong in the worst-case setup budget. A non-overlapping aggressor cannot '
            'couple during the transition; a same-direction aggressor speeds the victim up and eases '
            'setup. Each contributor adds delta = k times its coupling capacitance (Cc). Click the '
            'aggressors that contribute; ignoring crosstalk makes the slack look safe when it is '
            'not.'}

STA_REPORT_SPEC = {
    'id': 'sta-report',
    'source': 'PipeMesh16 / Mesh top / ASAP7 / floorplan stage',
    'startpoint': 'pipe_pipe_pipe_b_0_bits[5]$_DFFE_PP_',
    'endpoint': 'mesh_0_0.tile_0_0',
    'arrival': 94.73,
    'required': 4110.62,
    'slack': 4015.9,
    'reportText': 'Startpoint: pipe_pipe_pipe_b_0_bits[5]$_DFFE_PP_\n            (rising edge-triggered flip-flop clocked by core_clock)\nEndpoint: mesh_0_0.tile_0_0\n          (rising edge-triggered flip-flop clocked by core_clock)\nPath Group: core_clock\nPath Type: max\n\nFanout     Cap    Slew   Delay    Time   Description\n-----------------------------------------------------------------------------\n                 15.00    0.00    0.00   clock core_clock (rise edge)\n                          0.00    0.00   clock network delay (ideal)\n                 15.00    0.00    0.00 ^ pipe_pipe_pipe_b_0_bits[5]$_DFFE_PP_/CLK (DFFHQNx1_ASAP7_75t_R)\n     2    1.03   32.73   78.06   78.06 ^ pipe_pipe_pipe_b_0_bits[5]$_DFFE_PP_/QN (DFFHQNx1_ASAP7_75t_R)\n                                         _028400_ (net)\n                 32.73    0.00   78.06 ^ _111440_/A (INVx1_ASAP7_75t_R)\n     1    0.71   16.01   16.67   94.73 v _111440_/Y (INVx1_ASAP7_75t_R)\n                                         mesh_0_0.io_in_b_0_bits[5] (net)\n                 16.01    0.00   94.73 v mesh_0_0.tile_0_0/io_in_b_bits[5] (PE_256)\n                                 94.73   data arrival time\n\n                 15.00 7839.00 7839.00   clock core_clock (rise edge)\n                          0.00 7839.00   clock network delay (ideal)\n                        -25.00 7814.00   clock uncertainty\n                          0.00 7814.00   clock reconvergence pessimism\n                               7814.00 ^ mesh_0_0.tile_0_0/clock (PE_256)\n                        -64.84 7749.16   macro clock tree delay\n                       -3638.54 4110.62   library setup time\n                               4110.62   data required time\n-----------------------------------------------------------------------------\n                               4110.62   data required time\n                                -94.73   data arrival time\n-----------------------------------------------------------------------------\n                               4015.90   slack (MET)',
    'questions': [
        {   'q': 'Is this a setup check or a hold check?',
            'opts': ['Setup (max path)', 'Hold (min path)'],
            'correct': 0,
            'why': '"Path Type: max" is the longest path, checked against the setup requirement. '
                   'A hold check is "Path Type: min".'},
        {   'q': 'What is the clock period? (the report does not print it as one number)',
            'opts': ['7839.00 ps', '4110.62 ps', '94.73 ps', '4015.90 ps'],
            'correct': 0,
            'why': 'The launch clock edge "clock core_clock (rise edge)" is at time 0.00 and the '
                   'capture clock edge is at 7839.00. Period = capture edge minus launch edge = '
                   '7839.00 ps. (4110.62 is the required time, 94.73 the arrival, 4015.90 the slack.)'},
        {   'q': 'Slack = data required time minus data arrival time = ?',
            'opts': ['4015.90 ps', '4205.35 ps', '4110.62 ps', '-4015.90 ps'],
            'correct': 0,
            'why': '4110.62 (required) minus 94.73 (arrival) = 4015.90 ps, which is exactly the '
                   '"slack (MET)" line. Positive slack means the path meets timing. Adding them '
                   '(4205.35) or the wrong sign are the common misreads.'},
    ],
    'hint': "This is a real report_checks path. Read the two blocks: the data-arrival path ends at "
            '"data arrival time"; the data-required path (clock edge, uncertainty, reconvergence '
            'pessimism, library setup time) ends at "data required time". Slack is their difference. '
            'The clock period is not printed directly; infer it from the two clock-edge lines.'}

STA_IO_SPEC = {
    'id': 'sta-io',
    'T': 2.0,
    'tcq': 0.12,
    'ts': 0.15,
    'paths': [   {'name': 'in  data_in[7:0]', 'kind': 'in', 'ext': 0.4, 'logic': 0.9, 'min': 0.6},
                 {'name': 'out result[15:0]', 'kind': 'out', 'ext': 0.35, 'logic': 1.6, 'min': 1.1},
                 {'name': 'in  cmd_bus[3:0]', 'kind': 'in', 'ext': 1.55, 'logic': 0.6, 'min': 0.4},
                 {'name': 'out stat_flags', 'kind': 'out', 'ext': 1.45, 'logic': 0.7, 'min': 0.5}],
    'hint': 'An interface path is only partly inside your chip. The off-chip portion is captured by '
            'set_input_delay (input path: external launch clock-to-Q plus board routing) or '
            'set_output_delay (output path: the far device setup plus board routing); the rest of '
            'the fixed period is your internal logic plus the local clock-to-Q and setup. For each '
            'path pick the CHEAPEST fix that makes the bar fit inside the capture edge: leave it if '
            'it already meets, optimize the internal logic if your logic is the bottleneck, or '
            'register the boundary port only when the off-chip delay is too large to absorb even '
            'with optimized logic. Registering adds one cycle of latency, so do not use it where '
            'optimizing would do.'}

STA_BORROW_SPEC = {
    'id': 'sta-borrow',
    'T': 1.0,
    'W': 0.4,
    'delays': [1.3, 0.55, 1.25, 0.6],
    'names': ['A', 'B', 'C', 'D'],
    'avg': 0.93,
    'hint': 'An edge-triggered flip-flop has a hard deadline at the clock edge: a stage slower than '
            'one period fails, and a fast stage\'s early slack is thrown away. A level-sensitive '
            'latch is transparent for a fixed window W after the edge (the clock high phase), so '
            'late data flows straight through and the slow stage BORROWS time past the edge, repaid '
            'by the next stage starting that much later. Click each sequential element to make it a '
            'flip-flop or a latch. Put a latch only where a stage overruns its edge (so it can '
            'borrow); leave the rest as flip-flops, because a latch adds hold/min-delay risk. The '
            'chain closes whenever the AVERAGE stage delay fits the period, even if one stage does '
            'not.'}
