/* Core model for the floorplan sandbox explorable: die sizing from
   utilization and aspect ratio, macro geometry and legality, a quick
   spring-model forecast of where the standard-cell logic will sit, and
   two routing-congestion forecasts on a coarse bin grid:
     rudy    - RUDY (Rectangular Uniform wire DensitY): every connection
               smears its wire evenly over its bounding box, blind to
               obstacles and to direction
     groute  - trial global route: a pattern router (L and Z shapes)
               that prices congestion, so it detours and it sees which
               direction of a channel is full
   Pure data and math, no browser dependencies, so the same file runs
   under node for testing. Units are micrometers throughout; the y axis
   points down (screen convention). */

var FloorplanCore = (function () {
  "use strict";

  var BIN = 20;            /* target forecast bin edge; each die stretches it slightly to tile exactly */
  var SUB = 4;             /* coverage subsamples per bin edge */
  var HALO = 10;           /* keep-out ring around each macro */
  var SNAP = 5;            /* macro placement grid */
  var CELL_AREA = 130000;  /* total standard-cell area, square micrometers */
  var TRACKS = 60;         /* routing tracks per bin edge, per direction */
  var OVER_MACRO = 0.35;   /* share of tracks still usable above a macro */
  var LOCAL = 0.55;        /* share of tracks eaten by cell-to-cell wiring at full density */
  var CHUNK = 8;           /* bits routed together as one connection */

  /* Base orientation has the pin edge on the bottom (south). */
  var MACROS = [
    { id: "A", label: "Memory A", w: 150, h: 90 },
    { id: "B", label: "Memory B", w: 150, h: 90 },
    { id: "C", label: "Memory C", w: 110, h: 110 },
    { id: "D", label: "Memory D", w: 110, h: 110 },
  ];
  var SPEC = {};
  MACROS.forEach(function (m) { SPEC[m.id] = m; });

  var SIDES = ["N", "E", "S", "W"];

  /* Input/output pin groups on the die boundary: side, position along
     that side (0..1), and the length of boundary they occupy. */
  var PORTS = [
    { id: "W", label: "inputs", side: "W", at: 0.5, span: 120 },
    { id: "E", label: "outputs", side: "E", at: 0.5, span: 120 },
    { id: "N", label: "control", side: "N", at: 0.5, span: 80 },
  ];

  /* Logic clusters: one controller per memory plus the central hub. */
  var CLUSTERS = ["A", "B", "C", "D", "hub"];

  /* The netlist, as buses between endpoints. An endpoint is
     {macro: id} (that macro's pin edge), {port: id}, or {cluster: id}. */
  var NETS = [];
  MACROS.forEach(function (m) {
    NETS.push({ a: { macro: m.id }, b: { cluster: m.id }, bits: 64 });
    NETS.push({ a: { cluster: m.id }, b: { cluster: "hub" }, bits: 32 });
  });
  NETS.push({ a: { port: "W" }, b: { cluster: "hub" }, bits: 32 });
  NETS.push({ a: { port: "E" }, b: { cluster: "hub" }, bits: 32 });
  NETS.push({ a: { port: "N" }, b: { cluster: "hub" }, bits: 16 });

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function snap(v) { return Math.round(v / SNAP) * SNAP; }

  function macroArea() {
    return MACROS.reduce(function (s, m) { return s + m.w * m.h; }, 0);
  }

  /* ----- die ----- */

  /* Core utilization = (cell area + macro area) / core area, the same
     definition OpenROAD's CORE_UTILIZATION uses. Aspect ratio is
     height / width. The die keeps its exact size (to the micrometer),
     and the forecast bins stretch a little (bw x bh, close to BIN) so a
     whole number of them tiles it; rounding the die to whole bins would
     shift the utilization by several points. */
  function die(util, ar) {
    var area = (CELL_AREA + macroArea()) / util;
    var w = Math.round(Math.sqrt(area / ar));
    var h = Math.round(area / w);
    var nx = Math.max(1, Math.round(w / BIN)), ny = Math.max(1, Math.round(h / BIN));
    return { w: w, h: h, nx: nx, ny: ny, bw: w / nx, bh: h / ny };
  }

  /* ----- macros ----- */

  /* A macro's state is {id, cx, cy, rot}: its center as a fraction of
     the die, so it keeps its relative spot when the die reshapes, and
     rot = quarter turns clockwise. Returns absolute geometry. */
  function geometry(m, d) {
    var spec = SPEC[m.id];
    var odd = m.rot % 2 === 1;
    var w = odd ? spec.h : spec.w;
    var h = odd ? spec.w : spec.h;
    var fits = w <= d.w && h <= d.h;
    var x = clamp(snap(m.cx * d.w - w / 2), 0, Math.max(0, d.w - w));
    var y = clamp(snap(m.cy * d.h - h / 2), 0, Math.max(0, d.h - h));
    var side = SIDES[(2 + m.rot) % 4];
    return {
      id: m.id, label: spec.label, x: x, y: y, w: w, h: h,
      side: side, fits: fits, pin: pinSegment(x, y, w, h, side),
    };
  }

  /* The usable pin stretch: the middle 80% of the pin edge, as two end
     points, plus the outward unit normal. */
  function pinSegment(x, y, w, h, side) {
    var m = 0.1;
    if (side === "N") return { x0: x + w * m, y0: y, x1: x + w * (1 - m), y1: y, nx: 0, ny: -1 };
    if (side === "S") return { x0: x + w * m, y0: y + h, x1: x + w * (1 - m), y1: y + h, nx: 0, ny: 1 };
    if (side === "W") return { x0: x, y0: y + h * m, x1: x, y1: y + h * (1 - m), nx: -1, ny: 0 };
    return { x0: x + w, y0: y + h * m, x1: x + w, y1: y + h * (1 - m), nx: 1, ny: 0 };
  }

  function portSegment(p, d) {
    var half = p.span / 2;
    if (p.side === "W" || p.side === "E") {
      var cy = p.at * d.h;
      var px = p.side === "W" ? 0 : d.w;
      return { x0: px, y0: clamp(cy - half, 0, d.h), x1: px, y1: clamp(cy + half, 0, d.h),
               nx: p.side === "W" ? 1 : -1, ny: 0 };
    }
    var cx = p.at * d.w;
    var py = p.side === "N" ? 0 : d.h;
    return { x0: clamp(cx - half, 0, d.w), y0: py, x1: clamp(cx + half, 0, d.w), y1: py,
             nx: 0, ny: p.side === "N" ? 1 : -1 };
  }

  function segPoint(s, t) {
    return { x: s.x0 + (s.x1 - s.x0) * t, y: s.y0 + (s.y1 - s.y0) * t };
  }

  function inRect(px, py, r, grow) {
    return px >= r.x - grow && px < r.x + r.w + grow &&
           py >= r.y - grow && py < r.y + r.h + grow;
  }

  function overlap(a, b) {
    return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  }

  /* ----- coverage ----- */

  /* Per bin: fraction under a macro body, and fraction blocked for
     standard cells (macro plus halo). Subsampled SUB x SUB per bin. */
  function coverage(d, macros) {
    var n = d.nx * d.ny;
    var macroFrac = new Float64Array(n);
    var blockFrac = new Float64Array(n);
    var sw = d.bw / SUB, sh = d.bh / SUB, inv = 1 / (SUB * SUB);
    for (var by = 0; by < d.ny; by++) {
      for (var bx = 0; bx < d.nx; bx++) {
        var b = by * d.nx + bx, mc = 0, bc = 0;
        for (var sy = 0; sy < SUB; sy++) {
          for (var sx = 0; sx < SUB; sx++) {
            var px = (bx + (sx + 0.5) / SUB) * d.bw;
            var py = (by + (sy + 0.5) / SUB) * d.bh;
            var inM = false, inB = false;
            for (var k = 0; k < macros.length; k++) {
              if (inRect(px, py, macros[k], 0)) { inM = true; inB = true; break; }
              if (inRect(px, py, macros[k], HALO)) inB = true;
            }
            if (inM) mc++;
            if (inB) bc++;
          }
        }
        macroFrac[b] = mc * inv;
        blockFrac[b] = bc * inv;
      }
    }
    return { macroFrac: macroFrac, blockFrac: blockFrac };
  }

  function binOf(d, px, py) {
    var bx = clamp(Math.floor(px / d.bw), 0, d.nx - 1);
    var by = clamp(Math.floor(py / d.bh), 0, d.ny - 1);
    return by * d.nx + bx;
  }

  /* ----- where the logic goes ----- */

  /* Each cluster sits at the bit-weighted average of everything it
     connects to (a spring system, solved by repeated averaging), then
     moves to the nearest bin that has room for cells. */
  function placeClusters(d, macros, cov) {
    var byId = {};
    macros.forEach(function (m) { byId[m.id] = m; });
    var pos = {};
    CLUSTERS.forEach(function (c) { pos[c] = { x: d.w / 2, y: d.h / 2 }; });

    function fixedPoint(e) {
      if (e.macro) return segPoint(byId[e.macro].pin, 0.5);
      if (e.port) return segPoint(portSegment(portById(e.port), d), 0.5);
      return null;
    }

    for (var it = 0; it < 200; it++) {
      CLUSTERS.forEach(function (c) {
        var sx = 0, sy = 0, sw = 0;
        NETS.forEach(function (net) {
          var other = null;
          if (net.a.cluster === c) other = net.b;
          else if (net.b.cluster === c) other = net.a;
          if (!other) return;
          var p = other.cluster ? pos[other.cluster] : fixedPoint(other);
          sx += p.x * net.bits; sy += p.y * net.bits; sw += net.bits;
        });
        if (sw) pos[c] = { x: sx / sw, y: sy / sw };
      });
    }

    var out = {};
    CLUSTERS.forEach(function (c) {
      var p = pos[c];
      var b = binOf(d, p.x, p.y);
      if (cov.blockFrac[b] > 0.5) {
        var best = -1, bestD = Infinity;
        for (var k = 0; k < d.nx * d.ny; k++) {
          if (cov.blockFrac[k] > 0.5) continue;
          var cx = (k % d.nx + 0.5) * d.bw, cy = (((k / d.nx) | 0) + 0.5) * d.bh;
          var dd = Math.abs(cx - p.x) + Math.abs(cy - p.y);
          if (dd < bestD) { bestD = dd; best = k; }
        }
        if (best !== -1) p = { x: (best % d.nx + 0.5) * d.bw, y: (((best / d.nx) | 0) + 0.5) * d.bh };
      }
      out[c] = { x: p.x, y: p.y };
    });
    return out;
  }

  function portById(id) {
    for (var i = 0; i < PORTS.length; i++) if (PORTS[i].id === id) return PORTS[i];
    return null;
  }

  /* ----- connections ----- */

  /* Split every bus into CHUNK-bit connections, fanning the ends out
     along pin edges (real macro pins are spread along the edge) and
     around cluster centers (logic occupies area, not a point). */
  var SPREAD = [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];

  function endpoint(e, k, n, d, byId, clusters) {
    var p;
    if (e.macro || e.port) {
      var s = e.macro ? byId[e.macro].pin : portSegment(portById(e.port), d);
      p = segPoint(s, (k + 0.5) / n);
      /* nudge one micrometer off the edge, into the routing space
         (macro normals point out of the macro, port normals into the die) */
      p.x += s.nx;
      p.y += s.ny;
    } else {
      var c = clusters[e.cluster], o = SPREAD[k % SPREAD.length];
      p = { x: c.x + o[0] * d.bw * 0.8, y: c.y + o[1] * d.bh * 0.8 };
    }
    return { x: clamp(p.x, 0, d.w - 0.01), y: clamp(p.y, 0, d.h - 0.01) };
  }

  function connections(d, macros, clusters) {
    var byId = {};
    macros.forEach(function (m) { byId[m.id] = m; });
    var list = [];
    NETS.forEach(function (net, ni) {
      var n = Math.max(1, Math.round(net.bits / CHUNK));
      for (var k = 0; k < n; k++) {
        list.push({
          net: ni,
          a: endpoint(net.a, k, n, d, byId, clusters),
          b: endpoint(net.b, k, n, d, byId, clusters),
        });
      }
    });
    return list;
  }

  /* ----- capacity ----- */

  /* Per bin, per direction: raw tracks (macros block the lower metal
     layers, leaving OVER_MACRO of the tracks) and the local demand of
     the cell-to-cell wiring that lives among the standard cells. */
  function capacity(d, cov, cellFrac) {
    var n = d.nx * d.ny;
    var cap = new Float64Array(n), local = new Float64Array(n);
    for (var b = 0; b < n; b++) {
      cap[b] = TRACKS * (1 - cov.macroFrac[b] * (1 - OVER_MACRO));
      local[b] = TRACKS * LOCAL * cellFrac[b];
    }
    return { cap: cap, local: local };
  }

  /* ----- forecast 1: RUDY (Rectangular Uniform wire DensitY) ----- */

  function rudy(d, conns, caps) {
    var n = d.nx * d.ny;
    var demand = new Float64Array(n); /* wire length, micrometers */
    conns.forEach(function (c) {
      var x0 = Math.min(c.a.x, c.b.x), x1 = Math.max(c.a.x, c.b.x);
      var y0 = Math.min(c.a.y, c.b.y), y1 = Math.max(c.a.y, c.b.y);
      /* a box thinner than one bin still spans one bin */
      if (x1 - x0 < d.bw) { var mx = (x0 + x1) / 2; x0 = mx - d.bw / 2; x1 = mx + d.bw / 2; }
      if (y1 - y0 < d.bh) { var my = (y0 + y1) / 2; y0 = my - d.bh / 2; y1 = my + d.bh / 2; }
      var bw = x1 - x0, bh = y1 - y0;
      var dens = CHUNK * (bw + bh) / (bw * bh);
      var bx0 = clamp(Math.floor(x0 / d.bw), 0, d.nx - 1), bx1 = clamp(Math.floor(x1 / d.bw), 0, d.nx - 1);
      var by0 = clamp(Math.floor(y0 / d.bh), 0, d.ny - 1), by1 = clamp(Math.floor(y1 / d.bh), 0, d.ny - 1);
      for (var by = by0; by <= by1; by++) {
        var oy = Math.min(y1, (by + 1) * d.bh) - Math.max(y0, by * d.bh);
        if (oy <= 0) continue;
        for (var bx = bx0; bx <= bx1; bx++) {
          var ox = Math.min(x1, (bx + 1) * d.bw) - Math.max(x0, bx * d.bw);
          if (ox <= 0) continue;
          demand[by * d.nx + bx] += dens * ox * oy;
        }
      }
    });
    /* both directions pooled, as wire length: RUDY (Rectangular Uniform
       wire DensitY) cannot tell horizontal from vertical. Horizontal
       tracks cross the bin's width, vertical tracks its height. */
    var ratio = new Float64Array(n), span = d.bw + d.bh;
    for (var b = 0; b < n; b++) {
      ratio[b] = (demand[b] + caps.local[b] * span) / (Math.max(caps.cap[b], 1) * span);
    }
    return { ratio: ratio, routedWL: null };
  }

  /* ----- forecast 2: trial global route (pattern router) ----- */

  function groute(d, conns, caps) {
    var nx = d.nx, ny = d.ny;
    var nH = Math.max(0, nx - 1) * ny, nV = nx * Math.max(0, ny - 1);
    var capH = new Float64Array(nH), useH = new Float64Array(nH);
    var capV = new Float64Array(nV), useV = new Float64Array(nV);
    var x, y;
    for (y = 0; y < ny; y++) for (x = 0; x < nx - 1; x++) {
      var a = y * nx + x, e = y * (nx - 1) + x;
      capH[e] = (caps.cap[a] + caps.cap[a + 1]) / 2;
      useH[e] = (caps.local[a] + caps.local[a + 1]) / 2;
    }
    for (y = 0; y < ny - 1; y++) for (x = 0; x < nx; x++) {
      var a2 = y * nx + x, e2 = y * nx + x;
      capV[e2] = (caps.cap[a2] + caps.cap[a2 + nx]) / 2;
      useV[e2] = (caps.local[a2] + caps.local[a2 + nx]) / 2;
    }

    function hEdge(xa, yy) { return yy * (nx - 1) + xa; }   /* between xa and xa+1 */
    function vEdge(xx, ya) { return ya * nx + xx; }         /* between ya and ya+1 */

    /* a route is a list of signed edge ids, in travel order from the
       first endpoint: +(e+1) horizontal, -(e+1) vertical */
    function hRun(list, xa, xb, yy) {
      var st = xb > xa ? 1 : -1;
      for (var i = xa; i !== xb; i += st) list.push(hEdge(st > 0 ? i : i - 1, yy) + 1);
    }
    function vRun(list, ya, yb, xx) {
      var st = yb > ya ? 1 : -1;
      for (var i = ya; i !== yb; i += st) list.push(-(vEdge(xx, st > 0 ? i : i - 1) + 1));
    }

    function edgeCost(id) {
      var use, cap;
      if (id > 0) { use = useH[id - 1]; cap = capH[id - 1]; }
      else { use = useV[-id - 1]; cap = capV[-id - 1]; }
      var r = (use + CHUNK) / Math.max(cap, 1);
      return 1 + 3 * r * r * r * r;
    }

    function commit(route, sign) {
      route.forEach(function (id) {
        if (id > 0) useH[id - 1] += sign * CHUNK;
        else useV[-id - 1] += sign * CHUNK;
      });
    }

    function best(c) {
      var x1 = c.bx % nx, y1 = (c.bx / nx) | 0;
      var x2 = c.bb % nx, y2 = (c.bb / nx) | 0;
      var bestRoute = [], bestCost = Infinity, m, r, cost, j;
      /* horizontal-vertical-horizontal, bend column m */
      for (m = Math.min(x1, x2); m <= Math.max(x1, x2); m++) {
        r = [];
        hRun(r, x1, m, y1); vRun(r, y1, y2, m); hRun(r, m, x2, y2);
        cost = 0;
        for (j = 0; j < r.length; j++) cost += edgeCost(r[j]);
        if (cost < bestCost) { bestCost = cost; bestRoute = r; }
      }
      /* vertical-horizontal-vertical, bend row m */
      for (m = Math.min(y1, y2); m <= Math.max(y1, y2); m++) {
        r = [];
        vRun(r, y1, m, x1); hRun(r, x1, x2, m); vRun(r, m, y2, x2);
        cost = 0;
        for (j = 0; j < r.length; j++) cost += edgeCost(r[j]);
        if (cost < bestCost) { bestCost = cost; bestRoute = r; }
      }
      return bestRoute;
    }

    var items = conns.map(function (c) {
      return {
        bx: binOf(d, c.a.x, c.a.y), bb: binOf(d, c.b.x, c.b.y),
        len: Math.abs(c.a.x - c.b.x) + Math.abs(c.a.y - c.b.y), route: [],
      };
    });
    /* short connections first: they have the fewest alternatives */
    var order = items.slice().sort(function (p, q) { return p.len - q.len; });
    order.forEach(function (it) { it.route = best(it); commit(it.route, 1); });
    /* two rounds of rip-up and reroute, each connection with all others fixed */
    for (var pass = 0; pass < 2; pass++) {
      order.forEach(function (it) {
        commit(it.route, -1);
        it.route = best(it);
        commit(it.route, 1);
      });
    }

    var routedWL = 0;
    items.forEach(function (it) {
      it.route.forEach(function (id) { routedWL += (id > 0 ? d.bw : d.bh) * CHUNK; });
    });

    /* per bin: the busier direction, each direction the worse of its two edges */
    var ratio = new Float64Array(nx * ny);
    for (y = 0; y < ny; y++) for (x = 0; x < nx; x++) {
      var hr = 0, vr = 0, e3;
      if (x > 0) { e3 = hEdge(x - 1, y); hr = Math.max(hr, useH[e3] / Math.max(capH[e3], 1)); }
      if (x < nx - 1) { e3 = hEdge(x, y); hr = Math.max(hr, useH[e3] / Math.max(capH[e3], 1)); }
      if (y > 0) { e3 = vEdge(x, y - 1); vr = Math.max(vr, useV[e3] / Math.max(capV[e3], 1)); }
      if (y < ny - 1) { e3 = vEdge(x, y); vr = Math.max(vr, useV[e3] / Math.max(capV[e3], 1)); }
      ratio[y * nx + x] = Math.max(hr, vr);
    }

    var routes = items.map(function (it) { return { from: it.bx, route: it.route }; });
    return { ratio: ratio, routedWL: routedWL, routes: routes };
  }

  /* ----- legality ----- */

  function checks(d, macros, density) {
    var warn = [];
    macros.forEach(function (m) {
      if (!m.fits) warn.push(m.label + " is larger than the die in this shape.");
    });
    for (var i = 0; i < macros.length; i++) {
      for (var j = i + 1; j < macros.length; j++) {
        if (overlap(macros[i], macros[j])) {
          warn.push(macros[i].label + " and " + macros[j].label + " overlap.");
        }
      }
    }
    /* pin access: a halo's depth in front of the pin edge must be open */
    macros.forEach(function (m) {
      var s = m.pin, blocked = false;
      for (var t = 0.1; t < 1; t += 0.2) {
        var p = segPoint(s, t);
        var qx = p.x + s.nx * HALO, qy = p.y + s.ny * HALO;
        if (qx < 0 || qx > d.w || qy < 0 || qy > d.h) { blocked = true; break; }
        for (var k = 0; k < macros.length; k++) {
          if (macros[k] !== m && inRect(qx, qy, macros[k], 0)) { blocked = true; break; }
        }
        if (blocked) break;
      }
      if (blocked) warn.push(m.label + "'s pins face the die edge or another macro, with no room to reach them.");
    });
    if (density > 1) {
      warn.push("The standard cells do not fit: they need " + Math.round(density * 100) +
                "% of the space the macros and halos leave free.");
    }
    return warn;
  }

  /* ----- everything ----- */

  /* state = {util, ar, forecast: "rudy" | "groute", macros: [{id, cx, cy, rot}]} */
  function evaluate(state) {
    var d = die(state.util, state.ar);
    var macros = state.macros.map(function (m) { return geometry(m, d); });
    var cov = coverage(d, macros);
    var n = d.nx * d.ny;

    var free = 0;
    for (var b = 0; b < n; b++) free += (1 - cov.blockFrac[b]) * d.bw * d.bh;
    var density = free > 0 ? CELL_AREA / free : Infinity;
    var cellFrac = new Float64Array(n);
    for (b = 0; b < n; b++) cellFrac[b] = (1 - cov.blockFrac[b]) * Math.min(density, 1);

    var clusters = placeClusters(d, macros, cov);
    var conns = connections(d, macros, clusters);
    var caps = capacity(d, cov, cellFrac);
    var fc = state.forecast === "groute" ? groute(d, conns, caps) : rudy(d, conns, caps);

    var hpwl = 0;
    conns.forEach(function (c) {
      hpwl += CHUNK * (Math.abs(c.a.x - c.b.x) + Math.abs(c.a.y - c.b.y));
    });

    var peak = 0, over = 0;
    for (b = 0; b < n; b++) {
      if (fc.ratio[b] > peak) peak = fc.ratio[b];
      if (fc.ratio[b] > 1) over++;
    }

    return {
      die: d,
      macros: macros,
      clusters: clusters,
      conns: conns,
      cellFrac: cellFrac,
      blockFrac: cov.blockFrac,
      ratio: fc.ratio,
      routes: fc.routes || null,
      metrics: {
        coreArea: d.w * d.h,
        util: (CELL_AREA + macroArea()) / (d.w * d.h),
        density: density,
        hpwl: hpwl,
        routedWL: fc.routedWL,
        peak: peak,
        overPct: 100 * over / n,
      },
      warnings: checks(d, macros, density),
    };
  }

  /* ----- presets ----- */

  function presets() {
    return {
      middle: {
        label: "Macros in the middle",
        macros: [
          { id: "A", cx: 0.36, cy: 0.40, rot: 0 },
          { id: "B", cx: 0.66, cy: 0.40, rot: 0 },
          { id: "C", cx: 0.39, cy: 0.64, rot: 2 },
          { id: "D", cx: 0.63, cy: 0.64, rot: 2 },
        ],
      },
      edges: {
        label: "Macros on the edges, pins facing in",
        macros: [
          { id: "A", cx: 0.15, cy: 0.09, rot: 0 },
          { id: "B", cx: 0.85, cy: 0.09, rot: 0 },
          { id: "C", cx: 0.11, cy: 0.89, rot: 2 },
          { id: "D", cx: 0.89, cy: 0.89, rot: 2 },
        ],
      },
      wall: {
        label: "Pins facing the wall",
        macros: [
          { id: "A", cx: 0.15, cy: 0.09, rot: 2 },
          { id: "B", cx: 0.85, cy: 0.09, rot: 2 },
          { id: "C", cx: 0.11, cy: 0.89, rot: 0 },
          { id: "D", cx: 0.89, cy: 0.89, rot: 0 },
        ],
      },
      channel: {
        label: "Tight channel",
        macros: [
          { id: "A", cx: 0.38, cy: 0.12, rot: 3 },
          { id: "B", cx: 0.62, cy: 0.12, rot: 1 },
          { id: "C", cx: 0.11, cy: 0.89, rot: 2 },
          { id: "D", cx: 0.89, cy: 0.89, rot: 2 },
        ],
      },
    };
  }

  return {
    BIN: BIN, HALO: HALO, SNAP: SNAP, CELL_AREA: CELL_AREA,
    MACROS: MACROS, PORTS: PORTS, CLUSTERS: CLUSTERS, NETS: NETS,
    die: die,
    geometry: geometry,
    portSegment: portSegment,
    evaluate: evaluate,
    presets: presets,
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = FloorplanCore;
