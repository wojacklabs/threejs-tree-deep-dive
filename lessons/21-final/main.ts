import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'

const canvas = document.getElementById('c') as HTMLCanvasElement
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
renderer.setClearColor(0x000000, 0)  // 투명 배경 → HTML이 비침
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.2

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100)
camera.position.set(0, 2, 5)

// ── 조명 ──
const dirLight = new THREE.DirectionalLight(0xffffff, 2)
dirLight.position.set(3, 5, 4)
dirLight.castShadow = true
dirLight.shadow.mapSize.set(1024, 1024)
scene.add(dirLight)
scene.add(new THREE.AmbientLight(0xffffff, 0.4))

// ── 포스트프로세싱 ──
let composer: EffectComposer

function setupComposer(w: number, h: number) {
  composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.5, 0.3, 0.9)
  composer.addPass(bloom)
  composer.addPass(new OutputPass())
}

// ══════════════════════════════════════════════
//  섹션별 3D 오브젝트
// ══════════════════════════════════════════════
const sections: { objects: THREE.Object3D[], y: number }[] = []

// ── 섹션 0: Hero — 회전하는 토러스 매듭 ──
const heroKnot = new THREE.Mesh(
  new THREE.TorusKnotGeometry(1, 0.35, 128, 32),
  new THREE.MeshStandardMaterial({
    color: 0x000000,
    emissive: 0x4488ff,
    emissiveIntensity: 1.5,
    roughness: 0.2,
    metalness: 0.8,
  })
)
heroKnot.position.set(2, 0, 0)
heroKnot.castShadow = true
scene.add(heroKnot)
sections.push({ objects: [heroKnot], y: 0 })

// ── 섹션 1: 파티클 구체 ──
const particleCount = 3000
const particleGeo = new THREE.BufferGeometry()
const particlePositions = new Float32Array(particleCount * 3)
const particleColors = new Float32Array(particleCount * 3)

for (let i = 0; i < particleCount; i++) {
  const i3 = i * 3
  const theta = Math.random() * Math.PI * 2
  const phi = Math.acos(2 * Math.random() - 1)
  const r = 1.5 + Math.random() * 0.5

  particlePositions[i3] = r * Math.sin(phi) * Math.cos(theta)
  particlePositions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta) - 8
  particlePositions[i3 + 2] = r * Math.cos(phi)

  const c = new THREE.Color().setHSL(0.55 + Math.random() * 0.15, 0.8, 0.5 + Math.random() * 0.3)
  particleColors[i3] = c.r; particleColors[i3 + 1] = c.g; particleColors[i3 + 2] = c.b
}

particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3))
particleGeo.setAttribute('color', new THREE.BufferAttribute(particleColors, 3))

const particles = new THREE.Points(particleGeo, new THREE.PointsMaterial({
  size: 0.03, vertexColors: true, depthWrite: false, blending: THREE.AdditiveBlending,
}))
particles.position.set(-2, 0, 0)
scene.add(particles)
sections.push({ objects: [particles], y: -8 })

// ── 섹션 2: GLTF 모델 ──
const modelGroup = new THREE.Group()
modelGroup.position.set(2, -16, 0)
scene.add(modelGroup)
sections.push({ objects: [modelGroup], y: -16 })

const gltfLoader = new GLTFLoader()
gltfLoader.load('/models/DamagedHelmet.glb', (gltf) => {
  const model = gltf.scene
  model.scale.setScalar(1.2)
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) { child.castShadow = true }
  })
  modelGroup.add(model)
})

// ── 섹션 3: 셰이더 구체 ──
const shaderSphere = new THREE.Mesh(
  new THREE.SphereGeometry(1.5, 64, 32),
  new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vPosition;
      void main() {
        vNormal = normal;
        vPosition = position;
        vec3 pos = position;
        pos += normal * sin(pos.y * 4.0 + uTime * 2.0) * 0.15;
        pos += normal * sin(pos.x * 3.0 + uTime * 1.5) * 0.1;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vPosition;
      void main() {
        float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);
        vec3 color1 = vec3(0.1, 0.0, 0.3);
        vec3 color2 = vec3(0.0, 0.8, 1.0);
        vec3 color3 = vec3(1.0, 0.3, 0.5);
        float t = sin(vPosition.y * 3.0 + uTime) * 0.5 + 0.5;
        vec3 color = mix(color1, mix(color2, color3, t), fresnel);
        color += vec3(fresnel * 0.3);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  })
)
shaderSphere.position.set(-1.5, -24, 0)
scene.add(shaderSphere)
sections.push({ objects: [shaderSphere], y: -24 })

