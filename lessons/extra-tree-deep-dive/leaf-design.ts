import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import GUI from 'lil-gui'

const canvas = document.getElementById('c') as HTMLCanvasElement
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setClearColor(0x87ceeb)
renderer.shadowMap.enabled = true
renderer.toneMapping = THREE.ACESFilmicToneMapping

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100)
camera.position.set(0, 0, 4)

const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true

const light = new THREE.DirectionalLight(0xffffff, 2)
light.position.set(3, 5, 4)
scene.add(light)
scene.add(new THREE.AmbientLight(0xffffff, 0.4))

// ══════════════════════════════════════════════
//  잎 모양 4종 정의
// ══════════════════════════════════════════════
interface LeafShapeDef {
  name: string
  draw: (ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) => void
}

const leafShapes: LeafShapeDef[] = [
  {
    name: '타원형',
    draw: (ctx, cx, cy, s) => {
      ctx.beginPath()
      ctx.moveTo(cx, cy - s * 0.48)
      ctx.bezierCurveTo(cx + s * 0.35, cy - s * 0.35, cx + s * 0.4, cy + s * 0.1, cx + s * 0.2, cy + s * 0.4)
      ctx.quadraticCurveTo(cx, cy + s * 0.5, cx, cy + s * 0.48)
      ctx.quadraticCurveTo(cx, cy + s * 0.5, cx - s * 0.2, cy + s * 0.4)
      ctx.bezierCurveTo(cx - s * 0.4, cy + s * 0.1, cx - s * 0.35, cy - s * 0.35, cx, cy - s * 0.48)
      ctx.closePath()
    },
  },
  {
    name: '뾰족형',
    draw: (ctx, cx, cy, s) => {
      ctx.beginPath()
      ctx.moveTo(cx, cy - s * 0.5)
      ctx.bezierCurveTo(cx + s * 0.25, cy - s * 0.25, cx + s * 0.3, cy + s * 0.15, cx + s * 0.1, cy + s * 0.42)
      ctx.quadraticCurveTo(cx, cy + s * 0.48, cx, cy + s * 0.48)
      ctx.quadraticCurveTo(cx, cy + s * 0.48, cx - s * 0.1, cy + s * 0.42)
      ctx.bezierCurveTo(cx - s * 0.3, cy + s * 0.15, cx - s * 0.25, cy - s * 0.25, cx, cy - s * 0.5)
      ctx.closePath()
    },
  },
  {
    name: '둥근형',
    draw: (ctx, cx, cy, s) => {
      ctx.beginPath()
      ctx.moveTo(cx, cy - s * 0.4)
      ctx.bezierCurveTo(cx + s * 0.45, cy - s * 0.35, cx + s * 0.45, cy + s * 0.25, cx + s * 0.15, cy + s * 0.42)
      ctx.quadraticCurveTo(cx + s * 0.05, cy + s * 0.48, cx, cy + s * 0.5)
      ctx.quadraticCurveTo(cx - s * 0.05, cy + s * 0.48, cx - s * 0.15, cy + s * 0.42)
      ctx.bezierCurveTo(cx - s * 0.45, cy + s * 0.25, cx - s * 0.45, cy - s * 0.35, cx, cy - s * 0.4)
      ctx.closePath()
    },
  },
  {
    name: '비대칭',
    draw: (ctx, cx, cy, s) => {
      ctx.beginPath()
      ctx.moveTo(cx + s * 0.02, cy - s * 0.45)
      ctx.bezierCurveTo(cx + s * 0.3, cy - s * 0.3, cx + s * 0.35, cy + s * 0.05, cx + s * 0.22, cy + s * 0.35)
      ctx.bezierCurveTo(cx + s * 0.1, cy + s * 0.45, cx, cy + s * 0.5, cx - s * 0.03, cy + s * 0.48)
      ctx.bezierCurveTo(cx - s * 0.08, cy + s * 0.45, cx - s * 0.18, cy + s * 0.38, cx - s * 0.25, cy + s * 0.3)
      ctx.bezierCurveTo(cx - s * 0.38, cy + s * 0.05, cx - s * 0.28, cy - s * 0.32, cx + s * 0.02, cy - s * 0.45)
      ctx.closePath()
    },
  },
]

// ══════════════════════════════════════════════
//  잎별 3D 파라미터
// ══════════════════════════════════════════════
interface Leaf3DParams {
  curve: number       // 앞뒤 곡면 (0=평면, 양수=볼록)
  twist: number       // 좌우 비틀림 (라디안)
  fold: number        // 중심 접힘 (0=평면, 양수=V자)
  jitterX: number     // X 방향 미세 흔들림
  jitterZ: number     // Z 방향 미세 흔들림
}

