import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const canvas = document.getElementById('c') as HTMLCanvasElement
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setClearColor(0x0d1117)

const scene = new THREE.Scene()

// ── 메인 카메라 (Perspective) ──
const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100)
camera.position.set(5, 4, 7)

const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true

// ── 헬퍼: 좌표계 시각화 ──
// AxesHelper: 빨강=X, 초록=Y, 파랑=Z
const axes = new THREE.AxesHelper(5)
scene.add(axes)

// GridHelper: XZ 평면의 격자
const grid = new THREE.GridHelper(10, 10, 0x444444, 0x222222)
scene.add(grid)

// ── 좌표축 라벨 ──
function createLabel(text: string, position: THREE.Vector3, color: string = '#ffffff') {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 64
  const ctx = c.getContext('2d')!
  ctx.fillStyle = color
  ctx.font = 'bold 36px monospace'
  ctx.textAlign = 'center'
  ctx.fillText(text, 64, 44)
  const texture = new THREE.CanvasTexture(c)
  const mat = new THREE.SpriteMaterial({ map: texture, transparent: true })
  const sprite = new THREE.Sprite(mat)
  sprite.position.copy(position)
  sprite.scale.set(1.2, 0.6, 1)
  scene.add(sprite)
}

createLabel('+X', new THREE.Vector3(5.5, 0.2, 0), '#ff4444')
createLabel('+Y', new THREE.Vector3(0, 5.5, 0), '#44ff44')
createLabel('+Z', new THREE.Vector3(0, 0.2, 5.5), '#4488ff')
createLabel('-X', new THREE.Vector3(-5.5, 0.2, 0), '#ff444488')
createLabel('-Z', new THREE.Vector3(0, 0.2, -5.5), '#4488ff88')

// ── 오브젝트 배치: 각 축 방향에 도형 ──
const matX = new THREE.MeshBasicMaterial({ color: 0xff4444 })
const matY = new THREE.MeshBasicMaterial({ color: 0x44ff44 })
const matZ = new THREE.MeshBasicMaterial({ color: 0x4488ff })
const matNormal = new THREE.MeshNormalMaterial()

// X축 방향
const boxX = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), matX)
boxX.position.set(3, 0.4, 0)
scene.add(boxX)

// Y축 방향
const boxY = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), matY)
boxY.position.set(0, 3, 0)
scene.add(boxY)

// Z축 방향
const boxZ = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), matZ)
boxZ.position.set(0, 0.4, 3)
scene.add(boxZ)

// 원점에 구체
const origin = new THREE.Mesh(new THREE.SphereGeometry(0.3, 32, 16), matNormal)
origin.position.set(0, 0.3, 0)
scene.add(origin)

// ── FOV 비교 시각화: 미니 frustum ──
// 작은 카메라 아이콘 역할
function createCameraIcon(fov: number, pos: THREE.Vector3, label: string) {
  const cam = new THREE.PerspectiveCamera(fov, 1, 0.5, 3)
  cam.position.copy(pos)
  cam.lookAt(0, 0, 0)

  const helper = new THREE.CameraHelper(cam)
  scene.add(helper)

  createLabel(label, new THREE.Vector3(pos.x, pos.y + 1.2, pos.z))
  return { cam, helper }
}

const cam30 = createCameraIcon(30, new THREE.Vector3(-4, 2, -4), 'fov:30')
const cam75 = createCameraIcon(75, new THREE.Vector3(-4, 2, -1), 'fov:75')
const cam120 = createCameraIcon(120, new THREE.Vector3(-4, 2, 2), 'fov:120')

// ── lookAt 대상 표시 ──
const lookAtTarget = new THREE.Mesh(
  new THREE.OctahedronGeometry(0.2),
  new THREE.MeshBasicMaterial({ color: 0xffaa00, wireframe: true })
)
lookAtTarget.position.set(2, 1, -2)
scene.add(lookAtTarget)
createLabel('lookAt target', new THREE.Vector3(2, 2, -2), '#ffaa00')

// lookAt 방향을 나타내는 화살표
const arrowDir = new THREE.Vector3()
arrowDir.subVectors(lookAtTarget.position, new THREE.Vector3(0, 1, 4)).normalize()
const arrow = new THREE.ArrowHelper(arrowDir, new THREE.Vector3(0, 1, 4), 3, 0xffaa00, 0.3, 0.15)
scene.add(arrow)
createLabel('camera', new THREE.Vector3(0, 2.2, 4), '#ffaa00')

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

  // 원점 구체 부드럽게 회전
  origin.rotation.y = t * 0.5

  // lookAt 타겟 떠다니기
  lookAtTarget.position.y = 1 + Math.sin(t * 1.5) * 0.3
  lookAtTarget.rotation.y = t

  controls.update()
  renderer.render(scene, camera)
}
animate()
