import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* ===================================================================
 * Hikmet Çetin Gold — Procedural 3D CIL Leach Tank Battery (v2)
 * 6-tank CIL train with interstage transfers, motors, level gauges,
 * stencil labels, animated slurry & flow markers, full safety details.
 * Built entirely from Three.js primitives — no external models.
 * =================================================================== */

const CONFIG = {
  tankCount: 3,
  tankSpacing: 7.0,
  tankRadius: 2.4,
  tankHeight: 6.5,
};

let renderer, scene, camera, controls;
let canvas;
let initialized = false;
let frameId = null;
const animatedShafts = [];
const animatedBubbles = [];
const flowMarkers = [];
const slurrySurfaces = [];
let lastUserInteraction = Date.now();
let autoRotateEnabled = true;

function init() {
  if (initialized) return;
  initialized = true;

  canvas = document.getElementById('three-canvas');
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(rect.width, 800);
  const height = Math.max(rect.height, 600);

  // Renderer
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
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;  // faster than PCFSoftShadowMap

  // Scene
  scene = new THREE.Scene();
  scene.background = null;  // CSS gradient shows through
  scene.fog = new THREE.FogExp2(0xeae3d0, 0.010);  // light cream fog

  // Environment for PBR reflections
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  // Camera — framed for smaller 3-tank plant
  camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 200);
  camera.position.set(20, 14, 22);
  camera.lookAt(0, 3.5, 0);

  // Controls
  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 12;
  controls.maxDistance = 55;
  controls.minPolarAngle = Math.PI * 0.12;
  controls.maxPolarAngle = Math.PI * 0.50;
  controls.target.set(0, 3.5, 0);
  controls.addEventListener('start', () => {
    lastUserInteraction = Date.now();
    autoRotateEnabled = false;
  });
  controls.addEventListener('end', () => {
    lastUserInteraction = Date.now();
    setTimeout(() => { autoRotateEnabled = true; }, 5000);
  });

  setupLights();
  buildGroundPlatform();
  buildTankBattery();
  buildInterstageTransfers();
  buildHeaderPipework();
  buildWalkwayAndRails();
  buildPumpStation();
  buildAuxiliaries();
  buildAtmosphericGlow();

  // Render loop is started by external slidechange listener via startRendering()

  window.addEventListener('resize', onResize);
  window.addEventListener('slidechange', (e) => {
    if (e.detail.index === 2) onResize();
  });
}

/* ============================ LIGHTING ============================ */
function setupLights() {
  // Hemi: warm sky + cool ground for a "daylit studio" feel
  const hemi = new THREE.HemisphereLight(0xfff4e2, 0x4a4030, 0.65);
  scene.add(hemi);

  // Key — bright warm sun from upper right
  const key = new THREE.DirectionalLight(0xffffff, 2.0);
  key.position.set(16, 22, 12);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);       // half-size shadow map for perf
  key.shadow.camera.left = -20;
  key.shadow.camera.right = 20;
  key.shadow.camera.top = 20;
  key.shadow.camera.bottom = -8;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 60;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  scene.add(key);

  // Rim — cool from back-left to define silhouettes against light bg
  const rim = new THREE.DirectionalLight(0xa8c0e0, 0.55);
  rim.position.set(-14, 10, -12);
  scene.add(rim);

  // Soft front fill — slight gold to keep brand color
  const fill = new THREE.DirectionalLight(0xfff0c0, 0.4);
  fill.position.set(-6, 6, 14);
  scene.add(fill);
}

/* ============================ GROUND ============================ */
function buildGroundPlatform() {
  const totalWidth = CONFIG.tankCount * CONFIG.tankSpacing + 10;

  // Concrete pad — lighter to match light scene
  const padGeom = new THREE.BoxGeometry(totalWidth, 0.5, 16);
  const padMat = new THREE.MeshStandardMaterial({
    color: 0xa8a6a0,
    roughness: 0.92,
    metalness: 0.04,
  });
  const pad = new THREE.Mesh(padGeom, padMat);
  pad.position.y = -0.25;
  pad.receiveShadow = true;
  scene.add(pad);

  // Edge bevels (small)
  const edgeMat = new THREE.MeshStandardMaterial({
    color: 0x505254, roughness: 0.9, metalness: 0.05,
  });
  for (let z = -1; z <= 1; z += 2) {
    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(totalWidth, 0.12, 0.3),
      edgeMat
    );
    edge.position.set(0, 0.06, z * 7.9);
    scene.add(edge);
  }

  // Gold safety stripes
  const stripeMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37, roughness: 0.5, metalness: 0.55,
    emissive: 0xd4af37, emissiveIntensity: 0.1,
  });
  const stripe1 = new THREE.Mesh(
    new THREE.BoxGeometry(totalWidth, 0.04, 0.4),
    stripeMat
  );
  stripe1.position.set(0, 0.04, 7.3);
  scene.add(stripe1);
  const stripe2 = stripe1.clone();
  stripe2.position.z = -7.3;
  scene.add(stripe2);

  // Drainage grate strips (front of platform)
  const grateMat = new THREE.MeshStandardMaterial({
    color: 0x2a2d33, roughness: 0.8, metalness: 0.4,
  });
  for (let i = 0; i < 4; i++) {
    const xOffset = -totalWidth / 2 + 5 + i * (totalWidth - 10) / 3;
    const grate = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 0.05, 0.8),
      grateMat
    );
    grate.position.set(xOffset, 0.03, 6.0);
    scene.add(grate);

    // Grate slats
    for (let s = 0; s < 8; s++) {
      const slat = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.06, 0.7),
        grateMat
      );
      slat.position.set(xOffset - 0.9 + s * 0.26, 0.05, 6.0);
      scene.add(slat);
    }
  }

  // Painted lane markings between tanks
  const laneMat = new THREE.MeshStandardMaterial({
    color: 0xb8b8b8, roughness: 0.95,
  });
  for (let i = 0; i < CONFIG.tankCount - 1; i++) {
    const startX = -((CONFIG.tankCount - 1) * CONFIG.tankSpacing) / 2;
    const x = startX + i * CONFIG.tankSpacing + CONFIG.tankSpacing / 2;
    const lane = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.02, 5.5),
      laneMat
    );
    lane.position.set(x, 0.02, -4);
    scene.add(lane);
  }
}

/* ============================ TANK BATTERY ============================ */
function buildTankBattery() {
  const startX = -((CONFIG.tankCount - 1) * CONFIG.tankSpacing) / 2;
  for (let i = 0; i < CONFIG.tankCount; i++) {
    const x = startX + i * CONFIG.tankSpacing;
    const tank = buildSingleTank(i + 1);
    tank.position.x = x;
    scene.add(tank);
  }
}

