# Network Topology Visualizer

An interactive 3D network topology viewer built with **Three.js** and **TypeScript**, bundled by **Vite**.

---

## Features

- 6 selectable network topologies from academic material (Tema 4 — Redes de interconexión)
- **Editable parameters per topology** — change dimensions, switch counts, branching factor, etc. from the UI
- Features table updates live as you type; clicking **↺ Reconstruir** regenerates the 3D graph
- Left sidebar to switch between topologies instantly
- Right panel with description, parameter form, and computed feature table
- Mesh and Torus support **n-dimensional** layouts (n=1 chain, n=2 grid, n=3 cube, n=4 projected)
- **3D tube links** — links are rendered as real cylinders with shading, never overlap regardless of topology density
- **Arced wrap-around links** in Torus — circular links bow above the grid plane, colored per dimension (red / violet / teal)
- **Arced and color-coded links** in Flattened Butterfly — row links (amber, arc up) and column links (violet, arc forward) are visually independent; arc height scales with hop distance so non-adjacent pairs never occlude adjacent ones
- 3D scene with orbit controls (rotate, zoom, pan)
- Four node types with distinct geometries and colors: **Router** (octahedron), **Switch** (box), **Server** (cylinder), **Client** (sphere)
- Hover tooltip showing node id, type, and status
- Animated nodes (gentle float + router spin) and pulsing ambient light
- Legend panel and controls hint overlay

---

## Topologies

All topologies are defined in `src/topologies.ts` and described in `src/topologyMeta.ts`. Each one exposes editable parameters; the feature table recalculates automatically from the current values.

### Malla (Mesh) — k-ary n-mesh

A regular n-dimensional grid of switches, each connected to its orthogonal neighbours. Endpoint nodes (m per switch) are attached below each switch.

| Parameter | Description | Default | Range |
|-----------|-------------|---------|-------|
| `n` | Number of dimensions | 2 | 1–4 |
| `k` | Switches per dimension (n-tuple) | 4, 4 | 1–8 per entry |
| `m` | Endpoint nodes per switch | 0 | 0–4 |

| Property | Computed from params |
|----------|---------------------|
| Total switches | k₀ × k₁ × … × k_{n−1} |
| Max hop count | Σ(kᵢ − 1) |
| Switch degree | 2n (interior) + m EP ports |
| Bisection BW | min(kᵢ) × link bandwidth |
| Symmetric | Only if 2-ary n-mesh (hypercube) |

### Toroide (Torus) — k-ary n-cube

A mesh with wrap-around links in every dimension. Reduces hop count and increases bisection bandwidth and fault tolerance.

Wrap-around links are visually distinguished from regular links:
- They are arced above the node plane so they are never hidden behind the grid.
- Each dimension gets its own color: **red** (dim 0), **violet** (dim 1), **teal** (dim 2), **amber** (dim 3).

| Parameter | Description | Default | Range |
|-----------|-------------|---------|-------|
| `n` | Number of dimensions | 2 | 1–4 |
| `k` | Switches per dimension (n-tuple) | 4, 4 | 2–8 per entry |
| `m` | Endpoint nodes per switch | 0 | 0–4 |

| Property | Computed from params |
|----------|---------------------|
| Total switches | k₀ × k₁ × … × k_{n−1} |
| Max hop count | Σ⌊kᵢ/2⌋ |
| Switch degree | 2n (uniform) + m EP ports |
| Bisection BW | 2 × min(kᵢ) × link bandwidth |
| Symmetric / Homogeneous | Yes |

### WK-Recursiva

Built by recursively replicating a base clique. A level-l virtual node is composed of k level-(l−1) virtual nodes connected via their free ports. The free-port node in each clique accumulates one inter-group link per higher level, so node degree is not uniform.

| Parameter | Description | Default | Range |
|-----------|-------------|---------|-------|
| `k` | Size of base clique | 4 | 2–8 |
| `l` | Expansion level | 2 | 1–3 |

| Property | Computed from params |
|----------|---------------------|
| Total nodes | k^l |
| Total links | T(k,l) = k·T(k,l−1) + k(k−1)/2 |
| Node degree | (k−1) min — (k−1)·l max |
| Max hop count | 1 if l=1, else 2·l |
| Top-level groups | k |
| Bisection BW | k(k−1)/2 inter-group links |
| Homogeneous | No (degree varies by level) |
| Connectivity | k − 1 |

### Fat Tree — k-ary n-tree

Indirect topology based on a complete tree, growing wider (more bandwidth) near the root. Belongs to the bMIN family. Only leaf-level switches connect to endpoint nodes.

| Parameter | Description | Default | Range |
|-----------|-------------|---------|-------|
| `k` | Branching factor / switch degree | 2 | 2–5 |
| `n` | Number of stages | 4 | 2–5 |

