import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import GUI from 'lil-gui'

// ══════════════════════════════════════════════
//  Scene
// ══════════════════════════════════════════════
const canvas = document.getElementById('c') as HTMLCanvasElement
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setClearColor(0x1a1a2e)
renderer.shadowMap.enabled = true
renderer.toneMapping = THREE.ACESFilmicToneMapping

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100)
camera.position.set(0, 3, 6)

const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true
controls.target.set(0, 2.5, 0)

const sun = new THREE.DirectionalLight(0xfff5e0, 2.5)
sun.position.set(3, 8, 4)
sun.castShadow = true
scene.add(sun)
scene.add(new THREE.HemisphereLight(0x87ceeb, 0x362907, 0.5))

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(30, 30),
  new THREE.MeshStandardMaterial({ color: 0x2a4a1a, roughness: 0.9 })
)
floor.rotation.x = -Math.PI / 2
floor.receiveShadow = true
scene.add(floor)

// ══════════════════════════════════════════════
//  Helpers
// ══════════════════════════════════════════════
function seeded01(seed: number): number {
  const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return n - Math.floor(n)
}

// ══════════════════════════════════════════════
//  Parameters
// ══════════════════════════════════════════════
const params = {
  seed: 42,

  // Trunk (below fork)
  trunkHeight: 3.5,
  trunkThickness: 0.12,
  trunkTaper: 0.2,
  trunkBend: 0.14,
  trunkGrooveDepth: 0.03,
  trunkGrooveFreq: 12,
  rootFlare: 0.07,

  // Fork
  forkHeight: 0.55,
  forkCount: 2,
  forkSpreadAngle: 41,
  forkAsymmetry: 0.15,

  // Trunk continuation (after fork)
  trunkAfterForkBend: 0.15,

  // Fork branches
  forkBranchLength: 1.7,
  forkBranchThickness: 1.0,
  forkBranchTaper: 0.3,
  forkBranchDroop: 0.065,
  forkBranchBend: 0.3,

  // Visualization
  showWireframe: false,
  showForkPoint: true,
}

// ══════════════════════════════════════════════
//  Bark material
// ══════════════════════════════════════════════
function generateBarkNormalMap(): THREE.CanvasTexture {
  const w = 256, h = 256
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(w, h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w
      const groove = Math.sin(u * Math.PI * 16) * 0.5
      const nx = Math.sin(x * 0.1 + y * 0.07) * Math.cos(x * 0.13 + y * 0.11) * 0.3
      const hC = groove + nx
      const hR = Math.sin((u + 1 / w) * Math.PI * 16) * 0.5 + Math.sin((x + 1) * 0.1 + y * 0.07) * Math.cos((x + 1) * 0.13 + y * 0.11) * 0.3
      const hU = Math.sin(u * Math.PI * 16) * 0.5 + Math.sin(x * 0.1 + (y + 1) * 0.07) * Math.cos(x * 0.13 + (y + 1) * 0.11) * 0.3
      const dx = (hC - hR) * 3, dy = (hC - hU) * 3
      const i = (y * w + x) * 4
      img.data[i] = Math.floor((dx * 0.5 + 0.5) * 255)
      img.data[i + 1] = Math.floor((dy * 0.5 + 0.5) * 255)
      img.data[i + 2] = 255; img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping
  return tex
}

const barkNormalMap = generateBarkNormalMap()
function createBarkMaterial(): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x8b6b4a, roughness: 0.95, metalness: 0,
    normalMap: barkNormalMap, normalScale: new THREE.Vector2(1.5, 1.5),
  })
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>',
      `#include <common>\nvarying vec2 vBarkUv;\nvarying vec3 vLocalPos;`)
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
      `#include <begin_vertex>\nvBarkUv = uv;\nvLocalPos = position;`)
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>',
      `#include <common>
      varying vec2 vBarkUv; varying vec3 vLocalPos;
      float barkHash2(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }`)
    shader.fragmentShader = shader.fragmentShader.replace('#include <dithering_fragment>',
      `float heightT = vBarkUv.y;
      vec3 darkBark = vec3(0.35,0.25,0.15); vec3 lightBark = vec3(0.6,0.48,0.32);
      vec3 barkCol = mix(darkBark, lightBark, heightT);
      float mossN = barkHash2(vLocalPos.xz * 6.0 + vec2(42.0));
      float mossH = max(0.0, 1.0 - heightT * 2.0);
      barkCol = mix(barkCol, vec3(0.15,0.35,0.1), mossH*mossH*mossN*0.8);
      float stripe = sin(vBarkUv.x * 3.14159 * 16.0 + barkHash2(vLocalPos.xy*4.0)*4.0);
      stripe = stripe * 0.5 + 0.5;
      barkCol -= vec3(0.06,0.05,0.03) * stripe;
      gl_FragColor.rgb = barkCol * gl_FragColor.rgb / vec3(0.545,0.420,0.290);
      #include <dithering_fragment>`)
  }
  return mat
}

