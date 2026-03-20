import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const canvas = document.getElementById('c') as HTMLCanvasElement
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setClearColor(0x0d1117)

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
camera.position.set(0, 3, 7)

const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true

const grid = new THREE.GridHelper(20, 20, 0x444444, 0x222222)
scene.add(grid)

// ── 데모 1: 기본 회전 (rotation += 값) ──
const cube1 = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshNormalMaterial()
)
cube1.position.set(-4, 1, 0)
scene.add(cube1)

// ── 데모 2: Clock 기반 회전 (시간 기반) ──
const cube2 = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshNormalMaterial()
)
cube2.position.set(-1.5, 1, 0)
scene.add(cube2)

// ── 데모 3: 삼각함수 — 위아래 바운스 ──
const bounceSphere = new THREE.Mesh(
  new THREE.SphereGeometry(0.5, 32, 16),
  new THREE.MeshNormalMaterial()
)
bounceSphere.position.set(1, 1, 0)
scene.add(bounceSphere)

// ── 데모 4: 원형 궤도 ──
const orbitSphere = new THREE.Mesh(
  new THREE.SphereGeometry(0.3, 32, 16),
  new THREE.MeshNormalMaterial()
)
scene.add(orbitSphere)

// 궤도 경로 시각화 (점선 원)
const orbitPath = new THREE.Line(
  new THREE.BufferGeometry().setFromPoints(
    Array.from({ length: 65 }, (_, i) => {
      const angle = (i / 64) * Math.PI * 2
      return new THREE.Vector3(
        3.5 + Math.cos(angle) * 1.5,
        0.01,
        Math.sin(angle) * 1.5
      )
    })
  ),
  new THREE.LineBasicMaterial({ color: 0x58a6ff, transparent: true, opacity: 0.3 })
)
scene.add(orbitPath)

// 궤도 중심 마커
const orbitCenter = new THREE.Mesh(
  new THREE.SphereGeometry(0.1, 16, 8),
  new THREE.MeshBasicMaterial({ color: 0x58a6ff })
)
orbitCenter.position.set(3.5, 0.3, 0)
scene.add(orbitCenter)

// ── 데모 5: 스케일 펄스 ──
const pulseTorus = new THREE.Mesh(
  new THREE.TorusGeometry(0.5, 0.2, 16, 32),
  new THREE.MeshNormalMaterial()
)
pulseTorus.position.set(-4, 1, -3)
scene.add(pulseTorus)

// ── 데모 6: 리사주(Lissajous) 궤적 — 파동 합성 ──
const lissajous = new THREE.Mesh(
  new THREE.SphereGeometry(0.3, 32, 16),
  new THREE.MeshNormalMaterial()
)
scene.add(lissajous)

// 궤적 잔상 (Line)
const trailMax = 300
const trailPositions = new Float32Array(trailMax * 3)
const trailGeo = new THREE.BufferGeometry()
trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3))
trailGeo.setDrawRange(0, 0)
const trail = new THREE.Line(
  trailGeo,
  new THREE.LineBasicMaterial({ color: 0x7ee787, transparent: true, opacity: 0.5 })
)
scene.add(trail)
let trailIndex = 0
let trailCount = 0

// ── 데모 7: 복합 파동 — 자연스러운 떠다니기 ──
const floater = new THREE.Mesh(
  new THREE.TorusKnotGeometry(0.3, 0.12, 64, 16),
  new THREE.MeshNormalMaterial()
)
scene.add(floater)

// ── 데모 8: 델타 타임 기반 이동 ──
const deltaCube = new THREE.Mesh(
  new THREE.BoxGeometry(0.6, 0.6, 0.6),
  new THREE.MeshNormalMaterial()
)
deltaCube.position.set(4, 0.3, -3)
scene.add(deltaCube)
let deltaDirection = 1

// ── 라벨 ──
function createLabel(text: string, position: THREE.Vector3) {
  const c = document.createElement('canvas')
  c.width = 320
  c.height = 64
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 24px monospace'
  ctx.textAlign = 'center'
  ctx.fillText(text, 160, 40)
  const texture = new THREE.CanvasTexture(c)
  const mat = new THREE.SpriteMaterial({ map: texture, transparent: true })
  const sprite = new THREE.Sprite(mat)
  sprite.position.copy(position)
  sprite.scale.set(2.5, 0.5, 1)
  scene.add(sprite)
}

