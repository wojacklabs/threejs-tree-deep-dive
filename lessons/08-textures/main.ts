import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const canvas = document.getElementById('c') as HTMLCanvasElement
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setClearColor(0x0d1117)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100)
camera.position.set(0, 3, 8)

const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true

// 조명
const dirLight = new THREE.DirectionalLight(0xffffff, 2)
dirLight.position.set(3, 6, 4)
dirLight.castShadow = true
dirLight.shadow.mapSize.set(1024, 1024)
dirLight.shadow.camera.left = -8
dirLight.shadow.camera.right = 8
dirLight.shadow.camera.top = 8
dirLight.shadow.camera.bottom = -8
scene.add(dirLight)

const ambient = new THREE.AmbientLight(0xffffff, 0.3)
scene.add(ambient)

// ── 텍스처 생성 유틸 (Canvas 2D로 프로시져럴 텍스처) ──
function createCheckerTexture(size: number, cells: number, c1: string, c2: string): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = size; c.height = size
  const ctx = c.getContext('2d')!
  const cellSize = size / cells
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? c1 : c2
      ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize)
    }
  }
  const tex = new THREE.CanvasTexture(c)
  tex.magFilter = THREE.NearestFilter
  return tex
}

function createBrickTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 256; c.height = 256
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#8B4513'
  ctx.fillRect(0, 0, 256, 256)
  const bw = 60, bh = 28, gap = 4
  for (let row = 0; row < 9; row++) {
    const offset = row % 2 === 0 ? 0 : bw / 2 + gap / 2
    for (let col = -1; col < 5; col++) {
      const x = col * (bw + gap) + offset
      const y = row * (bh + gap)
      const r = 130 + Math.random() * 40
      const g = 50 + Math.random() * 30
      const b = 20 + Math.random() * 20
      ctx.fillStyle = `rgb(${r},${g},${b})`
      ctx.fillRect(x, y, bw, bh)
    }
  }
  return new THREE.CanvasTexture(c)
}

function createBrickNormalMap(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 256; c.height = 256
  const ctx = c.getContext('2d')!
  // 기본 법선 (0.5, 0.5, 1.0) = 평면
  ctx.fillStyle = '#8080ff'
  ctx.fillRect(0, 0, 256, 256)
  // 줄눈 부분은 법선을 변경 (움푹 들어간 느낌)
  const bw = 60, bh = 28, gap = 4
  ctx.fillStyle = '#7070d0'
  for (let row = 0; row < 9; row++) {
    const y = row * (bh + gap) + bh
    ctx.fillRect(0, y, 256, gap)
  }
  for (let row = 0; row < 9; row++) {
    const offset = row % 2 === 0 ? 0 : bw / 2 + gap / 2
    for (let col = -1; col < 5; col++) {
      const x = col * (bw + gap) + offset + bw
      const y = row * (bh + gap)
      ctx.fillRect(x, y, gap, bh)
    }
  }
  return new THREE.CanvasTexture(c)
}

function createWoodTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 256; c.height = 256
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#DEB887'
  ctx.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 40; i++) {
    const y = i * 6 + Math.random() * 3
    ctx.strokeStyle = `rgba(139,90,43,${0.2 + Math.random() * 0.3})`
    ctx.lineWidth = 1 + Math.random() * 2
    ctx.beginPath()
    ctx.moveTo(0, y)
    for (let x = 0; x < 256; x += 20) {
      ctx.lineTo(x, y + Math.random() * 4 - 2)
    }
    ctx.stroke()
  }
  return new THREE.CanvasTexture(c)
}

function createRoughnessMap(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 256; c.height = 256
  const ctx = c.getContext('2d')!
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const v = 100 + Math.random() * 100
      ctx.fillStyle = `rgb(${v},${v},${v})`
      ctx.fillRect(x, y, 1, 1)
    }
  }
  return new THREE.CanvasTexture(c)
}

// 라벨
function createLabel(text: string, position: THREE.Vector3, color = '#ffffff') {
  const c = document.createElement('canvas')
  c.width = 400; c.height = 64
  const ctx = c.getContext('2d')!
  ctx.fillStyle = color
  ctx.font = 'bold 20px monospace'
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
//  섹션 1: 기본 텍스처 (map)
// ══════════════════════════════════════════════
const row1Z = 3

// 체커보드
const checkerTex = createCheckerTexture(256, 8, '#ffffff', '#333333')
const checkerBox = new THREE.Mesh(
  new THREE.BoxGeometry(1.5, 1.5, 1.5),
  new THREE.MeshStandardMaterial({ map: checkerTex, roughness: 0.6 })
)
checkerBox.position.set(-4, 0.75, row1Z)
checkerBox.castShadow = true
scene.add(checkerBox)
createLabel('map (color)', new THREE.Vector3(-4, 2.3, row1Z))

// 벽돌 텍스처
const brickTex = createBrickTexture()
const brickBox = new THREE.Mesh(
  new THREE.BoxGeometry(1.5, 1.5, 1.5),
  new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.8 })
)
brickBox.position.set(-1.5, 0.75, row1Z)
brickBox.castShadow = true
scene.add(brickBox)
createLabel('brick texture', new THREE.Vector3(-1.5, 2.3, row1Z))

