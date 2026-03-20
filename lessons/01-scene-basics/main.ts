import * as THREE from 'three'

const canvas = document.getElementById('c') as HTMLCanvasElement

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })

const scene = new THREE.Scene()

const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
camera.position.z = 3

const geometry = new THREE.BoxGeometry(1, 1, 1)
const material = new THREE.MeshNormalMaterial()
const cube = new THREE.Mesh(geometry, material)
scene.add(cube)

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

function animate() {
  requestAnimationFrame(animate)
  cube.rotation.x += 0.01
  cube.rotation.y += 0.01
  renderer.render(scene, camera)
}
animate()
