import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import GUI from 'lil-gui'

const canvas = document.getElementById('c') as HTMLCanvasElement
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setClearColor(0x0d1117)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100)
camera.position.set(0, 3, 8)

const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true
controls.target.set(0, 1, 0)

// ══════════════════════════════════════════════
//  LoadingManager — 리소스 로딩 관리
// ══════════════════════════════════════════════
const loadingScreen = document.getElementById('loading-screen') as HTMLDivElement
const loadingBar = document.getElementById('loading-bar') as HTMLDivElement
const loadingText = document.getElementById('loading-text') as HTMLSpanElement

const loadingManager = new THREE.LoadingManager()

loadingManager.onStart = (_url, loaded, total) => {
  loadingScreen.style.display = 'flex'
  loadingText.textContent = `Loading... ${loaded}/${total}`
}

loadingManager.onProgress = (_url, loaded, total) => {
  const progress = loaded / total
  loadingBar.style.width = `${progress * 100}%`
  loadingText.textContent = `Loading... ${loaded}/${total}`
}

loadingManager.onLoad = () => {
  loadingScreen.style.opacity = '0'
  setTimeout(() => { loadingScreen.style.display = 'none' }, 500)
}

loadingManager.onError = (url) => {
  loadingText.textContent = `Failed: ${url}`
}

// 모든 로더에 loadingManager 연결
const textureLoader = new THREE.TextureLoader(loadingManager)
const gltfLoader = new GLTFLoader(loadingManager)

// ══════════════════════════════════════════════
//  Room 클래스 — 코드 구조화 예시
// ══════════════════════════════════════════════
class Room {
  group: THREE.Group
  private meshes: THREE.Mesh[] = []
  private lights: THREE.Light[] = []
  private disposed = false

  constructor(
    public name: string,
    public position: THREE.Vector3,
    public size: THREE.Vector3,
    public color: number
  ) {
    this.group = new THREE.Group()
    this.group.position.copy(position)
    this.build()
  }

  private build() {
    const { size, color } = this

    // 바닥
    const floor = this.createMesh(
      new THREE.PlaneGeometry(size.x, size.z),
      new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.8 }),
    )
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true

    // 뒷벽
    const backWall = this.createMesh(
      new THREE.PlaneGeometry(size.x, size.y),
      new THREE.MeshStandardMaterial({ color, roughness: 0.7 }),
    )
    backWall.position.set(0, size.y / 2, -size.z / 2)
    backWall.receiveShadow = true

    // 왼쪽 벽
    const leftWall = this.createMesh(
      new THREE.PlaneGeometry(size.z, size.y),
      new THREE.MeshStandardMaterial({ color, roughness: 0.7 }),
    )
    leftWall.position.set(-size.x / 2, size.y / 2, 0)
    leftWall.rotation.y = Math.PI / 2
    leftWall.receiveShadow = true

    // 오른쪽 벽
    const rightWall = this.createMesh(
      new THREE.PlaneGeometry(size.z, size.y),
      new THREE.MeshStandardMaterial({ color, roughness: 0.7 }),
    )
    rightWall.position.set(size.x / 2, size.y / 2, 0)
    rightWall.rotation.y = -Math.PI / 2
    rightWall.receiveShadow = true

    // 오브젝트 몇 개
    const centerObj = this.createMesh(
      new THREE.TorusKnotGeometry(0.4, 0.15, 64, 16),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.7 }),
    )
    centerObj.position.set(0, 1.2, 0)
    centerObj.castShadow = true

    // 조명
    const pointLight = new THREE.PointLight(color, 4, 12)
    pointLight.position.set(0, size.y - 0.5, 0)
    pointLight.castShadow = true
    pointLight.shadow.mapSize.set(512, 512)
    this.group.add(pointLight)
    this.lights.push(pointLight)
  }

  private createMesh(geo: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh {
    const mesh = new THREE.Mesh(geo, mat)
    this.group.add(mesh)
    this.meshes.push(mesh)
    return mesh
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true

    for (const mesh of this.meshes) {
      mesh.geometry.dispose()
      if (mesh.material instanceof THREE.Material) mesh.material.dispose()
    }
    for (const light of this.lights) {
      if (light.shadow?.map) light.shadow.map.dispose()
    }
    this.meshes.length = 0
    this.lights.length = 0
  }

  update(t: number) {
    const obj = this.meshes[this.meshes.length - 1]
    if (obj) {
      obj.rotation.y = t * 0.5
      obj.rotation.x = t * 0.3
    }
  }
}

