import * as THREE from "three";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { createShaderWall } from "./shaderWall.js";
import { gradientShader } from "./gradientSideShader.js";
import { createLeftWall } from "./leftWallWithLines.js";

const USE_EXTERNAL_SCROLL = window.self !== window.top;
document.documentElement.style.overflow = USE_EXTERNAL_SCROLL ? "auto" : "auto";
document.body.style.overflow = USE_EXTERNAL_SCROLL ? "auto" : "auto";

console.log(USE_EXTERNAL_SCROLL ? "👀 External scroll (Framer iframe) enabled" : "🧪 Local scroll mode (standalone)");

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
let shaderUniforms;
let leftWall;
let shift = 3;


function stickyEase(t) {
  // Flatten the middle of the scroll to make animation "stick" longer
  return Math.pow(Math.sin((t * Math.PI) / 2), 3);
}


init();

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const aspect = window.innerWidth / window.innerHeight;
  viewSize = 30;

  const shift = 3; // move view upward by 5 units

  camera = new THREE.OrthographicCamera(
    (-aspect * viewSize) / 2,
    (aspect * viewSize) / 2,
    viewSize / 2 + shift,
    -viewSize / 2 + shift,
    0.1,
    100
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

  // ✅ Dynamically add scroll height if not in Framer
  if (!USE_EXTERNAL_SCROLL) {
    const scrollSpace = document.createElement("div");
    const maxScroll = 5000;
    scrollSpace.style.height = `${maxScroll}px`;
    scrollSpace.style.pointerEvents = "none";
    document.body.appendChild(scrollSpace);
  }

  shaderUniforms = {
    u_time: { value: 0 },
    u_scroll: { value: 0 }
  };

  shaderUniforms = {
    u_time: { value: 0 },
    u_scroll: { value: 0 }
  };

  const shaderWall = createShaderWall(shaderUniforms);
  scene.add(shaderWall);

  leftWall = createLeftWall(shaderUniforms);
  scene.add(leftWall);

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

  const planeSize = viewSize * 2.5;
  const floorGeometry = new THREE.PlaneGeometry(planeSize, planeSize);
  const floorMesh = new THREE.Mesh(floorGeometry, gradientShaderMaterial);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.y = -20;
  scene.add(floorMesh);
  if (!USE_EXTERNAL_SCROLL) {
    window.scrollTo(0, 0);
  }

  const loader = new FontLoader();
  loader.load("/fonts/ArtificBlack.typeface.json", (loadedFont) => {
    font = loadedFont;
    createText();
    animate();
  });

  window.addEventListener("resize", onWindowResize);
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

  const shaderSideMaterial = new THREE.MeshStandardMaterial({
    color: 0x111111, // dark gray or any solid color
    roughness: 0.8,
    metalness: 0.2
  });

  const frontMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const textMaterials = [frontMaterial, shaderSideMaterial];

  // --- BEY ---
  let globalMinY = Infinity;
  let globalMaxY = -Infinity;

  textMeshBEY = new THREE.Group();
  const lettersBEY = ["B", "E", "Y"];
  const tempGeometries = [];

  lettersBEY.forEach((char, i) => {
    const geo = new TextGeometry(char, {
      font,
      size: textSize,
      height: 12,
      curveSegments: 12
    });
    geo.computeBoundingBox();
    const bbox = geo.boundingBox;

    geo.translate(-0.5 * (bbox.max.x + bbox.min.x), -bbox.min.y, -bbox.min.z);

    // 🔽 NEW: Clone gradientShader material for each letter
    const shaderMaterial = new THREE.ShaderMaterial({
      vertexShader: gradientShader.vertexShader,
      fragmentShader: gradientShader.fragmentShader,
      transparent: false
    });

    const mesh = new THREE.Mesh(geo, [
      new THREE.MeshStandardMaterial({ color: 0xffffff }), // front
      shaderMaterial // side
    ]);

    mesh.scale.set(1, 1, 0.01);
    mesh.castShadow = true;
    mesh.position.x = i * spacing;
    mesh.position.y = 0;
    textMeshBEY.add(mesh);
  });

  textMeshBEY.rotation.x = -Math.PI / 2;
  textMeshBEY.rotation.z = Math.PI / 2;

  // --- D ---
  const geoD = new TextGeometry("D", { font, size: textSize, height: 2, curveSegments: 12 });
  geoD.computeBoundingBox();
  const bboxD = geoD.boundingBox;
  geoD.translate(-0.5 * (bboxD.max.x + bboxD.min.x), -0.5 * (bboxD.max.y + bboxD.min.y), -bboxD.min.z);
  meshD = new THREE.Mesh(geoD, textMaterials);
  meshD.scale.set(1, 1, 0.01);
  meshD.castShadow = true;
  meshD.rotation.set(0, Math.PI / 45, 0);
  window.meshD = meshD;

  // --- N ---
  const geoN = new TextGeometry("N", { font, size: textSize, height: 2, curveSegments: 12 });
  geoN.computeBoundingBox();
  const bboxN = geoN.boundingBox;
  geoN.translate(-0.5 * (bboxN.max.x + bboxN.min.x), -0.5 * (bboxN.max.y + bboxN.min.y), -bboxN.min.z);
  meshN = new THREE.Mesh(geoN, textMaterials);
  meshN.scale.set(1, 1, 0.01);
  meshN.castShadow = true;
  meshN.rotation.x = -Math.PI / 2;
  meshN.rotation.z = Math.PI / 2;

  // --- O ---
  const geoO = new TextGeometry("O", { font, size: textSize, height: 2, curveSegments: 12 });
  geoO.computeBoundingBox();
  const bboxO = geoO.boundingBox;
  geoO.translate(-0.5 * (bboxO.max.x + bboxO.min.x), -0.5 * (bboxO.max.y + bboxO.min.y), -bboxO.min.z);

  const oMaterialFront = frontMaterial.clone();
  const meshOMaterials = [oMaterialFront, shaderSideMaterial];

  meshO = new THREE.Mesh(geoO, meshOMaterials);
  meshO.scale.set(isMobile ? 0.9 : 1, isMobile ? 0.9 : 1, 0.01);
  meshO.castShadow = true;

  // --- Position ---
  if (isMobile) {
    textMeshBEY.position.set(0, -textSize * 0.2, 6);
    meshD.position.set(6, 4, -textSize * 1.5);
    meshN.position.set(8, -textSize * 1.2, 4);
    meshO.position.set(1, -textSize * -0.9, 7);
    meshO.rotation.set(0, Math.PI / 2, 0);
  } else {
    const totalWidth = (lettersBEY.length - 1) * spacing;
    textMeshBEY.position.set(-totalWidth / 2, -25, 0);

    meshD.position.set(spacing * 1.6, 11, -textSize);
    meshN.position.set(-spacing * -1, -textSize / 2, -4);
    meshO.position.set(-spacing * 0, -textSize / 1, 8);
    meshO.rotation.x = -Math.PI / 2;
    meshO.rotation.z = Math.PI / 2;
  }

  scene.add(textMeshBEY);
  scene.add(meshD);
  scene.add(meshN);
  scene.add(meshO);
}

function onWindowResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const aspect = width / height;

  renderer.setSize(width, height);

  // Update orthographic camera bounds
  camera.left = (-aspect * viewSize) / 2;
  camera.right = (aspect * viewSize) / 2;
  camera.top = viewSize / 2 + shift;
  camera.bottom = -viewSize / 2 + shift;

  camera.updateProjectionMatrix();

  renderer.setSize(width, height);

  renderer.setPixelRatio(window.devicePixelRatio);

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
  const maxScroll = 3000;
  
  
  const scrollProgressRaw = Math.min(rawScroll / maxScroll, 1);
  const scrollSlowFactor = 0.2; // try 0.3 to 0.6
  const scrollProgress = Math.min(rawScroll / maxScroll, 1);
  
  
  const easedScrollProgress = stickyEase(scrollProgress);
  const easeOut = (t) => Math.pow(t, 1.5); // starts slow
  const easedScroll = easeOut(scrollProgress);
  const step = 0.3;
  const growthSpeed = 0.4;

  const elapsed = performance.now() / 1000;
  shaderUniforms.u_time.value = elapsed;
  shaderUniforms.u_scroll.value = scrollProgressRaw;

  // 🔁 Scroll-based view expansion
  const baseViewSize = 30;
  const baseVerticalOffset = 50; // 👈 how much higher to start viewing
  const maxScrollShift = 80; // 👈 how much additional to reveal when scrolling
  const verticalShift = baseVerticalOffset - easedScroll * maxScrollShift;

  const aspect = window.innerWidth / window.innerHeight;

  camera.left = (-aspect * baseViewSize) / 2;
  camera.right = (aspect * baseViewSize) / 2;
  camera.top = baseViewSize / 2 + verticalShift;
  camera.bottom = -baseViewSize / 2 + verticalShift;

  camera.position.y = 30 + verticalShift;
  camera.lookAt(0, 0, 0);

  camera.updateProjectionMatrix();

  // Define scroll segments
  const progressBEY = THREE.MathUtils.clamp(scrollProgress / 0.3, 0, 1);
  const easedBEY = easeOut(progressBEY);

  const progressOND = THREE.MathUtils.clamp((scrollProgress - 0.3) / 0.3, 0, 1);
  const easedOND = easeOut(progressOND);

  const progressO = THREE.MathUtils.clamp((scrollProgress - 0.6) / 0.4, 0, 1);
  const easedO = easeOut(progressO);

  shaderUniforms.u_time.value = elapsed;
  shaderUniforms.u_scroll.value = scrollProgressRaw;

  if (leftWall.userData.update) {
    leftWall.userData.update(elapsed, scrollProgress);
  }

  // Animate BEY
  if (textMeshBEY) {
    const stepOffset = 0.15;
 textMeshBEY.children.forEach((child, index) => {
 let delay = 0.3 * index;

// Speed up E and Y by starting them slightly earlier
if (index === 1) delay = Math.max(0, delay - 0.1); // E
if (index === 2) delay = Math.max(0, delay - 0.2); // Y


  const duration = 0.2;
  const easedScroll = easeOut(scrollProgress);

  const localProgress = THREE.MathUtils.clamp((scrollProgress - delay) / 0.6, 0, 1); // was 0.2
  const eased = easeOut(localProgress);

  const targetZ = 0.01 + eased * growthSpeed;
  child.scale.z += (targetZ - child.scale.z) * 0.3;


});


  }

  // Animate D
  if (meshD) {
    const delay = 0.7;
    const localProgress = THREE.MathUtils.clamp((progressOND - delay) / (1 - delay), 0, 1);
    const eased = easeOut(localProgress);
    const targetZ = 0.01 + eased * 0.25;
    meshD.scale.z += (targetZ - meshD.scale.z) * 0.05;
  }

  // Animate N
  if (meshN) {
    const eased = easeOut(progressOND);
    const targetZ = 0.01 + eased * 0.15;
    meshN.scale.z += (targetZ - meshN.scale.z) * 0.05;
  }

  // Animate O (extrusion + opacity)
  if (meshO) {
    const delay = 0.8;
    const duration = 0.9;
    const localProgress = THREE.MathUtils.clamp((progressO - delay) / duration, 0, 1);
    const eased = easeOut(localProgress);

    const targetZ = 0.1 + eased * 0.08;
    meshO.scale.z += (targetZ - meshO.scale.z) * 0.1;

    meshO.material.forEach((m) => {
      if (m && m.transparent) m.opacity = eased;
    });
  }

  renderer.render(scene, camera);
}
