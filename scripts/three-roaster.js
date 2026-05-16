import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* ===================================================================
 * Hikmet Çetin Gold — Procedural 3D Fluidized Bed Roasting Furnace
 * Akışkan Yataklı Kavurma Fırını
 *
 * REBUILT to match the firm's reference illustration as closely as
 * possible. The reference shows, from LEFT to RIGHT, on a concrete
 * plinth and steel platform:
 *   1. Akıskan Yatak Reaktörü  — tall cylinder with conical hopper
 *   2. Atık Isı Kazanı box     — rectangular heat exchanger with grid
 *   3. Siklon                   — cylinder over deep cone
 *   4. Gaz Soğutucu             — domed cylinder
 *   5. Kurutma Kulesi           — slim tower with green band
 *   6. Konvertör                — slim tower with green band
 *   7. Absorpsiyon Kulesi       — short squat tower
 *   8. Sülfürik Asit Tankı      — tallest tower with green bands
 * All tied by yellow process pipes at roof level and a horizontal
 * yellow pipe running across the deck at mid-height.
 * =================================================================== */

const CONFIG = {
  slideIndex: 11,
};

let renderer, scene, camera, controls;
let canvas;
let initialized = false;
let frameId = null;
let lastUserInteraction = Date.now();
let autoRotateEnabled = true;

const smokeParticles = [];
const flowMarkers = [];

let plant;

/* ============================ MATERIALS ============================ */
const MAT = {
  steel: new THREE.MeshStandardMaterial({
    color: 0xbfc3c6, roughness: 0.45, metalness: 0.82,
  }),
  steelDark: new THREE.MeshStandardMaterial({
    color: 0x8e9498, roughness: 0.5, metalness: 0.75,
  }),
  steelLight: new THREE.MeshStandardMaterial({
    color: 0xd3d6d9, roughness: 0.40, metalness: 0.82,
  }),
  greenBand: new THREE.MeshStandardMaterial({
    color: 0x4d8a5f, roughness: 0.5, metalness: 0.4,
  }),
  yellowPipe: new THREE.MeshStandardMaterial({
    color: 0xe8c449, roughness: 0.5, metalness: 0.5,
  }),
  concrete: new THREE.MeshStandardMaterial({
    color: 0xbfbbb0, roughness: 0.97, metalness: 0.02,
  }),
  concreteDark: new THREE.MeshStandardMaterial({
    color: 0x9d9a90, roughness: 0.97, metalness: 0.02,
  }),
  deckSteel: new THREE.MeshStandardMaterial({
    color: 0x55585c, roughness: 0.7, metalness: 0.55,
  }),
  yellowRail: new THREE.MeshStandardMaterial({
    color: 0xf2c845, roughness: 0.55, metalness: 0.4,
  }),
  motor: new THREE.MeshStandardMaterial({
    color: 0x2e6bb5, roughness: 0.55, metalness: 0.35,
  }),
  black: new THREE.MeshStandardMaterial({
    color: 0x222428, roughness: 0.55, metalness: 0.3,
  }),
};

/* ============================ INIT ============================ */
function init(targetCanvas) {
  if (initialized) return;
  initialized = true;

  canvas = targetCanvas || document.getElementById('three-canvas-roaster');
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
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  scene = new THREE.Scene();
  scene.background = null;
  scene.fog = new THREE.FogExp2(0xece6d4, 0.006);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  // Camera framed wide, slightly elevated, looking down the line — matches
  // the reference image's three-quarter front-right perspective.
  camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 220);
  camera.position.set(20, 11.5, 28);
  camera.lookAt(0, 5.0, 0);

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 16;
  controls.maxDistance = 70;
  controls.minPolarAngle = Math.PI * 0.12;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.target.set(0, 5.0, 0);
  controls.addEventListener('start', () => {
    lastUserInteraction = Date.now();
    autoRotateEnabled = false;
  });
  controls.addEventListener('end', () => {
    lastUserInteraction = Date.now();
    setTimeout(() => { autoRotateEnabled = true; }, 5000);
  });

  plant = new THREE.Group();
  scene.add(plant);

  setupLights();
  buildGround();
  buildPlatform();
  buildVessels();
  buildRoofPiping();
  buildDeckPiping();
  buildAuxiliaries();
  buildAtmospherics();

  window.addEventListener('resize', onResize);
  window.addEventListener('slidechange', (e) => {
    if (e.detail.index === CONFIG.slideIndex) onResize();
  });
}

/* ============================ LIGHTING ============================ */
function setupLights() {
  const hemi = new THREE.HemisphereLight(0xfff4e2, 0x4a4030, 0.65);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffffff, 1.85);
  key.position.set(20, 26, 14);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -28;
  key.shadow.camera.right = 28;
  key.shadow.camera.top = 22;
  key.shadow.camera.bottom = -10;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 70;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0xa8c0e0, 0.45);
  rim.position.set(-18, 12, -14);
  scene.add(rim);

  const fill = new THREE.DirectionalLight(0xfff0c0, 0.32);
  fill.position.set(-6, 6, 16);
  scene.add(fill);
}

