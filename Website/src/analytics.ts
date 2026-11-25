/* ============================================================
   Feature 5: Campus Impact Analytics
   Transparent calculations over demo complaint records.
   Canvas-drawn bar + donut charts (no external chart lib).
   ============================================================ */

import {
  allComplaints,
  CATEGORIES,
  normalizeLocation,
} from './store'

interface Metrics {
  total: number
  resolved: number
  resolutionPct: number
  topCategory: string
  topCategoryCount: number
  mostImproved: string
  mostImprovedDelta: number
  estTimeSavedHours: number
  monthlyTrend: { month: string; reported: number; resolved: number }[]
  categoryBreakdown: { category: string; count: number }[]
}

function computeMetrics(): Metrics {
  const all = allComplaints()
  const total = all.length
  const resolved = all.filter((c) => c.status === 'Resolved')
  const resolutionPct = total ? Math.round((resolved.length / total) * 100) : 0

  // Top category
  const catCounts = new Map<string, number>()
  for (const c of all) catCounts.set(c.category, (catCounts.get(c.category) || 0) + 1)
  let topCategory = '—'
  let topCategoryCount = 0
  for (const [cat, n] of catCounts) {
    if (n > topCategoryCount) {
      topCategory = cat
      topCategoryCount = n
    }
  }

  // Most improved area: compare resolved counts in first vs second half of the window
  const byAreaResolved = new Map<string, { first: number; second: number }>()
  const now = Date.now()
  const windowMs = 90 * 24 * 3600000
  for (const c of resolved) {
    const area = normalizeLocation(c.location)
    const resolvedAt = c.resolvedAt || c.createdAt
    const entry = byAreaResolved.get(area) || { first: 0, second: 0 }
    if (now - resolvedAt > windowMs / 2) entry.first++
    else entry.second++
    byAreaResolved.set(area, entry)
  }
  let mostImproved = '—'
  let mostImprovedDelta = 0
  for (const [area, v] of byAreaResolved) {
    const delta = v.second - v.first
    if (delta > mostImprovedDelta) {
      mostImprovedDelta = delta
      mostImproved = area
    }
  }

  // Estimated student time saved: each resolved issue saves ~1.5h per upvote + 0.5h base
  const estTimeSavedHours = Math.round(
    resolved.reduce((sum, c) => sum + 0.5 + c.upvotes * 1.5, 0),
  )

  // Monthly trend (last 6 months)
  const months: { month: string; reported: number; resolved: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    const label = d.toLocaleString(undefined, { month: 'short' })
    const start = d.getTime()
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime()
    const reported = all.filter((c) => c.createdAt >= start && c.createdAt < end).length
    const resolvedCount = resolved.filter((c) => {
      const r = c.resolvedAt || c.createdAt
      return r >= start && r < end
    }).length
    months.push({ month: label, reported, resolved: resolvedCount })
  }

  const categoryBreakdown = CATEGORIES.map((cat) => ({
    category: cat,
    count: all.filter((c) => c.category === cat).length,
  }))

  return {
    total,
    resolved: resolved.length,
    resolutionPct,
    topCategory,
    topCategoryCount,
    mostImproved,
    mostImprovedDelta,
    estTimeSavedHours,
    monthlyTrend: months,
    categoryBreakdown,
  }
}

/* ---------- Canvas charts ---------- */

function drawTrendChart(canvas: HTMLCanvasElement, data: { month: string; reported: number; resolved: number }[]) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = canvas.clientWidth
  const h = canvas.clientHeight
  canvas.width = w * dpr
  canvas.height = h * dpr
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)

  const pad = { l: 32, r: 12, t: 16, b: 26 }
  const cw = w - pad.l - pad.r
  const ch = h - pad.t - pad.b
  const max = Math.max(1, ...data.map((d) => Math.max(d.reported, d.resolved)))
  const barW = cw / data.length / 3

  // gridlines
  ctx.strokeStyle = 'rgba(234,245,255,0.08)'
  ctx.lineWidth = 1
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (ch / 4) * i
    ctx.beginPath()
    ctx.moveTo(pad.l, y)
    ctx.lineTo(w - pad.r, y)
    ctx.stroke()
  }

  data.forEach((d, i) => {
    const cx = pad.l + (cw / data.length) * (i + 0.5)
    const rh = (d.reported / max) * ch
    const gh = (d.resolved / max) * ch
    // reported (violet)
    ctx.fillStyle = 'rgba(115,91,255,0.85)'
    ctx.fillRect(cx - barW - 1, pad.t + ch - rh, barW, rh)
    // resolved (cyan)
    ctx.fillStyle = 'rgba(0,217,255,0.85)'
    ctx.fillRect(cx + 1, pad.t + ch - gh, barW, gh)
    // label
    ctx.fillStyle = 'rgba(159,179,204,0.9)'
    ctx.font = '10px Outfit, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(d.month, cx, h - 8)
  })

  // y axis labels
  ctx.fillStyle = 'rgba(107,126,150,0.8)'
  ctx.textAlign = 'right'
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (ch / 4) * i
    const val = Math.round(max - (max / 4) * i)
    ctx.fillText(String(val), pad.l - 6, y + 3)
  }
}

