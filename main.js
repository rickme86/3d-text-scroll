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
let preferredFormat = "png";
let lastDisplayedTitle = null;
let currentTiltOffset = 0;


 const projectMeta = [
  { title: "DECADE", category: "3D animation", link: "/projects/01" },
  { title: "RISE", category: "Experimental", link: "/projects/02" },
  { title: "ORBIT", category: "Concept Art", link: "/projects/03" },
  { title: "NOVA", category: "Game Design", link: "/projects/04" }
];

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
const textureLoader = new THREE.TextureLoader();

function setParallaxStrengthForAll(meshes, strength) {
  meshes.forEach(mesh => {
    const uniforms = mesh.userData?.uniforms;
    if (uniforms?.parallaxStrength) {
      uniforms.parallaxStrength.value = strength;
    }
  });
}

const FIXED_PARALLAX_STRENGTH = isTouchDevice ? 0.08 : 0.03;


init();

function preloadTextures({ imageUrl, bgUrl, depthUrl, backgroundDepthUrl }) {
  [imageUrl, bgUrl, depthUrl, backgroundDepthUrl].forEach(url => {
    if (url) textureLoader.load(url, () => {
      console.log("✅ Preloaded:", url);
    });
  });
}

function detectPreferredImageFormat() {
  const canvas = document.createElement("canvas");

  if (canvas.toDataURL("image/avif").indexOf("data:image/avif") === 0) {
    preferredFormat = "avif";
  } else if (canvas.toDataURL("image/webp").indexOf("data:image/webp") === 0) {
    preferredFormat = "webp";
  } else {
    preferredFormat = "png";
  }

  console.log(`🖼 Preferred image format: ${preferredFormat}`);
}

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


function getResponsiveImagePath(baseName, suffix = "") {
  const width = window.innerWidth;
  const res = width < 600 ? "480" : width < 1000 ? "768" : "1080";
  return `/media/${res}/${baseName}${suffix}_${res}.${preferredFormat}`;
}


