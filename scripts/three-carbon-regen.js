import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* ===================================================================
 * Hikmet Çetin Gold — Procedural 3D Carbon Regeneration Unit
 * Reference image: horizontal dark-metallic rotary regen kiln on a
 * black steel skid, stainless top feed funnel, blue motor / gearbox
 * at one end, vertical grey ELUTION COLUMN on the left with a black
 * yellow-text sign, ELUTION & GOLDROOM building behind on the right
 * with yellow exterior stair, prominent yellow safety railings,
 * gravel yard. Built entirely from Three.js primitives.
 * =================================================================== */

const CONFIG = {
  slideIndex: 15,                  // Slide 16 (data-slide="16"), 0-based DOM index = 15
};

let renderer, scene, camera, controls;
let canvas;
let initialized = false;
let frameId = null;

// Animated registries
const animatedKilns = [];   // {mesh, speed}
const animatedMotors = [];  // {mesh, speed}
const animatedFans = [];
const flowMarkers = [];

let lastUserInteraction = Date.now();
let autoRotateEnabled = true;

/* ============================ INIT ============================ */
function init(targetCanvas) {
  if (initialized) return;
  initialized = true;

  canvas = targetCanvas || document.getElementById('three-canvas-regen');
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(rect.width, 800);
  const height = Math.max(rect.height, 600);

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb8a98a);   // dusty sky / matches gravel haze
  scene.fog = new THREE.FogExp2(0xb8a98a, 0.018);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  // Camera — chosen to match the reference photo composition:
  // slight low-angle three-quarter view from the front-right, looking left at the kiln.
  camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 220);
  // Closer, slightly lower three-quarter front-right matching the reference photo
  camera.position.set(12.5, 4.2, 11.5);
  camera.lookAt(-0.5, 2.2, 0);

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 9;
  controls.maxDistance = 40;
  controls.minPolarAngle = Math.PI * 0.20;
  controls.maxPolarAngle = Math.PI * 0.52;
  controls.target.set(-0.5, 2.2, 0);
  controls.addEventListener('start', () => {
    lastUserInteraction = Date.now();
    autoRotateEnabled = false;
  });
  controls.addEventListener('end', () => {
    lastUserInteraction = Date.now();
    setTimeout(() => { autoRotateEnabled = true; }, 5000);
  });

  setupLights();
  buildGround();
  buildBackgroundHills();
  buildBuilding();        // ELUTION & GOLDROOM building (right side / back)
  buildSkidPlatform();    // black skid base with yellow front-rail line
  buildKiln();            // main horizontal carbon regen kiln with label
  buildFeedFunnel();      // stainless top feed hopper
  buildMotorAssembly();   // blue motor + gearbox on front-left of kiln
  buildDischargeHead();   // back-right end head of kiln (with hose)
  buildYellowRailing();   // bright yellow safety railing wrapping platform
  buildElutionColumnTower(); // vertical grey column on far left with sign
  buildPipework();        // black hoses + small grey pipes around base

  window.addEventListener('resize', onResize);
  window.addEventListener('slidechange', (e) => {
    if (e.detail.index === CONFIG.slideIndex) onResize();
  });
}

/* ============================ LIGHTING ============================ */
function setupLights() {
  // Hot sunny afternoon — warm key, cool sky fill
  const hemi = new THREE.HemisphereLight(0xffe9c2, 0x6a5a40, 0.75);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff2d0, 2.2);
  sun.position.set(10, 18, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -22;
  sun.shadow.camera.right = 22;
  sun.shadow.camera.top = 20;
  sun.shadow.camera.bottom = -10;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 60;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);

  const rim = new THREE.DirectionalLight(0xb8c8d8, 0.5);
  rim.position.set(-12, 8, -10);
  scene.add(rim);

  const bounce = new THREE.DirectionalLight(0xd4b88a, 0.35);
  bounce.position.set(0, -2, 6);
  scene.add(bounce);
}

