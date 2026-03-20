import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import GUI from 'lil-gui'

const canvas = document.getElementById('c') as HTMLCanvasElement
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setClearColor(0x0a0a1a)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 500)
camera.position.set(0, 15, 20)

const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true

// 조명
const dirLight = new THREE.DirectionalLight(0xffffff, 1.5)
dirLight.position.set(10, 20, 10)
dirLight.castShadow = true
dirLight.shadow.mapSize.set(1024, 1024)
dirLight.shadow.camera.left = -25
dirLight.shadow.camera.right = 25
dirLight.shadow.camera.top = 25
dirLight.shadow.camera.bottom = -25
dirLight.shadow.camera.far = 60
scene.add(dirLight)

const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x362907, 0.4)
scene.add(hemiLight)

// ── 노이즈 함수 ──
function hash2(x: number, y: number): number {
  let n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return n - Math.floor(n)
}

function smoothNoise(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y)
  const fx = x - ix, fy = y - iy
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy)
  const a = hash2(ix, iy), b = hash2(ix + 1, iy)
  const c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1)
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy
}

function fbm(x: number, y: number, octaves: number, lac = 2.0, gain = 0.5): number {
  let v = 0, amp = 1, freq = 1, max = 0
  for (let i = 0; i < octaves; i++) {
    v += smoothNoise(x * freq, y * freq) * amp
    max += amp; amp *= gain; freq *= lac
  }
  return v / max
}

// seeded random
function seededRandom(seed: number) {
  let s = seed
  return () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647 }
}

// ── 공통 상태 ──
let currentDemo: THREE.Group | null = null
let gui: GUI | null = null
let animateCallback: ((t: number) => void) | null = null

function clearDemo() {
  if (currentDemo) {
    currentDemo.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose()
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose())
        else if (child.material instanceof THREE.Material) child.material.dispose()
      }
    })
    scene.remove(currentDemo)
    currentDemo = null
  }
  if (gui) { gui.destroy(); gui = null }
  animateCallback = null
}

// ══════════════════════════════════════════════
//  데모 1: 지형 (섬)
// ══════════════════════════════════════════════
function createTerrain() {
  clearDemo()
  const group = new THREE.Group()
  camera.position.set(0, 15, 20)
  controls.target.set(0, 0, 0)

  const p = { height: 8, scale: 3, octaves: 5, seed: 42, waterLevel: 0.3, wireframe: false }

  function build() {
    // clear previous
    while (group.children.length) {
      const c = group.children[0]
      if (c instanceof THREE.Mesh) { c.geometry.dispose(); (c.material as THREE.Material).dispose() }
      group.remove(c)
    }

    const geo = new THREE.PlaneGeometry(30, 30, 128, 128)
    geo.rotateX(-Math.PI / 2)
    const pos = geo.attributes.position
    const colors = new Float32Array(pos.count * 3)
    const so = p.seed * 100

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i)
      const nx = (x / 30 + 0.5) * p.scale + so
      const nz = (z / 30 + 0.5) * p.scale + so
      let h = fbm(nx, nz, p.octaves)
      const dx = x / 15, dz = z / 15
      h *= Math.max(0, 1 - Math.sqrt(dx * dx + dz * dz) * 1.2)
      pos.setY(i, h * p.height)

      let r, g, b
      if (h < p.waterLevel + 0.02) { r = 0.76; g = 0.7; b = 0.5 }
      else if (h < 0.45) { r = 0.2; g = 0.5; b = 0.15 }
      else if (h < 0.65) { r = 0.45; g = 0.42; b = 0.38 }
      else { const t = Math.min(1, (h - 0.65) / 0.2); r = 0.45 + t * 0.5; g = 0.42 + t * 0.5; b = 0.38 + t * 0.55 }
      colors[i * 3] = r; colors[i * 3 + 1] = g; colors[i * 3 + 2] = b
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.computeVertexNormals()

    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, wireframe: p.wireframe }))
    mesh.castShadow = true; mesh.receiveShadow = true
    group.add(mesh)

    const waterGeo = new THREE.PlaneGeometry(30, 30); waterGeo.rotateX(-Math.PI / 2)
    const water = new THREE.Mesh(waterGeo, new THREE.MeshStandardMaterial({ color: 0x1a6aa8, transparent: true, opacity: 0.6, roughness: 0.1 }))
    water.position.y = p.waterLevel * p.height; water.receiveShadow = true
    group.add(water)
  }
  build()

  gui = new GUI({ width: 240 })
  gui.domElement.style.position = 'absolute'; gui.domElement.style.top = '48px'; gui.domElement.style.right = '0'
  canvas.parentElement!.appendChild(gui.domElement)
  gui.add(p, 'height', 1, 20, 0.5).onChange(build)
  gui.add(p, 'scale', 0.5, 10, 0.1).onChange(build)
  gui.add(p, 'octaves', 1, 8, 1).onChange(build)
  gui.add(p, 'seed', 0, 100, 1).onChange(build).name('seed')
  gui.add(p, 'waterLevel', 0, 0.6, 0.05).onChange(build)
  gui.add(p, 'wireframe').onChange(build)

  scene.add(group)
  currentDemo = group

  animateCallback = (t) => {
    const water = group.children.find(c => c.position.y > 0) as THREE.Mesh | undefined
    if (water) water.position.y = p.waterLevel * p.height + Math.sin(t * 0.5) * 0.05
  }
}

