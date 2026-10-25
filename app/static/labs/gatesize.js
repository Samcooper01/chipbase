/* Gate-sizing (timing-optimization) lab as register-to-register static timing
   analysis (STA). A launch flip-flop drives a small combinational cone that
   reconverges, then a capture flip-flop samples the result.

   Block-based STA:
   - arrival times propagate forward along the arcs; at a reconvergent node the
     arrival is the MAX over its fanin arcs (per-arc timing / critical path);
   - required times propagate backward from the capture setup constraint;
   - slack = required - arrival at every node; the critical path is the chain of
     least slack, and the design meets timing when the capture setup slack >= 0:
         arrival_at_capture_D  <=  period - tsetup.
   Cell arc delay (logical effort): d_k = p_k + g_k * Cout_k / (cinK * s_k),
   Cout_k = sum of fanout input caps (cinK * size), or the capture-FF D-pin cap
   on the last stage. Sizing a gate up loads every gate that drives it.
   Timing is analyzed only when the learner clicks Run timing.
   window.GateSize = { evaluate, mount }. */
(function () {
  "use strict";

  function heatColor(r) {
    var rr = Math.max(0, r);
    var hue = 130 * (1 - Math.min(1, rr));
    var light = rr > 1 ? Math.max(42, 52 - (rr - 1) * 16) : 52;
    var a = Math.min(0.6, 0.14 + 0.4 * Math.min(1.2, rr));
    return "hsla(" + hue.toFixed(0) + ",72%," + light.toFixed(0) + "%," + a.toFixed(2) + ")";
  }

  function evaluate(spec, sizes) {
    var gi = {}; spec.gates.forEach(function (g, i) { gi[g.id] = i; });
    var cinK = spec.cinK != null ? spec.cinK : 1;
    var L = spec.launch, C = spec.capture;
    var fanout = {}, fanin = {};
    (spec.edges || []).forEach(function (e) { (fanout[e[0]] = fanout[e[0]] || []).push(e[1]); (fanin[e[1]] = fanin[e[1]] || []).push(e[0]); });
    var order = spec.gates.map(function (g) { return g.id; });   // fixed topo order g0..g4

    // cell (arc) delay and output slew per gate from its output load.
    // load/drive ratio r = Cout / (cinK * size): a bigger size cuts r (less delay
    // and a faster transition), but raises the driver's Cout and so its r.
    var cell = {}, outLoad = {}, outSlew = {};
    var SLEW0 = spec.slew0 != null ? spec.slew0 : 0.02, SLEWK = spec.slewK != null ? spec.slewK : 0.08;
    spec.gates.forEach(function (g) {
      var load = 0;
      (fanout[g.id] || []).forEach(function (t) { load += (t === C) ? cinK * spec.ffDcap : cinK * sizes[gi[t]]; });
      var r = load / (cinK * sizes[gi[g.id]]);
      outLoad[g.id] = load; outSlew[g.id] = SLEW0 + SLEWK * r;
      cell[g.id] = g.p + g.g * r;
    });

    // forward arrival times (max over fanin arcs)
    var arr = {}, via = {};
    arr[L] = spec.tcq;
    order.forEach(function (id) {
      var best = -1e9, bv = null;
      (fanin[id] || []).forEach(function (f) { var a = arr[f] + cell[id]; if (a > best) { best = a; bv = f; } });
      arr[id] = best; via[id] = bv;
    });
    arr[C] = arr[order[order.length - 1]]; via[C] = order[order.length - 1];

    // backward required times from the capture setup constraint
    var req = {}; req[C] = spec.period - spec.tsetup;
    var rorder = order.slice().reverse();
    rorder.forEach(function (id) {
      var best = 1e9;
      (fanout[id] || []).forEach(function (t) { var r = req[t] - (t === C ? 0 : cell[t]); if (r < best) best = r; });
      req[id] = best;
    });
    req[L] = Math.min.apply(null, (fanout[L] || []).map(function (t) { return req[t] - cell[t]; }));

    // slack per node; per-gate ratio (arrival / required) for colouring
    var slackByNode = {}, gateRatio = {};
    Object.keys(arr).forEach(function (id) { slackByNode[id] = req[id] - arr[id]; });
    spec.gates.forEach(function (g) { gateRatio[g.id] = req[g.id] > 0 ? arr[g.id] / req[g.id] : (arr[g.id] > 0 ? 2 : 0); });

    // critical path backtrace from capture
    var path = [], n = C; while (n && n !== L) { path.unshift(n); n = via[n]; } path.unshift(L);

    var dataArr = arr[C], slack = req[C] - arr[C];

    // Tempus-style report_timing rows along the critical path
    var loadL = 0; (fanout[L] || []).forEach(function (t) { loadL += (t === C) ? cinK * spec.ffDcap : cinK * sizes[gi[t]]; });
    var launchSlew = SLEW0 + SLEWK * (loadL / (cinK * (spec.ffDrive || 4)));
    var report = [];
    report.push({ pt: L + "/CK", cell: "clock rise edge", path: 0 });
    report.push({ pt: L + "/Q", cell: "flip-flop clk->Q", slew: launchSlew, incr: spec.tcq, path: spec.tcq });
    path.forEach(function (id) {
      if (id === L || id === C) return;
      var g = spec.gates[gi[id]];
      report.push({ pt: id + "/Y", cell: g.label + " " + sizes[gi[id]] + "x", fanout: (fanout[id] || []).length, load: outLoad[id], slew: outSlew[id], incr: cell[id], path: arr[id] });
    });
    var lastG = path[path.length - 2];
    report.push({ pt: C + "/D", cell: "flip-flop setup pin", slew: outSlew[lastG] != null ? outSlew[lastG] : launchSlew, incr: 0, path: dataArr });

    var area = sizes.reduce(function (a, b) { return a + b; }, 0);
    var timingOK = slack >= -1e-6, areaOK = area <= spec.areaBudget + 1e-6;
    var metrics = [
      { label: "Setup slack >= 0", value: slack, limit: 0, ok: timingOK, kind: "slack" },
      { label: "Area in budget", value: area, limit: spec.areaBudget, ok: areaOK, kind: "area" }
    ];
    return {
      cell: cell, arr: arr, req: req, slackByNode: slackByNode, gateRatio: gateRatio,
      path: path, dataArr: dataArr, slack: slack, area: area, report: report,
      timingOK: timingOK, areaOK: areaOK, metrics: metrics, pass: timingOK && areaOK
    };
  }

  function mount(container, spec) {
    var N = spec.gates.length;
    var PAD = 26, W = 660, Hpx = 400;
    var sizes = spec.start.slice();
    var scoreObj = null;
    var innerW = W - 2 * PAD, innerH = Hpx - 2 * PAD;
    function px(fx) { return PAD + fx * innerW; }
    function py(fy) { return PAD + fy * innerH; }
    var wtri = 30, ffW = 30, ffH = 40;

    var nodePos = {};
    spec.gates.forEach(function (g) { nodePos[g.id] = [px(g.gx), py(g.gy)]; });
    spec.ffs.forEach(function (f) { nodePos[f.id] = [px(f.gx), py(f.gy)]; });
    function isFF(id) { return spec.ffs.some(function (f) { return f.id === id; }); }
    function halfW(id) { return isFF(id) ? ffW / 2 : wtri / 2; }
    var pathSet = {};

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var lft = document.createElement("div"); lft.className = "mp-left";
    var canvas = document.createElement("canvas"); var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "default";
    var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lft.appendChild(canvas);
    var legend = document.createElement("div"); legend.className = "mp-legend";
    legend.innerHTML = '<span class="mp-legend-title">gate slack</span><span class="mp-legend-bar"></span>' +
      '<span class="mp-legend-ends"><span>slack</span><span>tight</span><span>negative</span></span>';
    lft.appendChild(legend);
    var reportEl = document.createElement("div"); reportEl.style.cssText = "margin-top:10px;max-width:" + W + "px;overflow-x:auto";
    lft.appendChild(reportEl);
    wrap.appendChild(lft);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    function drawFF(f, res, analyzed) {
      var p = nodePos[f.id], x = p[0] - ffW / 2, y = p[1] - ffH / 2;
      ctx.fillStyle = "rgba(13,148,136,0.18)"; ctx.fillRect(x, y, ffW, ffH);
      ctx.strokeStyle = "#0d9488"; ctx.lineWidth = 2; ctx.strokeRect(x, y, ffW, ffH);
      ctx.fillStyle = "#0d9488"; ctx.beginPath();   // clock-input triangle
      ctx.moveTo(x + 2, y + ffH - 2); ctx.lineTo(x + 2, y + ffH - 10); ctx.lineTo(x + 10, y + ffH - 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#134e4a"; ctx.font = "bold 9px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(f.id, p[0], p[1] - 4); ctx.font = "7px 'JetBrains Mono', monospace"; ctx.fillText(f.role, p[0], p[1] + 7);
      ctx.textBaseline = "alphabetic";
    }

    function draw(res, analyzed) {
      ctx.clearRect(0, 0, W, Hpx);
      ctx.fillStyle = "#fdfdfd"; ctx.fillRect(PAD, PAD, innerW, innerH);
      var cinK = spec.cinK != null ? spec.cinK : 1;
      function ratioOf(id) { return analyzed && res ? res.gateRatio[id] : 0; }

      // critical-path highlight underlay
      if (analyzed && res) {
        for (var pi = 0; pi < res.path.length - 1; pi++) {
          var a = nodePos[res.path[pi]], b = nodePos[res.path[pi + 1]];
          ctx.strokeStyle = "rgba(245,158,11,0.35)"; ctx.lineWidth = 9;
          ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        }
      }
      // arcs: thickness = sink input cap (load on driver); colour by sink ratio
      (spec.edges || []).forEach(function (e) {
        var a = nodePos[e[0]], b = nodePos[e[1]];
        var sinkLoad = e[1] === spec.capture ? cinK * spec.ffDcap : (isFF(e[1]) ? 4 : cinK * sizes[spec.gates.findIndex(function (g) { return g.id === e[1]; })]);
        var crit = e[1] === spec.capture ? ratioOf(spec.gates[N - 1].id) : ratioOf(e[1]);
        ctx.strokeStyle = crit > 1 ? "rgba(220,38,38,0.8)" : "rgba(70,80,95,0.5)";
        ctx.lineWidth = 1.4 + sinkLoad * 0.22;
        ctx.beginPath(); ctx.moveTo(a[0] + halfW(e[0]), a[1]); ctx.lineTo(b[0] - halfW(e[1]), b[1]); ctx.stroke();
      });
      // launch clock-to-Q label
      var lp = nodePos[spec.launch], g0p = nodePos[spec.gates[0].id];
      ctx.fillStyle = "#6b7280"; ctx.font = "700 8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
      ctx.fillText("tcq " + spec.tcq.toFixed(1), (lp[0] + g0p[0]) / 2, lp[1] - 6);

      // flip-flops
      spec.ffs.forEach(function (f) { drawFF(f, res, analyzed); });

      // gates
      spec.gates.forEach(function (g, i) {
        var s = sizes[i], c = nodePos[g.id], cx = c[0], cy = c[1];
        var h = 20 + 74 * (s / spec.sizeMax), half = h / 2;
        var ratio = ratioOf(g.id);
        ctx.beginPath();
        ctx.moveTo(cx - wtri / 2, cy - half); ctx.lineTo(cx + wtri / 2, cy); ctx.lineTo(cx - wtri / 2, cy + half); ctx.closePath();
        ctx.fillStyle = analyzed ? heatColor(ratio) : "rgba(120,125,135,0.16)"; ctx.fill();
        ctx.strokeStyle = !analyzed ? "#9aa0aa" : (ratio > 1 ? "#dc2626" : "#2d6a4f"); ctx.lineWidth = 1.6; ctx.stroke();
        ctx.fillStyle = "#1a1d26"; ctx.font = "bold 11px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(g.id, cx - 2, cy);
        ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textBaseline = "alphabetic";
        ctx.fillStyle = "#2d3242"; ctx.fillText(g.label + " " + s + "x", cx, cy + half + 12);
        if (analyzed && res) {
          ctx.fillStyle = ratio > 1 ? "#dc2626" : "#2d6a4f";
          ctx.fillText("a=" + res.arr[g.id].toFixed(1), cx, cy - half - 14);
          ctx.fillStyle = "#6b7280"; ctx.fillText("d=" + res.cell[g.id].toFixed(1), cx, cy - half - 4);
        }
      });

      ctx.strokeStyle = "#1a1d26"; ctx.lineWidth = 1.6; ctx.strokeRect(PAD, PAD, innerW, innerH);
    }

    function computeScore(res) {
      var head = Math.max(0, res.slack / (spec.period));
      var aHead = Math.max(0, (spec.areaBudget - res.area) / spec.areaBudget);
      var total = Math.round(4000 + 6000 * Math.min(1, (head * 3 + aHead) / 0.6));
      var best = total;
      try { var key = "mp-best-" + (spec.id || "gatesize"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {}
      return { total: total, best: best };
    }
    function row(m) {
      var isArea = m.kind === "area";
      var v = m.value.toFixed(isArea ? 0 : 2), lim = m.limit.toFixed(isArea ? 0 : 2);
      var detail = m.kind === "slack" ? (m.value >= 0 ? "+" : "") + v + " ns" : v + " / " + lim;
      return '<div class="mp-row ' + (m.ok ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (m.ok ? "✔" : "✗") +
        '</span><span class="mp-label">' + m.label + '</span><span class="mp-detail">' + detail + '</span></div>';
    }
    function liveArea() { return sizes.reduce(function (a, b) { return a + b; }, 0); }

    function render(mode) {
      var html;
      if (mode === "done") {
        var res = last;
        html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "PASS" : "not yet") + '</div>';
        html += '<div class="mp-crit-head">setup timing report</div>';
        res.metrics.forEach(function (m) { html += row(m); });
        html += '<div class="mp-score" style="font-size:11px"><span class="mp-score-note">' +
          'clock period <b>' + spec.period.toFixed(1) + '</b> - setup ' + spec.tsetup.toFixed(1) + ' = required <b>' + (spec.period - spec.tsetup).toFixed(1) + '</b><br>' +
          'data arrives at capture D at <b>' + res.dataArr.toFixed(2) + '</b><br>' +
          'critical path: <b>' + res.path.join(" -> ") + '</b></span></div>';
        if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div>' + (scoreObj.best > scoreObj.total ? '<div class="mp-score-line">your best: ' + scoreObj.best + '</div>' : '') + '<div class="mp-flow-note">Positive slack with area to spare. More slack and less area score higher.</div></div>';
        else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>Setup met with positive slack.</b> Click <b>Submit design</b> to score it.</div>';
        else html += '<div class="mp-score"><span class="mp-score-note">' + (spec.hint || "") + '</span></div>';
      } else {
        var stale = mode === "stale";
        html = '<div class="mp-verdict" style="background:#eceae2;color:#5a606e">' + (stale ? "timing out of date" : "not run yet") + '</div>';
        html += '<div class="mp-score"><span class="mp-score-note">' + (stale
          ? "You changed the drive strengths, so the last timing report no longer applies. Click <b>Run timing</b> to re-analyze."
          : "Set the gate drive strengths, then click <b>Run timing</b> to propagate arrival times and check the setup slack at the capture flip-flop.") + '</span></div>';
        html += '<div class="mp-row"><span class="mp-mark">·</span><span class="mp-label">Area (live)</span><span class="mp-detail">' + liveArea() + " / " + spec.areaBudget + '</span></div>';
      }
      panel.innerHTML = html;
    }

    function renderReport() {
      if (!last || dirty) {
        reportEl.innerHTML = '<div class="mp-legend-title" style="display:block;margin:4px 0">Timing report</div>'
          + '<div style="font:11px \'JetBrains Mono\',monospace;color:#8a90a0">' + (last ? "Drive strengths changed. Click <b>Run timing</b> to regenerate the per-arc report." : "Click <b>Run timing</b> to generate the per-arc timing report.") + '</div>';
        return;
      }
      var r = last;
      function num(v, d) { return v == null ? "" : (typeof v === "number" ? v.toFixed(d) : v); }
      var rows = r.report.map(function (row) {
        var over = row.path != null && r.report.length && false;
        return '<tr>'
          + '<td style="text-align:left;padding:1px 8px 1px 0">' + row.pt + '</td>'
          + '<td style="text-align:left;color:#6b7280;padding:1px 8px 1px 0">' + (row.cell || "") + '</td>'
          + '<td style="text-align:right;padding:1px 8px 1px 0">' + (row.fanout != null ? row.fanout : "") + '</td>'
          + '<td style="text-align:right;padding:1px 8px 1px 0">' + num(row.load, 1) + '</td>'
          + '<td style="text-align:right;padding:1px 8px 1px 0">' + num(row.slew, 3) + '</td>'
          + '<td style="text-align:right;padding:1px 8px 1px 0">' + num(row.incr, 3) + '</td>'
          + '<td style="text-align:right;padding:1px 0;font-weight:700">' + num(row.path, 3) + '</td></tr>';
      }).join("");
      var reqd = spec.period - spec.tsetup;
      function trail(label, val, col) { return '<tr><td colspan="6" style="text-align:right;padding:1px 8px 1px 0;color:#5a606e">' + label + '</td><td style="text-align:right;font-weight:700;padding:1px 0' + (col ? ";color:" + col : "") + '">' + val + '</td></tr>'; }
      var tr = '<tr><td colspan="7" style="border-top:1px solid #c9c6bd;padding-top:2px"></td></tr>'
        + trail("data arrival time", r.dataArr.toFixed(3))
        + trail("required time (period " + spec.period.toFixed(2) + " - setup " + spec.tsetup.toFixed(2) + ")", reqd.toFixed(3))
        + trail("slack", (r.slack >= 0 ? "+" : "") + r.slack.toFixed(3), r.slack >= 0 ? "#15803d" : "#dc2626");
      reportEl.innerHTML = '<div class="mp-legend-title" style="display:block;margin:4px 0">Timing report &middot; critical path (' + r.path.join(" → ") + ')</div>'
        + '<table style="border-collapse:collapse;font:10px/1.55 \'JetBrains Mono\',monospace;width:100%">'
        + '<thead><tr style="color:#5a606e;border-bottom:1px solid #c9c6bd">'
        + '<th style="text-align:left">point</th><th style="text-align:left">cell</th><th style="text-align:right">fanout</th><th style="text-align:right">Cout</th><th style="text-align:right">slew</th><th style="text-align:right">delay</th><th style="text-align:right">arrival</th></tr></thead>'
        + '<tbody>' + rows + tr + '</tbody></table>'
        + '<div style="font:9px \'JetBrains Mono\',monospace;color:#8a90a0;margin-top:4px">Cout is the load the cell drives; a bigger drive cuts that cell\'s slew and delay but adds load (Cout) to the cell before it.</div>';
    }

    var last = null, dirty = true;
    function passing() { return last && !dirty && last.pass; }
    function sync() {
      draw(last, !!(last && !dirty));
      render(last ? (dirty ? "stale" : "done") : "unrun");
      renderReport();
      bSubmit.disabled = !passing(); bSubmit.classList.toggle("mp-ready", !!passing());
      bRun.classList.toggle("mp-ready", dirty);
    }
    function runTiming() { last = evaluate(spec, sizes); dirty = false; sync(); }

    var ctrls = document.createElement("div"); ctrls.className = "pdn-controls";
    var inputs = [];
    spec.gates.forEach(function (g, i) {
      var wrapEl = document.createElement("div"); wrapEl.className = "pdn-slider";
      var lab = document.createElement("label"); lab.className = "pdn-slider-label";
      var val = document.createElement("span"); val.className = "pdn-slider-val";
      var input = document.createElement("input"); input.type = "range";
      input.min = spec.sizeMin; input.max = spec.sizeMax; input.step = 1; input.value = sizes[i];
      inputs.push(input);
      function show() { val.textContent = sizes[i] + "x"; }
      show();
      input.addEventListener("input", function () { sizes[i] = +input.value; scoreObj = null; dirty = true; show(); sync(); });
      lab.textContent = g.id + " (" + g.label + ") drive"; lab.appendChild(val);
      wrapEl.appendChild(lab); wrapEl.appendChild(input); ctrls.appendChild(wrapEl);
    });
    lft.insertBefore(ctrls, legend);

    var btnRow = document.createElement("div"); btnRow.className = "mp-controls";
    var bRun = document.createElement("button"); bRun.className = "btn mp-submit"; bRun.textContent = "Run timing";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit design";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    btnRow.appendChild(bRun); btnRow.appendChild(bSubmit); btnRow.appendChild(bReset); lft.appendChild(btnRow);

    bRun.addEventListener("click", runTiming);
    bSubmit.addEventListener("click", function () { if (passing()) { scoreObj = computeScore(last); render("done"); } });
    bReset.addEventListener("click", function () { sizes = spec.start.slice(); scoreObj = null; last = null; dirty = true; inputs.forEach(function (inp, i) { inp.value = sizes[i]; }); ctrls.querySelectorAll(".pdn-slider-val").forEach(function (v, i) { v.textContent = sizes[i] + "x"; }); sync(); });

    sync();
  }

  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.GateSize = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
