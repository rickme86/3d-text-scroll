import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

let scene, camera, renderer;
let textMeshBEY, textMeshD, textMeshN;
let font = null;
let cube;
let group = new THREE.Group();
let scaleFactor = 1;
let viewSize = Math.max(20, Math.min(40, window.innerHeight / 20));
const baseSize = 30;

let lines = [];
const lineCount = 30;

const uniforms = {
  u_time: { value: 0.0 },
  u_scroll: { value: 0.0 },
  u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
};

const holders = {
  BEY: new THREE.Object3D(),
  D: new THREE.Object3D(),
  N: new THREE.Object3D()
};

init();

function init() {
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

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(0, 30, 0);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.left = -50;
  dirLight.shadow.camera.right = 50;
  dirLight.shadow.camera.top = 50;
  dirLight.shadow.camera.bottom = -50;
  scene.add(dirLight);

  const gradientShaderMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
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

      vec2 rotateUV(vec2 uv, float angle) {
        float s = sin(angle);
        float c = cos(angle);
        uv -= 0.5;
        uv = mat2(c, -s, s, c) * uv;
        uv += 0.5;
        return uv;
      }

      void main() {
        vec2 uv = rotateUV(vUv, radians(30.0));
        float noise = rand(uv * 50.0) * 0.05;
        float mask = 1.0 - smoothstep(0.4, 1.5, uv.x + uv.y);
        vec3 baseColor = vec3(0.05);
        vec3 color = baseColor + vec3(noise);
        gl_FragColor = vec4(color, mask);
      }
    `
  });
  gradientShaderMaterial.receiveShadow = true;

  const shaderMaterial = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
  precision highp float;
uniform float u_time;
uniform float u_scroll;
varying vec2 vUv;

float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

// Organic scattered stars
float starField(vec2 uv, float density, float brightness) {
  vec2 grid = floor(uv * density);
  vec2 jitter = fract(uv * density);
  float rnd = random(grid);
  float d = distance(jitter, vec2(0.5));
  float baseStar = 1.0 - smoothstep(0.0, 0.1, d);
  baseStar *= step(1.0 - brightness, rnd);

  // ✨ Twinkle using time + randomness
  float twinkle = sin(u_time * 5.0 + rnd * 50.0) * 0.5 + 0.5;
  return baseStar * twinkle;
}

void main() {
  vec2 uv = vUv;

  // 🌀 Scroll-based UV displacement
  float scrollWarp = u_scroll * 0.2;
  uv += vec2(
    sin(uv.y * 10.0 + u_time * 0.5) * scrollWarp,
    cos(uv.x * 10.0 + u_time * 0.4) * scrollWarp
  );

  // 🌌 Parallax on star field (independent motion)
  vec2 parallaxUV = uv + vec2(
    sin(u_time * 0.1) * 0.01,
    cos(u_time * 0.15) * 0.01
  );

  // 🎨 Color wave
  float wave1 = sin((uv.x + uv.y + u_time * 0.05) * (5.0 + u_scroll * 10.0));
  float wave2 = cos((uv.x - uv.y + u_time * 0.1) * (4.0 + u_scroll * 6.0));
  float combined = (wave1 + wave2) * 0.5;
  float g = smoothstep(0.0, 1.0, uv.x + uv.y + combined * 0.1 - 0.4);

  vec3 pink   = vec3(1.0, 0.7, 0.8);
  vec3 orange = vec3(1.0, 0.6, 0.1);
  vec3 navy   = vec3(0.1, 0.2, 0.4);
  vec3 aqua   = vec3(0.4, 0.8, 0.9);

  vec3 color = mix(pink, orange, smoothstep(0.0, 0.33, g));
  color = mix(color, navy,   smoothstep(0.3, 0.66, g));
  color = mix(color, aqua,   smoothstep(0.65, 1.0, g));

  // 🩸 Animated ink reveal (breathe/drip)
  vec2 origin = vec2(1.0, 1.0);
  float dist = distance(vUv, origin);
  float radius = u_scroll * 1.5 + sin(u_time * 2.0) * 0.05; // pulse the mask
  float mask = 1.0 - smoothstep(radius - 0.1, radius + 0.2, dist);

  // 🌠 Stars: parallax + twinkle
  float stars = starField(parallaxUV * 50.0, 40.0, 0.999);
  vec3 bgColor = mix(vec3(0.0), vec3(1.0), stars);

  // 🧵 Blend between stars and color using mask
  vec3 finalColor = mix(bgColor, color, mask);

  // ✴ Grain + vignette
  float grain = random(uv * u_time * 0.5) * 0.05;
  finalColor += grain;

  float vignette = smoothstep(0.9, 0.5, distance(vUv, vec2(0.5)));
  finalColor *= vignette;

  gl_FragColor = vec4(finalColor, 1.0);
}

    `,
    side: THREE.BackSide
  });

  scaleFactor = Math.max(0.7, Math.min(1.2, window.innerWidth / 1000));
  const boxSize = baseSize * scaleFactor;

  const materials = [
    new THREE.MeshStandardMaterial({ color: 0xff0000 }),
    gradientShaderMaterial,
    new THREE.MeshStandardMaterial({ color: 0x0000ff }),
    gradientShaderMaterial,
    new THREE.MeshStandardMaterial({ color: 0xff00ff }),
    shaderMaterial
  ];

  cube = new THREE.Mesh(new THREE.BoxGeometry(boxSize, boxSize, boxSize), materials);
  cube.material.forEach((mat, index) => {
    mat.side = THREE.BackSide;
    if (index === 3) mat.receiveShadow = true;
  });
  cube.position.y = -boxSize / 2;
  scene.add(cube);
  cube.renderOrder = 0; // ✅ Ensures cube is rendered before lines

