/* Physical Verification lab: pv-erc-ties (floating nodes and tie cells).
   A real gate-level slice drawn with cell symbols. ERC (Electrical Rule Check)
   flags every input that is not properly driven, but the fix depends on WHAT the
   input is:
     - a DRIVEN input is already correct: leave it (tying it would fight the
       driver, a contention short);
     - a floating CONSTANT control input is held through a TIE CELL: tie-high for
       a 1, tie-low for a 0;
     - a floating DATA input is a wiring bug (a real open) and must be ROUTED to
       its net, not tied - a tie would hide the missing connection.
   The learner sets the right disposition on each flagged pin.
   window.PvErc = { evaluate, mount }. */
(function () {
  "use strict";
  var OPTS = ["leave", "tiehi", "tielo", "net"];
  /* each gate has ONE flagged input pin; kind sets the correct disposition */
  var GATES = [
    { id: "U1", type: "NAND2", pin: "blk_en", kind: "const1", why: "block enable, needs 1", driven: [{ o: 0.30, net: "in0" }], fy: 0.70 },
    { id: "U2", type: "AND2", pin: "sel_cfg", kind: "const0", why: "unused config, needs 0", driven: [{ o: 0.30, net: "in1" }], fy: 0.70 },
    { id: "U3", type: "INV", pin: "acc", kind: "data", why: "data input, must be driven", net: "acc_bus", driven: [], fy: 0.50 },
    { id: "U4", type: "DFF", pin: "rst_n", kind: "const1", why: "async reset, unused, needs 1", driven: [{ o: 0.22, net: "d" }, { o: 0.80, net: "clk", clk: true }], fy: 0.50 },
    { id: "U5", type: "OR2", pin: "q", kind: "driven", why: "already driven by the flop", driven: [{ o: 0.70, net: "en" }], fy: 0.30 }
  ];
  function correctOf(g) { return { driven: "leave", const1: "tiehi", const0: "tielo", data: "net" }[g.kind]; }
  function evaluate(spec, disp) {
    var wrong = [];
    GATES.forEach(function (g) { if ((disp[g.id] || "leave") !== correctOf(g)) wrong.push(g.id); });
    return { wrong: wrong, pass: wrong.length === 0 };
  }

  function mount(container, spec) {
    var W = 660, Hpx = 336, dpr = window.devicePixelRatio || 1;
    var disp = {}; GATES.forEach(function (g) { disp[g.id] = "leave"; });
    var submitted = false, scoreObj = null;
    var vddY = 34, gndY = 296, gy = 150, gh = 54, gw = 54;
    function gx(i) { return 72 + i * 118; }

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var leftEl = document.createElement("div"); leftEl.className = "mp-left";
    var canvas = document.createElement("canvas");
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "pointer"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    leftEl.appendChild(canvas);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "8px 0"; hint.style.maxWidth = W + "px";
    hint.innerHTML = "ERC (Electrical Rule Check) flags each highlighted input. Click a pin to cycle its fix, and match what the input is: <b>leave</b> an input already driven, <b>tie-high</b> / <b>tie-low</b> a floating control input that must hold a constant, or <b>route a net</b> to a floating <b>data</b> input (a real open, which a tie would only hide). See the netlist for each pin's role.";
    leftEl.appendChild(hint);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit fixes";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); leftEl.appendChild(ctrls); wrap.appendChild(leftEl);

    var rightCol = document.createElement("div"); rightCol.style.cssText = "display:flex;flex-direction:column;gap:12px";
    var nlCard = document.createElement("div"); nlCard.style.cssText = "border:1px solid #c9c6bd;border-radius:8px;padding:12px 14px;background:#faf9f5;min-width:250px";
    var panel = document.createElement("div"); panel.className = "mp-panel";
    rightCol.appendChild(nlCard); rightCol.appendChild(panel); wrap.appendChild(rightCol);
    container.appendChild(wrap);

    var MET = "#3b82f6", OK = "#15803d", BAD = "#dc2626", DIM = "#334155", VDDC = "#b91c1c", GNDC = "#1f2937", NETC = "#0f9d8c";

    function gateShape(type, x, y, w, h) {
      ctx.beginPath();
      if (type === "NAND2" || type === "AND2") { var r = h / 2, cx = x + w - r; ctx.moveTo(x, y); ctx.lineTo(cx, y); ctx.arc(cx, y + r, r, -Math.PI / 2, Math.PI / 2); ctx.lineTo(x, y + h); ctx.closePath(); }
      else if (type === "OR2" || type === "NOR2") { ctx.moveTo(x, y); ctx.quadraticCurveTo(x + w * 0.55, y, x + w, y + h / 2); ctx.quadraticCurveTo(x + w * 0.55, y + h, x, y + h); ctx.quadraticCurveTo(x + w * 0.30, y + h / 2, x, y); ctx.closePath(); }
      else if (type === "INV") { ctx.moveTo(x, y); ctx.lineTo(x + w - 8, y + h / 2); ctx.lineTo(x, y + h); ctx.closePath(); }
      else { ctx.rect(x, y, w, h); }
      ctx.fillStyle = "#eef1f7"; ctx.fill(); ctx.strokeStyle = "#334155"; ctx.lineWidth = 1.6; ctx.stroke();
      if (type === "NAND2" || type === "NOR2" || type === "INV") { var bx0 = type === "INV" ? x + w - 5 : x + w + 3; ctx.beginPath(); ctx.arc(bx0, y + h / 2, 3, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill(); ctx.stroke(); }
    }
    var hits = [];
    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx);
      ctx.strokeStyle = VDDC; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(16, vddY); ctx.lineTo(W - 16, vddY); ctx.stroke();
      ctx.fillStyle = VDDC; ctx.font = "700 10px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.fillText("VDD (logic 1)", 16, vddY - 3);
      ctx.strokeStyle = GNDC; ctx.beginPath(); ctx.moveTo(16, gndY); ctx.lineTo(W - 16, gndY); ctx.stroke();
      ctx.fillStyle = GNDC; ctx.textBaseline = "top"; ctx.fillText("GND (logic 0)", 16, gndY + 4);
      hits = [];
      GATES.forEach(function (g, i) {
        var x = gx(i);
        gateShape(g.type, x, gy, gw, gh);
        ctx.fillStyle = "#1a1d26"; ctx.font = "700 10px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(g.id, x + gw / 2 - 3, gy + gh / 2 - 5); ctx.fillStyle = "#5a606e"; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.fillText(g.type, x + gw / 2 - 3, gy + gh / 2 + 7);
        /* output stub */
        ctx.strokeStyle = "#334155"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + gw + 6, gy + gh / 2); ctx.lineTo(x + gw + 22, gy + gh / 2); ctx.stroke();
        /* driven secondary pins (always fine) */
        (g.driven || []).forEach(function (d) {
          var py = gy + gh * d.o;
          ctx.strokeStyle = "#334155"; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(x - 24, py); ctx.lineTo(x, py); ctx.stroke();
          if (d.clk) { ctx.beginPath(); ctx.moveTo(x, py - 5); ctx.lineTo(x + 7, py); ctx.lineTo(x, py + 5); ctx.stroke(); }
          ctx.fillStyle = "#5a606e"; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(d.net, x - 26, py);
        });
        /* flagged pin */
        var fy = gy + gh * g.fy, d = disp[g.id], wrong = submitted && res.wrong.indexOf(g.id) >= 0, mark = OK;
        if (d === "leave") {
          if (g.kind === "driven") { ctx.strokeStyle = OK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 40, fy); ctx.lineTo(x, fy); ctx.stroke(); ctx.fillStyle = OK; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textAlign = "right"; ctx.textBaseline = "bottom"; ctx.fillText(g.pin, x - 42, fy); }
          else { ctx.strokeStyle = BAD; ctx.lineWidth = 3; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(x - 26, fy); ctx.lineTo(x, fy); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = "#8a90a0"; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText(g.pin, x - 13, fy - 7); ctx.fillStyle = BAD; ctx.font = "700 8px 'JetBrains Mono', monospace"; ctx.textBaseline = "top"; ctx.fillText("floating", x - 13, fy + 5); }
        } else if (d === "tiehi" || d === "tielo") {
          var up = d === "tiehi", railY = up ? vddY : gndY, tx = x - 32;
          ctx.strokeStyle = MET; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, fy); ctx.lineTo(tx, fy); ctx.lineTo(tx, railY); ctx.stroke();
          var cyMid = (fy + railY) / 2;
          ctx.fillStyle = "#fff"; ctx.strokeStyle = OK; ctx.lineWidth = 1.6; ctx.fillRect(tx - 12, cyMid - 9, 24, 18); ctx.strokeRect(tx - 12, cyMid - 9, 24, 18);
          ctx.fillStyle = OK; ctx.font = "700 11px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(up ? "1" : "0", tx, cyMid);
          ctx.fillStyle = "#6b7280"; ctx.font = "7px 'JetBrains Mono', monospace"; ctx.fillText(up ? "TIE-HI" : "TIE-LO", tx, cyMid + 15);
        } else { /* net */
          ctx.strokeStyle = NETC; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 52, fy); ctx.lineTo(x, fy); ctx.stroke();
          ctx.fillStyle = NETC; ctx.font = "700 8px 'JetBrains Mono', monospace"; ctx.textAlign = "right"; ctx.textBaseline = "bottom"; ctx.fillText("→ " + (g.net || g.pin), x - 4, fy - 3);
          ctx.fillStyle = "#8a90a0"; ctx.textBaseline = "top"; ctx.fillText(g.pin, x - 4, fy + 3);
        }
        if (submitted) { ctx.fillStyle = wrong ? BAD : OK; ctx.font = "700 12px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText(wrong ? "✗" : "✔", x + gw / 2, gy - 6); }
        hits.push([x - 66, gy - 30, x - 1, gy + gh + 30, g.id]);
      });
    }
    function dispLabel(d) { return d === "leave" ? "leave (as-is)" : d === "tiehi" ? "tie-high (1)" : d === "tielo" ? "tie-low (0)" : "route net"; }
    function drawNetlist() {
      var rows = GATES.map(function (g) {
        var d = disp[g.id], ok = d === correctOf(g), col = submitted ? (ok ? OK : BAD) : "#334155";
        return '<div style="margin-bottom:7px"><span style="color:#1a1d26;font-weight:700">' + g.id + " " + g.type + '</span> '
          + '<span style="color:#6b7280">.' + g.pin + '</span><br>'
          + '<span style="color:#8a90a0;font-size:10px">' + g.why + '</span><br>'
          + '<span style="color:' + col + '">= ' + dispLabel(d) + '</span></div>';
      }).join("");
      nlCard.innerHTML = '<div style="font:700 13px \'JetBrains Mono\',monospace;color:#1a1d26;margin-bottom:2px">Netlist</div>'
        + '<div style="font:9px \'JetBrains Mono\',monospace;color:#8a90a0;margin-bottom:8px">each flagged pin and its role</div>'
        + '<div style="font:11px/1.3 \'JetBrains Mono\',monospace">' + rows + '</div>';
    }
    function computeScore() { var total = 10000, best = total; try { var key = "mp-best-" + (spec.id || "pv-erc-ties"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {} return { total: total, best: best }; }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "ERC clean" : res.wrong.length + " to fix") + '</div>';
      html += '<div class="mp-row ' + (res.pass ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.pass ? "✔" : "✗") + '</span><span class="mp-label">Every input dispositioned</span><span class="mp-detail">' + (GATES.length - res.wrong.length) + " / " + GATES.length + '</span></div>';
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div><div class="mp-flow-note">Constants tied through tie cells, the data open routed to its net, and the driven input left alone. No floating nodes and no contention.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>Every input is resolved correctly.</b> Click <b>Submit fixes</b>.</div>';
      else html += '<div class="mp-score"><span class="mp-score-note">Match each pin to what it is: tie a floating constant (high for 1, low for 0), route a net to a floating data input (a tie would hide the open), and leave a driven input alone (tying it fights the driver). The netlist names each pin\'s role.</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, disp); draw(last); drawNetlist(); render(last); bSubmit.disabled = submitted || !last.pass; bSubmit.classList.toggle("mp-ready", !submitted && last.pass); }
    function tap(e) {
      if (submitted) return; var r = canvas.getBoundingClientRect(), t = e.touches ? e.touches[0] : e, px = t.clientX - r.left, py = t.clientY - r.top;
      for (var i = 0; i < hits.length; i++) { var h = hits[i]; if (px >= h[0] && px <= h[2] && py >= h[1] && py <= h[3]) { var idx = OPTS.indexOf(disp[h[4]]); disp[h[4]] = OPTS[(idx + 1) % OPTS.length]; scoreObj = null; refresh(); break; } }
      e.preventDefault();
    }
    canvas.addEventListener("mousedown", tap); canvas.addEventListener("touchstart", tap, { passive: false });
    bSubmit.addEventListener("click", function () { if (!submitted && last && last.pass) { submitted = true; scoreObj = computeScore(); refresh(); } });
    bReset.addEventListener("click", function () { GATES.forEach(function (g) { disp[g.id] = "leave"; }); submitted = false; scoreObj = null; refresh(); });
    refresh();
  }

  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.PvErc = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
