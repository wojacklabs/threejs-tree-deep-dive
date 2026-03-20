import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { ProceduralPropsRenderer } from '@world-editor/loader'
import type { ProceduralPropInstance } from '@world-editor/loader/types'
import GUI from 'lil-gui'

const canvas = document.getElementById('c') as HTMLCanvasElement
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setClearColor(0x87ceeb)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping

const scene = new THREE.Scene()
scene.fog = new THREE.FogExp2(0x87ceeb, 0.012)

const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200)
camera.position.set(0, 4, 10)

const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true
controls.target.set(0, 2, 0)

// 조명
const sunLight = new THREE.DirectionalLight(0xfff5e0, 2)
sunLight.position.set(5, 10, 5)
sunLight.castShadow = true
sunLight.shadow.mapSize.set(1024, 1024)
sunLight.shadow.camera.left = -15; sunLight.shadow.camera.right = 15
sunLight.shadow.camera.top = 15; sunLight.shadow.camera.bottom = -15
scene.add(sunLight)

const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x362907, 0.5)
scene.add(hemiLight)

// 바닥
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(60, 60),
  new THREE.MeshStandardMaterial({ color: 0x3a6b1a, roughness: 0.9 })
)
floor.rotation.x = -Math.PI / 2
floor.receiveShadow = true
scene.add(floor)

// ══════════════════════════════════════════════
//  ProceduralPropsRenderer 사용 (실제 프로젝트 방식)
// ══════════════════════════════════════════════
let propsRenderer: ProceduralPropsRenderer | null = null

const params = {
  treeCount: 10,
  seed: 42,
  size: 1.0,
  sizeVariation: 0.3,
  spread: 12,
  windAngle: 45,
  windStrength: 0.75,
  snowCover: 0.0,
  nightFactor: 0.0,
}

function seededRandom(seed: number) {
  let s = seed
  return () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647 }
}

// deformConfig 파라미터 (rebuild보다 먼저 선언 필요)
const deformParams = {
  bendScale: 0.22,
  twistScale: 0.75,
  jitterScale: 0.018,
  smoothstepPower: 2,
}

let rebuildTimer: ReturnType<typeof setTimeout> | null = null
let rebuilding = false

function scheduleRebuild() {
  if (rebuildTimer) clearTimeout(rebuildTimer)
  rebuildTimer = setTimeout(() => doRebuild(), 300)
}

async function doRebuild() {
  if (rebuilding) return
  rebuilding = true
  try { await rebuild() } finally { rebuilding = false }
}

