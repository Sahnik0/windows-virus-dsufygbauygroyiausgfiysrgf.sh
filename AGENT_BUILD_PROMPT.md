# Agent Build Prompt — Enterprise Carpooling Platform Backend

## How to use this document

You are an autonomous coding agent. This document is your complete spec. Work through **Phases 0–10 in order**. Do not skip ahead, do not build features from a later phase early, and do not invent features not listed here.

### Work in tasks, not in phases

A phase is a unit of *planning*, not a unit of *execution*. Never generate an entire phase's code in a single pass. Each phase's "Build" section is already broken into named units (a route group, a schema addition, a middleware file, a service) — treat each of those as one task, and finish tasks one at a time in this loop:

1. **State the task** — one or two sentences on what you're about to build and why, before writing code. If a task is bigger than "one file, or one tightly-related group of 2-3 files," split it further yourself; don't wait for this document to pre-chunk it smaller than it already is.
2. **Write only that task's code.**
3. **Re-read what you just wrote against the spec for that task** — not the whole phase, just the piece you touched. Check it actually does what was asked, not something adjacent that looks similar.
4. **Run whatever check applies** — a quick manual call, a syntax/type check, whatever's cheapest that would catch a real mistake. Don't defer every check to the phase's end-of-phase verification step; that step exists to confirm the phase holds together as a whole, not to be the first time any code gets exercised.
5. **Only then move to the next task.**

A phase is done when every task inside it is done this way *and* the phase's own "Verification" section passes end-to-end. If a task-level check fails, fix it before starting the next task — don't stack a second task on top of code you haven't confirmed works, and don't carry a known-broken piece forward with a mental note to "fix it later." Later is where hallucinated fixes for half-remembered problems come from.

This applies whether or not you've been told to run all phases autonomously. Autonomy changes whether you *pause for a human* between phases — it never changes whether you build task-by-task within a phase.

### What "thoughtful code" means here, concretely

"Minimal, high-quality, no sloppy code" (Phase 0) is a standard, not a mood — hold every piece of code to these checks before considering a task finished, not just at review time:

- **Every line has a reason to exist.** If you can't say in one sentence why a line is there, it shouldn't be there. This includes: no defensive checks against conditions that can't actually occur given the code above them, no parameters or config options nothing calls, no abstraction covering a second use case that doesn't exist yet.
- **Comments explain *why*, not *what*.** `// increment counter` above `counter++` is noise — delete it. A comment earns its place by explaining a non-obvious constraint, a tradeoff, or a "this looks wrong but isn't, because X" — the kind of thing a competent reader would otherwise have to reverse-engineer.
- **Names say what the thing is**, not what type it is or how it's used. `pendingJoinRequests`, not `data` or `arr2`.
- **Error handling is specific to what can actually fail at that line**, not a blanket try/catch wrapping ten unrelated operations with one generic error message.
- **No copy-pasted near-duplicates.** If the same 10 lines show up in two services, that's a signal to extract a shared helper — but only if a *third* real use case doesn't need to exist first to justify it; two occurrences is the right time to consider it, not before.
- Before marking a task done, reread the code once as if you were the reviewer, not the author, specifically looking for the laziest line in the file — the one you'd be least comfortable explaining. Fix or remove it.

If a task can't be done well within this bar in a reasonable amount of code, that's information the spec was wrong to compress it that small — flag it in `PROGRESS.md` rather than quietly shipping something sloppy to hit an artificial size target.

At the end of every phase:
1. Confirm every task inside the phase was completed via the task loop above, not generated in bulk.
2. Run the phase's verification step and confirm it passes.
3. Append a completed entry to `PROGRESS.md` (format defined in Phase 0).
4. Stop and wait for explicit go-ahead before starting the next phase, unless you have been told to run all phases autonomously — if so, still write the PROGRESS.md entry before moving on.

If you are ever unsure whether something is in scope, check the "Explicitly out of scope" list in Phase 0 before assuming it belongs in this build. If it's genuinely ambiguous and not covered anywhere in this document, stop and ask rather than guessing.

---

## Phase 0 — Scope, stack, and ground rules

### What you are building

The **backend only** for an enterprise carpooling platform, as a REST API. There is no frontend in this build. Source requirements come from the project's problem statement document — a PDF titled "Carpooling Platform." Most of Phases 1–9 traces back to that document. A separate set of product extensions — listed in the table below — do NOT come from the source doc and are called out explicitly wherever they change the build.

### Explicitly out of scope — do not build these

- Any frontend, mobile app, or UI of any kind.
- Push notifications (bonus feature in the source doc — skip entirely).
- Ride cancellation flows, intelligent ride-matching algorithms, or route optimization (all bonus features — skip).
- Actual WebRTC media relay/TURN infrastructure for voice calls — the backend's job is call **signaling** only (who's calling whom, ringing/accept/reject/end state). Audio itself is peer-to-peer between clients and is a frontend/client-SDK concern, not this backend's.
- Anything not described in this document. If you think of a "nice to have," do not add it. Flag it in `PROGRESS.md` under a "Deferred ideas" note instead and move on.

### Product extensions beyond the source document

The source doc is the primary spec, but it's incomplete or silent on several things this build actually needs. These are explicit, deliberate additions — not inferred, not hallucinated. Treat every row below as equally binding as anything in the PDF.

| Extension | One-line summary | Where it's built |
|---|---|---|
| Three-role model | `SUPER_ADMIN` / `ORG_ADMIN` / `USER` instead of the doc's two roles | Phase 0 (below), Phase 3, Phase 4 |
| ID-proof approval gate | New users can't log in until an Org Admin approves an uploaded ID document | Phase 3 |
| Price negotiation | Passenger and driver exchange counter-offers on fare before a booking can happen; separate from chat | Phase 6.5 |
| Request-to-join booking model | Booking is never instant — it's always a request that the *other* party must explicitly approve (passenger requests → driver approves; driver invites → passenger approves) | Phase 6 |
| Nearby pickup-point discovery | Drivers can see nearby passenger pickup points before publishing/adjusting a route; passengers can see nearby drivers | Phase 6 |
| In-trip chat & call signaling | The source doc already asks for this under Trip Management — the earlier draft of this prompt deferred it in error. Chat is fully built; calling is signaling-only | Phase 7 |

The source document's own two-role model, its single-step "search and book," and its silence on identity verification are all superseded by this table where they conflict. Where the source doc and this table don't conflict, the source doc still governs.

### Role model — read this carefully, it extends the source document

The source PDF only describes two roles: **Employee** and **Company Administrator**. This build uses **three roles**, per explicit product decision:

