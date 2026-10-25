/* Step-through walkthrough figures for the Lee algorithm page.
   Scans for .walk-fig containers and instantiates a small grid diagram in
   each. Modes:
     model  - static labeled diagram of the grid, pins, and obstacles
     expand - stepper: breadth-first wave floods outward, one distance
              ring per step, every cell showing its distance label
     trace  - stepper: grid pre-flooded, backtrace walks the labels
              downhill from target to source
   Pure canvas + a few buttons; no dependencies. */

(function () {
  "use strict";

  /* one shared scenario so the three figures tell one story */
  var W = 15, H = 10, CS = 30;
  var SRC = { x: 2, y: 6 };
  var DST = { x: 12, y: 6 };
  var WALLS = [];
  (function () {
    for (var y = 3; y < H; y++) WALLS.push({ x: 7, y: y }); /* wall, gap on top */
    WALLS.push({ x: 4, y: 2 });
    WALLS.push({ x: 10, y: 3 });
  })();

  var INK = "#1a1d26", MUT = "#5f6470", GREEN = "#16a34a",
      GREEN_DEEP = "#15803d", BLUE = "#2f6fed", BLOCK = "#c3cad4";

  function key(x, y) { return y * W + x; }

  function isWall(x, y) {
    return WALLS.some(function (w) { return w.x === x && w.y === y; });
  }

  /* breadth-first flood: dist map + list of rings (cells per distance) */
  function flood() {
    var dist = {};
    dist[key(SRC.x, SRC.y)] = 0;
    var rings = [[{ x: SRC.x, y: SRC.y }]];
    var frontier = rings[0];
    var found = false;
    while (frontier.length && !found) {
      var next = [];
      frontier.forEach(function (c) {
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
          var nx = c.x + d[0], ny = c.y + d[1];
          if (nx < 0 || nx >= W || ny < 0 || ny >= H) return;
          if (isWall(nx, ny)) return;
          if (dist[key(nx, ny)] !== undefined) return;
          dist[key(nx, ny)] = dist[key(c.x, c.y)] + 1;
          next.push({ x: nx, y: ny });
          if (nx === DST.x && ny === DST.y) found = true;
        });
      });
      if (next.length) rings.push(next);
      frontier = next;
    }
    /* backtrace: from the target, descend labels (prefer left, up, right, down) */
    var path = [{ x: DST.x, y: DST.y }];
    var cur = { x: DST.x, y: DST.y };
    while (!(cur.x === SRC.x && cur.y === SRC.y)) {
      var d = dist[key(cur.x, cur.y)];
      var stepTo = null;
      [[-1, 0], [0, -1], [1, 0], [0, 1]].some(function (dd) {
        var nx = cur.x + dd[0], ny = cur.y + dd[1];
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) return false;
        if (dist[key(nx, ny)] === d - 1) { stepTo = { x: nx, y: ny }; return true; }
        return false;
      });
      cur = stepTo;
      path.push(cur);
    }
    path.reverse();
    return { dist: dist, rings: rings, path: path };
  }

  var FLOOD = flood();

  /* ----- drawing ----- */

  function drawBase(ctx) {
    ctx.fillStyle = "#fdfdfd";
    ctx.fillRect(0, 0, W * CS, H * CS);
    ctx.strokeStyle = "rgba(15,23,42,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var x = 0; x <= W; x++) { ctx.moveTo(x * CS, 0); ctx.lineTo(x * CS, H * CS); }
    for (var y = 0; y <= H; y++) { ctx.moveTo(0, y * CS); ctx.lineTo(W * CS, y * CS); }
    ctx.stroke();
    WALLS.forEach(function (w) {
      ctx.fillStyle = BLOCK;
      ctx.fillRect(w.x * CS + 1, w.y * CS + 1, CS - 2, CS - 2);
    });
  }

  function drawPin(ctx, cell, color, label) {
    ctx.beginPath();
    ctx.arc(cell.x * CS + CS / 2, cell.y * CS + CS / 2, CS * 0.34, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, cell.x * CS + CS / 2, cell.y * CS + CS / 2 + 0.5);
  }

  function drawDistCell(ctx, c, current) {
    var d = FLOOD.dist[key(c.x, c.y)];
    ctx.fillStyle = current
      ? "rgba(22, 163, 74, 0.38)"
      : "rgba(22, 163, 74, 0.13)";
    ctx.fillRect(c.x * CS + 1, c.y * CS + 1, CS - 2, CS - 2);
    ctx.fillStyle = current ? GREEN_DEEP : MUT;
    ctx.font = (current ? "bold " : "") + "11px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(d), c.x * CS + CS / 2, c.y * CS + CS / 2 + 0.5);
  }

  /* draw the traced portion of the path: from the target end (the back
     of the path array) down to fromIdx, since backtrace grows from T */
  function drawPathSegment(ctx, fromIdx) {
    if (fromIdx < 0) fromIdx = 0;
    ctx.strokeStyle = GREEN;
    ctx.lineWidth = CS * 0.28;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    var first = true;
    for (var i = FLOOD.path.length - 1; i >= fromIdx; i--) {
      var c = FLOOD.path[i];
      var px = c.x * CS + CS / 2, py = c.y * CS + CS / 2;
      if (first) { ctx.moveTo(px, py); first = false; }
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  /* ----- widget ----- */

  function makeWidget(container) {
    var mode = container.dataset.mode;
    var canvas = document.createElement("canvas");
    var dpr = window.devicePixelRatio || 1;
    canvas.style.width = W * CS + "px";
    canvas.style.height = H * CS + "px";
    canvas.width = W * CS * dpr;
    canvas.height = H * CS * dpr;
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var wrap = document.createElement("div");
    wrap.className = "walk-canvas-wrap";
    wrap.appendChild(canvas);
    container.appendChild(wrap);

    var status = document.createElement("div");
    status.className = "walk-status";
    var controls = null;
    var step = 0;
    var timer = null;

    var maxStep = mode === "expand" ? FLOOD.rings.length - 1
                : mode === "trace" ? FLOOD.path.length - 1
                : 0;

    function render() {
      drawBase(ctx);
      if (mode === "model") {
        /* nothing extra: pins + walls tell the story */
      } else if (mode === "expand") {
        for (var r = 1; r <= step; r++) {
          FLOOD.rings[r].forEach(function (c) {
            if (c.x === DST.x && c.y === DST.y) return;
            drawDistCell(ctx, c, r === step);
          });
        }
        if (step >= maxStep) {
          status.textContent =
            "The wave labels the target at distance " + maxStep +
            ": a shortest path has exactly " + maxStep + " steps. " +
            "Cells visited so far: " + countVisited(step) + ".";
        } else if (step === 0) {
          status.textContent =
            "Press Step: each press expands the wave by one distance ring.";
        } else {
          status.textContent =
            "Ring " + step + ": every cell labeled " + step +
            " is exactly " + step + " steps from the source. " +
            "Cells visited so far: " + countVisited(step) + ".";
        }
      } else if (mode === "trace") {
        Object.keys(FLOOD.dist).forEach(function (k) {
          var x = k % W, y = Math.floor(k / W);
          if (x === SRC.x && y === SRC.y) return;
          if (x === DST.x && y === DST.y) return;
          drawDistCell(ctx, { x: x, y: y }, false);
        });
        drawPathSegment(ctx, FLOOD.path.length - 1 - step);
        var remaining = maxStep - step;
        if (step === 0) {
          status.textContent =
            "Press Step: from the target, walk to any neighbor whose label " +
            "is exactly one smaller.";
        } else if (step >= maxStep) {
          status.textContent =
            "Back at the source: the labels can only descend " + maxStep +
            " times, so the traced path is provably shortest.";
        } else {
          var cell = FLOOD.path[FLOOD.path.length - 1 - step];
          status.textContent =
            "At label " + FLOOD.dist[key(cell.x, cell.y)] +
            ": step to a neighbor labeled " +
            (FLOOD.dist[key(cell.x, cell.y)] - 1) +
            " (ties are fine - any choice stays shortest). " +
            remaining + " steps to go.";
        }
      }
      drawPin(ctx, SRC, GREEN_DEEP, "S");
      drawPin(ctx, DST, BLUE, "T");
    }

    function countVisited(uptoRing) {
      var n = 0;
      for (var r = 0; r <= uptoRing; r++) n += FLOOD.rings[r].length;
      return n;
    }

    function stop() {
      if (timer) { clearInterval(timer); timer = null; }
      if (controls) controls.play.textContent = "Auto";
    }

    if (mode !== "model") {
      controls = {};
      var bar = document.createElement("div");
      bar.className = "walk-controls";
      [["step", "Step"], ["play", "Auto"], ["reset", "Reset"]].forEach(function (b) {
        var btn = document.createElement("button");
        btn.className = "btn btn-ghost walk-btn";
        btn.textContent = b[1];
        bar.appendChild(btn);
        controls[b[0]] = btn;
      });
      container.appendChild(bar);

      controls.step.addEventListener("click", function () {
        stop();
        if (step < maxStep) step += 1;
        render();
      });
      controls.play.addEventListener("click", function () {
        if (timer) { stop(); return; }
        controls.play.textContent = "Pause";
        timer = setInterval(function () {
          if (step >= maxStep) { stop(); return; }
          step += 1;
          render();
        }, 550);
      });
      controls.reset.addEventListener("click", function () {
        stop();
        step = 0;
        render();
      });
    }

    container.appendChild(status);
    if (mode === "model") {
      status.textContent =
        "The playing field: source S, target T, and blockages (gray). The " +
        "wall between the pins has one opening, at the top.";
    }
    render();
  }

  document.querySelectorAll(".walk-fig").forEach(makeWidget);
})();