function buildSingleTank(index) {
  const group = new THREE.Group();
  const R = CONFIG.tankRadius;
  const H = CONFIG.tankHeight;

  /* Tank shell */
  const shellMat = new THREE.MeshStandardMaterial({
    color: 0x1e4d8c,
    roughness: 0.45,
    metalness: 0.72,
    envMapIntensity: 1.2,
  });
  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(R, R, H, 36, 1, true),
    shellMat
  );
  shell.position.y = H / 2 + 0.5;
  shell.castShadow = true;
  shell.receiveShadow = true;
  group.add(shell);

  /* Subtle horizontal seam bands */
  const seamMat = new THREE.MeshStandardMaterial({
    color: 0x163e72, roughness: 0.5, metalness: 0.8,
  });
  for (let y = 2.5; y < H; y += 2.2) {
    const seam = new THREE.Mesh(
      new THREE.TorusGeometry(R + 0.02, 0.04, 8, 32),
      seamMat
    );
    seam.position.y = y + 0.2;
    seam.rotation.x = Math.PI / 2;
    group.add(seam);
  }

  /* Conical bottom */
  const bottomGeom = new THREE.CylinderGeometry(R, 0.55, 1.8, 32, 1, false);
  const bottom = new THREE.Mesh(bottomGeom, shellMat);
  bottom.position.y = -0.4;
  bottom.castShadow = true;
  group.add(bottom);

  /* Top cap */
  const capMat = new THREE.MeshStandardMaterial({
    color: 0x2a2d33, roughness: 0.55, metalness: 0.65,
  });
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(R + 0.02, R + 0.02, 0.18, 32),
    capMat
  );
  cap.position.y = H + 0.5;
  cap.castShadow = true;
  group.add(cap);

  /* Top rim */
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(R + 0.05, 0.1, 8, 32),
    new THREE.MeshStandardMaterial({ color: 0x6a6d72, roughness: 0.4, metalness: 0.85 })
  );
  rim.position.y = H + 0.6;
  rim.rotation.x = Math.PI / 2;
  group.add(rim);

  /* Slurry surface (semi-transparent gold-tinted) */
  const slurryMat = new THREE.MeshPhysicalMaterial({
    color: 0x8a6b2a,
    roughness: 0.18,
    metalness: 0.25,
    transmission: 0.35,
    thickness: 1.5,
    transparent: true,
    opacity: 0.92,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    emissive: 0x4a3210,
    emissiveIntensity: 0.18,
    side: THREE.DoubleSide,
  });
  const slurry = new THREE.Mesh(
    new THREE.CylinderGeometry(R - 0.05, R - 0.05, 0.4, 32),
    slurryMat
  );
  slurry.position.y = H - 0.2;
  slurry.userData.basePhase = Math.random() * Math.PI * 2;
  slurry.userData.baseY = H - 0.2;
  slurrySurfaces.push(slurry);
  group.add(slurry);

  /* Bubbles inside slurry — animated points */
  const bubbleGroup = buildBubblesField(R - 0.5, H - 0.5);
  group.add(bubbleGroup);

  /* Agitator */
  const agitator = buildAdvancedAgitator();
  agitator.position.y = H + 0.6;
  group.add(agitator);

  /* Support legs with anchor bolts */
  const legMat = new THREE.MeshStandardMaterial({
    color: 0x35383d, roughness: 0.7, metalness: 0.5,
  });
  for (let a = 0; a < 4; a++) {
    const ang = (a / 4) * Math.PI * 2 + Math.PI / 4;
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 1.4, 0.28),
      legMat
    );
    leg.position.set(Math.cos(ang) * (R - 0.15), -1.0, Math.sin(ang) * (R - 0.15));
    leg.castShadow = true;
    group.add(leg);

    // Anchor plate
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.08, 0.55),
      new THREE.MeshStandardMaterial({ color: 0x4a4d52, roughness: 0.6, metalness: 0.5 })
    );
    plate.position.set(Math.cos(ang) * (R - 0.15), -1.7, Math.sin(ang) * (R - 0.15));
    group.add(plate);

    // 4 anchor bolts on each plate
    const boltMat = new THREE.MeshStandardMaterial({ color: 0x9a9d9f, roughness: 0.3, metalness: 0.9 });
    for (let b = 0; b < 4; b++) {
      const bx = (b % 2 === 0 ? -0.18 : 0.18);
      const bz = (b < 2 ? -0.18 : 0.18);
      const bolt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.14, 8),
        boltMat
      );
      bolt.position.set(
        Math.cos(ang) * (R - 0.15) + bx,
        -1.65,
        Math.sin(ang) * (R - 0.15) + bz
      );
      group.add(bolt);
    }
  }

  /* Feed/discharge nozzles with flanges */
  const nozzleMat = new THREE.MeshStandardMaterial({
    color: 0x42454c, roughness: 0.45, metalness: 0.75,
  });
  const flangeMat = new THREE.MeshStandardMaterial({
    color: 0x5a5d62, roughness: 0.45, metalness: 0.85,
  });

  // Feed (left)
  const feed = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.32, 1.2, 24),
    nozzleMat
  );
  feed.rotation.z = Math.PI / 2;
  feed.position.set(-R - 0.6, 5.5, 0);
  feed.castShadow = true;
  group.add(feed);

  const feedFlange = new THREE.Mesh(
    new THREE.CylinderGeometry(0.48, 0.48, 0.1, 24),
    flangeMat
  );
  feedFlange.rotation.z = Math.PI / 2;
  feedFlange.position.set(-R - 1.15, 5.5, 0);
  group.add(feedFlange);

  // Discharge (right, lower)
  const discharge = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.32, 1.2, 24),
    nozzleMat
  );
  discharge.rotation.z = Math.PI / 2;
  discharge.position.set(R + 0.6, 2.2, 0);
  group.add(discharge);

  const dischargeFlange = feedFlange.clone();
  dischargeFlange.position.set(R + 1.15, 2.2, 0);
  group.add(dischargeFlange);

  /* Level gauge / sight glass on side */
  const gaugeMat = new THREE.MeshStandardMaterial({
    color: 0x2a2d33, roughness: 0.45, metalness: 0.7,
  });
  const gaugeBack = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 4.2, 0.32),
    gaugeMat
  );
  gaugeBack.position.set(-R - 0.05, 3.5, R * 0.7);
  group.add(gaugeBack);

  const gaugeGlass = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 4.0, 0.22),
    new THREE.MeshPhysicalMaterial({
      color: 0xa8c8e8, roughness: 0.05, metalness: 0.0,
      transmission: 0.92, thickness: 0.5, transparent: true,
      opacity: 0.6, clearcoat: 1.0,
    })
  );
  gaugeGlass.position.set(-R - 0.12, 3.5, R * 0.7);
  group.add(gaugeGlass);

  // Level indicator inside gauge (gold tint, animated later if wanted)
  const levelMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37, emissive: 0xd4af37, emissiveIntensity: 0.3,
  });
  const level = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 2.6, 0.2),
    levelMat
  );
  level.position.set(-R - 0.12, 2.5, R * 0.7);
  group.add(level);

  /* Vertical ladder */
  const ladder = buildLadder(H + 0.5);
  ladder.position.set(R + 0.05, 0.4, -R * 0.5);
  group.add(ladder);

  /* Stencil label */
  const stencil = makeStencilLabel(`HCG-CIL-${String(index).padStart(2, '0')}`);
  stencil.position.set(0, H * 0.65, R + 0.02);
  group.add(stencil);

  /* Round numbered badge below stencil */
  const badge = makeBadgeDisc(index);
  badge.position.set(0, H * 0.4, R + 0.02);
  group.add(badge);

  return group;
}

/* Slurry bubbles — animated translucent points */
function buildBubblesField(radius, surfaceY) {
  const group = new THREE.Group();
  const count = 12;                             // reduced from 28 for perf
  const geom = new THREE.SphereGeometry(0.08, 6, 6);   // lower-poly bubble
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xfff5d0,
    roughness: 0.1, metalness: 0.0,
    transmission: 0.7, thickness: 0.2,
    transparent: true, opacity: 0.7,
    emissive: 0xfff0c0, emissiveIntensity: 0.15,
  });

  for (let i = 0; i < count; i++) {
    const b = new THREE.Mesh(geom, mat);
    const r = Math.random() * radius;
    const a = Math.random() * Math.PI * 2;
    b.position.set(
      Math.cos(a) * r,
      Math.random() * (surfaceY - 1) + 1,
      Math.sin(a) * r
    );
    b.userData = {
      speed: 0.012 + Math.random() * 0.02,
      surfaceY,
      startX: b.position.x,
      startZ: b.position.z,
      wobble: Math.random() * Math.PI * 2,
      scale: 0.5 + Math.random() * 0.8,
    };
    b.scale.setScalar(b.userData.scale);
    animatedBubbles.push(b);
    group.add(b);
  }
  return group;
}