/* ============================ GROUND + PLATFORM ============================
 * Three concrete plinths (left, center-right with cut-out, far right) on a
 * pale ground. The plinths step up to a steel deck where the slim towers
 * stand. This mirrors the reference image's foundation arrangement.
 */
function buildGround() {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 60),
    new THREE.MeshStandardMaterial({ color: 0xeae3d0, roughness: 1, metalness: 0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  ground.receiveShadow = true;
  scene.add(ground);
}

function buildPlatform() {
  // Main plinth — concrete pad running under the full equipment train.
  const mainPad = new THREE.Mesh(
    new THREE.BoxGeometry(28, 0.45, 8),
    MAT.concrete
  );
  mainPad.position.set(0, 0.225, 0);
  mainPad.receiveShadow = true;
  mainPad.castShadow = true;
  plant.add(mainPad);

  // Lower kerb running along front edge (subtle step-down on reference)
  const kerb = new THREE.Mesh(
    new THREE.BoxGeometry(28, 0.18, 0.4),
    MAT.concreteDark
  );
  kerb.position.set(0, 0.09, 4.0);
  plant.add(kerb);

  // Left plinth pedestal — taller block under the reactor
  const leftPlinth = new THREE.Mesh(
    new THREE.BoxGeometry(5.2, 0.7, 5.4),
    MAT.concrete
  );
  leftPlinth.position.set(-11.3, 0.35 + 0.45, 0);
  leftPlinth.receiveShadow = true;
  leftPlinth.castShadow = true;
  plant.add(leftPlinth);

  // Left plinth — second stepped tier (slightly narrower, taller block on top)
  const leftStep = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 0.25, 4.2),
    MAT.concreteDark
  );
  leftStep.position.set(-11.6, 0.7 + 0.45 + 0.125, 0);
  plant.add(leftStep);

  // Right plinth — under absorption + acid tank (bigger, taller in reference)
  const rightPlinth = new THREE.Mesh(
    new THREE.BoxGeometry(8.2, 0.7, 5.4),
    MAT.concrete
  );
  rightPlinth.position.set(10.0, 0.35 + 0.45, 0);
  rightPlinth.receiveShadow = true;
  rightPlinth.castShadow = true;
  plant.add(rightPlinth);

  // Right plinth — sub-tier specifically under acid tank (taller)
  const acidPlinth = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 0.3, 4.2),
    MAT.concreteDark
  );
  acidPlinth.position.set(11.2, 0.7 + 0.45 + 0.15, 0);
  plant.add(acidPlinth);

  // Centre concrete pad gap between left + right plinths (slightly recessed,
  // creates the trench look in the reference)
  const trenchKerb = new THREE.Mesh(
    new THREE.BoxGeometry(15.6, 0.12, 0.25),
    MAT.concreteDark
  );
  trenchKerb.position.set(-0.4, 0.06, 3.85);
  plant.add(trenchKerb);

  // Steel deck spanning the middle (between left & right plinths) at
  // mid-height — holds cyclone/gas cooler/drying tower/converter.
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(14.5, 0.25, 4.4),
    MAT.deckSteel
  );
  deck.position.set(-0.4, 3.2, 0);
  deck.castShadow = true;
  deck.receiveShadow = true;
  plant.add(deck);

  // Deck under-bracing — diagonal/vertical steel posts
  const postMat = MAT.deckSteel;
  const posts = [
    [-6.8, -1.4], [-6.8, 1.4],
    [-2.4, -1.4], [-2.4, 1.4],
    [ 1.6, -1.4], [ 1.6, 1.4],
    [ 5.6, -1.4], [ 5.6, 1.4],
  ];
  for (const [px, pz] of posts) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 3.1, 0.22),
      postMat
    );
    post.position.set(px, 1.55, pz);
    post.castShadow = true;
    plant.add(post);
  }
  // Diagonal cross-braces (front face only, visible)
  for (let i = 0; i < 4; i++) {
    const x1 = [-6.8, -2.4, 1.6, 5.6][i];
    const x2 = [-2.4, 1.6, 5.6, 9.0][i];
    const brace = new THREE.Mesh(
      new THREE.BoxGeometry(Math.hypot(x2 - x1, 2.8), 0.1, 0.1),
      postMat
    );
    brace.position.set((x1 + x2) / 2, 1.65, 1.4);
    brace.rotation.z = Math.atan2(2.8, x2 - x1);
    plant.add(brace);
  }

  // Yellow handrails along the deck front
  addRailing(-7.2, 8.5, 3.45, 1.4);
  // Yellow handrails along the deck back
  addRailing(-7.2, 8.5, 3.45, -1.4);
}

