/* aes: an encryption core, the densest of the whole designs you can take
   through the flow in the browser. Everything here is read from the
   design's own files in OpenROAD-flow-scripts (flow/designs/src/aes and
   flow/designs/asap7/aes) and from the real runs of it. */

window.DESIGN = {
  key: "aes",
  title: "aes",
  short: "aes",

  facts: [
    ["What it is", "an encryption core for AES-128 (the Advanced Encryption Standard, with a 128-bit key): it " +
      "takes a 128-bit block and a 128-bit key and encrypts the block in ten rounds, one round a clock cycle, " +
      "making each round's key as it goes"],
    ["Where it comes from",
      'written by Rudolf Usselmann and published on OpenCores, as the header of ' +
      '<a href="#dz-viewer" class="dz-cite" data-mod="aes_cipher_top">aes_cipher_top.v</a> says; the ' +
      '<a href="https://github.com/The-OpenROAD-Project/OpenROAD-flow-scripts/blob/bde10c79a2389ffe9c5d73445f177f81262059f9/flow/designs/src/aes/README.md">README</a> ' +
      "records that it was downloaded from opencores.org in 2019 and given timing constraints. It ships with " +
      '<a href="https://github.com/The-OpenROAD-Project/OpenROAD-flow-scripts/tree/bde10c79a2389ffe9c5d73445f177f81262059f9/flow/designs/src/aes">OpenROAD-flow-scripts</a>.'],
    ["Size", "5 modules in 757 lines of Verilog (the decryption files beside them in the folder are not part of this design)"],
    ["Top-level pins", "clock, reset and load; a 128-bit key and a 128-bit block in; a 128-bit result out, and done"],
    ["Registers", "the 128-bit block as it came in, a 16-byte state that each round rewrites, the key expansion's " +
      "four 32-bit words, the 128-bit result, and a 4-bit round counter"],
    ["Substitution boxes", "20: one for each of the 16 state bytes, and 4 in the key expansion. Each is a 256-entry " +
      "table written out as logic, which is why this design is mostly logic"],
    ["The process", "ASAP7 (the Arizona State University 7 nanometer predictive process design kit), an open process made for teaching and research"],
  ],

  /* the module tree, as instantiated (instance names in the notes) */
  hierarchy: {
    name: "aes_cipher_top", note: "the chip: the rounds, the state, the counter",
    kids: [
      { name: "aes_key_expand_128", note: "u0: makes each round's key", kids: [
        { name: "aes_sbox", count: 4, note: "u0 to u3: substitution on the key's last word" },
        { name: "aes_rcon", note: "r0: the round constant" },
      ] },
      { name: "aes_sbox", count: 16, note: "us00 to us33: substitution on each state byte" },
    ],
  },

  /* the flow's own settings for this design (config.mk and constraint.sdc) */
  defaults: [
    ["Clock period", "380 picoseconds", "constraint.sdc"],
    ["Core utilization", "70%", "CORE_UTILIZATION"],
    ["Core margin", "2 micrometers", "CORE_MARGIN"],
    ["Placement density", "0.65, which the placer raises to the cells' uniform density (0.75)", "PLACE_DENSITY"],
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
    src: "/static/explore/designs/aes-layout.png",
    caption: "The finished layout of one real run of the flow, at a 388 picosecond clock. The logic falls into " +
      "separate blocks: each of the sixteen state bytes keeps its eight flip-flops within a few micrometers of " +
      "each other, and the sixteen bytes spread out across the die, so the blocks are largely the byte lanes with " +
      "their substitution logic. The placer found that structure on its own. The die is 50 micrometers square.",
  },

  blockCaption: "What that layout implements, drawn from the Verilog: every block is a real instance and every " +
    "wire a real connection. The block is loaded and mixed with the key; then each cycle the 16 state bytes go " +
    "through their substitution boxes, have their rows shifted (just wiring), their columns mixed, and the " +
    "round's key added, while the key expansion makes the next round's key. After the tenth round the result " +
    "is ready and done rises.",

  /* the Verilog, served as shipped: the five files this design uses, copied
     unmodified from OpenROAD-flow-scripts flow/designs/src/aes at commit
     bde10c79, with the license that ships beside them */
  sources: {
    dir: "/static/explore/designs/aes-src/",
    license: "LICENSE",
    licenseName: "BSD-style license of ASICs World Services",
    origin: "OpenROAD-flow-scripts, flow/designs/src/aes, unmodified",
    files: {
      aes_cipher_top: "aes_cipher_top.v", aes_key_expand_128: "aes_key_expand_128.v",
      aes_sbox: "aes_sbox.v", aes_rcon: "aes_rcon.v",
    },
    blackbox: {},
    start: "aes_cipher_top",
  },

  engine: {
    worker: "/static/explore/engine/engine-worker.js",
    net: "/static/explore/designs/aes-net.json",
    lib: "/static/explore/designs/asap7-lib.json",
    knobs: [
      { k: "period", label: "Clock period", kind: "range", min: 290, max: 580, step: 1, value: 388, unit: "ps",
        help: "How long each clock cycle is. Shorter is a faster chip, and harder to meet.",
        flow: "the reference run used 388 picoseconds (the design's own constraint file asks for 380)" },
      { k: "util", label: "Core utilization", kind: "range", min: 0.40, max: 0.85, step: 0.01, value: 0.70, pct: true,
        help: "How much of the core the cells fill. Lower means a bigger die with more room.",
        flow: "the flow uses 70% (CORE_UTILIZATION)" },
      { k: "density", label: "Placement density target", kind: "range", min: 0.50, max: 1.00, step: 0.01, value: 0.65,
        help: "How tightly the placer may pack cells in any one spot. A target below what the cells need is raised to it.",
        flow: "the flow asks for 0.65, which the real placer raises to 0.75" },
      { k: "ctsSize", label: "Clock tree: flip-flops per cluster", kind: "range", min: 4, max: 30, step: 1, value: 10, unit: "",
        help: "Each group of flip-flops gets one buffer at the bottom of the clock tree.",
        flow: "the flow's default is 10" },
      { k: "ctsDiam", label: "Clock tree: widest cluster", kind: "range", min: 10, max: 60, step: 5, value: 50, unit: "µm",
        help: "No group of flip-flops may be spread wider than this.",
        flow: "the flow's default is 50 micrometers" },
    ],
    /* read from the reference run by app/design_build/extract_reference.py */
    reference: {
      what: "a real run of the flow at a 388 picosecond clock",
      util: 0.70,
      die: 50.49, rows: 171, density: 0.75, globalHpwl: 41480, legalHpwl: 44587, improvedHpwl: 42021, avgDisp: 0.3, maxDisp: 1.2,
      placeWns: [2.6, -11.7],
      cts: { clusters: 31, buffers: 47, levels: 2, skew: 8.6, delayBuffers: 0 },
      route: { global: 73570, detailed: 52081, globalVias: 13477, vias: 140739,
               layers: { M2: 13754, M3: 22224, M4: 9590, M5: 3056, M6: 1763, M7: 1691 } },
      repair: { buffers: 1469, bufferArea: 136.0, ports: 387, design: 70, designNets: 41, resized: 28 },
      timing: { period: 388, wns: 1.31, tns: 0, gates: 13 },
      power: { total: 142.08, internal: 58.41, switching: 83.67, leakage: 0.001,
               groups: { sequential: 5.65, combinational: 134.0, clock: 2.42, macro: 0 },
               detail: { sequential: [4.44, 1.21, 0.000086], combinational: [52.5, 81.5, 0.000921],
                         clock: [1.48, 0.936, 0.000021], macro: [0, 0, 0] } },
      area: { die: 2549.75, core: 2144.13, macro: 0, std: 1618.5 },
      finish: { fillers: 11001, fillArea: 525.6 },
    },
    stages: { floorplan: true, placement: true, cts: true, routing: true, timing: true, finish: true },

    /* the real clock sweep: the reference run and seven more at other clocks,
       built the same way, each read with extract_reference.py */
    sweep: {
      periods: [300, 330, 350, 370, 388, 405, 425, 450, 485, 520, 560],
      secondsPerRun: 3,
      real: [
        { period: 330, wns: -140.14, tns: -5978.2, power: 216.64, area: 1957.8, buffers: 4248 },
        { period: 350, wns: -83.77, tns: -2398.0, power: 187.50, area: 1870.4, buffers: 3598 },
        { period: 370, wns: -5.78, tns: -17.8, power: 157.80, area: 1711.6, buffers: 2288 },
        { period: 388, wns: 1.31, tns: 0, power: 142.08, area: 1618.5, buffers: 1469 },
        { period: 405, wns: -10.52, tns: -31.7, power: 133.60, area: 1584.2, buffers: 1177 },
        { period: 425, wns: -9.71, tns: -26.2, power: 126.41, area: 1565.4, buffers: 979 },
        { period: 450, wns: 4.66, tns: 0, power: 118.45, area: 1548.6, buffers: 813 },
        { period: 485, wns: 9.94, tns: 0, power: 109.70, area: 1538.2, buffers: 697 },
      ],
      realNote: "The real flow's slack jumps around here: it meets timing at 388 picoseconds, misses by about 10 " +
        "at 405 and 425, and meets it again from 450. Each run's placement and repair land in slightly different " +
        "places, so a single real run is one sample, not the curve. Its area and power climb steeply at the fast " +
        "end: at 330 picoseconds the repair adds 4,248 buffers, against 697 at 485, and the result still misses " +
        "by 140 picoseconds.",
    },

    closeness: [
      ["Die size", "the same, 50.5 micrometers square"],
      ["Placement wirelength", "about 25% longer than the real placer's after legalization (55,906 against 44,587 micrometers)"],
      ["Clock tree", "57 clusters and 63 buffers against the real 31 and 47, with the same two levels"],
      ["Routing wirelength", "within about 3% of the real global router's"],
      ["Worst slack", "-23 picoseconds where the real run has +1.3 at 388 picoseconds. Across the sweep the engine " +
       "closes timing from about 404 picoseconds, the real flow at 388: about 4% slower"],
      ["Power", "within about 3% at 388 picoseconds, but about 15% low at the fastest clocks, where the real " +
       "repair adds far more buffers than the engine's does"],
    ],
  },

  knobs: [],
  runs: [],
};

