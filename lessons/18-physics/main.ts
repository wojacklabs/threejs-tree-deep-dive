import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import * as CANNON from 'cannon-es'
import GUI from 'lil-gui'

const canvas = document.getElementById('c') as HTMLCanvasElement
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setClearColor(0x0d1117)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100)
camera.position.set(0, 8, 15)

const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true
controls.target.set(0, 2, 0)

// 조명
const dirLight = new THREE.DirectionalLight(0xffffff, 1.5)
dirLight.position.set(5, 10, 5)
dirLight.castShadow = true
dirLight.shadow.mapSize.set(1024, 1024)
dirLight.shadow.camera.left = -10
dirLight.shadow.camera.right = 10
dirLight.shadow.camera.top = 10
dirLight.shadow.camera.bottom = -10
scene.add(dirLight)
scene.add(new THREE.AmbientLight(0xffffff, 0.4))

// ══════════════════════════════════════════════
//  Cannon.js 물리 월드
// ══════════════════════════════════════════════
const world = new CANNON.World()
world.gravity.set(0, -9.82, 0)
world.broadphase = new CANNON.SAPBroadphase(world)

// 재질 (반발력, 마찰)
const defaultMaterial = new CANNON.Material('default')
const defaultContact = new CANNON.ContactMaterial(defaultMaterial, defaultMaterial, {
  friction: 0.3,
  restitution: 0.4,
})
world.addContactMaterial(defaultContact)
world.defaultContactMaterial = defaultContact

// ── 바닥 (Three.js + Cannon) ──
const floorMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 })
)
floorMesh.rotation.x = -Math.PI / 2
floorMesh.receiveShadow = true
scene.add(floorMesh)

const floorBody = new CANNON.Body({
  type: CANNON.Body.STATIC,
  shape: new CANNON.Plane(),
})
floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
world.addBody(floorBody)

// ── 경사면 ──
const rampGeo = new THREE.BoxGeometry(4, 0.2, 3)
const rampMesh = new THREE.Mesh(rampGeo, new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.6 }))
rampMesh.position.set(-5, 1.5, 0)
rampMesh.rotation.z = Math.PI * 0.15
rampMesh.castShadow = true
rampMesh.receiveShadow = true
scene.add(rampMesh)

const rampBody = new CANNON.Body({
  type: CANNON.Body.STATIC,
  shape: new CANNON.Box(new CANNON.Vec3(2, 0.1, 1.5)),
})
rampBody.position.set(-5, 1.5, 0)
rampBody.quaternion.setFromEuler(0, 0, Math.PI * 0.15)
world.addBody(rampBody)

// ── 동적 오브젝트 관리 ──
interface PhysicsObject {
  mesh: THREE.Mesh
  body: CANNON.Body
}

const objects: PhysicsObject[] = []

const sphereGeo = new THREE.SphereGeometry(0.4, 32, 16)
const boxGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6)

const colors = [0xff4444, 0x44ff44, 0x4488ff, 0xff8844, 0xaa44ff, 0x44ffaa, 0xffff44, 0xff44aa]

function addSphere(x: number, y: number, z: number) {
  const color = colors[Math.floor(Math.random() * colors.length)]
  const mesh = new THREE.Mesh(
    sphereGeo,
    new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.3 })
  )
  mesh.castShadow = true
  scene.add(mesh)

  const body = new CANNON.Body({
    mass: 1,
    shape: new CANNON.Sphere(0.4),
    position: new CANNON.Vec3(x, y, z),
  })
  world.addBody(body)

  objects.push({ mesh, body })
}

function addBox(x: number, y: number, z: number) {
  const color = colors[Math.floor(Math.random() * colors.length)]
  const mesh = new THREE.Mesh(
    boxGeo,
    new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.2 })
  )
  mesh.castShadow = true
  scene.add(mesh)

  const body = new CANNON.Body({
    mass: 1,
    shape: new CANNON.Box(new CANNON.Vec3(0.3, 0.3, 0.3)),
    position: new CANNON.Vec3(x, y, z),
  })
  world.addBody(body)

  objects.push({ mesh, body })
}