// 나무 텍스처
const woodTex = createWoodTexture()
const woodBox = new THREE.Mesh(
  new THREE.BoxGeometry(1.5, 1.5, 1.5),
  new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.7 })
)
woodBox.position.set(1.5, 0.75, row1Z)
woodBox.castShadow = true
scene.add(woodBox)
createLabel('wood texture', new THREE.Vector3(1.5, 2.3, row1Z))

// 텍스처 없음 (비교)
const plainBox = new THREE.Mesh(
  new THREE.BoxGeometry(1.5, 1.5, 1.5),
  new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.7 })
)
plainBox.position.set(4, 0.75, row1Z)
plainBox.castShadow = true
scene.add(plainBox)
createLabel('no texture', new THREE.Vector3(4, 2.3, row1Z))

// ══════════════════════════════════════════════
//  섹션 2: Normal Map
// ══════════════════════════════════════════════
const row2Z = 0

const brickNormal = createBrickNormalMap()

// normal map 없이
const noNormal = new THREE.Mesh(
  new THREE.SphereGeometry(0.8, 32, 16),
  new THREE.MeshStandardMaterial({ map: brickTex.clone(), roughness: 0.8 })
)
noNormal.position.set(-2, 0.8, row2Z)
noNormal.castShadow = true
scene.add(noNormal)
createLabel('without normalMap', new THREE.Vector3(-2, 2.2, row2Z))

// normal map 적용
const withNormal = new THREE.Mesh(
  new THREE.SphereGeometry(0.8, 32, 16),
  new THREE.MeshStandardMaterial({
    map: brickTex.clone(),
    normalMap: brickNormal,
    normalScale: new THREE.Vector2(1.5, 1.5),
    roughness: 0.8,
  })
)
withNormal.position.set(2, 0.8, row2Z)
withNormal.castShadow = true
scene.add(withNormal)
createLabel('with normalMap', new THREE.Vector3(2, 2.2, row2Z))

createLabel('← 비교: normalMap 유무 →', new THREE.Vector3(0, 2.2, row2Z), '#58a6ff')

// ══════════════════════════════════════════════
//  섹션 3: roughnessMap
// ══════════════════════════════════════════════
const row3Z = -3

const roughMap = createRoughnessMap()

const uniformRough = new THREE.Mesh(
  new THREE.SphereGeometry(0.8, 32, 16),
  new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.3, metalness: 0.8 })
)
uniformRough.position.set(-2, 0.8, row3Z)
uniformRough.castShadow = true
scene.add(uniformRough)
createLabel('uniform roughness', new THREE.Vector3(-2, 2.2, row3Z))

const variedRough = new THREE.Mesh(
  new THREE.SphereGeometry(0.8, 32, 16),
  new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    roughness: 1.0,
    metalness: 0.8,
    roughnessMap: roughMap,
  })
)
variedRough.position.set(2, 0.8, row3Z)
variedRough.castShadow = true
scene.add(variedRough)
createLabel('with roughnessMap', new THREE.Vector3(2, 2.2, row3Z))

createLabel('← 비교: roughnessMap 유무 →', new THREE.Vector3(0, 2.2, row3Z), '#58a6ff')

// ══════════════════════════════════════════════
//  섹션 4: Wrap & Repeat
// ══════════════════════════════════════════════
const row4Z = -6

const repeatTex = createCheckerTexture(256, 4, '#4488ff', '#112244')
repeatTex.wrapS = THREE.RepeatWrapping
repeatTex.wrapT = THREE.RepeatWrapping
repeatTex.repeat.set(3, 3)

const repeatPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(3, 3),
  new THREE.MeshStandardMaterial({ map: repeatTex, roughness: 0.5 })
)
repeatPlane.rotation.x = -Math.PI / 2
repeatPlane.position.set(-2, 0.01, row4Z)
repeatPlane.receiveShadow = true
scene.add(repeatPlane)
createLabel('repeat(3,3)', new THREE.Vector3(-2, 1.5, row4Z))

const mirrorTex = createCheckerTexture(256, 4, '#44ff88', '#112211')
mirrorTex.wrapS = THREE.MirroredRepeatWrapping
mirrorTex.wrapT = THREE.MirroredRepeatWrapping
mirrorTex.repeat.set(2, 2)

const mirrorPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(3, 3),
  new THREE.MeshStandardMaterial({ map: mirrorTex, roughness: 0.5 })
)
mirrorPlane.rotation.x = -Math.PI / 2
mirrorPlane.position.set(2, 0.01, row4Z)
mirrorPlane.receiveShadow = true
scene.add(mirrorPlane)
createLabel('mirroredRepeat(2,2)', new THREE.Vector3(2, 1.5, row4Z))

// ── 바닥 ──
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 })
)
floor.rotation.x = -Math.PI / 2
floor.position.y = -0.01
floor.receiveShadow = true
scene.add(floor)

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

  checkerBox.rotation.y = t * 0.3
  brickBox.rotation.y = t * 0.3
  woodBox.rotation.y = t * 0.3

  noNormal.rotation.y = t * 0.3
  withNormal.rotation.y = t * 0.3

  uniformRough.rotation.y = t * 0.3
  variedRough.rotation.y = t * 0.3

  controls.update()
  renderer.render(scene, camera)
}
animate()
