import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* ===================================================================
 * Hikmet Cetin Gold - Electrowinning + Dore Pouring Station
 * Rebuilt to match the reference photograph: a tabletop demonstration
 * unit on a dark perforated base plate, left-to-right composition:
 *
 *   [overflow tank] - [green pump] - [glass EW cell with cathodes]
 *      - [DC POWER SUPPLY cabinet] - [gold-mud tray] - [crucible+flame]
 *
 * White background, stainless steel framework, teal electrolyte, red
 * (+) and black (-) DC cables, orange flame.
 * =================================================================== */

const CONFIG = {
  // Base plate (perforated grate)
  baseWidth: 22,
  baseDepth: 11,
  baseHeight: 0.35,

  // Electrowinning cell (glass walls, stainless frame)
  cellWidth: 7.4,
  cellDepth: 3.0,
  cellHeight: 2.6,
  cathodeCount: 7,

  // DC power supply cabinet
  cabinetWidth: 3.6,
  cabinetHeight: 3.3,
  cabinetDepth: 3.0,

  // Composition (X positions, world units)
  tankX: -9.0,
  pumpX: -7.4,
  cellX: -1.6,
  cabinetX: 5.0,
  trayX: 4.0,
  crucibleX: 7.6,
};

let renderer, scene, camera, controls;
let canvas;
let initialized = false;
let frameId = null;
let lastUserInteraction = Date.now();
let autoRotateEnabled = true;

// Animated handles
const flameSprites = [];
const flameLights = [];
const electrolyteSurfaces = [];
const bubbleSprites = [];
const rectifierDisplays = [];
let lastRectifierUpdate = 0;

function init(targetCanvas) {
  if (initialized) return;
  initialized = true;

  canvas = targetCanvas || document.getElementById('three-canvas-ew');
  const rect = canvas.getBoundingClientRect();
  // Renderer resolution: prefer CSS dimensions, with sensible minimum to avoid pre-mount 0×0 issues
  const width = Math.max(rect.width, 800);
  const height = Math.max(rect.height, 600);

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Black background (matches other 3D scenes in the deck)
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = null;

  // Environment for crisp PBR reflections on stainless
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  // Camera framed to mimic the reference: slightly low 3/4 front view
  // Wide cinematic 3/4 front view — fits the full scene (tank x=-9 → crucible x=+8) at typical aspects
  camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 200);
  camera.position.set(3.0, 7.5, 22.0);
  camera.lookAt(0, 1.3, 0);

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.minPolarAngle = Math.PI * 0.15;
  controls.maxPolarAngle = Math.PI * 0.50;
  controls.target.set(0, 1.3, 0);
  controls.addEventListener('start', () => { lastUserInteraction = Date.now(); });

  buildLights();
  buildBase();
  buildOverflowTank();
  buildPump();
  buildElectrowinningCell();
  buildPowerSupply();
  buildGoldMudTray();
  buildCrucible();
  buildCables();
  buildPlumbing();

  window.addEventListener('resize', onResize);
}

/* ============================== HELPERS ============================== */
function makeCurvedPipe(points, radius, mat, segments = 64) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => p.clone ? p.clone() : new THREE.Vector3(p[0], p[1], p[2])));
  const tube = new THREE.TubeGeometry(curve, segments, radius, 14, false);
  const mesh = new THREE.Mesh(tube, mat);
  mesh.castShadow = true;
  return mesh;
}

function makePipeUnion(radius, mat) {
  const grp = new THREE.Group();
  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.45, radius * 1.45, radius * 0.7, 18),
    mat,
  );
  grp.add(collar);
  const flange = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.7, radius * 1.7, radius * 0.25, 18),
    mat,
  );
  flange.position.y = radius * 0.45;
  grp.add(flange);
  return grp;
}

/* ============================== LIGHTS ============================== */
function buildLights() {
  const ambient = new THREE.AmbientLight(0xffffff, 0.72);
  scene.add(ambient);

  // Key light, front-top-right (matches highlights on stainless in photo)
  const key = new THREE.DirectionalLight(0xffffff, 1.25);
  key.position.set(12, 18, 12);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -15;
  key.shadow.camera.right = 15;
  key.shadow.camera.top = 15;
  key.shadow.camera.bottom = -15;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 60;
  key.shadow.bias = -0.0005;
  scene.add(key);

  // Soft fill from the front-left
  const fill = new THREE.DirectionalLight(0xffffff, 0.55);
  fill.position.set(-12, 9, 10);
  scene.add(fill);

  // Subtle backlight rim
  const rim = new THREE.DirectionalLight(0xcfd8ff, 0.35);
  rim.position.set(-4, 8, -12);
  scene.add(rim);
}

/* ============================== BASE PLATE ============================== */
function buildBase() {
  const w = CONFIG.baseWidth, d = CONFIG.baseDepth, h = CONFIG.baseHeight;

  // Dark metal slab
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color: 0x2a2f33, metalness: 0.6, roughness: 0.55 }),
  );
  slab.position.y = h / 2;
  slab.receiveShadow = true;
  scene.add(slab);

  // Perforated grate top surface (procedural texture)
  const grateTex = makeGrateTexture(1024, 1024, 32);
  grateTex.wrapS = grateTex.wrapT = THREE.RepeatWrapping;
  grateTex.repeat.set(11, 5.5);
  const grateMat = new THREE.MeshStandardMaterial({
    color: 0x3a4046, metalness: 0.7, roughness: 0.5,
    map: grateTex, bumpMap: grateTex, bumpScale: 0.04,
  });
  const grate = new THREE.Mesh(new THREE.PlaneGeometry(w, d), grateMat);
  grate.rotation.x = -Math.PI / 2;
  grate.position.y = h + 0.001;
  grate.receiveShadow = true;
  scene.add(grate);

  // Slight bevel skirt
  const skirt = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.05, 0.06, d + 0.05),
    new THREE.MeshStandardMaterial({ color: 0x1c1f22, metalness: 0.7, roughness: 0.4 }),
  );
  skirt.position.y = h + 0.005;
  scene.add(skirt);
}

function makeGrateTexture(w, h, cells) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#3c4248';
  ctx.fillRect(0, 0, w, h);
  const cw = w / cells, ch = h / cells;
  ctx.fillStyle = '#15181b';
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      // diamond perforations
      const cx = x * cw + cw / 2;
      const cy = y * ch + ch / 2;
      const s = cw * 0.30;
      ctx.beginPath();
      ctx.moveTo(cx, cy - s);
      ctx.lineTo(cx + s * 0.55, cy);
      ctx.lineTo(cx, cy + s);
      ctx.lineTo(cx - s * 0.55, cy);
      ctx.closePath();
      ctx.fill();
    }
  }
  // Subtle highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let y = 0; y < cells; y++) ctx.strokeRect(0, y * ch, w, ch);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/* ============================ OVERFLOW TANK ============================ */