function snapToNearestItem() {
  const TWO_PI = Math.PI * 2;
  const rotation = currentRotation;

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
    const eased = t * t * (3 - 2 * t); // smoothstep



    targetRotation = start + (end - start) * eased;

    if (!isDragging) {
      currentRotation += (targetRotation - currentRotation) * 0.3;
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
  const friction = 0.92;
  const minSpinDuration = 500; // Minimum spin time (ms)
  const velocityBoost = 0.008;
  const startTime = performance.now();

  isSnapping = true;
  disableMouseTilt = true;

  // Ensure visible motion even for small drags
  if (Math.abs(dragVelocity) < 0.002) {
    dragVelocity += lastDragDirection * velocityBoost;
  }

  function momentumStep() {
    const now = performance.now();
    const elapsed = now - startTime;

    // Drive actual rotation visually
    currentRotation += dragVelocity;
    carousel.rotation.y = currentRotation;

    // Decay velocity
    dragVelocity *= friction;

    const spinning = elapsed < minSpinDuration || Math.abs(dragVelocity) > 0.0005;

    if (spinning) {
      requestAnimationFrame(momentumStep);
    } else {
      snapToNearestItem(); // Based on currentRotation!
      isSnapping = false;
      disableMouseTilt = false;
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
    setParallaxStrengthForAll(carouselItems, FIXED_PARALLAX_STRENGTH);
 // Boost
    setTimeout(() => {
      setParallaxStrengthForAll(carouselItems, FIXED_PARALLAX_STRENGTH);
 // Restore
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

function animateScale(object, targetScale, duration = 200) {
  const start = object.scale.clone();
  const end = new THREE.Vector3(targetScale, targetScale, targetScale);
  const startTime = performance.now();

  function step() {
    const now = performance.now();
    const t = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    object.scale.lerpVectors(start, end, eased);
    if (t < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}


function init() {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(100, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 0);
  camera.lookAt(new THREE.Vector3(0, 0, -1));

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  const container = document.getElementById("carousel-container");
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);


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
  
  detectPreferredImageFormat();
  const imageBaseNames = ["image1", "image2", "image3", "image4"];

  const imageUrls = imageBaseNames.map(name => getResponsiveImagePath(name));
  const backgroundUrls = imageBaseNames.map(name => getResponsiveImagePath(name, "_bg"));
  const depthMapUrls = imageBaseNames.map(name => getResponsiveImagePath(name, "_fg_depth"));
  const backgroundDepthUrls = imageBaseNames.map(name => getResponsiveImagePath(name, "_bg_depth"));
  
  
  console.log("Image 2 paths:");
  console.log("Foreground:", getResponsiveImagePath("image2"));
  console.log("Background:", getResponsiveImagePath("image2", "_bg"));
  console.log("FG Depth:", getResponsiveImagePath("image2", "_fg_depth"));
  console.log("BG Depth:", getResponsiveImagePath("image2", "_bgdepth"));


  const { radius, itemSize } = getResponsiveCarouselSettings();
  
  carousel = createCarouselMediaGroup({
  imageUrls,
  backgroundUrls,
  depthMapUrls,
  backgroundDepthUrls,
  videoUrls: [],
  itemSize,
  radius
  });
  
  carousel.children.forEach((child, i) => {
  const index = i % projectMeta.length;
  child.userData.project = projectMeta[index];
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
  
  scene.add(carousel);
  carouselItems = [...carousel.children];
  
    if (isTouchDevice) {
  carouselItems.forEach(mesh => {
    const uniforms = mesh.userData?.uniforms;
    if (uniforms?.parallaxStrength) {
      setParallaxStrengthForAll(carouselItems, FIXED_PARALLAX_STRENGTH);
    }
  });
}

  let currentSizeClass = getCurrentSizeClass();
let resizeTimeout = null;

window.addEventListener("resize", () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    const newClass = getCurrentSizeClass();
    if (newClass !== currentSizeClass) {
      console.log(`🔄 Reloading due to resolution tier change: ${currentSizeClass} → ${newClass}`);
      location.reload(); // Trigger re-init with new image resolution
    } else {
      console.log("📐 Window resized, updating camera and renderer only");
      onWindowResize(); // Only adjust renderer/camera
    }
  }, 250); // Debounce delay
});

function getCurrentSizeClass() {
  const w = window.innerWidth;
  if (w < 600) return "480";
  if (w < 1000) return "768";
  return "1080";
}



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
        setParallaxStrengthForAll(carouselItems, FIXED_PARALLAX_STRENGTH);
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
          setParallaxStrengthForAll(carouselItems, FIXED_PARALLAX_STRENGTH);
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

      const dragScale = window.innerWidth < 600 ? 0.008 : 0.005;
      targetRotation -= deltaX * dragScale;

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
    
    if (bestMatch?.scale) {
    animateScale(bestMatch, 1.06, 200);
    setTimeout(() => animateScale(bestMatch, 1, 300), 200);
    } 


    if (isHoveringFocusedItem) {
      document.body.style.cursor = "grabbing";
    }
    
    if (bestMatch?.scale) {
  bestMatch.scale.set(1.06, 1.06, 1.06);
  setTimeout(() => {
    bestMatch.scale.set(1, 1, 1);
  }, 200);
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

      targetRotation -= deltaX * 0.005;
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
            setParallaxStrengthForAll(carouselItems, FIXED_PARALLAX_STRENGTH);

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
  
 setTimeout(() => {
    console.log("⏱ Triggering delayed resize to fix mobile black screen.");
    onWindowResize();
  }, 100);
  
  document.getElementById("carousel-container").addEventListener(
  "touchmove",
  (e) => {
    if (isDragging) e.preventDefault();
  },
  { passive: false }
);


  animate();
}

function onWindowResize() {
  const container = document.getElementById("carousel-container");
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
  composer.setSize(container.clientWidth, container.clientHeight);

  const screenWidth = container.clientWidth;
  if (screenWidth < 600) {
    carousel.position.z = 4.5;
  } else if (screenWidth < 1000) {
    carousel.position.z = 7.0;
  } else {
    carousel.position.z = 9;
  }
}


function animate() {
  requestAnimationFrame(animate);

  currentRotation += (targetRotation - currentRotation) * 0.15;

  // Conditional tilt
let targetTiltOffset = 0;
if (!isHoveringFocusedItem && !disableMouseTilt) {
  const smoothedMouseX = smoothDeadZone(mouseXNorm, 0.1);
  targetTiltOffset = smoothedMouseX * maxMouseOffset;
}

// Smooth interpolation (easing)
currentTiltOffset += (targetTiltOffset - currentTiltOffset) * 0.1;
carousel.rotation.y = currentRotation + currentTiltOffset;


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

    const isSmallTouchDevice = isTouchDevice && window.innerWidth < 500;
    const parallaxMultiplier = isSmallTouchDevice ? 2.0 : isTouchDevice ? 1.5 : 1;


      // Optional clamp to keep values in range
      const boostedX = THREE.MathUtils.clamp((baseX - 0.5) * parallaxMultiplier + 0.5, 0, 1);
      const boostedY = THREE.MathUtils.clamp((baseY - 0.5) * parallaxMultiplier + 0.5, 0, 1);

      uniforms.mouseX.value += (boostedX - uniforms.mouseX.value) * 0.075;
      uniforms.mouseY.value += (boostedY - uniforms.mouseY.value) * 0.075;

          if (isDragging && !isTouchDevice) {
        uniforms.mouseX.value = THREE.MathUtils.clamp(baseX + dragOffsetX, 0, 1);
        uniforms.mouseY.value = THREE.MathUtils.clamp(baseY + dragOffsetY, 0, 1);
      } else {
        uniforms.mouseX.value = baseX;
        uniforms.mouseY.value = baseY;
      }

    }
  }
}
  
carouselItems.forEach((mesh) => {
  if (mesh === bestMatch) return;

  const uniforms = mesh.userData?.uniforms;
  if (!uniforms || !("mouseX" in uniforms) || !("mouseY" in uniforms)) return;

  uniforms.mouseX.value += (0.5 - uniforms.mouseX.value) * 0.075;
  uniforms.mouseY.value += (0.5 - uniforms.mouseY.value) * 0.075;
});



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
    
    const project = bestMatch.userData?.project;
  if (project) {
  const index = (carouselItems.indexOf(bestMatch) % projectMeta.length) + 1;
  document.getElementById("project-index").textContent = index.toString().padStart(2, "0");
        
 const titleEl = document.getElementById("project-title");

      if (lastDisplayedTitle !== project.title) {
        lastDisplayedTitle = project.title;

        // Clear old content
        titleEl.innerHTML = "";

        // Add spans for each character
        [...project.title].forEach((char, i) => {
          const span = document.createElement("span");
          span.textContent = char;
          span.style.animationDelay = `${i * 50}ms`;
          titleEl.appendChild(span);
        });
      }

  document.getElementById("project-category").textContent = project.category;
  document.getElementById("project-button").href = project.link;
}

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

  const offsetScale = 0.08 + 0.02 * Math.sin(t * 0.5); // small variance
  uniforms.mouseX.value = 0.5 + offsetScale * Math.sin(t * 0.9);
  uniforms.mouseY.value = 0.5 + offsetScale * Math.cos(t * 0.7);
}


  composer.render();
}