async function rebuild() {
  // 기존 renderer dispose
  if (propsRenderer) {
    propsRenderer.dispose()
    propsRenderer = null
  }

  // 새 renderer 생성
  propsRenderer = new ProceduralPropsRenderer(scene, {
    useInstancing: false,
    windAngle: params.windAngle * Math.PI / 180,
    windStrength: params.windStrength,
    textureUrls: {
      leafAtlas: '/assets/references/infinite-terrain/alpha_leaves',
    },
  })

  // deformConfig 적용 (props 로딩 전에!)
  const gen = propsRenderer.getGenerator()
  gen.deformConfig.bendScale = deformParams.bendScale
  gen.deformConfig.twistScale = deformParams.twistScale
  gen.deformConfig.jitterScale = deformParams.jitterScale
  gen.deformConfig.smoothstepPower = deformParams.smoothstepPower

  // 나무 데이터 생성
  const props: ProceduralPropInstance[] = []
  const rand = seededRandom(params.seed)

  for (let i = 0; i < params.treeCount; i++) {
    const angle = (i / params.treeCount) * Math.PI * 2 + rand() * 0.5
    const radius = 2 + rand() * params.spread
    const treeSeed = Math.floor(rand() * 10000)

    props.push({
      id: `tree_${i}`,
      assetType: 'tree',
      params: {
        type: 'tree',
        seed: treeSeed,
        size: params.size,
        sizeVariation: params.sizeVariation,
        noiseScale: 0.5,
        noiseAmplitude: 0.3,
        colorBase: { r: 0.35 + rand() * 0.15, g: 0.55 + rand() * 0.15, b: 0.15 + rand() * 0.1 },
        colorDetail: { r: 0.25 + rand() * 0.1, g: 0.45 + rand() * 0.1, b: 0.1 + rand() * 0.05 },
      },
      position: {
        x: Math.cos(angle) * radius,
        y: 0,
        z: Math.sin(angle) * radius,
      },
      rotation: { x: 0, y: rand() * Math.PI * 2, z: 0 },
      scale: {
        x: 0.8 + rand() * 0.4,
        y: 0.8 + rand() * 0.5,
        z: 0.8 + rand() * 0.4,
      },
    })
  }

  // 부시도 몇 개 추가
  for (let i = 0; i < 5; i++) {
    const angle = rand() * Math.PI * 2
    const radius = 1 + rand() * params.spread * 0.8

    props.push({
      id: `bush_${i}`,
      assetType: 'bush',
      params: {
        type: 'bush',
        seed: Math.floor(rand() * 10000),
        size: 0.6 + rand() * 0.4,
        sizeVariation: 0.2,
        noiseScale: 0.3,
        noiseAmplitude: 0.2,
        colorBase: { r: 0.3, g: 0.55, b: 0.15 },
        colorDetail: { r: 0.2, g: 0.45, b: 0.1 },
      },
      position: {
        x: Math.cos(angle) * radius,
        y: 0,
        z: Math.sin(angle) * radius,
      },
      rotation: { x: 0, y: rand() * Math.PI * 2, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    })
  }

  // 로드 (reference GLB 템플릿 + 절차적 변형)
  await propsRenderer.loadPropsAsync(props)

  // 환경 설정
  propsRenderer.setSnowDepth(params.snowCover)
  propsRenderer.setNightFactor(params.nightFactor)
  propsRenderer.setSunDirection(sunLight.position.clone().normalize())
  propsRenderer.setAmbientIntensity(0.4)
  propsRenderer.setFog(new THREE.Color(0x87ceeb), 0.012)
}

doRebuild()

// ══════════════════════════════════════════════
//  lil-gui
// ══════════════════════════════════════════════
const gui = new GUI({ width: 260 })
gui.domElement.style.position = 'absolute'
gui.domElement.style.top = '48px'
gui.domElement.style.right = '0'
canvas.parentElement!.appendChild(gui.domElement)

const treeFolder = gui.addFolder('Trees')
treeFolder.add(params, 'treeCount', 1, 30, 1).onChange(scheduleRebuild)
treeFolder.add(params, 'seed', 0, 200, 1).onChange(scheduleRebuild)
treeFolder.add(params, 'size', 0.3, 2, 0.1).onChange(scheduleRebuild)
treeFolder.add(params, 'sizeVariation', 0, 1, 0.1).onChange(scheduleRebuild)
treeFolder.add(params, 'spread', 3, 20, 1).onChange(scheduleRebuild)

const envFolder = gui.addFolder('Environment')
envFolder.add(params, 'windAngle', 0, 360, 5).onChange(() => {
  propsRenderer?.setWind(params.windAngle, params.windStrength)
})
envFolder.add(params, 'windStrength', 0, 2, 0.05).onChange(() => {
  propsRenderer?.setWind(params.windAngle, params.windStrength)
})
envFolder.add(params, 'snowCover', 0, 1, 0.05).onChange(() => {
  propsRenderer?.setSnowDepth(params.snowCover)
})
envFolder.add(params, 'nightFactor', 0, 1, 0.05).onChange(() => {
  propsRenderer?.setNightFactor(params.nightFactor)
})

// ══════════════════════════════════════════════
//  디버그 1: Fragment Shader 셰이딩 비교
// ══════════════════════════════════════════════
const shadingGroup = new THREE.Group()
shadingGroup.visible = false
scene.add(shadingGroup)

function buildShadingDebug() {
  while (shadingGroup.children.length) {
    const c = shadingGroup.children[0]
    if (c instanceof THREE.Mesh) { c.geometry.dispose(); (c.material as THREE.Material).dispose() }
    shadingGroup.remove(c)
  }

  const h = 3.0, thick = 0.08, taper = 0.35, segs = 16, hSegs = 24

  function addLabel(text: string, pos: THREE.Vector3, color = '#ffffff') {
    const c = document.createElement('canvas')
    c.width = 400; c.height = 64
    const ctx = c.getContext('2d')!
    ctx.fillStyle = color; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center'
    ctx.fillText(text, 200, 44)
    const tex = new THREE.CanvasTexture(c)
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }))
    sprite.position.copy(pos); sprite.scale.set(3, 0.6, 1)
    shadingGroup.add(sprite)
  }

  function makeTrunkGeo() {
    const geo = new THREE.CylinderGeometry(thick * taper, thick, h, segs, hSegs)
    geo.translate(0, h / 2, 0)
    return geo
  }

  // ── 1: Three.js 기본 PBR (MeshStandardMaterial) ──
  const m1 = new THREE.Mesh(makeTrunkGeo(), new THREE.MeshStandardMaterial({
    color: 0x8b6b4a, roughness: 1.0, metalness: 0.0,
  }))
  m1.position.set(-4.5, 0, 0)
  shadingGroup.add(m1)
  addLabel('PBR 기본', new THREE.Vector3(-4.5, h + 0.8, 0), '#8b949e')
  addLabel('MeshStandard만', new THREE.Vector3(-4.5, h + 0.3, 0), '#666')

  // ── 2: + wrap lighting ──
  const mat2 = new THREE.MeshStandardMaterial({ color: 0x8b6b4a, roughness: 1.0, metalness: 0.0 })
  mat2.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <dithering_fragment>', `
      vec3 N2 = normalize(vNormal);
      vec3 ld = normalize(vec3(0.5, 1.0, 0.5));
      float w = 0.4;
      float ndl = clamp((dot(N2, ld) + w) / (1.0 + w), 0.0, 1.0);
      gl_FragColor.rgb *= mix(0.55, 1.0, ndl);
      #include <dithering_fragment>
    `)
  }
  const m2 = new THREE.Mesh(makeTrunkGeo(), mat2)
  m2.position.set(-1.5, 0, 0)
  shadingGroup.add(m2)
  addLabel('+ wrap lighting', new THREE.Vector3(-1.5, h + 0.8, 0), '#ff8844')
  addLabel('그림자 부드럽게', new THREE.Vector3(-1.5, h + 0.3, 0), '#666')

  // ── 3: + hemisphere ──
  const mat3 = new THREE.MeshStandardMaterial({ color: 0x8b6b4a, roughness: 1.0, metalness: 0.0 })
  mat3.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <dithering_fragment>', `
      vec3 N3 = normalize(vNormal);
      vec3 ld3 = normalize(vec3(0.5, 1.0, 0.5));
      float w3 = 0.4;
      float ndl3 = clamp((dot(N3, ld3) + w3) / (1.0 + w3), 0.0, 1.0);
      float hemi3 = N3.y * 0.5 + 0.5;
      float shade3 = mix(0.55, 1.0, ndl3 * 0.6 + hemi3 * 0.4);
      gl_FragColor.rgb *= shade3;
      #include <dithering_fragment>
    `)
  }
  const m3 = new THREE.Mesh(makeTrunkGeo(), mat3)
  m3.position.set(1.5, 0, 0)
  shadingGroup.add(m3)
  addLabel('+ hemisphere', new THREE.Vector3(1.5, h + 0.8, 0), '#44aaff')
  addLabel('위아래 밝기 차이', new THREE.Vector3(1.5, h + 0.3, 0), '#666')

  // ── 4: 실제 프로젝트 (wrap + hemi = 최종) ──
  const mat4 = new THREE.MeshStandardMaterial({ color: 0x8b6b4a, roughness: 1.0, metalness: 0.0 })
  mat4.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <dithering_fragment>', `
      vec3 N4 = normalize(vNormal);
      vec3 ld4 = normalize(vec3(0.5, 1.0, 0.5));
      float w4 = 0.4;
      float ndl4 = clamp((dot(N4, ld4) + w4) / (1.0 + w4), 0.0, 1.0);
      float hemi4 = N4.y * 0.5 + 0.5;
      float shade4 = mix(0.55, 1.0, ndl4 * 0.6 + hemi4 * 0.4);
      gl_FragColor.rgb = vec3(0.545, 0.420, 0.290) * shade4;
      #include <dithering_fragment>
    `)
  }
  const m4 = new THREE.Mesh(makeTrunkGeo(), mat4)
  m4.position.set(4.5, 0, 0)
  shadingGroup.add(m4)
  addLabel('실제 프로젝트', new THREE.Vector3(4.5, h + 0.8, 0), '#7ee787')
  addLabel('uTrunkColor × shade', new THREE.Vector3(4.5, h + 0.3, 0), '#666')

  addLabel('← Fragment Shader 셰이딩 단계별 비교 →', new THREE.Vector3(0, h + 1.5, 0))
}
buildShadingDebug()

const shadingFolder = gui.addFolder('Debug: 줄기 셰이딩')
shadingFolder.add(shadingGroup, 'visible').name('비교 표시').onChange((v: boolean) => {
  if (v) {
    propsRenderer?.setVisible(false)
    deformGroup.visible = false
    camera.position.set(0, 2, 12)
    controls.target.set(0, 1.5, 0)
  } else { propsRenderer?.setVisible(true) }
})

// ══════════════════════════════════════════════
//  디버그 2: 실제 GLB 나무 변형 파라미터 편집
// ══════════════════════════════════════════════
function applyDeformAndRebuild() {
  scheduleRebuild()
}

const deformFolder = gui.addFolder('GLB 변형 편집 (실제 나무)')
deformFolder.add(deformParams, 'bendScale', 0, 0.8, 0.01)
  .name('굽힘 (기본 0.22)').onChange(applyDeformAndRebuild)
deformFolder.add(deformParams, 'twistScale', 0, 2.0, 0.05)
  .name('비틀림 (기본 0.75)').onChange(applyDeformAndRebuild)
deformFolder.add(deformParams, 'jitterScale', 0, 0.1, 0.001)
  .name('지터 (기본 0.018)').onChange(applyDeformAndRebuild)
deformFolder.add(deformParams, 'smoothstepPower', 0.5, 5, 0.1)
  .name('감쇠 지수 (기본 2)').onChange(applyDeformAndRebuild)

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

  // ProceduralPropsRenderer 업데이트 (바람 애니메이션)
  propsRenderer?.update()

  // 배경색 낮/밤
  const skyColor = new THREE.Color(0x87ceeb).lerp(new THREE.Color(0x020210), params.nightFactor)
  renderer.setClearColor(skyColor)
  if (scene.fog instanceof THREE.FogExp2) scene.fog.color.copy(skyColor)

  const info = renderer.info.render
  infoDiv.innerHTML = `
    <span>props: ${propsRenderer?.getPropCount() ?? 0}</span>
    <span>triangles: ${info.triangles.toLocaleString()}</span>
    <span>draw calls: ${info.calls}</span>
  `

  controls.update()
  renderer.render(scene, camera)
}
animate()
