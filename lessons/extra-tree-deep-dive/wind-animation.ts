import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import GUI from 'lil-gui'

// ══════════════════════════════════════════════
//  Scene setup
// ══════════════════════════════════════════════
const canvas = document.getElementById('c') as HTMLCanvasElement
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setClearColor(0x1a1a2e)
renderer.shadowMap.enabled = true
renderer.toneMapping = THREE.ACESFilmicToneMapping

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100)
camera.position.set(0, 3, 7)

const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true
controls.target.set(0, 2, 0)

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
//  Seeded RNG (same as ProceduralAssetGenerator)
// ══════════════════════════════════════════════
function seeded01(seed: number): number {
  const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return n - Math.floor(n)
}

function seededRng(s: number) {
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

// ══════════════════════════════════════════════
//  Parameters
// ══════════════════════════════════════════════
const params = {
  seed: 42,

  // Trunk + Fork
  trunkHeight: 3.5,
  trunkThickness: 0.12,
  trunkTaper: 0.2,
  trunkBend: 0.14,
  forkHeight: 0.55,
  forkSpreadAngle: 38,
  trunkAfterForkBend: 0.15,
  forkBranchLength: 1.5,
  forkBranchThickness: 0.9,
  forkBranchTaper: 0.2,
  forkBranchDroop: 0.13,
  forkBranchBend: 0.3,

  // Main branches (주가지)
  mainBranchCount: 6,
  mainBranchStartT: 0.3,
  mainBranchEndT: 0.75,
  mainBranchLengthScale: 0.45,
  mainBranchThicknessScale: 0.4,
  mainBranchSpreadAngle: 62,
  mainBranchDroop: 0.15,

  // Sub-branch hierarchy
  maxDepth: 2,
  twigCount: 6,
  twigLengthScale: 0.35,
  twigSpreadAngle: 68,
  twigThicknessScale: 0.3,
  subTwigCount: 6,
  subTwigLengthScale: 0.25,
  subTwigSpreadAngle: 63,
  subTwigThicknessScale: 0.3,

  // Leaf placement curve
  startT: 0.15,
  peakT: 1.0,
  converge: 0.3,
  endExtend: 3.0,
  spreadRadiusH: 0.05,
  peakRadiusScaleH: 1.5,
  spreadRadiusV: 0.05,
  peakRadiusScaleV: 1.2,

  // Leaf count & size
  leafPerBranch: 39,
  leafWidth: 0.08,
  leafHeight: 0.12,

  // Leaf orientation (botanical model)
  petioleAngle: 45,
  gravitropism: 0.4,
  flatness: 0.5,
  tiltJitter: 15,

  // Wind
  windEnabled: true,
  windLayers: 2,  // 0=줄기only, 1=줄기+가지, 2=줄기+가지+잎
  windAngle: 0.8,
  windStrength: 0.6,
  trunkSwaySpeed: 0.2,
  trunkSwayAmount: 0.005,
  branchSwaySpeed: 1.6,
  branchSwayAmount: 0.03,
  leafFlutterSpeed: 4.0,
  leafFlutterAmount: 0.01,
  gustEnabled: true,
  gustFrequency: 0.3,
  gustStrength: 1.5,

  // Visualization
  showDots: false,
  showBranches: true,
  showLeaves: true,
  showCurves: false,
}

// ══════════════════════════════════════════════
//  Trunk with fork (continuation + fork branch)
// ══════════════════════════════════════════════
function createTrunk(seed: number) {
  const h = params.trunkHeight
  const thick = params.trunkThickness
  const taper = params.trunkTaper
  const topThick = thick * taper
  const bendAmt = params.trunkBend
  const rootFlare = 0.07, grooveD = 0.03, grooveF = 12
  const forkT = params.forkHeight

  const bendDirX = seeded01(seed + 20.1) - 0.3
  const bendDirZ = (seeded01(seed + 21.7) - 0.5) * 0.7
  const forkBendX = (seeded01(seed + 30.3) - 0.3) * params.trunkAfterForkBend * 3
  const forkBendZ = (seeded01(seed + 31.1) - 0.5) * params.trunkAfterForkBend * 2

  const geo = new THREE.CylinderGeometry(topThick, thick, h, 16, 24)
  const pos = geo.attributes.position

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
    const t = (y + h / 2) / h

    const rootT = Math.max(0, 1 - t * 4)
    const flare = 1 + rootT * rootT * rootFlare * 10
    const rAngle = Math.atan2(z, x)
    x *= flare * (1 + rootT * Math.sin(rAngle * 3 + seed) * 0.3 * rootFlare * 3)
    z *= flare

    // Bend: normal below fork, extra curve after fork
    if (t <= forkT) {
      x += bendAmt * t * t * bendDirX
      z += bendAmt * t * t * bendDirZ
    } else {
      const baseBendX = bendAmt * forkT * forkT * bendDirX
      const baseBendZ = bendAmt * forkT * forkT * bendDirZ
      const afterT = (t - forkT) / (1 - forkT)
      x += baseBendX + afterT * afterT * forkBendX
      z += baseBendZ + afterT * afterT * forkBendZ
    }

    const angle = Math.atan2(z, x)
    const groove = Math.sin(angle * grooveF + seed) * Math.abs(Math.sin(angle * grooveF + seed)) * grooveD
    const r = Math.sqrt(x * x + z * z)
    if (r > 0.001) { const nr = r + groove * (1 - t * 0.5); x = x / r * nr; z = z / r * nr }
    pos.setXYZ(i, x, y, z)
  }
  geo.computeVertexNormals()
  geo.translate(0, h / 2, 0)

  // Fork point
  const forkY = h * forkT
  const forkX = bendAmt * forkT * forkT * bendDirX
  const forkZ = bendAmt * forkT * forkT * bendDirZ
  const forkPos = new THREE.Vector3(forkX, forkY, forkZ)
  const forkTangent = new THREE.Vector3(2 * bendAmt * forkT * bendDirX, 1, 2 * bendAmt * forkT * bendDirZ).normalize()
  const forkRadius = thick * (1 - forkT * (1 - taper))

  return { geo, bendDirX, bendDirZ, forkPos, forkTangent, forkRadius }
}

// Fork branch geometry (CylinderGeometry + deformation)
function createForkBranchGeo(startPos: THREE.Vector3, dir: THREE.Vector3, length: number, baseThick: number, tipThick: number, droop: number, bend: number, bSeed: number): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(tipThick, baseThick, length, 12, 12)
  const pos = geo.attributes.position
  const bendDX = seeded01(bSeed + 99) - 0.3
  const bendDZ = (seeded01(bSeed + 101) - 0.5) * 0.7

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
    const t = (y + length / 2) / length
    y -= droop * t * t * length
    x += bend * t * t * length * bendDX
    z += bend * t * t * length * bendDZ
    pos.setXYZ(i, x, y, z)
  }
  geo.computeVertexNormals()

  const d = dir.clone().normalize()
  const up = new THREE.Vector3(0, 1, 0)
  const quat = new THREE.Quaternion()
  const dot = up.dot(d)
  if (Math.abs(dot - 1) > 0.001) {
    const axis = new THREE.Vector3().crossVectors(up, d).normalize()
    quat.setFromAxisAngle(axis, Math.acos(Math.max(-1, Math.min(1, dot))))
  }
  const endPos = startPos.clone().addScaledVector(dir, length)
  const cx = (startPos.x + endPos.x) / 2, cy = (startPos.y + endPos.y) / 2, cz = (startPos.z + endPos.z) / 2
  const matrix = new THREE.Matrix4().makeRotationFromQuaternion(quat)
  matrix.setPosition(cx, cy, cz)
  geo.applyMatrix4(matrix)
  return geo
}