| Property | Computed from params |
|----------|---------------------|
| Total switches | k⁰ + k¹ + … + k^(n−1) |
| Leaf switches | k^(n−1) |
| Endpoint nodes | k^(n−1) × k |
| Max hop count | 2(n − 1) |

### Flattened Butterfly

Switches in each butterfly column are collapsed into one higher-degree switch. Same bisection bandwidth as the original butterfly, lower hop count.

Links are color-coded and fanned to handle the dense all-to-all connectivity:
- **Row links** (horizontal, amber) arc upward (Y+) and are fanned with a perpendicular Z offset so each pair of columns gets its own lateral position. Arc height and fan offset scale with hop distance.
- **Column links** (vertical, violet) arc upward too but are fanned with a perpendicular X offset in the opposite direction, keeping row and column arcs visually independent.
- Adjacent rows alternate their fan direction to further reduce cross-row overlap.

| Parameter | Description | Default | Range |
|-----------|-------------|---------|-------|
| `p` | Number of rows | 4 | 2–8 |
| `q` | Number of columns | 4 | 2–8 |

| Property | Computed from params |
|----------|---------------------|
| Total switches | p × q |
| Switch degree | (q − 1) + (p − 1) |
| Max hop count | 2 |
| Total links | p×q(q−1)/2 + q×p(p−1)/2 |
| **Bisection BW** | **min(q×⌊p/2⌋×⌈p/2⌉, p×⌊q/2⌋×⌈q/2⌉) links** |
| Row cut | q × ⌊p/2⌋ × ⌈p/2⌉ (split top/bottom rows) |
| Column cut | p × ⌊q/2⌋ × ⌈q/2⌉ (split left/right columns) |

### Bus (Medio Compartido)

The simplest shared-medium network. All nodes share the same medium; only one can transmit at a time.

| Parameter | Description | Default | Range |
|-----------|-------------|---------|-------|
| `nodeCount` | Number of endpoint nodes | 8 | 2–24 |

| Property | Computed from params |
|----------|---------------------|
| Total links | nodeCount |
| Max hop count | 2 |
| Connectivity | 1 (single point of failure) |
| Fault tolerance | Very low |

---

## Prerequisites

| Tool | Minimum version |
|------|----------------|
| Node.js | 18.x or later |
| npm | 9.x or later (bundled with Node 18) |

> Verify with `node -v` and `npm -v`.

---

## Project Structure

```
network-topology/
├── index.html                   # HTML entry point
├── package.json                 # Dependencies and npm scripts
├── tsconfig.json                # TypeScript compiler options
├── vite.config.ts               # Vite bundler config
└── src/
    ├── main.ts                  # Scene, lighting, topology switching, animation loop
    ├── NetworkGraph.ts          # Graph manager — addNode / addLink / clear / update
    ├── NetworkNode.ts           # Node class — 4 types, 3 statuses, label sprites
    ├── NetworkLink.ts           # Edge class — tube geometry, arc support, per-link color override
    ├── Tooltip.ts               # Hover tooltip DOM element
    ├── TopologySelector.ts      # Left sidebar — one button per topology
    ├── TopologyInfo.ts          # Right panel — param form + live features table
    ├── topologies.ts            # Generator functions (accept typed param objects)
    ├── topologyMeta.ts          # Param definitions, computeFeatures(), generate()
    └── style.css                # Full dark-theme layout
```

---

## Setup & Running

### 1. Clone or download the project

```bash
git clone <repo-url>
cd network-topology
```

Or simply navigate to the directory if you already have the files:

```bash
cd network-topology
```

### 2. Install dependencies

```bash
npm install
```

> **Windows + WSL users:** if the project files live inside the WSL filesystem (`/home/...`),
> you **must** run all `npm` commands from a **WSL terminal** (e.g. Ubuntu), not from
> Windows PowerShell or CMD. Opening a WSL terminal and navigating to the project path with
> `cd /home/<user>/...` is the simplest way to avoid UNC path errors.

This installs:
- `three` — 3D rendering engine
- `vite` — fast dev server and bundler
- `typescript` — type-checker
- `@types/three` — Three.js type definitions

### 3. Start the development server

```bash
npm run dev
```

Vite will print a local URL (usually `http://localhost:5173`). Open it in any modern browser.

### 4. (Optional) Build for production

```bash
npm run build
```

The optimised output is written to `dist/`. Serve it with any static file host:

```bash
npm run preview   # preview the production build locally
```

---

## Controls

| Action | Input |
|--------|-------|
| Switch topology | Click a button in the left sidebar |
| Edit parameters | Change values in the Parámetros form (right panel) |
| Update features | Happens automatically as you type |
| Rebuild 3D graph | Click **↺ Reconstruir** or press Enter in the form |
| Rotate scene | Left-click + drag |
| Zoom | Mouse wheel |
| Pan | Right-click + drag |
| Node info | Hover over a node |

