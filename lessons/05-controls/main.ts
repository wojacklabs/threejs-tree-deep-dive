import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const canvas = document.getElementById('c') as HTMLCanvasElement
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setClearColor(0x0d1117)

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100)
camera.position.set(3, 3, 5)

// ── OrbitControls ──
const controls = new OrbitControls(camera, canvas)

// 관성 (damping)
controls.enableDamping = true
controls.dampingFactor = 0.08

// 줌 제한
controls.minDistance = 2
controls.maxDistance = 20

// 수직 회전 제한 (바닥 아래로 안 가게)
controls.maxPolarAngle = Math.PI * 0.85

// 자동 회전
controls.autoRotate = false
controls.autoRotateSpeed = 2.0

// ── UI 상태 표시 ──
const infoDiv = document.getElementById('info') as HTMLDivElement

// ── 씬 구성 ──
const grid = new THREE.GridHelper(10, 10, 0x444444, 0x222222)
scene.add(grid)

const axes = new THREE.AxesHelper(3)
scene.add(axes)

// 중앙 오브젝트 (controls.target 시각화)
const centerSphere = new THREE.Mesh(
  new THREE.SphereGeometry(0.15, 16, 8),
  new THREE.MeshBasicMaterial({ color: 0xffaa00 })
)
scene.add(centerSphere)

// 주변 오브젝트들
const materials = [
  new THREE.MeshNormalMaterial(),
  new THREE.MeshNormalMaterial({ flatShading: true }),
]

const objects: THREE.Mesh[] = []

const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), materials[0])
box.position.set(-2, 0.5, 0)
scene.add(box)
objects.push(box)

const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.6, 32, 16), materials[0])
sphere.position.set(2, 0.6, 0)
scene.add(sphere)
objects.push(sphere)

const torus = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.2, 16, 32), materials[0])
torus.position.set(0, 0.7, -2)
scene.add(torus)
objects.push(torus)

const cone = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1, 32), materials[1])
cone.position.set(0, 0.5, 2)
scene.add(cone)
objects.push(cone)

const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(0.4, 0.15, 100, 16), materials[0])
knot.position.set(-2, 0.7, -2)
scene.add(knot)
objects.push(knot)

const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 1, 32), materials[1])
cylinder.position.set(2, 0.5, -2)
scene.add(cylinder)
objects.push(cylinder)

// ── 라벨 ──
function createLabel(text: string, position: THREE.Vector3) {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 64
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 24px monospace'
  ctx.textAlign = 'center'
  ctx.fillText(text, 128, 40)
  const texture = new THREE.CanvasTexture(c)
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true })
  )
  sprite.position.copy(position)
  sprite.scale.set(2, 0.5, 1)
  scene.add(sprite)
}

createLabel('target', new THREE.Vector3(0, 0.6, 0))

// ── 버튼 이벤트 ──
document.getElementById('btn-reset')?.addEventListener('click', () => {
  controls.reset()
})

document.getElementById('btn-auto')?.addEventListener('click', () => {
  controls.autoRotate = !controls.autoRotate
  const btn = document.getElementById('btn-auto') as HTMLButtonElement
  btn.textContent = controls.autoRotate ? 'Auto Rotate: ON' : 'Auto Rotate: OFF'
})

document.getElementById('btn-target')?.addEventListener('click', () => {
  // target을 랜덤 오브젝트로 변경
  const obj = objects[Math.floor(Math.random() * objects.length)]
  controls.target.copy(obj.position)
  centerSphere.position.copy(obj.position)
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

  // 오브젝트 부드럽게 회전
  objects.forEach((obj, i) => {
    obj.rotation.y = t * (0.3 + i * 0.1)
  })

  controls.update()  // damping, autoRotate 적용을 위해 필수

  // 정보 표시
  const dist = camera.position.distanceTo(controls.target)
  infoDiv.innerHTML = `
    <span>distance: ${dist.toFixed(1)}</span>
    <span>polar: ${(controls.getPolarAngle() * 180 / Math.PI).toFixed(0)}°</span>
    <span>azimuth: ${(controls.getAzimuthalAngle() * 180 / Math.PI).toFixed(0)}°</span>
  `

  renderer.render(scene, camera)
}
animate()