function addRailing(x1, x2, baseY, z) {
  const railMat = MAT.yellowRail;
  // Top rail
  const topRail = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, x2 - x1, 8),
    railMat
  );
  topRail.rotation.z = Math.PI / 2;
  topRail.position.set((x1 + x2) / 2, baseY + 0.95, z);
  plant.add(topRail);

  // Mid rail
  const midRail = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, x2 - x1, 8),
    railMat
  );
  midRail.rotation.z = Math.PI / 2;
  midRail.position.set((x1 + x2) / 2, baseY + 0.5, z);
  plant.add(midRail);

  // Vertical posts every ~1.2m
  const step = 1.2;
  for (let x = x1; x <= x2 + 0.001; x += step) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 0.95, 8),
      railMat
    );
    post.position.set(x, baseY + 0.475, z);
    plant.add(post);
  }
}

/* ============================ VESSELS ============================
 * Position constants — left-to-right along x. Each vessel sits on the
 * plinth/deck so its base lines up with the platform.
 */
const POS = {
  reactor:   -12.0,   // big silver cylinder + cone
  box:       -8.4,    // rectangular heat exchanger
  cyclone:   -5.0,    // cone-bottom cyclone
  gasCool:   -2.0,    // domed gas cooler
  dryTower:   1.2,    // slim drying tower
  converter:  4.0,    // slim converter
  absorber:   7.3,    // short absorption tower
  acidTank:  11.2,    // tall acid tank
};

function buildVessels() {
  buildReactor(POS.reactor);
  buildHeatBox(POS.box);
  buildCyclone(POS.cyclone);
  buildGasCooler(POS.gasCool);
  buildDryingTower(POS.dryTower);
  buildConverter(POS.converter);
  buildAbsorber(POS.absorber);
  buildAcidTank(POS.acidTank);
}

/* 1. AKISKAN YATAK REAKTÖRÜ — big silver cylinder + cone bottom on left plinth */
function buildReactor(x) {
  const baseY = 0.7 + 0.45 + 0.25; // top of stepped left plinth
  // Main cylindrical body — wider/taller, dominant on left side
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(1.65, 1.65, 4.4, 40),
    MAT.steel
  );
  body.position.set(x, baseY + 2.2, 0);
  body.castShadow = true;
  plant.add(body);

  // Rounded top dome
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1.65, 36, 18, 0, Math.PI * 2, 0, Math.PI / 2.2),
    MAT.steel
  );
  dome.position.set(x, baseY + 4.4, 0);
  dome.castShadow = true;
  plant.add(dome);

  // Conical bottom hopper — wider opening
  const cone = new THREE.Mesh(
    new THREE.CylinderGeometry(1.65, 0.45, 1.9, 36),
    MAT.steel
  );
  cone.position.set(x, baseY - 0.6, 0);
  cone.castShadow = true;
  plant.add(cone);

  // Short cylinder under cone (discharge stub)
  const stub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.45, 0.55, 24),
    MAT.steelDark
  );
  stub.position.set(x, baseY - 1.75, 0);
  plant.add(stub);

  // Horizontal flange rings on cylindrical body (4 rings visible in ref)
  for (let i = 0; i < 4; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.66, 0.05, 8, 40),
      MAT.steelDark
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, baseY + 0.4 + i * 1.05, 0);
    plant.add(ring);
  }

  // Ladder up the side
  addLadder(x + 1.65, baseY, 4.4, 0);

  // Top vent stub (where the gas pipe exits to the heat box)
  const topStub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.32, 0.5, 20),
    MAT.steel
  );
  topStub.position.set(x, baseY + 4.85, 0);
  plant.add(topStub);
}

