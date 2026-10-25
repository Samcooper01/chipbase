/* The layout in three dimensions, drawn from the same engine run as the
   rest of the design page: cells and memories on the die, then the routed
   wires one metal layer above another, with the vias between them. The page
   calls mountLayout3D once, then update() with each finished run. */
import * as THREE from "/static/vendor/three/three-viewer.min.js";
const { OrbitControls } = THREE;

/* the metal layers the router uses, one colour each */
const METAL = {
  2: { c: "#0ea5e9", label: "metal 2, across" }, 3: { c: "#6366f1", label: "metal 3, up and down" },
  4: { c: "#a855f7", label: "metal 4, across" }, 5: { c: "#ec4899", label: "metal 5, up and down" },
  6: { c: "#f59e0b", label: "metal 6, across" }, 7: { c: "#ef4444", label: "metal 7, up and down" },
};
const GROUP_COLORS = ["#94a3b8", "#8b5cf6", "#2563eb", "#0d9488", "#0891b2", "#d97706", "#475569", "#64748b"];

export function mountLayout3D(host) {
  host.innerHTML =
    '<div class="dz3">' +
    '<div class="dz3-stage"><canvas aria-label="The layout, drawn in three dimensions"></canvas>' +
    '<p class="dz3-hint">Drag to turn it. Right-drag, or drag with two fingers, to move it. ' +
    "Click it, then scroll to zoom.</p></div>" +
    '<aside class="dz3-panel">' +
    '<h3>Show</h3><div class="dz3-toggles"></div>' +
    '<h3>Height</h3><label class="dz3-range">Space between metal layers' +
    '<input type="range" min="0.3" max="3" step="0.1" value="1"><output></output></label>' +
    '<p class="dz3-note">The real layers are far thinner than the chip is wide, so the heights here are stretched ' +
    "to make the layers easy to tell apart.</p>" +
    '<div class="dz3-cams"><button type="button" data-cam="tilt">Tilted</button>' +
    '<button type="button" data-cam="top">From above</button><button type="button" data-cam="side">From the side</button>' +
    '<button type="button" data-cam="spin">Spin</button></div>' +
    "</aside></div>" +
    '<p class="dz3-note dz3-what">The wires are the engine\'s global routing: each follows a path through 1 micrometer ' +
    "tiles, and its layer is chosen by its length, short hops low and long runs high. Wires that share a tile are " +
    "drawn on top of each other; the real flow's detailed router would then give every wire its own track.</p>";
  const canvas = host.querySelector("canvas"), stage = host.querySelector(".dz3-stage");
  const togglesEl = host.querySelector(".dz3-toggles"), gapIn = host.querySelector(".dz3-range input");
  const gapOut = host.querySelector(".dz3-range output");

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#e7ebf0");
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 2000);
  camera.up.set(0, 0, 1);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a939e, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(-40, -60, 90);
  scene.add(sun);
  const box = new THREE.BoxGeometry(1, 1, 1), dummy = new THREE.Object3D();
  let content = null, place = null, gap = 1, toggles = [], shown = {}, fp = null;
  const zOf = (metal) => 0.35 + (metal - 1) * gap;             /* the height of a metal layer */

  /* the camera: a slow turn until the reader takes hold of it */
  const controls = new OrbitControls(camera, canvas);
  controls.autoRotateSpeed = 0.9;
  controls.enableZoom = false;
  controls.addEventListener("change", render);
  controls.addEventListener("start", () => { spin(false); controls.enableZoom = true; });
  /* scrolling zooms only once the reader has clicked into the view, so the
     page still scrolls past it */
  canvas.addEventListener("pointerleave", () => { controls.enableZoom = false; });
  let visible = false;
  function spin(on) {
    controls.autoRotate = on;
    renderer.setAnimationLoop(on && visible ? () => { controls.update(); renderer.render(scene, camera); } : null);
  }
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; spin(controls.autoRotate); }).observe(stage);

  let queued = false;
  function render() {
    if (queued || controls.autoRotate && visible) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; renderer.render(scene, camera); });
  }
  function size() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    render();
  }
  new ResizeObserver(size).observe(stage);

  function view(k) {
    if (!fp) return;
    if (k === "spin") { spin(true); return; }
    spin(false);
    const reach = Math.max(fp.die.W, fp.die.H), cx = fp.die.W / 2, cy = fp.die.H / 2;
    const at = { tilt: [cx - 0.55 * reach, cy - 1.05 * reach, 0.9 * reach], top: [cx, cy - 0.001, 1.9 * reach],
                 side: [cx, cy - 1.7 * reach, 0.18 * reach] }[k];
    camera.position.set(at[0], at[1], at[2]);
    controls.target.set(cx, cy, k === "side" ? zOf(4) : 1.5);
    controls.update();
    render();
  }
  host.querySelector(".dz3-cams").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-cam]");
    if (b) view(b.getAttribute("data-cam"));
  });
  gapIn.addEventListener("input", () => { gap = +gapIn.value; gapOut.textContent = gap.toFixed(1) + " µm"; if (place) place(); });
  gapOut.textContent = gap.toFixed(1) + " µm";
  togglesEl.addEventListener("change", (ev) => {
    const k = ev.target.getAttribute("data-t"), t = toggles.find((x) => x[0] === k);
    if (!t) return;
    shown[k] = ev.target.checked;
    t[3].visible = ev.target.checked;
    render();
  });

  /* throw away the last run's objects before drawing a new one */
  function clear() {
    if (!content) return;
    scene.remove(content);
    content.traverse((o) => {
      if (o.material) o.material.dispose();
      if (o.geometry && o.geometry !== box) o.geometry.dispose();
      if (o.isInstancedMesh) o.dispose();
    });
    content = null;
  }

  function update(R) {
    clear();
    const first = !fp;
    fp = R.fp;
    content = new THREE.Group();
    scene.add(content);
    const mg = (fp.die.W - fp.W) / 2, cx = fp.die.W / 2, cy = fp.die.H / 2;

    /* the die, and the core on it */
    const die = new THREE.Mesh(box, new THREE.MeshLambertMaterial({ color: "#c9d1da" }));
    die.scale.set(fp.die.W, fp.die.H, 0.6); die.position.set(cx, cy, -0.3);
    const core = new THREE.Mesh(box, new THREE.MeshLambertMaterial({ color: "#f8fafc" }));
    core.scale.set(fp.W, fp.H, 0.02); core.position.set(mg + fp.W / 2, mg + fp.H / 2, 0.01);
    content.add(die, core);

    /* the standard cells, in their rows */
    const n = R.legal.x.length, CELL_H = 0.18, col = new THREE.Color();
    const cells = new THREE.InstancedMesh(box, new THREE.MeshLambertMaterial(), n);
    for (let i = 0; i < n; i++) {
      dummy.position.set(mg + R.legal.x[i], mg + R.legal.y[i], 0.02 + CELL_H / 2);
      dummy.scale.set(Math.max(0.05, R.w[i] * 0.94), fp.rowH * 0.86, CELL_H);
      dummy.updateMatrix();
      cells.setMatrixAt(i, dummy.matrix);
      cells.setColorAt(i, col.set(GROUP_COLORS[R.group[i]]));
    }
    content.add(cells);

    /* the pins, each a short bar out from the core edge it sits on */
    const pins = new THREE.InstancedMesh(box, new THREE.MeshLambertMaterial({ color: "#7c3aed" }), fp.pins.length);
    const reach = Math.max(0.3, mg * 0.6), thin = Math.min(0.2, fp.W / 60);
    fp.pins.forEach((p, k) => {
      const side = p.side || "b", across = side === "b" || side === "t";
      const px = side === "l" ? mg - reach / 2 : side === "r" ? mg + fp.W + reach / 2 : mg + p.x;
      const py = side === "b" ? mg - reach / 2 : side === "t" ? mg + fp.H + reach / 2 : mg + p.y;
      dummy.position.set(px, py, 0.15); dummy.scale.set(across ? thin : reach, across ? reach : thin, 0.3); dummy.updateMatrix();
      pins.setMatrixAt(k, dummy.matrix);
    });
    content.add(pins);

    /* the memories: blocks that own the metal up to layer 4 over themselves */
    const memories = new THREE.Group(), memMat = new THREE.MeshLambertMaterial({ color: "#64748b" });
    fp.macros.forEach((m) => { const b = new THREE.Mesh(box, memMat); b.userData.m = m; memories.add(b); });
    content.add(memories);

    /* the wires, one set per metal layer, and the vias */
    const W = R.wires3d.wires, V = R.wires3d.vias, layers = {}, count = {};
    for (let i = 0; i < W.length; i += 5) count[W[i + 4]] = (count[W[i + 4]] || 0) + 1;
    Object.keys(METAL).forEach((k) => {
      layers[k] = new THREE.InstancedMesh(box, new THREE.MeshLambertMaterial({ color: METAL[k].c }), count[k] || 0);
      content.add(layers[k]);
    });
    const nVia = V.length / 4;
    const vias = new THREE.InstancedMesh(box, new THREE.MeshLambertMaterial({ color: "#475569" }), nVia);
    content.add(vias);

    /* the clock tree, drawn just above the top metal as its own layer */
    const cs = R.cts.segs, clockPts = [];
    for (let i = 0; i < cs.length; i += 5) {
      if (cs[i + 4] === 9) clockPts.push([cs[i], cs[i + 1], cs[i + 2], cs[i + 3]]);
      else { clockPts.push([cs[i], cs[i + 1], cs[i + 2], cs[i + 1]]); clockPts.push([cs[i + 2], cs[i + 1], cs[i + 2], cs[i + 3]]); }
    }
    const clockGeo = new THREE.BufferGeometry();
    clockGeo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(clockPts.length * 6), 3));
    const clock = new THREE.LineSegments(clockGeo, new THREE.LineBasicMaterial({ color: "#1e3a8a" }));
    content.add(clock);

    /* everything whose height depends on the layer spacing */
    place = function () {
      memories.children.forEach((b) => {
        const m = b.userData.m, top = zOf(4) + 0.1;
        b.scale.set(m.w, m.h, top); b.position.set(mg + m.x + m.w / 2, mg + m.y + m.h / 2, top / 2 + 0.02);
      });
      const at = {};
      for (let i = 0; i < W.length; i += 5) {
        const metal = W[i + 4], wide = metal >= 6 ? 0.42 : 0.28, thick = metal >= 6 ? 0.22 : 0.12;
        const x0 = mg + W[i], y0 = mg + W[i + 1], x1 = mg + W[i + 2], y1 = mg + W[i + 3];
        dummy.position.set((x0 + x1) / 2, (y0 + y1) / 2, zOf(metal));
        dummy.scale.set(Math.abs(x1 - x0) + wide, Math.abs(y1 - y0) + wide, thick);
        dummy.updateMatrix();
        at[metal] = at[metal] || 0;
        layers[metal].setMatrixAt(at[metal]++, dummy.matrix);
      }
      Object.values(layers).forEach((l) => { l.instanceMatrix.needsUpdate = true; });
      for (let k = 0; k < nVia; k++) {
        const z0 = zOf(V[k * 4 + 2]), z1 = zOf(V[k * 4 + 3]);
        dummy.position.set(mg + V[k * 4], mg + V[k * 4 + 1], (z0 + z1) / 2 - 0.05);
        dummy.scale.set(0.16, 0.16, Math.max(0.02, z1 - z0) + 0.1);
        dummy.updateMatrix();
        vias.setMatrixAt(k, dummy.matrix);
      }
      vias.instanceMatrix.needsUpdate = true;
      const pos = clockGeo.attributes.position.array, zc = zOf(7) + 0.8 * gap;
      clockPts.forEach((p, k) => { pos.set([mg + p[0], mg + p[1], zc, mg + p[2], mg + p[3], zc], k * 6); });
      clockGeo.attributes.position.needsUpdate = true;
      clockGeo.computeBoundingSphere();
      render();
    };

    /* the panel: what to show, remembered from one run to the next */
    toggles = [
      ["cells", "standard cells", "#94a3b8", cells, n, true],
      ...(fp.macros.length ? [["memories", "memories", "#64748b", memories, fp.macros.length, true]] : []),
      ...Object.keys(METAL).map((k) => ["m" + k, METAL[k].label, METAL[k].c, layers[k], count[k] || 0, true]),
      ["vias", "vias", "#475569", vias, nVia, true],
      ["clock", "clock tree (drawn above the metal)", "#1e3a8a", clock, R.cts.buffers, false],
    ];
    toggles.forEach((t) => { t[3].visible = t[0] in shown ? shown[t[0]] : t[5]; });
    togglesEl.innerHTML = toggles.map(([k, label, c, obj, num]) =>
      '<label class="dz3-toggle"><input type="checkbox" data-t="' + k + '"' + (obj.visible ? " checked" : "") + ">" +
      '<i style="background:' + c + '"></i><span>' + label + "</span><em>" + num.toLocaleString("en-US") + "</em></label>").join("");

    place();
    if (first) { view("tilt"); spin(true); }
    size();
  }

  return { update };
}
