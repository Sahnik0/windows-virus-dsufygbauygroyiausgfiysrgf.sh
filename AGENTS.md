# AGENTS.md — Enterprise Carpooling Platform Backend

This file provides a quick orientation for autonomous coding agents working on this codebase.

> **Source of Truth**: The definitive specification and build guidelines are located in [`AGENT_BUILD_PROMPT.md`](file:///home/sahnik/Work/Oddo-Final/backend/AGENT_BUILD_PROMPT.md).

---

## Tech Stack

| Component | Technology | Description / Notes |
|---|---|---|
| Runtime | Node.js, Express.js | REST API server framework |
| Database | PostgreSQL | Relational database (local Docker or cloud instance) |
| ORM | Prisma | Database schema & query builder |
| Auth | JWT, bcrypt | Access token + refresh token, role middleware |
| Real-time | Socket.io | Namespaces: `/tracking`, `/chat`, `/calls` |
| Maps & Routing | OpenStreetMap / OSRM | Public demo server `router.project-osrm.org` |
| Payments | Razorpay | Test mode (orders, signature verification, webhooks) |
| File Uploads | Multer | Local disk storage under `/uploads/id-proofs` |
| Containerization | Docker Compose | Local PostgreSQL container (`compose.yml`) |

---

## Role Model

| Role | Scope | Belongs to an org? | Notes |
|---|---|---|---|
| `SUPER_ADMIN` | Platform-wide | No | Manages Org Admins across all orgs |
| `ORG_ADMIN` | One organization | Yes (exactly one) | Manages employee records, vehicles, org settings |
| `USER` | One organization | Yes (exactly one) | Can offer rides and find rides |

---

## Fixed Project Structure

```
/src
  /config          → env loading, prisma client singleton, socket.io setup, razorpay client
  /modules
    /auth          → auth.routes.js, auth.controller.js, auth.service.js, auth.validation.js
    /users         → users.routes.js, users.controller.js, users.service.js, users.validation.js
    /orgs          → orgs.routes.js, orgs.controller.js, orgs.service.js, orgs.validation.js
    /vehicles      → vehicles.routes.js, vehicles.controller.js, vehicles.service.js, vehicles.validation.js
    /rides         → rides.routes.js, rides.controller.js, rides.service.js, rides.validation.js
    /negotiations → negotiations.routes.js, negotiations.controller.js, negotiations.service.js, negotiations.validation.js
    /trips         → trips.routes.js, trips.controller.js, trips.service.js, trips.validation.js
    /tracking      → tracking.routes.js, tracking.controller.js, tracking.service.js, tracking.validation.js
    /chat          → chat.routes.js, chat.controller.js, chat.service.js, chat.validation.js
    /calls         → calls.routes.js, calls.controller.js, calls.service.js, calls.validation.js
    /payments      → payments.routes.js, payments.controller.js, payments.service.js, payments.validation.js
    /wallet        → wallet.routes.js, wallet.controller.js, wallet.service.js, wallet.validation.js
    /reports       → reports.routes.js, reports.controller.js, reports.service.js, reports.validation.js
    /settings      → settings.routes.js, settings.controller.js, settings.service.js, settings.validation.js
  /middleware      → auth.middleware.js, role.middleware.js, error.middleware.js, validate.middleware.js
  /utils           → routing.js, etc.
  /jobs            → background jobs (if needed)
  app.js           → Express app assembly
  server.js        → HTTP server + Socket.io entry point
/prisma
  schema.prisma
  /migrations
/docs
  API.md           → REST API documentation
/uploads
  /id-proofs       → Uploaded ID verification files
compose.yml
.env.example
PROGRESS.md
AGENTS.md
```
