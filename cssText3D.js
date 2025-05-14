import { CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';

export function createCSS3DText(text, position, rotation = null) {
  const div = document.createElement('div');
  div.className = 'text-box';
  div.textContent = text;
  div.style.fontFamily = 'Helvetica';
  div.style.fontSize = '20px';
  div.style.fontWeight = 'bold';
  div.style.color = 'white';
  div.style.whiteSpace = 'nowrap';
  div.style.background = 'none';
  div.style.pointerEvents = 'none';

  const obj = new CSS3DObject(div);
  obj.position.copy(position);
  if (rotation) obj.rotation.copy(rotation);
  return obj;
}

export function createCSS3DTextWall(lines = 80, spacing = 32, position = new THREE.Vector3(), rotation = null) {
  const container = document.createElement('div');
  container.className = 'css3d-text-wall';

  // Prevent duplicate rendering by clearing existing content
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.lineHeight = `${spacing}px`;
  container.style.color = 'white';
  container.style.fontFamily = 'Helvetica';
  container.style.fontWeight = 'bold';
  container.style.fontSize = '8px';
  container.style.background = 'none';
  container.style.pointerEvents = 'none';
  container.style.width = '100%';
  container.style.height = 'auto'; 
  container.style.maxHeight = `${lines * spacing}px`;
  container.style.overflow = 'hidden';
  container.style.boxSizing = 'border-box';
  container.style.transformStyle = 'preserve-3d';
  container.style.border = '1px dashed red'; // Optional: for debugging

  const weights = ['100', '300', '400', '500', '700', '900'];
  const sizes = ['12px', '12px', '12px'];

  for (let i = 0; i < lines; i++) {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.flexWrap = 'nowrap';
    row.style.gap = '12px';
    row.style.overflow = 'hidden';
    row.style.whiteSpace = 'nowrap';

    Array.from({ length: 10 }).forEach(() => {
      const span = document.createElement('span');
      span.textContent = 'THE SCREEN';
      span.style.fontFamily = 'Helvetica';
      span.style.fontWeight = weights[Math.floor(Math.random() * weights.length)];
      span.style.fontSize = sizes[Math.floor(Math.random() * sizes.length)];
      span.style.marginRight = '8px';
      row.appendChild(span);
    });

    container.appendChild(row);
  }

  const containerWrapper = document.createElement('div');
  containerWrapper.appendChild(container);
  containerWrapper.style.backfaceVisibility = 'hidden';
  containerWrapper.style.transformStyle = 'preserve-3d';
  containerWrapper.style.zIndex = '0';

  const obj = new CSS3DObject(containerWrapper);
  obj.position.copy(position);
  if (rotation) obj.rotation.copy(rotation);
  return obj;
}