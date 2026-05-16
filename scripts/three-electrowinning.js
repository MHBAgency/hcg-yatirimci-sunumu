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
  const width = Math.max(rect.width, 800);
  const height = Math.max(rect.height, 600);

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // White background like the reference photo
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);
  scene.fog = null;

  // Environment for crisp PBR reflections on stainless
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  // Camera framed to mimic the reference: slightly low 3/4 front view
  camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 200);
  camera.position.set(7.5, 5.6, 18.5);
  camera.lookAt(0, 1.6, 0);

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.minDistance = 10;
  controls.maxDistance = 40;
  controls.minPolarAngle = Math.PI * 0.15;
  controls.maxPolarAngle = Math.PI * 0.50;
  controls.target.set(0, 1.6, 0);
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
}

/* ============================== LIGHTS ============================== */
function buildLights() {
  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambient);

  // Key light, front-top-right (matches highlights on stainless in photo)
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(12, 18, 12);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
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

  // Brass valve fitting on the side (front face)
  const brass = new THREE.MeshStandardMaterial({ color: 0xc7a24a, metalness: 0.9, roughness: 0.3 });
  const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.4, 24), brass);
  valve.rotation.z = Math.PI / 2;
  valve.position.set(0.95, 0.9, 0);
  grp.add(valve);
  const valveHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.28, 12), darkMat);
  valveHandle.position.set(1.15, 1.05, 0);
  grp.add(valveHandle);

  // Black elbow pipe rising out the top
  const elbow = makePipeElbow(0.18, darkMat);
  elbow.position.set(-0.45, 2.5, 0);
  grp.add(elbow);

  scene.add(grp);
}

function makePipeElbow(radius, mat) {
  const grp = new THREE.Group();
  const v = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1.2, 18), mat);
  v.position.y = 0.6; grp.add(v);
  // 90 deg curve
  const curve = new THREE.TorusGeometry(0.35, radius, 14, 24, Math.PI / 2);
  const torus = new THREE.Mesh(curve, mat);
  torus.rotation.x = Math.PI / 2;
  torus.position.set(0.35, 1.2, 0);
  grp.add(torus);
  const h = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1.0, 18), mat);
  h.rotation.z = Math.PI / 2;
  h.position.set(0.85, 1.55, 0);
  grp.add(h);
  return grp;
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

  // Yellow priming cap on top of volute
  const yellowCap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.14, 18), yellowMat);
  yellowCap.position.set(1.1, 1.0, 0);
  grp.add(yellowCap);

  // Suction & discharge stubs (black PVC)
  const suct = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.0, 18), blackMat);
  suct.position.set(1.1, 0.55, 0.5);
  suct.rotation.x = Math.PI / 2;
  grp.add(suct);
  const disch = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.7, 18), blackMat);
  disch.position.set(1.6, 0.55, 0);
  disch.rotation.z = Math.PI / 2;
  grp.add(disch);

  // Base feet
  const foot = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.15, 0.7), blackMat);
  foot.position.set(-0.1, 0.08, 0);
  grp.add(foot);

  // PVC plumbing leading toward the cell (a small zigzag of black pipes)
  const pipeGrp = new THREE.Group();
  pipeGrp.position.set(2.2, 0, -0.4);
  const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.2, 16), blackMat);
  p1.position.set(0, 0.55, 0);
  p1.rotation.z = Math.PI / 2;
  pipeGrp.add(p1);
  const elbow1 = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.14, 12, 22, Math.PI / 2), blackMat);
  elbow1.position.set(0.6, 0.55, 0);
  elbow1.rotation.x = Math.PI / 2;
  elbow1.rotation.z = Math.PI;
  pipeGrp.add(elbow1);
  const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.55, 16), blackMat);
  p2.position.set(0.78, 0.85, 0);
  pipeGrp.add(p2);
  const p3 = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.6, 16), blackMat);
  p3.position.set(1.95, 1.0, 0);
  p3.rotation.z = Math.PI / 2;
  pipeGrp.add(p3);
  grp.add(pipeGrp);

  scene.add(grp);
}

