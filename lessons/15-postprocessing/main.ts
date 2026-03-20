import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { GlitchPass } from 'three/examples/jsm/postprocessing/GlitchPass.js'
import { FilmPass } from 'three/examples/jsm/postprocessing/FilmPass.js'
import { RGBShiftShader } from 'three/examples/jsm/shaders/RGBShiftShader.js'
import { DotScreenShader } from 'three/examples/jsm/shaders/DotScreenShader.js'

const canvas = document.getElementById('c') as HTMLCanvasElement
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setClearColor(0x050510)
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.0

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100)
camera.position.set(0, 2, 5)

const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true

// ── 씬 구성: 네온 도시 느낌 ──
// 바닥
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8, metalness: 0.5 })
)
floor.rotation.x = -Math.PI / 2
scene.add(floor)

// 조명
const ambient = new THREE.AmbientLight(0xffffff, 0.15)
scene.add(ambient)

// 네온 오브젝트들 (emissive로 발광)
const neonColors = [0xff0066, 0x00ffff, 0xff6600, 0x66ff00, 0xaa00ff, 0xffff00]

// 발광 큐브들
for (let i = 0; i < 6; i++) {
  const color = neonColors[i]
  const mat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    emissive: new THREE.Color(color),
    emissiveIntensity: 2,
    roughness: 0.3,
    metalness: 0.8,
  })

  const geo = i % 2 === 0
    ? new THREE.BoxGeometry(0.6, 0.6 + Math.random() * 1.5, 0.6)
    : new THREE.TorusGeometry(0.3, 0.12, 16, 32)

  const mesh = new THREE.Mesh(geo, mat)
  const angle = (i / 6) * Math.PI * 2
  mesh.position.set(Math.cos(angle) * 2.5, geo.type === 'BoxGeometry' ? 0.3 + (geo.parameters.height ?? 1) / 2 : 0.8, Math.sin(angle) * 2.5)
  scene.add(mesh)
}

// 중앙 발광 구체
const glowSphere = new THREE.Mesh(
  new THREE.SphereGeometry(0.5, 32, 16),
  new THREE.MeshStandardMaterial({
    color: 0x000000,
    emissive: 0xff0088,
    emissiveIntensity: 3,
  })
)
glowSphere.position.y = 1.5
scene.add(glowSphere)

// 일반 오브젝트 (Bloom 대비용)
const normalBox = new THREE.Mesh(
  new THREE.BoxGeometry(0.8, 0.8, 0.8),
  new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.5 })
)
normalBox.position.set(0, 0.4, -2)
scene.add(normalBox)

// PointLight (네온 느낌)
const pinkLight = new THREE.PointLight(0xff0088, 2, 8)
pinkLight.position.set(0, 2, 0)
scene.add(pinkLight)

const cyanLight = new THREE.PointLight(0x00ffff, 1.5, 8)
cyanLight.position.set(-2, 1, 2)
scene.add(cyanLight)

// ── EffectComposer 설정 ──
let composer: EffectComposer

// Pass 인스턴스
let bloomPass: UnrealBloomPass
let glitchPass: GlitchPass
let filmPass: FilmPass
let rgbShiftPass: ShaderPass
let dotScreenPass: ShaderPass

