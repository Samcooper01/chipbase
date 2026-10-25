three-viewer.min.js: the parts of three.js (https://threejs.org, version 0.186.1,
MIT license, see LICENSE) that the layout viewer uses, with its OrbitControls,
bundled and minified with esbuild 0.25.0 from this entry file:

  export { WebGLRenderer, Scene, Color, PerspectiveCamera, HemisphereLight,
    DirectionalLight, BoxGeometry, Object3D, Mesh, MeshLambertMaterial,
    InstancedMesh, Group, BufferGeometry, Float32BufferAttribute, LineSegments,
    LineBasicMaterial } from "three";
  export { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

  esbuild entry.js --bundle --format=esm --minify --legal-comments=inline

Used by /static/explore/layout3d.js. To use more of three.js, add the names
to the entry file and rebuild.
