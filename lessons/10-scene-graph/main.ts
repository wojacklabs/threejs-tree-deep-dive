import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const canvas = document.getElementById('c') as HTMLCanvasElement
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setClearColor(0x050510)

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 200)
camera.position.set(0, 15, 20)

const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true

// ── 라벨 ──
function createLabel(text: string, parent: THREE.Object3D, offset: THREE.Vector3, color = '#ffffff') {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 64
  const ctx = c.getContext('2d')!
  ctx.fillStyle = color
  ctx.font = 'bold 22px monospace'
  ctx.textAlign = 'center'
  ctx.fillText(text, 128, 44)
  const texture = new THREE.CanvasTexture(c)
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true })
  )
  sprite.position.copy(offset)
  sprite.scale.set(2, 0.5, 1)
  parent.add(sprite)
}

// ══════════════════════════════════════════════
//  태양계 모델 — Group 계층 구조 데모
// ══════════════════════════════════════════════

// ── 태양 ──
const sunMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 })
const sun = new THREE.Mesh(new THREE.SphereGeometry(1.5, 32, 16), sunMat)
scene.add(sun)
createLabel('Sun (scene)', sun, new THREE.Vector3(0, 2.5, 0), '#ffaa00')

// 태양 글로우
const sunGlow = new THREE.Mesh(
  new THREE.SphereGeometry(1.8, 32, 16),
  new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.15 })
)
sun.add(sunGlow)

// ── 지구 공전 그룹 ──
// 이 그룹을 회전시키면 → 자식인 지구가 공전
const earthOrbitGroup = new THREE.Group()
scene.add(earthOrbitGroup)

// 궤도 시각화
const earthOrbitLine = new THREE.Line(
  new THREE.BufferGeometry().setFromPoints(
    Array.from({ length: 65 }, (_, i) => {
      const a = (i / 64) * Math.PI * 2
      return new THREE.Vector3(Math.cos(a) * 7, 0, Math.sin(a) * 7)
    })
  ),
  new THREE.LineBasicMaterial({ color: 0x334466, transparent: true, opacity: 0.4 })
)
scene.add(earthOrbitLine)

// 지구
const earthMat = new THREE.MeshStandardMaterial({ color: 0x2266cc, roughness: 0.6 })
const earth = new THREE.Mesh(new THREE.SphereGeometry(0.6, 32, 16), earthMat)
earth.position.x = 7  // 태양에서 7유닛 거리 (로컬 좌표)
earthOrbitGroup.add(earth)
createLabel('Earth', earth, new THREE.Vector3(0, 1.3, 0), '#4488ff')

// ── 달 공전 그룹 (지구에 부착) ──
const moonOrbitGroup = new THREE.Group()
moonOrbitGroup.position.x = 7  // 지구와 같은 위치
earthOrbitGroup.add(moonOrbitGroup)

// 달 궤도
const moonOrbitLine = new THREE.Line(
  new THREE.BufferGeometry().setFromPoints(
    Array.from({ length: 33 }, (_, i) => {
      const a = (i / 32) * Math.PI * 2
      return new THREE.Vector3(Math.cos(a) * 1.5, 0, Math.sin(a) * 1.5)
    })
  ),
  new THREE.LineBasicMaterial({ color: 0x444444, transparent: true, opacity: 0.3 })
)
moonOrbitGroup.add(moonOrbitLine)

// 달
const moonMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.8 })
const moon = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 8), moonMat)
moon.position.x = 1.5
moonOrbitGroup.add(moon)
createLabel('Moon', moon, new THREE.Vector3(0, 0.6, 0), '#aaaaaa')

// ── 화성 공전 ──
const marsOrbitGroup = new THREE.Group()
scene.add(marsOrbitGroup)

const marsOrbitLine = new THREE.Line(
  new THREE.BufferGeometry().setFromPoints(
    Array.from({ length: 65 }, (_, i) => {
      const a = (i / 64) * Math.PI * 2
      return new THREE.Vector3(Math.cos(a) * 11, 0, Math.sin(a) * 11)
    })
  ),
  new THREE.LineBasicMaterial({ color: 0x443322, transparent: true, opacity: 0.4 })
)
scene.add(marsOrbitLine)

const marsMat = new THREE.MeshStandardMaterial({ color: 0xcc4422, roughness: 0.7 })
const mars = new THREE.Mesh(new THREE.SphereGeometry(0.4, 32, 16), marsMat)
mars.position.x = 11
marsOrbitGroup.add(mars)
createLabel('Mars', mars, new THREE.Vector3(0, 1, 0), '#cc4422')

