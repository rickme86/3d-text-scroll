// GlassEdgePanelMaterial.js (blur-enhanced glasmorphism)
import * as THREE from 'three';

export function createGlassPanelMaterial(texture, blurStrength = 1.5) {
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: texture },
      time: { value: 0.0 },
      resolution: { value: new THREE.Vector2(1.0, 1.0) },
      blurAmount: { value: blurStrength },
      opacity: { value: 0.5 }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
fragmentShader: `
  uniform sampler2D map;
  uniform float time;
  uniform float blurAmount;
  uniform float opacity;
  uniform vec2 resolution;
  varying vec2 vUv;

  vec3 desaturate(vec3 color, float amount) {
    float gray = dot(color, vec3(0.299, 0.587, 0.114));
    return mix(color, vec3(gray), amount);
  }

  void main() {
    vec4 sum = vec4(0.0);
    float blur = blurAmount / resolution.x;

    vec2 offsets[9];
    offsets[0] = vec2(-blur, -blur);
    offsets[1] = vec2( blur, -blur);
    offsets[2] = vec2(-blur,  blur);
    offsets[3] = vec2( blur,  blur);
    offsets[4] = vec2(-blur, 0.0);
    offsets[5] = vec2( blur, 0.0);
    offsets[6] = vec2(0.0, -blur);
    offsets[7] = vec2(0.0,  blur);
    offsets[8] = vec2(0.0, 0.0);

    float weights[9];
    weights[0] = weights[1] = weights[2] = weights[3] = 0.05;
    weights[4] = weights[5] = weights[6] = weights[7] = 0.1;
    weights[8] = 0.4;

    for (int i = 0; i < 9; i++) {
      vec4 tex = texture2D(map, vUv + offsets[i]);
      sum += tex * weights[i];
    }

    vec3 blurred = desaturate(sum.rgb, 0.15);

    // Pulsating bright tint
    vec3 brightTint = vec3(
      1.15 + 0.02 * sin(time * 2.0),
      1.15 + 0.015 * cos(time * 1.5),
      1.2
    );

    gl_FragColor = vec4(blurred * brightTint, opacity);
  }
`,

    transparent: true,
    side: THREE.DoubleSide
  });
}