/* Advanced agitator: motor with cooling fins, gearbox, junction box, shaft */
function buildAdvancedAgitator() {
  const group = new THREE.Group();

  // Mounting platform
  const platformMat = new THREE.MeshStandardMaterial({
    color: 0x2a2d33, roughness: 0.6, metalness: 0.5,
  });
  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 0.18, 1.5),
    platformMat
  );
  platform.position.y = 0.9;
  platform.castShadow = true;
  group.add(platform);

  // Gearbox (reducer)
  const gearMat = new THREE.MeshStandardMaterial({
    color: 0x3a3d44, roughness: 0.5, metalness: 0.7,
  });
  const gearbox = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 1.1, 1.0),
    gearMat
  );
  gearbox.position.y = 1.6;
  gearbox.castShadow = true;
  group.add(gearbox);

  // Gearbox oil cap (small)
  const oilCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.1, 0.08, 16),
    new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.4, metalness: 0.7 })
  );
  oilCap.position.set(0, 2.2, 0);
  group.add(oilCap);

  // Motor body
  const motorMat = new THREE.MeshStandardMaterial({
    color: 0x1a3a6a, roughness: 0.55, metalness: 0.6,
  });
  const motor = new THREE.Mesh(
    new THREE.CylinderGeometry(0.52, 0.52, 1.4, 32),
    motorMat
  );
  motor.rotation.z = Math.PI / 2;
  motor.position.set(1.55, 1.6, 0);
  motor.castShadow = true;
  group.add(motor);

  // Cooling fins on motor
  const finMat = new THREE.MeshStandardMaterial({
    color: 0x1a3a6a, roughness: 0.5, metalness: 0.6,
  });
  for (let i = 0; i < 16; i++) {
    const ang = (i / 16) * Math.PI * 2;
    const fin = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 0.04, 0.12),
      finMat
    );
    fin.position.set(1.55, 1.6, 0);
    fin.rotation.x = ang;
    // displace outward
    const yOff = Math.sin(ang) * 0.6;
    const zOff = Math.cos(ang) * 0.6;
    fin.position.y = 1.6 + yOff;
    fin.position.z = zOff;
    group.add(fin);
  }

  // Motor end caps with gold accents
  const motorEndMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37, roughness: 0.35, metalness: 0.85,
  });
  const endCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.54, 0.54, 0.1, 32),
    motorEndMat
  );
  endCap.rotation.z = Math.PI / 2;
  endCap.position.set(2.3, 1.6, 0);
  group.add(endCap);

  // Fan cover at end
  const fanCover = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.55, 0.4, 24),
    new THREE.MeshStandardMaterial({ color: 0x35383d, roughness: 0.6, metalness: 0.5 })
  );
  fanCover.rotation.z = Math.PI / 2;
  fanCover.position.set(2.6, 1.6, 0);
  group.add(fanCover);

  // Junction box on motor
  const jBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.3, 0.45),
    new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.6, metalness: 0.4 })
  );
  jBox.position.set(1.4, 2.15, 0);
  group.add(jBox);

  // Conduit from junction box (vertical) up to cable tray at world y=9.6
  // Agitator group is attached to tank at world y = H+0.6 = 7.1 (i.e. local y=0 = world y=7.1)
  // Junction box local y = 2.15 → world 9.25. Cable tray world y = 9.6 → local y = 2.5
  // We want conduit running from jBox top (local y = 2.3) to slightly above local y = 2.6
  // with a small elbow turning toward -Z (cable tray is at z=-3.5, conduit needs to head back there)
  const conduitH = 1.0;
  const conduit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, conduitH, 10),
    new THREE.MeshStandardMaterial({ color: 0x35383d, roughness: 0.7, metalness: 0.4 })
  );
  conduit.position.set(1.4, 2.3 + conduitH / 2, 0);
  group.add(conduit);

  // Sphere joint at corner — vertical conduit meets horizontal run
  const conduitMat = new THREE.MeshStandardMaterial({ color: 0x35383d, roughness: 0.7, metalness: 0.4 });
  const conduitJoint = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 12, 10),
    conduitMat
  );
  conduitJoint.position.set(1.4, 2.3 + conduitH, 0);
  group.add(conduitJoint);

  // Horizontal conduit at the same y as the corner (no Y offset)
  const conduitHoriz = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 3.4, 10),
    conduitMat
  );
  conduitHoriz.rotation.x = Math.PI / 2;
  conduitHoriz.position.set(1.4, 2.3 + conduitH, -1.7);
  group.add(conduitHoriz);

  // Shaft + impeller (rotating)
  const rotor = new THREE.Group();
  const shaftMat = new THREE.MeshStandardMaterial({
    color: 0x8a8d93, roughness: 0.3, metalness: 0.95,
  });
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.13, 7.8, 16),
    shaftMat
  );
  shaft.position.y = -2.8;
  shaft.castShadow = true;
  rotor.add(shaft);

  const impMat = new THREE.MeshStandardMaterial({
    color: 0xa0a3a8, roughness: 0.35, metalness: 0.9,
  });
  const imp1 = buildImpellerProper(impMat);
  imp1.position.y = -0.5;
  rotor.add(imp1);

  const imp2 = buildImpellerProper(impMat);
  imp2.position.y = -5.5;
  rotor.add(imp2);

  group.add(rotor);
  animatedShafts.push(rotor);

  return group;
}

function buildImpellerProper(material) {
  const group = new THREE.Group();
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.32, 0.4, 16),
    material
  );
  hub.castShadow = true;
  group.add(hub);

  for (let i = 0; i < 4; i++) {
    const bladeGroup = new THREE.Group();
    bladeGroup.rotation.y = (i / 4) * Math.PI * 2;
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(1.55, 0.06, 0.5),
      material
    );
    blade.position.x = 0.9;
    blade.rotation.z = 0.4;
    blade.castShadow = true;
    bladeGroup.add(blade);
    group.add(bladeGroup);
  }
  return group;
}

function buildLadder(height) {
  const group = new THREE.Group();
  const railMat = new THREE.MeshStandardMaterial({
    color: 0xf5d76e, roughness: 0.45, metalness: 0.65,
  });
  const railGeom = new THREE.CylinderGeometry(0.04, 0.04, height, 8);
  const r1 = new THREE.Mesh(railGeom, railMat);
  r1.position.set(0, height / 2, 0.22);
  group.add(r1);
  const r2 = new THREE.Mesh(railGeom, railMat);
  r2.position.set(0, height / 2, -0.22);
  group.add(r2);

  const rungGeom = new THREE.CylinderGeometry(0.025, 0.025, 0.55, 8);
  const rungs = Math.floor(height / 0.4);
  for (let i = 0; i < rungs; i++) {
    const rung = new THREE.Mesh(rungGeom, railMat);
    rung.position.y = 0.3 + i * 0.4;
    rung.rotation.x = Math.PI / 2;
    group.add(rung);
  }

  // Safety cage hoops
  const hoopMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37, roughness: 0.5, metalness: 0.6,
  });
  for (let i = 0; i < Math.floor(height / 1.2); i++) {
    const hoop = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.025, 6, 24, Math.PI * 1.2),
      hoopMat
    );
    hoop.position.y = 0.8 + i * 1.2;
    hoop.rotation.y = Math.PI / 2;
    hoop.rotation.z = Math.PI;
    group.add(hoop);
  }

  return group;
}

/* Stencil label using canvas texture */
function makeStencilLabel(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');

  // Transparent background, stencil-style text
  ctx.fillStyle = '#f5d76e';
  ctx.font = 'bold 56px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Subtle paint drip effect
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  ctx.fillText(text, 256, 48);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;

  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
  });
  const w = 2.4;
  const h = w * (96 / 512);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  return plane;
}

/* Round numbered badge */
function makeBadgeDisc(number) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createRadialGradient(128, 128, 30, 128, 128, 128);
  grad.addColorStop(0, '#f5d76e');
  grad.addColorStop(0.7, '#d4af37');
  grad.addColorStop(1, '#8a6d1a');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(128, 128, 118, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(10, 22, 40, 0.5)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(128, 128, 96, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#0a1628';
  ctx.font = 'bold 130px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(number), 128, 132);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;

  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true,
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0), mat);
}

/* ============================ INTERSTAGE TRANSFERS ============================
 *  Each tank pair has:
 *  (a) SLURRY OVERFLOW pipe — from tank N discharge flange to tank N+1 feed flange.
 *      Connects EXACTLY to tank flange positions, with bolts.
 *  (b) CARBON AIRLIFT — vertical riser between tanks. Counter-current carbon flow:
 *      lifts carbon-loaded slurry from tank N+1 side screen, drops into tank N cap.
 *  ============================================================================ */
