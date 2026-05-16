import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* ===================================================================
 * NTE Pars Metal — Procedural 3D Oxygen Plant (PSA-O₂ Unit) v3
 *
 * REWRITTEN to match the firm's reference photograph at first sight:
 *
 *   Left → Right composition on a single blue skid (front-on view):
 *     1. Control cabinet (white/grey) with HMI screen & buttons
 *     2. Twin tall white PSA columns "A" and "B" with a single
 *        green dome silencer bridging the tops
 *     3. Dense stainless steel piping manifold between the columns,
 *        with multiple round pressure gauges
 *     4. Horizontal white "AIR COMPRESSOR" tank in the mid ground
 *     5. Small blue "OXYGEN BOOSTER" skid (motor + pump)
 *     6. Two tall white "OXYGEN" buffer tanks with green band
 *     7. Rack of 3 dark stainless O₂ cylinders (labelled "O₂")
 *
 *   Blue safety railings front-left and front-right.
 *   Diamond plate deck. Ground = dusty mining-pad gravel.
 * =================================================================== */

const CONFIG = {
  // Skid (the blue base)
  skidWidth: 18.0,
  skidDepth: 6.0,
  skidHeight: 0.55,

  // X anchors (centered around 0), front-on view
  panelX:       -7.6,   // control cabinet
  psaCenterX:   -3.4,   // midpoint between PSA A and B
  psaSpacing:    2.0,   // distance between A and B (slimmer towers, closer together)
  manifoldX:    -3.4,   // piping manifold sits between A and B
  compressorX:   0.6,   // vertical AIR COMPRESSOR tank
  boosterX:      2.8,   // small blue booster skid
  oxyTank1X:     4.5,   // OXYGEN buffer #1
  oxyTank2X:     6.1,   // OXYGEN buffer #2
  cylindersX:    7.85,  // O2 cylinder rack

  // PSA columns — slimmer & taller to match reference
  psaRadius:     0.70,
  psaHeight:     5.2,

  // Oxygen buffer tanks — taller, slightly wider than PSA
  oxyTankRadius: 0.72,
  oxyTankHeight: 5.0,

  // PSA swing cycle
  swingPeriodSec: 6.0,
};

let renderer, scene, camera, controls;
let canvas;
let initialized = false;
let frameId = null;

// Animated registries
const animatedNeedles = [];
const animatedLEDs = [];
const psaColumnLights = [];
const flowMarkers = [];
const animatedSheaves = [];

let lastUserInteraction = Date.now();
let autoRotateEnabled = true;

/* ============================ INIT ============================ */
function init(targetCanvas) {
  if (initialized) return;
  initialized = true;

  canvas = targetCanvas || document.getElementById('three-canvas-oxygen');
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
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9cc4dc); // slightly bluer sky (matches reference)
  scene.fog = new THREE.Fog(0xb6cfdc, 42, 100);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  // Camera — front-on, slight elevation, to match the reference photo composition
  camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 200);
  camera.position.set(0, 4.5, 20.5);
  camera.lookAt(0, 2.9, 0);

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 12;
  controls.maxDistance = 38;
  controls.minPolarAngle = Math.PI * 0.18;
  controls.maxPolarAngle = Math.PI * 0.52;
  controls.target.set(0, 2.9, 0);
  controls.addEventListener('start', () => {
    lastUserInteraction = Date.now();
    autoRotateEnabled = false;
  });
  controls.addEventListener('end', () => {
    lastUserInteraction = Date.now();
    setTimeout(() => { autoRotateEnabled = true; }, 6000);
  });

  setupLights();
  buildBackdrop();
  buildGroundAndSkid();
  buildSkidRailings();
  buildControlCabinet();
  buildPSAUnit();             // twin towers + green dome + piping manifold
  buildAirCompressorTank();
  buildOxygenBooster();
  buildOxygenBufferTanks();   // two white tanks with green band
  buildO2CylinderRack();
  buildFloorPipingFlow();

  window.addEventListener('resize', onResize);
}

/* ============================ LIGHTING ============================ */
function setupLights() {
  const hemi = new THREE.HemisphereLight(0xfff4e2, 0x6b6052, 0.85);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffffff, 2.0);
  key.position.set(8, 16, 12);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -16;
  key.shadow.camera.right = 16;
  key.shadow.camera.top = 16;
  key.shadow.camera.bottom = -10;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 60;
  key.shadow.bias = -0.0005;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xc9d8e8, 0.5);
  fill.position.set(-10, 8, 6);
  scene.add(fill);

  const back = new THREE.DirectionalLight(0xffe0b0, 0.35);
  back.position.set(0, 10, -14);
  scene.add(back);
}

