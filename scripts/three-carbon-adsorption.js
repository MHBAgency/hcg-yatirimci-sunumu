import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* ===================================================================
 * NTE Pars Metal — Procedural 3D Carbon Adsorption Columns
 * 4-column train (C-201A/B/C/D) in series — gold-loaded PLS from CIL
 * cascades through activated-carbon columns. Modeled to match the
 * firm's reference image: tall slim columns on an elevated concrete
 * skid, PLS IN entering from the LEFT into A, RAFFINATE OUT leaving
 * from TOP of D into a Raffinate tank (TK-201), Backwash Water on
 * TOP of each column, ET-101 / TK-101 tank with pumps on the LEFT,
 * front-skid labels (Pre / Drain / Bypas / Brinat), yellow safety
 * stripes, walkway with stairs on the right.
 *
 * Built entirely from Three.js primitives — no external models, no
 * image textures. Stencil labels are drawn onto canvas textures and
 * used as sprites/plane meshes.
 * =================================================================== */

const CONFIG = {
  columnCount: 4,
  columnSpacing: 3.0,           // tight spacing — columns touch each other in ref
  columnRadius: 0.95,           // slim vessel
  columnHeight: 5.6,            // tall barrel
  coneHeight: 0.9,              // sharp cone bottom
  skidDeckY: 0.55,              // top surface of the elevated skid deck
  skidDeckHeight: 0.4,          // skid deck thickness (concrete slab)
  slideIndex: 11,   // Slide 12 (data-slide="12"), 0-based DOM index = 11
};

let renderer, scene, camera, controls;
let canvas;
let initialized = false;
let frameId = null;

// Animated element registries
const flowMarkers = [];           // arrow/disk markers moving along interstage pipes
const carbonParticles = [];       // particles wiggling inside columns
const pressureGauges = [];        // gauge needle meshes for wobble animation
const slurrySurfaces = [];        // top-of-column slurry caps for gentle bob
const inletFlowMarkers = [];      // markers on the PLS inlet line
const backwashMarkers = [];       // backwash water animation markers
const mixerShafts = [];           // TK-101 mixer shaft rotation

let lastUserInteraction = Date.now();
let autoRotateEnabled = true;

/* ============================ INIT ============================ */
function init(targetCanvas) {
  if (initialized) return;
  initialized = true;

  canvas = targetCanvas || document.getElementById('three-canvas-carbon-ads');
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
  renderer.toneMappingExposure = 1.28;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  // Scene — black studio backdrop
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.FogExp2(0x000000, 0.0042);

  // PBR environment for stainless reflections
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  // Camera — match the reference image's catalog-style front-three-quarter view.
  // The reference is shot nearly head-on with a slight elevation. The previous
  // (11.5, 5.2, 20.5) was strongly biased toward the right, which buried col A
  // behind D. Move toward the centre so all four columns read evenly.
  camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 220);
  camera.position.set(2.5, 4.8, 24.0);
  camera.lookAt(0, 3.6, 0);

  // Controls
  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 12;
  controls.maxDistance = 52;
  controls.minPolarAngle = Math.PI * 0.14;
  controls.maxPolarAngle = Math.PI * 0.50;
  controls.target.set(0, 3.6, 0);
  controls.addEventListener('start', () => {
    lastUserInteraction = Date.now();
    autoRotateEnabled = false;
  });
  controls.addEventListener('end', () => {
    lastUserInteraction = Date.now();
    setTimeout(() => { autoRotateEnabled = true; }, 5000);
  });

  setupLights();
  buildGroundAndSkid();
  buildColumnTrain();
  buildInterstagePiping();
  buildBackwashHeader();          // top-of-column backwash header (matches ref)
  buildPlsInlet();                // PLS IN from left into A
  buildRaffinateLine();           // top of D to Raffinate tank on right
  buildRaffinateTank();           // TK-201 on right
  buildTkTank();                  // TK-101 (ET-101) tank on left with mixer
  buildPumpSkid();                // pumps in front of TK-101
  buildFrontSkidLabels();         // Pre / Drain / Bypas / Brinat
  buildHeaderWalkway();
  buildAccessLadders();
  buildOverheadLabel();
  buildAtmosphericGlow();

  window.addEventListener('resize', onResize);
}

/* ============================ LIGHTING ============================ */
function setupLights() {
  const hemi = new THREE.HemisphereLight(0xfff4e2, 0x4a4030, 0.65);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffffff, 2.05);
  key.position.set(14, 22, 12);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -22;
  key.shadow.camera.right = 22;
  key.shadow.camera.top = 22;
  key.shadow.camera.bottom = -10;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 65;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0xa8c0e0, 0.55);
  rim.position.set(-14, 10, -12);
  scene.add(rim);

  const fill = new THREE.DirectionalLight(0xfff0c0, 0.42);
  fill.position.set(-6, 6, 14);
  scene.add(fill);
}

/* ============================ GROUND + SKID ============================
 * Ground floor (concrete pad) at y=0. On top of it sits the ELEVATED
 * SKID DECK at y=skidDeckY where the columns + tanks rest. This matches
 * the reference image: everything sits on a single raised slab.
 * ============================================================================ */
function buildGroundAndSkid() {
  const colsWidth = (CONFIG.columnCount - 1) * CONFIG.columnSpacing;
  const totalWidth = colsWidth + 14.0;    // extra room for TK-101 left + raffinate tank right

  // Ground (concrete floor)
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x8e8a82, roughness: 0.95, metalness: 0.03,
  });
  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(totalWidth + 6, 0.16, 12),
    groundMat
  );
  ground.position.y = -0.08;
  ground.receiveShadow = true;
  scene.add(ground);

  // Elevated skid deck (where columns + tanks sit)
  const deckMat = new THREE.MeshStandardMaterial({
    color: 0xb0aea4, roughness: 0.88, metalness: 0.05,
  });
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(totalWidth, CONFIG.skidDeckHeight, 5.8),
    deckMat
  );
  deck.position.y = CONFIG.skidDeckY - CONFIG.skidDeckHeight / 2;
  deck.receiveShadow = true;
  deck.castShadow = true;
  scene.add(deck);

  // Skid deck edge bevel (gold safety stripe along front & back)
  const stripeMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37, roughness: 0.5, metalness: 0.55,
    emissive: 0xd4af37, emissiveIntensity: 0.10,
  });
  for (let z = -1; z <= 1; z += 2) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(totalWidth, 0.05, 0.18),
      stripeMat
    );
    stripe.position.set(0, CONFIG.skidDeckY + 0.005, z * 2.85);
    scene.add(stripe);
  }

  // Dark edge band under the gold stripes
  const edgeMat = new THREE.MeshStandardMaterial({
    color: 0x44464a, roughness: 0.85, metalness: 0.1,
  });
  for (let z = -1; z <= 1; z += 2) {
    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(totalWidth + 0.04, CONFIG.skidDeckHeight + 0.04, 0.06),
      edgeMat
    );
    edge.position.set(0, CONFIG.skidDeckY - CONFIG.skidDeckHeight / 2, z * 2.93);
    scene.add(edge);
  }

  // Skid front/back support beams (I-beam looking) under the deck
  const beamMat = new THREE.MeshStandardMaterial({
    color: 0x35383d, roughness: 0.7, metalness: 0.5,
  });
  for (let z = -1; z <= 1; z += 2) {
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(totalWidth, 0.22, 0.18),
      beamMat
    );
    beam.position.set(0, 0.13, z * 2.7);
    beam.castShadow = true;
    scene.add(beam);
  }
  // Cross supports under the deck
  for (let i = -3; i <= 3; i++) {
    const cross = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.18, 5.6),
      beamMat
    );
    cross.position.set(i * (totalWidth / 7), 0.11, 0);
    cross.castShadow = true;
    scene.add(cross);
  }

  // Concrete pedestals (foundation blocks) under the skid corners
  const pedMat = new THREE.MeshStandardMaterial({
    color: 0x9a978f, roughness: 0.92, metalness: 0.02,
  });
  for (let xS = -1; xS <= 1; xS += 2) {
    for (let zS = -1; zS <= 1; zS += 2) {
      const ped = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.22, 0.7),
        pedMat
      );
      ped.position.set(xS * (totalWidth / 2 - 0.6), 0.02, zS * 2.6);
      ped.receiveShadow = true;
      scene.add(ped);
    }
  }

  // ---- METAL GRATING WALKWAY across the deck top between columns ----
  // Reference shows an expanded-metal grid surface walking surface on top of
  // the concrete slab. Build it via a procedural canvas texture so we get the
  // characteristic dark crosshatch without slow geometry.
  const gratingCanvas = document.createElement('canvas');
  gratingCanvas.width = 256;
  gratingCanvas.height = 256;
  const gctx = gratingCanvas.getContext('2d');
  // Base — dark steel
  gctx.fillStyle = '#3a3d44';
  gctx.fillRect(0, 0, 256, 256);
  // Grid: bright steel bars
  gctx.strokeStyle = '#8a8d93';
  gctx.lineWidth = 4;
  for (let i = 0; i <= 256; i += 22) {
    gctx.beginPath();
    gctx.moveTo(i, 0); gctx.lineTo(i, 256);
    gctx.stroke();
  }
  gctx.lineWidth = 2;
  for (let j = 0; j <= 256; j += 22) {
    gctx.beginPath();
    gctx.moveTo(0, j); gctx.lineTo(256, j);
    gctx.stroke();
  }
  // Soft AO at intersections — adds depth
  gctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (let i = 0; i <= 256; i += 22) {
    for (let j = 0; j <= 256; j += 22) {
      gctx.beginPath();
      gctx.arc(i, j, 3, 0, Math.PI * 2);
      gctx.fill();
    }
  }
  const gratingTex = new THREE.CanvasTexture(gratingCanvas);
  gratingTex.colorSpace = THREE.SRGBColorSpace;
  gratingTex.wrapS = THREE.RepeatWrapping;
  gratingTex.wrapT = THREE.RepeatWrapping;
  gratingTex.anisotropy = 8;
  gratingTex.repeat.set(totalWidth / 1.0, 5.0 / 1.0);

  const grating = new THREE.Mesh(
    new THREE.PlaneGeometry(totalWidth - 0.4, 5.0),
    new THREE.MeshStandardMaterial({
      map: gratingTex, roughness: 0.7, metalness: 0.55,
      transparent: true, alphaTest: 0.05,
    })
  );
  grating.rotation.x = -Math.PI / 2;
  grating.position.set(0, CONFIG.skidDeckY + 0.012, 0);
  grating.receiveShadow = true;
  scene.add(grating);

  // ---- VERTICAL CONCRETE PIERS holding the elevated skid off the ground ----
  // Without these, the deck reads as floating. Reference shows 5–6 visible
  // piers down the front face of the skid.
  const pierMat = new THREE.MeshStandardMaterial({
    color: 0xb6b3aa, roughness: 0.95, metalness: 0.02,
  });
  const pierHeight = CONFIG.skidDeckY - 0.04;
  const pierW = 0.42;
  const pierD = 0.32;
  const pierCount = 6;
  // Span the full deck width with even spacing (front + back rows)
  for (let i = 0; i < pierCount; i++) {
    const t = pierCount === 1 ? 0.5 : i / (pierCount - 1);
    const px = -totalWidth / 2 + 0.7 + t * (totalWidth - 1.4);
    for (const pz of [-2.55, 2.55]) {
      const pier = new THREE.Mesh(
        new THREE.BoxGeometry(pierW, pierHeight, pierD),
        pierMat
      );
      pier.position.set(px, pierHeight / 2, pz);
      pier.castShadow = true;
      pier.receiveShadow = true;
      scene.add(pier);

      // Small darker concrete footing where pier meets the ground
      const footing = new THREE.Mesh(
        new THREE.BoxGeometry(pierW * 1.35, 0.10, pierD * 1.35),
        new THREE.MeshStandardMaterial({
          color: 0x8c8a82, roughness: 0.96, metalness: 0.02,
        })
      );
      footing.position.set(px, 0.05, pz);
      footing.receiveShadow = true;
      scene.add(footing);
    }
  }

  // Concrete riser blocks under the column area (the visible front "wall" of
  // the elevated skid in the reference). This thickens the front facade so
  // the maroon Pre/Drain/Bypas/Brinat labels read against concrete, not air.
  const riserBlockMat = new THREE.MeshStandardMaterial({
    color: 0xc9c5bb, roughness: 0.94, metalness: 0.02,
  });
  const colsWidthInner = (CONFIG.columnCount - 1) * CONFIG.columnSpacing + 1.6;
  const riserBlock = new THREE.Mesh(
    new THREE.BoxGeometry(colsWidthInner, CONFIG.skidDeckY - 0.02, 0.20),
    riserBlockMat
  );
  riserBlock.position.set(0, (CONFIG.skidDeckY - 0.02) / 2, 2.85);
  riserBlock.receiveShadow = true;
  scene.add(riserBlock);
}

