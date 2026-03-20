import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const canvas = document.getElementById('c') as HTMLCanvasElement
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setClearColor(0x0d1117)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 200)
camera.position.set(0, 15, 30)

const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true

// 조명
const dirLight = new THREE.DirectionalLight(0xffffff, 1.5)
dirLight.position.set(10, 20, 10)
dirLight.castShadow = true
dirLight.shadow.mapSize.set(1024, 1024)
dirLight.shadow.camera.left = -30
dirLight.shadow.camera.right = 30
dirLight.shadow.camera.top = 30
dirLight.shadow.camera.bottom = -30
dirLight.shadow.camera.far = 60
scene.add(dirLight)
scene.add(new THREE.AmbientLight(0xffffff, 0.3))

// 바닥
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(60, 60),
  new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.9 })
)
floor.rotation.x = -Math.PI / 2
floor.receiveShadow = true
scene.add(floor)

// ── 상태 ──
const COUNT = 2000
let currentMode: 'individual' | 'instanced' | 'merged' = 'individual'
let currentGroup: THREE.Object3D | null = null
let fps = 0
let frameCount = 0
let lastFpsTime = 0

const infoDiv = document.getElementById('info') as HTMLDivElement

// ── 개별 Mesh 모드 ──
function createIndividual() {
  clearScene()
  const group = new THREE.Group()
  const geo = new THREE.BoxGeometry(0.5, 0.5, 0.5)

  for (let i = 0; i < COUNT; i++) {
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(Math.random(), 0.7, 0.5),
      roughness: 0.5,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(
      (Math.random() - 0.5) * 50,
      Math.random() * 10,
      (Math.random() - 0.5) * 50
    )
    mesh.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    )
    mesh.castShadow = true
    group.add(mesh)
  }

  scene.add(group)
  currentGroup = group
  currentMode = 'individual'
}

// ── InstancedMesh 모드 ──
function createInstanced() {
  clearScene()
  const geo = new THREE.BoxGeometry(0.5, 0.5, 0.5)
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.5 })

  const instancedMesh = new THREE.InstancedMesh(geo, mat, COUNT)
  instancedMesh.castShadow = true
  instancedMesh.receiveShadow = true

  const dummy = new THREE.Object3D()
  const color = new THREE.Color()

  for (let i = 0; i < COUNT; i++) {
    dummy.position.set(
      (Math.random() - 0.5) * 50,
      Math.random() * 10,
      (Math.random() - 0.5) * 50
    )
    dummy.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    )
    dummy.updateMatrix()
    instancedMesh.setMatrixAt(i, dummy.matrix)
    instancedMesh.setColorAt(i, color.setHSL(Math.random(), 0.7, 0.5))
  }

  instancedMesh.instanceMatrix.needsUpdate = true
  if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true

  scene.add(instancedMesh)
  currentGroup = instancedMesh
  currentMode = 'instanced'
}

// ── Merged Geometry 모드 ──
function createMerged() {
  clearScene()
  const baseGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5)
  const geos: THREE.BufferGeometry[] = []

  for (let i = 0; i < COUNT; i++) {
    const clone = baseGeo.clone()
    clone.translate(
      (Math.random() - 0.5) * 50,
      Math.random() * 10,
      (Math.random() - 0.5) * 50
    )
    clone.rotateX(Math.random() * Math.PI)
    clone.rotateY(Math.random() * Math.PI)
    geos.push(clone)
  }

  const merged = mergeGeometries(geos)!
  const mat = new THREE.MeshStandardMaterial({
    color: 0x44aa88,
    roughness: 0.5,
  })
  const mesh = new THREE.Mesh(merged, mat)
  mesh.castShadow = true
  scene.add(mesh)
  currentGroup = mesh
  currentMode = 'merged'
}

function clearScene() {
  if (currentGroup) {
    scene.remove(currentGroup)
    if (currentGroup instanceof THREE.Group) {
      currentGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose()
          if (child.material instanceof THREE.Material) child.material.dispose()
        }
      })
    } else if (currentGroup instanceof THREE.InstancedMesh) {
      currentGroup.geometry.dispose()
      if (currentGroup.material instanceof THREE.Material) currentGroup.material.dispose()
    } else if (currentGroup instanceof THREE.Mesh) {
      currentGroup.geometry.dispose()
      if (currentGroup.material instanceof THREE.Material) currentGroup.material.dispose()
    }
    currentGroup = null
  }
}

// ── LOD 데모 ──
const lod = new THREE.LOD()

const highDetail = new THREE.Mesh(
  new THREE.SphereGeometry(2, 64, 32),
  new THREE.MeshStandardMaterial({ color: 0xff4444, roughness: 0.3, wireframe: false })
)
const midDetail = new THREE.Mesh(
  new THREE.SphereGeometry(2, 16, 8),
  new THREE.MeshStandardMaterial({ color: 0xffaa44, roughness: 0.3, wireframe: false })
)
const lowDetail = new THREE.Mesh(
  new THREE.SphereGeometry(2, 6, 4),
  new THREE.MeshStandardMaterial({ color: 0xff4444, roughness: 0.3, flatShading: true, wireframe: false })
)

lod.addLevel(highDetail, 0)
lod.addLevel(midDetail, 15)
lod.addLevel(lowDetail, 30)
lod.position.set(-20, 2, 0)
scene.add(lod)

// LOD 라벨
function createLabel(text: string, position: THREE.Vector3, color = '#ffffff') {
  const c = document.createElement('canvas')
  c.width = 300; c.height = 64
  const ctx = c.getContext('2d')!
  ctx.fillStyle = color
  ctx.font = 'bold 22px monospace'
  ctx.textAlign = 'center'
  ctx.fillText(text, 150, 44)
  const texture = new THREE.CanvasTexture(c)
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true })
  )
  sprite.position.copy(position)
  sprite.scale.set(3, 0.6, 1)
  scene.add(sprite)
}
createLabel('LOD Demo', new THREE.Vector3(-20, 5, 0), '#ff4444')
createLabel('zoom in/out', new THREE.Vector3(-20, 4.2, 0), '#8b949e')

// ── 버튼 ──
document.getElementById('btn-individual')?.addEventListener('click', () => {
  createIndividual()
  updateButtons()
})
document.getElementById('btn-instanced')?.addEventListener('click', () => {
  createInstanced()
  updateButtons()
})
document.getElementById('btn-merged')?.addEventListener('click', () => {
  createMerged()
  updateButtons()
})

function updateButtons() {
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('active', (btn as HTMLElement).dataset.mode === currentMode)
  })
}

// 초기 모드
createIndividual()
updateButtons()

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

  // FPS 계산
  frameCount++
  const now = performance.now()
  if (now - lastFpsTime >= 500) {
    fps = Math.round(frameCount / ((now - lastFpsTime) / 1000))
    frameCount = 0
    lastFpsTime = now
  }

  const info = renderer.info.render
  const lodLevel = lod.getCurrentLevel()
  const lodVerts = lodLevel === 0 ? '64×32' : lodLevel === 1 ? '16×8' : '6×4'

  infoDiv.innerHTML = `
    <span>mode: ${currentMode}</span>
    <span>objects: ${COUNT.toLocaleString()}</span>
    <span>draw calls: ${info.calls}</span>
    <span>triangles: ${info.triangles.toLocaleString()}</span>
    <span style="color:${fps >= 55 ? '#7ee787' : fps >= 30 ? '#ffaa44' : '#ff4444'}">FPS: ${fps}</span>
    <span>LOD level: ${lodLevel} (${lodVerts})</span>
  `

  controls.update()
  renderer.render(scene, camera)
}
animate()
