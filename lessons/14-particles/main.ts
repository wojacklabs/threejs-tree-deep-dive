import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const canvas = document.getElementById('c') as HTMLCanvasElement
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setClearColor(0x020208)

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 200)
camera.position.set(0, 3, 6)

const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true

// ══════════════════════════════════════════════
//  데모 1: 기본 Points — 랜덤 별
// ══════════════════════════════════════════════
const starCount = 2000
const starPositions = new Float32Array(starCount * 3)

for (let i = 0; i < starCount; i++) {
  const i3 = i * 3
  starPositions[i3] = (Math.random() - 0.5) * 100
  starPositions[i3 + 1] = (Math.random() - 0.5) * 100
  starPositions[i3 + 2] = (Math.random() - 0.5) * 100
}

const starGeo = new THREE.BufferGeometry()
starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))

const stars = new THREE.Points(
  starGeo,
  new THREE.PointsMaterial({ color: 0xffffff, size: 0.15, sizeAttenuation: true })
)
scene.add(stars)

// ══════════════════════════════════════════════
//  데모 2: 은하 — 나선 분포 + 색상
// ══════════════════════════════════════════════
const galaxyParams = {
  count: 15000,
  radius: 5,
  branches: 4,
  spin: 1.5,
  randomness: 0.3,
  randomnessPow: 3,
  insideColor: '#ff6030',
  outsideColor: '#1b3984',
}

let galaxyGeo: THREE.BufferGeometry | null = null
let galaxyPoints: THREE.Points | null = null

function generateGalaxy() {
  // 기존 제거
  if (galaxyPoints) {
    galaxyGeo!.dispose()
    ;(galaxyPoints.material as THREE.PointsMaterial).dispose()
    scene.remove(galaxyPoints)
  }

  const { count, radius, branches, spin, randomness, randomnessPow, insideColor, outsideColor } = galaxyParams

  galaxyGeo = new THREE.BufferGeometry()

  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)

  const colorInside = new THREE.Color(insideColor)
  const colorOutside = new THREE.Color(outsideColor)

  for (let i = 0; i < count; i++) {
    const i3 = i * 3

    // 중심에서의 거리 (0~radius)
    const r = Math.random() * radius

    // 나선 가지 각도
    const branchAngle = (i % branches) / branches * Math.PI * 2

    // 스핀 (거리에 비례해서 각도 추가)
    const spinAngle = r * spin

    // 랜덤 오프셋 (중심에 가까울수록 적게)
    const randomX = Math.pow(Math.random(), randomnessPow) * (Math.random() < 0.5 ? 1 : -1) * randomness * r
    const randomY = Math.pow(Math.random(), randomnessPow) * (Math.random() < 0.5 ? 1 : -1) * randomness * r * 0.3
    const randomZ = Math.pow(Math.random(), randomnessPow) * (Math.random() < 0.5 ? 1 : -1) * randomness * r

    positions[i3] = Math.cos(branchAngle + spinAngle) * r + randomX
    positions[i3 + 1] = randomY
    positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * r + randomZ

    // 색상: 중심=주황, 외곽=파랑
    const mixedColor = colorInside.clone().lerp(colorOutside, r / radius)
    colors[i3] = mixedColor.r
    colors[i3 + 1] = mixedColor.g
    colors[i3 + 2] = mixedColor.b
  }

  galaxyGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  galaxyGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3))

  const material = new THREE.PointsMaterial({
    size: 0.03,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
  })

  galaxyPoints = new THREE.Points(galaxyGeo, material)
  scene.add(galaxyPoints)
}

generateGalaxy()

// ══════════════════════════════════════════════
//  데모 3: 파티클 분수 (위로 솟아올랐다 떨어짐)
// ══════════════════════════════════════════════
const fountainCount = 3000

const fPositions = new Float32Array(fountainCount * 3)
const fVelocities = new Float32Array(fountainCount * 3)
const fColors = new Float32Array(fountainCount * 3)
const fLifetimes = new Float32Array(fountainCount)

function resetParticle(i: number) {
  const i3 = i * 3
  fPositions[i3] = 8
  fPositions[i3 + 1] = 0
  fPositions[i3 + 2] = 0

  fVelocities[i3] = (Math.random() - 0.5) * 0.8
  fVelocities[i3 + 1] = 2 + Math.random() * 3
  fVelocities[i3 + 2] = (Math.random() - 0.5) * 0.8

  fLifetimes[i] = Math.random() * 3

  const t = Math.random()
  fColors[i3] = 0.2 + t * 0.8
  fColors[i3 + 1] = 0.5 + t * 0.3
  fColors[i3 + 2] = 1.0
}