/* ====================== ELECTROWINNING CELL ====================== */
function buildElectrowinningCell() {
  const grp = new THREE.Group();
  grp.position.set(CONFIG.cellX, CONFIG.baseHeight, 0);

  const cw = CONFIG.cellWidth, cd = CONFIG.cellDepth, ch = CONFIG.cellHeight;
  const stain = new THREE.MeshStandardMaterial({ color: 0xb1b7bc, metalness: 0.9, roughness: 0.28 });
  const darkStain = new THREE.MeshStandardMaterial({ color: 0x4f555a, metalness: 0.85, roughness: 0.45 });

  // Glass walls - 4 transparent panes (crisp, museum-quality glass)
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xeefbf6,
    metalness: 0.0,
    roughness: 0.02,
    transmission: 0.95,
    thickness: 0.25,
    ior: 1.48,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
    envMapIntensity: 1.2,
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

  // Electrolyte (teal liquid) - fills ~78% of the interior, brighter saturated teal
  const elDepth = ch * 0.78;
  const elMat = new THREE.MeshPhysicalMaterial({
    color: 0x1ec5b1,
    metalness: 0.0,
    roughness: 0.12,
    transmission: 0.62,
    thickness: 2.2,
    ior: 1.34,
    attenuationColor: 0x0a8a7a,
    attenuationDistance: 1.8,
    transparent: true,
    opacity: 0.78,
    side: THREE.DoubleSide,
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

  scene.add(grp);
}

function buildCathodes(parentGrp) {
  const cw = CONFIG.cellWidth, cd = CONFIG.cellDepth, ch = CONFIG.cellHeight;
  const N = CONFIG.cathodeCount;
  const span = cw - 0.9;
  const plateMat = new THREE.MeshStandardMaterial({ color: 0xb8bec3, metalness: 0.95, roughness: 0.22 });
  const anodeMat = new THREE.MeshStandardMaterial({ color: 0xa6acb1, metalness: 0.92, roughness: 0.30 });
  // Steel-wool: pale grey, fibrous, very rough
  const woolMat = new THREE.MeshStandardMaterial({
    color: 0x9ea4a9, metalness: 0.55, roughness: 0.95,
    emissive: 0x141517, emissiveIntensity: 0.25,
  });

  for (let i = 0; i < N; i++) {
    const t = N === 1 ? 0.5 : i / (N - 1);
    const x = -span / 2 + t * span;

    // Stainless hanger plate (visible above electrolyte) - flat anode-style sheet
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.62, cd - 0.4),
      plateMat,
    );
    plate.position.set(x, ch - 0.08, 0);
    plate.castShadow = true;
    parentGrp.add(plate);

    // Small bolt on the top of each plate joining to busbar
    const bolt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 0.18, 10),
      plateMat,
    );
    bolt.position.set(x, ch + 0.28, 0);
    parentGrp.add(bolt);

    // Steel-wool cathode body (fluffy fibrous bundle) hanging into electrolyte
    const woolH = ch * 0.78 - 0.15;
    // Use multiple concentric irregular cylinders + many lumps for a fluffy look
    for (let layer = 0; layer < 3; layer++) {
      const rad = 0.20 + layer * 0.035;
      const wool = new THREE.Mesh(
        new THREE.CylinderGeometry(rad * (0.95 + Math.random()*0.08), rad, woolH - layer * 0.05, 14, 1, false),
        woolMat,
      );
      wool.position.set(x, woolH / 2 + 0.1, 0);
      wool.castShadow = true;
      parentGrp.add(wool);
    }

    // Tons of fibrous lumps to break up the silhouette
    for (let k = 0; k < 32; k++) {
      const lump = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.055 + Math.random() * 0.05, 0),
        woolMat,
      );
      const ang = Math.random() * Math.PI * 2;
      const r = 0.24 + Math.random() * 0.06;
      lump.position.set(
        x + Math.cos(ang) * r,
        0.12 + Math.random() * (woolH - 0.15),
        Math.sin(ang) * r,
      );
      lump.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
      parentGrp.add(lump);
    }

    // Top "bouquet" of wool fibers above electrolyte (visible bushy crown)
    for (let k = 0; k < 14; k++) {
      const tuft = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.08 + Math.random()*0.04, 0),
        woolMat,
      );
      const ang = Math.random() * Math.PI * 2;
      const r = 0.18 + Math.random() * 0.12;
      tuft.position.set(
        x + Math.cos(ang) * r,
        woolH + 0.10 + Math.random()*0.15,
        Math.sin(ang) * r,
      );
      parentGrp.add(tuft);
    }

    // gentle bubble sprite above each cathode (subtle electrolysis feel)
    const bub = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }),
    );
    bub.position.set(x, ch * 0.7, (Math.random() - 0.5) * (cd - 0.8));
    bub.userData = { baseY: bub.position.y, basePhase: Math.random() * Math.PI * 2, speed: 0.3 + Math.random() * 0.2 };
    bubbleSprites.push(bub);
    parentGrp.add(bub);
  }

  // Anode plates BETWEEN cathodes (thin stainless sheets, alternate slots)
  // In the reference: anodes appear as flat steel sheets behind the wool bundles
  for (let i = 0; i < N + 1; i++) {
    const t = N === 1 ? 0.5 : (i - 0.5) / (N - 1);
    const x = -span / 2 + t * span;
    if (Math.abs(x) > cw / 2 - 0.3) continue;
    const sheet = new THREE.Mesh(
      new THREE.BoxGeometry(0.025, ch * 0.78 - 0.05, cd - 0.45),
      anodeMat,
    );
    sheet.position.set(x, (ch * 0.78) / 2 + 0.05, 0);
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
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  // Black screen background with subtle bezel margin
  ctx.fillStyle = '#080202';
  ctx.fillRect(0, 0, w, h);
  // Inner red glow background
  const grad = ctx.createRadialGradient(w*0.55, h*0.5, 4, w*0.55, h*0.5, w*0.5);
  grad.addColorStop(0, 'rgba(80,8,2,0.55)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  // Yellow status LED (left)
  ctx.fillStyle = '#f3c530';
  ctx.shadowColor = '#f3c530';
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.arc(w * 0.10, h * 0.30, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  // small label dot below LED
  ctx.fillStyle = '#cccccc';
  ctx.font = 'bold 14px Helvetica, Arial, sans-serif';
  ctx.fillText('SET', w * 0.06, h * 0.55);
  // 7-segment-style digits
  ctx.fillStyle = '#ff2e15';
  ctx.shadowColor = '#ff3b22';
  ctx.shadowBlur = 18;
  ctx.font = 'bold 86px "DS-Digital","Courier New", monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  ctx.fillText(value, w * 0.80, h * 0.52);
  ctx.shadowBlur = 0;
  // Unit label
  ctx.font = 'bold 30px Helvetica, Arial, sans-serif';
  ctx.fillStyle = '#ffd6c4';
  ctx.textAlign = 'left';
  ctx.fillText(unit, w * 0.83, h * 0.58);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
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
  const cellTopY = CONFIG.baseHeight + CONFIG.cellHeight + 0.5;  // top of busbar
  const cabinetSocketY = CONFIG.baseHeight + CONFIG.cabinetHeight * 0.36;  // banana socket Y
  const cabinetFrontZ = -0.4 + CONFIG.cabinetDepth / 2 + 0.05;

  // Common terminal lug geometry helper
  const lugMat = new THREE.MeshStandardMaterial({ color: 0x3a3f44, metalness: 0.92, roughness: 0.28 });
  const boltCapMat = new THREE.MeshStandardMaterial({ color: 0x6a7079, metalness: 0.95, roughness: 0.22 });
  const makeLug = (color) => {
    const g = new THREE.Group();
    // Crimp barrel (where the cable enters)
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.085, 0.085, 0.22, 16),
      new THREE.MeshStandardMaterial({ color: color, metalness: 0.5, roughness: 0.45 }),
    );
    g.add(barrel);
    // Tang plate
    const tang = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.035, 0.18),
      lugMat,
    );
    tang.position.y = 0.14;
    g.add(tang);
    // Bolt cap on top of tang
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.06, 8),
      boltCapMat,
    );
    cap.position.y = 0.17;
    g.add(cap);
    return g;
  };

  // RED cable (+) connects at the LEFT side of the busbar in the reference photo
  const redMat = new THREE.MeshStandardMaterial({ color: 0xc92a25, metalness: 0.25, roughness: 0.55 });
  const redStart = new THREE.Vector3(CONFIG.cellX - CONFIG.cellWidth * 0.32, cellTopY + 0.05, 0.0);
  const redCurve = new THREE.CatmullRomCurve3([
    redStart,
    new THREE.Vector3(CONFIG.cellX - CONFIG.cellWidth * 0.30, cellTopY + 0.85, 0.30),
    new THREE.Vector3(CONFIG.cellX + 0.5, cellTopY + 1.20, 0.7),
    new THREE.Vector3(CONFIG.cellX + 2.6, cellTopY + 0.85, 1.1),
    new THREE.Vector3(CONFIG.cabinetX - 1.6, CONFIG.baseHeight + CONFIG.cabinetHeight * 0.75, cabinetFrontZ + 0.4),
    new THREE.Vector3(CONFIG.cabinetX - CONFIG.cabinetWidth * 0.20, cabinetSocketY + 0.10, cabinetFrontZ + 0.05),
    new THREE.Vector3(CONFIG.cabinetX - CONFIG.cabinetWidth * 0.20, cabinetSocketY, cabinetFrontZ + 0.02),
  ]);
  const redTube = new THREE.Mesh(new THREE.TubeGeometry(redCurve, 96, 0.085, 14, false), redMat);
  redTube.castShadow = true;
  scene.add(redTube);

  // Red lug at busbar
  const redLug = makeLug(0xc92a25);
  redLug.position.set(redStart.x, redStart.y, redStart.z);
  scene.add(redLug);

  // BLACK cable (-) connects at the RIGHT side of the busbar
  const blackMat = new THREE.MeshStandardMaterial({ color: 0x0c0e11, metalness: 0.25, roughness: 0.55 });
  const blackStart = new THREE.Vector3(CONFIG.cellX + CONFIG.cellWidth * 0.32, cellTopY + 0.05, 0.0);
  const blackCurve = new THREE.CatmullRomCurve3([
    blackStart,
    new THREE.Vector3(CONFIG.cellX + CONFIG.cellWidth * 0.32, cellTopY + 0.70, 0.30),
    new THREE.Vector3(CONFIG.cellX + CONFIG.cellWidth * 0.55, cellTopY + 0.95, 0.7),
    new THREE.Vector3(CONFIG.cabinetX - 1.4, CONFIG.baseHeight + CONFIG.cabinetHeight * 0.62, cabinetFrontZ + 0.35),
    new THREE.Vector3(CONFIG.cabinetX + CONFIG.cabinetWidth * 0.20, cabinetSocketY + 0.10, cabinetFrontZ + 0.05),
    new THREE.Vector3(CONFIG.cabinetX + CONFIG.cabinetWidth * 0.20, cabinetSocketY, cabinetFrontZ + 0.02),
  ]);
  const blackTube = new THREE.Mesh(new THREE.TubeGeometry(blackCurve, 96, 0.085, 14, false), blackMat);
  blackTube.castShadow = true;
  scene.add(blackTube);

  // Black lug at busbar
  const blackLug = makeLug(0x141618);
  blackLug.position.set(blackStart.x, blackStart.y, blackStart.z);
  scene.add(blackLug);
}