/* ============================ BACKDROP (sky, hills, mining elements) ============================ */
function buildBackdrop() {
  // Distant blue mountain silhouette (jagged)
  const mountainShape = new THREE.Shape();
  mountainShape.moveTo(-90, 0);
  const peaks = [
    [-78, 4], [-66, 9], [-55, 6], [-42, 12], [-30, 8],
    [-18, 14], [-6, 9], [6, 13], [20, 7], [34, 11],
    [48, 6], [62, 10], [76, 5], [90, 8],
  ];
  for (const p of peaks) mountainShape.lineTo(p[0], p[1]);
  mountainShape.lineTo(90, 0);
  mountainShape.lineTo(-90, 0);
  const mountainGeo = new THREE.ShapeGeometry(mountainShape);
  const mountains = new THREE.Mesh(
    mountainGeo,
    new THREE.MeshBasicMaterial({ color: 0x5d6b78, fog: true })
  );
  mountains.position.set(0, 2, -44);
  scene.add(mountains);

  // Closer dark brown hill (mining-pad waste rock)
  const wasteRockShape = new THREE.Shape();
  wasteRockShape.moveTo(-60, 0);
  const wPeaks = [
    [-50, 3], [-38, 7], [-26, 4], [-14, 8], [-2, 5],
    [10, 9], [22, 4], [34, 6], [46, 3], [60, 5],
  ];
  for (const p of wPeaks) wasteRockShape.lineTo(p[0], p[1]);
  wasteRockShape.lineTo(60, 0);
  wasteRockShape.lineTo(-60, 0);
  const wasteRock = new THREE.Mesh(
    new THREE.ShapeGeometry(wasteRockShape),
    new THREE.MeshBasicMaterial({ color: 0x4a4030, fog: true })
  );
  wasteRock.position.set(0, 1, -32);
  scene.add(wasteRock);

  // ---- LEFT: suggestion of a conveyor (dark angled bar going up-left) ----
  const conveyor = new THREE.Mesh(
    new THREE.BoxGeometry(18, 1.2, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.7, metalness: 0.2, fog: true })
  );
  conveyor.position.set(-22, 5, -22);
  conveyor.rotation.z = 0.32;
  scene.add(conveyor);

  // Conveyor support legs
  for (let i = 0; i < 3; i++) {
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 5, 0.25),
      new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.7, fog: true })
    );
    leg.position.set(-28 + i * 5, 2.5 + i * 1.2, -22);
    scene.add(leg);
  }

  // Crushed ore pile near conveyor base (gray cone)
  const orePile = new THREE.Mesh(
    new THREE.ConeGeometry(6, 4, 24),
    new THREE.MeshStandardMaterial({ color: 0x5a5550, roughness: 0.95, fog: true })
  );
  orePile.position.set(-18, 2, -24);
  scene.add(orePile);

  // ---- RIGHT: suggestion of fuel/process tank farm in distance ----
  for (let i = 0; i < 4; i++) {
    const tankFar = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 2.6, 20),
      new THREE.MeshStandardMaterial({ color: 0xe2e6ea, roughness: 0.6, metalness: 0.2, fog: true })
    );
    tankFar.position.set(20 + i * 3.6, 1.3, -28);
    scene.add(tankFar);
  }

  // White cloud streaks plane (subtle, very far)
  const cloudsCanvas = document.createElement('canvas');
  cloudsCanvas.width = 1024;
  cloudsCanvas.height = 256;
  const cctx = cloudsCanvas.getContext('2d');
  cctx.fillStyle = 'rgba(255,255,255,0)';
  cctx.fillRect(0, 0, 1024, 256);
  cctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = 0; i < 18; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 180;
    const w = 60 + Math.random() * 220;
    const h = 18 + Math.random() * 30;
    cctx.beginPath();
    cctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
    cctx.fill();
  }
  const cloudTex = new THREE.CanvasTexture(cloudsCanvas);
  cloudTex.colorSpace = THREE.SRGBColorSpace;
  const clouds = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 50),
    new THREE.MeshBasicMaterial({ map: cloudTex, transparent: true, fog: false })
  );
  clouds.position.set(0, 16, -55);
  scene.add(clouds);
}

/* ============================ GROUND & SKID ============================ */
function buildGroundAndSkid() {
  // Gravel mining pad
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 220),
    new THREE.MeshStandardMaterial({
      color: 0xa39684,
      roughness: 0.98,
      metalness: 0.02,
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  ground.receiveShadow = true;
  scene.add(ground);

  // Blue skid base
  const skidGroup = new THREE.Group();

  const skidMat = new THREE.MeshStandardMaterial({
    color: 0x1f4e8e,
    roughness: 0.55,
    metalness: 0.3,
  });

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(CONFIG.skidWidth, CONFIG.skidHeight, CONFIG.skidDepth),
    skidMat
  );
  base.position.y = CONFIG.skidHeight / 2;
  base.castShadow = true;
  base.receiveShadow = true;
  skidGroup.add(base);

  // Diamond-plate deck on top
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(CONFIG.skidWidth - 0.1, 0.06, CONFIG.skidDepth - 0.1),
    new THREE.MeshStandardMaterial({
      color: 0x5a8bbd,
      roughness: 0.4,
      metalness: 0.55,
    })
  );
  deck.position.y = CONFIG.skidHeight + 0.03;
  deck.receiveShadow = true;
  skidGroup.add(deck);

  // Bottom I-beam runners (two long beams under the skid)
  const beamMat = new THREE.MeshStandardMaterial({
    color: 0x163d70, roughness: 0.7, metalness: 0.25,
  });
  for (const z of [-CONFIG.skidDepth / 2 + 0.6, CONFIG.skidDepth / 2 - 0.6]) {
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(CONFIG.skidWidth - 0.6, 0.18, 0.3),
      beamMat
    );
    beam.position.set(0, 0.09, z);
    beam.castShadow = true;
    skidGroup.add(beam);
  }

  scene.add(skidGroup);
}

