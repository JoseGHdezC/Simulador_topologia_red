import * as THREE from 'three'

export type NodeType = 'router' | 'switch' | 'server' | 'client'

export type NodeStatus = 'online' | 'offline' | 'warning'

export interface NodeConfig {
  id: string
  label: string
  type: NodeType
  status?: NodeStatus
  position?: { x: number; y: number; z: number }
}

// Colors per node type
const NODE_COLORS: Record<NodeType, number> = {
  router: 0x4fc3f7,
  switch: 0x81c784,
  server: 0xffb74d,
  client: 0xce93d8,
}

// Colors per status (emissive tint)
const STATUS_EMISSIVE: Record<NodeStatus, number> = {
  online: 0x003311,
  offline: 0x330000,
  warning: 0x332200,
}

export class NetworkNode {
  readonly id: string
  readonly label: string
  readonly type: NodeType
  status: NodeStatus
  mesh: THREE.Mesh
  labelSprite: THREE.Sprite

  constructor(config: NodeConfig) {
    this.id = config.id
    this.label = config.label
    this.type = config.type
    this.status = config.status ?? 'online'

    // Geometry: routers are octahedrons, switches are boxes, servers are cylinders, clients are spheres
    const geometry = this.buildGeometry()
    const material = new THREE.MeshPhongMaterial({
      color: NODE_COLORS[this.type],
      emissive: STATUS_EMISSIVE[this.status],
      shininess: 80,
    })

    this.mesh = new THREE.Mesh(geometry, material)
    this.mesh.castShadow = true
    this.mesh.receiveShadow = true

    if (config.position) {
      this.mesh.position.set(config.position.x, config.position.y, config.position.z)
    }

    // Store reference back to this node for raycasting
    this.mesh.userData['node'] = this

    this.labelSprite = this.buildLabel()
    this.mesh.add(this.labelSprite)
  }

  private buildGeometry(): THREE.BufferGeometry {
    switch (this.type) {
      case 'router':
        return new THREE.OctahedronGeometry(0.55)
      case 'switch':
        return new THREE.BoxGeometry(1.0, 0.4, 0.7)
      case 'server':
        return new THREE.CylinderGeometry(0.35, 0.35, 0.9, 16)
      case 'client':
      default:
        return new THREE.SphereGeometry(0.42, 24, 24)
    }
  }

  private buildLabel(): THREE.Sprite {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 64
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, 256, 64)
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.roundRect(4, 4, 248, 56, 8)
    ctx.fill()
    ctx.font = 'bold 22px monospace'
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(this.label, 128, 32)

    const texture = new THREE.CanvasTexture(canvas)
    const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true })
    const sprite = new THREE.Sprite(material)
    sprite.scale.set(2.0, 0.5, 1)
    sprite.position.set(0, 1.1, 0)
    return sprite
  }

  setStatus(status: NodeStatus): void {
    this.status = status
    const mat = this.mesh.material as THREE.MeshPhongMaterial
    mat.emissive.setHex(STATUS_EMISSIVE[status])
  }

  get position(): THREE.Vector3 {
    return this.mesh.position
  }
}
