/* Reusable in-browser macro-placement lab.
   No tools, no licenses: the learner drags macros on the die and a
   transparent analytical model scores legality, routing congestion, and
   critical-path timing live. window.MacroPlace = { evaluate, mount }.

   The evaluation model is intentionally simple and faithful to what real
   tools optimize:
   - legality : macros stay in the core and keep a halo apart
   - congestion: a RUDY-style demand map (nets spread their wirelength over
     their bounding box; macros block routing under them) vs a per-tile
     capacity; overflow is demand above capacity
   - timing   : critical nets must stay under a wirelength budget */
(function () {
  "use strict";

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  }
  function inflate(m, d) { return { x: m.x - d, y: m.y - d, w: m.w + 2 * d, h: m.h + 2 * d }; }
  /* continuous routing-demand color: green (light) -> orange (near capacity)
     -> red (overflow), with opacity rising with demand so the map reads */
  function heatColor(r) {
    var rr = Math.max(0, r);
    var hue = 130 * (1 - Math.min(1, rr));                 /* 130 green -> 0 red */
    var light = rr > 1 ? Math.max(42, 52 - (rr - 1) * 16) : 52;
    var a = Math.min(0.46, 0.05 + 0.34 * Math.min(1.2, rr));
    return "hsla(" + hue.toFixed(0) + ",72%," + light.toFixed(0) + "%," + a.toFixed(2) + ")";
  }
  function interArea(ax0, ay0, ax1, ay1, bx0, by0, bx1, by1) {
    var ix = Math.max(0, Math.min(ax1, bx1) - Math.max(ax0, bx0));
    var iy = Math.max(0, Math.min(ay1, by1) - Math.max(ay0, by0));
    return ix * iy;
  }

  function evaluate(spec, macros) {
    var core = spec.core, halo = spec.halo || 0, G = spec.grid;
    var cap = spec.capacity, bg = spec.bgDemand, mcf = spec.macroCapFactor;
    var tol = spec.overflowTol != null ? spec.overflowTol : 0.02;
    if (!spec.pinsById) { spec.pinsById = {}; (spec.pins || []).forEach(function (p) { spec.pinsById[p.id] = p; }); }
    var byId = {}; macros.forEach(function (m) { byId[m.id] = m; });

    /* legality */
    var oob = [], haloV = [];
    macros.forEach(function (m) {
      if (m.x < -1e-6 || m.y < -1e-6 || m.x + m.w > core.w + 1e-6 || m.y + m.h > core.h + 1e-6) oob.push(m.id);
    });
    for (var i = 0; i < macros.length; i++) for (var j = i + 1; j < macros.length; j++) {
      if (rectsOverlap(inflate(macros[i], halo / 2), inflate(macros[j], halo / 2))) haloV.push([macros[i].id, macros[j].id]);
    }
    var blk = [];
    (spec.blockages || []).forEach(function (bl) {
      macros.forEach(function (m) { if (rectsOverlap({ x: m.x, y: m.y, w: m.w, h: m.h }, bl)) blk.push(m.id); });
    });
    /* pin-placement mode: movable boundary pins must sit on the die edge and
       keep a minimum pitch from other pins on the same edge (the macros are
       all fixed and pre-legal here). */
    var pinV = [];
    if (spec.mode === "pins") {
      var pitch = spec.pinPitch || 6;
      function edgeOf(p) {
        if (p.x <= 1e-6) return "L"; if (p.x >= core.w - 1e-6) return "R";
        if (p.y <= 1e-6) return "T"; if (p.y >= core.h - 1e-6) return "B";
        return "?";                                   /* off the boundary */
      }
      var all = spec.pins || [];
      var mv = all.filter(function (p) { return !p.fixed; });
      mv.forEach(function (A) {
        if (edgeOf(A) === "?") { pinV.push([A.id, A.id]); return; }  /* off the edge */
        var ea = edgeOf(A);
        for (var k = 0; k < all.length; k++) {
          var B = all[k];
          if (B.id === A.id || edgeOf(B) !== ea) continue;   /* only same-edge neighbours crowd */
          var d = (ea === "L" || ea === "R") ? Math.abs(A.y - B.y) : Math.abs(A.x - B.x);
          if (d >= pitch - 1e-6) continue;
          if (!B.fixed && B.id < A.id) continue;             /* dedupe movable-movable pairs */
          pinV.push([A.id, B.id]);                           /* fixed pins block movable ones */
        }
      });
    }
    var legal = oob.length === 0 && haloV.length === 0 && blk.length === 0 && pinV.length === 0;

    function termPos(t) {
      if (t.macro) { var m = byId[t.macro]; return [m.x + m.w / 2, m.y + m.h / 2]; }
      var p = spec.pinsById[t.pin]; return [p.x, p.y];
    }
    var nets = (spec.nets || []).map(function (n) {
      var xs = [], ys = [];
      n.terminals.forEach(function (t) { var p = termPos(t); xs.push(p[0]); ys.push(p[1]); });
      var minx = Math.min.apply(null, xs), maxx = Math.max.apply(null, xs);
      var miny = Math.min.apply(null, ys), maxy = Math.max.apply(null, ys);
      return { net: n, hpwl: (maxx - minx) + (maxy - miny), bbox: [minx, miny, maxx, maxy] };
    });
    var totalHPWL = nets.reduce(function (s, n) { return s + n.hpwl * (n.net.weight || 1); }, 0);

    /* timing: critical nets must stay under budget */
    var crit = nets.filter(function (n) { return n.net.critical; }).map(function (n) {
      return { id: n.net.id || "", len: n.hpwl, budget: n.net.budget, slack: n.net.budget - n.hpwl, ok: n.hpwl <= n.net.budget + 1e-6 };
    });
    var timingMet = crit.every(function (c) { return c.ok; });
    /* timing paths: a chain of hops sharing ONE budget, so the hops are
       interdependent - shortening one lets another be longer, and a middle
       macro sits on two paths at once. */
    var paths = (spec.paths || []).map(function (p) {
      var total = 0;
      for (var i = 0; i < p.chain.length - 1; i++) {
        var a = termPos(p.chain[i]), b = termPos(p.chain[i + 1]);
        total += Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
      }
      return { id: p.id, len: total, budget: p.budget, slack: p.budget - total, ok: total <= p.budget + 1e-6 };
    });
    timingMet = timingMet && paths.every(function (p) { return p.ok; });
    var allSlk = crit.map(function (c) { return c.slack; }).concat(paths.map(function (p) { return p.slack; }));
    var worstSlack = allSlk.length ? Math.min.apply(null, allSlk) : 0;

    /* congestion: RUDY demand map over the OPEN routing area vs capacity.
       Macros are blockages: routing goes around them, so net demand only
       lands in the open part of a tile, and mostly-macro tiles are not
       measured for overflow (you cannot route through a hard macro). */
    var tw = core.w / G, th = core.h / G, tileArea = tw * th;
    var cover = new Array(G * G), demand = new Array(G * G);
    for (var gy = 0; gy < G; gy++) for (var gx = 0; gx < G; gx++) {
      var tx0 = gx * tw, ty0 = gy * th, tx1 = tx0 + tw, ty1 = ty0 + th, cov = 0;
      macros.forEach(function (m) { cov += interArea(tx0, ty0, tx1, ty1, m.x, m.y, m.x + m.w, m.y + m.h); });
      (spec.blockages || []).forEach(function (bl) { cov += interArea(tx0, ty0, tx1, ty1, bl.x, bl.y, bl.x + bl.w, bl.y + bl.h); });
      var f = Math.min(1, cov / tileArea), t = gy * G + gx;
      cover[t] = f;
      demand[t] = bg * (1 - f);
    }
    /* each net's wire routes through the OPEN part of its bounding box.
       Macros other than the net's own terminals are blockages; their
       coverage shrinks the open area so the wire crowds into what is left,
       raising demand there. Placing macros where nets cross congests. */
    nets.forEach(function (n) {
      var termIds = {}; n.net.terminals.forEach(function (t) { if (t.macro) termIds[t.macro] = 1; });
      var b = n.bbox, bw = Math.max(b[2] - b[0], tw * 0.4), bh = Math.max(b[3] - b[1], th * 0.4);
      var bx1 = b[0] + bw, by1 = b[1] + bh;
      var contrib = new Array(G * G), totalOpen = 0;
      for (var gy2 = 0; gy2 < G; gy2++) for (var gx2 = 0; gx2 < G; gx2++) {
        var tx0b = gx2 * tw, ty0b = gy2 * th, tt = gy2 * G + gx2;
        var ov = interArea(tx0b, ty0b, tx0b + tw, ty0b + th, b[0], b[1], bx1, by1);
        if (ov <= 0) { contrib[tt] = 0; continue; }
        var bcov = 0;
        macros.forEach(function (m) { if (termIds[m.id]) return; bcov += interArea(tx0b, ty0b, tx0b + tw, ty0b + th, m.x, m.y, m.x + m.w, m.y + m.h); });
        (spec.blockages || []).forEach(function (bl) { bcov += interArea(tx0b, ty0b, tx0b + tw, ty0b + th, bl.x, bl.y, bl.x + bl.w, bl.y + bl.h); });
        var openOv = ov * (1 - Math.min(1, bcov / tileArea));
        contrib[tt] = openOv; totalOpen += openOv;
      }
      if (totalOpen < tileArea * 0.02) totalOpen = tileArea * 0.02;
      var totalWire = (n.net.weight || 1) * n.hpwl;
      for (var tt2 = 0; tt2 < G * G; tt2++) if (contrib[tt2] > 0) demand[tt2] += totalWire * (contrib[tt2] / totalOpen) / tileArea;
    });
    var maxOver = 0, totOver = 0, peakDemand = 0;
    for (var t2 = 0; t2 < G * G; t2++) {
      if (cover[t2] >= 0.5) continue;              /* blockage tile: not a routing region */
      peakDemand = Math.max(peakDemand, demand[t2]);
      var o = Math.max(0, demand[t2] - cap); maxOver = Math.max(maxOver, o); totOver += o;
    }
    var congestionOK = maxOver <= tol;

    return {
      legal: legal, oob: oob, haloV: haloV, blk: blk, pinV: pinV, totalHPWL: totalHPWL,
      crit: crit, paths: paths, timingMet: timingMet, worstSlack: worstSlack,
      demand: demand, cover: cover, cap: cap, G: G, tw: tw, th: th,
      maxOverflow: maxOver, totalOverflow: totOver, congestionOK: congestionOK,
      peakDemand: peakDemand,
      pass: legal && congestionOK && timingMet
    };
  }

  /* ---------------- interactive mount (browser only) ---------------- */
  function mount(container, spec) {
    var core = spec.core;
    var PAD = 20, MAXPX = 460;
    var sc = MAXPX / Math.max(core.w, core.h);
    var W = core.w * sc + PAD * 2, Hpx = core.h * sc + PAD * 2;
    function mx(x) { return PAD + x * sc; }
    function my(y) { return PAD + y * sc; }

    var state = spec.macros.map(function (m) { return { id: m.id, w: m.w, h: m.h, x: m.x, y: m.y, label: m.label || m.id, fixed: !!m.fixed }; });
    /* "pins" mode: the boundary I/O pins are the movable objects and every
       macro is fixed. Otherwise (default) the macros move. */
    var mode = spec.mode === "pins" ? "pins" : "macros";
    var dragNoun = mode === "pins" ? "pins" : "macros";
    var pins0 = (spec.pins || []).map(function (p) { return { id: p.id, x: p.x, y: p.y }; });
    var showCong = true;
    /* flow: analyze (drag + Run analysis) -> routed (Place & Route) -> scored (Submit) */
    var stage = "analyze", routes = null, routedCount = 0, routing = false, scoreObj = null;

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas");
    var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = Hpx * dpr;
    canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas";
    var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);

    var legend = document.createElement("div"); legend.className = "mp-legend";
    legend.innerHTML =
      '<span class="mp-legend-title">routing demand map</span>' +
      '<span class="mp-legend-bar"></span>' +
      '<span class="mp-legend-ends"><span>low</span><span>near capacity</span><span>overflow</span></span>';
    left.appendChild(legend);

    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bRun = document.createElement("button"); bRun.className = "btn mp-run"; bRun.textContent = "Run analysis";
    var bRoute = document.createElement("button"); bRoute.className = "btn mp-route"; bRoute.textContent = "Place & Route";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    var bCong = document.createElement("button"); bCong.className = "btn btn-ghost"; bCong.textContent = "Hide congestion";
    ctrls.appendChild(bRun); ctrls.appendChild(bRoute); ctrls.appendChild(bSubmit);
    ctrls.appendChild(bReset); ctrls.appendChild(bCong);
    left.appendChild(ctrls);
    wrap.appendChild(left);

    var panel = document.createElement("div"); panel.className = "mp-panel";
    wrap.appendChild(panel);
    container.appendChild(wrap);

    var WIRECOL = ["#0d9488", "#2563eb", "#7c3aed", "#d97706", "#db2777", "#0891b2", "#65a30d", "#b45309"];
    function drawPath(path, col) {
      if (!path || path.length < 2) return;
      ctx.strokeStyle = col; ctx.lineWidth = 1.7; ctx.lineJoin = "round";
      ctx.beginPath();
      path.forEach(function (c, i) { var X = mx(c[0]), Y = my(c[1]); if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y); });
      ctx.stroke();
      ctx.fillStyle = col;
      for (var i = 1; i < path.length - 1; i++) {
        var a = path[i - 1], b = path[i], c = path[i + 1];
        if (!((a[0] === b[0] && b[0] === c[0]) || (a[1] === b[1] && b[1] === c[1]))) {
          ctx.beginPath(); ctx.arc(mx(b[0]), my(b[1]), 1.7, 0, Math.PI * 2); ctx.fill();  /* via at a layer change */
        }
      }
    }

    /* a small maze router: each net is routed around the macros (blockages)
       and around other nets. Two layers, horizontal and vertical, so wires
       may cross (a via) but never overlap on the same layer. Computed once,
       then revealed net by net in the animation. */
    function computeRoutes() {
      var G = Math.round(Math.max(core.w, core.h)), byId = {}; state.forEach(function (m) { byId[m.id] = m; });
      function cl(v) { return Math.max(0, Math.min(G - 1, Math.round(v))); }
      var RHALO = 2;   /* routing keepout: other nets stay this far from a block */
      function buildBlocked(termSet) {
        var b = new Uint8Array(G * G);
        state.forEach(function (m) {
          var inf = termSet[m.id] ? 0 : RHALO;   /* a net can reach its own macros */
          var x0 = Math.floor(m.x - inf), x1 = Math.ceil(m.x + m.w + inf), y0 = Math.floor(m.y - inf), y1 = Math.ceil(m.y + m.h + inf);
          for (var y = Math.max(0, y0); y < Math.min(G, y1); y++) for (var x = Math.max(0, x0); x < Math.min(G, x1); x++) b[y * G + x] = 1;
        });
        (spec.blockages || []).forEach(function (bl) {
          for (var y = Math.max(0, Math.floor(bl.y)); y < Math.min(G, Math.ceil(bl.y + bl.h)); y++)
            for (var x = Math.max(0, Math.floor(bl.x)); x < Math.min(G, Math.ceil(bl.x + bl.w)); x++) b[y * G + x] = 1;
        });
        return b;
      }
      var occH = new Uint8Array(G * G), occV = new Uint8Array(G * G);
      function tc(t) { if (t.pin) { var p = spec.pinsById[t.pin]; return [p.x, p.y]; } var m = byId[t.macro]; return [m.x + m.w / 2, m.y + m.h / 2]; }
      function conn(t, cen) {
        if (t.pin) { var p = spec.pinsById[t.pin]; return [cl(p.x), cl(p.y)]; }
        var m = byId[t.macro], cx = m.x + m.w / 2, cy = m.y + m.h / 2, dx = cen[0] - cx, dy = cen[1] - cy;
        if (Math.abs(dx) / (m.w / 2 + 0.01) >= Math.abs(dy) / (m.h / 2 + 0.01)) return [cl(dx >= 0 ? m.x + m.w + 1 : m.x - 1), cl(cy)];
        return [cl(cx), cl(dy >= 0 ? m.y + m.h + 1 : m.y - 1)];
      }
      var DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 2], [0, -1, 2]];
      function bfs(start, targets, blocked) {
        if (targets[start[0] + "," + start[1]]) return [start.slice()];
        var head = 0, q = [[start[0], start[1], 0]], seen = new Uint8Array(G * G * 3), par = {};
        seen[(start[1] * G + start[0]) * 3] = 1;
        while (head < q.length) {
          var cur = q[head++], x = cur[0], y = cur[1], d = cur[2];
          for (var i = 0; i < 4; i++) {
            var nx = x + DIRS[i][0], ny = y + DIRS[i][1], lay = DIRS[i][2];
            if (nx < 0 || ny < 0 || nx >= G || ny >= G) continue;
            var ci = ny * G + nx, isT = targets[nx + "," + ny];
            if (blocked[ci] && !isT) continue;
            if ((lay === 1 ? occH[ci] : occV[ci]) && !isT) continue;
            var sk = ci * 3 + lay;
            if (seen[sk]) continue;
            seen[sk] = 1; par[sk] = [x, y, d];
            if (isT) {
              var path = [[nx, ny]], pk = [x, y, d];
              while (pk && pk[2] !== 0) { path.push([pk[0], pk[1]]); pk = par[(pk[1] * G + pk[0]) * 3 + pk[2]]; }
              if (pk) path.push([pk[0], pk[1]]);
              path.reverse(); return path;
            }
            q.push([nx, ny, lay]);
          }
        }
        return null;
      }
      function mark(path) { for (var i = 1; i < path.length; i++) { var a = path[i - 1], b = path[i], ci = b[1] * G + b[0]; if (a[1] === b[1]) occH[ci] = 1; else occV[ci] = 1; } }
      return (spec.nets || []).map(function (net) {
        var termSet = {}; net.terminals.forEach(function (t) { if (t.macro) termSet[t.macro] = 1; });
        var blocked = buildBlocked(termSet);
        var cen = [0, 0]; net.terminals.forEach(function (t) { var c = tc(t); cen[0] += c[0]; cen[1] += c[1]; });
        cen[0] /= net.terminals.length; cen[1] /= net.terminals.length;
        var conns = net.terminals.map(function (t) { return conn(t, cen); });
        var tree = {}; tree[conns[0][0] + "," + conns[0][1]] = 1;
        var paths = [];
        for (var k = 1; k < conns.length; k++) {
          var path = bfs(conns[k], tree, blocked);
          if (path) { mark(path); path.forEach(function (c) { tree[c[0] + "," + c[1]] = 1; }); paths.push(path); }
          else paths.push([conns[k], conns[0]]);
        }
        return { paths: paths };
      });
    }

    /* draw the layout. res is the last analysis result when fresh, or null
       when the placement has changed and has not been re-analyzed: then the
       heat map is hidden and macros/nets are drawn neutral (no verdict). */
    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx);
      ctx.fillStyle = "#fdfdfd"; ctx.fillRect(mx(0), my(0), core.w * sc, core.h * sc);
      if (res && showCong) {
        for (var gy = 0; gy < res.G; gy++) for (var gx = 0; gx < res.G; gx++) {
          var t = gy * res.G + gx;
          var ratio = res.cover[t] >= 0.5 ? 0 : res.demand[t] / (res.cap || 1e-6);
          ctx.fillStyle = heatColor(ratio);
          ctx.fillRect(mx(gx * res.tw), my(gy * res.th), res.tw * sc + 0.7, res.th * sc + 0.7);
        }
      }
      ctx.strokeStyle = "#1a1d26"; ctx.lineWidth = 1.6; ctx.strokeRect(mx(0), my(0), core.w * sc, core.h * sc);
      /* keepout blockages: no-go regions macros must avoid */
      (spec.blockages || []).forEach(function (bl) {
        var X = mx(bl.x), Y = my(bl.y), Wp = bl.w * sc, Hp = bl.h * sc;
        ctx.fillStyle = "rgba(180,70,70,0.10)"; ctx.fillRect(X, Y, Wp, Hp);
        ctx.save(); ctx.beginPath(); ctx.rect(X, Y, Wp, Hp); ctx.clip();
        ctx.strokeStyle = "rgba(190,60,60,0.35)"; ctx.lineWidth = 1; ctx.beginPath();
        for (var d = 0; d < Wp + Hp; d += 8) { ctx.moveTo(X + d, Y); ctx.lineTo(X + d - Hp, Y + Hp); }
        ctx.stroke(); ctx.restore();
        ctx.strokeStyle = "rgba(190,60,60,0.7)"; ctx.setLineDash([4, 3]); ctx.lineWidth = 1.5; ctx.strokeRect(X, Y, Wp, Hp); ctx.setLineDash([]);
        ctx.fillStyle = "#b0454a"; ctx.font = "10px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(bl.label || "keepout", X + Wp / 2, Y + Hp / 2); ctx.textBaseline = "alphabetic";
      });
      var byId = {}; state.forEach(function (m) { byId[m.id] = m; });
      function tp(term) { if (term.macro) { var m = byId[term.macro]; return [m.x + m.w / 2, m.y + m.h / 2]; } var p = spec.pinsById[term.pin]; return [p.x, p.y]; }
      var critOk = {}; if (res) res.crit.forEach(function (c) { critOk[c.id] = c.ok; });
      (spec.nets || []).forEach(function (n, idx) {
        var pts = n.terminals.map(tp);
        var cx = pts.reduce(function (s, p) { return s + p[0]; }, 0) / pts.length;
        var cy = pts.reduce(function (s, p) { return s + p[1]; }, 0) / pts.length;
        if (routes && idx < routedCount && routes[idx]) {
          var col = WIRECOL[idx % WIRECOL.length];
          routes[idx].paths.forEach(function (p) { drawPath(p, col); });
          return;
        }
        if (routes) {  /* routing under way: nets not yet routed stay faint */
          ctx.strokeStyle = "rgba(90,96,110,0.16)"; ctx.lineWidth = 1;
        } else if (n.critical) {
          ctx.strokeStyle = res ? (critOk[n.id] ? "rgba(21,128,61,0.85)" : "rgba(220,38,38,0.85)") : "rgba(71,85,105,0.7)";
          ctx.lineWidth = 2;
        } else { ctx.strokeStyle = "rgba(90,96,110,0.26)"; ctx.lineWidth = 1; }
        pts.forEach(function (p) { ctx.beginPath(); ctx.moveTo(mx(cx), my(cy)); ctx.lineTo(mx(p[0]), my(p[1])); ctx.stroke(); });
      });
      /* timing paths: dashed chains, green if under budget, red if over */
      if (res && res.paths && !routes) {
        (spec.paths || []).forEach(function (p, i) {
          var okp = res.paths[i] && res.paths[i].ok;
          ctx.strokeStyle = okp ? "rgba(21,128,61,0.45)" : "rgba(220,38,38,0.6)";
          ctx.lineWidth = 2.5; ctx.setLineDash([7, 4]);
          ctx.beginPath();
          p.chain.forEach(function (t, j) { var q = tp(t); if (j === 0) ctx.moveTo(mx(q[0]), my(q[1])); else ctx.lineTo(mx(q[0]), my(q[1])); });
          ctx.stroke(); ctx.setLineDash([]);
        });
      }
      var badPin = {};
      if (res && res.pinV) res.pinV.forEach(function (pr) { badPin[pr[0]] = 1; badPin[pr[1]] = 1; });
      (spec.pins || []).forEach(function (p) {
        var movable = mode === "pins" && !p.fixed;
        var isBad = movable && res && badPin[p.id];
        var s = movable ? 6 : 4;
        var col = isBad ? "#dc2626" : (movable ? "#2f6fed" : "#374151");
        ctx.fillStyle = col; ctx.fillRect(mx(p.x) - s, my(p.y) - s, s * 2, s * 2);
        if (movable) { ctx.strokeStyle = "#fdfdfd"; ctx.lineWidth = 1; ctx.strokeRect(mx(p.x) - s, my(p.y) - s, s * 2, s * 2); }
        ctx.fillStyle = col; ctx.font = (movable ? "bold " : "") + "10px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        var lx = mx(p.x), ly = my(p.y);
        if (p.x <= 0.5) { ctx.textAlign = "left"; lx += s + 3; } else if (p.x >= core.w - 0.5) { ctx.textAlign = "right"; lx -= s + 3; }
        else if (p.y <= 0.5) { ly -= s + 5; } else { ly += s + 5; }
        ctx.fillText(p.id, lx, ly); ctx.textBaseline = "alphabetic";
      });
      state.forEach(function (m) {
        var X = mx(m.x), Y = my(m.y), Wp = m.w * sc, Hp = m.h * sc;
        if (m.fixed) {                         /* locked hard IP: not draggable */
          ctx.fillStyle = "#e7e4db"; ctx.fillRect(X, Y, Wp, Hp);
          ctx.save(); ctx.beginPath(); ctx.rect(X, Y, Wp, Hp); ctx.clip();
          ctx.strokeStyle = "rgba(120,125,135,0.5)"; ctx.lineWidth = 1; ctx.beginPath();
          for (var d = 0; d < Wp + Hp; d += 7) { ctx.moveTo(X + d, Y); ctx.lineTo(X + d - Hp, Y + Hp); }
          ctx.stroke(); ctx.restore();
          ctx.strokeStyle = "#7b8089"; ctx.lineWidth = 2; ctx.strokeRect(X, Y, Wp, Hp);
          ctx.fillStyle = "#4b5059"; ctx.font = "bold 12px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(m.label, X + Wp / 2, Y + Hp / 2 - 5);
          ctx.font = "9px 'JetBrains Mono', monospace"; ctx.fillStyle = "#7b8089"; ctx.fillText("■ fixed", X + Wp / 2, Y + Hp / 2 + 9);
          ctx.textBaseline = "alphabetic";
          return;
        }
        var bad = res && (res.oob.indexOf(m.id) >= 0 || (res.blk && res.blk.indexOf(m.id) >= 0) || res.haloV.some(function (h) { return h[0] === m.id || h[1] === m.id; }));
        ctx.fillStyle = bad ? "rgba(220,38,38,0.18)" : "rgba(47,111,237,0.16)";
        ctx.fillRect(X, Y, Wp, Hp);
        ctx.strokeStyle = bad ? "#dc2626" : "#2f6fed"; ctx.lineWidth = 2;
        ctx.strokeRect(X, Y, Wp, Hp);
        ctx.fillStyle = bad ? "#dc2626" : "#1d4ed8"; ctx.font = "bold 13px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(m.label, X + Wp / 2, Y + Hp / 2); ctx.textBaseline = "alphabetic";
      });
    }

    function row(label, ok, detail) {
      return '<div class="mp-row ' + (ok ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (ok ? "✔" : "✗") +
        '</span><span class="mp-label">' + label + '</span><span class="mp-detail">' + detail + '</span></div>';
    }
    function scorecardHTML(res, showFooter) {
      var legalDetail = res.legal ? (mode === "pins" ? "all pins on-edge and spaced" : "all macros legal") :
        (res.oob.length ? res.oob.length + " out of bounds; " : "") +
        (res.blk && res.blk.length ? res.blk.length + " on a keepout; " : "") +
        (res.pinV && res.pinV.length ? res.pinV.length + " pins too close; " : "") +
        (res.haloV.length ? res.haloV.length + " too close" : "");
      var congDetail = res.congestionOK ? "no overflow" : "overflow " + res.maxOverflow.toFixed(2) + " (must be 0)";
      var timeDetail = (res.crit.length || res.paths.length) ? (res.timingMet ? "all nets and paths under budget" : "worst slack " + res.worstSlack.toFixed(0) + " (must be ≥ 0)") : "no timing constraints";
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "PASS" : "not yet") + '</div>';
      html += row("Legality", res.legal, legalDetail);
      html += row("No congestion overflow", res.congestionOK, congDetail);
      html += row("Timing closed", res.timingMet, timeDetail);
      html += '<div class="mp-score">total wirelength <b>' + res.totalHPWL.toFixed(0) + '</b><span class="mp-score-note">lower is better once you pass</span></div>';
      if (res.crit.length) {
        html += '<div class="mp-crit-head">critical nets</div>';
        res.crit.forEach(function (c) {
          html += '<div class="mp-crit ' + (c.ok ? "mp-ok" : "mp-bad") + '">' + (c.id || "net") + ': ' + c.len.toFixed(0) + ' / ' + c.budget + '</div>';
        });
      }
      if (res.paths && res.paths.length) {
        html += '<div class="mp-crit-head">timing paths (summed hops)</div>';
        res.paths.forEach(function (p) {
          html += '<div class="mp-crit ' + (p.ok ? "mp-ok" : "mp-bad") + '">' + p.id + ': ' + p.len.toFixed(0) + ' / ' + p.budget + '</div>';
        });
      }
      if (showFooter) html += flowFooter(res);
      return html;
    }
    function renderPanel(res) { panel.innerHTML = scorecardHTML(res, true); }

    function renderStale() {
      if (!lastRes) {
        panel.innerHTML = '<div class="mp-verdict mp-stale">not analyzed</div>' +
          '<p class="mp-stale-note">Drag the ' + dragNoun + ', then click <b>Run analysis</b>.</p>';
        return;
      }
      var shot = lastShot
        ? '<div class="mp-shot"><div class="mp-shot-cap">the placement it ran on:</div>' +
          '<img src="' + lastShot + '" alt="last analyzed floorplan"></div>'
        : '';
      panel.innerHTML =
        '<div class="mp-stale-banner">Placement changed. Below is your <b>last analysis</b>; ' +
        'click <b>Run analysis</b> to score the new placement.</div>' +
        '<div class="mp-scorecard-stale">' + scorecardHTML(lastRes, false) + shot + '</div>';
    }

    /* footer under the scorecard, driven by the flow stage */
    function flowFooter(res) {
      if (stage === "scored" && scoreObj) {
        return '<div class="mp-flow mp-flow-done">' +
          '<div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div>' +
          '<div class="mp-score-line">routed wirelength ' + scoreObj.routedWL + ' &middot; +' + scoreObj.wlScore + '</div>' +
          '<div class="mp-score-line">timing margin &middot; +' + scoreObj.tScore + '</div>' +
          '<div class="mp-score-line">congestion headroom &middot; +' + scoreObj.cScore + '</div>' +
          (scoreObj.best && scoreObj.best > scoreObj.total ? '<div class="mp-score-line">your best: ' + scoreObj.best + '</div>' : '') +
          '<div class="mp-flow-note">Solved. Drag to try for a higher score, then run the flow again.</div></div>';
      }
      if (stage === "routed") {
        return '<div class="mp-flow mp-flow-routed"><div class="mp-flow-title">Place &amp; Route complete</div>' +
          '<div class="mp-score-line">100% of nets routed &middot; 0 DRC violations</div>' +
          '<div class="mp-score-line">routed wirelength ' + Math.round(res.totalHPWL * 1.05) + '</div>' +
          '<div class="mp-score-line">post-route timing: met (worst slack ' + res.worstSlack.toFixed(0) + ')</div>' +
          '<div class="mp-flow-note">Your design works. Click <b>Submit</b> for a score.</div></div>';
      }
      if (res.pass) {
        return '<div class="mp-flow mp-flow-ready"><b>Analysis clean.</b> Run <b>Place &amp; Route</b> to route the design and confirm it works.</div>';
      }
      return '';
    }

    function computeScore(res) {
      var routedWL = Math.round(res.totalHPWL * 1.05);
      var PAR = spec.parWL || 830;
      var wlScore = Math.round(6000 * Math.min(1.2, PAR / routedWL));
      var tScore = Math.round(2000 * Math.max(0, Math.min(1, res.worstSlack / 20)));
      var headroom = (res.cap - res.peakDemand) / res.cap;
      var cScore = Math.round(2000 * Math.max(0, Math.min(1, headroom / 0.4)));
      var total = wlScore + tScore + cScore, best = total;
      try {
        var key = "mp-best-" + (spec.id || "lab");
        var prev = parseInt(window.localStorage.getItem(key) || "0", 10);
        best = Math.max(prev, total); window.localStorage.setItem(key, String(best));
      } catch (e) { /* private mode: score is still shown, just not remembered */ }
      return { routedWL: routedWL, wlScore: wlScore, tScore: tScore, cScore: cScore, total: total, best: best };
    }

    function updateButtons() {
      var ready = !dirty && lastRes && lastRes.pass && !routing;
      bRun.disabled = routing;
      bRoute.disabled = !(ready && stage === "analyze");
      bSubmit.disabled = !(stage === "routed");
      bRoute.classList.toggle("mp-ready", ready && stage === "analyze");
      bSubmit.classList.toggle("mp-ready", stage === "routed");
    }

    /* analysis runs on demand, like a real tool: dragging only moves macros
       (the layout redraws live); Run analysis re-evaluates and scores. */
    var lastRes = null, dirty = true, lastShot = null;
    function runAnalysis() {
      if (routing) return;
      lastRes = evaluate(spec, state); dirty = false;
      stage = "analyze"; routes = null; routedCount = 0; scoreObj = null;
      draw(lastRes);
      try { lastShot = canvas.toDataURL(); } catch (e) { lastShot = null; }
      renderPanel(lastRes);
      bRun.classList.remove("mp-run-dirty"); updateButtons();
    }
    function markDirty() {
      if (routing) return;
      dirty = true; stage = "analyze"; routes = null; routedCount = 0; scoreObj = null;
      draw(null); renderStale();
      bRun.classList.add("mp-run-dirty"); updateButtons();
    }
    function placeAndRoute() {
      if (dirty || !lastRes || !lastRes.pass || routing || stage !== "analyze") return;
      routing = true; routes = computeRoutes(); routedCount = 0; updateButtons();
      var nets = spec.nets || [];
      var timer = setInterval(function () {
        if (routedCount >= nets.length) {
          clearInterval(timer); routing = false; stage = "routed";
          updateButtons(); draw(lastRes); renderPanel(lastRes); return;
        }
        routedCount += 1; draw(lastRes);
      }, 70);
    }
    function submit() {
      if (stage !== "routed") return;
      scoreObj = computeScore(lastRes); stage = "scored";
      updateButtons(); draw(lastRes); renderPanel(lastRes);
    }

    /* dragging */
    var drag = null;
    function pt(e) {
      var r = canvas.getBoundingClientRect();
      var cx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
      var cy = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
      return [(cx - PAD) / sc, (cy - PAD) / sc];
    }
    function pick(p) {
      for (var i = state.length - 1; i >= 0; i--) { var m = state[i]; if (!m.fixed && p[0] >= m.x && p[0] <= m.x + m.w && p[1] >= m.y && p[1] <= m.y + m.h) return m; }
      return null;
    }
    function pickPin(p) {
      var best = null, bd = 14 / sc;    /* grab radius, ~14px in die units */
      (spec.pins || []).forEach(function (pin) {
        if (pin.fixed) return;
        var d = Math.abs(pin.x - p[0]) + Math.abs(pin.y - p[1]);
        if (d <= bd) { bd = d; best = pin; }
      });
      return best;
    }
    /* slide a pin to the nearest point on the die boundary */
    function snapPin(pin, p) {
      var x = Math.max(0, Math.min(core.w, p[0])), y = Math.max(0, Math.min(core.h, p[1]));
      var dL = x, dR = core.w - x, dT = y, dB = core.h - y, m = Math.min(dL, dR, dT, dB);
      if (m === dL) { pin.x = 0; pin.y = y; }
      else if (m === dR) { pin.x = core.w; pin.y = y; }
      else if (m === dT) { pin.x = x; pin.y = 0; }
      else { pin.x = x; pin.y = core.h; }
    }
    function down(e) {
      if (routing) return;
      var p = pt(e);
      if (mode === "pins") {
        var pin = pickPin(p);
        if (pin) { drag = { pin: pin }; e.preventDefault(); }
        return;
      }
      var m = pick(p);
      if (m) { drag = { m: m, dx: p[0] - m.x, dy: p[1] - m.y }; e.preventDefault(); }
    }
    function move(e) {
      if (!drag) return;
      var p = pt(e);
      if (drag.pin) { snapPin(drag.pin, p); markDirty(); e.preventDefault(); return; }
      var m = drag.m;
      m.x = Math.max(0, Math.min(core.w - m.w, p[0] - drag.dx));
      m.y = Math.max(0, Math.min(core.h - m.h, p[1] - drag.dy));
      markDirty(); e.preventDefault();
    }
    function up() { drag = null; }
    canvas.addEventListener("mousedown", down);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    canvas.addEventListener("touchstart", down, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    canvas.addEventListener("touchend", up);

    bRun.addEventListener("click", runAnalysis);
    bRoute.addEventListener("click", placeAndRoute);
    bSubmit.addEventListener("click", submit);
    bReset.addEventListener("click", function () {
      if (routing) return;
      if (mode === "pins") {
        var byId = {}; pins0.forEach(function (p0) { byId[p0.id] = p0; });
        (spec.pins || []).forEach(function (p) { var p0 = byId[p.id]; if (p0) { p.x = p0.x; p.y = p0.y; } });
      } else {
        state = spec.macros.map(function (m) { return { id: m.id, w: m.w, h: m.h, x: m.x, y: m.y, label: m.label || m.id, fixed: !!m.fixed }; });
      }
      runAnalysis();
    });
    bCong.addEventListener("click", function () {
      showCong = !showCong; bCong.textContent = showCong ? "Hide congestion" : "Show congestion";
      if (dirty) draw(null); else draw(lastRes);
    });

    runAnalysis();
  }

  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.MacroPlace = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
