import * as THREE from "three";
import { createCarouselMediaGroup } from "./Carousel.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { FisheyeShader } from "./fisheyeShader.js";
import { VerticalRippleShader } from "./VerticalRippleShader";

let scene, camera, renderer, composer;
let carousel;
let ripplePass;
let carouselItems = [];
let mouseXNorm = 0;
let mouseYNorm = 0;
const maxMouseOffset = 0.07;

let currentRotation = 0;
let targetRotation = 0;
let isDragging = false;
let lastDragX = 0;
let dragOffsetX = 0;
let dragOffsetY = 0;
let isSnapping = false;
let disableMouseTilt = false;

let dragVelocity = 0;
let bestMatch = null;
let bestScore = -Infinity;
let lastDragTime = 0;
let lastFocusedItem = null;
let lastDragDirection = 0; // -1 = right to left, 1 = left to right
let isHoveringFocusedItem = false;

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;

init();

function getFisheyeStrengthForScreen() {
  const width = window.innerWidth;
  if (width < 600) return 0.02;
  if (width < 900) return 0.05;
  return 0.1;
}

function getResponsiveCarouselSettings() {
  const width = window.innerWidth;
  const baseRadius = 10;
  const scale = width < 600 ? 0.6 : width < 1000 ? 0.8 : 1;
  return {
    radius: baseRadius * scale,
    itemSize: {
      width: 60 * scale,
      height: 34 * scale
    }
  };
}

function snapToNearestItem() {
  const TWO_PI = Math.PI * 2;
  const rotation = targetRotation;

  let nearestAngle = carouselItems[0].userData.originalAngle;
  let minDistance = Infinity;

  carouselItems.forEach((item) => {
    const baseAngle = item.userData.originalAngle;
    const rotationsAway = Math.round((rotation - baseAngle) / TWO_PI);
    const candidateAngle = baseAngle + rotationsAway * TWO_PI;
    const dist = Math.abs(rotation - candidateAngle);
    if (dist < minDistance) {
      minDistance = dist;
      nearestAngle = candidateAngle;
    }
  });

  animateSnap(targetRotation, nearestAngle, 0.6);
}

function animateSnap(start, end, duration = 0.6, onComplete) {
  let startTime = null;
  isSnapping = true;
  disableMouseTilt = true;

  function step(timestamp) {
    if (!startTime) startTime = timestamp;
    const elapsed = (timestamp - startTime) / 1000;
    const t = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);

    targetRotation = start + (end - start) * eased;

    if (!isDragging) {
      currentRotation += (targetRotation - currentRotation) * 0.15;
      carousel.rotation.y = currentRotation;
    }

    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      targetRotation = end;
      currentRotation = end;
      carousel.rotation.y = currentRotation;
      isSnapping = false;
      disableMouseTilt = false;
      if (onComplete) onComplete();
    }
  }

  requestAnimationFrame(step);
}

function applyMomentumAndSnap() {
  const friction = 0.9;
  const velocityThreshold = 0.0003;

  isSnapping = true;
  disableMouseTilt = true;

  function momentumStep() {
    if (Math.abs(dragVelocity) > velocityThreshold && !isDragging) {
      const maxRotationPerFrame = 0.03;
      if (dragVelocity > maxRotationPerFrame) dragVelocity = maxRotationPerFrame;
      if (dragVelocity < -maxRotationPerFrame) dragVelocity = -maxRotationPerFrame;

      targetRotation += dragVelocity;
      dragVelocity *= friction;
      requestAnimationFrame(momentumStep);
    } else {
      snapToNearestItem();
      disableMouseTilt = false;
      isSnapping = false;
    }
  }

  momentumStep();
}

function smoothDeadZone(value, deadZone) {
  if (Math.abs(value) <= deadZone) return 0;
  const sign = Math.sign(value);
  return ((Math.abs(value) - deadZone) / (1 - deadZone)) * sign;
}

