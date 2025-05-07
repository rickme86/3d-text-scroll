import * as THREE from 'three';

export function createShaderWall(uniforms) {
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
// Your full animated fragment shader
precision highp float;
uniform float u_time;
uniform float u_scroll;
varying vec2 vUv;

float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

float starField(vec2 uv, float density, float brightness) {
  vec2 grid = floor(uv * density);
  vec2 jitter = fract(uv * density);
  float rnd = random(grid);
  float d = distance(jitter, vec2(0.5));
  float baseStar = 1.0 - smoothstep(0.0, 0.1, d);
  baseStar *= step(1.0 - brightness, rnd);
  float twinkle = sin(u_time * 5.0 + rnd * 50.0) * 0.5 + 0.5;
  return baseStar * twinkle;
}

void main() {
  vec2 uv = vUv;
  float scrollWarp = u_scroll * 0.2;
  uv += vec2(
    sin(uv.y * 10.0 + u_time * 0.5) * scrollWarp,
    cos(uv.x * 10.0 + u_time * 0.4) * scrollWarp
  );

  vec2 parallaxUV = uv + vec2(
    sin(u_time * 0.1) * 0.01,
    cos(u_time * 0.15) * 0.01
  );

  float wave1 = sin((uv.x + uv.y + u_time * 0.05) * (5.0 + u_scroll * 10.0));
  float wave2 = cos((uv.x - uv.y + u_time * 0.1) * (4.0 + u_scroll * 6.0));
  float combined = (wave1 + wave2) * 0.5;
  float g = smoothstep(0.0, 1.0, uv.x + uv.y + combined * 0.1 - 0.4);

  vec3 pink = vec3(1.0, 0.7, 0.8);
  vec3 orange = vec3(1.0, 0.6, 0.1);
  vec3 navy = vec3(0.1, 0.2, 0.4);
  vec3 aqua = vec3(0.4, 0.8, 0.9);
  vec3 color = mix(pink, orange, smoothstep(0.0, 0.33, g));
  color = mix(color, navy, smoothstep(0.3, 0.66, g));
  color = mix(color, aqua, smoothstep(0.65, 1.0, g));

  vec2 origin = vec2(0.0, 1.0); // Top-left
  float dist = distance(vUv, origin);
  float radius = u_scroll * 1.5 + sin(u_time * 2.0) * 0.05;
  float mask = 1.0 - smoothstep(radius - 0.1, radius + 0.2, dist);

  float stars = starField(parallaxUV * 50.0, 40.0, 0.999);
  vec3 bgColor = mix(vec3(0.0), vec3(1.0), stars);
  vec3 finalColor = mix(bgColor, color, mask);

  float grain = random(uv * u_time * 0.5) * 0.05;
  finalColor += grain;
  float vignette = smoothstep(0.9, 0.5, distance(vUv, vec2(0.5)));
  finalColor *= vignette;

  gl_FragColor = vec4(finalColor, 1.0);
}
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
  });

  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(50, 50),
    shaderMaterial
  );
wall.position.set(0, 10, -25); // Adjust height (Y) and depth (Z)
wall.rotation.set(0, 0, 0); // Make it vertical, facing forward



  return wall;
}