/* 2. ATIK ISI KAZANI / HEAT BOX — rectangular box with grid panels */
function buildHeatBox(x) {
  const baseY = 0.45;
  // Tall box body
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 5.4, 2.6),
    MAT.steelLight
  );
  box.position.set(x, baseY + 2.7, 0);
  box.castShadow = true;
  plant.add(box);

  // Top hood — trapezoidal cap (wider top, narrower bottom inverted) using 4-sided
  // cylinder. Reference shows a clear slanted hood above the grid.
  const hood = new THREE.Mesh(
    new THREE.CylinderGeometry(1.20, 1.55, 0.7, 4),
    MAT.steel
  );
  hood.rotation.y = Math.PI / 4;
  hood.position.set(x, baseY + 5.75, 0);
  hood.castShadow = true;
  plant.add(hood);

  // Hood top flat lid
  const hoodLid = new THREE.Mesh(
    new THREE.BoxGeometry(1.65, 0.12, 1.65),
    MAT.steelDark
  );
  hoodLid.position.set(x, baseY + 6.16, 0);
  plant.add(hoodLid);

  // Front-face grid panels — vertical fin look
  const fin = new THREE.MeshStandardMaterial({
    color: 0x787c80, roughness: 0.6, metalness: 0.55,
  });
  const finCount = 9;
  for (let i = 0; i < finCount; i++) {
    const f = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 4.2, 2.55),
      fin
    );
    f.position.set(x - 1.2 + (i + 0.5) * (2.4 / finCount), baseY + 2.7, 0);
    plant.add(f);
  }
  // Horizontal cross-bars
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Mesh(
      new THREE.BoxGeometry(2.42, 0.06, 2.62),
      fin
    );
    b.position.set(x, baseY + 0.7 + i * 0.85, 0);
    plant.add(b);
  }

  // Small conical hopper at the bottom of the heat box (matches ref)
  const dustCone = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.18, 1.0, 24),
    MAT.steel
  );
  dustCone.position.set(x, baseY - 0.3, 0);
  plant.add(dustCone);

  // Corner stiffening bars (4 vertical) — heat box has clear corner posts
  const cornerMat = MAT.steelDark;
  const corners = [[-1.22, -1.31], [1.22, -1.31], [-1.22, 1.31], [1.22, 1.31]];
  for (const [cx, cz] of corners) {
    const corner = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 5.4, 0.08),
      cornerMat
    );
    corner.position.set(x + cx, baseY + 2.7, cz);
    plant.add(corner);
  }
}

/* 3. SİKLON — cylinder over deep cone */
function buildCyclone(x) {
  const baseY = 3.32; // sits on deck
  // Cylindrical upper
  const cyl = new THREE.Mesh(
    new THREE.CylinderGeometry(1.05, 1.05, 1.8, 36),
    MAT.steel
  );
  cyl.position.set(x, baseY + 1.6, 0);
  cyl.castShadow = true;
  plant.add(cyl);

  // Deep conical bottom — signature cyclone silhouette
  const cone = new THREE.Mesh(
    new THREE.CylinderGeometry(1.05, 0.18, 2.2, 36),
    MAT.steel
  );
  cone.position.set(x, baseY - 0.4, 0);
  cone.castShadow = true;
  plant.add(cone);

  // Tiny discharge cylinder at very bottom
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 0.35, 16),
    MAT.steelDark
  );
  disc.position.set(x, baseY - 1.7, 0);
  plant.add(disc);

  // Domed flat top with central inlet
  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(1.05, 1.05, 0.15, 36),
    MAT.steel
  );
  top.position.set(x, baseY + 2.58, 0);
  plant.add(top);

  // Top central outlet stub (vortex finder)
  const outlet = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.32, 0.6, 20),
    MAT.steel
  );
  outlet.position.set(x, baseY + 2.95, 0);
  plant.add(outlet);

  // Side tangential inlet (where yellow pipe enters)
  const inlet = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.8, 16),
    MAT.steel
  );
  inlet.rotation.z = Math.PI / 2;
  inlet.position.set(x - 1.15, baseY + 2.2, 0);
  plant.add(inlet);
}

/* 4. GAZ SOĞUTUCU — domed-top cylindrical gas cooler */
function buildGasCooler(x) {
  const baseY = 3.32;
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 0.9, 3.4, 36),
    MAT.steel
  );
  body.position.set(x, baseY + 1.7, 0);
  body.castShadow = true;
  plant.add(body);

  // Hemispherical dome on top
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    MAT.steel
  );
  dome.position.set(x, baseY + 3.4, 0);
  dome.castShadow = true;
  plant.add(dome);

  // Bottom dish
  const bottom = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 28, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    MAT.steel
  );
  bottom.position.set(x, baseY, 0);
  plant.add(bottom);

  // Side stub for incoming yellow pipe at upper area
  const stub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.6, 16),
    MAT.steel
  );
  stub.rotation.z = Math.PI / 2;
  stub.position.set(x - 1.05, baseY + 2.8, 0);
  plant.add(stub);

  // Top stub
  const topStub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.25, 0.4, 16),
    MAT.steel
  );
  topStub.position.set(x, baseY + 4.15, 0);
  plant.add(topStub);

  addLadder(x + 0.9, baseY, 3.4, 0);
}

/* 5. KURUTMA KULESİ — slim tower with green band */
function buildDryingTower(x) {
  buildSlimTower(x, 3.32, 0.7, 4.4, true);
}

/* 6. KONVERTÖR — slim tower with green band */
function buildConverter(x) {
  buildSlimTower(x, 3.32, 0.78, 4.7, true);
}