/* The block diagram, drawn from aes_cipher_top.v and aes_key_expand_128.v:
   the real instances and connections, main paths only. */
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
  o.push('<svg viewBox="0 0 800 460" class="bd-svg" role="img" aria-label="Block diagram of aes: the input block register, ' +
         'the 16-byte state register, 16 substitution boxes, row shift, column mix and round key addition, the key ' +
         'expansion with 4 substitution boxes, the round counter, and the result register">');
  o.push('<defs><marker id="bd-arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">' +
         '<path d="M0,0 L8,4 L0,8 Z" class="bd-head"/></marker></defs>');

  /* the block comes in and is held */
  lab(8, 88, "block in"); wire([[8, 106], [60, 106]]);
  box(60, 80, 108, 52, "bd-mem", "input register", "text_in_r");

  /* first key addition, then the state, loaded or updated each cycle */
  box(196, 84, 60, 44, "bd-ctl", "XOR", "the key");
  wire([[168, 106], [196, 106]]);
  mux(282, 70, 110);
  wire([[256, 106], [282, 106]]);
  box(318, 60, 128, 130, "bd-dp", "", "");
  o.push('<text class="bd-t" x="382" y="80">state</text><text class="bd-s" x="382" y="94">16 bytes, sa00 to sa33</text>');
  for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++)
    o.push('<rect class="bd-bank" x="' + (336 + c * 24) + '" y="' + (104 + r * 20) + '" width="19" height="15" rx="2"/>');
  wire([[298, 125], [318, 125]]);

  /* one round: substitute, shift rows, mix columns, add the round key */
  box(480, 60, 128, 46, "bd-dp", "substitute", "16 substitution boxes");
  box(480, 120, 128, 40, "bd-pc", "shift rows", "just wiring");
  box(480, 174, 128, 40, "bd-dp", "mix columns", "four at a time");
  box(480, 228, 128, 40, "bd-ctl", "XOR", "the round key");
  wire([[446, 83], [480, 83]]);
  wire([[544, 106], [544, 120]]); wire([[544, 160], [544, 174]]); wire([[544, 214], [544, 228]]);
  wire([[544, 268], [544, 290], [270, 290], [270, 170], [282, 170]]);
  lab(400, 306, "the next state, back each clock", "middle");

  /* the last round skips the column mix, straight into the result */
  box(652, 116, 128, 52, "bd-mem", "result register", "text_out, 128 bits");
  wire([[608, 140], [652, 140]]); lab(612, 132, "+ key", "start", "bd-lc");
  wire([[716, 116], [716, 96], [780, 96]]); lab(780, 88, "result out", "end");

  /* the key: expanded round by round beside the rounds */
  lab(8, 374, "key in"); wire([[8, 392], [60, 392]]);
  box(60, 356, 280, 72, "bd-dp", "key expansion", "4 substitution boxes and the round constant");
  wire([[340, 380], [620, 380], [620, 248], [608, 248]]); lab(480, 374, "each round's key, 4 × 32 bits", "middle");
  wire([[170, 356], [170, 150], [226, 150], [226, 128]]);

  /* the counter that runs the ten rounds */
  box(636, 356, 156, 60, "bd-ctl", "round counter", "counts 11 down, then done");
  wire([[716, 356], [716, 168]], "bd-c"); lab(722, 260, "done", "start", "bd-lc");
  wire([[660, 356], [660, 336], [298, 336], [298, 180]], "bd-c"); lab(480, 330, "load or next round", "middle", "bd-lc");

  o.push("</svg>");
  return o.join("");
};
