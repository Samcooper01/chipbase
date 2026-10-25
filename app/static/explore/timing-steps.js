/* The timing sign-off worked example: the same design, tile4m, picked
   up fully routed from the routing example.

   Every timing number so far has rested on an estimate of a wire. Now
   the wires exist, so the parasitics can be extracted from the shapes
   themselves, and the question the whole flow has been answering can
   finally be asked properly: for every path in the design, does the
   data arrive before it is required?

   The model: capacitance per net from the routed length on each layer
   plus the coupling to its neighbours, one worst setup path and one
   worst hold path built stage by stage in picoseconds, and a slack
   distribution over the design's endpoints. */

var TimingSteps = (function () {
  "use strict";

  var FS = FloorplanSteps, PL = PlacementSteps, CT = CtsSteps, RT = RoutingSteps;
  var fmt = FS.fmt, f1 = FS.f1, f2 = FS.f2, esc = FS.esc;
  var table = FS.table, checks = FS.checks;

  /* the one option per knob */
  var OPT = {
    corner: "X",                 /* define_process_corner -ext_model_index 0 X */
    rules: "rcx_patterns.rules",
    couplingShare: 0.18,         /* what the neighbours add to a net's capacitance */
    setupTimePs: 35,             /* the capturing flip-flop's setup requirement */
    holdTimePs: 30,              /* and its hold requirement */
    vdd: 0.7,                    /* volts, the nominal supply */
    activity: 0.10,              /* how often an average signal net switches */
  };

  var _M = null;
  function core() { return FS.theModel(); }

  /* ----- the path this example walks -----
     A real report_checks prints the launch clock, the data path, then
     the capture clock. These are the stages of the worst setup path in
     this block, in picoseconds, and they add up to the arrival time the
     report prints at the bottom. */
  var LAUNCH = [
    { cell: "clk (in)", kind: "port", d: 0 },
    { cell: "clkbuf_0_clk/Y (CLKBUF_X3)", kind: "buf", d: 34 },
    { cell: "clkbuf_1_2_0_clk/Y (CLKBUF_X3)", kind: "buf", d: 41 },
    { cell: "clkbuf_2_5_0_clk/Y (CLKBUF_X2)", kind: "buf", d: 39 },
    { cell: "clkbuf_leaf_58_clk/Y (CLKBUF_X2)", kind: "buf", d: 44 },
    { cell: "ctrl_c/state_reg[1]/CK (DFF_X1)", kind: "flop", d: 29 },
  ];
  var DATA = [
    { cell: "ctrl_c/state_reg[1]/Q (DFF_X1)", kind: "flop", d: 128, net: "ctrl_c/n214", len: 41 },
    { cell: "ctrl_c/U418/Z (NAND2_X1)", kind: "gate", d: 96, net: "ctrl_c/n219", len: 63 },
    { cell: "ctrl_c/U421/Z (INV_X1)", kind: "gate", d: 71, net: "ctrl_c/n223", len: 48 },
    { cell: "hub/U1203/Z (AOI21_X2)", kind: "gate", d: 141, net: "hub/n881", len: 188 },
    { cell: "hub/U1204/Z (BUF_X4)", kind: "buf", d: 118, net: "hub/n882", len: 232 },
    { cell: "hub/U1310/Z (NAND2_X2)", kind: "gate", d: 104, net: "hub/n913", len: 77 },
    { cell: "hub/U1311/Z (OAI21_X1)", kind: "gate", d: 133, net: "hub/n915", len: 102 },
    { cell: "hub/U1455/Z (XOR2_X1)", kind: "gate", d: 214, net: "hub/n1002", len: 145 },
    { cell: "hub/U1456/Z (NAND3_X2)", kind: "gate", d: 151, net: "hub/n1004", len: 88 },
    { cell: "hub/U1502/Z (AOI22_X1)", kind: "gate", d: 194, net: "hub/n1051", len: 211 },
    { cell: "hub/U1503/Z (BUF_X2)", kind: "buf", d: 109, net: "hub/n1052", len: 166 },
    { cell: "hub/U1610/Z (NAND2_X1)", kind: "gate", d: 98, net: "hub/n1088", len: 59 },
    { cell: "hub/U1731/Z (OAI21_X1)", kind: "gate", d: 133, net: "hub/n1104", len: 96 },
    { cell: "hub/U1732/Z (NAND3_X2)", kind: "gate", d: 151, net: "hub/n1106", len: 174 },
    { cell: "hub/acc_reg[7]/D (DFF_X1)", kind: "flop", d: 24, net: "", len: 0 },
  ];
  var CAPTURE = [
    { cell: "clk (in)", kind: "port", d: 0 },
    { cell: "clkbuf_0_clk/Y (CLKBUF_X3)", kind: "buf", d: 34 },
    { cell: "clkbuf_1_3_0_clk/Y (CLKBUF_X3)", kind: "buf", d: 43 },
    { cell: "clkbuf_2_9_0_clk/Y (CLKBUF_X2)", kind: "buf", d: 42 },
    { cell: "clkbuf_leaf_91_clk/Y (CLKBUF_X2)", kind: "buf", d: 47 },
    { cell: "hub/acc_reg[7]/CK (DFF_X1)", kind: "flop", d: 31 },
  ];
  /* the short path that hold has to survive: two flip-flops beside each
     other with almost nothing between them */
  var HOLD_DATA = [
    { cell: "hub/acc_reg[6]/Q (DFF_X1)", kind: "flop", d: 96 },
    { cell: "hub/U993/Z (INV_X2)", kind: "gate", d: 31 },
    { cell: "hub/acc_reg[7]/D (DFF_X1)", kind: "flop", d: 9 },
  ];

  function sum(list) { return list.reduce(function (a, s) { return a + s.d; }, 0); }

  function model() {
    if (_M) return _M;
    var R = RT.model(), cm = CT.model(), z = core().z;

    /* capacitance, layer by layer, from the wire that was actually drawn */
    var wireC = 0, wireR = 0;
    R.layers.forEach(function (l) {
      var w = FS.wireRC(l.name);
      wireC += l.demand * w.c;                 /* femtofarads */
      wireR += l.demand * w.r;                 /* ohms, summed over the design */
    });
    var coupling = wireC * OPT.couplingShare;
    var pinC = R.nets * 3.0;                   /* what the gates themselves present */
    var totalC = wireC + coupling + pinC;

    /* the setup path */
    var launch = sum(LAUNCH), data = sum(DATA), capture = sum(CAPTURE);
    var M0 = {};
    var period = FS.DESIGN.clockPeriodNs * 1000;
    var arrival = launch + data;
    var required = period + capture - OPT.setupTimePs;
    var slack = required - arrival;
    M0.arrival = arrival; M0.required = required;

    /* the hold path, against the same edge rather than the next one */
    var holdData = sum(HOLD_DATA);
    var holdArrival = launch + holdData;
    var holdRequired = capture + OPT.holdTimePs;
    var holdSlack = holdArrival - holdRequired;

    /* the same path as the router last saw it, before extraction added
       the coupling: that is the number the previous example ended on */
    var estArrival = arrival - 60;
    var estSlack = required - estArrival;

    /* power, from the capacitance that was just extracted */
    var f = 1e12 / period;                                  /* picoseconds to hertz */
    var sw = 0.5 * (totalC * 1e-15) * OPT.vdd * OPT.vdd * f * OPT.activity;
    var clkC = cm.flops * 3.0 + R.wire.clock * FS.wireRC("metal5").c + cm.buffers * 3.0;
    var clkP = 0.5 * (clkC * 1e-15) * OPT.vdd * OPT.vdd * f * 2;   /* the clock switches every cycle */
    var internal = (sw + clkP) * 0.55;
    var leakage = R.insts * 12e-9;                          /* a few nanowatts a cell */

    /* ----- the endpoints, where they are and what slack they have -----
       One sample per drawn flip-flop, at the position clock tree
       synthesis put it. Slack falls towards the middle of the block,
       because that is where the hub is and where the longest logic
       chains end, and the worst of them is the path steps 3 and 4
       walked. The histogram and the die map are both built from this
       one list, so they cannot disagree. */
    var endpoints = cm.flops + z.fg.portBits;
    var wns = (M0.required - M0.arrival) / 1000;          /* nanoseconds */
    var cx = z.coreW / 2, cy = z.coreH / 2;
    var maxR = Math.sqrt(cx * cx + cy * cy);
    var eps = cm.sinks.map(function (sk, i) {
      var dx = sk.x - cx, dy = sk.y - cy;
      var r = Math.sqrt(dx * dx + dy * dy) / maxR;
      var n = Math.sin((i + 1) * 12.9898) * 43758.5453;
      n = (n - Math.floor(n)) - 0.5;
      var sl = wns + 1.02 * Math.pow(r, 0.75) + n * 0.22;
      return { x: sk.x, y: sk.y, slack: Math.max(wns, sl) };
    });
    /* the worst endpoint is the one the report named */
    var worst = 0;
    eps.forEach(function (e, i) { if (e.slack < eps[worst].slack) worst = i; });
    eps[worst].slack = wns;

    var nb = 22, loS = wns, hiS = wns + 1.25;
    var bins = new Array(nb).fill(0);
    eps.forEach(function (e) {
      var k = Math.min(nb - 1, Math.floor((e.slack - loS) / (hiS - loS) * nb));
      bins[Math.max(0, k)] += 1;
    });
    var scale = endpoints / eps.length;
    bins = bins.map(function (v) { return Math.round(v * scale); });

    _M = {
      R: R, cts: cm, z: z,
      wireC: wireC, wireR: wireR, coupling: coupling, pinC: pinC, totalC: totalC,
      period: period, launch: launch, data: data, capture: capture,
      arrival: arrival, required: required, slack: slack,
      estArrival: estArrival, estSlack: estSlack,
      holdData: holdData, holdArrival: holdArrival, holdRequired: holdRequired, holdSlack: holdSlack,
      power: { switching: sw, clock: clkP, internal: internal, leakage: leakage,
               total: sw + clkP + internal + leakage },
      endpoints: endpoints, bins: bins, eps: eps, binLo: loS, binHi: hiS, worstEp: worst,
      /* the skew the clock tree example promised would move */
      skewEst: cm.t.skew * 1000, skewExt: cm.t.skew * 1000 * 1.34,
      latEst: cm.t.mean * 1000, latExt: cm.t.mean * 1000 * 1.11,
    };
    return _M;
  }

  /* ================= drawing ================= */

  function ps(v) { return Math.round(v) + " ps"; }

  /* ----- step 1: where a net's capacitance comes from ----- */
  function capFigure(M) {
    var W = 940, H = 268;
    var o = ['<svg viewBox="0 0 ' + W + " " + H + '" class="ff3-svg tm-cap" role="img" ' +
             'aria-label="A cut through three neighbouring wires, showing the capacitance each one has ' +
             'to the layers around it and to its neighbours, and the totals for the design">'];
    o.push('<text class="ff3-cap" x="12" y="20">three neighbouring wires on one layer, seen end on</text>');

    /* the cut: a ground plane, three wires, a plane above */
    var gy = 150, wy = 92, wx = [150, 250, 350], ww = 46, wh = 30;
    o.push('<rect class="tm-plane" x="120" y="' + gy + '" width="330" height="16" rx="2"/>');
    o.push('<text class="tm-lab" x="112" y="' + (gy + 12) + '">the layer below</text>');
    o.push('<rect class="tm-plane" x="120" y="46" width="330" height="16" rx="2"/>');
    o.push('<text class="tm-lab" x="112" y="58">the layer above</text>');
    wx.forEach(function (x, i) {
      o.push('<rect class="tm-wire' + (i === 1 ? " tm-wire-mid" : "") + '" x="' + x + '" y="' + wy +
             '" width="' + ww + '" height="' + wh + '" rx="2"/>');
    });
    o.push('<text class="tm-lab2" x="' + (wx[1] + ww / 2) + '" y="' + (wy + 20) + '">this net</text>');
    /* to the planes, and to the neighbours */
    [[wx[1] + ww / 2, wy + wh, wx[1] + ww / 2, gy], [wx[1] + ww / 2, wy, wx[1] + ww / 2, 62]].forEach(function (c) {
      o.push('<line class="tm-cline" x1="' + c[0] + '" y1="' + c[1] + '" x2="' + c[2] + '" y2="' + c[3] + '"/>');
    });
    o.push('<line class="tm-cline tm-cline-cpl" x1="' + (wx[0] + ww) + '" y1="' + (wy + wh / 2) +
           '" x2="' + wx[1] + '" y2="' + (wy + wh / 2) + '"/>');
    o.push('<line class="tm-cline tm-cline-cpl" x1="' + (wx[1] + ww) + '" y1="' + (wy + wh / 2) +
           '" x2="' + wx[2] + '" y2="' + (wy + wh / 2) + '"/>');
    o.push('<text class="tm-note" x="470" y="86">to the layers above and below:</text>');
    o.push('<text class="tm-note2" x="470" y="104">the capacitance a placement estimate already knew about</text>');
    o.push('<text class="tm-note tm-note-cpl" x="470" y="132">to the neighbours, sideways:</text>');
    o.push('<text class="tm-note2" x="470" y="150">the coupling, which cannot exist until the neighbours do</text>');
    o.push('<text class="tm-note2" x="470" y="176">at this node the neighbours are closer than the planes,</text>');
    o.push('<text class="tm-note2" x="470" y="194">so coupling is the part an estimate gets most wrong</text>');

    /* what it adds up to across the design */
    var parts = [
      { k: "wire to the planes", v: M.wireC, c: "tm-bar-w" },
      { k: "coupling to neighbours", v: M.coupling, c: "tm-bar-c" },
      { k: "the gate pins themselves", v: M.pinC, c: "tm-bar-p" },
    ];
    var bx = 150, bw = 560, by = 216;
    var run = 0;
    parts.forEach(function (p) {
      var w = (p.v / M.totalC) * bw;
      o.push('<rect class="' + p.c + '" x="' + (bx + run).toFixed(1) + '" y="' + by + '" width="' +
             w.toFixed(1) + '" height="18" rx="2"/>');
      run += w;
    });
    o.push('<text class="tm-lab" x="142" y="' + (by + 13) + '">the whole design</text>');
    o.push('<text class="tm-note2" x="' + bx + '" y="' + (by + 34) + '">' +
           parts.map(function (p) { return f1(p.v / 1000) + " pF " + p.k; }).join(" · ") + "</text>");
    o.push("</svg>");
    return o.join("") +
      '<div class="ff3-legend">' +
      '<span><i class="pl-sw tm-sw-w"></i>capacitance to the layers above and below</span>' +
      '<span><i class="pl-sw tm-sw-c"></i>coupling to the wires beside it</span>' +
      '<span><i class="pl-sw tm-sw-p"></i>the input pins the net drives</span></div>';
  }

  /* ----- step 2: what extraction did to the clock ----- */
  function clockFigure(M) {
    var W = 720, H = 200, ml = 210, mr = 90;
    var max = Math.max(M.latExt, M.latEst) * 1.1;
    var rows = [
      { k: "insertion delay, estimated", v: M.latEst, c: "tm-bar-est" },
      { k: "insertion delay, extracted", v: M.latExt, c: "tm-bar-ext" },
      { k: "skew, estimated", v: M.skewEst, c: "tm-bar-est" },
      { k: "skew, extracted", v: M.skewExt, c: "tm-bar-ext" },
    ];
    var o = ['<svg viewBox="0 0 ' + W + " " + H + '" class="ff3-svg tm-clock" role="img" ' +
             'aria-label="The clock tree measured twice: on estimated wire, and on the extracted ' +
             'parasitics of the metal that was actually drawn">'];
    o.push('<text class="ff3-cap" x="12" y="20">the same clock tree, measured on the estimate and then on the metal</text>');
    rows.forEach(function (r, i) {
      var y = 44 + i * 36;
      o.push('<text class="tm-lab" x="' + (ml - 12) + '" y="' + (y + 13) + '">' + r.k + "</text>");
      o.push('<rect class="' + r.c + '" x="' + ml + '" y="' + y + '" width="' +
             ((r.v / max) * (W - ml - mr)).toFixed(1) + '" height="18" rx="3"/>');
      o.push('<text class="tm-val" x="' + (ml + (r.v / max) * (W - ml - mr) + 8).toFixed(1) + '" y="' +
             (y + 13) + '">' + ps(r.v) + "</text>");
    });
    o.push("</svg>");
    return o.join("") +
      '<div class="ff3-legend">' +
      '<span><i class="pl-sw tm-sw-est"></i>measured on estimated wire, as the clock tree stage left it</span>' +
      '<span><i class="pl-sw tm-sw-ext"></i>measured on the extracted parasitics of the routed metal</span></div>';
  }

  /* ----- step 3: the path, accumulating ----- */
  var PW = { W: 780, H: 262, ml: 26, mr: 120, rowY: [96, 158], barH: 26 };

  function pathFigure(M) {
    var x0 = PW.ml, x1 = PW.W - PW.mr, span = M.period * 1.12;
    function X(t) { return x0 + (t / span) * (x1 - x0); }
    var o = ['<svg viewBox="0 0 ' + PW.W + " " + PW.H + '" class="ff3-svg tm-path" role="img" ' +
             'aria-label="The worst setup path, drawn as time accumulating through the launch clock ' +
             'and then through every gate of the data path">'];
    o.push('<text class="ff3-cap" x="12" y="20">the worst setup path in the block, stage by stage, ' +
           "in picoseconds after the clock edge leaves the port</text>");
    o.push('<text class="ff3-cap tm-say" x="12" y="40" id="tm-psay">press play</text>');

    ["the clock reaching the launching flip-flop", "the data, gate by gate"].forEach(function (lab, i) {
      o.push('<text class="tm-rowlab" x="' + x0 + '" y="' + (PW.rowY[i] - 8) + '">' + lab + "</text>");
      o.push('<line class="tm-track" x1="' + x0 + '" y1="' + (PW.rowY[i] + PW.barH / 2) + '" x2="' + x1 +
             '" y2="' + (PW.rowY[i] + PW.barH / 2) + '"/>');
    });

    var run = 0;
    LAUNCH.forEach(function (st, i) {
      if (st.d === 0) return;
      o.push('<rect class="tm-seg tm-seg-clk" data-seg="l' + i + '" x="' + X(run).toFixed(1) + '" y="' + PW.rowY[0] +
             '" width="' + (X(st.d) - X(0)).toFixed(1) + '" height="' + PW.barH + '" style="display:none"/>');
      run += st.d;
    });
    var dataStart = run;
    DATA.forEach(function (st, i) {
      o.push('<rect class="tm-seg tm-seg-' + st.kind + '" data-seg="d' + i + '" x="' + X(run).toFixed(1) +
             '" y="' + PW.rowY[1] + '" width="' + Math.max(1.5, X(st.d) - X(0)).toFixed(1) +
             '" height="' + PW.barH + '" style="display:none"/>');
      run += st.d;
    });
    /* the clock edge that starts it, and the arrival marker at the end */
    o.push('<line class="tm-edge" x1="' + X(0) + '" y1="' + (PW.rowY[0] - 24) + '" x2="' + X(0) +
           '" y2="' + (PW.rowY[1] + PW.barH + 10) + '"/>');
    o.push('<text class="tm-note2" x="' + (X(0) + 6) + '" y="' + (PW.rowY[0] - 28) + '">clock edge</text>');
    o.push('<line class="tm-arrive" id="tm-arrline" x1="' + X(M.arrival) + '" y1="' + (PW.rowY[1] - 30) +
           '" x2="' + X(M.arrival) + '" y2="' + (PW.rowY[1] + PW.barH + 14) + '" style="display:none"/>');
    o.push('<text class="tm-arrlab" id="tm-arrlab" x="' + (X(M.arrival) + 8) + '" y="' + (PW.rowY[1] - 20) +
           '" style="display:none">data arrives, ' + ps(M.arrival) + "</text>");

    /* the time axis */
    o.push('<line class="pl-grid" x1="' + x0 + '" y1="' + (PW.H - 52) + '" x2="' + x1 + '" y2="' + (PW.H - 52) + '"/>');
    for (var t = 0; t <= M.period; t += 250) {
      o.push('<line class="tm-tick" x1="' + X(t) + '" y1="' + (PW.H - 52) + '" x2="' + X(t) + '" y2="' + (PW.H - 46) + '"/>');
      o.push('<text class="pl-tick pl-tick-x" x="' + X(t) + '" y="' + (PW.H - 32) + '">' + t + "</text>");
    }
    o.push('<text class="pl-axis pl-axis-x" x="' + ((x0 + x1) / 2) + '" y="' + (PW.H - 10) +
           '">picoseconds after the clock edge leaves the port</text>');
    o.push("</svg>");
    return o.join("") +
      '<div class="gp-readout" id="tm-pread">' +
      '<span>stage <b id="tm-stage">-</b></span>' +
      '<span>this stage costs <b id="tm-stagev">-</b></span>' +
      '<span>time so far <b id="tm-run">0 ps</b></span>' +
      '<button class="ff-reset" type="button" id="tm-preplay">replay</button></div>' +
      '<div class="ff3-legend">' +
      '<span><i class="pl-sw tm-sw-clk"></i>a clock buffer on the way to the launching flip-flop</span>' +
      '<span><i class="pl-sw tm-sw-flop"></i>the flip-flops at each end</span>' +
      '<span><i class="pl-sw tm-sw-gate"></i>a logic gate, and the wire out of it</span>' +
      '<span><i class="pl-sw tm-sw-buf"></i>a buffer the flow inserted</span></div>';
  }

  function pathAnimate(M) {
    var root = document.getElementById("flow-fig-3");
    if (!root) return;
    var segs = [].slice.call(root.querySelectorAll(".tm-seg"));
    if (!segs.length) return;
    var say = document.getElementById("tm-psay");
    var stageEl = document.getElementById("tm-stage");
    var valEl = document.getElementById("tm-stagev");
    var runEl = document.getElementById("tm-run");
    var line = document.getElementById("tm-arrline"), lab = document.getElementById("tm-arrlab");
    var replay = document.getElementById("tm-preplay");
    var timers = [];
    function later(ms, fn) { timers.push(setTimeout(fn, ms)); }

    var order = [];
    LAUNCH.forEach(function (st, i) { if (st.d) order.push({ id: "l" + i, st: st, where: "launch clock" }); });
    DATA.forEach(function (st, i) { order.push({ id: "d" + i, st: st, where: "data path" }); });

    function play() {
      timers.forEach(clearTimeout);
      timers = [];
      segs.forEach(function (el) { el.style.display = "none"; });
      if (line) line.style.display = "none";
      if (lab) lab.style.display = "none";
      if (stageEl) stageEl.textContent = "-";
      if (valEl) valEl.textContent = "-";
      if (runEl) runEl.textContent = "0 ps";
      if (say) say.textContent = "the clock edge leaves the port, and every stage from here adds its delay";
      var run = 0;
      order.forEach(function (o, i) {
        later(500 + i * 340, function () {
          var el = root.querySelector('.tm-seg[data-seg="' + o.id + '"]');
          if (el) el.style.display = "";
          run += o.st.d;
          if (stageEl) stageEl.textContent = (i + 1) + " of " + order.length;
          if (valEl) valEl.textContent = ps(o.st.d);
          if (runEl) runEl.textContent = ps(run);
          if (say) say.textContent = o.where + ": " + o.st.cell;
          if (i === order.length - 1) {
            if (line) line.style.display = "";
            if (lab) lab.style.display = "";
            if (say) say.textContent = "the data reaches the capturing flip-flop's input at " +
              ps(M.arrival) + ". Whether that is soon enough is the next step.";
          }
        });
      });
    }

    if (replay && !replay.dataset.wired) {
      replay.dataset.wired = "1";
      replay.addEventListener("click", play);
    }
    play();
  }

  /* ================= the steps ================= */

  var STEPS = [];

  STEPS.push({
    n: 1, title: "Extract the parasitics", button: "Extract", againLabel: "Extract again",
    line: "Measure the resistance and capacitance of the metal that was actually drawn.",
    intro:
      "<p>Every timing number the flow has <em>acted on</em> so far has been an estimate of a wire. A " +
      "fanout table before placement, then the straight line between two placed pins, then the length " +
      "of the corridor the global router chose. Each was better than the last, and each was still a " +
      "guess: every resize, every buffer and every repair in the previous four stages was decided " +
      'against one of them. The <a href="/explore/examples/routing">routing example</a> named this ' +
      "step as the rung below it and printed what it expected extraction to say; nothing had been " +
      "extracted.</p>" +
      "<p>The wires exist now, so they can be measured. Extraction walks the routed shapes and works " +
      "out, for every net, the resistance along it and the capacitance from it to everything around " +
      "it: the layers above and below, and the wires running beside it on its own layer. That last " +
      "part, the <strong>coupling</strong>, is the one no estimate could have: it depends on which " +
      "neighbours the router happened to put there.</p>",
    command:
      "# one corner: this run is the typical one the whole example has used\n" +
      "define_process_corner -ext_model_index 0 " + OPT.corner + "\n" +
      "extract_parasitics -ext_model_file " + OPT.rules + "\n" +
      "\n" +
      "# write it out, then read it back into the timer\n" +
      "write_spef tile4m.spef\n" +
      "read_spef tile4m.spef",
    commandNote:
      "The rules file is what turns geometry into numbers: it holds patterns measured from a field " +
      "solver for this process, so the extractor can look up what a given wire beside a given " +
      "neighbour is worth rather than solving the field itself. The SPEF (Standard Parasitic Exchange " +
      "Format) file is the interchange format for the result, which is why it is written out and read " +
      "back rather than kept in memory: every other tool in sign-off wants to read the same file.",
    run: function () {
      var M = model();
      return {
        log: [
          { k: "cmd", t: "define_process_corner -ext_model_index 0 " + OPT.corner },
          { k: "cmd", t: "extract_parasitics -ext_model_file " + OPT.rules },
          { k: "out", t: "  [INFO RCX-0431] Defined process_corner " + OPT.corner + " with ext_model_index 0" },
          { k: "out", t: "  [INFO RCX-0043] Reading extraction model file " + OPT.rules + " ..." },
          { k: "out", t: "  [INFO RCX-0007] Extracting parasitics of " + fmt(M.R.nets) + " nets ..." },
          { k: "out", t: "  [INFO RCX-0016] Final " + fmt(M.R.nets) + " rc segments" },
          { k: "cmd", t: "write_spef tile4m.spef" },
          { k: "out", t: "  " + f1(M.totalC / 1000) + " pF of capacitance in total, " +
                         f1(M.coupling / 1000) + " pF of it coupling between neighbours" },
          { k: "cmd", t: "read_spef tile4m.spef" },
          { k: "ok", t: "The timer is working from measured parasitics. No number after this is an estimate." },
        ],
        figure: '<p class="ff3-figtext">A net\'s capacitance is not one number to ground. Part of it is ' +
          "to the layers above and below, which an estimate can work out from the wire's length and " +
          "width. The rest is to the wires running alongside it, and that part depends on what the " +
          "router put there, which is why it cannot be known until now. The bar at the bottom is the " +
          "whole design: " + f1(M.wireC / 1000) + " picofarads of wire to the planes, " +
          f1(M.coupling / 1000) + " of coupling, and " + f1(M.pinC / 1000) +
          " of gate pins, which still dominate at this size of block.</p>" + capFigure(M),
        report: "<h3>What extraction produced</h3>" + table([
          ["Nets extracted", fmt(M.R.nets)],
          ["Wire capacitance", f1(M.wireC / 1000) + " picofarads, from " +
            fmt(Math.round(M.R.wire.total)) + " micrometers of metal"],
          ["Coupling capacitance", f1(M.coupling / 1000) + " picofarads, " +
            Math.round(100 * OPT.couplingShare) + "% on top of the wire capacitance"],
          ["Pin capacitance", f1(M.pinC / 1000) + " picofarads, the gates being driven"],
          ["Total", f1(M.totalC / 1000) + " picofarads"],
          ["Corner", "one, the typical one; sign-off uses several"],
        ]) + checks([
          ["This is the first exact number in the flow.",
           "Everything before it was an approximation that the next stage improved on. From here the " +
           "numbers do not get better, they only get checked, which is why this stage is called " +
           "sign-off and why nothing downstream is allowed to change the design without redoing it."],
          ["Coupling is what an estimate cannot reach.",
           "A wire's capacitance to the planes follows from its own geometry, so a good estimate gets " +
           "close. Its capacitance to a neighbour depends on a decision the router made, and at this " +
           "node the neighbour is closer than the plane. That is why the slack in the next steps is " +
           "worse than the number the router was optimizing against."],
          ["One corner is not sign-off.",
           "<code>define_process_corner</code> names a single set of extraction models, and this " +
           "example uses one. A real sign-off extracts several, because a wire that is at its thinnest " +
           "and a transistor that is at its slowest do not happen in the same corner, and both have to " +
           "be survived."],
        ]),
      };
    },
  });

  STEPS.push({
    n: 2, title: "Re-measure the clock", button: "Measure the clock", againLabel: "Measure again",
    line: "The clock tree was balanced on estimated wire; this is what it does on real metal.",
    intro:
      "<p>The clock tree example ended by saying its skew number was provisional, because it was " +
      "measured on wire that did not exist. This is where that promise comes due.</p>" +
      "<p>The tree itself has not changed: the same buffers, in the same places, driving the same " +
      "flip-flops. What has changed is what the timer believes about the wire between them, and the " +
      "clock is the network that cares most, because its delay is subtracted from every path in the " +
      "design twice over.</p>",
    command:
      "report_clock_skew\n" +
      "report_clock_latency",
    commandNote:
      "Both commands are the same ones the clock tree example ran. Only the parasitics underneath them " +
      "are different, so the difference in the answers is the error that stage was carrying.",
    run: function () {
      var M = model();
      var text =
        "Clock clk\n" +
        "  " + f1(M.latExt + M.skewExt / 2) + " source latency hub/acc_reg[7]/CK ^\n" +
        " -" + f1(M.latExt - M.skewExt / 2) + " target latency ctrl_c/state_reg[1]/CK ^\n" +
        "   0.00 CRPR\n" +
        "--------------\n" +
        "  " + f1(M.skewExt) + " setup skew";
      return {
        log: [
          { k: "cmd", t: "report_clock_skew" },
          { k: "out", t: "  setup skew " + f1(M.skewExt) + " ps, was " + f1(M.skewEst) + " ps on the estimate" },
          { k: "cmd", t: "report_clock_latency" },
          { k: "out", t: "  clk insertion delay " + Math.round(M.latExt) + " ps, was " +
                         Math.round(M.latEst) + " ps on the estimate" },
          { k: "ok", t: "The clock is slower and slightly less balanced than the tree builder thought." },
        ],
        figure: '<p class="ff3-figtext">Both numbers grew, and they grew for the same reason: the real ' +
          "metal is longer than the straight lines the tree was balanced on, and it has neighbours " +
          "coupling into it. Insertion delay grew by " +
          Math.round(100 * (M.latExt / M.latEst - 1)) + "%, which costs nothing by itself. Skew grew by " +
          Math.round(100 * (M.skewExt / M.skewEst - 1)) + "%, and that comes straight off every path " +
          "in the design.</p>" + clockFigure(M) +
          '<pre class="pl-report">' + esc(text) + "</pre>",
        report: "<h3>The clock, before and after</h3>" + table([
          ["Insertion delay, estimated", Math.round(M.latEst) + " picoseconds"],
          ["Insertion delay, extracted", Math.round(M.latExt) + " picoseconds"],
          ["Skew, estimated", f1(M.skewEst) + " picoseconds"],
          ["Skew, extracted", f1(M.skewExt) + " picoseconds"],
          ["Tree", "unchanged: " + fmt(M.cts.buffers) + " buffers, " + M.cts.depth + " levels"],
        ]) + checks([
          ["The tree did not get worse; the measurement got honest.",
           "Nothing about the clock network changed between the two numbers. The first was computed " +
           "from straight lines between buffers, the second from the metal the router drew. The gap " +
           "between them is the error the clock tree stage was optimizing inside."],
          ["This is why the tree is built before routing and checked after.",
           "Balancing needs positions, which exist at clock tree synthesis. Proving the balance needs " +
           "wires, which exist only now. Every flow does both, and a large gap between them is a sign " +
           "that the estimates during clock tree synthesis need to be better, not that the tree is bad."],
          ["Skew is charged twice.",
           "It is subtracted from the setup check on every path whose two flip-flops are at opposite " +
           "ends of the distribution, and it is the thing that creates hold violations on short paths. " +
           "The next three steps are those two checks, on this clock."],
        ]),
      };
    },
  });

  STEPS.push({
    n: 3, title: "Walk one path", button: "Report the path", againLabel: "Report again",
    line: "Follow the worst path in the design from the clock edge to the capturing flip-flop.",
    intro:
      "<p>A timing report is not a summary, it is an account. It starts at a clock edge, follows that " +
      "edge through the clock tree to the flip-flop that launches the data, follows the data through " +
      "every gate and wire it passes, and arrives at the input of the flip-flop that has to capture " +
      "it. Every line is one stage, and every stage adds its delay to a running total.</p>" +
      "<p>This is the worst path in the block, which means the total at the bottom is the largest in " +
      "the design. Watch it accumulate: " + Math.round(model().launch) + " picoseconds of it is the " +
      "clock simply reaching the launching flip-flop, before any work is done at all.</p>",
    command:
      "report_checks -path_delay max -fields {slew cap input net fanout} -format full_clock_expanded",
    commandNote:
      "<code>-format full_clock_expanded</code> is what prints the clock path itself, buffer by " +
      "buffer, on both the launching and the capturing side, rather than collapsing it into one " +
      "number. It is the format the reference flow writes into its own reports, because when a path " +
      "fails the reason is as often in the clock as in the data.",
    run: function () {
      var M = model();
      var lines = [];
      lines.push("Startpoint: ctrl_c/state_reg[1] (rising edge-triggered flip-flop clocked by clk)");
      lines.push("Endpoint: hub/acc_reg[7] (rising edge-triggered flip-flop clocked by clk)");
      lines.push("Path Group: clk");
      lines.push("Path Type: max");
      lines.push("");
      lines.push("  Delay    Time   Description");
      lines.push("---------------------------------------------------------------");
      var run = 0;
      lines.push("   0.00    0.00   clock clk (rise edge)");
      LAUNCH.forEach(function (st) {
        run += st.d;
        lines.push("  " + String(st.d.toFixed(2)).padStart(5) + "  " + String(run.toFixed(2)).padStart(6) +
                   " ^ " + st.cell);
      });
      DATA.forEach(function (st) {
        run += st.d;
        lines.push("  " + String(st.d.toFixed(2)).padStart(5) + "  " + String(run.toFixed(2)).padStart(6) +
                   " ^ " + st.cell);
        if (st.net) lines.push("                         " + st.net + " (net, " + st.len + " um)");
      });
      lines.push("          " + String(M.arrival.toFixed(2)).padStart(6) + "   data arrival time");
      return {
        log: [
          { k: "cmd", t: "report_checks -path_delay max -fields {slew cap input net fanout} -format full_clock_expanded" },
          { k: "out", t: "  Startpoint: ctrl_c/state_reg[1]" },
          { k: "out", t: "  Endpoint: hub/acc_reg[7]" },
          { k: "out", t: "  launch clock " + M.launch + " ps, data path " + M.data + " ps" },
          { k: "out", t: "  data arrival time " + M.arrival + " ps" },
          { k: "ok", t: "One path, accounted for stage by stage." },
        ],
        figure: '<p class="ff3-figtext">The picture below is that same report drawn against time. The ' +
          "top row is the clock edge travelling through the tree to the launching flip-flop, which " +
          "costs " + M.launch + " picoseconds before the path has done anything useful. The bottom row " +
          "is the data, one block per gate, each starting where the last one finished. Where the last " +
          "block ends is the arrival time.</p>" + pathFigure(M) +
          '<pre class="pl-report">' + esc(lines.join("\n")) + "</pre>",
        after: function () { pathAnimate(M); },
        report: "<h3>Where the time goes</h3>" + table([
          ["Clock to the launching flip-flop", M.launch + " picoseconds"],
          ["Data through " + DATA.length + " stages", M.data + " picoseconds"],
          ["Data arrival time", M.arrival + " picoseconds"],
          ["Longest single stage", "the XOR2_X1 at 214 picoseconds"],
          ["Average stage", Math.round(M.data / DATA.length) + " picoseconds"],
        ]) + checks([
          ["The clock is part of the path.",
           "A quarter of a nanosecond is spent before the launching flip-flop even sees the edge. That " +
           "is not wasted: the capturing flip-flop's clock takes a similar time, so most of it cancels. " +
           "What does not cancel is the difference, which is the skew."],
          ["Wire is inside every one of these numbers.",
           "A stage's delay is the gate driving the capacitance it sees, and most of that capacitance " +
           "is now measured rather than estimated. The two longest stages are the ones with the longest " +
           "nets out of them, which is what made the previous stages care so much about wire length."],
          ["A report is an account, not a verdict.",
           "Nothing here says whether the path passes. It says when the data arrives. The verdict needs " +
           "the other half: when it was required, which is the next step."],
        ]),
      };
    },
  });

  /* ----- steps 4 and 5: the two checks, as waveforms -----
     Three signals: the clock as the launching flip-flop sees it, the
     clock as the capturing one sees it, and the data at the capturing
     flip-flop's input. Setup and hold are the same drawing with the
     window on opposite sides of the capturing edge. */
  var WV = {
    W: 860, H: 372, ml: 218, mr: 78,
    rows: [82, 148, 226], amp: 30, dataAmp: 30,
  };

  function waveFigure(M, mode) {
    var setup = mode === "setup";
    var span = setup ? M.period * 1.32 : 560;
    var x0 = WV.ml, x1 = WV.W - WV.mr;
    function X(t) { return x0 + (t / span) * (x1 - x0); }
    var P = M.period;
    var launchLat = M.launch, capLat = M.capture;
    /* the edge that launches, and the edge that captures */
    var launchEdge = launchLat;
    var capEdge = setup ? P + capLat : capLat;
    var arrival = setup ? M.arrival : M.holdArrival;
    var required = setup ? M.required : M.holdRequired;
    var slack = setup ? M.slack : M.holdSlack;
    var id = setup ? "s" : "h";

    /* a square wave: low, then a rising edge every period */
    function clockPath(lat, y) {
      var lo = y + WV.amp / 2, hi = y - WV.amp / 2, pts = [];
      pts.push([X(0), lo]);
      for (var t = lat; t < span; t += P) {
        pts.push([X(t), lo], [X(t), hi]);
        var f = Math.min(span, t + P / 2);
        pts.push([X(f), hi], [X(f), lo]);
      }
      pts.push([X(span), lo]);
      return pts.map(function (p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" ");
    }
    function dataPath(at, y) {
      var lo = y + WV.dataAmp / 2, hi = y - WV.dataAmp / 2;
      return [[X(0), lo], [X(at), lo], [X(at), hi], [X(span), hi]]
        .map(function (p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" ");
    }

    var o = ['<svg viewBox="0 0 ' + WV.W + " " + WV.H + '" class="ff3-svg tm-wave" role="img" ' +
             'aria-label="' + (setup
               ? "Waveforms of the launching clock, the capturing clock and the data, with the setup " +
                 "window before the capturing edge and the slack between the data edge and that window"
               : "Waveforms of the launching clock, the capturing clock and the data, with the hold " +
                 "window after the capturing edge and the slack between that window and the data edge") +
             '">'];
    o.push('<text class="ff3-cap" x="12" y="20">' + (setup
      ? "the data must be steady before the next capturing edge"
      : "the data must not change until this capturing edge is done with the old value") + "</text>");
    o.push('<text class="ff3-cap tm-say" x="12" y="40" id="tm-' + id + 'say">press play</text>');

    [["clock at the launching flip-flop", 0], ["clock at the capturing flip-flop", 1],
     ["data at the capturing flip-flop", 2]].forEach(function (r) {
      o.push('<text class="tm-wlab" x="' + (x0 - 14) + '" y="' + (WV.rows[r[1]] + 4) + '">' + r[0] + "</text>");
    });
    o.push('<text class="tm-wsub" x="' + (x0 - 14) + '" y="' + (WV.rows[0] + 18) + '">' +
           launchLat + " ps after the port</text>");
    o.push('<text class="tm-wsub" x="' + (x0 - 14) + '" y="' + (WV.rows[1] + 18) + '">' +
           capLat + " ps after the port</text>");

    /* the window the capturing flip-flop needs the data steady in */
    var wLo = setup ? required : capEdge, wHi = setup ? capEdge : required;
    o.push('<rect class="tm-window" id="tm-' + id + 'win" x="' + X(wLo).toFixed(1) + '" y="' +
           (WV.rows[2] - WV.dataAmp / 2 - 10) + '" width="' + (X(wHi) - X(wLo)).toFixed(1) +
           '" height="' + (WV.dataAmp + 20) + '" rx="3" style="display:none"/>');
    o.push('<text class="tm-winlab" id="tm-' + id + 'winlab" x="' + ((X(wLo) + X(wHi)) / 2).toFixed(1) +
           '" y="' + (WV.rows[2] + WV.dataAmp / 2 + 26) + '" style="display:none">' +
           (setup ? "setup window, " + OPT.setupTimePs + " ps" : "hold window, " + OPT.holdTimePs + " ps") +
           "</text>");

    /* the three signals */
    o.push('<polyline class="tm-wave-clk" id="tm-' + id + 'wl" points="' + clockPath(launchLat, WV.rows[0]) +
           '" style="display:none"/>');
    o.push('<polyline class="tm-wave-clk" id="tm-' + id + 'wc" points="' + clockPath(capLat, WV.rows[1]) +
           '" style="display:none"/>');
    o.push('<polyline class="tm-wave-dat" id="tm-' + id + 'wd" points="' + dataPath(arrival, WV.rows[2]) +
           '" style="display:none"/>');

    /* the edges that matter, and the marks between them */
    o.push('<line class="tm-wedge" id="tm-' + id + 'le" x1="' + X(launchEdge) + '" y1="' + (WV.rows[0] - 26) +
           '" x2="' + X(launchEdge) + '" y2="' + (WV.rows[2] + 26) + '" style="display:none"/>');
    o.push('<text class="tm-wnote" id="tm-' + id + 'lelab" x="' + (X(launchEdge) + 6) + '" y="' + (WV.rows[0] - 30) +
           '" style="display:none">the edge that launches, ' + ps(launchEdge) + "</text>");
    o.push('<line class="tm-wedge tm-wedge-cap" id="tm-' + id + 'ce" x1="' + X(capEdge) + '" y1="' + (WV.rows[1] - 26) +
           '" x2="' + X(capEdge) + '" y2="' + (WV.rows[2] + 26) + '" style="display:none"/>');
    o.push('<text class="tm-wnote tm-wnote-cap tm-endlab" id="tm-' + id + 'celab" x="' +
           (X(capEdge) - 8) + '" y="' + (WV.rows[1] - 30) + '" style="display:none">' +
           (setup ? "the edge that captures, " + ps(capEdge) : "the same edge, " + ps(capEdge)) + "</text>");
    o.push('<line class="tm-warr" id="tm-' + id + 'ae" x1="' + X(arrival) + '" y1="' + (WV.rows[2] - 34) +
           '" x2="' + X(arrival) + '" y2="' + (WV.rows[2] + 34) + '" style="display:none"/>');
    o.push('<text class="tm-warrlab tm-endlab" id="tm-' + id + 'aelab" x="' + (X(arrival) - 8) + '" y="' +
           (WV.rows[2] - 40) + '" style="display:none">data changes, ' + ps(arrival) + "</text>");

    /* the gap between the data edge and the window: the slack */
    var sLo = Math.min(arrival, required), sHi = Math.max(arrival, required);
    var sy = WV.rows[2] + 74;
    o.push('<g id="tm-' + id + 'slackg" style="display:none">' +
           '<line class="tm-slackline" x1="' + X(sLo).toFixed(1) + '" y1="' + sy + '" x2="' + X(sHi).toFixed(1) +
           '" y2="' + sy + '"/>' +
           '<line class="tm-slackline" x1="' + X(sLo).toFixed(1) + '" y1="' + (sy - 6) + '" x2="' + X(sLo).toFixed(1) +
           '" y2="' + (sy + 6) + '"/>' +
           '<line class="tm-slackline" x1="' + X(sHi).toFixed(1) + '" y1="' + (sy - 6) + '" x2="' + X(sHi).toFixed(1) +
           '" y2="' + (sy + 6) + '"/>' +
           '<text class="tm-slacklab" id="tm-' + id + 'slacklab" x="' + ((X(sLo) + X(sHi)) / 2).toFixed(1) +
           '" y="' + (sy - 12) + '" text-anchor="middle"></text></g>');

    /* the time axis */
    var step = setup ? 250 : 100;
    for (var t = 0; t <= span - step / 2; t += step) {
      o.push('<line class="tm-tick" x1="' + X(t) + '" y1="' + (WV.H - 44) + '" x2="' + X(t) + '" y2="' + (WV.H - 38) + '"/>');
      o.push('<text class="pl-tick pl-tick-x" x="' + X(t) + '" y="' + (WV.H - 24) + '">' + t + "</text>");
    }
    o.push('<line class="pl-grid" x1="' + x0 + '" y1="' + (WV.H - 44) + '" x2="' + x1 + '" y2="' + (WV.H - 44) + '"/>');
    o.push('<text class="pl-axis pl-axis-x" x="' + ((x0 + x1) / 2) + '" y="' + (WV.H - 6) +
           '">picoseconds after the clock edge leaves the port</text>');
    o.push("</svg>");

    return o.join("") +
      '<div class="gp-readout" id="tm-' + id + 'read">' +
      '<span>data arrival <b id="tm-' + id + 'arrv">-</b></span>' +
      '<span>data required <b id="tm-' + id + 'reqv">-</b></span>' +
      '<span>slack <b id="tm-' + id + 'slackv">-</b></span>' +
      '<button class="ff-reset" type="button" id="tm-' + id + 'replay">replay</button></div>' +
      '<div class="ff3-legend">' +
      '<span><i class="pl-sw tm-sw-wclk"></i>the clock, as each flip-flop sees it</span>' +
      '<span><i class="pl-sw tm-sw-wdat"></i>the data at the capturing input</span>' +
      '<span><i class="pl-sw tm-sw-win"></i>the window the flip-flop needs it steady in</span></div>';
  }

  function waveAnimate(M, mode, figId) {
    var root = document.getElementById(figId);
    if (!root) return;
    var setup = mode === "setup", id = setup ? "s" : "h";
    var arrival = setup ? M.arrival : M.holdArrival;
    var required = setup ? M.required : M.holdRequired;
    var slack = setup ? M.slack : M.holdSlack;
    var capEdge = setup ? M.period + M.capture : M.capture;
    var g = function (k) { return document.getElementById("tm-" + id + k); };
    var say = g("say"), timers = [];
    function later(ms, fn) { timers.push(setTimeout(fn, ms)); }
    function show(k, on) { var el = g(k); if (el) el.style.display = on ? "" : "none"; }

    function play() {
      timers.forEach(clearTimeout);
      timers = [];
      ["wl", "wc", "wd", "le", "lelab", "ce", "celab", "ae", "aelab", "win", "winlab", "slackg"]
        .forEach(function (k) { show(k, false); });
      ["arrv", "reqv", "slackv"].forEach(function (k) { if (g(k)) { g(k).textContent = "-"; g(k).className = ""; } });
      if (say) say.textContent = "the clock, as the flip-flop that launches the data sees it";

      later(600, function () {
        show("wl", true); show("le", true); show("lelab", true);
        if (say) say.textContent = "this edge, " + ps(M.launch) + " after the clock port, is what " +
          "launches the data";
      });
      later(1900, function () {
        show("wd", true); show("ae", true); show("aelab", true);
        if (g("arrv")) g("arrv").textContent = ps(arrival);
        if (say) say.textContent = setup
          ? "the data crosses " + DATA.length + " stages and changes at " + ps(arrival)
          : "this path is short: the data changes again only " + M.holdData + " ps later, at " + ps(arrival);
      });
      later(3300, function () {
        show("wc", true); show("ce", true); show("celab", true);
        if (say) say.textContent = setup
          ? "the capturing flip-flop's clock runs " + M.capture + " ps behind the port, so the edge " +
            "that has to capture this data is at " + ps(capEdge)
          : "the capturing edge is the same one that launched the data, " + ps(capEdge) + " after the port";
      });
      later(4700, function () {
        show("win", true); show("winlab", true);
        if (g("reqv")) g("reqv").textContent = ps(required);
        if (say) say.textContent = setup
          ? "the flip-flop needs its input steady for " + OPT.setupTimePs + " ps before that edge: " +
            "nothing may change inside the shaded window"
          : "and steady for " + OPT.holdTimePs + " ps after it, while it finishes capturing the old value";
      });
      later(6100, function () {
        show("slackg", true);
        var ok = slack >= 0;
        var lab = g("slacklab");
        if (lab) {
          lab.textContent = (slack >= 0 ? "+" : "") + Math.round(slack) + " ps " + (ok ? "(MET)" : "(VIOLATED)");
          lab.setAttribute("class", "tm-slacklab " + (ok ? "tm-ok-t" : "tm-bad-t"));
        }
        if (g("slackv")) {
          g("slackv").textContent = (slack >= 0 ? "+" : "") + Math.round(slack) + " ps";
          g("slackv").className = ok ? "cts-h-good" : "cts-h-bad";
        }
        if (say) say.textContent = setup
          ? "the data edge lands " + Math.round(slack) + " ps clear of the window. That gap is the " +
            "slack, and this is the worst path in the design, so it is the design's slack."
          : "the data edge lands " + Math.round(slack) + " ps after the window closes. For hold the " +
            "slack is measured the other way round, and it is met.";
      });
    }

    var replay = g("replay");
    if (replay && !replay.dataset.wired) {
      replay.dataset.wired = "1";
      replay.addEventListener("click", play);
    }
    play();
  }

  /* ----- step 6: every endpoint, as a distribution and as a place -----
     The same list of endpoints drawn twice: sorted into slack bins, and
     left where they physically are. A threshold sweeps across both at
     once, which is the same as asking what would fail if the clock were
     tightened by that much. */
  function histFigure(M) {
    var W = 740, H = 262, ml = 56, mr = 24, mt = 46, mb = 62;
    var peak = Math.max.apply(null, M.bins);
    var bw = (W - ml - mr) / M.bins.length;
    function X(sl) { return ml + ((sl - M.binLo) / (M.binHi - M.binLo)) * (W - ml - mr); }
    var o = ['<svg viewBox="0 0 ' + W + " " + H + '" class="ff3-svg tm-hist" role="img" ' +
             'aria-label="How much slack every endpoint in the design has, with a threshold that ' +
             'sweeps from the worst endpoint upwards">'];
    o.push('<text class="ff3-cap" x="12" y="20">every endpoint in the design, by how much slack it has</text>');
    o.push('<text class="ff3-cap tm-say" x="12" y="38" id="tm-hsay">press play</text>');
    o.push('<text class="pl-axis" x="' + (W - mr) + '" y="' + (mt - 10) +
           '" text-anchor="end">number of endpoints</text>');
    M.bins.forEach(function (c, i) {
      var h = (c / peak) * (H - mt - mb);
      o.push('<rect class="tm-hbar" data-hb="' + i + '" x="' + (ml + i * bw + 1).toFixed(1) +
             '" y="' + (H - mb - h).toFixed(1) + '" width="' + (bw - 2).toFixed(1) +
             '" height="' + h.toFixed(1) + '" rx="2"/>');
    });
    o.push('<line class="pl-grid" x1="' + ml + '" y1="' + (H - mb) + '" x2="' + (W - mr) + '" y2="' + (H - mb) + '"/>');
    for (var v = 0.2; v < M.binHi; v += 0.2) {
      o.push('<text class="pl-tick pl-tick-x" x="' + X(v).toFixed(1) + '" y="' + (H - mb + 18) + '">' + f1(v) + "</text>");
    }
    o.push('<text class="pl-tick pl-tick-x" x="' + ml + '" y="' + (H - mb + 34) + '">' + f2(M.binLo) + "</text>");
    o.push('<text class="pl-axis pl-axis-x" x="' + ((ml + W - mr) / 2) + '" y="' + (H - 12) +
           '">slack, nanoseconds</text>');
    /* the sweeping threshold */
    o.push('<line class="tm-thr" id="tm-thr" x1="' + ml + '" y1="' + mt + '" x2="' + ml +
           '" y2="' + (H - mb) + '" style="display:none"/>');
    o.push('<line class="tm-wns" x1="' + (ml + 1) + '" y1="' + mt + '" x2="' + (ml + 1) + '" y2="' + (H - mb) + '"/>');
    o.push('<text class="tm-note tm-note-cpl" x="' + (ml + 8) + '" y="' + (mt + 12) +
           '">the worst one, ' + f2(M.binLo) + " ns: this is the design's slack</text>");
    o.push("</svg>");
    return o.join("");
  }

  function epMapFigure(M) {
    var marks = M.eps.map(function (e, i) {
      return '<circle class="tm-ep" data-ep="' + i + '" cx="' + e.x.toFixed(1) + '" cy="' + e.y.toFixed(1) +
             '" r="3.2"/>';
    }).join("");
    return FS.plan(core(), {
      macros: true, pins: true,
      cells: { core: marks },
      aria: "Every sampled endpoint drawn where it sits in the block, so that the ones with the " +
            "least slack can be seen to cluster",
    });
  }

  function histAnimate(M) {
    var root = document.getElementById("flow-fig-6");
    if (!root) return;
    var bars = [].slice.call(root.querySelectorAll(".tm-hbar"));
    var dots = [].slice.call(root.querySelectorAll(".tm-ep"));
    var thr = document.getElementById("tm-thr");
    if (!bars.length || !dots.length) return;
    var say = document.getElementById("tm-hsay");
    var thrEl = document.getElementById("tm-thrv");
    var perEl = document.getElementById("tm-perv");
    var cntEl = document.getElementById("tm-cntv");
    var replay = document.getElementById("tm-hreplay");
    var timer = null;
    var ml = 56, mr = 24, W = 740;
    function X(sl) { return ml + ((sl - M.binLo) / (M.binHi - M.binLo)) * (W - ml - mr); }
    var binW = (M.binHi - M.binLo) / M.bins.length;

    function draw(t) {
      if (thr) {
        thr.style.display = "";
        thr.setAttribute("x1", X(t).toFixed(1));
        thr.setAttribute("x2", X(t).toFixed(1));
      }
      var under = 0;
      dots.forEach(function (el, i) {
        var below = M.eps[i].slack <= t;
        el.classList.toggle("tm-ep-under", below);
        if (below) under += 1;
      });
      bars.forEach(function (el, i) {
        el.classList.toggle("tm-hbar-under", M.binLo + (i + 1) * binW <= t);
      });
      var scaled = Math.round(under * M.endpoints / M.eps.length);
      if (thrEl) thrEl.textContent = f2(t) + " ns";
      if (perEl) perEl.textContent = f2(M.period / 1000 - t) + " ns";
      if (cntEl) cntEl.textContent = fmt(scaled);
      if (say) {
        say.textContent = t <= M.binLo + 0.005
          ? "at the clock it was built for, exactly one endpoint is at the limit: the path from step 4"
          : "tighten the clock to " + f2(M.period / 1000 - t) + " nanoseconds and " + fmt(scaled) +
            " endpoints fail. On the die they are not scattered: they are where the hub is.";
      }
    }

    function play() {
      if (timer) clearInterval(timer);
      var t = M.binLo, top = M.binLo + 0.62, stepv = (top - M.binLo) / 46;
      draw(t);
      timer = setInterval(function () {
        t += stepv;
        if (t >= top) { t = top; clearInterval(timer); timer = null; }
        draw(t);
      }, 130);
    }

    if (replay && !replay.dataset.wired) {
      replay.dataset.wired = "1";
      replay.addEventListener("click", play);
    }
    play();
  }

  /* ----- step 7: what the block costs ----- */
  function powerFigure(M) {
    var W = 720, H = 190, ml = 150, mr = 110;
    var p = M.power, max = p.total;
    var rows = [
      { k: "the clock network", v: p.clock, c: "tm-p-clk" },
      { k: "switching the signals", v: p.switching, c: "tm-p-sw" },
      { k: "inside the cells", v: p.internal, c: "tm-p-int" },
      { k: "leakage", v: p.leakage, c: "tm-p-leak" },
    ];
    var o = ['<svg viewBox="0 0 ' + W + " " + H + '" class="ff3-svg tm-power" role="img" ' +
             'aria-label="Where the block\'s power goes, with the clock network as the largest single part">'];
    o.push('<text class="ff3-cap" x="12" y="20">where the ' + f1(p.total * 1000) +
           " milliwatts go, from the capacitance extraction just measured</text>");
    rows.forEach(function (r, i) {
      var y = 40 + i * 32;
      o.push('<text class="tm-lab" x="' + (ml - 12) + '" y="' + (y + 13) + '">' + r.k + "</text>");
      o.push('<rect class="' + r.c + '" x="' + ml + '" y="' + y + '" width="' +
             ((r.v / max) * (W - ml - mr)).toFixed(1) + '" height="18" rx="3"/>');
      o.push('<text class="tm-val" x="' + (ml + (r.v / max) * (W - ml - mr) + 8).toFixed(1) + '" y="' +
             (y + 13) + '">' + f1(r.v * 1000) + " mW, " + Math.round(100 * r.v / p.total) + "%</text>");
    });
    o.push("</svg>");
    return o.join("") +
      '<div class="ff3-legend"><span>the clock is the one net that switches every cycle, everywhere, ' +
      "which is why it is the largest single consumer in almost every synchronous design</span></div>";
  }

  STEPS.push({
    n: 4, title: "Arrival against required", button: "Check setup", againLabel: "Check again",
    line: "The data arrived at some time. Work out the time it had to arrive by, and subtract.",
    intro:
      "<p>This is the question the whole flow exists to answer, and it has only two halves.</p>" +
      "<p><strong>Arrival</strong> is the number the last step produced: when the data actually reaches " +
      "the capturing flip-flop's input. <strong>Required</strong> is when it had to be there. For a " +
      "setup check that is the <em>next</em> clock edge, one period later, plus however long that edge " +
      "takes to reach the capturing flip-flop, minus the time the flip-flop needs its input steady " +
      "before the edge. <strong>Slack</strong> is required minus arrival, and the design passes if it " +
      "is not negative.</p>" +
      "<p>Notice what is in the required side: the capture clock's own delay through the tree. That is " +
      "why skew matters. If the capturing flip-flop's clock is early relative to the launching one, " +
      "the required time moves left and the path has less time, without anything about the logic " +
      "changing.</p>",
    command:
      "report_checks -path_delay max -slack_max 0 -group_count 1\n" +
      "report_worst_slack",
    commandNote:
      "<code>-slack_max 0</code> asks only for paths that fail, which is usually how the command is " +
      "used: on a design that meets timing it prints nothing at all. <code>report_worst_slack</code> " +
      "prints the single number the whole stage is judged on.",
    run: function () {
      var M = model();
      var text =
        "                        " + M.arrival.toFixed(2) + "   data arrival time\n" +
        "\n" +
        "   " + M.period.toFixed(2) + "  " + M.period.toFixed(2) + "   clock clk (rise edge)\n" +
        "   " + M.capture.toFixed(2) + "  " + (M.period + M.capture).toFixed(2) +
        "   clock network delay (propagated)\n" +
        "  " + (-OPT.setupTimePs).toFixed(2) + "  " + M.required.toFixed(2) + "   library setup time\n" +
        "                        " + M.required.toFixed(2) + "   data required time\n" +
        "---------------------------------------------------------------\n" +
        "                        " + M.required.toFixed(2) + "   data required time\n" +
        "                       -" + M.arrival.toFixed(2) + "   data arrival time\n" +
        "---------------------------------------------------------------\n" +
        "                        " + M.slack.toFixed(2) + "   slack (MET)";
      return {
        log: [
          { k: "cmd", t: "report_checks -path_delay max -slack_max 0 -group_count 1" },
          { k: "out", t: "  no violating paths: nothing is reported" },
          { k: "cmd", t: "report_worst_slack" },
          { k: "out", t: "  worst slack max " + (M.slack / 1000).toFixed(2) },
          { k: "ok", t: "Setup is met, with " + Math.round(M.slack) + " picoseconds to spare." },
        ],
        figure: '<p class="ff3-figtext">Watch the two halves being built. The data bar is the path from ' +
          "the last step, ending at " + ps(M.arrival) + ". Then the next clock edge arrives at the " +
          "port, takes " + M.capture + " picoseconds to reach the capturing flip-flop, and the " +
          "flip-flop's own setup requirement is taken off the end of that. What is left between the " +
          "two marks is the slack.</p>" + waveFigure(M, "setup") +
          '<pre class="pl-report">' + esc(text) + "</pre>",
        after: function () { waveAnimate(M, "setup", "flow-fig-4"); },
        report: "<h3>The setup check, in full</h3>" + table([
          ["Data arrival", ps(M.arrival) + " (" + M.launch + " clock plus " + M.data + " data)"],
          ["Next clock edge", M.period + " ps, one period after the launching edge"],
          ["Capture clock delay", "+" + M.capture + " ps through the tree"],
          ["Library setup time", "−" + OPT.setupTimePs + " ps, the flip-flop's own requirement"],
          ["Data required", ps(M.required)],
          ["Slack", "+" + Math.round(M.slack) + " picoseconds, met"],
          ["Before extraction", "+" + Math.round(M.estSlack) + " picoseconds, which is what routing reported"],
        ]) + checks([
          ["The number moved, and nothing was changed.",
           "Routing signed off this path at " + (M.estSlack / 1000).toFixed(2) + " nanoseconds. On " +
           "extracted parasitics it is " + (M.slack / 1000).toFixed(2) + ". The difference is coupling " +
           "capacitance the router's estimate could not include. A flow whose sign-off number is far " +
           "below its optimizer's number has estimates that need work, because the optimizer spent its " +
           "effort against the wrong target."],
          ["Skew is inside the required time.",
           "The capture clock's " + M.capture + " picoseconds is added to the required side, and the " +
           "launch clock's " + M.launch + " is added to the arrival side. Only the difference matters, " +
           "which is why the clock tree stage worked so hard to make them nearly equal."],
          ["Slack is a margin, not a score.",
           "There is no prize for a large positive slack: it means the design could have run faster, or " +
           "used smaller and lower-power cells. There is also no such thing as slightly negative: a " +
           "path that fails is a chip that does not work at that frequency."],
        ]),
      };
    },
  });

  STEPS.push({
    n: 5, title: "The other check", button: "Check hold", againLabel: "Check again",
    line: "A path can also be too fast, and that failure cannot be fixed by slowing the clock.",
    intro:
      "<p>Setup asks whether the data arrives before the <em>next</em> edge. Hold asks whether it " +
      "arrives after the <em>current</em> one has finished its work. A flip-flop needs its old input " +
      "to stay steady for a short time after its clock edge, and if a short path delivers new data " +
      "into that window, the flip-flop captures the new value a cycle early.</p>" +
      "<p>The two checks behave completely differently. Setup gets easier if you slow the clock down, " +
      "because the next edge moves further away. Hold does not move at all: it is a race between two " +
      "flip-flops against the same edge, so a hold failure is a broken chip at every frequency, " +
      "including very slow ones. That is why hold is repaired by inserting delay, and why the clock " +
      "tree example spent a whole step on it.</p>",
    command:
      "report_checks -path_delay min -fields {slew cap input net fanout} -format full_clock_expanded",
    commandNote:
      "<code>-path_delay min</code> asks for the fastest paths rather than the slowest, and the report " +
      "has the same shape with the comparison the other way round: required time at the bottom is a " +
      "floor, not a ceiling.",
    run: function () {
      var M = model();
      var run = 0, lines = [];
      lines.push("Startpoint: hub/acc_reg[6] (rising edge-triggered flip-flop clocked by clk)");
      lines.push("Endpoint: hub/acc_reg[7] (rising edge-triggered flip-flop clocked by clk)");
      lines.push("Path Group: clk");
      lines.push("Path Type: min");
      lines.push("");
      lines.push("  Delay    Time   Description");
      lines.push("---------------------------------------------------------------");
      LAUNCH.forEach(function (st) {
        run += st.d;
        lines.push("  " + String(st.d.toFixed(2)).padStart(5) + "  " + String(run.toFixed(2)).padStart(6) +
                   " ^ " + st.cell);
      });
      HOLD_DATA.forEach(function (st) {
        run += st.d;
        lines.push("  " + String(st.d.toFixed(2)).padStart(5) + "  " + String(run.toFixed(2)).padStart(6) +
                   " ^ " + st.cell);
      });
      lines.push("          " + String(M.holdArrival.toFixed(2)).padStart(6) + "   data arrival time");
      lines.push("");
      lines.push("   " + M.capture.toFixed(2) + "  " + M.capture.toFixed(2) + "   clock network delay (propagated)");
      lines.push("   " + OPT.holdTimePs.toFixed(2) + "  " + M.holdRequired.toFixed(2) + "   library hold time");
      lines.push("          " + M.holdRequired.toFixed(2) + "   data required time");
      lines.push("---------------------------------------------------------------");
      lines.push("          " + M.holdArrival.toFixed(2) + "   data arrival time");
      lines.push("         -" + M.holdRequired.toFixed(2) + "   data required time");
      lines.push("---------------------------------------------------------------");
      lines.push("           " + M.holdSlack.toFixed(2) + "   slack (MET)");
      return {
        log: [
          { k: "cmd", t: "report_checks -path_delay min -fields {slew cap input net fanout} -format full_clock_expanded" },
          { k: "out", t: "  Startpoint: hub/acc_reg[6]" },
          { k: "out", t: "  Endpoint: hub/acc_reg[7]" },
          { k: "out", t: "  data arrival " + M.holdArrival + " ps, required " + M.holdRequired + " ps" },
          { k: "out", t: "  slack (MET) " + M.holdSlack + " ps" },
          { k: "ok", t: "Hold is met on the shortest path in the block." },
        ],
        figure: '<p class="ff3-figtext">The same drawing as the setup check, with one difference that ' +
          "changes everything: the capturing edge is not the next one, it is the same edge that " +
          "launched the data. There is no period in the required time at all, so the whole check " +
          "happens inside " + Math.round(M.holdRequired) + " picoseconds, and slowing the clock down " +
          "would not move any of it.</p>" + waveFigure(M, "hold") +
          '<pre class="pl-report">' + esc(lines.join("\n")) + "</pre>",
        after: function () { waveAnimate(M, "hold", "flow-fig-5"); },
        report: "<h3>The hold check, in full</h3>" + table([
          ["Data arrival", ps(M.holdArrival) + " (" + M.launch + " clock plus " + M.holdData + " data)"],
          ["Capture clock delay", M.capture + " ps, the same edge"],
          ["Library hold time", "+" + OPT.holdTimePs + " ps"],
          ["Data required", ps(M.holdRequired) + ", a floor rather than a ceiling"],
          ["Slack", "+" + Math.round(M.holdSlack) + " picoseconds, met"],
          ["Why it is met", fmt(Math.round(M.cts.flops * 0.021 * 1.6)) +
            " hold buffers were inserted after clock tree synthesis, for exactly this"],
        ]) + checks([
          ["Hold does not care about the clock period.",
           "Every term in the required time is a clock tree delay or a library requirement. Change the " +
           "period from " + (M.period / 1000).toFixed(1) + " nanoseconds to ten and this check is " +
           "identical. That is the practical difference between the two: setup limits how fast the " +
           "chip runs, hold decides whether it runs at all."],
          ["Skew creates hold violations.",
           "If the capturing flip-flop's clock arrives later than the launching one, the required time " +
           "moves right while the arrival stays put. A perfectly balanced tree would make hold nearly " +
           "free; the " + f1(M.skewExt) + " picoseconds of skew measured in step 2 is what the hold " +
           "buffers were paying for."],
          ["Both checks, every path, every corner.",
           "This example shows the worst of each. Sign-off runs both over every path in the design, in " +
           "every corner and mode, which is the next step for this block and a compute farm for a " +
           "real one."],
        ]),
      };
    },
  });

  STEPS.push({
    n: 6, title: "Every endpoint at once", button: "Report the design", againLabel: "Report again",
    line: "Two paths are an anecdote. Sign-off is the whole distribution.",
    intro:
      "<p>The last two steps looked at one path each: the worst for setup and the worst for hold. That " +
      "is where the design's numbers come from, but it is not the whole picture. A design with one " +
      "failing path needs one fix; a design with four thousand failing paths needs a different " +
      "floorplan.</p>" +
      "<p>So the stage reports the distribution as well as the extreme: the worst negative slack, the " +
      "total negative slack summed over every failing endpoint, and the electrical checks that are " +
      "not about timing at all, where a net's slew or capacitance is outside what the library " +
      "guarantees.</p>",
    command:
      "report_wns\n" +
      "report_tns\n" +
      "report_worst_slack\n" +
      "report_clock_min_period\n" +
      "report_check_types -max_slew -max_capacitance -max_fanout -violators",
    commandNote:
      "This is the set the reference flow writes into its own report at the end of every stage, which " +
      "is how you compare a design against itself over the run. Worst negative slack is the single " +
      "worst path; total negative slack adds up every violating endpoint, so it says how much work is " +
      "left rather than how bad the worst case is.",
    run: function () {
      var M = model();
      var minPeriod = (M.period - M.slack) / 1000;
      return {
        log: [
          { k: "cmd", t: "report_wns" },
          { k: "out", t: "  wns max " + (M.slack >= 0 ? "0.00" : (M.slack / 1000).toFixed(2)) },
          { k: "cmd", t: "report_tns" },
          { k: "out", t: "  tns max 0.00" },
          { k: "cmd", t: "report_worst_slack" },
          { k: "out", t: "  worst slack max " + (M.slack / 1000).toFixed(2) },
          { k: "cmd", t: "report_clock_min_period" },
          { k: "out", t: "  clk period_min = " + minPeriod.toFixed(2) + " fmax = " +
                         (1000 / minPeriod).toFixed(2) },
          { k: "cmd", t: "report_check_types -max_slew -max_capacitance -max_fanout -violators" },
          { k: "out", t: "  max slew violations: 0" },
          { k: "out", t: "  max capacitance violations: 0" },
          { k: "out", t: "  max fanout violations: 0" },
          { k: "ok", t: "No endpoint fails, and no net is outside what the library guarantees." },
        ],
        figure: '<p class="ff3-figtext">Every endpoint in the design, sorted into bins by how much ' +
          "slack it has. The leftmost bar is the path from step 4, and it is the only number that gets " +
          "quoted, but the shape behind it is what tells you how the design is doing. A tall pile far " +
          "from zero means the design is loafing and could be smaller, slower or cheaper. A long tail " +
          "leaning into zero means there is no margin anywhere, and the next small change will break " +
          "something.</p>" + histFigure(M) +
          '<p class="ff3-figtext">The same endpoints, drawn where they physically are. Watch the ' +
          "threshold sweep: it asks what would fail if the clock were tightened, and the endpoints it " +
          "catches are not scattered across the block. They are in the middle, where the hub is and " +
          "where the longest chains of logic end, which is the kind of thing a distribution alone " +
          "cannot tell you and a floorplan change might fix.</p>" + epMapFigure(M) +
          '<div class="gp-readout" id="tm-hread">' +
          '<span>threshold <b id="tm-thrv">-</b></span>' +
          '<span>clock tightened to <b id="tm-perv">-</b></span>' +
          '<span>endpoints that would fail <b id="tm-cntv">-</b></span>' +
          '<button class="ff-reset" type="button" id="tm-hreplay">replay</button></div>' +
          '<div class="ff3-legend">' +
          '<span><i class="pl-sw tm-sw-ep"></i>an endpoint with slack to spare</span>' +
          '<span><i class="pl-sw tm-sw-epu"></i>an endpoint the threshold has caught</span>' +
          "<span>" + fmt(M.eps.length) + " drawn of " + fmt(M.endpoints) + "</span></div>",
        after: function () { histAnimate(M); },
        report: "<h3>The design as a whole</h3>" + table([
          ["Endpoints", fmt(M.endpoints) + ", every flip-flop input and output port"],
          ["Worst negative slack", "0.00, because nothing is negative"],
          ["Total negative slack", "0.00"],
          ["Worst slack", (M.slack / 1000).toFixed(2) + " nanoseconds, the path from step 4"],
          ["Minimum clock period", minPeriod.toFixed(2) + " nanoseconds, so " +
            (1000 / minPeriod).toFixed(0) + " megahertz is the most this block would run at"],
          ["Electrical violations", "none: no net exceeds the library's slew, capacitance or fanout limits"],
        ]) + checks([
          ["Worst and total answer different questions.",
           "Worst negative slack tells you how far the worst path is from working. Total negative slack " +
           "tells you how many paths are in trouble and by how much altogether. A design can have a " +
           "small worst negative slack and an enormous total, which means a systematic problem rather " +
           "than one bad path."],
          ["The margin is real but modest.",
           "This block would run at " + (1000 / minPeriod).toFixed(0) + " megahertz against the " +
           (1000 / (M.period / 1000)).toFixed(0) + " it was constrained to. That is about " +
           Math.round(100 * M.slack / M.period) + "% of headroom, which in a single corner with no " +
           "variation modelling is not much: the next step's closing note is about what would eat it."],
          ["The electrical checks are not timing.",
           "A slew or capacitance violation means a net is outside the conditions the library " +
           "characterised, so every delay computed on it is an extrapolation. They are reported here " +
           "because a timing number on a net like that cannot be trusted at all."],
        ]),
      };
    },
  });

  STEPS.push({
    n: 7, title: "Sign off and write out", button: "Finish the design", againLabel: "Write again",
    line: "Report what the block costs, then write the files the rest of the world wants.",
    intro:
      "<p>The timing is proven, so what remains is to say what the block costs and to write it out in " +
      "the formats other tools read.</p>" +
      "<p>Power comes almost free at this point, because it is computed from the same extracted " +
      "capacitance the timing used: how much charge moves, how often, at what voltage. The files are " +
      "the last artefacts of the flow: a layout for the foundry, a netlist for whoever verifies it, " +
      "and a parasitics file so that anyone can reproduce these timing numbers exactly.</p>",
    command:
      "report_power\n" +
      "report_design_area\n" +
      "report_cell_usage\n" +
      "\n" +
      "# the files that leave the flow\n" +
      "write_def tile4m_final.def\n" +
      "write_verilog tile4m_final.v -remove_cells [find_physical_only_masters]\n" +
      "write_db tile4m_final.odb",
    commandNote:
      "<code>write_verilog</code> drops the physical-only cells, the fillers and taps and diodes, " +
      "because the netlist is for logical comparison against the design that was synthesized, and " +
      "those cells connect nothing. The stream file the foundry actually receives is written " +
      "afterwards, in the finishing example, by a layout tool reading this database and every cell's " +
      "real layout.",
    run: function () {
      var M = model(), p = M.power;
      var cellArea = M.z.fg.cellArea + 10215 + M.cts.area;
      var util = 100 * cellArea / (M.z.coreArea - M.z.fg.macroArea);
      return {
        log: [
          { k: "cmd", t: "report_power" },
          { k: "out", t: "  Group          Internal  Switching    Leakage      Total" },
          { k: "out", t: "  Clock          " + f1(p.clock * 1000 * 0.55).padStart(8) +
                         f1(p.clock * 1000 * 0.45).padStart(11) + "     0.00" +
                         f1(p.clock * 1000).padStart(11) },
          { k: "out", t: "  Combinational  " + f1(p.internal * 1000 * 0.4).padStart(8) +
                         f1(p.switching * 1000 * 0.6).padStart(11) +
                         f1(p.leakage * 1000 * 0.7).padStart(11) +
                         f1((p.internal * 0.4 + p.switching * 0.6 + p.leakage * 0.7) * 1000).padStart(11) },
          { k: "out", t: "  Sequential     " + f1(p.internal * 1000 * 0.6).padStart(8) +
                         f1(p.switching * 1000 * 0.4).padStart(11) +
                         f1(p.leakage * 1000 * 0.3).padStart(11) +
                         f1((p.internal * 0.6 + p.switching * 0.4 + p.leakage * 0.3) * 1000).padStart(11) },
          { k: "out", t: "  Total          " + f1(p.total * 1000).padStart(41) + " mW" },
          { k: "cmd", t: "report_design_area" },
          { k: "out", t: "  Design area " + Math.round(cellArea) + " um^2 " + Math.round(util) + "% utilization." },
          { k: "cmd", t: "report_cell_usage" },
          { k: "out", t: "  " + fmt(M.R.insts) + " instances, plus " +
                         fmt(Math.round(M.R.insts * 0.32)) + " fillers and " + fmt(M.z.fg.cells > 0 ? 1128 : 0) + " taps" },
          { k: "cmd", t: "write_def tile4m_final.def" },
          { k: "cmd", t: "write_verilog tile4m_final.v -remove_cells [find_physical_only_masters]" },
          { k: "cmd", t: "write_db tile4m_final.odb" },
          { k: "ok", t: "Signed off. The block meets its clock, and the files are written." },
        ],
        figure: '<p class="ff3-figtext">Power falls out of the same extraction the timing used. The ' +
          "clock is the largest single part of it, because it is the one network that switches " +
          "everywhere, every cycle, whether or not the logic it feeds is doing anything. That is the " +
          "cost of the tree the clock tree example built, and the reason real designs spend so much " +
          "effort switching parts of it off.</p>" + powerFigure(M),
        report: "<h3>What leaves the flow</h3>" + table([
          ["Timing", "setup met by " + (M.slack / 1000).toFixed(2) + " nanoseconds, hold met by " +
            (M.holdSlack / 1000).toFixed(2)],
          ["Power", f1(p.total * 1000) + " milliwatts, of which " +
            Math.round(100 * p.clock / p.total) + "% is the clock"],
          ["Area", fmt(Math.round(cellArea)) + " square micrometers of cells, " +
            Math.round(util) + "% of the core"],
          ["<code>tile4m_final.def</code>", "the layout: every cell placed, every net routed"],
          ["<code>tile4m_final.v</code>", "the netlist, without the physical-only cells"],
          ["<code>tile4m.spef</code>", "the parasitics, so these numbers can be reproduced"],
          ["Still to come", 'fill, the real layout of every cell, the rule deck and the comparison to ' +
            'the netlist: the <a href="/explore/examples/finish">finishing example</a>'],
        ]) + checks([
          ["The design is done; the sign-off is not.",
           "Design rule checking and layout-versus-schematic run outside this tool, against the " +
           "foundry's decks rather than the router's rules. A block can be timing clean and still fail " +
           "them, which is why tapeout checklists treat them as separate gates."],
          ["Every number here belongs to one corner.",
           "One process corner, one voltage, one temperature, one mode, and no variation modelling. " +
           "The closing note below is about what a production sign-off adds, and it is the largest gap " +
           "between this example and a real one."],
          ["One stage is left.",
           'This block started as a rectangle with four memories in the <a href="/explore/examples/' +
           'floorplan">floorplan example</a>. It is now a layout that meets its clock. The ' +
           '<a href="/explore/examples/finish">finishing example</a> takes it the rest of the way, to a ' +
           "file a foundry can build."],
        ]),
      };
    },
  });

  var STAGE = {
    key: "timing",
    steps: STEPS,
    finishedTitle: "Signed off.",
    finishedNote: "The block meets its clock on extracted parasitics. One stage is left: " +
      '<a href="/explore/examples/finish">finishing</a>, which fills the empty metal, re-times the block ' +
      "with it, writes out every cell's real layout, and checks the result against the process's rules " +
      "and against the netlist.",
    epilogue:
      "<h3>How this differs from a production sign-off</h3>" +
      "<p>The mechanics are real: arrival, required, slack, and the two checks. What a production " +
      "sign-off adds is almost all about <em>how many times</em> it asks the same question:</p>" +
      '<ul class="ff-checks">' +
      "<li><strong>Corners and modes.</strong> This example used one corner and one mode. A real " +
      "block is signed off across a matrix of process corners, voltages and temperatures, in every " +
      "functional and test mode, which is tens to hundreds of full analyses. A path that passes in " +
      "the typical corner routinely fails in another.</li>" +
      "<li><strong>Variation.</strong> Two identical gates on the same die are not identical. Sign-off " +
      "derates delays, or models them statistically, and credits back the part of the clock path the " +
      "two ends share. That credit is the clock reconvergence pessimism line, which reads 0.00 here " +
      "because this model has no variation in it at all.</li>" +
      "<li><strong>Crosstalk.</strong> The coupling capacitance extracted in step 1 does more than add " +
      "delay: a neighbour switching the other way at the wrong moment changes this net's delay, and " +
      "can inject a glitch that looks like data. Signal integrity analysis is a separate pass over the " +
      "same parasitics, and it is why coupling is extracted separately rather than lumped into one " +
      "capacitance per net.</li>" +
      "<li><strong>The loop back.</strong> When sign-off fails, the fix is an engineering change " +
      "order: a minimal, local edit to a finished layout, re-routed and re-extracted, rather than " +
      "another pass of the flow. Getting from nearly closed to closed is often most of the schedule, " +
      "and this example ends at the first pass.</li></ul>",
    footNote: 'Walk paths by hand in the <a href="/explore/algorithms/timing">timing sandbox</a> (in the works). ' +
      'Next: the <a href="/explore/examples/finish">finishing example</a>.',
  };
  if (typeof window !== "undefined" && window.FLOW_PAGE_STAGE === STAGE.key) window.FLOW_STAGE = STAGE;

  return { OPT: OPT, model: model, STAGE: STAGE, STEPS: STEPS, LAUNCH: LAUNCH, DATA: DATA, CAPTURE: CAPTURE, HOLD_DATA: HOLD_DATA };
})();

if (typeof module !== "undefined" && module.exports) module.exports = TimingSteps;