function buildSlimTower(x, baseY, radius, bodyH, hasGreenBand) {
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, bodyH, 36),
    MAT.steel
  );
  body.position.set(x, baseY + bodyH / 2, 0);
  body.castShadow = true;
  plant.add(body);

  // Dome top
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2.2),
    MAT.steel
  );
  dome.position.set(x, baseY + bodyH, 0);
  plant.add(dome);

  // Bottom dish
  const bottom = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 28, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    MAT.steel
  );
  bottom.position.set(x, baseY, 0);
  plant.add(bottom);

  if (hasGreenBand) {
    // Primary green band — wider, at upper-mid (matches reference)
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(radius + 0.025, radius + 0.025, 0.4, 36),
      MAT.greenBand
    );
    band.position.set(x, baseY + bodyH * 0.62, 0);
    plant.add(band);

    // Secondary thinner band lower down
    const band2 = new THREE.Mesh(
      new THREE.CylinderGeometry(radius + 0.025, radius + 0.025, 0.18, 36),
      MAT.greenBand
    );
    band2.position.set(x, baseY + bodyH * 0.30, 0);
    plant.add(band2);
  }

  // Flange rings — give the slim towers more visible detail
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius + 0.025, 0.035, 6, 32),
      MAT.steelDark
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, baseY + 0.5 + i * 1.3, 0);
    plant.add(ring);
  }

  // Top outlet stub
  const topStub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.4, 16),
    MAT.steel
  );
  topStub.position.set(x, baseY + bodyH + 0.5, 0);
  plant.add(topStub);

  // Side inlet stub
  const sideStub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.6, 16),
    MAT.steel
  );
  sideStub.rotation.z = Math.PI / 2;
  sideStub.position.set(x - radius - 0.18, baseY + bodyH * 0.78, 0);
  plant.add(sideStub);

  addLadder(x + radius + 0.02, baseY, bodyH, 0);
}

/* 7. ABSORPSİYON KULESİ — short squat tower on right plinth */
function buildAbsorber(x) {
  const baseY = 0.7 + 0.45;
  const radius = 1.05;
  const bodyH = 2.6;

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, bodyH, 36),
    MAT.steel
  );
  body.position.set(x, baseY + bodyH / 2, 0);
  body.castShadow = true;
  plant.add(body);

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2),
    MAT.steel
  );
  dome.position.set(x, baseY + bodyH, 0);
  plant.add(dome);

  const bottom = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 28, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    MAT.steel
  );
  bottom.position.set(x, baseY, 0);
  plant.add(bottom);

  // Flange rings
  for (let i = 0; i < 2; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius + 0.02, 0.04, 6, 36),
      MAT.steelDark
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, baseY + 0.8 + i * 1.1, 0);
    plant.add(ring);
  }

  // Side inlet
  const inlet = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.25, 0.5, 16),
    MAT.steel
  );
  inlet.rotation.z = Math.PI / 2;
  inlet.position.set(x - radius - 0.18, baseY + bodyH * 0.7, 0);
  plant.add(inlet);
}

/* 8. SÜLFÜRİK ASİT TANKI — tallest tower with green bands */
function buildAcidTank(x) {
  const baseY = 0.7 + 0.45 + 0.3; // sits on acid sub-plinth (taller)
  const radius = 1.30;
  const bodyH = 7.4;

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, bodyH, 40),
    MAT.steel
  );
  body.position.set(x, baseY + bodyH / 2, 0);
  body.castShadow = true;
  plant.add(body);

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2.3),
    MAT.steel
  );
  dome.position.set(x, baseY + bodyH, 0);
  plant.add(dome);

  const bottom = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    MAT.steel
  );
  bottom.position.set(x, baseY, 0);
  plant.add(bottom);

  // Three green bands (reference shows clear bands top-mid-upper of acid tank)
  const bandY = [0.22, 0.5, 0.78];
  for (const t of bandY) {
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(radius + 0.03, radius + 0.03, 0.38, 40),
      MAT.greenBand
    );
    band.position.set(x, baseY + bodyH * t, 0);
    plant.add(band);
  }

  // Flange rings (denser cluster — visible in reference)
  for (let i = 0; i < 5; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius + 0.03, 0.05, 8, 40),
      MAT.steelDark
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, baseY + 0.7 + i * 1.4, 0);
    plant.add(ring);
  }

  // Tall full-height ladder with safety cage hoops (signature visual)
  addLadder(x + radius + 0.02, baseY, bodyH, 0);
  // Safety hoops on the ladder
  for (let i = 0; i < 9; i++) {
    const hoop = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.022, 6, 18, Math.PI),
      MAT.yellowRail
    );
    hoop.rotation.y = -Math.PI / 2;
    hoop.position.set(x + radius + 0.3, baseY + 0.5 + i * 0.8, 0);
    plant.add(hoop);
  }

  // Top vent
  const vent = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.5, 20),
    MAT.steel
  );
  vent.position.set(x, baseY + bodyH + 0.6, 0);
  plant.add(vent);

  // Top side platform railing (small rectangle around the top dome)
  const platRail = new THREE.Mesh(
    new THREE.TorusGeometry(radius + 0.05, 0.025, 6, 36),
    MAT.yellowRail
  );
  platRail.rotation.x = Math.PI / 2;
  platRail.position.set(x, baseY + bodyH + 0.05, 0);
  plant.add(platRail);
}

