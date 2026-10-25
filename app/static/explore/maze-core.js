/* Core logic for the maze-router explorable: grid model, Lee breadth-first
   wavefront routing, A-star routing, sequential multi-net routing with
   committed paths becoming obstacles. Pure data and algorithms, no browser
   dependencies, so the same file is unit-testable with node. */

var MazeCore = (function () {
  "use strict";

  var EMPTY = 0, BLOCK = 1, ROUTED = 2;

  function idx(x, y, W) { return y * W + x; }

  function manhattan(a, b, W) {
    var ax = a % W, ay = (a / W) | 0, bx = b % W, by = (b / W) | 0;
    return Math.abs(ax - bx) + Math.abs(ay - by);
  }

  /* Binary min-heap ordered by f, ties broken by lower h (pulls the search
     toward the target). Entries are [f, h, cellIndex]. */
  function Heap() { this.a = []; }
  Heap.prototype.push = function (e) {
    var a = this.a;
    a.push(e);
    var i = a.length - 1;
    while (i > 0) {
      var p = (i - 1) >> 1;
      if (a[p][0] < a[i][0] || (a[p][0] === a[i][0] && a[p][1] <= a[i][1])) break;
      var t = a[p]; a[p] = a[i]; a[i] = t;
      i = p;
    }
  };
  Heap.prototype.pop = function () {
    var a = this.a;
    var top = a[0];
    var last = a.pop();
    if (a.length) {
      a[0] = last;
      var i = 0;
      for (;;) {
        var l = 2 * i + 1, r = l + 1, m = i;
        if (l < a.length && (a[l][0] < a[m][0] || (a[l][0] === a[m][0] && a[l][1] < a[m][1]))) m = l;
        if (r < a.length && (a[r][0] < a[m][0] || (a[r][0] === a[m][0] && a[r][1] < a[m][1]))) m = r;
        if (m === i) break;
        var t = a[m]; a[m] = a[i]; a[i] = t;
        i = m;
      }
    }
    return top;
  };
  Heap.prototype.empty = function () { return this.a.length === 0; };

  /* Route one two-pin net on a working grid (truthy cell = blocked; the two
     pin cells must be passable). Returns:
       visits   - cells in the order the search settled them, with wave =
                  path cost so far (drives the animation coloring)
       path     - source-to-target cell list, or null if unreachable
       explored - number of settled cells (the Lee-vs-A-star talking point)
  */
  function route(grid, W, H, src, dst, algo) {
    var n = W * H;
    var parent = new Int32Array(n).fill(-1);
    var dist = new Int32Array(n).fill(-1);
    var visits = [];
    var found = false;

    function settleNeighbors(i, pushFn) {
      var x = i % W, y = (i / W) | 0;
      if (x > 0) pushFn(i - 1);
      if (x < W - 1) pushFn(i + 1);
      if (y > 0) pushFn(i - W);
      if (y < H - 1) pushFn(i + W);
    }

    if (algo === "hadlock") {
      /* Hadlock (1977): order cells by detour number (moves that increase
         the distance to the target). Path length = manhattan + 2 x detours,
         so expanding by minimal detour count still guarantees a shortest
         path, while exploring far fewer cells than Lee. Implemented as a
         0-1 breadth-first search with a double-ended queue. */
      var deque = [src];
      var dHead = 0;
      dist[src] = 0; /* dist holds the detour count here */
      var settled = new Uint8Array(n);
      while (dHead < deque.length) {
        var iH = deque[dHead++];
        if (iH === undefined || settled[iH]) continue;
        settled[iH] = 1;
        visits.push({ i: iH, wave: dist[iH] * 3 });
        if (iH === dst) { found = true; break; }
        settleNeighbors(iH, function (j) {
          if (settled[j] || grid[j]) return;
          var toward = manhattan(j, dst, W) < manhattan(iH, dst, W);
          var nd = dist[iH] + (toward ? 0 : 1);
          if (dist[j] === -1 || nd < dist[j]) {
            dist[j] = nd;
            parent[j] = iH;
            if (toward) deque.splice(dHead, 0, j);
            else deque.push(j);
          }
        });
      }
    } else if (algo === "soukup") {
      /* Soukup (1978): sprint greedily toward the target in straight
         moves that reduce the distance; when stuck, fall back to a
         Lee-style breadth-first escape from everything reached so far,
         until some cell is closer than the stuck point, then sprint
         again. Fast, but the shortest-path guarantee is gone. */
      var visited = new Uint8Array(n);
      visited[src] = 1;
      var cur = src;
      var order = 0;
      visits.push({ i: src, wave: 0 });
      var safety = 4 * n;
      while (cur !== dst && safety-- > 0) {
        /* greedy sprint */
        var moved = true;
        while (moved && cur !== dst) {
          moved = false;
          var cx = cur % W, cy = (cur / W) | 0;
          var tx = dst % W, ty = (dst / W) | 0;
          var cand = [];
          if (Math.abs(tx - cx) >= Math.abs(ty - cy)) {
            if (tx !== cx) cand.push(cur + (tx > cx ? 1 : -1));
            if (ty !== cy) cand.push(cur + (ty > cy ? W : -W));
          } else {
            if (ty !== cy) cand.push(cur + (ty > cy ? W : -W));
            if (tx !== cx) cand.push(cur + (tx > cx ? 1 : -1));
          }
          for (var ci = 0; ci < cand.length; ci++) {
            var nc = cand[ci];
            if (!visited[nc] && !grid[nc]) {
              visited[nc] = 1;
              parent[nc] = cur;
              cur = nc;
              visits.push({ i: nc, wave: (++order / 4) | 0 });
              moved = true;
              break;
            }
          }
        }
        if (cur === dst) break;
        /* breadth-first escape from the whole reached tree */
        var thresh = manhattan(cur, dst, W);
        var q = [];
        for (var s = 0; s < n; s++) if (visited[s]) q.push(s);
        var qh = 0;
        var escaped = -1;
        while (qh < q.length) {
          var c2 = q[qh++];
          var brk = false;
          settleNeighbors(c2, function (j) {
            if (brk || visited[j] || grid[j]) return;
            visited[j] = 1;
            parent[j] = c2;
            visits.push({ i: j, wave: (++order / 4) | 0 });
            q.push(j);
            if (manhattan(j, dst, W) < thresh) { escaped = j; brk = true; }
          });
          if (brk) break;
        }
        if (escaped === -1) break; /* no path exists */
        cur = escaped;
      }
      found = (cur === dst);
    } else if (algo === "astar") {
      var heap = new Heap();
      var closed = new Uint8Array(n);
      dist[src] = 0;
      heap.push([manhattan(src, dst, W), manhattan(src, dst, W), src]);
      while (!heap.empty()) {
        var e = heap.pop();
        var i = e[2];
        if (closed[i]) continue;
        closed[i] = 1;
        visits.push({ i: i, wave: dist[i] });
        if (i === dst) { found = true; break; }
        settleNeighbors(i, function (j) {
          if (closed[j] || grid[j]) return;
          var g = dist[i] + 1;
          if (dist[j] === -1 || g < dist[j]) {
            dist[j] = g;
            parent[j] = i;
            var h = manhattan(j, dst, W);
            heap.push([g + h, h, j]);
          }
        });
      }
    } else {
      /* Lee: plain breadth-first wavefront. */
      var queue = [src];
      dist[src] = 0;
      var head = 0;
      while (head < queue.length) {
        var i2 = queue[head++];
        visits.push({ i: i2, wave: dist[i2] });
        if (i2 === dst) { found = true; break; }
        settleNeighbors(i2, function (j) {
          if (dist[j] !== -1 || grid[j]) return;
          dist[j] = dist[i2] + 1;
          parent[j] = i2;
          queue.push(j);
        });
      }
    }

    var path = null;
    if (found) {
      path = [];
      for (var c = dst; c !== -1; c = parent[c]) path.push(c);
      path.reverse();
    }
    return { visits: visits, path: path, explored: visits.length };
  }

  /* Route every net in order. Each committed path becomes an obstacle for
     the nets after it, and every other net's pins are always obstacles.
     Returns per-net results plus totals. */
  function routeAll(baseGrid, W, H, nets, algo) {
    var work = baseGrid.slice();
    var results = [];
    var totalWL = 0, totalExplored = 0, failed = 0;

    for (var k = 0; k < nets.length; k++) {
      var grid = work.slice();
      for (var m = 0; m < nets.length; m++) {
        if (m === k) continue;
        grid[nets[m].pins[0]] = BLOCK;
        grid[nets[m].pins[1]] = BLOCK;
      }
      var src = nets[k].pins[0], dst = nets[k].pins[1];
      grid[src] = EMPTY;
      grid[dst] = EMPTY;
      var r = route(grid, W, H, src, dst, algo);
      results.push(r);
      totalExplored += r.explored;
      if (r.path) {
        totalWL += r.path.length - 1;
        for (var p = 0; p < r.path.length; p++) work[r.path[p]] = ROUTED;
      } else {
        failed++;
      }
    }
    return {
      results: results,
      totalWL: totalWL,
      totalExplored: totalExplored,
      failed: failed,
    };
  }

  /* ----- presets ----- */

  var W = 44, H = 30;

  function blank() { return new Uint8Array(W * H); }

  function fillRect(grid, x0, y0, w, h) {
    for (var y = y0; y < y0 + h; y++)
      for (var x = x0; x < x0 + w; x++)
        if (x >= 0 && x < W && y >= 0 && y < H) grid[idx(x, y, W)] = BLOCK;
  }

  function presets() {
    var open = blank();

    var channel = blank();
    fillRect(channel, 22, 0, 1, H);            /* full wall */
    channel[idx(22, 15, W)] = EMPTY;           /* central gap: shortest for both nets */
    channel[idx(22, 2, W)] = EMPTY;            /* far gap: the detour */

    var macros = blank();
    fillRect(macros, 9, 5, 9, 11);
    fillRect(macros, 25, 13, 11, 9);
    fillRect(macros, 15, 21, 5, 9);
    fillRect(macros, 30, 2, 6, 6);

    return {
      open: {
        label: "Open field",
        grid: open,
        nets: [
          { pins: [idx(5, 8, W), idx(38, 22, W)] },
          { pins: [idx(5, 22, W), idx(38, 8, W)] },
        ],
      },
      channel: {
        label: "Shared channel",
        grid: channel,
        nets: [
          { pins: [idx(6, 4, W), idx(38, 26, W)] },
          { pins: [idx(6, 26, W), idx(38, 4, W)] },
        ],
      },
      macros: {
        label: "Macro maze",
        grid: macros,
        nets: [
          { pins: [idx(4, 4, W), idx(40, 26, W)] },
          { pins: [idx(4, 26, W), idx(40, 4, W)] },
          { pins: [idx(2, 15, W), idx(42, 15, W)] },
        ],
      },
    };
  }

  return {
    EMPTY: EMPTY, BLOCK: BLOCK, ROUTED: ROUTED,
    W: W, H: H,
    idx: idx,
    manhattan: manhattan,
    route: route,
    routeAll: routeAll,
    presets: presets,
    fillRect: fillRect,
    blank: blank,
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = MazeCore;
