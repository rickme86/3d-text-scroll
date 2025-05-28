import * as THREE from 'three';

export const EdgeBlurShader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2(1, 1) },
    edgeSize: { value: 0.2 },
    blurAmount: { value: 0.02 }
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
    uniform vec2 resolution;
    uniform float edgeSize;
    uniform float blurAmount;
    varying vec2 vUv;

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);

      float edgeL = smoothstep(edgeSize, 0.0, vUv.x);
      float edgeR = smoothstep(1.0 - edgeSize, 1.0, vUv.x);
      float edgeMask = edgeL + edgeR;

      vec2 texel = vec2(1.0 / resolution.x, 0.0);

      vec4 blur = vec4(0.0);
      blur += texture2D(tDiffuse, vUv - 4.0 * texel * blurAmount);
      blur += texture2D(tDiffuse, vUv - 3.0 * texel * blurAmount);
      blur += texture2D(tDiffuse, vUv - 2.0 * texel * blurAmount);
      blur += texture2D(tDiffuse, vUv - 1.0 * texel * blurAmount);
      blur += texture2D(tDiffuse, vUv);
      blur += texture2D(tDiffuse, vUv + 1.0 * texel * blurAmount);
      blur += texture2D(tDiffuse, vUv + 2.0 * texel * blurAmount);
      blur += texture2D(tDiffuse, vUv + 3.0 * texel * blurAmount);
      blur += texture2D(tDiffuse, vUv + 4.0 * texel * blurAmount);
      blur /= 9.0;

      gl_FragColor = mix(color, blur, edgeMask);
    }
  `
};
