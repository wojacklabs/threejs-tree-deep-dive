import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import GUI from 'lil-gui'

const canvas = document.getElementById('c') as HTMLCanvasElement
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setClearColor(0x1a1a2e)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100)
camera.position.set(0, 1.5, 2.5)

const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true
controls.target.set(0, 1.5, 0)

// 조명
const sun = new THREE.DirectionalLight(0xfff5e0, 2.5)
sun.position.set(2, 5, 3)
sun.castShadow = true
scene.add(sun)
scene.add(new THREE.HemisphereLight(0x87ceeb, 0x362907, 0.4))

// 바닥
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshStandardMaterial({ color: 0x2a4a1a, roughness: 0.9 })
)
floor.rotation.x = -Math.PI / 2
floor.receiveShadow = true
scene.add(floor)

// ── 라벨 ──
function createLabel(text: string, pos: THREE.Vector3, color = '#ffffff') {
  const c = document.createElement('canvas')
  c.width = 400; c.height = 80
  const ctx = c.getContext('2d')!
  ctx.fillStyle = color; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center'
  const lines = text.split('\n')
  lines.forEach((line, i) => ctx.fillText(line, 200, 30 + i * 28))
  const tex = new THREE.CanvasTexture(c)
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }))
  sprite.position.copy(pos); sprite.scale.set(2.5, 0.8, 1)
  scene.add(sprite)
  return sprite
}

// ══════════════════════════════════════════════
//  공통 줄기 geometry
// ══════════════════════════════════════════════
const params = {
  bumpScale: 0.3,
  bumpFreqU: 8,
  bumpFreqV: 40,
  noiseStrength: 0.5,
}

function makeTrunkGeo(): THREE.CylinderGeometry {
  return new THREE.CylinderGeometry(0.04, 0.13, 3.5, 24, 32)
}

const trunkMeshes: THREE.Mesh[] = []
const labelSprites: THREE.Sprite[] = []

