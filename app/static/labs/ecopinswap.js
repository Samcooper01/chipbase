/* ECO lab: eco-pinswap (pin swap).
   A multi-input gate's inputs are logically equivalent but NOT electrically
   equal: each input pin has its own pin-to-output delay. If the latest-arriving
   signal is wired to the slowest pin, the path through the gate is longer than it
   needs to be. Swapping the signal onto a faster pin shortens the path with no
   new area (only the wiring changes). Output arrival = max over inputs of
   (signal arrival + that pin's delay); the learner reassigns signals to pins to
   minimise it. A transistor-level schematic shows WHY the pins differ: the input
   nearest the output switches the top of the series pull-down stack (fast, the
   internal nodes are already discharged) and the input nearest the supply rail
   switches the bottom (slow, it must discharge the whole stack last).
   window.EcoPinSwap = { evaluate, mount }. */
(function () {
  "use strict";
  var REQUIRED = 4.0;
  var SIGS = [{ id: "a", arr: 2.0 }, { id: "b", arr: 3.4 }, { id: "c", arr: 2.6 }];
  var PINS = [{ id: "A", pd: 0.9 }, { id: "B", pd: 0.4 }, { id: "C", pd: 0.6 }];
  var INIT = [1, 0, 2]; // pin A<-b (slow pin gets the latest signal): the bad start
  function analyze(asg) {
    var thr = [], out = -1e9, worst = 0;
    PINS.forEach(function (p, k) { var t = SIGS[asg[k]].arr + p.pd; thr.push(t); if (t > out) { out = t; worst = k; } });
    return { thr: thr, out: out, worst: worst, slack: REQUIRED - out, pass: out <= REQUIRED + 1e-9 };
  }
  function evaluate(spec, asg) { return analyze(asg); }

  function mount(container, spec) {
    var W = 560, Hpx = 240, dpr = window.devicePixelRatio || 1;
    var asg = INIT.slice(), sel = null, submitted = false, scoreObj = null;
    var rowY = [64, 116, 168], gx = 420, gTop = 44, gBot = 188, sigX = 26, sigW = 92, pinX = gx;

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas");
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "pointer"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "8px 0"; hint.style.maxWidth = W + "px";
    hint.innerHTML = "The gate's input pins are logically the same but have different <b>pin-to-output delays</b>. The output is ready at the worst of (signal arrival + its pin delay). Right now the latest signal sits on the slowest pin. <b>Click two input pins</b> to swap the signals feeding them, so the late signal takes a faster pin. No new area, just rewiring. Get the output at or under the required time (" + REQUIRED.toFixed(1) + "). The transistor-level reason each pin is fast or slow is drawn below.";
    left.appendChild(hint);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit wiring";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls);

    /* transistor-level schematic panel */
    var SW = 560, SH = 360;
    var schemTitle = document.createElement("div"); schemTitle.className = "mp-legend-title"; schemTitle.style.display = "block"; schemTitle.style.margin = "14px 0 4px"; schemTitle.style.borderTop = "1px solid #e6e3da"; schemTitle.style.paddingTop = "12px";
    schemTitle.innerHTML = "<b>Inside the gate: a 3-input NAND (Not-AND) in CMOS (Complementary Metal-Oxide-Semiconductor)</b>";
    left.appendChild(schemTitle);
    var schem = document.createElement("canvas");
    schem.width = SW * dpr; schem.height = SH * dpr; schem.style.width = SW + "px"; schem.style.height = SH + "px";
    schem.className = "mp-canvas"; var sctx = schem.getContext("2d"); sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(schem);
    var cap = document.createElement("div"); cap.className = "mp-legend-title"; cap.style.display = "block"; cap.style.margin = "8px 0 0"; cap.style.maxWidth = SW + "px"; cap.style.fontWeight = "400";
    cap.innerHTML = "Each input is the gate of one transistor in a series stack that runs from the output node <b>Y</b> down to GND (ground). When Y falls, the stack discharges through the whole path. The earlier-arriving inputs switch on first and pre-discharge the internal node capacitances (n1, n2). So if the <b>latest</b> signal drives the transistor <b>nearest the output</b>, only the small output node is left to move: that pin is fast. Put the late signal on the transistor <b>nearest the rail</b> and it must sink the charge of the entire stack at the last moment: that pin is slow. The rule is to place the latest-arriving signal on the pin closest to the output.";
    left.appendChild(cap);

    wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    var MET = "#3b82f6", OK = "#15803d", BAD = "#dc2626", DIM = "#334155", SELC = "#2563eb", MUT = "#6b7280";
    var hits = [];
    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx); hits = [];
      /* gate body (D shape with output bubble = inverting gate) */
      var r = (gBot - gTop) / 2, cy = (gTop + gBot) / 2, cxr = gx + 60 - r;
      ctx.beginPath(); ctx.moveTo(gx, gTop); ctx.lineTo(cxr, gTop); ctx.arc(cxr, cy, r, -Math.PI / 2, Math.PI / 2); ctx.lineTo(gx, gBot); ctx.closePath();
      ctx.fillStyle = "#eef1f7"; ctx.fill(); ctx.strokeStyle = "#334155"; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.fillStyle = "#5a606e"; ctx.font = "700 13px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("&", gx + 26, cy);
      var bubX = gx + 60 + 6;
      ctx.beginPath(); ctx.arc(bubX, cy, 5, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill(); ctx.strokeStyle = "#334155"; ctx.lineWidth = 1.4; ctx.stroke();
      /* output */
      var outX = bubX + 5;
      ctx.strokeStyle = "#334155"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(outX, cy); ctx.lineTo(outX + 16, cy); ctx.stroke();
      ctx.fillStyle = res.pass ? OK : BAD; ctx.font = "700 11px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("Y " + res.out.toFixed(2) + (res.pass ? " ≤ " : " > ") + REQUIRED.toFixed(1), outX + 20, cy);
      /* input rows */
      PINS.forEach(function (p, k) {
        var y = rowY[k], sg = SIGS[asg[k]], isWorst = k === res.worst, seld = sel === k;
        ctx.fillStyle = seld ? "rgba(37,99,237,0.12)" : "#faf9f5"; ctx.strokeStyle = seld ? SELC : "#c9c6bd"; ctx.lineWidth = seld ? 2 : 1.2; ctx.fillRect(sigX, y - 15, sigW, 30); ctx.strokeRect(sigX, y - 15, sigW, 30);
        ctx.fillStyle = "#1a1d26"; ctx.font = "bold 11px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("sig " + sg.id, sigX + 8, y - 4);
        ctx.fillStyle = MUT; ctx.font = "9px 'JetBrains Mono', monospace"; ctx.fillText("arr " + sg.arr.toFixed(1), sigX + 8, y + 8);
        ctx.strokeStyle = isWorst ? BAD : "#334155"; ctx.lineWidth = isWorst ? 2.4 : 1.6; ctx.beginPath(); ctx.moveTo(sigX + sigW, y); ctx.lineTo(pinX, y); ctx.stroke();
        ctx.fillStyle = MUT; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText("pin " + p.id + "  pd " + p.pd.toFixed(1), (sigX + sigW + pinX) / 2, y - 4);
        ctx.fillStyle = isWorst ? BAD : "#2d6a4f"; ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textBaseline = "top"; ctx.fillText((sg.arr + p.pd).toFixed(2), (sigX + sigW + pinX) / 2, y + 3);
        hits.push([sigX - 4, y - 20, pinX, y + 20, k]);
      });
      if (sel != null) { ctx.fillStyle = SELC; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText("select a second pin to swap", sigX, 214); }
    }

    /* draw one n-type transistor, vertical, centred at (cx,cy); glow = null|OK|BAD */
    function drawNfet(cx, cy, glow) {
      var col = glow || DIM, lw = glow ? 2.4 : 1.8;
      sctx.strokeStyle = col; sctx.lineWidth = lw;
      /* drain lead up, source lead down (they join the shared stack nodes) */
      sctx.beginPath(); sctx.moveTo(cx, cy - 30); sctx.lineTo(cx, cy - 14); sctx.stroke();
      sctx.beginPath(); sctx.moveTo(cx, cy + 14); sctx.lineTo(cx, cy + 30); sctx.stroke();
      /* channel bar */
      sctx.lineWidth = lw + 1; sctx.beginPath(); sctx.moveTo(cx, cy - 14); sctx.lineTo(cx, cy + 14); sctx.stroke();
      /* gate plate to the left */
      sctx.lineWidth = lw; sctx.beginPath(); sctx.moveTo(cx - 9, cy - 12); sctx.lineTo(cx - 9, cy + 12); sctx.stroke();
      /* gate lead */
      sctx.beginPath(); sctx.moveTo(cx - 9, cy); sctx.lineTo(cx - 46, cy); sctx.stroke();
      /* n-type source arrow: points up toward the channel */
      sctx.fillStyle = col; sctx.beginPath(); sctx.moveTo(cx, cy + 16); sctx.lineTo(cx - 4, cy + 23); sctx.lineTo(cx + 4, cy + 23); sctx.closePath(); sctx.fill();
    }
    function nodeCap(x, y, label) {
      sctx.strokeStyle = "#9aa0aa"; sctx.lineWidth = 1;
      sctx.beginPath(); sctx.moveTo(x, y); sctx.lineTo(x + 18, y); sctx.stroke();
      sctx.beginPath(); sctx.moveTo(x + 18, y - 5); sctx.lineTo(x + 18, y + 5); sctx.stroke();
      sctx.beginPath(); sctx.moveTo(x + 22, y - 5); sctx.lineTo(x + 22, y + 5); sctx.stroke();
      sctx.beginPath(); sctx.moveTo(x + 26, y + 2); sctx.lineTo(x + 30, y + 2); sctx.moveTo(x + 27, y + 4); sctx.lineTo(x + 29, y + 4); sctx.stroke();
      sctx.fillStyle = "#9aa0aa"; sctx.font = "8px 'JetBrains Mono', monospace"; sctx.textAlign = "left"; sctx.textBaseline = "middle"; sctx.fillText(label, x - 22, y);
    }

    function drawSchematic(res) {
      sctx.clearRect(0, 0, SW, SH);
      var SX = 250;                 // stack x
      var vddY = 40, gndY = 314, outY = 122;
      var lateSig = 0; SIGS.forEach(function (s, i) { if (s.arr > SIGS[lateSig].arr) lateSig = i; });
      /* supply rails */
      sctx.strokeStyle = "#334155"; sctx.lineWidth = 2;
      sctx.beginPath(); sctx.moveTo(120, vddY); sctx.lineTo(400, vddY); sctx.stroke();
      sctx.beginPath(); sctx.moveTo(120, gndY); sctx.lineTo(400, gndY); sctx.stroke();
      sctx.fillStyle = "#5a606e"; sctx.font = "700 9px 'JetBrains Mono', monospace"; sctx.textAlign = "left"; sctx.textBaseline = "bottom";
      sctx.fillText("VDD (positive supply rail)", 120, vddY - 5);
      sctx.textBaseline = "top"; sctx.fillText("GND (ground)", 120, gndY + 5);
      /* pull-up block */
      sctx.beginPath(); sctx.moveTo(SX, vddY); sctx.lineTo(SX, 66); sctx.stroke();
      sctx.fillStyle = "#f4f2ec"; sctx.strokeStyle = "#c9c6bd"; sctx.lineWidth = 1.4; sctx.fillRect(150, 66, 200, 40); sctx.strokeRect(150, 66, 200, 40);
      sctx.fillStyle = "#5a606e"; sctx.font = "9px 'JetBrains Mono', monospace"; sctx.textAlign = "center"; sctx.textBaseline = "middle";
      sctx.fillText("pull-up: A, B, C in parallel", 250, 80);
      sctx.fillText("(PMOS - p-type Metal-Oxide-Semiconductor)", 250, 94);
      /* output node + Y wire */
      sctx.strokeStyle = "#334155"; sctx.lineWidth = 2;
      sctx.beginPath(); sctx.moveTo(SX, 106); sctx.lineTo(SX, outY); sctx.stroke();
      sctx.beginPath(); sctx.moveTo(SX, outY); sctx.lineTo(430, outY); sctx.stroke();
      sctx.fillStyle = res.pass ? OK : BAD; sctx.beginPath(); sctx.arc(SX, outY, 3.5, 0, Math.PI * 2); sctx.fill();
      sctx.fillStyle = res.pass ? OK : BAD; sctx.font = "700 11px 'JetBrains Mono', monospace"; sctx.textAlign = "left"; sctx.textBaseline = "middle"; sctx.fillText("Y (output) " + res.out.toFixed(2), 436, outY);
      /* series pull-down stack, top -> bottom: B (fast), C, A (slow) */
      sctx.fillStyle = "#5a606e"; sctx.font = "700 9px 'JetBrains Mono', monospace"; sctx.textAlign = "left"; sctx.textBaseline = "top";
      sctx.fillText("series pull-down (NMOS - n-type Metal-Oxide-Semiconductor)", 96, outY + 6);
      var STACK = [
        { pin: 1, cy: 152, note: "nearest output = fast pin", ncol: OK },
        { pin: 2, cy: 212, note: "middle of the stack", ncol: MUT },
        { pin: 0, cy: 272, note: "nearest rail = slow pin", ncol: BAD }
      ];
      /* connect output node down to first drain */
      sctx.strokeStyle = "#334155"; sctx.lineWidth = 2; sctx.beginPath(); sctx.moveTo(SX, outY); sctx.lineTo(SX, STACK[0].cy - 30); sctx.stroke();
      /* internal-node caps */
      nodeCap(SX + 6, (152 + 30 + (212 - 30)) / 2, "n1");
      nodeCap(SX + 6, (212 + 30 + (272 - 30)) / 2, "n2");
      /* bottom source to GND */
      sctx.strokeStyle = "#334155"; sctx.lineWidth = 2; sctx.beginPath(); sctx.moveTo(SX, STACK[2].cy + 30); sctx.lineTo(SX, gndY); sctx.stroke();
      STACK.forEach(function (t) {
        var p = PINS[t.pin], sg = SIGS[asg[t.pin]], isWorst = t.pin === res.worst, isLate = asg[t.pin] === lateSig;
        drawNfet(SX, t.cy, isWorst ? BAD : (t.note.indexOf("fast") >= 0 ? OK : null));
        /* signal box on the gate lead */
        var bx = 44, bw = 150, by = t.cy - 16;
        sctx.fillStyle = isWorst ? "rgba(220,38,38,0.08)" : (isLate ? "rgba(37,99,237,0.08)" : "#faf9f5");
        sctx.strokeStyle = isWorst ? BAD : (isLate ? SELC : "#c9c6bd"); sctx.lineWidth = isWorst ? 2 : 1.2;
        sctx.fillRect(bx, by, bw, 32); sctx.strokeRect(bx, by, bw, 32);
        sctx.fillStyle = "#1a1d26"; sctx.font = "bold 11px 'JetBrains Mono', monospace"; sctx.textAlign = "left"; sctx.textBaseline = "middle";
        sctx.fillText("pin " + p.id + "  ←  sig " + sg.id, bx + 8, t.cy - 5);
        sctx.fillStyle = MUT; sctx.font = "9px 'JetBrains Mono', monospace"; sctx.fillText("arr " + sg.arr.toFixed(1) + " + pd " + p.pd.toFixed(1) + " = " + (sg.arr + p.pd).toFixed(2), bx + 8, t.cy + 8);
        /* gate lead from box to transistor gate */
        sctx.strokeStyle = isWorst ? BAD : "#334155"; sctx.lineWidth = isWorst ? 2 : 1.4; sctx.beginPath(); sctx.moveTo(bx + bw, t.cy); sctx.lineTo(SX - 46, t.cy); sctx.stroke();
        /* right-side position note */
        sctx.fillStyle = t.ncol; sctx.font = "700 9px 'JetBrains Mono', monospace"; sctx.textAlign = "left"; sctx.textBaseline = "middle"; sctx.fillText(t.note, SX + 40, t.cy - 6);
        if (isLate) { sctx.fillStyle = SELC; sctx.font = "8px 'JetBrains Mono', monospace"; sctx.fillText("latest-arriving signal is here", SX + 40, t.cy + 7); }
        else if (isWorst) { sctx.fillStyle = BAD; sctx.font = "8px 'JetBrains Mono', monospace"; sctx.fillText("this pin sets Y", SX + 40, t.cy + 7); }
      });
    }

    function computeScore(res) { var total = Math.round(Math.max(6000, Math.min(10000, 7000 + res.slack * 10000))), best = total; try { var key = "mp-best-" + (spec.id || "eco-pinswap"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {} return { total: total, best: best }; }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "meets timing" : "too slow") + '</div>';
      html += '<div class="mp-row ' + (res.pass ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.pass ? "✔" : "✗") + '</span><span class="mp-label">Output &le; required</span><span class="mp-detail">' + res.out.toFixed(2) + " / " + REQUIRED.toFixed(1) + '</span></div>';
      html += '<div class="mp-score"><span class="mp-score-note" style="font-size:11px">worst input: sig ' + SIGS[asg[res.worst]].id + ' on pin ' + PINS[res.worst].id + ' (arr ' + SIGS[asg[res.worst]].arr.toFixed(1) + ' + pd ' + PINS[res.worst].pd.toFixed(1) + ')</span></div>';
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div><div class="mp-flow-note">The late signal now takes a fast pin, so the path through the gate is shorter, at no area cost. Pairing the latest signal with the fastest pin gives the most slack.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>Output meets the required time.</b> Click <b>Submit wiring</b>.</div>';
      else html += '<div class="mp-score"><span class="mp-score-note">The latest signal is still on a slow pin (its arrival plus that pin\'s delay sets the output). Swap it onto the fastest pin, and put the earliest signals on the slower pins.</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, asg); draw(last); drawSchematic(last); render(last); bSubmit.disabled = submitted || !last.pass; bSubmit.classList.toggle("mp-ready", !submitted && last.pass); }
    function tap(e) {
      if (submitted) return; var r = canvas.getBoundingClientRect(), t = e.touches ? e.touches[0] : e, px = t.clientX - r.left, py = t.clientY - r.top;
      for (var i = 0; i < hits.length; i++) { var h = hits[i]; if (px >= h[0] && px <= h[2] && py >= h[1] && py <= h[3]) { var k = h[4]; if (sel == null) sel = k; else { var tmp = asg[sel]; asg[sel] = asg[k]; asg[k] = tmp; sel = null; scoreObj = null; } refresh(); break; } }
      e.preventDefault();
    }
    canvas.addEventListener("mousedown", tap); canvas.addEventListener("touchstart", tap, { passive: false });
    bSubmit.addEventListener("click", function () { if (!submitted && last && last.pass) { submitted = true; scoreObj = computeScore(last); refresh(); } });
    bReset.addEventListener("click", function () { asg = INIT.slice(); sel = null; submitted = false; scoreObj = null; refresh(); });
    refresh();
  }

  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.EcoPinSwap = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
