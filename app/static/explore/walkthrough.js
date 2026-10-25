/* Step-through walkthrough figures for the routing algorithm pages.
   A generic frame player (Step / Auto / Reset + a narrated caption)
   drives per-algorithm figures. Each builder returns a list of frames;
   a frame is {paint: function(ctx), cap: string}. Pure canvas, no
   dependencies. Containers: <div class="walk-fig" data-walk="name">. */

(function () {
  "use strict";

  /* ---------- shared scenario (matches the Lee page) ---------- */

  var W = 15, H = 10, CS = 30;
  var SRC = { x: 2, y: 6 };
  var DST = { x: 12, y: 6 };

  function wallSet(list) {
    var s = {};
    list.forEach(function (c) { s[c[0] + "," + c[1]] = true; });
    return s;
  }

  var BASE_WALLS = (function () {
    var list = [];
    for (var y = 3; y < H; y++) list.push([7, y]);
    list.push([4, 2]);
    list.push([10, 3]);
    return list;
  })();
  var BASE_BLOCK = wallSet(BASE_WALLS);

  var INK = "#1a1d26", MUT = "#5f6470", GREEN = "#16a34a",
      GREEN_DEEP = "#15803d", BLUE = "#2f6fed", RED = "#dc2626",
      AMBER = "#d97706", BLOCKC = "#c3cad4", PURPLE = "#7c3aed",
      TEAL = "#0d9488";

  /* ---------- drawing helpers ---------- */

  function base(ctx, w, h, walls) {
    ctx.fillStyle = "#fdfdfd";
    ctx.fillRect(0, 0, w * CS, h * CS);
    ctx.strokeStyle = "rgba(15,23,42,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var x = 0; x <= w; x++) { ctx.moveTo(x * CS, 0); ctx.lineTo(x * CS, h * CS); }
    for (var y = 0; y <= h; y++) { ctx.moveTo(0, y * CS); ctx.lineTo(w * CS, y * CS); }
    ctx.stroke();
    (walls || []).forEach(function (c) {
      ctx.fillStyle = BLOCKC;
      ctx.fillRect(c[0] * CS + 1, c[1] * CS + 1, CS - 2, CS - 2);
    });
  }

  function pin(ctx, x, y, color, label) {
    ctx.beginPath();
    ctx.arc(x * CS + CS / 2, y * CS + CS / 2, CS * 0.34, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x * CS + CS / 2, y * CS + CS / 2 + 0.5);
  }

  function fillCell(ctx, x, y, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(x * CS + 1, y * CS + 1, CS - 2, CS - 2);
    ctx.restore();
  }

  function textCell(ctx, x, y, txt, color, bold) {
    ctx.fillStyle = color;
    ctx.font = (bold ? "bold " : "") + "10.5px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(txt), x * CS + CS / 2, y * CS + CS / 2 + 0.5);
  }

  function polyline(ctx, cells, color, width, dashed) {
    if (!cells.length) return;
    ctx.save();
    if (dashed) ctx.setLineDash([6, 5]);
    ctx.strokeStyle = color;
    ctx.lineWidth = width || CS * 0.26;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    cells.forEach(function (c, i) {
      var px = c.x * CS + CS / 2, py = c.y * CS + CS / 2;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.restore();
  }

  function seg(ctx, x1, y1, x2, y2, color, width, dashed) {
    polyline(ctx, [{ x: x1, y: y1 }, { x: x2, y: y2 }], color, width, dashed);
  }

  /* ---------- search utilities ---------- */

  function nbrs(x, y, w, h) {
    var out = [];
    if (x > 0) out.push({ x: x - 1, y: y });
    if (x < w - 1) out.push({ x: x + 1, y: y });
    if (y > 0) out.push({ x: x, y: y - 1 });
    if (y < h - 1) out.push({ x: x, y: y + 1 });
    return out;
  }

  function bfs(src, dst, blocked, w, h) {
    w = w || W; h = h || H;
    var dist = {}, parent = {};
    var q = [src], head = 0;
    dist[src.x + "," + src.y] = 0;
    while (head < q.length) {
      var c = q[head++];
      if (c.x === dst.x && c.y === dst.y) break;
      nbrs(c.x, c.y, w, h).forEach(function (n) {
        var k = n.x + "," + n.y;
        if (blocked[k] || dist[k] !== undefined) return;
        dist[k] = dist[c.x + "," + c.y] + 1;
        parent[k] = c;
        q.push(n);
      });
    }
    if (dist[dst.x + "," + dst.y] === undefined) return null;
    var path = [dst], cur = dst;
    while (!(cur.x === src.x && cur.y === src.y)) {
      cur = parent[cur.x + "," + cur.y];
      path.push(cur);
    }
    path.reverse();
    return path;
  }

  function manh(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }

  /* ---------- frame player ---------- */

  function player(container, built) {
    var frames = built.frames;
    var w = built.w || W, h = built.h || H;
    var dpr = window.devicePixelRatio || 1;
    var canvas = document.createElement("canvas");
    canvas.style.width = w * CS + "px";
    canvas.style.height = h * CS + "px";
    canvas.width = w * CS * dpr;
    canvas.height = h * CS * dpr;
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var wrap = document.createElement("div");
    wrap.className = "walk-canvas-wrap";
    wrap.appendChild(canvas);
    container.appendChild(wrap);

    /* single-frame figures are static visual guides: no player controls */
    var multi = frames.length > 1;
    var btns = {};
    if (multi) {
      var bar = document.createElement("div");
      bar.className = "walk-controls";
      [["step", "Step"], ["play", "Auto"], ["reset", "Reset"]].forEach(function (b) {
        var btn = document.createElement("button");
        btn.className = "btn btn-ghost walk-btn";
        btn.textContent = b[1];
        bar.appendChild(btn);
        btns[b[0]] = btn;
      });
      container.appendChild(bar);
    }

    var status = document.createElement("div");
    status.className = "walk-status";
    container.appendChild(status);

    var i = 0, timer = null;
    function render() {
      frames[i].paint(ctx);
      status.textContent = multi
        ? "(" + (i + 1) + "/" + frames.length + ") " + frames[i].cap
        : frames[i].cap;
    }
    function stop() {
      if (timer) { clearInterval(timer); timer = null; }
      if (btns.play) btns.play.textContent = "Auto";
    }
    if (multi) {
      btns.step.addEventListener("click", function () {
        stop();
        if (i < frames.length - 1) i += 1;
        render();
      });
      btns.play.addEventListener("click", function () {
        if (timer) { stop(); return; }
        btns.play.textContent = "Pause";
        timer = setInterval(function () {
          if (i >= frames.length - 1) { stop(); return; }
          i += 1;
          render();
        }, built.speed || 650);
      });
      btns.reset.addEventListener("click", function () { stop(); i = 0; render(); });
    }
    render();
  }

  /* =========================================================
     figure builders
     ========================================================= */

  var BUILD = {};

  /* ----- hadlock: expansion ordered by detour count ----- */

  BUILD.hadlock = function () {
    /* zero-one breadth-first search on detour count */
    var dist = {}, parent = {}, settledOrder = [];
    var dq = [{ c: SRC, d: 0 }];
    dist[SRC.x + "," + SRC.y] = 0;
    var done = {};
    while (dq.length) {
      var e = dq.shift();
      var k = e.c.x + "," + e.c.y;
      if (done[k]) continue;
      done[k] = true;
      settledOrder.push({ c: e.c, d: dist[k] });
      if (e.c.x === DST.x && e.c.y === DST.y) break;
      /* eslint-disable no-loop-func */
      nbrs(e.c.x, e.c.y, W, H).forEach(function (n) {
        var nk = n.x + "," + n.y;
        if (BASE_BLOCK[nk] || done[nk]) return;
        var toward = manh(n, DST) < manh(e.c, DST);
        var nd = dist[k] + (toward ? 0 : 1);
        if (dist[nk] === undefined || nd < dist[nk]) {
          dist[nk] = nd;
          parent[nk] = e.c;
          if (toward) dq.unshift({ c: n, d: nd });
          else dq.push({ c: n, d: nd });
        }
      });
    }
    var maxD = dist[DST.x + "," + DST.y];
    var path = [DST], cur = DST;
    while (!(cur.x === SRC.x && cur.y === SRC.y)) {
      cur = parent[cur.x + "," + cur.y];
      path.push(cur);
    }
    path.reverse();

    function paintLevel(level, withPath) {
      return function (ctx) {
        base(ctx, W, H, BASE_WALLS);
        settledOrder.forEach(function (s) {
          if (s.d > level) return;
          if (s.c.x === SRC.x && s.c.y === SRC.y) return;
          fillCell(ctx, s.c.x, s.c.y, GREEN, s.d === level ? 0.34 : 0.13);
          textCell(ctx, s.c.x, s.c.y, s.d, s.d === level ? GREEN_DEEP : MUT, s.d === level);
        });
        if (withPath) polyline(ctx, path, GREEN);
        pin(ctx, SRC.x, SRC.y, GREEN_DEEP, "S");
        pin(ctx, DST.x, DST.y, BLUE, "T");
      };
    }
    var frames = [];
    frames.push({
      paint: paintLevel(-1, false),
      cap: "Same scenario as the Lee page. Numbers will show DETOUR count, " +
           "not distance: how many moves a cell's best path has spent " +
           "walking away from the target.",
    });
    for (var d = 0; d <= maxD; d++) {
      var count = settledOrder.filter(function (s) { return s.d <= d; }).length;
      frames.push({
        paint: paintLevel(d, false),
        cap: d === 0
          ? "Detour level 0: every cell reachable while always moving " +
            "toward the target, a staircase-shaped corridor. Cells " +
            "settled: " + count + "."
          : "Detour level " + d + ": expansion adds cells whose best " +
            "path requires " + d + " away-move" + (d === 1 ? "" : "s") +
            ", present only where the wall requires them. Cells settled " +
            "so far: " + count + ".",
      });
    }
    frames.push({
      paint: paintLevel(maxD, true),
      cap: "Target reached at detour count " + maxD + ": path length = " +
           "Manhattan distance " + manh(SRC, DST) + " + 2 x " + maxD + " = " +
           (manh(SRC, DST) + 2 * maxD) + " (shortest). Cells settled: " + settledOrder.length + "; the " +
           "Lee expansion settles nearly the whole grid on the same " +
           "scenario. The backtrace procedure is identical to Lee's.",
    });
    return { frames: frames };
  };

  /* ----- soukup: sprint, stall, escape ----- */

  BUILD.soukup = function () {
    /* frames carry explicit render specs so escapes can step ring by
       ring, with each wave cell labeled by its distance to the target */
    var frames = [];
    var visited = {};
    var sprintCells = [];
    var oldEscapes = [];
    function K(c) { return c.x + "," + c.y; }
    visited[K(SRC)] = true;

    function paintSpec(spec) {
      return function (ctx) {
        base(ctx, W, H, BASE_WALLS);
        spec.oldEscapes.forEach(function (c) {
          fillCell(ctx, c.x, c.y, AMBER, 0.12);
        });
        spec.sprints.forEach(function (c, i) {
          fillCell(ctx, c.x, c.y, GREEN,
                   i === spec.sprints.length - 1 && spec.mode === "sprint"
                     ? 0.5 : 0.3);
        });
        spec.curEscape.forEach(function (c) {
          fillCell(ctx, c.x, c.y, AMBER, 0.3);
          textCell(ctx, c.x, c.y, c.dT, "#b45309", false);
        });
        if (spec.stuck) {
          fillCell(ctx, spec.stuck.x, spec.stuck.y, RED, 0.35);
          textCell(ctx, spec.stuck.x, spec.stuck.y, spec.thresh, "#ffffff", true);
        }
        if (spec.winner) {
          fillCell(ctx, spec.winner.x, spec.winner.y, GREEN, 0.55);
          textCell(ctx, spec.winner.x, spec.winner.y, spec.winner.dT,
                   "#ffffff", true);
        }
        pin(ctx, SRC.x, SRC.y, GREEN_DEEP, "S");
        pin(ctx, DST.x, DST.y, BLUE, "T");
      };
    }

    function snap(mode, curEscape, stuck, thresh, winner) {
      return {
        mode: mode,
        sprints: sprintCells.slice(),
        oldEscapes: oldEscapes.slice(),
        curEscape: curEscape.slice(),
        stuck: stuck, thresh: thresh, winner: winner || null,
      };
    }

    frames.push({
      paint: paintSpec(snap("intro", [])),
      cap: "Two alternating modes: greedy sprint (green) and Lee's " +
           "escape wave (amber). During an escape, every wave cell is " +
           "labeled with its Manhattan distance to the target; the wave " +
           "stops at the first cell whose label is smaller than the " +
           "stuck cell's (red).",
    });

    var cur = SRC;
    var guard = 300;
    while (!(cur.x === DST.x && cur.y === DST.y) && guard-- > 0) {
      /* sprint */
      var moved = true;
      while (moved && !(cur.x === DST.x && cur.y === DST.y)) {
        moved = false;
        var cand = [];
        if (Math.abs(DST.x - cur.x) >= Math.abs(DST.y - cur.y)) {
          if (DST.x !== cur.x) cand.push({ x: cur.x + (DST.x > cur.x ? 1 : -1), y: cur.y });
          if (DST.y !== cur.y) cand.push({ x: cur.x, y: cur.y + (DST.y > cur.y ? 1 : -1) });
        } else {
          if (DST.y !== cur.y) cand.push({ x: cur.x, y: cur.y + (DST.y > cur.y ? 1 : -1) });
          if (DST.x !== cur.x) cand.push({ x: cur.x + (DST.x > cur.x ? 1 : -1), y: cur.y });
        }
        for (var ci = 0; ci < cand.length; ci++) {
          var n = cand[ci];
          if (!visited[K(n)] && !BASE_BLOCK[K(n)]) {
            visited[K(n)] = true;
            sprintCells.push(n);
            cur = n;
            moved = true;
            frames.push({
              paint: paintSpec(snap("sprint", [])),
              cap: "Sprint: step to a free neighbor that reduces the " +
                   "distance to the target. One cell of work per cell of " +
                   "progress; no frontier structure.",
            });
            break;
          }
        }
      }
      if (cur.x === DST.x && cur.y === DST.y) break;

      /* escape: Lee's wave, ring by ring */
      var thresh = manh(cur, DST);
      var stuck = cur;
      var seen = {};
      Object.keys(visited).forEach(function (k) { seen[k] = true; });
      var frontier = Object.keys(visited).map(function (k) {
        var p = k.split(",");
        return { x: +p[0], y: +p[1] };
      });
      var curEscape = [];
      var winner = null;
      var ring = 1;
      while (!winner && frontier.length) {
        var next = [];
        var ringCells = [];
        for (var fi = 0; fi < frontier.length && !winner; fi++) {
          var fc = frontier[fi];
          var ns = nbrs(fc.x, fc.y, W, H);
          for (var ni = 0; ni < ns.length; ni++) {
            var nc = ns[ni];
            if (seen[K(nc)] || BASE_BLOCK[K(nc)]) continue;
            seen[K(nc)] = true;
            var cell = { x: nc.x, y: nc.y, dT: manh(nc, DST) };
            ringCells.push(cell);
            next.push(nc);
            if (cell.dT < thresh) { winner = cell; break; }
          }
        }
        if (!ringCells.length) break;
        curEscape = curEscape.concat(ringCells);
        if (winner) {
          frames.push({
            paint: paintSpec(snap("escape", curEscape, stuck, thresh, winner)),
            cap: "Ring " + ring + " reaches (" + winner.x + "," + winner.y +
                 ") with distance " + winner.dT + " to the target: the " +
                 "first wave cell with a label smaller than the stuck " +
                 "cell's " + thresh + ". That inequality is the entire " +
                 "selection criterion. The wave stops; the sprint resumes " +
                 "from this cell.",
          });
        } else {
          var minD = Math.min.apply(null, ringCells.map(function (c) { return c.dT; }));
          frames.push({
            paint: paintSpec(snap("escape", curEscape, stuck, thresh)),
            cap: "Escape ring " + ring + " (Lee's wave from the visited " +
                 "set): new cells labeled with their distance to the " +
                 "target. Minimum label in this ring: " + minD +
                 ", not smaller than the stuck cell's " + thresh +
                 ", so the wave expands another ring.",
          });
        }
        frontier = next;
        ring += 1;
      }
      if (!winner) break;
      curEscape.forEach(function (c) { visited[K(c)] = true; });
      oldEscapes = oldEscapes.concat(curEscape.map(function (c) {
        return { x: c.x, y: c.y };
      }));
      cur = { x: winner.x, y: winner.y };
    }

    frames.push({
      paint: paintSpec(snap("done", [])),
      cap: "Target reached. The path is not shortest: sprint moves were " +
           "committed without cost comparison. The maze lab presets " +
           "quantify the resulting wirelength overhead.",
    });
    return { frames: frames, speed: 500 };
  };

  /* ----- a-star: settle by lowest f = g + h, then trace ----- */

  BUILD.astar = function () {
    var g = {}, parent = {}, closed = {}, order = [];
    var open = [{ f: manh(SRC, DST), h: manh(SRC, DST), c: SRC }];
    g[SRC.x + "," + SRC.y] = 0;
    while (open.length) {
      open.sort(function (a, b) { return a.f - b.f || a.h - b.h; });
      var e = open.shift();
      var k = e.c.x + "," + e.c.y;
      if (closed[k]) continue;
      closed[k] = true;
      order.push({ c: e.c, g: g[k], h: e.h, f: e.f });
      if (e.c.x === DST.x && e.c.y === DST.y) break;
      nbrs(e.c.x, e.c.y, W, H).forEach(function (n) {
        var nk = n.x + "," + n.y;
        if (BASE_BLOCK[nk] || closed[nk]) return;
        var ng = g[k] + 1;
        if (g[nk] === undefined || ng < g[nk]) {
          g[nk] = ng;
          parent[nk] = e.c;
          var h = manh(n, DST);
          open.push({ f: ng + h, h: h, c: n });
        }
      });
    }
    var path = [DST], cur = DST;
    while (!(cur.x === SRC.x && cur.y === SRC.y)) {
      cur = parent[cur.x + "," + cur.y];
      path.push(cur);
    }
    path.reverse();

    function paintUpTo(idx, withPath) {
      return function (ctx) {
        base(ctx, W, H, BASE_WALLS);
        for (var i = 0; i <= idx && i < order.length; i++) {
          var s = order[i];
          if (s.c.x === SRC.x && s.c.y === SRC.y) continue;
          fillCell(ctx, s.c.x, s.c.y, BLUE, i === idx ? 0.4 : 0.14);
          textCell(ctx, s.c.x, s.c.y, s.f, i === idx ? "#1d4ed8" : MUT, i === idx);
        }
        if (withPath) polyline(ctx, path, BLUE);
        pin(ctx, SRC.x, SRC.y, GREEN_DEEP, "S");
        pin(ctx, DST.x, DST.y, BLUE, "T");
      };
    }
    var frames = [{
      paint: paintUpTo(-1),
      cap: "Each step settles the open cell with the lowest f = g + h " +
           "(cost so far plus Manhattan estimate to go). The number shown " +
           "in each settled cell is its f.",
    }];
    order.forEach(function (s, i) {
      if (i === 0) return;
      frames.push({
        paint: paintUpTo(i, false),
        cap: "Settled (" + s.c.x + "," + s.c.y + "): g = " + s.g +
             ", h = " + s.h + ", f = " + s.f + ". Cells pointing away from " +
             "the target carry larger f and wait in the queue, mostly " +
             "forever. Settled so far: " + (i + 1) + ".",
      });
    });
    frames.push({
      paint: paintUpTo(order.length - 1, true),
      cap: "Target settled with f = " + order[order.length - 1].f +
           " = the shortest path length; backtrace as always. " +
           order.length + " cells settled, and notice the whole left half " +
           "of the grid was never touched: that is the estimate doing its " +
           "job.",
    });
    return { frames: frames, speed: 260 };
  };

  /* ----- mikami-tabuchi: probe lines until families cross ----- */

  BUILD.mikami = function () {
    function hline(y, x1, x2, color, wdt, dashed) {
      return function (ctx) { seg(ctx, x1, y, x2, y, color, wdt || 4, dashed); };
    }
    function vline(x, y1, y2, color, wdt, dashed) {
      return function (ctx) { seg(ctx, x, y1, x, y2, color, wdt || 4, dashed); };
    }
    /* maximal free lines on the shared scenario, computed by hand:
       S(2,6): horizontal x0..6 (wall at 7), vertical y0..9.
       T(12,6): horizontal x8..14, vertical y0..9.
       Level 1 from S's vertical: horizontals through (2,y); rows 0 and 1
       span the full width (the wall stops at y=3, block (4,2) splits row
       2). Those rows cross T's level-0 vertical: intersection found. */
    var l0 = [hline(6, 0, 6, GREEN, 4), vline(2, 0, 9, GREEN, 4),
              hline(6, 8, 14, BLUE, 4), vline(12, 0, 9, BLUE, 4)];
    var l1rows = [0, 1];
    var frames = [];
    function paint(level, showX, showPath) {
      return function (ctx) {
        base(ctx, W, H, BASE_WALLS);
        l0.forEach(function (f) { f(ctx); });
        if (level >= 1) {
          for (var y = 0; y <= 9; y++) {
            if (y === 6) continue;
            var to = (y <= 1) ? 14 : (y === 2 ? 3 : 6);
            seg(ctx, 2, y, to, y, GREEN, 2, true);
          }
        }
        if (showX) {
          fillCell(ctx, 12, 1, RED, 0.45);
          textCell(ctx, 12, 1, "X", RED, true);
        }
        if (showPath) {
          polyline(ctx, [{ x: 2, y: 6 }, { x: 2, y: 1 }, { x: 12, y: 1 },
                         { x: 12, y: 6 }], INK, 6);
        }
        pin(ctx, SRC.x, SRC.y, GREEN_DEEP, "S");
        pin(ctx, DST.x, DST.y, BLUE, "T");
      };
    }
    frames.push({
      paint: paint(0, false, false),
      cap: "Level 0: the maximal free horizontal and vertical lines " +
           "through each pin (green = source family, blue = target " +
           "family). The wall blocks the source's horizontal line; the " +
           "families do not cross.",
    });
    frames.push({
      paint: paint(1, false, false),
      cap: "Level 1: from every point of the source's vertical line, a " +
           "perpendicular probe (dashed). Probing from every point " +
           "preserves completeness and multiplies the segment count.",
    });
    frames.push({
      paint: paint(1, true, false),
      cap: "The source's row-1 probe passes above the wall and " +
           "intersects the target's level-0 vertical at (12,1): the " +
           "first inter-family intersection. A route exists.",
    });
    frames.push({
      paint: paint(1, true, true),
      cap: "Parent pointers from the crossing reach both pins: 3 " +
           "segments and 2 bends (source level 1 + target level 0 + 1), " +
           "stored as a handful of segments rather than a label per " +
           "cell.",
    });
    return { frames: frames };
  };

  /* ----- hightower: escape points only ----- */

  BUILD.hightower = function () {
    /* same scenario and frame progression as the Mikami-Tabuchi
       walkthrough: level-0 lines, probes, crossing, joined path, with
       escape-point selection replacing probe-everywhere */
    function level0(ctx) {
      seg(ctx, 0, 6, 6, 6, GREEN, 4);
      seg(ctx, 2, 0, 2, 9, GREEN, 4);
      seg(ctx, 8, 6, 14, 6, BLUE, 4);
      seg(ctx, 12, 0, 12, 9, BLUE, 4);
    }
    function paint(stage) {
      return function (ctx) {
        base(ctx, W, H, BASE_WALLS);
        level0(ctx);
        if (stage >= 1) {
          fillCell(ctx, 6, 6, GREEN, 0.5);
          seg(ctx, 6, 0, 6, 9, GREEN, 3, true);
        }
        if (stage >= 2) {
          fillCell(ctx, 6, 2, GREEN, 0.5);
          seg(ctx, 5, 2, 14, 2, GREEN, 3, true);
        }
        if (stage >= 3) {
          fillCell(ctx, 12, 2, RED, 0.45);
          textCell(ctx, 12, 2, "X", RED, true);
        }
        if (stage >= 4) {
          polyline(ctx, [{ x: 2, y: 6 }, { x: 6, y: 6 }, { x: 6, y: 2 },
                         { x: 12, y: 2 }, { x: 12, y: 6 }], INK, 6);
        }
        pin(ctx, SRC.x, SRC.y, GREEN_DEEP, "S");
        pin(ctx, DST.x, DST.y, BLUE, "T");
      };
    }
    return { frames: [
      { paint: paint(0),
        cap: "Level 0: the maximal free horizontal and vertical lines " +
             "through each pin (green = source family, blue = target " +
             "family). The wall blocks the source's horizontal line; the " +
             "families do not cross." },
      { paint: paint(1),
        cap: "Escape-point selection: on the blocked line, one point is " +
             "chosen just before the obstacle (highlighted), and one " +
             "perpendicular probe is drawn there, positioned to clear " +
             "the obstacle's span. Mikami-Tabuchi would probe from every " +
             "point of the line; Hightower probes from this one." },
      { paint: paint(2),
        cap: "The rule applies again: on the new vertical, the escape " +
             "point above the wall's top produces one horizontal probe. " +
             "Two probes total, where level-wide probing would have " +
             "produced dozens of lines." },
      { paint: paint(3),
        cap: "The row-2 probe intersects the target's level-0 vertical " +
             "at (12,2): the first inter-family intersection. A route " +
             "exists." },
      { paint: paint(4),
        cap: "Parent pointers from the crossing reach both pins: 4 " +
             "segments and 3 bends (source level 2 + target level 0 + " +
             "1), from five stored segments in total. The economy is the " +
             "design goal; the cost is completeness, since a " +
             "configuration whose only escape passes through an " +
             "unchosen point is never probed." },
    ] };
  };

  /* ----- steiner / flute: why junctions win ----- */

  BUILD.steiner = function () {
    var A = { x: 7, y: 1 }, B = { x: 2, y: 5 }, C = { x: 12, y: 5 }, D = { x: 7, y: 9 };
    var S = { x: 7, y: 5 };
    var frames = [];
    function pins(ctx) {
      pin(ctx, A.x, A.y, PURPLE, "A");
      pin(ctx, B.x, B.y, PURPLE, "B");
      pin(ctx, C.x, C.y, PURPLE, "C");
      pin(ctx, D.x, D.y, PURPLE, "D");
    }
    function hanan(ctx) {
      [2, 7, 12].forEach(function (x) { seg(ctx, x, 0, x, 9, MUT, 1.5, true); });
      [1, 5, 9].forEach(function (y) { seg(ctx, 0, y, 14, y, MUT, 1.5, true); });
    }
    frames.push({
      paint: function (ctx) { base(ctx, W, H, []); pins(ctx); },
      cap: "One net, four pins. The question: the minimum total length of " +
           "rectilinear wire connecting all four.",
    });
    frames.push({
      paint: function (ctx) { base(ctx, W, H, []); hanan(ctx); pins(ctx); },
      cap: "Hanan's theorem: an optimal tree exists using only the grid " +
           "formed by the pins' own x and y coordinates (dashed). The " +
           "search space is finite before any algorithm starts.",
    });
    frames.push({
      paint: function (ctx) {
        base(ctx, W, H, []);
        hanan(ctx);
        polyline(ctx, [A, { x: 7, y: 9 }], AMBER, 5);
        polyline(ctx, [B, { x: 2, y: 1 }, { x: 7, y: 1 }], AMBER, 5);
        polyline(ctx, [C, { x: 12, y: 1 }, { x: 7, y: 1 }], AMBER, 5);
        pins(ctx);
      },
      cap: "Best spanning tree (pin-to-pin connections only): wirelength " +
           "26. No wire may branch except at a pin, and it shows.",
    });
    frames.push({
      paint: function (ctx) {
        base(ctx, W, H, []);
        hanan(ctx);
        seg(ctx, 7, 1, 7, 9, TEAL, 5);
        seg(ctx, 2, 5, 12, 5, TEAL, 5);
        fillCell(ctx, S.x, S.y, TEAL, 0.5);
        pins(ctx);
      },
      cap: "Add ONE junction that is not a pin (the Steiner point, " +
           "highlighted) and the tree collapses to wirelength 18: a 30 " +
           "percent saving from a single plus-shaped junction. FLUTE " +
           "(Fast LookUp Table Estimation) precomputes exactly these " +
           "optimal topologies per pin configuration, making the answer a " +
           "microsecond table lookup.",
    });
    return { frames: frames };
  };

  /* ----- rip-up and reroute: commit, regret, repair ----- */

  BUILD.ripup = function () {
    /* wall with two gaps; both nets prefer the near gap */
    var walls = [];
    for (var y = 0; y < H; y++) if (y !== 2 && y !== 6) walls.push([7, y]);
    var blocked = wallSet(walls);
    var A1 = { x: 2, y: 5 }, A2 = { x: 12, y: 5 };
    var B1 = { x: 2, y: 8 }, B2 = { x: 12, y: 8 };

    function withPath(extra) {
      var b = {};
      Object.keys(blocked).forEach(function (k) { b[k] = true; });
      (extra || []).forEach(function (p) {
        p.forEach(function (c) { b[c.x + "," + c.y] = true; });
      });
      return b;
    }
    var pathA1 = bfs(A1, A2, blocked, W, H);              /* A alone: near gap */
    var pathB1 = bfs(B1, B2, withPath([pathA1]), W, H);   /* B around A: far gap */
    var pathB2 = bfs(B1, B2, blocked, W, H);              /* B alone: near gap */
    var pathA2 = bfs(A1, A2, withPath([pathB2]), W, H);   /* A around B: far gap */
    var len = function (p) { return p.length - 1; };

    function paint(opts) {
      return function (ctx) {
        base(ctx, W, H, walls);
        if (opts.a) polyline(ctx, opts.a, GREEN, CS * 0.26, opts.aDash);
        if (opts.b) polyline(ctx, opts.b, PURPLE, CS * 0.26, opts.bDash);
        pin(ctx, A1.x, A1.y, GREEN_DEEP, "A");
        pin(ctx, A2.x, A2.y, GREEN_DEEP, "A");
        pin(ctx, B1.x, B1.y, PURPLE, "B");
        pin(ctx, B2.x, B2.y, PURPLE, "B");
      };
    }
    return { frames: [
      {
        paint: paint({}),
        cap: "Two nets, one wall, two gaps. Both nets' shortest routes " +
             "use the middle gap; the lower gap costs a detour. Nets are " +
             "routed sequentially: net A first.",
      },
      {
        paint: paint({ a: pathA1 }),
        cap: "Net A routes through the preferred gap: length " + len(pathA1) +
             ". Its cells are now obstacles for subsequent nets.",
      },
      {
        paint: paint({ a: pathA1, b: pathB1 }),
        cap: "Net B finds the gap occupied and detours through the far " +
             "gap: length " + len(pathB1) + ". Total wirelength " +
             (len(pathA1) + len(pathB1)) + ". The result is legal but " +
             "poor: the gap went to the net with the cheaper alternative.",
      },
      {
        paint: paint({ a: pathA1, aDash: true, b: pathB1 }),
        cap: "Rip-up: net A's route is removed (dashed) and its resources " +
             "return to the pool. Costs are updated to reflect the " +
             "observed contention.",
      },
      {
        paint: paint({ b: pathB2 }),
        cap: "Reroute: net B now takes the preferred gap: length " +
             len(pathB2) + ".",
      },
      {
        paint: paint({ a: pathA2, b: pathB2 }),
        cap: "Net A re-routes through the far gap: length " + len(pathA2) +
             ". Total " + (len(pathA2) + len(pathB2)) + " versus " +
             (len(pathA1) + len(pathB1)) + " before. Iteration discovered " +
             "the allocation the initial order missed; that order could " +
             "not have been identified in advance without solving the " +
             "joint problem.",
      },
    ] };
  };

  /* ----- pathfinder: prices doing the planning (computed model) ----- */

  BUILD.pathfinder = function () {
    /* wall with two gaps; capacity of the preferred gap is 1, the
       alternative holds all three nets. cost model, stated on the
       page: cost through a gap = detour + price(gap); the preferred
       gap's price starts at 0 and grows by 2 x overuse after each
       iteration; the alternative is never overused, so its price
       stays 0. every decision below is computed from this model. */
    var walls = [];
    for (var y = 0; y < H; y++) {
      if (y !== 2 && y !== 3 && y !== 6) walls.push([7, y]);
    }
    var blocked = wallSet(walls);
    var nets = [
      { s: { x: 2, y: 5 }, t: { x: 12, y: 5 }, color: GREEN, name: "N1" },
      { s: { x: 2, y: 7 }, t: { x: 12, y: 7 }, color: PURPLE, name: "N2" },
      { s: { x: 2, y: 3 }, t: { x: 12, y: 3 }, color: AMBER, name: "N3" },
    ];
    nets[0].bRow = 2;
    nets[1].bRow = 2;
    nets[2].bRow = 3; /* level with its pins; N3 never leaves gap B */
    nets.forEach(function (n) {
      n.dNear = 2 * Math.abs(n.s.y - 6);
      n.dFar = 2 * Math.abs(n.s.y - n.bRow);
    });
    nets.forEach(function (n) {
      /* other nets' pin cells are obstacles for this net */
      var nearBlocked = {};
      var farBlocked = {};
      Object.keys(blocked).forEach(function (k) {
        nearBlocked[k] = true;
        farBlocked[k] = true;
      });
      nets.forEach(function (m) {
        if (m === n) return;
        [m.s, m.t].forEach(function (p) {
          nearBlocked[p.x + "," + p.y] = true;
          farBlocked[p.x + "," + p.y] = true;
        });
      });
      nearBlocked["7,2"] = true;
      nearBlocked["7,3"] = true;
      farBlocked["7,6"] = true;
      farBlocked["7," + (n.bRow === 2 ? 3 : 2)] = true;
      n.nearPath = bfs(n.s, n.t, nearBlocked, W, H);
      n.farPath = bfs(n.s, n.t, farBlocked, W, H);
    });

    var QX = 15.5; /* resource panel origin: right of the 15-wide grid */

    function paintIter(commit, price, highlight, explain) {
      /* commit: array of true/false/null per net (null = not yet routed
         this iteration); highlight: index of the net routed this frame;
         explain: also label rows and dash the rejected alternative path */
      return function (ctx) {
        ctx.fillStyle = "#fdfdfd";
        ctx.fillRect(0, 0, 21 * CS, H * CS);
        base(ctx, W, H, walls);
        if (explain) rowLabels(ctx);
        nets.forEach(function (n, i) {
          if (commit[i] === null) return;
          polyline(ctx, commit[i] ? n.nearPath : n.farPath, n.color,
                   i === highlight ? CS * 0.3 : CS * 0.2);
        });
        if (explain && highlight >= 0 && commit[highlight] !== null) {
          var hn = nets[highlight];
          ctx.save();
          ctx.setLineDash([7, 6]);
          polyline(ctx, commit[highlight] ? hn.farPath : hn.nearPath,
                   hn.color, CS * 0.12);
          ctx.restore();
        }
        var nearUse = commit.filter(function (c) { return c === true; }).length;
        var farUse = commit.filter(function (c) { return c === false; }).length;
        fillCell(ctx, 7, 6, nearUse > 1 ? RED : GREEN, 0.25 + 0.15 * nearUse);
        textCell(ctx, 7, 6, "A", nearUse > 1 ? RED : GREEN_DEEP, true);
        fillCell(ctx, 7, 2, BLUE, 0.2 + 0.1 * farUse);
        fillCell(ctx, 7, 3, BLUE, 0.2 + 0.1 * farUse);
        textCell(ctx, 7, 2, "B", "#1d4ed8", true);
        textCell(ctx, 7, 3, "B", "#1d4ed8", true);
        nets.forEach(function (n) {
          pin(ctx, n.s.x, n.s.y, n.color, n.name[1]);
          pin(ctx, n.t.x, n.t.y, n.color, n.name[1]);
        });
        ctx.textAlign = "left";
        ctx.fillStyle = INK;
        ctx.font = "bold 11px 'JetBrains Mono', monospace";
        ctx.fillText("routing resources", QX * CS, 16);
        function resourceBox(row, label, p, use, cap2, over) {
          var y0 = 28 + row * 62;
          ctx.strokeStyle = over ? RED : "#d5d3ca";
          ctx.lineWidth = over ? 2 : 1;
          ctx.strokeRect(QX * CS, y0, 5.3 * CS, 52);
          ctx.fillStyle = INK;
          ctx.font = "bold 11px 'JetBrains Mono', monospace";
          ctx.fillText(label, QX * CS + 8, y0 + 15);
          ctx.font = "11px 'JetBrains Mono', monospace";
          ctx.fillStyle = over ? RED : MUT;
          ctx.fillText("price = " + p, QX * CS + 8, y0 + 30);
          ctx.fillText("usage = " + use + "/" + cap2 +
                       (over ? "  overuse " + (use - cap2) : ""),
                       QX * CS + 8, y0 + 45);
        }
        resourceBox(0, "gap A (preferred)", price, nearUse, 1, nearUse > 1);
        resourceBox(1, "gap B (alternative)", 0, farUse, 2, false);
        ctx.fillStyle = MUT;
        ctx.font = "10.5px 'JetBrains Mono', monospace";
        ctx.fillText("price(A) += 2 x overuse", QX * CS, 28 + 2 * 62 + 12);
        ctx.fillText("per iteration", QX * CS, 28 + 2 * 62 + 25);
      };
    }

    var frames = [];

    function rowLabels(ctx) {
      [2, 3, 5, 6, 7].forEach(function (y) {
        textCell(ctx, 0, y, String(y), MUT);
      });
    }
    var price = 0;
    var iter = 1;
    var prevChoices = null;
    while (iter <= 6) {
      var choices = nets.map(function (n) {
        return n.dNear + price < n.dFar;
      });
      var usage = choices.filter(Boolean).length;
      var overuse = Math.max(0, usage - 1);
      var same = prevChoices !== null && choices.every(function (c, i) {
        return c === prevChoices[i];
      });
      if (same && overuse === 0) {
        frames.push({
          paint: paintIter(choices, price, -1),
          cap: "Iteration " + iter + ": prices unchanged, so every " +
               "decision repeats. Gap A holds 1/1 and gap B holds 2/2, " +
               "no overuse anywhere, prices stop moving: converged. The resource went to the net with the " +
               "largest difference between its costs through A and B, " +
               "and the accumulated price persists, preventing re-entry " +
               "oscillation.",
        });
        break;
      }
      /* rip + post prices */
      frames.push({
        paint: paintIter([null, null, null], price, -1),
        cap: "Iteration " + iter + ": every net is ripped up, and " +
             "prices are posted: price(A) = " + price +
             ", price(B) = 0. Each net now re-routes independently at " +
             "these prices.",
      });
      /* one decision per frame */
      var commit = [null, null, null];
      for (var i = 0; i < nets.length; i++) {
        commit[i] = choices[i];
        var n = nets[i];
        var explain = iter === 1 && i === 0;
        var cap = n.name + " compares: " + n.dNear + " + " + price + " = " +
             (n.dNear + price) + " through A versus " + n.dFar +
             " + 0 = " + n.dFar + " through B, and chooses " +
             (choices[i] ? "A" : "B") + ". Gap A usage is now " +
             commit.filter(function (c) { return c === true; }).length +
             "/1.";
        if (explain) {
          cap += " Where the 2 and the 6 come from: the detour through " +
                 "a gap is 2 x |row(net) - row(gap)|, one step off the " +
                 "net's row and one step back per row of offset. N1's " +
                 "pins sit on row 5, so gap A on row 6 costs " +
                 "2 x |5 - 6| = 2 extra steps (solid path). Gap B is " +
                 "two tracks wide; the row 3 track is level with N3, " +
                 "which claims it every iteration, so the track on " +
                 "offer is row 2: 2 x |5 - 2| = 6 (dashed path).";
        }
        if (iter === 1 && i === 2) {
          cap += " N3 sits on row 3, level with gap B's lower " +
                 "track, so its detours flip: 2 x |3 - 6| = 6 through " +
                 "A and 2 x |3 - 3| = 0 through B: it crosses without " +
                 "leaving its row.";
        }
        frames.push({
          paint: paintIter(commit.slice(), price, i, explain),
          cap: cap,
        });
      }
      /* end-of-iteration price update */
      frames.push({
        paint: paintIter(choices, price, -1),
        cap: overuse > 0
          ? "End of iteration " + iter + ": gap A holds " + usage +
            " nets against capacity 1, overuse " + overuse +
            ". The price rises by 2 x " + overuse + ", to " +
            (price + 2 * overuse) + ", for the next iteration."
          : "End of iteration " + iter + ": gap A usage " + usage +
            "/1, no overuse, so the price is unchanged. If decisions " +
            "repeat at the same prices, the loop has converged.",
      });
      prevChoices = choices;
      price += 2 * overuse;
      iter += 1;
    }
    return { frames: frames, w: 21, speed: 1100 };

  };

  /* ----- global + detailed: coarse plan, exact finish ----- */

  BUILD.twopass = function () {
    /* 10 x 10 GCell grid drawn at 1 cell = 1 GCell; panel at right.
       A macro blocks the cut between columns 4 and 5 except two gaps:
       P at row 3 (capacity 1) and Q at row 7 (capacity 2). Net A is a
       3-pin net decomposed by FLUTE into segments; its trunk S3 and
       net B negotiate the gaps exactly as on the PathFinder page. */
    var G = 10, QX = 10.6, CAP = 4;
    var WX = 5;                       /* wall between gx 4 and 5 */
    var GAP_P = 3, GAP_Q = 7;         /* gap rows */
    var CAP_P = 1, CAP_Q = 2;
    var A = { pins: [{ x: 1, y: 1 }, { x: 1, y: 6 }, { x: 8, y: 4 }],
              jct: { x: 1, y: 4 }, color: GREEN, name: "A" };
    var B = { s: { x: 2, y: 2 }, t: { x: 8, y: 2 }, color: PURPLE, name: "B" };
    /* segments of A's FLUTE tree */
    var S1 = { s: A.pins[0], t: A.jct, name: "S1" };
    var S2 = { s: A.jct, t: A.pins[1], name: "S2" };
    var S3 = { s: A.jct, t: A.pins[2], name: "S3" };
    function lenVia(seg, g) {
      return Math.abs(seg.s.y - g) + Math.abs(seg.t.x - seg.s.x) + Math.abs(seg.t.y - g);
    }
    function pathVia(seg, g) {
      return [seg.s, { x: seg.s.x, y: g }, { x: seg.t.x, y: g }, seg.t];
    }
    var s3P = lenVia(S3, GAP_P), s3Q = lenVia(S3, GAP_Q);   /* 9, 13 */
    var bP = lenVia(B, GAP_P), bQ = lenVia(B, GAP_Q);       /* 8, 16 */
    /* PathFinder loop over the two bidders for gap P (cap 1) */
    var iters = [];
    var price = 0, prev = null;
    for (var it = 1; it <= 6; it++) {
      var s3UsesP = s3P + price < s3Q;
      var bUsesP = bP + price < bQ;
      var useP = (s3UsesP ? 1 : 0) + (bUsesP ? 1 : 0);
      var over = Math.max(0, useP - CAP_P);
      var same = prev !== null && prev[0] === s3UsesP && prev[1] === bUsesP;
      iters.push({ it: it, price: price, s3P: s3UsesP, bP: bUsesP,
                   useP: useP, over: over, done: same && over === 0 });
      if (same && over === 0) break;
      prev = [s3UsesP, bUsesP];
      price += 2 * over;
    }
    function gGrid(ctx) {
      ctx.fillStyle = "#fdfdfd";
      ctx.fillRect(0, 0, 16 * CS, G * CS);
      ctx.save();
      ctx.strokeStyle = "rgba(26,29,38,0.35)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (var x = 0; x <= G; x++) { ctx.moveTo(x * CS, 0); ctx.lineTo(x * CS, G * CS); }
      for (var y = 0; y <= G; y++) { ctx.moveTo(0, y * CS); ctx.lineTo(G * CS, y * CS); }
      ctx.stroke();
      ctx.restore();
    }
    function wall(ctx, overP) {
      ctx.save();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 5;
      ctx.beginPath();
      for (var y = 0; y < G; y++) {
        if (y === GAP_P || y === GAP_Q) continue;
        ctx.moveTo(WX * CS, y * CS + 2);
        ctx.lineTo(WX * CS, (y + 1) * CS - 2);
      }
      ctx.stroke();
      ctx.restore();
      ctx.font = "bold 10px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = overP ? RED : GREEN_DEEP;
      ctx.fillText("P", WX * CS, GAP_P * CS + CS / 2 - 8);
      ctx.fillText("cap " + CAP_P, WX * CS, GAP_P * CS + CS / 2 + 12);
      ctx.fillStyle = "#1d4ed8";
      ctx.fillText("Q", WX * CS, GAP_Q * CS + CS / 2 - 8);
      ctx.fillText("cap " + CAP_Q, WX * CS, GAP_Q * CS + CS / 2 + 12);
    }
    function gpin(ctx, p, color, label) {
      ctx.beginPath();
      ctx.arc(p.x * CS + CS / 2, p.y * CS + CS / 2, 8, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 10px 'JetBrains Mono', monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(label, p.x * CS + CS / 2, p.y * CS + CS / 2 + 0.5);
      ctx.textBaseline = "alphabetic";
    }
    function pins(ctx) {
      A.pins.forEach(function (p) { gpin(ctx, p, A.color, "A"); });
      gpin(ctx, B.s, B.color, "B"); gpin(ctx, B.t, B.color, "B");
    }
    function jdot(ctx, p, ghost) {
      ctx.beginPath();
      ctx.arc(p.x * CS + CS / 2, p.y * CS + CS / 2, 6, 0, Math.PI * 2);
      ctx.fillStyle = ghost ? "#fff" : INK;
      ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 2;
      if (ghost) ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    function route(ctx, pts, color, w, dash) {
      ctx.save();
      if (dash) ctx.setLineDash([7, 6]);
      ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath();
      pts.forEach(function (p, k) {
        var X = p.x * CS + CS / 2, Y = p.y * CS + CS / 2;
        if (k === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
      });
      ctx.stroke();
      ctx.restore();
    }
    function panel(ctx, lines) {
      ctx.textAlign = "left";
      lines.forEach(function (l, k) {
        ctx.fillStyle = k === 0 ? INK : (l.charAt(0) === "!" ? RED : (l.charAt(0) === "+" ? GREEN_DEEP : MUT));
        ctx.font = (k === 0 ? "bold " : "") + "11px 'JetBrains Mono', monospace";
        ctx.fillText(l.replace(/^[!+]/, ""), QX * CS, 16 + k * 16);
      });
    }
    function gapTable(ctx, price, useP, useQ) {
      panel(ctx, ["gap resources",
        "P: price " + price + "  use " + useP + "/" + CAP_P + (useP > CAP_P ? "  over" : ""),
        "Q: price 0  use " + useQ + "/" + CAP_Q,
        "", "price(P) += 2 x overuse", "per iteration"]);
    }
    function treeRoutes(ctx, s3Gap, hlS3) {
      route(ctx, [S1.s, S1.t], A.color, 5);
      route(ctx, [S2.s, S2.t], A.color, 5);
      route(ctx, pathVia(S3, s3Gap), A.color, hlS3 ? 7 : 5);
      jdot(ctx, A.jct);
    }
    function iterPaint(rec, drawB) {
      return function (ctx) {
        gGrid(ctx);
        wall(ctx, rec.over > 0);
        treeRoutes(ctx, rec.s3P ? GAP_P : GAP_Q);
        if (drawB !== false) route(ctx, pathVia(B, rec.bP ? GAP_P : GAP_Q), B.color, 5);
        pins(ctx);
        gapTable(ctx, rec.price, rec.useP, (rec.s3P ? 0 : 1) + (rec.bP ? 0 : 1));
      };
    }
    var frames = [
      {
        paint: function (ctx) { gGrid(ctx);
          panel(ctx, ["the coarse graph", "10 x 10 GCells", "capacity per EDGE =", "  tracks crossing it", "(" + CAP + " per edge in", "  this model)"]); },
        cap: "The die coarsened into a 10 x 10 GCell graph. Every edge " +
             "between two GCells carries a capacity: the number of " +
             "routing tracks crossing that boundary, " + CAP + " per " +
             "edge in this model, thousands in production. Global " +
             "routing routes on this graph and nothing finer.",
      },
      {
        paint: function (ctx) { gGrid(ctx); wall(ctx, false);
          panel(ctx, ["a macro's shadow", "the cut between columns", "  4 and 5 is blocked", "except two openings:",
                      "+P: row 3, cap " + CAP_P, "+Q: row 7, cap " + CAP_Q]); },
        cap: "Reality intrudes: a macro and its blocked tracks close the " +
             "cut between columns 4 and 5 except two openings. Gap P at " +
             "row 3 has one free track (capacity 1); gap Q at row 7 has " +
             "two (capacity 2). Every net crossing this cut must use P " +
             "or Q: a scarce resource, exactly like the gaps on the " +
             "PathFinder page.",
      },
      {
        paint: function (ctx) { gGrid(ctx); wall(ctx, false); pins(ctx);
          panel(ctx, ["the nets", "A: 3 pins (multi-pin)", "B: 2 pins", "both must cross the cut"]); },
        cap: "The nets: A has three pins, two on the left of the cut and " +
             "one on the right; B has two pins spanning it. A multi-pin " +
             "net cannot be routed as one path; it must become a tree " +
             "first.",
      },
      {
        paint: function (ctx) { gGrid(ctx); wall(ctx, false);
          route(ctx, [S1.s, S1.t], A.color, 4, true);
          route(ctx, [S2.s, S2.t], A.color, 4, true);
          route(ctx, [S3.s, S3.t], A.color, 4, true);
          jdot(ctx, A.jct); pins(ctx);
          panel(ctx, ["step 1: FLUTE decomposes", "A -> Steiner tree,", "junction at (1,4):",
                      "S1 (1,1)-(1,4) len 3", "S2 (1,4)-(1,6) len 2", "S3 (1,4)-(8,4) len 7",
                      "B is one segment", "", "chosen for A's own", "wirelength; knows nothing", "of other nets"]); },
        cap: "Step 1, decomposition: FLUTE (Fast Lookup Table " +
             "Estimation) turns net A into a Steiner tree with a " +
             "junction at (1,4), giving three two-pin segments (dashed " +
             "skeleton): S1 and S2 on the left, and the trunk S3 " +
             "crossing the cut. The tree is chosen for A's own " +
             "wirelength and knows nothing about B or the gaps: " +
             "decomposition answers what shape, not who gets which " +
             "resource.",
      },
      {
        paint: function (ctx) { gGrid(ctx); wall(ctx, false);
          route(ctx, pathVia(S3, GAP_P), A.color, 4, true);
          route(ctx, pathVia(S3, GAP_Q), A.color, 4, true);
          jdot(ctx, A.jct); pins(ctx);
          panel(ctx, ["step 2: segment != path", "S3 endpoints fixed;", "its route is not:",
                      "via P: " + s3P + " (detour 2)", "via Q: " + s3Q + " (detour 6)", "straight: blocked",
                      "", "the choice is what", "congestion will spend"]); },
        cap: "Step 2, a segment is not yet a path: S3 says only " +
             "'connect (1,4) to (8,4)'. Through the graph it has " +
             "candidates (dashed): via gap P at cost " + s3P + " (7 " +
             "across plus a 2-step detour to row 3 and back) or via " +
             "gap Q at cost " + s3Q + ". The straight route is " +
             "blocked. Which candidate it takes is the freedom the " +
             "negotiation will price. B likewise: " + bP + " via P, " +
             bQ + " via Q.",
      },
      {
        paint: iterPaint(iters[0]),
        cap: "Step 3, iteration 1 at price 0: every segment routes " +
             "cheapest. S1 and S2 take their straight verticals. S3: " +
             s3P + " + 0 via P versus " + s3Q + " via Q, takes P. B: " +
             bP + " + 0 versus " + bQ + ", takes P. Gap P now carries " +
             "2 against capacity 1 (red): the Steiner trees were each " +
             "individually optimal, and together they violate " +
             "capacity. This is why negotiation must exist.",
      },
      {
        paint: iterPaint(iters[1]),
        cap: "The PathFinder pricing responds: price(P) rises by 2 x " +
             "overuse to " + iters[1].price + ". Iteration 2 re-rips " +
             "and re-routes at the new price: S3: " + s3P + " + " +
             iters[1].price + " = " + (s3P + iters[1].price) +
             " versus " + s3Q + ", stays on P. B: " + bP + " + " +
             iters[1].price + " = " + (bP + iters[1].price) +
             " versus " + bQ + ", stays. The price has not yet " +
             "crossed either bidder's alternative, so the overflow " +
             "persists and the price keeps climbing.",
      },
      {
        paint: iterPaint(iters[2]),
        cap: "Iteration 3 at price " + iters[2].price + ": S3 hits its " +
             "break-even, " + s3P + " + " + iters[2].price + " = " +
             (s3P + iters[2].price) + " versus " + s3Q + ", and moves " +
             "to gap Q; B (" + bP + " + " + iters[2].price + " = " +
             (bP + iters[2].price) + " versus " + bQ + ") stays on P. " +
             "Usage: P 1/1, Q 1/2. No overflow. B kept the scarce gap " +
             "because its alternative was worst, the same allocation " +
             "rule the PathFinder and ILP (Integer Linear Programming) " +
             "pages derive.",
      },
      {
        paint: iterPaint(iters[iters.length - 1]),
        cap: "Iteration " + iters[iters.length - 1].it + ": prices " +
             "unchanged, every decision repeats: converged. Note what " +
             "negotiated: not whole nets but segments; S1 and S2 never " +
             "contended for anything and were routed once. In a real " +
             "run, millions of segments bid on millions of edges in " +
             "exactly this loop, with history prices preventing " +
             "oscillation.",
      },
      {
        paint: function (ctx) { gGrid(ctx); wall(ctx, false);
          treeRoutes(ctx, GAP_Q);
          route(ctx, pathVia(B, GAP_P), B.color, 5);
          /* ghost: edge-shifted junction at (1,3) */
          route(ctx, [{ x: 1, y: 1 }, { x: 1, y: 3 }], A.color, 3, true);
          route(ctx, [{ x: 1, y: 3 }, { x: 1, y: 6 }], A.color, 3, true);
          jdot(ctx, { x: 1, y: 3 }, true);
          pins(ctx);
          panel(ctx, ["step 4: the tree can move", "if S3 had stayed on P,", "shifting the junction",
                      "  (1,4) -> (1,3) (ghost)", "would cut its detour", "  to 0", "edge shifting: topology", "revisited under", "congestion"]); },
        cap: "Step 4, the decomposition is not sacred: had S3 stayed on " +
             "gap P, sliding A's junction from (1,4) to (1,3) (ghost) " +
             "would put the trunk level with the gap and erase its " +
             "detour entirely. FastRoute's edge shifting does exactly " +
             "this: when negotiation finds every path of a segment " +
             "expensive, it moves the tree itself. Topology per net, " +
             "paths negotiated across nets, topology revisited when the " +
             "shape is the problem.",
      },
      {
        paint: function (ctx) { gGrid(ctx); wall(ctx, false);
          /* corridors tinted along final paths */
          [pathVia(S3, GAP_Q), [S1.s, S1.t], [S2.s, S2.t], pathVia(B, GAP_P)].forEach(function (pts, k) {
            var col = k === 3 ? B.color : A.color;
            for (var m = 1; m < pts.length; m++) {
              var a = pts[m - 1], b = pts[m];
              var x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x);
              var y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
              ctx.save(); ctx.fillStyle = col; ctx.globalAlpha = 0.15;
              ctx.fillRect(x0 * CS, y0 * CS, (x1 - x0 + 1) * CS, (y1 - y0 + 1) * CS);
              ctx.restore();
            }
          });
          jdot(ctx, A.jct); pins(ctx);
          panel(ctx, ["the outputs", "1 route guides: a", "  corridor of GCells", "  per segment",
                      "2 the congestion map", "  (usage per edge)", "no track, via, or", "coordinate exists yet"]); },
        cap: "Global routing's outputs: a route guide per net, the " +
             "tinted corridors of GCells its segments won, and the " +
             "congestion map of usage against capacity on every edge. " +
             "Still no track, no via, no coordinate: a promise of " +
             "capacity, not a route.",
      },
      {
        paint: function (ctx) { gGrid(ctx); wall(ctx, false);
          pathVia(S3, GAP_Q).forEach(function () {});
          var pts = pathVia(S3, GAP_Q);
          for (var m = 1; m < pts.length; m++) {
            var a = pts[m - 1], b = pts[m];
            var x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x);
            var y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
            ctx.save(); ctx.fillStyle = A.color; ctx.globalAlpha = 0.15;
            ctx.fillRect(x0 * CS, y0 * CS, (x1 - x0 + 1) * CS, (y1 - y0 + 1) * CS);
            ctx.restore();
            /* fine tracks inside the corridor cells */
            ctx.save(); ctx.strokeStyle = "rgba(47,111,237,0.5)"; ctx.lineWidth = 1;
            ctx.beginPath();
            for (var yy = y0; yy <= y1; yy++) {
              for (var ttt = 0; ttt < 3; ttt++) {
                ctx.moveTo(x0 * CS + 3, yy * CS + (ttt + 1) * CS / 4);
                ctx.lineTo((x1 + 1) * CS - 3, yy * CS + (ttt + 1) * CS / 4);
              }
            }
            ctx.stroke(); ctx.restore();
          }
          route(ctx, pts, A.color, 3);
          jdot(ctx, A.jct); pins(ctx);
          panel(ctx, ["then: detailed routing", "inside each corridor:", "real tracks (thin blue),", "real vias, full rules",
                      "track assignment, then", "point-to-point search,", "then DRC-driven rip-up", "(their own pages)"]); },
        cap: "The handoff: detailed routing works inside each corridor, " +
             "one GCell window at a time: the real tracks appear (thin " +
             "blue), track assignment bulk-places the long runs, an A* " +
             "(A-star) search finishes the pins, and a DRC (Design Rule " +
             "Check) driven rip-up loop grinds violations to zero. " +
             "Coarse plan, exact finish, one handoff: each of those " +
             "stages has its own page in this section.",
      },
    ];
    return { frames: frames, w: 16, h: G, speed: 2200 };
  };


  BUILD.leftedge = function () {
    var CH = 7; /* channel drawn 15 x 7 cells; tracks on rows 2-4 */
    var netsIn = [ /* already sorted by left endpoint */
      { name: "1", l: 0, r: 4, top: true, bot: false },
      { name: "5", l: 1, r: 3, top: false, bot: true },
      { name: "2", l: 2, r: 7, top: true, bot: true },
      { name: "3", l: 5, r: 9, top: false, bot: true },
      { name: "4", l: 8, r: 12, top: true, bot: false },
      { name: "6", l: 10, r: 13, top: true, bot: true },
    ];
    var colors = [GREEN, PURPLE, BLUE, AMBER, TEAL, RED];
    /* greedy left-edge sweep, with a snapshot per placement so the
       captions can state the fit test's actual arithmetic */
    var trackEnd = [], lastNet = [], placed = [];
    netsIn.forEach(function (n, i) {
      var ends = trackEnd.slice(), names = lastNet.slice();
      var t = 0;
      while (t < trackEnd.length && trackEnd[t] >= n.l) t++;
      var opened = t === trackEnd.length;
      if (opened) { trackEnd.push(n.r); lastNet.push(n.name); }
      else { trackEnd[t] = n.r; lastNet[t] = n.name; }
      placed.push({ net: n, track: t, opened: opened, ends: ends,
                    names: names, color: colors[i] });
    });
    /* density: busiest column and its crossing count */
    var density = 0, denseCol = 0;
    for (var c = 0; c <= 14; c++) {
      var k = netsIn.filter(function (n) { return n.l <= c && c >= n.l && c <= n.r; }).length;
      if (k > density) { density = k; denseCol = c; }
    }
    var trackY = function (t) { return 2 + t; };
    function edges(ctx) {
      ctx.save();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0.12 * CS); ctx.lineTo(W * CS, 0.12 * CS);
      ctx.moveTo(0, 6.88 * CS); ctx.lineTo(W * CS, 6.88 * CS);
      ctx.stroke();
      ctx.restore();
    }
    function pinMarks(ctx) {
      netsIn.forEach(function (n, i) {
        textCell(ctx, n.l, n.top ? 0 : 6, n.name, colors[i], true);
        textCell(ctx, n.r, n.bot ? 6 : 0, n.name, colors[i], true);
      });
    }
    function paint(upto, band) {
      return function (ctx) {
        base(ctx, W, CH, []);
        edges(ctx);
        pinMarks(ctx);
        var tracksOpen = 0;
        for (var i = 0; i <= upto && i < placed.length; i++) {
          if (placed[i].track + 1 > tracksOpen) tracksOpen = placed[i].track + 1;
        }
        for (var t = 0; t < tracksOpen; t++) {
          textCell(ctx, 14, trackY(t), "t" + (t + 1), MUT);
        }
        for (var i = 0; i <= upto && i < placed.length; i++) {
          var p = placed[i];
          var y = trackY(p.track);
          seg(ctx, p.net.l, y, p.net.r, y, p.color, 5);
          if (p.net.top) seg(ctx, p.net.l, 0, p.net.l, y, p.color, 2, true);
          else seg(ctx, p.net.l, 6, p.net.l, y, p.color, 2, true);
          if (p.net.bot) seg(ctx, p.net.r, 6, p.net.r, y, p.color, 2, true);
          else seg(ctx, p.net.r, 0, p.net.r, y, p.color, 2, true);
        }
        if (band) {
          ctx.save();
          ctx.fillStyle = RED;
          ctx.globalAlpha = 0.15;
          ctx.fillRect(denseCol * CS, 0.3 * CS, CS, (CH - 0.6) * CS);
          ctx.restore();
          textCell(ctx, denseCol + 1, 1, "density " + density, RED, true);
        }
      };
    }
    function placeCap(p) {
      var span = "Net " + p.net.name + " spans [" + p.net.l + ", " +
                 p.net.r + "]. ";
      if (p.ends.length === 0) {
        return span + "No tracks exist yet, so track 1 opens and takes " +
               "its trunk (Step 3). Dashed stubs drop to the pins.";
      }
      var fails = [];
      for (var t = 0; t < p.track; t++) {
        fails.push("track " + (t + 1) + " is filled through column " +
                   p.ends[t] + " (net " + p.names[t] + ")");
      }
      function cap1(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
      if (p.opened) {
        return span + cap1(fails.join(" and ")) +
               ": every track reaches column " + p.net.l +
               " or beyond, nothing fits, so track " + (p.track + 1) +
               " opens (Step 3).";
      }
      var ok = "track " + (p.track + 1) + " last ends at column " +
               p.ends[p.track] + " (net " + p.names[p.track] +
               "), left of column " + p.net.l;
      if (fails.length) {
        return span + cap1(fails.join(" and ")) + "; but " + ok +
               ": the trunk goes there (Step 2).";
      }
      return span + cap1(ok) + ": the trunk goes there (Step 2).";
    }
    var frames = [{
      paint: paint(-1),
      cap: "A channel: pins fixed on the top and bottom edges (colored " +
           "numbers) and an empty interior of routing tracks. Each net " +
           "gets one horizontal trunk on a track plus vertical stubs to " +
           "its pins. The goal is the fewest tracks: track count is " +
           "channel height, and channel height is chip area.",
    }, {
      paint: function (ctx) {
        base(ctx, W, CH, []);
        netsIn.forEach(function (n, i) {
          seg(ctx, n.l, i, n.r, i, colors[i], 6);
          textCell(ctx, n.r + 1, i, n.name, colors[i], true);
        });
      },
      cap: "Step 1 (sort): strip the stubs and each net is only its " +
           "span [l, r]. The six spans are listed in order of left " +
           "endpoint, top to bottom. Producing this ordering is the " +
           "algorithm's entire preprocessing; the sort key gives it " +
           "its name.",
    }];
    placed.forEach(function (p, i) {
      frames.push({ paint: paint(i), cap: placeCap(p) });
    });
    frames.push({
      paint: paint(placed.length - 1, true),
      cap: "All six nets in " + trackEnd.length + " tracks. The " +
           "busiest column (red) is crossed by " + density +
           " intervals at once: the channel density, and no routing " +
           "can use fewer tracks than that. The sweep used exactly " +
           density + ": optimal. Vertical constraints restrict the " +
           "track choice, and constraint cycles need dogleg " +
           "splitting; this pure interval case is where the " +
           "optimality proof lives.",
    });
    return { frames: frames, h: CH, speed: 1500 };
  };


  /* =========================================================
     concept figures for the explanation sections
     ========================================================= */

  /* hadlock: the M + 2d accounting */
  BUILD["hadlock-idea"] = function () {
    var real = bfs(SRC, DST, BASE_BLOCK, W, H);
    var away = [];
    for (var i = 1; i < real.length; i++) {
      if (manh(real[i], DST) > manh(real[i - 1], DST)) away.push(real[i]);
    }
    var M = manh(SRC, DST), d = away.length;
    function paint(stage) {
      return function (ctx) {
        base(ctx, W, H, BASE_WALLS);
        if (stage === 0) {
          polyline(ctx, [SRC, { x: DST.x, y: SRC.y }, DST], MUT, 4, true);
        } else {
          polyline(ctx, real, GREEN);
          if (stage >= 1) away.forEach(function (c) { fillCell(ctx, c.x, c.y, RED, 0.5); });
        }
        pin(ctx, SRC.x, SRC.y, GREEN_DEEP, "S");
        pin(ctx, DST.x, DST.y, BLUE, "T");
      };
    }
    return { frames: [
      { paint: paint(0),
        cap: "The unobstructed ideal: Manhattan distance M = " + M +
             " (dashed). Any real path is this, plus detours." },
      { paint: paint(1),
        cap: "The shortest path around the wall. Each red cell is a step " +
             "away from the target: d = " + d + " detour moves, each " +
             "requiring one compensating toward-move." },
      { paint: paint(2),
        cap: "Path length = M + 2d = " + M + " + " + (2 * d) + " = " +
             (M + 2 * d) + ". Minimizing detour count minimizes path " +
             "length; detour-ordered search therefore preserves " +
             "optimality." },
    ] };
  };

  /* soukup: two modes, in isolation */
  BUILD["soukup-idea"] = function () {
    var w = 11, h = 7, s = { x: 1, y: 3 }, t = { x: 9, y: 3 };
    var wallList = [];
    for (var y = 1; y < h; y++) wallList.push([5, y]);
    var frames = [];
    frames.push({
      paint: function (ctx) {
        base(ctx, w, h, []);
        polyline(ctx, [s, t], GREEN);
        pin(ctx, s.x, s.y, GREEN_DEEP, "S");
        pin(ctx, t.x, t.y, BLUE, "T");
      },
      cap: "Open ground: the sprint just walks. One cell visited per cell " +
           "of progress, no queue, no labels: the part of routing that " +
           "should be free, made free.",
    });
    frames.push({
      paint: function (ctx) {
        base(ctx, w, h, wallList);
        polyline(ctx, [s, { x: 4, y: 3 }], GREEN);
        fillCell(ctx, 4, 3, RED, 0.4);
        pin(ctx, s.x, s.y, GREEN_DEEP, "S");
        pin(ctx, t.x, t.y, BLUE, "T");
      },
      cap: "A wall: no free neighbor reduces the distance. The sprint has " +
           "no answer; a different tool is needed.",
    });
    frames.push({
      paint: function (ctx) {
        base(ctx, w, h, wallList);
        polyline(ctx, [s, { x: 4, y: 3 }], GREEN);
        [[3,2],[4,2],[3,4],[4,4],[2,2],[2,4],[3,1],[4,1],[3,0],[4,0],[5,0]].forEach(function (c) {
          fillCell(ctx, c[0], c[1], AMBER, 0.22);
        });
        fillCell(ctx, 5, 0, AMBER, 0.55);
        pin(ctx, s.x, s.y, GREEN_DEEP, "S");
        pin(ctx, t.x, t.y, BLUE, "T");
      },
      cap: "Escape mode: a Lee-style wave (amber) from everything reached, " +
           "run only until some cell is CLOSER to the target than the " +
           "stuck point (highlighted, over the wall's top). Then sprint " +
           "again. Exactness in small doses, only when needed.",
    });
    return { frames: frames };
  };

  /* a-star: anatomy of f = g + h */
  BUILD["astar-idea"] = function () {
    var C = { x: 5, y: 3 };
    var gPath = bfs(SRC, C, BASE_BLOCK, W, H);
    var g = gPath.length - 1, h = manh(C, DST), f = g + h;
    var C2 = { x: 1, y: 9 };
    var g2Path = bfs(SRC, C2, BASE_BLOCK, W, H);
    var f2 = (g2Path.length - 1) + manh(C2, DST);
    function paint(stage) {
      return function (ctx) {
        base(ctx, W, H, BASE_WALLS);
        polyline(ctx, gPath, BLUE, 4);
        if (stage >= 1) {
          polyline(ctx, [C, { x: DST.x, y: C.y }, DST], BLUE, 3, true);
        }
        if (stage >= 2) {
          fillCell(ctx, C.x, C.y, BLUE, 0.35);
          textCell(ctx, C.x, C.y, f, "#1d4ed8", true);
        }
        if (stage >= 3) {
          polyline(ctx, g2Path, MUT, 3);
          polyline(ctx, [C2, { x: DST.x, y: C2.y }, DST], MUT, 2, true);
          fillCell(ctx, C2.x, C2.y, MUT, 0.3);
          textCell(ctx, C2.x, C2.y, f2, MUT, true);
        }
        pin(ctx, SRC.x, SRC.y, GREEN_DEEP, "S");
        pin(ctx, DST.x, DST.y, BLUE, "T");
      };
    }
    return { frames: [
      { paint: paint(0),
        cap: "g: the exact, known cost of the best path found to this " +
             "cell so far (solid, g = " + g + ")." },
      { paint: paint(1),
        cap: "h: an ESTIMATE of the cost still to go (dashed Manhattan " +
             "distance, h = " + h + "). It never overestimates, which is " +
             "the entire legal basis of the optimality guarantee." },
      { paint: paint(2),
        cap: "f = g + h = " + f + ": the cell's priority. Known past plus " +
             "admissible estimate." },
      { paint: paint(3),
        cap: "A competing cell in the wrong direction scores f = " + f2 +
             ". The queue settles lowest-f first, so the gray cell waits, " +
             "probably forever. That waiting is the entire speedup." },
    ] };
  };

  /* mikami: segments, not cells */
  BUILD["mikami-idea"] = function () {
    var free = 0;
    for (var y = 0; y < H; y++)
      for (var x = 0; x < W; x++)
        if (!BASE_BLOCK[x + "," + y]) free++;
    return { frames: [
      { paint: function (ctx) {
          base(ctx, W, H, BASE_WALLS);
          for (var y = 0; y < H; y++)
            for (var x = 0; x < W; x++)
              if (!BASE_BLOCK[x + "," + y]) fillCell(ctx, x, y, MUT, 0.15);
          pin(ctx, SRC.x, SRC.y, GREEN_DEEP, "S");
          pin(ctx, DST.x, DST.y, BLUE, "T");
        },
        cap: "Grid methods pay for the plane cell by cell: a Lee label " +
             "for every free cell, " + free + " of them here, millions on " +
             "a real board. In 1968 that memory was the whole budget." },
      { paint: function (ctx) {
          base(ctx, W, H, BASE_WALLS);
          seg(ctx, 0, 6, 6, 6, GREEN, 4);
          seg(ctx, 2, 0, 2, 9, GREEN, 4);
          seg(ctx, 8, 6, 14, 6, BLUE, 4);
          seg(ctx, 12, 0, 12, 9, BLUE, 4);
          pin(ctx, SRC.x, SRC.y, GREEN_DEEP, "S");
          pin(ctx, DST.x, DST.y, BLUE, "T");
        },
        cap: "Line search stores the same plane as 4 segments: endpoints " +
             "and parents, nothing else. The entire algorithm is a " +
             "consequence of this one representation choice." },
    ] };
  };

  /* hightower: everywhere-probes versus one escape point */
  BUILD["hightower-idea"] = function () {
    return { frames: [
      { paint: function (ctx) {
          base(ctx, W, H, BASE_WALLS);
          seg(ctx, 0, 6, 6, 6, GREEN, 4);
          for (var x = 0; x <= 6; x++) seg(ctx, x, 0, x, 9, GREEN, 1.5, true);
          pin(ctx, SRC.x, SRC.y, GREEN_DEEP, "S");
          pin(ctx, DST.x, DST.y, BLUE, "T");
        },
        cap: "Mikami-Tabuchi's answer to a blocked line: perpendicular " +
             "probes from EVERY point. Complete, and expensive." },
      { paint: function (ctx) {
          base(ctx, W, H, BASE_WALLS);
          seg(ctx, 0, 6, 6, 6, GREEN, 4);
          fillCell(ctx, 6, 6, GREEN, 0.5);
          seg(ctx, 6, 0, 6, 9, GREEN, 3, true);
          pin(ctx, SRC.x, SRC.y, GREEN_DEEP, "S");
          pin(ctx, DST.x, DST.y, BLUE, "T");
        },
        cap: "Hightower's answer: ONE escape point, chosen just past the " +
             "blocking obstacle's edge, one perpendicular. A fraction of " +
             "the work, and the door through which incompleteness " +
             "enters: if the needed probe is not this one, it is never " +
             "made." },
    ] };
  };

  /* steiner: the junction idea on three pins */
  BUILD["steiner-idea"] = function () {
    var A = { x: 3, y: 2 }, B = { x: 3, y: 8 }, C = { x: 11, y: 5 };
    function pins3(ctx) {
      pin(ctx, A.x, A.y, PURPLE, "A");
      pin(ctx, B.x, B.y, PURPLE, "B");
      pin(ctx, C.x, C.y, PURPLE, "C");
    }
    return { frames: [
      { paint: function (ctx) { base(ctx, W, H, []); pins3(ctx); },
        cap: "Three pins of one net. Connect them with minimum " +
             "rectilinear wire." },
      { paint: function (ctx) {
          base(ctx, W, H, []);
          seg(ctx, 3, 2, 3, 8, AMBER, 5);
          polyline(ctx, [A, { x: 11, y: 2 }, C], AMBER, 5);
          pins3(ctx);
        },
        cap: "Best pin-to-pin tree: wire may only branch AT a pin. " +
             "Length 6 + 11 = 17." },
      { paint: function (ctx) {
          base(ctx, W, H, []);
          seg(ctx, 3, 2, 3, 8, TEAL, 5);
          seg(ctx, 3, 5, 11, 5, TEAL, 5);
          fillCell(ctx, 3, 5, TEAL, 0.5);
          pins3(ctx);
        },
        cap: "Allow a junction that is NOT a pin (the Steiner point, " +
             "highlighted) and the tree costs 6 + 8 = 14. Finding the " +
             "best such junctions is the NP-hard (Non-deterministic " +
             "Polynomial hard) problem FLUTE (Fast LookUp Table " +
             "Estimation) answers by table." },
    ] };
  };

  /* rip-up: ordering changes the answer */
  BUILD["ripup-idea"] = function () {
    var walls = [];
    for (var y = 0; y < H; y++) if (y !== 2 && y !== 6) walls.push([7, y]);
    var blocked = wallSet(walls);
    var A1 = { x: 2, y: 5 }, A2 = { x: 12, y: 5 };
    var B1 = { x: 2, y: 8 }, B2 = { x: 12, y: 8 };
    function withP(p) {
      var b = {};
      Object.keys(blocked).forEach(function (k) { b[k] = true; });
      p.forEach(function (c) { b[c.x + "," + c.y] = true; });
      return b;
    }
    var aFirstA = bfs(A1, A2, blocked, W, H);
    var aFirstB = bfs(B1, B2, withP(aFirstA), W, H);
    var bFirstB = bfs(B1, B2, blocked, W, H);
    var bFirstA = bfs(A1, A2, withP(bFirstB), W, H);
    var t1 = (aFirstA.length - 1) + (aFirstB.length - 1);
    var t2 = (bFirstA.length - 1) + (bFirstB.length - 1);
    function paint(a, b) {
      return function (ctx) {
        base(ctx, W, H, walls);
        polyline(ctx, a, GREEN, CS * 0.22);
        polyline(ctx, b, PURPLE, CS * 0.22);
        pin(ctx, A1.x, A1.y, GREEN_DEEP, "A");
        pin(ctx, A2.x, A2.y, GREEN_DEEP, "A");
        pin(ctx, B1.x, B1.y, PURPLE, "B");
        pin(ctx, B2.x, B2.y, PURPLE, "B");
      };
    }
    return { frames: [
      { paint: paint(aFirstA, aFirstB),
        cap: "Order A then B: total wirelength " + t1 + ". A takes the " +
             "good gap; B pays." },
      { paint: paint(bFirstA, bFirstB),
        cap: "Order B then A: total wirelength " + t2 + ". Same nets, " +
             "same wall, different answer. Ordering is destiny, choosing " +
             "it optimally is NP-hard (Non-deterministic Polynomial " +
             "hard), and that is exactly why routers repair instead of " +
             "predict." },
    ] };
  };

  /* pathfinder: the three-part price */
  BUILD["pathfinder-idea"] = function () {
    function bars(parts, capTxt) {
      return { paint: function (ctx) {
        base(ctx, W, 7, []);
        var labels = ["iteration 1", "iteration 2", "iteration 3"];
        parts.forEach(function (p, i) {
          var x0 = (2 + i * 4) * CS;
          var y0 = 5.6 * CS;
          var scale = 0.5 * CS;
          var segs = [
            { v: p[0], c: MUT },
            { v: p[1], c: RED },
            { v: p[2], c: AMBER },
          ];
          var y = y0;
          segs.forEach(function (s) {
            var hpx = s.v * scale;
            ctx.fillStyle = s.c;
            ctx.fillRect(x0, y - hpx, 1.6 * CS, hpx);
            y -= hpx;
          });
          ctx.fillStyle = INK;
          ctx.font = "11px 'JetBrains Mono', monospace";
          ctx.textAlign = "center";
          ctx.fillText(labels[i], x0 + 0.8 * CS, 6.3 * CS);
        });
        ctx.textAlign = "left";
        ctx.font = "bold 11px 'JetBrains Mono', monospace";
        ctx.fillStyle = MUT; ctx.fillText("base", 12.2 * CS, 1 * CS);
        ctx.fillStyle = RED; ctx.fillText("present", 12.2 * CS, 1.6 * CS);
        ctx.fillStyle = AMBER; ctx.fillText("history", 12.2 * CS, 2.2 * CS);
      }, cap: capTxt };
    }
    return { frames: [
      bars([[1, 0, 0], [0, 0, 0], [0, 0, 0]],
        "A resource's price has three parts. At first, only the base " +
        "cost: its intrinsic delay or length."),
      bars([[1, 0, 0], [1, 2.4, 0], [0, 0, 0]],
        "Overused this iteration? The PRESENT congestion term multiplies " +
        "in, growing with how far over capacity the resource is."),
      bars([[1, 0, 0], [1, 2.4, 0], [1, 1.6, 1.2]],
        "Still contested iteration after iteration? The HISTORY term " +
        "accumulates and never resets, so a chronically fought-over wire " +
        "stays expensive even in a moment of calm. History is what kills " +
        "oscillation, and it is the algorithm's signature idea."),
    ], h: 7 };
  };

  /* twopass: one region at two resolutions */
  BUILD["twopass-idea"] = function () {
    function coarse(ctx) {
      ctx.save();
      ctx.strokeStyle = "rgba(26,29,38,0.4)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (var x = 0; x <= W; x += 3) { ctx.moveTo(x * CS, 0); ctx.lineTo(x * CS, H * CS); }
      for (var y = 0; y <= H; y += 5) { ctx.moveTo(0, y * CS); ctx.lineTo(W * CS, y * CS); }
      ctx.stroke();
      ctx.restore();
      /* capacity is a property of EDGES, per direction: the tracks
         that cross the boundary. Here a GCell is 3 x 5 fine cells, so
         5 horizontal tracks cross each vertical boundary and 3
         vertical tracks cross each horizontal boundary. */
      ctx.fillStyle = MUT;
      ctx.font = "bold 10px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      for (var bx = 3; bx <= 12; bx += 3)
        for (var gy = 0; gy < 2; gy++)
          ctx.fillText("5", bx * CS, (gy * 5 + 2.5) * CS + 4);
      for (var gx = 0; gx < 5; gx++)
        ctx.fillText("3", (gx * 3 + 1.5) * CS, 5 * CS + 4);
    }
    function fine(ctx) {
      ctx.save();
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(47,111,237,0.35)"; /* horizontal layer */
      ctx.beginPath();
      for (var y = 0; y < H; y++) { ctx.moveTo(0, y * CS + CS / 2); ctx.lineTo(W * CS, y * CS + CS / 2); }
      ctx.stroke();
      ctx.strokeStyle = "rgba(22,163,74,0.3)"; /* vertical layer */
      ctx.beginPath();
      for (var x = 0; x < W; x++) { ctx.moveTo(x * CS + CS / 2, 0); ctx.lineTo(x * CS + CS / 2, H * CS); }
      ctx.stroke();
      ctx.restore();
    }
    function detailWorld(ctx) {
      fine(ctx);
      /* a macro with its spacing band */
      ctx.fillStyle = "#c9c6bc";
      ctx.fillRect(9 * CS, 2 * CS, 4 * CS, 3 * CS);
      ctx.strokeStyle = "#9b9890"; ctx.lineWidth = 1.5;
      ctx.strokeRect(9 * CS, 2 * CS, 4 * CS, 3 * CS);
      ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = AMBER; ctx.lineWidth = 1.5;
      ctx.strokeRect(8.6 * CS, 1.6 * CS, 4.8 * CS, 3.8 * CS);
      ctx.restore();
      ctx.font = "10px 'JetBrains Mono', monospace";
      ctx.textAlign = "center"; ctx.fillStyle = MUT;
      ctx.fillText("macro + spacing band", 11 * CS, 3.6 * CS);
      /* cell pins along a row */
      [2, 4, 6].forEach(function (x) {
        ctx.fillStyle = RED;
        ctx.fillRect(x * CS + CS / 2 - 4, 8 * CS + CS / 2 - 7, 8, 14);
      });
      ctx.fillStyle = RED;
      ctx.fillText("cell pins", 4 * CS + CS / 2, 9.6 * CS);
      /* one routed net: track runs + vias at layer changes */
      seg(ctx, 2, 8, 2, 6, GREEN, 4);
      seg(ctx, 2, 6, 7, 6, BLUE, 4);
      seg(ctx, 7, 6, 7, 1, GREEN, 4);
      seg(ctx, 7, 1, 13, 1, BLUE, 4);
      [[2, 6], [7, 6], [7, 1]].forEach(function (v) {
        ctx.fillStyle = INK;
        ctx.fillRect(v[0] * CS + CS / 2 - 4, v[1] * CS + CS / 2 - 4, 8, 8);
      });
    }
    var NETPATH = [{ x: 2, y: 8 }, { x: 2, y: 6 }, { x: 7, y: 6 }, { x: 7, y: 1 }, { x: 13, y: 1 }];
    function clipGrid(ctx, dash, offset) {
      /* clips of 5 x 5 cells; optional dashed shifted grid */
      var o = offset || 0;
      ctx.save();
      if (dash) ctx.setLineDash([6, 5]);
      ctx.strokeStyle = dash ? "#7c3aed" : INK;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (var x = o; x <= W; x += 5) { ctx.moveTo(x * CS, 0); ctx.lineTo(x * CS, H * CS); }
      for (var y = o; y <= H; y += 5) { ctx.moveTo(0, y * CS); ctx.lineTo(W * CS, y * CS); }
      ctx.stroke();
      ctx.restore();
    }
    function activeClips(ctx, cells) {
      cells.forEach(function (c) {
        ctx.save();
        ctx.fillStyle = AMBER;
        ctx.globalAlpha = 0.16;
        ctx.fillRect(c[0] * 5 * CS, c[1] * 5 * CS, 5 * CS, 5 * CS);
        ctx.restore();
        ctx.font = "bold 9px 'JetBrains Mono', monospace";
        ctx.textAlign = "left"; ctx.fillStyle = "#b45309";
        ctx.fillText("thread " + c[2], c[0] * 5 * CS + 4, c[1] * 5 * CS + 12);
      });
    }
    function boundaryDots(ctx) {
      /* where the routed net crosses clip boundaries: fixed handoffs */
      [[5 * CS, 6 * CS + CS / 2], [7 * CS + CS / 2, 5 * CS], [10 * CS, 1 * CS + CS / 2]].forEach(function (p) {
        ctx.beginPath();
        ctx.arc(p[0], p[1], 6, 0, Math.PI * 2);
        ctx.fillStyle = "#fff"; ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
      });
    }
    function guideBand(ctx) {
      for (var m = 1; m < NETPATH.length; m++) {
        var a = NETPATH[m - 1], b = NETPATH[m];
        var x0 = Math.min(a.x, b.x) - 1, x1 = Math.max(a.x, b.x) + 1;
        var y0 = Math.min(a.y, b.y) - 1, y1 = Math.max(a.y, b.y) + 1;
        ctx.save(); ctx.fillStyle = GREEN; ctx.globalAlpha = 0.13;
        ctx.fillRect(Math.max(0, x0) * CS, Math.max(0, y0) * CS,
                     (Math.min(W, x1 + 1) - Math.max(0, x0)) * CS,
                     (Math.min(H, y1 + 1) - Math.max(0, y0)) * CS);
        ctx.restore();
      }
    }
    return { frames: [
      { paint: function (ctx) { base(ctx, W, H, []); coarse(ctx); },
        cap: "The global router's world: coarse GCells, with a capacity " +
             "on every edge between them: the count of tracks crossing " +
             "that boundary, per direction. Here each GCell is 3 x 5 " +
             "fine cells, so 5 horizontal tracks cross each vertical " +
             "boundary and 3 vertical tracks cross each horizontal one " +
             "(in production, summed over all layers in the direction, " +
             "minus blocked tracks). The whole chip fits in view; no " +
             "individual wire exists." },
      { paint: function (ctx) { base(ctx, W, H, []); detailWorld(ctx); },
        cap: "Step 1, the whole database is loaded: the detailed " +
             "router sees everything: horizontal tracks on one layer " +
             "(blue), vertical on the next (green), a macro wrapped in " +
             "its spacing band (amber dashes), cell pins to reach " +
             "legally (red), and every routed wire with its vias " +
             "(black squares). Nothing is invisible; what is limited " +
             "is not sight but search.", },
      { paint: function (ctx) { base(ctx, W, H, []); detailWorld(ctx); clipGrid(ctx);
          activeClips(ctx, [[0, 0, 1], [1, 1, 2], [2, 0, 3]]); },
        cap: "Step 2, the search is windowed: the die is cut into " +
             "clips of a few GCells (heavy grid; TritonRoute's are " +
             "about 7 x 7 GCells) and the DRC (Design Rule Check) " +
             "driven rip-up search runs inside one clip at a time, " +
             "many clips in parallel on different threads (amber). " +
             "Within a clip, everything outside is fixed context the " +
             "search may not move. A track-level search over the " +
             "whole chip at once would be intractable, and clips are " +
             "also what makes the router parallel.", },
      { paint: function (ctx) { base(ctx, W, H, []); guideBand(ctx); detailWorld(ctx); clipGrid(ctx);
          boundaryDots(ctx); },
        cap: "Step 3, the guides make windowing sound: the router " +
             "never decides a net's shape, global routing already " +
             "fixed its corridor (green band) across the whole die. A " +
             "net crossing three clips arrives as three local jobs: " +
             "realize the guide segment between the fixed boundary " +
             "crossings (white dots). The whole-net, whole-chip " +
             "reasoning happened once, cheaply, at GCell resolution; " +
             "the clips just fill in the plan.", },
      { paint: function (ctx) { base(ctx, W, H, []); guideBand(ctx); detailWorld(ctx); clipGrid(ctx);
          /* a violation straddling a clip boundary */
          ctx.save(); ctx.strokeStyle = RED; ctx.lineWidth = 2.5; ctx.setLineDash([3, 3]);
          ctx.strokeRect(4.4 * CS, 5.4 * CS, 1.2 * CS, 1.2 * CS); ctx.restore();
          ctx.font = "bold 10px 'JetBrains Mono', monospace";
          ctx.textAlign = "left"; ctx.fillStyle = RED;
          ctx.fillText("violation on the seam", 5.7 * CS, 5.9 * CS);
          clipGrid(ctx, true, 2.5); },
        cap: "Step 4, the seams: a violation straddling a clip " +
             "boundary (red) cannot be repaired by either clip alone, " +
             "since each sees half of it as fixed. The router shifts " +
             "the clip origins between iterations (violet dashed " +
             "grid): this pass's seam is the middle of a clip in the " +
             "next pass. Part of why detailed routing runs dozens of " +
             "iterations.", },
      { paint: function (ctx) {
          base(ctx, W, H, []);
          fine(ctx);
          coarse(ctx);
          ctx.save();
          ctx.fillStyle = GREEN;
          ctx.globalAlpha = 0.14;
          ctx.fillRect(0, 5 * CS, W * CS, 5 * CS);
          ctx.restore();
        },
        cap: "The handoff: global routing promises each net a corridor of " +
             "GCells (green guide), detailed routing redeems the promise " +
             "on real tracks inside it. Neither resolution could solve " +
             "the problem alone; the contract between them is the " +
             "algorithm." },
    ] };
  };

  /* left-edge: from channel wires to intervals to density */
  /* the channel-era standard-cell die, for the left-edge setting */
  BUILD["channel-chip"] = function () {
    var X0 = 0.7, X1 = 14.3;
    var rows = [[0.7, 2.1], [3.1, 4.5], [5.5, 6.9], [7.9, 9.3]];
    var chans = [[2.1, 3.1], [4.5, 5.5], [6.9, 7.9]];
    var widths = [1.3, 0.9, 1.6, 1.1, 0.8, 1.4];
    function line(ctx, x0, y0, x1, y1, c, w) {
      ctx.strokeStyle = c;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(x0 * CS, y0 * CS);
      ctx.lineTo(x1 * CS, y1 * CS);
      ctx.stroke();
    }
    function die(ctx) {
      ctx.fillStyle = "#fdfdfd";
      ctx.fillRect(0, 0, W * CS, H * CS);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.strokeRect(0.45 * CS, 0.45 * CS, 14.1 * CS, 9.1 * CS);
      rows.forEach(function (r, i) {
        ctx.fillStyle = "#eceae2";
        ctx.fillRect(X0 * CS, r[0] * CS, (X1 - X0) * CS, (r[1] - r[0]) * CS);
        ctx.strokeStyle = "#9b9890";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(X0 * CS, r[0] * CS, (X1 - X0) * CS, (r[1] - r[0]) * CS);
        var x = X0, k = i;
        while (true) {
          x += widths[k % widths.length];
          k += 1;
          if (x >= X1 - 0.2) break;
          line(ctx, x, r[0], x, r[1], "#c9c6bc", 1);
        }
      });
      /* feedthrough cell: a narrow dedicated cell in row 2 */
      line(ctx, 8.05, rows[1][0], 8.05, rows[1][1], "#9b9890", 1.5);
      line(ctx, 8.35, rows[1][0], 8.35, rows[1][1], "#9b9890", 1.5);
    }
    function labels(ctx) {
      ctx.font = "bold 11px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "#6d6a61";
      ctx.fillText("cell row", 7.5 * CS, (rows[0][0] + rows[0][1]) / 2 * CS + 4);
      ctx.fillStyle = GREEN_DEEP;
      ctx.fillText("routing channel", 7.5 * CS, (chans[0][0] + chans[0][1]) / 2 * CS + 4);
    }
    function wires(ctx) {
      /* channel 1 */
      line(ctx, 1.2, 2.35, 4.2, 2.35, GREEN, 3);
      line(ctx, 1.2, 2.1, 1.2, 2.35, GREEN, 2);
      line(ctx, 4.2, 2.35, 4.2, 3.1, GREEN, 2);
      line(ctx, 3.0, 2.6, 7.5, 2.6, BLUE, 3);
      line(ctx, 7.5, 2.1, 7.5, 2.6, BLUE, 2);
      line(ctx, 3.0, 2.6, 3.0, 3.1, BLUE, 2);
      line(ctx, 9.0, 2.85, 12.6, 2.85, AMBER, 3);
      line(ctx, 9.0, 2.1, 9.0, 2.85, AMBER, 2);
      line(ctx, 12.6, 2.85, 12.6, 3.1, AMBER, 2);
      /* one net crosses row 2 through the feedthrough cell */
      ctx.save();
      ctx.fillStyle = PURPLE;
      ctx.globalAlpha = 0.15;
      ctx.fillRect(8.05 * CS, rows[1][0] * CS, 0.3 * CS,
                   (rows[1][1] - rows[1][0]) * CS);
      ctx.restore();
      line(ctx, 6.0, 2.35, 8.2, 2.35, PURPLE, 3);
      line(ctx, 6.0, 2.1, 6.0, 2.35, PURPLE, 2);
      line(ctx, 8.2, 2.35, 8.2, 4.75, PURPLE, 2);
      line(ctx, 8.2, 4.75, 10.5, 4.75, PURPLE, 3);
      line(ctx, 10.5, 4.75, 10.5, 5.5, PURPLE, 2);
      /* channel 2 */
      line(ctx, 1.5, 5.0, 5.0, 5.0, TEAL, 3);
      line(ctx, 1.5, 4.5, 1.5, 5.0, TEAL, 2);
      line(ctx, 5.0, 5.0, 5.0, 5.5, TEAL, 2);
      /* channel 3 */
      line(ctx, 2.5, 7.3, 6.5, 7.3, BLUE, 3);
      line(ctx, 2.5, 6.9, 2.5, 7.3, BLUE, 2);
      line(ctx, 6.5, 7.3, 6.5, 7.9, BLUE, 2);
      line(ctx, 9.0, 7.55, 13.0, 7.55, GREEN, 3);
      line(ctx, 9.0, 6.9, 9.0, 7.55, GREEN, 2);
      line(ctx, 13.0, 7.55, 13.0, 7.9, GREEN, 2);
    }
    return { frames: [
      {
        paint: function (ctx) {
          die(ctx);
          labels(ctx);
        },
        cap: "A standard-cell die of the channel era: logic sits in " +
             "fixed-height cell rows, each divided into cells, and the " +
             "space between rows is deliberately left empty. With only " +
             "one or two wiring layers, wires could not pass over the " +
             "cells, so every connection must be made between the rows.",
      },
      {
        paint: function (ctx) {
          die(ctx);
          wires(ctx);
        },
        cap: "All routing lives in the channels: horizontal trunks on " +
             "channel tracks, vertical stubs to pins on the row edges, " +
             "and a feedthrough cell (violet) where a net must cross a " +
             "row to reach the next channel. Each channel grows as tall " +
             "as its router needs, so die height is the cell rows plus " +
             "every channel's track count. Minimizing tracks was " +
             "minimizing chip area. The walkthrough further down plays " +
             "inside one such channel.",
      },
    ], speed: 2600 };
  };

  BUILD["leftedge-idea"] = function () {
    var CH = 7;
    var iv = [
      { l: 0, r: 4, c: GREEN, y: 2 },
      { l: 2, r: 7, c: PURPLE, y: 3 },
      { l: 5, r: 9, c: BLUE, y: 4 },
      { l: 3, r: 12, c: AMBER, y: 5 },
    ];
    return { frames: [
      { paint: function (ctx) {
          base(ctx, W, CH, []);
          seg(ctx, 0, 0, 14, 0, INK, 3);
          seg(ctx, 0, 6, 14, 6, INK, 3);
          iv.forEach(function (n) {
            seg(ctx, n.l, n.y, n.r, n.y, n.c, 5);
            seg(ctx, n.l, 0, n.l, n.y, n.c, 2, true);
            seg(ctx, n.r, 6, n.r, n.y, n.c, 2, true);
          });
        },
        cap: "A channel: pins top and bottom, one horizontal trunk per " +
             "net, vertical stubs to pins. Chip area depends directly on " +
             "how few tracks the trunks occupy." },
      { paint: function (ctx) {
          base(ctx, W, CH, []);
          iv.forEach(function (n) { seg(ctx, n.l, n.y, n.r, n.y, n.c, 6); });
        },
        cap: "Abstract away everything but the horizontal spans and the " +
             "problem becomes pure: pack intervals into rows so that " +
             "overlapping intervals never share a row. Interval-graph " +
             "coloring, in layout clothing." },
      { paint: function (ctx) {
          base(ctx, W, CH, []);
          iv.forEach(function (n) { seg(ctx, n.l, n.y, n.r, n.y, n.c, 6); });
          ctx.save();
          ctx.fillStyle = RED;
          ctx.globalAlpha = 0.15;
          ctx.fillRect(5.2 * CS, 0, 1.6 * CS, CH * CS);
          ctx.restore();
          textCell(ctx, 6, 1, "density 4", RED, true);
        },
        cap: "The busiest column crosses 4 intervals: the channel " +
             "DENSITY. No routing can use fewer tracks than the density, " +
             "and the left-edge greedy provably never uses more (absent " +
             "vertical constraints). Optimality from a sort and a " +
             "sweep." },
    ], h: CH };
  };


  /* a-star: how the priority queue is built, pop by pop */
  BUILD["astar-queue"] = function () {
    var w = 9, h = 7;
    var s = { x: 1, y: 3 }, t = { x: 7, y: 3 };
    var wallList = [[4, 2], [4, 3], [4, 4]];
    var blocked = wallSet(wallList);

    /* instrumented A*: log every pop and push, snapshot the queue */
    var g = {}, closed = {}, parent = {};
    var open = [{ c: s, g: 0, h: manh(s, t) }];
    g[s.x + "," + s.y] = 0;
    var events = [], settled = [];

    function snapQueue() {
      var best = {};
      open.forEach(function (e) {
        var k = e.c.x + "," + e.c.y;
        if (closed[k]) return;
        var f = e.g + e.h;
        if (!best[k] || f < best[k].f) {
          best[k] = { x: e.c.x, y: e.c.y, g: e.g, h: e.h, f: f };
        }
      });
      return Object.keys(best).map(function (k) { return best[k]; })
        .sort(function (a, b) { return a.f - b.f || a.h - b.h; });
    }

    events.push({ type: "start", queue: snapQueue(), settled: [] });
    var guard = 200;
    while (open.length && guard-- > 0) {
      open.sort(function (a, b) {
        return (a.g + a.h) - (b.g + b.h) || a.h - b.h;
      });
      var e = open.shift();
      var k = e.c.x + "," + e.c.y;
      if (closed[k]) continue;
      closed[k] = true;
      settled.push({ x: e.c.x, y: e.c.y, f: e.g + e.h });
      events.push({ type: "pop", cell: e.c, g: e.g, h: e.h, f: e.g + e.h,
                    queue: snapQueue(), settled: settled.slice() });
      if (e.c.x === t.x && e.c.y === t.y) break;
      var pushed = [];
      nbrs(e.c.x, e.c.y, w, h).forEach(function (n) {
        var nk = n.x + "," + n.y;
        if (blocked[nk] || closed[nk]) return;
        var ng = e.g + 1;
        if (g[nk] === undefined || ng < g[nk]) {
          var improved = g[nk] !== undefined;
          g[nk] = ng;
          parent[nk] = e.c;
          open.push({ c: n, g: ng, h: manh(n, t) });
          pushed.push({ x: n.x, y: n.y, g: ng, h: manh(n, t),
                        f: ng + manh(n, t), improved: improved });
        }
      });
      events.push({ type: "push", popped: e.c, gpop: e.g, pushed: pushed,
                    queue: snapQueue(), settled: settled.slice() });
    }
    var path = [t], cur = t;
    while (!(cur.x === s.x && cur.y === s.y)) {
      cur = parent[cur.x + "," + cur.y];
      path.push(cur);
    }
    path.reverse();

    var QX = 9.5; /* queue panel origin, in cell units */
    function paintEvent(ev, withPath) {
      return function (ctx) {
        /* full canvas is 15 cells wide; grid occupies the left 9 */
        ctx.fillStyle = "#fdfdfd";
        ctx.fillRect(0, 0, 15 * CS, h * CS);
        base(ctx, w, h, wallList);
        ev.settled.forEach(function (c) {
          if (c.x === s.x && c.y === s.y) return;
          fillCell(ctx, c.x, c.y, BLUE, 0.16);
          textCell(ctx, c.x, c.y, c.f, MUT);
        });
        ev.queue.forEach(function (q) {
          ctx.strokeStyle = AMBER;
          ctx.lineWidth = 2;
          ctx.strokeRect(q.x * CS + 2, q.y * CS + 2, CS - 4, CS - 4);
          textCell(ctx, q.x, q.y, q.f, AMBER, false);
        });
        if (ev.type === "pop") {
          fillCell(ctx, ev.cell.x, ev.cell.y, BLUE, 0.45);
          textCell(ctx, ev.cell.x, ev.cell.y, ev.f, "#1d4ed8", true);
        }
        if (ev.type === "push") {
          ev.pushed.forEach(function (p) {
            fillCell(ctx, p.x, p.y, GREEN, 0.3);
          });
        }
        if (withPath) polyline(ctx, path, BLUE);
        pin(ctx, s.x, s.y, GREEN_DEEP, "S");
        pin(ctx, t.x, t.y, BLUE, "T");

        /* queue panel */
        ctx.fillStyle = INK;
        ctx.font = "bold 11px 'JetBrains Mono', monospace";
        ctx.textAlign = "left";
        ctx.fillText("open queue, sorted by f", QX * CS, 16);
        var maxRows = 8;
        ev.queue.slice(0, maxRows).forEach(function (q, i) {
          var y0 = 26 + i * 22;
          var isNew = ev.type === "push" && ev.pushed.some(function (p) {
            return p.x === q.x && p.y === q.y;
          });
          var isHead = ev.type === "pop" ? false : i === 0;
          ctx.strokeStyle = isNew ? GREEN : (isHead ? "#1d4ed8" : "#d5d3ca");
          ctx.lineWidth = isNew || isHead ? 2 : 1;
          ctx.strokeRect(QX * CS, y0, 5 * CS, 18);
          ctx.fillStyle = isNew ? GREEN_DEEP : INK;
          ctx.font = "11px 'JetBrains Mono', monospace";
          ctx.fillText(
            "(" + q.x + "," + q.y + ")  g=" + q.g + " h=" + q.h + " f=" + q.f,
            QX * CS + 6, y0 + 13);
        });
        if (ev.queue.length > maxRows) {
          ctx.fillStyle = MUT;
          ctx.fillText("+ " + (ev.queue.length - maxRows) + " more",
                       QX * CS, 26 + maxRows * 22 + 12);
        }
      };
    }

    var frames = [];
    events.forEach(function (ev, i) {
      var cap;
      if (ev.type === "start") {
        cap = "Before Step 1: the queue is born with one entry, the " +
              "source, g = 0, h = " + manh(s, t) + ", f = " + manh(s, t) +
              ". Everything the algorithm will ever know sits in this " +
              "sorted list.";
      } else if (ev.type === "pop") {
        cap = "Step 1: Pop. Take the head: (" + ev.cell.x + "," +
              ev.cell.y + ") with f = " + ev.f + ", the smallest " +
              "anywhere. At this instant its g = " + ev.g + " turns from " +
              "best-so-far into provably optimal: nothing left in the " +
              "queue could reach it cheaper. The cell is settled (blue).";
      } else {
        if (ev.pushed.length === 0) {
          cap = "Steps 2-4: nothing to do. Every neighbor of (" +
                ev.popped.x + "," + ev.popped.y + ") is a wall, already " +
                "settled, or already queued at an equal or better g. " +
                "Step 5: back to the pop.";
        } else {
          var parts = ev.pushed.map(function (p) {
            return "(" + p.x + "," + p.y + "): g = " + ev.gpop + "+1 = " +
                   p.g + ", h = |" + t.x + "\u2212" + p.x + "|+|" + t.y +
                   "\u2212" + p.y + "| = " + p.h + ", f = " + p.g + "+" +
                   p.h + " = " + p.f;
          });
          cap = "Steps 2-4, from (" + ev.popped.x + "," + ev.popped.y +
                "), settled g = " + ev.gpop + ": each free neighbor " +
                "inherits g (Step 2), computes h from the target's " +
                "coordinates (Step 3), and files into the queue by f " +
                "(Step 4). " + parts.join("; ") + ".";
        }
      }
      frames.push({ paint: paintEvent(ev, false), cap: cap });
    });
    frames.push({
      paint: paintEvent(events[events.length - 1], true),
      cap: "Step 5 ends the loop: the popped cell WAS the target, so " +
           "its g is optimal and the parent chain is the shortest path. " +
           "The queue never guessed: g was always the measured cost of a " +
           "real walked path, h the admissible estimate, and the sort order " +
           "did the rest.",
    });
    return { frames: frames, w: 15, h: h, speed: 700 };
  };


  /* hadlock: the deque itself, pop by pop (mirrors astar-queue) */
  BUILD["hadlock-deque"] = function () {
    var w = 9, h = 7;
    var s = { x: 1, y: 3 }, t = { x: 7, y: 3 };
    var wallList = [[4, 2], [4, 3], [4, 4]];
    var blocked = wallSet(wallList);

    var dist = {}, parent = {}, settledMap = {};
    var dq = [s];
    dist[s.x + "," + s.y] = 0;
    var events = [], settled = [];

    function snapDeque() {
      var seen = {}, out = [];
      dq.forEach(function (c) {
        var k = c.x + "," + c.y;
        if (settledMap[k] || seen[k]) return;
        seen[k] = true;
        out.push({ x: c.x, y: c.y, d: dist[k] });
      });
      return out;
    }

    events.push({ type: "start", deque: snapDeque(), settled: [] });
    var guard = 300;
    while (dq.length && guard-- > 0) {
      var c = dq.shift();
      var k = c.x + "," + c.y;
      if (settledMap[k]) continue;
      settledMap[k] = true;
      settled.push({ x: c.x, y: c.y, d: dist[k] });
      events.push({ type: "pop", cell: c, d: dist[k],
                    deque: snapDeque(), settled: settled.slice() });
      if (c.x === t.x && c.y === t.y) break;
      var pushed = [];
      nbrs(c.x, c.y, w, h).forEach(function (n) {
        var nk = n.x + "," + n.y;
        if (blocked[nk] || settledMap[nk]) return;
        var toward = manh(n, t) < manh(c, t);
        var nd = dist[k] + (toward ? 0 : 1);
        if (dist[nk] === undefined || nd < dist[nk]) {
          dist[nk] = nd;
          parent[nk] = c;
          if (toward) dq.unshift(n); else dq.push(n);
          pushed.push({ x: n.x, y: n.y, d: nd,
                        end: toward ? "front" : "back" });
        }
      });
      events.push({ type: "push", popped: c, dpop: dist[k], pushed: pushed,
                    deque: snapDeque(), settled: settled.slice() });
    }
    var path = [t], cur = t;
    while (!(cur.x === s.x && cur.y === s.y)) {
      cur = parent[cur.x + "," + cur.y];
      path.push(cur);
    }
    path.reverse();

    var QX = 9.5;
    function paintEvent(ev, withPath) {
      return function (ctx) {
        ctx.fillStyle = "#fdfdfd";
        ctx.fillRect(0, 0, 15 * CS, h * CS);
        base(ctx, w, h, wallList);
        ev.settled.forEach(function (c2) {
          if (c2.x === s.x && c2.y === s.y) return;
          fillCell(ctx, c2.x, c2.y, GREEN, 0.16);
          textCell(ctx, c2.x, c2.y, c2.d, MUT);
        });
        ev.deque.forEach(function (q) {
          ctx.strokeStyle = AMBER;
          ctx.lineWidth = 2;
          ctx.strokeRect(q.x * CS + 2, q.y * CS + 2, CS - 4, CS - 4);
          textCell(ctx, q.x, q.y, q.d, AMBER, false);
        });
        if (ev.type === "pop") {
          fillCell(ctx, ev.cell.x, ev.cell.y, GREEN, 0.45);
          textCell(ctx, ev.cell.x, ev.cell.y, ev.d, GREEN_DEEP, true);
        }
        if (ev.type === "push") {
          ev.pushed.forEach(function (p) {
            fillCell(ctx, p.x, p.y, p.end === "front" ? GREEN : AMBER, 0.3);
          });
        }
        if (withPath) polyline(ctx, path, GREEN);
        pin(ctx, s.x, s.y, GREEN_DEEP, "S");
        pin(ctx, t.x, t.y, BLUE, "T");

        /* deque panel */
        ctx.fillStyle = INK;
        ctx.font = "bold 11px 'JetBrains Mono', monospace";
        ctx.textAlign = "left";
        ctx.fillText("deque  (front at top)", QX * CS, 16);
        var maxRows = 8;
        ev.deque.slice(0, maxRows).forEach(function (q, i) {
          var y0 = 26 + i * 22;
          var mark = "";
          var color = "#d5d3ca", txtColor = INK;
          if (ev.type === "push") {
            var pp = ev.pushed.filter(function (p) {
              return p.x === q.x && p.y === q.y;
            })[0];
            if (pp) {
              mark = pp.end === "front" ? "  ← front insert"
                                        : "  ← back insert";
              color = pp.end === "front" ? GREEN : AMBER;
              txtColor = pp.end === "front" ? GREEN_DEEP : "#b45309";
            }
          }
          if (i === 0 && ev.type !== "pop" && !mark) color = "#1d4ed8";
          ctx.strokeStyle = color;
          ctx.lineWidth = mark || i === 0 ? 2 : 1;
          ctx.strokeRect(QX * CS, y0, 5 * CS, 18);
          ctx.fillStyle = txtColor;
          ctx.font = "11px 'JetBrains Mono', monospace";
          ctx.fillText("(" + q.x + "," + q.y + ")  d=" + q.d + mark,
                       QX * CS + 6, y0 + 13);
        });
        var shown = Math.min(ev.deque.length, maxRows);
        ctx.fillStyle = MUT;
        if (ev.deque.length > maxRows) {
          ctx.fillText("+ " + (ev.deque.length - maxRows) + " more",
                       QX * CS, 26 + maxRows * 22 + 12);
        } else if (shown > 0) {
          ctx.fillText("back", QX * CS, 26 + shown * 22 + 12);
        }
      };
    }

    var frames = [];
    events.forEach(function (ev) {
      var cap;
      if (ev.type === "start") {
        cap = "The deque holds one entry: the source, detour count 0. " +
              "Pops always occur at the front (top of the panel); the " +
              "insertion end depends on the move.";
      } else if (ev.type === "pop") {
        cap = "Pop from the front: (" + ev.cell.x + "," + ev.cell.y +
              "), detour count " + ev.d + ". The front always holds a " +
              "minimum-detour entry, so settling it preserves " +
              "optimality. The cell is settled (green).";
      } else {
        if (ev.pushed.length === 0) {
          cap = "No insertions: every neighbor of (" + ev.popped.x + "," +
                ev.popped.y + ") is a wall, settled, or already queued " +
                "at an equal or better detour count.";
        } else {
          var parts = ev.pushed.map(function (p) {
            return "(" + p.x + "," + p.y + ") " +
                   (p.end === "front"
                     ? "reduces the distance to T: cost 0, FRONT insert, d stays " + p.d
                     : "increases the distance to T: cost 1, BACK insert, d becomes " + p.d);
          });
          var vals = {};
          ev.deque.forEach(function (q) { vals[q.d] = true; });
          var kinds = Object.keys(vals).sort().join(" and ");
          cap = "Insert neighbors of (" + ev.popped.x + "," + ev.popped.y +
                ") (d = " + ev.dpop + "): " + parts.join("; ") +
                ". The deque now holds only detour value" +
                (Object.keys(vals).length > 1 ? "s " : " ") + kinds +
                ": at most two consecutive levels, sorted for free.";
        }
      }
      frames.push({ paint: paintEvent(ev, false), cap: cap });
    });
    frames.push({
      paint: paintEvent(events[events.length - 1], true),
      cap: "The target was popped at detour count " +
           settled[settled.length - 1].d + "; the parent chain is a " +
           "shortest path. The deque maintained sorted order by detour " +
           "count throughout, using only constant-time operations at its " +
           "two ends.",
    });
    return { frames: frames, w: 15, h: h, speed: 700 };
  };


  /* steiner gallery: multiple configurations, computed trees, and an
     obstacle re-embedding example */
  BUILD["steiner-gallery"] = function () {
    function mdist(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }

    function mst(points) {
      var n = points.length;
      var used = [0], edges = [], total = 0;
      var inTree = {}; inTree[0] = true;
      while (used.length < n) {
        var best = null;
        for (var i = 0; i < used.length; i++) {
          for (var j = 0; j < n; j++) {
            if (inTree[j]) continue;
            var d = mdist(points[used[i]], points[j]);
            if (!best || d < best.d) best = { a: used[i], b: j, d: d };
          }
        }
        inTree[best.b] = true;
        used.push(best.b);
        edges.push([points[best.a], points[best.b]]);
        total += best.d;
      }
      return { edges: edges, total: total };
    }

    /* exact rectilinear Steiner minimum tree for small pin sets:
       minimum, over Hanan-grid Steiner point subsets of size <= k, of
       the spanning-tree length on pins plus chosen points */
    function rsmt(pins, k) {
      var xs = {}, ys = {};
      pins.forEach(function (p) { xs[p.x] = 1; ys[p.y] = 1; });
      var hx = Object.keys(xs).map(Number), hy = Object.keys(ys).map(Number);
      var cands = [];
      hx.forEach(function (x) {
        hy.forEach(function (y) {
          if (!pins.some(function (p) { return p.x === x && p.y === y; }))
            cands.push({ x: x, y: y, steiner: true });
        });
      });
      var best = mst(pins);
      var bestPts = [];
      function trySubset(subset) {
        var t = mst(pins.concat(subset));
        if (t.total < best.total) { best = t; bestPts = subset.slice(); }
      }
      var m = cands.length;
      for (var a = 0; a < m; a++) {
        trySubset([cands[a]]);
        if (k >= 2) for (var b = a + 1; b < m; b++) {
          trySubset([cands[a], cands[b]]);
          if (k >= 3) for (var c = b + 1; c < m; c++)
            trySubset([cands[a], cands[b], cands[c]]);
        }
      }
      /* drop unused steiner points (degree < 3 not pruned; acceptable) */
      return { edges: best.edges, total: best.total, steiner: bestPts };
    }

    function lCells(p, q) {
      /* cells of the horizontal-then-vertical embedding of edge p-q */
      var cells = [];
      var x0 = Math.min(p.x, q.x), x1 = Math.max(p.x, q.x);
      for (var x = x0; x <= x1; x++) cells.push({ x: x, y: p.y });
      var y0 = Math.min(p.y, q.y), y1 = Math.max(p.y, q.y);
      for (var y = y0; y <= y1; y++) cells.push({ x: q.x, y: y });
      return cells;
    }

    function drawTree(ctx, tree, color, pinsList) {
      tree.edges.forEach(function (e) {
        polyline(ctx, [e[0], { x: e[1].x, y: e[0].y }, e[1]], color, 5);
      });
      (tree.steiner || []).forEach(function (s) {
        fillCell(ctx, s.x, s.y, TEAL, 0.5);
      });
      pinsList.forEach(function (p, i) {
        pin(ctx, p.x, p.y, PURPLE, String(i + 1));
      });
    }

    var pinsA = [{x:2,y:2},{x:7,y:3},{x:12,y:2},{x:4,y:8},{x:11,y:7}];
    var pinsB = [{x:2,y:2},{x:2,y:7},{x:7,y:5},{x:12,y:3},{x:12,y:8}];
    var pinsC = [{x:1,y:1},{x:4,y:3},{x:2,y:8},{x:6,y:6},
                 {x:9,y:2},{x:13,y:4},{x:11,y:8},{x:14,y:9}];

    var mstA = mst(pinsA), treeA = rsmt(pinsA, 3);
    var mstB = mst(pinsB), treeB = rsmt(pinsB, 3);
    /* net breaking for C: split by median x, solve halves, bridge */
    var sortedC = pinsC.slice().sort(function (a, b) { return a.x - b.x; });
    var leftC = sortedC.slice(0, 4), rightC = sortedC.slice(4);
    var tL = rsmt(leftC, 2), tR = rsmt(rightC, 2);
    var bridge = null;
    leftC.forEach(function (p) {
      rightC.forEach(function (q) {
        var d = mdist(p, q);
        if (!bridge || d < bridge.d) bridge = { p: p, q: q, d: d };
      });
    });
    var treeC = {
      edges: tL.edges.concat(tR.edges).concat([[bridge.p, bridge.q]]),
      steiner: tL.steiner.concat(tR.steiner),
      total: tL.total + tR.total + bridge.d,
    };

    /* obstacle example: macro placed on configuration A's plane */
    var MACRO = [];
    for (var mx = 6; mx <= 8; mx++)
      for (var my = 4; my <= 6; my++) MACRO.push([mx, my]);
    var macroSet = wallSet(MACRO);
    var extraLen = 0;
    var embeddedD = treeA.edges.map(function (e) {
      var blockedCells = lCells(e[0], e[1]).some(function (c) {
        return macroSet[c.x + "," + c.y];
      });
      if (!blockedCells) return { pts: [e[0], { x: e[1].x, y: e[0].y }, e[1]] };
      var pathCells = bfs(e[0], e[1], macroSet, W, H);
      extraLen += (pathCells.length - 1) - mdist(e[0], e[1]);
      return { pts: pathCells };
    });

    function paintPlain(fn) { return function (ctx) { base(ctx, W, H, []); fn(ctx); }; }

    var frames = [
      { paint: paintPlain(function (ctx) {
          pinsA.forEach(function (p, i) { pin(ctx, p.x, p.y, PURPLE, String(i + 1)); });
        }),
        cap: "Configuration A: five pins. The following frames compare " +
             "the best pin-to-pin tree with the optimal Steiner tree, " +
             "both computed exactly." },
      { paint: paintPlain(function (ctx) { drawTree(ctx, mstA, AMBER, pinsA); }),
        cap: "Configuration A, spanning tree (no Steiner points): " +
             "wirelength " + mstA.total + ". Wire may branch only at " +
             "pins." },
      { paint: paintPlain(function (ctx) { drawTree(ctx, treeA, TEAL, pinsA); }),
        cap: "Configuration A, optimal Steiner tree: wirelength " +
             treeA.total + " with " + treeA.steiner.length + " Steiner " +
             "point(s) (teal), computed by exhaustive search over " +
             "Hanan-grid junction candidates. Saving versus the spanning " +
             "tree: " + (mstA.total - treeA.total) + " units." },
      { paint: paintPlain(function (ctx) { drawTree(ctx, treeB, TEAL, pinsB); }),
        cap: "Configuration B: also five pins, different positions, " +
             "optimal wirelength " + treeB.total + " (spanning tree: " +
             mstB.total + "). The positional ordering of the pins " +
             "selects a different table group and a different optimal " +
             "topology: this is exactly the distinction FLUTE's table is " +
             "indexed by." },
      { paint: paintPlain(function (ctx) { drawTree(ctx, treeC, TEAL, pinsC); }),
        cap: "Eight pins: beyond FLUTE's exact-table degree on this " +
             "mock (and beyond degree 9 in the real tool), the net is " +
             "broken: each half is solved from the table and the halves " +
             "are bridged. Wirelength " + treeC.total + ", near-optimal " +
             "rather than exact." },
      { paint: function (ctx) {
          base(ctx, W, H, MACRO);
          embeddedD.forEach(function (seg2) {
            polyline(ctx, seg2.pts, TEAL, 5);
          });
          (treeA.steiner || []).forEach(function (s) {
            fillCell(ctx, s.x, s.y, TEAL, 0.5);
          });
          pinsA.forEach(function (p, i) { pin(ctx, p.x, p.y, PURPLE, String(i + 1)); });
        },
        cap: "Configuration A with a macro (gray). The table is " +
             "obstacle-blind: the topology is unchanged, and the router " +
             "embeds the blocked segment around the macro at a cost of " +
             extraLen + " extra unit(s). Severely blocked cases use " +
             "obstacle-avoiding Steiner constructions instead." },
    ];
    return { frames: frames, speed: 1400 };
  };

  /* ----- pattern routing: a library of shapes instead of a search ----- */
  BUILD["pattern-route"] = function () {
    var S = { x: 2, y: 7 }, T = { x: 12, y: 3 };
    var congCells = [[8, 7], [9, 7], [10, 7], [4, 3], [5, 3], [6, 3]];
    var congPrice = 2;
    var congSet = {};
    congCells.forEach(function (c) { congSet[c[0] + "," + c[1]] = true; });
    function cellsOf(pts) {
      var cells = [];
      for (var i = 1; i < pts.length; i++) {
        var a = pts[i - 1], b = pts[i];
        var dx = b.x > a.x ? 1 : b.x < a.x ? -1 : 0;
        var dy = b.y > a.y ? 1 : b.y < a.y ? -1 : 0;
        var x = a.x, y = a.y;
        while (x !== b.x || y !== b.y) { x += dx; y += dy; cells.push([x, y]); }
      }
      return cells;
    }
    function cost(pts) {
      var cells = cellsOf(pts), pen = 0;
      cells.forEach(function (c) {
        if (congSet[c[0] + "," + c[1]]) pen += congPrice;
      });
      return { wl: cells.length, pen: pen, total: cells.length + pen };
    }
    var L1 = [S, { x: T.x, y: S.y }, T];
    var L2 = [S, { x: S.x, y: T.y }, T];
    function Z(m) { return [S, { x: m, y: S.y }, { x: m, y: T.y }, T]; }
    var zs = [5, 7, 9].map(function (m) { return { m: m, pts: Z(m), c: cost(Z(m)) }; });
    var cL1 = cost(L1), cL2 = cost(L2);
    var best = zs.reduce(function (a, b) { return b.c.total < a.c.total ? b : a; });
    function paintPat(opts) {
      return function (ctx) {
        base(ctx, W, H, []);
        congCells.forEach(function (c) {
          fillCell(ctx, c[0], c[1], RED, 0.3);
          textCell(ctx, c[0], c[1], "+2", RED, true);
        });
        ctx.save();
        ctx.setLineDash([7, 6]);
        if (opts.ls) {
          polyline(ctx, L1, BLUE, CS * 0.14);
          polyline(ctx, L2, PURPLE, CS * 0.14);
        }
        if (opts.zs) {
          zs.forEach(function (z, i) {
            polyline(ctx, z.pts, [AMBER, GREEN, TEAL][i], CS * 0.14);
          });
        }
        ctx.restore();
        if (opts.commit) polyline(ctx, best.pts, GREEN, CS * 0.24);
        pin(ctx, S.x, S.y, GREEN_DEEP, "S");
        pin(ctx, T.x, T.y, BLUE, "T");
      };
    }
    return { frames: [
      {
        paint: paintPat({}),
        cap: "One net to route through a region other nets already " +
             "crowd: each red cell carries a congestion penalty of +2 " +
             "on top of its wirelength cost of 1. Pattern routing will " +
             "not search this grid at all; it prices a handful of " +
             "fixed shapes and picks the cheapest.",
      },
      {
        paint: paintPat({ ls: true }),
        cap: "The one-bend candidates: two L shapes. Upper L (violet): " +
             cL2.wl + " + " + cL2.pen + " = " + cL2.total +
             ". Lower L (blue): " + cL1.wl + " + " + cL1.pen + " = " +
             cL1.total + ". Both cross congested cells, and both cost " +
             "the same wirelength: only the penalties separate " +
             "candidates here.",
      },
      {
        paint: paintPat({ zs: true }),
        cap: "The two-bend candidates: Z shapes, one per bend column. " +
             zs.map(function (z, i) {
               return "Z at column " + z.m + ": " + z.c.wl + " + " +
                      z.c.pen + " = " + z.c.total;
             }).join(". ") + ". The Z at column " + best.m +
             " threads between both congested groups.",
      },
      {
        paint: paintPat({ commit: true }),
        cap: "The cheapest candidate commits: the Z at column " + best.m +
             " at cost " + best.c.total + ", pure wirelength with no " +
             "penalty. Evaluating a fixed shape is arithmetic, not " +
             "search: no queue, no wavefront, constant work per " +
             "candidate.",
      },
      {
        paint: paintPat({ commit: true }),
        cap: "The committed net now adds its own usage to the " +
             "congestion map that prices the next net's candidates. " +
             "Nets whose every pattern is blocked or over-congested, " +
             "typically a few percent, fall back to a real maze or " +
             "A* (A-star) search. Routing the bulk by patterns and " +
             "the remainder by search is why global routing is fast.",
      },
    ], speed: 1600 };
  };

  /* ----- corridor per net: what global routing hands to track assignment ----- */
  BUILD["corridor-idea"] = function () {
    /* fine grid at half cell size: 30 x 20 track positions in the
       15 x 10 canvas; GCells are 6 x 4 fine cells (5 x 5 GCells) */
    var FS = CS / 2, FW = 30, FH = 20, GW = 6, GH2 = 4;
    var N1 = { s: { x: 2,  y: 14 }, t: { x: 27, y: 6 }, color: GREEN,  name: "1" };
    var N2 = { s: { x: 9,  y: 17 }, t: { x: 21, y: 2 }, color: PURPLE, name: "2" };
    var C1 = [[0, 3], [1, 3], [2, 3], [3, 3], [3, 2], [3, 1], [4, 1]];
    var C2 = [[1, 4], [1, 3], [1, 2], [2, 2], [3, 2], [3, 1], [3, 0]];
    var PROW = 3; /* the panel: GCell row 3 = fine rows 12..15 */
    function inCorr(C, fx, fy) {
      var gx = Math.floor(fx / GW), gy = Math.floor(fy / GH2);
      return C.some(function (c) { return c[0] === gx && c[1] === gy; });
    }
    function bg(ctx) {
      ctx.fillStyle = "#fdfdfd";
      ctx.fillRect(0, 0, W * CS, H * CS);
      ctx.strokeStyle = "#ebe9e2";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (var x = 0; x <= FW; x++) { ctx.moveTo(x * FS, 0); ctx.lineTo(x * FS, FH * FS); }
      for (var y = 0; y <= FH; y++) { ctx.moveTo(0, y * FS); ctx.lineTo(FW * FS, y * FS); }
      ctx.stroke();
    }
    function gcellGrid(ctx) {
      ctx.save();
      ctx.strokeStyle = "rgba(26,29,38,0.4)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (var x = 0; x <= FW; x += GW) { ctx.moveTo(x * FS, 0); ctx.lineTo(x * FS, FH * FS); }
      for (var y = 0; y <= FH; y += GH2) { ctx.moveTo(0, y * FS); ctx.lineTo(FW * FS, y * FS); }
      ctx.stroke();
      ctx.restore();
    }
    function corridor(ctx, C, color) {
      C.forEach(function (g) {
        ctx.save();
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.16;
        ctx.fillRect(g[0] * GW * FS, g[1] * GH2 * FS, GW * FS, GH2 * FS);
        ctx.restore();
      });
    }
    function tracksInCorr(ctx, C, opts) {
      /* horizontal tracks (blue) and vertical tracks (green-grey) inside
         each corridor cell: the routing resources the guide reserves */
      opts = opts || {};
      ctx.save();
      ctx.lineWidth = 1;
      C.forEach(function (g) {
        var x0 = g[0] * GW, y0 = g[1] * GH2;
        if (!opts.vOnly) {
          ctx.strokeStyle = "rgba(47,111,237,0.55)";
          ctx.beginPath();
          for (var y = y0; y < y0 + GH2; y++) {
            ctx.moveTo(x0 * FS, y * FS + FS / 2);
            ctx.lineTo((x0 + GW) * FS, y * FS + FS / 2);
          }
          ctx.stroke();
        }
        if (!opts.hOnly) {
          ctx.strokeStyle = "rgba(22,163,74,0.5)";
          ctx.beginPath();
          for (var x = x0; x < x0 + GW; x++) {
            ctx.moveTo(x * FS + FS / 2, y0 * FS);
            ctx.lineTo(x * FS + FS / 2, (y0 + GH2) * FS);
          }
          ctx.stroke();
        }
      });
      ctx.restore();
    }
    function fpin(ctx, p, color, label) {
      ctx.beginPath();
      ctx.arc(p.x * FS + FS / 2, p.y * FS + FS / 2, 6, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 9px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, p.x * FS + FS / 2, p.y * FS + FS / 2 + 0.5);
      ctx.textBaseline = "alphabetic";
    }
    function pins(ctx, nets) {
      nets.forEach(function (n) {
        fpin(ctx, n.s, n.color, n.name);
        fpin(ctx, n.t, n.color, n.name);
      });
    }
    function fseg(ctx, x0, y0, x1, y1, color, w, dash) {
      ctx.save();
      if (dash) ctx.setLineDash([5, 4]);
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x0 * FS + FS / 2, y0 * FS + FS / 2);
      ctx.lineTo(x1 * FS + FS / 2, y1 * FS + FS / 2);
      ctx.stroke();
      ctx.restore();
    }
    function highlightPanel(ctx) {
      ctx.save();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.strokeRect(1, PROW * GH2 * FS + 1, FW * FS - 2, GH2 * FS - 2);
      ctx.restore();
      ctx.font = "11px 'JetBrains Mono', monospace";
      ctx.textAlign = "left";
      ctx.fillStyle = INK;
      ctx.fillText("panel: 4 horizontal tracks", 6, PROW * GH2 * FS - 5);
    }
    function via(ctx, x, y) {
      ctx.fillStyle = INK;
      ctx.fillRect(x * FS + FS / 2 - 3.5, y * FS + FS / 2 - 3.5, 7, 7);
    }
    /* net 1's trunk inside the panel: fine rows 12..15, columns 2..21 */
    var T1 = { l: 2, r: 21 };
    var frames = [
      {
        paint: function (ctx) { bg(ctx); pins(ctx, [N1]); },
        cap: "One net at die scale: a driver pin and a sink pin, and " +
             "between them a die of track positions (fine grid), " +
             "billions on a real chip. Detailed routing cannot search " +
             "all of it per net; global routing exists to narrow the " +
             "search first.",
      },
      {
        paint: function (ctx) { bg(ctx); gcellGrid(ctx); pins(ctx, [N1]); },
        cap: "Global routing coarsens the die into GCells (heavy grid). " +
             "Each GCell here spans 6 columns by 4 rows of track " +
             "positions; in production, thousands. Routing at this " +
             "resolution is cheap enough to do for every net.",
      },
      {
        paint: function (ctx) {
          bg(ctx); gcellGrid(ctx); corridor(ctx, C1, N1.color); pins(ctx, [N1]);
        },
        cap: "The corridor: global routing's answer for net 1 is this " +
             "chain of GCells (green), chosen for low congestion and " +
             "short length. It says which coarse cells the wire may " +
             "pass through and nothing more: no track, no exact " +
             "coordinate. This is the route guide.",
      },
      {
        paint: function (ctx) {
          bg(ctx); gcellGrid(ctx); corridor(ctx, C1, N1.color);
          tracksInCorr(ctx, C1); pins(ctx, [N1]);
        },
        cap: "What a corridor cell actually contains: routing tracks on " +
             "two layers. Horizontal tracks (blue) on one metal layer, " +
             "4 per GCell here, and vertical tracks (green) on the layer " +
             "above, 6 per GCell. The guide reserves capacity on both; " +
             "which specific track the wire takes is still open.",
      },
      {
        paint: function (ctx) {
          bg(ctx); gcellGrid(ctx); corridor(ctx, C1, N1.color);
          tracksInCorr(ctx, C1, { hOnly: true }); highlightPanel(ctx);
          pins(ctx, [N1]);
        },
        cap: "Zoom into one GCell row: the panel of the horizontal " +
             "layer, 4 tracks tall. Net 1's corridor spans columns 0 to " +
             "23 of it, so its long horizontal run may sit on any of the " +
             "4 tracks anywhere in that span. The corridor is a band of " +
             "tracks, not a wire.",
      },
      {
        paint: function (ctx) {
          bg(ctx); gcellGrid(ctx); corridor(ctx, C1, N1.color);
          tracksInCorr(ctx, C1, { hOnly: true }); highlightPanel(ctx);
          fseg(ctx, T1.l, 12, T1.r, 12, N1.color, 3, true);
          fseg(ctx, T1.l, 13, T1.r, 13, N1.color, 5);
          fseg(ctx, T1.l, 14, T1.r, 14, N1.color, 3, true);
          fseg(ctx, T1.l, 15, T1.r, 15, N1.color, 3, true);
          pins(ctx, [N1]);
        },
        cap: "Inside the corridor the net still has a choice: its trunk " +
             "on any of the 4 tracks (one drawn solid, the others " +
             "dashed). All four are legal by the guide. Choosing " +
             "between them, for every net in the panel at once, is the " +
             "job of track assignment.",
      },
      {
        paint: function (ctx) {
          bg(ctx); gcellGrid(ctx);
          corridor(ctx, C1, N1.color); corridor(ctx, C2, N2.color);
          tracksInCorr(ctx, C1, { hOnly: true }); highlightPanel(ctx);
          pins(ctx, [N1, N2]);
        },
        cap: "A second net: net 2's corridor (violet) crosses the same " +
             "panel vertically at GCell column 1, and the two corridors " +
             "overlap in that cell. Overlap of guides is normal, guides " +
             "only promise capacity, but the exact wires inside must not " +
             "touch. That is where tracks get decided.",
      },
      {
        paint: function (ctx) {
          bg(ctx); gcellGrid(ctx);
          corridor(ctx, C1, N1.color); corridor(ctx, C2, N2.color);
          tracksInCorr(ctx, C1, { hOnly: true }); highlightPanel(ctx);
          /* net 1, complete: pin (2,14) up to trunk row 13, trunk to
             column 21, up column 21 on the vertical layer through GCell
             rows 3..1, then right along row 6 to pin (27,6) */
          fseg(ctx, N1.s.x, N1.s.y, N1.s.x, 13, N1.color, 5);
          fseg(ctx, T1.l, 13, T1.r, 13, N1.color, 5);
          fseg(ctx, T1.r, 13, T1.r, 6, N1.color, 5);
          fseg(ctx, T1.r, 6, N1.t.x, 6, N1.color, 5);
          /* net 2, complete: pin (9,17) up column 9 through GCell rows
             4..2, right along row 9 to column 21, up column 21 through
             GCell rows 2..0 to pin (21,2) */
          fseg(ctx, 9, 17, 9, 9, N2.color, 5);
          fseg(ctx, 9, 9, 19, 9, N2.color, 5);
          fseg(ctx, 19, 9, 19, 2, N2.color, 5);
          fseg(ctx, 19, 2, N2.t.x, 2, N2.color, 5);
          via(ctx, T1.l, 13); via(ctx, T1.r, 13); via(ctx, T1.r, 6);
          via(ctx, 9, 9); via(ctx, 19, 9); via(ctx, 19, 2);
          pins(ctx, [N1, N2]);
        },
        cap: "Resolved, both nets complete: net 1's trunk is assigned " +
             "to track 2 of the panel, and net 2's vertical run crosses " +
             "it on the vertical layer (crossings on different layers " +
             "are legal). The black squares are the vias where each net " +
             "changes layer. Each net stayed inside its corridor; only " +
             "exact positions were fixed. The walkthrough further down " +
             "does this for a whole panel.",
      },
    ];
    /* containment checks: every drawn wire cell lies in its corridor */
    var ok = true;
    for (var y0 = 13; y0 <= N1.s.y; y0++) ok = ok && inCorr(C1, N1.s.x, y0);
    for (var x = T1.l; x <= T1.r; x++) ok = ok && inCorr(C1, x, 13);
    for (var y1 = 6; y1 <= 13; y1++) ok = ok && inCorr(C1, T1.r, y1);
    for (var x1 = T1.r; x1 <= N1.t.x; x1++) ok = ok && inCorr(C1, x1, 6);
    for (var y = 9; y <= 17; y++) ok = ok && inCorr(C2, 9, y);
    for (var x2 = 9; x2 <= 19; x2++) ok = ok && inCorr(C2, x2, 9);
    for (var y2 = 2; y2 <= 9; y2++) ok = ok && inCorr(C2, 19, y2);
    for (var x3 = 19; x3 <= N2.t.x; x3++) ok = ok && inCorr(C2, x3, 2);
    /* no same-layer overlap: net 1 vertical on column 21 rows 6..13,
       net 2 vertical on column 19 rows 2..9; horizontals on rows 13, 6
       (net 1) and 9, 2 (net 2): disjoint */
    if (!ok && typeof console !== "undefined") console.warn("corridor-idea: wire leaves corridor");
    return { frames: frames, speed: 2000 };
  };

  /* ----- track assignment: iroutes onto tracks, left-edge reborn ----- */
  BUILD["track-assign"] = function () {
    /* same fine scale as the corridor figure above: 15 px cells,
       30 columns; a 4-track panel between pin rows */
    var FS = CS / 2, FW = 30;
    var FH = 14;                       /* fine rows drawn */
    var PANEL = { y0: 5, y1: 8 };      /* 4 tracks: fine rows 5..8 */
    var PIN_TOP = 1, PIN_BOT = 12;
    var CH = FH * FS / CS;             /* canvas height in CS units */
    /* five nets crossing the panel, listed unsorted the way a router
       meets them; extents in fine columns */
    var netsIn = [
      { name: "C", pl: { x: 8,  y: PIN_BOT }, pr: { x: 24, y: PIN_TOP }, color: BLUE },
      { name: "A", pl: { x: 1,  y: PIN_TOP }, pr: { x: 12, y: PIN_BOT }, color: GREEN },
      { name: "E", pl: { x: 20, y: PIN_BOT }, pr: { x: 27, y: PIN_TOP }, color: TEAL },
      { name: "B", pl: { x: 4,  y: PIN_TOP }, pr: { x: 18, y: PIN_BOT }, color: PURPLE },
      { name: "D", pl: { x: 14, y: PIN_BOT }, pr: { x: 29, y: PIN_TOP }, color: AMBER },
    ];
    netsIn.forEach(function (n) { n.l = n.pl.x; n.r = n.pr.x; });
    var sorted = netsIn.slice().sort(function (a, b) { return a.l - b.l; });
    var trackEnd = [], lastName = [], placed = [];
    sorted.forEach(function (n) {
      var ends = trackEnd.slice(), names = lastName.slice();
      var t = 0;
      while (t < trackEnd.length && trackEnd[t] >= n.l) t++;
      var opened = t === trackEnd.length;
      if (opened) { trackEnd.push(n.r); lastName.push(n.name); }
      else { trackEnd[t] = n.r; lastName[t] = n.name; }
      n.track = t;
      placed.push({ net: n, track: t, opened: opened, ends: ends, names: names });
    });
    var trackY = function (t) { return PANEL.y0 + t; };
    var floatY = function (i) { return PANEL.y0 - 0.2 + i * 1.05; };

    function bg(ctx) {
      ctx.fillStyle = "#fdfdfd";
      ctx.fillRect(0, 0, W * CS, CH * CS);
      ctx.strokeStyle = "#ebe9e2";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (var x = 0; x <= FW; x++) { ctx.moveTo(x * FS, 0); ctx.lineTo(x * FS, FH * FS); }
      for (var y = 0; y <= FH; y++) { ctx.moveTo(0, y * FS); ctx.lineTo(FW * FS, y * FS); }
      ctx.stroke();
    }
    function panelFrame(ctx) {
      ctx.save();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.strokeRect(1, PANEL.y0 * FS + 1, FW * FS - 2, 4 * FS - 2);
      ctx.restore();
      ctx.font = "11px 'JetBrains Mono', monospace";
      ctx.textAlign = "left";
      ctx.fillStyle = INK;
      ctx.fillText("panel: 4 horizontal tracks", 6, PANEL.y0 * FS - 5);
    }
    function tracks(ctx) {
      ctx.save();
      ctx.strokeStyle = "rgba(47,111,237,0.55)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (var t = 0; t < 4; t++) {
        ctx.moveTo(0, trackY(t) * FS + FS / 2);
        ctx.lineTo(FW * FS, trackY(t) * FS + FS / 2);
      }
      ctx.stroke();
      ctx.restore();
      ctx.font = "10px 'JetBrains Mono', monospace";
      ctx.textAlign = "right";
      ctx.fillStyle = MUT;
      for (var t2 = 0; t2 < 4; t2++) {
        ctx.fillText("t" + (t2 + 1), FW * FS - 3, trackY(t2) * FS + FS / 2 + 3.5);
      }
    }
    function fpin(ctx, p, color, label) {
      ctx.beginPath();
      ctx.arc(p.x * FS + FS / 2, p.y * FS + FS / 2, 6, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 9px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, p.x * FS + FS / 2, p.y * FS + FS / 2 + 0.5);
      ctx.textBaseline = "alphabetic";
    }
    function pins(ctx) {
      netsIn.forEach(function (n) {
        fpin(ctx, n.pl, n.color, n.name);
        fpin(ctx, n.pr, n.color, n.name);
      });
    }
    function guides(ctx) {
      netsIn.forEach(function (n) {
        ctx.save();
        ctx.fillStyle = n.color;
        ctx.globalAlpha = 0.13;
        ctx.fillRect(n.l * FS, (PIN_TOP + 0.5) * FS, (n.r - n.l + 1) * FS,
                     (PIN_BOT - PIN_TOP) * FS);
        ctx.restore();
      });
    }
    function fseg(ctx, x0, y0, x1, y1, color, w, dash) {
      ctx.save();
      if (dash) ctx.setLineDash([5, 4]);
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x0 * FS + FS / 2, y0 * FS + FS / 2);
      ctx.lineTo(x1 * FS + FS / 2, y1 * FS + FS / 2);
      ctx.stroke();
      ctx.restore();
    }
    function via(ctx, x, y) {
      ctx.fillStyle = INK;
      ctx.fillRect(x * FS + FS / 2 - 3.5, y * FS + FS / 2 - 3.5, 7, 7);
    }
    function label(ctx, n, y) {
      ctx.font = "bold 10px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = n.color;
      var lx = n.l === 0 ? n.r + 1 : n.l - 1;
      ctx.fillText(n.name, lx * FS + FS / 2, y * FS + FS / 2 + 3.5);
    }
    function iroute(ctx, n, y, thick) {
      fseg(ctx, n.l, y, n.r, y, n.color, thick || 4);
      label(ctx, n, y);
    }
    function stubs(ctx, n, y) {
      fseg(ctx, n.pl.x, n.pl.y, n.pl.x, y, n.color, 2, true);
      fseg(ctx, n.pr.x, n.pr.y, n.pr.x, y, n.color, 2, true);
    }
    function paintPlaced(upto, opts) {
      opts = opts || {};
      return function (ctx) {
        bg(ctx);
        if (opts.guides) guides(ctx);
        panelFrame(ctx);
        tracks(ctx);
        for (var i = 0; i <= upto && i < placed.length; i++) {
          var p = placed[i];
          iroute(ctx, p.net, trackY(p.track), i === upto && !opts.done ? 5 : 4);
          via(ctx, p.net.l, trackY(p.track));
          via(ctx, p.net.r, trackY(p.track));
          if (opts.stubs) stubs(ctx, p.net, trackY(p.track));
        }
        pins(ctx);
      };
    }
    function cap1(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
    function taCap(p, k) {
      var head = "Step 2, placement " + k + ": iroute " + p.net.name +
                 ", extent [" + p.net.l + ", " + p.net.r + "]. ";
      if (p.ends.length === 0) {
        return head + "No track holds anything yet: it takes track 1, " +
               "and its endpoints are marked as future vias (black " +
               "squares) where the pin connections will land.";
      }
      var fails = [];
      for (var t = 0; t < p.track; t++) {
        fails.push("track " + (t + 1) + " is occupied through column " +
                   p.ends[t] + " (" + p.names[t] + ")");
      }
      if (p.opened) {
        return head + cap1(fails.join(" and ")) + ": every occupied " +
               "track overlaps its extent, so it takes the next free " +
               "track, t" + (p.track + 1) + ".";
      }
      var ok = "track " + (p.track + 1) + " is free past column " +
               p.ends[p.track] + " (" + p.names[p.track] + "), left of " +
               "column " + p.net.l;
      if (fails.length) return head + cap1(fails.join(" and ")) + "; but " + ok + ": it goes there.";
      return head + cap1(ok) + ": it goes there.";
    }

    var frames = [];
    frames.push({
      paint: function (ctx) { bg(ctx); guides(ctx); pins(ctx); },
      cap: "What global routing handed over: five nets, each with a pin " +
           "above and a pin below this strip of the die, and each with a " +
           "route guide (tinted band) that says which columns its wire " +
           "may occupy. No track has been chosen for anything; the guide " +
           "is a corridor, not a coordinate.",
    });
    frames.push({
      paint: function (ctx) { bg(ctx); guides(ctx); panelFrame(ctx); tracks(ctx); pins(ctx); },
      cap: "The panel: one GCell row of the horizontal layer, 4 tracks " +
           "(blue, t1 to t4), the same panel the figure above zoomed " +
           "into. Every horizontal wire in this strip must sit on one of " +
           "them; the detail router's expensive search space is track by " +
           "track, cell by cell.",
    });
    frames.push({
      paint: function (ctx) {
        bg(ctx); guides(ctx); panelFrame(ctx); tracks(ctx);
        netsIn.forEach(function (n, i) { iroute(ctx, n, floatY(i), 3); });
        pins(ctx);
      },
      cap: "Step 1 (extract): inside each guide, the long horizontal run " +
           "between the net's two pin columns is its iroute, drawn " +
           "floating within its guide, unassigned. Its extent [l, r] is " +
           "fixed by the pin columns; only its track is free. Two " +
           "iroutes conflict when their extents overlap.",
    });
    frames.push({
      paint: function (ctx) {
        bg(ctx); panelFrame(ctx); tracks(ctx);
        sorted.forEach(function (n, i) { iroute(ctx, n, floatY(i), 3); });
        pins(ctx);
      },
      cap: "Step 1 (sort): the iroutes ordered by left endpoint, top to " +
           "bottom: " + sorted.map(function (n) {
             return n.name + " [" + n.l + ", " + n.r + "]";
           }).join(", ") + ". This ordering is the whole preparation for " +
           "the sweep.",
    });
    placed.forEach(function (p, i) {
      frames.push({ paint: paintPlaced(i), cap: taCap(p, i + 1) });
    });
    frames.push({
      paint: paintPlaced(placed.length - 1, { guides: true, done: true }),
      cap: "All five iroutes assigned on " + trackEnd.length + " of the 4 " +
           "tracks, every one inside its guide (bands re-shown). One " +
           "sorted sweep did the bulk of the routing: the left-edge " +
           "greedy, alive inside the modern flow. Nothing is connected " +
           "to a pin yet.",
    });
    frames.push({
      paint: paintPlaced(placed.length - 1, { stubs: true, done: true }),
      cap: "Step 3 (hand off): the assigned trunks are fixed. The " +
           "point-to-point detail search now does only the short work: " +
           "the pin-to-trunk connections (dashed stubs, on the vertical " +
           "layer, landing on the vias) and any local rule repair. Long " +
           "searches were replaced by one sort and one sweep.",
    });
    return { frames: frames, h: CH, speed: 1600 };
  };

  /* ----- layer assignment and via minimization ----- */
  BUILD["layer-assign"] = function () {
    /* one fixed 2D route (never changes); only the layer of each
       segment changes across the frames. Layers: M2 horizontal thin,
       M3 vertical thin, M4 horizontal thin (used to keep an
       already-horizontal run without a via), M6 horizontal thick. */
    /* GCells are 2 x 2 fine cells (7 x 5 GCells); the route is a chain
       of GCell centers (odd coordinates), the way a global route is:
       one collapsed 2D plane, no layers, no tracks */
    var FS = CS / 2, FW = 30, FH = 20; /* fine grid: 30 x 20 track cells */
    var GC = 5;                          /* GCell = 5 x 5 fine cells: 6 x 4 GCells */
    /* GCell centers are at 2 + 5i, 2 + 5j; the route is a chain of them */
    var pts = [{ x: 2, y: 17 }, { x: 7, y: 17 }, { x: 7, y: 12 }, { x: 12, y: 12 },
               { x: 12, y: 7 }, { x: 27, y: 7 }, { x: 27, y: 2 }];
    function gcellsOnRoute() {
      var cells = {};
      for (var k = 1; k < pts.length; k++) {
        var a = pts[k - 1], b = pts[k];
        var dx = Math.sign(b.x - a.x), dy = Math.sign(b.y - a.y);
        var x = a.x, y = a.y;
        cells[Math.floor(x / GC) + "," + Math.floor(y / GC)] = true;
        while (x !== b.x || y !== b.y) {
          x += dx; y += dy;
          cells[Math.floor(x / GC) + "," + Math.floor(y / GC)] = true;
        }
      }
      return Object.keys(cells).map(function (s) {
        var p = s.split(",");
        return [parseInt(p[0], 10), parseInt(p[1], 10)];
      });
    }
    var CORR = gcellsOnRoute();
    function fineGrid(ctx) {
      ctx.fillStyle = "#fdfdfd";
      ctx.fillRect(0, 0, W * CS, H * CS);
      ctx.strokeStyle = "#ebe9e2";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (var x = 0; x <= FW; x++) { ctx.moveTo(x * FS, 0); ctx.lineTo(x * FS, FH * FS); }
      for (var y = 0; y <= FH; y++) { ctx.moveTo(0, y * FS); ctx.lineTo(FW * FS, y * FS); }
      ctx.stroke();
    }
    function gcellGrid(ctx) {
      ctx.save();
      ctx.strokeStyle = "rgba(26,29,38,0.4)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (var x = 0; x <= FW; x += GC) { ctx.moveTo(x * FS, 0); ctx.lineTo(x * FS, FH * FS); }
      for (var y = 0; y <= FH; y += GC) { ctx.moveTo(0, y * FS); ctx.lineTo(FW * FS, y * FS); }
      ctx.stroke();
      ctx.restore();
    }
    function corridor(ctx) {
      CORR.forEach(function (g) {
        ctx.save();
        ctx.fillStyle = GREEN;
        ctx.globalAlpha = 0.14;
        ctx.fillRect(g[0] * GC * FS, g[1] * GC * FS, GC * FS, GC * FS);
        ctx.restore();
      });
    }
    function fseg(ctx, x0, y0, x1, y1, color, w, dash) {
      ctx.save();
      if (dash) ctx.setLineDash([5, 4]);
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x0 * FS + FS / 2, y0 * FS + FS / 2);
      ctx.lineTo(x1 * FS + FS / 2, y1 * FS + FS / 2);
      ctx.stroke();
      ctx.restore();
    }
    function fpin(ctx, p, color, label) {
      ctx.beginPath();
      ctx.arc(p.x * FS + FS / 2, p.y * FS + FS / 2, 6.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 9px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, p.x * FS + FS / 2, p.y * FS + FS / 2 + 0.5);
      ctx.textBaseline = "alphabetic";
    }
    var segs = [];
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i];
      segs.push({ a: a, b: b, len: Math.abs(b.x - a.x) + Math.abs(b.y - a.y),
                  horiz: a.y === b.y });
    }
    var LAYER = {
      M2: { color: BLUE,   r: 1.0,  w: 3.5, name: "M2 horizontal thin" },
      M3: { color: GREEN,  r: 1.0,  w: 3.5, name: "M3 vertical thin" },
      M6: { color: AMBER,  r: 0.25, w: 7,   name: "M6 horizontal thick" },
    };
    var VIA = 0.5; /* resistance units per via, the v in the objective */
    var QX = 15.5;
    function viaCount(assign) {
      var n = 0;
      for (var k = 1; k < assign.length; k++) if (assign[k] !== assign[k - 1]) n++;
      return n;
    }
    /* a via stack between thin M2/M3 and thick M6 spans several layers;
       count it as 2 vias of resistance */
    function viaRes(assign) {
      var r = 0;
      for (var k = 1; k < assign.length; k++) {
        if (assign[k] === assign[k - 1]) continue;
        var thickChange = assign[k] === "M6" || assign[k - 1] === "M6";
        r += VIA * (thickChange ? 2 : 1);
      }
      return r;
    }
    function wireRes(assign) {
      var r = 0;
      segs.forEach(function (s, k) { r += s.len * LAYER[assign[k]].r; });
      return r;
    }
    function total(assign) { return wireRes(assign) + viaRes(assign); }
    function fmt(x) { return Math.round(x * 100) / 100; }

    var naive = segs.map(function (s) { return s.horiz ? "M2" : "M3"; });
    /* via minimization keeps the geometry and only re-assigns layers:
       the two short horizontal stubs (segments 1 and 3) are allowed on
       M3 as short wrong-way runs, so segments 1..4 become one
       continuous M3 stretch with no via inside it */
    var merged = naive.slice();
    merged[0] = "M3"; merged[2] = "M3";
    var promoted = merged.slice();
    promoted[4] = "M6"; /* the long horizontal run */

    function legend(ctx, showThick, note) {
      ctx.textAlign = "left";
      ctx.font = "bold 11px 'JetBrains Mono', monospace";
      ctx.fillStyle = INK;
      ctx.fillText("layer stack", QX * CS, 16);
      ctx.font = "11px 'JetBrains Mono', monospace";
      var y = 40;
      ["M2", "M3", "M6"].forEach(function (L) {
        if (L === "M6" && !showThick) return;
        ctx.strokeStyle = LAYER[L].color;
        ctx.lineWidth = LAYER[L].w;
        ctx.beginPath();
        ctx.moveTo(QX * CS, y); ctx.lineTo(QX * CS + 30, y);
        ctx.stroke();
        ctx.fillStyle = MUT;
        ctx.fillText(LAYER[L].name, QX * CS + 40, y - 2);
        ctx.fillText("r = " + LAYER[L].r + " per cell", QX * CS + 40, y + 12);
        y += 40;
      });
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(QX * CS + 8, y - 5, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = MUT;
      ctx.fillText("via, r = " + VIA + " (x2 to M6)", QX * CS + 22, y - 1);
      if (note) {
        y += 22;
        ctx.fillStyle = INK;
        ctx.font = "bold 11px 'JetBrains Mono', monospace";
        note.forEach(function (line, k) {
          ctx.fillStyle = k === 0 ? INK : MUT;
          ctx.font = (k === 0 ? "bold " : "") + "11px 'JetBrains Mono', monospace";
          ctx.fillText(line, QX * CS, y + k * 15);
        });
      }
    }
    function drawAssign(ctx, assign, upto, hl) {
      segs.forEach(function (s, k) {
        if (upto !== undefined && k > upto) {
          fseg(ctx, s.a.x, s.a.y, s.b.x, s.b.y, "#bdbab0", 2.5, true);
          return;
        }
        var L = LAYER[assign[k]];
        fseg(ctx, s.a.x, s.a.y, s.b.x, s.b.y, L.color, k === hl ? L.w + 3 : L.w);
      });
      for (var k = 1; k < segs.length; k++) {
        if (upto !== undefined && k > upto) break;
        if (assign[k] !== assign[k - 1]) {
          var p = segs[k].a;
          ctx.beginPath();
          ctx.arc(p.x * FS + FS / 2, p.y * FS + FS / 2, 4.5, 0, Math.PI * 2);
          ctx.fillStyle = INK;
          ctx.fill();
        }
      }
    }
    function paint(opts) {
      return function (ctx) {
        ctx.fillStyle = "#fdfdfd";
        ctx.fillRect(0, 0, 21 * CS, H * CS);
        fineGrid(ctx);
        gcellGrid(ctx);
        corridor(ctx);
        if (opts.corridorOnly) {
          /* nothing else: the corridor is the whole global result */
        } else if (opts.raw) {
          for (var k = 0; k < segs.length; k++) {
            fseg(ctx, segs[k].a.x, segs[k].a.y, segs[k].b.x, segs[k].b.y, INK, 3);
          }
        } else {
          drawAssign(ctx, opts.assign, opts.upto, opts.hl);
        }
        fpin(ctx, pts[0], GREEN_DEEP, "S");
        fpin(ctx, pts[pts.length - 1], BLUE, "T");
        legend(ctx, !!opts.thick, opts.note);
      };
    }
    function costNote(title, assign) {
      return [title,
              "wire  " + fmt(wireRes(assign)),
              "vias  " + viaCount(assign) + " -> " + fmt(viaRes(assign)),
              "total " + fmt(total(assign))];
    }
    var wlTotal = segs.reduce(function (a, s) { return a + s.len; }, 0);
    var frames = [
      {
        paint: paint({ corridorOnly: true }),
        cap: "The input, seen from above (plan view: the layers stack " +
             "toward the viewer). Global routing produced this net's " +
             "corridor: a chain of GCells (heavy grid, green cells, " +
             "each 5 x 5 track positions) from S to T, with all metal " +
             "layers collapsed into one plane. Nothing yet says which " +
             "layer, or which of the tracks inside a cell, any part of " +
             "the wire will use.",
      },
      {
        paint: paint({ raw: true }),
        cap: "The 2D route: the corridor's cells connected center to " +
             "center, " + segs.length + " straight segments, " +
             wlTotal + " cells long. Each straight segment is a run " +
             "of GCells in one direction; each corner is where the " +
             "corridor turns. No segment has a layer, so nothing has " +
             "a resistance and no via exists yet.",
      },
      {
        paint: paint({ raw: true }),
        cap: "The layer stack (right): M2 carries horizontal wires, M3 " +
             "vertical wires, both thin at resistance 1.0 per cell. A " +
             "via connects adjacent layers at a cost of " + VIA + " " +
             "resistance units and blocks a track on both layers. " +
             "Layer assignment must give every segment a layer that " +
             "matches its direction, or pay a wrong-way penalty.",
      },
      {
        paint: paint({ assign: naive, upto: 1, hl: 1 }),
        cap: "Step 2 (assign), the naive rule: each segment takes the " +
             "layer whose preferred direction it runs in. Segment 1 is " +
             "horizontal, so M2 (blue); segment 2 is vertical, so M3 " +
             "(green). The direction changes, so a via (dot) is needed " +
             "at their corner.",
      },
      {
        paint: paint({ assign: naive, upto: 3, hl: 3 }),
        cap: "The staircase continues: horizontal on M2, vertical on " +
             "M3, alternating. Every corner in the staircase becomes a " +
             "layer change, so the four short segments cost three " +
             "vias among them.",
      },
      {
        paint: paint({ assign: naive, note: costNote("naive assignment", naive) }),
        cap: "The naive assignment complete: " + viaCount(naive) +
             " vias. Cost per the objective: wire " + fmt(wireRes(naive)) +
             " (" + wlTotal + " cells at 1.0) plus vias " +
             fmt(viaRes(naive)) + " (" + viaCount(naive) + " at " + VIA +
             "), total " + fmt(total(naive)) + ". Every via also " +
             "blocks a track on two layers for every other net.",
      },
      {
        paint: paint({ assign: merged, hl: 0, note: costNote("after via minimization", merged) }),
        cap: "Via minimization, same geometry: the two short horizontal " +
             "stubs are re-assigned to M3 as short wrong-way segments, " +
             "so segments 1 to 4 become one continuous M3 stretch with " +
             "no layer change inside it. " +
             (viaCount(naive) - viaCount(merged)) + " vias vanish: " +
             viaCount(naive) + " become " + viaCount(merged) +
             ", total " + fmt(total(naive)) + " to " + fmt(total(merged)) +
             ". Short wrong-way runs are the standard price for " +
             "removing vias.",
      },
      {
        paint: paint({ assign: merged, thick: true, note: costNote("after via minimization", merged) }),
        cap: "The stack has a top: M6 (amber), thick horizontal metal " +
             "at resistance 0.25 per cell, a quarter of M2. Reaching it " +
             "from M3 needs a via stack through the layers between, " +
             "counted here as two vias' worth of resistance at each " +
             "end.",
      },
      {
        paint: paint({ assign: promoted, thick: true, hl: 4, note: costNote("promoted to M6", promoted) }),
        cap: "Promotion: the long " + segs[4].len + "-cell run moves " +
             "from M2 to M6. Its wire resistance falls from " +
             fmt(segs[4].len * LAYER.M2.r) + " to " +
             fmt(segs[4].len * LAYER.M6.r) + "; the taller via stacks " +
             "add " + fmt(viaRes(promoted) - viaRes(merged)) +
             ". Net: total " + fmt(total(merged)) + " to " +
             fmt(total(promoted)) + ". Worth it for a long run, not for " +
             "a short one, which is exactly what the objective decides.",
      },
      {
        paint: paint({ assign: promoted, thick: true, note: costNote("promoted to M6", promoted) }),
        cap: "The decision rule per segment: choose the layer minimizing " +
             "r(layer) x length plus the via cost implied by the " +
             "neighbours' layers, subject to each layer's per-region " +
             "capacity. Because a segment's via cost depends on its " +
             "neighbours, the choices are coupled along the route.",
      },
      {
        paint: paint({ assign: promoted, thick: true, note: costNote("promoted to M6", promoted) }),
        cap: "That coupling is why production routers solve it by " +
             "dynamic programming: walk the net's tree, and for every " +
             "segment and every legal layer keep the cheapest cost of " +
             "everything before it. The best leaf-to-root combination is " +
             "exact for that net under the current capacities: the " +
             "FastRoute 4.0 formulation.",
      },
    ];
    return { frames: frames, w: 21, speed: 1800 };
  };

  /* ----- gridless (shape-based) detailed routing ----- */
  BUILD["gridless-route"] = function () {
    var GH = 8;
    var OBS = { x0: 6, y0: 3, x1: 8, y1: 4 }; /* macro, in cells */
    var S = { x: 1, y: 4 };
    var TGRID = { x: 13, y: 4 };
    var PIN = { x: 13, y: 4.45 }; /* off-grid macro pin */
    /* expanded spacing band around the macro, in center-coordinates */
    var BAND = { x0: 5, y0: 2, x1: 9, y1: 5 };
    var onGrid = [{ x: 1, y: 4 }, { x: 4, y: 4 }, { x: 4, y: 5 },
                  { x: 10, y: 5 }, { x: 10, y: 4 }, { x: 13, y: 4 }];
    var free = [{ x: 1, y: 4 }, { x: BAND.x0, y: 4 },
                { x: BAND.x0, y: BAND.y1 }, { x: BAND.x1, y: BAND.y1 },
                { x: BAND.x1, y: PIN.y }, { x: PIN.x, y: PIN.y }];
    function scene(ctx, opts) {
      base(ctx, W, GH, []);
      if (opts.tracks) {
        ctx.save();
        ctx.setLineDash([4, 6]);
        ctx.strokeStyle = "rgba(26,29,38,0.3)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (var y = 2; y <= 6; y++) {
          ctx.moveTo(0, y * CS + CS / 2);
          ctx.lineTo(W * CS, y * CS + CS / 2);
        }
        ctx.stroke();
        ctx.restore();
      }
      if (opts.lattice) {
        ctx.fillStyle = "rgba(26,29,38,0.35)";
        for (var y = 2; y <= 6; y++) {
          for (var x = 0; x < W; x++) {
            if (x >= OBS.x0 && x <= OBS.x1 && y >= OBS.y0 && y <= OBS.y1) continue;
            ctx.beginPath();
            ctx.arc(x * CS + CS / 2, y * CS + CS / 2, 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      ctx.fillStyle = "#c9c6bc";
      ctx.fillRect(OBS.x0 * CS, OBS.y0 * CS, (OBS.x1 - OBS.x0 + 1) * CS,
                   (OBS.y1 - OBS.y0 + 1) * CS);
      ctx.strokeStyle = "#9b9890";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(OBS.x0 * CS, OBS.y0 * CS, (OBS.x1 - OBS.x0 + 1) * CS,
                     (OBS.y1 - OBS.y0 + 1) * CS);
      textCell(ctx, 7, 3.5, "macro", MUT, true);
      if (opts.band) {
        ctx.save();
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = AMBER;
        ctx.lineWidth = 2;
        ctx.strokeRect(BAND.x0 * CS + CS / 2, BAND.y0 * CS + CS / 2,
                       (BAND.x1 - BAND.x0) * CS, (BAND.y1 - BAND.y0) * CS);
        ctx.restore();
      }
      if (opts.corners) {
        [[BAND.x0, BAND.y0], [BAND.x1, BAND.y0],
         [BAND.x0, BAND.y1], [BAND.x1, BAND.y1]].forEach(function (c) {
          ctx.beginPath();
          ctx.arc(c[0] * CS + CS / 2, c[1] * CS + CS / 2, 5, 0, Math.PI * 2);
          ctx.fillStyle = AMBER;
          ctx.fill();
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        });
      }
      if (opts.escape) {
        ctx.save();
        ctx.setLineDash([3, 5]);
        ctx.strokeStyle = RED;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(BAND.x1 * CS + CS / 2, PIN.y * CS + CS / 2);
        ctx.lineTo((W - 0.5) * CS + CS / 2, PIN.y * CS + CS / 2);
        ctx.stroke();
        ctx.restore();
      }
    }
    function fr(opts, route, pinIsOffGrid, jog, cap) {
      return {
        paint: function (ctx) {
          scene(ctx, opts);
          if (route) polyline(ctx, route, GREEN, CS * 0.18);
          if (jog) {
            ctx.save();
            ctx.setLineDash([6, 5]);
            polyline(ctx, [{ x: 13, y: 4 }, { x: 13, y: PIN.y }], RED, CS * 0.12);
            ctx.restore();
          }
          pin(ctx, S.x, S.y, GREEN_DEEP, "S");
          if (pinIsOffGrid) pin(ctx, PIN.x, PIN.y, RED, "P");
          else pin(ctx, TGRID.x, TGRID.y, BLUE, "T");
        },
        cap: cap,
      };
    }
    return { frames: [
      fr({ tracks: true, lattice: true }, null, false, false,
        "The gridded world: wires live on a lattice of tracks " +
        "(dashed), and the router's entire search space is the dots, " +
        "one candidate position per track crossing. Small, uniform, " +
        "and every candidate is legal by construction: this is where " +
        "digital detailed routing's speed comes from."),
      fr({ tracks: true, lattice: true }, onGrid, false, false,
        "A gridded route: every turn is at a lattice point, and the " +
        "run below the macro rides track 5, which sits exactly one " +
        "spacing unit away. Searching this space is array lookups; " +
        "while every pin sits on a track, the model is fast and " +
        "complete."),
      fr({ tracks: true, lattice: true }, null, true, false,
        "The blind spot: pin P, an analog macro pin, sits at " +
        "y = 4.45, between track 4 and track 5. No lattice point " +
        "touches it: the coordinate the router must reach does not " +
        "exist in its model."),
      fr({ tracks: true, lattice: true }, onGrid, true, true,
        "The gridded router's best answer stops on track 4 and needs " +
        "an off-track jog (red) to finish, a segment its model can " +
        "neither represent nor rule-check. Off-grid pins, non-uniform " +
        "widths, and analog constraints all fall outside the " +
        "lattice."),
      fr({ band: true }, null, true, false,
        "Switch models: the tracks disappear. A shape-based router " +
        "stores the layout as geometry in a spatial structure " +
        "(corner-stitched tile planes are the classic), and every " +
        "spacing rule becomes a geometric band: the amber outline is " +
        "the macro expanded by the required spacing. Wires may touch " +
        "the band, never enter it."),
      fr({ band: true, corners: true, escape: true }, null, true, false,
        "Generate the candidates from the geometry itself: the " +
        "corners of the expanded macro (amber dots) are the turning " +
        "positions, and the pin projects an escape line (red dashes) " +
        "at its exact y = 4.45. Hightower's escape points, reborn as " +
        "the search space: no lattice anywhere."),
      fr({ band: true, corners: true, escape: true },
         free.slice(0, 3), true, false,
        "The search runs A* (A-star) over the generated points. The " +
        "probe from S meets the spacing band at x = 5.0, slides down " +
        "its edge, and turns at the expanded corner (5, 5): the wire " +
        "hugs the macro at exactly the required spacing, a position " +
        "no track offered."),
      fr({ band: true, corners: true, escape: true },
         free.slice(0, 5), true, false,
        "It rides the band's bottom edge to the far corner (9, 5), " +
        "then climbs the right edge and stops at y = 4.45, the pin's " +
        "escape line. Both coordinates are dictated by geometry, " +
        "neither exists on any track."),
      fr({ band: true }, free, true, false,
        "The final leg rides the escape line and meets the pin " +
        "dead-on: legal at birth, no snapping, no repair. The price " +
        "is the search space: shape corners vastly outnumber track " +
        "crossings and each candidate needs geometric queries, so " +
        "gridless routing owns analog, custom, and off-grid repair " +
        "while digital detail stays gridded for throughput."),
    ], h: GH, speed: 1800 };
  };

  /* ----- ILP global routing: declare the problem, prove the optimum ----- */
  BUILD["ilp-route"] = function () {
    var walls = [];
    for (var y = 0; y < H; y++) {
      if (y !== 2 && y !== 3 && y !== 6) walls.push([7, y]);
    }
    var blocked = wallSet(walls);
    var nets = [
      { s: { x: 2, y: 5 }, t: { x: 12, y: 5 }, color: GREEN, name: "N1", bRow: 2 },
      { s: { x: 2, y: 7 }, t: { x: 12, y: 7 }, color: PURPLE, name: "N2", bRow: 3 },
    ];
    nets.forEach(function (n) {
      function blk(extra) {
        var m = {};
        Object.keys(blocked).forEach(function (k) { m[k] = true; });
        extra.forEach(function (k) { m[k] = true; });
        nets.forEach(function (o) {
          if (o === n) return;
          m[o.s.x + "," + o.s.y] = true;
          m[o.t.x + "," + o.t.y] = true;
        });
        return m;
      }
      n.pathA = bfs(n.s, n.t, blk(["7,2", "7,3"]), W, H);
      n.pathB = bfs(n.s, n.t, blk(["7,6", "7," + (n.bRow === 2 ? 3 : 2)]), W, H);
      n.dA = n.pathA.length - 1 - manh(n.s, n.t);
      n.dB = n.pathB.length - 1 - manh(n.s, n.t);
    });
    /* enumerate the four assignments; gap A capacity 1 */
    var combos = [];
    [true, false].forEach(function (a1) {
      [true, false].forEach(function (a2) {
        var usageA = (a1 ? 1 : 0) + (a2 ? 1 : 0);
        var feasible = usageA <= 1;
        var total = (a1 ? nets[0].dA : nets[0].dB) +
                    (a2 ? nets[1].dA : nets[1].dB);
        combos.push({ a1: a1, a2: a2, usageA: usageA,
                      feasible: feasible, total: total });
      });
    });
    var best = combos.filter(function (c) { return c.feasible; })
      .reduce(function (a, b) { return b.total < a.total ? b : a; });
    var QX = 15.5;
    function label(c) {
      return (c.a1 ? "A" : "B") + " , " + (c.a2 ? "A" : "B");
    }
    function panelText(ctx, lines) {
      ctx.textAlign = "left";
      ctx.font = "bold 11px 'JetBrains Mono', monospace";
      ctx.fillStyle = INK;
      ctx.fillText(lines[0], QX * CS, 16);
      ctx.font = "11px 'JetBrains Mono', monospace";
      for (var i = 1; i < lines.length; i++) {
        ctx.fillStyle = lines[i].charAt(0) === "!" ? RED : MUT;
        ctx.fillText(lines[i].replace(/^!/, ""), QX * CS, 16 + i * 17);
      }
    }
    function paintILP(opts) {
      return function (ctx) {
        ctx.fillStyle = "#fdfdfd";
        ctx.fillRect(0, 0, 21 * CS, H * CS);
        base(ctx, W, H, walls);
        if (opts.candidates || opts.only !== undefined) {
          ctx.save();
          ctx.setLineDash([7, 6]);
          nets.forEach(function (n, i) {
            if (opts.only !== undefined && opts.only !== i) return;
            var wpx = opts.only !== undefined ? CS * 0.16 : CS * 0.13;
            polyline(ctx, n.pathA, n.color, wpx);
            polyline(ctx, n.pathB, n.color, wpx);
          });
          ctx.restore();
        }
        if (opts.solution) {
          polyline(ctx, best.a1 ? nets[0].pathA : nets[0].pathB,
                   nets[0].color, CS * 0.2);
          polyline(ctx, best.a2 ? nets[1].pathA : nets[1].pathB,
                   nets[1].color, CS * 0.2);
        }
        fillCell(ctx, 7, 6, GREEN, 0.25);
        textCell(ctx, 7, 6, "A", GREEN_DEEP, true);
        fillCell(ctx, 7, 2, BLUE, 0.2);
        fillCell(ctx, 7, 3, BLUE, 0.2);
        textCell(ctx, 7, 2, "B", "#1d4ed8", true);
        textCell(ctx, 7, 3, "B", "#1d4ed8", true);
        nets.forEach(function (n) {
          pin(ctx, n.s.x, n.s.y, n.color, n.name[1]);
          pin(ctx, n.t.x, n.t.y, n.color, n.name[1]);
        });
        if (opts.panel) panelText(ctx, opts.panel);
      };
    }
    var tableLines = ["assignments (N1 , N2)"];
    combos.forEach(function (c) {
      tableLines.push(
        label(c) + " : " +
        (c.feasible
          ? c.total + (c === best ? "  <- optimal" : "")
          : "infeasible (A " + c.usageA + "/1)"));
    });
    function pad(s, n) { while (s.length < n) s += " "; return s; }
    var encLines = ["uses(path, edge)", pad("path", 10) + "cost  A  B"];
    nets.forEach(function (n) {
      [["A", n.dA, "1", "0"], ["B", n.dB, "0", "1"]].forEach(function (c) {
        encLines.push(pad("x(" + n.name + "," + c[0] + ")", 10) +
                      pad(String(c[1]), 6) + c[2] + "  " + c[3]);
      });
    });
    encLines.push("");
    encLines.push("column A holds two 1s:");
    encLines.push("!x(N1,A) + x(N2,A) <= 1");
    return { frames: [
      {
        paint: paintILP({ only: 0, panel: [
          "N1 candidates",
          "via A: detour " + nets[0].dA,
          "  edges: row 5, gap A",
          "via B: detour " + nets[0].dB,
          "  edges: climb, gap B",
          "stored as edge lists"] }),
        cap: "Before any program exists, an enumerator draws concrete " +
             "candidate paths on the GCell graph. For N1 (dashed): " +
             "through gap A at detour " + nets[0].dA + ", or through " +
             "gap B at detour " + nets[0].dB + ". Each candidate is " +
             "stored as its explicit list of edges plus this cost; " +
             "nothing is symbolic yet, these are drawn routes.",
      },
      {
        paint: paintILP({ only: 1, panel: [
          "N2 candidates",
          "via A: detour " + nets[1].dA,
          "  edges: row 7, gap A",
          "via B: detour " + nets[1].dB,
          "  edges: climb, gap B",
          "stored as edge lists"] }),
        cap: "The same enumeration for N2: through gap A at detour " +
             nets[1].dA + ", or through gap B at detour " + nets[1].dB +
             ". Four drawn paths in total. This menu is everything " +
             "the solver will ever see; a route nobody drew here can " +
             "never be chosen, whatever the certificate says.",
      },
      {
        paint: paintILP({ candidates: true, panel: encLines }),
        cap: "The encoding: each stored path is reduced to one table " +
             "row holding its cost and, per scarce edge, a 1 if the " +
             "path crosses it and a 0 if not (right). The geometry " +
             "is gone at this point; the program sees only this " +
             "table. Both paths through gap A put a 1 in column A, " +
             "which is all the solver will ever know about the " +
             "bottleneck.",
      },
      {
        paint: paintILP({ candidates: true, panel: [
          "constraints",
          "x(N1,A) + x(N1,B) = 1",
          "x(N2,A) + x(N2,B) = 1",
          "!x(N1,A) + x(N2,A) <= 1",
          "(gap A capacity 1)"] }),
        cap: "The program reads straight off the table. One binary " +
             "variable per row. Across each net's pair of rows: pick " +
             "exactly one drawn path. Down each edge's column, " +
             "summing the rows that hold a 1: stay within capacity, " +
             "so column A yields x(N1,A) + x(N2,A) <= 1.",
      },
      {
        paint: paintILP({ candidates: true, panel: tableLines }),
        cap: "The objective: minimize total detour, each variable " +
             "weighted by its cost column. With two nets and two " +
             "candidates the solver's work is visible by enumeration " +
             "(right): one assignment is infeasible, and of the " +
             "rest, " + label(best) + " is cheapest at " + best.total +
             ". An ILP (Integer Linear Programming) solver proves " +
             "this optimum without trying every combination.",
      },
      {
        paint: paintILP({ solution: true, panel: tableLines }),
        cap: "The proven optimum: N2 keeps gap A and N1 takes gap B, " +
             "total detour " + best.total + ". Reading the answer " +
             "back is a lookup, not a construction: x(N1,B) = 1 " +
             "fetches N1's stored edge list, and that list is the " +
             "route. Note this is exactly the allocation PathFinder's " +
             "negotiation converges to iteratively.",
      },
      {
        paint: paintILP({ solution: true, panel: tableLines }),
        cap: "The limitation is scale: millions of nets and candidate " +
             "paths make the monolithic ILP (Integer Linear " +
             "Programming) instance intractable. BoxRouter solves " +
             "exact programs inside progressively growing boxes " +
             "around congested regions; GRIP partitions the die and " +
             "solves subproblems near-optimally. The role today: " +
             "gold-standard benchmarks and surgical cleanup of hard " +
             "windows, not mainline production routing.",
      },
    ], w: 21, speed: 1800 };
  };

  /* ----- pin access: enumerate legal access points before any search ----- */
  BUILD["pin-access"] = function () {
    /* fine grid 30 x 20 (half cells). A standard cell occupies rows
       12..19; its M1 pin is a small vertical rectangle. M2 tracks are
       horizontal on every fine row; the via needs enclosure on both
       sides and spacing to the neighbouring pin. */
    var FS = CS / 2, FW = 30, FH = 20;
    var CELL = { x0: 6, y0: 12, x1: 23, y1: 19 };
    var PIN  = { x0: 12, y0: 12, x1: 12, y1: 18 };  /* 1 col wide, rows 12..18 */
    var NBR  = { x0: 15, y0: 12, x1: 15, y1: 14 };  /* neighbouring pin B, upper rows */
    var OBS  = { x0: 9,  y0: 16, x1: 10, y1: 17 };  /* M1 blockage, lower rows */
    var SPACING = 2; /* via-to-metal spacing in fine cells */
    /* candidate access points: every M2 track row crossing the pin */
    var cands = [];
    for (var y = PIN.y0; y <= PIN.y1; y++) cands.push({ x: PIN.x0, y: y });
    function legal(c) {
      /* via enclosure: needs one cell of pin metal above and below
         (so not at the pin's end rows); spacing to the neighbour pin
         and to the obstruction on the row */
      var enclosure = c.y > PIN.y0 && c.y < PIN.y1;
      /* spacing: a via at row c.y conflicts with metal whose rows are
         within SPACING - 1 and whose columns are closer than SPACING */
      var nearRows = function (r) { return c.y >= r.y0 - (SPACING - 1) && c.y <= r.y1 + (SPACING - 1); };
      var spacingNbr = !(nearRows(NBR) && (NBR.x0 - c.x - 1) < SPACING);
      var obsHit = nearRows(OBS) && (c.x - OBS.x1 - 1) < SPACING;
      return { ok: enclosure && spacingNbr && !obsHit,
               enclosure: enclosure, spacingNbr: spacingNbr, obs: !obsHit };
    }
    cands.forEach(function (c) { c.v = legal(c); });
    var legalPts = cands.filter(function (c) { return c.v.ok; });
    var chosen = legalPts[Math.floor(legalPts.length / 2)];
    function bg(ctx) {
      ctx.fillStyle = "#fdfdfd";
      ctx.fillRect(0, 0, W * CS, H * CS);
      ctx.strokeStyle = "#ebe9e2";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (var x = 0; x <= FW; x++) { ctx.moveTo(x * FS, 0); ctx.lineTo(x * FS, FH * FS); }
      for (var y = 0; y <= FH; y++) { ctx.moveTo(0, y * FS); ctx.lineTo(FW * FS, y * FS); }
      ctx.stroke();
    }
    function rect(ctx, r, fill, stroke, alpha) {
      ctx.save();
      if (alpha !== undefined) ctx.globalAlpha = alpha;
      ctx.fillStyle = fill;
      ctx.fillRect(r.x0 * FS, r.y0 * FS, (r.x1 - r.x0 + 1) * FS, (r.y1 - r.y0 + 1) * FS);
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(r.x0 * FS, r.y0 * FS, (r.x1 - r.x0 + 1) * FS, (r.y1 - r.y0 + 1) * FS);
      }
      ctx.restore();
    }
    function cell(ctx) {
      rect(ctx, CELL, "#eceae2", "#9b9890");
      ctx.font = "10px 'JetBrains Mono', monospace";
      ctx.textAlign = "left";
      ctx.fillStyle = MUT;
      ctx.fillText("standard cell", CELL.x0 * FS + 4, CELL.y0 * FS - 4);
      rect(ctx, PIN, RED, null, 0.7);
      rect(ctx, NBR, "#7c3aed", null, 0.45);
      rect(ctx, OBS, "#6b6b6b", null, 0.6);
      ctx.fillStyle = INK;
      ctx.font = "bold 9px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText("A", PIN.x0 * FS + FS / 2, (PIN.y1 + 1) * FS + 10);
      ctx.fillText("B", NBR.x0 * FS + FS / 2, (NBR.y1 + 1) * FS + 10);
    }
    function tracks(ctx, rows) {
      ctx.save();
      ctx.strokeStyle = "rgba(47,111,237,0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      (rows || [10, 11, 12, 13, 14, 15, 16, 17, 18]).forEach(function (y) {
        ctx.moveTo(0, y * FS + FS / 2); ctx.lineTo(FW * FS, y * FS + FS / 2);
      });
      ctx.stroke();
      ctx.restore();
    }
    function dot(ctx, c, color, r) {
      ctx.beginPath();
      ctx.arc(c.x * FS + FS / 2, c.y * FS + FS / 2, r || 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
    function spacingHalo(ctx, r, color) {
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.strokeRect((r.x0 - SPACING) * FS, (r.y0 - SPACING) * FS,
                     (r.x1 - r.x0 + 1 + 2 * SPACING) * FS,
                     (r.y1 - r.y0 + 1 + 2 * SPACING) * FS);
      ctx.restore();
    }
    function panel(ctx, lines) {
      var QX = 15.5;
      ctx.textAlign = "left";
      lines.forEach(function (l, k) {
        ctx.fillStyle = k === 0 ? INK : (l.charAt(0) === "!" ? RED : MUT);
        ctx.font = (k === 0 ? "bold " : "") + "11px 'JetBrains Mono', monospace";
        ctx.fillText(l.replace(/^!/, ""), QX * CS, 16 + k * 16);
      });
    }
    function candLines(showVerdicts) {
      var out = ["access candidates (pin A)"];
      cands.forEach(function (c) {
        var s = "row " + c.y + " : ";
        if (!showVerdicts) s += "?";
        else if (c.v.ok) s += "legal";
        else {
          var why = [];
          if (!c.v.enclosure) why.push("enclosure");
          if (!c.v.spacingNbr) why.push("spacing B");
          if (!c.v.obs) why.push("spacing obs");
          s = "!" + s + "fails: " + why.join(", ");
        }
        out.push(s);
      });
      return out;
    }
    return { frames: [
      {
        paint: function (ctx) { bg(ctx); cell(ctx); },
        cap: "A standard cell at an advanced node, plan view. Its input " +
             "pin A is a sliver of M1 (red), one track wide and a few " +
             "tracks tall; pin B of the same cell sits three columns " +
             "away, and a piece of M1 blockage (grey) lies inside the " +
             "cell. Reaching A legally is not guaranteed.",
      },
      {
        paint: function (ctx) { bg(ctx); tracks(ctx); cell(ctx); },
        cap: "The router arrives on M2, whose tracks run horizontally " +
             "(blue). Connecting to A means dropping a via from an M2 " +
             "track onto the M1 pin, and a via is only legal where the " +
             "M1 metal encloses it and where it keeps spacing from " +
             "everything else on M1.",
      },
      {
        paint: function (ctx) {
          bg(ctx); tracks(ctx); cell(ctx);
          cands.forEach(function (c) { dot(ctx, c, INK, 4); });
          panel(ctx, candLines(false));
        },
        cap: "Step 1 (enumerate): every M2 track that crosses pin A is " +
             "a candidate access point, " + cands.length + " of them " +
             "(black dots), one per track row from " + PIN.y0 + " to " +
             PIN.y1 + ". Nothing has been checked yet; these are the " +
             "positions the search would otherwise discover one at a " +
             "time, deep inside a maze expansion.",
      },
      {
        paint: function (ctx) {
          bg(ctx); tracks(ctx); cell(ctx);
          spacingHalo(ctx, NBR, "#7c3aed");
          spacingHalo(ctx, OBS, "#6b6b6b");
          cands.forEach(function (c) { dot(ctx, c, c.v.ok ? GREEN : RED, 4.5); });
          panel(ctx, candLines(true));
        },
        cap: "Step 2 (check rules): each candidate is tested against " +
             "the deck. Via enclosure fails at the pin's end rows (no " +
             "metal above or below the cut). Spacing (dashed halos) " +
             "must be kept to pin B and to the blockage. " +
             legalPts.length + " of " + cands.length + " candidates " +
             "survive (green); the rest are legal-looking positions " +
             "that would each have become a DRC (Design Rule Check) " +
             "violation.",
      },
      {
        paint: function (ctx) {
          bg(ctx); tracks(ctx); cell(ctx);
          legalPts.forEach(function (c) { dot(ctx, c, GREEN, 4.5); });
          panel(ctx, ["access points for A"].concat(legalPts.map(function (c) {
            return "row " + c.y + " : via V12, M2 track " + c.y;
          })));
        },
        cap: "Step 3 (record): the surviving points, each with its via " +
             "pattern, are stored as pin A's access-point set. This " +
             "runs for every pin of every cell before routing starts, " +
             "the same way FLUTE (Fast Lookup Table Estimation) computes " +
             "Steiner-tree cost in advance: the " +
             "expensive rule checking is done once, off the search's " +
             "critical path.",
      },
      {
        paint: function (ctx) {
          bg(ctx); tracks(ctx); cell(ctx);
          legalPts.forEach(function (c) { dot(ctx, c, GREEN, 4.5); });
          /* M2 wire arriving on the chosen track from the left */
          ctx.save();
          ctx.strokeStyle = BLUE; ctx.lineWidth = 4; ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(0.5 * FS, chosen.y * FS + FS / 2);
          ctx.lineTo(chosen.x * FS + FS / 2, chosen.y * FS + FS / 2);
          ctx.stroke();
          ctx.restore();
          ctx.fillStyle = INK;
          ctx.fillRect(chosen.x * FS + FS / 2 - 4, chosen.y * FS + FS / 2 - 4, 8, 8);
        },
        cap: "Step 4 (route to an access point): the detailed router " +
             "now targets the access-point set, not the pin shape. Its " +
             "M2 wire arrives on track " + chosen.y + " and drops the " +
             "recorded via (black square). The search never had to " +
             "reason about enclosure or spacing at the pin: it was " +
             "handed positions that are legal by construction.",
      },
      {
        paint: function (ctx) {
          bg(ctx); tracks(ctx); cell(ctx);
          cands.forEach(function (c) { dot(ctx, c, RED, 4.5); });
          panel(ctx, ["a pin with zero access points",
                      "!every candidate fails",
                      "-> cell is unroutable here",
                      "fixes: move / flip cell,",
                      "  swap pin, change library"]);
        },
        cap: "The failure mode this pass exposes: a pin whose every " +
             "candidate fails has no legal access at all, and no amount " +
             "of routing effort will fix it. Pin-access analysis reports " +
             "it before routing, so the fix (move or flip the cell, use " +
             "a different pin, or change the cell) happens where it is " +
             "cheap. At 7 nm and below this, not congestion, is the " +
             "dominant reason detailed routing fails.",
      },
    ], speed: 1900 };
  };

  /* ----- antenna effect: charge ratio and its two repairs ----- */
  BUILD["antenna-repair"] = function () {
    /* a long M2 wire feeding a gate; ratio = wire area / gate area */
    var GATE_AREA = 1.0;          /* normalized */
    var LIMIT = 400;               /* max ratio allowed by the process */
    var wireLen = 26;              /* fine cells; area per cell = 20 units */
    var AREA_PER_CELL = 20;
    var FS = CS / 2, FW = 30, FH = 20;
    var GATE = { x: 27, y: 10 };
    var DRIVER = { x: 1, y: 10 };
    function ratio(len) { return len * AREA_PER_CELL / GATE_AREA; }
    function bg(ctx) {
      ctx.fillStyle = "#fdfdfd";
      ctx.fillRect(0, 0, W * CS, H * CS);
      ctx.strokeStyle = "#ebe9e2";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (var x = 0; x <= FW; x++) { ctx.moveTo(x * FS, 0); ctx.lineTo(x * FS, FH * FS); }
      for (var y = 0; y <= FH; y++) { ctx.moveTo(0, y * FS); ctx.lineTo(FW * FS, y * FS); }
      ctx.stroke();
    }
    function fseg(ctx, x0, y0, x1, y1, color, w) {
      ctx.save();
      ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x0 * FS + FS / 2, y0 * FS + FS / 2);
      ctx.lineTo(x1 * FS + FS / 2, y1 * FS + FS / 2);
      ctx.stroke();
      ctx.restore();
    }
    function box(ctx, x, y, w, h, fill, label) {
      ctx.fillStyle = fill;
      ctx.fillRect(x * FS, y * FS, w * FS, h * FS);
      ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
      ctx.strokeRect(x * FS, y * FS, w * FS, h * FS);
      ctx.fillStyle = INK;
      ctx.font = "bold 9px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(label, (x + w / 2) * FS, (y + h + 0.9) * FS);
    }
    function via(ctx, x, y) {
      ctx.fillStyle = INK;
      ctx.fillRect(x * FS + FS / 2 - 3.5, y * FS + FS / 2 - 3.5, 7, 7);
    }
    function panel(ctx, lines) {
      var QX = 15.5;
      ctx.textAlign = "left";
      lines.forEach(function (l, k) {
        ctx.fillStyle = k === 0 ? INK : (l.charAt(0) === "!" ? RED : (l.charAt(0) === "+" ? GREEN_DEEP : MUT));
        ctx.font = (k === 0 ? "bold " : "") + "11px 'JetBrains Mono', monospace";
        ctx.fillText(l.replace(/^[!+]/, ""), QX * CS, 16 + k * 16);
      });
    }
    function scene(ctx, opts) {
      bg(ctx);
      box(ctx, DRIVER.x - 0.5, DRIVER.y - 1, 2, 3, "#dfe7f5", "driver");
      box(ctx, GATE.x - 0.5, GATE.y - 1, 2, 3, "#fde2e2", "gate");
      if (opts.wire) fseg(ctx, DRIVER.x + 1, DRIVER.y, GATE.x - 1, GATE.y, opts.hot ? RED : BLUE, 4);
      if (opts.charge) {
        ctx.fillStyle = RED;
        ctx.font = "bold 10px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        for (var x = 4; x < GATE.x - 1; x += 3) ctx.fillText("+", x * FS + FS / 2, DRIVER.y * FS - 3);
      }
      if (opts.diode) {
        var dx = GATE.x - 4;
        via(ctx, dx, GATE.y);
        fseg(ctx, dx, GATE.y, dx, GATE.y + 3, GREEN, 3);
        box(ctx, dx - 0.5, GATE.y + 3, 2, 2, "#dcfce7", "diode");
      }
      if (opts.hop) {
        /* wire split: M2 from driver to column 8, jump to M4 (amber, drawn
           slightly above), come back down near the gate */
        bg(ctx);
        box(ctx, DRIVER.x - 0.5, DRIVER.y - 1, 2, 3, "#dfe7f5", "driver");
        box(ctx, GATE.x - 0.5, GATE.y - 1, 2, 3, "#fde2e2", "gate");
        fseg(ctx, DRIVER.x + 1, DRIVER.y, 8, DRIVER.y, BLUE, 4);
        via(ctx, 8, DRIVER.y);
        fseg(ctx, 8, DRIVER.y, 8, DRIVER.y - 3, GREEN, 3);
        via(ctx, 8, DRIVER.y - 3);
        fseg(ctx, 8, DRIVER.y - 3, GATE.x - 4, DRIVER.y - 3, AMBER, 6);
        via(ctx, GATE.x - 4, DRIVER.y - 3);
        fseg(ctx, GATE.x - 4, DRIVER.y - 3, GATE.x - 4, GATE.y, GREEN, 3);
        via(ctx, GATE.x - 4, GATE.y);
        fseg(ctx, GATE.x - 4, GATE.y, GATE.x - 1, GATE.y, BLUE, 4);
      }
      if (opts.panel) panel(ctx, opts.panel);
    }
    var r0 = ratio(wireLen);
    var shortLen = 6, hopM2b = 3;
    return { frames: [
      {
        paint: function (ctx) { scene(ctx, { wire: true }); },
        cap: "A finished route: a driver's output runs " + wireLen +
             " cells along M2 (blue) to a transistor gate. Electrically " +
             "fine. The problem is not in operation; it is during " +
             "manufacturing, when this wire exists before the driver " +
             "does.",
      },
      {
        paint: function (ctx) { scene(ctx, { wire: true, hot: true, charge: true }); },
        cap: "During plasma etching of M2, the metal collects charge " +
             "(+). The wire is already connected to the gate below, but " +
             "the driver above it does not exist yet, so the charge has " +
             "no path to ground except through the gate's thin oxide, " +
             "which it can rupture. This is the antenna effect.",
      },
      {
        paint: function (ctx) { scene(ctx, { wire: true, hot: true, panel: [
          "antenna ratio",
          "wire area  " + wireLen + " x " + AREA_PER_CELL + " = " + (wireLen * AREA_PER_CELL),
          "gate area  " + GATE_AREA,
          "!ratio     " + r0 + "  > limit " + LIMIT] }); },
        cap: "The check is a ratio: metal area collecting charge on the " +
             "layer, divided by the gate area it discharges into. Here " +
             wireLen + " cells x " + AREA_PER_CELL + " = " +
             (wireLen * AREA_PER_CELL) + " against a gate area of " +
             GATE_AREA + ", ratio " + r0 + ", above the process limit " +
             "of " + LIMIT + ". A violation, per layer, checked on " +
             "every net after routing.",
      },
      {
        paint: function (ctx) { scene(ctx, { wire: true, diode: true, panel: [
          "repair 1: diode insertion",
          "diode near the gate",
          "+charge drains through it",
          "cost: one cell of area,",
          "  a little capacitance"] }); },
        cap: "Repair 1, diode insertion: attach a small reverse-biased " +
             "diode (green) to the net near the gate. During etch it " +
             "gives the charge a path into the substrate; in operation " +
             "it is off and only adds a little capacitance. Cheap and " +
             "local, the usual first fix.",
      },
      {
        paint: function (ctx) { scene(ctx, { hop: true, panel: [
          "repair 2: layer hopping",
          "M2 piece at gate: " + hopM2b + " cells",
          "+ratio " + ratio(hopM2b) + " < " + LIMIT,
          "upper piece etched",
          "  after gate is shielded"] }); },
        cap: "Repair 2, layer hopping: break the long M2 run by jumping " +
             "up to a higher layer (amber) and back down near the gate. " +
             "The only M2 metal touching the gate during M2's etch is " +
             "the last " + hopM2b + " cells, ratio " + ratio(hopM2b) +
             ", well under " + LIMIT + ". The long upper piece is " +
             "etched later, when the lower layers already connect the " +
             "gate to the driver's diffusion. Costs vias and a track " +
             "on another layer.",
      },
      {
        paint: function (ctx) { scene(ctx, { hop: true, panel: [
          "in the flow",
          "check: every net, every layer",
          "  after detailed routing",
          "fix: diode where room,",
          "  hop where the router can",
          "iterate until clean"] }); },
        cap: "In the flow: an antenna check runs on every net after " +
             "detailed routing, the repair pass inserts diodes where a " +
             "free site exists and re-routes with layer hops where it " +
             "does not, and the check re-runs until clean. A " +
             "sign-off item on every tape-out, and a classic interview " +
             "question because the physics is manufacturing, not " +
             "operation.",
      },
    ], speed: 2000 };
  };

  /* ----- timing-driven and crosstalk-aware routing ----- */
  BUILD["timing-xtalk"] = function () {
    var FS = CS / 2, FW = 30, FH = 20;
    /* a critical net C from (2,10) to (27,10) and an aggressor A on the
       adjacent track; the panel has tracks every fine row */
    var C = { s: { x: 2, y: 10 }, t: { x: 27, y: 10 } };
    var A = { s: { x: 6, y: 11 }, t: { x: 24, y: 11 } };
    var Cshort = [{ x: 2, y: 10 }, { x: 27, y: 10 }];
    var Cdetour = [{ x: 2, y: 10 }, { x: 2, y: 14 }, { x: 27, y: 14 }, { x: 27, y: 10 }];
    function len(p) {
      var n = 0;
      for (var i = 1; i < p.length; i++) n += Math.abs(p[i].x - p[i-1].x) + Math.abs(p[i].y - p[i-1].y);
      return n;
    }
    /* coupling model: length of parallel run at spacing s contributes
       overlap / s to the coupling term */
    function coupling(spacing, overlap) { return overlap / spacing; }
    var overlapAdj = A.t.x - A.s.x; /* 18 cells side by side */
    function bg(ctx) {
      ctx.fillStyle = "#fdfdfd";
      ctx.fillRect(0, 0, W * CS, H * CS);
      ctx.strokeStyle = "#ebe9e2";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (var x = 0; x <= FW; x++) { ctx.moveTo(x * FS, 0); ctx.lineTo(x * FS, FH * FS); }
      for (var y = 0; y <= FH; y++) { ctx.moveTo(0, y * FS); ctx.lineTo(FW * FS, y * FS); }
      ctx.stroke();
      ctx.save();
      ctx.strokeStyle = "rgba(47,111,237,0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (var yy = 6; yy <= 15; yy++) { ctx.moveTo(0, yy * FS + FS / 2); ctx.lineTo(FW * FS, yy * FS + FS / 2); }
      ctx.stroke();
      ctx.restore();
    }
    function fpoly(ctx, pts, color, w, dash) {
      ctx.save();
      if (dash) ctx.setLineDash([5, 4]);
      ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath();
      pts.forEach(function (p, i) {
        var X = p.x * FS + FS / 2, Y = p.y * FS + FS / 2;
        if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
      });
      ctx.stroke();
      ctx.restore();
    }
    function fpin(ctx, p, color, label) {
      ctx.beginPath();
      ctx.arc(p.x * FS + FS / 2, p.y * FS + FS / 2, 6.5, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 9px 'JetBrains Mono', monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(label, p.x * FS + FS / 2, p.y * FS + FS / 2 + 0.5);
      ctx.textBaseline = "alphabetic";
    }
    function panel(ctx, lines) {
      var QX = 15.5;
      ctx.textAlign = "left";
      lines.forEach(function (l, k) {
        ctx.fillStyle = k === 0 ? INK : (l.charAt(0) === "!" ? RED : (l.charAt(0) === "+" ? GREEN_DEEP : MUT));
        ctx.font = (k === 0 ? "bold " : "") + "11px 'JetBrains Mono', monospace";
        ctx.fillText(l.replace(/^[!+]/, ""), QX * CS, 16 + k * 16);
      });
    }
    function pinsCA(ctx, withA) {
      fpin(ctx, C.s, GREEN_DEEP, "C"); fpin(ctx, C.t, GREEN_DEEP, "C");
      if (withA) { fpin(ctx, A.s, RED, "A"); fpin(ctx, A.t, RED, "A"); }
    }
    var W_CRIT = 3; /* weight multiplier for the critical net's wirelength */
    var lenShort = len(Cshort), lenDetour = len(Cdetour);
    var cplAdj = coupling(1, overlapAdj), cplSp2 = coupling(2, overlapAdj), cplDetour = coupling(4, overlapAdj);
    return { frames: [
      {
        paint: function (ctx) { bg(ctx); fpoly(ctx, Cshort, GREEN, 4); pinsCA(ctx, false);
          panel(ctx, ["net C, ordinary", "length " + lenShort, "cost = length = " + lenShort]); },
        cap: "A net C routed by the plain cost model: shortest path, " +
             lenShort + " cells, cost " + lenShort + ". Every net is " +
             "priced the same way, by wirelength plus congestion, " +
             "whether or not its delay matters.",
      },
      {
        paint: function (ctx) { bg(ctx); fpoly(ctx, Cshort, GREEN, 4); pinsCA(ctx, false);
          panel(ctx, ["net C, critical", "slack negative after STA", "weight w = " + W_CRIT,
                      "cost = " + W_CRIT + " x length", "  = " + (W_CRIT * lenShort)]); },
        cap: "Timing-driven: STA (Static Timing Analysis) reports C on a " +
             "failing path, so the router raises its weight to " + W_CRIT +
             ". Its wirelength now costs " + W_CRIT + " x " + lenShort +
             " = " + (W_CRIT * lenShort) + " in the negotiation. " +
             "Nothing about the search changed; the price of detouring " +
             "C tripled, so C wins contested resources and non-critical " +
             "nets detour around it instead.",
      },
      {
        paint: function (ctx) { bg(ctx); fpoly(ctx, Cshort, GREEN, 4); fpoly(ctx, [A.s, A.t], RED, 4); pinsCA(ctx, true);
          panel(ctx, ["aggressor A arrives", "adjacent track, spacing 1", "parallel run " + overlapAdj,
                      "!coupling = " + overlapAdj + " / 1 = " + cplAdj]); },
        cap: "Crosstalk: a second net A lands on the adjacent track and " +
             "runs " + overlapAdj + " cells alongside C at minimum " +
             "spacing. When A switches, its coupling capacitance to C " +
             "injects noise and shifts C's delay. Coupling here is " +
             "modeled as parallel length divided by spacing: " +
             overlapAdj + " / 1 = " + cplAdj + ".",
      },
      {
        paint: function (ctx) { bg(ctx); fpoly(ctx, Cshort, GREEN, 4); fpoly(ctx, [{x:A.s.x,y:12},{x:A.t.x,y:12}], RED, 4); fpin(ctx, C.s, GREEN_DEEP, "C"); fpin(ctx, C.t, GREEN_DEEP, "C"); fpin(ctx, {x:A.s.x,y:12}, RED, "A"); fpin(ctx, {x:A.t.x,y:12}, RED, "A");
          panel(ctx, ["fix 1: spacing", "A moved one track away", "spacing 2",
                      "+coupling = " + overlapAdj + " / 2 = " + cplSp2, "cost: one track of capacity"]); },
        cap: "Fix 1, spacing: crosstalk-aware routing adds a coupling " +
             "term to the cost, so A's route beside C became expensive " +
             "and A re-routes one track farther. Coupling halves to " +
             cplSp2 + " for the price of one unused track. In production " +
             "this is a non-default spacing rule on the critical net.",
      },
      {
        paint: function (ctx) { bg(ctx); fpoly(ctx, Cshort, GREEN, 4);
          fpoly(ctx, [{x:0,y:9},{x:29,y:9}], "#6b7280", 3); fpoly(ctx, [{x:0,y:11},{x:29,y:11}], "#6b7280", 3);
          fpoly(ctx, [{x:A.s.x,y:12},{x:A.t.x,y:12}], RED, 4);
          fpin(ctx, C.s, GREEN_DEEP, "C"); fpin(ctx, C.t, GREEN_DEEP, "C"); fpin(ctx, {x:A.s.x,y:12}, RED, "A"); fpin(ctx, {x:A.t.x,y:12}, RED, "A");
          panel(ctx, ["fix 2: shielding", "ground wires both sides", "+coupling to A ~ 0",
                      "cost: two tracks,", "  more C to ground"]); },
        cap: "Fix 2, shielding: route grounded wires (grey) on both " +
             "sides of C. Any aggressor now couples to a wire that " +
             "never switches, so noise into C drops to nearly zero. " +
             "Costs two tracks and adds capacitance to ground, which " +
             "slows C slightly: used for clocks and the most sensitive " +
             "signals.",
      },
      {
        paint: function (ctx) { bg(ctx); fpoly(ctx, Cshort, GREEN, 3, true); fpoly(ctx, Cdetour, GREEN, 4); fpoly(ctx, [A.s, A.t], RED, 4); pinsCA(ctx, true);
          panel(ctx, ["the trade the cost sees", "detour: length " + lenDetour + " (+" + (lenDetour - lenShort) + ")",
                      "  coupling " + overlapAdj + " / 4 = " + cplDetour, "stay: length " + lenShort + ", coupling " + cplAdj,
                      "weights decide"]); },
        cap: "The router weighs both effects in one cost: C could also " +
             "detour (solid) to escape A entirely, paying " +
             (lenDetour - lenShort) + " cells of extra wire (extra " +
             "delay) to cut coupling to " + cplDetour + ". Whether the " +
             "detour or the coupling costs more delay is exactly what " +
             "the timing weights encode. Timing-driven routing is not a " +
             "new search: it is the cost function carrying slack.",
      },
    ], speed: 2000 };
  };

  /* ----- non-default rules and multi-patterning ----- */
  BUILD["ndr-mpt"] = function () {
    var FS = CS / 2, FW = 30, FH = 20;
    function bg(ctx) {
      ctx.fillStyle = "#fdfdfd";
      ctx.fillRect(0, 0, W * CS, H * CS);
      ctx.strokeStyle = "#ebe9e2";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (var x = 0; x <= FW; x++) { ctx.moveTo(x * FS, 0); ctx.lineTo(x * FS, FH * FS); }
      for (var y = 0; y <= FH; y++) { ctx.moveTo(0, y * FS); ctx.lineTo(FW * FS, y * FS); }
      ctx.stroke();
    }
    function tracks(ctx, y0, y1) {
      ctx.save();
      ctx.strokeStyle = "rgba(47,111,237,0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (var y = y0; y <= y1; y++) { ctx.moveTo(0, y * FS + FS / 2); ctx.lineTo(FW * FS, y * FS + FS / 2); }
      ctx.stroke();
      ctx.restore();
    }
    function hwire(ctx, y, x0, x1, color, w) {
      ctx.save();
      ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = "butt";
      ctx.beginPath();
      ctx.moveTo(x0 * FS, y * FS + FS / 2);
      ctx.lineTo((x1 + 1) * FS, y * FS + FS / 2);
      ctx.stroke();
      ctx.restore();
    }
    function label(ctx, x, y, txt, color) {
      ctx.font = "bold 10px 'JetBrains Mono', monospace";
      ctx.textAlign = "left";
      ctx.fillStyle = color || INK;
      ctx.fillText(txt, x * FS, y * FS + FS / 2 + 3.5);
    }
    function panel(ctx, lines) {
      var QX = 15.5;
      ctx.textAlign = "left";
      lines.forEach(function (l, k) {
        ctx.fillStyle = k === 0 ? INK : (l.charAt(0) === "!" ? RED : (l.charAt(0) === "+" ? GREEN_DEEP : MUT));
        ctx.font = (k === 0 ? "bold " : "") + "11px 'JetBrains Mono', monospace";
        ctx.fillText(l.replace(/^[!+]/, ""), QX * CS, 16 + k * 16);
      });
    }
    function conflictGraph(ctx, nodes, edges, bad) {
      /* small graph at the right: nodes on a triangle */
      var cx = 18.2 * CS, cy = 2.4 * CS, R = 34;
      var pos = [
        { x: cx,      y: cy - R },
        { x: cx - R,  y: cy + R * 0.7 },
        { x: cx + R,  y: cy + R * 0.7 },
      ];
      ctx.font = "bold 11px 'JetBrains Mono', monospace";
      ctx.textAlign = "left";
      ctx.fillStyle = INK;
      ctx.fillText("conflict graph", 15.5 * CS, 16);
      ctx.save();
      ctx.strokeStyle = bad ? RED : "#6b7280";
      ctx.lineWidth = 2;
      edges.forEach(function (e) {
        ctx.beginPath();
        ctx.moveTo(pos[e[0]].x, pos[e[0]].y);
        ctx.lineTo(pos[e[1]].x, pos[e[1]].y);
        ctx.stroke();
      });
      ctx.restore();
      nodes.forEach(function (n, k) {
        ctx.beginPath();
        ctx.arc(pos[k].x, pos[k].y, 11, 0, Math.PI * 2);
        ctx.fillStyle = n[1];
        ctx.fill();
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 10px 'JetBrains Mono', monospace";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(n[0], pos[k].x, pos[k].y + 0.5);
        ctx.textBaseline = "alphabetic";
      });
      ctx.font = "11px 'JetBrains Mono', monospace";
      ctx.textAlign = "left";
      ctx.fillStyle = bad ? RED : GREEN_DEEP;
      ctx.fillText(bad ? "triangle: odd cycle," : "path: 2-colorable,",
                   15.5 * CS, cy + R * 0.7 + 34);
      ctx.fillText(bad ? "  needs 3 masks" : "  A - B - A works",
                   15.5 * CS, cy + R * 0.7 + 50);
    }
    function fpin2(ctx, p, color, txt) {
      ctx.beginPath();
      ctx.arc(p.x * FS + FS / 2, p.y * FS + FS / 2, 7, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.font = "bold 9px 'JetBrains Mono', monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(txt, p.x * FS + FS / 2, p.y * FS + FS / 2 + 0.5);
      ctx.textBaseline = "alphabetic";
    }
    /* default: width 1 track, spacing 1 track. NDR: 2x width, 2x spacing */
    var MASK_A = "#2563eb", MASK_B = "#dc2626", UNCOL = "#6b7280", SPACER = "#16a34a";
    return { frames: [
      {
        paint: function (ctx) { bg(ctx); tracks(ctx, 4, 15);
          [5, 6, 7, 8, 9].forEach(function (y) { hwire(ctx, y, 2, 27, BLUE, 5); });
          panel(ctx, ["default rule", "width  1 track", "spacing 1 track", "pitch  1 track", "5 nets in 5 tracks"]); },
        cap: "The default rule: every wire is minimum width at minimum " +
             "spacing, one net per track. Five nets fill five tracks. " +
             "This is what the router assumes for the vast majority of " +
             "signals.",
      },
      {
        paint: function (ctx) { bg(ctx); tracks(ctx, 4, 15);
          hwire(ctx, 5, 2, 27, BLUE, 5);
          hwire(ctx, 7.5, 2, 27, GREEN, 12);
          hwire(ctx, 10, 2, 27, BLUE, 5);
          label(ctx, 28.3, 7.5, "NDR", GREEN_DEEP);
          panel(ctx, ["NDR (Non-Default Rule)", "width  2 tracks", "spacing 2 tracks", "pitch  4 tracks", "+R halves; coupling falls",
                      "!cost: 3 extra tracks"]); },
        cap: "A non-default rule, an NDR (Non-Default Rule): a named rule " +
             "set attached to " +
             "chosen nets, here double width and double spacing. The " +
             "wide wire (green) has half the resistance, and the wide " +
             "gap cuts coupling. It consumes the space of four default " +
             "tracks. Clocks and critical signals get NDRs (Non-Default " +
             "Rules); the router " +
             "must honour the wider width and spacing in its search.",
      },
      {
        paint: function (ctx) { bg(ctx); tracks(ctx, 4, 15);
          hwire(ctx, 5, 2, 27, BLUE, 5);
          hwire(ctx, 7.5, 2, 27, GREEN, 12);
          hwire(ctx, 10, 2, 27, BLUE, 5);
          /* NDR wire, tapered to default width near a pin */
          hwire(ctx, 7.5, 24, 27, GREEN, 5);
          ctx.fillStyle = "#fdfdfd"; ctx.fillRect(24 * FS, 6.5 * FS, 4 * FS, 2 * FS);
          hwire(ctx, 7.5, 24, 27, GREEN, 5);
          label(ctx, 24.2, 6.2, "taper", GREEN_DEEP);
          panel(ctx, ["NDR (Non-Default Rule)", "in the search:", "route the wide wire on", "  wide-spaced tracks", "taper to default width", "  to reach the pin",
                      "an NDR net costs the", "  capacity of ~4 nets"]); },
        cap: "In the search, an NDR (Non-Default Rule) net is a wider, more " +
             "expensive " +
             "occupant: it blocks the neighbouring tracks its spacing " +
             "requires, and it must taper back to default width to " +
             "reach a minimum-size pin. The congestion map charges it " +
             "for the capacity of roughly four ordinary nets, which is " +
             "why NDRs (Non-Default Rules) are rationed to the nets that " +
             "need them.",
      },
      {
        paint: function (ctx) { bg(ctx); tracks(ctx, 4, 15);
          [5, 6, 7, 8, 9].forEach(function (y, i) { hwire(ctx, y, 2, 27, i % 2 === 0 ? MASK_A : MASK_B, 5); });
          panel(ctx, ["LELE (Litho-Etch-Litho-Etch)", "one layer, two masks", "adjacent wires must", "  be on different masks",
                      "mask A / mask B alternate", "= 2-coloring the layout"]); },
        cap: "Multi-patterning: below the lithography limit, one metal " +
             "layer is printed as two masks, LELE (Litho-Etch-Litho-" +
             "Etch), and any two wires closer than the single-mask " +
             "pitch must be on different masks. Wires on adjacent " +
             "tracks alternate mask A (blue) and mask B (red): routing " +
             "on such a layer is also a 2-coloring problem.",
      },
      {
        paint: function (ctx) { bg(ctx); tracks(ctx, 4, 15);
          /* X on track 5 (mask A), Y on track 6 (mask B), and a U on
             tracks 5 and 7 whose top arm ends one column from X: X and
             the U are end-to-end within the coloring distance */
          hwire(ctx, 5, 2, 12, MASK_A, 5);                 /* X */
          hwire(ctx, 6, 2, 27, MASK_B, 5);                 /* Y */
          hwire(ctx, 5, 14, 27, UNCOL, 5);                 /* U top arm */
          hwire(ctx, 7, 14, 27, UNCOL, 5);                 /* U bottom arm */
          ctx.save(); ctx.strokeStyle = UNCOL; ctx.lineWidth = 5; ctx.beginPath();
          ctx.moveTo(27.5 * FS, 5 * FS + FS / 2); ctx.lineTo(27.5 * FS, 7 * FS + FS / 2); ctx.stroke(); ctx.restore();
          label(ctx, 0.5, 5, "X", MASK_A); label(ctx, 0.5, 6, "Y", MASK_B); label(ctx, 28.4, 6, "U", UNCOL);
          /* the too-close gap between X and U on track 5 */
          ctx.save(); ctx.strokeStyle = RED; ctx.lineWidth = 2; ctx.setLineDash([3, 3]);
          ctx.strokeRect(12.6 * FS, 4.55 * FS, 1.8 * FS, 0.9 * FS); ctx.restore();
          conflictGraph(ctx, [["X", MASK_A], ["Y", MASK_B], ["U", UNCOL]], [[0, 1], [1, 2], [0, 2]], true);
        },
        cap: "The conflict: three shapes, pairwise too close. X (track 5, " +
             "mask A) and Y (track 6, mask B) are on adjacent tracks. Y " +
             "runs beside both arms of the U (tracks 5 and 7). And the " +
             "U's top arm ends one column from X on the same track (red " +
             "box), inside the coloring distance. Every pair conflicts, " +
             "so the graph (right) is a triangle: X, Y, and U need three " +
             "masks and there are two. Every spacing rule is satisfied; " +
             "the layer is still unprintable.",
      },
      {
        paint: function (ctx) { bg(ctx); tracks(ctx, 4, 15);
          hwire(ctx, 5, 2, 12, MASK_A, 5);                 /* X */
          hwire(ctx, 6, 2, 27, MASK_B, 5);                 /* Y */
          hwire(ctx, 5, 17, 27, UNCOL, 5);                 /* U top arm, pulled back */
          hwire(ctx, 7, 14, 27, UNCOL, 5);                 /* U bottom arm */
          ctx.save(); ctx.strokeStyle = UNCOL; ctx.lineWidth = 5; ctx.beginPath();
          ctx.moveTo(27.5 * FS, 5 * FS + FS / 2); ctx.lineTo(27.5 * FS, 7 * FS + FS / 2); ctx.stroke(); ctx.restore();
          label(ctx, 0.5, 5, "X", MASK_A); label(ctx, 0.5, 6, "Y", MASK_B); label(ctx, 28.4, 6, "U", UNCOL);
          ctx.save(); ctx.strokeStyle = GREEN_DEEP; ctx.lineWidth = 2; ctx.setLineDash([3, 3]);
          ctx.strokeRect(12.6 * FS, 4.55 * FS, 4.8 * FS, 0.9 * FS); ctx.restore();
          conflictGraph(ctx, [["X", MASK_A], ["Y", MASK_B], ["U", MASK_A]], [[0, 1], [1, 2]], false);
        },
        cap: "Resolution: the router pulls the U's top arm back so its " +
             "end is farther from X than the coloring distance (green " +
             "box). X and U no longer conflict, the triangle loses an " +
             "edge, and the graph becomes a path X - Y - U, which is " +
             "2-colorable: X and U both take mask A, Y takes B. " +
             "Coloring-aware routers price the move that would close a " +
             "triangle before making it, instead of finding it in a " +
             "failed mask assignment afterwards.",
      },
      {
        paint: function (ctx) { bg(ctx);
          var LINE = "#b8b5aa";
          [4, 6, 8, 10, 12, 14].forEach(function (y) { hwire(ctx, y, 1, 28, LINE, 7); });
          label(ctx, 1, 2, "SADP layer as manufactured: continuous parallel lines, nothing else", INK);
          label(ctx, 1, 16, "the space between lines has NO metal and can never have any", RED);
          panel(ctx, ["SADP (Self-Aligned", "  Double Patterning)", "spacers made the lines", "  at fixed positions",
                      "one mask, no coloring", "the router does not draw", "  wires on this layer;", "  it CUTS lines"]); },
        cap: "The other family, SADP (Self-Aligned Double Patterning). " +
             "The spacer process (see the figure in The idea) leaves the " +
             "whole layer as continuous parallel metal lines at fixed " +
             "positions, and nothing between them. There is one mask, so " +
             "no coloring problem. But the router cannot draw wires here " +
             "the way it does on other layers: every line already " +
             "exists, and a wire is made by cutting a line into pieces.",
      },
      {
        paint: function (ctx) { bg(ctx);
          var LINE = "#b8b5aa";
          [4, 6, 8, 10, 12, 14].forEach(function (y) { hwire(ctx, y, 1, 28, LINE, 7); });
          /* pins: P on line 6 left, Q on line 10 right */
          fpin2(ctx, { x: 3, y: 6 }, GREEN_DEEP, "P"); fpin2(ctx, { x: 25, y: 10 }, BLUE, "Q");
          /* the wanted route: along line 6, jog down at column 14, along line 10 */
          hwire(ctx, 6, 3, 14, RED, 5);
          ctx.save(); ctx.strokeStyle = RED; ctx.lineWidth = 5; ctx.lineCap = "butt"; ctx.beginPath();
          ctx.moveTo(14.5 * FS, 6 * FS + FS / 2); ctx.lineTo(14.5 * FS, 10 * FS + FS / 2); ctx.stroke(); ctx.restore();
          hwire(ctx, 10, 14, 25, RED, 5);
          ctx.save(); ctx.strokeStyle = RED; ctx.lineWidth = 2.5; ctx.setLineDash([4, 3]);
          ctx.strokeRect(13.5 * FS, 6.9 * FS, 2 * FS, 2.7 * FS); ctx.restore();
          label(ctx, 16.5, 8, "ILLEGAL: this jog is metal between the lines", RED);
          label(ctx, 16.5, 9, "no spacer formed here, so no metal can exist", RED);
          label(ctx, 1, 2, "what a normal router would draw from P to Q", INK);
          panel(ctx, ["the wanted route", "along line 6, jog down,", "  along line 10",
                      "!the jog cannot be built:", "  it is off the lines"]); },
        cap: "The problem, concretely. Pin P sits on line 6, pin Q on " +
             "line 10. A normal router would run along line 6, jog down " +
             "at column 14, and run along line 10 (red). On an SADP " +
             "(Self-Aligned Double Patterning) layer the jog is " +
             "impossible: it lies between the lines, where no spacer " +
             "formed and no metal can ever exist. Not a spacing " +
             "violation, not a coloring conflict: the geometry simply " +
             "cannot be manufactured.",
      },
      {
        paint: function (ctx) { bg(ctx);
          var LINE = "#b8b5aa";
          [4, 6, 8, 10, 12, 14].forEach(function (y) { hwire(ctx, y, 1, 28, LINE, 7); });
          fpin2(ctx, { x: 3, y: 6 }, GREEN_DEEP, "P"); fpin2(ctx, { x: 25, y: 10 }, BLUE, "Q");
          /* legal: keep the two horizontal pieces on their lines */
          hwire(ctx, 6, 3, 14, SPACER, 5);
          hwire(ctx, 10, 14, 25, SPACER, 5);
          /* cuts that isolate the pieces from the rest of their lines */
          [[2, 6], [15, 6], [13, 10], [26, 10]].forEach(function (c) {
            ctx.save(); ctx.fillStyle = "#fdfdfd"; ctx.fillRect(c[0] * FS, c[1] * FS - 4, FS, FS + 8); ctx.restore();
            ctx.save(); ctx.strokeStyle = RED; ctx.lineWidth = 2.5;
            ctx.strokeRect(c[0] * FS + 1, c[1] * FS - 3, FS - 2, FS + 6); ctx.restore();
          });
          label(ctx, 1, 2, "step 1: keep the on-line pieces, isolate them with cuts (red)", INK);
          label(ctx, 16.5, 12.6, "cut = a small opening in a", RED);
          label(ctx, 16.5, 13.6, "second mask that removes metal", RED);
          panel(ctx, ["legal on SADP, part 1", "P's piece: line 6,", "  columns 3..14", "Q's piece: line 10,", "  columns 14..25",
                      "cuts end each piece", "the two pieces are not", "  yet connected"]); },
        cap: "The legal version, part 1: keep only what lies on lines. " +
             "P's piece is a segment of line 6, Q's piece a segment of " +
             "line 10, and each is isolated from the rest of its line by " +
             "cuts (red): small openings in a cut mask that remove " +
             "metal. The router's whole job on this layer is choosing " +
             "which line each piece rides and where the cuts go, subject " +
             "to cut-spacing rules. The two pieces are not yet joined.",
      },
      {
        paint: function (ctx) { bg(ctx);
          var LINE = "#b8b5aa";
          [4, 6, 8, 10, 12, 14].forEach(function (y) { hwire(ctx, y, 1, 28, LINE, 7); });
          fpin2(ctx, { x: 3, y: 6 }, GREEN_DEEP, "P"); fpin2(ctx, { x: 25, y: 10 }, BLUE, "Q");
          hwire(ctx, 6, 3, 14, SPACER, 5);
          hwire(ctx, 10, 14, 25, SPACER, 5);
          [[2, 6], [15, 6], [13, 10], [26, 10]].forEach(function (c) {
            ctx.save(); ctx.fillStyle = "#fdfdfd"; ctx.fillRect(c[0] * FS, c[1] * FS - 4, FS, FS + 8); ctx.restore();
            ctx.save(); ctx.strokeStyle = RED; ctx.lineWidth = 2.5;
            ctx.strokeRect(c[0] * FS + 1, c[1] * FS - 3, FS - 2, FS + 6); ctx.restore();
          });
          /* the connection on the layer above: vertical wire + 2 vias */
          ctx.save(); ctx.strokeStyle = MASK_A; ctx.lineWidth = 5; ctx.lineCap = "butt"; ctx.beginPath();
          ctx.moveTo(14.5 * FS, 6 * FS + FS / 2); ctx.lineTo(14.5 * FS, 10 * FS + FS / 2); ctx.stroke(); ctx.restore();
          ctx.fillStyle = INK;
          ctx.fillRect(14.5 * FS - 4.5, 6 * FS + FS / 2 - 4.5, 9, 9);
          ctx.fillRect(14.5 * FS - 4.5, 10 * FS + FS / 2 - 4.5, 9, 9);
          label(ctx, 16.5, 7.4, "the jog moves UP one layer (blue):", MASK_A);
          label(ctx, 16.5, 8.4, "a vertical wire on the layer above,", MASK_A);
          label(ctx, 16.5, 9.4, "landing on the two pieces by vias", MASK_A);
          label(ctx, 1, 2, "step 2: connect the pieces through the layer above", INK);
          panel(ctx, ["legal on SADP, part 2", "via up at column 14,", "  wire on layer above,", "  via down onto line 10",
                      "+P and Q connected", "cost of a track change:", "  2 vias + a wire on", "  the neighbouring layer"]); },
        cap: "The legal version, part 2: the jog moves up a layer. A " +
             "via at column 14 lifts the net from P's piece to the layer " +
             "above, a short vertical wire there (blue) spans the gap, " +
             "and a second via drops it onto Q's piece. P and Q are " +
             "connected with nothing between the SADP (Self-Aligned " +
             "Double Patterning) lines. This is what every track change " +
             "costs on such a layer, two vias and a wire next door, " +
             "and it is why routers on SADP layers avoid jogs " +
             "wherever they can.",
      },
    ], speed: 2000 };
  };

  /* ----- bus routing: structured nets kept matched ----- */
  BUILD["bus-route"] = function () {
    var FS = CS / 2, FW = 30, FH = 20;
    var N = 4; /* bit width shown */
    var srcX = 2, dstX = 27;
    var srcY0 = 12, dstY0 = 4; /* bit i at srcY0 + i and dstY0 + i */
    var OBS = { x0: 12, y0: 6, x1: 16, y1: 11 };
    var COLORS = [GREEN, BLUE, PURPLE, AMBER];
    function bg(ctx) {
      ctx.fillStyle = "#fdfdfd";
      ctx.fillRect(0, 0, W * CS, H * CS);
      ctx.strokeStyle = "#ebe9e2";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (var x = 0; x <= FW; x++) { ctx.moveTo(x * FS, 0); ctx.lineTo(x * FS, FH * FS); }
      for (var y = 0; y <= FH; y++) { ctx.moveTo(0, y * FS); ctx.lineTo(FW * FS, y * FS); }
      ctx.stroke();
      ctx.fillStyle = "#c9c6bc";
      ctx.fillRect(OBS.x0 * FS, OBS.y0 * FS, (OBS.x1 - OBS.x0 + 1) * FS, (OBS.y1 - OBS.y0 + 1) * FS);
      ctx.strokeStyle = "#9b9890"; ctx.lineWidth = 1.5;
      ctx.strokeRect(OBS.x0 * FS, OBS.y0 * FS, (OBS.x1 - OBS.x0 + 1) * FS, (OBS.y1 - OBS.y0 + 1) * FS);
      ctx.font = "10px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.fillStyle = MUT;
      ctx.fillText("macro", (OBS.x0 + OBS.x1 + 1) / 2 * FS, (OBS.y0 + OBS.y1 + 1) / 2 * FS + 4);
    }
    function fpoly(ctx, pts, color, w, dash) {
      ctx.save();
      if (dash) ctx.setLineDash([5, 4]);
      ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath();
      pts.forEach(function (p, i) {
        var X = p.x * FS + FS / 2, Y = p.y * FS + FS / 2;
        if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
      });
      ctx.stroke();
      ctx.restore();
    }
    function fpin(ctx, p, color, label) {
      ctx.beginPath();
      ctx.arc(p.x * FS + FS / 2, p.y * FS + FS / 2, 6, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 8px 'JetBrains Mono', monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(label, p.x * FS + FS / 2, p.y * FS + FS / 2 + 0.5);
      ctx.textBaseline = "alphabetic";
    }
    function pins(ctx) {
      for (var i = 0; i < N; i++) {
        fpin(ctx, { x: srcX, y: srcY0 + i }, COLORS[i], String(i));
        fpin(ctx, { x: dstX, y: dstY0 + i }, COLORS[i], String(i));
      }
    }
    function len(p) {
      var n = 0;
      for (var i = 1; i < p.length; i++) n += Math.abs(p[i].x - p[i-1].x) + Math.abs(p[i].y - p[i-1].y);
      return n;
    }
    /* independent routing: each bit takes its own shortest path around
       the macro; bits 0,1 go under, bits 2,3 go over -> topology differs */
    /* each bit routed alone against whatever was already there: bit 0
       goes left of the macro, bit 3 finds the left side taken and
       detours below and around the right, bits 1 and 2 bend late */
    var indep = [
      [{ x: 2, y: 12 }, { x: 10, y: 12 }, { x: 10, y: 4 }, { x: 27, y: 4 }],
      [{ x: 2, y: 13 }, { x: 18, y: 13 }, { x: 18, y: 5 }, { x: 27, y: 5 }],
      [{ x: 2, y: 14 }, { x: 19, y: 14 }, { x: 19, y: 6 }, { x: 27, y: 6 }],
      [{ x: 2, y: 15 }, { x: 5, y: 15 }, { x: 5, y: 17 }, { x: 22, y: 17 }, { x: 22, y: 7 }, { x: 27, y: 7 }],
    ];
    /* bus routing: all bits follow one trunk topology, adjacent tracks,
       same bend column, order preserved */
    var bus = [];
    for (var i = 0; i < N; i++) {
      var bx = 21 + i; /* staggered bend columns keep the bits from crossing */
      bus.push([{ x: srcX, y: srcY0 + i }, { x: bx, y: srcY0 + i }, { x: bx, y: dstY0 + i }, { x: dstX, y: dstY0 + i }]);
    }
    /* length matched version: equalize by adding serpentine to shorter bits */
    var busLens = bus.map(len);
    var maxL = Math.max.apply(null, busLens);
    function panel(ctx, lines) {
      var QX = 15.5;
      ctx.textAlign = "left";
      lines.forEach(function (l, k) {
        ctx.fillStyle = k === 0 ? INK : (l.charAt(0) === "!" ? RED : (l.charAt(0) === "+" ? GREEN_DEEP : MUT));
        ctx.font = (k === 0 ? "bold " : "") + "11px 'JetBrains Mono', monospace";
        ctx.fillText(l.replace(/^[!+]/, ""), QX * CS, 16 + k * 16);
      });
    }
    return { frames: [
      {
        paint: function (ctx) { bg(ctx); pins(ctx); },
        cap: "A " + N + "-bit bus: bit i leaves the source block on " +
             "row " + srcY0 + " + i and must arrive at the destination " +
             "on row " + dstY0 + " + i, with a macro in the way. " +
             "Electrically these are " + N + " ordinary nets; the " +
             "designer's intent is that they behave as one.",
      },
      {
        paint: function (ctx) { bg(ctx); indep.forEach(function (p, i) { fpoly(ctx, p, COLORS[i], 3.5); }); pins(ctx);
          panel(ctx, ["routed independently"].concat(indep.map(function (p, i) { return "bit " + i + ": length " + len(p); }))
                .concat(["!topologies differ", "!lengths spread " + (Math.max.apply(null, indep.map(len)) - Math.min.apply(null, indep.map(len))), "!bit 3 detoured around", "  the macro"])); },
        cap: "Routed as independent nets, each bit takes its own " +
             "cheapest path given what was already there: bit 0 bends " +
             "early and passes over the macro, bits 1 and 2 bend late, " +
             "and bit 3, arriving last, finds its row blocked and " +
             "detours under and around. Lengths now spread across " +
             (Math.max.apply(null, indep.map(len)) - Math.min.apply(null, indep.map(len))) +
             " cells, so the bits arrive skewed, and the mixed " +
             "topology scatters nets that switch together across the " +
             "region, each coupling to different neighbours.",
      },
      {
        paint: function (ctx) { bg(ctx); bus.forEach(function (p, i) { fpoly(ctx, p, COLORS[i], 3.5); }); pins(ctx);
          panel(ctx, ["routed as a bus"].concat(bus.map(function (p, i) { return "bit " + i + ": length " + len(p); }))
                .concat(["+one topology, no crossing", "+order preserved", "lengths spread " + (maxL - Math.min.apply(null, busLens))])); },
        cap: "Routed as a bus: the router treats the " + N + " bits as " +
             "one structured object. It plans a single trunk topology, " +
             "assigns the bits to adjacent tracks in order, and bends " +
             "them at staggered columns so they never cross. Same " +
             "endpoints, matched shape, lengths within " +
             (maxL - Math.min.apply(null, busLens)) + " cells of each " +
             "other, and no crossings.",
      },
      {
        paint: function (ctx) { bg(ctx); bus.forEach(function (p, i) { fpoly(ctx, p, COLORS[i], 3.5); }); pins(ctx);
          panel(ctx, ["how it is done", "1 group the bits (name /", "  constraint)", "2 route one representative",
                      "  or a widened trunk", "3 replicate on adjacent", "  tracks, order preserved", "4 fix ends (fan-in/out)"]); },
        cap: "The mechanism: bits are grouped by a bus constraint, the " +
             "router routes one representative path or a trunk as wide " +
             "as the whole group, then replicates it onto adjacent " +
             "tracks with the bit order preserved (a bus cannot twist " +
             "without crossings), and finally handles the fan-in and " +
             "fan-out at the pins. Track assignment on the trunk keeps " +
             "the group together.",
      },
      {
        paint: function (ctx) { bg(ctx);
          bus.forEach(function (p, i) { fpoly(ctx, p, COLORS[i], 3.5); });
          /* serpentine on the shortest bit to length-match */
          fpoly(ctx, [{ x: 4, y: 12 }, { x: 4, y: 10 }, { x: 6, y: 10 }, { x: 6, y: 12 }], COLORS[0], 3.5);
          pins(ctx);
          panel(ctx, ["length matching", "shortest bit gets a", "  serpentine (meander)", "+all bits within tolerance",
                      "used for DDR, SerDes,", "  matched clocks"]); },
        cap: "Where skew matters most, memory interfaces and matched " +
             "clock groups, the bus router also length-matches: shorter " +
             "bits receive serpentine meanders until every bit's length " +
             "is within tolerance of the longest. The bus stays a bus " +
             "through timing closure. Dedicated bus routers exist in " +
             "the commercial tools for exactly this class of nets.",
      },
    ], speed: 2000 };
  };

  /* ----- LELE versus SADP: what each looks like to the router ----- */
  BUILD["mpt-idea"] = function () {
    var FS = CS / 2, FW = 30, FH = 20;
    var MASK_A = "#2563eb", MASK_B = "#dc2626", MANDREL = "#7c3aed", SPACER = "#16a34a";
    function bg(ctx) {
      ctx.fillStyle = "#fdfdfd";
      ctx.fillRect(0, 0, W * CS, H * CS);
      ctx.strokeStyle = "#ebe9e2";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (var x = 0; x <= FW; x++) { ctx.moveTo(x * FS, 0); ctx.lineTo(x * FS, FH * FS); }
      for (var y = 0; y <= FH; y++) { ctx.moveTo(0, y * FS); ctx.lineTo(FW * FS, y * FS); }
      ctx.stroke();
    }
    /* plan-view wires: horizontal, one fine row each, in a region */
    function wire(ctx, y, x0, x1, color, w, dash) {
      ctx.save();
      if (dash) ctx.setLineDash([5, 4]);
      ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = "butt";
      ctx.beginPath();
      ctx.moveTo(x0 * FS, y * FS + FS / 2);
      ctx.lineTo((x1 + 1) * FS, y * FS + FS / 2);
      ctx.stroke();
      ctx.restore();
    }
    function title(ctx, x, y, txt, color) {
      ctx.font = "bold 11px 'JetBrains Mono', monospace";
      ctx.textAlign = "left";
      ctx.fillStyle = color || INK;
      ctx.fillText(txt, x * FS, y * FS);
    }
    function note(ctx, x, y, txt, color) {
      ctx.font = "10px 'JetBrains Mono', monospace";
      ctx.textAlign = "left";
      ctx.fillStyle = color || MUT;
      ctx.fillText(txt, x * FS, y * FS);
    }
    /* cross-section strip: a row of "resist / metal lines" drawn as
       small rectangles along a baseline, in a band of the canvas */
    function xsecBase(ctx, y) {
      ctx.save();
      ctx.strokeStyle = "#9b9890"; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(1 * FS, y * FS); ctx.lineTo(29 * FS, y * FS);
      ctx.stroke();
      ctx.restore();
    }
    function block(ctx, x, yBase, w, h, color, alpha) {
      ctx.save();
      if (alpha !== undefined) ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fillRect(x * FS, (yBase - h) * FS, w * FS, h * FS);
      ctx.strokeStyle = INK; ctx.lineWidth = 0.8;
      ctx.strokeRect(x * FS, (yBase - h) * FS, w * FS, h * FS);
      ctx.restore();
    }
    function graph(ctx, ox, oy, nodes, edges, bad, lines) {
      /* nodes: [[label, color]...] on a triangle around (ox, oy) in px */
      var R = 30;
      var pos = [{ x: ox, y: oy - R }, { x: ox - R, y: oy + R * 0.7 }, { x: ox + R, y: oy + R * 0.7 }];
      ctx.save();
      ctx.strokeStyle = bad ? RED : "#6b7280";
      ctx.lineWidth = 2;
      edges.forEach(function (e) {
        ctx.beginPath(); ctx.moveTo(pos[e[0]].x, pos[e[0]].y); ctx.lineTo(pos[e[1]].x, pos[e[1]].y); ctx.stroke();
      });
      ctx.restore();
      nodes.forEach(function (n, k) {
        ctx.beginPath(); ctx.arc(pos[k].x, pos[k].y, 10, 0, Math.PI * 2);
        ctx.fillStyle = n[1]; ctx.fill();
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = "#fff"; ctx.font = "bold 10px 'JetBrains Mono', monospace";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(n[0], pos[k].x, pos[k].y + 0.5);
        ctx.textBaseline = "alphabetic";
      });
      ctx.font = "10px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = bad ? RED : GREEN_DEEP;
      (lines || []).forEach(function (l, k) { ctx.fillText(l, ox, oy + R * 0.7 + 26 + k * 13); });
    }
    var frames = [];
    /* 1: the lithography limit */
    frames.push({
      paint: function (ctx) {
        bg(ctx);
        title(ctx, 1, 1.6, "single exposure: minimum printable pitch = 2 tracks");
        [3, 5, 7, 9].forEach(function (y) { wire(ctx, y, 2, 27, INK, 5); });
        note(ctx, 1, 11.2, "wanted: wires at pitch 1 (every track)");
        [12, 13, 14, 15, 16].forEach(function (y) { wire(ctx, y, 2, 27, "#9b9890", 5, y % 2 === 1); });
        note(ctx, 1, 18.4, "the dashed ones cannot be printed by the same exposure", RED);
      },
      cap: "The lithography limit, plan view: one exposure of one mask " +
           "can print lines no closer than a minimum pitch, here two " +
           "tracks. The design wants wires on every track (pitch one). " +
           "Half of them, the dashed ones, cannot be printed by the same " +
           "exposure as their neighbours. Two process families solve " +
           "this, and they look completely different to a router.",
    });
    /* 2: LELE process (cross-section) */
    frames.push({
      paint: function (ctx) {
        bg(ctx);
        title(ctx, 1, 1.6, "LELE (Litho-Etch-Litho-Etch): two masks, two exposures", MASK_A);
        note(ctx, 1, 3.2, "cross-section, wires end-on");
        note(ctx, 1, 6.6, "1  mask A: expose + etch");
        xsecBase(ctx, 8.6);
        [4, 8, 12, 16, 20, 24].forEach(function (x) { block(ctx, x, 8.6, 1, 1.4, MASK_A); });
        note(ctx, 1, 11.6, "2  mask B: expose + etch, offset by one track");
        xsecBase(ctx, 13.6);
        [4, 8, 12, 16, 20, 24].forEach(function (x) { block(ctx, x, 13.6, 1, 1.4, MASK_A); });
        [6, 10, 14, 18, 22, 26].forEach(function (x) { block(ctx, x, 13.6, 1, 1.4, MASK_B); });
        note(ctx, 1, 16.6, "result: pitch 1, but adjacent lines are on different masks", INK);
        note(ctx, 1, 18.2, "any two shapes closer than the single-mask pitch must differ in mask", RED);
      },
      cap: "LELE (Litho-Etch-Litho-Etch): print half the lines with " +
           "mask A, then print the other half with mask B, offset by " +
           "one track. Each mask alone respects the limit; together they " +
           "reach pitch one. The consequence for layout: any two shapes " +
           "closer than the single-mask pitch must be on different " +
           "masks. That is a constraint on the design, and the layout " +
           "must be assignable to two masks.",
    });
    /* 3: how the router sees LELE: coloring */
    frames.push({
      paint: function (ctx) {
        bg(ctx);
        title(ctx, 1, 1.6, "how the router sees LELE: a 2-coloring problem", MASK_A);
        [3, 4, 5, 6, 7].forEach(function (y, i) { wire(ctx, y, 2, 14, i % 2 === 0 ? MASK_A : MASK_B, 5); });
        note(ctx, 2, 9.0, "adjacent wires alternate A / B: fine");
        /* graph of the clean case: a path, 2-colorable */
        graph(ctx, 21 * FS + 6, 4.6 * FS, [["1", MASK_A], ["2", MASK_B], ["3", MASK_A]], [[0, 1], [1, 2]], false,
              ["path: 2-colorable"]);
        /* graph of the conflict case: triangle */
        graph(ctx, 21 * FS + 6, 13.6 * FS, [["X", MASK_A], ["Y", MASK_B], ["U", "#6b7280"]], [[0, 1], [1, 2], [0, 2]], true,
              ["triangle: odd cycle", "no 2-coloring"]);
        /* conflict: X (A) on row 12, Y (B) on row 13, and a U on rows
           12 and 14 whose top arm ends one column from X: X-Y adjacent
           tracks, Y-U adjacent tracks, X-U end-to-end too close */
        wire(ctx, 12, 2, 8, MASK_A, 5);
        wire(ctx, 13, 2, 17, MASK_B, 5);
        wire(ctx, 12, 10, 17, "#6b7280", 5);
        wire(ctx, 14, 10, 17, "#6b7280", 5);
        ctx.save(); ctx.strokeStyle = "#6b7280"; ctx.lineWidth = 5; ctx.beginPath();
        ctx.moveTo(17.5 * FS, 12 * FS + FS / 2); ctx.lineTo(17.5 * FS, 14 * FS + FS / 2); ctx.stroke(); ctx.restore();
        ctx.save(); ctx.strokeStyle = RED; ctx.lineWidth = 2; ctx.setLineDash([3, 3]);
        ctx.strokeRect(8.6 * FS, 11.55 * FS, 1.8 * FS, 0.9 * FS); ctx.restore();
        ctx.font = "bold 10px 'JetBrains Mono', monospace"; ctx.textAlign = "left";
        ctx.fillStyle = MASK_A; ctx.fillText("X", 0.6 * FS, 12 * FS + FS / 2 + 3.5);
        ctx.fillStyle = MASK_B; ctx.fillText("Y", 0.6 * FS, 13 * FS + FS / 2 + 3.5);
        ctx.fillStyle = "#6b7280"; ctx.fillText("U", 18.4 * FS, 13 * FS + FS / 2 + 3.5);
        note(ctx, 2, 16.6, "X-Y adjacent tracks; Y beside both arms of U;", RED);
        note(ctx, 2, 18.0, "U's top arm ends too close to X (red box)", RED);
      },
      cap: "How the router sees LELE (Litho-Etch-Litho-Etch): every " +
           "wire is a node, every too-close pair is an edge, and the " +
           "layer is manufacturable only if that conflict graph can be " +
           "2-colored. Alternating tracks color trivially. Below: X and " +
           "Y are on adjacent tracks, Y runs beside both arms of the " +
           "grey U, and the U's top arm ends too close to X on the same " +
           "track. Three pairwise conflicts form a triangle, an odd " +
           "cycle, and no assignment of two masks exists. Spacing was " +
           "legal; coloring was not. The router must avoid closing " +
           "such cycles.",
    });
    /* 4: SADP process (cross-section) */
    frames.push({
      paint: function (ctx) {
        bg(ctx);
        title(ctx, 1, 1.6, "SADP (Self-Aligned Double Patterning): one mask, spacers", SPACER);
        note(ctx, 1, 3.2, "cross-section, wires end-on");
        note(ctx, 1, 5.6, "1  print mandrels at the loose pitch (mask)");
        xsecBase(ctx, 7.4);
        [5, 11, 17, 23].forEach(function (x) { block(ctx, x, 7.4, 2, 1.4, MANDREL, 0.6); });
        note(ctx, 1, 9.8, "2  deposit a spacer film on every mandrel sidewall (no mask)");
        xsecBase(ctx, 11.6);
        [5, 11, 17, 23].forEach(function (x) {
          block(ctx, x, 11.6, 2, 1.4, MANDREL, 0.6);
          block(ctx, x - 1, 11.6, 1, 1.4, SPACER);
          block(ctx, x + 2, 11.6, 1, 1.4, SPACER);
        });
        note(ctx, 1, 14.0, "3  remove mandrels; spacers define the lines: pitch halved");
        xsecBase(ctx, 15.8);
        [5, 11, 17, 23].forEach(function (x) {
          block(ctx, x - 1, 15.8, 1, 1.4, SPACER);
          block(ctx, x + 2, 15.8, 1, 1.4, SPACER);
        });
        note(ctx, 1, 18.2, "every line sits exactly where a spacer formed: a fixed 1D grid", INK);
      },
      cap: "SADP (Self-Aligned Double Patterning): print coarse " +
           "mandrels with one mask, coat their sidewalls with a spacer " +
           "film, then remove the mandrels. The spacers, two per " +
           "mandrel, are the lines, at half the mandrel pitch, and " +
           "their positions are set by the film thickness, not by a " +
           "second mask. No second exposure, so no mask assignment and " +
           "no coloring problem, but the lines can only exist where " +
           "spacers formed.",
    });
    /* 5: how the router sees SADP: an example */
    frames.push({
      paint: function (ctx) {
        bg(ctx);
        title(ctx, 1, 1.6, "how the router sees SADP: a fixed 1D grid, cuts only", SPACER);
        note(ctx, 1, 3.2, "the whole layer is pre-drawn as parallel lines (grey); a wire = a line piece between cuts");
        /* left: what the router would like to do (illegal here) */
        note(ctx, 1, 5.2, "wanted (illegal on SADP):", RED);
        [6, 7, 8, 9].forEach(function (y) { wire(ctx, y, 1, 13, "#c9c6bc", 5); });
        /* an L with a jog: horizontal on line 7 then a vertical jog to line 9 */
        wire(ctx, 7, 1, 6, RED, 5);
        ctx.save(); ctx.strokeStyle = RED; ctx.lineWidth = 5; ctx.lineCap = "butt"; ctx.beginPath();
        ctx.moveTo(6.5 * FS, 7 * FS + FS / 2); ctx.lineTo(6.5 * FS, 9 * FS + FS / 2); ctx.stroke(); ctx.restore();
        wire(ctx, 9, 6, 13, RED, 5);
        ctx.save(); ctx.strokeStyle = RED; ctx.lineWidth = 2; ctx.setLineDash([3, 3]);
        ctx.strokeRect(5.9 * FS, 6.6 * FS, 1.2 * FS, 3.3 * FS); ctx.restore();
        note(ctx, 1, 11.2, "the jog is metal between the lines:", RED);
        note(ctx, 1, 12.4, "no spacer formed there, it cannot exist", RED);
        /* right: the legal version */
        note(ctx, 16, 5.2, "legal on SADP:", GREEN_DEEP);
        [6, 7, 8, 9].forEach(function (y) { wire(ctx, y, 16, 28, "#c9c6bc", 5); });
        wire(ctx, 7, 16, 21, SPACER, 5);
        wire(ctx, 9, 23, 28, SPACER, 5);
        /* cuts that end the pieces */
        [[22, 7], [22, 9]].forEach(function (c) {
          ctx.save(); ctx.strokeStyle = RED; ctx.lineWidth = 2;
          ctx.strokeRect(c[0] * FS + 1, c[1] * FS + 1, FS - 2, FS - 2); ctx.restore();
        });
        /* the connection between the two pieces happens on the layer
           above: a via at each end and a vertical wire on that layer */
        ctx.save(); ctx.strokeStyle = MASK_A; ctx.lineWidth = 3; ctx.setLineDash([4, 3]); ctx.beginPath();
        ctx.moveTo(21.5 * FS, 7 * FS + FS / 2); ctx.lineTo(21.5 * FS, 9 * FS + FS / 2); ctx.stroke(); ctx.restore();
        ctx.fillStyle = INK;
        ctx.fillRect(21.5 * FS - 3.5, 7 * FS + FS / 2 - 3.5, 7, 7);
        ctx.fillRect(21.5 * FS - 3.5, 9 * FS + FS / 2 - 3.5, 7, 7);
        note(ctx, 16, 11.2, "two line pieces (green), ended by cuts (red);", GREEN_DEEP);
        note(ctx, 16, 12.4, "the jog moves to the layer above (dashed) via 2 vias", GREEN_DEEP);
        note(ctx, 1, 15.0, "the router's freedom on this layer: which line, where to cut, subject to cut-spacing rules;", INK);
        note(ctx, 1, 16.4, "every change of track costs two vias and a wire on the neighbouring layer.", INK);
        note(ctx, 1, 18.4, "no coloring problem exists, because there is no second mask to assign", INK);
      },
      cap: "How the router sees SADP (Self-Aligned Double Patterning): " +
           "the layer arrives as a fixed grid of parallel lines, and a " +
           "wire is a piece of a line between two cuts. Left, what a " +
           "gridded router would normally do: a jog from line 7 to line " +
           "9. It cannot exist, because no spacer formed between the " +
           "lines and there is no metal there to keep. Right, the legal " +
           "form: two line pieces ended by cuts, joined through the " +
           "layer above with two vias. The router's freedom shrinks to " +
           "choosing lines and cut positions; every track change costs " +
           "vias. No coloring, because there is no second mask.",
    });
    /* 6: side by side */
    frames.push({
      paint: function (ctx) {
        bg(ctx);
        title(ctx, 1, 1.6, "LELE", MASK_A);
        [3, 4, 5, 6, 7].forEach(function (y, i) { wire(ctx, y, 1, 13, i % 2 === 0 ? MASK_A : MASK_B, 5); });
        note(ctx, 1, 9.4, "2 masks; free geometry;");
        note(ctx, 1, 10.8, "constraint = 2-colorable");
        note(ctx, 1, 12.2, "router keeps the conflict");
        note(ctx, 1, 13.6, "  graph bipartite");
        note(ctx, 1, 15.0, "cost: overlay error between");
        note(ctx, 1, 16.4, "  masks; coloring conflicts");
        title(ctx, 16, 1.6, "SADP", SPACER);
        [3, 4, 5, 6, 7].forEach(function (y) { wire(ctx, y, 16, 28, "#c9c6bc", 5); });
        wire(ctx, 4, 16, 21, SPACER, 5); wire(ctx, 4, 24, 28, SPACER, 5);
        wire(ctx, 6, 16, 28, SPACER, 5);
        [[22, 4], [23, 4]].forEach(function (c) {
          ctx.save(); ctx.strokeStyle = RED; ctx.lineWidth = 2;
          ctx.strokeRect(c[0] * FS + 1, c[1] * FS + 1, FS - 2, FS - 2); ctx.restore();
        });
        note(ctx, 16, 9.4, "1 mask + spacers + cuts;");
        note(ctx, 16, 10.8, "constraint = fixed 1D grid");
        note(ctx, 16, 12.2, "router chooses line pieces");
        note(ctx, 16, 13.6, "  and cut positions");
        note(ctx, 16, 15.0, "cost: no jogs / wrong-way;");
        note(ctx, 16, 16.4, "  cut-spacing rules");
        note(ctx, 1, 19.2, "same goal, pitch below the lithography limit; opposite constraints on the router", INK);
      },
      cap: "Side by side. LELE (Litho-Etch-Litho-Etch) keeps geometric " +
           "freedom and adds a coloring constraint, so the router " +
           "reasons about a conflict graph and mask overlay error. " +
           "SADP (Self-Aligned Double Patterning) removes the coloring " +
           "problem and most of the freedom, so the router reasons " +
           "about a fixed line grid and cut-mask rules. Same goal, " +
           "opposite constraints; which one a node uses is decided by " +
           "the process, and the router must model whichever it gets.",
    });
    return { frames: frames, speed: 2600 };
  };

  /* =========================================================
     foundry-process figures (plan views, cross-sections, charts)
     ========================================================= */
  function pfBg(ctx, w, h) {
    ctx.fillStyle = "#fdfdfd";
    ctx.fillRect(0, 0, (w || W) * CS, (h || H) * CS);
  }
  function pfBox(ctx, x, y, w, h, fill, stroke, alpha) {
    ctx.save();
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
    if (stroke) {
      ctx.strokeStyle = stroke; ctx.lineWidth = 1.2;
      ctx.strokeRect(x, y, w, h);
    }
  }
  function pfText(ctx, x, y, txt, opts) {
    opts = opts || {};
    ctx.font = (opts.bold ? "bold " : "") + (opts.size || 11) + "px 'JetBrains Mono', monospace";
    ctx.textAlign = opts.align || "left";
    ctx.fillStyle = opts.color || INK;
    ctx.fillText(txt, x, y);
  }
  function pfArrow(ctx, x0, y0, x1, y1, color) {
    ctx.save();
    ctx.strokeStyle = color || INK; ctx.fillStyle = color || INK; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    var a = Math.atan2(y1 - y0, x1 - x0);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - 7 * Math.cos(a - 0.4), y1 - 7 * Math.sin(a - 0.4));
    ctx.lineTo(x1 - 7 * Math.cos(a + 0.4), y1 - 7 * Math.sin(a + 0.4));
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  /* ----- pdk-map: which file feeds which stage ----- */
  BUILD["pdk-map"] = function () {
    var files = [
      { n: "tech LEF", d: "layers, pitches,\nvias, rules", c: BLUE },
      { n: "cell LEF", d: "cell size, pins,\nblockages", c: GREEN },
      { n: "Liberty", d: "delay / power\ntables per corner", c: PURPLE },
      { n: "RC tables", d: "wire R and C\nper layer", c: AMBER },
      { n: "DRC / LVS", d: "sign-off decks", c: RED },
      { n: "GDSII cells", d: "full cell\nlayouts", c: TEAL },
    ];
    var stages = ["synthesis", "floorplan", "place", "CTS", "route", "STA", "sign-off"];
    /* which files each stage reads (indices into files) */
    var reads = {
      synthesis: [2], floorplan: [0, 1], place: [0, 1, 2], CTS: [0, 1, 2],
      route: [0, 1], STA: [2, 3], "sign-off": [4, 5, 0],
    };
    var PW = 20, PH = 11.2;  /* canvas: wider and a little taller */
    var fx = 0.8 * CS, fw = 6.2 * CS, fh = 1.42 * CS, fy0 = 0.75 * CS, fgap = 0.3 * CS;
    var sx = 12.6 * CS, sw = 6.4 * CS, sh = 1.16 * CS, sy0 = 0.75 * CS, sgap = 0.32 * CS;
    function paint(k) {
      return function (ctx) {
        pfBg(ctx, PW, PH);
        pfText(ctx, fx, 0.5 * CS, "PDK (Process Design Kit) files", { bold: true });
        pfText(ctx, sx, 0.5 * CS, "flow stages", { bold: true });
        files.forEach(function (f, i) {
          var y = fy0 + i * (fh + fgap);
          var on = k < 0 || reads[stages[k]].indexOf(i) >= 0;
          pfBox(ctx, fx, y, fw, fh, f.c, "#9b9890", on ? 0.22 : 0.06);
          pfText(ctx, fx + 10, y + 16, f.n, { bold: true, size: 12, color: on ? INK : "#b0ada4" });
          f.d.split("\n").forEach(function (line, j) {
            pfText(ctx, fx + 10, y + 29 + j * 12, line, { size: 10.5, color: on ? MUT : "#c4c1b8" });
          });
        });
        stages.forEach(function (s, i) {
          var y = sy0 + i * (sh + sgap);
          var on = k === i;
          pfBox(ctx, sx, y, sw, sh, on ? GREEN : "#eceae2", on ? GREEN_DEEP : "#9b9890", on ? 0.25 : 1);
          pfText(ctx, sx + sw / 2, y + sh / 2 + 4, s, { bold: on, size: 12, align: "center", color: on ? GREEN_DEEP : MUT });
          if (on) {
            reads[s].forEach(function (fi) {
              var fyc = fy0 + fi * (fh + fgap) + fh / 2;
              pfArrow(ctx, fx + fw + 4, fyc, sx - 4, y + sh / 2, files[fi].c);
            });
          }
        });
      };
    }
    var caps = [
      "The kit on the left, the flow on the right. Each stage reads a " +
      "subset of the files; the arrows in the following steps show " +
      "which. Nothing in place-and-route reads the full cell layouts: " +
      "the flow works entirely on abstractions until sign-off.",
      "Synthesis reads only Liberty: it needs each cell's function, " +
      "delay, and area to map logic, and nothing about geometry.",
      "Floorplanning reads the technology LEF (Library Exchange " +
      "Format) for layers, pitches, and rules, and the cell LEF for " +
      "cell and macro sizes; the die, rows, and power grid are built " +
      "from these.",
      "Placement reads the same LEF (Library Exchange Format) files " +
      "for sites, rows, and cell footprints, plus Liberty for the " +
      "timing it optimizes against.",
      "CTS (Clock Tree Synthesis) reads LEF (Library Exchange Format) " +
      "for where buffers can go and Liberty for their delays and the " +
      "flops' clock pins.",
      "Routing reads the technology LEF (Library Exchange Format) " +
      "for tracks, vias, spacing tables, and antenna rules, and the " +
      "cell LEF for pin shapes and blockages: everything the router " +
      "knows about the process is in these two files.",
      "STA (Static Timing Analysis) reads Liberty tables and, after " +
      "routing, the parasitic tables that turn wire geometry into " +
      "resistance and capacitance.",
      "Sign-off merges the routed abstract layout with the full cell " +
      "layouts (GDSII (Graphic Design System II)) and runs the DRC " +
      "(Design Rule Check) and LVS (Layout Versus Schematic) decks " +
      "against the result: the first and only time the flow sees a " +
      "transistor.",
    ];
    var frames = [{ paint: paint(-1), cap: caps[0] }];
    stages.forEach(function (s, i) { frames.push({ paint: paint(i), cap: caps[i + 1] }); });
    return { frames: frames, w: PW, h: PH, speed: 2200 };
  };

  /* ----- stdcell-rows: rows, sites, and tiling on a fake die ----- */
  BUILD["stdcell-rows"] = function () {
    var ox = 1.0 * CS, oy = 0.9 * CS;
    var coreW = 12.6 * CS, rowH = 0.95 * CS, nRows = 8, siteW = 0.42 * CS;
    var nSites = Math.floor(coreW / siteW);
    /* deterministic pseudo-random cell widths (in sites) per row */
    var seed = 11;
    function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    var rows = [];
    for (var r = 0; r < nRows; r++) {
      var cells = [], s = 0;
      while (s < nSites) {
        var w = [1, 2, 2, 3, 3, 4, 5, 6][Math.floor(rnd() * 8)];
        if (s + w > nSites) w = nSites - s;
        var gap = rnd() < 0.18 ? 1 : 0; /* leave a site empty sometimes */
        cells.push({ s: s, w: w, filler: false });
        s += w;
        if (gap && s < nSites) { cells.push({ s: s, w: 1, filler: true }); s += 1; }
      }
      rows.push(cells);
    }
    var COLORS = ["#c7d2fe", "#bbf7d0", "#fde68a", "#fecaca", "#e9d5ff", "#a5f3fc"];
    function die(ctx) {
      pfBg(ctx);
      pfBox(ctx, ox - 0.4 * CS, oy - 0.4 * CS, coreW + 0.8 * CS, nRows * rowH + 0.8 * CS, "#f4f3ee", "#1a1d26");
      pfText(ctx, ox - 0.4 * CS, oy - 0.5 * CS, "die (core area shown)", { size: 10, color: MUT });
    }
    function rowsOnly(ctx, hl) {
      for (var r = 0; r < nRows; r++) {
        var y = oy + r * rowH;
        pfBox(ctx, ox, y, coreW, rowH, r === hl ? "#dbeafe" : "#eceae2", "#9b9890");
      }
    }
    function rails(ctx) {
      for (var r = 0; r <= nRows; r++) {
        var y = oy + r * rowH;
        var isVdd = r % 2 === 0;
        pfBox(ctx, ox, y - 3, coreW, 6, isVdd ? "#374151" : "#6b7280", null);
        pfText(ctx, ox + coreW + 6, y + 4, isVdd ? "VDD" : "VSS", { size: 9, color: MUT });
      }
    }
    function orientArrows(ctx) {
      for (var r = 0; r < nRows; r++) {
        var y = oy + r * rowH + rowH / 2;
        var up = r % 2 === 0; /* even rows: VDD on top -> "N" orientation; odd: flipped */
        pfText(ctx, ox - 14, y + 4, up ? "N" : "FS", { size: 9, align: "right", color: MUT });
      }
      pfText(ctx, ox - 14, oy + nRows * rowH + 22, "orientation", { size: 9, align: "right", color: MUT });
    }
    function sites(ctx, rowIdx) {
      var y = oy + rowIdx * rowH;
      ctx.save(); ctx.strokeStyle = "#9ca3af"; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
      for (var s = 1; s < nSites; s++) { ctx.beginPath(); ctx.moveTo(ox + s * siteW, y + 4); ctx.lineTo(ox + s * siteW, y + rowH - 4); ctx.stroke(); }
      ctx.restore();
    }
    function cellsIn(ctx, rowIdx, upto) {
      var y = oy + rowIdx * rowH;
      rows[rowIdx].forEach(function (c, k) {
        if (upto !== undefined && k > upto) return;
        var col = c.filler ? "#f4f3ee" : COLORS[(k + rowIdx) % COLORS.length];
        pfBox(ctx, ox + c.s * siteW + 1, y + 5, c.w * siteW - 2, rowH - 10, col, c.filler ? "#c9c6bc" : "#4b5563", 0.95);
        if (!c.filler && c.w >= 2) pfText(ctx, ox + (c.s + c.w / 2) * siteW, y + rowH / 2 + 3, c.w + "s", { size: 8, align: "center", color: "#374151" });
      });
    }
    function allCells(ctx) { for (var r = 0; r < nRows; r++) cellsIn(ctx, r); }
    return { frames: [
      { paint: function (ctx) { die(ctx); },
        cap: "A die, seen from above: the core area where standard cells will go. Nothing is placed yet; the floorplan has only fixed its outline." },
      { paint: function (ctx) { die(ctx); rowsOnly(ctx, -1); },
        cap: "The core is divided into rows of one cell height each, running the full width. Every standard cell has this height, so any cell fits any row." },
      { paint: function (ctx) { die(ctx); rowsOnly(ctx, -1); rails(ctx); orientArrows(ctx); },
        cap: "Power rails run along the row boundaries: VDD (positive supply) and VSS (ground) alternate. Adjacent rows share a rail, so every other row is flipped (orientation N versus FS in LEF (Library Exchange Format) terms) to put its supply pin against the shared rail." },
      { paint: function (ctx) { die(ctx); rowsOnly(ctx, 3); rails(ctx); orientArrows(ctx); sites(ctx, 3); pfText(ctx, ox, oy + nRows * rowH + 22, "one row: " + nSites + " sites at the site width (contacted gate pitch)", { size: 10, color: "#1d4ed8" }); },
        cap: "Along a row, positions are quantized into sites (dashed): the site width is the process's contacted gate pitch, so one site is one transistor column. A cell may start only at a site boundary; this is what makes placement a discrete problem." },
      { paint: function (ctx) { die(ctx); rowsOnly(ctx, 3); rails(ctx); orientArrows(ctx); sites(ctx, 3); cellsIn(ctx, 3); },
        cap: "Cells of different widths tile the row end to end: 1, 2, 3 sites and up (labels are widths in sites), all the same height. Empty sites are filled with filler cells (pale) so the rails and wells stay continuous." },
      { paint: function (ctx) { die(ctx); rowsOnly(ctx, -1); rails(ctx); allCells(ctx); },
        cap: "The whole core placed: every row tiled with cells on site boundaries, rails shared between flipped rows, fillers closing the gaps. This is the geometry placement produces and routing takes as given; each cell's internal structure is the next figure." },
    ], speed: 2400 };
  };

  /* ----- stdcell-anatomy: a cell in plan view, built up ----- */
  BUILD["stdcell-anatomy"] = function () {
    var FS = CS / 2;
    var cx = 3 * FS, cy = 3 * FS, sites = 6, sitew = 3 * FS, tracks = 9, pitch = 1.4 * FS;
    var cw = sites * sitew, ch = tracks * pitch;
    function outline(ctx) {
      pfBox(ctx, cx, cy, cw, ch, "#eceae2", "#9b9890");
    }
    function railsF(ctx) {
      pfBox(ctx, cx, cy - 4, cw, 8, "#6b7280", null);
      pfBox(ctx, cx, cy + ch - 4, cw, 8, "#6b7280", null);
      pfText(ctx, cx + cw + 8, cy + 4, "VDD rail (shared with row above)", { size: 10, color: MUT });
      pfText(ctx, cx + cw + 8, cy + ch + 4, "VSS rail (shared with row below)", { size: 10, color: MUT });
    }
    function siteLines(ctx) {
      ctx.save(); ctx.strokeStyle = "#c9c6bc"; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
      for (var i = 1; i < sites; i++) { ctx.beginPath(); ctx.moveTo(cx + i * sitew, cy); ctx.lineTo(cx + i * sitew, cy + ch); ctx.stroke(); }
      ctx.restore();
      pfText(ctx, cx, cy + ch + 22, "width = " + sites + " sites", { size: 10, color: MUT });
    }
    function trackLines(ctx) {
      ctx.save(); ctx.strokeStyle = "rgba(47,111,237,0.45)"; ctx.lineWidth = 1;
      for (var t = 0; t < tracks; t++) { var y = cy + (t + 0.5) * pitch; ctx.beginPath(); ctx.moveTo(cx - 12, y); ctx.lineTo(cx + cw + 12, y); ctx.stroke(); }
      ctx.restore();
      pfText(ctx, cx - 16, cy + ch / 2 + 4, tracks + " tracks tall", { size: 10, color: MUT, align: "right" });
    }
    function devices(ctx) {
      /* diffusion bands + poly gates, schematic */
      pfBox(ctx, cx + 0.5 * sitew, cy + 1.2 * pitch, cw - sitew, 2.4 * pitch, "#c7d2fe", "#6366f1", 0.8);
      pfBox(ctx, cx + 0.5 * sitew, cy + 5.4 * pitch, cw - sitew, 2.4 * pitch, "#bbf7d0", "#16a34a", 0.8);
      pfText(ctx, cx + 0.5 * sitew + 4, cy + 1.2 * pitch - 4, "p-type diffusion", { size: 9, color: "#4f46e5" });
      pfText(ctx, cx + 0.5 * sitew + 4, cy + 7.8 * pitch + 12, "n-type diffusion", { size: 9, color: GREEN_DEEP });
      [1.5, 2.5, 3.5, 4.5].forEach(function (s) {
        pfBox(ctx, cx + s * sitew - 3, cy + 0.6 * pitch, 6, ch - 1.2 * pitch, "#dc2626", null, 0.75);
      });
      pfText(ctx, cx + 1.5 * sitew - 3, cy + 0.6 * pitch - 4, "poly gates at fixed gate pitch", { size: 9, color: RED });
    }
    function pins(ctx) {
      var ys = [3.5, 4.5, 5.5];
      [[1.0, "A"], [2.0, "B"], [3.0, "C"]].forEach(function (p, i) {
        var y = cy + ys[i % ys.length] * pitch;
        pfBox(ctx, cx + p[0] * sitew - 4, y - 5, 8, 10, "#1d4ed8", null);
        pfText(ctx, cx + p[0] * sitew, y - 8, p[1], { size: 9, align: "center", color: "#1d4ed8", bold: true });
      });
      pfBox(ctx, cx + 4.5 * sitew - 4, cy + 4.5 * pitch - 12, 8, 24, "#1d4ed8", null);
      pfText(ctx, cx + 4.5 * sitew, cy + 4.5 * pitch - 16, "Y", { size: 9, align: "center", color: "#1d4ed8", bold: true });
      pfText(ctx, cx, cy + ch + 36, "pins on M1 land on routing tracks; the router accesses them from M2", { size: 10, color: "#1d4ed8" });
    }
    function abstract(ctx) {
      pfBox(ctx, cx, cy, cw, ch, "#fde68a", "#b45309", 0.35);
      pfText(ctx, cx + cw / 2, cy + ch / 2 + 4, "NAND3_X1  (what placement sees)", { align: "center", bold: true, color: "#92400e" });
    }
    return { frames: [
      { paint: function (ctx) { pfBg(ctx); outline(ctx); railsF(ctx); },
        cap: "A standard cell in plan view: a rectangle of fixed height with a VDD (positive supply) rail along its top edge and a VSS (ground) rail along its bottom. Rows abut rail to rail, alternating orientation, so adjacent rows share their rails." },
      { paint: function (ctx) { pfBg(ctx); outline(ctx); railsF(ctx); siteLines(ctx); trackLines(ctx); },
        cap: "The grid it lives on: the height is an integer number of routing tracks (9 here), the width an integer number of sites. Every cell in the library has this height, so placement is a discrete problem of choosing a row and a site." },
      { paint: function (ctx) { pfBg(ctx); outline(ctx); railsF(ctx); siteLines(ctx); trackLines(ctx); devices(ctx); },
        cap: "Inside: a p-type diffusion band under the VDD (positive supply) rail, an n-type band above the VSS (ground) rail, and poly gates crossing both at the process's fixed gate pitch. Wider devices (more sites, or more fins on a FinFET node) give higher drive strength." },
      { paint: function (ctx) { pfBg(ctx); outline(ctx); railsF(ctx); siteLines(ctx); trackLines(ctx); devices(ctx); pins(ctx); },
        cap: "The pins: small M1 shapes for inputs A, B, C and output Y, positioned so that M2 routing tracks cross them. Whether every pin has a legal via landing is the pin-access problem covered in the routing section." },
      { paint: function (ctx) { pfBg(ctx); outline(ctx); railsF(ctx); siteLines(ctx); trackLines(ctx); abstract(ctx); pins(ctx); },
        cap: "What the flow sees: a named box of known height and width (the LEF (Library Exchange Format) abstract), pin shapes and internal blockages for the router, and Liberty tables for timing. The transistors return only at sign-off, when the full layouts are merged." },
    ], speed: 2400 };
  };

  /* ----- metal-stack: cross-section, built layer by layer ----- */
  BUILD["metal-stack"] = function () {
    var layers = [
      { n: "M1",  t: 10, p: 0.5,  c: "#93c5fd", dir: "H", note: "local: cell pins, short hops" },
      { n: "M2",  t: 10, p: 0.5,  c: "#60a5fa", dir: "V", note: "fine pitch, thin, high r" },
      { n: "M3",  t: 10, p: 0.55, c: "#93c5fd", dir: "H", note: "" },
      { n: "M4",  t: 12, p: 0.7,  c: "#60a5fa", dir: "V", note: "intermediate" },
      { n: "M5",  t: 12, p: 0.7,  c: "#93c5fd", dir: "H", note: "" },
      { n: "M6",  t: 18, p: 1.1,  c: "#fbbf24", dir: "V", note: "semi-global: 2x thick" },
      { n: "M7",  t: 18, p: 1.1,  c: "#fbbf24", dir: "H", note: "" },
      { n: "M8",  t: 30, p: 2.0,  c: "#f59e0b", dir: "V", note: "global: power, clock, long nets" },
      { n: "M9",  t: 30, p: 2.0,  c: "#f59e0b", dir: "H", note: "" },
    ];
    var x0 = 1.0 * CS, baseY = 9.4 * CS, width = 8.5 * CS;
    function paint(upto, showVia) {
      return function (ctx) {
        pfBg(ctx);
        /* substrate + transistors */
        pfBox(ctx, x0, baseY, width, 0.5 * CS, "#d6d3ce", "#9b9890");
        pfText(ctx, x0 + 6, baseY + 16, "silicon: transistors (FEOL (Front End Of Line))", { size: 10, color: MUT });
        var y = baseY;
        for (var i = 0; i <= upto && i < layers.length; i++) {
          var L = layers[i];
          var gap = 8; /* dielectric between layers */
          y -= gap;
          y -= L.t;
          /* draw wires end-on: several rectangles at pitch p */
          var n = Math.floor(width / (L.p * CS));
          for (var k = 0; k < n; k++) {
            var wx = x0 + k * L.p * CS + L.p * CS * 0.25;
            var ww = L.p * CS * 0.5;
            if (L.dir === "H") { pfBox(ctx, wx, y, ww, L.t, L.c, "#1f2937", 0.95); }
            else { /* vertical layers seen end-on look like continuous strips; draw a bar */
              if (k === 0) pfBox(ctx, x0, y, width, L.t, L.c, "#1f2937", 0.75);
            }
          }
          if (showVia && i > 0) {
            /* a via stack column at the right */
            pfBox(ctx, x0 + width - 0.6 * CS, y + L.t, 6, gap, "#374151", null);
          }
          pfText(ctx, x0 + width + 10, y + L.t / 2 + 4, L.n + "  " + L.dir + "  pitch " + L.p + "  " + (L.note || ""), { size: 10, color: i === upto ? INK : MUT, bold: i === upto });
        }
        pfText(ctx, x0, 0.5 * CS, "cross-section, wires end-on; H = horizontal layer, V = vertical layer", { size: 10, color: MUT });
      };
    }
    return { frames: [
      { paint: paint(0), cap: "The stack is built upward from the transistors. M1, the first metal, is thin and at the finest pitch: it wires within cells and connects to their pins." },
      { paint: paint(2), cap: "M2 and M3 alternate direction (vertical, then horizontal): the router's local layers, thin and resistive, dense enough to reach every cell pin." },
      { paint: paint(4), cap: "M4 and M5, intermediate: slightly thicker and coarser, where most signal routing lives; still resistive enough that long runs need buffers." },
      { paint: paint(6), cap: "M6 and M7 at roughly double thickness and pitch: semi-global metal, where the layer-assignment page's promotion of long critical nets lands." },
      { paint: paint(8, true), cap: "M8 and M9, thick global metal at coarse pitch: power grid, clock trunks, and the longest signals, at a fraction of the lower layers' resistance. A via stack (dark column at right) climbs the whole way; each hop is a via with its own resistance and enclosure rules." },
    ], speed: 2200 };
  };

  /* ----- transistor-shapes: planar, FinFET, GAA cross-sections ----- */
  BUILD["transistor-shapes"] = function () {
    function device(ctx, ox, oy, kind, label) {
      var W0 = 3.6 * CS, H0 = 3.2 * CS;
      pfBox(ctx, ox, oy + H0 - 0.5 * CS, W0, 0.5 * CS, "#d6d3ce", "#9b9890"); /* substrate */
      var gateC = "#dc2626", chanC = "#60a5fa", oxC = "#fbbf24";
      if (kind === "planar") {
        pfBox(ctx, ox + 0.5 * CS, oy + H0 - 0.5 * CS - 10, W0 - CS, 10, chanC, "#1f2937");   /* channel */
        pfBox(ctx, ox + 0.5 * CS, oy + H0 - 0.5 * CS - 14, W0 - CS, 4, oxC, null);           /* oxide */
        pfBox(ctx, ox + 0.5 * CS, oy + H0 - 0.5 * CS - 14 - 26, W0 - CS, 26, gateC, "#1f2937"); /* gate */
        pfText(ctx, ox + W0 / 2, oy + H0 + 16, "gate touches 1 side", { size: 10, align: "center", color: MUT });
      } else if (kind === "finfet") {
        var fx = ox + W0 / 2 - 8, fy = oy + H0 - 0.5 * CS - 60;
        pfBox(ctx, fx - 4, fy - 4, 24, 64, oxC, null);           /* oxide around fin */
        pfBox(ctx, fx, fy, 16, 60, chanC, "#1f2937");            /* fin */
        pfBox(ctx, fx - 22, fy - 18, 60, 22, gateC, "#1f2937");  /* gate top */
        pfBox(ctx, fx - 22, fy - 18, 18, 78, gateC, "#1f2937");  /* gate left */
        pfBox(ctx, fx + 20, fy - 18, 18, 78, gateC, "#1f2937");  /* gate right */
        pfText(ctx, ox + W0 / 2, oy + H0 + 16, "gate wraps 3 sides of a fin", { size: 10, align: "center", color: MUT });
      } else {
        var sx = ox + W0 / 2 - 22, sy0 = oy + H0 - 0.5 * CS - 74;
        pfBox(ctx, sx - 12, sy0 - 10, 68, 84, gateC, "#1f2937"); /* gate block */
        [0, 1, 2].forEach(function (k) {
          var sy = sy0 + k * 26;
          pfBox(ctx, sx - 4, sy - 4, 52, 16, oxC, null);
          pfBox(ctx, sx, sy, 44, 8, chanC, "#1f2937");
        });
        pfText(ctx, ox + W0 / 2, oy + H0 + 16, "gate surrounds each sheet", { size: 10, align: "center", color: MUT });
      }
      pfText(ctx, ox + W0 / 2, oy - 6, label, { bold: true, align: "center" });
    }
    function legend(ctx) {
      var y = 9.2 * CS;
      [["gate", "#dc2626"], ["gate oxide", "#fbbf24"], ["channel", "#60a5fa"], ["substrate", "#d6d3ce"]].forEach(function (l, i) {
        pfBox(ctx, 1 * CS + i * 3.4 * CS, y - 8, 12, 12, l[1], "#1f2937");
        pfText(ctx, 1 * CS + i * 3.4 * CS + 18, y + 3, l[0], { size: 10, color: MUT });
      });
      pfText(ctx, 1 * CS, 8.6 * CS, "cross-sections through the channel, perpendicular to current flow", { size: 10, color: MUT });
    }
    return { frames: [
      { paint: function (ctx) { pfBg(ctx); device(ctx, 1.2 * CS, 1.4 * CS, "planar", "planar (to 22 nm)"); legend(ctx); },
        cap: "Planar MOSFET (Metal-Oxide-Semiconductor Field-Effect Transistor): a flat channel in the substrate, a thin oxide on top, and the gate above that. The gate controls the channel from one side only; as gate length shrinks, the drain's field reaches under the gate and the device leaks when off." },
      { paint: function (ctx) { pfBg(ctx); device(ctx, 1.2 * CS, 1.4 * CS, "planar", "planar"); device(ctx, 5.7 * CS, 1.4 * CS, "finfet", "FinFET (22 nm to 3 nm)"); legend(ctx); },
        cap: "FinFET: the channel stands up as a thin fin and the gate wraps three of its sides. Control returns, leakage falls, and drive current now comes in units of fins: a wider device is more fins, so cell libraries count fins per device and cell heights are measured in fin pitches." },
      { paint: function (ctx) { pfBg(ctx); device(ctx, 1.2 * CS, 1.4 * CS, "planar", "planar"); device(ctx, 5.7 * CS, 1.4 * CS, "finfet", "FinFET"); device(ctx, 10.2 * CS, 1.4 * CS, "gaa", "gate-all-around (3 nm on)"); legend(ctx); },
        cap: "Gate-all-around nanosheet: the channel is a stack of thin horizontal sheets and the gate fills the space around each, touching all four sides. The best control yet, and drive strength tunes continuously with sheet width again. Stacking an n-type over a p-type device (CFET (Complementary Field-Effect Transistor)) is the announced next step." },
    ], speed: 2600 };
  };

  /* ----- node-pitches: what defines a node ----- */
  BUILD["node-pitches"] = function () {
    var FS = CS / 2;
    var ox = 1.5 * CS, oy = 1.2 * CS;
    var cpp = 1.6 * CS, mp = 0.55 * CS, tracks = 6;
    function cell(ctx, hl) {
      var w = 4 * cpp, h = tracks * mp;
      pfBox(ctx, ox, oy, w, h, "#eceae2", "#9b9890");
      /* gates at CPP */
      for (var i = 0; i < 4; i++) pfBox(ctx, ox + i * cpp + cpp / 2 - 3, oy + 4, 6, h - 8, "#dc2626", null, 0.8);
      /* tracks at MP */
      ctx.save(); ctx.strokeStyle = "rgba(47,111,237,0.5)"; ctx.lineWidth = 1;
      for (var t = 0; t < tracks; t++) { var y = oy + (t + 0.5) * mp; ctx.beginPath(); ctx.moveTo(ox - 10, y); ctx.lineTo(ox + w + 10, y); ctx.stroke(); }
      ctx.restore();
      if (hl === "cpp") {
        pfArrow(ctx, ox + cpp / 2, oy + h + 22, ox + 1.5 * cpp, oy + h + 22, RED);
        pfArrow(ctx, ox + 1.5 * cpp, oy + h + 22, ox + cpp / 2, oy + h + 22, RED);
        pfText(ctx, ox + cpp, oy + h + 40, "CPP (Contacted Poly Pitch): gate to gate", { size: 10, align: "center", color: RED });
      }
      if (hl === "mp") {
        pfArrow(ctx, ox + w + 26, oy + 0.5 * mp, ox + w + 26, oy + 1.5 * mp, "#1d4ed8");
        pfArrow(ctx, ox + w + 26, oy + 1.5 * mp, ox + w + 26, oy + 0.5 * mp, "#1d4ed8");
        pfText(ctx, ox + w + 36, oy + mp + 4, "MP (Metal Pitch): track to track", { size: 10, color: "#1d4ed8" });
      }
      if (hl === "height") {
        pfArrow(ctx, ox - 26, oy, ox - 26, oy + h, GREEN_DEEP);
        pfArrow(ctx, ox - 26, oy + h, ox - 26, oy, GREEN_DEEP);
        pfText(ctx, ox - 32, oy + h / 2 + 4, tracks + " tracks x MP", { size: 10, align: "right", color: GREEN_DEEP });
      }
      if (hl === "area") {
        pfBox(ctx, ox, oy, w, h, "#fbbf24", "#b45309", 0.3);
        pfText(ctx, ox + w / 2, oy + h + 40, "cell area = (gates x CPP) x (tracks x MP)", { size: 10, align: "center", color: "#92400e", bold: true });
      }
    }
    function table(ctx, rows, hl) {
      var tx = 9.4 * CS, ty = 1.0 * CS;
      pfText(ctx, tx, ty, "public numbers, not names", { bold: true });
      var hdr = ["node", "CPP", "MP", "tracks"];
      var cols = [0, 1.9, 3.3, 4.6];
      hdr.forEach(function (h, i) { pfText(ctx, tx + cols[i] * CS, ty + 20, h, { size: 10, color: MUT, bold: true }); });
      rows.forEach(function (r, k) {
        var y = ty + 40 + k * 18;
        r.forEach(function (v, i) { pfText(ctx, tx + cols[i] * CS, y, String(v), { size: 10, color: (hl === k) ? INK : MUT, bold: hl === k }); });
      });
      pfText(ctx, tx, ty + 40 + rows.length * 18 + 10, "(nm; representative, foundries differ)", { size: 9, color: MUT });
    }
    var rows = [["28", 117, 90, 12], ["16/14", 90, 64, 9], ["10", 66, 44, 7.5], ["7", 57, 40, 6], ["5", 51, 30, 6], ["3", 48, 24, 5]];
    return { frames: [
      { paint: function (ctx) { pfBg(ctx); cell(ctx, null); table(ctx, rows, -1); },
        cap: "A standard cell in plan view: poly gates (red) at a fixed pitch across it, routing tracks (blue) up its height. Two pitches and one count define its footprint, and those, not the node name, are what the table on the right compares." },
      { paint: function (ctx) { pfBg(ctx); cell(ctx, "cpp"); table(ctx, rows, -1); },
        cap: "CPP (Contacted Poly Pitch): the distance from one gate to the next, including the contact between them. It sets how much width each transistor costs and is the front-end's defining pitch." },
      { paint: function (ctx) { pfBg(ctx); cell(ctx, "mp"); table(ctx, rows, -1); },
        cap: "MP (Metal Pitch): the pitch of the finest routing layer. It sets the router's grid, the pin-access difficulty, and, with the track count, the cell height." },
      { paint: function (ctx) { pfBg(ctx); cell(ctx, "height"); table(ctx, rows, -1); },
        cap: "Cell height is a track count times MP (Metal Pitch). Libraries shrank from 12 tracks to 6 or fewer over the last decade; much of the density gain per node came from cutting tracks, not from shrinking pitches." },
      { paint: function (ctx) { pfBg(ctx); cell(ctx, "area"); table(ctx, rows, 3); },
        cap: "Cell area is the product. Read the table by rows: at what is called 7 nm, CPP (Contacted Poly Pitch) is about 57 nm and MP (Metal Pitch) about 40 nm; nothing is 7 nm. Two foundries' 7 nm rows would differ, and one's 10 nm can match another's 7 nm. Compare the numbers." },
    ], speed: 2400 };
  };

  /* ----- damascene: one BEOL layer, step by step (cross-section) ----- */
  BUILD["damascene"] = function () {
    var ox = 1.5 * CS, oy = 2.0 * CS, w = 11 * CS, base = oy + 5.2 * CS;
    var lowerT = 22, dielT = 70;
    function lowerLayer(ctx) {
      pfBox(ctx, ox, base, w, 0.5 * CS, "#d6d3ce", "#9b9890");
      pfText(ctx, ox + 6, base + 16, "layer below (already built)", { size: 10, color: MUT });
      [1.5, 5.0, 8.5].forEach(function (x) { pfBox(ctx, ox + x * CS, base - lowerT, 1.2 * CS, lowerT, "#f59e0b", "#1f2937"); });
    }
    function dielectric(ctx, cutTrench, cutVia) {
      pfBox(ctx, ox, base - lowerT - dielT, w, dielT, "#e5e7eb", "#9b9890");
      if (cutTrench) {
        /* trench: upper part removed over a span */
        pfBox(ctx, ox + 3.6 * CS, base - lowerT - dielT, 4.4 * CS, dielT * 0.5, "#fdfdfd", "#9b9890");
      }
      if (cutVia) {
        pfBox(ctx, ox + 5.0 * CS, base - lowerT - dielT * 0.5, 1.2 * CS, dielT * 0.5, "#fdfdfd", "#9b9890");
      }
    }
    function liner(ctx) {
      ctx.save(); ctx.strokeStyle = "#374151"; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(ox + 3.6 * CS, base - lowerT - dielT);
      ctx.lineTo(ox + 3.6 * CS, base - lowerT - dielT * 0.5);
      ctx.lineTo(ox + 5.0 * CS, base - lowerT - dielT * 0.5);
      ctx.lineTo(ox + 5.0 * CS, base - lowerT);
      ctx.lineTo(ox + 6.2 * CS, base - lowerT);
      ctx.lineTo(ox + 6.2 * CS, base - lowerT - dielT * 0.5);
      ctx.lineTo(ox + 8.0 * CS, base - lowerT - dielT * 0.5);
      ctx.lineTo(ox + 8.0 * CS, base - lowerT - dielT);
      ctx.stroke(); ctx.restore();
    }
    function copper(ctx, overfill) {
      pfBox(ctx, ox + 3.6 * CS + 3, base - lowerT - dielT + (overfill ? -18 : 0), 4.4 * CS - 6, dielT * 0.5 + (overfill ? 18 : 0) - 3, "#f59e0b", null);
      pfBox(ctx, ox + 5.0 * CS + 3, base - lowerT - dielT * 0.5, 1.2 * CS - 6, dielT * 0.5, "#f59e0b", null);
      if (overfill) pfBox(ctx, ox, base - lowerT - dielT - 18, w, 18, "#f59e0b", null, 0.6);
    }
    function cap(ctx) {
      pfBox(ctx, ox, base - lowerT - dielT - 6, w, 6, "#a3a3a3", null);
    }
    function label(ctx, txt) { pfText(ctx, ox, oy - 8, txt, { bold: true }); }
    return { frames: [
      { paint: function (ctx) { pfBg(ctx); label(ctx, "1  deposit dielectric over the finished layer below"); lowerLayer(ctx); dielectric(ctx, false, false); },
        cap: "Start of a BEOL (Back End Of Line) layer: the layer below is finished (its wires in amber, seen end-on), and a slab of dielectric is deposited over it. Everything about the new layer will be carved into this slab." },
      { paint: function (ctx) { pfBg(ctx); label(ctx, "2  lithography + etch: via holes and wire trenches"); lowerLayer(ctx); dielectric(ctx, true, true); },
        cap: "Dual damascene patterning: a via hole is etched down to a wire below, and the trench for the new wire is etched into the upper half of the slab. Both are defined by lithography, so both inherit its resolution limit; on multi-patterned layers this is where the coloring or spacer constraints apply. The etch is a plasma step: the antenna effect happens here." },
      { paint: function (ctx) { pfBg(ctx); label(ctx, "3  barrier liner + copper seed"); lowerLayer(ctx); dielectric(ctx, true, true); liner(ctx); },
        cap: "A thin barrier liner (dark) coats every surface of the trench and via so copper cannot diffuse into the dielectric, followed by a copper seed for plating. The liner conducts poorly and does not thin with the pitch: at fine widths it takes a large share of the cross-section, which is one reason thin-wire resistance climbs faster than geometry predicts." },
      { paint: function (ctx) { pfBg(ctx); label(ctx, "4  electroplate copper (overfills)"); lowerLayer(ctx); dielectric(ctx, true, true); liner(ctx); copper(ctx, true); },
        cap: "Copper is electroplated to fill the via and trench in one step (dual damascene: via and wire together), overfilling the whole surface." },
      { paint: function (ctx) { pfBg(ctx); label(ctx, "5  CMP (Chemical-Mechanical Polishing) planarizes"); lowerLayer(ctx); dielectric(ctx, true, true); liner(ctx); copper(ctx, false); },
        cap: "CMP (Chemical-Mechanical Polishing) grinds the surface flat, leaving copper only in the trench and via. Polishing removes more from wide metal and from sparse regions (dishing and erosion), which is why the design rules demand uniform metal density and the flow inserts dummy fill." },
      { paint: function (ctx) { pfBg(ctx); label(ctx, "6  dielectric cap; repeat for the next layer"); lowerLayer(ctx); dielectric(ctx, true, true); liner(ctx); copper(ctx, false); cap(ctx); },
        cap: "A dielectric cap seals the copper. The next layer's slab goes on top, and the sequence repeats: thin layers first at fine pitch, thick layers last at coarse pitch, ten to fifteen times. Every metal rule the router meets, via enclosure, density, antenna, minimum area, is a step in this loop staying inside its process window." },
    ], speed: 2400 };
  };

  /* ----- rc-scaling: how r, c, and delay move with scaling ----- */
  BUILD["rc-scaling"] = function () {
    /* a chart: generation index on x, normalized values on y (log-ish, drawn linear on a chosen scale) */
    var gens = ["180", "130", "90", "65", "45", "28", "16", "7"];
    /* illustrative normalized trends: gate delay falls, wire r/len rises,
       c/len ~ flat, local wire delay ~ flat, global wire delay rises */
    var gate = [1.0, 0.75, 0.56, 0.42, 0.32, 0.24, 0.18, 0.13];
    var rlen = [1.0, 1.7, 3.0, 5.2, 9.0, 16, 30, 60];
    var clen = [1.0, 0.98, 0.95, 0.93, 0.92, 0.9, 0.9, 0.9];
    var glob = [1.0, 1.4, 2.0, 2.9, 4.4, 6.5, 10, 16];
    var ox = 1.6 * CS, oy = 0.8 * CS, w = 9.6 * CS, h = 7.4 * CS;
    function toY(v, vmax) { return oy + h - (Math.log(v * 10) / Math.log(vmax * 10)) * h; }
    function axes(ctx) {
      ctx.save(); ctx.strokeStyle = "#9b9890"; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox, oy + h); ctx.lineTo(ox + w, oy + h); ctx.stroke(); ctx.restore();
      gens.forEach(function (g, i) { pfText(ctx, ox + i * (w / (gens.length - 1)), oy + h + 16, g, { size: 9, align: "center", color: MUT }); });
      pfText(ctx, ox + w / 2, oy + h + 32, "process generation (nm, node name)", { size: 10, align: "center", color: MUT });
      pfText(ctx, ox - 8, oy + 4, "relative (log)", { size: 9, align: "right", color: MUT });
      pfText(ctx, ox - 8, oy + h + 4, "1x", { size: 9, align: "right", color: MUT });
    }
    function series(ctx, data, color, label, vmax) {
      ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.beginPath();
      data.forEach(function (v, i) { var x = ox + i * (w / (gens.length - 1)), y = toY(v, vmax); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
      ctx.stroke(); ctx.restore();
      var lx = ox + (gens.length - 1) * (w / (gens.length - 1)) + 8, ly = toY(data[data.length - 1], vmax) + 4;
      pfText(ctx, lx, ly, label, { size: 10, color: color, bold: true });
    }
    var VMAX = 60;
    return { frames: [
      { paint: function (ctx) { pfBg(ctx); axes(ctx); series(ctx, gate, GREEN, "gate delay", VMAX); },
        cap: "Scaling and the transistor: each generation makes a gate faster. On this log-scale chart (values relative to the 180 nm generation, illustrative trends), gate delay falls steadily." },
      { paint: function (ctx) { pfBg(ctx); axes(ctx); series(ctx, gate, GREEN, "gate delay", VMAX); series(ctx, rlen, RED, "wire r per length", VMAX); },
        cap: "Scaling and the wire: shrinking width and thickness together shrinks the cross-section quadratically, so resistance per unit length climbs steeply, and faster than geometry alone at the finest widths (surface scattering, grain boundaries, non-scaling barrier)." },
      { paint: function (ctx) { pfBg(ctx); axes(ctx); series(ctx, gate, GREEN, "gate delay", VMAX); series(ctx, rlen, RED, "wire r per length", VMAX); series(ctx, clen, BLUE, "wire c per length", VMAX); },
        cap: "Capacitance per unit length barely moves: thinner wires have less plate capacitance but sit closer to their neighbours, so sidewall coupling rises to compensate. The product r times c per length therefore rises almost as fast as r alone." },
      { paint: function (ctx) { pfBg(ctx); axes(ctx); series(ctx, gate, GREEN, "gate delay", VMAX); series(ctx, rlen, RED, "wire r per length", VMAX); series(ctx, clen, BLUE, "wire c per length", VMAX); series(ctx, glob, AMBER, "global wire delay", VMAX); },
        cap: "The consequence: a wire that spans the die stays the same length while r times c per length rises, so its unbuffered delay (proportional to r c L squared) grows every generation as gate delay falls. They crossed around the 130 nm generation; since then interconnect, not logic, has bounded chip speed, and the flow's timing-driven, buffered, layer-promoted routing is the response." },
    ], speed: 2600 };
  };

  /* ----- litho-limit: k1 lambda / NA, and what multi-patterning buys ----- */
  BUILD["litho-limit"] = function () {
    var ox = 1.5 * CS, oy = 1.4 * CS;
    function bars(ctx, y, pitchPx, color, n, label) {
      for (var i = 0; i < n; i++) pfBox(ctx, ox + i * pitchPx, y, pitchPx * 0.5, 26, color, "#1f2937", 0.9);
      pfText(ctx, ox + n * pitchPx + 12, y + 18, label, { size: 10, color: MUT });
    }
    function eq(ctx, y, txt, color) { pfText(ctx, ox, y, txt, { bold: true, color: color || INK }); }
    return { frames: [
      { paint: function (ctx) { pfBg(ctx); eq(ctx, oy, "half-pitch = k1 x lambda / NA"); pfText(ctx, ox, oy + 20, "193 nm immersion: k1 >= 0.25, lambda 193 nm, NA 1.35  ->  half-pitch >= ~36 nm, pitch >= ~72-80 nm", { size: 10, color: MUT }); bars(ctx, oy + 46, 60, "#60a5fa", 7, "one exposure at its limit"); },
        cap: "The resolution equation. With 193 nm light and immersion optics (numerical aperture 1.35), the physical floor of the k1 factor (0.25) sets a minimum pitch near 76 to 80 nm. Every resolution-enhancement trick, phase-shift masks, optical proximity correction, off-axis illumination, is a way of operating close to that floor. It cannot go below it." },
      { paint: function (ctx) { pfBg(ctx); eq(ctx, oy, "the design wants pitch 40 nm: below the single-exposure floor", RED); bars(ctx, oy + 46, 60, "#60a5fa", 7, "exposure A"); bars(ctx, oy + 96, 60, "#f87171", 7, "exposure B, offset by half a pitch"); bars(ctx, oy + 146, 30, "#8b5cf6", 14, "combined: pitch halved (LELE)"); pfText(ctx, ox, oy + 196, "cost: two masks, overlay error between them, and shapes closer than 80 nm must be on different masks (coloring)", { size: 10, color: RED }); },
        cap: "Multi-patterning: two exposures at the achievable pitch, offset by half a pitch, combine into one layer at half the pitch. LELE (Litho-Etch-Litho-Etch) does exactly this; SADP (Self-Aligned Double Patterning) reaches the same pitch with spacers instead of a second mask. Either way the design inherits a constraint: mask coloring for one, a fixed line grid for the other (see the routing section)." },
      { paint: function (ctx) { pfBg(ctx); eq(ctx, oy, "EUV: lambda 13.5 nm, NA 0.33  ->  half-pitch ~13 nm in one exposure", GREEN_DEEP); bars(ctx, oy + 46, 22, "#16a34a", 20, "single exposure again"); pfText(ctx, ox, oy + 96, "removes multi-patterning from many critical layers; brings shot noise, mask defects, throughput, cost", { size: 10, color: MUT }); pfText(ctx, ox, oy + 116, "high-NA EUV (NA 0.55): another single-exposure step, mid-2020s", { size: 10, color: MUT }); },
        cap: "EUV (Extreme Ultraviolet) at 13.5 nm resolves in one exposure what took three or four at 193 nm, and simplified the rules on the layers it prints. It is not free: photon shot noise makes low-dose printing stochastic, masks are reflective and defect-sensitive, and each tool costs hundreds of millions, so foundries use it only where they must and keep 193 nm for the rest." },
    ], speed: 3000 };
  };

  /* ----- pvt-corners: the corner box ----- */
  BUILD["pvt-corners"] = function () {
    var ox = 2.0 * CS, oy = 1.4 * CS, w = 7 * CS, h = 5.6 * CS;
    function box(ctx) {
      pfBox(ctx, ox, oy, w, h, "#eceae2", "#9b9890", 0.6);
      pfText(ctx, ox + w / 2, oy + h + 22, "process:  slow  <---  typical  --->  fast", { size: 10, align: "center", color: MUT });
      pfText(ctx, ox - 10, oy + 8, "high V", { size: 10, align: "right", color: MUT });
      pfText(ctx, ox - 10, oy + h, "low V", { size: 10, align: "right", color: MUT });
      pfText(ctx, ox + w + 10, oy + 8, "temperature: a third axis (hot / cold)", { size: 10, color: MUT });
    }
    function cloud(ctx) {
      /* dots clustered near the center: the real chips */
      var seed = 7;
      function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
      ctx.save(); ctx.fillStyle = "rgba(26,29,38,0.35)";
      for (var i = 0; i < 160; i++) {
        var u = rnd() + rnd() + rnd() - 1.5, v = rnd() + rnd() + rnd() - 1.5;
        ctx.beginPath(); ctx.arc(ox + w / 2 + u * w * 0.28, oy + h / 2 + v * h * 0.28, 1.6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    function corner(ctx, cx, cy, label, color, note) {
      ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
      pfText(ctx, cx + (cx > ox + w / 2 ? -14 : 14), cy + (cy > oy + h / 2 ? -12 : 20), label, { size: 10, bold: true, color: color, align: cx > ox + w / 2 ? "right" : "left" });
      if (note) pfText(ctx, cx + (cx > ox + w / 2 ? -14 : 14), cy + (cy > oy + h / 2 ? 0 : 32), note, { size: 9, color: MUT, align: cx > ox + w / 2 ? "right" : "left" });
    }
    return { frames: [
      { paint: function (ctx) { pfBg(ctx); box(ctx); cloud(ctx); },
        cap: "Every manufactured die lands somewhere in a distribution of transistor speed, and in operation sees a range of supply voltage and temperature. The dots are real chips: most near the middle, a few far out." },
      { paint: function (ctx) { pfBg(ctx); box(ctx); cloud(ctx); corner(ctx, ox + 0.2 * w, oy + 0.85 * h, "SS, low V, hot", RED, "worst setup (slowest)"); },
        cap: "Sign-off does not model the distribution; it checks its bounding box. The slow-process, low-voltage, high-temperature corner is where paths are slowest, so setup timing (maximum delay) is signed off there." },
      { paint: function (ctx) { pfBg(ctx); box(ctx); cloud(ctx); corner(ctx, ox + 0.2 * w, oy + 0.85 * h, "SS, low V, hot", RED, "worst setup (slowest)"); corner(ctx, ox + 0.85 * w, oy + 0.15 * h, "FF, high V, cold", BLUE, "worst hold (fastest)"); },
        cap: "The fast-process, high-voltage, low-temperature corner is where paths are fastest, so hold timing (minimum delay) is signed off there. A hold fix adds delay; a setup fix removes it; the two corners pull optimization in opposite directions." },
      { paint: function (ctx) { pfBg(ctx); box(ctx); cloud(ctx); corner(ctx, ox + 0.2 * w, oy + 0.85 * h, "SS, low V, hot", RED); corner(ctx, ox + 0.85 * w, oy + 0.15 * h, "FF, high V, cold", BLUE); corner(ctx, ox + 0.2 * w, oy + 0.15 * h, "SS, high V, cold", PURPLE, "temperature inversion, RC corners..."); corner(ctx, ox + 0.85 * w, oy + 0.85 * h, "FF, low V, hot", AMBER, ""); corner(ctx, ox + 0.5 * w, oy + 0.5 * h, "TT", GREEN_DEEP, "typical: what most chips are"); },
        cap: "Real sign-off checks many more: at advanced nodes delay can be worse cold (temperature inversion), skewed process corners (fast n-type, slow p-type) matter for some circuits, and wire parasitics have their own corners. Tens of corners times operating modes; the typical chip in the middle carries all that margin." },
    ], speed: 2600 };
  };

  /* ----- ocv-derate: launch vs capture, derated oppositely ----- */
  BUILD["ocv-derate"] = function () {
    var ox = 1.2 * CS, oy = 1.4 * CS;
    function stage(ctx, x, y, w, color, label, alpha) {
      pfBox(ctx, x, y, w, 26, color, "#1f2937", alpha === undefined ? 0.85 : alpha);
      if (label) pfText(ctx, x + w / 2, y + 17, label, { size: 9, align: "center", color: "#fff", bold: true });
    }
    function paths(ctx, mode) {
      /* clock source at left; common trunk; then launch branch (top) and capture branch (bottom) */
      var trunkW = 3 * CS, brW = 1.6 * CS, dataW = 1.5 * CS;
      pfText(ctx, ox, oy - 8, "clock", { size: 10, color: MUT });
      stage(ctx, ox, oy + 1.5 * CS, trunkW, "#6b7280", "common clock path");
      /* launch branch */
      var lyc = oy + 0.4 * CS;
      stage(ctx, ox + trunkW + 8, lyc, brW, mode === "setup" ? "#dc2626" : (mode === "hold" ? "#16a34a" : "#6b7280"), "launch clk", 0.85);
      stage(ctx, ox + trunkW + 8 + brW + 8, lyc, brW, mode === "setup" ? "#dc2626" : (mode === "hold" ? "#16a34a" : "#6b7280"), "launch clk");
      pfBox(ctx, ox + trunkW + 8 + 2 * (brW + 8), lyc - 6, 22, 38, "#fdfdfd", "#1f2937");
      pfText(ctx, ox + trunkW + 8 + 2 * (brW + 8) + 11, lyc + 18, "FF", { size: 9, align: "center", bold: true });
      var dx = ox + trunkW + 8 + 2 * (brW + 8) + 30;
      stage(ctx, dx, lyc, dataW, mode === "setup" ? "#dc2626" : (mode === "hold" ? "#16a34a" : "#6b7280"), "data");
      stage(ctx, dx + dataW + 8, lyc, dataW, mode === "setup" ? "#dc2626" : (mode === "hold" ? "#16a34a" : "#6b7280"), "data");
      /* capture branch */
      var cyc = oy + 2.6 * CS;
      stage(ctx, ox + trunkW + 8, cyc, brW, mode === "setup" ? "#16a34a" : (mode === "hold" ? "#dc2626" : "#6b7280"), "capture clk");
      stage(ctx, ox + trunkW + 8 + brW + 8, cyc, brW, mode === "setup" ? "#16a34a" : (mode === "hold" ? "#dc2626" : "#6b7280"), "capture clk");
      pfBox(ctx, dx + 2 * dataW + 16, cyc - 6 - 1.1 * CS, 22, 38 + 1.1 * CS, "#fdfdfd", "#1f2937");
      pfText(ctx, dx + 2 * dataW + 27, cyc + 8, "FF", { size: 9, align: "center", bold: true });
      /* connectors */
      ctx.save(); ctx.strokeStyle = "#9b9890"; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(ox + trunkW, oy + 1.5 * CS + 13); ctx.lineTo(ox + trunkW + 8, lyc + 13); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ox + trunkW, oy + 1.5 * CS + 13); ctx.lineTo(ox + trunkW + 8, cyc + 13); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(dx + 2 * dataW + 8, lyc + 13); ctx.lineTo(dx + 2 * dataW + 16, lyc + 13); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ox + trunkW + 8 + 2 * (brW + 8), cyc + 13); ctx.lineTo(dx + 2 * dataW + 16, cyc + 13); ctx.stroke();
      ctx.restore();
    }
    function legend(ctx, lines, color) {
      lines.forEach(function (l, i) { pfText(ctx, ox, oy + 4.6 * CS + i * 16, l, { size: 10, color: color || MUT, bold: i === 0 }); });
    }
    return { frames: [
      { paint: function (ctx) { pfBg(ctx); paths(ctx, null); legend(ctx, ["one timing check: launch flop, data path, capture flop", "the two flops' clocks share a trunk, then split into launch and capture branches", "at a corner, every stage sits at the same speed; on silicon, they do not"]); },
        cap: "A timing check has two sides: the launch side (clock branch to the launching flop, then the data path) and the capture side (clock branch to the capturing flop). A corner analysis assumes both sides sit at the same point of the process distribution. Within one die, they need not." },
      { paint: function (ctx) { pfBg(ctx); paths(ctx, "setup"); legend(ctx, ["OCV (On-Chip Variation) for setup: launch x (1 + d)  slower,  capture x (1 - d)  faster", "red = derated slower, green = derated faster", "the pessimistic combination: data arrives late, capture clock arrives early"], RED); },
        cap: "OCV (On-Chip Variation) for setup: derate the launch side slower by d and the capture side faster by d, the combination that most threatens a setup check. Every stage on each side gets the full derate, which is safe and, for long paths, pessimistic: variation partly averages out over many stages." },
      { paint: function (ctx) { pfBg(ctx); paths(ctx, "hold"); legend(ctx, ["OCV (On-Chip Variation) for hold: launch x (1 - d)  faster,  capture x (1 + d)  slower", "the reverse combination: data arrives early, capture clock arrives late", "the common clock path (grey) cannot vary both ways at once: CPPR removes its derate"], GREEN_DEEP); },
        cap: "For hold the derates flip: launch faster, capture slower. The common clock trunk (grey) is shared by both sides and cannot be simultaneously fast and slow, so CPPR (Common Path Pessimism Removal) credits it back. AOCV (Advanced On-Chip Variation) then shrinks d with path depth, and POCV (Parametric On-Chip Variation) replaces the derate with per-cell sigmas combined root-sum-square: each rung recovers pessimism the flat derate left on the table." },
    ], speed: 3000 };
  };

  /* ----- ir-drop: voltage falling along a power grid ----- */
  BUILD["ir-drop"] = function () {
    var ox = 1.5 * CS, oy = 1.4 * CS, w = 11 * CS;
    /* a supply rail from a pad at left; N cell groups tap it; drop accumulates */
    var N = 8, seg = w / N, R = 1.0, I = 1.0, Vpad = 1.0;
    function drops(scale, Rs) {
      var v = [], V = Vpad;
      for (var k = 0; k < N; k++) {
        var downstream = (N - k) * I * scale;
        V -= downstream * (Rs || R) * 0.012;
        v.push(V);
      }
      return v;
    }
    function rail(ctx, vs, hlk, label) {
      pfBox(ctx, ox - 22, oy + 0.6 * CS, 22, 40, "#374151", null);
      pfText(ctx, ox - 11, oy + 0.6 * CS - 6, "pad", { size: 9, align: "center", color: MUT });
      for (var k = 0; k < N; k++) {
        var x = ox + k * seg;
        var v = vs[k];
        var col = v > 0.95 ? "#16a34a" : (v > 0.9 ? "#f59e0b" : "#dc2626");
        pfBox(ctx, x, oy + 0.6 * CS + 12, seg - 2, 16, col, "#1f2937", 0.85);
        /* cell tap */
        pfBox(ctx, x + seg / 2 - 10, oy + 1.6 * CS, 20, 22, "#eceae2", "#9b9890");
        pfText(ctx, x + seg / 2, oy + 2.5 * CS, v.toFixed(2) + " V", { size: 9, align: "center", color: col, bold: hlk === k });
        pfArrow(ctx, x + seg / 2, oy + 0.6 * CS + 28, x + seg / 2, oy + 1.6 * CS, "#9b9890");
      }
      pfText(ctx, ox, oy + 0.3 * CS, label, { size: 10, color: MUT });
      /* chart of V vs position */
      var cy0 = oy + 3.6 * CS, ch = 3.4 * CS;
      ctx.save(); ctx.strokeStyle = "#9b9890"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ox, cy0); ctx.lineTo(ox, cy0 + ch); ctx.lineTo(ox + w, cy0 + ch); ctx.stroke(); ctx.restore();
      pfText(ctx, ox - 6, cy0 + 4, "1.00 V", { size: 9, align: "right", color: MUT });
      pfText(ctx, ox - 6, cy0 + ch + 4, "0.85 V", { size: 9, align: "right", color: MUT });
      ctx.save(); ctx.strokeStyle = "#dc2626"; ctx.lineWidth = 2.5; ctx.beginPath();
      vs.forEach(function (v, k) { var x = ox + k * seg + seg / 2, y = cy0 + ch * (1 - (v - 0.85) / 0.15); if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
      ctx.stroke(); ctx.restore();
      ctx.save(); ctx.strokeStyle = "#16a34a"; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
      var yb = cy0 + ch * (1 - (0.93 - 0.85) / 0.15);
      ctx.beginPath(); ctx.moveTo(ox, yb); ctx.lineTo(ox + w, yb); ctx.stroke(); ctx.restore();
      pfText(ctx, ox + w + 6, yb + 4, "budget", { size: 9, color: GREEN_DEEP });
      pfText(ctx, ox + w / 2, cy0 + ch + 16, "distance from the pad along the rail", { size: 10, align: "center", color: MUT });
    }
    var v1 = drops(1.0), v2 = drops(2.0), v3 = drops(2.0, 0.45);
    return { frames: [
      { paint: function (ctx) { pfBg(ctx); rail(ctx, v1, -1, "a supply rail feeding 8 groups of cells; current from every group flows back to the pad through the rail"); },
        cap: "A supply rail from a pad, tapped by cells along its length. Each rail segment carries the current of everything downstream, so the segments near the pad carry the most. Voltage falls by I times R across each segment: the cell farthest from the pad sees the lowest voltage. Here every tap stays within the budget (dashed)." },
      { paint: function (ctx) { pfBg(ctx); rail(ctx, v2, N - 1, "double the current demand: the drop doubles at every point"); },
        cap: "Double the current (a busier block, or a switching peak in dynamic analysis) and the drop doubles: the far end falls below budget (red). Cells there are slower than the timing corner assumed, so a design that closed timing at nominal voltage may fail on silicon. This is the IR (current times resistance) drop violation the sign-off tool reports." },
      { paint: function (ctx) { pfBg(ctx); rail(ctx, v3, -1, "the fix: lower R (wider rail, more stripes, more vias) at the same doubled current"); },
        cap: "The repair works on R: widen the rail, add parallel stripes on thick upper metal, add vias into the grid. Resistance falls, the drop returns under budget at the same current. Every stripe costs routing tracks, so grid design is a negotiation between power integrity and routability. Electromigration is checked on the same segments: current density in the near-pad segments must stay under the layer's limit for the target lifetime." },
    ], speed: 3000 };
  };

  /* ----- gpu-route: threads made visible, sequential then parallel ----- */
  BUILD["gpu-route"] = function () {
    var FS = CS / 2, FW = 30, FH = 20;
    var S = { x: 3, y: 10 }, T = { x: 26, y: 9 };
    var blocked = {};
    for (var y = 3; y <= 15; y++) if (y !== 5) blocked["13," + y] = true;
    for (var y2 = 8; y2 <= 19; y2++) if (y2 !== 17) blocked["20," + y2] = true;
    var wallCells = Object.keys(blocked).map(function (k) { return k.split(",").map(Number); });
    var dist = {}, rings = [];
    (function () {
      var q = [[S.x, S.y]], d = 0;
      dist[S.x + "," + S.y] = 0;
      while (q.length) {
        rings.push(q.slice());
        var nq = [];
        q.forEach(function (c) {
          [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (dd) {
            var nx = c[0] + dd[0], ny = c[1] + dd[1], k = nx + "," + ny;
            if (nx < 0 || ny < 0 || nx >= FW || ny >= FH) return;
            if (blocked[k] || dist[k] !== undefined) return;
            dist[k] = d + 1;
            nq.push([nx, ny]);
          });
        });
        q = nq; d += 1;
      }
    })();
    var dstD = dist[T.x + "," + T.y];
    var maxRing = 0;
    for (var r = 0; r <= dstD; r++) maxRing = Math.max(maxRing, rings[r].length);
    /* flattened settle order; sequential steps = T's position in it */
    var order = [];
    for (var r2 = 0; r2 < rings.length; r2++) order = order.concat(rings[r2]);
    var seqSteps = order.findIndex(function (c) { return c[0] === T.x && c[1] === T.y; }) + 1;
    var speedup = Math.round(seqSteps / (dstD + 1));
    var THREADS = [GREEN, BLUE, PURPLE, AMBER, TEAL, RED, "#ec4899", "#84cc16"];
    function bgw(ctx) {
      ctx.fillStyle = "#fdfdfd";
      ctx.fillRect(0, 0, 21 * CS, H * CS);
      ctx.strokeStyle = "#ebe9e2"; ctx.lineWidth = 1;
      ctx.beginPath();
      for (var x = 0; x <= FW; x++) { ctx.moveTo(x * FS, 0); ctx.lineTo(x * FS, FH * FS); }
      for (var yy = 0; yy <= FH; yy++) { ctx.moveTo(0, yy * FS); ctx.lineTo(FW * FS, yy * FS); }
      ctx.stroke();
      wallCells.forEach(function (c) {
        ctx.fillStyle = "#4b5563";
        ctx.fillRect(c[0] * FS + 0.5, c[1] * FS + 0.5, FS - 1, FS - 1);
      });
    }
    function ffill(ctx, x, y, color, alpha) {
      ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color;
      ctx.fillRect(x * FS + 0.5, y * FS + 0.5, FS - 1, FS - 1);
      ctx.restore();
    }
    function fpin(ctx, p, color, label) {
      ctx.beginPath();
      ctx.arc(p.x * FS + FS / 2, p.y * FS + FS / 2, 7, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 9px 'JetBrains Mono', monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(label, p.x * FS + FS / 2, p.y * FS + FS / 2 + 0.5);
      ctx.textBaseline = "alphabetic";
    }
    function panelTx(ctx, lines) {
      var QX = 15.5;
      ctx.textAlign = "left";
      lines.forEach(function (l, k) {
        ctx.fillStyle = k === 0 ? INK : (l.charAt(0) === "!" ? RED : (l.charAt(0) === "+" ? GREEN_DEEP : MUT));
        ctx.font = (k === 0 ? "bold " : "") + "11px 'JetBrains Mono', monospace";
        ctx.fillText(l.replace(/^[!+]/, ""), QX * CS, 16 + k * 16);
      });
    }
    function threadLegend(ctx, n) {
      var QX = 15.5;
      var shown = Math.min(n, THREADS.length);
      for (var k = 0; k < shown; k++) {
        ctx.fillStyle = THREADS[k];
        ctx.fillRect(QX * CS + (k % 4) * 38, 150 + Math.floor(k / 4) * 20, 12, 12);
        ctx.fillStyle = MUT;
        ctx.font = "10px 'JetBrains Mono', monospace";
        ctx.fillText("t" + (k + 1), QX * CS + (k % 4) * 38 + 16, 160 + Math.floor(k / 4) * 20);
      }
      if (n > shown) {
        ctx.fillStyle = MUT;
        ctx.fillText("... colors repeat: " + n + " threads", QX * CS, 150 + 2 * 20 + 14);
      }
    }
    function seqPartial(ctx, count) {
      for (var k = 0; k < count && k < order.length; k++) {
        var cur = k === count - 1;
        ffill(ctx, order[k][0], order[k][1], cur ? RED : "#9ca3af", cur ? 0.9 : 0.25);
        if (cur) {
          ctx.font = "bold 10px 'JetBrains Mono', monospace";
          ctx.textAlign = "left"; ctx.fillStyle = RED;
          ctx.fillText("thread 1", order[k][0] * FS + FS + 4, order[k][1] * FS + FS / 2 + 3);
        }
      }
    }
    function ringThreads(ctx, upto) {
      for (var r = 0; r < upto; r++) {
        rings[r].forEach(function (c) { ffill(ctx, c[0], c[1], "#9ca3af", 0.25); });
      }
      rings[upto].forEach(function (c, k) {
        ffill(ctx, c[0], c[1], THREADS[k % THREADS.length], 0.85);
        if (rings[upto].length <= 8) {
          ctx.font = "bold 8px 'JetBrains Mono', monospace";
          ctx.textAlign = "center"; ctx.fillStyle = "#fff";
          ctx.fillText(String(k + 1), c[0] * FS + FS / 2, c[1] * FS + FS / 2 + 3);
        }
      });
    }
    var rA = Math.floor(dstD * 0.3), rB = Math.floor(dstD * 0.6);
    var batch1 = [
      { s: { x: 2, y: 2 }, t: { x: 9, y: 4 }, c: GREEN },
      { s: { x: 16, y: 2 }, t: { x: 27, y: 4 }, c: PURPLE },
      { s: { x: 2, y: 17 }, t: { x: 10, y: 18 }, c: AMBER },
      { s: { x: 23, y: 13 }, t: { x: 28, y: 15 }, c: TEAL },
    ];
    var conflictPair = [
      { s: { x: 8, y: 7 }, t: { x: 17, y: 6 }, c: BLUE },
      { s: { x: 8, y: 6 }, t: { x: 17, y: 7 }, c: RED },
    ];
    function box(ctx, n, color) {
      var x0 = Math.min(n.s.x, n.t.x) - 1, x1 = Math.max(n.s.x, n.t.x) + 1;
      var y0 = Math.min(n.s.y, n.t.y) - 1, y1 = Math.max(n.s.y, n.t.y) + 1;
      ctx.save(); ctx.setLineDash([5, 4]); ctx.strokeStyle = color; ctx.lineWidth = 1.5;
      ctx.strokeRect(x0 * FS, y0 * FS, (x1 - x0 + 1) * FS, (y1 - y0 + 1) * FS);
      ctx.restore();
    }
    function routeNet(ctx, n, w) {
      var p = bfs(n.s, n.t, blocked, FW, FH);
      ctx.save();
      ctx.strokeStyle = n.c; ctx.lineWidth = w || 4; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath();
      p.forEach(function (c, k) {
        var X = c.x * FS + FS / 2, Y = c.y * FS + FS / 2;
        if (k === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
      });
      ctx.stroke();
      ctx.restore();
      fpin(ctx, n.s, n.c, "S"); fpin(ctx, n.t, n.c, "T");
    }
    return { frames: [
      {
        paint: function (ctx) { bgw(ctx); fpin(ctx, S, GREEN_DEEP, "S"); fpin(ctx, T, BLUE, "T");
          panelTx(ctx, ["the problem", FW + " x " + FH + " = " + (FW * FH) + " cells", "two walls to bend around",
                        "distance S to T: " + dstD]); },
        cap: "A " + FW + " x " + FH + " grid with two walls. Both " +
             "schedules below run the same Lee wave over the same " +
             "cells and find the same path; the only thing that " +
             "differs is which thread touches which cell, and when.",
      },
      {
        paint: function (ctx) { bgw(ctx); seqPartial(ctx, 1);
          fpin(ctx, S, GREEN_DEEP, "S"); fpin(ctx, T, BLUE, "T");
          panelTx(ctx, ["sequential: 1 thread", "step 1 of " + seqSteps, "thread 1 owns EVERY cell", "  (red = settling now)"]); },
        cap: "Sequential, step 1: there is one thread. The red cell is " +
             "the one it is settling this step; thread 1 will " +
             "personally touch every cell this search ever settles, " +
             "one per step.",
      },
      {
        paint: function (ctx) { bgw(ctx); seqPartial(ctx, 40);
          fpin(ctx, S, GREEN_DEEP, "S"); fpin(ctx, T, BLUE, "T");
          panelTx(ctx, ["sequential: 1 thread", "step 40 of " + seqSteps, "grey = thread 1's past", "  40 steps",
                        "red = thread 1 now", "!nothing else is working"]); },
        cap: "Sequential, step 40: every grey cell was settled by the " +
             "same thread 1 on an earlier step; the red cell is its " +
             "current one. At any instant, exactly one cell belongs to " +
             "a thread and everything else waits.",
      },
      {
        paint: function (ctx) { bgw(ctx); seqPartial(ctx, seqSteps);
          fpin(ctx, S, GREEN_DEEP, "S"); fpin(ctx, T, BLUE, "T");
          panelTx(ctx, ["sequential: 1 thread", "step " + seqSteps + " of " + seqSteps, "T settled",
                        "!" + seqSteps + " cells x 1 thread", "!= " + seqSteps + " steps"]); },
        cap: "Sequential, step " + seqSteps + ": thread 1 finally " +
             "settles T. " + seqSteps + " cells, one thread, " +
             seqSteps + " steps. Hold that number.",
      },
      {
        paint: function (ctx) { bgw(ctx); ringThreads(ctx, 1);
          fpin(ctx, S, GREEN_DEEP, "S"); fpin(ctx, T, BLUE, "T");
          panelTx(ctx, ["GPU: 1 thread per cell", "step 1 of " + (dstD + 1), "ring 1: " + rings[1].length + " cells",
                        "-> " + rings[1].length + " threads, numbered", "  in their cells"]); threadLegend(ctx, rings[1].length); },
        cap: "GPU (Graphics Processing Unit), step 1: the frontier " +
             "ring has " + rings[1].length + " cells and each is " +
             "assigned to its own thread (colors, numbered in the " +
             "cells). All of them relax their neighbours at the same " +
             "instant: one step, " + rings[1].length + " cells.",
      },
      {
        paint: function (ctx) { bgw(ctx); ringThreads(ctx, rA);
          fpin(ctx, S, GREEN_DEEP, "S"); fpin(ctx, T, BLUE, "T");
          panelTx(ctx, ["GPU: 1 thread per cell", "step " + rA + " of " + (dstD + 1), "this ring: " + rings[rA].length + " cells",
                        "-> " + rings[rA].length + " threads at once", "grey = settled by earlier", "  steps' threads"]); threadLegend(ctx, rings[rA].length); },
        cap: "GPU step " + rA + ": this ring's " + rings[rA].length +
             " cells are " + rings[rA].length + " threads working " +
             "simultaneously, one cell each (colors cycle through the " +
             "thread palette). The grey interior was settled by earlier " +
             "steps' threads; no cell is ever touched twice.",
      },
      {
        paint: function (ctx) { bgw(ctx); ringThreads(ctx, rB);
          fpin(ctx, S, GREEN_DEEP, "S"); fpin(ctx, T, BLUE, "T");
          panelTx(ctx, ["GPU: 1 thread per cell", "step " + rB + " of " + (dstD + 1), "this ring: " + rings[rB].length + " cells",
                        "widest ring anywhere: " + maxRing, "  = peak parallel width"]); threadLegend(ctx, rings[rB].length); },
        cap: "GPU step " + rB + ": through the wall's gap, " +
             rings[rB].length + " threads this step. The widest ring " +
             "of the whole search is " + maxRing + " cells: the peak " +
             "number of threads ever busy at once, and exactly the " +
             "work a single CPU (Central Processing Unit) thread " +
             "serializes.",
      },
      {
        paint: function (ctx) { bgw(ctx); ringThreads(ctx, dstD);
          fpin(ctx, S, GREEN_DEEP, "S"); fpin(ctx, T, BLUE, "T");
          panelTx(ctx, ["T reached", "sequential: " + seqSteps + " steps", "  (1 thread)", "+GPU: " + (dstD + 1) + " steps",
                        "  (up to " + maxRing + " threads)", "+~" + speedup + "x fewer steps", "", "GAMER: this relaxation", "as iterated GPU sweeps"]); },
        cap: "T reached at GPU step " + (dstD + 1) + ". Same cells, " +
             "same path: one thread took " + seqSteps + " steps; up to " +
             maxRing + " threads took " + (dstD + 1) + ", roughly " +
             speedup + " times fewer. GAMER's contribution is making " +
             "this per-ring thread assignment efficient on real GPU " +
             "(Graphics Processing Unit) hardware, as iterated sweeps " +
             "instead of a queue.",
      },
      {
        paint: function (ctx) { bgw(ctx);
          batch1.forEach(function (n) { box(ctx, n, n.c); routeNet(ctx, n); });
          panelTx(ctx, ["axis 2: batching nets", "4 nets, disjoint regions", "each net gets its own",
                        "  block of threads", "+one pass, 4 waves"]); },
        cap: "The second parallel axis: whole nets. Each of these four " +
             "disjoint nets gets its own block of threads, running its " +
             "own ring-parallel wave, all in one GPU (Graphics " +
             "Processing Unit) pass. Threads within a net split the " +
             "ring; blocks across nets split the batch.",
      },
      {
        paint: function (ctx) { bgw(ctx);
          batch1.forEach(function (n) { routeNet(ctx, n, 3); });
          conflictPair.forEach(function (n) { box(ctx, n, n.c); routeNet(ctx, n); });
          ffill(ctx, 12, 6, RED, 0.5); ffill(ctx, 12, 7, RED, 0.5);
          panelTx(ctx, ["batch 2: a conflict", "two nets, overlapping", "  regions", "!both thread blocks",
                        "  claimed the same cells", "keep one, re-queue the", "  other at updated prices"]); },
        cap: "When regions overlap, the batch is speculative: both " +
             "nets' thread blocks route, the collision (red cells) is " +
             "detected after the pass, one net keeps its route and the " +
             "loser re-queues at updated congestion prices. PathFinder " +
             "economics unchanged; only the schedule became " +
             "optimistic.",
      },
      {
        paint: function (ctx) { bgw(ctx);
          batch1.forEach(function (n) { routeNet(ctx, n, 3); });
          conflictPair.forEach(function (n) { routeNet(ctx, n, 3); });
          panelTx(ctx, ["status: research", "GAMER, FastGR, InstantGR", "wins recent ISPD contests",
                        "10-100x reported vs CPU", "!not yet production:", "  full rule deck, memory,", "  determinism"]); },
        cap: "Status: research with momentum. GPU (Graphics Processing " +
             "Unit) global routers hold the recent ISPD (International " +
             "Symposium on Physical Design) contest results with " +
             "order-of-magnitude speedups on academic benchmarks. What " +
             "remains before production: the full rule deck, the " +
             "memory footprint of real designs, and run-to-run " +
             "determinism, engineering rather than algorithm.",
      },
    ], w: 21, speed: 2000 };
  };

  /* ----- ml-route: predict, route, verify, on a placement ----- */
  BUILD["ml-route"] = function () {
    var FS = CS / 2, FW = 30, FH = 20;
    var S = { x: 3, y: 16 }, T = { x: 26, y: 4 };
    /* placement density blobs (features) */
    var BLOBS = [
      { x0: 8, y0: 2, x1: 14, y1: 5, d: 0.5 },
      { x0: 19, y0: 7, x1: 23, y1: 11, d: 0.5 },
      { x0: 4, y0: 12, x1: 8, y1: 14, d: 0.28 },
    ];
    /* ground-truth congestion (found only after routing) and the model's
       prediction: one true cell missed, one phantom predicted */
    var TRUE_HOT = [[9, 4], [10, 4], [11, 4], [12, 4], [13, 4], [21, 8], [21, 9], [21, 10], [14, 9]];
    var PRED_HOT = [[9, 4], [10, 4], [11, 4], [12, 4], [13, 4], [21, 8], [21, 9], [21, 10], [12, 3]];
    function key(c) { return c[0] + "," + c[1]; }
    var trueSet = {}, predSet = {};
    TRUE_HOT.forEach(function (c) { trueSet[key(c)] = true; });
    PRED_HOT.forEach(function (c) { predSet[key(c)] = true; });
    var hits = TRUE_HOT.filter(function (c) { return predSet[key(c)]; }).length;
    var missed = TRUE_HOT.filter(function (c) { return !predSet[key(c)]; });
    var phantom = PRED_HOT.filter(function (c) { return !trueSet[key(c)]; });
    /* Z candidates from S to T, bend at column m */
    function Z(m) { return [S, { x: m, y: S.y }, { x: m, y: T.y }, T]; }
    function cellsOf(pts) {
      var cells = [];
      for (var i = 1; i < pts.length; i++) {
        var a = pts[i - 1], b = pts[i];
        var dx = b.x > a.x ? 1 : b.x < a.x ? -1 : 0;
        var dy = b.y > a.y ? 1 : b.y < a.y ? -1 : 0;
        var x = a.x, y = a.y;
        while (x !== b.x || y !== b.y) { x += dx; y += dy; cells.push([x, y]); }
      }
      return cells;
    }
    function cost(pts, set) {
      var pen = 0, cells = cellsOf(pts);
      cells.forEach(function (c) { if (set[key(c)]) pen += 4; });
      return { wl: cells.length, pen: pen, total: cells.length + pen };
    }
    var CANDS = [8, 14, 21].map(function (m) {
      return { m: m, pts: Z(m), c: cost(Z(m), predSet) };
    });
    var best = CANDS.reduce(function (a, b) { return b.c.total < a.c.total ? b : a; });
    var bestTrue = cost(best.pts, trueSet);
    var crossesMiss = cellsOf(best.pts).some(function (c) {
      return !predSet[key(c)] && trueSet[key(c)];
    });
    function bgw(ctx) {
      ctx.fillStyle = "#fdfdfd";
      ctx.fillRect(0, 0, 21 * CS, H * CS);
      ctx.strokeStyle = "#ebe9e2"; ctx.lineWidth = 1;
      ctx.beginPath();
      for (var x = 0; x <= FW; x++) { ctx.moveTo(x * FS, 0); ctx.lineTo(x * FS, FH * FS); }
      for (var yy = 0; yy <= FH; yy++) { ctx.moveTo(0, yy * FS); ctx.lineTo(FW * FS, yy * FS); }
      ctx.stroke();
    }
    function blobs(ctx) {
      BLOBS.forEach(function (b) {
        ctx.save(); ctx.fillStyle = "#6b7280"; ctx.globalAlpha = b.d * 0.5;
        ctx.fillRect(b.x0 * FS, b.y0 * FS, (b.x1 - b.x0 + 1) * FS, (b.y1 - b.y0 + 1) * FS);
        ctx.restore();
      });
      ctx.font = "10px 'JetBrains Mono', monospace";
      ctx.textAlign = "center"; ctx.fillStyle = MUT;
      ctx.fillText("dense", 11.5 * FS, 1.6 * FS);
      ctx.fillText("dense", 21 * FS, 6.4 * FS);
    }
    function hot(ctx, list, solid) {
      list.forEach(function (c) {
        if (solid) {
          ctx.save(); ctx.globalAlpha = 0.55; ctx.fillStyle = RED;
          ctx.fillRect(c[0] * FS + 0.5, c[1] * FS + 0.5, FS - 1, FS - 1);
          ctx.restore();
        } else {
          ctx.save(); ctx.setLineDash([3, 2]); ctx.strokeStyle = RED; ctx.lineWidth = 1.6;
          ctx.strokeRect(c[0] * FS + 1, c[1] * FS + 1, FS - 2, FS - 2);
          ctx.restore();
        }
      });
    }
    function fpin(ctx, p, color, label) {
      ctx.beginPath();
      ctx.arc(p.x * FS + FS / 2, p.y * FS + FS / 2, 7, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 9px 'JetBrains Mono', monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(label, p.x * FS + FS / 2, p.y * FS + FS / 2 + 0.5);
      ctx.textBaseline = "alphabetic";
    }
    function fpoly(ctx, pts, color, w, dash) {
      ctx.save();
      if (dash) ctx.setLineDash([6, 5]);
      ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath();
      pts.forEach(function (p, k) {
        var X = p.x * FS + FS / 2, Y = p.y * FS + FS / 2;
        if (k === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
      });
      ctx.stroke();
      ctx.restore();
    }
    function panelTx(ctx, lines) {
      var QX = 15.5;
      ctx.textAlign = "left";
      lines.forEach(function (l, k) {
        ctx.fillStyle = k === 0 ? INK : (l.charAt(0) === "!" ? RED : (l.charAt(0) === "+" ? GREEN_DEEP : MUT));
        ctx.font = (k === 0 ? "bold " : "") + "11px 'JetBrains Mono', monospace";
        ctx.fillText(l.replace(/^[!+]/, ""), QX * CS, 16 + k * 16);
      });
    }
    return { frames: [
      {
        paint: function (ctx) { bgw(ctx); blobs(ctx);
          fpin(ctx, S, GREEN_DEEP, "S"); fpin(ctx, T, BLUE, "T");
          panelTx(ctx, ["step 1: featurize", "the model's input is the", "  PLACEMENT, not a routing:",
                        "cell density (grey)", "pin density, net boxes", "rasterized as images", "  (CNN) or a graph (GNN)"]); },
        cap: "Step 1, featurize: the model's input is the placement, " +
             "before any routing exists: cell density (grey regions), " +
             "pin density, and net bounding boxes, rasterized into " +
             "image channels for a CNN (Convolutional Neural Network) " +
             "or a graph for a GNN (Graph Neural Network). One net " +
             "S to T is our test subject.",
      },
      {
        paint: function (ctx) { bgw(ctx); blobs(ctx); hot(ctx, PRED_HOT, false);
          fpin(ctx, S, GREEN_DEEP, "S"); fpin(ctx, T, BLUE, "T");
          panelTx(ctx, ["step 2: predict", "model output: hotspot map", "  (dashed red), BEFORE",
                        "  any routing runs", PRED_HOT.length + " cells predicted", "each carries a price of 4"]); },
        cap: "Step 2, predict: the model outputs a hotspot map (dashed " +
             "red) with no routing run at all: " + PRED_HOT.length +
             " cells flagged, mostly inside the dense regions. The " +
             "router treats each predicted cell as pre-priced " +
             "congestion (price 4 here) from iteration one.",
      },
      {
        paint: function (ctx) { bgw(ctx); blobs(ctx); hot(ctx, PRED_HOT, false);
          CANDS.forEach(function (z) {
            fpoly(ctx, z.pts, z === best ? GREEN : MUT, z === best ? 5 : 3, z !== best);
          });
          fpin(ctx, S, GREEN_DEEP, "S"); fpin(ctx, T, BLUE, "T");
          panelTx(ctx, ["step 3: route priced by", "  the prediction"].concat(
            CANDS.map(function (z) {
              return (z === best ? "+" : "") + "bend " + z.m + ": " + z.c.wl + " + " + z.c.pen + " = " + z.c.total;
            })).concat(["", "the cheapest candidate", "  threads the predicted", "  hotspots"])); },
        cap: "Step 3, route under the prediction: three Z candidates, " +
             "each priced as wirelength plus 4 per predicted cell " +
             "crossed. " + CANDS.map(function (z) {
               return "Bend " + z.m + ": " + z.c.wl + " + " + z.c.pen + " = " + z.c.total;
             }).join(". ") + ". The bend-" + best.m + " candidate wins " +
             "and steers between both predicted clusters, before any " +
             "overflow has ever been observed.",
      },
      {
        paint: function (ctx) { bgw(ctx); blobs(ctx);
          hot(ctx, TRUE_HOT, true); hot(ctx, PRED_HOT, false);
          fpoly(ctx, best.pts, GREEN, 5);
          fpin(ctx, S, GREEN_DEEP, "S"); fpin(ctx, T, BLUE, "T");
          panelTx(ctx, ["step 4: verify", "after routing, truth", "  arrives (solid red)",
                        "predicted " + PRED_HOT.length + ", actual " + TRUE_HOT.length,
                        "+hits: " + hits, "!missed: " + missed.length + " (solid, no dash)",
                        "!phantom: " + phantom.length + " (dash, no solid)"]); },
        cap: "Step 4, verify: routing runs, and the actual congestion " +
             "(solid red) is compared with the prediction (dashed). " +
             "Here " + hits + " of " + TRUE_HOT.length + " real hotspot " +
             "cells were predicted, " + missed.length + " was missed " +
             "(solid without dash, at (" + missed[0][0] + "," + missed[0][1] + ")), and " +
             phantom.length + " phantom was predicted where nothing " +
             "materialized (dash without solid). Every routing run is " +
             "free training data for the next model: the verifier is " +
             "cheap, which cuts both ways.",
      },
      {
        paint: function (ctx) { bgw(ctx); blobs(ctx);
          hot(ctx, TRUE_HOT, true); hot(ctx, PRED_HOT, false);
          fpoly(ctx, best.pts, GREEN, 5);
          fpin(ctx, S, GREEN_DEEP, "S"); fpin(ctx, T, BLUE, "T");
          panelTx(ctx, ["the cost of the errors", "under prediction: " + best.c.total,
                        (crossesMiss ? "!under truth: " + bestTrue.total : "+under truth: " + bestTrue.total),
                        (crossesMiss ? "!the route crossed the" : "+the route dodged the"),
                        (crossesMiss ? "  missed cell" : "  missed cell (lucky)"),
                        "phantom cost a detour", "  around nothing", "negotiation repairs both,", "  spending iterations"]); },
        cap: "The errors have prices. The chosen route cost " +
             best.c.total + " under the prediction and " + bestTrue.total +
             " under the truth" +
             (crossesMiss ? ", because it crossed the missed cell the model never flagged" : "; this time the miss lay off the route") +
             ". The phantom pushed candidates away from a cell that was " +
             "never congested. Neither error is fatal: the PathFinder " +
             "negotiation still runs and repairs the difference, which " +
             "is exactly why the model accelerates the loop rather than " +
             "replacing it.",
      },
      {
        paint: function (ctx) { bgw(ctx); blobs(ctx); hot(ctx, TRUE_HOT, true);
          fpoly(ctx, best.pts, GREEN, 5);
          fpin(ctx, S, GREEN_DEEP, "S"); fpin(ctx, T, BLUE, "T");
          panelTx(ctx, ["status: research", "prediction ships UPSTREAM:", "  routability-driven",
                        "  placement uses these maps", "!inside the router: no", "  learned component in",
                        "  any production search", "why: cheap exact verifier", "  + strong classical search"]); },
        cap: "Status: prediction is used upstream, " +
             "steering routability-driven placement before routing " +
             "runs, and commercial placers ship it. Inside the router, " +
             "no production search has a learned component: routing " +
             "can verify any decision cheaply and exactly (route it, " +
             "count overflow), so a model must beat a strong baseline " +
             "that checks its work in minutes. RouteNet and the " +
             "CircuitNet dataset are the reproducible research line.",
      },
    ], w: 21, speed: 2200 };
  };

  /* ----- x-arch: diagonal routing, the saving and the death ----- */
  BUILD["x-arch"] = function () {
    var S = { x: 2, y: 8 }, T = { x: 12, y: 2 };
    var dx = Math.abs(T.x - S.x), dy = Math.abs(T.y - S.y);
    var manh = dx + dy;
    var oct = (dx - dy) + Math.round(dy * Math.SQRT2 * 100) / 100; /* dx>dy */
    var save = Math.round((1 - oct / manh) * 100);
    function bgw(ctx) { ctx.fillStyle = "#fdfdfd"; ctx.fillRect(0, 0, 21 * CS, H * CS); base(ctx, W, H, []); }
    function fseg2(ctx, a, b, color, w, dash) {
      ctx.save();
      if (dash) ctx.setLineDash([7, 6]);
      ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(a.x * CS + CS / 2, a.y * CS + CS / 2);
      ctx.lineTo(b.x * CS + CS / 2, b.y * CS + CS / 2);
      ctx.stroke();
      ctx.restore();
    }
    function panelTx(ctx, lines) {
      var QX = 15.5;
      ctx.textAlign = "left";
      lines.forEach(function (l, k) {
        ctx.fillStyle = k === 0 ? INK : (l.charAt(0) === "!" ? RED : (l.charAt(0) === "+" ? GREEN_DEEP : MUT));
        ctx.font = (k === 0 ? "bold " : "") + "11px 'JetBrains Mono', monospace";
        ctx.fillText(l.replace(/^[!+]/, ""), QX * CS, 16 + k * 16);
      });
    }
    var mid = { x: S.x + dx - dy, y: S.y };
    return { frames: [
      {
        paint: function (ctx) { bgw(ctx);
          fseg2(ctx, S, { x: T.x, y: S.y }, BLUE, 5);
          fseg2(ctx, { x: T.x, y: S.y }, T, GREEN, 5);
          pin(ctx, S.x, S.y, GREEN_DEEP, "S"); pin(ctx, T.x, T.y, BLUE, "T");
          panelTx(ctx, ["Manhattan wiring", "horizontal + vertical only", "length = " + dx + " + " + dy + " = " + manh]); },
        cap: "Manhattan wiring: every wire is horizontal or vertical, " +
             "so connecting S to T costs the full |dx| + |dy| = " + dx +
             " + " + dy + " = " + manh + ", however it bends. Every " +
             "page in this catalog assumes this geometry; so does " +
             "every production router.",
      },
      {
        paint: function (ctx) { bgw(ctx);
          fseg2(ctx, S, { x: T.x, y: S.y }, BLUE, 3, true);
          fseg2(ctx, { x: T.x, y: S.y }, T, GREEN, 3, true);
          fseg2(ctx, S, mid, BLUE, 5);
          fseg2(ctx, mid, T, "#7c3aed", 5);
          pin(ctx, S.x, S.y, GREEN_DEEP, "S"); pin(ctx, T.x, T.y, BLUE, "T");
          panelTx(ctx, ["X architecture", "add 45-degree layers", "length = " + (dx - dy) + " + " + dy + " x sqrt(2)",
                        "  = " + oct, "+" + save + "% shorter", "promised: less wire,", "  less delay, less power"]); },
        cap: "The X architecture (early 2000s): add metal layers whose " +
             "preferred direction is 45 degrees (violet). The same " +
             "connection runs " + (dx - dy) + " straight plus " + dy +
             " x sqrt(2) diagonal = " + oct + ", " + save + " percent " +
             "shorter than Manhattan on this net; the initiative's " +
             "studies claimed around 20 percent average wirelength and " +
             "matching delay and power. The geometry was real and the " +
             "arithmetic was never the problem.",
      },
      {
        paint: function (ctx) { bgw(ctx);
          fseg2(ctx, S, mid, BLUE, 5);
          fseg2(ctx, mid, T, "#7c3aed", 5);
          /* the diagonal crossing the manufacturing grid */
          ctx.save(); ctx.strokeStyle = RED; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
          for (var x = mid.x + 1; x < T.x; x++) {
            ctx.beginPath();
            var yAt = mid.y - (x - mid.x);
            ctx.strokeRect(x * CS + 3, yAt * CS + 3, CS - 6, CS - 6);
          }
          ctx.restore();
          pin(ctx, S.x, S.y, GREEN_DEEP, "S"); pin(ctx, T.x, T.y, BLUE, "T");
          panelTx(ctx, ["why it died", "!masks, litho, and OPC", "  tuned for 2 directions", "!vias between diagonal",
                        "  and Manhattan layers", "!every tool, library,", "  and deck assumed", "  Manhattan", "ecosystem > geometry"]); },
        cap: "Why it died: manufacturing and the ecosystem. Lithography, " +
             "masks, and OPC (Optical Proximity Correction) were tuned " +
             "for two directions; diagonal wires printed worse and cost " +
             "more (red: every cell the diagonal crosses needs " +
             "non-Manhattan geometry). Vias between diagonal and " +
             "Manhattan layers were awkward, and every router, " +
             "extractor, library, and rule deck assumed rectilinear " +
             "geometry. A real 20 percent was beaten by the cost of " +
             "changing everything at once: in routing, the ecosystem " +
             "outweighs the geometry.",
      },
    ], w: 21, speed: 2400 };
  };

  /* ----- min-cut: recursive bisection of die + netlist (16 blocks) ----- */
  BUILD["mincut-fp"] = function () {
    var COLS = 4, ROWS = 4, N = COLS * ROWS;
    var names = "ABCDEFGHIJKLMNOP".split("");
    /* block i lives in leaf cell (col = i%4, row = floor(i/4)) */
    var cellOf = {}, blocks = [];
    names.forEach(function (nm, i) {
      var c = { name: nm, col: i % COLS, row: Math.floor(i / COLS) };
      cellOf[nm] = c; blocks.push(c);
    });
    /* nets: 4x4 grid adjacency (local) + a few longer nets that get cut */
    var nets = [];
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      var a = names[r * COLS + c];
      if (c < COLS - 1) nets.push([a, names[r * COLS + c + 1]]); /* horizontal */
      if (r < ROWS - 1) nets.push([a, names[(r + 1) * COLS + c]]); /* vertical */
    }
    /* a handful of long-range nets */
    [["A", "P"], ["D", "M"], ["B", "O"], ["E", "L"]].forEach(function (e) { nets.push(e); });
    var colors = [GREEN, TEAL, BLUE, PURPLE];
    function colorOf(b) { return colors[b.col % colors.length]; }
    /* group label at a given level (cut order: V, H, V, H) */
    function group(b, level) {
      var g = "";
      if (level >= 1) g += b.col < 2 ? "L" : "R";
      if (level >= 2) g += b.row < 2 ? "T" : "B";
      if (level >= 3) g += (b.col % 2) ? "r" : "l";
      if (level >= 4) g += (b.row % 2) ? "b" : "t";
      return g || "*";
    }
    function cutCount(level) {
      var n = 0;
      nets.forEach(function (e) {
        if (group(cellOf[e[0]], level) !== group(cellOf[e[1]], level)) n++;
      });
      return n;
    }
    /* nets severed by THIS level's new cuts (what the level minimizes) */
    function newCut(level) { return cutCount(level) - (level > 0 ? cutCount(level - 1) : 0); }
    /* die geometry */
    var DIE = { x0: 0.5, y0: 0.5, x1: 11.5, y1: 9.5 };
    var CW = (DIE.x1 - DIE.x0) / COLS, CH = (DIE.y1 - DIE.y0) / ROWS;
    /* the region a block occupies after `level` cuts */
    function region(b, level) {
      var cLo = 0, cHi = COLS - 1, rLo = 0, rHi = ROWS - 1;
      if (level >= 1) { if (b.col < 2) cHi = 1; else cLo = 2; }
      if (level >= 2) { if (b.row < 2) rHi = 1; else rLo = 2; }
      if (level >= 3) { cLo = cHi = b.col; }
      if (level >= 4) { rLo = rHi = b.row; }
      return {
        x0: DIE.x0 + cLo * CW, x1: DIE.x0 + (cHi + 1) * CW,
        y0: DIE.y0 + rLo * CH, y1: DIE.y0 + (rHi + 1) * CH
      };
    }
    /* position of a block within its region: pack the co-region blocks
       into a small grid so dots do not overlap */
    function positions(level) {
      var byRegion = {};
      blocks.forEach(function (b) {
        var k = group(b, level);
        (byRegion[k] = byRegion[k] || []).push(b);
      });
      var pos = {};
      Object.keys(byRegion).forEach(function (k) {
        var list = byRegion[k];
        var reg = region(list[0], level);
        var cols = Math.ceil(Math.sqrt(list.length));
        var rows = Math.ceil(list.length / cols);
        list.forEach(function (b, i2) {
          var gx = i2 % cols, gy = Math.floor(i2 / cols);
          pos[b.name] = {
            x: (reg.x0 + (reg.x1 - reg.x0) * (gx + 0.5) / cols) * CS,
            y: (reg.y0 + (reg.y1 - reg.y0) * (gy + 0.5) / rows) * CS
          };
        });
      });
      return pos;
    }
    function die(ctx) {
      ctx.fillStyle = "#fdfdfd";
      ctx.fillRect(0, 0, 18 * CS, H * CS);
      ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
      ctx.strokeRect(DIE.x0 * CS, DIE.y0 * CS, (DIE.x1 - DIE.x0) * CS, (DIE.y1 - DIE.y0) * CS);
    }
    function cuts(ctx, level) {
      ctx.save();
      ctx.strokeStyle = "#b45309"; ctx.lineWidth = 2.2; ctx.setLineDash([7, 4]);
      /* level-1 vertical mid, level-2 horizontal mids, etc. draw all cut
         lines up to `level` */
      if (level >= 1) { var x = DIE.x0 + 2 * CW; ctx.beginPath(); ctx.moveTo(x * CS, DIE.y0 * CS); ctx.lineTo(x * CS, DIE.y1 * CS); ctx.stroke(); }
      if (level >= 2) { [1].forEach(function () {}); [DIE.y0 + 2 * CH].forEach(function (y) { ctx.beginPath(); ctx.moveTo(DIE.x0 * CS, y * CS); ctx.lineTo(DIE.x1 * CS, y * CS); ctx.stroke(); }); }
      if (level >= 3) { [1, 3].forEach(function (cc) { var x2 = DIE.x0 + cc * CW; ctx.beginPath(); ctx.moveTo(x2 * CS, DIE.y0 * CS); ctx.lineTo(x2 * CS, DIE.y1 * CS); ctx.stroke(); }); }
      if (level >= 4) { [1, 3].forEach(function (rr) { var y2 = DIE.y0 + rr * CH; ctx.beginPath(); ctx.moveTo(DIE.x0 * CS, y2 * CS); ctx.lineTo(DIE.x1 * CS, y2 * CS); ctx.stroke(); }); }
      ctx.restore();
    }
    function drawNets(ctx, pos, level, onlyCut) {
      nets.forEach(function (e) {
        var cut = level >= 1 && group(cellOf[e[0]], level) !== group(cellOf[e[1]], level);
        if (onlyCut && !cut) return;
        ctx.strokeStyle = cut ? RED : "rgba(26,29,38,0.22)";
        ctx.lineWidth = cut ? 2.2 : 1;
        ctx.beginPath();
        ctx.moveTo(pos[e[0]].x, pos[e[0]].y);
        ctx.lineTo(pos[e[1]].x, pos[e[1]].y);
        ctx.stroke();
      });
    }
    function drawBlocks(ctx, pos) {
      blocks.forEach(function (b) {
        var p = pos[b.name];
        ctx.fillStyle = colorOf(b); ctx.globalAlpha = 0.9;
        ctx.beginPath(); ctx.arc(p.x, p.y, 10.5, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.8; ctx.stroke();
        ctx.fillStyle = "#fff"; ctx.font = "bold 10px 'JetBrains Mono', monospace";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(b.name, p.x, p.y + 0.5);
        ctx.textBaseline = "alphabetic";
      });
    }
    function panel(ctx, lines) {
      var QX = 12.3;
      ctx.textAlign = "left";
      lines.forEach(function (l, k) {
        ctx.fillStyle = k === 0 ? INK : (l.charAt(0) === "!" ? RED : (l.charAt(0) === "+" ? GREEN_DEEP : MUT));
        ctx.font = (k === 0 ? "bold " : "") + "12px 'JetBrains Mono', monospace";
        ctx.fillText(l.replace(/^[!+]/, ""), QX * CS, 26 + k * 20);
      });
    }
    var pos0 = positions(0), pos1 = positions(1), pos2 = positions(2), pos3 = positions(3), pos4 = positions(4);
    return { frames: [
      {
        paint: function (ctx) { die(ctx); drawNets(ctx, pos0, 0); drawBlocks(ctx, pos0);
          panel(ctx, ["the input", N + " blocks (dots)", nets.length + " nets (gray lines)", "one die (box)", "",
                      "goal: place blocks so", "connected ones sit close"]); },
        cap: "The input: a netlist of " + N + " blocks and " + nets.length +
             " nets on one empty die. Min-cut floorplanning never " +
             "reasons about the whole placement at once; it splits the " +
             "problem in half, over and over.",
      },
      {
        paint: function (ctx) { die(ctx); cuts(ctx, 1); drawNets(ctx, pos1, 1); drawBlocks(ctx, pos1);
          panel(ctx, ["level 1: bisect", "netlist split into two", "  groups of " + (N / 2), "  minimizing cut nets",
                      "!cut here (red): " + newCut(1), "one line across the whole", "  die: these cuts span far"]); },
        cap: "Level 1: a partitioner splits the netlist into two groups " +
             "of " + (N / 2) + ", cutting as few nets as possible, here " +
             newCut(1) + " (red). This line runs across the whole die, " +
             "so every net it cuts must span a long distance. These " +
             "coarse, expensive cuts are the ones the recursion " +
             "minimizes first.",
      },
      {
        paint: function (ctx) { die(ctx); cuts(ctx, 2); drawNets(ctx, pos2, 2); drawBlocks(ctx, pos2);
          panel(ctx, ["level 2: recurse", "each half bisected the", "  other way", "4 regions of " + (N / 4) + " blocks",
                      "!cut here: " + newCut(2), "shorter lines (half the", "  die): shorter crossings"]); },
        cap: "Level 2: the partitioner runs inside each half, cutting " +
             "the die the other way into four regions of " + (N / 4) +
             " blocks. These lines span only half the die, so their " +
             newCut(2) + " cut nets cross shorter distances.",
      },
      {
        paint: function (ctx) { die(ctx); cuts(ctx, 3); drawNets(ctx, pos3, 3); drawBlocks(ctx, pos3);
          panel(ctx, ["level 3", "8 regions of " + (N / 8) + " blocks", "!cut here: " + newCut(3),
                      "these cuts sever local", "  nets, but over a", "  quarter of the die"]); },
        cap: "Level 3: eight regions of " + (N / 8) + " blocks. Deeper " +
             "cuts sever more of the dense local grid nets (" + newCut(3) +
             " here), but each spans only a quarter of the die, so those " +
             "crossings are cheap.",
      },
      {
        paint: function (ctx) { die(ctx); cuts(ctx, 4); drawNets(ctx, pos4, 4); drawBlocks(ctx, pos4);
          panel(ctx, ["level 4: leaves", N + " regions, 1 block each", "recursion stops", "!cut here: " + newCut(4),
                      "shortest crossings of all", "+every block placed in", "  one top-down pass"]); },
        cap: "Level 4: the last split leaves one block per region and " +
             "the recursion stops. These finest cuts sever " + newCut(4) +
             " short local nets that each span a single cell. All " + N +
             " blocks are placed in one top-down pass with no iteration, " +
             "the speed that let the method scale.",
      },
      {
        paint: function (ctx) { die(ctx); cuts(ctx, 1); drawBlocks(ctx, pos4); drawNets(ctx, pos4, 1, true);
          panel(ctx, ["why it works", "each level: cut minimized", "  by the partitioner", "coarse cuts span far,",
                      "  deep cuts span little", "+cost = cut count x span,", "  so coarse cuts weigh most"]); },
        cap: "Why minimizing cuts helps wirelength: each red net crosses " +
             "the level-1 line and must be routed across it. The count " +
             "comes from the netlist; the length of each crossing comes " +
             "from the geometry, since a cut made early spans a large " +
             "region and one made deep spans a small one. Minimizing " +
             "the coarse cuts first shortens the whole hierarchy.",
      },
    ], w: 18, speed: 2400 };
  };

  /* ----- cluster growth: greedy seed-and-attach floorplanning ----- */
  BUILD["cluster-fp"] = function () {
    /* weighted connectivity between blocks */
    var edges = [
      ["A", "B", 2], ["A", "C", 1], ["B", "C", 2], ["B", "D", 1],
      ["C", "D", 1], ["D", "E", 2], ["E", "F", 1], ["C", "F", 1],
      ["F", "G", 2], ["G", "H", 1], ["E", "H", 1], ["H", "I", 1],
      ["D", "G", 1]
    ];
    var all = "ABCDEFGHI".split("");
    function conn(x, y) {
      var w = 0;
      edges.forEach(function (e) {
        if ((e[0] === x && e[1] === y) || (e[0] === y && e[1] === x)) w += e[2];
      });
      return w;
    }
    var deg = {}; all.forEach(function (x) { deg[x] = 0; all.forEach(function (y) { if (x !== y) deg[x] += conn(x, y); }); });
    /* seed = highest degree (tie: alphabetical) */
    var seed = all.slice().sort(function (a, b) { return deg[b] - deg[a] || (a < b ? -1 : 1); })[0];
    /* greedy selection order with recorded scores */
    var order = [seed], placedSet = { }; placedSet[seed] = true;
    var stepScores = [];
    while (order.length < all.length) {
      var best = null, bestScore = -1, scores = {};
      all.forEach(function (u) {
        if (placedSet[u]) return;
        var s = 0; Object.keys(placedSet).forEach(function (p) { s += conn(u, p); });
        scores[u] = s;
        if (s > bestScore || (s === bestScore && (deg[u] > deg[best] || (deg[u] === deg[best] && u < best)))) { best = u; bestScore = s; }
      });
      stepScores.push({ pick: best, score: bestScore, scores: scores });
      order.push(best); placedSet[best] = true;
    }
    /* placement on a grid: seed at (2,1); each block into the empty
       neighbour slot minimizing sum(conn x manhattan) to placed blocks */
    var GX = 5, GY = 4;
    function keyc(c) { return c[0] + "," + c[1]; }
    var pos = {}; pos[seed] = [2, 1];
    var occ = {}; occ[keyc(pos[seed])] = seed;
    function neighbors(c) { return [[c[0] + 1, c[1]], [c[0] - 1, c[1]], [c[0], c[1] + 1], [c[0], c[1] - 1]]; }
    for (var oi = 1; oi < order.length; oi++) {
      var b = order[oi];
      var cand = {}, placedNow = Object.keys(pos);
      placedNow.forEach(function (p) {
        neighbors(pos[p]).forEach(function (nc) {
          if (nc[0] < 0 || nc[1] < 0 || nc[0] >= GX || nc[1] >= GY) return;
          if (occ[keyc(nc)]) return;
          cand[keyc(nc)] = nc;
        });
      });
      var bc = null, bcost = 1e9;
      Object.keys(cand).forEach(function (k) {
        var c = cand[k], cost = 0;
        placedNow.forEach(function (p) {
          var w = conn(b, p);
          if (w) cost += w * (Math.abs(c[0] - pos[p][0]) + Math.abs(c[1] - pos[p][1]));
        });
        /* tie-break: closer to cluster centroid, then key */
        if (cost < bcost - 1e-6 || (Math.abs(cost - bcost) < 1e-6 && k < keyc(bc || [9, 9]))) { bcost = cost; bc = c; }
      });
      pos[b] = bc; occ[keyc(bc)] = b;
    }
    /* die cell geometry */
    var OX = 1.0, OY = 1.0, CELL = 1.6;
    function cx(gx) { return (OX + gx * CELL + CELL / 2) * CS; }
    function cy(gy) { return (OY + gy * CELL + CELL / 2) * CS; }
    var colorOf = { }; all.forEach(function (x, i) { colorOf[x] = [GREEN, TEAL, BLUE, PURPLE, AMBER][i % 5]; });
    function bg(ctx) { ctx.fillStyle = "#fdfdfd"; ctx.fillRect(0, 0, 18 * CS, H * CS); }
    function dieOutline(ctx) {
      ctx.strokeStyle = "rgba(26,29,38,0.35)"; ctx.lineWidth = 1.5;
      ctx.strokeRect(OX * CS, OY * CS, GX * CELL * CS, GY * CELL * CS);
    }
    function nets(ctx, upto) {
      edges.forEach(function (e) {
        if (!pos[e[0]] || !pos[e[1]]) return;
        var i0 = order.indexOf(e[0]), i1 = order.indexOf(e[1]);
        if (i0 > upto || i1 > upto) return;
        ctx.strokeStyle = "rgba(26,29,38,0.25)"; ctx.lineWidth = e[2];
        ctx.beginPath(); ctx.moveTo(cx(pos[e[0]][0]), cy(pos[e[0]][1])); ctx.lineTo(cx(pos[e[1]][0]), cy(pos[e[1]][1])); ctx.stroke();
      });
    }
    function block(ctx, b, hl) {
      var p = pos[b], x = (OX + p[0] * CELL) * CS, y = (OY + p[1] * CELL) * CS, s = CELL * CS;
      ctx.fillStyle = colorOf[b]; ctx.globalAlpha = hl ? 0.95 : 0.75;
      ctx.fillRect(x + 3, y + 3, s - 6, s - 6);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = hl ? INK : "#fff"; ctx.lineWidth = hl ? 3 : 2;
      ctx.strokeRect(x + 3, y + 3, s - 6, s - 6);
      ctx.fillStyle = "#fff"; ctx.font = "bold 13px 'JetBrains Mono', monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(b, x + s / 2, y + s / 2 + 0.5);
      ctx.textBaseline = "alphabetic";
    }
    function placedUpto(ctx, upto, hlIdx) {
      for (var i = 0; i <= upto; i++) block(ctx, order[i], i === hlIdx);
    }
    function panel(ctx, lines) {
      var QX = 10.6;
      ctx.textAlign = "left";
      lines.forEach(function (l, k) {
        ctx.fillStyle = k === 0 ? INK : (l.charAt(0) === "!" ? RED : (l.charAt(0) === "+" ? GREEN_DEEP : MUT));
        ctx.font = (k === 0 ? "bold " : "") + "12px 'JetBrains Mono', monospace";
        ctx.fillText(l.replace(/^[!+]/, ""), QX * CS, 24 + k * 19);
      });
    }
    /* graph layout for the input frame (circle) */
    function graphInput(ctx, hlSeed) {
      var cxg = 5 * CS, cyg = 5 * CS, R = 3.6 * CS;
      var gp = {};
      all.forEach(function (b, i) {
        var a = -Math.PI / 2 + i * 2 * Math.PI / all.length;
        gp[b] = { x: cxg + R * Math.cos(a), y: cyg + R * Math.sin(a) };
      });
      edges.forEach(function (e) {
        ctx.strokeStyle = "rgba(26,29,38,0.25)"; ctx.lineWidth = e[2];
        ctx.beginPath(); ctx.moveTo(gp[e[0]].x, gp[e[0]].y); ctx.lineTo(gp[e[1]].x, gp[e[1]].y); ctx.stroke();
      });
      all.forEach(function (b) {
        var isSeed = hlSeed && b === seed;
        ctx.beginPath(); ctx.arc(gp[b].x, gp[b].y, isSeed ? 16 : 13, 0, Math.PI * 2);
        ctx.fillStyle = isSeed ? GREEN_DEEP : colorOf[b]; ctx.fill();
        ctx.strokeStyle = isSeed ? INK : "#fff"; ctx.lineWidth = isSeed ? 3 : 2; ctx.stroke();
        ctx.fillStyle = "#fff"; ctx.font = "bold 12px 'JetBrains Mono', monospace";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(b, gp[b].x, gp[b].y + 0.5); ctx.textBaseline = "alphabetic";
      });
    }
    function scoreLines(step) {
      var st = stepScores[step];
      var us = Object.keys(st.scores).sort(function (a, b) { return st.scores[b] - st.scores[a] || (a < b ? -1 : 1); });
      var out = ["candidate scores (step " + (step + 1) + ")"];
      us.forEach(function (u) {
        out.push((u === st.pick ? "+" : "") + u + ": " + st.scores[u] + (u === st.pick ? "  <- pick" : ""));
      });
      return out;
    }
    var frames = [];
    frames.push({
      paint: function (ctx) { bg(ctx); graphInput(ctx, false);
        panel(ctx, ["the input", all.length + " blocks", edges.length + " weighted nets", "(line width = weight)", "", "degree of each block", "= total net weight"]); },
      cap: "The input: " + all.length + " blocks and " + edges.length +
           " weighted connections (line width shows weight). Cluster " +
           "growth builds a floorplan one block at a time, always " +
           "attaching the block most tied to what is already placed.",
    });
    frames.push({
      paint: function (ctx) { bg(ctx); graphInput(ctx, true);
        panel(ctx, ["step 0: seed", "seed = highest degree", "!" + seed + ": degree " + deg[seed], "(most connected block)", "", "place it first, alone"]); },
      cap: "Step 0, the seed: the block with the highest total " +
           "connectivity, " + seed + " with degree " + deg[seed] + ", is " +
           "placed first. A well-connected seed keeps the densest part " +
           "of the netlist near the center.",
    });
    frames.push({
      paint: function (ctx) { bg(ctx); dieOutline(ctx); nets(ctx, 0); placedUpto(ctx, 0, 0);
        panel(ctx, ["seed placed", seed + " sits on the die", "", "now grow: score every", "  unplaced block by its", "  connection to " + seed]); },
      cap: "The seed " + seed + " is placed on the die. From here the " +
           "loop repeats: score each unplaced block by its connectivity " +
           "to the placed cluster, attach the winner in the best open " +
           "slot.",
    });
    /* every attach step, with the full candidate-score list */
    stepScores.forEach(function (st, stp) {
      var pick = order[stp + 1];
      frames.push({
        paint: function (ctx) { bg(ctx); dieOutline(ctx); nets(ctx, stp + 1); placedUpto(ctx, stp + 1, stp + 1);
          panel(ctx, scoreLines(stp).concat(["", pick + ": highest score " + st.score, "placed in the open slot", "  with least added wire"])); },
        cap: "Step " + (stp + 1) + " of " + stepScores.length + ": every " +
             "unplaced block is scored by its total connectivity to the " +
             "placed set (right). " + pick + " wins with " + st.score +
             ", and is placed in the empty slot next to the cluster with " +
             "the lowest added-wire cost. Every choice is final.",
      });
    });
    frames.push({
      paint: function (ctx) { bg(ctx); dieOutline(ctx); nets(ctx, all.length - 1); placedUpto(ctx, all.length - 1, -1);
        panel(ctx, ["what it is for", "greedy: no global view,", "  every choice final", "quality trails search,", "  but it is legal + fast",
                    "+used as the INITIAL", "  solution an annealer", "  starts from"]); },
      cap: "The result is a legal floorplan produced from nothing in " +
           "linear time. Because every choice is final and there is no " +
           "global view, its quality trails any search method, so its " +
           "role is to be the initial solution an annealer refines, far " +
           "better than a random scatter as a starting point.",
    });
    return { frames: frames, w: 15, speed: 2200 };
  };

  /* ----- rectangular dualization: adjacency graph <-> floorplan ----- */
  BUILD["rectdual-fp"] = function () {
    /* a floorplan chosen so its adjacencies are a real planar graph */
    var blocks = {
      A: [0, 0, 2, 2], B: [2, 0, 6, 2], C: [0, 2, 3, 4], D: [3, 2, 6, 4]
    };
    var edges = [["A", "B"], ["A", "C"], ["B", "C"], ["B", "D"], ["C", "D"]];
    var colorOf = { A: GREEN, B: BLUE, C: AMBER, D: PURPLE };
    var EDGE_COLORS = [GREEN, BLUE, AMBER, PURPLE, TEAL, RED];
    var REASONS = ["shared data bus", "same power domain", "abutted datapath", "matched analog pair", "heavy bus"];
    /* floorplan geometry */
    var SX = 1.6, SY = 1.6, OX = 0.9, OY = 1.2;
    function fx(x) { return (OX + x * SX) * CS; }
    function fy(y) { return (OY + y * SY) * CS; }
    /* graph node positions = block centroids */
    function centroid(b) { var r = blocks[b]; return [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2]; }
    function bg(ctx) { ctx.fillStyle = "#fdfdfd"; ctx.fillRect(0, 0, 19 * CS, H * CS); }
    function drawBlock(ctx, b, alpha) {
      var r = blocks[b];
      ctx.fillStyle = colorOf[b]; ctx.globalAlpha = alpha === undefined ? 0.35 : alpha;
      ctx.fillRect(fx(r[0]) + 2, fy(r[1]) + 2, (r[2] - r[0]) * SX * CS - 4, (r[3] - r[1]) * SY * CS - 4);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.strokeRect(fx(r[0]) + 2, fy(r[1]) + 2, (r[2] - r[0]) * SX * CS - 4, (r[3] - r[1]) * SY * CS - 4);
      var c = centroid(b);
      ctx.fillStyle = INK; ctx.font = "bold 15px 'JetBrains Mono', monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(b, fx(c[0]), fy(c[1]) + 0.5); ctx.textBaseline = "alphabetic";
    }
    function drawFloorplan(ctx, alpha) { Object.keys(blocks).forEach(function (b) { drawBlock(ctx, b, alpha); }); }
    /* shared wall between two adjacent rects, as a segment */
    function sharedWall(b1, b2) {
      var r1 = blocks[b1], r2 = blocks[b2];
      if (r1[2] === r2[0] || r1[0] === r2[2]) { /* vertical */
        var x = (r1[2] === r2[0]) ? r1[2] : r1[0];
        var y0 = Math.max(r1[1], r2[1]), y1 = Math.min(r1[3], r2[3]);
        return { vert: true, x: x, a: y0, b: y1 };
      }
      var y = (r1[3] === r2[1]) ? r1[3] : r1[1];
      var x0 = Math.max(r1[0], r2[0]), x1 = Math.min(r1[2], r2[2]);
      return { vert: false, y: y, a: x0, b: x1 };
    }
    function drawWall(ctx, w, color) {
      ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.lineCap = "round";
      ctx.beginPath();
      if (w.vert) { ctx.moveTo(fx(w.x), fy(w.a) + 3); ctx.lineTo(fx(w.x), fy(w.b) - 3); }
      else { ctx.moveTo(fx(w.a) + 3, fy(w.y)); ctx.lineTo(fx(w.b) - 3, fy(w.y)); }
      ctx.stroke();
    }
    function node(ctx, cxp, cyp, label, color, r) {
      ctx.beginPath(); ctx.arc(cxp, cyp, r || 15, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.font = "bold 13px 'JetBrains Mono', monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(label, cxp, cyp + 0.5); ctx.textBaseline = "alphabetic";
    }
    function drawGraph(ctx, hlEdge) {
      edges.forEach(function (e) {
        var c1 = centroid(e[0]), c2 = centroid(e[1]);
        var hl = hlEdge && ((hlEdge[0] === e[0] && hlEdge[1] === e[1]) || (hlEdge[0] === e[1] && hlEdge[1] === e[0]));
        ctx.strokeStyle = hl ? RED : "rgba(26,29,38,0.4)"; ctx.lineWidth = hl ? 3 : 2;
        ctx.beginPath(); ctx.moveTo(fx(c1[0]), fy(c1[1])); ctx.lineTo(fx(c2[0]), fy(c2[1])); ctx.stroke();
      });
      Object.keys(blocks).forEach(function (b) { var c = centroid(b); node(ctx, fx(c[0]), fy(c[1]), b, colorOf[b]); });
    }
    function drawNodesOnly(ctx) {
      Object.keys(blocks).forEach(function (b) { var c = centroid(b); node(ctx, fx(c[0]), fy(c[1]), b, colorOf[b]); });
    }
    function drawEdgesOnly(ctx) {
      edges.forEach(function (e) {
        var c1 = centroid(e[0]), c2 = centroid(e[1]);
        ctx.strokeStyle = "rgba(26,29,38,0.55)"; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(fx(c1[0]), fy(c1[1])); ctx.lineTo(fx(c2[0]), fy(c2[1])); ctx.stroke();
      });
    }
    function panel(ctx, lines) {
      var QX = 11.4;
      ctx.textAlign = "left";
      lines.forEach(function (l, k) {
        ctx.fillStyle = k === 0 ? INK : (l.charAt(0) === "!" ? RED : (l.charAt(0) === "+" ? GREEN_DEEP : MUT));
        ctx.font = (k === 0 ? "bold " : "") + "12px 'JetBrains Mono', monospace";
        ctx.fillText(l.replace(/^[!+]/, ""), QX * CS, 24 + k * 19);
      });
    }
    /* separating-triangle counterexample (schematic graph only) */
    function drawBadGraph(ctx) {
      var P = { X: [2.2, 0.3], Y: [4.6, 0.3], Z: [3.4, 3.4], D: [3.4, 1.6], E: [3.4, -0.6] };
      /* triangle X-Y-Z, D inside connected to all three, E outside connected to all three */
      var tri = [["X", "Y"], ["Y", "Z"], ["Z", "X"]];
      var inner = [["D", "X"], ["D", "Y"], ["D", "Z"]];
      var outer = [["E", "X"], ["E", "Y"]];
      function seg(a, b, col, w, dash) {
        ctx.save(); if (dash) ctx.setLineDash([5, 4]); ctx.strokeStyle = col; ctx.lineWidth = w;
        ctx.beginPath(); ctx.moveTo(fx(P[a][0]), fy(P[a][1])); ctx.lineTo(fx(P[b][0]), fy(P[b][1])); ctx.stroke(); ctx.restore();
      }
      inner.forEach(function (e) { seg(e[0], e[1], "rgba(26,29,38,0.35)", 2); });
      outer.forEach(function (e) { seg(e[0], e[1], "rgba(26,29,38,0.35)", 2); });
      tri.forEach(function (e) { seg(e[0], e[1], RED, 3.5); });
      Object.keys(P).forEach(function (n) {
        var col = (n === "X" || n === "Y" || n === "Z") ? RED : (n === "D" ? GREEN : BLUE);
        node(ctx, fx(P[n][0]), fy(P[n][1]), n, col);
      });
    }
    /* a resized floorplan (same topology, A enlarged) for the sizing frame */
    var blocksBig = {
      A: [0, 0, 3, 2.6], B: [3, 0, 6, 2.6], C: [0, 2.6, 3.4, 4], D: [3.4, 2.6, 6, 4]
    };
    function drawFloorplanFrom(ctx, bmap) {
      var save = blocks; 
      Object.keys(bmap).forEach(function (b) {
        var r = bmap[b];
        ctx.fillStyle = colorOf[b]; ctx.globalAlpha = 0.35;
        ctx.fillRect(fx(r[0]) + 2, fy(r[1]) + 2, (r[2] - r[0]) * SX * CS - 4, (r[3] - r[1]) * SY * CS - 4);
        ctx.globalAlpha = 1; ctx.strokeStyle = INK; ctx.lineWidth = 2;
        ctx.strokeRect(fx(r[0]) + 2, fy(r[1]) + 2, (r[2] - r[0]) * SX * CS - 4, (r[3] - r[1]) * SY * CS - 4);
        var cxp = fx((r[0] + r[2]) / 2), cyp = fy((r[1] + r[3]) / 2);
        ctx.fillStyle = INK; ctx.font = "bold 15px 'JetBrains Mono', monospace";
        ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(b, cxp, cyp + 0.5); ctx.textBaseline = "alphabetic";
      });
    }
    return { frames: [
      {
        paint: function (ctx) { bg(ctx); drawNodesOnly(ctx);
          panel(ctx, ["step 1: the blocks", "one node per block", "", "a REQUIRED adjacency =", "  two blocks that MUST",
                      "  physically touch", "", "caused by:", "  a shared bus", "  a shared power domain", "  an abutted datapath", "  a matched analog pair"]); },
        cap: "Step 1, the input. Start with the blocks (nodes). A " +
             "required adjacency is a constraint that two blocks must " +
             "physically abut, not merely be routed together. It comes " +
             "from a heavy bus between them, a shared power domain, an " +
             "abutted datapath, or a matched analog pair that must sit " +
             "side by side. These constraints, not a wirelength cost, " +
             "are the specification.",
      },
      {
        paint: function (ctx) { bg(ctx);
          edges.forEach(function (e, idx) {
            var col = EDGE_COLORS[idx % EDGE_COLORS.length];
            var c1 = centroid(e[0]), c2 = centroid(e[1]);
            ctx.strokeStyle = col; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(fx(c1[0]), fy(c1[1])); ctx.lineTo(fx(c2[0]), fy(c2[1])); ctx.stroke();
          });
          drawNodesOnly(ctx);
          var QX = 11.4; ctx.textAlign = "left";
          ctx.fillStyle = INK; ctx.font = "bold 12px 'JetBrains Mono', monospace";
          ctx.fillText("step 1: add an edge per", QX * CS, 24);
          ctx.fillText("  required adjacency", QX * CS, 44);
          edges.forEach(function (e, idx) {
            var col = EDGE_COLORS[idx % EDGE_COLORS.length], y = 44 + (idx + 1) * 22 + 6;
            ctx.fillStyle = col; ctx.fillRect(QX * CS, y - 10, 11, 11);
            ctx.fillStyle = INK; ctx.font = "bold 11px 'JetBrains Mono', monospace";
            ctx.fillText(e[0] + "-" + e[1], QX * CS + 18, y);
            ctx.fillStyle = MUT; ctx.font = "11px 'JetBrains Mono', monospace";
            ctx.fillText(REASONS[idx], QX * CS + 48, y);
          });
        },
        cap: "Building the graph: add one edge for each required " +
             "adjacency. Here " + edges.map(function (e, idx) {
               return e[0] + "-" + e[1] + " (" + REASONS[idx] + ")";
             }).join(", ") + ". The result is an adjacency graph of " +
             Object.keys(blocks).length + " nodes and " + edges.length +
             " edges: the complete specification the dual must realize.",
      },
      {
        paint: function (ctx) { bg(ctx); drawFloorplan(ctx, 0.28); drawNodesOnly(ctx);
          panel(ctx, ["step 2: node -> rectangle", "each graph node becomes", "  one rectangle on the die",
                      "+the node sits inside", "  its own rectangle", "(colors match)"]); },
        cap: "Step 2, each node becomes a rectangle. The die is " +
             "dissected into one rectangle per block, and each graph " +
             "node now sits inside its own rectangle (matching colors). " +
             "So far only the blocks exist, not the adjacencies.",
      },
      {
        paint: function (ctx) { bg(ctx); drawFloorplan(ctx, 0.18);
          edges.forEach(function (e) { drawWall(ctx, sharedWall(e[0], e[1]), RED); });
          drawEdgesOnly(ctx); drawNodesOnly(ctx);
          panel(ctx, ["step 3: edge -> wall", "draw each graph edge", "  over the floorplan",
                      "+every edge line crosses", "  exactly the wall (red)", "  between its two", "  rectangles"]); },
        cap: "Step 3, each edge becomes a wall. Drawing the graph edges " +
             "over the floorplan, every edge line crosses exactly one " +
             "shared wall (red), the wall between the two rectangles it " +
             "connects. Edge and wall are the same thing seen two ways: " +
             "that correspondence is the rectangular dual.",
      },
      {
        paint: function (ctx) { bg(ctx); drawFloorplan(ctx, 0.16);
          edges.forEach(function (e, idx) {
            var col = EDGE_COLORS[idx % EDGE_COLORS.length];
            drawWall(ctx, sharedWall(e[0], e[1]), col);
            var c1 = centroid(e[0]), c2 = centroid(e[1]);
            ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.setLineDash([6, 4]);
            ctx.beginPath(); ctx.moveTo(fx(c1[0]), fy(c1[1])); ctx.lineTo(fx(c2[0]), fy(c2[1])); ctx.stroke(); ctx.restore();
          });
          drawNodesOnly(ctx);
          /* colored checklist */
          var QX = 11.4;
          ctx.textAlign = "left"; ctx.fillStyle = INK;
          ctx.font = "bold 12px 'JetBrains Mono', monospace";
          ctx.fillText("check: edge = wall", QX * CS, 24);
          edges.forEach(function (e, idx) {
            var col = EDGE_COLORS[idx % EDGE_COLORS.length], y = 24 + (idx + 1) * 20;
            ctx.fillStyle = col; ctx.fillRect(QX * CS, y - 10, 11, 11);
            ctx.fillStyle = MUT; ctx.font = "12px 'JetBrains Mono', monospace";
            ctx.fillText(e[0] + "-" + e[1] + ": shared wall", QX * CS + 18, y);
          });
          ctx.fillStyle = MUT; ctx.font = "12px 'JetBrains Mono', monospace";
          ctx.fillText("all " + edges.length + " edges realized;", QX * CS, 24 + (edges.length + 2) * 20);
          ctx.fillText("no untied rectangles touch", QX * CS, 24 + (edges.length + 3) * 20);
        },
        cap: "The check: each graph edge (dashed, colored) crosses its " +
             "own shared wall in the same color, and no two rectangles " +
             "touch unless their nodes are joined by an edge. All " +
             edges.length + " adjacencies are met and none are added: " +
             "the floorplan is a faithful dual.",
      },
      {
        paint: function (ctx) { bg(ctx); drawGraph(ctx, null);
          panel(ctx, ["when does a dual exist?", "a planar triangulated", "  graph has a dual IFF", "  it has NO separating",
                      "  triangle", "+this graph: none,", "  so the build succeeds"]); },
        cap: "When is a dual even possible? A planar triangulated graph " +
             "has a rectangular dual if and only if it has no separating " +
             "triangle, a three-cycle with graph vertices both inside " +
             "and outside it. This graph has none, so the construction " +
             "in steps 2 and 3 succeeds.",
      },
      {
        paint: function (ctx) { bg(ctx); drawBadGraph(ctx);
          panel(ctx, ["the failure case", "triangle X-Y-Z (red)", "!D lies inside it", "!E lies outside it",
                      "the triangle SEPARATES", "  the graph", "!no rectangular dual", "  can exist"]); },
        cap: "The failure case. Triangle X-Y-Z (red) has vertex D inside " +
             "and vertex E outside, so it separates the graph. No " +
             "rectangular dissection can realize this, and the " +
             "adjacency requirement must be relaxed. The condition is " +
             "exact: separating triangle means no dual.",
      },
      {
        paint: function (ctx) { bg(ctx); drawFloorplanFrom(ctx, blocksBig);
          panel(ctx, ["step 5: set the areas", "adjacencies fix the", "  topology (which walls)", "wall POSITIONS are free:",
                      "  slide them to hit each", "  block's target area", "+a linear program;", "  adjacencies unchanged"]); },
        cap: "Step 5, set the areas. The adjacencies fix which walls " +
             "exist, but the wall positions are free. Sliding them " +
             "resizes each block while keeping every adjacency, so " +
             "meeting target areas is a linear program solved after the " +
             "topology is set. Here A is enlarged and every shared wall " +
             "is preserved.",
      },
    ], w: 19, speed: 2400 };
  };

  /* ----- slicing trees and Polish expressions (Wong-Liu) ----- */
  BUILD["slicing-fp"] = function () {
    /* the running example: floorplan, its slicing tree, Polish "123VH4V"
         1  above (2 | 3), that beside 4                                  */
    var base = { 1: [0, 0, 4, 2], 2: [0, 2, 2, 4], 3: [2, 2, 4, 4], 4: [4, 0, 6, 4] };
    var swapped = { 1: [0, 0, 4, 2], 3: [0, 2, 2, 4], 2: [2, 2, 4, 4], 4: [4, 0, 6, 4] };
    var colorOf = { 1: GREEN, 2: BLUE, 3: AMBER, 4: PURPLE };
    var FX = 1.15, FY = 1.3, FOX = 0.6, FOY = 1.1; /* floorplan scale/offset */
    function fx(x) { return (FOX + x * FX) * CS; }
    function fy(y) { return (FOY + y * FY) * CS; }
    function bg(ctx) { ctx.fillStyle = "#fdfdfd"; ctx.fillRect(0, 0, 16 * CS, H * CS); }
    function floorplan(ctx, rects, hl) {
      Object.keys(rects).forEach(function (b) {
        var r = rects[b];
        ctx.fillStyle = colorOf[b]; ctx.globalAlpha = (hl && hl.indexOf(b) >= 0) ? 0.7 : 0.35;
        ctx.fillRect(fx(r[0]) + 2, fy(r[1]) + 2, (r[2] - r[0]) * FX * CS - 4, (r[3] - r[1]) * FY * CS - 4);
        ctx.globalAlpha = 1; ctx.strokeStyle = INK; ctx.lineWidth = 2;
        ctx.strokeRect(fx(r[0]) + 2, fy(r[1]) + 2, (r[2] - r[0]) * FX * CS - 4, (r[3] - r[1]) * FY * CS - 4);
        ctx.fillStyle = "#fff"; ctx.font = "bold 13px 'JetBrains Mono', monospace";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(b, fx((r[0] + r[2]) / 2), fy((r[1] + r[3]) / 2) + 0.5); ctx.textBaseline = "alphabetic";
      });
    }
    /* slicing tree node positions (canvas units) */
    var tnodes = {
      Vr: { x: 4.6, y: 1.1, op: "V" }, H: { x: 2.6, y: 2.9, op: "H" }, F4: { x: 6.8, y: 2.9, leaf: "4" },
      L1: { x: 1.2, y: 4.7, leaf: "1" }, Vi: { x: 4.0, y: 4.7, op: "V" },
      L2: { x: 3.0, y: 6.5, leaf: "2" }, L3: { x: 5.0, y: 6.5, leaf: "3" }
    };
    var tedges = [["Vr", "H"], ["Vr", "F4"], ["H", "L1"], ["H", "Vi"], ["Vi", "L2"], ["Vi", "L3"]];
    function tx(n) { return tnodes[n].x * CS; }
    function ty(n) { return tnodes[n].y * CS; }
    function tree(ctx, hlNode) {
      tedges.forEach(function (e) {
        ctx.strokeStyle = "rgba(26,29,38,0.4)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(tx(e[0]), ty(e[0])); ctx.lineTo(tx(e[1]), ty(e[1])); ctx.stroke();
      });
      Object.keys(tnodes).forEach(function (k) {
        var n = tnodes[k], hl = hlNode === k;
        if (n.op) {
          ctx.beginPath(); ctx.arc(tx(k), ty(k), 15, 0, Math.PI * 2);
          ctx.fillStyle = hl ? RED : "#374151"; ctx.fill();
          ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
          ctx.fillStyle = "#fff"; ctx.font = "bold 13px 'JetBrains Mono', monospace";
          ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(n.op, tx(k), ty(k) + 0.5); ctx.textBaseline = "alphabetic";
        } else {
          ctx.fillStyle = colorOf[n.leaf];
          ctx.fillRect(tx(k) - 13, ty(k) - 13, 26, 26);
          ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.strokeRect(tx(k) - 13, ty(k) - 13, 26, 26);
          ctx.fillStyle = "#fff"; ctx.font = "bold 13px 'JetBrains Mono', monospace";
          ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(n.leaf, tx(k), ty(k) + 0.5); ctx.textBaseline = "alphabetic";
        }
      });
    }
    /* the Polish expression tokens (postorder) */
    var tokens = [{ t: "1", leaf: true }, { t: "2", leaf: true }, { t: "3", leaf: true },
                  { t: "V", op: true }, { t: "H", op: true }, { t: "4", leaf: true }, { t: "V", op: true }];
    function polish(ctx, x0, y0, hlIdx) {
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      tokens.forEach(function (tk, i) {
        var x = x0 + i * 0.85 * CS;
        var col = tk.leaf ? colorOf[tk.t] : "#374151";
        ctx.fillStyle = (hlIdx === i) ? RED : col;
        ctx.fillRect(x - 15, y0 - 15, 30, 30);
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.strokeRect(x - 15, y0 - 15, 30, 30);
        ctx.fillStyle = "#fff"; ctx.font = "bold 14px 'JetBrains Mono', monospace";
        ctx.fillText(tk.t, x, y0 + 0.5);
      });
      ctx.textBaseline = "alphabetic";
    }
    function panel(ctx, lines) {
      var QX = 8.6;
      ctx.textAlign = "left";
      lines.forEach(function (l, k) {
        ctx.fillStyle = k === 0 ? INK : (l.charAt(0) === "!" ? RED : (l.charAt(0) === "+" ? GREEN_DEEP : MUT));
        ctx.font = (k === 0 ? "bold " : "") + "12px 'JetBrains Mono', monospace";
        ctx.fillText(l.replace(/^[!+]/, ""), QX * CS, 24 + k * 19);
      });
    }
    /* the non-slicing pinwheel (5 blocks) */
    function pinwheel(ctx) {
      var P = { a: [0, 0, 4, 1.5], b: [4, 0, 6, 2.5], c: [2, 2.5, 6, 4], d: [0, 1.5, 2, 4], e: [2, 1.5, 4, 2.5] };
      var pc = { a: GREEN, b: BLUE, c: AMBER, d: PURPLE, e: TEAL };
      Object.keys(P).forEach(function (b) {
        var r = P[b];
        ctx.fillStyle = pc[b]; ctx.globalAlpha = 0.35;
        ctx.fillRect(fx(r[0]) + 2, fy(r[1]) + 2, (r[2] - r[0]) * FX * CS - 4, (r[3] - r[1]) * FY * CS - 4);
        ctx.globalAlpha = 1; ctx.strokeStyle = INK; ctx.lineWidth = 2;
        ctx.strokeRect(fx(r[0]) + 2, fy(r[1]) + 2, (r[2] - r[0]) * FX * CS - 4, (r[3] - r[1]) * FY * CS - 4);
        ctx.fillStyle = INK; ctx.font = "bold 15px 'JetBrains Mono', monospace";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(b.toUpperCase(), fx((r[0] + r[2]) / 2), fy((r[1] + r[3]) / 2) + 0.5); ctx.textBaseline = "alphabetic";
      });
    }
    return { frames: [
      {
        paint: function (ctx) { bg(ctx); floorplan(ctx, base);
          panel(ctx, ["a slicing floorplan", "built only by straight", "  guillotine cuts across", "  the whole rectangle",
                      "", "cut into 1 above (2|3),", "  that beside 4", "", "H cut = top / bottom", "V cut = left / right"]); },
        cap: "A slicing floorplan is one that can be built by recursive " +
             "guillotine cuts: each cut runs straight across the whole " +
             "current rectangle. This one is 1 above the pair (2 beside " +
             "3), and that group beside 4.",
      },
      {
        paint: function (ctx) { bg(ctx); tree(ctx, null);
          panel(ctx, ["the slicing tree", "the recursion of cuts", "  IS a binary tree", "", "leaves = blocks",
                      "internal nodes = a cut", "  (H or V)", "", "root V: (1 2 3 H-group)", "  beside 4"]); },
        cap: "The recursion of cuts is a binary tree: leaves are blocks, " +
             "and each internal node is one cut, H (horizontal) or V " +
             "(vertical). The root V splits the die left and right; its " +
             "left subtree is the 1-over-(2|3) group, its right leaf is " +
             "block 4.",
      },
      {
        paint: function (ctx) { bg(ctx); tree(ctx, null);
          polish(ctx, 1.4 * CS, 8.6 * CS, -1);
          panel(ctx, ["the Polish expression", "read the tree in", "  POSTORDER:", "  visit children,",
                      "  then the node", "", "-> 1 2 3 V H 4 V", "", "operands (blocks) and", "  operators (cuts)"]); },
        cap: "Writing the tree in postorder, children before their node, " +
             "gives a Polish expression: 1 2 3 V H 4 V (below). Operands " +
             "are blocks, operators are cuts. The string and the tree " +
             "carry the same information, but the string is a compact, " +
             "editable encoding of the whole floorplan.",
      },
      {
        paint: function (ctx) { bg(ctx); floorplan(ctx, swapped, ["2", "3"]);
          polish(ctx, 1.0 * CS, 8.6 * CS, -1);
          /* draw the swapped tokens: 1 3 2 V H 4 V */
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ["1", "3", "2", "V", "H", "4", "V"].forEach(function (t, i) {
            var x = 1.0 * CS + i * 0.85 * CS, leaf = "1234".indexOf(t) >= 0;
            ctx.fillStyle = leaf ? colorOf[t] : "#374151";
            if (i === 1 || i === 2) ctx.fillStyle = RED;
            ctx.fillRect(x - 15, 8.6 * CS - 15, 30, 30);
            ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.strokeRect(x - 15, 8.6 * CS - 15, 30, 30);
            ctx.fillStyle = "#fff"; ctx.font = "bold 14px 'JetBrains Mono', monospace"; ctx.fillText(t, x, 8.6 * CS + 0.5);
          });
          ctx.textBaseline = "alphabetic";
          panel(ctx, ["annealing edits the string", "move M1: swap two", "  adjacent blocks", "  1 2 3.. -> 1 3 2..",
                      "+the floorplan updates:", "  2 and 3 trade places", "", "every move keeps a valid", "  normalized expression"]); },
        cap: "Simulated annealing perturbs the string directly. Move M1 " +
             "swaps two adjacent blocks (2 and 3, red), and the " +
             "floorplan updates to match: they trade places. The other " +
             "moves invert a chain of cut operators (M2) or swap an " +
             "adjacent block and operator (M3). Every move produces a " +
             "valid normalized expression that decodes to exactly one " +
             "floorplan.",
      },
      {
        paint: function (ctx) { bg(ctx); tree(ctx, null); polish(ctx, 1.4 * CS, 8.6 * CS, -1);
          panel(ctx, ["why it is well-behaved", "normalized: no two equal", "  cut operators in a row",
                      "  -> one expression per", "  floorplan, no", "  redundancy", "", "balloting: every prefix", "  has more operands than",
                      "  operators (valid tree)"]); },
        cap: "Two properties make the search clean. Normalization forbids " +
             "two identical cut operators in a row, so each normalized " +
             "expression encodes exactly one floorplan with no " +
             "redundancy. The balloting property, every prefix has more " +
             "operands than operators, is what guarantees the string " +
             "decodes to a valid tree. The moves are designed to " +
             "preserve both.",
      },
      {
        paint: function (ctx) { bg(ctx); pinwheel(ctx);
          panel(ctx, ["the limitation", "the 5-block pinwheel", "!no single guillotine cut", "  crosses the whole",
                      "  rectangle here", "!not a slicing floorplan", "", "slicing excludes some", "  optimal packings, in",
                      "  exchange for a smaller,", "  better-behaved space"]); },
        cap: "The limitation: the five-block pinwheel cannot be built by " +
             "guillotine cuts, because no straight cut crosses the whole " +
             "rectangle without splitting a block. Slicing floorplans " +
             "exclude such packings. In exchange, the space is far " +
             "smaller and better behaved, sizing is exactly solvable " +
             "inside it, and soft blocks integrate cleanly, which is why " +
             "the method stayed in use.",
      },
    ], w: 16, speed: 2400 };
  };

  /* ----- Stockmeyer shape-curve dynamic program ----- */
  BUILD["stockmeyer-fp"] = function () {
    /* two hard blocks, each with two orientations, combined at a V cut */
    var A = [[2, 4], [4, 2]]; /* (w,h) options */
    var B = [[2, 3], [3, 2]];
    /* V cut: width adds, height = max, over all option pairs */
    var raw = [];
    A.forEach(function (a, ai) {
      B.forEach(function (b, bi) {
        raw.push({ w: a[0] + b[0], h: Math.max(a[1], b[1]), a: ai, b: bi });
      });
    });
    /* keep non-dominated (staircase): p dominated if some q has q.w<=p.w and q.h<=p.h and q!=p */
    function dominated(p, set) {
      return set.some(function (q) {
        return q !== p && q.w <= p.w && q.h <= p.h && (q.w < p.w || q.h < p.h);
      });
    }
    raw.forEach(function (p) { p.dom = dominated(p, raw); });
    var kept = raw.filter(function (p) { return !p.dom; }).sort(function (x, y) { return x.w - y.w; });
    kept.forEach(function (p) { p.area = p.w * p.h; });
    var best = kept.reduce(function (m, p) { return p.area < m.area ? p : m; }, kept[0]);
    /* plot geometry: width on x, height on y (up) */
    var OX = 1.4, BASE = 8.4, SC = 0.85; /* units per unit */
    function px(w) { return (OX + w * SC) * CS; }
    function py(h) { return (BASE - h * SC) * CS; }
    function bg(ctx) { ctx.fillStyle = "#fdfdfd"; ctx.fillRect(0, 0, 17 * CS, H * CS); }
    function axes(ctx) {
      ctx.strokeStyle = "#9b9890"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(px(0), py(0)); ctx.lineTo(px(8.5), py(0)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px(0), py(0)); ctx.lineTo(px(0), py(5.5)); ctx.stroke();
      ctx.fillStyle = MUT; ctx.font = "11px 'JetBrains Mono', monospace";
      ctx.textAlign = "center"; ctx.fillText("width", px(4.2), py(0) + 20);
      ctx.save(); ctx.translate(px(0) - 22, py(2.7)); ctx.rotate(-Math.PI / 2);
      ctx.fillText("height", 0, 0); ctx.restore();
      ctx.textAlign = "right"; ctx.font = "9px 'JetBrains Mono', monospace"; ctx.fillStyle = MUT;
      for (var w = 2; w <= 8; w += 2) { ctx.textAlign = "center"; ctx.fillText(String(w), px(w), py(0) + 12); }
      for (var h = 1; h <= 5; h += 1) { ctx.textAlign = "right"; ctx.fillText(String(h), px(0) - 6, py(h) + 3); }
    }
    function dot(ctx, w, h, color, r) {
      ctx.beginPath(); ctx.arc(px(w), py(h), r || 6, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.stroke();
    }
    function cross(ctx, w, h) {
      ctx.strokeStyle = RED; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px(w) - 5, py(h) - 5); ctx.lineTo(px(w) + 5, py(h) + 5);
      ctx.moveTo(px(w) + 5, py(h) - 5); ctx.lineTo(px(w) - 5, py(h) + 5); ctx.stroke();
    }
    function staircase(ctx, pts, color) {
      var s = pts.slice().sort(function (a, b) { return a.w - b.w; });
      ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.beginPath();
      s.forEach(function (p, i) {
        if (i === 0) { ctx.moveTo(px(p.w), py(p.h)); }
        else { ctx.lineTo(px(p.w), py(s[i - 1].h)); ctx.lineTo(px(p.w), py(p.h)); }
      });
      ctx.stroke();
    }
    /* a small block rectangle drawn at canvas x,y with (w,h) proportions */
    function blockRect(ctx, x, y, w, h, color, label) {
      var u = 9;
      ctx.fillStyle = color; ctx.globalAlpha = 0.4;
      ctx.fillRect(x, y - h * u, w * u, h * u); ctx.globalAlpha = 1;
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.strokeRect(x, y - h * u, w * u, h * u);
      if (label) { ctx.fillStyle = INK; ctx.font = "bold 9px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.fillText(label, x + w * u / 2, y - h * u / 2 + 3); }
    }
    /* a compact second plot for the merge frame (upper right of graph area) */
    var SOX = 1.4, SBASE = 8.2, SSC = 0.42;
    function spx(w) { return (SOX + w * SSC) * CS; }
    function spy(h) { return (SBASE - h * SSC) * CS; }
    function axesSmall(ctx) {
      ctx.strokeStyle = "#c9c6bc"; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(spx(0), spy(0)); ctx.lineTo(spx(8), spy(0)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(spx(0), spy(0)); ctx.lineTo(spx(0), spy(5)); ctx.stroke();
      ctx.fillStyle = MUT; ctx.font = "9px 'JetBrains Mono', monospace"; ctx.textAlign = "left";
      ctx.fillText("merged points (w,h)", spx(0), spy(5) - 6);
    }
    function dotS(ctx, w, h, color, r) { ctx.beginPath(); ctx.arc(spx(w), spy(h), r || 5, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.2; ctx.stroke(); }
    function crossS(ctx, w, h) { ctx.strokeStyle = RED; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(spx(w) - 4, spy(h) - 4); ctx.lineTo(spx(w) + 4, spy(h) + 4); ctx.moveTo(spx(w) + 4, spy(h) - 4); ctx.lineTo(spx(w) - 4, spy(h) + 4); ctx.stroke(); }
    function panel(ctx, lines) {
      var QX = 9.8;
      ctx.textAlign = "left";
      lines.forEach(function (l, k) {
        ctx.fillStyle = k === 0 ? INK : (l.charAt(0) === "!" ? RED : (l.charAt(0) === "+" ? GREEN_DEEP : MUT));
        ctx.font = (k === 0 ? "bold " : "") + "12px 'JetBrains Mono', monospace";
        ctx.fillText(l.replace(/^[!+]/, ""), QX * CS, 24 + k * 19);
      });
    }
    var Ac = A.map(function (o) { return { w: o[0], h: o[1] }; });
    var Bc = B.map(function (o) { return { w: o[0], h: o[1] }; });
    return { frames: [
      {
        paint: function (ctx) { bg(ctx);
          /* the slicing tree A V B */
          ctx.strokeStyle = "rgba(26,29,38,0.4)"; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(4 * CS, 2 * CS); ctx.lineTo(2.5 * CS, 4 * CS); ctx.moveTo(4 * CS, 2 * CS); ctx.lineTo(5.5 * CS, 4 * CS); ctx.stroke();
          ctx.beginPath(); ctx.arc(4 * CS, 2 * CS, 15, 0, Math.PI * 2); ctx.fillStyle = "#374151"; ctx.fill();
          ctx.fillStyle = "#fff"; ctx.font = "bold 13px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("V", 4 * CS, 2 * CS + 0.5); ctx.textBaseline = "alphabetic";
          blockRect(ctx, 2.5 * CS - 12, 5.2 * CS, 2, 4, GREEN, "A");
          blockRect(ctx, 5.5 * CS - 12, 5.2 * CS, 2, 3, BLUE, "B");
          panel(ctx, ["the question", "topology is FIXED", "  (a slicing tree)", "each hard block: W x H",
                      "  or rotated H x W", "", "!2^n orientation combos", "Stockmeyer: the optimum", "  in polynomial time"]); },
        cap: "The topology is fixed by the slicing tree; the remaining " +
             "question is orientation. Each hard block can be placed as " +
             "W x H or rotated to H x W, so n blocks give 2^n " +
             "combinations. Stockmeyer computes the area-optimal choice " +
             "exactly, in polynomial time, with shape curves.",
      },
      {
        paint: function (ctx) { bg(ctx); axes(ctx);
          Ac.forEach(function (o) { dot(ctx, o.w, o.h, GREEN); });
          staircase(ctx, Ac, GREEN);
          blockRect(ctx, px(2) - 26, py(4) - 6, 2, 4, GREEN, "");
          blockRect(ctx, px(4) + 10, py(2) - 6, 4, 2, GREEN, "");
          panel(ctx, ["a leaf's shape curve", "block A: 2x4 or 4x2", "", "plot each option as a", "  (width, height) point",
                      "+two points, one per", "  orientation", "the curve = feasible", "  (w,h) it can realize"]); },
        cap: "A leaf's shape curve is the set of (width, height) pairs " +
             "the block can realize. Hard block A is 2 x 4 or, rotated, " +
             "4 x 2, so its curve is two points (green), one per " +
             "orientation.",
      },
      {
        paint: function (ctx) { bg(ctx); axes(ctx);
          Bc.forEach(function (o) { dot(ctx, o.w, o.h, BLUE); });
          staircase(ctx, Bc, BLUE);
          panel(ctx, ["the other leaf", "block B: 2x3 or 3x2", "", "+its curve: two points", "", "now combine A and B", "  at their parent V cut"]); },
        cap: "Block B is 2 x 3 or 3 x 2, giving its own two-point curve " +
             "(blue). To size the subtree A-V-B, its two child curves " +
             "are merged at the V (vertical cut) node.",
      },
      {
        paint: function (ctx) { bg(ctx);
          /* geometric why: two blocks side by side under a V cut */
          var ox = 1.3 * CS, oy = 3.6 * CS, u = 20;
          var a = A[1], b = B[0]; /* A 4x2, B 2x3 for illustration */
          var Hmax = Math.max(a[1], b[1]);
          /* bounding box (height = max) */
          ctx.strokeStyle = "#b45309"; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
          ctx.strokeRect(ox, oy - Hmax * u, (a[0] + b[0]) * u, Hmax * u); ctx.setLineDash([]);
          /* A on the left, bottom-aligned */
          ctx.fillStyle = GREEN; ctx.globalAlpha = 0.4; ctx.fillRect(ox, oy - a[1] * u, a[0] * u, a[1] * u); ctx.globalAlpha = 1;
          ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.strokeRect(ox, oy - a[1] * u, a[0] * u, a[1] * u);
          /* B on the right */
          ctx.fillStyle = BLUE; ctx.globalAlpha = 0.4; ctx.fillRect(ox + a[0] * u, oy - b[1] * u, b[0] * u, b[1] * u); ctx.globalAlpha = 1;
          ctx.strokeRect(ox + a[0] * u, oy - b[1] * u, b[0] * u, b[1] * u);
          ctx.fillStyle = INK; ctx.font = "bold 10px 'JetBrains Mono', monospace"; ctx.textAlign = "center";
          ctx.fillText("A", ox + a[0] * u / 2, oy - a[1] * u / 2 + 3);
          ctx.fillText("B", ox + a[0] * u + b[0] * u / 2, oy - b[1] * u / 2 + 3);
          /* whitespace label above the shorter block A */
          ctx.fillStyle = "#b45309"; ctx.font = "9px 'JetBrains Mono', monospace";
          ctx.fillText("slack", ox + a[0] * u / 2, oy - a[1] * u - 6);
          ctx.textAlign = "left"; ctx.fillStyle = MUT; ctx.font = "10px 'JetBrains Mono', monospace";
          ctx.fillText("width = w1 + w2 (side by side)", ox, oy + 16);
          ctx.fillText("height = max(h1, h2) (shared envelope)", ox, oy + 30);
          /* the four merged points on a small plot */
          axesSmall(ctx);
          raw.forEach(function (p) {
            dotS(ctx, p.w, p.h, p.dom ? "#c9c6bc" : PURPLE, 5);
            if (p.dom) crossS(ctx, p.w, p.h);
          });
          panel(ctx, ["V cut = side by side", "width ADDS", "height = MAX (both fit", "  one shared envelope;",
                      "  shorter leaves slack)", "", "4 pairs -> (4,4)(5,4)", "  (6,3)(7,2)", "!(5,4) dominated by (4,4)"]); },
        cap: "Why these rules: a vertical cut places the two subtrees " +
             "side by side, so their widths add and they share one " +
             "height envelope, which must fit the taller block (the " +
             "shorter one leaves slack, amber). Over the four option " +
             "pairs this gives (4,4), (5,4), (6,3), (7,2); (5,4) is " +
             "dominated by (4,4), no wider and no taller, so it is " +
             "dropped. An H cut is the mirror: stacked, heights add, the " +
             "wider block sets the width.",
      },
      {
        paint: function (ctx) { bg(ctx); axes(ctx);
          staircase(ctx, kept, PURPLE);
          kept.forEach(function (p) {
            dot(ctx, p.w, p.h, PURPLE, 6);
            ctx.fillStyle = INK; ctx.font = "10px 'JetBrains Mono', monospace"; ctx.textAlign = "left";
            ctx.fillText("(" + p.w + "," + p.h + ") area " + p.area, px(p.w) + 9, py(p.h) - 6);
          });
          panel(ctx, ["the subtree's curve", "kept points (staircase):"].concat(
            kept.map(function (p) { return "  (" + p.w + "," + p.h + ") area " + p.area; })).concat(
            ["", "this curve propagates up", "  to the parent node"])); },
        cap: "The surviving points form the subtree's shape curve, a " +
             "staircase sorted by width: " + kept.map(function (p) {
               return "(" + p.w + "," + p.h + ")";
             }).join(", ") + ". Merging two staircases is linear in " +
             "their size, and this curve propagates up to the parent, " +
             "the same merge repeated to the root.",
      },
      {
        paint: function (ctx) { bg(ctx); axes(ctx);
          staircase(ctx, kept, "#c9c6bc");
          kept.forEach(function (p) { dot(ctx, p.w, p.h, p === best ? GREEN_DEEP : "#c9c6bc", p === best ? 7 : 5); });
          ctx.fillStyle = GREEN_DEEP; ctx.font = "bold 11px 'JetBrains Mono', monospace"; ctx.textAlign = "left";
          ctx.fillText("min area (" + best.w + "," + best.h + ") = " + best.area, px(best.w) + 10, py(best.h) - 6);
          /* traced-back floorplan: A option best.a beside B option best.b */
          var av = A[best.a], bv = B[best.b];
          var ox = 1.2 * CS, oy = 9.0 * CS, u = 14;
          ctx.fillStyle = GREEN; ctx.globalAlpha = 0.4; ctx.fillRect(ox, oy - av[1] * u, av[0] * u, av[1] * u); ctx.globalAlpha = 1;
          ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.strokeRect(ox, oy - av[1] * u, av[0] * u, av[1] * u);
          ctx.fillStyle = BLUE; ctx.globalAlpha = 0.4; ctx.fillRect(ox + av[0] * u, oy - bv[1] * u, bv[0] * u, bv[1] * u); ctx.globalAlpha = 1;
          ctx.strokeRect(ox + av[0] * u, oy - bv[1] * u, bv[0] * u, bv[1] * u);
          ctx.fillStyle = INK; ctx.font = "bold 10px 'JetBrains Mono', monospace"; ctx.textAlign = "center";
          ctx.fillText("A " + av[0] + "x" + av[1], ox + av[0] * u / 2, oy - av[1] * u / 2 + 3);
          ctx.fillText("B " + bv[0] + "x" + bv[1], ox + av[0] * u + bv[0] * u / 2, oy - bv[1] * u / 2 + 3);
          panel(ctx, ["pick + trace back", "at the root, pick the", "  point of least area", "+here (" + best.w + "," + best.h + ") = " + best.area,
                      "walk back down the tree:", "  A -> " + A[best.a][0] + "x" + A[best.a][1] + ",  B -> " + B[best.b][0] + "x" + B[best.b][1], "the exact orientations", "  that achieve it"]); },
        cap: "At the root, pick the curve point of least area, here (" +
             best.w + "," + best.h + ") = " + best.area + ". Walking " +
             "back down the tree reads off which child option produced " +
             "it: A as " + A[best.a][0] + " x " + A[best.a][1] + " beside " +
             "B as " + B[best.b][0] + " x " + B[best.b][1] + " (drawn " +
             "below). The orientations are optimal, not heuristic.",
      },
      {
        paint: function (ctx) { bg(ctx);
          panel(ctx, ["why slicing matters", "the merge composes only", "  because each node has", "  exactly two children",
                      "  and one cut direction", "", "!for NON-slicing floorplans", "  the same orientation", "  problem is NP-hard",
                      "guillotine structure is", "  what makes the DP work"]); },
        cap: "The result marks a sharp boundary. The dynamic program " +
             "composes because a slicing tree is binary and each node is " +
             "a single cut, so a subtree's whole behavior is captured by " +
             "one shape curve. For non-slicing floorplans the same " +
             "orientation problem is NP-hard (Non-deterministic " +
             "Polynomial hard): guillotine structure is exactly what " +
             "makes the sizing exactly solvable.",
      },
    ], w: 17, speed: 2400 };
  };

  /* ----- sequence pair: two orderings -> non-slicing floorplan ----- */
  BUILD["seqpair-fp"] = function () {
    var blocks = ["1", "2", "3", "4"];
    var size = { "1": [2, 2], "2": [2.4, 2], "3": [2, 2.4], "4": [2.4, 2.4] };
    var colorOf = { "1": GREEN, "2": BLUE, "3": AMBER, "4": PURPLE };
    /* solve a sequence pair: relations + longest-path packing */
    function solve(gp, gm) {
      var pP = {}, pM = {};
      gp.forEach(function (b, i) { pP[b] = i; });
      gm.forEach(function (b, i) { pM[b] = i; });
      function relation(a, b) {
        var bp = pP[a] < pP[b], bm = pM[a] < pM[b];
        if (bp && bm) return "L"; if (!bp && !bm) return "Lr";
        if (bp && !bm) return "A"; return "Ar";
      }
      var leftOf = [], above = [];
      for (var x = 0; x < blocks.length; x++) for (var y = 0; y < blocks.length; y++) {
        if (x === y) continue;
        var r = relation(blocks[x], blocks[y]);
        if (r === "L") leftOf.push([blocks[x], blocks[y]]);
        if (r === "A") above.push([blocks[x], blocks[y]]);
      }
      function longest(edges, dimIdx) {
        var pos = {}; blocks.forEach(function (b) { pos[b] = null; });
        function c(b) {
          if (pos[b] !== null) return pos[b];
          pos[b] = 0; /* guard */ var m = 0;
          edges.forEach(function (e) { if (e[1] === b) m = Math.max(m, c(e[0]) + size[e[0]][dimIdx]); });
          pos[b] = m; return m;
        }
        blocks.forEach(c); return pos;
      }
      var X = longest(leftOf, 0);
      var belowEdges = above.map(function (e) { return [e[1], e[0]]; });
      var Y = longest(belowEdges, 1);
      var relList = [];
      for (var a1 = 0; a1 < blocks.length; a1++) for (var b1 = a1 + 1; b1 < blocks.length; b1++) {
        var rr = relation(blocks[a1], blocks[b1]);
        if (rr === "L") relList.push(blocks[a1] + " left of " + blocks[b1]);
        else if (rr === "Lr") relList.push(blocks[b1] + " left of " + blocks[a1]);
        else if (rr === "A") relList.push(blocks[a1] + " above " + blocks[b1]);
        else relList.push(blocks[b1] + " above " + blocks[a1]);
      }
      var W = 0, Hgt = 0;
      blocks.forEach(function (b) { W = Math.max(W, X[b] + size[b][0]); Hgt = Math.max(Hgt, Y[b] + size[b][1]); });
      var rnd = function (v) { return Math.round(v * 10) / 10; };
      return { gp: gp, gm: gm, X: X, Y: Y, relList: relList, W: rnd(W), H: rnd(Hgt) };
    }
    function swap(seq, a, b) {
      var s = seq.slice(), ia = s.indexOf(a), ib = s.indexOf(b);
      s[ia] = b; s[ib] = a; return s;
    }
    var base = solve(["1", "3", "2", "4"], ["3", "1", "4", "2"]);
    /* a chained annealing walk of real swaps */
    var m1 = solve(swap(base.gp, "2", "4"), base.gm);           /* swap 2,4 in P+ */
    var m2 = solve(m1.gp, swap(m1.gm, "3", "1"));               /* swap 3,1 in P- */
    var m3 = solve(swap(m2.gp, "1", "3"), m2.gm);               /* swap 1,3 in P+ */

    var OX = 0.7, OY = 6.2, U = 0.85;
    function fx(x) { return (OX + x * U) * CS; }
    function fy(y) { return (OY - y * U) * CS; }
    function bg(ctx) { ctx.fillStyle = "#fdfdfd"; ctx.fillRect(0, 0, 17 * CS, H * CS); }
    function floorplan(ctx, st, hl) {
      ctx.strokeStyle = "#c9c6bc"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(fx(0), fy(0)); ctx.lineTo(fx(6), fy(0)); ctx.moveTo(fx(0), fy(0)); ctx.lineTo(fx(0), fy(5.2)); ctx.stroke();
      blocks.forEach(function (b) {
        var s = size[b], x = fx(st.X[b]), y = fy(st.Y[b] + s[1]);
        ctx.fillStyle = colorOf[b]; ctx.globalAlpha = (hl && hl.indexOf(b) >= 0) ? 0.8 : 0.4;
        ctx.fillRect(x + 2, y + 2, s[0] * U * CS - 4, s[1] * U * CS - 4); ctx.globalAlpha = 1;
        ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(x + 2, y + 2, s[0] * U * CS - 4, s[1] * U * CS - 4);
        ctx.fillStyle = "#fff"; ctx.font = "bold 14px 'JetBrains Mono', monospace";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(b, x + s[0] * U * CS / 2, y + s[1] * U * CS / 2 + 0.5); ctx.textBaseline = "alphabetic";
      });
    }
    function seqRow(ctx, label, seq, y, hl) {
      ctx.fillStyle = INK; ctx.font = "bold 13px 'JetBrains Mono', monospace"; ctx.textAlign = "left";
      ctx.fillText(label, 0.6 * CS, y + 5);
      seq.forEach(function (b, i) {
        var x = (2.2 + i * 0.85) * CS, on = hl && hl.indexOf(b) >= 0;
        ctx.fillStyle = colorOf[b]; ctx.globalAlpha = on ? 1 : 0.85;
        ctx.fillRect(x - 15, y - 15, 30, 30); ctx.globalAlpha = 1;
        ctx.strokeStyle = on ? RED : "#fff"; ctx.lineWidth = on ? 3 : 2; ctx.strokeRect(x - 15, y - 15, 30, 30);
        ctx.fillStyle = "#fff"; ctx.font = "bold 14px 'JetBrains Mono', monospace";
        ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(b, x, y + 0.5); ctx.textBaseline = "alphabetic";
      });
    }
    function panel(ctx, lines) {
      var QX = 9.6;
      ctx.textAlign = "left";
      lines.forEach(function (l, k) {
        ctx.fillStyle = k === 0 ? INK : (l.charAt(0) === "!" ? RED : (l.charAt(0) === "+" ? GREEN_DEEP : MUT));
        ctx.font = (k === 0 ? "bold " : "") + "12px 'JetBrains Mono', monospace";
        ctx.fillText(l.replace(/^[!+]/, ""), QX * CS, 24 + k * 19);
      });
    }
    function pairPic(ctx, x, y, arrangement) {
      var u = 16;
      function box(bx, by, col, lab) {
        ctx.fillStyle = col; ctx.globalAlpha = 0.5; ctx.fillRect(bx, by, u * 1.6, u * 1.6); ctx.globalAlpha = 1;
        ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.strokeRect(bx, by, u * 1.6, u * 1.6);
        ctx.fillStyle = INK; ctx.font = "bold 11px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(lab, bx + u * 0.8, by + u * 0.8); ctx.textBaseline = "alphabetic";
      }
      if (arrangement === "left") { box(x, y, GREEN, "a"); box(x + u * 1.9, y, BLUE, "b"); }
      else { box(x, y, GREEN, "a"); box(x, y + u * 1.9, BLUE, "b"); }
    }
    /* a frame that shows a swap and its recomputed floorplan */
    function moveFrame(fromSt, toSt, seqLabel, sw, note, capText) {
      return {
        paint: function (ctx) { bg(ctx); floorplan(ctx, toSt, sw);
          seqRow(ctx, "P+ =", toSt.gp, 8.4 * CS, seqLabel === "P+" ? sw : null);
          seqRow(ctx, "P- =", toSt.gm, 9.5 * CS, seqLabel === "P-" ? sw : null);
          panel(ctx, note); },
        cap: capText,
      };
    }
    return { frames: [
      {
        paint: function (ctx) { bg(ctx);
          seqRow(ctx, "P+ =", base.gp, 2.2 * CS, null);
          seqRow(ctx, "P- =", base.gm, 3.6 * CS, null);
          panel(ctx, ["the representation", "write the block names", "  twice, in two orders:", "  a sequence PAIR",
                      "", "no coordinates yet,", "  just two permutations"]); },
        cap: "A sequence pair is the block names written twice in two " +
             "orders, P+ and P-. No coordinates yet; the pair encodes, " +
             "for every pair of blocks, one relative-position relation.",
      },
      {
        paint: function (ctx) { bg(ctx);
          ctx.fillStyle = INK; ctx.font = "bold 12px 'JetBrains Mono', monospace"; ctx.textAlign = "left";
          ctx.fillText("case 1: a before b in BOTH", 0.6 * CS, 1.6 * CS);
          pairPic(ctx, 0.9 * CS, 2.1 * CS, "left");
          ctx.fillStyle = GREEN_DEEP; ctx.font = "12px 'JetBrains Mono', monospace"; ctx.fillText("-> a is LEFT of b", 3.4 * CS, 2.8 * CS);
          ctx.fillStyle = INK; ctx.font = "bold 12px 'JetBrains Mono', monospace";
          ctx.fillText("case 2: before in P+, AFTER in P-", 0.6 * CS, 5.4 * CS);
          pairPic(ctx, 0.9 * CS, 5.9 * CS, "above");
          ctx.fillStyle = GREEN_DEEP; ctx.font = "12px 'JetBrains Mono', monospace"; ctx.fillText("-> a is ABOVE b", 3.4 * CS, 6.9 * CS);
          panel(ctx, ["the one rule", "compare a and b's order", "  in the two sequences", "",
                      "same order in both", "  -> horizontal (left)", "", "opposite orders", "  -> vertical (above)"]); },
        cap: "The whole method rests on one rule. If a comes before b in " +
             "both sequences, a is left of b. If a is before b in P+ but " +
             "after b in P-, a is above b. Same order means horizontal, " +
             "opposite orders vertical.",
      },
      {
        paint: function (ctx) { bg(ctx);
          seqRow(ctx, "P+ =", base.gp, 1.9 * CS, ["1", "3"]);
          seqRow(ctx, "P- =", base.gm, 3.2 * CS, ["1", "3"]);
          panel(ctx, ["apply to all pairs"].concat(base.relList.map(function (r) { return "+" + r; }))
            .concat(["", "every pair -> exactly", "  one relation"])); },
        cap: "Applying the rule to every pair gives a complete set of " +
             "relations: " + base.relList.join(", ") + ". Each pair " +
             "yields exactly one horizontal or vertical constraint.",
      },
      {
        paint: function (ctx) { bg(ctx); floorplan(ctx, base, null);
          panel(ctx, ["decode = pack", "left-of relations set x", "  (longest path)", "above relations set y",
                      "  (longest path)", "", "+overlap-free packing,", "  size " + base.W + " x " + base.H]); },
        cap: "Decoding turns the relations into coordinates: left-of " +
             "relations set x by longest path, above relations set y, " +
             "giving an overlap-free packing of size " + base.W + " x " +
             base.H + ". Sequence pairs are complete: any arrangement, " +
             "slicing or not, has one.",
      },
      moveFrame(base, m1, "P+", ["2", "4"],
        ["move 1: swap 2 and 4", "  in P+ (red)", "", "P+ = " + m1.gp.join(" "), "P- = " + m1.gm.join(" "),
         "+re-derive, re-pack:", "  4 and 2 move right", "  size " + m1.W + " x " + m1.H],
        "Move 1: swap 2 and 4 in P+. Re-deriving the relations and " +
        "re-packing, 4 and 2 shift into a row and the floorplan becomes " +
        m1.W + " x " + m1.H + ", wider and shorter than the " + base.W +
        " x " + base.H + " grid. The swap is a real edit and the layout " +
        "genuinely changes."),
      moveFrame(m1, m2, "P-", ["3", "1"],
        ["move 2: swap 3 and 1", "  in P- (red)", "", "P+ = " + m2.gp.join(" "), "P- = " + m2.gm.join(" "),
         "+1 becomes left-of 3", "  instead of above it", "  size " + m2.W + " x " + m2.H],
        "Move 2, continuing the walk: swap 3 and 1 in P-. Now 1 and 3 " +
        "have the same order in both sequences, so 1 becomes left of 3 " +
        "rather than above it, and the packing rearranges to " + m2.W +
        " x " + m2.H + ". One swap can flip a relation from vertical to " +
        "horizontal."),
      moveFrame(m2, m3, "P+", ["1", "3"],
        ["move 3: swap 1 and 3", "  in P+ (red)", "", "P+ = " + m3.gp.join(" "), "P- = " + m3.gm.join(" "),
         "+another packing,", "  size " + m3.W + " x " + m3.H, "", "annealing = swap, decode,", "  evaluate, cool; repeat"],
        "Move 3: swap 1 and 3 in P+, giving yet another packing (" + m3.W +
        " x " + m3.H + "). This is the whole annealing loop: perturb the " +
        "pair with a swap, decode to a floorplan, evaluate area and " +
        "wirelength, accept or reject, and cool. The cost is that (n!) " +
        "squared encodings collapse onto far fewer distinct floorplans, " +
        "so the search revisits many encodings of the same layout."),
    ], w: 17, speed: 2200 };
  };

  /* ----- bounded-sliceline grid: rooms -> relations -> floorplan ----- */
  BUILD["bsg-fp"] = function () {
    var N = 3; /* n x n room grid */
    var size = { A: [2, 2], B: [2.4, 2], C: [2, 2.4], D: [2.4, 2.4] };
    var colorOf = { A: GREEN, B: BLUE, C: AMBER, D: PURPLE };
    /* placement: block -> [col, row] (row 0 = top) */
    var basePlace = { A: [0, 0], B: [2, 0], C: [0, 2], D: [2, 2] };
    var swapPlace = { A: [0, 0], C: [2, 0], B: [0, 2], D: [2, 2] };
    /* derive left-of (per row) and above (per column), then longest-path pack */
    function solve(place) {
      var blocks = Object.keys(place);
      var leftOf = [], above = [], rel = [];
      /* rows: occupied blocks sorted by column -> chain of left-of */
      for (var r = 0; r < N; r++) {
        var row = blocks.filter(function (b) { return place[b][1] === r; }).sort(function (a, b) { return place[a][0] - place[b][0]; });
        for (var k = 1; k < row.length; k++) { leftOf.push([row[k - 1], row[k]]); rel.push(row[k - 1] + " left of " + row[k]); }
      }
      /* columns: occupied blocks sorted by row -> chain of above */
      for (var c = 0; c < N; c++) {
        var col = blocks.filter(function (b) { return place[b][0] === c; }).sort(function (a, b) { return place[a][1] - place[b][1]; });
        for (var k2 = 1; k2 < col.length; k2++) { above.push([col[k2 - 1], col[k2]]); rel.push(col[k2 - 1] + " above " + col[k2]); }
      }
      function longest(edges, dimIdx) {
        var pos = {}; blocks.forEach(function (b) { pos[b] = null; });
        function comp(b) { if (pos[b] !== null) return pos[b]; pos[b] = 0; var m = 0;
          edges.forEach(function (e) { if (e[1] === b) m = Math.max(m, comp(e[0]) + size[e[0]][dimIdx]); }); pos[b] = m; return m; }
        blocks.forEach(comp); return pos;
      }
      var X = longest(leftOf, 0);
      var belowEdges = above.map(function (e) { return [e[1], e[0]]; });
      var Y = longest(belowEdges, 1);
      return { place: place, X: X, Y: Y, rel: rel };
    }
    var base = solve(basePlace), moved = solve(swapPlace);
    /* grid drawing geometry */
    var GX = 0.9, GY = 1.0, GC = 1.5; /* room cell size */
    function gcx(c) { return (GX + c * GC + GC / 2) * CS; }
    function gcy(r) { return (GY + r * GC + GC / 2) * CS; }
    function bg(ctx) { ctx.fillStyle = "#fdfdfd"; ctx.fillRect(0, 0, 17 * CS, H * CS); }
    function gridAt(ctx, place, ox, oy, cell, hl, showEmpty) {
      ctx.save(); ctx.strokeStyle = "#c9c6bc"; ctx.lineWidth = 1.5;
      for (var i = 0; i <= N; i++) {
        ctx.beginPath(); ctx.moveTo((ox + i * cell) * CS, oy * CS); ctx.lineTo((ox + i * cell) * CS, (oy + N * cell) * CS); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ox * CS, (oy + i * cell) * CS); ctx.lineTo((ox + N * cell) * CS, (oy + i * cell) * CS); ctx.stroke();
      }
      ctx.restore();
      Object.keys(place).forEach(function (b) {
        var c = place[b][0], r = place[b][1];
        var x = (ox + c * cell) * CS, y = (oy + r * cell) * CS, s = cell * CS;
        var on = hl && hl.indexOf(b) >= 0;
        ctx.fillStyle = colorOf[b]; ctx.globalAlpha = on ? 0.85 : 0.5;
        ctx.fillRect(x + 4, y + 4, s - 8, s - 8); ctx.globalAlpha = 1;
        ctx.strokeStyle = on ? RED : INK; ctx.lineWidth = on ? 3 : 2;
        ctx.strokeRect(x + 4, y + 4, s - 8, s - 8);
        ctx.fillStyle = "#fff"; ctx.font = "bold 13px 'JetBrains Mono', monospace";
        ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(b, x + s / 2, y + s / 2 + 0.5); ctx.textBaseline = "alphabetic";
      });
      if (showEmpty) for (var cc = 0; cc < N; cc++) for (var rr = 0; rr < N; rr++) {
        var taken = Object.keys(place).some(function (b) { return place[b][0] === cc && place[b][1] === rr; });
        if (!taken) { ctx.fillStyle = "#d5d3ca"; ctx.font = "9px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.fillText("empty", (ox + cc * cell + cell / 2) * CS, (oy + rr * cell + cell / 2) * CS + 3); }
      }
    }
    function grid(ctx, place, hl) { gridAt(ctx, place, GX, GY, GC, hl, !hl); }
    /* packed floorplan */
    var FOX = 0.9, FOY = 6.2, FU = 0.9;
    function fx(x) { return (FOX + x * FU) * CS; }
    function fy(y) { return (FOY - y * FU) * CS; }
    function fpAt(ctx, st, ox, oy, u, hl) {
      /* baseline axes */
      ctx.strokeStyle = "#c9c6bc"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ox * CS, oy * CS); ctx.lineTo((ox + 5.2 * u) * CS, oy * CS);
      ctx.moveTo(ox * CS, oy * CS); ctx.lineTo(ox * CS, (oy - 4.6 * u) * CS); ctx.stroke();
      Object.keys(st.place).forEach(function (b) {
        var s = size[b], x = (ox + st.X[b] * u) * CS, y = (oy - (st.Y[b] + s[1]) * u) * CS;
        var on = hl && hl.indexOf(b) >= 0;
        ctx.fillStyle = colorOf[b]; ctx.globalAlpha = on ? 0.85 : 0.45;
        ctx.fillRect(x + 2, y + 2, s[0] * u * CS - 4, s[1] * u * CS - 4); ctx.globalAlpha = 1;
        ctx.strokeStyle = on ? RED : INK; ctx.lineWidth = on ? 3 : 2; ctx.strokeRect(x + 2, y + 2, s[0] * u * CS - 4, s[1] * u * CS - 4);
        ctx.fillStyle = "#fff"; ctx.font = "bold 12px 'JetBrains Mono', monospace";
        ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(b, x + s[0] * u * CS / 2, y + s[1] * u * CS / 2 + 0.5); ctx.textBaseline = "alphabetic";
      });
    }
    function floorplan(ctx, st, hl) { fpAt(ctx, st, FOX, FOY, FU, hl); }
    function arrow(ctx, x0, y0, x1, y1) {
      ctx.strokeStyle = "#374151"; ctx.fillStyle = "#374151"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      var a = Math.atan2(y1 - y0, x1 - x0);
      ctx.beginPath(); ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - 9 * Math.cos(a - 0.4), y1 - 9 * Math.sin(a - 0.4));
      ctx.lineTo(x1 - 9 * Math.cos(a + 0.4), y1 - 9 * Math.sin(a + 0.4));
      ctx.closePath(); ctx.fill();
    }
    function label(ctx, x, y, txt, col) {
      ctx.fillStyle = col || MUT; ctx.font = "bold 11px 'JetBrains Mono', monospace"; ctx.textAlign = "center";
      ctx.fillText(txt, x, y);
    }
    function panel(ctx, lines) {
      var QX = 9.6;
      ctx.textAlign = "left";
      lines.forEach(function (l, k) {
        ctx.fillStyle = k === 0 ? INK : (l.charAt(0) === "!" ? RED : (l.charAt(0) === "+" ? GREEN_DEEP : MUT));
        ctx.font = (k === 0 ? "bold " : "") + "12px 'JetBrains Mono', monospace";
        ctx.fillText(l.replace(/^[!+]/, ""), QX * CS, 24 + k * 19);
      });
    }
    return { frames: [
      {
        paint: function (ctx) { bg(ctx); grid(ctx, {}, null);
          panel(ctx, ["the grid", "an n x n grid of ROOMS", "  (here 3 x 3)", "separated by horizontal",
                      "  and vertical slicelines", "", "n blocks go into n", "  distinct rooms; the", "  rest stay empty"]); },
        cap: "The Bounded-Sliceline Grid abstracts the die into an n x n " +
             "grid of rooms, separated by horizontal and vertical " +
             "sliceline segments. Blocks will be assigned to rooms, one " +
             "block per room, with the rest left empty.",
      },
      {
        paint: function (ctx) { bg(ctx); grid(ctx, basePlace, null);
          panel(ctx, ["assign blocks to rooms", "A -> (col 0, row 0)", "B -> (col 2, row 0)", "C -> (col 0, row 2)",
                      "D -> (col 2, row 2)", "", "empty rooms are fine:", "  they carry no block", "  and collapse later"]); },
        cap: "Four blocks are assigned to distinct rooms (A, B, C, D). " +
             "The other rooms stay empty. The grid records only which " +
             "room each block is in, not any coordinate yet.",
      },
      {
        paint: function (ctx) { bg(ctx); grid(ctx, basePlace, null);
          /* draw relation arrows on the grid */
          ctx.strokeStyle = GREEN_DEEP; ctx.lineWidth = 2;
          base.rel.forEach(function () {});
          panel(ctx, ["read the relations"].concat(base.rel.map(function (r) { return "+" + r; }))
            .concat(["", "room to the east", "  -> left-of relation", "room to the south", "  -> above relation"])); },
        cap: "Room adjacencies define the relations. A block whose room " +
             "is west of another's is left of it; a block whose room is " +
             "north of another's is above it. Reading the grid gives: " +
             base.rel.join(", ") + ".",
      },
      {
        paint: function (ctx) { bg(ctx); floorplan(ctx, base, null);
          ctx.strokeStyle = "#c9c6bc"; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(fx(0), fy(0)); ctx.lineTo(fx(6), fy(0)); ctx.moveTo(fx(0), fy(0)); ctx.lineTo(fx(0), fy(5)); ctx.stroke();
          panel(ctx, ["decode = pack", "longest path on the", "  left-of graph -> x", "longest path on the",
                      "  above graph -> y", "", "+rooms are ELASTIC:", "  they stretch to fit", "  the block, empty rooms", "  collapse to zero"]); },
        cap: "Decoding runs longest-path on the two constraint graphs, " +
             "exactly as for the sequence pair, giving each block a " +
             "coordinate. The slicelines are elastic: each room stretches " +
             "to fit its block and empty rooms collapse, so the grid " +
             "encodes topology and the packing supplies geometry.",
      },
      {
        paint: function (ctx) { bg(ctx);
          label(ctx, 2.15 * CS, 1.1 * CS, "BEFORE", MUT);
          gridAt(ctx, basePlace, 0.8, 1.6, 0.9, ["B", "C"], false);
          arrow(ctx, 3.75 * CS, 3.15 * CS, 4.85 * CS, 3.15 * CS);
          label(ctx, 4.3 * CS, 2.85 * CS, "swap", "#374151");
          label(ctx, 6.85 * CS, 1.1 * CS, "AFTER", MUT);
          gridAt(ctx, swapPlace, 5.5, 1.6, 0.9, ["B", "C"], false);
          panel(ctx, ["a move: swap 2 rooms", "before: B top-right,", "  C bottom-left", "after:  B bottom-left,",
                      "  C top-right", "", "+only B and C move;", "  every other room and", "  relation is untouched"]); },
        cap: "A move swaps two blocks' rooms. Before (left): B is in the " +
             "top-right room, C in the bottom-left. After (right): they " +
             "have exchanged rooms. Only B and C move; every other room " +
             "and relation is untouched, which is why an incremental " +
             "evaluator can update the cost cheaply.",
      },
      {
        paint: function (ctx) { bg(ctx);
          label(ctx, 2.0 * CS, 1.1 * CS, "BEFORE", MUT);
          fpAt(ctx, base, 0.8, 5.4, 0.62, ["B", "C"]);
          arrow(ctx, 3.9 * CS, 3.3 * CS, 5.0 * CS, 3.3 * CS);
          label(ctx, 4.45 * CS, 3.0 * CS, "decode", "#374151");
          label(ctx, 6.9 * CS, 1.1 * CS, "AFTER", MUT);
          fpAt(ctx, moved, 5.5, 5.4, 0.62, ["B", "C"]);
          panel(ctx, ["decoded: before / after", "the two floorplans", "  differ only in B and C", "  (red), which trade",
                      "  places", "", "!trade-off: n x n rooms", "  for n blocks carry much", "  emptiness; grid size is", "  a tuning knob"]); },
        cap: "Decoding both grids side by side: the only difference is " +
             "that B and C (red) have traded places; the rest of the " +
             "floorplan is identical. The BSG is complete given a large " +
             "enough grid and its local moves are a real advantage, but " +
             "its n x n rooms for n blocks carry much emptiness, and the " +
             "grid size becomes a tuning knob, which is why the sequence " +
             "pair, with no empty rooms, overshadowed it.",
      },
    ], w: 16, speed: 2300 };
  };

  /* ----- O-tree: left-edge abutment tree + contour decode ----- */
  BUILD["otree-fp"] = function () {
    var size = { A: [3, 2], B: [2, 2], C: [2, 1], D: [3, 2] };
    var colorOf = { A: GREEN, B: BLUE, C: AMBER, D: PURPLE };
    /* ordered O-tree: children lists (root = die wall) */
    var children = { root: ["A", "D"], A: ["B", "C"], B: [], C: [], D: [] };
    var W = { root: 0 };
    Object.keys(size).forEach(function (b) { W[b] = size[b][0]; });
    /* pre-order (DFS) placement order */
    var order = [];
    (function dfs(n) { children[n].forEach(function (c) { order.push(c); dfs(c); }); })("root");
    /* decode: x = parent right edge; y = contour height over [x, x+w] */
    var parent = { root: null };
    Object.keys(children).forEach(function (p) { children[p].forEach(function (c) { parent[c] = p; }); });
    var pos = {}; /* block -> {x,y} */
    var contours = {}; /* after placing each block, snapshot skyline as segments */
    var placed = [];
    function contourHeight(x0, x1) {
      var h = 0;
      placed.forEach(function (b) {
        var bx0 = pos[b].x, bx1 = pos[b].x + size[b][0];
        if (bx0 < x1 - 1e-6 && bx1 > x0 + 1e-6) h = Math.max(h, pos[b].y + size[b][1]);
      });
      return h;
    }
    order.forEach(function (b) {
      var x = (parent[b] === "root") ? 0 : pos[parent[b]].x + W[parent[b]];
      var y = contourHeight(x, x + size[b][0]);
      pos[b] = { x: x, y: y }; placed.push(b);
      /* snapshot skyline: sample the contour across width */
      var seg = [];
      for (var sx = 0; sx <= 6; sx += 0.5) seg.push([sx, contourHeight(sx, sx + 0.001)]);
      contours[b] = seg;
    });
    var totW = 0, totH = 0;
    order.forEach(function (b) { totW = Math.max(totW, pos[b].x + size[b][0]); totH = Math.max(totH, pos[b].y + size[b][1]); });
    /* geometry */
    var OX = 0.8, OY = 5.6, U = 1.15;
    function fx(x) { return (OX + x * U) * CS; }
    function fy(y) { return (OY - y * U) * CS; }
    function bg(ctx) { ctx.fillStyle = "#fdfdfd"; ctx.fillRect(0, 0, 17 * CS, H * CS); }
    function axes(ctx) {
      ctx.strokeStyle = "#c9c6bc"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(fx(0), fy(0)); ctx.lineTo(fx(6), fy(0)); ctx.moveTo(fx(0), fy(0)); ctx.lineTo(fx(0), fy(4.6)); ctx.stroke();
    }
    function block(ctx, b, upto, hl) {
      var s = size[b], x = fx(pos[b].x), y = fy(pos[b].y + s[1]);
      var on = hl && hl.indexOf(b) >= 0;
      ctx.fillStyle = colorOf[b]; ctx.globalAlpha = on ? 0.8 : 0.45;
      ctx.fillRect(x + 2, y + 2, s[0] * U * CS - 4, s[1] * U * CS - 4); ctx.globalAlpha = 1;
      ctx.strokeStyle = on ? RED : INK; ctx.lineWidth = on ? 3 : 2; ctx.strokeRect(x + 2, y + 2, s[0] * U * CS - 4, s[1] * U * CS - 4);
      ctx.fillStyle = "#fff"; ctx.font = "bold 15px 'JetBrains Mono', monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(b, x + s[0] * U * CS / 2, y + s[1] * U * CS / 2 + 0.5); ctx.textBaseline = "alphabetic";
    }
    function floorplan(ctx, upto, hl) {
      axes(ctx);
      var n = upto === undefined ? order.length : upto;
      for (var i = 0; i < n; i++) block(ctx, order[i], n, hl);
    }
    function contourLine(ctx, seg) {
      ctx.strokeStyle = RED; ctx.lineWidth = 2.5; ctx.beginPath();
      seg.forEach(function (p, i) {
        var X = fx(p[0]), Yv = fy(p[1]);
        if (i === 0) ctx.moveTo(X, Yv); else { ctx.lineTo(fx(p[0]), fy(seg[i - 1][1])); ctx.lineTo(X, Yv); }
      });
      ctx.stroke();
    }
    /* the tree drawing (nodes) */
    var tnodes = { root: [3, 0.9], A: [1.6, 2.4], D: [4.6, 2.4], B: [0.9, 4.0], C: [2.4, 4.0] };
    function tx(n) { return tnodes[n][0] * CS; }
    function ty(n) { return tnodes[n][1] * CS; }
    function tree(ctx, hl) {
      Object.keys(children).forEach(function (p) {
        children[p].forEach(function (c) {
          ctx.strokeStyle = "rgba(26,29,38,0.4)"; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(tx(p), ty(p)); ctx.lineTo(tx(c), ty(c)); ctx.stroke();
        });
      });
      Object.keys(tnodes).forEach(function (n) {
        var isRoot = n === "root", on = hl && hl.indexOf(n) >= 0;
        if (isRoot) {
          ctx.fillStyle = "#374151"; ctx.fillRect(tx(n) - 26, ty(n) - 12, 52, 24);
          ctx.fillStyle = "#fff"; ctx.font = "bold 10px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText("wall", tx(n), ty(n) + 0.5); ctx.textBaseline = "alphabetic";
        } else {
          ctx.beginPath(); ctx.arc(tx(n), ty(n), 15, 0, Math.PI * 2);
          ctx.fillStyle = colorOf[n]; ctx.fill(); ctx.strokeStyle = on ? RED : "#fff"; ctx.lineWidth = on ? 3 : 2; ctx.stroke();
          ctx.fillStyle = "#fff"; ctx.font = "bold 13px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(n, tx(n), ty(n) + 0.5); ctx.textBaseline = "alphabetic";
        }
      });
    }
    /* parameterized floorplan (own transform), with optional leaning arrows */
    function fpAt(ctx, ox, oy, u, arrows, hl) {
      function ax(x) { return (ox + x * u) * CS; }
      function ay(y) { return (oy - y * u) * CS; }
      ctx.strokeStyle = "#c9c6bc"; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(ax(0), ay(0)); ctx.lineTo(ax(totW + 0.3), ay(0)); ctx.moveTo(ax(0), ay(0)); ctx.lineTo(ax(0), ay(totH + 0.3)); ctx.stroke();
      order.forEach(function (b) {
        var s = size[b], x = ax(pos[b].x), y = ay(pos[b].y + s[1]), on = hl && hl.indexOf(b) >= 0;
        ctx.fillStyle = colorOf[b]; ctx.globalAlpha = on ? 0.8 : 0.45;
        ctx.fillRect(x + 2, y + 2, s[0] * u * CS - 4, s[1] * u * CS - 4); ctx.globalAlpha = 1;
        ctx.strokeStyle = on ? RED : INK; ctx.lineWidth = on ? 3 : 2; ctx.strokeRect(x + 2, y + 2, s[0] * u * CS - 4, s[1] * u * CS - 4);
        ctx.fillStyle = "#fff"; ctx.font = "bold 13px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(b, x + s[0] * u * CS / 2, y + s[1] * u * CS / 2 + 0.5); ctx.textBaseline = "alphabetic";
      });
      if (arrows) order.forEach(function (b) {
        var lx = ax(pos[b].x), ly = ay(pos[b].y + size[b][1] / 2);
        ctx.strokeStyle = GREEN_DEEP; ctx.fillStyle = GREEN_DEEP; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx - 12, ly); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(lx - 12, ly); ctx.lineTo(lx - 7, ly - 4); ctx.lineTo(lx - 7, ly + 4); ctx.closePath(); ctx.fill();
      });
    }
    /* parameterized tree drawer */
    function treeAt(ctx, ox, oy, sc, hl) {
      function nx(n) { return (ox + tnodes[n][0] * sc) * CS; }
      function ny(n) { return (oy + tnodes[n][1] * sc) * CS; }
      Object.keys(children).forEach(function (p) {
        children[p].forEach(function (c) {
          ctx.strokeStyle = "rgba(26,29,38,0.4)"; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(nx(p), ny(p)); ctx.lineTo(nx(c), ny(c)); ctx.stroke();
        });
      });
      Object.keys(tnodes).forEach(function (n) {
        var isRoot = n === "root", on = hl && hl.indexOf(n) >= 0;
        if (isRoot) {
          ctx.fillStyle = "#374151"; ctx.fillRect(nx(n) - 22, ny(n) - 11, 44, 22);
          ctx.fillStyle = "#fff"; ctx.font = "bold 9px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText("wall", nx(n), ny(n) + 0.5); ctx.textBaseline = "alphabetic";
        } else {
          ctx.beginPath(); ctx.arc(nx(n), ny(n), 13, 0, Math.PI * 2);
          ctx.fillStyle = colorOf[n]; ctx.fill(); ctx.strokeStyle = on ? RED : "#fff"; ctx.lineWidth = on ? 3 : 2; ctx.stroke();
          ctx.fillStyle = "#fff"; ctx.font = "bold 12px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(n, nx(n), ny(n) + 0.5); ctx.textBaseline = "alphabetic";
        }
      });
    }
    function label2(ctx, x, y, txt, col) { ctx.fillStyle = col || MUT; ctx.font = "bold 11px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.fillText(txt, x, y); }
    function panel(ctx, lines) {
      var QX = 10.2;
      ctx.textAlign = "left";
      lines.forEach(function (l, k) {
        ctx.fillStyle = k === 0 ? INK : (l.charAt(0) === "!" ? RED : (l.charAt(0) === "+" ? GREEN_DEEP : MUT));
        ctx.font = (k === 0 ? "bold " : "") + "12px 'JetBrains Mono', monospace";
        ctx.fillText(l.replace(/^[!+]/, ""), QX * CS, 24 + k * 19);
      });
    }
    return { frames: [
      {
        paint: function (ctx) { bg(ctx); floorplan(ctx);
          /* slide arrows */
          ctx.strokeStyle = "#b45309"; ctx.lineWidth = 1.5;
          panel(ctx, ["admissible packing", "the blocks are pushed", "  to the lower-left", "", "no block can slide",
                      "  further left or down", "", "+every good floorplan is", "  admissible: anything", "  else wastes area"]); },
        cap: "Start from an admissible packing: every block is pushed as " +
             "far left and down as it can go, so nothing can slide " +
             "further. Every good floorplan is admissible, because slack " +
             "on the left or bottom is wasted area.",
      },
      {
        paint: function (ctx) { bg(ctx);
          label2(ctx, 1.9 * CS, 1.2 * CS, "the packing", MUT);
          fpAt(ctx, 0.7, 4.9, 0.72, true, null);
          /* the equivalence link */
          ctx.strokeStyle = "#374151"; ctx.fillStyle = "#374151"; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(4.7 * CS, 3.0 * CS); ctx.lineTo(5.7 * CS, 3.0 * CS); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(5.7 * CS, 3.0 * CS); ctx.lineTo(5.3 * CS, 2.7 * CS); ctx.lineTo(5.3 * CS, 3.3 * CS); ctx.closePath(); ctx.fill();
          label2(ctx, 5.2 * CS, 2.4 * CS, "is", "#374151");
          label2(ctx, 7.6 * CS, 1.2 * CS, "the O-tree", MUT);
          treeAt(ctx, 5.8, 1.5, 0.78, null);
          panel(ctx, ["left-edge abutment", "each block's LEFT edge", "  leans on something", "  (green arrows)", "",
                      "+the leaning relation", "  IS the tree on the", "  right: wall = root,", "  parent = the block you", "  lean on"]); },
        cap: "The packing (left) and the O-tree (right) are the same " +
             "thing. In an admissible packing every block's left edge " +
             "leans on another block's right edge or the die wall (green " +
             "arrows). Turn each leaning relation into a parent link and " +
             "you get the tree: the wall is the root, and each block's " +
             "parent is the block it abuts on the left.",
      },
      {
        paint: function (ctx) { bg(ctx); tree(ctx, null);
          ctx.fillStyle = INK; ctx.font = "12px 'JetBrains Mono', monospace"; ctx.textAlign = "left";
          ctx.fillText("bracket seq: ( ( ) ( ) ) ( )", 0.8 * CS, 5.6 * CS);
          ctx.fillText("permutation: " + order.join(" "), 0.8 * CS, 6.2 * CS);
          panel(ctx, ["the O-tree", "the leaning tree, drawn", "  as an ordered tree", "", "encode it in 2n bits:",
                      "  the tree SHAPE as a", "  bracket sequence", "  + the block order", "", "+n(2 + log n) bits: the", "  smallest classic", "  encoding"]); },
        cap: "The O-tree records that ordered tree. Its shape encodes in " +
             "2n bits as a bracket sequence (descend = open, ascend = " +
             "close), plus the block permutation in DFS order, " +
             order.join(" ") + ". At n(2 + log n) bits it is the " +
             "smallest of the classic representations.",
      },
      {
        paint: function (ctx) { bg(ctx); floorplan(ctx, 1);
          contourLine(ctx, contours[order[0]]);
          panel(ctx, ["decode: DFS + contour", "walk the tree depth-first", "", "place " + order[0] + ": x = parent's",
                      "  right edge (wall -> 0)", "  y = 0 (floor)", "", "the red line is the", "  CONTOUR: the skyline", "  of what is placed"]); },
        cap: "Decoding walks the tree depth-first. The first block, " +
             order[0] + ", leans on the wall so its x is 0 and it drops " +
             "to the floor. The red line is the contour, the skyline of " +
             "everything placed so far, which the next block will rest " +
             "on.",
      },
      {
        paint: function (ctx) { bg(ctx); floorplan(ctx, 3, [order[2]]);
          contourLine(ctx, contours[order[2]]);
          panel(ctx, ["place " + order[1] + ", then " + order[2], order[1] + ": x = " + order[0] + "'s right edge,", "  drops to the floor",
                      order[2] + " (red): same x, but", "  the contour is higher", "  now, so it rests ON " + order[1], "",
                      "+each block PUSHED DOWN", "  onto the contour"]); },
        cap: "Continuing the DFS: " + order[1] + " is a child of " +
             order[0] + ", so its x is " + order[0] + "'s right edge, and " +
             "it drops to the floor. " + order[2] + " (red) is the next " +
             "child at the same x, but the contour there is now higher, " +
             "so it rests on top of " + order[1] + ". Each block is " +
             "pushed down until it hits the contour.",
      },
      {
        paint: function (ctx) { bg(ctx); floorplan(ctx, 4, [order[3]]);
          contourLine(ctx, contours[order[3]]);
          panel(ctx, ["place " + order[3] + ": done", order[3] + " leans on the wall", "  (x = 0), but the contour",
                      "  over its width is high,", "  so it sits above " + order[0], "", "+contour keeps decode", "  at amortized O(1)/block:",
                      "  linear total", "size " + totW + " x " + totH]); },
        cap: "The last block " + order[3] + " leans on the wall again " +
             "(x = 0), but the contour over its width is already high, so " +
             "it sits above " + order[0] + ". Maintaining the contour " +
             "makes each placement amortized constant time, so the whole " +
             "decode is linear, the O-tree's headline property. Final " +
             "size " + totW + " x " + totH + ".",
      },
    ], w: 17, speed: 2400 };
  };

  /* ----- B*-tree: binary tree, two child rules + contour decode ----- */
  BUILD["bstar-fp"] = function () {
    var size = { A: [2, 2], B: [2, 3], C: [3, 1], D: [2, 2], E: [2, 1] };
    var colorOf = { A: GREEN, B: BLUE, C: AMBER, D: PURPLE, E: "#0891b2" };
    /* binary tree: left child = right neighbor, right child = above, same x */
    var leftChild = { A: "B", B: "D" };
    var rightChild = { A: "C", B: "E" };
    var root = "A";
    var LEFTCOL = GREEN_DEEP, RIGHTCOL = "#b45309";
    /* pre-order traversal order + parent / child-type maps */
    var order = [], parent = {}, ctype = {};
    (function dfs(n) {
      order.push(n);
      if (leftChild[n]) { parent[leftChild[n]] = n; ctype[leftChild[n]] = "L"; dfs(leftChild[n]); }
      if (rightChild[n]) { parent[rightChild[n]] = n; ctype[rightChild[n]] = "R"; dfs(rightChild[n]); }
    })(root);
    /* decode: x from child rule, y = contour height over [x, x+w] */
    var pos = {}, contours = {}, placed = [];
    function contourHeight(x0, x1) {
      var h = 0;
      placed.forEach(function (b) {
        var bx0 = pos[b].x, bx1 = pos[b].x + size[b][0];
        if (bx0 < x1 - 1e-6 && bx1 > x0 + 1e-6) h = Math.max(h, pos[b].y + size[b][1]);
      });
      return h;
    }
    order.forEach(function (b) {
      var x;
      if (b === root) x = 0;
      else if (ctype[b] === "L") x = pos[parent[b]].x + size[parent[b]][0];
      else x = pos[parent[b]].x;
      var y = contourHeight(x, x + size[b][0]);
      pos[b] = { x: x, y: y }; placed.push(b);
      var seg = [];
      for (var sx = 0; sx <= 6; sx += 0.5) seg.push([sx, contourHeight(sx, sx + 0.001)]);
      contours[b] = seg;
    });
    var totW = 0, totH = 0;
    order.forEach(function (b) { totW = Math.max(totW, pos[b].x + size[b][0]); totH = Math.max(totH, pos[b].y + size[b][1]); });
    /* geometry */
    var OX = 0.8, OY = 6.0, U = 1.1;
    function fx(x) { return (OX + x * U) * CS; }
    function fy(y) { return (OY - y * U) * CS; }
    function bg(ctx) { ctx.fillStyle = "#fdfdfd"; ctx.fillRect(0, 0, 17 * CS, H * CS); }
    function axes(ctx) {
      ctx.strokeStyle = "#c9c6bc"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(fx(0), fy(0)); ctx.lineTo(fx(6.4), fy(0)); ctx.moveTo(fx(0), fy(0)); ctx.lineTo(fx(0), fy(5.4)); ctx.stroke();
    }
    function block(ctx, b, hl) {
      var s = size[b], x = fx(pos[b].x), y = fy(pos[b].y + s[1]);
      var on = hl && hl.indexOf(b) >= 0;
      ctx.fillStyle = colorOf[b]; ctx.globalAlpha = on ? 0.8 : 0.45;
      ctx.fillRect(x + 2, y + 2, s[0] * U * CS - 4, s[1] * U * CS - 4); ctx.globalAlpha = 1;
      ctx.strokeStyle = on ? RED : INK; ctx.lineWidth = on ? 3 : 2; ctx.strokeRect(x + 2, y + 2, s[0] * U * CS - 4, s[1] * U * CS - 4);
      ctx.fillStyle = "#fff"; ctx.font = "bold 15px 'JetBrains Mono', monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(b, x + s[0] * U * CS / 2, y + s[1] * U * CS / 2 + 0.5); ctx.textBaseline = "alphabetic";
    }
    function floorplan(ctx, upto, hl) {
      axes(ctx);
      var n = upto === undefined ? order.length : upto;
      for (var i = 0; i < n; i++) block(ctx, order[i], hl);
    }
    function contourLine(ctx, seg) {
      ctx.strokeStyle = RED; ctx.lineWidth = 2.5; ctx.beginPath();
      seg.forEach(function (p, i) {
        var X = fx(p[0]), Yv = fy(p[1]);
        if (i === 0) ctx.moveTo(X, Yv); else { ctx.lineTo(fx(p[0]), fy(seg[i - 1][1])); ctx.lineTo(X, Yv); }
      });
      ctx.stroke();
    }
    /* binary-tree node coordinates (canvas units) */
    var tnodes = { A: [3.0, 0.9], B: [1.8, 2.5], C: [4.5, 2.5], D: [1.0, 4.1], E: [2.7, 4.1] };
    function drawTree(ctx, ox, oy, sc, hl) {
      function nx(n) { return (ox + tnodes[n][0] * sc) * CS; }
      function ny(n) { return (oy + tnodes[n][1] * sc) * CS; }
      function edge(p, c, col) {
        ctx.strokeStyle = col; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(nx(p), ny(p)); ctx.lineTo(nx(c), ny(c)); ctx.stroke();
      }
      Object.keys(leftChild).forEach(function (p) { edge(p, leftChild[p], LEFTCOL); });
      Object.keys(rightChild).forEach(function (p) { edge(p, rightChild[p], RIGHTCOL); });
      Object.keys(tnodes).forEach(function (n) {
        var on = hl && hl.indexOf(n) >= 0, r = 14 * sc / 1;
        ctx.beginPath(); ctx.arc(nx(n), ny(n), 14, 0, Math.PI * 2);
        ctx.fillStyle = colorOf[n]; ctx.fill(); ctx.strokeStyle = on ? RED : "#fff"; ctx.lineWidth = on ? 3 : 2; ctx.stroke();
        ctx.fillStyle = "#fff"; ctx.font = "bold 13px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(n, nx(n), ny(n) + 0.5); ctx.textBaseline = "alphabetic";
      });
    }
    /* parameterized placement (own transform) */
    function fpAt(ctx, ox, oy, u, hl) {
      function ax(x) { return (ox + x * u) * CS; }
      function ay(y) { return (oy - y * u) * CS; }
      ctx.strokeStyle = "#c9c6bc"; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(ax(0), ay(0)); ctx.lineTo(ax(totW + 0.3), ay(0)); ctx.moveTo(ax(0), ay(0)); ctx.lineTo(ax(0), ay(totH + 0.3)); ctx.stroke();
      order.forEach(function (b) {
        var s = size[b], x = ax(pos[b].x), y = ay(pos[b].y + s[1]), on = hl && hl.indexOf(b) >= 0;
        ctx.fillStyle = colorOf[b]; ctx.globalAlpha = on ? 0.8 : 0.45;
        ctx.fillRect(x + 2, y + 2, s[0] * u * CS - 4, s[1] * u * CS - 4); ctx.globalAlpha = 1;
        ctx.strokeStyle = on ? RED : INK; ctx.lineWidth = on ? 3 : 2; ctx.strokeRect(x + 2, y + 2, s[0] * u * CS - 4, s[1] * u * CS - 4);
        ctx.fillStyle = "#fff"; ctx.font = "bold 12px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(b, x + s[0] * u * CS / 2, y + s[1] * u * CS / 2 + 0.5); ctx.textBaseline = "alphabetic";
      });
    }
    function label2(ctx, x, y, txt, col) { ctx.fillStyle = col || MUT; ctx.font = "bold 11px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.fillText(txt, x, y); }
    function panel(ctx, lines) {
      var QX = 10.4;
      ctx.textAlign = "left";
      lines.forEach(function (l, k) {
        ctx.fillStyle = k === 0 ? INK : (l.charAt(0) === "!" ? RED : (l.charAt(0) === "+" ? GREEN_DEEP : MUT));
        ctx.font = (k === 0 ? "bold " : "") + "12px 'JetBrains Mono', monospace";
        ctx.fillText(l.replace(/^[!+]/, ""), QX * CS, 24 + k * 19);
      });
    }
    function legend(ctx, x, y) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = LEFTCOL; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 20, y); ctx.stroke();
      ctx.fillStyle = INK; ctx.font = "11px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText("left child = to the right", x + 26, y);
      ctx.strokeStyle = RIGHTCOL; ctx.beginPath(); ctx.moveTo(x, y + 18); ctx.lineTo(x + 20, y + 18); ctx.stroke();
      ctx.fillText("right child = above, same x", x + 26, y + 18); ctx.textBaseline = "alphabetic";
    }
    return { frames: [
      {
        paint: function (ctx) { bg(ctx); floorplan(ctx);
          panel(ctx, ["a compacted packing", "every block is pushed", "  to the lower-left", "", "the B*-tree encodes",
                      "  THIS as a binary tree", "", "+root = the bottom-left", "  block (no wall node,", "  unlike the O-tree)"]); },
        cap: "Start from a compacted packing: every block pushed as far " +
             "left and down as it goes. The B*-tree encodes it as an " +
             "ordered binary tree whose root is the bottom-left block. " +
             "Unlike the O-tree there is no separate wall node: the tree " +
             "is made of the blocks themselves.",
      },
      {
        paint: function (ctx) { bg(ctx); floorplan(ctx, undefined, ["A"]);
          /* left-child rule: green arrow A -> B (to the right) */
          var ax0 = fx(2), ay0 = fy(1);
          ctx.strokeStyle = LEFTCOL; ctx.fillStyle = LEFTCOL; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.moveTo(ax0, ay0); ctx.lineTo(ax0 + 20, ay0); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(ax0 + 20, ay0); ctx.lineTo(ax0 + 13, ay0 - 5); ctx.lineTo(ax0 + 13, ay0 + 5); ctx.closePath(); ctx.fill();
          label2(ctx, fx(2.9), fy(1) - 14, "left: to the right", LEFTCOL);
          /* right-child rule: amber arrow up from A (same x) to C */
          var bx0 = fx(0.28), by0 = fy(2);
          ctx.strokeStyle = RIGHTCOL; ctx.fillStyle = RIGHTCOL;
          ctx.beginPath(); ctx.moveTo(bx0, by0); ctx.lineTo(bx0, fy(3.9)); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(bx0, fy(3.9)); ctx.lineTo(bx0 - 5, fy(3.9) + 7); ctx.lineTo(bx0 + 5, fy(3.9) + 7); ctx.closePath(); ctx.fill();
          label2(ctx, fx(1.6), fy(3.2), "right: above, same x", RIGHTCOL);
          panel(ctx, ["two child rules", "take block A (root):", "", "+LEFT child B: the block", "  immediately to its",
                      "  right (x = A's right edge)", "", "+RIGHT child C: the block", "  above it at the SAME x", "  (x = A's x)"]); },
        cap: "Two crisp rules define the tree, read off any block. A's " +
             "left child is the block immediately to its right, sharing " +
             "A's right edge (green). A's right child is the block above " +
             "it at the same x-coordinate (amber). Every parent-child " +
             "link in the tree is one of these two relations.",
      },
      {
        paint: function (ctx) { bg(ctx);
          label2(ctx, 2.0 * CS, 1.1 * CS, "the packing", MUT);
          fpAt(ctx, 0.7, 5.1, 0.7, null);
          label2(ctx, 7.4 * CS, 1.1 * CS, "the B*-tree", MUT);
          drawTree(ctx, 4.9, 1.4, 0.8, null);
          legend(ctx, 4.9 * CS, 6.0 * CS);
          panel(ctx, ["packing <-> binary tree", "read every block's two", "  neighbors and you get",
                      "  the whole tree", "", "+preorder A B D E C: the", "  order we will decode in", "", "green = left child (right)",
                      "amber = right child (above)"]); },
        cap: "The packing (left) and its B*-tree (right) are the same " +
             "object. Applying the two rules to every block gives the " +
             "tree: A's left child B and right child C, B's left child D " +
             "and right child E. Green edges are left children (to the " +
             "right), amber edges are right children (above). Preorder is " +
             order.join(" ") + ", the order we decode in.",
      },
      {
        paint: function (ctx) { bg(ctx); floorplan(ctx, 1);
          contourLine(ctx, contours[order[0]]);
          panel(ctx, ["decode: preorder + contour", "walk the tree preorder", "", "place " + order[0] + " (root):",
                      "  x = 0, y = 0", "", "the red line is the", "  CONTOUR: the skyline of", "  everything placed"]); },
        cap: "Decode by preorder traversal. The root " + order[0] +
             " goes to the origin, x = 0 and y = 0. The red line is the " +
             "contour, the skyline of what has been placed, which every " +
             "later block will rest on.",
      },
      {
        paint: function (ctx) { bg(ctx); floorplan(ctx, 3, [order[1], order[2]]);
          contourLine(ctx, contours[order[2]]);
          panel(ctx, ["place " + order[1] + ", then " + order[2] + " (left)", order[1] + ": LEFT child of " + order[0] + ",",
                      "  x = " + order[0] + "'s right edge,", "  drops to the floor", order[2] + ": LEFT child of " + order[1] + ",",
                      "  x = " + order[1] + "'s right edge,", "  drops to the floor", "", "+left child -> x is the", "  parent's RIGHT edge"]); },
        cap: order[1] + " is " + order[0] + "'s left child, so its x is " +
             order[0] + "'s right edge, and it drops to the floor. " +
             order[2] + " is " + order[1] + "'s left child, so its x is " +
             order[1] + "'s right edge. A left child always takes the " +
             "parent's right edge as its x.",
      },
      {
        paint: function (ctx) { bg(ctx); floorplan(ctx, 5, [order[3], order[4]]);
          contourLine(ctx, contours[order[4]]);
          panel(ctx, ["place " + order[3] + ", then " + order[4] + " (right)", order[3] + ": RIGHT child of " + order[1] + ",",
                      "  same x as " + order[1] + ", rests", "  ON the contour (on " + order[1] + ")", order[4] + ": RIGHT child of " + order[0] + ",",
                      "  same x as " + order[0] + " (=0), but", "  contour is high -> sits up", "", "+right child -> same x,",
                      "  y from the contour", "size " + totW + " x " + totH]); },
        cap: order[3] + " is " + order[1] + "'s right child: same x as " +
             order[1] + ", pushed down onto the contour so it rests on " +
             order[1] + ". " + order[4] + " is " + order[0] + "'s right " +
             "child: same x as " + order[0] + " (x = 0), but the contour " +
             "there is already high, so it sits up top. A right child " +
             "keeps the parent's x and takes its height from the " +
             "contour. Final size " + totW + " x " + totH + ", decoded in " +
             "linear time.",
      },
    ], w: 17, speed: 2400 };
  };

  /* ----- Corner Block List: mosaic (non-slicing) floorplan encoding ----- */
  BUILD["cbl-fp"] = function () {
    var colorOf = { A: GREEN, B: BLUE, C: AMBER, D: PURPLE, E: TEAL };
    /* hand-verified insertion snapshots; each room = [x0,x1,y0,y1] on a 3x3 chip.
       insertion order A (base), D (H,t0), E (V,t0), B (V,t1), C (H,t1) */
    var steps = [
      { A: [0,3,0,3] },
      { A: [0,3,0,1], D: [0,3,1,3] },
      { A: [0,3,0,1], D: [0,1,1,3], E: [1,3,1,3] },
      { A: [0,2,0,1], D: [0,1,1,3], E: [1,2,1,3], B: [2,3,0,3] },
      { A: [0,2,0,1], D: [0,1,1,3], E: [1,2,1,2], B: [2,3,0,2], C: [1,3,2,3] },
    ];
    var full = steps[steps.length - 1];
    /* the CBL triple, in insertion order (base A has no orientation / count) */
    var Slist = ["A", "D", "E", "B", "C"];
    var Llabel = { D: "H", E: "V", B: "V", C: "H" };
    var Tcount = { D: 0, E: 0, B: 1, C: 1 };
    /* geometry */
    var OX = 0.9, OY = 5.6, U = 1.55;
    function fx(x) { return (OX + x * U) * CS; }
    function fy(y) { return (OY - y * U) * CS; }
    function bg(ctx) { ctx.fillStyle = "#fdfdfd"; ctx.fillRect(0, 0, 17 * CS, H * CS); }
    function rooms(ctx, snap, hl, dim) {
      Object.keys(snap).forEach(function (b) {
        var r = snap[b], x = fx(r[0]), y = fy(r[3]), w = (r[1] - r[0]) * U * CS, h = (r[3] - r[2]) * U * CS;
        var on = hl && hl.indexOf(b) >= 0;
        ctx.fillStyle = colorOf[b]; ctx.globalAlpha = dim && !on ? 0.22 : (on ? 0.85 : 0.5);
        ctx.fillRect(x + 2, y + 2, w - 4, h - 4); ctx.globalAlpha = 1;
        ctx.strokeStyle = on ? RED : INK; ctx.lineWidth = on ? 3.5 : 2; ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
        ctx.fillStyle = "#fff"; ctx.font = "bold 16px 'JetBrains Mono', monospace";
        ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(b, x + w / 2, y + h / 2 + 0.5); ctx.textBaseline = "alphabetic";
      });
    }
    function tjunction(ctx, x, y) {
      ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(fx(x), fy(y), 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.stroke();
    }
    function label2(ctx, x, y, txt, col) { ctx.fillStyle = col || MUT; ctx.font = "bold 11px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.fillText(txt, x, y); }
    function panel(ctx, lines) {
      var QX = 9.9; ctx.textAlign = "left";
      lines.forEach(function (l, k) {
        ctx.fillStyle = k === 0 ? INK : (l.charAt(0) === "!" ? RED : (l.charAt(0) === "+" ? GREEN_DEEP : MUT));
        ctx.font = (k === 0 ? "bold " : "") + "12px 'JetBrains Mono', monospace";
        ctx.fillText(l.replace(/^[!+]/, ""), QX * CS, 24 + k * 19);
      });
    }
    /* draw the CBL triple as three aligned rows */
    function cblRows(ctx, ox, oy, upto) {
      ctx.textAlign = "left"; ctx.textBaseline = "middle";
      var rows = [["S", Slist.map(function (s) { return s; })],
                  ["L", Slist.map(function (s) { return Llabel[s] || "-"; })],
                  ["T", Slist.map(function (s) { return s in Tcount ? String(Tcount[s]) : "-"; })]];
      rows.forEach(function (row, ri) {
        var y = (oy + ri * 0.7) * CS;
        ctx.fillStyle = INK; ctx.font = "bold 13px 'JetBrains Mono', monospace";
        ctx.fillText(row[0] + ":", ox * CS, y);
        row[1].forEach(function (v, ci) {
          var vis = upto === undefined || ci <= upto;
          ctx.fillStyle = vis ? (ri === 0 ? (colorOf[Slist[ci]] || INK) : MUT) : "#d7d7d2";
          ctx.font = (ri === 0 ? "bold " : "") + "14px 'JetBrains Mono', monospace";
          ctx.fillText(v, (ox + 0.9 + ci * 0.62) * CS, y);
        });
      });
      ctx.textBaseline = "alphabetic";
    }
    return { frames: [
      {
        paint: function (ctx) { bg(ctx); rooms(ctx, full, null, false);
          panel(ctx, ["a mosaic floorplan", "rooms tile the chip with", "  no empty space, one", "  block per room", "",
                      "every junction is a T,", "  never a + crossing", "", "+this is the pinwheel: NO", "  straight cut crosses it,",
                      "  so no slicing tree can", "  describe it"]); },
        cap: "A mosaic floorplan dissects the chip into rooms that tile " +
             "it with no wasted space, one block per room, and every " +
             "internal junction is a T rather than a crossing. This is " +
             "the pinwheel, the canonical non-slicing floorplan: no " +
             "single cut runs all the way across, so no slicing tree can " +
             "represent it. That is the gap the corner block list fills.",
      },
      {
        paint: function (ctx) { bg(ctx); rooms(ctx, full, ["C"], false);
          tjunction(ctx, 2, 2);
          label2(ctx, fx(2) + 30, fy(2) - 10, "covered T", RED);
          panel(ctx, ["the corner block", "the block at the TOP-RIGHT", "  corner is the handle we", "  encode from: here, C", "",
                      "C is HORIZONTAL (spans the", "  top); its bottom edge", "  covers 1 T-junction (red),", "  the tuck between E and B", "",
                      "+record: name C, orient H,", "  T-count 1"]); },
        cap: "Encoding reads the block at the top-right corner, here C. " +
             "C is horizontal: it spans the top, and its bottom edge sits " +
             "across one T-junction, the join between E and B (red). " +
             "Removing C and repeating down to a single block records " +
             "three things per block: its name, its orientation (H or V), " +
             "and how many T-junctions its edge covers.",
      },
      {
        paint: function (ctx) { bg(ctx); rooms(ctx, full, null, false);
          cblRows(ctx, 0.9, 7.0, undefined);
          panel(ctx, ["three lists (S, L, T)", "S: block names, in the", "  order they are inserted", "L: orientation of each,",
                      "  H = on top, V = on right", "T: T-junctions each block", "  covers, as a count", "",
                      "+A is the base block, so it", "  has no L or T entry"]); },
        cap: "The corner block list is three aligned lists. S is the " +
             "block names in insertion order, A D E B C. L is each " +
             "block's orientation, H if it enters along the top or V " +
             "along the right. T is how many T-junctions each block " +
             "covers. A is the base block, so it carries no orientation " +
             "or count. Decoding replays these to rebuild the floorplan.",
      },
      {
        paint: function (ctx) { bg(ctx); rooms(ctx, steps[0], ["A"], false);
          cblRows(ctx, 0.9, 7.0, 0);
          panel(ctx, ["rebuild: back to one block", "the demolition ended with", "  a single block, A: the", "  base of list S", "",
                      "now REPLAY (S, L, T) left", "  to right to grow the", "  floorplan back", "", "+start: A fills the whole", "  chip"]); },
        cap: "Rebuilding runs the demolition in reverse. Peeling off " +
             "corner blocks ended with one block, A, which is the base of " +
             "list S and now fills the whole chip. From here we replay " +
             "the three lists left to right, inserting one block per step.",
      },
      {
        paint: function (ctx) { bg(ctx); rooms(ctx, steps[1], ["D"], false);
          cblRows(ctx, 0.9, 7.0, 1);
          panel(ctx, ["insert D (H, T=0)", "next in S is D; its L bit", "  is H, its T count is 0", "", "+H means D enters along the",
                      "  TOP of the chip", "+T=0 means it covers no", "  T-junction: a clean cut", "", "A drops to the bottom, D", "  takes the top"]); },
        cap: "The next name in S is D, with orientation H and T = 0. H " +
             "means D enters along the top of the chip. T = 0 means it " +
             "covers no T-junction, so it is a clean split: A drops to " +
             "the bottom and D takes the top.",
      },
      {
        paint: function (ctx) { bg(ctx); rooms(ctx, steps[2], ["E"], false);
          cblRows(ctx, 0.9, 7.0, 2);
          panel(ctx, ["insert E (V, T=0)", "next is E; L bit V, T", "  count 0", "", "+V means E enters along the",
                      "  RIGHT of the chip", "+T=0 again: a clean cut,", "  splitting the top block D", "", "still slicing so far: no",
                      "  T-junction covered yet"]); },
        cap: "Next is E, orientation V and T = 0. V means E enters along " +
             "the right of the chip, and T = 0 makes it another clean " +
             "cut, splitting the top block D. So far every insertion has " +
             "covered zero T-junctions, so the layout is still sliceable.",
      },
      {
        paint: function (ctx) { bg(ctx); rooms(ctx, steps[3], ["B"], false);
          tjunction(ctx, 2, 1);
          cblRows(ctx, 0.9, 7.0, 3);
          panel(ctx, ["insert B (V, T=1)", "next is B; L bit V, T", "  count 1", "", "+V: B enters along the RIGHT",
                      "+T=1: B's left edge crosses", "  the 1 T-junction (red),", "  spanning A and E as one", "  full-height slab", "",
                      "this is where NON-slicing", "  structure first appears"]); },
        cap: "Next is B, orientation V and T = 1. V puts it on the right, " +
             "and T = 1 means its left edge crosses one T-junction (red), " +
             "straddling both A and E as a single full-height slab. A " +
             "T-count above zero is exactly where non-slicing structure " +
             "first appears: a block spanning more than one neighbor.",
      },
      {
        paint: function (ctx) { bg(ctx); rooms(ctx, steps[4], ["C"], false);
          tjunction(ctx, 2, 2);
          cblRows(ctx, 0.9, 7.0, 4);
          panel(ctx, ["insert C (H, T=1): done", "last is C; L bit H, T", "  count 1", "", "+H: C enters along the TOP",
                      "+T=1: its bottom edge crosses", "  the T-junction between E", "  and B (red)", "",
                      "+the pinwheel is rebuilt", "  exactly from (S, L, T)"]); },
        cap: "The last name is C, orientation H and T = 1. H puts it on " +
             "top, and T = 1 means its bottom edge crosses the T-junction " +
             "between E and B (red). The pinwheel is now rebuilt exactly " +
             "from the three lists, and both encoding and decoding run in " +
             "linear time, a non-slicing floorplan no slicing tree could " +
             "capture.",
      },
    ], w: 17, speed: 2500 };
  };

  /* ----- Transitive Closure Graph: two DAGs of left-of / below relations ----- */
  BUILD["tcg-fp"] = function () {
    var size = { A: [2, 3], B: [2, 1], C: [3, 2], D: [1, 1] };
    var pos = { A: [0, 0], B: [2, 0], C: [2, 1], D: [4, 0] };
    var colorOf = { A: GREEN, B: BLUE, C: AMBER, D: PURPLE };
    /* horizontal graph Ch (left-of) and vertical graph Cv (below), transitively closed.
       solid = reduction edge, dashed = edge added by transitive closure */
    var edgesCh = [["A", "B"], ["A", "C"], ["B", "D"], ["A", "D"]];
    var closCh = { "A>D": 1 };
    var edgesCv = [["B", "C"], ["D", "C"]];
    var closCv = {};
    /* longest-path pack: x from Ch (widths), y from Cv (heights) */
    var order = ["A", "B", "C", "D"];
    function longest(edges, wkey) {
      var val = {}; order.forEach(function (n) { val[n] = 0; });
      /* topological-ish relaxation, enough passes for 4 nodes */
      for (var it = 0; it < order.length; it++) {
        edges.forEach(function (e) {
          var wj = wkey === "w" ? size[e[0]][0] : size[e[0]][1];
          if (val[e[0]] + wj > val[e[1]]) val[e[1]] = val[e[0]] + wj;
        });
      }
      return val;
    }
    var xv = longest(edgesCh, "w"), yv = longest(edgesCv, "h");
    /* geometry: main floorplan */
    var OX = 0.8, OY = 5.2, U = 1.35;
    function fx(x) { return (OX + x * U) * CS; }
    function fy(y) { return (OY - y * U) * CS; }
    function bg(ctx) { ctx.fillStyle = "#fdfdfd"; ctx.fillRect(0, 0, 17 * CS, H * CS); }
    function axes(ctx) {
      ctx.strokeStyle = "#c9c6bc"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(fx(0), fy(0)); ctx.lineTo(fx(5.4), fy(0)); ctx.moveTo(fx(0), fy(0)); ctx.lineTo(fx(0), fy(3.4)); ctx.stroke();
    }
    function floorplan(ctx, hl, labelFn) {
      axes(ctx);
      order.forEach(function (b) {
        var s = size[b], x = fx(pos[b][0]), y = fy(pos[b][1] + s[1]), w = s[0] * U * CS, h = s[1] * U * CS;
        var on = hl && hl.indexOf(b) >= 0;
        ctx.fillStyle = colorOf[b]; ctx.globalAlpha = on ? 0.85 : 0.45;
        ctx.fillRect(x + 2, y + 2, w - 4, h - 4); ctx.globalAlpha = 1;
        ctx.strokeStyle = on ? RED : INK; ctx.lineWidth = on ? 3.5 : 2; ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
        ctx.fillStyle = "#fff"; ctx.font = "bold 16px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(b, x + w / 2, y + h / 2 + 0.5);
        if (labelFn) { var t = labelFn(b); if (t) { ctx.font = "bold 11px 'JetBrains Mono', monospace"; ctx.fillText(t, x + w / 2, y + h / 2 + 16); } }
        ctx.textBaseline = "alphabetic";
      });
    }
    /* small floorplan for side-by-side */
    function fpAt(ctx, ox, oy, u, hl) {
      ctx.strokeStyle = "#c9c6bc"; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo((ox) * CS, (oy) * CS); ctx.lineTo((ox + 5 * u) * CS, (oy) * CS);
      ctx.moveTo((ox) * CS, (oy) * CS); ctx.lineTo((ox) * CS, (oy - 3 * u) * CS); ctx.stroke();
      order.forEach(function (b) {
        var s = size[b], x = (ox + pos[b][0] * u) * CS, y = (oy - (pos[b][1] + s[1]) * u) * CS, w = s[0] * u * CS, h = s[1] * u * CS;
        var on = hl && hl.indexOf(b) >= 0;
        ctx.fillStyle = colorOf[b]; ctx.globalAlpha = on ? 0.85 : 0.45;
        ctx.fillRect(x + 1, y + 1, w - 2, h - 2); ctx.globalAlpha = 1;
        ctx.strokeStyle = on ? RED : INK; ctx.lineWidth = on ? 2.5 : 1.5; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
        ctx.fillStyle = "#fff"; ctx.font = "bold 11px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(b, x + w / 2, y + h / 2 + 0.5); ctx.textBaseline = "alphabetic";
      });
    }
    function arrow(ctx, x1, y1, x2, y2, col, dashed) {
      var dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy);
      var ux = dx / len, uy = dy / len, r = 14;
      var ax0 = x1 + ux * r, ay0 = y1 + uy * r, ax1 = x2 - ux * r, ay1 = y2 - uy * r;
      ctx.strokeStyle = col; ctx.lineWidth = 2.2;
      if (dashed) ctx.setLineDash([5, 4]); else ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(ax0, ay0); ctx.lineTo(ax1, ay1); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(ax1, ay1); ctx.lineTo(ax1 - ux * 9 - uy * 5, ay1 - uy * 9 + ux * 5);
      ctx.lineTo(ax1 - ux * 9 + uy * 5, ay1 - uy * 9 - ux * 5); ctx.closePath(); ctx.fill();
    }
    function drawGraph(ctx, ox, oy, sc, nodes, edges, clos, hlPath) {
      function nx(n) { return (ox + nodes[n][0] * sc) * CS; }
      function ny(n) { return (oy + nodes[n][1] * sc) * CS; }
      edges.forEach(function (e) {
        var key = e[0] + ">" + e[1], isClos = clos[key];
        var onPath = hlPath && hlPath.indexOf(key) >= 0;
        arrow(ctx, nx(e[0]), ny(e[0]), nx(e[1]), ny(e[1]), onPath ? RED : (isClos ? "#b9bcc4" : "rgba(26,29,38,0.5)"), isClos);
      });
      Object.keys(nodes).forEach(function (n) {
        ctx.beginPath(); ctx.arc(nx(n), ny(n), 14, 0, Math.PI * 2);
        ctx.fillStyle = colorOf[n]; ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = "#fff"; ctx.font = "bold 13px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(n, nx(n), ny(n) + 0.5); ctx.textBaseline = "alphabetic";
      });
    }
    var nodesCh = { A: [0.3, 1.5], B: [1.9, 0.4], C: [1.9, 2.6], D: [3.5, 1.5] };
    var nodesCv = { B: [0.5, 2.4], D: [2.6, 2.4], C: [1.55, 0.5] };
    function label2(ctx, x, y, txt, col) { ctx.fillStyle = col || MUT; ctx.font = "bold 11px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.fillText(txt, x, y); }
    function panel(ctx, lines) {
      var QX = 9.0; ctx.textAlign = "left";
      lines.forEach(function (l, k) {
        ctx.fillStyle = k === 0 ? INK : (l.charAt(0) === "!" ? RED : (l.charAt(0) === "+" ? GREEN_DEEP : MUT));
        ctx.font = (k === 0 ? "bold " : "") + "12px 'JetBrains Mono', monospace";
        ctx.fillText(l.replace(/^[!+]/, ""), QX * CS, 22 + k * 18);
      });
    }
    return { frames: [
      {
        paint: function (ctx) { bg(ctx); floorplan(ctx, null, null);
          panel(ctx, ["a compacted placement", "four blocks, no overlap", "", "the TCG describes it not",
                      "  by coordinates but by the", "  RELATIONS between every", "  pair of blocks", "",
                      "+for any two blocks, one is", "  either LEFT-OF the other", "  or BELOW it"]); },
        cap: "Start from a compacted placement of four blocks. The " +
             "transitive closure graph does not store coordinates. It " +
             "stores the geometric relation between every pair of blocks: " +
             "for any two, one is either left of the other or below it, " +
             "and exactly one of those holds.",
      },
      {
        paint: function (ctx) { bg(ctx); floorplan(ctx, ["A", "B", "C"], null);
          /* horizontal relation A left-of B */
          arrow(ctx, fx(1) , fy(0.5), fx(3), fy(0.5), GREEN_DEEP, false);
          label2(ctx, fx(2), fy(0.5) - 12, "A left-of B", GREEN_DEEP);
          /* vertical relation B below C */
          arrow(ctx, fx(3), fy(0.5), fx(3), fy(2.0), "#b45309", false);
          label2(ctx, fx(4.0), fy(1.3), "B below C", "#b45309");
          panel(ctx, ["two kinds of relation", "+HORIZONTAL (left-of):", "  A is left of B, so an", "  edge A -> B goes in the",
                      "  horizontal graph Ch", "", "+VERTICAL (below):", "  B is below C, so an edge", "  B -> C goes in the",
                      "  vertical graph Cv"]); },
        cap: "Each relation becomes a directed edge in one of two graphs. " +
             "A is left of B, so edge A to B goes in the horizontal graph " +
             "Ch (green). B is below C, so edge B to C goes in the " +
             "vertical graph Cv (amber). Every pair contributes exactly " +
             "one edge to exactly one of the two graphs.",
      },
      {
        paint: function (ctx) { bg(ctx);
          label2(ctx, 2.0 * CS, 0.9 * CS, "the placement", MUT);
          fpAt(ctx, 0.6, 5.0, 0.72, null);
          label2(ctx, 7.0 * CS, 0.9 * CS, "Ch: left-of graph", MUT);
          drawGraph(ctx, 5.0, 1.2, 0.9, nodesCh, edgesCh, closCh, null);
          panel(ctx, ["the horizontal graph Ch", "one node per block, one", "  edge per left-of pair", "", "solid = direct relation",
                      "dashed = added to keep the", "  graph TRANSITIVELY CLOSED", "  (A->B, B->D imply A->D)", "",
                      "+x-order is read straight", "  off this graph"]); },
        cap: "The horizontal graph Ch has one node per block and one edge " +
             "for every left-of pair. Solid edges are direct relations; " +
             "the dashed A to D is added to keep the graph transitively " +
             "closed, since A left of B and B left of D imply A left of " +
             "D. Ch is kept closed so the left-right order is explicit.",
      },
      {
        paint: function (ctx) { bg(ctx);
          label2(ctx, 2.0 * CS, 0.9 * CS, "the placement", MUT);
          fpAt(ctx, 0.6, 5.0, 0.72, null);
          label2(ctx, 7.0 * CS, 0.9 * CS, "Cv: below graph", MUT);
          drawGraph(ctx, 5.2, 1.2, 0.95, nodesCv, edgesCv, closCv, null);
          panel(ctx, ["the vertical graph Cv", "the same idea for BELOW", "", "B below C and D below C,", "  so B -> C and D -> C",
                      "", "+every pair sits in exactly", "  ONE graph: 6 pairs =", "  4 edges in Ch + 2 in Cv", "",
                      "the two graphs together", "  ARE the representation"]); },
        cap: "The vertical graph Cv does the same for the below " +
             "relation: B and D are both below C, giving edges B to C and " +
             "D to C. Every one of the six pairs lands in exactly one " +
             "graph, four in Ch and two in Cv. The two graphs together " +
             "are the entire representation, no coordinates stored.",
      },
      {
        paint: function (ctx) { bg(ctx); floorplan(ctx, ["A", "B", "D"], function (b) { return "x=" + xv[b]; });
          /* critical path A -> B -> D drawn along the bottom of the placement */
          arrow(ctx, fx(0.15), fy(0.18), fx(4.85), fy(0.18), RED, false);
          label2(ctx, fx(2.5), fy(0) + 22, "A->B->D: width 2+2+1 = 5", RED);
          panel(ctx, ["decode x: longest path", "weight each Ch node by its", "  block WIDTH, then take", "  the longest path to it", "",
                      "+x(A)=0, x(B)=2, x(C)=2,", "  x(D)=max(2, 2+2)=4", "", "!critical path A->B->D (red)", "  sets D's x and the",
                      "  total width = 5"]); },
        cap: "To place the blocks, weight each Ch node by its width and " +
             "take the longest path to it. That gives x(A)=0, x(B)=2, " +
             "x(C)=2, and x(D)=4, since D's longest incoming path is A to " +
             "B to D (red). The longest path overall sets the chip width, " +
             "here 5.",
      },
      {
        paint: function (ctx) { bg(ctx); floorplan(ctx, ["B", "C", "D"], function (b) { return "y=" + yv[b]; });
          /* vertical critical path B -> C drawn up the placement */
          arrow(ctx, fx(3.5), fy(0.15), fx(3.5), fy(2.85), RED, false);
          label2(ctx, fx(2.5), fy(0) + 22, "B->C: height 1+2 = 3", RED);
          panel(ctx, ["decode y: same on Cv", "weight Cv nodes by HEIGHT,", "  take longest paths", "", "+y(A)=0, y(B)=0, y(D)=0,",
                      "  y(C)=max(0+1, 0+1)=1", "", "+both coordinates come from", "  the two graphs; the", "  placement is reproduced",
                      "  exactly, in linear time"]); },
        cap: "The y-coordinates come the same way from Cv, weighting " +
             "nodes by height: y(A)=0, y(B)=0, y(D)=0, and y(C)=1 since C " +
             "sits above both B and D. Both coordinates are recovered by " +
             "longest paths on the two graphs, reproducing the placement " +
             "exactly in linear time.",
      },
    ], w: 17, speed: 2500 };
  };

  /* ----- STA timing graph: arrival / required / slack propagation ----- */
  BUILD["sta-graph"] = function () {
    var nodes = { L: [1.0, 3.0], a: [3.3, 1.7], b: [3.3, 4.3], m: [5.5, 3.0], C: [7.3, 3.0] };
    var label = { L: "L", a: "a", b: "b", m: "m", C: "C" };
    var edges = [["L", "a", 2], ["L", "b", 4], ["a", "m", 3], ["b", "m", 2], ["m", "C", 2]];
    var T = 12, setup = 1, reqC = T - setup;
    var ord = ["L", "a", "b", "m", "C"];
    var pre = {}; ord.forEach(function (n) { pre[n] = []; });
    var post = {}; ord.forEach(function (n) { post[n] = []; });
    edges.forEach(function (e) { pre[e[1]].push([e[0], e[2]]); post[e[0]].push([e[1], e[2]]); });
    /* arrival (forward max) */
    var arr = { L: 0 };
    ord.forEach(function (n) {
      if (n === "L") return;
      var v = 0; pre[n].forEach(function (p) { v = Math.max(v, arr[p[0]] + p[1]); }); arr[n] = v;
    });
    /* required (backward min) */
    var req = {}; req.C = reqC;
    for (var i = ord.length - 1; i >= 0; i--) {
      var n = ord[i]; if (n === "C") continue;
      var v = Infinity; post[n].forEach(function (p) { v = Math.min(v, req[p[0]] - p[1]); }); req[n] = v;
    }
    var slack = {}; ord.forEach(function (n) { slack[n] = req[n] - arr[n]; });
    var minSlack = Math.min.apply(null, ord.map(function (n) { return slack[n]; }));
    var critN = {}, critE = {};
    ord.forEach(function (n) { if (slack[n] === minSlack) critN[n] = 1; });
    edges.forEach(function (e) { if (critN[e[0]] && critN[e[1]]) critE[e[0] + ">" + e[1]] = 1; });
    /* geometry */
    function nx(n) { return (0.4 + nodes[n][0]) * CS; }
    function ny(n) { return (nodes[n][1]) * CS; }
    function bg(ctx) { ctx.fillStyle = "#fdfdfd"; ctx.fillRect(0, 0, 17 * CS, H * CS); }
    function arrowTo(ctx, x1, y1, x2, y2, col) {
      var dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy), ux = dx / len, uy = dy / len, r = 17;
      var bx = x1 + ux * r, by = y1 + uy * r, ex = x2 - ux * r, ey = y2 - uy * r;
      ctx.strokeStyle = col; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(ex, ey);
      ctx.lineTo(ex - ux * 9 - uy * 5, ey - uy * 9 + ux * 5); ctx.lineTo(ex - ux * 9 + uy * 5, ey - uy * 9 - ux * 5);
      ctx.closePath(); ctx.fill();
    }
    function graph(ctx, showArr, showReq, showSlack, hiCrit) {
      edges.forEach(function (e) {
        var on = hiCrit && critE[e[0] + ">" + e[1]];
        arrowTo(ctx, nx(e[0]), ny(e[0]), nx(e[1]), ny(e[1]), on ? RED : "rgba(26,29,38,0.45)");
        var mx = (nx(e[0]) + nx(e[1])) / 2, my = (ny(e[0]) + ny(e[1])) / 2;
        ctx.fillStyle = MUT; ctx.font = "11px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("+" + e[2], mx, my - 9);
      });
      ord.forEach(function (n) {
        var on = hiCrit && critN[n];
        ctx.beginPath(); ctx.arc(nx(n), ny(n), 17, 0, Math.PI * 2);
        ctx.fillStyle = on ? "#fde7e7" : "#eef1f6"; ctx.fill();
        ctx.strokeStyle = on ? RED : INK; ctx.lineWidth = on ? 3 : 2; ctx.stroke();
        ctx.fillStyle = INK; ctx.font = "bold 14px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(label[n], nx(n), ny(n) + 0.5);
        if (showArr) { ctx.fillStyle = GREEN_DEEP; ctx.font = "bold 12px 'JetBrains Mono', monospace"; ctx.fillText("A=" + arr[n], nx(n), ny(n) - 30); }
        if (showReq) { ctx.fillStyle = PURPLE; ctx.font = "bold 12px 'JetBrains Mono', monospace"; ctx.fillText("R=" + req[n], nx(n), ny(n) + 32); }
        if (showSlack) { ctx.fillStyle = on ? RED : MUT; ctx.font = "bold 12px 'JetBrains Mono', monospace"; ctx.fillText("s=" + slack[n], nx(n) + 26, ny(n) - 20); }
        ctx.textBaseline = "alphabetic";
      });
    }
    function panel(ctx, lines) {
      var QX = 9.6; ctx.textAlign = "left";
      lines.forEach(function (l, k) {
        ctx.fillStyle = k === 0 ? INK : (l.charAt(0) === "!" ? RED : (l.charAt(0) === "+" ? GREEN_DEEP : MUT));
        ctx.font = (k === 0 ? "bold " : "") + "12px 'JetBrains Mono', monospace";
        ctx.fillText(l.replace(/^[!+]/, ""), QX * CS, 26 + k * 19);
      });
    }
    return { frames: [
      {
        paint: function (ctx) { bg(ctx); graph(ctx, false, false, false, false);
          panel(ctx, ["the timing graph", "nodes are pins, edges are", "  timing arcs with a delay", "  (+n on each edge)", "",
                      "L = launch, C = capture", "a, b, m = internal pins", "", "+two paths reconverge at m:", "  L->a->m and L->b->m"]); },
        cap: "Static timing models the circuit as a directed graph: nodes " +
             "are pins, edges are timing arcs carrying a delay. Here L is " +
             "the launch pin and C the capture pin, with two paths " +
             "reconverging at m. No input vectors are needed; the graph " +
             "covers every path at once.",
      },
      {
        paint: function (ctx) { bg(ctx); graph(ctx, true, false, false, false);
          panel(ctx, ["forward sweep: arrival", "A(node) = latest time a", "  signal can arrive", "", "+push forward, taking the",
                      "  MAX over incoming edges", "", "A(m)=max(A(a)+3, A(b)+2)", "     =max(5, 6) = 6", "the later path (b) wins",
                      "A(C) = 6 + 2 = 8"]); },
        cap: "The forward sweep computes arrival time A: the latest a " +
             "signal can reach each node, taking the maximum over " +
             "incoming edges. At the reconvergence m, A(m) = max(A(a)+3, " +
             "A(b)+2) = max(5, 6) = 6, so the b path wins. The data " +
             "reaches C at A(C) = 8.",
      },
      {
        paint: function (ctx) { bg(ctx); graph(ctx, true, true, false, false);
          panel(ctx, ["backward sweep: required", "R(node) = latest time a", "  signal MAY arrive and", "  still meet the clock", "",
                      "+R(C) = period - setup", "     = 12 - 1 = 11", "push backward, taking the", "  MIN over outgoing edges",
                      "R(L)=min(6-2, 7-4)=3"]); },
        cap: "The backward sweep computes required time R: the latest a " +
             "signal may arrive and still meet the clock. It starts at " +
             "the endpoint, R(C) = period - setup = 11, and propagates " +
             "back taking the minimum over outgoing edges, down to R(L) = " +
             "min(6-2, 7-4) = 3.",
      },
      {
        paint: function (ctx) { bg(ctx); graph(ctx, false, false, true, true);
          panel(ctx, ["slack = required - arrival", "at every node, one", "  subtraction", "", "+s(C)=11-8=3, s(m)=9-6=3",
                      "s(b)=7-4=3, s(a)=6-2=4", "", "!critical path (red): the", "  min-slack chain", "  L -> b -> m -> C, slack 3",
                      "a is off it (slack 4)"]); },
        cap: "Slack is required minus arrival, one subtraction per node. " +
             "The minimum-slack chain L to b to m to C (red) is the " +
             "critical path, slack 3 throughout. Node a sits off it with " +
             "slack 4. Positive slack everywhere means the design meets " +
             "timing; a negative value would flag the violating cone.",
      },
    ], w: 17, speed: 2400 };
  };

  /* ----- Setup and hold checks: clock aperture + max/min data arrival ----- */
  BUILD["setup-hold"] = function () {
    var T = 10, tsu = 1, thold = 1, ck2q = 1, maxPath = 6, minPath = 2;
    var Amax = ck2q + maxPath;                 /* latest data at capture D = 7 */
    var Amin = ck2q + minPath;                 /* earliest new data at D = 3 */
    var setupDeadline = T - tsu;               /* 9 */
    var setupSlack = setupDeadline - Amax;     /* 2 */
    var holdSlack = Amin - thold;              /* 2 */
    var OX = 1.5, U = 0.62;
    function tx(t) { return (OX + t * U) * CS; }
    function bg(ctx) { ctx.fillStyle = "#fdfdfd"; ctx.fillRect(0, 0, 17 * CS, H * CS); }
    function panel(ctx, lines) {
      var QX = 9.7; ctx.textAlign = "left";
      lines.forEach(function (l, k) {
        ctx.fillStyle = k === 0 ? INK : (l.charAt(0) === "!" ? RED : (l.charAt(0) === "+" ? GREEN_DEEP : MUT));
        ctx.font = (k === 0 ? "bold " : "") + "12px 'JetBrains Mono', monospace";
        ctx.fillText(l.replace(/^[!+]/, ""), QX * CS, 26 + k * 19);
      });
    }
    function vline(ctx, t, y0, y1, col, dash) {
      ctx.strokeStyle = col; ctx.lineWidth = 2; if (dash) ctx.setLineDash([5, 4]); else ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(tx(t), y0 * CS); ctx.lineTo(tx(t), y1 * CS); ctx.stroke(); ctx.setLineDash([]);
    }
    function tlabel(ctx, t, y, txt, col, align) {
      ctx.fillStyle = col || MUT; ctx.font = "11px 'JetBrains Mono', monospace"; ctx.textAlign = align || "center";
      ctx.fillText(txt, tx(t), y * CS);
    }
    /* square clock: rising edges at 0 and T, half period T/2 */
    function clock(ctx, hiY, loY) {
      var pts = [[-0.4, loY], [0, loY], [0, hiY], [T / 2, hiY], [T / 2, loY], [T, loY], [T, hiY], [T + 2, hiY]];
      ctx.strokeStyle = INK; ctx.lineWidth = 2.4; ctx.beginPath();
      pts.forEach(function (p, i) { var X = tx(p[0]), Y = p[1] * CS; if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y); });
      ctx.stroke();
      ctx.fillStyle = INK; ctx.font = "bold 12px 'JetBrains Mono', monospace"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
      ctx.fillText("CLK", tx(-0.6), (hiY + loY) / 2 * CS); ctx.textBaseline = "alphabetic";
    }
    function dataAxis(ctx, midY, txt) {
      ctx.strokeStyle = "#d3d0c8"; ctx.lineWidth = 1.2; ctx.beginPath();
      ctx.moveTo(tx(-0.4), midY * CS); ctx.lineTo(tx(T + 2), midY * CS); ctx.stroke();
      ctx.fillStyle = INK; ctx.font = "bold 12px 'JetBrains Mono', monospace"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
      ctx.fillText(txt, tx(-0.6), midY * CS); ctx.textBaseline = "alphabetic";
    }
    /* a data transition: low->high step at time t, on the data row */
    function dataEdge(ctx, t, hiY, loY, col) {
      ctx.strokeStyle = col; ctx.lineWidth = 2.4; ctx.beginPath();
      ctx.moveTo(tx(-0.4), loY * CS); ctx.lineTo(tx(t), loY * CS); ctx.lineTo(tx(t), hiY * CS); ctx.lineTo(tx(T + 2), hiY * CS);
      ctx.stroke();
    }
    function band(ctx, t0, t1, y0, y1, col) {
      ctx.fillStyle = col; ctx.fillRect(tx(t0), y0 * CS, tx(t1) - tx(t0), (y1 - y0) * CS);
    }
    function ffbox(ctx, x, y, w, h, name) {
      ctx.fillStyle = "#eef1f6"; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = INK; ctx.font = "bold 13px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(name, x + w / 2, y + h / 2 - 6);
      /* clock triangle at bottom-left */
      ctx.beginPath(); ctx.moveTo(x + 4, y + h - 4); ctx.lineTo(x + 14, y + h - 9); ctx.lineTo(x + 4, y + h - 14); ctx.closePath();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke(); ctx.textBaseline = "alphabetic";
    }
    return { frames: [
      {
        paint: function (ctx) { bg(ctx);
          /* block diagram: explicit pixel layout, spaced so nothing overlaps */
          var bY = 2.5 * CS, bW = 58, bH = 54, f1x = 20, f2x = 214;
          var cx = 150, cy = bY + bH / 2, rx = 38, ry = 24;
          ffbox(ctx, f1x, bY, bW, bH, "FF1");
          ffbox(ctx, f2x, bY, bW, bH, "FF2");
          /* combinational cloud, clear of both flip-flops */
          ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.fillStyle = "#f4ecdf";
          ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.fillStyle = INK; ctx.font = "12px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText("logic", cx, cy); ctx.textBaseline = "alphabetic";
          /* data wires: FF1 -> cloud -> FF2 */
          ctx.strokeStyle = GREEN_DEEP; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(f1x + bW, cy); ctx.lineTo(cx - rx, cy); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(cx + rx, cy); ctx.lineTo(f2x, cy); ctx.stroke();
          ctx.fillStyle = GREEN_DEEP; ctx.font = "bold 12px 'JetBrains Mono', monospace"; ctx.textAlign = "center";
          ctx.fillText("Q", f1x + bW + 13, cy - 8); ctx.fillText("D", f2x - 13, cy - 8);
          /* common clock line under both */
          ctx.strokeStyle = BLUE; ctx.lineWidth = 2;
          var clkY = bY + bH + 26;
          ctx.beginPath(); ctx.moveTo(f1x + 12, bY + bH); ctx.lineTo(f1x + 12, clkY);
          ctx.lineTo(f2x + 12, clkY); ctx.lineTo(f2x + 12, bY + bH); ctx.stroke();
          ctx.fillStyle = BLUE; ctx.font = "bold 12px 'JetBrains Mono', monospace"; ctx.textAlign = "center";
          ctx.fillText("CLK (common)", (f1x + f2x) / 2 + 12, clkY + 16);
          panel(ctx, ["one path, two checks", "FF1 launches data through", "  the logic to FF2, both on", "  the SAME clock", "",
                      "+SETUP: does the data arrive", "  in time for the next edge?", "+HOLD: does it wait long", "  enough after this edge?",
                      "", "both are checked at FF2's D"]); },
        cap: "A timing path runs from a launch flip-flop FF1, through " +
             "combinational logic, to a capture flip-flop FF2, both on " +
             "the same clock. Two checks guard FF2's data input: setup " +
             "asks whether data arrives early enough for the next clock " +
             "edge, and hold asks whether it stays stable long enough " +
             "after the current edge.",
      },
      {
        paint: function (ctx) { bg(ctx);
          band(ctx, T - tsu, T + thold, 1.6, 6.4, "#f0e6d2");
          clock(ctx, 2.0, 3.2);
          dataAxis(ctx, 5.4, "D");
          vline(ctx, T, 1.6, 6.4, PURPLE, true);
          tlabel(ctx, T, 1.4, "capture edge", PURPLE);
          /* setup / hold named OUTSIDE the narrow band, pointing in */
          tlabel(ctx, T - tsu, 6.95, "setup", "#b45309", "right");
          tlabel(ctx, T + thold, 6.95, "hold", "#b45309", "left");
          vline(ctx, T - tsu, 4.8, 6.0, "#b45309", false);
          vline(ctx, T + thold, 4.8, 6.0, "#b45309", false);
          panel(ctx, ["the aperture", "a flip-flop needs its D", "  input STABLE in a window", "  around the clock edge", "",
                      "+setup time (tsu): stable", "  BEFORE the edge", "+hold time (thold): stable", "  AFTER the edge", "",
                      "the shaded band is the", "  forbidden change zone"]); },
        cap: "A flip-flop can only capture correctly if its D input is " +
             "stable across an aperture around the clock edge: the setup " +
             "time before it and the hold time after it (shaded). A data " +
             "change inside that band is what the two checks exist to " +
             "prevent.",
      },
      {
        paint: function (ctx) { bg(ctx);
          clock(ctx, 2.0, 3.2);
          vline(ctx, 0, 1.7, 3.4, GREEN_DEEP, true); tlabel(ctx, 0, 1.5, "launch edge", GREEN_DEEP);
          vline(ctx, T, 1.7, 6.4, PURPLE, true); tlabel(ctx, T, 1.5, "capture edge", PURPLE);
          dataAxis(ctx, 5.4, "D");
          band(ctx, setupDeadline, T, 4.6, 6.2, "#f0e6d2");
          dataEdge(ctx, Amax, 4.8, 6.0, GREEN_DEEP);
          vline(ctx, setupDeadline, 4.4, 6.4, "#b45309", false);
          tlabel(ctx, Amax, 6.6, "A=7", GREEN_DEEP);
          tlabel(ctx, setupDeadline, 7.3, "deadline 9", "#b45309");
          /* slack arrow (kept short so it clears the capture edge) */
          ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = 1.8;
          var sy = 4.2 * CS; ctx.beginPath(); ctx.moveTo(tx(Amax), sy); ctx.lineTo(tx(setupDeadline), sy); ctx.stroke();
          tlabel(ctx, (Amax + setupDeadline) / 2, 3.95, "slack +2", INK);
          panel(ctx, ["setup: the LATE check", "data launched at edge 0", "  takes the MAX path delay", "", "+arrival A = ck2q + maxpath",
                      "        = 1 + 6 = 7", "+deadline = period - tsu", "        = 10 - 1 = 9", "", "!slack = 9 - 7 = +2 (met):",
                      "  late data still beats", "  the next edge"]); },
        cap: "Setup is the late check, run against the maximum path " +
             "delay. Data launched at edge 0 arrives at A = ck2q + " +
             "maxpath = 7, and it must beat the next capture edge minus " +
             "the setup time, 10 - 1 = 9. The setup slack is 9 - 7 = +2, " +
             "so even the slowest path meets the clock. A slower path or " +
             "faster clock shrinks this margin.",
      },
      {
        paint: function (ctx) { bg(ctx);
          clock(ctx, 2.0, 3.2);
          vline(ctx, 0, 1.7, 6.4, PURPLE, true);
          tlabel(ctx, 0, 1.5, "launch = capture edge", PURPLE, "left");
          dataAxis(ctx, 5.4, "D");
          band(ctx, 0, thold, 4.6, 6.2, "#f0e6d2");
          dataEdge(ctx, Amin, 4.8, 6.0, GREEN_DEEP);
          vline(ctx, thold, 4.4, 6.4, "#b45309", false);
          tlabel(ctx, Amin, 6.6, "A=3", GREEN_DEEP);
          tlabel(ctx, thold, 7.3, "thold 1", "#b45309");
          ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = 1.8;
          var sy = 4.2 * CS; ctx.beginPath(); ctx.moveTo(tx(thold), sy); ctx.lineTo(tx(Amin), sy); ctx.stroke();
          tlabel(ctx, (thold + Amin) / 2, 3.95, "slack +2", INK);
          panel(ctx, ["hold: the EARLY check", "same edge, no period: new", "  data must not arrive too", "  soon and corrupt the", "  value being captured now",
                      "", "+arrival A = ck2q + minpath", "        = 1 + 2 = 3", "+must be >= thold = 1", "", "!slack = 3 - 1 = +2 (met)"]); },
        cap: "Hold is the early check, run against the minimum path delay " +
             "and against the SAME edge, so the clock period never enters " +
             "it. New data launched at edge 0 arrives at A = ck2q + " +
             "minpath = 3, and it must stay clear until the hold time, 1, " +
             "has passed. The hold slack is 3 - 1 = +2. Hold failures are " +
             "fixed by adding delay, not by slowing the clock.",
      },
    ], w: 17, speed: 2600 };
  };

  /* ----- CTS H-tree: equal-length clock distribution, zero skew ----- */
  BUILD["cts-htree"] = function () {
    var cx = 4.7, cy = 5.0, L1 = 2.2, L2 = L1 / 2;
    function px(x) { return x * CS; }
    function py(y) { return y * CS; }
    /* mid nodes (level-1 leaves) and the 16 sinks */
    var mids = [];
    [-1, 1].forEach(function (sx) { [-1, 1].forEach(function (sy) { mids.push({ x: cx + sx * L1, y: cy + sy * L1 }); }); });
    var sinks = [];
    mids.forEach(function (m) {
      [-1, 1].forEach(function (sx) { [-1, 1].forEach(function (sy) { sinks.push({ x: m.x + sx * L2, y: m.y + sy * L2, mid: m }); }); });
    });
    function seg(ctx, a, b, col, w) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(px(a.x), py(a.y)); ctx.lineTo(px(b.x), py(b.y)); ctx.stroke(); }
    function level1(ctx, col) {
      seg(ctx, { x: cx - L1, y: cy }, { x: cx + L1, y: cy }, col, 2.4);
      seg(ctx, { x: cx - L1, y: cy - L1 }, { x: cx - L1, y: cy + L1 }, col, 2.4);
      seg(ctx, { x: cx + L1, y: cy - L1 }, { x: cx + L1, y: cy + L1 }, col, 2.4);
    }
    function level2(ctx, col) {
      mids.forEach(function (m) {
        seg(ctx, { x: m.x - L2, y: m.y }, { x: m.x + L2, y: m.y }, col, 1.8);
        seg(ctx, { x: m.x - L2, y: m.y - L2 }, { x: m.x - L2, y: m.y + L2 }, col, 1.8);
        seg(ctx, { x: m.x + L2, y: m.y - L2 }, { x: m.x + L2, y: m.y + L2 }, col, 1.8);
      });
    }
    function root(ctx) {
      ctx.fillStyle = BLUE; ctx.beginPath(); ctx.arc(px(cx), py(cy), 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = BLUE; ctx.font = "bold 11px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
      ctx.fillText("clock source", px(cx), py(cy) - 10); ctx.textBaseline = "alphabetic";
    }
    function buf(ctx, p) {
      ctx.fillStyle = "#fff"; ctx.strokeStyle = GREEN_DEEP; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px(p.x) - 6, py(p.y) - 6); ctx.lineTo(px(p.x) + 7, py(p.y)); ctx.lineTo(px(p.x) - 6, py(p.y) + 6); ctx.closePath();
      ctx.fill(); ctx.stroke();
    }
    function sinksDraw(ctx, hl) {
      sinks.forEach(function (s) {
        var on = hl && hl.indexOf(s) >= 0;
        ctx.fillStyle = on ? "#fde7e7" : "#eef1f6"; ctx.strokeStyle = on ? RED : INK; ctx.lineWidth = on ? 2.5 : 1.5;
        ctx.fillRect(px(s.x) - 6, py(s.y) - 6, 12, 12); ctx.strokeRect(px(s.x) - 6, py(s.y) - 6, 12, 12);
      });
    }
    function pathTo(ctx, s, col) {
      /* root -> (mid.x, cy) -> mid -> (s.x, mid.y) -> s : all right-angle */
      var m = s.mid;
      ctx.strokeStyle = col; ctx.lineWidth = 3.2; ctx.beginPath();
      ctx.moveTo(px(cx), py(cy)); ctx.lineTo(px(m.x), py(cy)); ctx.lineTo(px(m.x), py(m.y));
      ctx.lineTo(px(s.x), py(m.y)); ctx.lineTo(px(s.x), py(s.y)); ctx.stroke();
    }
    function bg(ctx) { ctx.fillStyle = "#fdfdfd"; ctx.fillRect(0, 0, 17 * CS, H * CS); }
    function panel(ctx, lines) {
      var QX = 10.0; ctx.textAlign = "left";
      lines.forEach(function (l, k) {
        ctx.fillStyle = k === 0 ? INK : (l.charAt(0) === "!" ? RED : (l.charAt(0) === "+" ? GREEN_DEEP : MUT));
        ctx.font = (k === 0 ? "bold " : "") + "12px 'JetBrains Mono', monospace";
        ctx.fillText(l.replace(/^[!+]/, ""), QX * CS, 26 + k * 19);
      });
    }
    return { frames: [
      {
        paint: function (ctx) { bg(ctx); level1(ctx, "rgba(26,29,38,0.5)");
          mids.forEach(function (m) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(px(m.x), py(m.y), 4, 0, Math.PI * 2); ctx.fill(); });
          root(ctx);
          panel(ctx, ["the H-tree", "one clock source must", "  reach every flip-flop at", "  the SAME time", "",
                      "start with an H: the", "  source sits at the", "  center, wires run to the", "  4 corners, each the", "  same distance"]); },
        cap: "Clock tree synthesis must deliver one clock to thousands " +
             "of flip-flops so they all switch together. The H-tree does " +
             "it by symmetry: the source sits at the center of an H, and " +
             "each of the four corners is the same wire distance away.",
      },
      {
        paint: function (ctx) { bg(ctx); level1(ctx, "rgba(26,29,38,0.35)"); level2(ctx, "rgba(26,29,38,0.5)");
          sinksDraw(ctx, null); root(ctx);
          panel(ctx, ["recurse", "put a smaller H at each", "  corner, and again, until", "  every flip-flop is a leaf", "",
                      "+16 sinks here, and every", "  root-to-leaf path is the", "  identical length", "", "that equal length is the",
                      "  whole idea"]); },
        cap: "Repeat the H at each corner, half the size, until every " +
             "flip-flop is a leaf. Because the structure is symmetric, " +
             "every root-to-leaf path is the identical length. That equal " +
             "length is what makes the clock arrive everywhere at once.",
      },
      {
        paint: function (ctx) { bg(ctx); level1(ctx, "rgba(26,29,38,0.35)"); level2(ctx, "rgba(26,29,38,0.5)");
          sinksDraw(ctx, null);
          mids.forEach(function (m) { buf(ctx, m); }); buf(ctx, { x: cx, y: cy });
          root(ctx);
          panel(ctx, ["buffering", "a real tree cannot drive", "  thousands of loads from", "  one gate", "",
                      "+insert clock buffers at", "  each level (green) to", "  restore drive and keep", "  the edge sharp", "",
                      "buffers add delay but keep", "  it BALANCED across legs"]); },
        cap: "One gate cannot drive thousands of far loads, so clock " +
             "buffers are inserted at each level of the tree (green). They " +
             "restore drive strength and keep the clock edge sharp. The " +
             "buffers add delay, but because the tree is balanced, they " +
             "add the same delay to every leg.",
      },
      {
        paint: function (ctx) { bg(ctx); level1(ctx, "rgba(26,29,38,0.2)"); level2(ctx, "rgba(26,29,38,0.3)");
          sinksDraw(ctx, [sinks[0], sinks[15]]);
          pathTo(ctx, sinks[0], RED); pathTo(ctx, sinks[15], "#b45309");
          mids.forEach(function (m) { buf(ctx, m); }); buf(ctx, { x: cx, y: cy }); root(ctx);
          panel(ctx, ["skew and latency", "trace any two leaves: the", "  two paths (red, amber)", "  have equal length", "",
                      "+SKEW = arrival spread", "  across leaves = 0 here", "+LATENCY (insertion delay)", "  = the shared path length",
                      "", "low skew is the goal;", "  latency is the by-product"]); },
        cap: "Trace any two leaves and the paths are equal length (red " +
             "and amber). Skew, the spread in clock arrival across the " +
             "leaves, is therefore near zero, which is the goal. The " +
             "shared path length is the insertion delay, or latency, a " +
             "by-product the tree keeps equal for everyone.",
      },
    ], w: 17, speed: 2500 };
  };

  /* ===== Floorplanning education visual guides (compact, static) ===== */
  function fpBg(ctx) { ctx.fillStyle = "#fdfdfd"; ctx.fillRect(0, 0, 17 * CS, H * CS); }
  function fpR(ctx, x, y, w, h, fill, stroke, lw, dash) {
    if (dash) ctx.setLineDash(dash); else ctx.setLineDash([]);
    if (fill) { ctx.fillStyle = fill; ctx.fillRect(x * CS, y * CS, w * CS, h * CS); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.strokeRect(x * CS, y * CS, w * CS, h * CS); }
    ctx.setLineDash([]);
  }
  function fpT(ctx, x, y, txt, col, size, align) {
    ctx.fillStyle = col || INK; ctx.font = (size || 12) + "px 'JetBrains Mono', monospace";
    ctx.textAlign = align || "center"; ctx.textBaseline = "middle"; ctx.fillText(txt, x * CS, y * CS); ctx.textBaseline = "alphabetic";
  }
  function fpTB(ctx, x, y, txt, col, size, align) {
    ctx.fillStyle = col || INK; ctx.font = "bold " + (size || 12) + "px 'JetBrains Mono', monospace";
    ctx.textAlign = align || "center"; ctx.textBaseline = "middle"; ctx.fillText(txt, x * CS, y * CS); ctx.textBaseline = "alphabetic";
  }
  function fpPanel(ctx, lines) {
    var QX = 9.6; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    lines.forEach(function (l, k) {
      ctx.fillStyle = k === 0 ? INK : (l.charAt(0) === "!" ? RED : (l.charAt(0) === "+" ? GREEN_DEEP : MUT));
      ctx.font = (k === 0 ? "bold " : "") + "12px 'JetBrains Mono', monospace";
      ctx.fillText(l.replace(/^[!+]/, ""), QX * CS, 26 + k * 19);
    });
  }
  function fpPads(ctx, x0, y0, x1, y1) {
    ctx.fillStyle = "#c7ccd6";
    var i, s = 0.34, g = 0.28;
    for (i = 0; i < 7; i++) { var x = x0 + 0.5 + i * ((x1 - x0 - 1) / 6); fpR(ctx, x, y0 + 0.06, s, g, "#c7ccd6"); fpR(ctx, x, y1 - g - 0.06, s, g, "#c7ccd6"); }
    for (i = 0; i < 6; i++) { var y = y0 + 0.7 + i * ((y1 - y0 - 1.2) / 5); fpR(ctx, x0 + 0.06, y, g, s, "#c7ccd6"); fpR(ctx, x1 - g - 0.06, y, g, s, "#c7ccd6"); }
  }
  function fpDots(ctx, x0, y0, x1, y1, skip) {
    ctx.fillStyle = "#c3c8d2";
    for (var x = x0; x <= x1; x += 0.32) for (var y = y0; y <= y1; y += 0.32) {
      var hit = false; if (skip) skip.forEach(function (m) { if (x >= m[0] - 0.15 && x <= m[0] + m[2] + 0.05 && y >= m[1] - 0.15 && y <= m[1] + m[3] + 0.05) hit = true; });
      if (!hit) { ctx.beginPath(); ctx.arc(x * CS, y * CS, 1.6, 0, Math.PI * 2); ctx.fill(); }
    }
  }

  BUILD["fp-overview"] = function () {
    return { frames: [{ paint: function (ctx) { fpBg(ctx);
      fpR(ctx, 0.6, 0.8, 7.6, 7.8, null, INK, 2);              /* die */
      fpPads(ctx, 0.6, 0.8, 8.2, 8.6);
      fpR(ctx, 1.5, 1.7, 5.9, 6.0, "#fdfdfd", "#9aa0ac", 1.4); /* core */
      fpR(ctx, 1.68, 1.88, 5.54, 5.64, null, RED, 1.3);        /* power ring */
      var M = [[1.9, 2.2, 1.9, 1.6], [4.9, 4.9, 2.1, 2.2]];
      fpDots(ctx, 1.75, 2.05, 7.15, 7.4, M);
      M.forEach(function (m, k) { fpR(ctx, m[0], m[1], m[2], m[3], "#dfe9f5", BLUE, 1.6); fpTB(ctx, m[0] + m[2] / 2, m[1] + m[3] / 2, k === 0 ? "SRAM" : "macro", BLUE, 12); });
      fpT(ctx, 6.0, 3.1, "cells", MUT, 11);
      fpPanel(ctx, ["the floorplan frame", "everything the flow does", "  happens inside this:", "", "+die outline + I/O pads",
                    "+core (inner box)", "+power ring (red)", "+macros (blue)", "+the standard-cell area", "", "set here, before any",
                    "  cell is placed"]); },
      cap: "The floorplan is the physical frame every later stage works " +
           "inside: the die and its ring of I/O pads, the core, the power " +
           "ring, the hard macros, and the area left for standard cells. " +
           "All of it is fixed before a single cell is placed." }],
      w: 17, speed: 2000 };
  };

  BUILD["fp-die"] = function () {
    return { frames: [{ paint: function (ctx) { fpBg(ctx);
      fpR(ctx, 0.8, 0.8, 7.4, 7.4, "#f4ecdf", INK, 2);         /* die filled (periphery) */
      fpPads(ctx, 0.8, 0.8, 8.2, 8.2);
      fpR(ctx, 2.1, 2.1, 4.8, 4.8, "#fdfdfd", "#2f6fed", 1.6); /* core */
      fpTB(ctx, 4.5, 1.5, "die area", "#8a6d3b", 12);
      fpTB(ctx, 4.5, 4.5, "core area", BLUE, 13);
      fpT(ctx, 4.5, 7.6, "I/O periphery", "#8a6d3b", 11);
      fpPanel(ctx, ["die vs core", "the DIE is the whole", "  piece of silicon", "the CORE is the inner box",
                    "  where cells and macros go", "", "the band between them is", "  the I/O periphery, holding",
                    "  the pads (gray)", "", "+utilization is measured", "  against the CORE"]); },
      cap: "The die is the whole piece of silicon; the core is the inner " +
           "box where standard cells and macros go. The band between them " +
           "is the I/O periphery that carries the pads. Utilization and " +
           "placement are all measured against the core." }],
      w: 17, speed: 2000 };
  };

  BUILD["fp-aspect"] = function () {
    return { frames: [
      { paint: function (ctx) { fpBg(ctx);
        fpR(ctx, 0.8, 2.4, 3.0, 3.0, "#eef1f6", INK, 1.8); fpTB(ctx, 2.3, 3.9, "1 : 1", INK, 13); fpT(ctx, 2.3, 5.9, "square core", MUT, 11);
        fpR(ctx, 5.3, 1.4, 2.0, 5.0, "#eef1f6", INK, 1.8); fpTB(ctx, 6.3, 3.9, "1 : 2.5", INK, 13); fpT(ctx, 6.3, 6.9, "tall core", MUT, 11);
        fpPanel(ctx, ["aspect ratio", "the width-to-height ratio", "  of the core", "", "+a near-square core is the",
                      "  usual default", "+a tall or wide shape is", "  chosen to abut neighbors", "  or fit a package", "",
                      "same area, different shape"]); },
        cap: "Aspect ratio is the width-to-height ratio of the core. A " +
             "near-square core is the usual default; a deliberately tall " +
             "or wide shape is chosen when the block must abut its " +
             "neighbors or fit a package outline. Both cores here hold the " +
             "same area." },
      { paint: function (ctx) { fpBg(ctx);
        fpR(ctx, 0.8, 1.8, 3.4, 4.0, "#fdfdfd", INK, 1.8); fpDots(ctx, 1.0, 4.2, 4.0, 5.5, null); fpTB(ctx, 2.5, 6.4, "~60%", GREEN_DEEP, 13); fpT(ctx, 2.5, 1.4, "room to route", MUT, 11);
        fpR(ctx, 5.0, 1.8, 3.4, 4.0, "#fdfdfd", INK, 1.8); fpDots(ctx, 5.2, 2.1, 8.2, 5.6, null); fpTB(ctx, 6.7, 6.4, "~90%", RED, 13); fpT(ctx, 6.7, 1.4, "congested", RED, 11);
        fpPanel(ctx, ["utilization", "cell area / core area", "", "+low fill (left): room for",
                      "  wires, easy timing", "!high fill (right): less", "  routing space, the router", "  congests", "",
                      "typical start is 60-80%"]); },
        cap: "Utilization is cell area divided by core area. A lower fill " +
             "leaves room for wires and eases timing; a very high fill " +
             "packs the design into less silicon but congests the router. " +
             "Designs usually start in the 60 to 80 percent range." }
    ], w: 17, speed: 2600 };
  };

  BUILD["fp-macros"] = function () {
    return { frames: [
      { paint: function (ctx) { fpBg(ctx);
        fpR(ctx, 0.8, 0.9, 8.0, 7.4, "#fdfdfd", INK, 1.8);
        fpR(ctx, 3.1, 3.0, 1.7, 1.5, "#dfe9f5", BLUE, 1.6); fpTB(ctx, 3.95, 3.75, "macro", BLUE, 11);
        fpR(ctx, 5.0, 4.7, 1.6, 1.5, "#dfe9f5", BLUE, 1.6); fpTB(ctx, 5.8, 5.45, "macro", BLUE, 11);
        fpT(ctx, 4.7, 1.6, "macros in the center wall off routing", RED, 11);
        fpPanel(ctx, ["a poor macro placement", "macros dropped in the", "  middle of the core", "",
                      "!they split the cell area", "  and block wires from", "  crossing", "", "the cells and the router",
                      "  have to detour around"]); },
        cap: "Macros dropped in the center of the core split the cell " +
             "area and block wires from crossing, forcing long detours. " +
             "Where the macros sit is the first thing a floorplan gets " +
             "right or wrong." },
      { paint: function (ctx) { fpBg(ctx);
        fpR(ctx, 0.8, 0.9, 8.0, 7.4, "#fdfdfd", INK, 1.8);
        fpR(ctx, 0.95, 1.05, 2.2, 2.4, "#dfe9f5", BLUE, 1.6); fpR(ctx, 0.82, 0.92, 2.46, 2.66, null, "#8a6d3b", 1.2, [4, 3]); fpTB(ctx, 2.05, 2.25, "macro", BLUE, 11);
        fpR(ctx, 6.4, 5.5, 2.2, 2.4, "#dfe9f5", BLUE, 1.6); fpR(ctx, 6.27, 5.37, 2.46, 2.66, null, "#8a6d3b", 1.2, [4, 3]); fpTB(ctx, 7.5, 6.7, "macro", BLUE, 11);
        fpDots(ctx, 3.5, 1.2, 8.4, 4.9, null); fpDots(ctx, 1.1, 4.0, 5.9, 7.9, null);
        /* pins toward logic */
        ctx.strokeStyle = GREEN_DEEP; ctx.lineWidth = 2;
        [2.4, 2.8, 3.2].forEach(function (y) { ctx.beginPath(); ctx.moveTo(3.17 * CS, y * CS); ctx.lineTo(3.6 * CS, y * CS); ctx.stroke(); });
        fpT(ctx, 4.9, 1.35, "macros at the edges, halos (dashed), pins inward", GREEN_DEEP, 11);
        fpPanel(ctx, ["a good macro placement", "+push macros to the core", "  edges and corners", "+a keepout HALO (dashed)",
                      "  reserves pin space", "+orient pins toward the", "  logic that uses them", "", "the center stays open for",
                      "  cells and routing"]); },
        cap: "Placed at the edges and corners, with a keepout halo " +
             "(dashed) reserving pin space and their pins turned toward " +
             "the logic that uses them, the macros leave the center open " +
             "for cells and routing." }
    ], w: 17, speed: 2600 };
  };

  BUILD["fp-partition"] = function () {
    var nodes = [[1.5, 2.0], [2.4, 3.4], [1.7, 5.2], [3.0, 6.2], [2.6, 1.6], [6.0, 2.2], [7.0, 3.6], [6.3, 5.4], [7.4, 6.0], [5.6, 4.2]];
    function dot(ctx, p, col) { ctx.fillStyle = col || INK; ctx.beginPath(); ctx.arc(p[0] * CS, p[1] * CS, 4.5, 0, Math.PI * 2); ctx.fill(); }
    function edge(ctx, a, b, col, w) { ctx.strokeStyle = col; ctx.lineWidth = w || 1.4; ctx.beginPath(); ctx.moveTo(nodes[a][0] * CS, nodes[a][1] * CS); ctx.lineTo(nodes[b][0] * CS, nodes[b][1] * CS); ctx.stroke(); }
    var internalA = [[0, 1], [1, 2], [2, 3], [0, 4], [1, 4], [1, 3]];
    var internalB = [[5, 6], [6, 7], [7, 8], [5, 9], [9, 6], [9, 7]];
    var cross = [[1, 9], [3, 8]];
    return { frames: [
      { paint: function (ctx) { fpBg(ctx);
        fpR(ctx, 0.8, 0.9, 8.0, 6.6, "#fdfdfd", INK, 1.8);
        internalA.concat(internalB).concat(cross).forEach(function (e) { edge(ctx, e[0], e[1], "rgba(26,29,38,0.35)"); });
        nodes.forEach(function (p) { dot(ctx, p); });
        fpT(ctx, 4.8, 7.2, "one flat block: connections run everywhere", MUT, 11);
        fpPanel(ctx, ["before partitioning", "a large design as one", "  flat block", "", "the logic and its", "  connections are tangled",
                      "  across the whole area", "", "too big to floorplan or", "  implement at once"]); },
        cap: "A large design as one flat block has its logic and " +
             "connections tangled across the whole area, too big to " +
             "floorplan or implement in one piece." },
      { paint: function (ctx) { fpBg(ctx);
        fpR(ctx, 0.8, 0.9, 3.6, 6.6, "#eef6ee", GREEN_DEEP, 1.6); fpTB(ctx, 2.5, 1.35, "block A", GREEN_DEEP, 11);
        fpR(ctx, 5.0, 0.9, 3.8, 6.6, "#eef1f6", BLUE, 1.6); fpTB(ctx, 6.9, 1.35, "block B", BLUE, 11);
        internalA.forEach(function (e) { edge(ctx, e[0], e[1], "rgba(21,128,61,0.5)"); });
        internalB.forEach(function (e) { edge(ctx, e[0], e[1], "rgba(47,111,237,0.5)"); });
        cross.forEach(function (e) { edge(ctx, e[0], e[1], RED, 2.4); });
        nodes.forEach(function (p, k) { dot(ctx, p, k < 5 ? GREEN_DEEP : BLUE); });
        fpT(ctx, 4.8, 7.2, "only 2 nets cross (red)", RED, 11);
        fpPanel(ctx, ["after partitioning", "group heavily-connected", "  logic into blocks", "", "+most connections stay",
                      "  INSIDE a block", "!only a few cross between", "  them (red)", "", "each block is floorplanned",
                      "  and built on its own"]); },
        cap: "Partitioning groups heavily-connected logic into blocks so " +
             "that most connections stay inside a block and only a few " +
             "cross between them (red). Each block is then floorplanned " +
             "and implemented on its own, then assembled." }
    ], w: 17, speed: 2600 };
  };

  BUILD["fp-pdn"] = function () {
    var VDD = RED, VSS = "#37475a", core = { x: 0.8, y: 0.9, w: 7.5, h: 7.1 };
    var macros = [[5.7, 1.2, 2.5, 2.2], [0.85, 5.75, 2.2, 2.05]];
    function rowsRails(ctx) {
      fpR(ctx, core.x, core.y, core.w, core.h, "#fdfdfd", INK, 1.8);
      var i;
      for (i = 0; i < 12; i++) fpR(ctx, core.x, 1.18 + i * 0.58, core.w, 0.48, "#eef0f3");   /* cell rows */
      for (i = 0; i < 13; i++) fpR(ctx, core.x, 1.13 + i * 0.58, core.w, 0.08, i % 2 ? VDD : VSS); /* M1 follow pins */
    }
    function drawMacros(ctx) {
      macros.forEach(function (m) {
        fpR(ctx, m[0], m[1], m[2], m[3], "#dbe4f2", BLUE, 1.6);
        fpTB(ctx, m[0] + m[2] / 2, m[1] + m[3] / 2, "macro", BLUE, 11);
        /* macro power pins on its top edge */
        [0.4, 0.9, 1.4, 1.9].forEach(function (dx) { if (dx < m[2]) fpR(ctx, m[0] + dx, m[1] - 0.02, 0.1, 0.16, (dx * 10) % 2 ? VDD : VSS); });
      });
    }
    function m2(ctx) {
      for (var i = 0; i < 7; i++) { var x = 1.4 + i * 1.02; fpR(ctx, x, core.y, 0.13, core.h, i % 2 ? "rgba(220,38,38,0.7)" : "rgba(55,71,90,0.7)"); }
      ctx.fillStyle = "#1a1d26";
      for (var i2 = 0; i2 < 7; i2++) for (var j = 0; j < 13; j += 2) { var vx = 1.4 + i2 * 1.02; fpR(ctx, vx - 0.01, 1.13 + j * 0.58, 0.15, 0.08, "#1a1d26"); }
    }
    function upper(ctx) {
      [2.1, 4.4, 6.7].forEach(function (y, k) { fpR(ctx, core.x, y, core.w, 0.3, k % 2 ? "rgba(55,71,90,0.85)" : "rgba(220,38,38,0.85)"); });
    }
    function top(ctx) {
      [2.6, 5.5].forEach(function (x, k) { fpR(ctx, x, core.y, 0.52, core.h, k % 2 ? "rgba(55,71,90,0.92)" : "rgba(220,38,38,0.92)"); });
      fpR(ctx, core.x + 0.1, core.y + 0.1, core.w - 0.2, core.h - 0.2, null, VDD, 3.2);
      /* bumps landing on the top straps */
      [1.6, 3.2, 4.8, 6.4].forEach(function (y) {
        [2.86, 5.76].forEach(function (x) { ctx.beginPath(); ctx.arc(x * CS, y * CS, 7, 0, Math.PI * 2); ctx.fillStyle = "#c8a24a"; ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.2; ctx.stroke(); });
      });
    }
    return { frames: [
      { paint: function (ctx) { fpBg(ctx); rowsRails(ctx); drawMacros(ctx);
        fpTB(ctx, 4.6, 0.55, "M1 follow pins run along every cell row", INK, 11);
        fpPanel(ctx, ["layer 1: the follow pins", "power starts at the bottom", "", "+every standard-cell ROW",
                      "  carries a VDD rail (red)", "  and a VSS rail (dark) on", "  M1 (Metal 1): the follow", "  pins", "",
                      "+macros bring their own", "  power pins into the grid"]); },
        cap: "Power delivery is built from the bottom up. It starts at the " +
             "follow pins: the M1 (Metal 1) rails that run along every " +
             "standard-cell row, one for VDD (red) and one for VSS (dark). " +
             "Macros bring their own power pins into the grid." },
      { paint: function (ctx) { fpBg(ctx); rowsRails(ctx); drawMacros(ctx); m2(ctx);
        fpTB(ctx, 4.6, 0.55, "M2 stripes tap every follow pin (vias)", INK, 11);
        fpPanel(ctx, ["layer 2: vertical stripes", "+M2 (Metal 2) stripes run", "  the OTHER direction,",
                      "  across the rows", "+vias (dark) drop from each", "  stripe onto the follow", "  pins below", "",
                      "this ties all the rails of", "  each net together"]); },
        cap: "Vertical M2 (Metal 2) stripes run across the rows and tap " +
             "every follow pin through vias (dark), tying all the rails of " +
             "each net together into a connected grid." },
      { paint: function (ctx) { fpBg(ctx); rowsRails(ctx); drawMacros(ctx); m2(ctx); upper(ctx);
        fpTB(ctx, 4.6, 0.55, "upper layers: wider, sparser straps", INK, 11);
        fpPanel(ctx, ["layer 3: upper straps", "+higher metals carry FEWER,", "  WIDER straps", "+they alternate direction",
                      "  again and route OVER the", "  macros", "", "wide metal means low", "  resistance, so current",
                      "  spreads with little IR", "  drop"]); },
        cap: "Higher metal layers carry fewer, wider straps, alternating " +
             "direction again and routing over the macros. Wide metal has " +
             "low resistance, so current spreads across the die with " +
             "little IR (current times resistance) drop." },
      { paint: function (ctx) { fpBg(ctx); rowsRails(ctx); drawMacros(ctx); m2(ctx); upper(ctx); top(ctx);
        fpTB(ctx, 4.6, 0.55, "top layer: widest straps, ring, and bumps", INK, 11);
        fpPanel(ctx, ["layer 4: top + bumps", "+the TOP layer holds the", "  widest straps and the", "  RING around the core",
                      "+package BUMPS (gold) land", "  on it", "", "current flows bumps -> top", "  -> stripes -> follow pins",
                      "  -> every cell"]); },
        cap: "The top layer holds the widest straps and the ring, and the " +
             "package bumps (gold) land on it. Current flows from the " +
             "bumps down through the stripes to the follow pins and into " +
             "every cell, the full path the grid must carry within its " +
             "IR-drop and electromigration limits." }
    ], w: 17, speed: 2600 };
  };

  BUILD["fp-io"] = function () {
    return { frames: [{ paint: function (ctx) { fpBg(ctx);
      fpR(ctx, 1.4, 0.9, 7.0, 7.2, "#fdfdfd", INK, 1.8);
      var pins = [1.9, 3.0, 5.3, 6.8];
      pins.forEach(function (y) { fpR(ctx, 1.24, y, 0.32, 0.5, "#374151"); });
      /* good: short green wires to nearby cells */
      ctx.strokeStyle = GREEN_DEEP; ctx.lineWidth = 2;
      [[1.9, 2.5], [3.0, 3.1], [5.3, 5.2]].forEach(function (p) {
        ctx.beginPath(); ctx.moveTo(1.56 * CS, (p[0] + 0.25) * CS); ctx.lineTo(p[1] * CS, (p[0] + 0.25) * CS); ctx.stroke();
        ctx.fillStyle = GREEN_DEEP; fpR(ctx, p[1], p[0] + 0.05, 0.4, 0.4, "#eef6ee", GREEN_DEEP, 1.4);
      });
      /* bad: one long red wire across the block */
      ctx.strokeStyle = RED; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(1.56 * CS, 7.05 * CS); ctx.lineTo(7.6 * CS, 7.05 * CS); ctx.stroke();
      fpR(ctx, 7.6, 6.85, 0.4, 0.4, "#fde7e7", RED, 1.4);
      fpT(ctx, 5.6, 6.75, "far pin -> long wire", RED, 10);
      fpTB(ctx, 4.9, 0.6, "pins on the boundary, near their logic", INK, 11);
      fpPanel(ctx, ["I/O and pin placement", "pins sit on the block's", "  boundary", "", "+place each pin NEAR the",
                    "  logic it connects to:", "  short wire (green)", "!a pin far from its logic", "  costs a long wire (red)", "",
                    "for a sub-block, pins are", "  a contract with the top"]); },
      cap: "Pins sit on the block boundary. Placing each pin near the " +
           "logic it connects to keeps the wire short (green); a pin far " +
           "from its logic costs a long wire across the block (red). For a " +
           "sub-block, the pin locations are a contract with the parent " +
           "design." }],
      w: 17, speed: 2000 };
  };

  BUILD["fp-blockages"] = function () {
    return { frames: [{ paint: function (ctx) { fpBg(ctx);
      fpR(ctx, 0.8, 0.9, 8.0, 7.2, "#fdfdfd", INK, 1.8);
      fpDots(ctx, 1.1, 1.2, 8.4, 7.6, [[2.6, 2.2, 2.2, 1.8], [5.4, 4.6, 2.6, 2.4]]);
      /* hard blockage: hatched box */
      fpR(ctx, 2.6, 2.2, 2.2, 1.8, "#f4ecdf", "#8a6d3b", 1.6);
      ctx.strokeStyle = "rgba(138,109,59,0.5)"; ctx.lineWidth = 1;
      for (var d = 0; d < 8; d++) { ctx.beginPath(); ctx.moveTo((2.6 + d * 0.32) * CS, 2.2 * CS); ctx.lineTo((2.6) * CS, (2.2 + d * 0.32) * CS); ctx.stroke(); }
      fpTB(ctx, 3.7, 3.1, "blockage", "#8a6d3b", 11);
      /* region: dashed box grouping cells */
      fpR(ctx, 5.4, 4.6, 2.6, 2.4, null, PURPLE, 1.8, [5, 3]); fpTB(ctx, 6.7, 5.8, "region", PURPLE, 11);
      fpTB(ctx, 4.8, 0.6, "blockages keep cells out; regions pin them in", INK, 11);
      fpPanel(ctx, ["blockages and regions", "+a BLOCKAGE (hatched) keeps", "  cells out of an area, e.g.",
                    "  over a macro or analog", "+a REGION (dashed) pins a", "  group of related cells", "  into one area", "",
                    "both shape density and", "  timing before placement"]); },
      cap: "A blockage (hatched) keeps cells out of an area, for instance " +
           "over a macro or a sensitive analog region. A region (dashed) " +
           "pins a group of related cells into one place. Both shape " +
           "density and timing before placement begins." }],
      w: 17, speed: 2000 };
  };

  BUILD["fp-quality"] = function () {
    function heat(ctx, x0, y0, vals) {
      for (var r = 0; r < 5; r++) for (var c = 0; c < 5; c++) {
        var v = vals[r][c]; var col = v > 0.75 ? "rgba(220,38,38,0.7)" : v > 0.5 ? "rgba(217,119,6,0.55)" : "rgba(22,163,74,0.4)";
        fpR(ctx, x0 + c * 0.66, y0 + r * 0.66, 0.62, 0.62, col);
      }
      fpR(ctx, x0, y0, 3.3, 3.3, null, INK, 1.5);
    }
    var bad = [[.3,.4,.9,.5,.3],[.4,.8,.95,.8,.4],[.3,.85,.98,.85,.3],[.3,.6,.85,.6,.3],[.2,.3,.5,.3,.2]];
    var good = [[.45,.5,.5,.45,.5],[.5,.55,.5,.55,.5],[.5,.5,.55,.5,.5],[.45,.55,.5,.5,.45],[.5,.45,.5,.5,.5]];
    return { frames: [
      { paint: function (ctx) { fpBg(ctx); heat(ctx, 1.2, 2.4, bad);
        fpTB(ctx, 2.85, 6.4, "hot spot", RED, 12); fpT(ctx, 2.85, 1.7, "congestion map", MUT, 11);
        fpPanel(ctx, ["a weak floorplan", "a bad frame forces wires", "  to pile into one area", "", "!the congestion map shows",
                      "  a red HOT SPOT the router", "  cannot resolve", "", "placement and routing", "  cannot fix a floorplan",
                      "  this crowded"]); },
        cap: "A weak floorplan forces wires to pile into one area, and the " +
             "congestion map shows a red hot spot the router cannot " +
             "resolve. No amount of good placement or routing can rescue a " +
             "floorplan this crowded." },
      { paint: function (ctx) { fpBg(ctx); heat(ctx, 1.2, 2.4, good);
        fpTB(ctx, 2.85, 6.4, "even demand", GREEN_DEEP, 12); fpT(ctx, 2.85, 1.7, "congestion map", MUT, 11);
        fpPanel(ctx, ["a good floorplan", "a strong frame spreads the", "  wiring demand evenly", "", "+the congestion map is",
                      "  green everywhere: the", "  router has room", "", "this is what floorplanning", "  is judged on"]); },
        cap: "A strong floorplan spreads the wiring demand evenly, and the " +
             "congestion map stays green everywhere, so the router has " +
             "room to work. Enabling this is what the floorplan is judged " +
             "on." }
    ], w: 17, speed: 2600 };
  };

  BUILD["fp-flipchip"] = function () {
    return { frames: [{ paint: function (ctx) { fpBg(ctx);
      fpR(ctx, 0.8, 0.9, 7.8, 7.4, "#fdfdfd", INK, 2);          /* die, face-down */
      var cols = 8, rows = 7, x0 = 1.5, y0 = 1.7, sx = (8.0 - x0) / (cols - 1), sy = (7.7 - y0) / (rows - 1);
      for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
        var x = x0 + c * sx, y = y0 + r * sy, k = (r + c) % 4;
        var col = k === 0 ? RED : (k === 2 ? "#374151" : "#aeb4c0");
        ctx.beginPath(); ctx.arc(x * CS, y * CS, 8.5, 0, Math.PI * 2);
        ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.3; ctx.stroke();
      }
      fpTB(ctx, 4.7, 0.6, "solder bumps: an array over the whole die", INK, 11);
      fpPanel(ctx, ["flip-chip I/O", "the die is flipped and", "  bonded face-down to the", "  package", "",
                    "+bumps cover the WHOLE area,", "  not just the edge", "+red = power, dark = ground,", "  gray = signal", "",
                    "more I/O, and power drops", "  in everywhere: less", "  IR drop"]); },
      cap: "In a flip-chip part the die is flipped and bonded face-down " +
           "to the package through an area array of solder bumps that " +
           "covers the whole die, not just its edge. That gives far more " +
           "I/O, and because power can drop in anywhere across the area, a " +
           "stronger supply with less IR drop than edge bonding." }],
      w: 17, speed: 2000 };
  };

  /* ----- quine-mccluskey: primes by merging, then a minimum cover ----- */

  BUILD["quine-mccluskey"] = function () {
    var MS = [0, 1, 2, 5, 6, 7, 8, 9, 10, 14], NV = 4, VARS = "ABCD";
    var ON = {};
    MS.forEach(function (m) { ON[m] = true; });
    function bits(m) { var s = ""; for (var k = NV - 1; k >= 0; k--) s += (m >> k) & 1; return s; }
    function onesIn(t) { return t.split("").filter(function (c) { return c === "1"; }).length; }
    function lit(t) {
      var o = "";
      for (var k = 0; k < NV; k++) if (t[k] !== "-") o += VARS[k] + (t[k] === "0" ? "'" : "");
      return o;
    }
    /* one merging pass: terms that differ in exactly one bit (dashes aligned) */
    function mergePass(list) {
      var out = [], seen = {}, used = {};
      for (var a = 0; a < list.length; a++) for (var b = a + 1; b < list.length; b++) {
        var x = list[a].t, y = list[b].t, diff = -1, count = 0;
        for (var k = 0; k < NV; k++) {
          if (x[k] !== y[k]) {
            if (x[k] === "-" || y[k] === "-") { count = 9; break; }
            count++; diff = k;
          }
        }
        if (count !== 1) continue;
        var t = x.slice(0, diff) + "-" + x.slice(diff + 1);
        used[a] = used[b] = true;
        if (!seen[t]) {
          seen[t] = true;
          out.push({ t: t, ms: list[a].ms.concat(list[b].ms).sort(function (p, q) { return p - q; }) });
        }
      }
      return { out: out, used: used };
    }
    var L0 = MS.map(function (m) { return { t: bits(m), ms: [m] }; });
    L0.sort(function (p, q) { return onesIn(p.t) - onesIn(q.t) || p.ms[0] - q.ms[0]; });
    var P1 = mergePass(L0), P2 = mergePass(P1.out), P3 = mergePass(P2.out);
    var primes = [];
    [[L0, P1.used], [P1.out, P2.used], [P2.out, P3.used]].forEach(function (lv) {
      lv[0].forEach(function (e, idx) { if (!lv[1][idx]) primes.push(e); });
    });
    primes.sort(function (p, q) { return q.ms.length - p.ms.length || (p.t < q.t ? 1 : -1); });
    var PCOL = { "B'C'": GREEN, "B'D'": AMBER, "CD'": BLUE, "A'C'D": TEAL, "A'BD": PURPLE, "A'BC": RED };
    function col(p) { return PCOL[lit(p.t)] || MUT; }
    function byName(n) { return primes.filter(function (p) { return lit(p.t) === n; })[0]; }

    /* ---- drawing ---- */
    var KX = 44, KY = 78, KC = 40;
    var CODES = ["00", "01", "11", "10"];
    function txt(ctx, s, x, y, color, size, bold, align) {
      ctx.fillStyle = color || INK;
      ctx.font = (bold ? "bold " : "") + (size || 11) + "px 'JetBrains Mono', monospace";
      ctx.textAlign = align || "left";
      ctx.textBaseline = "middle";
      ctx.fillText(s, x, y);
    }
    function clear(ctx, title) {
      ctx.fillStyle = "#fdfdfd";
      ctx.fillRect(0, 0, 18 * CS, 12 * CS);
      txt(ctx, "f(A,B,C,D) = Σ m(0, 1, 2, 5, 6, 7, 8, 9, 10, 14)", 14, 18, INK, 12, true);
      if (title) txt(ctx, title, 14, 40, MUT, 11);
    }
    function cellXY(m) {
      var s = bits(m);
      return { r: CODES.indexOf(s.slice(0, 2)), c: CODES.indexOf(s.slice(2)) };
    }
    function runs(idx) {
      idx = idx.slice().sort();
      var res = [], s = idx[0], p = idx[0];
      for (var k = 1; k < idx.length; k++) {
        if (idx[k] === p + 1) p = idx[k];
        else { res.push([s, p]); s = p = idx[k]; }
      }
      res.push([s, p]);
      return res;
    }
    function rrect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
    }
    function group(ctx, p, inset) {
      var rows = [], cols = [];
      CODES.forEach(function (code, i) {
        if ((p.t[0] === "-" || p.t[0] === code[0]) && (p.t[1] === "-" || p.t[1] === code[1])) rows.push(i);
        if ((p.t[2] === "-" || p.t[2] === code[0]) && (p.t[3] === "-" || p.t[3] === code[1])) cols.push(i);
      });
      runs(rows).forEach(function (rr) {
        runs(cols).forEach(function (cc) {
          var x = KX + cc[0] * KC + inset, y = KY + rr[0] * KC + inset;
          var w = (cc[1] - cc[0] + 1) * KC - 2 * inset, h = (rr[1] - rr[0] + 1) * KC - 2 * inset;
          ctx.save();
          ctx.globalAlpha = 0.14; ctx.fillStyle = col(p); rrect(ctx, x, y, w, h, 8); ctx.fill();
          ctx.globalAlpha = 1; ctx.strokeStyle = col(p); ctx.lineWidth = 2.4; rrect(ctx, x, y, w, h, 8); ctx.stroke();
          ctx.restore();
        });
      });
    }
    function kmap(ctx, groups) {
      txt(ctx, "CD", KX + 2 * KC, KY - 26, MUT, 10, true, "center");
      txt(ctx, "AB", KX - 30, KY + 2 * KC, MUT, 10, true, "center");
      CODES.forEach(function (code, i) {
        txt(ctx, code, KX + i * KC + KC / 2, KY - 11, MUT, 10, false, "center");
        txt(ctx, code, KX - 12, KY + i * KC + KC / 2, MUT, 10, false, "center");
      });
      for (var m = 0; m < 16; m++) {
        var c = cellXY(m), x = KX + c.c * KC, y = KY + c.r * KC;
        ctx.fillStyle = "#ffffff"; ctx.fillRect(x, y, KC, KC);
        ctx.strokeStyle = "rgba(26,29,38,0.25)"; ctx.lineWidth = 1; ctx.strokeRect(x, y, KC, KC);
        txt(ctx, String(m), x + 4, y + 8, "rgba(26,29,38,0.4)", 8.5);
        txt(ctx, ON[m] ? "1" : "0", x + KC / 2, y + KC / 2 + 2, ON[m] ? INK : "rgba(26,29,38,0.22)", 14, ON[m], "center");
      }
      ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.strokeRect(KX, KY, 4 * KC, 4 * KC);
      (groups || []).forEach(function (g, i) { group(ctx, g, 3 + (i % 3) * 3); });
    }
    function tick(ctx, x, y, color) {
      ctx.save(); ctx.strokeStyle = color || GREEN; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x - 1, y + 3); ctx.lineTo(x + 5, y - 4); ctx.stroke(); ctx.restore();
    }
    var RX = 232;   /* the right-hand panel */
    function termList(ctx, list, x, y, ticked, lh, header) {
      if (header) txt(ctx, header, x, y - lh, MUT, 10, true);
      list.forEach(function (e, i) {
        var yy = y + i * lh;
        txt(ctx, e.t, x, yy, INK, 11, false);
        txt(ctx, "(" + e.ms.join(",") + ")", x + 42, yy, MUT, 10);
        if (ticked && ticked[i]) tick(ctx, x - 10, yy);
      });
    }

    /* the prime chart, with rows and columns picked out by state */
    var QX = 140, CX = QX + 68, CY = 96, CW = 22, CH = 24;   /* the chart, centred */
    function chart(ctx, state) {
      txt(ctx, "prime", QX, CY - 16, MUT, 10, true);
      MS.forEach(function (m, j) {
        var x = CX + j * CW + CW / 2;
        var hot = state.hotCols && state.hotCols.indexOf(m) >= 0;
        var done = state.covered && state.covered.indexOf(m) >= 0;
        if (hot) { ctx.fillStyle = "rgba(217,119,6,0.16)"; ctx.fillRect(CX + j * CW, CY - 26, CW, primes.length * CH + 30); }
        txt(ctx, String(m), x, CY - 16, done ? "rgba(26,29,38,0.3)" : INK, 10, !done, "center");
      });
      primes.forEach(function (p, i) {
        var y = CY + i * CH + CH / 2;
        var chosen = state.chosen && state.chosen.indexOf(lit(p.t)) >= 0;
        var dropped = state.dropped && state.dropped.indexOf(lit(p.t)) >= 0;
        if (chosen) { ctx.fillStyle = "rgba(22,163,74,0.12)"; ctx.fillRect(QX - 4, y - CH / 2 + 1, CX - QX + MS.length * CW + 4, CH - 2); }
        ctx.fillStyle = col(p); ctx.fillRect(QX, y - 5, 10, 10);
        txt(ctx, lit(p.t), QX + 16, y, dropped ? "rgba(26,29,38,0.35)" : INK, 11, chosen);
        MS.forEach(function (m, j) {
          if (p.ms.indexOf(m) < 0) return;
          var done = state.covered && state.covered.indexOf(m) >= 0 && !chosen;
          txt(ctx, "X", CX + j * CW + CW / 2, y, done || dropped ? "rgba(26,29,38,0.25)" : col(p), 11, true, "center");
        });
        if (dropped) { ctx.strokeStyle = "rgba(26,29,38,0.35)"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(QX + 14, y); ctx.lineTo(CX + MS.length * CW, y); ctx.stroke(); }
      });
      ctx.strokeStyle = "rgba(26,29,38,0.2)"; ctx.lineWidth = 1;
      ctx.strokeRect(CX, CY, MS.length * CW, primes.length * CH);
      if (state.note) txt(ctx, state.note, QX, CY + primes.length * CH + 20, INK, 11, true);
    }

    var groupsOf0 = [0, 1, 2, 3].map(function (g) { return L0.filter(function (e) { return onesIn(e.t) === g; }); });
    var quads = P2.out, pairs = P1.out;
    var essential = ["B'C'", "CD'"];
    var essCover = [0, 1, 8, 9, 2, 6, 10, 14];
    var frames = [];

    frames.push({ paint: function (ctx) {
      clear(ctx, "The function: its ones on a Karnaugh map");
      kmap(ctx, []);
      var y = 96;
      ["Ten input combinations make f = 1.", "", "Written as a sum of minterms:", "10 product terms,", "4 literals each,", "40 literals in all."].forEach(function (s, i) { txt(ctx, s, RX + 20, y + i * 20, i >= 3 ? INK : MUT, 11, i === 5); });
    }, cap: "The function. Its ones sit in ten cells of the map; the small number in each cell is its minterm. Written out as ten minterms it takes 40 literals. The goal is the fewest, largest product terms that still cover every one." });

    frames.push({ paint: function (ctx) {
      clear(ctx, "Step 1: write each minterm in binary, grouped by its number of ones");
      kmap(ctx, []);
      var y = 96;
      groupsOf0.forEach(function (g, gi) {
        txt(ctx, gi + " one" + (gi === 1 ? "" : "s"), RX + 20, y, MUT, 10, true);
        y += 17;
        g.forEach(function (e) { txt(ctx, e.t, RX + 40, y, INK, 11); txt(ctx, "(" + e.ms[0] + ")", RX + 84, y, MUT, 10); y += 17; });
        ctx.strokeStyle = "rgba(26,29,38,0.15)"; ctx.beginPath(); ctx.moveTo(RX + 20, y - 7); ctx.lineTo(RX + 150, y - 7); ctx.stroke();
        y += 4;
      });
    }, cap: "Step 1 starts by writing each minterm in binary and grouping it by how many ones it has. Two terms can merge only if they differ in exactly one bit, so only neighbouring groups ever need to be compared." });

    frames.push({ paint: function (ctx) {
      clear(ctx, "Step 1, first pass: merge terms that differ in one bit");
      termList(ctx, L0, 34, 96, L0.map(function () { return true; }), 19, "minterms");
      var half = Math.ceil(pairs.length / 2);
      termList(ctx, pairs.slice(0, half), 200, 96, null, 19, "pairs");
      termList(ctx, pairs.slice(half), 360, 96, null, 19, " ");
    }, cap: "Compare each group with the next. Terms that differ in one bit merge, and that bit becomes a dash: 0000 and 0001 give 000-. Every minterm merges at least once (ticked), so none of them is prime. The pass produces thirteen pairs." });

    frames.push({ paint: function (ctx) {
      clear(ctx, "Step 1, second pass: merge pairs whose dashes line up");
      var half = Math.ceil(pairs.length / 2);
      termList(ctx, pairs.slice(0, half), 34, 96, P2.used, 19, "pairs");
      termList(ctx, pairs.slice(half), 196, 96, pairs.slice(half).map(function (e, i) { return P2.used[i + half]; }), 19, " ");
      pairs.forEach(function (e, i) {
        if (P2.used[i]) return;
        var inFirst = i < half, row = inFirst ? i : i - half;
        txt(ctx, "prime", (inFirst ? 34 : 196) + 108, 96 + row * 19, RED, 10, true);
      });
      termList(ctx, quads, 368, 96, null, 19, "groups of four");
      quads.forEach(function (e, i) { txt(ctx, "prime", 368 + 124, 96 + i * 19, RED, 10, true); });
    }, cap: "Merge again, only between terms whose dashes are in the same place. Three groups of four appear. Three pairs never merge into anything larger, so 0-01, 01-1 and 011- are prime implicants, and the three groups of four cannot merge further, so they are prime too." });

    frames.push({ paint: function (ctx) {
      clear(ctx, "Six prime implicants");
      kmap(ctx, primes);
      primes.forEach(function (p, i) {
        var y = 100 + i * 26;
        ctx.fillStyle = col(p); ctx.fillRect(RX + 20, y - 6, 12, 12);
        txt(ctx, lit(p.t), RX + 40, y, INK, 12, true);
        txt(ctx, p.t + "  (" + p.ms.join(",") + ")", RX + 104, y, MUT, 10);
      });
    }, cap: "Step 1 ends with six prime implicants, drawn on the map. Each is a rectangle of ones that cannot grow without taking in a zero. A prime mark means the variable is 0: B'C' covers every input where B is 0 and C is 0." });

    frames.push({ paint: function (ctx) {
      clear(ctx, "Step 2: the prime chart, one row per prime and one column per minterm");
      chart(ctx, {});
    }, cap: "Step 2 chooses a cover. The chart has one row per prime and one column per minterm, and an X means the prime covers that minterm. The fewest rows must be chosen so that every column has an X in a chosen row." });

    frames.push({ paint: function (ctx) {
      clear(ctx, "Essential primes: the only cover of some minterm");
      chart(ctx, { hotCols: [9, 14], chosen: essential, covered: essCover, note: "B'C' and CD' are essential" });
    }, cap: "Minterm 9 is covered only by B'C', and minterm 14 only by CD'. Those two primes are essential: every cover has to use them. Together they cover eight of the ten minterms, which are greyed out." });

    frames.push({ paint: function (ctx) {
      clear(ctx, "What is left: minterms 5 and 7");
      chart(ctx, { hotCols: [5, 7], chosen: essential.concat(["A'BD"]), covered: essCover, dropped: ["B'D'"], note: "A'BD covers both with one term" });
    }, cap: "Only minterms 5 and 7 are left. B'D' is prime but covers nothing new, so it is not needed. A'BD covers both remaining minterms with one term, where A'C'D and A'BC would need two, so A'BD is chosen. On larger functions this last choice is a set-covering search." });

    frames.push({ paint: function (ctx) {
      clear(ctx, "The minimum sum of products");
      kmap(ctx, [byName("B'C'"), byName("CD'"), byName("A'BD")]);
      var y = 104;
      txt(ctx, "f = B'C' + CD' + A'BD", RX + 20, y, INK, 14, true);
      ["3 product terms instead of 10", "7 literals instead of 40", "", "As a circuit: three AND gates", "feeding one OR gate."].forEach(function (s, i) { txt(ctx, s, RX + 20, y + 34 + i * 20, i < 2 ? INK : MUT, 11, i < 2); });
    }, cap: "The minimum sum of products: f = B'C' + CD' + A'BD. Three terms and seven literals replace ten terms and forty. As a two-level circuit it is three AND gates feeding one OR gate." });

    return { frames: frames, w: 18, h: 12, speed: 3600 };
  };

  /* =========================================================
     shared helpers for the synthesis and finishing figures:
     text, boxes and a titled canvas, in the same style as the
     Quine-McCluskey figure
     ========================================================= */

  var SD = {
    W: 18, H: 12,
    txt: function (ctx, s, x, y, color, size, bold, align) {
      ctx.fillStyle = color || INK;
      ctx.font = (bold ? "bold " : "") + (size || 11) + "px 'JetBrains Mono', monospace";
      ctx.textAlign = align || "left";
      ctx.textBaseline = "middle";
      ctx.fillText(s, x, y);
    },
    clear: function (ctx, head, sub) {
      ctx.fillStyle = "#fdfdfd";
      ctx.fillRect(0, 0, SD.W * CS, SD.H * CS);
      if (head) SD.txt(ctx, head, 14, 18, INK, 12, true);
      if (sub) SD.txt(ctx, sub, 14, 40, MUT, 11);
    },
    box: function (ctx, x, y, w, h, stroke, fill, lw, r) {
      r = r === undefined ? 6 : r;
      ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1.5; ctx.stroke(); }
    },
    line: function (ctx, x1, y1, x2, y2, color, width, dash) {
      ctx.save();
      ctx.strokeStyle = color || INK; ctx.lineWidth = width || 1.5;
      if (dash) ctx.setLineDash(dash);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.restore();
    },
    arrow: function (ctx, x1, y1, x2, y2, color, width) {
      var a = Math.atan2(y2 - y1, x2 - x1), hl = 7;
      SD.line(ctx, x1, y1, x2, y2, color, width);
      ctx.fillStyle = color || INK;
      ctx.beginPath(); ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - hl * Math.cos(a - 0.4), y2 - hl * Math.sin(a - 0.4));
      ctx.lineTo(x2 - hl * Math.cos(a + 0.4), y2 - hl * Math.sin(a + 0.4));
      ctx.closePath(); ctx.fill();
    },
    /* a pill with centred text: for terms, cells and labels */
    chip: function (ctx, s, x, y, color, filled, size) {
      ctx.font = "bold " + (size || 11) + "px 'JetBrains Mono', monospace";
      var w = ctx.measureText(s).width + 14;
      SD.box(ctx, x, y - 10, w, 20, color, filled ? color : "rgba(255,255,255,0.9)", 1.6, 10);
      SD.txt(ctx, s, x + w / 2, y + 0.5, filled ? "#ffffff" : color, size || 11, true, "center");
      return w;
    },
    lines: function (ctx, list, x, y, lh, color, size) {
      list.forEach(function (s, i) {
        var bold = s.charAt(0) === "*";
        SD.txt(ctx, bold ? s.slice(1) : s, x, y + i * (lh || 18), color || INK, size || 11, bold);
      });
    }
  };

  /* ----- kernel extraction: kernels, their intersection, one shared divisor ----- */

  BUILD["kernel-extraction"] = function () {
    /* expressions as lists of cubes; a cube is a string of single-letter literals */
    var F = ["ac", "ad", "bc", "bd"], G = ["ce", "de"];
    function lits(expr) { var s = {}; expr.forEach(function (c) { c.split("").forEach(function (l) { s[l] = true; }); }); return Object.keys(s).sort(); }
    function has(cube, sub) { return sub.split("").every(function (l) { return cube.indexOf(l) >= 0; }); }
    function minus(cube, sub) { return cube.split("").filter(function (l) { return sub.indexOf(l) < 0; }).join("") || "1"; }
    function divide(expr, cube) { return expr.filter(function (c) { return has(c, cube); }).map(function (c) { return minus(c, cube); }); }
    function cubeFree(expr) {
      if (expr.length < 2) return false;
      return !lits(expr).some(function (l) { return expr.every(function (c) { return c.indexOf(l) >= 0; }); });
    }
    function show(expr) { return expr.join(" + "); }
    function nlit(expr) { return expr.reduce(function (n, c) { return n + (c === "1" ? 0 : c.length); }, 0); }
    /* every kernel: quotients by each co-kernel cube (all literal subsets), kept when cube-free */
    function kernels(expr) {
      var L = lits(expr), out = [], seen = {};
      for (var mask = 0; mask < (1 << L.length); mask++) {
        var cube = L.filter(function (l, i) { return mask & (1 << i); }).join("");
        var q = cube ? divide(expr, cube) : expr.slice();
        if (!cubeFree(q)) continue;
        var key = q.slice().sort().join("+");
        if (seen[key]) { seen[key].co.push(cube || "1"); continue; }
        seen[key] = { q: q, co: [cube || "1"] };
        out.push(seen[key]);
      }
      return out;
    }
    var KF = kernels(F), KG = kernels(G);
    var shared = KF.filter(function (k) {
      return KG.some(function (h) { return k.q.filter(function (c) { return h.q.indexOf(c) >= 0; }).length > 1; });
    })[0];
    var T = shared.q;                                   /* the divisor to extract */
    var before = nlit(F) + nlit(G);
    var after = nlit(T) + 3 + 2;                        /* t = c + d, f = (a + b) t, g = e t */

    var txt = SD.txt, frames = [];
    function exprs(ctx, y, hi) {
      txt(ctx, "f =", 40, y, INK, 13, true);
      var x = 76;
      F.forEach(function (c, i) {
        x += SD.chip(ctx, c, x, y, hi && hi.f && hi.f.indexOf(c) >= 0 ? BLUE : INK, hi && hi.f && hi.f.indexOf(c) >= 0, 12) + 4;
        if (i < F.length - 1) { txt(ctx, "+", x + 2, y, MUT, 12); x += 16; }
      });
      txt(ctx, "g =", 40, y + 36, INK, 13, true);
      x = 76;
      G.forEach(function (c, i) {
        x += SD.chip(ctx, c, x, y + 36, hi && hi.g && hi.g.indexOf(c) >= 0 ? PURPLE : INK, hi && hi.g && hi.g.indexOf(c) >= 0, 12) + 4;
        if (i < G.length - 1) { txt(ctx, "+", x + 2, y + 36, MUT, 12); x += 16; }
      });
    }

    frames.push({ paint: function (ctx) {
      SD.clear(ctx, "Kernel extraction: find a divisor two expressions share", "Two expressions, written flat as sums of products");
      exprs(ctx, 90);
      SD.lines(ctx, ["f has " + nlit(F) + " literals, g has " + nlit(G) + ".", "*" + before + " literals in all.", "", "Both contain c + d, but written flat", "that sharing is invisible."], 40, 176, 20);
    }, cap: "Two expressions written flat as sums of products: " + before + " literals between them. Both secretly contain the same factor, and the job is to find it and build it once." });

    frames.push({ paint: function (ctx) {
      SD.clear(ctx, "Divide f by the cube a", "Keep the terms of f that contain a, and strike the a out");
      exprs(ctx, 90, { f: ["ac", "ad"] });
      txt(ctx, "f ÷ a  =  " + show(divide(F, "a")), 40, 190, BLUE, 14, true);
      SD.lines(ctx, ["No single literal divides both c and d, so the quotient is cube-free:", "*c + d is a kernel of f, and a is its co-kernel.", "", "(The division is algebraic: f is treated as a polynomial,", " and Boolean rules such as a · a = a are not used.)"], 40, 232, 20);
    }, cap: "Divide f by the single cube a: keep the terms that contain a and strike the a out, leaving c + d. No single literal divides every term of c + d, so it is cube-free, which makes it a kernel of f with co-kernel a." });

    frames.push({ paint: function (ctx) {
      SD.clear(ctx, "Every kernel of f, and every kernel of g", "Divide by every cube; keep each quotient that is cube-free");
      txt(ctx, "kernels of f", 40, 80, MUT, 11, true);
      KF.forEach(function (k, i) { txt(ctx, show(k.q), 60, 104 + i * 24, BLUE, 12, true); txt(ctx, "co-kernel " + k.co.join(", "), 290, 104 + i * 24, MUT, 11); });
      var y0 = 104 + KF.length * 24 + 30;
      txt(ctx, "kernels of g", 40, y0 - 24, MUT, 11, true);
      KG.forEach(function (k, i) { txt(ctx, show(k.q), 60, y0 + i * 24, PURPLE, 12, true); txt(ctx, "co-kernel " + k.co.join(", "), 290, y0 + i * 24, MUT, 11); });
      txt(ctx, "g itself is not a kernel: e divides both of its terms.", 40, y0 + KG.length * 24 + 26, MUT, 11);
    }, cap: "Dividing by every cube gives all the kernels. f has " + KF.length + ": c + d, a + b, and f itself, which is already cube-free (co-kernel 1). g has one, c + d, with co-kernel e; g itself is not a kernel, because e divides both of its terms." });

    frames.push({ paint: function (ctx) {
      SD.clear(ctx, "Intersect the kernels", "A shared divisor must be a common part of two kernels");
      txt(ctx, "kernels of f", 40, 90, MUT, 11, true);
      KF.forEach(function (k, i) { var on = k === shared; txt(ctx, show(k.q), 60, 114 + i * 24, on ? GREEN : "rgba(26,29,38,0.35)", 12, true); });
      txt(ctx, "kernels of g", 330, 90, MUT, 11, true);
      KG.forEach(function (k, i) { txt(ctx, show(k.q), 350, 114 + i * 24, GREEN, 12, true); });
      var sy = 114 + KF.indexOf(shared) * 24;
      SD.line(ctx, 60 + 60, sy, 350 - 8, 114, GREEN, 2, [5, 4]);
      SD.box(ctx, 40, 212, 460, 58, GREEN, "rgba(22,163,74,0.08)", 1.6);
      txt(ctx, "Shared: " + show(T), 56, 232, GREEN, 13, true);
      txt(ctx, "two terms in common, so it can be built once and reused", 56, 254, INK, 11);
    }, cap: "Brayton and McMullen's theorem turns the search into set intersection: two expressions share a divisor with more than one term only if a kernel of one and a kernel of the other have more than one term in common. Here c + d is a kernel of both." });

    frames.push({ paint: function (ctx) {
      SD.clear(ctx, "Extract the divisor as a new node, and substitute it", "t = c + d is built once; f and g use it");
      /* a small network: t feeds f and g */
      function node(x, y, label, expr, color) {
        SD.box(ctx, x, y, 150, 50, color, "#ffffff", 2);
        txt(ctx, label, x + 12, y + 17, color, 12, true);
        txt(ctx, expr, x + 12, y + 35, INK, 11);
      }
      node(40, 150, "t", "t = c + d", GREEN);
      node(300, 86, "f", "f = (a + b) · t", BLUE);
      node(300, 214, "g", "g = e · t", PURPLE);
      SD.arrow(ctx, 190, 170, 298, 116, GREEN, 2);
      SD.arrow(ctx, 190, 180, 298, 234, GREEN, 2);
      ["c", "d"].forEach(function (s, i) { SD.arrow(ctx, 4, 162 + i * 26, 38, 166 + i * 18, MUT, 1.2); txt(ctx, s, 8, 154 + i * 26 - 6, MUT, 10); });
      txt(ctx, "literals: t 2 + f 3 + g 2 = " + after, 40, 300, INK, 12, true);
    }, cap: "Extract c + d as a new node t, then substitute it wherever it divides: f = at + bt, which factors to (a + b)t, and g = et. The network now needs " + after + " literals instead of " + before + ", and c + d is built once." });

    frames.push({ paint: function (ctx) {
      SD.clear(ctx, "Repeat until no divisor saves literals", "Then the network goes on to technology mapping");
      SD.lines(ctx, ["The optimizer loops:", "", "  1. compute the kernels of every node,", "  2. find the divisor that saves the most literals,", "  3. extract it as a new node and substitute it,", "  4. stop when no divisor saves anything.", "", "*" + before + " literals became " + after + ".", "", "Missed by design: factors that need Boolean rules,", "such as a · a' = 0 or the don't-cares of the logic around it."], 40, 84, 20);
    }, cap: "The optimizer repeats the loop: compute kernels, extract the divisor that saves the most literals, substitute it, and stop when nothing saves more. Algebraic division is fast because it ignores Boolean rules, and that is also what it misses." });

    return { frames: frames, w: SD.W, h: SD.H, speed: 3600 };
  };

  /* ----- and-inverter graph rewriting: a cut, its function, a smaller stored structure ----- */

  BUILD["aig-rewriting"] = function () {
    /* a graph: inputs, then AND nodes {id, a, b, na, nb} (na/nb: that input is inverted); out: [id, inverted] */
    var OLD = { ands: [
      { id: "n1", a: "a", b: "b" },
      { id: "n2", a: "a", b: "c" },
      { id: "n3", a: "n1", b: "n2", na: true, nb: true }
    ], out: ["n3", true] };
    var NEW = { ands: [
      { id: "m1", a: "b", b: "c", na: true, nb: true },
      { id: "m2", a: "a", b: "m1", nb: true }
    ], out: ["m2", false] };
    function evalG(g, env) {
      var v = { a: env.a, b: env.b, c: env.c };
      g.ands.forEach(function (n) { v[n.id] = (n.na ? !v[n.a] : v[n.a]) && (n.nb ? !v[n.b] : v[n.b]); });
      return g.out[1] ? !v[g.out[0]] : v[g.out[0]];
    }
    var ROWS = [];
    for (var k = 0; k < 8; k++) {
      var env = { a: !!(k & 4), b: !!(k & 2), c: !!(k & 1) };
      ROWS.push({ env: env, f: evalG(OLD, env), g: evalG(NEW, env) });
    }
    var SAME = ROWS.every(function (r) { return r.f === r.g; });

    var txt = SD.txt, frames = [];
    /* draw a graph from explicit positions */
    function graph(ctx, g, pos, hi, dim) {
      function inv(x1, y1, x2, y2) {
        var t = 0.82, x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
        ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill();
        ctx.strokeStyle = RED; ctx.lineWidth = 2; ctx.stroke();
      }
      g.ands.forEach(function (n) {
        [["a", "na"], ["b", "nb"]].forEach(function (e) {
          var s = pos[n[e[0]]], d = pos[n.id];
          SD.line(ctx, s.x, s.y - 12, d.x, d.y + 14, dim ? "rgba(26,29,38,0.3)" : INK, 1.6);
          if (n[e[1]]) inv(s.x, s.y - 12, d.x, d.y + 14);
        });
      });
      ["a", "b", "c"].forEach(function (i) {
        if (!pos[i]) return;
        SD.box(ctx, pos[i].x - 14, pos[i].y - 12, 28, 24, INK, "#fff", 1.6, 5);
        txt(ctx, i, pos[i].x, pos[i].y, INK, 12, true, "center");
      });
      g.ands.forEach(function (n) {
        var p = pos[n.id], on = hi && hi.indexOf(n.id) >= 0;
        ctx.beginPath(); ctx.arc(p.x, p.y, 15, 0, Math.PI * 2);
        ctx.fillStyle = on ? GREEN : (dim ? "#eef0f2" : "#fff"); ctx.fill();
        ctx.strokeStyle = dim ? "rgba(26,29,38,0.35)" : INK; ctx.lineWidth = 1.8; ctx.stroke();
        txt(ctx, "∧", p.x, p.y + 1, on ? "#fff" : INK, 14, true, "center");
        txt(ctx, n.id, p.x + 20, p.y - 12, MUT, 9.5);
      });
      var o = pos[g.out[0]];
      SD.arrow(ctx, o.x, o.y - 15, o.x, o.y - 44, dim ? "rgba(26,29,38,0.35)" : INK, 1.8);
      if (g.out[1]) inv(o.x, o.y - 15, o.x, o.y - 38);
      txt(ctx, "f", o.x + 10, o.y - 44, INK, 12, true);
    }
    var PO = { a: { x: 110, y: 300 }, b: { x: 50, y: 300 }, c: { x: 170, y: 300 }, n1: { x: 70, y: 215 }, n2: { x: 150, y: 215 }, n3: { x: 110, y: 130 } };
    var PN = { a: { x: 380, y: 300 }, b: { x: 440, y: 300 }, c: { x: 500, y: 300 }, m1: { x: 470, y: 215 }, m2: { x: 420, y: 130 } };
    function legend(ctx, x, y) {
      ctx.beginPath(); ctx.arc(x + 5, y, 5, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill(); ctx.strokeStyle = RED; ctx.lineWidth = 2; ctx.stroke();
      txt(ctx, "= inverted edge", x + 16, y, MUT, 10);
    }

    frames.push({ paint: function (ctx) {
      SD.clear(ctx, "And-inverter graph rewriting: f = ab + ac", "Every function built from two-input ANDs, with inversion on the edges");
      graph(ctx, OLD, PO);
      legend(ctx, 30, 340);
      SD.lines(ctx, ["An OR has no node of its own:", "ab + ac is built as", "NOT( NOT(ab) AND NOT(ac) ),", "by De Morgan's law.", "", "*3 AND nodes."], 260, 110, 20);
    }, cap: "Every function is built from one kind of node, a two-input AND, with inversion marked on the edges. The OR in f = ab + ac becomes an AND of two inverted inputs with an inverted output, by De Morgan's law, so this graph has three AND nodes." });

    frames.push({ paint: function (ctx) {
      SD.clear(ctx, "Structural hashing: identical logic is stored once", "Before a node is created, the graph is searched for one with the same inputs");
      graph(ctx, OLD, PO, ["n1"]);
      SD.lines(ctx, ["If another part of the design asks", "for AND(a, b), it gets n1 back", "instead of a new node.", "", "A hash table keyed by the two inputs", "(and their inversions) makes the", "check constant time."], 260, 110, 20);
    }, cap: "Structural hashing keeps the graph free of duplicates: before an AND node is created, a hash table keyed by its two inputs is checked, and an existing node such as n1 is returned instead of building a copy." });

    frames.push({ paint: function (ctx) {
      SD.clear(ctx, "Pick a node and a small cut", "The cut {a, b, c} separates n3 from the rest of the design");
      graph(ctx, OLD, PO, ["n1", "n2", "n3"]);
      ctx.save(); ctx.setLineDash([6, 4]); ctx.strokeStyle = AMBER; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(20, 262); ctx.lineTo(200, 262); ctx.stroke(); ctx.restore();
      txt(ctx, "cut", 204, 262, AMBER, 11, true);
      SD.lines(ctx, ["Everything between the cut and n3", "(three AND nodes) computes one", "function of three inputs.", "", "Rewriting enumerates cuts of up to", "four inputs at every node."], 260, 110, 20);
    }, cap: "At each node, rewriting enumerates small cuts: sets of at most four nodes that separate it from the rest of the logic. For n3 the cut {a, b, c} encloses all three AND nodes, which together compute one function of three inputs." });

    frames.push({ paint: function (ctx) {
      SD.clear(ctx, "Compute the function of the cut", "Evaluate the enclosed nodes for every input combination");
      txt(ctx, "a  b  c   f", 60, 84, MUT, 11, true);
      ROWS.forEach(function (r, i) {
        var y = 106 + i * 22;
        txt(ctx, (r.env.a ? 1 : 0) + "  " + (r.env.b ? 1 : 0) + "  " + (r.env.c ? 1 : 0), 60, y, INK, 12);
        txt(ctx, r.f ? "1" : "0", 60 + 96, y, r.f ? GREEN : MUT, 12, true);
      });
      SD.lines(ctx, ["f is 1 exactly when a is 1", "and at least one of b, c is 1:", "", "*f = a · (b + c)"], 260, 120, 20);
    }, cap: "The function the cut implements is found by evaluating the enclosed nodes for all eight input combinations. f is 1 exactly when a is 1 and at least one of b and c is 1, so f = a · (b + c)." });

    frames.push({ paint: function (ctx) {
      SD.clear(ctx, "Look up the best structure for that function", "Stored once, in advance, for every function of up to four inputs");
      graph(ctx, NEW, PN, [], false);
      SD.lines(ctx, ["a · (b + c) = a AND NOT( NOT b AND NOT c )", "", "*2 AND nodes.", "", "Up to permuting and inverting inputs", "and output, there are only 222 different", "four-input functions, so an optimal", "structure for each is precomputed."], 30, 110, 20);
    }, cap: "Up to permuting and inverting the inputs and the output, there are only 222 distinct functions of four inputs, and an optimal and-inverter structure for each is computed once and stored. For a · (b + c) the stored structure needs two AND nodes." });

    frames.push({ paint: function (ctx) {
      SD.clear(ctx, "Swap it in when it is smaller", SAME ? "Same truth table, one node fewer" : "(the two graphs disagree)");
      graph(ctx, OLD, PO, [], true);
      txt(ctx, "before: 3 nodes", 60, 350, MUT, 11, true);
      SD.arrow(ctx, 230, 200, 300, 200, GREEN, 2.5);
      graph(ctx, NEW, PN, ["m1", "m2"]);
      txt(ctx, "after: 2 nodes", 390, 350, GREEN, 11, true);
    }, cap: "The replacement uses fewer nodes than the logic it replaces, and its truth table is identical, so the swap is made and the graph shrinks by one node. Counting only the nodes that would really disappear, after sharing with the rest of the graph, keeps a swap from making things worse." });

    frames.push({ paint: function (ctx) {
      SD.clear(ctx, "Repeat, with balancing and refactoring", "The scripts that open-source synthesis runs");
      SD.lines(ctx, ["One pass visits every node and makes every profitable swap.", "Synthesis scripts alternate passes of:", "", "  rewriting    swap small cuts for stored optimal structures", "  balancing    rebuild AND trees to reduce depth (delay)", "  refactoring  collapse larger cuts and factor them again", "", "In the OpenROAD flow, ABC runs &syn2 (rewriting and balancing)", "between rounds of choice computation and mapping.", "", "*Local and structural: it never sees beyond a four-input cut."], 30, 86, 20);
    }, cap: "One pass makes every profitable swap. Synthesis scripts repeat it, interleaved with balancing, which reduces depth, and refactoring, which collapses larger cuts and factors them again. The method is fast because it is local, and that is also its limit." });

    return { frames: frames, w: SD.W, h: SD.H, speed: 3600 };
  };

  /* ----- tree covering: dynamic programming from the inputs to the root ----- */

  BUILD["tree-covering"] = function () {
    /* the subject tree for f = abc, in two-input NAND gates and inverters */
    var NODES = {
      n1: { op: "NAND", ins: ["a", "b"] },
      n2: { op: "INV", ins: ["n1"] },
      n3: { op: "NAND", ins: ["n2", "c"] },
      n4: { op: "INV", ins: ["n3"] }
    };
    var ORDER = ["n1", "n2", "n3", "n4"];
    /* the library: each cell as a pattern over the same gates, with its area */
    var LIB = [
      { name: "INV", area: 2, pat: { op: "INV", ins: ["*"] } },
      { name: "NAND2", area: 3, pat: { op: "NAND", ins: ["*", "*"] } },
      { name: "AND2", area: 4, pat: { op: "INV", ins: [{ op: "NAND", ins: ["*", "*"] }] } },
      { name: "NAND3", area: 4, pat: { op: "NAND", ins: [{ op: "INV", ins: [{ op: "NAND", ins: ["*", "*"] }] }, "*"] } },
      { name: "AND3", area: 7, pat: { op: "INV", ins: [{ op: "NAND", ins: [{ op: "INV", ins: [{ op: "NAND", ins: ["*", "*"] }] }, "*"] }] } }
    ];
    /* match a pattern rooted at a node: returns {leaves, covered} or null */
    function match(pat, id) {
      if (pat === "*") return { leaves: [id], covered: [] };
      var n = NODES[id];
      if (!n || n.op !== pat.op || n.ins.length !== pat.ins.length) return null;
      var leaves = [], covered = [id];
      for (var k = 0; k < pat.ins.length; k++) {
        var m = match(pat.ins[k], n.ins[k]);
        if (!m) return null;
        leaves = leaves.concat(m.leaves); covered = covered.concat(m.covered);
      }
      return { leaves: leaves, covered: covered };
    }
    var BEST = {}, CANDS = {};
    ORDER.forEach(function (id) {
      CANDS[id] = [];
      LIB.forEach(function (cell) {
        var m = match(cell.pat, id);
        if (!m) return;
        var below = m.leaves.reduce(function (s, l) { return s + (BEST[l] ? BEST[l].cost : 0); }, 0);
        CANDS[id].push({ cell: cell, leaves: m.leaves, covered: m.covered, cost: cell.area + below, below: below });
      });
      CANDS[id].sort(function (p, q) { return p.cost - q.cost; });
      BEST[id] = CANDS[id][0];
    });
    /* recover the cover from the root */
    var COVER = [];
    (function walk(id) {
      var b = BEST[id]; if (!b) return;
      COVER.push({ root: id, cell: b.cell, covered: b.covered });
      b.leaves.forEach(walk);
    })("n4");
    var TOTAL = BEST.n4.cost;

    var txt = SD.txt, frames = [];
    var P = { n4: { x: 120, y: 92 }, n3: { x: 120, y: 152 }, n2: { x: 90, y: 212 }, n1: { x: 90, y: 272 }, a: { x: 60, y: 334 }, b: { x: 120, y: 334 }, c: { x: 200, y: 212 } };
    var CCOL = [GREEN, BLUE, PURPLE, AMBER];
    function tree(ctx, state) {
      state = state || {};
      var owner = {};
      (state.cover || []).forEach(function (cv, i) { cv.covered.forEach(function (id) { owner[id] = CCOL[i % CCOL.length]; }); });
      ORDER.forEach(function (id) {
        NODES[id].ins.forEach(function (i) { SD.line(ctx, P[i].x, P[i].y - 11, P[id].x, P[id].y + 13, INK, 1.5); });
      });
      SD.arrow(ctx, P.n4.x, P.n4.y - 13, P.n4.x, P.n4.y - 38, INK, 1.5);
      txt(ctx, "f", P.n4.x + 8, P.n4.y - 38, INK, 12, true);
      ["a", "b", "c"].forEach(function (i) { SD.box(ctx, P[i].x - 12, P[i].y - 11, 24, 22, INK, "#fff", 1.5, 5); txt(ctx, i, P[i].x, P[i].y, INK, 11, true, "center"); });
      ORDER.forEach(function (id) {
        var p = P[id], cur = state.cur === id, col = owner[id];
        SD.box(ctx, p.x - 26, p.y - 13, 52, 26, cur ? AMBER : INK, col ? col : (cur ? "rgba(217,119,6,0.12)" : "#fff"), cur ? 2.4 : 1.5, 6);
        txt(ctx, NODES[id].op, p.x, p.y, col ? "#fff" : INK, 10.5, true, "center");
        txt(ctx, id, p.x - 44, p.y, MUT, 9.5, false, "center");
        if (state.done && state.done[id] !== undefined) txt(ctx, "best " + state.done[id], p.x + 32, p.y, GREEN, 10, true);
      });
    }
    var RX = 250;
    function done(upto) { var d = {}; ORDER.slice(0, upto).forEach(function (id) { d[id] = BEST[id].cost; }); return d; }
    function candidates(ctx, id) {
      txt(ctx, "matches with " + id + " as the root", RX, 90, MUT, 10.5, true);
      CANDS[id].forEach(function (c, i) {
        var y = 116 + i * 24, win = i === 0;
        var extra = c.leaves.filter(function (l) { return BEST[l]; }).map(function (l) { return "best(" + l + ")"; });
        txt(ctx, c.cell.name, RX, y, win ? GREEN : INK, 11.5, win);
        txt(ctx, c.cell.area + (extra.length ? " + " + extra.join(" + ") : "") + " = " + c.cost, RX + 64, y, win ? GREEN : INK, 11, win);
      });
      txt(ctx, "best(" + id + ") = " + BEST[id].cost + "  (" + BEST[id].cell.name + ")", RX, 116 + CANDS[id].length * 24 + 16, GREEN, 12, true);
    }

    frames.push({ paint: function (ctx) {
      SD.clear(ctx, "Tree covering: f = abc, in NAND gates and inverters", "The design as a tree of the same two gates the library is described in");
      tree(ctx);
      SD.lines(ctx, ["Before mapping, the design is decomposed", "into two-input NAND gates and inverters:", "", "  f = NOT( NAND( NOT(NAND(a, b)), c ) )", "", "Every library cell is described in the", "same gates, so mapping becomes covering", "this tree with cell patterns."], RX, 96, 20);
    }, cap: "Before mapping, the design is decomposed into two simple gates, two-input NAND and the inverter: here f = abc as a four-node tree. Every library cell is described in the same two gates, so mapping becomes a covering problem." });

    frames.push({ paint: function (ctx) {
      SD.clear(ctx, "The library, as patterns with areas", "A cell can cover every tree node its pattern matches");
      txt(ctx, "cell     area   pattern", 40, 84, MUT, 10.5, true);
      var pats = ["INV(x)", "NAND(x, y)", "INV(NAND(x, y))", "NAND(INV(NAND(x, y)), z)", "INV(NAND(INV(NAND(x, y)), z))"];
      LIB.forEach(function (c, i) {
        var y = 110 + i * 26;
        txt(ctx, c.name, 40, y, INK, 12, true);
        txt(ctx, String(c.area), 120, y, INK, 12);
        txt(ctx, pats[i], 168, y, MUT, 11);
      });
      SD.lines(ctx, ["Bigger cells cover more nodes at once, and usually cost less", "than the small cells they replace, but not always."], 40, 260, 20, MUT);
    }, cap: "The library, with each cell written as a pattern over the same two gates. A cell can cover a group of tree nodes whenever its pattern matches them: AND2 is an inverter on a NAND, NAND3 and AND3 are deeper patterns." });

    ORDER.forEach(function (id, i) {
      var caps = {
        n1: "Dynamic programming visits nodes from the inputs up. At n1 only NAND2 matches, and its inputs are primary inputs, so best(n1) = 3.",
        n2: "At n2 two cells match. An inverter on top of n1 costs 2 + best(n1) = 5, while AND2 covers n2 and n1 together for 4. best(n2) = 4, with AND2.",
        n3: "At n3, NAND2 on top of n2 costs 3 + best(n2) = 7, but NAND3 covers n3, n2 and n1 in one cell for 4. best(n3) = 4, with NAND3.",
        n4: "At the root, an inverter on the best cover of n3 costs 2 + 4 = 6; AND2 over n4 and n3 costs 4 + best(n2) = 8; one AND3 over everything costs 7. The inverter wins: best(n4) = 6."
      };
      frames.push({ paint: function (ctx) {
        SD.clear(ctx, "Node " + id + ": try every cell that matches here", "Cost of a match = its area + the best costs already found below it");
        tree(ctx, { cur: id, done: done(i) });
        candidates(ctx, id);
      }, cap: caps[id] });
    });

    frames.push({ paint: function (ctx) {
      SD.clear(ctx, "Walk back from the root to recover the cover", "Total area " + TOTAL + ", optimal for this tree");
      tree(ctx, { cover: COVER, done: done(4) });
      COVER.forEach(function (cv, i) {
        var y = 110 + i * 28;
        SD.box(ctx, RX, y - 9, 16, 18, null, CCOL[i % CCOL.length], 0, 4);
        txt(ctx, cv.cell.name + "  (area " + cv.cell.area + ")  covers " + cv.covered.join(", "), RX + 26, y, INK, 11.5, true);
      });
      SD.lines(ctx, ["*Total area " + TOTAL + ": NAND3 feeding an inverter.", "", "The single AND3 (area 7) and the chain", "NAND2, INV, NAND2, INV (area 10) both lose.", "Time is linear in the size of the tree."], RX, 190, 20);
    }, cap: "Walking back from the root recovers the chosen cells: an inverter at n4, fed by one NAND3 covering n3, n2 and n1. Total area " + TOTAL + ", beating both the single AND3 (7) and the gate-by-gate cover (10). Every node was visited once, so the time is linear in the size of the tree." });

    frames.push({ paint: function (ctx) {
      SD.clear(ctx, "The catch: real networks are not trees", "Shared logic cuts the design into trees, and each is covered separately");
      SD.lines(ctx, ["A node whose output feeds several gates has more than one", "parent, so the network is a directed acyclic graph.", "", "Tree covering cuts it at every such node, covers each tree", "optimally, and stitches the results together.", "", "*Optimal within each tree, not across the cuts.", "", "Covering a whole directed acyclic graph optimally is NP-hard", "(Non-deterministic Polynomial-time hard); the cut-based", "mappers on the next page work on the whole graph heuristically."], 40, 86, 20);
    }, cap: "Real networks share logic, so a node can feed several gates and the network is not a tree. Tree covering cuts it at those nodes and covers each tree optimally, but the result is optimal only within each tree. Covering the whole graph optimally is NP-hard (Non-deterministic Polynomial-time hard)." });

    return { frames: frames, w: SD.W, h: SD.H, speed: 3600 };
  };

  /* ----- cut-based mapping: cuts on the whole graph, delay first, then area recovery ----- */

  BUILD["cut-based-mapping"] = function () {
    var NODES = { n1: ["a", "b"], y: ["n1", "c"], z: ["n1", "d"] };      /* two-input ANDs */
    var ORDER = ["n1", "y", "z"], OUTS = ["y", "z"], K = 3;
    var CELL = { 2: { name: "AND2", area: 2, delay: 1 }, 3: { name: "AND3", area: 4, delay: 1 } };
    var FANOUT = { n1: 2, y: 1, z: 1 };
    /* cuts: merge the cuts of the fanins, keep those with at most K leaves */
    var CUTS = {};
    function cutsOf(id) {
      if (!NODES[id]) return [[id]];
      if (CUTS[id]) return CUTS[id];
      var a = cutsOf(NODES[id][0]).concat([[NODES[id][0]]]), b = cutsOf(NODES[id][1]).concat([[NODES[id][1]]]);
      var seen = {}, out = [];
      a.forEach(function (ca) { b.forEach(function (cb) {
        var u = ca.concat(cb).filter(function (v, i, s) { return s.indexOf(v) === i; }).sort();
        var key = u.join(",");
        if (u.length <= K && !seen[key]) { seen[key] = true; out.push(u); }
      }); });
      CUTS[id] = out;
      return out;
    }
    ORDER.forEach(cutsOf);
    function cellFor(cut) { return CELL[cut.length]; }
    /* pass 1: minimum arrival time at every node */
    var ARR = { a: 0, b: 0, c: 0, d: 0 }, PICK1 = {};
    ORDER.forEach(function (id) {
      var best = null;
      CUTS[id].forEach(function (cut) {
        var t = Math.max.apply(null, cut.map(function (l) { return ARR[l]; })) + cellFor(cut).delay;
        if (!best || t < best.t || (t === best.t && cellFor(cut).area < cellFor(best.cut).area)) best = { cut: cut, t: t };
      });
      ARR[id] = best.t; PICK1[id] = best;
    });
    function mapping(pick) {
      var used = {}, cells = [];
      (function need(id) {
        if (!NODES[id] || used[id]) return;
        used[id] = true; cells.push({ id: id, cut: pick[id].cut, cell: cellFor(pick[id].cut) });
        pick[id].cut.forEach(need);
      });
      OUTS.forEach(function (o) { (function need(id) {
        if (!NODES[id] || used[id]) return;
        used[id] = true; cells.push({ id: id, cut: pick[id].cut, cell: cellFor(pick[id].cut) });
        pick[id].cut.forEach(need);
      })(o); });
      var area = cells.reduce(function (s, c) { return s + c.cell.area; }, 0);
      var arr = {}; ["a", "b", "c", "d"].forEach(function (i) { arr[i] = 0; });
      ORDER.forEach(function (id) { if (used[id]) arr[id] = Math.max.apply(null, pick[id].cut.map(function (l) { return arr[l]; })) + cellFor(pick[id].cut).delay; });
      return { cells: cells, area: area, delay: Math.max.apply(null, OUTS.map(function (o) { return arr[o]; })) };
    }
    var M1 = mapping(PICK1);
    /* pass 2: area recovery by area flow, within a required time */
    var REQ = 2, AF = { a: 0, b: 0, c: 0, d: 0 }, PICK2 = {}, AFL = {};
    ORDER.forEach(function (id) {
      var opts = CUTS[id].map(function (cut) {
        var t = Math.max.apply(null, cut.map(function (l) { return ARR[l] === undefined ? 0 : (NODES[l] ? PICK2[l].t : 0); })) + cellFor(cut).delay;
        var af = cellFor(cut).area + cut.reduce(function (s, l) { return s + (NODES[l] ? AF[l] / FANOUT[l] : 0); }, 0);
        return { cut: cut, t: t, af: af };
      }).filter(function (o) { return o.t <= REQ; });
      opts.sort(function (p, q) { return p.af - q.af; });
      AFL[id] = opts;
      PICK2[id] = opts[0]; AF[id] = opts[0].af;
    });
    var M2 = mapping(PICK2);

    var txt = SD.txt, frames = [];
    var P = { a: { x: 50, y: 320 }, b: { x: 110, y: 320 }, c: { x: 190, y: 320 }, d: { x: 250, y: 320 }, n1: { x: 80, y: 240 }, y: { x: 130, y: 150 }, z: { x: 210, y: 150 } };
    var MC = [GREEN, BLUE, PURPLE];
    function g(ctx, st) {
      st = st || {};
      var owner = {};
      (st.map || []).forEach(function (c, i) {
        owner[c.id] = MC[i % MC.length];
        if (c.cut.length === 3) owner[c.id + ":n1"] = MC[i % MC.length];
      });
      ORDER.forEach(function (id) { NODES[id].forEach(function (i) { SD.line(ctx, P[i].x, P[i].y - 11, P[id].x, P[id].y + 13, INK, 1.5); }); });
      OUTS.forEach(function (o) { SD.arrow(ctx, P[o].x, P[o].y - 13, P[o].x, P[o].y - 36, INK, 1.5); txt(ctx, o, P[o].x + 8, P[o].y - 38, INK, 12, true); });
      ["a", "b", "c", "d"].forEach(function (i) { SD.box(ctx, P[i].x - 12, P[i].y - 11, 24, 22, INK, "#fff", 1.5, 5); txt(ctx, i, P[i].x, P[i].y, INK, 11, true, "center"); });
      ORDER.forEach(function (id) {
        var col = owner[id];
        var n1dup = id === "n1" && (st.map || []).filter(function (c) { return c.cut.length === 3; }).length;
        SD.box(ctx, P[id].x - 22, P[id].y - 13, 44, 26, st.hi === id ? AMBER : INK, col ? col : (n1dup ? "#f1f2f4" : "#fff"), st.hi === id ? 2.4 : 1.5, 6);
        txt(ctx, "AND", P[id].x, P[id].y, col ? "#fff" : (n1dup ? "rgba(26,29,38,0.4)" : INK), 10.5, true, "center");
        txt(ctx, id, P[id].x - 34, P[id].y, MUT, 9.5, false, "center");
        if (st.arr && st.arr[id] !== undefined) txt(ctx, "t=" + st.arr[id], P[id].x + 28, P[id].y - 8, AMBER, 10, true);
      });
    }
    var RX = 286;

    frames.push({ paint: function (ctx) {
      SD.clear(ctx, "Cut-based mapping: shared logic, two outputs", "n1 = ab feeds both y = n1 · c and z = n1 · d");
      g(ctx);
      SD.lines(ctx, ["n1 has two fanouts: not a tree.", "", "Tree covering would cut at n1", "and map three separate trees,", "so no cell could cover n1", "together with y or z.", "", "Cut-based mapping works on", "the whole graph.", "", "AND2: area 2, delay 1", "AND3: area 4, delay 1"], RX, 90, 19);
    }, cap: "A small network with shared logic: n1 = ab feeds both outputs. Tree covering would cut the graph at n1 and never cover n1 together with y or z. Cut-based mapping works on the whole graph instead." });

    frames.push({ paint: function (ctx) {
      SD.clear(ctx, "Enumerate the cuts of every node", "A cut is a set of nodes that separates a node from the primary inputs");
      g(ctx);
      txt(ctx, "cuts with at most " + K + " leaves", RX, 90, MUT, 10.5, true);
      var y = 114;
      ORDER.forEach(function (id) {
        txt(ctx, id + ":", RX, y, INK, 11.5, true);
        txt(ctx, CUTS[id].map(function (c) { return "{" + c.join(",") + "}"; }).join("   "), RX + 36, y, INK, 11.5);
        y += 26;
      });
      SD.lines(ctx, ["A node's cuts are built from", "the cuts of its two inputs.", "On a real design they explode,", "so priority cuts keep only the", "best few; here every cut fits."], RX, y + 14, 19, MUT);
    }, cap: "Each node's cuts are formed by combining the cuts of its two inputs. The cut {a,b,c} of y reaches through the shared node n1, which is exactly what tree covering cannot do. On large designs the number of cuts explodes, so priority cuts keep only the best few at each node." });

    frames.push({ paint: function (ctx) {
      SD.clear(ctx, "Pass 1: map every node for the earliest arrival", "Arrival = latest leaf arrival + the delay of the cell that implements the cut");
      g(ctx, { arr: ARR, map: M1.cells });
      var y = 96;
      ORDER.forEach(function (id) {
        txt(ctx, id, RX, y, INK, 11.5, true);
        CUTS[id].forEach(function (cut, j) {
          var t = Math.max.apply(null, cut.map(function (l) { return ARR[l]; })) + 1;
          var chosen = PICK1[id].cut.join(",") === cut.join(",");
          txt(ctx, "{" + cut.join(",") + "} " + cellFor(cut).name + " t=" + t, RX + 26, y + j * 18, chosen ? GREEN : MUT, 11, chosen);
        });
        y += Math.max(1, CUTS[id].length) * 18 + 10;
      });
      txt(ctx, "delay " + M1.delay + ", area " + M1.area, RX, y + 12, INK, 12, true);
    }, cap: "The first pass picks, at every node, the cut and cell with the earliest arrival. y and z each take an AND3 over {a, b, c} and {a, b, d}, reaching delay " + M1.delay + ". n1 is no longer built at all, but its logic is now inside both AND3 cells: area " + M1.area + "." });

    frames.push({ paint: function (ctx) {
      SD.clear(ctx, "Pass 2: recover area where the timing allows", "Outputs required at time " + REQ + "; cost = area flow (shared area split by fanout)");
      g(ctx, { map: M2.cells });
      var y = 96;
      ORDER.forEach(function (id) {
        txt(ctx, id, RX, y, INK, 11.5, true);
        AFL[id].forEach(function (o, j) {
          var chosen = j === 0;
          var af = String(Math.round(o.af * 10) / 10);
          txt(ctx, "{" + o.cut.join(",") + "} " + cellFor(o.cut).name + " flow " + af, RX + 26, y + j * 18, chosen ? GREEN : MUT, 11, chosen);
        });
        y += AFL[id].length * 18 + 10;
      });
      txt(ctx, "delay " + M2.delay + ", area " + M2.area, RX, y + 12, INK, 12, true);
    }, cap: "If the outputs are only required at time " + REQ + ", the second pass looks for cheaper cuts within that budget. Using {n1, c} costs an AND2 (2) plus half of n1's area (2 ÷ 2 fanouts = 1): 3, less than the AND3's 4. Both outputs switch, and the mapping becomes three AND2 cells: area " + M2.area + ", delay " + M2.delay + "." });

    frames.push({ paint: function (ctx) {
      SD.clear(ctx, "The trade-off the passes make", "The same network, three answers");
      var rows = [["required time 1 (tight)", "two AND3", M1.area, M1.delay, GREEN], ["required time 2", "three AND2", M2.area, M2.delay, BLUE], ["tree covering", "three AND2", 6, 2, MUT]];
      txt(ctx, "case                       cells        area  delay", 40, 90, MUT, 10.5, true);
      rows.forEach(function (r, i) {
        var y = 118 + i * 30;
        txt(ctx, r[0], 40, y, r[4], 11.5, true);
        txt(ctx, r[1], 250, y, INK, 11.5);
        txt(ctx, String(r[2]), 360, y, INK, 11.5, true);
        txt(ctx, String(r[3]), 410, y, INK, 11.5, true);
      });
      SD.lines(ctx, ["Tree covering cannot reach delay 1 on this network at all:", "it never lets a cell reach through the shared node n1.", "", "Delay first fixes the fastest achievable timing;", "area recovery then gives back area wherever there is slack."], 40, 232, 20);
    }, cap: "The passes turn a timing budget into area: with a tight requirement the mapper spends area (8) to reach delay 1, and with slack it recovers area (6) at delay 2. Tree covering could only ever produce the second answer, because no cell may reach through n1." });

    frames.push({ paint: function (ctx) {
      SD.clear(ctx, "At scale: priority cuts", "Keeping every cut is impossible on a real design");
      SD.lines(ctx, ["A node with two inputs can have as many cuts as the product of", "its inputs' cuts, and that compounds up the graph.", "", "Priority cuts keep only the best few cuts at each node (ranked by", "arrival time, then area flow), and build the next node's cuts", "only from those. Dropping cuts early is the heuristic part:", "a discarded cut might have led to a better mapping.", "", "*ABC's &nf, which the OpenROAD flow runs, maps this way,", "*on structures kept by the choice computation (&dch)."], 40, 86, 20);
    }, cap: "On a real design the number of cuts compounds up the graph, so priority cuts keep only the best few at each node, ranked by arrival time and then area flow, and build each node's cuts only from those. That pruning is what makes whole-graph mapping practical, and it is also where it gives up optimality." });

    return { frames: frames, w: SD.W, h: SD.H, speed: 3800 };
  };

  /* ----- metal fill: window densities, the windows that fail, greedy fill ----- */

  BUILD["metal-fill"] = function () {
    /* metal density of each tile, in percent: dense logic on the left, empty space on the right */
    var D0 = [
      [60, 55, 50, 20, 10, 5, 5, 10],
      [65, 60, 45, 15, 5, 0, 5, 15],
      [55, 50, 40, 25, 10, 5, 0, 10],
      [50, 45, 35, 30, 20, 10, 5, 5],
      [45, 40, 30, 20, 15, 10, 10, 20],
      [40, 35, 25, 15, 10, 5, 10, 25]
    ];
    var R = D0.length, C = D0[0].length, MIN = 30, MAX = 70, CAP = 60;   /* CAP: most a tile can hold, fill included */
    function wins(D) {
      var out = [];
      for (var r = 0; r < R - 1; r++) for (var c = 0; c < C - 1; c++)
        out.push({ r: r, c: c, d: (D[r][c] + D[r][c + 1] + D[r + 1][c] + D[r + 1][c + 1]) / 4 });
      return out;
    }
    /* greedy fill: raise the emptiest window, in its tile with the most room */
    var D = D0.map(function (row) { return row.slice(); });
    var FILL = D0.map(function (row) { return row.map(function () { return 0; }); });
    var SNAP = [], steps = 0;
    function snap() { SNAP.push({ D: D.map(function (r) { return r.slice(); }), F: FILL.map(function (r) { return r.slice(); }), steps: steps }); }
    snap();
    for (var guard = 0; guard < 200; guard++) {
      var W = wins(D).filter(function (w) { return w.d < MIN; });
      if (!W.length) break;
      W.sort(function (p, q) { return p.d - q.d; });
      var w = W[0], best = null;
      [[w.r, w.c], [w.r, w.c + 1], [w.r + 1, w.c], [w.r + 1, w.c + 1]].forEach(function (t) {
        var room = CAP - D[t[0]][t[1]];
        if (!best || room > best.room) best = { r: t[0], c: t[1], room: room };
      });
      var add = Math.min(best.room, Math.ceil((MIN - w.d) * 4 / 5) * 5);
      D[best.r][best.c] += add; FILL[best.r][best.c] += add; steps++;
      if (steps === 3 || steps === 8) snap();
    }
    snap();
    var FINAL = SNAP[SNAP.length - 1];
    var FAIL0 = wins(D0).filter(function (w) { return w.d < MIN; }).length;
    var FAILN = wins(FINAL.D).filter(function (w) { return w.d < MIN || w.d > MAX; }).length;
    var ADDED = FINAL.F.reduce(function (s, r) { return s + r.reduce(function (a, b) { return a + b; }, 0); }, 0);
    var TOTAL = wins(D0).length;

    var txt = SD.txt, frames = [];
    var GX = 24, GY = 74, TW = 38, TH = 40;
    function grid(ctx, st) {
      var S = st.snap || SNAP[0];
      for (var r = 0; r < R; r++) for (var c = 0; c < C; c++) {
        var x = GX + c * TW, y = GY + r * TH, m = D0[r][c], f = S.F[r][c];
        ctx.fillStyle = "#ffffff"; ctx.fillRect(x, y, TW, TH);
        ctx.fillStyle = "#9aa3b2"; ctx.fillRect(x + 1, y + TH - 1 - (TH - 2) * m / 100, TW - 2, (TH - 2) * m / 100);
        if (f) { ctx.fillStyle = GREEN; ctx.globalAlpha = 0.75; ctx.fillRect(x + 1, y + TH - 1 - (TH - 2) * (m + f) / 100, TW - 2, (TH - 2) * f / 100); ctx.globalAlpha = 1; }
        ctx.strokeStyle = "rgba(26,29,38,0.25)"; ctx.lineWidth = 1; ctx.strokeRect(x, y, TW, TH);
        if (st.tileText) txt(ctx, (m + f) + "", x + TW / 2, y + 11, INK, 9.5, !!f, "center");
      }
      ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.strokeRect(GX, GY, C * TW, R * TH);
      if (st.windows) {
        wins(S.D).forEach(function (w) {
          var cx = GX + (w.c + 1) * TW, cy = GY + (w.r + 1) * TH, bad = w.d < MIN || w.d > MAX;
          ctx.beginPath(); ctx.arc(cx, cy, 11, 0, Math.PI * 2);
          ctx.fillStyle = bad ? RED : "#ffffff"; ctx.fill();
          ctx.strokeStyle = bad ? RED : GREEN; ctx.lineWidth = 1.6; ctx.stroke();
          txt(ctx, String(Math.round(w.d)), cx, cy + 0.5, bad ? "#fff" : GREEN, 9, true, "center");
        });
      }
      if (st.window) {
        var w0 = st.window;
        SD.box(ctx, GX + w0.c * TW + 2, GY + w0.r * TH + 2, 2 * TW - 4, 2 * TH - 4, AMBER, null, 2.6, 4);
      }
    }
    var RX = 348;
    function stats(ctx, lines) { SD.lines(ctx, lines, RX, 96, 19); }

    frames.push({ paint: function (ctx) {
      SD.clear(ctx, "Metal fill: one layer, divided into tiles", "Grey height = how much of each tile is metal");
      grid(ctx, { tileText: true });
      stats(ctx, ["Dense logic on the left,", "almost nothing on the", "right.", "", "Polishing removes metal", "unevenly where density", "varies: sparse areas", "dish, dense areas stay", "high."]);
    }, cap: "One metal layer, divided into tiles; the grey height in each tile is the fraction of it that is metal, and the number is that fraction in percent. Dense logic sits on the left and almost empty space on the right, which is exactly what chemical-mechanical polishing handles badly." });

    frames.push({ paint: function (ctx) {
      SD.clear(ctx, "The rule: every window between " + MIN + "% and " + MAX + "% metal", "A window is 2 × 2 tiles, checked at every one-tile step");
      grid(ctx, { windows: true, window: { r: 0, c: 0 } });
      stats(ctx, ["Each dot is one window's", "density: the average of", "the four tiles around it.", "", "The orange square is the", "first window. The check", "slides it one tile at a", "time across the die.", "", TOTAL + " windows in all."]);
    }, cap: "The foundry's rule is written for windows, here 2 × 2 tiles, checked at every one-tile offset so the windows overlap. Each dot marks one window and shows its density, the average of the four tiles around it. The rule asks for " + MIN + "% to " + MAX + "% in every window." });

    frames.push({ paint: function (ctx) {
      SD.clear(ctx, FAIL0 + " windows are too empty", "Red: below " + MIN + "%. None is over " + MAX + "%, which fill could not fix anyway");
      grid(ctx, { windows: true });
      stats(ctx, [FAIL0 + " of " + TOTAL + " windows fail.", "", "Fill can only add metal,", "so it repairs windows", "that are too empty. A", "window that is too dense", "has to be fixed in the", "design itself."]);
    }, cap: FAIL0 + " of the " + TOTAL + " windows are below " + MIN + "%. Fill can only add metal, so it repairs windows that are too empty; a window that is too dense would have to be fixed by spreading the design itself." });

    frames.push({ paint: function (ctx) {
      SD.clear(ctx, "Greedy fill: the emptiest window first", "Fill its roomiest tile; no tile may exceed " + CAP + "%");
      grid(ctx, { windows: true, snap: SNAP[1] });
      stats(ctx, ["After " + SNAP[1].steps + " steps.", "", "Green = fill: metal", "shapes connected to no", "signal, added in empty", "space.", "", "One tile's fill raises", "all four windows that", "share that tile."]);
    }, cap: "Greedy filling takes the emptiest failing window and adds fill to the tile in it with the most room, never letting a tile exceed " + CAP + "%. Because windows overlap, one tile's fill raises all four windows that contain it. Here are the first " + SNAP[1].steps + " steps." });

    frames.push({ paint: function (ctx) {
      SD.clear(ctx, "Keep going while any window fails", "After " + SNAP[2].steps + " steps");
      grid(ctx, { windows: true, snap: SNAP[2] });
      stats(ctx, ["The fill spreads across", "the empty region, a", "little in each tile,", "rather than piling into", "one place."]);
    }, cap: "The loop repeats while any window fails. The fill spreads across the empty region a tile at a time, which is what keeps the density even rather than just high on average." });

    frames.push({ paint: function (ctx) {
      SD.clear(ctx, "Every window in range", FAILN === 0 ? "All " + TOTAL + " windows now pass" : FAILN + " windows still fail");
      grid(ctx, { windows: true, snap: FINAL });
      stats(ctx, ["*" + FINAL.steps + " fill steps.", "*Every window between", "*" + MIN + "% and " + MAX + "%.", "", "Kahng, Robins, Singh and", "Zelikovsky solve this", "exactly with linear", "programming, and with", "greedy and Monte Carlo", "methods on large", "layouts."]);
    }, cap: "After " + FINAL.steps + " steps every window is between " + MIN + "% and " + MAX + "%. Kahng, Robins, Singh and Zelikovsky formulated this problem exactly: linear programming decides how much fill each tile gets, and greedy and Monte Carlo methods like this one handle full-size layouts." });

    frames.push({ paint: function (ctx) {
      SD.clear(ctx, "Fill is not free", "It adds capacitance to the signal wires beside it");
      SD.lines(ctx, ["Every fill shape sits next to real wires and couples to them,", "so it adds capacitance and slows those wires down.", "", "  timing-aware fill keeps its distance from critical nets,", "  extraction runs after fill, so timing sees its effect,", "  fill can float (simple to add, harder to model)", "  or be tied to a supply.", "", "*OpenROAD's density_fill inserts fill from per-layer rules;", "*the finishing walkthrough on this site runs it before sign-off."], 30, 90, 20);
    }, cap: "Fill has a cost: each shape adds capacitance to the signal wires beside it. Timing-aware fill keeps away from critical nets, and parasitic extraction has to run after fill so that the final timing sees it." });

    return { frames: frames, w: SD.W, h: SD.H, speed: 3600 };
  };

  /* ----- parasitic extraction: resistance from geometry, capacitance from a pattern table ----- */

  BUILD["parasitic-extraction"] = function () {
    /* illustrative values, not a real process */
    var RS = 0.4, WID = 0.1, VIA = 5;                          /* ohms per square, micrometres, ohms */
    var SEGS = [
      { len: 20, nb: "A", sp: 0.1 },                          /* a neighbour 0.1 micrometre away */
      { len: 15, nb: null, sp: null },                        /* no neighbour */
      { len: 15, nb: "B", sp: 0.3 }                           /* a neighbour 0.3 micrometre away */
    ];
    /* the pattern table: femtofarads per micrometre, characterized in advance by a field solver */
    var TABLE = [
      { key: "no neighbour", sp: null, cg: 0.060, cc: 0 },
      { key: "neighbour at 0.3", sp: 0.3, cg: 0.055, cc: 0.030 },
      { key: "neighbour at 0.1", sp: 0.1, cg: 0.050, cc: 0.080 }
    ];
    function row(sp) { return TABLE.filter(function (t) { return t.sp === sp; })[0]; }
    SEGS.forEach(function (s) {
      s.r = RS * s.len / WID;
      var t = row(s.sp); s.cg = t.cg * s.len; s.cc = t.cc * s.len; s.row = t;
    });
    var RTOT = SEGS.reduce(function (a, s) { return a + s.r; }, 0) + VIA;
    var CG = SEGS.reduce(function (a, s) { return a + s.cg; }, 0), CC = SEGS.reduce(function (a, s) { return a + s.cc; }, 0);
    function f2(x) { return (Math.round(x * 100) / 100).toString(); }

    var txt = SD.txt, frames = [];
    var X0 = 40, SC = 8.4, WY = 150;                            /* layout: x = X0 + micrometres * SC */
    function top(ctx, hi) {
      var x = X0;
      SEGS.forEach(function (s, i) {
        var w = s.len * SC;
        if (s.nb) {
          var off = s.sp === 0.1 ? 22 : 44;
          SD.box(ctx, x + 4, WY - off - 8, w - 8, 12, null, "#aeb6c2", 0, 2);
          txt(ctx, "neighbour " + s.nb + " (" + s.sp + " µm away)", x + 8, WY - off - 18, MUT, 9.5);
        }
        SD.box(ctx, x, WY - 7, w, 14, null, hi === i ? AMBER : BLUE, 0, 2);
        txt(ctx, s.len + " µm", x + w / 2, WY + 22, MUT, 10, false, "center");
        SD.line(ctx, x + w, WY - 12, x + w, WY + 12, "rgba(26,29,38,0.35)", 1, [3, 3]);
        x += w;
      });
      SD.box(ctx, x - 6, WY - 9, 18, 18, INK, "#ffffff", 1.6, 3);
      txt(ctx, "via", x + 3, WY + 22, MUT, 10, false, "center");
      txt(ctx, "the net, on one metal layer, " + WID + " µm wide", X0, WY + 44, BLUE, 10.5, true);
    }

    frames.push({ paint: function (ctx) {
      SD.clear(ctx, "Parasitic extraction: what is this wire, electrically?", "One routed net, seen from above (illustrative values, not a real process)");
      top(ctx);
      SD.lines(ctx, ["Timing after routing needs the real resistance and capacitance of every wire.", "This one runs 50 µm: first beside a close neighbour, then alone, then", "beside a more distant neighbour, and ends in a via to the layer above."], 30, 250, 20);
    }, cap: "One routed net seen from above: 50 micrometres on one metal layer, first beside a close neighbour, then alone, then beside a more distant one, ending in a via. Timing after routing needs its real resistance and capacitance, not an estimate. (The numbers in this figure are illustrative, not from a real process.)" });

    frames.push({ paint: function (ctx) {
      SD.clear(ctx, "Resistance is local: it comes from each segment's own shape", "R = sheet resistance × length ÷ width, plus each via");
      top(ctx);
      var y = 250;
      SEGS.forEach(function (s, i) { txt(ctx, "segment " + (i + 1) + ":  " + RS + " × " + s.len + " ÷ " + WID + " = " + s.r + " Ω", 40, y + i * 20, INK, 11); });
      txt(ctx, "via: " + VIA + " Ω", 40, y + 60, INK, 11);
      txt(ctx, "total " + RTOT + " Ω", 330, y + 30, BLUE, 13, true);
    }, cap: "Resistance depends only on each segment's own geometry: sheet resistance times length divided by width, plus the resistance of each via. With " + RS + " ohms per square and a " + WID + " micrometre width, the three segments give " + SEGS.map(function (s) { return s.r; }).join(", ") + " ohms, and the whole net " + RTOT + " ohms." });

    frames.push({ paint: function (ctx) {
      SD.clear(ctx, "Capacitance is not local", "A cross-section through segment 1: the wire couples to everything near it");
      var sx = 60, sy = 90;
      ctx.fillStyle = "#d9dde3"; ctx.fillRect(sx + 20, sy + 190, 260, 20);
      txt(ctx, "substrate (ground)", sx + 150, sy + 200, MUT, 10, false, "center");
      SD.box(ctx, sx + 60, sy + 30, 180, 16, null, "#c7ccd4", 0, 2);
      txt(ctx, "layer above", sx + 150, sy + 20, MUT, 10, false, "center");
      SD.box(ctx, sx + 130, sy + 110, 40, 34, null, BLUE, 0, 2);
      txt(ctx, "net", sx + 150, sy + 127, "#fff", 10, true, "center");
      SD.box(ctx, sx + 62, sy + 110, 40, 34, null, "#aeb6c2", 0, 2);
      txt(ctx, "A", sx + 82, sy + 127, INK, 11, true, "center");
      SD.arrow(ctx, sx + 128, sy + 127, sx + 104, sy + 127, RED, 2);
      SD.arrow(ctx, sx + 150, sy + 146, sx + 150, sy + 186, GREEN, 2);
      SD.arrow(ctx, sx + 150, sy + 108, sx + 150, sy + 50, AMBER, 2);
      SD.lines(ctx, ["red: to the neighbour,", "  largest at small spacing", "green: to the substrate", "amber: to the layer above", "", "The exact answer needs", "the electrostatic field", "around all of them: a", "field solver such as", "FastCap. Far too slow", "for billions of wire", "segments."], 340, 96, 18);
    }, cap: "Capacitance is not local: each wire couples to the substrate, to the layers above and below, and to its neighbours, and at small spacings the neighbour coupling is the largest part. The exact answer needs a field solver, such as FastCap, which is far too slow to run on every wire of a chip." });

    frames.push({ paint: function (ctx) {
      SD.clear(ctx, "So solve typical patterns once, in advance", "A field solver characterizes a table of cross-sections for the process");
      txt(ctx, "pattern               to ground   to neighbour", 40, 96, MUT, 10.5, true);
      TABLE.forEach(function (t, i) {
        var y = 124 + i * 28;
        txt(ctx, t.key, 40, y, INK, 11.5, true);
        txt(ctx, t.cg.toFixed(3), 230, y, INK, 11.5);
        txt(ctx, t.cc ? t.cc.toFixed(3) : "-", 330, y, INK, 11.5);
      });
      txt(ctx, "femtofarads per µm of wire", 40, 124 + TABLE.length * 28 + 6, MUT, 10);
      SD.lines(ctx, ["A real table covers many layers, widths and spacings, with and", "without metal above and below. It is built once per process,", "and every design on that process is extracted from it."], 40, 250, 20);
    }, cap: "Before any design is extracted, a field solver characterizes a table of typical cross-sections for the process: capacitance per micrometre to ground and to a neighbour, for each spacing. A close neighbour takes coupling up and ground capacitance down." });

    SEGS.forEach(function (s, i) {
      frames.push({ paint: function (ctx) {
        SD.clear(ctx, "Scan the layout: segment " + (i + 1), "Identify the configuration around it and look it up");
        top(ctx, i);
        txt(ctx, "pattern: " + s.row.key, 40, 250, AMBER, 11.5, true);
        txt(ctx, "to ground:      " + s.row.cg.toFixed(3) + " × " + s.len + " = " + f2(s.cg) + " fF", 40, 274, INK, 11);
        txt(ctx, "to neighbour:   " + (s.cc ? s.row.cc.toFixed(3) + " × " + s.len + " = " + f2(s.cc) + " fF (to " + s.nb + ")" : "none"), 40, 294, INK, 11);
      }, cap: "Segment " + (i + 1) + " runs " + s.len + " micrometres with " + (s.nb ? "neighbour " + s.nb + " " + s.sp + " micrometres away" : "no neighbour") + ". The table gives " + f2(s.cg) + " femtofarads to ground" + (s.cc ? " and " + f2(s.cc) + " femtofarads of coupling to " + s.nb : "") + "." });
    });

    frames.push({ paint: function (ctx) {
      SD.clear(ctx, "The result: a resistor and capacitor network for the timer", "Ground " + f2(CG) + " fF, coupling " + f2(CC) + " fF, resistance " + RTOT + " Ω");
      var y = 150, x = 40;
      function res(x1, label) {
        ctx.save(); ctx.strokeStyle = BLUE; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x1, y);
        for (var k = 0; k < 6; k++) ctx.lineTo(x1 + 8 + k * 8, y + (k % 2 ? 7 : -7));
        ctx.lineTo(x1 + 60, y); ctx.stroke(); ctx.restore();
        txt(ctx, label, x1 + 30, y - 18, BLUE, 10, true, "center");
      }
      function cap(x1, label, color, down, low) {
        var dy = low ? 34 : 0;
        SD.line(ctx, x1, y, x1, y + 28 + dy, color, 1.6);
        SD.line(ctx, x1 - 9, y + 28 + dy, x1 + 9, y + 28 + dy, color, 2); SD.line(ctx, x1 - 9, y + 34 + dy, x1 + 9, y + 34 + dy, color, 2);
        SD.line(ctx, x1, y + 34 + dy, x1, y + 44 + dy, color, 1.6);
        txt(ctx, label + " " + down, x1 + 13, y + 31 + dy, color, 9.5, true);
      }
      SEGS.forEach(function (s, i) {
        res(x, s.r + " Ω");
        SD.line(ctx, x + 60, y, x + 128, y, INK, 1.6);
        cap(x + 84, f2(s.cg) + " fF", GREEN, "to ground");
        if (s.cc) cap(x + 66, f2(s.cc) + " fF", RED, "to " + s.nb, true);
        x += 128;
      });
      res(x, VIA + " Ω via");
      txt(ctx, "driver", 40, y - 40, MUT, 10);
      txt(ctx, "receiver", x + 40, y - 40, MUT, 10);
      SD.lines(ctx, ["Coupling capacitors are kept separate: whether they help or hurt", "depends on whether the neighbour switches at the same time,", "which timing analysis decides. OpenRCX writes this network for", "the flow's final timing report."], 40, 270, 19);
    }, cap: "The extractor writes the net as a network of resistors and capacitors: " + RTOT + " ohms in all, " + f2(CG) + " femtofarads to ground, and " + f2(CC) + " femtofarads of coupling kept as separate capacitors, because their effect depends on what the neighbours do. Timing analysis reads this network for sign-off." });

    return { frames: frames, w: SD.W, h: SD.H, speed: 3800 };
  };

  /* ----- static power-grid voltage drop: Kirchhoff at every node, solved iteratively ----- */

  BUILD["power-grid-voltage-drop"] = function () {
    /* illustrative values: a 7 x 7 grid of stripe crossings, pads at the corners */
    var N = 7, VDD = 0.7, R = 1.25;                            /* volts, ohms per grid segment */
    var I = [];
    for (var r = 0; r < N; r++) { I.push([]); for (var c = 0; c < N; c++) I[r].push(0.002); }   /* 2 mA per node */
    I[4][2] = 0.012; I[3][3] = 0.006;                          /* a hotspot, where many cells switch */
    function key(r, c) { return r + "," + c; }
    var PADS = {}; [[0, 0], [0, 6], [6, 0], [6, 6]].forEach(function (p) { PADS[key(p[0], p[1])] = true; });
    /* Gauss-Seidel sweeps of Kirchhoff's current law: (sum of neighbour voltages - R * I) / neighbours */
    function solve(pads, sweeps) {
      var v = [], k = 0, md;
      for (var r = 0; r < N; r++) { v.push([]); for (var c = 0; c < N; c++) v[r].push(VDD); }
      do {
        md = 0;
        for (var r2 = 0; r2 < N; r2++) for (var c2 = 0; c2 < N; c2++) {
          if (pads[key(r2, c2)]) continue;
          var s = 0, n = 0;
          [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
            var a = r2 + d[0], b = c2 + d[1];
            if (a >= 0 && a < N && b >= 0 && b < N) { s += v[a][b]; n++; }
          });
          var nv = (s - R * I[r2][c2]) / n;
          md = Math.max(md, Math.abs(nv - v[r2][c2])); v[r2][c2] = nv;
        }
        k++;
      } while ((sweeps ? k < sweeps : md > 1e-9) && k < 5000);
      var worst = { d: -1 };
      for (var r3 = 0; r3 < N; r3++) for (var c3 = 0; c3 < N; c3++) {
        var d = VDD - v[r3][c3];
        if (d > worst.d) worst = { d: d, r: r3, c: c3 };
      }
      return { v: v, k: k, worst: worst };
    }
    var S1 = solve(PADS, 1), S10 = solve(PADS, 10), S50 = solve(PADS, 50), SF = solve(PADS);
    var PADS2 = {}; Object.keys(PADS).forEach(function (k) { PADS2[k] = true; }); PADS2[key(3, 3)] = true;
    var SX = solve(PADS2);
    function mv(x) { return (Math.round(x * 10000) / 10).toFixed(1); }

    var txt = SD.txt, frames = [];
    var GX = 50, GY = 80, P = 42;
    function heat(d) {                                         /* drop in volts -> colour */
      var t = Math.max(0, Math.min(1, d / 0.035));
      var r = Math.round(255 * Math.min(1, t * 1.6)), g = Math.round(200 * (1 - t) + 40), b = Math.round(90 * (1 - t) + 40);
      return "rgb(" + r + "," + g + "," + b + ")";
    }
    function grid(ctx, sol, pads, st) {
      st = st || {};
      for (var k = 0; k < N; k++) {
        SD.line(ctx, GX, GY + k * P, GX + (N - 1) * P, GY + k * P, "#c2c8d0", 3);
        SD.line(ctx, GX + k * P, GY, GX + k * P, GY + (N - 1) * P, "#c2c8d0", 3);
      }
      for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
        var x = GX + c * P, y = GY + r * P, pad = pads[key(r, c)];
        if (pad) { SD.box(ctx, x - 11, y - 11, 22, 22, INK, "#16241b", 1.5, 3); txt(ctx, "V", x, y + 0.5, "#fff", 9, true, "center"); continue; }
        var col = sol ? heat(VDD - sol.v[r][c]) : (I[r][c] > 0.002 ? AMBER : "#ffffff");
        ctx.beginPath(); ctx.arc(x, y, I[r][c] > 0.002 && !sol ? 9 : 7, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke();
        if (st.labels && sol) txt(ctx, mv(VDD - sol.v[r][c]), x, y - 13, INK, 8.5, false, "center");
      }
      if (st.worst && sol) {
        var w = sol.worst;
        ctx.beginPath(); ctx.arc(GX + w.c * P, GY + w.r * P, 14, 0, Math.PI * 2); ctx.strokeStyle = RED; ctx.lineWidth = 2.5; ctx.stroke();
      }
      if (st.one) {
        var o = st.one;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { SD.line(ctx, GX + o[1] * P, GY + o[0] * P, GX + (o[1] + d[1]) * P, GY + (o[0] + d[0]) * P, BLUE, 3); });
        ctx.beginPath(); ctx.arc(GX + o[1] * P, GY + o[0] * P, 10, 0, Math.PI * 2); ctx.strokeStyle = BLUE; ctx.lineWidth = 2.5; ctx.stroke();
      }
    }
    var RX = 330;
    function scale(ctx) {
      for (var k = 0; k <= 20; k++) { ctx.fillStyle = heat(0.035 * k / 20); ctx.fillRect(RX + k * 9, 330, 9, 10); }
      txt(ctx, "0 mV", RX, 348, MUT, 9); txt(ctx, "35 mV drop", RX + 180, 348, MUT, 9, false, "right");
    }

    frames.push({ paint: function (ctx) {
      SD.clear(ctx, "Static voltage drop: the power grid as resistors", "Illustrative values: " + R + " Ω per segment, " + VDD + " V at the pads");
      grid(ctx, null, PADS);
      SD.lines(ctx, ["Stripes cross at 49 nodes;", "pads at the four corners hold", VDD + " V.", "", "Every node feeds cells that", "draw 2 mA on average.", "", "The orange nodes are a", "hotspot: 12 mA and 6 mA."], RX, 96, 19);
    }, cap: "The power grid as a resistor network: stripes crossing at 49 nodes, each segment " + R + " ohms, with pads at the corners holding " + VDD + " volts. Every node supplies cells that draw 2 milliamps on average, and two nodes near the middle form a hotspot drawing 12 and 6 milliamps. (Illustrative values.)" });

    frames.push({ paint: function (ctx) {
      SD.clear(ctx, "Kirchhoff's current law at every node", "Current in from the neighbours = current drawn by the cells");
      grid(ctx, null, PADS, { one: [2, 4] });
      SD.lines(ctx, ["At each node:", "", " Σ (v_nbr − v) ÷ R = i", "", "One equation per node;", "together, one sparse system:", "", "*  G · v = i", "", "G: conductances, one row", "per node; v: voltages;", "i: currents drawn."], RX, 96, 19);
    }, cap: "At every node, the current flowing in from the neighbouring segments must equal the current the cells draw: Kirchhoff's current law. One equation per node gives one large sparse linear system, G · v = i, with the pads fixed at the supply voltage." });

    frames.push({ paint: function (ctx) {
      SD.clear(ctx, "Solve it: one sweep", "Gauss-Seidel: set each node from its neighbours, over and over");
      grid(ctx, S1, PADS); scale(ctx);
      SD.lines(ctx, ["Start with every node at " + VDD + " V,", "then set each node to satisfy", "its own equation, using the", "neighbours' latest values.", "", "After 1 sweep the worst drop", "is " + mv(S1.worst.d) + " mV: far from settled."], RX, 96, 19);
    }, cap: "The system can be solved by sweeping: start every node at the supply voltage, then repeatedly set each node to satisfy its own equation using its neighbours' latest values (Gauss-Seidel). After one sweep the worst drop is only " + mv(S1.worst.d) + " millivolts, far from the answer." });

    frames.push({ paint: function (ctx) {
      SD.clear(ctx, "Keep sweeping: 10, then 50 sweeps", "The drop spreads outward from the hotspot");
      grid(ctx, S50, PADS); scale(ctx);
      SD.lines(ctx, ["worst drop:", "  10 sweeps: " + mv(S10.worst.d) + " mV", "  50 sweeps: " + mv(S50.worst.d) + " mV", "", "Each sweep carries a change", "only one node further, so", "plain sweeps converge", "slowly. Real", "solvers use preconditioned", "conjugate gradient: the", "matrix is symmetric", "positive definite."], RX, 96, 19);
    }, cap: "The drop spreads outward from the hotspot as the sweeps continue: " + mv(S10.worst.d) + " millivolts after 10 sweeps, " + mv(S50.worst.d) + " after 50. Plain sweeps converge slowly, so production solvers use preconditioned conjugate gradient, which suits this symmetric positive definite matrix." });

    frames.push({ paint: function (ctx) {
      SD.clear(ctx, "Converged: the worst drop is " + mv(SF.worst.d) + " mV", "After " + SF.k + " sweeps; numbers are each node's drop in millivolts");
      grid(ctx, SF, PADS, { labels: true, worst: true }); scale(ctx);
      SD.lines(ctx, ["*Worst: " + mv(SF.worst.d) + " mV at the hotspot,", "*about " + Math.round(SF.worst.d / VDD * 100) + "% of the supply.", "", "Cells there run on", mv(VDD - SF.worst.d) + " mV instead of " + (VDD * 1000) + " mV,", "so they are slower than the", "timing libraries assumed."], RX, 96, 19);
    }, cap: "Converged: the worst drop is " + mv(SF.worst.d) + " millivolts, at the hotspot, about " + Math.round(SF.worst.d / VDD * 100) + "% of the supply. Cells there run on a lower voltage than the timing libraries assumed, so they are slower, which is why sign-off caps the drop." });

    frames.push({ paint: function (ctx) {
      SD.clear(ctx, "One fix: a pad (or a denser grid) near the hotspot", "Solve again with a fifth pad in the middle");
      grid(ctx, SX, PADS2, { labels: true, worst: true }); scale(ctx);
      SD.lines(ctx, ["*Worst drop: " + mv(SX.worst.d) + " mV", "*(was " + mv(SF.worst.d) + " mV)", "", "Adding pads, widening stripes", "or adding stripes lowers the", "resistance between the pads", "and the cells that draw the", "most current."], RX, 96, 19);
    }, cap: "Adding a pad near the hotspot and solving again brings the worst drop from " + mv(SF.worst.d) + " to " + mv(SX.worst.d) + " millivolts. Wider or denser stripes work the same way, by lowering the resistance between the supply and the cells that draw the most current." });

    frames.push({ paint: function (ctx) {
      SD.clear(ctx, "Static, not dynamic", "What this analysis leaves out");
      SD.lines(ctx, ["Static analysis uses each cell's average current. It misses the short,", "large surges when many cells switch in the same instant.", "", "Dynamic analysis simulates the grid's resistance, capacitance and", "inductance over time with switching current waveforms, at a much", "higher cost.", "", "*PDNSim in OpenROAD (analyze_power_grid) solves the static system", "*on the built grid; the Gemmini challenge caps its worst result."], 30, 90, 20);
    }, cap: "Static analysis uses average currents, so it misses the brief surges when many cells switch at once; dynamic analysis simulates those over time, at far higher cost. PDNSim in OpenROAD solves the static system on the real grid, and the Gemmini challenge on this site caps its worst drop." });

    return { frames: frames, w: SD.W, h: SD.H, speed: 3800 };
  };

  /* ----- design rule checking by plane sweep: an active set instead of every pair ----- */

  BUILD["design-rule-checking"] = function () {
    var WMIN = 4, SMIN = 3;                                    /* minimum width and spacing, in grid units */
    var RECTS = [
      { n: "A", x0: 2, y0: 2, x1: 12, y1: 6 },
      { n: "B", x0: 2, y0: 9, x1: 14, y1: 13 },
      { n: "C", x0: 16, y0: 2, x1: 19, y1: 20 },
      { n: "D", x0: 22, y0: 4, x1: 30, y1: 8 },
      { n: "E", x0: 22, y0: 10, x1: 32, y1: 14 },
      { n: "F", x0: 35, y0: 3, x1: 45, y1: 7 },
      { n: "G", x0: 36, y0: 12, x1: 46, y1: 18 },
      { n: "H", x0: 23, y0: 17, x1: 33, y1: 21 }
    ];
    function gap(a, b) {                                       /* distance between two rectangles */
      var dx = Math.max(0, Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1));
      var dy = Math.max(0, Math.max(a.y0, b.y0) - Math.min(a.y1, b.y1));
      return Math.sqrt(dx * dx + dy * dy);
    }
    function width(r) { return Math.min(r.x1 - r.x0, r.y1 - r.y0); }
    /* the sweep: shapes enter in order of their left edge; the active set holds shapes whose
       right edge is still within the spacing distance of the sweep line */
    var ORDER = RECTS.slice().sort(function (p, q) { return p.x0 - q.x0 || p.y0 - q.y0; });
    var active = [], EVENTS = [], VIOL = [], CMP = 0;
    ORDER.forEach(function (r) {
      active = active.filter(function (a) { return a.x1 + SMIN > r.x0; });
      var checks = active.map(function (a) { CMP++; var g = gap(a, r); var bad = g < SMIN; if (bad) VIOL.push({ kind: "spacing", a: a.n, b: r.n, g: g }); return { a: a.n, g: g, bad: bad }; });
      var wbad = width(r) < WMIN;
      if (wbad) VIOL.push({ kind: "width", a: r.n, w: width(r) });
      EVENTS.push({ r: r, active: active.map(function (a) { return a.n; }), checks: checks, wbad: wbad, cmp: CMP });
      active.push(r);
    });
    var PAIRS = RECTS.length * (RECTS.length - 1) / 2;
    var BRUTE = [];
    for (var i = 0; i < RECTS.length; i++) for (var j = i + 1; j < RECTS.length; j++) if (gap(RECTS[i], RECTS[j]) < SMIN) BRUTE.push(RECTS[i].n + RECTS[j].n);

    var txt = SD.txt, frames = [];
    var OX = 26, OY = 66, U = 9.6;
    function X(u) { return OX + u * U; } function Y(u) { return OY + u * U; }
    function layer(ctx, st) {
      st = st || {};
      ctx.fillStyle = "#ffffff"; ctx.fillRect(OX, OY, 48 * U, 22 * U);
      ctx.strokeStyle = "rgba(26,29,38,0.08)"; ctx.lineWidth = 1;
      for (var g = 0; g <= 48; g += 2) { ctx.beginPath(); ctx.moveTo(X(g), OY); ctx.lineTo(X(g), Y(22)); ctx.stroke(); }
      for (var h = 0; h <= 22; h += 2) { ctx.beginPath(); ctx.moveTo(OX, Y(h)); ctx.lineTo(X(48), Y(h)); ctx.stroke(); }
      if (st.band !== undefined) { ctx.fillStyle = "rgba(47,111,237,0.08)"; ctx.fillRect(X(st.band - SMIN), OY, SMIN * U, 22 * U); }
      RECTS.forEach(function (r) {
        var on = st.active && st.active.indexOf(r.n) >= 0, cur = st.cur === r.n, done = st.seen && st.seen.indexOf(r.n) >= 0;
        var bad = st.bad && st.bad.indexOf(r.n) >= 0;
        var fill = cur ? AMBER : on ? "#8fb3f5" : done ? "#c9ced6" : "#9aa3b2";
        if (st.plain) fill = "#9aa3b2";
        ctx.fillStyle = fill; ctx.fillRect(X(r.x0), Y(r.y0), (r.x1 - r.x0) * U, (r.y1 - r.y0) * U);
        ctx.strokeStyle = bad ? RED : INK; ctx.lineWidth = bad ? 2.6 : 1; ctx.strokeRect(X(r.x0), Y(r.y0), (r.x1 - r.x0) * U, (r.y1 - r.y0) * U);
        txt(ctx, r.n, X(r.x0) + 5, Y(r.y0) + 8, "#fff", 10, true);
      });
      if (st.band !== undefined) { SD.line(ctx, X(st.band), OY - 6, X(st.band), Y(22) + 6, BLUE, 2.2); txt(ctx, "sweep line", X(st.band), OY - 12, BLUE, 9.5, true, "center"); }
      (st.marks || []).forEach(function (m) {
        var a = RECTS.filter(function (r) { return r.n === m[0]; })[0], b = RECTS.filter(function (r) { return r.n === m[1]; })[0];
        var x = (Math.max(a.x0, b.x0) + Math.min(a.x1, b.x1)) / 2, y = (Math.max(a.y0, b.y0) + Math.min(a.y1, b.y1)) / 2;
        if (a.x1 <= b.x0 || b.x1 <= a.x0) { var xl = Math.min(a.x1, b.x1), xr = Math.max(a.x0, b.x0); SD.line(ctx, X(xl), Y(y), X(xr), Y(y), RED, 3); }
        else { var yt = Math.min(a.y1, b.y1), yb = Math.max(a.y0, b.y0); SD.line(ctx, X(x), Y(yt), X(x), Y(yb), RED, 3); }
      });
    }
    function panel(ctx, lines) { SD.lines(ctx, lines, 30, Y(22) + 20, 17); }
    function seenUpTo(k) { return ORDER.slice(0, k).map(function (r) { return r.n; }); }

    frames.push({ paint: function (ctx) {
      SD.clear(ctx, "Design rule checking: one metal layer, two rules", "Minimum width " + WMIN + " units; minimum spacing " + SMIN + " units");
      layer(ctx, { plain: true });
      panel(ctx, ["Every shape at least " + WMIN + " wide, and at least " + SMIN + " away from every other.", "Real rule decks have thousands of rules; two show the method."]);
    }, cap: "One metal layer with eight shapes and two of the foundry's rules: every shape at least " + WMIN + " units wide, and at least " + SMIN + " units from every other shape. A real process has thousands of rules, many of them conditional, but they are all checked the same way." });

    frames.push({ paint: function (ctx) {
      SD.clear(ctx, "The naive check compares every pair", PAIRS + " pairs for 8 shapes; about n² ÷ 2 in general");
      layer(ctx, { plain: true });
      ctx.save(); ctx.strokeStyle = "rgba(220,38,38,0.18)"; ctx.lineWidth = 1;
      for (var i = 0; i < RECTS.length; i++) for (var j = i + 1; j < RECTS.length; j++) {
        var a = RECTS[i], b = RECTS[j];
        ctx.beginPath(); ctx.moveTo(X((a.x0 + a.x1) / 2), Y((a.y0 + a.y1) / 2)); ctx.lineTo(X((b.x0 + b.x1) / 2), Y((b.y0 + b.y1) / 2)); ctx.stroke();
      }
      ctx.restore();
      panel(ctx, ["Checking every pair costs " + PAIRS + " comparisons here, and grows with the square", "of the shape count: hopeless for the billions of shapes on a chip."]);
    }, cap: "The naive check measures every pair of shapes: " + PAIRS + " comparisons for eight shapes, and the count grows with the square of the number of shapes, which is hopeless for billions of them. Almost every one of those comparisons is between shapes far apart." });

    var picks = [1, 2, 4, 7];                                  /* events to show: B, C, E, and the last */
    picks.forEach(function (k) {
      var e = EVENTS[k];
      frames.push({ paint: function (ctx) {
        SD.clear(ctx, "The sweep: shape " + e.r.n + " enters", "Compare it only with the active set: shapes still within " + SMIN + " units of the line");
        var bad = [];
        VIOL.forEach(function (v) { if (EVENTS.indexOf(e) >= 0 && seenUpTo(k + 1).indexOf(v.a) >= 0 && (v.b === undefined || seenUpTo(k + 1).indexOf(v.b) >= 0)) { bad.push(v.a); if (v.b) bad.push(v.b); } });
        layer(ctx, { band: e.r.x0, active: e.active, cur: e.r.n, seen: seenUpTo(k), bad: bad, marks: e.checks.filter(function (c) { return c.bad; }).map(function (c) { return [c.a, e.r.n]; }) });
        var lines = ["active set: " + (e.active.length ? e.active.join(", ") : "empty") + "     comparisons so far: " + e.cmp + " (of " + PAIRS + " pairs)"];
        e.checks.forEach(function (c) { lines.push("  " + c.a + " to " + e.r.n + ": gap " + (Math.round(c.g * 10) / 10) + (c.bad ? "  < " + SMIN + ", violation" : "  ok")); });
        lines.push("  width of " + e.r.n + ": " + width(e.r) + (e.wbad ? "  < " + WMIN + ", violation" : "  ok"));
        panel(ctx, lines);
      }, cap: (function () {
        var s = "The sweep line reaches the left edge of " + e.r.n + ". Only shapes whose right edge is still within " + SMIN + " units of the line can be too close, so " + e.r.n + " is compared with " + (e.active.length ? e.active.join(" and ") : "nothing") + ". ";
        e.checks.forEach(function (c) { s += c.a + " is " + (Math.round(c.g * 10) / 10) + " units away" + (c.bad ? ", a spacing violation. " : ", which is allowed. "); });
        if (e.wbad) s += e.r.n + " is only " + width(e.r) + " units wide, a width violation.";
        return s;
      })() });
    });

    frames.push({ paint: function (ctx) {
      SD.clear(ctx, VIOL.length + " violations, with " + CMP + " comparisons instead of " + PAIRS, "Same answer as checking every pair");
      var bad = []; VIOL.forEach(function (v) { bad.push(v.a); if (v.b) bad.push(v.b); });
      layer(ctx, { plain: true, bad: bad, marks: VIOL.filter(function (v) { return v.kind === "spacing"; }).map(function (v) { return [v.a, v.b]; }) });
      var lines = VIOL.map(function (v) { return v.kind === "spacing" ? "spacing  " + v.a + " to " + v.b + ": " + (Math.round(v.g * 10) / 10) + " < " + SMIN : "width    " + v.a + ": " + v.w + " < " + WMIN; });
      lines.push("*" + CMP + " comparisons by sweeping, " + PAIRS + " pair by pair; same errors.");
      panel(ctx, lines);
    }, cap: "The sweep finds all " + VIOL.length + " violations with " + CMP + " comparisons instead of " + PAIRS + ", and the pair-by-pair check confirms the same spacing errors. The work grows with the number of shapes times how crowded they are locally, not with the square of the count; A and B, and G and H, sit exactly " + SMIN + " apart and pass." });

    frames.push({ paint: function (ctx) {
      SD.clear(ctx, "At full scale", "What makes a real run feasible");
      SD.lines(ctx, ["Real rules are written as operations on layers (grow, shrink,", "intersect, subtract) followed by a measurement like the ones above,", "often conditional: a spacing that grows with wire width and the", "length two wires run side by side.", "", "Hierarchical checking checks each cell design once, then only", "the places where instances meet, instead of every placed copy.", "", "*KLayout and Magic run open rule decks; OpenROAD's detailed router", "*checks and repairs its own routing rules as it works."], 30, 90, 20);
    }, cap: "Real rules are layer operations followed by measurements, and many are conditional. Hierarchical checking, which checks each cell design once and then only where instances meet, is what makes a full-chip run finish. KLayout and Magic run open rule decks." });

    return { frames: frames, w: SD.W, h: SD.H, speed: 4000 };
  };

  /* ----- layout versus schematic: partition refinement until every node has a twin ----- */

  BUILD["layout-versus-schematic"] = function () {
    /* a two-input NAND gate: devices with terminals g (gate), s and d (source and drain, interchangeable) */
    var SCH = { name: "schematic", devs: [
      { id: "P1", t: "pmos", g: "A", sd: ["VDD", "Y"] },
      { id: "P2", t: "pmos", g: "B", sd: ["VDD", "Y"] },
      { id: "N1", t: "nmos", g: "A", sd: ["Y", "n1"] },
      { id: "N2", t: "nmos", g: "B", sd: ["n1", "GND"] }
    ] };
    /* the same circuit extracted from the layout: other names, other order */
    var LAY = { name: "layout", devs: [
      { id: "M1", t: "nmos", g: "3", sd: ["6", "5"] },
      { id: "M2", t: "pmos", g: "3", sd: ["1", "2"] },
      { id: "M3", t: "nmos", g: "4", sd: ["2", "6"] },
      { id: "M4", t: "pmos", g: "4", sd: ["2", "1"] }
    ] };
    /* the layout with a short between the two input nets, 3 and 4 */
    var SHORT = { name: "layout, shorted", devs: LAY.devs.map(function (d) { return { id: d.id, t: d.t, g: d.g === "4" ? "3" : d.g, sd: d.sd.slice() }; }) };
    function nets(g) { var s = {}; g.devs.forEach(function (d) { s[d.g] = 1; d.sd.forEach(function (n) { s[n] = 1; }); }); return Object.keys(s); }
    function nodesOf(g) { return g.devs.map(function (d) { return "d:" + d.id; }).concat(nets(g).map(function (n) { return "n:" + n; })); }
    function nbrs(g, node) {                                   /* neighbours with the terminal kind on the edge */
      var out = [];
      if (node.slice(0, 2) === "d:") {
        var d = g.devs.filter(function (x) { return "d:" + x.id === node; })[0];
        out.push(["g", "n:" + d.g]); d.sd.forEach(function (n) { out.push(["sd", "n:" + n]); });
      } else {
        g.devs.forEach(function (d) {
          if ("n:" + d.g === node) out.push(["g", "d:" + d.id]);
          d.sd.forEach(function (n) { if ("n:" + n === node) out.push(["sd", "d:" + d.id]); });
        });
      }
      return out;
    }
    /* round 0: devices by type, nets by the kinds of terminals on them; then refine both graphs together,
       so a label means the same thing on both sides */
    function refine(g1, g2, rounds) {
      var L = [{}, {}], hist = [];
      [g1, g2].forEach(function (g, k) {
        nodesOf(g).forEach(function (n) {
          if (n.slice(0, 2) === "d:") L[k][n] = g.devs.filter(function (d) { return "d:" + d.id === n; })[0].t;
          else L[k][n] = "net:" + nbrs(g, n).map(function (e) { return e[0] + (g.devs.filter(function (d) { return "d:" + d.id === e[1]; })[0].t); }).sort().join(",");
        });
      });
      function canon() {
        var sigs = {}; [0, 1].forEach(function (k) { Object.keys(L[k]).forEach(function (n) { sigs[L[k][n]] = 1; }); });
        var ids = {}; Object.keys(sigs).sort().forEach(function (s, i) { ids[s] = i; });
        [0, 1].forEach(function (k) { Object.keys(L[k]).forEach(function (n) { L[k][n] = String(ids[L[k][n]]); }); });
        hist.push([JSON.parse(JSON.stringify(L[0])), JSON.parse(JSON.stringify(L[1]))]);
      }
      canon();
      for (var r = 0; r < rounds; r++) {
        var N = [{}, {}];
        [g1, g2].forEach(function (g, k) {
          Object.keys(L[k]).forEach(function (n) {
            N[k][n] = L[k][n] + "|" + nbrs(g, n).map(function (e) { return e[0] + L[k][e[1]]; }).sort().join(",");
          });
        });
        L = N; canon();
      }
      return hist;
    }
    function classes(lab) { var c = {}; Object.keys(lab).forEach(function (n) { (c[lab[n]] = c[lab[n]] || []).push(n); }); return c; }
    function matching(h) {                                     /* nodes whose label is unique on both sides */
      var a = classes(h[0]), b = classes(h[1]), pairs = [], stuck = [];
      Object.keys(a).concat(Object.keys(b)).filter(function (v, i, s) { return s.indexOf(v) === i; }).forEach(function (lab) {
        var x = a[lab] || [], y = b[lab] || [];
        if (x.length === 1 && y.length === 1) pairs.push([x[0], y[0]]);
        else stuck.push({ lab: lab, a: x, b: y });
      });
      return { pairs: pairs, stuck: stuck };
    }
    var H = refine(SCH, LAY, 4), HS = refine(SCH, SHORT, 4);
    var ROUNDS = 0;
    for (var r = 0; r < H.length; r++) { if (matching(H[r]).stuck.length === 0) { ROUNDS = r; break; } }
    var FINAL = matching(H[ROUNDS]);
    var SM = matching(HS[HS.length - 1]);

    var txt = SD.txt, frames = [];
    var PAL = [BLUE, GREEN, AMBER, PURPLE, RED, TEAL, "#8b5cf6", "#0ea5e9", "#b45309", "#be185d", "#4d7c0f", "#475569"];
    var CUR = null;                                            /* the labels being drawn: [schematic, layout] */
    var FIXED = nodesOf(SCH).concat(nodesOf(LAY).map(function (n) { return "L" + n; }));
    function col(lab) {
      /* a label found on only one side has no twin: grey */
      var onA = CUR && Object.keys(CUR[0]).some(function (n) { return CUR[0][n] === lab; });
      var onB = CUR && Object.keys(CUR[1]).some(function (n) { return CUR[1][n] === lab; });
      if (CUR && !(onA && onB)) return "#8a919c";
      for (var i = 0; i < FIXED.length; i++) {
        var n = FIXED[i], side = n.charAt(0) === "L" ? 1 : 0, key = side ? n.slice(1) : n;
        if (CUR && CUR[side][key] === lab) return PAL[i % PAL.length];
      }
      return MUT;
    }
    /* draw one netlist in a half of the canvas */
    function draw(ctx, g, lab, x0, title, dim) {
      var ds = g.devs, ns = nets(g).sort(function (p, q) { return p.localeCompare(q, undefined, { numeric: true }); });
      var DP = {}, NP = {};
      ds.forEach(function (d, i) { DP[d.id] = { x: x0 + 30 + i * 62, y: 130 }; });
      ns.forEach(function (n, i) { NP[n] = { x: x0 + 18 + i * (216 / Math.max(1, ns.length - 1)), y: 250 }; });
      txt(ctx, title, x0 + 10, 78, INK, 11.5, true);
      ds.forEach(function (d) {
        var p = DP[d.id];
        [[d.g, true]].concat(d.sd.map(function (n) { return [n, false]; })).forEach(function (e) {
          SD.line(ctx, p.x, p.y + 14, NP[e[0]].x, NP[e[0]].y - 12, e[1] ? "rgba(26,29,38,0.6)" : "rgba(26,29,38,0.25)", e[1] ? 1.6 : 1.2, e[1] ? [4, 3] : null);
        });
      });
      ds.forEach(function (d) {
        var p = DP[d.id], l = lab ? lab["d:" + d.id] : null;
        SD.box(ctx, p.x - 22, p.y - 14, 44, 28, INK, l !== null ? col(l) : "#fff", 1.4, 5);
        txt(ctx, d.id, p.x, p.y - 3, l !== null ? "#fff" : INK, 10.5, true, "center");
        txt(ctx, d.t, p.x, p.y + 8, l !== null ? "#fff" : MUT, 8.5, false, "center");
      });
      ns.forEach(function (n) {
        var p = NP[n], l = lab ? lab["n:" + n] : null;
        ctx.beginPath(); ctx.arc(p.x, p.y, 13, 0, Math.PI * 2); ctx.fillStyle = l !== null ? col(l) : "#fff"; ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
        txt(ctx, n, p.x, p.y + 0.5, l !== null ? "#fff" : INK, n.length > 2 ? 8 : 9.5, true, "center");
      });
    }
    function both(ctx, h, g2) {
      CUR = h;
      draw(ctx, SCH, h ? h[0] : null, 10, "schematic");
      SD.line(ctx, 272, 70, 272, 290, "rgba(26,29,38,0.15)", 1);
      draw(ctx, g2 || LAY, h ? h[1] : null, 282, (g2 || LAY).name);
    }
    function count(h) { var a = classes(h[0]); return Object.keys(a).length; }

    frames.push({ paint: function (ctx) {
      SD.clear(ctx, "Layout versus schematic: are these the same circuit?", "Boxes are transistors, circles are nets; dashed edges are gates");
      both(ctx);
      SD.lines(ctx, ["Left: the netlist the designer intended. Right: the netlist extracted from", "the drawn layout, with its own names and order. Same circuit or not?"], 20, 300, 18);
    }, cap: "Left, the netlist the design intended: a two-input NAND gate with four transistors. Right, the netlist extracted from the layout, with different names and a different order. Deciding whether they are the same circuit is a graph comparison: devices and nets are nodes, and each terminal is an edge." });

    frames.push({ paint: function (ctx) {
      SD.clear(ctx, "Round 0: label by local facts", "Devices by type; nets by the terminals that touch them");
      both(ctx, H[0]);
      SD.lines(ctx, [count(H[0]) + " labels (colours). Same colour = cannot yet be told apart.", "Only A and B share a net label; P1/P2 and N1/N2 share device labels."], 20, 300, 18);
    }, cap: "Round 0 labels every node with local facts only: a device by its type, a net by the kinds of terminals on it. Same colour means the two nodes cannot yet be told apart. The labels are computed for both netlists together, so a colour means the same thing on both sides." });

    for (var k = 1; k <= ROUNDS; k++) {
      (function (k) {
        var m = matching(H[k]);
        frames.push({ paint: function (ctx) {
          SD.clear(ctx, "Round " + k + ": relabel from the neighbours' labels", "A node's new label = its old label + the labels of what it connects to");
          both(ctx, H[k]);
          SD.lines(ctx, [count(H[k]) + " labels; " + m.pairs.length + " of " + (SCH.devs.length + nets(SCH).length) + " nodes now unique on both sides.", m.stuck.length ? "Still tied: " + m.stuck.map(function (s) { return s.a.map(function (n) { return n.slice(2); }).join("/"); }).join(", ") : "*Every node is unique: each has exactly one twin."], 20, 300, 18);
        }, cap: k === 1 ? "Each round, every node takes a new label built from its own label and its neighbours' labels. A and B split apart in the next round, because A drives the transistor next to Y and B the one next to ground." : (m.stuck.length ? "Refinement continues while any label is shared. A and B are now apart, so the transistors they drive split too; only P1 and P2 are still tied, and they separate next round because one is driven by A and the other by B." : "After " + k + " rounds every node has a label that appears exactly once on each side, so every device and net is matched with its twin.") });
      })(k);
    }

    frames.push({ paint: function (ctx) {
      SD.clear(ctx, "Match: the layout is the schematic", "Each node paired with the node of the same label");
      both(ctx, H[ROUNDS]);
      var pairs = FINAL.pairs.map(function (p) { return p[0].slice(2) + "=" + p[1].slice(2); });
      SD.lines(ctx, ["*" + pairs.slice(0, 5).join("  "), "*" + pairs.slice(5).join("  ")], 20, 300, 18);
    }, cap: "Every schematic device and net is paired with exactly one in the layout: the layout builds the intended circuit. When refinement stalls on truly symmetric groups, such as identical transistors in parallel, one pair is matched by choice and refinement continues." });

    frames.push({ paint: function (ctx) {
      SD.clear(ctx, "Now with a short: nets 3 and 4 touch in the layout", "Refinement cannot give every node a twin");
      both(ctx, HS[HS.length - 1], SHORT);
      var unmatched = [];
      SM.stuck.forEach(function (st) { st.a.forEach(function (n) { unmatched.push(n.slice(2)); }); });
      SD.lines(ctx, ["The layout has " + nets(SHORT).length + " nets against " + nets(SCH).length + ". The difference spreads to every", "label within a few rounds: " + SM.pairs.length + " of " + (SCH.devs.length + nets(SCH).length) + " nodes find a twin (grey = no twin)."], 20, 300, 18);
    }, cap: "If a stray piece of metal shorts the two input nets, the layout has one net fewer, and refinement ends with labels that do not pair up. The tool can say which nodes are unmatched; explaining that they mean \"A is shorted to B\" is the harder, heuristic part." });

    return { frames: frames, w: SD.W, h: SD.H, speed: 4000 };
  };

  /* aliases used by page markup */
  BUILD["a-star"] = BUILD.astar;
  BUILD["mikami-tabuchi"] = BUILD.mikami;
  BUILD["rip-up"] = BUILD.ripup;

  if (typeof window !== "undefined") window.__WALK_BUILDERS__ = BUILD;

  document.querySelectorAll(".walk-fig[data-walk]").forEach(function (el) {
    var b = BUILD[el.dataset.walk];
    if (b) player(el, b());
  });
})();

/* test hook: lets a headless harness exercise the builders */
if (typeof window !== "undefined" && window.__WALK_TEST__) {
  window.__WALK_BUILDERS__ = null; /* set below via re-scan */
}
