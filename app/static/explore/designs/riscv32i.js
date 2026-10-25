/* riscv32i: the first whole design you can take through the flow in the
   browser. Everything here is read from the design's own files in
   OpenROAD-flow-scripts (flow/designs/src/riscv32i and
   flow/designs/asap7/riscv32i) and from the real runs of it. */

window.DESIGN = {
  key: "riscv32i",
  title: "riscv32i",
  short: "riscv32i",
  lead: "riscv32i, a small processor for the RISC-V (Reduced Instruction Set Computer, fifth generation) instruction set, taken through the OpenROAD flow with settings you choose.",

  facts: [
    ["What it is", "a 32-bit processor that runs the base integer instructions of RISC-V (Reduced Instruction Set Computer, fifth generation), with a boot memory and a data memory"],
    /* each claim links to the file that makes it, pinned to the commit
       the served copy was taken from */
    ["Where it comes from",
      'created for an undergraduate course at Oklahoma State University, as its ' +
      '<a href="https://github.com/The-OpenROAD-Project/OpenROAD-flow-scripts/blob/bde10c79a2389ffe9c5d73445f177f81262059f9/flow/designs/src/riscv32i/README.md">README</a> says. ' +
      'The header of its data memory file, <a href="#dz-viewer" class="dz-cite" data-mod="dmem">dmem.v</a>, names James E. Stine and the ' +
      "ECEN (Electrical and Computer Engineering) 4243 course. It ships as a test design with " +
      '<a href="https://github.com/The-OpenROAD-Project/OpenROAD-flow-scripts/tree/bde10c79a2389ffe9c5d73445f177f81262059f9/flow/designs/src/riscv32i">OpenROAD-flow-scripts</a>.'],
    ["Size", "24 modules in 1,081 lines of Verilog"],
    ["Top-level pins", "clock and reset, a 32-bit instruction input, the program counter, and the data memory's address and write data"],
    ["The register file", "32 registers of 32 bits, built from flip-flops"],
    ["The memory", "four memory macros, each 256 words by 32 bits (<code>fakeram7_256x32</code>), 4 kilobytes in all; " +
      "the top address bits pick which of the four answers"],
    ["The process", "ASAP7 (the Arizona State University 7 nanometer predictive process design kit), an open process made for teaching and research"],
  ],

  /* the module tree, as instantiated; counts are instances */
  hierarchy: {
    name: "riscv_top", note: "the chip",
    kids: [
      { name: "riscv", note: "the processor", kids: [
        { name: "controller", note: "decodes each instruction", kids: [
          { name: "maindec", note: "the main decoder" },
          { name: "aludec", note: "picks the arithmetic operation" },
          { name: "mux2", count: 2 },
        ] },
        { name: "datapath", note: "where the data moves", kids: [
          { name: "regfile", note: "32 registers of 32 bits" },
          { name: "alu", note: "the arithmetic logic unit: add, subtract, logic" },
          { name: "shifter" },
          { name: "magcompare32", note: "compares for branches", kids: [
            { name: "magcompare2b", count: 16 }, { name: "magcompare2c", count: 15 },
          ] },
          { name: "adder", count: 2, note: "the next program counter, and branch targets" },
          { name: "signext", note: "widens immediates" },
          { name: "flopr", note: "the program counter" },
          { name: "flopenr" },
          { name: "mux2", count: 10 },
          { name: "mux3", count: 2 },
        ] },
      ] },
      { name: "ROM", note: "the boot code, as instance boot" },
      { name: "dmem", note: "the data memory", kids: [
        { name: "fakeram7_256x32", count: 4, note: "one memory macro per bank" },
      ] },
      { name: "mux2", note: "picks the boot memory or external instructions" },
    ],
  },

  /* the flow's own settings for this design (config.mk and constraint.sdc) */
  defaults: [
    ["Clock period", "950 picoseconds", "constraint.sdc"],
    ["Core utilization", "62%", "CORE_UTILIZATION"],
    ["Core margin", "5 micrometers", "CORE_MARGIN"],
    ["Placement density", "the minimum the placer needs, plus 0.10", "PLACE_DENSITY_LB_ADDON"],
    ["Halo around the memory", "2 micrometers each way", "MACRO_PLACE_HALO"],
    ["Clock tree clusters", "up to 10 flip-flops, 50 micrometers across", "CTS_CLUSTER_SIZE, CTS_CLUSTER_DIAMETER"],
  ],

  /* the stages a run goes through, with the walkthrough page for each */
  stages: [
    { k: "synthesis", name: "Synthesis" },
    { k: "floorplan", name: "Floorplanning" },
    { k: "placement", name: "Placement" },
    { k: "cts", name: "Clock tree" },
    { k: "routing", name: "Routing" },
    { k: "timing", name: "Timing" },
    { k: "finish", name: "Finishing" },
  ],

  /* one real run's finished layout, rendered from its 6_final.def: every
     placed cell at its library size, the four memory macros, and the routed
     metal. The run is the clock-period sweep's 1,138 picosecond point,
     synthesized with the classic resyn2 recipe (see engine.reference). */
  layout: {
    src: "/static/explore/designs/riscv32i-layout.png",
    caption: "The finished layout of one real run of the flow, at a 1,138 picosecond clock: the four memory " +
      "macros in the upper right, the logic packed around them (flip-flops in violet, the rest in grey, fillers " +
      "in the gaps), and every routed wire, one colour per metal layer. The die is 73 micrometers square.",
  },

  blockCaption: "What that layout implements, drawn from the Verilog: every block is a real instance and every " +
    "wire a real connection, main paths only. Each instruction is fetched at the program counter's address, " +
    "reads its registers, goes through the arithmetic logic unit or the shifter, may read or write the data " +
    "memory, and writes its result back. Dashed lines are control, into and out of the controller.",

  /* the Verilog, served as shipped: copied unmodified from
     OpenROAD-flow-scripts flow/designs/src/riscv32i at commit bde10c79
     (2026-07-09), with its Apache 2.0 license beside it */
  sources: {
    dir: "/static/explore/designs/riscv32i-src/",
    license: "LICENSE",
    licenseName: "Apache License 2.0",
    origin: "OpenROAD-flow-scripts, flow/designs/src/riscv32i, unmodified",
    files: {
      riscv_top: "top.v", riscv: "riscv.v", controller: "controller.v", maindec: "maindec.v",
      aludec: "aludec.v", datapath: "datapath.v", regfile: "regfile.v", alu: "alu.v", shifter: "shifter.v",
      magcompare32: "magcompare32.v", magcompare2b: "magcompare2b.v", magcompare2c: "magcompare2c.v",
      adder: "adder.v", signext: "signext.v", flopr: "flopr.v", flopenr: "flopenr.v", flopens: "flopens.v",
      mux2: "mux2.v", mux3: "mux3.v", mux4: "mux4.v", mux5: "mux5.v", mux8: "mux8.v",
      ROM: "rom.v", dmem: "dmem.v",
    },
    blackbox: {
      fakeram7_256x32: "a memory macro: it has no Verilog, only a timing model and a layout abstract from the memory's own files",
    },
    start: "riscv_top",
  },

  /* the browser engine: what it runs on, the knobs it offers, and the real
     run it is compared with. The reference numbers are read from that run's
     own logs and reports (2_1_floorplan.log, 3_3_place_gp.log, 3_5_place_dp.log,
     4_1_cts.log, 5_1_grt.json, 5_2_route.log and .json, 6_finish.rpt and
     6_report.json). */
  engine: {
    worker: "/static/explore/engine/engine-worker.js",
    net: "/static/explore/designs/riscv32i-net.json",
    lib: "/static/explore/designs/asap7-lib.json",
    knobs: [
      { k: "period", label: "Clock period", kind: "range", min: 900, max: 1400, step: 2, value: 1138, unit: "ps",
        help: "How long each clock cycle is. Shorter is a faster chip, and harder to meet.",
        flow: "the reference run used 1,138 picoseconds (the design's own constraint file asks for 950)" },
      { k: "util", label: "Core utilization", kind: "range", min: 0.40, max: 0.80, step: 0.01, value: 0.62, pct: true,
        help: "How much of the core the cells and memories fill. Lower means a bigger die with more room.",
        flow: "the flow uses 62% (CORE_UTILIZATION)" },
      { k: "macros", label: "Where the four memories go", kind: "select", value: "flow",
        options: [["flow", "top edge, packed right (as the flow placed them)"], ["topleft", "top edge, packed left"],
                  ["split", "two in each top corner"], ["middle", "a row across the middle"],
                  ["bottom", "bottom edge, where the pins are"]],
        help: "The memories are fixed blocks the cells must work around. The pins are all on the bottom edge.",
        flow: "the flow placed them along the top edge, on the right" },
      { k: "density", label: "Placement density target", kind: "range", min: 0.60, max: 1.00, step: 0.01, value: 0.79,
        help: "How tightly the placer may pack cells in any one spot. Higher packs tighter, shorter wires, more crowding.",
        flow: "the real run used 0.794" },
      { k: "ctsSize", label: "Clock tree: flip-flops per cluster", kind: "range", min: 4, max: 30, step: 1, value: 10, unit: "",
        help: "Each group of flip-flops gets one buffer at the bottom of the clock tree. Bigger groups mean fewer buffers but longer wires inside each group.",
        flow: "the flow uses 10 (CTS_CLUSTER_SIZE)" },
      { k: "ctsDiam", label: "Clock tree: widest cluster", kind: "range", min: 20, max: 100, step: 5, value: 50, unit: "µm",
        help: "No group of flip-flops may be spread wider than this.",
        flow: "the flow uses 50 micrometers (CTS_CLUSTER_DIAMETER)" },
    ],
    reference: {
      what: "a real run of the flow at a 1,138 picosecond clock",
      util: 0.62,
      die: 73.15, globalHpwl: 36232, legalHpwl: 38743, improvedHpwl: 37546, avgDisp: 0.3, maxDisp: 35.5,
      rows: 233, density: 0.794, placeWns: [-285.2, -285.2],
      cts: { clusters: 106, buffers: 134, levels: 3, skew: 38.2, delayBuffers: 5 },
      route: { global: 66719, detailed: 51350, globalVias: 91001, vias: 106210,
               layers: { M2: 11232, M3: 20709, M4: 11091, M5: 4309, M6: 2808, M7: 1199 } },
      repair: { buffers: 526, bufferArea: 49.2, ports: 131, design: 192, designNets: 74, resized: 70 },
      timing: { period: 1138, wns: -3.89, tns: -87.9, gates: 31 },
      power: { total: 25.29, internal: 17.22, switching: 7.55, leakage: 0.516,
               groups: { sequential: 2.07, combinational: 10.9, clock: 2.14, macro: 10.2 },
               detail: { sequential: [1.85, 0.22, 0.000134], combinational: [4.22, 6.67, 0.000622],
                         clock: [1.47, 0.666, 0.0000577], macro: [9.68, 0, 0.516] } },
      area: { die: 5350.48, core: 3967.86, macro: 1404.48, std: 1202.3 },
      finish: { fillers: 8660, fillArea: 481.8 },
      /* wall-clock seconds for floorplan through the final report: the sum
         of the "Elapsed time" line of every 2_* to 6_* log (detailed
         routing alone is 261 of them) */
      runSeconds: 364,
    },
    stages: { floorplan: true, placement: true, cts: true, routing: true, timing: true, finish: true },
    /* the real clock sweep: eight runs of the flow at the same settings but
       for the clock period, each read from its own 6_finish.rpt (worst and
       total negative slack) and 6_report.json (power, standard-cell area
       without memories or fillers, and repair buffers) */
    sweep: {
      periods: [900, 950, 976, 1021, 1036, 1041, 1100, 1138, 1165, 1205, 1250, 1300, 1400],
      secondsPerRun: 1.3,
      real: [
        { period: 976, wns: -40.74, tns: -22416.1, power: 30.33, area: 1233.7, buffers: 804 },
        { period: 1021, wns: -10.52, tns: -529.3, power: 28.54, area: 1218.1, buffers: 658 },
        { period: 1036, wns: -0.57, tns: -1.65, power: 28.10, area: 1217.2, buffers: 644 },
        { period: 1041, wns: -71.42, tns: -39145.7, power: 27.95, area: 1214.1, buffers: 621 },
        { period: 1100, wns: -15.96, tns: -992.5, power: 26.24, area: 1206.9, buffers: 576 },
        { period: 1138, wns: -3.89, tns: -87.9, power: 25.29, area: 1202.3, buffers: 526 },
        { period: 1165, wns: -16.84, tns: -1460.0, power: 24.66, area: 1201.3, buffers: 504 },
        { period: 1205, wns: -50.24, tns: -18624.8, power: 24.07, area: 1201.4, buffers: 519 },
      ],
      realNote: "The real flow never quite closes timing in these eight runs, and its worst slack jumps around " +
        "from one clock to the next: it misses by only 0.6 picoseconds at 1,036 but by 71 at 1,041. Each run's " +
        "placement and repair start from slightly different conditions and land in different places, so a single " +
        "real run is one sample, not the curve. Its power and area move steadily, though: a faster clock switches " +
        "everything more often, and the repair adds more and bigger gates to keep up.",
    },

    /* how close the engine gets at the flow's own settings, measured against
       the reference run; shown under "How this engine works" */
    closeness: [
      ["Die size", "the same, 73.2 micrometers square"],
      ["Placement wirelength", "within about 2% of the real placer's after legalization (38,175 against 38,743 micrometers)"],
      ["Clock tree", "the same shape: 106 clusters, a 3-level H-tree, 124 buffers against the real 134"],
      ["Routing wirelength", "about 6% shorter than the real global router's"],
      ["Worst slack", "+35 picoseconds where the real run has -3.9 at 1,138 picoseconds. Across the sweep the " +
       "engine closes timing from about 1,095 picoseconds, where the real flow comes within a picosecond at " +
       "1,036: about 6% slower, because its repair has fewer moves than the real one"],
      ["Power", "about 12% low, most of it in the flip-flops' and clock buffers' internal energy"],
    ],
  },

  knobs: [],     /* the engine's knobs above are the live ones */
  runs: [],      /* to be defined */
};