for (let i = 0; i < fountainCount; i++) {
  resetParticle(i)
  fLifetimes[i] = Math.random() * 3 // 시작 시 분산
}

const fountainGeo = new THREE.BufferGeometry()
fountainGeo.setAttribute('position', new THREE.BufferAttribute(fPositions, 3))
fountainGeo.setAttribute('color', new THREE.BufferAttribute(fColors, 3))

const fountainPoints = new THREE.Points(
  fountainGeo,
  new THREE.PointsMaterial({
    size: 0.04,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    transparent: true,
  })
)
scene.add(fountainPoints)

// 분수 기둥 라벨
function createLabel(text: string, position: THREE.Vector3, color = '#ffffff') {
  const c = document.createElement('canvas')
  c.width = 256; c.height = 64
  const ctx = c.getContext('2d')!
  ctx.fillStyle = color
  ctx.font = 'bold 22px monospace'
  ctx.textAlign = 'center'
  ctx.fillText(text, 128, 44)
  const texture = new THREE.CanvasTexture(c)
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true })
  )
  sprite.position.copy(position)
  sprite.scale.set(2.5, 0.6, 1)
  scene.add(sprite)
}

createLabel('Galaxy (15k)', new THREE.Vector3(0, 4, 0), '#ff6030')
createLabel('Fountain (3k)', new THREE.Vector3(8, 5, 0), '#4488ff')

// ── 정보 표시 ──
const infoDiv = document.getElementById('info') as HTMLDivElement

// ── 파라미터 버튼 ──
document.getElementById('btn-branches')?.addEventListener('click', () => {
  galaxyParams.branches = (galaxyParams.branches % 8) + 1
  generateGalaxy()
  const btn = document.getElementById('btn-branches') as HTMLButtonElement
  btn.textContent = `Branches: ${galaxyParams.branches}`
})

document.getElementById('btn-spin')?.addEventListener('click', () => {
  galaxyParams.spin = galaxyParams.spin >= 3 ? 0.5 : galaxyParams.spin + 0.5
  generateGalaxy()
  const btn = document.getElementById('btn-spin') as HTMLButtonElement
  btn.textContent = `Spin: ${galaxyParams.spin.toFixed(1)}`
})

document.getElementById('btn-count')?.addEventListener('click', () => {
  const counts = [5000, 15000, 30000, 50000]
  const idx = (counts.indexOf(galaxyParams.count) + 1) % counts.length
  galaxyParams.count = counts[idx]
  generateGalaxy()
  const btn = document.getElementById('btn-count') as HTMLButtonElement
  btn.textContent = `Count: ${(galaxyParams.count / 1000).toFixed(0)}k`
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
  const delta = clock.getDelta()
  const elapsed = clock.elapsedTime

  // 은하 천천히 회전
  if (galaxyPoints) {
    galaxyPoints.rotation.y = elapsed * 0.05
  }

  // 분수 파티클 업데이트
  const gravity = -9.8
  for (let i = 0; i < fountainCount; i++) {
    const i3 = i * 3
    fLifetimes[i] -= delta

    if (fLifetimes[i] <= 0) {
      resetParticle(i)
      continue
    }

    // 속도에 중력 적용
    fVelocities[i3 + 1] += gravity * delta

    // 위치 업데이트
    fPositions[i3] += fVelocities[i3] * delta
    fPositions[i3 + 1] += fVelocities[i3 + 1] * delta
    fPositions[i3 + 2] += fVelocities[i3 + 2] * delta

    // 바닥 아래로 가면 리셋
    if (fPositions[i3 + 1] < -0.5) {
      resetParticle(i)
    }
  }
  fountainGeo.attributes.position.needsUpdate = true

  // 정보 표시
  const totalParticles = starCount + galaxyParams.count + fountainCount
  infoDiv.innerHTML = `
    <span>total particles: ${totalParticles.toLocaleString()}</span>
    <span>stars: ${starCount}</span>
    <span>galaxy: ${galaxyParams.count.toLocaleString()}</span>
    <span>fountain: ${fountainCount}</span>
  `

  controls.update()
  renderer.render(scene, camera)
}
animate()
