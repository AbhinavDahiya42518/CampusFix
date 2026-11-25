/* ============================================================
   CampusFix — Shared data store (demo, localStorage only)
   ============================================================ */

export type Status = 'Pending' | 'In Progress' | 'Resolved'
export type Priority = 'Low' | 'Medium' | 'High'

export const STATUS_ORDER: Status[] = ['Pending', 'In Progress', 'Resolved']
export const CATEGORIES = [
  'Electricity',
  'Water Supply',
  'Wi-Fi & Internet',
  'Cleanliness',
  'Infrastructure',
  'Classroom Facilities',
] as const

export interface StatusEvent {
  status: Status
  timestamp: number
  note?: string
}

export interface Complaint {
  id: string
  name: string
  sid: string
  category: string
  location: string
  description: string
  status: Status
  priority: Priority
  department: string
  createdAt: number
  resolvedAt: number | null
  upvotes: number
  voters: string[]
  history: StatusEvent[]
  resolutionNotes: string | null
}

/* Department mapping by category */
export const DEPARTMENTS: Record<string, string> = {
  Electricity: 'Electrical Maintenance',
  'Water Supply': 'Plumbing & Water Works',
  'Wi-Fi & Internet': 'IT & Network Services',
  Cleanliness: 'Sanitation & Housekeeping',
  Infrastructure: 'Civil & Infrastructure',
  'Classroom Facilities': 'Facilities Management',
}

export function departmentFor(category: string): string {
  return DEPARTMENTS[category] || 'General Maintenance'
}

/* Demo campus locations with normalized coordinates on the stylized map (0..1). */
export interface CampusLocation {
  name: string
  x: number
  y: number
  kind: 'academic' | 'residential' | 'utility' | 'admin' | 'sports'
}

export const CAMPUS_LOCATIONS: CampusLocation[] = [
  { name: 'Library Block', x: 0.18, y: 0.3, kind: 'academic' },
  { name: 'Engineering Block', x: 0.4, y: 0.22, kind: 'academic' },
  { name: 'Science Block', x: 0.58, y: 0.28, kind: 'academic' },
  { name: 'Admin Building', x: 0.78, y: 0.34, kind: 'admin' },
  { name: 'Boys Hostel A', x: 0.14, y: 0.62, kind: 'residential' },
  { name: 'Girls Hostel B', x: 0.32, y: 0.7, kind: 'residential' },
  { name: 'Central Cafeteria', x: 0.5, y: 0.55, kind: 'utility' },
  { name: 'Sports Complex', x: 0.72, y: 0.66, kind: 'sports' },
  { name: 'Power Substation', x: 0.86, y: 0.58, kind: 'utility' },
  { name: 'Water Treatment Unit', x: 0.44, y: 0.84, kind: 'utility' },
]

/* Configurable demo escalation thresholds (hours) by priority. */
export const ESCALATION_THRESHOLDS: Record<Priority, number> = {
  Low: 72,
  Medium: 48,
  High: 24,
}

const COMPLAINTS_KEY = 'campusfix:complaints'
const SEED_KEY = 'campusfix:seeded'
const SESSION_KEY = 'campusfix:sessionSid'

/* ---------- Storage ---------- */

export function loadComplaints(): Record<string, Complaint> {
  try {
    const raw = localStorage.getItem(COMPLAINTS_KEY)
    return raw ? (JSON.parse(raw) as Record<string, Complaint>) : {}
  } catch {
    return {}
  }
}

export function saveComplaints(data: Record<string, Complaint>) {
  try {
    localStorage.setItem(COMPLAINTS_KEY, JSON.stringify(data))
  } catch {
    /* ignore */
  }
}

export function allComplaints(): Complaint[] {
  return Object.values(loadComplaints()).sort((a, b) => b.createdAt - a.createdAt)
}

export function upsertComplaint(c: Complaint) {
  const all = loadComplaints()
  all[c.id] = c
  saveComplaints(all)
}

/* ---------- Session student ID (for one-vote-per-student) ---------- */

export function getSessionSid(): string {
  try {
    return localStorage.getItem(SESSION_KEY) || ''
  } catch {
    return ''
  }
}

export function setSessionSid(sid: string) {
  try {
    localStorage.setItem(SESSION_KEY, sid)
  } catch {
    /* ignore */
  }
}

/* ---------- ID generation ---------- */

export function generateId(): string {
  const year = new Date().getFullYear()
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const digits = '0123456789'
  let code = ''
  for (let i = 0; i < 2; i++) code += chars[Math.floor(Math.random() * chars.length)]
  for (let i = 0; i < 2; i++) code += digits[Math.floor(Math.random() * digits.length)]
  return `CFX-${year}-${code}`
}

export function uniqueId(): string {
  const existing = loadComplaints()
  let id = generateId()
  while (existing[id]) id = generateId()
  return id
}

/* ---------- Formatting ---------- */

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const h = Math.floor(diff / 3600000)
  if (h < 1) return 'Just now'
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

export function statusBadgeClass(status: Status): string {
  if (status === 'Pending') return 'badge--pending'
  if (status === 'In Progress') return 'badge--in-progress'
  return 'badge--resolved'
}

export function priorityBadgeClass(p: Priority): string {
  if (p === 'High') return 'badge--high'
  if (p === 'Medium') return 'badge--medium'
  return 'badge--low'
}

export function advanceStatus(c: Complaint, note?: string): Complaint {
  const idx = STATUS_ORDER.indexOf(c.status)
  if (idx >= STATUS_ORDER.length - 1) return c
  const next = STATUS_ORDER[idx + 1]
  c.status = next
  if (next === 'Resolved' && !c.resolvedAt) {
    c.resolvedAt = Date.now()
    c.resolutionNotes = note || 'Issue addressed and verified.'
  }
  c.history.push({ status: next, timestamp: Date.now(), note })
  return c
}

