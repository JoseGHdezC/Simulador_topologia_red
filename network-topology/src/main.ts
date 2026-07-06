import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { NetworkGraph } from './NetworkGraph'
import { NetworkNode } from './NetworkNode'
import { Tooltip } from './Tooltip'
import { TopologySelector } from './TopologySelector'
import { TopologyInfo } from './TopologyInfo'
import { TopologyId, AnyParams, getTopology } from './topologyMeta'

// ─── Scene setup ─────────────────────────────────────────────────────────────

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0a1628)
scene.fog = new THREE.FogExp2(0x0a1628, 0.028)

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 300)
camera.position.set(0, 14, 26)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(window.devicePixelRatio)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
document.getElementById('app')!.appendChild(renderer.domElement)

// ─── Lighting ─────────────────────────────────────────────────────────────────

scene.add(new THREE.AmbientLight(0x223344, 1.8))

const dirLight = new THREE.DirectionalLight(0xffffff, 2.2)
dirLight.position.set(12, 20, 12)
dirLight.castShadow = true
dirLight.shadow.mapSize.set(1024, 1024)
scene.add(dirLight)

const pointLight = new THREE.PointLight(0x4dd0e1, 3, 50)
pointLight.position.set(0, 8, 0)
scene.add(pointLight)

// ─── Grid ─────────────────────────────────────────────────────────────────────

const grid = new THREE.GridHelper(60, 60, 0x1a3a5c, 0x112233)
grid.position.y = -1.8
scene.add(grid)

// ─── Controls ─────────────────────────────────────────────────────────────────

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.dampingFactor = 0.06
controls.minDistance = 3
controls.maxDistance = 100
controls.maxPolarAngle = Math.PI * 0.85

// ─── Graph ────────────────────────────────────────────────────────────────────

const graph = new NetworkGraph(scene)

// ─── Panel toggles ────────────────────────────────────────────────────────────
// Declared here (before topologyInfo/selector) so updateToggleArrows() is safe
// to call anywhere below without hitting the temporal dead zone.

const leftPanel   = document.getElementById('topology-selector')! as HTMLElement
const rightPanel  = document.getElementById('topology-info')!     as HTMLElement
const legendPanel = document.getElementById('legend-panel')!      as HTMLElement
const toggleLeft  = document.getElementById('toggle-left')        as HTMLButtonElement
const toggleRight = document.getElementById('toggle-right')       as HTMLButtonElement

function updateToggleArrows(): void {
  toggleLeft.textContent  = leftPanel.classList.contains('collapsed')  ? '›' : '‹'
  toggleRight.textContent = rightPanel.classList.contains('collapsed') || !rightPanel.classList.contains('visible') ? '‹' : '›'
  legendPanel.style.left  = leftPanel.classList.contains('collapsed')  ? '12px' : '232px'
}

toggleLeft.addEventListener('click', () => {
  leftPanel.classList.toggle('collapsed')
  updateToggleArrows()
})

toggleRight.addEventListener('click', () => {
  if (!rightPanel.classList.contains('visible')) return
  rightPanel.classList.toggle('collapsed')
  updateToggleArrows()
})

// ─── Topology loading ─────────────────────────────────────────────────────────

function buildGraph(id: TopologyId, params: AnyParams): void {
  graph.clear()
  const meta = getTopology(id)
  if (!meta) return

  const { nodes, links } = meta.generate(params)

  for (const nodeDef of nodes) graph.addNode(nodeDef)
  for (const linkDef of links) graph.addLink({
    sourceId: linkDef.sourceId,
    targetId: linkDef.targetId,
    arc: linkDef.arc,
    perpOffset: linkDef.perpOffset,
    color: linkDef.color,
  })

  camera.position.set(0, 14, 26)
  controls.target.set(0, 0, 0)
  controls.update()
}

let activeTopologyId: TopologyId | null = null

const topologyInfo = new TopologyInfo((params: AnyParams) => {
  if (activeTopologyId) buildGraph(activeTopologyId, params)
})

const selector = new TopologySelector((id: TopologyId) => {
  activeTopologyId = id
  const meta = getTopology(id)
  if (!meta) return
  topologyInfo.show(meta)
  buildGraph(id, meta.defaultParams)
  updateToggleArrows()
})

selector.select(selector.getFirstId())
updateToggleArrows()

// ─── Hover tooltip ────────────────────────────────────────────────────────────

const tooltip = new Tooltip()
const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()

function onPointerMove(event: MouseEvent): void {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1

  raycaster.setFromCamera(pointer, camera)
  const meshes = [...graph.nodes.values()].map(n => n.mesh)
  const intersects = raycaster.intersectObjects(meshes, false)

  if (intersects.length > 0) {
    const node = intersects[0].object.userData['node'] as NetworkNode
    document.body.style.cursor = 'pointer'
    tooltip.show(node, event.clientX, event.clientY)
  } else {
    document.body.style.cursor = 'default'
    tooltip.hide()
  }
}

window.addEventListener('pointermove', onPointerMove)

// ─── Legend ───────────────────────────────────────────────────────────────────

function buildLegend(): void {
  const legend = document.getElementById('legend')
  if (!legend) return
  const items = [
    { color: '#4fc3f7', label: 'Router' },
    { color: '#81c784', label: 'Switch' },
    { color: '#ffb74d', label: 'Server' },
    { color: '#ce93d8', label: 'Client' },
    { color: '#4dd0e1', label: 'Link' },
  ]
  legend.innerHTML = items
    .map(i => `<div class="legend-item">
      <span class="legend-dot" style="background:${i.color}"></span>${i.label}
    </div>`)
    .join('')
}
buildLegend()

// ─── Resize ───────────────────────────────────────────────────────────────────

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

// ─── Animation loop ───────────────────────────────────────────────────────────

let time = 0

function animate(): void {
  requestAnimationFrame(animate)
  time += 0.008
  controls.update()
  graph.update()

  for (const node of graph.nodes.values()) {
    node.mesh.position.y += Math.sin(time * 1.2 + node.mesh.id * 0.9) * 0.002
    if (node.type === 'router') node.mesh.rotation.y += 0.007
  }

  pointLight.intensity = 2.6 + Math.sin(time * 1.5) * 0.5
  renderer.render(scene, camera)
}

animate()
