import './style.css'
import {
  Complaint,
  Status,
  STATUS_ORDER,
  loadComplaints,
  upsertComplaint,
  uniqueId,
  formatDate,
  statusBadgeClass,
  ensureSeeded,
  setSessionSid,
  departmentFor,
  advanceStatus,
} from './store'
import { initDashboard, refreshDashboard } from './dashboard'
import { initAdmin, refreshAdmin } from './admin'
import { analyzeIntelligence } from './intel'
import { initHeatmap, refreshHeatmap } from './heatmap'
import { initCommunity, refreshCommunity } from './community'
import { initEscalation, refreshEscalation } from './escalation'
import { initAnalytics, refreshAnalytics } from './analytics'
import { initQr, applyLocationFromUrl } from './qr'

/* ============================================================
   CampusFix — App Logic
   - Multi-layer parallax canvas background
   - Reveal-on-scroll, animated counters, nav, mobile menu
   - Issue submission + complaint tracking (localStorage demo)
   - Innovation: heatmap, intelligence, community, escalation,
     analytics, QR reporting, command center.
   ============================================================ */

const prefersReducedMotion =
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* ------------------------------------------------------------
   1. Cinematic animated canvas background (particles + network)
   ------------------------------------------------------------ */
class BackgroundScene {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private width = 0
  private height = 0
  private dpr = 1
  private particles: Particle[] = []
  private scroll = 0
  private targetScroll = 0
  private rafId = 0
  private running = true
  private lastFrame = 0

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context unavailable')
    this.ctx = ctx
    this.resize()
    this.initParticles()
    this.bindEvents()
    this.lastFrame = performance.now()
    this.loop()
  }

  private bindEvents() {
    window.addEventListener('resize', () => this.resize(), { passive: true })
    window.addEventListener(
      'scroll',
      () => {
        this.targetScroll = window.scrollY
      },
      { passive: true },
    )
    document.addEventListener('visibilitychange', () => {
      this.running = !document.hidden
      if (this.running) {
        this.lastFrame = performance.now()
        this.loop()
      } else {
        cancelAnimationFrame(this.rafId)
      }
    })
  }

  private resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.width = window.innerWidth
    this.height = window.innerHeight
    this.canvas.width = Math.floor(this.width * this.dpr)
    this.canvas.height = Math.floor(this.height * this.dpr)
    this.canvas.style.width = this.width + 'px'
    this.canvas.style.height = this.height + 'px'
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    this.initParticles()
  }

  private initParticles() {
    const area = this.width * this.height
    const count = Math.min(120, Math.max(40, Math.floor(area / 14000)))
    this.particles = []
    for (let i = 0; i < count; i++) this.particles.push(new Particle(this.width, this.height))
  }

  private loop = () => {
    if (!this.running) return
    const now = performance.now()
    const dt = Math.min((now - this.lastFrame) / 16.67, 3)
    this.lastFrame = now
    this.scroll += (this.targetScroll - this.scroll) * 0.08 * dt
    this.render(dt)
    this.rafId = requestAnimationFrame(this.loop)
  }

  private render(dt: number) {
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.width, this.height)
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - this.height)
    const scrollFrac = this.scroll / maxScroll
    const layerOffset = scrollFrac * Math.min(this.height * 0.6, 420)

    for (const p of this.particles) {
      p.update(dt, this.width, this.height, layerOffset)
      p.draw(ctx)
    }

    const maxDist = 130
    for (let i = 0; i < this.particles.length; i++) {
      for (let j = i + 1; j < this.particles.length; j++) {
        const a = this.particles[i]
        const b = this.particles[j]
        const dx = a.x - b.x
        const dy = a.y - b.y
        const d2 = dx * dx + dy * dy
        if (d2 < maxDist * maxDist) {
          const alpha = (1 - Math.sqrt(d2) / maxDist) * 0.35
          const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y)
          grad.addColorStop(0, `rgba(0, 217, 255, ${alpha * a.depth})`)
          grad.addColorStop(1, `rgba(115, 91, 255, ${alpha * b.depth})`)
          ctx.strokeStyle = grad
          ctx.lineWidth = 0.7
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.stroke()
        }
      }
    }
  }

  destroy() {
    cancelAnimationFrame(this.rafId)
    this.running = false
  }
}

class Particle {
  x: number
  y: number
  baseY: number
  vx: number
  vy: number
  radius: number
  depth: number
  hue: number
  private parallaxY = 0

