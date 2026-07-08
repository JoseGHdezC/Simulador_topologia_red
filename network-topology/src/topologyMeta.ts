/**
 * topologyMeta.ts
 * Metadata, parameter definitions, and dynamic feature computation for each topology.
 */

import {
  generateMesh,   MeshParams,
  generateTorus,  TorusParams,
  generateWKRecursive, WKParams,
  generateFatTree, FatTreeParams,
  generateFlattenedButterfly, FlatButterflyParams,
  generateBus,    BusParams,
  TopologyData,
} from './topologies'

// ─── Public types ─────────────────────────────────────────────────────────────

export type TopologyId =
  | 'mesh'
  | 'torus'
  | 'wk-recursive'
  | 'fat-tree'
  | 'flattened-butterfly'
  | 'bus'

export interface TopologyFeature {
  label: string
  value: string
}

// A single editable parameter field
export type ParamFieldType = 'int' | 'int-tuple'

export interface ParamField {
  key: string            // matches the key in the params object
  label: string          // human-readable label shown in the form
  type: ParamFieldType
  min?: number
  max?: number
  /** For int-tuple: driven by another param key that gives the length */
  lengthKey?: string
  hint?: string          // shown as placeholder / tooltip
}

export type AnyParams =
  | MeshParams
  | TorusParams
  | WKParams
  | FatTreeParams
  | FlatButterflyParams
  | BusParams

export interface TopologyMeta {
  id: TopologyId
  name: string
  subtitle: string
  description: string
  paramFields: ParamField[]
  defaultParams: AnyParams
  computeFeatures: (params: AnyParams) => TopologyFeature[]
  generate: (params: AnyParams) => TopologyData
}

// ─── Mesh ─────────────────────────────────────────────────────────────────────

function meshFeatures(p: MeshParams): TopologyFeature[] {
  const { n, k, m } = p // n dimensions, k switches per dimension, m endpoints per switch
  const dims = Array.from({ length: n }, (_, i) => k[i] ?? k[k.length - 1] ?? 2)
  const totalSwitches = dims.reduce((a, b) => a * b, 1)
  const totalEndpoints = totalSwitches * m
  const maxHop = dims.reduce((sum, ki) => sum + (ki - 1), 0)
  const minDegree = n * 2   // interior node has 2 links per dimension
  const maxDegree = n * 2
  const isHypercube = n >= 2 && dims.every(ki => ki === 2)
  const symmetric = isHypercube ? 'Sí (hipercubo)' : 'No'
  const homogeneous = dims.every(ki => ki === dims[0]) ? 'Parcialmente' : 'No'
  const bisectionBW = `${Math.min(...dims)} × ancho de enlace`

  return [
    { label: 'Tipo',               value: 'Directa, regular, ortogonal' },
    { label: 'Dimensiones (n)',    value: `${n}` },
    { label: 'Switches por dim.',  value: dims.join(' × ') },
    { label: 'Nº total switches',  value: `${totalSwitches}` },
    { label: 'Nº total nodos EP',  value: m > 0 ? `${totalEndpoints}` : '—' },
    { label: 'Grado de switch',    value: `${minDegree}–${maxDegree} + ${m} EP` },
    { label: 'Hop count máx.',     value: `${maxHop}` },
    { label: 'Bisection BW',       value: bisectionBW },
    { label: 'Simetría',           value: symmetric },
    { label: 'Homogeneidad',       value: homogeneous },
    { label: 'Conectividad',       value: `${n} (nodos de borde: 1 por dim.)` },
    { label: 'Tolerancia a fallos', value: n > 2 ? 'Media' : 'Baja en bordes' },
    { label: 'Routing típico',     value: 'DOR (XY… routing)' },
    { label: 'Uso típico',         value: 'Chips multiprocesador, NoC' },
  ]
}

// ─── Torus ────────────────────────────────────────────────────────────────────

