import * as THREE from 'three';

export function createLeftWall(uniforms) {
  const boxSize = 50;
  const lines = [];
  const group = new THREE.Group();
  const lineCount = 30;

  function createLines() {
    const x = 0;
    const zStart = -boxSize * 0.5;
    const zEnd = boxSize * 2;
    const lineSpacing = -boxSize * 0.03;
    const baseY = boxSize / 2 + 5;

    const vertexShader = `
      attribute float alpha;
      uniform vec2 uMouse;
      uniform float uTime;
      varying float vAlpha;

      void main() {
        vAlpha = alpha;
        float dist = distance(vec2(position.y, position.z), uMouse);
        float disp = 0.5 * sin(dist * 5.0 - uTime * 2.0) * exp(-dist * 3.0);
        vec3 displaced = position + vec3(disp, 0.0, 0.0);
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

    for (let i = 0; i < lineCount; i++) {
      const lineY = baseY + i * lineSpacing;

      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, lineY, zEnd),
        new THREE.Vector3(x, lineY, zStart)
      ]);

      const alphas = new Float32Array([1.0, 0.0]);
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
      group.add(line);
      lines.push(line);
    }

    window.addEventListener('mousemove', (event) => {
      const y = (event.clientY / window.innerHeight - 0.5) * boxSize * 2;
      const z = (event.clientX / window.innerWidth - 0.5) * boxSize * 2;
      lines.forEach(line => {
        line.material.uniforms.uMouse.value.set(y, z);
      });
    });
  }

createLines();

  group.userData.update = (time, scrollProgress) => {
    const screenWidth = window.innerWidth;
    const viewWidth = screenWidth / window.innerHeight * 20; // approximate camera width
    const wallOffset = viewWidth * 0.5;
    const isMobile = screenWidth < 768;
    group.position.x = -wallOffset + (isMobile ? 0 : -5);
    group.position.z = 0;
    group.position.y = 0;
   


    lines.forEach((line, i) => {
      const mat = line.material;
      mat.uniforms.uTime.value = time;
      const visibleLines = scrollProgress * lineCount * 6.0;
      const target = THREE.MathUtils.clamp(visibleLines - i, 0, 1);
      mat.uniforms.uAlpha.value += (target - mat.uniforms.uAlpha.value) * 0.1;
      line.visible = mat.uniforms.uAlpha.value > 0.01;
    });
  };

return group;


}