// 벽돌 탑 쌓기
function buildTower() {
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 3; col++) {
      addBox(col * 0.65 - 0.65, row * 0.65 + 0.35, 0)
    }
  }
}
buildTower()

// ══════════════════════════════════════════════
//  lil-gui — Debug UI
// ══════════════════════════════════════════════
const gui = new GUI({ width: 280 })
gui.domElement.style.position = 'absolute'
gui.domElement.style.top = '48px'
gui.domElement.style.right = '0'
canvas.parentElement!.appendChild(gui.domElement)

const params = {
  gravity: -9.82,
  restitution: 0.4,
  friction: 0.3,
  shootForce: 15,
  addSphere: () => {
    addSphere(
      (Math.random() - 0.5) * 4,
      8 + Math.random() * 3,
      (Math.random() - 0.5) * 4
    )
  },
  addBox: () => {
    addBox(
      (Math.random() - 0.5) * 4,
      8 + Math.random() * 3,
      (Math.random() - 0.5) * 4
    )
  },
  shootSphere: () => {
    const dir = new THREE.Vector3()
    camera.getWorldDirection(dir)
    const pos = camera.position.clone().add(dir.clone().multiplyScalar(2))
    addSphere(pos.x, pos.y, pos.z)
    const lastObj = objects[objects.length - 1]
    lastObj.body.velocity.set(
      dir.x * params.shootForce,
      dir.y * params.shootForce,
      dir.z * params.shootForce
    )
  },
  reset: () => {
    // 동적 오브젝트 전부 제거
    for (const obj of objects) {
      scene.remove(obj.mesh)
      world.removeBody(obj.body)
      obj.mesh.geometry.dispose()
      ;(obj.mesh.material as THREE.Material).dispose()
    }
    objects.length = 0
    buildTower()
  },
}

const physicsFolder = gui.addFolder('Physics')
physicsFolder.add(params, 'gravity', -20, 0, 0.1).onChange((v: number) => {
  world.gravity.set(0, v, 0)
})
physicsFolder.add(params, 'restitution', 0, 1, 0.05).onChange((v: number) => {
  defaultContact.restitution = v
})
physicsFolder.add(params, 'friction', 0, 1, 0.05).onChange((v: number) => {
  defaultContact.friction = v
})
physicsFolder.add(params, 'shootForce', 5, 40, 1)

const actionFolder = gui.addFolder('Actions')
actionFolder.add(params, 'addSphere').name('Drop Sphere')
actionFolder.add(params, 'addBox').name('Drop Box')
actionFolder.add(params, 'shootSphere').name('Shoot!')
actionFolder.add(params, 'reset').name('Reset Tower')

// ── 정보 ──
const infoDiv = document.getElementById('info') as HTMLDivElement

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
let lastTime = 0

function animate() {
  requestAnimationFrame(animate)
  const elapsed = clock.getElapsedTime()
  const delta = elapsed - lastTime
  lastTime = elapsed

  // 물리 시뮬레이션 스텝 (고정 타임스텝)
  world.step(1 / 60, delta, 3)

  // 물리 body → Three.js mesh 동기화
  for (const obj of objects) {
    obj.mesh.position.copy(obj.body.position as unknown as THREE.Vector3)
    obj.mesh.quaternion.copy(obj.body.quaternion as unknown as THREE.Quaternion)
  }

  // 바닥 아래로 떨어진 오브젝트 제거
  for (let i = objects.length - 1; i >= 0; i--) {
    if (objects[i].body.position.y < -10) {
      scene.remove(objects[i].mesh)
      world.removeBody(objects[i].body)
      objects.splice(i, 1)
    }
  }

  infoDiv.innerHTML = `
    <span>bodies: ${objects.length}</span>
    <span>gravity: ${params.gravity.toFixed(1)}</span>
    <span>restitution: ${params.restitution.toFixed(2)}</span>
  `

  controls.update()
  renderer.render(scene, camera)
}
animate()