/* ============================ GROUND ============================ */
function buildGround() {
  // Gravel / dirt yard
  const gravelTex = makeGravelTexture();
  gravelTex.wrapS = gravelTex.wrapT = THREE.RepeatWrapping;
  gravelTex.repeat.set(8, 8);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 60),
    new THREE.MeshStandardMaterial({
      map: gravelTex,
      color: 0xa89b80,
      roughness: 0.98,
      metalness: 0.02,
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  ground.receiveShadow = true;
  scene.add(ground);
}

function makeGravelTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');
  // base
  ctx.fillStyle = '#a89b80';
  ctx.fillRect(0, 0, 512, 512);
  // gravel pebbles
  for (let i = 0; i < 1600; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 1 + Math.random() * 3;
    const shade = 90 + Math.random() * 90;
    ctx.fillStyle = `rgb(${shade}, ${shade - 8}, ${shade - 24})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // darker patches
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 8 + Math.random() * 22;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(60,55,45,0.25)');
    g.addColorStop(1, 'rgba(60,55,45,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/* ============================ BACKGROUND HILLS ============================ */
function buildBackgroundHills() {
  // Distant gravel mound / quarry hillside (matches reference background)
  const hillMat = new THREE.MeshStandardMaterial({
    color: 0x988970, roughness: 1.0, metalness: 0.0,
  });
  const hill1 = new THREE.Mesh(
    new THREE.SphereGeometry(22, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    hillMat
  );
  hill1.position.set(-6, -2, -20);
  hill1.scale.set(1.4, 0.45, 0.8);
  scene.add(hill1);

  const hill2 = new THREE.Mesh(
    new THREE.SphereGeometry(18, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: 0x8a7a60, roughness: 1.0,
    })
  );
  hill2.position.set(10, -2, -22);
  hill2.scale.set(1.6, 0.4, 0.7);
  scene.add(hill2);
}

/* ===================================================================
 * BUILDING (background-right)
 * Dark steel-paneled building with the yellow "HIKMET ÇETİN GOLD /
 * ELUTION & GOLDROOM" sign above the door, and yellow exterior stair.
 * =================================================================== */
function buildBuilding() {
  const g = new THREE.Group();
  // Moved slightly closer/forward; building sits behind discharge end per reference
  g.position.set(9.5, 0, -3.0);

  // Main building body
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x2a2c30, roughness: 0.78, metalness: 0.25,
  });
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(7.5, 5.6, 5.0),
    bodyMat
  );
  body.position.set(0, 2.8, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  // Horizontal panel grooves (subtle)
  for (let i = 1; i <= 4; i++) {
    const groove = new THREE.Mesh(
      new THREE.BoxGeometry(7.52, 0.04, 5.02),
      new THREE.MeshStandardMaterial({ color: 0x18191c, roughness: 0.9 })
    );
    groove.position.set(0, i * 1.1, 0);
    g.add(groove);
  }

  // Roof cap
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(7.8, 0.18, 5.2),
    new THREE.MeshStandardMaterial({ color: 0x16181b, roughness: 0.7, metalness: 0.4 })
  );
  roof.position.set(0, 5.7, 0);
  g.add(roof);

  // Doorway recess (lighter)
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(2.0, 2.4, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x4a4d52, roughness: 0.6, metalness: 0.4 })
  );
  door.position.set(-0.8, 1.4, 2.52);
  g.add(door);

  // Sign panel — black with yellow text
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(4.2, 1.4),
    new THREE.MeshBasicMaterial({
      map: makeBuildingSignTexture(),
      transparent: true,
    })
  );
  sign.position.set(-0.6, 3.5, 2.53);
  g.add(sign);

  // Yellow exterior stair on the right side
  const stairMat = new THREE.MeshStandardMaterial({
    color: 0xefc41f, roughness: 0.55, metalness: 0.25,
    emissive: 0xefc41f, emissiveIntensity: 0.04,
  });
  const stairGroup = new THREE.Group();
  stairGroup.position.set(3.6, 0, 1.6);
  // stringers
  for (let s = -1; s <= 1; s += 2) {
    const stringer = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 4.2, 0.18),
      stairMat
    );
    stringer.position.set(s * 0.5, 2.1, 0);
    stringer.rotation.z = 0; // vertical posts
    stairGroup.add(stringer);
  }
  // diagonal stringer
  for (let s = -1; s <= 1; s += 2) {
    const diag = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 4.6, 0.08),
      stairMat
    );
    diag.position.set(s * 0.5, 2.0, 0.6);
    diag.rotation.x = -Math.PI * 0.18;
    stairGroup.add(diag);
  }
  // steps
  for (let i = 0; i < 9; i++) {
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 0.05, 0.32),
      stairMat
    );
    step.position.set(0, 0.5 + i * 0.42, 1.2 - i * 0.22);
    stairGroup.add(step);
  }
  // top handrail
  for (let s = -1; s <= 1; s += 2) {
    const hr = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.06, 2.6),
      stairMat
    );
    hr.position.set(s * 0.5, 4.0, 0.6);
    hr.rotation.x = -Math.PI * 0.18;
    stairGroup.add(hr);
  }
  // top platform
  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.08, 1.0),
    stairMat
  );
  platform.position.set(0, 4.3, 0);
  stairGroup.add(platform);

  // platform railing
  for (let s = -1; s <= 1; s += 2) {
    const r = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 1.0, 1.1),
      stairMat
    );
    r.position.set(s * 0.5, 4.85, 0);
    stairGroup.add(r);
  }
  const topRail = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.06, 0.06),
    stairMat
  );
  topRail.position.set(0, 5.3, 0.5);
  stairGroup.add(topRail);

  g.add(stairGroup);

  scene.add(g);
}

function makeBuildingSignTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 360;
  const ctx = c.getContext('2d');
  // background black panel
  ctx.fillStyle = '#0c0d10';
  ctx.fillRect(0, 0, 1024, 360);
  // top border
  ctx.strokeStyle = '#2a2c30';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 1018, 354);

  // top line "HIKMET ÇETİN GOLD" in yellow
  ctx.fillStyle = '#ecc417';
  ctx.font = 'bold 110px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('HIKMET ÇETİN GOLD', 512, 110);

  // divider line
  ctx.strokeStyle = '#3a3c40';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(60, 195);
  ctx.lineTo(964, 195);
  ctx.stroke();

  // bottom line "ELUTION & GOLDROOM" in white
  ctx.fillStyle = '#f0eee8';
  ctx.font = 'bold 78px Inter, Arial, sans-serif';
  ctx.fillText('ELUTION & GOLDROOM', 512, 275);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/* ============================ SKID PLATFORM ============================ */
function buildSkidPlatform() {
  const g = new THREE.Group();

  // Black skid base
  const skidMat = new THREE.MeshStandardMaterial({
    color: 0x18191c, roughness: 0.72, metalness: 0.5,
  });
  const skid = new THREE.Mesh(
    new THREE.BoxGeometry(13.0, 0.85, 4.2),
    skidMat
  );
  skid.position.set(0.3, 0.42, 0);
  skid.castShadow = true;
  skid.receiveShadow = true;
  g.add(skid);

  // Slight rim on top of skid
  const topPlate = new THREE.Mesh(
    new THREE.BoxGeometry(13.04, 0.06, 4.24),
    new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.6, metalness: 0.55 })
  );
  topPlate.position.set(0.3, 0.88, 0);
  g.add(topPlate);

  // Side stiffener strip (subtle horizontal weld line on long sides)
  const stiff = new THREE.Mesh(
    new THREE.BoxGeometry(13.02, 0.04, 4.22),
    new THREE.MeshStandardMaterial({ color: 0x0e0f12, roughness: 0.85, metalness: 0.4 })
  );
  stiff.position.set(0.3, 0.20, 0);
  g.add(stiff);

  // I-beam-like vertical legs (4 corners)
  for (let sx = -1; sx <= 1; sx += 2) {
    for (let sz = -1; sz <= 1; sz += 2) {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.42, 0.24),
        skidMat
      );
      leg.position.set(0.3 + sx * 6.3, 0.21, sz * 1.95);
      leg.castShadow = true;
      g.add(leg);
    }
  }

  scene.add(g);
}

/* ============================ KILN ============================ */
function buildKiln() {
  const group = new THREE.Group();

  // Main long cylinder body — dark metallic graphite with cool blue undertone
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x3c4248, roughness: 0.38, metalness: 0.88,
  });
  const brushedMat = new THREE.MeshStandardMaterial({
    color: 0x9aa0a6, roughness: 0.32, metalness: 0.92,
  });

  // The whole kiln rotates around X — but for the static label panel
  // we want a non-rotating sleeve. We layer: rotating body underneath,
  // static label "wrap" mesh on top (same radius + 0.001).
  const bodyLength = 8.4;
  const bodyRadius = 0.92;

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(bodyRadius, bodyRadius, bodyLength, 64, 1, false),
    bodyMat
  );
  body.rotation.z = Math.PI / 2;
  body.position.set(0, 2.4, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Riding rings (raised bands) — non-rotating visual, multiple bands per reference
  const ringMat = new THREE.MeshStandardMaterial({ color: 0x26282c, roughness: 0.38, metalness: 0.92 });
  for (const xRel of [-3.0, -1.5, 1.4, 2.9]) {
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(bodyRadius + 0.07, bodyRadius + 0.07, 0.22, 56),
      ringMat
    );
    ring.rotation.z = Math.PI / 2;
    ring.position.set(xRel, 2.4, 0);
    ring.castShadow = true;
    group.add(ring);
  }

  // Front-end brushed-stainless trunnion housing (left end, before motor)
  // Reference shows a stepped silvery collar where the body meets the drive end.
  const trunnionLeft = new THREE.Mesh(
    new THREE.CylinderGeometry(bodyRadius + 0.10, bodyRadius + 0.10, 0.55, 56),
    brushedMat
  );
  trunnionLeft.rotation.z = Math.PI / 2;
  trunnionLeft.position.set(-bodyLength / 2 - 0.30, 2.4, 0);
  trunnionLeft.castShadow = true;
  group.add(trunnionLeft);

  // Stepped collar ring on the brushed section
  for (const xCol of [-bodyLength / 2 - 0.05, -bodyLength / 2 - 0.55]) {
    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(bodyRadius + 0.14, bodyRadius + 0.14, 0.06, 56),
      new THREE.MeshStandardMaterial({ color: 0x7a8088, roughness: 0.35, metalness: 0.9 })
    );
    col.rotation.z = Math.PI / 2;
    col.position.set(xCol, 2.4, 0);
    group.add(col);
  }

  // Right-end housing — darker boxy discharge collar (matches reference)
  const dischargeCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(bodyRadius + 0.12, bodyRadius + 0.12, 0.6, 56),
    new THREE.MeshStandardMaterial({ color: 0x2e3135, roughness: 0.45, metalness: 0.86 })
  );
  dischargeCollar.rotation.z = Math.PI / 2;
  dischargeCollar.position.set(bodyLength / 2 + 0.30, 2.4, 0);
  dischargeCollar.castShadow = true;
  group.add(dischargeCollar);

  // Bolt-flange caps at each true end with bolt circles
  for (const sign of [-1, 1]) {
    const xCap = sign * (bodyLength / 2 + 0.62);
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(bodyRadius + 0.16, bodyRadius + 0.16, 0.10, 56),
      new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: 0.5, metalness: 0.88 })
    );
    cap.rotation.z = Math.PI / 2;
    cap.position.set(xCap, 2.4, 0);
    group.add(cap);

    // Bolt circle
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      const bolt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.045, 0.10, 8),
        new THREE.MeshStandardMaterial({ color: 0x55585d, roughness: 0.5, metalness: 0.9 })
      );
      bolt.rotation.z = Math.PI / 2;
      bolt.position.set(
        xCap + sign * 0.06,
        2.4 + Math.cos(a) * (bodyRadius + 0.10),
        Math.sin(a) * (bodyRadius + 0.10)
      );
      group.add(bolt);
    }
  }

  // Static label decal on the front face of the kiln body
  // Placed slightly in front of the kiln (along +Z) so we always see it
  const labelTex = makeKilnLabelTexture();
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(5.4, 1.2),
    new THREE.MeshBasicMaterial({
      map: labelTex,
      transparent: true,
      side: THREE.DoubleSide,
    })
  );
  label.position.set(0.4, 2.55, bodyRadius + 0.012);
  group.add(label);

  // Also wrap a curved label by tilting a plane against the cylinder surface — simple, robust:
  // (skipping curved cylinder wrap; the planar label reads cleanly from the camera angle.)

  scene.add(group);
  animatedKilns.push({ mesh: body, speed: 0.006 });
}

function makeKilnLabelTexture() {
  const c = document.createElement('canvas');
  c.width = 2048; c.height = 460;
  const ctx = c.getContext('2d');

  // transparent background
  ctx.clearRect(0, 0, 2048, 460);

  // Top white line
  ctx.fillStyle = '#f3f1ea';
  ctx.font = 'bold 170px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('HIKMET ÇETİN GOLD', 1024, 130);

  // Divider
  ctx.strokeStyle = 'rgba(243,241,234,0.6)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(200, 240);
  ctx.lineTo(1848, 240);
  ctx.stroke();

  // Bottom line
  ctx.fillStyle = '#f3f1ea';
  ctx.font = 'bold 130px Inter, Arial, sans-serif';
  ctx.fillText('CARBON REGENERATION', 1024, 340);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  return tex;
}

/* ============================ FEED FUNNEL (top of kiln) ============================ */
function buildFeedFunnel() {
  const g = new THREE.Group();
  // sit slightly left of center, above the kiln top
  g.position.set(-2.9, 3.45, 0);

  const stainless = new THREE.MeshStandardMaterial({
    color: 0xd4d7db, roughness: 0.22, metalness: 0.96,
  });
  const dullSteel = new THREE.MeshStandardMaterial({
    color: 0x8f9398, roughness: 0.4, metalness: 0.88,
  });

  // Funnel cone (wide top, narrow bottom) — taller, steeper taper
  const cone = new THREE.Mesh(
    new THREE.CylinderGeometry(0.78, 0.16, 1.25, 36, 1, true),
    stainless
  );
  cone.position.y = 0.62;
  cone.castShadow = true;
  g.add(cone);

  // Inner shadow cone (darker interior visible from above)
  const inner = new THREE.Mesh(
    new THREE.CylinderGeometry(0.74, 0.14, 1.22, 36, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x222428, roughness: 0.8, metalness: 0.3, side: THREE.BackSide })
  );
  inner.position.y = 0.62;
  g.add(inner);

  // Top rim torus
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.78, 0.05, 10, 36),
    stainless
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 1.24;
  g.add(rim);

  // Mid-cone reinforcement band
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.46, 0.46, 0.05, 24),
    dullSteel
  );
  band.position.y = 0.62;
  g.add(band);

  // Lower connector pipe down into kiln — longer
  const pipe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 0.85, 28),
    stainless
  );
  pipe.position.y = -0.42;
  g.add(pipe);

  // Connector flange where it meets the kiln
  const flange = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.08, 28),
    new THREE.MeshStandardMaterial({ color: 0x5a5d62, roughness: 0.45, metalness: 0.85 })
  );
  flange.position.y = -0.85;
  g.add(flange);

  // Saddle clamp on top of kiln body
  const saddle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.32, 0.10, 28),
    dullSteel
  );
  saddle.position.y = -0.95;
  g.add(saddle);

  scene.add(g);
}

/* ============================ MOTOR / GEARBOX ASSEMBLY ============================ */
function buildMotorAssembly() {
  const g = new THREE.Group();
  // Sits on the front-left of the kiln, in front of skid
  g.position.set(-4.2, 1.0, 1.55);

  const blueMat = new THREE.MeshStandardMaterial({
    color: 0x1f5ea8, roughness: 0.45, metalness: 0.55,
  });
  const darkBlueMat = new THREE.MeshStandardMaterial({
    color: 0x14467e, roughness: 0.5, metalness: 0.55,
  });

  // Motor (horizontal cylinder)
  const motor = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.36, 0.95, 24),
    blueMat
  );
  motor.rotation.z = Math.PI / 2;
  motor.position.set(-0.5, 0.4, 0);
  motor.castShadow = true;
  g.add(motor);

  // Motor ribs
  for (let i = 0; i < 6; i++) {
    const rib = new THREE.Mesh(
      new THREE.TorusGeometry(0.37, 0.018, 6, 18),
      darkBlueMat
    );
    rib.rotation.y = Math.PI / 2;
    rib.position.set(-0.95 + i * 0.18, 0.4, 0);
    g.add(rib);
  }

  // Motor end cap (fan housing)
  const fanHousing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.30, 0.30, 0.22, 24),
    darkBlueMat
  );
  fanHousing.rotation.z = Math.PI / 2;
  fanHousing.position.set(-1.10, 0.4, 0);
  g.add(fanHousing);

  // Front end cap (toward gearbox)
  const frontCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.38, 0.10, 24),
    darkBlueMat
  );
  frontCap.rotation.z = Math.PI / 2;
  frontCap.position.set(-0.04, 0.4, 0);
  g.add(frontCap);

  // Gearbox (boxy)
  const gearbox = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.85, 0.65),
    blueMat
  );
  gearbox.position.set(0.35, 0.45, 0);
  gearbox.castShadow = true;
  g.add(gearbox);

  // Gearbox output shaft going up toward kiln
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.10, 0.10, 0.6, 16),
    new THREE.MeshStandardMaterial({ color: 0x3a3c40, roughness: 0.4, metalness: 0.9 })
  );
  shaft.position.set(0.35, 1.1, 0);
  g.add(shaft);

  // Base plate (dark steel skid mount)
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(1.95, 0.10, 0.95),
    new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.6, metalness: 0.6 })
  );
  base.position.set(-0.2, -0.05, 0);
  g.add(base);

  // Anchor bolts visible on base plate
  for (let bx of [-0.95, -0.25, 0.45]) {
    for (let bz of [-0.4, 0.4]) {
      const bolt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.08, 8),
        new THREE.MeshStandardMaterial({ color: 0x55585d, roughness: 0.5, metalness: 0.9 })
      );
      bolt.position.set(bx, 0.04, bz);
      g.add(bolt);
    }
  }

  // Junction box (small box on top of motor) — typical industrial cable box
  const jbox = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.18, 0.30),
    darkBlueMat
  );
  jbox.position.set(-0.6, 0.78, 0);
  g.add(jbox);

  // Cable conduit coming out of junction box
  const conduit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 0.50, 10),
    new THREE.MeshStandardMaterial({ color: 0x18191c, roughness: 0.85, metalness: 0.1 })
  );
  conduit.position.set(-0.6, 1.08, 0.05);
  g.add(conduit);

  // Motor shaft visible between motor and gearbox
  const motorShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, 0.14, 12),
    new THREE.MeshStandardMaterial({ color: 0x3a3c40, roughness: 0.35, metalness: 0.95 })
  );
  motorShaft.rotation.z = Math.PI / 2;
  motorShaft.position.set(0.05, 0.4, 0);
  g.add(motorShaft);

  scene.add(g);
  animatedMotors.push({ mesh: motor, speed: 0.18 });
}

/* ============================ DISCHARGE HEAD ============================ */
function buildDischargeHead() {
  // Right-end discharge head + black hose dangling underneath
  const g = new THREE.Group();
  g.position.set(5.1, 2.4, 0);

  const headDark = new THREE.MeshStandardMaterial({ color: 0x2c2e32, roughness: 0.55, metalness: 0.82 });

  // Outer boxy housing — reference shows a chunky stepped enclosure on the right end
  const housing = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 1.45, 1.45),
    headDark
  );
  housing.position.set(0.55, 0, 0);
  housing.castShadow = true;
  g.add(housing);

  // Stepped narrower section pointing right (output side)
  const step = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 1.05, 1.05),
    headDark
  );
  step.position.set(1.18, 0, 0);
  g.add(step);

  // Bolted end plate
  const endPlate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.45, 0.08, 24),
    new THREE.MeshStandardMaterial({ color: 0x40434a, roughness: 0.4, metalness: 0.9 })
  );
  endPlate.rotation.z = Math.PI / 2;
  endPlate.position.set(1.44, 0, 0);
  g.add(endPlate);

  // Bolts on end plate
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const bolt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.08, 8),
      new THREE.MeshStandardMaterial({ color: 0x55585d, roughness: 0.5, metalness: 0.9 })
    );
    bolt.rotation.z = Math.PI / 2;
    bolt.position.set(1.48, Math.cos(a) * 0.36, Math.sin(a) * 0.36);
    g.add(bolt);
  }

  // Output discharge stub going down/right toward the valve cluster
  const stub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 0.8, 20),
    new THREE.MeshStandardMaterial({ color: 0x6a6d72, roughness: 0.45, metalness: 0.85 })
  );
  stub.rotation.z = Math.PI * 0.35;
  stub.position.set(0.55, -0.95, 0.55);
  g.add(stub);

  // Discharge outlet cylinder at the bottom (under valve)
  const outlet = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 0.42, 24),
    new THREE.MeshStandardMaterial({ color: 0x3a3c40, roughness: 0.4, metalness: 0.85 })
  );
  outlet.position.set(0.85, -1.4, 0.65);
  g.add(outlet);

  scene.add(g);
}

/* ============================ YELLOW SAFETY RAILING ============================ */
function buildYellowRailing() {
  const g = new THREE.Group();

  const yellow = new THREE.MeshStandardMaterial({
    color: 0xf2c318, roughness: 0.45, metalness: 0.3,
    emissive: 0xf2c318, emissiveIntensity: 0.05,
  });

  const railHeight = 1.05;
  const skidTopY = 0.91;

  // Front (camera-facing) rail — long horizontal yellow bar plus posts plus mid-rail
  // spans the full length of the skid front
  const frontZ = 2.15;
  const xMin = -6.5;
  const xMax = 6.5;

  // top rail — slightly rounded square bar
  const topRail = new THREE.Mesh(
    new THREE.BoxGeometry(xMax - xMin, 0.09, 0.09),
    yellow
  );
  topRail.position.set((xMin + xMax) / 2, skidTopY + railHeight, frontZ);
  g.add(topRail);

  // mid rail
  const midRail = new THREE.Mesh(
    new THREE.BoxGeometry(xMax - xMin, 0.07, 0.07),
    yellow
  );
  midRail.position.set((xMin + xMax) / 2, skidTopY + railHeight * 0.55, frontZ);
  g.add(midRail);

  // bottom kick plate — solid yellow panel (matches reference flat bar look)
  const kick = new THREE.Mesh(
    new THREE.BoxGeometry(xMax - xMin, 0.28, 0.04),
    yellow
  );
  kick.position.set((xMin + xMax) / 2, skidTopY + 0.16, frontZ);
  g.add(kick);

  // posts — closer spacing per reference
  for (let x = xMin; x <= xMax + 0.01; x += 1.25) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, railHeight, 0.11),
      yellow
    );
    post.position.set(x, skidTopY + railHeight / 2, frontZ);
    post.castShadow = true;
    g.add(post);
  }

  // Right-side return (short L)
  for (let z = frontZ - 0.5; z >= -1.2; z -= 0.55) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, railHeight, 0.11),
      yellow
    );
    post.position.set(xMax, skidTopY + railHeight / 2, z);
    g.add(post);
  }
  const sideTop = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.09, 3.4),
    yellow
  );
  sideTop.position.set(xMax, skidTopY + railHeight, 0.45);
  g.add(sideTop);
  const sideMid = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, 0.07, 3.4),
    yellow
  );
  sideMid.position.set(xMax, skidTopY + railHeight * 0.55, 0.45);
  g.add(sideMid);
  const sideKick = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.28, 3.4),
    yellow
  );
  sideKick.position.set(xMax, skidTopY + 0.16, 0.45);
  g.add(sideKick);

  // Left-side return (toward elution column)
  for (let z = frontZ - 0.5; z >= -1.2; z -= 0.55) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, railHeight, 0.11),
      yellow
    );
    post.position.set(xMin, skidTopY + railHeight / 2, z);
    g.add(post);
  }
  const leftTop = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.09, 3.4),
    yellow
  );
  leftTop.position.set(xMin, skidTopY + railHeight, 0.45);
  g.add(leftTop);
  const leftMid = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, 0.07, 3.4),
    yellow
  );
  leftMid.position.set(xMin, skidTopY + railHeight * 0.55, 0.45);
  g.add(leftMid);
  const leftKick = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.28, 3.4),
    yellow
  );
  leftKick.position.set(xMin, skidTopY + 0.16, 0.45);
  g.add(leftKick);

  scene.add(g);
}

/* ============================ ELUTION COLUMN (left side, vertical) ============================ */
function buildElutionColumnTower() {
  const g = new THREE.Group();
  // Slightly closer to the kiln so hoses look attached, and tall enough to dominate left side
  g.position.set(-8.0, 0, 0.4);

  // Vertical cylinder — light grey insulated concrete look
  const colMat = new THREE.MeshStandardMaterial({
    color: 0xb6b3aa, roughness: 0.85, metalness: 0.05,
  });
  const col = new THREE.Mesh(
    new THREE.CylinderGeometry(0.85, 0.85, 6.2, 32),
    colMat
  );
  col.position.y = 3.1;
  col.castShadow = true;
  col.receiveShadow = true;
  g.add(col);

  // Bottom flange
  const baseFlange = new THREE.Mesh(
    new THREE.CylinderGeometry(0.95, 0.95, 0.18, 32),
    new THREE.MeshStandardMaterial({ color: 0x40423a, roughness: 0.6, metalness: 0.6 })
  );
  baseFlange.position.y = 0.09;
  g.add(baseFlange);

  // Top dome cap
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.85, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    colMat
  );
  dome.position.y = 6.2;
  g.add(dome);

  // Top flange ring
  const topRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.86, 0.06, 8, 32),
    new THREE.MeshStandardMaterial({ color: 0x40423a, roughness: 0.6, metalness: 0.6 })
  );
  topRing.rotation.x = Math.PI / 2;
  topRing.position.y = 6.2;
  g.add(topRing);

  // Side discharge nozzle (top)
  const nozzle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 0.5, 16),
    new THREE.MeshStandardMaterial({ color: 0x40423a, roughness: 0.5, metalness: 0.7 })
  );
  nozzle.rotation.z = Math.PI / 2;
  nozzle.position.set(1.0, 5.6, 0);
  g.add(nozzle);

  // Black sign panel mounted on column with yellow "ELUTION COLUMN" text
  const signTex = makeElutionSignTexture();
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 1.7),
    new THREE.MeshBasicMaterial({ map: signTex, transparent: true, side: THREE.DoubleSide })
  );
  sign.position.set(0, 4.5, 0.87);
  g.add(sign);

  // Connecting pipes going right toward the kiln (black insulated hoses)
  // Long arcing curves rising from the column then dropping toward the kiln
  const hoseMat = new THREE.MeshStandardMaterial({
    color: 0x0a0b0d, roughness: 0.88, metalness: 0.08,
  });
  for (let i = 0; i < 3; i++) {
    const y = 1.4 + i * 0.55;
    const hose = new THREE.Mesh(
      new THREE.TorusGeometry(1.4 + i * 0.08, 0.085, 12, 36, Math.PI * 0.65),
      hoseMat
    );
    hose.rotation.y = -Math.PI / 2;
    hose.rotation.z = Math.PI / 2;
    hose.position.set(1.8, y, 0);
    g.add(hose);
  }

  // Hose flanges/clamps on column side
  for (let i = 0; i < 3; i++) {
    const y = 1.4 + i * 0.55;
    const clamp = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.10, 16),
      new THREE.MeshStandardMaterial({ color: 0x5a5d62, roughness: 0.45, metalness: 0.85 })
    );
    clamp.rotation.z = Math.PI / 2;
    clamp.position.set(0.95, y, 0);
    g.add(clamp);
  }

  // Vertical pipe stack on side
  const sidePipe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 3.6, 14),
    new THREE.MeshStandardMaterial({ color: 0x6a6d72, roughness: 0.5, metalness: 0.7 })
  );
  sidePipe.position.set(-0.9, 1.8, 0.2);
  g.add(sidePipe);

  scene.add(g);
}

function makeElutionSignTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 640;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0c0d10';
  ctx.fillRect(0, 0, 512, 640);
  ctx.strokeStyle = '#2a2c30';
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, 504, 632);

  ctx.fillStyle = '#ecc417';
  ctx.font = 'bold 88px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ELUTION', 256, 270);
  ctx.fillText('COLUMN', 256, 370);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/* ============================ PIPEWORK ============================ */
function buildPipework() {
  const g = new THREE.Group();

  const pipeMat = new THREE.MeshStandardMaterial({
    color: 0x6a6d72, roughness: 0.5, metalness: 0.75,
  });
  const blackHose = new THREE.MeshStandardMaterial({
    color: 0x0d0e10, roughness: 0.85, metalness: 0.08,
  });

  // Underneath kiln — small grey pipes running along the front of skid
  for (let i = 0; i < 2; i++) {
    const p = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 10.0, 14),
      pipeMat
    );
    p.rotation.z = Math.PI / 2;
    p.position.set(-0.5, 1.05 + i * 0.18, 1.65);
    g.add(p);
  }

  // A drooping black flexible hose from below the front of the kiln (reference photo has one near motor)
  const hoseArc = new THREE.Mesh(
    new THREE.TorusGeometry(0.45, 0.06, 10, 24, Math.PI * 0.9),
    blackHose
  );
  hoseArc.rotation.y = Math.PI / 2;
  hoseArc.rotation.z = Math.PI * 0.05;
  hoseArc.position.set(-2.6, 1.2, 1.4);
  g.add(hoseArc);

  // Another bigger black hose looping near the gearbox (matches reference)
  const bigHose = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.085, 12, 28, Math.PI * 1.0),
    blackHose
  );
  bigHose.rotation.y = Math.PI / 2;
  bigHose.position.set(-3.5, 1.45, 1.5);
  g.add(bigHose);

  // Valve cluster on right side (under discharge head) — bigger, multiple valves with red handwheels
  for (let i = 0; i < 2; i++) {
    const offset = i * 0.55;
    const valveBlock = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.32, 0.32),
      pipeMat
    );
    valveBlock.position.set(5.4 + offset, 1.10, 1.15);
    g.add(valveBlock);

    // Handwheel stem
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.32, 10),
      new THREE.MeshStandardMaterial({ color: 0x55585d, roughness: 0.4, metalness: 0.9 })
    );
    stem.position.set(5.4 + offset, 1.42, 1.15);
    g.add(stem);

    // Red handwheel
    const handwheel = new THREE.Mesh(
      new THREE.TorusGeometry(0.14, 0.022, 8, 20),
      new THREE.MeshStandardMaterial({ color: 0xc12424, roughness: 0.45, metalness: 0.35 })
    );
    handwheel.rotation.x = Math.PI / 2;
    handwheel.position.set(5.4 + offset, 1.58, 1.15);
    g.add(handwheel);

    // Handwheel spokes
    for (let s = 0; s < 4; s++) {
      const spoke = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, 0.012, 0.012),
        new THREE.MeshStandardMaterial({ color: 0xc12424, roughness: 0.45, metalness: 0.35 })
      );
      spoke.position.set(5.4 + offset, 1.58, 1.15);
      spoke.rotation.y = (s / 4) * Math.PI;
      g.add(spoke);
    }
  }

  // Connecting horizontal pipe between valves
  const conn = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, 0.7, 16),
    pipeMat
  );
  conn.rotation.z = Math.PI / 2;
  conn.position.set(5.675, 1.10, 1.15);
  g.add(conn);

  scene.add(g);
}

/* ============================ ANIMATION LOOP ============================ */
function startRendering() {
  if (frameId !== null) return;
  animate();
}

function stopRendering() {
  if (frameId !== null) {
    cancelAnimationFrame(frameId);
    frameId = null;
  }
}

function animate() {
  frameId = requestAnimationFrame(animate);

  for (const k of animatedKilns) {
    k.mesh.rotation.y += k.speed;   // because the kiln body is rotated, "y" here is along its true axis
  }
  for (const m of animatedMotors) {
    m.mesh.rotation.y += m.speed;
  }
  for (const f of animatedFans) {
    f.rotation.y += 0.4;
  }

  if (autoRotateEnabled && (Date.now() - lastUserInteraction) > 5000) {
    const radius = Math.hypot(camera.position.x, camera.position.z);
    const angle = Math.atan2(camera.position.z, camera.position.x) + 0.0012;
    camera.position.x = Math.cos(angle) * radius;
    camera.position.z = Math.sin(angle) * radius;
    camera.lookAt(controls.target);
  }

  controls.update();
  renderer.render(scene, camera);
}

function onResize() {
  if (!canvas || !renderer || !camera) return;
  const rect = canvas.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  if (width === 0 || height === 0) return;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

/* ============================ SLIDE WIRING ============================ */
window.addEventListener('slidechange', (e) => {
  if (e.detail.index === CONFIG.slideIndex) {
    init();
    setTimeout(onResize, 50);
    startRendering();
  } else {
    stopRendering();
  }
});

// Auto-init if the matching slide is already active on load
if (document.querySelector(`.slide[data-slide="16"]`)?.classList.contains('active')) {
  init();
  startRendering();
}

/* ============================ EXTERNAL MOUNT API (slide 8 atlas) ============================ */
function _disposeForMount() {
  if (frameId !== null) {
    cancelAnimationFrame(frameId);
    frameId = null;
  }
  if (controls) {
    try { controls.dispose(); } catch (e) {}
  }
  if (scene) {
    scene.traverse((obj) => {
      if (obj.geometry) { try { obj.geometry.dispose(); } catch (e) {} }
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => {
          for (const k in m) {
            const v = m[k];
            if (v && v.isTexture) { try { v.dispose(); } catch (e) {} }
          }
          try { m.dispose(); } catch (e) {}
        });
      }
    });
    while (scene.children.length) scene.remove(scene.children[0]);
  }
  if (renderer) {
    try { renderer.dispose(); } catch (e) {}
    try { renderer.forceContextLoss && renderer.forceContextLoss(); } catch (e) {}
  }
  animatedKilns.length = 0;
  animatedMotors.length = 0;
  animatedFans.length = 0;
  flowMarkers.length = 0;
  renderer = null;
  scene = null;
  camera = null;
  controls = null;
  canvas = null;
  initialized = false;
}

window.threeCarbonRegen = {
  mount(canvasEl) {
    if (!canvasEl) return;
    if (initialized && canvas === canvasEl) {
      startRendering();
      setTimeout(onResize, 50);
      return;
    }
    if (initialized) _disposeForMount();
    init(canvasEl);
    setTimeout(onResize, 50);
    startRendering();
  },
  unmount() {
    if (!initialized) {
      if (frameId !== null) { cancelAnimationFrame(frameId); frameId = null; }
      return;
    }
    _disposeForMount();
  },
  get isMounted() { return initialized; },
  get currentCanvas() { return canvas; },
};