/* ============================ COLUMN TRAIN ============================ */
function buildColumnTrain() {
  const startX = -((CONFIG.columnCount - 1) * CONFIG.columnSpacing) / 2;
  const labels = ['A', 'B', 'C', 'D'];
  for (let i = 0; i < CONFIG.columnCount; i++) {
    const x = startX + i * CONFIG.columnSpacing;
    const col = buildSingleColumn(labels[i], i);
    col.position.x = x;
    scene.add(col);
  }
}

function buildSingleColumn(letter, indexZeroBased) {
  const group = new THREE.Group();
  const R = CONFIG.columnRadius;
  const H = CONFIG.columnHeight;
  const cone = CONFIG.coneHeight;
  const deckY = CONFIG.skidDeckY;

  // All vertical Y values are measured from y=0 (ground)
  // bottom of column cone tip = deckY (resting on skid deck)
  const coneTipY = deckY;
  const coneTopY = coneTipY + cone;
  const shellBottomY = coneTopY;
  const shellTopY = shellBottomY + H;
  const domeY = shellTopY;

  /* ----- Stainless shell (now split into TOP-METAL + GLASS-WINDOW + BOTTOM-METAL
   *        so the activated-carbon bed inside is visible — matches reference. ----- */
  const shellMat = new THREE.MeshPhysicalMaterial({
    color: 0xd2d6dc,
    roughness: 0.18,
    metalness: 0.96,
    envMapIntensity: 1.55,
    clearcoat: 0.35,
    clearcoatRoughness: 0.20,
  });

  // Top metal ring (~top 15% of barrel)
  const topMetalH = H * 0.15;
  const topMetal = new THREE.Mesh(
    new THREE.CylinderGeometry(R, R, topMetalH, 40, 1, true),
    shellMat
  );
  topMetal.position.y = shellTopY - topMetalH / 2;
  topMetal.castShadow = true;
  topMetal.receiveShadow = true;
  group.add(topMetal);

  // Bottom metal ring (~bottom 15% of barrel)
  const botMetalH = H * 0.15;
  const botMetal = new THREE.Mesh(
    new THREE.CylinderGeometry(R, R, botMetalH, 40, 1, true),
    shellMat
  );
  botMetal.position.y = shellBottomY + botMetalH / 2;
  botMetal.castShadow = true;
  botMetal.receiveShadow = true;
  group.add(botMetal);

  // Middle GLASS window (70% of barrel) — physical glass so light transmits & we see the bed
  const glassH = H * 0.70;
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xeaf2fa,
    roughness: 0.04,
    metalness: 0.0,
    transmission: 0.92,
    thickness: 0.18,
    ior: 1.45,
    transparent: true,
    opacity: 0.30,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    side: THREE.DoubleSide,
    envMapIntensity: 1.2,
  });
  const glassWindow = new THREE.Mesh(
    new THREE.CylinderGeometry(R, R, glassH, 56, 1, true),
    glassMat
  );
  glassWindow.position.y = shellBottomY + botMetalH + glassH / 2;
  glassWindow.renderOrder = 2;
  group.add(glassWindow);

  // Decorative steel bands at glass/metal joints (top + bottom seam of window)
  const seamMat = new THREE.MeshStandardMaterial({
    color: 0x8a8d93, roughness: 0.32, metalness: 0.96,
  });
  for (const sy of [
    shellBottomY + botMetalH,
    shellBottomY + botMetalH + glassH,
  ]) {
    const seam = new THREE.Mesh(
      new THREE.TorusGeometry(R + 0.018, 0.035, 10, 40),
      seamMat
    );
    seam.position.y = sy;
    seam.rotation.x = Math.PI / 2;
    group.add(seam);
  }

  /* ----- Conical bottom ----- */
  const bottomGeom = new THREE.CylinderGeometry(R, 0.18, cone, 32, 1, false);
  const bottom = new THREE.Mesh(bottomGeom, shellMat);
  bottom.position.y = coneTipY + cone / 2;
  bottom.castShadow = true;
  bottom.receiveShadow = true;
  group.add(bottom);

  // Saddle support ring (steel ring where the cone meets the skid)
  const saddleMat = new THREE.MeshStandardMaterial({
    color: 0x42454c, roughness: 0.65, metalness: 0.55,
  });
  const saddle = new THREE.Mesh(
    new THREE.CylinderGeometry(R * 0.55, R * 0.85, 0.10, 18),
    saddleMat
  );
  saddle.position.y = coneTipY + 0.05;
  group.add(saddle);

  /* ----- Soft circular contact shadow under the column (sits just on the deck) ----- */
  const contactShadowTex = (() => {
    const cc = document.createElement('canvas');
    cc.width = 128; cc.height = 128;
    const cctx = cc.getContext('2d');
    const grad = cctx.createRadialGradient(64, 64, 8, 64, 64, 60);
    grad.addColorStop(0.0, 'rgba(0,0,0,0.55)');
    grad.addColorStop(0.6, 'rgba(0,0,0,0.18)');
    grad.addColorStop(1.0, 'rgba(0,0,0,0.0)');
    cctx.fillStyle = grad;
    cctx.fillRect(0, 0, 128, 128);
    const tx = new THREE.CanvasTexture(cc);
    tx.colorSpace = THREE.SRGBColorSpace;
    return tx;
  })();
  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(R * 2.5, R * 2.5),
    new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      depthWrite: false,
    })
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = coneTipY - 0.04;
  contactShadow.renderOrder = -1;
  group.add(contactShadow);

  /* ----- Cone-to-deck stainless flange ring + bolt circle -----
   * Without this the cone visually plunges into the deck. The flange ring
   * makes it read as a proper bolted vessel-to-skid interface (matches ref).
   */
  const flangeRingMat = new THREE.MeshStandardMaterial({
    color: 0xb8bcc2, roughness: 0.30, metalness: 0.92,
  });
  const flangeRing = new THREE.Mesh(
    new THREE.CylinderGeometry(R * 1.18, R * 1.18, 0.07, 32),
    flangeRingMat
  );
  flangeRing.position.y = coneTipY - 0.005;
  flangeRing.castShadow = true;
  flangeRing.receiveShadow = true;
  group.add(flangeRing);

  // Inner ring (slightly darker) for visual depth
  const flangeRingInner = new THREE.Mesh(
    new THREE.TorusGeometry(R * 1.05, 0.025, 8, 32),
    new THREE.MeshStandardMaterial({
      color: 0x6a6d72, roughness: 0.4, metalness: 0.9,
    })
  );
  flangeRingInner.rotation.x = Math.PI / 2;
  flangeRingInner.position.y = coneTipY + 0.025;
  group.add(flangeRingInner);

  // 8 bolts around the flange ring perimeter
  const flangeBoltMat = new THREE.MeshStandardMaterial({
    color: 0x9a9d9f, roughness: 0.3, metalness: 0.9,
  });
  for (let b = 0; b < 8; b++) {
    const ang = (b / 8) * Math.PI * 2;
    const bolt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.028, 0.10, 8),
      flangeBoltMat
    );
    bolt.position.set(
      Math.cos(ang) * R * 1.12,
      coneTipY + 0.045,
      Math.sin(ang) * R * 1.12
    );
    group.add(bolt);
  }

  /* ----- Top dome cap ----- */
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(R, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2),
    shellMat
  );
  dome.position.y = domeY;
  dome.castShadow = true;
  group.add(dome);

  // Dome flange where shell meets dome
  const domeFlange = new THREE.Mesh(
    new THREE.TorusGeometry(R + 0.03, 0.045, 10, 32),
    new THREE.MeshStandardMaterial({
      color: 0x6a6d72, roughness: 0.4, metalness: 0.9,
    })
  );
  domeFlange.position.y = domeY;
  domeFlange.rotation.x = Math.PI / 2;
  group.add(domeFlange);

  // Top fitting on the dome — the reference shows a small vent stack /
  // manway projection on the dome apex, not a wide pancake. Use a slim
  // cylindrical stub with a flanged cap.
  const manhole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 0.14, 22),
    new THREE.MeshStandardMaterial({
      color: 0x5a5d62, roughness: 0.45, metalness: 0.85,
    })
  );
  manhole.position.y = domeY + R * 0.82;
  group.add(manhole);

  const manRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.21, 0.21, 0.04, 22),
    new THREE.MeshStandardMaterial({
      color: 0x6a6d72, roughness: 0.4, metalness: 0.9,
    })
  );
  manRing.position.y = domeY + R * 0.82 + 0.08;
  group.add(manRing);

  // Top cap dome (small hemispherical cap on the vent stub)
  const manCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.20, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: 0xa0a4aa, roughness: 0.30, metalness: 0.92,
    })
  );
  manCap.position.y = domeY + R * 0.82 + 0.10;
  group.add(manCap);

  // Manhole bolts (smaller pattern matching the slimmer fitting)
  const boltMat = new THREE.MeshStandardMaterial({
    color: 0x9a9d9f, roughness: 0.3, metalness: 0.9,
  });
  for (let b = 0; b < 6; b++) {
    const ang = (b / 6) * Math.PI * 2;
    const bolt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.020, 0.020, 0.08, 8),
      boltMat
    );
    bolt.position.set(
      Math.cos(ang) * 0.20,
      domeY + R * 0.82 + 0.08,
      Math.sin(ang) * 0.20
    );
    group.add(bolt);
  }

  /* ----- Carbon bed visible interior ----- */
  // Reference shows a deep black-brown granular bed — much darker than slurry.
  // Keep the gradient SUBTLE so all 4 columns visually match the reference,
  // which shows nearly identical dark carbon beds across A..D.
  const gradT = indexZeroBased / (CONFIG.columnCount - 1);  // 0 = A loaded → 1 = D fresh
  const carbonColor = new THREE.Color().setHSL(
    0.075 - gradT * 0.004,
    0.40 - gradT * 0.06,
    0.045 + gradT * 0.008
  );
  const carbonMat = new THREE.MeshStandardMaterial({
    color: carbonColor,
    roughness: 0.95,
    metalness: 0.0,
    emissive: new THREE.Color(0x140d05),
    emissiveIntensity: 0.10 - gradT * 0.02,
  });
  // Visible bed sized to sit inside the glass window (H*0.15 → H*0.85).
  // Slightly smaller radius so the glass tube reads as a separate sleeve around it.
  const carbonBed = new THREE.Mesh(
    new THREE.CylinderGeometry(R - 0.10, R - 0.10, H * 0.68, 32),
    carbonMat
  );
  carbonBed.position.y = shellBottomY + H * 0.49;
  group.add(carbonBed);

  // Carbon granule sprinkles (animated wobble)
  for (let g = 0; g < 22; g++) {
    const radius = (R - 0.18) * Math.sqrt(Math.random());
    const ang = Math.random() * Math.PI * 2;
    const granule = new THREE.Mesh(
      new THREE.SphereGeometry(0.04 + Math.random() * 0.04, 6, 5),
      new THREE.MeshStandardMaterial({
        color: 0x2a1f10,
        roughness: 0.9,
        metalness: 0.05,
        emissive: 0x1a1208,
        emissiveIntensity: 0.4,
      })
    );
    granule.position.set(
      Math.cos(ang) * radius,
      shellBottomY + H * 0.82 + Math.random() * 0.15,
      Math.sin(ang) * radius
    );
    granule.userData = {
      basePhase: Math.random() * Math.PI * 2,
      baseY: granule.position.y,
      baseScale: granule.scale.x,
    };
    carbonParticles.push(granule);
    group.add(granule);
  }

  // Slurry surface above the carbon bed — reference shows a cool blue-cyan tint at the top
  // (light passing through the wash water layer), shifting slightly amber for the loaded A column.
  const slurryHue = 0.55 - gradT * 0.02;   // cyan-blue range
  const slurrySat = 0.45 - gradT * 0.10;
  const slurryLight = 0.42 + gradT * 0.10;
  const slurryColor = new THREE.Color().setHSL(slurryHue, slurrySat, slurryLight);
  const slurryMat = new THREE.MeshPhysicalMaterial({
    color: slurryColor,
    roughness: 0.16,
    metalness: 0.30,
    transmission: 0.28,
    thickness: 1.0,
    transparent: true,
    opacity: 0.92,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    emissive: slurryColor.clone().multiplyScalar(0.18),
    emissiveIntensity: 0.22 - gradT * 0.06,
    side: THREE.DoubleSide,
  });
  const slurry = new THREE.Mesh(
    new THREE.CylinderGeometry(R - 0.08, R - 0.08, 0.22, 32),
    slurryMat
  );
  // Sit the wash-water layer JUST INSIDE the visible glass top so it reads through.
  slurry.position.y = shellBottomY + H * 0.82;
  slurry.userData.basePhase = Math.random() * Math.PI * 2;
  slurry.userData.baseY = slurry.position.y;
  slurrySurfaces.push(slurry);
  group.add(slurry);

  /* ----- Interstage screen housing at cone bottom (the brown-ringed dist plate) ----- */
  const screenHousing = new THREE.Mesh(
    new THREE.CylinderGeometry(R * 1.05, R * 1.05, 0.10, 24),
    new THREE.MeshStandardMaterial({
      color: 0x5a4a2a, roughness: 0.6, metalness: 0.55,
    })
  );
  screenHousing.position.y = coneTopY - 0.05;
  group.add(screenHousing);

  /* ----- Sight-glass strip on the FRONT (+Z side) ----- */
  const gaugeBackMat = new THREE.MeshStandardMaterial({
    color: 0x2a2d33, roughness: 0.5, metalness: 0.7,
  });
  const gaugeBack = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, H * 0.7, 0.22),
    gaugeBackMat
  );
  gaugeBack.position.set(0, shellBottomY + H * 0.5, R * 0.85);
  gaugeBack.rotation.y = 0;
  // Move it tangentially so it sits flat against the cylinder front
  gaugeBack.position.set(0, shellBottomY + H * 0.5, R + 0.04);
  group.add(gaugeBack);

  const gaugeGlass = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, H * 0.65, 0.14),
    new THREE.MeshPhysicalMaterial({
      color: 0xb8d4ec, roughness: 0.05, metalness: 0.0,
      transmission: 0.92, thickness: 0.4, transparent: true,
      opacity: 0.55, clearcoat: 1.0,
    })
  );
  gaugeGlass.position.set(0, shellBottomY + H * 0.5, R + 0.12);
  group.add(gaugeGlass);

  // Level fill behind the glass
  const fillMat = new THREE.MeshStandardMaterial({
    color: slurryColor,
    emissive: slurryColor,
    emissiveIntensity: 0.35,
  });
  const fillBar = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, H * 0.55, 0.12),
    fillMat
  );
  fillBar.position.set(0, shellBottomY + H * 0.45, R + 0.12);
  group.add(fillBar);

  // Sight-glass top + bottom isolation valves (proper attached to glass)
  const sgValveMat = new THREE.MeshStandardMaterial({
    color: 0x5a3a1a, roughness: 0.6, metalness: 0.5,
  });
  for (let v = 0; v < 2; v++) {
    const valveY = shellBottomY + (v === 0 ? H * 0.18 : H * 0.82);
    const vb = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.18, 0.24),
      sgValveMat
    );
    vb.position.set(0, valveY, R + 0.05);
    group.add(vb);

    const handleSG = new THREE.Mesh(
      new THREE.TorusGeometry(0.07, 0.018, 6, 14),
      new THREE.MeshStandardMaterial({
        color: 0xd4af37, roughness: 0.4, metalness: 0.7,
      })
    );
    handleSG.position.set(0, valveY, R + 0.18);
    handleSG.rotation.y = Math.PI / 2;
    group.add(handleSG);
  }

  /* ----- Pressure gauge on the RIGHT (+X) side ----- */
  const gaugeStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.28, 8),
    new THREE.MeshStandardMaterial({ color: 0x42454c, roughness: 0.5, metalness: 0.8 })
  );
  gaugeStem.rotation.z = Math.PI / 2;
  gaugeStem.position.set(R + 0.14, shellBottomY + H * 0.75, 0);
  group.add(gaugeStem);

  const gaugeFace = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, 0.04, 24),
    new THREE.MeshStandardMaterial({
      color: 0xf5f1e8, roughness: 0.4, metalness: 0.15,
    })
  );
  gaugeFace.rotation.z = Math.PI / 2;
  gaugeFace.position.set(R + 0.30, shellBottomY + H * 0.75, 0);
  group.add(gaugeFace);

  const faceTex = makeGaugeFaceTexture();
  const gaugeFront = new THREE.Mesh(
    new THREE.CircleGeometry(0.10, 24),
    new THREE.MeshBasicMaterial({
      map: faceTex, transparent: true, side: THREE.DoubleSide,
    })
  );
  gaugeFront.rotation.y = Math.PI / 2;
  gaugeFront.position.set(R + 0.33, shellBottomY + H * 0.75, 0);
  group.add(gaugeFront);

  const needle = new THREE.Mesh(
    new THREE.BoxGeometry(0.005, 0.08, 0.010),
    new THREE.MeshBasicMaterial({ color: 0xb02020 })
  );
  needle.position.set(R + 0.335, shellBottomY + H * 0.75, 0);
  needle.userData = {
    baseAngle: -0.4 + indexZeroBased * 0.15,
    wobblePhase: Math.random() * Math.PI * 2,
  };
  pressureGauges.push(needle);
  group.add(needle);

  /* ----- Sample tap on LEFT (-X) side ----- */
  const tapBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.16, 10),
    new THREE.MeshStandardMaterial({
      color: 0xd4af37, roughness: 0.4, metalness: 0.75,
    })
  );
  tapBody.rotation.z = Math.PI / 2;
  tapBody.position.set(-R - 0.10, shellBottomY + H * 0.40, 0);
  group.add(tapBody);

  const tapHandle = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.022, 0.022),
    new THREE.MeshStandardMaterial({
      color: 0x9a9d9f, roughness: 0.3, metalness: 0.9,
    })
  );
  tapHandle.position.set(-R - 0.10, shellBottomY + H * 0.40 + 0.13, 0);
  group.add(tapHandle);

  /* ----- TOP CENTER inlet boss (where backwash + interstage feed combine) ----- */
  // Note: in the reference, top of each column has a vertical boss going up.
  const inletBoss = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 0.32, 18),
    new THREE.MeshStandardMaterial({
      color: 0x5a5d62, roughness: 0.5, metalness: 0.85,
    })
  );
  inletBoss.position.y = domeY + R * 0.35;
  group.add(inletBoss);

  const inletFlangeTop = new THREE.Mesh(
    new THREE.CylinderGeometry(0.23, 0.23, 0.05, 18),
    new THREE.MeshStandardMaterial({
      color: 0x6a6d72, roughness: 0.4, metalness: 0.9,
    })
  );
  inletFlangeTop.position.y = domeY + R * 0.35 + 0.18;
  group.add(inletFlangeTop);

  /* ----- Bottom outlet boss at the cone tip ----- */
  // The cone tip is at y = coneTipY; outlet boss sticks UNDER the skid deck via a hole.
  // We model it as a short cylinder hanging from the cone tip.
  const outletBoss = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, 0.20, 18),
    new THREE.MeshStandardMaterial({
      color: 0x5a5d62, roughness: 0.5, metalness: 0.85,
    })
  );
  outletBoss.position.y = coneTipY - 0.10;
  group.add(outletBoss);

  const outletFlangeBottom = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.05, 18),
    new THREE.MeshStandardMaterial({
      color: 0x6a6d72, roughness: 0.4, metalness: 0.9,
    })
  );
  outletFlangeBottom.position.y = coneTipY - 0.22;
  group.add(outletFlangeBottom);

  // Outlet bolt pattern
  for (let b = 0; b < 4; b++) {
    const ang = (b / 4) * Math.PI * 2 + Math.PI / 4;
    const bolt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.08, 8),
      boltMat
    );
    bolt.position.set(Math.cos(ang) * 0.18, coneTipY - 0.23, Math.sin(ang) * 0.18);
    group.add(bolt);
  }

  /* ----- Stencil labels ----- */
  // C-201A header label (top, dark blue background like reference)
  const tag = makeColumnHeaderLabel(`C-201${letter}`);
  tag.position.set(0, shellBottomY + H * 0.78, R + 0.03);
  group.add(tag);

  // "Activated Carbon Bed" sub-label — stacked vertically inside the glass window,
  // larger so it reads clearly at default camera distance (matches reference style).
  const subtag = makeStencilLabel('Activated\nCarbon\nBed', {
    color: '#ffffff', size: 44, width: 256, height: 320,
  });
  subtag.scale.set(0.85, 0.85, 0.85);
  subtag.position.set(0, shellBottomY + H * 0.50, R + 0.22);
  group.add(subtag);

  return group;
}