const leafParams: Leaf3DParams[] = [
  { curve: 0.2, twist: 0.6, fold: 0.12, jitterX: 0, jitterZ: 0 },
  { curve: 0.2, twist: 0.6, fold: 0.12, jitterX: 0, jitterZ: 0 },
  { curve: 0.2, twist: 0.6, fold: 0.12, jitterX: 0, jitterZ: 0 },
  { curve: 0.2, twist: 0.6, fold: 0.12, jitterX: 0, jitterZ: 0 },
]

// ±10% 노이즈 범위 (InstancedMesh에서 사용할 값)
const noiseRange = 0.1 // 10%

const colorParams = {
  baseHue: 110,
  baseSat: 55,
  baseLight: 38,
}

const materialParams = {
  roughness: 0.45,
  metalness: 0.0,
  transmission: 0.0,
  thickness: 0.0,
  alphaTest: 0.5,
  sssStrength: 0.0,
  fresnelStrength: 0.0,
}

// ══════════════════════════════════════════════
//  잎 텍스처 렌더링
// ══════════════════════════════════════════════
function renderLeafTexture(shape: LeafShapeDef, size: number, hue: number, sat: number, light: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = size; c.height = size
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, size, size)

  const cx = size / 2, cy = size / 2, s = size * 0.9
  shape.draw(ctx, cx, cy, s)

  const grad = ctx.createRadialGradient(cx - s * 0.1, cy - s * 0.1, 0, cx, cy, s * 0.5)
  grad.addColorStop(0, `hsl(${hue + 5}, ${sat + 5}%, ${light + 8}%)`)
  grad.addColorStop(0.6, `hsl(${hue}, ${sat}%, ${light}%)`)
  grad.addColorStop(1, `hsl(${hue - 5}, ${sat - 5}%, ${light - 5}%)`)
  ctx.fillStyle = grad
  ctx.fill()

  return c
}