/* ============================ ROOF PIPING ============================
 * Yellow gas pipes connecting the tops of the vessels in a series of
 * inverted-U arches — this is the most iconic visual feature of the
 * reference image.
 */
function buildRoofPiping() {
  // Pipe radius
  const r = 0.22;
  const elbR = 0.42; // elbow bend radius

  // Build a roof arch from (x1, y1) to (x2, y2) — both verticals up to
  // archY, plus a horizontal across, with proper torus elbows at corners.
  function arch(x1, y1, x2, y2, archY) {
    // Vertical from vessel 1 up to arch height (stop short for elbow)
    addVertPipe(x1, y1, archY - elbR, 0, r);
    // Vertical from vessel 2 up to arch height (stop short for elbow)
    addVertPipe(x2, y2, archY - elbR, 0, r);

    // Determine direction of elbow (which side bends in)
    const dir1 = x2 > x1 ? 1 : -1;
    const dir2 = -dir1;

    // Horizontal connecting top (between elbow centers)
    const hx1 = x1 + dir1 * elbR;
    const hx2 = x2 + dir2 * elbR;
    addHorizPipe(hx1, hx2, archY, 0, r);

    // Torus elbows (quarter-circle bends) — placed so endpoints meet pipes
    addQuarterElbow(x1, archY, 0, elbR, r, dir1);
    addQuarterElbow(x2, archY, 0, elbR, r, dir2);

    // Flow marker
    addFlow(hx1, hx2, archY, 0, r);
  }

  // Vessel-top Y heights for piping anchors:
  //   reactor:    baseY 1.4 + body 4.4 + dome ≈ 6.45 (use outlet stub top)
  //   heat box:   baseY 0.45 + 6.16 ≈ 6.6
  //   cyclone:    baseY 3.32 + 2.95 ≈ 6.27 (outlet stub top ≈ 6.55)
  //   gas cooler: baseY 3.32 + 4.15 ≈ 7.47 (top stub top)
  //   dry tower:  baseY 3.32 + 4.4 + 0.5 ≈ 8.22
  //   converter:  baseY 3.32 + 4.7 + 0.5 ≈ 8.52
  //   absorber:   baseY 1.15 + 2.6 + dome 1.05 ≈ 4.80
  //   acid tank:  baseY 1.45 + 7.4 ≈ 8.85
  arch(POS.reactor, 6.45, POS.box, 6.4, 7.55);
  arch(POS.box, 6.4, POS.cyclone, 6.55, 7.55);
  arch(POS.cyclone, 6.55, POS.gasCool, 7.50, 8.30);
  arch(POS.gasCool, 7.50, POS.dryTower, 8.20, 8.95);
  arch(POS.dryTower, 8.20, POS.converter, 8.50, 9.20);
  arch(POS.converter, 8.50, POS.absorber, 4.80, 9.20);
  arch(POS.absorber, 4.80, POS.acidTank, 8.85, 9.40);
}

/* Quarter-circle elbow using TorusGeometry. (px, py) is the corner anchor —
 * the point at archY directly above the vessel x-position. The elbow bends
 * from a vertical pipe ending at (px, py - bendR) to a horizontal pipe at
 * height py going in the dirX direction (±1). Centre sits at
 * (px + dirX*bendR, py - bendR). */
function addQuarterElbow(px, py, pz, bendR, pipeR, dirX) {
  const t = new THREE.Mesh(
    new THREE.TorusGeometry(bendR, pipeR, 10, 18, Math.PI / 2),
    MAT.yellowPipe
  );
  t.position.set(px + dirX * bendR, py - bendR, pz);
  // Default torus arc occupies first quadrant [0, π/2] (from +X toward +Y).
  // For dirX < 0 the elbow must occupy [0, π/2] — no rotation.
  // For dirX > 0 the elbow must occupy [π/2, π] — rotate Z by +π/2.
  t.rotation.z = dirX > 0 ? Math.PI / 2 : 0;
  t.castShadow = true;
  plant.add(t);
  return t;
}

/* ============================ DECK PIPING ============================
 * Horizontal yellow pipe running across the deck at ~1.6m height — like
 * the long pipe in the reference between absorber and reactor bases.
 */
function buildDeckPiping() {
  const y = 1.6;
  const r = 0.28;
  // Long horizontal yellow pipe across whole deck
  addHorizPipe(POS.reactor + 1.6, POS.absorber - 1.0, y, 0, r);

  // Tee-down to acid tank base
  addHorizPipe(POS.absorber - 1.0, POS.acidTank - 1.4, y, 0, r);

  // Pipe supports
  for (let x = POS.reactor + 2; x < POS.acidTank - 1.5; x += 3.0) {
    addPipeSupport(x, y, 0);
  }

  // Animated flow marker along the long deck pipe
  addFlow(POS.reactor + 1.6, POS.acidTank - 1.4, y, 0, r);
}

