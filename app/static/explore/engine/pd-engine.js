/* A simplified physical design engine that runs in the browser, on a real
   netlist. It is not OpenROAD: each stage is a smaller version of the
   algorithm the real flow runs, written to finish in seconds, and its
   numbers are estimates. What it shares with the real flow is the input,
   the synthesized netlist, the library's cell sizes, and the design's own
   floorplan rules, so its pictures and trends are of the actual design.

   Stages so far:
     floorplan   core and die from the utilization, rows, memory placement,
                 pins on the edge the design's io.tcl allows
     place       SimPL-style global placement: solve the quadratic
                 wirelength problem, spread the cells to the density
                 target, pull each cell toward its spread spot, repeat
                 (Kim, Lee and Markov, SimPL, ICCAD 2010, simplified)
     legalize    Tetris-style: cells in order of x, each to the nearest
                 free, site-aligned spot within a few rows

   Coordinates are micrometers, origin at the core's lower left, y up. */

(function (root) {
  "use strict";

  /* the halo and the default margin; a design's own settings (D.meta.flow)
     give its margin, and say whether its pins are on the bottom edge only
     or on all four */
  var HALO = 2.0, MARGIN = 5.0, MACRO_GAP = 2 * HALO;
  function flowOf(D) { return D.meta.flow || { margin: MARGIN, pins: "bottom" }; }

  /* ----- floorplan ----- */
  var PRESETS = {
    flow: "along the top edge, packed to the right, as the real flow placed them",
    topleft: "along the top edge, packed to the left",
    split: "two in each top corner",
    middle: "in a row across the middle of the core",
    bottom: "along the bottom edge, where the pins are",
  };

  function floorplan(D, knobs) {
    var rowH = D.meta.rowH, site = D.meta.site;
    var std = 0, macroArea = 0, mac = null;
    D.cells.forEach(function (t) {
      var T = D.types[t];
      if (T.macro) { macroArea += T.w * T.h; mac = T; } else std += T.w * T.h;
    });
    var nMac = D.cells.filter(function (t) { return D.types[t].macro; }).length;
    /* the flow's CORE_UTILIZATION counts the memories too */
    var coreArea = (std + macroArea) / knobs.util;
    var side = Math.sqrt(coreArea);
    var rows = Math.max(1, Math.round(side / rowH));
    var H = rows * rowH, W = Math.ceil(side / site) * site, F = flowOf(D), macros = [], i;
    if (nMac) {
    /* the memories must fit across the core with their halos */
    var need = nMac * mac.w + (nMac - 1) * MACRO_GAP + 2 * HALO;
    if (W < need) W = Math.ceil(need / site) * site;

    var mw = mac.w, mh = mac.h;
    function row(y, x0) { for (i = 0; i < nMac; i++) macros.push({ x: x0 + i * (mw + MACRO_GAP), y: y, w: mw, h: mh }); }
    var span = nMac * mw + (nMac - 1) * MACRO_GAP;
    var topY = H - HALO - mh;
    switch (knobs.macros) {
      case "topleft": row(topY, HALO); break;
      case "split":
        for (i = 0; i < nMac; i++) {
          var left = i < nMac / 2, k = left ? i : i - nMac / 2;
          macros.push({ x: left ? HALO + k * (mw + MACRO_GAP) : W - HALO - mw - k * (mw + MACRO_GAP), y: topY, w: mw, h: mh });
        }
        break;
      case "middle": row((H - mh) / 2, (W - span) / 2); break;
      case "bottom": row(HALO, (W - span) / 2); break;
      default: row(topY, W - HALO - span);
    }
    macros.forEach(function (m) { m.x = Math.round(m.x / site) * site; m.y = Math.round(m.y / rowH) * rowH; });
    }

    /* pins, evenly spread to start with: along the bottom edge when the
       design's pin constraints keep them there (riscv32i's io.tcl), else
       around all four edges, as the flow's pin placer does by default */
    var pins = D.ports.map(function (p, k) {
      return F.pins === "all" ? perimeterPoint(W, H, (k + 0.5) * 2 * (W + H) / D.ports.length)
                              : { x: (k + 0.5) * W / D.ports.length, y: 0, side: "b" };
    });
    var margin = F.margin !== undefined ? F.margin : MARGIN;

    return { W: W, H: H, rows: rows, rowH: rowH, site: site, macros: macros, pins: pins, pinMode: F.pins || "bottom",
             margin: margin, die: { W: W + 2 * margin, H: H + 2 * margin }, stdArea: std, macroArea: macroArea,
             util: (std + macroArea) / (W * H) };
  }

  /* ----- the netlist as the placer sees it ----- */
  function prepare(D, fp) {
    var n = D.cells.length, movable = new Int32Array(n).fill(-1), m = 0, macroIdx = [];
    for (var c = 0; c < n; c++) {
      if (D.types[D.cells[c]].macro) macroIdx.push(c); else movable[c] = m++;
    }
    /* each memory instance gets the next preset slot, in netlist order */
    var fixedPos = {};
    macroIdx.forEach(function (c, k) { fixedPos[c] = fp.macros[k]; fp.macros[k].cell = c; });
    return { n: n, m: m, movable: movable, fixedPos: fixedPos };
  }

  /* where a net's end is, if it does not move: a pin on the edge, or a
     pin on a memory */
  function fixedEnd(D, P, fp, cell, pin) {
    if (cell < 0) return fp.pins[pin];
    var mac = P.fixedPos[cell], off = D.types[D.cells[cell]].off[pin];
    return { x: mac.x + off[0], y: mac.y + off[1] };
  }

  /* ----- a sparse symmetric system, built fresh each solve ----- */
  function System(m) {
    this.m = m;
    this.diag = new Float64Array(m);
    this.bx = new Float64Array(m); this.by = new Float64Array(m);
    this.rows = [];
    for (var i = 0; i < m; i++) this.rows.push({});
  }
  System.prototype.link = function (a, b, w) {          /* two movable ends */
    this.diag[a] += w; this.diag[b] += w;
    this.rows[a][b] = (this.rows[a][b] || 0) - w;
    this.rows[b][a] = (this.rows[b][a] || 0) - w;
  };
  System.prototype.anchor = function (a, x, y, w) {     /* one movable end, one fixed */
    this.diag[a] += w; this.bx[a] += w * x; this.by[a] += w * y;
  };
  System.prototype.compile = function () {
    var ptr = new Int32Array(this.m + 1), cols = [], vals = [];
    for (var i = 0; i < this.m; i++) {
      var r = this.rows[i];
      for (var k in r) { cols.push(+k); vals.push(r[k]); }
      ptr[i + 1] = cols.length;
    }
    this.ptr = ptr; this.cols = Int32Array.from(cols); this.vals = Float64Array.from(vals);
  };
  /* conjugate gradient with a diagonal preconditioner */
  System.prototype.solve = function (b, x, iters, tol) {
    var m = this.m, d = this.diag, ptr = this.ptr, cols = this.cols, vals = this.vals;
    var r = new Float64Array(m), z = new Float64Array(m), p = new Float64Array(m), q = new Float64Array(m);
    function mul(v, out) {
      for (var i = 0; i < m; i++) {
        var s = d[i] * v[i];
        for (var k = ptr[i]; k < ptr[i + 1]; k++) s += vals[k] * v[cols[k]];
        out[i] = s;
      }
    }
    mul(x, q);
    var rz = 0, bn = 0, i;
    for (i = 0; i < m; i++) { r[i] = b[i] - q[i]; z[i] = r[i] / d[i]; p[i] = z[i]; rz += r[i] * z[i]; bn += b[i] * b[i]; }
    bn = Math.sqrt(bn) || 1;
    for (var it = 0; it < iters; it++) {
      mul(p, q);
      var pq = 0;
      for (i = 0; i < m; i++) pq += p[i] * q[i];
      var al = rz / pq, rn = 0, rz2 = 0;
      for (i = 0; i < m; i++) { x[i] += al * p[i]; r[i] -= al * q[i]; rn += r[i] * r[i]; }
      if (Math.sqrt(rn) / bn < tol) break;
      for (i = 0; i < m; i++) { z[i] = r[i] / d[i]; rz2 += r[i] * z[i]; }
      var be = rz2 / rz; rz = rz2;
      for (i = 0; i < m; i++) p[i] = z[i] + be * p[i];
    }
    return it;
  };

  /* the wirelength part of the system: clique for small nets, and for big
     ones a star through their centre, which keeps the matrix sparse */
  function wirelength(D, P, fp, sys, x, y, netW) {
    var starMax = 6;
    D.nets.forEach(function (net, ni) {
      if (ni === D.clockNet) return;
      var nw = netW ? netW[ni] : 1;                    /* a timing-critical net pulls harder */
      var ends = [], fixed = [];
      for (var k = 0; k < net.length; k += 2) {
        var c = net[k], pin = net[k + 1];
        if (c >= 0 && P.movable[c] >= 0) ends.push(P.movable[c]);
        else fixed.push(fixedEnd(D, P, fp, c, pin));
      }
      var p = ends.length + fixed.length;
      if (p < 2 || !ends.length) return;
      if (p <= starMax) {
        var w = 2 / p * nw;
        for (var i = 0; i < ends.length; i++) {
          for (var j = i + 1; j < ends.length; j++) sys.link(ends[i], ends[j], w);
          fixed.forEach(function (f) { sys.anchor(ends[i], f.x, f.y, w); });
        }
      } else {
        /* a star: each end pulled to the net's current centre */
        var cx = 0, cy = 0;
        ends.forEach(function (e) { cx += x[e]; cy += y[e]; });
        fixed.forEach(function (f) { cx += f.x; cy += f.y; });
        cx /= p; cy /= p;
        var ws = 1 / p * nw;
        ends.forEach(function (e) { sys.anchor(e, cx, cy, ws); });
      }
    });
  }

  /* The bound-to-bound net model (Spindler and colleagues, 2008), used by
     SimPL: along each axis, every pin of a net is tied to the net's two
     outermost pins, with weight 2 / ((p - 1) × distance), so the quadratic
     cost equals the net's half-perimeter at the current positions. It needs
     positions to measure, so it replaces the clique and star once the first
     solve has spread the cells out, and it is rebuilt every iteration. */
  var B2B_MIN = 0.1;                                   /* micrometers: no distance counts as less */
  function boundToBound(D, P, fp, sysX, sysY, x, y, netW) {
    D.nets.forEach(function (net, ni) {
      if (ni === D.clockNet) return;
      var ends = [];
      for (var k = 0; k < net.length; k += 2) {
        var c = net[k], pin = net[k + 1];
        if (c >= 0 && P.movable[c] >= 0) ends.push({ m: P.movable[c], x: x[P.movable[c]], y: y[P.movable[c]] });
        else { var f = fixedEnd(D, P, fp, c, pin); ends.push({ m: -1, x: f.x, y: f.y }); }
      }
      var p = ends.length;
      if (p < 2) return;
      var nw = netW ? netW[ni] : 1;
      [["x", sysX], ["y", sysY]].forEach(function (ax) {
        var key = ax[0], sys = ax[1], lo = 0, hi = 0;
        for (var i = 1; i < p; i++) {
          if (ends[i][key] < ends[lo][key]) lo = i;
          if (ends[i][key] > ends[hi][key]) hi = i;
        }
        if (lo === hi) hi = lo === 0 ? 1 : 0;
        function tie(a, b) {
          var A = ends[a], B = ends[b], w = nw * 2 / ((p - 1) * Math.max(B2B_MIN, Math.abs(A[key] - B[key])));
          if (A.m >= 0 && B.m >= 0) sys.link(A.m, B.m, w);
          else if (A.m >= 0) sys.anchor(A.m, B[key], B[key], w);
          else if (B.m >= 0) sys.anchor(B.m, A[key], A[key], w);
        }
        tie(lo, hi);
        for (i = 0; i < p; i++) {
          if (i === lo || i === hi) continue;
          tie(i, lo); tie(i, hi);
        }
      });
    });
  }

  /* ----- density: a grid of bins over the core ----- */
  function Grid(fp, bin) {
    this.nx = Math.max(4, Math.round(fp.W / bin)); this.ny = Math.max(4, Math.round(fp.H / bin));
    this.bw = fp.W / this.nx; this.bh = fp.H / this.ny;
    this.cap = new Float64Array(this.nx * this.ny).fill(this.bw * this.bh);
    var g = this;
    fp.macros.forEach(function (m) {                   /* memories and halos hold no cells */
      var x0 = m.x - HALO, x1 = m.x + m.w + HALO, y0 = m.y - HALO, y1 = m.y + m.h + HALO;
      for (var j = 0; j < g.ny; j++) for (var i = 0; i < g.nx; i++) {
        var ox = Math.max(0, Math.min(x1, (i + 1) * g.bw) - Math.max(x0, i * g.bw));
        var oy = Math.max(0, Math.min(y1, (j + 1) * g.bh) - Math.max(y0, j * g.bh));
        g.cap[j * g.nx + i] = Math.max(0, g.cap[j * g.nx + i] - ox * oy);
      }
    });
  }
  Grid.prototype.fill = function (x, y, area) {
    var u = new Float64Array(this.nx * this.ny);
    for (var e = 0; e < x.length; e++) {
      var i = Math.min(this.nx - 1, Math.max(0, Math.floor(x[e] / this.bw)));
      var j = Math.min(this.ny - 1, Math.max(0, Math.floor(y[e] / this.bh)));
      u[j * this.nx + i] += area[e];
    }
    return u;
  };

  /* Spreading by look-ahead legalization, the rough legalization SimPL
     anchors to. Only crowded places move: around each bin over the density
     target a region grows, one bin further each side, until it has room
     for the cells in it; regions that meet are merged. Each region is then
     cut in two across its longer side, the cells split in their current
     order so each half gets the share of cell area its room allows, and
     each half is cut again, down to single bins, where the cells are laid
     out in the order they came. Cells keep their neighbours, and nothing
     outside a crowded region moves at all. */
  function spread(g, x, y, area, target) {
    var nx = g.nx, ny = g.ny, u = g.fill(x, y, area), room = new Float64Array(nx * ny);
    for (var k = 0; k < room.length; k++) room[k] = g.cap[k] * target;
    function sum(arr, r) {
      var t = 0;
      for (var j = r.j0; j <= r.j1; j++) for (var i = r.i0; i <= r.i1; i++) t += arr[j * nx + i];
      return t;
    }
    function grow(r) {
      while (sum(u, r) > sum(room, r) && !(r.i0 === 0 && r.j0 === 0 && r.i1 === nx - 1 && r.j1 === ny - 1)) {
        r.i0 = Math.max(0, r.i0 - 1); r.j0 = Math.max(0, r.j0 - 1);
        r.i1 = Math.min(nx - 1, r.i1 + 1); r.j1 = Math.min(ny - 1, r.j1 + 1);
      }
      return r;
    }
    function meets(a, b) { return a.i0 <= b.i1 && b.i0 <= a.i1 && a.j0 <= b.j1 && b.j0 <= a.j1; }
    var regions = [];
    for (k = 0; k < u.length; k++) {
      if (u[k] <= room[k] + 1e-9) continue;
      var i = k % nx, j = (k - i) / nx;
      if (regions.some(function (r) { return i >= r.i0 && i <= r.i1 && j >= r.j0 && j <= r.j1; })) continue;
      var r = grow({ i0: i, i1: i, j0: j, j1: j });
      /* merge with any region it meets, and grow the union again */
      for (var again = true; again;) {
        again = false;
        for (var q = 0; q < regions.length; q++) {
          if (!meets(regions[q], r)) continue;
          var o = regions.splice(q, 1)[0];
          r = grow({ i0: Math.min(o.i0, r.i0), i1: Math.max(o.i1, r.i1), j0: Math.min(o.j0, r.j0), j1: Math.max(o.j1, r.j1) });
          again = true;
          break;
        }
      }
      regions.push(r);
    }
    if (!regions.length) return;
    /* the cells in each region */
    var owner = new Int32Array(nx * ny).fill(-1);
    regions.forEach(function (r, ri) {
      for (var j = r.j0; j <= r.j1; j++) for (var i = r.i0; i <= r.i1; i++) owner[j * nx + i] = ri;
    });
    var members = regions.map(function () { return []; });
    for (var e = 0; e < x.length; e++) {
      var bi = Math.min(nx - 1, Math.max(0, Math.floor(x[e] / g.bw)));
      var bj = Math.min(ny - 1, Math.max(0, Math.floor(y[e] / g.bh)));
      var ow = owner[bj * nx + bi];
      if (ow >= 0) members[ow].push(e);
    }
    function split(cells, r) {
      if (!cells.length) return;
      if (r.i0 === r.i1 && r.j0 === r.j1) { layout(cells, r); return; }
      var alongX = (r.i1 - r.i0) * g.bw >= (r.j1 - r.j0) * g.bh;
      var a = { i0: r.i0, i1: r.i1, j0: r.j0, j1: r.j1 }, b = { i0: r.i0, i1: r.i1, j0: r.j0, j1: r.j1 };
      if (alongX) { var mi = (r.i0 + r.i1) >> 1; a.i1 = mi; b.i0 = mi + 1; }
      else { var mj = (r.j0 + r.j1) >> 1; a.j1 = mj; b.j0 = mj + 1; }
      var ca = sum(room, a), cb = sum(room, b), coord = alongX ? x : y;
      cells.sort(function (p, q) { return coord[p] - coord[q]; });
      var tot = 0;
      cells.forEach(function (c) { tot += area[c]; });
      var share = ca + cb > 0 ? ca / (ca + cb) : 0.5, acc = 0, cut = 0;
      while (cut < cells.length && acc + area[cells[cut]] / 2 <= share * tot) { acc += area[cells[cut]]; cut++; }
      split(cells.slice(0, cut), a);
      split(cells.slice(cut), b);
    }
    /* inside one bin: the cells spread over it in their current order */
    function layout(cells, r) {
      var x0 = r.i0 * g.bw, y0 = r.j0 * g.bh, n = cells.length;
      var ox = cells.slice().sort(function (p, q) { return x[p] - x[q]; });
      var oy = cells.slice().sort(function (p, q) { return y[p] - y[q]; });
      ox.forEach(function (c, k2) { x[c] = x0 + (k2 + 0.5) / n * g.bw; });
      oy.forEach(function (c, k2) { y[c] = y0 + (k2 + 0.5) / n * g.bh; });
    }
    regions.forEach(function (r, ri) { split(members[ri], r); });
  }

  function overflowOf(g, x, y, area, target) {
    var u = g.fill(x, y, area), over = 0, tot = 0, peak = 0;
    for (var k = 0; k < u.length; k++) {
      tot += u[k];
      var cap = g.cap[k] * target;
      if (u[k] > cap) over += u[k] - cap;
      if (g.cap[k] > 0.25 * g.bw * g.bh) peak = Math.max(peak, u[k] / g.cap[k]);
    }
    return { overflow: over / tot, peak: peak, util: u };
  }

  function hpwl(D, P, fp, x, y) {
    var tot = 0;
    D.nets.forEach(function (net, ni) {
      if (ni === D.clockNet) return;
      var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (var k = 0; k < net.length; k += 2) {
        var c = net[k], pin = net[k + 1], px, py;
        if (c >= 0 && P.movable[c] >= 0) { px = x[P.movable[c]]; py = y[P.movable[c]]; }
        else { var f = fixedEnd(D, P, fp, c, pin); px = f.x; py = f.y; }
        if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py;
      }
      tot += (x1 - x0) + (y1 - y0);
    });
    return tot;
  }

  /* pins along the bottom, reordered by where their cells ended up, the
     way the flow's pin placer does it */
  /* a point a distance s round the core's edge, starting at the lower-left
     corner and going anticlockwise: along the bottom, up the right side,
     back along the top, down the left */
  function perimeterPoint(W, H, s) {
    if (s < W) return { x: s, y: 0, side: "b" };
    if (s < W + H) return { x: W, y: s - W, side: "r" };
    if (s < 2 * W + H) return { x: W - (s - W - H), y: H, side: "t" };
    return { x: 0, y: H - (s - 2 * W - H), side: "l" };
  }
  /* each pin moves to follow the cells it connects to: along the bottom in
     order of their x, or round the edge in order of their angle from the
     core's centre */
  function placePins(D, P, fp, x, y) {
    var want = D.ports.map(function (_, k) { return { k: k, sx: 0, sy: 0, n: 0 }; });
    D.nets.forEach(function (net, ni) {
      if (ni === D.clockNet) return;
      var port = -1, sx = 0, sy = 0, n = 0;
      for (var k = 0; k < net.length; k += 2) {
        if (net[k] < 0) port = net[k + 1];
        else if (P.movable[net[k]] >= 0) { sx += x[P.movable[net[k]]]; sy += y[P.movable[net[k]]]; n++; }
      }
      if (port >= 0 && n) { want[port].sx += sx; want[port].sy += sy; want[port].n += n; }
    });
    var W = fp.W, H = fp.H, start = Math.atan2(-H / 2, -W / 2);
    function key(w) {
      var cx = w.n ? w.sx / w.n : W / 2, cy = w.n ? w.sy / w.n : H / 2;
      if (fp.pinMode !== "all") return cx;
      var a = Math.atan2(cy - H / 2, cx - W / 2) - start;
      return a < 0 ? a + 2 * Math.PI : a;
    }
    want.forEach(function (w) { w.key = key(w); });
    want.sort(function (a, b) { return a.key - b.key; });
    want.forEach(function (w, i) {
      fp.pins[w.k] = fp.pinMode === "all" ? perimeterPoint(W, H, (i + 0.5) * 2 * (W + H) / want.length)
                                          : { x: (i + 0.5) * W / want.length, y: 0, side: "b" };
    });
  }

  /* Timing-driven placement, as OpenROAD's placer does it: at set points
     in the spreading (here when overflow first drops below each of
     TIMING_AT) the caller times the current placement and hands back a
     weight per net; the worst nets then pull their cells closer together. */
  var TIMING_AT = [0.65, 0.3];
  function place(D, fp, knobs, onFrame, onTiming) {
    var P = prepare(D, fp), m = P.m;
    var x = new Float64Array(m).fill(fp.W / 2), y = new Float64Array(m).fill(fp.H / 2);
    var area = new Float64Array(m), cellOf = new Int32Array(m);
    for (var c = 0; c < P.n; c++) if (P.movable[c] >= 0) {
      var T = D.types[D.cells[c]]; area[P.movable[c]] = T.w * T.h; cellOf[P.movable[c]] = c;
    }
    /* density bins: 3 micrometers, or smaller on a small core, so there are
       always at least twelve across it */
    var g = new Grid(fp, Math.min(3.0, fp.W / 12)), frames = [], history = [];
    /* a target below the uniform density (the cells' area over the free
       area) cannot be met; like the real placer ("Automatically adjusting to
       uniform density"), raise it to that */
    var cellArea = 0, free = fp.W * fp.H;
    for (var q = 0; q < m; q++) cellArea += area[q];
    fp.macros.forEach(function (mc) { free -= (mc.w + 2 * HALO) * (mc.h + 2 * HALO); });
    var uniform = cellArea / free, target = Math.max(knobs.density, uniform);
    var netW = null, timingAt = onTiming ? TIMING_AT.slice() : [], timingRuns = [];
    function build(ax, ay, aw) {
      var sys = new System(m);
      wirelength(D, P, fp, sys, x, y, netW);
      if (ax) for (var i = 0; i < m; i++) sys.anchor(i, ax[i], ay[i], aw);
      for (i = 0; i < m; i++) if (sys.diag[i] === 0) sys.anchor(i, fp.W / 2, fp.H / 2, 1e-3);
      sys.compile();
      return sys;
    }
    /* one system per axis, with the bound-to-bound model; each keeps its
       right-hand side in bx */
    function solveB2B(ax, ay, aw, iters, tol) {
      var sx = new System(m), sy = new System(m);
      boundToBound(D, P, fp, sx, sy, x, y, netW);
      for (var i = 0; i < m; i++) { sx.anchor(i, ax[i], ax[i], aw); sy.anchor(i, ay[i], ay[i], aw); }
      for (i = 0; i < m; i++) {
        if (sx.diag[i] === 0) sx.anchor(i, fp.W / 2, fp.W / 2, 1e-3);
        if (sy.diag[i] === 0) sy.anchor(i, fp.H / 2, fp.H / 2, 1e-3);
      }
      sx.compile(); sy.compile();
      sx.solve(sx.bx, x, iters, tol); sy.solve(sy.bx, y, iters, tol);
    }
    /* the pure wirelength solution first, twice so the pins can follow */
    var sys = build(null, null, 0);
    sys.solve(sys.bx, x, 200, 1e-6); sys.solve(sys.by, y, 200, 1e-6);
    placePins(D, P, fp, x, y);
    sys = build(null, null, 0);
    sys.solve(sys.bx, x, 200, 1e-6); sys.solve(sys.by, y, 200, 1e-6);
    function snap(label) {
      var st = overflowOf(g, x, y, area, target);
      var h = { it: frames.length, hpwl: hpwl(D, P, fp, x, y), overflow: st.overflow, peak: st.peak, label: label };
      history.push(h);
      frames.push({ x: Float32Array.from(x), y: Float32Array.from(y) });
      if (onFrame) onFrame(h);
      return st;
    }
    snap("wirelength only");
    var aw = 0.02;
    for (var it = 0; it < 40; it++) {
      var sx = Float64Array.from(x), sy = Float64Array.from(y);
      spread(g, sx, sy, area, target);
      for (var i = 0; i < m; i++) {
        sx[i] = Math.min(fp.W, Math.max(0, sx[i])); sy[i] = Math.min(fp.H, Math.max(0, sy[i]));
      }
      solveB2B(sx, sy, aw, 60, 1e-5);
      var st = snap("iteration " + (it + 1));
      if (timingAt.length && st.overflow < timingAt[0]) {
        timingAt.shift();
        var tw = onTiming(P, x, y);
        netW = tw.weights;
        timingRuns.push({ it: it + 1, overflow: st.overflow, wns: tw.wns, weighted: tw.weighted });
        history[history.length - 1].timing = timingRuns[timingRuns.length - 1];
      }
      if (st.overflow < 0.10 && it > 3) break;
      aw *= 1.35;
    }
    return { P: P, x: x, y: y, area: area, cellOf: cellOf, frames: frames, history: history, grid: g, timing: timingRuns,
             density: { asked: knobs.density, uniform: uniform, used: target } };
  }

  /* ----- legalization: onto rows and sites, nothing overlapping -----
     Each row keeps a sorted list of its free gaps, outside the memories
     and their halos. Cells go in order of x; each takes the free spot
     nearest to where global placement left it, searching rows outward
     from its own until moving further up or down could not beat the best
     found so far: a small version of the diamond search the flow's
     detailed placer runs. */
  function legalize(D, fp, pl) {
    var P = pl.P, m = P.m, rowH = fp.rowH, site = fp.site, rows = fp.rows;
    var gaps = [];
    for (var r = 0; r < rows; r++) {
      var y0 = r * rowH, y1 = y0 + rowH, cuts = [];
      fp.macros.forEach(function (mc) {
        if (y1 > mc.y - HALO && y0 < mc.y + mc.h + HALO) cuts.push([mc.x - HALO, mc.x + mc.w + HALO]);
      });
      cuts.sort(function (a, b) { return a[0] - b[0]; });
      var list = [], at = 0;
      cuts.forEach(function (cu) {
        var a0 = Math.ceil(at / site) * site;
        if (cu[0] - a0 > site / 2) list.push([a0, Math.floor(cu[0] / site) * site]);
        at = Math.max(at, cu[1]);
      });
      var a1 = Math.ceil(at / site) * site;
      if (fp.W - a1 > site / 2) list.push([a1, Math.floor(fp.W / site + 1e-6) * site]);
      gaps.push(list);
    }
    /* the best spot for a cell of width w in row r, nearest to gx */
    function bestIn(r, gx, w) {
      var best = null, list = gaps[r];
      for (var k = 0; k < list.length; k++) {
        var g0 = list[k][0], g1 = list[k][1];
        if (g1 - g0 < w - 1e-9) continue;
        var px = Math.min(Math.max(Math.round(gx / site) * site, g0), g1 - w);
        px = Math.round(px / site) * site;
        if (px < g0 - 1e-9 || px + w > g1 + 1e-9) continue;
        var d = Math.abs(px - gx);
        if (!best || d < best.d) best = { d: d, k: k, x: px };
      }
      return best;
    }
    function take(r, k, x, w) {
      var g = gaps[r][k], parts = [];
      if (x - g[0] > site / 2) parts.push([g[0], x]);
      if (g[1] - (x + w) > site / 2) parts.push([x + w, g[1]]);
      gaps[r].splice.apply(gaps[r], [k, 1].concat(parts));
    }
    var order = [];
    for (var i = 0; i < m; i++) order.push(i);
    order.sort(function (a, b) { return pl.x[a] - pl.x[b]; });
    var lx = new Float64Array(m), ly = new Float64Array(m), disp = 0, worst = 0, failed = 0;
    order.forEach(function (i) {
      var w = D.types[D.cells[pl.cellOf[i]]].w, gx = pl.x[i] - w / 2, gy = pl.y[i] - rowH / 2;
      var r0 = Math.min(rows - 1, Math.max(0, Math.round(gy / rowH))), best = null;
      for (var d = 0; d < rows; d++) {
        if (best && Math.abs(d * rowH) - rowH > best.cost) break;
        [r0 - d, r0 + d].forEach(function (r) {
          if (r < 0 || r >= rows || (d === 0 && r !== r0) || (d > 0 && r === r0)) return;
          var b = bestIn(r, gx, w);
          if (!b) return;
          var cost = b.d + Math.abs(r * rowH - gy);
          if (!best || cost < best.cost) best = { cost: cost, r: r, k: b.k, x: b.x };
        });
      }
      if (!best) { failed++; lx[i] = pl.x[i]; ly[i] = pl.y[i]; return; }
      take(best.r, best.k, best.x, w);
      lx[i] = best.x + w / 2; ly[i] = best.r * rowH + rowH / 2;
      disp += best.cost; worst = Math.max(worst, best.cost);
    });
    return { x: lx, y: ly, avgDisp: disp / m, maxDisp: worst, failed: failed };
  }

  function run(D, knobs, onProgress, onTiming) {
    var t0 = now(), fp = floorplan(D, knobs), t1 = now();
    if (onProgress) onProgress({ stage: "floorplan", ms: t1 - t0 });
    var pl = place(D, fp, knobs, function (h) { if (onProgress) onProgress({ stage: "place", step: h }); },
                   onTiming && function (P, x, y) { return onTiming(fp, { P: P }, { x: x, y: y }); });
    var t2 = now();
    var lg = legalize(D, fp, pl), t3 = now();
    var legalHpwl = hpwl(D, pl.P, fp, lg.x, lg.y);
    var st = overflowOf(pl.grid, lg.x, lg.y, pl.area, pl.density.used);
    return {
      fp: fp, pl: pl, lg: lg,
      metrics: {
        die: fp.die, core: { W: fp.W, H: fp.H }, rows: fp.rows, util: fp.util,
        globalHpwl: pl.history[pl.history.length - 1].hpwl, legalHpwl: legalHpwl,
        iterations: pl.history.length - 1, overflow: pl.history[pl.history.length - 1].overflow,
        peakDensity: st.peak, density: pl.density, avgDisp: lg.avgDisp, maxDisp: lg.maxDisp, failed: lg.failed,
        ms: { floorplan: t1 - t0, place: t2 - t1, legalize: t3 - t2 },
      },
    };
  }
  function now() { return (typeof performance !== "undefined" ? performance : Date).now(); }

  var api = { PRESETS: PRESETS, HALO: HALO, MARGIN: MARGIN, floorplan: floorplan, place: place, legalize: legalize,
              hpwl: hpwl, run: run };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PDEngine = api;
})(typeof self !== "undefined" ? self : this);