  constructor(width: number, height: number) {
    this.x = Math.random() * width
    this.baseY = Math.random() * height
    this.y = this.baseY
    this.vx = (Math.random() - 0.5) * 0.25
    this.vy = (Math.random() - 0.5) * 0.18
    this.depth = Math.random() * 0.8 + 0.2
    this.radius = this.depth * 2.2 + 0.5
    this.hue = Math.random() > 0.5 ? 0 : 1
  }

  update(dt: number, width: number, height: number, layerOffset: number) {
    this.x += this.vx * dt * this.depth
    this.y += this.vy * dt
    if (this.x < -10) this.x = width + 10
    else if (this.x > width + 10) this.x = -10
    if (this.y < -10) this.y = height + 10
    else if (this.y > height + 10) this.y = -10
    this.parallaxY = -layerOffset * this.depth
  }

  draw(ctx: CanvasRenderingContext2D) {
    const px = this.x
    const py = this.y + this.parallaxY
    const color = this.hue === 0 ? '0, 217, 255' : '115, 91, 255'
    const alpha = 0.35 + this.depth * 0.5
    const grad = ctx.createRadialGradient(px, py, 0, px, py, this.radius * 4)
    grad.addColorStop(0, `rgba(${color}, ${alpha})`)
    grad.addColorStop(1, `rgba(${color}, 0)`)
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(px, py, this.radius * 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = `rgba(${color}, ${Math.min(1, alpha + 0.3)})`
    ctx.beginPath()
    ctx.arc(px, py, this.radius, 0, Math.PI * 2)
    ctx.fill()
  }
}

/* ------------------------------------------------------------
   2. UI interactions
   ------------------------------------------------------------ */

function initNav() {
  const nav = document.getElementById('nav')
  const toggle = document.getElementById('nav-toggle')
  const links = document.getElementById('nav-links')
  if (!nav || !toggle || !links) return

  const onScroll = () => {
    if (window.scrollY > 24) nav.classList.add('scrolled')
    else nav.classList.remove('scrolled')
  }
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })

  toggle.addEventListener('click', () => {
    const open = links.classList.toggle('open')
    toggle.classList.toggle('open', open)
    toggle.setAttribute('aria-expanded', String(open))
  })

  links.querySelectorAll('a').forEach((a) =>
    a.addEventListener('click', () => {
      links.classList.remove('open')
      toggle.classList.remove('open')
      toggle.setAttribute('aria-expanded', 'false')
    }),
  )
}

function initReveal() {
  const els = document.querySelectorAll<HTMLElement>('.reveal')
  if (!('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('in'))
    return
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in')
          io.unobserve(e.target)
        }
      })
    },
    { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
  )
  els.forEach((el) => io.observe(el))
}

function initCounters() {
  const counters = document.querySelectorAll<HTMLElement>('[data-count]')
  if (!counters.length) return
  const animate = (el: HTMLElement) => {
    const target = Number(el.dataset.count || '0')
    const suffix = el.dataset.suffix || ''
    if (prefersReducedMotion) {
      el.textContent = target.toLocaleString() + suffix
      return
    }
    const duration = 1600
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      const val = Math.floor(target * eased)
      el.textContent = val.toLocaleString() + suffix
      if (t < 1) requestAnimationFrame(step)
      else el.textContent = target.toLocaleString() + suffix
    }
    requestAnimationFrame(step)
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          animate(e.target as HTMLElement)
          io.unobserve(e.target)
        }
      })
    },
    { threshold: 0.5 },
  )
  counters.forEach((c) => io.observe(c))
}

/* ------------------------------------------------------------
   3. Report form
   ------------------------------------------------------------ */

function setFieldError(name: string, msg: string) {
  const err = document.querySelector<HTMLElement>(`.field__error[data-for="${name}"]`)
  const field = err?.closest('.field')
  if (err) err.textContent = msg
  if (field) field.classList.toggle('invalid', !!msg)
}

function validateReportForm(form: HTMLFormElement): boolean {
  const fd = new FormData(form)
  let ok = true
  const required: (keyof Complaint)[] = ['name', 'sid', 'category', 'location', 'description']
  required.forEach((field) => {
    const val = String(fd.get(field) || '').trim()
    if (!val) {
      setFieldError(field, 'This field is required.')
      ok = false
    } else {
      setFieldError(field, '')
    }
  })
  return ok
}

