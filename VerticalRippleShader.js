import * as THREE from 'three';

export const VerticalRippleShader = {
  uniforms: {
    tDiffuse: { value: null },
    segmentWidth: { value: 0.05 },
    edgeSize: { value: 0.15 },
    time: { value: 0 },
    mouseX: { value: 0 }  // New uniform for horizontal mouse position
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float segmentWidth;
    uniform float edgeSize;
    uniform float time;
    uniform float mouseX;
    varying vec2 vUv;

    void main() {
      float segments = 1.0 / segmentWidth;
      float segmentIndex = floor(vUv.x / segmentWidth);
      float segmentCenter = segmentIndex * segmentWidth + segmentWidth * 0.5;

      // Animate ripple with time and horizontal mouse position
      float ripple = sin(segmentCenter * 30.0 + time * 10.0 + mouseX * 10.0) * 0.06;

      vec2 distortedUV = vUv;
      distortedUV.x += ripple;

      vec4 original = texture2D(tDiffuse, vUv);
      vec4 distorted = texture2D(tDiffuse, distortedUV);

      float edgeL = smoothstep(edgeSize, 0.0, vUv.x);
      float edgeR = smoothstep(1.0 - edgeSize, 1.0, vUv.x);
      float edgeMask = edgeL + edgeR;

      gl_FragColor = mix(original, distorted, edgeMask);
    }
  `
};