/* ============================ RAILINGS ============================ */
function buildSkidRailings() {
  const railMat = new THREE.MeshStandardMaterial({
    color: 0x1f4e8e, roughness: 0.5, metalness: 0.4,
  });

  const deckY = CONFIG.skidHeight + 0.06;
  const topRailY = deckY + 1.0;
  const midRailY = deckY + 0.55;
  const railZ = CONFIG.skidDepth / 2 + 0.05;

  // ---- LEFT railing (front-left of skid, near control cabinet) ----
  const leftRailGroup = new THREE.Group();
  const leftX = -CONFIG.skidWidth / 2 + 0.05;
  const leftLen = 2.6;
  // posts
  for (let i = 0; i <= 2; i++) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.10, 1.05, 0.10),
      railMat
    );
    post.position.set(leftX + i * (leftLen / 2), deckY + 0.5, railZ);
    post.castShadow = true;
    leftRailGroup.add(post);
  }
  // top + mid horizontal rails
  for (const y of [topRailY, midRailY]) {
    const r = new THREE.Mesh(
      new THREE.BoxGeometry(leftLen, 0.06, 0.06),
      railMat
    );
    r.position.set(leftX + leftLen / 2, y, railZ);
    leftRailGroup.add(r);
  }
  // diagonal cross-brace
  const lDiag = new THREE.Mesh(
    new THREE.BoxGeometry(leftLen * 1.05, 0.05, 0.05),
    railMat
  );
  lDiag.position.set(leftX + leftLen / 2, deckY + 0.5, railZ);
  lDiag.rotation.z = Math.atan2(0.95, leftLen);
  leftRailGroup.add(lDiag);
  scene.add(leftRailGroup);

  // ---- RIGHT railing (front-right, near cylinder rack) ----
  const rightRailGroup = new THREE.Group();
  const rightLen = 2.6;
  const rightStartX = CONFIG.skidWidth / 2 - rightLen - 0.05;
  for (let i = 0; i <= 2; i++) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.10, 1.05, 0.10),
      railMat
    );
    post.position.set(rightStartX + i * (rightLen / 2), deckY + 0.5, railZ);
    post.castShadow = true;
    rightRailGroup.add(post);
  }
  for (const y of [topRailY, midRailY]) {
    const r = new THREE.Mesh(
      new THREE.BoxGeometry(rightLen, 0.06, 0.06),
      railMat
    );
    r.position.set(rightStartX + rightLen / 2, y, railZ);
    rightRailGroup.add(r);
  }
  const rDiag = new THREE.Mesh(
    new THREE.BoxGeometry(rightLen * 1.05, 0.05, 0.05),
    railMat
  );
  rDiag.position.set(rightStartX + rightLen / 2, deckY + 0.5, railZ);
  rDiag.rotation.z = -Math.atan2(0.95, rightLen);
  rightRailGroup.add(rDiag);
  scene.add(rightRailGroup);
}

/* ============================ CONTROL CABINET ============================ */
function buildControlCabinet() {
  const g = new THREE.Group();
  const x = CONFIG.panelX;
  const deckY = CONFIG.skidHeight + 0.06;

  const w = 1.8, h = 2.4, d = 0.9;

  // Body — light grey/white
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({
      color: 0xe8eaee, roughness: 0.55, metalness: 0.1,
    })
  );
  body.position.set(x, deckY + h / 2, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  // Top — slightly darker cap
  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.05, 0.06, d + 0.05),
    new THREE.MeshStandardMaterial({ color: 0xc8ccd2, roughness: 0.5, metalness: 0.2 })
  );
  cap.position.set(x, deckY + h + 0.03, 0);
  g.add(cap);

  // HMI Screen (cyan glowing)
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.6),
    new THREE.MeshStandardMaterial({
      color: 0x06425e,
      emissive: 0x22a6cc,
      emissiveIntensity: 0.6,
      roughness: 0.35,
    })
  );
  screen.position.set(x, deckY + 1.75, d / 2 + 0.001);
  g.add(screen);

  // Black screen bezel
  const bezel = new THREE.Mesh(
    new THREE.PlaneGeometry(1.05, 0.74),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 })
  );
  bezel.position.set(x, deckY + 1.75, d / 2 - 0.001);
  g.add(bezel);

  // Three indicator lamps (red/yellow/green) — round
  const lampColors = [0xef4444, 0xfacc15, 0x22c55e];
  for (let i = 0; i < 3; i++) {
    const lamp = new THREE.Mesh(
      new THREE.CircleGeometry(0.06, 24),
      new THREE.MeshStandardMaterial({
        color: lampColors[i],
        emissive: lampColors[i],
        emissiveIntensity: 0.9,
      })
    );
    lamp.position.set(x - 0.5 + i * 0.18, deckY + 1.15, d / 2 + 0.002);
    g.add(lamp);
    animatedLEDs.push(lamp);
    lamp.userData = { baseIntensity: 0.9, phase: i, flicker: false };
  }

  // E-stop big red button
  const estop = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 0.05, 24),
    new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.5 })
  );
  estop.rotation.x = Math.PI / 2;
  estop.position.set(x + 0.4, deckY + 1.15, d / 2 + 0.02);
  g.add(estop);

  // Black switches row
  for (let i = 0; i < 4; i++) {
    const sw = new THREE.Mesh(
      new THREE.BoxGeometry(0.10, 0.10, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 })
    );
    sw.position.set(x - 0.5 + i * 0.20, deckY + 0.85, d / 2 + 0.022);
    g.add(sw);
  }

  // Logo / label plaque
  g.add(makeLabelMesh('HMI / PLC', 1.0, 0.16, '#1d4ed8', null, 40));
  const plaque = g.children[g.children.length - 1];
  plaque.position.set(x, deckY + 2.18, d / 2 + 0.003);

  // Door handle
  const handle = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.05, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.4, metalness: 0.6 })
  );
  handle.position.set(x + 0.7, deckY + 0.5, d / 2 + 0.022);
  g.add(handle);

  scene.add(g);
}

