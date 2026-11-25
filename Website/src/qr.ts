/* ============================================================
   Feature 6: QR-Based Issue Reporting
   Generates QR codes for demo campus locations using the
   lightweight `qrcode` npm library. Scanning opens the report
   form with the location prefilled via URL query (?loc=...).
   Also supports manual location selection.
   ============================================================ */

import QRCode from 'qrcode'
import { CAMPUS_LOCATIONS } from './store'

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch] as string))
}

function reportUrl(loc: string): string {
  const url = new URL(window.location.href.split('#')[0])
  url.searchParams.set('loc', loc)
  url.hash = '#report'
  return url.toString()
}

export async function initQr() {
  const root = document.getElementById('qr-root')
  if (!root) return

  const cards = await Promise.all(
    CAMPUS_LOCATIONS.slice(0, 6).map(async (l) => {
      const url = reportUrl(l.name)
      let dataUrl = ''
      try {
        dataUrl = await QRCode.toDataURL(url, {
          margin: 1,
          width: 160,
          color: { dark: '#00D9FF', light: '#0B1426' },
        })
      } catch {
        dataUrl = ''
      }
      return `
        <div class="qr-card" data-loc="${escapeHtml(l.name)}">
          <div class="qr-card__img">
            ${dataUrl ? `<img src="${dataUrl}" alt="QR code for ${escapeHtml(l.name)}" width="140" height="140" />` : '<p class="muted">QR unavailable</p>'}
          </div>
          <div class="qr-card__name">${escapeHtml(l.name)}</div>
          <button type="button" class="btn btn--ghost btn--xs qr-prefill" data-loc="${escapeHtml(l.name)}">Use This Location</button>
        </div>`
    }),
  )

  root.innerHTML = `
    <p class="qr-intro muted">Each demo campus location has a QR code. Scanning one opens the report form with the location prefilled. You can also pick a location manually below — or use a button on a card.</p>
    <div class="qr-grid">${cards.join('')}</div>
    <div class="qr-manual">
      <label for="qr-manual-select">Manual location selection</label>
      <select id="qr-manual-select">
        <option value="" disabled selected>Choose a campus location…</option>
        ${CAMPUS_LOCATIONS.map((l) => `<option value="${escapeHtml(l.name)}">${escapeHtml(l.name)}</option>`).join('')}
      </select>
      <button type="button" class="btn btn--primary btn--sm" id="qr-manual-go">Open Report Form</button>
    </div>`

  root.querySelectorAll<HTMLButtonElement>('.qr-prefill').forEach((btn) => {
    btn.addEventListener('click', () => {
      applyLocation(btn.dataset.loc || '')
    })
  })
  const manualGo = document.getElementById('qr-manual-go')
  const manualSel = document.getElementById('qr-manual-select') as HTMLSelectElement | null
  manualGo?.addEventListener('click', () => {
    if (manualSel && manualSel.value) applyLocation(manualSel.value)
  })
}

/* Apply a location to the report form and scroll to it. */
function applyLocation(loc: string) {
  const input = document.getElementById('r-loc') as HTMLInputElement | null
  if (input) input.value = loc
  document.getElementById('report')?.scrollIntoView({ behavior: 'smooth' })
  // toast via custom event (main.ts listens)
  window.dispatchEvent(new CustomEvent('campusfix:toast', { detail: `Location prefilled: ${loc}` }))
}

/* On load, check URL for ?loc= and prefill. */
export function applyLocationFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search)
  const loc = params.get('loc')
  if (loc) {
    const input = document.getElementById('r-loc') as HTMLInputElement | null
    if (input) input.value = loc
  }
  return loc
}
