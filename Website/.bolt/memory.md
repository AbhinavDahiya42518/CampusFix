# Project memory

## Product intent & audience

- Campus complaint reporting and management system
- Six core features: heatmap visualization, rule-based smart intelligence, community upvoting, escalation engine, impact analytics, QR-based reporting
- Includes demo seed data for initial state

## Brand personality & voice

- Not yet explicitly defined; inferred utilitarian, feature-focused tone from assistant responses

## Visual design & UX direction

- Background canvas element for visual layer
- Forms for complaint input
- Navigation with section links in `index.html`
- Canvas-based chart rendering for analytics (`src/analytics.ts`)
- All styling consolidated in `src/style.css`
- Modular architecture: one file per feature under `src/`

## Decisions, constraints & rationale

- Project root: `/home/project`
- TypeScript project; entry point `src/main.ts`
- Shared data model + localStorage persistence in `src/store.ts`
- Rule-based intelligence chosen for Feature 2 (not ML-based)
- File naming convention: feature-name files directly in `src/` (e.g., `heatmap.ts`, `intel.ts`, `community.ts`, `escalation.ts`, `analytics.ts`, `qr.ts`)
- Build had unresolved TypeScript errors (unused imports + type bug in `analytics.ts`) at last turn cutoff

## Open questions & assumptions

- Whether to finish fixing TypeScript build errors and get build passing (offered, not yet confirmed)
- No explicit `.bolt/prompt` instructions exist; all context is inferred from project state
- Brand voice, color palette, and typography not yet specified by user