/* ============================ PSA UNIT (TWIN TOWERS + DOME + MANIFOLD) ============================ */
function buildPSAUnit() {
  const g = new THREE.Group();
  const deckY = CONFIG.skidHeight + 0.06;
  const cx = CONFIG.psaCenterX;
  const half = CONFIG.psaSpacing / 2;

  const towerMat = new THREE.MeshStandardMaterial({
    color: 0xeef0f2, roughness: 0.45, metalness: 0.25,
  });
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xdadde2, roughness: 0.35, metalness: 0.5,
  });

  // ---- Two columns: A (left) and B (right) ----
  const towers = [
    { x: cx - half, label: 'A' },
    { x: cx + half, label: 'B' },
  ];

  for (const t of towers) {
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(CONFIG.psaRadius, CONFIG.psaRadius, CONFIG.psaHeight, 40),
      towerMat
    );
    body.position.set(t.x, deckY + CONFIG.psaHeight / 2, 0);
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);

    // Top dished/flat head (shallower than hemisphere — matches reference)
    const headTop = new THREE.Mesh(
      new THREE.SphereGeometry(CONFIG.psaRadius, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.42),
      headMat
    );
    headTop.scale.y = 0.55;
    headTop.position.set(t.x, deckY + CONFIG.psaHeight, 0);
    headTop.castShadow = true;
    g.add(headTop);

    // Manway / flange just below the head
    const manway = new THREE.Mesh(
      new THREE.CylinderGeometry(CONFIG.psaRadius * 1.04, CONFIG.psaRadius * 1.04, 0.10, 36),
      headMat
    );
    manway.position.set(t.x, deckY + CONFIG.psaHeight - 0.05, 0);
    g.add(manway);

    // Bottom dished head + skirt
    const headBot = new THREE.Mesh(
      new THREE.SphereGeometry(CONFIG.psaRadius, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI * 0.42),
      headMat
    );
    headBot.scale.y = 0.55;
    headBot.position.set(t.x, deckY, 0);
    g.add(headBot);

    // Blue square sign on tower (reference shows a flat blue square with white circle + letter)
    const signBlue = new THREE.Mesh(
      new THREE.PlaneGeometry(0.62, 0.62),
      new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.55 })
    );
    signBlue.position.set(t.x, deckY + CONFIG.psaHeight * 0.74, CONFIG.psaRadius + 0.006);
    g.add(signBlue);

    // White inner circle
    const whiteCircle = new THREE.Mesh(
      new THREE.CircleGeometry(0.22, 32),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 })
    );
    whiteCircle.position.set(t.x, deckY + CONFIG.psaHeight * 0.74, CONFIG.psaRadius + 0.010);
    g.add(whiteCircle);

    // Big blue letter A / B inside the white circle
    const letter = makeLabelMesh(t.label, 0.34, 0.34, '#1d4ed8', null, 240);
    letter.position.set(t.x, deckY + CONFIG.psaHeight * 0.74, CONFIG.psaRadius + 0.016);
    g.add(letter);

    // "OXYGEN GENERATOR" text painted on the tower (no background) — blue text on white tower
    const tag = makeLabelMesh('OXYGEN\nGENERATOR', 1.05, 0.46, '#1d4ed8', null, 68);
    tag.position.set(t.x, deckY + CONFIG.psaHeight * 0.52, CONFIG.psaRadius + 0.014);
    g.add(tag);

    // Stage indicator ring (animated) — light at top of column
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(CONFIG.psaRadius + 0.05, 0.04, 12, 40),
      new THREE.MeshStandardMaterial({
        color: 0x22c55e,
        emissive: 0x22c55e,
        emissiveIntensity: 0.6,
      })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(t.x, deckY + CONFIG.psaHeight - 0.15, 0);
    ring.userData = { phase: t.label === 'A' ? 0 : Math.PI };
    psaColumnLights.push(ring);
    g.add(ring);
  }

  // ---- Shared GREEN DOME silencer/manifold on top, bridging the two towers ----
  // Connecting horizontal pipe at the very top
  const topPipe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, CONFIG.psaSpacing + 0.4, 20),
    new THREE.MeshStandardMaterial({
      color: 0xb0b6bd, roughness: 0.4, metalness: 0.7,
    })
  );
  topPipe.rotation.z = Math.PI / 2;
  topPipe.position.set(cx, deckY + CONFIG.psaHeight + 0.50, 0);
  g.add(topPipe);

  // Small vertical risers from each column top into the green dome
  for (const t of towers) {
    const riser = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.55, 20),
      new THREE.MeshStandardMaterial({ color: 0xb0b6bd, roughness: 0.4, metalness: 0.7 })
    );
    riser.position.set(t.x, deckY + CONFIG.psaHeight + 0.28, 0);
    g.add(riser);
  }

  // Green dome — wide, flat mushroom/onion shape (matches the reference silencer)
  // Build with a wider base ring + a low spherical top
  const domeMat = new THREE.MeshStandardMaterial({
    color: 0x355e3a, roughness: 0.5, metalness: 0.35,
  });

  // Wider, low-profile dome top (scaled hemisphere)
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.85, 36, 20, 0, Math.PI * 2, 0, Math.PI / 2),
    domeMat
  );
  dome.scale.set(1.0, 0.62, 1.0); // flatten vertically
  dome.position.set(cx, deckY + CONFIG.psaHeight + 0.70, 0);
  dome.castShadow = true;
  g.add(dome);

  // Cylindrical neck/rim under the dome (gives the "silencer" body)
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.85, 0.85, 0.20, 36),
    domeMat
  );
  neck.position.set(cx, deckY + CONFIG.psaHeight + 0.60, 0);
  g.add(neck);

  // Small black vent opening on top of dome (matches the chimney-like protrusion)
  const chim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.10, 0.10, 0.18, 20),
    new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.7 })
  );
  chim.position.set(cx, deckY + CONFIG.psaHeight + 1.18, 0);
  g.add(chim);

  // Side mounting flanges where the risers attach to the dome
  for (const t of towers) {
    const flg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.05, 20),
      new THREE.MeshStandardMaterial({ color: 0x8a909a, roughness: 0.4, metalness: 0.7 })
    );
    flg.position.set(t.x, deckY + CONFIG.psaHeight + 0.58, 0);
    g.add(flg);
  }

  // ---- DENSE STAINLESS PIPING MANIFOLD between & in front of the columns ----
  buildPSAManifold(g, cx, deckY);

  scene.add(g);
}

