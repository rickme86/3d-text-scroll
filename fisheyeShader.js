export const FisheyeShader = {
  uniforms: {
    "tDiffuse": { value: null },
    "strength": { value: 0.1 },
    "height": { value: 1.0 },
    "aspect": { value: 1.0 },
     "time": { value: 0.0 },
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
uniform float time;
uniform float intensity;
varying vec2 vUv;

void main() {
  vec2 uv = vUv;

  // Wavy distortion just at the edges
  float edgeBand = smoothstep(0.0, 0.1, uv.x) + smoothstep(1.0, 0.9, uv.x);
  float wave = sin(uv.y * 40.0 + time * 5.0) * 0.01;

  // Apply horizontal distortion only in edge bands
  uv.x += wave * edgeBand * intensity;

  vec4 color = texture2D(tDiffuse, uv);
  gl_FragColor = color;
}

`



};