function buildAll() {
  // 기존 제거
  trunkMeshes.forEach(m => { m.geometry.dispose(); (m.material as THREE.Material).dispose(); scene.remove(m) })
  trunkMeshes.length = 0
  labelSprites.forEach(s => scene.remove(s))
  labelSprites.length = 0

  const h = 3.5
  const spacing = 1.2

  // ══════════════════════════════════════════════
  //  1. 기본 (질감 없음)
  // ══════════════════════════════════════════════
  const mat1 = new THREE.MeshStandardMaterial({
    color: 0x8b6b4a, roughness: 0.95, metalness: 0,
  })
  const m1 = new THREE.Mesh(makeTrunkGeo(), mat1)
  m1.position.set(-spacing * 2, h / 2, 0)
  m1.castShadow = true
  scene.add(m1); trunkMeshes.push(m1)
  labelSprites.push(createLabel('1. 기본\n(질감 없음)', new THREE.Vector3(-spacing * 2, h + 0.8, 0), '#8b949e'))

  // ══════════════════════════════════════════════
  //  2. Fragment Shader Bump (텍스처 없이)
  // ══════════════════════════════════════════════
  const mat2 = new THREE.MeshStandardMaterial({
    color: 0x8b6b4a, roughness: 0.95, metalness: 0,
  })
  mat2.onBeforeCompile = (shader) => {
    shader.uniforms.uBumpScale = { value: params.bumpScale }
    shader.uniforms.uBumpFreqU = { value: params.bumpFreqU }
    shader.uniforms.uBumpFreqV = { value: params.bumpFreqV }
    shader.uniforms.uNoiseStrength = { value: params.noiseStrength }

    // varying 추가
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
      varying vec2 vBarkUv;
      varying vec3 vWorldPos;`
    )
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vBarkUv = uv;
      vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;`
    )

    // fragment에서 normal 교란
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
      uniform float uBumpScale;
      uniform float uBumpFreqU;
      uniform float uBumpFreqV;
      uniform float uNoiseStrength;
      varying vec2 vBarkUv;
      varying vec3 vWorldPos;

      float barkHash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float barkNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(barkHash(i), barkHash(i + vec2(1,0)), f.x),
          mix(barkHash(i + vec2(0,1)), barkHash(i + vec2(1,1)), f.x),
          f.y
        );
      }
      float barkFBM(vec2 p) {
        float v = 0.0;
        v += barkNoise(p) * 0.5;
        v += barkNoise(p * 2.0) * 0.25;
        v += barkNoise(p * 4.0) * 0.125;
        return v;
      }`
    )

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>
      {
        // 나무껍질 bump: 세로 홈 + FBM 노이즈
        vec2 barkP = vec2(vBarkUv.x * uBumpFreqU, vBarkUv.y * uBumpFreqV);

        // 세로 홈 (sin 기반)
        float groove = sin(vBarkUv.x * 3.14159 * uBumpFreqU) * 0.6;

        // FBM 노이즈 (불규칙 거칠기)
        float noise = barkFBM(barkP * 1.5) * uNoiseStrength;

        // 미분으로 normal 교란 (central difference)
        float eps = 0.002;
        float hC = groove + noise;
        float hR = sin((vBarkUv.x + eps) * 3.14159 * uBumpFreqU) * 0.6
                 + barkFBM(vec2((vBarkUv.x + eps) * uBumpFreqU, vBarkUv.y * uBumpFreqV) * 1.5) * uNoiseStrength;
        float hU = sin(vBarkUv.x * 3.14159 * uBumpFreqU) * 0.6
                 + barkFBM(vec2(vBarkUv.x * uBumpFreqU, (vBarkUv.y + eps) * uBumpFreqV) * 1.5) * uNoiseStrength;

        vec3 bumpNormal = normalize(vec3(
          (hC - hR) * uBumpScale,
          (hC - hU) * uBumpScale,
          1.0
        ));

        normal = normalize(vNormal * bumpNormal.z + cross(vNormal, vec3(0,1,0)) * bumpNormal.x + vec3(0,1,0) * bumpNormal.y);
      }`
    )

    mat2.userData.shader = shader
  }
  const m2 = new THREE.Mesh(makeTrunkGeo(), mat2)
  m2.position.set(-spacing, h / 2, 0)
  m2.castShadow = true
  scene.add(m2); trunkMeshes.push(m2)
  labelSprites.push(createLabel('2. Shader Bump\n(텍스처 없이)', new THREE.Vector3(-spacing, h + 0.8, 0), '#ff8844'))

  // ══════════════════════════════════════════════
  //  3. 절차적 Normal Map (Canvas 생성)
  // ══════════════════════════════════════════════
  const normalTex = generateBarkNormalMap(512, 512)
  const mat3 = new THREE.MeshStandardMaterial({
    color: 0x8b6b4a, roughness: 0.95, metalness: 0,
    normalMap: normalTex,
    normalScale: new THREE.Vector2(1.5, 1.5),
  })
  const m3 = new THREE.Mesh(makeTrunkGeo(), mat3)
  m3.position.set(0, h / 2, 0)
  m3.castShadow = true
  scene.add(m3); trunkMeshes.push(m3)
  labelSprites.push(createLabel('3. Normal Map\n(Canvas 생성)', new THREE.Vector3(0, h + 0.8, 0), '#44aaff'))

  // ══════════════════════════════════════════════
  //  4. Fragment Shader 색상 (이끼+줄무늬, 픽셀 단위)
  // ══════════════════════════════════════════════
  const mat4 = new THREE.MeshStandardMaterial({
    color: 0x8b6b4a, roughness: 0.95, metalness: 0,
    normalMap: normalTex,
    normalScale: new THREE.Vector2(1.5, 1.5),
  })
  mat4.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
      varying vec2 vBarkUv2;
      varying vec3 vLocalPos;`
    )
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vBarkUv2 = uv;
      vLocalPos = position;`
    )

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
      varying vec2 vBarkUv2;
      varying vec3 vLocalPos;
      float colorHash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float colorNoise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(colorHash(i), colorHash(i+vec2(1,0)), f.x),
                   mix(colorHash(i+vec2(0,1)), colorHash(i+vec2(1,1)), f.x), f.y);
      }`
    )

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `
      float heightT = vBarkUv2.y;

      // 높이별 색상
      vec3 darkBark = vec3(0.35, 0.25, 0.15);
      vec3 lightBark = vec3(0.6, 0.48, 0.32);
      vec3 baseCol = mix(darkBark, lightBark, heightT);

      // 이끼 (픽셀 단위 노이즈)
      float mossN = colorNoise(vLocalPos.xz * 6.0 + vec2(42.0));
      float mossH = max(0.0, 1.0 - heightT * 2.0);
      float moss = mossH * mossH * mossN * 0.8;
      vec3 mossCol = vec3(0.15, 0.35, 0.1);
      baseCol = mix(baseCol, mossCol, moss);

      // 세로 줄무늬 (픽셀 단위)
      float stripe = sin(vBarkUv2.x * 3.14159 * 16.0 + colorNoise(vLocalPos.xy * 4.0) * 4.0);
      stripe = stripe * 0.5 + 0.5;
      baseCol -= vec3(0.06, 0.05, 0.03) * stripe;

      gl_FragColor.rgb = baseCol * gl_FragColor.rgb / vec3(0.545, 0.420, 0.290);

      #include <dithering_fragment>
      `
    )
  }
  const m4 = new THREE.Mesh(makeTrunkGeo(), mat4)
  m4.position.set(spacing, h / 2, 0)
  m4.castShadow = true
  scene.add(m4); trunkMeshes.push(m4)
  labelSprites.push(createLabel('4. Shader 색상\n(이끼+줄무늬)', new THREE.Vector3(spacing, h + 0.8, 0), '#7ee787'))

  // ══════════════════════════════════════════════
  //  5. 전부 조합 (bump + normalMap + shader 색상)
  // ══════════════════════════════════════════════
  const mat5 = new THREE.MeshStandardMaterial({
    color: 0x8b6b4a, roughness: 0.95, metalness: 0,
    normalMap: normalTex,
    normalScale: new THREE.Vector2(1.5, 1.5),
  })
  mat5.onBeforeCompile = (shader) => {
    shader.uniforms.uBumpScale = { value: params.bumpScale }

    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
      varying vec2 vBarkUv3;
      varying vec3 vLocalPos3;`
    )
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vBarkUv3 = uv;
      vLocalPos3 = position;`
    )

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
      uniform float uBumpScale;
      varying vec2 vBarkUv3;
      varying vec3 vLocalPos3;
      float allHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float allNoise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(allHash(i), allHash(i+vec2(1,0)), f.x),
                   mix(allHash(i+vec2(0,1)), allHash(i+vec2(1,1)), f.x), f.y);
      }`
    )

    // bump
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>
      {
        vec2 bp = vec2(vBarkUv3.x * 8.0, vBarkUv3.y * 40.0);
        float groove = sin(vBarkUv3.x * 3.14159 * 8.0) * 0.6;
        float n = allNoise(bp * 1.5) * 0.5;
        float eps = 0.002;
        float hC = groove + n;
        float hR = sin((vBarkUv3.x+eps) * 3.14159 * 8.0) * 0.6 + allNoise(vec2((vBarkUv3.x+eps)*8.0, vBarkUv3.y*40.0)*1.5)*0.5;
        float hU = sin(vBarkUv3.x * 3.14159 * 8.0) * 0.6 + allNoise(vec2(vBarkUv3.x*8.0, (vBarkUv3.y+eps)*40.0)*1.5)*0.5;
        vec3 bn = normalize(vec3((hC-hR)*uBumpScale, (hC-hU)*uBumpScale, 1.0));
        normal = normalize(vNormal * bn.z + cross(vNormal, vec3(0,1,0)) * bn.x + vec3(0,1,0) * bn.y);
      }`
    )

    // 색상
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `
      float ht = vBarkUv3.y;
      vec3 dBark = vec3(0.35, 0.25, 0.15);
      vec3 lBark = vec3(0.6, 0.48, 0.32);
      vec3 bCol = mix(dBark, lBark, ht);
      float mN = allNoise(vLocalPos3.xz * 6.0 + vec2(42.0));
      float mH = max(0.0, 1.0 - ht * 2.0);
      float ms = mH * mH * mN * 0.8;
      bCol = mix(bCol, vec3(0.15, 0.35, 0.1), ms);
      float st = sin(vBarkUv3.x * 3.14159 * 16.0 + allNoise(vLocalPos3.xy * 4.0) * 4.0) * 0.5 + 0.5;
      bCol -= vec3(0.06, 0.05, 0.03) * st;
      gl_FragColor.rgb = bCol * gl_FragColor.rgb / vec3(0.545, 0.420, 0.290);
      #include <dithering_fragment>
      `
    )

    mat5.userData.shader = shader
  }
  const m5 = new THREE.Mesh(makeTrunkGeo(), mat5)
  m5.position.set(spacing * 2, h / 2, 0)
  m5.castShadow = true
  scene.add(m5); trunkMeshes.push(m5)
  labelSprites.push(createLabel('5. 전부 조합\n(최종)', new THREE.Vector3(spacing * 2, h + 0.8, 0), '#d2a8ff'))

  labelSprites.push(createLabel('← 질감 방식별 비교 →', new THREE.Vector3(0, h + 1.5, 0)))
}

// ── 절차적 Normal Map 생성 ──
function generateBarkNormalMap(w: number, h: number): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(w, h)

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w, v = y / h

      // 세로 홈 (sin 패턴)
      const groove = Math.sin(u * Math.PI * 16) * 0.5

      // 노이즈 (해시 기반)
      const nx = Math.sin(x * 0.1 + y * 0.07) * Math.cos(x * 0.13 + y * 0.11)
      const noise = nx * 0.3

      // 미분으로 normal 계산
      const eps = 1 / w
      const hC = groove + noise
      const hR = Math.sin((u + eps) * Math.PI * 16) * 0.5 +
                 Math.sin((x + 1) * 0.1 + y * 0.07) * Math.cos((x + 1) * 0.13 + y * 0.11) * 0.3
      const hU = Math.sin(u * Math.PI * 16) * 0.5 +
                 Math.sin(x * 0.1 + (y + 1) * 0.07) * Math.cos(x * 0.13 + (y + 1) * 0.11) * 0.3

      // normal map: RGB = (nx*0.5+0.5, ny*0.5+0.5, 1.0) * 255
      const dx = (hC - hR) * 3
      const dy = (hC - hU) * 3

      const i = (y * w + x) * 4
      img.data[i] = Math.floor((dx * 0.5 + 0.5) * 255)
      img.data[i + 1] = Math.floor((dy * 0.5 + 0.5) * 255)
      img.data[i + 2] = 255  // Z = 1 (위를 향함)
      img.data[i + 3] = 255
    }
  }

  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  return tex
}

buildAll()

// ── GUI ──
const gui = new GUI({ width: 260 })
gui.domElement.style.position = 'absolute'
gui.domElement.style.top = '48px'
gui.domElement.style.right = '0'
canvas.parentElement!.appendChild(gui.domElement)

const bumpFolder = gui.addFolder('Shader Bump')
bumpFolder.add(params, 'bumpScale', 0, 1, 0.05).name('범프 강도').onChange(buildAll)
bumpFolder.add(params, 'bumpFreqU', 2, 20, 1).name('홈 개수 (둘레)').onChange(buildAll)
bumpFolder.add(params, 'bumpFreqV', 10, 80, 1).name('홈 밀도 (높이)').onChange(buildAll)
bumpFolder.add(params, 'noiseStrength', 0, 1, 0.05).name('노이즈 강도').onChange(buildAll)

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
function animate() {
  requestAnimationFrame(animate)
  controls.update()
  renderer.render(scene, camera)
}
animate()
