import { NetworkNode } from './NetworkNode'

const STATUS_EMOJI: Record<string, string> = {
  online: '🟢',
  offline: '🔴',
  warning: '🟡',
}

export class Tooltip {
  private el: HTMLDivElement

  constructor() {
    this.el = document.createElement('div')
    this.el.id = 'node-tooltip'
    this.el.style.cssText = `
      position: fixed;
      background: rgba(10, 20, 35, 0.92);
      color: #e0f7fa;
      border: 1px solid #4dd0e1;
      border-radius: 8px;
      padding: 10px 16px;
      font-family: monospace;
      font-size: 13px;
      pointer-events: none;
      display: none;
      z-index: 100;
      min-width: 160px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.5);
    `
    document.body.appendChild(this.el)
  }

  show(node: NetworkNode, x: number, y: number): void {
    this.el.innerHTML = `
      <strong>${node.label}</strong><br>
      Type: <span style="color:#81c784">${node.type}</span><br>
      Status: ${STATUS_EMOJI[node.status]} ${node.status}<br>
      ID: <span style="color:#90a4ae">${node.id}</span>
    `
    this.el.style.display = 'block'
    this.el.style.left = `${x + 14}px`
    this.el.style.top = `${y - 10}px`
  }

  hide(): void {
    this.el.style.display = 'none'
  }
}
