/**
 * topologies.ts
 * Generator functions for each network topology from Tema 4.
 * Every generator receives a typed params object and returns { nodes, links }.
 */

import { NodeConfig } from './NetworkNode'

export interface LinkDef {
  sourceId: string
  targetId: string
  /**
   * Arc height as a fraction of the link length. Lifts the tube midpoint upward.
   */
  arc?: number
  /**
   * Perpendicular offset of the arc midpoint in the XZ plane (world units).
   * Fans multiple links that share the same axis so they are individually visible.
   */
  perpOffset?: number
  /** Optional override hex color for this specific link. */
  color?: number
}

export interface TopologyData {
  nodes: NodeConfig[]
  links: LinkDef[]
}

// Spacing between nodes in world units
const S = 2.8

// ─── Param types ─────────────────────────────────────────────────────────────

export interface MeshParams {
  /** Number of dimensions (n). Visualised in 3D for n≤3, projected for n>3. */
  n: number
  /** Switches per dimension: k-tuple <k0, k1, ..., k_{n-1}> */
  k: number[]
  /** Endpoint nodes attached to each switch */
  m: number
}

export interface TorusParams {
  n: number
  k: number[]
  m: number
}

export interface WKParams {
  /** Size of the base clique */
  k: number
  /** Recursion level */
  level: number
}

export interface FatTreeParams {
  /** Switch degree / branching factor */
  k: number
  /** Number of stages (levels) */
  n: number
}

export interface FlatButterflyParams {
  /** Number of rows */
  p: number
  /** Number of columns */
  q: number
}

