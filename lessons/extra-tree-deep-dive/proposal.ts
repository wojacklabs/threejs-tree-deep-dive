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
camera.position.set(0, 3, 6)

const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true
controls.target.set(0, 2, 0)

// 조명
const sun = new THREE.DirectionalLight(0xfff5e0, 2)
sun.position.set(3, 8, 4)
sun.castShadow = true
sun.shadow.mapSize.set(1024, 1024)
scene.add(sun)
scene.add(new THREE.HemisphereLight(0x87ceeb, 0x362907, 0.5))

// 바닥
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshStandardMaterial({ color: 0x2a4a1a, roughness: 0.9 })
)
floor.rotation.x = -Math.PI / 2
floor.receiveShadow = true
scene.add(floor)

// ── seeded random ──
function seeded(seed: number) {
  let s = seed
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
}

function noise3D(x: number, y: number, z: number) {
  return Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 0.5
}

// ══════════════════════════════════════════════
//  Phase별 줄기 생성
// ══════════════════════════════════════════════

const trunkColor = new THREE.Color(0x8b6b4a)

interface TrunkParams {
  height: number
  thickness: number
  taper: number
  bend: number
  twist: number
  segments: number
  heightSegments: number
  // Phase 2
  rootFlare: number
  // Phase 3
  grooveDepth: number
  grooveFreq: number
  knotCount: number
  knotSize: number
  // Phase 4
  branchSplit: boolean
  splitHeight: number
  splitAngle: number
  // Phase 5
  mossAmount: number
  colorVariation: number
}

const params: TrunkParams = {
  height: 3.5,
  thickness: 0.13,
  taper: 0.15,
  bend: 0.14,
  twist: 0,
  segments: 16,
  heightSegments: 24,
  rootFlare: 0.07,
  grooveDepth: 0.03,
  grooveFreq: 12,
  knotCount: 0,
  knotSize: 0,
  branchSplit: false,
  splitHeight: 0.6,
  splitAngle: 0.35,
  mossAmount: 0.3,
  colorVariation: 0.5,
}

let currentPhase = 1
let trunkMesh: THREE.Group | null = null
const seed = 42