// ══════════════════════════════════════════════
//  Branch data (hierarchical: trunk → branch → twig → sub-twig)
// ══════════════════════════════════════════════
interface BranchInfo {
  startX: number; startY: number; startZ: number
  dirX: number; dirY: number; dirZ: number
  length: number
  thickness: number
  taper: number   // tip thickness ratio (0~1)
  droop: number
  depth: number
  seed: number
  children: BranchInfo[]
}

function computeBranches(seed: number, forkPos: THREE.Vector3, forkTangent: THREE.Vector3, forkRadius: number, forkBranchInfo?: BranchInfo): BranchInfo[] {
  const h = params.trunkHeight
  const taper = params.trunkTaper
  const forkT = params.forkHeight

  // Two parent stems: trunk continuation (above fork) + fork branch
  // getPoint(t) returns actual curved position for accurate attachment
  interface Stem {
    startPos: THREE.Vector3; dir: THREE.Vector3; length: number; radius: number
    getPoint: (t: number) => THREE.Vector3
  }
  const stems: Stem[] = []

  // Stem 1: trunk continuation (fork to top) — uses actual trunk bend curve
  const forkBendX = (seeded01(seed + 30.3) - 0.3) * params.trunkAfterForkBend * 3
  const forkBendZ = (seeded01(seed + 31.1) - 0.5) * params.trunkAfterForkBend * 2
  const trunkContLen = h * (1 - forkT)
  stems.push({
    startPos: forkPos.clone(),
    dir: new THREE.Vector3(forkBendX, trunkContLen, forkBendZ).normalize(),
    length: trunkContLen,
    radius: forkRadius, // fork 지점 줄기 두께 기준
    getPoint: (t: number) => {
      // Match createTrunk's post-fork bend: afterT² curve
      return new THREE.Vector3(
        forkPos.x + t * t * forkBendX,
        forkPos.y + t * trunkContLen,
        forkPos.z + t * t * forkBendZ,
      )
    },
  })

  // Stem 2: fork branch — uses getBranchPoint for exact match with visual
  if (forkBranchInfo) {
    stems.push({
      startPos: forkPos.clone(),
      dir: new THREE.Vector3(forkBranchInfo.dirX, forkBranchInfo.dirY, forkBranchInfo.dirZ),
      length: forkBranchInfo.length,
      radius: forkBranchInfo.thickness,
      getPoint: (t: number) => getBranchPoint(forkBranchInfo, t),
    })
  }

  // Distribute main branches across both stems
  const branchCount = params.mainBranchCount
  const allBranches: BranchInfo[] = []

  for (let si = 0; si < stems.length; si++) {
    const stem = stems[si]
    const count = si === 0 ? Math.ceil(branchCount / 2) : Math.floor(branchCount / 2)

    for (let i = 0; i < count; i++) {
      const heightRatio = i / Math.max(count - 1, 1)
      const bSeed = seed + si * 500 + i * 137

      // Attach along stem using user-defined range
      const attachT = params.mainBranchStartT + heightRatio * (params.mainBranchEndT - params.mainBranchStartT)
      const attachPt = stem.getPoint(attachT)

      // Stem tangent at attach point for proper direction
      const dt = 0.02
      const sp0 = stem.getPoint(Math.max(0, attachT - dt))
      const sp1 = stem.getPoint(Math.min(1, attachT + dt))
      const stemTangent = sp1.clone().sub(sp0).normalize()

      // Build perpendicular frame from stem tangent
      const azimuth = (si * Math.PI + i * GOLDEN_ANGLE) + (seeded01(bSeed) - 0.5) * 0.4
      const right = new THREE.Vector3().crossVectors(stemTangent, new THREE.Vector3(0, 1, 0)).normalize()
      if (right.length() < 0.001) right.set(1, 0, 0)
      const upLocal = new THREE.Vector3().crossVectors(right, stemTangent).normalize()

      // Direction: spread from stem tangent
      const spreadRad = params.mainBranchSpreadAngle * Math.PI / 180
      const spreadDir = stemTangent.clone()
        .addScaledVector(right, Math.cos(azimuth) * Math.sin(spreadRad))
        .addScaledVector(upLocal, Math.sin(azimuth) * Math.sin(spreadRad))
        .normalize()

      const attachRadius = stem.radius * (1 - attachT * 0.5)
      const length = stem.length * params.mainBranchLengthScale * (0.7 + seeded01(bSeed + 1) * 0.6) * (1.15 - heightRatio * 0.4)

      const mainBranch: BranchInfo = {
        startX: attachPt.x + Math.cos(azimuth) * attachRadius * 0.3,
        startY: attachPt.y,
        startZ: attachPt.z + Math.sin(azimuth) * attachRadius * 0.3,
        dirX: spreadDir.x, dirY: spreadDir.y, dirZ: spreadDir.z,
        length,
        thickness: stem.radius * params.mainBranchThicknessScale * (1.2 - heightRatio * 0.3),
        taper: 0.3,
        droop: params.mainBranchDroop + seeded01(bSeed + 3) * 0.08,
        depth: 0,
        seed: bSeed,
        children: [],
      }

      spawnChildren(mainBranch, params.maxDepth)
      allBranches.push(mainBranch)
    }
  }
  return allBranches
}

function spawnChildren(parent: BranchInfo, maxDepth: number): void {
  if (parent.depth >= maxDepth) return

  const childCount = parent.depth === 0 ? params.twigCount : params.subTwigCount
  const lengthScale = parent.depth === 0 ? params.twigLengthScale : params.subTwigLengthScale
  const spreadAngle = parent.depth === 0 ? params.twigSpreadAngle : params.subTwigSpreadAngle

  for (let i = 0; i < childCount; i++) {
    const cSeed = parent.seed + (parent.depth + 1) * 1000 + i * 73
    const attachT = 0.3 + seeded01(cSeed + 1) * 0.6
    const attachPt = getBranchPoint(parent, attachT)

    // Tangent at attach point (not initial dir — accounts for droop)
    const dt = 0.02
    const p0 = getBranchPoint(parent, Math.max(0, attachT - dt))
    const p1 = getBranchPoint(parent, Math.min(1, attachT + dt))
    const parentTangent = p1.clone().sub(p0).normalize()

    const spreadRad = spreadAngle * Math.PI / 180
    const azimuth = i * GOLDEN_ANGLE + (seeded01(cSeed + 2) - 0.5) * 1.0
    const elevOffset = (seeded01(cSeed + 3) - 0.3) * spreadRad

    // Build child direction from tangent at attach point
    const right = new THREE.Vector3().crossVectors(parentTangent, new THREE.Vector3(0, 1, 0)).normalize()
    if (right.length() < 0.001) right.set(1, 0, 0)
    const up = new THREE.Vector3().crossVectors(right, parentTangent).normalize()

    const childDir = parentTangent.clone()
      .addScaledVector(right, Math.cos(azimuth) * Math.sin(spreadRad + elevOffset))
      .addScaledVector(up, Math.sin(azimuth) * Math.sin(spreadRad + elevOffset))
      .normalize()

    const childLength = parent.length * lengthScale * (0.7 + seeded01(cSeed + 4) * 0.6)
    const thickScale = parent.depth === 0 ? params.twigThicknessScale : params.subTwigThicknessScale
    const childThick = parent.thickness * thickScale

    const child: BranchInfo = {
      startX: attachPt.x,
      startY: attachPt.y,
      startZ: attachPt.z,
      dirX: childDir.x,
      dirY: childDir.y,
      dirZ: childDir.z,
      length: childLength,
      thickness: childThick,
      taper: 0.3,
      droop: 0,
      depth: parent.depth + 1,
      seed: cSeed,
      children: [],
    }

    parent.children.push(child)
    spawnChildren(child, maxDepth)
  }
}