/* ============================ INTERSTAGE PIPING ============================
 * Bottom of column N → Top of column N+1. Path:
 *   outlet boss (under deck) → elbow → vertical rise on outside of column N+1
 *   → top elbow → into top inlet boss of N+1.
 * This matches the reference image's external interstage piping.
 * ============================================================================ */
function buildInterstagePiping() {
  const startX = -((CONFIG.columnCount - 1) * CONFIG.columnSpacing) / 2;
  const spacing = CONFIG.columnSpacing;
  const cone = CONFIG.coneHeight;
  const H = CONFIG.columnHeight;
  const R = CONFIG.columnRadius;
  const deckY = CONFIG.skidDeckY;

  // Reference frame for each column
  const coneTipY = deckY;
  const coneTopY = coneTipY + cone;
  const shellTopY = coneTopY + H;
  const domeApexY = shellTopY + R;          // top of dome cap
  const topInletY = shellTopY + R * 0.35 + 0.18;  // top flange of inlet boss

  const pipeMat = new THREE.MeshStandardMaterial({
    color: 0x4a4d52, roughness: 0.4, metalness: 0.85,
  });
  const flangeMat = new THREE.MeshStandardMaterial({
    color: 0x6a6d72, roughness: 0.4, metalness: 0.9,
  });
  const valveMat = new THREE.MeshStandardMaterial({
    color: 0x5a3a1a, roughness: 0.6, metalness: 0.5,
  });
  const handleMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37, roughness: 0.4, metalness: 0.7,
  });

  // Underground header runs along the front-edge bottom of the skid deck.
  // We'll route the bottom outlets DOWN through the skid deck to a header at deckY - 0.25,
  // then ACROSS to next column position, then UP outside the column to the top inlet.
  const underY = deckY - 0.32;     // header level just under the skid top surface

  for (let i = 0; i < CONFIG.columnCount - 1; i++) {
    const xL = startX + i * spacing;
    const xR = startX + (i + 1) * spacing;

    /* ----- Vertical drop: outlet boss bottom (at coneTipY-0.22) down to underY ----- */
    const dropLen = (coneTipY - 0.22) - underY;
    const dropL = new THREE.Mesh(
      new THREE.CylinderGeometry(0.10, 0.10, dropLen, 16),
      pipeMat
    );
    dropL.position.set(xL, ((coneTipY - 0.22) + underY) / 2, 0);
    dropL.castShadow = true;
    scene.add(dropL);

    // Flange where dropL meets outlet boss
    const fL = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.04, 18),
      flangeMat
    );
    fL.position.set(xL, coneTipY - 0.22, 0);
    scene.add(fL);

    addPipeJoint(xL, underY, 0, 0.10, pipeMat);

    /* ----- Horizontal traverse from xL to xR at underY (inside the skid) ----- */
    const traverseLen = xR - xL;
    const traverse = new THREE.Mesh(
      new THREE.CylinderGeometry(0.10, 0.10, traverseLen, 16),
      pipeMat
    );
    traverse.rotation.z = Math.PI / 2;
    traverse.position.set((xL + xR) / 2, underY, 0);
    traverse.castShadow = true;
    scene.add(traverse);

    addPipeJoint(xR, underY, 0, 0.10, pipeMat);

    /* ----- Riser: from underY UP outside column R to topInletY ----- */
    // Goes up on the FRONT-RIGHT side of column R so it doesn't conflict with the sight glass.
    const riserXOffset = R + 0.30;
    const riserX = xR + riserXOffset;
    const riserZ = -R * 0.55;

    // First, short horizontal stub from underY at (xR, 0, 0) out to (riserX, underY, riserZ)
    const stubH = new THREE.Mesh(
      new THREE.CylinderGeometry(0.10, 0.10, riserXOffset, 16),
      pipeMat
    );
    stubH.rotation.z = Math.PI / 2;
    stubH.position.set((xR + riserX) / 2, underY, 0);
    scene.add(stubH);

    addPipeJoint(riserX, underY, 0, 0.10, pipeMat);

    // Stub in Z direction from (riserX, underY, 0) to (riserX, underY, riserZ)
    const stubZ = new THREE.Mesh(
      new THREE.CylinderGeometry(0.10, 0.10, Math.abs(riserZ), 16),
      pipeMat
    );
    stubZ.rotation.x = Math.PI / 2;
    stubZ.position.set(riserX, underY, riserZ / 2);
    scene.add(stubZ);

    addPipeJoint(riserX, underY, riserZ, 0.10, pipeMat);

    // Vertical riser
    const riserH = topInletY - underY;
    const riser = new THREE.Mesh(
      new THREE.CylinderGeometry(0.10, 0.10, riserH, 16),
      pipeMat
    );
    riser.position.set(riserX, (underY + topInletY) / 2, riserZ);
    riser.castShadow = true;
    scene.add(riser);

    // Mid-riser isolation valve
    const valveBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.30, 0.24),
      valveMat
    );
    valveBody.position.set(riserX, underY + riserH * 0.40, riserZ);
    scene.add(valveBody);

    const valveStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.28, 8),
      new THREE.MeshStandardMaterial({ color: 0x9a9d9f, roughness: 0.3, metalness: 0.9 })
    );
    valveStem.position.set(riserX + 0.18, underY + riserH * 0.40, riserZ);
    valveStem.rotation.z = Math.PI / 2;
    scene.add(valveStem);

    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(0.10, 0.018, 8, 16),
      handleMat
    );
    handle.position.set(riserX + 0.34, underY + riserH * 0.40, riserZ);
    handle.rotation.y = Math.PI / 2;
    scene.add(handle);

    // Top elbow joint
    addPipeJoint(riserX, topInletY, riserZ, 0.10, pipeMat);

    // Z-stub back from (riserX, topInletY, riserZ) to (riserX, topInletY, 0)
    const topStubZ = new THREE.Mesh(
      new THREE.CylinderGeometry(0.10, 0.10, Math.abs(riserZ), 16),
      pipeMat
    );
    topStubZ.rotation.x = Math.PI / 2;
    topStubZ.position.set(riserX, topInletY, riserZ / 2);
    scene.add(topStubZ);

    addPipeJoint(riserX, topInletY, 0, 0.10, pipeMat);

    // X-stub back from (riserX, topInletY, 0) to top of column R (xR, topInletY, 0)
    const topStubX = new THREE.Mesh(
      new THREE.CylinderGeometry(0.10, 0.10, riserXOffset, 16),
      pipeMat
    );
    topStubX.rotation.z = Math.PI / 2;
    topStubX.position.set((xR + riserX) / 2, topInletY, 0);
    scene.add(topStubX);

    // Flange on top of column R where pipe meets inlet boss
    const fR = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.04, 18),
      flangeMat
    );
    fR.position.set(xR, topInletY, 0);
    scene.add(fR);

    /* ----- Pipe support bracket strapped to column R for the riser ----- */
    const bracket = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.08, 0.35),
      new THREE.MeshStandardMaterial({ color: 0x35383d, roughness: 0.7, metalness: 0.5 })
    );
    bracket.position.set(xR + R * 0.85, underY + riserH * 0.55, riserZ);
    scene.add(bracket);

    /* ----- Animated flow markers ----- */
    // Marker travels: dropL → traverse → stubH → stubZ → riser → topStubZ → topStubX
    // We simplify to two markers in the system: one on horizontal traverse, one on riser
    const fmTrav = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.32, 14),
      new THREE.MeshStandardMaterial({
        color: 0xd4af37,
        emissive: 0xd4af37, emissiveIntensity: 0.9,
        transparent: true, opacity: 0.85,
      })
    );
    fmTrav.rotation.z = Math.PI / 2;
    fmTrav.position.set(xL, underY, 0);
    fmTrav.userData = {
      kind: 'horiz',
      startX: xL, endX: xR, y: underY, z: 0,
      speed: 0.011 + Math.random() * 0.005,
      progress: Math.random(),
    };
    flowMarkers.push(fmTrav);
    scene.add(fmTrav);

    const fmRise = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 12, 10),
      new THREE.MeshStandardMaterial({
        color: 0xd4af37,
        emissive: 0xd4af37, emissiveIntensity: 0.9,
        transparent: true, opacity: 0.85,
      })
    );
    fmRise.position.set(riserX, underY, riserZ);
    fmRise.userData = {
      kind: 'vert',
      x: riserX, z: riserZ,
      startY: underY, endY: topInletY,
      speed: 0.012 + Math.random() * 0.005,
      progress: Math.random(),
    };
    flowMarkers.push(fmRise);
    scene.add(fmRise);
  }
}