// 화성의 위성 포보스
const phobosOrbitGroup = new THREE.Group()
phobosOrbitGroup.position.x = 11
marsOrbitGroup.add(phobosOrbitGroup)

const phobos = new THREE.Mesh(
  new THREE.SphereGeometry(0.1, 8, 8),
  new THREE.MeshStandardMaterial({ color: 0x886655 })
)
phobos.position.x = 0.8
phobosOrbitGroup.add(phobos)

// ── 조명 ──
// 태양에서 나오는 PointLight
const sunLight = new THREE.PointLight(0xffffcc, 3, 50)
sun.add(sunLight)

const ambient = new THREE.AmbientLight(0xffffff, 0.1)
scene.add(ambient)

// ── 별 배경 ──
const starsGeo = new THREE.BufferGeometry()
const starPositions = new Float32Array(1500)
for (let i = 0; i < 1500; i++) {
  starPositions[i] = (Math.random() - 0.5) * 200
}
starsGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
const stars = new THREE.Points(
  starsGeo,
  new THREE.PointsMaterial({ color: 0xffffff, size: 0.15 })
)
scene.add(stars)

// ── 좌표 정보 표시 ──
const infoDiv = document.getElementById('info') as HTMLDivElement

// ── 속도 조절 ──
let speedMultiplier = 1
document.getElementById('btn-speed')?.addEventListener('click', () => {
  const speeds = [0.25, 0.5, 1, 2, 4]
  const idx = (speeds.indexOf(speedMultiplier) + 1) % speeds.length
  speedMultiplier = speeds[idx]
  const btn = document.getElementById('btn-speed') as HTMLButtonElement
  btn.textContent = `Speed: ${speedMultiplier}x`
})

// 계층 구조 시각화 토글
let showHierarchy = false
const hierarchyLines: THREE.Line[] = []

function updateHierarchyLines() {
  hierarchyLines.forEach(l => scene.remove(l))
  hierarchyLines.length = 0

  if (!showHierarchy) return

  const pairs: [THREE.Object3D, THREE.Object3D][] = [
    [sun, earth],
    [earth, moon],
    [sun, mars],
    [mars, phobos],
  ]

  for (const [parent, child] of pairs) {
    const pPos = new THREE.Vector3()
    const cPos = new THREE.Vector3()
    parent.getWorldPosition(pPos)
    child.getWorldPosition(cPos)

    const geo = new THREE.BufferGeometry().setFromPoints([pPos, cPos])
    const line = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.6 })
    )
    scene.add(line)
    hierarchyLines.push(line)
  }
}

document.getElementById('btn-hierarchy')?.addEventListener('click', () => {
  showHierarchy = !showHierarchy
  const btn = document.getElementById('btn-hierarchy') as HTMLButtonElement
  btn.textContent = showHierarchy ? 'Hierarchy: ON' : 'Hierarchy: OFF'
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
  const t = clock.getElapsedTime() * speedMultiplier

  // 태양 자전
  sun.rotation.y = t * 0.2

  // 지구 공전 (그룹 회전 → 자식인 지구가 따라감)
  earthOrbitGroup.rotation.y = t * 0.5

  // 지구 자전
  earth.rotation.y = t * 2

  // 달 공전
  moonOrbitGroup.rotation.y = t * 2.5

  // 화성 공전 (지구보다 느리게)
  marsOrbitGroup.rotation.y = t * 0.3

  // 화성 자전
  mars.rotation.y = t * 1.8

  // 포보스 공전
  phobosOrbitGroup.rotation.y = t * 5

  // 계층 구조 라인 업데이트
  if (showHierarchy) updateHierarchyLines()

  // 좌표 정보
  const earthWorld = new THREE.Vector3()
  const moonWorld = new THREE.Vector3()
  earth.getWorldPosition(earthWorld)
  moon.getWorldPosition(moonWorld)

  infoDiv.innerHTML = `
    <span>Earth local: (${earth.position.x.toFixed(1)}, 0, 0)</span>
    <span>Earth world: (${earthWorld.x.toFixed(1)}, 0, ${earthWorld.z.toFixed(1)})</span>
    <span>Moon world: (${moonWorld.x.toFixed(1)}, 0, ${moonWorld.z.toFixed(1)})</span>
  `

  controls.update()
  renderer.render(scene, camera)
}
animate()
