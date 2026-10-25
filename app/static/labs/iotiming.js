/* STA: interface (input/output) timing. On an I/O path the internal design owns
   only PART of the clock period; the rest is off-chip, captured by
   set_input_delay / set_output_delay. The clock period here is FIXED. Several
   interface paths are shown as budget bars against the capture edge. For each
   one, pick the MINIMAL fix that closes it:
     - LEAVE it if it already meets;
     - OPTIMIZE the internal logic if the internal part is the bottleneck;
     - REGISTER the boundary port (a flop at the pin) only when the off-chip part
       is so large the path cannot fit even with optimized logic - because
       registering costs an extra cycle of latency you should not spend for free.
   The skill is reading the budget split and aiming the fix at the real
   bottleneck. window.StaIo = { evaluate, mount }. */
(function () {
  "use strict";
  var ACT = ["leave", "optimize", "register"];
  function asIs(spec, p) { return p.kind === "in" ? p.ext + p.logic + spec.ts : spec.tcq + p.logic + p.ext; }
  function opt(spec, p) { return p.kind === "in" ? p.ext + p.min + spec.ts : spec.tcq + p.min + p.ext; }
  function regA(spec, p) { return p.kind === "in" ? p.ext + spec.ts : spec.tcq + p.logic + spec.ts; }
  function regB(spec, p) { return p.kind === "in" ? spec.tcq + p.logic + spec.ts : spec.tcq + p.ext; }
  function meetsUnder(spec, p, a) { var T = spec.T; if (a === 0) return asIs(spec, p) <= T + 1e-9; if (a === 1) return opt(spec, p) <= T + 1e-9; return regA(spec, p) <= T + 1e-9 && regB(spec, p) <= T + 1e-9; }
  function correctAction(spec, p) { for (var a = 0; a < 3; a++) if (meetsUnder(spec, p, a)) return a; return 2; }
  function evaluate(spec, actions) {
    var res = spec.paths.map(function (p, i) {
      var a = actions[i], correct = correctAction(spec, p), meets = meetsUnder(spec, p, a);
      var status = a === correct ? "ok" : (meets ? "overfix" : "fails");
      return { meets: meets, correct: correct, chosen: a, ok: a === correct, status: status };
    });
    var pass = res.every(function (r) { return r.ok; });
    return { paths: res, pass: pass };
  }
  function mount(container, spec) {
    var W = 640, dpr = window.devicePixelRatio || 1;
    var actions = spec.paths.map(function () { return 0; }), submitted = false, scoreObj = null;
    var xLbl = 12, xBar = 172, scale = 148, rowH = 58, gap = 8, top = 46;
    var Tx = xBar + spec.T * scale;
    var Hpx = top + spec.paths.length * (rowH + gap) + 34;

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas");
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "pointer"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "8px 0"; hint.style.maxWidth = W + "px";
    hint.innerHTML = "Click a path to cycle its fix: <b>leave</b> / <b>optimize logic</b> / <b>register port</b>. Pick the <b>cheapest</b> fix that makes the bar fit inside the capture edge. Register (which adds a cycle of latency) only when even optimized logic cannot absorb the off-chip delay.";
    left.appendChild(hint);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit fixes";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    var COL = { ext: "#9aa0aa", logic: "#2a5cc8", opt: "#5b8def", cq: "#334155", setup: "#d97706" };
    var ABADGE = ["#64748b", "#2a5cc8", "#7c3aed"], ALABEL = ["leave as-is", "optimize logic", "register port (+1 cyc)"];
    function bar(y, h, segs, ghost) {
      var x = xBar, total = 0;
      segs.forEach(function (s) {
        var w = s.len * scale;
        ctx.fillStyle = s.col; ctx.fillRect(x, y, w, h); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h);
        if (x + w > Tx) { ctx.fillStyle = "rgba(220,38,38,0.45)"; ctx.fillRect(Math.max(x, Tx), y, x + w - Math.max(x, Tx), h); }
        if (w > 22 && s.tag) { ctx.fillStyle = "#fff"; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(s.tag, x + w / 2, y + h / 2); }
        x += w; total += s.len;
      });
      if (ghost && ghost > 1e-9) { ctx.strokeStyle = "rgba(37,99,237,0.5)"; ctx.setLineDash([3, 2]); ctx.lineWidth = 1; ctx.strokeRect(x, y, ghost * scale, h); ctx.setLineDash([]); ctx.fillStyle = "#8aa0d8"; ctx.font = "7px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; if (ghost * scale > 20) ctx.fillText("saved", x + ghost * scale / 2, y + h / 2); }
      var slack = spec.T - total;
      ctx.fillStyle = slack >= -1e-9 ? "#15803d" : "#dc2626"; ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText((slack >= 0 ? "+" : "") + slack.toFixed(2), Math.max(x, Tx) + 8, y + h / 2);
      return slack;
    }
    var rowHit = [];
    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx); rowHit = [];

      spec.paths.forEach(function (p, i) {
        var y = top + i * (rowH + gap), a = actions[i], r = res.paths[i];
        /* row frame + click feedback */
        var frame = "#e6e3da", fw = 1;
        if (submitted) { frame = r.ok ? "#15803d" : "#dc2626"; fw = 2; }
        ctx.fillStyle = "#faf9f5"; ctx.fillRect(4, y, W - 8, rowH); ctx.strokeStyle = frame; ctx.lineWidth = fw; ctx.strokeRect(4, y, W - 8, rowH);
        /* label */
        ctx.fillStyle = "#1a1d26"; ctx.font = "bold 10px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText(p.name, xLbl, y + 7);
        ctx.fillStyle = "#8a90a0"; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.fillText(p.kind === "in" ? "input path" : "output path", xLbl, y + 21);
        /* action badge */
        ctx.fillStyle = ABADGE[a]; ctx.fillRect(xLbl, y + 34, 150, 16); ctx.fillStyle = "#fff"; ctx.font = "700 8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(ALABEL[a], xLbl + 75, y + 42);

        /* bars per action */
        if (a === 2) {
          var A = p.kind === "in" ? [{ len: p.ext, col: COL.ext, tag: "in " + p.ext.toFixed(2) }, { len: spec.ts, col: COL.setup, tag: "su" }]
                                  : [{ len: spec.tcq, col: COL.cq, tag: "cq" }, { len: p.logic, col: COL.logic, tag: "logic" }, { len: spec.ts, col: COL.setup, tag: "su" }];
          var B = p.kind === "in" ? [{ len: spec.tcq, col: COL.cq, tag: "cq" }, { len: p.logic, col: COL.logic, tag: "logic" }, { len: spec.ts, col: COL.setup, tag: "su" }]
                                  : [{ len: spec.tcq, col: COL.cq, tag: "cq" }, { len: p.ext, col: COL.ext, tag: "out " + p.ext.toFixed(2) }];
          bar(y + 6, 18, A); bar(y + 32, 18, B);
        } else {
          var lg = a === 1 ? p.min : p.logic, ghost = a === 1 ? (p.logic - p.min) : 0;
          var segs = p.kind === "in"
            ? [{ len: p.ext, col: COL.ext, tag: "in delay " + p.ext.toFixed(2) }, { len: lg, col: a === 1 ? COL.opt : COL.logic, tag: "logic " + lg.toFixed(2) }, { len: spec.ts, col: COL.setup, tag: "su" }]
            : [{ len: spec.tcq, col: COL.cq, tag: "cq" }, { len: lg, col: a === 1 ? COL.opt : COL.logic, tag: "logic " + lg.toFixed(2) }, { len: p.ext, col: COL.ext, tag: "out delay " + p.ext.toFixed(2) }];
          bar(y + 20, 18, segs, ghost);
        }
        rowHit.push([4, y, W - 4, y + rowH, i]);
      });
      /* capture edge line (fixed period) - drawn on top of the bars */
      ctx.strokeStyle = "#c23c32"; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(Tx, 30); ctx.lineTo(Tx, Hpx - 30); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = "#c23c32"; ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText("capture edge  T=" + spec.T.toFixed(2) + " (fixed)", Tx, 28);
      ctx.fillStyle = "#8a90a0"; ctx.textAlign = "left"; ctx.fillText("launch", xBar, 28);
      /* legend */
      var ly = Hpx - 20, lx = xLbl;
      [["off-chip I/O delay", COL.ext], ["internal logic", COL.logic], ["clk-to-Q", COL.cq], ["setup", COL.setup]].forEach(function (it) { ctx.fillStyle = it[1]; ctx.fillRect(lx, ly, 11, 10); ctx.fillStyle = "#5a606e"; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(it[0], lx + 14, ly + 5); lx += ctx.measureText(it[0]).width + 32; });
    }
    function computeScore() { var total = 10000, best = total; try { var key = "mp-best-" + (spec.id || "sta-io"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {} return { total: total, best: best }; }
    function render(res) {
      var nReg = actions.filter(function (a) { return a === 2; }).length;
      var html;
      if (!submitted) {
        var closed = res.paths.filter(function (r) { return r.meets; }).length;
        html = '<div class="mp-verdict" style="background:#eceae2;color:#5a606e">triage the paths</div>';
        html += '<div class="mp-score"><span class="mp-score-note">' + spec.hint + '</span></div>';
        html += '<div class="mp-score"><span class="mp-score-note" style="font-size:11px">' + closed + " / " + res.paths.length + ' paths currently fit &middot; ' + nReg + ' registered (adds latency)</span></div>';
      } else {
        var nOK = res.paths.filter(function (r) { return r.ok; }).length;
        html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "PASS" : nOK + " / " + res.paths.length) + '</div>';
        spec.paths.forEach(function (p, i) {
          var r = res.paths[i], msg = r.status === "ok" ? ALABEL[r.correct] : (r.status === "overfix" ? "over-fixed: closes, but " + ALABEL[r.chosen] + " adds needless latency - " + ALABEL[r.correct] + " is enough" : "still fails: " + ALABEL[r.chosen] + " does not fit; needs " + ALABEL[r.correct]);
          html += '<div class="mp-row ' + (r.ok ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (r.ok ? "✔" : "✗") + '</span><span class="mp-label">' + p.name + '</span></div>';
          html += '<div class="mp-score"><span class="mp-score-note" style="font-size:11px">' + msg + '</span></div>';
        });
        if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div><div class="mp-flow-note">Each fix aimed at the real bottleneck: optimize when your logic is the problem, register only when the off-chip delay is too big to absorb. Registering everything would close timing but waste latency.</div></div>';
        else if (!res.pass) html += '<div class="mp-score"><span class="mp-score-note">Red rows are wrong. A path fails when even its chosen fix overflows the edge; it is "over-fixed" when you registered (added a cycle) where optimizing the logic would have fit.</span></div>';
      }
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, actions); draw(last); render(last); bSubmit.disabled = submitted; bSubmit.classList.toggle("mp-ready", !submitted); }
    function tap(e) { if (submitted) return; var r0 = canvas.getBoundingClientRect(), px = (e.touches ? e.touches[0].clientX : e.clientX) - r0.left, py = (e.touches ? e.touches[0].clientY : e.clientY) - r0.top; for (var i = 0; i < rowHit.length; i++) { var h = rowHit[i]; if (px >= h[0] && px <= h[2] && py >= h[1] && py <= h[3]) { actions[h[4]] = (actions[h[4]] + 1) % 3; refresh(); break; } } e.preventDefault(); }
    canvas.addEventListener("mousedown", tap); canvas.addEventListener("touchstart", tap, { passive: false });
    bSubmit.addEventListener("click", function () { if (!submitted) { submitted = true; if (evaluate(spec, actions).pass) scoreObj = computeScore(); refresh(); } });
    bReset.addEventListener("click", function () { actions = spec.paths.map(function () { return 0; }); submitted = false; scoreObj = null; refresh(); });
    refresh();
  }
  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.StaIo = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