function buildOverflowTank() {
  const grp = new THREE.Group();
  grp.position.set(CONFIG.tankX, CONFIG.baseHeight, 0.4);

  const tankMat = new THREE.MeshStandardMaterial({ color: 0x9aa1a8, metalness: 0.85, roughness: 0.35 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1c1f, metalness: 0.6, roughness: 0.55 });

  // Body
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.4, 1.6), tankMat);
  body.position.y = 1.2;
  body.castShadow = true; body.receiveShadow = true;
  grp.add(body);

  // Top lip
  const lip = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 1.7), tankMat);
  lip.position.y = 2.4;
  grp.add(lip);

  // Brass bulkhead drain valve on the side facing the pump (+X face → world right)
  const brass = new THREE.MeshStandardMaterial({ color: 0xc7a24a, metalness: 0.9, roughness: 0.3 });
  const valveBody = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.32, 22), brass);
  valveBody.rotation.z = Math.PI / 2;
  valveBody.position.set(0.95, 0.55, 0.55);
  grp.add(valveBody);
  // Flanged hose nipple where the suction pipe clamps on
  const nipple = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 0.18, 18), brass);
  nipple.rotation.z = Math.PI / 2;
  nipple.position.set(1.16, 0.55, 0.55);
  grp.add(nipple);
  // Bright yellow ball-valve lever sitting on top of the valve body (visible from camera)
  const yellowLever = new THREE.MeshStandardMaterial({ color: 0xf0c628, metalness: 0.35, roughness: 0.45 });
  const lever = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.06, 0.06), yellowLever);
  lever.position.set(0.95, 0.85, 0.55);
  grp.add(lever);
  const leverPivot = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.22, 12), darkMat);
  leverPivot.position.set(0.95, 0.74, 0.55);
  grp.add(leverPivot);

  // Top fill nozzle (return-line termination above the tank lip — open mouth)
  const fillCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 0.16, 18),
    new THREE.MeshStandardMaterial({ color: 0x101215, metalness: 0.6, roughness: 0.55 }),
  );
  fillCollar.position.set(0.0, 2.48, 0.0);
  grp.add(fillCollar);
  // Tag the fill collar + tank suction port positions so plumbing function can read them
  scene.userData.tankFillCollarWorld = new THREE.Vector3(CONFIG.tankX + 0.0, CONFIG.baseHeight + 2.48, 0.4 + 0.0);
  scene.userData.tankSuctionPortWorld = new THREE.Vector3(CONFIG.tankX + 1.16 + 0.09, CONFIG.baseHeight + 0.55, 0.4 + 0.55);

  scene.add(grp);
}

/* ============================== PUMP ============================== */
function buildPump() {
  const grp = new THREE.Group();
  grp.position.set(CONFIG.pumpX, CONFIG.baseHeight + 0.05, 1.6);

  const greenMat = new THREE.MeshStandardMaterial({ color: 0x2a7e34, metalness: 0.55, roughness: 0.42 });
  const darkGreenMat = new THREE.MeshStandardMaterial({ color: 0x1c5e26, metalness: 0.55, roughness: 0.45 });
  const blackMat = new THREE.MeshStandardMaterial({ color: 0x101215, metalness: 0.55, roughness: 0.55 });
  const yellowMat = new THREE.MeshStandardMaterial({ color: 0xefce2e, metalness: 0.35, roughness: 0.45, emissive: 0x6a5a08, emissiveIntensity: 0.2 });
  const stainMat = new THREE.MeshStandardMaterial({ color: 0x232529, metalness: 0.5, roughness: 0.55 });

  // Motor cylinder (the green body)
  const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.6, 28), greenMat);
  motor.rotation.z = Math.PI / 2;
  motor.position.set(-0.1, 0.55, 0);
  motor.castShadow = true;
  grp.add(motor);

  // Cooling fins (rings on the motor) - more prominent dark ridges
  for (let i = 0; i < 8; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.57, 0.022, 8, 28), darkGreenMat);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(-0.75 + i * 0.18, 0.55, 0);
    grp.add(ring);
  }

  // Motor end-caps
  const cap1 = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.12, 24), blackMat);
  cap1.rotation.z = Math.PI / 2;
  cap1.position.set(-0.95, 0.55, 0);
  grp.add(cap1);
  const cap2 = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.12, 24), blackMat);
  cap2.rotation.z = Math.PI / 2;
  cap2.position.set(0.75, 0.55, 0);
  grp.add(cap2);

  // Pump volute (front) - rounded body sticking forward
  const volute = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.55, 28), stainMat);
  volute.rotation.z = Math.PI / 2;
  volute.position.set(1.1, 0.55, 0);
  grp.add(volute);

  // Flange between motor and volute (square plate with 4 bolts)
  const flange = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.25, 1.25), stainMat);
  flange.position.set(0.82, 0.55, 0);
  grp.add(flange);
  const flangeBoltMat = new THREE.MeshStandardMaterial({ color: 0x6b7177, metalness: 0.95, roughness: 0.3 });
  [[0.5, 0.5], [0.5, -0.5], [-0.5, 0.5], [-0.5, -0.5]].forEach(([dy, dz]) => {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.10, 8), flangeBoltMat);
    b.rotation.z = Math.PI / 2;
    b.position.set(0.82, 0.55 + dy, dz);
    grp.add(b);
  });

  // Yellow priming cap on top of volute (visible from front camera)
  const yellowCap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.16, 18), yellowMat);
  yellowCap.position.set(1.1, 1.04, 0);
  grp.add(yellowCap);
  const yellowCapTop = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.10, 0.06, 12), yellowMat);
  yellowCapTop.position.set(1.1, 1.15, 0);
  grp.add(yellowCapTop);

  // Suction inlet on the FRONT face of the volute (where suction line from tank arrives)
  const suctStub = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.35, 18), blackMat);
  suctStub.position.set(1.1, 0.55, 0.50 + 0.175);  // front (+Z) of pump
  suctStub.rotation.x = Math.PI / 2;
  grp.add(suctStub);
  // Suction flange ring
  const suctFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.20, 0.05, 18), stainMat);
  suctFlange.position.set(1.1, 0.55, 0.50);
  suctFlange.rotation.x = Math.PI / 2;
  grp.add(suctFlange);

  // Discharge outlet on the RIGHT (+X) side of the volute (toward cell)
  const dischStub = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.35, 18), blackMat);
  dischStub.position.set(1.1 + 0.275 + 0.175, 0.55, 0);
  dischStub.rotation.z = Math.PI / 2;
  grp.add(dischStub);
  const dischFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.20, 0.05, 18), stainMat);
  dischFlange.position.set(1.1 + 0.275, 0.55, 0);
  dischFlange.rotation.z = Math.PI / 2;
  grp.add(dischFlange);

  // Base feet
  const foot = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.15, 0.7), blackMat);
  foot.position.set(-0.1, 0.08, 0);
  grp.add(foot);

  // Expose pump's external port positions (world coords) for buildPlumbing()
  scene.userData.pumpSuctionPortWorld = new THREE.Vector3(
    CONFIG.pumpX + 1.1,
    CONFIG.baseHeight + 0.05 + 0.55,
    1.6 + 0.50 + 0.35,                 // front face + full stub length
  );
  scene.userData.pumpDischargePortWorld = new THREE.Vector3(
    CONFIG.pumpX + 1.1 + 0.275 + 0.35, // right side + flange + stub
    CONFIG.baseHeight + 0.05 + 0.55,
    1.6,
  );

  scene.add(grp);
}

/* ============================== PLUMBING NETWORK ============================== */
/* Draws the three flow lines that complete the electrolyte loop:
 *   1) Tank brass valve  →  Pump suction port    (low forward run)
 *   2) Pump discharge    →  Cell left-wall inlet (rises up + over)
 *   3) Cell right-wall overflow → Tank top fill collar (long return arc above the scene)
 */
