import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import GUI from 'lil-gui'

const canvas = document.getElementById('c') as HTMLCanvasElement
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setClearColor(0x1a1a2e)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
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

function seeded(s: number) {
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

// ══════════════════════════════════════════════
//  파라미터
// ══════════════════════════════════════════════
const params = {
  seed: 42,
  treeCount: 5,
  spacing: 4,

  // 일반 가지
  branchCount: 5,
  branchStartHeight: 0.6,
  branchLengthMin: 0.4,
  branchLengthMax: 0.85,
  branchThickness: 0.03,
  branchDroop: 0.03,
  branchTwist: 0.0,
  branchGrooveDepth: 0.0,
  branchGrooveFreq: 6,
  branchJitter: 0.0,

  // 굵은 분기 가지
  forkChance: 0.25,
  forkHeightMin: 0.45,
  forkHeightMax: 0.65,
  forkThicknessRatio: 0.6,
  forkLength: 0.9,
  forkAngle: 0.75,
  forkDroop: 0.02,
  forkTaper: 0.15,

  // 잎
  leafClusters: 3,
  leafSize: 0.1,
}

// ══════════════════════════════════════════════
//  줄기 생성
// ══════════════════════════════════════════════
function createTrunk(seed: number) {
  const h = 3.5, thick = 0.13, taper = 0.15, bendAmt = 0.14, rootFlare = 0.07
  const grooveD = 0.03, grooveF = 12
  const geo = new THREE.CylinderGeometry(thick * taper, thick, h, 16, 24)
  const pos = geo.attributes.position
  const rand = seeded(seed)
  const bendDirX = (rand() - 0.3), bendDirZ = (rand() - 0.5) * 0.7

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
    const t = (y + h / 2) / h
    const rootT = Math.max(0, 1 - t * 4)
    const flare = 1 + rootT * rootT * rootFlare * 10
    const rAngle = Math.atan2(z, x)
    x *= flare * (1 + rootT * Math.sin(rAngle * 3 + seed) * 0.3 * rootFlare * 3)
    z *= flare
    x += bendAmt * t * t * bendDirX
    z += bendAmt * t * t * bendDirZ
    const angle = Math.atan2(z, x)
    const groove = Math.sin(angle * grooveF + seed) * Math.abs(Math.sin(angle * grooveF + seed)) * grooveD
    const r = Math.sqrt(x * x + z * z)
    if (r > 0.001) { const nr = r + groove * (1 - t * 0.5); x = x / r * nr; z = z / r * nr }
    pos.setXYZ(i, x, y, z)
  }
  geo.computeVertexNormals()
  geo.translate(0, h / 2, 0)

  return { geo, trunkHeight: h, trunkThick: thick, trunkTaper: taper, bendDirX, bendDirZ, bendAmt }
}