function buildInterstageTransfers() {
  const startX = -((CONFIG.tankCount - 1) * CONFIG.tankSpacing) / 2;
  const R = CONFIG.tankRadius;
  const spacing = CONFIG.tankSpacing;

  const pipeMat = new THREE.MeshStandardMaterial({
    color: 0x42454c, roughness: 0.4, metalness: 0.85,
  });
  const flangeMat = new THREE.MeshStandardMaterial({
    color: 0x5a5d62, roughness: 0.5, metalness: 0.85,
  });
  const boltMat = new THREE.MeshStandardMaterial({
    color: 0x9a9d9f, roughness: 0.3, metalness: 0.9,
  });
  const valveBodyMat = new THREE.MeshStandardMaterial({
    color: 0x5a3a1a, roughness: 0.6, metalness: 0.5,
  });
  const handleMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37, roughness: 0.4, metalness: 0.7,
  });
  const carbonMat = new THREE.MeshStandardMaterial({
    color: 0x6a5a2a, roughness: 0.45, metalness: 0.8,
    emissive: 0x2a1f08, emissiveIntensity: 0.15,
  });

  for (let i = 0; i < CONFIG.tankCount - 1; i++) {
    const xL = startX + i * spacing;            // tank N center
    const xR = startX + (i + 1) * spacing;      // tank N+1 center

    /* ---------- (a) SLURRY OVERFLOW PIPE ----------
     * Tank N's DISCHARGE flange (right side, y=2.2) → Tank N+1's FEED flange (left side, y=5.5)
     * The pipe rises across the gap. Realistic: discharge flange → 90° elbow up → vertical
     * rise → 90° elbow → horizontal → feed flange. We build it as 3 segments + 2 elbows.
     */

    const dischargeFlangeX = xL + R + 1.15;      // tank N discharge flange (outer x)
    const feedFlangeX      = xR - R - 1.15;      // tank N+1 feed flange (outer x)
    const yDischarge = 2.2;
    const yFeed = 5.5;

    // Segment 1: short horizontal from tank N discharge flange forward to elbow
    const seg1End = dischargeFlangeX + 0.9;
    const seg1 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, seg1End - dischargeFlangeX, 24),
      pipeMat
    );
    seg1.rotation.z = Math.PI / 2;
    seg1.position.set((dischargeFlangeX + seg1End) / 2, yDischarge, 0);
    seg1.castShadow = true;
    scene.add(seg1);

    // Bolted flange at tank N side
    const f1 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.44, 0.44, 0.1, 24),
      flangeMat
    );
    f1.rotation.z = Math.PI / 2;
    f1.position.set(dischargeFlangeX, yDischarge, 0);
    scene.add(f1);
    addFrontBolts(dischargeFlangeX + 0.02, yDischarge, 0, 0.36, 8);

    // Sphere joint at the LOWER corner (where seg1 meets seg2)
    addPipeJoint(seg1End, yDischarge, 0, 0.32, pipeMat);

    // Segment 2: vertical riser at x = seg1End (centerline meets BOTH corners)
    const seg2Length = yFeed - yDischarge;
    const seg2 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, seg2Length, 24),
      pipeMat
    );
    seg2.position.set(seg1End, (yDischarge + yFeed) / 2, 0);
    seg2.castShadow = true;
    scene.add(seg2);

    // Valve on the riser
    const valveBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.65, 0.5),
      valveBodyMat
    );
    valveBody.position.set(seg1End, (yDischarge + yFeed) / 2, 0);
    scene.add(valveBody);

    const valveStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.6, 8),
      boltMat
    );
    valveStem.position.set(seg1End, (yDischarge + yFeed) / 2 + 0.45, 0);
    scene.add(valveStem);

    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(0.17, 0.035, 8, 18),
      handleMat
    );
    handle.position.set(seg1End, (yDischarge + yFeed) / 2 + 0.75, 0);
    handle.rotation.x = Math.PI / 2;
    scene.add(handle);

    // Sphere joint at UPPER corner (where seg2 meets seg3)
    addPipeJoint(seg1End, yFeed, 0, 0.32, pipeMat);

    // Segment 3: horizontal from upper corner to tank N+1 feed flange
    const seg3Start = seg1End;
    const seg3End = feedFlangeX;
    const seg3Length = seg3End - seg3Start;
    const seg3 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, seg3Length, 24),
      pipeMat
    );
    seg3.rotation.z = Math.PI / 2;
    seg3.position.set((seg3Start + seg3End) / 2, yFeed, 0);
    seg3.castShadow = true;
    scene.add(seg3);

    // Bolted flange at tank N+1 side
    const f2 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.44, 0.44, 0.1, 24),
      flangeMat
    );
    f2.rotation.z = Math.PI / 2;
    f2.position.set(feedFlangeX, yFeed, 0);
    scene.add(f2);
    addFrontBolts(feedFlangeX - 0.02, yFeed, 0, 0.36, 8);

    // Pipe support stand under segment 3
    const supX = (seg3Start + seg3End) / 2;
    const stand = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, yFeed - 0.5, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x35383d, roughness: 0.7, metalness: 0.45 })
    );
    stand.position.set(supX, (yFeed - 0.5) / 2 + 0.5, 0);
    stand.castShadow = true;
    scene.add(stand);

    /* ---------- Animated flow marker on segment 3 ---------- */
    const fm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 0.5, 16),
      new THREE.MeshStandardMaterial({
        color: 0xd4af37, emissive: 0xd4af37,
        emissiveIntensity: 0.9, transparent: true, opacity: 0.85,
      })
    );
    fm.rotation.z = Math.PI / 2;
    fm.position.set(seg3Start, yFeed, 0);
    fm.userData = {
      startX: seg3Start, endX: seg3End,
      speed: 0.012 + Math.random() * 0.008,
      progress: Math.random(),
    };
    flowMarkers.push(fm);
    scene.add(fm);

    /* ---------- (b) CARBON AIRLIFT — counter-current flow ----------
     * Bottom: from tank N+1's LEFT side (carbon screen) at lower height
     * Vertical riser up
     * Top elbow — turns toward tank N (LEFT, -X direction)
     * Horizontal traverse over tanks
     * Down elbow into tank N's cap
     */
    const xAir = xR - R - 0.5;                 // base of airlift, just inside tank N+1 LEFT side
    const yAirBase = 3.2;                       // height of carbon screen pickup
    const yAirTop = 8.6;                        // above tank caps

    // Screen connection box on tank N+1 side
    const screenBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.55, 0.45),
      new THREE.MeshStandardMaterial({ color: 0x5a5d62, roughness: 0.55, metalness: 0.7 })
    );
    screenBox.position.set(xR - R - 0.22, yAirBase, 0);
    scene.add(screenBox);

    // Short horizontal pipe from screen to airlift base
    const airBottom = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.5, 16),
      carbonMat
    );
    airBottom.rotation.z = Math.PI / 2;
    airBottom.position.set(xR - R - 0.5, yAirBase, 0);
    scene.add(airBottom);

    // Vertical riser
    const airRiser = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, yAirTop - yAirBase, 16),
      carbonMat
    );
    airRiser.position.set(xAir, (yAirBase + yAirTop) / 2, 0);
    airRiser.castShadow = true;
    scene.add(airRiser);

    // Sphere joint at the TOP of airlift riser (corner)
    addPipeJoint(xAir, yAirTop, 0, 0.16, carbonMat);

    // Horizontal traverse over to tank N — centerline at y = yAirTop (matches corners)
    const traverseLen = (xAir - xL);
    const traverse = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, traverseLen, 16),
      carbonMat
    );
    traverse.rotation.z = Math.PI / 2;
    traverse.position.set((xL + xAir) / 2, yAirTop, 0);
    traverse.castShadow = true;
    scene.add(traverse);

    // Sphere joint at the OTHER corner (over tank N)
    addPipeJoint(xL, yAirTop, 0, 0.16, carbonMat);

    // Drop pipe at x = xL (centerline meets corner directly)
    const airDrop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, yAirTop - 6.9, 16),
      carbonMat
    );
    airDrop.position.set(xL, (yAirTop + 6.9) / 2, 0);
    scene.add(airDrop);

    // Entry boss on tank N cap
    const carbonBoss = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, 0.18, 14),
      new THREE.MeshStandardMaterial({ color: 0x42454c, roughness: 0.5, metalness: 0.7 })
    );
    carbonBoss.position.set(xL, 6.92, 0);
    scene.add(carbonBoss);
  }
}

/* Helper: place a spherical joint at a pipe corner (replaces 90° elbow).
 * Sphere of given radius covers the joint smoothly regardless of pipe directions.
 * Pipes that meet at this corner should extend all the way TO the corner point
 * (their centerlines should intersect at the sphere's center).
 */
function addPipeJoint(x, y, z, radius, material) {
  const joint = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.18, 16, 12),
    material
  );
  joint.position.set(x, y, z);
  joint.castShadow = true;
  scene.add(joint);
  return joint;
}

/* Helper: add visible bolts on a vertical flange ring (front-facing only) */
function addFrontBolts(x, y, z, ringRadius, count) {
  const boltMat = new THREE.MeshStandardMaterial({
    color: 0x9a9d9f, roughness: 0.3, metalness: 0.9,
  });
  for (let b = 0; b < count; b++) {
    const ang = (b / count) * Math.PI * 2;
    if (Math.cos(ang) < -0.15) continue;
    const bolt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.2, 8),
      boltMat
    );
    bolt.rotation.z = Math.PI / 2;
    bolt.position.set(x, y + Math.sin(ang) * ringRadius, z + Math.cos(ang) * ringRadius);
    scene.add(bolt);
  }
}