// ══════════════════════════════════════════════
//  데모 2: 도시
// ══════════════════════════════════════════════
function createCity() {
  clearDemo()
  const group = new THREE.Group()
  camera.position.set(15, 20, 25)
  controls.target.set(0, 0, 0)

  const p = { gridSize: 10, maxHeight: 8, density: 0.7, seed: 42 }

  function build() {
    while (group.children.length) {
      const c = group.children[0]
      if (c instanceof THREE.Mesh) { c.geometry.dispose(); (c.material as THREE.Material).dispose() }
      group.remove(c)
    }

    const rand = seededRandom(p.seed)

    // 바닥
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(p.gridSize * 3, p.gridSize * 3),
      new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.9 })
    )
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true
    group.add(floor)

    // 도로 격자
    for (let i = -p.gridSize; i <= p.gridSize; i++) {
      const roadH = new THREE.Mesh(
        new THREE.PlaneGeometry(p.gridSize * 3, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x444444 })
      )
      roadH.rotation.x = -Math.PI / 2; roadH.position.set(0, 0.01, i * 2.5)
      group.add(roadH)

      const roadV = new THREE.Mesh(
        new THREE.PlaneGeometry(0.3, p.gridSize * 3),
        new THREE.MeshStandardMaterial({ color: 0x444444 })
      )
      roadV.rotation.x = -Math.PI / 2; roadV.position.set(i * 2.5, 0.01, 0)
      group.add(roadV)
    }

    // 건물
    for (let x = -p.gridSize + 1; x < p.gridSize; x++) {
      for (let z = -p.gridSize + 1; z < p.gridSize; z++) {
        if (rand() > p.density) continue

        const h = 0.5 + rand() * p.maxHeight
        const w = 0.8 + rand() * 1.0
        const d = 0.8 + rand() * 1.0

        const hue = 0.55 + rand() * 0.15
        const lightness = 0.15 + rand() * 0.25
        const color = new THREE.Color().setHSL(hue, 0.3, lightness)

        const geo = new THREE.BoxGeometry(w, h, d)
        const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.2 })
        const mesh = new THREE.Mesh(geo, mat)
        mesh.position.set(x * 2.5, h / 2, z * 2.5)
        mesh.castShadow = true; mesh.receiveShadow = true
        group.add(mesh)

        // 창문 발광 (높은 건물)
        if (h > 3 && rand() > 0.5) {
          const windowMat = new THREE.MeshStandardMaterial({
            color: 0x000000, emissive: 0xffddaa, emissiveIntensity: 0.5 + rand()
          })
          const windowGeo = new THREE.PlaneGeometry(w * 0.6, h * 0.7)
          const windowMesh = new THREE.Mesh(windowGeo, windowMat)
          windowMesh.position.set(x * 2.5, h * 0.5, z * 2.5 + d / 2 + 0.01)
          group.add(windowMesh)
        }
      }
    }
  }
  build()

  gui = new GUI({ width: 240 })
  gui.domElement.style.position = 'absolute'; gui.domElement.style.top = '48px'; gui.domElement.style.right = '0'
  canvas.parentElement!.appendChild(gui.domElement)
  gui.add(p, 'gridSize', 3, 15, 1).onChange(build)
  gui.add(p, 'maxHeight', 2, 20, 0.5).onChange(build)
  gui.add(p, 'density', 0.2, 1, 0.05).onChange(build)
  gui.add(p, 'seed', 0, 100, 1).onChange(build)

  scene.add(group)
  currentDemo = group
}