function createLines(boxSize) {
  lines.forEach(line => scene.remove(line));
  lines = [];

  const x = -boxSize / 2;
  const zStart = -boxSize * 0.5;
  const zEnd = boxSize * 2;

  const lineSpacing = -boxSize * 0.05;
  const totalLines = Math.ceil(boxSize * 40);
  const baseY = boxSize / 2;

  const vertexShader = `
    attribute float alpha;
    uniform vec2 uMouse;
    uniform float uTime;
    varying float vAlpha;

    void main() {
      vAlpha = alpha;

      // Distance between current vertex and mouse (Y/Z plane)
      float dist = distance(vec2(position.y, position.z), uMouse);

      // Displacement effect based on distance and time
      float disp = 0.5 * sin(dist * 5.0 - uTime * 2.0) * exp(-dist * 3.0);
      vec3 displaced = position + vec3(disp, 0.0, 0.0); // offset in X

      gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
    }
  `;

  const fragmentShader = `
    uniform float uAlpha;
    varying float vAlpha;

    void main() {
      float alpha = uAlpha * vAlpha;
      gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
    }
  `;

  for (let i = 0; i < totalLines; i++) {
    const lineY = baseY + i * lineSpacing;

    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x, lineY, zEnd),
      new THREE.Vector3(x, lineY, zStart)
    ]);

    const alphas = new Float32Array([1.0, 0.0]); // fade right to left
    geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uAlpha: { value: 0.0 },
        uMouse: { value: new THREE.Vector2(0, 0) },
        uTime: { value: 0 }
      },
      transparent: true,
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });

    const line = new THREE.Line(geometry, material);
    line.renderOrder = 1;
    scene.add(line);
    lines.push(line);
  }

  // Update uMouse on mouse move
  window.addEventListener('mousemove', (event) => {
    const y = (event.clientY / window.innerHeight - 0.5) * boxSize * 2;
    const z = (event.clientX / window.innerWidth - 0.5) * boxSize * 2;

    lines.forEach(line => {
      line.material.uniforms.uMouse.value.set(y, z);
    });
  });
}

createLines(boxSize);


  cube.add(holders.BEY);
  cube.add(holders.D);
  cube.add(holders.N);
  scene.add(group);
  holders.BEY.renderOrder = 0;
