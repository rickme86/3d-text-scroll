import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

const USE_EXTERNAL_SCROLL = window.self !== window.top;
document.body.style.overflow = USE_EXTERNAL_SCROLL ? "hidden" : "auto";
console.log(
  USE_EXTERNAL_SCROLL ?
    "👀 External scroll (Framer iframe) enabled" :
    "🧪 Local scroll mode (standalone)"
);


let externalScrollY = 0;

// ✅ Only listen for messages if Framer is controlling scroll
if (USE_EXTERNAL_SCROLL) {
  window.addEventListener("message", (event) => {
    if (event.data && typeof event.data.scrollY === "number") {
      externalScrollY = event.data.scrollY;
    }
  });
}

let scene, camera, renderer;
let textMeshBEY, meshD, meshN, meshO; // So you can access them globally
let font = null;
let viewSize = 30;
let textSize = 8; // ✅ Global and responsive

init();

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const aspect = window.innerWidth / window.innerHeight;
  viewSize = 30;

  camera = new THREE.OrthographicCamera(
    (-aspect * viewSize) / 2, (aspect * viewSize) / 2,
    viewSize / 2, -viewSize / 2,
    0.1, 100
  );
  camera.position.set(30, 30, 30);
  camera.lookAt(scene.position);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(50, 100, 50);
  scene.add(dirLight);

  // ✅ Gradient Noise Floor Shader
  const gradientShaderMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision mediump float;
      varying vec2 vUv;

      float rand(vec2 co) {
        return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
      }

      void main() {
        float noise = rand(vUv * 100.0) * 0.05;
        float gradient = 1.0 - smoothstep(0.0, 1.0, vUv.y);
        vec3 color = vec3(gradient * 0.1 + noise);
        gl_FragColor = vec4(color, gradient);
      }
    `
  });

  const planeSize = 50;
  const floorGeometry = new THREE.PlaneGeometry(planeSize, planeSize);
  const floorMesh = new THREE.Mesh(floorGeometry, gradientShaderMaterial);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.y = -10;
  scene.add(floorMesh);

  const loader = new FontLoader();
  loader.load('/fonts/ArtificBlack.typeface.json', (loadedFont) => {
    font = loadedFont;
    createText();
    animate();
  });

  window.addEventListener('resize', onWindowResize);
}

if (font) {
  if (textMeshBEY) scene.remove(textMeshBEY);
  if (meshD) scene.remove(meshD);
  if (meshN) scene.remove(meshN);
  if (meshO) scene.remove(meshO); // ✅ remove old "O"

  textMeshBEY = null;
  meshD = null;
  meshN = null;
  meshO = null;

  createText();
}

function createText() {
  const shorterSide = Math.min(window.innerWidth, window.innerHeight);
  textSize = Math.max(3, Math.min(12, shorterSide / 80));
  const spacing = textSize * 0.9;
  const isMobile = window.innerWidth < 768;

  const textMaterials = [
    new THREE.MeshStandardMaterial({ color: 0xffffff }),
    new THREE.MeshStandardMaterial({ color: 0x000000 })
  ];

  // --- BEY ---
  textMeshBEY = new THREE.Group();
  const lettersBEY = ['B', 'E', 'Y'];
  lettersBEY.forEach((char, i) => {
    const geo = new TextGeometry(char, { font, size: textSize, height: 2, curveSegments: 12 });
    geo.computeBoundingBox();
    const bbox = geo.boundingBox;
    geo.translate(
      -0.5 * (bbox.max.x + bbox.min.x),
      -0.5 * (bbox.max.y + bbox.min.y),
      -bbox.min.z
    );
    const mesh = new THREE.Mesh(geo, textMaterials);
    mesh.scale.set(1, 1, 0.01);
    mesh.castShadow = true;
    mesh.position.x = i * spacing;
    textMeshBEY.add(mesh);
  });

  textMeshBEY.rotation.x = -Math.PI / 2;
  textMeshBEY.rotation.z = Math.PI / 2;

  // --- D ---
  const geoD = new TextGeometry('D', { font, size: textSize, height: 2, curveSegments: 12 });
  geoD.computeBoundingBox();
  const bboxD = geoD.boundingBox;
  geoD.translate(
    -0.5 * (bboxD.max.x + bboxD.min.x),
    -0.5 * (bboxD.max.y + bboxD.min.y),
    -bboxD.min.z
  );
  meshD = new THREE.Mesh(geoD, textMaterials);
  meshD.scale.set(1, 1, 0.01);
  meshD.castShadow = true;
  meshD.rotation.set(0, Math.PI / 45, 0);
  window.meshD = meshD; 

  // --- N ---
  const geoN = new TextGeometry('N', { font, size: textSize, height: 2, curveSegments: 12 });
  geoN.computeBoundingBox();
  const bboxN = geoN.boundingBox;
  geoN.translate(
    -0.5 * (bboxN.max.x + bboxN.min.x),
    -0.5 * (bboxN.max.y + bboxN.min.y),
    -bboxN.min.z
  );
  meshN = new THREE.Mesh(geoN, textMaterials);
  meshN.scale.set(1, 1, 0.01);
  meshN.castShadow = true;
  meshN.rotation.x = -Math.PI / 2;
  meshN.rotation.z = Math.PI / 2;
  
  const oMaterialFront = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0
});

const oMaterialSide = new THREE.MeshStandardMaterial({
  color: 0x000000,
  transparent: true,
  opacity: 0
});

  
  const oMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0 // start fully transparent
});

  // --- O ---
  const geoO = new TextGeometry('O', { font, size: textSize, height: 2, curveSegments: 12 });
  geoO.computeBoundingBox();
  const bboxO = geoO.boundingBox;
  geoO.translate(
    -0.5 * (bboxO.max.x + bboxO.min.x),
    -0.5 * (bboxO.max.y + bboxO.min.y),
    -bboxO.min.z
  );
meshO = new THREE.Mesh(geoO, [oMaterialFront, oMaterialSide]);

 if (isMobile) {
  meshO.scale.set(0.9, 0.9, 0.01); // smaller and centered inside "B"
} else {
  meshO.scale.set(1, 1, 0.01); // full size on desktop
}

  meshO.castShadow = true;


  // --- Position all text based on device ---
  if (isMobile) {
    // 📱 Mobile: compact layout
    textMeshBEY.position.set(0, -textSize * 0.2, 6);
    meshD.position.set(6, 4, -textSize * 1.5);
    meshN.position.set(8, -textSize * 1.2, 4);
    meshO.position.set(1, -textSize * -0.9, 7);
    meshO.rotation.set(0, Math.PI / 2, 0); //
  } else {
    // 🖥️ Desktop: spread-out layout
    const totalWidth = (lettersBEY.length - 1) * spacing;
    textMeshBEY.position.set(-totalWidth / 2, -textSize / 2, 20);
    meshD.position.set(spacing * 1.6, 11, -textSize);
    meshN.position.set(-spacing * -1, -textSize / 2, -4);
    meshO.position.set(-spacing * 0, -textSize / 1, 15); // to left of B
    meshO.position.set(-spacing * 0, -textSize / 1, 8); // to left of B
    meshO.rotation.x = -Math.PI / 2;
    meshO.rotation.z = Math.PI / 2;
  }

  // --- Add to scene ---
  scene.add(textMeshBEY);
  scene.add(meshD);
  scene.add(meshN);
  scene.add(meshO);
}


function onWindowResize() {
  const aspect = window.innerWidth / window.innerHeight;
  viewSize = 30;

  camera.left = (-aspect * viewSize) / 2;
  camera.right = (aspect * viewSize) / 2;
  camera.top = viewSize / 2;
  camera.bottom = -viewSize / 2;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);

  if (font) {
    if (textMeshBEY) scene.remove(textMeshBEY);
    if (meshD) scene.remove(meshD);
    if (meshN) scene.remove(meshN);
    if (meshO) scene.remove(meshO); // ✅ remove old "O"

    textMeshBEY = null;
    meshD = null;
    meshN = null;
    meshO = null;

    createText(); // Rebuild everything with current layout
  }
}



function animate() {
  requestAnimationFrame(animate);

const rawScroll = USE_EXTERNAL_SCROLL ? externalScrollY : window.scrollY;
const maxScroll = 1500;
const scrollProgress = Math.min(rawScroll / maxScroll, 1);

  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const step = 0.3;
  const growthSpeed = 0.2;

  textMeshBEY.children.forEach((child, index) => {
    const easedScroll = easeOut(scrollProgress);
    const progress = THREE.MathUtils.clamp((easedScroll - index * step) / step, 0, 1);
    const eased = easeOut(progress);
    const targetZ = 0.01 + eased * growthSpeed;
    child.scale.z += (targetZ - child.scale.z) * 0.02;
  });

  if (window.meshD) {
    const easedScroll = easeOut(scrollProgress);
    const minZ = 0.01;
    const maxZ = 0.21;
    const targetZ = minZ + (maxZ - minZ) * easedScroll;
    meshD.scale.z += (targetZ - meshD.scale.z) * 0.1;
  }
  if (meshN) {
  const easedScroll = easeOut(scrollProgress);
  const minZ = 0.01;
  const maxZ = 0.15; // Slightly less than D if desired
  const targetZ = minZ + (maxZ - minZ) * easedScroll;
  meshN.scale.z += (targetZ - meshN.scale.z) * 0.1;
}
if (meshO) {
  const delay = 0.9;
  const duration = 0.1;
  const easedScroll = easeOut(scrollProgress);
  const localProgress = THREE.MathUtils.clamp((easedScroll - delay) / duration, 0, 1);
  const eased = easeOut(localProgress);

  // ✅ Add it to the scene only once, after delay is reached
  if (!scene.children.includes(meshO) && easedScroll > delay) {
    scene.add(meshO);
  }

  // Animate only after it's added
  if (scene.children.includes(meshO)) {
    // Extrusion
    const minZ = 0.01;
    const maxZ = 0.08;
    const targetZ = minZ + (maxZ - minZ) * eased;
    meshO.scale.z += (targetZ - meshO.scale.z) * 0.1;

    // Opacity fade
    meshO.material.forEach(m => {
      if (m && m.transparent) {
        m.opacity = eased;
      }
    });
  }
}







  renderer.render(scene, camera);
}
