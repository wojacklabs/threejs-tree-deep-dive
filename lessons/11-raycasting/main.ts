import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const canvas = document.getElementById('c') as HTMLCanvasElement
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setClearColor(0x0d1117)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100)
camera.position.set(0, 5, 10)

const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true

// 조명
const dirLight = new THREE.DirectionalLight(0xffffff, 1.5)
dirLight.position.set(3, 8, 5)
dirLight.castShadow = true
dirLight.shadow.mapSize.set(1024, 1024)
dirLight.shadow.camera.left = -8
dirLight.shadow.camera.right = 8
dirLight.shadow.camera.top = 8
dirLight.shadow.camera.bottom = -8
scene.add(dirLight)
scene.add(new THREE.AmbientLight(0xffffff, 0.3))

// 바닥
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 })
)
floor.rotation.x = -Math.PI / 2
floor.receiveShadow = true
scene.add(floor)

const grid = new THREE.GridHelper(20, 20, 0x333333, 0x1a1a1a)
scene.add(grid)

// ── 인터랙티브 오브젝트 ──
interface InteractiveObject {
  mesh: THREE.Mesh
  originalColor: THREE.Color
  name: string
}

const interactives: InteractiveObject[] = []

const geometries = [
  { geo: new THREE.BoxGeometry(1, 1, 1), name: 'Box', y: 0.5 },
  { geo: new THREE.SphereGeometry(0.6, 32, 16), name: 'Sphere', y: 0.6 },
  { geo: new THREE.ConeGeometry(0.5, 1.2, 32), name: 'Cone', y: 0.6 },
  { geo: new THREE.TorusGeometry(0.5, 0.2, 16, 32), name: 'Torus', y: 0.7 },
  { geo: new THREE.TorusKnotGeometry(0.4, 0.15, 100, 16), name: 'Knot', y: 0.7 },
  { geo: new THREE.CylinderGeometry(0.3, 0.5, 1, 32), name: 'Cylinder', y: 0.5 },
  { geo: new THREE.OctahedronGeometry(0.6), name: 'Octahedron', y: 0.6 },
  { geo: new THREE.DodecahedronGeometry(0.5), name: 'Dodecahedron', y: 0.5 },
]

const colors = [0x4488ff, 0xff4444, 0x44ff44, 0xff8844, 0xaa44ff, 0x44ffff, 0xffff44, 0xff44aa]

geometries.forEach(({ geo, name, y }, i) => {
  const color = new THREE.Color(colors[i])
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.2 })
  const mesh = new THREE.Mesh(geo, mat)

  const angle = (i / geometries.length) * Math.PI * 2
  const radius = 4
  mesh.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius)
  mesh.castShadow = true
  mesh.receiveShadow = true
  scene.add(mesh)

  interactives.push({ mesh, originalColor: color.clone(), name })
})

// ── Raycaster ──
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()

// 현재 호버 중인 오브젝트
let hoveredObject: InteractiveObject | null = null

// 선택된 오브젝트
let selectedObject: InteractiveObject | null = null

// 레이 시각화
const rayLine = new THREE.Line(
  new THREE.BufferGeometry(),
  new THREE.LineBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.3 })
)
scene.add(rayLine)
let showRay = false

// 교차점 마커
const hitMarker = new THREE.Mesh(
  new THREE.SphereGeometry(0.05, 8, 8),
  new THREE.MeshBasicMaterial({ color: 0xff0000 })
)
hitMarker.visible = false
scene.add(hitMarker)

// ── 마우스 이벤트 ──
function updateMouse(event: MouseEvent) {
  const rect = canvas.getBoundingClientRect()
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
}

canvas.addEventListener('mousemove', (e) => {
  updateMouse(e)
  performRaycast()
})