/* ============================ PSA PIPING MANIFOLD ============================ */
function buildPSAManifold(parent, cx, deckY) {
  const pipeMat = new THREE.MeshStandardMaterial({
    color: 0xc6cbd1, roughness: 0.32, metalness: 0.82,
  });
  const flangeMat = new THREE.MeshStandardMaterial({
    color: 0x8a909a, roughness: 0.4, metalness: 0.7,
  });

  // Horizontal stainless pipe sections at multiple heights between/in front of the towers
  const heights = [deckY + 0.45, deckY + 1.05, deckY + 1.75, deckY + 2.55, deckY + 3.35, deckY + 4.10];
  for (const y of heights) {
    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, CONFIG.psaSpacing + 0.3, 20),
      pipeMat
    );
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(cx, y, 0.05);
    pipe.castShadow = true;
    parent.add(pipe);

    // small flanges at each end
    for (const dx of [-CONFIG.psaSpacing / 2, CONFIG.psaSpacing / 2]) {
      const fl = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13, 0.13, 0.06, 20),
        flangeMat
      );
      fl.rotation.z = Math.PI / 2;
      fl.position.set(cx + dx, y, 0.05);
      parent.add(fl);
    }
  }

  // Front-facing vertical drop pipes (dense, like reference)
  const verticalXOffsets = [-0.55, -0.30, -0.10, 0.10, 0.30, 0.55];
  for (const dx of verticalXOffsets) {
    const len = 2.6 + Math.random() * 1.4;
    const v = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.065, len, 18),
      pipeMat
    );
    v.position.set(cx + dx, deckY + 0.4 + len / 2, 0.55);
    v.castShadow = true;
    parent.add(v);
  }

  // Extra connecting horizontal pipes in front (running between the verticals)
  for (const y of [deckY + 1.20, deckY + 2.20, deckY + 3.10]) {
    const fp = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 1.4, 16),
      pipeMat
    );
    fp.rotation.z = Math.PI / 2;
    fp.position.set(cx, y, 0.55);
    parent.add(fp);
  }

  // Z-loop elbows (decorative bends)
  for (let i = 0; i < 4; i++) {
    const elbow = new THREE.Mesh(
      new THREE.TorusGeometry(0.16, 0.06, 12, 24, Math.PI / 2),
      pipeMat
    );
    elbow.rotation.set(Math.PI / 2, 0, i * Math.PI / 2);
    elbow.position.set(cx - 0.6 + i * 0.4, deckY + 0.80, 0.55);
    parent.add(elbow);
  }

  // Bottom inlet/outlet pipes going down to the deck
  for (const dx of [-0.7, 0.7]) {
    const drop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.10, 0.10, 0.5, 18),
      pipeMat
    );
    drop.position.set(cx + dx, deckY + 0.25, 0.55);
    parent.add(drop);
  }

  // Pressure gauges — round white faces on the front of the manifold
  const gaugePositions = [
    { x: cx - 0.55, y: deckY + 2.10, r: 0.16 },
    { x: cx + 0.55, y: deckY + 2.10, r: 0.16 },
    { x: cx - 0.55, y: deckY + 1.30, r: 0.13 },
    { x: cx + 0.55, y: deckY + 1.30, r: 0.13 },
    { x: cx + 0.0,  y: deckY + 2.70, r: 0.18 },
    { x: cx + 0.0,  y: deckY + 0.85, r: 0.13 },
  ];
  for (const gp of gaugePositions) {
    parent.add(makeGauge(gp.x, gp.y, 0.55, gp.r));
  }

  // A few valves with red handwheels along the manifold
  const handleMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626, roughness: 0.5, metalness: 0.2,
  });
  const valvePositions = [
    { x: cx - 0.85, y: deckY + 1.85, z: 0.55 },
    { x: cx + 0.85, y: deckY + 1.85, z: 0.55 },
    { x: cx - 0.85, y: deckY + 0.55, z: 0.55 },
    { x: cx + 0.85, y: deckY + 0.55, z: 0.55 },
  ];
  for (const vp of valvePositions) {
    // valve body
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.18, 0.18),
      flangeMat
    );
    body.position.set(vp.x, vp.y, vp.z);
    parent.add(body);

    // handwheel
    const wheel = new THREE.Mesh(
      new THREE.TorusGeometry(0.10, 0.025, 10, 20),
      handleMat
    );
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(vp.x, vp.y, vp.z + 0.18);
    parent.add(wheel);
    // wheel spokes
    for (let s = 0; s < 4; s++) {
      const spoke = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.012, 0.012),
        handleMat
      );
      spoke.rotation.x = Math.PI / 2;
      spoke.rotation.y = (s * Math.PI) / 4;
      spoke.position.set(vp.x, vp.y, vp.z + 0.18);
      parent.add(spoke);
    }
  }
}