function animateParallaxSweep(uniforms, direction = 1, duration = 600) {
  const startTime = performance.now();
  const fromX = direction > 0 ? 0.1 : 0.9;
  const toX = direction > 0 ? 0.9 : 0.1;

  const originalStrength = uniforms.parallaxStrength?.value ?? 0.03;
  if (uniforms.parallaxStrength) {
    animateUniform(uniforms.parallaxStrength, 0.12, duration / 2); // Boost
    setTimeout(() => {
      animateUniform(uniforms.parallaxStrength, originalStrength, duration / 2); // Restore
    }, duration / 2);
  }

  function update() {
    const elapsed = performance.now() - startTime;
    const t = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);

    uniforms.mouseX.value = THREE.MathUtils.lerp(fromX, toX, eased);

    if (t < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}

function animateUniform(uniform, toValue, duration = 300) {
  const fromValue = uniform.value;
  const startTime = performance.now();

  function update() {
    const elapsed = performance.now() - startTime;
    const t = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    uniform.value = fromValue + (toValue - fromValue) * eased;

    if (t < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}

function springToUniform(uniform, target, stiffness = 0.2, damping = 0.7) {
  if (!uniform.spring) {
    uniform.spring = { velocity: 0 };
  }

  const delta = target - uniform.value;
  uniform.spring.velocity = uniform.spring.velocity * damping + delta * stiffness;
  uniform.value += uniform.spring.velocity;
}

function init() {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(100, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 0);
  camera.lookAt(new THREE.Vector3(0, 0, -1));

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  ripplePass = new ShaderPass(VerticalRippleShader);
  ripplePass.uniforms.segmentWidth.value = 0.05;
  ripplePass.uniforms.edgeSize.value = 0.15;
  ripplePass.uniforms.time.value = 0;
  ripplePass.uniforms.mouseX = { value: 0 };
  ripplePass.renderToScreen = false;
  composer.addPass(ripplePass);

  const fisheyePass = new ShaderPass(FisheyeShader);
  fisheyePass.uniforms.aspect.value = window.innerWidth / window.innerHeight;
  fisheyePass.uniforms.strength.value = getFisheyeStrengthForScreen();
  fisheyePass.renderToScreen = true;
  composer.addPass(fisheyePass);

  scene.add(new THREE.AmbientLight(0xffffff, 1));

  const { radius, itemSize } = getResponsiveCarouselSettings();

  carousel = createCarouselMediaGroup({
    imageUrls: ["/media/image1.jpg", "/media/image2.jpg", "/media/image3.jpg", "/media/image4.jpg"],
    backgroundUrls: ["/media/image1_bg.png", "/media/image2_bg.png", "/media/image3_bg.png", "/media/image4.jpg"],
    depthMapUrls: [
      "/media/image1_depth.png",
      "/media/image2_depth.png",
      "/media/image3_depth.png",
      "/media/image4_depth.png"
    ],
    backgroundDepthUrls: [
      "/media/image1_bgdepth.png",
      "/media/image2_bgdepth.png", // ✅ your new map goes here
      "/media/image3_bgdepth.png",
      "/media/image4_depth.png"
    ],
    videoUrls: [],
    itemSize,
    radius
  });

  carousel.children.forEach((child) => {
    const pos = new THREE.Vector3();
    child.getWorldPosition(pos);
    carousel.worldToLocal(pos);
    const angle = Math.atan2(pos.x, pos.z);
    child.userData.originalAngle = (angle + Math.PI * 2) % (Math.PI * 2);

    if (child.material) {
      child.material.userData.shader = child.material;
      if (!child.material.uniforms) child.material.uniforms = {};
      if (!child.material.uniforms.grayscale) child.material.uniforms.grayscale = { value: 1 };
    }
  });
  
  if (isTouchDevice) {
  carouselItems.forEach(mesh => {
    const uniforms = mesh.userData?.uniforms;
    if (uniforms?.parallaxStrength) {
      uniforms.parallaxStrength.value = 5.0; // or higher (e.g., 0.08)
    }
  });
}

  
  scene.add(carousel);
  carouselItems = [...carousel.children];

  window.addEventListener("resize", onWindowResize);

  window.addEventListener("mousemove", (e) => {
    mouseXNorm = (e.clientX / window.innerWidth) * 2 - 1;
    mouseYNorm = -(e.clientY / window.innerHeight) * 2 + 1;
    if (ripplePass) ripplePass.uniforms.mouseX.value = (mouseXNorm + 1) / 2;

    mouse.set(mouseXNorm, mouseYNorm);
    raycaster.setFromCamera(mouse, camera);

    if (bestMatch) {
      const intersects = raycaster.intersectObject(bestMatch, true);
      isHoveringFocusedItem = intersects.length > 0;

      // Set grab cursor when hovering focused item and not dragging
      if (isDragging) {
        document.body.style.cursor = "grabbing";
      } else if (isHoveringFocusedItem) {
        document.body.style.cursor = "grab";
      } else {
        document.body.style.cursor = "default";
      }
    } else {
      isHoveringFocusedItem = false;
      document.body.style.cursor = isDragging ? "grabbing" : "default";
    }
  });

  document.addEventListener("mousedown", (e) => {
    isDragging = true;
    lastDragX = e.clientX;
    dragVelocity = 0;
    lastDragTime = performance.now();

    if (isHoveringFocusedItem) {
      document.body.style.cursor = "grabbing";
    }

    carouselItems.forEach((mesh) => {
      const uniforms = mesh.userData?.uniforms;
      if (uniforms?.parallaxStrength) {
        animateUniform(uniforms.parallaxStrength, 0.06, 150);
      }
    });
  });

  document.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      applyMomentumAndSnap();
      document.body.style.cursor = isHoveringFocusedItem ? "grab" : "default";

      dragOffsetX = 0;
      dragOffsetY = 0;

      // Delay to ensure bestMatch has updated
      setTimeout(() => {
        if (bestMatch?.userData?.uniforms?.parallaxStrength) {
          animateUniform(bestMatch.userData.uniforms.parallaxStrength, 0.06, 300);
        }
      }, 20); // ~1 frame delay
    }
  });

  document.addEventListener("mousemove", (e) => {
    if (isDragging && !isSnapping) {
      const now = performance.now();
      const deltaX = e.clientX - lastDragX;
      lastDragDirection = Math.sign(deltaX);
      const deltaTime = now - lastDragTime || 16;

      dragVelocity = (deltaX / deltaTime) * 0.15;
      dragVelocity = Math.max(Math.min(dragVelocity, 0.02), -0.02);
      dragOffsetX = deltaX / 100;
      dragOffsetY = (e.movementY || 0) / 100;

      targetRotation += deltaX * 0.005;

      lastDragX = e.clientX;
      lastDragTime = now;
    }
  });

  window.addEventListener("mouseleave", () => {
    isHoveringFocusedItem = false;
    document.body.style.cursor = "default";
  });

  // TOUCH START
  document.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    isDragging = true;
    lastDragX = e.touches[0].clientX;
    dragVelocity = 0;
    lastDragTime = performance.now();

    if (isHoveringFocusedItem) {
      document.body.style.cursor = "grabbing";
    }

   if (!isTouchDevice) {
    const targetStrength = isTouchDevice ? 1.2 : 0.06;
  carouselItems.forEach((mesh) => {
    const uniforms = mesh.userData?.uniforms;
    if (uniforms?.parallaxStrength) {
      animateUniform(uniforms.parallaxStrength, 0.06, 150);
    }
  });
}

  });

  // TOUCH MOVE
  document.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault(); // prevent page from scrolling while dragging

      if (!isDragging || isSnapping || e.touches.length !== 1) return;

      const now = performance.now();
      const currentX = e.touches[0].clientX;
      const deltaX = currentX - lastDragX;
      lastDragDirection = Math.sign(deltaX);
      const deltaTime = now - lastDragTime || 16;

      dragVelocity = (deltaX / deltaTime) * 0.15;
      dragVelocity = Math.max(Math.min(dragVelocity, 0.02), -0.02);
      dragOffsetX = deltaX / 100;
      dragOffsetY = 0;

      targetRotation += deltaX * 0.005;
      lastDragX = currentX;
      lastDragTime = now;

      if (ripplePass) {
        ripplePass.uniforms.mouseX.value = e.touches[0].clientX / window.innerWidth;
      }
    },
    { passive: false }
  );

  // TOUCH END
  document.addEventListener("touchend", () => {
    if (isDragging) {
      isDragging = false;
      applyMomentumAndSnap();
      document.body.style.cursor = isHoveringFocusedItem ? "grab" : "default";

      dragOffsetX = 0;
      dragOffsetY = 0;

      setTimeout(() => {
        if (bestMatch?.userData?.uniforms?.parallaxStrength) {
    animateUniform(bestMatch.userData.uniforms.parallaxStrength, isTouchDevice ? 0.1 : 0.06, 300);
}

      }, 20);
    }
  });

  window.addEventListener("touchmove", (e) => {
    if (e.touches.length > 0 && !isDragging) {
      const touch = e.touches[0];
      const x = touch.clientX / window.innerWidth;
      const y = touch.clientY / window.innerHeight;

      mouseXNorm = x * 2 - 1;
      mouseYNorm = y * 2 - 1;
    }
  });

  animate();
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);

  // Update carousel Z position responsively
  if (carousel) {
    const screenWidth = window.innerWidth;
    if (screenWidth < 600) {
      carousel.position.z = 3;
    } else if (screenWidth < 1000) {
      carousel.position.z = 5.0;
    } else {
      carousel.position.z = 8;
    }
  }
}