holders.D.renderOrder = 0;


  const loader = new FontLoader();
  loader.load('/fonts/ArtificBlack.typeface.json', (loadedFont) => {
    font = loadedFont;
    const textMaterials = [
      new THREE.MeshStandardMaterial({ color: 0xffffff }),
      new THREE.MeshStandardMaterial({ color: 0x000000 })
    ];

    const textSize = Math.max(4, Math.min(12, window.innerWidth / 100));

    // Create individual letter meshes for B, E, Y
const letters = ['B', 'E', 'Y'];
const spacing = textSize * 0.9;
textMeshBEY = new THREE.Group();
letters.forEach((char, i) => {
  const geo = new TextGeometry(char, { font, size: textSize, height: 2, curveSegments: 12 });
  geo.computeBoundingBox();
  const bbox = geo.boundingBox;
  geo.translate(
    -0.5 * (bbox.max.x + bbox.min.x),
    -0.5 * (bbox.max.y + bbox.min.y),
    -bbox.min.z
  );
  const mesh = new THREE.Mesh(geo, textMaterials);
  mesh.rotation.x = -Math.PI / 2;
  mesh.scale.z = 0.01;
  mesh.castShadow = true;
  mesh.position.x = i * spacing;
  textMeshBEY.add(mesh);
});
holders.BEY.add(textMeshBEY);
    holders.BEY.position.set(-10 * scaleFactor, -20, 10);
    holders.BEY.rotation.y = Math.PI / 2;

    const geoD = new TextGeometry('D', { font, size: textSize, height: 2, curveSegments: 12 });
    geoD.computeBoundingBox();
    const bboxD = geoD.boundingBox;
    geoD.translate(
      -0.5 * (bboxD.max.x + bboxD.min.x),
      -0.5 * (bboxD.max.y + bboxD.min.y),
      -bboxD.min.z
    );
    textMeshD = new THREE.Mesh(geoD, textMaterials);
    textMeshD.rotation.x = -Math.PI / 2;
    textMeshD.scale.z = 0.01;
    textMeshD.castShadow = true;
    holders.D.add(textMeshD);
    holders.D.position.set(8 * scaleFactor, 20 * scaleFactor, 0);
    holders.D.rotation.set(-1.6, 0, 0);

    
    const geoN = new TextGeometry('N', { font, size: textSize, height: 2, curveSegments: 12 });
    geoN.computeBoundingBox();
    const bboxN = geoN.boundingBox;
    geoN.translate(
      -0.5 * (bboxN.max.x + bboxN.min.x),
      -0.5 * (bboxN.max.y + bboxN.min.y),
      -bboxN.min.z
    );
    textMeshN = new THREE.Mesh(geoN, textMaterials);
    textMeshN.rotation.x = -Math.PI / 2;
    textMeshN.scale.z = 0.01;
    textMeshN.castShadow = true;
    holders.N.add(textMeshN);
    holders.N.position.set(2, -baseSize * scaleFactor / 2 + 0.1, -9);
    holders.N.scale.set(scaleFactor, scaleFactor, scaleFactor);

onWindowResize();
    animate();
  });

  window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
  
  
  // Rebuild text with new size
  const textSize = Math.max(4, Math.min(12, window.innerWidth / 100));

  if (font && textMeshBEY) {
    const letters = ['B', 'E', 'Y'];
    const spacing = textSize * 0.9;
    textMeshBEY.clear();

    letters.forEach((char, i) => {
      const geo = new TextGeometry(char, { font, size: textSize, height: 2, curveSegments: 12 });
      geo.computeBoundingBox();
      const bbox = geo.boundingBox;
      geo.translate(
        -0.5 * (bbox.max.x + bbox.min.x),
        -0.5 * (bbox.max.y + bbox.min.y),
        -bbox.min.z
      );
      const textMaterials = [
        new THREE.MeshStandardMaterial({ color: 0xffffff }),
        new THREE.MeshStandardMaterial({ color: 0x000000 })
      ];
      const mesh = new THREE.Mesh(geo, textMaterials);
      mesh.rotation.x = -Math.PI / 2;
      mesh.scale.z = 0.01;
      mesh.castShadow = true;
      mesh.position.x = i * spacing;
      textMeshBEY.add(mesh);
    });
  }