function buildPlumbing() {
  const blackMat = new THREE.MeshStandardMaterial({ color: 0x121417, metalness: 0.45, roughness: 0.55 });
  const fittingMat = new THREE.MeshStandardMaterial({ color: 0x6c7277, metalness: 0.92, roughness: 0.32 });

  const tankOut = scene.userData.tankSuctionPortWorld;       // (-7.75, 0.90, 0.95)
  const tankFill = scene.userData.tankFillCollarWorld;       // (-9.00, 2.83, 0.40)
  const pumpIn = scene.userData.pumpSuctionPortWorld;        // (-6.30, 1.00, 2.45)
  const pumpOut = scene.userData.pumpDischargePortWorld;     // (-6.025, 1.00, 1.60)
  const cellIn = scene.userData.cellInletPortWorld;          // (-5.66, 0.90, 0.40)
  const cellOut = scene.userData.cellOverflowPortWorld;      // (2.43, 2.27, 0.70)
  if (!tankOut || !pumpIn || !pumpOut || !cellIn || !tankFill || !cellOut) return;

  // 1) SUCTION LINE: tank valve → forward curve → pump front intake
  //    Drops from tank valve, runs forward + right along the base, swings up into pump suction.
  const suctionPts = [
    tankOut.clone(),
    new THREE.Vector3(tankOut.x + 0.25, tankOut.y - 0.05, tankOut.z + 0.20),
    new THREE.Vector3(tankOut.x + 0.65, tankOut.y - 0.30, tankOut.z + 0.70),
    new THREE.Vector3(pumpIn.x - 0.40, pumpIn.y - 0.25, pumpIn.z - 0.10),
    new THREE.Vector3(pumpIn.x - 0.10, pumpIn.y, pumpIn.z),
    pumpIn.clone(),
  ];
  scene.add(makeCurvedPipe(suctionPts, 0.13, blackMat, 56));

  // 2) DISCHARGE LINE: pump right-side outlet → up → curve right toward cell → down into cell-wall inlet
  //    This is the visible "feed" pipe that the reference image shows running from pump up to cell.
  const dischargePts = [
    pumpOut.clone(),
    new THREE.Vector3(pumpOut.x + 0.25, pumpOut.y + 0.40, pumpOut.z),
    new THREE.Vector3(pumpOut.x + 0.55, pumpOut.y + 0.90, pumpOut.z - 0.30),
    new THREE.Vector3((pumpOut.x + cellIn.x) / 2, pumpOut.y + 1.10, (pumpOut.z + cellIn.z) / 2 - 0.20),
    new THREE.Vector3(cellIn.x - 0.30, cellIn.y + 0.80, cellIn.z + 0.10),
    new THREE.Vector3(cellIn.x - 0.10, cellIn.y + 0.30, cellIn.z),
    cellIn.clone(),
  ];
  scene.add(makeCurvedPipe(dischargePts, 0.13, blackMat, 72));

  // 3) RETURN/OVERFLOW LINE: cell right-side overflow → arc back over the cabinet's rear → tank fill collar
  //    Routes BEHIND the cabinet so it doesn't visually clutter the front of the cabinet.
  const returnPts = [
    cellOut.clone(),
    new THREE.Vector3(cellOut.x + 0.35, cellOut.y + 0.30, cellOut.z + 0.10),
    new THREE.Vector3(cellOut.x + 1.00, cellOut.y + 0.70, cellOut.z + 0.50),
    new THREE.Vector3(CONFIG.cabinetX + 1.5, cellOut.y + 1.20, -2.20),                // arc up over cabinet rear
    new THREE.Vector3(CONFIG.cabinetX - 2.0, cellOut.y + 1.40, -2.80),
    new THREE.Vector3(CONFIG.cellX - 2.5, cellOut.y + 1.40, -2.80),
    new THREE.Vector3(CONFIG.tankX + 1.8, cellOut.y + 1.20, -1.80),
    new THREE.Vector3(tankFill.x + 0.6, tankFill.y + 0.80, tankFill.z - 0.80),
    new THREE.Vector3(tankFill.x + 0.15, tankFill.y + 0.30, tankFill.z - 0.10),
    new THREE.Vector3(tankFill.x, tankFill.y + 0.08, tankFill.z),                     // drop straight into collar
  ];
  scene.add(makeCurvedPipe(returnPts, 0.10, blackMat, 96));

  // Small union sleeves at the four anchor points (where pipe meets nipple) - hide the seam
  const seamA = makePipeUnion(0.14, fittingMat); seamA.position.copy(tankOut);  scene.add(seamA);
  const seamB = makePipeUnion(0.14, fittingMat); seamB.position.copy(pumpIn);   seamB.rotation.x = Math.PI / 2; scene.add(seamB);
  const seamC = makePipeUnion(0.14, fittingMat); seamC.position.copy(pumpOut);  seamC.rotation.z = Math.PI / 2; scene.add(seamC);
  const seamD = makePipeUnion(0.14, fittingMat); seamD.position.copy(cellIn);   seamD.rotation.z = Math.PI / 2; scene.add(seamD);
  const seamE = makePipeUnion(0.11, fittingMat); seamE.position.copy(cellOut);  seamE.rotation.z = Math.PI / 2; scene.add(seamE);
}

