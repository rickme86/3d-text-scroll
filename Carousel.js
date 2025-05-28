import * as THREE from "three";

function createParallaxMaterial(foregroundUrl, backgroundUrl, depthMapUrl, backgroundDepthUrl) {
  const loader = new THREE.TextureLoader();

  const foreground = loader.load(foregroundUrl);
  const background = loader.load(backgroundUrl);
  const depthMap = loader.load(depthMapUrl);
  const backgroundDepthMap = backgroundDepthUrl ? loader.load(backgroundDepthUrl) : depthMap;

  depthMap.encoding = THREE.LinearEncoding;
  depthMap.minFilter = THREE.LinearFilter;
  depthMap.magFilter = THREE.LinearFilter;
  depthMap.wrapS = THREE.ClampToEdgeWrapping;
  depthMap.wrapT = THREE.ClampToEdgeWrapping;

  backgroundDepthMap.encoding = THREE.LinearEncoding;
  backgroundDepthMap.minFilter = THREE.LinearFilter;
  backgroundDepthMap.magFilter = THREE.LinearFilter;
  backgroundDepthMap.wrapS = THREE.ClampToEdgeWrapping;
  backgroundDepthMap.wrapT = THREE.ClampToEdgeWrapping;

  const uniforms = {
    foreground: { value: foreground },
    background: { value: background },
    depthMap: { value: depthMap },
    backgroundDepthMap: { value: backgroundDepthMap },
    parallaxStrength: { value: window.innerWidth < 600 ? 0.5 : 0.03 },
    mouseX: { value: 0.5 },
    mouseY: { value: 0.5 },
    grayscale: { value: 0.0 },
    bulgeFactor: { value: 0.0 }, // new

  };

  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    uniform sampler2D foreground;
    uniform sampler2D background;
    uniform sampler2D depthMap;
    uniform float parallaxStrength;
    uniform float mouseX;
    uniform float mouseY;
    uniform float grayscale;
    uniform float bulgeFactor; 
    
    
    varying vec2 vUv;

    void main() {
      float depth = texture2D(depthMap, vUv).r;
     float depthFactor = pow(1.0 - depth, 2.0); // Adjust exponent for more or less depth exaggeration
      float offsetX = -(mouseX - 0.5) * 2.0 * parallaxStrength * depthFactor;
      float offsetY = (mouseY - 0.5) * 2.0 * parallaxStrength * depthFactor;


      vec2 displacedUv = clamp(vUv + vec2(offsetX, offsetY), 0.0, 1.0);





      vec4 bgColor = texture2D(background, displacedUv);
      vec4 fgColor = texture2D(foreground, vUv);

      float mask = step(0.6, depth);
      vec4 mixed = mix(bgColor, fgColor, mask);

      float gray = dot(mixed.rgb, vec3(0.299, 0.587, 0.114));
      vec3 finalColor = mix(vec3(gray), mixed.rgb, 1.0 - grayscale);

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `;

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
  });

  material.userData.shader = material;
  return material;
}

function createGrayscaleMaterial(imageUrl) {
  const loader = new THREE.TextureLoader();
  const texture = loader.load(imageUrl);

  const uniforms = {
    map: { value: texture },
    grayscale: { value: 0.0 },
  };

  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
    }
  `;

  const fragmentShader = `
    uniform sampler2D map;
    uniform float grayscale;
    varying vec2 vUv;
    void main() {
      vec4 color = texture2D(map, vUv);
      float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      gl_FragColor = vec4(mix(vec3(gray), color.rgb, 1.0 - grayscale), color.a);
    }
  `;

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
  });

  material.userData.shader = material;
  return material;
}

function curveGeometry(geometry, radius = 40) {
  const pos = geometry.attributes.position;
  const vec = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    vec.fromBufferAttribute(pos, i);
    vec.y = 0;
    const angle = vec.x / radius;
    const z = -Math.cos(angle) * radius + radius * 0.9;
    const x = Math.sin(angle) * radius;
    pos.setX(i, x);
    pos.setZ(i, z);
  }

  geometry.computeVertexNormals();
  geometry.attributes.position.needsUpdate = true;
}

export function createCarouselMediaGroup({
  imageUrls = [],
  backgroundUrls = [],
  depthMapUrls = [],
  backgroundDepthUrls = [],
  videoUrls = [],
  radius = 65,
  itemSize
}) {
  const group = new THREE.Group();
  
    const screenWidth = window.innerWidth;
  if (screenWidth < 600) {
    group.position.z = 3.0; // Mobile
  } else if (screenWidth < 1000) {
    group.position.z = 5.5; // Tablet
  } else {
    group.position.z = 8; // Desktop
  }


  const baseItems = imageUrls.map((url, i) => ({
    type: 'image',
    imageUrl: url,
    bgUrl: backgroundUrls[i],
    depthUrl: depthMapUrls[i],
    backgroundDepthUrl: backgroundDepthUrls[i],
    index: i
  }))
  .concat(videoUrls.map((url) => ({
    type: 'video',
    url
  })));

  const items = [...baseItems, ...baseItems, ...baseItems];
  const total = items.length;

  const angleStep = (2 * Math.PI) / total;
  const arcLength = radius * angleStep * 1.1;

  itemSize = {
    width: arcLength,
    height: (arcLength / 16) * 9
  };

  const createImageMesh = ({ imageUrl, bgUrl, depthUrl, backgroundDepthUrl }) => {
    let material;
    if (depthUrl && bgUrl) {
      material = createParallaxMaterial(imageUrl, bgUrl, depthUrl, backgroundDepthUrl);
    } else {
      material = createGrayscaleMaterial(imageUrl);
    }

    const segments = window.innerWidth < 600 ? 16 : window.innerWidth < 1000 ? 32 : 64;
    const geometry = new THREE.PlaneGeometry(itemSize.width, itemSize.height, segments, segments);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.uniforms = material.uniforms;

    curveGeometry(mesh.geometry, radius);

    return mesh;
  };

  const createVideoMesh = (url) => {
    const video = document.createElement("video");
    video.src = url;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;

    const texture = new THREE.VideoTexture(video);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.format = THREE.RGBFormat;

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide,
      transparent: true
    });

    const segments = window.innerWidth < 600 ? 16 : window.innerWidth < 1000 ? 32 : 64;
    const geometry = new THREE.PlaneGeometry(itemSize.width, itemSize.height, segments, segments);
    curveGeometry(geometry, radius);
    const mesh = new THREE.Mesh(geometry, material);

    mesh.userData.video = video;

    video.addEventListener("canplay", () => {
      video.play();
    });

    video.load();

    return mesh;
  };

  for (let i = 0; i < total; i++) {
    const angle = -Math.PI / 2 + i * angleStep;
    const normalizedAngle = ((angle % (Math.PI * 2)) + (Math.PI * 2)) % (Math.PI * 2);

    const item = items[i];
    let mesh;

    if (item.type === 'video') {
      mesh = createVideoMesh(item.url);
    } else {
      mesh = createImageMesh(item);
    }

    mesh.position.set(
      Math.sin(angle) * radius,
      0,
      Math.cos(angle) * radius
    );

    mesh.userData.originalAngle = normalizedAngle;
    mesh.lookAt(0, 0, 0);
    group.add(mesh);
  }

  return group;
}