/* ============================ HEADER PIPEWORK ============================ */
function buildHeaderPipework() {
  const startX = -((CONFIG.tankCount - 1) * CONFIG.tankSpacing) / 2;
  const endX = -startX;
  const R = CONFIG.tankRadius;

  const headerMat = new THREE.MeshStandardMaterial({
    color: 0x6a5a2a, roughness: 0.45, metalness: 0.8,
    emissive: 0x2a1f08, emissiveIntensity: 0.18,
  });
  const slurryPipeMat = new THREE.MeshStandardMaterial({
    color: 0x42454c, roughness: 0.4, metalness: 0.85,
  });
  const flangeMat = new THREE.MeshStandardMaterial({
    color: 0x5a5d62, roughness: 0.5, metalness: 0.85,
  });
  const boltMat = new THREE.MeshStandardMaterial({
    color: 0x9a9d9f, roughness: 0.3, metalness: 0.9,
  });

  /* ===== REAGENT HEADER (NaCN + O2 dosing) — directly over tank centers ===== */
  const headerStart = startX - 3.5;          // extends past tank 1 to skid
  const headerEnd   = endX + 1.5;            // small overhang past tank 6
  const headerLength = headerEnd - headerStart;
  const headerY = 9.4;
  const headerCenterX = (headerStart + headerEnd) / 2;

  const header = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.26, headerLength, 24),
    headerMat
  );
  header.rotation.z = Math.PI / 2;
  header.position.set(headerCenterX, headerY, 0);
  header.castShadow = true;
  scene.add(header);

  // Drops, tees, valves — penetrate tank caps
  for (let i = 0; i < CONFIG.tankCount; i++) {
    const x = startX + i * CONFIG.tankSpacing;

    // Tee saddle on header (visible thicker section)
    const tee = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 0.42, 16),
      headerMat
    );
    tee.position.set(x, headerY, 0);
    scene.add(tee);

    // Valve body
    const valveBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.5, 0.36),
      new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.6, metalness: 0.5 })
    );
    valveBody.position.set(x, headerY - 0.55, 0);
    scene.add(valveBody);

    // Valve handle (gold)
    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(0.13, 0.025, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.4, metalness: 0.7 })
    );
    handle.position.set(x + 0.35, headerY - 0.55, 0);
    handle.rotation.y = Math.PI / 2;
    scene.add(handle);

    // Drop pipe — penetrates tank cap (top y = 7.0)
    const dropTopY = headerY - 0.82;          // below valve
    const dropBottomY = 6.8;                   // 0.2 into tank cap
    const dropLength = dropTopY - dropBottomY;
    const drop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.13, dropLength, 16),
      headerMat
    );
    drop.position.set(x, (dropTopY + dropBottomY) / 2, 0);
    drop.castShadow = true;
    scene.add(drop);

    // Drop entry boss on tank cap
    const boss = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.2, 16),
      new THREE.MeshStandardMaterial({ color: 0x42454c, roughness: 0.5, metalness: 0.7 })
    );
    boss.position.set(x, 6.9, 0);
    scene.add(boss);
  }

  /* ===== LEFT END: drops down to reagent skid ===== */
  // Sphere joint at the corner where header meets vertical riser
  addPipeJoint(headerStart, headerY, 0, 0.26, headerMat);

  // Vertical riser at x = headerStart (centerline meets corner)
  const leftRiserH = headerY - 1.6;       // skid top at y=1.6
  const leftRiser = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.26, leftRiserH, 16),
    headerMat
  );
  leftRiser.position.set(headerStart, (headerY + 1.6) / 2, 0);
  leftRiser.castShadow = true;
  scene.add(leftRiser);

  // Reagent skid
  const skid = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 1.6, 1.6),
    new THREE.MeshStandardMaterial({ color: 0x42454c, roughness: 0.6, metalness: 0.55 })
  );
  skid.position.set(headerStart - 0.5, 0.8, 0);
  skid.castShadow = true;
  skid.receiveShadow = true;
  scene.add(skid);

  // Skid label
  const skidLabel = makeStencilLabel('NaCN  +  O₂');
  skidLabel.scale.set(0.7, 0.7, 0.7);
  skidLabel.position.set(headerStart - 0.5, 0.9, 0.81);
  scene.add(skidLabel);

  // Skid pumps (two small dosing pumps on top)
  for (let p = -1; p <= 1; p += 2) {
    const dpump = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.3, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x1a3a6a, roughness: 0.5, metalness: 0.6 })
    );
    dpump.position.set(headerStart - 0.5 + p * 0.7, 1.75, 0);
    scene.add(dpump);

    const dmotor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.25, 16),
      new THREE.MeshStandardMaterial({ color: 0x2a4e8c, roughness: 0.55, metalness: 0.65 })
    );
    dmotor.rotation.z = Math.PI / 2;
    dmotor.position.set(headerStart - 0.5 + p * 0.7 + 0.35, 1.75, 0);
    scene.add(dmotor);
  }

  /* ===== RIGHT END: blind flange closure ===== */
  const rightCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.4, 0.12, 24),
    flangeMat
  );
  rightCap.rotation.z = Math.PI / 2;
  rightCap.position.set(headerEnd + 0.06, headerY, 0);
  scene.add(rightCap);
  // bolts on blind flange
  for (let b = 0; b < 6; b++) {
    const ang = (b / 6) * Math.PI * 2;
    const bolt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.18, 8),
      boltMat
    );
    bolt.rotation.z = Math.PI / 2;
    bolt.position.set(headerEnd + 0.05, headerY + Math.sin(ang) * 0.32, Math.cos(ang) * 0.32);
    scene.add(bolt);
  }

  /* ===== FEED INLET — connects to Tank 1 feed flange exactly ===== */
  const tank1FlangeX = startX - R - 1.15;    // tank's external flange position
  const inletEndX = tank1FlangeX - 0.06;     // bring inlet flange right up to it
  const inletStartX = inletEndX - 5.0;       // 5m feed line going off-frame left
  const inletCenterX = (inletStartX + inletEndX) / 2;
  const inletLength = inletEndX - inletStartX;
  const inletY = 5.5;

  const feedInlet = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.38, inletLength, 24),
    slurryPipeMat
  );
  feedInlet.rotation.z = Math.PI / 2;
  feedInlet.position.set(inletCenterX, inletY, 0);
  feedInlet.castShadow = true;
  scene.add(feedInlet);

  // Inlet flange matching tank flange (sandwich bolts visible)
  const inletFlange = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 0.1, 24),
    flangeMat
  );
  inletFlange.rotation.z = Math.PI / 2;
  inletFlange.position.set(inletEndX, inletY, 0);
  scene.add(inletFlange);

  // Bolts on inlet/tank flange joint (front-facing only)
  for (let b = 0; b < 8; b++) {
    const ang = (b / 8) * Math.PI * 2;
    if (Math.cos(ang) < -0.1) continue;     // skip back-side bolts
    const bolt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.22, 8),
      boltMat
    );
    bolt.rotation.z = Math.PI / 2;
    bolt.position.set(inletEndX - 0.04, inletY + Math.sin(ang) * 0.42, Math.cos(ang) * 0.42);
    scene.add(bolt);
  }

  // Pipe support stand at the offscreen end
  const inletSupport = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 5.5, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x35383d, roughness: 0.7, metalness: 0.45 })
  );
  inletSupport.position.set(inletStartX + 0.4, 2.75, 0);
  inletSupport.castShadow = true;
  scene.add(inletSupport);

  // FEED IN stencil
  const feedLabel = makeStencilLabel('FEED IN  →');
  feedLabel.position.set(inletStartX + 1.5, inletY + 1.0, 0);
  scene.add(feedLabel);

  /* ===== DISCHARGE OUTLET — connects to Tank 6 discharge flange exactly ===== */
  const tankNFlangeX = endX + R + 1.15;
  const outletStartX = tankNFlangeX + 0.06;
  const outletEndX = outletStartX + 5.0;
  const outletCenterX = (outletStartX + outletEndX) / 2;
  const outletLength = outletEndX - outletStartX;
  const outletY = 2.2;

  const outlet = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.35, outletLength, 24),
    slurryPipeMat
  );
  outlet.rotation.z = Math.PI / 2;
  outlet.position.set(outletCenterX, outletY, 0);
  outlet.castShadow = true;
  scene.add(outlet);

  // Outlet flange mating to tank flange
  const outletFlange = new THREE.Mesh(
    new THREE.CylinderGeometry(0.46, 0.46, 0.1, 24),
    flangeMat
  );
  outletFlange.rotation.z = Math.PI / 2;
  outletFlange.position.set(outletStartX, outletY, 0);
  scene.add(outletFlange);

  // Bolts on outlet flange
  for (let b = 0; b < 8; b++) {
    const ang = (b / 8) * Math.PI * 2;
    if (Math.cos(ang) < -0.1) continue;
    const bolt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.22, 8),
      boltMat
    );
    bolt.rotation.z = Math.PI / 2;
    bolt.position.set(outletStartX + 0.04, outletY + Math.sin(ang) * 0.38, Math.cos(ang) * 0.38);
    scene.add(bolt);
  }

  // Outlet support stand
  const outletSupport = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 2.2, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x35383d, roughness: 0.7, metalness: 0.45 })
  );
  outletSupport.position.set(outletEndX - 0.4, 1.1, 0);
  outletSupport.castShadow = true;
  scene.add(outletSupport);

  const dischargeLabel = makeStencilLabel('→  PLS OUT');
  dischargeLabel.position.set(outletEndX - 1.5, outletY + 1.0, 0);
  scene.add(dischargeLabel);
}

