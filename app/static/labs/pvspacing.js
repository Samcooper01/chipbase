/* Physical Verification lab: pv-spacing-table.
   Width-dependent spacing and end-of-line spacing. The minimum spacing a wire
   needs is not one number: it grows with the width of the wider neighbour (the
   fat-wire rule), and a wire END needs more clearance than a wire side (the
   end-of-line rule). The learner reads each marked gap against the rule table
   and classifies it legal or a violation. window.PvSpacing = { evaluate, mount }. */
(function () {
  "use strict";
  var EOL = 0.16;
  function reqSide(w) { return w <= 0.10 + 1e-9 ? 0.10 : (w <= 0.20 + 1e-9 ? 0.14 : 0.20); }
  function reqOf(m) { return m.kind === "eol" ? EOL : reqSide(Math.max(m.wa, m.wb)); }
  function correctOf(m) { return m.measured < reqOf(m) - 1e-9 ? "violation" : "legal"; }

  /* markers carry the physics (measured, kind, neighbour widths) and the screen
     geometry used to draw them */
  var MARKERS = [
    { id: "A1", kind: "side", measured: 0.14, wa: 0.10, wb: 0.16, ax1: 86, ax2: 150, ay: 120, chx: 118, chy: 150 },
    { id: "A2", kind: "side", measured: 0.15, wa: 0.16, wb: 0.24, ax1: 224, ax2: 293, ay: 120, chx: 258, chy: 150 },
    { id: "A3", kind: "side", measured: 0.22, wa: 0.24, wb: 0.16, ax1: 403, ax2: 505, ay: 120, chx: 454, chy: 150 },
    { id: "B1", kind: "eol", measured: 0.13, ax1: 200, ax2: 260, ay: 300, chx: 230, chy: 336 },
    { id: "B2", kind: "eol", measured: 0.18, ax1: 430, ax2: 513, ay: 300, chx: 471, chy: 336 }
  ];
  var BARS = [ { x: 40, w: 46, label: "0.10" }, { x: 150, w: 74, label: "0.16" }, { x: 293, w: 110, label: "0.24" }, { x: 505, w: 74, label: "0.16" } ];

  function evaluate(spec, verdicts) {
    var wrong = [];
    MARKERS.forEach(function (m, i) { if (verdicts[i] !== correctOf(m)) wrong.push(i); });
    return { wrong: wrong, pass: wrong.length === 0 };
  }

  function mount(container, spec) {
    var W = 620, Hpx = 400, dpr = window.devicePixelRatio || 1;
    var verdicts = MARKERS.map(function () { return "legal"; }), submitted = false, scoreObj = null;

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas");
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "pointer"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "8px 0"; hint.style.maxWidth = W + "px";
    hint.innerHTML = "Click a spacing to mark it <b>legal</b> or a <b>violation</b>, judging each gap against the <b>spacing rules</b> on the right, then submit. Dimensions in micrometres.";
    left.appendChild(hint);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit triage";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);

    var rightCol = document.createElement("div"); rightCol.style.cssText = "display:flex;flex-direction:column;gap:12px";
    var rulesCard = document.createElement("div"); rulesCard.style.cssText = "border:1px solid #c9c6bd;border-radius:8px;padding:12px 14px;background:#faf9f5;min-width:210px;max-width:240px";
    rulesCard.innerHTML = '<div style="font:700 13px \'JetBrains Mono\',monospace;color:#1a1d26;margin-bottom:2px">Spacing rules</div>'
      + '<div style="font:9px \'JetBrains Mono\',monospace;color:#8a90a0;margin-bottom:8px">required spacing (micrometres)</div>'
      + '<div style="font:9px \'JetBrains Mono\',monospace;color:#8a90a0;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">by wider neighbour</div>'
      + '<table style="font:12px/1.7 \'JetBrains Mono\',monospace;color:#334155;width:100%;border-collapse:collapse">'
      + '<tr><td>width up to 0.10</td><td style="text-align:right;font-weight:700;color:#15803d">0.10</td></tr>'
      + '<tr><td>0.10 to 0.20</td><td style="text-align:right;font-weight:700;color:#15803d">0.14</td></tr>'
      + '<tr><td>over 0.20 (fat)</td><td style="text-align:right;font-weight:700;color:#15803d">0.20</td></tr>'
      + '</table>'
      + '<div style="font:9px \'JetBrains Mono\',monospace;color:#8a90a0;text-transform:uppercase;letter-spacing:.05em;margin:10px 0 3px">end of line</div>'
      + '<table style="font:12px/1.7 \'JetBrains Mono\',monospace;color:#334155;width:100%;border-collapse:collapse">'
      + '<tr><td>a wire tip</td><td style="text-align:right;font-weight:700;color:#15803d">0.16</td></tr>'
      + '</table>';
    var panel = document.createElement("div"); panel.className = "mp-panel";
    rightCol.appendChild(rulesCard); rightCol.appendChild(panel); wrap.appendChild(rightCol);
    container.appendChild(wrap);

    var MET = "#3b82f6", METE = "#1d4ed8", OK = "#15803d", BAD = "#dc2626", DIM = "#334155", MUT = "#8a90a0";
    var baseA = 185, topA = 70;

    function arrow(x1, x2, y, color) {
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
      [[x1, 1], [x2, -1]].forEach(function (p) { ctx.beginPath(); ctx.moveTo(p[0], y); ctx.lineTo(p[0] + 5 * p[1], y - 3); ctx.lineTo(p[0] + 5 * p[1], y + 3); ctx.closePath(); ctx.fill(); });
    }
    function chip(m, i) {
      var v = verdicts[i], w = 66, h = 18, x = m.chx - w / 2, y = m.chy - h / 2;
      var isV = v === "violation";
      var col = isV ? BAD : OK;
      if (submitted) { var ok = v === correctOf(m); ctx.fillStyle = ok ? "rgba(21,128,61,0.14)" : "rgba(220,38,38,0.16)"; ctx.strokeStyle = ok ? OK : BAD; }
      else { ctx.fillStyle = isV ? "rgba(220,38,38,0.12)" : "rgba(21,128,61,0.10)"; ctx.strokeStyle = col; }
      ctx.lineWidth = 1.4; ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = col; ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(isV ? "violation" : "legal", m.chx, m.chy);
      if (submitted && v !== correctOf(m)) { ctx.fillStyle = BAD; ctx.textAlign = "left"; ctx.fillText("✗", x + w + 4, m.chy); }
      else if (submitted) { ctx.fillStyle = OK; ctx.textAlign = "left"; ctx.fillText("✔", x + w + 4, m.chy); }
      m._hit = [x, y, x + w, y + h];
    }
    function draw() {
      ctx.clearRect(0, 0, W, Hpx);
      /* ---- Region A: width-dependent side spacing ---- */
      ctx.fillStyle = DIM; ctx.font = "700 10px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
      ctx.fillText("WIDTH-DEPENDENT SIDE SPACING   (a wider neighbour needs a wider gap)", 20, 24);
      BARS.forEach(function (b) {
        ctx.fillStyle = MET; ctx.fillRect(b.x, topA, b.w, baseA - topA); ctx.strokeStyle = METE; ctx.lineWidth = 1.2; ctx.strokeRect(b.x, topA, b.w, baseA - topA);
        ctx.fillStyle = DIM; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText("width " + b.label, b.x + b.w / 2, baseA + 4);
      });
      /* ---- Region B: end-of-line spacing ---- */
      ctx.fillStyle = DIM; ctx.font = "700 10px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
      ctx.fillText("END-OF-LINE SPACING   (a wire tip needs more clearance than a side)", 20, 244);
      [{ ex1: 90, ex2: 200, ny: 300, nx: 260 }, { ex1: 340, ex2: 430, ny: 300, nx: 513 }].forEach(function (c) {
        ctx.fillStyle = MET; ctx.strokeStyle = METE; ctx.lineWidth = 1.2;
        ctx.fillRect(c.ex1, c.ny - 8, c.ex2 - c.ex1, 16); ctx.strokeRect(c.ex1, c.ny - 8, c.ex2 - c.ex1, 16); // horizontal wire with an end
        ctx.fillRect(c.nx, c.ny - 45, 18, 90); ctx.strokeRect(c.nx, c.ny - 45, 18, 90); // vertical neighbour
        ctx.fillStyle = MUT; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText("end", c.ex2 - 12, c.ny - 9);
      });
      /* markers: arrow + measured label + verdict chip */
      MARKERS.forEach(function (m, i) {
        var col = submitted ? (verdicts[i] === correctOf(m) ? OK : BAD) : (verdicts[i] === "violation" ? BAD : OK);
        arrow(m.ax1, m.ax2, m.ay, col);
        ctx.fillStyle = DIM; ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
        ctx.fillText(m.measured.toFixed(2), (m.ax1 + m.ax2) / 2, m.ay - 6);
        chip(m, i);
      });
    }
    function computeScore() { var total = 10000, best = total; try { var key = "mp-best-" + (spec.id || "pv-spacing-table"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {} return { total: total, best: best }; }
    function render(res) {
      var html;
      if (!submitted) {
        html = '<div class="mp-verdict" style="background:#eceae2;color:#5a606e">triage the spacings</div>';
        html += '<div class="mp-score"><span class="mp-score-note">Read each gap against the table. The required spacing is set by the <b>wider</b> of the two neighbours, and a wire <b>end</b> needs 0.16 regardless of width.</span></div>';
      } else {
        var nOK = MARKERS.length - res.wrong.length;
        html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "correct" : nOK + " / " + MARKERS.length) + '</div>';
        MARKERS.forEach(function (m, i) {
          var good = res.wrong.indexOf(i) < 0;
          html += '<div class="mp-row ' + (good ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (good ? "✔" : "✗") + '</span><span class="mp-label">' + m.id + ' &middot; ' + (m.kind === "eol" ? "end of line" : "side, widths " + m.wa.toFixed(2) + "/" + m.wb.toFixed(2)) + '</span><span class="mp-detail">need ' + reqOf(m).toFixed(2) + ', got ' + m.measured.toFixed(2) + '</span></div>';
        });
        if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div><div class="mp-flow-note">The required spacing rises with the wider neighbour and again at a wire end, so the same gap can be legal in one place and a violation in another.</div></div>';
        else if (!res.pass) html += '<div class="mp-score"><span class="mp-score-note">Red rows are misjudged. A gap that is legal next to a thin wire can still violate next to a fat one, and an end-of-line gap must reach 0.16 even where a side gap would pass.</span></div>';
      }
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, verdicts); draw(); render(last); bSubmit.disabled = submitted; bSubmit.classList.toggle("mp-ready", !submitted); }
    function tap(e) {
      if (submitted) return; var r = canvas.getBoundingClientRect(), t = e.touches ? e.touches[0] : e, px = t.clientX - r.left, py = t.clientY - r.top;
      for (var i = 0; i < MARKERS.length; i++) { var h = MARKERS[i]._hit; if (h && px >= h[0] && px <= h[2] && py >= h[1] && py <= h[3]) { verdicts[i] = verdicts[i] === "violation" ? "legal" : "violation"; refresh(); break; } }
      e.preventDefault();
    }
    canvas.addEventListener("mousedown", tap); canvas.addEventListener("touchstart", tap, { passive: false });
    bSubmit.addEventListener("click", function () { if (!submitted) { submitted = true; if (evaluate(spec, verdicts).pass) scoreObj = computeScore(); refresh(); } });
    bReset.addEventListener("click", function () { verdicts = MARKERS.map(function () { return "legal"; }); submitted = false; scoreObj = null; refresh(); });
    refresh();
  }

  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.PvSpacing = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
