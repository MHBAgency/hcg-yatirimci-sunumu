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
  skidWidth: 18.6,
  skidDepth: 6.0,
  skidHeight: 0.55,

  // X anchors (centered around 0), front-on view
  panelX:       -7.6,   // control cabinet
  psaCenterX:   -3.8,   // midpoint between PSA A and B
  psaSpacing:    2.6,   // distance between A and B (wider for visible manifold)
  manifoldX:    -3.8,   // piping manifold sits between A and B
  compressorX:   0.2,   // vertical AIR COMPRESSOR tank
  boosterX:      1.6,   // small blue booster skid
  oxyTank1X:     3.4,   // OXYGEN buffer #1
  oxyTank2X:     4.9,   // OXYGEN buffer #2
  cylindersX:    6.6,   // O2 cylinder rack

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
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.Fog(0x000000, 42, 100);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  // Camera — front-on, slight elevation, tighter framing to match the reference photo
  camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 200);
  camera.position.set(0, 3.6, 17.5);
  camera.lookAt(0, 2.6, 0);

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 11;
  controls.maxDistance = 32;
  controls.minPolarAngle = Math.PI * 0.18;
  controls.maxPolarAngle = Math.PI * 0.52;
  controls.target.set(0, 2.6, 0);
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

  const key = new THREE.DirectionalLight(0xffffff, 1.7);
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

  const fill = new THREE.DirectionalLight(0xc9d8e8, 0.65);
  fill.position.set(-10, 8, 6);
  scene.add(fill);

  const back = new THREE.DirectionalLight(0xffe0b0, 0.35);
  back.position.set(0, 10, -14);
  scene.add(back);
}

/* ============================ BACKDROP ============================ */
function buildBackdrop() {
  // Backdrop intentionally empty — pure black background behind the facility.
}

