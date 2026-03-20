import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const canvas = document.getElementById('c') as HTMLCanvasElement
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setClearColor(0x0d1117)

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100)
camera.position.set(0, 4, 10)

const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true

const grid = new THREE.GridHelper(20, 20, 0x333333, 0x1a1a1a)
scene.add(grid)

// ── 라벨 유틸 ──
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
//  섹션 1: Material 비교 (같은 조명, 다른 Material)
// ══════════════════════════════════════════════
const sectionX = -6

// 조명 (이 섹션용)
const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.5)
dirLight1.position.set(sectionX + 2, 5, 3)
scene.add(dirLight1)

const ambient1 = new THREE.AmbientLight(0xffffff, 0.2)
scene.add(ambient1)

// MeshBasicMaterial — 조명 무시
const basicSphere = new THREE.Mesh(
  new THREE.SphereGeometry(0.8, 32, 16),
  new THREE.MeshBasicMaterial({ color: 0x4488ff })
)
basicSphere.position.set(sectionX, 1, 3)
scene.add(basicSphere)
createLabel('MeshBasicMaterial', new THREE.Vector3(sectionX, 2.5, 3))
createLabel('조명 무시 — 항상 동일', new THREE.Vector3(sectionX, -0.3, 3), '#8b949e')

// MeshLambertMaterial — 확산 반사만
const lambertSphere = new THREE.Mesh(
  new THREE.SphereGeometry(0.8, 32, 16),
  new THREE.MeshLambertMaterial({ color: 0x4488ff })
)
lambertSphere.position.set(sectionX, 1, 0)
scene.add(lambertSphere)
createLabel('MeshLambertMaterial', new THREE.Vector3(sectionX, 2.5, 0))
createLabel('확산 반사만 (빠름)', new THREE.Vector3(sectionX, -0.3, 0), '#8b949e')

// MeshPhongMaterial — 확산 + 반짝임
const phongSphere = new THREE.Mesh(
  new THREE.SphereGeometry(0.8, 32, 16),
  new THREE.MeshPhongMaterial({ color: 0x4488ff, shininess: 100 })
)
phongSphere.position.set(sectionX, 1, -3)
scene.add(phongSphere)
createLabel('MeshPhongMaterial', new THREE.Vector3(sectionX, 2.5, -3))
createLabel('확산 + 반짝임 (specular)', new THREE.Vector3(sectionX, -0.3, -3), '#8b949e')

// MeshStandardMaterial — PBR (물리 기반)
const standardSphere = new THREE.Mesh(
  new THREE.SphereGeometry(0.8, 32, 16),
  new THREE.MeshStandardMaterial({ color: 0x4488ff, roughness: 0.4, metalness: 0.3 })
)
standardSphere.position.set(sectionX, 1, -6)
scene.add(standardSphere)
createLabel('MeshStandardMaterial', new THREE.Vector3(sectionX, 2.5, -6))
createLabel('PBR (roughness+metalness)', new THREE.Vector3(sectionX, -0.3, -6), '#8b949e')

// MeshToonMaterial — 셀 셰이딩
const toonSphere = new THREE.Mesh(
  new THREE.SphereGeometry(0.8, 32, 16),
  new THREE.MeshToonMaterial({ color: 0x4488ff })
)
toonSphere.position.set(sectionX, 1, -9)
scene.add(toonSphere)
createLabel('MeshToonMaterial', new THREE.Vector3(sectionX, 2.5, -9))
createLabel('셀 셰이딩 (만화풍)', new THREE.Vector3(sectionX, -0.3, -9), '#8b949e')

// ══════════════════════════════════════════════
//  섹션 2: 조명 종류 비교
// ══════════════════════════════════════════════
const lightX = 3

// 공통 Material
const stdMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.5, metalness: 0.1 })

// --- AmbientLight ---
const ambientGroup = new THREE.Group()
const ambientSphere = new THREE.Mesh(new THREE.SphereGeometry(0.8, 32, 16), stdMat.clone())
ambientSphere.position.y = 1
ambientGroup.add(ambientSphere)
const ambientFloor = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), stdMat.clone())
ambientFloor.rotation.x = -Math.PI / 2
ambientFloor.position.y = 0.01
ambientGroup.add(ambientFloor)
const ambLight = new THREE.AmbientLight(0xffffff, 1.0)
ambientGroup.add(ambLight)
ambientGroup.position.set(lightX, 0, 3)
scene.add(ambientGroup)
createLabel('AmbientLight', new THREE.Vector3(lightX, 2.5, 3))
createLabel('전체 균일 — 그림자 없음', new THREE.Vector3(lightX, -0.3, 3), '#8b949e')