/* ============================ BACKWASH HEADER ============================
 * Reference image: BACKWASH WATER labels on top of A, B, C.
 * A high overhead header runs above the top of the columns,
 * with vertical drops to each column's TOP inlet flange.
 * ============================================================================ */
function buildBackwashHeader() {
  const startX = -((CONFIG.columnCount - 1) * CONFIG.columnSpacing) / 2;
  const spacing = CONFIG.columnSpacing;
  const cone = CONFIG.coneHeight;
  const H = CONFIG.columnHeight;
  const R = CONFIG.columnRadius;
  const deckY = CONFIG.skidDeckY;

  const shellTopY = deckY + cone + H;
  const topInletY = shellTopY + R * 0.35 + 0.18;
  const headerY = topInletY + 1.3;  // header sits well above column tops

  const waterPipeMat = new THREE.MeshStandardMaterial({
    color: 0x6a85a8, roughness: 0.4, metalness: 0.7,
    emissive: 0x102030, emissiveIntensity: 0.10,
  });
  const flangeMat = new THREE.MeshStandardMaterial({
    color: 0x6a6d72, roughness: 0.4, metalness: 0.9,
  });
  const valveMat = new THREE.MeshStandardMaterial({
    color: 0x3a4e72, roughness: 0.55, metalness: 0.6,
  });

  // Main horizontal header above the columns
  const headerStart = startX - 1.6;
  const headerEnd = startX + (CONFIG.columnCount - 1) * spacing + 0.4;  // ends near D
  const headerLen = headerEnd - headerStart;

  const header = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.13, headerLen, 18),
    waterPipeMat
  );
  header.rotation.z = Math.PI / 2;
  header.position.set((headerStart + headerEnd) / 2, headerY, 0);
  header.castShadow = true;
  scene.add(header);

  // Header end caps
  for (const cx of [headerStart, headerEnd]) {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 14, 10),
      waterPipeMat
    );
    cap.position.set(cx, headerY, 0);
    scene.add(cap);
  }

  // Header supports — vertical columns down to skid deck
  const supportMat = new THREE.MeshStandardMaterial({
    color: 0x35383d, roughness: 0.7, metalness: 0.5,
  });
  for (let i = 0; i <= CONFIG.columnCount; i++) {
    const sx = headerStart + (i / CONFIG.columnCount) * headerLen;
    const supLen = headerY - shellTopY - 0.1;
    const sup = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, supLen, 0.06),
      supportMat
    );
    sup.position.set(sx, headerY - supLen / 2, -R * 0.9);
    scene.add(sup);

    // Strut from support to header
    const strut = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.06, R * 0.9),
      supportMat
    );
    strut.position.set(sx, headerY, -R * 0.45);
    scene.add(strut);
  }

  // Per-column drops + top inlet labels
  for (let i = 0; i < CONFIG.columnCount; i++) {
    const x = startX + i * spacing;

    // Tee at the header
    const tee = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 14, 10),
      waterPipeMat
    );
    tee.position.set(x, headerY, 0);
    scene.add(tee);

    // The LAST column (D) is the raffinate-OUT side in the ref, so we still drop
    // a backwash line to it but include the raffinate take-off afterwards.
    // Drop pipe from header down to top inlet
    const dropLen = headerY - topInletY;
    const drop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, dropLen, 14),
      waterPipeMat
    );
    drop.position.set(x, (headerY + topInletY) / 2, 0);
    scene.add(drop);

    // Mid-drop ball valve
    const av = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.22, 0.18),
      valveMat
    );
    av.position.set(x, topInletY + dropLen * 0.4, 0);
    scene.add(av);

    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.18, 8),
      new THREE.MeshStandardMaterial({ color: 0x9a9d9f, roughness: 0.3, metalness: 0.9 })
    );
    stem.position.set(x + 0.16, topInletY + dropLen * 0.4, 0);
    stem.rotation.z = Math.PI / 2;
    scene.add(stem);

    const hd = new THREE.Mesh(
      new THREE.TorusGeometry(0.08, 0.015, 6, 14),
      new THREE.MeshStandardMaterial({ color: 0x9bd8ff, roughness: 0.4, metalness: 0.5 })
    );
    hd.position.set(x + 0.27, topInletY + dropLen * 0.4, 0);
    hd.rotation.y = Math.PI / 2;
    scene.add(hd);

    // Flange where drop meets top inlet
    const fT = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.04, 18),
      flangeMat
    );
    fT.position.set(x, topInletY + 0.02, 0);
    scene.add(fT);

    // Top label "Backwash Water" for A,B,C (not D — D has raffinate out arrow in ref)
    if (i < CONFIG.columnCount - 1) {
      const lbl = makeBackwashLabel('Backwash Water');
      lbl.position.set(x, headerY + 0.65, 0);
      scene.add(lbl);
    }

    // Backwash water flow marker (going down drop into column)
    const fm = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 10, 8),
      new THREE.MeshStandardMaterial({
        color: 0x9bd8ff, emissive: 0x4e9bd8,
        emissiveIntensity: 0.85, transparent: true, opacity: 0.85,
      })
    );
    fm.position.set(x, headerY, 0);
    fm.userData = {
      baseX: x,
      headerY: headerY,
      topInletY: topInletY,
      progress: Math.random(),
      speed: 0.013 + Math.random() * 0.005,
    };
    backwashMarkers.push(fm);
    scene.add(fm);
  }

  // Backwash supply line coming in from the LEFT off-frame (continues header)
  const supplyLen = 2.4;
  const supply = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.13, supplyLen, 18),
    waterPipeMat
  );
  supply.rotation.z = Math.PI / 2;
  supply.position.set(headerStart - supplyLen / 2, headerY, 0);
  scene.add(supply);
}

/* ============================ PLS INLET ============================
 * Gold-loaded PLS arrives at the TOP-LEFT of column A from off-frame left.
 * The reference shows "PLS IN →" arrow entering at upper-mid height into A.
 * Path: long horizontal feed from -X side → drops into top inlet of A.
 * ============================================================================ */