function torusFeatures(p: TorusParams): TopologyFeature[] {
  const { n, k, m } = p // n dimensions, k switches per dimension, m endpoints per switch
  const dims = Array.from({ length: n }, (_, i) => Math.max(2, k[i] ?? k[k.length - 1] ?? 2))
  const totalSwitches = dims.reduce((a, b) => a * b, 1)
  const totalEndpoints = totalSwitches * m
  const maxHop = dims.reduce((sum, ki) => sum + Math.floor(ki / 2), 0)
  const degree = n * 2  // always 2 neighbours per dimension (wrap-around)
  const totalLinks = dims.reduce((sum, ki, d) => {
    const others = dims.reduce((a, b) => a * b, 1) / dims[d]
    return sum + ki * others
  }, 0)

  return [
    { label: 'Tipo',               value: 'Directa, regular, ortogonal' },
    { label: 'Dimensiones (n)',    value: `${n}` },
    { label: 'Switches por dim.',  value: dims.join(' × ') },
    { label: 'Nº total switches',  value: `${totalSwitches}` },
    { label: 'Nº total nodos EP',  value: m > 0 ? `${totalEndpoints}` : '—' },
    { label: 'Grado de switch',    value: `${degree} + ${m} EP` },
    { label: 'Hop count máx.',     value: `${maxHop}` },
    { label: 'Total enlaces',      value: `${totalLinks} (bidireccionales)` },
    { label: 'Bisection BW',       value: `${2 * Math.min(...dims)} × ancho de enlace` },
    { label: 'Simetría',           value: 'Sí' },
    { label: 'Homogeneidad',       value: 'Sí' },
    { label: 'Conectividad',       value: `${degree}` },
    { label: 'Tolerancia a fallos', value: 'Alta' },
    { label: 'Routing típico',     value: 'DOR, XY-YX con canales virtuales' },
    { label: 'Uso típico',         value: 'Supercomputadores, HPC' },
  ]
}

// ─── WK-Recursive ────────────────────────────────────────────────────────────

function wkFeatures(p: WKParams): TopologyFeature[] {
  const k = Math.max(2, p.k) // Clique size (number of nodes in the base clique)
  const l = Math.max(1, p.level) // Number of recursive levels
  const totalNodes = Math.pow(k, l)

  // Recursive total link count: T(k,1) = k*(k-1)/2; T(k,l) = k*T(k,l-1) + k*(k-1)/2
  function totalLinks(kk: number, ll: number): number {
    if (ll === 1) return kk * (kk - 1) / 2
    return kk * totalLinks(kk, ll - 1) + kk * (kk - 1) / 2
  }
  const links = totalLinks(k, l)

  // Top-level groups visible in the layout = k (always, at every level)
  const topGroups = k

  // Each node's degree = (k-1) intra-clique links + (l-1)*(k-1) inter-group links = (k-1)*l
  // (Verified: WK(4,2) each node degree = 3*2 = 6; check: 16 nodes * 6 / 2 = 48 half-edges... 
  //  but we have 30 links = 60 half-edges / 2 = 30. So avg degree = 60/16 = 3.75. Not uniform.)
  // Actually degree varies: free-port node has degree (k-1) intra + (k-1) inter = 2*(k-1)
  // Non-free-port node has degree (k-1) intra + 0 inter at level 1 inside group, but at higher
  // levels they get additional links. Let's just report intra+inter per level-1 node.
  const minDegree = k - 1           // non-free-port node at level 1
  const maxDegree = (k - 1) * l     // free-port node at top level gets links at every level

  // Max hop count: within a group = 1 hop (direct clique), crossing l levels = 2*l hops worst case
  const maxHop = l === 1 ? 1 : 2 * l

  return [
    { label: 'Tipo',               value: 'Directa, regular, no ortogonal' },
    { label: 'Parámetro k',        value: `${k} (tamaño del clique base)` },
    { label: 'Nivel l',            value: `${l}` },
    { label: 'Nº total nodos',     value: `${totalNodes}` },
    { label: 'Nº de grupos (top)', value: `${topGroups}` },
    { label: 'Grado de nodo',      value: `${minDegree}–${maxDegree} (mín–máx)` },
    { label: 'Hop count máx.',     value: `${maxHop}` },
    { label: 'Total enlaces',      value: `${links}` },
    { label: 'Bisection BW',       value: `${k * (k - 1) / 2} enlaces inter-grupo (top)` },
    { label: 'Simetría',           value: 'Sí (dentro del nivel)' },
    { label: 'Homogeneidad',       value: 'No (grado varía por nivel)' },
    { label: 'Conectividad',       value: `${k - 1}` },
    { label: 'Tolerancia a fallos', value: 'Alta' },
    { label: 'Routing típico',     value: 'Recursivo / jerárquico' },
    { label: 'Uso típico',         value: 'NoC, diseños escalables embebidos' },
  ]
}

