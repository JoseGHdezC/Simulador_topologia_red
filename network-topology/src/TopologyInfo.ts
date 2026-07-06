/**
 * TopologyInfo.ts
 * Right panel: description, editable parameter form, and dynamic features table.
 *
 * When the user changes a parameter the panel immediately:
 *  1. Recomputes and re-renders the features table.
 *  2. Fires onRebuild(params) so main.ts can rebuild the 3D graph.
 *
 * The n-tuple param (k for Mesh/Torus) is special: its length tracks the 'n'
 * parameter and the input is rendered as comma-separated integers.
 */

import { TopologyMeta, AnyParams, ParamField } from './topologyMeta'

export class TopologyInfo {
  private container: HTMLElement
  private onRebuild: (params: AnyParams) => void
  private currentMeta: TopologyMeta | null = null
  private currentParams: AnyParams | null = null

  constructor(onRebuild: (params: AnyParams) => void) {
    this.onRebuild = onRebuild
    this.container = document.getElementById('topology-info')!
  }

  show(meta: TopologyMeta): void {
    this.currentMeta = meta
    // Deep-copy default params so each topology keeps its own state
    this.currentParams = JSON.parse(JSON.stringify(meta.defaultParams)) as AnyParams
    this.render()
    // Use .visible so the CSS slide transition works; re-expose if it was collapsed
    this.container.classList.add('visible')
    this.container.classList.remove('collapsed')
  }

