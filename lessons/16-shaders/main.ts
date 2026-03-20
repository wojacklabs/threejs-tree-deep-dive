import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const canvas = document.getElementById('c') as HTMLCanvasElement
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setClearColor(0x0d1117)

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100)
camera.position.set(0, 2, 6)

const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true

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
//  데모 1: 최소 셰이더 — 단색
// ══════════════════════════════════════════════
const minimalMat = new THREE.ShaderMaterial({
  vertexShader: `
    void main() {
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    void main() {
      gl_FragColor = vec4(1.0, 0.0, 0.5, 1.0); // 핑크
    }
  `,
})

const minimalMesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 16), minimalMat)
minimalMesh.position.set(-4, 0.5, 3)
scene.add(minimalMesh)
createLabel('minimal (단색)', new THREE.Vector3(-4, 1.8, 3))

// ══════════════════════════════════════════════
//  데모 2: uniform — 시간 기반 색상 변화
// ══════════════════════════════════════════════
const uniformMat = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
  },
  vertexShader: `
    void main() {
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;

    void main() {
      float r = sin(uTime) * 0.5 + 0.5;
      float g = sin(uTime * 1.3 + 1.0) * 0.5 + 0.5;
      float b = sin(uTime * 1.7 + 2.0) * 0.5 + 0.5;
      gl_FragColor = vec4(r, g, b, 1.0);
    }
  `,
})

const uniformMesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 16), uniformMat)
uniformMesh.position.set(-1.5, 0.5, 3)
scene.add(uniformMesh)
createLabel('uniform (시간→색)', new THREE.Vector3(-1.5, 1.8, 3))

// ══════════════════════════════════════════════
//  데모 3: varying — 위치 기반 그라데이션
// ══════════════════════════════════════════════
const varyingMat = new THREE.ShaderMaterial({
  vertexShader: `
    varying vec3 vPosition;

    void main() {
      vPosition = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec3 vPosition;

    void main() {
      // 위치를 0~1 범위로 정규화
      float r = vPosition.x * 0.5 + 0.5;
      float g = vPosition.y * 0.5 + 0.5;
      float b = vPosition.z * 0.5 + 0.5;
      gl_FragColor = vec4(r, g, b, 1.0);
    }
  `,
})

const varyingMesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 16), varyingMat)
varyingMesh.position.set(1.5, 0.5, 3)
scene.add(varyingMesh)
createLabel('varying (위치→색)', new THREE.Vector3(1.5, 1.8, 3))

// ══════════════════════════════════════════════
//  데모 4: UV 기반 패턴
// ══════════════════════════════════════════════
const uvMat = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    varying vec2 vUv;

    void main() {
      // 체커보드 패턴
      float check = step(0.5, fract(vUv.x * 8.0)) * step(0.5, fract(vUv.y * 8.0));
      check += step(0.5, fract(vUv.x * 8.0 + 0.5)) * step(0.5, fract(vUv.y * 8.0 + 0.5));

      vec3 color = mix(
        vec3(0.1, 0.1, 0.3),
        vec3(0.0, 1.0, 0.8),
        check
      );
      gl_FragColor = vec4(color, 1.0);
    }
  `,
})

const uvMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), uvMat)
uvMesh.position.set(4, 0.5, 3)
scene.add(uvMesh)
createLabel('UV 패턴 (체커보드)', new THREE.Vector3(4, 1.8, 3))

// ══════════════════════════════════════════════
//  데모 5: Vertex Displacement — 파도
// ══════════════════════════════════════════════
const waveMat = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uAmplitude: { value: 0.3 },
    uFrequency: { value: 3.0 },
  },
  vertexShader: `
    uniform float uTime;
    uniform float uAmplitude;
    uniform float uFrequency;
    varying float vElevation;

    void main() {
      vec3 pos = position;

      // 파도: 여러 sin 합성
      float wave = sin(pos.x * uFrequency + uTime) * uAmplitude;
      wave += sin(pos.z * uFrequency * 0.8 + uTime * 1.3) * uAmplitude * 0.5;
      wave += sin((pos.x + pos.z) * uFrequency * 0.5 + uTime * 0.7) * uAmplitude * 0.3;

      pos.y += wave;
      vElevation = wave;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  fragmentShader: `
    varying float vElevation;

    void main() {
      // 높이에 따라 색상 변화 (파란→하얀)
      float t = vElevation * 2.0 + 0.5;
      vec3 deepColor = vec3(0.0, 0.1, 0.4);
      vec3 shallowColor = vec3(0.0, 0.8, 1.0);
      vec3 foamColor = vec3(1.0);

      vec3 color = mix(deepColor, shallowColor, clamp(t, 0.0, 1.0));
      color = mix(color, foamColor, clamp(t - 0.7, 0.0, 1.0) * 0.5);

      gl_FragColor = vec4(color, 1.0);
    }
  `,
  side: THREE.DoubleSide,
  wireframe: false,
})