function drawDonut(canvas: HTMLCanvasElement, breakdown: { category: string; count: number }[]) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = canvas.clientWidth
  const h = canvas.clientHeight
  canvas.width = w * dpr
  canvas.height = h * dpr
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)

  const cx = w / 2
  const cy = h / 2
  const radius = Math.min(w, h) / 2 - 8
  const inner = radius * 0.6
  const total = breakdown.reduce((s, b) => s + b.count, 0) || 1
  const palette = ['#00D9FF', '#735BFF', '#22E07A', '#FFB020', '#FF4D6D', '#5B8DEF']
  let start = -Math.PI / 2
  breakdown.forEach((b, i) => {
    if (b.count === 0) return
    const slice = (b.count / total) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, radius, start, start + slice)
    ctx.closePath()
    ctx.fillStyle = palette[i % palette.length]
    ctx.fill()
    start += slice
  })
  // inner hole
  ctx.beginPath()
  ctx.arc(cx, cy, inner, 0, Math.PI * 2)
  ctx.fillStyle = '#0b1426'
  ctx.fill()
  // center text
  ctx.fillStyle = '#EAF5FF'
  ctx.font = '700 18px Orbitron, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(String(total), cx, cy + 2)
  ctx.fillStyle = '#6b7e96'
  ctx.font = '10px Outfit, sans-serif'
  ctx.fillText('TOTAL', cx, cy + 16)
}

export function initAnalytics() {
  const root = document.getElementById('analytics-root')
  if (!root) return
  const m = computeMetrics()

  root.innerHTML = `
    <div class="analytics-grid">
      <div class="analytics-metric">
        <span class="analytics-metric__label">Total Resolved</span>
        <span class="analytics-metric__value">${m.resolved}<small> / ${m.total}</small></span>
      </div>
      <div class="analytics-metric">
        <span class="analytics-metric__label">Resolution Rate</span>
        <span class="analytics-metric__value">${m.resolutionPct}<small>%</small></span>
      </div>
      <div class="analytics-metric">
        <span class="analytics-metric__label">Most Reported Category</span>
        <span class="analytics-metric__value analytics-metric__value--sm">${escapeHtml(m.topCategory)}<small>${m.topCategoryCount} reports</small></span>
      </div>
      <div class="analytics-metric">
        <span class="analytics-metric__label">Most Improved Area</span>
        <span class="analytics-metric__value analytics-metric__value--sm">${escapeHtml(m.mostImproved)}<small>+${m.mostImprovedDelta} resolutions</small></span>
      </div>
      <div class="analytics-metric">
        <span class="analytics-metric__label">Est. Student Time Saved</span>
        <span class="analytics-metric__value">${m.estTimeSavedHours}<small>hours</small></span>
      </div>
      <div class="analytics-metric">
        <span class="analytics-metric__label">Active Under SLA</span>
        <span class="analytics-metric__value">${m.total - m.resolved}<small>open</small></span>
      </div>
    </div>
    <div class="analytics-charts">
      <div class="analytics-chart-card">
        <h4>Monthly Improvement Trend</h4>
        <p class="muted">Reported vs resolved per month (demo records).</p>
        <div class="chart-legend">
          <span><i style="background:#735BFF"></i>Reported</span>
          <span><i style="background:#00D9FF"></i>Resolved</span>
        </div>
        <canvas id="trend-chart" class="chart-canvas" aria-label="Monthly trend chart"></canvas>
      </div>
      <div class="analytics-chart-card">
        <h4>Issues by Category</h4>
        <p class="muted">Distribution of all reported issues.</p>
        <canvas id="donut-chart" class="chart-canvas" aria-label="Category donut chart"></canvas>
        <div class="donut-legend">
          ${m.categoryBreakdown
            .map((b, i) => `<span><i style="background:${['#00D9FF', '#735BFF', '#22E07A', '#FFB020', '#FF4D6D', '#5B8DEF'][i]}"></i>${escapeHtml(b.category)} (${b.count})</span>`)
            .join('')}
        </div>
      </div>
    </div>
    <p class="analytics-foot muted">Metrics are calculated transparently from demo complaint records. Estimated figures (e.g. time saved) are modeled, not verified real-world results.</p>`

  const trend = document.getElementById('trend-chart') as HTMLCanvasElement | null
  const donut = document.getElementById('donut-chart') as HTMLCanvasElement | null
  if (trend) drawTrendChart(trend, m.monthlyTrend)
  if (donut) drawDonut(donut, m.categoryBreakdown)
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch] as string))
}

export function refreshAnalytics() {
  initAnalytics()
}
