import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

let scene, camera, renderer;
let textMesh = null;
let font = null;

const viewSize = 30;

init();

function init() {
  setTimeout(() => window.scrollTo(0, 0), 10); // force scroll to top after layout

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const aspect = window.innerWidth / window.innerHeight;
  camera = new THREE.OrthographicCamera(
    (-aspect * viewSize) / 2,
    (aspect * viewSize) / 2,
    viewSize / 2,
    -viewSize / 2,
    0.1,
    100
  );
  camera.position.set(10, 20, 10);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(10, 30, 10);
  scene.add(dirLight);

  const loader = new FontLoader();
  loader.load(
  'https://media.rickmerks.nl/json/ArtificVariable-FIXED.typeface.json',

    (loadedFont) => {
      font = loadedFont;

      const geometry = new TextGeometry('BEY', {
        font: font,
        size: 4,
        height: 1, // base depth
        curveSegments: 12,
        bevelEnabled: false
      });

      geometry.computeBoundingBox();
      const bbox = geometry.boundingBox;
      geometry.translate(
        -0.5 * (bbox.max.x + bbox.min.x),
        -0.5 * (bbox.max.y + bbox.min.y),
        -bbox.min.z
      );

      const materials = [
        new THREE.MeshStandardMaterial({ color: 0xffffff }), // caps
        new THREE.MeshStandardMaterial({ color: 0x000000 })  // sides
      ];

      textMesh = new THREE.Mesh(geometry, materials);
      textMesh.rotation.x = -Math.PI / 2;
      textMesh.scale.z = 0.01; // start flat
      scene.add(textMesh);

      animate();
    }
  );

  window.addEventListener('resize', onWindowResize);
}

function animate() {
  requestAnimationFrame(animate);

  const scrollY = window.scrollY;
  const maxScroll = document.body.scrollHeight - window.innerHeight;
  const progress = THREE.MathUtils.clamp(scrollY / maxScroll, 0.01, 1);
  const scaleZ = progress * 1.5;

  if (textMesh) {
    textMesh.scale.z = scaleZ;
  }

  renderer.render(scene, camera);
}

function onWindowResize() {
  const aspect = window.innerWidth / window.innerHeight;
  camera.left = (-aspect * viewSize) / 2;
  camera.right = (aspect * viewSize) / 2;
  camera.top = viewSize / 2;
  camera.bottom = -viewSize / 2;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