// ══════════════════════════════════════════════
//  데모 3: 나무 (재귀 분기)
// ══════════════════════════════════════════════
function createTrees() {
  clearDemo()
  const group = new THREE.Group()
  camera.position.set(0, 8, 15)
  controls.target.set(0, 3, 0)

  const p = { depth: 5, branchLength: 2, branchAngle: 30, shrink: 0.7, seed: 42, treeCount: 3 }

  function buildBranch(parent: THREE.Object3D, depth: number, length: number, rand: () => number) {
    if (depth <= 0) {
      // 잎
      const leafGeo = new THREE.SphereGeometry(0.3 + rand() * 0.3, 8, 6)
      const leafMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(0.25 + rand() * 0.1, 0.6, 0.3 + rand() * 0.2),
        roughness: 0.8,
      })
      const leaf = new THREE.Mesh(leafGeo, leafMat)
      leaf.position.y = length * 0.5
      leaf.castShadow = true
      parent.add(leaf)
      return
    }

    // 가지
    const thickness = 0.08 * depth
    const branchGeo = new THREE.CylinderGeometry(thickness * 0.6, thickness, length, 6)
    const branchMat = new THREE.MeshStandardMaterial({ color: 0x5c3a1a, roughness: 0.9 })
    const branch = new THREE.Mesh(branchGeo, branchMat)
    branch.position.y = length / 2
    branch.castShadow = true
    parent.add(branch)

    // 분기점
    const pivot = new THREE.Group()
    pivot.position.y = length
    parent.add(pivot)

    const numBranches = 2 + Math.floor(rand() * 2)
    for (let i = 0; i < numBranches; i++) {
      const child = new THREE.Group()
      const angle = (p.branchAngle + rand() * 15) * Math.PI / 180
      const azimuth = (i / numBranches) * Math.PI * 2 + rand() * 0.5
      child.rotation.z = angle * Math.cos(azimuth)
      child.rotation.x = angle * Math.sin(azimuth)
      pivot.add(child)
      buildBranch(child, depth - 1, length * p.shrink, rand)
    }
  }

  function build() {
    while (group.children.length) {
      group.children[0].traverse((c) => {
        if (c instanceof THREE.Mesh) { c.geometry.dispose(); (c.material as THREE.Material).dispose() }
      })
      group.remove(group.children[0])
    }

    // 바닥
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshStandardMaterial({ color: 0x2a4a1a, roughness: 0.9 })
    )
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true
    group.add(floor)

    for (let t = 0; t < p.treeCount; t++) {
      const rand = seededRandom(p.seed + t * 37)
      const tree = new THREE.Group()
      tree.position.set((t - (p.treeCount - 1) / 2) * 5, 0, 0)
      buildBranch(tree, p.depth, p.branchLength, rand)
      group.add(tree)
    }
  }
  build()

  gui = new GUI({ width: 240 })
  gui.domElement.style.position = 'absolute'; gui.domElement.style.top = '48px'; gui.domElement.style.right = '0'
  canvas.parentElement!.appendChild(gui.domElement)
  gui.add(p, 'depth', 1, 7, 1).onChange(build)
  gui.add(p, 'branchLength', 0.5, 4, 0.1).onChange(build)
  gui.add(p, 'branchAngle', 10, 60, 1).onChange(build)
  gui.add(p, 'shrink', 0.4, 0.9, 0.05).onChange(build)
  gui.add(p, 'treeCount', 1, 5, 1).onChange(build)
  gui.add(p, 'seed', 0, 100, 1).onChange(build)

  scene.add(group)
  currentDemo = group
}

