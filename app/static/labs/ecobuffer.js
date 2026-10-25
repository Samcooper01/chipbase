/* ECO lab: eco-buffer (buffer insertion on a long net).
   A driver reaches a far sink through a long wire. On an unbuffered wire each
   segment carries all of the downstream load, so the delay grows with the SQUARE
   of the length: a long net is quadratically slow. Inserting a buffer splits the
   wire, resetting the load the upstream driver sees, which turns the quadratic
   into a sum of shorter (near-linear) pieces. But every buffer adds its own fixed
   delay, so too many buffers is slow again. The learner places buffers to get the
   far-sink delay under the limit. window.EcoBuffer = { evaluate, mount }. */
(function () {
  "use strict";
  var SEG = 12, A = 0.06, BD = 0.3, LIMIT = 3.1;
  function delayOf(pos) {
    var b = [0].concat(pos.slice().sort(function (a, c) { return a - c; })).concat([SEG]);
    var d = 0; for (var i = 0; i < b.length - 1; i++) { var L = b[i + 1] - b[i]; d += A * L * L; }
    return d + pos.length * BD;
  }
  function evaluate(spec, pos) {
    var d = delayOf(pos);
    return { delay: d, nBuf: pos.length, pass: d <= LIMIT + 1e-9 };
  }

  function mount(container, spec) {
    var W = 640, Hpx = 250, dpr = window.devicePixelRatio || 1;
    var pos = [], submitted = false, scoreObj = null;
    var x0 = 60, x1 = W - 60, wy = 96, unit = (x1 - x0) / SEG;
    function tx(seg) { return x0 + seg * unit; }

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas");
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "pointer"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "8px 0"; hint.style.maxWidth = W + "px";
    hint.innerHTML = "The driver reaches the far flip-flop through a long wire, and the path misses setup. On an unbuffered wire the delay grows with the <b>square</b> of the length. <b>Click a tick</b> to insert a buffer, which splits the wire so each piece is shorter and faster. Each buffer adds a fixed delay, so too many is slow again. Get the far-sink delay at or under the limit (" + LIMIT.toFixed(1) + ").";
    left.appendChild(hint);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit buffers";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    var MET = "#3b82f6", BUF = "#2563eb", OK = "#15803d", BAD = "#dc2626", DIM = "#334155", MUT = "#9aa0aa";
    var hits = [];
    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx); hits = [];
      /* driver box */
      ctx.fillStyle = "#eef1f7"; ctx.strokeStyle = "#334155"; ctx.lineWidth = 1.6; ctx.fillRect(x0 - 44, wy - 16, 40, 32); ctx.strokeRect(x0 - 44, wy - 16, 40, 32);
      ctx.fillStyle = "#1a1d26"; ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("drv", x0 - 24, wy);
      /* wire with segment ticks */
      ctx.strokeStyle = MET; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0, wy); ctx.lineTo(x1, wy); ctx.stroke();
      for (var s = 1; s < SEG; s++) { var isBuf = pos.indexOf(s) >= 0; ctx.strokeStyle = isBuf ? BUF : "#c9c6bd"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(tx(s), wy - 6); ctx.lineTo(tx(s), wy + 6); ctx.stroke(); hits.push([tx(s) - 12, wy - 24, tx(s) + 12, wy + 24, s]); }
      /* far flip-flop */
      ctx.fillStyle = "rgba(13,148,136,0.18)"; ctx.strokeStyle = "#0d9488"; ctx.lineWidth = 2; ctx.fillRect(x1, wy - 18, 34, 36); ctx.strokeRect(x1, wy - 18, 34, 36);
      ctx.fillStyle = "#134e4a"; ctx.font = "700 8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("FF", x1 + 17, wy);
      /* buffers as triangles on the wire */
      pos.forEach(function (s) {
        var x = tx(s); ctx.fillStyle = BUF; ctx.beginPath(); ctx.moveTo(x - 8, wy - 9); ctx.lineTo(x + 9, wy); ctx.lineTo(x - 8, wy + 9); ctx.closePath(); ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.stroke();
      });
      ctx.fillStyle = MUT; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText("click a tick to add or remove a buffer", (x0 + x1) / 2, wy + 22);
      /* delay bar vs limit */
      var by = 175, bx = x0, bw = x1 + 34 - x0, sc = bw / (LIMIT * 2), lim = bx + LIMIT * sc;
      ctx.fillStyle = "#5a606e"; ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.fillText("far-sink delay", bx, by - 4);
      ctx.fillStyle = "#eceae2"; ctx.fillRect(bx, by, bw, 20); ctx.strokeStyle = "#c9c6bd"; ctx.lineWidth = 1; ctx.strokeRect(bx, by, bw, 20);
      var ok = res.pass, dw = Math.min(bw, res.delay * sc);
      ctx.fillStyle = ok ? "rgba(21,128,61,0.55)" : "rgba(220,38,38,0.55)"; ctx.fillRect(bx, by, dw, 20);
      ctx.strokeStyle = "#c23c32"; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(lim, by - 6); ctx.lineTo(lim, by + 26); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = "#c23c32"; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText("limit " + LIMIT.toFixed(1), lim, by - 4);
      ctx.fillStyle = ok ? OK : BAD; ctx.font = "700 11px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(res.delay.toFixed(2) + "  (" + res.nBuf + " buffer" + (res.nBuf === 1 ? "" : "s") + ")", bx + dw + 8 > lim + 8 ? bx + dw + 8 : lim + 8, by + 10);
    }
    function computeScore(res) { var total = Math.round(Math.max(4000, Math.min(10000, 10000 - (res.delay - 2.9) * 3000 - res.nBuf * 200))), best = total; try { var key = "mp-best-" + (spec.id || "eco-buffer"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {} return { total: total, best: best }; }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "meets setup" : "too slow") + '</div>';
      html += '<div class="mp-row ' + (res.pass ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.pass ? "✔" : "✗") + '</span><span class="mp-label">Far-sink delay &le; limit</span><span class="mp-detail">' + res.delay.toFixed(2) + " / " + LIMIT.toFixed(1) + '</span></div>';
      html += '<div class="mp-row"><span class="mp-mark">·</span><span class="mp-label">Buffers inserted</span><span class="mp-detail">' + res.nBuf + '</span></div>';
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div><div class="mp-flow-note">Splitting the long wire cut the quadratic delay. Fewer buffers at the delay you reached score higher: the best point balances shorter pieces against the buffers\' own delay.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>Under the limit.</b> Fewer buffers score higher. Click <b>Submit buffers</b>.</div>';
      else if (res.nBuf < 3) html += '<div class="mp-score"><span class="mp-score-note">The unbuffered (or barely buffered) wire is quadratically slow. Add buffers to split it into shorter pieces, spaced roughly evenly.</span></div>';
      else html += '<div class="mp-score"><span class="mp-score-note">Too many buffers now: their fixed delays add up faster than the wire shortens. Remove some, or space them more evenly.</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, pos); draw(last); render(last); bSubmit.disabled = submitted || !last.pass; bSubmit.classList.toggle("mp-ready", !submitted && last.pass); }
    function tap(e) {
      if (submitted) return; var r = canvas.getBoundingClientRect(), t = e.touches ? e.touches[0] : e, px = t.clientX - r.left, py = t.clientY - r.top;
      for (var i = 0; i < hits.length; i++) { var h = hits[i]; if (px >= h[0] && px <= h[2] && py >= h[1] && py <= h[3]) { var s = h[4], k = pos.indexOf(s); if (k >= 0) pos.splice(k, 1); else pos.push(s); scoreObj = null; refresh(); break; } }
      e.preventDefault();
    }
    canvas.addEventListener("mousedown", tap); canvas.addEventListener("touchstart", tap, { passive: false });
    bSubmit.addEventListener("click", function () { if (!submitted && last && last.pass) { submitted = true; scoreObj = computeScore(last); refresh(); } });
    bReset.addEventListener("click", function () { pos = []; submitted = false; scoreObj = null; refresh(); });
    refresh();
  }

  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.EcoBuffer = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
