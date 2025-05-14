import * as THREE from 'three';

export function createTextWall(textSize = 8) {
  const canvas = document.createElement('canvas');
  
  canvas.width = 1024;
  canvas.height = 2048;

  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Fonts and styles
  const styles = [
    'normal 40px Helvetica',
    'bold 50px Helvetica',
    'italic 40px Helvetica',
    '900 60px Helvetica',
    'lighter 35px Helvetica',
    'bold italic 45px Helvetica',
  ];

  const lineHeight = 100;
  let y = 80;

  for (let i = 0; i < 20; i++) {
    const style = styles[i % styles.length];
    ctx.font = style;
    ctx.fillStyle = '#fff';
    ctx.fillText('THE SCREEN', 50, y);
    y += lineHeight;
  }

  // Create texture from canvas
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  
  texture.center.set(0.5, 0.5);
texture.rotation = Math.PI;

  const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
  const geometry = new THREE.PlaneGeometry(50, 300);
  const wall = new THREE.Mesh(geometry, material);

  // Position to the right (you can tweak these)
 wall.rotation.set(-Math.PI / -1, 0, 0);  // lie flat on XZ plane, facing upward
wall.position.set(8, -textSize * 0.9, 7);



  return wall;
}