function initReportForm() {
  const form = document.getElementById('report-form') as HTMLFormElement | null
  const success = document.getElementById('report-success')
  const successId = document.getElementById('success-id')
  const reportAgain = document.getElementById('report-again')
  const copyId = document.getElementById('copy-id')
  const goTrack = document.getElementById('go-track')
  if (!form || !success || !successId) return

  form.addEventListener('submit', (e) => {
    e.preventDefault()
    if (!validateReportForm(form)) return

    const fd = new FormData(form)
    const id = uniqueId()
    // Derive priority from the intelligence engine for consistency.
    const intel = analyzeIntelligence(
      String(fd.get('description') || ''),
      String(fd.get('location') || ''),
    )
    const complaint: Complaint = {
      id,
      name: String(fd.get('name') || '').trim(),
      sid: String(fd.get('sid') || '').trim(),
      category: String(fd.get('category') || '').trim(),
      location: String(fd.get('location') || '').trim(),
      description: String(fd.get('description') || '').trim(),
      status: 'Pending',
      priority: intel.priority,
      department: departmentFor(String(fd.get('category') || '').trim()),
      createdAt: Date.now(),
      resolvedAt: null,
      upvotes: 0,
      voters: [],
      history: [{ status: 'Pending', timestamp: Date.now() }],
      resolutionNotes: null,
    }
    upsertComplaint(complaint)

    // Track this student as the session voter too.
    setSessionSid(complaint.sid)

    successId.textContent = id
    form.hidden = true
    success.hidden = false

    // Refresh innovation modules so new data appears.
    refreshAll()

    if (goTrack) {
      const trackInput = document.getElementById('t-id') as HTMLInputElement | null
      goTrack.addEventListener(
        'click',
        () => {
          if (trackInput) {
            trackInput.value = id
            setTimeout(() => lookupComplaint(id), 600)
          }
        },
        { once: true },
      )
    }
  })

  reportAgain?.addEventListener('click', () => {
    form.reset()
    form.hidden = false
    success.hidden = true
    ;['name', 'sid', 'category', 'location', 'description'].forEach((f) => setFieldError(f, ''))
  })

  copyId?.addEventListener('click', async () => {
    const text = successId.textContent || ''
    try {
      await navigator.clipboard.writeText(text)
      toast('Complaint ID copied')
    } catch {
      toast('Copy failed — select the ID manually')
    }
  })
}

/* ------------------------------------------------------------
   4. Track form
   ------------------------------------------------------------ */

function renderTrackResult(c: Complaint) {
  const result = document.getElementById('track-result')
  const empty = document.getElementById('track-empty')
  if (!result || !empty) return
  result.hidden = false
  empty.hidden = true

  const idEl = document.getElementById('tr-id')
  const catEl = document.getElementById('tr-cat')
  const badge = document.getElementById('tr-badge')
  const nameEl = document.getElementById('tr-name')
  const locEl = document.getElementById('tr-loc')
  const dateEl = document.getElementById('tr-date')
  const descEl = document.getElementById('tr-desc')
  if (idEl) idEl.textContent = c.id
  if (catEl) catEl.textContent = `${c.category} · ${c.priority} priority`
  if (badge) {
    badge.textContent = c.status
    badge.className = 'badge ' + statusBadgeClass(c.status)
  }
  if (nameEl) nameEl.textContent = `${c.name} (${c.sid})`
  if (locEl) locEl.textContent = c.location
  if (dateEl) dateEl.textContent = formatDate(c.createdAt)
  if (descEl) descEl.textContent = c.description
  const deptEl = document.getElementById('tr-dept')
  const notesEl = document.getElementById('tr-notes')
  if (deptEl) deptEl.textContent = c.department
  if (notesEl) notesEl.textContent = c.resolutionNotes || 'Not resolved yet.'

  // Render status history timeline
  const timeline = document.getElementById('tr-timeline')
  if (timeline) {
    timeline.innerHTML = `<div class="track-timeline__label">Status History</div>` +
      c.history.map((h) => `
        <div class="track-timeline__item">
          <span class="track-timeline__dot"></span>
          <span class="track-timeline__status badge ${statusBadgeClass(h.status)}">${h.status}</span>
          <span class="track-timeline__time">${formatDate(h.timestamp)}</span>
          ${h.note ? `<span class="track-timeline__note">${escapeHtml(h.note)}</span>` : ''}
        </div>`).join('')
  }

  updateProgress(c.status)

  const advance = document.getElementById('advance-status')
  advance?.addEventListener('click', () => {
    advanceStatus(c)
    upsertComplaint(c)
    renderTrackResult(c)
    refreshAll()
    toast(`Status advanced to ${c.status}`)
  })
}