/* ============================ WALKWAY & RAILS ============================ */
function buildWalkwayAndRails() {
  const totalLength = (CONFIG.tankCount - 1) * CONFIG.tankSpacing + 6;

  // Walking platform (grated, gold color)
  const platMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37, roughness: 0.5, metalness: 0.55,
    emissive: 0xd4af37, emissiveIntensity: 0.06,
  });
  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(totalLength, 0.1, 1.8),
    platMat
  );
  platform.position.set(0, 7.05, 2.6);
  platform.castShadow = true;
  platform.receiveShadow = true;
  scene.add(platform);

  // Grating lines on platform (subtle stripes)
  const gratingMat = new THREE.MeshStandardMaterial({
    color: 0x8a6d1a, roughness: 0.7, metalness: 0.5,
  });
  const numStripes = Math.floor(totalLength * 4);
  for (let i = 0; i < numStripes; i++) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.02, 1.7),
      gratingMat
    );
    stripe.position.set(-totalLength / 2 + i * 0.25, 7.12, 2.6);
    scene.add(stripe);
  }

  // Railings — front and back sides
  const railMat = new THREE.MeshStandardMaterial({
    color: 0xf5d76e, roughness: 0.45, metalness: 0.6,
  });
  const kickPlateMat = new THREE.MeshStandardMaterial({
    color: 0x1a1410, roughness: 0.85, metalness: 0.2,
  });
  const kickStripeMat = new THREE.MeshStandardMaterial({
    color: 0xf5d76e, roughness: 0.5, metalness: 0.5,
  });

  for (let side = -1; side <= 1; side += 2) {
    const zRail = 2.6 + side * 0.9;

    // Top rail
    const topRail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, totalLength, 8),
      railMat
    );
    topRail.rotation.z = Math.PI / 2;
    topRail.position.set(0, 8.1, zRail);
    scene.add(topRail);

    // Mid rail
    const midRail = topRail.clone();
    midRail.position.y = 7.6;
    scene.add(midRail);

    // Kick plate
    const kickPlate = new THREE.Mesh(
      new THREE.BoxGeometry(totalLength, 0.18, 0.04),
      kickPlateMat
    );
    kickPlate.position.set(0, 7.22, zRail);
    scene.add(kickPlate);

    // Black/gold caution stripe on kick plate
    const stripeRow = new THREE.Mesh(
      new THREE.BoxGeometry(totalLength, 0.04, 0.05),
      kickStripeMat
    );
    stripeRow.position.set(0, 7.28, zRail);
    scene.add(stripeRow);

    // Vertical posts
    const numPosts = Math.floor(totalLength / 1.8) + 1;
    for (let i = 0; i < numPosts; i++) {
      const x = -totalLength / 2 + i * (totalLength / (numPosts - 1));
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 1.05, 8),
        railMat
      );
      post.position.set(x, 7.6, zRail);
      scene.add(post);
    }
  }

  // ===== Side stair — enters walkway from LEFT END (X direction)
  // No railing in the way — walkway's X-ends are open by design.
  const stairFrameMat = new THREE.MeshStandardMaterial({
    color: 0x35383d, roughness: 0.65, metalness: 0.5,
  });
  const stepMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37, roughness: 0.55, metalness: 0.55,
  });
  const platformY = 7.05;
  const numSteps = 10;
  const stepRise = (platformY - 0.5) / numSteps;   // ≈ 0.655
  const stepRun = 0.34;
  // Stair runs along Z = walkway centerline (z = 2.6), going in +X direction as it climbs
  const stairZ = 2.6;
  const stairTopX = -totalLength / 2 + 0.5;        // arrives just inside walkway left end
  const stairBottomX = stairTopX - numSteps * stepRun;  // ≈ left of walkway end

  // Steps: each is wider in Z (walkway-width), shorter in X (step run)
  for (let i = 0; i < numSteps; i++) {
    const stepX = stairBottomX + (i + 0.5) * stepRun;
    const stepY = 0.5 + (i + 0.5) * stepRise;
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(stepRun + 0.04, 0.08, 1.4),
      stepMat
    );
    step.position.set(stepX, stepY, stairZ);
    step.castShadow = true;
    step.receiveShadow = true;
    scene.add(step);

    // Vertical riser face under each step (dark) — covers back of step
    const riser = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, stepRise, 1.4),
      stairFrameMat
    );
    riser.position.set(stepX - stepRun / 2, stepY - stepRise / 2 + 0.04, stairZ);
    scene.add(riser);
  }

  // Stair stringers (diagonal side beams) — one on +Z side, one on -Z side
  const stringerLength = Math.hypot(numSteps * stepRise, numSteps * stepRun);
  const stringerAngle = Math.atan2(numSteps * stepRise, numSteps * stepRun);
  for (let side = -1; side <= 1; side += 2) {
    const stringer = new THREE.Mesh(
      new THREE.BoxGeometry(stringerLength, 0.4, 0.1),
      stairFrameMat
    );
    stringer.position.set(
      (stairBottomX + stairTopX) / 2,
      0.5 + (numSteps * stepRise) / 2 - 0.15,
      stairZ + side * 0.75
    );
    // Tilt around Z axis so beam slopes from bottom-low to top-high
    stringer.rotation.z = stringerAngle;
    stringer.castShadow = true;
    scene.add(stringer);
  }

  // Handrails (both Z sides) — follow the slope
  for (let side = -1; side <= 1; side += 2) {
    const handRail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, stringerLength + 0.4, 8),
      railMat
    );
    handRail.position.set(
      (stairBottomX + stairTopX) / 2,
      0.5 + (numSteps * stepRise) / 2 + 1.0,
      stairZ + side * 0.75
    );
    // Rail's natural axis is Y. Rotate around Z to align with stair slope.
    handRail.rotation.z = Math.PI / 2 + stringerAngle;
    scene.add(handRail);

    // Bottom newel post (vertical from ground)
    const postBot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 1.4, 8),
      railMat
    );
    postBot.position.set(stairBottomX - 0.1, 1.2, stairZ + side * 0.75);
    scene.add(postBot);

    // Top newel post — sits on platform
    const postTop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 1.0, 8),
      railMat
    );
    postTop.position.set(stairTopX, platformY + 0.55, stairZ + side * 0.75);
    scene.add(postTop);
  }

  // Landing plate at top — sits ON walkway, at left end (where no railing blocks)
  const landing = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.1, 1.5),
    stepMat
  );
  landing.position.set(stairTopX + 0.4, platformY, stairZ);
  landing.castShadow = true;
  landing.receiveShadow = true;
  scene.add(landing);
}

/* ============================ PUMP STATION ============================
 *  One transfer pump per tank, aligned x with tank center.
 *  Each pump: suction = horizontal line from tank lower side drain → into pump
 *             discharge = vertical UP, 90° elbow back to tank, into mid-side return port
 *  ============================================================================ */
function buildPumpStation() {
  const startX = -((CONFIG.tankCount - 1) * CONFIG.tankSpacing) / 2;
  const R = CONFIG.tankRadius;
  const pumpZ = 5.6;            // pump skid Z position (front of platform)
  const sucY = 0.85;            // suction line height
  const retY = 3.6;             // discharge return line height (mid-tank-side)

  for (let i = 0; i < CONFIG.tankCount; i++) {
    const x = startX + i * CONFIG.tankSpacing;

    // The pump (volute centered at world x, so we offset the group by +0.7 since volute is at -0.7 local)
    const pump = buildPump(i + 1);
    pump.position.set(x + 0.7, 0, pumpZ);
    scene.add(pump);

    // ---- Suction line: tank lower side drain → pump suction ----
    addTankToPumpSuction(x, sucY, pumpZ, R);

    // ---- Discharge line: pump discharge → up + back to tank mid-side return ----
    addPumpToTankReturn(x, retY, pumpZ, R);
  }
}