/* ============================ GROUND & SKID ============================ */
function buildGroundAndSkid() {
  // Gravel mining pad
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 220),
    new THREE.MeshStandardMaterial({
      color: 0x9b8a72,
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

    // Forklift pockets: dark rectangular openings on the front beam
    if (z > 0) {
      const pocketMat = new THREE.MeshStandardMaterial({ color: 0x0a1626, roughness: 0.9 });
      for (const px of [-CONFIG.skidWidth * 0.30, -CONFIG.skidWidth * 0.10,
                         CONFIG.skidWidth * 0.10, CONFIG.skidWidth * 0.30]) {
        const pocket = new THREE.Mesh(
          new THREE.BoxGeometry(0.50, 0.10, 0.05),
          pocketMat
        );
        pocket.position.set(px, 0.09, z + 0.16);
        skidGroup.add(pocket);
      }
    }
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

  // Cable ladder coming out of the cabinet right side, running down toward the deck
  const ladderMat = new THREE.MeshStandardMaterial({
    color: 0x9aa0a8, roughness: 0.5, metalness: 0.6,
  });
  const ladderRailLen = 1.6;
  const ladderY = deckY + h * 0.5;
  for (const zr of [-0.10, 0.10]) {  // two side-rails of the ladder
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(ladderRailLen, 0.05, 0.04),
      ladderMat
    );
    rail.position.set(x + w / 2 + 0.05 + ladderRailLen / 2, ladderY, zr);
    g.add(rail);
  }
  // Rungs / cable trays
  for (let i = 0; i < 6; i++) {
    const rung = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.04, 0.24),
      ladderMat
    );
    rung.position.set(x + w / 2 + 0.20 + i * 0.26, ladderY, 0);
    g.add(rung);
  }

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

    // Pressure safety valve on tower body (just below the top dome, on +Z side)
    const psvStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.20, 14),
      new THREE.MeshStandardMaterial({ color: 0x8a909a, roughness: 0.4, metalness: 0.7 })
    );
    psvStem.rotation.x = Math.PI / 2;
    psvStem.position.set(t.x, deckY + CONFIG.psaHeight - 0.30, CONFIG.psaRadius + 0.10);
    g.add(psvStem);

    const psvBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.22, 16),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.5, metalness: 0.3 })
    );
    psvBody.rotation.x = Math.PI / 2;
    psvBody.position.set(t.x, deckY + CONFIG.psaHeight - 0.30, CONFIG.psaRadius + 0.30);
    g.add(psvBody);

    // PSV vent stack (short pipe pointing up)
    const psvVent = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.30, 12),
      new THREE.MeshStandardMaterial({ color: 0xb0b6bd, roughness: 0.4, metalness: 0.7 })
    );
    psvVent.position.set(t.x, deckY + CONFIG.psaHeight - 0.15, CONFIG.psaRadius + 0.30);
    g.add(psvVent);
  }

  // ---- Top piping chain that physically links: tower top → riser → horizontal
  //      distributor → vertical neck → green silencer dome ----
  const topPipeMat = new THREE.MeshStandardMaterial({
    color: 0xb0b6bd, roughness: 0.4, metalness: 0.7,
  });
  const topFlangeMat = new THREE.MeshStandardMaterial({
    color: 0x8a909a, roughness: 0.4, metalness: 0.7,
  });

  // Short risers up from each tower top
  const riserH = 0.32;
  const distY = deckY + CONFIG.psaHeight + riserH + 0.28; // center Y of horizontal distributor

  for (const t of towers) {
    // Flange on tower head (riser-base coupling)
    const flBot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.20, 0.20, 0.06, 22),
      topFlangeMat
    );
    flBot.position.set(t.x, deckY + CONFIG.psaHeight + 0.03, 0);
    g.add(flBot);

    // Riser itself
    const riser = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.13, riserH, 22),
      topPipeMat
    );
    riser.position.set(t.x, deckY + CONFIG.psaHeight + riserH / 2, 0);
    g.add(riser);

    // Tee fitting where riser meets the horizontal distributor (slightly oversized)
    const tee = new THREE.Mesh(
      new THREE.CylinderGeometry(0.20, 0.20, 0.22, 22),
      topFlangeMat
    );
    tee.position.set(t.x, deckY + CONFIG.psaHeight + riserH + 0.05, 0);
    g.add(tee);
  }

  // Horizontal distributor cylinder spanning the two towers
  const distLen = CONFIG.psaSpacing + 0.50;
  const distributor = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, distLen, 28),
    topPipeMat
  );
  distributor.rotation.z = Math.PI / 2;
  distributor.position.set(cx, distY, 0);
  distributor.castShadow = true;
  g.add(distributor);

  // End caps on distributor (hemispherical)
  for (const sx of [-1, 1]) {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      topPipeMat
    );
    cap.rotation.z = sx === -1 ? -Math.PI / 2 : Math.PI / 2;
    cap.position.set(cx + sx * (distLen / 2), distY, 0);
    g.add(cap);
  }

  // Green silencer dome assembly — sits on a central neck risers from the distributor
  const domeMat = new THREE.MeshStandardMaterial({
    color: 0x355e3a, roughness: 0.5, metalness: 0.35,
  });

  // Vertical neck riser from distributor TOP up to dome base
  const neckRiserH = 0.30;
  const neckRiser = new THREE.Mesh(
    new THREE.CylinderGeometry(0.20, 0.20, neckRiserH, 22),
    topPipeMat
  );
  neckRiser.position.set(cx, distY + 0.22 + neckRiserH / 2, 0);
  g.add(neckRiser);

  // Cylindrical silencer body (the green "drum")
  const domeBodyH = 0.22;
  const domeBodyY = distY + 0.22 + neckRiserH + domeBodyH / 2;
  const domeBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.72, 0.72, domeBodyH, 32),
    domeMat
  );
  domeBody.position.set(cx, domeBodyY, 0);
  g.add(domeBody);

  // Dome top (hemisphere, slightly flattened — the mushroom cap)
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.72, 36, 20, 0, Math.PI * 2, 0, Math.PI / 2),
    domeMat
  );
  dome.scale.set(1.0, 0.72, 1.0);
  dome.position.set(cx, domeBodyY + domeBodyH / 2, 0);
  dome.castShadow = true;
  g.add(dome);

  // Small black vent chimney on top of dome
  const domeTopY = domeBodyY + domeBodyH / 2 + 0.72 * 0.72; // base + flattened-hemi height
  const chim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 0.18, 18),
    new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.7 })
  );
  chim.position.set(cx, domeTopY + 0.09, 0);
  g.add(chim);

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

  const half = CONFIG.psaSpacing / 2;

  // ---- SCAFFOLD: 4 blue I-beam posts at corners of manifold + 2 horizontal cross-braces ----
  // These visually carry the front-header rectangle and the manifold piping.
  const scaffoldMat = new THREE.MeshStandardMaterial({
    color: 0x1f4e8e, roughness: 0.5, metalness: 0.4,
  });

  const scaffH = 4.30;                     // post height (above deck)
  const scaffZ = 0.62 + 0.10;              // posts sit just behind the front header (header z=0.62)
  const headerLenForScaff = CONFIG.psaSpacing + 0.20;
  const scaffXLeft = cx - headerLenForScaff / 2 - 0.05;
  const scaffXRight = cx + headerLenForScaff / 2 + 0.05;

  // 4 vertical posts (front-left, front-right, back-left, back-right)
  for (const px of [scaffXLeft, scaffXRight]) {
    for (const pz of [scaffZ, -0.05]) {   // front post + back post (back posts hug the towers' edge)
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.10, scaffH, 0.10),
        scaffoldMat
      );
      post.position.set(px, deckY + scaffH / 2, pz);
      post.castShadow = true;
      parent.add(post);
    }

    // Diagonal X-brace on the side panel (front-post to back-post)
    const diagLen = Math.hypot(scaffZ + 0.05, scaffH * 0.55);
    const diag = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, diagLen, 0.05),
      scaffoldMat
    );
    diag.position.set(px, deckY + scaffH * 0.40, (scaffZ - 0.05) / 2);
    diag.rotation.x = Math.atan2(scaffH * 0.55, scaffZ + 0.05);
    parent.add(diag);
  }

  // Horizontal cross-braces at top connecting the 4 posts (front + back rail at roof of scaffold)
  for (const cz of [scaffZ, -0.05]) {
    const crossTop = new THREE.Mesh(
      new THREE.BoxGeometry(scaffXRight - scaffXLeft, 0.08, 0.08),
      scaffoldMat
    );
    crossTop.position.set(cx, deckY + scaffH + 0.04, cz);
    parent.add(crossTop);
  }

  // Lateral roof beams (front-to-back at each end)
  for (const px of [scaffXLeft, scaffXRight]) {
    const sideTop = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, scaffZ + 0.05),
      scaffoldMat
    );
    sideTop.position.set(px, deckY + scaffH + 0.04, (scaffZ - 0.05) / 2);
    parent.add(sideTop);
  }

  // ---- BACK CROSS-PIPES (z ≈ 0, between the two towers) ----
  // Each one ends on a Tee/flange that visually penetrates each tower wall.
  const backHeights = [
    deckY + 0.55, deckY + 1.20, deckY + 2.00,
    deckY + 2.80, deckY + 3.55, deckY + 4.20,
  ];
  const backLen = CONFIG.psaSpacing - 0.05; // slightly inside the towers
  for (const y of backHeights) {
    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.085, 0.085, backLen, 20),
      pipeMat
    );
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(cx, y, 0);
    pipe.castShadow = true;
    parent.add(pipe);

    // Penetration flanges on each tower wall
    for (const sx of [-1, 1]) {
      const flg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.135, 0.135, 0.07, 20),
        flangeMat
      );
      flg.rotation.z = Math.PI / 2;
      flg.position.set(cx + sx * half, y, 0);
      parent.add(flg);
    }
  }

  // ---- FRONT HEADER RECTANGLE — every front pipe terminates on this frame ----
  const frontZ = 0.62;
  const headerLen = CONFIG.psaSpacing + 0.20;
  const headerTopY = deckY + 3.90;
  const headerBotY = deckY + 0.55;
  const xLeft  = cx - headerLen / 2;
  const xRight = cx + headerLen / 2;

  // Top + bottom horizontal headers
  for (const y of [headerTopY, headerBotY]) {
    const h = new THREE.Mesh(
      new THREE.CylinderGeometry(0.085, 0.085, headerLen, 20),
      pipeMat
    );
    h.rotation.z = Math.PI / 2;
    h.position.set(cx, y, frontZ);
    h.castShadow = true;
    parent.add(h);
  }

  // 4 vertical risers between top & bottom header
  const vertX = [xLeft + 0.08, cx - 0.42, cx + 0.42, xRight - 0.08];
  for (const x of vertX) {
    const v = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, headerTopY - headerBotY, 18),
      pipeMat
    );
    v.position.set(x, (headerTopY + headerBotY) / 2, frontZ);
    v.castShadow = true;
    parent.add(v);

    // Tee fittings at the two header intersections
    for (const y of [headerTopY, headerBotY]) {
      const tee = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.11, 0.14, 18),
        flangeMat
      );
      tee.position.set(x, y, frontZ);
      parent.add(tee);
    }
  }

  // 2 mid-height horizontal cross pipes connecting the inner verticals
  for (const y of [deckY + 1.60, deckY + 2.80]) {
    const cp = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, vertX[2] - vertX[1], 16),
      pipeMat
    );
    cp.rotation.z = Math.PI / 2;
    cp.position.set((vertX[1] + vertX[2]) / 2, y, frontZ);
    parent.add(cp);
  }

  // Front-to-back cross-links so the front header is physically tied to the back cross-pipes
  // (z-axis stubs at top corners)
  for (const x of [xLeft + 0.08, xRight - 0.08]) {
    for (const y of [headerTopY, headerBotY]) {
      const link = new THREE.Mesh(
        new THREE.CylinderGeometry(0.075, 0.075, frontZ, 16),
        pipeMat
      );
      link.rotation.x = Math.PI / 2;
      link.position.set(x, y, frontZ / 2);
      parent.add(link);
    }
  }

  // ---- BOTTOM DROP PIPES — outer header corners go down to deck ----
  for (const x of [xLeft + 0.08, xRight - 0.08]) {
    const drop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.085, 0.085, headerBotY - deckY, 18),
      pipeMat
    );
    drop.position.set(x, deckY + (headerBotY - deckY) / 2, frontZ);
    parent.add(drop);

    // Floor flange where it lands on the deck
    const fl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.13, 0.05, 20),
      flangeMat
    );
    fl.position.set(x, deckY + 0.025, frontZ);
    parent.add(fl);
  }

  // ---- VALVES — built around an actual pass-through pipe segment ----
  const handleMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626, roughness: 0.5, metalness: 0.2,
  });

  // Place 2 valves on the front lower-header pipe, 2 on inner verticals
  const valves = [
    { x: cx - 0.70, y: headerBotY, z: frontZ, axis: 'x' },
    { x: cx + 0.70, y: headerBotY, z: frontZ, axis: 'x' },
    { x: vertX[1], y: deckY + 2.20, z: frontZ, axis: 'y' },
    { x: vertX[2], y: deckY + 2.20, z: frontZ, axis: 'y' },
  ];
  for (const vp of valves) {
    // Valve body — short cylinder oriented along the pipe it sits on
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.24, 22),
      flangeMat
    );
    if (vp.axis === 'x') body.rotation.z = Math.PI / 2;
    body.position.set(vp.x, vp.y, vp.z);
    parent.add(body);

    // Bonnet — short stem perpendicular to the pipe, pointing AWAY from the deck
    const bonnetDir = vp.axis === 'x' ? [0, 1, 0] : [0, 0, 1];
    const bonnet = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.06, 0.16, 16),
      flangeMat
    );
    if (vp.axis === 'y') bonnet.rotation.x = Math.PI / 2;
    bonnet.position.set(
      vp.x + bonnetDir[0] * 0.18,
      vp.y + bonnetDir[1] * 0.18,
      vp.z + bonnetDir[2] * 0.18
    );
    parent.add(bonnet);

    // Handwheel + spokes at end of bonnet
    const wheelPos = [
      vp.x + bonnetDir[0] * 0.30,
      vp.y + bonnetDir[1] * 0.30,
      vp.z + bonnetDir[2] * 0.30,
    ];
    const wheel = new THREE.Mesh(
      new THREE.TorusGeometry(0.11, 0.022, 10, 22),
      handleMat
    );
    if (vp.axis === 'x') wheel.rotation.y = 0; // wheel facing front
    else { wheel.rotation.x = Math.PI / 2; }
    wheel.position.set(wheelPos[0], wheelPos[1], wheelPos[2]);
    parent.add(wheel);
    for (let s = 0; s < 4; s++) {
      const spoke = new THREE.Mesh(
        new THREE.BoxGeometry(0.20, 0.012, 0.012),
        handleMat
      );
      if (vp.axis === 'y') spoke.rotation.x = Math.PI / 2;
      spoke.rotation.y = (s * Math.PI) / 4;
      spoke.position.set(wheelPos[0], wheelPos[1], wheelPos[2]);
      parent.add(spoke);
    }
  }

  // ---- PRESSURE GAUGES — each on a small backplate + short nipple coming out of a pipe ----
  const gauges = [
    { x: cx - 0.55, y: deckY + 2.10, r: 0.13 },
    { x: cx + 0.55, y: deckY + 2.10, r: 0.13 },
    { x: cx - 0.20, y: deckY + 3.30, r: 0.11 },
    { x: cx + 0.20, y: deckY + 3.30, r: 0.11 },
    { x: cx,        y: deckY + 1.05, r: 0.15 },
  ];
  for (const gp of gauges) {
    // Nipple coming out of the nearest pipe (just behind the gauge)
    const nipple = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.028, 0.10, 12),
      flangeMat
    );
    nipple.rotation.x = Math.PI / 2;
    nipple.position.set(gp.x, gp.y, frontZ + 0.05);
    parent.add(nipple);

    // Backplate behind gauge
    const back = new THREE.Mesh(
      new THREE.CylinderGeometry(gp.r * 1.18, gp.r * 1.18, 0.02, 22),
      flangeMat
    );
    back.rotation.x = Math.PI / 2;
    back.position.set(gp.x, gp.y, frontZ + 0.095);
    parent.add(back);

    // Gauge face mounted on top of backplate
    parent.add(makeGauge(gp.x, gp.y, frontZ + 0.11, gp.r));
  }
}