// ══════════════════════════════════════════════
//  Trunk geometry (full height, bends more after fork)
// ══════════════════════════════════════════════
function createTrunkGeo(seed: number): { geo: THREE.BufferGeometry; forkPos: THREE.Vector3; forkTangent: THREE.Vector3; forkRadius: number; bendDirX: number; bendDirZ: number } {
  const h = params.trunkHeight
  const baseThick = params.trunkThickness
  const taper = params.trunkTaper
  const topThick = baseThick * taper
  const bendAmt = params.trunkBend
  const rootFlare = params.rootFlare
  const grooveD = params.trunkGrooveDepth, grooveF = params.trunkGrooveFreq
  const forkT = params.forkHeight // 0~1, where fork happens

  const bendDirX = seeded01(seed + 20.1) - 0.3
  const bendDirZ = (seeded01(seed + 21.7) - 0.5) * 0.7

  // Extra bend direction after fork (trunk curves away from fork branch)
  const forkBendX = (seeded01(seed + 30.3) - 0.3) * params.trunkAfterForkBend * 3
  const forkBendZ = (seeded01(seed + 31.1) - 0.5) * params.trunkAfterForkBend * 2

  const geo = new THREE.CylinderGeometry(topThick, baseThick, h, 16, 24)
  const pos = geo.attributes.position

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
    const t = (y + h / 2) / h

    // Root flare
    const rootT = Math.max(0, 1 - t * 4)
    const flare = 1 + rootT * rootT * rootFlare * 10
    const rAngle = Math.atan2(z, x)
    x *= flare * (1 + rootT * Math.sin(rAngle * 3 + seed) * 0.3 * rootFlare * 3)
    z *= flare

    // Bend: normal bend below fork, stronger curve after fork
    if (t <= forkT) {
      x += bendAmt * t * t * bendDirX
      z += bendAmt * t * t * bendDirZ
    } else {
      // Continuous bend up to fork
      const baseBendX = bendAmt * forkT * forkT * bendDirX
      const baseBendZ = bendAmt * forkT * forkT * bendDirZ
      // Additional curve after fork
      const afterT = (t - forkT) / (1 - forkT)
      x += baseBendX + afterT * afterT * forkBendX
      z += baseBendZ + afterT * afterT * forkBendZ
    }

    // Groove
    const angle = Math.atan2(z, x)
    const groove = Math.sin(angle * grooveF + seed) * Math.abs(Math.sin(angle * grooveF + seed)) * grooveD
    const r = Math.sqrt(x * x + z * z)
    if (r > 0.001) { const nr = r + groove * (1 - t * 0.5); x = x / r * nr; z = z / r * nr }

    pos.setXYZ(i, x, y, z)
  }
  geo.computeVertexNormals()
  geo.translate(0, h / 2, 0)

  // Fork point position
  const forkY = h * forkT
  const forkX2 = bendAmt * forkT * forkT * bendDirX
  const forkZ2 = bendAmt * forkT * forkT * bendDirZ
  const forkPos = new THREE.Vector3(forkX2, forkY, forkZ2)

  // Tangent at fork
  const forkTangent = new THREE.Vector3(
    2 * bendAmt * forkT * bendDirX,
    1,
    2 * bendAmt * forkT * bendDirZ
  ).normalize()

  // Radius at fork height
  const forkRadius = baseThick * (1 - forkT * (1 - taper))

  return { geo, forkPos, forkTangent, forkRadius, bendDirX, bendDirZ }
}