function animate() {
  requestAnimationFrame(animate);

  currentRotation += (targetRotation - currentRotation) * 0.15;

  // Conditional tilt
  let tiltOffset = 0;
  if (!isHoveringFocusedItem && !disableMouseTilt) {
    const smoothedMouseX = smoothDeadZone(mouseXNorm, 0.1); // deadZone was missing here
    tiltOffset = smoothedMouseX * maxMouseOffset;
  }
  carousel.rotation.y = currentRotation + tiltOffset;

if (bestMatch?.userData?.uniforms) {
  const uniforms = bestMatch.userData.uniforms;

  if ("mouseX" in uniforms && "mouseY" in uniforms) {
    if (isTouchDevice && !isDragging) {
      // Force exaggerated parallax on touch devices when idle
      uniforms.mouseX.value = 1.2;
      uniforms.mouseY.value = -0.2;
    } else {
      const baseX = (mouseXNorm + 1) / 2;
      const baseY = (mouseYNorm + 1) / 2;

      if (isDragging) {
        uniforms.mouseX.value = THREE.MathUtils.clamp(baseX + dragOffsetX, 0, 1);
        uniforms.mouseY.value = THREE.MathUtils.clamp(baseY + dragOffsetY, 0, 1);
      } else {
        uniforms.mouseX.value = baseX;
        uniforms.mouseY.value = baseY;
      }
    }
  }
}


  // Determine focused item
  const cameraDirection = new THREE.Vector3();
  camera.getWorldDirection(cameraDirection);
  cameraDirection.y = 0;
  cameraDirection.normalize();

  bestMatch = null;
  bestScore = -Infinity;

  carouselItems.forEach((mesh) => {
    const itemDirection = new THREE.Vector3();
    mesh.getWorldPosition(itemDirection);
    itemDirection.sub(camera.position).setY(0).normalize();
    const dot = cameraDirection.dot(itemDirection);
    if (dot > bestScore) {
      bestScore = dot;
      bestMatch = mesh;
    }
  });

  // Detect newly focused item
  if (bestMatch && bestMatch !== lastFocusedItem) {
    const uniforms = bestMatch.userData?.uniforms;
    if (uniforms?.mouseX && uniforms?.mouseY) {
      animateParallaxSweep(uniforms, lastDragDirection || 1); // Fallback to left→right
    }

    lastFocusedItem = bestMatch;
  }

  // Set grayscale based on focus
  carouselItems.forEach((mesh) => {
    const shader = mesh.material.userData.shader || mesh.material;
    const isFocused = mesh === bestMatch;

    if (shader && shader.uniforms?.grayscale !== undefined) {
      shader.uniforms.grayscale.value = isFocused ? 0.0 : 1.0;
    }
  });

  if (isTouchDevice && !isDragging && bestMatch?.userData?.uniforms) {
    const uniforms = bestMatch.userData.uniforms;
    const t = performance.now() * 0.001;
    uniforms.mouseX.value = 0.5 + 0.05 * Math.sin(t);
    uniforms.mouseY.value = 0.5 + 0.05 * Math.cos(t * 0.8);
  }

  composer.render();
}