createLabel('rotation += 0.01', new THREE.Vector3(-4, 2.5, 0))
createLabel('Clock elapsed', new THREE.Vector3(-1.5, 2.5, 0))
createLabel('sin() bounce', new THREE.Vector3(1, 2.5, 0))
createLabel('circular orbit', new THREE.Vector3(3.5, 2.5, 0))
createLabel('scale pulse', new THREE.Vector3(-4, 2.5, -3))
createLabel('Lissajous', new THREE.Vector3(-1.5, 2.5, -3))
createLabel('wave composite', new THREE.Vector3(1.5, 2.5, -3))
createLabel('delta ping-pong', new THREE.Vector3(4, 2.5, -3))

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
let prevTime = 0

function animate() {
  requestAnimationFrame(animate)

  const elapsed = clock.getElapsedTime()
  const delta = elapsed - prevTime  // 직접 계산 — getDelta()와 혼용 방지
  prevTime = elapsed

  // 데모 1: 프레임 기반 — 프레임 속도에 따라 빨라지거나 느려짐
  cube1.rotation.x += 0.01
  cube1.rotation.y += 0.01

  // 데모 2: 시간 기반 — 프레임 속도 무관, 일정한 속도
  cube2.rotation.x = elapsed * 0.6
  cube2.rotation.y = elapsed * 0.6

  // 데모 3: sin()으로 부드러운 위아래 바운스
  bounceSphere.position.y = 1 + Math.sin(elapsed * 2) * 0.8

  // 데모 4: cos/sin으로 원형 궤도
  orbitSphere.position.x = 3.5 + Math.cos(elapsed * 1.5) * 1.5
  orbitSphere.position.z = Math.sin(elapsed * 1.5) * 1.5
  orbitSphere.position.y = 0.3

  // 데모 5: 스케일 펄스
  const scale = 1 + Math.sin(elapsed * 3) * 0.3
  pulseTorus.scale.set(scale, scale, scale)
  pulseTorus.rotation.x = elapsed * 0.5

  // 데모 6: 리사주 궤적 — 각 축에 다른 주파수
  const lx = -1.5 + Math.sin(elapsed * 1.0) * 1.2
  const ly = 1.2 + Math.sin(elapsed * 1.7) * 0.8
  const lz = -3 + Math.cos(elapsed * 0.8) * 1.0
  lissajous.position.set(lx, ly, lz)
  lissajous.rotation.x = elapsed * 0.5
  lissajous.rotation.y = elapsed * 0.3

  // 궤적 잔상 업데이트
  const ti = (trailIndex % trailMax) * 3
  trailPositions[ti] = lx
  trailPositions[ti + 1] = ly
  trailPositions[ti + 2] = lz
  trailIndex++
  trailCount = Math.min(trailCount + 1, trailMax)
  trailGeo.setDrawRange(0, trailCount)
  trailGeo.attributes.position.needsUpdate = true

  // 데모 7: 복합 파동 — 여러 sin 합성으로 자연스러운 떠다니기
  floater.position.x = 1.5 + Math.sin(elapsed * 0.7) * 0.3 + Math.sin(elapsed * 1.9) * 0.15
  floater.position.y = 1.2 + Math.sin(elapsed * 1.0) * 0.4 + Math.sin(elapsed * 2.3) * 0.2 + Math.sin(elapsed * 4.7) * 0.05
  floater.position.z = -3 + Math.sin(elapsed * 0.5) * 0.2 + Math.cos(elapsed * 1.3) * 0.1
  floater.rotation.x = elapsed * 0.4
  floater.rotation.y = elapsed * 0.6

  // 데모 8: delta 기반 핑퐁 이동
  deltaCube.position.x += deltaDirection * 2 * delta
  if (deltaCube.position.x > 5.5) deltaDirection = -1
  if (deltaCube.position.x < 2.5) deltaDirection = 1

  controls.update()
  renderer.render(scene, camera)
}
animate()