/* The block diagram, drawn from datapath.v, controller.v and top.v: the
   blocks are the real instances and the wires are the real connections,
   main paths only (the unused interrupt-return mux, the byte and halfword
   formatting on loads and stores, and most control wires are left out). */
window.DESIGN.blockDiagram = function () {
  var o = [];
  function box(x, y, w, h, cls, l1, l2) {
    o.push('<rect class="bd-box ' + cls + '" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="5"/>');
    o.push('<text class="bd-t" x="' + (x + w / 2) + '" y="' + (y + h / 2 + (l2 ? -3 : 4)) + '">' + l1 + "</text>");
    if (l2) o.push('<text class="bd-s" x="' + (x + w / 2) + '" y="' + (y + h / 2 + 12) + '">' + l2 + "</text>");
  }
  function mux(x, y, h) {                        /* a trapezoid, narrow at its output */
    o.push('<path class="bd-mux" d="M' + x + "," + y + " L" + (x + 16) + "," + (y + 10) + " L" + (x + 16) + "," + (y + h - 10) +
           " L" + x + "," + (y + h) + ' Z"/>');
  }
  function wire(pts, cls) {
    o.push('<polyline class="bd-w ' + (cls || "") + '" points="' + pts.map(function (p) { return p.join(","); }).join(" ") + '"/>');
  }
  function lab(x, y, t, anchor, cls) {
    o.push('<text class="bd-l ' + (cls || "") + '" x="' + x + '" y="' + y + '" text-anchor="' + (anchor || "start") + '">' + t + "</text>");
  }
  o.push('<svg viewBox="0 0 800 480" class="bd-svg" role="img" aria-label="Block diagram of riscv32i: program counter, ' +
         'instruction source, register file, immediate generator, arithmetic logic unit and shifter, comparator, data ' +
         'memory in four banks, and the controller">');
  o.push('<defs><marker id="bd-arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">' +
         '<path d="M0,0 L8,4 L0,8 Z" class="bd-head"/></marker></defs>');

  /* next address: + 4, or the branch and jump target */
  box(150, 34, 132, 40, "bd-pc", "+ 4", "next instruction");
  box(150, 98, 132, 40, "bd-pc", "branch target", "address + immediate");
  mux(320, 42, 88);
  wire([[282, 54], [320, 54]]); wire([[282, 118], [320, 118]]);
  wire([[336, 86], [356, 86], [356, 16], [10, 16], [10, 240], [22, 240]]);
  lab(362, 90, "next address");

  /* the program counter, and where instructions come from */
  box(22, 210, 88, 60, "bd-pc", "program", "counter");
  wire([[66, 210], [66, 54], [150, 54]]); wire([[66, 118], [150, 118]]);
  box(136, 210, 128, 60, "bd-mem", "instruction", "boot memory or pin");
  wire([[110, 240], [136, 240]]);

  /* decode and read: the register file, and the immediate */
  box(300, 190, 118, 100, "bd-dp", "register file", "32 × 32 bits");
  box(300, 318, 118, 42, "bd-dp", "immediate", "sign-extended");
  wire([[264, 226], [300, 226]]);
  wire([[264, 256], [282, 256], [282, 339], [300, 339]]);

  /* execute: arithmetic logic unit and shifter, then the pick between them */
  mux(446, 234, 60);
  wire([[418, 266], [446, 266]]);
  wire([[418, 339], [434, 339], [434, 286], [446, 286]]);
  box(494, 186, 100, 48, "bd-dp", "arithmetic", "logic unit");
  box(494, 250, 100, 42, "bd-dp", "shifter");
  wire([[418, 206], [494, 206]]);
  wire([[476, 206], [476, 262], [494, 262]]);
  wire([[462, 264], [482, 264], [482, 222], [494, 222]]);
  wire([[482, 264], [482, 280], [494, 280]]);
  mux(612, 196, 88);
  wire([[594, 210], [612, 210]]); wire([[594, 271], [612, 271]]);

  /* memory: four banks, the same four macros as in the layout */
  box(664, 178, 120, 118, "bd-mem", "", "");
  o.push('<text class="bd-t" x="724" y="198">data memory</text>');
  for (var i = 0; i < 4; i++) {
    o.push('<rect class="bd-bank" x="' + (679 + i * 24) + '" y="208" width="17" height="56" rx="2"/>');
  }
  o.push('<text class="bd-s" x="724" y="284">4 × 256 words</text>');
  wire([[628, 240], [664, 240]]); lab(634, 234, "addr");
  wire([[418, 290], [424, 290], [424, 306], [652, 306], [652, 256], [664, 256]]); lab(560, 302, "store data", "middle");

  /* write back: the result, or what memory returned */
  mux(724, 326, 60);
  wire([[724, 296], [724, 318], [731, 318], [731, 330]], "bd-in");
  wire([[640, 240], [640, 364], [724, 364]]);
  wire([[740, 356], [770, 356], [770, 400], [290, 400], [290, 276], [300, 276]]);
  lab(430, 394, "the result, written back to the register file");

  /* the branch comparator, and the controller that steers it all */
  box(494, 322, 100, 40, "bd-ctl", "compare", "=, &lt;, &gt;");
  wire([[418, 228], [430, 228], [430, 332], [494, 332]]);
  box(136, 424, 480, 44, "bd-ctl", "controller", "decodes each instruction and sets every mux, the arithmetic, and the writes");
  wire([[200, 270], [200, 424]], "bd-c"); lab(206, 380, "opcode", "start", "bd-lc");
  wire([[544, 362], [544, 424]], "bd-c"); lab(550, 418, "branch taken?", "start", "bd-lc");

  o.push("</svg>");
  return o.join("");
};
