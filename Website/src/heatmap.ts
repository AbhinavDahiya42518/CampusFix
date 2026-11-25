/* ============================================================
   Feature 1: Interactive Campus Issue Heatmap
   Stylized SVG campus map with glowing markers + filters.
   Reads complaint data from the shared store.
   ============================================================ */

import {
  Complaint,
  CAMPUS_LOCATIONS,
  CampusLocation,
  allComplaints,
  normalizeLocation,
} from './store'

interface Hotspot {
  location: CampusLocation
  complaints: Complaint[]
  severity: 'low' | 'medium' | 'high'
}

type Filters = { category: string; status: string }

function computeHotspots(filters: Filters): Hotspot[] {
  const all = allComplaints().filter((c) => {
    if (filters.category !== 'all' && c.category !== filters.category) return false
    if (filters.status !== 'all' && c.status !== filters.status) return false
    return true
  })
  const byLoc = new Map<string, Complaint[]>()
  for (const c of all) {
    const name = normalizeLocation(c.location)
    const arr = byLoc.get(name) || []
    arr.push(c)
    byLoc.set(name, arr)
  }
  const hotspots: Hotspot[] = []
  for (const loc of CAMPUS_LOCATIONS) {
    const complaints = byLoc.get(loc.name) || []
    if (complaints.length === 0) continue
    const severity = complaints.length >= 5 ? 'high' : complaints.length >= 3 ? 'medium' : 'low'
    hotspots.push({ location: loc, complaints, severity })
  }
  // Also include complaints whose location didn't match a known campus location
  // (group them as "Other") — skip for the map, but show count in the panel.
  return hotspots.sort((a, b) => b.complaints.length - a.complaints.length)
}

const SEVERITY_COLOR: Record<Hotspot['severity'], string> = {
  low: '#00D9FF',
  medium: '#FFB020',
  high: '#FF4D6D',
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch] as string))
}

function renderBuildings(): string {
  // Stylized campus buildings as rectangles + labels on the SVG canvas.
  return CAMPUS_LOCATIONS.map((l) => {
    const x = l.x * 100
    const y = l.y * 100
    const w = 14
    const h = 9
    const kindColor =
      l.kind === 'academic' ? 'rgba(0,217,255,0.18)' :
      l.kind === 'residential' ? 'rgba(115,91,255,0.18)' :
      l.kind === 'utility' ? 'rgba(34,224,122,0.16)' :
      l.kind === 'admin' ? 'rgba(255,176,32,0.16)' :
      'rgba(234,245,255,0.10)'
    return `
      <g class="map-building" data-loc="${escapeHtml(l.name)}">
        <rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="2"
          fill="${kindColor}" stroke="rgba(234,245,255,0.18)" stroke-width="0.3" />
        <text x="${x}" y="${y - h / 2 - 1.5}" text-anchor="middle" class="map-label">${escapeHtml(l.name)}</text>
      </g>`
  }).join('')
}

function renderMarkers(hotspots: Hotspot[]): string {
  return hotspots
    .map((h) => {
      const cx = h.location.x * 100
      const cy = h.location.y * 100
      const color = SEVERITY_COLOR[h.severity]
      const r = 1.6 + Math.min(h.complaints.length, 8) * 0.35
      return `
        <g class="map-marker" data-loc="${escapeHtml(h.location.name)}" tabindex="0" role="button"
           aria-label="${escapeHtml(h.location.name)}: ${h.complaints.length} issues">
          <circle cx="${cx}" cy="${cy}" r="${r + 2.5}" fill="${color}" opacity="0.18" class="marker-pulse" />
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity="0.9"
            style="filter: drop-shadow(0 0 4px ${color})" />
          <text x="${cx}" y="${cy + 0.8}" text-anchor="middle" class="marker-count">${h.complaints.length}</text>
        </g>`
    })
    .join('')
}

function renderLegend(): string {
  return `
    <div class="heatmap-legend">
      <span class="heatmap-legend__item"><i style="background:${SEVERITY_COLOR.low}"></i>Low (1-2)</span>
      <span class="heatmap-legend__item"><i style="background:${SEVERITY_COLOR.medium}"></i>Medium (3-4)</span>
      <span class="heatmap-legend__item"><i style="background:${SEVERITY_COLOR.high}"></i>High (5+)</span>
    </div>`
}

