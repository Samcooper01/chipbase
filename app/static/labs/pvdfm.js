/* Physical Verification lab: pv-dfm-vias (redundant vias / via doubling).
   A single via between two metal layers is a yield risk: one voided or broken
   cut opens the net. The Design-for-Manufacturability (DFM) step doubles vias to
   a redundant pair wherever there is room, so a single failure does not open the
   connection. Where the neighbouring metal leaves no room, a second cut would
   break the spacing rule, so that via stays single. The learner doubles every
   via that has room and leaves the blocked ones single.
   window.PvDfm = { evaluate, mount }. */
(function () {
  "use strict";
  /* each via: feasible = there is open room beside it for a redundant cut */
  var VIAS = [
    { id: "v1", feasible: true }, { id: "v2", feasible: true }, { id: "v3", feasible: false },
    { id: "v4", feasible: true }, { id: "v5", feasible: false }, { id: "v6", feasible: true }
  ];
  function evaluate(spec, doubled) {
    var missed = [], violate = [];
    VIAS.forEach(function (v) { var d = !!doubled[v.id]; if (v.feasible && !d) missed.push(v.id); if (!v.feasible && d) violate.push(v.id); });
    return { missed: missed, violate: violate, pass: missed.length === 0 && violate.length === 0 };
  }

  function mount(container, spec) {
    var W = 620, Hpx = 300, dpr = window.devicePixelRatio || 1;
    var doubled = {}; VIAS.forEach(function (v) { doubled[v.id] = false; });
    var submitted = false, scoreObj = null;
    var cols = 3, cw = 196, ch = 118, ox = 16, oy = 40, gapx = 4, gapy = 8;

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas");
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "pointer"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "8px 0"; hint.style.maxWidth = W + "px";
    hint.innerHTML = "A single via is a yield risk: one broken cut opens the net. <b>Double every via that has room</b> for a redundant cut (click it to add the second cut). Where the neighbouring metal leaves <b>no room</b>, a second cut would break the spacing rule, so leave that via single. Doubling a blocked via creates a violation; leaving a via single where there was room misses the yield improvement.";
    left.appendChild(hint);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit vias";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    var M1 = "#c7d2fe", M2 = "#a7f3d0", VIA = "#1e3a8a", OK = "#15803d", BAD = "#dc2626", NEI = "#94a3b8";
    var hits = [];
    function cellXY(i) { return [ox + (i % cols) * (cw + gapx), oy + Math.floor(i / cols) * (ch + gapy)]; }
    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx);
      ctx.fillStyle = "#1a1d26"; ctx.font = "700 11px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.fillText("Via array — double every via that has room; leave blocked ones single", ox, 26);
      hits = [];
      VIAS.forEach(function (v, i) {
        var xy = cellXY(i), cx0 = xy[0], cy0 = xy[1], midY = cy0 + ch / 2, d = doubled[v.id];
        /* cell frame */
        var badcell = submitted && (res.missed.indexOf(v.id) >= 0 || res.violate.indexOf(v.id) >= 0);
        ctx.fillStyle = "#faf9f5"; ctx.fillRect(cx0, cy0, cw, ch); ctx.strokeStyle = submitted ? (badcell ? BAD : OK) : "#d7dbe4"; ctx.lineWidth = submitted ? 2 : 1; ctx.strokeRect(cx0, cy0, cw, ch);
        /* lower metal strip (M1, horizontal) and upper landing (M2) */
        ctx.fillStyle = M1; ctx.fillRect(cx0 + 12, midY - 12, cw - 24, 24);
        ctx.fillStyle = M2; ctx.fillRect(cx0 + 40, midY - 16, 64, 32);
        /* neighbouring metal on the right (blocks a redundant cut when infeasible) */
        if (!v.feasible) { ctx.fillStyle = NEI; ctx.fillRect(cx0 + 112, midY - 20, 40, 40); ctx.fillStyle = "#475569"; ctx.font = "7px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("metal", cx0 + 132, midY); }
        /* via cut(s) */
        function cut(cxp, bad) { ctx.fillStyle = bad ? BAD : VIA; ctx.fillRect(cxp - 8, midY - 8, 16, 16); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cxp - 8, midY - 8); ctx.lineTo(cxp + 8, midY + 8); ctx.moveTo(cxp + 8, midY - 8); ctx.lineTo(cxp - 8, midY + 8); ctx.stroke(); }
        cut(cx0 + 64, false);
        if (d) { var secondX = cx0 + 90, collide = !v.feasible; cut(secondX, collide); }
        /* label */
        ctx.fillStyle = "#334155"; ctx.font = "bold 10px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText(v.id, cx0 + 8, cy0 + 6);
        var st = d ? (v.feasible ? "doubled" : "SPACING VIOLATION") : (v.feasible ? "single (room to double)" : "single (no room)");
        ctx.fillStyle = d && !v.feasible ? BAD : (d ? OK : "#8a90a0"); ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.fillText(st, cx0 + 8, cy0 + ch - 6);
        hits.push([cx0, cy0, cx0 + cw, cy0 + ch, v.id]);
      });
    }
    function computeScore() { var total = 10000, best = total; try { var key = "mp-best-" + (spec.id || "pv-dfm-vias"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {} return { total: total, best: best }; }
    function render(res) {
      var nfeas = VIAS.filter(function (v) { return v.feasible; }).length, dd = VIAS.filter(function (v) { return v.feasible && doubled[v.id]; }).length;
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "DFM clean" : (res.missed.length + res.violate.length) + " issue" + (res.missed.length + res.violate.length === 1 ? "" : "s")) + '</div>';
      html += '<div class="mp-row ' + (res.violate.length === 0 ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.violate.length === 0 ? "✔" : "✗") + '</span><span class="mp-label">No spacing violations</span><span class="mp-detail">' + res.violate.length + '</span></div>';
      html += '<div class="mp-row ' + (res.missed.length === 0 ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.missed.length === 0 ? "✔" : "✗") + '</span><span class="mp-label">Doublable vias doubled</span><span class="mp-detail">' + dd + " / " + nfeas + '</span></div>';
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div><div class="mp-flow-note">Every via with room is now a redundant pair, and the boxed-in vias were left single. Maximum yield improvement with no spacing violations.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>Every via is right.</b> Click <b>Submit vias</b>.</div>';
      else if (res.violate.length) html += '<div class="mp-score"><span class="mp-score-note">A doubled via is boxed in by neighbouring metal: the second cut breaks the spacing rule (red). Leave that via single.</span></div>';
      else html += '<div class="mp-score"><span class="mp-score-note">A via with open room beside it is still single. Double it to add a redundant cut and improve yield.</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, doubled); draw(last); render(last); bSubmit.disabled = submitted || !last.pass; bSubmit.classList.toggle("mp-ready", !submitted && last.pass); }
    function tap(e) {
      if (submitted) return; var r = canvas.getBoundingClientRect(), t = e.touches ? e.touches[0] : e, px = t.clientX - r.left, py = t.clientY - r.top;
      for (var i = 0; i < hits.length; i++) { var h = hits[i]; if (px >= h[0] && px <= h[2] && py >= h[1] && py <= h[3]) { doubled[h[4]] = !doubled[h[4]]; scoreObj = null; refresh(); break; } }
      e.preventDefault();
    }
    canvas.addEventListener("mousedown", tap); canvas.addEventListener("touchstart", tap, { passive: false });
    bSubmit.addEventListener("click", function () { if (!submitted && last && last.pass) { submitted = true; scoreObj = computeScore(); refresh(); } });
    bReset.addEventListener("click", function () { VIAS.forEach(function (v) { doubled[v.id] = false; }); submitted = false; scoreObj = null; refresh(); });
    refresh();
  }

  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.PvDfm = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