  hide(): void {
    this.container.classList.remove('visible')
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  private render(): void {
    if (!this.currentMeta || !this.currentParams) return
    const meta = this.currentMeta
    const params = this.currentParams

    this.container.innerHTML = `
      <div class="info-header">
        <h2>${meta.name}</h2>
        <p class="info-subtitle">${meta.subtitle}</p>
      </div>
      <p class="info-description">${meta.description}</p>
      <section class="params-section">
        <h3>Parámetros</h3>
        <form id="params-form" autocomplete="off">
          ${meta.paramFields.map(f => this.renderField(f, params)).join('')}
          <button type="submit" class="rebuild-btn">↺ Reconstruir</button>
        </form>
      </section>
      <section class="features-section">
        <h3>Características</h3>
        ${this.renderFeaturesTable(meta, params)}
      </section>
    `

    this.attachFormListeners()
  }

  private renderField(field: ParamField, params: AnyParams): string {
    const rec = params as unknown as Record<string, unknown>

    if (field.type === 'int') {
      const val = (rec[field.key] as number) ?? field.min ?? 1
      return `
        <div class="param-row">
          <label class="param-label" for="pf_${field.key}">${field.label}</label>
          <input
            class="param-input"
            id="pf_${field.key}"
            data-key="${field.key}"
            data-type="int"
            type="number"
            min="${field.min ?? 1}"
            max="${field.max ?? 99}"
            value="${val}"
            placeholder="${field.hint ?? ''}"
          />
        </div>`
    }

    if (field.type === 'int-tuple') {
      const arr = (rec[field.key] as number[]) ?? []
      const val = arr.join(', ')
      const lengthNote = field.lengthKey
        ? ` <span class="param-hint">(${rec[field.lengthKey as string]} valores)</span>`
        : ''
      return `
        <div class="param-row">
          <label class="param-label" for="pf_${field.key}">
            ${field.label}${lengthNote}
          </label>
          <input
            class="param-input"
            id="pf_${field.key}"
            data-key="${field.key}"
            data-type="int-tuple"
            data-length-key="${field.lengthKey ?? ''}"
            data-min="${field.min ?? 1}"
            data-max="${field.max ?? 99}"
            type="text"
            value="${val}"
            placeholder="${field.hint ?? 'ej. 4, 4'}"
          />
        </div>`
    }

    return ''
  }

  private renderFeaturesTable(meta: TopologyMeta, params: AnyParams): string {
    const features = meta.computeFeatures(params)
    const rows = features
      .map(f => `<tr><td class="feat-label">${f.label}</td><td class="feat-value">${f.value}</td></tr>`)
      .join('')
    return `<table class="features-table"><tbody>${rows}</tbody></table>`
  }

  // ── Form listeners ─────────────────────────────────────────────────────────

  private attachFormListeners(): void {
    const form = document.getElementById('params-form') as HTMLFormElement | null
    if (!form) return

    // Live-update features table on every input change (no graph rebuild yet)
    form.addEventListener('input', () => {
      this.readFormIntoParams()
      this.refreshFeaturesTable()
    })

    // Rebuild graph on submit (Enter key or button click)
    form.addEventListener('submit', (e) => {
      e.preventDefault()
      this.readFormIntoParams()
      this.refreshFeaturesTable()
      if (this.currentParams) this.onRebuild(this.currentParams)
    })
  }

  /**
   * Read all form inputs and write parsed values into this.currentParams.
   * For int-tuple fields, the tuple length is padded/trimmed to match the
   * current value of the lengthKey param.
   */
  private readFormIntoParams(): void {
    if (!this.currentMeta || !this.currentParams) return
    const form = document.getElementById('params-form') as HTMLFormElement | null
    if (!form) return

    const rec = this.currentParams as unknown as Record<string, unknown>

    // First pass: read plain int fields (needed before tuple length resolution)
    for (const field of this.currentMeta.paramFields) {
      if (field.type !== 'int') continue
      const input = form.querySelector<HTMLInputElement>(`[data-key="${field.key}"]`)
      if (!input) continue
      const raw = parseInt(input.value, 10)
      if (!isNaN(raw)) {
        rec[field.key] = Math.max(field.min ?? 1, Math.min(field.max ?? 99, raw))
        // Keep input clamped
        input.value = String(rec[field.key])
      }
    }

    // Second pass: read int-tuple fields (length can now reference updated int fields)
    for (const field of this.currentMeta.paramFields) {
      if (field.type !== 'int-tuple') continue
      const input = form.querySelector<HTMLInputElement>(`[data-key="${field.key}"]`)
      if (!input) continue

      const min = parseInt(input.dataset['min'] ?? '1', 10)
      const max = parseInt(input.dataset['max'] ?? '99', 10)
      const lengthKey = input.dataset['lengthKey']
      const desiredLen = lengthKey ? (rec[lengthKey] as number) : undefined

      const parts = input.value
        .split(',')
        .map(s => s.trim())
        .map(s => parseInt(s, 10))
        .filter(v => !isNaN(v))
        .map(v => Math.max(min, Math.min(max, v)))

      // Pad / trim to desired length
      let arr = [...parts]
      if (desiredLen !== undefined) {
        const last = arr[arr.length - 1] ?? min
        while (arr.length < desiredLen) arr.push(last)
        arr = arr.slice(0, desiredLen)
      }

      rec[field.key] = arr
      // Normalise displayed value to match parsed result
      input.value = arr.join(', ')

      // Update length hint span
      if (lengthKey) {
        const hint = document.querySelector<HTMLSpanElement>(`#pf_${field.key}`)
          ?.closest('.param-row')
          ?.querySelector<HTMLSpanElement>('.param-hint')
        if (hint) hint.textContent = `(${desiredLen} valores)`
      }
    }
  }

  private refreshFeaturesTable(): void {
    if (!this.currentMeta || !this.currentParams) return
    const section = this.container.querySelector('.features-section')
    if (!section) return
    const tableContainer = section.querySelector('table')?.parentElement
    if (!tableContainer) return
    // Replace only the table HTML
    const newTable = this.renderFeaturesTable(this.currentMeta, this.currentParams)
    const existing = section.querySelector('table')
    if (existing) existing.outerHTML = newTable
    else section.insertAdjacentHTML('beforeend', newTable)
  }
}