function updateProgress(status: Status) {
  const wrap = document.querySelector('.track-progress')
  if (!wrap) return
  const steps = wrap.querySelectorAll<HTMLElement>('.track-progress__step')
  const bars = wrap.querySelectorAll<HTMLElement>('.track-progress__bar')
  const activeIdx = STATUS_ORDER.indexOf(status)
  steps.forEach((s, i) => {
    s.classList.remove('active', 'done')
    if (i < activeIdx) s.classList.add('done')
    else if (i === activeIdx) s.classList.add('active')
  })
  bars.forEach((b, i) => {
    b.classList.toggle('done', i < activeIdx)
  })
}

function lookupComplaint(id: string): boolean {
  const all = loadComplaints()
  const c = all[id.trim()]
  if (!c) {
    setFieldError('trackid', 'No complaint found with that ID.')
    const result = document.getElementById('track-result')
    const empty = document.getElementById('track-empty')
    if (result) result.hidden = true
    if (empty) empty.hidden = false
    return false
  }
  setFieldError('trackid', '')
  renderTrackResult(c)
  return true
}

function initTrackForm() {
  const form = document.getElementById('track-form') as HTMLFormElement | null
  const input = document.getElementById('t-id') as HTMLInputElement | null
  const clearBtn = document.getElementById('clear-track')
  if (!form || !input) return

  form.addEventListener('submit', (e) => {
    e.preventDefault()
    const val = input.value.trim()
    if (!val) {
      setFieldError('trackid', 'Please enter a complaint ID.')
      return
    }
    lookupComplaint(val)
  })

  clearBtn?.addEventListener('click', () => {
    const result = document.getElementById('track-result')
    const empty = document.getElementById('track-empty')
    if (result) result.hidden = true
    if (empty) empty.hidden = false
    input.value = ''
    setFieldError('trackid', '')
  })
}

/* ------------------------------------------------------------
   5. Category cards -> jump to report + preselect
   ------------------------------------------------------------ */

function initCategoryCards() {
  const cards = document.querySelectorAll<HTMLButtonElement>('.cat-card')
  const catSelect = document.getElementById('r-cat') as HTMLSelectElement | null
  cards.forEach((card) => {
    card.addEventListener('click', () => {
      const cat = card.dataset.cat || ''
      if (catSelect) catSelect.value = cat
      document.getElementById('report')?.scrollIntoView({ behavior: 'smooth' })
      toast(`Category selected: ${cat}`)
    })
  })
}

/* ------------------------------------------------------------
   6. Toast helper
   ------------------------------------------------------------ */

let toastTimer = 0
function toast(msg: string) {
  let el = document.querySelector<HTMLElement>('.toast')
  if (!el) {
    el = document.createElement('div')
    el.className = 'toast'
    el.setAttribute('role', 'status')
    document.body.appendChild(el)
  }
  el.textContent = msg
  requestAnimationFrame(() => el!.classList.add('show'))
  clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => el!.classList.remove('show'), 2200)
}

/* ------------------------------------------------------------
   7. Parallax for CSS grid + glow layers
   ------------------------------------------------------------ */

function initParallax() {
  const grid = document.querySelector<HTMLElement>('.bg-grid')
  const glowCyan = document.querySelector<HTMLElement>('.bg-glow--cyan')
  const glowViolet = document.querySelector<HTMLElement>('.bg-glow--violet')
  let ticking = false
  const update = () => {
    const y = window.scrollY
    if (grid) grid.style.transform = `perspective(600px) rotateX(62deg) translateY(${y * 0.15}px)`
    if (glowCyan) glowCyan.style.transform = `translateY(${y * 0.08}px)`
    if (glowViolet) glowViolet.style.transform = `translateY(${-y * 0.05}px)`
    ticking = false
  }
  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        requestAnimationFrame(update)
        ticking = true
      }
    },
    { passive: true },
  )
}

/* ------------------------------------------------------------
   8. Footer year
   ------------------------------------------------------------ */

function initYear() {
  const y = document.getElementById('year')
  if (y) y.textContent = String(new Date().getFullYear())
}

