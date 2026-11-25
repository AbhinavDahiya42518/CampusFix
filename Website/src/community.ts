/* ============================================================
   Feature 3: Community Support System
   View complaints, upvote, filter trending, one vote per student.
   ============================================================ */

import {
  Complaint,
  allComplaints,
  upsertComplaint,
  getSessionSid,
  setSessionSid,
  timeAgo,
  statusBadgeClass,
  priorityBadgeClass,
  normalizeLocation,
} from './store'

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch] as string))
}

type SortKey = 'trending' | 'recent' | 'location'

function sortComplaints(list: Complaint[], key: SortKey): Complaint[] {
  const active = list.filter((c) => c.status !== 'Resolved')
  if (key === 'trending') return [...active].sort((a, b) => b.upvotes - a.upvotes)
  if (key === 'location') return [...active].sort((a, b) => normalizeLocation(a.location).localeCompare(normalizeLocation(b.location)))
  return [...active].sort((a, b) => b.createdAt - a.createdAt)
}

export function initCommunity() {
  const root = document.getElementById('community-root')
  if (!root) return

  let sortKey: SortKey = 'trending'
  let catFilter = 'all'

  const render = () => {
    const all = allComplaints()
    const filtered = all.filter((c) => catFilter === 'all' || c.category === catFilter)
    const sorted = sortComplaints(filtered, sortKey)
    const sid = getSessionSid()

    const sessionBox = `
      <div class="community-session">
        <label for="community-sid">Your Student ID (for voting)
          <input id="community-sid" type="text" placeholder="e.g. CS21B045" value="${escapeHtml(sid)}" />
        </label>
        <p class="muted">One vote per student per complaint. Stored locally for this demo only.</p>
      </div>`

    const controls = `
      <div class="community-controls">
        <label>Sort
          <select id="community-sort">
            <option value="trending" ${sortKey === 'trending' ? 'selected' : ''}>Trending (most upvoted)</option>
            <option value="recent" ${sortKey === 'recent' ? 'selected' : ''}>Most Recent</option>
            <option value="location" ${sortKey === 'location' ? 'selected' : ''}>By Location</option>
          </select>
        </label>
        <label>Category
          <select id="community-cat">
            <option value="all" ${catFilter === 'all' ? 'selected' : ''}>All</option>
            <option ${catFilter === 'Electricity' ? 'selected' : ''}>Electricity</option>
            <option ${catFilter === 'Water Supply' ? 'selected' : ''}>Water Supply</option>
            <option ${catFilter === 'Wi-Fi & Internet' ? 'selected' : ''}>Wi-Fi &amp; Internet</option>
            <option ${catFilter === 'Cleanliness' ? 'selected' : ''}>Cleanliness</option>
            <option ${catFilter === 'Infrastructure' ? 'selected' : ''}>Infrastructure</option>
            <option ${catFilter === 'Classroom Facilities' ? 'selected' : ''}>Classroom Facilities</option>
          </select>
        </label>
      </div>`

    const cards = sorted.length
      ? sorted.slice(0, 12).map((c) => {
          const voted = sid && c.voters.includes(sid)
          return `
            <article class="ccard" data-id="${escapeHtml(c.id)}">
              <div class="ccard__head">
                <span class="ccard__id">${escapeHtml(c.id)}</span>
                <div class="ccard__badges">
                  <span class="badge ${statusBadgeClass(c.status)}">${c.status}</span>
                  <span class="badge ${priorityBadgeClass(c.priority)}">${c.priority}</span>
                </div>
              </div>
              <div class="ccard__cat">${escapeHtml(c.category)} · ${escapeHtml(normalizeLocation(c.location))}</div>
              <p class="ccard__desc">${escapeHtml(c.description)}</p>
              <div class="ccard__foot">
                <button class="upvote-btn ${voted ? 'upvote-btn--voted' : ''}" data-id="${escapeHtml(c.id)}" ${!sid ? 'disabled' : ''} aria-label="Upvote">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 4l8 8h-5v8h-6v-8H4l8-8Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
                  <span class="upvote-count">${c.upvotes}</span>
                  <span class="upvote-label">${voted ? 'Voted' : 'Support'}</span>
                </button>
                <span class="ccard__time">${timeAgo(c.createdAt)} · ${escapeHtml(c.name)}</span>
              </div>
            </article>`
        }).join('')
      : `<div class="empty-state"><p>No complaints match these filters yet.</p></div>`

    root.innerHTML = `${sessionBox}${controls}<div class="community-grid">${cards}</div>`
    bindEvents()
  }

  const bindEvents = () => {
    const sidInput = document.getElementById('community-sid') as HTMLInputElement | null
    sidInput?.addEventListener('change', () => {
      setSessionSid(sidInput.value.trim())
      render()
    })
    const sortSel = document.getElementById('community-sort') as HTMLSelectElement | null
    sortSel?.addEventListener('change', () => {
      sortKey = sortSel.value as SortKey
      render()
    })
    const catSel = document.getElementById('community-cat') as HTMLSelectElement | null
    catSel?.addEventListener('change', () => {
      catFilter = catSel.value
      render()
    })
    root.querySelectorAll<HTMLButtonElement>('.upvote-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sid = getSessionSid()
        if (!sid) return
        const id = btn.dataset.id || ''
        const all = allComplaints()
        const c = all.find((x) => x.id === id)
        if (!c) return
        if (c.voters.includes(sid)) {
          // unvote
          c.voters = c.voters.filter((v) => v !== sid)
          c.upvotes = Math.max(0, c.upvotes - 1)
        } else {
          c.voters.push(sid)
          c.upvotes += 1
        }
        upsertComplaint(c)
        render()
      })
    })
  }

  render()
}

export function refreshCommunity() {
  initCommunity()
}
