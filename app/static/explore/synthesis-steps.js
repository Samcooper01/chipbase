/* The synthesis worked example: where tile4m comes from.

   Every other example on this site starts from a gate-level netlist and
   a set of constraints. This one produces them. It reads the register
   transfer level description, turns it into logic, maps that logic onto
   the cells this library actually has, and writes out the file the
   floorplan example opens on its first step.

   The model: a cell count that rises while the logic is broken down
   into primitives and falls while it is covered by library cells, a
   carry chain that can be built two ways, and a small and-inverter
   graph whose covering is the mapping decision in miniature. */

var SynthesisSteps = (function () {
  "use strict";

  var FS = FloorplanSteps;
  var fmt = FS.fmt, f1 = FS.f1, f2 = FS.f2, esc = FS.esc;
  var table = FS.table, checks = FS.checks;

  /* what one thing costs, used by the picture of a single register and
     by the count over the whole design, so the two cannot disagree */
  var COST = {
    gatesPerMux: 4,            /* an inverter, two ANDs and an OR */
    gatesPerAddBit: 5,         /* a full adder in simple gates */
    coverRatio: 1.65,          /* generic gates covered by one library cell */
  };

  var OPT = {
    top: "tile4m",
    abcTargetPs: 2000,          /* abc -D, the clock period in picoseconds */
    flopShare: 0.12,
    flopArea: 4.4,              /* square micrometers, a flip-flop */
    dontUse: "TAPCELL_X1 FILLCELL_X1 AOI211_X1 OAI211_X1 SDFF* CLKGATE*",
  };

  var _M = null;
  function core() { return FS.theModel(); }

  function model() {
    if (_M) return _M;
    var z = core().z;
    var cells = z.fg.cells;                      /* what the flow downstream sees */
    var flops = Math.round(cells * OPT.flopShare);
    var comb = cells - flops;
    var area = z.fg.cellArea;                    /* and the area it reports */
    var flopArea = flops * OPT.flopArea;

    /* ----- the count, pass by pass, built from what the design holds -----
       The design is a few thousand word-level operators and a pile of
       registers. Every number below follows from that and from the per
       object costs above, and the last one has to land on the cell count
       the rest of the flow uses, which is what fixes the gate count. */
    var processes = 1280;                 /* always blocks across the modules */
    var operators = 2400;                 /* word-level adds, compares, muxes */
    var addCells = 420;                   /* of those, the arithmetic */
    var muxBits = 9000;                   /* per-bit muxes once proc has run */
    var addBits = 3800;                   /* bits of arithmetic */
    /* whatever else the boolean expressions come to, fixed by the fact
       that the mapped design has to be the one the floorplan reads */
    var randomGates = Math.round(comb * COST.coverRatio) -
                      muxBits * COST.gatesPerMux - addBits * COST.gatesPerAddBit;

    var elaborate = operators;
    var coarse = flops + muxBits + addCells + randomGates;
    var fine = flops + muxBits * COST.gatesPerMux + addBits * COST.gatesPerAddBit + randomGates;

    var stages = [
      { k: "read and elaborate", cells: elaborate,
        note: fmt(operators) + " word-level operators, plus " + fmt(processes) + " processes" },
      { k: "coarse synthesis", cells: coarse,
        note: fmt(flops) + " registers + " + fmt(muxBits) + " muxes + " + fmt(addCells) +
              " adds + " + fmt(randomGates) + " gates" },
      { k: "technology primitives", cells: fine,
        note: "every mux becomes " + COST.gatesPerMux + " gates, every add bit " + COST.gatesPerAddBit },
      { k: "flip-flops mapped", cells: fine,
        note: "the registers become library cells one for one" },
      { k: "logic mapped", cells: cells,
        note: fmt(comb) + " library cells cover " + fmt(fine - flops) + " gates, about " +
              f2(COST.coverRatio) + " each" },
    ];

    return (_M = {
      z: z, cells: cells, flops: flops, comb: comb, area: area,
      flopArea: flopArea, combArea: area - flopArea,
      nets: z.fg.nets, ports: z.fg.ports, portBits: z.fg.portBits,
      stages: stages, processes: processes, operators: operators, addCells: addCells,
      muxBits: muxBits, addBits: addBits, randomGates: randomGates,
      dff: [
        { gen: "$_DFF_P_", lib: "DFF_X1", n: Math.round(flops * 0.32), why: "no reset: the simplest cell there is" },
        { gen: "$_DFF_PN0_", lib: "DFFR_X1", n: Math.round(flops * 0.61), why: "an active-low reset, which this library has directly" },
        { gen: "$_DFFE_PP_", lib: "DFF_X1 + MUX2_X1", n: Math.round(flops * 0.07), why: "a clock enable, which it does not: built from a cell and a feedback mux" },
      ],
      period: FS.DESIGN.clockPeriodNs,
      aig: aigScene(),
    });
  }

  /* ================= drawing ================= */

  /* source, printed the way an editor would: comments set back, and
     the bodies left out, because this stage is about the structure */
  function codeBlock(lines) {
    return '<pre class="sy-code">' + lines.map(function (l) {
      if (/^\s*(\/\/|\(\*|#)/.test(l)) return '<span class="sy-comment">' + esc(l) + "</span>";
      var at = l.indexOf("#");
      if (at < 0) return esc(l);
      return esc(l.slice(0, at)) + '<span class="sy-comment">' + esc(l.slice(at)) + "</span>";
    }).join("\n") + "</pre>";
  }

  var SOURCE = [
    "// ---- tile4m.v : the top module. Everything else is instantiated here ----",
    "module tile4m (",
    "  input  wire        clk,",
    "  input  wire        rst_n,",
    "  input  wire [31:0] in_data,",
    "  input  wire [15:0] ctrl,",
    "  output wire [31:0] out_data",
    ");",
    "",
    "  // ... wires and registers omitted ...",
    "",
    "  // one controller per memory",
    "  mem_ctrl u_ctrl_a (.clk(clk), .rst_n(rst_n), .cmd(cmd_a), .addr(a_addr), .we(a_we), /* ... */);",
    "  mem_ctrl u_ctrl_b (.clk(clk), .rst_n(rst_n), .cmd(cmd_b), .addr(b_addr), .we(b_we), /* ... */);",
    "  mem_ctrl u_ctrl_c (.clk(clk), .rst_n(rst_n), .cmd(cmd_c), .addr(c_addr), .we(c_we), /* ... */);",
    "  mem_ctrl u_ctrl_d (.clk(clk), .rst_n(rst_n), .cmd(cmd_d), .addr(d_addr), .we(d_we), /* ... */);",
    "",
    "  // the datapath that ties them together, and the thing that decides who goes first",
    "  hub     u_hub (.clk(clk), .rst_n(rst_n), .in_data(in_data), .out_data(out_data), /* ... */);",
    "  arbiter u_arb (.clk(clk), .rst_n(rst_n), .req({req_d, req_c, req_b, req_a}), /* ... */);",
    "",
    "  // the four memories: these are layouts already, not code",
    "  mem_wide   u_mem_a (.clk(clk), .addr(a_addr), .din(a_din), .dout(a_dout), .we(a_we));",
    "  mem_wide   u_mem_b (.clk(clk), .addr(b_addr), .din(b_din), .dout(b_dout), .we(b_we));",
    "  mem_square u_mem_c (.clk(clk), .addr(c_addr), .din(c_din), .dout(c_dout), .we(c_we));",
    "  mem_square u_mem_d (.clk(clk), .addr(d_addr), .din(d_din), .dout(d_dout), .we(d_we));",
    "",
    "endmodule",
    "",
    "// ---- mem_ctrl.v : address generation, write masking, the read pipeline ----",
    "module mem_ctrl (input wire clk, input wire rst_n, input wire [3:0] cmd,",
    "                 output reg [9:0] addr, output reg we /* ... */);",
    "  // ... body omitted: the always blocks that become logic in step 2 ...",
    "endmodule",
    "",
    "// ---- hub.v : the accumulator and the crossbar between the four ports ----",
    "module hub (/* ... ports omitted ... */);",
    "  // ... body omitted ...",
    "endmodule",
    "",
    "// ---- arbiter.v : round robin between the four controllers ----",
    "module arbiter (/* ... ports omitted ... */);",
    "  // ... body omitted ...",
    "endmodule",
    "",
    "// ---- mem_blackbox.v : read with -lib, so only these lines matter ----",
    "(* blackbox *)",
    "module mem_wide (",
    "  input  wire        clk,",
    "  input  wire [9:0]  addr,",
    "  input  wire [31:0] din,",
    "  input  wire        we,",
    "  output wire [31:0] dout",
    ");",
    "  // no body at all: the memory exists as a layout, and synthesis only",
    "  // needs to know its name and its pins",
    "endmodule",
    "",
    "(* blackbox *)",
    "module mem_square (/* the same ports, a squarer aspect ratio */);",
    "endmodule",
  ];



  /* ----- step 1: what the source says ----- */
  function hierFigure(M) {
    var W = 760, H = 250;
    var o = ['<svg viewBox="0 0 ' + W + " " + H + '" class="ff3-svg sy-hier" role="img" ' +
             'aria-label="The module hierarchy of tile4m: a top module, four controllers, a hub, and ' +
             'the four memory macros as black boxes">'];
    o.push('<text class="ff3-cap" x="12" y="20">the design as the source describes it, before any ' +
           "logic exists</text>");
    var boxes = [
      { x: 300, y: 44, w: 160, h: 36, t: OPT.top, s: "top module", c: "sy-top" },
      { x: 60, y: 118, w: 130, h: 34, t: "mem_ctrl", s: "four of them", c: "sy-mod" },
      { x: 230, y: 118, w: 130, h: 34, t: "hub", s: "one", c: "sy-mod" },
      { x: 400, y: 118, w: 130, h: 34, t: "arbiter", s: "one", c: "sy-mod" },
      { x: 570, y: 118, w: 150, h: 34, t: "mem_wide", s: "black box", c: "sy-bb" },
      { x: 570, y: 176, w: 150, h: 34, t: "mem_square", s: "black box", c: "sy-bb" },
    ];
    boxes.forEach(function (b, i) {
      if (i) {
        o.push('<path class="sy-edge" d="M380,80 L380,' + (b.y - 14) + " L" + (b.x + b.w / 2) + "," +
               (b.y - 14) + " L" + (b.x + b.w / 2) + "," + b.y + '"/>');
      }
    });
    boxes.forEach(function (b) {
      o.push('<rect class="sy-box ' + b.c + '" x="' + b.x + '" y="' + b.y + '" width="' + b.w +
             '" height="' + b.h + '" rx="4"/>');
      o.push('<text class="sy-boxt" x="' + (b.x + b.w / 2) + '" y="' + (b.y + 16) + '">' + b.t + "</text>");
      o.push('<text class="sy-boxs" x="' + (b.x + b.w / 2) + '" y="' + (b.y + 29) + '">' + b.s + "</text>");
    });
    o.push('<text class="sy-note" x="60" y="200">' + fmt(M.portBits) + " port bits, " +
           "one clock, one reset</text>");
    o.push('<text class="sy-note2" x="60" y="220">nothing here is a gate yet: these are modules, ' +
           "always blocks and operators</text>");
    o.push("</svg>");
    return o.join("") +
      '<div class="ff3-legend">' +
      '<span><i class="pl-sw sy-sw-top"></i>the module being synthesized</span>' +
      '<span><i class="pl-sw sy-sw-mod"></i>a module whose logic will be built</span>' +
      '<span><i class="pl-sw sy-sw-bb"></i>a black box: a memory that already exists as a layout</span></div>';
  }

  /* ----- step 2 and 6: how the cell count moves through the passes ----- */
  function countFigure(M, upTo, limit) {
    /* the chart only shows the passes that have run: the rows for later
       stages appear in the step that performs them */
    var rows = M.stages.slice(0, limit === undefined ? M.stages.length : limit);
    var W = 760, H = 44 + rows.length * 36 + 18, ml = 176, mr = 90, mt = 52;
    var max = Math.max.apply(null, M.stages.map(function (s) { return s.cells; }));
    var o = ['<svg viewBox="0 0 ' + W + " " + H + '" class="ff3-svg sy-count" role="img" ' +
             'aria-label="How many cells the design has after each synthesis pass: the count rises as ' +
             'the logic is broken into primitives and falls as library cells cover them">'];
    o.push('<text class="ff3-cap" x="12" y="20">how many cells the design has after each pass</text>');
    o.push('<text class="ff3-cap sy-say" x="12" y="38" id="sy-csay">' +
           (rows.length < M.stages.length ? "so far" : "the count goes up before it comes down") + "</text>");
    rows.forEach(function (s, i) {
      var y = mt + i * 36;
      var w = (s.cells / max) * (W - ml - mr);
      var on = upTo === undefined || i <= upTo;
      o.push('<text class="sy-lab" data-crow="' + i + '" x="' + (ml - 12) + '" y="' + (y + 13) +
             '">' + s.k + "</text>");
      o.push('<rect class="sy-bar' + (i === M.stages.length - 1 ? " sy-bar-end" : "") + '" data-cbar="' + i +
             '" x="' + ml + '" y="' + y + '" width="' + w.toFixed(1) + '" height="18" rx="3"' +
             (on ? "" : ' style="display:none"') + "/>");
      o.push('<text class="sy-val" data-cval="' + i + '" x="' + (ml + w + 8).toFixed(1) + '" y="' + (y + 13) +
             '"' + (on ? "" : ' style="display:none"') + ">" + fmt(s.cells) + "</text>");
      o.push('<text class="sy-note2" x="' + ml + '" y="' + (y + 30) + '">' + s.note + "</text>");
    });
    o.push("</svg>");
    return o.join("");
  }

  /* ----- step 2: one register, all the way to generic gates -----
     The chart says the count rises; this says why. A single always
     block becomes a register with a multiplexer in front of it, and
     then that multiplexer becomes four gates. Multiply by the whole
     design and the count climbs from twelve thousand to seventy-eight. */
  var TZ = { W: 880, H: 272, pw: 205, gap: 14, x0: 14, py: 58, ph: 172 };

  /* the running example: the hub's accumulator, which is the register the
     timing example's critical path ends on. Eight bits, a synchronous
     reset and an enable, which is enough to need every kind of cell. */
  var ACC = {
    bits: 8,
    muxPerBit: 2,                       /* one for the reset, one for the enable */
    gatesPerMux: COST.gatesPerMux,
    gatesPerFullAdder: COST.gatesPerAddBit,
  };

  function accCounts() {
    var b = ACC.bits;
    var coarse = b + b * ACC.muxPerBit + 1;                 /* registers, muxes, one add */
    var fine = b * ACC.gatesPerFullAdder +                  /* the add, bit by bit */
               b * ACC.muxPerBit * ACC.gatesPerMux +        /* every mux as gates */
               b;                                           /* the registers stay */
    return { coarse: coarse, fine: fine, adds: b * ACC.gatesPerFullAdder,
             muxes: b * ACC.muxPerBit * ACC.gatesPerMux, regs: b };
  }

  function transformFigure(M) {
    var C = accCounts();
    function px(i) { return TZ.x0 + i * (TZ.pw + TZ.gap); }
    var o = ['<svg viewBox="0 0 ' + TZ.W + " " + TZ.H + '" class="ff3-svg sy-xform" role="img" ' +
             'aria-label="An eight bit accumulator at four points: as source, as a process and an ' +
             'add operator, as registers and multiplexers, and as generic gates">'];
    o.push('<text class="ff3-cap" x="12" y="20">one register bank from the source, at each row of ' +
           "the chart below</text>");
    o.push('<text class="ff3-cap sy-say" x="12" y="40" id="sy-xsay">press play</text>');

    function panel(i, id, head, hidden) {
      var g = '<g id="' + id + '"' + (hidden ? ' style="display:none"' : "") + ">";
      g += '<rect class="sy-xpanel" x="' + px(i) + '" y="' + TZ.py + '" width="' + TZ.pw +
           '" height="' + TZ.ph + '" rx="6"/>';
      g += '<text class="sy-xhead" x="' + (px(i) + 12) + '" y="' + (TZ.py + 18) + '">' + head + "</text>";
      return g;
    }
    function count(i, main, sub) {
      var g = '<text class="sy-xcount" x="' + (px(i) + 12) + '" y="' + (TZ.py + 140) + '">' + main + "</text>";
      g += '<text class="sy-xnote" x="' + (px(i) + 12) + '" y="' + (TZ.py + 158) + '">' + sub + "</text>";
      return g;
    }

    /* 0: the source. The hub's accumulator, reset and enable and all */
    var g0 = panel(0, "sy-x-rtl", "in the source", false);
    [["always @(posedge clk)", 0], ["if (rst)", 1], ["acc <= 8'd0;", 2],
     ["else if (en)", 1], ["acc <= acc + in;", 2]].forEach(function (t, i) {
      g0 += '<text class="sy-xcode" x="' + (px(0) + 12 + t[1] * 13) + '" y="' + (TZ.py + 42 + i * 18) +
            '">' + esc(t[0]) + "</text>";
    });
    g0 += count(0, "1 statement", "eight bits of accumulator") + "</g>";
    o.push(g0);

    /* 1: after reading: a process and an operator, nothing structural */
    var g1 = panel(1, "sy-x-proc0", "read and elaborate", true);
    g1 += '<rect class="sy-proc" x="' + (px(1) + 22) + '" y="' + (TZ.py + 38) + '" width="118" height="46" rx="8"/>';
    g1 += '<text class="sy-xsmall" x="' + (px(1) + 81) + '" y="' + (TZ.py + 58) + '">$proc</text>';
    g1 += '<text class="sy-xsmall" x="' + (px(1) + 81) + '" y="' + (TZ.py + 74) + '">rst / en / acc</text>';
    g1 += '<rect class="sy-op" x="' + (px(1) + 52) + '" y="' + (TZ.py + 96) + '" width="88" height="34" rx="4"/>';
    g1 += '<text class="sy-xsmall" x="' + (px(1) + 96) + '" y="' + (TZ.py + 117) + '">$add [7:0]</text>';
    g1 += '<line class="sy-xw" x1="' + (px(1) + 96) + '" y1="' + (TZ.py + 96) + '" x2="' + (px(1) + 96) +
          '" y2="' + (TZ.py + 84) + '"/>';
    g1 += count(1, "1 process, 1 operator", "an 8 bit add is still one cell here") + "</g>";
    o.push(g1);

    /* 2: proc has run: registers, and two muxes per bit */
    var g2 = panel(2, "sy-x-proc", "coarse synthesis", true);
    var bx = px(2);
    g2 += '<rect class="sy-op" x="' + (bx + 10) + '" y="' + (TZ.py + 34) + '" width="58" height="26" rx="4"/>';
    g2 += '<text class="sy-xsmall" x="' + (bx + 39) + '" y="' + (TZ.py + 51) + '">$add</text>';
    [["rst", 74], ["en", 112]].forEach(function (m, i) {
      g2 += '<path class="sy-mux" d="M' + (bx + m[1]) + "," + (TZ.py + 60) + " L" + (bx + m[1] + 20) + "," +
            (TZ.py + 68) + " L" + (bx + m[1] + 20) + "," + (TZ.py + 100) + " L" + (bx + m[1]) + "," +
            (TZ.py + 108) + ' Z"/>';
      g2 += '<text class="sy-xtiny" x="' + (bx + m[1] + 10) + '" y="' + (TZ.py + 87) + '">' + m[0] + "</text>";
    });
    g2 += '<rect class="sy-ff" x="' + (bx + 148) + '" y="' + (TZ.py + 66) + '" width="40" height="36" rx="3"/>';
    g2 += '<text class="sy-xtiny" x="' + (bx + 168) + '" y="' + (TZ.py + 88) + '">DFF</text>';
    g2 += '<line class="sy-xw" x1="' + (bx + 68) + '" y1="' + (TZ.py + 47) + '" x2="' + (bx + 74) +
          '" y2="' + (TZ.py + 68) + '"/>';
    g2 += '<line class="sy-xw" x1="' + (bx + 94) + '" y1="' + (TZ.py + 84) + '" x2="' + (bx + 112) +
          '" y2="' + (TZ.py + 84) + '"/>';
    g2 += '<line class="sy-xw" x1="' + (bx + 132) + '" y1="' + (TZ.py + 84) + '" x2="' + (bx + 148) +
          '" y2="' + (TZ.py + 84) + '"/>';
    g2 += '<path class="sy-xw sy-xfb" d="M' + (bx + 188) + "," + (TZ.py + 84) + " L" + (bx + 194) + "," +
          (TZ.py + 84) + " L" + (bx + 194) + "," + (TZ.py + 120) + " L" + (bx + 18) + "," + (TZ.py + 120) +
          " L" + (bx + 18) + "," + (TZ.py + 60) + '"/>';
    g2 += count(2, C.coarse + " cells", ACC.bits + " registers, " + ACC.bits * ACC.muxPerBit +
                " muxes, 1 add") + "</g>";
    o.push(g2);

    /* 3: techmap: the add and the muxes become gates, per bit */
    var g3 = panel(3, "sy-x-tech", "technology primitives", true);
    var cx = px(3);
    g3 += '<text class="sy-xtiny sy-xleft" x="' + (cx + 12) + '" y="' + (TZ.py + 36) + '">one bit of eight:</text>';
    [["FA", cx + 12, TZ.py + 44, 34], ["mux", cx + 56, TZ.py + 44, 44], ["mux", cx + 108, TZ.py + 44, 44]]
      .forEach(function (g) {
        g3 += '<rect class="sy-gategrp" x="' + g[1] + '" y="' + g[2] + '" width="' + g[3] + '" height="40" rx="3"/>';
        g3 += '<text class="sy-xtiny" x="' + (g[1] + g[3] / 2) + '" y="' + (g[2] + 17) + '">' + g[0] + "</text>";
        g3 += '<text class="sy-xtiny" x="' + (g[1] + g[3] / 2) + '" y="' + (g[2] + 31) + '">' +
              (g[0] === "FA" ? ACC.gatesPerFullAdder : ACC.gatesPerMux) + " gates</text>";
      });
    g3 += '<rect class="sy-ff" x="' + (cx + 160) + '" y="' + (TZ.py + 44) + '" width="34" height="40" rx="3"/>';
    g3 += '<text class="sy-xtiny" x="' + (cx + 177) + '" y="' + (TZ.py + 68) + '">DFF</text>';
    g3 += '<text class="sy-xtiny sy-xleft" x="' + (cx + 12) + '" y="' + (TZ.py + 106) + '">times ' +
          ACC.bits + " bits: " + C.adds + " + " + C.muxes + " + " + C.regs + " cells</text>";
    g3 += count(3, C.fine + " cells", "from " + C.coarse + ", same behaviour") + "</g>";
    o.push(g3);
    o.push("</svg>");
    return o.join("");
  }

  function synthAnimate(M) {
    var root = document.getElementById("flow-fig-2");
    if (!root) return;
    var bars = [].slice.call(root.querySelectorAll("[data-cbar]"));
    var vals = [].slice.call(root.querySelectorAll("[data-cval]"));
    if (!bars.length) return;
    var say = document.getElementById("sy-xsay");
    var csay = document.getElementById("sy-csay");
    var timers = [];
    function later(ms, fn) { timers.push(setTimeout(fn, ms)); }
    function show(id, on) { var el = document.getElementById(id); if (el) el.style.display = on ? "" : "none"; }
    function bar(i, on) {
      if (bars[i]) bars[i].style.display = on ? "" : "none";
      if (vals[i]) vals[i].style.display = on ? "" : "none";
    }

    /* one panel per bar, in the same order, so the picture and the row
       always say the same thing */
    var beats = [
      { panel: "sy-x-proc0", bar: 0,
        x: "read and elaborate: a process and one 8 bit add. Two objects for a whole register " +
           "bank, which is why this bar is short and means almost nothing yet",
        c: "elaborated: operators and processes, straight from the source" },
      { panel: "sy-x-proc", bar: 1,
        x: "coarse synthesis: proc builds it properly. Eight registers, two muxes each for the " +
           "reset and the enable, the add still one cell: " + accCounts().coarse + " cells",
        c: "coarse synthesis: the processes are gone, the operators are not" },
      { panel: "sy-x-tech", bar: 2,
        x: "technology primitives: every mux becomes four gates, every bit of the add five, so " +
           accCounts().coarse + " cells become " + accCounts().fine + ". Same multiplication, " +
           "same reason the bar jumps",
        c: "technology primitives: the peak, and not a library cell in sight" },
    ];

    function play() {
      timers.forEach(clearTimeout);
      timers = [];
      beats.forEach(function (b) { show(b.panel, false); });
      show("sy-x-rtl", true);
      bars.forEach(function (b, i) { bar(i, false); });
      root.querySelectorAll("[data-crow]").forEach(function (el) { el.classList.remove("sy-lab-on"); });
      if (say) say.textContent = "the source is where it starts: one statement, no circuit at all";
      if (csay) csay.textContent = "so far";
      beats.forEach(function (b, i) {
        /* the picture first, then the row it accounts for, so the order
           reads as cause and effect rather than two things at once */
        later(1400 + i * 2800, function () {
          show(b.panel, true);
          if (say) say.textContent = b.x;
          root.querySelectorAll("[data-crow]").forEach(function (el) {
            el.classList.toggle("sy-lab-on", +el.getAttribute("data-crow") === b.bar);
          });
        });
        later(1400 + i * 2800 + 600, function () {
          bar(b.bar, true);
          if (csay) csay.textContent = b.c;
        });
      });
    }
    play();
  }

  /* ----- step 3: the two ways to build a carry chain ----- */
  var AD = { W: 800, H: 340, bits: 8, ox: 176, px: 72, ripY: 76, pfxY: 160, pfxDy: 42 };

  function adderFigure(M) {
    var n = AD.bits, o = [];
    function X(i) { return AD.ox + i * AD.px; }
    var levels = Math.ceil(Math.log(n) / Math.log(2));
    o.push('<svg viewBox="0 0 ' + AD.W + " " + AD.H + '" class="ff3-svg sy-adder" role="img" ' +
           'aria-label="An eight bit carry chain built two ways: a ripple carry, where the carry ' +
           'crosses every bit in turn, and a prefix tree, where every carry is computed in three levels">');
    o.push('<text class="ff3-cap" x="12" y="20">an ' + n + " bit add, built two ways</text>");
    o.push('<text class="ff3-cap sy-say" x="12" y="40" id="sy-asay">press play</text>');

    /* the ripple carry: one full adder per bit, the carry passed along */
    o.push('<text class="sy-rowlab" x="12" y="' + (AD.ripY + 14) + '">ripple carry</text>');
    o.push('<text class="sy-note2" x="12" y="' + (AD.ripY + 30) + '">the carry crosses ' + n + " bits</text>");
    for (var i = 0; i < n; i++) {
      o.push('<rect class="sy-fa" x="' + (X(i) - 24) + '" y="' + AD.ripY + '" width="48" height="36" rx="3"/>');
      o.push('<text class="sy-bit" x="' + X(i) + '" y="' + (AD.ripY + 22) + '">b' + (n - 1 - i) + "</text>");
      if (i < n - 1) {
        o.push('<line class="sy-carry" data-carry="' + i + '" x1="' + (X(i) + 24) + '" y1="' + (AD.ripY + 18) +
               '" x2="' + (X(i + 1) - 24) + '" y2="' + (AD.ripY + 18) + '" style="display:none"/>');
      }
    }

    /* the prefix tree: level by level, every carry known at the end */
    o.push('<text class="sy-rowlab" x="12" y="' + (AD.pfxY + 14) + '">prefix tree</text>');
    o.push('<text class="sy-note2" x="12" y="' + (AD.pfxY + 30) + '">' + levels + " levels, about twice the gates</text>");
    function Y(L) { return AD.pfxY + L * AD.pfxDy; }
    for (var L = 0; L < levels; L++) {
      var span = Math.pow(2, L);
      for (var j = 0; j < n; j++) {
        o.push('<line class="sy-pfx" data-pfx="' + L + '" x1="' + X(j) + '" y1="' + Y(L) + '" x2="' + X(j) +
               '" y2="' + Y(L + 1) + '" style="display:none"/>');
        if (j - span >= 0) {
          o.push('<line class="sy-pfx sy-pfx-diag" data-pfx="' + L + '" x1="' + X(j - span) + '" y1="' + Y(L) +
                 '" x2="' + X(j) + '" y2="' + Y(L + 1) + '" style="display:none"/>');
        }
      }
    }
    for (var L2 = 0; L2 <= levels; L2++) {
      for (var k = 0; k < n; k++) {
        o.push('<circle class="sy-pnode" data-pnode="' + L2 + '" cx="' + X(k) + '" cy="' + Y(L2) +
               '" r="5.5"' + (L2 ? ' style="display:none"' : "") + "/>");
      }
    }
    o.push('<text class="sy-note2" x="12" y="' + (Y(levels) + 6) + '">every carry known</text>');
    o.push("</svg>");
    return o.join("") +
      '<div class="gp-readout" id="sy-aread">' +
      '<span>ripple carry: delay <b id="sy-rip">-</b></span>' +
      '<span>prefix tree: delay <b id="sy-pfx">-</b></span>' +
      '<span>the trade <b id="sy-gates">-</b></span>' +
      '<button class="ff-reset" type="button" id="sy-areplay">replay</button></div>' +
      '<div class="ff3-legend">' +
      '<span><i class="pl-sw sy-sw-fa"></i>a full adder, one per bit</span>' +
      '<span><i class="pl-sw sy-sw-carry"></i>the carry, crossing one bit at a time</span>' +
      '<span><i class="pl-sw sy-sw-pfx"></i>the prefix network, which computes every carry at once</span></div>';
  }

  function adderAnimate(M) {
    var root = document.getElementById("flow-fig-3");
    if (!root) return;
    var carries = [].slice.call(root.querySelectorAll(".sy-carry"));
    var pfx = [].slice.call(root.querySelectorAll("[data-pfx]"));
    var pnodes = [].slice.call(root.querySelectorAll("[data-pnode]"));
    if (!carries.length) return;
    var say = document.getElementById("sy-asay");
    var ripEl = document.getElementById("sy-rip");
    var pfxEl = document.getElementById("sy-pfx");
    var gateEl = document.getElementById("sy-gates");
    var replay = document.getElementById("sy-areplay");
    var timers = [], n = AD.bits, levels = Math.ceil(Math.log(n) / Math.log(2));
    function later(ms, fn) { timers.push(setTimeout(fn, ms)); }

    function play() {
      timers.forEach(clearTimeout);
      timers = [];
      carries.forEach(function (el) { el.style.display = "none"; });
      pfx.forEach(function (el) { el.style.display = "none"; });
      pnodes.forEach(function (el) { el.style.display = +el.getAttribute("data-pnode") ? "none" : ""; });
      if (ripEl) ripEl.textContent = "-";
      if (pfxEl) pfxEl.textContent = "-";
      if (gateEl) gateEl.textContent = "-";
      if (say) say.textContent = "the ripple carry: bit zero cannot finish until the carry has crossed " +
        "every bit below it";
      carries.forEach(function (el, i) {
        later(500 + i * 320, function () {
          el.style.display = "";
          if (ripEl) ripEl.textContent = (i + 2) + " gate delays";
          if (say && i === carries.length - 1) {
            say.textContent = "the carry has crossed all " + n + " bits, one after another. Now the " +
              "same add as a prefix tree.";
          }
        });
      });
      var base = 500 + carries.length * 320 + 700;
      for (var L = 0; L < levels; L++) {
        (function (L) {
          later(base + L * 700, function () {
            pfx.filter(function (el) { return +el.getAttribute("data-pfx") === L; })
               .forEach(function (el) { el.style.display = ""; });
            pnodes.filter(function (el) { return +el.getAttribute("data-pnode") === L + 1; })
                  .forEach(function (el) { el.style.display = ""; });
            if (pfxEl) pfxEl.textContent = (L + 1) + " gate delay" + (L ? "s" : "");
            if (say) say.textContent = "level " + (L + 1) + " of the prefix tree: every carry that " +
              "depends on at most " + Math.pow(2, L + 1) + " bits is now known";
          });
        })(L);
      }
      later(base + levels * 700 + 300, function () {
        if (gateEl) gateEl.textContent = n + " levels down to " + levels + ", at about twice the gates";
        if (say) say.textContent = "the tree computes every carry in " + levels + " levels instead of " +
          n + ", and pays for it in gates. That trade is the whole of arithmetic mapping.";
      });
    }

    if (replay && !replay.dataset.wired) {
      replay.dataset.wired = "1";
      replay.addEventListener("click", play);
    }
    play();
  }

  /* ----- step 5: covering an and-inverter graph with library cells -----
     The mapper's problem in miniature. The graph holds one operation,
     a two-input AND, and a bubble on an edge is an inversion; a node
     whose two inputs are both bubbled therefore computes !(x or y),
     which is exactly a NOR2, and that is what it is labelled. A library
     cell covers a group of those nodes at once, and the mapper picks
     the covering with the best cost.

     Every name, area and delay below is the library's own. The areas
     are the Liberty areas of the cells, and the delays are the worst
     arc of each cell at a middle input slew and a middle output load,
     which is what makes the two numbers in the legend comparable. */
  var AIG = { W: 660, H: 376, ox: 74, oy: 78, dx: 128, dy: 52, nw: 76, nh: 28, ior: 13 };

  function aigScene() {
    /* six inputs, six AND nodes, one output. The cone was built so that
       the covering below is exact: every intermediate signal in the
       three-cell netlist equals the node it comes from, so nothing here
       needs an extra inverter to make the polarities work out. */
    var nodes = [
      { id: 0, x: 0, y: 0, t: "in", lab: "a" }, { id: 1, x: 0, y: 1, t: "in", lab: "b" },
      { id: 2, x: 0, y: 2, t: "in", lab: "c" }, { id: 3, x: 0, y: 3, t: "in", lab: "d" },
      { id: 4, x: 0, y: 4, t: "in", lab: "e" }, { id: 5, x: 0, y: 5, t: "in", lab: "f" },
      /* a AND b, c AND d, e AND f: clean inputs, so all three are AND2 */
      { id: 6, x: 1, y: 0.5, t: "and", fn: "AND2", a: 0, b: 1 },
      { id: 7, x: 1, y: 2.5, t: "and", fn: "AND2", a: 2, b: 3 },
      { id: 8, x: 1, y: 4.5, t: "and", fn: "AND2", a: 4, b: 5 },
      /* both inputs bubbled: !(ab) AND !(cd) is !(ab + cd), a NOR2 */
      { id: 9, x: 2, y: 1.5, t: "and", fn: "NOR2", a: 6, b: 7, ia: true, ib: true },
      /* the same shape one input lower: !d AND !(ef) is !(d + ef) */
      { id: 10, x: 2, y: 3.7, t: "and", fn: "NOR2", a: 3, b: 8, ia: true, ib: true },
      /* the two cones meet, and the output edge is bubbled */
      { id: 11, x: 3, y: 2.6, t: "and", fn: "AND2", a: 9, b: 10 },
      { id: 12, x: 4, y: 2.6, t: "out", lab: "z", a: 11, ia: true },
    ];
    /* the covering the mapper settles on. Each name is the cell whose
       Liberty function is exactly what its group of nodes computes. */
    var cells = [
      { name: "AOI22_X1", nodes: [6, 7, 9], area: 1.330, d: 66,
        fn: "!((a &amp; b) | (c &amp; d))",
        say: "three nodes at once: both ANDs and the NOR that inverts them" },
      { name: "AOI21_X1", nodes: [8, 10], area: 1.064, d: 60,
        fn: "!(d | (e &amp; f))", below: true,
        say: "two nodes, the same shape one input shorter" },
      { name: "NAND2_X1", nodes: [11], area: 0.798, d: 48,
        fn: "!(n1 &amp; n2)", below: true,
        say: "one node, plus the bubble on its output: that bubble is the N in NAND" },
    ];
    /* the longest path through the cone: the AOI22 and then the NAND2
       that consumes it. The AOI21 branch is the shorter of the two. */
    var worstPs = 66 + 48;
    return { nodes: nodes, cells: cells, worstPs: worstPs };
  }

  function aigFigure(M) {
    var sc = M.aig, o = [];
    function X(n) { return AIG.ox + n.x * AIG.dx; }
    function Y(n) { return AIG.oy + n.y * AIG.dy; }
    var byId = {};
    sc.nodes.forEach(function (n) { byId[n.id] = n; });
    o.push('<svg viewBox="0 0 ' + AIG.W + " " + AIG.H + '" class="ff3-svg sy-aig" role="img" ' +
           'aria-label="A small and-inverter graph, each node named for the function it computes, ' +
           'and the library cells that cover groups of those nodes during technology mapping">');
    o.push('<text class="ff3-cap" x="12" y="20">the logic as a graph of two-input ANDs and inversions</text>');
    o.push('<text class="ff3-cap sy-say" x="12" y="40" id="sy-gsay">press play</text>');

    /* the covering boxes, revealed one at a time */
    sc.cells.forEach(function (c, i) {
      var xs = c.nodes.map(function (id) { return X(byId[id]); });
      var ys = c.nodes.map(function (id) { return Y(byId[id]); });
      var x0 = Math.min.apply(null, xs) - AIG.nw / 2 - 11, x1 = Math.max.apply(null, xs) + AIG.nw / 2 + 11;
      var y0 = Math.min.apply(null, ys) - AIG.nh / 2 - 11, y1 = Math.max.apply(null, ys) + AIG.nh / 2 + 11;
      o.push('<rect class="sy-cover" data-cov="' + i + '" x="' + x0 + '" y="' + y0 + '" width="' +
             (x1 - x0) + '" height="' + (y1 - y0) + '" rx="8" style="display:none"/>');
      o.push('<text class="sy-covlab" data-cov="' + i + '" x="' + ((x0 + x1) / 2) + '" y="' +
             (c.below ? y1 + 14 : y0 - 7) + '" style="display:none">' + c.name + "   " + c.fn + "</text>");
    });
    /* the edges, with a bubble where the input is inverted. The bubble
       sits just outside the box it feeds rather than partway along the
       line, which at this node size would put it under the box. */
    sc.nodes.forEach(function (n) {
      var stop = (n.t === "out" ? AIG.ior : AIG.nw / 2) + 8;
      [["a", n.ia], ["b", n.ib]].forEach(function (side) {
        var src = byId[n[side[0]]];
        if (!src) return;
        o.push('<line class="sy-aedge" x1="' + X(src) + '" y1="' + Y(src) + '" x2="' + X(n) + '" y2="' + Y(n) + '"/>');
        if (!side[1]) return;
        var t = (X(n) - X(src) - stop) / (X(n) - X(src));
        o.push('<circle class="sy-bubble" cx="' + (X(src) + t * (X(n) - X(src))).toFixed(1) + '" cy="' +
               (Y(src) + t * (Y(n) - Y(src))).toFixed(1) + '" r="5"/>');
      });
    });
    /* the two intermediate signals, named, because the last cell's
       function is written in terms of them */
    [[9, "n1"], [10, "n2"]].forEach(function (pair) {
      var n = byId[pair[0]], t = byId[11];
      o.push('<text class="sy-netlab" x="' + ((X(n) + X(t)) / 2) + '" y="' + ((Y(n) + Y(t)) / 2 - 7) +
             '">' + pair[1] + "</text>");
    });
    sc.nodes.forEach(function (n) {
      if (n.t === "in" || n.t === "out") {
        o.push('<circle class="sy-anode sy-anode-io" data-node="' + n.id + '" cx="' + X(n) + '" cy="' +
               Y(n) + '" r="' + AIG.ior + '"/>');
        o.push('<text class="sy-anodet" x="' + X(n) + '" y="' + (Y(n) + 4) + '">' + n.lab + "</text>");
      } else {
        o.push('<rect class="sy-anode" data-node="' + n.id + '" x="' + (X(n) - AIG.nw / 2) + '" y="' +
               (Y(n) - AIG.nh / 2) + '" width="' + AIG.nw + '" height="' + AIG.nh + '" rx="5"/>');
        o.push('<text class="sy-anodet" x="' + X(n) + '" y="' + (Y(n) + 4) + '">' + n.fn + "</text>");
      }
    });
    o.push("</svg>");
    var totalArea = sc.cells.reduce(function (a, c) { return a + c.area; }, 0);
    return o.join("") +
      '<div class="gp-readout" id="sy-gread">' +
      '<span>graph nodes covered <b id="sy-gnodes">0</b> of ' +
      sc.nodes.filter(function (n) { return n.t === "and"; }).length + "</span>" +
      '<span>library cells used <b id="sy-gcells">0</b></span>' +
      '<span>area <b id="sy-garea">0.00</b> square micrometers</span>' +
      '<button class="ff-reset" type="button" id="sy-greplay">replay</button></div>' +
      '<div class="ff3-legend">' +
      "<span><i class=\"pl-sw sy-sw-node\"></i>one AND node, named for what it computes: two clean " +
      "inputs make an AND2, two bubbled ones make a NOR2, because !x and !y is !(x or y)</span>" +
      '<span><i class="pl-sw sy-sw-cover"></i>one library cell, covering the nodes inside it, with ' +
      "the function the library gives it</span>" +
      "<span>this covering is " + f2(totalArea) + " square micrometers of cell area and " +
      sc.worstPs + " picoseconds through its longest path; a different one would trade those " +
      "against each other</span></div>";
  }

  function aigAnimate(M) {
    var root = document.getElementById("flow-fig-5");
    if (!root) return;
    var sc = M.aig;
    var covers = [].slice.call(root.querySelectorAll(".sy-cover"));
    if (!covers.length) return;
    var say = document.getElementById("sy-gsay");
    var nEl = document.getElementById("sy-gnodes");
    var cEl = document.getElementById("sy-gcells");
    var aEl = document.getElementById("sy-garea");
    var replay = document.getElementById("sy-greplay");
    var timers = [];
    function later(ms, fn) { timers.push(setTimeout(fn, ms)); }

    function play() {
      timers.forEach(clearTimeout);
      timers = [];
      root.querySelectorAll(".sy-cover, .sy-covlab").forEach(function (el) { el.style.display = "none"; });
      root.querySelectorAll(".sy-anode").forEach(function (el) { el.classList.remove("sy-anode-done"); });
      if (nEl) nEl.textContent = "0";
      if (cEl) cEl.textContent = "0";
      if (aEl) aEl.textContent = "0.00";
      if (say) say.textContent = "the mapper looks for groups of nodes that one library cell can " +
        "implement on its own";
      var done = 0, area = 0;
      sc.cells.forEach(function (c, i) {
        later(900 + i * 1500, function () {
          root.querySelectorAll('[data-cov="' + i + '"]').forEach(function (el) { el.style.display = ""; });
          c.nodes.forEach(function (id) {
            var el = root.querySelector('.sy-anode[data-node="' + id + '"]');
            if (el) el.classList.add("sy-anode-done");
          });
          done += c.nodes.length;
          area += c.area;
          if (nEl) nEl.textContent = String(done);
          if (cEl) cEl.textContent = String(i + 1);
          if (aEl) aEl.textContent = f2(area);
          if (say) say.textContent = c.name + " covers " + c.say;
        });
      });
      later(900 + sc.cells.length * 1500 + 400, function () {
        if (say) say.textContent = "six nodes became three cells: the same logic, fewer objects";
        /* the running count can have its last row now */
        var bar = root.querySelector('[data-cbar="4"]'), val = root.querySelector('[data-cval="4"]');
        if (bar) bar.style.display = "";
        if (val) val.style.display = "";
        var csay = document.getElementById("sy-csay");
        if (csay) csay.textContent = "the count goes up before it comes down";
      });
    }

    if (replay && !replay.dataset.wired) {
      replay.dataset.wired = "1";
      replay.addEventListener("click", play);
    }
    play();
  }

  /* ----- step 7: the two files this stage writes, browsable ----- */
  function outFiles(M) {
    return [
      {
        id: "v", name: "results/tile4m.v", kind: "gate-level netlist",
        blurb: "Every instance and every wire between them. No sizes, no positions, no delays: " +
               "this is what the design is, not where it is.",
        text: [
          "module tile4m (",
          "  input  wire        clk,",
          "  input  wire        rst_n,",
          "  input  wire [31:0] in_data,",
          "  input  wire [15:0] ctrl,",
          "  output wire [31:0] out_data",
          ");",
          "  // " + fmt(M.cells) + " standard-cell instances in all; three of them shown",
          "  DFFR_X1   hub_acc_reg_7_ (.D(n1024), .CK(clk), .RN(rst_n), .Q(hub_acc[7]));",
          "  NAND2_X1  U3187 (.A1(n812), .A2(n813), .ZN(n1024));",
          "  BUF_X2    U3188 (.A(a_addr_pre[3]), .Z(a_addr[3]));",
          "  ...",
          "",
          "  // the tie cells hilomap added in step 6",
          "  LOGIC1_X1 tie_hi (.Z(net_one));",
          "  LOGIC0_X1 tie_lo (.Z(net_zero));",
          "",
          "  // the four memories, still black boxes, still just instances",
          "  mem_wide   u_mem_a (.clk(clk), .addr(a_addr), .din(a_din), .dout(a_dout), .we(a_we));",
          "  mem_wide   u_mem_b (.clk(clk), .addr(b_addr), .din(b_din), .dout(b_dout), .we(b_we));",
          "  mem_square u_mem_c (.clk(clk), .addr(c_addr), .din(c_din), .dout(c_dout), .we(c_we));",
          "  mem_square u_mem_d (.clk(clk), .addr(d_addr), .din(d_din), .dout(d_dout), .we(d_we));",
          "endmodule",
        ],
      },
      {
        id: "s", name: "results/tile4m.sdc", kind: "constraints, carried through unchanged",
        blurb: "Not produced by synthesis: written by hand, read here to drive the mapping, and " +
               "used by every stage after this one.",
        text: [
          "create_clock -name clk -period " + f1(M.period) + " [get_ports clk]",
          "set_input_delay  0.6 -clock clk [get_ports {in_data[*] ctrl[*]}]",
          "set_output_delay 0.6 -clock clk [get_ports {out_data[*]}]",
          "set_false_path -from [get_ports rst_n]",
          "set_max_fanout 8 [current_design]",
          "set_driving_cell -lib_cell BUF_X2 [all_inputs]",
          "set_load 0.01 [all_outputs]",
        ],
      },
    ];
  }

  function fileViewer(M) {
    var files = outFiles(M);
    var o = ['<div class="sy-fv">'];
    o.push('<div class="sy-fv-tabs">' + files.map(function (f, i) {
      return '<button type="button" class="sy-fv-tab' + (i ? "" : " on") + '" data-fv="' + f.id + '">' +
        esc(f.name) + "</button>";
    }).join("") + "</div>");
    files.forEach(function (f, i) {
      o.push('<div class="sy-fv-pane" data-fvp="' + f.id + '"' + (i ? ' hidden' : "") + ">" +
             '<p class="sy-fv-blurb"><strong>' + esc(f.kind) + ".</strong> " + f.blurb + "</p>" +
             codeBlock(f.text) + "</div>");
    });
    o.push("</div>");
    return o.join("");
  }

  function fileViewerInit() {
    var root = document.getElementById("flow-fig-7");
    if (!root) return;
    var tabs = [].slice.call(root.querySelectorAll(".sy-fv-tab"));
    var panes = [].slice.call(root.querySelectorAll(".sy-fv-pane"));
    tabs.forEach(function (t) {
      t.addEventListener("click", function () {
        var id = t.getAttribute("data-fv");
        tabs.forEach(function (x) { x.classList.toggle("on", x === t); });
        panes.forEach(function (p) { p.hidden = p.getAttribute("data-fvp") !== id; });
      });
    });
  }

  /* ----- step 7: the area the design ends up with ----- */
  function areaFigure(M) {
    var W = 720, H = 150, ml = 176, mr = 110;
    var rows = [
      { k: "combinational cells", v: M.combArea, n: M.comb, c: "sy-a-comb" },
      { k: "flip-flops", v: M.flopArea, n: M.flops, c: "sy-a-flop" },
    ];
    var o = ['<svg viewBox="0 0 ' + W + " " + H + '" class="ff3-svg sy-area" role="img" ' +
             'aria-label="The area of the synthesized design, split between combinational cells and flip-flops">'];
    o.push('<text class="ff3-cap" x="12" y="20">' + fmt(M.area) + " square micrometers of cells, which " +
           "is what the floorplan has to find room for</text>");
    rows.forEach(function (r, i) {
      var y = 44 + i * 40;
      o.push('<text class="sy-lab" x="' + (ml - 12) + '" y="' + (y + 13) + '">' + r.k + "</text>");
      o.push('<rect class="' + r.c + '" x="' + ml + '" y="' + y + '" width="' +
             ((r.v / M.area) * (W - ml - mr)).toFixed(1) + '" height="18" rx="3"/>');
      o.push('<text class="sy-val" x="' + (ml + (r.v / M.area) * (W - ml - mr) + 8).toFixed(1) + '" y="' +
             (y + 13) + '">' + fmt(Math.round(r.v)) + " um2, " + fmt(r.n) + " cells</text>");
    });
    o.push("</svg>");
    return o.join("") +
      '<div class="ff3-legend"><span>a flip-flop is about ' + f1(OPT.flopArea) +
      " square micrometers here, against " + f1(M.combArea / M.comb) +
      " for an average gate: the sequential cells are " +
      Math.round(100 * M.flopArea / M.area) + "% of the area from " +
      Math.round(100 * M.flops / M.cells) + "% of the cells</span></div>";
  }

  /* ================= the steps ================= */

  var STEPS = [];

  STEPS.push({
    n: 1, title: "Read the design", button: "Read and elaborate", againLabel: "Read again",
    line: "Parse the source, resolve the hierarchy, and see what the design is made of.",
    intro:
      "<p>Everything else on this site starts from a gate-level netlist. This is where that netlist " +
      "comes from.</p>" +
      "<p>The input is register transfer level Verilog: modules, always blocks, arithmetic, and " +
      "instances of other modules. None of it is gates. <code>hierarchy -check -top</code> resolves " +
      "which module is the top, connects every instance to the module it names, and complains if " +
      "something is missing. The four memories are the exception: they already exist as layouts, so " +
      "they are read as black boxes, with ports and no contents.</p>",
    command:
      "# read every source file, and the timing library that says what cells exist\n" +
      "read_verilog -sv rtl/tile4m.v rtl/mem_ctrl.v rtl/hub.v rtl/arbiter.v\n" +
      "read_verilog -lib rtl/mem_blackbox.v\n" +
      "read_liberty -lib stdcells_tt.lib\n" +
      "\n" +
      "# resolve the hierarchy from the top down, and drop what nothing uses\n" +
      "hierarchy -check -top " + OPT.top + "\n" +
      "opt_clean -purge",
    commandNote:
      "<code>-lib</code> on the memory file is what makes it a black box: the ports are read, the " +
      "contents are ignored, and synthesis will instantiate it without trying to build it out of " +
      "gates. The same flag on <code>read_liberty</code> loads the standard cells the same way, since " +
      "at this point the tool only needs to know what they are called and what pins they have." +
      "<br><br>" +
      "<code>opt_clean</code> is the broom, and it appears after almost every pass in this flow. In " +
      "the tool\'s own words it &quot;identifies wires and cells that are unused and removes them. " +
      "Other passes often remove cells but leave the wires in the design, or reconnect the wires but " +
      "leave the old cells&quot;. It is pure dead-code elimination: nothing is restructured and " +
      "nothing changes what the design computes, which is why it is safe to run constantly. " +
      "<code>-purge</code> makes it also delete internal wires that still carry a name from the " +
      "source; without it those names are kept so the netlist stays readable against the original " +
      "code, and after elaboration there is no reason to keep them.",
    run: function () {
      var M = model();
      return {
        log: [
          { k: "cmd", t: "read_verilog -sv rtl/tile4m.v rtl/mem_ctrl.v rtl/hub.v rtl/arbiter.v" },
          { k: "cmd", t: "read_verilog -lib rtl/mem_blackbox.v" },
          { k: "cmd", t: "read_liberty -lib stdcells_tt.lib" },
          { k: "cmd", t: "hierarchy -check -top " + OPT.top },
          { k: "out", t: "  Top module: \\" + OPT.top },
          { k: "out", t: "  Used module: \\mem_ctrl (4 instances)" },
          { k: "out", t: "  Used module: \\hub (1 instance)" },
          { k: "out", t: "  Used module: \\arbiter (1 instance)" },
          { k: "out", t: "  Used module: \\mem_wide, \\mem_square (black boxes, 2 instances each)" },
          { k: "cmd", t: "opt_clean -purge" },
          { k: "out", t: "  Removed 34 unused cells and 118 unused wires." },
          { k: "ok", t: "Elaborated. Nothing is a gate yet." },
        ],
        figure: '<p class="ff3-figtext">What the tool has after reading is a tree of modules, not ' +
          "logic. The top instantiates four memory controllers, a hub and an arbiter, and each " +
          "controller drives one of the four memories. Those memories are black boxes: synthesis will " +
          "wire them up and will not look inside, because they are already laid out and will arrive " +
          "as fixed blocks in the floorplan.</p>" + hierFigure(M) +
          '<p class="ff3-figtext">The same thing in the source itself. Only the structure is shown: ' +
          "every module body, and most of the port lists, are omitted, because what this step does is " +
          "resolve which module is which and connect the instances. The logic inside those bodies is " +
          "what the next step turns into gates. The last two modules are the interesting ones: they " +
          "are marked as black boxes and have no body at all.</p>" + codeBlock(SOURCE),
        report: "<h3>What was read</h3>" + table([
          ["Top module", "<code>" + OPT.top + "</code>"],
          ["Modules to synthesize", "4 memory controllers, a hub, an arbiter"],
          ["Black boxes", "<code>mem_wide</code> and <code>mem_square</code>, two instances each"],
          ["Ports", fmt(M.portBits) + " bits: a clock, a reset, 32 in, 16 control, 32 out"],
          ["Library", "the standard cells this process offers, read for their names and pins"],
        ]) + checks([
          ["A black box is a promise, not an omission.",
           "Telling the tool that <code>mem_wide</code> exists and has these ports is what lets the " +
           "flow treat it as a fixed block later. If it were read as ordinary Verilog, synthesis would " +
           "build a memory out of flip-flops, which is how a design accidentally becomes ten times " +
           "larger than it should be."],
          ["The hierarchy check is worth its own step.",
           "<code>-check</code> fails if an instance names a module that does not exist. Without it " +
           "the module is silently treated as a black box, and the missing logic shows up as a design " +
           "that passes synthesis and does nothing."],
          ["Nothing here is technology yet.",
           "The library was read, but no cell has been chosen. The design at this point would " +
           "synthesize just as happily for a different process, which is the point of keeping the " +
           "source free of library names."],
        ]),
      };
    },
  });

  STEPS.push({
    n: 2, title: "Turn the description into logic", button: "Synthesize", againLabel: "Synthesize again",
    line: "Resolve the processes, share the arithmetic, and reduce it all to generic gates.",
    intro:
      "<p>This is the part of synthesis that is about the design rather than the library. An always " +
      "block becomes a set of flip-flops and a cone of logic feeding them. A state machine becomes an " +
      "encoding. Two adders that can never be busy at once become one adder and a multiplexer. Then " +
      "everything is broken down into generic gates: AND, OR, NOT, and a few others, with no " +
      "knowledge yet of what this process can actually build.</p>" +
      "<p>The cell count climbs steeply here, and keeps climbing in the next step. That is expected: " +
      "breaking an adder into gates makes many small things out of one big thing. The count comes " +
      "back down when the library cells cover them again, two steps from now.</p>",
    command:
      "# the coarse half: processes, finite state machines, memories, shared operators\n" +
      "synth -top " + OPT.top + " -flatten -run :fine\n" +
      "\n" +
      "# and the fine half: everything down to generic gates\n" +
      "synth -top " + OPT.top + " -run fine: -noabc\n" +
      "opt -purge",
    commandNote:
      "<code>synth</code> is a script, not a pass: it runs a couple of dozen smaller passes in a " +
      "fixed order, and <code>-run :fine</code> and <code>-run fine:</code> split it in half so the " +
      "flow can do its own work in the middle. <code>-noabc</code> stops it from technology mapping, " +
      "because this flow calls the mapper itself with its own options two steps later." +
      "<br><br>" +
      "<code>opt</code> is a script too, and worth telling apart from the <code>opt_clean</code> in " +
      "the step before. <code>opt</code> loops over the real optimizations, folding constants, " +
      "merging identical cells, pruning dead branches of multiplexer trees and simplifying " +
      "flip-flops, and finishes each round with <code>opt_clean</code> to sweep up what it " +
      "disconnected. <code>opt_clean</code> on its own only sweeps: it never changes the logic.",
    reference: function () {
      var coarse = [
        "# ---- the coarse half, run by: synth -flatten -run :fine ----",
        "",
        "proc            # always blocks become multiplexers and registers.",
        "                # this is where flip-flops are inferred: an assignment",
        "                # under a clock edge becomes a register, one that is not",
        "                # becomes logic, and an accidental latch shows up here too",
        "flatten         # dissolve the module boundaries so the passes below can",
        "                # optimize across them",
        "opt_expr        # fold constants and simplify expressions",
        "opt_clean       # sweep up whatever that disconnected",
        "check           # complain about anything obviously malformed",
        "opt             # the optimization loop, spelled out further down",
        "wreduce         # narrow operators to the width they actually need: a 32 bit",
        "                # add whose top bits are always zero becomes a smaller add",
        "peepopt         # small local rewrites with a known better form, such as a",
        "                # shift by a constant becoming a rewiring",
        "opt_clean",
        "alumacc         # collect $add, $sub, $lt and friends into general arithmetic",
        "                # cells, so an add and a compare on the same operands can",
        "                # share one carry structure instead of building two",
        "share           # merge resources that are never busy at the same time, with",
        "                # a solver to prove it: two adders behind a mux become one",
        "                # adder with multiplexed inputs. Smaller, and one mux slower",
        "opt",
        "fsm             # find state machines and re-encode their states. One-hot is",
        "                # fast and wide, binary is compact and slower; chosen here,",
        "                # not in the source",
        "opt -fast",
        "memory -nomap   # recognise memory-like structures, leave them abstract.",
        "                # nothing happens for this design: its memories are already",
        "                # black boxes",
        "opt_clean",
      ];
      var fine = [
        "# ---- the fine half, run by: synth -run fine: -noabc ----",
        "",
        "opt -fast -full",
        "memory_map      # any memory still abstract becomes flip-flops and address",
        "                # decoders. This is the pass that would have built the four",
        "                # memories out of logic if step 1 had not blackboxed them",
        "opt -full",
        "techmap         # the coarse cells, arithmetic, muxes, registers, become",
        "                # simple gates from the tool's own internal library.",
        "                # THIS is the pass that makes the cell count explode:",
        "                # one 32 bit add becomes hundreds of gates",
        "opt -fast",
        "",
        "# abc -fast     # would map those gates onto the standard cell library.",
        "                # -noabc suppresses it, because this flow calls the mapper",
        "                # itself in step 5, with the clock period and a constraint file",
      ];
      var optScript = [
        "# ---- what opt does, once as a warm-up and then in a loop ----",
        "",
        "opt_expr        # fold constants",
        "opt_merge       # two cells computing exactly the same thing become one",
        "",
        "do              # and then repeat until a round changes nothing:",
        "  opt_muxtree   #   prune branches of mux trees that can never be selected",
        "  opt_reduce    #   consolidate wide gates",
        "  opt_merge     #   look for duplicates again, now that things have moved",
        "  opt_dff       #   simplify registers with constant or redundant control",
        "  opt_clean     #   sweep",
        "  opt_expr      #   fold whatever the sweep exposed",
        "while <the design changed>",
      ];
      return "<h3>What <code>synth</code> actually runs</h3>" +
        "<p><code>synth</code> is a named list of other passes, not a pass of its own. The flow " +
        "splits it at the <code>fine</code> label so it can do its own arithmetic and sequential " +
        "mapping in the middle, which is why the command appears twice above. The coarse half works " +
        "on the design as operators; the fine half breaks those operators into gates.</p>" +
        codeBlock(coarse) +
        codeBlock(fine) +
        "<h3>And <code>opt</code></h3>" +
        "<p>It appears between almost every pair of passes above, so it is worth knowing what it " +
        "does. The variants in the script matter too: <code>-fast</code> skips the loop and runs a " +
        "short sequence once, <code>-full</code> lets the individual passes work harder, and " +
        "<code>-purge</code> is passed through to <code>opt_clean</code> so that named but unused " +
        "wires go as well.</p>" +
        codeBlock(optScript);
    },
    run: function () {
      var M = model();
      return {
        log: [
          { k: "cmd", t: "synth -top " + OPT.top + " -flatten -run :fine" },
          { k: "out", t: "  Executing PROC pass (convert processes to netlists)." },
          { k: "out", t: "  Executing FSM pass (finite state machine optimization)." },
          { k: "out", t: "  Executing MEMORY pass." },
          { k: "out", t: "  Executing SHARE pass (SAT-based resource sharing)." },
          { k: "out", t: "  " + fmt(M.stages[1].cells) + " cells after the coarse passes" },
          { k: "cmd", t: "synth -top " + OPT.top + " -run fine: -noabc" },
          { k: "out", t: "  Executing TECHMAP pass (map to technology primitives)." },
          { k: "out", t: "  Executing OPT pass (performing simple optimizations)." },
          { k: "out", t: "  " + fmt(M.stages[2].cells) + " cells after the fine passes" },
          { k: "cmd", t: "opt -purge" },
          { k: "ok", t: "The design is logic now, in generic gates." },
        ],
        figure: '<p class="ff3-figtext">Follow one register through it. The source says what it ' +
          "does; <code>proc</code> turns that into a register with a multiplexer in front, which is " +
          "how an enable is built; <code>techmap</code> then turns the multiplexer into four gates. " +
          "Multiply that by a whole design and the count below climbs from " +
          fmt(M.stages[0].cells) + " to " + fmt(M.stages[2].cells) + ", which is as far as this step " +
          "goes. The chart gains a row in each of the next steps, and the count only falls in step 5, " +
          "when library cells start covering these gates several at a time.</p>" +
          transformFigure(M) + countFigure(M, 2, 3),
        after: function () { synthAnimate(M); },
        report: "<h3>After generic synthesis</h3>" + table([
          ["Cells after the coarse passes", fmt(M.stages[1].cells)],
          ["Cells after the fine passes", fmt(M.stages[2].cells)],
          ["What they are", "generic gates and generic flip-flops, not library cells"],
          ["Flip-flops inferred", fmt(M.flops) + ", from the always blocks"],
          ["Hierarchy", "flattened: the module boundaries are gone, so optimization can cross them"],
        ]) + checks([
          ["Flattening is a trade.",
           "With the boundaries gone, logic in the hub can be merged with logic in a controller, which " +
           "is usually worth a few percent of area. What is lost is the ability to reason about, " +
           "reuse or replace a module on its own, which is why a large chip keeps some boundaries " +
           "and flattens the rest."],
          ["The tool infers flip-flops; it does not invent them.",
           fmt(M.flops) + " flip-flops came from assignments to registers in the source. If the " +
           "source accidentally describes a latch, one appears here too, which is why flows check " +
           "for them and usually treat one as an error."],
          ["Sharing is where an operator count stops matching the source.",
           "Two adders behind a multiplexer in the source can become one adder with multiplexed " +
           "inputs, which is smaller and slower. Whether that is a good trade depends on the clock " +
           "period, which is why the constraint file is read before this and not after."],
        ]),
      };
    },
  });

  STEPS.push({
    n: 3, title: "Build the arithmetic", button: "Map the adders", againLabel: "Map again",
    line: "An add can be small or fast. The mapper picks, and the constraint decides.",
    intro:
      "<p>Addition is the one place in ordinary logic where the structure matters more than the " +
      "gates. A carry has to get from the least significant bit to the most significant one, and how " +
      "it gets there is a choice.</p>" +
      "<p>The simple way is a <strong>ripple carry</strong>: one full adder per bit, each waiting for " +
      "the carry out of the one below. It is as small as an adder can be, and its delay grows with " +
      "the width. The other way is a <strong>prefix tree</strong>, which computes all the carries at " +
      "once in a few levels of logic. It is faster and larger, and the wider the adder, the more " +
      "lopsided that trade becomes.</p>",
    command:
      "# find the adders the generic logic is hiding, and build them properly\n" +
      "extract_fa\n" +
      "techmap -map lcu_kogge_stone.v\n" +
      "techmap\n" +
      "opt -fast -purge",
    commandNote:
      "<code>extract_fa</code> recognises full and half adders in the generic logic, and the map file " +
      "says how to build the carry network: the reference flow ships a Kogge-Stone lookahead unit and " +
      "passes it here by default. Leave the map file out and the tool builds a ripple carry, which on " +
      "a wide adder is the difference between meeting the clock and not.",
    run: function () {
      var M = model();
      return {
        log: [
          { k: "cmd", t: "extract_fa" },
          { k: "out", t: "  Extracting full/half adders: 412 found" },
          { k: "cmd", t: "techmap -map lcu_kogge_stone.v" },
          { k: "out", t: "  Mapped 38 carry chains to prefix trees" },
          { k: "cmd", t: "techmap" },
          { k: "cmd", t: "opt -fast -purge" },
          { k: "ok", t: "The arithmetic is built for speed, not for size." },
        ],
        figure: '<p class="ff3-figtext">Watch the same eight bit add built both ways. First the ' +
          "ripple carry: the carry crosses one bit at a time, so the last bit cannot settle until " +
          "every bit below it has. Then the prefix tree: three levels of logic compute every carry " +
          "together. Eight gate delays become three, and the gate count roughly doubles.</p>" +
          adderFigure(M),
        after: function () { adderAnimate(M); },
        report: "<h3>Arithmetic mapping</h3>" + table([
          ["Adders found", "412 full and half adders in the generic logic"],
          ["Carry chains rebuilt", "38, as Kogge-Stone prefix trees"],
          ["Ripple carry", "delay grows with the width; smallest possible"],
          ["Prefix tree", "delay grows with the logarithm of the width; roughly twice the gates"],
          ["Who decides", "the map file the flow passes, driven by the clock period in the constraints"],
        ]) + checks([
          ["This is the one structural decision synthesis makes.",
           "Almost everything else the mapper does is local: cover these few nodes with that cell. The " +
           "carry network is a decision about the shape of the whole computation, and no amount of " +
           "later placement or routing can undo it."],
          ["Wide adders are where it matters.",
           "At eight bits the ripple carry is only a few gate delays behind. At thirty-two it is " +
           "hopeless at any serious clock, which is why a flow that targets a tight period maps every " +
           "carry chain to a tree and accepts the area."],
          ["The same trade appears again later.",
           "The clock tree example built a balanced tree rather than a chain for exactly this reason, " +
           "and for exactly the same cost in cells. Depth against size is the recurring shape of this " +
           "whole field."],
        ]),
      };
    },
  });

  STEPS.push({
    n: 4, title: "Map the flip-flops", button: "Map the flip-flops", againLabel: "Map again",
    line: "Generic registers become the sequential cells this library actually has.",
    intro:
      "<p>The generic flip-flops the design inferred are idealised: any combination of reset, set and " +
      "enable, active high or low. A real library has a handful of shapes and no others. Mapping " +
      "them is a matter of matching what the design asked for against what exists, and building the " +
      "difference out of logic.</p>" +
      "<p>The interesting cases are the ones that do not match. A flip-flop with a clock enable is " +
      "common in register transfer level code and often absent from the library, so it becomes a " +
      "plain flip-flop with a multiplexer feeding back its own output. That works, and it costs an " +
      "extra cell on every such register, which is why clock gating exists.</p>",
    command:
      "dfflibmap -liberty stdcells_tt.lib -dont_use {" + OPT.dontUse + "}\n" +
      "opt",
    commandNote:
      "The sequential cells are mapped separately from the logic, and before it, because their choice " +
      "changes what logic is needed. The <code>-dont_use</code> list keeps the mapper away from cells " +
      "the flow does not want: the physical-only cells, the many-pin compounds, the scan flip-flops, " +
      "and the clock gating cells, which this flow inserts later if at all. It is the same list the " +
      "placement example hands to <code>set_dont_use</code>.",
    run: function () {
      var M = model();
      return {
        log: [
          { k: "cmd", t: "dfflibmap -liberty stdcells_tt.lib -dont_use {" + OPT.dontUse + "}" },
        ].concat(M.dff.map(function (d) {
          return { k: "out", t: "  " + d.gen.padEnd(12) + " -> " + d.lib.padEnd(20) + fmt(d.n) };
        })).concat([
          { k: "out", t: "  " + fmt(M.flops) + " flip-flops mapped in total" },
          { k: "cmd", t: "opt" },
          { k: "ok", t: "Every register in the design is now a cell that exists." },
        ]),
        figure: '<p class="ff3-figtext">Three shapes, three answers. A plain flip-flop maps to the ' +
          "simplest cell there is. One with an active-low reset maps directly, because this library " +
          "has that cell. One with a clock enable has no match, so it becomes a flip-flop and a " +
          "multiplexer that feeds the old value back when the enable is low. That last row is " +
          fmt(M.dff[2].n) + " extra cells the source never asked for.</p>" +
          '<table class="ff-table"><tr><th>What the design inferred</th><th>What the library has</th>' +
          "<th>How many</th><th>Why</th></tr>" +
          M.dff.map(function (d) {
            return "<tr><td><code>" + d.gen + "</code></td><td><code>" + d.lib + "</code></td><td>" +
              fmt(d.n) + "</td><td>" + d.why + "</td></tr>";
          }).join("") + "</table>" +
          '<p class="ff3-figtext">The running count gains its fourth row, and does not move: mapping ' +
          "the registers swapped generic cells for library cells one for one. The enabled ones " +
          "brought their multiplexers with them, and those multiplexers were already in the count " +
          "from <code>techmap</code>.</p>" + countFigure(M, 3, 4),
        report: "<h3>Sequential mapping</h3>" + table([
          ["Flip-flops mapped", fmt(M.flops)],
          ["Cells this needed", fmt(M.flops + M.dff[2].n) + ", because the enabled ones take two"],
          ["Area they occupy", fmt(Math.round(M.flopArea)) + " square micrometers, " +
            Math.round(100 * M.flopArea / M.area) + "% of the design"],
          ["Excluded masters", "the smallest drive strengths, scan cells, and clock gates"],
        ]) + checks([
          ["The flip-flops set the floor.",
           "They are the largest cells in the design and the only ones whose count synthesis cannot " +
           "reduce: the design needs the state it needs. Everything the later stages optimize happens " +
           "around a fixed skeleton of " + fmt(M.flops) + " registers, which is also why the clock " +
           "tree example had exactly that many sinks to reach."],
          ["A missing cell shape costs area everywhere it is used.",
           fmt(M.dff[2].n) + " enabled registers became " + fmt(M.dff[2].n) + " extra multiplexers. " +
           "On a design with heavy enables this is the single best argument for clock gating, which " +
           "removes the mux and saves the clock power as well."],
          ["Mapping the registers first is not arbitrary.",
           "The logic mapper works on the cone of combinational logic between registers, so it needs " +
           "to know where the registers are and what they cost before it starts."],
        ]),
      };
    },
  });

  STEPS.push({
    n: 5, title: "Map the logic", button: "Map the logic", againLabel: "Map again",
    line: "Cover the graph of generic gates with the library's cells, as cheaply as the constraint allows.",
    intro:
      "<p>This is the step that makes the design technology specific, and it is a covering problem. " +
      "The logic is a graph of two-input ANDs and inversions. A library cell implements some small " +
      "piece of that graph: a NAND2 covers one node, an AOI21 covers three, a complex cell covers " +
      "more. Every node has to be covered by exactly one cell, and there are many ways to do it.</p>" +
      "<p>Which covering is best depends on what you are asking for. The cheapest in area is rarely " +
      "the fastest, so the mapper is given the clock period and a description of the driver and load " +
      "at the boundary, and it optimizes against those. That is the whole purpose of the constraint " +
      "file at this point in the flow.</p>",
    command:
      "setundef -zero\n" +
      "abc -liberty stdcells_tt.lib -constr abc.constr -D " + OPT.abcTargetPs +
      " -dont_use {" + OPT.dontUse + "}",
    commandNote:
      "<code>-D " + OPT.abcTargetPs + "</code> is the clock period in picoseconds, and " +
      "<code>abc.constr</code> names the cell driving the inputs and the load on the outputs, so the " +
      "mapper knows what the edges of the design look like. <code>setundef -zero</code> first, " +
      "because a don't-care value has to become something definite before it can be built.",
    run: function () {
      var M = model();
      var covered = M.stages[2].cells - M.stages[4].cells;
      return {
        log: [
          { k: "cmd", t: "setundef -zero" },
          { k: "cmd", t: "abc -liberty stdcells_tt.lib -constr abc.constr -D " + OPT.abcTargetPs +
                         " -dont_use {" + OPT.dontUse + "}" },
          { k: "out", t: "  Extracting gate netlist of module `\\" + OPT.top + "' to `<abc-temp-dir>/input.blif'.." },
          { k: "out", t: "  Executed ABC." },
          { k: "out", t: "  Re-integrating ABC results." },
          { k: "out", t: "  " + fmt(M.stages[2].cells - M.flops) + " generic gates covered by " +
                         fmt(M.comb) + " library cells" },
          { k: "out", t: "  estimated worst path: 1.65 ns against the " + f1(M.period) +
                         " ns target, on a wire-load model" },
          { k: "ok", t: "The design is made of cells this process can build." },
        ],
        figure: '<p class="ff3-figtext">A small cone of that graph, and the covering the mapper ' +
          "chooses for it. Watch each cell take its group of nodes: one node for a plain gate, three " +
          "for a complex one. This is why the cell count falls even though not a single logic " +
          "function has changed. Across the design it takes " + fmt(M.stages[2].cells - M.flops) +
          " generic gates down to " + fmt(M.comb) + " library cells, about " + f2(COST.coverRatio) +
          " gates each.</p>" + aigFigure(M) +
          '<p class="ff3-figtext">Which is the last row of the running count, and the only one that ' +
          "goes down. It appears when the covering above finishes.</p>" + countFigure(M, 3, 5),
        after: function () { aigAnimate(M); },
        report: "<h3>Technology mapping</h3>" + table([
          ["Generic gates in", fmt(M.stages[2].cells - M.flops) + ", the combinational ones: the " +
            fmt(M.flops) + " registers were mapped in the step before"],
          ["Library cells out", fmt(M.comb) + " combinational, plus the " + fmt(M.flops) + " flip-flops"],
          ["Cells removed by covering", fmt(covered) + ", without changing what the logic does"],
          ["Target", OPT.abcTargetPs + " picoseconds, the clock period"],
          ["Estimated worst path", "1.65 nanoseconds, on a wire-load model"],
        ]) + checks([
          ["The estimate here is the worst one in the flow.",
           "There are no positions yet, so the wire delay comes from a table of fanout against " +
           "expected length. The placement example replaces it, global routing improves it again, and " +
           "the timing example finally measures it. Synthesis timing being optimistic is normal; " +
           "synthesis timing being wildly optimistic is what makes a design fail to close later."],
          ["The constraint is doing real work.",
           "Change <code>-D</code> and the covering changes: a looser target buys smaller cells and " +
           "less area, a tighter one buys bigger drive strengths and duplicated logic. Synthesizing " +
           "against no constraint at all produces a design that is small, slow, and impossible to fix " +
           "downstream."],
          ["Covering is not the same as optimizing.",
           "The mapper is choosing how to build a fixed piece of logic. The logic itself was decided " +
           "in step 2, and no library cell choice recovers from a bad structural decision like a " +
           "ripple carry on a critical path."],
        ]),
      };
    },
  });

  STEPS.push({
    n: 6, title: "Clean up and check", button: "Check the netlist", againLabel: "Check again",
    line: "Split the buses, tie off the constants, and prove the result is a legal netlist.",
    intro:
      "<p>What comes out of the mapper is correct but not yet tidy. Multi-bit wires have to be split " +
      "into single bits, because a gate-level netlist has no concept of a bus. Constant ones and " +
      "zeros have to be driven by real tie cells, because a physical design cannot connect an input " +
      "to a word. Anything left unconnected has to be caught now rather than in the layout.</p>" +
      "<p>Then the design is counted. The statistics here are the numbers every later stage inherits, " +
      "and the first line of the floorplan example's own report.</p>",
    command:
      "# split every multi-bit net into single-bit nets. A gate-level netlist\n" +
      "# has no buses: acc[7:0] becomes eight separate wires, which is the only\n" +
      "# form placement and routing understand\n" +
      "splitnets\n" +
      "\n" +
      "# and sweep again, because splitnets leaves the old wide nets behind\n" +
      "opt_clean -purge\n" +
      "\n" +
      "# a constant cannot be an input connected to the word 1 or 0: give it a\n" +
      "# real driver. -singleton makes one tie cell serve every constant bit\n" +
      "# rather than one cell per bit\n" +
      "hilomap -singleton -hicell LOGIC1_X1 Z -locell LOGIC0_X1 Z\n" +
      "\n" +
      "# put a buffer wherever an input is wired straight through to an output,\n" +
      "# since a net cannot simply be another net once this is a real circuit\n" +
      "insbuf -buf BUF_X1 A Z\n" +
      "\n" +
      "# the gate: combinational loops, wires with two drivers, wires with none,\n" +
      "# and with -mapped, anything still generic. -assert turns each into an error\n" +
      "check -assert -mapped\n" +
      "\n" +
      "# count what is left, with areas from the library, which is where the\n" +
      "# numbers the rest of the flow inherits come from\n" +
      "stat -liberty stdcells_tt.lib",
    commandNote:
      "<code>check -assert -mapped</code> is the gate that matters: it fails the run if anything is " +
      "still generic, undriven or multiply driven. Running it here means a broken netlist stops the " +
      "flow at synthesis rather than surviving into placement, where the symptom is much further " +
      "from the cause.",
    run: function () {
      var M = model();
      var stat =
        "=== " + OPT.top + " ===\n" +
        "\n" +
        "   Number of wires:              " + String(fmt(M.nets)).padStart(12) + "\n" +
        "   Number of wire bits:          " + String(fmt(M.nets + 1180)).padStart(12) + "\n" +
        "   Number of ports:              " + String(fmt(M.ports)).padStart(12) + "\n" +
        "   Number of port bits:          " + String(fmt(M.portBits)).padStart(12) + "\n" +
        "   Number of cells:              " + String(fmt(M.cells)).padStart(12) + "\n" +
        "     AOI21_X1                    " + String(fmt(5142)).padStart(12) + "\n" +
        "     BUF_X1                      " + String(fmt(2310)).padStart(12) + "\n" +
        "     DFFR_X1                     " + String(fmt(M.dff[1].n)).padStart(12) + "\n" +
        "     DFF_X1                      " + String(fmt(M.dff[0].n + M.dff[2].n)).padStart(12) + "\n" +
        "     INV_X1                      " + String(fmt(6884)).padStart(12) + "\n" +
        "     NAND2_X1                    " + String(fmt(9903)).padStart(12) + "\n" +
        "     NAND3_X1                    " + String(fmt(4127)).padStart(12) + "\n" +
        "     OAI21_X1                    " + String(fmt(5510)).padStart(12) + "\n" +
        "     ... 24 more cell types\n" +
        "     mem_square                  " + String(2).padStart(12) + "\n" +
        "     mem_wide                    " + String(2).padStart(12) + "\n" +
        "\n" +
        "   Chip area for module '\\" + OPT.top + "': " + fmt(M.area) + ".000000";
      return {
        log: [
          { k: "cmd", t: "splitnets" },
          { k: "cmd", t: "opt_clean -purge" },
          { k: "out", t: "  Removed 1,204 unused cells and 3,318 unused wires." },
          { k: "cmd", t: "hilomap -singleton -hicell LOGIC1_X1 Z -locell LOGIC0_X1 Z" },
          { k: "out", t: "  Added 2 tie cells for constant drivers." },
          { k: "cmd", t: "insbuf -buf BUF_X1 A Z" },
          { k: "cmd", t: "check -assert -mapped" },
          { k: "out", t: "  found and reported 0 problems." },
          { k: "cmd", t: "stat -liberty stdcells_tt.lib" },
          { k: "out", t: "  " + fmt(M.cells) + " cells, " + fmt(M.area) + " um^2, 4 macro instances" },
          { k: "ok", t: "A legal gate-level netlist, and the numbers the rest of the flow inherits." },
        ],
        figure: '<p class="ff3-figtext">The count over the whole run, now with the last bar in ' +
          "place. It climbed from " + fmt(M.stages[0].cells) + " to " + fmt(M.stages[2].cells) +
          " while the logic was taken apart, and came back to " + fmt(M.cells) +
          " once library cells covered it. Below is the design as the flow will describe it from " +
          "here on.</p>" + countFigure(M) +
          '<pre class="pl-report">' + esc(stat) + "</pre>",
        report: "<h3>The design, counted</h3>" + table([
          ["Cells", fmt(M.cells) + ", of which " + fmt(M.flops) + " are flip-flops"],
          ["Macro instances", "4, still black boxes"],
          ["Nets", fmt(M.nets)],
          ["Ports", fmt(M.portBits) + " bits"],
          ["Cell area", fmt(M.area) + " square micrometers"],
          ["Checks", "no generic cells, nothing undriven, nothing driven twice"],
        ]) + checks([
          ["These numbers are the contract with the next stage.",
           "The floorplan example opens by reading exactly this: " + fmt(M.cells) + " cells needing " +
           fmt(M.area) + " square micrometers, four macros to place, and " + fmt(M.portBits) +
           " port bits to put somewhere on the boundary. Every decision it makes is downstream of " +
           "this line."],
          ["Tie cells look trivial and are not.",
           "A constant has to be driven by something the process can build, and that cell has to be " +
           "placed and routed like any other. Leaving constants as literals is a classic way to " +
           "produce a netlist that cannot be laid out."],
          ["Splitting buses is what makes the netlist physical.",
           "After this the design has no buses, only individual wires, which is the only form " +
           "placement and routing understand. It is also why the net count and the wire bit count " +
           "stop matching the source's."],
        ]),
      };
    },
  });

  STEPS.push({
    n: 7, title: "Write it out", button: "Write the netlist", againLabel: "Write again",
    line: "Save the netlist and the constraints, and hand them to the floorplan.",
    intro:
      "<p>Two files leave this stage. The netlist is what the design is; the constraints are what it " +
      "has to achieve. Neither mentions a position, a wire or a layer, which is exactly the boundary " +
      "between the two halves of the flow: everything up to here is about logic, and everything after " +
      "it is about where that logic goes.</p>",
    command:
      "# plain structural Verilog: no tool attributes, no hex or decimal literals,\n" +
      "# because every other tool in the flow has to read this\n" +
      "write_verilog -noattr -nohex -nodec results/tile4m.v\n" +
      "\n" +
      "# the constraints are not produced here. They were written by hand, read in\n" +
      "# to drive the mapping, and travel on unchanged\n" +
      "exec cp constraints/tile4m.sdc results/tile4m.sdc",
    run: function () {
      var M = model();
      return {
        log: [
          { k: "cmd", t: "write_verilog -noattr -nohex -nodec results/tile4m.v" },
          { k: "out", t: "  " + fmt(M.cells) + " instances written, " + fmt(M.nets) + " nets" },
          { k: "cmd", t: "exec cp constraints/tile4m.sdc results/tile4m.sdc" },
          { k: "ok", t: "Synthesis complete. Next stage: floorplanning." },
        ],
        figure: '<p class="ff3-figtext">Both files, as they leave. Click between them.</p>' +
          fileViewer(M) +
          '<p class="ff3-figtext">And what the floorplan has to find room for: ' +
          fmt(M.area) + " square micrometers, in the proportion below. The flip-flops are " +
          Math.round(100 * M.flops / M.cells) + "% of the cells and " +
          Math.round(100 * M.flopArea / M.area) + "% of the area, and they are also the " +
          fmt(M.flops) + " sinks the clock tree will have to reach three stages from now.</p>" +
          areaFigure(M),
        after: function () { fileViewerInit(); },
        report: "<h3>What floorplanning starts from</h3>" + table([
          ["Known", "every instance, every connection, and the clock it has to meet"],
          ["Unknown", "the die size, where anything goes, and every wire in the design"],
          ["Continue the design", 'the <a href="/explore/examples/floorplan">floorplan example</a> ' +
            "opens these two files on its first step"],
        ]) + checks([
          ["Synthesis is where the die size is really decided.",
           "The floorplan chooses a utilization, but the area it is dividing up came from here. A " +
           "design synthesized twenty percent larger needs a bigger die, which needs longer wires, " +
           "which needs more buffers. Nothing downstream recovers that."],
          ["The constraints outlive the stage.",
           "The same file drives the mapping here, the repair after placement, the clock tree's " +
           "balancing, the router's timing repair, and the final sign-off. If it is wrong, every " +
           "stage is optimizing the wrong thing, correctly."],
          ["One more check belongs here in a real flow.",
           "Formal equivalence: proving that the netlist computes the same function as the source. " +
           "Synthesis is a long chain of transformations, and this is the only way to know that none " +
           "of them changed the design's meaning."],
        ]),
      };
    },
  });

  var STAGE = {
    key: "synthesis",
    steps: STEPS,
    finishedTitle: "Synthesis complete.",
    finishedNote: "The design is a gate-level netlist with a set of constraints, and nothing about it " +
      'is physical yet. Next is <a href="/explore/examples/floorplan">floorplanning</a>, which reads ' +
      "these two files on its first step.",
    epilogue:
      "<h3>How this differs from a production synthesis</h3>" +
      "<p>The passes and their order are real. What a production run adds is mostly about scale and " +
      "about proof:</p>" +
      '<ul class="ff-checks">' +
      "<li><strong>It is physically aware.</strong> This run has no idea where anything will go, so " +
      "its wire delays come from a table. A modern synthesis tool places the cells roughly as it " +
      "maps them, and optimizes against that placement, which is the single largest quality gap " +
      "between the open flow and a commercial one.</li>" +
      "<li><strong>It is checked formally.</strong> An equivalence checker proves the netlist matches " +
      "the source after every major transformation. Without it, an optimization bug is a silicon bug " +
      "that no amount of layout verification will catch.</li>" +
      "<li><strong>It is constrained for more than one mode.</strong> Real blocks have functional " +
      "modes, test modes, and several clocks that interact. Synthesis meets all of them at once, or " +
      "the later stages inherit a netlist that cannot.</li>" +
      "<li><strong>It handles test.</strong> Production designs replace ordinary flip-flops with scan " +
      "flip-flops and stitch them into chains, so the manufactured chip can be tested. That is a " +
      "cell swap on every register in the design, and this example's <code>-dont_use</code> list " +
      "quietly excludes exactly those cells.</li></ul>",
    footNote: 'The netlist this writes is the file the <a href="/explore/examples/floorplan">floorplan ' +
      "example</a> opens first.",
  };
  if (typeof window !== "undefined" && window.FLOW_PAGE_STAGE === STAGE.key) window.FLOW_STAGE = STAGE;

  return { OPT: OPT, model: model, STAGE: STAGE, STEPS: STEPS };
})();

if (typeof module !== "undefined" && module.exports) module.exports = SynthesisSteps;
