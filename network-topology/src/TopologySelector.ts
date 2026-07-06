/**
 * TopologySelector.ts
 * Sidebar with buttons for each topology.
 */

import { TOPOLOGIES, TopologyId } from './topologyMeta'

export class TopologySelector {
  private container: HTMLElement
  private buttons: Map<TopologyId, HTMLButtonElement> = new Map()
  private onSelect: (id: TopologyId) => void

  constructor(onSelect: (id: TopologyId) => void) {
    this.onSelect = onSelect
    this.container = document.getElementById('topology-selector')!
    this.build()
  }

  private build(): void {
    this.container.innerHTML = '<h3>Topologías</h3>'

    for (const topo of TOPOLOGIES) {
      const btn = document.createElement('button')
      btn.className = 'topo-btn'
      btn.dataset['id'] = topo.id
      btn.innerHTML = `
        <span class="topo-btn-name">${topo.name}</span>
        <span class="topo-btn-sub">${topo.subtitle.split('—')[0].trim()}</span>
      `
      btn.addEventListener('click', () => this.select(topo.id))
      this.buttons.set(topo.id, btn)
      this.container.appendChild(btn)
    }
  }

  select(id: TopologyId): void {
    this.buttons.forEach((btn, btnId) => {
      btn.classList.toggle('active', btnId === id)
    })
    this.onSelect(id)
  }

  getFirstId(): TopologyId {
    return TOPOLOGIES[0].id
  }
}
