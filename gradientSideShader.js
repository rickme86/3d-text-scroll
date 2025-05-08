
export const gradientShader = {
  vertexShader: `
    varying float vHeight;
    uniform float minY;
    uniform float maxY;

    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vHeight = (worldPosition.y - minY) / (maxY - minY); // normalized height 0–1
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `,

  fragmentShader: `
    precision mediump float;

    varying float vHeight;
    uniform float minY;
    uniform float maxY;

    float rand(vec2 co) {
      return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
    }

    void main() {
      float noise = rand(vec2(vHeight, 0.0)) * 0.05;
      float gradient = 1.0 - smoothstep(0.0, 0.3, vHeight);
      vec3 color = vec3(gradient * 0.1 + noise);
      gl_FragColor = vec4(color, 1.0);
    }
  `
};
