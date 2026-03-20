import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const canvas = document.getElementById('c') as HTMLCanvasElement
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setClearColor(0x0d1117)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100)
camera.position.set(5, 5, 8)

const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true

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
//  섹션 1: DirectionalLight 그림자
// ══════════════════════════════════════════════
const sec1X = -4

// 바닥
const floor1 = new THREE.Mesh(
  new THREE.PlaneGeometry(8, 8),
  new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.8 })
)
floor1.rotation.x = -Math.PI / 2
floor1.position.set(sec1X, 0, 0)
floor1.receiveShadow = true
scene.add(floor1)

// DirectionalLight
const dirLight = new THREE.DirectionalLight(0xffffff, 2)
dirLight.position.set(sec1X + 2, 6, 3)
dirLight.castShadow = true

// 그림자 품질 설정
dirLight.shadow.mapSize.width = 1024
dirLight.shadow.mapSize.height = 1024
dirLight.shadow.camera.near = 0.5
dirLight.shadow.camera.far = 20
dirLight.shadow.camera.left = -5
dirLight.shadow.camera.right = 5
dirLight.shadow.camera.top = 5
dirLight.shadow.camera.bottom = -5
dirLight.shadow.radius = 4  // PCFSoft 블러 반경

scene.add(dirLight)

// 그림자 카메라 헬퍼 (디버깅용)
const dirShadowHelper = new THREE.CameraHelper(dirLight.shadow.camera)
dirShadowHelper.visible = false
scene.add(dirShadowHelper)

// 오브젝트
const mat = new THREE.MeshStandardMaterial({ color: 0x4488ff, roughness: 0.4, metalness: 0.2 })

const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat)
box.position.set(sec1X - 1, 0.5, 1)
box.castShadow = true
box.receiveShadow = true
scene.add(box)

const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.6, 32, 16), mat)
sphere.position.set(sec1X + 1, 0.6, 0)
sphere.castShadow = true
scene.add(sphere)

const torus = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.2, 16, 32), mat)
torus.position.set(sec1X, 1.2, -1.5)
torus.castShadow = true
scene.add(torus)

// 환경광 (그림자 영역이 너무 어둡지 않게)
const ambient = new THREE.AmbientLight(0xffffff, 0.3)
scene.add(ambient)

createLabel('DirectionalLight Shadow', new THREE.Vector3(sec1X, 3.5, 0))

// ══════════════════════════════════════════════
//  섹션 2: SpotLight 그림자
// ══════════════════════════════════════════════
const sec2X = 4

const floor2 = new THREE.Mesh(
  new THREE.PlaneGeometry(8, 8),
  new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.8 })
)
floor2.rotation.x = -Math.PI / 2
floor2.position.set(sec2X, 0, 0)
floor2.receiveShadow = true
scene.add(floor2)

const spotLight = new THREE.SpotLight(0xff8844, 5, 15, Math.PI / 5, 0.4)
spotLight.position.set(sec2X, 5, 2)
spotLight.target.position.set(sec2X, 0, 0)
spotLight.castShadow = true
spotLight.shadow.mapSize.width = 1024
spotLight.shadow.mapSize.height = 1024
spotLight.shadow.camera.near = 1
spotLight.shadow.camera.far = 15
scene.add(spotLight)
scene.add(spotLight.target)

const spotHelper = new THREE.SpotLightHelper(spotLight)
scene.add(spotHelper)

// 오브젝트
const mat2 = new THREE.MeshStandardMaterial({ color: 0xff6644, roughness: 0.3, metalness: 0.4 })

const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.5, 32), mat2)
cylinder.position.set(sec2X - 1, 0.75, 0.5)
cylinder.castShadow = true
cylinder.receiveShadow = true
scene.add(cylinder)

const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(0.4, 0.15, 100, 16), mat2)
knot.position.set(sec2X + 1, 0.8, -1)
knot.castShadow = true
scene.add(knot)

const cone = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 32), mat2)
cone.position.set(sec2X, 0.6, 1.5)
cone.castShadow = true
cone.receiveShadow = true
scene.add(cone)

createLabel('SpotLight Shadow', new THREE.Vector3(sec2X, 3.5, 0))

// ══════════════════════════════════════════════
//  섹션 3: Shadow Map 비교
// ══════════════════════════════════════════════
const sec3Z = -8
const shadowTypes = [
  { type: THREE.BasicShadowMap, name: 'BasicShadowMap' },
  { type: THREE.PCFShadowMap, name: 'PCFShadowMap' },
  { type: THREE.PCFSoftShadowMap, name: 'PCFSoftShadowMap' },
  { type: THREE.VSMShadowMap, name: 'VSMShadowMap' },
]

// 현재 shadow map 타입 표시
const shadowTypeLabel = document.getElementById('shadow-type') as HTMLSpanElement
let currentShadowType = 2 // PCFSoftShadowMap

document.getElementById('btn-shadow-type')?.addEventListener('click', () => {
  currentShadowType = (currentShadowType + 1) % shadowTypes.length
  renderer.shadowMap.type = shadowTypes[currentShadowType].type
  shadowTypeLabel.textContent = shadowTypes[currentShadowType].name

  // shadowMap 타입 변경 시 material 재컴파일 필요
  scene.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.material instanceof THREE.Material) {
      obj.material.needsUpdate = true
    }
  })
})

// shadow helper 토글
document.getElementById('btn-shadow-helper')?.addEventListener('click', () => {
  dirShadowHelper.visible = !dirShadowHelper.visible
  const btn = document.getElementById('btn-shadow-helper') as HTMLButtonElement
  btn.textContent = dirShadowHelper.visible ? 'Shadow Camera: ON' : 'Shadow Camera: OFF'
})

// shadow mapSize 변경
let currentMapSize = 1024
document.getElementById('btn-map-size')?.addEventListener('click', () => {
  const sizes = [256, 512, 1024, 2048]
  const idx = (sizes.indexOf(currentMapSize) + 1) % sizes.length
  currentMapSize = sizes[idx]

  dirLight.shadow.mapSize.width = currentMapSize
  dirLight.shadow.mapSize.height = currentMapSize
  dirLight.shadow.map?.dispose()
  dirLight.shadow.map = null as unknown as THREE.WebGLRenderTarget

  spotLight.shadow.mapSize.width = currentMapSize
  spotLight.shadow.mapSize.height = currentMapSize
  spotLight.shadow.map?.dispose()
  spotLight.shadow.map = null as unknown as THREE.WebGLRenderTarget

  const btn = document.getElementById('btn-map-size') as HTMLButtonElement
  btn.textContent = `mapSize: ${currentMapSize}`
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

  // 오브젝트 회전
  torus.rotation.x = t * 0.5
  torus.rotation.y = t * 0.3
  knot.rotation.x = t * 0.4
  knot.rotation.y = t * 0.6

  // SpotLight 부드럽게 이동
  spotLight.position.x = sec2X + Math.sin(t * 0.5) * 2
  spotHelper.update()

  controls.update()
  renderer.render(scene, camera)
}
animate()