function buildPlsInlet() {
  const startX = -((CONFIG.columnCount - 1) * CONFIG.columnSpacing) / 2;
  const cone = CONFIG.coneHeight;
  const H = CONFIG.columnHeight;
  const R = CONFIG.columnRadius;
  const deckY = CONFIG.skidDeckY;

  const colAx = startX;
  const shellTopY = deckY + cone + H;
  const topInletY = shellTopY + R * 0.35 + 0.18;

  const goldPipeMat = new THREE.MeshStandardMaterial({
    color: 0x8a6d2a, roughness: 0.45, metalness: 0.85,
    emissive: 0x2a1f08, emissiveIntensity: 0.20,
  });
  const flangeMat = new THREE.MeshStandardMaterial({
    color: 0x6a6d72, roughness: 0.4, metalness: 0.9,
  });

  // Reference shows PLS IN at MID-LEFT entering column A from the side near the top
  // We'll route it: from off-frame left at mid-upper height → up via elbow → into top inlet of A
  const feedStartX = colAx - 4.6;
  const feedEndX = colAx - R - 0.35;             // ends just outside A
  const feedY = shellTopY - 0.4;                  // mid-upper PLS arrival height

  // Long horizontal feed pipe
  const feedLen = feedEndX - feedStartX;
  const feedPipe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, feedLen, 20),
    goldPipeMat
  );
  feedPipe.rotation.z = Math.PI / 2;
  feedPipe.position.set((feedStartX + feedEndX) / 2, feedY, 0);
  feedPipe.castShadow = true;
  scene.add(feedPipe);

  // Elbow at end of horizontal — turn up
  addPipeJoint(feedEndX, feedY, 0, 0.16, goldPipeMat);

  // Vertical riser from feedY up to topInletY
  const riserH = topInletY - feedY;
  const riser = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, riserH, 20),
    goldPipeMat
  );
  riser.position.set(feedEndX, (feedY + topInletY) / 2, 0);
  scene.add(riser);

  // Top elbow toward column A
  addPipeJoint(feedEndX, topInletY, 0, 0.16, goldPipeMat);

  // Horizontal stub from elbow to top of column A
  const stubLen = colAx - feedEndX;
  const stub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, stubLen, 20),
    goldPipeMat
  );
  stub.rotation.z = Math.PI / 2;
  stub.position.set((feedEndX + colAx) / 2, topInletY, 0);
  scene.add(stub);

  // Flange at column A top inlet
  const flA = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.04, 18),
    flangeMat
  );
  flA.position.set(colAx, topInletY + 0.02, 0);
  scene.add(flA);

  // Inline strainer on horizontal
  const strainer = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.35, 0.4),
    new THREE.MeshStandardMaterial({
      color: 0x6a5a2a, roughness: 0.5, metalness: 0.75,
      emissive: 0x2a1f08, emissiveIntensity: 0.15,
    })
  );
  strainer.position.set(feedStartX + feedLen * 0.5, feedY, 0);
  scene.add(strainer);

  // Manual isolation valve near A
  const isoBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.42, 0.32),
    new THREE.MeshStandardMaterial({
      color: 0x5a3a1a, roughness: 0.6, metalness: 0.5,
    })
  );
  isoBody.position.set(feedStartX + feedLen * 0.85, feedY, 0);
  scene.add(isoBody);

  const isoHandle = new THREE.Mesh(
    new THREE.TorusGeometry(0.13, 0.022, 8, 18),
    new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.4, metalness: 0.7 })
  );
  isoHandle.position.set(feedStartX + feedLen * 0.85, feedY + 0.36, 0);
  isoHandle.rotation.x = Math.PI / 2;
  scene.add(isoHandle);

  // Feed-line support stand from skid deck up to pipe
  const standMat = new THREE.MeshStandardMaterial({
    color: 0x35383d, roughness: 0.7, metalness: 0.45,
  });
  for (let i = 0; i < 2; i++) {
    const sx = feedStartX + (i + 0.5) * (feedLen / 2);
    const standLen = feedY - deckY;
    const stand = new THREE.Mesh(
      new THREE.BoxGeometry(0.10, standLen, 0.20),
      standMat
    );
    stand.position.set(sx, deckY + standLen / 2, 0);
    stand.castShadow = true;
    scene.add(stand);
  }

  // PLS IN green-bg label (ref uses arrow + dark text)
  const plsLabel = makePlsLabel();
  plsLabel.position.set(feedStartX + 0.7, feedY + 0.55, 0);
  scene.add(plsLabel);

  // Animated flow markers (3 along the line)
  for (let m = 0; m < 3; m++) {
    const fm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.32, 14),
      new THREE.MeshStandardMaterial({
        color: 0xd4af37, emissive: 0xd4af37,
        emissiveIntensity: 0.9, transparent: true, opacity: 0.85,
      })
    );
    fm.rotation.z = Math.PI / 2;
    fm.position.set(feedStartX, feedY, 0);
    fm.userData = {
      startX: feedStartX, endX: feedEndX, y: feedY, z: 0,
      speed: 0.010 + Math.random() * 0.004,
      progress: (m / 3) + Math.random() * 0.05,
      kind: 'horiz',
    };
    inletFlowMarkers.push(fm);
    scene.add(fm);
  }
}

/* ============================ RAFFINATE LINE ============================
 * After column D, "Raffinate OUT" leaves from the TOP of D (matches ref)
 * via an overhead pipe going to the Raffinate tank (TK-201) on the right.
 * ============================================================================ */
function buildRaffinateLine() {
  const startX = -((CONFIG.columnCount - 1) * CONFIG.columnSpacing) / 2;
  const cone = CONFIG.coneHeight;
  const H = CONFIG.columnHeight;
  const R = CONFIG.columnRadius;
  const deckY = CONFIG.skidDeckY;

  const colDx = startX + (CONFIG.columnCount - 1) * CONFIG.columnSpacing;
  const shellTopY = deckY + cone + H;
  const topInletY = shellTopY + R * 0.35 + 0.18;

  const barrenMat = new THREE.MeshStandardMaterial({
    color: 0x4a5a72, roughness: 0.4, metalness: 0.85,
    emissive: 0x10182a, emissiveIntensity: 0.12,
  });
  const flangeMat = new THREE.MeshStandardMaterial({
    color: 0x6a6d72, roughness: 0.4, metalness: 0.9,
  });

  // The TOP of D already has a backwash drop connected. We branch the raffinate take-off
  // from D's top inlet horizontally toward the right (where the raffinate tank sits).
  const takeoffY = topInletY + 0.6;
  // Tee on D's top stub
  addPipeJoint(colDx, takeoffY, 0, 0.16, barrenMat);

  // Vertical short riser from topInletY to takeoffY at colDx
  const riser = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 0.6, 16),
    barrenMat
  );
  riser.position.set(colDx, topInletY + 0.3, 0);
  scene.add(riser);

  // Horizontal raffinate line going right to the tank (matches buildRaffinateTank)
  const tankX = colDx + 3.35;    // raffinate tank center
  const horizLen = tankX - colDx;
  const horiz = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, horizLen, 16),
    barrenMat
  );
  horiz.rotation.z = Math.PI / 2;
  horiz.position.set((colDx + tankX) / 2, takeoffY, 0);
  horiz.castShadow = true;
  scene.add(horiz);

  addPipeJoint(tankX, takeoffY, 0, 0.16, barrenMat);

  // Drop down into raffinate tank top (matches tankH=3.25 + deckY in buildRaffinateTank)
  const tankTopY = CONFIG.skidDeckY + 3.25;
  const dropLen = takeoffY - tankTopY;
  const drop = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, dropLen, 16),
    barrenMat
  );
  drop.position.set(tankX, (takeoffY + tankTopY) / 2, 0);
  scene.add(drop);

  // Flange where pipe enters tank
  const tankFlange = new THREE.Mesh(
    new THREE.CylinderGeometry(0.20, 0.20, 0.04, 16),
    flangeMat
  );
  tankFlange.position.set(tankX, tankTopY + 0.02, 0);
  scene.add(tankFlange);

  // Pipe support bracket
  const bracketMat = new THREE.MeshStandardMaterial({
    color: 0x35383d, roughness: 0.7, metalness: 0.5,
  });
  const bracket = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.6, 0.08),
    bracketMat
  );
  bracket.position.set(colDx + horizLen * 0.5, takeoffY + 0.4, 0);
  scene.add(bracket);

  // Animated flow markers
  for (let m = 0; m < 2; m++) {
    const fm = new THREE.Mesh(
      new THREE.SphereGeometry(0.10, 12, 10),
      new THREE.MeshStandardMaterial({
        color: 0x8aaad8, emissive: 0x4a6a98,
        emissiveIntensity: 0.85, transparent: true, opacity: 0.9,
      })
    );
    fm.position.set(colDx, takeoffY, 0);
    fm.userData = {
      kind: 'horiz',
      startX: colDx, endX: tankX, y: takeoffY, z: 0,
      speed: 0.011, progress: m * 0.5,
    };
    inletFlowMarkers.push(fm);
    scene.add(fm);
  }

  // Raffinate OUT arrow label
  const lbl = makeStencilLabel('Raffinate OUT →', {
    color: '#1a1a1a', size: 36, width: 512, height: 80,
  });
  lbl.scale.set(0.7, 0.7, 0.7);
  lbl.position.set(colDx + horizLen * 0.45, takeoffY + 0.7, 0);
  scene.add(lbl);
}

/* ============================ RAFFINATE TANK (TK-201) ============================ */
function buildRaffinateTank() {
  const startX = -((CONFIG.columnCount - 1) * CONFIG.columnSpacing) / 2;
  const colDx = startX + (CONFIG.columnCount - 1) * CONFIG.columnSpacing;
  const tankX = colDx + 3.35;
  const tankR = 1.15;
  const tankH = 3.25;          // taller per reference (TK-201 dominates the right side)
  const deckY = CONFIG.skidDeckY;

  const shellMat = new THREE.MeshStandardMaterial({
    color: 0xb6bcc4,           // a touch brighter / cooler — matches photographic ref
    roughness: 0.28, metalness: 0.93,
    envMapIntensity: 1.30,
  });

  // Shell
  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(tankR, tankR, tankH, 32, 1, true),
    shellMat
  );
  shell.position.set(tankX, deckY + tankH / 2, 0);
  shell.castShadow = true;
  shell.receiveShadow = true;
  scene.add(shell);

  // Top dome
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(tankR, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    shellMat
  );
  dome.position.set(tankX, deckY + tankH, 0);
  scene.add(dome);

  // Top flange
  const topFlange = new THREE.Mesh(
    new THREE.TorusGeometry(tankR + 0.04, 0.04, 10, 32),
    new THREE.MeshStandardMaterial({ color: 0x6a6d72, roughness: 0.4, metalness: 0.9 })
  );
  topFlange.position.set(tankX, deckY + tankH, 0);
  topFlange.rotation.x = Math.PI / 2;
  scene.add(topFlange);

  // Bottom flange ring (where it sits on the skid)
  const bottomFlange = new THREE.Mesh(
    new THREE.TorusGeometry(tankR + 0.04, 0.04, 10, 32),
    new THREE.MeshStandardMaterial({ color: 0x6a6d72, roughness: 0.4, metalness: 0.9 })
  );
  bottomFlange.position.set(tankX, deckY, 0);
  bottomFlange.rotation.x = Math.PI / 2;
  scene.add(bottomFlange);

  // Bottom plate (closes the cylinder)
  const bottomPlate = new THREE.Mesh(
    new THREE.CircleGeometry(tankR, 24),
    new THREE.MeshStandardMaterial({ color: 0x42454c, roughness: 0.7, metalness: 0.5 })
  );
  bottomPlate.position.set(tankX, deckY + 0.005, 0);
  bottomPlate.rotation.x = -Math.PI / 2;
  scene.add(bottomPlate);

  // Seam bands
  for (let s = 0; s < 2; s++) {
    const seam = new THREE.Mesh(
      new THREE.TorusGeometry(tankR + 0.005, 0.02, 6, 32),
      new THREE.MeshStandardMaterial({ color: 0x8a8d93, roughness: 0.35, metalness: 0.95 })
    );
    seam.position.set(tankX, deckY + tankH * (0.35 + s * 0.35), 0);
    seam.rotation.x = Math.PI / 2;
    scene.add(seam);
  }

  // Side label "Raffinate Tank / (TK-201)"
  const lbl = makeStencilLabel('Raffinate Tank\n(TK-201)', {
    color: '#f5f1e8', size: 32, width: 512, height: 128,
  });
  lbl.scale.set(0.9, 0.9, 0.9);
  lbl.position.set(tankX, deckY + tankH * 0.45, tankR + 0.02);
  scene.add(lbl);

  // Bottom outlet boss heading down through deck
  const outletBoss = new THREE.Mesh(
    new THREE.CylinderGeometry(0.10, 0.10, 0.20, 14),
    new THREE.MeshStandardMaterial({ color: 0x5a5d62, roughness: 0.5, metalness: 0.85 })
  );
  outletBoss.position.set(tankX, deckY - 0.10, tankR * 0.3);
  scene.add(outletBoss);

  // (Reference shows Raffinate Tank as a clean stainless tank — no green pump on this side.
  //  The green agitator belongs to TK-101, the blue centrifugal pumps live in front of TK-101.)
}