function addTankToPumpSuction(tankX, y, pumpZ, R) {
  const pipeMat = new THREE.MeshStandardMaterial({ color: 0x42454c, roughness: 0.4, metalness: 0.85 });
  const flangeMat = new THREE.MeshStandardMaterial({ color: 0x5a5d62, roughness: 0.5, metalness: 0.85 });
  const valveMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.6, metalness: 0.5 });
  const handleMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.4, metalness: 0.7 });

  // Tank-side drain port (small flange box on tank cylinder front)
  const tankZ = R;                            // tank front face at z = R
  const drainBoss = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.4, 16),
    flangeMat
  );
  drainBoss.rotation.x = Math.PI / 2;
  drainBoss.position.set(tankX, y, tankZ + 0.2);
  scene.add(drainBoss);

  // Tank drain flange (where pipe joins tank)
  const tankFlange = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.32, 0.08, 18),
    flangeMat
  );
  tankFlange.rotation.x = Math.PI / 2;
  tankFlange.position.set(tankX, y, tankZ + 0.42);
  scene.add(tankFlange);

  // Drain isolation valve right after tank
  const valveBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.55, 0.4),
    valveMat
  );
  valveBody.position.set(tankX, y, tankZ + 0.78);
  scene.add(valveBody);

  const valveStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.4, 8),
    new THREE.MeshStandardMaterial({ color: 0x9a9d9f, roughness: 0.3, metalness: 0.9 })
  );
  valveStem.position.set(tankX, y + 0.45, tankZ + 0.78);
  scene.add(valveStem);

  const handle = new THREE.Mesh(
    new THREE.TorusGeometry(0.13, 0.025, 8, 16),
    handleMat
  );
  handle.position.set(tankX, y + 0.65, tankZ + 0.78);
  handle.rotation.x = Math.PI / 2;
  scene.add(handle);

  // Long horizontal pipe from valve to pump suction
  const pipeStart = tankZ + 1.0;
  const pipeEnd = pumpZ - 0.5;                // pump suction port at pumpZ - 0.5
  const pipeLength = pipeEnd - pipeStart;
  const pipe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, pipeLength, 18),
    pipeMat
  );
  pipe.rotation.x = Math.PI / 2;
  pipe.position.set(tankX, y, (pipeStart + pipeEnd) / 2);
  pipe.castShadow = true;
  scene.add(pipe);

  // Pump-side flange where pipe meets pump suction
  const pumpFlange = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 0.08, 18),
    flangeMat
  );
  pumpFlange.rotation.x = Math.PI / 2;
  pumpFlange.position.set(tankX, y, pipeEnd + 0.04);
  scene.add(pumpFlange);

  // Pipe support stand mid-way
  const standZ = (pipeStart + pipeEnd) / 2;
  const stand = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, y - 0.1, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x35383d, roughness: 0.7, metalness: 0.45 })
  );
  stand.position.set(tankX, (y - 0.1) / 2 + 0.1, standZ);
  stand.castShadow = true;
  scene.add(stand);
}

function addPumpToTankReturn(tankX, y, pumpZ, R) {
  const pipeMat = new THREE.MeshStandardMaterial({ color: 0x42454c, roughness: 0.4, metalness: 0.85 });
  const flangeMat = new THREE.MeshStandardMaterial({ color: 0x5a5d62, roughness: 0.5, metalness: 0.85 });
  const tankZ = R;

  // Pump discharge stub already exits top of volute at (tankX, 1.4, pumpZ)
  const dischargeStart_y = 1.4;
  const elbow_y = y;       // height where we elbow toward tank

  // Vertical riser from pump discharge to return-line height
  const riserHeight = elbow_y - dischargeStart_y;
  const riser = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, riserHeight, 18),
    pipeMat
  );
  riser.position.set(tankX, (dischargeStart_y + elbow_y) / 2, pumpZ);
  riser.castShadow = true;
  scene.add(riser);

  // Discharge pressure gauge midway up the riser
  const gFace = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, 0.04, 24),
    new THREE.MeshStandardMaterial({ color: 0xf5f1e8, roughness: 0.4, metalness: 0.1 })
  );
  gFace.rotation.x = Math.PI / 2;
  gFace.position.set(tankX + 0.21, (dischargeStart_y + elbow_y) / 2, pumpZ);
  gFace.rotation.z = Math.PI / 2;
  scene.add(gFace);

  // Sphere joint at corner (where riser meets horizontal return line)
  addPipeJoint(tankX, elbow_y, pumpZ, 0.18, pipeMat);

  // Horizontal pipe centerline at y = elbow_y (NO offset — meets joint directly)
  const horizStart = pumpZ;
  const horizEnd = tankZ + 0.2;
  const horiz = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, horizStart - horizEnd, 18),
    pipeMat
  );
  horiz.rotation.x = Math.PI / 2;
  horiz.position.set(tankX, elbow_y, (horizStart + horizEnd) / 2);
  horiz.castShadow = true;
  scene.add(horiz);

  // Check valve in middle of return line
  const checkValve = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.42, 0.42),
    new THREE.MeshStandardMaterial({ color: 0x4a3a1a, roughness: 0.6, metalness: 0.55 })
  );
  checkValve.position.set(tankX, elbow_y, (horizStart + horizEnd) / 2 + 0.5);
  scene.add(checkValve);

  // Return boss on tank cylinder (at same y as horizontal line)
  const retBoss = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.36, 16),
    new THREE.MeshStandardMaterial({ color: 0x42454c, roughness: 0.5, metalness: 0.7 })
  );
  retBoss.rotation.x = Math.PI / 2;
  retBoss.position.set(tankX, elbow_y, tankZ + 0.18);
  scene.add(retBoss);

  // Return flange
  const retFlange = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.08, 18),
    flangeMat
  );
  retFlange.rotation.x = Math.PI / 2;
  retFlange.position.set(tankX, elbow_y, tankZ + 0.38);
  scene.add(retFlange);
}

/* buildPump — pump is built so volute is at local x=-0.7. When placed in world,
 * the parent places this at (tankX + 0.7, 0, pumpZ) so volute ends up at tankX.
 * Suction stub points -Z (toward tank), discharge stub points +Y (will be elbowed externally).
 */
function buildPump(_pumpNumber) {
  const group = new THREE.Group();

  // Skid base
  const skidMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37, roughness: 0.5, metalness: 0.55,
  });
  const skid = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 0.2, 1.4),
    skidMat
  );
  skid.position.y = 0.1;
  skid.castShadow = true;
  skid.receiveShadow = true;
  group.add(skid);

  // Pump volute
  const pumpMat = new THREE.MeshStandardMaterial({
    color: 0x1a3a6a, roughness: 0.5, metalness: 0.65,
  });
  const volute = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.55, 0.75, 32),
    pumpMat
  );
  volute.rotation.z = Math.PI / 2;
  volute.position.set(-0.7, 0.85, 0);
  volute.castShadow = true;
  group.add(volute);

  const flangeMat = new THREE.MeshStandardMaterial({
    color: 0x5a5d62, roughness: 0.5, metalness: 0.85,
  });

  // Suction stub pointing -Z (toward tank)
  const suctionStub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 0.5, 16),
    new THREE.MeshStandardMaterial({ color: 0x42454c, roughness: 0.4, metalness: 0.8 })
  );
  suctionStub.rotation.x = Math.PI / 2;
  suctionStub.position.set(-0.7, 0.85, -0.5);
  group.add(suctionStub);

  // Suction flange at the end of the stub (will mate with incoming pipe)
  const sucFlange = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 0.08, 18),
    flangeMat
  );
  sucFlange.rotation.x = Math.PI / 2;
  sucFlange.position.set(-0.7, 0.85, -0.79);
  group.add(sucFlange);

  // Discharge stub going UP from top of volute (externally elbowed back to tank)
  const dischargeStub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 0.5, 16),
    new THREE.MeshStandardMaterial({ color: 0x42454c, roughness: 0.4, metalness: 0.8 })
  );
  dischargeStub.position.set(-0.7, 1.4, 0);
  group.add(dischargeStub);

  // Discharge flange on top of stub
  const disFlange = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.26, 0.08, 18),
    flangeMat
  );
  disFlange.position.set(-0.7, 1.68, 0);
  group.add(disFlange);

  // Coupling between volute and motor
  const coupling = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 0.45, 16),
    new THREE.MeshStandardMaterial({ color: 0x6a6d72, roughness: 0.3, metalness: 0.9 })
  );
  coupling.rotation.z = Math.PI / 2;
  coupling.position.set(0.0, 0.85, 0);
  group.add(coupling);

  // Motor body
  const motorMat = new THREE.MeshStandardMaterial({
    color: 0x2a4e8c, roughness: 0.5, metalness: 0.6,
  });
  const motor = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.4, 1.1, 24),
    motorMat
  );
  motor.rotation.z = Math.PI / 2;
  motor.position.set(0.85, 0.85, 0);
  motor.castShadow = true;
  group.add(motor);

  // Cooling fins
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2;
    const fin = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.03, 0.08),
      motorMat
    );
    fin.position.set(0.85, 0.85 + Math.sin(ang) * 0.46, Math.cos(ang) * 0.46);
    fin.rotation.x = ang;
    group.add(fin);
  }

  // Fan cover at far end
  const fanCover = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.42, 0.32, 24),
    new THREE.MeshStandardMaterial({ color: 0x35383d, roughness: 0.6, metalness: 0.5 })
  );
  fanCover.rotation.z = Math.PI / 2;
  fanCover.position.set(1.45, 0.85, 0);
  group.add(fanCover);

  // Motor junction box
  const jbox = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.22, 0.32),
    new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.65, metalness: 0.45 })
  );
  jbox.position.set(0.75, 1.32, 0);
  group.add(jbox);

  // Motor power conduit (small) — short stub to cable tray (cable tray external)
  const conduit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 1.2, 8),
    new THREE.MeshStandardMaterial({ color: 0x35383d, roughness: 0.7, metalness: 0.4 })
  );
  conduit.position.set(0.75, 2.0, 0);
  group.add(conduit);

  return group;
}