| Role | Scope | Belongs to an org? |
|---|---|---|
| `SUPER_ADMIN` | Platform-wide. Creates and manages Org Admins across all organizations. | No — exists outside the org hierarchy entirely. |
| `ORG_ADMIN` | One organization. Manages employee records, vehicles, and org-level settings for that org only. Equivalent to "Company Administrator" in the source doc, renamed for clarity against Super Admin. | Yes, exactly one. |
| `USER` | One organization. Equivalent to "Employee" in the source doc. Can offer rides and find rides — same person, same role, not separate account types. | Yes, exactly one. |

This breaks the source document's own assumption ("every user belongs to a registered organization") for the `SUPER_ADMIN` case specifically. That's a deliberate, scoped exception — do not generalize it. Every `ORG_ADMIN` and `USER` still belongs to exactly one org, no exceptions.

### Tech stack (fixed — do not substitute)

- **Runtime**: Node.js, Express.js
- **Database**: PostgreSQL (chosen over MySQL/SQLite — the reporting module needs decent aggregate query support, and Postgres is Prisma's best-supported target)
- **ORM**: Prisma
- **Auth**: JWT (access token + refresh token), role-based middleware
- **Real-time location, chat, and call signaling**: Socket.io (one server, multiple namespaces — see Phase 7)
- **Maps & routing**: OpenStreetMap. Two distinct things both fall under this, don't conflate them:
  - **Map display** (frontend concern, mentioned here only so the backend's contracts match what a map will actually consume): standard OSM raster/vector tiles, attribution required per OSM's terms. This backend just needs to return coordinates in the format any OSM-based map client (Leaflet, MapLibre, etc.) expects — plain WGS84 lat/lng, nothing OSM-specific to build server-side for this part.
  - **Routing** (this is what the backend actually calls): OSRM (Open Source Routing Machine), the routing engine that runs on OSM data. Use the public OSRM demo server (`router.project-osrm.org`) for this build via `web_fetch`/HTTP call from the service layer. State plainly in `API.md` that the public demo server is rate-limited and not meant for production traffic — if this goes past a hackathon/demo build, self-hosting OSRM against an OSM extract is the real next step, and that's a deliberate infra decision to make later, not something to silently assume now.
- **Payments**: Razorpay, test mode
- **File uploads**: Multer, local disk storage under `/uploads` (ID-proof documents only — see Phase 3 for why this isn't cloud storage in this build)
- **Containerization**: Docker Compose, for local Postgres only

### Database connection rule — read before Phase 1

Check `.env` for `DATABASE_URL` before touching Docker:
- **If `DATABASE_URL` is already set to a non-empty value** (e.g. a cloud Postgres instance — Supabase, Neon, RDS, etc.) → use it as-is. Do not start a local Postgres container. Do not overwrite the value.
- **If `DATABASE_URL` is empty or missing** → start Postgres via the `compose.yml` in this project (Phase 1) and populate `.env` with the resulting local connection string yourself.

This check happens once, at the start of Phase 1, and the agent must state out loud in `PROGRESS.md` which path it took and why.

### Code quality bar — non-negotiable, applies to every phase

- No speculative abstractions. Don't build a generic "repository layer" or "strategy pattern" because it might be useful later — build exactly what the current phase needs.
- No commented-out code left in files. No `TODO` placeholders unless the TODO is tracked in `PROGRESS.md` with a phase number.
- Every non-obvious function gets a short comment explaining *why*, not *what* — the code should already say what it does.
- Consistent file structure (defined below). Don't deviate per-module.
- Every error path returns a real, structured error — no silent failures, no bare `catch (e) { console.log(e) }`.
- If a phase's code exceeds roughly 300 lines for a single file, split it. No God files.

### Fixed project structure

```
/src
  /config          → env loading, prisma client singleton, socket.io setup, razorpay client
  /modules
    /auth
    /users
    /orgs
    /vehicles
    /rides
    /negotiations
    /trips
    /tracking
    /chat
    /calls
    /payments
    /wallet
    /reports
    /settings
  /middleware      → auth.middleware.js, role.middleware.js, error.middleware.js, validate.middleware.js
  /utils
  /jobs            → (only if a phase requires a background job — none currently do)
  app.js           → Express app assembly, no server.listen here
  server.js        → server.listen + socket.io attach, entry point
/prisma
  schema.prisma
  /migrations
/docs
  API.md           → hand-maintained, updated every phase (see Phase 10)
/uploads
  /id-proofs       → local disk storage for ID verification documents (Phase 3) — see note there on why local disk, not cloud storage, for this build
compose.yml
.env.example
PROGRESS.md
AGENTS.md          → this file's operational summary, written in Phase 0
```

Each module folder (e.g. `/rides`) contains exactly: `rides.routes.js`, `rides.controller.js`, `rides.service.js`, `rides.validation.js`. Controllers call services. Services contain business logic and Prisma calls. Controllers never touch Prisma directly. Routes never contain logic.

### PROGRESS.md format

Two levels: a running task log written *during* the phase (as you go, not reconstructed afterward from memory), and a phase summary written once at the end. The task log is what makes the task-by-task rule checkable — a phase summary with no task log behind it means there's no way to tell afterward whether phases were actually built task-by-task or generated in bulk and summarized after the fact.

```markdown
## Phase N — <name>

### Task log
- [x] <task name> — <one line: what it does> — verified: <what you checked>
- [x] <task name> — <one line> — verified: <what you checked>
- [ ] <task name> — blocked: <why>

### Phase summary
Status: Complete | Blocked | Deferred
Date: <date>
Verification run: <command> → <result>
Deferred ideas (if any): <bullet>
Blockers (if any): <bullet>
```

### AGENTS.md (write this now, in Phase 0)

Create `AGENTS.md` containing: the tech stack table above, the role model table above, the fixed project structure, and a one-line pointer to this document as the source of truth. This file exists so that if a future agent session picks up this codebase without full context, it can reorient in 30 seconds without re-reading this entire prompt.

### Verification for Phase 0
- `AGENTS.md` and `PROGRESS.md` exist.
- Project folder structure above exists (empty files are fine at this point).
- `PROGRESS.md` has a Phase 0 entry.

---

## Phase 1 — Environment, Docker, Prisma init

### Build

1. `compose.yml` (not the deprecated `docker-compose.yml` name) with a single `postgres` service:
   - Named volume for data persistence.
   - Sensible defaults (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`) sourced from `.env`, not hardcoded in the compose file.
   - Exposed on a mapped host port (avoid colliding with a default local Postgres install — use `5433:5432` unless `.env` says otherwise).
2. `.env.example` with every variable this project will ever need, populated with placeholder values and one-line comments. Include at minimum: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRY`, `JWT_REFRESH_EXPIRY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `OSRM_BASE_URL` (default `https://router.project-osrm.org` — kept as a config value, not hardcoded in `utils/routing.js`, specifically so swapping in a self-hosted OSRM instance later is a one-line env change, not a code change), `PORT`, `NODE_ENV`.
3. Apply the **database connection rule from Phase 0** now: check for existing `DATABASE_URL`, decide local-vs-cloud, document the decision in `PROGRESS.md`.
4. `npm init`, install: `express`, `@prisma/client`, `prisma` (dev), `jsonwebtoken`, `bcrypt`, `dotenv`, `zod` (for validation), `socket.io`, `razorpay`, `multer`, `cors`, `helmet`, `express-rate-limit`, `morgan` (dev only), `nodemon` (dev only).
5. `prisma init`, confirm `prisma/schema.prisma` exists with `provider = "postgresql"` and `url = env("DATABASE_URL")`.
6. Minimal `app.js`: Express instance, `helmet()`, `cors()`, `express.json()`, a single `/health` route returning `{ status: "ok" }`. No feature routes yet.
7. `server.js`: imports `app`, starts `http.createServer(app)`, attaches Socket.io to the same server (empty namespace for now — real handlers come in Phase 6), listens on `PORT`.

### Verification
- `docker compose up -d` starts Postgres cleanly (only if local path was taken).
- `GET /health` returns 200 with the expected body.
- `npx prisma validate` passes on the (currently near-empty) schema.

---

## Phase 2 — Prisma schema: Org, User, Vehicle

Build the schema in layers across Phases 2–5 rather than all at once. This phase covers the identity and org layer only.

### Models to define

**Org**
- `id`, `name`, `createdAt`, `updatedAt`
- Org-level config fields per the source doc's "carpooling settings": `fuelCostPerLitre` (Decimal), `costPerKmDefault` (Decimal) — used later by Reports.
- Relation: has many `User`, has many `Vehicle` (through User).

**User**
- `id`, `email` (unique), `passwordHash`, `firstName`, `lastName`, `phone`, `createdAt`, `updatedAt`
- `role` — enum `SUPER_ADMIN | ORG_ADMIN | USER`
- `orgId` — **nullable**, foreign key to `Org`. Nullable specifically and only for `SUPER_ADMIN`. Enforce the "non-null for ORG_ADMIN/USER" rule at the application layer (Phase 3 service logic), since Prisma can't express conditional nullability in the schema itself — note this explicitly as a code comment where the constraint is enforced.
- `verificationStatus` — enum `PENDING | APPROVED | REJECTED`, default `PENDING`. Applies to `USER` and `ORG_ADMIN` sign-ups (see Phase 3 for exactly who this gate applies to). `SUPER_ADMIN` is created directly in the database/seed, never through a gated flow, so default it to `APPROVED` for that role at creation time.
- `idProofPath` — nullable string, path to the uploaded document under `/uploads/id-proofs` (Phase 3).
- `idProofUploadedAt` — nullable DateTime.
- `rejectionReason` — nullable string, set by the approving admin if `verificationStatus = REJECTED` (Phase 3), so the user has some idea what to fix on resubmission.
- Relation: has many `Vehicle`, has many `SavedPlace` (Phase 5).

**Vehicle**
- `id`, `model`, `registrationNumber` (unique), `seatingCapacity` (Int), `ownerId` (FK to User), `createdAt`, `updatedAt`

### Migration
- `npx prisma migrate dev --name init_org_user_vehicle`

### Seed script
- `prisma/seed.js`: creates one `SUPER_ADMIN` (no org, `verificationStatus = APPROVED`), one `Org`, one `ORG_ADMIN` in that org (`APPROVED` — seeded admins don't need to go through their own approval flow), two `USER`s in that org (`APPROVED`, so Phase 5+ testing isn't blocked by the approval gate before Phase 3 even builds it), one `Vehicle` owned by one of the users. Passwords hashed with bcrypt, not plaintext. Wire into `package.json`'s `prisma.seed` field.

### Verification
- Migration applies cleanly against a fresh database.
- `node prisma/seed.js` runs without error and the rows exist (spot-check with `npx prisma studio` or a raw query).

---

## Phase 3 — Auth module, ID-proof approval gate, role middleware

This is the first feature module. Get the pattern right here since every later module repeats it. This phase is larger than a typical auth module because registration is no longer a single step — it's register → upload ID → wait for admin approval → login becomes possible.

### Who the approval gate applies to

`USER` self-registration only. `ORG_ADMIN` accounts are provisioned by `SUPER_ADMIN` (Phase 4) through an internal flow, not public sign-up, so they don't go through this gate — seed them and Phase-4-created admins as `APPROVED` directly. `SUPER_ADMIN` is never created through an API route at all in this build (see Phase 4).

### Build

**Routes** (`/api/v1/auth`)
- `POST /register` — creates a `USER` under a given `orgId` with `verificationStatus = PENDING`. Reject if `orgId` doesn't exist. Returns the created user record and a clear message that ID-proof upload is required next — **does not** return tokens, since the account can't log in yet.
- `POST /register/id-proof` — authenticated with a short-lived "pending" token issued by `/register` specifically for this purpose (not a full access token — it should only be usable for this one endpoint, since the account isn't approved yet). Multipart upload via Multer, accepts one image/PDF file, stores it under `/uploads/id-proofs/<userId>-<timestamp>.<ext>`, sets `idProofPath` and `idProofUploadedAt`. Reject file types outside a small allow-list (`jpg`, `jpeg`, `png`, `pdf`) and cap file size (e.g. 5MB) at the Multer config level, not after the fact.
- `POST /login` — email + password. **Reject with 403 and a clear message if `verificationStatus !== APPROVED`** — distinguish `PENDING` ("your ID proof is under review") from `REJECTED` ("resubmit — reason: `rejectionReason`") in the message, since these are different user actions. Only on `APPROVED` does this return `{ accessToken, refreshToken, user }`.
- `POST /refresh` — exchanges a valid refresh token for a new access token.
- `POST /logout` — invalidates the refresh token (store a `revokedAt` or use a short-lived refresh-token table — pick one, document the choice in a code comment, don't build both).

**Admin approval routes** — these belong in the `users` module (Phase 4 builds `users.controller.js`/`users.service.js`), but are specified here since they're part of the same registration lifecycle. Cross-reference from Phase 4 rather than duplicating the build.
- `GET /api/v1/users/pending` — `ORG_ADMIN` (own org only) / `SUPER_ADMIN` (any org, optional `?orgId=` filter). Lists `verificationStatus = PENDING` users, including a way to retrieve/view the uploaded ID proof (`GET /api/v1/users/:id/id-proof` — streams the file, same role/org-scoping rules as everything else in Phase 4's isolation rule).
- `PATCH /api/v1/users/:id/approve` — `ORG_ADMIN`(own org)/`SUPER_ADMIN`. Sets `verificationStatus = APPROVED`.
- `PATCH /api/v1/users/:id/reject` — same role scope. Body includes `rejectionReason` (required, non-empty — don't allow a silent reject). Sets `verificationStatus = REJECTED`.

**Validation** (`auth.validation.js`)
- Zod schemas for register/login bodies. Reject weak passwords (minimum length, at least this — don't over-engineer a full password-strength scorer for a hackathon-scale build).
- File validation for ID-proof upload lives in the Multer config (`fileFilter` + `limits`), not duplicated in a separate Zod schema.

**Middleware**
- `auth.middleware.js`: verifies JWT from `Authorization: Bearer <token>`, attaches `req.user = { id, role, orgId, verificationStatus }`, rejects with 401 on missing/invalid/expired token.
- `role.middleware.js`: exported as `requireRole(...roles)`, used as `requireRole('ORG_ADMIN', 'SUPER_ADMIN')` on protected routes. Rejects with 403 if `req.user.role` isn't in the allowed list.
- Every route protected by `auth.middleware.js` other than the pending-token upload route must also confirm `verificationStatus === APPROVED` — fold this into `auth.middleware.js` itself as a single check, don't scatter it per-route. (`SUPER_ADMIN`/seeded `ORG_ADMIN` pass this trivially since they're `APPROVED` by construction.)

**Service logic**
- Password hashing via bcrypt (cost factor 10, not lower).
- JWT signing with separate access/refresh secrets and separate expiries from `.env`. The pending-upload token is a third, distinct short-lived token type (e.g. 30-minute expiry, a distinct `type: "pending_upload"` claim) — verify that claim specifically in the upload route's middleware so a normal access token can't be reused there and vice versa.
- On login, do not leak whether the failure was "user not found" vs "wrong password" — same generic 401 message for both. This is separate from and doesn't conflict with the verification-status messages above, which apply only after credentials are confirmed valid.

### Verification
- Full happy path: register → receive pending token → upload ID proof → login attempt fails with a clear "pending approval" message → admin approves (Phase 4 route, test it here even though it's technically owned by Phase 4) → login now succeeds → protected-route-with-token → refresh → logout. Recorded in `PROGRESS.md`.
- Login attempt for a `REJECTED` user returns the rejection reason, not a generic failure.
- Uploading a disallowed file type or oversized file is rejected before it touches disk.
- A normal access token cannot be used against `/register/id-proof`, and a pending-upload token cannot be used against any other protected route.
- Hitting a `requireRole`-protected route with the wrong role returns 403, not 500 or a silent pass-through.
- Expired access token returns 401, not a crash.

---

## Phase 4 — Org & User management (admin operations)

Depends on Phase 3's role middleware.

### Build

**Routes** (`/api/v1/orgs`, `/api/v1/users`)
- `POST /orgs` — `SUPER_ADMIN` only. Creates an org.
- `GET /orgs` — `SUPER_ADMIN` only. Lists all orgs.
- `POST /orgs/:orgId/admins` — `SUPER_ADMIN` only. Provisions an `ORG_ADMIN` for that org.
- `GET /orgs/:orgId/admins` — `SUPER_ADMIN` only. Lists Org Admins for one org.
- `GET /users` — `ORG_ADMIN` sees only users in their own `orgId` (enforce via `req.user.orgId`, never trust a client-supplied org filter). `SUPER_ADMIN` sees all, with an optional `?orgId=` filter.
- `GET /users/:id` — `ORG_ADMIN` can view users in their own org only; `SUPER_ADMIN` any user; `USER` can view only their own record (`id === req.user.id`).
- `PATCH /users/:id` — profile self-edit for `USER`/`ORG_ADMIN` (own record only), `ORG_ADMIN` can edit any user in their org, `SUPER_ADMIN` any user.
- `PATCH /orgs/:orgId/settings` — `ORG_ADMIN` (own org) or `SUPER_ADMIN`. Updates `fuelCostPerLitre` / `costPerKmDefault`.

**ID-proof approval routes** (spec owned by Phase 3, built here — see Phase 3 for the full registration lifecycle these fit into)
- `GET /users/pending` — `ORG_ADMIN` (own org)/`SUPER_ADMIN` (any org, optional `?orgId=`). Lists `verificationStatus = PENDING` users.
- `GET /users/:id/id-proof` — same role scope as above, plus org isolation. Streams the uploaded file.
- `PATCH /users/:id/approve` — same role scope. Sets `verificationStatus = APPROVED`.
- `PATCH /users/:id/reject` — same role scope. Requires `rejectionReason` in the body. Sets `verificationStatus = REJECTED`.

### Critical rule — enforce org isolation at the service layer, not just the route

Every service function that touches `User`, `Vehicle`, `Ride`, `Trip`, etc. must filter by `orgId` derived from `req.user.orgId` for `ORG_ADMIN`/`USER` callers — never accept an org ID from the request body/query for these roles and trust it blindly. This is the single most important security property of this backend. Write it as a comment at the top of every service file that touches org-scoped data.

### Verification
- An `ORG_ADMIN` from Org A hitting `/users` never sees Org B's users, confirmed with a manual test using two orgs from the seed data (add a second org to the seed script temporarily if needed, or via the `POST /orgs` route).
- A `USER` hitting `PATCH /users/:id` with someone else's ID gets 403.

---

## Phase 5 — Vehicles, Saved Places

### Build

**Vehicle routes** (`/api/v1/vehicles`)
- `POST /` — `USER`/`ORG_ADMIN` registers a vehicle for themselves. `ownerId` always taken from `req.user.id`, never from the body.
- `GET /` — list own vehicles (or, for `ORG_ADMIN`, optionally all vehicles in their org via a query flag).
- `PATCH /:id` — update, owner-only.
- `DELETE /:id` — owner-only. Block deletion if the vehicle is referenced by an active (non-completed, non-cancelled — cancelled isn't in scope, so read as "non-completed") `Ride` — return 409 with a clear message rather than a raw FK constraint error.

**SavedPlace model** (add to schema now)
- `id`, `userId` (FK), `label` (e.g. "Home", "Office"), `address`, `latitude`, `longitude`, `createdAt`
- Migration: `npx prisma migrate dev --name add_saved_places`

**SavedPlace routes** (`/api/v1/settings/saved-places`)
- Standard CRUD, owner-scoped only, no admin override needed per source doc (this is a personal convenience feature).

### Verification
- Vehicle CRUD works end-to-end.
- Attempting to delete a vehicle attached to an active ride returns 409, not a raw Prisma error.
- SavedPlace CRUD works, and one user cannot see/edit another user's saved places (test with two seeded users).

---

## Phase 6 — Rides & Trips core

This is the largest phase. The source doc describes "Find a Ride" (search) and "Offer a Ride" (publish) as the same person using two different flows, plus a Trip lifecycle. This build adds nearby-discovery and changes booking from instant to a request/approve flow (per explicit product decision — see Phase 0's extensions table). **Booking is never a single step here.** The full sequence, in order, is:

1. Passenger and driver agree on a fare — either the passenger accepts the listed `farePerSeat` as-is, or they negotiate to a different number (Phase 6.5).
2. Once a fare is agreed, the passenger (or driver — either direction is allowed, see below) sends a **join request** at that agreed fare.
3. The driver must approve every join request — this build does not support auto-accept/instant booking under any configuration. A `Booking` only exists after explicit driver approval.

A join request cannot exist without an agreed fare behind it. Build Phase 6.5 (negotiation) conceptually alongside this phase even though it's written up separately — the two are one flow split into two sections for readability, not two independent features.

### Schema additions

**Ride** (a published offer)
- `id`, `driverId` (FK User), `vehicleId` (FK Vehicle)
- `pickupLabel`, `pickupLat`, `pickupLng`
- `destinationLabel`, `destinationLat`, `destinationLng`
- `departureAt` (DateTime), `availableSeats` (Int), `farePerSeat` (Decimal) — this is the *listed* fare; a negotiated fare for a specific passenger lives on that passenger's `JoinRequest`, not here, since different passengers on the same ride can agree to different fares.
- `isRecurring` (Boolean) — the source doc lists "Recurring Ride" as a search parameter; model it as a flag on the ride itself for this build (do not build a full recurrence-rule engine — that's beyond hackathon scope and not detailed in the source doc).
- `status` — enum `PUBLISHED | FULL | COMPLETED` (no `CANCELLED` — out of scope per Phase 0)
- `routeGeometry` (nullable JSON/Text — stores the GeoJSON linestring returned by OSRM at publish time) and `routeDistanceKm`, `routeDurationMinutes` (nullable, same source). Nullable because OSRM might be unreachable at publish time too, same fallback rule as search — a ride can still be published without a cached route, it just won't have one for the map to draw until the next successful OSRM call. This is what Phase 7's live tracking draws the "planned route" line from, so a passenger tracking the trip sees both the intended route and the vehicle's actual live position on it, not just a moving dot with no context.
- `orgId` (FK, denormalized from driver for query efficiency — a ride is only ever discoverable within its own org, since this is an *enterprise* carpooling platform per the source doc's framing)
- `createdAt`, `updatedAt`

**JoinRequest** (replaces a naive "instant booking" model — this is the request/approve step)
- `id`, `rideId` (FK), `passengerId` (FK User)
- `initiatedBy` — enum `PASSENGER | DRIVER`. A passenger can request to join a driver's ride, or a driver can invite a specific nearby passenger to join (per the product requirement that either party can initiate) — record which, since the approval direction flips: if the driver initiated, the *passenger* accepts/declines instead.
- `agreedFare` (Decimal) — copied in from the completed negotiation (Phase 6.5), or equal to `Ride.farePerSeat` if the passenger accepted the listed price with no negotiation.
- `negotiationId` (nullable FK to `Negotiation`, Phase 6.5 — null if the listed fare was accepted with no back-and-forth)
- `seatsRequested` (Int)
- `status` — enum `PENDING | ACCEPTED | DECLINED`
- `createdAt`, `updatedAt`

**Booking** (created only on `JoinRequest.status → ACCEPTED` — this is the actual seat reservation, kept as its own model rather than folded into `JoinRequest` so Trip/Payment/History logic from later phases doesn't need to know about the request lifecycle at all)
- `id`, `rideId` (FK), `passengerId` (FK User), `joinRequestId` (FK, one-to-one), `seatsBooked` (Int), `status` — enum `BOOKED | COMPLETED`
- `createdAt`

**Trip** (the lifecycle wrapper once a ride has at least one `Booking` and departure approaches)
- `id`, `rideId` (FK, one-to-one)
- `status` — enum matching the source doc's lifecycle exactly: `RIDE_BOOKED | TRIP_STARTED | TRIP_IN_PROGRESS | TRIP_COMPLETED | PAYMENT_PENDING | PAYMENT_COMPLETED`
- `startedAt`, `completedAt` (nullable DateTimes)

Migration: `npx prisma migrate dev --name add_rides_join_requests_trips`

### Routes

**Find a Ride** (`POST /api/v1/rides/search`)
- Body: pickup, destination, date, time, seats needed, `isRecurring` flag.
- Query `Ride` where `orgId = req.user.orgId`, `status = PUBLISHED`, `availableSeats >= seatsNeeded`, `departureAt` within a reasonable window of the requested date/time (define "reasonable" as ±2 hours unless the caller specifies otherwise — state this default in the API doc).
- **Route confirmation**: the source doc requires displaying a calculated route before booking. Call OSRM's public routing API (`GET https://router.project-osrm.org/route/v1/driving/{lng1},{lat1};{lng2},{lat2}?overview=full&geometries=geojson`) server-side to get real road-network distance, duration, and the route geometry (a polyline/GeoJSON linestring a map client can draw directly). Return `distanceKm`, `durationMinutes`, and `routeGeometry` in the search response. If the OSRM call fails or times out (it's a shared public demo server — treat it as unreliable, not down-never), fall back to the Haversine straight-line distance, clearly labeled `estimatedDistanceKm` with a flag like `routeSource: "fallback_haversine"` so the caller knows it didn't get a real road route that time — never let a third-party outage 500 the whole search endpoint.

**Offer a Ride** (`POST /api/v1/rides`)
- `USER`/`ORG_ADMIN`, must own at least one registered `Vehicle` first — reject with a clear 400 message ("register a vehicle before publishing a ride") if not, matching the source doc's explicit precondition.
- Creates a `PUBLISHED` ride tied to `req.user.orgId`. Call the same OSRM routing helper used in search (extract it as one shared function, e.g. `getRoute(origin, destination)` in a `utils/routing.js` — do not duplicate the OSRM call between search and publish) to populate `routeGeometry`/`routeDistanceKm`/`routeDurationMinutes` at creation time. Same fallback rule: OSRM failure doesn't block publishing, it just leaves those fields null for now.

**Nearby discovery** — new, built for the driver-route-planning and passenger-driver-discovery requirement
- `GET /api/v1/rides/:id/nearby-passengers` — driver-only, own ride only. Finds `SavedPlace`s (or ad-hoc pickup points passed as query lat/lng, support both) within a radius of the ride's route, so the driver can judge which pickups are worth a detour. Implementation: a bounding-box pre-filter (cheap index-friendly range query) followed by an exact Haversine distance check on the surviving rows — do not attempt a true PostGIS radius query; that requires a Postgres extension this build doesn't provision, and a two-step bounding-box-then-Haversine filter is accurate enough at hackathon scale. State this explicitly as a code comment where the query is built. Default radius 2km, overridable via query param.
- `GET /api/v1/rides/nearby-drivers` — passenger-facing. Same bounding-box + Haversine approach, from the passenger's given/saved pickup point against all `PUBLISHED` rides in their org whose route passes within radius. Same org-isolation rule as search.
- Both routes return only non-sensitive fields (no exact home address beyond what the ride/pickup point already exposes) — a driver's `nearby-passengers` result should show enough for a routing decision, not a full profile.

**Join request routes** (`/api/v1/rides/:id/join-requests`)
- `POST /` — either party initiates (see `initiatedBy` above). Body requires `agreedFare` — reject if no matching `ACCEPTED` `Negotiation` exists for this passenger+ride at that fare, *unless* `agreedFare === Ride.farePerSeat` exactly (the no-negotiation, accept-listed-price path). This check is the enforcement point for "must agree on price before booking is possible" — do not let a client submit an arbitrary `agreedFare` that skips negotiation.
- `GET /` — driver-only (own ride), lists pending requests to review.
- `PATCH /:requestId/accept` — the *other* party from whoever initiated (driver accepts if passenger-initiated, and vice versa). Transactional: re-check `availableSeats >= seatsRequested` at accept-time (not just at request-time — seats can change between request and accept), decrement atomically, create `Booking`, and on the ride's *first* `Booking`, create the `Trip` in `RIDE_BOOKED`. Flip `Ride.status → FULL` if seats hit zero. Auto-decline any other still-`PENDING` requests for seats that no longer fit, rather than leaving them pending against a ride that can't honor them.
- `PATCH /:requestId/decline` — same reversed-party rule as accept.

**Trip routes** (`/api/v1/trips`)
- `GET /` — "My Trips": trips where the caller is the driver or a passenger (via `Ride.driverId` or `Booking.passengerId`).
- `GET /:id` — full detail: driver info, passenger list (driver's view only — do not expose the full passenger list to other passengers, only their own booking), vehicle info, locations, schedule, fare, current status.
- `PATCH /:id/status` — driver-only, moves status forward through the fixed lifecycle in order. Reject any attempt to skip states or move backward (e.g. `TRIP_COMPLETED → RIDE_BOOKED` is invalid) — validate this transition explicitly in the service layer with a small allowed-transitions map, don't just trust the client's requested next state.

### Verification
- Full flow tested manually: driver publishes a ride, passenger finds it via search or nearby-drivers, passenger either accepts the listed fare or negotiates (Phase 6.5) to a new one, passenger sends a join request at the agreed fare, driver accepts, `Booking` + `Trip` (`RIDE_BOOKED`) are created, driver advances Trip status in order, an out-of-order status update is rejected.
- A join request with an `agreedFare` that doesn't match the listed fare and has no corresponding accepted negotiation is rejected — confirms the "must agree before booking" rule is actually enforced server-side, not just assumed from client behavior.
- Two join requests racing for the last seat: only one can be accepted; accepting the second (now-invalid) request is rejected cleanly, not silently double-booked.
- Driver-initiated join request (invite) is accepted/declined by the *passenger*, not the driver — confirms the reversed-party rule works both directions.
- A user from Org B never sees Org A's rides in search or nearby-discovery results.

---

## Phase 6.5 — Price negotiation

Product decision (Phase 0 extensions table): passenger and driver can negotiate a fare before a join request can be sent, and a join request requires an agreed fare (Phase 6 enforces this at the request-creation check). This is a **separate feature from chat** (Phase 7) — do not build negotiation as free-text chat messages that happen to contain numbers. It needs structured state so both parties can see the current offer, who made it, and accept/counter/reject it as discrete actions.

### Schema addition

**Negotiation**
- `id`, `rideId` (FK), `passengerId` (FK User) — a negotiation is always scoped to one specific ride + one specific passenger, since different passengers can land on different agreed fares for the same ride.
- `status` — enum `OPEN | ACCEPTED | REJECTED | EXPIRED`
- `createdAt`, `updatedAt`

**NegotiationOffer** (one row per offer/counter-offer in the back-and-forth)
- `id`, `negotiationId` (FK)
- `offeredBy` — enum `PASSENGER | DRIVER`
- `amount` (Decimal)
- `createdAt`

Migration: `npx prisma migrate dev --name add_negotiations`

A `Negotiation`'s current price is simply its latest `NegotiationOffer` — don't duplicate a "current amount" field on `Negotiation` itself and risk it drifting out of sync; always derive it by querying the latest offer.

### Routes (`/api/v1/rides/:id/negotiations`)

- `POST /` — passenger only, starts a negotiation with an initial counter-offer amount (must differ from `Ride.farePerSeat` — if they'd accept the listed price, they don't need this endpoint at all, they go straight to a join request in Phase 6). Creates `Negotiation` (`OPEN`) + first `NegotiationOffer` (`offeredBy: PASSENGER`).
- `GET /` — driver-only (own ride), lists open negotiations to review.
- `GET /:negotiationId` — either party involved, full offer history.
- `POST /:negotiationId/counter` — either party (whoever it's *not* currently waiting on — reject if the same party tries to counter their own last offer twice in a row, that's not a negotiation). Adds a new `NegotiationOffer` at a new amount.
- `PATCH /:negotiationId/accept` — either party, accepts the *other* party's latest offer as-is. Sets `Negotiation.status = ACCEPTED`. This is what Phase 6's join-request check looks for.
- `PATCH /:negotiationId/reject` — either party, ends it. Sets `Negotiation.status = REJECTED`. A rejected negotiation doesn't block starting a fresh one later — don't add an artificial one-attempt limit, the source requirement is "keep changing the price until both parties agree," which implies persistence, not a cap.
- A negotiation auto-locks (reject any further counter/accept calls with a clear 409) once `Ride.status` leaves `PUBLISHED` — negotiation only makes sense pre-booking, matching the explicit "only before the ride" requirement.

### Verification
- Full back-and-forth tested manually: passenger opens at X, driver counters at Y, passenger counters at Z, driver accepts. Confirm the `agreedFare` that later shows up on the join request equals Z — the amount from the specific offer that was accepted — not X, not Y, and not some recomputed value. This is the one place a bug would be easy to miss: always resolve "the agreed price" by reading the actual accepted `NegotiationOffer` row, never by re-deriving it some other way.
- The same party attempting to counter twice in a row without the other party responding is rejected.
- Once accepted, a join request using that negotiation's agreed fare succeeds; a mismatched fare is rejected (cross-check with Phase 6's verification).
- Attempting to negotiate on a ride that's already `FULL` or `COMPLETED` is rejected.

---

## Phase 7 — Live Trip Tracking, Chat & Call Signaling (Socket.io)

The source doc requires chat and voice call under Trip Management specifically ("Passengers and drivers can communicate throughout the trip"). Scope both to trip participants — driver and that trip's booked passengers — not a general messaging system between arbitrary users. If a broader messaging surface turns out to be wanted later, that's a new decision, not something to infer here.

Three Socket.io namespaces on one server, all sharing the same JWT-handshake-auth pattern — write the handshake verification once as shared middleware and reuse it across all three, don't reimplement it per namespace.

### 7.1 — Live Trip Tracking

This is the passenger-facing "watch the vehicle move on a map in real time" feature. The map itself is a frontend concern (OSM tiles via Leaflet/MapLibre or similar), but this backend's job is to give that map everything it needs: the vehicle's current position, the planned route to draw underneath it, and an ETA — not just a bare coordinate with no context.

- Namespace `/tracking`, JWT-authenticated on connection (verify the token in the socket handshake, reuse the Phase 3 JWT verification logic — don't duplicate it).
- Client (driver) emits `location:update` with `{ tripId, lat, lng }` only when `Trip.status` is `TRIP_STARTED` or `TRIP_IN_PROGRESS` — reject/ignore emits for trips in other states.
- Server broadcasts to a room scoped per `tripId` (`socket.join('trip:' + tripId)`), so only the driver and booked passengers of that specific trip receive updates — never broadcast globally.
- On `location:update`, also persist the latest point to a lightweight `TripLocation` model (`tripId`, `lat`, `lng`, `recordedAt`) — this gives Reports something to query later and gives a REST fallback for clients that aren't currently connected via socket.
- **ETA on each update**: call the OSRM routing helper (the same `getRoute` function from Phase 6 — reuse it, don't write a second OSRM client) with the driver's current `{lat, lng}` as origin and the ride's destination as the endpoint, take `durationMinutes` from that response, and include it in the broadcast payload as `etaMinutes`. This recalculates on every location update, which is correct (ETA should shrink as the vehicle gets closer) but is also a live call to a shared public OSRM server on every emit — throttle it server-side (e.g. only recompute ETA at most once every 30 seconds per trip, reuse the last computed value for broadcasts in between) so a driver emitting frequent location updates doesn't hammer OSRM's public rate limit. State this throttling explicitly as a code comment, since it's easy for a later editor to "simplify" it away without realizing why it's there.
- Broadcast payload for `location:update` to the room: `{ tripId, lat, lng, etaMinutes, recordedAt }`. On socket connection to a trip's room, also send the ride's `routeGeometry` once (from Phase 6's stored field) as a separate `route:info` event, so a newly-connected passenger's map can draw the full planned route immediately rather than waiting for enough location pings to infer it.
- REST fallback: `GET /api/v1/trips/:id/location` — returns the latest persisted point plus the ride's `routeGeometry`/`routeDistanceKm`/`routeDurationMinutes`, for any client not using the socket connection (or a client that just wants an initial map render before opening the socket).

### 7.2 — Chat

**Schema addition**

**Message**
- `id`, `tripId` (FK), `senderId` (FK User), `content` (Text), `createdAt`, `readAt` (nullable)

Migration: `npx prisma migrate dev --name add_messages`

**Build**
- Namespace `/chat`, same JWT handshake pattern, same `trip:<tripId>` room join — reuse the room, don't invent a separate room-naming scheme from tracking.
- Client emits `message:send` with `{ tripId, content }`. Server validates the sender is actually the driver or a booked passenger on that trip (never trust room membership alone as authorization — a socket could theoretically join a room it shouldn't if this check is skipped), persists a `Message` row, then broadcasts `message:new` to the room.
- REST fallback for history and for clients not currently connected: `GET /api/v1/trips/:id/messages` (paginated, same trip-participant authorization check as the socket path — do not duplicate the authorization logic informally, extract a small shared `assertTripParticipant(userId, tripId)` helper and call it from both the REST controller and the socket handler).
- `POST /api/v1/trips/:id/messages` — REST send path, for clients that want to send without holding a live socket connection. Same persistence + room broadcast as the socket path (the REST controller can emit to the room itself after saving, so both paths converge on one delivery mechanism).
- Mark-as-read: `PATCH /api/v1/trips/:id/messages/read` — sets `readAt` for the caller's unread messages in that trip.

### 7.3 — Call signaling

Backend scope is signaling only — who's ringing whom and the state of that ring, not audio transport. Actual audio requires WebRTC peer connections between clients (and typically a TURN server for NAT traversal) which is entirely a client-side/infra concern outside this backend. Say this plainly in `API.md` so it isn't mistaken for an incomplete call feature later — it's a deliberately bounded one.

- Namespace `/calls`, same JWT handshake pattern.
- Client emits `call:initiate` with `{ tripId, calleeId }` — validate both caller and callee are participants on that trip (driver ↔ one specific passenger, not a broadcast ring to everyone in the trip). Server relays `call:incoming` to the callee's socket if connected; if not connected, respond to the caller with a clear "callee offline" event rather than hanging silently.
- Client emits `call:accept` / `call:reject` / `call:end`, each relayed to the other party in that specific call. Track minimal call state server-side (`callId`, participants, `status: RINGING | ACTIVE | ENDED`) in-memory is acceptable here — this is transient session state, not something that needs a database row and Reports never needs to query historical calls per the source doc.
- No REST fallback needed for signaling itself — a call is inherently a live-socket-only interaction; state that explicitly rather than leaving it looking like an oversight.

### Verification
- Two connected clients (driver + passenger) in the same trip room: driver emits a location update, passenger receives it including a non-null `etaMinutes` — confirmed manually (a simple Socket.io test script counts here — full frontend not required).
- A passenger connecting to a trip's room receives `route:info` with the ride's stored `routeGeometry` immediately on join, without needing to wait for a location update first.
- ETA throttling actually throttles: emitting several `location:update` events within the throttle window results in only one real OSRM call, confirmed by checking logs/call count, not just trusting the code reads correctly.
- `GET /api/v1/trips/:id/location` returns both the latest point and the route fields together, not just the bare coordinate.
- A client not authenticated with a valid JWT cannot connect to any of the three namespaces.
- Emits for a trip not in `TRIP_STARTED`/`TRIP_IN_PROGRESS` are rejected server-side (tracking only).
- Chat: a message sent by someone who is neither the trip's driver nor a booked passenger is rejected, both via the socket path and the REST path.
- Chat: message sent via REST while the recipient is connected via socket is received in real time (confirms the two delivery paths actually converge, not just that each works in isolation).
- Call: initiating a call to someone not on the trip is rejected; initiating to a valid but disconnected participant returns a clear "offline" response instead of silently doing nothing.

---

## Phase 8 — Payments & Wallet (Razorpay test mode)

### Schema additions
- `Wallet` — `id`, `userId` (FK, unique — one wallet per user), `balance` (Decimal, default 0)
- `WalletTransaction` — `id`, `walletId` (FK), `type` (enum `CREDIT | DEBIT`), `amount`, `reason` (e.g. "recharge", "ride_payment"), `createdAt`
- `Payment` — `id`, `tripId` (FK), `payerId` (FK User), `amount`, `method` (enum `CASH | CARD | UPI | WALLET`), `status` (enum `PENDING | PAID | FAILED`), `razorpayOrderId` (nullable), `razorpayPaymentId` (nullable), `createdAt`, `updatedAt`

Migration: `npx prisma migrate dev --name add_payments_wallet`

### Build

**Wallet routes** (`/api/v1/wallet`)
- `GET /` — balance.
- `POST /recharge` — creates a Razorpay order for the recharge amount (test mode), returns `{ orderId, amount, keyId }` to the client for checkout.
- `POST /recharge/verify` — receives `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }`, verifies the HMAC-SHA256 signature server-side against `RAZORPAY_KEY_SECRET` (construct the digest over `order_id|payment_id`, compare against the provided signature — never trust the client's claim of success without this check). On valid signature, credit the wallet and log a `WalletTransaction`.

**Payment routes** (`/api/v1/payments`)
- `POST /trips/:tripId/pay` — only valid when `Trip.status === PAYMENT_PENDING`. Body specifies `method`.
  - `WALLET`: debit atomically if sufficient balance, else 402-style rejection with a clear message. Create `Payment` as `PAID` immediately, advance `Trip.status → PAYMENT_COMPLETED`.
  - `CASH`: mark `Payment` as `PAID` directly (no gateway involved), advance trip status. This models a driver confirming cash receipt — for this build, either party can mark it (document that trust assumption in `API.md`; a full driver-confirms-cash-received flow is a reasonable future extension but isn't detailed in the source doc).
  - `CARD`/`UPI`: create a Razorpay order, same order → verify → webhook pattern as wallet recharge.
- `POST /payments/webhook` — Razorpay webhook receiver. Verifies `x-razorpay-signature` against `RAZORPAY_WEBHOOK_SECRET` (different secret from the order-verification flow — do not reuse `RAZORPAY_KEY_SECRET` here, they are genuinely different values in Razorpay's model). On a valid `payment.captured` event, idempotently mark the matching `Payment` as `PAID` and advance the trip — idempotent specifically because Razorpay can and does redeliver webhook events, so check current status before writing, don't blindly overwrite.

### Why both order-verification AND webhook

Order verification alone breaks if the user closes the browser/app before the success callback fires — the webhook is the durable source of truth and must independently be able to complete a payment even if the client-side verify call never happens. Build both. Do not treat the webhook as optional or secondary.

### Verification
- Wallet recharge: create order → simulate signature verification with a real test-mode HMAC (Razorpay test mode supports this without real money) → balance increases exactly once.
- Trip payment via wallet: insufficient balance is rejected cleanly; sufficient balance debits and advances trip status atomically.
- Webhook idempotency: replay the same webhook payload twice, confirm the wallet/payment isn't double-credited.

---

## Phase 9 — Ride History & Reports

### Build

**Ride History** (`GET /api/v1/trips/history`)
- Trips with `status = TRIP_COMPLETED` or later, for the caller (driver or passenger role), with participants/route/vehicle/date/status per the source doc's field list. Paginate (don't return unbounded history for a user with hundreds of trips).

**Reports** (`/api/v1/reports`) — `ORG_ADMIN`/`SUPER_ADMIN` only, scoped to the caller's org (or a specified org for `SUPER_ADMIN`)
- `GET /reports/summary` — total trips, total distance (sum of `estimatedDistanceKm` across completed trips' rides), for a given date range.
- `GET /reports/fuel` — fuel consumption estimate: `distance / assumedKmPerLitre * org.fuelCostPerLitre`. Use a documented constant for `assumedKmPerLitre` (e.g. 15) since the source doc doesn't specify a per-vehicle efficiency model to pull real figures from — state this assumption explicitly as a comment and in `API.md`, don't present it as measured data.
- `GET /reports/cost-per-km` — `org.costPerKmDefault`, or computed from fuel report ÷ distance if you want a derived figure — pick one, document which, don't silently blend both.
- `GET /reports/vehicle-cost` — per-vehicle breakdown, same underlying assumptions as `/fuel`.

### Verification
- Reports return sensible, non-crashing output against the seed data plus whatever trips were completed during earlier-phase testing.
- An `ORG_ADMIN` cannot pull another org's report by manipulating a query param — same isolation rule as Phase 4.

---

## Phase 10 — API Documentation

### Build `docs/API.md`

For every route built across Phases 3–9, document:
- Method + path
- Required role(s)
- Request body/params/query (with types)
- Success response shape + status code
- Key error responses (status code + when they occur)
- Any notable behavior/assumption called out in that phase (e.g. the Haversine distance approximation, the fuel-cost assumption, the cash-payment trust model)

Group by module, matching the folder structure. Include a top section listing: base URL, auth header format, and a one-paragraph summary of the three-role model with a link back to Phase 0's table.

This file must be regenerated/updated incrementally — ideally you kept it current phase-by-phase rather than writing it all at the end from memory, since writing it all at once from memory is exactly the kind of task where details get hallucinated.

### Verification
- Every route that exists in the codebase has a corresponding entry in `API.md` — cross-check route files against the doc, don't just trust that you remembered to document everything.
- No route is documented that doesn't actually exist in the code.

---

## Final note on discipline

If, at any point, a phase turns out to need something Phase 0's stack/scope didn't anticipate, stop and flag it rather than quietly deciding on your own and continuing. A wrong guess two phases deep costs more to unwind than a five-minute pause to confirm now.