// ══════════════════════════════════════════════
//  Fork branch geometry (CylinderGeometry + vertex deformation)
// ══════════════════════════════════════════════
interface ForkBranchData {
  startPos: THREE.Vector3
  dir: THREE.Vector3
  length: number
  baseThick: number
  tipThick: number
  droop: number
  bend: number
  seed: number
}

function createForkBranchGeo(fb: ForkBranchData): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(fb.tipThick, fb.baseThick, fb.length, 12, 12)
  const pos = geo.attributes.position
  const grooveD = params.trunkGrooveDepth * 0.5
  const grooveF = params.trunkGrooveFreq

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
    const t = (y + fb.length / 2) / fb.length // 0=base, 1=tip

    // Droop
    y -= fb.droop * t * t * fb.length

    // Bend (x and z, seeded direction)
    const bendDirX = seeded01(fb.seed + 99) - 0.3
    const bendDirZ = (seeded01(fb.seed + 101) - 0.5) * 0.7
    x += fb.bend * t * t * fb.length * bendDirX
    z += fb.bend * t * t * fb.length * bendDirZ

    // Groove (lighter than trunk)
    if (grooveD > 0) {
      const angle = Math.atan2(z, x)
      const groove = Math.sin(angle * grooveF + fb.seed) * Math.abs(Math.sin(angle * grooveF + fb.seed)) * grooveD
      const r = Math.sqrt(x * x + z * z)
      if (r > 0.001) { const nr = r + groove * (1 - t * 0.5); x = x / r * nr; z = z / r * nr }
    }

    pos.setXYZ(i, x, y, z)
  }
  geo.computeVertexNormals()

  // Rotate to match branch direction
  const dir = fb.dir.clone().normalize()
  const up = new THREE.Vector3(0, 1, 0)
  const quat = new THREE.Quaternion()
  const dot = up.dot(dir)
  if (Math.abs(dot - 1) > 0.001) {
    const axis = new THREE.Vector3().crossVectors(up, dir).normalize()
    quat.setFromAxisAngle(axis, Math.acos(Math.max(-1, Math.min(1, dot))))
  }

  // Position at midpoint between start and end
  const endPos = fb.startPos.clone().addScaledVector(fb.dir, fb.length)
  const cx = (fb.startPos.x + endPos.x) / 2
  const cy = (fb.startPos.y + endPos.y) / 2
  const cz = (fb.startPos.z + endPos.z) / 2

  const matrix = new THREE.Matrix4().makeRotationFromQuaternion(quat)
  matrix.setPosition(cx, cy, cz)
  geo.applyMatrix4(matrix)

  return geo
}

// ══════════════════════════════════════════════
//  Build
// ══════════════════════════════════════════════
const treeGroup = new THREE.Group()
scene.add(treeGroup)

