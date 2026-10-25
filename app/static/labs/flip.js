/* Cell-flipping (orientation) detailed-placement lab. Cells stay in their legal
   slots; only their horizontal orientation changes. Each cell has an input pin
   A and an output pin Y near opposite edges; mirroring the cell swaps which side
   they face. Click a cell to flip it and reorient its pins toward the cells they
   connect to, shrinking total wirelength under target.
   Pin model: actual pin x = flip ? (x + w - rx) : (x + rx), y = y + ry.
   window.Flip = { evaluate, mount }. */
(function () {
  "use strict";
  function pinPos(c, pin) {
    var x = c.flip ? (c.x + c.w - pin.rx) : (c.x + pin.rx);
    return [x, c.y + pin.ry];
  }
  function evaluate(spec, state) {
    if (!spec.pinsById) { spec.pinsById = {}; (spec.pins || []).forEach(function (p) { spec.pinsById[p.id] = p; }); }
    var byId = {}; state.forEach(function (c) { byId[c.id] = c; });
    function tp(t) {
      if (t.pin && !t.cell) { var p = spec.pinsById[t.pin]; return [p.x, p.y]; }
      var c = byId[t.cell]; return pinPos(c, c.pins.find(function (pp) { return pp.id === t.pin; }));
    }
    var total = 0;
    (spec.nets || []).forEach(function (n) {
      var xs = [], ys = []; n.terminals.forEach(function (t) { var p = tp(t); xs.push(p[0]); ys.push(p[1]); });
      total += (Math.max.apply(null, xs) - Math.min.apply(null, xs)) + (Math.max.apply(null, ys) - Math.min.apply(null, ys));
    });
    return { totalHPWL: total, wlOK: total <= spec.wlTarget + 1e-6, pass: total <= spec.wlTarget + 1e-6 };
  }

  function mount(container, spec) {
    var core = spec.core, PAD = 22, MAXPX = 480;
    var sc = MAXPX / Math.max(core.w, core.h);
    var W = core.w * sc + PAD * 2, Hpx = core.h * sc + PAD * 2;
    function mx(x) { return PAD + x * sc; } function my(y) { return PAD + y * sc; }
    var state = spec.cells.map(function (c) { return { id: c.id, x: c.x, y: c.y, w: c.w, h: c.h, label: c.label || c.id, pins: c.pins, flip: !!c.flip }; });
    var scoreObj = null;

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas"); var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "pointer"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "8px 0";
    hint.innerHTML = "Click a cell to flip it. Blue <b>A</b> = input pin, red <b>Y</b> = output pin - flipping swaps which edge they sit on.";
    left.appendChild(hint);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit design";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    function draw() {
      ctx.clearRect(0, 0, W, Hpx);
      ctx.fillStyle = "#fdfdfd"; ctx.fillRect(mx(0), my(0), core.w * sc, core.h * sc);
      var byId = {}; state.forEach(function (c) { byId[c.id] = c; });
      function tp(t) { if (t.pin && !t.cell) { var p = spec.pinsById[t.pin]; return [p.x, p.y]; } var c = byId[t.cell]; return pinPos(c, c.pins.find(function (pp) { return pp.id === t.pin; })); }
      /* nets: star from each terminal to the net centroid */
      (spec.nets || []).forEach(function (n) {
        var pts = n.terminals.map(tp), cx = pts.reduce(function (s, p) { return s + p[0]; }, 0) / pts.length, cy = pts.reduce(function (s, p) { return s + p[1]; }, 0) / pts.length;
        ctx.strokeStyle = "rgba(90,96,110,0.4)"; ctx.lineWidth = 1;
        pts.forEach(function (p) { ctx.beginPath(); ctx.moveTo(mx(cx), my(cy)); ctx.lineTo(mx(p[0]), my(p[1])); ctx.stroke(); });
      });
      /* boundary pins */
      (spec.pins || []).forEach(function (p) {
        ctx.fillStyle = "#374151"; ctx.fillRect(mx(p.x) - 3, my(p.y) - 3, 6, 6);
        ctx.font = "9px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
        ctx.fillText(p.id, mx(p.x) + (p.x <= 1 ? 9 : p.x >= core.w - 1 ? -9 : 0), my(p.y) - 6);
      });
      /* cells */
      state.forEach(function (c) {
        var X = mx(c.x), Y = my(c.y), Wp = c.w * sc, Hp = c.h * sc;
        ctx.fillStyle = "rgba(37,99,237,0.14)"; ctx.fillRect(X, Y, Wp, Hp);
        ctx.strokeStyle = "#2f6fed"; ctx.lineWidth = 1.6; ctx.strokeRect(X, Y, Wp, Hp);
        /* orientation notch: a corner cut on the output side */
        ctx.fillStyle = "rgba(47,111,237,0.55)"; ctx.beginPath();
        if (!c.flip) { ctx.moveTo(X + Wp, Y); ctx.lineTo(X + Wp, Y + 6); ctx.lineTo(X + Wp - 6, Y); }
        else { ctx.moveTo(X, Y); ctx.lineTo(X, Y + 6); ctx.lineTo(X + 6, Y); }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#1a1d26"; ctx.font = "bold 9px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(c.label, X + Wp / 2, Y + Hp / 2); ctx.textBaseline = "alphabetic";
        /* pins */
        c.pins.forEach(function (pin) {
          var pp = pinPos(c, pin), inp = pin.id === "A";
          ctx.fillStyle = inp ? "#2563eb" : "#dc2626"; ctx.beginPath(); ctx.arc(mx(pp[0]), my(pp[1]), 3, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = inp ? "#1d4ed8" : "#b91c1c"; ctx.font = "700 8px 'JetBrains Mono', monospace"; ctx.textAlign = "center";
          ctx.fillText(pin.id, mx(pp[0]), my(pp[1]) - 5);
        });
      });
      ctx.strokeStyle = "#1a1d26"; ctx.lineWidth = 1.6; ctx.strokeRect(mx(0), my(0), core.w * sc, core.h * sc);
    }
    function computeScore(res) {
      var eff = spec.parWL ? Math.max(0, Math.min(1, (spec.parWL * 1.3 - res.totalHPWL) / (spec.parWL * 0.3))) : 0.5;
      var total = Math.round(4000 + 6000 * eff), best = total;
      try { var key = "mp-best-" + (spec.id || "flip"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {}
      return { total: total, best: best };
    }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "PASS" : "not yet") + '</div>';
      html += '<div class="mp-row ' + (res.wlOK ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.wlOK ? "✔" : "✗") + '</span><span class="mp-label">Wirelength under target</span><span class="mp-detail">' + res.totalHPWL.toFixed(0) + " / " + spec.wlTarget + '</span></div>';
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div>' + (scoreObj.best > scoreObj.total ? '<div class="mp-score-line">your best: ' + scoreObj.best + '</div>' : '') + '<div class="mp-flow-note">Under target. Fewer, shorter wires score higher.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>Under target.</b> Click <b>Submit design</b> to score it.</div>';
      else html += '<div class="mp-score"><span class="mp-score-note">' + (spec.hint || "Flip cells so each pin faces the cell it wires to.") + '</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, state); draw(); render(last); bSubmit.disabled = !last.pass; bSubmit.classList.toggle("mp-ready", last.pass); }
    function pt(e) { var r = canvas.getBoundingClientRect(); return [((e.touches ? e.touches[0].clientX : e.clientX) - r.left - PAD) / sc, ((e.touches ? e.touches[0].clientY : e.clientY) - r.top - PAD) / sc]; }
    function tap(e) {
      var p = pt(e);
      for (var i = state.length - 1; i >= 0; i--) { var c = state[i]; if (p[0] >= c.x && p[0] <= c.x + c.w && p[1] >= c.y && p[1] <= c.y + c.h) { c.flip = !c.flip; scoreObj = null; refresh(); break; } }
      e.preventDefault();
    }
    canvas.addEventListener("mousedown", tap); canvas.addEventListener("touchstart", tap, { passive: false });
    bSubmit.addEventListener("click", function () { if (last && last.pass) { scoreObj = computeScore(last); render(last); } });
    bReset.addEventListener("click", function () { state.forEach(function (c, i) { c.flip = !!spec.cells[i].flip; }); scoreObj = null; refresh(); });
    refresh();
  }
  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.Flip = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