function addVertPipe(x, y1, y2, z, radius) {
  const len = Math.abs(y2 - y1);
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, len, 20),
    MAT.yellowPipe
  );
  m.position.set(x, (y1 + y2) / 2, z);
  m.castShadow = true;
  plant.add(m);
  return m;
}

function addHorizPipe(x1, x2, y, z, radius) {
  const len = Math.abs(x2 - x1);
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, len, 20),
    MAT.yellowPipe
  );
  m.rotation.z = Math.PI / 2;
  m.position.set((x1 + x2) / 2, y, z);
  m.castShadow = true;
  plant.add(m);
  return m;
}

function addElbow(x, y, z, radius) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.18, 16, 12),
    MAT.yellowPipe
  );
  m.position.set(x, y, z);
  m.castShadow = true;
  plant.add(m);
  return m;
}

function addPipeSupport(x, y, z) {
  const supportMat = MAT.deckSteel;
  const colH = y - 0.45;
  if (colH <= 0) return;
  const stand = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, colH, 0.14),
    supportMat
  );
  stand.position.set(x, 0.45 + colH / 2, z);
  stand.castShadow = true;
  plant.add(stand);
}

function addFlow(x1, x2, y, z, radius) {
  const fm = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.04, radius * 1.04, 0.5, 18),
    new THREE.MeshStandardMaterial({
      color: 0xfff0a0, emissive: 0xffd24a,
      emissiveIntensity: 0.9, transparent: true, opacity: 0.7,
    })
  );
  fm.rotation.z = Math.PI / 2;
  fm.position.set(x1, y, z);
  fm.userData = {
    startX: x1, endX: x2, y, z,
    speed: 0.005 + Math.random() * 0.004,
    progress: Math.random(),
  };
  flowMarkers.push(fm);
  plant.add(fm);
}

/* ============================ LADDERS ============================ */
function addLadder(x, baseY, height, z) {
  const railMat = MAT.yellowRail;
  const r1 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, height, 8),
    railMat
  );
  r1.position.set(x + 0.04, baseY + height / 2, z + 0.18);
  plant.add(r1);
  const r2 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, height, 8),
    railMat
  );
  r2.position.set(x + 0.04, baseY + height / 2, z - 0.18);
  plant.add(r2);

  const rungs = Math.floor(height / 0.4);
  for (let i = 0; i < rungs; i++) {
    const rung = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.45, 6),
      railMat
    );
    rung.rotation.x = Math.PI / 2;
    rung.position.set(x + 0.04, baseY + 0.3 + i * 0.4, z);
    plant.add(rung);
  }
}

/* ============================ AUXILIARIES ============================
 * Blue pumps/motors clustered at the front and around the plinths — the
 * reference image shows several of these at ground level.
 */
function buildAuxiliaries() {
  // Blue pumps placed at ground in front of the plinths — like the reference
  const pumps = [
    [-13.6,  3.2,  Math.PI],   // far-left front pump (faces left, matching ref)
    [ -9.4,  3.1,  0],         // under heat box front
    [ -2.4,  3.2,  0],         // foreground centre pump
    [  3.6,  3.0,  0],         // mid-deck pump
    [  7.4,  3.1,  Math.PI],   // under absorber front
    [ 12.6,  3.1,  0],         // far-right front pump
  ];
  for (const [px, pz, rot] of pumps) addPump(px, 0.55, pz, rot);

  // Small horizontal vessel (waste heat / boiler drum) at ground in front of deck
  const drum = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.55, 2.4, 24),
    MAT.steelLight
  );
  drum.rotation.z = Math.PI / 2;
  drum.position.set(-6.4, 1.0, 2.6);
  drum.castShadow = true;
  plant.add(drum);
  // End caps
  const cap1 = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    MAT.steelLight
  );
  cap1.rotation.z = -Math.PI / 2;
  cap1.position.set(-5.2, 1.0, 2.6);
  plant.add(cap1);
  const cap2 = cap1.clone();
  cap2.rotation.z = Math.PI / 2;
  cap2.position.set(-7.6, 1.0, 2.6);
  plant.add(cap2);

  // Saddle supports for the drum
  for (const sx of [-5.4, -7.4]) {
    const saddle = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.5, 0.7),
      MAT.deckSteel
    );
    saddle.position.set(sx, 0.7, 2.6);
    plant.add(saddle);
  }

  // A small valve assembly near the deck centre (forward of converter)
  const valveBody = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 16, 12),
    MAT.steelDark
  );
  valveBody.position.set(4.6, 2.2, 1.6);
  plant.add(valveBody);
  const valveHandle = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.025, 6, 24),
    new THREE.MeshStandardMaterial({ color: 0xc04444, roughness: 0.5, metalness: 0.3 })
  );
  valveHandle.position.set(4.6, 2.45, 1.6);
  valveHandle.rotation.x = Math.PI / 2;
  plant.add(valveHandle);
}