/* ============================ TK-101 (ET-101) TANK ============================
 * Open-top tank with a top-mounted mixer motor (green agitator) — leftmost piece
 * of equipment, matching the reference image's "TK Tank (TK-101) / ET-101".
 * ============================================================================ */
function buildTkTank() {
  const startX = -((CONFIG.columnCount - 1) * CONFIG.columnSpacing) / 2;
  const tankX = startX - 4.0;
  const tankR = 1.05;
  const tankH = 2.3;
  const deckY = CONFIG.skidDeckY;

  const shellMat = new THREE.MeshStandardMaterial({
    color: 0xb0b4ba, roughness: 0.30, metalness: 0.92, envMapIntensity: 1.25,
  });

  // Tank shell (open top)
  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(tankR, tankR, tankH, 32, 1, true),
    shellMat
  );
  shell.position.set(tankX, deckY + tankH / 2, 0);
  shell.castShadow = true;
  scene.add(shell);

  // Bottom plate
  const bottom = new THREE.Mesh(
    new THREE.CircleGeometry(tankR, 24),
    new THREE.MeshStandardMaterial({ color: 0x42454c, roughness: 0.7, metalness: 0.5 })
  );
  bottom.position.set(tankX, deckY + 0.005, 0);
  bottom.rotation.x = -Math.PI / 2;
  scene.add(bottom);

  // Top rim
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(tankR + 0.03, 0.04, 10, 32),
    new THREE.MeshStandardMaterial({ color: 0x6a6d72, roughness: 0.4, metalness: 0.9 })
  );
  rim.position.set(tankX, deckY + tankH, 0);
  rim.rotation.x = Math.PI / 2;
  scene.add(rim);

  // Bottom flange
  const bottomFlange = new THREE.Mesh(
    new THREE.TorusGeometry(tankR + 0.04, 0.04, 10, 32),
    new THREE.MeshStandardMaterial({ color: 0x6a6d72, roughness: 0.4, metalness: 0.9 })
  );
  bottomFlange.position.set(tankX, deckY, 0);
  bottomFlange.rotation.x = Math.PI / 2;
  scene.add(bottomFlange);

  // Liquid surface (bright blue per reference — water in an open mixing tank)
  const liquid = new THREE.Mesh(
    new THREE.CylinderGeometry(tankR - 0.02, tankR - 0.02, 0.08, 32),
    new THREE.MeshPhysicalMaterial({
      color: 0x3aa0e0,
      roughness: 0.18, metalness: 0.0,
      transmission: 0.30, thickness: 1.0,
      transparent: true, opacity: 0.95,
      clearcoat: 1.0, clearcoatRoughness: 0.06,
      emissive: 0x1a5a90,
      emissiveIntensity: 0.18,
    })
  );
  liquid.position.set(tankX, deckY + tankH * 0.78, 0);
  liquid.userData = { basePhase: 0, baseY: liquid.position.y };
  slurrySurfaces.push(liquid);
  scene.add(liquid);

  // Foamy highlight ring along the inner wall of the water surface
  const foam = new THREE.Mesh(
    new THREE.TorusGeometry(tankR - 0.08, 0.05, 8, 36),
    new THREE.MeshStandardMaterial({
      color: 0xeaf3fa, roughness: 0.55, metalness: 0.0,
      emissive: 0xb8d8f0, emissiveIntensity: 0.22,
      transparent: true, opacity: 0.85,
    })
  );
  foam.position.set(tankX, deckY + tankH * 0.78 + 0.03, 0);
  foam.rotation.x = Math.PI / 2;
  scene.add(foam);

  // Mixer bridge across the top
  const bridge = new THREE.Mesh(
    new THREE.BoxGeometry(tankR * 2.3, 0.12, 0.25),
    new THREE.MeshStandardMaterial({ color: 0x35383d, roughness: 0.65, metalness: 0.5 })
  );
  bridge.position.set(tankX, deckY + tankH + 0.10, 0);
  scene.add(bridge);

  // Mixer motor (cylindrical, bright industrial green — matches reference)
  const motorMat = new THREE.MeshStandardMaterial({
    color: 0x2f9a3a, roughness: 0.42, metalness: 0.55,
    emissive: 0x103a14, emissiveIntensity: 0.10,
  });
  const motor = new THREE.Mesh(
    new THREE.CylinderGeometry(0.30, 0.30, 0.85, 24),
    motorMat
  );
  motor.position.set(tankX, deckY + tankH + 0.75, 0);
  motor.castShadow = true;
  scene.add(motor);

  // Motor cooling fan housing (small ribbed cap on top)
  const motorCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.16, 20),
    motorMat
  );
  motorCap.position.set(tankX, deckY + tankH + 1.26, 0);
  scene.add(motorCap);

  // Motor cooling fins (vertical ribs around the cylinder)
  for (let f = 0; f < 10; f++) {
    const ang = (f / 10) * Math.PI * 2;
    const fin = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.62, 0.04),
      motorMat
    );
    fin.position.set(
      tankX + Math.cos(ang) * 0.32,
      deckY + tankH + 0.75,
      Math.sin(ang) * 0.32
    );
    scene.add(fin);
  }

  // Junction box on the side of the motor
  const jbox = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.16, 0.14),
    new THREE.MeshStandardMaterial({ color: 0x1f5a26, roughness: 0.55, metalness: 0.45 })
  );
  jbox.position.set(tankX + 0.34, deckY + tankH + 0.95, 0.16);
  scene.add(jbox);

  // Gearbox
  const gearbox = new THREE.Mesh(
    new THREE.BoxGeometry(0.40, 0.30, 0.40),
    new THREE.MeshStandardMaterial({ color: 0x2a5a2a, roughness: 0.5, metalness: 0.55 })
  );
  gearbox.position.set(tankX, deckY + tankH + 0.30, 0);
  scene.add(gearbox);

  // Mixer shaft (animated rotation)
  const shaftMat = new THREE.MeshStandardMaterial({
    color: 0x9a9d9f, roughness: 0.3, metalness: 0.9,
  });
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, tankH * 0.7, 12),
    shaftMat
  );
  shaft.position.set(tankX, deckY + tankH * 0.4, 0);
  scene.add(shaft);
  shaft.userData = { tankX };
  mixerShafts.push(shaft);

  // Mixer impellers (2 sets)
  for (let s = 0; s < 2; s++) {
    const impellerGroup = new THREE.Group();
    for (let b = 0; b < 4; b++) {
      const ang = (b / 4) * Math.PI * 2;
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.40, 0.04, 0.10),
        shaftMat
      );
      blade.position.set(Math.cos(ang) * 0.22, 0, Math.sin(ang) * 0.22);
      blade.rotation.y = ang;
      impellerGroup.add(blade);
    }
    impellerGroup.position.set(tankX, deckY + tankH * (0.2 + s * 0.35), 0);
    impellerGroup.userData = { isImpeller: true };
    scene.add(impellerGroup);
    mixerShafts.push(impellerGroup);
  }

  // Side label
  const lbl = makeStencilLabel('TK Tank\n(TK-101)', {
    color: '#f5f1e8', size: 32, width: 512, height: 128,
  });
  lbl.scale.set(0.9, 0.9, 0.9);
  lbl.position.set(tankX, deckY + tankH * 0.50, tankR + 0.02);
  scene.add(lbl);

  // ET-101 sticker at the bottom front
  const stickLbl = makeStencilLabel('ET-101', {
    color: '#1a1a1a', size: 28, width: 256, height: 64,
  });
  stickLbl.scale.set(0.55, 0.55, 0.55);
  stickLbl.position.set(tankX, deckY + 0.18, tankR + 0.02);
  scene.add(stickLbl);
}

/* ============================ PUMP SKID ============================
 * Two pumps in front of TK-101 (matches reference) — feed PLS forward.
 * ============================================================================ */
function buildPumpSkid() {
  const startX = -((CONFIG.columnCount - 1) * CONFIG.columnSpacing) / 2;
  // Pumps sit on the GROUND between TK-101 and the column skid in the reference.
  // Move them down off the deck (ground level) and tuck them toward the front.
  const baseX = startX - 3.0;
  const baseZ = 2.05;
  const deckY = 0.04;          // ground-floor mounting, not on the elevated deck

  for (let i = 0; i < 2; i++) {
    const px = baseX + (i - 0.5) * 1.1;

    // Pump baseplate
    const basePlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.10, 0.55),
      new THREE.MeshStandardMaterial({ color: 0x35383d, roughness: 0.7, metalness: 0.5 })
    );
    basePlate.position.set(px, deckY + 0.05, baseZ);
    basePlate.castShadow = true;
    scene.add(basePlate);

    // Motor (royal-blue industrial pump motor — matches reference's centrifugal pumps)
    const motorMat = new THREE.MeshStandardMaterial({
      color: 0x1d4ed8, roughness: 0.45, metalness: 0.55,
      emissive: 0x0a1f5e, emissiveIntensity: 0.08,
    });
    const motor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.62, 22),
      motorMat
    );
    motor.rotation.z = Math.PI / 2;
    motor.position.set(px - 0.18, deckY + 0.40, baseZ);
    motor.castShadow = true;
    scene.add(motor);

    // Cooling fins (vertical ribs around motor like a TEFC enclosure)
    for (let f = 0; f < 10; f++) {
      const ang = (f / 10) * Math.PI * 2;
      const fin = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.028, 0.04),
        new THREE.MeshStandardMaterial({
          color: 0x1538a8, roughness: 0.55, metalness: 0.5,
        })
      );
      fin.position.set(
        px - 0.18,
        deckY + 0.40 + Math.sin(ang) * 0.235,
        baseZ + Math.cos(ang) * 0.235
      );
      fin.rotation.x = ang;
      scene.add(fin);
    }

    // Motor cooling fan housing (dark) at the back of the motor
    const fanHouse = new THREE.Mesh(
      new THREE.CylinderGeometry(0.20, 0.20, 0.14, 16),
      new THREE.MeshStandardMaterial({ color: 0x141926, roughness: 0.7, metalness: 0.3 })
    );
    fanHouse.rotation.z = Math.PI / 2;
    fanHouse.position.set(px - 0.55, deckY + 0.40, baseZ);
    scene.add(fanHouse);

    // Pump volute (polished stainless cylindrical body)
    const voluteMat = new THREE.MeshStandardMaterial({
      color: 0xb8bcc2, roughness: 0.25, metalness: 0.92,
    });
    const volute = new THREE.Mesh(
      new THREE.CylinderGeometry(0.21, 0.21, 0.30, 22),
      voluteMat
    );
    volute.rotation.z = Math.PI / 2;
    volute.position.set(px + 0.22, deckY + 0.40, baseZ);
    scene.add(volute);

    // Coupling between motor and volute
    const coupling = new THREE.Mesh(
      new THREE.CylinderGeometry(0.10, 0.10, 0.14, 14),
      voluteMat
    );
    coupling.rotation.z = Math.PI / 2;
    coupling.position.set(px + 0.04, deckY + 0.40, baseZ);
    scene.add(coupling);

    // Suction pipe (horizontal stub heading back toward TK-101)
    const suction = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.7, 14),
      voluteMat
    );
    suction.rotation.x = Math.PI / 2;
    suction.position.set(px + 0.34, deckY + 0.40, baseZ - 0.35);
    scene.add(suction);

    // Discharge elbow + vertical riser
    const dischElbow = new THREE.Mesh(
      new THREE.TorusGeometry(0.10, 0.07, 10, 18, Math.PI / 2),
      voluteMat
    );
    dischElbow.position.set(px + 0.34, deckY + 0.65, baseZ);
    dischElbow.rotation.y = Math.PI / 2;
    scene.add(dischElbow);

    const disch = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 0.6, 14),
      voluteMat
    );
    disch.position.set(px + 0.34, deckY + 0.95, baseZ);
    scene.add(disch);
  }

  // ---- COMMON SUCTION HEADER from TK-101 side outlet → both pumps ----
  // The reference shows the pumps drawing from the mixing tank; without this
  // line the pumps look like they're sitting in mid-air with no source.
  const stainlessMat = new THREE.MeshStandardMaterial({
    color: 0xb8bcc2, roughness: 0.25, metalness: 0.92,
  });
  const flangeMat = new THREE.MeshStandardMaterial({
    color: 0x6a6d72, roughness: 0.4, metalness: 0.9,
  });

  const tkRightWallX = (startX - 4.0) + 1.05;   // TK-101 tankX + tankR
  const sucZ = baseZ - 0.35;                      // pumps' suction-stub Z
  const sucY = deckY + 0.40;                      // pumps' suction-stub Y

  // 1) Side nozzle on TK-101 wall (short horizontal stub)
  const tkNozzle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.10, 0.10, 0.25, 16),
    stainlessMat
  );
  tkNozzle.rotation.z = Math.PI / 2;
  tkNozzle.position.set(tkRightWallX + 0.10, sucY, 0);
  scene.add(tkNozzle);

  const tkNozzleFlange = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, 0.04, 16),
    flangeMat
  );
  tkNozzleFlange.rotation.z = Math.PI / 2;
  tkNozzleFlange.position.set(tkRightWallX + 0.24, sucY, 0);
  scene.add(tkNozzleFlange);

  // 2) Forward jog from z=0 (tank center plane) to z=sucZ (pump suction plane)
  const fwdLen = sucZ;
  const fwdJog = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, fwdLen, 16),
    stainlessMat
  );
  fwdJog.rotation.x = Math.PI / 2;
  fwdJog.position.set(tkRightWallX + 0.30, sucY, sucZ / 2);
  scene.add(fwdJog);

  // 3) Horizontal header running across both pumps along z=sucZ
  const headerStartX = tkRightWallX + 0.30;
  const headerEndX = baseX + 0.5 * 1.1 + 0.34;      // beyond the right pump's stub
  const headerLen = headerEndX - headerStartX;
  const sucHeader = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, headerLen, 16),
    stainlessMat
  );
  sucHeader.rotation.z = Math.PI / 2;
  sucHeader.position.set((headerStartX + headerEndX) / 2, sucY, sucZ);
  sucHeader.castShadow = true;
  scene.add(sucHeader);

  // Tee fittings where each pump's suction stub joins the header
  for (let i = 0; i < 2; i++) {
    const px = baseX + (i - 0.5) * 1.1;
    const tee = new THREE.Mesh(
      new THREE.SphereGeometry(0.10, 12, 10),
      flangeMat
    );
    tee.position.set(px + 0.34, sucY, sucZ);
    scene.add(tee);
  }
}