/* ============================ AIR COMPRESSOR (vertical receiver tank) ============================ */
function buildAirCompressorTank() {
  const g = new THREE.Group();
  const deckY = CONFIG.skidHeight + 0.06;
  const x = CONFIG.compressorX;

  // Reference: shorter, fatter vertical receiver behind the booster
  const r = 0.95;
  const h = 2.6;
  const zBack = -0.6;  // sits further back than the booster

  const whiteMat = new THREE.MeshStandardMaterial({
    color: 0xeef0f2, roughness: 0.45, metalness: 0.25,
  });

  // Vertical cylinder body
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, h, 36),
    whiteMat
  );
  body.position.set(x, deckY + h / 2, zBack);
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  // Top hemispherical dome (slightly flattened)
  const top = new THREE.Mesh(
    new THREE.SphereGeometry(r, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    whiteMat
  );
  top.scale.y = 0.72;
  top.position.set(x, deckY + h, zBack);
  g.add(top);

  // Bottom dome
  const bot = new THREE.Mesh(
    new THREE.SphereGeometry(r, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    whiteMat
  );
  bot.scale.y = 0.6;
  bot.position.set(x, deckY, zBack);
  g.add(bot);

  // "AIR COMPRESSOR" label on front
  const lab = makeLabelMesh('AIR\nCOMPRESSOR', 1.15, 0.55, '#1d4ed8', null, 70);
  lab.position.set(x, deckY + h * 0.55, zBack + r + 0.005);
  g.add(lab);

  // Top nozzle
  const nozzle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.10, 0.10, 0.4, 20),
    new THREE.MeshStandardMaterial({ color: 0xb0b6bd, roughness: 0.4, metalness: 0.7 })
  );
  nozzle.position.set(x, deckY + h + 0.45, zBack);
  g.add(nozzle);

  // Side outlet pipe (curving toward manifold)
  const outlet = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 0.6, 18),
    new THREE.MeshStandardMaterial({ color: 0xb0b6bd, roughness: 0.4, metalness: 0.7 })
  );
  outlet.rotation.z = Math.PI / 2;
  outlet.position.set(x - 0.55, deckY + h * 0.30, zBack);
  g.add(outlet);

  // Side gauge
  g.add(makeGauge(x - 0.45, deckY + h * 0.80, zBack + r + 0.005, 0.12));

  scene.add(g);
}

/* ============================ OXYGEN BOOSTER (small blue skid + motor) ============================ */
function buildOxygenBooster() {
  const g = new THREE.Group();
  const deckY = CONFIG.skidHeight + 0.06;
  const x = CONFIG.boosterX;
  const zFront = 0.7; // sits forward, in front of compressor

  const blueMat = new THREE.MeshStandardMaterial({
    color: 0x1d4ed8, roughness: 0.55, metalness: 0.3,
  });

  // Small blue box (the booster skid frame) — tall slim with vertical "OXYGEN BOOSTER" label
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(0.85, 1.4, 0.85),
    blueMat
  );
  box.position.set(x, deckY + 0.7, zFront);
  box.castShadow = true;
  box.receiveShadow = true;
  g.add(box);

  // "OXYGEN BOOSTER" label (white text on blue, vertical-stacked)
  const lab = makeLabelMesh('OXYGEN\nBOOSTER', 0.7, 0.6, '#ffffff', null, 60);
  lab.position.set(x, deckY + 0.75, zFront + 0.43);
  g.add(lab);

  // Motor — horizontal cylinder beside it
  const motor = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.95, 24),
    new THREE.MeshStandardMaterial({
      color: 0x2563eb, roughness: 0.4, metalness: 0.5,
    })
  );
  motor.rotation.z = Math.PI / 2;
  motor.position.set(x + 0.85, deckY + 0.4, zFront);
  motor.castShadow = true;
  g.add(motor);

  // Motor fins (axial ridges suggested by short rings)
  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(
      new THREE.TorusGeometry(0.30, 0.012, 8, 20),
      new THREE.MeshStandardMaterial({ color: 0x1e40af, roughness: 0.5, metalness: 0.4 })
    );
    fin.rotation.y = Math.PI / 2;
    fin.position.set(x + 0.55 + i * 0.20, deckY + 0.4, zFront);
    g.add(fin);
  }

  // Motor fan cover (dark)
  const fan = new THREE.Mesh(
    new THREE.CylinderGeometry(0.20, 0.20, 0.20, 18),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 })
  );
  fan.rotation.z = Math.PI / 2;
  fan.position.set(x + 1.40, deckY + 0.4, zFront);
  g.add(fan);
  animatedSheaves.push(fan);

  // Coupling between motor and pump
  const coupling = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.13, 0.18, 20),
    new THREE.MeshStandardMaterial({ color: 0xb0b6bd, roughness: 0.4, metalness: 0.7 })
  );
  coupling.rotation.z = Math.PI / 2;
  coupling.position.set(x + 0.42, deckY + 0.4, zFront);
  g.add(coupling);

  // Small pump body behind coupling
  const pump = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.45, 0.55),
    new THREE.MeshStandardMaterial({ color: 0xc6cbd1, roughness: 0.4, metalness: 0.6 })
  );
  pump.position.set(x + 0.30, deckY + 0.32, zFront);
  g.add(pump);

  scene.add(g);
}