// ─── Fat Tree ─────────────────────────────────────────────────────────────────

function fatTreeFeatures(p: FatTreeParams): TopologyFeature[] {
  const k = Math.max(2, p.k) // Number of ports per switch
  const n = Math.max(2, p.n) // Number of stages (levels) in the tree
  const leafSwitches = Math.pow(k, n - 1)
  // Total internal switches = k^0 + k^1 + ... + k^(n-1)
  const totalSwitches = Array.from({ length: n }, (_, i) => Math.pow(k, i)).reduce((a, b) => a + b, 0)
  const endpoints = leafSwitches * k
  const maxHop = 2 * (n - 1)

  return [
    { label: 'Tipo',               value: 'Indirecta, regular, multietapa' },
    { label: 'Grado k',            value: `${k}` },
    { label: 'Etapas n',           value: `${n}` },
    { label: 'Nº de switches',     value: `${totalSwitches}` },
    { label: 'Switches hoja',      value: `${leafSwitches}` },
    { label: 'Nodos finales (EP)', value: `${endpoints}` },
    { label: 'Hop count máx.',     value: `${maxHop}` },
    { label: 'Bisection BW',       value: `Crece con k cerca de la raíz` },
    { label: 'Simetría',           value: 'Sí' },
    { label: 'Homogeneidad',       value: 'No (grado varía por etapa)' },
    { label: 'Conectividad',       value: 'Alta (múltiples caminos raíz)' },
    { label: 'Tolerancia a fallos', value: 'Alta' },
    { label: 'Routing típico',     value: 'Up-Down (up*/down*)' },
    { label: 'Uso típico',         value: 'Centros de datos, HPC (ej. InfiniBand)' },
  ]
}

// ─── Flattened Butterfly ─────────────────────────────────────────────────────

function flatButterflyFeatures(p: FlatButterflyParams): TopologyFeature[] {
  const pr = Math.max(2, p.p) // Rows
  const q  = Math.max(2, p.q) // Columns
  const totalSwitches = pr * q
  const degree = (q - 1) + (pr - 1)
  const rowLinks = pr * (q * (q - 1)) / 2
  const colLinks = q  * (pr * (pr - 1)) / 2

  // Bisection bandwidth: minimum number of links cut when splitting into two equal halves.
  // Best cut is either by rows or by columns, whichever severs fewer links.
  //   Row cut (split top ⌊p/2⌋ vs bottom ⌈p/2⌉): each of q columns contributes ⌊p/2⌋×⌈p/2⌉ cross-links.
  //   Col cut (split left ⌊q/2⌋ vs right ⌈q/2⌉): each of p rows contributes ⌊q/2⌋×⌈q/2⌉ cross-links.
  const rowCut = q  * Math.floor(pr / 2) * Math.ceil(pr / 2)
  const colCut = pr * Math.floor(q  / 2) * Math.ceil(q  / 2)
  const bisectionLinks = Math.min(rowCut, colCut)
  const bisectionCutDir = rowCut <= colCut ? 'corte horizontal' : 'corte vertical'

  return [
    { label: 'Tipo',               value: 'Directa, regular, ortogonal' },
    { label: 'Filas (p)',          value: `${pr}` },
    { label: 'Columnas (q)',       value: `${q}` },
    { label: 'Nº de switches',     value: `${totalSwitches}` },
    { label: 'Grado de switch',    value: `${degree} (${q - 1} fila + ${pr - 1} col.)` },
    { label: 'Hop count máx.',     value: '2' },
    { label: 'Total enlaces',      value: `${rowLinks + colLinks}` },
    { label: 'Bisection BW',       value: `${bisectionLinks} enlaces (${bisectionCutDir})` },
    { label: 'BW corte filas',     value: `${rowCut} (${q}×⌊${pr}/2⌋×⌈${pr}/2⌉)` },
    { label: 'BW corte columnas',  value: `${colCut} (${pr}×⌊${q}/2⌋×⌈${q}/2⌉)` },
    { label: 'Simetría',           value: 'Sí' },
    { label: 'Homogeneidad',       value: 'Sí' },
    { label: 'Conectividad',       value: `${degree}` },
    { label: 'Tolerancia a fallos', value: 'Alta' },
    { label: 'Routing típico',     value: 'Dimension Order, adaptativo' },
    { label: 'Uso típico',         value: 'Datacenters, HPC de alta densidad' },
  ]
}

