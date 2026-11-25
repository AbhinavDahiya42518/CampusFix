/* ============================================================
   Feature 4: Automatic Escalation Engine
   Tracks overdue complaints and shows escalation alerts.
   No real notifications are sent.
   ============================================================ */

import {
  allComplaints,
  upsertComplaint,
  escalationLevel,
  ageHours,
  ESCALATION_THRESHOLDS,
  formatDate,
  statusBadgeClass,
  priorityBadgeClass,
  STATUS_ORDER,
} from './store'

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch] as string))
}

function levelLabel(level: ReturnType<typeof escalationLevel>): string {
  if (level === 'critical') return 'Escalated'
  if (level === 'warning') return 'Warning'
  return 'On Track'
}

function levelClass(level: ReturnType<typeof escalationLevel>): string {
  if (level === 'critical') return 'esc-card--critical'
  if (level === 'warning') return 'esc-card--warning'
  return ''
}

export function initEscalation() {
  const root = document.getElementById('escalation-root')
  if (!root) return

  const render = () => {
    const all = allComplaints().filter((c) => c.status !== 'Resolved')
    const overdue = all.filter((c) => escalationLevel(c) === 'critical')
    const warning = all.filter((c) => escalationLevel(c) === 'warning')
    const onTrack = all.filter((c) => escalationLevel(c) === 'none')

    const summary = `
      <div class="esc-summary">
        <div class="esc-stat esc-stat--critical">
          <strong>${overdue.length}</strong><span>Escalated</span>
        </div>
        <div class="esc-stat esc-stat--warning">
          <strong>${warning.length}</strong><span>Warning</span>
        </div>
        <div class="esc-stat esc-stat--ok">
          <strong>${onTrack.length}</strong><span>On Track</span>
        </div>
        <div class="esc-stat">
          <strong>${ESCALATION_THRESHOLDS.High}h</strong><span>High-Priority SLA</span>
        </div>
      </div>`

    const adminAlert = overdue.length
      ? `<div class="esc-alert">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <div><strong>Admin Alert:</strong> ${overdue.length} complaint${overdue.length > 1 ? 's have' : ' has'} crossed the resolution threshold and require immediate attention. (Demo alert — no real notification sent.)</div>
        </div>`
      : `<div class="esc-alert esc-alert--ok">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <div>No overdue complaints. All active issues are within their demo SLA windows.</div>
        </div>`

    const rows = all
      .sort((a, b) => {
        const la = escalationLevel(a)
        const lb = escalationLevel(b)
        const order = { critical: 0, warning: 1, none: 2 }
        if (order[la] !== order[lb]) return order[la] - order[lb]
        return b.createdAt - a.createdAt
      })
      .slice(0, 10)
      .map((c) => {
        const level = escalationLevel(c)
        const threshold = ESCALATION_THRESHOLDS[c.priority]
        const age = ageHours(c)
        const pct = Math.min(100, (age / threshold) * 100)
        return `
          <div class="esc-card ${levelClass(level)}">
            <div class="esc-card__head">
              <span class="esc-card__id">${escapeHtml(c.id)}</span>
              <div class="esc-card__badges">
                <span class="badge ${statusBadgeClass(c.status)}">${c.status}</span>
                <span class="badge ${priorityBadgeClass(c.priority)}">${c.priority}</span>
                <span class="badge badge--${level === 'critical' ? 'high' : level === 'warning' ? 'medium' : 'resolved'}">${levelLabel(level)}</span>
              </div>
            </div>
            <div class="esc-card__meta">${escapeHtml(c.category)} · ${escapeHtml(c.location)}</div>
            <div class="esc-card__bar">
              <span style="width:${pct}%"></span>
            </div>
            <div class="esc-card__foot">
              <span>Age: ${age.toFixed(1)}h / ${threshold}h SLA</span>
              <span>Filed ${formatDate(c.createdAt)}</span>
            </div>
            <div class="esc-card__actions">
              <button class="btn btn--ghost btn--xs esc-advance" data-id="${escapeHtml(c.id)}">Advance Status</button>
            </div>
          </div>`
      }).join('')

    const list = all.length
      ? `<div class="esc-list">${rows}</div>`
      : `<div class="empty-state"><p>No active complaints to monitor.</p></div>`

    root.innerHTML = `${summary}${adminAlert}${list}`
    bindEvents()
  }

  const bindEvents = () => {
    root!.querySelectorAll<HTMLButtonElement>('.esc-advance').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id || ''
        const all = allComplaints()
        const c = all.find((x) => x.id === id)
        if (!c) return
        const idx = STATUS_ORDER.indexOf(c.status)
        c.status = STATUS_ORDER[Math.min(idx + 1, STATUS_ORDER.length - 1)]
        if (c.status === 'Resolved' && !c.resolvedAt) c.resolvedAt = Date.now()
        upsertComplaint(c)
        render()
      })
    })
  }

  render()
}

export function refreshEscalation() {
  initEscalation()
}