function setupComposer(width: number, height: number) {
  composer = new EffectComposer(renderer)

  // 1. RenderPass — 씬을 텍스처에 렌더링
  const renderPass = new RenderPass(scene, camera)
  composer.addPass(renderPass)

  // 2. UnrealBloomPass — 발광 효과
  bloomPass = new UnrealBloomPass(
    new THREE.Vector2(width, height),
    0.8,   // strength (강도)
    0.4,   // radius (반경)
    0.85   // threshold (이 밝기 이상만 bloom)
  )
  composer.addPass(bloomPass)

  // 3. GlitchPass — 글리치 효과 (기본 off)
  glitchPass = new GlitchPass()
  glitchPass.goWild = true  // 항상 글리치 (false면 랜덤 간격)
  glitchPass.enabled = false
  composer.addPass(glitchPass)

  // 4. FilmPass — 필름 그레인 (기본 off)
  filmPass = new FilmPass()
  filmPass.enabled = false
  composer.addPass(filmPass)

  // 5. RGBShift — 색수차 (기본 off)
  rgbShiftPass = new ShaderPass(RGBShiftShader)
  rgbShiftPass.uniforms['amount'].value = 0.003
  rgbShiftPass.enabled = false
  composer.addPass(rgbShiftPass)

  // 6. DotScreen — 도트 패턴 (기본 off)
  dotScreenPass = new ShaderPass(DotScreenShader)
  dotScreenPass.uniforms['scale'].value = 4
  dotScreenPass.enabled = false
  composer.addPass(dotScreenPass)

  // 마지막: OutputPass — 톤매핑/색공간 보정
  const outputPass = new OutputPass()
  composer.addPass(outputPass)
}

// ── UI 컨트롤 ──
function setupUI() {
  // Bloom 슬라이더들
  const strengthSlider = document.getElementById('bloom-strength') as HTMLInputElement
  const radiusSlider = document.getElementById('bloom-radius') as HTMLInputElement
  const thresholdSlider = document.getElementById('bloom-threshold') as HTMLInputElement

  strengthSlider?.addEventListener('input', () => {
    bloomPass.strength = parseFloat(strengthSlider.value)
    document.getElementById('val-strength')!.textContent = strengthSlider.value
  })
  radiusSlider?.addEventListener('input', () => {
    bloomPass.radius = parseFloat(radiusSlider.value)
    document.getElementById('val-radius')!.textContent = radiusSlider.value
  })
  thresholdSlider?.addEventListener('input', () => {
    bloomPass.threshold = parseFloat(thresholdSlider.value)
    document.getElementById('val-threshold')!.textContent = thresholdSlider.value
  })

  // 이펙트 토글 버튼
  const toggles = [
    { id: 'btn-glitch', pass: () => glitchPass, name: 'Glitch' },
    { id: 'btn-film', pass: () => filmPass, name: 'Film' },
    { id: 'btn-rgb', pass: () => rgbShiftPass, name: 'RGB Shift' },
    { id: 'btn-dot', pass: () => dotScreenPass, name: 'Dot Screen' },
  ]

  toggles.forEach(({ id, pass, name }) => {
    document.getElementById(id)?.addEventListener('click', () => {
      const p = pass()
      p.enabled = !p.enabled
      const btn = document.getElementById(id) as HTMLButtonElement
      btn.classList.toggle('active', p.enabled)
      btn.textContent = `${name}: ${p.enabled ? 'ON' : 'OFF'}`
    })
  })

  // Bloom 토글
  document.getElementById('btn-bloom')?.addEventListener('click', () => {
    bloomPass.enabled = !bloomPass.enabled
    const btn = document.getElementById('btn-bloom') as HTMLButtonElement
    btn.classList.toggle('active', bloomPass.enabled)
    btn.textContent = `Bloom: ${bloomPass.enabled ? 'ON' : 'OFF'}`
  })
}

// ── 초기화 ──
{
  const parent = canvas.parentElement!
  const w = parent.clientWidth
  const h = parent.clientHeight
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  setupComposer(w, h)
  setupUI()
}

// ── Resize ──
window.addEventListener('resize', () => {
  const parent = canvas.parentElement!
  const w = parent.clientWidth
  const h = parent.clientHeight
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  composer.setSize(w, h)
})

// ── Animate ──
const clock = new THREE.Clock()
function animate() {
  requestAnimationFrame(animate)
  const t = clock.getElapsedTime()

  glowSphere.position.y = 1.5 + Math.sin(t * 1.5) * 0.3

  // 네온 오브젝트 부드럽게 회전
  scene.children.forEach((child, i) => {
    if (child instanceof THREE.Mesh && child !== floor && child !== normalBox && child !== glowSphere) {
      child.rotation.y = t * 0.2 + i
    }
  })

  controls.update()

  // renderer.render 대신 composer.render 사용!
  composer.render()
}
animate()