// ─── Bus ─────────────────────────────────────────────────────────────────────

function busFeatures(p: BusParams): TopologyFeature[] {
  const n = Math.max(2, p.nodeCount) // Number of nodes connected to the bus
  return [
    { label: 'Tipo',               value: 'Medio compartido' },
    { label: 'Nº de nodos',        value: `${n}` },
    { label: 'Total enlaces',      value: `${n}` },
    { label: 'Grado de nodo',      value: '1 (conexión directa al bus)' },
    { label: 'Hop count máx.',     value: '2 (src → bus → dst)' },
    { label: 'Bisection BW',       value: 'BW del bus ÷ 2' },
    { label: 'Simetría',           value: 'Sí' },
    { label: 'Homogeneidad',       value: 'Sí' },
    { label: 'Conectividad',       value: '1 (único punto de fallo)' },
    { label: 'Tolerancia a fallos', value: 'Muy baja (SPOF: bus)' },
    { label: 'Modo operación',     value: 'Half-dúplex o Full-dúplex' },
    { label: 'Routing típico',     value: 'Broadcast (filtra por destino)' },
    { label: 'Uso típico',         value: 'Ethernet clásica, buses internos de sistema' },
  ]
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const TOPOLOGIES: TopologyMeta[] = [
  {
    id: 'mesh',
    name: 'Malla (Mesh)',
    subtitle: 'k-ary n-mesh — Topología directa ortogonal',
    description:
      'Red en malla definida como k-ary n-mesh: k^n switches distribuidos en n dimensiones. ' +
      'Cada switch se conecta con sus vecinos ortogonales. La malla 2D (n=2) es el caso más común. ' +
      'Los hipercubos (2-ary n-mesh) son el único subconjunto simétrico y homogéneo. ' +
      'En general las k-ary n-mesh no son simétricas ni homogéneas.',
    paramFields: [
      { key: 'n', label: 'Dimensiones (n)', type: 'int', min: 1, max: 4, hint: '1–4' },
      { key: 'k', label: 'Switches por dimensión', type: 'int-tuple', lengthKey: 'n', min: 1, max: 8, hint: 'ej. 4,4' },
      { key: 'm', label: 'Nodos EP por switch (m)', type: 'int', min: 0, max: 4, hint: '0–4' },
    ],
    defaultParams: { n: 2, k: [4, 4], m: 0 } as MeshParams,
    computeFeatures: (p) => meshFeatures(p as MeshParams),
    generate: (p) => generateMesh(p as MeshParams),
  },
  {
    id: 'torus',
    name: 'Toroide (Torus)',
    subtitle: 'k-ary n-cube — Malla con enlaces circulares',
    description:
      'Un toroide se construye añadiendo enlaces wrap-around a la malla equivalente, reduciendo el hop count ' +
      'y aumentando el bisection bandwidth y la conectividad. El toroide doblado (folded torus) acorta los ' +
      'enlaces envolventes a costa de alargar ligeramente el resto.',
    paramFields: [
      { key: 'n', label: 'Dimensiones (n)', type: 'int', min: 1, max: 4, hint: '1–4' },
      { key: 'k', label: 'Switches por dimensión', type: 'int-tuple', lengthKey: 'n', min: 2, max: 8, hint: 'ej. 4,4' },
      { key: 'm', label: 'Nodos EP por switch (m)', type: 'int', min: 0, max: 4, hint: '0–4' },
    ],
    defaultParams: { n: 2, k: [4, 4], m: 0 } as TorusParams,
    computeFeatures: (p) => torusFeatures(p as TorusParams),
    generate: (p) => generateTorus(p as TorusParams),
  },
  {
    id: 'wk-recursive',
    name: 'WK-Recursiva',
    subtitle: 'Topología directa regular no ortogonal',
    description:
      'Topología construida replicando recursivamente un nodo virtual (clique de k nodos). ' +
      'Un nodo virtual de nivel l se construye usando k nodos virtuales de nivel l−1. ' +
      'Los enlaces libres (uno por nodo en cada clique) interconectan los grupos en cada nivel. ' +
      'El grado de los nodos varía según su posición: los nodos de puerto libre acumulan un enlace ' +
      'inter-grupo por cada nivel superior, mientras que los nodos internos mantienen solo sus enlaces intra-clique.',
    paramFields: [
      { key: 'k', label: 'Tamaño del clique (k)', type: 'int', min: 2, max: 8, hint: '2–8' },
      { key: 'level', label: 'Nivel de expansión (l)', type: 'int', min: 1, max: 3, hint: '1–3' },
    ],
    defaultParams: { k: 4, level: 2 } as WKParams,
    computeFeatures: (p) => wkFeatures(p as WKParams),
    generate: (p) => generateWKRecursive(p as WKParams),
  },
  {
    id: 'fat-tree',
    name: 'Fat Tree',
    subtitle: 'k-ary n-tree — Topología indirecta basada en árbol',
    description:
      'Topología regular e indirecta basada en árboles completos que crecen en ancho de banda hacia la raíz. ' +
      'Pertenece a la familia bMIN. Solo los switches de la etapa hoja se conectan con nodos finales.',
    paramFields: [
      { key: 'k', label: 'Grado / ramificación (k)', type: 'int', min: 2, max: 5, hint: '2–5' },
      { key: 'n', label: 'Número de etapas (n)',      type: 'int', min: 2, max: 5, hint: '2–5' },
    ],
    defaultParams: { k: 2, n: 4 } as FatTreeParams,
    computeFeatures: (p) => fatTreeFeatures(p as FatTreeParams),
    generate: (p) => generateFatTree(p as FatTreeParams),
  },
  {
    id: 'flattened-butterfly',
    name: 'Flattened Butterfly',
    subtitle: 'Evolución del butterfly con switches colapsados',
    description:
      'Los switches de cada columna del butterfly se colapsan en uno de mayor grado. ' +
      'Mismo bisection BW que el butterfly original, menor hop count, mayor grado de switch.',
    paramFields: [
      { key: 'p', label: 'Filas (p)', type: 'int', min: 2, max: 8, hint: '2–8' },
      { key: 'q', label: 'Columnas (q)', type: 'int', min: 2, max: 8, hint: '2–8' },
    ],
    defaultParams: { p: 4, q: 4 } as FlatButterflyParams,
    computeFeatures: (p) => flatButterflyFeatures(p as FlatButterflyParams),
    generate: (p) => generateFlattenedButterfly(p as FlatButterflyParams),
  },
  {
    id: 'bus',
    name: 'Bus (Medio Compartido)',
    subtitle: 'Red de medio compartido — La más simple',
    description:
      'Todos los dispositivos comparten el mismo medio. Solo uno puede transmitir a la vez. ' +
      'Menor coste de implementación pero el ancho de banda se degrada rápidamente con el número de nodos.',
    paramFields: [
      { key: 'nodeCount', label: 'Nº de nodos', type: 'int', min: 2, max: 24, hint: '2–24' },
    ],
    defaultParams: { nodeCount: 8 } as BusParams,
    computeFeatures: (p) => busFeatures(p as BusParams),
    generate: (p) => generateBus(p as BusParams),
  },
]

export function getTopology(id: TopologyId): TopologyMeta | undefined {
  return TOPOLOGIES.find(t => t.id === id)
}