/* ============================ AUXILIARIES ============================ */
function buildAuxiliaries() {
  // Cable tray running along back
  const cableTrayMat = new THREE.MeshStandardMaterial({
    color: 0x5a5d62, roughness: 0.6, metalness: 0.5,
  });
  const totalLength = (CONFIG.tankCount - 1) * CONFIG.tankSpacing + 6;
  const tray = new THREE.Mesh(
    new THREE.BoxGeometry(totalLength, 0.12, 0.45),
    cableTrayMat
  );
  tray.position.set(0, 9.6, -3.5);
  scene.add(tray);

  // Some cables inside tray (sagging lines, simplified)
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.8 });
  for (let i = 0; i < 3; i++) {
    const cable = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, totalLength, 8),
      cableMat
    );
    cable.rotation.z = Math.PI / 2;
    cable.position.set(0, 9.66, -3.5 + (i - 1) * 0.1);
    scene.add(cable);
  }

  // Junction boxes spaced along cable tray
  const jboxMat = new THREE.MeshStandardMaterial({
    color: 0x35383d, roughness: 0.65, metalness: 0.5,
  });
  for (let i = 0; i < 2; i++) {
    const x = -totalLength / 4 + i * (totalLength / 2);
    const jbox = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.5, 0.6),
      jboxMat
    );
    jbox.position.set(x, 9.95, -3.5);
    scene.add(jbox);
  }

  // ===== Cable tray LEFT terminator: MCC (Motor Control Center) cabinet =====
  const mccMat = new THREE.MeshStandardMaterial({
    color: 0x42454c, roughness: 0.6, metalness: 0.55,
  });
  const mcc = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 2.6, 1.0),
    mccMat
  );
  mcc.position.set(-totalLength / 2 - 0.6, 1.3, -3.5);
  mcc.castShadow = true;
  scene.add(mcc);

  // MCC door panel (slightly lighter)
  const mccDoor = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 2.2, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x5a5d62, roughness: 0.55, metalness: 0.5 })
  );
  mccDoor.position.set(-totalLength / 2 - 0.6, 1.4, -3.0);
  scene.add(mccDoor);

  // Status indicator lights (3 small emissive dots)
  for (let i = 0; i < 3; i++) {
    const color = i === 0 ? 0x22c55e : (i === 1 ? 0xfacc15 : 0xef4444);
    const light = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.04, 12),
      new THREE.MeshStandardMaterial({
        color, emissive: color, emissiveIntensity: 0.8,
      })
    );
    light.rotation.x = Math.PI / 2;
    light.position.set(-totalLength / 2 - 0.6 + (i - 1) * 0.15, 2.2, -2.97);
    scene.add(light);
  }

  // MCC label
  const mccLabel = makeStencilLabel('M.C.C-01');
  mccLabel.scale.set(0.5, 0.5, 0.5);
  mccLabel.position.set(-totalLength / 2 - 0.6, 0.5, -2.97);
  scene.add(mccLabel);

  // Vertical conduit from cable tray DOWN into MCC top
  const trayToMccConduit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 7.0, 12),
    new THREE.MeshStandardMaterial({ color: 0x35383d, roughness: 0.7, metalness: 0.4 })
  );
  trayToMccConduit.position.set(-totalLength / 2 - 0.6, 6.1, -3.5);
  scene.add(trayToMccConduit);

  // Sphere joint at corner — vertical MCC conduit meets cable tray
  const trayJointMat = new THREE.MeshStandardMaterial({ color: 0x35383d, roughness: 0.7, metalness: 0.4 });
  const trayJoint = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 14, 10),
    trayJointMat
  );
  trayJoint.position.set(-totalLength / 2 - 0.6, 9.6, -3.5);
  scene.add(trayJoint);

  // ===== Cable tray RIGHT terminator: small field junction box / future expansion =====
  const fieldBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 1.0, 0.8),
    mccMat
  );
  fieldBox.position.set(totalLength / 2 + 0.6, 9.0, -3.5);
  fieldBox.castShadow = true;
  scene.add(fieldBox);

  // Right-end sphere joint (cable tray end → field junction box)
  const rightTrayJoint = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 14, 10),
    new THREE.MeshStandardMaterial({ color: 0x35383d, roughness: 0.7, metalness: 0.4 })
  );
  rightTrayJoint.position.set(totalLength / 2 + 0.6, 9.6, -3.5);
  scene.add(rightTrayJoint);
}

/* ============================ ATMOSPHERIC GLOW ============================ */
function buildAtmosphericGlow() {
  // Very subtle gold tint over ground (additive, almost invisible against light bg)
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xd4af37,
    transparent: true,
    opacity: 0.025,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 26),
    glowMat
  );
  glow.position.y = 0.05;
  glow.rotation.x = -Math.PI / 2;
  scene.add(glow);
}

/* ============================ ANIMATION LOOP ============================ */
function startRendering() {
  if (frameId !== null) return;     // already running
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

  const t = performance.now() * 0.001;

  // Spin impellers
  for (const rotor of animatedShafts) {
    rotor.rotation.y += 0.022;
  }

  // Animate bubbles
  for (const b of animatedBubbles) {
    b.position.y += b.userData.speed;
    b.userData.wobble += 0.04;
    b.position.x = b.userData.startX + Math.sin(b.userData.wobble) * 0.06;
    b.position.z = b.userData.startZ + Math.cos(b.userData.wobble) * 0.06;
    if (b.position.y > b.userData.surfaceY) {
      b.position.y = 1.0;
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * (CONFIG.tankRadius - 0.5);
      b.userData.startX = Math.cos(a) * r;
      b.userData.startZ = Math.sin(a) * r;
      b.position.x = b.userData.startX;
      b.position.z = b.userData.startZ;
    }
  }

  // Animate flow markers in pipes
  for (const fm of flowMarkers) {
    fm.userData.progress += fm.userData.speed;
    if (fm.userData.progress > 1) fm.userData.progress = 0;
    fm.position.x = fm.userData.startX + (fm.userData.endX - fm.userData.startX) * fm.userData.progress;
    // Pulse emissive
    fm.material.emissiveIntensity = 0.6 + Math.sin(t * 5 + fm.userData.progress * 10) * 0.3;
  }

  // Slurry surface gentle wobble
  for (const s of slurrySurfaces) {
    s.position.y = s.userData.baseY + Math.sin(t * 1.5 + s.userData.basePhase) * 0.02;
  }

  // Idle auto-rotate
  if (autoRotateEnabled && (Date.now() - lastUserInteraction) > 5000) {
    const radius = Math.hypot(camera.position.x, camera.position.z);
    const angle = Math.atan2(camera.position.z, camera.position.x) + 0.0015;
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

window.addEventListener('slidechange', (e) => {
  if (e.detail.index === 2) {
    init();
    setTimeout(onResize, 50);
    startRendering();
  } else {
    // User left slide 3 — pause render loop to free up CPU/GPU
    stopRendering();
  }
});

if (document.querySelector('.slide[data-slide="3"]')?.classList.contains('active')) {
  init();
  startRendering();
}
