/* gcd: the smallest whole design you can take through the flow in the
   browser. Everything here is read from the design's own files in
   OpenROAD-flow-scripts (flow/designs/src/gcd and flow/designs/asap7/gcd)
   and from the real runs of it. Its Verilog carries no license file, so it
   is linked, not copied. */

window.DESIGN = {
  key: "gcd",
  title: "gcd",
  short: "gcd",

  facts: [
    ["What it is", "a unit that finds the greatest common divisor of two 16-bit numbers, the way Euclid did: " +
      "while the second is not zero, it subtracts the smaller from the larger, swapping them when needed, one step " +
      "a clock cycle; what is left in the first is the answer"],
    /* each claim links to the file that makes it, pinned to the commit the
       flow checkout was taken from */
    ["Where it comes from",
      'generated with <a href="https://github.com/cornell-brg/pymtl">PyMTL</a> (a hardware modelling framework from ' +
      'Cornell University) and "derived from the ' +
      'opencelerity.org project", as its ' +
      '<a href="https://github.com/The-OpenROAD-Project/OpenROAD-flow-scripts/blob/bde10c79a2389ffe9c5d73445f177f81262059f9/flow/designs/src/gcd/README.md">README</a> ' +
      "says. It ships with " +
      '<a href="https://github.com/The-OpenROAD-Project/OpenROAD-flow-scripts/tree/bde10c79a2389ffe9c5d73445f177f81262059f9/flow/designs/src/gcd">OpenROAD-flow-scripts</a>, ' +
      "whose README calls it a design \"mostly used to test the sanity of the flow\"."],
    ["Size", "10 modules in 757 lines of Verilog, one file"],
    ["Top-level pins", "clock and reset; a 32-bit request holding both numbers, with valid and ready; a 16-bit " +
      "response, with valid and ready"],
    ["Registers", "two 16-bit registers for the numbers, and a 2-bit state register for the controller"],
    ["The process", "ASAP7 (the Arizona State University 7 nanometer predictive process design kit), an open process made for teaching and research"],
  ],

  /* the module tree, as instantiated (instance names in the notes) */
  hierarchy: {
    name: "gcd", note: "the chip",
    kids: [
      { name: "GcdUnitCtrlRTL", note: "ctrl: the controller, a state machine", kids: [
        { name: "RegRst", note: "state: which of idle, calculate, done" },
      ] },
      { name: "GcdUnitDpathRTL", note: "dpath: the datapath", kids: [
        { name: "RegEn", count: 2, note: "a_reg and b_reg: the two numbers" },
        { name: "Mux", count: 2, note: "a_mux and b_mux: what each register loads next" },
        { name: "Subtractor", note: "sub: A minus B" },
        { name: "LtComparator", note: "a_lt_b: is A less than B?" },
        { name: "ZeroComparator", note: "b_zero: is B zero?" },
      ] },
    ],
  },

  /* the flow's own settings for this design (config.mk and constraint.sdc) */
  defaults: [
    ["Clock period", "310 picoseconds", "constraint.sdc"],
    ["Core utilization", "65%", "CORE_UTILIZATION"],
    ["Core margin", "0.5 micrometers", "CORE_MARGIN"],
    ["Placement density", "0.35, which the placer raises to the cells' uniform density (0.79)", "PLACE_DENSITY"],
    ["Pins", "anywhere on the four edges", "no pin constraints"],
  ],

  stages: [
    { k: "synthesis", name: "Synthesis" },
    { k: "floorplan", name: "Floorplanning" },
    { k: "placement", name: "Placement" },
    { k: "cts", name: "Clock tree" },
    { k: "routing", name: "Routing" },
    { k: "timing", name: "Timing" },
    { k: "finish", name: "Finishing" },
  ],

  /* one real run's finished layout, rendered from its 6_final.def */
  layout: {
    src: "/static/explore/designs/gcd-layout.png",
    caption: "The finished layout of one real run of the flow, at a 332 picosecond clock: every cell at its real " +
      "size (flip-flops in violet, the rest in grey, fillers in the gaps, tap cells down both sides), every routed " +
      "wire, one colour per metal layer, and the pins on all four edges. The die is 9.5 micrometers square, small " +
      "enough that every cell is visible.",
  },

  blockCaption: "What that layout implements, drawn from the Verilog: every block is a real instance and every " +
    "wire a real connection. A request loads both numbers; then each cycle the controller, told whether A is less " +
    "than B and whether B is zero, either swaps them or replaces A with A minus B, until B reaches zero. The " +
    "response is wired from the subtractor, which at that point gives A minus zero: the answer.",

  /* the Verilog has no license file, so the page links to it instead of
     serving a copy */
  sources: {
    remote: {
      url: "https://github.com/The-OpenROAD-Project/OpenROAD-flow-scripts/blob/bde10c79a2389ffe9c5d73445f177f81262059f9/flow/designs/src/gcd/gcd.v",
      file: "gcd.v",
      note: "gcd's Verilog carries no license file in its repository, so this site links to it rather than " +
        "serving a copy.",
    },
    files: {}, blackbox: {},
  },

  engine: {
    worker: "/static/explore/engine/engine-worker.js",
    net: "/static/explore/designs/gcd-net.json",
    lib: "/static/explore/designs/asap7-lib.json",
    knobs: [
      { k: "period", label: "Clock period", kind: "range", min: 240, max: 480, step: 1, value: 332, unit: "ps",
        help: "How long each clock cycle is. Shorter is a faster chip, and harder to meet.",
        flow: "the reference run used 332 picoseconds (the design's own constraint file asks for 310)" },
      { k: "util", label: "Core utilization", kind: "range", min: 0.40, max: 0.85, step: 0.01, value: 0.65, pct: true,
        help: "How much of the core the cells fill. Lower means a bigger die with more room.",
        flow: "the flow uses 65% (CORE_UTILIZATION)" },
      { k: "density", label: "Placement density target", kind: "range", min: 0.30, max: 1.00, step: 0.01, value: 0.35,
        help: "How tightly the placer may pack cells in any one spot. A target below what the cells need is raised to it.",
        flow: "the flow asks for 0.35, which the real placer raises to 0.79" },
      { k: "ctsSize", label: "Clock tree: flip-flops per cluster", kind: "range", min: 4, max: 30, step: 1, value: 10, unit: "",
        help: "Each group of flip-flops gets one buffer at the bottom of the clock tree.",
        flow: "the flow's default is 10 (with only 35 flip-flops, the real tool does not cluster at all)" },
      { k: "ctsDiam", label: "Clock tree: widest cluster", kind: "range", min: 2, max: 20, step: 1, value: 10, unit: "µm",
        help: "No group of flip-flops may be spread wider than this.",
        flow: "this design is under 10 micrometers across" },
    ],
    /* read from the reference run by app/design_build/extract_reference.py */
    reference: {
      what: "a real run of the flow at a 332 picosecond clock",
      util: 0.65,
      die: 9.46, rows: 31, density: 0.79, globalHpwl: 704, legalHpwl: 825, improvedHpwl: 766, avgDisp: 0.2, maxDisp: 1.1,
      placeWns: [-15.8, -19.0],
      cts: { clusters: null, buffers: 8, levels: 2, skew: 4.8, delayBuffers: 0 },
      route: { global: 1649, detailed: 974, globalVias: 207, vias: 4052,
               layers: { M2: 320, M3: 407, M4: 146, M5: 25, M6: 40, M7: 35 } },
      repair: { buffers: 122, bufferArea: 10.1, ports: 53, design: 3, designNets: 1, resized: 12 },
      timing: { period: 332, wns: 2.46, tns: 0, gates: 22 },
      power: { total: 1.16, internal: 0.67, switching: 0.49, leakage: 0.0,
               groups: { sequential: 0.23, combinational: 0.8, clock: 0.13, macro: 0 },
               detail: { sequential: [0.209, 0.0257, 0.000005], combinational: [0.39, 0.407, 0.000029],
                         clock: [0.0745, 0.0559, 0.000001], macro: [0, 0, 0] } },
      area: { die: 89.43, core: 70.06, macro: 0, std: 58.1 },
      finish: { fillers: 347, fillArea: 12.0 },
    },
    stages: { floorplan: true, placement: true, cts: true, routing: true, timing: true, finish: true },

    /* the real clock sweep: the reference run and seven more at other clocks,
       built the same way, each read with extract_reference.py */
    sweep: {
      periods: [260, 285, 300, 316, 332, 348, 365, 385, 415, 440, 460],
      secondsPerRun: 0.3,
      real: [
        { period: 285, wns: -48.09, tns: -703.2, power: 1.44, area: 62.8, buffers: 170 },
        { period: 300, wns: -31.96, tns: -425.5, power: 1.28, area: 60.2, buffers: 148 },
        { period: 316, wns: -21.26, tns: -262.3, power: 1.19, area: 58.5, buffers: 128 },
        { period: 332, wns: 2.46, tns: 0, power: 1.16, area: 58.1, buffers: 122 },
        { period: 348, wns: 10.08, tns: 0, power: 1.04, area: 57.6, buffers: 122 },
        { period: 365, wns: 18.8, tns: 0, power: 1.01, area: 55.6, buffers: 95 },
        { period: 385, wns: 12.98, tns: 0, power: 0.92, area: 53.8, buffers: 78 },
        { period: 415, wns: 24.44, tns: 0, power: 0.80, area: 52.5, buffers: 66 },
      ],
      realNote: "The real flow closes timing from 332 picoseconds and slower, and misses below that. Its slack " +
        "still wanders a little from one clock to the next (12.98 at 385 but 18.8 at 365), because each run's " +
        "placement and repair land in slightly different places. Power and area move steadily: a faster clock " +
        "switches everything more often, and the repair adds more and bigger gates to keep up.",
    },

    closeness: [
      ["Die size", "the same, 9.5 micrometers square"],
      ["Placement wirelength", "about 25% longer than the real placer's after legalization (1,033 against 825 micrometers)"],
      ["Clock tree", "a different shape: the engine clusters the 35 flip-flops under 6 large buffers, where the real " +
       "tool builds a small tree of 8 little buffers and no clusters"],
      ["Routing wirelength", "about 13% shorter than the real global router's"],
      ["Worst slack", "-29 picoseconds where the real run has +2.5 at 332 picoseconds. Across the sweep the engine " +
       "closes timing from about 364 picoseconds, the real flow from 332: about 10% slower"],
      ["Power", "about 11% low, and it falls with the clock just as the real runs' does"],
    ],
  },

  knobs: [],
  runs: [],
};