// ══════════════════════════════════════════════
//  데모 4: 행성
// ══════════════════════════════════════════════
function createPlanet() {
  clearDemo()
  const group = new THREE.Group()
  camera.position.set(0, 2, 6)
  controls.target.set(0, 0, 0)

  const p = { radius: 2, detail: 64, noiseScale: 2.5, noiseHeight: 0.4, octaves: 4, seed: 42, waterLevel: 0.0 }

  function build() {
    while (group.children.length) {
      const c = group.children[0]
      if (c instanceof THREE.Mesh) { c.geometry.dispose(); (c.material as THREE.Material).dispose() }
      group.remove(c)
    }

    const geo = new THREE.SphereGeometry(p.radius, p.detail, p.detail)
    const pos = geo.attributes.position
    const colors = new Float32Array(pos.count * 3)
    const so = p.seed * 100

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
      const len = Math.sqrt(x * x + y * y + z * z)
      const nx = x / len, ny = y / len, nz = z / len

      // 3D 노이즈를 2D로 매핑 (구면 좌표)
      const theta = Math.atan2(nz, nx)
      const phi = Math.acos(ny)
      const h = fbm(theta * p.noiseScale + so, phi * p.noiseScale + so, p.octaves)

      const displacement = h * p.noiseHeight
      const newLen = p.radius + (displacement > p.waterLevel ? displacement : p.waterLevel)
      pos.setXYZ(i, nx * newLen, ny * newLen, nz * newLen)

      // 색상
      if (displacement < p.waterLevel + 0.02) {
        colors[i * 3] = 0.1; colors[i * 3 + 1] = 0.3; colors[i * 3 + 2] = 0.7
      } else if (displacement < 0.15) {
        colors[i * 3] = 0.76; colors[i * 3 + 1] = 0.7; colors[i * 3 + 2] = 0.5
      } else if (displacement < 0.25) {
        colors[i * 3] = 0.2; colors[i * 3 + 1] = 0.5; colors[i * 3 + 2] = 0.15
      } else {
        const t = Math.min(1, (displacement - 0.25) / 0.15)
        colors[i * 3] = 0.4 + t * 0.5; colors[i * 3 + 1] = 0.38 + t * 0.5; colors[i * 3 + 2] = 0.35 + t * 0.55
      }
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.computeVertexNormals()

    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }))
    mesh.castShadow = true
    group.add(mesh)

    // 대기 글로우
    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(p.radius * 1.05, 32, 16),
      new THREE.MeshBasicMaterial({ color: 0x6699ff, transparent: true, opacity: 0.08, side: THREE.BackSide })
    )
    group.add(atmo)
  }
  build()

  gui = new GUI({ width: 240 })
  gui.domElement.style.position = 'absolute'; gui.domElement.style.top = '48px'; gui.domElement.style.right = '0'
  canvas.parentElement!.appendChild(gui.domElement)
  gui.add(p, 'noiseScale', 0.5, 8, 0.1).onChange(build)
  gui.add(p, 'noiseHeight', 0.1, 1, 0.05).onChange(build)
  gui.add(p, 'octaves', 1, 6, 1).onChange(build)
  gui.add(p, 'waterLevel', -0.1, 0.2, 0.01).onChange(build)
  gui.add(p, 'seed', 0, 100, 1).onChange(build)

  scene.add(group)
  currentDemo = group

  animateCallback = (t) => {
    if (group.children[0]) group.children[0].rotation.y = t * 0.1
    if (group.children[1]) group.children[1].rotation.y = t * 0.08
  }
}