function generateTrunk(p: TrunkParams, phase: number): THREE.Group {
  const group = new THREE.Group()
  const rand = seeded(seed)

  function buildCylinder(
    baseRadius: number, topRadius: number, height: number,
    radialSeg: number, heightSeg: number,
    offsetX = 0, offsetZ = 0, startY = 0, bendMul = 1
  ): THREE.BufferGeometry {
    const geo = new THREE.CylinderGeometry(topRadius, baseRadius, height, radialSeg, heightSeg)
    const pos = geo.attributes.position
    const uvs = geo.attributes.uv
    const colors = new Float32Array(pos.count * 4)

    // bend 방향을 나무 전체에서 1번만 결정 (vertex마다 다르면 안됨!)
    const bendDirX = (rand() - 0.3) * bendMul
    const bendDirZ = (rand() - 0.5) * 0.7 * bendMul

    // 옹이 위치를 미리 계산
    const knots: { y: number, angle: number }[] = []
    if (phase >= 3 && p.knotCount > 0) {
      for (let k = 0; k < p.knotCount; k++) {
        knots.push({
          y: (0.2 + seeded(seed + k * 100)() * 0.5) * height,
          angle: seeded(seed + k * 200)() * Math.PI * 2,
        })
      }
    }

    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
      const t = (y + height / 2) / height  // 0~1

      // Phase 2+: 뿌리 노출 (root flare)
      if (phase >= 2 && p.rootFlare > 0) {
        const rootT = Math.max(0, 1 - t * 4)  // 바닥 25%에만 적용
        const flare = 1 + rootT * rootT * p.rootFlare * 10
        x *= flare
        z *= flare
        // 뿌리 방향 비대칭 (vertex 각도 기반, rand 아님)
        const rootAngle = Math.atan2(z, x)
        const rootNoise = Math.sin(rootAngle * 3 + seed) * 0.3 + 0.7
        x *= 1 + rootT * rootNoise * p.rootFlare * 3
        z *= 1 + rootT * Math.cos(rootAngle * 5 + seed * 2) * p.rootFlare * 2
      }

      // 굽힘 (bend) — 같은 높이의 모든 vertex에 동일한 방향
      const bendT = t * t
      x += p.bend * bendT * bendDirX
      z += p.bend * bendT * bendDirZ

      // 비틀림 (twist)
      const twistAngle = p.twist * t
      const ct = Math.cos(twistAngle), st = Math.sin(twistAngle)
      const rx = x * ct - z * st
      const rz = x * st + z * ct
      x = rx; z = rz

      // Phase 3+: 세로 홈 (groove) — vertex 각도 기반 (결정적)
      if (phase >= 3 && p.grooveDepth > 0) {
        const angle = Math.atan2(z, x)
        const rawGroove = Math.sin(angle * p.grooveFreq + seed)
        // 부드러운 곡선으로 변환
        const groove = rawGroove * Math.abs(rawGroove) * p.grooveDepth
        const r = Math.sqrt(x * x + z * z)
        const heightFade = 1 - t * 0.5
        const newR = r + groove * heightFade
        if (r > 0.001) { x = x / r * newR; z = z / r * newR }
      }

      // Phase 3+: 옹이 (knot) — 미리 계산된 위치 사용
      for (const knot of knots) {
        const dy = (y + height / 2) - knot.y
        const knotRadius = height * 0.08
        if (Math.abs(dy) < knotRadius) {
          const knotStrength = (1 - Math.abs(dy) / knotRadius) * p.knotSize
          // 매끄러운 돌출 (cos 감쇠)
          const smooth = (Math.cos(dy / knotRadius * Math.PI) + 1) * 0.5
          x += Math.cos(knot.angle) * knotStrength * smooth
          z += Math.sin(knot.angle) * knotStrength * smooth
        }
      }

      pos.setXYZ(i, x + offsetX, y + startY + height / 2, z + offsetZ)

      // Phase 5: 색상
      const u = uvs ? uvs.getX(i) : 0
      const v = uvs ? uvs.getY(i) : t
      if (phase >= 4) {
        // 높이별 색상 변화
        const heightColor = 0.35 + t * 0.25
        let cr = heightColor + 0.15
        let cg = heightColor * 0.75
        let cb = heightColor * 0.5

        // 이끼 (바닥에 녹색)
        const mossNoise = noise3D(x * 4 + seed, y * 4, z * 4) * 0.5 + 0.5
        const mossHeight = Math.max(0, 1 - t * 2)  // 하단 50%에 적용
        const mossT = mossHeight * mossHeight * mossNoise * p.mossAmount
        cr = cr * (1 - mossT) + 0.15 * mossT
        cg = cg * (1 - mossT) + 0.35 * mossT
        cb = cb * (1 - mossT) + 0.1 * mossT

        // 세로 줄무늬 (나무껍질 결)
        const angle = Math.atan2(z - offsetZ, x - offsetX)
        const stripe = Math.sin(angle * 8 + noise3D(x * 3, y * 2, z * 3) * 3) * 0.5 + 0.5
        const stripeFactor = stripe * 0.2 * p.colorVariation
        cr -= stripeFactor * 0.5
        cg -= stripeFactor * 0.4
        cb -= stripeFactor * 0.3

        colors[i * 4] = Math.max(0, cr)
        colors[i * 4 + 1] = Math.max(0, cg)
        colors[i * 4 + 2] = Math.max(0, cb)
      } else {
        colors[i * 4] = trunkColor.r
        colors[i * 4 + 1] = trunkColor.g
        colors[i * 4 + 2] = trunkColor.b
      }
      // wind alpha
      colors[i * 4 + 3] = t * 0.25
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 4))
    geo.computeVertexNormals()
    return geo
  }

  // 단일 줄기 (분기는 가지 시스템이 담당)
  const geo = buildCylinder(
    p.thickness, p.thickness * p.taper, p.height,
    p.segments, p.heightSegments
  )
  const mesh = new THREE.Mesh(geo, createMaterial(phase))
  mesh.castShadow = true
  group.add(mesh)

  return group
}