canvas.addEventListener('click', (e) => {
  updateMouse(e)
  performRaycast()

  if (hoveredObject) {
    // 이전 선택 해제
    if (selectedObject && selectedObject !== hoveredObject) {
      const mat = selectedObject.mesh.material as THREE.MeshStandardMaterial
      mat.emissive.setHex(0x000000)
      mat.emissiveIntensity = 0
    }

    // 새 선택 또는 토글
    if (selectedObject === hoveredObject) {
      const mat = selectedObject.mesh.material as THREE.MeshStandardMaterial
      mat.emissive.setHex(0x000000)
      selectedObject = null
      updateInfo(null)
    } else {
      selectedObject = hoveredObject
      const mat = selectedObject.mesh.material as THREE.MeshStandardMaterial
      mat.emissive.copy(selectedObject.originalColor)
      mat.emissiveIntensity = 0.4
      updateInfo(selectedObject)
    }
  } else {
    // 빈 곳 클릭 → 선택 해제
    if (selectedObject) {
      const mat = selectedObject.mesh.material as THREE.MeshStandardMaterial
      mat.emissive.setHex(0x000000)
      selectedObject = null
      updateInfo(null)
    }
  }
})

function performRaycast() {
  raycaster.setFromCamera(mouse, camera)

  const meshes = interactives.map(i => i.mesh)
  const intersects = raycaster.intersectObjects(meshes)

  // 이전 호버 해제
  if (hoveredObject) {
    const mat = hoveredObject.mesh.material as THREE.MeshStandardMaterial
    if (hoveredObject !== selectedObject) {
      mat.color.copy(hoveredObject.originalColor)
    }
    canvas.style.cursor = 'default'
    hoveredObject = null
  }

  if (intersects.length > 0) {
    const hit = intersects[0]
    const obj = interactives.find(i => i.mesh === hit.object)
    if (obj) {
      hoveredObject = obj
      const mat = obj.mesh.material as THREE.MeshStandardMaterial
      mat.color.copy(obj.originalColor).multiplyScalar(1.4)
      canvas.style.cursor = 'pointer'

      // 교차점 마커
      hitMarker.position.copy(hit.point)
      hitMarker.visible = true

      // 호버 정보
      const hoverInfo = document.getElementById('hover-info') as HTMLDivElement
      hoverInfo.innerHTML = `
        <span>hover: ${obj.name}</span>
        <span>distance: ${hit.distance.toFixed(2)}</span>
        <span>point: (${hit.point.x.toFixed(1)}, ${hit.point.y.toFixed(1)}, ${hit.point.z.toFixed(1)})</span>
        <span>face index: ${hit.faceIndex}</span>
      `
    }
  } else {
    hitMarker.visible = false
    const hoverInfo = document.getElementById('hover-info') as HTMLDivElement
    hoverInfo.innerHTML = '<span>hover: none</span>'
  }

  // 레이 시각화
  if (showRay) {
    const origin = raycaster.ray.origin.clone()
    const end = raycaster.ray.origin.clone().add(raycaster.ray.direction.clone().multiplyScalar(20))
    rayLine.geometry.dispose()
    rayLine.geometry = new THREE.BufferGeometry().setFromPoints([origin, end])
    rayLine.visible = true
  } else {
    rayLine.visible = false
  }
}

function updateInfo(obj: InteractiveObject | null) {
  const selectInfo = document.getElementById('select-info') as HTMLDivElement
  if (obj) {
    selectInfo.innerHTML = `<span style="color:#58a6ff">selected: ${obj.name}</span>`
  } else {
    selectInfo.innerHTML = '<span>selected: none</span>'
  }
}

// ── 버튼 ──
document.getElementById('btn-ray')?.addEventListener('click', () => {
  showRay = !showRay
  const btn = document.getElementById('btn-ray') as HTMLButtonElement
  btn.textContent = showRay ? 'Ray: ON' : 'Ray: OFF'
  if (!showRay) rayLine.visible = false
})

document.getElementById('btn-reset-colors')?.addEventListener('click', () => {
  interactives.forEach(({ mesh, originalColor }) => {
    const mat = mesh.material as THREE.MeshStandardMaterial
    mat.color.copy(originalColor)
    mat.emissive.setHex(0x000000)
    mat.emissiveIntensity = 0
  })
  selectedObject = null
  updateInfo(null)
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
  interactives.forEach(({ mesh }, i) => {
    mesh.rotation.y = t * (0.3 + i * 0.05)
  })

  // 선택된 오브젝트 위아래 바운스
  if (selectedObject) {
    const baseY = geometries.find((_, i) => interactives[i] === selectedObject)!.y
    selectedObject.mesh.position.y = baseY + Math.sin(t * 3) * 0.2
  }

  controls.update()
  renderer.render(scene, camera)
}
animate()