// Flatten tree into array for iteration
function flattenBranches(branches: BranchInfo[]): BranchInfo[] {
  const result: BranchInfo[] = []
  function walk(b: BranchInfo) {
    result.push(b)
    for (const c of b.children) walk(c)
  }
  for (const b of branches) walk(b)
  return result
}

// ══════════════════════════════════════════════
//  Branch geometry
// ══════════════════════════════════════════════
function createBranchGeo(b: BranchInfo): THREE.BufferGeometry {
  // Build tube mesh following getBranchPoint path exactly
  const radialSegs = b.depth === 0 ? 6 : 4
  const heightSegs = 6
  const tipThick = b.thickness * b.taper

  // Sample path points
  const pathPoints: THREE.Vector3[] = []
  const radii: number[] = []
  for (let i = 0; i <= heightSegs; i++) {
    const t = i / heightSegs
    pathPoints.push(getBranchPoint(b, t))
    radii.push(b.thickness * (1 - t) + tipThick * t) // linear taper
  }

  // Build tube vertices
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  for (let hi = 0; hi <= heightSegs; hi++) {
    const center = pathPoints[hi]
    const r = radii[hi]
    const vCoord = hi / heightSegs // 0=base, 1=tip

    const prev = pathPoints[Math.max(0, hi - 1)]
    const next = pathPoints[Math.min(heightSegs, hi + 1)]
    const tangent = next.clone().sub(prev).normalize()

    const worldUp = new THREE.Vector3(0, 1, 0)
    let right = new THREE.Vector3().crossVectors(tangent, worldUp).normalize()
    if (right.length() < 0.001) right.set(1, 0, 0)
    const up = new THREE.Vector3().crossVectors(right, tangent).normalize()

    for (let ri = 0; ri < radialSegs; ri++) {
      const angle = (ri / radialSegs) * Math.PI * 2
      const uCoord = ri / radialSegs
      const x = center.x + (Math.cos(angle) * right.x + Math.sin(angle) * up.x) * r
      const y = center.y + (Math.cos(angle) * right.y + Math.sin(angle) * up.y) * r
      const z = center.z + (Math.cos(angle) * right.z + Math.sin(angle) * up.z) * r
      positions.push(x, y, z)
      uvs.push(uCoord, vCoord)

      const nx = Math.cos(angle) * right.x + Math.sin(angle) * up.x
      const ny = Math.cos(angle) * right.y + Math.sin(angle) * up.y
      const nz = Math.cos(angle) * right.z + Math.sin(angle) * up.z
      normals.push(nx, ny, nz)
    }
  }

  // Indices
  for (let hi = 0; hi < heightSegs; hi++) {
    for (let ri = 0; ri < radialSegs; ri++) {
      const a = hi * radialSegs + ri
      const b2 = hi * radialSegs + (ri + 1) % radialSegs
      const c = (hi + 1) * radialSegs + ri
      const d = (hi + 1) * radialSegs + (ri + 1) % radialSegs
      indices.push(a, c, b2, b2, c, d)
    }
  }

  // Tip cap: center point + fan triangles (close the end)
  const tipCenter = pathPoints[heightSegs]
  const tipIdx = positions.length / 3
  positions.push(tipCenter.x, tipCenter.y, tipCenter.z)
  const lastTangent = pathPoints[heightSegs].clone().sub(pathPoints[heightSegs - 1]).normalize()
  normals.push(lastTangent.x, lastTangent.y, lastTangent.z)
  uvs.push(0.5, 1)
  const lastRing = heightSegs * radialSegs
  for (let ri = 0; ri < radialSegs; ri++) {
    indices.push(tipIdx, lastRing + (ri + 1) % radialSegs, lastRing + ri)
  }

  // Base cap: close the start too
  const baseCenter = pathPoints[0]
  const baseIdx = positions.length / 3
  positions.push(baseCenter.x, baseCenter.y, baseCenter.z)
  const firstTangent = pathPoints[1].clone().sub(pathPoints[0]).normalize()
  normals.push(-firstTangent.x, -firstTangent.y, -firstTangent.z)
  uvs.push(0.5, 0)
  for (let ri = 0; ri < radialSegs; ri++) {
    indices.push(baseIdx, ri, (ri + 1) % radialSegs)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  return geo
}

// ══════════════════════════════════════════════
//  Density & Radius curves (from HTML spec)
// ══════════════════════════════════════════════
// endT: effective end of leaf zone (branch tip + extension)
function getEndT(): number { return 1 + params.endExtend }

function getDensity(t: number): number {
  const endT = getEndT()
  if (t < params.startT) return 0
  if (t < params.peakT) {
    const s = (t - params.startT) / (params.peakT - params.startT)
    return s * s * (3 - 2 * s) // smoothstep
  } else {
    const s = (t - params.peakT) / (endT - params.peakT)
    return Math.max(0, 1 - s * s * params.converge)
  }
}

function getRadiusH(t: number): number {
  const endT = getEndT()
  if (t < params.startT) return 0
  if (t < params.peakT) {
    const s = (t - params.startT) / (params.peakT - params.startT)
    return params.spreadRadiusH * s * params.peakRadiusScaleH
  } else {
    const s = (t - params.peakT) / (endT - params.peakT)
    const taper = Math.max(0, 1 - s * params.converge)
    return params.spreadRadiusH * params.peakRadiusScaleH * taper
  }
}

function getRadiusV(t: number): number {
  const endT = getEndT()
  if (t < params.startT) return 0
  if (t < params.peakT) {
    const s = (t - params.startT) / (params.peakT - params.startT)
    return params.spreadRadiusV * s * params.peakRadiusScaleV
  } else {
    const s = (t - params.peakT) / (endT - params.peakT)
    const taper = Math.max(0, 1 - s * params.converge)
    return params.spreadRadiusV * params.peakRadiusScaleV * taper
  }
}

// ══════════════════════════════════════════════
//  Point along branch (with droop)
// ══════════════════════════════════════════════
function getBranchPoint(b: BranchInfo, t: number): THREE.Vector3 {
  const droopOffset = b.droop * t * t * b.length
  return new THREE.Vector3(
    b.startX + b.dirX * b.length * t,
    b.startY + b.dirY * b.length * t - droopOffset,
    b.startZ + b.dirZ * b.length * t,
  )
}

function getBranchLocalFrame(b: BranchInfo): { right: THREE.Vector3; upLocal: THREE.Vector3 } {
  const dir = new THREE.Vector3(b.dirX, b.dirY, b.dirZ).normalize()
  const worldUp = new THREE.Vector3(0, 1, 0)
  const right = new THREE.Vector3().crossVectors(dir, worldUp).normalize()
  if (right.length() < 0.001) right.set(1, 0, 0)
  const upLocal = new THREE.Vector3().crossVectors(right, dir).normalize()
  return { right, upLocal }
}

// ══════════════════════════════════════════════
//  Leaf shapes (4종, from leaf-design.ts)
// ══════════════════════════════════════════════
type DrawFn = (ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) => void
const leafDrawFns: DrawFn[] = [
  // 타원형
  (ctx, cx, cy, s) => {
    ctx.beginPath()
    ctx.moveTo(cx, cy - s * 0.48)
    ctx.bezierCurveTo(cx + s * 0.35, cy - s * 0.35, cx + s * 0.4, cy + s * 0.1, cx + s * 0.2, cy + s * 0.4)
    ctx.quadraticCurveTo(cx, cy + s * 0.5, cx, cy + s * 0.48)
    ctx.quadraticCurveTo(cx, cy + s * 0.5, cx - s * 0.2, cy + s * 0.4)
    ctx.bezierCurveTo(cx - s * 0.4, cy + s * 0.1, cx - s * 0.35, cy - s * 0.35, cx, cy - s * 0.48)
    ctx.closePath()
  },
  // 뾰족형
  (ctx, cx, cy, s) => {
    ctx.beginPath()
    ctx.moveTo(cx, cy - s * 0.5)
    ctx.bezierCurveTo(cx + s * 0.25, cy - s * 0.25, cx + s * 0.3, cy + s * 0.15, cx + s * 0.1, cy + s * 0.42)
    ctx.quadraticCurveTo(cx, cy + s * 0.48, cx, cy + s * 0.48)
    ctx.quadraticCurveTo(cx, cy + s * 0.48, cx - s * 0.1, cy + s * 0.42)
    ctx.bezierCurveTo(cx - s * 0.3, cy + s * 0.15, cx - s * 0.25, cy - s * 0.25, cx, cy - s * 0.5)
    ctx.closePath()
  },
  // 둥근형
  (ctx, cx, cy, s) => {
    ctx.beginPath()
    ctx.moveTo(cx, cy - s * 0.4)
    ctx.bezierCurveTo(cx + s * 0.45, cy - s * 0.35, cx + s * 0.45, cy + s * 0.25, cx + s * 0.15, cy + s * 0.42)
    ctx.quadraticCurveTo(cx + s * 0.05, cy + s * 0.48, cx, cy + s * 0.5)
    ctx.quadraticCurveTo(cx - s * 0.05, cy + s * 0.48, cx - s * 0.15, cy + s * 0.42)
    ctx.bezierCurveTo(cx - s * 0.45, cy + s * 0.25, cx - s * 0.45, cy - s * 0.35, cx, cy - s * 0.4)
    ctx.closePath()
  },
  // 비대칭
  (ctx, cx, cy, s) => {
    ctx.beginPath()
    ctx.moveTo(cx + s * 0.02, cy - s * 0.45)
    ctx.bezierCurveTo(cx + s * 0.3, cy - s * 0.3, cx + s * 0.35, cy + s * 0.05, cx + s * 0.22, cy + s * 0.35)
    ctx.bezierCurveTo(cx + s * 0.1, cy + s * 0.45, cx, cy + s * 0.5, cx - s * 0.03, cy + s * 0.48)
    ctx.bezierCurveTo(cx - s * 0.08, cy + s * 0.45, cx - s * 0.18, cy + s * 0.38, cx - s * 0.25, cy + s * 0.3)
    ctx.bezierCurveTo(cx - s * 0.38, cy + s * 0.05, cx - s * 0.28, cy - s * 0.32, cx + s * 0.02, cy - s * 0.45)
    ctx.closePath()
  },
]

function renderAtlas(): THREE.CanvasTexture {
  const size = 512, half = size / 2
  const c = document.createElement('canvas')
  c.width = size; c.height = size
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, size, size)

  const hue = 110, sat = 55, light = 38
  const hueVar = [0, -8, 5, -3], lightVar = [0, 3, -2, 5]

  for (let i = 0; i < 4; i++) {
    const col = i % 2, row = Math.floor(i / 2)
    const lc = document.createElement('canvas')
    lc.width = half; lc.height = half
    const lctx = lc.getContext('2d')!
    lctx.clearRect(0, 0, half, half)
    const lcx = half / 2, lcy = half / 2, ls = half * 0.9
    leafDrawFns[i](lctx, lcx, lcy, ls)
    const grad = lctx.createRadialGradient(lcx - ls * 0.1, lcy - ls * 0.1, 0, lcx, lcy, ls * 0.5)
    const h = hue + hueVar[i], l = light + lightVar[i]
    grad.addColorStop(0, `hsl(${h + 5}, ${sat + 5}%, ${l + 8}%)`)
    grad.addColorStop(0.6, `hsl(${h}, ${sat}%, ${l}%)`)
    grad.addColorStop(1, `hsl(${h - 5}, ${sat - 5}%, ${l - 5}%)`)
    lctx.fillStyle = grad
    lctx.fill()
    ctx.drawImage(lc, col * half, row * half)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.flipY = true
  return tex
}

// ══════════════════════════════════════════════
//  3D leaf geometry (PlaneGeo + curve/twist/fold)
// ══════════════════════════════════════════════
function createLeaf3DGeo(seed: number): THREE.BufferGeometry {
  const w = params.leafWidth, h = params.leafHeight
  const curvature = 0.2, twist = 0.6, fold = 0.12
  const noiseRange = 0.1
  const nr = () => seeded01(seed * 127.1 + seed) * 2 - 1

  const cv = curvature * (1 + nr() * noiseRange)
  const tw = twist * (1 + nr() * noiseRange)
  const fo = fold * (1 + nr() * noiseRange)

  const segW = 4, segH = 6
  const geo = new THREE.PlaneGeometry(w, h, segW, segH)
  const pos = geo.attributes.position

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
    const u = (x / w) + 0.5, v = (y / h) + 0.5

    // Curve: center bulges forward
    z += Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * cv * w
    // Fold: V shape along center
    z -= Math.abs(u - 0.5) * 2 * fo * w
    // Twist: opposite rotation top/bottom
    const ta = (v - 0.5) * tw
    const ct = Math.cos(ta), st = Math.sin(ta)
    const rx = x * ct - z * st, rz = x * st + z * ct
    x = rx; z = rz

    pos.setXYZ(i, x, y, z)
  }
  geo.computeVertexNormals()

  // Atlas UV: pick random frame from 2×2
  const frameIndex = Math.floor(seeded01(seed * 1.91) * 4) % 4
  const col = frameIndex % 2, row = Math.floor(frameIndex / 2)
  const uv = geo.attributes.uv
  for (let i = 0; i < uv.count; i++) {
    const u0 = uv.getX(i), v0 = uv.getY(i)
    uv.setXY(i, (col + u0) * 0.5, (row + v0) * 0.5)
  }

  return geo
}