/* ============================ AIR COMPRESSOR (vertical receiver tank) ============================ */
function buildAirCompressorTank() {
  const g = new THREE.Group();
  const deckY = CONFIG.skidHeight + 0.06;
  const x = CONFIG.compressorX;

  // Reference: shorter, fatter vertical receiver, central and slightly forward
  const r = 0.95;
  const h = 2.6;
  const zBack = 0.1;   // central, just forward of PSA back-plane

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

  // Pop-up pressure safety valve on top of compressor
  const compPsv = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 0.20, 16),
    new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.5, metalness: 0.3 })
  );
  compPsv.position.set(x + 0.30, deckY + h + 0.30, zBack);
  g.add(compPsv);

  const compPsvCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 16, 10),
    new THREE.MeshStandardMaterial({ color: 0x6b6f76, roughness: 0.4, metalness: 0.7 })
  );
  compPsvCap.position.set(x + 0.30, deckY + h + 0.45, zBack);
  g.add(compPsvCap);

  // Side gauge
  g.add(makeGauge(x - 0.45, deckY + h * 0.80, zBack + r + 0.005, 0.12));

  // ---- Outlet pipe routed: compressor side → forward → left into PSA manifold front-right ----
  const stainlessMat = new THREE.MeshStandardMaterial({
    color: 0xb0b6bd, roughness: 0.4, metalness: 0.7,
  });
  const flangeMat = new THREE.MeshStandardMaterial({
    color: 0x8a909a, roughness: 0.4, metalness: 0.7,
  });

  // ---- Outlet route: compressor wall → flange → -X straight run → manifold front header ----
  // With compressor now co-planar with the manifold (zBack ≈ 0.1, manifold front-Z ≈ 0.62),
  // we use a short -Z dip via two 90° elbows so the pipe arrives ON the front header plane.
  const stubY = deckY + h * 0.40;
  const stubStartX = x - r;
  const targetZ = 0.62;
  const elbowR = 0.12;

  // Flange on compressor wall
  const flWall = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.13, 0.06, 18),
    flangeMat
  );
  flWall.rotation.z = Math.PI / 2;
  flWall.position.set(stubStartX + 0.03, stubY, zBack);
  g.add(flWall);

  // Stub OUT of compressor wall (short -X segment)
  const stubEndX = stubStartX - 0.40;
  const stub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, 0.40, 18),
    stainlessMat
  );
  stub.rotation.z = Math.PI / 2;
  stub.position.set((stubStartX + stubEndX) / 2, stubY, zBack);
  g.add(stub);

  // 90° elbow at corner: -X → +Z
  const elbow1 = new THREE.Mesh(
    new THREE.TorusGeometry(elbowR, 0.075, 12, 22, Math.PI / 2),
    stainlessMat
  );
  elbow1.rotation.y = Math.PI / 2;
  elbow1.position.set(stubEndX, stubY, zBack + elbowR);
  g.add(elbow1);

  // +Z forward jog to reach front header plane
  const jogStartZ = zBack + elbowR;
  const jogEndZ = targetZ - elbowR;
  const jogLen = jogEndZ - jogStartZ;
  if (jogLen > 0) {
    const jog = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.075, jogLen, 18),
      stainlessMat
    );
    jog.rotation.x = Math.PI / 2;
    jog.position.set(stubEndX, stubY, (jogStartZ + jogEndZ) / 2);
    g.add(jog);
  }

  // 90° elbow at corner: +Z → -X (toward PSA)
  const elbow2 = new THREE.Mesh(
    new THREE.TorusGeometry(elbowR, 0.075, 12, 22, Math.PI / 2),
    stainlessMat
  );
  elbow2.rotation.x = Math.PI / 2;
  elbow2.rotation.z = Math.PI;
  elbow2.position.set(stubEndX - elbowR, stubY, jogEndZ + elbowR);
  g.add(elbow2);

  // Long horizontal run at frontZ toward PSA manifold's right header end
  const manifoldRightX = CONFIG.psaCenterX + (CONFIG.psaSpacing + 0.20) / 2 - 0.08;
  const longStart = stubEndX - elbowR;
  const longEnd = manifoldRightX + 0.10;
  const longLen = longStart - longEnd;
  const longPipe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, longLen, 18),
    stainlessMat
  );
  longPipe.rotation.z = Math.PI / 2;
  longPipe.position.set((longStart + longEnd) / 2, stubY, targetZ);
  longPipe.castShadow = true;
  g.add(longPipe);

  scene.add(g);
}

