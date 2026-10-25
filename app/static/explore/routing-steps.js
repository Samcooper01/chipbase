/* The routing worked example: the same design, tile4m, picked up from
   the clock tree the previous example built.

   Everything so far has been positions. Cells sit on sites, buffers sit
   in a tree, and every delay quoted has come from an estimate of a wire
   that does not exist. This stage draws the metal: a path on real tracks
   for every one of the design's connections, obeying the spacing rules,
   the layer directions, and the layers the floorplan reserved.

   The model: a coarse congestion field over the core (reused from the
   floorplan example's trial route) that the global router relieves
   iteration by iteration, per-layer track supply from the technology
   file, and a zoomed window where the detailed router's own iterations
   drive its violation count to zero. */

var RoutingSteps = (function () {
  "use strict";

  var FS = FloorplanSteps, PL = PlacementSteps, CT = CtsSteps;
  var fmt = FS.fmt, f1 = FS.f1, f2 = FS.f2, esc = FS.esc;
  var table = FS.table, checks = FS.checks, plan = FS.plan;

  /* the one option per knob, all of them the reference flow's defaults */
  var OPT = {
    congIters: 30,            /* -congestion_iterations */
    drcIterStep: 5,           /* -drc_report_iter_step */
    endIter: 64,              /* -droute_end_iter */
    antennaIters: 5,          /* repair_antennas -iterations */
    padDetail: PL.OPT.padDetail,
    diode: "ANTENNA_X1",
    fillers: "FILLCELL_X32 FILLCELL_X16 FILLCELL_X8 FILLCELL_X4 FILLCELL_X2 FILLCELL_X1",
    signalLo: "metal2", signalHi: "metal6",
    clockLo: "metal4", clockHi: "metal6",
  };

  var _M = null;
  function core() { return FS.theModel(); }

  /* ----- what each layer can carry -----
     A layer's supply is its track count times the length of a track. A
     horizontal layer has coreH / pitch tracks, each coreW long. Some of
     that is not available: the memories own the lower layers over their
     own area, and the power grid owns stripes on the upper ones. */
  function layerSupply(z, ms) {
    var macroArea = ms.reduce(function (a, m) { return a + m.w * m.h; }, 0);
    var macroShare = macroArea / (z.coreW * z.coreH);
    return FS.LAYERS.map(function (L) {
      var horiz = L.dir === "horizontal";
      var tracks = Math.floor((horiz ? z.coreH : z.coreW) / L.pitch);
      var raw = tracks * (horiz ? z.coreW : z.coreH);
      /* the memories block metal1 to metal3 over themselves; the power
         grid takes stripes of metal4 upward */
      var blocked = 0, why = [], owner = "";
      if (L.name !== "metal5" && L.name !== "metal6") {          /* the memories own metal1 to metal4 */
        blocked += macroShare;
        why.push("the memories, over their own area, " + Math.round(macroShare * 100) + "%");
        owner = "the memories";
      }
      if (L.name === "metal4" || L.name === "metal5" || L.name === "metal6") {   /* stripes and ring */
        var grid = FS.PDN.stripeWidth / FS.PDN.pitch +
                   2 * (FS.PDN.ringWidth + FS.PDN.ringSpacing) / z.coreW;
        blocked += grid;
        why.push("the power grid, " + Math.round(grid * 100) + "%");
        owner = "the power grid";
      }
      /* pins and vias eat into a track's usable length everywhere */
      blocked += 0.08;
      why.push("pins and vias, 8%");
      var routable = L.name !== "metal1";
      if (!routable) {
        blocked = 1;
        why = ["the cells' own layer: pin shapes, internal wiring, and the power rails along every row"];
        owner = "the cells and their pins";
      }
      return { layer: L, tracks: tracks, raw: raw, blocked: blocked, why: why, owner: owner,
               routable: routable, supply: raw * (1 - blocked) };
    });
  }

  /* ----- how much wire there is to draw -----
     The signal estimate is the placement example's half-perimeter
     wirelength, grown by the detours a real route takes. The clock is
     measured off the tree the last example built. */
  function clockWire(z) {
    var M = CT.model(), t = M.tree;
    function leg(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
    var trunk = leg(t.root, t.levels[0][0]), branch = 0, leaf = 0, sinkLegs = 0;
    t.levels.forEach(function (lv, i) {
      if (!i) return;
      lv.forEach(function (n) { branch += leg(n.parent, n); });
    });
    M.clusters.forEach(function (c) {
      leaf += leg(c.parent, c);
      c.sinks.forEach(function (s) { sinkLegs += leg(c, M.sinks[s]); });
    });
    /* The drawn tree is a sample, and wire length does not scale with
       the count: pack four times as many sinks into the same area and
       each one is half as far from its buffer. Lengths therefore scale
       with the square root of the count, not the count. */
    var bufScale = Math.sqrt(M.buffers / M.drawnBuffers);
    var sinkScale = Math.sqrt(M.flops / M.sinks.length);
    return trunk + (branch + leaf) * bufScale + sinkLegs * sinkScale;
  }

  function model() {
    if (_M) return _M;
    var z = core().z, ms = core().ms;
    var pm = PL.model(), cm = CT.model();

    var holdBuffers = Math.round(cm.flops * 0.021 * 1.6);
    var nets = z.fg.nets + pm.rep.buffers + cm.buffers + holdBuffers;
    var insts = z.fg.cells + cm.buffers + holdBuffers;

    var clock = clockWire(z);
    var signal = pm.hpwl * 1.13;           /* Steiner branching plus detours */
    var total = signal + clock;

    /* where that wire lands: the lower layers carry the short local nets,
       the upper ones the long hauls and the clock */
    var share = { metal1: 0, metal2: 0.28, metal3: 0.34, metal4: 0.15, metal5: 0.12, metal6: 0.11 };
    var sup = layerSupply(z, ms);
    var layers = sup.map(function (s) {
      var demand = total * share[s.layer.name];
      return { name: s.layer.name, dir: s.layer.dir, tracks: s.tracks, raw: s.raw,
               blocked: s.blocked, why: s.why, owner: s.owner, routable: s.routable, supply: s.supply,
               demand: demand, usage: s.supply > 0 ? demand / s.supply : 0 };
    });

    /* The congestion field starts from the floorplan example's trial
       route, scaled by how much more wire routing actually has than that
       forecast assumed. The forecast ran on the synthesized netlist; the
       design has since gained the buffers placement inserted, a clock
       tree, and hold buffers, and a real route detours where a forecast
       drew straight lines. That growth is what turns a forecast with no
       bin over capacity into real local overflow. */
    var fc = FS.theForecasts().groute;
    var growth = total / fc.metrics.routedWL;
    var n = fc.ratio.length, iters = [];
    for (var k = 0; k <= 12; k++) {
      var ratio = new Float64Array(n), over = 0, peak = 0;
      for (var b = 0; b < n; b++) {
        var r0 = fc.ratio[b] * growth;
        /* rip up and reroute: what is over capacity comes down as the
           router pushes those nets into the space beside them */
        var relief = Math.pow(0.68, k);
        var r = r0 > 1
          ? 1 + (r0 - 1) * relief - 0.05 * (1 - relief)   /* pushed down past capacity */
          : r0 * (1 + 0.05 * (1 - relief));               /* into the space beside it */
        ratio[b] = r;
        if (r > 1) over += 1;
        if (r > peak) peak = r;
      }
      iters.push({ ratio: ratio, over: over, peak: peak });
    }

    /* ----- the close-up: a patch of the core, routed for real -----
       The die map above comes from the coarse forecast. That is no use
       for looking at individual nets, because the colour of a bin has
       nothing to do with the handful of nets you could draw in it. So
       the close-up runs its own small global router over a patch of the
       grid: a few dozen nets, a capacity per bin, and the same rip-up
       and reroute loop the real one uses. The colour of every bin is
       the demand of the nets drawn on it, so the two always agree. */
    var LOCAL = { w: 15, h: 19, cap: 6, nets: 56, passes: 9, show: 4 };

    function localRoute() {
      var W = LOCAL.w, H = LOCAL.h, N = W * H;
      function rnd(seed) { var x = Math.sin(seed * 19.37) * 8731.71; return x - Math.floor(x); }
      var seed = 11;

      /* the nets: a bundle crossing the middle, which is what makes a
         hot spot, plus local connections scattered around it */
      var nets = [];
      for (var i = 0; i < LOCAL.nets; i++) {
        var long = i % 2 === 0;
        var src, dst;
        if (long) {
          /* a bundle crossing the middle of the patch in a narrow band,
             which is what makes a hot spot in a real block too */
          var mid = (H >> 1);
          src = { x: Math.floor(rnd(seed++) * 2), y: mid - 3 + Math.floor(rnd(seed++) * 7) };
          dst = { x: W - 1 - Math.floor(rnd(seed++) * 2), y: mid - 3 + Math.floor(rnd(seed++) * 7) };
        } else {
          var cx = 2 + Math.floor(rnd(seed++) * (W - 4)), cy = 1 + Math.floor(rnd(seed++) * (H - 2));
          src = { x: cx, y: cy };
          dst = { x: Math.min(W - 1, Math.max(0, cx + Math.round((rnd(seed++) - 0.5) * 9))),
                  y: Math.min(H - 1, Math.max(0, cy + Math.round((rnd(seed++) - 0.5) * 9))) };
        }
        if (src.x === dst.x && src.y === dst.y) dst.x = (dst.x + 3) % W;
        nets.push({ id: i, src: src, dst: dst, cells: [] });
      }

      var usage = new Int32Array(N), hist = new Float64Array(N);

      function ripUp(net) { net.cells.forEach(function (c) { usage[c.y * W + c.x] -= 1; }); }
      function lay(net, path) {
        net.cells = path;
        path.forEach(function (c) { usage[c.y * W + c.x] += 1; });
      }

      /* PathFinder's cost: what a bin costs now, plus what it has cost
         in every pass so far, so a bin that keeps overflowing gets
         steadily more expensive and the nets spread off it */
      function makeCost(pf) {
        return function (x, y) {
          var b = y * W + x, over = Math.max(0, usage[b] + 1 - LOCAL.cap);
          return (1 + hist[b]) * (1 + pf * over);
        };
      }

      function route(net, cost) {
        var dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1);
        var seen = new Uint8Array(N);
        var s = net.src.y * W + net.src.x;
        dist[s] = cost(net.src.x, net.src.y);
        for (var n = 0; n < N; n++) {
          var u = -1, bd = Infinity;
          for (var k = 0; k < N; k++) if (!seen[k] && dist[k] < bd) { bd = dist[k]; u = k; }
          if (u < 0) break;
          seen[u] = 1;
          if (u === net.dst.y * W + net.dst.x) break;
          var ux = u % W, uy = (u / W) | 0;
          [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
            var vx = ux + d[0], vy = uy + d[1];
            if (vx < 0 || vy < 0 || vx >= W || vy >= H) return;
            var v = vy * W + vx, nd = dist[u] + cost(vx, vy);
            if (nd < dist[v]) { dist[v] = nd; prev[v] = u; }
          });
        }
        var path = [], cur = net.dst.y * W + net.dst.x;
        while (cur >= 0) { path.push({ x: cur % W, y: (cur / W) | 0 }); cur = prev[cur]; }
        return path.reverse();
      }

      function snapshot(pass) {
        var ratio = new Float64Array(N), over = 0, peak = 0, bins = 0;
        for (var b = 0; b < N; b++) {
          ratio[b] = usage[b] / LOCAL.cap;
          if (usage[b] > LOCAL.cap) over += 1;
          if (ratio[b] > peak) peak = ratio[b];
          bins += usage[b];
        }
        return {
          pass: pass, ratio: ratio, over: over, peak: peak, bins: bins,
          all: nets.map(function (net) { return net.cells.slice(); }),
          shown: nets.slice(0, LOCAL.show).map(function (net) {
            var o = 0;
            net.cells.forEach(function (c) { if (usage[c.y * W + c.x] > LOCAL.cap) o += 1; });
            return { key: "n" + net.id, cells: net.cells.slice(), src: net.src, dst: net.dst,
                     bins: net.cells.length, over: o };
          }),
        };
      }

      /* pass 0: every net takes its shortest path, congestion and all */
      var frames = [];
      nets.forEach(function (net) { lay(net, route(net, makeCost(0))); });
      frames.push(snapshot(0));

      /* then rip up and reroute, with the price of a full bin climbing */
      var pf = [0.35, 0.7, 1.4, 2.8, 5, 9, 15, 24];
      for (var pass = 1; pass <= pf.length; pass++) {
        for (var b2 = 0; b2 < N; b2++) if (usage[b2] > LOCAL.cap) hist[b2] += 0.22 * (usage[b2] - LOCAL.cap);
        var cost = makeCost(pf[pass - 1]);
        nets.forEach(function (net) { ripUp(net); lay(net, route(net, cost)); });
        frames.push(snapshot(pass));
      }
      return { frames: frames, nets: nets.length };
    }

    var local = localRoute();

    var vias = Math.round(insts * 7.6);
    var antennaNets = Math.round(nets * 0.0016);

    /* The global router counts in grid cells, not micrometers: a layer's
       resource is the number of tracks crossing each boundary between
       neighbouring cells, summed over the grid, and a net's demand is the
       boundaries it crosses. The ratio is the same either way, which is
       why the percentages match the millimetre table. */
    var bin = fc.die.bw, nx = fc.die.nx, ny = fc.die.ny;
    layers.forEach(function (l) {
      var horiz = l.dir === "horizontal";
      var edges = horiz ? (nx - 1) * ny : nx * (ny - 1);
      l.gRes = Math.round(edges * (bin / FS.LAYER_BY[l.name].pitch));
      l.gDer = Math.round(l.gRes * (1 - l.blocked));
      l.gDem = Math.round(l.demand / bin);
      l.gCut = 100 * l.blocked;
      l.usage = l.gDer > 0 ? l.gDem / l.gDer : 0;      /* one source of truth */
    });

    /* what the router calls a blockage: every obstruction shape it has to
       route around, which here is the memories and the power grid */
    var pdnModel = core().pdn;
    var stripes = ["m4", "m5"].reduce(function (a, k) {
      return a + (pdnModel[k] ? pdnModel[k].VDD.length + pdnModel[k].VSS.length : 0);
    }, 0);
    var blockages = ms.length * 4 + stripes + 16;        /* macro layers, stripes, the ring */
    var grtVias = Math.round(vias * 0.9);
    var usage3D = layers.reduce(function (a, l) { return a + l.gDem; }, 0) + grtVias;

    _M = {
      z: z, ms: ms, nets: nets, insts: insts, clockNets: cm.nets, holdBuffers: holdBuffers,
      wire: { signal: signal, clock: clock, total: total, hpwl: pm.hpwl },
      layers: layers, iters: iters, fc: fc, growth: growth,
      local: local, LOCAL: LOCAL,
      vias: vias, antennaNets: antennaNets,
      blockages: blockages, grtVias: grtVias, usage3D: usage3D, bin: bin,
      maxDegree: CT.OPT.clusterSize + 1,
      pins: pinScene(), route: routeScene(), fill: fillScene(),
      drt: [
        { it: 0, viol: Math.round(insts * 0.11), wire: total * 1.012 },
        { it: 1, viol: Math.round(insts * 0.0033), wire: total * 1.004 },
        { it: 2, viol: Math.round(insts * 0.0001), wire: total * 1.001 },
        { it: 3, viol: 0, wire: total },
      ],
      cts: cm,
    };
    return _M;
  }

  /* ================= drawing ================= */

  /* the per-layer supply table, used by step 1 and step 7 */
  function layerTable(M, withDemand) {
    var head = "<tr><th>Layer</th><th>Direction</th><th>Tracks</th><th>Track length available</th>" +
      (withDemand ? "<th>Wire on it</th><th>Usage</th>" : "<th>Not available</th>") + "</tr>";
    var rows = M.layers.map(function (l) {
      var cells = "<td><code>" + l.name + "</code></td><td>" + l.dir + "</td><td>" + fmt(l.tracks) + "</td>" +
        "<td>" + fmt(Math.round(l.supply / 1000)) + " millimeters</td>";
      cells += withDemand
        ? "<td>" + fmt(Math.round(l.demand / 1000)) + " millimeters</td><td>" + (l.usage * 100).toFixed(1) + "%</td>"
        : "<td>" + (l.blocked * 100).toFixed(0) + "%</td>";
      return "<tr>" + cells + "</tr>";
    }).join("");
    return '<table class="ff-table">' + head + rows + "</table>";
  }

  /* ----- step 1: the metal stack, seen from the side -----
     A cut through the chip: silicon and the cells at the bottom, then
     every routing layer above it, metal1 up to metal6. Each layer is
     drawn at its own thickness and its own track pitch, so the trade
     the stack makes is visible: the low layers are thin and finely
     pitched, the high ones are thick and coarse. A layer that runs into
     the page shows as the cut ends of its wires, one square per track;
     a layer that runs across the page shows as dashes, because you are
     looking along the length of those wires. */
  var SZ = { x0: 150, x1: 742, umWide: 12, gap: 22, top: 94, memEdge: 4.0, pdnAt: 8.6 };

  /* who owns each track of a layer, at a given place in the slice */
  function ownerAt(layer, xUm, k) {
    var L = FS.LAYER_BY[layer.name];
    var overMemory = xUm < SZ.memEdge;
    /* over the memory, everything up to metal4 is the memory's own */
    if (overMemory && L.name !== "metal5" && L.name !== "metal6") return "memory";
    /* metal1 carries the power rails that run along every row, two of them
       per row height, and the cells' own wiring in between */
    if (L.name === "metal1") {
      var perRow = Math.max(3, Math.round(FS.ROW_H / L.pitch));
      return (k % perRow) < 2 ? "power" : "cell";
    }
    /* The grid's vertical stripes are on metal4, so this slice cuts one of
       them, and the via stack that carries it down to the metal1 rails
       blocks the signal layers it passes through. The metal5 stripes run
       the other way and the slice passes between them. */
    var onStripe = Math.abs(xUm - SZ.pdnAt) < FS.PDN.stripeWidth / 2;
    if (onStripe && (L.name === "metal2" || L.name === "metal3" || L.name === "metal4")) return "power";
    /* pins and vias take a track here and there on every layer */
    var r = Math.sin((k + 1) * 12.9898 + L.pitch * 78.233) * 43758.5453;
    return (r - Math.floor(r)) < 0.08 ? "via" : "free";
  }

  function stackFigure(M) {
    var scale = (SZ.x1 - SZ.x0) / SZ.umWide;
    /* a layer's drawn thickness is its real wire width times the aspect
       ratio these wires are built at, so the stack thickens the way it
       really does: metal1 and metal2 at 0.07 micrometers wide, metal3
       and metal4 at 0.14, metal5 and metal6 at 0.28 */
    var thick = M.layers.map(function (l) {
      return Math.max(8, 2 * FS.LAYER_BY[l.name].width * scale);
    });
    var rows = [], y = SZ.top;
    for (var i = M.layers.length - 1; i >= 0; i--) {       /* metal6 first: top of the stack */
      rows.push({ l: M.layers[i], y: y, h: thick[i] });
      y += thick[i] + SZ.gap;
    }
    var subY = y + 6, H = subY + 80;
    function X(um) { return SZ.x0 + um * scale; }
    var o = ['<svg viewBox="0 0 ' + (SZ.x1 + 262) + " " + H + '" class="ff3-svg rt-stack" role="img" ' +
             'aria-label="A cut through the chip past the edge of a memory and through one stripe of ' +
             'the power grid: the six routing layers stacked over the silicon, with every track ' +
             'coloured by whether the router may use it">'];
    o.push('<text class="ff3-cap" x="12" y="20">a cut through ' + SZ.umWide +
           " micrometers of the chip, looking side on: metal1 at the bottom, metal6 at the top</text>");
    o.push('<text class="ff3-cap" x="12" y="38">every layer is drawn to scale: its real wire width, ' +
           "its real thickness, and its real track pitch</text>");
    o.push('<text class="ff3-cap" x="12" y="54">it runs past the edge of a memory, on the left, and ' +
           "through one metal4 stripe of the power grid</text>");
    o.push('<text class="ff3-cap" x="12" y="70">that stripe drops through a via stack to the power ' +
           "rails on metal1, which run along every row of cells</text>");

    /* the memory's own space, all the way up through metal3 */
    var memTop = rows[2].y - 4;      /* the memory owns metal4 downward */
    o.push('<rect class="rt-st-memzone" x="' + SZ.x0 + '" y="' + memTop + '" width="' + (X(SZ.memEdge) - SZ.x0) +
           '" height="' + (subY + 42 - memTop) + '" rx="3"/>');
    o.push('<text class="rt-st-zone" x="' + ((SZ.x0 + X(SZ.memEdge)) / 2) + '" y="' + (memTop - 6) + '">Memory A</text>');
    /* the power stripe, all the way up from metal4 */
    var pdnTop = rows[2].y - 4, pdnBot = rows[5].y + rows[5].h + 4;
    o.push('<rect class="rt-st-pdnzone" x="' + (X(SZ.pdnAt - FS.PDN.stripeWidth / 2) - 3).toFixed(1) + '" y="' + pdnTop +
           '" width="' + (FS.PDN.stripeWidth * scale + 6).toFixed(1) + '" height="' + (pdnBot - pdnTop) + '" rx="3"/>');
    o.push('<text class="rt-st-zone" x="' + X(SZ.pdnAt).toFixed(1) + '" y="' + (pdnTop - 6) + '">power grid</text>');

    rows.forEach(function (r) {
      var L = FS.LAYER_BY[r.l.name], pitchPx = L.pitch * scale;
      var intoPage = L.dir === "vertical";     /* the cut runs left to right */
      o.push('<rect class="rt-st-slab" x="' + SZ.x0 + '" y="' + r.y + '" width="' + (SZ.x1 - SZ.x0) +
             '" height="' + r.h + '" rx="2"/>');
      var n = Math.floor((SZ.x1 - SZ.x0) / pitchPx);
      for (var k = 0; k <= n; k++) {
        var x = SZ.x0 + 2 + k * pitchPx;
        if (x > SZ.x1 - 3) break;
        /* a wire seen end on is drawn at its real width; one seen along its
           length is a dash, whose length says nothing, so it is kept under
           the pitch to stay separate from its neighbour */
        var w = intoPage ? Math.max(2, L.width * scale) : pitchPx * 0.85;
        var own = ownerAt(r.l, (x + w / 2 - SZ.x0) / scale, k);
        var inset = Math.min(3, r.h * 0.2), mh = r.h - 2 * inset;
        /* a wire seen along its length is drawn with rounded ends, so it
           reads as running away from you rather than being cut through */
        o.push('<rect class="rt-st-w rt-st-' + own + '" x="' + x.toFixed(1) + '" y="' + (r.y + inset).toFixed(1) +
               '" width="' + w.toFixed(1) + '" height="' + mh.toFixed(1) +
               '" rx="' + (intoPage ? 0.6 : mh / 2).toFixed(1) + '"/>');
      }
      o.push('<text class="rt-st-lay" x="' + (SZ.x0 - 14) + '" y="' + (r.y + r.h / 2 - 1) + '">' + r.l.name + "</text>");
      o.push('<text class="rt-st-sub" x="' + (SZ.x0 - 14) + '" y="' + (r.y + r.h / 2 + 12) + '">' +
             (intoPage ? "runs into the page" : "runs across the page") + "</text>");
      o.push('<text class="rt-st-val" x="' + (SZ.x1 + 10) + '" y="' + (r.y + r.h / 2 - 1) + '">' +
             (r.l.routable ? fmt(Math.round(r.l.supply / 1000)) + " mm usable" : "not for routing") + "</text>");
      o.push('<text class="rt-st-sub2" x="' + (SZ.x1 + 10) + '" y="' + (r.y + r.h / 2 + 12) + '">' +
             fmt(r.l.tracks) + " tracks, " + L.width + " um wide, " + L.pitch + " um pitch</text>");
    });

    /* the power via stack: the metal4 stripe down to the metal1 rails */
    for (var pv = 2; pv < rows.length - 1; pv++) {
      o.push('<rect class="rt-st-pvia" x="' + (X(SZ.pdnAt) - 4).toFixed(1) + '" y="' + (rows[pv].y + rows[pv].h) +
             '" width="8" height="' + (rows[pv + 1].y - rows[pv].y - rows[pv].h) + '"/>');
    }

    /* vias, stitching the layers a single connection climbs */
    [0.30, 0.55, 0.80].forEach(function (f, j) {
      var vx = SZ.x0 + (SZ.x1 - SZ.x0) * f;
      for (var i = 0; i < rows.length - 1 - j; i++) {
        var a = rows[i], b = rows[i + 1];
        o.push('<rect class="rt-st-via" x="' + (vx - 3).toFixed(1) + '" y="' + (a.y + a.h) +
               '" width="6" height="' + (b.y - a.y - a.h) + '"/>');
      }
    });

    /* the silicon: the memory on the left, standard cells to the right of it */
    o.push('<rect class="rt-st-sub-band" x="' + SZ.x0 + '" y="' + subY + '" width="' + (SZ.x1 - SZ.x0) +
           '" height="42" rx="3"/>');
    o.push('<text class="rt-st-lay" x="' + (SZ.x0 - 14) + '" y="' + (subY + 20) + '">silicon</text>');
    o.push('<text class="rt-st-sub" x="' + (SZ.x0 - 14) + '" y="' + (subY + 33) + '">the transistors themselves</text>');
    o.push('<rect class="rt-st-macro" x="' + (SZ.x0 + 4) + '" y="' + (subY + 8) + '" width="' +
           (X(SZ.memEdge) - SZ.x0 - 10).toFixed(1) + '" height="26" rx="2"/>');
    var c0 = X(SZ.memEdge) + 10, cw = (SZ.x1 - c0 - 14) / 5;
    for (var c = 0; c < 5; c++) {
      o.push('<rect class="rt-st-cell" x="' + (c0 + c * cw).toFixed(1) + '" y="' + (subY + 10) +
             '" width="' + (cw - 12).toFixed(1) + '" height="22" rx="2"/>');
    }
    o.push('<text class="rt-st-why" x="' + (SZ.x1 - 4) + '" y="' + (subY + 60) +
           '">a standard cell is about 0.6 micrometers wide here</text>');
    o.push("</svg>");

    return o.join("") +
      '<div class="ff3-legend">' +
      '<span><i class="pl-sw rt-sw-free"></i>a track the router may use</span>' +
      '<span><i class="pl-sw rt-sw-mem"></i>the memory\'s own wiring: metal1 to metal4 over its area</span>' +
      '<span><i class="pl-sw rt-sw-pwr"></i>the power grid: the metal1 rails, one metal4 stripe, ' +
      'and the via stack between them</span>' +
      '<span><i class="pl-sw rt-sw-cellw"></i>the cells\' pins and internal wiring, the rest of metal1</span>' +
      '<span><i class="pl-sw rt-sw-via2"></i>taken by a pin connection or a via landing there</span></div>';
  }

  /* ----- step 3: the congestion map, iteration by iteration ----- */
  function congestionFigure(M) {
    var it0 = M.iters[0];
    return plan(core(), {
      macros: true, halos: true, pins: true,
      heat: { die: M.fc.die, ratio: it0.ratio }, heatClass: "rt-bin",
      aria: "Routing congestion over the core, as demand divided by the tracks available, " +
            "relieved iteration by iteration",
    }) +
      '<div class="gp-readout" id="rt-readout">' +
      '<span>iteration <b id="rt-iter">0</b> of ' + OPT.congIters + " allowed</span>" +
      '<span>bins over capacity <b id="rt-over">' + it0.over + "</b> of " + M.fc.ratio.length + "</span>" +
      '<span>worst bin <b id="rt-peak">' + Math.round(it0.peak * 100) + "%</b></span>" +
      '<button class="ff-reset" type="button" id="rt-replay">replay</button></div>' +
      '<div class="ff3-legend"><span>each square is a ' + f1(M.fc.die.bw) +
      " by " + f1(M.fc.die.bh) + " micrometer bin, coloured by the wire it wants divided by the wire " +
      "it can hold: green from 50%, amber near 100%, red above</span></div>";
  }

  /* The close-up. Its own routing problem, run properly: every bin is
     coloured by what the nets drawn on it demand, so the colour and the
     corridors can never disagree. A guide is not a wire, so each net is
     drawn as translucent tiles with a dashed edge and a dashed spine. */
  var CZ = { cell: 30, ox: 22, oy: 74 };
  var NET_KEYS = ["a", "b", "c", "d"];

  /* The die map hides anything under half capacity, which is right for a
     whole core. Here every bin holds a handful of nets, so a lightly
     used bin still has to be visible: pale blue up to half capacity,
     then the same green-amber-red the map uses. */
  /* Nets that share a bin are drawn a little apart inside it, so a bin
     with twenty nets in it looks like twenty lines rather than one. */
  function jit(i, show) {
    if (i < show) return { dx: -9 + i * 6, dy: -9 + i * 6 };
    var a = Math.sin((i + 1) * 12.9898) * 43758.5453, b = Math.sin((i + 1) * 78.233) * 12345.6789;
    return { dx: ((a - Math.floor(a)) - 0.5) * 22, dy: ((b - Math.floor(b)) - 0.5) * 22 };
  }

  /* 0th, 1st, 2nd, 3rd: the way the detailed router numbers its passes */
  function ordinal(n) {
    var suffix = n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th";
    return n + suffix;
  }

  function binColor(r) {
    if (r <= 0) return "rgba(0,0,0,0)";
    if (r < 0.5) return "rgba(37, 99, 235, " + (0.07 + 0.30 * (r / 0.5)).toFixed(3) + ")";
    return FS.heatColor(r);
  }

  function corridorFigure(M) {
    var L = M.LOCAL, f0 = M.local.frames[0];
    var W = L.w * CZ.cell + 2 * CZ.ox, H = L.h * CZ.cell + CZ.oy + 168;
    function bx(x) { return CZ.ox + x * CZ.cell; }
    function by(y) { return CZ.oy + y * CZ.cell; }
    var o = ['<svg viewBox="0 0 ' + W + " " + H + '" class="ff3-svg rt-corr" role="img" ' +
             'aria-label="A patch of ' + L.w + " by " + L.h + ' routing bins with ' + L.nets +
             ' nets routed through it, four of them drawn as corridors of bins, rerouted pass by ' +
             'pass until no bin is over capacity">'];
    o.push('<text class="ff3-cap" x="12" y="20">' + L.w + " by " + L.h + " bins, " +
           Math.round(L.w * M.bin) + " by " + Math.round(L.h * M.bin) + " micrometers, " + L.nets +
           " nets, " + L.cap + " tracks per bin</text>");
    o.push('<text class="ff3-cap" x="12" y="38">the colour is what those nets demand of each bin</text>');
    o.push('<text class="ff3-cap rt-say" x="12" y="58" id="rt-corrsay">every net is drawn; four of ' +
           "them are picked out in colour</text>");

    for (var y = 0; y < L.h; y++) {
      for (var x = 0; x < L.w; x++) {
        o.push('<rect class="rt-cbin" data-cbin="' + x + "-" + y + '" x="' + bx(x) + '" y="' + by(y) +
               '" width="' + CZ.cell + '" height="' + CZ.cell + '" fill="' +
               binColor(f0.ratio[y * L.w + x]) + '"/>');
      }
    }
    /* only the bins a shown net ever uses need a tile */
    f0.shown.forEach(function (net, i) {
      var seen = {};
      M.local.frames.forEach(function (fr) {
        fr.shown[i].cells.forEach(function (c) { seen[c.x + "-" + c.y] = 1; });
      });
      var inset = 2.5 + i * 3.2, k = NET_KEYS[i];
      Object.keys(seen).forEach(function (key) {
        var p = key.split("-");
        o.push('<rect class="rt-guide rt-guide-' + k + '" data-g="' + i + "-" + key + '" x="' +
               (bx(+p[0]) + inset).toFixed(1) + '" y="' + (by(+p[1]) + inset).toFixed(1) +
               '" width="' + (CZ.cell - 2 * inset).toFixed(1) + '" height="' + (CZ.cell - 2 * inset).toFixed(1) +
               '" rx="2" style="display:none"/>');
      });
    });
    /* every other net, thin and grey, so that no bin is ever coloured
       by something you cannot see */
    f0.all.forEach(function (cells, i) {
      if (i < L.show) return;
      var j = jit(i, L.show);
      o.push('<polyline class="rt-rest" id="rt-rest-' + i + '" points="' +
             cells.map(function (c) {
               return (bx(c.x) + CZ.cell / 2 + j.dx).toFixed(1) + "," +
                      (by(c.y) + CZ.cell / 2 + j.dy).toFixed(1);
             }).join(" ") + '"/>');
    });
    f0.shown.forEach(function (net, i) {
      var ji = jit(i, L.show);
      o.push('<polyline class="rt-gline rt-gline-' + NET_KEYS[i] + '" id="rt-gl-' + i + '" points="' +
             net.cells.map(function (c) {
               return (bx(c.x) + CZ.cell / 2 + ji.dx).toFixed(1) + "," +
                      (by(c.y) + CZ.cell / 2 + ji.dy).toFixed(1);
             }).join(" ") + '"/>');
      [net.src, net.dst].forEach(function (e) {
        /* a net runs from a cell to a cell: the endpoints are drawn as
           cells, even though at this scale a cell is smaller than a dot */
        o.push('<rect class="rt-endcell" x="' + (bx(e.x) + CZ.cell / 2 - 7) + '" y="' +
               (by(e.y) + CZ.cell / 2 - 5) + '" width="14" height="10" rx="1.5"/>');
        o.push('<circle class="rt-corr-pin rt-pin-' + NET_KEYS[i] + '" cx="' + (bx(e.x) + CZ.cell / 2) +
               '" cy="' + (by(e.y) + CZ.cell / 2) + '" r="3"/>');
      });
    });
    /* one bin, blown up: the cells the corridors are actually joining */
    var iy = CZ.oy + L.h * CZ.cell + 26, isz = 116, ix = CZ.ox;
    var perBin = M.z.fg.cells / M.z.coreArea * M.bin * M.bin;
    var rowsPerBin = Math.round(M.bin / FS.ROW_H);
    o.push('<rect class="rt-inset" x="' + ix + '" y="' + iy + '" width="' + isz + '" height="' + isz + '"/>');
    var rh = isz / rowsPerBin;
    for (var r = 0; r < rowsPerBin; r++) {
      var cxp = ix + 1.5;
      var seed = r * 7 + 3;
      while (cxp < ix + isz - 3) {
        var jr = Math.sin(seed++ * 17.13) * 9371.7;
        var cw = 4 + (jr - Math.floor(jr)) * 9;
        if (cxp + cw > ix + isz - 2) break;
        o.push('<rect class="rt-inset-cell" x="' + cxp.toFixed(1) + '" y="' + (iy + r * rh + 1).toFixed(1) +
               '" width="' + cw.toFixed(1) + '" height="' + (rh - 2).toFixed(1) + '"/>');
        cxp += cw + 1.6;
      }
    }
    o.push('<text class="rt-inset-lab" x="' + (ix + isz + 14) + '" y="' + (iy + 16) + '">one bin, ' +
           f1(M.bin) + " by " + f1(M.bin) + " micrometers</text>");
    o.push('<text class="rt-inset-sub" x="' + (ix + isz + 14) + '" y="' + (iy + 36) + '">about ' +
           Math.round(perBin) + " standard cells, in " + rowsPerBin + " rows</text>");
    o.push('<text class="rt-inset-sub" x="' + (ix + isz + 14) + '" y="' + (iy + 58) +
           '">every net above runs from one of these cells to another;</text>');
    o.push('<text class="rt-inset-sub" x="' + (ix + isz + 14) + '" y="' + (iy + 76) +
           '">the grid is too coarse to draw them, which is the point of</text>');
    o.push('<text class="rt-inset-sub" x="' + (ix + isz + 14) + '" y="' + (iy + 94) +
           '">routing in bins first and in metal later</text>');
    o.push("</svg>");
    return o.join("") +
      '<div class="gp-readout" id="rt-corrread">' +
      '<span>pass <b id="rt-corrpass">0</b></span>' +
      '<span>bins over capacity <b id="rt-corrover">' + f0.over + "</b> of " + (L.w * L.h) + "</span>" +
      '<span>worst bin <b id="rt-corrpeak">' + Math.round(f0.peak * 100) + "%</b></span>" +
      '<span>total guide, all ' + L.nets + ' nets <b id="rt-corrlen">' + f0.bins + "</b> bins</span></div>" +
      '<div class="ff3-legend">' +
      NET_KEYS.map(function (k, i) {
        return '<span><i class="pl-sw rt-sw-g' + k + '"></i>net ' + (i + 1) + "'s guide</span>";
      }).join("") +
      '<span><i class="pl-sw rt-sw-rest"></i>the other ' + (L.nets - L.show) + " nets in the patch</span>" +
      "<span>a guide is a corridor of bins, not metal: the detailed router draws the wire inside it " +
      "two steps from now</span></div>";
  }

  function congestionAnimate(M) {
    var root = document.getElementById("flow-fig-3");
    if (!root) return;
    var bins = root.querySelectorAll(".rt-bin");
    if (!bins.length) return;
    var iterEl = document.getElementById("rt-iter");
    var overEl = document.getElementById("rt-over");
    var peakEl = document.getElementById("rt-peak");
    var replay = document.getElementById("rt-replay");
    var timer = null, LAST = 8;

    var cbins = root.querySelectorAll(".rt-cbin");
    var gTiles = root.querySelectorAll(".rt-guide");
    var lenEl = document.getElementById("rt-corrlen");
    var passEl = document.getElementById("rt-corrpass");
    var peak2El = document.getElementById("rt-corrpeak");
    var cOverEl = document.getElementById("rt-corrover");
    var corrSay = document.getElementById("rt-corrsay");

    function draw(k) {
      var it = M.iters[k];
      bins.forEach(function (el) {
        var b = +el.getAttribute("data-bin");
        el.setAttribute("fill", FS.heatColor(it.ratio[b]));
      });
      if (iterEl) iterEl.textContent = String(k);
      if (overEl) overEl.textContent = fmt(it.over);
      if (peakEl) peakEl.textContent = Math.round(it.peak * 100) + "%";

      /* the close-up: its own routing problem, at the same pass */
      var L = M.LOCAL, fr = M.local.frames[Math.min(k, M.local.frames.length - 1)];
      cbins.forEach(function (el) {
        var p = el.getAttribute("data-cbin").split("-");
        el.setAttribute("fill", binColor(fr.ratio[+p[1] * L.w + +p[0]]));
      });
      var want = {};
      fr.shown.forEach(function (net, i) {
        net.cells.forEach(function (c) { want[i + "-" + c.x + "-" + c.y] = 1; });
        var line = document.getElementById("rt-gl-" + i);
        if (line) {
          var ji = jit(i, L.show);
          line.setAttribute("points", net.cells.map(function (c) {
            return (CZ.ox + (c.x + 0.5) * CZ.cell + ji.dx).toFixed(1) + "," +
                   (CZ.oy + (c.y + 0.5) * CZ.cell + ji.dy).toFixed(1);
          }).join(" "));
        }
      });
      gTiles.forEach(function (el) {
        el.style.display = want[el.getAttribute("data-g")] ? "" : "none";
      });
      fr.all.forEach(function (cells, i) {
        if (i < L.show) return;
        var el = document.getElementById("rt-rest-" + i);
        if (!el) return;
        var j = jit(i, L.show);
        el.setAttribute("points", cells.map(function (c) {
          return (CZ.ox + (c.x + 0.5) * CZ.cell + j.dx).toFixed(1) + "," +
                 (CZ.oy + (c.y + 0.5) * CZ.cell + j.dy).toFixed(1);
        }).join(" "));
      });
      if (passEl) passEl.textContent = String(fr.pass);
      if (lenEl) lenEl.textContent = String(fr.bins);
      if (cOverEl) cOverEl.textContent = String(fr.over);
      if (peak2El) peak2El.textContent = Math.round(fr.peak * 100) + "%";
      if (corrSay) {
        var first = M.local.frames[0];
        corrSay.textContent = fr.over > 0
          ? "pass " + fr.pass + ": " + fr.over + " bins over capacity, worst " +
            Math.round(fr.peak * 100) + "%, and those nets get ripped up"
          : "pass " + fr.pass + ": nothing over capacity, bought with " +
            (100 * (fr.bins / first.bins - 1)).toFixed(1) + "% more wire";
      }
    }

    function play() {
      if (timer) clearInterval(timer);
      var k = 0;
      draw(0);
      timer = setInterval(function () {
        k += 1;
        draw(k);
        if (k >= LAST) { clearInterval(timer); timer = null; }
      }, 620);
    }

    if (replay && !replay.dataset.wired) {
      replay.dataset.wired = "1";
      replay.addEventListener("click", play);
    }
    play();
  }

  /* ----- step 2: how the router reaches a pin -----
     A close-up of one cell row. Each pin is a small shape on metal1, and
     the router can only enter it where a via can legally land: on a
     metal2 track, clear of its neighbours. Those are its access points. */
  var PZ = { ox: 52, oy: 84, px: 52, rows: 3, umWide: 12.4, railTracks: 1 };

  /* ----- step 2: where a via may land on a pin -----
     A patch of three cell rows, drawn on the real grid: metal2 tracks
     running up the page, metal1 tracks running across it. A pin is a
     shape on metal1, and the router may only enter it where a via can
     sit on a crossing of the two grids, clear of everything around it.
     Those crossings are the pin's access points. */
  function pinScene() {
    function rnd(seed) { var x = Math.sin(seed * 33.77) * 12731.13; return x - Math.floor(x); }
    var v = FS.LAYER_BY["metal2"].pitch, h = FS.LAYER_BY["metal1"].pitch;
    var perRow = Math.max(4, Math.round(FS.ROW_H / h));      /* metal1 tracks in one row */
    var names = ["NAND2_X1", "INV_X2", "DFF_X1", "AOI21_X2", "BUF_X2", "NAND3_X1", "OAI21_X1", "XOR2_X1"];
    var seed = 3, rows = [];
    for (var r = 0; r < PZ.rows; r++) {
      var cells = [], x = v;
      while (true) {
        var w = Math.round((1.5 + rnd(seed++) * 1.8) / v) * v;
        if (x + w > PZ.umWide - v) break;
        var pins = [], np = 2 + Math.round(rnd(seed++));
        for (var p = 0; p < np; p++) {
          /* the pin shape: one or two metal2 tracks wide, three metal1
             tracks tall, sitting on the grid inside its cell */
          var t0 = Math.round((x + (p + 0.7) * (w - v) / np) / v);
          var wide = rnd(seed++) < 0.4 ? 2 : 1;
          var rowTop = r * FS.ROW_H;
          var ty = 1 + Math.floor(rnd(seed++) * (perRow - 4));      /* clear of the rails */
          var pts = [];
          for (var i = 0; i < wide; i++) {
            for (var j = 0; j < 3; j++) {
              /* a point is ruled out when a neighbouring shape or the
                 cell's own internal wiring is too close to it */
              pts.push({ x: (t0 + i) * v, y: rowTop + (ty + j) * h, blocked: rnd(seed++) < 0.34 });
            }
          }
          if (pts.every(function (q) { return q.blocked; })) pts[Math.floor(pts.length / 2)].blocked = false;
          pins.push({ x: t0 * v, w: wide * v, y: rowTop + ty * h, h: 3 * h,
                      name: ["A", "B", "Z"][p], pts: pts });
        }
        cells.push({ x: x, w: w, row: r, pins: pins, master: names[(cells.length + r * 3) % names.length] });
        x += w + v;
      }
      rows.push(cells);
    }
    return { rows: rows, v: v, h: h, perRow: perRow, width: PZ.umWide, height: PZ.rows * FS.ROW_H };
  }

  function pinFigure(M) {
    var sc = M.pins, px = PZ.px, ox = PZ.ox, oy = PZ.oy;
    function X(u) { return ox + u * px; }
    function Y(u) { return oy + u * px; }
    var W = X(sc.width) + 30, H = Y(sc.height) + 44;
    var o = ['<svg viewBox="0 0 ' + W.toFixed(0) + " " + H.toFixed(0) + '" class="ff3-svg rt-pin" role="img" ' +
             'aria-label="Three rows of standard cells on the routing grid, with the crossings where ' +
             'the router may drop a via onto each pin">'];
    o.push('<text class="ff3-cap" x="12" y="20">' + PZ.rows + " rows of cells, " + f1(sc.width) +
           " by " + f1(sc.height) + " micrometers, on the grid the router has to use</text>");
    o.push('<text class="ff3-cap" x="12" y="38">metal2 runs up the page every ' + sc.v +
           " micrometers, metal1 runs across it every " + sc.h + "</text>");
    o.push('<text class="ff3-cap rt-say" x="12" y="60" id="rt-pinsay">a via may only sit where the two ' +
           "grids cross, inside a pin, and clear of everything around it</text>");

    /* the grid itself */
    for (var t = 0; t * sc.v <= sc.width; t++) {
      o.push('<line class="rt-track" x1="' + X(t * sc.v).toFixed(1) + '" y1="' + Y(0) + '" x2="' +
             X(t * sc.v).toFixed(1) + '" y2="' + Y(sc.height).toFixed(1) + '"/>');
    }
    for (var u = 0; u * sc.h <= sc.height; u++) {
      o.push('<line class="rt-track rt-track-h" x1="' + X(0) + '" y1="' + Y(u * sc.h).toFixed(1) + '" x2="' +
             X(sc.width).toFixed(1) + '" y2="' + Y(u * sc.h).toFixed(1) + '"/>');
    }
    /* the rows, and the power rails that bound them */
    sc.rows.forEach(function (cells, r) {
      var y0 = r * FS.ROW_H;
      o.push('<rect class="' + (r % 2 ? "ff3-row-fs" : "ff3-row-n") + '" x="' + X(0) + '" y="' + Y(y0).toFixed(1) +
             '" width="' + (sc.width * px).toFixed(1) + '" height="' + (FS.ROW_H * px).toFixed(1) + '"/>');
      [y0, y0 + FS.ROW_H].forEach(function (ry) {
        o.push('<rect class="rt-rail" x="' + X(0) + '" y="' + (Y(ry) - 2.5).toFixed(1) + '" width="' +
               (sc.width * px).toFixed(1) + '" height="5"/>');
      });
      cells.forEach(function (c, i) {
        o.push('<rect class="rt-cell" x="' + X(c.x).toFixed(1) + '" y="' + (Y(y0) + 5).toFixed(1) +
               '" width="' + (c.w * px).toFixed(1) + '" height="' + (FS.ROW_H * px - 10).toFixed(1) + '"/>');
        o.push('<text class="rt-cellname" x="' + X(c.x + c.w / 2).toFixed(1) + '" y="' +
               (Y(y0 + FS.ROW_H) - 6).toFixed(1) + '">' + c.master + "</text>");
        c.pins.forEach(function (p, j) {
          o.push('<rect class="rt-pinshape" x="' + X(p.x - sc.v * 0.5).toFixed(1) + '" y="' +
                 Y(p.y - sc.h * 0.55).toFixed(1) + '" width="' + ((p.w - sc.v * 0.1) * px).toFixed(1) +
                 '" height="' + ((p.h + sc.h * 0.1) * px).toFixed(1) + '" rx="1.5"/>');
          p.pts.forEach(function (q, k) {
            o.push('<circle class="rt-ap' + (q.blocked ? " rt-ap-bad" : "") + '" data-ap="' + r + "-" + i + "-" + j +
                   '" cx="' + X(q.x).toFixed(1) + '" cy="' + Y(q.y).toFixed(1) + '" r="2.9" style="display:none"/>');
          });
        });
      });
    });
    o.push("</svg>");

    var pinCount = 0, apCount = 0;
    sc.rows.forEach(function (cells) {
      cells.forEach(function (c) {
        pinCount += c.pins.length;
        c.pins.forEach(function (p) { apCount += p.pts.length; });
      });
    });
    return o.join("") +
      '<div class="gp-readout" id="rt-pinread">' +
      '<span>pins examined <b id="rt-pins">0</b> of ' + pinCount + "</span>" +
      '<span>access points found <b id="rt-aps">0</b></span>' +
      '<span>ruled out by a neighbour <b id="rt-apbad">0</b></span>' +
      '<button class="ff-reset" type="button" id="rt-pinreplay">replay</button></div>' +
      '<div class="ff3-legend">' +
      '<span><i class="pl-sw rt-sw-cell"></i>a standard cell</span>' +
      '<span><i class="pl-sw rt-sw-pin"></i>its pin shape, on metal1</span>' +
      '<span><i class="pl-sw rt-sw-rail"></i>the power rails, which bound every row</span>' +
      '<span><i class="pl-sw rt-sw-ap"></i>an access point the router may use</span>' +
      '<span><i class="pl-sw rt-sw-apbad"></i>a crossing a neighbouring shape rules out</span></div>';
  }

  function pinAnimate(M) {
    var root = document.getElementById("flow-fig-2");
    if (!root) return;
    var aps = [].slice.call(root.querySelectorAll(".rt-ap"));
    if (!aps.length) return;
    var pinsEl = document.getElementById("rt-pins");
    var apsEl = document.getElementById("rt-aps");
    var badEl = document.getElementById("rt-apbad");
    var sayEl = document.getElementById("rt-pinsay");
    var replay = document.getElementById("rt-pinreplay");
    var timers = [];
    var pinCount = 0;
    M.pins.rows.forEach(function (cells) {
      cells.forEach(function (c) { pinCount += c.pins.length; });
    });

    function play() {
      timers.forEach(clearTimeout);
      timers = [];
      aps.forEach(function (el) { el.style.display = "none"; });
      [pinsEl, apsEl, badEl].forEach(function (el) { if (el) el.textContent = "0"; });
      if (sayEl) sayEl.textContent = "the vertical lines are metal2 tracks: the only places a via may land";
      /* group the points by the pin they belong to, and light up one pin
         at a time, the way the analysis walks the design */
      var groups = [], byKey = {};
      aps.forEach(function (el) {
        var key = el.getAttribute("data-ap");
        if (!byKey[key]) { byKey[key] = []; groups.push(byKey[key]); }
        byKey[key].push(el);
      });
      var good = 0, bad = 0;
      groups.forEach(function (g, i) {
        timers.push(setTimeout(function () {
          g.forEach(function (el) {
            el.style.display = "";
            if (el.classList.contains("rt-ap-bad")) bad += 1; else good += 1;
          });
          if (pinsEl) pinsEl.textContent = String(i + 1);
          if (apsEl) apsEl.textContent = String(good);
          if (badEl) badEl.textContent = String(bad);
          if (i === groups.length - 1 && sayEl) {
            sayEl.textContent = "every pin kept at least one usable point, so every pin can be reached: " +
              good + " usable and " + bad + " ruled out, across " + pinCount + " pins";
          }
        }, 260 + i * 110));
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
    n: 1, title: "Start from the clock tree", button: "Load the design", againLabel: "Load again",
    line: "Read the placed and clocked design, and take stock of what can carry a wire.",
    intro:
      '<p>Everything so far has been positions. The design arrives from the ' +
      '<a href="/explore/examples/cts">clock tree example</a> with every cell on a site and every ' +
      "buffer in a tree, and every delay quoted so far has come from an estimate of a wire that does " +
      "not exist. This stage draws the metal.</p>" +
      "<p>Before it starts, look at what there is to draw on. The technology file gives each layer a " +
      "direction and a track pitch, and those two numbers set how much wire a layer can hold: a " +
      "horizontal layer has one track every pitch up the core, and each track is as long as the core is " +
      "wide. Some of that is already spoken for. The memories own the lower layers over their own " +
      "footprint, and the power grid owns stripes of the upper ones.</p>",
    command:
      "read_db tile4m_cts.odb\n" +
      "read_sdc tile4m.sdc",
    commandNote:
      "The layer ranges were set back at floorplanning, with <code>set_routing_layers -signal " +
      OPT.signalLo + "-" + OPT.signalHi + " -clock " + OPT.clockLo + "-" + OPT.clockHi + "</code>, and " +
      "they still apply. The clock arrives propagated from the previous stage; every stage script after " +
      "clock tree synthesis asserts <code>set_propagated_clock</code> again before it uses the timer, " +
      "which in this stage happens in step 4.",
    run: function () {
      var M = model();
      return {
        log: [
          { k: "cmd", t: "read_db tile4m_cts.odb" },
          { k: "out", t: "  " + fmt(M.insts) + " instances, " + fmt(M.nets) + " nets" },
          { k: "out", t: "  " + fmt(M.clockNets) + " clock nets, carrying a double-spacing rule from clock tree synthesis" },
          { k: "cmd", t: "read_sdc tile4m.sdc" },
          { k: "out", t: "  clk is propagated: " + (M.cts.t.mean * 1000).toFixed(0) + " picoseconds of insertion delay, " +
                         (M.cts.t.skew * 1000).toFixed(0) + " picoseconds of skew" },
          { k: "ok", t: "Design loaded. Nothing is routed yet." },
        ],
        figure: '<p class="ff3-figtext">The picture below is a cut through the chip, ten micrometers ' +
          "wide, seen from the side. The transistors are in the silicon at the bottom, and the six " +
          "routing layers are stacked above them, metal1 first and metal6 on top. Each layer is drawn " +
          "at its real thickness and its real track pitch, so you can see the trade the stack makes: " +
          "metal2 is thin with a track every " + FS.LAYER_BY["metal2"].pitch + " micrometers, metal6 is " +
          "thick with a track every " + FS.LAYER_BY["metal6"].pitch + ", which means fewer wires fit " +
          "but each one is faster. A layer running into the page shows as the cut ends of its wires, " +
          "one square per track; a layer running across the page shows as dashes, because you are " +
          "looking along their length. Every track is coloured by who owns it. Blue is free for the " +
          "router. Grey is the memory on the left, which owns metal1 to metal4 over its own area and " +
          "nothing above that. Red is the stripe of the power grid this slice cuts through. Green is " +
          "the cells' own wiring, which is all of metal1 outside the memory. Copper is a track a pin " +
          "connection or a via has landed on. What is left in blue is the supply the rest of this " +
          "stage spends.</p>" + stackFigure(M),
        report: "<h3>What there is to route, and where</h3>" + table([
          ["Nets to route", fmt(M.nets) + ", of which " + fmt(M.clockNets) + " are clock nets"],
          ["Instances", fmt(M.insts) + ", every one of them legal"],
          ["Signal layers", OPT.signalLo + " to " + OPT.signalHi],
          ["Clock layers", OPT.clockLo + " to " + OPT.clockHi + ", with double spacing on the upper tree levels"],
          ["metal1", "not for routing here: it belongs to the cells and their pins"],
        ]) + "<h3>Track supply, layer by layer</h3>" + layerTable(M, false) + checks([
          ["Supply is a length, not an area.",
           "A layer holds as much wire as it has track length. " + M.layers[2].name + ", for example, has " +
           fmt(M.layers[2].tracks) + " tracks across the core, each " + f1(M.z.coreW) + " micrometers long, which is " +
           fmt(Math.round(M.layers[2].raw / 1000)) + " millimeters of possible wire. What the router " +
           "cannot use is what something else already occupies."],
          ["Direction alternates for a reason.",
           "Neighbouring layers run at right angles, so a wire that needs to turn changes layer through a " +
           "via. That is why a route looks like a staircase, and why via count matters as much as wirelength."],
          ["The clock arrives with a rule attached.",
           "Clock tree synthesis marked its nets with a double-spacing non-default rule and the floorplan " +
           "confined them to " + OPT.clockLo + " through " + OPT.clockHi + ". The router has to satisfy both, " +
           "which is why the clock is usually routed before anything else competes for that space."],
        ]),
      };
    },
  });

  STEPS.push({
    n: 2, title: "Work out how to reach every pin", button: "Find the access points", againLabel: "Find again",
    line: "Before any wire is drawn, find the legal places a via can land on each pin.",
    intro:
      "<p>A route has to end somewhere, and that somewhere is a pin: a small shape on metal1 inside a " +
      "standard cell. The router cannot simply touch it. It has to drop a via onto it, and the via has " +
      "to sit on a metal2 track, fit inside the pin shape, and keep its distance from every other shape " +
      "nearby, including the neighbouring cell's pins and its own cell's internal wiring.</p>" +
      "<p>The set of places where all of that is true is the pin's <strong>access points</strong>. " +
      "Computing them for every pin in the design is the first thing the detailed router does, and it " +
      "is run here, before global routing, so that a pin nobody can reach is discovered now rather than " +
      "after hours of routing.</p>",
    command: "pin_access",
    commandNote:
      "This is the detailed router's own pin analysis, exposed as its own command, and the reference " +
      "flow calls it at the start of global routing for exactly the reason above. It takes optional " +
      "flags, <code>-db_process_node</code> and <code>-via_in_pin_bottom_layer</code> and " +
      "<code>-via_in_pin_top_layer</code>, which the script passes only when the platform defines them; " +
      "this one does not, so the command runs bare. A pin with no access point is not a routing " +
      "problem, it is a placement problem, and the cheapest time to learn that is before a single wire " +
      "exists.",
    run: function () {
      var M = model();
      var pinsTotal = Math.round(M.insts * 4.1);
      return {
        log: [
          { k: "cmd", t: "pin_access" },
          { k: "out", t: "  [INFO DRT-0165] Start pin access." },
          { k: "out", t: "  [INFO DRT-0164] Number of unique instances = 138." },
          { k: "out", t: "  [INFO DRT-0076]   Complete " + fmt(pinsTotal) + " pins." },
          { k: "out", t: "  [INFO DRT-0166] Complete pin access." },
          { k: "ok", t: "Every pin has at least one legal way in." },
        ],
        figure: pinFigure(M),
        after: function () { pinAnimate(M); },
        report: "<h3>Pin access</h3>" + table([
          ["Pins analysed", fmt(pinsTotal) + ", across " + fmt(M.insts) + " instances"],
          ["Unique cell types", "138: the analysis is done once per master, then reused"],
          ["Pins with no access point", "0"],
          ["Layers involved", "metal1 for the pin shape, metal2 for the via that reaches it"],
        ]) + checks([
          ["This is where an advanced node hurts.",
           "At older nodes a pin was wide enough that a via could land almost anywhere on it. At seven " +
           "nanometres a pin may be one or two tracks wide, so a pin has a handful of access points and " +
           "a neighbour's wire can remove most of them."],
          ["It is done per cell type, not per instance.",
           "Access points are a property of the master's geometry, so the analysis runs once for each of " +
           "the 138 distinct cells in the design and the result is reused at every instance. What differs " +
           "per instance is what is nearby, which is why the router still checks the neighbourhood."],
          ["A pin with no access is a placement bug.",
           "If two cells abut in a way that leaves a pin unreachable, no amount of routing effort fixes " +
           "it. That is what the placement padding set in the previous examples is for: one site of " +
           "clearance on each side, bought precisely to keep pins reachable."],
        ]),
      };
    },
  });

  STEPS.push({
    n: 3, title: "Route it roughly, everywhere at once", button: "Global route", againLabel: "Route again",
    line: "Assign every net a corridor, and iterate until no corridor is over capacity.",
    intro:
      "<p>Global routing does not draw wires. It divides the core into bins, works out which bins each " +
      "net must pass through, and checks whether the wire wanted in each bin fits in the tracks that bin " +
      "has. Where it does not fit, it reroutes some of those nets through neighbouring bins and tries " +
      "again. What it produces is a <strong>guide</strong> for each net: the corridor the detailed " +
      "router must stay inside.</p>" +
      "<p>The floorplan example forecast this same map before any cell was placed, and found no bin over " +
      "capacity. Routing has more wire than that forecast assumed: placement added " +
      fmt(PL.model().rep.buffers) + " buffers, clock tree synthesis added a tree, and a real route " +
      "detours where a forecast drew straight lines. The result is local overflow that the forecast " +
      "smoothed over, and watching it clear is watching the router do its job.</p>",
    command: function () {
      return "global_route -congestion_report_file reports/congestion.rpt -congestion_iterations " +
        OPT.congIters + " -congestion_report_iter_step " + OPT.drcIterStep + " -verbose";
    },
    commandNote:
      "<code>-congestion_iterations</code> is how many times it may rip up and reroute before giving " +
      "up; the command's own default is 50 and the reference flow uses 30. " +
      "<code>-congestion_report_iter_step " + OPT.drcIterStep + "</code> is part of that flow's default " +
      "arguments: it writes the congestion map to a file every " + OPT.drcIterStep + " iterations, which " +
      "is where the two progress lines below come from. If the router exhausts its iterations with " +
      "congestion left it fails, rather than producing guides the detailed router cannot honour, unless " +
      "you pass <code>-allow_congestion</code> and take responsibility for what follows.",
    run: function () {
      var M = model(), last = M.iters[8], it0 = M.iters[0];
      var conv = 0;
      for (var i = 0; i < M.iters.length; i++) { if (M.iters[i].over === 0) { conv = i; break; } }
      /* the tool prints plain numbers in fixed columns, so do the same */
      var pad = function (t, n) { return String(t).padStart(n); };
      var col = function (name, a, b, c, d) {
        return String(name).padEnd(11) + pad(a, 12) + pad(b, 14) + pad(c, 14) + (d === undefined ? "" : pad(d, 22));
      };
      var resHead = [
        " ".repeat(11) + pad("Routing", 12) + pad("Original", 14) + pad("Derated", 14),
        col("Layer", "Direction", "Resources", "Resources") + "  Reduction (%)",
        "-".repeat(66),
      ];
      var resRows = M.layers.map(function (l) {
        return col(l.name, l.dir === "horizontal" ? "Horizontal" : "Vertical", l.gRes, l.gDer) +
          pad(l.gCut.toFixed(2) + "%", 15);
      });
      var totDer = 0, totDem = 0;
      M.layers.forEach(function (l) { totDer += l.gDer; totDem += l.gDem; });
      var congHead = [
        col("Layer", "Resource", "Demand", "Usage (%)", "Max H / Max V / Total"),
        "-".repeat(73),
      ];
      var congRows = M.layers.map(function (l) {
        return col(l.name, l.gDer, l.gDem, (l.usage * 100).toFixed(2) + "%", "0 /  0 /  0");
      });
      var pitchLines = M.layers.map(function (l) {
        var P = FS.LAYER_BY[l.name].pitch.toFixed(4);
        return { k: "out", t: "[INFO GRT-0088] Layer " + l.name.padEnd(8) + "Track-Pitch = " + P +
                              "  line-2-Via Pitch: " + P };
      });
      function outs(list) { return list.map(function (t) { return { k: "out", t: t }; }); }

      return {
        log: [
          { k: "cmd", t: "global_route -congestion_report_file reports/congestion.rpt -congestion_iterations " + OPT.congIters + " -congestion_report_iter_step " + OPT.drcIterStep + " -verbose" },
        ].concat(outs([
          "[INFO GRT-0020] Min routing layer: " + OPT.signalLo,
          "[INFO GRT-0021] Max routing layer: " + OPT.signalHi,
          "[INFO GRT-0022] Global adjustment: 0%",
          "[INFO GRT-0023] Grid origin: (0, 0)",
        ])).concat(pitchLines).concat(outs([
          "[INFO GRT-0003] Macros: " + M.ms.length,
          "[INFO GRT-0004] Blockages: " + M.blockages,
          "[INFO GRT-0019] Found " + M.clockNets + " clock nets.",
          "[INFO GRT-0001] Minimum degree: 2",
          "[INFO GRT-0002] Maximum degree: " + M.maxDegree,
          "[INFO GRT-0053] Routing resources analysis:",
        ])).concat(outs(resHead)).concat(outs(resRows)).concat(outs([
          "-".repeat(66),
          "[INFO GRT-0101] Running extra iterations to remove congestion.",
          "  congestion report, iteration 0: " + it0.over + " of " + M.fc.ratio.length +
            " bins over capacity, worst " + Math.round(it0.peak * 100) + "%",
          "  congestion report, iteration " + conv + ": none over capacity, worst " +
            Math.round(M.iters[conv].peak * 100) + "%",
          "[INFO GRT-0197] Via related to pin nodes: " + Math.round(M.grtVias * 0.97),
          "[INFO GRT-0198] Via related Steiner nodes: " + Math.round(M.grtVias * 0.03),
          "[INFO GRT-0199] Via filling finished.",
          "[INFO GRT-0111] Final number of vias: " + M.grtVias,
          "[INFO GRT-0112] Final usage 3D: " + M.usage3D,
          "[INFO GRT-0096] Final congestion report:",
        ])).concat(outs(congHead)).concat(outs(congRows)).concat(outs([
          "-".repeat(73),
          col("Total", totDer, totDem, (100 * totDem / totDer).toFixed(2) + "%", "0 /  0 /  0"),
          "[INFO GRT-0018] Total wirelength: " + Math.round(M.wire.total) + " um",
          "[INFO GRT-0014] Routed nets: " + M.nets,
          "[INFO GRT-0303] Global routing runtime = 00:00:37",
        ])).concat([
          { k: "ok", t: "Congestion resolved after " + conv + " of " + OPT.congIters +
                        " allowed iterations. Every net has a corridor." },
        ]),
        figure: '<p class="ff3-figtext">The map below is the core divided into ' + M.fc.ratio.length +
          " bins. Each one is coloured by the wire the router wants to put through it divided by the " +
          "wire its tracks can hold, so green is comfortable, amber is close, and red is over capacity " +
          "and has to be fixed before the detailed router ever sees it. Press play and watch the red " +
          "clear: on every iteration the router rips up the nets crossing an overfull bin and sends " +
          "some of them through the space beside it.</p>" +
          congestionFigure(M) +
          '<p class="ff3-figtext">The map is the whole core, so no individual net is visible in it. ' +
          "Below is the same job at a scale where they are: a patch of " + M.LOCAL.w + " by " + M.LOCAL.h +
          " bins, " + fmt(Math.round(M.LOCAL.w * M.bin)) + " by " + fmt(Math.round(M.LOCAL.h * M.bin)) +
          " micrometers, with " + M.LOCAL.nets + " nets routed through it and " + M.LOCAL.cap +
          " tracks of capacity in every bin. This one is routed properly, net by net, so the colour of " +
          "a bin is exactly what the nets on it demand, and every one of those nets is drawn: four " +
          "picked out in colour, the other " + (M.LOCAL.nets - 4) + " as thin grey lines. Nothing " +
          "colours a bin that you cannot see going through it.</p>" +
          '<p class="ff3-figtext">What is drawn is not wire. A guide is the list of bins a net may ' +
          "use, so each one is translucent tiles with a dashed edge and a dashed spine, nested so that " +
          "two nets sharing a bin both stay visible. On the first pass every net takes its shortest " +
          "path and the middle of the patch goes red. After that each pass rips them all up and " +
          "reroutes them with a full bin priced higher than an empty one, and the price climbs every " +
          "pass until nothing is over capacity. Watch what it costs: the total guide length goes up " +
          "while the overflow comes down, and that trade is the whole of global routing.</p>" +
          corridorFigure(M),
        after: function () { congestionAnimate(M); },
        report: "<h3>Where the wire went</h3>" + layerTable(M, true) + checks([
          ["An average of a few percent, and still a red bin.",
           "No layer is above " + (Math.max.apply(null, M.layers.map(function (l) { return l.usage; })) * 100).toFixed(0) +
           "% used across the whole core, and yet the worst bin started at " + Math.round(it0.peak * 100) +
           "%. Congestion is always local. A design-wide usage number tells you almost nothing, which is " +
           "why the map exists and why the congestion report is written to a file you can load in the " +
           "layout viewer."],
          ["The clock is a quarter of the wire.",
           fmt(Math.round(M.wire.clock)) + " of the " + fmt(Math.round(M.wire.total)) +
           " micrometers is the clock tree, for " + fmt(M.cts.flops) + " flip-flops. That is normal for a " +
           "design this full of registers, and it is why the upper layers were reserved for it."],
          ["Guides, not wires.",
           "What this step produced is one corridor per net. Nothing here obeys a spacing rule yet, " +
           "nothing is on an exact track, and no via exists. The detailed router's job is to realise " +
           "these corridors as legal metal, and its job is much easier because they exist."],
        ]),
      };
    },
  });

  /* ----- step 4: how good the wire estimate is, at each stage ----- */
  /* ----- step 4: one net, as the estimate improves and the fix lands -----
     The same net all the way through: first as placement guessed it, a
     straight line between the pins; then as the guide actually runs;
     then after the driver is resized and a buffer split the wire; then
     legalized and rerouted. The slack meter tracks the block's worst
     path underneath it. */
  var R4 = { W: 760, H: 282, rowY: 168, rowH: 34, x0: 76, x1: 690, slackY: 232 };

  function repairNumbers() {
    var w = FS.wireRC("metal3");
    var straight = PL.model().rep.longest;
    var routed = straight * 1.13;
    return {
      w: w, straight: straight, routed: routed,
      cStraight: straight * w.c, cRouted: routed * w.c,
      cExtract: routed * w.c * 1.18,
      cWireload: straight * w.c * 0.5,
      slack: { before: 0.20, after: 0.14, fixed: 0.17 },
    };
  }

  function repairFigure(M) {
    var n = repairNumbers();
    var o = ['<svg viewBox="0 0 ' + R4.W + " " + R4.H + '" class="ff3-svg rt-rep" role="img" ' +
             'aria-label="One net drawn as a straight line, then as the corridor the router chose, ' +
             'then after a buffer is inserted, legalized and rerouted, with the block\'s worst slack ' +
             'tracked underneath">'];
    o.push('<text class="ff3-cap" x="12" y="20">the block\'s longest net, ' + f1(n.straight) +
           " micrometers between its pins, and the worst slack in the block underneath it</text>");
    o.push('<text class="ff3-cap rt-say" x="12" y="40" id="rt4-say">press play</text>');

    /* the row the cells sit on */
    o.push('<rect class="ff3-row-n" x="' + (R4.x0 - 40) + '" y="' + R4.rowY + '" width="' +
           (R4.x1 - R4.x0 + 80) + '" height="' + R4.rowH + '"/>');
    o.push('<rect class="rt4-cell" id="rt4-drv" x="' + (R4.x0 - 34) + '" y="' + (R4.rowY + 5) +
           '" width="30" height="' + (R4.rowH - 10) + '" rx="2"/>');
    o.push('<text class="rt4-lab" id="rt4-drvlab" x="' + (R4.x0 - 19) + '" y="' + (R4.rowY + R4.rowH + 15) +
           '">BUF_X2</text>');
    o.push('<rect class="rt4-cell" x="' + (R4.x1 + 4) + '" y="' + (R4.rowY + 5) +
           '" width="30" height="' + (R4.rowH - 10) + '" rx="2"/>');
    o.push('<text class="rt4-lab" x="' + (R4.x1 + 19) + '" y="' + (R4.rowY + R4.rowH + 15) + '">load</text>');

    /* the net: a straight line to begin with */
    o.push('<polyline class="rt4-net" id="rt4-net" points="' + R4.x0 + "," + (R4.rowY + R4.rowH / 2) +
           " " + R4.x1 + "," + (R4.rowY + R4.rowH / 2) + '"/>');
    o.push('<rect class="rt4-buf" id="rt4-buf" x="' + ((R4.x0 + R4.x1) / 2 - 15) + '" y="' + (R4.rowY - 38) +
           '" width="30" height="' + (R4.rowH - 10) + '" rx="2" style="display:none"/>');
    o.push('<text class="rt4-lab" id="rt4-buflab" x="' + ((R4.x0 + R4.x1) / 2) + '" y="' + (R4.rowY - 44) +
           '" style="display:none">BUF_X4</text>');

    /* what the estimate says about this net */
    o.push('<text class="rt4-num" id="rt4-num" x="' + R4.x0 + '" y="' + (R4.rowY - 72) + '">' +
           f1(n.straight) + " micrometers, " + f1(n.cStraight) + " femtofarads</text>");
    o.push('<text class="rt4-sub" id="rt4-sub" x="' + R4.x0 + '" y="' + (R4.rowY - 54) +
           '">the straight line between the pins, which is all placement knew</text>');

    /* the slack meter */
    var sw = R4.x1 - R4.x0;
    o.push('<text class="rt4-sub" x="' + R4.x0 + '" y="' + (R4.slackY + 32) +
           '">worst slack in the block, against the ' + FS.DESIGN.clockPeriodNs.toFixed(1) +
           " nanosecond clock</text>");
    o.push('<rect class="rt4-track" x="' + R4.x0 + '" y="' + R4.slackY + '" width="' + sw + '" height="16" rx="8"/>');
    o.push('<rect class="rt4-fill rt4-good" id="rt4-slack" x="' + R4.x0 + '" y="' + R4.slackY +
           '" width="' + (sw * n.slack.before / 0.25).toFixed(1) + '" height="16" rx="8"/>');
    o.push('<text class="rt4-num" id="rt4-slackval" x="' + (R4.x1 + 8) + '" y="' + (R4.slackY + 13) + '">' +
           n.slack.before.toFixed(2) + " ns</text>");
    o.push("</svg>");
    return o.join("") +
      '<div class="ff-actions"><button class="ff-reset" type="button" id="rt4-replay">replay</button></div>' +
      '<div class="ff3-legend">' +
      '<span><i class="pl-sw rt4-sw-net"></i>the net, as the flow currently believes it runs</span>' +
      '<span><i class="pl-sw rt4-sw-cell"></i>the cells it connects</span>' +
      '<span><i class="pl-sw rt4-sw-buf"></i>a cell the repair added</span></div>';
  }

  function repairAnimate(M) {
    var root = document.getElementById("flow-fig-4");
    if (!root) return;
    var net = document.getElementById("rt4-net");
    if (!net) return;
    var n = repairNumbers();
    var say = document.getElementById("rt4-say");
    var num = document.getElementById("rt4-num");
    var sub = document.getElementById("rt4-sub");
    var drv = document.getElementById("rt4-drv");
    var drvlab = document.getElementById("rt4-drvlab");
    var buf = document.getElementById("rt4-buf");
    var buflab = document.getElementById("rt4-buflab");
    var slack = document.getElementById("rt4-slack");
    var slackval = document.getElementById("rt4-slackval");
    var replay = document.getElementById("rt4-replay");
    var timers = [];
    function later(ms, fn) { timers.push(setTimeout(fn, ms)); }
    var mid = (R4.x0 + R4.x1) / 2, cy = R4.rowY + R4.rowH / 2;

    var STRAIGHT = R4.x0 + "," + cy + " " + R4.x1 + "," + cy;
    /* the guide: the same two pins, but the path the router actually took */
    var GUIDE = [
      [R4.x0, cy], [R4.x0 + 90, cy], [R4.x0 + 90, cy - 46], [mid + 40, cy - 46],
      [mid + 40, cy + 26], [R4.x1 - 70, cy + 26], [R4.x1 - 70, cy], [R4.x1, cy],
    ].map(function (p) { return p[0] + "," + p[1]; }).join(" ");
    /* after the buffer: the same corridor, but broken at the buffer */
    var VIABUF = [
      [R4.x0, cy], [R4.x0 + 90, cy], [R4.x0 + 90, cy - 46], [mid - 15, cy - 46], [mid, cy - 46],
      [mid + 15, cy - 46], [mid + 40, cy - 46], [mid + 40, cy + 26], [R4.x1 - 70, cy + 26],
      [R4.x1 - 70, cy], [R4.x1, cy],
    ].map(function (p) { return p[0] + "," + p[1]; }).join(" ");
    var REROUTED = [
      [R4.x0, cy], [R4.x0 + 90, cy], [R4.x0 + 90, cy - 18], [mid - 15, cy - 18], [mid - 15, cy],
      [mid + 15, cy], [mid + 15, cy + 26], [R4.x1 - 70, cy + 26], [R4.x1 - 70, cy], [R4.x1, cy],
    ].map(function (p) { return p[0] + "," + p[1]; }).join(" ");

    function setSlack(v, cls) {
      var sw = R4.x1 - R4.x0;
      slack.setAttribute("width", Math.max(2, sw * v / 0.25).toFixed(1));
      slack.setAttribute("class", "rt4-fill " + cls);
      slackval.textContent = v.toFixed(2) + " ns";
    }

    function play() {
      timers.forEach(clearTimeout);
      timers = [];
      net.setAttribute("points", STRAIGHT);
      net.setAttribute("class", "rt4-net");
      drv.setAttribute("width", "30");
      drv.setAttribute("x", String(R4.x0 - 34));
      if (drvlab) drvlab.textContent = "BUF_X2";
      buf.style.display = "none";
      buflab.style.display = "none";
      buf.setAttribute("y", String(R4.rowY - 38));
      num.textContent = f1(n.straight) + " micrometers, " + f1(n.cStraight) + " femtofarads";
      sub.textContent = "the straight line between the pins, which is all placement knew";
      setSlack(n.slack.before, "rt4-good");
      if (say) say.textContent = "before this step: the flow believes this net is a straight line";

      later(1500, function () {
        net.setAttribute("points", GUIDE);
        net.setAttribute("class", "rt4-net rt4-net-real");
        num.textContent = f1(n.routed) + " micrometers, " + f1(n.cRouted) + " femtofarads";
        sub.textContent = "the corridor the global router actually chose, detours and all";
        setSlack(n.slack.after, "rt4-bad");
        if (say) say.textContent = "estimate_parasitics -global_routing: the wire is longer than anyone " +
          "assumed, and the worst slack in the block falls to " + n.slack.after.toFixed(2) + " ns";
      });
      later(3600, function () {
        drv.setAttribute("width", "44");
        drv.setAttribute("x", String(R4.x0 - 48));
        if (drvlab) drvlab.textContent = "BUF_X4";
        if (say) say.textContent = "repair_design: the driver is swapped for a stronger one, because " +
          "the load it has to charge is bigger than the load it was chosen for";
      });
      later(5200, function () {
        buf.style.display = "";
        buflab.style.display = "";
        net.setAttribute("points", VIABUF);
        num.textContent = "two wires of about " + f1(n.routed / 2) + " micrometers, " +
          f1(n.cRouted / 2) + " femtofarads each";
        sub.textContent = "a buffer in the middle halves the capacitance each driver has to charge";
        if (say) say.textContent = "repair_design: and a buffer is dropped into the middle of the net, " +
          "splitting one long wire into two short ones";
      });
      later(6800, function () {
        buf.setAttribute("y", String(R4.rowY + 5));
        buflab.setAttribute("y", String(R4.rowY + R4.rowH + 15));
        if (say) say.textContent = "detailed_placement: the new cell was sitting between rows, so it is " +
          "put on a legal site like everything else";
      });
      later(8300, function () {
        net.setAttribute("points", REROUTED);
        sub.textContent = "and the corridor now runs through the buffer's legal site";
        setSlack(n.slack.fixed, "rt4-good");
        if (say) say.textContent = "global_route -end_incremental: this net moved, so this net is " +
          "rerouted, and slack comes back to " + n.slack.fixed.toFixed(2) + " ns";
      });
    }

    if (replay && !replay.dataset.wired) {
      replay.dataset.wired = "1";
      replay.addEventListener("click", play);
    }
    play();
  }

  /* ----- step 5: what an antenna is, and what a diode does ----- */
  var AZ = { W: 720, H: 260 };

  function antennaFigure(M) {
    var W = AZ.W, H = AZ.H, wireY = 96, gateX = 600, dioX = 250;
    var o = ['<svg viewBox="0 0 ' + W + " " + H + '" class="ff3-svg rt-ant" role="img" ' +
             'aria-label="A long metal wire connected to a transistor gate, collecting charge during ' +
             'manufacture, and the diode that drains it">'];
    o.push('<text class="ff3-cap" x="12" y="20">one net, part way through manufacture: the metal2 ' +
           "length exists, the layer above it does not yet</text>");
    o.push('<text class="ff3-cap rt-say" x="12" y="38" id="rt-antsay">press play</text>');
    /* the substrate and the transistor at the end of the wire */
    o.push('<rect class="rt-ant-sub" x="20" y="' + (H - 66) + '" width="' + (W - 40) + '" height="34" rx="3"/>');
    o.push('<text class="rt-ant-lab" x="30" y="' + (H - 44) + '">silicon</text>');
    o.push('<rect class="rt-ant-gate" id="rt-gate" x="' + (gateX - 26) + '" y="' + (H - 108) + '" width="52" height="42" rx="2"/>');
    o.push('<text class="rt-ant-lab" x="' + (gateX + 34) + '" y="' + (H - 92) + '">gate oxide</text>');
    /* the wire: a long metal2 run ending on the gate */
    o.push('<line class="rt-ant-wire" x1="60" y1="' + wireY + '" x2="' + gateX + '" y2="' + wireY + '"/>');
    o.push('<line class="rt-ant-wire" x1="' + gateX + '" y1="' + wireY + '" x2="' + gateX + '" y2="' + (H - 108) + '"/>');
    o.push('<text class="rt-ant-lab" x="64" y="' + (wireY - 12) + '">metal2, the piece etched in this step</text>');
    /* the diode, hidden until it is inserted */
    o.push('<g id="rt-diode" style="display:none">' +
           '<line class="rt-ant-wire" x1="' + dioX + '" y1="' + wireY + '" x2="' + dioX + '" y2="' + (H - 96) + '"/>' +
           '<rect class="rt-ant-diode" x="' + (dioX - 22) + '" y="' + (H - 96) + '" width="44" height="30" rx="3"/>' +
           '<text class="rt-ant-lab" x="' + dioX + '" y="' + (H - 104) + '" text-anchor="middle">' +
           OPT.diode + "</text></g>");
    /* the charges */
    for (var i = 0; i < 12; i++) {
      var cx = 80 + i * ((gateX - 110) / 11);
      o.push('<circle class="rt-ant-q" data-q="' + i + '" cx="' + cx.toFixed(1) + '" cy="' + wireY +
             '" r="4" style="display:none"/>');
    }
    o.push("</svg>");
    return o.join("") +
      '<div class="gp-readout" id="rt-antread">' +
      '<span>antenna ratio <b id="rt-ratio">0</b></span>' +
      '<span>the rule allows <b>400</b></span>' +
      '<span>gate <b id="rt-gatest">intact</b></span>' +
      '<button class="ff-reset" type="button" id="rt-antreplay">replay</button></div>';
  }

  function antennaAnimate(M) {
    var root = document.getElementById("flow-fig-5");
    if (!root) return;
    var qs = [].slice.call(root.querySelectorAll(".rt-ant-q"));
    if (!qs.length) return;
    var gate = document.getElementById("rt-gate");
    var diode = document.getElementById("rt-diode");
    var say = document.getElementById("rt-antsay");
    var ratioEl = document.getElementById("rt-ratio");
    var stateEl = document.getElementById("rt-gatest");
    var replay = document.getElementById("rt-antreplay");
    var timers = [];
    function later(ms, fn) { timers.push(setTimeout(fn, ms)); }

    function play() {
      timers.forEach(clearTimeout);
      timers = [];
      qs.forEach(function (q) { q.style.display = "none"; q.classList.remove("rt-ant-q-drain"); });
      if (diode) diode.style.display = "none";
      if (gate) gate.classList.remove("rt-ant-gate-bad", "rt-ant-gate-ok");
      if (ratioEl) ratioEl.textContent = "0";
      if (stateEl) { stateEl.textContent = "intact"; stateEl.className = ""; }
      if (say) say.textContent = "the wire is etched in plasma, and the exposed metal collects charge";
      qs.forEach(function (q, i) {
        later(400 + i * 170, function () {
          q.style.display = "";
          if (ratioEl) ratioEl.textContent = fmt(Math.round(60 * (i + 1)));
        });
      });
      later(400 + qs.length * 170 + 300, function () {
        if (gate) gate.classList.add("rt-ant-gate-bad");
        if (stateEl) { stateEl.textContent = "stressed"; stateEl.className = "cts-h-bad"; }
        if (say) say.textContent = "the only path to ground is through the gate: ratio " +
          fmt(60 * qs.length) + " against a limit of 400, and the oxide is damaged";
      });
      later(400 + qs.length * 170 + 1600, function () {
        if (diode) diode.style.display = "";
        if (say) say.textContent = "repair_antennas adds a diode: a path into the silicon that " +
          "conducts once the voltage climbs";
      });
      later(400 + qs.length * 170 + 2600, function () {
        qs.forEach(function (q) { q.classList.add("rt-ant-q-drain"); });
        if (gate) { gate.classList.remove("rt-ant-gate-bad"); gate.classList.add("rt-ant-gate-ok"); }
        if (ratioEl) ratioEl.textContent = "0";
        if (stateEl) { stateEl.textContent = "safe"; stateEl.className = "cts-h-good"; }
        if (say) say.textContent = "the charge drains through the diode instead of the oxide, and " +
          "the net passes the rule";
      });
    }

    if (replay && !replay.dataset.wired) {
      replay.dataset.wired = "1";
      replay.addEventListener("click", play);
    }
    play();
  }

  /* ----- step 6: the detailed router, in a window a few micrometers across ----- */
  var DZ = { ox: 34, oy: 54, cols: 24, rows: 8, cw: 28, rh: 22 };

  function routeScene() {
    function rnd(seed) { var x = Math.sin(seed * 27.91) * 15731.7; return x - Math.floor(x); }
    var seed = 5, nets = [];
    for (var i = 0; i < 16; i++) {
      var c0 = 1 + Math.floor(rnd(seed++) * (DZ.cols - 3));
      var c1 = 1 + Math.floor(rnd(seed++) * (DZ.cols - 3));
      var r0 = Math.floor(rnd(seed++) * DZ.rows);
      var r1 = Math.floor(rnd(seed++) * DZ.rows);
      if (c0 === c1) c1 = (c1 + 3) % (DZ.cols - 2) + 1;
      nets.push({ c0: c0, c1: c1, r0: r0, r1: r1 });
    }
    /* Violations sit where two nets meet: one net's vertical leg crossing
       another's horizontal leg, which at this pitch is either a short or
       a spacing violation depending on how the shapes land. */
    var cross = [];
    nets.forEach(function (v, i) {
      nets.forEach(function (h, j) {
        if (i === j) return;
        var lo = Math.min(v.r0, v.r1), hi = Math.max(v.r0, v.r1);
        var cl = Math.min(h.c0, h.c1), ch = Math.max(h.c0, h.c1);
        if (h.r1 > lo && h.r1 < hi && v.c0 > cl && v.c0 < ch) cross.push({ col: v.c0, row: h.r1 });
      });
    });
    /* keep nine of them, each cleared at one of the first three passes */
    var viols = [], used = {};
    for (var k = 0; k < cross.length && viols.length < 9; k++) {
      var c = cross[Math.floor(rnd(seed++) * cross.length)];
      var key = c.col + ":" + c.row;
      if (used[key]) continue;
      used[key] = 1;
      viols.push({ col: c.col, row: c.row, fixed: 1 + Math.floor(rnd(seed++) * 3) });
    }
    return { nets: nets, viols: viols };
  }

  function routeFigure(M) {
    var sc = M.route, W = DZ.ox * 2 + DZ.cols * DZ.cw, H = DZ.oy + DZ.rows * DZ.rh + 34;
    function X(c) { return DZ.ox + c * DZ.cw; }
    function Y(r) { return DZ.oy + r * DZ.rh; }
    var o = ['<svg viewBox="0 0 ' + W + " " + H + '" class="ff3-svg rt-drt" role="img" ' +
             'aria-label="A few micrometers of the block: wires being placed on metal2 and metal3 ' +
             'tracks, with the spacing violations the router then clears">'];
    o.push('<text class="ff3-cap" x="12" y="20">a window of ' + DZ.cols + " vertical metal2 tracks and " +
           DZ.rows + " horizontal metal3 tracks</text>");
    o.push('<text class="ff3-cap rt-say" x="12" y="38" id="rt-drtsay">press play</text>');
    for (var c = 0; c < DZ.cols; c++) {
      o.push('<line class="rt-track" x1="' + X(c) + '" y1="' + Y(0) + '" x2="' + X(c) + '" y2="' + Y(DZ.rows - 1) + '"/>');
    }
    for (var r = 0; r < DZ.rows; r++) {
      o.push('<line class="rt-track rt-track-h" x1="' + X(0) + '" y1="' + Y(r) + '" x2="' + X(DZ.cols - 1) + '" y2="' + Y(r) + '"/>');
    }
    sc.nets.forEach(function (n, i) {
      o.push('<g class="rt-net" data-net="' + i + '" style="display:none">' +
             '<line class="rt-wire rt-wire-v" x1="' + X(n.c0) + '" y1="' + Y(n.r0) + '" x2="' + X(n.c0) + '" y2="' + Y(n.r1) + '"/>' +
             '<line class="rt-wire rt-wire-h" x1="' + X(n.c0) + '" y1="' + Y(n.r1) + '" x2="' + X(n.c1) + '" y2="' + Y(n.r1) + '"/>' +
             '<rect class="rt-via" x="' + (X(n.c0) - 3) + '" y="' + (Y(n.r1) - 3) + '" width="6" height="6"/>' +
             '<circle class="rt-pinend" cx="' + X(n.c0) + '" cy="' + Y(n.r0) + '" r="3.2"/>' +
             '<circle class="rt-pinend" cx="' + X(n.c1) + '" cy="' + Y(n.r1) + '" r="3.2"/>' +
             "</g>");
    });
    sc.viols.forEach(function (v, i) {
      o.push('<circle class="rt-viol" data-viol="' + i + '" data-fixed="' + v.fixed + '" cx="' + X(v.col) +
             '" cy="' + Y(v.row) + '" r="7" style="display:none"/>');
    });
    o.push("</svg>");
    return o.join("") +
      '<div class="gp-readout" id="rt-drtread">' +
      '<span>iteration <b id="rt-drtit">-</b></span>' +
      '<span>violations, whole design <b id="rt-drtviol">-</b></span>' +
      '<span>wire length <b id="rt-drtwire">-</b></span>' +
      '<button class="ff-reset" type="button" id="rt-drtreplay">replay</button></div>' +
      '<div class="ff3-legend">' +
      '<span><i class="pl-sw rt-sw-v"></i>metal2, vertical</span>' +
      '<span><i class="pl-sw rt-sw-h"></i>metal3, horizontal</span>' +
      '<span><i class="pl-sw rt-sw-via"></i>a via where a wire changes layer</span>' +
      '<span><i class="pl-sw rt-sw-end"></i>a pin the route has to reach</span>' +
      '<span><i class="pl-sw rt-sw-viol"></i>a spacing or shorting violation the next iteration must clear</span></div>';
  }

  function routeAnimate(M) {
    var root = document.getElementById("flow-fig-6");
    if (!root) return;
    var nets = [].slice.call(root.querySelectorAll(".rt-net"));
    var viols = [].slice.call(root.querySelectorAll(".rt-viol"));
    if (!nets.length) return;
    var itEl = document.getElementById("rt-drtit");
    var vEl = document.getElementById("rt-drtviol");
    var wEl = document.getElementById("rt-drtwire");
    var say = document.getElementById("rt-drtsay");
    var replay = document.getElementById("rt-drtreplay");
    var timers = [];
    function later(ms, fn) { timers.push(setTimeout(fn, ms)); }

    function play() {
      timers.forEach(clearTimeout);
      timers = [];
      nets.forEach(function (g) { g.style.display = "none"; });
      viols.forEach(function (v) { v.style.display = "none"; });
      if (itEl) itEl.textContent = "-";
      if (vEl) vEl.textContent = "-";
      if (wEl) wEl.textContent = "-";
      if (say) say.textContent = "track assignment first: every wire is put on an exact track";
      nets.forEach(function (g, i) { later(300 + i * 90, function () { g.style.display = ""; }); });

      var base = 300 + nets.length * 90 + 400;
      M.drt.forEach(function (d, k) {
        later(base + k * 1500, function () {
          if (itEl) itEl.textContent = String(d.it);
          if (vEl) vEl.textContent = fmt(d.viol);
          if (wEl) wEl.textContent = fmt(Math.round(d.wire)) + " micrometers";
          viols.forEach(function (v) {
            var fixedAt = +v.getAttribute("data-fixed");
            v.style.display = d.it < fixedAt ? "" : "none";
          });
          if (say) {
            say.textContent = d.viol === 0
              ? "iteration " + d.it + ": no violations left, and the design is routed"
              : "iteration " + d.it + ": " + fmt(d.viol) + " violations in the design, ripped up and " +
                "rerouted with each one remembered as a cost";
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

  /* ----- step 7: filling the gaps between cells -----
     A few rows, close up. The cells are where routing left them, with
     gaps between them, and every gap is a break in the power rail that
     runs along the row. Fillers close them, widest first, because the
     tool would rather place one wide cell than eight narrow ones. */
  var FZ = { rows: 4, umWide: 26, px: 24, ox: 24, oy: 66, pitch: 34, cellH: 22 };
  var FILL_SIZES = [32, 16, 8, 4, 2, 1];

  function fillScene() {
    function rnd(seed) { var x = Math.sin(seed * 51.19) * 13721.53; return x - Math.floor(x); }
    var site = FS.SITE_W, seed = 5, rows = [], gaps = [];
    for (var r = 0; r < FZ.rows; r++) {
      var cells = [], x = 0;
      while (true) {
        var w = Math.round((0.6 + rnd(seed++) * 2.0) / site) * site;
        if (x + w > FZ.umWide) break;
        cells.push({ x: x, w: w });
        x += w;
        /* most cells abut; now and then routing left a gap */
        if (rnd(seed++) < 0.42) {
          var sites = 1 + Math.floor(rnd(seed++) * 11);
          var gw = sites * site;
          if (x + gw < FZ.umWide) {
            /* the tool closes a gap with the widest filler that fits, then
               the next widest, down to a single site */
            var parts = [], left = sites, gx = x;
            FILL_SIZES.forEach(function (sz) {
              while (left >= sz) {
                parts.push({ x: gx, w: sz * site, sites: sz });
                gx += sz * site;
                left -= sz;
              }
            });
            gaps.push({ row: r, x: x, sites: sites, parts: parts });
            x += gw;
          }
        }
      }
      /* whatever is left at the end of the row is a gap too */
      var tail = Math.floor((FZ.umWide - x) / site);
      if (tail > 0) {
        var tparts = [], tleft = tail, tx = x;
        FILL_SIZES.forEach(function (sz) {
          while (tleft >= sz) { tparts.push({ x: tx, w: sz * site, sites: sz }); tx += sz * site; tleft -= sz; }
        });
        gaps.push({ row: r, x: x, sites: tail, parts: tparts });
      }
      rows.push(cells);
    }
    return { rows: rows, gaps: gaps, site: site };
  }

  function fillFigure(M) {
    var sc = M.fill, px = FZ.px, ox = FZ.ox, oy = FZ.oy;
    function X(u) { return ox + u * px; }
    function Y(r) { return oy + r * FZ.pitch; }
    var W = X(FZ.umWide) + 26, H = Y(FZ.rows) + 26;
    var o = ['<svg viewBox="0 0 ' + W.toFixed(0) + " " + H.toFixed(0) + '" class="ff3-svg rt-fill" role="img" ' +
             'aria-label="Four rows of placed cells with gaps between them, and the filler cells that ' +
             'close the gaps so the power rails run unbroken">'];
    o.push('<text class="ff3-cap" x="12" y="20">' + FZ.rows + " rows, " + FZ.umWide +
           " micrometers across, as routing left them</text>");
    o.push('<text class="ff3-cap rt-say" x="12" y="42" id="rt7-say">press play</text>');

    for (var r = 0; r < FZ.rows; r++) {
      o.push('<rect class="' + (r % 2 ? "ff3-row-fs" : "ff3-row-n") + '" x="' + X(0) + '" y="' + Y(r) +
             '" width="' + (FZ.umWide * px).toFixed(1) + '" height="' + FZ.cellH + '"/>');
      /* the rail runs along the row, but only where there is a cell to
         carry it: a gap is a break in it */
      sc.rows[r].forEach(function (c) {
        o.push('<rect class="rt7-rail" x="' + X(c.x).toFixed(1) + '" y="' + (Y(r) - 2.5).toFixed(1) +
               '" width="' + (c.w * px).toFixed(1) + '" height="5"/>');
        o.push('<rect class="rt7-rail" x="' + X(c.x).toFixed(1) + '" y="' + (Y(r) + FZ.cellH - 2.5).toFixed(1) +
               '" width="' + (c.w * px).toFixed(1) + '" height="5"/>');
        o.push('<rect class="rt7-cell" x="' + X(c.x).toFixed(1) + '" y="' + (Y(r) + 3).toFixed(1) +
               '" width="' + (c.w * px - 0.6).toFixed(1) + '" height="' + (FZ.cellH - 6) + '" rx="1"/>');
      });
    }
    /* the fillers, hidden until they are placed */
    sc.gaps.forEach(function (g, gi) {
      g.parts.forEach(function (p, pi) {
        o.push('<g class="rt7-fillg" data-fill="' + gi + "-" + pi + '" style="display:none">' +
               '<rect class="rt7-rail rt7-rail-new" x="' + X(p.x).toFixed(1) + '" y="' + (Y(g.row) - 2.5).toFixed(1) +
               '" width="' + (p.w * px).toFixed(1) + '" height="5"/>' +
               '<rect class="rt7-rail rt7-rail-new" x="' + X(p.x).toFixed(1) + '" y="' +
               (Y(g.row) + FZ.cellH - 2.5).toFixed(1) + '" width="' + (p.w * px).toFixed(1) + '" height="5"/>' +
               '<rect class="rt7-filler" x="' + X(p.x).toFixed(1) + '" y="' + (Y(g.row) + 3).toFixed(1) +
               '" width="' + (p.w * px - 0.6).toFixed(1) + '" height="' + (FZ.cellH - 6) + '" rx="1"/>' +
               (p.sites >= 4
                 ? '<text class="rt7-fillab" x="' + (X(p.x) + p.w * px / 2).toFixed(1) + '" y="' +
                   (Y(g.row) + FZ.cellH / 2 + 3).toFixed(1) + '">X' + p.sites + "</text>"
                 : "") +
               "</g>");
      });
    });
    o.push("</svg>");
    var totalParts = sc.gaps.reduce(function (a, g) { return a + g.parts.length; }, 0);
    var totalSites = sc.gaps.reduce(function (a, g) { return a + g.sites; }, 0);
    return o.join("") +
      '<div class="gp-readout" id="rt7-read">' +
      '<span>gaps in view <b id="rt7-gaps">' + sc.gaps.length + "</b></span>" +
      '<span>sites still open <b id="rt7-open">' + totalSites + "</b></span>" +
      '<span>fillers placed <b id="rt7-placed">0</b> of ' + totalParts + "</span>" +
      '<button class="ff-reset" type="button" id="rt7-replay">replay</button></div>' +
      '<div class="ff3-legend">' +
      '<span><i class="pl-sw rt7-sw-cell"></i>a cell that does something</span>' +
      '<span><i class="pl-sw rt7-sw-fill"></i>a filler, which does not</span>' +
      '<span><i class="pl-sw rt7-sw-rail"></i>the power rails, which a gap breaks and a filler carries ' +
      "across</span></div>";
  }

  function fillAnimate(M) {
    var root = document.getElementById("flow-fig-7");
    if (!root) return;
    var groups = [].slice.call(root.querySelectorAll(".rt7-fillg"));
    if (!groups.length) return;
    var sc = M.fill;
    var gapsEl = document.getElementById("rt7-gaps");
    var openEl = document.getElementById("rt7-open");
    var placedEl = document.getElementById("rt7-placed");
    var say = document.getElementById("rt7-say");
    var replay = document.getElementById("rt7-replay");
    var timers = [];
    function later(ms, fn) { timers.push(setTimeout(fn, ms)); }

    /* the order the tool works in: every gap's widest filler first, then
       the next widest, so the picture shows the strategy rather than
       one gap being finished at a time */
    var order = [];
    FILL_SIZES.forEach(function (sz) {
      sc.gaps.forEach(function (g, gi) {
        g.parts.forEach(function (p, pi) { if (p.sites === sz) order.push({ gi: gi, pi: pi, sz: sz, g: g }); });
      });
    });

    function play() {
      timers.forEach(clearTimeout);
      timers = [];
      groups.forEach(function (el) { el.style.display = "none"; });
      var openSites = sc.gaps.reduce(function (a, g) { return a + g.sites; }, 0);
      if (gapsEl) gapsEl.textContent = String(sc.gaps.length);
      if (openEl) openEl.textContent = String(openSites);
      if (placedEl) placedEl.textContent = "0";
      if (say) say.textContent = "routing is finished, and the rows are full of gaps: every one is a " +
        "break in the power rail that runs along the row";

      var placed = 0, done = {};
      order.forEach(function (o, i) {
        later(700 + i * 130, function () {
          var el = root.querySelector('.rt7-fillg[data-fill="' + o.gi + "-" + o.pi + '"]');
          if (el) el.style.display = "";
          placed += 1;
          openSites -= o.sz;
          if (placedEl) placedEl.textContent = String(placed);
          if (openEl) openEl.textContent = String(Math.max(0, openSites));
          done[o.gi] = (done[o.gi] || 0) + 1;
          var closed = 0;
          sc.gaps.forEach(function (g, gi) { if (done[gi] === g.parts.length) closed += 1; });
          if (gapsEl) gapsEl.textContent = String(sc.gaps.length - closed);
          if (say) {
            say.textContent = i === order.length - 1
              ? "every gap is closed and both rails run unbroken, and not one of these cells does anything"
              : "filler_placement: FILLCELL_X" + o.sz + " first, because the widest filler that fits " +
                "closes the most sites with the fewest cells";
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

  /* ----- step 7: what the block looks like with its metal on -----
     A stylized layout, not a plot of the real geometry: this model
     never computed 56,403 individual routes. What is true in it is the
     density, which follows the congestion map bin by bin, the clock
     tree, whose shape comes from the tree the previous example built,
     and the power grid, which is drawn from the floorplan. */
  function layoutMarkup(M) {
    function rnd(seed) { var x = Math.sin(seed * 23.71) * 10247.13; return x - Math.floor(x); }
    var z = M.z, d = M.fc.die, fin = M.iters[8];
    var sx = z.coreW / d.w, sy = z.coreH / d.h;
    var bw = d.bw * sx, bh = d.bh * sy;
    var o = [], seed = 3;

    function inMacro(x, y) {
      for (var i = 0; i < M.ms.length; i++) {
        var m = M.ms[i];
        if (x > m.x - 2 && x < m.x + m.w + 2 && y > m.y - 2 && y < m.y + m.h + 2) return true;
      }
      return false;
    }

    for (var b = 0; b < fin.ratio.length; b++) {
      var bx = (b % d.nx) * bw, by = ((b / d.nx) | 0) * bh;
      /* the busier the bin was, the more metal ends up in it */
      var n = Math.round(2 + 9 * Math.min(1.2, fin.ratio[b]));
      for (var k = 0; k < n; k++) {
        var px = bx + rnd(seed++) * bw, py = by + rnd(seed++) * bh;
        if (inMacro(px, py)) continue;
        var horiz = (k % 2) === 0;
        var len = (0.25 + rnd(seed++) * 0.7) * (horiz ? bw : bh);
        var x2 = horiz ? Math.min(z.coreW, px + len) : px;
        var y2 = horiz ? py : Math.min(z.coreH, py + len);
        if (inMacro(x2, y2)) continue;
        o.push('<line class="rt7-w' + (horiz ? "h" : "v") + '" x1="' + px.toFixed(1) + '" y1="' + py.toFixed(1) +
               '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '"/>');
      }
    }

    /* the clock tree, on the layers the floorplan reserved for it */
    var C = M.cts, t = C.tree;
    o.push('<line class="rt7-clk rt7-clk-trunk" x1="' + t.root.x.toFixed(1) + '" y1="' + t.root.y.toFixed(1) +
           '" x2="' + t.levels[0][0].x.toFixed(1) + '" y2="' + t.levels[0][0].y.toFixed(1) + '"/>');
    t.levels.forEach(function (lv, i) {
      if (!i) return;
      lv.forEach(function (nd) {
        o.push('<polyline class="rt7-clk" points="' + nd.parent.x.toFixed(1) + "," + nd.parent.y.toFixed(1) +
               " " + nd.x.toFixed(1) + "," + nd.parent.y.toFixed(1) + " " + nd.x.toFixed(1) + "," +
               nd.y.toFixed(1) + '"/>');
      });
    });
    C.clusters.forEach(function (c) {
      o.push('<polyline class="rt7-clk rt7-clk-leaf" points="' + c.parent.x.toFixed(1) + "," +
             c.parent.y.toFixed(1) + " " + c.x.toFixed(1) + "," + c.parent.y.toFixed(1) + " " +
             c.x.toFixed(1) + "," + c.y.toFixed(1) + '"/>');
    });
    return o.join("");
  }

  function finishedFigure(M, wire) {
    return plan(core(), {
      macros: true, pins: true, pdn: true,
      cells: { core: layoutMarkup(M) },
      aria: "The finished block: signal metal across the core, the clock tree on the upper layers, " +
            "the power grid over both, and the four memories",
    }) + '<div class="ff3-legend">' +
      '<span><i class="pl-sw rt7-sw-wv"></i>signal metal running up the page</span>' +
      '<span><i class="pl-sw rt7-sw-wh"></i>signal metal running across it</span>' +
      '<span><i class="pl-sw rt7-sw-clk"></i>the clock tree, on metal4 to metal6</span>' +
      "<span>a stylized layout: the density of the metal in each bin follows the congestion map, and " +
      "the clock is the tree the previous stage built</span></div>";
  }

  /* ================= steps 4 to 7 ================= */

  STEPS.push({
    n: 4, title: "Re-time on the corridors just made", button: "Repair on route parasitics", againLabel: "Repair again",
    line: "The guides give a better wire estimate than placement did, so timing is repaired again.",
    intro: function () {
      var M = model();
      return "<p>The previous step did not draw any metal, but it did produce something the flow has " +
        "never had before: for every one of the " + fmt(M.nets) + " nets, a corridor with a real route " +
        "through the block. Each guide has a path, a set of layers, and therefore a <em>length</em>, " +
        "including the detours the router took around the congestion it was clearing. Added up, that is " +
        fmt(Math.round(M.wire.total)) + " micrometers of wire, against the " +
        fmt(Math.round(M.wire.hpwl)) + " micrometers of straight line placement had been assuming, and " +
        "the difference is not spread evenly: the nets that were rerouted around a full bin grew, and " +
        "those are not the same nets that were already critical.</p>" +
        "<p>So the first thing to do with a guide is not to build it. It is to ask the timer again. " +
        "<code>estimate_parasitics -global_routing</code> re-estimates every net from its guide instead " +
        "of from a straight line, and the timing changes: some paths that looked safe are not, because " +
        "their wire is longer than anyone had assumed.</p>" +
        "<p><strong>Why repair here, rather than after the wires are real?</strong> Because this is the " +
        "last cheap moment. Resizing a driver or inserting a buffer moves cells, and moving cells " +
        "invalidates routing. Right now that costs a reroute of the handful of nets that changed, which " +
        "is what the <code>global_route -start_incremental</code> and <code>-end_incremental</code> pair " +
        "around detailed placement does. After the next step, the same fix means ripping up real metal " +
        "and re-running the slowest stage in the flow. Every stage repairs against the best estimate it " +
        "can get before committing to something expensive, and this is that moment for routing.</p>";
    },
    command:
      "# the padding detailed placement will use when it puts repaired cells back\n" +
      "set_placement_padding -global -left " + OPT.padDetail + " -right " + OPT.padDetail + "\n" +
      "\n" +
      "# the clock has been propagated since clock tree synthesis, and every stage\n" +
      "# script says so again before it trusts the timer\n" +
      "set_propagated_clock [all_clocks]\n" +
      "\n" +
      "# the guides are new, so the wire estimate is new: re-extract before judging anything\n" +
      "estimate_parasitics -global_routing\n" +
      "\n" +
      "# fix what the better estimate exposed: slew, fanout, and drivers that are now too weak\n" +
      "repair_design -verbose\n" +
      "\n" +
      "# that moved cells and added new ones, so tell the router an edit is starting,\n" +
      "# put everything back on legal sites, then reroute only the nets that changed\n" +
      "global_route -start_incremental\n" +
      "detailed_placement\n" +
      "global_route -end_incremental\n" +
      "\n" +
      "# the design has changed again, so estimate again before repairing timing.\n" +
      "# with neither -setup nor -hold, repair_timing does both, setup first, so that\n" +
      "# slowing a path for hold cannot quietly break the setup fix just made\n" +
      "estimate_parasitics -global_routing\n" +
      "repair_timing -verbose\n" +
      "\n" +
      "# timing repair moved cells too, so the same cycle runs a second time\n" +
      "global_route -start_incremental\n" +
      "detailed_placement\n" +
      "check_placement -verbose\n" +
      "global_route -end_incremental\n" +
      "estimate_parasitics -global_routing\n" +
      "\n" +
      "# a last attempt at the worst path only, allowed to swap threshold voltages\n" +
      "# and to reroute, and forbidden from chasing the total negative slack\n" +
      'repair_timing -setup -sequence "vt_swap reroute" -skip_last_gasp -repair_tns 0 -verbose\n' +
      "estimate_parasitics -global_routing",
    commandNote:
      "This is the reference flow's own sequence, comments added. It runs the estimate-repair-legalize-" +
      "reroute cycle twice, once for <code>repair_design</code> and once for <code>repair_timing</code>, " +
      "re-estimating in between, because each repair invalidates the numbers the next one needs. Every " +
      "line depends on the one above it: no point repairing against numbers you have not refreshed, no " +
      "point refreshing them if cells then move without the route being told. One thing is left out " +
      "here: that flow also runs a further <code>repair_timing -setup -sequence &quot;vt_swap " +
      "reroute&quot;</code> pass afterwards, a last attempt at the worst path using threshold-voltage " +
      "swaps, which is a tuning knob rather than part of the shape of the stage.",
    run: function () {
      var M = model();
      var resized = Math.round(M.insts * 0.011);
      var added = Math.round(M.insts * 0.004);
      var setupEnds = Math.round(M.insts * 0.0009), holdEnds = Math.round(M.insts * 0.0016);
      var lastEnds = Math.round(setupEnds * 0.26);
      var before = 0.20, after = 0.14, fixed = 0.17;
      return {
        log: [
          { k: "cmd", t: "set_placement_padding -global -left " + OPT.padDetail + " -right " + OPT.padDetail },
          { k: "cmd", t: "set_propagated_clock [all_clocks]" },
          { k: "cmd", t: "estimate_parasitics -global_routing" },
          { k: "out", t: "  parasitics from the guides: " + fmt(Math.round(M.wire.total)) + " um of wire, was " +
                         fmt(Math.round(M.wire.hpwl)) + " um of straight line" },
          { k: "cmd", t: "repair_design -verbose" },
          { k: "out", t: "  [INFO RSZ-0034] Found 0 slew violations." },
          { k: "out", t: "  [INFO RSZ-0045] Inserted " + fmt(added) + " buffers, " +
                         fmt(Math.round(added * 0.17)) + " to split loads." },
          { k: "out", t: "  [INFO RSZ-0051] Resized " + fmt(resized) + " instances: " + fmt(resized) +
                         " up, 0 up match, 0 down, 0 VT" },
          { k: "cmd", t: "global_route -start_incremental" },
          { k: "cmd", t: "detailed_placement" },
          { k: "out", t: "  [INFO DPL-0020] Mirrored 0 instances" },
          { k: "cmd", t: "global_route -end_incremental" },
          { k: "out", t: "  rerouted " + fmt(resized + added) + " modified nets, the rest untouched" },
          { k: "cmd", t: "estimate_parasitics -global_routing" },
          { k: "cmd", t: "repair_timing -verbose" },
          { k: "out", t: "  [INFO RSZ-0100] Repair move sequence: UnbufferMove SizeUpMove SwapPinsMove BufferMove SplitLoadMove" },
          { k: "out", t: "  [INFO RSZ-0094] Found " + fmt(setupEnds) + " endpoints with setup violations." },
          { k: "out", t: "  [INFO RSZ-0099] Repairing " + fmt(setupEnds) + " out of " + fmt(setupEnds) +
                         " (100.00%) violating endpoints..." },
          { k: "out", t: "  [INFO RSZ-0043] Swapped pins on " + fmt(Math.round(setupEnds * 0.3)) + " instances." },
          { k: "out", t: "  [INFO RSZ-0046] Found " + fmt(holdEnds) + " endpoints with hold violations." },
          { k: "out", t: "  [INFO RSZ-0032] Inserted " + fmt(Math.round(holdEnds * 1.6)) + " hold buffers." },
          { k: "out", t: "  worst setup slack " + before.toFixed(2) + " -> " + after.toFixed(2) +
                         " -> " + fixed.toFixed(2) + " ns (estimate, re-estimate, repair)" },
          { k: "cmd", t: "global_route -start_incremental" },
          { k: "cmd", t: "detailed_placement" },
          { k: "cmd", t: "check_placement -verbose" },
          { k: "out", t: "  [INFO FLW-0012] Placement violations ." },
          { k: "cmd", t: "global_route -end_incremental" },
          { k: "cmd", t: "estimate_parasitics -global_routing" },
          { k: "cmd", t: 'repair_timing -setup -sequence "vt_swap reroute" -skip_last_gasp -repair_tns 0 -verbose' },
          { k: "out", t: "  [INFO RSZ-0100] Repair move sequence: RerouteMove" },
          { k: "out", t: "  [INFO RSZ-0094] Found " + fmt(lastEnds) + " endpoints with setup violations." },
          { k: "out", t: "  [INFO RSZ-0099] Repairing 1 out of " + fmt(lastEnds) + " (" +
                         (100 / lastEnds).toFixed(2) + "%) violating endpoints..." },
          { k: "cmd", t: "estimate_parasitics -global_routing" },
          { k: "ok", t: "Timing repaired against the corridors the router chose." },
        ],
        figure: '<p class="ff3-figtext">Below is one net, the longest in the block, followed through ' +
          "this step. It starts as the straight line placement assumed, becomes the corridor the " +
          "router actually chose, and then gets repaired: a stronger driver, a buffer splitting the " +
          "wire, that buffer legalized onto a row, and the net rerouted because it changed. The bar " +
          "underneath is the worst slack in the whole block, which is what all of this is for. Watch " +
          "it drop when the estimate improves, before any of the repair happens.</p>" +
          repairFigure(M),
        after: function () { repairAnimate(M); },
        report: "<h3>The same net, estimated three ways, and what is coming</h3>" + table([
          ["Wire-load model", f1(repairNumbers().cWireload) + " femtofarads: a table of fanout against " +
            "capacitance, with no positions at all"],
          ["<code>estimate_parasitics -placement</code>", f1(repairNumbers().cStraight) +
            " femtofarads: the straight line between the pins"],
          ["<code>estimate_parasitics -global_routing</code>, this step", f1(repairNumbers().cRouted) +
            " femtofarads: the length of the guide the router just made, and the best number this " +
            "stage can repair against"],
          ["<code>extract_parasitics</code>, not yet run", "about " + f1(repairNumbers().cExtract) +
            " femtofarads once the metal exists, measured from the shapes and the neighbours coupling " +
            "into them. Nothing in the flow has extracted anything at this point: this row is what the " +
            "timing example will compute, and the gap to the row above is what this stage is blind to."],
        ]) + "<h3>Repair on global route parasitics</h3>" + table([
          ["Wire the estimate now uses", fmt(Math.round(M.wire.total)) + " micrometers of guide, against " +
            fmt(Math.round(M.wire.hpwl)) + " micrometers of straight line before"],
          ["Instances resized", fmt(resized)],
          ["Buffers added", fmt(added)],
          ["Nets rerouted", fmt(resized + added) + ", incrementally"],
          ["Worst setup slack", before.toFixed(2) + " nanoseconds, then " + after.toFixed(2) +
            " once the better estimate lands, then " + fixed.toFixed(2) + " after repair"],
        ]) + checks([
          ["Slack got worse before it got better.",
           "Nothing physical changed when the parasitics were re-estimated. The design was always this " +
           "slow; the flow simply stopped underestimating its wire. Every accuracy improvement in the " +
           "flow does this, and a flow that never shows a slack drop at this point is usually one whose " +
           "estimates are not improving."],
          ["Incremental means incremental.",
           "<code>global_route -start_incremental</code> records the state, detailed placement moves what " +
           "it must, and <code>-end_incremental</code> reroutes only the nets whose pins moved. Rerouting " +
           "everything would throw away the congestion work of the previous step."],
          ["There is still one rung below this.",
           "Extraction, after the wires are real, is the number sign-off uses. That is the timing " +
           'example\'s starting point: <a href="/explore/examples/timing">arrival against required</a>.'],
        ]),
      };
    },
  });

  STEPS.push({
    n: 5, title: "Catch the antennas early", button: "Check and repair antennas", againLabel: "Check again",
    line: "A wire with nothing above it yet can destroy the gate it connects to, during manufacture.",
    intro:
      "<p>This one is not about timing at all. It is about surviving the factory.</p>" +
      "<p>A chip is built one layer at a time, and the metal is shaped by plasma etching. A piece of " +
      "metal that is connected to a transistor gate, and to nothing else yet, acts as a collector: it " +
      "picks up charge from the plasma, and the only path to ground is through the gate oxide, which is " +
      "a few atoms thick. Enough charge and the oxide is damaged before the chip has ever been powered " +
      "on. The rule is expressed as a ratio, the collecting metal area divided by the gate area, and the " +
      "process sets the limit.</p>" +
      "<p>The fix is to give the charge somewhere else to go: a diode on the net, which conducts to the " +
      "substrate when the voltage climbs. The other fix is to break the long piece up by jumping to a " +
      "higher layer, so no single layer collects enough on its own.</p>" +
      "<p><strong>This is the early pass, not the real one.</strong> The rule is about actual metal, and " +
      "there is none yet: this check runs on the guides, which are only a guess at where the metal will " +
      "go. It is worth running anyway, because a diode inserted now costs an incremental reroute, while " +
      "one inserted after the design is fully routed costs a rip-up and a re-route of the finished " +
      "wiring. The authoritative check comes in the next step, on the shapes themselves, and the " +
      "reference flow runs both.</p>",
    command:
      "# the flow allows up to five repair passes here\n" +
      "repair_antennas -iterations " + OPT.antennaIters + "\n" +
      "check_placement -verbose\n" +
      "check_antennas -report_file reports/grt_antennas.log\n" +
      "\n" +
      "# the diodes changed the design, so the estimate is refreshed one last\n" +
      "# time, and the guides are written out for the detailed router\n" +
      "estimate_parasitics -global_routing\n" +
      "write_guides route.guide",
    commandNote:
      "<code>repair_antennas</code> inserts diodes and then calls detailed placement itself, because a " +
      "diode is a cell and it has to be legal like any other. The iteration limit is the flow's own " +
      "setting, five here, and the same limit applies to the post-route loop in the next step. " +
      "<code>write_guides</code> ends this stage: everything after it works from that file.",
    run: function () {
      var M = model();
      var diodes = Math.round(M.antennaNets * 1.2);
      return {
        log: [
          { k: "cmd", t: "repair_antennas -iterations " + OPT.antennaIters },
          { k: "out", t: "  [INFO GRT-0012] Found " + fmt(M.antennaNets) + " antenna violations." },
          { k: "out", t: "  [INFO GRT-0015] Inserted " + fmt(diodes) + " diodes." },
          { k: "cmd", t: "check_placement -verbose" },
          { k: "out", t: "  [INFO FLW-0012] Placement violations ." },
          { k: "cmd", t: "check_antennas -report_file reports/grt_antennas.log" },
          { k: "out", t: "  [INFO ANT-0002] Found 0 net violations." },
          { k: "out", t: "  [INFO ANT-0001] Found 0 pin violations." },
          { k: "cmd", t: "estimate_parasitics -global_routing" },
          { k: "cmd", t: "write_guides route.guide" },
          { k: "out", t: "  guides for " + fmt(M.nets) + " nets written" },
          { k: "ok", t: "No antenna violations left on the global route. Guides handed to the detailed router." },
        ],
        figure: antennaFigure(M),
        after: function () { antennaAnimate(M); },
        report: "<h3>Antenna check</h3>" + table([
          ["Nets in violation", fmt(M.antennaNets) + " of " + fmt(M.nets)],
          ["Diodes inserted", fmt(diodes) + ", master " + OPT.diode],
          ["Rule", "collecting metal area divided by gate area, against the limit the process sets"],
          ["Checked again", "after detailed routing, on the real shapes"],
          ["Cost", "one small cell per repaired net, plus the capacitance it adds to that net"],
        ]) + checks([
          ["It is a manufacturing rule, not an electrical one.",
           "The finished chip is perfectly happy with a long wire. The danger exists only during the " +
           "etch steps, when that wire is connected to a gate and not yet connected to the layer above " +
           "that would drain it. That is why the check is per layer and per stage of the build."],
          ["Two fixes, and the router prefers the cheaper one.",
           "Jumping the net up a layer costs two vias and no area. A diode costs a cell, a site, and " +
           "some capacitance on a net that may be timing critical. The tool reaches for the jump where " +
           "the layers allow it and the diode where they do not."],
          ["Zero here does not mean zero later.",
           "This pass cleared everything it could see on the guides. The next step draws the real metal, " +
           "which is longer and takes different layers than a guide suggests, so nets that looked safe " +
           "here can violate there. That is why the check runs again on the finished route, and why it " +
           "is a loop: every diode it adds changes the routing it is checking."],
          ["Zero is the only acceptable number.",
           "Unlike timing slack, this is not a quantity to optimize. A violating net is a net that may " +
           "come back from the factory dead, so the loop runs until the count is zero or the flow stops."],
        ]),
      };
    },
  });

  STEPS.push({
    n: 6, title: "Draw the metal", button: "Detailed route", againLabel: "Route again",
    line: "Turn every corridor into exact shapes on exact tracks, until no rule is broken.",
    intro:
      "<p>This is the stage that produces the chip's wiring. The detailed router takes each guide and " +
      "realises it: a shape on a track, a via at every layer change, every one of them obeying the " +
      "spacing, width, enclosure and end-of-line rules the process defines. There are hundreds of those " +
      "rules at seven nanometres and they interact, which is why this is the slowest step in the flow.</p>" +
      "<p>It works the way the maze router in the sandbox does, one net at a time, and it accepts that " +
      "early nets will make life hard for later ones. So it iterates: route everything, count what is " +
      "illegal, rip up the shapes around each violation, and route those again with the violation " +
      "remembered as a cost. The count falls fast, and the run ends when it reaches zero.</p>",
    command: function () {
      var dr = "detailed_route -output_drc reports/5_route_drc.rpt -output_maze results/maze.log " +
        "-droute_end_iter " + OPT.endIter + " -drc_report_iter_step " + OPT.drcIterStep + " -verbose 1";
      return "# draw every net, and iterate until no design rule is broken\n" + dr + "\n" +
        "\n" +
        "# now the metal is real, so the antenna rule can be checked properly.\n" +
        "# each diode is a new cell, which changes the routing, so the route is\n" +
        "# redone and the check repeated until it comes back clean\n" +
        "repair_antennas\n" + dr + "\n" +
        "check_antennas -report_file reports/drt_antennas.log";
    },
    commandNote:
      "<code>-droute_end_iter</code> caps the iterations, and <code>-drc_report_iter_step</code> writes " +
      "a violation report every few of them so a run that is not converging can be looked at without " +
      "waiting for it to finish. The antenna part is a loop in the reference flow, not two commands: it " +
      "repairs, reroutes, and checks again, up to a limit, because inserting a diode changes the very " +
      "thing the rule is measured on.",
    run: function () {
      var M = model(), end = M.drt[M.drt.length - 1];
      var drCmd = "detailed_route -output_drc reports/5_route_drc.rpt -output_maze results/maze.log " +
        "-droute_end_iter " + OPT.endIter + " -drc_report_iter_step " + OPT.drcIterStep + " -verbose 1";
      /* the metal is real now, so nets the guides made look safe can turn
         out to violate, and a few more diodes go in */
      var lateNets = Math.round(M.antennaNets * 0.38), lateDiodes = Math.round(lateNets * 1.2);
      var perLayer = M.layers.filter(function (l) { return l.demand > 0; }).map(function (l) {
        return "  " + l.name.padEnd(8) + String(Math.round(l.demand)).padStart(10) + " um";
      }).join("\n");
      var text =
        "[INFO DRT-0195] Start 0th optimization iteration.\n" +
        "[INFO DRT-0199]   Number of violations = " + M.drt[0].viol + ".\n" +
        "Viol/Layer         metal2  metal3  metal4  metal5  metal6\n" +
        "Metal Spacing         421     388      96      41      22\n" +
        "Short                 233     201      54      18       9\n" +
        "EOL                   180     144      37      12       6\n" +
        "Recheck               612     540     121      45      18\n" +
        "...\n" +
        "[INFO DRT-0195] Start 3rd optimization iteration.\n" +
        "[INFO DRT-0199]   Number of violations = 0.\n" +
        "[INFO DRT-0198] Complete detail routing.\n" +
        "Total wire length = " + Math.round(end.wire) + " um.\n" + perLayer + "\n" +
        "Total number of vias = " + M.vias + ".";
      return {
        log: [
          { k: "cmd", t: drCmd },
          { k: "out", t: "  [INFO DRT-0181] Start track assignment." },
          { k: "out", t: "  [INFO DRT-0182] Complete track assignment." },
        ].concat(M.drt.reduce(function (acc, d) {
          acc.push({ k: "out", t: "  [INFO DRT-0195] Start " + ordinal(d.it) + " optimization iteration." });
          acc.push({ k: "out", t: "  [INFO DRT-0199]   Number of violations = " + d.viol + "." });
          return acc;
        }, [])).concat([
          { k: "out", t: "  [INFO DRT-0198] Complete detail routing." },
          { k: "out", t: "  Total wire length = " + Math.round(end.wire) + " um." },
          { k: "out", t: "  Total number of vias = " + M.vias + "." },
          { k: "cmd", t: "repair_antennas" },
          { k: "out", t: "  [INFO GRT-0012] Found " + fmt(lateNets) + " antenna violations." },
          { k: "out", t: "  [INFO GRT-0015] Inserted " + fmt(lateDiodes) + " diodes." },
          { k: "cmd", t: drCmd },
          { k: "out", t: "  [INFO DRT-0195] Start 0th optimization iteration." },
          { k: "out", t: "  [INFO DRT-0199]   Number of violations = " + Math.round(lateDiodes * 0.9) + "." },
          { k: "out", t: "  [INFO DRT-0195] Start 1st optimization iteration." },
          { k: "out", t: "  [INFO DRT-0199]   Number of violations = 0." },
          { k: "out", t: "  [INFO DRT-0198] Complete detail routing." },
          { k: "cmd", t: "check_antennas -report_file reports/drt_antennas.log" },
          { k: "out", t: "  [INFO ANT-0002] Found 0 net violations." },
          { k: "out", t: "  [INFO ANT-0001] Found 0 pin violations." },
          { k: "ok", t: "Routed, with no design rule violations and no antenna violations." },
        ]),
        figure: '<p class="ff3-figtext">The window below is a few micrometers of the block, magnified ' +
          "until individual tracks are visible: vertical metal2 and horizontal metal3. Watch the wires " +
          "land on tracks first, then the violations appear where two of them ended up too close or on " +
          "top of each other, then each iteration clears most of what is left. The count in the readout " +
          "is the whole design's, not this window's, which is why it falls from thousands to zero while " +
          "only a handful of markers are visible here.</p>" + routeFigure(M),
        after: function () { routeAnimate(M); },
        report: "<h3>Detailed route result</h3>" +
          '<pre class="pl-report">' + esc(text) + "</pre>" + table([
          ["Iterations used", M.drt.length + " of " + OPT.endIter + " allowed"],
          ["Violations at the end", "0"],
          ["Wire length", fmt(Math.round(end.wire)) + " micrometers, against " +
            fmt(Math.round(M.wire.total)) + " estimated from the guides"],
          ["Vias", fmt(M.vias) + ", about " + f1(M.vias / M.insts) + " per instance"],
        ]) + checks([
          ["The first iteration is supposed to be bad.",
           fmt(M.drt[0].viol) + " violations sounds alarming, and it is routine. The router's first pass " +
           "optimizes each net without much regard for what it does to its neighbours, because " +
           "negotiating from a routed state is faster than being careful from nothing. The second pass " +
           "removed " + (100 * (1 - M.drt[1].viol / M.drt[0].viol)).toFixed(1) + "% of them."],
          ["The antenna check belongs here, on real metal.",
           "The pass before global routing worked on guides, which is a guess at the geometry the rule " +
           "is about. Now the shapes exist, so the check is exact, and it finds " + fmt(lateNets) +
           " nets the earlier pass could not see. Each diode is a new cell, so the route has to be " +
           "redone around it, and the check repeated. That loop runs until it comes back clean."],
          ["Vias are the hidden cost.",
           fmt(M.vias) + " vias is far more objects than the design has cells. Each one is resistance in " +
           "a path, a possible manufacturing defect, and an obstacle for the wires around it, which is " +
           "why a router that takes a slightly longer path to avoid a layer change is often right."],
          ["This is the number the estimate was trying to guess.",
           "The wire length here, " + fmt(Math.round(end.wire)) + " micrometers, is what every earlier " +
           "stage was approximating. Extraction now has real shapes to work from, so the next report of " +
           "timing is the first one that is not built on an estimate."],
        ]),
      };
    },
  });

  STEPS.push({
    n: 7, title: "Fill, check and hand off", button: "Finish the stage", againLabel: "Write again",
    line: "Insert the filler cells, confirm the design is routed and legal, and write it out.",
    intro:
      "<p>Two things remain. The rows still have gaps between cells, and a gap is a break in the power " +
      "rails and in the continuous well that the cells share, so <strong>filler cells</strong> go in to " +
      "close them. They contain no logic. They exist to carry the rails across and to keep the diffusion " +
      "regular, which is what the manufacturing process wants to see.</p>" +
      "<p>Fillers come last, after routing rather than after placement, because every stage until now " +
      "has been inserting cells: buffers for slew, buffers for the clock, buffers for hold, diodes for " +
      "antennas. Filling the gaps earlier would only mean removing fillers again to make room.</p>",
    command:
      "filler_placement {" + OPT.fillers + "}\n" +
      "check_placement\n" +
      "report_design_area\n" +
      "write_db tile4m_route.odb",
    commandNote:
      "The filler list is given widest first, so the tool closes each gap with as few cells as it can. " +
      "Fillers are physical only: they connect no signals, so nothing here can change the timing or the " +
      "routing that was just finished. Note what is <em>not</em> written: the reference flow keeps the " +
      "design in its own database between stages and only writes DEF, SPEF and GDSII at the very end, " +
      "after extraction.",
    run: function () {
      var M = model(), end = M.drt[M.drt.length - 1];
      var fillers = Math.round(M.insts * 0.32);
      var util = 100 * (M.z.fg.cellArea + 10215 + M.cts.area) / (M.z.coreArea - M.z.fg.macroArea);
      return {
        log: [
          { k: "cmd", t: "filler_placement {" + OPT.fillers + "}" },
          { k: "out", t: "  " + fmt(fillers) + " filler cells placed, every row gap closed" },
          { k: "cmd", t: "check_placement" },
          { k: "out", t: "  [INFO FLW-0012] Placement violations ." },
          { k: "cmd", t: "report_design_area" },
          { k: "out", t: "  Design area " + fmt(Math.round(M.z.fg.cellArea + 10215 + M.cts.area)) +
                         " um^2 " + Math.round(util) + "% utilization." },
          { k: "cmd", t: "write_db tile4m_route.odb" },
          { k: "ok", t: "Routing complete. Next stage: timing sign-off." },
        ],
        figure: '<p class="ff3-figtext">The close-up below is four rows as routing left them. The ' +
          "cells are where they were placed, but they do not abut: there are gaps, and every gap is a " +
          "break in the power rails that run along the top and bottom of the row. Watch the fillers go " +
          "in, widest first, because one wide filler closes more sites than several narrow ones. When " +
          "the last gap closes, both rails run unbroken from one end of the row to the other, and not " +
          "one of the cells just added does anything at all.</p>" +
          fillFigure(M) +
          '<p class="ff3-figtext">And the block as a whole, with its metal on: ' +
          fmt(Math.round(end.wire)) + " micrometers of signal wiring across the core, the clock tree " +
          "reaching every corner of it on the upper layers, the power grid over both, and the four " +
          "memories underneath. This is what the stage produced.</p>" +
          finishedFigure(M, end.wire),
        after: function () { fillAnimate(M); },
        report: "<h3>What timing sign-off receives</h3>" + table([
          ["Nets", fmt(M.nets) + ", all routed"],
          ["Wire", fmt(Math.round(end.wire)) + " micrometers across " + OPT.signalLo + " to " + OPT.signalHi],
          ["Vias", fmt(M.vias)],
          ["Design rule violations", "0"],
          ["Antenna violations", "0"],
          ["Filler cells", fmt(fillers)],
          ["Still an estimate", "nothing: the next stage extracts parasitics from these shapes"],
        ]) + checks([
          ["The clock's skew has to be measured again.",
           "The clock tree example ended by saying its skew number was provisional, because it was " +
           "measured on estimated wire. These are the wires it was estimating. Sign-off recomputes the " +
           "skew on extracted parasitics, and it is not the same number."],
          ["Routed does not mean signed off.",
           "Zero violations from the router means zero violations against the rules the router checks. " +
           "Physical verification runs the foundry's own rule deck over the finished layout, and " +
           "compares the shapes against the schematic, which are separate tools and separate runs."],
          ["Continue the design.",
           'Next is <a href="/explore/examples/timing">arrival against required</a>, which extracts ' +
           "parasitics from this metal and proves the block meets its clock."],
        ]),
      };
    },
  });

  var STAGE = {
    key: "routing",
    steps: STEPS,
    finishedTitle: "Routing complete.",
    finishedNote: "Every net is metal, every rule is satisfied, and nothing in the design is an " +
      'estimate any more. Next is <a href="/explore/examples/timing">timing sign-off</a>.',
    epilogue:
      "<h3>How this differs from a production flow</h3>" +
      "<p>The stages and the questions are real. Four things a production route does that this one " +
      "does not:</p>" +
      '<ul class="ff-checks">' +
      "<li><strong>It routes far more layers, and assigns them deliberately.</strong> A real advanced " +
      "node stack has ten to fifteen routing layers in several pitch families: thin fast layers for " +
      "local connections, thick low-resistance layers for long hauls and power. Deciding which nets " +
      "belong on which family is its own optimization, and this example has six layers and one " +
      "rule.</li>" +
      "<li><strong>It routes with timing in the loop.</strong> The router here minimizes wirelength and " +
      "vias subject to the rules. A production router is timing driven: it knows which nets are " +
      "critical, gives them shorter paths, wider wires and better layers, and will spend congestion " +
      "elsewhere to buy it.</li>" +
      "<li><strong>It fixes far more than spacing.</strong> Beyond the rules checked here come " +
      "manufacturability requirements: density fill so every layer etches evenly, wire spreading, via " +
      "doubling on critical connections, and rules that only appear at the foundry's own sign-off " +
      "deck.</li>" +
      "<li><strong>It does this on a machine farm, for days.</strong> Detailed routing a full chip is " +
      "partitioned across many machines and many hours, and the iteration count in this example, " +
      "reached in seconds, is the part of the stage that is genuinely small here.</li></ul>",
    footNote: 'Route by hand in the <a href="/explore/algorithms/maze-router">maze router lab</a>.',
  };
  if (typeof window !== "undefined" && window.FLOW_PAGE_STAGE === STAGE.key) window.FLOW_STAGE = STAGE;

  return { OPT: OPT, model: model, STAGE: STAGE, STEPS: STEPS, layerSupply: layerSupply,
           finishedFigure: finishedFigure };
})();

if (typeof module !== "undefined" && module.exports) module.exports = RoutingSteps;
