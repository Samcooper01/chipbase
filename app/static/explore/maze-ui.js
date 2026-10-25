/* Interactive layer for the maze-router explorable: canvas rendering,
   wavefront animation, and editing (blockages, pins, presets). All routing
   math lives in maze-core.js. */

(function () {
  "use strict";

  var M = MazeCore;
  var W = M.W, H = M.H;
  var CS = 17; /* cell size in css pixels */

  var COLORS = ["#16a34a", "#2563eb", "#d97706", "#db2777", "#7c3aed", "#0d9488"];
  var VALID_ALGOS = ["bfs", "hadlock", "soukup", "astar"];
  var MAX_NETS = 6;

  var canvas = document.getElementById("maze-canvas");
  var ctx = canvas.getContext("2d");

  /* Canvas palette from the page's --cv-* variables (the Sandboxes
     theme sets them), falling back to the light site palette. */
  function themeColor(name, fallback) {
    var v = getComputedStyle(canvas).getPropertyValue(name).trim();
    return v || fallback;
  }
  var T = {
    die: themeColor("--cv-die", "#fdfdfd"),
    grid: themeColor("--cv-grid", "rgba(15,23,42,0.07)"),
    block: themeColor("--cv-block", "#c3cad4"),
    ring: themeColor("--cv-ring", "#ffffff"),
  };
  var statsEl = document.getElementById("maze-stats");
  var hintEl = document.getElementById("maze-hint");

  var state = {
    blocks: M.blank(),
    nets: [],
    mode: "block",     /* block | erase | pin */
    algo: "bfs",
    pendingPin: null,
    run: null,          /* result of routeAll */
    anim: null,         /* {net, phase: expand|trace, k} */
    presets: M.presets(),
  };

  /* ----- setup ----- */

  function setupCanvas() {
    var dpr = window.devicePixelRatio || 1;
    canvas.style.width = W * CS + "px";
    canvas.style.height = H * CS + "px";
    canvas.width = W * CS * dpr;
    canvas.height = H * CS * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function loadPreset(key) {
    var p = state.presets[key];
    state.blocks = p.grid.slice();
    state.nets = p.nets.map(function (n) { return { pins: n.pins.slice() }; });
    state.pendingPin = null;
    clearRun();
    draw();
  }

  function clearRun() {
    state.run = null;
    state.anim = null;
    updateStats();
  }

  /* ----- routing + animation ----- */

  /* Exponential speed mapping: slider 0 reveals roughly two cells per
     second (slow enough to watch individual wavefront steps), the far
     right is instant. Fractional cells accumulate across frames so
     slower-than-one-cell-per-frame speeds work. */
  function cellsPerFrame() {
    var v = +document.getElementById("maze-speed").value;
    return 0.04 * Math.pow(2, v / 8);
  }

  function isInstant() {
    return +document.getElementById("maze-speed").value >= 100;
  }

  function runRouting() {
    if (!state.nets.length) {
      hint("Add at least one net first (Net pins mode, two clicks).");
      return;
    }
    state.run = M.routeAll(state.blocks, W, H, state.nets, state.algo);
    if (isInstant()) {
      state.anim = null;
      updateStats();
      draw();
      return;
    }
    state.anim = { net: 0, phase: "expand", k: 0, acc: 0 };
    requestAnimationFrame(tick);
  }

  function tick() {
    var anim = state.anim;
    if (!anim || !state.run) return;
    var cpf = cellsPerFrame();
    var res = state.run.results[anim.net];

    if (anim.phase === "expand") {
      anim.acc += cpf;
    } else {
      /* backtrace draws a touch slower than the wave, but never stalls */
      anim.acc += Math.max(cpf * 0.7, 0.05);
    }
    var step = Math.floor(anim.acc);
    anim.acc -= step;
    anim.k += step;

    if (anim.phase === "expand") {
      if (anim.k >= res.visits.length) {
        anim.phase = "trace";
        anim.k = 0;
        anim.acc = 0;
      }
    } else {
      var plen = res.path ? res.path.length : 0;
      if (anim.k >= plen) {
        anim.net += 1;
        anim.phase = "expand";
        anim.k = 0;
        anim.acc = 0;
        if (anim.net >= state.run.results.length) {
          state.anim = null;
          updateStats();
          draw();
          return;
        }
      }
    }
    draw();
    requestAnimationFrame(tick);
  }

  /* ----- drawing ----- */

  function cellCenter(i) {
    var x = i % W, y = (i / W) | 0;
    return [x * CS + CS / 2, y * CS + CS / 2];
  }

  function drawPath(path, upto, color, alpha) {
    if (!path || path.length < 2) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = CS * 0.45;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    var n = Math.min(upto, path.length);
    for (var p = 0; p < n; p++) {
      var c = cellCenter(path[p]);
      if (p === 0) ctx.moveTo(c[0], c[1]);
      else ctx.lineTo(c[0], c[1]);
    }
    ctx.stroke();
    ctx.restore();
  }

  function draw() {
    ctx.fillStyle = T.die;
    ctx.fillRect(0, 0, W * CS, H * CS);

    /* grid lines */
    ctx.strokeStyle = T.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var x = 0; x <= W; x++) { ctx.moveTo(x * CS, 0); ctx.lineTo(x * CS, H * CS); }
    for (var y = 0; y <= H; y++) { ctx.moveTo(0, y * CS); ctx.lineTo(W * CS, y * CS); }
    ctx.stroke();

    /* blockages (macros) */
    ctx.fillStyle = T.block;
    for (var i = 0; i < state.blocks.length; i++) {
      if (state.blocks[i]) {
        var bx = i % W, by = (i / W) | 0;
        ctx.fillRect(bx * CS + 1, by * CS + 1, CS - 2, CS - 2);
      }
    }

    var anim = state.anim;
    var run = state.run;

    if (run) {
      var lastFinished = anim ? anim.net : run.results.length;

      /* current net's expansion wavefront */
      if (anim) {
        var res = run.results[anim.net];
        var color = COLORS[anim.net % COLORS.length];
        var upto = anim.phase === "expand" ? anim.k : res.visits.length;
        ctx.save();
        for (var v = 0; v < Math.min(upto, res.visits.length); v++) {
          var vis = res.visits[v];
          var vx = vis.i % W, vy = (vis.i / W) | 0;
          ctx.globalAlpha = 0.14 + 0.20 * ((vis.wave % 6) / 5);
          ctx.fillStyle = color;
          ctx.fillRect(vx * CS + 1, vy * CS + 1, CS - 2, CS - 2);
        }
        ctx.restore();
        if (anim.phase === "trace") {
          drawPath(res.path, anim.k, color, 1.0);
        }
      }

      /* committed paths of finished nets */
      for (var f = 0; f < lastFinished && f < run.results.length; f++) {
        drawPath(run.results[f].path, Infinity, COLORS[f % COLORS.length], 0.95);
      }
    }

    /* pins */
    for (var nIdx = 0; nIdx < state.nets.length; nIdx++) {
      var netColor = COLORS[nIdx % COLORS.length];
      var netFailed = run && !state.anim &&
        run.results[nIdx] && run.results[nIdx].path === null;
      state.nets[nIdx].pins.forEach(function (pin) {
        var c = cellCenter(pin);
        ctx.beginPath();
        ctx.arc(c[0], c[1], CS * 0.36, 0, Math.PI * 2);
        ctx.fillStyle = netColor;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = netFailed ? "#dc2626" : T.ring;
        ctx.stroke();
      });
    }

    /* pending pin marker */
    if (state.pendingPin !== null) {
      var pc = cellCenter(state.pendingPin);
      ctx.beginPath();
      ctx.arc(pc[0], pc[1], CS * 0.36, 0, Math.PI * 2);
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = COLORS[state.nets.length % COLORS.length];
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  /* ----- stats ----- */

  function updateStats() {
    if (!state.run || state.anim) {
      statsEl.innerHTML = "";
      return;
    }
    var run = state.run;
    var html = "";
    run.results.forEach(function (r, i) {
      var color = COLORS[i % COLORS.length];
      var wl = r.path ? (r.path.length - 1) : null;
      html += '<div class="mstat-row">' +
        '<span class="mstat-dot" style="background:' + color + '"></span>' +
        "net " + (i + 1) + ": " +
        (wl !== null
          ? "wirelength " + wl + ", " + r.explored + " cells explored"
          : '<span class="mstat-fail">FAILED (no path left)</span>, ' +
            r.explored + " cells explored") +
        "</div>";
    });
    html += '<div class="mstat-total">total wirelength ' + run.totalWL +
      " · total cells explored " + run.totalExplored +
      (run.failed ? ' · <span class="mstat-fail">' + run.failed + " net(s) failed</span>" : "") +
      "</div>";
    statsEl.innerHTML = html;
  }

  function hint(text) {
    hintEl.textContent = text;
    setTimeout(function () {
      if (hintEl.textContent === text) hintEl.textContent = "";
    }, 4000);
  }

  /* ----- editing ----- */

  function eventCell(ev) {
    var rect = canvas.getBoundingClientRect();
    var x = Math.floor((ev.clientX - rect.left) / CS);
    var y = Math.floor((ev.clientY - rect.top) / CS);
    if (x < 0 || x >= W || y < 0 || y >= H) return null;
    return M.idx(x, y, W);
  }

  function pinNetIndex(cell) {
    for (var i = 0; i < state.nets.length; i++) {
      if (state.nets[i].pins.indexOf(cell) !== -1) return i;
    }
    return -1;
  }

  function applyEdit(cell) {
    if (cell === null) return;
    if (state.mode === "block") {
      if (pinNetIndex(cell) !== -1) return;
      if (!state.blocks[cell]) { state.blocks[cell] = M.BLOCK; clearRun(); draw(); }
    } else if (state.mode === "erase") {
      var ni = pinNetIndex(cell);
      if (ni !== -1) {
        state.nets.splice(ni, 1);
        clearRun(); draw();
        return;
      }
      if (state.blocks[cell]) { state.blocks[cell] = M.EMPTY; clearRun(); draw(); }
    }
  }

  var painting = false;
  canvas.addEventListener("mousedown", function (ev) {
    var cell = eventCell(ev);
    if (state.mode === "pin") {
      if (cell === null || state.blocks[cell] || pinNetIndex(cell) !== -1) return;
      if (state.pendingPin === null) {
        state.pendingPin = cell;
      } else if (cell !== state.pendingPin) {
        if (state.nets.length >= MAX_NETS) {
          hint("Limit of " + MAX_NETS + " nets - erase one first.");
        } else {
          state.nets.push({ pins: [state.pendingPin, cell] });
        }
        state.pendingPin = null;
        clearRun();
      }
      draw();
      return;
    }
    painting = true;
    applyEdit(cell);
  });
  canvas.addEventListener("mousemove", function (ev) {
    if (painting) applyEdit(eventCell(ev));
  });
  window.addEventListener("mouseup", function () { painting = false; });

  /* ----- controls ----- */

  document.getElementById("maze-run").addEventListener("click", runRouting);

  document.getElementById("maze-swap").addEventListener("click", function () {
    state.nets.reverse();
    var hadRun = !!state.run;
    clearRun();
    draw();
    if (hadRun) runRouting();
  });

  document.getElementById("maze-clear-routes").addEventListener("click", function () {
    clearRun();
    draw();
  });

  document.getElementById("maze-clear-all").addEventListener("click", function () {
    state.blocks = M.blank();
    state.nets = [];
    state.pendingPin = null;
    clearRun();
    draw();
  });

  document.getElementById("maze-preset").addEventListener("change", function (ev) {
    loadPreset(ev.target.value);
  });

  document.querySelectorAll("input[name='maze-algo']").forEach(function (radio) {
    radio.addEventListener("change", function (ev) {
      state.algo = ev.target.value;
      if (state.run) runRouting();
    });
  });

  document.querySelectorAll("#maze-modes .seg-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll("#maze-modes .seg-btn").forEach(function (b) {
        b.classList.remove("active");
      });
      btn.classList.add("active");
      state.mode = btn.dataset.mode;
      state.pendingPin = null;
      draw();
    });
  });

  /* ----- go ----- */

  setupCanvas();
  loadPreset("channel");

  /* deep links from the routing catalog: /explore/maze-router?algo=hadlock */
  var requested = new URLSearchParams(window.location.search).get("algo");
  if (requested && VALID_ALGOS.indexOf(requested) !== -1) {
    state.algo = requested;
    var radio = document.querySelector(
      "input[name='maze-algo'][value='" + requested + "']"
    );
    if (radio) radio.checked = true;
  }
})();