// --- DirectionalLight ---
const dirGroup = new THREE.Group()
const dirSphere = new THREE.Mesh(new THREE.SphereGeometry(0.8, 32, 16), stdMat.clone())
dirSphere.position.y = 1
dirGroup.add(dirSphere)
const dirFloor = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), stdMat.clone())
dirFloor.rotation.x = -Math.PI / 2
dirFloor.position.y = 0.01
dirGroup.add(dirFloor)
const dirLight = new THREE.DirectionalLight(0xffffff, 1.5)
dirLight.position.set(1, 3, 1)
dirGroup.add(dirLight)
const dirHelper = new THREE.DirectionalLightHelper(dirLight, 0.5)
dirGroup.add(dirHelper)
dirGroup.position.set(lightX, 0, 0)
scene.add(dirGroup)
createLabel('DirectionalLight', new THREE.Vector3(lightX, 2.5, 0))
createLabel('태양광 — 평행 광선', new THREE.Vector3(lightX, -0.3, 0), '#8b949e')

// --- PointLight ---
const pointGroup = new THREE.Group()
const pointSphere = new THREE.Mesh(new THREE.SphereGeometry(0.8, 32, 16), stdMat.clone())
pointSphere.position.y = 1
pointGroup.add(pointSphere)
const pointFloor = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), stdMat.clone())
pointFloor.rotation.x = -Math.PI / 2
pointFloor.position.y = 0.01
pointGroup.add(pointFloor)
const pointLight = new THREE.PointLight(0xff8844, 3, 8)
pointLight.position.set(0, 2.5, 0)
pointGroup.add(pointLight)
const pointHelper = new THREE.PointLightHelper(pointLight, 0.2)
pointGroup.add(pointHelper)
pointGroup.position.set(lightX, 0, -3)
scene.add(pointGroup)
createLabel('PointLight', new THREE.Vector3(lightX, 2.5, -3))
createLabel('전구 — 사방으로 발산', new THREE.Vector3(lightX, -0.3, -3), '#8b949e')

// --- SpotLight ---
const spotGroup = new THREE.Group()
const spotSphere = new THREE.Mesh(new THREE.SphereGeometry(0.8, 32, 16), stdMat.clone())
spotSphere.position.y = 1
spotGroup.add(spotSphere)
const spotFloor = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), stdMat.clone())
spotFloor.rotation.x = -Math.PI / 2
spotFloor.position.y = 0.01
spotGroup.add(spotFloor)
const spotLight = new THREE.SpotLight(0x88ff44, 5, 8, Math.PI / 6, 0.3)
spotLight.position.set(0, 3, 0)
spotLight.target.position.set(0, 0, 0)
spotGroup.add(spotLight)
spotGroup.add(spotLight.target)
const spotHelper = new THREE.SpotLightHelper(spotLight)
spotGroup.add(spotHelper)
spotGroup.position.set(lightX, 0, -6)
scene.add(spotGroup)
createLabel('SpotLight', new THREE.Vector3(lightX, 2.5, -6))
createLabel('손전등 — 원뿔 영역', new THREE.Vector3(lightX, -0.3, -6), '#8b949e')

// --- HemisphereLight ---
const hemiGroup = new THREE.Group()
const hemiSphere = new THREE.Mesh(new THREE.SphereGeometry(0.8, 32, 16), stdMat.clone())
hemiSphere.position.y = 1
hemiGroup.add(hemiSphere)
const hemiFloor = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), stdMat.clone())
hemiFloor.rotation.x = -Math.PI / 2
hemiFloor.position.y = 0.01
hemiGroup.add(hemiFloor)
const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x362907, 1.5)
hemiGroup.add(hemiLight)
const hemiHelper = new THREE.HemisphereLightHelper(hemiLight, 0.3)
hemiGroup.add(hemiHelper)
hemiGroup.position.set(lightX, 0, -9)
scene.add(hemiGroup)
createLabel('HemisphereLight', new THREE.Vector3(lightX, 2.5, -9))
createLabel('하늘+땅 — 자연광 시뮬', new THREE.Vector3(lightX, -0.3, -9), '#8b949e')

// ══════════════════════════════════════════════
//  섹션 3: roughness / metalness 비교
// ══════════════════════════════════════════════
const pbrX = -1.5
const pbrZ = -13

// 전용 조명
const pbrLight = new THREE.DirectionalLight(0xffffff, 2)
pbrLight.position.set(pbrX, 5, pbrZ + 3)
scene.add(pbrLight)

for (let r = 0; r < 5; r++) {
  for (let m = 0; m < 5; m++) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      roughness: r / 4,
      metalness: m / 4,
    })
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.35, 32, 16), mat)
    sphere.position.set(pbrX + m * 1.2 - 2.4, 0.4, pbrZ + r * 1.2)
    scene.add(sphere)
  }
}
createLabel('← metalness 0 ~ 1 →', new THREE.Vector3(pbrX, 1.5, pbrZ + 2.5))
createLabel('roughness 0→1 ↓', new THREE.Vector3(pbrX - 3.5, 0.5, pbrZ + 2.4), '#8b949e')

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

  // PointLight 살짝 움직임
  pointLight.position.x = Math.sin(t * 1.5) * 1.2
  pointLight.position.z = Math.cos(t * 1.5) * 1.2

  // SpotLight helper 업데이트
  spotHelper.update()

  controls.update()
  renderer.render(scene, camera)
}
animate()
