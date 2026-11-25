/* ============================================================
   Feature 2: Smart Issue Intelligence (rule-based, NOT AI/ML)
   Analyzes the issue description to suggest category + priority
   and detect potential duplicate complaints.
   ============================================================ */

import {
  Complaint,
  Priority,
  CATEGORIES,
  allComplaints,
} from './store'

interface KeywordRule {
  category: string
  keywords: string[]
}

const CATEGORY_RULES: KeywordRule[] = [
  { category: 'Electricity', keywords: ['power', 'electric', 'light', 'tube', 'bulb', 'fan', 'switch', 'outage', 'shock', 'wiring', 'voltage', 'socket'] },
  { category: 'Wi-Fi & Internet', keywords: ['wifi', 'wi-fi', 'internet', 'network', 'router', 'signal', 'connectivity', 'slow', 'dead zone', 'lan', 'browsing', 'online'] },
  { category: 'Water Supply', keywords: ['water', 'tap', 'leak', 'cooler', 'supply', 'pipe', 'drainage', 'flooding', 'flush', 'warm water', 'chilled'] },
  { category: 'Cleanliness', keywords: ['clean', 'dustbin', 'trash', 'garbage', 'washroom', 'toilet', 'dirty', 'hygiene', 'mop', 'sweep', 'odor', 'smell'] },
  { category: 'Infrastructure', keywords: ['crack', 'wall', 'ceiling', 'stair', 'railing', 'window', 'pane', 'plaster', 'floor', 'building', 'paint', 'roof'] },
  { category: 'Classroom Facilities', keywords: ['projector', 'ac', 'air conditioner', 'chair', 'desk', 'board', 'whiteboard', 'computer', 'lab equipment', 'speaker'] },
]

const PRIORITY_RULES: { priority: Priority; keywords: string[] }[] = [
  { priority: 'High', keywords: ['emergency', 'shock', 'fire', 'smoke', 'safety', 'hazard', 'injury', 'dangerous', 'spark', 'leak', 'flood', 'broken', 'crack', 'not working', 'completely down', 'outage'] },
  { priority: 'Medium', keywords: ['slow', 'flickering', 'warm', 'dirty', 'overflow', 'noisy', 'faulty', 'damaged', 'wastage', 'unhygienic'] },
]

export interface IntelligenceResult {
  category: string | null
  categoryReason: string
  priority: Priority
  priorityReason: string
  similar: Complaint[]
  matchedKeywords: string[]
}

function lower(s: string): string {
  return s.toLowerCase()
}

function tokenize(text: string): string[] {
  return lower(text).split(/[^a-z0-9&-]+/).filter(Boolean)
}

export function analyzeIntelligence(description: string, location: string): IntelligenceResult {
  const text = lower(`${description} ${location}`)
  const matched: string[] = []

  // Category detection — score by keyword hits
  let bestCat: string | null = null
  let bestScore = 0
  let bestHits: string[] = []
  for (const rule of CATEGORY_RULES) {
    const hits = rule.keywords.filter((k) => text.includes(k))
    if (hits.length > bestScore) {
      bestScore = hits.length
      bestCat = rule.category
      bestHits = hits
    }
  }
  if (bestHits.length) matched.push(...bestHits)

  const categoryReason = bestCat
    ? `Matched keywords: ${bestHits.map((k) => `"${k}"`).join(', ')}.`
    : 'No category keywords detected — please pick one manually.'

  // Priority detection
  let priority: Priority = 'Low'
  let priorityHits: string[] = []
  for (const rule of PRIORITY_RULES) {
    const hits = rule.keywords.filter((k) => text.includes(k))
    if (hits.length > priorityHits.length) {
      priority = rule.priority
      priorityHits = hits
    }
  }
  if (priorityHits.length) matched.push(...priorityHits)
  const priorityReason = priorityHits.length
    ? `Flagged by keywords: ${priorityHits.map((k) => `"${k}"`).join(', ')}.`
    : 'No urgency keywords detected — defaulting to Low priority.'

  // Duplicate detection — same category + shared keywords in description,
  // OR same location + same category. Score similarity.
  const similar = findSimilar(description, bestCat, location)

  return {
    category: bestCat,
    categoryReason,
    priority,
    priorityReason,
    similar,
    matchedKeywords: Array.from(new Set(matched)),
  }
}

export function findSimilar(description: string, category: string | null, location: string): Complaint[] {
  const descTokens = new Set(tokenize(description))
  const all = allComplaints().filter((c) => c.status !== 'Resolved')
  const scored = all.map((c) => {
    let score = 0
    if (category && c.category === category) score += 2
    if (location && location.trim() && lower(c.location).includes(lower(location.trim()))) score += 2
    const cTokens = new Set(tokenize(c.description))
    let overlap = 0
    cTokens.forEach((t) => {
      if (descTokens.has(t) && t.length > 3) overlap++
    })
    score += Math.min(overlap, 4)
    return { c, score }
  })
  return scored
    .filter((s) => s.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((s) => s.c)
}

/* Suggest a category based on a partial keyword (used for quick hints). */
export function suggestCategory(keyword: string): string | null {
  const k = lower(keyword)
  if (!k) return null
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => kw.includes(k) || k.includes(kw))) return rule.category
  }
  return null
}

export const CATEGORY_LIST = CATEGORIES
