/* The placement worked example: the same design, tile4m, picked up from
   the floorplan the previous example wrote out, and given a legal
   position for every standard cell.

   The model is deliberately simple but self-consistent. Cells belong to
   five groups (a controller per memory, plus the hub); global placement
   spreads each group as a blob around the point its connections pull it
   to; repair adds buffers on the long wires; legalization spills the
   overfull bins into their neighbours, which is where the displacement
   comes from. Geometry, macros, halos and free area all come from the
   floorplan model, so the two examples cannot disagree. */

var PlacementSteps = (function () {
  "use strict";

  var FS = FloorplanSteps;
  var fmt = FS.fmt, f1 = FS.f1, f2 = FS.f2, esc = FS.esc;
  var table = FS.table, checks = FS.checks, plan = FS.plan;
  var ROW_H = FS.ROW_H, SITE_W = FS.SITE_W, HALO = FS.HALO;

  /* the one option per knob, as an engineer would start */
  var OPT = {
    density: 0.80,          /* global_placement -density */
    padGlobal: 2,           /* -pad_left / -pad_right, in sites */
    padDetail: 1,           /* set_placement_padding before legalizing */
    fanoutLimit: 8,         /* load pins one gate may drive, set by the design's constraints */
    bufDelayPs: 10,         /* what one buffer costs, picoseconds */
    bufArea: 2.24,          /* area of the buffer it inserts, square micrometers */
    signalLayer: "metal3",
    clockLayer: "metal5",
  };

  /* how the 130,000 square micrometers of logic divides up */
  var SHARE = { A: 0.15, B: 0.15, C: 0.15, D: 0.15, hub: 0.40 };

  /* Where splitting a wire starts to pay. One wire of length L has a
     delay of about half its resistance times its capacitance, and both
     grow with L, so the delay grows with L squared. Cut it in two and
     each half costs a quarter, so the pair costs half, but the buffer
     in the middle costs its own delay. Splitting wins once the delay
     saved beats the buffer, and that crossing is what the tool means by
     a maximum wire length. */
  function wireDelayPs(w, len) { return 0.5 * (w.r * len) * (w.c * len) / 1000; }

  function splitDelayPs(w, len) { return 2 * wireDelayPs(w, len / 2) + OPT.bufDelayPs; }

  function breakEvenLength(w) {
    return Math.sqrt(OPT.bufDelayPs / (0.25 * w.r * w.c / 1000));
  }

  var GP_CMD = "global_placement -density " + OPT.density.toFixed(2) +
    " -pad_left " + OPT.padGlobal + " -pad_right " + OPT.padGlobal +
    " -timing_driven -routability_driven";

  /* How tightly each group clusters around its anchor. Larger means a
     tighter blob, so more bins come out of global placement overfull and
     legalization has more to spill. */
  var SPREAD_TIGHTNESS = 0.75;

  /* Share of nets driving more load pins than one gate should: the
     order a block this size sees. The buses the sandbox tracks are
     counted exactly; these stand for the local nets it does not model. */
  var HIGH_FANOUT_SHARE = 0.06;

  var BIN = 20;
  var _M = null;

  function base() { return FS.theModel(); }

  /* ----- the bin grid over the core, and what is placeable in it ----- */

  function grid() {
    var z = base().z, ms = base().ms;
    var nx = Math.max(1, Math.round(z.coreW / BIN)), ny = Math.max(1, Math.round(z.coreH / BIN));
    var bw = z.coreW / nx, bh = z.coreH / ny;
    var free = new Float64Array(nx * ny);
    for (var by = 0; by < ny; by++) {
      for (var bx = 0; bx < nx; bx++) {
        var open = 0;
        for (var sy = 0; sy < 4; sy++) {
          for (var sx = 0; sx < 4; sx++) {
            var px = (bx + (sx + 0.5) / 4) * bw, py = (by + (sy + 0.5) / 4) * bh;
            var blocked = false;
            for (var k = 0; k < ms.length; k++) {
              var m = ms[k];
              if (px > m.x - HALO && px < m.x + m.w + HALO && py > m.y - HALO && py < m.y + m.h + HALO) { blocked = true; break; }
            }
            if (!blocked) open++;
          }
        }
        free[by * nx + bx] = open / 16;
      }
    }
    return { nx: nx, ny: ny, bw: bw, bh: bh, w: z.coreW, h: z.coreH, free: free, binArea: bw * bh };
  }

  /* where each group of logic wants to sit: the sandbox's spring model,
     scaled from its own die into this core */
  function anchors(g) {
    var ev = FS.theForecasts().groute;
    var sx = g.w / ev.die.w, sy = g.h / ev.die.h;
    var out = {};
    Object.keys(ev.clusters).forEach(function (c) {
      out[c] = { x: ev.clusters[c].x * sx, y: ev.clusters[c].y * sy };
    });
    return out;
  }

  /* Global placement, modelled the way a density-driven placer behaves:
     connections pull each group toward its anchor, and the density
     target caps how much any one bin may hold, so the excess spreads
     outward. That is water filling against a per-bin cap. */
  /* The placer's iterations, as frames. A real analytic placer starts
     from a wirelength-only solution, where every group is piled on the
     point its connections pull it to, then raises the density penalty
     step by step until no bin is over the target. Raising the penalty
     is modelled here as lowering the cap the fill obeys, from far above
     the target down onto it.

     Two numbers move as it runs, in opposite directions: overflow (how
     much cell area sits above the target) falls, and wirelength rises,
     because spreading cells apart lengthens the wires between them. The
     real placer stops once overflow drops below -overflow, default 0.10. */
  var FRAMES = 12;

  /* one fill, obeying a given per-bin density cap */
  function fillTo(g, cellArea, capDensity, sigmaScale) {
    var pts = anchors(g), n = g.nx * g.ny;
    var w = new Float64Array(n), cap = new Float64Array(n), area = new Float64Array(n);
    Object.keys(SHARE).forEach(function (c) {
      var p = pts[c];
      if (!p) return;
      var sigma = (sigmaScale || 1) * Math.sqrt(cellArea * SHARE[c] / Math.PI) / SPREAD_TIGHTNESS;
      for (var b = 0; b < n; b++) {
        if (g.free[b] < 0.05) continue;
        var bx = (b % g.nx + 0.5) * g.bw, by = ((b / g.nx | 0) + 0.5) * g.bh;
        var d2 = (bx - p.x) * (bx - p.x) + (by - p.y) * (by - p.y);
        w[b] += SHARE[c] * Math.exp(-d2 / (2 * sigma * sigma));
      }
    });
    for (var b2 = 0; b2 < n; b2++) cap[b2] = capDensity * g.binArea * g.free[b2];
    var left = cellArea;
    for (var pass = 0; pass < 60 && left > 1; pass++) {
      var wsum = 0;
      for (var b3 = 0; b3 < n; b3++) if (area[b3] < cap[b3] - 1e-9) wsum += w[b3];
      if (wsum <= 0) break;
      var placed = 0;
      for (var b4 = 0; b4 < n; b4++) {
        if (area[b4] >= cap[b4] - 1e-9 || w[b4] <= 0) continue;
        var give = Math.min(left * w[b4] / wsum, cap[b4] - area[b4]);
        area[b4] += give;
        placed += give;
      }
      left -= placed;
      if (placed < 1) break;
    }
    return area;
  }

  /* how far, on average, cell area sits from the nearest anchor */
  function meanRadius(g, area) {
    var pts = anchors(g), keys = Object.keys(pts), sum = 0, tot = 0;
    for (var b = 0; b < area.length; b++) {
      if (area[b] <= 0) continue;
      var bx = (b % g.nx + 0.5) * g.bw, by = ((b / g.nx | 0) + 0.5) * g.bh;
      var best = Infinity;
      for (var i = 0; i < keys.length; i++) {
        var p = pts[keys[i]];
        var d = Math.sqrt((bx - p.x) * (bx - p.x) + (by - p.y) * (by - p.y));
        if (d < best) best = d;
      }
      sum += best * area[b];
      tot += area[b];
    }
    return tot ? sum / tot : 0;
  }

  /* For each group, how far its cells reach in this frame: the mean
     distance of its area from its anchor, turned into the radius of an
     evenly filled disc (mean radius of a disc is two thirds of it). */
  function clusterRadii(g, area) {
    var pts = anchors(g), keys = Object.keys(pts);
    var sum = {}, tot = {};
    keys.forEach(function (c) { sum[c] = 0; tot[c] = 0; });
    for (var b = 0; b < area.length; b++) {
      if (area[b] <= 0) continue;
      var bx = (b % g.nx + 0.5) * g.bw, by = ((b / g.nx | 0) + 0.5) * g.bh;
      var best = null, bd = Infinity;
      for (var i = 0; i < keys.length; i++) {
        var p = pts[keys[i]];
        var d = Math.sqrt((bx - p.x) * (bx - p.x) + (by - p.y) * (by - p.y));
        if (d < bd) { bd = d; best = keys[i]; }
      }
      sum[best] += bd * area[b];
      tot[best] += area[b];
    }
    var out = {};
    keys.forEach(function (c) { out[c] = tot[c] ? 1.5 * sum[c] / tot[c] : 0; });
    return out;
  }

  /* A sample of individual cells to draw on the map. Each keeps its
     group and its place within that group (an area-uniform quantile and
     an angle) for the whole run, so the reader follows the same cells
     spreading rather than a new random scatter each frame. */
  var SAMPLE_CELLS = 900;

  function sampleCells() {
    function rnd(seed) { var x = Math.sin(seed * 12.9898) * 43758.5453; return x - Math.floor(x); }
    var keys = Object.keys(SHARE), out = [], seed = 7;
    keys.forEach(function (c) {
      var n = Math.round(SAMPLE_CELLS * SHARE[c]);
      for (var i = 0; i < n; i++) {
        out.push({ c: c, q: Math.sqrt(rnd(seed++)), th: rnd(seed++) * Math.PI * 2 });
      }
    });
    return out;
  }

  /* where one sample cell sits in a given frame, nudged out of a macro
     or its halo if the spread would drop it on one */
  function cellAt(g, cell, frame, pts, ms) {
    var p = pts[cell.c], R = frame.radii[cell.c] || 0;
    var x = p.x + R * cell.q * Math.cos(cell.th);
    var y = p.y + R * cell.q * Math.sin(cell.th);
    /* a cell cannot sit on a macro or in its halo: push it out over the
       nearest edge of whatever it landed on (halos can overlap, so a
       few rounds) */
    for (var t = 0; t < 4; t++) {
      var moved = false;
      for (var k = 0; k < ms.length; k++) {
        var m = ms[k];
        var x0 = m.x - HALO, x1 = m.x + m.w + HALO, y0 = m.y - HALO, y1 = m.y + m.h + HALO;
        if (x <= x0 || x >= x1 || y <= y0 || y >= y1) continue;
        var dl = x - x0, dr = x1 - x, dt = y - y0, db = y1 - y;
        var least = Math.min(dl, dr, dt, db);
        if (least === dl) x = x0 - 1.5;
        else if (least === dr) x = x1 + 1.5;
        else if (least === dt) y = y0 - 1.5;
        else y = y1 + 1.5;
        moved = true;
      }
      if (!moved) break;
    }
    return {
      x: Math.max(1, Math.min(g.w - 4, x)),
      y: Math.max(1, Math.min(g.h - 3, y)),
    };
  }

  function frames(cellArea) {
    var g = grid(), out = [], target = OPT.density;
    for (var k = 0; k < FRAMES; k++) {
      var t = k / (FRAMES - 1);
      /* early on the wirelength term wins: each group is nearly a point,
         piled far past full. As the density penalty grows the cap comes
         down and the piles spread into the room they are allowed. */
      var mult = 1 + 14 * Math.pow(1 - t, 2.2);
      var sigmaScale = 0.22 + 0.78 * Math.pow(t, 0.8);
      var f = fillTo(g, cellArea, target * mult, sigmaScale);
      var over = 0;
      for (var b = 0; b < f.length; b++) {
        var room = g.binArea * g.free[b];
        if (room <= 1) continue;
        if (f[b] > target * room) over += f[b] - target * room;
      }
      out.push({ area: f, overflow: over / Math.max(1, cellArea), spread: meanRadius(g, f),
                 radii: clusterRadii(g, f) });
    }
    var r0 = out[0].spread, r1 = out[out.length - 1].spread;
    out.forEach(function (fr) {
      fr.hpwlFactor = 0.58 + 0.42 * (r1 > r0 ? (fr.spread - r0) / (r1 - r0) : 1);
    });
    return out;
  }

  function waterfill(g, cellArea) {
    var area = fillTo(g, cellArea, OPT.density);
    var placed = 0;
    for (var b = 0; b < area.length; b++) placed += area[b];
    return { area: area, unplaced: Math.max(0, cellArea - placed) };
  }

  /* repair adds its buffers where the cells already are */
  function densityOf(g, area) {
    var d = new Float64Array(area.length);
    for (var b = 0; b < area.length; b++) {
      var room = g.binArea * g.free[b];
      d[b] = room > 1 ? area[b] / room : 0;
    }
    return d;
  }

  /* per-bin density, and the three numbers worth reporting from it */
  function stats(g, area) {
    var d = densityOf(g, area), peak = 0, over = 0, used = 0, room = 0;
    for (var b = 0; b < d.length; b++) {
      if (g.free[b] < 0.05) continue;
      if (d[b] > peak) peak = d[b];
      if (d[b] > OPT.density + 1e-6) over++;
      used += area[b];
      room += g.binArea * g.free[b];
    }
    return { density: d, peak: peak, over: over, average: used / room };
  }

  function scaleArea(area, factor) {
    var out = new Float64Array(area.length);
    for (var b = 0; b < area.length; b++) out[b] = area[b] * factor;
    return out;
  }

  /* Legalization does not move much area between bins; what it does is
     snap every cell onto a row and whole sites, shuffling neighbours
     along to make room. The displacement that costs is modelled per bin
     from how full the bin is: a snap is always half a row, and crowding
     adds to it steeply. */
  function displacement(g, area) {
    var d = densityOf(g, area);
    var wsum = 0, dsum = 0, worst = 0;
    for (var b = 0; b < d.length; b++) {
      if (g.free[b] < 0.05 || area[b] <= 0) continue;
      var crowd = Math.max(0, d[b] - 0.6);
      var disp = 0.5 * ROW_H + 40 * crowd * crowd;
      dsum += disp * area[b];
      wsum += area[b];
      if (disp > worst) worst = disp;
    }
    return { average: wsum ? dsum / wsum : 0, worst: worst };
  }

  /* repair_design: every wire longer than -max_wire_length gets buffers,
     one per bit, spaced a little under that length apart */
  function repair(cellArea) {
    var ev = FS.theForecasts().groute, chunkBits = 8;
    var w = FS.wireRC(OPT.signalLayer), limit = breakEvenLength(w);
    var longest = 0, longBits = 0, splits = 0;
    ev.conns.forEach(function (c) {
      var len = Math.abs(c.a.x - c.b.x) + Math.abs(c.a.y - c.b.y);
      if (len > longest) longest = len;
      var n = Math.max(0, Math.ceil(len / limit) - 1);
      if (n > 0) { longBits += chunkBits; splits += n * chunkBits; }
    });
    /* In a block this size almost nothing is long enough to split. What
       repair_design actually finds here is gates driving more load than
       they can hold a slew on, which it fixes with buffer trees and by
       resizing. Both counts are modelled from the netlist size. */
    var highFanout = Math.round(base().z.fg.nets * HIGH_FANOUT_SHARE);
    var fanoutBuffers = Math.round(highFanout * 1.4);
    var buffers = fanoutBuffers + splits;
    var resized = Math.round(base().z.fg.cells * 0.03);
    var added = buffers * OPT.bufArea + resized * 0.35;
    return {
      buffers: buffers, fanoutBuffers: fanoutBuffers, splits: splits,
      longBits: longBits, longest: longest, limit: limit, highFanout: highFanout,
      resized: resized, added: added, cellArea: cellArea + added,
    };
  }

  function countAtCap(M) {
    var n = 0;
    for (var b = 0; b < M.gp.length; b++) {
      var cap = OPT.density * M.g.binArea * M.g.free[b];
      if (cap > 1 && M.gp[b] > cap - 1e-6) n++;
    }
    return n;
  }

  function model() {
    if (_M) return _M;
    var g = grid();
    var z = base().z;
    var cell0 = z.fg.cellArea;
    var wf = waterfill(g, cell0);
    var gp = wf.area;
    var gpStat = stats(g, gp);
    var rep = repair(cell0);
    var gpr = scaleArea(gp, rep.cellArea / cell0);
    var gprStat = stats(g, gpr);
    var disp = displacement(g, gpr);
    var legStat = gprStat;                       /* bin densities barely move; cells do */
    var freeArea = 0;
    for (var b = 0; b < g.free.length; b++) freeArea += g.binArea * g.free[b];
    _M = {
      g: g, z: z, cell0: cell0, gp: gp, gpStat: gpStat, rep: rep, frames: frames(cell0),
      gpr: gpr, gprStat: gprStat, disp: disp, legStat: legStat, unplaced: wf.unplaced, cells: sampleCells(), zoom: zoomCells(), tile: tileCells(),
      freeArea: freeArea,
      rows: z.rows, sites: z.sites,
      hpwl: FS.theForecasts().groute.metrics.hpwl,
    };
    return _M;
  }

  /* ----- drawing ----- */

  /* the core with a density map over it, drawn through the floorplan
     example's plan() so both examples look like the same design */
  function densityFigure(area, title) {
    var M = model(), g = M.g;
    var d = densityOf(g, area);
    var ratio = new Float64Array(d.length);
    /* plan() paints from half-full to a third over; density reads the same way */
    for (var b = 0; b < d.length; b++) ratio[b] = g.free[b] < 0.05 ? 0 : d[b];
    var heat = {
      die: { w: g.w, h: g.h, nx: g.nx, ny: g.ny, bw: g.bw, bh: g.bh },
      ratio: ratio, conns: [],
    };
    return plan(base(), { macros: true, halos: true, pins: true, heat: heat, aria: title }) +
      '<div class="ff3-legend"><span>cell density per 20 micrometer bin: green about half full, amber near the target, red over it</span></div>';
  }

  /* The sample cells as drawn markup, positioned for one frame. The
     engine hands this to plan(), which places it above the macros. */
  function cellLayer(M, k) {
    var g = M.g, pts = anchors(g), ms = base().ms, cells = M.cells;
    var out = ['<g id="gp-cells">'];
    cells.forEach(function (c, i) {
      var p = cellAt(g, c, M.frames[k], pts, ms);
      out.push('<rect class="gp-cell gp-cell-' + c.c + '" data-cell="' + i +
               '" x="' + p.x.toFixed(1) + '" y="' + p.y.toFixed(1) + '" width="3.4" height="1.9"/>');
    });
    out.push("</g>");
    return { core: out.join(""), count: cells.length };
  }

  /* Crosshair and readout on the break-even chart. */
  function wireChartHover(M) {
    var root = document.getElementById("flow-rep-4") || document;
    var svg = root.querySelector(".pl-chart[aria-label^='Wire delay']") ||
              document.querySelector("[data-work='4'] .pl-chart");
    var hit = document.getElementById("pl-hit");
    var cross = document.getElementById("pl-cross");
    var out = document.getElementById("pl-readout");
    if (!svg || !hit || !cross || !out) return;
    var g = breakEvenChart(M).geom, w = FS.wireRC(OPT.signalLayer);
    var line = cross.querySelector("line");
    var dots = cross.querySelectorAll("circle");

    function py(d) { return g.mt + (1 - Math.min(d, g.maxD) / g.maxD) * (g.H - g.mt - g.mb); }

    hit.addEventListener("mousemove", function (ev) {
      var box = svg.getBoundingClientRect();
      var xUser = (ev.clientX - box.left) / box.width * g.W;
      var L = Math.max(0, Math.min(g.maxL, (xUser - g.ml) / (g.W - g.ml - g.mr) * g.maxL));
      var x = g.ml + (L / g.maxL) * (g.W - g.ml - g.mr);
      var one = wireDelayPs(w, L), split = splitDelayPs(w, L);
      cross.style.display = "";
      line.setAttribute("x1", x); line.setAttribute("x2", x);
      dots[0].setAttribute("cx", x); dots[0].setAttribute("cy", py(one));
      dots[1].setAttribute("cx", x); dots[1].setAttribute("cy", py(split));
      out.innerHTML = "at <b>" + Math.round(L) + "</b> micrometers: one wire <b>" + one.toFixed(1) +
        "</b> picoseconds, split by a buffer <b>" + split.toFixed(1) + "</b> · " +
        (one > split ? "splitting wins" : "leave it as one wire");
    });
    hit.addEventListener("mouseleave", function () {
      cross.style.display = "none";
      out.textContent = "Hover the chart to read both delays at a length.";
    });
  }

  /* Recolour the density map frame by frame, so the reader watches the
     design spread instead of seeing only where it ended up. */
  function animate(M) {
    var root = document.getElementById("flow-fig-3");
    if (!root) return;
    var bins = root.querySelectorAll(".gp-bin");
    if (!bins.length) return;
    var iterEl = document.getElementById("gp-iter");
    var overEl = document.getElementById("gp-over");
    var wlEl = document.getElementById("gp-wl");
    var replay = document.getElementById("gp-replay");
    var g = M.g, fr = M.frames, timer = null;

    var cellRects = root.querySelectorAll(".gp-cell");
    var pts = anchors(g), ms = base().ms;

    function paint(k) {
      var d = densityOf(g, fr[k].area);
      bins.forEach(function (rect) {
        var b = +rect.getAttribute("data-bin");
        rect.setAttribute("fill", FS.heatColor(d[b]));
      });
      cellRects.forEach(function (rect) {
        var c = M.cells[+rect.getAttribute("data-cell")];
        var p = cellAt(g, c, fr[k], pts, ms);
        rect.setAttribute("x", p.x.toFixed(1));
        rect.setAttribute("y", p.y.toFixed(1));
      });
      if (iterEl) iterEl.textContent = String(k * 20);
      if (overEl) overEl.textContent = fr[k].overflow.toFixed(3);
      if (wlEl) wlEl.textContent = ((M.hpwl * fr[k].hpwlFactor) / 1000).toFixed(1);
    }

    function play() {
      if (timer) clearInterval(timer);
      var k = 0;
      paint(0);
      timer = setInterval(function () {
        k += 1;
        if (k >= fr.length) { clearInterval(timer); timer = null; return; }
        paint(k);
      }, 260);
    }

    if (replay && !replay.dataset.wired) {
      replay.dataset.wired = "1";
      replay.addEventListener("click", play);
    }
    play();
  }

  /* Step 4's result: the same placement, with the cells repair added
     drawn on top of the ones that were already there. The existing
     cells go neutral so the new ones are unmistakable. */
  function repairFigure(M) {
    var g = M.g, pts = anchors(g), ms = base().ms;
    var lastFrame = M.frames[M.frames.length - 1];
    var out = ['<g id="gp-cells">'];
    M.cells.forEach(function (c) {
      var p = cellAt(g, c, lastFrame, pts, ms);
      out.push('<rect class="gp-cell gp-cell-base" x="' + p.x.toFixed(1) + '" y="' + p.y.toFixed(1) +
               '" width="3.4" height="1.9"/>');
    });
    /* one drawn buffer per the same number of real cells each dot stands for */
    var per = M.z.fg.cells / M.cells.length;
    var nBuf = Math.max(1, Math.round(M.rep.buffers / per));
    function rnd(seed) { var x = Math.sin(seed * 78.233) * 27183.1234; return x - Math.floor(x); }
    var keys = Object.keys(SHARE), seed = 3;
    for (var i = 0; i < nBuf; i++) {
      /* buffers land where the logic is, so pick a group by its share */
      var r = rnd(seed++), acc = 0, pick = keys[0];
      for (var k = 0; k < keys.length; k++) { acc += SHARE[keys[k]]; if (r <= acc) { pick = keys[k]; break; } }
      var p2 = cellAt(g, { c: pick, q: Math.sqrt(rnd(seed++)), th: rnd(seed++) * Math.PI * 2 }, lastFrame, pts, ms);
      out.push('<rect class="gp-cell gp-cell-buf" x="' + p2.x.toFixed(1) + '" y="' + p2.y.toFixed(1) +
               '" width="3.8" height="2.3"/>');
    }
    out.push("</g>");

    var heat = {
      die: { w: g.w, h: g.h, nx: g.nx, ny: g.ny, bw: g.bw, bh: g.bh },
      ratio: densityOf(g, M.gpr), conns: [],
    };
    return plan(base(), {
      macros: true, halos: true, pins: true, heat: heat, cells: { core: out.join("") },
      aria: "The placement after repair, with the buffers it inserted marked",
    }) +
      '<div class="ff3-legend">' +
      '<span><i class="pl-sw pl-sw-base"></i>cells already placed</span>' +
      '<span><i class="pl-sw pl-sw-buf"></i>' + fmt(M.rep.buffers) + " buffers repair inserted (" + nBuf + " drawn, one per " +
      Math.round(per) + " cells)</span>" +
      "<span>density underneath, now " + Math.round(M.gprStat.average * 100) + "% on average</span></div>";
  }

  /* ----- step 6: the reports, in the shape OpenROAD prints them -----
     The layouts here are copied from a real OpenROAD-flow-scripts run
     (the section banners, the "Design area ... % utilization." line,
     the "tns max" style one-liners, and the column layout of
     report_checks); the numbers are this design's. */

  function bannerBlock(title, body) {
    return "==========================================================================\n" +
      "detailed place " + title + "\n" +
      "--------------------------------------------------------------------------\n" + body;
  }

  /* One timing path, built so the arrival column actually adds up and
     the path is as deep as a critical path on this clock would be: a
     couple of dozen stages that between them use most of the period. */
  function timingPath(M) {
    var period = FS.DESIGN.clockPeriodNs, setup = 0.07;
    var CELLS = ["NAND2_X1", "AOI21_X2", "NAND3_X2", "INV_X2", "OAI21_X1", "NAND2_X2", "AOI22_X1", "BUF_X2"];
    function rnd(seed) { var x = Math.sin(seed * 33.7) * 8123.77; return x - Math.floor(x); }

    var rows = [], t = 0, seed = 5;
    function push(fan, cap, slew, d, edge, desc) {
      t += d;
      rows.push({ fan: fan, cap: cap, slew: slew, d: d, time: t, edge: edge, desc: desc });
    }
    function net(name) { rows.push({ net: name }); }

    push("", "", "0.00", 0, "", "clock clk (rise edge)");
    rows.push({ fan: "", cap: "", slew: "", d: 0, time: t, edge: "", desc: "clock network delay (ideal)" });
    push("", "", "0.00", 0, "^", "ctrl_a/state_reg[3]/CK (DFFR_X1)");
    push("4", "6.42", "0.05", 0.11, "v", "ctrl_a/state_reg[3]/Q (DFFR_X1)");

    /* the logic between the two flip-flops */
    var stages = 17, up = false;
    for (var i = 0; i < stages; i++) {
      var cell = CELLS[i % CELLS.length];
      var inst = (i < 6 ? "ctrl_a/_" : "hub/_") + (310 + i * 37) + "_";
      var wire = 0.01 + Math.round(rnd(seed++) * 2) / 100;          /* what the wire adds */
      var gate = 0.05 + Math.round(rnd(seed++) * 5) / 100;          /* what the gate adds */
      var cap = (1.2 + rnd(seed++) * 5).toFixed(2);
      var slew = (0.03 + rnd(seed++) * 0.06).toFixed(2);
      up = !up;
      net((i < 6 ? "ctrl_a/n" : "hub/n") + (200 + i * 13) + " (net)");
      push("", "", slew, wire, up ? "^" : "v", inst + "/A (" + cell + ")");
      push(String(1 + (i % 3)), cap, slew, gate, up ? "^" : "v", inst + "/ZN (" + cell + ")");
    }
    net("hub/n902 (net)");
    push("", "", "0.04", 0.01, "^", "hub/acc_reg[7]/D (DFFR_X1)");

    var arrival = t;
    var required = period - setup;
    var slack = required - arrival;
    var rule = "-----------------------------------------------------------------------------";

    function line(r) {
      if (r.net) return pad("", 6) + pad("", 8) + pad("", 8) + pad("", 8) + pad("", 8) + "   " + r.net;
      return pad(r.fan, 6) + pad(r.cap, 8) + pad(r.slew, 8) + pad(r.d.toFixed(2), 8) +
             pad(r.time.toFixed(2), 8) + " " + (r.edge || " ") + " " + r.desc;
    }
    function plain(delay, time, desc) {
      return pad("", 6) + pad("", 8) + pad("", 8) + pad(delay, 8) + pad(time, 8) + "   " + desc;
    }

    var body = rows.map(line).join("\n");
    return {
      slack: slack, arrival: arrival, stages: stages,
      text: "Startpoint: ctrl_a/state_reg[3]\n" +
        "            (rising edge-triggered flip-flop clocked by clk)\n" +
        "Endpoint: hub/acc_reg[7]\n" +
        "          (rising edge-triggered flip-flop clocked by clk)\n" +
        "Path Group: clk\n" +
        "Path Type: max\n\n" +
        "Fanout     Cap    Slew   Delay    Time   Description\n" + rule + "\n" +
        body + "\n" + plain("", arrival.toFixed(2), "data arrival time") + "\n\n" +
        plain(period.toFixed(2), period.toFixed(2), "clock clk (rise edge)") + "\n" +
        plain("0.00", period.toFixed(2), "clock network delay (ideal)") + "\n" +
        plain("0.00", period.toFixed(2), "clock reconvergence pessimism") + "\n" +
        pad("", 6) + pad("", 8) + pad("", 8) + pad("", 8) + pad(period.toFixed(2), 8) + " ^ hub/acc_reg[7]/CK (DFFR_X1)\n" +
        plain((-setup).toFixed(2), required.toFixed(2), "library setup time") + "\n" +
        plain("", required.toFixed(2), "data required time") + "\n" + rule + "\n" +
        plain("", required.toFixed(2), "data required time") + "\n" +
        plain("", (-arrival).toFixed(2), "data arrival time") + "\n" + rule + "\n" +
        plain("", slack.toFixed(2), "slack (" + (slack >= 0 ? "MET" : "VIOLATED") + ")"),
    };
  }

  function pad(v, n) {
    var t = String(v === undefined ? "" : v);
    while (t.length < n) t = " " + t;
    return t;
  }

  function reportsFigure(M) {
    var path = timingPath(M);
    var totalArea = M.rep.cellArea + M.z.fg.macroArea;
    var util = Math.round(100 * totalArea / M.z.coreArea);
    var text = "[INFO FLW-0012] Placement violations .\n\n" +
      bannerBlock("report_design_area", "Design area " + Math.round(totalArea) + " um^2 " + util + "% utilization.\n") + "\n" +
      bannerBlock("report_tns", "tns max 0.00\n") + "\n" +
      bannerBlock("report_wns", "wns max 0.00\n") + "\n" +
      bannerBlock("report_worst_slack", "worst slack max " + path.slack.toFixed(2) + "\n") + "\n" +
      bannerBlock("report_checks -path_delay max", path.text);
    return '<pre class="pl-report">' + esc(text) + "</pre>" +
      '<div class="ff3-legend"><span>the section banners, the area line and the column layout are what a real ' +
      "OpenROAD run prints; the numbers are this design's</span></div>";
  }

  /* ----- step 4's two pictures ----- */

  /* Where splitting a wire starts to pay: one wire against the same
     span cut in half by a buffer, as wire length grows. Two series, so
     both a legend and direct labels; the crossing and this block's own
     longest wire are marked. */
  function breakEvenChart(M) {
    var w = FS.wireRC(OPT.signalLayer), rep = M.rep;
    var W = 430, H = 250, ml = 54, mr = 92, mt = 26, mb = 44;
    var maxL = 800, maxD = 70;
    var px = function (L) { return ml + (L / maxL) * (W - ml - mr); };
    var py = function (d) { return mt + (1 - d / maxD) * (H - mt - mb); };
    var o = ['<svg viewBox="0 0 ' + W + " " + H + '" class="pl-chart" role="img" ' +
             'aria-label="Wire delay against length: one wire rises as the square of length, the same span split by a buffer rises more slowly but starts higher; they cross at ' +
             Math.round(rep.limit) + ' micrometers">'];
    /* recessive grid and axes */
    for (var d = 0; d <= maxD; d += 10) {
      o.push('<line class="pl-grid" x1="' + ml + '" y1="' + py(d) + '" x2="' + (W - mr) + '" y2="' + py(d) + '"/>');
      o.push('<text class="pl-tick" x="' + (ml - 8) + '" y="' + (py(d) + 3.5) + '">' + d + "</text>");
    }
    for (var L = 0; L <= maxL; L += 200) {
      o.push('<text class="pl-tick pl-tick-x" x="' + px(L) + '" y="' + (H - mb + 18) + '">' + L + "</text>");
    }
    o.push('<text class="pl-axis" x="' + ml + '" y="' + (mt - 10) + '">picoseconds of wire delay</text>');
    o.push('<text class="pl-axis pl-axis-x" x="' + ((ml + W - mr) / 2) + '" y="' + (H - 6) + '">wire length, micrometers</text>');

    function path(fn) {
      var pts = [];
      for (var L2 = 0; L2 <= maxL; L2 += 20) pts.push((L2 ? "L" : "M") + px(L2) + " " + py(Math.min(maxD, fn(L2))));
      return pts.join(" ");
    }
    o.push('<path class="pl-line pl-line-one" d="' + path(function (L3) { return wireDelayPs(w, L3); }) + '"/>');
    o.push('<path class="pl-line pl-line-split" d="' + path(function (L3) { return splitDelayPs(w, L3); }) + '"/>');

    /* the crossing */
    var xc = px(rep.limit), yc = py(splitDelayPs(w, rep.limit));
    o.push('<line class="pl-rule" x1="' + xc + '" y1="' + py(0) + '" x2="' + xc + '" y2="' + yc + '"/>');
    o.push('<circle class="pl-dot" cx="' + xc + '" cy="' + yc + '" r="4.5"/>');
    o.push('<text class="pl-note" text-anchor="end" x="' + (xc - 10) + '" y="' + (yc - 34) + '">splitting starts to pay</text>');
    o.push('<text class="pl-note" text-anchor="end" x="' + (xc - 10) + '" y="' + (yc - 21) + '">' + Math.round(rep.limit) + " micrometers</text>");

    /* the square law, marked: double the length, four times the delay */
    var La = 200, Lb = 400;
    var da = wireDelayPs(w, La), db = wireDelayPs(w, Lb);
    [[La, da], [Lb, db]].forEach(function (pt) {
      o.push('<circle class="pl-dot-one pl-mark" cx="' + px(pt[0]) + '" cy="' + py(pt[1]) + '" r="4"/>');
      o.push('<text class="pl-note pl-note-one" x="' + (px(pt[0]) + 8) + '" y="' + (py(pt[1]) + 12) + '">' +
             pt[1].toFixed(1) + " ps at " + pt[0] + "</text>");
    });
    o.push('<line class="pl-rule pl-rule-soft" x1="' + px(La) + '" y1="' + py(da) + '" x2="' + px(La) + '" y2="' + py(db) + '"/>');
    o.push('<line class="pl-rule pl-rule-soft" x1="' + px(La) + '" y1="' + py(db) + '" x2="' + px(Lb) + '" y2="' + py(db) + '"/>');
    o.push('<text class="pl-note pl-note-one" x="' + px(40) + '" y="' + py(58) + '">double the length,</text>');
    o.push('<text class="pl-note pl-note-one" x="' + px(40) + '" y="' + py(51) + '">four times the delay</text>');

    /* this block's longest wire */
    var xl = px(rep.longest);
    o.push('<line class="pl-rule pl-rule-soft" x1="' + xl + '" y1="' + py(0) + '" x2="' + xl + '" y2="' + mt + '"/>');
    o.push('<text class="pl-note pl-note-soft" x="' + (xl - 6) + '" y="' + (mt + 10) + '" text-anchor="end">longest wire here: ' +
           Math.round(rep.longest) + "</text>");

    /* direct labels at the right end */
    o.push('<text class="pl-label pl-label-one" x="' + (W - mr + 6) + '" y="' + (py(Math.min(maxD, wireDelayPs(w, maxL))) + 4) + '">one wire</text>');
    o.push('<text class="pl-label pl-label-split" x="' + (W - mr + 6) + '" y="' + (py(splitDelayPs(w, maxL)) + 4) + '">split by</text>');
    o.push('<text class="pl-label pl-label-split" x="' + (W - mr + 6) + '" y="' + (py(splitDelayPs(w, maxL)) + 16) + '">a buffer</text>');

    /* hover: a crosshair and a readout */
    o.push('<rect id="pl-hit" x="' + ml + '" y="' + mt + '" width="' + (W - ml - mr) + '" height="' + (H - mt - mb) + '" fill="transparent"/>');
    o.push('<g id="pl-cross" style="display:none"><line class="pl-cross" x1="0" y1="' + mt + '" x2="0" y2="' + py(0) + '"/>' +
           '<circle class="pl-cross-dot pl-dot-one" r="3.5"/><circle class="pl-cross-dot pl-dot-split" r="3.5"/></g>');
    o.push("</svg>");
    return {
      svg: o.join(""),
      geom: { ml: ml, mr: mr, mt: mt, mb: mb, W: W, H: H, maxL: maxL, maxD: maxD },
    };
  }

  /* What repair_design actually finds in a block this small: a gate
     asked to drive more load pins than it can hold a slew on, fixed by
     a small buffer tree. */
  function fanoutFigure(M) {
    var lim = OPT.fanoutLimit, n = 2 * lim;
    var W = 430, H = 272;
    var o = ['<svg viewBox="0 0 ' + W + " " + H + '" class="pl-chart" role="img" ' +
             'aria-label="One gate driving ' + n + ' load pins, then the same net with two buffers so no driver sees more than ' + lim + '">'];
    function pins(cx, cy, count, rows) {
      var out = [];
      for (var i = 0; i < count; i++) {
        var row = i % rows, col = (i / rows) | 0;
        out.push('<rect class="pl-load" x="' + (cx + col * 17) + '" y="' + (cy + row * 15) + '" width="10" height="10" rx="1.5"/>');
      }
      return out.join("");
    }
    function gate(x, y, label, cls) {
      return '<rect class="pl-gate ' + (cls || "") + '" x="' + x + '" y="' + y + '" width="44" height="26"/>' +
             '<text class="pl-gate-t" x="' + (x + 22) + '" y="' + (y + 17) + '">' + label + "</text>";
    }
    /* before: one gate, twice the limit */
    o.push('<text class="ff3-panel" x="8" y="18">before: one gate drives ' + n + " pins</text>");
    o.push(gate(10, 46, "U3187"));
    o.push('<line class="pl-wire pl-wire-bad" x1="54" y1="59" x2="150" y2="59"/>');
    o.push(pins(156, 32, n, 4));
    o.push('<text class="pl-note pl-note-bad" x="10" y="108">' + n + " loads against a limit of " + lim + ":</text>");
    o.push('<text class="pl-note pl-note-bad" x="10" y="122">twice the capacitance this gate can swing</text>');

    /* after: two buffers, the limit each */
    o.push('<text class="ff3-panel" x="8" y="156">after: two buffers, ' + lim + " pins each</text>");
    o.push(gate(10, 194, "U3187"));
    o.push('<line class="pl-wire" x1="54" y1="207" x2="80" y2="207"/>');
    o.push('<line class="pl-wire" x1="80" y1="207" x2="80" y2="185"/>');
    o.push('<line class="pl-wire" x1="80" y1="207" x2="80" y2="229"/>');
    o.push(gate(80, 172, "buf", "pl-gate-new"));
    o.push(gate(80, 216, "buf", "pl-gate-new"));
    o.push('<line class="pl-wire" x1="124" y1="185" x2="150" y2="185"/>');
    o.push('<line class="pl-wire" x1="124" y1="229" x2="150" y2="229"/>');
    o.push(pins(156, 178, lim, 2));
    o.push(pins(156, 222, lim, 2));
    o.push('<text class="pl-note pl-note-good" x="250" y="200">' + lim + " loads each,</text>");
    o.push('<text class="pl-note pl-note-good" x="250" y="214">inside the limit</text>');
    o.push("</svg>");
    return o.join("");
  }

  /* The cells in step 5's close-up: where global placement left each
     one (overlapping, between rows, mid-site) and where legalization
     puts it (packed along a row, on whole sites). Built once so the
     picture and the animation agree. */
  var ZOOM = { rows: 6, px: 5.2, wide: 122, ox: 20, oy: 34 };

  function zoomCells() {
    function rnd(seed) { var x = Math.sin(seed * 45.164) * 19371.331; return x - Math.floor(x); }
    var out = [], seed = 11, W = ZOOM.wide * ZOOM.px;
    var rowPitch = 26;
    for (var r = 0; r < ZOOM.rows; r++) {
      var x = 4;
      for (var i = 0; i < 60; i++) {
        var w = (1.1 + rnd(seed++) * 3.2) * ZOOM.px;
        if (x + w > W - 6) break;
        var legalX = x, legalY = ZOOM.oy + r * rowPitch;
        /* which side this cell's input pin sits on, and whether turning
           it round would shorten the wire that feeds it */
        var pinLeft = rnd(seed++) > 0.5;
        out.push({
          w: w, h: rowPitch - 9,
          x1: legalX, y1: legalY,
          x0: legalX + (rnd(seed++) - 0.5) * 22,
          y0: legalY + (rnd(seed++) - 0.5) * rowPitch * 0.85,
          row: r, pinLeft: pinLeft, mirror: !pinLeft && rnd(seed++) > 0.78,
        });
        x += w + 1.6;
      }
    }
    return out;
  }

  /* the close-up, drawn at whichever stage of legalization is asked for */
  function rowLegalizeFigure(M) {
    var cells = M.zoom, W = ZOOM.wide * ZOOM.px, H = ZOOM.oy + ZOOM.rows * 26 + 16;
    var o = ['<svg viewBox="0 0 ' + (W + 2 * ZOOM.ox) + " " + H + '" class="ff3-svg pl-zoom" role="img" ' +
             'aria-label="Six rows of standard cells, moving from where global placement left them onto legal positions">'];
    for (var r = 0; r < ZOOM.rows; r++) {
      o.push('<rect class="' + (r % 2 ? "ff3-row-fs" : "ff3-row-n") + '" x="' + ZOOM.ox + '" y="' + (ZOOM.oy + r * 26) +
             '" width="' + W + '" height="' + (26 - 5) + '"/>');
    }
    cells.forEach(function (c, i) {
      o.push('<rect class="pl-lgz" data-lgz="' + i + '" x="' + (ZOOM.ox + c.x0).toFixed(1) + '" y="' + (c.y0 + 3).toFixed(1) +
             '" width="' + c.w.toFixed(1) + '" height="' + c.h + '"/>');
      o.push('<rect class="pl-lgz-pin" data-pin="' + i + '" x="' + (ZOOM.ox + c.x0 + (c.pinLeft ? 1 : c.w - 3)).toFixed(1) +
             '" y="' + (c.y0 + 6).toFixed(1) + '" width="2" height="' + (c.h - 6) + '"/>');
    });
    o.push('<text class="ff3-cap" x="' + ZOOM.ox + '" y="20">a 122 micrometer window: six rows, as the legalizer works through them</text>');
    o.push("</svg>");
    return o.join("") +
      '<div class="gp-readout" id="lgz-readout">' +
      '<span>legalized <b id="lgz-done">0</b> of ' + fmt(cells.length) + " cells in view</span>" +
      '<span>average displacement <b id="lgz-disp">' + f2(M.disp.average) + "</b> micrometers</span>" +
      '<span>mirrored <b id="lgz-mirror">0</b></span>' +
      '<button class="ff-reset" type="button" id="lgz-replay">replay</button></div>';
  }

  /* run the legalizer across the close-up, row by row */
  function legalizeAnimate(M) {
    var root = document.getElementById("flow-fig-5");
    if (!root) return;
    var rects = root.querySelectorAll(".pl-lgz");
    var pins = root.querySelectorAll(".pl-lgz-pin");
    if (!rects.length) return;
    var doneEl = document.getElementById("lgz-done");
    var mirrorEl = document.getElementById("lgz-mirror");
    var replay = document.getElementById("lgz-replay");
    var cells = M.zoom, timer = null;

    function pinX(c, legal, mirrored) {
      var base = ZOOM.ox + (legal ? c.x1 : c.x0);
      var left = mirrored ? !c.pinLeft : c.pinLeft;
      return base + (left ? 1 : c.w - 3);
    }

    function place(i, legal, mirrored) {
      var c = cells[i], rect = rects[i], pin = pins[i];
      rect.setAttribute("x", (ZOOM.ox + (legal ? c.x1 : c.x0)).toFixed(1));
      rect.setAttribute("y", ((legal ? c.y1 : c.y0) + 3).toFixed(1));
      rect.classList.toggle("pl-lgz-legal", !!legal && !mirrored);
      rect.classList.toggle("pl-lgz-mirrored", !!mirrored);
      if (pin) {
        pin.setAttribute("x", pinX(c, legal, mirrored).toFixed(1));
        pin.setAttribute("y", ((legal ? c.y1 : c.y0) + 6).toFixed(1));
      }
    }

    function mirrorPass() {
      var todo = [];
      cells.forEach(function (c, i) { if (c.mirror) todo.push(i); });
      var n = 0;
      timer = setInterval(function () {
        if (n >= todo.length) { clearInterval(timer); timer = null; return; }
        place(todo[n], true, true);
        n += 1;
        if (mirrorEl) mirrorEl.textContent = String(n);
      }, 140);
    }

    function play() {
      if (timer) clearInterval(timer);
      for (var i = 0; i < cells.length; i++) place(i, false, false);
      if (doneEl) doneEl.textContent = "0";
      if (mirrorEl) mirrorEl.textContent = "0";
      var n = 0, perTick = Math.max(1, Math.round(cells.length / 30));
      timer = setInterval(function () {
        for (var k = 0; k < perTick && n < cells.length; k++, n++) place(n, true, false);
        if (doneEl) doneEl.textContent = String(n);
        if (n < cells.length) return;
        clearInterval(timer);
        timer = setTimeout(mirrorPass, 700);   /* a pause, then the mirroring pass */
      }, 170);
    }

    if (replay && !replay.dataset.wired) {
      replay.dataset.wired = "1";
      replay.addEventListener("click", play);
    }
    play();
  }

  /* what mirroring is: the same cell, flipped, with its pins on the
     other side, so a wire that had to reach across it no longer does */
  function mirrorFigure() {
    var W = 430, H = 224;
    var o = ['<svg viewBox="0 0 ' + W + " " + H + '" class="pl-chart" role="img" ' +
             'aria-label="A cell before and after mirroring: flipping it moves its input pin to the near side, shortening the wire that feeds it">'];
    function cell(x, y, pinLeft, label) {
      var g = ['<rect class="pl-gate" x="' + x + '" y="' + y + '" width="88" height="46"/>'];
      g.push('<text class="pl-gate-t" x="' + (x + 44) + '" y="' + (y + 40) + '">' + label + "</text>");
      var ax = pinLeft ? x + 5 : x + 77;
      var zx = pinLeft ? x + 77 : x + 5;
      g.push('<rect x="' + ax + '" y="' + (y + 9) + '" width="6" height="13" fill="#7c3aed"/>');
      g.push('<text class="pl-pinlabel" x="' + (ax + 3) + '" y="' + (y - 4) + '">A in</text>');
      g.push('<rect x="' + zx + '" y="' + (y + 9) + '" width="6" height="13" fill="#16a34a"/>');
      g.push('<text class="pl-pinlabel" x="' + (zx + 3) + '" y="' + (y - 4) + '">Z out</text>');
      return g.join("");
    }
    /* before: the input pin faces away from its driver */
    o.push('<text class="ff3-panel" x="8" y="16">as placed: input pin on the far side</text>');
    o.push('<circle class="pl-drv" cx="34" cy="55" r="7"/><text class="pl-pinlabel" x="34" y="78">driver</text>');
    o.push(cell(150, 40, false, "U4102 (R0)"));
    o.push('<line class="pl-wire pl-wire-bad" x1="41" y1="55" x2="227" y2="55"/>');
    o.push('<text class="pl-note pl-note-bad" x="252" y="96">the wire has to cross</text>');
    o.push('<text class="pl-note pl-note-bad" x="252" y="110">the whole cell to reach A</text>');

    /* after: mirrored about the vertical axis */
    o.push('<text class="ff3-panel" x="8" y="140">mirrored: same site, pins swapped sides</text>');
    o.push('<circle class="pl-drv" cx="34" cy="181" r="7"/><text class="pl-pinlabel" x="34" y="204">driver</text>');
    o.push(cell(150, 166, true, "U4102 (MY)"));
    o.push('<line class="pl-wire" x1="41" y1="181" x2="155" y2="181"/>');
    o.push('<text class="pl-note pl-note-good" x="252" y="196">shorter by the cell width,</text>');
    o.push('<text class="pl-note pl-note-good" x="252" y="210">same sites, same rails</text>');
    o.push("</svg>");
    return o.join("");
  }

  /* a close-up of four rows: cells as the global placer leaves them
     (overlapping, off-row) and as legalization puts them */
  function rowZoom() {
    var px = 5.4, rows = 5, wide = 120;
    var ox = 96, oy = 30, W = wide * px, H = rows * ROW_H * px * 3.4;
    var rowPitch = H / rows;
    function rnd(seed) { var x = Math.sin(seed * 12.9898) * 43758.5453; return x - Math.floor(x); }
    var o = ['<svg viewBox="0 0 ' + (W + ox + 40) + " " + (2 * H + 150) + '" class="ff3-svg ff3-zoom" role="img" aria-label="A close-up of five rows, before and after legalization">'];
    function panel(y0, legal, label, note) {
      o.push('<text class="ff3-panel" x="' + (ox - 80) + '" y="' + (y0 - 14) + '">' + label + "</text>");
      for (var r = 0; r < rows; r++) {
        var ry = y0 + r * rowPitch;
        o.push('<rect class="' + (r % 2 ? "ff3-row-fs" : "ff3-row-n") + '" x="' + ox + '" y="' + ry + '" width="' + W + '" height="' + (rowPitch - 4) + '"/>');
      }
      var x = 0, r2 = 0, seed = 1;
      for (var i = 0; i < 400 && r2 < rows; i++) {
        var w = (1.2 + rnd(seed++) * 3.4) * px;
        if (x + w > W - 6) { x = 0; r2++; if (r2 >= rows) break; }
        var ry2 = y0 + r2 * rowPitch;
        var jitterY = legal ? 0 : (rnd(seed++) - 0.5) * rowPitch * 0.7;
        var jitterX = legal ? 0 : (rnd(seed++) - 0.5) * 12;
        o.push('<rect class="' + (legal ? "pl-cell-legal" : "pl-cell-gp") + '" x="' + (ox + x + jitterX) +
               '" y="' + (ry2 + 3 + jitterY) + '" width="' + w + '" height="' + (rowPitch - 10) + '"/>');
        x += w + (legal ? 1.4 : 2.6);
      }
      o.push('<text class="ff3-cap" x="' + (ox - 80) + '" y="' + (y0 + H + 18) + '">' + note + "</text>");
    }
    panel(oy, false, "after global placement", "cells sit where the maths put them: overlapping, between rows, off the site grid");
    panel(oy + H + 62, true, "after legalization", "every cell on a row, on whole sites, no overlaps, moved as little as possible");
    o.push("</svg>");
    return o.join("");
  }

  /* ----- step 7: what "placed" actually looks like -----
     The die, with a window marked on it, and that window magnified far
     enough to see individual cells: mixed widths packed into rows, the
     buffers repair added, and the tap cells the floorplan left behind. */

  var TILE = { w: 40, rows: 10, px: 14 };   /* micrometers, rows, pixels per micrometer */

  function tileCells() {
    function rnd(seed) { var x = Math.sin(seed * 91.7) * 4123.77; return x - Math.floor(x); }
    var out = [], seed = 21;
    for (var r = 0; r < TILE.rows; r++) {
      var x = 0, nextTap = 6 + rnd(seed++) * 8;
      while (x < TILE.w - 0.6) {
        var kind = "logic", w;
        if (x >= nextTap) { kind = "tap"; w = 0.38; nextTap = x + 18 + rnd(seed++) * 6; }
        else {
          var roll = rnd(seed++);
          if (roll > 0.90) { kind = "buffer"; w = 1.14 + Math.round(rnd(seed++) * 3) * 0.38; }
          else if (roll > 0.74) { kind = "flop"; w = 3.42 + Math.round(rnd(seed++) * 2) * 0.38; }
          else { w = 0.76 + Math.round(rnd(seed++) * 6) * 0.38; }
        }
        if (x + w > TILE.w) break;
        out.push({ row: r, x: x, w: w, kind: kind });
        x += w + (rnd(seed++) > 0.82 ? 0.38 : 0);   /* the odd gap a legalizer leaves */
      }
    }
    return out;
  }

  function handoffFigure(M) {
    var z = M.z;
    /* the window sits in the open core, just below the hub */
    var wx = z.coreW / 2 - TILE.w / 2, wy = z.coreH * 0.56;
    var wh = TILE.rows * ROW_H;

    var die = plan(base(), {
      macros: true, halos: true, pins: true,
      aria: "The finished placement, with the magnified window marked on it",
    });
    /* mark the window on the die, in the same core coordinates plan() uses */
    var S = 440 / Math.max(z.dieW, z.dieH), ox = 34, oy = 26, mg = FS.SIZING.margin;
    var mx = ox + (mg + wx) * S, my = oy + (mg + wy) * S;
    die = die.replace("</svg>",
      '<rect class="pl-tilebox" x="' + (mx - 2) + '" y="' + (my - 2) + '" width="' + (TILE.w * S + 4) +
      '" height="' + (wh * S + 4) + '"/>' +
      '<text class="pl-tilelabel" x="' + (mx + TILE.w * S / 2) + '" y="' + (my - 8) + '">this window</text></svg>');

    /* the window itself, magnified */
    var W = TILE.w * TILE.px, H = TILE.rows * ROW_H * TILE.px, ox2 = 12, oy2 = 26;
    var o = ['<svg viewBox="0 0 ' + (W + 2 * ox2) + " " + (H + oy2 + 26) + '" class="ff3-svg pl-tile" role="img" ' +
             'aria-label="A ' + TILE.w + ' by ' + (TILE.rows * ROW_H).toFixed(0) +
             ' micrometer window of the placed design, showing standard cells of mixed widths packed into rows">'];
    o.push('<text class="ff3-cap" x="' + ox2 + '" y="16">' + TILE.w + " × " + (TILE.rows * ROW_H).toFixed(0) +
           " micrometers of the placed core, magnified about " + Math.round(TILE.px) + " times</text>");
    for (var r = 0; r < TILE.rows; r++) {
      var ry = oy2 + r * ROW_H * TILE.px;
      o.push('<rect class="' + (r % 2 ? "ff3-row-fs" : "ff3-row-n") + '" x="' + ox2 + '" y="' + ry +
             '" width="' + W + '" height="' + (ROW_H * TILE.px) + '"/>');
      /* the shared power and ground rail on each row boundary */
      o.push('<rect class="pl-rail" fill="' + (r % 2 ? "#dc2626" : "#2563eb") + '" x="' + ox2 + '" y="' + (ry - 1.5) +
             '" width="' + W + '" height="3"/>');
    }
    /* the rail closing the last row */
    o.push('<rect class="pl-rail" fill="' + (TILE.rows % 2 ? "#dc2626" : "#2563eb") + '" x="' + ox2 + '" y="' +
           (oy2 + TILE.rows * ROW_H * TILE.px - 1.5) + '" width="' + W + '" height="3"/>');
    M.tile.forEach(function (c) {
      var x = ox2 + c.x * TILE.px, y = oy2 + c.row * ROW_H * TILE.px + 3;
      o.push('<rect class="pl-tc pl-tc-' + c.kind + '" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) +
             '" width="' + (c.w * TILE.px - 1).toFixed(1) + '" height="' + (ROW_H * TILE.px - 6).toFixed(1) + '"/>');
    });
    o.push('<text class="ff3-cap" x="' + ox2 + '" y="' + (oy2 + H + 18) +
           '">every cell sits on a row, on whole sites, sharing the rails above and below it</text>');
    o.push("</svg>");

    function key(cls, label) { return '<span><i class="pl-sw ' + cls + '"></i>' + label + "</span>"; }
    return '<div class="pl-panels pl-panels-wide"><div class="pl-panel">' + die + "</div>" +
      '<div class="pl-panel">' + o.join("") + "</div></div>" +
      '<div class="ff3-legend">' +
      key("pl-sw-logic", "logic cells, mixed widths") +
      key("pl-sw-flop", "flip-flops, the widest") +
      key("pl-sw-buffer", "buffers repair added") +
      key("pl-sw-tap", "tap cells, from the floorplan") +
      "<span>red and blue stripes: the power and ground rails each pair of rows shares</span></div>";
  }

  /* ----- the steps ----- */

  var STEPS = [];

  STEPS.push({
    n: 1, title: "Start from the floorplan", button: "Load the floorplan", againLabel: "Load again",
    line: "Read back the die, rows, pins, macros and power grid, and set the wire model.",
    intro:
      '<p>Placement does not start from nothing. It starts from the file the ' +
      '<a href="/explore/examples/floorplan">floorplan example</a> wrote ' +
      "out: the die and core, the rows and tracks, the pins, the four memories fixed in place with " +
      "their halos, the power grid, and the tap cells. The " + fmt(FS.theModel().z.fg.cells) + " standard " +
      "cells are all still unplaced.</p>" +
      "<p>One thing has to be set before any placement happens: how much resistance and capacitance a " +
      "micrometer of wire has. Without it the tool has no idea what a long wire costs, and every " +
      "decision it makes about wirelength is blind.</p>",
    command:
      "read_db tile4m_floorplan.odb\n" +
      "read_sdc tile4m.sdc\n" +
      "set_wire_rc -signal -layer " + OPT.signalLayer + "\n" +
      "set_wire_rc -clock  -layer " + OPT.clockLayer,
    commandNote:
      "<code>set_wire_rc</code> is in OpenROAD's " +
      '<a href="https://openroad.readthedocs.io/en/latest/main/src/est/README.html">parasitics estimation ' +
      "module</a>: it &quot;sets the resistance and capacitance used to estimate delay of routing " +
      "wires&quot;, separately for clock and signal nets. Signals are modelled on a middle layer and the " +
      "clock on a thicker one, because that is where each will mostly run.",
    reference: function () {
      var sig = FS.wireRC(OPT.signalLayer), clk = FS.wireRC(OPT.clockLayer);
      function delayPs(w, len) { return 0.5 * (w.r * len) * (w.c * len) / 1000; }
      var L = sig.layer;
      return "<h3>Why wirelength, and where the resistance and capacitance come from</h3>" +
        "<p>Placement cannot measure what it actually cares about. Timing needs delays, delays need " +
        "resistance and capacitance, and those need wires, which do not exist yet. So the placer " +
        "optimizes the best stand-in available, and wirelength is it:</p>" +
        '<ul class="ff-checks">' +
        "<li><strong>Delay.</strong> A wire is a distributed resistance-capacitance line: its delay is " +
        "roughly half of (resistance × capacitance), and both grow with length, so delay grows with the " +
        "<em>square</em> of it. Double a wire and you quadruple its delay.</li>" +
        "<li><strong>Power.</strong> Switching power is proportional to the capacitance being charged " +
        "and discharged every cycle, and wire capacitance is a large share of it.</li>" +
        "<li><strong>Routability.</strong> Total wirelength is total demand for routing tracks: the same " +
        "congestion the floorplan example forecast.</li>" +
        "<li><strong>Repair cost.</strong> Wires too long to drive need buffers, which cost area and " +
        "power and have to fit in the density budget (step 4 inserts them).</li></ul>" +
        "<p>There is a mechanical reason too. The objective is evaluated millions of times inside the " +
        "optimizer, so it has to be cheap and smooth. Half-perimeter wirelength is both. Timing is " +
        "neither: it is expensive, and it is built from minimum and maximum operations, which are not " +
        "smooth. That is also what <em>timing-driven</em> placement really means: still wirelength, but " +
        "the nets on the worst paths count for more.</p>" +

        "<h3>The two numbers behind every wire delay</h3>" +
        "<p><code>set_wire_rc -layer " + OPT.signalLayer + "</code> does not invent anything. It reads that " +
        "layer's entries from <code>tech.lef</code> and works out what one micrometer of wire costs:</p>" +
        '<pre class="ffd-code">' + FS.esc([
          "LAYER " + L.name,
          "  DIRECTION " + L.dir.toUpperCase() + " ;",
          "  WIDTH " + L.width.toFixed(2) + " ;                  # micrometers",
          "  RESISTANCE RPERSQ " + L.rSheet.toFixed(2) + " ;     # ohms per square of metal",
          "  CAPACITANCE CPERSQDIST " + L.cArea.toFixed(3) + " ; # femtofarads per square micrometer",
          "  EDGECAPACITANCE " + L.cEdge.toFixed(3) + " ;        # femtofarads per micrometer of edge",
          "END " + L.name,
        ].join("\n")) + "</pre>" +
        '<table class="ff-table"><tr><th>Quantity</th><th>How it is worked out</th><th>Result</th></tr>' +
        "<tr><td>Resistance per micrometer</td><td>sheet resistance ÷ wire width = " + L.rSheet.toFixed(2) +
        " ÷ " + L.width.toFixed(2) + "</td><td><strong>" + sig.r.toFixed(2) + " ohms</strong></td></tr>" +
        "<tr><td>Capacitance per micrometer</td><td>plate across the width, plus fringe off both edges = " +
        L.cArea.toFixed(3) + " × " + L.width.toFixed(2) + " + 2 × " + L.cEdge.toFixed(3) +
        "</td><td><strong>" + sig.c.toFixed(3) + " femtofarads</strong></td></tr>" +
        "<tr><td>The clock layer, " + OPT.clockLayer + "</td><td>thicker and wider: lower resistance, and further " +
        "from its neighbours</td><td><strong>" + clk.r.toFixed(2) + " ohms, " + clk.c.toFixed(3) + " femtofarads</strong></td></tr>" +
        "</table>" +
        "<p>Put those to work on a wire " + OPT.maxWire + " micrometers long on " + OPT.signalLayer + ": " +
        (sig.r * OPT.maxWire).toFixed(0) + " ohms driving " + (sig.c * OPT.maxWire).toFixed(0) + " femtofarads, so about <strong>" +
        delayPs(sig, OPT.maxWire).toFixed(1) + " picoseconds</strong> of wire delay. Double it to " + (2 * OPT.maxWire) +
        " micrometers and it is <strong>" + delayPs(sig, 2 * OPT.maxWire).toFixed(1) + " picoseconds</strong>, four times as much, not twice. " +
        "That square law is the whole reason step 4 splits any wire over " + OPT.maxWire + " micrometers with a buffer: two " +
        "short wires in series beat one long one.</p>" +

        "<h3>The accuracy ladder</h3>" +
        "<p>These placement numbers are the second rung of four. Each needs the stage before it to have run:</p>" +
        '<table class="ff-table"><tr><th>When</th><th>What the numbers come from</th><th>Command</th></tr>' +
        "<tr><td>Before placement</td><td>A statistical table in the timing library: fanout in, expected " +
        "length out. No positions involved at all.</td><td>the fallback if nothing is set</td></tr>" +
        "<tr><td><strong>After placement (here)</strong></td><td>Per-micrometer values for one average " +
        "layer, applied to a wire topology guessed from the pin positions.</td><td><code>estimate_parasitics -placement</code></td></tr>" +
        "<tr><td>After global routing</td><td>The same per-micrometer values, but the real topology and " +
        "the actual layers each net uses.</td><td><code>estimate_parasitics -global_routing</code></td></tr>" +
        "<tr><td>After detailed routing</td><td>Real geometry, extracted against rules calibrated to a " +
        "field solver, including coupling to neighbouring wires.</td><td><code>extract_parasitics</code> (OpenRCX)</td></tr>" +
        "</table>" +
        "<p>OpenROAD's documentation is blunt about which rung this is: placement-based parasitics " +
        "&quot;cannot accurately predict routed parasitics, so a margin can be used to over-repair the " +
        "design to compensate&quot;. That is why step 4 deliberately fixes more than the numbers here " +
        "strictly demand.</p>";
    },
    run: function () {
      var M = model(), z = M.z;
      return {
        log: [
          { k: "cmd", t: "read_db tile4m_floorplan.odb" },
          { k: "out", t: "  die " + f1(z.dieW) + " × " + f1(z.dieH) + ", core " + f1(z.coreW) + " × " + f1(z.coreH) + ", " + z.rows + " rows" },
          { k: "out", t: "  fixed: 4 macros, " + fmt(FS.theModel().taps.taps) + " tap cells, " + fmt(FS.theModel().taps.endcaps) + " endcaps" },
          { k: "out", t: "  unplaced: " + fmt(z.fg.cells) + " standard cells" },
          { k: "cmd", t: "read_sdc tile4m.sdc" },
          { k: "out", t: "  clocks: 1 (clk, period " + FS.DESIGN.clockPeriodNs.toFixed(1) + " nanoseconds)" },
          { k: "cmd", t: "set_wire_rc -signal -layer " + OPT.signalLayer },
          { k: "cmd", t: "set_wire_rc -clock  -layer " + OPT.clockLayer },
          { k: "ok", t: "Floorplan loaded. Ready to place." },
        ],
        figure: plan(base(), { macros: true, halos: true, pins: true, note: "core: " + fmt(M.freeArea) + " square micrometers free for cells", aria: "The floorplan as placement receives it" }),
        report: "<h3>What placement inherits</h3>" + table([
          ["Core", f1(z.coreW) + " × " + f1(z.coreH) + " micrometers, " + z.rows + " rows of " + fmt(z.sites) + " sites"],
          ["Fixed already", "4 memories with halos, " + fmt(FS.theModel().taps.taps) + " tap cells, " + fmt(FS.theModel().taps.endcaps) + " endcaps, the power grid"],
          ["Room left for cells", fmt(M.freeArea) + " square micrometers"],
          ["To place", fmt(z.fg.cells) + " standard cells, " + fmt(M.cell0) + " square micrometers"],
          ["Average density that implies", Math.round(100 * M.cell0 / M.freeArea) + "% of the free area"],
        ]) + checks([
          ["The hard part is already decided.",
           "The memories cannot move now, and the free area is whatever the floorplan left. Placement " +
           "optimizes inside that shape; it cannot rescue a bad one."],
          ["The average density sets expectations.",
           "The cells need " + Math.round(100 * M.cell0 / M.freeArea) + "% of the free area. Placement has to leave the rest as " +
           "breathing room spread evenly, not clumped in one corner."],
          ["Without a wire model, wirelength is meaningless.",
           "<code>set_wire_rc</code> is what turns a length in micrometers into a delay. Every later " +
           "decision, from where a cell goes to which gate gets resized, depends on it."],
        ]),
      };
    },
  });

  STEPS.push({
    n: 2, title: "Prepare the netlist", button: "Prepare the netlist", againLabel: "Run again",
    line: "Rule out the cells that must not be chosen, drop synthesis's buffers, buffer the ports.",
    intro:
      "<p>Three small changes before any cell is placed. None of them is universal; each is a decision " +
      "with a reason, and each can be turned off.</p>" +
      '<ul class="ff-checks">' +
      "<li><strong>Rule out cells the optimizer must not pick.</strong> Two kinds: cells that are " +
      "physical-only and carry no logic (tap cells, filler), and cells that are legal but unwelcome, " +
      "usually because they hurt routability or because the flow inserts them itself later.</li>" +
      "<li><strong>Drop the buffers synthesis inserted.</strong> Synthesis chose them from a statistical " +
      "guess at wire length, before anything had a position. Once cells have positions, step 4 can " +
      "redo that job against real distances, and do it better. Keeping both means optimizing around " +
      "someone else's wrong answer.</li>" +
      "<li><strong>Buffer the ports.</strong> Put one gate at each boundary pin, so what the outside " +
      "world drives and what the inside sees are both known cells rather than whatever logic happened " +
      "to land at the edge.</li></ul>",
    command:
      "set_dont_use {TAPCELL_X1 FILLCELL_X1 AOI211_X1 OAI211_X1}\n" +
      "remove_buffers\n" +
      "buffer_ports",
    commandNote:
      "How standard is this? All three are in the " +
      '<a href="https://raw.githubusercontent.com/The-OpenROAD-Project/OpenROAD-flow-scripts/master/flow/scripts/global_place.tcl">reference ' +
      "flow's own placement script</a>, and all three are on by default, but two of them are guarded:" +
      '<ul class="ff-checks">' +
      "<li><code>remove_buffers</code> runs only when global placement is timing-driven. That setting " +
      "defaults to on, so in practice it runs; switch timing-driven placement off and the synthesis " +
      "buffers stay, because nothing downstream would rebuild them.</li>" +
      "<li><code>buffer_ports</code> runs unless it is explicitly disabled, <em>or</em> the design has a " +
      "footprint, meaning a chip-level design with a pad ring. The script's own comment is &quot;Do not " +
      "buffer chip-level designs&quot;: at chip level the input/output cells already provide the " +
      "boundary drive, so adding buffers would be redundant. <code>tile4m</code> is a block inside a " +
      "chip, so it gets them.</li>" +
      "<li>The do-not-use list is not per design: it comes from the process. The one above is what the " +
      "open flow ships for its 45 nanometer library, under the comment &quot;Dont use cells to ease " +
      "congestion&quot;.</li></ul>" +
      "<p>The gate resizer's documentation gives the reason for the first: <code>remove_buffers</code> " +
      "removes &quot;buffers inserted by synthesis&quot; and is &quot;recommended before using " +
      "repair_design&quot;.</p>",
    run: function () {
      var M = model();
      var removed = Math.round(M.z.fg.cells * 0.021);
      var ports = M.z.fg.ports;
      return {
        log: [
          { k: "cmd", t: "set_dont_use {TAPCELL_X1 FILLCELL_X1 AOI211_X1 OAI211_X1}" },
          { k: "out", t: "  4 masters excluded: 2 physical-only, 2 complex gates that crowd routing" },
          { k: "cmd", t: "remove_buffers" },
          { k: "out", t: "  removed " + fmt(removed) + " buffers left by synthesis" },
          { k: "cmd", t: "buffer_ports" },
          { k: "out", t: "  inserted " + ports + " port buffers (" + (ports - 2) + " data and control, 2 clock and reset)" },
          { k: "ok", t: "Netlist prepared for placement." },
        ],
        figure: null,
        report: "<h3>Netlist changes</h3>" + table([
          ["Masters excluded", "TAPCELL_X1 and FILLCELL_X1 (physical-only), AOI211_X1 and OAI211_X1 (many pins in a small cell)"],
          ["Buffers removed", fmt(removed) + " (synthesis guesses, made without positions)"],
          ["Port buffers added", ports + ", one per port"],
          ["Cells to place now", fmt(M.z.fg.cells - removed + ports)],
        ]) + checks([
          ["A do-not-use list has two kinds of entry.",
           "Physical-only cells (the tap and filler cells the floorplan already placed) must never be " +
           "chosen as logic: they have no function and no timing. The others are real gates ruled out " +
           "on judgement, most often because they pack many pins into a small cell, which is hard to " +
           "reach with wires. Other flows also exclude cells they insert themselves, such as clock " +
           "gating cells, so the optimizer cannot scatter them."],
          ["Removing buffers is guarded, not automatic.",
           "The reference flow removes them only when global placement is timing-driven, which is the " +
           "default, so normally they go. The condition is the point: it is worth removing them because " +
           "the optimizer that follows will rebuild them better against real distances. In a flow that " +
           "will not rebuild them, removing them just makes the design worse."],
          ["Port buffering fixes the block's boundary.",
           "The constraints file describes the outside world as an assumed driver and an assumed load. " +
           "A buffer at each port makes the first gate inside the block a known one, so internal timing " +
           "does not depend on which random cell sat at the edge, and the resizer can size that gate " +
           "for the real load. A chip-level design skips this: its input/output cells already do the " +
           "job, which is why the reference flow turns port buffering off when a footprint is defined."],
        ]),
      };
    },
  });

  STEPS.push({
    n: 3, title: "Global placement", button: "Place the cells", againLabel: "Place again",
    line: "Spread every cell to a rough position that balances wirelength against density.",
    intro:
      "<p>This is the heart of placement. Every cell gets a position that trades two forces against each " +
      "other: connections pull connected cells together, and density pushes cells out of any area that " +
      "is getting too full. OpenROAD solves it as a physics problem, treating cell area as electric " +
      "charge whose field spreads the design out.</p>" +
      "<p>Nothing is legal yet. Cells land between rows, off the site grid, and slightly on top of each " +
      "other. That is expected: this step decides <em>where</em>, and step 5 makes it legal.</p>",
    command: GP_CMD,
    commandNote:
      "OpenROAD's " +
      '<a href="https://openroad.readthedocs.io/en/latest/main/src/gpl/README.html">global placer</a> ' +
      "is &quot;based on the open-source RePlAce tool&quot; and is an &quot;analytic and nonlinear " +
      "placement algorithm&quot; that &quot;solves electrostatic force equations using Nesterov's " +
      "method&quot;. <code>-density</code> is the target fullness (the default is 0.7). The padding " +
      "reserves " + OPT.padGlobal + " sites either side of each cell so routing has somewhere to go. " +
      "<code>-timing_driven</code> reweights the nets with the worst slack; " +
      "<code>-routability_driven</code> inflates cells where a congestion estimate says wires will not fit.",
    reference: function () {
      var M = model();
      var per = Math.round(M.z.fg.cells / M.cells.length);
      function key(cls, label) {
        return '<span class="gp-key"><i class="' + cls + '"></i>' + label + "</span>";
      }
      return '<div class="gp-guide">' +
        "<h3>What you are about to watch</h3>" +
        "<p>Pressing the button runs the placer and animates what it does, one iteration at a time. " +
        "Three things are on the picture:</p>" +
        '<ul class="ff-checks">' +
        "<li><strong>The dots are cells.</strong> " + fmt(M.cells.length) + " of them, standing in for the " +
        fmt(M.z.fg.cells) + " real ones, so each dot is about " + per + " cells. They are coloured by the logic they " +
        "belong to: " + key("gp-sw-A", "Memory A's controller") + key("gp-sw-B", "Memory B's") +
        key("gp-sw-C", "Memory C's") + key("gp-sw-D", "Memory D's") + key("gp-sw-hub", "the hub") + "</li>" +
        "<li><strong>The coloured squares behind them are density</strong>, one per 20 micrometer bin: " +
        "clear below half full, green about half, amber approaching the " + OPT.density.toFixed(2) + " target, red over it. " +
        "The dots show <em>where</em> the cells are; the squares show <em>how crowded</em> that makes each patch.</li>" +
        "<li><strong>The readout under the picture</strong> tracks the iteration, the overflow (how much " +
        "cell area still sits above the target), and the running wirelength estimate.</li></ul>" +
        "<p><strong>What to watch for.</strong> It starts with each group piled onto the single point its " +
        "connections pull it to: shortest possible wires, and completely unbuildable, with the piles " +
        "many times over full. As the density penalty grows, the piles push outward, flow around the " +
        "memories and their halos, and settle into the free area. Overflow falls while wirelength " +
        "climbs: that trade is the whole algorithm. Press <em>replay</em> to watch it again.</p>" +
        "<p class=\"ffd-note\">The groups, and the pull on them, come from this site's simple spring " +
        "model of the design. The animation shows the character of analytic placement faithfully: the " +
        "collapse, the spread, and the two numbers moving against each other. It is not a replay of what " +
        "OpenROAD's placer would produce for this netlist.</p></div>";
    },
    run: function () {
      var M = model(), s = M.gpStat, fr = M.frames;
      var hpwlFinal = M.hpwl;
      var log = [{ k: "cmd", t: GP_CMD }];
      log.push({ k: "out", t: "  placement instances: " + fmt(M.z.fg.cells) + ", target density " + OPT.density.toFixed(2) });
      fr.forEach(function (f, i) {
        if (i % 2 && i !== fr.length - 1) return;
        log.push({ k: "out", t: "  iter " + String(i * 20).padStart(3) +
                   "   overflow " + f.overflow.toFixed(3) +
                   "   wirelength " + ((hpwlFinal * f.hpwlFactor) / 1000).toFixed(1) + " mm" });
      });
      var cross = 0;
      fr.forEach(function (f, i) { if (!cross && f.overflow < 0.10) cross = i * 20; });
      log.push({ k: "out", t: "  overflow below 0.10 at iteration " + cross + ": converged" });
      log.push({ k: "out", t: "  average density " + Math.round(s.average * 100) + "%, busiest bin " + Math.round(s.peak * 100) + "%" });
      log.push({ k: "ok", t: "Global placement done. Nothing is legal yet." });

      /* the map is drawn once at the first iteration, then recoloured
         frame by frame once the log has finished streaming */
      var g = M.g;
      var heat = {
        die: { w: g.w, h: g.h, nx: g.nx, ny: g.ny, bw: g.bw, bh: g.bh },
        ratio: densityOf(g, fr[0].area), conns: [],
      };
      var fig = plan(base(), {
        macros: true, halos: true, pins: true, heat: heat, heatClass: "gp-bin",
        cells: cellLayer(M, 0),
        aria: "Standard cells spreading out as global placement runs, over a density map",
      }) +
        '<div class="gp-readout" id="gp-readout">' +
        '<span class="gp-iter">iteration <b id="gp-iter">0</b></span>' +
        '<span>overflow <b id="gp-over">' + fr[0].overflow.toFixed(3) + "</b> (stops below 0.10)</span>" +
        '<span>wirelength <b id="gp-wl">' + ((hpwlFinal * fr[0].hpwlFactor) / 1000).toFixed(1) + "</b> millimeters</span>" +
        '<button class="ff-reset" type="button" id="gp-replay">replay</button></div>' +
        '<div class="ff3-legend"><span>cell density per 20 micrometer bin: green about half full, amber near the target, red over it</span></div>';

      return {
        log: log,
        figure: fig,
        after: function () { animate(M); },
        report: "<h3>Global placement report</h3>" + table([
          ["Target density", OPT.density.toFixed(2) + " (the most cell area any bin may hold)"],
          ["Average density reached", Math.round(s.average * 100) + "% of the free area"],
          ["Busiest bins", Math.round(s.peak * 100) + "%, sitting right at the target"],
          ["Bins at the target", fmt(countAtCap(M)) + " of " + fmt(M.g.nx * M.g.ny) + " (where the placer wanted more room and was refused)"],
          ["Estimated wirelength", (M.hpwl / 1000).toFixed(1) + " millimeters"],
          ["Cell padding", OPT.padGlobal + " sites each side"],
        ]) + checks([
          ["The shape follows the connections.",
           "Each memory's logic sits in front of that memory's pins, and the hub sits in the middle where " +
           "every bus converges. That is the pull of the netlist. The density cap is what stops it " +
           "collapsing into a single pile."],
          ["The plateau is the target doing its work.",
           "The busiest bins all read " + Math.round(s.peak * 100) + "%, not more. Where the netlist wanted a denser clump, " +
           "the density force pushed the surplus outward instead, which is why the map has a flat top and " +
           "a wide skirt rather than a peak."],
          ["The headroom is deliberate.",
           "An average of " + Math.round(s.average * 100) + "% leaves room for what comes next: the buffers repair adds in step 4, " +
           "the clock tree's buffers in the next example, and the wires themselves. Place to 100% and " +
           "there is nowhere to put any of it."],
          ["Watch the two numbers move opposite ways.",
           "Overflow falls from " + fr[0].overflow.toFixed(2) + " to under 0.10 while wirelength climbs from " +
           ((hpwlFinal * fr[0].hpwlFactor) / 1000).toFixed(0) + " to " + (hpwlFinal / 1000).toFixed(0) + " millimeters. That is the whole " +
           "negotiation: the piled-up start has the shortest wires and is completely unbuildable, and " +
           "every step that spreads it out to fit costs length. The placer stops the moment the design " +
           "is spread enough, not a moment later."],
          ["Nothing is legal yet.",
           "Within a bin, cells still overlap, sit between rows, and start mid-site. Global placement " +
           "answers <em>where</em>, to about a bin's accuracy; step 5 answers <em>exactly where</em>."],
        ]),
      };
    },
  });

  STEPS.push({
    n: 4, title: "Estimate parasitics and repair", button: "Repair the design", againLabel: "Repair again",
    line: "Buffer what cannot be driven and resize what is too weak, now that distances are real.",
    intro:
      "<p>Now that every cell has a position, each wire's resistance and capacitance can be estimated " +
      "from its length. That turns vague nets into numbers, and the numbers expose the problems: gates " +
      "driving more load than they can swing quickly, and wires long enough that their own delay " +
      "matters. <code>repair_design</code> fixes both, by inserting buffers and resizing gates.</p>" +
      "<p>It makes the design bigger, which is why it runs before legalization rather than after: the " +
      "new cells still have to be given legal positions.</p>",
    command:
      "estimate_parasitics -placement\n" +
      "repair_design -verbose",
    commandNote:
      "<code>estimate_parasitics -placement</code> estimates &quot;RC parasitics based on placed " +
      "component pin locations&quot;. <code>repair_design</code> &quot;inserts buffers on nets to repair " +
      "max slew, max capacitance and max fanout violations, and on long wires to reduce RC delay in the " +
      "wire. It also resizes gates to normalize slews.&quot; Left alone, it works out its own maximum " +
      "wire length from the resistance and capacitance set in step 1; the chart below is that " +
      "calculation. The fanout limit comes from the design's own constraints, which set " +
      OPT.fanoutLimit + " loads per gate back in step 1; left unconstrained, the tool falls back to a default of 50.",
    reference: function () {
      var M = model(), rep = M.rep, w = FS.wireRC(OPT.signalLayer);
      return "<h3>What repair is looking for</h3>" +
        "<p>Two different faults, with two different fixes. The picture on the left is the one that " +
        "dominates in a block this size; the chart on the right is the one everybody expects.</p>" +
        '<div class="pl-panels">' +
        '<div class="pl-panel"><div class="pl-panel-h">Too much load for one gate</div>' + fanoutFigure(M) + "</div>" +
        '<div class="pl-panel"><div class="pl-panel-h">When splitting a wire pays</div>' + breakEvenChart(M).svg +
        '<div class="pl-readout" id="pl-readout">Hover the chart to read both delays at a length.</div></div>' +
        "</div>" +
        "<p>The chart is worth reading slowly. One wire's delay grows with the <em>square</em> of its " +
        "length, so it starts flat and then runs away. Splitting the same span in two quarters each " +
        "half's delay, so the pair costs half as much, but the buffer in the middle charges its own " +
        "delay up front: that is why the split line starts higher. They cross at <strong>" +
        Math.round(rep.limit) + " micrometers</strong>, and that crossing, not a round number, is what a " +
        "maximum wire length means.</p>" +
        "<p>Which brings the surprise: <strong>the longest wire in this whole block is " +
        Math.round(rep.longest) + " micrometers</strong>, comfortably short of the crossing, so nothing here gets " +
        "split at all. A 0.26 square millimeter block is simply not big enough for wire delay to be the " +
        "problem. Every buffer this step inserts is there for fanout and slew instead. On a block ten " +
        "times the area, the chart's right-hand side is where the work would be.</p>";
    },
    run: function () {
      var M = model(), r = M.rep, s = M.gprStat;
      return {
        log: [
          { k: "cmd", t: "estimate_parasitics -placement" },
          { k: "out", t: "  parasitics estimated for " + fmt(M.z.fg.nets) + " nets from placed pin locations" },
          { k: "cmd", t: "repair_design -verbose" },
          { k: "out", t: "  max wire length from the wire model: " + Math.round(r.limit) + " micrometers" },
          { k: "out", t: "  wires over that length: " + r.longBits + " (longest is " + Math.round(r.longest) + ")" },
          { k: "out", t: "  nets over the fanout limit of " + OPT.fanoutLimit + ": " + fmt(r.highFanout) },
          { k: "out", t: "  inserted " + fmt(r.buffers) + " buffers, resized " + fmt(r.resized) + " gates" },
          { k: "out", t: "  cell area now " + fmt(r.cellArea) + " square micrometers (+" + (100 * r.added / M.cell0).toFixed(1) + "%)" },
          { k: "ok", t: "Design repaired. Density rose; legalization comes next." },
        ],
        figure: repairFigure(M),
        after: function () { wireChartHover(M); },
        report: "<h3>Repair report</h3>" + table([
          ["Maximum wire length", Math.round(r.limit) + " micrometers, worked out from the wire model, not chosen"],
          ["Wires over it", r.longBits + " (the longest wire in the block is " + Math.round(r.longest) + ")"],
          ["Nets over the fanout limit", fmt(r.highFanout) + " of " + fmt(M.z.fg.nets)],
          ["Buffers inserted", fmt(r.buffers) + ", all of them for fanout and slew"],
          ["Gates resized", fmt(r.resized)],
          ["Cell area", fmt(M.cell0) + " → " + fmt(r.cellArea) + " square micrometers (+" + (100 * r.added / M.cell0).toFixed(1) + "%)"],
          ["Average density now", Math.round(s.average * 100) + "% (was " + Math.round(M.gpStat.average * 100) + "%)"],
        ]) + checks([
          ["The fix depends on the block's size.",
           "Wire splitting matters when wires are long enough for their own delay to beat a buffer's. " +
           "Here nothing comes close, so every repair is about drive strength: a gate with too many " +
           "loads is slow and its output edge is soft, and a soft edge costs delay at every gate it " +
           "feeds."],
          ["Repair costs area, on purpose.",
           "The design grew " + (100 * r.added / M.cell0).toFixed(1) + "%, and the average density with it. That is what the " +
           OPT.density.toFixed(2) + " target in step 3 was holding back: if the placer had packed to full, these buffers " +
           "would have nowhere to go."],
          ["These numbers are provisional.",
           "The parasitics come from straight-line distances, not real routes. After global routing the " +
           "same estimate is redone with actual paths, and some of this work is revisited. That is why " +
           "the documentation suggests repairing with a margin here."],
        ]),
      };
    },
  });

  STEPS.push({
    n: 5, title: "Legalize the placement", button: "Legalize", againLabel: "Legalize again",
    line: "Snap every cell onto a row and a site, with no overlaps and as little movement as possible.",
    intro:
      "<p>Global placement produced positions, not a placement. Cells overlap, sit between rows, and " +
      "start in the middle of a site. Legalization fixes all three, and its whole job is to do it while " +
      "moving cells as little as it can: every micrometer of displacement undoes a little of the " +
      "wirelength and timing the global placer worked for.</p>" +
      "<p>The padding is set again here, smaller than during global placement, because now it is about " +
      "the gap between neighbouring cells rather than about spreading the design.</p>",
    command:
      "set_placement_padding -global -left " + OPT.padDetail + " -right " + OPT.padDetail + "\n" +
      "detailed_placement\n" +
      "optimize_mirroring",
    commandNote:
      "OpenROAD's " +
      '<a href="https://openroad.readthedocs.io/en/latest/main/src/dpl/README.html">detailed placer</a> ' +
      "&quot;legalizes the result of global placement: it moves instances to legal sites on rows while " +
      "minimizing displacement&quot;. <code>optimize_mirroring</code> &quot;mirrors instances about the Y " +
      "axis in a weak attempt to reduce the total half-perimeter wirelength&quot;: free, because a " +
      "mirrored cell occupies the same site.",
    reference: function () {
      return "<h3>What mirroring is, and why it is free</h3>" +
        "<p>A standard cell can be flipped left-to-right about its own vertical axis. It keeps the same " +
        "width, so it still occupies exactly the same sites on the same row, and its power and ground " +
        "rails still line up. Nothing about the placement changes except <em>which side its pins are " +
        "on</em>.</p>" +
        '<div class="pl-panels"><div class="pl-panel">' + mirrorFigure() + "</div>" +
        '<div class="pl-panel pl-panel-text">' +
        "<p>That is worth something. A cell whose input pin faces away from the gate driving it forces " +
        "the wire to travel the cell's whole width before it can land. Flip the cell and the pin is on " +
        "the near side instead.</p>" +
        "<p>The saving per cell is small, a couple of micrometers at most, but it costs nothing: no area, " +
        "no displacement, no legality risk. It is the last thing done because it needs final positions " +
        "to know which way each cell should face, and it is kept only where it helps.</p>" +
        "<p>The orientation is recorded in the design the same way a macro's is. A cell placed as " +
        "<code>R0</code> becomes <code>MY</code>, mirrored about the Y axis, which is the same vocabulary " +
        "the memories used in the floorplan example.</p>" +
        "</div></div>";
    },
    run: function () {
      var M = model(), d = M.disp, s = M.gprStat;
      return {
        log: [
          { k: "cmd", t: "set_placement_padding -global -left " + OPT.padDetail + " -right " + OPT.padDetail },
          { k: "cmd", t: "detailed_placement" },
          { k: "out", t: "  legalized " + fmt(M.z.fg.cells) + " instances onto " + M.rows + " rows of " + fmt(M.sites) + " sites" },
          { k: "out", t: "  average displacement " + f2(d.average) + " micrometers, worst area " + f2(d.worst) },
          { k: "out", t: "  0 overlaps, 0 instances off-row, 0 instances off-grid" },
          { k: "cmd", t: "optimize_mirroring" },
          { k: "out", t: "  flipped " + fmt(Math.round(M.z.fg.cells * 0.11)) + " cells to face their drivers, at no cost in area" },
          { k: "ok", t: "Placement is legal: every cell on a row, on whole sites, no overlaps." },
        ],
        figure: rowLegalizeFigure(M),
        after: function () { legalizeAnimate(M); },
        report: "<h3>Legalization report</h3>" + table([
          ["Padding", OPT.padDetail + " site each side (global placement used " + OPT.padGlobal + ")"],
          ["Average displacement", f2(d.average) + " micrometers, about " + (d.average / ROW_H).toFixed(1) + " row heights"],
          ["Worst area", f2(d.worst) + " micrometers, in the fullest bins"],
          ["Density after", "unchanged at " + Math.round(s.average * 100) + "% average, " + Math.round(s.peak * 100) + "% peak"],
          ["Overlaps left", "0"],
        ]) + checks([
          ["Legalization is local, and should be.",
           "Cells move " + f2(d.average) + " micrometers on average, roughly " + (d.average / ROW_H).toFixed(1) + " row heights. The bin-level " +
           "density map barely changes, because the work is snapping each cell to its row and shuffling " +
           "neighbours a site or two along, not relocating logic."],
          ["Displacement is the tax on the global result.",
           "Every micrometer of movement undoes a little of the wirelength and timing global placement " +
           "worked for. A legalizer that has to move cells far is telling you the placement was too dense " +
           "for the rows, and any timing measured before this point was fiction."],
          ["The fullest bins pay the most.",
           "Displacement rises steeply with how full a bin is: " + f2(d.worst) + " micrometers where the design sits at " +
           Math.round(s.peak * 100) + "%, against " + f2(0.5 * ROW_H) + " in the empty margins, where a cell only has to snap to its row."],
          ["Mirroring is free wirelength.",
           "Flipping a cell left-to-right keeps it in the same site but moves its pins, which can shorten " +
           "the wires reaching it. Nothing is lost, so it is done last and kept only if it helps."],
        ]),
      };
    },
  });

  STEPS.push({
    n: 6, title: "Check and measure", button: "Run the checks", againLabel: "Check again",
    line: "Prove the placement is legal, then measure area, density and wirelength.",
    intro:
      "<p>Two questions now. Is it legal, which is a yes or no the tool can answer exactly? And is it " +
      "good, which is a set of numbers to compare against what the block is supposed to achieve?</p>" +
      "<p>The timing numbers here are still estimates: the clock is ideal (there is no clock tree yet, " +
      "that is the next example) and the wires are straight lines rather than routes. They are worth " +
      "reading anyway, because a placement that already fails timing badly will not be rescued later.</p>",
    command:
      "check_placement -verbose\n" +
      "report_design_area\n" +
      "report_worst_slack\n" +
      "report_checks -path_delay max -fields {slew cap input net fanout}",
    commandNote:
      "<code>check_placement</code> &quot;checks the placement legality&quot; and &quot;returns 0 if the " +
      "placement is legal&quot;. The reports come from OpenSTA through OpenROAD: worst slack is the " +
      "single tightest path, and <code>report_checks</code> prints that path stage by stage. The timing " +
      "example goes through such a report line by line.",
    run: function () {
      var M = model(), s = M.legStat;
      var totalArea = M.rep.cellArea + M.z.fg.macroArea;
      var util = totalArea / M.z.coreArea;
      var path = timingPath(M);
      return {
        log: [
          { k: "cmd", t: "check_placement -verbose" },
          { k: "out", t: "  [INFO FLW-0012] Placement violations ." },
          { k: "cmd", t: "report_design_area" },
          { k: "out", t: "  Design area " + Math.round(totalArea) + " um^2 " + Math.round(util * 100) + "% utilization." },
          { k: "cmd", t: "report_worst_slack" },
          { k: "out", t: "  worst slack max " + path.slack.toFixed(2) },
          { k: "cmd", t: "report_checks -path_delay max -fields {slew cap input net fanout}" },
          { k: "out", t: "  critical path: ctrl_a → hub, " + path.slack.toFixed(2) + " nanoseconds of slack, with an ideal clock" },
          { k: "ok", t: "Placement is legal and measured." },
        ],
        figure: reportsFigure(M),
        report: "<h3>Reading those reports</h3>" + table([
          ["Placement legality", '<span class="ff-good">legal</span>: the violations line is empty, and check_placement returns 0'],
          ["Design area", Math.round(totalArea) + " square micrometers, " + Math.round(util * 100) + "% of the core"],
          ["Worst slack", path.slack.toFixed(2) + " nanoseconds, positive, so the path makes its clock"],
          ["Total negative slack", "0.00: no endpoint is late"],
          ["Critical path", "a flip-flop in Memory A's controller to one in the hub, through 5 gates"],
          ["Estimated wirelength", (M.hpwl / 1000).toFixed(1) + " millimeters"],
        ]) + checks([
          ["The two slack numbers say different things.",
           "Worst slack is the single tightest path: " + path.slack.toFixed(2) + " nanoseconds spare here. Total negative slack adds up " +
           "how late <em>every</em> failing endpoint is, so 0.00 means nothing is late at all. A design " +
           "can have a healthy worst slack and an alarming total, when many endpoints miss by a little."],
          ["Read the path as two columns.",
           "<em>Delay</em> is what each step adds; <em>Time</em> is the running total. The first block " +
           "walks the data from the launching flip-flop to the capturing one and ends at the data " +
           "arrival time. The second block builds the deadline: the clock edge, minus the capturing " +
           "flip-flop's setup requirement, giving the data required time. Slack is the difference."],
          ["\"clock network delay (ideal)\" is the giveaway.",
           "That line reads 0.00 because there is no clock tree yet: the model pretends the clock " +
           "reaches every flip-flop at the same instant. After the next example builds the tree, that " +
           "line is replaced by the real path through the clock buffers, and these numbers get harder."],
          ["Utilization grew, as expected.",
           "The core now holds " + Math.round(util * 100) + "% cells and macros, up from the " + FS.SIZING.util + "% the floorplan " +
           "sized for, because repair added buffers."],
        ]),
      };
    },
  });

  STEPS.push({
    n: 7, title: "Hand off to clock tree synthesis", button: "Write it out", againLabel: "Write again",
    line: "Save the placed design; the clock is still ideal, and that is the next job.",
    intro:
      "<p>The placement is legal and measured, so it gets written out the same way the floorplan did. " +
      "What leaves this stage is every cell's exact position, the buffers repair added, and the same " +
      "fixed macros and power grid that came in.</p>" +
      "<p>One large thing is still missing. The clock reaches every flip-flop instantly in this model, " +
      "because there is no clock tree yet: just a net from the clock port to thousands of pins. " +
      "Building it is the next example, and it will move and add cells, which is why filler cells are " +
      "not inserted until after routing.</p>",
    command:
      "# placement done: save it for clock tree synthesis\n" +
      "write_db tile4m_placed.odb\n" +
      "write_def tile4m_placed.def",
    commandNote:
      "In the reference flow this is the boundary between stage 3 (placement) and stage 4 (clock tree " +
      "synthesis). Filler cells, which close the gaps left between placed cells, come much later, after " +
      "detailed routing, because everything up to then still adds and moves cells.",
    run: function () {
      var M = model();
      var flops = Math.round(M.z.fg.cells * 0.12);
      return {
        log: [
          { k: "cmd", t: "write_db tile4m_placed.odb" },
          { k: "cmd", t: "write_def tile4m_placed.def" },
          { k: "out", t: "  " + fmt(M.z.fg.cells) + " cells placed, " + fmt(M.rep.buffers) + " of them added by repair" },
          { k: "out", t: "  clock network: 1 net, " + fmt(flops) + " flip-flop clock pins, no buffers yet" },
          { k: "ok", t: "Placed design written. Next stage: clock tree synthesis." },
        ],
        figure: handoffFigure(M),
        report: "<h3>What the next stage receives</h3>" + table([
          ["Placed cells", fmt(M.z.fg.cells) + ", all legal"],
          ["Cell area", fmt(M.rep.cellArea) + " square micrometers"],
          ["Still fixed", "4 memories, tap and endcap cells, the power grid"],
          ["Clock network", "1 net driving about " + fmt(flops) + " flip-flop clock pins, with no tree"],
          ["Filler cells", "not yet: they come after detailed routing"],
        ]) + checks([
          ["The clock is the glaring omission.",
           "One net cannot drive " + fmt(flops) + " pins. Until the clock tree is built, every timing number " +
           "assumes the clock arrives everywhere at once, which is the most optimistic assumption in the flow."],
          ["Placement is what the next stages work around.",
           "Clock tree synthesis will squeeze buffers into the gaps this placement left, and routing has " +
           "to connect what this placement spread out. Both inherit its density map."],
          ["Continue the design.",
           'The clock tree example picks up this exact file: <a href="/explore/examples/cts">building the ' +
           "clock tree</a>."],
        ]),
      };
    },
  });

  var STAGE = {
    key: "placement",
    steps: STEPS,
    finishedTitle: "Placement complete.",
    finishedNote: "Every cell has a legal position and the design is written out. Next is " +
      '<a href="/explore/examples/cts">clock tree synthesis</a>, which picks up this exact file.',
    epilogue:
      "<h3>How this differs from a production placement</h3>" +
      "<p>The stages are the real ones and the order is the real order. Four things a production " +
      "placement does that this one does not:</p>" +
      '<ul class="ff-checks">' +
      "<li><strong>It is timing driven throughout.</strong> This example spreads cells for density " +
      "and then repairs what the spreading broke. A production placer weights the critical nets " +
      "while it is still spreading, so the paths that matter are short by construction rather than " +
      "buffered afterwards.</li>" +
      "<li><strong>It knows about congestion while it places.</strong> Here the congestion forecast " +
      "is something to look at. In production it feeds back into the placer, which spreads cells " +
      "further apart in regions that will not route, trading area for a design that closes.</li>" +
      "<li><strong>It runs on a machine that is not yours.</strong> Global placement of a large " +
      "block is hours of compute, and the analytic solver behind it is one of the most tuned pieces " +
      "of code in the field. The version here is a teaching model of the same idea.</li>" +
      "<li><strong>It is one pass of several.</strong> A real flow places, looks at the result, " +
      "changes the floorplan or the constraints, and places again. The first placement of a block " +
      "is rarely the one that ships.</li></ul>",
    footNote: 'Drag cells yourself in the <a href="/explore/algorithms/placement">placement sandbox</a> (in the works).',
  };
  if (typeof window !== "undefined" && window.FLOW_PAGE_STAGE === STAGE.key) window.FLOW_STAGE = STAGE;

  return { OPT: OPT, model: model, STAGE: STAGE, densityFigure: densityFigure, STEPS: STEPS,
           cellLayer: cellLayer, plan: plan, base: base,
           grid: grid, anchors: anchors, cellAt: cellAt, densityOf: densityOf, SHARE: SHARE };
})();

if (typeof module !== "undefined" && module.exports) module.exports = PlacementSteps;