// ── 섹션 4: 물리 시뮬 (가짜 — 회전하는 도형들) ──
const shapesGroup = new THREE.Group()
shapesGroup.position.set(0, -32, 0)
scene.add(shapesGroup)

const shapeMats = [0xff4444, 0x44ff44, 0x4488ff, 0xff8844, 0xaa44ff].map(c =>
  new THREE.MeshStandardMaterial({ color: c, roughness: 0.3, metalness: 0.5 })
)
const shapeGeos = [
  new THREE.BoxGeometry(0.6, 0.6, 0.6),
  new THREE.SphereGeometry(0.4, 32, 16),
  new THREE.ConeGeometry(0.3, 0.7, 32),
  new THREE.TorusGeometry(0.3, 0.12, 16, 32),
  new THREE.OctahedronGeometry(0.4),
]

for (let i = 0; i < 15; i++) {
  const mesh = new THREE.Mesh(
    shapeGeos[i % shapeGeos.length],
    shapeMats[i % shapeMats.length]
  )
  mesh.position.set(
    (Math.random() - 0.5) * 5,
    (Math.random() - 0.5) * 3,
    (Math.random() - 0.5) * 3
  )
  mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0)
  mesh.castShadow = true
  shapesGroup.add(mesh)
}
sections.push({ objects: [shapesGroup], y: -32 })

// ══════════════════════════════════════════════
//  스크롤 애니메이션
// ══════════════════════════════════════════════
const scrollContainer = document.getElementById('scroll-container') as HTMLDivElement
let scrollY = 0
let currentSection = 0

scrollContainer.addEventListener('scroll', () => {
  scrollY = scrollContainer.scrollTop
  const sectionHeight = window.innerHeight
  currentSection = Math.round(scrollY / sectionHeight)

  // 네비게이션 업데이트
  document.querySelectorAll('.nav-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === currentSection)
  })
})

// ── 마우스 패럴랙스 ──
let mouseX = 0, mouseY = 0
window.addEventListener('mousemove', (e) => {
  mouseX = (e.clientX / window.innerWidth - 0.5) * 2
  mouseY = (e.clientY / window.innerHeight - 0.5) * 2
})

// ── Resize ──
function resize() {
  const w = window.innerWidth
  const h = window.innerHeight
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  setupComposer(w, h)
}
window.addEventListener('resize', resize)
resize()

// ── Animate ──
const clock = new THREE.Clock()
function animate() {
  requestAnimationFrame(animate)
  const t = clock.getElapsedTime()
  const delta = clock.getDelta()

  // 스크롤에 따른 카메라 Y 이동
  const targetY = -(scrollY / window.innerHeight) * 8
  camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetY + 2, 0.05)

  // 마우스 패럴랙스
  camera.position.x = THREE.MathUtils.lerp(camera.position.x, mouseX * 0.5, 0.05)
  camera.rotation.x = THREE.MathUtils.lerp(camera.rotation.x, -mouseY * 0.05, 0.05)

  // 오브젝트 애니메이션
  heroKnot.rotation.y = t * 0.3
  heroKnot.rotation.x = t * 0.2
  heroKnot.position.y = Math.sin(t * 0.5) * 0.3

  particles.rotation.y = t * 0.1
  particles.rotation.x = t * 0.05

  modelGroup.rotation.y = t * 0.2

  shaderSphere.rotation.y = t * 0.15
  ;(shaderSphere.material as THREE.ShaderMaterial).uniforms.uTime.value = t

  shapesGroup.children.forEach((child, i) => {
    child.rotation.x = t * (0.2 + i * 0.05)
    child.rotation.y = t * (0.3 + i * 0.03)
    child.position.y = Math.sin(t * 0.5 + i) * 0.3 + (Math.random() - 0.5) * 0.001
  })

  composer.render()
}
animate()