function addPump(x, y, z, rotY = 0) {
  const group = new THREE.Group();
  // Blue motor body (horizontal cylinder)
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.32, 0.9, 20),
    MAT.motor
  );
  body.rotation.z = Math.PI / 2;
  body.castShadow = true;
  group.add(body);

  // Cooling fins (visible rings on motor)
  for (let i = -2; i <= 2; i++) {
    const fin = new THREE.Mesh(
      new THREE.TorusGeometry(0.33, 0.018, 6, 18),
      MAT.steelDark
    );
    fin.rotation.y = Math.PI / 2;
    fin.position.x = i * 0.15;
    group.add(fin);
  }

  // Front pump head (impeller housing — bigger, distinctive shape)
  const head = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.36, 0.4, 22),
    MAT.steelDark
  );
  head.rotation.z = Math.PI / 2;
  head.position.x = 0.65;
  group.add(head);

  // Suction flange
  const flange = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 0.08, 22),
    MAT.steelDark
  );
  flange.rotation.z = Math.PI / 2;
  flange.position.x = 0.88;
  group.add(flange);

  // Foot
  const foot = new THREE.Mesh(
    new THREE.BoxGeometry(1.20, 0.18, 0.6),
    MAT.black
  );
  foot.position.set(0.1, -0.4, 0);
  group.add(foot);

  // Rear fan cap
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.28, 0.18, 16),
    MAT.black
  );
  cap.rotation.z = Math.PI / 2;
  cap.position.x = -0.55;
  group.add(cap);

  group.position.set(x, y, z);
  group.rotation.y = rotY;
  plant.add(group);
}

/* ============================ ATMOSPHERICS ============================
 * Soft smoke wisps from acid tank vent + cyclone outlet
 */
function buildAtmospherics() {
  spawnSmoke(POS.acidTank, 9.45, 0, 6, 0xeeeeee, 0.5);
  spawnSmoke(POS.cyclone, 6.85, 0, 4, 0xdadada, 0.3);
}

function spawnSmoke(x, y, z, count, color, baseScale) {
  const mat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.5, depthWrite: false,
  });
  for (let i = 0; i < count; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), mat.clone());
    s.position.set(x, y + i * 0.4, z);
    s.userData = {
      baseX: x, baseY: y, baseZ: z,
      offsetY: i * 0.4,
      speed: 0.005 + Math.random() * 0.004,
      scaleBase: baseScale + Math.random() * 0.15,
    };
    s.scale.setScalar(s.userData.scaleBase);
    smokeParticles.push(s);
    plant.add(s);
  }
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

  const t = performance.now() * 0.001;

  // Animate flow markers along pipes
  for (const fm of flowMarkers) {
    fm.userData.progress += fm.userData.speed;
    if (fm.userData.progress > 1) fm.userData.progress = 0;
    fm.position.x = fm.userData.startX +
      (fm.userData.endX - fm.userData.startX) * fm.userData.progress;
    fm.material.emissiveIntensity = 0.6 + Math.sin(t * 5 + fm.userData.progress * 10) * 0.3;
  }

  // Animate smoke wisps
  for (const s of smokeParticles) {
    s.userData.offsetY += s.userData.speed;
    s.position.y = s.userData.baseY + s.userData.offsetY;
    s.position.x = s.userData.baseX + Math.sin(t * 0.6 + s.userData.offsetY * 0.5) * 0.25;
    const lifeT = (s.position.y - s.userData.baseY) / 5.0;
    s.material.opacity = Math.max(0, 0.5 * (1 - lifeT));
    s.scale.setScalar(s.userData.scaleBase * (1 + lifeT * 1.2));
    if (lifeT > 1) {
      s.userData.offsetY = 0;
      s.position.set(s.userData.baseX, s.userData.baseY, s.userData.baseZ);
    }
  }

  // Idle auto-rotate
  if (autoRotateEnabled && (Date.now() - lastUserInteraction) > 5000) {
    const radius = Math.hypot(camera.position.x, camera.position.z);
    const angle = Math.atan2(camera.position.z, camera.position.x) + 0.0010;
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

/* ============================ SLIDE INTEGRATION ============================ */
window.addEventListener('slidechange', (e) => {
  if (e.detail.index === CONFIG.slideIndex) {
    init();
    setTimeout(onResize, 50);
    startRendering();
  } else {
    stopRendering();
  }
});

// Optional: auto-start if the slide is already active when the script loads.
if (document.querySelector(`.slide[data-slide="12"]`)?.classList.contains('active')) {
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
  smokeParticles.length = 0;
  flowMarkers.length = 0;
  renderer = null;
  scene = null;
  camera = null;
  controls = null;
  canvas = null;
  plant = null;
  initialized = false;
}

window.threeRoaster = {
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
