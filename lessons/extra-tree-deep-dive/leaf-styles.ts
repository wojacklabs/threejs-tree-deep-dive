import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import GUI from 'lil-gui'

const canvas = document.getElementById('c') as HTMLCanvasElement
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setClearColor(0x87ceeb)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping

const scene = new THREE.Scene()
scene.fog = new THREE.FogExp2(0x87ceeb, 0.015)
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200)
camera.position.set(0, 4, 12)

const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true
controls.target.set(0, 3, 0)

const sun = new THREE.DirectionalLight(0xfff5e0, 2)
sun.position.set(5, 10, 5)
sun.castShadow = true
sun.shadow.mapSize.set(1024, 1024)
sun.shadow.camera.left = -15; sun.shadow.camera.right = 15
sun.shadow.camera.top = 15; sun.shadow.camera.bottom = -5
scene.add(sun)
scene.add(new THREE.HemisphereLight(0x87ceeb, 0x362907, 0.5))

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40),
  new THREE.MeshStandardMaterial({ color: 0x3a6b1a, roughness: 0.9 })
)
floor.rotation.x = -Math.PI / 2
floor.receiveShadow = true
scene.add(floor)

function seeded(s: number) {
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

// ══════════════════════════════════════════════
//  공통: 줄기 + 가지 뼈대
// ══════════════════════════════════════════════
function createSkeleton(seed: number): { group: THREE.Group, branchEnds: THREE.Vector3[], topCenter: THREE.Vector3 } {
  const group = new THREE.Group()
  const branchEnds: THREE.Vector3[] = []
  const h = 3.5, thick = 0.13, taper = 0.15
  const rand = seeded(seed)
  const bendX = (rand() - 0.3) * 0.14, bendZ = (rand() - 0.5) * 0.1

  // 줄기
  const trunkGeo = new THREE.CylinderGeometry(thick * taper, thick, h, 12, 16)
  const tPos = trunkGeo.attributes.position
  for (let i = 0; i < tPos.count; i++) {
    let x = tPos.getX(i), y = tPos.getY(i), z = tPos.getZ(i)
    const t = (y + h / 2) / h
    const rootT = Math.max(0, 1 - t * 4)
    x *= 1 + rootT * rootT * 0.7
    x += bendX * t * t; z += bendZ * t * t
    tPos.setXYZ(i, x, y, z)
  }
  trunkGeo.computeVertexNormals()
  trunkGeo.translate(0, h / 2, 0)
  const trunkMesh = new THREE.Mesh(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x8b6b4a, roughness: 0.95 }))
  trunkMesh.castShadow = true
  group.add(trunkMesh)

  // 가지 5개
  for (let i = 0; i < 5; i++) {
    const heightRatio = 0.5 + i * 0.1
    const branchY = heightRatio * h
    const azimuth = i * GOLDEN_ANGLE + rand() * 0.4
    const length = 0.5 + rand() * 0.4
    const vertAngle = 0.4 + heightRatio * 0.3
    const dirX = Math.cos(azimuth) * Math.cos(vertAngle)
    const dirY = Math.sin(vertAngle)
    const dirZ = Math.sin(azimuth) * Math.cos(vertAngle)

    const t = branchY / h
    const ox = bendX * t * t + Math.cos(azimuth) * thick * (1 - t * (1 - taper)) * 0.6
    const oz = bendZ * t * t + Math.sin(azimuth) * thick * (1 - t * (1 - taper)) * 0.6

    const endX = ox + dirX * length
    const endY = branchY + dirY * length
    const endZ = oz + dirZ * length

    const cx = (ox + endX) / 2, cy = (branchY + endY) / 2, cz = (oz + endZ) / 2
    const bGeo = new THREE.CylinderGeometry(0.008, 0.025, length, 6, 3)
    bGeo.computeVertexNormals()

    const dir = new THREE.Vector3(dirX, dirY, dirZ).normalize()
    const up = new THREE.Vector3(0, 1, 0)
    const quat = new THREE.Quaternion()
    const d = up.dot(dir)
    if (Math.abs(d - 1) > 0.001) {
      const axis = new THREE.Vector3().crossVectors(up, dir).normalize()
      quat.setFromAxisAngle(axis, Math.acos(Math.max(-1, Math.min(1, d))))
    }
    bGeo.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(quat))
    bGeo.translate(cx, cy, cz)

    const bMesh = new THREE.Mesh(bGeo, new THREE.MeshStandardMaterial({ color: 0x6b5030, roughness: 0.95 }))
    bMesh.castShadow = true
    group.add(bMesh)

    branchEnds.push(new THREE.Vector3(endX, endY, endZ))
  }

  const topCenter = new THREE.Vector3(bendX * 0.8, h * 0.85, bendZ * 0.8)
  return { group, branchEnds, topCenter }
}