// ══════════════════════════════════════════════
//  잎 Material (PBR + SSS + Fresnel)
// ══════════════════════════════════════════════
function createLeafMaterial(map: THREE.CanvasTexture): THREE.MeshPhysicalMaterial {
  const mat = new THREE.MeshPhysicalMaterial({
    map,
    transparent: true,
    alphaTest: materialParams.alphaTest,
    side: THREE.DoubleSide,
    roughness: materialParams.roughness,
    metalness: materialParams.metalness,
    transmission: materialParams.transmission,
    thickness: materialParams.thickness,
  })

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSSS = { value: materialParams.sssStrength }
    shader.uniforms.uFresnel = { value: materialParams.fresnelStrength }

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
      uniform float uSSS;
      uniform float uFresnel;`
    )

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `
      // Subsurface Scattering: 역광 시 잎이 밝게 빛남
      vec3 sunDir = normalize(vec3(0.5, 1.0, 0.5));
      vec3 viewDir = normalize(vViewPosition);
      float sss = max(0.0, dot(normalize(-viewDir), sunDir)) * uSSS;
      gl_FragColor.rgb += vec3(0.15, 0.25, 0.05) * sss;

      // Fresnel rim: 가장자리 발광
      vec3 N = normalize(vNormal);
      float ndv = max(0.0, dot(N, normalize(vViewPosition)));
      float fresnel = pow(1.0 - ndv, 3.0) * uFresnel;
      gl_FragColor.rgb += vec3(0.1, 0.2, 0.05) * fresnel;

      #include <dithering_fragment>
      `
    )

    mat.userData.shader = shader
  }

  return mat
}

// ══════════════════════════════════════════════
//  3D 잎 geometry (곡면 + 뒤틀림 + 접힘 + 지터)
// ══════════════════════════════════════════════
function createLeaf3DGeometry(width: number, height: number, p: Leaf3DParams, seed: number): THREE.BufferGeometry {
  // PlaneGeometry에 세그먼트를 넣어서 변형 가능하게
  const segW = 4, segH = 6
  const geo = new THREE.PlaneGeometry(width, height, segW, segH)
  const pos = geo.attributes.position

  const hashSeed = Math.sin(seed * 127.1) * 43758.5453

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
    const u = (x / width) + 0.5  // 0~1 가로
    const v = (y / height) + 0.5 // 0~1 세로

    // 곡면 (curve): 중앙이 앞으로 볼록
    const curveAmount = Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * p.curve * width
    z += curveAmount

    // 중심 접힘 (fold): V자 형태
    const distFromCenter = Math.abs(u - 0.5) * 2 // 0(중심)~1(가장자리)
    z -= distFromCenter * p.fold * width

    // 뒤틀림 (twist): 위아래로 반대 방향 회전
    const twistAngle = (v - 0.5) * p.twist
    const ct = Math.cos(twistAngle), st = Math.sin(twistAngle)
    const rx = x * ct - z * st
    const rz = x * st + z * ct
    x = rx; z = rz

    // 지터 (jitter): 미세한 랜덤 오프셋
    const jx = Math.sin(hashSeed + i * 13.37) * p.jitterX * width
    const jz = Math.cos(hashSeed + i * 7.11) * p.jitterZ * width
    x += jx; z += jz

    pos.setXYZ(i, x, y, z)
  }

  geo.computeVertexNormals()
  return geo
}

// ══════════════════════════════════════════════
//  표시
// ══════════════════════════════════════════════
const displayGroup = new THREE.Group()
scene.add(displayGroup)

function buildDisplay() {
  displayGroup.traverse(c => {
    if (c instanceof THREE.Mesh || c instanceof THREE.Sprite) {
      if (c instanceof THREE.Mesh) { c.geometry.dispose(); (c.material as THREE.Material).dispose() }
    }
  })
  displayGroup.clear()

  const { baseHue, baseSat, baseLight } = colorParams
  const hueVar = [0, -8, 5, -3]
  const lightVar = [0, 3, -2, 5]

  for (let i = 0; i < 4; i++) {
    const xPos = (i - 1.5) * 2.2

    // 텍스처 생성
    const texCanvas = renderLeafTexture(
      leafShapes[i], 256,
      baseHue + hueVar[i], baseSat, baseLight + lightVar[i]
    )
    const tex = new THREE.CanvasTexture(texCanvas)

    // 3D 잎 geometry
    const leafGeo = createLeaf3DGeometry(0.8, 1.0, leafParams[i], i * 42)

    const mat = createLeafMaterial(tex)

    const mesh = new THREE.Mesh(leafGeo, mat)
    mesh.position.set(xPos, 0.3, 0)
    mesh.castShadow = true
    displayGroup.add(mesh)

    // 노이즈 변형 5개 (±10% 적용)
    for (let n = 0; n < 5; n++) {
      const noiseSeed = i * 100 + n * 7
      const nRand = () => Math.sin(noiseSeed * 127.1 + n * 311.7 + Math.random() * 0.001) * 0.5 + 0.5

      const noisedParams: Leaf3DParams = {
        curve: leafParams[i].curve * (1 + (nRand() - 0.5) * 2 * noiseRange),
        twist: leafParams[i].twist * (1 + (nRand() - 0.5) * 2 * noiseRange),
        fold: leafParams[i].fold * (1 + (nRand() - 0.5) * 2 * noiseRange),
        jitterX: leafParams[i].jitterX,
        jitterZ: leafParams[i].jitterZ,
      }

      const smallGeo = createLeaf3DGeometry(0.3, 0.38, noisedParams, noiseSeed)
      const smallMat = createLeafMaterial(tex.clone())
      const smallMesh = new THREE.Mesh(smallGeo, smallMat)
      smallMesh.position.set(xPos + (n - 2) * 0.4, -1.0, 0)
      smallMesh.rotation.y = (nRand() - 0.5) * 0.5
      displayGroup.add(smallMesh)
    }

    // 이름 라벨
    const lc = document.createElement('canvas')
    lc.width = 300; lc.height = 60
    const lctx = lc.getContext('2d')!
    lctx.fillStyle = '#333'
    lctx.font = 'bold 16px sans-serif'
    lctx.textAlign = 'center'
    lctx.fillText(leafShapes[i].name, 150, 20)
    lctx.font = '12px monospace'
    lctx.fillStyle = '#888'
    lctx.fillText(`curve:${leafParams[i].curve} twist:${leafParams[i].twist.toFixed(2)}`, 150, 40)
    lctx.fillText(`fold:${leafParams[i].fold} jitter:${leafParams[i].jitterX}`, 150, 55)
    const ltex = new THREE.CanvasTexture(lc)
    const lsprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: ltex, transparent: true }))
    lsprite.position.set(xPos, 1.2, 0)
    lsprite.scale.set(1.8, 0.5, 1)
    displayGroup.add(lsprite)

    // 라벨
    addSmallLabel('기본', xPos, 0.85, '#58a6ff')
    addSmallLabel('±10% 노이즈', xPos, -0.55, '#7ee787')
  }

  // 아틀라스 미리보기 (오른쪽 아래)
  const atlasCanvas = renderAtlas(512)
  const atlasTex = new THREE.CanvasTexture(atlasCanvas)
  const atlasMat = new THREE.MeshBasicMaterial({ map: atlasTex, transparent: true, alphaTest: 0.05 })
  const atlasGeo = new THREE.PlaneGeometry(1.4, 1.4)
  const atlasMesh = new THREE.Mesh(atlasGeo, atlasMat)
  atlasMesh.position.set(5.5, -0.5, 0)
  displayGroup.add(atlasMesh)
  addSmallLabel('아틀라스', 5.5, 0.5, '#333')
}

function addSmallLabel(text: string, x: number, y: number, color: string) {
  const c = document.createElement('canvas')
  c.width = 150; c.height = 30
  const ctx = c.getContext('2d')!
  ctx.fillStyle = color; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center'
  ctx.fillText(text, 75, 22)
  const tex = new THREE.CanvasTexture(c)
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }))
  sprite.position.set(x, y, 0); sprite.scale.set(0.8, 0.2, 1)
  displayGroup.add(sprite)
}

function renderAtlas(size: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = size; c.height = size
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, size, size)

  const half = size / 2
  const { baseHue, baseSat, baseLight } = colorParams
  const hueVar = [0, -8, 5, -3]
  const lightVar = [0, 3, -2, 5]

  for (let i = 0; i < 4; i++) {
    const col = i % 2, row = Math.floor(i / 2)
    const leafCanvas = renderLeafTexture(
      leafShapes[i], half, baseHue + hueVar[i], baseSat, baseLight + lightVar[i]
    )
    ctx.drawImage(leafCanvas, col * half, row * half)
  }
  return c
}

buildDisplay()

// ══════════════════════════════════════════════
//  GUI — 잎별 3D 파라미터
// ══════════════════════════════════════════════
const gui = new GUI({ width: 280 })
gui.domElement.style.position = 'absolute'
gui.domElement.style.top = '48px'
gui.domElement.style.right = '0'
canvas.parentElement!.appendChild(gui.domElement)

const colorFolder = gui.addFolder('색상')
colorFolder.add(colorParams, 'baseHue', 60, 160, 1).name('Hue').onChange(buildDisplay)
colorFolder.add(colorParams, 'baseSat', 20, 80, 1).name('채도').onChange(buildDisplay)
colorFolder.add(colorParams, 'baseLight', 20, 55, 1).name('밝기').onChange(buildDisplay)

const matFolder = gui.addFolder('재질')
matFolder.add(materialParams, 'roughness', 0, 1, 0.05).name('거칠기').onChange(buildDisplay)
matFolder.add(materialParams, 'metalness', 0, 0.3, 0.01).name('금속성').onChange(buildDisplay)
matFolder.add(materialParams, 'transmission', 0, 0.5, 0.01).name('투과').onChange(buildDisplay)
matFolder.add(materialParams, 'thickness', 0, 2, 0.1).name('투과 두께').onChange(buildDisplay)
matFolder.add(materialParams, 'alphaTest', 0, 0.5, 0.01).name('알파 컷').onChange(buildDisplay)
matFolder.add(materialParams, 'sssStrength', 0, 0.5, 0.01).name('SSS 강도').onChange(buildDisplay)
matFolder.add(materialParams, 'fresnelStrength', 0, 0.5, 0.01).name('프레넬 림').onChange(buildDisplay)

const leafNames = ['타원형', '뾰족형', '둥근형', '비대칭']

for (let i = 0; i < 4; i++) {
  const folder = gui.addFolder(`잎${i + 1}: ${leafNames[i]}`)
  folder.add(leafParams[i], 'curve', 0, 0.2, 0.005).name('곡면').onChange(buildDisplay)
  folder.add(leafParams[i], 'twist', 0, 0.6, 0.01).name('뒤틀림').onChange(buildDisplay)
  folder.add(leafParams[i], 'fold', 0, 0.12, 0.005).name('접힘').onChange(buildDisplay)
  folder.add(leafParams[i], 'jitterX', 0, 0.03, 0.001).name('지터X').onChange(buildDisplay)
  folder.add(leafParams[i], 'jitterZ', 0, 0.03, 0.001).name('지터Z').onChange(buildDisplay)
  if (i > 0) folder.close()
}

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

function animate() {
  requestAnimationFrame(animate)
  controls.update()
  renderer.render(scene, camera)
}
animate()
