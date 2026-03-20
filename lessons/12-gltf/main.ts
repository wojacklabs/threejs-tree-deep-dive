import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const canvas = document.getElementById('c') as HTMLCanvasElement
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setClearColor(0x0d1117)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.2

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100)
camera.position.set(0, 1.5, 3)

const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true
controls.target.set(0, 0.5, 0)

// 조명
const dirLight = new THREE.DirectionalLight(0xffffff, 2)
dirLight.position.set(3, 5, 4)
dirLight.castShadow = true
dirLight.shadow.mapSize.set(1024, 1024)
dirLight.shadow.camera.left = -3
dirLight.shadow.camera.right = 3
dirLight.shadow.camera.top = 3
dirLight.shadow.camera.bottom = -3
scene.add(dirLight)

const fillLight = new THREE.DirectionalLight(0x8888ff, 0.5)
fillLight.position.set(-3, 2, -2)
scene.add(fillLight)

scene.add(new THREE.AmbientLight(0xffffff, 0.3))

// 바닥
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(10, 10),
  new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 })
)
floor.rotation.x = -Math.PI / 2
floor.receiveShadow = true
scene.add(floor)

const grid = new THREE.GridHelper(10, 10, 0x333333, 0x1a1a1a)
scene.add(grid)

// ── 로딩 UI ──
const progressBar = document.getElementById('progress-bar') as HTMLDivElement
const progressText = document.getElementById('progress-text') as HTMLSpanElement
const sceneTreeDiv = document.getElementById('scene-tree') as HTMLDivElement

// ── GLTF 로딩 ──
const loader = new GLTFLoader()

let loadedModel: THREE.Group | null = null

loader.load(
  '/models/DamagedHelmet.glb',

  // onLoad
  (gltf) => {
    const model = gltf.scene
    loadedModel = model

    // 모델 위치/스케일 조정
    model.position.set(0, 0.8, 0)

    // 모든 mesh에 그림자 설정
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })

    scene.add(model)

    // 로딩 UI 숨기기
    progressBar.parentElement!.style.display = 'none'

    // 씬 그래프 표시
    displaySceneTree(model)

    // 모델 정보
    let meshCount = 0
    let vertexCount = 0
    let triangleCount = 0
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        meshCount++
        const geo = child.geometry
        vertexCount += geo.attributes.position.count
        if (geo.index) {
          triangleCount += geo.index.count / 3
        } else {
          triangleCount += geo.attributes.position.count / 3
        }
      }
    })

    const infoDiv = document.getElementById('model-info') as HTMLDivElement
    infoDiv.innerHTML = `
      <span>meshes: ${meshCount}</span>
      <span>vertices: ${vertexCount.toLocaleString()}</span>
      <span>triangles: ${triangleCount.toLocaleString()}</span>
    `

    // 애니메이션 정보
    if (gltf.animations.length > 0) {
      infoDiv.innerHTML += `<span>animations: ${gltf.animations.length}</span>`
    }
  },

  // onProgress
  (xhr) => {
    if (xhr.lengthComputable) {
      const percent = (xhr.loaded / xhr.total) * 100
      progressBar.style.width = `${percent}%`
      progressText.textContent = `Loading... ${percent.toFixed(0)}%`
    }
  },

  // onError
  (error) => {
    progressText.textContent = 'Loading failed!'
    console.error('GLTF load error:', error)
  }
)

// ── 씬 그래프 표시 ──
function displaySceneTree(root: THREE.Object3D) {
  let html = ''

  function walk(obj: THREE.Object3D, depth: number) {
    const indent = '  '.repeat(depth)
    const type = obj.type
    const name = obj.name || '(unnamed)'

    let extra = ''
    if (obj instanceof THREE.Mesh) {
      const geo = obj.geometry
      const verts = geo.attributes.position.count
      extra = ` [${verts} verts]`
    }

    const color = obj instanceof THREE.Mesh ? '#58a6ff' :
                  obj instanceof THREE.Group ? '#7ee787' :
                  '#8b949e'

    html += `<span style="color:${color}">${indent}${type}: ${name}${extra}</span>\n`

    for (const child of obj.children) {
      walk(child, depth + 1)
    }
  }

  walk(root, 0)
  sceneTreeDiv.innerHTML = html
}

// ── 버튼 ──
document.getElementById('btn-wireframe')?.addEventListener('click', () => {
  if (!loadedModel) return
  loadedModel.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const mat = child.material as THREE.MeshStandardMaterial
      mat.wireframe = !mat.wireframe
    }
  })
  const btn = document.getElementById('btn-wireframe') as HTMLButtonElement
  btn.textContent = btn.textContent === 'Wireframe: OFF' ? 'Wireframe: ON' : 'Wireframe: OFF'
})

document.getElementById('btn-normals')?.addEventListener('click', () => {
  if (!loadedModel) return
  loadedModel.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      if (child.userData.originalMaterial) {
        child.material = child.userData.originalMaterial
        delete child.userData.originalMaterial
      } else {
        child.userData.originalMaterial = child.material
        child.material = new THREE.MeshNormalMaterial()
      }
    }
  })
  const btn = document.getElementById('btn-normals') as HTMLButtonElement
  btn.textContent = btn.textContent === 'Normal View: OFF' ? 'Normal View: ON' : 'Normal View: OFF'
})

let autoRotate = false
document.getElementById('btn-rotate')?.addEventListener('click', () => {
  autoRotate = !autoRotate
  const btn = document.getElementById('btn-rotate') as HTMLButtonElement
  btn.textContent = autoRotate ? 'Rotate: ON' : 'Rotate: OFF'
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

  if (loadedModel && autoRotate) {
    loadedModel.rotation.y = t * 0.5
  }

  controls.update()
  renderer.render(scene, camera)
}
animate()