/* ====================== ELECTROWINNING CELL ====================== */
function buildElectrowinningCell() {
  const grp = new THREE.Group();
  grp.position.set(CONFIG.cellX, CONFIG.baseHeight, 0);

  const cw = CONFIG.cellWidth, cd = CONFIG.cellDepth, ch = CONFIG.cellHeight;
  const stain = new THREE.MeshStandardMaterial({ color: 0xb1b7bc, metalness: 0.9, roughness: 0.28 });

  // Glass walls - museum-quality optical glass. Push transmission to nearly full and drop opacity so
  // the cathodes/electrolyte inside are crisply visible. Front pane uses single-sided to avoid the
  // muddy double-transmission artifact (rendering glass twice on back face).
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xf7fefb,
    metalness: 0.0,
    roughness: 0.0,
    transmission: 1.0,
    thickness: 0.10,
    ior: 1.5,
    clearcoat: 1.0,
    clearcoatRoughness: 0.0,
    transparent: true,
    opacity: 0.18,
    side: THREE.FrontSide,
    envMapIntensity: 1.6,
    specularIntensity: 1.0,
  });

  const wallT = 0.06;
  // Front pane
  const front = new THREE.Mesh(new THREE.BoxGeometry(cw, ch, wallT), glassMat);
  front.position.set(0, ch / 2, cd / 2);
  grp.add(front);
  // Back pane
  const back = front.clone();
  back.position.z = -cd / 2;
  grp.add(back);
  // Side panes
  const side1 = new THREE.Mesh(new THREE.BoxGeometry(wallT, ch, cd), glassMat);
  side1.position.set(cw / 2, ch / 2, 0);
  grp.add(side1);
  const side2 = side1.clone();
  side2.position.x = -cw / 2;
  grp.add(side2);

  // Stainless base of cell (under the glass)
  const baseBox = new THREE.Mesh(
    new THREE.BoxGeometry(cw + 0.2, 0.45, cd + 0.2),
    stain,
  );
  baseBox.position.y = 0.22;
  baseBox.castShadow = true; baseBox.receiveShadow = true;
  grp.add(baseBox);

  // Stainless top rim (frame around the open top)
  const rimMat = stain;
  const rimT = 0.14;
  const rimH = 0.18;
  // long sides
  const rimFront = new THREE.Mesh(new THREE.BoxGeometry(cw + 0.25, rimH, rimT), rimMat);
  rimFront.position.set(0, ch + rimH / 2, cd / 2 + rimT / 2);
  grp.add(rimFront);
  const rimBack = rimFront.clone();
  rimBack.position.z = -cd / 2 - rimT / 2;
  grp.add(rimBack);
  // short sides
  const rimL = new THREE.Mesh(new THREE.BoxGeometry(rimT, rimH, cd + 0.4), rimMat);
  rimL.position.set(-cw / 2 - rimT / 2, ch + rimH / 2, 0);
  grp.add(rimL);
  const rimR = rimL.clone();
  rimR.position.x = cw / 2 + rimT / 2;
  grp.add(rimR);

  // Bolts along the rim (front & back)
  const boltMat = new THREE.MeshStandardMaterial({ color: 0x6b7177, metalness: 0.95, roughness: 0.3 });
  for (let i = 0; i < 9; i++) {
    const x = -cw / 2 + 0.4 + (i / 8) * (cw - 0.8);
    const bF = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 8), boltMat);
    bF.rotation.x = Math.PI / 2;
    bF.position.set(x, ch + 0.04, cd / 2 + rimT + 0.005);
    grp.add(bF);
    const bB = bF.clone();
    bB.position.z = -cd / 2 - rimT - 0.005;
    grp.add(bB);
  }

  // Electrolyte (teal liquid) - brilliant turquoise like the reference photo
  const elDepth = ch * 0.78;
  const elMat = new THREE.MeshPhysicalMaterial({
    color: 0x2ee0c4,
    metalness: 0.0,
    roughness: 0.04,
    transmission: 0.85,
    thickness: 0.8,
    ior: 1.33,
    attenuationColor: 0x35d4be,
    attenuationDistance: 4.5,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
    emissive: 0x0a5a4e,
    emissiveIntensity: 0.18,
  });
  elMat.userData.baseEm = 0.05;
  const electrolyte = new THREE.Mesh(
    new THREE.BoxGeometry(cw - 0.12, elDepth, cd - 0.12),
    elMat,
  );
  electrolyte.position.y = elDepth / 2 + 0.05;
  electrolyte.userData.basePhase = Math.random() * Math.PI * 2;
  electrolyte.userData.baseY = electrolyte.position.y;
  electrolyteSurfaces.push(electrolyte);
  grp.add(electrolyte);

  // Top cross-bar (busbar / cathode hanger) - thick stainless strip across cell
  const busMat = new THREE.MeshStandardMaterial({ color: 0xb8bec3, metalness: 0.92, roughness: 0.28 });
  const busbar = new THREE.Mesh(new THREE.BoxGeometry(cw + 0.4, 0.32, 0.7), busMat);
  busbar.position.set(0, ch + 0.34 + 0.16, 0);
  busbar.castShadow = true;
  grp.add(busbar);
  // bolts on busbar
  for (let i = 0; i < 9; i++) {
    const x = -cw / 2 + 0.4 + (i / 8) * (cw - 0.8);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.36, 10), boltMat);
    b.position.set(x, ch + 0.5, 0);
    grp.add(b);
  }

  // Cathodes - hanging plates with steel-wool wraps
  buildCathodes(grp);

  // Bulkhead fittings on cell walls (where plumbing connects)
  // LEFT-WALL INLET: where pump discharge enters the cell near the bottom
  const fittingMat = new THREE.MeshStandardMaterial({ color: 0x6c7277, metalness: 0.92, roughness: 0.32 });
  const inletFlange = new THREE.Mesh(
    new THREE.CylinderGeometry(0.20, 0.20, 0.05, 22),
    fittingMat,
  );
  inletFlange.rotation.z = Math.PI / 2;
  inletFlange.position.set(-cw / 2 - 0.04, 0.55, 0.4);
  grp.add(inletFlange);
  const inletNipple = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, 0.30, 18),
    new THREE.MeshStandardMaterial({ color: 0x101215, metalness: 0.55, roughness: 0.55 }),
  );
  inletNipple.rotation.z = Math.PI / 2;
  inletNipple.position.set(-cw / 2 - 0.21, 0.55, 0.4);
  grp.add(inletNipple);

  // RIGHT-WALL OVERFLOW: where return line exits the cell near the top
  const overflowFlange = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.17, 0.05, 22),
    fittingMat,
  );
  overflowFlange.rotation.z = Math.PI / 2;
  overflowFlange.position.set(cw / 2 + 0.04, ch * 0.74, 0.7);
  grp.add(overflowFlange);
  const overflowNipple = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, 0.26, 18),
    new THREE.MeshStandardMaterial({ color: 0x101215, metalness: 0.55, roughness: 0.55 }),
  );
  overflowNipple.rotation.z = Math.PI / 2;
  overflowNipple.position.set(cw / 2 + 0.20, ch * 0.74, 0.7);
  grp.add(overflowNipple);

  // Expose plumbing connection points (world coordinates)
  scene.userData.cellInletPortWorld = new THREE.Vector3(
    CONFIG.cellX + (-cw / 2 - 0.36),
    CONFIG.baseHeight + 0.55,
    0 + 0.4,
  );
  scene.userData.cellOverflowPortWorld = new THREE.Vector3(
    CONFIG.cellX + (cw / 2 + 0.33),
    CONFIG.baseHeight + ch * 0.74,
    0 + 0.7,
  );

  scene.add(grp);
}

