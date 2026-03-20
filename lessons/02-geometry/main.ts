import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const canvas = document.getElementById('c') as HTMLCanvasElement
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })

const scene = new THREE.Scene()

const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
camera.position.set(0, 2, 8)

const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true

// ── 바닥 그리드 ──
const grid = new THREE.GridHelper(20, 20, 0x444444, 0x222222)
scene.add(grid)

// ── 6가지 기본 Geometry ──
const material = new THREE.MeshNormalMaterial()
const wireMaterial = new THREE.MeshNormalMaterial({ wireframe: true })

// 1. Box
const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material)
box.position.set(-4, 0.5, 0)
scene.add(box)

// 2. Sphere
const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.6, 32, 16), material)
sphere.position.set(-2, 0.6, 0)
scene.add(sphere)

// 3. Cone
const cone = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 32), material)
cone.position.set(0, 0.6, 0)
scene.add(cone)

// 4. Cylinder
const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.2, 32), material)
cylinder.position.set(2, 0.6, 0)
scene.add(cylinder)

// 5. Torus
const torus = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.2, 16, 32), material)
torus.position.set(4, 0.7, 0)
scene.add(torus)

// 6. TorusKnot
const torusKnot = new THREE.Mesh(new THREE.TorusKnotGeometry(0.4, 0.15, 100, 16), material)
torusKnot.position.set(0, 0.7, -3)
scene.add(torusKnot)

// ── Wireframe 버전 (뒷줄) ──
const boxW = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), wireMaterial)
boxW.position.set(-4, 0.5, -3)
scene.add(boxW)

const sphereW = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), wireMaterial)
sphereW.position.set(-2, 0.6, -3)
scene.add(sphereW)

const coneW = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 8), wireMaterial)
coneW.position.set(0, 0.6, 3)
scene.add(coneW)

const cylinderW = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.2, 8), wireMaterial)
cylinderW.position.set(2, 0.6, -3)
scene.add(cylinderW)

const torusW = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.2, 8, 12), wireMaterial)
torusW.position.set(4, 0.7, -3)
scene.add(torusW)

// ── 라벨 (Sprite) ──
function createLabel(text: string, position: THREE.Vector3) {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 64
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 28px monospace'
  ctx.textAlign = 'center'
  ctx.fillText(text, 128, 40)

  const texture = new THREE.CanvasTexture(c)
  const mat = new THREE.SpriteMaterial({ map: texture, transparent: true })
  const sprite = new THREE.Sprite(mat)
  sprite.position.copy(position)
  sprite.scale.set(2, 0.5, 1)
  scene.add(sprite)
}

createLabel('Box', new THREE.Vector3(-4, 1.8, 0))
createLabel('Sphere', new THREE.Vector3(-2, 1.8, 0))
createLabel('Cone', new THREE.Vector3(0, 1.8, 0))
createLabel('Cylinder', new THREE.Vector3(2, 1.8, 0))
createLabel('Torus', new THREE.Vector3(4, 1.8, 0))
createLabel('TorusKnot', new THREE.Vector3(0, 1.8, -3))
createLabel('wireframe', new THREE.Vector3(-4, 1.8, -3))

// ── Segments 비교용: 저폴리 vs 고폴리 구체 ──
const lowPoly = new THREE.Mesh(
  new THREE.SphereGeometry(0.6, 6, 4),
  new THREE.MeshNormalMaterial({ flatShading: true })
)
lowPoly.position.set(-2, 0.6, 3)
scene.add(lowPoly)
createLabel('segments: 6', new THREE.Vector3(-2, 1.8, 3))

const highPoly = new THREE.Mesh(
  new THREE.SphereGeometry(0.6, 32, 16),
  new THREE.MeshNormalMaterial({ flatShading: true })
)
highPoly.position.set(-4, 0.6, 3)
scene.add(highPoly)
createLabel('segments: 32', new THREE.Vector3(-4, 1.8, 3))

createLabel('wireframe', new THREE.Vector3(0, 1.8, 3))

// ── Plane (바닥에 기울여 배치) ──
const plane = new THREE.Mesh(
  new THREE.PlaneGeometry(1.5, 1.5),
  material
)
plane.position.set(2, 0.8, 3)
plane.rotation.x = -Math.PI * 0.3
scene.add(plane)
createLabel('Plane', new THREE.Vector3(2, 1.8, 3))

// ── Ring ──
const ring = new THREE.Mesh(
  new THREE.RingGeometry(0.3, 0.6, 32),
  material
)
ring.position.set(4, 0.8, 3)
ring.rotation.x = -Math.PI * 0.3
scene.add(ring)
createLabel('Ring', new THREE.Vector3(4, 1.8, 3))

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

  // 앞줄 도형들 부드럽게 회전
  box.rotation.y = t * 0.5
  sphere.rotation.y = t * 0.5
  cone.rotation.y = t * 0.5
  cylinder.rotation.y = t * 0.5
  torus.rotation.x = t * 0.5
  torus.rotation.y = t * 0.3
  torusKnot.rotation.x = t * 0.3
  torusKnot.rotation.y = t * 0.5

  controls.update()
  renderer.render(scene, camera)
}
animate()