function buildAll() {
  treeGroup.traverse(c => {
    if (c instanceof THREE.Mesh || c instanceof THREE.Sprite) {
      if (c instanceof THREE.Mesh) c.geometry.dispose()
    }
  })
  treeGroup.clear()

  const seed = params.seed
  const barkMat = createBarkMaterial()

  // Trunk (full height, curves after fork — this IS the main continuation branch)
  const { geo: trunkGeo, forkPos, forkTangent, forkRadius } = createTrunkGeo(seed)
  const trunkMesh = new THREE.Mesh(trunkGeo, barkMat)
  trunkMesh.castShadow = true
  treeGroup.add(trunkMesh)

  // Fork point marker
  if (params.showForkPoint) {
    const markerGeo = new THREE.SphereGeometry(0.06, 8, 8)
    const markerMat = new THREE.MeshBasicMaterial({ color: 0xff4444 })
    const marker = new THREE.Mesh(markerGeo, markerMat)
    marker.position.copy(forkPos)
    treeGroup.add(marker)

    // Label: trunk continuation
    const lc0 = document.createElement('canvas')
    lc0.width = 200; lc0.height = 30
    const ctx0 = lc0.getContext('2d')!
    ctx0.fillStyle = '#58a6ff'; ctx0.font = 'bold 12px monospace'; ctx0.textAlign = 'center'
    ctx0.fillText('줄기 연장 (fork 후 휘어짐)', 100, 20)
    const tex0 = new THREE.CanvasTexture(lc0)
    const sp0 = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex0, transparent: true }))
    sp0.position.set(forkPos.x, params.trunkHeight + 0.3, forkPos.z)
    sp0.scale.set(1.4, 0.25, 1)
    treeGroup.add(sp0)
  }

  // Fork branches (split off from fork point — trunk is already one branch)
  const forkBranchCount = Math.max(1, params.forkCount - 1) // subtract 1 because trunk IS one
  const branchBaseThick = forkRadius * params.forkBranchThickness

  for (let i = 0; i < forkBranchCount; i++) {
    const azimuth = (i + 0.5) * (Math.PI * 2 / forkBranchCount) + seeded01(seed + i * 37) * 0.5
    const spreadRad = params.forkSpreadAngle * Math.PI / 180

    const asymFactor = 1 + (seeded01(seed + i * 73 + 100) - 0.5) * 2 * params.forkAsymmetry
    const branchSpread = spreadRad * asymFactor
    const branchLength = params.forkBranchLength * (0.85 + seeded01(seed + i * 51) * 0.3) * asymFactor

    // Direction: diverge from trunk tangent at fork
    const spreadAxis = new THREE.Vector3().crossVectors(forkTangent, new THREE.Vector3(Math.cos(azimuth), 0, Math.sin(azimuth))).normalize()
    if (spreadAxis.length() < 0.001) spreadAxis.set(1, 0, 0)
    const dir = forkTangent.clone().applyAxisAngle(spreadAxis, branchSpread).normalize()

    const fb: ForkBranchData = {
      startPos: forkPos.clone(),
      dir,
      length: branchLength,
      baseThick: branchBaseThick * asymFactor,
      tipThick: branchBaseThick * params.forkBranchTaper,
      droop: params.forkBranchDroop,
      bend: params.forkBranchBend,
      seed: seed + i * 200,
    }

    const branchGeo = createForkBranchGeo(fb)
    const branchMesh = new THREE.Mesh(branchGeo, barkMat)
    branchMesh.castShadow = true
    treeGroup.add(branchMesh)

    // Label
    const endPt = fb.startPos.clone().addScaledVector(fb.dir, fb.length)
    const lc = document.createElement('canvas')
    lc.width = 150; lc.height = 30
    const ctx = lc.getContext('2d')!
    ctx.fillStyle = '#7ee787'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'
    ctx.fillText(`분기 ${i + 1}`, 75, 20)
    const tex = new THREE.CanvasTexture(lc)
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }))
    sprite.position.copy(endPt).add(new THREE.Vector3(0, 0.2, 0))
    sprite.scale.set(0.8, 0.2, 1)
    treeGroup.add(sprite)
  }

  // Wireframe overlay
  if (params.showWireframe) {
    treeGroup.traverse(c => {
      if (c instanceof THREE.Mesh && c.geometry.attributes.position) {
        const wire = new THREE.LineSegments(
          new THREE.WireframeGeometry(c.geometry),
          new THREE.LineBasicMaterial({ color: 0x444444, transparent: true, opacity: 0.3 })
        )
        treeGroup.add(wire)
      }
    })
  }
}