/* ============================ OXYGEN BUFFER TANKS (2 white, green band) ============================ */
function buildOxygenBufferTanks() {
  const deckY = CONFIG.skidHeight + 0.06;
  const positions = [CONFIG.oxyTank1X, CONFIG.oxyTank2X];

  for (const x of positions) {
    const g = new THREE.Group();
    const r = CONFIG.oxyTankRadius;
    const h = CONFIG.oxyTankHeight;

    const whiteMat = new THREE.MeshStandardMaterial({
      color: 0xeef0f2, roughness: 0.4, metalness: 0.25,
    });

    // Body
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, h, 36),
      whiteMat
    );
    body.position.set(x, deckY + h / 2, 0);
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);

    // Top dome
    const top = new THREE.Mesh(
      new THREE.SphereGeometry(r, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      whiteMat
    );
    top.position.set(x, deckY + h, 0);
    g.add(top);

    // Bottom dome
    const bot = new THREE.Mesh(
      new THREE.SphereGeometry(r, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
      whiteMat
    );
    bot.position.set(x, deckY, 0);
    g.add(bot);

    // Green band near the top (signature of the reference!) — thicker, higher
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(r + 0.008, r + 0.008, 0.40, 36),
      new THREE.MeshStandardMaterial({
        color: 0x2f7a3d, roughness: 0.5, metalness: 0.25,
      })
    );
    band.position.set(x, deckY + h * 0.82, 0);
    g.add(band);

    // "OXYGEN" white text painted on the white body, below the green band
    const lab = makeLabelMesh('OXYGEN', 1.05, 0.22, '#1d4ed8', null, 76);
    lab.position.set(x, deckY + h * 0.70, r + 0.014);
    g.add(lab);

    // Manway flange below the band
    const manway = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 1.05, r * 1.05, 0.06, 36),
      new THREE.MeshStandardMaterial({ color: 0xdadde2, roughness: 0.4, metalness: 0.5 })
    );
    manway.position.set(x, deckY + h * 0.40, 0);
    g.add(manway);

    // Top nozzle
    const nozzle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 0.4, 20),
      new THREE.MeshStandardMaterial({ color: 0xb0b6bd, roughness: 0.4, metalness: 0.7 })
    );
    nozzle.position.set(x, deckY + h + 0.40, 0);
    g.add(nozzle);

    // Side gauge near bottom
    g.add(makeGauge(x, deckY + 0.8, r + 0.012, 0.10));

    scene.add(g);
  }

  // Horizontal pipe connecting tops of the two buffer tanks
  const topConnect = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, CONFIG.oxyTank2X - CONFIG.oxyTank1X + 0.1, 20),
    new THREE.MeshStandardMaterial({ color: 0xb0b6bd, roughness: 0.4, metalness: 0.7 })
  );
  topConnect.rotation.z = Math.PI / 2;
  topConnect.position.set(
    (CONFIG.oxyTank1X + CONFIG.oxyTank2X) / 2,
    deckY + CONFIG.oxyTankHeight + 0.55,
    0
  );
  scene.add(topConnect);
}

/* ============================ O2 CYLINDER RACK ============================ */
function buildO2CylinderRack() {
  const g = new THREE.Group();
  const deckY = CONFIG.skidHeight + 0.06;
  const startX = CONFIG.cylindersX;

  // Reference cylinders are very dark / almost black industrial gas bottles
  const cylMat = new THREE.MeshStandardMaterial({
    color: 0x2a2c30, roughness: 0.35, metalness: 0.85,
  });
  const capMat = new THREE.MeshStandardMaterial({
    color: 0x6b6f76, roughness: 0.4, metalness: 0.7,
  });
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x9aa0a8, roughness: 0.45, metalness: 0.7,
  });

  const cylR = 0.22;
  const cylH = 2.3;
  const spacing = 0.52;

  for (let i = 0; i < 3; i++) {
    const cx = startX + i * spacing;
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(cylR, cylR, cylH, 28),
      cylMat
    );
    body.position.set(cx, deckY + cylH / 2, 0);
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);

    // Domed top (shoulder)
    const top = new THREE.Mesh(
      new THREE.SphereGeometry(cylR, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      cylMat
    );
    top.scale.y = 0.75;
    top.position.set(cx, deckY + cylH, 0);
    g.add(top);

    // Valve neck (narrow)
    const valveNeck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 0.22, 16),
      capMat
    );
    valveNeck.position.set(cx, deckY + cylH + 0.16, 0);
    g.add(valveNeck);

    // Valve handle (small wheel)
    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(0.08, 0.018, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0x6b6f76, roughness: 0.45, metalness: 0.6 })
    );
    handle.rotation.x = Math.PI / 2;
    handle.position.set(cx + 0.10, deckY + cylH + 0.20, 0);
    g.add(handle);

    // "O₂" label in white at mid-body
    const lab = makeLabelMesh('O₂', 0.28, 0.26, '#ffffff', null, 160);
    lab.position.set(cx, deckY + cylH * 0.45, cylR + 0.005);
    g.add(lab);
  }

  // ---- Frame around cylinders (vertical posts + horizontal restraint bars) ----
  const totalW = 3 * spacing + 0.20;
  const cxCenter = startX + spacing;

  // Vertical corner posts (front-left, front-right, back-left, back-right)
  for (const px of [startX - 0.30, startX + 3 * spacing - 0.20]) {
    for (const pz of [-cylR - 0.10, cylR + 0.10]) {
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, cylH + 0.4, 0.07),
        frameMat
      );
      post.position.set(px, deckY + (cylH + 0.4) / 2, pz);
      post.castShadow = true;
      g.add(post);
    }
  }

  // Horizontal restraint bars (top + mid)
  for (const y of [deckY + 0.50, deckY + cylH - 0.2, deckY + cylH + 0.2]) {
    for (const z of [-cylR - 0.10, cylR + 0.10]) {
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(totalW, 0.06, 0.06),
        frameMat
      );
      bar.position.set(cxCenter, y, z);
      g.add(bar);
    }
  }

  scene.add(g);
}

