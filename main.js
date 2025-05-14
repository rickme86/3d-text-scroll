import * as THREE from "three";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { gradientShader } from "./gradientSideShader.js";
import { createLeftWall } from "./leftWallWithLines.js";
import { createCSS3DTextWall } from './cssText3D.js';
import { CSS3DRenderer } from 'three/examples/jsm/renderers/CSS3DRenderer.js';

const USE_EXTERNAL_SCROLL = window.self !== window.top;
document.documentElement.style.overflow = USE_EXTERNAL_SCROLL ? "auto" : "auto";
document.body.style.overflow = USE_EXTERNAL_SCROLL ? "auto" : "auto";

let externalScrollY = 0;
if (USE_EXTERNAL_SCROLL) {
  window.addEventListener("message", (event) => {
    if (event.data && typeof event.data.scrollY === "number") {
      externalScrollY = event.data.scrollY;
    }
  });
}

let cssWall = null;
let cssScene, cssText, scene, camera, renderer, cssRenderer;
let textMeshBEY, meshD, meshN, meshO;
let font = null;
let viewSize = 30;
let textSize = 8;
let shaderUniforms;
let leftWall;
let shift = 3;

init();

function init() {
  scene = new THREE.Scene();
  cssScene = new THREE.Scene();
  scene.background = null;

  const aspect = window.innerWidth / window.innerHeight;

  camera = new THREE.OrthographicCamera(
    (-aspect * viewSize) / 2,
    (aspect * viewSize) / 2,
    viewSize / 2 + shift,
    -viewSize / 2 + shift,
    -100,
    500
  );

  camera.position.set(30, 30, 30);
  camera.lookAt(scene.position);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);
  document.body.appendChild(renderer.domElement);

  cssRenderer = new CSS3DRenderer();
  cssRenderer.setSize(window.innerWidth, window.innerHeight);
  cssRenderer.domElement.style.position = 'fixed';
  cssRenderer.domElement.style.top = '0';
  cssRenderer.domElement.style.left = '0';
  cssRenderer.domElement.style.pointerEvents = 'none';
  cssRenderer.domElement.style.zIndex = '0';
  renderer.domElement.style.zIndex = '1';
  document.body.appendChild(cssRenderer.domElement);

  camera.position.z = 100;

  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(50, 100, 50);
  scene.add(dirLight);

  if (!USE_EXTERNAL_SCROLL) {
    const scrollSpace = document.createElement("div");
    scrollSpace.style.height = `5000px`;
    scrollSpace.style.pointerEvents = "none";
    document.body.appendChild(scrollSpace);
  }

  shaderUniforms = {
    u_time: { value: 0 },
    u_scroll: { value: 0 }
  };

  leftWall = createLeftWall(shaderUniforms);
  scene.add(leftWall);

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

  const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(viewSize * 2.5, viewSize * 2.5), gradientShaderMaterial);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.y = -25;
  scene.add(floorMesh);

  if (!USE_EXTERNAL_SCROLL) window.scrollTo(0, 0);

  const loader = new FontLoader();
  loader.load("/fonts/ArtificBlack.typeface.json", (loadedFont) => {
    font = loadedFont;
    createText();
    animate();
  });

  window.addEventListener("resize", onWindowResize);
}

function createText() {
  if (!font) return;

  if (textMeshBEY) scene.remove(textMeshBEY);
  if (meshD) scene.remove(meshD);
  if (meshN) scene.remove(meshN);
  if (meshO) scene.remove(meshO);

  textMeshBEY = null;
  meshD = null;
  meshN = null;
  meshO = null;

  const shorterSide = Math.min(window.innerWidth, window.innerHeight);
  textSize = Math.max(3, Math.min(12, shorterSide / 80));
  const spacing = textSize * 0.9;
  const lettersBEY = ["B", "E", "Y"];

  const frontMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const sideMaterial = new THREE.MeshStandardMaterial({ color: 0x111111 });

  const shaderMaterial = new THREE.ShaderMaterial({
    vertexShader: gradientShader.vertexShader,
    fragmentShader: gradientShader.fragmentShader,
    transparent: false
  });

  textMeshBEY = new THREE.Group();
  lettersBEY.forEach((char, i) => {
    const geo = new TextGeometry(char, { font, size: textSize, height: 12, curveSegments: 12 });
    geo.computeBoundingBox();
    geo.translate(-0.5 * (geo.boundingBox.max.x + geo.boundingBox.min.x), -geo.boundingBox.min.y, -geo.boundingBox.min.z);
    const mesh = new THREE.Mesh(geo, [frontMaterial, shaderMaterial]);
    mesh.scale.set(1, 1, 0.01);
    mesh.position.x = i * spacing;
    textMeshBEY.add(mesh);
  });
  textMeshBEY.rotation.x = -Math.PI / 2;
  textMeshBEY.rotation.z = Math.PI / 2;
  scene.add(textMeshBEY);

  meshD = new THREE.Mesh(new TextGeometry("D", { font, size: textSize, height: 2, curveSegments: 12 }), [frontMaterial, sideMaterial]);
  meshD.scale.set(1, 1, 0.01);
  scene.add(meshD);

  meshN = new THREE.Mesh(new TextGeometry("N", { font, size: textSize, height: 2, curveSegments: 12 }), [frontMaterial, sideMaterial]);
  meshN.scale.set(1, 1, 0.01);
  meshN.rotation.x = -Math.PI / 2;
  meshN.rotation.z = Math.PI / 2;
  scene.add(meshN);

  meshO = new THREE.Mesh(new TextGeometry("O", { font, size: textSize, height: 2, curveSegments: 12 }), [frontMaterial.clone(), sideMaterial]);
  meshO.scale.set(1, 1, 0.01);
  scene.add(meshO);

  // ✅ Mobile/Desktop positioning
  const isMobile = window.innerWidth < 768;
  const totalWidth = (lettersBEY.length - 1) * spacing;

  if (isMobile) {
    textMeshBEY.position.set(0, -textSize * 0.2, 6);
    meshD.position.set(6, 4, -textSize * 1.5);
    meshN.position.set(8, -textSize * 1.2, 4);
    meshO.position.set(1, -textSize * -0.9, 7);
    meshO.rotation.set(0, Math.PI / 2, 0);
  } else {
    textMeshBEY.position.set(-totalWidth / 1.7, -25, 4);
    meshD.position.set(spacing * 1.2, 2, -textSize);
    meshN.position.set(-spacing * -2, -textSize / 4, 15);
    meshN.position.y = -25;
    meshO.position.set(-spacing * 0, -textSize / 1, 8);
    meshO.position.y = -25;
    meshO.rotation.x = -Math.PI / 2;
    meshO.rotation.z = Math.PI / 2;
  }

  if (!cssWall) {
    cssWall = createCSS3DTextWall(80, 32, new THREE.Vector3(-10, -20, -200));
    cssWall.scale.set(0.05, 0.05, 0.05);
    cssScene.add(cssWall);
  }
}


function onWindowResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const aspect = width / height;

  renderer.setSize(width, height);
  cssRenderer.setSize(width, height);

  camera.left = (-aspect * viewSize) / 2;
  camera.right = (aspect * viewSize) / 2;
  camera.top = viewSize / 2 + shift;
  camera.bottom = -viewSize / 2 + shift;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(window.devicePixelRatio);

  if (font) {
    createText();
  }

  if (cssWall) {
    cssWall.scale.set(0.1, 0.1, 0.001);
    cssWall.position.z = -200;
    
    const viewWidth = camera.right - camera.left;
    cssWall.position.x = camera.left + viewWidth * 0.05; // ~5% from left
    cssWall.position.y = camera.bottom + (viewSize * 0.5); // vertically center-ish
}
  
}

// (rest of the code above remains unchanged)

// (rest of the code above remains unchanged)

function animate() {
  requestAnimationFrame(animate);

  const rawScroll = USE_EXTERNAL_SCROLL ? externalScrollY : window.scrollY;
  const maxScroll = 5000;
  const scrollProgress = Math.min(rawScroll / maxScroll, 1);

  const easeOut = (t) => Math.pow(t, 1.5);
  const elapsed = performance.now() / 1000;

  shaderUniforms.u_time.value = elapsed;
  shaderUniforms.u_scroll.value = rawScroll;

  const baseVerticalOffset = 50;
  const maxScrollShift = 80;
  const verticalShift = baseVerticalOffset - easeOut(scrollProgress) * maxScrollShift;

  const aspect = window.innerWidth / window.innerHeight;
  camera.left = (-aspect * viewSize) / 2;
  camera.right = (aspect * viewSize) / 2;
  camera.top = viewSize / 2 + verticalShift;
  camera.bottom = -viewSize / 2 + verticalShift;
  camera.position.y = 30 + verticalShift;
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();

  // 🔧 Update CSS wall position responsively
  if (cssWall) {
    const isMobile = window.innerWidth < 768;
    cssWall.scale.set(0.1, 0.1, 0.001);
    cssWall.position.z = -200;

    if (isMobile) {
      cssWall.position.x = camera.left + (camera.right - camera.left) * 0.1;
      cssWall.position.y = camera.bottom + viewSize * 0.4;
    } else {
      cssWall.position.x = camera.left + (camera.right - camera.left) * 0.3;
      cssWall.position.y = camera.bottom + viewSize * 0.5;
    }
  }

  if (leftWall.userData.update) {
    leftWall.userData.update(elapsed, scrollProgress);
  }

  const growthSpeeds = { BEY: [6, 6, 6], O: 0.65, N: 1.5, D: 0.5 };

  if (textMeshBEY) {
    console.log('Animating BEY, children count:', textMeshBEY.children.length); // Debug
    textMeshBEY.children.forEach((child, index) => {
      let delay = 0.2 * index;
      if (index === 1) delay -= 0.2;
      if (index === 2) delay -= 0.5;

      const localProgress = THREE.MathUtils.clamp((scrollProgress - delay) / 4.0, 0, 1);
      const eased = easeOut(localProgress);
      const targetZ = 0.01 + eased * growthSpeeds.BEY[index];
      child.scale.z += (targetZ - child.scale.z) * 0.3;
    });
  }

  const ondLetters = [meshO, meshN, meshD];
  const ondDelays = [0.0, 0.2, 0.25];
  const ondGrowthSpeeds = [growthSpeeds.O, growthSpeeds.N, growthSpeeds.D];

  ondLetters.forEach((mesh, i) => {
    if (!mesh) return;
    const delay = ondDelays[i];
    const duration = 0.6;
    const localProgress = THREE.MathUtils.clamp((scrollProgress - 0.25 - delay) / duration, 0, 1);
    const eased = easeOut(localProgress);
    const targetZ = 0.01 + eased * ondGrowthSpeeds[i];
    mesh.scale.z += (targetZ - mesh.scale.z) * 0.3;

    mesh.material.forEach?.((m) => {
      if (m.transparent) m.opacity = eased;
    });
  });

  cssRenderer.render(cssScene, camera);
  renderer.render(scene, camera);
}