function buildCathodes(parentGrp) {
  const cw = CONFIG.cellWidth, cd = CONFIG.cellDepth, ch = CONFIG.cellHeight;
  const N = CONFIG.cathodeCount;
  const span = cw - 0.9;
  const plateMat = new THREE.MeshStandardMaterial({ color: 0xc8ccd0, metalness: 0.95, roughness: 0.20 });
  const anodeMat = new THREE.MeshStandardMaterial({ color: 0xa6acb1, metalness: 0.92, roughness: 0.30 });
  // Steel-wool: bright silvery, moderately metallic so highlights pop against the teal electrolyte
  const woolMat = new THREE.MeshStandardMaterial({
    color: 0xb8bec5,
    metalness: 0.75,
    roughness: 0.55,
    emissive: 0x0e1012,
    emissiveIntensity: 0.30,
  });

  const woolH = ch * 0.78 - 0.10;        // wool length (extends slightly above electrolyte surface)
  const woolBaseY = 0.12;                // bottom of wool just above cell floor
  const woolRadius = 0.22;               // outer envelope radius
  const FIBERS_PER_BUNDLE = 120;         // instanced fluffy particles per cathode
  const STRANDS_PER_BUNDLE = 14;         // wrap-around helical fiber strands
  const electrolyteTopY = ch * 0.78 + 0.05;

  // Build one shared geometry for the fluffy fiber particles, then InstancedMesh per cathode
  const fiberGeo = new THREE.IcosahedronGeometry(0.030, 0);

  for (let i = 0; i < N; i++) {
    const t = N === 1 ? 0.5 : i / (N - 1);
    const x = -span / 2 + t * span;

    // ---- Hanger plate (visible silver tab above electrolyte → busbar) ----
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.72, cd - 0.4),
      plateMat,
    );
    plate.position.set(x, ch - 0.04, 0);
    plate.castShadow = true;
    parentGrp.add(plate);

    // ---- Bolt fastening plate to busbar ----
    const bolt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.048, 0.048, 0.22, 12),
      plateMat,
    );
    bolt.position.set(x, ch + 0.32, 0);
    parentGrp.add(bolt);

    // ---- Central armature rod (thin stainless wire core of the wool bundle) ----
    const armature = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, woolH + 0.18, 10),
      plateMat,
    );
    armature.position.set(x, woolBaseY + (woolH + 0.18) / 2, 0);
    parentGrp.add(armature);

    // ---- Instanced fiber fluff (cloud of tiny shiny chunks filling the bundle envelope) ----
    const inst = new THREE.InstancedMesh(fiberGeo, woolMat, FIBERS_PER_BUNDLE);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    for (let f = 0; f < FIBERS_PER_BUNDLE; f++) {
      // distribute uniformly in a cylinder volume, weighted slightly toward the surface for fluff
      const ang = Math.random() * Math.PI * 2;
      const rad = woolRadius * (0.45 + Math.random() * 0.62);
      const y = woolBaseY + Math.random() * woolH;
      p.set(x + Math.cos(ang) * rad, y, Math.sin(ang) * rad);
      q.setFromEuler(new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI));
      const scale = 0.7 + Math.random() * 1.2;
      s.set(scale, scale * (0.6 + Math.random() * 1.2), scale);
      m4.compose(p, q, s);
      inst.setMatrixAt(f, m4);
    }
    inst.instanceMatrix.needsUpdate = true;
    inst.castShadow = true;
    parentGrp.add(inst);

    // ---- Helical fiber wrap strands (give the wool clear directional fiber lines) ----
    for (let s2 = 0; s2 < STRANDS_PER_BUNDLE; s2++) {
      const phase = (s2 / STRANDS_PER_BUNDLE) * Math.PI * 2 + Math.random() * 0.4;
      const turns = 1.2 + Math.random() * 0.8;
      const strandPts = [];
      const segs = 22;
      const rJitter = woolRadius * (0.85 + Math.random() * 0.15);
      for (let k = 0; k <= segs; k++) {
        const u = k / segs;
        const ang = phase + u * turns * Math.PI * 2;
        const radK = rJitter * (0.85 + 0.15 * Math.sin(u * Math.PI));   // pinch slightly at top/bottom
        const yK = woolBaseY + u * woolH;
        strandPts.push(new THREE.Vector3(
          x + Math.cos(ang) * radK + (Math.random() - 0.5) * 0.015,
          yK,
          Math.sin(ang) * radK + (Math.random() - 0.5) * 0.015,
        ));
      }
      const curve = new THREE.CatmullRomCurve3(strandPts);
      const strand = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 32, 0.011, 6, false),
        woolMat,
      );
      strand.castShadow = false;
      parentGrp.add(strand);
    }

    // ---- Top crown (bushy fibers extending slightly above electrolyte surface) ----
    const crown = new THREE.InstancedMesh(fiberGeo, woolMat, 18);
    for (let c = 0; c < 18; c++) {
      const ang = Math.random() * Math.PI * 2;
      const rad = (0.12 + Math.random() * 0.14);
      const y = electrolyteTopY + Math.random() * 0.12;
      p.set(x + Math.cos(ang) * rad, y, Math.sin(ang) * rad);
      q.setFromEuler(new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI));
      const scale = 0.9 + Math.random() * 0.8;
      s.set(scale, scale * 1.4, scale);
      m4.compose(p, q, s);
      crown.setMatrixAt(c, m4);
    }
    crown.instanceMatrix.needsUpdate = true;
    parentGrp.add(crown);

    // ---- Bubble sprite (electrolysis bubble rising from the cathode top) ----
    const bub = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }),
    );
    bub.position.set(x, electrolyteTopY - 0.08, (Math.random() - 0.5) * (cd - 0.8));
    bub.userData = { baseY: bub.position.y, basePhase: Math.random() * Math.PI * 2, speed: 0.3 + Math.random() * 0.2 };
    bubbleSprites.push(bub);
    parentGrp.add(bub);
  }

  // Anode plates BETWEEN cathodes (thin stainless sheets, alternate slots)
  // Slightly thicker + with visible top edge above electrolyte for "stuck card" look
  for (let i = 0; i < N + 1; i++) {
    const t = N === 1 ? 0.5 : (i - 0.5) / (N - 1);
    const x = -span / 2 + t * span;
    if (Math.abs(x) > cw / 2 - 0.3) continue;
    const sheet = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, ch * 0.78 + 0.18, cd - 0.50),
      anodeMat,
    );
    sheet.position.set(x, (ch * 0.78 + 0.18) / 2 + 0.05, 0);
    sheet.castShadow = true;
    parentGrp.add(sheet);
  }
}

/* ============================ POWER SUPPLY ============================ */
function buildPowerSupply() {
  const grp = new THREE.Group();
  grp.position.set(CONFIG.cabinetX, CONFIG.baseHeight, -0.4);

  const cw = CONFIG.cabinetWidth, ch = CONFIG.cabinetHeight, cd = CONFIG.cabinetDepth;
  const stainMat = new THREE.MeshStandardMaterial({ color: 0xb1b7bc, metalness: 0.9, roughness: 0.3 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x202327, metalness: 0.6, roughness: 0.55 });

  // Cabinet body
  const body = new THREE.Mesh(new THREE.BoxGeometry(cw, ch, cd), stainMat);
  body.position.y = ch / 2;
  body.castShadow = true; body.receiveShadow = true;
  grp.add(body);

  // Side ventilation slats
  for (let i = 0; i < 6; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.1, cd * 0.6), darkMat);
    slat.position.set(cw / 2 + 0.001, ch * 0.25 + i * 0.18, 0);
    grp.add(slat);
  }

  // Front face - "DC POWER SUPPLY" label panel
  const labelTex = makeLabelTexture('DC POWER SUPPLY', 768, 96);
  const labelMat = new THREE.MeshBasicMaterial({ map: labelTex, transparent: true });
  const label = new THREE.Mesh(new THREE.PlaneGeometry(cw * 0.82, 0.36), labelMat);
  label.position.set(0, ch * 0.78, cd / 2 + 0.011);
  grp.add(label);

  // Two red digital readouts - side by side, centered
  const dispV = makeDigitalDisplay('3.0', 'V');
  dispV.position.set(-cw * 0.20, ch * 0.55, cd / 2 + 0.02);
  grp.add(dispV);
  rectifierDisplays.push(dispV.userData);

  const dispA = makeDigitalDisplay('250', 'A');
  dispA.position.set(cw * 0.20, ch * 0.55, cd / 2 + 0.02);
  grp.add(dispA);
  rectifierDisplays.push(dispA.userData);

  // Banana sockets row (red + / black -) - just below displays
  const socketR = makeBananaSocket(0xc62828);
  socketR.position.set(-cw * 0.20, ch * 0.36, cd / 2 + 0.02);
  grp.add(socketR);
  const socketB = makeBananaSocket(0x101214);
  socketB.position.set(cw * 0.20, ch * 0.36, cd / 2 + 0.02);
  grp.add(socketB);

  // Red ON button (left of green)
  const onBtn = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.05, 22),
    new THREE.MeshStandardMaterial({ color: 0xd9352a, metalness: 0.35, roughness: 0.30, emissive: 0x401208, emissiveIntensity: 0.55 }),
  );
  onBtn.rotation.x = Math.PI / 2;
  onBtn.position.set(-cw * 0.10, ch * 0.18, cd / 2 + 0.03);
  grp.add(onBtn);
  // Subtle ring around red button
  const onRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.14, 0.018, 8, 24),
    new THREE.MeshStandardMaterial({ color: 0x3a3d40, metalness: 0.7, roughness: 0.45 }),
  );
  onRing.position.set(-cw * 0.10, ch * 0.18, cd / 2 + 0.029);
  grp.add(onRing);

  // Green OFF button
  const offBtn = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.05, 22),
    new THREE.MeshStandardMaterial({ color: 0x35b048, metalness: 0.35, roughness: 0.30, emissive: 0x0e2812, emissiveIntensity: 0.40 }),
  );
  offBtn.rotation.x = Math.PI / 2;
  offBtn.position.set(cw * 0.10, ch * 0.18, cd / 2 + 0.03);
  grp.add(offBtn);
  const offRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.14, 0.018, 8, 24),
    new THREE.MeshStandardMaterial({ color: 0x3a3d40, metalness: 0.7, roughness: 0.45 }),
  );
  offRing.position.set(cw * 0.10, ch * 0.18, cd / 2 + 0.029);
  grp.add(offRing);

  // Small text labels under buttons (ON / OFF)
  const onLblTex = makeLabelTexture('ON', 128, 64);
  const onLbl = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.16),
    new THREE.MeshBasicMaterial({ map: onLblTex, transparent: true }));
  onLbl.position.set(-cw * 0.10, ch * 0.06, cd / 2 + 0.012);
  grp.add(onLbl);
  const offLblTex = makeLabelTexture('OFF', 128, 64);
  const offLbl = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.16),
    new THREE.MeshBasicMaterial({ map: offLblTex, transparent: true }));
  offLbl.position.set(cw * 0.10, ch * 0.06, cd / 2 + 0.012);
  grp.add(offLbl);

  // Top groove / lid line
  const lid = new THREE.Mesh(new THREE.BoxGeometry(cw + 0.05, 0.06, cd + 0.05), stainMat);
  lid.position.y = ch + 0.03;
  grp.add(lid);

  scene.add(grp);
}