export function setPriority(c: Complaint, p: Priority): Complaint {
  c.priority = p
  return c
}

/* ---------- Escalation ---------- */

export function ageHours(c: Complaint): number {
  return (Date.now() - c.createdAt) / 3600000
}

export function isOverdue(c: Complaint): boolean {
  if (c.status === 'Resolved') return false
  return ageHours(c) > ESCALATION_THRESHOLDS[c.priority]
}

export function escalationLevel(c: Complaint): 'none' | 'warning' | 'critical' {
  if (c.status === 'Resolved') return 'none'
  const age = ageHours(c)
  const threshold = ESCALATION_THRESHOLDS[c.priority]
  if (age > threshold) return 'critical'
  if (age > threshold * 0.75) return 'warning'
  return 'none'
}

/* ---------- Location normalization for heatmap ---------- */

export function normalizeLocation(loc: string): string {
  const lower = loc.toLowerCase()
  const match = CAMPUS_LOCATIONS.find((l) => lower.includes(l.name.toLowerCase()))
  return match ? match.name : loc
}

export function locationCoord(loc: string): CampusLocation | null {
  const name = normalizeLocation(loc)
  return CAMPUS_LOCATIONS.find((l) => l.name === name) || null
}

/* ---------- Seeding demo data ---------- */

const DEMO_NAMES = [
  'Aarav Sharma', 'Diya Patel', 'Rohan Mehta', 'Ananya Iyer', 'Kabir Nair',
  'Sara Khan', 'Vivaan Reddy', 'Ishita Verma', 'Arjun Gupta', 'Meera Joshi',
]
const DEMO_SIDS = ['CS21B045', 'EC20B012', 'ME22B078', 'IT21B033', 'EE19B091', 'CE22B056']

const DEMO_DESCRIPTIONS: Record<string, string[]> = {
  Electricity: [
    'Tube light flickering in lab since two days, causing eye strain.',
    'Power outage in corridor every evening around 6pm.',
    'Faulty switch near entrance gives a mild shock.',
  ],
  'Wi-Fi & Internet': [
    'Wi-Fi completely down in second floor, no connectivity for classes.',
    'Extremely slow internet speed in library, cannot access online resources.',
    'Dead zone in the back row of classroom, no signal at all.',
  ],
  'Water Supply': [
    'No water supply in washroom since morning.',
    'Water cooler dispensing warm water, not chilled.',
    'Leaking tap causing water wastage near canteen.',
  ],
  Cleanliness: [
    'Washroom not cleaned for three days, very unhygienic.',
    'Overflowing dustbin near staircase attracting insects.',
    'Corridor floor sticky and needs mopping.',
  ],
  Infrastructure: [
    'Crack in the stair railing, safety hazard.',
    'Broken window pane in classroom letting in rain.',
    'Wall plaster peeling off near entrance.',
  ],
  'Classroom Facilities': [
    'Projector not working, cannot conduct presentations.',
    'Air conditioner leaking water onto desks.',
    'Broken chair could cause injury.',
  ],
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function seedDemoData() {
  const now = Date.now()
  const data: Record<string, Complaint> = {}
  let counter = 0
  for (const category of CATEGORIES) {
    const descs = DEMO_DESCRIPTIONS[category] || ['Issue reported in this area.']
    const count = 2 + Math.floor(Math.random() * 2) // 2-3 per category
    for (let i = 0; i < count; i++) {
      const loc = pick(CAMPUS_LOCATIONS).name
      const ageHoursSeed = Math.floor(Math.random() * 120) // 0-120h ago
      const createdAt = now - ageHoursSeed * 3600000
      let status: Status = 'Pending'
      let resolvedAt: number | null = null
      const r = Math.random()
      if (r > 0.55) {
        status = 'In Progress'
      } else if (r > 0.25) {
        status = 'Resolved'
        resolvedAt = createdAt + (Math.random() * 20 + 4) * 3600000
      }
      const priority: Priority = pick(['Low', 'Medium', 'High'] as const)
      const id = `CFX-2026-D${String(counter).padStart(2, '0')}`
      counter++
      const voters = DEMO_SIDS.slice(0, Math.floor(Math.random() * 4))
      const history: StatusEvent[] = [{ status: 'Pending', timestamp: createdAt }]
      if (status === 'In Progress') history.push({ status: 'In Progress', timestamp: createdAt + 3600000 * 2 })
      if (status === 'Resolved' && resolvedAt) {
        history.push({ status: 'In Progress', timestamp: createdAt + 3600000 * 2 })
        history.push({ status: 'Resolved', timestamp: resolvedAt, note: 'Issue addressed by maintenance team.' })
      }
      data[id] = {
        id,
        name: pick(DEMO_NAMES),
        sid: pick(DEMO_SIDS),
        category,
        location: loc,
        description: pick(descs),
        status,
        priority,
        department: departmentFor(category),
        createdAt,
        resolvedAt,
        upvotes: voters.length + Math.floor(Math.random() * 8),
        voters,
        history,
        resolutionNotes: status === 'Resolved' ? 'Issue addressed and verified by maintenance team.' : null,
      }
    }
  }
  saveComplaints(data)
}

export function ensureSeeded() {
  try {
    if (!localStorage.getItem(SEED_KEY)) {
      seedDemoData()
      localStorage.setItem(SEED_KEY, '1')
    }
  } catch {
    /* ignore */
  }
}

/* Allow re-seeding on demand (used by demo controls). */
export function reseedDemoData() {
  seedDemoData()
  try {
    localStorage.setItem(SEED_KEY, '1')
  } catch {
    /* ignore */
  }
}
