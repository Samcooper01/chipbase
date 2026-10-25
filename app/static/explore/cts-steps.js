/* The clock tree synthesis worked example: the same design, tile4m,
   picked up from the placement the previous example wrote out.

   Until now the clock has been ideal: one net, reaching every
   flip-flop at the same instant, which is the most generous assumption
   in the flow. This stage builds the real thing, a tree of buffers
   from the clock port out to every flip-flop, and then every timing
   number in the design gets harder.

   The model: flip-flops sit where placement put the logic; they are
   grouped into clusters small enough for one buffer to drive; and a
   balanced tree is built from the clock port down to those clusters.
   Latency is the delay along each path, and skew is the spread between
   the earliest and latest flip-flop. */

var CtsSteps = (function () {
  "use strict";

  var FS = FloorplanSteps, PL = PlacementSteps;
  var fmt = FS.fmt, f1 = FS.f1, f2 = FS.f2, esc = FS.esc;
  var table = FS.table, checks = FS.checks, plan = FS.plan;
  var ROW_H = FS.ROW_H;

  /* the one option per knob */
  var OPT = {
    clockLayer: "metal5",
    rootBuf: "CLKBUF_X3",       /* -root_buf */
    bufList: "CLKBUF_X2 CLKBUF_X3",
    clusterSize: 32,            /* -sink_clustering_size */
    clusterDiameter: 40,        /* -sink_clustering_max_diameter, micrometers */
    bufferDistance: 60,         /* -distance_between_buffers, micrometers */
    bufIntrinsicPs: 18,         /* a clock buffer's own delay */
    bufLoadPsPerFf: 0.12,       /* what each femtofarad it drives adds */
    bufInputCapFf: 3.0,         /* the load one buffer presents to its parent */
    flopShare: 0.12,            /* share of cells that are flip-flops */
    sinkCap: 2.1,               /* femtofarads per clock pin */
  };

  var SAMPLE_SINKS = 420;       /* drawn sinks; the real count is in the report */
  var _M = null;

  function core() { return FS.theModel(); }

  /* ----- where the flip-flops are ----- */

  /* Flip-flops follow the logic: they sit in the same groups placement
     spread out, so the sink positions come from the placement model. */
  function sinkPositions(g) {
    var pts = PL.anchors(g), ms = core().ms, frame = PL.model().frames[PL.model().frames.length - 1];
    function rnd(seed) { var x = Math.sin(seed * 57.31) * 9371.77; return x - Math.floor(x); }
    var keys = Object.keys(PL.SHARE), out = [], seed = 31;
    keys.forEach(function (c) {
      var n = Math.round(SAMPLE_SINKS * PL.SHARE[c]);
      for (var i = 0; i < n; i++) {
        var p = PL.cellAt(g, { c: c, q: Math.sqrt(rnd(seed++)), th: rnd(seed++) * Math.PI * 2 }, frame, pts, ms);
        out.push({ x: p.x, y: p.y, group: c });
      }
    });
    return out;
  }

  /* ----- clustering, the way sink clustering works -----
     Sinks near each other go to one buffer, with a cap on how many and
     how far apart they may be. A grid whose cells are the maximum
     cluster diameter does that simply and deterministically. */
  function clusterSinks(sinks, z) {
    var d = OPT.clusterDiameter;
    var nx = Math.max(1, Math.ceil(z.coreW / d)), ny = Math.max(1, Math.ceil(z.coreH / d));
    var bins = {};
    sinks.forEach(function (s, i) {
      var bx = Math.min(nx - 1, Math.floor(s.x / d)), by = Math.min(ny - 1, Math.floor(s.y / d));
      var k = by * nx + bx;
      (bins[k] = bins[k] || []).push(i);
    });
    var clusters = [];
    Object.keys(bins).forEach(function (k) {
      var list = bins[k];
      /* one buffer can only hold so many sinks, so split a crowded bin */
      for (var off = 0; off < list.length; off += OPT.clusterSize) {
        var part = list.slice(off, off + OPT.clusterSize);
        var sx = 0, sy = 0;
        part.forEach(function (i) { sx += sinks[i].x; sy += sinks[i].y; });
        clusters.push({ x: sx / part.length, y: sy / part.length, sinks: part });
      }
    });
    return clusters;
  }

  /* ----- the tree itself -----
     A balanced tree from the clock port to the cluster buffers: split
     the region in half, alternating direction, and put a buffer at each
     branch point. That is the H-tree shape the tool builds. */
  function buildTree(clusters, z) {
    var root = { x: z.coreW / 2, y: z.coreH + FS.SIZING.margin / 2 };   /* the clock port, below the core */
    var levels = [], nodes = [{ x: z.coreW / 2, y: z.coreH / 2, lo: 0, hi: clusters.length,
                                x0: 0, y0: 0, x1: z.coreW, y1: z.coreH }];
    var order = clusters.map(function (c, i) { return i; });
    var depth = Math.max(1, Math.ceil(Math.log(clusters.length) / Math.log(2)));

    /* recursively halve the region, so each branch owns half the clusters */
    function split(node, level, vertical) {
      if (level >= depth) return [];
      var inside = order.filter(function (i) {
        var c = clusters[i];
        return c.x >= node.x0 && c.x < node.x1 && c.y >= node.y0 && c.y < node.y1;
      });
      if (inside.length <= 1) return [];
      var kids;
      if (vertical) {
        var mid = (node.y0 + node.y1) / 2;
        kids = [
          { x0: node.x0, y0: node.y0, x1: node.x1, y1: mid },
          { x0: node.x0, y0: mid, x1: node.x1, y1: node.y1 },
        ];
      } else {
        var midx = (node.x0 + node.x1) / 2;
        kids = [
          { x0: node.x0, y0: node.y0, x1: midx, y1: node.y1 },
          { x0: midx, y0: node.y0, x1: node.x1, y1: node.y1 },
        ];
      }
      return kids.map(function (k) {
        k.x = (k.x0 + k.x1) / 2;
        k.y = (k.y0 + k.y1) / 2;
        k.level = level + 1;
        return k;
      });
    }

    var frontier = nodes;
    nodes[0].level = 0;
    levels.push(frontier);
    for (var L = 0; L < depth; L++) {
      var next = [];
      frontier.forEach(function (node) {
        split(node, L, L % 2 === 0).forEach(function (k) { k.parent = node; next.push(k); });
      });
      if (!next.length) break;
      levels.push(next);
      frontier = next;
    }

    /* each cluster buffer hangs off the nearest node of the last level */
    var leaves = levels[levels.length - 1];
    clusters.forEach(function (c) {
      var best = leaves[0], bd = Infinity;
      leaves.forEach(function (n) {
        var d = Math.abs(n.x - c.x) + Math.abs(n.y - c.y);
        if (d < bd) { bd = d; best = n; }
      });
      c.parent = best;
    });
    return { root: root, levels: levels, depth: levels.length, clusters: clusters };
  }

  /* ----- what the tree costs -----
     Latency is the delay from the clock port to a flip-flop: one buffer
     delay per level, plus the wire. Skew is the spread across sinks. */
  function timing(tree, sinks, z) {
    var w = FS.wireRC(OPT.clockLayer);
    function wireNs(len) { return 0.5 * (w.r * len) * (w.c * len) / 1e6; }   /* ohms x femtofarads to nanoseconds */
    function wireCap(len) { return w.c * len; }                              /* femtofarads */
    function legLen(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }

    /* A buffer's delay depends on what it drives: its own intrinsic
       delay plus a term for the capacitance hanging off it. That is
       where most of the skew in a small block comes from, because a
       buffer with 32 flip-flops on it is slower than one with 5. */
    function bufDelay(loadFf) { return (OPT.bufIntrinsicPs + OPT.bufLoadPsPerFf * loadFf) / 1000; }

    /* children of every node: the next level's nodes, then the clusters */
    tree.levels.forEach(function (lv) { lv.forEach(function (n) { n.kids = []; }); });
    tree.levels.forEach(function (lv, i) {
      if (!i) return;
      lv.forEach(function (n) { if (n.parent) n.parent.kids.push(n); });
    });
    tree.clusters.forEach(function (c) { if (c.parent) c.parent.kids.push(c); });

    /* what each node drives */
    function loadOf(n) {
      var cap = 0;
      n.kids.forEach(function (k) { cap += OPT.bufInputCapFf + wireCap(legLen(n, k)); });
      return cap;
    }
    tree.levels.forEach(function (lv) { lv.forEach(function (n) { n.delay = bufDelay(loadOf(n)); }); });
    tree.clusters.forEach(function (c) {
      var cap = 0;
      c.sinks.forEach(function (i) { cap += OPT.sinkCap + wireCap(legLen(c, sinks[i])); });
      c.load = cap;
      c.delay = bufDelay(cap);
    });

    /* the delay from the clock port down to a node */
    function pathTo(node) {
      var chain = [], cur = node;
      while (cur) { chain.push(cur); cur = cur.parent; }
      chain.reverse();
      var d = 0, prev = tree.root;
      chain.forEach(function (n) {
        d += wireNs(legLen(prev, n)) + n.delay;
        prev = n;
      });
      return d;
    }

    var lat = [], min = Infinity, max = -Infinity;
    tree.clusters.forEach(function (c) {
      var toBuffer = pathTo(c);
      c.sinks.forEach(function (i) {
        var s = sinks[i];
        var l = toBuffer + wireNs(legLen(c, s));
        s.latency = l;
        lat.push(l);
        if (l < min) min = l;
        if (l > max) max = l;
      });
    });
    var mean = lat.reduce(function (a, b) { return a + b; }, 0) / lat.length;
    return { min: min, max: max, mean: mean, skew: max - min, list: lat };
  }

  /* No buffer may sit on a macro or in its halo: the tool avoids them
     by default. A node that lands on one is pushed out over the
     nearest edge, which is what shifts a branch off-centre and adds a
     little of the skew. */
  function ejectFromMacros(p) {
    var ms = core().ms, HALO = FS.HALO;
    for (var t = 0; t < 4; t++) {
      var moved = false;
      for (var k = 0; k < ms.length; k++) {
        var m = ms[k];
        var x0 = m.x - HALO, x1 = m.x + m.w + HALO, y0 = m.y - HALO, y1 = m.y + m.h + HALO;
        if (p.x <= x0 || p.x >= x1 || p.y <= y0 || p.y >= y1) continue;
        var dl = p.x - x0, dr = x1 - p.x, dt = p.y - y0, db = y1 - p.y;
        var least = Math.min(dl, dr, dt, db);
        if (least === dl) p.x = x0 - 2;
        else if (least === dr) p.x = x1 + 2;
        else if (least === dt) p.y = y0 - 2;
        else p.y = y1 + 2;
        moved = true;
      }
      if (!moved) break;
    }
    return p;
  }

  function model() {
    if (_M) return _M;
    var z = core().z;
    var g = PL.grid();
    var sinks = sinkPositions(g);
    var clusters = clusterSinks(sinks, z);
    var tree = buildTree(clusters, z);
    /* keep the tree off the macros before anything is measured */
    tree.levels.forEach(function (lv) { lv.forEach(ejectFromMacros); });
    tree.clusters.forEach(ejectFromMacros);
    var t = timing(tree, sinks, z);

    /* The picture is drawn from a sample of the flip-flops; the counts
       reported are the real tree's. A tree that groups the sinks into
       clusters of at most OPT.clusterSize needs that many leaf buffers,
       and a balanced tree above them needs one fewer branch buffer than
       it has leaves. */
    var flops = Math.round(core().z.fg.cells * OPT.flopShare);
    var leafBuffers = Math.ceil(flops / OPT.clusterSize);
    var branchBuffers = leafBuffers - 1;
    var realBuffers = leafBuffers + branchBuffers;
    var realDepth = Math.max(1, Math.ceil(Math.log(leafBuffers) / Math.log(2)));
    var drawnBuffers = tree.clusters.length +
      tree.levels.reduce(function (n, lv) { return n + lv.length; }, 0);

    _M = {
      z: z, g: g, sinks: sinks, clusters: clusters, tree: tree, t: t,
      flops: flops, scale: realBuffers / drawnBuffers,
      drawnBuffers: drawnBuffers, buffers: realBuffers, depth: realDepth,
      leafBuffers: leafBuffers, branchBuffers: branchBuffers,
      nets: realBuffers + 1,
      area: realBuffers * 2.6,
      zoom: bufZoomScene(),
    };
    return _M;
  }

  /* ================= drawing ================= */

  var SINK_C = "#7c3aed", BUF_C = "#b8692e", WIRE_C = "#2563eb";

  /* The clock before this stage: one net, drawn as it is connected,
     straight from the port to every flip-flop. The picture is the
     argument for the whole stage. */
  function oneNetMarkup(M) {
    var port = { x: M.z.coreW / 2, y: M.z.coreH + FS.SIZING.margin / 2 };
    var o = [];
    M.sinks.forEach(function (s) {
      o.push('<line class="cts-star" x1="' + port.x + '" y1="' + port.y + '" x2="' + s.x.toFixed(1) + '" y2="' + s.y.toFixed(1) + '"/>');
    });
    M.sinks.forEach(function (s) {
      o.push('<rect class="cts-sink" x="' + (s.x - 1.4) + '" y="' + (s.y - 0.9) + '" width="2.8" height="1.8"/>');
    });
    o.push('<circle class="cts-port" cx="' + port.x + '" cy="' + port.y + '" r="4"/>');
    return o.join("");
  }

  /* the tree over the die: levels can be revealed one at a time */
  function treeMarkup(M, upTo, withSinks, withClusters) {
    var o = [], tree = M.tree;
    /* the trunk, from the clock port up into the core */
    if (upTo >= 0) {
      var r = tree.root, n0 = tree.levels[0][0];
      o.push('<line class="cts-wire" data-lvl="0" x1="' + r.x + '" y1="' + r.y + '" x2="' + n0.x + '" y2="' + n0.y + '"/>');
    }
    tree.levels.forEach(function (lv, i) {
      if (i === 0 || i > upTo) return;
      lv.forEach(function (n) {
        var p = n.parent;
        /* drawn as two legs, the way a tree is actually routed */
        o.push('<polyline class="cts-wire" data-lvl="' + i + '" points="' + p.x + "," + p.y + " " + n.x + "," + p.y + " " + n.x + "," + n.y + '"/>');
      });
    });
    tree.levels.forEach(function (lv, i) {
      if (i > upTo) return;
      lv.forEach(function (n) {
        o.push('<rect class="cts-buf" data-lvl="' + i + '" x="' + (n.x - 3) + '" y="' + (n.y - 3) + '" width="6" height="6"/>');
      });
    });
    if (upTo >= tree.depth - 1) {
      /* the ring each leaf buffer covers: every flip-flop inside it is on
         that one buffer's net, which is what sink clustering decided */
      if (withClusters) M.clusters.forEach(function (c) {
        var rad = 0;
        c.sinks.forEach(function (i) {
          var s = M.sinks[i], d = Math.sqrt((s.x - c.x) * (s.x - c.x) + (s.y - c.y) * (s.y - c.y));
          if (d > rad) rad = d;
        });
        rad = Math.max(4, Math.min(OPT.clusterDiameter / 2, rad + 2));
        o.push('<circle class="cts-cluster" data-lvl="' + tree.depth + '" cx="' + c.x.toFixed(1) +
               '" cy="' + c.y.toFixed(1) + '" r="' + rad.toFixed(1) + '"/>');
      });
      M.clusters.forEach(function (c) {
        var p = c.parent;
        o.push('<polyline class="cts-wire cts-wire-leaf" data-lvl="' + tree.depth + '" points="' + p.x + "," + p.y + " " + c.x + "," + p.y + " " + c.x + "," + c.y + '"/>');
        o.push('<rect class="cts-buf cts-buf-leaf" data-lvl="' + tree.depth + '" x="' + (c.x - 3.5) + '" y="' + (c.y - 3.5) + '" width="7" height="7"/>');
      });
    }
    if (withSinks) {
      M.sinks.forEach(function (s) {
        o.push('<rect class="cts-sink" x="' + (s.x - 1.4) + '" y="' + (s.y - 0.9) + '" width="2.8" height="1.8"/>');
      });
    }
    return o.join("");
  }

  function treeFigure(M, upTo, aria, withClusters) {
    return plan(core(), {
      macros: true, halos: true, pins: true,
      cells: { core: treeMarkup(M, upTo, true, withClusters) },
      aria: aria || "The clock tree over the placed design",
    });
  }

  /* latency per flip-flop, as a distribution: one series, so no legend */
  function skewChart(M) {
    var lat = M.t.list.slice().sort(function (a, b) { return a - b; });
    var lo = M.t.min, hi = M.t.max, bins = 24;
    var counts = new Array(bins).fill(0);
    lat.forEach(function (v) {
      var b = Math.min(bins - 1, Math.floor((v - lo) / Math.max(1e-9, hi - lo) * bins));
      counts[b] += 1;
    });
    var peak = Math.max.apply(null, counts);
    var W = 430, H = 210, ml = 44, mr = 16, mt = 46, mb = 42;
    var bw = (W - ml - mr) / bins;
    var o = ['<svg viewBox="0 0 ' + W + " " + H + '" class="pl-chart cts-chart" role="img" ' +
             'aria-label="How many flip-flops receive the clock at each latency: the spread between the first and the last is the skew">'];
    o.push('<text class="pl-axis" x="' + ml + '" y="' + (mt - 8) + '">flip-flops</text>');
    counts.forEach(function (c, i) {
      var h = (c / peak) * (H - mt - mb);
      o.push('<rect class="cts-bar" x="' + (ml + i * bw + 1) + '" y="' + (H - mb - h) + '" width="' + (bw - 2) + '" height="' + h + '" rx="2"/>');
    });
    o.push('<line class="pl-grid" x1="' + ml + '" y1="' + (H - mb) + '" x2="' + (W - mr) + '" y2="' + (H - mb) + '"/>');
    o.push('<text class="pl-tick pl-tick-x" x="' + ml + '" y="' + (H - mb + 18) + '">' + (lo * 1000).toFixed(0) + "</text>");
    o.push('<text class="pl-tick pl-tick-x" x="' + (W - mr) + '" y="' + (H - mb + 18) + '">' + (hi * 1000).toFixed(0) + "</text>");
    o.push('<text class="pl-axis pl-axis-x" x="' + ((ml + W - mr) / 2) + '" y="' + (H - 8) + '">clock arrival, picoseconds after the clock port</text>');
    o.push('<text class="pl-note" x="' + ml + '" y="16">earliest ' + (lo * 1000).toFixed(0) +
           ", latest " + (hi * 1000).toFixed(0) + ", skew " + ((hi - lo) * 1000).toFixed(0) + " picoseconds</text>");
    o.push("</svg>");
    return o.join("");
  }

  /* ----- the close-up used by step 5 -----
     At die scale a legalizing buffer moves a micrometer or two, which is
     invisible, so this is a 26 micrometer window of five rows. What it
     draws is what the detailed placer actually does: for each cell it
     searches a window around the position it was given, a limited number
     of sites left and right and a limited number of rows up and down,
     and takes the nearest free run of sites wide enough to hold it. The
     room comes from the gaps global placement left between cells, not
     from shoving a row along. */
  var BZ = {
    rows: 5, wideUm: 26, px: 24, ox: 26, oy: 52, pitch: 30, cellH: 20,
    siteWindow: 20,        /* -site_search_window, the default */
    rowWindow: 5,          /* -row_search_window, the default */
  };
  var SITE = FS.SITE_W;                  /* 0.19 micrometers */
  var BUF_W = 5 * SITE;                  /* a clock buffer, five sites wide */
  var PAD = PL.OPT.padDetail * SITE;     /* the padding the command just set */

  function bufZoomScene() {
    function rnd(seed) { var x = Math.sin(seed * 41.113) * 17431.19; return x - Math.floor(x); }
    var seed = 7, rows = [];
    for (var r = 0; r < BZ.rows; r++) {
      var cells = [], x = 0.3;
      while (true) {
        var w = Math.round((0.5 + rnd(seed++) * 1.7) / SITE) * SITE;
        if (x + w > BZ.wideUm - 0.3) break;
        cells.push({ x: x, w: w });
        /* most neighbours abut; the rest leave a gap of a few sites, which
           is the whitespace the density target left behind */
        x += w + (rnd(seed++) < 0.58 ? 0 : Math.round(2 + rnd(seed++) * 9) * SITE);
      }
      rows.push(cells);
    }

    /* three buffers the tree dropped where it wanted them: off the rows in
       y, on top of whatever was already there in x. The third wants almost
       the same spot as the second, which is the interesting case. */
    var wants = [
      { row: 1, x: 7.4, dy: 0.55 },
      { row: 3, x: 17.2, dy: -0.5 },
      { row: 3, x: 17.9, dy: 0.5 },
    ];

    var taken = rows.map(function (cells) { return cells.slice(); });

    function gapsIn(r) {
      var list = taken[r].slice().sort(function (p, q) { return p.x - q.x; });
      var out = [], x = 0;
      list.forEach(function (c) {
        if (c.x - x > 0) out.push({ lo: x, hi: c.x });
        x = Math.max(x, c.x + c.w);
      });
      if (BZ.wideUm - x > 0) out.push({ lo: x, hi: BZ.wideUm });
      return out;
    }

    function candidates(want) {
      var need = BUF_W + 2 * PAD, out = [];
      for (var dr = -BZ.rowWindow; dr <= BZ.rowWindow; dr++) {
        var r = want.row + dr;
        if (r < 0 || r >= BZ.rows) continue;            /* only what the view holds */
        gapsIn(r).forEach(function (g) {
          if (g.hi - g.lo < need) return;
          var x = Math.min(Math.max(want.x, g.lo + PAD), g.hi - PAD - BUF_W);
          if (Math.abs(x - want.x) > BZ.siteWindow * SITE) return;   /* outside the window */
          out.push({ row: r, lo: g.lo, hi: g.hi, x: x,
                     dist: Math.abs(x - want.x) + Math.abs(dr) * FS.ROW_H });
        });
      }
      out.sort(function (p, q) { return p.dist - q.dist; });
      return out;
    }

    var bufs = wants.map(function (want) {
      var firstChoice = candidates(want)[0];            /* before anything moved */
      return { want: want, first: firstChoice };
    });

    /* place them in order, so the third finds the second already there */
    bufs.forEach(function (b) {
      var opts = candidates(b.want);
      b.options = opts;
      b.pick = opts[0];
      b.contested = !!(b.first && b.pick &&
                       (b.first.row !== b.pick.row || Math.abs(b.first.x - b.pick.x) > 0.01));
      b.blocked = b.contested ? b.first : null;
      taken[b.pick.row].push({ x: b.pick.x - PAD, w: BUF_W + 2 * PAD, buf: true });
      b.disp = Math.abs(b.pick.x - b.want.x) + Math.abs(b.pick.row - b.want.row) * FS.ROW_H;
    });
    return { rows: rows, bufs: bufs };
  }

  /* ----- drawing that window ----- */
  function bzX(um) { return BZ.ox + um * BZ.px; }
  function bzY(row) { return BZ.oy + row * BZ.pitch; }

  function bufLegalizeFigure(M) {
    var sc = M.zoom, W = BZ.wideUm * BZ.px, H = BZ.oy + BZ.rows * BZ.pitch + 16;
    var o = ['<svg viewBox="0 0 ' + (W + 2 * BZ.ox) + " " + H + '" class="ff3-svg pl-zoom" role="img" ' +
             'aria-label="A 26 micrometer window of five standard cell rows: each clock buffer the tree ' +
             'inserted searches the sites around it and drops into the nearest free gap wide enough to hold it">'];
    for (var r = 0; r < BZ.rows; r++) {
      o.push('<rect class="' + (r % 2 ? "ff3-row-fs" : "ff3-row-n") + '" x="' + BZ.ox + '" y="' + bzY(r) +
             '" width="' + W + '" height="' + (BZ.pitch - 6) + '"/>');
    }
    sc.rows.forEach(function (cells, r) {
      cells.forEach(function (c) {
        o.push('<rect class="cts-lgz-cell" x="' + bzX(c.x).toFixed(1) + '" y="' + (bzY(r) + 3).toFixed(1) +
               '" width="' + (c.w * BZ.px).toFixed(1) + '" height="' + BZ.cellH + '"/>');
      });
    });
    /* per buffer: its search window, the gaps that fit, and the buffer */
    sc.bufs.forEach(function (b, i) {
      var wx = bzX(b.want.x), wy = bzY(b.want.row) + b.want.dy * BZ.pitch;
      var half = BZ.siteWindow * SITE * BZ.px;
      var rlo = Math.max(0, b.want.row - BZ.rowWindow), rhi = Math.min(BZ.rows - 1, b.want.row + BZ.rowWindow);
      o.push('<rect class="cts-lgz-win" data-win="' + i + '" x="' + (wx - half).toFixed(1) +
             '" y="' + (bzY(rlo) - 3).toFixed(1) + '" width="' + (2 * half + BUF_W * BZ.px).toFixed(1) +
             '" height="' + (bzY(rhi) + BZ.pitch - bzY(rlo) - 3).toFixed(1) + '" rx="3" style="display:none"/>');
      b.options.slice(0, 6).forEach(function (g, k) {
        o.push('<rect class="cts-lgz-gap' + (k === 0 ? " cts-lgz-gap-best" : "") + '" data-gap="' + i +
               '" x="' + bzX(g.lo).toFixed(1) + '" y="' + (bzY(g.row) + 2).toFixed(1) +
               '" width="' + ((g.hi - g.lo) * BZ.px).toFixed(1) + '" height="' + (BZ.cellH + 2) +
               '" rx="2" style="display:none"/>');
      });
      if (b.blocked) {
        o.push('<rect class="cts-lgz-taken" data-taken="' + i + '" x="' + bzX(b.blocked.lo).toFixed(1) +
               '" y="' + (bzY(b.blocked.row) + 2).toFixed(1) +
               '" width="' + ((b.blocked.hi - b.blocked.lo) * BZ.px).toFixed(1) + '" height="' + (BZ.cellH + 2) +
               '" rx="2" style="display:none"/>');
      }
      o.push('<rect class="cts-lgz-buf" data-buf="' + i + '" x="' + wx.toFixed(1) + '" y="' + (wy + 3).toFixed(1) +
             '" width="' + (BUF_W * BZ.px).toFixed(1) + '" height="' + BZ.cellH + '" rx="1"/>');
    });
    o.push('<text class="ff3-cap" x="' + BZ.ox + '" y="18">a 26 micrometer window: five rows of placed cells, ' +
           "and three clock buffers the tree dropped between them</text>");
    o.push('<text class="ff3-cap" x="' + BZ.ox + '" y="34" id="clg-say">each buffer searches ' + BZ.siteWindow +
           " sites left and right and " + BZ.rowWindow + " rows up and down for a free run wide enough to hold it</text>");
    o.push("</svg>");
    return o.join("") +
      '<div class="gp-readout" id="clg-readout">' +
      '<span>buffers on a legal site <b id="clg-done">0</b> of ' + sc.bufs.length + " in view</span>" +
      '<span>gaps that fit, in the window <b id="clg-cand">0</b></span>' +
      '<span>displacement <b id="clg-disp">0.00</b> micrometers</span>' +
      '<button class="ff-reset" type="button" id="clg-replay">replay</button></div>' +
      '<div class="ff3-legend">' +
      '<span><i class="pl-sw pl-sw-logic"></i>cells placement already legalized</span>' +
      '<span><i class="pl-sw cts-sw-buf"></i>a clock buffer, where the tree wanted it</span>' +
      '<span><i class="pl-sw cts-sw-gap"></i>a free run of sites wide enough to hold it</span>' +
      '<span><i class="pl-sw cts-sw-legal"></i>on a legal site, in a row</span></div>';
  }

  /* the legalizer working through that window, one buffer at a time */
  function bufLegalizeAnimate(M) {
    var root = document.getElementById("flow-fig-5");
    if (!root) return;
    var sc = M.zoom;
    var bufEls = root.querySelectorAll(".cts-lgz-buf");
    if (!bufEls.length) return;
    var doneEl = document.getElementById("clg-done");
    var candEl = document.getElementById("clg-cand");
    var dispEl = document.getElementById("clg-disp");
    var sayEl = document.getElementById("clg-say");
    var replay = document.getElementById("clg-replay");
    var timers = [];

    function pick(sel) { return root.querySelectorAll(sel); }
    function setShow(list, on) { list.forEach(function (el) { el.style.display = on ? "" : "none"; }); }
    function later(ms, fn) { timers.push(setTimeout(fn, ms)); }

    function reset() {
      timers.forEach(clearTimeout);
      timers = [];
      setShow([].slice.call(pick(".cts-lgz-win")), false);
      setShow([].slice.call(pick(".cts-lgz-gap")), false);
      setShow([].slice.call(pick(".cts-lgz-taken")), false);
      sc.bufs.forEach(function (b, i) {
        bufEls[i].setAttribute("x", bzX(b.want.x).toFixed(1));
        bufEls[i].setAttribute("y", (bzY(b.want.row) + b.want.dy * BZ.pitch + 3).toFixed(1));
        bufEls[i].classList.remove("cts-lgz-legal");
      });
      if (doneEl) doneEl.textContent = "0";
      if (candEl) candEl.textContent = "0";
      if (dispEl) dispEl.textContent = "0.00";
      if (sayEl) sayEl.textContent = "each buffer searches " + BZ.siteWindow + " sites left and right and " +
        BZ.rowWindow + " rows up and down for a free run wide enough to hold it";
    }

    function step(k, totalDisp) {
      if (k >= sc.bufs.length) {
        if (sayEl) sayEl.textContent = "all three are on sites, in rows, with no overlap: the design is legal again";
        return;
      }
      var b = sc.bufs[k];
      var win = [].slice.call(pick('.cts-lgz-win[data-win="' + k + '"]'));
      var gaps = [].slice.call(pick('.cts-lgz-gap[data-gap="' + k + '"]'));
      var taken = [].slice.call(pick('.cts-lgz-taken[data-taken="' + k + '"]'));

      setShow(win, true);
      if (sayEl) sayEl.textContent = "buffer " + (k + 1) + ": searching the sites around where the tree put it";
      later(500, function () {
        setShow(gaps, true);
        if (candEl) candEl.textContent = String(b.options.length);
        if (sayEl) sayEl.textContent = "buffer " + (k + 1) + ": " + b.options.length +
          " free runs in the window are wide enough, counting the padding";
      });
      var move = 1250;
      if (taken.length) {
        later(1150, function () {
          setShow(taken, true);
          if (sayEl) sayEl.textContent = "buffer " + (k + 1) + ": the nearest gap is the one buffer " + k +
            " just took, so this one settles for the next nearest";
        });
        move = 2350;
      }
      later(move, function () {
        bufEls[k].setAttribute("x", bzX(b.pick.x).toFixed(1));
        bufEls[k].setAttribute("y", (bzY(b.pick.row) + 3).toFixed(1));
        bufEls[k].classList.add("cts-lgz-legal");
        var sum = totalDisp + b.disp;
        if (doneEl) doneEl.textContent = String(k + 1);
        if (dispEl) dispEl.textContent = (sum / (k + 1)).toFixed(2);
        later(650, function () {
          setShow(win, false);
          setShow(gaps, false);
          setShow(taken, false);
          later(350, function () { step(k + 1, sum); });
        });
      });
    }

    function play() { reset(); later(600, function () { step(0, 0); }); }

    if (replay && !replay.dataset.wired) {
      replay.dataset.wired = "1";
      replay.addEventListener("click", play);
    }
    play();
  }

  /* ----- step 6's timeline -----
     One launch-to-capture pair on a short path, drawn against time. The
     two clock edges arrive at different instants, which is the skew, and
     the data has to land clear of the window the capturing flip-flop
     needs it steady for. Every number comes from the tree just built. */
  var HOLD = {
    holdTimePs: 30,        /* what the capturing flip-flop needs after its edge */
    pathPs: 18,            /* a short combinational path between two flip-flops */
    bufPs: PL.OPT.bufDelayPs,
    buffers: 3,
    ox: 196, W: 790, H: 250, row: [86, 134, 196],
  };

  function holdNumbers(M) {
    /* the same numbers step 4 reported, so the two steps agree */
    var launch = Math.round(M.t.min * 1000), skew = Math.round(M.t.skew * 1000);
    var capture = launch + skew;
    var arrive = launch + HOLD.pathPs;
    var required = capture + HOLD.holdTimePs;
    var added = HOLD.buffers * HOLD.bufPs;
    return {
      launch: launch, capture: capture, skew: skew,
      arrive: arrive, required: required, added: added,
      after: arrive + added,
      slack: arrive - required, slackAfter: arrive + added - required,
      t0: launch - 12, t1: arrive + added + 14,
    };
  }

  function holdFigure(M) {
    var h = holdNumbers(M), W = HOLD.W, H = HOLD.H, ox = HOLD.ox, right = W - 24;
    var sx = (right - ox) / (h.t1 - h.t0);
    function X(ps) { return ox + (ps - h.t0) * sx; }
    var o = ['<svg viewBox="0 0 ' + W + " " + H + '" class="ff3-svg cts-hold" role="img" ' +
             'aria-label="A timeline of one short path: the clock reaches the launching flip-flop, ' +
             'then the capturing flip-flop, and the data must land clear of the hold window">'];

    o.push('<text class="ff3-cap" x="12" y="20">one short path between two flip-flops, drawn against time ' +
           "after the clock edge leaves the port</text>");
    o.push('<text class="ff3-cap cts-h-say" x="12" y="38" id="clh-say">press play to follow the edge</text>');

    ["clock at the launching flip-flop", "clock at the capturing flip-flop",
     "data at the capturing flip-flop"].forEach(function (lab, i) {
      o.push('<text class="cts-h-lab" x="' + (ox - 12) + '" y="' + (HOLD.row[i] + 4) + '">' + lab + "</text>");
      o.push('<line class="cts-h-track" x1="' + ox + '" y1="' + HOLD.row[i] + '" x2="' + right + '" y2="' + HOLD.row[i] + '"/>');
    });

    /* the window the capturing flip-flop needs its data held steady for */
    o.push('<rect class="cts-h-band" id="clh-band" x="' + X(h.capture).toFixed(1) + '" y="' + (HOLD.row[2] - 26) +
           '" width="' + ((h.required - h.capture) * sx).toFixed(1) + '" height="52" rx="3" style="display:none"/>');
    o.push('<text class="cts-h-small" id="clh-bandlab" x="' + ((X(h.capture) + X(h.required)) / 2).toFixed(1) +
           '" y="' + (HOLD.row[2] - 32) + '" style="display:none">hold window, ' + HOLD.holdTimePs + " picoseconds</text>");

    /* the skew, between the two clock arrivals */
    o.push('<g id="clh-skew" style="display:none">' +
           '<line class="cts-h-brk" x1="' + X(h.launch).toFixed(1) + '" y1="' + (HOLD.row[0] + 16) +
           '" x2="' + X(h.capture).toFixed(1) + '" y2="' + (HOLD.row[0] + 16) + '"/>' +
           '<text class="cts-h-small" x="' + ((X(h.launch) + X(h.capture)) / 2).toFixed(1) + '" y="' + (HOLD.row[0] + 30) +
           '">skew ' + h.skew + " picoseconds</text></g>");

    /* the three arrival markers */
    [["clh-m0", 0, h.launch], ["clh-m1", 1, h.capture], ["clh-m2", 2, h.arrive]].forEach(function (m) {
      o.push('<rect class="cts-h-mark" id="' + m[0] + '" x="' + (X(m[2]) - 1.2).toFixed(1) + '" y="' + (HOLD.row[m[1]] - 20) +
             '" width="2.4" height="40" style="display:none"/>');
    });

    /* the buffers hold repair puts in the path */
    for (var b = 0; b < HOLD.buffers; b++) {
      var bx = X(h.launch) + ((b + 1) / (HOLD.buffers + 1)) * (X(h.arrive) - X(h.launch));
      o.push('<rect class="cts-h-buf" data-hbuf="' + b + '" x="' + (bx - 5).toFixed(1) + '" y="' + (HOLD.row[2] - 8) +
             '" width="10" height="16" rx="1.5" style="display:none"/>');
    }

    /* the travelling edges */
    o.push('<circle class="cts-h-dot cts-h-dot-clk" id="clh-d0" cx="' + ox + '" cy="' + HOLD.row[0] + '" r="5"/>');
    o.push('<circle class="cts-h-dot cts-h-dot-clk" id="clh-d1" cx="' + ox + '" cy="' + HOLD.row[1] + '" r="5"/>');
    o.push('<circle class="cts-h-dot cts-h-dot-dat" id="clh-d2" cx="' + X(h.launch).toFixed(1) + '" cy="' + HOLD.row[2] +
           '" r="5" style="display:none"/>');

    /* the time axis */
    o.push('<line class="pl-grid" x1="' + ox + '" y1="' + (H - 40) + '" x2="' + right + '" y2="' + (H - 40) + '"/>');
    for (var ps = Math.ceil(h.t0 / 10) * 10; ps <= h.t1; ps += 10) {
      o.push('<line class="cts-h-tick" x1="' + X(ps).toFixed(1) + '" y1="' + (H - 40) + '" x2="' + X(ps).toFixed(1) +
             '" y2="' + (H - 35) + '"/>');
      o.push('<text class="pl-tick pl-tick-x" x="' + X(ps).toFixed(1) + '" y="' + (H - 22) + '">' + ps + "</text>");
    }
    o.push('<text class="pl-axis pl-axis-x" x="' + ((ox + right) / 2) + '" y="' + (H - 6) +
           '">picoseconds after the clock edge leaves the port</text>');
    o.push("</svg>");

    return o.join("") +
      '<div class="gp-readout" id="clh-readout">' +
      '<span>data arrives <b id="clh-arr">-</b> picoseconds</span>' +
      '<span>must not change before <b id="clh-req">-</b></span>' +
      '<span>hold slack <b id="clh-slack">-</b></span>' +
      '<button class="ff-reset" type="button" id="clh-replay">replay</button></div>' +
      '<div class="ff3-legend">' +
      '<span><i class="pl-sw cts-sw-clk"></i>a clock edge on its way through the tree</span>' +
      '<span><i class="pl-sw cts-sw-dat"></i>the data edge this path launches</span>' +
      '<span><i class="pl-sw cts-sw-band"></i>the window the capturing flip-flop needs its data steady</span>' +
      '<span><i class="pl-sw cts-sw-buf"></i>a hold buffer, inserted to slow the path down</span></div>';
  }

  function holdAnimate(M) {
    var root = document.getElementById("flow-fig-6");
    if (!root) return;
    var svg = root.querySelector(".cts-hold");
    if (!svg) return;
    var h = holdNumbers(M), ox = HOLD.ox, right = HOLD.W - 24;
    var sx = (right - ox) / (h.t1 - h.t0);
    function X(ps) { return ox + (ps - h.t0) * sx; }
    var id = function (s) { return document.getElementById(s); };
    var say = id("clh-say"), timers = [];
    function later(ms, fn) { timers.push(setTimeout(fn, ms)); }
    function show(el, on) { if (el) el.style.display = on ? "" : "none"; }
    function tell(t) { if (say) say.textContent = t; }

    function reset() {
      timers.forEach(clearTimeout);
      timers = [];
      ["clh-m0", "clh-m1", "clh-m2", "clh-band", "clh-bandlab", "clh-skew", "clh-d2"].forEach(function (k) { show(id(k), false); });
      root.querySelectorAll(".cts-h-buf").forEach(function (el) { show(el, false); });
      id("clh-d0").setAttribute("cx", ox);
      id("clh-d1").setAttribute("cx", ox);
      id("clh-d2").setAttribute("cx", X(h.launch).toFixed(1));
      id("clh-m2").setAttribute("x", (X(h.arrive) - 1.2).toFixed(1));
      id("clh-m2").classList.remove("cts-h-mark-bad", "cts-h-mark-good");
      var band = id("clh-band");
      if (band) band.classList.remove("cts-h-band-ok");
      ["clh-arr", "clh-req", "clh-slack"].forEach(function (k) { id(k).textContent = "-"; });
      id("clh-slack").className = "";
      tell("the clock edge leaves the port");
    }

    function play() {
      reset();
      later(400, function () { id("clh-d0").setAttribute("cx", X(h.launch).toFixed(1)); });
      later(1400, function () {
        show(id("clh-m0"), true);
        tell("the edge reaches the launching flip-flop " + h.launch + " picoseconds after it left the port");
        id("clh-d1").setAttribute("cx", X(h.capture).toFixed(1));
      });
      later(2500, function () {
        show(id("clh-m1"), true);
        show(id("clh-skew"), true);
        tell("it reaches the capturing flip-flop " + h.skew + " picoseconds later, because the two branches " +
             "are not identical: that difference is the skew");
      });
      later(3600, function () {
        show(id("clh-band"), true);
        show(id("clh-bandlab"), true);
        id("clh-req").textContent = h.required;
        tell("that flip-flop needs its data to stay steady for " + HOLD.holdTimePs +
             " picoseconds after its own edge: nothing may change inside the shaded window");
      });
      later(4700, function () {
        show(id("clh-d2"), true);
        tell("the launching flip-flop sends its data, through a path only " + HOLD.pathPs + " picoseconds long");
        later(60, function () { id("clh-d2").setAttribute("cx", X(h.arrive).toFixed(1)); });
      });
      later(5700, function () {
        var m = id("clh-m2");
        show(m, true);
        m.classList.add("cts-h-mark-bad");
        id("clh-arr").textContent = h.arrive;
        id("clh-slack").textContent = h.slack + " picoseconds";
        id("clh-slack").className = "cts-h-bad";
        tell("it lands at " + h.arrive + ", inside the window: the new value overwrites the old one before the " +
             "capturing flip-flop is done with it. Hold slack " + h.slack + " picoseconds.");
      });
      var bufs = [].slice.call(root.querySelectorAll(".cts-h-buf"));
      bufs.forEach(function (el, i) {
        later(7000 + i * 280, function () {
          show(el, true);
          tell("repair_timing -hold inserts buffers whose delay is the whole point: " + (i + 1) + " of " +
               bufs.length + ", " + HOLD.bufPs + " picoseconds each");
        });
      });
      later(8200, function () {
        id("clh-d2").setAttribute("cx", X(h.after).toFixed(1));
        /* the buffers spread along the path they lengthened */
        bufs.forEach(function (el, i) {
          var bx = X(h.launch) + ((i + 1) / (bufs.length + 1)) * (X(h.after) - X(h.launch));
          el.setAttribute("x", (bx - 5).toFixed(1));
        });
        var m = id("clh-m2");
        m.setAttribute("x", (X(h.after) - 1.2).toFixed(1));
        m.classList.remove("cts-h-mark-bad");
        m.classList.add("cts-h-mark-good");
        var band = id("clh-band");
        if (band) band.classList.add("cts-h-band-ok");
        id("clh-arr").textContent = h.after;
        id("clh-slack").textContent = "+" + h.slackAfter + " picoseconds";
        id("clh-slack").className = "cts-h-good";
        tell("the same data now arrives at " + h.after + ", clear of the window, and the path holds with " +
             h.slackAfter + " picoseconds to spare");
      });
    }

    var replay = id("clh-replay");
    if (replay && !replay.dataset.wired) {
      replay.dataset.wired = "1";
      replay.addEventListener("click", play);
    }
    play();
  }

  /* reveal the tree level by level after the log finishes */
  function animateTree(M) {
    var root = document.getElementById("flow-fig-3");
    if (!root) return;
    var parts = root.querySelectorAll("[data-lvl]");
    var sinks = root.querySelectorAll(".cts-sink");
    var lvlEl = document.getElementById("cts-level");
    var bufEl = document.getElementById("cts-bufs");
    var replay = document.getElementById("cts-replay");
    if (!parts.length) return;
    var maxLvl = M.tree.depth, timer = null;

    function show(upTo) {
      var bufs = 0;
      parts.forEach(function (el) {
        var l = +el.getAttribute("data-lvl");
        var on = l <= upTo;
        el.style.display = on ? "" : "none";
        if (on && el.classList.contains("cts-buf")) bufs += 1;
      });
      if (lvlEl) lvlEl.textContent = upTo >= maxLvl ? String(maxLvl) : String(upTo);
      if (bufEl) bufEl.textContent = fmt(Math.round(bufs * M.scale));
    }

    function play() {
      if (timer) clearInterval(timer);
      sinks.forEach(function (s) { s.style.display = ""; });
      var k = 0;
      show(0);
      timer = setInterval(function () {
        k += 1;
        show(k);
        if (k >= maxLvl) { clearInterval(timer); timer = null; }
      }, 620);
    }

    if (replay && !replay.dataset.wired) {
      replay.dataset.wired = "1";
      replay.addEventListener("click", play);
    }
    play();
  }

  /* ================= the steps ================= */

  function ctsCommand() {
    return "clock_tree_synthesis -sink_clustering_enable" +
      " -sink_clustering_size " + OPT.clusterSize +
      " -sink_clustering_max_diameter " + OPT.clusterDiameter +
      " -distance_between_buffers " + OPT.bufferDistance +
      " -root_buf " + OPT.rootBuf + " -buf_list {" + OPT.bufList + "}" +
      " -repair_clock_nets";
  }

  var STEPS = [];

  STEPS.push({
    n: 1, title: "Start from the placement", button: "Load the placement", againLabel: "Load again",
    line: "Read back the placed design, and look at what the clock is at this point: one net.",
    intro:
      "<p>Everything so far has been measured against an <em>ideal</em> clock: a clock that arrives at " +
      "every flip-flop at the same instant, costs nothing, and does not exist. The placement example's " +
      "own timing report admitted it, printing <code>clock network delay (ideal)</code> and a flat " +
      "0.00 where the clock path should be.</p>" +
      '<p>The design arrives from the <a href="/explore/examples/placement">placement example</a>: ' +
      "every cell on a legal site, and the clock still a fiction.</p>" +
      "<p>What the design actually has is one net, from the clock port to thousands of flip-flop clock " +
      "pins. No gate can drive that, and even if one could, the pins are spread across half a " +
      "millimeter of silicon and would never switch together. This stage replaces that net with a tree.</p>" +
      "<p>The picture below is that net, drawn as it is actually connected: one driver at the clock " +
      "port, and a line to every flip-flop. It is not a plan of anything. It is the thing this stage " +
      "exists to replace.</p>",
    command:
      "read_db tile4m_placed.odb\n" +
      "read_sdc tile4m.sdc\n" +
      "set_wire_rc -clock -layer " + OPT.clockLayer,
    commandNote:
      "One flag is easy to misread. <code>-layer " + OPT.clockLayer + "</code> does <em>not</em> mean the clock will be " +
      "routed on one layer. It picks a single representative layer whose resistance and capacitance " +
      "stand in for clock wire while no wire exists yet, exactly as the signal estimate did in the " +
      "placement example. Where the clock may actually be routed was set back in the floorplan, with " +
      "<code>set_routing_layers -clock metal4-metal6</code>: a range, and a higher one than signals get, " +
      "because the upper layers are thicker and carry the clock with less resistance. The router will " +
      "use several of them, and " + OPT.clockLayer + " is simply the middle of that range, so it is the fair " +
      "single number to estimate with.",
    run: function () {
      var M = model();
      var w = FS.wireRC(OPT.clockLayer);
      return {
        log: [
          { k: "cmd", t: "read_db tile4m_placed.odb" },
          { k: "out", t: "  " + fmt(M.z.fg.cells) + " placed instances, " + fmt(M.flops) + " of them flip-flops" },
          { k: "cmd", t: "read_sdc tile4m.sdc" },
          { k: "out", t: "  clocks: 1 (clk, period " + FS.DESIGN.clockPeriodNs.toFixed(1) + " nanoseconds)" },
          { k: "cmd", t: "set_wire_rc -clock -layer " + OPT.clockLayer },
          { k: "out", t: "  clock wires: " + w.r.toFixed(2) + " ohms and " + w.c.toFixed(3) + " femtofarads per micrometer" },
          { k: "ok", t: "Placed design loaded. The clock is still one net." },
        ],
        figure: plan(core(), {
          macros: true, halos: true, pins: true,
          cells: { core: oneNetMarkup(M) },
          aria: "The clock as it stands: one net from the clock port to every flip-flop in the design",
        }) + '<div class="ff3-legend">' +
          '<span><i class="pl-sw cts-sw-sink"></i>flip-flops waiting for the clock (' + SAMPLE_SINKS +
          " drawn of " + fmt(M.flops) + ")</span>" +
          '<span><i class="pl-sw cts-sw-star"></i>the one net that is supposed to reach them all</span>' +
          "<span>no buffers, no branching: this is what the design has before this stage</span></div>",
        report: "<h3>What the clock looks like now</h3>" + table([
          ["Flip-flops to reach", fmt(M.flops) + ", spread across the core"],
          ["Clock nets", "1, from the clock port to all of them"],
          ["Clock buffers", "0"],
          ["Modelled clock delay", "0.00 nanoseconds, everywhere: the ideal assumption"],
          ["Clock wire model", FS.wireRC(OPT.clockLayer).r.toFixed(2) + " ohms, " + FS.wireRC(OPT.clockLayer).c.toFixed(3) +
            " femtofarads per micrometer on " + OPT.clockLayer],
        ]) + checks([
          ["One net cannot do this job.",
           "A single driver would face " + fmt(M.flops) + " clock pins, hundreds of picofarads of load, and a rise " +
           "time measured in nanoseconds. The clock would be slower than the logic it is supposed to time."],
          ["The spread is the real problem.",
           "Even with infinite drive, the flip-flop nearest the port and the one furthest away are half a " +
           "millimeter apart. Without a balanced tree they receive the edge at visibly different times, " +
           "and that difference eats straight into every path's budget."],
          ["One layer for the estimate, a range for the routing.",
           "The estimate uses " + OPT.clockLayer + " as a stand-in, because a tree with no wires still needs a number " +
           "for what a micrometer of clock wire costs. The real clock will be routed across " +
           "metal4 to metal6, the range the floorplan reserved for it, and a single branch may use " +
           "several of those layers as it crosses the block. Signals, by contrast, may use metal2 " +
           "upward: the clock is deliberately kept on the thicker, faster layers."],
        ]),
      };
    },
  });

  STEPS.push({
    n: 2, title: "Check what is already in the clock path", button: "Check the clock path", againLabel: "Check again",
    line: "Look for logic sitting between the port and the flip-flops; here there is none.",
    intro:
      "<p>Before building anything, look at what the clock already passes through. Two things commonly " +
      "sit in a clock path and both change how the tree must be built:</p>" +
      '<ul class="ff-checks">' +
      "<li><strong>An inverter driving several loads.</strong> It cuts the clock into pieces: the tool " +
      "would have to build a tree on each side of it and then balance the two against each other.</li>" +
      "<li><strong>A clock gate.</strong> A cell that stops the clock reaching part of the design when " +
      "that part is idle, which saves a great deal of power and creates a branch that is only sometimes " +
      "active.</li></ul>" +
      "<p><code>tile4m</code> has neither. Its clock goes from the port straight to " + "every flip-flop, " +
      "as the previous step's picture showed, so this command finds nothing to do. That is worth " +
      "running anyway, and worth knowing: a result of zero here is a fact about the design, and on a " +
      "real block it is the exception rather than the rule.</p>",
    command: "repair_clock_inverters",
    commandNote:
      "From the gate resizer's documentation: it &quot;replaces an inverter in the clock tree with " +
      "multiple fanouts with one inverter per fanout. This prevents the inverter from splitting up the " +
      "clock tree seen by CTS. It should be run before clock_tree_synthesis.&quot; The reference flow " +
      "calls it unconditionally, immediately before building the tree, because it costs nothing when " +
      "there is nothing to clone.",
    run: function () {
      var M = model();
      return {
        log: [
          { k: "cmd", t: "repair_clock_inverters" },
          { k: "out", t: "  clock nets examined: 1 (clk)" },
          { k: "out", t: "  inverters in the clock path: 0" },
          { k: "out", t: "  clock gates in the clock path: 0" },
          { k: "ok", t: "Nothing to clone. The clock reaches every flip-flop directly." },
        ],
        figure: plan(core(), {
          macros: true, halos: true, pins: true,
          cells: { core: oneNetMarkup(M) },
          aria: "The same clock net, checked end to end: nothing sits between the clock port and the flip-flops",
        }) + '<div class="ff3-legend">' +
          '<span><i class="pl-sw cts-sw-sink"></i>the ' + fmt(M.flops) + " flip-flops the command looked for logic in front of (" +
          SAMPLE_SINKS + " drawn)</span>" +
          '<span><i class="pl-sw cts-sw-star"></i>every path from the port, with nothing on it</span>' +
          "<span>this is the picture the command just confirmed: no inverter, no clock gate, " +
          "nothing to clone</span></div>",
        report: "<h3>What is in the clock path</h3>" + table([
          ["Clock nets", "1 (clk)"],
          ["Inverters found", "0"],
          ["Clock gates found", "0"],
          ["Inverters cloned", "0, because there were none"],
          ["What the tree builder will see", "one net, the clock port, and " + fmt(M.flops) + " flip-flops"],
        ]) + checks([
          ["A clean clock path is the simple case.",
           "Everything downstream is easier for it: one tree, one balancing problem, one skew number. " +
           "This design is small and always-on, so it earns that simplicity honestly."],
          ["Why an inverter would matter.",
           "Balancing works along a net. A gate in the middle of the clock splits it into two problems " +
           "that must then be balanced against each other. Cloning the inverter, one copy per load, " +
           "turns those back into independent branches of one tree, which is why the command exists."],
          ["Why a clock gate would matter more.",
           "A clock gate is deliberate: it stops the clock reaching a block that is idle, and the clock " +
           "is usually the largest single consumer of power on a chip. But it makes the tree conditional, " +
           "and its own delay has to be balanced against branches that have no gate. A real low-power " +
           "design is full of them, and its clock tree is correspondingly harder to build than this one."],
        ]),
      };
    },
  });

  STEPS.push({
    n: 3, title: "Build the clock tree", button: "Build the tree", againLabel: "Build again",
    line: "Group the flip-flops, then branch out from the port so every group is reached equally.",
    intro:
      "<p>This is the stage. The tool groups nearby flip-flops into clusters small enough for one buffer " +
      "to drive, then builds a balanced tree from the clock port out to those clusters, splitting the " +
      "region in half at each level and putting a buffer at every branch point. Because each branch " +
      "covers an equal share of the area, every path from the port to a flip-flop passes through the " +
      "same number of buffers and roughly the same length of wire, which is what makes the arrival " +
      "times match.</p>",
    command: function () { return ctsCommand(); },
    commandNote:
      "OpenROAD's clock tree module is " +
      '<a href="https://openroad.readthedocs.io/en/latest/main/src/cts/README.html">TritonCTS</a>, ' +
      "which builds an <strong>H-tree</strong> and, with <code>-sink_clustering_enable</code>, first " +
      "groups the sinks (its documentation calls the clustering CKMeans). <code>-root_buf</code> names " +
      "the buffer at the top, <code>-buf_list</code> the ones it may use along the way. The flow adds " +
      "<code>-repair_clock_nets</code> so long clock wires are fixed while the tree is built rather than " +
      "afterwards. Note the flag is <code>-root_buf</code>, not <code>-root_buffer</code> as the options " +
      "table says, and <code>-obstruction_aware</code> is obsolete: avoiding macros is now the default.",
    reference: function () {
      var M = model();
      return "<h3>What you will watch</h3>" +
        "<p>The tree is revealed one level at a time, the way it is built:</p>" +
        '<ul class="ff-checks">' +
        "<li>The <strong>purple marks</strong> are flip-flops waiting for the clock, " + SAMPLE_SINKS +
        " of them drawn for the " + fmt(M.flops) + " in the design.</li>" +
        "<li>The <strong>blue lines</strong> are clock wires, and each <strong>copper square</strong> is a " +
        "buffer. Level 0 is the one at the top of the tree; each level after it splits the region in " +
        "half, alternating vertical and horizontal, and adds a buffer per branch.</li>" +
        "<li>The last level connects each cluster's own buffer to the flip-flops around it. The " +
        "<strong>dashed circles</strong> are those clusters: each one rings the flip-flops that its " +
        "buffer, the square at the center, drives.</li></ul>" +
        "<p>Watch the shape: every branch covers the same area, so every flip-flop ends up about the " +
        "same number of buffers and the same length of wire from the port. That is the whole trick.</p>";
    },
    run: function () {
      var M = model(), t = M.t;
      var log = [
        { k: "cmd", t: ctsCommand() },
        { k: "out", t: "  [INFO CTS-0050] Root buffer is " + OPT.rootBuf + "." },
        { k: "out", t: "  [INFO CTS-0051] Sink buffer is " + OPT.rootBuf + "." },
        { k: "out", t: '  [INFO CTS-0007] Net "clk" found for clock "clk".' },
        { k: "out", t: '  [INFO CTS-0010]  Clock net "clk" has ' + fmt(M.flops) + " sinks." },
        { k: "out", t: "  [INFO CTS-0008] TritonCTS found 1 clock nets." },
        { k: "out", t: "  [INFO CTS-0027] Generating H-Tree topology for net clk." },
        { k: "out", t: "  [INFO CTS-0028]  Total number of sinks: " + fmt(M.flops) + "." },
        { k: "out", t: "  [INFO CTS-0090]  Sinks will be clustered based on buffer max cap." },
      ];
      M.tree.levels.forEach(function (lv, i) {
        if (!i) return;
        log.push({ k: "out", t: "   Level " + i + "   Direction: " + (i % 2 ? "Vertical" : "Horizontal") +
                   "   Sub-regions: " + lv.length });
      });
      log.push({ k: "out", t: "  [INFO CTS-0018]     Created " + fmt(M.buffers) + " clock buffers." });
      log.push({ k: "out", t: "  [INFO CTS-0012]     Minimum number of buffers in the clock path: " + M.depth + "." });
      log.push({ k: "out", t: "  [INFO CTS-0013]     Maximum number of buffers in the clock path: " + (M.depth + 1) + "." });
      log.push({ k: "out", t: "  [INFO CTS-0015]     Created " + fmt(M.nets) + " clock nets." });
      log.push({ k: "out", t: "  [INFO CTS-0017]     Max level of the clock tree: " + M.depth + "." });
      log.push({ k: "ok", t: "Clock tree built. Every flip-flop now has a real clock path." });

      return {
        log: log,
        figure: treeFigure(M, M.tree.depth, "The clock tree, level by level, over the placed design, " +
          "with a ring around each leaf buffer's cluster of flip-flops", true) +
          '<div class="gp-readout" id="cts-readout">' +
          '<span>level <b id="cts-level">0</b> of ' + M.tree.depth + "</span>" +
          '<span>buffers placed <b id="cts-bufs">0</b></span>' +
          '<button class="ff-reset" type="button" id="cts-replay">replay</button></div>' +
          '<div class="ff3-legend">' +
          '<span><i class="pl-sw cts-sw-sink"></i>flip-flops</span>' +
          '<span><i class="pl-sw cts-sw-buf"></i>clock buffers</span>' +
          '<span><i class="pl-sw cts-sw-wire"></i>clock wires</span>' +
          '<span><i class="pl-sw cts-sw-cluster"></i>one leaf buffer\'s cluster: every flip-flop inside the ' +
          "ring is driven by that buffer, at most " + OPT.clusterSize + " of them and at most " +
          OPT.clusterDiameter + " micrometers across</span></div>",
        after: function () { animateTree(M); },
        report: "<h3>The tree</h3>" + table([
          ["Sinks", fmt(M.flops) + " flip-flop clock pins"],
          ["Clusters", fmt(M.clusters.length) + " drawn, each within " + OPT.clusterDiameter + " micrometers and at most " +
            OPT.clusterSize + " sinks"],
          ["Levels", String(M.depth) + " of buffers between the port and a flip-flop"],
          ["Buffers inserted", fmt(M.buffers)],
          ["Clock nets", fmt(M.nets) + " (one per buffer output, plus the root)"],
          ["Insertion delay", (t.mean * 1000).toFixed(0) + " picoseconds on average, " + (t.min * 1000).toFixed(0) +
            " to " + (t.max * 1000).toFixed(0)],
          ["Skew", (t.skew * 1000).toFixed(0) + " picoseconds"],
        ]) + checks([
          ["Balance is geometric.",
           "Each level halves the region, so each branch serves an equal share of the area and an equal " +
           "share of the flip-flops. Equal areas mean equal wire lengths, and equal wire lengths plus " +
           "equal buffer counts mean equal arrival times."],
          ["Clustering keeps the last hop short.",
           "Grouping sinks within " + OPT.clusterDiameter + " micrometers means the wire from a buffer to its flip-flops is " +
           "short and similar for all of them. Most of the remaining skew comes from that last hop, which " +
           "is why the cluster diameter matters more than it looks."],
          ["Wires cross the memories; buffers step around them.",
           "Look at the branches passing over Memory A and Memory B. The clock runs on " + OPT.clockLayer +
           ", above the layers a macro blocks, so a wire may fly over one. A buffer may not: it is a cell " +
           "and needs a row to stand on, so the tool pushes it to the nearest free space, which bends the " +
           "branch slightly and costs a little skew."],
          ["The tree is not free.",
           fmt(M.buffers) + " buffers were added to a design that had " + fmt(M.z.fg.cells) + " cells, and every one of them " +
           "switches on every clock edge. A clock tree is typically among the largest consumers of power " +
           "in a chip, which is why the flow tries to build the smallest tree that meets the skew target."],
        ]),
      };
    },
  });

  STEPS.push({
    n: 4, title: "Measure skew and latency", button: "Report the tree", againLabel: "Report again",
    line: "How long the clock takes to arrive, and how much that varies between flip-flops.",
    intro:
      "<p>Two numbers describe a clock tree. <strong>Insertion delay</strong>, also called latency, is " +
      "how long the edge takes to travel from the clock port to a flip-flop. <strong>Skew</strong> is " +
      "the difference between the earliest and the latest arrival.</p>" +
      "<p>Latency mostly costs nothing by itself: if every flip-flop is late by the same amount, the " +
      "design does not care. Skew is what hurts, because it is subtracted from the time available on " +
      "every path between two flip-flops that receive the clock at different moments.</p>",
    command: "report_cts\nreport_clock_skew\nreport_clock_latency",
    commandNote:
      "<code>report_cts</code> prints the tree's shape: the number of clock roots, buffers inserted, " +
      "clock subnets and sinks. <code>report_clock_skew</code> reports &quot;the maximum difference in " +
      "clock arrival between every source and target register that has a path between them&quot;, which " +
      "is the number that matters: skew between flip-flops that actually talk to each other.",
    run: function () {
      var M = model(), t = M.t;
      return {
        log: [
          { k: "cmd", t: "report_cts" },
          { k: "out", t: "  [INFO CTS-0003] Total number of Clock Roots: 1." },
          { k: "out", t: "  [INFO CTS-0004] Total number of Buffers Inserted: " + fmt(M.buffers) + "." },
          { k: "out", t: "  [INFO CTS-0005] Total number of Clock Subnets: " + fmt(M.nets) + "." },
          { k: "out", t: "  [INFO CTS-0006] Total number of Sinks: " + fmt(M.flops) + "." },
          { k: "cmd", t: "report_clock_skew" },
          { k: "out", t: "  Clock clk" },
          { k: "out", t: "  " + (t.max * 1000).toFixed(0) + " ps source latency (latest flip-flop)" },
          { k: "out", t: "  " + (t.min * 1000).toFixed(0) + " ps target latency (earliest flip-flop)" },
          { k: "out", t: "  " + (t.skew * 1000).toFixed(0) + " ps setup skew" },
          { k: "cmd", t: "report_clock_latency" },
          { k: "out", t: "  clk  latency " + (t.min * 1000).toFixed(0) + " to " + (t.max * 1000).toFixed(0) +
                         " ps, " + (t.mean * 1000).toFixed(0) + " on average" },
          { k: "ok", t: "Tree measured." },
        ],
        figure: '<p class="ff3-figtext">The graph below is the whole design, every flip-flop in it, ' +
          "grouped by when the clock reaches it. The horizontal axis is arrival time in picoseconds " +
          "after the edge leaves the clock port, from the earliest flip-flop on the left at " +
          (t.min * 1000).toFixed(0) + " to the latest on the right at " + (t.max * 1000).toFixed(0) +
          ". Each bar is a narrow slice of that range, and its height is how many of the " + fmt(M.flops) +
          " flip-flops land in the slice. So the total width of the distribution, " +
          (t.skew * 1000).toFixed(0) + " picoseconds, is the skew, and the horizontal position of the " +
          "bulk of the bars is the latency. A tree that worked gives you one narrow group: every " +
          "flip-flop late by roughly the same amount, which costs nothing between them. Two separated " +
          "humps would mean one half of the design is clocked noticeably ahead of the other, and a long " +
          "tail to the right would mean a few stragglers are setting the skew for everyone.</p>" +
          skewChart(M) +
          '<div class="ff3-legend"><span>each bar counts flip-flops receiving the clock in that ' +
          "window; the width of the whole distribution is the skew</span></div>",
        report: "<h3>Clock tree report</h3>" + table([
          ["Clock roots", "1"],
          ["Buffers inserted", fmt(M.buffers)],
          ["Clock subnets", fmt(M.nets)],
          ["Sinks", fmt(M.flops)],
          ["Insertion delay", (t.min * 1000).toFixed(0) + " to " + (t.max * 1000).toFixed(0) + " picoseconds, " +
            (t.mean * 1000).toFixed(0) + " on average"],
          ["Skew", (t.skew * 1000).toFixed(0) + " picoseconds, " +
            (100 * t.skew / FS.DESIGN.clockPeriodNs).toFixed(1) + "% of the " + FS.DESIGN.clockPeriodNs.toFixed(1) +
            " nanosecond period"],
        ]) + checks([
          ["Skew comes out of every path's budget.",
           (t.skew * 1000).toFixed(0) + " picoseconds is " + (100 * t.skew / FS.DESIGN.clockPeriodNs).toFixed(1) +
           "% of the clock period, and it is deducted from the time available on any path whose two " +
           "flip-flops sit at opposite ends of the distribution. The placement example's critical path " +
           "had 0.21 nanoseconds of slack; this is where some of it goes."],
          ["Latency alone is survivable.",
           "An average of " + (t.mean * 1000).toFixed(0) + " picoseconds to reach a flip-flop sounds like a lot against a " +
           FS.DESIGN.clockPeriodNs.toFixed(1) + " nanosecond period, but a uniform delay shifts every flip-flop equally. " +
           "It costs at the block's boundary, where the clock must line up with the outside world."],
          ["The distribution is the honest picture.",
           "One skew number hides the shape. A long tail of late flip-flops is a different problem from " +
           "two tight groups far apart: the first is fixed by resizing a branch, the second usually means " +
           "the tree split the design in a place the logic did not want."],
        ]),
      };
    },
  });

  STEPS.push({
    n: 5, title: "Legalize what the tree displaced", button: "Legalize again", againLabel: "Legalize again",
    line: "The new buffers landed on top of placed cells; put everything back on legal sites.",
    intro:
      "<p>The tree builder puts its buffers where the tree needs them, not where there happens to be " +
      "room. Some of them land on top of cells that placement had already legalized. So detailed " +
      "placement runs again, the same command as in the placement example, to push everything back onto " +
      "legal sites with as little movement as possible.</p>" +
      "<p>The parasitics are re-estimated first, because the tree just added " +
      "thousands of micrometers of new wire.</p>",
    command:
      "estimate_parasitics -placement\n" +
      "set_placement_padding -global -left " + PL.OPT.padDetail + " -right " + PL.OPT.padDetail + "\n" +
      "detailed_placement",
    commandNote:
      "This is exactly the sequence the reference flow runs after building the tree. The buffers are " +
      "ordinary cells once they exist: they sit on rows, on sites, and they have to be legal like " +
      "everything else.",
    run: function () {
      var M = model();
      var moved = Math.round(M.buffers * 0.62);
      var disp = M.zoom.bufs.reduce(function (a, b) { return a + b.disp; }, 0) / M.zoom.bufs.length;
      return {
        log: [
          { k: "cmd", t: "estimate_parasitics -placement" },
          { k: "cmd", t: "set_placement_padding -global -left " + PL.OPT.padDetail + " -right " + PL.OPT.padDetail },
          { k: "cmd", t: "detailed_placement" },
          { k: "out", t: "  " + fmt(M.buffers) + " clock buffers legalized, " + fmt(moved) + " of them moved to find a site" },
          { k: "out", t: "  average displacement " + f1(disp) + " micrometers, max 9.6" },
          { k: "out", t: "  0 overlaps, 0 instances off-row" },
          { k: "ok", t: "Everything is legal again." },
        ],
        figure: '<p class="ff3-figtext">Watch one window of the block rather than the whole die, because ' +
          "at die scale a buffer moving a micrometer onto a site is invisible. Five rows are drawn, " +
          "already filled with the cells placement legalized, and the copper blocks are clock buffers " +
          "the tree dropped where it wanted them: between rows, and on top of cells that were already " +
          "there. The legalizer takes them one at a time. For each one it searches a window around the " +
          "position it was handed, " + BZ.siteWindow + " sites left and right and " + BZ.rowWindow +
          " rows up and down by default, finds the free runs of sites wide enough to hold the buffer " +
          "plus the padding just set, and moves it to the nearest one. Nothing is shoved along the row. " +
          "The room is the whitespace global placement already left between cells, which is what the " +
          "density target was holding back. When two buffers want the same gap, the second one settles " +
          "for its next choice, which is how a buffer ends up a row away from where the tree asked for " +
          "it.</p>" +
          bufLegalizeFigure(M),
        after: function () { bufLegalizeAnimate(M); },
        report: "<h3>Legalization after the tree</h3>" + table([
          ["Buffers to place", fmt(M.buffers)],
          ["Moved to find a legal site", fmt(moved)],
          ["Area added by the tree", fmt(M.area) + " square micrometers"],
          ["Density", "up about " + (100 * M.area / (M.z.coreArea * 0.7)).toFixed(1) + "% where the tree runs"],
        ]) + checks([
          ["The tree bends to the rows.",
           "A buffer that has to move to find a site is no longer exactly where the tree wanted it, so " +
           "its branch is slightly longer or shorter than planned. That is one of the reasons the skew " +
           "measured after legalization differs from the skew the builder predicted."],
          ["This is why the density target mattered.",
           "The buffers need gaps to land in. On a block placed to full, the search widens until it " +
           "finds one, so a buffer ends up further from the position the tree chose, and the skew " +
           "suffers for it."],
          ["Two engines, the same idea.",
           "What the picture shows, a bounded search for the nearest free run of sites, is one pass of " +
           'the legacy <a href="https://openroad.readthedocs.io/en/latest/main/src/dpl/README.html">' +
           "diamond search engine</a>, which expands outward from each cell in Manhattan order until it " +
           "finds a site. The default engine today is a negotiation legalizer: it lets cells that want " +
           "the same sites bid against each other over many passes, raising the price of a contested " +
           "site each round until they settle. The negotiation is the part this animation compresses " +
           "into one decision."],
        ]),
      };
    },
  });

  STEPS.push({
    n: 6, title: "Switch to the real clock and repair", button: "Repair timing", againLabel: "Repair again",
    line: "With a real clock, hold violations appear where none existed before.",
    intro:
      "<p>Now the important change. The clock is no longer ideal: the tool switches to the " +
      "<em>propagated</em> clock, walking the real path through the buffers instead of assuming zero " +
      "delay. In OpenROAD, building the tree does this automatically.</p>" +
      "<p>And a new problem appears. <strong>Hold</strong> violations: a path so fast that data arrives " +
      "at the capturing flip-flop before that flip-flop has finished capturing the previous cycle's " +
      "value. With an ideal clock these are mostly invisible; with real skew, they are real. The fix is " +
      "to slow the offending paths by inserting buffers, which is the one case in the flow where delay " +
      "is added on purpose.</p>",
    command:
      "estimate_parasitics -placement\n" +
      "repair_timing -hold\n" +
      "detailed_placement\n" +
      "check_placement -verbose",
    commandNote:
      "The resizer's documentation says <code>repair_timing</code> &quot;should be run after clock tree " +
      "synthesis with propagated clocks&quot;, and that setup repair runs before hold repair &quot;so " +
      "that hold repair does not cause setup checks to fail&quot;. Hold buffers cost area and power and " +
      "fix nothing else, so a flow that inserts thousands of them is usually telling you the skew is too " +
      "large.",
    run: function () {
      var M = model(), t = M.t;
      var holdViolations = Math.round(M.flops * 0.021);
      var holdBuffers = Math.round(holdViolations * 1.6);
      var setupAfter = 0.21 - t.skew;
      return {
        log: [
          { k: "cmd", t: "estimate_parasitics -placement" },
          { k: "cmd", t: "repair_timing -hold" },
          { k: "out", t: "  [INFO RSZ-0046] Found " + fmt(holdViolations) + " endpoints with hold violations." },
          { k: "out", t: "  [INFO RSZ-0032] Inserted " + fmt(holdBuffers) + " hold buffers." },
          { k: "cmd", t: "detailed_placement" },
          { k: "cmd", t: "check_placement -verbose" },
          { k: "out", t: "  [INFO FLW-0012] Placement violations ." },
          { k: "ok", t: "Timing repaired against the real clock." },
        ],
        figure: '<p class="ff3-figtext">A hold check is about one path and two clock edges, so the ' +
          "picture is a timeline rather than a floorplan. It follows a single short path between two " +
          "neighbouring flip-flops: the clock edge reaching the one that launches the data, the same " +
          "edge reaching the one that captures it " + Math.round(t.skew * 1000) + " picoseconds later, " +
          "the window the capturing flip-flop needs its input to stay steady, and where the data " +
          "actually lands. Watch it land inside the window, then watch hold repair push it clear.</p>" +
          holdFigure(M),
        after: function () { holdAnimate(M); },
        report: "<h3>Timing against a real clock</h3>" + table([
          ["Clock", "propagated: the real path through " + M.depth + " levels of buffers"],
          ["Setup slack", "0.21 → " + setupAfter.toFixed(2) + " nanoseconds, after skew is charged against it"],
          ["Hold violations found", fmt(holdViolations) + " endpoints"],
          ["Hold buffers inserted", fmt(holdBuffers)],
          ["Worst hold slack", "negative before repair, positive after"],
        ]) + checks([
          ["Setup got harder, and by how much was predictable.",
           "The skew measured in step 4, " + (t.skew * 1000).toFixed(0) + " picoseconds, comes straight off the setup slack: " +
           "0.21 nanoseconds becomes about " + setupAfter.toFixed(2) + ". Nothing about the logic changed; the clock simply " +
           "stopped being a fiction."],
          ["Hold violations are new, not newly discovered.",
           "A hold check asks whether data arrives too <em>early</em> at the capturing flip-flop. With a " +
           "perfectly ideal clock the launching and capturing edges coincide and short paths are usually " +
           "fine. Give the capture clock a little more delay than the launch clock, which is exactly what " +
           "skew is, and a fast path can overrun its target."],
          ["Hold repair is deliberate slowing.",
           "The only fix is to make the fast path slower, by inserting buffers whose delay is the point. " +
           "They cost area and switch every cycle. This is why skew is worth minimizing even when setup " +
           "timing looks comfortable."],
        ]),
      };
    },
  });

  STEPS.push({
    n: 7, title: "Check and hand off", button: "Check and write out", againLabel: "Write again",
    line: "Report the final skew, confirm legality, and save the design for routing.",
    intro:
      "<p>The clock is real, the design is legal, and timing has been repaired against it. What leaves " +
      "this stage is the placement plus a clock tree: every flip-flop reached through a known path, with " +
      "a measured skew and latency.</p>" +
      "<p>What is <em>not</em> finished is the wiring. This stage created cells and connectivity: " +
      "buffers that really exist, on real sites, and nets that say which buffer drives which flip-flop " +
      "clock pin. In this flow it committed no metal to the design. The tree builder is not blind to " +
      "geometry, it chose segment lengths and buffer positions and kept them off the macros, but none " +
      "of that was written down as wire, so every length, resistance, capacitance, delay and skew " +
      "measured in the last four steps is an estimate of a wire that does not exist yet.</p>" +
      "<p>That split is a choice this flow makes, not a law. Many commercial flows route the clock nets " +
      "as soon as the tree is built, so that later optimization sees real clock parasitics instead of " +
      "estimates. Here the clock is routed with everything else, in the next stage.</p>" +
      "<p>So routing still has this tree to build, and under stricter rules than the rest of the " +
      "design. Its nets are confined to the clock layers the floorplan reserved, metal4 to metal6, and " +
      "the upper levels of the tree carry a non-default rule of double spacing, which " +
      "<code>clock_tree_synthesis</code> attached to them here and the router has to honour. The metal " +
      "the router chooses will not follow the straight lines the estimate assumed, so the lengths " +
      "change, the delays change, and the skew changes with them. That is why it gets measured " +
      "again after routing.</p>",
    command:
      "report_clock_skew\n" +
      "report_checks -path_delay max -format full_clock_expanded\n" +
      "write_db tile4m_cts.odb",
    commandNote:
      "<code>-format full_clock_expanded</code> is what makes the report show the clock path itself, " +
      "buffer by buffer, on both the launching and the capturing side. Those two paths share their first " +
      "few buffers, and the shared part is what the &quot;clock reconvergence pessimism&quot; line " +
      "removes.",
    run: function () {
      var M = model(), t = M.t;
      var text =
        "==========================================================================\n" +
        "cts final report_clock_skew\n" +
        "--------------------------------------------------------------------------\n" +
        "Clock clk\n" +
        "   " + (t.max).toFixed(2) + " source latency hub/acc_reg[7]/CK ^\n" +
        "  -" + (t.min).toFixed(2) + " target latency ctrl_c/state_reg[1]/CK ^\n" +
        "   0.00 CRPR\n" +
        "--------------\n" +
        "   " + t.skew.toFixed(2) + " setup skew\n";
      return {
        log: [
          { k: "cmd", t: "report_clock_skew" },
          { k: "out", t: "  setup skew " + t.skew.toFixed(2) + " nanoseconds" },
          { k: "cmd", t: "report_checks -path_delay max -format full_clock_expanded" },
          { k: "out", t: "  the clock path now appears in the report, buffer by buffer" },
          { k: "cmd", t: "write_db tile4m_cts.odb" },
          { k: "ok", t: "Clock tree complete. Next stage: routing." },
        ],
        figure: '<pre class="pl-report">' + esc(text) + "</pre>" +
          treeFigure(M, M.tree.depth, "The finished clock tree over the placed design"),
        report: "<h3>What routing receives</h3>" + table([
          ["Clock tree", fmt(M.buffers) + " buffers, " + M.depth + " levels, " + fmt(M.nets) + " clock nets"],
          ["Skew", (t.skew * 1000).toFixed(0) + " picoseconds"],
          ["Insertion delay", (t.mean * 1000).toFixed(0) + " picoseconds on average"],
          ["Clock", "propagated from here on: no stage assumes an ideal clock again"],
          ["Placement", "legal, with the tree's buffers and the hold buffers in place"],
        ]) + checks([
          ["The skew number is provisional.",
           "It was measured on estimated wire, not routed wire. Every clock net here is still a list of " +
           "pins with no metal between them. Routing will give them real paths, longer and less direct " +
           "than the straight lines the estimate used, which is why skew is measured again afterwards."],
          ["The tree asked routing for special treatment, and it did so here.",
           "<code>clock_tree_synthesis</code> takes an <code>-apply_ndr</code> option that attaches a " +
           "double-spacing non-default rule to the clock nets, leaf nets excepted. Its default strategy, " +
           '<code>half</code>, applies it to the first half of the tree levels counting from the root. ' +
           "Those levels carry the whole design's clock and their delay lands in every path, so they are " +
           "worth the extra area. The rule is recorded on the nets now and obeyed later, by the router."],
          ["Every later stage inherits the real clock.",
           "From here the clock is propagated everywhere. The timing example's reports walk the clock " +
           "path through these buffers rather than printing the ideal zero."],
          ["Continue the design.",
           'Next is <a href="/explore/examples/routing">routing</a>, which turns every connection, ' +
           "including this tree, into metal on tracks."],
        ]),
      };
    },
  });

  var STAGE = {
    key: "cts",
    steps: STEPS,
    finishedTitle: "Clock tree complete.",
    finishedNote: "Every flip-flop has a real clock path, with measured skew and latency. Next is " +
      '<a href="/explore/examples/routing">routing</a>.',
    epilogue:
      "<h3>How this differs from a production flow</h3>" +
      "<p>The shape of this example is right, and every step asks a question a real flow asks. Five " +
      "things a production clock tree does that this one does not:</p>" +
      '<ul class="ff-checks">' +
      "<li><strong>It routes the clock here.</strong> Commercial flows commit the clock to metal during " +
      "or immediately after this stage, so that hold repair and every later optimization see real " +
      "parasitics instead of estimates. This flow leaves the clock to the router with everything else, " +
      "and pays for it by measuring the skew again afterwards.</li>" +
      "<li><strong>It optimizes the clock and the data together.</strong> Concurrent clock and data " +
      "optimization does not aim for zero skew at all. It deliberately gives a slow path's capturing " +
      "flip-flop a later edge, borrowing time from the next stage of the pipeline. Minimizing skew, " +
      "the goal throughout this example, is what you do when you have nothing better to do with that " +
      "freedom.</li>" +
      "<li><strong>It proves the tree across corners, modes and variation.</strong> A real tree is " +
      "balanced at several process corners and in several functional modes at once, with on-chip " +
      "variation charged against the clock path and the shared part of the launching and capturing " +
      "paths credited back. That credit is the clock reconvergence pessimism line in step 7's report, " +
      "which reads 0.00 here because this model has no variation in it.</li>" +
      "<li><strong>It handles structures this design does not have.</strong> Clock gating cells, " +
      "several clocks, generated and multiplexed clocks, and on a large chip a tree built per block " +
      "against a skew and latency budget and then stitched together at the top level. The highest " +
      "performance designs abandon the tree entirely for a mesh or a spine, because a tree's skew is " +
      "limited by how well it can be balanced.</li>" +
      "<li><strong>It protects the clock wires further.</strong> Wider wires on the trunk and grounded " +
      "shield wires alongside it, on top of the double spacing this stage attached to the upper " +
      "levels.</li></ul>",
    footNote: 'Build trees by hand in the <a href="/explore/algorithms/cts">clock tree sandbox</a> (in the works).',
  };
  if (typeof window !== "undefined" && window.FLOW_PAGE_STAGE === STAGE.key) window.FLOW_STAGE = STAGE;

  return { OPT: OPT, model: model, STAGE: STAGE, STEPS: STEPS, treeFigure: treeFigure, skewChart: skewChart };
})();

if (typeof module !== "undefined" && module.exports) module.exports = CtsSteps;