export interface BusParams {
  /** Total endpoint nodes on the bus */
  nodeCount: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Clamp a value to [min, max] */
function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

/**
 * Encode an n-dimensional coordinate array to a flat node id string.
 * e.g. [2,1,3] → "sw_2_1_3"
 */
function coordId(coords: number[]): string {
  return 'sw_' + coords.join('_')
}

/**
 * Enumerate all coordinates in an n-dimensional grid with sizes given by dims[].
 * Returns an array of coordinate tuples.
 */
function allCoords(dims: number[]): number[][] {
  let result: number[][] = [[]]
  for (const size of dims) {
    const next: number[][] = []
    for (const prefix of result) {
      for (let i = 0; i < size; i++) {
        next.push([...prefix, i])
      }
    }
    result = next
  }
  return result
}

/**
 * Project an n-dimensional coordinate into a 3D position.
 * Dimensions 0..2 map to x,z,y directly.
 * Higher dimensions are folded with offsets so the topology stays readable.
 */
function projectTo3D(coords: number[], k: number[]): { x: number; y: number; z: number } {
  const n = coords.length
  // Compute the centre of the grid in each dimension
  const offsets = k.map(ki => ((ki - 1) * S) / 2)

  let x = n > 0 ? coords[0] * S - offsets[0] : 0
  let z = n > 1 ? coords[1] * S - offsets[1] : 0
  let y = n > 2 ? coords[2] * S - offsets[2] : 0

  // Dimensions 3+ are visualised as additional offsets in x/z to avoid overlap
  if (n > 3) {
    for (let d = 3; d < n; d++) {
      // Spread diagonally in the XZ plane, scaled by the product of all previous k[] sizes
      const spread = k.slice(0, d).reduce((a, b) => a * b, 1) * S * 0.2
      x += coords[d] * spread
      z += coords[d] * spread
      // Lift higher dimensions in Y so they are visually distinct from the flat grid
      y += coords[d] * S * 2
    }
  }

  return { x, y, z }
}

// Colors per dimension for high-dimensional (≥ 3) links, so they are
// visually distinct from the standard cyan links in dims 0–2.
// Dim 0 (X), 1 (Z), 2 (Y) use the default active color.
const DIM_COLORS: Record<number, number> = {
  3: 0xff7043,  // deep orange
  4: 0xab47bc,  // violet
}

// Arc height fraction applied to each higher dimension.
// Increases with dimension index so links in different dims don't overlap.
function dimArc(d: number): number {
  return (d - 2) * 0.28  // d=3 → 0.28, d=4 → 0.56, …
}

// ─── MESH ─────────────────────────────────────────────────────────────────────

/**
 * k-ary n-mesh
 * Supports any number of dimensions n with per-dimension switch counts k[].
 * Links in dimensions ≥ 3 are arced upward and color-coded so they are
 * visually distinct from the flat grid links of dimensions 0–2.
 * Endpoint nodes (m per switch) are shown as 'client' spheres offset in Y.
 */
export function generateMesh(params: MeshParams): TopologyData {
  const { n, k, m } = params
  const dims = Array.from({ length: n }, (_, i) => clamp(k[i] ?? k[k.length - 1] ?? 2, 1, 16))

  const nodes: NodeConfig[] = []
  const links: LinkDef[] = []

  const coords = allCoords(dims)

  for (const coord of coords) {
    const id = coordId(coord)
    const pos = projectTo3D(coord, dims)
    nodes.push({ id, label: `SW(${coord.join(',')})`, type: 'switch', position: pos })

    // Links to the next neighbour in each dimension
    for (let d = 0; d < n; d++) {
      if (coord[d] + 1 < dims[d]) {
        const neighbour = [...coord]
        neighbour[d]++
        const isHighDim = d >= 3
        links.push({
          sourceId: id,
          targetId: coordId(neighbour),
          arc:   isHighDim ? dimArc(d) : undefined,
          color: isHighDim ? DIM_COLORS[d] ?? DIM_COLORS[3] : undefined,
        })
      }
    }

    // Endpoint nodes
    for (let ep = 0; ep < m; ep++) {
      const epId = `${id}_ep${ep}`
      const angle = (2 * Math.PI * ep) / Math.max(m, 1)
      nodes.push({
        id: epId,
        label: `EP`,
        type: 'client',
        position: {
          x: pos.x + Math.cos(angle) * S * 0.55,
          y: pos.y - S * 0.9,
          z: pos.z + Math.sin(angle) * S * 0.55,
        },
      })
      links.push({ sourceId: id, targetId: epId })
    }
  }

  return { nodes, links }
}

// ─── TORUS ────────────────────────────────────────────────────────────────────

// Colors for wrap-around links per dimension (distinct from mesh cyan)
const TORUS_WRAP_COLORS = [0xff7043, 0xab47bc, 0x26a69a, 0xffa726]

/**
 * k-ary n-cube (torus)
 * Same as mesh but adds wrap-around links in every dimension.
 * Wrap-around links are arced upward and colored per dimension so they are
 * clearly distinguishable from the regular mesh links.
 */
export function generateTorus(params: TorusParams): TopologyData {
  const { n, k, m } = params
  const dims = Array.from({ length: n }, (_, i) => clamp(k[i] ?? k[k.length - 1] ?? 2, 2, 12))

  // Reuse mesh generator (with m=0 to avoid duplicate endpoints), then add wraps
  const { nodes, links } = generateMesh({ n, k: dims, m: 0 })

  const coords = allCoords(dims)
  for (const coord of coords) {
    for (let d = 0; d < n; d++) {
      // Only add wrap-around when k[d] > 2 (k=2 wrap is same as regular link)
      if (dims[d] > 2 && coord[d] === dims[d] - 1) {
        const wrapped = [...coord]
        wrapped[d] = 0
        links.push({
          sourceId: coordId(coord),
          targetId: coordId(wrapped),
          // Arc scales with grid size so it clears the node plane comfortably
          arc: 0.35 + dims[d] * 0.06,
          color: TORUS_WRAP_COLORS[d % TORUS_WRAP_COLORS.length],
        })
      }
    }
  }

  // Endpoint nodes
  if (m > 0) {
    const epData = generateMesh({ n, k: dims, m })
    for (const node of epData.nodes) {
      if (node.id.includes('_ep')) nodes.push(node)
    }
    for (const link of epData.links) {
      if (link.targetId.includes('_ep')) links.push(link)
    }
  }

  return { nodes, links }
}

// ─── WK-RECURSIVE ────────────────────────────────────────────────────────────
 
const cliqueRadiusFactor = (k: number) => (k <= 3 ? 0.5 : 0.6)
const groupRadiusFactor = (k: number) => (k <= 3 ? 2.0 : k <= 5 ? 3.7 : 5.2)
const LEVEL_SHRINK = 2.5 // how much smaller each nested ring of groups is vs. its parent
 
interface WKBuildResult {
  nodes: NodeConfig[]
  links: LinkDef[]
  /** freePorts[i] = id of the node currently acting as free port "i" for this (sub)network */
  freePorts: string[]
}

/**
 * Recursively builds a WK(k, level) network rooted at `idPrefix`, placing it around `center`.
 * `groupRingRadius` is only used when level > 1, to place the k sub-groups around `center`.
 */
function buildWKRecursive(
  k: number,
  level: number,
  idPrefix: string,
  center: { x: number; z: number },
  groupRingRadius: number,
): WKBuildResult {
  const nodes: NodeConfig[] = []
  const links: LinkDef[] = []
 
  if (level === 1) {
    const ringRadius = S * cliqueRadiusFactor(k)
    const ids: string[] = []
 
    for (let i = 0; i < k; i++) {
      const angle = (2 * Math.PI * i) / k
      const id = `${idPrefix}n${i}`
      ids.push(id)
      nodes.push({
        id,
        label: `N${i}`,
        type: 'router',
        position: {
          x: center.x + Math.cos(angle) * ringRadius,
          y: 0,
          z: center.z + Math.sin(angle) * ringRadius,
        },
      })
    }
 
    // Full clique: each node gets k-1 internal links + keeps its own index as free port => degree k
    for (let i = 0; i < k; i++) {
      for (let j = i + 1; j < k; j++) {
        links.push({ sourceId: ids[i], targetId: ids[j] })
      }
    }
 
    return { nodes, links, freePorts: ids } // freePorts[i] === ids[i]
  }
 
  // level > 1: build k copies of WK(k, level-1) and wire them per the triangle/paired rule
  const subFreePorts: string[][] = []
  const nextGroupRingRadius = groupRingRadius / LEVEL_SHRINK
 
  for (let g = 0; g < k; g++) {
    const groupAngle = (2 * Math.PI * g) / k
    const subCenter = {
      x: center.x + Math.cos(groupAngle) * groupRingRadius,
      z: center.z + Math.sin(groupAngle) * groupRingRadius,
    }
    const sub = buildWKRecursive(k, level - 1, `${idPrefix}${g}_`, subCenter, nextGroupRingRadius)
    nodes.push(...sub.nodes)
    links.push(...sub.links)
    subFreePorts.push(sub.freePorts)
  }
 
  // Connect port j of group i <-> port i of group j, for every i < j (Nd-1 links per group)
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      links.push({ sourceId: subFreePorts[i][j], targetId: subFreePorts[j][i] })
    }
  }
 
  // Each group's own-index port is the one left unused -> becomes this level's free port for that group
  const freePorts = subFreePorts.map((ports, g) => ports[g])
 
  return { nodes, links, freePorts }
}
 