// ══════════════════════════════════════════════
//  Style A: 리얼리스틱 (개별 잎 카드 + 절차적 텍스처)
// ══════════════════════════════════════════════
function createLeafTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 64; c.height = 64
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, 64, 64)

  // 잎 모양 그리기
  ctx.fillStyle = '#4a8a20'
  ctx.beginPath()
  ctx.moveTo(32, 2)
  ctx.bezierCurveTo(50, 15, 58, 35, 32, 62)
  ctx.bezierCurveTo(6, 35, 14, 15, 32, 2)
  ctx.fill()

  // 잎맥
  ctx.strokeStyle = '#3a7a15'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(32, 8); ctx.lineTo(32, 58)
  ctx.moveTo(32, 20); ctx.lineTo(20, 30)
  ctx.moveTo(32, 20); ctx.lineTo(44, 30)
  ctx.moveTo(32, 35); ctx.lineTo(18, 42)
  ctx.moveTo(32, 35); ctx.lineTo(46, 42)
  ctx.stroke()

  const tex = new THREE.CanvasTexture(c)
  tex.magFilter = THREE.LinearFilter
  return tex
}

function styleA_Realistic(branchEnds: THREE.Vector3[], topCenter: THREE.Vector3, seed: number): THREE.Group {
  const group = new THREE.Group()
  const leafTex = createLeafTexture()
  const rand = seeded(seed + 2000)

  const leafMat = new THREE.MeshStandardMaterial({
    map: leafTex,
    alphaTest: 0.3,
    transparent: false,
    side: THREE.DoubleSide,
    roughness: 0.8,
    color: 0xffffff,
  })

  const allPoints = [...branchEnds, topCenter, topCenter]

  for (const center of allPoints) {
    const count = 30 + Math.floor(rand() * 20)
    for (let i = 0; i < count; i++) {
      const leafGeo = new THREE.PlaneGeometry(0.12 + rand() * 0.08, 0.15 + rand() * 0.1)
      const theta = rand() * Math.PI * 2
      const phi = rand() * Math.PI * 0.6
      const r = 0.1 + rand() * 0.35

      const lx = center.x + Math.sin(phi) * Math.cos(theta) * r
      const ly = center.y + Math.cos(phi) * r * 0.8 + rand() * 0.15
      const lz = center.z + Math.sin(phi) * Math.sin(theta) * r

      leafGeo.translate(lx, ly, lz)
      leafGeo.rotateX(rand() * Math.PI)
      leafGeo.rotateY(rand() * Math.PI)
      leafGeo.rotateZ((rand() - 0.5) * 0.5)

      const mesh = new THREE.Mesh(leafGeo, leafMat)
      mesh.castShadow = true
      group.add(mesh)
    }
  }
  return group
}

// ══════════════════════════════════════════════
//  Style B: 스타일라이즈드 (구/타원 클러스터)
// ══════════════════════════════════════════════
function styleB_Stylized(branchEnds: THREE.Vector3[], topCenter: THREE.Vector3, seed: number): THREE.Group {
  const group = new THREE.Group()
  const rand = seeded(seed + 3000)

  const allPoints = [...branchEnds, topCenter]

  for (const center of allPoints) {
    const clusterCount = 2 + Math.floor(rand() * 3)
    for (let c = 0; c < clusterCount; c++) {
      const radius = 0.2 + rand() * 0.3
      const geo = new THREE.IcosahedronGeometry(radius, 2)
      const pos = geo.attributes.position

      // 타원형으로 눌러서 약간 납작하게
      for (let i = 0; i < pos.count; i++) {
        pos.setY(i, pos.getY(i) * (0.6 + rand() * 0.3))
        // 약간 울퉁불퉁하게
        const nx = pos.getX(i), ny = pos.getY(i), nz = pos.getZ(i)
        const noise = Math.sin(nx * 10 + seed) * Math.cos(nz * 10 + seed) * 0.15
        const r = Math.sqrt(nx * nx + ny * ny + nz * nz)
        if (r > 0.01) {
          const scale = 1 + noise
          pos.setXYZ(i, nx * scale, ny * scale, nz * scale)
        }
      }
      geo.computeVertexNormals()

      const ox = (rand() - 0.5) * 0.3
      const oy = (rand() - 0.3) * 0.2
      const oz = (rand() - 0.5) * 0.3
      geo.translate(center.x + ox, center.y + oy, center.z + oz)

      const hue = 0.25 + rand() * 0.08
      const lightness = 0.3 + rand() * 0.15
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(hue, 0.65, lightness),
        roughness: 0.85,
        flatShading: true,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.castShadow = true
      group.add(mesh)
    }
  }
  return group
}