/* ------------------------------------------------------------
   9. Innovation: Command Center tabs
   ------------------------------------------------------------ */

let tabsInited = false
function initCommandTabs() {
  if (tabsInited) return
  const tabBtns = document.querySelectorAll<HTMLButtonElement>('.command__tab')
  if (!tabBtns.length) return
  tabsInited = true
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab
      tabBtns.forEach((b) => {
        const active = b === btn
        b.classList.toggle('active', active)
        b.setAttribute('aria-selected', String(active))
      })
      document.querySelectorAll<HTMLElement>('.command__pane').forEach((pane) => {
        pane.hidden = pane.dataset.pane !== target
        if (!pane.hidden) pane.classList.add('active')
      })
      // Re-render charts on reveal (canvas sizing needs visible element)
      if (target === 'impact') refreshAnalytics()
    })
  })
}

/* ------------------------------------------------------------
   10. Innovation: Smart Intelligence live analysis
   ------------------------------------------------------------ */

let intelDebounce = 0
function initIntel() {
  const desc = document.getElementById('intel-desc') as HTMLTextAreaElement | null
  const loc = document.getElementById('intel-loc') as HTMLInputElement | null
  const output = document.getElementById('intel-output')
  const empty = document.getElementById('intel-empty')
  if (!desc || !output || !empty) return

  const render = () => {
    const text = desc.value.trim()
    const location = loc?.value.trim() || ''
    if (!text) {
      output.hidden = true
      empty.hidden = false
      return
    }
    empty.hidden = true
    output.hidden = false
    const result = analyzeIntelligence(text, location)

    const catEl = document.getElementById('intel-cat')
    const catReason = document.getElementById('intel-cat-reason')
    const priEl = document.getElementById('intel-priority')
    const priReason = document.getElementById('intel-priority-reason')
    if (catEl) catEl.textContent = result.category || '— (pick manually)'
    if (catReason) catReason.textContent = result.categoryReason
    if (priEl) {
      priEl.textContent = result.priority
      priEl.className = 'intel__suggest-value'
    }
    if (priReason) priReason.textContent = result.priorityReason

    const list = document.getElementById('intel-similar-list')
    if (list) {
      if (result.similar.length === 0) {
        list.innerHTML = '<p class="intel__similar-empty">No similar open complaints found — safe to file a new report.</p>'
      } else {
        list.innerHTML = result.similar
          .map(
            (c) => `<div class="intel-sim-item">
              <span class="intel-sim-item__id">${c.id}</span>
              <span class="intel-sim-item__desc">${escapeHtml(c.description)}</span>
              <span class="intel-sim-item__upvotes">${c.upvotes} supporters</span>
            </div>`,
          )
          .join('') +
          '<p class="intel__similar-empty">Consider supporting an existing complaint instead of creating a duplicate.</p>'
      }
    }
  }

  desc.addEventListener('input', () => {
    clearTimeout(intelDebounce)
    intelDebounce = window.setTimeout(render, 300)
  })
  loc?.addEventListener('input', () => {
    clearTimeout(intelDebounce)
    intelDebounce = window.setTimeout(render, 300)
  })
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch] as string))
}

/* ------------------------------------------------------------
   11. Refresh all innovation modules (after data changes)
   ------------------------------------------------------------ */

function refreshAll() {
  refreshHeatmap()
  refreshCommunity()
  refreshEscalation()
  refreshAnalytics()
}

/* ------------------------------------------------------------
   12. Listen for toast events from other modules (e.g. QR)
   ------------------------------------------------------------ */

window.addEventListener('campusfix:toast', (e) => {
  const detail = (e as CustomEvent).detail
  if (typeof detail === 'string') toast(detail)
})

/* ------------------------------------------------------------
   Boot
   ------------------------------------------------------------ */

function boot() {
  ensureSeeded()

  if (!prefersReducedMotion) {
    const canvas = document.getElementById('bg-canvas') as HTMLCanvasElement | null
    if (canvas) new BackgroundScene(canvas)
    initParallax()
  }
  initNav()
  initReveal()
  initCounters()
  initReportForm()
  initTrackForm()
  initCategoryCards()
  initYear()

  // Innovation modules
  initCommandTabs()
  initHeatmap()
  initCommunity()
  initEscalation()
  initAnalytics()
  initIntel()
  initQr()

  // Apply ?loc= from URL (QR scan)
  applyLocationFromUrl()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot)
} else {
  boot()
}
