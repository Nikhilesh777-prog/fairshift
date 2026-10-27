# FairShift — Implementation and Design Plan

## Product and implementation decisions

FairShift will be a responsive, installable web app for the requested four demo identities (worker/admin in Construction and Campus), with distinct mobile-first worker and desktop-first admin experiences. Every navigation item and control will lead to a working view or action; browser-only capabilities will have a clear fallback rather than a dead end.

The initialized project has a managed MySQL database and server enabled. Use that available persistent database (rather than a Supabase instance, for which no project credentials were supplied), with deterministic idempotent SQL schema migrations and a transaction-protected first seed in `server/database.ts`, through the lightweight `mysql2` driver. A typed frontend data facade at `src/data/api.ts` keeps components independent of the storage implementation; it calls the app API, caches successful reads in localStorage, and holds deferred non-auth actions there until connectivity returns. Offline sign-in and demo switching use the four explicit demo identities; cached data remains available after it has been read once. The backend enforces role and organization permissions; no database writes will be performed as acceptance-test cleanup because development and production share this database.

Demo credentials will be seeded with salted scrypt password hashes (not plaintext), server-side sessions and rate-limited, validated sign-in. This is the explicitly requested demo-account flow, not a public sign-up system. Worker/admin route and API guards will be enforced server-side. Feedback and mood response rows will never contain an account, user ID or session identifier. Separate keyed one-way participant receipts support duplicate prevention and distinct-member thresholds without linking any receipt to an individual response. Admins see only organization/team aggregates and themes; no score/theme detail is returned below five distinct participants. User-entered text will be length-limited and escaped/sanitized at the display boundary.

QR check-in will use the device camera where permission and browser support exist, plus the requested Simulate QR action. Speech recognition and speech synthesis will use browser APIs when supported and retain text/visual controls otherwise. Optional location and weather use will require user permission; the app will not block normal check-in if these are unavailable. Heat reminders will use a public forecast when available and a plainly labeled manual heat toggle/fallback otherwise. Photos will be resized/compressed in the browser before submission. A public skill-passport route will expose only fields intentionally marked shareable.

## Project structure

- `src/components/`: accessible design primitives, app shell, navigation, charts, feedback/status components and dialogs.
- `src/pages/`: landing, sector explainer, authentication, worker pages, admin pages and public read-only passport route; routes will be lazy loaded.
- `src/features/`: focused shift/timekeeping, pay, safety, anonymous feedback, skill passport, fatigue, wellbeing and analytics modules.
- `src/data/api.ts`: typed client-side data-access facade, account-scoped localStorage cache, offline demo identity and scoped retry queue.
- `server/`: Express API routes, salted-hash demo authentication/session middleware, server-side role/organization authorization, managed MySQL access and migration/seed scripts.
- `server/database.ts`: idempotent versioned SQL schema, first-run seed, safe query helpers and password-hash functions for both organizations and four demo accounts plus realistic supporting records.
- `src/locales/en.json`, `hi.json`, `ta.json`: screen labels, voice prompts, rights card and user-facing messages.
- `public/`: route manifest, app icons, web manifest and service worker/offline shell assets.
- Landing and sector photos: bespoke FairShift artwork in Managed Storage, referenced at its returned `/manus-storage/` URL in the intended page placement.
- `README.md`: setup, database/migrations, demo credentials, architecture and a timed two-minute worker/admin demo script covering both industries.

## Design direction

**Design Movement:** Human-centered civic SaaS with the clarity of an editorial field guide. **Core Principles:** dignified rather than surveillant; one obvious next action; transparent pay and status; forgiving offline and accessibility behavior.

**Color Philosophy:** warm paper and ink keep long shifts readable; FairShift evergreen remains the trust anchor, while the site-work grade moves through pine, copper and saffron, and the campus grade through indigo, cobalt and clear sky. Mint and lilac soften wellbeing and skill moments; coral is reserved for urgent safety states. Gradients act like editorial light around key panels, not decoration behind every card. Status colors retain text/icon labels as well as color. **Signature Brand Color:** FairShift evergreen `#176B52`.

**Layout Paradigm:** a generous, vertically flowing landing story; a compact fixed five-action worker dock on small screens; and a collapsible admin rail with KPI-to-insight reading order on larger screens. Cards group one decision at a time, with a responsive linear layout instead of a dense dashboard grid on phones.

**Signature Elements:** an original equal-shift/checkmark wordmark; documentary photography with generous rounded crops; and a fine “shift line” motif connecting status steps. Construction uses warm copper/amber labels and Campus uses cool indigo/sky labels without fragmenting the core brand. **Interaction Philosophy:** immediate, kind confirmation, undo where practical, no shame language, and no permission prompt until the user starts the feature that needs it. **Animation:** short opacity/position transitions and subtle progress fills; no looping decoration, confetti only on a first successful check-in, and reduced-motion preferences always respected.

**Typography System:** Inter/system sans for Latin, with Noto Sans Devanagari and Noto Sans Tamil fallbacks; body text starts at a legible 16px, key worker actions use large labels and 48px minimum targets. **Brand Essence:** a fair-work companion that makes hours, pay and wellbeing visible for frontline teams; trustworthy, humane, practical. **Brand Voice:** plain, respectful and specific. Examples: “Your hours are clear. Your pay should be too.” / “Need a hand? Tell us what happened.” **Wordmark & Logo:** a custom equal-sign/check motif joined into a compact “F” glyph, paired with a carefully weighted FairShift wordmark; not a default-font logo.

## Build workflow

1. **Foundation:** register TypeScript diagnostics; add the pinned React/TypeScript/Tailwind toolchain and component system; define theme, iconography, route manifest, localized shell, industry configuration, demo login/session and the floating demo switcher; build the landing page, sector explainer and guided tour.
2. **Shifts and pay:** add typed persistence/schema and both-industry 30-day seed data; build worker weekly timeline, camera/Simulate QR check-in/out, regular/overtime calculation, fatigue notices, payslip breakdown, listen, download/print, change note and rest-day streak.
3. **Safety, feedback and skills:** implement accessible safety category/text/voice/photo reporting and full submitted-to-resolved tracking; admin assign/update/comment/close controls; anonymous minimum-five feedback aggregates; worker skill passport, admin add/verify, and safe public share links/QR.
4. **Welfare and admin insights:** implement SOS contact card, private mood check-in, hydration/break cues, optional weather/heat context and rights card; admin dashboard KPIs/charts, attendance/overtime, safety, fatigue watchlist, anonymous welfare/feedback trends, team attrition heuristic with visible reasons, and suggested actions.
5. **Finish and delivery:** complete English/Hindi/Tamil screen coverage, keyboard/focus/reduced-motion and contrast polish, responsive/dark mode, loading/empty/error/toast states, offline cache/queue and installable PWA behavior; add README and the requested two-minute demo script. Run type/lint/build checks, fix actionable diagnostics, verify the route manifest, API authorization and principal flows, then checkpoint to the canonical project repository. Publishing is separate and will not be enabled automatically.

The app's page routes will include `/`, `/sectors`, `/login`, `/worker`, `/worker/shifts`, `/worker/pay`, `/worker/safety`, `/worker/me`, `/worker/wellbeing`, `/worker/feedback`, `/worker/skills`, `/admin`, `/admin/safety`, `/admin/feedback`, `/admin/skills`, `/admin/people`, and `/passport/:token`; the static route manifest will be kept in sync.