/* ============================ FRONT SKID LABELS ============================
 * Reference shows white labels along the front edge of the skid:
 * "Pre", "Drain", "Bypas", "Brinat"
 * ============================================================================ */
function buildFrontSkidLabels() {
  const colsWidth = (CONFIG.columnCount - 1) * CONFIG.columnSpacing;
  const deckY = CONFIG.skidDeckY;
  // Reference: 4 painted-and-flagged process lines run the length of the skid
  // (red / orange / green / blue), each tagged with a maroon stencil
  // (Pre / Drain / Bypas / Brinat). Replace flat stickers with real piping.
  const PROC = [
    { name: 'Pre',    pipe: 0xb91c1c, label: '#9a1d20' },
    { name: 'Drain',  pipe: 0xea580c, label: '#9a1d20' },
    { name: 'Bypas',  pipe: 0x16a34a, label: '#9a1d20' },
    { name: 'Brinat', pipe: 0x2563eb, label: '#9a1d20' },
  ];

  const startX = -colsWidth / 2 - 0.8;
  const endX = colsWidth / 2 + 0.8;
  const totalLen = endX - startX;
  const frontZ = 2.93;

  // 4 horizontal painted pipes stacked vertically just under the deck overhang
  for (let i = 0; i < PROC.length; i++) {
    const proc = PROC[i];
    const py = deckY - 0.10 - i * 0.13;  // stacked from top to bottom

    // Painted process pipe (real cylinder, not a sticker)
    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, totalLen, 18),
      new THREE.MeshStandardMaterial({
        color: proc.pipe, roughness: 0.45, metalness: 0.3,
      })
    );
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set((startX + endX) / 2, py, frontZ);
    pipe.castShadow = true;
    scene.add(pipe);

    // End-cap flanges
    for (const ex of [startX, endX]) {
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 0.04, 14),
        new THREE.MeshStandardMaterial({
          color: 0x6a6d72, roughness: 0.4, metalness: 0.9,
        })
      );
      cap.rotation.z = Math.PI / 2;
      cap.position.set(ex, py, frontZ);
      scene.add(cap);
    }

    // Painted ID tag on the pipe — bigger so it reads at default camera distance
    const tagX = startX + (i * 2 + 1) * (totalLen / (PROC.length * 2));
    const tag = makeStencilLabel(proc.name.toUpperCase(), {
      color: '#ffffff', size: 84, width: 384, height: 128,
    });
    tag.scale.set(0.85, 0.85, 0.85);
    tag.position.set(tagX, py, frontZ + 0.062);
    scene.add(tag);
  }
}

/* ============================ HEADER WALKWAY ============================
 * Yellow walkway on the RIGHT side (near raffinate tank) with stairs.
 * Matches reference image's right-hand walkway layout.
 * ============================================================================ */
function buildHeaderWalkway() {
  const startX = -((CONFIG.columnCount - 1) * CONFIG.columnSpacing) / 2;
  const colDx = startX + (CONFIG.columnCount - 1) * CONFIG.columnSpacing;
  const cone = CONFIG.coneHeight;
  const H = CONFIG.columnHeight;
  const R = CONFIG.columnRadius;
  const deckY = CONFIG.skidDeckY;

  // Walking platform sits between column D and raffinate tank, at mid-column height
  const platformY = deckY + cone + H * 0.5;
  const platformX = colDx + 1.8;     // right side of column D, before raffinate tank
  const platformWidth = 2.2;
  const platformDepth = 1.6;

  const platMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37, roughness: 0.5, metalness: 0.55,
    emissive: 0xd4af37, emissiveIntensity: 0.06,
  });
  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(platformWidth, 0.08, platformDepth),
    platMat
  );
  platform.position.set(platformX, platformY, R + 0.7);
  platform.castShadow = true;
  platform.receiveShadow = true;
  scene.add(platform);

  // Grating stripes
  const grateMat = new THREE.MeshStandardMaterial({
    color: 0x8a6d1a, roughness: 0.7, metalness: 0.5,
  });
  const numStripes = Math.floor(platformWidth * 6);
  for (let i = 0; i < numStripes; i++) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.02, platformDepth - 0.1),
      grateMat
    );
    stripe.position.set(
      platformX - platformWidth / 2 + i * (platformWidth / (numStripes - 1)),
      platformY + 0.06,
      R + 0.7
    );
    scene.add(stripe);
  }

  // Railings
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
    const zRail = (R + 0.7) + side * (platformDepth / 2);
    if (side < 0) continue;   // skip back side (faces columns)

    const topRail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, platformWidth, 8),
      railMat
    );
    topRail.rotation.z = Math.PI / 2;
    topRail.position.set(platformX, platformY + 1.05, zRail);
    scene.add(topRail);

    const midRail = topRail.clone();
    midRail.position.y = platformY + 0.55;
    scene.add(midRail);

    const kickPlate = new THREE.Mesh(
      new THREE.BoxGeometry(platformWidth, 0.16, 0.03),
      kickPlateMat
    );
    kickPlate.position.set(platformX, platformY + 0.14, zRail);
    scene.add(kickPlate);

    const stripeRow = new THREE.Mesh(
      new THREE.BoxGeometry(platformWidth, 0.04, 0.04),
      kickStripeMat
    );
    stripeRow.position.set(platformX, platformY + 0.20, zRail);
    scene.add(stripeRow);

    // Posts
    for (let p = 0; p < 4; p++) {
      const px = platformX - platformWidth / 2 + p * (platformWidth / 3);
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 1.05, 8),
        railMat
      );
      post.position.set(px, platformY + 0.55, zRail);
      scene.add(post);
    }
  }

  // Side supports under walkway
  const supportMat = new THREE.MeshStandardMaterial({
    color: 0x35383d, roughness: 0.65, metalness: 0.5,
  });
  for (let xS = -1; xS <= 1; xS += 2) {
    const supLen = platformY - deckY;
    const sup = new THREE.Mesh(
      new THREE.BoxGeometry(0.10, supLen, 0.10),
      supportMat
    );
    sup.position.set(platformX + xS * (platformWidth / 2 - 0.1), deckY + supLen / 2, R + 0.7);
    sup.castShadow = true;
    scene.add(sup);
  }

  // Side stair coming from the FRONT of the platform down to the skid deck
  buildSideStair(platformX, platformY, R + 0.7, deckY);
}

function buildSideStair(stairTopX, platformY, stairZ, deckY) {
  const stairFrameMat = new THREE.MeshStandardMaterial({
    color: 0x35383d, roughness: 0.65, metalness: 0.5,
  });
  const stepMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37, roughness: 0.55, metalness: 0.55,
  });
  const railMat = new THREE.MeshStandardMaterial({
    color: 0xf5d76e, roughness: 0.45, metalness: 0.6,
  });

  const numSteps = 6;
  const stepRise = (platformY - deckY) / numSteps;
  const stepRun = 0.28;
  // Stairs face +Z direction (toward camera) descending from platform
  const stairBottomZ = stairZ + numSteps * stepRun + 0.25;

  for (let i = 0; i < numSteps; i++) {
    const stepZ = stairBottomZ - (i + 0.5) * stepRun;
    const stepY = deckY + (i + 0.5) * stepRise;
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.06, stepRun + 0.03),
      stepMat
    );
    step.position.set(stairTopX, stepY, stepZ);
    step.castShadow = true;
    scene.add(step);
  }

  // Stringers
  const stringerLength = Math.hypot(numSteps * stepRise, numSteps * stepRun);
  const stringerAngle = Math.atan2(numSteps * stepRise, numSteps * stepRun);
  for (let side = -1; side <= 1; side += 2) {
    const stringer = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.32, stringerLength),
      stairFrameMat
    );
    stringer.position.set(
      stairTopX + side * 0.5,
      deckY + (numSteps * stepRise) / 2,
      stairZ + (numSteps * stepRun) / 2 + 0.12
    );
    stringer.rotation.x = -stringerAngle;
    stringer.castShadow = true;
    scene.add(stringer);

    const handRail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, stringerLength + 0.4, 8),
      railMat
    );
    handRail.position.set(
      stairTopX + side * 0.5,
      deckY + (numSteps * stepRise) / 2 + 1.0,
      stairZ + (numSteps * stepRun) / 2 + 0.12
    );
    handRail.rotation.x = Math.PI / 2 - stringerAngle;
    scene.add(handRail);
  }
}

/* ============================ ACCESS LADDERS ============================
 * Only on column D (right side) — provides access to the dome manhole.
 * ============================================================================ */
function buildAccessLadders() {
  // The reference image does not show a tall vertical access ladder between
  // column D and the Raffinate Tank; that area is reserved for the handrailed
  // walkway. Keeping a ladder there blocks the Raffinate Tank from camera.
  // Walkway access stairs are built in buildHeaderWalkway().
}

function buildLadder(height) {
  const group = new THREE.Group();
  const railMat = new THREE.MeshStandardMaterial({
    color: 0xf5d76e, roughness: 0.45, metalness: 0.65,
  });
  const railGeom = new THREE.CylinderGeometry(0.03, 0.03, height, 8);
  const r1 = new THREE.Mesh(railGeom, railMat);
  r1.position.set(0, height / 2, 0.18);
  group.add(r1);
  const r2 = new THREE.Mesh(railGeom, railMat);
  r2.position.set(0, height / 2, -0.18);
  group.add(r2);

  const rungGeom = new THREE.CylinderGeometry(0.018, 0.018, 0.42, 8);
  const rungs = Math.floor(height / 0.32);
  for (let i = 0; i < rungs; i++) {
    const rung = new THREE.Mesh(rungGeom, railMat);
    rung.position.y = 0.25 + i * 0.32;
    rung.rotation.x = Math.PI / 2;
    group.add(rung);
  }

  // Safety cage hoops
  const hoopMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37, roughness: 0.5, metalness: 0.6,
  });
  for (let i = 0; i < Math.floor(height / 1.0); i++) {
    const hoop = new THREE.Mesh(
      new THREE.TorusGeometry(0.26, 0.018, 6, 24, Math.PI * 1.2),
      hoopMat
    );
    hoop.position.y = 0.7 + i * 1.0;
    hoop.rotation.y = Math.PI / 2;
    hoop.rotation.z = Math.PI;
    group.add(hoop);
  }

  return group;
}