/* ============================ OXYGEN BOOSTER (small blue skid + motor) ============================ */
function buildOxygenBooster() {
  const g = new THREE.Group();
  const deckY = CONFIG.skidHeight + 0.06;
  const x = CONFIG.boosterX;
  const zFront = 1.0; // sits forward, clearly in front of compressor

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

  // ---- Suction line from booster pump back to deck level (and compressor area) ----
  const stainlessMat = new THREE.MeshStandardMaterial({
    color: 0xb0b6bd, roughness: 0.4, metalness: 0.7,
  });

  // Vertical drop from pump to deck (booster suction inlet)
  const sucDrop = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 0.32, 16),
    stainlessMat
  );
  sucDrop.position.set(x + 0.30, deckY + 0.16, zFront - 0.30);
  g.add(sucDrop);

  // Short horizontal segment going BACK toward compressor at deck level
  const sucBack = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 0.9, 16),
    stainlessMat
  );
  sucBack.rotation.x = Math.PI / 2;
  sucBack.position.set(x + 0.30, deckY + 0.10, zFront - 0.75);
  g.add(sucBack);

  // ---- Discharge line from booster pump → routed via a back-jog to oxygen tank #1 ----
  // The line must end ON the tank surface (z ≈ tankRadius+pipe), not floating in air.

  // Vertical riser from pump top
  const discRiserY = deckY + 0.60;
  const discRiser = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 0.40, 16),
    stainlessMat
  );
  discRiser.position.set(x + 0.45, discRiserY, zFront);
  g.add(discRiser);

  // -Z back-jog from booster discharge depth (zFront ≈ 1.0) to tank centerline (z=0)
  // so the line enters tank #1's LEFT side wall, not its front-corner.
  const tankSideZ = 0;
  const jogLen = zFront - tankSideZ;
  if (jogLen > 0) {
    const discJog = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, jogLen, 16),
      stainlessMat
    );
    discJog.rotation.x = Math.PI / 2;
    discJog.position.set(x + 0.45, deckY + 0.80, zFront - jogLen / 2);
    g.add(discJog);
  }

  // Horizontal +X run from booster column to oxyTank #1 side nozzle
  const discRunStart = x + 0.45;
  const discRunEnd = CONFIG.oxyTank1X - CONFIG.oxyTankRadius - 0.05;
  const discRunLen = discRunEnd - discRunStart;
  if (discRunLen > 0) {
    const discRun = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, discRunLen, 16),
      stainlessMat
    );
    discRun.rotation.z = Math.PI / 2;
    discRun.position.set((discRunStart + discRunEnd) / 2, deckY + 0.80, tankSideZ);
    g.add(discRun);

    // Side-wall nozzle flange (axis along X, perpendicular to vertical tank wall)
    const flNoz = new THREE.Mesh(
      new THREE.CylinderGeometry(0.095, 0.095, 0.06, 16),
      new THREE.MeshStandardMaterial({ color: 0x8a909a, roughness: 0.4, metalness: 0.7 })
    );
    flNoz.rotation.z = Math.PI / 2;
    flNoz.position.set(discRunEnd + 0.03, deckY + 0.80, tankSideZ);
    g.add(flNoz);
  }

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

  // ---- Horizontal pipe connecting tops of the two buffer tanks (with risers & tees) ----
  const stainlessMat = new THREE.MeshStandardMaterial({
    color: 0xb0b6bd, roughness: 0.4, metalness: 0.7,
  });
  const flangeMat = new THREE.MeshStandardMaterial({
    color: 0x8a909a, roughness: 0.4, metalness: 0.7,
  });

  const topY = deckY + CONFIG.oxyTankHeight + 0.30;

  // Short vertical riser on each tank — from existing nozzle up to the cross-pipe
  for (const tx of [CONFIG.oxyTank1X, CONFIG.oxyTank2X]) {
    const riser = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.55, 16),
      stainlessMat
    );
    riser.position.set(tx, deckY + CONFIG.oxyTankHeight + 0.30, 0);
    scene.add(riser);

    // Tee fitting where horizontal cross-pipe meets the riser
    const tee = new THREE.Mesh(
      new THREE.CylinderGeometry(0.10, 0.10, 0.14, 16),
      flangeMat
    );
    tee.position.set(tx, topY + 0.25, 0);
    scene.add(tee);
  }

  // Horizontal cross-pipe lying ON TOP of the tees
  const topConnect = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, CONFIG.oxyTank2X - CONFIG.oxyTank1X + 0.30, 20),
    stainlessMat
  );
  topConnect.rotation.z = Math.PI / 2;
  topConnect.position.set(
    (CONFIG.oxyTank1X + CONFIG.oxyTank2X) / 2,
    topY + 0.25,
    0
  );
  scene.add(topConnect);

  // ---- O₂ FEEDER TRUNK: PSA manifold top header → buffer-tank cross-pipe ----
  // Without this, the oxygen has no visible path from the PSA stage to storage.
  const trunkY  = topY + 0.25;            // matches existing topConnect height
  const psaOutX = CONFIG.psaCenterX + (CONFIG.psaSpacing + 0.20) / 2 - 0.08;
  const psaOutY = deckY + 3.90;           // headerTopY in the PSA manifold
  const psaOutZ = 0.62;                   // frontZ in the PSA manifold

  // 1) Vertical riser from manifold top header up to trunk altitude
  const trunkRiser = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, trunkY - psaOutY, 18),
    stainlessMat
  );
  trunkRiser.position.set(psaOutX, (psaOutY + trunkY) / 2, psaOutZ);
  trunkRiser.castShadow = true;
  scene.add(trunkRiser);

  // Tee on top of the riser where the trunk turns horizontal
  const trunkTeeTop = new THREE.Mesh(
    new THREE.CylinderGeometry(0.10, 0.10, 0.14, 16),
    flangeMat
  );
  trunkTeeTop.position.set(psaOutX, trunkY, psaOutZ);
  scene.add(trunkTeeTop);

  // 2) -Z back-jog: frontZ → centerline (z=0)
  const trunkJog = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, psaOutZ, 18),
    stainlessMat
  );
  trunkJog.rotation.x = Math.PI / 2;
  trunkJog.position.set(psaOutX, trunkY, psaOutZ / 2);
  scene.add(trunkJog);

  // Elbow flange where jog meets the long horizontal trunk
  const trunkTeeCorner = new THREE.Mesh(
    new THREE.CylinderGeometry(0.10, 0.10, 0.14, 16),
    flangeMat
  );
  trunkTeeCorner.position.set(psaOutX, trunkY, 0);
  scene.add(trunkTeeCorner);

  // 3) Long +X horizontal trunk over the air-compressor & booster to tank #1
  const trunkEndX = CONFIG.oxyTank1X;
  const trunkRun = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, trunkEndX - psaOutX, 20),
    stainlessMat
  );
  trunkRun.rotation.z = Math.PI / 2;
  trunkRun.position.set((psaOutX + trunkEndX) / 2, trunkY, 0);
  trunkRun.castShadow = true;
  scene.add(trunkRun);
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

    // Red shoulder band (high-pressure O₂ marking)
    const redBand = new THREE.Mesh(
      new THREE.CylinderGeometry(cylR + 0.005, cylR + 0.005, 0.10, 24),
      new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.55 })
    );
    redBand.position.set(cx, deckY + cylH - 0.08, 0);
    g.add(redBand);

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

  // ---- Fill manifold: a single horizontal pipe running above the cylinder valves
  //      with short flexible drop-hoses into each cylinder's valve handle.
  const stainlessMat = new THREE.MeshStandardMaterial({
    color: 0xb0b6bd, roughness: 0.4, metalness: 0.7,
  });
  const hoseMat = new THREE.MeshStandardMaterial({
    color: 0x6b6f76, roughness: 0.7, metalness: 0.3,
  });

  // Fill manifold runs from buffer-tank side (left) into the rack — slightly above valve necks
  const fillY = deckY + cylH + 0.42;
  const fillStartX = CONFIG.oxyTank2X + CONFIG.oxyTankRadius + 0.15; // begins near right buffer tank
  const fillEndX = startX + 3 * spacing + 0.10; // ends past the last cylinder
  const fillLen = fillEndX - fillStartX;

  // ---- Anchor the fill manifold to buffer tank #2's right wall (was previously floating) ----
  const flangeMatLocal = new THREE.MeshStandardMaterial({
    color: 0x8a909a, roughness: 0.4, metalness: 0.7,
  });
  const tank2WallX = CONFIG.oxyTank2X + CONFIG.oxyTankRadius;

  // Wall flange — penetrates tank #2 side wall at fillY
  const fillWallFlange = new THREE.Mesh(
    new THREE.CylinderGeometry(0.095, 0.095, 0.06, 16),
    flangeMatLocal
  );
  fillWallFlange.rotation.z = Math.PI / 2;
  fillWallFlange.position.set(tank2WallX + 0.03, fillY, 0);
  g.add(fillWallFlange);

  // Short stub between wall flange and fill-manifold start
  const fillStub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, fillStartX - tank2WallX, 16),
    stainlessMat
  );
  fillStub.rotation.z = Math.PI / 2;
  fillStub.position.set((tank2WallX + fillStartX) / 2, fillY, 0);
  g.add(fillStub);

  // Tee at the wall → manifold junction
  const fillJunctionTee = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, 0.12, 16),
    flangeMatLocal
  );
  fillJunctionTee.position.set(fillStartX, fillY, 0);
  g.add(fillJunctionTee);

  const fillPipe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, fillLen, 16),
    stainlessMat
  );
  fillPipe.rotation.z = Math.PI / 2;
  fillPipe.position.set((fillStartX + fillEndX) / 2, fillY, 0);
  g.add(fillPipe);

  // Drop hose to each cylinder valve
  for (let i = 0; i < 3; i++) {
    const cxCyl = startX + i * spacing;
    const hose = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.20, 12),
      hoseMat
    );
    hose.position.set(cxCyl, fillY - 0.10, 0);
    g.add(hose);
  }

  scene.add(g);
}

