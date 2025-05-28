import * as THREE from "three";

export function createDepthShaderMaterial(imageUrl, depthMapUrl) {
  const loader = new THREE.TextureLoader();

  const texture = loader.load(imageUrl);
  const depthMap = loader.load(depthMapUrl);

  depthMap.minFilter = THREE.LinearFilter;
  depthMap.magFilter = THREE.LinearFilter;
  depthMap.format = THREE.LuminanceFormat;

  const uniforms = {
    map: { value: texture },
    depthMap: { value: depthMap },
    offsetAmount: { value: 0.05 },
    mouseX: { value: 0.0 },
    mouseY: { value: 0.0 },  // Added vertical parallax uniform
    grayscale: { value: 0.0 },
    uvOffsetX: { value: 0.0 },
    uvScaleX: { value: 1.0 },
  };

  const vertexShader = `
    uniform sampler2D depthMap;
    uniform float offsetAmount;
    uniform float mouseX;
    uniform float mouseY;

    varying vec2 vUv;

    void main() {
      vUv = uv;

      float depth = texture2D(depthMap, uv).r;
      float depthValue = depth * 2.0 - 1.0;
      float dispMagnitude = pow(abs(depthValue), 1.5) * offsetAmount;
      float displacement = dispMagnitude * sign(depthValue);

      vec3 displacedPosition = position + normal * displacement;

      // Parallax offsets on X and Y axes
      displacedPosition.x += mouseX * 0.3 * displacement;
      displacedPosition.y += mouseY * 0.3 * displacement;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
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

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
  });
}
