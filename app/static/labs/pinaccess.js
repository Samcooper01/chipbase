/* Pin access lab. A standard-cell pin is a small metal shape on the cell. A
   vertical routing track can reach it only where the track crosses the pin
   metal - those crossings are the pin's candidate access points, and the router
   drops a via at the one it picks. Two pins that pick the same track collide (a
   single track cannot access both). Click a pin to move its via to another track
   it crosses so every pin gets its own. window.PinAccess = { evaluate, mount }. */
(function () {
  "use strict";
  function evaluate(spec, choice) {
    var chosen = spec.pins.map(function (p, i) { return p.candidates[choice[i]]; });
    var usage = {}; chosen.forEach(function (t, i) { (usage[t] = usage[t] || []).push(i); });
    var conflictPins = {}, conflictTracks = {};
    Object.keys(usage).forEach(function (t) { if (usage[t].length > 1) { conflictTracks[t] = true; usage[t].forEach(function (i) { conflictPins[i] = true; }); } });
    return { chosen: chosen, conflictPins: conflictPins, conflictTracks: conflictTracks, conflicts: Object.keys(conflictTracks).length, pass: Object.keys(conflictTracks).length === 0 };
  }
  function mount(container, spec) {
    var PAD = 18, headerH = 26, rowH = 52, colX0 = PAD + 20, W = 560;
    var Hpx = PAD * 2 + headerH + spec.pins.length * rowH;
    var colW = (W - colX0 - PAD) / spec.tracks;
    var choice = spec.pins.map(function () { return 0; }), scoreObj = null;

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas"); var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "pointer"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "8px 0"; hint.style.lineHeight = "1.5";
    hint.innerHTML = "Grey boxes are cells; the blue bar on each is its <b>pin</b> (metal). The vertical lines are routing <b>tracks</b>. A track can access a pin only where it crosses the pin metal (the dots); the router drops a <b>via</b> (square) on the one you pick. Two pins on the same track collide - click a pin to move its via.";
    left.appendChild(hint);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit design";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    function trackX(t) { return colX0 + (t + 0.5) * colW; }
    function rowY(i) { return PAD + headerH + i * rowH + rowH / 2; }
    var rows = [];
    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx); rows = [];
      var yTop = PAD + headerH, yBot = Hpx - PAD;
      /* routing tracks (full height) */
      for (var t = 0; t < spec.tracks; t++) {
        var conf = res.conflictTracks[t];
        ctx.strokeStyle = conf ? "rgba(220,38,38,0.55)" : "rgba(42,92,200,0.22)"; ctx.lineWidth = conf ? 2.6 : 1.2;
        ctx.beginPath(); ctx.moveTo(trackX(t), yTop); ctx.lineTo(trackX(t), yBot); ctx.stroke();
        ctx.fillStyle = conf ? "#dc2626" : "#5a606e"; ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText("T" + t, trackX(t), yTop - 4);
      }
      /* per-pin: cell box + pin metal + candidate contacts + chosen via/access */
      spec.pins.forEach(function (p, i) {
        var y = rowY(i), bad = res.conflictPins[i], chosen = res.chosen[i];
        var lo = Math.min.apply(null, p.candidates), hi = Math.max.apply(null, p.candidates);
        var mx0 = trackX(lo) - colW * 0.45, mx1 = trackX(hi) + colW * 0.45;
        /* cell box */
        ctx.fillStyle = "#e7e4db"; ctx.fillRect(mx0 - 6, y - 16, (mx1 - mx0) + 12, 32); ctx.strokeStyle = "#9a9488"; ctx.lineWidth = 1; ctx.strokeRect(mx0 - 6, y - 16, (mx1 - mx0) + 12, 32);
        ctx.fillStyle = "#7b7566"; ctx.font = "7px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText("cell", mx0 - 4, y - 15);
        /* pin metal bar */
        ctx.fillStyle = "rgba(37,99,237,0.55)"; ctx.fillRect(mx0, y - 5, mx1 - mx0, 10); ctx.strokeStyle = "#1d4ed8"; ctx.lineWidth = 1; ctx.strokeRect(mx0, y - 5, mx1 - mx0, 10);
        ctx.fillStyle = "#fff"; ctx.font = "bold 8px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(p.id, mx0 + 3, y);
        /* candidate contact points where tracks cross the pin */
        p.candidates.forEach(function (c) {
          if (c === chosen) return;
          ctx.fillStyle = "#fff"; ctx.strokeStyle = "#1d4ed8"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(trackX(c), y, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        });
        /* chosen access: via on the pin + wire up the track to the routing layer */
        var col = bad ? "#dc2626" : "#15803d";
        ctx.strokeStyle = col; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(trackX(chosen), y); ctx.lineTo(trackX(chosen), yTop); ctx.stroke();
        ctx.fillStyle = col; ctx.fillRect(trackX(chosen) - 4, y - 4, 8, 8); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.strokeRect(trackX(chosen) - 4, y - 4, 8, 8);
        rows.push([PAD, y - rowH / 2, W - PAD, y + rowH / 2, i]);
      });
    }
    function computeScore() {
      var total = 10000, best = total;
      try { var key = "mp-best-" + (spec.id || "route-pinaccess"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {}
      return { total: total, best: best };
    }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "PASS" : "not yet") + '</div>';
      html += '<div class="mp-row ' + (res.pass ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.pass ? "✔" : "✗") + '</span><span class="mp-label">Every pin on its own track</span><span class="mp-detail">' + (res.conflicts ? res.conflicts + " track(s) shared" : "all accessible") + '</span></div>';
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div><div class="mp-flow-note">Every pin has a clear via - the router can reach them all.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>Every pin accessible.</b> Click <b>Submit design</b> to score it.</div>';
      else html += '<div class="mp-score"><span class="mp-score-note">' + (spec.hint || "") + '</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, choice); draw(last); render(last); bSubmit.disabled = !last.pass; bSubmit.classList.toggle("mp-ready", last.pass); }
    function tap(e) {
      var r0 = canvas.getBoundingClientRect(), px = (e.touches ? e.touches[0].clientX : e.clientX) - r0.left, py = (e.touches ? e.touches[0].clientY : e.clientY) - r0.top;
      for (var i = 0; i < rows.length; i++) { var r = rows[i]; if (px >= r[0] && px <= r[2] && py >= r[1] && py <= r[3]) { choice[r[4]] = (choice[r[4]] + 1) % spec.pins[r[4]].candidates.length; scoreObj = null; refresh(); break; } }
      e.preventDefault();
    }
    canvas.addEventListener("mousedown", tap); canvas.addEventListener("touchstart", tap, { passive: false });
    bSubmit.addEventListener("click", function () { if (last && last.pass) { scoreObj = computeScore(); render(last); } });
    bReset.addEventListener("click", function () { choice = spec.pins.map(function () { return 0; }); scoreObj = null; refresh(); });
    refresh();
  }
  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.PinAccess = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