if (font && textMeshD) {
    holders.D.clear();

    const geoD = new TextGeometry('D', {
      font,
      size: textSize,
      height: 2,
      curveSegments: 12
    });

    geoD.computeBoundingBox();
    const bboxD = geoD.boundingBox;
    geoD.translate(
      -0.5 * (bboxD.max.x + bboxD.min.x),
      -0.5 * (bboxD.max.y + bboxD.min.y),
      -bboxD.min.z
    );

    const textMaterials = [
      new THREE.MeshStandardMaterial({ color: 0xffffff }),
      new THREE.MeshStandardMaterial({ color: 0x000000 })
    ];

    textMeshD = new THREE.Mesh(geoD, textMaterials);
    textMeshD.rotation.x = -Math.PI / 2;
    textMeshD.scale.z = 0.01;
    textMeshD.castShadow = true;

    holders.D.add(textMeshD);
  }
  const aspect = window.innerWidth / window.innerHeight;
  viewSize = Math.max(20, Math.min(40, window.innerHeight / 20));
  const width = viewSize * aspect;

  camera.left = -width / 2;
  camera.right = width / 2;
  camera.top = viewSize / 2;
  camera.bottom = -viewSize / 2;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
  uniforms.u_resolution.value.set(window.innerWidth, window.innerHeight);

  scaleFactor = Math.max(window.innerWidth / window.innerHeight, 1);
  const boxSize = baseSize * scaleFactor;

  if (cube) {
    cube.geometry.dispose();
    cube.geometry = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
    cube.position.y = -boxSize / 2;
  }

  if (holders.BEY) {
    holders.BEY.position.set(-5 * scaleFactor, -5, 12);
    holders.BEY.rotation.y = Math.PI / 2;
  }
  
  if (holders.N && textMeshN) {
    holders.N.clear();
    const geoN = new TextGeometry('N', { font, size: textSize, height: 2, curveSegments: 12 });
    geoN.computeBoundingBox();
    const bboxN = geoN.boundingBox;
    geoN.translate(
      -0.5 * (bboxN.max.x + bboxN.min.x),
      -0.5 * (bboxN.max.y + bboxN.min.y),
      -bboxN.min.z
    );
    const textMaterials = [
      new THREE.MeshStandardMaterial({ color: 0xffffff }),
      new THREE.MeshStandardMaterial({ color: 0x000000 })
    ];
    textMeshN = new THREE.Mesh(geoN, textMaterials);
    textMeshN.rotation.x = -Math.PI / 2;
    textMeshN.scale.z = 0.01;
    textMeshN.castShadow = true;
    holders.N.add(textMeshN);
    textMeshN.rotation.x = -Math.PI / 2; // keep it flat
    textMeshN.rotation.z = -Math.PI / 2; // keep it flat
  
    holders.N.position.set(2, -baseSize * scaleFactor / 2 + 0.1, -9);
    holders.N.scale.set(scaleFactor, scaleFactor, scaleFactor);
  }

  if (holders.D) {
    holders.D.position.set(8 * scaleFactor, 20 * scaleFactor, -10);
    holders.D.rotation.set(-1.6, 0, 0);
  }
}

function animate() {
  requestAnimationFrame(animate);
  uniforms.u_time.value = performance.now() / 1000;

  const scrollY = window.scrollY;
  const maxScroll = document.body.scrollHeight - window.innerHeight;
  const scrollProgress = THREE.MathUtils.clamp(scrollY / maxScroll, 0, 1);
  uniforms.u_scroll.value = scrollProgress;

  const visibleLines = scrollProgress * lineCount * 6.0;
for (let i = 0; i < lineCount; i++) {
  const target = THREE.MathUtils.clamp(visibleLines - i, 0, 1);
  const mat = lines[i].material;
  mat.uniforms.uTime.value = performance.now() / 1000;

  mat.uniforms.uAlpha.value += (target - mat.uniforms.uAlpha.value) * 0.1;
  lines[i].visible = mat.uniforms.uAlpha.value > 0.01;
}



  if (textMeshBEY) {
    const easeOut = t => 1 - Math.pow(1 - t, 3);
    const easedScroll = easeOut(scrollProgress);
    const step = 0.2;
    const growthSpeed = 0.3;

    textMeshBEY.children.forEach((child, index) => {
      const progress = THREE.MathUtils.clamp((easedScroll - index * step) / step, 0, 1);
      const eased = easeOut(progress);
      const targetZ = 0.01 + eased * growthSpeed;
      child.scale.z += (targetZ - child.scale.z) * 0.1; // 0.1 = smoothing factor (lower = smoother)

    });
  }

  if (textMeshD) {
    const easeOut = t => 1 - Math.pow(1 - t, 3);
    const easedScroll = easeOut(scrollProgress);
    const dStep = 0.4;
    const dGrowth = 0.25;
    const dProgress = THREE.MathUtils.clamp(easedScroll / dStep, 0, 1);
    const dEased = easeOut(dProgress);
    const targetD = -0.01 - dEased * dGrowth;
    textMeshD.scale.z += (targetD - textMeshD.scale.z) * 0.1;

  }

  renderer.render(scene, camera);
}