export function generateWKRecursive(params: WKParams): TopologyData {
  const k = clamp(params.k, 2, 8)
  const level = clamp(params.level, 1, 3)
 
  const topGroupRingRadius = S * groupRadiusFactor(k) * Math.pow(LEVEL_SHRINK, level - 2)
 
  const { nodes, links } = buildWKRecursive(k, level, '', { x: 0, z: 0 }, topGroupRingRadius)
 
  return { nodes, links }
}

// ─── FAT TREE ─────────────────────────────────────────────────────────────────

export function generateFatTree(params: FatTreeParams): TopologyData {
  const k = clamp(params.k, 2, 5)
  const n = clamp(params.n, 2, 5)

  const nodes: NodeConfig[] = []
  const links: LinkDef[] = []

  const leafCount = Math.pow(k, n - 1)
  const xSpreadLeaf = (leafCount - 1) * S

  // Build switches per level (0 = root, n-1 = leaves)
  for (let lvl = 0; lvl < n; lvl++) {
    const count = Math.pow(k, lvl)
    const spacing = count > 1 ? xSpreadLeaf / (count - 1) : 0
    const xStart = count > 1 ? -xSpreadLeaf / 2 : 0
    const y = (n - 1 - lvl) * S * 1.8

    for (let i = 0; i < count; i++) {
      nodes.push({
        id: `sw_l${lvl}_${i}`,
        label: `L${lvl}S${i}`,
        type: lvl === 0 ? 'router' : 'switch',
        position: { x: xStart + i * spacing, y, z: 0 },
      })
    }
  }

  // Endpoint nodes below leaf switches
  const epCount = leafCount * k
  const epSpacing = epCount > 1 ? xSpreadLeaf / (epCount - 1) : 0
  for (let i = 0; i < epCount; i++) {
    nodes.push({
      id: `ep_${i}`,
      label: `EP${i}`,
      type: 'server',
      position: { x: -xSpreadLeaf / 2 + i * epSpacing, y: -(S * 1.8), z: 0 },
    })
  }

  // Switch → child switch links
  for (let lvl = 0; lvl < n - 1; lvl++) {
    const parentCount = Math.pow(k, lvl)
    for (let p = 0; p < parentCount; p++) {
      for (let c = 0; c < k; c++) {
        links.push({ sourceId: `sw_l${lvl}_${p}`, targetId: `sw_l${lvl + 1}_${p * k + c}` })
      }
    }
  }

  // Leaf switch → endpoint links
  for (let sw = 0; sw < leafCount; sw++) {
    for (let c = 0; c < k; c++) {
      links.push({ sourceId: `sw_l${n - 1}_${sw}`, targetId: `ep_${sw * k + c}` })
    }
  }

  return { nodes, links }
}

