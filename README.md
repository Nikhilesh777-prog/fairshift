# FairShift — Decent work, made visible

FairShift is a responsive worker-and-admin demo for frontline teams. It brings shifts, pay, safety, anonymous feedback, skill records and wellbeing cues into one calm, accessible workspace. Construction and College-Campus organizations use the same app with sector-specific labels, shift locations and safety categories.

## Try the live demo

Open the project Preview, choose **Try Worker Demo** or **Try Admin Demo**, and use the floating **Demo Switcher** to change role or industry without returning to sign-in.

| Role | Industry | Username | Password |
| --- | --- | --- | --- |
| Worker | Construction | `worker.build` | `ShiftReady8!` |
| Admin | Construction | `admin.build` | `FairTeam8!` |
| Worker | Campus | `worker.campus` | `ShiftReady8!` |
| Admin | Campus | `admin.campus` | `FairTeam8!` |

The accounts are seeded with salted scrypt password hashes. The demo switcher is a review convenience, not an open sign-up flow. Public passport links have random tokens and reveal only the owner's display name and entries they marked shareable; schedule, pay, team and organisation details are not returned by the public passport API.

## Run and build

Requirements: Node.js 22 or later, pnpm, and the configured FairShift managed MySQL database. The Webdev project loads its managed `DATABASE_URL` at runtime; never commit a real connection string.

```bash
pnpm install
pnpm db:migrate   # create the versioned schema and seed once
pnpm dev          # local app + API on port 3000
pnpm typecheck
pnpm build
pnpm start        # serve the production client and API
```

The first migration creates both demo organisations, four demo accounts, 30 days of weekday shift data, two periods of pay data, safety examples, anonymous feedback, skills and aggregate mood examples. Migration `002_private_passport_tokens` rotates seeded passport identifiers to high-entropy, URL-safe tokens; migration `003_anonymous_participant_receipts` adds the separate keyed receipt tables used for distinct-participant thresholds; migration `004_inr_demo_pay` converts only the two seeded demo organisations to Indian-rupee pay units, and `005_inr_payslip_reconcile` makes each demo payslip's base, overtime and deductions reconcile to net pay. Migrations are idempotent and leave unrelated organisations untouched. Local `.env` files are ignored by Git; provide your own managed database connection only in an approved environment.

## Architecture

- `src/pages/` holds lazy-loaded landing, sector explainer, sign-in, worker, admin and public Passport routes.
- `src/components/` contains the worker/admin shells, navigation, QR scanner, accessible forms, notifications, voice/help and demo switcher.
- `src/features/shifts/hours.ts` splits regular/overtime hours against the shorter of the scheduled duration or eight-hour threshold. `src/features/safety/compressPhoto.ts` prepares smaller JPEG evidence before upload.
- `src/data/api.ts` is the typed client data-access boundary. It scopes local read caches and queued actions to the active worker/admin identity, avoids storing sign-in passwords, and replays queued operations only when the server session matches.
- `server/auth.ts` validates demo login, hashes credentials, rate-limits sign-in and issues an opaque high-entropy session cookie configured for the HTTPS Preview iframe.
- `server/routes.ts` performs input validation and server-side role and organization checks. Feedback and mood response rows have no employee/account/session column. Separate receipt tables contain only a keyed one-way participant token, team and reporting period; they prevent one worker from inflating a group, cannot show an admin that worker's response, and enforce one feedback entry per month and one private mood entry per day. Ratings appear only for periods with five distinct participants; themes also require at least two mentions.
- `server/database.ts` owns managed MySQL DDL, migrations, seeds, salted hashes and query helpers. This replaces the requested Supabase option because a Manus-managed database was provisioned for the project; authorization is enforced by the app server rather than MySQL row-level policies.
- `src/locales/en.json`, `hi.json`, `ta.json` and `src/lib/i18n.ts` support English, Hindi and Tamil navigation, voice prompts and key worker content.
- `public/manifest.webmanifest`, `public/sw.js` and `public/offline.html` provide an installable shell and offline fallback. Previously read API results are cached in the browser; actions can be queued locally and sync after the original signed-in identity is restored.

## Feature notes

- Shift check-in/out accepts an organization-specific QR value. Use the built-in camera scanner where supported or choose **Simulate QR**. Location permission is optional.
- Pay uses Indian rupees (`₹`) with Indian digit grouping, and includes base, overtime, deductions, reconciled net pay, a change note, speech synthesis, an INR-labeled CSV download and print.
- Safety reports support text, browser speech recognition, compressed photos, a status tracker, assignment and manager comments.
- Anonymous feedback is aggregated; no feedback screen asks for an account identity. Mood check-ins are stored without an employee identifier and are only returned to admins as team trends after the minimum group size.
- The worker Wellbeing Hub has a demo emergency contact, private daily feeling check-in, shift-based water/break suggestions and an optional weather check; it never stores location.
- Attrition signals are transparent heuristics based on overtime, fatigue, absent shifts, feedback and unresolved safety reports, with reasons shown instead of an unexplained prediction.

## Two-minute demo script

See [`DEMO-SCRIPT.md`](./DEMO-SCRIPT.md) for a timed worker-and-admin walkthrough in both industries.
