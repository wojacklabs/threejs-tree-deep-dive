import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const canvas = document.getElementById('c') as HTMLCanvasElement
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setClearColor(0x0d1117)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100)
camera.position.set(0, 1.5, 3)

const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true
controls.target.set(0, 1, 0)

// 조명
const dirLight = new THREE.DirectionalLight(0xffffff, 2)
dirLight.position.set(3, 5, 4)
dirLight.castShadow = true
dirLight.shadow.mapSize.set(1024, 1024)
dirLight.shadow.camera.left = -3
dirLight.shadow.camera.right = 3
dirLight.shadow.camera.top = 3
dirLight.shadow.camera.bottom = -1
scene.add(dirLight)
scene.add(new THREE.AmbientLight(0xffffff, 0.4))

// 바닥
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(10, 10),
  new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 })
)
floor.rotation.x = -Math.PI / 2
floor.receiveShadow = true
scene.add(floor)
scene.add(new THREE.GridHelper(10, 10, 0x444444, 0x222222))

// ── 상태 ──
let mixer: THREE.AnimationMixer | null = null
let actions: Map<string, THREE.AnimationAction> = new Map()
let activeAction: THREE.AnimationAction | null = null
let previousAction: THREE.AnimationAction | null = null
let timeScale = 1

const infoDiv = document.getElementById('anim-info') as HTMLDivElement
const clipListDiv = document.getElementById('clip-list') as HTMLDivElement

// ── GLTF 로드 ──
const loader = new GLTFLoader()
loader.load('/models/Soldier.glb', (gltf) => {
  const model = gltf.scene
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true
      child.receiveShadow = true
    }
  })
  scene.add(model)

  // AnimationMixer 생성
  mixer = new THREE.AnimationMixer(model)

  // 클립 등록
  gltf.animations.forEach((clip) => {
    const action = mixer!.clipAction(clip)
    actions.set(clip.name, action)
  })

  // 클립 목록 UI 생성
  let clipHtml = ''
  gltf.animations.forEach((clip) => {
    const duration = clip.duration.toFixed(2)
    const tracks = clip.tracks.length
    clipHtml += `
      <button class="clip-btn" data-clip="${clip.name}">
        <span class="clip-name">${clip.name}</span>
        <span class="clip-meta">${duration}s · ${tracks} tracks</span>
      </button>
    `
  })
  clipListDiv.innerHTML = clipHtml

  // 클립 버튼 이벤트
  clipListDiv.querySelectorAll('.clip-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const name = (btn as HTMLElement).dataset.clip!
      fadeToAction(name, 0.5)
    })
  })

  // 첫 번째 애니메이션 재생
  if (gltf.animations.length > 0) {
    fadeToAction(gltf.animations[0].name, 0)
  }

  // 로딩 UI 숨기기
  const progress = document.getElementById('progress') as HTMLDivElement
  progress.style.display = 'none'
})

// ── 애니메이션 전환 (크로스페이드) ──
function fadeToAction(name: string, fadeDuration: number) {
  const action = actions.get(name)
  if (!action) return

  previousAction = activeAction
  activeAction = action

  if (previousAction && previousAction !== activeAction) {
    previousAction.fadeOut(fadeDuration)
  }

  activeAction
    .reset()
    .setEffectiveTimeScale(timeScale)
    .setEffectiveWeight(1)
    .fadeIn(fadeDuration)
    .play()

  // UI 업데이트
  clipListDiv.querySelectorAll('.clip-btn').forEach((btn) => {
    btn.classList.toggle('active', (btn as HTMLElement).dataset.clip === name)
  })
}

// ── 컨트롤 버튼 ──
document.getElementById('btn-pause')?.addEventListener('click', () => {
  if (!activeAction) return
  activeAction.paused = !activeAction.paused
  const btn = document.getElementById('btn-pause') as HTMLButtonElement
  btn.textContent = activeAction.paused ? 'Resume' : 'Pause'
})

document.getElementById('btn-speed-down')?.addEventListener('click', () => {
  timeScale = Math.max(0.25, timeScale - 0.25)
  if (activeAction) activeAction.setEffectiveTimeScale(timeScale)
  updateSpeedDisplay()
})

document.getElementById('btn-speed-up')?.addEventListener('click', () => {
  timeScale = Math.min(4, timeScale + 0.25)
  if (activeAction) activeAction.setEffectiveTimeScale(timeScale)
  updateSpeedDisplay()
})

function updateSpeedDisplay() {
  const span = document.getElementById('speed-display') as HTMLSpanElement
  span.textContent = `${timeScale}x`
}

document.getElementById('btn-loop')?.addEventListener('click', () => {
  if (!activeAction) return
  const modes = [THREE.LoopRepeat, THREE.LoopOnce, THREE.LoopPingPong]
  const names = ['Repeat', 'Once', 'PingPong']
  const current = modes.indexOf(activeAction.loop)
  const next = (current + 1) % modes.length
  activeAction.loop = modes[next]
  activeAction.clampWhenFinished = modes[next] === THREE.LoopOnce
  activeAction.reset().play()
  const btn = document.getElementById('btn-loop') as HTMLButtonElement
  btn.textContent = `Loop: ${names[next]}`
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

  if (mixer) {
    mixer.update(delta)
  }

  // 현재 애니메이션 정보 표시
  if (activeAction) {
    const clip = activeAction.getClip()
    const time = activeAction.time.toFixed(2)
    const duration = clip.duration.toFixed(2)
    const weight = activeAction.getEffectiveWeight().toFixed(2)
    infoDiv.innerHTML = `
      <span>clip: ${clip.name}</span>
      <span>time: ${time} / ${duration}s</span>
      <span>weight: ${weight}</span>
      <span>speed: ${timeScale}x</span>
    `
  }

  controls.update()
  renderer.render(scene, camera)
}
animate()