/* ============================ OVERHEAD LABEL ============================ */
function buildOverheadLabel() {
  const cone = CONFIG.coneHeight;
  const H = CONFIG.columnHeight;
  const R = CONFIG.columnRadius;
  const deckY = CONFIG.skidDeckY;

  const headerY = deckY + cone + H + R * 0.35 + 0.18 + 1.3 + 1.4;

  // Dark stencil over cream backdrop reads much better than gold-on-cream
  const title = makeStencilLabel('KARBON ADSORPSİYON', {
    color: '#1a2030', size: 96, monospace: false, width: 1280, height: 192,
  });
  title.scale.set(2.2, 2.2, 2.2);
  title.position.set(0, headerY, 0);
  scene.add(title);

  const subtitle = makeStencilLabel('C-201 A / B / C / D', {
    color: '#4a5266', size: 56, monospace: true, width: 1024, height: 128,
  });
  subtitle.scale.set(1.4, 1.4, 1.4);
  subtitle.position.set(0, headerY - 0.95, 0);
  scene.add(subtitle);
}

/* ============================ HELPERS ============================ */

/* Helper: place a spherical joint at a pipe corner. */
function addPipeJoint(x, y, z, radius, material) {
  const joint = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.20, 14, 10),
    material
  );
  joint.position.set(x, y, z);
  joint.castShadow = true;
  scene.add(joint);
  return joint;
}

/* Stencil label using canvas texture — Turkish-friendly. Supports \n */
function makeStencilLabel(text, opts = {}) {
  const o = Object.assign({
    color: '#f5d76e',
    size: 56,
    monospace: false,
    width: 512,
    height: 96,
  }, opts);

  const lc = document.createElement('canvas');
  lc.width = o.width;
  lc.height = o.height;
  const ctx = lc.getContext('2d');

  ctx.fillStyle = o.color;
  const font = o.monospace ? '"Courier New", monospace' : 'Inter, sans-serif';
  ctx.font = `bold ${o.size}px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;

  const lines = String(text).split('\n');
  const lineHeight = o.size * 1.05;
  const totalH = lines.length * lineHeight;
  const startY = (o.height - totalH) / 2 + lineHeight / 2;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], o.width / 2, startY + i * lineHeight);
  }

  const tex = new THREE.CanvasTexture(lc);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;

  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true,
  });
  const w = 2.6;
  const h = w * (o.height / o.width);
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}

/* Column header label "C-201X" with a dark navy plate background (matches ref) */
function makeColumnHeaderLabel(text) {
  const w = 512, h = 160;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');

  // Dark navy background plate
  ctx.fillStyle = '#1f3a5f';
  const radius = 16;
  ctx.beginPath();
  ctx.moveTo(radius, 4);
  ctx.lineTo(w - radius, 4);
  ctx.quadraticCurveTo(w - 4, 4, w - 4, radius);
  ctx.lineTo(w - 4, h - radius);
  ctx.quadraticCurveTo(w - 4, h - 4, w - radius, h - 4);
  ctx.lineTo(radius, h - 4);
  ctx.quadraticCurveTo(4, h - 4, 4, h - radius);
  ctx.lineTo(4, radius);
  ctx.quadraticCurveTo(4, 4, radius, 4);
  ctx.fill();

  // Inner border line
  ctx.strokeStyle = '#f5f1e8';
  ctx.lineWidth = 3;
  ctx.strokeRect(14, 14, w - 28, h - 28);

  // Text
  ctx.fillStyle = '#f5f1e8';
  ctx.font = 'bold 88px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;

  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
  const pw = 1.4;
  const ph = pw * (h / w);
  return new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), mat);
}

/* "Backwash Water" overhead label — crisp dark text with a subtle off-white
 * backing plate, mirroring the catalog-style annotation in the reference. */
function makeBackwashLabel(text) {
  const w = 768, h = 160;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');

  // Soft cream backing plate
  ctx.fillStyle = 'rgba(248, 244, 232, 0.94)';
  const pad = 22;
  const radius = 18;
  ctx.beginPath();
  ctx.moveTo(pad + radius, pad);
  ctx.lineTo(w - pad - radius, pad);
  ctx.quadraticCurveTo(w - pad, pad, w - pad, pad + radius);
  ctx.lineTo(w - pad, h - pad - radius);
  ctx.quadraticCurveTo(w - pad, h - pad, w - pad - radius, h - pad);
  ctx.lineTo(pad + radius, h - pad);
  ctx.quadraticCurveTo(pad, h - pad, pad, h - pad - radius);
  ctx.lineTo(pad, pad + radius);
  ctx.quadraticCurveTo(pad, pad, pad + radius, pad);
  ctx.fill();

  // Down-arrow inside the plate so the reader sees direction of flow
  ctx.fillStyle = '#1d4ed8';
  ctx.beginPath();
  ctx.moveTo(w / 2 - 40, h - 50);
  ctx.lineTo(w / 2 + 40, h - 50);
  ctx.lineTo(w / 2, h - 16);
  ctx.closePath();
  ctx.fill();

  // Dark text
  ctx.fillStyle = '#1a1410';
  ctx.font = 'bold 64px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 - 12);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;

  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
  const pw = 1.85;                        // narrower than column spacing (3.0) so no overlap
  const ph = pw * (h / w);
  return new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), mat);
}

/* PLS IN label with green arrow background (matches reference exactly) */
function makePlsLabel() {
  const w = 384, h = 96;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');

  // Green arrow background
  ctx.fillStyle = '#3e8b3e';
  ctx.beginPath();
  ctx.moveTo(8, 24);
  ctx.lineTo(w - 60, 24);
  ctx.lineTo(w - 60, 12);
  ctx.lineTo(w - 8, 48);
  ctx.lineTo(w - 60, 84);
  ctx.lineTo(w - 60, 72);
  ctx.lineTo(8, 72);
  ctx.closePath();
  ctx.fill();

  // Text
  ctx.fillStyle = '#f5f1e8';
  ctx.font = 'bold 42px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PLS IN', (w - 60) / 2, h / 2);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;

  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
  const pw = 2.0;
  const ph = pw * (h / w);
  return new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), mat);
}

/* Pressure gauge face printing (canvas) */
function makeGaugeFaceTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#f5f1e8';
  ctx.beginPath();
  ctx.arc(128, 128, 120, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#1a1410';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.lineWidth = 3;
  ctx.strokeStyle = '#1a1410';
  for (let i = 0; i <= 12; i++) {
    const ang = Math.PI * 0.75 + (i / 12) * Math.PI * 1.5;
    const rIn = i % 3 === 0 ? 86 : 96;
    const rOut = 108;
    ctx.beginPath();
    ctx.moveTo(128 + Math.cos(ang) * rIn, 128 + Math.sin(ang) * rIn);
    ctx.lineTo(128 + Math.cos(ang) * rOut, 128 + Math.sin(ang) * rOut);
    ctx.stroke();
  }

  ctx.fillStyle = '#1a1410';
  ctx.font = 'bold 22px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const labels = ['0', '2', '4', '6', '8'];
  for (let i = 0; i < labels.length; i++) {
    const ang = Math.PI * 0.75 + (i / 4) * Math.PI * 1.5;
    ctx.fillText(labels[i], 128 + Math.cos(ang) * 70, 128 + Math.sin(ang) * 70);
  }

  ctx.fillStyle = '#1a1410';
  ctx.beginPath();
  ctx.arc(128, 128, 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = '16px Inter, sans-serif';
  ctx.fillStyle = '#5a5d62';
  ctx.fillText('bar', 128, 168);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ============================ ATMOSPHERIC GLOW ============================ */
function buildAtmosphericGlow() {
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xd4af37,
    transparent: true,
    opacity: 0.022,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 24),
    glowMat
  );
  glow.position.y = 0.05;
  glow.rotation.x = -Math.PI / 2;
  scene.add(glow);
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

  // Animate interstage flow markers
  for (const fm of flowMarkers) {
    fm.userData.progress += fm.userData.speed;
    if (fm.userData.progress > 1) fm.userData.progress = 0;
    const p = fm.userData.progress;
    if (fm.userData.kind === 'horiz') {
      fm.position.x = fm.userData.startX + (fm.userData.endX - fm.userData.startX) * p;
      fm.position.y = fm.userData.y;
      fm.position.z = fm.userData.z;
    } else if (fm.userData.kind === 'vert') {
      fm.position.x = fm.userData.x;
      fm.position.z = fm.userData.z;
      fm.position.y = fm.userData.startY + (fm.userData.endY - fm.userData.startY) * p;
    }
    fm.material.emissiveIntensity = 0.6 + Math.sin(t * 5 + p * 10) * 0.3;
  }

  // Animate PLS inlet markers + raffinate markers (same shape)
  for (const fm of inletFlowMarkers) {
    fm.userData.progress += fm.userData.speed;
    if (fm.userData.progress > 1) fm.userData.progress = 0;
    const p = fm.userData.progress;
    fm.position.x = fm.userData.startX + (fm.userData.endX - fm.userData.startX) * p;
    if (fm.userData.y !== undefined) fm.position.y = fm.userData.y;
    if (fm.userData.z !== undefined) fm.position.z = fm.userData.z;
    fm.material.emissiveIntensity = 0.7 + Math.sin(t * 6 + p * 8) * 0.25;
  }

  // Animate backwash water markers — header → drop into column top
  for (const fm of backwashMarkers) {
    fm.userData.progress += fm.userData.speed;
    if (fm.userData.progress > 1) fm.userData.progress = 0;
    const p = fm.userData.progress;
    fm.position.x = fm.userData.baseX;
    fm.position.z = 0;
    // travel from headerY DOWN to topInletY
    fm.position.y = fm.userData.headerY + (fm.userData.topInletY - fm.userData.headerY) * p;
    fm.material.emissiveIntensity = 0.5 + Math.sin(t * 4 + p * 6) * 0.3;
  }

  // Animate carbon-particle wobble
  for (const g of carbonParticles) {
    g.userData.basePhase += 0.07;
    g.position.y = g.userData.baseY + Math.sin(g.userData.basePhase) * 0.06;
    g.scale.setScalar(g.userData.baseScale * (0.85 + Math.sin(g.userData.basePhase * 1.7) * 0.18));
  }

  // Slurry surface wobble
  for (const s of slurrySurfaces) {
    if (s.userData && s.userData.baseY !== undefined) {
      s.position.y = s.userData.baseY + Math.sin(t * 1.4 + (s.userData.basePhase || 0)) * 0.02;
    }
  }

  // Mixer shaft rotation
  for (const m of mixerShafts) {
    m.rotation.y += 0.06;
  }

  // Pressure gauge needle wobble
  for (const needle of pressureGauges) {
    const base = needle.userData.baseAngle;
    const wobble = Math.sin(t * 2.3 + needle.userData.wobblePhase) * 0.06
                + Math.sin(t * 5.1 + needle.userData.wobblePhase * 2) * 0.015;
    needle.rotation.x = base + wobble;
  }

  // Idle auto-rotate
  if (autoRotateEnabled && (Date.now() - lastUserInteraction) > 5000) {
    const radius = Math.hypot(camera.position.x, camera.position.z);
    const angle = Math.atan2(camera.position.z, camera.position.x) + 0.0014;
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
    // Slayt 8 atlasında küçük canvas'a mount edilmiş olabilir;
    // büyük equipment canvas'ına geçişi mount() pattern'iyle güvenli yap.
    const targetCanvas = document.getElementById('three-canvas-carbon-ads');
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

// Eager-start fallback for the test page
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
  flowMarkers.length = 0;
  carbonParticles.length = 0;
  pressureGauges.length = 0;
  slurrySurfaces.length = 0;
  inletFlowMarkers.length = 0;
  backwashMarkers.length = 0;
  mixerShafts.length = 0;
  renderer = null;
  scene = null;
  camera = null;
  controls = null;
  canvas = null;
  initialized = false;
}

window.threeCarbonAds = {
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