// ══════════════════════════════════════════════
//  씬 구성 — 여러 방
// ══════════════════════════════════════════════
const roomSize = new THREE.Vector3(5, 3.5, 5)
const rooms: Room[] = []

const roomConfigs = [
  { name: 'Red Room', pos: new THREE.Vector3(-6, 0, 0), color: 0x884444 },
  { name: 'Blue Room', pos: new THREE.Vector3(0, 0, 0), color: 0x446688 },
  { name: 'Green Room', pos: new THREE.Vector3(6, 0, 0), color: 0x448844 },
]

for (const config of roomConfigs) {
  const room = new Room(config.name, config.pos, roomSize, config.color)
  rooms.push(room)
  scene.add(room.group)
}

// 환경광
scene.add(new THREE.AmbientLight(0xffffff, 0.5))

// 전체 방향광
const mainLight = new THREE.DirectionalLight(0xffffff, 1.0)
mainLight.position.set(5, 10, 8)
scene.add(mainLight)

// GLTF 모델을 Blue Room에 배치
gltfLoader.load('/models/DamagedHelmet.glb', (gltf) => {
  const model = gltf.scene
  model.scale.setScalar(0.5)
  model.position.set(1.5, 0.8, 1.5)
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) { child.castShadow = true; child.receiveShadow = true }
  })
  rooms[1].group.add(model)
})

// ══════════════════════════════════════════════
//  renderer.info — 메모리/렌더 모니터링
// ══════════════════════════════════════════════
const infoDiv = document.getElementById('info') as HTMLDivElement

// ══════════════════════════════════════════════
//  lil-gui — 방 관리
// ══════════════════════════════════════════════
const gui = new GUI({ width: 260 })
gui.domElement.style.position = 'absolute'
gui.domElement.style.top = '48px'
gui.domElement.style.right = '0'
canvas.parentElement!.appendChild(gui.domElement)

const roomFolder = gui.addFolder('Rooms')
const roomVisibility: Record<string, boolean> = {}
rooms.forEach((room) => {
  roomVisibility[room.name] = true
  roomFolder.add(roomVisibility, room.name).onChange((v: boolean) => {
    room.group.visible = v
  })
})

const memoryFolder = gui.addFolder('Memory')
const memActions = {
  disposeRedRoom: () => {
    if (rooms[0]) {
      rooms[0].dispose()
      scene.remove(rooms[0].group)
      rooms[0] = null!
      updateMemoryInfo()
    }
  },
  disposeGreenRoom: () => {
    if (rooms[2]) {
      rooms[2].dispose()
      scene.remove(rooms[2].group)
      rooms[2] = null!
      updateMemoryInfo()
    }
  },
  forceGC: () => {
    renderer.info.reset()
    updateMemoryInfo()
  }
}
memoryFolder.add(memActions, 'disposeRedRoom').name('Dispose Red Room')
memoryFolder.add(memActions, 'disposeGreenRoom').name('Dispose Green Room')
memoryFolder.add(memActions, 'forceGC').name('Reset renderer.info')

function updateMemoryInfo() {
  const mem = renderer.info.memory
  const activeRooms = rooms.filter(r => r !== null).length
  infoDiv.innerHTML = `
    <span>active rooms: ${activeRooms} / ${roomConfigs.length}</span>
    <span>geometries: ${mem.geometries}</span>
    <span>textures: ${mem.textures}</span>
    <span>draw calls: ${renderer.info.render.calls}</span>
    <span>triangles: ${renderer.info.render.triangles.toLocaleString()}</span>
  `
}

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

  rooms.forEach(room => room?.update(t))

  updateMemoryInfo()
  controls.update()
  renderer.render(scene, camera)
}
animate()