// ══════════════════════════════════════════════
//  Style C: 빌보드 클러스터 (다중 잎 텍스처 카드)
// ══════════════════════════════════════════════
function createLeafClusterTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 128; c.height = 128
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, 128, 128)

  // 여러 잎을 한 텍스처에
  for (let i = 0; i < 12; i++) {
    const x = 20 + Math.random() * 88
    const y = 20 + Math.random() * 88
    const size = 8 + Math.random() * 16
    const hue = 80 + Math.random() * 40
    const light = 30 + Math.random() * 25

    ctx.fillStyle = `hsl(${hue}, 60%, ${light}%)`
    ctx.beginPath()
    ctx.ellipse(x, y, size * 0.5, size, Math.random() * Math.PI, 0, Math.PI * 2)
    ctx.fill()

    // 잎맥
    ctx.strokeStyle = `hsl(${hue}, 50%, ${light - 10}%)`
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(x, y - size * 0.8)
    ctx.lineTo(x, y + size * 0.8)
    ctx.stroke()
  }

  const tex = new THREE.CanvasTexture(c)
  return tex
}

function styleC_Billboard(branchEnds: THREE.Vector3[], topCenter: THREE.Vector3, seed: number): THREE.Group {
  const group = new THREE.Group()
  const clusterTex = createLeafClusterTexture()
  const rand = seeded(seed + 4000)

  const cardMat = new THREE.MeshStandardMaterial({
    map: clusterTex,
    alphaTest: 0.1,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    roughness: 0.8,
    depthWrite: true,
  })

  const allPoints = [...branchEnds, topCenter, topCenter]

  for (const center of allPoints) {
    const cardCount = 6 + Math.floor(rand() * 5)
    for (let i = 0; i < cardCount; i++) {
      const size = 0.4 + rand() * 0.4
      const cardGeo = new THREE.PlaneGeometry(size, size)

      const theta = rand() * Math.PI * 2
      const r = 0.05 + rand() * 0.25
      const lx = center.x + Math.cos(theta) * r
      const ly = center.y + (rand() - 0.3) * 0.3
      const lz = center.z + Math.sin(theta) * r

      cardGeo.translate(lx, ly, lz)
      // 랜덤 방향 (완전 빌보드 아닌 고정 방향)
      cardGeo.rotateY(rand() * Math.PI)
      cardGeo.rotateX((rand() - 0.5) * 0.6)

      const mesh = new THREE.Mesh(cardGeo, cardMat)
      mesh.castShadow = true
      group.add(mesh)
    }
  }
  return group
}

