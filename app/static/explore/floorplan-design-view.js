/* Step 1's visual layer on the floorplan flow page: a block diagram of
   the teaching design tile4m, and a tab per input file. Opening a file
   shows an excerpt of it and lights up the part of the diagram that
   file describes. Before the read, the diagram is drawn dashed (not
   linked); markLinked() turns every block solid once link_design runs.
   Bus widths come from floorplan-core.js, so the picture matches the
   report and the free-play sandbox. */

var FloorplanDesignView = (function () {
  "use strict";

  var F = FloorplanCore;
  var MEM_COLORS = { A: "#16a34a", B: "#2563eb", C: "#d97706", D: "#db2777" };

  function bits(pred) {
    for (var i = 0; i < F.NETS.length; i++) if (pred(F.NETS[i])) return F.NETS[i].bits;
    return 0;
  }
  var BUS = {
    mem: bits(function (n) { return n.a.macro; }),
    ctrl: bits(function (n) { return n.a.cluster && n.a.cluster !== "hub"; }),
    inp: bits(function (n) { return n.a.port === "W"; }),
    out: bits(function (n) { return n.a.port === "E"; }),
    con: bits(function (n) { return n.a.port === "N"; }),
  };

  /* ----- diagram geometry (SVG user units) ----- */

  var W = 800, H = 420;
  var BLOCKS = [
    { id: "memA", x: 80, y: 90, w: 132, h: 64, kind: "mem", m: "A", label: "Memory A", sub: "mem_wide" },
    { id: "memB", x: 720, y: 90, w: 132, h: 64, kind: "mem", m: "B", label: "Memory B", sub: "mem_wide" },
    { id: "memC", x: 80, y: 330, w: 100, h: 80, kind: "mem", m: "C", label: "Memory C", sub: "mem_square" },
    { id: "memD", x: 720, y: 330, w: 100, h: 80, kind: "mem", m: "D", label: "Memory D", sub: "mem_square" },
    { id: "ctrlA", x: 290, y: 90, w: 96, h: 34, kind: "ctrl", m: "A", label: "controller A" },
    { id: "ctrlB", x: 510, y: 90, w: 96, h: 34, kind: "ctrl", m: "B", label: "controller B" },
    { id: "ctrlC", x: 290, y: 330, w: 96, h: 34, kind: "ctrl", m: "C", label: "controller C" },
    { id: "ctrlD", x: 510, y: 330, w: 96, h: 34, kind: "ctrl", m: "D", label: "controller D" },
    { id: "hub", x: 400, y: 210, w: 240, h: 50, kind: "hub", label: "hub" },
    { id: "pIn", x: 42, y: 210, w: 64, h: 58, kind: "port", label: "inputs" },
    { id: "pOut", x: 758, y: 210, w: 64, h: 58, kind: "port", label: "outputs" },
    { id: "pCon", x: 400, y: 30, w: 96, h: 30, kind: "port", label: "control" },
    { id: "pClk", x: 400, y: 392, w: 124, h: 30, kind: "clock", label: "clk, rst_n" },
  ];
  var BY = {};
  BLOCKS.forEach(function (b) { BY[b.id] = b; });

  var WIRES = [
    { id: "wA", a: "memA", b: "ctrlA", n: BUS.mem }, { id: "wB", a: "memB", b: "ctrlB", n: BUS.mem },
    { id: "wC", a: "memC", b: "ctrlC", n: BUS.mem }, { id: "wD", a: "memD", b: "ctrlD", n: BUS.mem },
    { id: "hA", a: "ctrlA", b: "hub", n: BUS.ctrl }, { id: "hB", a: "ctrlB", b: "hub", n: BUS.ctrl },
    { id: "hC", a: "ctrlC", b: "hub", n: BUS.ctrl }, { id: "hD", a: "ctrlD", b: "hub", n: BUS.ctrl },
    { id: "wIn", a: "pIn", b: "hub", n: BUS.inp }, { id: "wOut", a: "hub", b: "pOut", n: BUS.out },
    { id: "wCon", a: "pCon", b: "hub", n: BUS.con },
    { id: "wClk", a: "pClk", b: "hub", n: 0, clock: true },
  ];

  var ALL = BLOCKS.map(function (b) { return b.id; })
    .concat(WIRES.map(function (w) { return w.id; })).concat(["die"]);

  /* ----- the files ----- */

  var FILES = [
    {
      name: "tile4m.v", kind: "Gate-level netlist (Verilog), from synthesis",
      learns: "Every cell instance, every macro instance, and every wire between them. No sizes, no positions, no delays.",
      lights: ALL.filter(function (p) { return p !== "die"; }),
      lightNote: "the whole design: every block and every wire",
      text: [
        "module tile4m (",
        "  input  wire        clk,",
        "  input  wire        rst_n,",
        "  input  wire [31:0] in_data,",
        "  input  wire [15:0] ctrl,",
        "  output wire [31:0] out_data",
        ");",
        "  // 50,000 standard-cell instances in all; three shown",
        "  DFFR_X1  hub_state_reg_0_ (.D(n1024), .CK(clk), .RN(rst_n), .Q(hub_state[0]));",
        "  NAND2_X1 U3187 (.A1(n812), .A2(n813), .ZN(n1024));",
        "  BUF_X2   U3188 (.A(a_addr_pre[3]), .Z(a_addr[3]));",
        "  ...",
        "  // the four memory macros: a 32-bit write bus and a 32-bit read bus each",
        "  mem_wide   u_mem_a (.clk(clk), .addr(a_addr), .din(a_din), .dout(a_dout), .we(a_we));",
        "  mem_wide   u_mem_b (.clk(clk), .addr(b_addr), .din(b_din), .dout(b_dout), .we(b_we));",
        "  mem_square u_mem_c (.clk(clk), .addr(c_addr), .din(c_din), .dout(c_dout), .we(c_we));",
        "  mem_square u_mem_d (.clk(clk), .addr(d_addr), .din(d_din), .dout(d_dout), .we(d_we));",
        "endmodule",
      ],
    },
    {
      name: "tile4m.sdc", kind: "SDC (Synopsys Design Constraints)",
      learns: "The clock and its period, how much of each cycle is already spent outside the block at every pin, and the design's own limits, such as how many loads one gate may drive.",
      lights: ["pIn", "pOut", "pCon", "pClk", "wIn", "wOut", "wCon", "wClk"],
      lightNote: "the pins and the clock",
      text: [
        "create_clock -name clk -period 2.0 [get_ports clk]",
        "set_input_delay  0.6 -clock clk [get_ports {in_data[*] ctrl[*]}]",
        "set_output_delay 0.6 -clock clk [get_ports {out_data[*]}]",
        "set_false_path -from [get_ports rst_n]",
        "set_max_fanout 8 [current_design]",
        "set_driving_cell -lib_cell BUF_X2 [all_inputs]",
        "set_load 0.01 [all_outputs]",
      ],
    },
    {
      name: "tech.lef", kind: "Technology LEF (Library Exchange Format)",
      learns: "The metal layers (direction, pitch, width), the vias between them, and the placement site every standard cell snaps to.",
      lights: ["die"],
      lightNote: "no block at all: the rules for the whole die",
      text: (typeof FloorplanSteps !== "undefined"
        ? FloorplanSteps.techLef()
        : ["tech.lef could not be generated"]),
    },
    {
      name: "stdcells.lef", kind: "Cell LEF (Library Exchange Format)",
      learns: "Each standard cell's outline and pin shapes: the abstract a placer needs, with no transistors inside.",
      lights: ["hub", "ctrlA", "ctrlB", "ctrlC", "ctrlD"],
      lightNote: "the logic built from standard cells: the hub and the four controllers",
      text: [
        "MACRO NAND2_X1",
        "  CLASS CORE ;",
        "  ORIGIN 0 0 ;",
        "  SIZE 0.76 BY 1.4 ;",
        "  SITE core_site ;",
        "  PIN A1",
        "    DIRECTION INPUT ;",
        "    PORT",
        "      LAYER metal1 ;",
        "        RECT 0.10 0.40 0.20 0.70 ;",
        "    END",
        "  END A1",
        "  PIN ZN",
        "    DIRECTION OUTPUT ;",
        "    ...",
        "  END ZN",
        "  PIN VDD",
        "    USE POWER ;",
        "    ...",
        "END NAND2_X1",
        "...   (211 more cells, every one 1.4 tall: one site row)",
      ],
    },
    {
      name: "stdcells_tt.lib", kind: "Liberty timing library, typical corner",
      learns: "The delay, power, and area of each standard cell at 25 °C and nominal voltage.",
      lights: ["hub", "ctrlA", "ctrlB", "ctrlC", "ctrlD"],
      lightNote: "the same logic, seen as timing instead of shapes",
      text: [
        "library (stdcells_tt) {",
        "  time_unit       : \"1ns\" ;",
        "  nom_temperature : 25 ;",
        "  nom_voltage     : 1.0 ;",
        "  cell (NAND2_X1) {",
        "    area : 1.064 ;",
        "    pin (ZN) {",
        "      direction : output ;",
        "      function  : \"!(A1 & A2)\" ;",
        "      timing () {",
        "        related_pin : \"A1\" ;",
        "        cell_rise (delay_template) {",
        "          values (\"0.021, 0.034, 0.058\", ...) ;",
        "        }",
        "      }",
        "    }",
        "  }",
        "  ...",
        "}",
      ],
    },
    {
      name: "mem_wide.lef", kind: "Macro LEF (Library Exchange Format) abstract",
      learns: "The memory's outline, where every pin sits on its edge, and which metal layers it blocks, listed in its OBS (obstruction) section.",
      lights: ["memA", "memB"],
      lightNote: "Memory A and Memory B, the two instances of mem_wide",
      text: [
        "MACRO mem_wide",
        "  CLASS BLOCK ;",
        "  ORIGIN 0 0 ;",
        "  SIZE 150 BY 90 ;",
        "  PIN din[0]",
        "    DIRECTION INPUT ;",
        "    PORT",
        "      LAYER metal3 ;",
        "        RECT 15.20 0.00 15.40 0.60 ;",
        "    END",
        "  END din[0]",
        "  ...   (every signal pin on the bottom edge: the pin edge)",
        "  OBS",
        "    LAYER metal1 ; RECT 0 0 150 90 ;",
        "    LAYER metal2 ; RECT 0 0 150 90 ;",
        "    LAYER metal3 ; RECT 0 0 150 90 ;",
        "    LAYER metal4 ; RECT 0 0 150 90 ;",
        "  END",
        "END mem_wide",
      ],
    },
    {
      name: "mem_wide.lib", kind: "Macro Liberty timing model",
      learns: "The memory's access time from clock to read data, and its setup requirements at the input pins.",
      lights: ["memA", "memB"],
      lightNote: "Memory A and Memory B, seen as timing",
      text: [
        "library (mem_wide) {",
        "  cell (mem_wide) {",
        "    area : 13500 ;",
        "    memory () { type : ram ; address_width : 8 ; word_width : 32 ; }",
        "    pin (clk) { direction : input ; clock : true ; }",
        "    bus (dout) {",
        "      direction : output ;",
        "      timing () {",
        "        related_pin : \"clk\" ;",
        "        timing_type : rising_edge ;",
        "        cell_rise (scalar) { values (\"0.85\") ; }",
        "      }",
        "    }",
        "    ...",
        "  }",
        "}",
      ],
    },
    {
      name: "mem_square.lef", kind: "Macro LEF (Library Exchange Format) abstract",
      learns: "The same kinds of facts for the square memory: outline, pin positions, blocked layers.",
      lights: ["memC", "memD"],
      lightNote: "Memory C and Memory D, the two instances of mem_square",
      text: [
        "MACRO mem_square",
        "  CLASS BLOCK ;",
        "  ORIGIN 0 0 ;",
        "  SIZE 110 BY 110 ;",
        "  PIN din[0]",
        "    DIRECTION INPUT ;",
        "    PORT",
        "      LAYER metal3 ;",
        "        RECT 11.20 0.00 11.40 0.60 ;",
        "    END",
        "  END din[0]",
        "  ...",
        "  OBS",
        "    LAYER metal1 ; RECT 0 0 110 110 ;",
        "    ...   (metal2 to metal4 likewise)",
        "  END",
        "END mem_square",
      ],
    },
    {
      name: "mem_square.lib", kind: "Macro Liberty timing model",
      learns: "The square memory's access time and pin timing.",
      lights: ["memC", "memD"],
      lightNote: "Memory C and Memory D, seen as timing",
      text: [
        "library (mem_square) {",
        "  cell (mem_square) {",
        "    area : 12100 ;",
        "    memory () { type : ram ; address_width : 8 ; word_width : 32 ; }",
        "    pin (clk) { direction : input ; clock : true ; }",
        "    bus (dout) {",
        "      direction : output ;",
        "      timing () {",
        "        related_pin : \"clk\" ;",
        "        timing_type : rising_edge ;",
        "        cell_rise (scalar) { values (\"0.78\") ; }",
        "      }",
        "    }",
        "    ...",
        "  }",
        "}",
      ],
    },
  ];

  /* ----- drawing ----- */

  function esc(t) {
    return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function wireWidth(n) { return n >= 64 ? 6 : n >= 32 ? 4 : n > 0 ? 2.6 : 1.6; }

  /* where the center-to-center line from block a toward block b leaves
     a's border, so wires start and end at block edges */
  function exitPoint(a, b) {
    var dx = b.x - a.x, dy = b.y - a.y;
    var sx = dx ? (a.w / 2) / Math.abs(dx) : Infinity;
    var sy = dy ? (a.h / 2) / Math.abs(dy) : Infinity;
    var k = Math.min(sx, sy);
    return { x: a.x + dx * k, y: a.y + dy * k };
  }

  /* straight vertical or horizontal when one block sits within the
     other's span (a controller over the wide hub); otherwise the clipped
     center-to-center line */
  function wireEnds(w) {
    var a = BY[w.a], b = BY[w.b];
    function within(v, c, half) { return v > c - half && v < c + half; }
    var top = a.y < b.y ? a : b, bot = a.y < b.y ? b : a;
    var left = a.x < b.x ? a : b, right = a.x < b.x ? b : a;
    var xs = within(a.x, b.x, b.w / 2) ? a.x : within(b.x, a.x, a.w / 2) ? b.x : null;
    if (xs !== null && a.y !== b.y) {
      return { p: { x: xs, y: top.y + top.h / 2 }, q: { x: xs, y: bot.y - bot.h / 2 } };
    }
    var ys = within(a.y, b.y, b.h / 2) ? a.y : within(b.y, a.y, a.h / 2) ? b.y : null;
    if (ys !== null && a.x !== b.x) {
      return { p: { x: left.x + left.w / 2, y: ys }, q: { x: right.x - right.w / 2, y: ys } };
    }
    return { p: exitPoint(a, b), q: exitPoint(b, a) };
  }

  function svg() {
    var s = [];
    s.push('<svg viewBox="0 0 ' + W + " " + H + '" class="ffd-svg" role="img" ' +
           'aria-label="Block diagram of tile4m: four memories, a controller for each, a hub, and the pins">');
    /* the die frame: what tech.lef describes */
    s.push('<rect data-part="die" class="ffd-die" x="4" y="4" width="' + (W - 8) + '" height="' + (H - 8) + '" rx="10"/>');
    s.push('<text data-part="die" class="ffd-die-label" x="16" y="' + (H - 12) + '">die: layers and site rules from tech.lef</text>');
    /* what this is, for someone arriving cold (never dimmed: no data-part) */
    s.push('<text class="ffd-title" x="18" y="27"><tspan class="ffd-title-key">DESIGN</tspan> ' +
           '<tspan class="ffd-title-name">tile4m</tspan></text>');
    s.push('<text class="ffd-title-sub" x="18" y="43">block diagram of the top module</text>');

    WIRES.forEach(function (w) {
      var e = wireEnds(w);
      s.push('<line data-part="' + w.id + '" class="ffd-wire' + (w.clock ? " ffd-clockwire" : "") + '" x1="' + e.p.x + '" y1="' + e.p.y +
             '" x2="' + e.q.x + '" y2="' + e.q.y + '" stroke-width="' + wireWidth(w.n) + '"/>');
    });
    /* bus-width tags centered on the visible stretch of each wire */
    WIRES.forEach(function (w) {
      var e = wireEnds(w);
      var mx = (e.p.x + e.q.x) / 2, my = (e.p.y + e.q.y) / 2;
      var t = w.clock ? "every flip-flop" : w.n + " bits";
      var tw = t.length * 6.2 + 12;
      s.push('<g data-part="' + w.id + '" class="ffd-tag"><rect x="' + (mx - tw / 2) + '" y="' + (my - 9) +
             '" width="' + tw + '" height="18" rx="9"/><text x="' + mx + '" y="' + (my + 4) + '">' + t + "</text></g>");
    });

    BLOCKS.forEach(function (b) {
      var x = b.x - b.w / 2, y = b.y - b.h / 2;
      var color = b.m ? MEM_COLORS[b.m] : null;
      var style = color ? ' style="--mc:' + color + '"' : "";
      s.push('<g data-part="' + b.id + '" class="ffd-block ffd-' + b.kind + '"' + style + ">");
      s.push('<rect x="' + x + '" y="' + y + '" width="' + b.w + '" height="' + b.h + '" rx="' + (b.kind === "mem" ? 3 : 7) + '"/>');
      var ty = b.sub ? b.y - 3 : b.y + 4;
      s.push('<text class="ffd-label" x="' + b.x + '" y="' + ty + '">' + esc(b.label) + "</text>");
      if (b.sub) s.push('<text class="ffd-sub" x="' + b.x + '" y="' + (b.y + 13) + '">' + esc(b.sub) + "</text>");
      s.push('<text class="ffd-tick" x="' + (x + b.w - 9) + '" y="' + (y + 13) + '">✓</text>');
      s.push("</g>");
    });
    s.push("</svg>");
    return s.join("");
  }

  var root, tabsEl, viewEl, current = 0;

  function select(i) {
    current = i;
    var f = FILES[i];
    var lit = {};
    f.lights.forEach(function (p) { lit[p] = true; });
    root.querySelectorAll("[data-part]").forEach(function (el) {
      el.classList.toggle("ffd-lit", !!lit[el.getAttribute("data-part")]);
    });
    tabsEl.querySelectorAll(".ffd-tab").forEach(function (t, k) {
      t.classList.toggle("active", k === i);
      t.setAttribute("aria-selected", k === i ? "true" : "false");
    });
    viewEl.innerHTML =
      '<div class="ffd-file-head"><code>' + esc(f.name) + "</code> · " + esc(f.kind) + "</div>" +
      '<p class="ffd-learns"><strong>What the tool learns:</strong> ' + esc(f.learns) + "</p>" +
      '<p class="ffd-lights"><span class="ffd-swatch"></span>Lit in the diagram: ' + esc(f.lightNote) + "</p>" +
      '<pre class="ffd-code">' + esc(f.text.join("\n")) + "</pre>" +
      '<div class="ffd-note">Excerpt, written for the teaching design in the real file format.</div>';
  }

  function init() {
    if (root) return;                                    /* already built */
    root = document.getElementById("ffd-diagram");
    tabsEl = document.getElementById("ffd-tabs");
    viewEl = document.getElementById("ffd-view");
    if (!root) return;
    root.innerHTML = svg();
    root.classList.add("ffd-unlinked");
    tabsEl.innerHTML = FILES.map(function (f, i) {
      return '<button class="ffd-tab" role="tab" data-i="' + i + '">' + esc(f.name) + "</button>";
    }).join("");
    tabsEl.querySelectorAll(".ffd-tab").forEach(function (t) {
      t.addEventListener("click", function () {
        tabsEl.classList.remove("ffd-hint"); /* they found it: stop the pulse */
        select(+t.getAttribute("data-i"));
      });
    });
    /* clicking a block opens the first file that describes it (its physical view) */
    root.querySelectorAll(".ffd-block").forEach(function (g) {
      g.addEventListener("click", function () {
        var part = g.getAttribute("data-part");
        for (var k = 0; k < FILES.length; k++) {
          if (FILES[k].name !== "tile4m.v" && FILES[k].lights.indexOf(part) !== -1) {
            tabsEl.classList.remove("ffd-hint");
            select(k);
            return;
          }
        }
      });
    });
    select(0);
  }

  function markLinked() {
    if (root) root.classList.remove("ffd-unlinked");
  }

  if (document.getElementById("ffd-diagram")) init();   /* the old page had it in the markup */
  return { init: init, markLinked: markLinked, FILES: FILES, BUS: BUS };
})();
