/* The browser engine's back half: clock tree, routing, timing, power and
   finishing, on the placement pd-engine.js produced. Like the front half,
   each stage is a smaller version of what the real flow runs, and its
   numbers are estimates:

     cts      the flip-flops clustered by recursive bisection, the way the
              flow's clock tree tool groups sinks (up to CTS_CLUSTER_SIZE
              each, no wider than CTS_CLUSTER_DIAMETER), a buffer at each
              cluster and at the top levels of the tree above them
     route    a global-routing grid over metal2 to metal7 with the flow's
              25% capacity cut; each net split into two-pin connections by
              a minimum spanning tree, pattern-routed (L shapes, then Z
              shapes for anything crossing an overfull edge), as FastRoute
              does before its maze routing
     sta      static timing: the real Liberty tables for every cell and
              the memory, wire resistance and capacitance from the routed
              length, clock arrival from the clock tree
     power    switching, internal and leakage power from the same tables
     finish   filler cells into every gap left on the rows

   No timing repair runs here. The real flow resizes cells and inserts
   buffers to fix slow paths (526 of them in the reference run); this engine
   reports the timing of the placement as it is. */

(function (root) {
  "use strict";
  var PD = root.PDEngine || (typeof require !== "undefined" ? require("./pd-engine.js") : null);

  /* the flow's wire estimates for this platform (asap7 setRC.tcl), per micrometer */
  var WIRE = { signal: { r: 0.0323151, c: 0.173323 }, clock: { r: 0.0513971, c: 0.144549 } };  /* kOhm, fF */
  var LAYERS = [                        /* routing layers, from the ASAP7 technology file */
    { n: "M2", dir: "H", pitch: 0.036 }, { n: "M3", dir: "V", pitch: 0.036 },
    { n: "M4", dir: "H", pitch: 0.048 }, { n: "M5", dir: "V", pitch: 0.048 },
    { n: "M6", dir: "H", pitch: 0.064 }, { n: "M7", dir: "V", pitch: 0.064 },
  ];
  var ADJUST = 0.25;                    /* set_global_routing_layer_adjustment M2-M7 0.25 */
  /* the timing constraints: each design's own constraint.sdc, carried in
     D.meta.flow (input and output delay as a share of the period, and the
     clock's latency); riscv32i's are the fallback */
  var SDC = { ioPct: 0.125, latency: 142.965 };
  function sdcOf(D) {
    var F = D.meta && D.meta.flow;
    return F && F.ioPct !== undefined ? { ioPct: F.ioPct, latency: F.latency } : SDC;
  }
  function clockName(D) { return (D.meta && D.meta.flow && D.meta.flow.clock) || "clk"; }

  /* ----- lookups in a Liberty table: bilinear, clamped at the edges ----- */
  function lookup(t, a, b) {
    var i1 = t.i1, i2 = t.i2, v = t.v;
    if (!i2.length) {                                    /* a one-dimensional table, over */
      var row = v[0].length > 1 ? v[0] : v.map(function (r) { return r[0]; });
      return interp1(i1, row, t.ax && t.ax[0] === "load" ? b : a);   /* slew or load */
    }
    var i = seg(i1, a), j = seg(i2, b);
    var fa = (a - i1[i]) / (i1[i + 1] - i1[i]), fb = (b - i2[j]) / (i2[j + 1] - i2[j]);
    fa = Math.max(0, Math.min(1.5, fa)); fb = Math.max(0, Math.min(1.5, fb));
    var v00 = v[i][j], v01 = v[i][j + 1], v10 = v[i + 1][j], v11 = v[i + 1][j + 1];
    return v00 * (1 - fa) * (1 - fb) + v10 * fa * (1 - fb) + v01 * (1 - fa) * fb + v11 * fa * fb;
  }
  function seg(ix, x) {
    var k = 0;
    while (k < ix.length - 2 && x > ix[k + 1]) k++;
    return k;
  }
  function interp1(ix, row, x) {
    var k = seg(ix, x), f = (x - ix[k]) / (ix[k + 1] - ix[k]);
    return row[k] + (row[k + 1] - row[k]) * Math.max(0, Math.min(1.5, f));
  }

  /* The library keeps a rising and a falling table for every arc and check.
     Timing follows both edges; the rougher estimates (the clock tree, the
     repair) use the worse of the two, made here once. */
  function worse(a, b) {
    if (!b || a.i1.join() !== b.i1.join() || a.i2.join() !== b.i2.join()) return a;
    return { i1: a.i1, i2: a.i2, ax: a.ax, v: a.v.map(function (r, i) { return r.map(function (x, j) { return Math.max(x, b.v[i][j]); }); }) };
  }
  function prepareLib(LIB) {
    if (LIB.prepared) return LIB;
    Object.keys(LIB.cells).forEach(function (nm) {
      var L = LIB.cells[nm];
      L.arcs.forEach(function (a) { a.d = worse(a.dr, a.df); a.s = worse(a.sr, a.sf); });
      L.checks.forEach(function (c) { c.t = worse(c.tr, c.tf); });
    });
    LIB.prepared = true;
    return LIB;
  }

  /* ----- where every pin is, after placement ----- */
  function Geometry(D, fp, pl, lg) {
    this.D = D; this.fp = fp; this.P = pl.P; this.lx = lg.x; this.ly = lg.y;
  }
  Geometry.prototype.pos = function (cell, pin) {
    if (cell < 0) return this.fp.pins[pin];
    var mv = this.P.movable[cell];
    if (mv >= 0) return { x: this.lx[mv], y: this.ly[mv] };
    var mac = this.P.fixedPos[cell], off = this.D.types[this.D.cells[cell]].off[pin];
    return { x: mac.x + off[0], y: mac.y + off[1] };
  };

  /* the Liberty entry for a netlist pin: rd_out[3] is looked up as rd_out */
  function libPin(L, name) {
    if (L.pins[name]) return name;
    var base = name.replace(/\[\d+\]$/, "");
    return L.pins[base] ? base : null;
  }

  /* =============== clock tree =============== */
  function cts(D, LIB, fp, pl, lg, knobs) {
    prepareLib(LIB);
    var G = new Geometry(D, fp, pl, lg), sinks = [], macroSinks = [];
    var clk = D.nets[D.clockNet];
    for (var k = 0; k < clk.length; k += 2) {
      var c = clk[k], pin = clk[k + 1];
      if (c < 0) continue;
      var T = D.types[D.cells[c]], L = LIB.cells[T.n];
      var cap = L && L.pins[libPin(L, T.pins[pin])] ? L.pins[libPin(L, T.pins[pin])].cap : 0.5;
      var p = G.pos(c, pin), s = { cell: c, pin: pin, x: p.x, y: p.y, cap: cap };
      if (T.macro) macroSinks.push(s); else sinks.push(s);
    }
    var clkPort = D.ports.findIndex(function (p) { return p.n === clockName(D); });
    var rootPos = fp.pins[clkPort];
    var size = knobs.ctsSize || 10, diam = knobs.ctsDiam || 50;
    var ROOT = "BUFx16f_ASAP7_75t_R", LEAF = "BUFx24_ASAP7_75t_R", MID = "BUFx16f_ASAP7_75t_R";
    var HTREE_MAX = 15;                        /* a region this small ends the H-tree */
    function centre(list) {
      var cx = 0, cy = 0;
      list.forEach(function (s) { cx += s.x; cy += s.y; });
      return { x: cx / list.length, y: cy / list.length };
    }
    function spanOf(list) {
      var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      list.forEach(function (s) { x0 = Math.min(x0, s.x); x1 = Math.max(x1, s.x); y0 = Math.min(y0, s.y); y1 = Math.max(y1, s.y); });
      return { x0: x0, x1: x1, y0: y0, y1: y1, w: x1 - x0, h: y1 - y0 };
    }

    /* 1. clustering: the flip-flops cut into as few groups of at most
       "size" as will do, each no wider than "diam"; every cut keeps the
       two sides' counts in proportion to the groups they will make */
    function cluster(list) {
      var nC = Math.ceil(list.length / size), sp = spanOf(list);
      if (nC <= 1 && Math.hypot(sp.w, sp.h) <= diam) return [list];
      nC = Math.max(2, nC);
      var key = sp.w >= sp.h ? "x" : "y";
      var sorted = list.slice().sort(function (a, b) { return a[key] - b[key]; });
      var cut = Math.round(list.length * Math.floor(nC / 2) / nC);
      return cluster(sorted.slice(0, cut)).concat(cluster(sorted.slice(cut)));
    }
    var groups = cluster(sinks).map(function (list) {
      var q = centre(list);
      return { x: q.x, y: q.y, sinks: list, buf: LEAF, leaf: true };
    });

    /* 2. the H-tree over the clusters: the region is halved, across its
       longer side, level by level, until a region holds HTREE_MAX clusters
       or fewer; branch points sit at the region centres, so every branch
       at a level is the same length */
    var levels = 0;
    while (groups.length / Math.pow(2, levels) > HTREE_MAX) levels++;
    function htree(list, box, level) {
      var n = { x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2, level: level, kids: [] };
      if (level === levels) { n.kids = list; return n; }
      var alongX = box.x1 - box.x0 >= box.y1 - box.y0, mid = alongX ? n.x : n.y;
      var lo = list.filter(function (g) { return (alongX ? g.x : g.y) < mid; });
      var hi = list.filter(function (g) { return (alongX ? g.x : g.y) >= mid; });
      var bl = { x0: box.x0, x1: alongX ? mid : box.x1, y0: box.y0, y1: alongX ? box.y1 : mid };
      var bh = { x0: alongX ? mid : box.x0, x1: box.x1, y0: alongX ? box.y0 : mid, y1: box.y1 };
      if (lo.length) n.kids.push(htree(lo, bl, level + 1));
      if (hi.length) n.kids.push(htree(hi, bh, level + 1));
      return n;
    }
    var tree = htree(groups, spanOf(groups), 0);
    /* buffers: the root, and every branch point from the second level down
       (the first level's branches are short enough to ride on the root's) */
    var bufs = [];
    (function mark(n) {
      if (n.leaf) { bufs.push({ x: n.x, y: n.y, type: LEAF, leaf: true }); return; }
      n.buf = n.level === 0 ? ROOT : n.level >= 2 ? MID : null;
      if (n.buf) bufs.push({ x: n.x, y: n.y, type: n.buf, leaf: false });
      n.kids.forEach(mark);
    })(tree);
    /* one more at the clock pin, splitting the flip-flops' clock from the memories' */
    var split = { x: rootPos.x, y: rootPos.y, buf: ROOT, kids: [tree], level: -1 };
    bufs.push({ x: split.x, y: split.y, type: ROOT, leaf: false });

    /* 3. the memories get their own small tree: a root and a buffer for
       each pair */
    var macTree = null;
    if (macroSinks.length) {
      var mc = centre(macroSinks);
      var pairs = [], srt = macroSinks.slice().sort(function (a, b) { return a.x - b.x; });
      for (var i = 0; i < srt.length; i += 2) {
        var pq = srt.slice(i, i + 2), pc = centre(pq);
        pairs.push({ x: pc.x, y: pc.y, sinks: pq, buf: MID, leaf: true, mac: true });
        bufs.push({ x: pc.x, y: pc.y, type: MID, leaf: true, mac: true });
      }
      macTree = { x: mc.x, y: mc.y, buf: ROOT, kids: pairs, level: 0, mac: true };
      bufs.push({ x: mc.x, y: mc.y, type: ROOT, leaf: false, mac: true });
    }

    /* timing: each buffer drives the wire and pins down to the next
       buffers (through unbuffered branch points) or to its sinks; delay
       from the buffer's table, wire by Elmore */
    var W = WIRE.clock, latency = {}, slewAt = {}, wireLen = 0, segs = [];
    function manh(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
    function bufIn(type) { return LIB.cells[type].pins.A.cap; }
    function ends(n) {
      var out = [];
      if (n.leaf) { n.sinks.forEach(function (s) { out.push({ sink: s, len: manh(n, s) }); }); return out; }
      (function down(m, acc) {
        m.kids.forEach(function (kd) {
          var len = acc + manh(m, kd);
          segs.push([m.x, m.y, kd.x, kd.y, m.level]);
          if (kd.buf || kd.leaf) out.push({ node: kd, len: len });
          else down(kd, len);
        });
      })(n, 0);
      return out;
    }
    function drive(n, tIn, sIn) {
      var es = ends(n), arc = LIB.cells[n.buf].arcs[0], load = 0;
      es.forEach(function (e) {
        load += e.len * W.c + (e.sink ? e.sink.cap : bufIn(e.node.buf));
        wireLen += e.len;
        if (e.sink) segs.push([n.x, n.y, e.sink.x, e.sink.y, 9]);
      });
      var tOut = tIn + lookup(arc.dr, sIn, load), sOut = lookup(arc.sr, sIn, load);   /* the clock's rising edge */
      es.forEach(function (e) {
        var cEnd = e.sink ? e.sink.cap : bufIn(e.node.buf);
        var wd = W.r * e.len * (W.c * e.len / 2 + cEnd);
        var t = tOut + wd, sl = Math.sqrt(sOut * sOut + (2.2 * wd) * (2.2 * wd));
        if (e.sink) { latency[e.sink.cell] = t; slewAt[e.sink.cell] = sl; }
        else drive(e.node, t, sl);
      });
    }
    drive(split, 0, 10);
    var regLat = sinks.map(function (s) { return latency[s.cell]; });
    var lo = Math.min.apply(null, regLat), hi = Math.max.apply(null, regLat);
    var mean = regLat.reduce(function (a, b) { return a + b; }, 0) / regLat.length;
    /* 4. the memories' tree is balanced against the flip-flops': where it
       is faster, delay buffers go in at its root until it matches */
    var delayBufs = 0;
    if (macTree) {
      var ml = manh(rootPos, macTree);
      wireLen += ml;
      segs.push([rootPos.x, rootPos.y, macTree.x, macTree.y, -1]);
      drive(macTree, W.r * ml * (W.c * ml / 2 + bufIn(ROOT)), 10);
      var macLat = macroSinks.map(function (s) { return latency[s.cell]; });
      var gap = mean - Math.max.apply(null, macLat);
      if (gap > 0) {
        var DB = LIB.cells[MID].arcs[0], step = lookup(DB.dr, 20, bufIn(MID) + 1);
        delayBufs = Math.round(gap / step);
        macroSinks.forEach(function (s) { latency[s.cell] += delayBufs * step; });
        for (i = 0; i < delayBufs; i++) bufs.push({ x: macTree.x, y: macTree.y, type: MID, leaf: false, mac: true, delay: true });
      }
    }
    return { sinks: sinks.length + macroSinks.length, clusters: groups.length, levels: levels,
             buffers: bufs, delayBuffers: delayBufs, segs: segs, latency: latency, slew: slewAt,
             skew: hi - lo, minLat: lo, maxLat: hi, meanLat: mean, wireLen: wireLen };
  }

  /* =============== global routing =============== */
  function route(D, fp, pl, lg, clockTree) {
    var G = new Geometry(D, fp, pl, lg), gc = 1.0;
    var nx = Math.ceil(fp.W / gc), ny = Math.ceil(fp.H / gc);
    /* capacity of each edge between neighbouring cells of the grid */
    var trackH = 0, trackV = 0, lowH = 0, lowV = 0;
    LAYERS.forEach(function (l) {
      var t = Math.floor(gc / l.pitch) * (1 - ADJUST);
      if (l.dir === "H") { trackH += t; if (l.n === "M2" || l.n === "M4") lowH += t; }
      else { trackV += t; if (l.n === "M3") lowV += t; }
    });
    var capH = new Float32Array(nx * ny).fill(trackH), capV = new Float32Array(nx * ny).fill(trackV);
    var overMacro = new Uint8Array(nx * ny);       /* tiles where metal 1 to 4 belong to a memory */
    /* the memories own metal1 to metal4: over them, only the upper layers are free */
    fp.macros.forEach(function (m) {
      for (var j = Math.floor(m.y / gc); j <= Math.min(ny - 1, Math.floor((m.y + m.h) / gc)); j++)
        for (var i = Math.floor(m.x / gc); i <= Math.min(nx - 1, Math.floor((m.x + m.w) / gc)); i++) {
          capH[j * nx + i] = trackH - lowH; capV[j * nx + i] = trackV - lowV; overMacro[j * nx + i] = 1;
        }
    });
    var useH = new Float32Array(nx * ny), useV = new Float32Array(nx * ny);
    function gi(x) { return Math.min(nx - 1, Math.max(0, Math.floor(x / gc))); }
    function gj(y) { return Math.min(ny - 1, Math.max(0, Math.floor(y / gc))); }

    /* a path is a list of runs: horizontal (row j, i0..i1) or vertical */
    function runs(a, b, bend, via) {
      var ai = gi(a.x), aj = gj(a.y), bi = gi(b.x), bj = gj(b.y), out = [];
      if (via === "HV") { out.push(["H", aj, ai, bi]); out.push(["V", bi, aj, bj]); }
      else if (via === "VH") { out.push(["V", ai, aj, bj]); out.push(["H", bj, ai, bi]); }
      else if (via === "HVH") { out.push(["H", aj, ai, bend]); out.push(["V", bend, aj, bj]); out.push(["H", bj, bend, bi]); }
      else { out.push(["V", ai, aj, bend]); out.push(["H", bend, ai, bi]); out.push(["V", bi, bend, bj]); }
      return out;
    }
    function walk(rs, fn) {
      rs.forEach(function (r) {
        var lo = Math.min(r[2], r[3]), hi = Math.max(r[2], r[3]);
        for (var k = lo; k < hi; k++) fn(r[0], r[0] === "H" ? r[1] * nx + k : k * nx + r[1]);
      });
    }
    function cost(rs) {
      var c = 0;
      walk(rs, function (d, e) {
        var u = d === "H" ? useH[e] : useV[e], cap = d === "H" ? capH[e] : capV[e];
        c += u + 1 > cap ? 4 + 2 * (u + 1 - cap) : (u + 1) / Math.max(1, cap);
      });
      return c;
    }
    function add(rs, v) { walk(rs, function (d, e) { if (d === "H") useH[e] += v; else useV[e] += v; }); }
    function best(a, b) {
      var cands = [runs(a, b, 0, "HV"), runs(a, b, 0, "VH")];
      return cands.reduce(function (p, q) { return cost(p) <= cost(q) ? p : q; });
    }
    function zBest(a, b) {
      var cands = [runs(a, b, 0, "HV"), runs(a, b, 0, "VH")];
      var ai = gi(a.x), bi = gi(b.x), aj = gj(a.y), bj = gj(b.y);
      for (var s = 1; s < 6; s++) {
        var bx = Math.round(ai + (bi - ai) * s / 6), by = Math.round(aj + (bj - aj) * s / 6);
        cands.push(runs(a, b, bx, "HVH"), runs(a, b, by, "VHV"));
      }
      return cands.reduce(function (p, q) { return cost(p) <= cost(q) ? p : q; });
    }

    /* every net, split into two-pin connections by Prim's spanning tree */
    var conns = [], netLen = new Float32Array(D.nets.length);
    D.nets.forEach(function (net, ni) {
      if (ni === D.clockNet) return;
      var pts = [];
      for (var k = 0; k < net.length; k += 2) pts.push(G.pos(net[k], net[k + 1]));
      var inTree = [0], rest = pts.map(function (_, i) { return i; }).slice(1);
      var bestD = rest.map(function (i) { return dist(pts[0], pts[i]); }), from = rest.map(function () { return 0; });
      while (rest.length) {
        var bi = 0;
        for (var q = 1; q < rest.length; q++) if (bestD[q] < bestD[bi]) bi = q;
        var v = rest[bi];
        conns.push({ net: ni, a: pts[from[bi]], b: pts[v], len: bestD[bi] });
        rest.splice(bi, 1); bestD.splice(bi, 1); from.splice(bi, 1);
        for (q = 0; q < rest.length; q++) {
          var dd = dist(pts[v], pts[rest[q]]);
          if (dd < bestD[q]) { bestD[q] = dd; from[q] = v; }
        }
        inTree.push(v);
      }
    });
    function dist(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
    /* short connections first, then rip up and reroute what crosses an overfull edge */
    conns.sort(function (p, q) { return p.len - q.len; });
    conns.forEach(function (c) { c.rs = best(c.a, c.b); add(c.rs, 1); });
    function over(rs) {
      var bad = false;
      walk(rs, function (d, e) { if ((d === "H" ? useH[e] > capH[e] : useV[e] > capV[e])) bad = true; });
      return bad;
    }
    for (var pass = 0; pass < 3; pass++) {
      conns.forEach(function (c) {
        if (!over(c.rs)) return;
        add(c.rs, -1);
        c.rs = zBest(c.a, c.b);
        add(c.rs, 1);
      });
    }
    /* totals: length per connection is its grid path; each part goes to a
       layer by length, the way layer assignment keeps long wires high */
    var layerLen = { M2: 0, M3: 0, M4: 0, M5: 0, M6: 0, M7: 0 }, vias = 0, total = 0;
    /* for drawing: every piece of wire as [x0, y0, x1, y1, metal number]
       through the tile centres, and every via as [x, y, from metal, to metal] */
    var wires = [], viaAt = [];
    function centre(k) { return (k + 0.5) * gc; }
    conns.forEach(function (c) {
      var len = 0, prev = 1, px = 0, py = 0, first = true;
      c.rs.forEach(function (r) {
        var l = Math.abs(r[3] - r[2]) * gc, pair = l < 4 ? ["M2", "M3"] : l < 20 ? ["M4", "M5"] : ["M6", "M7"];
        /* a piece crossing a memory must stay above its metal 4 */
        var blocked = false;
        for (var k = Math.min(r[2], r[3]); k <= Math.max(r[2], r[3]) && !blocked; k++)
          blocked = !!overMacro[r[0] === "H" ? r[1] * nx + k : k * nx + r[1]];
        if (blocked && pair[0] !== "M6") pair = r[0] === "H" ? ["M6", "M7"] : ["M4", "M5"];
        var name = r[0] === "H" ? pair[0] : pair[1];
        layerLen[name] += l;
        len += l;
        if (!l) return;
        var metal = +name.slice(1);
        var x0 = r[0] === "H" ? centre(r[2]) : centre(r[1]), y0 = r[0] === "H" ? centre(r[1]) : centre(r[2]);
        var x1 = r[0] === "H" ? centre(r[3]) : centre(r[1]), y1 = r[0] === "H" ? centre(r[1]) : centre(r[3]);
        wires.push(x0, y0, x1, y1, metal);
        viaAt.push(x0, y0, Math.min(prev, metal), Math.max(prev, metal));   /* down to the last piece, or to the pin */
        prev = metal; px = x1; py = y1; first = false;
      });
      if (!first) viaAt.push(px, py, 1, prev);    /* and down to the far pin */
      /* the grid rounds short hops to nothing; count at least the true distance */
      len = Math.max(len, c.len);
      netLen[c.net] += len;
      total += len;
      vias += 2 + (c.rs.length - 1);
    });
    var overflow = 0, overEdges = 0, ratio = new Float32Array(nx * ny);
    for (var e = 0; e < nx * ny; e++) {
      var oh = Math.max(0, useH[e] - capH[e]), ov = Math.max(0, useV[e] - capV[e]);
      overflow += oh + ov; if (oh + ov > 0) overEdges++;
      ratio[e] = Math.max(useH[e] / Math.max(1, capH[e]), useV[e] / Math.max(1, capV[e]));
    }
    return { gc: gc, nx: nx, ny: ny, ratio: ratio, total: total + clockTree.wireLen, signal: total,
             clock: clockTree.wireLen, layerLen: layerLen, vias: vias, overflow: overflow, overEdges: overEdges,
             netLen: netLen, conns: conns.length, wires: Float32Array.from(wires), viaAt: Float32Array.from(viaAt),
             paths: conns.map(function (c) { return c.rs; }) };
  }

  /* =============== repair: buffers and gate sizes ===============
     Between placement and timing the real flow repairs the netlist, in the
     order OpenROAD's resizer does it:
       1. buffer_ports: a small buffer on every input and output port;
       2. repair_design: a net whose load is more than its driver may drive
          (max_capacitance) or whose edges are too slow (max_transition) is
          split into groups, each with its own buffer; the driver is then
          resized to the smallest version of itself fast enough for what is
          left (resizeToTargetSlew);
       3. repair_timing: a stage still slow after that gets one strong buffer
          in front of its loads.
     The engine does each step on estimates (placement order for the groups,
     the routed length for the wire), so it predicts how many buffers and
     resized gates there are and the delay each load sees; it does not make
     the tree itself. */
  var REPAIR = { design: "BUFx6f_ASAP7_75t_R", timing: "BUFx6f_ASAP7_75t_R", port: "BUFx2_ASAP7_75t_R",
                 maxSlew: 320, use: 0.6, targetSlew: 60, inSlew: 30 };

  function sizes(LIB) {                          /* each gate's usable sizes, smallest first */
    var fam = {};
    Object.keys(LIB.cells).forEach(function (nm) {
      var c = LIB.cells[nm];
      if (c.dontUse || !c.family) return;
      (fam[c.family] = fam[c.family] || []).push(nm);
    });
    Object.keys(fam).forEach(function (f) { fam[f].sort(function (a, b) { return LIB.cells[a].area - LIB.cells[b].area; }); });
    return fam;
  }
  function slewInto(L, pinName, load) {          /* the slowest edge out of a pin on a load */
    var worst = 0;
    L.arcs.forEach(function (a) { if (a.to === pinName) worst = Math.max(worst, lookup(a.s, REPAIR.inSlew, load)); });
    return worst;
  }
  function delayInto(L, pinName, load) {         /* the slowest delay to a pin on a load */
    var worst = 0;
    L.arcs.forEach(function (a) { if (a.to === pinName) worst = Math.max(worst, lookup(a.d, REPAIR.inSlew, load)); });
    return worst;
  }
  function capAt(L, pinName, slewLimit) {        /* the most load a pin drives within a slew */
    var lo = 0, hi = (L.pins[pinName] && L.pins[pinName].maxCap) || 100;
    for (var k = 0; k < 30; k++) { var mid = (lo + hi) / 2; if (slewInto(L, pinName, mid) <= slewLimit) lo = mid; else hi = mid; }
    return lo;
  }
  /* loads cut, in placement order, into groups one buffer each can drive; if
     the driver still has too much to drive, the buffers are grouped a level up */
  function bufferTree(LIB, type, groupCap, drvOk, loads, wireC) {
    var B = LIB.cells[type], bArc = B.arcs[0], bIn = B.pins.A.cap;
    var perPin = wireC / Math.max(1, loads.length);          /* each load's share of the wire */
    var order = loads.slice().sort(function (p, q) { return (p.y - q.y) || (p.x - q.x); });
    var levels = [], items = order.map(function (l) { return { x: l.x, y: l.y, cap: l.cap + perPin, kids: [l] }; });
    for (var guard = 0; guard < 6; guard++) {
      var groups = [], g = null;
      items.forEach(function (it) {
        if (!g || g.cap + it.cap > groupCap) { g = { cap: 0, x: 0, y: 0, kids: [] }; groups.push(g); }
        g.cap += it.cap; g.x += it.x; g.y += it.y; g.kids.push(it);
      });
      groups.forEach(function (q) { q.x /= q.kids.length; q.y /= q.kids.length; });
      levels.push(groups);
      var up = groups.length * bIn + wireC * 0.1;
      items = groups.map(function (q) { return { x: q.x, y: q.y, cap: bIn + perPin, kids: [q] }; });
      if (drvOk(up) || groups.length === 1) break;
    }
    /* the delay from the driver's pin to each load, down the levels */
    /* a buffer passes each edge through as itself: a rising edge in, a
       rising edge out, so the two are followed separately */
    var top = levels[levels.length - 1], extra = new Map(), slewAt = new Map(), buffers = [];
    (function down(nodes, t, sIn, depth) {
      nodes.forEach(function (q) {
        buffers.push({ x: q.x, y: q.y, type: type });
        var d = [lookup(bArc.dr, sIn[0], q.cap), lookup(bArc.df, sIn[1], q.cap)];
        var so = [lookup(bArc.sr, sIn[0], q.cap), lookup(bArc.sf, sIn[1], q.cap)];
        var tt = [t[0] + d[0], t[1] + d[1]];
        if (depth === 0) q.kids.forEach(function (it) { extra.set(it.kids[0], tt); slewAt.set(it.kids[0], so); });
        else down(q.kids.map(function (it) { return it.kids[0]; }), tt, so, depth - 1);
      });
    })(top, [0, 0], [40, 40], levels.length - 1);
    return { drvLoad: top.length * bIn + wireC * 0.1, extra: extra, slew: slewAt, buffers: buffers, levels: levels.length };
  }

  function repair(D, LIB, fp, pl, lg, rt) {
    prepareLib(LIB);
    var G = new Geometry(D, fp, pl, lg), W = WIRE.signal, fams = sizes(LIB);
    var sized = {}, plan = [], counts = { ports: 0, design: 0, designNets: 0, timing: 0, timingNets: 0, upsized: 0, area: 0 };
    var PB = LIB.cells[REPAIR.port];
    function typeOf(cell) { return sized[cell] || D.types[D.cells[cell]].n; }
    function capOf(cell, pin) {
      if (cell < 0) return PB.pins.A.cap;         /* an output port: its port buffer's input */
      var L = LIB.cells[typeOf(cell)], nm = libPin(L, D.types[D.cells[cell]].pins[pin]);
      return nm && L.pins[nm] ? L.pins[nm].cap : 0.5;
    }
    D.ports.forEach(function (p) { if (p.n !== clockName(D)) counts.ports++; });
    counts.area += counts.ports * PB.area;
    D.nets.forEach(function (net, ni) {
      if (ni === D.clockNet) return;
      var drv = -1, loads = [];
      for (var k = 0; k < net.length; k += 2) {
        var cell = net[k], pin = net[k + 1];
        var isDrv = cell < 0 ? D.ports[pin].d === "I" : D.types[D.cells[cell]].dirs[pin] === "O";
        if (isDrv && drv < 0) drv = k; else loads.push(k);
      }
      if (drv < 0) return;
      var dc = net[drv], dp = net[drv + 1], wireC = rt.netLen[ni] * W.c;
      var ls = loads.map(function (k) {
        var lc = net[k], lp = net[k + 1], pos = G.pos(lc, lp);
        return { cell: lc, pin: lp, x: pos.x, y: pos.y, cap: capOf(lc, lp) };
      });
      var total = wireC + ls.reduce(function (t, l) { return t + l.cap; }, 0);
      /* the driver: a cell's output, or an input port's buffer */
      var L0 = dc < 0 ? PB : LIB.cells[D.types[D.cells[dc]].n];
      var pn = dc < 0 ? "Y" : libPin(L0, D.types[D.cells[dc]].pins[dp]);
      /* 2. repair_design. First the driver is resized to the smallest
         version of itself fast enough for its load (OpenROAD does this
         "to normalize slews before repairing limit violations")... */
      var L = L0;
      if (dc >= 0 && L0.family && fams[L0.family] && slewInto(L0, pn, total) > REPAIR.targetSlew) {
        var list = fams[L0.family], pick = null;
        for (var q = 0; q < list.length; q++) {
          if (LIB.cells[list[q]].area <= L0.area) continue;
          pick = list[q];
          if (slewInto(LIB.cells[pick], pn, total) <= REPAIR.targetSlew) break;
        }
        if (pick && (!sized[dc] || LIB.cells[pick].area > LIB.cells[sized[dc]].area)) {
          if (!sized[dc]) counts.upsized++;
          counts.area += LIB.cells[pick].area - LIB.cells[sized[dc] || D.types[D.cells[dc]].n].area;
          sized[dc] = pick;
          L = LIB.cells[pick];
        }
      }
      /* ... and only a net that still breaks the resized driver's limits
         is split and buffered */
      var maxCap = (L.pins[pn] && L.pins[pn].maxCap) || 1e9, fix = null;
      function designOk(c) { return c <= maxCap && slewInto(L, pn, c) <= REPAIR.maxSlew; }
      if (!designOk(total)) {
        /* the resizer sizes these buffers too: each group is what one
           buffer drives with an edge as fast as the target */
        var BD = LIB.cells[REPAIR.design];
        fix = bufferTree(LIB, REPAIR.design, capAt(BD, "Y", REPAIR.targetSlew), designOk, ls, wireC);
        counts.design += fix.buffers.length; counts.designNets++;
      }
      var drvLoad = fix ? fix.drvLoad : total;
      /* 3. repair_timing: still slow, and more than one load to split off */
      if (!fix && ls.length > 1 && slewInto(L, pn, drvLoad) > REPAIR.targetSlew) {
        var BT = LIB.cells[REPAIR.timing];
        var tfix = bufferTree(LIB, REPAIR.timing, capAt(BT, "Y", REPAIR.targetSlew),
                              function (c) { return slewInto(L, pn, c) <= REPAIR.targetSlew; }, ls, wireC);
        /* kept only if the loads see their edge sooner than without it */
        var before = delayInto(L, pn, drvLoad), after = delayInto(L, pn, tfix.drvLoad), late = 0;
        tfix.extra.forEach(function (t) { late = Math.max(late, t[0], t[1]); });
        if (after + late < before) {
          fix = tfix;
          counts.timing += fix.buffers.length; counts.timingNets++;
        }
      }
      if (fix) fix.buffers.forEach(function (b) { counts.area += LIB.cells[b.type].area; b.net = ni; });
      plan[ni] = { dc: dc, dp: dp, ls: ls, wireC: wireC, fix: fix };
    });
    var buffers = [];
    plan.forEach(function (p) { if (p && p.fix) p.fix.buffers.forEach(function (b) { buffers.push(b); }); });
    return { sized: sized, plan: plan, buffers: buffers, counts: counts, portType: REPAIR.port };
  }

  /* =============== static timing =============== */
  function sta(D, LIB, fp, pl, lg, tree, rt, period, rep) {
    var G = new Geometry(D, fp, pl, lg), W = WIRE.signal;
    var n = D.cells.length, latency = tree.latency;
    rep = rep || repair(D, LIB, fp, pl, lg, rt);
    var PB = LIB.cells[REPAIR.port];
    /* pin ids: cells' pins first, then ports */
    var base = new Int32Array(n + 1);
    for (var c = 0; c < n; c++) base[c + 1] = base[c] + D.types[D.cells[c]].pins.length;
    var nPins = base[n] + D.ports.length;
    function id(cell, pin) { return cell < 0 ? base[n] + pin : base[cell] + pin; }
    /* every pin has two arrival times, one for a rising edge (node 2p) and
       one for a falling edge (node 2p+1), each with its own slew */
    var arr = new Float64Array(2 * nPins).fill(-Infinity), slew = new Float64Array(2 * nPins).fill(10);
    var pred = new Int32Array(2 * nPins).fill(-1), fanin = new Int32Array(nPins);
    var load = new Float64Array(nPins);            /* capacitance each driver sees */
    var edges = [];                                /* [to, wire delay(s) or arc, slews after] */
    for (var i = 0; i < nPins; i++) edges.push([]);
    function libOf(cell) { return LIB.cells[rep.sized[cell] || D.types[D.cells[cell]].n]; }
    var netAt = new Int32Array(nPins).fill(-1);    /* driver pin -> its net */
    /* nets: driver to each load, through the repair's buffers where it put them */
    rep.plan.forEach(function (p, ni) {
      if (!p) return;
      var dpos = G.pos(p.dc, p.dp), did = id(p.dc, p.dp), pinC = 0;
      p.ls.forEach(function (l) {
        var len = Math.abs(dpos.x - l.x) + Math.abs(dpos.y - l.y), to = id(l.cell, l.pin);
        pinC += l.cap;
        if (p.fix) edges[did].push([to, p.fix.extra.get(l), p.fix.slew.get(l)]);
        else { var wd = W.r * len * (W.c * len / 2 + l.cap); edges[did].push([to, [wd, wd], null]); }
        fanin[to]++;
      });
      load[did] = p.fix ? p.fix.drvLoad : p.wireC + pinC;
      netAt[did] = ni;
    });
    /* cells: an arc from each input to each output it drives; flip-flop and
       memory outputs start paths at the clock instead */
    var starts = [], ends = [];
    for (c = 0; c < n; c++) {
      var T = D.types[D.cells[c]], L = libOf(c);
      if (!L) continue;
      var pinIndex = {};
      T.pins.forEach(function (nm, k) { pinIndex[nm] = k; });
      L.arcs.forEach(function (a) {
        T.pins.forEach(function (nm, k) {
          if (libPin(L, nm) !== a.to) return;
          var outId = id(c, k);
          if (a.clk) { starts.push({ pin: outId, cell: c, arc: a }); return; }
          var inK = pinIndex[a.from];
          if (inK === undefined) return;
          edges[id(c, inK)].push([outId, a]);
          fanin[outId]++;
        });
      });
      L.checks.forEach(function (ch) {
        if (ch.type !== "setup") return;
        T.pins.forEach(function (nm, k) { if (libPin(L, nm) === ch.pin) ends.push({ pin: id(c, k), cell: c, check: ch }); });
      });
    }
    function set(node, t, sl, from) {
      if (t > arr[node]) { arr[node] = t; slew[node] = sl; pred[node] = from; }
    }
    /* sources: clocked outputs launch on the clock's rising edge, plus the
       clock-to-output delay, either edge; input ports at the input delay */
    var C = sdcOf(D), io = C.ioPct * period;
    starts.forEach(function (s) {
      var clkT = latency[s.cell] !== undefined ? latency[s.cell] : C.latency;
      var cs = tree.slew[s.cell] || 20, ld = load[s.pin] || 1, a = s.arc;
      set(2 * s.pin, clkT + lookup(a.dr, cs, ld), lookup(a.sr, cs, ld), -1);
      set(2 * s.pin + 1, clkT + lookup(a.df, cs, ld), lookup(a.sf, cs, ld), -1);
    });
    D.ports.forEach(function (p, k) {                /* input ports, through their buffer */
      if (p.d !== "I" || p.n === clockName(D)) return;
      var pid = base[n] + k, a = PB.arcs[0], ld = load[pid] || 1;
      set(2 * pid, C.latency + io + lookup(a.dr, 0, ld), lookup(a.sr, 0, ld), -1);
      set(2 * pid + 1, C.latency + io + lookup(a.df, 0, ld), lookup(a.sf, 0, ld), -1);
    });
    /* propagate in topological order */
    var queue = [], seen = 0, order = [];
    for (i = 0; i < nPins; i++) if (fanin[i] === 0) queue.push(i);
    /* each step from one pin's edge to the next: [from node, to node, delay] */
    function steps(u, e, fn) {
      var v = e[0];
      if (Array.isArray(e[1])) {                   /* a wire (or the repair's buffers on it) */
        for (var x = 0; x < 2; x++) fn(2 * u + x, 2 * v + x, e[1][x], e[2] ? e[2][x] : slew[2 * u + x]);
      } else {                                     /* a cell arc: which input edge makes which output edge */
        var A = e[1], ld = load[v] || 0.5;
        for (var o = 0; o < 2; o++) {              /* o: the output's edge, 0 rising, 1 falling */
          var ins = A.sense === "positive" ? [o] : A.sense === "negative" ? [1 - o] : [0, 1];
          ins.forEach(function (x) {
            var fromN = 2 * u + x;
            if (!isFinite(arr[fromN])) return;
            fn(fromN, 2 * v + o, lookup(o ? A.df : A.dr, slew[fromN], ld), lookup(o ? A.sf : A.sr, slew[fromN], ld));
          });
        }
      }
    }
    while (queue.length) {
      var u = queue.pop();
      seen++; order.push(u);
      edges[u].forEach(function (e) {
        steps(u, e, function (fromN, toN, d, sl) { if (isFinite(arr[fromN])) set(toN, arr[fromN] + d, sl, fromN); });
        if (--fanin[e[0]] === 0) queue.push(e[0]);
      });
    }
    /* endpoints: flip-flop and memory inputs against the capturing clock
       edge, a rising and a falling data edge each with its own setup time;
       output ports against the output delay */
    var slacks = [], worst = null, tns = 0;
    var req = new Float64Array(2 * nPins).fill(Infinity);   /* required times, for the backward pass */
    function need(node, t) { if (t < req[node]) req[node] = t; }
    function endpoint(node, sl, at, req) {
      slacks.push(sl);
      if (!worst || sl < worst.slack) worst = { node: node, pin: node >> 1, slack: sl, arrival: at, required: req };
      if (sl < 0) tns += sl;
    }
    ends.forEach(function (en) {
      var capT = (latency[en.cell] !== undefined ? latency[en.cell] : C.latency) + period;
      var cs = tree.slew[en.cell] || 20, best = null;
      for (var x = 0; x < 2; x++) {
        var nd = 2 * en.pin + x;
        if (!isFinite(arr[nd])) continue;
        var su = lookup(x ? en.check.tf : en.check.tr, cs, slew[nd]), sl = capT - su - arr[nd];
        need(nd, capT - su);
        if (!best || sl < best.sl) best = { nd: nd, sl: sl, req: capT - su };
      }
      if (best) endpoint(best.nd, best.sl, arr[best.nd], best.req);
    });
    D.ports.forEach(function (p, k) {
      if (p.d !== "O") return;
      var pid = base[n] + k, best = null, req = C.latency + period - io;
      for (var x = 0; x < 2; x++) {
        var nd = 2 * pid + x;
        if (!isFinite(arr[nd])) continue;
        var pbd = lookup(x ? PB.arcs[0].df : PB.arcs[0].dr, slew[nd], 2), at = arr[nd] + pbd;   /* through its port buffer */
        need(nd, req - pbd);
        if (!best || req - at < best.sl) best = { nd: nd, sl: req - at, at: at };
      }
      if (best) endpoint(best.nd, best.sl, best.at, req);
    });
    /* required times, back from the endpoints in reverse order; a net's
       slack is its driver's, the least time it has to spare */
    for (var oi = order.length - 1; oi >= 0; oi--) {
      var uu = order[oi];
      edges[uu].forEach(function (e) {
        steps(uu, e, function (fromN, toN, d) { if (isFinite(req[toN])) need(fromN, req[toN] - d); });
      });
    }
    var netSlack = new Float32Array(D.nets.length).fill(Infinity);
    for (i = 0; i < nPins; i++) {
      if (netAt[i] < 0) continue;
      for (var x = 0; x < 2; x++) {
        var nd = 2 * i + x;
        if (isFinite(arr[nd]) && isFinite(req[nd])) netSlack[netAt[i]] = Math.min(netSlack[netAt[i]], req[nd] - arr[nd]);
      }
    }
    /* the worst path, walked back from its endpoint */
    var path = [], at = worst ? worst.node : -1;
    function cellOfPin(p) {
      if (p >= base[n]) return -1;
      var lo = 0, hi = n;
      while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (base[mid] <= p) lo = mid; else hi = mid; }
      return lo;
    }
    while (at >= 0) {
      var pin = at >> 1, cl = cellOfPin(pin);
      path.push({ pin: pin, edge: at & 1 ? "fall" : "rise", cell: cl, t: arr[at], slew: slew[at],
                  port: cl < 0 ? D.ports[pin - base[n]].n : null,
                  type: cl >= 0 ? libOf(cl) && (rep.sized[cl] || D.types[D.cells[cl]].n) : null,
                  pinName: cl >= 0 ? D.types[D.cells[cl]].pins[pin - base[cl]] : null,
                  pos: cl >= 0 ? G.pos(cl, pin - base[cl]) : fp.pins[pin - base[n]] });
      at = pred[at];
    }
    path.reverse();
    var failing = slacks.filter(function (s) { return s < 0; }).length;
    return { period: period, wns: worst ? worst.slack : 0, tns: tns, endpoints: slacks.length, failing: failing,
             slacks: slacks, worst: worst, path: path, visited: seen, pins: nPins, load: load, netSlack: netSlack, arr: arr, req: req, slewOf: slew, base: base,
             repair: rep };
  }

  /* =============== repair_timing: upsizing along failing paths ===============
     After the clock tree the real flow runs repair_timing: while there are
     failing endpoints it walks their paths and tries moves on the gates
     there, the main one a bigger size of the same gate. Here each pass
     times the design, takes the drivers of the failing nets, worst first,
     and gives each the next size up; it stops when nothing fails, when a
     pass does not help, or after "passes" passes. */
  var UPSTREAM = 2.0;   /* ps per fF of input capacitance: roughly what a small gate pays to drive it */
  function stageCost(L, load) {
    var d = 0, cin = 0;
    L.arcs.forEach(function (a) { if (!a.clk) d = Math.max(d, lookup(a.d, REPAIR.inSlew, load)); });
    Object.keys(L.pins).forEach(function (k) { if (L.pins[k].dir === "I") cin = Math.max(cin, L.pins[k].cap); });
    return d + UPSTREAM * cin;
  }
  /* Two moves on a failing net, both rebuilt each pass from the net as the
     earlier repair left it (p.orig), using the current slack of every pin:
       split: on a net with no buffers, pins with time to spare go behind a
         new buffer at their centre, so the driver carries less and its
         critical pins see their edge sooner (OpenROAD's SplitLoadMove);
       isolate: on a net the load repair already buffered, the few critical
         pins come out of the buffer tree and the driver feeds them directly,
         when it can take the extra load (what rebuffering does). */
  var SPLIT = { spare: 20, minShare: 0.25, isolateMax: 4 };
  function pinSlack(T, l) {
    var n = T.base.length - 1, pid = l.cell < 0 ? T.base[n] + l.pin : T.base[l.cell] + l.pin, best = Infinity;
    for (var x = 0; x < 2; x++) {
      var nd = 2 * pid + x;
      if (isFinite(T.arr[nd]) && isFinite(T.req[nd])) best = Math.min(best, T.req[nd] - T.arr[nd]);
    }
    return best;
  }
  function direct(dpos, l) {                     /* a pin fed straight from the driver: the wire's delay */
    var W = WIRE.signal, len = Math.abs(dpos.x - l.x) + Math.abs(dpos.y - l.y), wd = W.r * len * (W.c * len / 2 + l.cap);
    return [wd, wd];
  }
  function splitLoad(LIB, G, p, T, ni, bufs) {
    if (p.ls.length < 3) return null;
    var W = WIRE.signal, dpos = G.pos(p.dc, p.dp), perPin = p.wireC / p.ls.length;
    var keep = [], move = [];
    p.ls.forEach(function (l) { (pinSlack(T, l) > T.netSlack[ni] + SPLIT.spare ? move : keep).push(l); });
    var total = p.wireC + p.ls.reduce(function (a, l) { return a + l.cap; }, 0);
    var moved = move.reduce(function (a, l) { return a + l.cap + perPin; }, 0);
    if (!keep.length || move.length < 2 || moved < SPLIT.minShare * total) return null;
    var B = null;
    for (var i = 0; i < bufs.length && !B; i++) if (slewInto(LIB.cells[bufs[i]], "Y", moved) <= REPAIR.targetSlew) B = bufs[i];
    B = B || bufs[bufs.length - 1];
    var BL = LIB.cells[B], arc = BL.arcs[0], cx = 0, cy = 0;
    move.forEach(function (l) { cx += l.x; cy += l.y; });
    cx /= move.length; cy /= move.length;
    var extra = new Map(), slewAt = new Map();
    keep.forEach(function (l) { extra.set(l, direct(dpos, l)); });
    var toBuf = Math.abs(dpos.x - cx) + Math.abs(dpos.y - cy), wb = W.r * toBuf * (W.c * toBuf / 2 + BL.pins.A.cap);
    move.forEach(function (l) {
      extra.set(l, [wb + lookup(arc.dr, 30, moved), wb + lookup(arc.df, 30, moved)]);
      slewAt.set(l, [lookup(arc.sr, 30, moved), lookup(arc.sf, 30, moved)]);
    });
    return { drvLoad: keep.reduce(function (a, l) { return a + l.cap + perPin; }, 0) + BL.pins.A.cap + toBuf * W.c,
             extra: extra, slew: slewAt, levels: 1, kind: "split",
             buffers: [{ x: cx, y: cy, type: B, net: ni, split: true }] };
  }
  function isolate(LIB, G, p, T, ni, driverLib, pinName) {
    var base = p.orig, perPin = p.wireC / p.ls.length, dpos = G.pos(p.dc, p.dp);
    var crit = p.ls.filter(function (l) { return pinSlack(T, l) <= T.netSlack[ni] + SPLIT.spare; });
    if (!crit.length || crit.length > SPLIT.isolateMax || crit.length === p.ls.length) return null;
    var load = base.drvLoad + crit.reduce(function (a, l) { return a + l.cap + perPin; }, 0);
    var P = driverLib.pins[pinName];
    if ((P && P.maxCap && load > P.maxCap) || slewInto(driverLib, pinName, load) > REPAIR.maxSlew) return null;
    var extra = new Map(base.extra), slewAt = new Map(base.slew);
    crit.forEach(function (l) { extra.set(l, direct(dpos, l)); slewAt.delete(l); });
    return { drvLoad: load, extra: extra, slew: slewAt, levels: base.levels, kind: "isolate",
             buffers: base.buffers };
  }

  function repairTiming(D, LIB, fp, pl, lg, tree, rt, period, rep, passes) {
    var fams = sizes(LIB), G = new Geometry(D, fp, pl, lg);
    var bufs = (fams.BUF || []).filter(function (b) { return LIB.cells[b].pins.A.cap < 1.5; });   /* the small buffers */
    var T = sta(D, LIB, fp, pl, lg, tree, rt, period, rep), hist = [T.wns];
    var resized = 0;
    rep.plan.forEach(function (p) { if (p) p.orig = p.fix; });
    var sizeOnly = false;                         /* after a pass that did not help: resizing alone */
    for (var pass = 0; pass < (passes || 8) && T.wns < 0; pass++) {
      var bad = [];
      T.netSlack.forEach(function (sl, ni) { if (sl < 0 && rep.plan[ni] && rep.plan[ni].dc >= 0) bad.push(ni); });
      bad.sort(function (a, b) { return T.netSlack[a] - T.netSlack[b]; });
      /* everything this pass changes, so it can be undone */
      var sizedBefore = Object.assign({}, rep.sized), areaBefore = rep.counts.area, fixBefore = [];
      var changed = {}, madeSize = 0;
      /* first, rearrange the failing nets' loads */
      if (!sizeOnly) bad.forEach(function (ni) {
        var p = rep.plan[ni], L = LIB.cells[rep.sized[p.dc] || D.types[D.cells[p.dc]].n];
        var pn = libPin(L, D.types[D.cells[p.dc]].pins[p.dp]);
        var f = p.orig ? isolate(LIB, G, p, T, ni, L, pn) : splitLoad(LIB, G, p, T, ni, bufs);
        if (!f) return;
        fixBefore.push([ni, p.fix]);
        p.fix = f;
      });
      /* then make the failing nets' drivers stronger */
      bad.forEach(function (ni) {
        var dc = rep.plan[ni].dc;
        if (changed[dc]) return;
        var cur = rep.sized[dc] || D.types[D.cells[dc]].n, L = LIB.cells[cur];
        var list = L.family && fams[L.family];
        if (!list) return;
        /* the next size up that is actually faster on this load, counting
           what its bigger inputs cost the gates driving them */
        var at = list.indexOf(cur), next = null, pl0 = rep.plan[ni];
        var ld = pl0.fix ? pl0.fix.drvLoad : T.load[T.base[dc] + pl0.dp], was = stageCost(L, ld);
        for (var q = at + 1; q < list.length && !next; q++) {
          var Lq = LIB.cells[list[q]];
          if (Lq.area > L.area && stageCost(Lq, ld) < was) next = list[q];
        }
        if (!next) return;
        rep.sized[dc] = next; changed[dc] = true; madeSize++;
        rep.counts.area += LIB.cells[next].area - L.area;
      });
      if (!madeSize && !fixBefore.length) break;
      var T2 = sta(D, LIB, fp, pl, lg, tree, rt, period, rep);
      if (T2.wns <= T.wns && T2.tns <= T.tns) {    /* no better: undo the whole pass */
        rep.sized = sizedBefore; rep.counts.area = areaBefore;
        fixBefore.forEach(function (x) { rep.plan[x[0]].fix = x[1]; });
        if (sizeOnly) break;                        /* resizing alone did not help either: stop */
        sizeOnly = true;
        continue;
      }
      sizeOnly = false;
      resized += madeSize; T = T2; hist.push(T.wns);
    }
    /* what the moves left behind: the split buffers join the repair's others */
    var splits = 0, isolated = 0;
    rep.plan.forEach(function (p) {
      if (!p || !p.fix) return;
      if (p.fix.kind === "split") {
        splits++;
        rep.buffers.push(p.fix.buffers[0]);
        rep.counts.area += LIB.cells[p.fix.buffers[0].type].area;
      }
      if (p.fix.kind === "isolate") isolated++;
    });
    rep.counts.timingResized = resized;
    rep.counts.splits = splits;
    rep.counts.isolated = isolated;
    rep.counts.timing += splits;
    T.repairHistory = hist;
    return T;
  }



  /* =============== timing during placement ===============
     Before there are routes, a net's wire is estimated from where its pins
     are: the half-perimeter of their bounding box, stretched for nets with
     many pins the way a Steiner tree is longer than that box. The clock is
     ideal (no tree yet), as the real flow times it at this point. */
  function estimateLengths(D, fp, pl, lg) {
    var G = new Geometry(D, fp, pl, lg), netLen = new Float32Array(D.nets.length);
    D.nets.forEach(function (net, ni) {
      if (ni === D.clockNet) return;
      var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, p = net.length / 2;
      for (var k = 0; k < net.length; k += 2) {
        var q = G.pos(net[k], net[k + 1]);
        x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y);
      }
      netLen[ni] = ((x1 - x0) + (y1 - y0)) * (p <= 3 ? 1 : 1 + 0.25 * Math.log2(p / 3));
    });
    return { netLen: netLen };
  }
  var TIMING_NETS = 0.10, TIMING_WEIGHT_MAX = 1.9;   /* global_placement's defaults */
  function timingWeights(D, LIB, fp, pl, lg, period) {
    var rt = estimateLengths(D, fp, pl, lg), ideal = { latency: {}, slew: {} };
    var T = sta(D, LIB, fp, pl, lg, ideal, rt, period);
    var ranked = [];
    T.netSlack.forEach(function (s, ni) { if (isFinite(s)) ranked.push(ni); });
    ranked.sort(function (a, b) { return T.netSlack[a] - T.netSlack[b]; });
    var k = Math.max(1, Math.floor(ranked.length * TIMING_NETS));
    var sMin = T.netSlack[ranked[0]], sCut = T.netSlack[ranked[k - 1]];
    var weights = new Float32Array(D.nets.length).fill(1);
    for (var i = 0; i < k; i++) {
      var s = T.netSlack[ranked[i]];
      weights[ranked[i]] = sCut > sMin ? 1 + (TIMING_WEIGHT_MAX - 1) * (sCut - s) / (sCut - sMin) : TIMING_WEIGHT_MAX;
    }
    return { weights: weights, wns: T.wns, weighted: k };
  }

  /* =============== switching activity ===============
     How often each net switches, found the way OpenSTA finds it when no
     simulation is given: every input port switches 0.1 times a cycle, half
     the time high; a gate's output switches as often as each input does
     times the chance that input decides the output (its Boolean
     difference), summed over the inputs; a flip-flop passes its data's
     activity through, at most what the clock allows; the memories' outputs
     have no function in their library and so no activity. Flip-flops close
     loops, so the whole design is swept until the numbers settle. */
  function fnNot(g) { return function (x) { return !g(x); }; }
  function fnAnd(a, b) { return function (x) { return a(x) && b(x); }; }
  function fnOr(a, b) { return function (x) { return a(x) || b(x); }; }
  function fnXor(a, b) { return function (x) { return a(x) !== b(x); }; }
  function fnConst(c) { return function () { return c; }; }
  function fnVar(k) { return function (x) { return !!(x >> k & 1); }; }
  function parseFn(src) {                        /* Liberty's function syntax, to a truth table */
    var toks = src.match(/[A-Za-z_][A-Za-z0-9_\[\]]*|[01]|[!()*+^&|']/g) || [], i = 0, vars = [];
    function v(name) { var k = vars.indexOf(name); if (k < 0) { k = vars.length; vars.push(name); } return k; }
    function prim() {
      var t = toks[i++], f;
      if (t === "!") f = fnNot(prim());
      else if (t === "(") { f = orE(); i++; }
      else if (t === "1" || t === "0") f = fnConst(t === "1");
      else f = fnVar(v(t));
      while (toks[i] === "'") { i++; f = fnNot(f); }
      return f;
    }
    function andE() {
      var f = prim();
      while (i < toks.length && (toks[i] === "*" || toks[i] === "&" || toks[i] === "!" || toks[i] === "(" || /^[A-Za-z_01]/.test(toks[i]))) {
        if (toks[i] === "*" || toks[i] === "&") i++;
        f = fnAnd(f, prim());
      }
      return f;
    }
    function xorE() { var f = andE(); while (toks[i] === "^") { i++; f = fnXor(f, andE()); } return f; }
    function orE() { var f = xorE(); while (toks[i] === "+" || toks[i] === "|") { i++; f = fnOr(f, xorE()); } return f; }
    var fn = orE(), n = vars.length, table = new Uint8Array(1 << n);
    for (var r = 0; r < table.length; r++) table[r] = fn(r) ? 1 : 0;
    return { vars: vars, table: table };
  }
  /* duty (chance of 1) and density (switches a cycle) of a function, given its inputs' */
  function evalActivity(F, duty, dens) {
    var n = F.vars.length, T = F.table, pOne = 0, diff = new Float64Array(n);
    for (var r = 0; r < T.length; r++) {
      var p = 1;
      for (var k = 0; k < n; k++) p *= (r >> k & 1) ? duty[k] : 1 - duty[k];
      if (T[r]) pOne += p;
      for (k = 0; k < n; k++) {
        if (r >> k & 1) continue;                  /* each pair once: bit k low, and high */
        if (T[r] !== T[r | 1 << k]) {
          var q = 1;
          for (var j = 0; j < n; j++) if (j !== k) q *= (r >> j & 1) ? duty[j] : 1 - duty[j];
          diff[k] += q;
        }
      }
    }
    var d = 0;
    for (k = 0; k < n; k++) d += dens[k] * diff[k];
    return { duty: pOne, dens: d };
  }
  var INPUT_ACTIVITY = 0.1;                      /* OpenSTA's default: 0.1 per clock period */
  function activity(D, LIB, rep) {
    var n = D.cells.length, netDuty = new Float64Array(D.nets.length).fill(0.5);
    var netDens = new Float64Array(D.nets.length), drvNet = {}, inNet = {};
    D.nets.forEach(function (net, ni) {
      for (var k = 0; k < net.length; k += 2) {
        var c = net[k], pin = net[k + 1];
        if (c < 0) { if (D.ports[pin].d === "I") netDens[ni] = ni === D.clockNet ? 2 : INPUT_ACTIVITY; continue; }
        var key = c * 64 + pin;
        if (D.types[D.cells[c]].dirs[pin] === "O") drvNet[key] = ni; else inNet[key] = ni;
      }
    });
    var cache = {};
    function compiled(src) { return cache[src] || (cache[src] = parseFn(src)); }
    function typeOf(c) { return rep && rep.sized[c] || D.types[D.cells[c]].n; }
    function libOfCell(c) { return LIB.cells[typeOf(c)]; }
    /* the combinational cells in level order: a cell after every cell
       driving it, registers and memories breaking the loops */
    var comb = [], indeg = new Int32Array(n), fan = [];
    for (var c = 0; c < n; c++) fan.push([]);
    function isSeq(c) { var L = libOfCell(c); return D.types[D.cells[c]].macro || !L || !!L.ff; }
    D.nets.forEach(function (net, ni) {
      if (ni === D.clockNet) return;
      var drv = -1;
      for (var k = 0; k < net.length; k += 2) if (net[k] >= 0 && D.types[D.cells[net[k]]].dirs[net[k + 1]] === "O") drv = net[k];
      if (drv < 0 || isSeq(drv)) return;
      for (k = 0; k < net.length; k += 2) {
        var ld = net[k];
        if (ld >= 0 && ld !== drv && !isSeq(ld) && D.types[D.cells[ld]].dirs[net[k + 1]] === "I") { fan[drv].push(ld); indeg[ld]++; }
      }
    });
    var queue = [];
    for (c = 0; c < n; c++) if (!isSeq(c) && indeg[c] === 0) queue.push(c);
    while (queue.length) {
      var u = queue.shift();
      comb.push(u);
      fan[u].forEach(function (v) { if (--indeg[v] === 0) queue.push(v); });
    }
    var regs = [];
    for (c = 0; c < n; c++) if (isSeq(c) && libOfCell(c) && libOfCell(c).ff) regs.push(c);
    var regState = {};                             /* register -> its state variables' activity */
    function pinsOf(c, L) {
      var pinOf = {};
      D.types[D.cells[c]].pins.forEach(function (nm, k) {
        var ni = inNet[c * 64 + k];
        if (ni !== undefined) pinOf[libPin(L, nm)] = [netDuty[ni], netDens[ni]];
      });
      return pinOf;
    }
    function evalOutputs(c) {
      var T = D.types[D.cells[c]], L = libOfCell(c), pinOf = pinsOf(c, L), state = regState[c], change = 0;
      T.pins.forEach(function (nm, k) {
        var ni = drvNet[c * 64 + k];
        if (ni === undefined) return;
        var P = L.pins[libPin(L, nm)];
        if (!P || !P.fn) return;
        var F = compiled(P.fn);
        var src = F.vars.map(function (v) { return (state && state[v]) || pinOf[v] || [0.5, 0]; });
        var r = evalActivity(F, src.map(function (x) { return x[0]; }), src.map(function (x) { return x[1]; }));
        change = Math.max(change, Math.abs(r.dens - netDens[ni]) / Math.max(1e-9, netDens[ni]));
        netDuty[ni] = r.duty; netDens[ni] = r.dens;
      });
      return change;
    }
    var passes = 0, maxPasses = activity.maxPasses || 50;
    for (var pass = 0; pass <= maxPasses; pass++) {
      passes = pass;
      comb.forEach(evalOutputs);                   /* through the logic, in level order */
      var change = 0;
      regs.forEach(function (c) {                  /* then across every register, D to Q */
        var L = libOfCell(c), pinOf = pinsOf(c, L), nx = compiled(L.ff.next);
        var a0 = evalActivity(nx, nx.vars.map(function (v) { return (pinOf[v] || [0.5])[0]; }),
                              nx.vars.map(function (v) { return (pinOf[v] || [0, 0])[1]; }));
        var dens = a0.dens > 1 ? 4 * a0.duty * (1 - a0.duty) : a0.dens;   /* at most what the clock allows */
        var st = {}; st[L.ff.vars[0]] = [a0.duty, dens]; st[L.ff.vars[1]] = [1 - a0.duty, dens];
        regState[c] = st;
        change = Math.max(change, evalOutputs(c));
      });
      if (pass > 0 && change < 0.01) break;
    }
    var sweep = passes;
    var outDens = new Float64Array(n);            /* each cell's output switching, summed */
    Object.keys(drvNet).forEach(function (key) { outDens[Math.floor(key / 64)] += netDens[drvNet[key]]; });
    return { duty: netDuty, dens: netDens, outDens: outDens, sweeps: sweep + 1 };
  }

  /* =============== power ===============
     Grouped as OpenSTA reports it. Switching: each net's capacitance
     (wire and pins) charged at its activity, half C V squared per switch.
     Internal: each cell's own energy per output switch and, for clocked
     cells, per clock edge. Leakage: straight from the library. */
  function power(D, LIB, fp, tree, rt, period, activityScale, repair) {
    var V = LIB.meta.units.voltage, f = 1e12 / period, V2 = V * V;
    var A = activity(D, LIB, repair), scale = activityScale || 1;
    var G = {}; ["sequential", "combinational", "clock", "macro"].forEach(function (g) { G[g] = { internal: 0, switching: 0, leakage: 0 }; });
    function typeOf(c) { return repair && repair.sized[c] || D.types[D.cells[c]].n; }
    function groupOf(c) {
      var T = D.types[D.cells[c]];
      return T.macro ? "macro" : LIB.cells[typeOf(c)].ff ? "sequential" : "combinational";
    }
    /* switching, charged to the group of the net's driver */
    /* and the driver's own energy for each switch, looked up at this load */
    D.nets.forEach(function (net, ni) {
      var cap = rt.netLen[ni] * (ni === D.clockNet ? 0 : WIRE.signal.c), drv = "combinational", dP = null;
      for (var k = 0; k < net.length; k += 2) {
        var c = net[k];
        if (c < 0) continue;
        var T = D.types[D.cells[c]], L = LIB.cells[typeOf(c)], nm = libPin(L, T.pins[net[k + 1]]);
        if (T.dirs[net[k + 1]] === "I") cap += nm && L.pins[nm] ? L.pins[nm].cap : 0;
        else { drv = groupOf(c); dP = L.pins[nm]; }
      }
      if (ni === D.clockNet) return;               /* the clock's pins are counted with the clock tree */
      G[drv].switching += 0.5 * cap * 1e-15 * V2 * f * A.dens[ni] * scale;
      if (dP && dP.eTab) G[drv].internal += lookup(dP.eTab, 30, cap) * 1e-15 * f * A.dens[ni] * scale;
    });
    /* internal and leakage, per cell */
    D.cells.forEach(function (t, ci) {
      var L = LIB.cells[typeOf(ci)], g = groupOf(ci), T = D.types[t];
      if (!L) return;
      if (L.eClk) G[g].internal += L.eClk * 1e-15 * f * 2;
      G[g].leakage += L.leak * 1e-12;
    });
    /* the clock network: its wire and every clock pin, switching twice a
       cycle, and its buffers */
    var clkC = tree.wireLen * WIRE.clock.c;
    var clk = D.nets[D.clockNet];
    for (var k = 0; k < clk.length; k += 2) {
      if (clk[k] < 0) continue;
      var T = D.types[D.cells[clk[k]]], L = LIB.cells[typeOf(clk[k])], nm = libPin(L, T.pins[clk[k + 1]]);
      clkC += nm && L.pins[nm] ? L.pins[nm].cap : 0;
    }
    tree.buffers.forEach(function (b) { clkC += LIB.cells[b.type].pins.A.cap; });
    G.clock.switching += 0.5 * clkC * 1e-15 * V2 * f * 2;
    var perBuf = clkC / Math.max(1, tree.buffers.length);   /* each buffer's share of what the tree drives */
    tree.buffers.forEach(function (b) {
      var L = LIB.cells[b.type];
      G.clock.internal += lookup(L.pins.Y.eTab, 20, perBuf) * 1e-15 * f * 2;
      G.clock.leakage += L.leak * 1e-12;
    });
    /* the repair's buffers: combinational, switching with the net they drive */
    if (repair) {
      var bufs = repair.buffers.map(function (b) { return [b.type, A.dens[b.net]]; });
      for (var pb = 0; pb < repair.counts.ports; pb++) bufs.push([repair.portType, INPUT_ACTIVITY]);
      bufs.forEach(function (x) {
        var R = LIB.cells[x[0]];
        G.combinational.switching += 0.5 * R.pins.A.cap * 1e-15 * V2 * f * x[1] * scale;
        G.combinational.internal += lookup(R.pins.Y.eTab, 30, 10) * 1e-15 * f * x[1] * scale;
        G.combinational.leakage += R.leak * 1e-12;
      });
    }
    var tot = { internal: 0, switching: 0, leakage: 0 };
    Object.keys(G).forEach(function (g) {
      G[g].total = G[g].internal + G[g].switching + G[g].leakage;
      tot.internal += G[g].internal; tot.switching += G[g].switching; tot.leakage += G[g].leakage;
    });
    return { groups: G, internal: tot.internal, switching: tot.switching, leakage: tot.leakage,
             total: tot.internal + tot.switching + tot.leakage, clock: G.clock.total, vdd: V,
             activity: { mean: meanDens(A, D), sweeps: A.sweeps } };
  }
  function meanDens(A, D) {
    var s = 0, k = 0;
    A.dens.forEach(function (d, ni) { if (ni !== D.clockNet) { s += d; k++; } });
    return s / k;
  }

  /* =============== finishing: fillers =============== */
  function finish(D, fp, pl, lg, added) {
    /* what is left on the rows is filled; the flow uses fillers down to
       half a site wide, so every gap closes */
    var used = 0;
    for (var i = 0; i < pl.P.m; i++) used += D.types[D.cells[pl.cellOf[i]]].w;
    var rowLen = 0;
    for (var r = 0; r < fp.rows; r++) {
      var y0 = r * fp.rowH, y1 = y0 + fp.rowH, free = fp.W;
      fp.macros.forEach(function (m) {
        if (y1 > m.y - PD.HALO && y0 < m.y + m.h + PD.HALO) free -= m.w + 2 * PD.HALO;
      });
      rowLen += Math.max(0, free);
    }
    used += (added || 0) / fp.rowH;               /* the buffers and bigger sizes added since placement */
    var gap = Math.max(0, rowLen - used);
    return { fillerLen: gap, fillerArea: gap * fp.rowH, rowLen: rowLen, fillers: Math.round(gap / (fp.site * 4)) };
  }

  var api = { activity: activity, REPAIR: REPAIR, repair: repair, repairTiming: repairTiming, prepareLib: prepareLib, estimateLengths: estimateLengths, timingWeights: timingWeights, WIRE: WIRE, LAYERS: LAYERS, SDC: SDC, lookup: lookup, cts: cts, route: route, sta: sta, power: power, finish: finish };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PDStages = api;
})(typeof self !== "undefined" ? self : this);