const wavePlane = new THREE.Mesh(
  new THREE.PlaneGeometry(6, 6, 64, 64),
  waveMat
)
wavePlane.rotation.x = -Math.PI / 2
wavePlane.position.set(0, 0, -2)
scene.add(wavePlane)
createLabel('vertex displacement (파도)', new THREE.Vector3(0, 1.8, -2), '#00ccff')

// ══════════════════════════════════════════════
//  데모 6: 프레넬 효과
// ══════════════════════════════════════════════
const fresnelMat = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
  },
  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vViewDir;

    void main() {
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vNormal = normalize(normalMatrix * normal);
      vViewDir = normalize(cameraPosition - worldPos.xyz);
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,
  fragmentShader: `
    uniform float uTime;
    varying vec3 vNormal;
    varying vec3 vViewDir;

    void main() {
      // 프레넬: 시선과 법선의 각도
      float fresnel = pow(1.0 - dot(vNormal, vViewDir), 3.0);

      vec3 innerColor = vec3(0.05, 0.0, 0.1);
      vec3 edgeColor = vec3(0.3, 0.5, 1.0);
      edgeColor += vec3(sin(uTime) * 0.2, 0.0, cos(uTime * 0.7) * 0.3);

      vec3 color = mix(innerColor, edgeColor, fresnel);
      gl_FragColor = vec4(color, 1.0);
    }
  `,
  transparent: true,
})

const fresnelMesh = new THREE.Mesh(new THREE.SphereGeometry(0.7, 64, 32), fresnelMat)
fresnelMesh.position.set(-2.5, 0.7, -2)
scene.add(fresnelMesh)
createLabel('fresnel (시선 각도)', new THREE.Vector3(-2.5, 1.8, -2), '#5588ff')

// ══════════════════════════════════════════════
//  데모 7: 디졸브 효과
// ══════════════════════════════════════════════
const dissolveMat = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uThreshold: { value: 0.5 },
  },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vPosition;

    void main() {
      vUv = uv;
      vPosition = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform float uThreshold;
    varying vec2 vUv;
    varying vec3 vPosition;

    // 간단한 해시 노이즈
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
        f.y
      );
    }

    void main() {
      float n = noise(vUv * 6.0);
      float threshold = sin(uTime * 0.5) * 0.5 + 0.5;

      if (n < threshold) discard;  // 픽셀 버리기!

      // 경계에 빛나는 엣지
      float edge = smoothstep(threshold, threshold + 0.05, n);
      vec3 baseColor = vec3(0.8, 0.2, 0.1);
      vec3 edgeColor = vec3(1.0, 0.6, 0.0) * 3.0;

      vec3 color = mix(edgeColor, baseColor, edge);
      gl_FragColor = vec4(color, 1.0);
    }
  `,
  side: THREE.DoubleSide,
})

const dissolveMesh = new THREE.Mesh(new THREE.TorusKnotGeometry(0.4, 0.15, 128, 32), dissolveMat)
dissolveMesh.position.set(2.5, 0.7, -2)
scene.add(dissolveMesh)
createLabel('dissolve (discard)', new THREE.Vector3(2.5, 1.8, -2), '#ff6600')

// ── 바닥 그리드 ──
scene.add(new THREE.GridHelper(20, 20, 0x222222, 0x111111))

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

  // uniform 업데이트
  uniformMat.uniforms.uTime.value = t
  uvMat.uniforms.uTime.value = t
  waveMat.uniforms.uTime.value = t
  fresnelMat.uniforms.uTime.value = t
  dissolveMat.uniforms.uTime.value = t

  // 오브젝트 회전
  minimalMesh.rotation.y = t * 0.3
  uniformMesh.rotation.y = t * 0.3
  varyingMesh.rotation.y = t * 0.3
  uvMesh.rotation.y = t * 0.3
  dissolveMesh.rotation.y = t * 0.5

  controls.update()
  renderer.render(scene, camera)
}
animate()