// ══════════════════════════════════════════════
//  Wind uniforms (shared across all materials)
// ══════════════════════════════════════════════
const windUniforms = {
  uTime: { value: 0 },
  uWindDir: { value: new THREE.Vector2(Math.cos(0.8), Math.sin(0.8)) },
  uWindStrength: { value: 1.0 },
  uWindLayers: { value: 2 },  // 0=trunk, 1=+branch, 2=+leaf
  uTrunkSwaySpeed: { value: 1.2 },
  uTrunkSwayAmount: { value: 0.05 },
  uBranchSwaySpeed: { value: 1.6 },
  uBranchSwayAmount: { value: 0.03 },
  uLeafFlutterSpeed: { value: 4.0 },
  uLeafFlutterAmount: { value: 0.01 },
  uGustStrength: { value: 0.0 },
}

function updateWindUniforms() {
  windUniforms.uWindDir.value.set(Math.cos(params.windAngle), Math.sin(params.windAngle))
  windUniforms.uWindStrength.value = params.windEnabled ? params.windStrength : 0
  windUniforms.uWindLayers.value = params.windLayers
  windUniforms.uTrunkSwaySpeed.value = params.trunkSwaySpeed
  windUniforms.uTrunkSwayAmount.value = params.trunkSwayAmount
  windUniforms.uBranchSwaySpeed.value = params.branchSwaySpeed
  windUniforms.uBranchSwayAmount.value = params.branchSwayAmount
  windUniforms.uLeafFlutterSpeed.value = params.leafFlutterSpeed
  windUniforms.uLeafFlutterAmount.value = params.leafFlutterAmount
}