buildAll()

// ══════════════════════════════════════════════
//  GUI
// ══════════════════════════════════════════════
const gui = new GUI({ width: 280 })
gui.domElement.style.position = 'absolute'
gui.domElement.style.top = '48px'
gui.domElement.style.right = '0'
canvas.parentElement!.appendChild(gui.domElement)

const genF = gui.addFolder('생성')
genF.add(params, 'seed', 0, 500, 1).name('시드').onChange(buildAll)
genF.add({ randomize: () => { params.seed = Math.floor(Math.random() * 500); buildAll(); gui.controllersRecursive().forEach(c => c.updateDisplay()) } }, 'randomize').name('🎲 랜덤 시드')

const trunkF = gui.addFolder('줄기')
trunkF.add(params, 'trunkHeight', 1, 6, 0.1).name('전체 높이').onChange(buildAll)
trunkF.add(params, 'trunkThickness', 0.05, 0.25, 0.01).name('두께').onChange(buildAll)
trunkF.add(params, 'trunkTaper', 0.05, 1.0, 0.05).name('분기점 가늘어짐').onChange(buildAll)
trunkF.add(params, 'trunkBend', 0, 0.4, 0.01).name('휘어짐').onChange(buildAll)
trunkF.add(params, 'trunkGrooveDepth', 0, 0.06, 0.005).name('홈 깊이').onChange(buildAll)
trunkF.add(params, 'rootFlare', 0, 0.15, 0.01).name('뿌리 벌어짐').onChange(buildAll)

const forkF = gui.addFolder('분기')
forkF.add(params, 'forkHeight', 0.3, 0.8, 0.05).name('분기 높이').onChange(buildAll)
forkF.add(params, 'trunkAfterForkBend', 0, 1.0, 0.05).name('줄기연장 휘어짐').onChange(buildAll)
forkF.add(params, 'forkCount', 2, 4, 1).name('분기 수').onChange(buildAll)
forkF.add(params, 'forkSpreadAngle', 10, 60, 1).name('벌어짐 (°)').onChange(buildAll)
forkF.add(params, 'forkAsymmetry', 0, 0.5, 0.05).name('비대칭').onChange(buildAll)

const fbF = gui.addFolder('분기 가지')
fbF.add(params, 'forkBranchLength', 0.5, 4, 0.1).name('길이').onChange(buildAll)
fbF.add(params, 'forkBranchThickness', 0.3, 1.0, 0.05).name('시작 두께비').onChange(buildAll)
fbF.add(params, 'forkBranchTaper', 0.1, 0.6, 0.05).name('끝 가늘어짐').onChange(buildAll)
fbF.add(params, 'forkBranchDroop', 0, 0.2, 0.005).name('처짐').onChange(buildAll)
fbF.add(params, 'forkBranchBend', 0, 1.0, 0.05).name('휘어짐').onChange(buildAll)

const vizF = gui.addFolder('시각화')
vizF.add(params, 'showWireframe').name('와이어프레임').onChange(buildAll)
vizF.add(params, 'showForkPoint').name('분기점 표시').onChange(buildAll)

// ── Info ──
const infoDiv = document.getElementById('info') as HTMLDivElement

// ── Resize ──
function resize() {
  const parent = canvas.parentElement!
  const w = parent.clientWidth, h = parent.clientHeight
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  camera.aspect = w / h
  camera.updateProjectionMatrix()
}
window.addEventListener('resize', resize)
resize()

function animate() {
  requestAnimationFrame(animate)
  controls.update()
  const info = renderer.info.render
  infoDiv.innerHTML = `<span>seed: ${params.seed}</span><span>triangles: ${info.triangles.toLocaleString()}</span>`
  renderer.render(scene, camera)
}
animate()
