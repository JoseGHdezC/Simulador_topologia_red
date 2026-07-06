import * as THREE from 'three'
import { NetworkNode } from './NetworkNode'

export type LinkStatus = 'active' | 'inactive' | 'saturated'

export interface LinkConfig {
  source: NetworkNode
  target: NetworkNode
  bandwidth?: number
  status?: LinkStatus
  /**
   * Arc height as a fraction of the link length. Lifts the midpoint upward (Y+).
   */
  arc?: number
  /**
   * Perpendicular offset of the arc midpoint in the XZ plane (world units).
   * Positive/negative values fan the tube to either side of the straight line,
   * separating multiple links between nodes that share the same axis.
   */
  perpOffset?: number
  /** Override color (hex). Falls back to status color if omitted. */
  color?: number
}

const STATUS_COLORS: Record<LinkStatus, number> = {
  active:   0x4dd0e1,
  inactive: 0x546e7a,
  saturated: 0xef5350,
}

/** Number of points along the tube curve. More = smoother arc. */
const CURVE_SEGMENTS = 12
/** Tube radius in world units. */
const TUBE_RADIUS = 0.07
/** Radial segments around the tube circumference. */
const TUBE_RADIAL = 5

/**
 * Build a CatmullRom curve from src → midpoint (with arc offset) → tgt.
 *
 * arc > 0  : bow upward in Y (used for torus wrap-arounds and general arcs)
 * arc < 0  : bow upward in Y but also offset perpendicular to the link direction
 *             in the horizontal plane — used by butterfly column links so they
 *             fan out in X instead of stacking in the same Z plane.
 *
 * perpOffset: additional perpendicular-to-link offset in the XZ plane.
 *             This fans out multiple links that share the same two endpoints
 *             or lie along the same axis (e.g. all row links in one butterfly row).
 */
function buildCurve(
  src: THREE.Vector3,
  tgt: THREE.Vector3,
  arc: number,
  perpOffset = 0,
): THREE.CatmullRomCurve3 {
  const mid = src.clone().lerp(tgt, 0.5)
  const length = src.distanceTo(tgt)

  if (Math.abs(arc) > 0.001 || Math.abs(perpOffset) > 0.001) {
    // Always lift by |arc| * length so the tube clears the node plane
    mid.y += length * Math.abs(arc)

    // Compute a horizontal vector perpendicular to the link direction
    const dir = tgt.clone().sub(src).normalize()
    // Perpendicular in XZ plane: rotate 90° around Y
    const perp = new THREE.Vector3(-dir.z, 0, dir.x)
    mid.addScaledVector(perp, perpOffset)
  }

  return new THREE.CatmullRomCurve3([src.clone(), mid, tgt.clone()])
}

export class NetworkLink {
  readonly source: NetworkNode
  readonly target: NetworkNode
  readonly bandwidth: number
  status: LinkStatus

  private arc: number
  private perpOffset: number
  private overrideColor: number | undefined
  private tube: THREE.Mesh
  private _scene: THREE.Scene | null = null

  constructor(config: LinkConfig) {
    this.source = config.source
    this.target = config.target
    this.bandwidth = config.bandwidth ?? 100
    this.status = config.status ?? 'active'
    this.arc = config.arc ?? 0
    this.perpOffset = config.perpOffset ?? 0
    this.overrideColor = config.color

    this.tube = this.buildTube()
  }

  private buildTube(): THREE.Mesh {
    const src = this.source.position.clone()
    const tgt = this.target.position.clone()
    const curve = buildCurve(src, tgt, this.arc, this.perpOffset)

    const geometry = new THREE.TubeGeometry(curve, CURVE_SEGMENTS, TUBE_RADIUS, TUBE_RADIAL, false)
    const material = new THREE.MeshPhongMaterial({
      color: this.overrideColor ?? STATUS_COLORS[this.status],
      emissive: this.overrideColor
        ? new THREE.Color(this.overrideColor).multiplyScalar(0.15)
        : new THREE.Color(STATUS_COLORS[this.status]).multiplyScalar(0.12),
      shininess: 60,
      transparent: true,
      opacity: 0.88,
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.castShadow = false
    return mesh
  }

  /**
   * Rebuild the tube geometry to follow updated node positions.
   * Call this every frame (or whenever nodes move).
   */
  update(): void {
    const src = this.source.position.clone()
    const tgt = this.target.position.clone()
    const curve = buildCurve(src, tgt, this.arc, this.perpOffset)

    this.tube.geometry.dispose()
    this.tube.geometry = new THREE.TubeGeometry(curve, CURVE_SEGMENTS, TUBE_RADIUS, TUBE_RADIAL, false)
  }

  setStatus(status: LinkStatus): void {
    this.status = status
    if (!this.overrideColor) {
      const mat = this.tube.material as THREE.MeshPhongMaterial
      mat.color.setHex(STATUS_COLORS[status])
      mat.emissive.setHex(STATUS_COLORS[status]).multiplyScalar(0.12)
    }
  }

  addToScene(scene: THREE.Scene): void {
    this._scene = scene
    scene.add(this.tube)
  }

  removeFromScene(): void {
    if (this._scene) {
      this._scene.remove(this.tube)
      this._scene = null
    }
    this.tube.geometry.dispose()
    ;(this.tube.material as THREE.Material).dispose()
  }
}