/* ============================ FLOOR PIPING + FLOW MARKERS ============================ */
function buildFloorPipingFlow() {
  const deckY = CONFIG.skidHeight + 0.06;
  const pipeMat = new THREE.MeshStandardMaterial({
    color: 0xc6cbd1, roughness: 0.35, metalness: 0.8,
  });

  // A few low cross-skid pipes connecting equipment along the deck (just visual cues)
  const longPipe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, CONFIG.skidWidth - 2, 18),
    pipeMat
  );
  longPipe.rotation.z = Math.PI / 2;
  longPipe.position.set(0, deckY + 0.18, -CONFIG.skidDepth / 2 + 0.6);
  scene.add(longPipe);

  // A second floor pipe in front
  const longPipe2 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, CONFIG.skidWidth - 3, 18),
    pipeMat
  );
  longPipe2.rotation.z = Math.PI / 2;
  longPipe2.position.set(0, deckY + 0.10, CONFIG.skidDepth / 2 - 0.7);
  scene.add(longPipe2);

  // Flow markers (small glowing cyan spheres travelling along the rear pipe)
  for (let i = 0; i < 3; i++) {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 12, 12),
      new THREE.MeshStandardMaterial({
        color: 0x22d3ee, emissive: 0x22d3ee, emissiveIntensity: 0.8,
      })
    );
    const startX = -CONFIG.skidWidth / 2 + 1;
    const endX = CONFIG.skidWidth / 2 - 1;
    marker.position.set(startX, deckY + 0.18, -CONFIG.skidDepth / 2 + 0.6);
    marker.userData = {
      axis: 'x', startX, endX,
      progress: i / 3,
      speed: 0.0035,
    };
    flowMarkers.push(marker);
    scene.add(marker);
  }
}

/* ============================ HELPERS: Gauge, Label ============================ */
function makeGauge(x, y, z, radius) {
  const g = new THREE.Group();

  // White face
  const face = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 32),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })
  );
  face.position.set(x, y, z);
  g.add(face);

  // Black bezel ring
  const bezel = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.95, radius * 1.08, 32),
    new THREE.MeshStandardMaterial({ color: 0x222222, side: THREE.DoubleSide })
  );
  bezel.position.set(x, y, z + 0.001);
  g.add(bezel);

  // Needle (rotated, animated)
  const needle = new THREE.Mesh(
    new THREE.BoxGeometry(radius * 0.75, radius * 0.10, 0.003),
    new THREE.MeshStandardMaterial({
      color: 0xdc2626, emissive: 0x441111, roughness: 0.5,
    })
  );
  needle.position.set(x, y, z + 0.003);
  const baseRotation = -Math.PI / 4 - Math.random() * Math.PI / 2;
  needle.rotation.z = baseRotation;
  needle.userData = {
    baseRotation,
    wobbleSpeed: 1.0 + Math.random() * 1.2,
    wobbleAmp: 0.15 + Math.random() * 0.10,
    phase: Math.random() * Math.PI * 2,
  };
  animatedNeedles.push(needle);
  g.add(needle);

  // Hub
  const hub = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 0.10, 16),
    new THREE.MeshStandardMaterial({ color: 0x111111 })
  );
  hub.position.set(x, y, z + 0.004);
  g.add(hub);

  return g;
}

function makeLabelMesh(text, planeW, planeH, fg = '#1d4ed8', bg = null, size = 60) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.fillStyle = fg;
  ctx.font = `bold ${size}px "Arial Black", "Arial", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const lines = text.split('\n');
  const lineH = size * 1.15;
  const startY = canvas.height / 2 - ((lines.length - 1) / 2) * lineH;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], canvas.width / 2, startY + i * lineH);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
  return new THREE.Mesh(new THREE.PlaneGeometry(planeW, planeH), mat);
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

  for (const sheave of animatedSheaves) {
    sheave.rotation.x += 0.20;
  }

  const phase = (t / CONFIG.swingPeriodSec) * Math.PI * 2;

  for (const ring of psaColumnLights) {
    const local = phase + (ring.userData.phase || 0);
    const isAdsorbing = Math.sin(local) > 0;
    const targetColor = isAdsorbing ? 0x22c55e : 0xfacc15;
    ring.material.color.setHex(targetColor);
    ring.material.emissive.setHex(targetColor);
    ring.material.emissiveIntensity = 0.55 + Math.sin(t * 3 + local) * 0.15;
  }

  for (const led of animatedLEDs) {
    const u = led.userData;
    led.material.emissiveIntensity = u.baseIntensity + Math.sin(t * 2 + u.phase) * 0.15;
  }

  for (const n of animatedNeedles) {
    const u = n.userData;
    n.rotation.z = u.baseRotation + Math.sin(t * u.wobbleSpeed + u.phase) * u.wobbleAmp;
  }

  for (const fm of flowMarkers) {
    const u = fm.userData;
    u.progress += u.speed;
    if (u.progress > 1) u.progress = 0;
    fm.position.x = u.startX + (u.endX - u.startX) * u.progress;
    fm.material.emissiveIntensity = 0.6 + Math.sin(t * 5 + u.progress * 10) * 0.3;
  }

  if (autoRotateEnabled && (Date.now() - lastUserInteraction) > 6000) {
    // Gentle sway around front-on view rather than full orbit
    camera.position.x = Math.sin(t * 0.18) * 2.4;
    camera.position.z = 20.5 - Math.cos(t * 0.18) * 0.4;
    camera.position.y = 4.5 + Math.sin(t * 0.12) * 0.15;
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
const OXYGEN_SLIDE_INDEX = 9;  // Slide 10 (data-slide="10"), 0-based DOM index = 9

window.addEventListener('slidechange', (e) => {
  if (e.detail.index === OXYGEN_SLIDE_INDEX) {
    init();
    setTimeout(onResize, 50);
    startRendering();
  } else {
    stopRendering();
  }
});

// Auto-start if the slide is already active when this script loads
if (document.querySelector(`.slide[data-slide="10"]`)?.classList.contains('active')) {
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
  animatedNeedles.length = 0;
  animatedLEDs.length = 0;
  psaColumnLights.length = 0;
  flowMarkers.length = 0;
  animatedSheaves.length = 0;
  renderer = null;
  scene = null;
  camera = null;
  controls = null;
  canvas = null;
  initialized = false;
}

window.threeOxygen = {
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
