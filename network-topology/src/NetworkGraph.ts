import * as THREE from 'three'
import { NetworkNode, NodeConfig } from './NetworkNode'
import { NetworkLink, LinkConfig } from './NetworkLink'

export class NetworkGraph {
  private scene: THREE.Scene
  readonly nodes: Map<string, NetworkNode> = new Map()
  readonly links: NetworkLink[] = []

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  addNode(config: NodeConfig): NetworkNode {
    const node = new NetworkNode(config)
    this.nodes.set(node.id, node)
    this.scene.add(node.mesh)
    return node
  }

  addLink(
    config: Omit<LinkConfig, 'source' | 'target'> & { sourceId: string; targetId: string }
  ): NetworkLink | null {
    const source = this.nodes.get(config.sourceId)
    const target = this.nodes.get(config.targetId)
    if (!source || !target) {
      console.warn(`NetworkGraph: node not found for link ${config.sourceId} -> ${config.targetId}`)
      return null
    }
    const link = new NetworkLink({
      source,
      target,
      bandwidth: config.bandwidth,
      status: config.status,
      arc: config.arc,
      perpOffset: config.perpOffset,
      color: config.color,
    })
    link.addToScene(this.scene)
    this.links.push(link)
    return link
  }

  /** Remove all nodes and links from the scene and clear internal state. */
  clear(): void {
    for (const link of this.links) {
      link.removeFromScene()
    }
    this.links.length = 0

    for (const node of this.nodes.values()) {
      this.scene.remove(node.mesh)
      // Dispose geometry and material
      node.mesh.geometry.dispose()
      const mat = node.mesh.material
      if (Array.isArray(mat)) mat.forEach(m => m.dispose())
      else mat.dispose()
    }
    this.nodes.clear()
  }

  /** Update all link geometries (call each frame when nodes can move). */
  update(): void {
    for (const link of this.links) {
      link.update()
    }
  }

  getNode(id: string): NetworkNode | undefined {
    return this.nodes.get(id)
  }
}
