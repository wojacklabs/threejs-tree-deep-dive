import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const canvas = document.getElementById('c') as HTMLCanvasElement
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setClearColor(0x0d1117)
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.0

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
camera.position.set(0, 2, 6)

const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true

// ── 프로시져럴 환경맵 생성 (CubeTexture 대체) ──
function createGradientEnvMap(): THREE.CubeTexture {
  const size = 256
  const faces: HTMLCanvasElement[] = []

  // 6면을 그라데이션으로 생성 (px, nx, py, ny, pz, nz)
  const faceColors: [string, string][] = [
    ['#1a3a5c', '#0a1a2c'], // +X (오른쪽) — 진한 파랑
    ['#2c1a3a', '#1a0a2c'], // -X (왼쪽) — 보라
    ['#87ceeb', '#4a90c4'], // +Y (위) — 하늘
    ['#2a1a0a', '#1a1a1a'], // -Y (아래) — 어두운 땅
    ['#1a3a5c', '#0a1a2c'], // +Z (앞) — 진한 파랑
    ['#3a2a1a', '#1a1a2c'], // -Z (뒤) — 따뜻한 갈색
  ]

  for (const [top, bottom] of faceColors) {
    const c = document.createElement('canvas')
    c.width = size
    c.height = size
    const ctx = c.getContext('2d')!
    const gradient = ctx.createLinearGradient(0, 0, 0, size)
    gradient.addColorStop(0, top)
    gradient.addColorStop(1, bottom)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)

    // 별 효과 (상단 면에만)
    if (top === '#87ceeb') {
      // 하늘이므로 별 대신 구름 느낌
      for (let i = 0; i < 20; i++) {
        const x = Math.random() * size
        const y = Math.random() * size
        const r = 10 + Math.random() * 20
        ctx.fillStyle = `rgba(255,255,255,${0.05 + Math.random() * 0.1})`
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
      }
    } else {
      // 다른 면에 별 추가
      for (let i = 0; i < 30; i++) {
        const x = Math.random() * size
        const y = Math.random() * size
        ctx.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.7})`
        ctx.fillRect(x, y, 1, 1)
      }
    }
    faces.push(c)
  }

  const cubeTexture = new THREE.CubeTexture(faces)
  cubeTexture.needsUpdate = true
  return cubeTexture
}

// 더 밝은 환경맵 (반사용)
function createBrightEnvMap(): THREE.CubeTexture {
  const size = 256
  const faces: HTMLCanvasElement[] = []
  const faceColors: [string, string][] = [
    ['#4a7aac', '#2a4a6c'],
    ['#6c4a7a', '#4a2a6c'],
    ['#c7eeff', '#7ab4e4'],
    ['#4a3a2a', '#2a2a2a'],
    ['#4a7aac', '#2a4a6c'],
    ['#7a6a4a', '#4a4a6c'],
  ]

  for (const [top, bottom] of faceColors) {
    const c = document.createElement('canvas')
    c.width = size
    c.height = size
    const ctx = c.getContext('2d')!
    const gradient = ctx.createLinearGradient(0, 0, 0, size)
    gradient.addColorStop(0, top)
    gradient.addColorStop(1, bottom)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
    faces.push(c)
  }

  const cubeTexture = new THREE.CubeTexture(faces)
  cubeTexture.needsUpdate = true
  return cubeTexture
}

const envMap = createGradientEnvMap()
const brightEnvMap = createBrightEnvMap()

// ── 배경으로 설정 ──
scene.background = envMap
scene.environment = brightEnvMap  // 모든 PBR material에 자동 적용

// 조명
const dirLight = new THREE.DirectionalLight(0xffffff, 1.5)
dirLight.position.set(3, 5, 4)
scene.add(dirLight)
const ambient = new THREE.AmbientLight(0xffffff, 0.3)
scene.add(ambient)

// ── 라벨 ──
function createLabel(text: string, position: THREE.Vector3, color = '#ffffff') {
  const c = document.createElement('canvas')
  c.width = 400
  c.height = 64
  const ctx = c.getContext('2d')!
  ctx.fillStyle = color
  ctx.font = 'bold 22px monospace'
  ctx.textAlign = 'center'
  ctx.fillText(text, 200, 44)
  const texture = new THREE.CanvasTexture(c)
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true })
  )
  sprite.position.copy(position)
  sprite.scale.set(3, 0.5, 1)
  scene.add(sprite)
}

// ══════════════════════════════════════════════
//  섹션 1: 금속 반사 (metalness + envMap)
// ══════════════════════════════════════════════

// 완전 금속 (크롬)
const chrome = new THREE.Mesh(
  new THREE.SphereGeometry(0.7, 64, 32),
  new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 1.0,
    roughness: 0.0,
  })
)
chrome.position.set(-3, 0.7, 0)
scene.add(chrome)
createLabel('chrome', new THREE.Vector3(-3, 2, 0))
createLabel('metal:1 rough:0', new THREE.Vector3(-3, -0.5, 0), '#8b949e')

// 금
const gold = new THREE.Mesh(
  new THREE.SphereGeometry(0.7, 64, 32),
  new THREE.MeshStandardMaterial({
    color: 0xffd700,
    metalness: 1.0,
    roughness: 0.2,
  })
)
gold.position.set(-1, 0.7, 0)
scene.add(gold)
createLabel('gold', new THREE.Vector3(-1, 2, 0))
createLabel('metal:1 rough:0.2', new THREE.Vector3(-1, -0.5, 0), '#8b949e')

// 브러시드 알루미늄
const aluminum = new THREE.Mesh(
  new THREE.SphereGeometry(0.7, 64, 32),
  new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    metalness: 0.9,
    roughness: 0.5,
  })
)
aluminum.position.set(1, 0.7, 0)
scene.add(aluminum)
createLabel('aluminum', new THREE.Vector3(1, 2, 0))
createLabel('metal:0.9 rough:0.5', new THREE.Vector3(1, -0.5, 0), '#8b949e')

// 구리
const copper = new THREE.Mesh(
  new THREE.SphereGeometry(0.7, 64, 32),
  new THREE.MeshStandardMaterial({
    color: 0xb87333,
    metalness: 1.0,
    roughness: 0.3,
  })
)
copper.position.set(3, 0.7, 0)
scene.add(copper)
createLabel('copper', new THREE.Vector3(3, 2, 0))
createLabel('metal:1 rough:0.3', new THREE.Vector3(3, -0.5, 0), '#8b949e')

// ══════════════════════════════════════════════
//  섹션 2: 유리 / 투명 재질
// ══════════════════════════════════════════════

// 유리 구체
const glass = new THREE.Mesh(
  new THREE.SphereGeometry(0.7, 64, 32),
  new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0.0,
    roughness: 0.0,
    transmission: 1.0,     // 투과율 (유리)
    thickness: 1.5,        // 두께 (굴절에 영향)
    ior: 1.5,              // 굴절률 (유리 = 1.5)
  })
)
glass.position.set(-2, 0.7, -3)
scene.add(glass)
createLabel('glass', new THREE.Vector3(-2, 2, -3))
createLabel('transmission:1 ior:1.5', new THREE.Vector3(-2, -0.5, -3), '#8b949e')

// 착색 유리
const tintedGlass = new THREE.Mesh(
  new THREE.SphereGeometry(0.7, 64, 32),
  new THREE.MeshPhysicalMaterial({
    color: 0x4488ff,
    metalness: 0.0,
    roughness: 0.1,
    transmission: 0.9,
    thickness: 1.0,
    ior: 1.5,
  })
)
tintedGlass.position.set(0, 0.7, -3)
scene.add(tintedGlass)
createLabel('tinted glass', new THREE.Vector3(0, 2, -3))
createLabel('color + transmission', new THREE.Vector3(0, -0.5, -3), '#8b949e')

// 다이아몬드 (높은 IOR)
const diamond = new THREE.Mesh(
  new THREE.SphereGeometry(0.7, 64, 32),
  new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0.0,
    roughness: 0.0,
    transmission: 1.0,
    thickness: 1.5,
    ior: 2.42,  // 다이아몬드 굴절률
  })
)
diamond.position.set(2, 0.7, -3)
scene.add(diamond)
createLabel('diamond', new THREE.Vector3(2, 2, -3))
createLabel('ior:2.42', new THREE.Vector3(2, -0.5, -3), '#8b949e')

// ══════════════════════════════════════════════
//  섹션 3: envMap 유무 비교
// ══════════════════════════════════════════════

const noEnvSphere = new THREE.Mesh(
  new THREE.SphereGeometry(0.7, 64, 32),
  new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 1.0,
    roughness: 0.0,
    envMap: null,
    envMapIntensity: 0,
  })
)
noEnvSphere.position.set(-1.5, 0.7, 3)
scene.add(noEnvSphere)
createLabel('without envMap', new THREE.Vector3(-1.5, 2, 3))

const withEnvSphere = new THREE.Mesh(
  new THREE.SphereGeometry(0.7, 64, 32),
  new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 1.0,
    roughness: 0.0,
    // scene.environment가 자동 적용됨
  })
)
withEnvSphere.position.set(1.5, 0.7, 3)
scene.add(withEnvSphere)
createLabel('with envMap', new THREE.Vector3(1.5, 2, 3))
createLabel('← 비교: envMap 유무 →', new THREE.Vector3(0, 2, 3), '#58a6ff')

// ── 바닥 ──
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9, metalness: 0.1 })
)
floor.rotation.x = -Math.PI / 2
floor.position.y = -0.01
scene.add(floor)

// ── 배경 뒤에 보일 오브젝트 (반사/굴절 확인용) ──
const bgBox = new THREE.Mesh(
  new THREE.BoxGeometry(0.5, 2, 0.5),
  new THREE.MeshStandardMaterial({ color: 0xff4444, roughness: 0.3 })
)
bgBox.position.set(-1, 1, -1.5)
scene.add(bgBox)

const bgCone = new THREE.Mesh(
  new THREE.ConeGeometry(0.4, 1.5, 32),
  new THREE.MeshStandardMaterial({ color: 0x44ff44, roughness: 0.3 })
)
bgCone.position.set(1, 0.75, -1.5)
scene.add(bgCone)

// ── 톤매핑 버튼 ──
const toneMappings = [
  { type: THREE.ACESFilmicToneMapping, name: 'ACESFilmic' },
  { type: THREE.LinearToneMapping, name: 'Linear' },
  { type: THREE.ReinhardToneMapping, name: 'Reinhard' },
  { type: THREE.CineonToneMapping, name: 'Cineon' },
  { type: THREE.AgXToneMapping, name: 'AgX' },
]
let currentToneMap = 0

document.getElementById('btn-tonemap')?.addEventListener('click', () => {
  currentToneMap = (currentToneMap + 1) % toneMappings.length
  renderer.toneMapping = toneMappings[currentToneMap].type
  const btn = document.getElementById('btn-tonemap') as HTMLButtonElement
  btn.textContent = `ToneMap: ${toneMappings[currentToneMap].name}`

  // 톤매핑 변경 시 material 업데이트
  scene.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.material instanceof THREE.Material) {
      obj.material.needsUpdate = true
    }
  })
})

// 배경 토글
document.getElementById('btn-bg')?.addEventListener('click', () => {
  if (scene.background) {
    scene.background = null
    renderer.setClearColor(0x0d1117)
  } else {
    scene.background = envMap
  }
  const btn = document.getElementById('btn-bg') as HTMLButtonElement
  btn.textContent = scene.background ? 'Background: ON' : 'Background: OFF'
})

// ── Resize ──
function resize() {
  const parent = canvas.parentElement!
  const w = parent.clientWidth
  const h = parent.clientHeight
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  camera.aspect = w / h
  camera.updateProjectionMatrix()
}
window.addEventListener('resize', resize)
resize()

// ── Animate ──
const clock = new THREE.Clock()
function animate() {
  requestAnimationFrame(animate)
  const t = clock.getElapsedTime()

  chrome.rotation.y = t * 0.2
  gold.rotation.y = t * 0.2
  aluminum.rotation.y = t * 0.2
  copper.rotation.y = t * 0.2

  glass.rotation.y = t * 0.15
  tintedGlass.rotation.y = t * 0.15
  diamond.rotation.y = t * 0.15

  controls.update()
  renderer.render(scene, camera)
}
animate()