// ══════════════════════════════════════════════
//  일반 가지 + 굵은 분기 생성
// ══════════════════════════════════════════════
function createBranchSystem(trunkData: ReturnType<typeof createTrunk>, seed: number): THREE.BufferGeometry[] {
  const { trunkHeight, trunkThick, trunkTaper, bendDirX, bendDirZ, bendAmt } = trunkData
  const geos: THREE.BufferGeometry[] = []
  const leafGeos: THREE.BufferGeometry[] = []
  const rand = seeded(seed + 1000)

  // 줄기에서의 시작점 계산 헬퍼
  function getBranchAttachment(branchY: number, azimuth: number, penetration: number) {
    const t = branchY / trunkHeight
    const trunkRadiusAtY = trunkThick * (1 - t * (1 - trunkTaper))
    const bendOffX = bendAmt * t * t * bendDirX
    const bendOffZ = bendAmt * t * t * bendDirZ
    return {
      x: bendOffX + Math.cos(azimuth) * trunkRadiusAtY * penetration,
      z: bendOffZ + Math.sin(azimuth) * trunkRadiusAtY * penetration,
      radius: trunkRadiusAtY,
    }
  }

  // ── 굵은 분기 가지 (확률적) ──
  const hasFork = rand() < params.forkChance
  let forkY = 0, forkAzimuth = 0

  if (hasFork) {
    forkY = trunkHeight * (params.forkHeightMin + rand() * (params.forkHeightMax - params.forkHeightMin))
    forkAzimuth = rand() * Math.PI * 2

    const forkThick = trunkThick * params.forkThicknessRatio
    const forkLen = params.forkLength
    const attach = getBranchAttachment(forkY, forkAzimuth, 0.4) // 깊이 겹침

    // 분기 방향: 줄기에서 바깥+위로
    const forkDirX = Math.cos(forkAzimuth) * Math.cos(params.forkAngle)
    const forkDirY = Math.sin(params.forkAngle)
    const forkDirZ = Math.sin(forkAzimuth) * Math.cos(params.forkAngle)

    const forkEndX = attach.x + forkDirX * forkLen
    const forkEndY = forkY + forkDirY * forkLen
    const forkEndZ = attach.z + forkDirZ * forkLen

    const centerX = (attach.x + forkEndX) / 2
    const centerY = (forkY + forkEndY) / 2
    const centerZ = (attach.z + forkEndZ) / 2

    const forkGeo = new THREE.CylinderGeometry(
      forkThick * params.forkTaper, forkThick, forkLen, 8, 8
    )

    // 처짐
    const fPos = forkGeo.attributes.position
    for (let vi = 0; vi < fPos.count; vi++) {
      const by = fPos.getY(vi)
      const bt = (by + forkLen / 2) / forkLen
      fPos.setY(vi, by - params.forkDroop * bt * bt * forkLen)
    }
    forkGeo.computeVertexNormals()

    // 회전
    const dir = new THREE.Vector3(forkDirX, forkDirY, forkDirZ).normalize()
    const up = new THREE.Vector3(0, 1, 0)
    const quat = new THREE.Quaternion()
    const dot = up.dot(dir)
    if (Math.abs(dot - 1) > 0.001) {
      const axis = new THREE.Vector3().crossVectors(up, dir).normalize()
      quat.setFromAxisAngle(axis, Math.acos(Math.max(-1, Math.min(1, dot))))
    }
    const matrix = new THREE.Matrix4().makeRotationFromQuaternion(quat)
    matrix.setPosition(centerX, centerY, centerZ)
    forkGeo.applyMatrix4(matrix)
    geos.push(forkGeo)

    // 분기 끝에 잎 클러스터
    for (let c = 0; c < params.leafClusters + 2; c++) {
      const leafGeo = new THREE.IcosahedronGeometry(params.leafSize * 2.5 + rand() * params.leafSize, 1)
      leafGeo.translate(
        forkEndX + (rand() - 0.5) * 0.3,
        forkEndY - params.forkDroop * forkLen + (rand() - 0.5) * 0.2,
        forkEndZ + (rand() - 0.5) * 0.3
      )
      leafGeos.push(leafGeo)
    }
  }

  // ── 일반 가지 ──
  for (let i = 0; i < params.branchCount; i++) {
    const heightRatio = i / Math.max(params.branchCount - 1, 1)
    const branchStartY = params.branchStartHeight * trunkHeight
    const branchY = branchStartY + heightRatio * (trunkHeight * 0.85 - branchStartY)
    const bSeed = seed + i * 137
    const azimuth = i * GOLDEN_ANGLE + (seeded(bSeed)() - 0.5) * 0.4

    // 분기 가지 근처면 건너뛰기 (겹침 방지)
    if (hasFork && Math.abs(branchY - forkY) < trunkHeight * 0.1 &&
        Math.abs(azimuth - forkAzimuth) < 0.8) continue

    const length = (params.branchLengthMin + seeded(bSeed + 1)() * (params.branchLengthMax - params.branchLengthMin)) * (1.15 - heightRatio * 0.4)
    const bThick = params.branchThickness * (1.2 - heightRatio * 0.3)

    const vertAngle = 0.35 + heightRatio * 0.35 + seeded(bSeed + 2)() * 0.25
    const cosV = Math.cos(vertAngle)
    const sinV = Math.sin(vertAngle)
    const branchDirX = Math.cos(azimuth) * cosV
    const branchDirY = sinV
    const branchDirZ = Math.sin(azimuth) * cosV

    const attach = getBranchAttachment(branchY, azimuth, 0.6)
    const baseThick = Math.max(bThick, attach.radius * 0.4)

    const endX = attach.x + branchDirX * length
    const endY = branchY + branchDirY * length
    const endZ = attach.z + branchDirZ * length
    const cx = (attach.x + endX) / 2, cy = (branchY + endY) / 2, cz = (attach.z + endZ) / 2

    // 세그먼트 수를 높여서 변형이 부드럽게 보이게
    const bSegs = params.branchTwist > 0 || params.branchGrooveDepth > 0 || params.branchJitter > 0 ? 12 : 6
    const bHSegs = params.branchTwist > 0 || params.branchGrooveDepth > 0 || params.branchJitter > 0 ? 8 : 4
    const branchGeo = new THREE.CylinderGeometry(bThick * 0.3, baseThick, length, bSegs, bHSegs)
    const bPos = branchGeo.attributes.position
    const droopAmt = params.branchDroop + seeded(bSeed + 3)() * 0.08
    const bRand = seeded(bSeed + 100)

    for (let vi = 0; vi < bPos.count; vi++) {
      let bx = bPos.getX(vi), by = bPos.getY(vi), bz = bPos.getZ(vi)
      const bt = (by + length / 2) / length // 0(base)~1(tip)

      // 처짐
      by -= droopAmt * bt * bt * length

      // 비틀림 (twist)
      if (params.branchTwist > 0) {
        const twistAngle = params.branchTwist * bt
        const ct = Math.cos(twistAngle), st = Math.sin(twistAngle)
        const rx = bx * ct - bz * st
        const rz = bx * st + bz * ct
        bx = rx; bz = rz
      }

      // 세로 홈 (groove)
      if (params.branchGrooveDepth > 0) {
        const angle = Math.atan2(bz, bx)
        const groove = Math.sin(angle * params.branchGrooveFreq + bSeed) *
                       Math.abs(Math.sin(angle * params.branchGrooveFreq + bSeed)) *
                       params.branchGrooveDepth
        const r = Math.sqrt(bx * bx + bz * bz)
        if (r > 0.001) {
          const newR = r + groove * (1 - bt * 0.5)
          bx = bx / r * newR; bz = bz / r * newR
        }
      }

      // 지터 (jitter)
      if (params.branchJitter > 0) {
        bx += Math.sin(bSeed + vi * 13.37) * params.branchJitter * length
        bz += Math.cos(bSeed + vi * 7.11) * params.branchJitter * length
      }

      bPos.setXYZ(vi, bx, by, bz)
    }
    branchGeo.computeVertexNormals()

    const dir = new THREE.Vector3(branchDirX, branchDirY, branchDirZ).normalize()
    const up = new THREE.Vector3(0, 1, 0)
    const quat = new THREE.Quaternion()
    const dotUp = up.dot(dir)
    if (Math.abs(dotUp - 1) > 0.001) {
      const axis = new THREE.Vector3().crossVectors(up, dir).normalize()
      quat.setFromAxisAngle(axis, Math.acos(Math.max(-1, Math.min(1, dotUp))))
    }
    const matrix = new THREE.Matrix4().makeRotationFromQuaternion(quat)
    matrix.setPosition(cx, cy, cz)
    branchGeo.applyMatrix4(matrix)
    geos.push(branchGeo)

    // 잎 클러스터
    for (let c = 0; c < params.leafClusters; c++) {
      const leafGeo = new THREE.IcosahedronGeometry(params.leafSize * 1.5 + rand() * params.leafSize, 1)
      leafGeo.translate(
        endX + (rand() - 0.5) * 0.15,
        endY - droopAmt * length + (rand() - 0.5) * 0.1,
        endZ + (rand() - 0.5) * 0.15
      )
      leafGeos.push(leafGeo)
    }
  }

  return { branches: geos, leaves: leafGeos }
}