---

## Adding a New Topology

### 1. Define a params type and generator in `src/topologies.ts`

```ts
export interface MyParams {
  size: number
}

export function generateMyTopology(params: MyParams): TopologyData {
  const nodes: NodeConfig[] = [
    { id: 'a', label: 'A', type: 'router', position: { x: 0, y: 0, z: 0 } },
    { id: 'b', label: 'B', type: 'switch', position: { x: 3, y: 0, z: 0 } },
  ]
  const links: LinkDef[] = [{ sourceId: 'a', targetId: 'b' }]
  return { nodes, links }
}
```

### 2. Add a `TopologyMeta` entry in `src/topologyMeta.ts`

```ts
{
  id: 'my-topology',
  name: 'My Topology',
  subtitle: 'A custom topology',
  description: 'Description shown in the right panel.',
  paramFields: [
    { key: 'size', label: 'Size', type: 'int', min: 1, max: 16, hint: '1–16' },
  ],
  defaultParams: { size: 4 } as MyParams,
  computeFeatures: (p) => {
    const { size } = p as MyParams
    return [
      { label: 'Nodes', value: `${size}` },
    ]
  },
  generate: (p) => generateMyTopology(p as MyParams),
}
```

The sidebar and info panel pick it up automatically. The `computeFeatures` function is called live on every input change, so the table always reflects the current parameter values.

### Parameter field types

| `type` | Input rendered | Notes |
|--------|---------------|-------|
| `int` | `<input type="number">` | Clamped to `[min, max]` |
| `int-tuple` | `<input type="text">` (comma-separated) | Length driven by `lengthKey` param |

---

## Architecture Overview

```
main.ts
  ├─ creates THREE.Scene, Camera, WebGLRenderer
  ├─ adds lighting (AmbientLight, DirectionalLight, PointLight)
  ├─ instantiates NetworkGraph(scene)
  │     ├─ NetworkGraph       — Map<id, NetworkNode>, NetworkLink[]; supports clear()
  │     ├─ NetworkNode        — THREE.Mesh + label Sprite; setStatus()
  │     └─ NetworkLink        — TubeGeometry + MeshPhongMaterial; arc bows via
  │                             CatmullRom curve; color override per link;
  │                             update() rebuilds geometry each frame
  ├─ instantiates TopologySelector   — sidebar; fires onSelect(id)
  ├─ instantiates TopologyInfo(onRebuild)
  │     ├─ show(meta)         — deep-copies defaultParams, renders form + features
  │     ├─ param form (input) — calls computeFeatures() and refreshes table live
  │     └─ param form (submit)— fires onRebuild(currentParams) → buildGraph()
  ├─ buildGraph(id, params)   — clears graph, runs meta.generate(params), rebuilds;
  │                             forwards arc and color from LinkDef to addLink()
  ├─ instantiates Tooltip     — fixed <div> for hover info via Raycaster
  └─ runs the animation loop  (requestAnimationFrame)
```

### Link rendering

All links are `TubeGeometry` meshes, not flat lines. This ensures links have real visual thickness regardless of WebGL's `linewidth` limitation.

`LinkDef` (in `topologies.ts`) supports two optional visual fields:

| Field | Type | Effect |
|-------|------|--------|
| `arc` | `number` | Fraction of link length to lift the midpoint upward (Y+). `0` = straight. |
| `perpOffset` | `number` (world units) | Shifts the arc midpoint perpendicular to the link direction in the XZ plane. Positive/negative values fan multiple links sharing the same axis to either side, making each tube individually visible. |
| `color` | `number` (hex) | Overrides the default status color for this specific link. |

These are used by:
- **Torus** — wrap-around links get a positive `arc` (scales with grid size) and a per-dimension color (red / violet / teal / amber) so they are clearly distinct from the straight mesh links.
- **Flattened Butterfly** — row links get a positive `arc` + amber color; column links get a negative `arc` + violet color. Arc magnitude scales with hop distance so long-range pairs rise higher and never occlude short-range ones.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Blank screen | Check browser console for errors; ensure `npm install` was run |
| `Cannot find module 'three/addons/...'` | Run `npm install` — `@types/three` must be installed |
| TypeScript errors on `build` | Run `npm run dev` first to confirm the runtime works, then review type errors |
| Very low FPS | Reduce `devicePixelRatio` in `main.ts` or lower shadow map size; for Flattened Butterfly reduce `p`/`q` (tube count grows as p×q(p+q−2)/2) |
| Graph too large / overlapping | Reduce `k`, `n`, or `nodeCount` parameters in the UI |
| `CMD.EXE` / UNC path error on `npm install` | You are running the Windows `npm` against a WSL path. Open a **WSL terminal** and run `npm install` from there |

---

## License

MIT