/* The block diagram, drawn from gcd.v: the datapath's real instances and
   connections, and the controller's three states. */
window.DESIGN.blockDiagram = function () {
  var o = [];
  function box(x, y, w, h, cls, l1, l2) {
    o.push('<rect class="bd-box ' + cls + '" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="5"/>');
    o.push('<text class="bd-t" x="' + (x + w / 2) + '" y="' + (y + h / 2 + (l2 ? -3 : 4)) + '">' + l1 + "</text>");
    if (l2) o.push('<text class="bd-s" x="' + (x + w / 2) + '" y="' + (y + h / 2 + 12) + '">' + l2 + "</text>");
  }
  function mux(x, y, h) {
    o.push('<path class="bd-mux" d="M' + x + "," + y + " L" + (x + 16) + "," + (y + 10) + " L" + (x + 16) + "," + (y + h - 10) +
           " L" + x + "," + (y + h) + ' Z"/>');
  }
  function wire(pts, cls) {
    o.push('<polyline class="bd-w ' + (cls || "") + '" points="' + pts.map(function (p) { return p.join(","); }).join(" ") + '"/>');
  }
  function lab(x, y, t, anchor, cls) {
    o.push('<text class="bd-l ' + (cls || "") + '" x="' + x + '" y="' + y + '" text-anchor="' + (anchor || "start") + '">' + t + "</text>");
  }
  o.push('<svg viewBox="0 0 800 440" class="bd-svg" role="img" aria-label="Block diagram of gcd: two registers A and B ' +
         'fed by multiplexers, a subtractor, a less-than comparator and a zero comparator, and a controller with three states">');
  o.push('<defs><marker id="bd-arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">' +
         '<path d="M0,0 L8,4 L0,8 Z" class="bd-head"/></marker></defs>');

  /* the request comes in as two 16-bit numbers */
  lab(20, 60, "request: A (16 bits)"); lab(20, 190, "request: B (16 bits)");
  wire([[20, 70], [150, 70]]); wire([[20, 200], [150, 200]]);

  /* a_mux: the request, A minus B, or B (a swap); b_mux: the request, or A */
  mux(150, 40, 80); mux(150, 170, 60);
  box(200, 52, 110, 50, "bd-dp", "register A", "a_reg, 16 bits");
  box(200, 172, 110, 50, "bd-dp", "register B", "b_reg, 16 bits");
  wire([[166, 80], [200, 80]]); wire([[166, 200], [200, 200]]);

  /* the subtractor and the two comparators read both registers */
  box(400, 40, 130, 44, "bd-dp", "subtract", "A minus B");
  box(400, 112, 130, 44, "bd-ctl", "less than?", "is A less than B");
  box(400, 184, 130, 44, "bd-ctl", "zero?", "is B zero");
  wire([[310, 70], [360, 70], [360, 56], [400, 56]]);
  wire([[360, 70], [360, 128], [400, 128]]);
  wire([[310, 200], [376, 200], [376, 76], [400, 76]]);
  wire([[376, 144], [400, 144]]); wire([[376, 206], [400, 206]]);

  /* the loops back into the multiplexers */
  wire([[530, 62], [560, 62], [560, 20], [134, 20], [134, 88], [150, 88]]); lab(345, 16, "A minus B", "middle");
  wire([[310, 216], [330, 216], [330, 250], [134, 250], [134, 110], [150, 110]]); lab(232, 264, "B into A (the swap)", "middle");
  wire([[310, 90], [322, 90], [322, 236], [140, 236], [140, 214], [150, 214]]); lab(232, 229, "A into B", "middle", "bd-lc");

  /* the answer: the subtractor's output, which is A once B is zero */
  wire([[560, 62], [600, 62], [600, 82], [620, 82]]);
  box(620, 60, 150, 44, "bd-mem", "response", "A minus B, 16 bits");

  /* the controller: its three states, and what it reads and sets */
  box(220, 330, 460, 80, "bd-ctl", "", "");
  o.push('<text class="bd-t" x="450" y="350">controller (a state machine)</text>');
  box(250, 362, 110, 36, "bd-pc", "idle", "waits for a request");
  box(395, 362, 110, 36, "bd-pc", "calculate", "swap or subtract");
  box(540, 362, 110, 36, "bd-pc", "done", "answer is ready");
  wire([[360, 380], [395, 380]]); wire([[505, 380], [540, 380]]);
  wire([[595, 362], [595, 356], [305, 356], [305, 362]], "bd-c");
  wire([[530, 134], [600, 134], [600, 330]], "bd-c"); wire([[530, 206], [590, 206], [590, 330]], "bd-c");
  lab(606, 250, "A less than B? B zero?", "start", "bd-lc");
  wire([[158, 330], [158, 120]], "bd-c"); wire([[158, 330], [220, 330]], "bd-c");
  lab(20, 300, "which input each register takes, and when it loads", "start", "bd-lc");

  o.push("</svg>");
  return o.join("");
};