// ══════════════════════════════════════════════
//  나무껍질 Normal Map + Shader 색상 Material
// ══════════════════════════════════════════════
function generateBarkNormalMap(): THREE.CanvasTexture {
  const w = 256, h = 256
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(w, h)

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w, v = y / h
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

function createBarkMaterial(normalMap: THREE.CanvasTexture): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x8b6b4a,
    roughness: 0.95,
    metalness: 0,
    normalMap,
    normalScale: new THREE.Vector2(1.5, 1.5),
  })

  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
      varying vec2 vBarkUv;
      varying vec3 vLocalPos;`
    )
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vBarkUv = uv;
      vLocalPos = position;`
    )

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
      varying vec2 vBarkUv;
      varying vec3 vLocalPos;
      float barkHash2(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float barkNoise2(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(barkHash2(i), barkHash2(i+vec2(1,0)), f.x),
                   mix(barkHash2(i+vec2(0,1)), barkHash2(i+vec2(1,1)), f.x), f.y);
      }`
    )

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `
      float heightT = vBarkUv.y;

      // 높이별 그라데이션
      vec3 darkBark = vec3(0.35, 0.25, 0.15);
      vec3 lightBark = vec3(0.6, 0.48, 0.32);
      vec3 barkCol = mix(darkBark, lightBark, heightT);

      // 이끼 (하단 녹색)
      float mossN = barkNoise2(vLocalPos.xz * 6.0 + vec2(42.0));
      float mossH = max(0.0, 1.0 - heightT * 2.0);
      float moss = mossH * mossH * mossN * 0.8;
      barkCol = mix(barkCol, vec3(0.15, 0.35, 0.1), moss);

      // 세로 줄무늬
      float stripe = sin(vBarkUv.x * 3.14159 * 16.0 + barkNoise2(vLocalPos.xy * 4.0) * 4.0);
      stripe = stripe * 0.5 + 0.5;
      barkCol -= vec3(0.06, 0.05, 0.03) * stripe;

      gl_FragColor.rgb = barkCol * gl_FragColor.rgb / vec3(0.545, 0.420, 0.290);

      #include <dithering_fragment>
      `
    )
  }

  return mat
}

// ══════════════════════════════════════════════
//  나무 전체 빌드
// ══════════════════════════════════════════════
const treeGroup = new THREE.Group()
scene.add(treeGroup)

function buildAll() {
  treeGroup.traverse(c => {
    if (c instanceof THREE.Mesh) { c.geometry.dispose(); (c.material as THREE.Material).dispose() }
  })
  treeGroup.clear()

  const barkNormalMap = generateBarkNormalMap()
  const trunkMat = createBarkMaterial(barkNormalMap)
  const branchMat = createBarkMaterial(barkNormalMap)
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x3a8a1a, roughness: 0.85, side: THREE.DoubleSide,
  })

  for (let t = 0; t < params.treeCount; t++) {
    const treeSeed = params.seed + t * 73
    const trunkData = createTrunk(treeSeed)

    const trunkMesh = new THREE.Mesh(trunkData.geo, trunkMat.clone())
    trunkMesh.castShadow = true
    const xPos = (t - (params.treeCount - 1) / 2) * params.spacing
    trunkMesh.position.set(xPos, 0, 0)
    treeGroup.add(trunkMesh)

    const { branches, leaves } = createBranchSystem(trunkData, treeSeed)
    for (const geo of branches) {
      const mesh = new THREE.Mesh(geo, branchMat.clone())
      mesh.castShadow = true
      mesh.position.set(xPos, 0, 0)
      treeGroup.add(mesh)
    }
    for (const geo of leaves) {
      const lm = leafMat.clone()
      lm.color.setHSL(0.25 + Math.random() * 0.08, 0.6, 0.3 + Math.random() * 0.15)
      const mesh = new THREE.Mesh(geo, lm)
      mesh.castShadow = true
      mesh.position.set(xPos, 0, 0)
      treeGroup.add(mesh)
    }

    // 분기 여부 라벨
    const rand = seeded(treeSeed + 1000)
    const hasFork = rand() < params.forkChance
    const labelC = document.createElement('canvas')
    labelC.width = 200; labelC.height = 40
    const ctx = labelC.getContext('2d')!
    ctx.fillStyle = hasFork ? '#7ee787' : '#8b949e'
    ctx.font = 'bold 16px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(hasFork ? '분기 있음' : '분기 없음', 100, 28)
    const tex = new THREE.CanvasTexture(labelC)
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }))
    sprite.position.set(xPos, -0.3, 0)
    sprite.scale.set(1.5, 0.4, 1)
    treeGroup.add(sprite)
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

const genFolder = gui.addFolder('생성')
genFolder.add(params, 'seed', 0, 500, 1).name('시드').onChange(buildAll)
genFolder.add(params, 'treeCount', 1, 8, 1).name('나무 수').onChange(buildAll)
genFolder.add({ randomize: () => { params.seed = Math.floor(Math.random() * 500); buildAll(); gui.controllersRecursive().forEach(c => c.updateDisplay()) } }, 'randomize').name('🎲 랜덤 시드')

const forkFolder = gui.addFolder('굵은 분기')
forkFolder.add(params, 'forkChance', 0, 1, 0.05).name('분기 확률').onChange(buildAll)
forkFolder.add(params, 'forkHeightMin', 0.15, 0.5, 0.05).name('최소 높이').onChange(buildAll)
forkFolder.add(params, 'forkHeightMax', 0.3, 0.7, 0.05).name('최대 높이').onChange(buildAll)
forkFolder.add(params, 'forkThicknessRatio', 0.2, 0.8, 0.05).name('굵기 비율').onChange(buildAll)
forkFolder.add(params, 'forkLength', 0.5, 3, 0.1).name('분기 길이').onChange(buildAll)
forkFolder.add(params, 'forkAngle', 0.2, 1.2, 0.05).name('벌어짐 각도').onChange(buildAll)
forkFolder.add(params, 'forkDroop', 0, 0.2, 0.01).name('분기 처짐').onChange(buildAll)
forkFolder.add(params, 'forkTaper', 0.1, 0.6, 0.05).name('끝 가늘어짐').onChange(buildAll)

const branchFolder = gui.addFolder('일반 가지')
branchFolder.add(params, 'branchCount', 2, 10, 1).name('가지 수').onChange(buildAll)
branchFolder.add(params, 'branchStartHeight', 0.2, 0.6, 0.05).name('시작 높이').onChange(buildAll)
branchFolder.add(params, 'branchLengthMin', 0.1, 0.8, 0.05).name('최소 길이').onChange(buildAll)
branchFolder.add(params, 'branchLengthMax', 0.3, 1.5, 0.05).name('최대 길이').onChange(buildAll)
branchFolder.add(params, 'branchThickness', 0.01, 0.06, 0.005).name('두께').onChange(buildAll)
branchFolder.add(params, 'branchDroop', 0, 0.3, 0.01).name('처짐').onChange(buildAll)
branchFolder.add(params, 'branchTwist', 0, 1.0, 0.05).name('비틀림').onChange(buildAll)
branchFolder.add(params, 'branchGrooveDepth', 0, 0.01, 0.001).name('홈 깊이').onChange(buildAll)
branchFolder.add(params, 'branchGrooveFreq', 2, 12, 1).name('홈 개수').onChange(buildAll)
branchFolder.add(params, 'branchJitter', 0, 0.02, 0.001).name('지터').onChange(buildAll)

const leafFolder = gui.addFolder('잎')
leafFolder.add(params, 'leafClusters', 0, 6, 1).name('클러스터 수').onChange(buildAll)
leafFolder.add(params, 'leafSize', 0.03, 0.2, 0.01).name('잎 크기').onChange(buildAll)

// ── info ──
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
