/* The floorplan flow's shared model and steps 3 to 11.

   One floorplan, built up step by step: the die from step 2, the rows
   and tracks, the pins, the macros, their halos, the power grid, and
   the tap and endcap cells, then the analysis and the hand-off. Every
   step reads the same model, so later steps build on earlier ones (the
   tap cells stop at the macro halos, the power stripes are cut above
   the macros, and so on). Each step has exactly one choice for now:
   the values an engineer would reasonably start from.

   Geometry is in micrometers. Two frames are used and always named:
     core, y down  (x, y)   the free-play sandbox's frame, for drawing
     die, y up     (X, Y)   the frame of the real files and commands
   The core sits SIZING.margin inside the die on every side. */

var FloorplanSteps = (function () {
  "use strict";

  var F = FloorplanCore;
  var MEM_COLORS = { A: "#16a34a", B: "#2563eb", C: "#d97706", D: "#db2777" };
  var PORT_C = "#7c3aed", VDD_C = "#dc2626", VSS_C = "#2563eb";

  function fmt(n) { return Math.round(n).toLocaleString("en-US"); }
  function f1(n) { return n.toFixed(1); }
  function f2(n) { return n.toFixed(2); }
  function esc(t) { return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  /* ================= the model ================= */

  var DESIGN = { avgCellArea: 2.6, clockPeriodNs: 2.0, corner: "typical (25 °C, nominal voltage)" };
  var SIZING = { util: 70, ar: 1.0, margin: 20 };
  var SITE_W = 0.19, ROW_H = 1.4;

  /* The metal stack, consistent with the tech.lef excerpt: a row holds
     exactly 7 metal1 tracks (1.4 / 0.20) and a site is one metal2
     track wide (0.19). Pitch doubles every two layers going up. */
  /* The metal stack. Geometry (pitch, width) sets the routing grids;
     the electrical values are what a wire's delay is computed from.
     rSheet is resistance per square of metal, cArea the plate
     capacitance per square micrometer, cEdge the fringe capacitance
     per micrometer of wire edge. Thicker upper layers carry current
     better (lower rSheet) and sit further from their neighbours
     (lower capacitance), which is why power and long wires go up. */
  var LAYERS = [
    { name: "metal1", dir: "horizontal", pitch: 0.20, xo: 0.095, xp: 0.19, yo: 0.10, yp: 0.20,
      width: 0.07, rSheet: 0.42, cArea: 0.055, cEdge: 0.065 },
    { name: "metal2", dir: "vertical", pitch: 0.19, xo: 0.095, xp: 0.19, yo: 0.10, yp: 0.20,
      width: 0.07, rSheet: 0.42, cArea: 0.055, cEdge: 0.065 },
    { name: "metal3", dir: "horizontal", pitch: 0.40, xo: 0.19, xp: 0.38, yo: 0.20, yp: 0.40,
      width: 0.14, rSheet: 0.21, cArea: 0.050, cEdge: 0.060 },
    { name: "metal4", dir: "vertical", pitch: 0.38, xo: 0.19, xp: 0.38, yo: 0.20, yp: 0.40,
      width: 0.14, rSheet: 0.21, cArea: 0.050, cEdge: 0.060 },
    { name: "metal5", dir: "horizontal", pitch: 0.80, xo: 0.38, xp: 0.76, yo: 0.40, yp: 0.80,
      width: 0.28, rSheet: 0.08, cArea: 0.042, cEdge: 0.050 },
    { name: "metal6", dir: "vertical", pitch: 0.76, xo: 0.38, xp: 0.76, yo: 0.40, yp: 0.80,
      width: 0.28, rSheet: 0.08, cArea: 0.042, cEdge: 0.050 },
  ];
  var LAYER_BY = {};
  LAYERS.forEach(function (L) { LAYER_BY[L.name] = L; });

  /* What a micrometer of wire on this layer costs: resistance in ohms
     (sheet resistance divided by the wire's width) and capacitance in
     femtofarads (plate capacitance across the width, plus fringe off
     both edges). This is the arithmetic set_wire_rc -layer performs. */
  function wireRC(layerName) {
    var L = LAYER_BY[layerName];
    return {
      layer: L,
      r: L.rSheet / L.width,
      c: L.cArea * L.width + 2 * L.cEdge,
    };
  }

  var MASTERS = { A: "mem_wide", B: "mem_wide", C: "mem_square", D: "mem_square" };
  var INSTS = { A: "u_mem_a", B: "u_mem_b", C: "u_mem_c", D: "u_mem_d" };
  var HALO = F.HALO;

  /* The technology file, generated from the tables above so the excerpt
     the reader sees and the numbers the steps compute can never drift.
     Returns LEF (Library Exchange Format) text as an array of lines;
     `which` picks the whole file or just the parts step 3 relies on. */
  function techLef(which) {
    var out = [];
    if (which !== "grid") {
      out.push("UNITS", "  DATABASE MICRONS 1000 ;", "END UNITS", "MANUFACTURINGGRID 0.005 ;", "");
    }
    out.push("SITE core_site", "  CLASS CORE ;",
             "  SIZE " + SITE_W + " BY " + ROW_H + " ;", "END core_site", "");
    LAYERS.forEach(function (L, i) {
      if (which === "grid" && i > 1) return;
      out.push("LAYER " + L.name, "  TYPE ROUTING ;",
               "  DIRECTION " + L.dir.toUpperCase() + " ;",
               "  PITCH " + (L.dir === "horizontal" ? L.yp : L.xp).toFixed(2) + " ;",
               "  WIDTH " + L.width.toFixed(2) + " ;",
               "  RESISTANCE RPERSQ " + L.rSheet.toFixed(2) + " ;",
               "  CAPACITANCE CPERSQDIST " + L.cArea.toFixed(3) + " ;",
               "  EDGECAPACITANCE " + L.cEdge.toFixed(3) + " ;",
               "END " + L.name, "");
      if (which !== "grid" && i < LAYERS.length - 1) {
        out.push("LAYER via" + (i + 1), "  TYPE CUT ;", "END via" + (i + 1), "");
      }
    });
    if (which === "grid") out.push("...   (metal3 to metal6, pitch doubling every two layers)");
    return out;
  }

  function figures() {
    var macroArea = F.MACROS.reduce(function (s, m) { return s + m.w * m.h; }, 0);
    var cells = F.CELL_AREA / DESIGN.avgCellArea;
    var portBits = F.NETS.reduce(function (s, n) {
      return s + (n.a.port ? n.bits : 0) + (n.b.port ? n.bits : 0);
    }, 0);
    return {
      macroArea: macroArea, cellArea: F.CELL_AREA, total: macroArea + F.CELL_AREA,
      macroShare: macroArea / (macroArea + F.CELL_AREA),
      cells: cells, nets: cells * 1.03, ports: portBits + 2, portBits: portBits,
      die70: F.die(0.70, 1.0),
    };
  }

  /* OpenROAD's initialize_floorplan arithmetic, then whole rows of whole sites. */
  function sizing() {
    var fg = figures();
    var coreArea = fg.total / (SIZING.util / 100);
    var coreW = Math.sqrt(coreArea / SIZING.ar);
    var coreH = coreW * SIZING.ar;
    var rows = Math.floor(coreH / ROW_H);
    var sites = Math.floor(coreW / SITE_W);
    var widest = F.MACROS.reduce(function (mx, m) { return Math.max(mx, m.w, m.h); }, 0);
    return {
      fg: fg, coreArea: coreArea, coreW: coreW, coreH: coreH,
      dieW: coreW + 2 * SIZING.margin, dieH: coreH + 2 * SIZING.margin,
      rows: rows, sites: sites,
      sliverH: coreH - rows * ROW_H, sliverW: coreW - sites * SITE_W,
      whitespace: coreArea - fg.total, widest: widest,
    };
  }

  /* Step 4's pin plan: each group centered on its edge, on the layer
     whose direction runs into the die from that edge. */
  function pins(z) {
    var cx = z.dieW / 2, cy = z.dieH / 2;
    return [
      { group: "inputs", names: "in_data[0] ... in_data[31]", count: 32, edge: "left", layer: "metal3", lo: cy - 60, hi: cy + 60 },
      { group: "outputs", names: "out_data[0] ... out_data[31]", count: 32, edge: "right", layer: "metal3", lo: cy - 60, hi: cy + 60 },
      { group: "control", names: "ctrl[0] ... ctrl[15]", count: 16, edge: "top", layer: "metal2", lo: cx - 40, hi: cx + 40 },
      { group: "clock and reset", names: "clk rst_n", count: 2, edge: "bottom", layer: "metal2", lo: cx - 10, hi: cx + 10 },
    ];
  }

  /* Step 5's one option: the sandbox's "Macros on the edges, pins facing
     in" preset, laid on this exact core. rot 0 = pins down (R0 in the
     files), rot 2 = turned half a turn, pins up (R180). */
  /* Step 5's one option: a memory in each corner, pins facing the core,
     each held CHANNEL micrometers off the core edge. That gap is wide
     enough to be worth having (a halo plus room for cells and wires);
     anything narrower would be a sliver, so it is snapped flat instead.
     rot 0 = pins down (R0 in the files), rot 2 = half a turn, pins up. */
  var CHANNEL = 20;

  function macros(z) {
    var d = { w: z.coreW, h: z.coreH };
    var corners = F.presets().edges.macros;                 /* ids, rotations */
    return corners.map(function (spec) {
      var probe = F.geometry(spec, d);                      /* size in this rotation */
      var left = probe.x < z.coreW / 2, top = probe.y < z.coreH / 2;
      var x = left ? CHANNEL : z.coreW - CHANNEL - probe.w;
      var y = top ? CHANNEL : z.coreH - CHANNEL - probe.h;
      var g = F.geometry({ id: spec.id, rot: spec.rot, cx: (x + probe.w / 2) / z.coreW, cy: (y + probe.h / 2) / z.coreH }, d);
      /* whatever the placement grid leaves, it must not be a sliver */
      var gaps = [g.x, z.coreW - g.x - g.w, g.y, z.coreH - g.y - g.h];
      g.channel = Math.min.apply(null, gaps.filter(function (v) { return v < z.coreW / 3; }));
      g.inst = INSTS[spec.id];
      g.master = MASTERS[spec.id];
      g.orient = spec.rot === 0 ? "R0" : spec.rot === 2 ? "R180" : spec.rot === 1 ? "R90" : "R270";
      g.defOrient = spec.rot === 0 ? "N" : "S";
      g.X = SIZING.margin + g.x;                     /* die frame, y up */
      g.Y = SIZING.margin + (z.coreH - g.y - g.h);
      return g;
    });
  }

  function rectArea(r) { return Math.max(0, r.w) * Math.max(0, r.h); }
  function clip(r, W, H) {
    var x0 = Math.max(0, r.x), y0 = Math.max(0, r.y);
    var x1 = Math.min(W, r.x + r.w), y1 = Math.min(H, r.y + r.h);
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  /* Step 6: the area the halos take out of the core (each halo ring,
     clipped to the core; our macros never have overlapping halos). */
  function halos(z, ms) {
    var ring = 0;
    ms.forEach(function (m) {
      var outer = clip({ x: m.x - HALO, y: m.y - HALO, w: m.w + 2 * HALO, h: m.h + 2 * HALO }, z.coreW, z.coreH);
      ring += rectArea(outer) - m.w * m.h;
    });
    var macroArea = ms.reduce(function (s, m) { return s + m.w * m.h; }, 0);
    var free = z.coreArea - macroArea - ring;
    return { ring: ring, free: free, density: F.CELL_AREA / free, densityNoHalo: F.CELL_AREA / (z.coreArea - macroArea) };
  }

  /* Step 8's power grid, in the core frame (y down). Stripes come in
     pairs: power at offset + k x pitch, ground half a pitch later. */
  var PDN = {
    ringLayers: "metal5 metal6", ringWidth: 2.0, ringSpacing: 1.0, ringOffset: 4.0,
    stripeWidth: 1.0, pitch: 40.0, offset: 10.0,
  };
  function pdn(z, ms) {
    function positions(len, net) {
      var out = [], start = PDN.offset + (net === "VSS" ? PDN.pitch / 2 : 0);
      for (var p = start; p <= len - PDN.stripeWidth; p += PDN.pitch) out.push(p);
      return out;
    }
    var m4 = { VDD: positions(z.coreW, "VDD"), VSS: positions(z.coreW, "VSS") };   /* x positions */
    var m5 = { VDD: positions(z.coreH, "VDD"), VSS: positions(z.coreH, "VSS") };   /* y positions (y down) */
    /* metal4 stripes that cross a macro get cut: the macro owns metal1 to metal4 */
    var cuts = 0;
    ["VDD", "VSS"].forEach(function (net) {
      m4[net].forEach(function (x) {
        ms.forEach(function (m) { if (x + PDN.stripeWidth > m.x && x < m.x + m.w) cuts++; });
      });
    });
    /* each memory is hooked up by the metal5 stripes that cross it */
    var hooks = ms.map(function (m) {
      var n = 0;
      ["VDD", "VSS"].forEach(function (net) {
        m5[net].forEach(function (y) { if (y + PDN.stripeWidth > m.y && y < m.y + m.h) n++; });
      });
      return { label: m.label, stripes: n };
    });
    var ringOuter = PDN.ringOffset + 2 * PDN.ringWidth + PDN.ringSpacing;
    return { m4: m4, m5: m5, cuts: cuts, hooks: hooks, ringOuter: ringOuter,
             m4Share: 2 * PDN.stripeWidth / PDN.pitch };
  }

  /* Step 9: tap and endcap cells, row by row. Rows run in the die's
     y-up frame from the core's bottom edge. Each row is split where a
     macro plus its halo crosses it; every piece gets an endcap at each
     end, and taps every TAP.dist along it, offset by half in alternate
     rows (a checkerboard). */
  var TAP = { dist: 20, tapW: 0.38, endW: 0.38 };
  function taps(z, ms) {
    var blocks = ms.map(function (m) {
      var yu = z.coreH - m.y - m.h;
      return { x0: m.x - HALO, x1: m.x + m.w + HALO, y0: yu - HALO, y1: yu + m.h + HALO };
    });
    var tapN = 0, endN = 0, pieces = 0;
    for (var r = 0; r < z.rows; r++) {
      var y0 = r * ROW_H, y1 = y0 + ROW_H;
      var cut = blocks.filter(function (b) { return y1 > b.y0 && y0 < b.y1; })
        .map(function (b) { return [Math.max(0, b.x0), Math.min(z.coreW, b.x1)]; })
        .sort(function (a, b) { return a[0] - b[0]; });
      var segs = [], x = 0;
      cut.forEach(function (c) { if (c[0] > x) segs.push([x, c[0]]); x = Math.max(x, c[1]); });
      if (x < z.coreW) segs.push([x, z.coreW]);
      segs.forEach(function (sg) {
        if (sg[1] - sg[0] < 2 * TAP.endW) return;
        pieces++;
        endN += 2;
        var start = sg[0] + (r % 2 ? TAP.dist / 2 : 0) + TAP.endW;
        for (var t = start; t < sg[1] - TAP.endW; t += TAP.dist) tapN++;
      });
    }
    var area = tapN * TAP.tapW * ROW_H + endN * TAP.endW * ROW_H;
    return { taps: tapN, endcaps: endN, pieces: pieces, area: area, blocks: blocks };
  }

  function forecasts() {
    var preset = F.presets().edges.macros, middle = F.presets().middle.macros;
    function ev(ms, fc) { return F.evaluate({ util: SIZING.util / 100, ar: SIZING.ar, forecast: fc, macros: ms }); }
    return {
      groute: ev(preset, "groute"), rudy: ev(preset, "rudy"),
      midGroute: ev(middle, "groute"), midRudy: ev(middle, "rudy"),
    };
  }

  function model() {
    var z = sizing();
    var ms = macros(z);
    return { z: z, pins: pins(z), ms: ms, halo: halos(z, ms), pdn: pdn(z, ms), taps: taps(z, ms) };
  }

  /* ================= drawing helpers ================= */

  function table(rows) {
    return '<table class="ff-table ff-summary">' + rows.map(function (r) {
      return "<tr><th>" + r[0] + "</th><td>" + r[1] + "</td></tr>";
    }).join("") + "</table>";
  }
  function checks(list) {
    return '<h3>What to check, and why</h3><ul class="ff-checks">' + list.map(function (c) {
      return "<li><strong>" + c[0] + "</strong> " + c[1] + "</li>";
    }).join("") + "</ul>";
  }

  /* The heat colour for one demand-to-supply (or density) ratio: clear
     below half, then green, amber, red, saturating a third over. */
  function heatColor(r) {
    if (r < 0.5) return "rgba(0,0,0,0)";
    var t = Math.min(1, (r - 0.5) / 0.8);
    var c0 = t < 0.5 ? [22, 163, 74] : [217, 119, 6], c1 = t < 0.5 ? [217, 119, 6] : [220, 38, 38];
    var u = t < 0.5 ? t / 0.5 : (t - 0.5) / 0.5;
    var rgb = c0.map(function (v, i) { return Math.round(v + (c1[i] - v) * u); });
    return "rgba(" + rgb.join(",") + "," + (0.15 + 0.55 * t).toFixed(3) + ")";
  }

  /* The whole die at 440 pixels, drawn in the core frame. Layers are
     switched on by opts: pins, macros, halos, pdn, heat, conns, labels. */
  function plan(M, opts) {
    var z = M.z, mg = SIZING.margin;
    var S = 440 / Math.max(z.dieW, z.dieH), ox = 34, oy = 26;
    var DW = z.dieW * S, DH = z.dieH * S;
    function X(x) { return ox + (mg + x) * S; }       /* core x to pixels */
    function Y(y) { return oy + (mg + y) * S; }       /* core y (down) to pixels */
    var o = [];
    o.push('<svg viewBox="0 0 ' + (DW + 68) + " " + (DH + 56) + '" class="ff3-svg" role="img" aria-label="' + esc(opts.aria || "The floorplan of tile4m") + '">');
    o.push('<rect class="ff3-die" x="' + ox + '" y="' + oy + '" width="' + DW + '" height="' + DH + '"/>');
    o.push('<rect class="ff3-core" x="' + X(0) + '" y="' + Y(0) + '" width="' + z.coreW * S + '" height="' + z.coreH * S + '"/>');

    if (opts.heat) {
      var ev = opts.heat, d = ev.die, sx = z.coreW / d.w, sy = z.coreH / d.h;
      for (var b = 0; b < ev.ratio.length; b++) {
        var r = ev.ratio[b];
        if (r < 0.5 && !opts.heatClass) continue;
        var t = Math.min(1, (r - 0.5) / 0.8);
        var c0 = t < 0.5 ? [22, 163, 74] : [217, 119, 6], c1 = t < 0.5 ? [217, 119, 6] : [220, 38, 38];
        var u = t < 0.5 ? t / 0.5 : (t - 0.5) / 0.5;
        var rgb = c0.map(function (v, i) { return Math.round(v + (c1[i] - v) * u); });
        var bx = b % d.nx, by = (b / d.nx) | 0;
        o.push('<rect' + (opts.heatClass ? ' class="' + opts.heatClass + '" data-bin="' + b + '"' : "") +
               ' x="' + X(bx * d.bw * sx) + '" y="' + Y(by * d.bh * sy) + '" width="' + (d.bw * sx * S + 0.4) +
               '" height="' + (d.bh * sy * S + 0.4) + '" fill="rgba(' + rgb.join(",") + "," + (0.15 + 0.55 * t).toFixed(3) + ')"/>');
      }
    }

    if (opts.pdn) {
      var P = M.pdn, w = PDN.stripeWidth;
      /* metal4 vertical stripes, cut where a macro owns the layer */
      ["VDD", "VSS"].forEach(function (net) {
        P.m4[net].forEach(function (x) {
          var spans = [[0, z.coreH]];
          M.ms.forEach(function (m) {
            if (x + w > m.x && x < m.x + m.w) {
              spans = spans.reduce(function (acc, sp) {
                if (m.y >= sp[1] || m.y + m.h <= sp[0]) { acc.push(sp); return acc; }
                if (m.y > sp[0]) acc.push([sp[0], m.y]);
                if (m.y + m.h < sp[1]) acc.push([m.y + m.h, sp[1]]);
                return acc;
              }, []);
            }
          });
          spans.forEach(function (sp) {
            o.push('<rect class="ff3-m4" fill="' + (net === "VDD" ? VDD_C : VSS_C) + '" x="' + X(x) + '" y="' + Y(sp[0]) +
                   '" width="' + Math.max(1, w * S) + '" height="' + (sp[1] - sp[0]) * S + '"/>');
          });
        });
      });
    }

    if (opts.macros) {
      M.ms.forEach(function (m) {
        var col = MEM_COLORS[m.id];
        if (opts.halos) {
          o.push('<rect class="ff3-halo" x="' + X(m.x - HALO) + '" y="' + Y(m.y - HALO) + '" width="' + (m.w + 2 * HALO) * S +
                 '" height="' + (m.h + 2 * HALO) * S + '"/>');
        }
        o.push('<rect class="ff3-mac" style="stroke:' + col + '" x="' + X(m.x) + '" y="' + Y(m.y) + '" width="' + m.w * S + '" height="' + m.h * S + '"/>');
        var p = m.pin;
        o.push('<line stroke="' + col + '" stroke-width="4" x1="' + X(p.x0) + '" y1="' + Y(p.y0) + '" x2="' + X(p.x1) + '" y2="' + Y(p.y1) + '"/>');
        o.push('<text class="ff3-maclabel" x="' + X(m.x + m.w / 2) + '" y="' + Y(m.y + m.h / 2) + '">' + m.label + "</text>");
        if (opts.orient) o.push('<text class="ff3-macsub" x="' + X(m.x + m.w / 2) + '" y="' + (Y(m.y + m.h / 2) + 14) + '">' + m.orient + "</text>");
      });
    }

    if (opts.pdn) {
      var P2 = M.pdn, w2 = PDN.stripeWidth;
      /* metal5 horizontal stripes run over everything, macros included */
      ["VDD", "VSS"].forEach(function (net) {
        P2.m5[net].forEach(function (y) {
          o.push('<rect class="ff3-m5" fill="' + (net === "VDD" ? VDD_C : VSS_C) + '" x="' + X(0) + '" y="' + Y(y) +
                 '" width="' + z.coreW * S + '" height="' + Math.max(1, w2 * S) + '"/>');
        });
      });
      /* the ring: power inside, ground outside, in the margin */
      [["VDD", PDN.ringOffset], ["VSS", PDN.ringOffset + PDN.ringWidth + PDN.ringSpacing]].forEach(function (rg) {
        var off = rg[1] + PDN.ringWidth / 2;
        o.push('<rect class="ff3-ring" stroke="' + (rg[0] === "VDD" ? VDD_C : VSS_C) + '" stroke-width="' + Math.max(1.5, PDN.ringWidth * S) +
               '" x="' + X(-off) + '" y="' + Y(-off) + '" width="' + (z.coreW + 2 * off) * S + '" height="' + (z.coreH + 2 * off) * S + '"/>');
      });
    }

    if (opts.conns && opts.heat) {
      var ev2 = opts.heat, sx2 = z.coreW / ev2.die.w, sy2 = z.coreH / ev2.die.h;
      ev2.conns.forEach(function (c) {
        o.push('<line class="ff3-conn" x1="' + X(c.a.x * sx2) + '" y1="' + Y(c.a.y * sy2) + '" x2="' + X(c.b.x * sx2) + '" y2="' + Y(c.b.y * sy2) + '"/>');
      });
    }

    if (opts.pins) {
      M.pins.forEach(function (pg) {
        var lo = pg.lo * S, hi = pg.hi * S, n = pg.count;
        for (var i = 0; i < n; i++) {
          var t = n === 1 ? 0.5 : i / (n - 1), q = lo + (hi - lo) * t;
          if (pg.edge === "left") o.push('<line class="ff3-pin" x1="' + ox + '" y1="' + (oy + DH - q) + '" x2="' + (ox + 7) + '" y2="' + (oy + DH - q) + '"/>');
          if (pg.edge === "right") o.push('<line class="ff3-pin" x1="' + (ox + DW - 7) + '" y1="' + (oy + DH - q) + '" x2="' + (ox + DW) + '" y2="' + (oy + DH - q) + '"/>');
          if (pg.edge === "top") o.push('<line class="ff3-pin" x1="' + (ox + q) + '" y1="' + oy + '" x2="' + (ox + q) + '" y2="' + (oy + 7) + '"/>');
          if (pg.edge === "bottom") o.push('<line class="ff3-pin" x1="' + (ox + q) + '" y1="' + (oy + DH - 7) + '" x2="' + (ox + q) + '" y2="' + (oy + DH) + '"/>');
        }
        var mid = (lo + hi) / 2, lab = pg.group + " · " + pg.count;
        if (pg.edge === "left") o.push('<text class="ff3-pinlabel" transform="translate(' + (ox - 10) + "," + (oy + DH - mid) + ') rotate(-90)">' + lab + "</text>");
        if (pg.edge === "right") o.push('<text class="ff3-pinlabel" transform="translate(' + (ox + DW + 12) + "," + (oy + DH - mid) + ') rotate(90)">' + lab + "</text>");
        if (pg.edge === "top") o.push('<text class="ff3-pinlabel" x="' + (ox + mid) + '" y="' + (oy - 9) + '">' + lab + "</text>");
        if (pg.edge === "bottom") o.push('<text class="ff3-pinlabel" x="' + (ox + mid) + '" y="' + (oy + DH + 16) + '">' + lab + "</text>");
      });
    }

    /* sample cells, drawn in core coordinates on top of everything */
    if (opts.cells) {
      o.push('<g transform="translate(' + X(0) + "," + Y(0) + ") scale(" + S + ')">' + opts.cells.core + "</g>");
    }

    if (opts.note) o.push('<text class="ff3-note" x="' + (ox + DW / 2) + '" y="' + (oy + DH / 2) + '">' + esc(opts.note) + "</text>");
    o.push("</svg>");
    return o.join("");
  }

  /* The command scripts a step runs. Each is defined once and used both
     for the script shown on the page and for the log the run echoes, so
     the two can never disagree. */
  function pinCommands(M) {
    return M.pins.map(function (p) {
      return "set_io_pin_constraint -pin_names {" + p.names + "} -region " + p.edge + ":" + f1(p.lo) + "-" + f1(p.hi) +
             (p.count > 2 ? " -group -order" : "");
    }).concat(["place_pins -hor_layers metal3 -ver_layers metal2 -corner_avoidance 30 -min_distance 2"]);
  }

  function pdnCommands() {
    return [
      "add_global_connection -net VDD -pin_pattern {^VDD$} -power",
      "add_global_connection -net VSS -pin_pattern {^VSS$} -ground",
      "global_connect",
      "set_voltage_domain -power VDD -ground VSS",
      "define_pdn_grid -name core",
      "add_pdn_ring   -grid core -layers {metal5 metal6} -widths 2.0 -spacings 1.0 -core_offsets 4.0",
      "add_pdn_stripe -grid core -layer metal1 -followpins",
      "add_pdn_stripe -grid core -layer metal4 -width 1.0 -pitch 40.0 -offset 10.0",
      "add_pdn_stripe -grid core -layer metal5 -width 1.0 -pitch 40.0 -offset 10.0",
      "add_pdn_connect -grid core -layers {metal1 metal4}",
      "add_pdn_connect -grid core -layers {metal4 metal5}",
      "add_pdn_connect -grid core -layers {metal5 metal6}",
      "define_pdn_grid -macro -name mems -cells {mem_wide mem_square} -grid_over_boundary",
      "add_pdn_connect -grid mems -layers {metal4 metal5}",
      "pdngen",
    ];
  }

  var REGION_SCRIPT =
    "# tile4m: one voltage domain, no fences needed\n" +
    "# (a design with two supplies would define a second voltage area here)";

  var FORECAST_SCRIPT =
    "# forecasts, as in the free-play sandbox:\n" +
    "#   RUDY (Rectangular Uniform wire DensitY), then a trial global route";

  /* the lines of a script that the tool actually runs: a log echoes
     commands, never the comments around them */
  function cmdLines(t) {
    return t.split("\n").filter(function (c) { return c.trim() && c.trim().charAt(0) !== "#"; });
  }

  var HANDOFF_SCRIPT =
    "# final checks: legality, power, and the routability forecast\n" +
    "write_def tile4m_floorplan.def\n" +
    "write_db tile4m_floorplan.odb";

  /* ----- steps 1 and 2: the read, and the die ----- */

  /* ----- the simplified log ----- */

  function logLines(fg) {
    var L = [];
    function cmd(t) { L.push({ k: "cmd", t: t }); }
    function out(t) { L.push({ k: "out", t: t }); }
    cmd("read_lef tech.lef");
    out("  metal layers: 6, placement site: core_site, manufacturing grid set");
    cmd("read_lef stdcells.lef");
    out("  standard-cell masters: 212");
    cmd("read_lef mem_wide.lef");
    out("  macro master mem_wide: 150 × 90 micrometers");
    cmd("read_lef mem_square.lef");
    out("  macro master mem_square: 110 × 110 micrometers");
    cmd("read_liberty stdcells_tt.lib");
    out("  timing library loaded, corner: " + DESIGN.corner);
    cmd("read_liberty mem_wide.lib");
    cmd("read_liberty mem_square.lib");
    out("  macro timing models loaded: 2");
    cmd("read_verilog tile4m.v");
    out("  modules read: 6");
    cmd("link_design tile4m");
    out("  instances: " + fmt(fg.cells + 4) + ", nets: " + fmt(fg.nets) + ", ports: " + fg.ports);
    out("  unresolved references: 0");
    cmd("read_sdc tile4m.sdc");
    out("  clocks: 1 (clk, period " + DESIGN.clockPeriodNs.toFixed(1) + " nanoseconds)");
    out("  input and output delays set on " + fg.portBits + " ports");
    L.push({ k: "ok", t: "Design tile4m read and linked. No errors, no warnings." });
    return L;
  }

  /* ----- the report and what to check ----- */

  function reportHtml(fg) {
    var macros = F.MACROS.map(function (m) {
      return "<tr><td>" + m.label + "</td><td><code>" + MASTERS[m.id] + "</code></td><td>" +
        m.w + " × " + m.h + "</td><td>" + fmt(m.w * m.h) + "</td></tr>";
    }).join("");

    var rows = [
      ["Top module", "<code>tile4m</code>"],
      ["Standard-cell instances", fmt(fg.cells)],
      ["Macro instances", "4"],
      ["Nets", fmt(fg.nets)],
      ["Ports", fg.ports + " (" + fg.portBits + " data and control bits, plus clock and reset)"],
      ["Unresolved references", '<span class="ff-good">0</span>'],
      ["Standard-cell area", fmt(fg.cellArea) + " square micrometers"],
      ["Macro area", fmt(fg.macroArea) + " square micrometers (" + Math.round(fg.macroShare * 100) + "% of the total)"],
      ["Total area to place", fmt(fg.total) + " square micrometers"],
      ["Clock", "clk, period " + DESIGN.clockPeriodNs.toFixed(1) + " nanoseconds (500 megahertz)"],
      ["Timing corner", DESIGN.corner],
    ];
    var summary = rows.map(function (r) {
      return "<tr><th>" + r[0] + "</th><td>" + r[1] + "</td></tr>";
    }).join("");

    var checks = [
      ["Every instance resolved.",
       "Zero unresolved references means every cell and macro in the netlist found its " +
       "physical abstract and its timing model. Had a macro's abstract been missing, it " +
       "would appear as an empty black box with no size and no pins, and every later " +
       "step would be planning around a hole."],
      ["The macro list matches the design.",
       "Four macros, two of each master, at the sizes the memory team promised. A wrong " +
       "count or size here usually means a stale netlist or an old macro view."],
      ["The area sets the die.",
       "Cells plus macros need " + fmt(fg.total) + " square micrometers. At 70% " +
       "utilization that becomes a core of about " + fg.die70.w + " × " + fg.die70.h +
       " micrometers, which is where step 2 starts."],
      ["This block is macro-heavy.",
       "Macros are " + Math.round(fg.macroShare * 100) + "% of the area. With this much " +
       "of the block in a few large, immovable rectangles, the macros shape the " +
       "floorplan and the standard cells fill in around them, so macro placement " +
       "(step 5) will decide most of the outcome."],
      ["The pins need edge length.",
       fg.ports + " ports have to fit on the die boundary with legal spacing. That is " +
       "comfortable for a die this size, but it is the number step 4 plans against."],
      ["One clock, one corner.",
       "A single " + DESIGN.clockPeriodNs.toFixed(1) + " nanosecond clock at the typical " +
       "corner is enough to plan with. Sign-off will add slow and fast corners later, " +
       "but floorplanning only needs a realistic estimate."],
    ];
    var checkList = checks.map(function (c) {
      return "<li><strong>" + c[0] + "</strong> " + c[1] + "</li>";
    }).join("");

    return (
      '<h3>Design report</h3>' +
      '<table class="ff-table ff-summary">' + summary + "</table>" +
      '<table class="ff-table ff-macros"><tr><th>Macro</th><th>Master</th>' +
      "<th>Size (micrometers)</th><th>Area (square micrometers)</th></tr>" + macros + "</table>" +
      '<h3>What to check, and why</h3><ul class="ff-checks">' + checkList + "</ul>"
    );
  }

  /* ================= step 2: size the die and core ================= */

  function sizeLog(z) {
    var m = SIZING.margin;
    return [
      { k: "cmd", t: "initialize_floorplan -utilization " + SIZING.util + " -aspect_ratio " +
                     SIZING.ar.toFixed(1) + " -core_space " + m + " -site core_site" },
      { k: "out", t: "  design area " + fmt(z.fg.total) + " square micrometers at " + SIZING.util + "% utilization" },
      { k: "out", t: "  core: (" + f1(m) + ", " + f1(m) + ") to (" + f1(m + z.coreW) + ", " + f1(m + z.coreH) + ")" },
      { k: "out", t: "  die:  (0.0, 0.0) to (" + f1(z.dieW) + ", " + f1(z.dieH) + ")" },
      { k: "out", t: "  rows: " + z.rows + " rows of core_site, " + fmt(z.sites) + " sites per row" },
      { k: "ok", t: "Floorplan initialized: die and core defined, rows created." },
    ];
  }

  /* the die, the core, the margin band, and the four memories to scale */
  function sizeSvg(z) {
    var S = 440 / Math.max(z.dieW, z.dieH), ox = 40, oy = 22;
    var m = SIZING.margin * S;
    var dw = z.dieW * S, dh = z.dieH * S, cw = z.coreW * S, ch = z.coreH * S;
    var o = [];
    o.push('<svg viewBox="0 0 660 ' + (dh + 70) + '" class="ff2-svg" role="img" aria-label="The die and core of tile4m, drawn to scale, with the four memories beside it at the same scale">');
    o.push('<defs><pattern id="ff2-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
           '<line x1="0" y1="0" x2="0" y2="6" class="ff2-hatchline"/></pattern></defs>');
    o.push('<rect class="ff2-die" x="' + ox + '" y="' + oy + '" width="' + dw + '" height="' + dh + '"/>');
    o.push('<rect fill="url(#ff2-hatch)" x="' + ox + '" y="' + oy + '" width="' + dw + '" height="' + dh + '"/>');
    o.push('<rect class="ff2-core" x="' + (ox + m) + '" y="' + (oy + m) + '" width="' + cw + '" height="' + ch + '"/>');
    o.push('<text class="ff2-band" x="' + (ox + dw / 2) + '" y="' + (oy + m / 2 + 3.5) + '">core margin ' +
           SIZING.margin + ' micrometers: room for the power ring and the pins</text>');

    /* the memories at the same scale, in a column beside the die: a size
       reference, deliberately not on the core (placing them is step 5) */
    var MC = { A: "#16a34a", B: "#2563eb", C: "#d97706", D: "#db2777" };
    var gx = ox + dw + 34, gy = oy + 16;
    o.push('<text class="ff2-scale" x="' + gx + '" y="' + (oy + 4) + '">same scale:</text>');
    o.push('<text class="ff2-scale" x="' + gx + '" y="' + (oy + 16) + '">the four memories</text>');
    gy += 12;
    F.MACROS.forEach(function (mm) {
      var w = mm.w * S, h = mm.h * S;
      o.push('<rect class="ff2-mem" style="stroke:' + MC[mm.id] + '" x="' + gx + '" y="' + gy + '" width="' + w + '" height="' + h + '"/>');
      o.push('<text class="ff2-memlabel" x="' + (gx + w / 2) + '" y="' + (gy + h / 2 + 4) + '">' + mm.label + "</text>");
      gy += h + 12;
    });
    o.push('<text class="ff2-scale" x="' + gx + '" y="' + (gy + 4) + '">placed in step 5</text>');

    o.push('<text class="ff2-corelabel" x="' + (ox + dw / 2) + '" y="' + (oy + dh / 2 - 22) + '">core</text>');
    o.push('<text class="ff2-coredim" x="' + (ox + dw / 2) + '" y="' + (oy + dh / 2) + '">' + f1(z.coreW) + " × " + f1(z.coreH) + " micrometers</text>");
    o.push('<text class="ff2-coredim" x="' + (ox + dw / 2) + '" y="' + (oy + dh / 2 + 18) + '">' + fmt(z.coreArea) + " square micrometers, " + z.rows + " rows</text>");

    /* die width dimension line under the die */
    var ly = oy + dh + 18;
    o.push('<line class="ff2-dim" x1="' + ox + '" y1="' + ly + '" x2="' + (ox + dw) + '" y2="' + ly + '"/>');
    o.push('<line class="ff2-dim" x1="' + ox + '" y1="' + (ly - 5) + '" x2="' + ox + '" y2="' + (ly + 5) + '"/>');
    o.push('<line class="ff2-dim" x1="' + (ox + dw) + '" y1="' + (ly - 5) + '" x2="' + (ox + dw) + '" y2="' + (ly + 5) + '"/>');
    o.push('<text class="ff2-dimtext" x="' + (ox + dw / 2) + '" y="' + (ly + 17) + '">die ' + f1(z.dieW) + " × " + f1(z.dieH) + " micrometers</text>");
    o.push("</svg>");
    return o.join("");
  }

  function budgetHtml(z) {
    var cells = z.fg.cellArea / z.coreArea, macros = z.fg.macroArea / z.coreArea, ws = z.whitespace / z.coreArea;
    function seg(cls, frac, label) {
      return '<div class="ff2-seg ' + cls + '" style="width:' + (frac * 100).toFixed(2) + '%"><span>' +
             label + " " + Math.round(frac * 100) + "%</span></div>";
    }
    return '<div class="ff2-budget-title">Where the core area goes</div><div class="ff2-budget">' +
      seg("ff2-seg-cells", cells, "standard cells") + seg("ff2-seg-macros", macros, "macros") +
      seg("ff2-seg-ws", ws, "whitespace") + "</div>";
  }

  function sizeReportHtml(z) {
    var rows = [
      ["Target utilization", SIZING.util + "%"],
      ["Aspect ratio (height ÷ width)", SIZING.ar.toFixed(1)],
      ["Core", f1(z.coreW) + " × " + f1(z.coreH) + " micrometers, " + fmt(z.coreArea) + " square micrometers"],
      ["Core margin", SIZING.margin + " micrometers on every side"],
      ["Die", f1(z.dieW) + " × " + f1(z.dieH) + " micrometers, " + (z.dieW * z.dieH / 1e6).toFixed(3) + " square millimeters"],
      ["Rows", z.rows + " rows of " + fmt(z.sites) + " sites (row height " + ROW_H + ", site width " + SITE_W + ")"],
      ["Whitespace", fmt(z.whitespace) + " square micrometers (" + Math.round(100 * z.whitespace / z.coreArea) + "% of the core)"],
    ].map(function (r) { return "<tr><th>" + r[0] + "</th><td>" + r[1] + "</td></tr>"; }).join("");

    var growth = Math.round(100 * (z.dieW * z.dieH / z.coreArea - 1));
    var checks = [
      ["The utilization came out as asked.",
       "The core is the design area divided by 0.70, exactly. The rows cover all of it except a sliver " +
       z.sliverH.toFixed(2) + " micrometers tall and " + z.sliverW.toFixed(2) + " micrometers wide, " +
       "because a row holds only whole sites."],
      ["The 30% whitespace is a budget, not waste.",
       "About " + fmt(z.whitespace) + " square micrometers are left for routing room above the cells, the " +
       "buffers that timing repair will add, and the clock tree's buffers. Push utilization toward 90% " +
       "and this budget disappears; the free-play sandbox shows congestion climbing as it does."],
      ["The margin is reserved space.",
       SIZING.margin + " micrometers on each side hold the power ring (step 8) and the pins (step 4). It " +
       "costs " + growth + "% more die area than the core alone. Too thin and the ring does not fit; " +
       "too wide and the block wastes silicon."],
      ["Square, because nothing asked otherwise.",
       "For a fixed area a square has the shortest perimeter and the shortest typical wires. Real " +
       "blocks often take their shape from the top-level floorplan they have to fit into."],
      ["Every macro fits.",
       "The largest memory edge is " + z.widest + " micrometers against a " + f1(Math.min(z.coreW, z.coreH)) +
       " micrometer core, so each fits in any orientation with plenty of room. That room is what step 5 " +
       "will spend."],
    ].map(function (c) { return "<li><strong>" + c[0] + "</strong> " + c[1] + "</li>"; }).join("");

    return '<h3>Floorplan report</h3><table class="ff-table ff-summary">' + rows + "</table>" +
      '<h3>What to check, and why</h3><ul class="ff-checks">' + checks + "</ul>";
  }


  /* ================= the steps ================= */

  var STEPS = [];

  /* ----- step 1: read in and sanity-check ----- */

  STEPS.push({
    n: 1, title: "Read in and sanity-check", button: "Read design", againLabel: "Read again",
    line: "Load the netlist, constraints, and library views; confirm every part resolved.",
    runNote: "The log below is simplified; the numbers are the teaching design's.",
    intro: function (M) {
      return '<p>This block arrives from <a href="/explore/examples/synthesis">synthesis</a>: a ' +
      "netlist of " + fmt(M.z.fg.cells) + " cells and four memory instances, with a constraint file " +
      "beside it. Nothing about it is physical yet, which is what this stage is for.</p>" +
      "<p>Before anything is drawn, the tool has to load the design and every library view it refers " +
      "to, then <em>link</em> them: match each instance in the netlist to a physical abstract (its " +
      "outline and pins) and a timing model. The engineer's job here is not glamorous but it is " +
      "load-bearing: confirm that everything resolved and that the numbers match what the design " +
      "should be, before an hour of work is spent on a broken read.</p>";
    },
    widget:
      "<h3>The design, and the files that describe it</h3>" +
      '<div class="ffd-wrap" id="ffd-diagram"></div>' +
      '<div class="ffd-legend">' +
      '<span><span class="ffd-key ffd-key-dash"></span>dashed: in the netlist, not yet linked</span>' +
      '<span><span class="ffd-key ffd-key-solid"></span>solid with ✓: linked to its library views</span>' +
      "<span>click any block to open the file that describes it</span></div>" +
      '<div class="ffd-tabs-head">' +
      '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 1.5v8.2l2-1.9 1.6 3.9 1.6-.7-1.6-3.8h2.8z"/></svg>' +
      "<span><strong>Input files.</strong> Click any file to open it and light up what it describes.</span></div>" +
      '<div class="ffd-tabs ffd-hint" id="ffd-tabs" role="tablist" aria-label="Input files"></div>' +
      '<div class="ffd-view" id="ffd-view"></div>',
    command:
      "read_lef tech.lef\nread_lef stdcells.lef\nread_lef mem_wide.lef\nread_lef mem_square.lef\n" +
      "read_liberty stdcells_tt.lib\nread_liberty mem_wide.lib\nread_liberty mem_square.lib\n" +
      "read_verilog tile4m.v\nlink_design tile4m\nread_sdc tile4m.sdc",
    commandNote:
      "Order matters: the technology comes first because every other view is drawn in its layers, " +
      "and the constraints come last because they name ports and clocks that exist only once the " +
      "design is linked. Every part needs two views: a <em>physical</em> one, the LEF (Library " +
      "Exchange Format) abstract, for placing and routing, and a <em>timing</em> one, the Liberty " +
      "model, for analysis.",
    onShow: function () {
      if (typeof FloorplanDesignView !== "undefined") FloorplanDesignView.init();
    },
    run: function () {
      var fg = figures();
      return {
        log: logLines(fg),
        figure: null,
        report: reportHtml(fg),
        after: function () {
          if (typeof FloorplanDesignView !== "undefined") FloorplanDesignView.markLinked();
        },
      };
    },
  });

  /* ----- step 2: size the die and core ----- */

  STEPS.push({
    n: 2, title: "Size the die and core", button: "Size the die", againLabel: "Size again",
    line: "Utilization, aspect ratio, and the margin between core and die edge.",
    intro:
      "<p>The read said how much there is to place. Now we choose the rectangle it goes in, which is " +
      "really two nested rectangles: the <strong>core</strong>, where every standard cell and macro " +
      "will sit, and the <strong>die</strong>, which is the core plus a margin all the way around.</p>" +
      '<h3>Three numbers decide it</h3><ul class="ff-checks">' +
      "<li><strong>Utilization: " + SIZING.util + "%.</strong> The share of the core the design fills. " +
      "The other " + (100 - SIZING.util) + "% is whitespace, kept on purpose.</li>" +
      "<li><strong>Aspect ratio: " + SIZING.ar.toFixed(1) + ".</strong> Height ÷ width. A square, since " +
      "nothing here forces another shape.</li>" +
      "<li><strong>Core margin: " + SIZING.margin + " micrometers.</strong> The band between the core and " +
      "the die edge, reserved for the power ring and the pins.</li></ul>",
    command:
      "initialize_floorplan -utilization " + SIZING.util + " -aspect_ratio " + SIZING.ar.toFixed(1) +
      " -core_space " + SIZING.margin + " -site core_site",
    commandNote:
      '<a href="https://openroad.readthedocs.io/en/latest/main/src/ifp/README.html">OpenROAD\'s ' +
      "documentation</a> gives the arithmetic: core area = design area ÷ (utilization ÷ 100), core " +
      "width = √(core area ÷ aspect ratio), and core height = width × aspect ratio. " +
      "<code>-site core_site</code> names the placement site from <code>tech.lef</code>: every row is " +
      "one site tall, so the core fills with rows of whole sites.",
    run: function () {
      var z = sizing();
      return { log: sizeLog(z), figure: sizeSvg(z) + budgetHtml(z), report: sizeReportHtml(z) };
    },
  });

  /* ----- step 3: rows and tracks ----- */

  STEPS.push({
    n: 3, title: "Make rows and tracks", button: "Make the tracks",
    line: "Standard-cell rows, alternately flipped, and the routing tracks on each layer.",
    intro:
      "<p>The core now needs two grids. <strong>Rows</strong> are where standard cells sit: " +
      "horizontal strips one cell tall, made of placement <em>sites</em>. " +
      "<code>initialize_floorplan</code> already cut them in step 2, using <code>-site core_site</code>. " +
      "<strong>Tracks</strong> are where wires run: evenly spaced center lines on every metal layer, " +
      "which the router snaps every wire to. Those are made here, because " +
      "<code>initialize_floorplan</code> does not make tracks; it clears any that exist.</p>" +
      "<p>The two grids are designed to agree. In this library a row is 1.4 micrometers tall, exactly " +
      "7 metal1 tracks, and a site is 0.19 micrometers wide, exactly one metal2 track, so every cell's " +
      "pins land on tracks wherever the cell is placed.</p>",
    command: "make_tracks\n" +
      "set_routing_layers -signal metal2-metal6 -clock metal4-metal6",
    commandNote:
      "<code>make_tracks</code> with no arguments is the usual call: it covers every layer using the " +
      "offsets and pitches already declared in <code>tech.lef</code>, which is where the numbers below " +
      "come from. A process that needs different values ships the per-layer form instead, exactly as " +
      "the SkyWater 130 nanometer platform does in the open flow " +
      "(<a href=\"https://github.com/The-OpenROAD-Project/OpenROAD-flow-scripts/blob/master/flow/platforms/sky130hd/make_tracks.tcl\">its make_tracks file</a>). " +
      "Either way each layer gets tracks in both directions, while routing runs mostly along the " +
      "layer's <em>preferred</em> direction (metal1 horizontal, metal2 vertical, alternating up the " +
      "stack). Offsets are half a pitch, so the first track sits half a pitch in from the edge.</p>" +
      "<p>The second command records which layers each kind of net may use later. Signals get almost the " +
      "whole stack; the clock is held to metal4 and above, because those layers are thicker and lower " +
      "resistance, and the clock is the one net whose delay is felt everywhere. The reference flow sets " +
      "both here, at floorplan time, long before anything is routed.",
    reference:
      '<h3>Where these numbers come from</h3>' +
      "<p>Every pitch on this page is read from <code>tech.lef</code>, the technology file loaded first " +
      "in step 1. These are the sections this step depends on:</p>" +
      '<pre class="ffd-code">' + esc(techLef("grid").join("\n")) + "</pre>" +
      '<table class="ff-table"><tr><th>In the file</th><th>What it fixes</th></tr>' +
      "<tr><td><code>SITE core_site SIZE " + SITE_W + " BY " + ROW_H + "</code></td>" +
      "<td>The placement site: every row is " + ROW_H + " micrometers tall and every cell is a whole number of " +
      SITE_W + " micrometer sites wide.</td></tr>" +
      "<tr><td><code>LAYER metal1 PITCH " + LAYERS[0].yp.toFixed(2) + "</code></td>" +
      "<td>Horizontal track spacing. " + ROW_H + " ÷ " + LAYERS[0].yp.toFixed(2) + " = " +
      Math.round(ROW_H / LAYERS[0].yp) + ", so a row is exactly " + Math.round(ROW_H / LAYERS[0].yp) + " tracks tall.</td></tr>" +
      "<tr><td><code>LAYER metal2 PITCH " + LAYERS[1].xp.toFixed(2) + "</code></td>" +
      "<td>Vertical track spacing, equal to the site width, so one site is exactly one track.</td></tr>" +
      "<tr><td><code>DIRECTION</code> on each layer</td>" +
      "<td>The preferred routing direction, alternating up the stack, which decides whether a pin group " +
      "gets a horizontal or a vertical layer in step 4.</td></tr></table>" +
      '<div class="ffd-note">The full file, with every layer and the vias, is the <code>tech.lef</code> tab in step 1.</div>' +
      "<p>A process whose tracks do not match its technology file overrides them layer by layer instead, " +
      "which is what the per-layer form looks like for this stack:</p>" +
      '<pre class="ffd-code">' + esc(LAYERS.map(function (L) {
        return "make_tracks " + L.name + " -x_offset " + L.xo + " -x_pitch " + L.xp + " -y_offset " + L.yo + " -y_pitch " + L.yp;
      }).join("\n")) + "</pre>",
    run: function (M) {
      var z = M.z;
      var log = [{ k: "cmd", t: "make_tracks" }];
      var routing = { k: "cmd", t: "set_routing_layers -signal metal2-metal6 -clock metal4-metal6" };
      LAYERS.forEach(function (L) {
        var len = L.dir === "horizontal" ? z.dieH : z.dieW;
        log.push({ k: "out", t: "  " + L.name + ": " + fmt(Math.floor(len / L.pitch)) + " " + L.dir + " tracks, pitch " + f2(L.pitch) });
      });
      log.push({ k: "out", t: "  rows (from step 2): " + z.rows + ", alternating unflipped (N) and flipped south (FS)" });
      log.push(routing);
      log.push({ k: "out", t: "  signals may use metal2 to metal6; clock nets are held to metal4 and above" });
      log.push({ k: "ok", t: "Tracks created on 6 layers, routing layers recorded." });

      /* Three panels, each answering one question, instead of one dense
         overlay: A the rows, B one row's tracks up close, C where each
         layer's tracks sit. */
      var o = ['<svg viewBox="0 0 930 330" class="ff3-svg ff3-zoom" role="img" aria-label="Three panels: the rows and their shared rails, one row with its metal1 and metal2 tracks, and the track pitch of all six layers">'];
      function T(x, y, t, cls) { o.push('<text class="' + (cls || "ff3-cap") + '" x="' + x + '" y="' + y + '">' + t + "</text>"); }

      /* ---- panel A: rows ---- */
      var ax = 140, ay = 44, apx = 34, arows = 4, asites = 14;
      var aw = asites * SITE_W * apx, ah = ROW_H * apx;
      T(ax - 106, 26, "A · the rows", "ff3-panel");
      for (var r = 0; r < arows; r++) {
        var yTop = ay + (arows - 1 - r) * ah;
        o.push('<rect class="' + (r % 2 ? "ff3-row-fs" : "ff3-row-n") + '" x="' + ax + '" y="' + yTop + '" width="' + aw + '" height="' + ah + '"/>');
        T(ax - 8, yTop + ah / 2 + 4, "row " + r + " · " + (r % 2 ? "flipped" : "unflipped"), "ff3-rowlabel");
      }
      for (var b = 0; b <= arows; b++) {
        var yb = ay + (arows - b) * ah, isPower = b % 2 === 1;
        o.push('<rect x="' + ax + '" y="' + (yb - 3) + '" width="' + aw + '" height="6" fill="' + (isPower ? VDD_C : VSS_C) + '" opacity="0.8"/>');
        T(ax + aw + 6, yb + 4, isPower ? "power" : "ground", "ff3-raillabel");
      }
      T(ax - 106, ay + arows * ah + 22, "each rail is shared by the two rows it", "ff3-cap");
      T(ax - 106, ay + arows * ah + 36, "separates: 5 rails carry 4 rows", "ff3-cap");

      /* ---- panel B: one row, up close ---- */
      var bx = 356, by = 56, bpx = 108, bsites = 8;
      var bw = bsites * SITE_W * bpx, bh = ROW_H * bpx;
      var m1 = LAYERS[0].yp, m2 = LAYERS[1].xp, nTrk = Math.round(ROW_H / m1);
      T(bx - 40, 26, "B · one row, and its tracks", "ff3-panel");
      o.push('<rect class="ff3-row-n" x="' + bx + '" y="' + by + '" width="' + bw + '" height="' + bh + '"/>');
      /* metal2: one vertical track per site, at the site's center */
      for (var v = 0; v < bsites; v++) {
        var xv = bx + (v + 0.5) * m2 * bpx;
        o.push('<line class="ff3-m2trk" x1="' + xv + '" y1="' + (by - 6) + '" x2="' + xv + '" y2="' + (by + bh + 6) + '"/>');
      }
      /* site boundaries, as ticks under the row */
      for (var sI = 0; sI <= bsites; sI++) {
        var xs = bx + sI * m2 * bpx;
        o.push('<line class="ff3-sitetick" x1="' + xs + '" y1="' + (by + bh) + '" x2="' + xs + '" y2="' + (by + bh + 12) + '"/>');
      }
      /* metal1: 7 horizontal tracks, numbered */
      for (var t1 = 0; t1 < nTrk; t1++) {
        var yt = by + bh - (t1 + 0.5) * m1 * bpx;
        o.push('<line class="ff3-m1trk" x1="' + (bx - 6) + '" y1="' + yt + '" x2="' + (bx + bw + 6) + '" y2="' + yt + '"/>');
        T(bx - 14, yt + 3.5, String(t1 + 1), "ff3-trknum");
      }
      /* the row's own height, and one metal1 pitch, dimensioned on the right */
      var dx = bx + bw + 26;
      o.push('<line class="ff3-dim" x1="' + dx + '" y1="' + by + '" x2="' + dx + '" y2="' + (by + bh) + '"/>');
      o.push('<line class="ff3-dim" x1="' + (dx - 4) + '" y1="' + by + '" x2="' + (dx + 4) + '" y2="' + by + '"/>');
      o.push('<line class="ff3-dim" x1="' + (dx - 4) + '" y1="' + (by + bh) + '" x2="' + (dx + 4) + '" y2="' + (by + bh) + '"/>');
      T(dx + 8, by + bh / 2 - 6, "row: " + ROW_H, "ff3-dimtext2");
      T(dx + 8, by + bh / 2 + 8, "= " + nTrk + " tracks", "ff3-dimtext2");
      var py0 = by + bh - 0.5 * m1 * bpx, py1 = py0 - m1 * bpx;
      o.push('<line class="ff3-dim2" x1="' + (bx + bw + 10) + '" y1="' + py0 + '" x2="' + (bx + bw + 10) + '" y2="' + py1 + '"/>');
      T(bx + bw + 14, (py0 + py1) / 2 + 3.5, "pitch " + m1.toFixed(2), "ff3-dimtext3");
      /* the site width, dimensioned under the row */
      var sy = by + bh + 24;
      o.push('<line class="ff3-dim" x1="' + bx + '" y1="' + sy + '" x2="' + (bx + m2 * bpx) + '" y2="' + sy + '"/>');
      T(bx + m2 * bpx + 6, sy + 4, "1 site = " + m2 + " = 1 metal2 track", "ff3-dimtext3");
      T(bx - 40, by + bh + 52, "a cell's horizontal pins land on the green tracks,", "ff3-cap");
      T(bx - 40, by + bh + 66, "its vertical pins on the purple ones", "ff3-cap");

      /* ---- panel C: the pitch of every layer ---- */
      var cx = 692, cy = 50, cw = 176, cpx = 58, gap = 34;
      T(cx, 26, "C · every layer's tracks", "ff3-panel");
      LAYERS.forEach(function (L, i) {
        var ly = cy + i * gap, pitch = L.dir === "horizontal" ? L.yp : L.xp;
        var cls = L.dir === "horizontal" ? "ff3-m1trk" : "ff3-m2trk";
        o.push('<rect class="ff3-layerstrip" x="' + cx + '" y="' + ly + '" width="' + cw + '" height="16"/>');
        for (var q = pitch / 2; q < cw / cpx; q += pitch) {
          var qx = cx + q * cpx;
          o.push('<line class="' + cls + '" x1="' + qx + '" y1="' + ly + '" x2="' + qx + '" y2="' + (ly + 16) + '"/>');
        }
        T(cx, ly - 4, L.name + " · " + (L.dir === "horizontal" ? "horizontal" : "vertical") + " · pitch " + pitch.toFixed(2), "ff3-layerlabel");
      });
      T(cx, cy + LAYERS.length * gap + 4, "ticks are tracks, to scale: the", "ff3-cap");
      T(cx, cy + LAYERS.length * gap + 18, "pitch doubles every two layers,", "ff3-cap");
      T(cx, cy + LAYERS.length * gap + 32, "so upper layers are wider and", "ff3-cap");
      T(cx, cy + LAYERS.length * gap + 46, "offer fewer tracks", "ff3-cap");
      o.push("</svg>");

      var trows = LAYERS.map(function (L) {
        var len = L.dir === "horizontal" ? z.dieH : z.dieW;
        return [L.name, L.dir + ", pitch " + f2(L.pitch) + ", " + fmt(Math.floor(len / L.pitch)) + " tracks across the die"];
      });
      trows.unshift(["Rows", z.rows + " rows of " + fmt(z.sites) + " sites, alternately unflipped (N) and flipped south (FS)"]);

      return {
        log: log,
        figure: o.join(""),
        report: "<h3>Grid report</h3>" + table(trows) + checks([
          ["A row is exactly 7 metal1 tracks.",
           "1.4 ÷ 0.20 = 7. Cells are drawn on that 7-track grid, so their horizontal pins line up with " +
           "tracks in every row. A mismatch would leave pins between tracks, unreachable."],
          ["A site is exactly one metal2 track.",
           "0.19 micrometers both. Cells snap to whole sites, so their vertical pins land on metal2 tracks " +
           "wherever the placer puts them."],
          ["Alternate rows are flipped.",
           "Rows alternate N (as drawn) and FS (flipped south, upside down), so each power rail is shared " +
           "by the two rows it separates. That halves the number of rails, and it is why a standard " +
           "cell has power on one edge and ground on the other."],
          ["The pitch doubles going up.",
           "Upper layers are thicker and wider, so they carry current with less resistance but offer " +
           "fewer tracks. Power and long wires go up; short local wires stay low. Over a macro only " +
           "metal5 and metal6 remain, which is why routing above a macro is scarce."],
        ]),
      };
    },
  });

  /* ----- step 4: pins ----- */

  STEPS.push({
    n: 4, title: "Place the input/output pins", button: "Place the pins",
    line: "Which edge each pin group sits on, in what order, on which layer.",
    intro:
      "<p>Every port of <code>tile4m</code> needs a spot on the die boundary: a small metal shape where " +
      "a wire from outside the block will land. The engineer decides which edge each group goes on and " +
      "where along it; the pin placer then spaces the individual pins legally on the tracks.</p>" +
      "<p>Every group talks to the hub, which will sit near the middle, so each group goes in the middle " +
      "of an edge: inputs on the left, outputs on the right, control on top, clock and reset on the bottom. " +
      "In a real chip these positions are dictated by where the neighboring blocks are.</p>",
    command: function (M) { return pinCommands(M).join("\n"); },
    commandNote: function (M) {
      var p = M.pins[0];
      return "The <code>...</code> stands for the full list of names, which a real script spells out. " +
      "<code>-region left:" + f1(p.lo) + "-" + f1(p.hi) + "</code> confines a group to that stretch of the left edge; " +
      "<code>-group -order</code> keeps the bus together and in bit order. Left and right edges take " +
      "horizontal pins on metal3, top and bottom take vertical pins on metal2 " +
      "(<a href=\"https://openroad.readthedocs.io/en/latest/main/src/ppl/README.html\">pin placer documentation</a>).";
    },
    reference: function (M) {
      return "<h3>Why those edges: where tile4m sits</h3>" +
        "<p>The edges are not a free choice. <code>tile4m</code> is one block inside a larger chip, " +
        "and each of its pin groups belongs on the edge facing the block it talks to. Put the inputs " +
        "on the right instead and every bit would have to travel around this block, at the parent's " +
        "expense, not yours.</p>" +
        neighborSvg(M) +
        "<p>These are <strong>block pins</strong>: metal shapes on this block's boundary, on ordinary " +
        "routing layers. They are not chip pads. At the top level of a chip the outside world is " +
        "reached through input/output cells and either a ring of bond pads around the die edge " +
        "(wire-bond) or an array of bumps spread across the die face (flip chip), and that choice " +
        "reshapes the whole top-level floorplan. This page never gets that far up the hierarchy.</p>";
    },
    run: function (M) {
      var log = pinCommands(M).map(function (c) { return { k: "cmd", t: c }; });
      var total = 0;
      M.pins.forEach(function (p) {
        total += p.count;
        log.push({ k: "out", t: "  " + p.edge + " edge: " + p.count + " pins (" + p.group + ") on " + p.layer + ", " + f1(p.lo) + " to " + f1(p.hi) });
      });
      log.push({ k: "ok", t: "Placed " + total + " pins. No violations." });
      var rows = M.pins.map(function (p) {
        var pitch = p.count > 1 ? (p.hi - p.lo) / (p.count - 1) : 0;
        return [p.group, p.count + " pins, " + p.edge + " edge, " + p.layer + (p.count > 1 ? ", one every " + f2(pitch) + " micrometers" : "")];
      });
      var inPitch = (M.pins[0].hi - M.pins[0].lo) / (M.pins[0].count - 1);
      return {
        log: log,
        figure: plan(M, { pins: true, note: "core (empty until step 5)", aria: "The die with the four pin groups on its edges" }),
        report: "<h3>Pin report</h3>" + table(rows.concat([["Total", total + " pins, all within their regions, none within 30 micrometers of a corner"]])) + checks([
          ["Each group faces the logic it feeds.",
           "All four groups connect to the hub, which will land near the center, so centered groups give " +
           "the shortest wires. A group in a corner would drag the hub, and every wire to it, sideways."],
          ["The spacing leaves room to escape.",
           "The input bus has a pin every " + f2(inPitch) + " micrometers, about " + Math.round(inPitch / 0.40) +
           " metal3 tracks apart. Each pin's wire needs room to turn into the core; packing pins onto " +
           "adjacent tracks makes that first turn a routing jam."],
          ["The layer matches the edge.",
           "A pin on the left edge is entered by a horizontal wire, so it sits on metal3, a horizontal " +
           "layer. Top and bottom pins sit on metal2, a vertical one. Wrong-direction pins cost a via and " +
           "a jog for every bit."],
          ["The corners stay clear.",
           "Nothing within 30 micrometers of a corner, where the power ring turns and routing from two " +
           "edges collides."],
          ["The ring will not block them.",
           "The power ring (step 8) runs on metal5 and metal6, above these pins on metal2 and metal3, so " +
           "the signal wires pass under it freely."],
        ]),
      };
    },
  });

  /* Where tile4m sits one level up: the neighbors decide which edge each
     pin group belongs on. Drawn from the pin plan, so the two agree. */
  function neighborSvg(M) {
    var o = ['<svg viewBox="0 0 740 386" class="ff3-svg ff3-zoom" role="img" aria-label="tile4m inside its parent block, with the neighboring blocks it connects to on each side">'];
    o.push('<defs><marker id="ff4-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
           '<path d="M 0 0 L 10 5 L 0 10 z" fill="#7c3aed"/></marker></defs>');
    o.push('<rect class="ff4-parent" x="16" y="16" width="708" height="320"/>');
    o.push('<text class="ff4-parentlabel" x="30" y="36">one level up: the parent block</text>');

    var cx0 = 270, cy0 = 122, cw = 200, ch = 120;
    o.push('<rect class="ff4-self" x="' + cx0 + '" y="' + cy0 + '" width="' + cw + '" height="' + ch + '"/>');
    o.push('<text class="ff4-selflabel" x="' + (cx0 + cw / 2) + '" y="' + (cy0 + ch / 2 - 4) + '">tile4m</text>');
    o.push('<text class="ff4-selfsub" x="' + (cx0 + cw / 2) + '" y="' + (cy0 + ch / 2 + 16) + '">the block being floorplanned</text>');

    /* one neighbor per pin group, on the matching edge */
    var N = [
      { edge: "left", label: "input staging", sub: "feeds the data in", x: 40, y: 142, w: 140, h: 80, group: 0 },
      { edge: "right", label: "output formatter", sub: "takes the results", x: 560, y: 142, w: 140, h: 80, group: 1 },
      { edge: "top", label: "sequencer", sub: "sets the mode", x: 300, y: 42, w: 140, h: 54, group: 2 },
      { edge: "bottom", label: "clock and reset", sub: "drives every block", x: 292, y: 270, w: 156, h: 54, group: 3 },
    ];
    N.forEach(function (nb) {
      var pg = M.pins[nb.group];
      o.push('<rect class="ff4-nb" x="' + nb.x + '" y="' + nb.y + '" width="' + nb.w + '" height="' + nb.h + '"/>');
      o.push('<text class="ff4-nblabel" x="' + (nb.x + nb.w / 2) + '" y="' + (nb.y + nb.h / 2 - 2) + '">' + nb.label + "</text>");
      o.push('<text class="ff4-nbsub" x="' + (nb.x + nb.w / 2) + '" y="' + (nb.y + nb.h / 2 + 14) + '">' + nb.sub + "</text>");
      var x1, y1, x2, y2, lx, ly;
      var anchor = "middle";
      if (nb.edge === "left") { x1 = nb.x + nb.w; y1 = nb.y + nb.h / 2; x2 = cx0; y2 = cy0 + ch / 2; lx = (x1 + x2) / 2; ly = y1 - 10; }
      if (nb.edge === "right") { x1 = cx0 + cw; y1 = cy0 + ch / 2; x2 = nb.x; y2 = nb.y + nb.h / 2; lx = (x1 + x2) / 2; ly = y1 - 10; }
      if (nb.edge === "top") { x1 = nb.x + nb.w / 2; y1 = nb.y + nb.h; x2 = cx0 + cw / 2; y2 = cy0; lx = x1 + 12; ly = (y1 + y2) / 2 + 4; anchor = "start"; }
      if (nb.edge === "bottom") { x1 = nb.x + nb.w / 2; y1 = nb.y; x2 = cx0 + cw / 2; y2 = cy0 + ch; lx = x1 + 12; ly = (y1 + y2) / 2 + 4; anchor = "start"; }
      o.push('<line class="ff4-arrow" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" marker-end="url(#ff4-arrow)"/>');
      o.push('<text class="ff4-arrowlabel" style="text-anchor:' + anchor + '" x="' + lx + '" y="' + ly + '">' + pg.group + " · " + pg.count + "</text>");
    });
    o.push('<text class="ff3-cap" x="16" y="358">each group sits on the edge that faces the block it talks to, and in the middle of that edge,</text>');
    o.push('<text class="ff3-cap" x="16" y="374">because that is where the neighbor is. The arrow labels are the pin groups placed in this step.</text>');
    o.push("</svg>");
    return o.join("");
  }

  /* ----- step 5: macros ----- */

  STEPS.push({
    n: 5, title: "Place the macros", button: "Place the macros",
    line: "Position, orientation, pins facing the core, channels, grid snapping.",
    intro:
      "<p>The four memories are the largest objects in the block and they cannot move once placed, so they " +
      "go first and everything else fills in around them. The one option here is the classic starting " +
      "point: <strong>a memory in each corner, pin edges facing into the core</strong>.</p>" +
      "<p>The top two keep their natural orientation, R0, with pins along the bottom edge. The bottom two " +
      "are turned half a turn, R180, so their pins face up. Coordinates are the lower-left corner of " +
      "each memory in the die frame, in micrometers.</p>" +
      "<p>Each memory is held about " + CHANNEL + " micrometers off the core edge, not pushed flat against " +
      "it. That channel is where the things that need to pass behind a macro go: nets crossing from one " +
      "side of the block to the other, a ring drawn around the macro itself, and the rows of standard " +
      "cells that keep running past it. The rule is <strong>leave a channel worth having, or abut, but " +
      "never a sliver</strong>: a gap of a few micrometers holds no cells once the halo is subtracted, " +
      "carries almost no routing, and still costs area.</p>",
    command: function (M) {
      return M.ms.map(function (m) {
        return "place_macro -macro_name " + m.inst + " -location {" + f2(m.X) + " " + f2(m.Y) + "} -orientation " + m.orient;
      }).join("\n");
    },
    commandNote:
      "By default <code>place_macro</code> nudges each location slightly so the memory's signal pins line " +
      "up with the routing tracks " +
      "(<a href=\"https://openroad.readthedocs.io/en/latest/main/src/mpl/README.html\">macro placer documentation</a>). " +
      "Automatic macro placers exist and are good, but a hand placement you can reason about is the " +
      "baseline every automatic result gets compared to.",
    run: function (M, FC) {
      var log = [];
      M.ms.forEach(function (m) {
        log.push({ k: "cmd", t: "place_macro -macro_name " + m.inst + " -location {" + f2(m.X) + " " + f2(m.Y) + "} -orientation " + m.orient });
        log.push({ k: "out", t: "  " + m.inst + " (" + m.master + ") fixed at " + f2(m.X) + ", " + f2(m.Y) + ", pins facing " + ({ N: "up", S: "down", E: "right", W: "left" })[m.side] });
      });
      var chMin = Math.min.apply(null, M.ms.map(function (m) { return m.channel; }));
      var chMax = Math.max.apply(null, M.ms.map(function (m) { return m.channel; }));
      log.push({ k: "out", t: "  channel to the core edge: " + chMin.toFixed(2) + " to " + chMax.toFixed(2) +
                 " micrometers (target " + CHANNEL + ", adjusted by the placement grid)" });
      log.push({ k: "ok", t: "4 macros placed and fixed." });
      var ev = FC.groute, mid = FC.midGroute;
      var gapTop = M.ms[1].x - (M.ms[0].x + M.ms[0].w);
      var rows = M.ms.map(function (m) {
        return [m.label, "<code>" + m.inst + "</code>, " + m.master + ", at (" + f2(m.X) + ", " + f2(m.Y) + "), " + m.orient +
                ", " + f1(m.channel) + " micrometers off the core edge"];
      });
      return {
        log: log,
        figure: plan(M, { pins: true, macros: true, orient: true, aria: "The core with a memory in each corner, pins facing in" }),
        report: "<h3>Macro report</h3>" + table(rows.concat([
          ["Overlaps", "none"], ["Pin access", "every pin edge faces open core"],
          ["Open core between the top pair", f1(gapTop) + " micrometers wide"],
        ])) + checks([
          ["The core stays in one piece.",
           "With the memories in the corners, the standard cells get one contiguous region shaped like a " +
           "plus sign, and the hub can sit in its middle. Memories in the middle would cut the core into " +
           "islands joined by narrow gaps."],
          ["Every pin edge faces the core.",
           "Each memory's 64-bit bus leaves toward its controller in the open core, not into a wall. " +
           "The free-play sandbox's \"Pins facing the wall\" preset shows the cost: about a quarter more wire."],
          ["It forecasts cleanly.",
           "On the sandbox's trial global route this placement peaks at " + Math.round(ev.metrics.peak * 100) +
           "% of routing supply, while the same memories in the middle peak at " + Math.round(mid.metrics.peak * 100) +
           "%. Step 10 looks at this in detail."],
          ["A channel, not a sliver.",
           "Every memory stands " + Math.min.apply(null, M.ms.map(function (m) { return m.channel; })).toFixed(1) +
           " to " + Math.max.apply(null, M.ms.map(function (m) { return m.channel; })).toFixed(1) +
           " micrometers off the core edge. Take the 10 micrometer halo out of that and roughly half of it is " +
           "still placeable, and all of it is routable, so the gap earns its area. The failure to avoid is " +
           "the in-between: a few micrometers that hold nothing. The same rule governs gaps between two " +
           "macros, which the free-play sandbox's \"Tight channel\" preset shows from the other side."],
          ["Legal and on grid.",
           "Inside the core, no overlaps, and snapped so pins sit on tracks. The memories are now " +
           "<em>fixed</em>: the placer will work around them, never move them."],
        ]),
      };
    },
  });

  /* ----- step 6: halos and blockages ----- */

  STEPS.push({
    n: 6, title: "Halos and blockages", button: "Add the halos",
    line: "Keep-out rings around macros; hard, soft, and partial placement blockages.",
    intro:
      "<p>A <strong>halo</strong> is a keep-out ring around a macro where no standard cell may be placed. " +
      "It keeps the area in front of the memory's pins open for the wires that must reach them, and it " +
      "keeps cells from crowding the macro's edge. The one option here: a 10 micrometer halo on every " +
      "side of every memory.</p>" +
      "<p>A <strong>placement blockage</strong> is the same idea for any rectangle: <em>hard</em> (no cells " +
      "at all), <em>soft</em> (no cells at first, though later repair steps may add some), or " +
      "<em>partial</em> (cells allowed up to a density, such as 50%). This floorplan needs none: there are " +
      "no narrow channels between macros to fill, and no known hot spot to thin out yet.</p>",
    command: function () { return "set_macro_base_halo 10 10"; },
    commandNote:
      "<code>set_macro_base_halo width height</code> sets the same halo on every macro; " +
      "<code>set_macro_halo</code> overrides it for one. Both are in the " +
      "<a href=\"https://openroad.readthedocs.io/en/latest/main/src/mpl/README.html\">macro placer documentation</a>.",
    run: function (M) {
      var h = M.halo;
      var log = [
        { k: "cmd", t: "set_macro_base_halo 10 10" },
        { k: "out", t: "  halo of 10 micrometers on all sides of 4 macros" },
        { k: "out", t: "  area kept free of standard cells: " + fmt(h.ring) + " square micrometers" },
        { k: "ok", t: "Halos set. No placement blockages defined." },
      ];
      return {
        log: log,
        figure: plan(M, { pins: true, macros: true, halos: true, aria: "The memories with their halo rings" }),
        report: "<h3>Halo report</h3>" + table([
          ["Halo", "10 micrometers on every side of every memory"],
          ["Area inside the halos", fmt(h.ring) + " square micrometers, all of it inside the core"],
          ["Area left for standard cells", fmt(h.free) + " square micrometers"],
          ["Cell density in that area", Math.round(h.density * 100) + "% (was " + Math.round(h.densityNoHalo * 100) + "% before the halos)"],
          ["Placement blockages", "none"],
        ]) + checks([
          ["The halos cost area, and that is fine.",
           "They take " + fmt(h.ring) + " square micrometers, raising the density the cells must pack to from " +
           Math.round(h.densityNoHalo * 100) + "% to " + Math.round(h.density * 100) + "%. Still comfortably below full."],
          ["The channel absorbs them.",
           "Each halo sits inside the core, in the channel the macros already stand off by, so it takes " +
           "cell area rather than overlapping the core edge. That is the price of the channel, and it is " +
           "visible in the density above."],
          ["No blockages yet, on purpose.",
           "Blockages answer a problem you can see: a channel too narrow to use, or a congestion hot spot. " +
           "Step 10's forecast is where one would show up."],
        ]),
      };
    },
  });

  /* ----- step 7: regions and fences ----- */

  STEPS.push({
    n: 7, title: "Regions and fences", button: "Check the design",
    line: "Tie a logic module to a physical area of the die.",
    intro:
      "<p>A <strong>region</strong> ties a group of cells to an area of the die. A <em>guide</em> suggests " +
      "it, a <em>fence</em> enforces it (those cells inside, everything else outside). The most common " +
      "reason is power: a block with two supply voltages, or a part that shuts off to save power, needs " +
      "its cells inside their own <em>voltage area</em>, fed by their own grid.</p>" +
      "<p>For <code>tile4m</code> the right answer is <strong>none</strong>. It has one supply, nothing " +
      "switches off, and it is small enough that the placer keeps connected logic together on its own. " +
      "Recognizing that a step is not needed is part of the job.</p>",
    command: function () { return REGION_SCRIPT; },
    commandNote:
      "In OpenROAD, a voltage area is a region in the design database, which the power grid step then " +
      "feeds through <code>set_voltage_domain -region</code> " +
      "(<a href=\"https://openroad.readthedocs.io/en/latest/main/src/pdn/README.html\">power grid documentation</a>).",
    run: function (M) {
      var log = cmdLines(REGION_SCRIPT).map(function (c) { return { k: "cmd", t: c }; });
      [
        { k: "out", t: "  supply voltages: 1 (one power net, one ground net)" },
        { k: "out", t: "  power-switched parts: 0" },
        { k: "out", t: "  modules that need a fence: 0" },
        { k: "ok", t: "No regions needed. Moving on is the correct result." },
      ].forEach(function (l) { log.push(l); });
      /* illustration only: what a voltage area would look like, dashed, in the open core */
      var fig = plan(M, { pins: true, macros: true, halos: true, aria: "The floorplan with an illustrative, unused voltage area" });
      var z = M.z, S = 440 / Math.max(z.dieW, z.dieH), mg = SIZING.margin;
      var rx = 34 + (mg + z.coreW * 0.36) * S, ry = 26 + (mg + z.coreH * 0.38) * S, rw = z.coreW * 0.28 * S, rh = z.coreH * 0.24 * S;
      fig = fig.replace("</svg>",
        '<rect class="ff3-region" x="' + rx + '" y="' + ry + '" width="' + rw + '" height="' + rh + '"/>' +
        '<text class="ff3-regionlabel" x="' + (rx + rw / 2) + '" y="' + (ry + rh / 2 - 4) + '">example only:</text>' +
        '<text class="ff3-regionlabel" x="' + (rx + rw / 2) + '" y="' + (ry + rh / 2 + 11) + '">a voltage area</text></svg>');
      return {
        log: log,
        figure: fig,
        report: "<h3>Region report</h3>" + table([
          ["Voltage areas", "1, the whole core (one power net, one ground net)"], ["Fences", "none"], ["Guides", "none"],
        ]) + checks([
          ["One supply, one area.",
           "Every cell runs from the same power and ground, so the whole core is one voltage area and no " +
           "boundary has to be drawn. The dashed box in the figure is only an illustration."],
          ["When you would need one.",
           "Two supply voltages, a part that powers down, a module that must sit near its pins or its " +
           "neighbor, or a large block split between engineers. Each of those draws a boundary here, and " +
           "the power grid (step 8) then builds a separate grid inside it."],
          ["Fences cost freedom.",
           "Every fence is a constraint the placer must obey even when a better spot exists outside it. " +
           "Adding one without a reason makes the result worse, not safer."],
        ]),
      };
    },
  });

  /* ----- step 8: power grid ----- */

  STEPS.push({
    n: 8, title: "Power grid", button: "Build the power grid",
    line: "Rings, stripes, and row rails; hook up every macro's power pins.",
    intro:
      "<p>Every cell needs power and ground, delivered with little enough resistance that the voltage " +
      "stays up under load. The grid is built in layers, from thick to thin:</p>" +
      "<ul class=\"ff-checks\">" +
      "<li><strong>A ring</strong> around the core, in the margin, on metal5 and metal6: the trunk everything hangs from.</li>" +
      "<li><strong>Stripes</strong> across the core: vertical on metal4, horizontal on metal5, in power and ground pairs every 40 micrometers.</li>" +
      "<li><strong>Row rails</strong> on metal1, following every row (<code>-followpins</code>): the last step into each cell.</li>" +
      "<li><strong>Vias</strong> wherever two layers of the same net cross, stitching it all into one mesh.</li>" +
      "</ul>" +
      "<p>The memories own metal1 to metal4, so the metal4 stripes stop at their edges. The metal5 stripes " +
      "run straight over them, and each memory's own power pins connect up to those.</p>",
    command: function () { return pdnCommands().join("\n"); },
    commandNote:
      "Every command is from the " +
      "<a href=\"https://openroad.readthedocs.io/en/latest/main/src/pdn/README.html\">power grid documentation</a>; " +
      "the widths and pitches are this design's choices. The global connections tie every cell's power " +
      "and ground pins to the two nets before any metal is drawn.",
    run: function (M) {
      var P = M.pdn;
      var n4 = P.m4.VDD.length + P.m4.VSS.length, n5 = P.m5.VDD.length + P.m5.VSS.length;
      var log = pdnCommands().map(function (c) { return { k: "cmd", t: c }; });
      [
        { k: "out", t: "  power and ground pins connected on " + fmt(M.z.fg.cells + 4) + " instances" },
        { k: "out", t: "  ring: metal5 and metal6, width 2.0, " + PDN.ringOffset + " to " + P.ringOuter + " micrometers outside the core" },
        { k: "out", t: "  metal4 stripes: " + n4 + " (" + P.cuts + " cut where they meet a memory)" },
        { k: "out", t: "  metal5 stripes: " + n5 + ", crossing the memories" },
        { k: "out", t: "  metal1 rails: " + (M.z.rows + 1) + ", one per row boundary" },
        { k: "ok", t: "Power grid built and connected. No floating stripes." },
      ].forEach(function (l) { log.push(l); });
      var hookTxt = P.hooks.map(function (hk) { return hk.label + ": " + hk.stripes; }).join(", ");
      var minHook = P.hooks.reduce(function (mn, hk) { return Math.min(mn, hk.stripes); }, 99);
      return {
        log: log,
        figure: plan(M, { macros: true, pdn: true, aria: "The power ring, the metal4 and metal5 stripes, and the memories" }) +
          '<div class="ff3-legend"><span><i style="background:' + VDD_C + '"></i>power</span><span><i style="background:' + VSS_C +
          '"></i>ground</span><span>vertical: metal4, cut at the memories · horizontal: metal5, over everything · outer bands: the ring</span></div>',
        report: "<h3>Power grid report</h3>" + table([
          ["Ring", "metal5 and metal6, 2.0 wide, 1.0 apart, from " + PDN.ringOffset + " to " + P.ringOuter + " micrometers outside the core"],
          ["metal4 stripes", n4 + " (power and ground pairs every 40 micrometers), " + P.cuts + " cut at the memories"],
          ["metal5 stripes", n5 + ", running over the memories"],
          ["metal1 rails", (M.z.rows + 1) + " (every row boundary)"],
          ["metal5 stripes over each memory", hookTxt],
          ["metal4 tracks taken by power", Math.round(P.m4Share * 100) + "%"],
        ]) + checks([
          ["The ring fits the margin.",
           "The ring's outer edge is " + P.ringOuter + " micrometers from the core, inside the 20 micrometer margin chosen " +
           "in step 2, which leaves " + (SIZING.margin - P.ringOuter) + " micrometers for the pins and their wires. " +
           "This is the check that makes the step 2 margin a real decision."],
          ["Every memory is fed.",
           "Each memory has at least " + minHook + " metal5 stripes running over it for its power pins to connect to. " +
           "A memory with no stripe above it would be unpowered, and nothing in the netlist would warn you."],
          ["The grid costs routing.",
           "Power takes about " + Math.round(P.m4Share * 100) + "% of the metal4 tracks, and a similar share of metal5. " +
           "A denser grid lowers the voltage drop but steals tracks from signals: that is the trade."],
          ["Is it strong enough?",
           "That needs real currents, which only exist after placement. Voltage-drop analysis comes later " +
           "in the flow; the floorplan's job is a grid that can be strengthened without starting over."],
        ]),
      };
    },
  });

  /* ----- step 9: tap and endcap cells ----- */

  STEPS.push({
    n: 9, title: "Physical-only cells", button: "Insert the cells",
    line: "Well-tap cells in a regular pattern, endcap cells at every row end.",
    intro:
      "<p>Some cells have no logic at all. <strong>Well-tap cells</strong> tie the transistor wells to power " +
      "and ground, which prevents <em>latch-up</em> (a parasitic short that can destroy the chip); the " +
      "process rules require one within a set distance of every transistor. <strong>Endcap cells</strong> " +
      "close off the end of every row, protecting the last real cell from edge effects in manufacturing.</p>" +
      "<p>They go in now, before placement, so the placer treats them as fixed obstacles. A row stops " +
      "wherever a memory's halo begins, and every piece of row gets an endcap at each end.</p>",
    command: function () {
      return "tapcell -distance " + TAP.dist + " -tapcell_master TAPCELL_X1 -endcap_master ENDCAP_X1 -halo_width_x 10 -halo_width_y 10";
    },
    commandNote:
      "<code>-distance</code> sets the spacing of the tap checkerboard; the halo widths make the rows stop " +
      "10 micrometers from each memory, matching step 6 " +
      "(<a href=\"https://openroad.readthedocs.io/en/latest/main/src/tap/README.html\">tap cell documentation</a>). " +
      "The counts below follow the pattern described here, a tap every 20 micrometers offset by half in " +
      "alternate rows; the tool's exact arrangement differs in detail.",
    run: function (M) {
      var T = M.taps, z = M.z;
      var log = [
        { k: "cmd", t: "tapcell -distance " + TAP.dist + " -tapcell_master TAPCELL_X1 -endcap_master ENDCAP_X1 -halo_width_x 10 -halo_width_y 10" },
        { k: "out", t: "  rows: " + z.rows + (T.pieces === z.rows ? ", shortened where a memory's halo reaches them, none split" : ", split into " + fmt(T.pieces) + " pieces by the memories") },
        { k: "out", t: "  endcaps inserted: " + fmt(T.endcaps) },
        { k: "out", t: "  tap cells inserted: " + fmt(T.taps) },
        { k: "ok", t: "Physical-only cells inserted and fixed." },
      ];

      /* close-up at Memory C's top-right corner (bottom-left memory), die y up */
      var mC = M.ms.filter(function (m) { return m.id === "C"; })[0];
      var yuTop = z.coreH - mC.y;                 /* Memory C's top edge, y up */
      var wx0 = mC.x + mC.w - 30, wx1 = mC.x + mC.w + 50, wy0 = yuTop - 16, wy1 = yuTop + 26;
      var px = 7, ox = 40, oy = 16, W = (wx1 - wx0) * px, H = (wy1 - wy0) * px;
      function PX(x) { return ox + (x - wx0) * px; }
      function PY(y) { return oy + (wy1 - y) * px; }
      var o = ['<svg viewBox="0 0 ' + (W + ox + 20) + " " + (H + oy + 44) + '" class="ff3-svg ff3-zoom" role="img" aria-label="Close-up of rows ending at a memory halo, with endcap and tap cells">'];
      o.push('<rect class="ff3-mac" style="stroke:' + MEM_COLORS.C + '" x="' + PX(Math.max(wx0, mC.x)) + '" y="' + PY(yuTop) + '" width="' + (mC.x + mC.w - Math.max(wx0, mC.x)) * px + '" height="' + (yuTop - wy0) * px + '"/>');
      o.push('<rect class="ff3-halo" x="' + PX(Math.max(wx0, mC.x - HALO)) + '" y="' + PY(yuTop + HALO) + '" width="' + (mC.x + mC.w + HALO - Math.max(wx0, mC.x - HALO)) * px + '" height="' + (yuTop + HALO - wy0) * px + '"/>');
      o.push('<text class="ff3-maclabel" x="' + PX(mC.x + mC.w - 15) + '" y="' + PY(wy0 + 6) + '">Memory C</text>');
      var r0 = Math.floor(wy0 / ROW_H), r1 = Math.ceil(wy1 / ROW_H);
      for (var r = r0; r < r1; r++) {
        var y0 = r * ROW_H, y1 = y0 + ROW_H;
        if (y1 <= wy0 || y0 >= wy1) continue;
        var blocked = y1 > (yuTop - mC.h - HALO) && y0 < yuTop + HALO;
        var sx = blocked ? mC.x + mC.w + HALO : wx0;
        var ya = Math.max(y0, wy0), yb = Math.min(y1, wy1);
        o.push('<rect class="' + (r % 2 ? "ff3-row-fs" : "ff3-row-n") + '" x="' + PX(sx) + '" y="' + PY(yb) + '" width="' + (wx1 - sx) * px + '" height="' + (yb - ya) * px + '"/>');
        if (blocked) o.push('<rect fill="#7c3aed" x="' + PX(sx) + '" y="' + PY(yb) + '" width="' + TAP.endW * px + '" height="' + (yb - ya) * px + '"/>');
        /* taps in this row: this row's piece starts at sx (or the core's left edge), same rule as the count */
        var segStart = blocked ? sx : 0;
        for (var t = segStart + (r % 2 ? TAP.dist / 2 : 0) + TAP.endW; t < wx1; t += TAP.dist) {
          if (t >= wx0 && t + TAP.tapW <= wx1) o.push('<rect fill="#0d9488" x="' + PX(t) + '" y="' + PY(yb) + '" width="' + TAP.tapW * px + '" height="' + (yb - ya) * px + '"/>');
        }
      }
      o.push('<text class="ff3-cap" x="' + ox + '" y="' + (oy + H + 18) + '">an 80 × 42 micrometer window at Memory C\'s top-right corner</text>');
      o.push('<text class="ff3-cap" x="' + ox + '" y="' + (oy + H + 34) + '"><tspan fill="#7c3aed">■</tspan> endcap where a row stops at the halo   <tspan fill="#0d9488">■</tspan> tap cell, every 20 micrometers, offset in alternate rows</text>');
      o.push("</svg>");

      return {
        log: log,
        figure: o.join(""),
        report: "<h3>Physical-only cell report</h3>" + table([
          ["Row pieces", fmt(T.pieces) + (T.pieces === z.rows ? " (one per row: the corner memories shorten rows but never split one)" : " (" + z.rows + " rows, some split by a memory)")],
          ["Endcap cells", fmt(T.endcaps) + ", two per piece"],
          ["Tap cells", fmt(T.taps) + ", about one per 20 micrometers of row, checkerboarded"],
          ["Area they take", fmt(T.area) + " square micrometers (" + (100 * T.area / M.halo.free).toFixed(1) + "% of the space left for cells)"],
        ]) + checks([
          ["No transistor is far from a tap.",
           "With taps every 20 micrometers and alternate rows offset by half, no point in a row is more than " +
           "about 10 micrometers from a tap in its own row or the next. The real limit comes from the process " +
           "rules; the distance is set to stay well inside it."],
          ["Every row piece is closed.",
           fmt(T.pieces) + " pieces, " + fmt(T.endcaps) + " endcaps: exactly two each. A row that passes a memory is cut " +
           "into a piece in the channel and a piece in the open core, and both get closed off, which is why there " +
           "are about twice as many pieces as rows."],
          ["They cost almost nothing.",
           "About " + (100 * T.area / M.halo.free).toFixed(1) + "% of the cell area. They are inserted now, and fixed, so the " +
           "placer never has to make room for them later."],
        ]),
      };
    },
  });

  /* ----- step 10: analyze and iterate ----- */

  STEPS.push({
    n: 10, title: "Analyze and iterate", button: "Run the forecasts",
    line: "Flylines, congestion forecasts, early timing; move things and repeat.",
    intro:
      "<p>Before handing off, the engineer asks: <em>will this floorplan route, and is the wiring short?</em> " +
      "Nothing is placed yet, so the answers are forecasts. This step runs the free-play sandbox's two " +
      "congestion forecasts on this floorplan, and compares against the obvious alternative, the same " +
      "memories in the middle.</p>" +
      "<p>If a forecast shows a hot spot, this is where you loop back: move a memory, widen a channel, add " +
      "a partial blockage, and run again. Iterating here is cheap; iterating after routing is not.</p>",
    command: function () { return FORECAST_SCRIPT; },
    commandNote:
      "Production flows do the same with a quick global route and its overflow report. The forecasts " +
      "here are the sandbox's simplified versions, run on exactly this floorplan.",
    run: function (M, FC) {
      var g = FC.groute.metrics, r = FC.rudy.metrics, mg = FC.midGroute.metrics, mr = FC.midRudy.metrics;
      var log = cmdLines(FORECAST_SCRIPT).map(function (c) { return { k: "cmd", t: c }; });
      [
        { k: "out", t: "  RUDY (Rectangular Uniform wire DensitY): peak " + Math.round(r.peak * 100) + "% of supply, " + r.overPct.toFixed(1) + "% of bins over 100%" },
        { k: "out", t: "  trial global route: peak " + Math.round(g.peak * 100) + "% of supply, " + g.overPct.toFixed(1) + "% of bins over 100%" },
        { k: "out", t: "  estimated wirelength " + (g.hpwl / 1000).toFixed(1) + " millimeters" },
        { k: "ok", t: g.overPct === 0 ? "No bin over 100%. No change needed." : "Some bins over 100%: iterate." },
      ].forEach(function (l) { log.push(l); });
      function pct(v) { return Math.round(v * 100) + "%"; }
      var cmp = '<table class="ff-table"><tr><th></th><th>This floorplan (corners)</th><th>Memories in the middle</th></tr>' +
        "<tr><td>Trial-route peak</td><td>" + pct(g.peak) + "</td><td>" + pct(mg.peak) + "</td></tr>" +
        "<tr><td>Bins over 100%, trial route</td><td>" + g.overPct.toFixed(1) + "%</td><td>" + mg.overPct.toFixed(1) + "%</td></tr>" +
        "<tr><td>RUDY (Rectangular Uniform wire DensitY) peak</td><td>" + pct(r.peak) + "</td><td>" + pct(mr.peak) + "</td></tr>" +
        "<tr><td>Wirelength estimate</td><td>" + (g.hpwl / 1000).toFixed(1) + " millimeters</td><td>" + (mg.hpwl / 1000).toFixed(1) + " millimeters</td></tr></table>";
      return {
        log: log,
        figure: plan(M, { macros: true, halos: true, pins: true, heat: FC.groute, conns: true, aria: "The trial global route congestion forecast over the floorplan" }) +
          '<div class="ff3-legend"><span>heat: trial global route, demand ÷ supply, shown from 50% (green) to 130% (red)</span><span>thin lines: the connections being forecast</span></div>',
        report: "<h3>Forecast report</h3>" + cmp + checks([
          ["It routes, with margin.",
           "The trial global route peaks at " + pct(g.peak) + " of supply and no bin goes over 100%. The busiest " +
           "areas are around the hub, where every bus converges; that is expected, and it is below the line."],
          ["The alternative is worse where it matters.",
           "The same memories in the middle peak at " + pct(mg.peak) + " with " + mg.overPct.toFixed(1) + "% of bins " +
           "overflowing, for about the same wirelength. Floorplanning mostly buys routability, not length."],
          ["The two forecasts disagree, usefully.",
           "RUDY (Rectangular Uniform wire DensitY) spreads each wire over its bounding box and reads lower; the trial route commits " +
           "wires to paths and reads higher. Trust the trial route for go or no-go; use the fast one to compare many options."],
          ["Nothing to iterate.",
           "No hot spot means no blockage to add and no memory to move. The floorplan is ready for its final checks."],
        ]),
      };
    },
  });

  /* ----- step 11: check and hand off ----- */

  STEPS.push({
    n: 11, title: "Check and hand off", button: "Check and write out",
    line: "Legality and power checks, then write the floorplan out for placement.",
    intro:
      "<p>The last step proves the floorplan is legal and writes it out for the next stage. Everything " +
      "decided so far is saved in one file: the die and core, the rows and tracks, the pins, the fixed " +
      "memories, the halos, the power grid, and the physical-only cells. Placement starts from exactly " +
      "this.</p>",
    command: function () { return HANDOFF_SCRIPT; },
    commandNote:
      "<code>write_def</code> writes the text DEF (Design Exchange Format) file that any tool can read; " +
      "<code>write_db</code> saves OpenROAD's own binary database, which loads much faster " +
      "(<a href=\"https://openroad.readthedocs.io/en/latest/main/src/odb/README.html\">database documentation</a>).",
    run: function (M, FC) {
      var z = M.z, P = M.pdn;
      var ev = FC.groute;
      var inside = M.ms.every(function (m) { return m.x >= 0 && m.y >= 0 && m.x + m.w <= z.coreW + 1e-6 && m.y + m.h <= z.coreH + 1e-6; });
      var overlapFree = !ev.warnings.some(function (w) { return /overlap/.test(w); });
      var pinOk = !ev.warnings.some(function (w) { return /pins face/.test(w); });
      var fed = P.hooks.every(function (hk) { return hk.stripes >= 2; });
      var list = [
        ["Die and core", "core = design area ÷ 0.70, margin 20 micrometers", true],
        ["Rows and tracks", z.rows + " rows; 7 metal1 tracks per row; sites on the metal2 pitch", true],
        ["Pins", "82 of 82 placed inside their regions, clear of the corners", true],
        ["Macros inside the core", inside ? "all 4" : "no", inside],
        ["Macro overlaps", overlapFree ? "none" : "found", overlapFree],
        ["Macro pin access", pinOk ? "every pin edge faces open core" : "blocked", pinOk],
        ["Standard cells fit", Math.round(M.halo.density * 100) + "% of the free area", M.halo.density < 1],
        ["Power ring fits the margin", P.ringOuter + " of 20 micrometers", P.ringOuter < SIZING.margin],
        ["Every memory powered", fed ? "yes, at least 2 metal5 stripes each" : "no", fed],
        ["Tap and endcap cells", fmt(M.taps.taps) + " taps, " + fmt(M.taps.endcaps) + " endcaps", true],
        ["Routability forecast", "trial route peak " + Math.round(ev.metrics.peak * 100) + "%, no overflow", ev.metrics.overPct === 0],
      ];
      var allOk = list.every(function (c) { return c[2]; });
      var script = cmdLines(HANDOFF_SCRIPT);
      var log = [{ k: "cmd", t: script[0] }];
      list.forEach(function (c) { log.push({ k: "out", t: "  " + (c[2] ? "pass" : "FAIL") + "  " + c[0] + ": " + c[1] }); });
      script.slice(1).forEach(function (c) { log.push({ k: "cmd", t: c }); });
      log.push({ k: allOk ? "ok" : "out", t: allOk ? "Floorplan complete and written out. Ready for placement." : "Checks failed: fix before handing off." });

      /* a real DEF excerpt with this design's numbers (database units: 1000 per micrometer) */
      function du(v) { return Math.round(v * 1000); }
      var mg = SIZING.margin;
      var def = [
        "VERSION 5.8 ;",
        "DESIGN tile4m ;",
        "UNITS DISTANCE MICRONS 1000 ;",
        "DIEAREA ( 0 0 ) ( " + du(z.dieW) + " " + du(z.dieH) + " ) ;",
        "",
        "ROW ROW_0 core_site " + du(mg) + " " + du(mg) + " N DO " + z.sites + " BY 1 STEP 190 0 ;",
        "ROW ROW_1 core_site " + du(mg) + " " + du(mg + ROW_H) + " FS DO " + z.sites + " BY 1 STEP 190 0 ;",
        "...   (" + (z.rows - 2) + " more rows, alternating N and FS)",
        "",
        "TRACKS Y 100 DO " + Math.floor(z.dieH / 0.2) + " STEP 200 LAYER metal1 ;",
        "TRACKS X 95 DO " + Math.floor(z.dieW / 0.19) + " STEP 190 LAYER metal2 ;",
        "...   (metal3 to metal6)",
        "",
        "COMPONENTS " + (4 + M.taps.taps + M.taps.endcaps + Math.round(z.fg.cells)) + " ;",
      ];
      M.ms.forEach(function (m) {
        def.push("- " + m.inst + " " + m.master + " + FIXED ( " + du(m.X) + " " + du(m.Y) + " ) " + m.defOrient + " ;");
      });
      def.push("...   (tap and endcap cells FIXED; standard cells UNPLACED until placement)");
      def.push("END COMPONENTS");
      def.push("");
      def.push("PINS 82 ;");
      def.push("- in_data[0] + NET in_data[0] + DIRECTION INPUT + USE SIGNAL");
      def.push("  + LAYER metal3 ( -100 0 ) ( 100 400 ) + PLACED ( 0 " + du(M.pins[0].lo) + " ) E ;");
      def.push("...   (81 more pins)");
      def.push("END PINS");
      def.push("");
      def.push("SPECIALNETS 2 ;");
      def.push("- VDD  ( * VDD ) + USE POWER ;   ...   (ring, stripes, rails)");
      def.push("- VSS  ( * VSS ) + USE GROUND ;  ...");
      def.push("END SPECIALNETS");
      def.push("END DESIGN");

      var checkRows = list.map(function (c) {
        return "<tr><th>" + c[0] + '</th><td><span class="' + (c[2] ? "ff-good" : "ff3-bad") + '">' + (c[2] ? "pass" : "fail") + "</span> · " + c[1] + "</td></tr>";
      }).join("");
      return {
        log: log,
        figure: plan(M, { macros: true, halos: true, pins: true, pdn: true, aria: "The finished floorplan of tile4m" }) +
          '<div class="ff3-legend"><span>the finished floorplan: die, ring and stripes, pins, and the four memories with their halos</span></div>',
        report: '<h3>Final checks</h3><table class="ff-table ff-summary">' + checkRows + "</table>" +
          '<h3>The hand-off file (excerpt)</h3><pre class="ffd-code">' + esc(def.join("\n")) + "</pre>" +
          '<div class="ffd-note">Excerpt with this design\'s real numbers, in DEF (Design Exchange Format) syntax. Coordinates are in database units, 1,000 per micrometer.</div>' +
          checks([
            ["Every check passes.",
             "Legal geometry, powered memories, fitting cells, a clean forecast. A single failure here means " +
             "going back, because every later stage assumes the floorplan is sound."],
            ["The memories are FIXED; the cells are not placed.",
             "In the file the memories, taps, and endcaps are FIXED, and the " + fmt(z.fg.cells) + " standard cells have no " +
             "position yet. Giving them one is the whole job of the next stage, placement."],
            ["What comes next.",
             "Placement spreads the cells into the free core, pulled together by their connections and held " +
             "apart by density: the Analytical Placement sandbox (coming soon) is that stage."],
          ]),
      };
    },
  });

  /* ----- hand the steps to the shared flow engine -----
     The model and the forecasts are built once, on first use, and every
     step reads them; the engine itself calls run(), command() and
     reference() with no arguments. */

  var _M = null, _FC = null;
  function theModel() { return _M || (_M = model()); }
  function theForecasts() { return _FC || (_FC = forecasts()); }

  STEPS.forEach(function (st) {
    ["command", "commandNote", "reference", "intro"].forEach(function (k) {
      var f = st[k];
      if (typeof f === "function") st[k] = function () { return f(theModel()); };
    });
    var r = st.run;
    st.run = function () { return r(theModel(), theForecasts()); };
  });

  var STAGE = {
    key: "floorplan",
    steps: STEPS,
    finishedTitle: "Floorplan complete.",
    finishedNote: "Every step is done and the floorplan is written out. Next in the real flow is " +
      'placement: <a href="/explore/examples/placement">the placement example</a> picks up this exact file.',
    epilogue:
      "<h3>How this differs from a production floorplan</h3>" +
      "<p>The decisions are the real ones, and they are made in this order for the reasons given. " +
      "Four things a production floorplan does that this one does not:</p>" +
      '<ul class="ff-checks">' +
      "<li><strong>It is not one block.</strong> A chip is a hierarchy of blocks, and the floorplan " +
      "that matters is the top-level one: where each block goes, how big it is allowed to be, and " +
      "what crosses between them. A block like this one is handed a rectangle and a budget by that " +
      "exercise, rather than choosing its own.</li>" +
      "<li><strong>The macros are placed with far more than four to think about.</strong> A real " +
      "block can have dozens, of several shapes, with their own access requirements and their own " +
      "power needs. That is why automatic macro placers exist, and why their results are still " +
      "argued with by hand.</li>" +
      "<li><strong>The power grid is verified, not just drawn.</strong> Here it is a pitch and a " +
      "width. In production it is sized against a current budget and checked with an analysis that " +
      "says how far the supply droops at the worst instant, which routinely sends the grid back to " +
      "be redrawn.</li>" +
      "<li><strong>Pins are negotiated, not assigned.</strong> A block's pin positions have to suit " +
      "the blocks it talks to, so they are agreed at the top level and handed down. Choosing them " +
      "freely, as here, is a luxury only a standalone block has.</li></ul>",
    footNote: 'Try other choices in the <a href="/explore/algorithms/floorplan-sandbox">free-play sandbox</a>.',
  };
  /* later stages load this file for its model, so only claim the page
     when this is the page's stage */
  if (typeof window !== "undefined" && window.FLOW_PAGE_STAGE === STAGE.key) window.FLOW_STAGE = STAGE;

  return {
    DESIGN: DESIGN, SIZING: SIZING, SITE_W: SITE_W, ROW_H: ROW_H, LAYERS: LAYERS, PDN: PDN, TAP: TAP,
    CHANNEL: CHANNEL, HALO: HALO, MEM_COLORS: MEM_COLORS, INSTS: INSTS, MASTERS: MASTERS,
    techLef: techLef, wireRC: wireRC, heatColor: heatColor, LAYER_BY: LAYER_BY, table: table, checks: checks, plan: plan, esc: esc,
    fmt: fmt, f1: f1, f2: f2,
    theModel: theModel, theForecasts: theForecasts,
    STAGE: STAGE,
    figures: figures, sizing: sizing, model: model, forecasts: forecasts, plan: plan,
    STEPS: STEPS,
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = FloorplanSteps;