function renderFilters(): string {
  return `
    <div class="heatmap-filters">
      <label>Category
        <select id="heatmap-cat">
          <option value="all">All Categories</option>
          <option>Electricity</option>
          <option>Water Supply</option>
          <option>Wi-Fi &amp; Internet</option>
          <option>Cleanliness</option>
          <option>Infrastructure</option>
          <option>Classroom Facilities</option>
        </select>
      </label>
      <label>Status
        <select id="heatmap-status">
          <option value="all">All Statuses</option>
          <option>Pending</option>
          <option>In Progress</option>
          <option>Resolved</option>
        </select>
      </label>
    </div>`
}

function renderDetails(h: Hotspot | null): string {
  if (!h) {
    return `<div class="heatmap-details heatmap-details--empty">
      <p>Select a glowing hotspot on the map to view issue details.</p>
    </div>`
  }
  const catCounts = new Map<string, number>()
  for (const c of h.complaints) catCounts.set(c.category, (catCounts.get(c.category) || 0) + 1)
  const cats = Array.from(catCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([cat, n]) => `<span class="chip">${escapeHtml(cat)} <b>${n}</b></span>`)
    .join('')
  const active = h.complaints.filter((c) => c.status !== 'Resolved')
  const list = active.slice(0, 4).map((c) => `
    <div class="heatmap-complaint">
      <span class="heatmap-complaint__id">${escapeHtml(c.id)}</span>
      <span class="badge ${c.status === 'Pending' ? 'badge--pending' : c.status === 'In Progress' ? 'badge--in-progress' : 'badge--resolved'}">${c.status}</span>
    </div>`).join('')
  return `
    <div class="heatmap-details">
      <h4>${escapeHtml(h.location.name)}</h4>
      <div class="heatmap-details__stat">
        <div><strong>${h.complaints.length}</strong><span>Total Issues</span></div>
        <div><strong>${active.length}</strong><span>Active</span></div>
        <div><strong>${h.complaints.length - active.length}</strong><span>Resolved</span></div>
      </div>
      <div class="heatmap-details__label">Issue Categories</div>
      <div class="heatmap-details__cats">${cats}</div>
      <div class="heatmap-details__label">Active Complaints</div>
      <div class="heatmap-details__list">${list || '<p class="muted">No active complaints.</p>'}</div>
    </div>`
}

export function initHeatmap() {
  const root = document.getElementById('heatmap-root')
  if (!root) return

  let filters: Filters = { category: 'all', status: 'all' }
  let selectedLoc: string | null = null

  const render = () => {
    const hotspots = computeHotspots(filters)
    const selected = hotspots.find((h) => h.location.name === selectedLoc) || null
    root.innerHTML = `
      <div class="heatmap-layout">
        <div class="heatmap-map-wrap">
          <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" class="heatmap-map" aria-label="Campus issue heatmap">
            <defs>
              <radialGradient id="mapBg" cx="50%" cy="50%" r="60%">
                <stop offset="0%" stop-color="rgba(0,217,255,0.08)" />
                <stop offset="100%" stop-color="rgba(5,9,20,0)" />
              </radialGradient>
            </defs>
            <rect x="0" y="0" width="100" height="100" fill="url(#mapBg)" />
            <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(0,217,255,0.1)" stroke-width="0.2" />
            <line x1="50" y1="0" x2="50" y2="100" stroke="rgba(0,217,255,0.1)" stroke-width="0.2" />
            ${renderBuildings()}
            ${renderMarkers(hotspots)}
          </svg>
          ${renderLegend()}
        </div>
        <div class="heatmap-side">
          ${renderFilters()}
          <div id="heatmap-details-host">${renderDetails(selected)}</div>
        </div>
      </div>`
    if (selectedLoc) {
      const el = root.querySelector<HTMLElement>(`.map-marker[data-loc="${CSS.escape(selectedLoc!)}"]`)
      el?.classList.add('active')
    }
    bindEvents()
  }

  const bindEvents = () => {
    const catSel = document.getElementById('heatmap-cat') as HTMLSelectElement | null
    const statusSel = document.getElementById('heatmap-status') as HTMLSelectElement | null
    catSel?.addEventListener('change', () => {
      filters.category = catSel.value
      selectedLoc = null
      render()
    })
    statusSel?.addEventListener('change', () => {
      filters.status = statusSel.value
      selectedLoc = null
      render()
    })
    root.querySelectorAll<HTMLElement>('.map-marker').forEach((el) => {
      const handler = () => {
        selectedLoc = el.dataset.loc || null
        render()
      }
      el.addEventListener('click', handler)
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handler()
        }
      })
    })
  }

  render()
}

export function refreshHeatmap() {
  initHeatmap()
}