function makeLabelTexture(text, w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#222';
  ctx.font = 'bold 56px Helvetica, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function makeDigitalDisplay(value, unit) {
  const grp = new THREE.Group();
  // Black bezel
  const bezel = new THREE.Mesh(
    new THREE.BoxGeometry(0.95, 0.5, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x111316, metalness: 0.6, roughness: 0.6 }),
  );
  grp.add(bezel);

  // Red LCD canvas
  const tex = makeDigitDisplayTexture(value, unit, 256, 128);
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.78, 0.34),
    new THREE.MeshBasicMaterial({ map: tex, transparent: false }),
  );
  screen.position.z = 0.028;
  grp.add(screen);

  grp.userData = { screen, value, unit };
  return grp;
}

function makeDigitDisplayTexture(value, unit, w, h) {
  // Render at 2x for crispness then let MipMaps downsample. Layout: LED + SET on left, then "VALUE UNIT" centered in the right 75% of the screen.
  const C = 2;
  const cw = w * C, chh = h * C;
  const c = document.createElement('canvas');
  c.width = cw; c.height = chh;
  const ctx = c.getContext('2d');
  // Black screen background
  ctx.fillStyle = '#0a0303';
  ctx.fillRect(0, 0, cw, chh);
  // Red glow background centered on the digit area
  const grad = ctx.createRadialGradient(cw * 0.62, chh * 0.55, 4, cw * 0.62, chh * 0.55, cw * 0.55);
  grad.addColorStop(0, 'rgba(70,8,2,0.55)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cw, chh);
  // Status LED dot (top-left)
  ctx.fillStyle = '#f3c530';
  ctx.shadowColor = '#f3c530';
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.arc(cw * 0.10, chh * 0.25, 5.5 * C, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  // SET label below LED
  ctx.fillStyle = '#bbbbbb';
  ctx.font = `bold ${16 * C}px Helvetica, Arial, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('SET', cw * 0.04, chh * 0.65);
  // Compose "VALUE UNIT" as ONE STRING — guarantees both are drawn within bounds
  const composite = `${value} ${unit}`;
  ctx.fillStyle = '#ff3a1c';
  ctx.shadowColor = '#ff3b22';
  ctx.shadowBlur = 18;
  ctx.font = `bold ${64 * C}px "Courier New", monospace`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  // Center the composite in the right portion (from ~22% to ~98% of width)
  ctx.fillText(composite, cw * 0.62, chh * 0.55);
  ctx.shadowBlur = 0;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  return tex;
}

function makeBananaSocket(colorHex) {
  const grp = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(0.10, 0.10, 0.05, 18),
    new THREE.MeshStandardMaterial({ color: colorHex, metalness: 0.4, roughness: 0.45 }),
  );
  ring.rotation.x = Math.PI / 2;
  grp.add(ring);
  const hole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 0.07, 14),
    new THREE.MeshStandardMaterial({ color: 0x050608, metalness: 0.5, roughness: 0.7 }),
  );
  hole.rotation.x = Math.PI / 2;
  hole.position.z = 0.01;
  grp.add(hole);
  return grp;
}

/* ======================= DC CABLES (RED + BLACK) ======================= */
function buildCables() {
  // Anchor points: lug rises VERTICALLY out of the busbar top, cable exits top of barrel
  const busbarTopY = CONFIG.baseHeight + CONFIG.cellHeight + 0.5;  // top of busbar surface
  const cabinetSocketY = CONFIG.baseHeight + CONFIG.cabinetHeight * 0.36;
  const cabinetFrontZ = -0.4 + CONFIG.cabinetDepth / 2 + 0.05;

  const lugBodyMat = new THREE.MeshStandardMaterial({ color: 0x3a3f44, metalness: 0.92, roughness: 0.28 });
  const boltCapMat = new THREE.MeshStandardMaterial({ color: 0x6a7079, metalness: 0.95, roughness: 0.22 });

  // Lug sits flat on busbar: tang plate is the base (horizontal, bolted DOWN), bolt cap on top,
  // crimp barrel rises VERTICALLY out of the tang plate to receive the cable cleanly.
  const makeLug = (color) => {
    const g = new THREE.Group();
    // Tang plate flat on busbar surface
    const tang = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.04, 0.20),
      lugBodyMat,
    );
    tang.position.y = 0.02;
    g.add(tang);
    // Hex bolt head on top of tang plate (bolt-through-busbar)
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 0.06, 6),
      boltCapMat,
    );
    cap.position.set(-0.075, 0.07, 0);
    g.add(cap);
    // Crimp barrel: rises VERTICALLY out of the tang plate, color matches cable
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.090, 0.090, 0.26, 18),
      new THREE.MeshStandardMaterial({ color: color, metalness: 0.45, roughness: 0.55 }),
    );
    barrel.position.set(0.06, 0.17, 0);  // offset from bolt, rises up
    g.add(barrel);
    // Heat-shrink boot collar at top of barrel
    const boot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.095, 0.085, 0.08, 18),
      new THREE.MeshStandardMaterial({ color: color, metalness: 0.10, roughness: 0.80 }),
    );
    boot.position.set(0.06, 0.32, 0);
    g.add(boot);
    return g;
  };

  // ---- RED cable (+) — anchored at LEFT third of busbar, runs over to cabinet's red socket ----
  const redMat = new THREE.MeshStandardMaterial({ color: 0xc92a25, metalness: 0.20, roughness: 0.62 });
  const redLugPos = new THREE.Vector3(CONFIG.cellX - CONFIG.cellWidth * 0.32, busbarTopY, 0.0);
  const redSocketPos = new THREE.Vector3(
    CONFIG.cabinetX - CONFIG.cabinetWidth * 0.20,
    cabinetSocketY,
    cabinetFrontZ + 0.05,
  );
  // Cable starts at top of red lug's barrel and arcs over to socket
  const redStart = new THREE.Vector3(redLugPos.x + 0.06, redLugPos.y + 0.42, redLugPos.z);
  const redArchPeak = new THREE.Vector3(
    (redStart.x + redSocketPos.x) / 2 - 0.4,
    Math.max(redStart.y, redSocketPos.y) + 0.55,   // gentle arch over the cabinet rim
    (redStart.z + redSocketPos.z) / 2 + 0.15,
  );
  const redCurve = new THREE.CatmullRomCurve3([
    redStart,
    new THREE.Vector3(redStart.x + 0.10, redStart.y + 0.25, redStart.z + 0.10),
    redArchPeak,
    new THREE.Vector3(redSocketPos.x - 0.3, redSocketPos.y + 0.55, redSocketPos.z - 0.05),
    new THREE.Vector3(redSocketPos.x, redSocketPos.y + 0.10, redSocketPos.z + 0.04),
    new THREE.Vector3(redSocketPos.x, redSocketPos.y, redSocketPos.z),
  ]);
  const redTube = new THREE.Mesh(new THREE.TubeGeometry(redCurve, 96, 0.085, 16, false), redMat);
  redTube.castShadow = true;
  scene.add(redTube);

  // Red lug at busbar
  const redLug = makeLug(0xc92a25);
  redLug.position.copy(redLugPos);
  scene.add(redLug);

  // ---- BLACK cable (–) — anchored at RIGHT third of busbar, runs over to cabinet's black socket ----
  const blackMat = new THREE.MeshStandardMaterial({ color: 0x0c0e11, metalness: 0.20, roughness: 0.62 });
  const blackLugPos = new THREE.Vector3(CONFIG.cellX + CONFIG.cellWidth * 0.32, busbarTopY, 0.0);
  const blackSocketPos = new THREE.Vector3(
    CONFIG.cabinetX + CONFIG.cabinetWidth * 0.20,
    cabinetSocketY,
    cabinetFrontZ + 0.05,
  );
  const blackStart = new THREE.Vector3(blackLugPos.x + 0.06, blackLugPos.y + 0.42, blackLugPos.z);
  const blackArchPeak = new THREE.Vector3(
    (blackStart.x + blackSocketPos.x) / 2,
    Math.max(blackStart.y, blackSocketPos.y) + 0.40,
    (blackStart.z + blackSocketPos.z) / 2 + 0.20,
  );
  const blackCurve = new THREE.CatmullRomCurve3([
    blackStart,
    new THREE.Vector3(blackStart.x + 0.10, blackStart.y + 0.20, blackStart.z + 0.10),
    blackArchPeak,
    new THREE.Vector3(blackSocketPos.x - 0.2, blackSocketPos.y + 0.55, blackSocketPos.z + 0.05),
    new THREE.Vector3(blackSocketPos.x, blackSocketPos.y + 0.10, blackSocketPos.z + 0.04),
    new THREE.Vector3(blackSocketPos.x, blackSocketPos.y, blackSocketPos.z),
  ]);
  const blackTube = new THREE.Mesh(new THREE.TubeGeometry(blackCurve, 96, 0.085, 16, false), blackMat);
  blackTube.castShadow = true;
  scene.add(blackTube);

  // Black lug at busbar
  const blackLug = makeLug(0x141618);
  blackLug.position.copy(blackLugPos);
  scene.add(blackLug);
}

/* ============================ GOLD-MUD TRAY ============================ */
function buildGoldMudTray() {
  const grp = new THREE.Group();
  grp.position.set(CONFIG.trayX, CONFIG.baseHeight, 2.3);

  const stainMat = new THREE.MeshStandardMaterial({ color: 0xb1b7bc, metalness: 0.9, roughness: 0.3 });

  // Tray - shallow stainless rectangular pan
  const trayW = 1.8, trayD = 1.4, trayH = 0.18, lipT = 0.04;
  const trayBase = new THREE.Mesh(new THREE.BoxGeometry(trayW, lipT, trayD), stainMat);
  trayBase.position.y = lipT / 2;
  trayBase.castShadow = true; trayBase.receiveShadow = true;
  grp.add(trayBase);

  // Tray walls
  const wallA = new THREE.Mesh(new THREE.BoxGeometry(trayW, trayH, lipT), stainMat);
  wallA.position.set(0, trayH / 2, trayD / 2 - lipT / 2);
  grp.add(wallA);
  const wallB = wallA.clone();
  wallB.position.z = -trayD / 2 + lipT / 2;
  grp.add(wallB);
  const wallC = new THREE.Mesh(new THREE.BoxGeometry(lipT, trayH, trayD), stainMat);
  wallC.position.set(trayW / 2 - lipT / 2, trayH / 2, 0);
  grp.add(wallC);
  const wallD = wallC.clone();
  wallD.position.x = -trayW / 2 + lipT / 2;
  grp.add(wallD);

  // Gold-mud heap (lots of small spheres of irregular dark grey granules - sponge gold before smelting)
  const heapY = lipT + 0.01;
  for (let i = 0; i < 280; i++) {
    const radius = 0.035 + Math.random() * 0.06;
    // Mostly charcoal-grey with a slight warm tint, matching the reference photo
    const lightness = 0.18 + Math.random() * 0.22;
    const m = new THREE.Mesh(
      new THREE.IcosahedronGeometry(radius, 0),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(0.08 + Math.random() * 0.04, 0.06 + Math.random() * 0.08, lightness),
        metalness: 0.35 + Math.random() * 0.25,
        roughness: 0.78 + Math.random() * 0.15,
      }),
    );
    // Random position within the tray, weighted toward center pile
    const rx = (Math.random() - 0.5) * (trayW - 0.2);
    const rz = (Math.random() - 0.5) * (trayD - 0.2);
    const distFromCenter = Math.hypot(rx, rz);
    const py = heapY + Math.max(0.0, 0.16 - distFromCenter * 0.20) + Math.random() * 0.05;
    m.position.set(rx, py, rz);
    m.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    grp.add(m);
  }

  scene.add(grp);
}

/* ============================== CRUCIBLE ============================== */
function buildCrucible() {
  const grp = new THREE.Group();
  grp.position.set(CONFIG.crucibleX, CONFIG.baseHeight, 2.3);

  // Crucible body - warm brass-bronze ceramic, slightly tapered
  // Now lifted to sit ON the trivet ring (trivet top at y=0.328 + bottom-radius taper)
  const crucMat = new THREE.MeshStandardMaterial({ color: 0x4a2f1a, metalness: 0.45, roughness: 0.72 });
  const crucible = new THREE.Mesh(
    new THREE.CylinderGeometry(0.40, 0.28, 0.70, 28),
    crucMat,
  );
  crucible.position.y = 0.69;       // lifted from 0.40 → 0.69 (above trivet)
  crucible.castShadow = true; crucible.receiveShadow = true;
  grp.add(crucible);

  // Rim - bronze highlight
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.40, 0.045, 10, 36),
    new THREE.MeshStandardMaterial({ color: 0x6e4326, metalness: 0.65, roughness: 0.55 }),
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 1.03;            // 0.74 + 0.29
  grp.add(rim);

  // Slight glow ring at top inside (heated rim)
  const hotRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.36, 0.025, 8, 28),
    new THREE.MeshStandardMaterial({ color: 0xff7a14, emissive: 0xff5a08, emissiveIntensity: 1.2, metalness: 0.6, roughness: 0.6 }),
  );
  hotRing.rotation.x = Math.PI / 2;
  hotRing.position.y = 1.02;
  grp.add(hotRing);

  // Stand assembly: insulating pad → 3-legged metal trivet → glowing burner ring → crucible sits on top
  // Insulating pad (firebrick) — wider than the trivet, sits directly on the base grate
  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.58, 0.10, 28),
    new THREE.MeshStandardMaterial({ color: 0x191b1d, metalness: 0.40, roughness: 0.85 }),
  );
  pad.position.y = 0.05;
  pad.castShadow = true; pad.receiveShadow = true;
  grp.add(pad);

  // Burner ring — glowing red ring (gas torch ring or induction coil) sitting on the pad
  const burnerRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.34, 0.035, 12, 36),
    new THREE.MeshStandardMaterial({
      color: 0x5a1a06,
      emissive: 0xff4a14,
      emissiveIntensity: 1.6,
      metalness: 0.4,
      roughness: 0.7,
    }),
  );
  burnerRing.rotation.x = Math.PI / 2;
  burnerRing.position.y = 0.13;
  grp.add(burnerRing);

  // Trivet: 3 metal legs in a triangle (120° apart), supporting the crucible above the burner
  const trivetMat = new THREE.MeshStandardMaterial({ color: 0x232527, metalness: 0.85, roughness: 0.35 });
  for (let i = 0; i < 3; i++) {
    const ang = (i / 3) * Math.PI * 2 + Math.PI / 6;
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.20, 0.05),
      trivetMat,
    );
    leg.position.set(Math.cos(ang) * 0.32, 0.20, Math.sin(ang) * 0.32);
    grp.add(leg);
  }
  // Trivet top ring (where the crucible rests)
  const trivetRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.30, 0.028, 10, 28),
    trivetMat,
  );
  trivetRing.rotation.x = Math.PI / 2;
  trivetRing.position.y = 0.30;
  grp.add(trivetRing);

  // Molten pool inside crucible (just the surface)
  const poolMat = new THREE.MeshStandardMaterial({
    color: 0xffc060,
    emissive: 0xff8118,
    emissiveIntensity: 1.8,
    metalness: 0.6,
    roughness: 0.35,
  });
  const pool = new THREE.Mesh(new THREE.CircleGeometry(0.36, 28), poolMat);
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 1.00;
  grp.add(pool);

  // Flame - tighter teardrop shape rising from the crucible (all Y values shifted +0.29 to match new crucible height)
  const layers = [
    { color: 0xffe9b0, scaleX: 0.45, scaleY: 0.70, y: 1.20, op: 0.95 },
    { color: 0xffc065, scaleX: 0.58, scaleY: 0.85, y: 1.36, op: 0.85 },
    { color: 0xff8a30, scaleX: 0.68, scaleY: 1.05, y: 1.55, op: 0.70 },
    { color: 0xff6618, scaleX: 0.78, scaleY: 1.25, y: 1.78, op: 0.50 },
    { color: 0xd83a08, scaleX: 0.86, scaleY: 1.40, y: 2.00, op: 0.30 },
  ];
  for (let i = 0; i < layers.length; i++) {
    const L = layers[i];
    const flameTex = makeFlameTexture(256);
    const m = new THREE.SpriteMaterial({
      map: flameTex,
      color: L.color,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: L.op,
    });
    const sp = new THREE.Sprite(m);
    sp.scale.set(L.scaleX, L.scaleY, 1);
    sp.position.set(0, L.y, 0);
    sp.userData = {
      baseY: sp.position.y,
      baseScaleX: sp.scale.x,
      baseScaleY: sp.scale.y,
      basePhase: Math.random() * Math.PI * 2,
      speed: 2.4 + Math.random() * 1.6,
    };
    flameSprites.push(sp);
    grp.add(sp);
  }

  // Hot point light flickering from the flame
  const fireLight = new THREE.PointLight(0xffa648, 2.6, 8, 1.8);
  fireLight.position.set(0, 1.55, 0);
  fireLight.userData = { base: 2.6, amp: 0.7, freq: 6.0 };
  flameLights.push(fireLight);
  grp.add(fireLight);

  // Burner glow light (under the trivet — warms the base of the crucible)
  const burnerLight = new THREE.PointLight(0xff5520, 1.4, 4, 2.2);
  burnerLight.position.set(0, 0.18, 0);
  burnerLight.userData = { base: 1.4, amp: 0.45, freq: 8.0 };
  flameLights.push(burnerLight);
  grp.add(burnerLight);

  // Subtle ground bounce light tint
  const bounce = new THREE.PointLight(0xff8a30, 0.8, 5, 2.0);
  bounce.position.set(0, 0.05, 0);
  bounce.userData = { base: 0.8, amp: 0.3, freq: 4.0 };
  flameLights.push(bounce);
  grp.add(bounce);

  scene.add(grp);
}

function makeFlameTexture(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const cx = size / 2, cy = size / 2;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
  g.addColorStop(0.0, 'rgba(255,255,210,1)');
  g.addColorStop(0.25, 'rgba(255,200,90,0.9)');
  g.addColorStop(0.55, 'rgba(255,120,30,0.55)');
  g.addColorStop(0.85, 'rgba(180,40,10,0.15)');
  g.addColorStop(1.0, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ============================== ANIMATION ============================== */
function updateRectifierDisplay(meta, value, unit) {
  if (!meta || !meta.screen) return;
  const tex = makeDigitDisplayTexture(value, unit, 256, 128);
  meta.screen.material.map?.dispose();
  meta.screen.material.map = tex;
  meta.screen.material.needsUpdate = true;
}

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

  // Electrolyte surface wobble
  for (const s of electrolyteSurfaces) {
    s.position.y = (s.userData.baseY ?? s.position.y) + Math.sin(t * 1.4 + (s.userData.basePhase || 0)) * 0.01;
  }

  // Bubbles rising
  for (const b of bubbleSprites) {
    const y0 = b.userData.baseY;
    b.position.y = y0 - 0.6 + ((t * b.userData.speed + b.userData.basePhase) % 1.2);
    b.material.opacity = 0.35 + Math.sin(t * 3 + b.userData.basePhase) * 0.15;
  }

  // Flame sprites flicker + rise
  for (const sp of flameSprites) {
    sp.position.y = sp.userData.baseY + Math.sin(t * sp.userData.speed + sp.userData.basePhase) * 0.08;
    const wobble = 1 + Math.sin(t * (sp.userData.speed + 1.2) + sp.userData.basePhase) * 0.10;
    sp.scale.x = sp.userData.baseScaleX * wobble;
    sp.scale.y = sp.userData.baseScaleY * (1 + Math.sin(t * sp.userData.speed * 1.3 + sp.userData.basePhase) * 0.06);
    sp.material.rotation = Math.sin(t * 1.5 + sp.userData.basePhase) * 0.15;
  }

  // Flame lights flicker
  for (const fl of flameLights) {
    const u = fl.userData;
    fl.intensity = u.base + Math.sin(t * u.freq) * u.amp + Math.sin(t * u.freq * 1.7 + 1.3) * u.amp * 0.4;
  }

  // Rectifier readout jitter
  if (t - lastRectifierUpdate > 1.4) {
    lastRectifierUpdate = t;
    // Tight jitter to suggest a stable rectifier reading, not an unstable supply
    const vJitter = (2.98 + Math.random() * 0.04).toFixed(1);    // 2.98–3.02 → reads "3.0"
    const aJitter = String(249 + Math.floor(Math.random() * 3)); // 249–251
    if (rectifierDisplays.length >= 2) {
      updateRectifierDisplay(rectifierDisplays[0], vJitter, 'V');
      updateRectifierDisplay(rectifierDisplays[1], aJitter, 'A');
    }
  }

  // Idle auto-rotate
  if (autoRotateEnabled && (Date.now() - lastUserInteraction) > 5000) {
    const radius = Math.hypot(camera.position.x, camera.position.z);
    const angle = Math.atan2(camera.position.z, camera.position.x) + 0.0006;
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

/* ============================ SLIDECHANGE INTEGRATION ============================ */
window.addEventListener('slidechange', (e) => {
  const idx = e.detail?.index;
  if (idx === 13 || idx === 995) {  // Slide 14 (data-slide="14"), 0-based DOM index = 13
    // Slayt 8 atlasında küçük canvas'a mount edilmiş olabilir;
    // büyük equipment canvas'ına geçişi mount() pattern'iyle güvenli yap.
    const targetCanvas = document.getElementById('three-canvas-ew');
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

// If the slide is already active when this script loads
if (document.querySelector('.slide[data-slide="14"]')?.classList.contains('active')) {
  init();
  startRendering();
}

/* ============================ EXTERNAL MOUNT API (slide 8 atlas) ============================ */
function _disposeForMount() {
  try { window.removeEventListener('resize', onResize); } catch (e) {}
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
  flameSprites.length = 0;
  flameLights.length = 0;
  electrolyteSurfaces.length = 0;
  bubbleSprites.length = 0;
  rectifierDisplays.length = 0;
  lastRectifierUpdate = 0;
  renderer = null;
  scene = null;
  camera = null;
  controls = null;
  canvas = null;
  initialized = false;
}

window.threeElectrowinning = {
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
