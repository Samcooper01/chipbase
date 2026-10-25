/* Physical Verification lab: pv-enclosure.
   Two design rules on one layer: via enclosure (a via cut must be surrounded by
   metal on every side by at least E_min) and minimum area (every metal shape
   must have at least A_min of area). The learner fixes the geometry: drag a
   shape's corner handle to grow it about its centre, until every via is enclosed
   and every shape meets minimum area. window.PvEnclosure = { evaluate, mount }. */
(function () {
  "use strict";
  var EMIN = 10, AMIN = 2000, SCALE = 1.5; // nanometres, square nanometres, pixels per nanometre
  /* shapes in logical nanometres: cx,cy centre; hw,hh half-extents; kind; via half-size for vias */
  var INIT = [
    { id: "via_a", kind: "via", cx: 90, cy: 64, hw: 24, hh: 24, vhw: 10, vhh: 10 },
    { id: "via_b", kind: "via", cx: 300, cy: 64, hw: 14, hh: 14, vhw: 10, vhh: 10 },
    { id: "shp_c", kind: "area", cx: 90, cy: 185, hw: 30, hh: 20 },
    { id: "shp_d", kind: "area", cx: 300, cy: 185, hw: 25, hh: 6 }
  ];
  var MAXHW = 46, MAXHH = 42; // clamp so grown shapes cannot collide

  function encl(s) { return Math.min(s.hw - s.vhw, s.hh - s.vhh); }
  function area(s) { return (2 * s.hw) * (2 * s.hh); }
  function evaluate(spec, shapes) {
    var bad = [];
    shapes.forEach(function (s, i) {
      if (s.kind === "via" && encl(s) < EMIN - 1e-9) bad.push(i);
      else if (s.kind === "area" && area(s) < AMIN - 1e-9) bad.push(i);
    });
    var vias = shapes.filter(function (s) { return s.kind === "via"; });
    var areas = shapes.filter(function (s) { return s.kind === "area"; });
    var viaOK = vias.filter(function (s) { return encl(s) >= EMIN - 1e-9; }).length;
    var areaOK = areas.filter(function (s) { return area(s) >= AMIN - 1e-9; }).length;
    return { bad: bad, vias: vias.length, areas: areas.length, viaOK: viaOK, areaOK: areaOK, pass: bad.length === 0 };
  }

  function mount(container, spec) {
    var W = 600, Hpx = 400, dpr = window.devicePixelRatio || 1;
    var ox = 40, oy = 24; // logical-origin pixel offset
    var shapes = INIT.map(function (s) { return Object.assign({}, s); });
    var drag = null, submitted = false, scoreObj = null;

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas");
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "8px 0"; hint.style.maxWidth = W + "px";
    hint.innerHTML = "Drag a shape's <b>corner handle</b> to grow the metal about its centre. Every via must be enclosed by metal on all sides by at least E<sub>min</sub> = " + EMIN + " nm, and every metal shape must have at least A<sub>min</sub> = " + AMIN + " nm&sup2; of area. Dimensions in nanometres.";
    left.appendChild(hint);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit fixes";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    var MET = "#3b82f6", METE = "#1d4ed8", VIA = "#1e3a8a", OK = "#15803d", BAD = "#dc2626", DIM = "#334155";
    function px(x) { return ox + x * SCALE; }
    function py(y) { return oy + y * SCALE; }

    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx);
      shapes.forEach(function (s, i) {
        var bad = res.bad.indexOf(i) >= 0;
        var x = px(s.cx - s.hw), y = py(s.cy - s.hh), w = 2 * s.hw * SCALE, h = 2 * s.hh * SCALE;
        ctx.fillStyle = MET; ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = bad ? BAD : METE; ctx.lineWidth = bad ? 2.4 : 1.2; ctx.strokeRect(x, y, w, h);
        if (s.kind === "via") {
          var vx = px(s.cx - s.vhw), vy = py(s.cy - s.vhh), vw = 2 * s.vhw * SCALE, vh = 2 * s.vhh * SCALE;
          ctx.fillStyle = VIA; ctx.fillRect(vx, vy, vw, vh);
          ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(vx, vy); ctx.lineTo(vx + vw, vy + vh); ctx.moveTo(vx + vw, vy); ctx.lineTo(vx, vy + vh); ctx.stroke();
          var e = encl(s);
          ctx.fillStyle = bad ? BAD : OK; ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top";
          ctx.fillText("enclosure " + e.toFixed(0) + (bad ? " < " + EMIN : " ≥ " + EMIN), px(s.cx), y + h + 4);
        } else {
          var a = area(s);
          ctx.fillStyle = bad ? BAD : OK; ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top";
          ctx.fillText("area " + a.toFixed(0) + (bad ? " < " + AMIN : " ≥ " + AMIN), px(s.cx), y + h + 4);
        }
        ctx.fillStyle = DIM; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.fillText(s.id, x, y - 3);
        /* corner handle (bottom-right) */
        ctx.fillStyle = "#fff"; ctx.strokeStyle = DIM; ctx.lineWidth = 1.2; ctx.fillRect(x + w - 5, y + h - 5, 10, 10); ctx.strokeRect(x + w - 5, y + h - 5, 10, 10);
      });
    }
    function computeScore() { var total = 10000, best = total; try { var key = "mp-best-" + (spec.id || "pv-enclosure"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {} return { total: total, best: best }; }
    function render(res) {
      var n = res.bad.length;
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "clean" : n + " violation" + (n === 1 ? "" : "s")) + '</div>';
      html += '<div class="mp-row ' + (res.viaOK === res.vias ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.viaOK === res.vias ? "✔" : "✗") + '</span><span class="mp-label">Vias enclosed &ge; E_min</span><span class="mp-detail">' + res.viaOK + " / " + res.vias + '</span></div>';
      html += '<div class="mp-row ' + (res.areaOK === res.areas ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.areaOK === res.areas ? "✔" : "✗") + '</span><span class="mp-label">Shapes &ge; A_min</span><span class="mp-detail">' + res.areaOK + " / " + res.areas + '</span></div>';
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div><div class="mp-flow-note">Every via is surrounded by enough metal to survive misalignment, and no shape is too small to pattern reliably. The layer is design-rule clean.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>No violations left.</b> Click <b>Submit fixes</b>.</div>';
      else html += '<div class="mp-score"><span class="mp-score-note">A red shape violates a rule. Grow an under-enclosed via\'s metal until the enclosure on every side reaches E_min, and enlarge a too-small shape until its area reaches A_min. Drag the corner handle to grow it.</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, shapes); draw(last); render(last); bSubmit.disabled = submitted || !last.pass; bSubmit.classList.toggle("mp-ready", !submitted && last.pass); }

    function handleAt(pxv, pyv) {
      for (var i = 0; i < shapes.length; i++) {
        var s = shapes[i], hx = px(s.cx + s.hw), hy = py(s.cy + s.hh);
        if (Math.abs(pxv - hx) <= 8 && Math.abs(pyv - hy) <= 8) return i;
      }
      return -1;
    }
    function evtXY(e) { var r = canvas.getBoundingClientRect(); var t = e.touches ? e.touches[0] : e; return [t.clientX - r.left, t.clientY - r.top]; }
    function down(e) { if (submitted) return; var p = evtXY(e); var i = handleAt(p[0], p[1]); if (i >= 0) { drag = i; e.preventDefault(); } }
    function move(e) {
      var p = evtXY(e);
      if (drag == null) { canvas.style.cursor = handleAt(p[0], p[1]) >= 0 ? "nwse-resize" : "default"; return; }
      var s = shapes[drag];
      var nhw = (p[0] - ox) / SCALE - s.cx, nhh = (p[1] - oy) / SCALE - s.cy;
      var minHw = s.kind === "via" ? s.vhw : 4, minHh = s.kind === "via" ? s.vhh : 4;
      s.hw = Math.max(minHw, Math.min(MAXHW, nhw));
      s.hh = Math.max(minHh, Math.min(MAXHH, nhh));
      submitted = false; scoreObj = null; refresh(); e.preventDefault();
    }
    function up() { drag = null; }
    canvas.addEventListener("mousedown", down); canvas.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    canvas.addEventListener("touchstart", down, { passive: false }); canvas.addEventListener("touchmove", move, { passive: false }); window.addEventListener("touchend", up);
    bSubmit.addEventListener("click", function () { if (!submitted && last && last.pass) { submitted = true; scoreObj = computeScore(); refresh(); } });
    bReset.addEventListener("click", function () { shapes = INIT.map(function (s) { return Object.assign({}, s); }); submitted = false; scoreObj = null; refresh(); });
    refresh();
  }

  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.PvEnclosure = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