function createMaterial(phase: number): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: phase >= 4 ? 0xffffff : 0x8b6b4a,
    vertexColors: phase >= 4,
    roughness: 0.95,
    metalness: 0.0,
    side: THREE.DoubleSide,
  })

  // Phase 5: wrap lighting 셰이더
  if (phase >= 4) {
    mat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <dithering_fragment>', `
        vec3 N = normalize(vNormal);
        vec3 ld = normalize(vec3(0.5, 1.0, 0.5));
        float w = 0.4;
        float ndl = clamp((dot(N, ld) + w) / (1.0 + w), 0.0, 1.0);
        float hemi = N.y * 0.5 + 0.5;
        float shade = mix(0.6, 1.1, ndl * 0.6 + hemi * 0.4);
        gl_FragColor.rgb *= shade;
        #include <dithering_fragment>
      `)
    }
  }

  return mat
}

// ── 라벨 ──
function createLabel(text: string, pos: THREE.Vector3, color = '#ffffff', scale = 2.5) {
  const c = document.createElement('canvas')
  c.width = 400; c.height = 64
  const ctx = c.getContext('2d')!
  ctx.fillStyle = color; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center'
  ctx.fillText(text, 200, 44)
  const tex = new THREE.CanvasTexture(c)
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }))
  sprite.position.copy(pos); sprite.scale.set(scale, 0.5, 1)
  return sprite
}

// ── 모든 Phase 나란히 표시 ──
const allTrunks: THREE.Group[] = []
const labels: THREE.Sprite[] = []

function buildAllPhases() {
  // 기존 제거
  allTrunks.forEach(g => {
    g.traverse(c => { if (c instanceof THREE.Mesh) { c.geometry.dispose(); (c.material as THREE.Material).dispose() } })
    scene.remove(g)
  })
  allTrunks.length = 0
  labels.forEach(l => scene.remove(l))
  labels.length = 0

  const phaseNames = [
    'Phase 1\n기본 교체',
    'Phase 2\n뿌리 노출',
    'Phase 3\n표면 질감',
    'Phase 4\n셰이더 색상',
  ]

  const spacing = 3.5

  for (let i = 0; i < 4; i++) {
    const phase = i + 1
    const phaseParams = { ...params }

    // 각 phase에서 이전 phase 기능도 포함
    if (phase < 2) phaseParams.rootFlare = 0
    if (phase < 3) { phaseParams.grooveDepth = 0; phaseParams.knotCount = 0 }
    if (phase < 4) { phaseParams.mossAmount = 0; phaseParams.colorVariation = 0 }

    const trunk = generateTrunk(phaseParams, phase)
    trunk.position.set((i - 1.5) * spacing, 0, 0)
    scene.add(trunk)
    allTrunks.push(trunk)

    // Phase 라벨
    const lines = phaseNames[i].split('\n')
    const l1 = createLabel(lines[0], new THREE.Vector3((i - 1.5) * spacing, params.height + 1.2, 0), '#58a6ff')
    scene.add(l1); labels.push(l1)
    const l2 = createLabel(lines[1], new THREE.Vector3((i - 1.5) * spacing, params.height + 0.7, 0), '#8b949e')
    scene.add(l2); labels.push(l2)

    // 현재 선택된 phase 강조
    if (phase === currentPhase) {
      const highlight = createLabel('▼ 현재 편집 중 ▼', new THREE.Vector3((i - 1.5) * spacing, params.height + 1.7, 0), '#7ee787')
      scene.add(highlight); labels.push(highlight)
    }
  }
}

buildAllPhases()

// ══════════════════════════════════════════════
//  lil-gui
// ══════════════════════════════════════════════
const gui = new GUI({ width: 280 })
gui.domElement.style.position = 'absolute'
gui.domElement.style.top = '48px'
gui.domElement.style.right = '0'
canvas.parentElement!.appendChild(gui.domElement)

const phaseControl = { phase: 1 }
gui.add(phaseControl, 'phase', { 'Phase 1: 기본 교체': 1, 'Phase 2: 뿌리 노출': 2, 'Phase 3: 표면 질감': 3, 'Phase 4: 셰이더 색상': 4 })
  .name('편집 Phase').onChange((v: number) => { currentPhase = v; buildAllPhases() })

const baseFolder = gui.addFolder('기본 형태')
baseFolder.add(params, 'height', 1, 6, 0.1).onChange(buildAllPhases)
baseFolder.add(params, 'thickness', 0.03, 0.2, 0.005).onChange(buildAllPhases)
baseFolder.add(params, 'taper', 0.1, 0.8, 0.05).onChange(buildAllPhases)
baseFolder.add(params, 'bend', 0, 0.6, 0.02).onChange(buildAllPhases)
baseFolder.add(params, 'twist', 0, 1.5, 0.05).onChange(buildAllPhases)

const rootFolder = gui.addFolder('Phase 2: 뿌리')
rootFolder.add(params, 'rootFlare', 0, 0.4, 0.01).name('뿌리 벌어짐').onChange(buildAllPhases)

const textureFolder = gui.addFolder('Phase 3: 질감')
textureFolder.add(params, 'grooveDepth', 0, 0.03, 0.001).name('홈 깊이').onChange(buildAllPhases)
textureFolder.add(params, 'grooveFreq', 2, 12, 1).name('홈 개수').onChange(buildAllPhases)
textureFolder.add(params, 'knotCount', 0, 5, 1).name('옹이 수').onChange(buildAllPhases)
textureFolder.add(params, 'knotSize', 0, 0.06, 0.005).name('옹이 크기').onChange(buildAllPhases)

const colorFolder = gui.addFolder('Phase 4: 색상')
colorFolder.add(params, 'mossAmount', 0, 1, 0.05).name('이끼').onChange(buildAllPhases)
colorFolder.add(params, 'colorVariation', 0, 1, 0.05).name('줄무늬').onChange(buildAllPhases)

// ── 정보 ──
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

// ── Animate ──
function animate() {
  requestAnimationFrame(animate)
  controls.update()

  const info = renderer.info.render
  infoDiv.innerHTML = `
    <span>phase: ${currentPhase}</span>
    <span>triangles: ${info.triangles.toLocaleString()}</span>
  `

  renderer.render(scene, camera)
}
animate()
