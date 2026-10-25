/* Thumbnails for the Sandboxes hub.

   Each worked example's card carries a miniature of that stage's own
   picture, drawn from the same model the example itself uses, so the
   card shows the real thing rather than a stock icon: the real die and
   its four memories, the real density map, the real clock tree, the
   real congestion map, the real slack distribution. */

var StageThumbs = (function () {
  "use strict";

  var W = 200, H = 124;

  function has(name) { return typeof window !== "undefined" && window[name]; }

  /* the die, scaled into the thumbnail, with a frame */
  function dieFrame(z) {
    var s = Math.min((W - 14) / z.dieW, (H - 14) / z.dieH);
    var ox = (W - z.dieW * s) / 2, oy = (H - z.dieH * s) / 2;
    var mg = FloorplanSteps.SIZING.margin;
    return {
      s: s, ox: ox, oy: oy,
      X: function (x) { return ox + (mg + x) * s; },
      Y: function (y) { return oy + (mg + y) * s; },
      frame: '<rect class="th-die" x="' + ox.toFixed(1) + '" y="' + oy.toFixed(1) + '" width="' +
             (z.dieW * s).toFixed(1) + '" height="' + (z.dieH * s).toFixed(1) + '" rx="2"/>' +
             '<rect class="th-core" x="' + (ox + mg * s).toFixed(1) + '" y="' + (oy + mg * s).toFixed(1) +
             '" width="' + (z.coreW * s).toFixed(1) + '" height="' + (z.coreH * s).toFixed(1) + '"/>',
    };
  }

  function svg(inner, label) {
    return '<svg viewBox="0 0 ' + W + " " + H + '" class="th-svg" role="img" aria-label="' +
      label + '">' + inner + "</svg>";
  }

  /* The memories, drawn a little further in from the edges than they
     really sit: at this size the twenty micrometer channel around them
     is under a pixel, and the point of the picture is that they are
     placed blocks with room around them. The same nudge is used in
     every thumbnail, so all four dies agree with each other. */
  var NUDGE = 0.035;

  function macroRects(ms) {
    var z = FloorplanSteps.theModel().z;
    var inx = NUDGE * z.coreW, iny = NUDGE * z.coreH;
    return ms.map(function (m) {
      var cx = m.x + m.w / 2, cy = m.y + m.h / 2;
      return { x: m.x + (cx < z.coreW / 2 ? inx : -inx), y: m.y + (cy < z.coreH / 2 ? iny : -iny),
               w: m.w, h: m.h };
    });
  }

  /* does a box, in core micrometers, touch any drawn macro (with a little
     room around it, the way the halo keeps cells and wires back) */
  function onMacro(rects, x, y, w, h, keep) {
    for (var i = 0; i < rects.length; i++) {
      var m = rects[i];
      if (x < m.x + m.w + keep && x + w > m.x - keep && y < m.y + m.h + keep && y + h > m.y - keep) return true;
    }
    return false;
  }

  /* a repeatable sequence of random numbers, so a thumbnail looks the
     same on every load */
  function stream(seed) {
    return function () { var x = Math.sin(seed++ * 12.9898) * 43758.5453; return x - Math.floor(x); };
  }

  function macros(d, ms, cls, label) {
    return macroRects(ms).map(function (m) {
      var x = m.x, y = m.y;
      var g = '<rect class="' + (cls || "th-macro") + '" x="' + d.X(x).toFixed(1) + '" y="' +
        d.Y(y).toFixed(1) + '" width="' + (m.w * d.s).toFixed(1) + '" height="' +
        (m.h * d.s).toFixed(1) + '" rx="1"/>';
      if (label) {
        g += '<text class="th-mlab" x="' + d.X(x + m.w / 2).toFixed(1) + '" y="' +
          (d.Y(y + m.h / 2) + 2.2).toFixed(1) + '">MEM</text>';
      }
      return g;
    }).join("");
  }

  /* ----- one per stage ----- */

  var THUMBS = {
    /* Synthesis: the picture from step 5, the one that is actually the
       job. The logic is a graph of two-input ANDs, each node named for
       what it computes, and the mapper covers groups of those nodes
       with library cells. Both sets of names are the real ones: the
       node names are the function, the boxed names are the cells. */
    "synthesis-flow": function () {
      if (!has("SynthesisSteps")) return "";
      var sc = SynthesisSteps.model().aig;
      var ox = 22, oy = 14, dx = 38, dy = 18.4, nw = 26, nh = 10, ior = 4.2;
      var o = "", byId = {};
      sc.nodes.forEach(function (n) { byId[n.id] = n; });
      function X(n) { return ox + n.x * dx; }
      function Y(n) { return oy + n.y * dy; }

      sc.cells.forEach(function (c) {
        var xs = c.nodes.map(function (id) { return X(byId[id]); });
        var ys = c.nodes.map(function (id) { return Y(byId[id]); });
        var x0 = Math.min.apply(null, xs) - nw / 2 - 5, x1 = Math.max.apply(null, xs) + nw / 2 + 5;
        var y0 = Math.min.apply(null, ys) - nh / 2 - 4, y1 = Math.max.apply(null, ys) + nh / 2 + 4;
        o += '<rect class="th-cover" x="' + x0.toFixed(1) + '" y="' + y0.toFixed(1) + '" width="' +
          (x1 - x0).toFixed(1) + '" height="' + (y1 - y0).toFixed(1) + '" rx="2.5"/>';
        o += '<text class="th-covlab" x="' + ((x0 + x1) / 2).toFixed(1) + '" y="' +
          (c.below ? y1 + 5.4 : y0 - 2.6).toFixed(1) + '">' + c.name + "</text>";
      });
      sc.nodes.forEach(function (n) {
        var stop = (n.t === "out" ? ior : nw / 2) + 2.6;
        [["a", n.ia], ["b", n.ib]].forEach(function (side) {
          var src = byId[n[side[0]]];
          if (!src) return;
          o += '<line class="th-aedge" x1="' + X(src).toFixed(1) + '" y1="' + Y(src).toFixed(1) +
            '" x2="' + X(n).toFixed(1) + '" y2="' + Y(n).toFixed(1) + '"/>';
          if (!side[1]) return;
          var t = (X(n) - X(src) - stop) / (X(n) - X(src));
          o += '<circle class="th-bubble" cx="' + (X(src) + t * (X(n) - X(src))).toFixed(1) +
            '" cy="' + (Y(src) + t * (Y(n) - Y(src))).toFixed(1) + '" r="1.5"/>';
        });
      });
      sc.nodes.forEach(function (n) {
        if (n.t === "and") {
          o += '<rect class="th-anode" x="' + (X(n) - nw / 2).toFixed(1) + '" y="' +
            (Y(n) - nh / 2).toFixed(1) + '" width="' + nw + '" height="' + nh + '" rx="1.6"/>';
        } else {
          o += '<circle class="th-anode th-anode-io" cx="' + X(n).toFixed(1) + '" cy="' +
            Y(n).toFixed(1) + '" r="' + ior + '"/>';
        }
        o += '<text class="th-anodet" x="' + X(n).toFixed(1) + '" y="' + (Y(n) + 1.8).toFixed(1) +
          '">' + (n.fn || n.lab) + "</text>";
      });
      return svg(o, "a graph of two-input AND and NOR nodes, boxed into the three library cells " +
                    "the mapper covers it with");
    },

    "floorplan-flow": function () {
      if (!has("FloorplanSteps")) return "";
      var M = FloorplanSteps.theModel(), d = dieFrame(M.z);
      var o = d.frame + macros(d, M.ms, "th-macro", true);
      /* the pins, as ticks on each edge */
      var n = 7;
      for (var i = 1; i <= n; i++) {
        var t = (i / (n + 1)) * M.z.coreW;
        o += '<line class="th-pin" x1="' + d.X(t).toFixed(1) + '" y1="' + (d.Y(0) - 3).toFixed(1) +
             '" x2="' + d.X(t).toFixed(1) + '" y2="' + d.Y(0).toFixed(1) + '"/>';
        o += '<line class="th-pin" x1="' + (d.X(0) - 3).toFixed(1) + '" y1="' + d.Y(t).toFixed(1) +
             '" x2="' + d.X(0).toFixed(1) + '" y2="' + d.Y(t).toFixed(1) + '"/>';
      }
      return svg(o, "the die with four memory macros in its corners and pins on every edge");
    },

    /* Placement: the block as rows of cells. It has 363 rows of 1.4
       micrometer cells, which at this size is a quarter of a pixel each,
       so every drawn row stands for about sixteen real ones and every
       drawn cell for a run of real cells. What is real is where they sit:
       each row fills as densely as the placement example's own density
       map says that part of the core is, and each cell takes the colour
       of the module whose cluster it is closest to, as in that example's
       figure. So the gaps at the edges and the packed middle are the
       placer's result, not decoration. */
    "placement-flow": function () {
      if (!has("PlacementSteps")) return "";
      var M = FloorplanSteps.theModel(), z = M.z, d = dieFrame(z);
      var pm = PlacementSteps.model(), g = PlacementSteps.grid();
      var dens = PlacementSteps.densityOf(g, pm.gpr);
      var pts = PlacementSteps.anchors(g), keys = Object.keys(pts);
      var rects = macroRects(M.ms), rnd = stream(11);
      var ROWS = 30, pitch = z.coreH / ROWS, ch = pitch * 0.64, gap = 2.5;
      var o = d.frame;
      for (var r = 0; r < ROWS; r++) {
        var y = r * pitch + (pitch - ch) / 2, x = 0;
        while (x < z.coreW - 4) {
          var w = Math.min(8 + rnd() * 24, z.coreW - x);
          var cx = x + w / 2, cy = y + ch / 2;
          var b = Math.min(g.ny - 1, (cy / g.bh) | 0) * g.nx + Math.min(g.nx - 1, (cx / g.bw) | 0);
          /* a bin's density is the share of it that is cell, so that is the
             share of each slot that gets one (less the gaps between them) */
          var keep = rnd() < Math.min(1, dens[b] / 0.87);
          if (keep && !onMacro(rects, x, y, w, ch, 6)) {
            /* the nearer a module's cluster, the likelier the cell is one of
               its own, so neighbouring modules mix at their borders the way
               they do in the placement example rather than meeting at a line */
            var wts = keys.map(function (k) {
              var dd = (pts[k].x - cx) * (pts[k].x - cx) + (pts[k].y - cy) * (pts[k].y - cy);
              return 1 / ((dd + 400) * (dd + 400));
            });
            var tot = wts.reduce(function (a, v) { return a + v; }, 0), pick = rnd() * tot, near = keys[0];
            for (var q = 0; q < keys.length; q++) { pick -= wts[q]; if (pick <= 0) { near = keys[q]; break; } }
            o += '<rect class="th-pc th-pc-' + near + '" x="' + d.X(x).toFixed(1) + '" y="' +
                 d.Y(y).toFixed(1) + '" width="' + (w * d.s).toFixed(1) + '" height="' +
                 (ch * d.s).toFixed(1) + '"/>';
          }
          x += w + gap;
        }
      }
      return svg(o + macros(d, M.ms, "th-macro th-macro-flat"),
                 "the core as rows of placed cells, coloured by module, packed where the placer packed them");
    },

    "cts-flow": function () {
      if (!has("CtsSteps")) return "";
      var M = FloorplanSteps.theModel(), d = dieFrame(M.z);
      var cm = CtsSteps.model(), t = cm.tree, o = d.frame + macros(d, M.ms, "th-macro th-macro-flat");
      o += cm.sinks.filter(function (_, i) { return i % 3 === 0; }).map(function (s) {
        return '<circle class="th-sink" cx="' + d.X(s.x).toFixed(1) + '" cy="' + d.Y(s.y).toFixed(1) + '" r="0.7"/>';
      }).join("");
      o += '<line class="th-clk th-clk-trunk" x1="' + d.X(t.root.x).toFixed(1) + '" y1="' +
           d.Y(t.root.y).toFixed(1) + '" x2="' + d.X(t.levels[0][0].x).toFixed(1) + '" y2="' +
           d.Y(t.levels[0][0].y).toFixed(1) + '"/>';
      t.levels.forEach(function (lv, i) {
        if (!i) return;
        lv.forEach(function (nd) {
          o += '<polyline class="th-clk" points="' + d.X(nd.parent.x).toFixed(1) + "," +
               d.Y(nd.parent.y).toFixed(1) + " " + d.X(nd.x).toFixed(1) + "," + d.Y(nd.parent.y).toFixed(1) +
               " " + d.X(nd.x).toFixed(1) + "," + d.Y(nd.y).toFixed(1) + '"/>';
        });
      });
      cm.clusters.forEach(function (c) {
        o += '<polyline class="th-clk th-clk-leaf" points="' + d.X(c.parent.x).toFixed(1) + "," +
             d.Y(c.parent.y).toFixed(1) + " " + d.X(c.x).toFixed(1) + "," + d.Y(c.parent.y).toFixed(1) +
             " " + d.X(c.x).toFixed(1) + "," + d.Y(c.y).toFixed(1) + '"/>';
      });
      return svg(o, "the clock tree reaching every corner of the block");
    },

    /* Routing: the finished metal, from the routing example's last
       figure. Each stretch of wire is drawn in the bin it belongs to, and
       a bin gets wire as often as the router's final congestion map says
       it is full, so the busy middle is busy for the same reason it is
       busy there. Horizontal and vertical runs keep that figure's two
       colours. The clock tree, which that figure also draws, is left to
       the clock tree card, so the two cards do not show the same thing. */
    "routing-flow": function () {
      if (!has("RoutingSteps")) return "";
      var M = FloorplanSteps.theModel(), z = M.z, d = dieFrame(z);
      var rm = RoutingSteps.model(), die = rm.fc.die, fin = rm.iters[8];
      var bw = die.bw * z.coreW / die.w, bh = die.bh * z.coreH / die.h;
      var rects = macroRects(M.ms), rnd = stream(3), o = d.frame, TRACK = 8;
      for (var b = 0; b < fin.ratio.length; b++) {
        var bx = (b % die.nx) * bw, by = ((b / die.nx) | 0) * bh;
        var r = Math.min(1.2, fin.ratio[b]);
        var n = (rnd() < 0.3 + 0.7 * r ? 1 : 0) + (rnd() < 0.6 * r - 0.1 ? 1 : 0);
        for (var k = 0; k < n; k++) {
          var horiz = rnd() < 0.5;
          /* metal runs on tracks, so every run starts on one: drawn here at
             one track in every forty or so, which is what this size allows */
          var px = Math.round((bx + rnd() * bw) / TRACK) * TRACK;
          var py = Math.round((by + rnd() * bh) / TRACK) * TRACK;
          var len = (1.2 + 2.3 * rnd()) * (horiz ? bw : bh);
          var x2 = horiz ? Math.min(z.coreW, px + len) : px;
          var y2 = horiz ? py : Math.min(z.coreH, py + len);
          if (onMacro(rects, Math.min(px, x2), Math.min(py, y2), Math.abs(x2 - px), Math.abs(y2 - py), 4)) continue;
          o += '<line class="th-w' + (horiz ? "h" : "v") + '" x1="' + d.X(px).toFixed(1) + '" y1="' +
               d.Y(py).toFixed(1) + '" x2="' + d.X(x2).toFixed(1) + '" y2="' + d.Y(y2).toFixed(1) + '"/>';
        }
      }
      return svg(o + macros(d, M.ms, "th-macro th-macro-flat"),
                 "the routed signal metal across the core, densest where the router found it busiest");
    },

    /* Timing: the setup and hold checks, both at once, around the one
       capturing clock edge they share. This is the timing example's own
       pair of waveform figures folded onto a single time axis, with its
       numbers: the value being captured settles 110 picoseconds before
       the setup window opens, and the next value, launched by that same
       edge, arrives 96 picoseconds after the hold window closes. */
    "timing-flow": function () {
      if (!has("TimingSteps")) return "";
      var tm = TimingSteps.model(), opt = TimingSteps.OPT;
      var E = tm.period + tm.capture;                 /* the capturing edge */
      var setupReq = tm.required, holdReq = tm.period + tm.holdRequired;
      var t1 = tm.arrival, t2 = tm.period + tm.holdArrival;
      var lo = E - 340, hi = E + 250, x0 = 30, x1 = 192;
      function X(t) { return x0 + (t - lo) / (hi - lo) * (x1 - x0); }
      var cy = 37, ca = 7, dy = 77, da = 7, sk = 3;
      var o = "";

      /* the two windows either side of the edge */
      o += '<rect class="th-setupw" x="' + X(setupReq).toFixed(1) + '" y="' + (dy - da - 5) + '" width="' +
        (X(E) - X(setupReq)).toFixed(1) + '" height="' + (2 * da + 10) + '"/>';
      o += '<rect class="th-holdw" x="' + X(E).toFixed(1) + '" y="' + (dy - da - 5) + '" width="' +
        (X(holdReq) - X(E)).toFixed(1) + '" height="' + (2 * da + 10) + '"/>';
      o += '<line class="th-edge" x1="' + X(E).toFixed(1) + '" y1="' + (cy - ca - 6) + '" x2="' +
        X(E).toFixed(1) + '" y2="' + (dy + da + 6) + '"/>';

      /* the capturing clock: low, then the rising edge */
      o += '<polyline class="th-clkw" points="' + x0 + "," + (cy + ca) + " " + X(E).toFixed(1) + "," + (cy + ca) +
        " " + X(E).toFixed(1) + "," + (cy - ca) + " " + x1 + "," + (cy - ca) + '"/>';

      /* the data, drawn as a bus: steady stretches, crossing where it changes */
      function seg(a, b, cls, openL, openR) {
        var xa = openL ? x0 : X(a), xb = openR ? x1 : X(b);
        var ia = openL ? xa : xa + sk, ib = openR ? xb : xb - sk;
        return '<polygon class="' + cls + '" points="' + [
          [xa, openL ? dy - da : dy], [ia, dy - da], [ib, dy - da], [xb, openR ? dy - da : dy],
          [ib, dy + da], [ia, dy + da], [xa, openL ? dy + da : dy]].map(function (p) {
            return p[0].toFixed(1) + "," + p[1];
          }).join(" ") + '"/>';
      }
      o += seg(lo, t1, "th-bus", true, false);
      o += seg(t1, t2, "th-bus th-bus-cap", false, false);
      o += seg(t2, hi, "th-bus", false, true);

      /* names, and the two slacks */
      o += '<text class="th-wlab" x="4" y="' + (cy + 2) + '">CLK</text>';
      o += '<text class="th-wlab" x="4" y="' + (dy + 2) + '">D</text>';
      o += '<text class="th-wtag th-wtag-s" x="' + (X(E) - 3).toFixed(1) + '" y="' + (dy - da - 8) +
        '" text-anchor="end">setup</text>';
      o += '<text class="th-wtag th-wtag-h" x="' + (X(E) + 3).toFixed(1) + '" y="' + (dy - da - 8) +
        '">hold</text>';
      [[t1, setupReq, tm.slack], [holdReq, t2, tm.holdSlack]].forEach(function (g) {
        var a = X(g[0]), b = X(g[1]), y = dy + da + 14;
        o += '<line class="th-slk" x1="' + a.toFixed(1) + '" y1="' + y + '" x2="' + b.toFixed(1) + '" y2="' + y + '"/>';
        o += '<line class="th-slk" x1="' + a.toFixed(1) + '" y1="' + (y - 3) + '" x2="' + a.toFixed(1) + '" y2="' + (y + 3) + '"/>';
        o += '<line class="th-slk" x1="' + b.toFixed(1) + '" y1="' + (y - 3) + '" x2="' + b.toFixed(1) + '" y2="' + (y + 3) + '"/>';
        o += '<text class="th-slkt" x="' + ((a + b) / 2).toFixed(1) + '" y="' + (y + 10) + '">+' + g[2] + " ps</text>";
      });
      return svg(o, "the capturing clock edge with its setup window before it and its hold window after it, " +
                    "and the data changing clear of both: setup slack " + tm.slack + " picoseconds, hold slack " +
                    tm.holdSlack + " picoseconds. Setup time " + opt.setupTimePs + ", hold time " + opt.holdTimePs + ".");
    },

    /* riscv32i: the real finished layout of one run of the flow, rendered
       from its layout file at card size (see designs/riscv32i.js) */
    "riscv32i-design": function () {
      return '<img class="th-img" src="/static/explore/designs/riscv32i-card.png" alt="">';
    },
    /* gcd and aes: their real finished layouts, the same way */
    "gcd-design": function () {
      return '<img class="th-img" src="/static/explore/designs/gcd-card.png" alt="">';
    },
    "aes-design": function () {
      return '<img class="th-img" src="/static/explore/designs/aes-card.png" alt="">';
    },

    /* Finishing: the real polygons. Four copies of the NAND2_X1 layout the
       finishing example streams out, abutted the way cells sit in a row,
       sharing their wells and their power rails. Every shape is read from
       the cell library's own layout file. */
    "finish-flow": function () {
      if (!has("FinishSteps")) return "";
      var N = FinishSteps.NAND2, B = FinishSteps.CELL_BOX, n = 4;
      var span = (n - 1) * N.w + (B.x1 - B.x0), tall = B.y1 - B.y0;
      var S = Math.min((W - 24) / span, (H - 16) / tall);
      var ox = (W - span * S) / 2, oy = (H - tall * S) / 2;
      function Y(y) { return oy + (B.y1 - y) * S; }
      var o = '<g class="th-cellrow">';
      /* the wells and implants run the length of the row */
      ["nwell", "pwell", "pimplant", "nimplant"].forEach(function (name) {
        var r = N.layers[name][0], y0 = Math.min(r[0][1], r[2][1]), y1 = Math.max(r[0][1], r[2][1]);
        var x0 = r[0][0], x1 = (n - 1) * N.w + r[2][0];
        o += '<g class="fn-l fn-l-' + name + '"><rect x="' + (ox + (x0 - B.x0) * S).toFixed(1) + '" y="' +
          Y(y1).toFixed(1) + '" width="' + ((x1 - x0) * S).toFixed(1) + '" height="' + ((y1 - y0) * S).toFixed(1) + '"/></g>';
      });
      for (var i = 0; i < n; i++) {
        var dx = i * N.w;
        o += FinishSteps.cellMarkup(function (x) { return ox + (x + dx - B.x0) * S; }, Y,
                                    ["active", "poly", "contact", "metal1"], false);
      }
      o += "</g>";
      return svg(o, "four NAND2_X1 cells side by side, drawn from their real layout: wells, diffusion, " +
                    "poly gates, contacts and metal1");
    },
  };

  function render() {
    var slots = document.querySelectorAll("[data-thumb]");
    slots.forEach(function (el) {
      var fn = THUMBS[el.getAttribute("data-thumb")];
      if (!fn) return;
      try {
        var markup = fn();
        if (markup) { el.innerHTML = markup; el.classList.add("th-on"); }
      } catch (e) {
        /* a thumbnail is decoration: never let one break the page */
      }
    });
  }

  if (typeof window !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", render);
    else render();
  }

  return { render: render, THUMBS: THUMBS };
})();

if (typeof module !== "undefined" && module.exports) module.exports = StageThumbs;