const WIND_UNIFORMS_GLSL = `
  uniform float uTime;
  uniform vec2 uWindDir;
  uniform float uWindStrength;
  uniform float uWindLayers;
  uniform float uTrunkSwaySpeed;
  uniform float uTrunkSwayAmount;
  uniform float uBranchSwaySpeed;
  uniform float uBranchSwayAmount;
  uniform float uLeafFlutterSpeed;
  uniform float uLeafFlutterAmount;
  uniform float uGustStrength;
  float windHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
`

// Trunk sway: handled by JS treeGroup.rotation (rigid body)
// Shader layers only handle branch/leaf-specific oscillation

const TRUNK_WIND_GLSL = `` // no-op: trunk sway is group rotation

const BRANCH_WIND_GLSL = `
  if (uWindLayers >= 1.0) {
    // All branches sway in unison (per-branch variation comes from leaf flutter layer)
    float branchPhase = uTime * uBranchSwaySpeed * 1.3;
    float branchSway = sin(branchPhase) * (1.0 + uGustStrength * 0.5);
    transformed.x += uWindDir.x * branchSway * uWindStrength * uBranchSwayAmount;
    transformed.z += uWindDir.y * branchSway * uWindStrength * uBranchSwayAmount * 0.7;
    transformed.y -= abs(branchSway * uWindStrength * uBranchSwayAmount) * 0.1;
  }
`

const LEAF_WIND_GLSL = BRANCH_WIND_GLSL + `
  if (uWindLayers >= 2.0) {
    // Per-leaf phase from fine hash
    float leafPhase = windHash(vWorldPos.xz * 20.0) * 6.2832;
    float flutter1 = sin(uTime * uLeafFlutterSpeed + leafPhase);
    float flutter2 = sin(uTime * uLeafFlutterSpeed * 1.67 + leafPhase * 1.3) * 0.5;
    float flutter = (flutter1 + flutter2) * (1.0 + uGustStrength * 0.7);
    transformed.x += flutter * uWindStrength * uLeafFlutterAmount;
    transformed.y += flutter * uWindStrength * uLeafFlutterAmount * 0.5;
    transformed.z += flutter * uWindStrength * uLeafFlutterAmount * 0.7;
  }
`

// ══════════════════════════════════════════════
//  Materials
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
      const eps = 1 / w
      const hR = Math.sin((u + eps) * Math.PI * 16) * 0.5 + Math.sin((x + 1) * 0.1 + y * 0.07) * Math.cos((x + 1) * 0.13 + y * 0.11) * 0.3
      const hU = Math.sin(u * Math.PI * 16) * 0.5 + Math.sin(x * 0.1 + (y + 1) * 0.07) * Math.cos(x * 0.13 + (y + 1) * 0.11) * 0.3
      const dx = (hC - hR) * 3, dy = (hC - hU) * 3
      const i = (y * w + x) * 4
      img.data[i] = Math.floor((dx * 0.5 + 0.5) * 255)
      img.data[i + 1] = Math.floor((dy * 0.5 + 0.5) * 255)
      img.data[i + 2] = 255
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping
  return tex
}

const barkNormalMap = generateBarkNormalMap()

function createBarkMaterial(windLayer: 'trunk' | 'branch' = 'branch'): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x8b6b4a, roughness: 0.95, metalness: 0,
    normalMap: barkNormalMap, normalScale: new THREE.Vector2(1.5, 1.5),
  })
  mat.onBeforeCompile = (shader) => {
    Object.entries(windUniforms).forEach(([k, v]) => { shader.uniforms[k] = v })

    shader.vertexShader = shader.vertexShader.replace('#include <common>',
      `#include <common>\nvarying vec2 vBarkUv;\nvarying vec3 vWorldPos;\n${WIND_UNIFORMS_GLSL}`)
    // Trunk: no shader wind (group rotation only). Branches: branch sway shader.
    const windCode = windLayer === 'trunk' ? '' : BRANCH_WIND_GLSL
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
      `#include <begin_vertex>
      vBarkUv = uv;
      #ifdef USE_INSTANCING
        vWorldPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
      #else
        vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
      #endif
      ${windCode}
      `)
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>',
      `#include <common>
      varying vec2 vBarkUv; varying vec3 vWorldPos;
      float barkHash2(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }`)

    // Unified bark: world Y determines gradient + moss (only near ground)
    shader.fragmentShader = shader.fragmentShader.replace('#include <dithering_fragment>',
      `// World-Y based bark gradient (same for trunk and branches)
      float worldH = clamp(vWorldPos.y / 3.5, 0.0, 1.0);
      vec3 darkBark = vec3(0.35,0.25,0.15); vec3 lightBark = vec3(0.6,0.48,0.32);
      vec3 barkCol = mix(darkBark, lightBark, smoothstep(0.0, 0.4, worldH));

      // Moss only near ground (worldY < ~0.7m)
      float mossN = barkHash2(vWorldPos.xz * 6.0 + vec2(42.0));
      float mossH = max(0.0, 1.0 - worldH * 5.0);
      barkCol = mix(barkCol, vec3(0.15,0.35,0.1), mossH*mossH*mossN*0.8);

      // Stripes (world-space consistent)
      float stripe = sin(vBarkUv.x * 3.14159 * 16.0 + barkHash2(vWorldPos.xy*4.0)*4.0);
      stripe = stripe * 0.5 + 0.5;
      barkCol -= vec3(0.06,0.05,0.03) * stripe;

      gl_FragColor.rgb = barkCol * gl_FragColor.rgb / vec3(0.545,0.420,0.290);
      #include <dithering_fragment>`)
  }
  return mat
}

