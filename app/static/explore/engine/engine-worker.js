/* Runs the browser engine off the page's thread, so the page never
   freezes. It loads the design and its library once, then answers each
   "run" with a progress message per stage and a final result. */
importScripts("pd-engine.js", "pd-stages.js");

var design = null, library = null;

function now() { return (self.performance || Date).now(); }

self.onmessage = function (ev) {
  var msg = ev.data;
  if (msg.type !== "run") return;
  var loads = [design ? design : fetch(msg.net).then(function (r) { return r.json(); }),
               library ? library : fetch(msg.lib).then(function (r) { return r.json(); })];
  Promise.all(loads).then(function (got) {
    design = got[0]; library = PDStages.prepareLib(got[1]);
    var D = design, LIB = library, K = msg.knobs, ms = {};
    function progress(p) { self.postMessage({ type: "progress", id: msg.id, p: p }); }

    /* floorplan and placement, timing-driven: the placer asks for net
       weights at two points in its spreading */
    var t = now();
    var R = PDEngine.run(D, K, progress, function (fp, pl, lg) {
      return PDStages.timingWeights(D, LIB, fp, pl, lg, K.period);
    });
    ms.placement = now() - t;
    progress({ stage: "placement", done: true });

    t = now();
    var C = PDStages.cts(D, LIB, R.fp, R.pl, R.lg, { ctsSize: K.ctsSize, ctsDiam: K.ctsDiam });
    ms.cts = now() - t;
    progress({ stage: "cts", done: true });

    t = now();
    var RT = PDStages.route(D, R.fp, R.pl, R.lg, C);
    ms.routing = now() - t;
    progress({ stage: "routing", done: true });

    t = now();
    var REP = PDStages.repair(D, LIB, R.fp, R.pl, R.lg, RT);
    var T = PDStages.repairTiming(D, LIB, R.fp, R.pl, R.lg, C, RT, K.period, REP, 8);
    ms.timing = now() - t;
    progress({ stage: "timing", done: true });

    t = now();
    var P = PDStages.power(D, LIB, R.fp, C, RT, K.period, 1, REP);
    var ctsArea = C.buffers.reduce(function (a, b) { return a + LIB.cells[b.type].area; }, 0);
    var F = PDStages.finish(D, R.fp, R.pl, R.lg, REP.counts.area + ctsArea);
    ms.finish = now() - t;

    var areaStd = 0;
    D.cells.forEach(function (t) { var T = D.types[t]; if (!T.macro) areaStd += T.w * T.h; });
    /* a sweep only needs the headline numbers of each run */
    if (msg.lite) {
      self.postMessage({ type: "done", id: msg.id, lite: true, period: K.period, wns: T.wns, tns: T.tns,
        failing: T.failing, endpoints: T.endpoints, power: P.total * 1e3,
        area: areaStd + REP.counts.area + ctsArea,
        buffers: REP.counts.ports + REP.counts.design + REP.counts.timing,
        ms: ms.placement + ms.cts + ms.routing + ms.timing + ms.finish });
      return;
    }
    /* what the page draws: cell groups and sizes in movable order, every
       placement iteration, the legal result, and each later stage's picture */
    var Pm = R.pl.P, m = Pm.m, group = new Uint8Array(m), w = new Float32Array(m);
    for (var i = 0; i < m; i++) {
      var c = R.pl.cellOf[i];
      group[i] = D.cellGroup[c];
      w[i] = D.types[D.cells[c]].w;
    }
    var frames = R.pl.frames.map(function (f) { return { x: f.x, y: f.y }; });
    var segs = new Float32Array(C.segs.length * 5);
    C.segs.forEach(function (s, k) { for (var j = 0; j < 5; j++) segs[k * 5 + j] = s[j]; });
    var bufs = new Float32Array(C.buffers.length * 3);
    C.buffers.forEach(function (b, k) { bufs[k * 3] = b.x; bufs[k * 3 + 1] = b.y; bufs[k * 3 + 2] = b.leaf ? 1 : b.mac ? 2 : 0; });
    var rbufs = new Float32Array(REP.buffers.length * 2);
    REP.buffers.forEach(function (b, k) { rbufs[k * 2] = b.x; rbufs[k * 2 + 1] = b.y; });
    /* slack histogram: 24 bins from the worst slack to the best */
    var sl = T.slacks, lo = Math.min.apply(null, sl), hi = Math.max.apply(null, sl), bins = new Array(24).fill(0);
    sl.forEach(function (v) { bins[Math.min(23, Math.floor((v - lo) / Math.max(1e-9, hi - lo) * 24))]++; });
    var path = T.path.map(function (q) {
      return { x: q.pos.x, y: q.pos.y, t: q.t, edge: q.edge, port: q.port,
               type: q.type ? q.type.replace("_ASAP7_75t_R", "") : null, pin: q.pinName };
    });
    self.postMessage({
      type: "done", id: msg.id,
      fp: { W: R.fp.W, H: R.fp.H, rows: R.fp.rows, rowH: R.fp.rowH, die: R.fp.die, macros: R.fp.macros, pins: R.fp.pins },
      group: group, w: w, frames: frames, history: R.pl.history,
      legal: { x: Float32Array.from(R.lg.x), y: Float32Array.from(R.lg.y) },
      metrics: R.metrics, groups: D.groups, grouping: D.meta.grouping || "names", ms: ms, placeTiming: R.pl.timing,
      cts: { segs: segs, bufs: bufs, clusters: C.clusters, levels: C.levels, buffers: C.buffers.length,
             delayBuffers: C.delayBuffers, skew: C.skew, minLat: C.minLat, maxLat: C.maxLat, wireLen: C.wireLen },
      route: { nx: RT.nx, ny: RT.ny, gc: RT.gc, ratio: RT.ratio, total: RT.total, signal: RT.signal, clock: RT.clock,
               vias: RT.vias, overflow: RT.overflow, overEdges: RT.overEdges, layerLen: RT.layerLen },
      repair: { counts: REP.counts, bufs: rbufs },
      timing: { period: K.period, wns: T.wns, tns: T.tns, failing: T.failing, endpoints: T.endpoints,
                hist: { lo: lo, hi: hi, bins: bins }, path: path, history: T.repairHistory,
                arrival: T.worst ? T.worst.arrival : 0, required: T.worst ? T.worst.required : 0 },
      power: { groups: P.groups, internal: P.internal, switching: P.switching, leakage: P.leakage, total: P.total,
               activity: P.activity.mean, vdd: P.vdd },
      finish: F,
      /* area: the netlist's own cells, what the repair and the clock tree
         added, and the memories */
      area: (function () {
        var std = 0, mac = 0;
        D.cells.forEach(function (t) { var T = D.types[t]; if (T.macro) mac += T.w * T.h; else std += T.w * T.h; });
        return { std: std, repair: REP.counts.area, cts: ctsArea, macro: mac };
      })(),
      /* only for the three-dimensional view: every piece of routed wire, and every via */
      wires3d: msg.want3d ? { wires: RT.wires, vias: RT.viaAt, gc: RT.gc } : null,
    });
  }).catch(function (e) { self.postMessage({ type: "error", message: String(e && e.stack || e) }); });
};