// ══════════════════════════════════════════════
//  데모 5: 동굴 (셀룰러 오토마타)
// ══════════════════════════════════════════════
function createCave() {
  clearDemo()
  const group = new THREE.Group()
  camera.position.set(0, 25, 5)
  controls.target.set(0, 0, 0)

  const p = { width: 40, fillProb: 0.45, iterations: 5, seed: 42, wallHeight: 2 }

  function build() {
    while (group.children.length) {
      const c = group.children[0]
      if (c instanceof THREE.Mesh) { c.geometry.dispose(); (c.material as THREE.Material).dispose() }
      group.remove(c)
    }

    const w = p.width
    const rand = seededRandom(p.seed)

    // 초기 그리드 (랜덤 채우기)
    let grid: number[][] = []
    for (let y = 0; y < w; y++) {
      grid[y] = []
      for (let x = 0; x < w; x++) {
        if (x === 0 || y === 0 || x === w - 1 || y === w - 1) grid[y][x] = 1
        else grid[y][x] = rand() < p.fillProb ? 1 : 0
      }
    }

    // 셀룰러 오토마타 반복
    for (let iter = 0; iter < p.iterations; iter++) {
      const next: number[][] = []
      for (let y = 0; y < w; y++) {
        next[y] = []
        for (let x = 0; x < w; x++) {
          let neighbors = 0
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue
              const nx = x + dx, ny = y + dy
              if (nx < 0 || ny < 0 || nx >= w || ny >= w) neighbors++
              else neighbors += grid[ny][nx]
            }
          }
          next[y][x] = neighbors >= 5 ? 1 : neighbors <= 3 ? 0 : grid[y][x]
        }
      }
      grid = next
    }

    // 바닥
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x3a3020, roughness: 0.9 })
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, w), floorMat)
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true
    group.add(floor)

    // 벽 블록
    const wallGeo = new THREE.BoxGeometry(1, p.wallHeight, 1)
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x554433, roughness: 0.85 })

    for (let y = 0; y < w; y++) {
      for (let x = 0; x < w; x++) {
        if (grid[y][x] === 1) {
          const mesh = new THREE.Mesh(wallGeo, wallMat)
          mesh.position.set(x - w / 2 + 0.5, p.wallHeight / 2, y - w / 2 + 0.5)
          mesh.castShadow = true; mesh.receiveShadow = true
          group.add(mesh)
        }
      }
    }
  }
  build()

  gui = new GUI({ width: 240 })
  gui.domElement.style.position = 'absolute'; gui.domElement.style.top = '48px'; gui.domElement.style.right = '0'
  canvas.parentElement!.appendChild(gui.domElement)
  gui.add(p, 'fillProb', 0.3, 0.6, 0.01).name('fill %').onChange(build)
  gui.add(p, 'iterations', 0, 10, 1).onChange(build)
  gui.add(p, 'wallHeight', 1, 5, 0.5).onChange(build)
  gui.add(p, 'seed', 0, 100, 1).onChange(build)

  scene.add(group)
  currentDemo = group
}

// ── 3D Text ──
const fontLoader = new FontLoader()
let textMesh: THREE.Mesh | null = null
fontLoader.load(
  'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json',
  (font) => {
    const textGeo = new TextGeometry('Procedural', {
      font, size: 1.5, depth: 0.3, curveSegments: 6,
      bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 3,
    })
    textGeo.center()
    const textMat = new THREE.MeshStandardMaterial({ color: 0x58a6ff, roughness: 0.3, metalness: 0.7 })
    textMesh = new THREE.Mesh(textGeo, textMat)
    textMesh.position.set(0, 12, 0)
    textMesh.castShadow = true
    scene.add(textMesh)
  }
)

// ── 모드 버튼 ──
const demos = [
  { id: 'btn-terrain', fn: createTerrain, name: '지형' },
  { id: 'btn-city', fn: createCity, name: '도시' },
  { id: 'btn-tree', fn: createTrees, name: '나무' },
  { id: 'btn-planet', fn: createPlanet, name: '행성' },
  { id: 'btn-cave', fn: createCave, name: '동굴' },
]

demos.forEach(({ id, fn }) => {
  document.getElementById(id)?.addEventListener('click', () => {
    fn()
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'))
    document.getElementById(id)!.classList.add('active')
  })
})

// 초기 데모
createTerrain()
document.getElementById('btn-terrain')?.classList.add('active')

// ── 정보 ──
const infoDiv = document.getElementById('info') as HTMLDivElement

// ── Resize ──
function resize() {
  const parent = canvas.parentElement!
  const w = parent.clientWidth, h = parent.clientHeight
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

  if (animateCallback) animateCallback(t)

  if (textMesh) {
    textMesh.position.y = 12 + Math.sin(t * 0.8) * 0.3
    textMesh.rotation.y = t * 0.15
  }

  const info = renderer.info.render
  infoDiv.innerHTML = `
    <span>triangles: ${info.triangles.toLocaleString()}</span>
    <span>draw calls: ${info.calls}</span>
  `

  controls.update()
  renderer.render(scene, camera)
}
animate()