// ══════════════════════════════════════════════
//  Style D: 셰이더 기반 (구체 + 셰이더 잎 패턴)
// ══════════════════════════════════════════════
function styleD_Shader(branchEnds: THREE.Vector3[], topCenter: THREE.Vector3, seed: number): THREE.Group {
  const group = new THREE.Group()
  const rand = seeded(seed + 5000)

  const leafShaderMat = new THREE.ShaderMaterial({
    uniforms: {
      uColor1: { value: new THREE.Color(0x2a7a10) },
      uColor2: { value: new THREE.Color(0x5aaa30) },
      uColor3: { value: new THREE.Color(0x3a9a18) },
      uSeed: { value: seed },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor1, uColor2, uColor3;
      uniform float uSeed;
      varying vec3 vNormal;
      varying vec3 vWorldPos;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
                   mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
      }

      void main() {
        // 잎 패턴: 노이즈 기반 알파 cutout
        vec2 leafUv = vWorldPos.xy * 8.0 + vec2(uSeed);
        float leafPattern = noise(leafUv) * 0.5 + noise(leafUv * 2.3) * 0.3 + noise(leafUv * 5.1) * 0.2;

        // 가장자리 투명 (구체 실루엣 깨기)
        float edgeNoise = noise(vWorldPos.xz * 12.0 + vec2(uSeed * 2.0));
        float edge = dot(vNormal, normalize(vec3(0.3, 1.0, 0.2)));
        float alpha = smoothstep(0.15, 0.35, leafPattern + edge * 0.2 + edgeNoise * 0.15);

        if (alpha < 0.5) discard;

        // 색상 변화
        vec3 color = mix(uColor1, uColor2, leafPattern);
        color = mix(color, uColor3, noise(vWorldPos.xz * 3.0));

        // 간단한 조명
        float NdotL = max(0.0, dot(vNormal, normalize(vec3(0.5, 1.0, 0.5))));
        float light = 0.4 + NdotL * 0.6;
        color *= light;

        // 프레넬 림
        float fresnel = pow(1.0 - max(0.0, dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.5) * 0.15;
        color += vec3(0.2, 0.4, 0.1) * fresnel;

        gl_FragColor = vec4(color, 1.0);
      }
    `,
    side: THREE.DoubleSide,
  })

  const allPoints = [...branchEnds, topCenter]
  for (const center of allPoints) {
    const radius = 0.3 + rand() * 0.3
    const geo = new THREE.SphereGeometry(radius, 16, 12)

    // 약간 불규칙하게
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
      const r = Math.sqrt(x * x + y * y + z * z)
      const noise = Math.sin(x * 8 + seed) * Math.cos(z * 8) * 0.12
      if (r > 0.01) {
        const s = 1 + noise
        pos.setXYZ(i, x * s, y * s * 0.75, z * s)
      }
    }
    geo.computeVertexNormals()
    geo.translate(center.x + (rand() - 0.5) * 0.2, center.y + rand() * 0.15, center.z + (rand() - 0.5) * 0.2)

    const mesh = new THREE.Mesh(geo, leafShaderMat.clone())
    ;(mesh.material as THREE.ShaderMaterial).uniforms.uSeed.value = seed + rand() * 100
    mesh.castShadow = true
    group.add(mesh)
  }
  return group
}

// ══════════════════════════════════════════════
//  빌드
// ══════════════════════════════════════════════
const allGroups: THREE.Group[] = []

function createLabel(text: string, pos: THREE.Vector3, color = '#ffffff') {
  const c = document.createElement('canvas')
  c.width = 400; c.height = 100
  const ctx = c.getContext('2d')!
  ctx.fillStyle = color; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center'
  text.split('\n').forEach((line, i) => ctx.fillText(line, 200, 30 + i * 28))
  const tex = new THREE.CanvasTexture(c)
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }))
  sprite.position.copy(pos); sprite.scale.set(3, 0.8, 1)
  return sprite
}

let currentSeed = 42

function buildAll() {
  allGroups.forEach(g => {
    g.traverse(c => { if (c instanceof THREE.Mesh) { c.geometry.dispose(); if (c.material instanceof THREE.Material) c.material.dispose() } })
    scene.remove(g)
  })
  allGroups.length = 0

  const spacing = 5
  const styles = [
    { name: 'A. 리얼리스틱\n(개별 잎 카드)', fn: styleA_Realistic, color: '#ff8844' },
    { name: 'B. 스타일라이즈드\n(구/타원 클러스터)', fn: styleB_Stylized, color: '#44aaff' },
    { name: 'C. 빌보드 클러스터\n(다중 잎 텍스처)', fn: styleC_Billboard, color: '#7ee787' },
    { name: 'D. 셰이더 기반\n(구체 + cutout)', fn: styleD_Shader, color: '#d2a8ff' },
  ]

  styles.forEach((style, i) => {
    const xPos = (i - 1.5) * spacing
    const skeleton = createSkeleton(currentSeed)
    skeleton.group.position.set(xPos, 0, 0)

    const leaves = style.fn(skeleton.branchEnds, skeleton.topCenter, currentSeed)
    skeleton.group.add(leaves)

    const label = createLabel(style.name, new THREE.Vector3(xPos, 6.5, 0), style.color)
    skeleton.group.add(label)

    scene.add(skeleton.group)
    allGroups.push(skeleton.group)
  })

  const title = createLabel('← 잎 스타일 비교 →', new THREE.Vector3(0, 7.5, 0))
  scene.add(title)
  allGroups.push(new THREE.Group().add(title) as unknown as THREE.Group)
}

buildAll()

// ── GUI ──
const gui = new GUI({ width: 240 })
gui.domElement.style.position = 'absolute'
gui.domElement.style.top = '48px'
gui.domElement.style.right = '0'
canvas.parentElement!.appendChild(gui.domElement)

gui.add({ seed: currentSeed }, 'seed', 0, 500, 1).name('시드').onChange((v: number) => { currentSeed = v; buildAll() })
gui.add({ randomize: () => { currentSeed = Math.floor(Math.random() * 500); buildAll() } }, 'randomize').name('🎲 랜덤 시드')

// ── info ──
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

function animate() {
  requestAnimationFrame(animate)
  controls.update()
  const info = renderer.info.render
  infoDiv.innerHTML = `<span>seed: ${currentSeed}</span><span>triangles: ${info.triangles.toLocaleString()}</span><span>draw calls: ${info.calls}</span>`
  renderer.render(scene, camera)
}
animate()