/* ============================ FLOOR PIPING + FLOW MARKERS ============================ */
function buildFloorPipingFlow() {
  const deckY = CONFIG.skidHeight + 0.06;
  const pipeMat = new THREE.MeshStandardMaterial({
    color: 0xc6cbd1, roughness: 0.35, metalness: 0.8,
  });
  const flangeMat = new THREE.MeshStandardMaterial({
    color: 0x8a909a, roughness: 0.4, metalness: 0.7,
  });

  // ---- BACK floor pipe: spans from control cabinet (left) to oxygen tank base (right) ----
  // Bounded between actual equipment so it visibly enters/exits something.
  const backStart = CONFIG.panelX + 0.6;      // exits control cabinet base
  const backEnd   = CONFIG.oxyTank2X - 0.40;  // enters last oxygen tank skirt
  const backLen   = backEnd - backStart;
  const backZ     = -CONFIG.skidDepth / 2 + 0.7;

  const longPipe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, backLen, 18),
    pipeMat
  );
  longPipe.rotation.z = Math.PI / 2;
  longPipe.position.set((backStart + backEnd) / 2, deckY + 0.18, backZ);
  scene.add(longPipe);

  // Floor flanges where it enters the cabinet & tank
  for (const ex of [backStart, backEnd]) {
    const fl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.10, 0.10, 0.05, 16),
      flangeMat
    );
    fl.rotation.z = Math.PI / 2;
    fl.position.set(ex, deckY + 0.18, backZ);
    scene.add(fl);
  }

  // ---- FRONT floor pipe: from PSA manifold's right floor flange to booster suction stub ----
  const frontStart = CONFIG.psaCenterX + (CONFIG.psaSpacing + 0.20) / 2 - 0.08;
  const frontEnd   = CONFIG.boosterX + 0.30; // matches booster suction inlet
  const frontLen   = frontEnd - frontStart;
  const frontZ     = CONFIG.skidDepth / 2 - 0.7;

  const longPipe2 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, frontLen, 18),
    pipeMat
  );
  longPipe2.rotation.z = Math.PI / 2;
  longPipe2.position.set((frontStart + frontEnd) / 2, deckY + 0.10, frontZ);
  scene.add(longPipe2);

  for (const ex of [frontStart, frontEnd]) {
    const fl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.05, 16),
      flangeMat
    );
    fl.rotation.z = Math.PI / 2;
    fl.position.set(ex, deckY + 0.10, frontZ);
    scene.add(fl);
  }

  // ---- Flow markers travelling along the back pipe, bounded by the pipe's actual span ----
  for (let i = 0; i < 3; i++) {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 12, 12),
      new THREE.MeshStandardMaterial({
        color: 0x22d3ee, emissive: 0x22d3ee, emissiveIntensity: 0.8,
      })
    );
    marker.position.set(backStart, deckY + 0.18, backZ);
    marker.userData = {
      axis: 'x',
      startX: backStart + 0.10,
      endX: backEnd - 0.10,
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
    camera.position.x = Math.sin(t * 0.18) * 2.0;
    camera.position.z = 17.5 - Math.cos(t * 0.18) * 0.3;
    camera.position.y = 3.6 + Math.sin(t * 0.12) * 0.12;
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
    // Slayt 8 atlasında küçük canvas'a mount edilmiş olabilir;
    // büyük equipment canvas'ına geçişi mount() pattern'iyle güvenli yap.
    const targetCanvas = document.getElementById('three-canvas-oxygen');
    if (!targetCanvas) return;
    if (initialized && canvas === targetCanvas) {
      startRendering();
      setTimeout(onResize, 50);
    } else {
      if (initialized) _disposeForMount();
      init(targetCanvas);
      setTimeout(onResize, 50);
      startRendering();
    }
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
    // Sadece render döngüsünü durdur — renderer/context/canvas yaşar.
    // Aynı canvas'a tekrar mount edildiğinde fast-path (initialized && canvas === canvasEl)
    // devreye girer; aksi halde forceContextLoss canvas'ı kalıcı öldürür → beyaz ekran.
    stopRendering();
  },
  get isMounted() { return initialized; },
  get currentCanvas() { return canvas; },
};
