# GatherWell — Social Event Guest & Registration Management

A single-organization Next.js 15 / React 19 / TypeScript organizer-only application following the October 2026 *Social Event Guest & Registration Management — Technical Overview* and the forest-green accessible HTML wireframes.

**Scope:** manage internal event registration records, CSV/XLSX imports, guests, meals, table seating, reports, cloning, and external registration/payment status labels. **Not a public ticket checkout or payment processing product.**

## Requirements

- Node.js 22 or later, npm (the database transaction driver uses Node's built-in WebSocket; `package.json` declares `engines.node >= 22` so Vercel picks a matching runtime)
- Neon PostgreSQL database
- Vercel account for hosting
- GitHub account for source control
- A strong Better Auth secret
- Optional: a Sentry project for error monitoring

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Neon connection string |
| `BETTER_AUTH_SECRET` | Yes | Signs sessions; long random string |
| `BETTER_AUTH_URL` | Yes | Exact app URL (e.g. `http://localhost:3000`, or your HTTPS domain). Also used to build invitation and password reset links |
| `NEXT_PUBLIC_APP_URL` | Yes | Same as `BETTER_AUTH_URL` |
| `BOOTSTRAP_ADMIN_EMAIL` | Yes | The only email that may sign up without an invitation and create the organization |
| `NEXT_PUBLIC_SENTRY_DSN` | No | Turns on Sentry error reporting |
| `SENTRY_PROJECT` | No | Sentry project slug (org is `amyas-organisation`, set in `next.config.ts`) |
| `SENTRY_AUTH_TOKEN` | No | Vercel only, never in `.env`. Uploads source maps so Sentry shows readable code locations |

Authentication is self-hosted Better Auth: users, sessions and hashed passwords live in this app's own `user`, `session`, `account` and `verification` tables. Neon's managed Auth (`NEON_AUTH_BASE_URL`) is **not** used.

## Local setup

```bash
npm install
# Create .env with the variables above
npm run db:push
npm run dev
```

Visit `http://localhost:3000/login`, create an account with the same email address as `BOOTSTRAP_ADMIN_EMAIL`, and initialize your single organization. This user is the owner. GatherWell only allows the first organization to be created; all staff and events belong to that organization. As owner, create an invitation link from Staff & Access and share it privately. **Sign-up is invite-only**: apart from the bootstrap email, an account can only be created for an email with an open, unexpired invitation.

The owner email is just a login name; it does not need to be a real mailbox because the app never sends email.

Optional demo event, after bootstrap:

```bash
npm run seed
```

## Deployment to Vercel

1. Create a private GitHub repository and push the **project contents**. Never commit `.env`.
2. Import your repository as a Next.js project in Vercel. Configure the environment variables above using actual credentials.
3. Set `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` to your exact HTTPS Vercel/custom domain.
4. Apply the database schema **before** opening production: locally `npm run db:push` with production `DATABASE_URL` (read its proposed changes before confirming), or use generated reviewed migrations with `npm run db:generate && npm run db:migrate`. This includes the `rate_limit` table used for login rate limiting.
5. Deploy and sign in with the bootstrap owner email.
6. Configure backups/retention in Neon and access restrictions on GitHub and Vercel.

## Accounts, roles and passwords

| | Owner | Manager | Viewer |
|---|---|---|---|
| Edit events, registrations, guests, seating, meals | Yes | Yes | No (read-only, dietary notes hidden) |
| Invite staff, cancel invitations | Yes | No | No |
| See staff list and Change history | Yes | Yes | No |
| Change a staff member's role (manager/viewer) | Yes | No | No |
| Remove staff | Anyone except themself | Viewers only | No |
| Create password reset links | Anyone | Viewers only | No |
| Change own password | Yes | Yes | Yes |

Nobody can be made owner from the app, and the owner cannot be removed. Removing a staff member deletes their login (ending their sessions); they can be invited again later.

**Forgotten passwords (no email service).** There is no "Forgot password?" email flow. Instead, an owner or manager opens **Staff & access → Staff members → Create reset link** and shares the link privately. The link opens `/login?token=…`, lets the person choose a new password, works once, expires after 1 hour, and signs them out everywhere. Creating a new link cancels any earlier one. Reset tokens are stored hashed. If the owner is locked out, run this from the project folder with the right `DATABASE_URL`:

```bash
npm run reset-link -- owner@example.org
```

**Changing ownership** has no button. If needed, update `members.role` in the Neon SQL editor (promote the new owner first, then demote the old one).

**Login rate limiting** (production only) is stored in the `rate_limit` table, so limits hold across Vercel's serverless instances: 3 sign-in attempts per 10 seconds per IP.

## Modules

- Events: create/edit/clone; copying configuration never copies registrations or history.
- Registrations: manual purchaser records and recorded status from external sources, capacity check.
- Imports: browser parses .csv/.xls/.xlsx; previews new vs duplicate vs review; server revalidates; unchanged external identifiers are skipped; original files are not retained. Each import is all-or-nothing.
- Guests: individual guest rows, meal options, dietary notes and seating preferences. **Remove guest** (Edit guest page) clears their seat and lowers the registration's ticket quantity by one; the last guest on a registration can't be removed (cancel the registration instead).
- Seating: table count and capacity; unique guest/seat database constraints; print table rosters.
- Meals: configurable event options and missing-meal reports.
- Reports: US Letter browser print / PDF and Excel download with spreadsheet formula escaping.
- Staff & access: invitations, staff list, roles, removal, reset links, change own password.
- Change history: the latest 200 audited changes (who, what, event, details) for owners and managers.

## Data integrity

Reads use Neon's HTTP driver. Multi-step writes (events, cloning, registrations, imports, seating, meals, tables, guest and staff removal, invitation acceptance, bootstrap) run in a database transaction through a short-lived WebSocket pool (`transaction()` in `src/db/index.ts`), so a failure part-way leaves nothing half-saved. Writes that check capacity lock the event row first, so simultaneous edits can't overbook an event.

## Error monitoring (Sentry)

Sentry captures browser errors, server errors (`src/instrumentation.ts`) and page crashes (`src/app/global-error.tsx`). Expected API errors (bad input, permissions, conflicts) are returned to the user and not reported; unexpected ones are sent to Sentry and the user sees a generic message. `sendDefaultPii` is off and session replay is not enabled, so guest details are not sent. Sentry stays off until `NEXT_PUBLIC_SENTRY_DSN` is set; restart the dev server after changing `.env`. Errors typed into the browser console are not reported, and ad blockers can block browser reports.

## Known production-readiness work

This is a functional implementation starter, **not a certified production release**. Perform a full review before storing sensitive attendee data. Remaining follow-ups: an automated test suite; formal WCAG 2.2 AA evaluation; backups/restore drills; reliable external registration format mapping; and warnings for duplicate invitations or re-inviting an existing staff member. No integrations with external platforms or payment services are configured.

## Reference materials

- `Social_Event_Guest_Management_Technical_Overview.pdf` — primary technical and scope source
- `Social_Event_Management_FULL_Interactive_Wireframes.html` — UI reference

## Privacy

No uploaded source file is retained. Browser sends normalized rows (names and contact data) to Neon for persistence; imported original files stay in the browser. Access to a stored event requires organizational membership. Dietary notes are hidden from viewers; only owners and managers can see or edit them.

## Confirmed deployment decisions (October 2026)

- Product name: **GatherWell**.
- Organization model: **one organization only**. Initialize it once using `BOOTSTRAP_ADMIN_EMAIL`; additional organizers and event-day helpers are invited as staff.
- A single organization can create and clone many events, each with separate registrations and historical records.
- Keep organization IDs as foreign keys for record ownership and access checks; the app does not expose additional organization creation after initial setup.
- Authentication stays self-hosted (Better Auth in this app), with no email delivery.