// ─── FLATTENED BUTTERFLY ─────────────────────────────────────────────────────

// Row links (horizontal connections): warm amber
const BUTTERFLY_ROW_COLOR = 0xffa726
// Column links (vertical connections): violet
const BUTTERFLY_COL_COLOR = 0xce93d8

export function generateFlattenedButterfly(params: FlatButterflyParams): TopologyData {
  const p = clamp(params.p, 2, 8)
  const q = clamp(params.q, 2, 8)

  const nodes: NodeConfig[] = []
  const links: LinkDef[] = []

  const xOffset = ((q - 1) * S * 1.5) / 2
  const zOffset = ((p - 1) * S * 1.5) / 2

  for (let row = 0; row < p; row++) {
    for (let col = 0; col < q; col++) {
      nodes.push({
        id: `sw_${row}_${col}`,
        label: `SW(${row},${col})`,
        type: 'switch',
        position: { x: col * S * 1.5 - xOffset, y: 0, z: row * S * 1.5 - zOffset },
      })
    }
  }

  // All-to-all within each row (switches share the same Z coordinate).
  // Arc all links upward so they clear the node plane.
  // Fan them with a perpOffset in Z (perpendicular to the row direction X)
  // so each pair of columns gets a distinct lateral position.
  // Offset sign alternates per row so adjacent rows fan in opposite directions,
  // further reducing visual overlap when viewed from above.
  for (let row = 0; row < p; row++) {
    const rowSign = row % 2 === 0 ? 1 : -1
    // Collect all (c1,c2) pairs sorted by distance so we can assign offsets
    const pairs: Array<{ c1: number; c2: number; dist: number }> = []
    for (let c1 = 0; c1 < q; c1++) {
      for (let c2 = c1 + 1; c2 < q; c2++) {
        pairs.push({ c1, c2, dist: c2 - c1 })
      }
    }
    // Assign a unique perpOffset slot per distinct (c1,c2) pair.
    // Slot index = c1 * q + c2 for uniqueness; map to a spread around 0.
    const totalPairs = pairs.length
    pairs.forEach((pair, idx) => {
      // Normalise idx to range [-0.5, 0.5] then scale
      const spread = S * 0.55
      const offset = totalPairs > 1
        ? rowSign * (idx / (totalPairs - 1) - 0.5) * spread
        : 0
      links.push({
        sourceId: `sw_${row}_${pair.c1}`,
        targetId: `sw_${row}_${pair.c2}`,
        arc: 0.20 + pair.dist * 0.10,
        perpOffset: offset,
        color: BUTTERFLY_ROW_COLOR,
      })
    })
  }

  // All-to-all within each column (switches share the same X coordinate).
  // Fan them with a perpOffset in X (perpendicular to the column direction Z).
  // Offset sign alternates per column.
  for (let col = 0; col < q; col++) {
    const colSign = col % 2 === 0 ? 1 : -1
    const pairs: Array<{ r1: number; r2: number; dist: number }> = []
    for (let r1 = 0; r1 < p; r1++) {
      for (let r2 = r1 + 1; r2 < p; r2++) {
        pairs.push({ r1, r2, dist: r2 - r1 })
      }
    }
    const totalPairs = pairs.length
    pairs.forEach((pair, idx) => {
      const spread = S * 0.55
      const offset = totalPairs > 1
        ? colSign * (idx / (totalPairs - 1) - 0.5) * spread
        : 0
      links.push({
        sourceId: `sw_${pair.r1}_${col}`,
        targetId: `sw_${pair.r2}_${col}`,
        arc: 0.20 + pair.dist * 0.10,
        perpOffset: offset,
        color: BUTTERFLY_COL_COLOR,
      })
    })
  }

  return { nodes, links }
}

// ─── BUS ─────────────────────────────────────────────────────────────────────

export function generateBus(params: BusParams): TopologyData {
  const nodeCount = clamp(params.nodeCount, 2, 24)
  const nodes: NodeConfig[] = []
  const links: LinkDef[] = []

  nodes.push({ id: 'bus', label: 'BUS', type: 'switch', position: { x: 0, y: 0, z: 0 } })

  const types: Array<NodeConfig['type']> = ['server', 'client', 'router']
  for (let i = 0; i < nodeCount; i++) {
    const angle = (2 * Math.PI * i) / nodeCount
    const id = `node_${i}`
    nodes.push({
      id,
      label: `Node${i}`,
      type: types[i % types.length],
      position: { x: Math.cos(angle) * S * 2.4, y: 0, z: Math.sin(angle) * S * 2.4 },
    })
    links.push({ sourceId: 'bus', targetId: id })
  }

  return { nodes, links }
}