const leafAtlas = renderAtlas()
const leafMat = new THREE.MeshPhysicalMaterial({
  map: leafAtlas,
  transparent: true,
  alphaTest: 0.5,
  side: THREE.DoubleSide,
  roughness: 0.45,
  metalness: 0.0,
})
leafMat.onBeforeCompile = (shader) => {
  Object.entries(windUniforms).forEach(([k, v]) => { shader.uniforms[k] = v })
  shader.vertexShader = shader.vertexShader.replace('#include <common>',
    `#include <common>\nvarying vec3 vWorldPos;\n${WIND_UNIFORMS_GLSL}`)
  shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
    `#include <begin_vertex>
    #ifdef USE_INSTANCING
      vWorldPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
    #else
      vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
    #endif
    ${LEAF_WIND_GLSL}
    `)
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>',
    `#include <common>\nvarying vec3 vWorldPos;`)
  leafMat.userData.shader = shader
}

// ══════════════════════════════════════════════
//  Build scene
// ══════════════════════════════════════════════
const treeGroup = new THREE.Group()
scene.add(treeGroup)

const vizGroup = new THREE.Group() // dots, curves
scene.add(vizGroup)

function buildAll() {
  // Cleanup
  treeGroup.traverse(c => {
    if (c instanceof THREE.Mesh) { c.geometry.dispose() }
  })
  treeGroup.clear()
  vizGroup.traverse(c => {
    if (c instanceof THREE.Mesh || c instanceof THREE.Line || c instanceof THREE.Points) {
      ;(c as THREE.Mesh).geometry.dispose()
    }
  })
  vizGroup.clear()

  const seed = params.seed
  const { geo: trunkGeo, forkPos, forkTangent, forkRadius } = createTrunk(seed)
  updateWindUniforms()
  const trunkMat = createBarkMaterial('trunk')
  const barkMat = createBarkMaterial('branch')

  // Trunk (full height with fork bend)
  const trunkMesh = new THREE.Mesh(trunkGeo, trunkMat)
  trunkMesh.castShadow = true
  trunkMesh.visible = params.showBranches
  treeGroup.add(trunkMesh)

  // Fork branch as BranchInfo (same pipeline as all branches)
  const forkSpreadRad = params.forkSpreadAngle * Math.PI / 180
  const forkAzimuth = seeded01(seed + 37) * Math.PI * 2
  const spreadAxis = new THREE.Vector3().crossVectors(forkTangent, new THREE.Vector3(Math.cos(forkAzimuth), 0, Math.sin(forkAzimuth))).normalize()
  if (spreadAxis.length() < 0.001) spreadAxis.set(1, 0, 0)
  const forkDir = forkTangent.clone().applyAxisAngle(spreadAxis, forkSpreadRad).normalize()
  const forkBaseThick = forkRadius * params.forkBranchThickness

  const forkBranchInfo: BranchInfo = {
    startX: forkPos.x, startY: forkPos.y, startZ: forkPos.z,
    dirX: forkDir.x, dirY: forkDir.y, dirZ: forkDir.z,
    length: params.forkBranchLength,
    thickness: forkBaseThick,
    taper: params.forkBranchTaper,
    droop: params.forkBranchDroop,
    depth: -1,
    seed: seed + 2000,
    children: [],
  }

  const forkBranchGeo = createBranchGeo(forkBranchInfo)
  const forkMesh = new THREE.Mesh(forkBranchGeo, barkMat)
  forkMesh.castShadow = true
  forkMesh.visible = params.showBranches
  treeGroup.add(forkMesh)

  // Branches (hierarchical, distributed across trunk continuation + fork branch)
  const mainBranches = computeBranches(seed, forkPos, forkTangent, forkRadius, forkBranchInfo)
  const allBranches = flattenBranches(mainBranches)

  // Depth 0: individual tube meshes (curved, need unique geo)
  const mainOnly = allBranches.filter(b => b.depth === 0)
  for (const b of mainOnly) {
    const branchGeo = createBranchGeo(b)
    const mesh = new THREE.Mesh(branchGeo, barkMat)
    mesh.castShadow = true
    mesh.visible = params.showBranches
    treeGroup.add(mesh)
  }

  // Depth 1 & 2: InstancedMesh (unit cylinder + per-instance transform)
  for (const depth of [1, 2]) {
    const branchesAtDepth = allBranches.filter(b => b.depth === depth)
    if (branchesAtDepth.length === 0) continue

    // Unit cylinder: height=1, radius=1, tapered
    const unitGeo = new THREE.CylinderGeometry(0.3, 1, 1, 4, 1)

    const instancedMesh = new THREE.InstancedMesh(unitGeo, barkMat, branchesAtDepth.length)
    instancedMesh.castShadow = true
    instancedMesh.visible = params.showBranches

    const dummy = new THREE.Object3D()
    for (let i = 0; i < branchesAtDepth.length; i++) {
      const b = branchesAtDepth[i]

      // Position: midpoint of the branch
      const start = new THREE.Vector3(b.startX, b.startY, b.startZ)
      const end = getBranchPoint(b, 1)
      const mid = start.clone().add(end).multiplyScalar(0.5)
      dummy.position.copy(mid)

      // Rotation: orient Y-axis along branch direction
      const dir = end.clone().sub(start).normalize()
      const up = new THREE.Vector3(0, 1, 0)
      const quat = new THREE.Quaternion().setFromUnitVectors(up, dir)
      dummy.quaternion.copy(quat)

      // Scale: thickness for XZ, length for Y
      const length = start.distanceTo(end)
      dummy.scale.set(b.thickness, length, b.thickness)

      dummy.updateMatrix()
      instancedMesh.setMatrixAt(i, dummy.matrix)
    }
    instancedMesh.instanceMatrix.needsUpdate = true
    treeGroup.add(instancedMesh)
  }

  // Leaf placement: InstancedMesh + atlas
  const leafBranches = allBranches.filter(b => b.children.length === 0)
  const rand = seededRng(seed + 5000)

  // Pre-compute all leaf transforms
  interface LeafInstance { pos: THREE.Vector3; quat: THREE.Quaternion; scale: number }
  const leafInstances: LeafInstance[] = []
  const allDotPositions: number[] = []
  const allDotColors: number[] = []

  for (const b of leafBranches) {
    const { right, upLocal } = getBranchLocalFrame(b)
    const leafCount = params.leafPerBranch

    // Build CDF
    const endT = getEndT()
    const cdfSteps = 100
    const cdf: number[] = [0]
    for (let s = 1; s <= cdfSteps; s++) {
      cdf.push(cdf[s - 1] + getDensity((s / cdfSteps) * endT))
    }
    const cdfTotal = cdf[cdfSteps]
    for (let s = 0; s <= cdfSteps; s++) cdf[s] /= cdfTotal

    function sampleT(): number {
      const u = rand()
      for (let s = 1; s <= cdfSteps; s++) {
        if (cdf[s] >= u) {
          const prev = cdf[s - 1]
          const frac = (u - prev) / (cdf[s] - prev)
          return ((s - 1 + frac) / cdfSteps) * endT
        }
      }
      return endT
    }

    for (let j = 0; j < leafCount; j++) {
      const t = sampleT()

      const rH = getRadiusH(t)
      const rV = getRadiusV(t)
      const angle = rand() * Math.PI * 2
      const dist = Math.sqrt(rand())
      const offsetH = Math.cos(angle) * rH * dist
      const offsetV = Math.sin(angle) * rV * dist

      const branchPt = getBranchPoint(b, t)
      const pos = branchPt.clone()
        .addScaledVector(right, offsetH)
        .addScaledVector(upLocal, offsetV)

      // Dot colors
      const tNorm = Math.max(0, (t - params.startT) / (1 - params.startT))
      let cr: number, cg: number, cb: number
      if (tNorm < 0.4) { cr = 1; cg = tNorm / 0.4; cb = 0 }
      else if (tNorm < 0.6) { cr = 1 - (tNorm - 0.4) / 0.2; cg = 1; cb = 0 }
      else { cr = 0; cg = 1 - (tNorm - 0.6) / 0.4; cb = (tNorm - 0.6) / 0.4 }
      allDotPositions.push(pos.x, pos.y, pos.z)
      allDotColors.push(cr, cg, cb)

      // Compute orientation
      const dt = 0.02
      const p0 = getBranchPoint(b, Math.max(0, t - dt))
      const p1 = getBranchPoint(b, Math.min(1, t + dt))
      const tangent = p1.clone().sub(p0).normalize()

      const radial = right.clone().multiplyScalar(Math.cos(angle))
        .addScaledVector(upLocal, Math.sin(angle)).normalize()

      const worldUp = new THREE.Vector3(0, 1, 0)
      const upPerp = worldUp.clone().addScaledVector(tangent, -worldUp.dot(tangent))
      if (upPerp.length() < 0.001) upPerp.set(0, 1, 0)
      upPerp.normalize()

      const g = params.gravitropism
      const petioleBase = radial.clone().multiplyScalar(1 - g).addScaledVector(upPerp, g).normalize()

      const petioleRad = params.petioleAngle * Math.PI / 180
      const petioleAxis = new THREE.Vector3().crossVectors(tangent, petioleBase)
      if (petioleAxis.length() < 0.001) petioleAxis.crossVectors(tangent, worldUp)
      petioleAxis.normalize()
      const petioleDir = tangent.clone().applyAxisAngle(petioleAxis, petioleRad)

      const rollAngle = rand() * Math.PI * 2
      const rolledDir = petioleDir.clone().applyAxisAngle(tangent, rollAngle)

      const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), rolledDir)

      if (params.flatness > 0) {
        const leafZ = new THREE.Vector3(0, 0, 1).applyQuaternion(quat)
        const flatQuat = new THREE.Quaternion().setFromUnitVectors(leafZ, worldUp)
        flatQuat.slerp(new THREE.Quaternion(), 1 - params.flatness)
        quat.premultiply(flatQuat)
      }

      const jRad = params.tiltJitter * Math.PI / 180
      quat.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(
        (rand() - 0.5) * 2 * jRad,
        (rand() - 0.5) * 2 * jRad,
        (rand() - 0.5) * 2 * jRad,
      )))

      // Size variation ±20%
      const scale = 1.0 + (rand() - 0.5) * 0.4

      leafInstances.push({ pos, quat, scale })
    }

    // Curve visualization per branch
    if (params.showCurves) {
      const steps = 40
      const vizEndT = getEndT()

      const hPosA: THREE.Vector3[] = [], hPosB: THREE.Vector3[] = []
      const vPosA: THREE.Vector3[] = [], vPosB: THREE.Vector3[] = []
      for (let s = 0; s <= steps; s++) {
        const t = (s / steps) * vizEndT
        const bp = getBranchPoint(b, t)
        const radH = getRadiusH(t) * getDensity(t)
        const radV = getRadiusV(t) * getDensity(t)
        hPosA.push(bp.clone().addScaledVector(right, radH))
        hPosB.push(bp.clone().addScaledVector(right, -radH))
        vPosA.push(bp.clone().addScaledVector(upLocal, radV))
        vPosB.push(bp.clone().addScaledVector(upLocal, -radV))
      }
      const lineMatH = new THREE.LineBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.6 })
      const lineMatV = new THREE.LineBasicMaterial({ color: 0xcc44cc, transparent: true, opacity: 0.6 })
      vizGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(hPosA), lineMatH))
      vizGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(hPosB), lineMatH))
      vizGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(vPosA), lineMatV))
      vizGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(vPosB), lineMatV))
    }
  }

  // Create single InstancedMesh for all leaves
  if (params.showLeaves && leafInstances.length > 0) {
    const baseGeo = createLeaf3DGeo(seed)
    const instancedLeaves = new THREE.InstancedMesh(baseGeo, leafMat, leafInstances.length)
    instancedLeaves.castShadow = true

    const dummy = new THREE.Object3D()
    for (let i = 0; i < leafInstances.length; i++) {
      const { pos, quat, scale } = leafInstances[i]
      dummy.position.copy(pos)
      dummy.quaternion.copy(quat)
      const s = scale
      dummy.scale.set(s, s, s)
      dummy.updateMatrix()
      instancedLeaves.setMatrixAt(i, dummy.matrix)
    }
    instancedLeaves.instanceMatrix.needsUpdate = true
    treeGroup.add(instancedLeaves)
  }

  // Single dot visualization for all branches
  if (params.showDots && allDotPositions.length > 0) {
    const dotGeo = new THREE.BufferGeometry()
    dotGeo.setAttribute('position', new THREE.Float32BufferAttribute(allDotPositions, 3))
    dotGeo.setAttribute('color', new THREE.Float32BufferAttribute(allDotColors, 3))
    const dotMat = new THREE.PointsMaterial({ size: 0.04, vertexColors: true, sizeAttenuation: true })
    vizGroup.add(new THREE.Points(dotGeo, dotMat))
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

const forkF = gui.addFolder('분기')
forkF.add(params, 'forkHeight', 0.3, 0.8, 0.05).name('분기 높이').onChange(buildAll)
forkF.add(params, 'forkSpreadAngle', 10, 60, 1).name('벌어짐 (°)').onChange(buildAll)
forkF.add(params, 'trunkAfterForkBend', 0, 1.0, 0.05).name('줄기연장 휘어짐').onChange(buildAll)
forkF.add(params, 'forkBranchLength', 0.5, 4, 0.1).name('분기가지 길이').onChange(buildAll)
forkF.add(params, 'forkBranchThickness', 0.3, 1.0, 0.05).name('분기가지 두께비').onChange(buildAll)
forkF.add(params, 'forkBranchTaper', 0.1, 0.6, 0.05).name('분기가지 끝가늘어짐').onChange(buildAll)
forkF.add(params, 'forkBranchDroop', 0, 0.2, 0.005).name('분기가지 처짐').onChange(buildAll)
forkF.add(params, 'forkBranchBend', 0, 1.0, 0.05).name('분기가지 휘어짐').onChange(buildAll)

const mainBF = gui.addFolder('주가지')
mainBF.add(params, 'mainBranchCount', 1, 12, 1).name('주가지 수').onChange(buildAll)
mainBF.add(params, 'mainBranchStartT', 0.0, 0.8, 0.05).name('시작 위치').onChange(buildAll)
mainBF.add(params, 'mainBranchEndT', 0.2, 1.0, 0.05).name('끝 위치').onChange(buildAll)
mainBF.add(params, 'mainBranchLengthScale', 0.2, 0.8, 0.05).name('길이비').onChange(buildAll)
mainBF.add(params, 'mainBranchThicknessScale', 0.1, 0.8, 0.05).name('두께비').onChange(buildAll)
mainBF.add(params, 'mainBranchSpreadAngle', 15, 90, 1).name('벌림 (°)').onChange(buildAll)
mainBF.add(params, 'mainBranchDroop', 0, 0.2, 0.01).name('처짐').onChange(buildAll)

const branchF = gui.addFolder('잔가지 계층')
branchF.add(params, 'maxDepth', 0, 2, 1).name('계층 깊이').onChange(buildAll)
branchF.add(params, 'twigCount', 1, 12, 1).name('잔가지 수').onChange(buildAll)
branchF.add(params, 'twigLengthScale', 0.2, 0.8, 0.05).name('잔가지 길이비').onChange(buildAll)
branchF.add(params, 'twigSpreadAngle', 15, 90, 1).name('잔가지 벌림 (°)').onChange(buildAll)
branchF.add(params, 'twigThicknessScale', 0.1, 0.8, 0.05).name('잔가지 두께비').onChange(buildAll)
branchF.add(params, 'subTwigCount', 1, 10, 1).name('잔잔가지 수').onChange(buildAll)
branchF.add(params, 'subTwigLengthScale', 0.2, 0.8, 0.05).name('잔잔가지 길이비').onChange(buildAll)
branchF.add(params, 'subTwigSpreadAngle', 15, 90, 1).name('잔잔가지 벌림 (°)').onChange(buildAll)
branchF.add(params, 'subTwigThicknessScale', 0.1, 0.8, 0.05).name('잔잔가지 두께비').onChange(buildAll)

const curveF = gui.addFolder('배치 곡선')
curveF.add(params, 'startT', 0.0, 1.0, 0.05).name('시작 위치').onChange(buildAll)
curveF.add(params, 'peakT', 0.0, 1.5, 0.05).name('피크 위치').onChange(buildAll)
curveF.add(params, 'converge', 0.0, 1.0, 0.05).name('끝 수렴도').onChange(buildAll)
curveF.add(params, 'endExtend', 0.0, 3.0, 0.05).name('끝 연장').onChange(buildAll)
curveF.add(params, 'spreadRadiusH', 0.05, 0.6, 0.01).name('수평 반경').onChange(buildAll)
curveF.add(params, 'peakRadiusScaleH', 0.5, 3.0, 0.1).name('수평 피크 배율').onChange(buildAll)
curveF.add(params, 'spreadRadiusV', 0.05, 0.6, 0.01).name('수직 반경').onChange(buildAll)
curveF.add(params, 'peakRadiusScaleV', 0.5, 3.0, 0.1).name('수직 피크 배율').onChange(buildAll)

const leafF = gui.addFolder('잎')
leafF.add(params, 'leafPerBranch', 5, 300, 1).name('가지당 잎 수').onChange(buildAll)
leafF.add(params, 'leafWidth', 0.03, 0.2, 0.01).name('잎 너비').onChange(buildAll)
leafF.add(params, 'leafHeight', 0.05, 0.25, 0.01).name('잎 높이').onChange(buildAll)
leafF.add(params, 'petioleAngle', 0, 90, 1).name('잎자루 벌어짐 (°)').onChange(buildAll)
leafF.add(params, 'gravitropism', 0, 1, 0.05).name('향광성').onChange(buildAll)
leafF.add(params, 'flatness', 0, 1, 0.05).name('수평도').onChange(buildAll)
leafF.add(params, 'tiltJitter', 0, 45, 1).name('기울기 오차 (°)').onChange(buildAll)

const windF = gui.addFolder('바람')
windF.add(params, 'windEnabled').name('활성화').onChange(buildAll)
windF.add(params, 'windLayers', 0, 2, 1).name('레이어 (0=줄기/1=+가지/2=+잎)').onChange(updateWindUniforms)
windF.add(params, 'windAngle', 0, Math.PI * 2, 0.1).name('풍향').onChange(updateWindUniforms)
windF.add(params, 'windStrength', 0, 3, 0.1).name('풍속').onChange(updateWindUniforms)
windF.add(params, 'trunkSwaySpeed', 0.2, 4, 0.1).name('줄기 속도').onChange(updateWindUniforms)
windF.add(params, 'trunkSwayAmount', 0, 0.15, 0.005).name('줄기 진폭').onChange(updateWindUniforms)
windF.add(params, 'branchSwaySpeed', 0.5, 5, 0.1).name('가지 속도').onChange(updateWindUniforms)
windF.add(params, 'branchSwayAmount', 0, 0.1, 0.005).name('가지 진폭').onChange(updateWindUniforms)
windF.add(params, 'leafFlutterSpeed', 1, 10, 0.1).name('잎 속도').onChange(updateWindUniforms)
windF.add(params, 'leafFlutterAmount', 0, 0.05, 0.001).name('잎 진폭').onChange(updateWindUniforms)
windF.add(params, 'gustEnabled').name('돌풍')
windF.add(params, 'gustFrequency', 0.05, 1, 0.05).name('돌풍 빈도')
windF.add(params, 'gustStrength', 0, 3, 0.1).name('돌풍 강도')

const vizF = gui.addFolder('시각화')
vizF.add(params, 'showDots').name('배치 점').onChange(buildAll)
vizF.add(params, 'showBranches').name('가지/줄기').onChange(buildAll)
vizF.add(params, 'showLeaves').name('잎 메시').onChange(buildAll)
vizF.add(params, 'showCurves').name('밀도 곡선').onChange(buildAll)

// Close tree folders, keep wind open
genF.close(); forkF.close(); mainBF.close(); branchF.close()
curveF.close(); leafF.close(); vizF.close()
windF.open()

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

const clock = new THREE.Clock()
function animate() {
  requestAnimationFrame(animate)
  const elapsed = clock.getElapsedTime()

  // Wind
  if (params.windEnabled) {
    windUniforms.uTime.value = elapsed

    // Gust
    let gustMul = 1.0
    if (params.gustEnabled) {
      const gustPhase = elapsed * params.gustFrequency * Math.PI * 2
      const gust = Math.max(0, Math.sin(gustPhase) * Math.sin(gustPhase * 0.7)) * params.gustStrength
      windUniforms.uGustStrength.value = gust
      gustMul = 1.0 + gust
    } else {
      windUniforms.uGustStrength.value = 0
    }

    // Trunk sway: group rotation around base (rigid body)
    const swayAngle = Math.sin(elapsed * params.trunkSwaySpeed) * params.trunkSwayAmount * params.windStrength * gustMul
    const windDirX = Math.cos(params.windAngle)
    const windDirZ = Math.sin(params.windAngle)
    // Rotate around axis perpendicular to wind direction (tilt in wind direction)
    treeGroup.rotation.x = windDirZ * swayAngle
    treeGroup.rotation.z = -windDirX * swayAngle
  } else {
    treeGroup.rotation.x = 0
    treeGroup.rotation.z = 0
  }

  controls.update()
  const info = renderer.info.render
  infoDiv.innerHTML = `<span>seed: ${params.seed}</span><span>triangles: ${info.triangles.toLocaleString()}</span>`
  renderer.render(scene, camera)
}
animate()