/* ============================ GOLD-MUD TRAY ============================ */
function buildGoldMudTray() {
  const grp = new THREE.Group();
  grp.position.set(CONFIG.trayX, CONFIG.baseHeight, 2.3);

  const stainMat = new THREE.MeshStandardMaterial({ color: 0xb1b7bc, metalness: 0.9, roughness: 0.3 });
  const mudMat = new THREE.MeshStandardMaterial({ color: 0x8a8f93, metalness: 0.55, roughness: 0.85 });

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
  const crucMat = new THREE.MeshStandardMaterial({ color: 0x4a2f1a, metalness: 0.45, roughness: 0.72 });
  const crucible = new THREE.Mesh(
    new THREE.CylinderGeometry(0.40, 0.28, 0.70, 28),
    crucMat,
  );
  crucible.position.y = 0.40;
  crucible.castShadow = true; crucible.receiveShadow = true;
  grp.add(crucible);

  // Rim - bronze highlight
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.40, 0.045, 10, 36),
    new THREE.MeshStandardMaterial({ color: 0x6e4326, metalness: 0.65, roughness: 0.55 }),
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.74;
  grp.add(rim);

  // Slight glow ring at top inside (heated rim)
  const hotRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.36, 0.025, 8, 28),
    new THREE.MeshStandardMaterial({ color: 0xff7a14, emissive: 0xff5a08, emissiveIntensity: 1.2, metalness: 0.6, roughness: 0.6 }),
  );
  hotRing.rotation.x = Math.PI / 2;
  hotRing.position.y = 0.73;
  grp.add(hotRing);

  // Stand under crucible (small dark plinth)
  const stand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.4, 0.08, 24),
    new THREE.MeshStandardMaterial({ color: 0x1a1c20, metalness: 0.6, roughness: 0.55 }),
  );
  stand.position.y = 0.04;
  grp.add(stand);

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
  pool.position.y = 0.71;
  grp.add(pool);

  // Flame - tighter teardrop shape rising from the crucible
  // Inner hot core (yellow-white), narrower
  const layers = [
    { color: 0xffe9b0, scaleX: 0.55, scaleY: 0.85, y: 0.95, op: 0.95 },
    { color: 0xffc065, scaleX: 0.72, scaleY: 1.05, y: 1.15, op: 0.85 },
    { color: 0xff8a30, scaleX: 0.85, scaleY: 1.30, y: 1.40, op: 0.75 },
    { color: 0xff6618, scaleX: 0.95, scaleY: 1.55, y: 1.65, op: 0.55 },
    { color: 0xd83a08, scaleX: 1.05, scaleY: 1.75, y: 1.90, op: 0.35 },
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
  fireLight.position.set(0, 1.3, 0);
  fireLight.userData = { base: 2.6, amp: 0.7, freq: 6.0 };
  flameLights.push(fireLight);
  grp.add(fireLight);

  // Subtle ground bounce light tint
  const bounce = new THREE.PointLight(0xff8a30, 0.8, 5, 2.0);
  bounce.position.set(0, 0.15, 0);
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
    const vJitter = (2.95 + Math.random() * 0.10).toFixed(1);
    const aJitter = String(247 + Math.floor(Math.random() * 7));
    if (rectifierDisplays.length >= 2) {
      updateRectifierDisplay(rectifierDisplays[0], vJitter, 'V');
      updateRectifierDisplay(rectifierDisplays[1], aJitter, 'A');
    }
  }

  // Idle auto-rotate
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

/* ============================ SLIDECHANGE INTEGRATION ============================ */
window.addEventListener('slidechange', (e) => {
  const idx = e.detail?.index;
  if (idx === 16 || idx === 995) {
    init();
    setTimeout(onResize, 50);
    startRendering();
  } else {
    stopRendering();
  }
});

// If the slide is already active when this script loads
if (document.querySelector('.slide[data-slide="17"]')?.classList.contains('active')) {
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
    if (!initialized) {
      if (frameId !== null) { cancelAnimationFrame(frameId); frameId = null; }
      return;
    }
    _disposeForMount();
  },
  get isMounted() { return initialized; },
  get currentCanvas() { return canvas; },
};
