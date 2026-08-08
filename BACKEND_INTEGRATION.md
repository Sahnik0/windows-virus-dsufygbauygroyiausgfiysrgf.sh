# Enterprise Carpooling Platform — Backend Integration Contract
> **For the backend developer.** This document describes every screen and feature already built in the frontend, what API it needs, the exact request/response shape expected, and what is still wired to local mock data. The goal: you implement these endpoints → we swap the mock → done.

---

## Quick Reference

| Category | Status |
|---|---|
| Auth (Register + Login + Logout) | ✅ API client ready, hooks integrated |
| Org Management (Super Admin) | ✅ API client ready |
| User Approvals (Org Admin) | ✅ API client ready |
| Vehicles (Employee dashboard) | ❌ Still on local mock data |
| Saved Places | ❌ Still on local mock data |
| Find a Ride / Search | ❌ Still on local mock data |
| Offer a Ride / Publish | ❌ Still on local mock data |
| Join Requests & Booking | ❌ Still on local mock data |
| My Trips (Trip Management) | ❌ Still on local mock data |
| Live Trip Tracking (Map) | ❌ Still on local mock (simulated) |
| In-Trip Chat | ❌ Still on local mock data |
| Voice Call Signaling | ❌ Still on local mock |
| Wallet & Payments | ❌ Still on local mock data |
| Ride History | ❌ Still on local mock data |
| Reports & Analytics | ❌ Still on local mock data |

**Base URL**: `http://localhost:3000/api/v1`
**Socket.io URL**: `http://localhost:3000`
**Auth header on every protected request**: `Authorization: Bearer <accessToken>`

---

## Section 1 — Authentication ✅ DONE (API wired)

### What the frontend does
- **Login page** (`/login`) has two forms: Sign In tab and Sign Up tab.
- Sign In calls `POST /auth/login` and stores tokens in cookies (`access-token`, `refresh-token`).
- Sign Up is a 2-step flow:
  1. Collects `firstName`, `lastName`, `email`, `password`, `phone`, `orgId` → `POST /auth/register`
  2. Receives `pendingToken` → immediately uploads ID proof file → `POST /auth/register/id-proof` with `Authorization: Bearer <pendingToken>`
- On 403 with pending/rejected status, shows the `message` from backend inline.
- `POST /auth/logout` is called on logout from dashboard/admin panel.

### Endpoints needed

#### `POST /auth/register` — Public
```json
// Request
{
  "email": "jane@acme.com",
  "password": "SecurePass123!",
  "firstName": "Jane",
  "lastName": "Doe",
  "phone": "+919876543210",
  "orgId": "org-uuid-here"
}

// Response 201
{
  "message": "Registration successful. Please upload an ID proof document.",
  "user": {
    "id": "u-12345",
    "email": "jane@acme.com",
    "firstName": "Jane",
    "lastName": "Doe",
    "role": "USER",
    "verificationStatus": "PENDING"
  },
  "pendingToken": "eyJhbGciOiJIUzI1Ni..."
}
```

#### `POST /auth/register/id-proof` — Bearer `<pendingToken>`
```
Content-Type: multipart/form-data
Field name: idProof (file: .jpg, .jpeg, .png, .pdf, max 5MB)

// Response 200
{ "message": "ID proof uploaded. Pending admin approval.", "userId": "u-12345", "verificationStatus": "PENDING" }
```

#### `POST /auth/login` — Public
```json
// Request
{ "email": "jane@acme.com", "password": "SecurePass123!" }

// Response 200 (approved)
{
  "accessToken": "eyJhbGciOiJIUzI1Ni...",
  "refreshToken": "eyJhbGciOiJIUzI1Ni...",
  "user": {
    "id": "u-12345",
    "email": "jane@acme.com",
    "firstName": "Jane",
    "lastName": "Doe",
    "role": "USER",
    "orgId": "org-uuid",
    "orgSlug": "acme-corporation",
    "verificationStatus": "APPROVED"
  }
}

// Response 403 (pending)
{ "message": "Your ID proof is under review. Please wait for admin approval." }

// Response 403 (rejected)
{ "message": "Account registration rejected: <reason>", "rejectionReason": "<reason>" }
```

> **Frontend routing after login**: `role === "SUPER_ADMIN"` goes to `/super-admin`, `role === "ORG_ADMIN"` goes to `/[orgSlug]/admin`, `role === "USER"` goes to `/dashboard`. The login response MUST include `orgSlug` (derived from the org) so the frontend can build the admin route.

#### `POST /auth/refresh` — Public
```json
// Request
{ "refreshToken": "eyJhbGciOiJIUzI1Ni..." }
// Response 200
{ "accessToken": "eyJhbGciOiJIUzI1Ni..." }
```

#### `POST /auth/logout` — Authenticated
```json
// Request
{ "refreshToken": "eyJhbGciOiJIUzI1Ni..." }
// Response 200
{ "message": "Logged out successfully" }
```

---

## Section 2 — Organization Management ✅ DONE (API wired)

### What the frontend does
Super Admin panel (`/super-admin`) lets the platform owner:
- View all organizations in a table (name, slug, user count, status)
- Create a new organization with name, fuel cost, cost-per-km settings
- Immediately provision an Org Admin account for the new org

### Endpoints needed

#### `GET /orgs` — SUPER_ADMIN only
```json
// Response 200
[
  {
    "id": "org-uuid",
    "name": "Acme Corporation",
    "slug": "acme-corporation",
    "status": "ACTIVE",
    "fuelCostPerLitre": 100.0,
    "costPerKmDefault": 15.0,
    "_count": { "users": 42 }
  }
]
```

#### `POST /orgs` — SUPER_ADMIN only
```json
// Request
{
  "name": "Acme Corporation",
  "slug": "acme-corporation",
  "fuelCostPerLitre": 100.0,
  "costPerKmDefault": 15.0,
  "status": "ACTIVE"
}
// Response 201 — full org object (same shape as GET /orgs item)
```

#### `POST /orgs/:orgId/admins` — SUPER_ADMIN only
```json
// Request
{
  "email": "admin@acme.com",
  "password": "AdminPass2026!",
  "firstName": "Acme",
  "lastName": "Admin",
  "phone": "+919876543210"
}
// Response 201
{
  "id": "u-admin-uuid",
  "email": "admin@acme.com",
  "firstName": "Acme",
  "lastName": "Admin",
  "role": "ORG_ADMIN",
  "verificationStatus": "APPROVED"
}
```

#### `PATCH /orgs/:orgId/settings` — ORG_ADMIN (own org) or SUPER_ADMIN
```json
// Request (all optional)
{
  "fuelCostPerLitre": 105.0,
  "costPerKmDefault": 16.0,
  "subsidyPercent": 40.0,
  "baseRideCharge": 2.50,
  "maxRidersPerCarpool": 4,
  "autoMatchEnabled": true,
  "departmentRestriction": false
}
// Response 200 — updated org settings object
```

---

## Section 3 — User Approvals ✅ DONE (API wired)

### What the frontend does
Org Admin panel (`/[orgSlug]/admin`) → "Pending Applications" tab:
- Lists employees awaiting approval
- Streams ID proof image inline as thumbnail
- Approve with one click
- Reject with a mandatory rejection reason

"Employees" tab lists all approved employees with toggle for carpool access.

### Endpoints needed

#### `GET /users/pending` — ORG_ADMIN (own org), SUPER_ADMIN (?orgId=)
```json
// Response 200
[
  {
    "id": "u-12345",
    "email": "jane@acme.com",
    "firstName": "Jane",
    "lastName": "Doe",
    "employeeId": "EMP-1002",
    "role": "USER",
    "orgId": "org-uuid",
    "verificationStatus": "PENDING",
    "idProofPath": "/uploads/id-proofs/u-12345.png",
    "idProofUploadedAt": "2026-08-08T10:05:00.000Z"
  }
]
```

#### `GET /users/:id/id-proof` — ORG_ADMIN (own org), SUPER_ADMIN
```
Response 200: streams the file (image/png, image/jpeg, application/pdf)
Frontend uses: <img src="http://localhost:3000/api/v1/users/:id/id-proof" />
Must include CORS headers so browser can load cross-origin image.
```

#### `PATCH /users/:id/approve` — No request body
```json
// Response 200
{ "message": "User successfully approved", "user": { "id": "u-12345", "verificationStatus": "APPROVED" } }
```

#### `PATCH /users/:id/reject`
```json
// Request
{ "rejectionReason": "ID card expired or image unreadable" }
// Response 200
{ "message": "User verification rejected", "user": { "id": "u-12345", "verificationStatus": "REJECTED", "rejectionReason": "..." } }
```

#### `GET /users` — ORG_ADMIN own org employees tab
```json
// Response 200
[
  {
    "id": "u-12345",
    "email": "jane@acme.com",
    "firstName": "Jane",
    "lastName": "Doe",
    "employeeId": "EMP-1002",
    "carpoolAccess": true,
    "verificationStatus": "APPROVED",
    "role": "USER",
    "orgId": "org-uuid"
  }
]
```

#### `PATCH /users/:id` — toggle carpoolAccess
```json
// Request
{ "carpoolAccess": false }
// Response 200 — updated user object
```

---

## Section 4 — Vehicles ❌ NEEDS WIRING

### What the frontend does
Employee dashboard → "My Vehicle" tab shows vehicle cards and an "Add Vehicle" modal.

**Frontend type**:
```typescript
interface Vehicle {
  id: string;
  model: string;
  plateNumber: string;     // maps from registrationNumber
  capacity: number;        // maps from seatingCapacity
  fuelType: "Electric" | "Hybrid" | "Petrol" | "Diesel";
  status: "Verified" | "Pending";
}
```

### Endpoints needed

#### `GET /vehicles` — Authenticated USER
```json
// Response 200
[
  {
    "id": "v-101",
    "model": "Swift Dzire",
    "registrationNumber": "GJ01AB1234",
    "seatingCapacity": 4,
    "fuelType": "PETROL",
    "status": "VERIFIED",
    "ownerId": "u-12345"
  }
]
```
> Frontend will map `registrationNumber` → display as `plateNumber`, `seatingCapacity` → `capacity`, `fuelType` ALLCAPS → Title Case for display.

#### `POST /vehicles` — Authenticated USER
```json
// Request
{
  "model": "Toyota Prius",
  "registrationNumber": "KA01AB5678",
  "seatingCapacity": 4,
  "fuelType": "HYBRID"
}
// Response 201 — full vehicle object
```

#### `PATCH /vehicles/:id` — Vehicle owner only
```json
// Request
{ "model": "Toyota Prius Prime", "seatingCapacity": 5 }
// Response 200 — updated vehicle object
```

#### `DELETE /vehicles/:id` — Vehicle owner only
```json
// Response 200
{ "message": "Vehicle deleted successfully" }
// Response 409 (active ride attached)
{ "message": "Cannot delete vehicle attached to an active ride" }
```

---

## Section 5 — Saved Places ❌ NEEDS WIRING

### What the frontend does
Employee dashboard → Settings tab → "Saved Places" section. Add/delete labeled addresses (Home, Office, etc.). Also shown as quick-select chips in the location autocomplete input.

### Endpoints needed

#### `GET /settings/saved-places` — Owner only
```json
// Response 200
[
  { "id": "sp-uuid", "label": "Home", "address": "Sector 4, Green Avenue", "latitude": 23.0225, "longitude": 72.5714 }
]
```

#### `POST /settings/saved-places` — Owner only
```json
// Request
{ "label": "Office", "address": "Infocity, Gandhinagar", "latitude": 23.2156, "longitude": 72.6369 }
// Response 201 — saved place object
```

#### `DELETE /settings/saved-places/:id` — Owner only
```json
// Response 200
{ "message": "Saved place deleted successfully" }
```

---

## Section 6 — Find a Ride ❌ NEEDS WIRING

### What the frontend does (3-step flow)

**Step 1 — Search form**: Pickup location, destination, date+time, seats, recurring toggle (days of week).

**Step 2 — Route Confirmation**: Leaflet map draws the route between the two points via OpenStreetMap/OSRM. Shows distance and duration. User clicks "Find Matching Rides".

**Step 3 — Available Rides**: Cards with driver info, vehicle, departure time, fare. "Book Now" on each card.

### Endpoint needed

#### `POST /rides/search` — Authenticated USER
```json
// Request
{
  "pickupLat": 23.0300,
  "pickupLng": 72.5873,
  "pickupLabel": "Iskcon, Ahmedabad",
  "destinationLat": 23.2156,
  "destinationLng": 72.6369,
  "destinationLabel": "Infocity, Gandhinagar",
  "departureDate": "2026-08-09",
  "departureTime": "18:30",
  "seatsNeeded": 1,
  "isRecurring": true
}

// Response 200
{
  "searchRoute": {
    "distanceKm": 26.4,
    "durationMinutes": 33,
    "routeGeometry": "{\"type\":\"LineString\",\"coordinates\":[[72.587,23.030],[72.636,23.215]]}"
  },
  "rides": [
    {
      "id": "r-uuid",
      "driverId": "u-uuid",
      "driver": {
        "id": "u-uuid",
        "firstName": "Raj",
        "lastName": "Patel",
        "phone": "+919876543210",
        "rating": 4.9
      },
      "vehicle": {
        "id": "v-uuid",
        "model": "Swift Dzire",
        "registrationNumber": "GJ01AB1234"
      },
      "pickupLabel": "Iskcon, Ahmedabad",
      "pickupLat": 23.0300,
      "pickupLng": 72.5873,
      "destinationLabel": "Infocity, Gandhinagar",
      "destinationLat": 23.2156,
      "destinationLng": 72.6369,
      "departureAt": "2026-08-09T13:00:00.000Z",
      "availableSeats": 2,
      "farePerSeat": 120.00,
      "routeDistanceKm": 26.4,
      "routeDurationMinutes": 33,
      "status": "PUBLISHED"
    }
  ]
}
```

---

## Section 7 — Offer a Ride ❌ NEEDS WIRING

### What the frontend does (2-step flow)

**Step 1 — Offer Form**: Select vehicle from dropdown (populated from user's vehicles), pickup, destination, date+time, available seats, fare per seat.

**Step 2 — Route Confirmation**: Shows route on map. User clicks "Publish Ride" — currently adds to local state only. No API call.

### Endpoint needed

#### `POST /rides` — Authenticated USER (must own a vehicle)
```json
// Request
{
  "vehicleId": "v-uuid",
  "pickupLabel": "Iskcon, Ahmedabad",
  "pickupLat": 23.0300,
  "pickupLng": 72.5873,
  "destinationLabel": "Infocity, Gandhinagar",
  "destinationLat": 23.2156,
  "destinationLng": 72.6369,
  "departureAt": "2026-08-09T13:00:00.000Z",
  "availableSeats": 3,
  "farePerSeat": 120.00,
  "isRecurring": false
}

// Response 201
{
  "id": "r-uuid",
  "driverId": "u-uuid",
  "vehicleId": "v-uuid",
  "pickupLabel": "Iskcon, Ahmedabad",
  "pickupLat": 23.0300,
  "pickupLng": 72.5873,
  "destinationLabel": "Infocity, Gandhinagar",
  "destinationLat": 23.2156,
  "destinationLng": 72.6369,
  "departureAt": "2026-08-09T13:00:00.000Z",
  "availableSeats": 3,
  "farePerSeat": 120.00,
  "status": "PUBLISHED",
  "routeDistanceKm": 26.4,
  "routeDurationMinutes": 33,
  "routeGeometry": "{\"type\":\"LineString\",...}",
  "orgId": "org-uuid"
}
```

---

## Section 8 — Ride Booking (Join Requests) ❌ NEEDS WIRING

### What the frontend does
"Book Now" on a ride card → should call `POST /rides/:id/join-requests` → on success show the trip in "My Trips".

> Price negotiation UI is not built yet. Frontend always submits `agreedFare` equal to the listed `farePerSeat`.

### Endpoints needed

#### `POST /rides/:id/join-requests` — Authenticated USER (passenger)
```json
// Request
{
  "agreedFare": 120.00,
  "seatsRequested": 1,
  "initiatedBy": "PASSENGER"
}

// Response 201
{
  "message": "Join request submitted",
  "joinRequest": {
    "id": "jr-uuid",
    "status": "PENDING"
  }
}
```

#### `GET /rides/:id/join-requests` — Driver only (own ride)
```json
// Response 200
[
  {
    "id": "jr-uuid",
    "passengerId": "u-uuid",
    "passenger": { "firstName": "Jane", "lastName": "Doe", "phone": "+919876..." },
    "agreedFare": 120.00,
    "seatsRequested": 1,
    "status": "PENDING"
  }
]
```

#### `PATCH /rides/:id/join-requests/:requestId/accept` — Driver only
```json
// Response 200
{
  "message": "Join request accepted",
  "booking": { "id": "b-uuid", "seatsBooked": 1, "status": "BOOKED" },
  "trip": {
    "id": "t-uuid",
    "status": "RIDE_BOOKED",
    "rideId": "r-uuid",
    "driverId": "u-driver-uuid",
    "passengers": [
      { "id": "u-passenger-uuid", "firstName": "Jane", "seatsBooked": 1, "fareAmount": 120.00 }
    ]
  }
}
```

#### `PATCH /rides/:id/join-requests/:requestId/decline` — Driver only
```json
// Response 200
{ "message": "Join request declined" }
```

---

## Section 9 — My Trips (Trip Management) ❌ NEEDS WIRING

### What the frontend does
Employee dashboard → "My Trips" tab. Each trip card shows:
- Role badge (DRIVER / PASSENGER)
- Driver name + phone, passenger list
- Vehicle model + plate
- Pickup & destination labels, departure time
- Seats booked, fare amount
- Status badge (color-coded)
- Action buttons: Chat, Call, Live Track, Pay Now (PAYMENT_PENDING only)
- Driver-only: Start Trip / In Progress / Complete Trip buttons

### Endpoints needed

#### `GET /trips` — Authenticated USER
```json
// Response 200 — all active trips where caller is driver or passenger
[
  {
    "id": "t-uuid",
    "status": "TRIP_IN_PROGRESS",
    "rideId": "r-uuid",
    "ride": {
      "pickupLabel": "Iskcon, Ahmedabad",
      "pickupLat": 23.030,
      "pickupLng": 72.587,
      "destinationLabel": "Infocity, Gandhinagar",
      "destinationLat": 23.215,
      "destinationLng": 72.636,
      "departureAt": "2026-08-09T13:00:00.000Z",
      "farePerSeat": 120.00,
      "routeDistanceKm": 26.4,
      "routeDurationMinutes": 33,
      "routeGeometry": "{\"type\":\"LineString\",...}",
      "vehicle": { "model": "Swift Dzire", "registrationNumber": "GJ01AB1234" }
    },
    "driver": {
      "id": "u-driver-uuid",
      "firstName": "Raj",
      "lastName": "Patel",
      "phone": "+919876543210"
    },
    "passengers": [
      {
        "id": "u-passenger-uuid",
        "firstName": "Jane",
        "lastName": "Doe",
        "phone": "+919876543211",
        "seatsBooked": 1,
        "fareAmount": 120.00,
        "paymentStatus": "PENDING"
      }
    ],
    "callerRole": "PASSENGER"
  }
]
```

> `callerRole` is CRITICAL — frontend uses it to decide which action buttons to show. Compute it server-side by comparing `req.user.id` with `trip.driverId`.

#### `GET /trips/:id` — Participant only — same shape as above

#### `PATCH /trips/:id/status` — Driver only
```json
// Request
{ "status": "TRIP_STARTED" }
// Allowed: RIDE_BOOKED → TRIP_STARTED → TRIP_IN_PROGRESS → TRIP_COMPLETED → PAYMENT_PENDING → PAYMENT_COMPLETED

// Response 200
{ "message": "Trip status updated", "trip": { "id": "t-uuid", "status": "TRIP_STARTED" } }
```

---

## Section 10 — Live Trip Tracking ❌ NEEDS WIRING

### What the frontend does
"Live Track" button → opens `RouteMap` component in live tracking mode. Currently shows static route.

**With real backend**:
1. Connect to `/tracking` Socket.io namespace with JWT token
2. Emit `join:trip` → receive `route:info` → draw route on Leaflet map
3. Driver: emit `location:update` every 5s with GPS coords
4. Passenger: listen for `location:update` → update driver marker on map + show ETA

### Socket.io — `/tracking` namespace

#### Connect
```javascript
import { io } from 'socket.io-client';
const socket = io('http://localhost:3000/tracking', {
  auth: { token: '<accessToken>' }
});
socket.emit('join:trip', { tripId: 't-uuid' });
```

#### Server → Client on join: `route:info`
```json
{
  "tripId": "t-uuid",
  "routeGeometry": "{\"type\":\"LineString\",\"coordinates\":[[72.587,23.030],[72.636,23.215]]}"
}
```

#### Driver → Server: `location:update`
```json
{ "tripId": "t-uuid", "lat": 23.0780, "lng": 72.5400 }
```

#### Server → Room broadcast: `location:update`
```json
{ "tripId": "t-uuid", "lat": 23.0780, "lng": 72.5400, "etaMinutes": 12.5, "recordedAt": "2026-08-08T13:00:00.000Z" }
```

#### REST fallback: `GET /trips/:id/location` — Participant
```json
{
  "tripId": "t-uuid",
  "status": "TRIP_STARTED",
  "latestLocation": { "lat": 23.0780, "lng": 72.5400, "recordedAt": "..." },
  "routeGeometry": "{\"type\":\"LineString\",...}",
  "routeDistanceKm": 26.4,
  "routeDurationMinutes": 33
}
```

---

## Section 11 — In-Trip Chat ❌ NEEDS WIRING

### What the frontend does
"Chat" button → slide-up modal with message list + input. Currently hardcoded messages.

### Socket.io — `/chat` namespace

#### Connect & Join
```javascript
const chatSocket = io('http://localhost:3000/chat', { auth: { token: '<accessToken>' } });
chatSocket.emit('join:trip', { tripId: 't-uuid' });
```

#### Client → Server: `message:send`
```json
{ "tripId": "t-uuid", "content": "I'm waiting at Gate 2" }
```

#### Server → Room: `message:new`
```json
{
  "id": "msg-uuid",
  "tripId": "t-uuid",
  "senderId": "u-uuid",
  "content": "I'm waiting at Gate 2",
  "createdAt": "2026-08-08T13:02:00.000Z",
  "sender": { "id": "u-uuid", "firstName": "Jane", "lastName": "Doe", "role": "USER" }
}
```

#### REST: `GET /trips/:id/messages?page=1&limit=50` — load history on modal open
```json
[
  {
    "id": "msg-uuid",
    "tripId": "t-uuid",
    "senderId": "u-uuid",
    "content": "Hi! Reaching pickup in 5 mins",
    "createdAt": "2026-08-08T12:55:00.000Z",
    "sender": { "firstName": "Raj", "lastName": "Patel", "role": "USER" }
  }
]
```

#### REST: `POST /trips/:id/messages` — REST fallback send
```json
// Request
{ "content": "I'm waiting at Gate 2" }
// Response 201 — message object
```

---

## Section 12 — Voice Call Signaling ❌ NEEDS WIRING

### What the frontend does
"Call" button → call UI with timer and mute/end controls. Currently simulated locally.

### Socket.io — `/calls` namespace

| Event | Direction | Payload |
|---|---|---|
| `call:initiate` | Client → Server | `{ tripId, calleeId }` |
| `call:response` | Server → Caller | `{ status: "ringing" \| "callee_offline", callId }` |
| `call:incoming` | Server → Callee | `{ callId, tripId, caller: { id, firstName } }` |
| `call:accept` | Callee → Server | `{ callId }` |
| `call:accepted` | Server → Caller | `{ callId }` |
| `call:reject` | Callee → Server | `{ callId }` |
| `call:rejected` | Server → Caller | `{ callId }` |
| `call:end` | Either → Server | `{ callId }` |
| `call:ended` | Server → Other Party | `{ callId }` |

---

## Section 13 — Wallet & Payments ❌ NEEDS WIRING

### What the frontend does
**Wallet tab**: Shows balance (₹), recharge button, transaction history.

**Payment modal** (triggered from trip with `status === "PAYMENT_PENDING"`): User picks WALLET / CASH / CARD / UPI → submits → trip flips to PAYMENT_COMPLETED.

Currently: mock balance (₹500) and mock payment.

### Endpoints needed

#### `GET /wallet` — Authenticated USER
```json
{
  "id": "w-uuid",
  "userId": "u-uuid",
  "balance": 500.00,
  "transactions": [
    {
      "id": "tx-uuid",
      "type": "CREDIT",
      "amount": 500.00,
      "description": "Wallet recharge",
      "createdAt": "2026-08-08T10:00:00.000Z"
    }
  ]
}
```

#### `POST /wallet/recharge` — Authenticated USER
```json
// Request
{ "amount": 500.00 }

// Response 201
{
  "orderId": "order_razorpay_id",
  "amount": 500.00,
  "currency": "INR",
  "keyId": "rzp_test_xxxx"
}
```

#### `POST /wallet/recharge/verify` — Authenticated USER (after Razorpay callback)
```json
// Request
{
  "razorpay_order_id": "order_razorpay_id",
  "razorpay_payment_id": "pay_xxxx",
  "razorpay_signature": "<hmac_sha256_hex>",
  "amount": 500.00
}
// Response 200
{ "message": "Wallet recharge successful", "balance": 1000.00 }
```

#### `POST /payments/trips/:tripId/pay` — Trip passenger only
```json
// Request
{ "method": "WALLET" }
// Supported: "WALLET" | "CASH" | "CARD" | "UPI"

// Response 200
{
  "message": "Payment completed via wallet",
  "payment": { "id": "p-uuid", "amount": 120.00, "status": "PAID", "method": "WALLET" },
  "trip": { "id": "t-uuid", "status": "PAYMENT_COMPLETED" }
}

// Response 402 (insufficient balance)
{ "message": "Insufficient wallet balance to pay for this trip" }
```

---

## Section 14 — Ride History ❌ NEEDS WIRING

### What the frontend does
Employee dashboard → "Ride History" tab. Lists all completed/paid trips chronologically.

### Endpoint needed

#### `GET /trips/history?page=1&limit=20` — Authenticated USER
```json
{
  "total": 15,
  "page": 1,
  "limit": 20,
  "trips": [
    {
      "id": "t-uuid",
      "status": "PAYMENT_COMPLETED",
      "ride": {
        "pickupLabel": "Iskcon, Ahmedabad",
        "destinationLabel": "Infocity, Gandhinagar",
        "departureAt": "2026-08-01T13:00:00.000Z",
        "farePerSeat": 120.00,
        "routeDistanceKm": 26.4,
        "vehicle": { "model": "Swift Dzire", "registrationNumber": "GJ01AB1234" }
      },
      "driver": { "firstName": "Raj", "lastName": "Patel" },
      "callerRole": "PASSENGER",
      "fareAmount": 120.00
    }
  ]
}
```

---

## Section 15 — Reports & Analytics ❌ NEEDS WIRING

### What the frontend does
Org Admin panel → full analytics page with summary stats, fuel report, and vehicle-wise cost breakdown.

### Endpoints needed (ORG_ADMIN scope; SUPER_ADMIN with `?orgId=`)

#### `GET /reports/summary?startDate=2026-01-01&endDate=2026-12-31`
```json
{ "orgId": "org-uuid", "totalTrips": 42, "totalDistanceKm": 684.50, "dateRange": { "startDate": "2026-01-01", "endDate": "2026-12-31" } }
```

#### `GET /reports/fuel`
```json
{
  "orgId": "org-uuid", "orgName": "Acme Corporation",
  "totalDistanceKm": 684.50, "assumedKmPerLitre": 15.0,
  "fuelCostPerLitre": 100.0, "estimatedFuelLitres": 45.63, "estimatedTotalFuelCost": 4563.00
}
```

#### `GET /reports/cost-per-km`
```json
{
  "orgId": "org-uuid", "orgName": "Acme Corporation",
  "costPerKmDefault": 15.0, "derivedFuelCostPerKm": 6.67,
  "fuelCostPerLitre": 100.0, "assumedKmPerLitre": 15.0
}
```

#### `GET /reports/vehicle-cost`
```json
[
  {
    "vehicleId": "v-uuid", "model": "Swift Dzire", "registrationNumber": "GJ01AB1234",
    "totalTrips": 18, "totalDistanceKm": 310.50,
    "estimatedFuelLitres": 20.70, "estimatedFuelCost": 2070.00
  }
]
```

---

## Section 16 — Schema Additions Required

| Entity | Field | Type | Required For |
|---|---|---|---|
| `User` | `employeeId` | `String?` | Employee cards in Org Admin panel |
| `User` | `carpoolAccess` | `Boolean (default: true)` | Org Admin toggle per employee |
| `User` | `rating` | `Float?` | Driver rating on ride cards |
| `Organization` | `slug` | `String (unique)` | Dynamic route `/[orgSlug]/admin` |
| `Organization` | `status` | `Enum(ACTIVE, PENDING_SETUP, SUSPENDED)` | Super Admin org table |
| `OrgSettings` | `subsidyPercent` | `Float` | Org config panel |
| `OrgSettings` | `baseRideCharge` | `Float` | Org config panel |
| `OrgSettings` | `maxRidersPerCarpool` | `Int` | Org config panel |
| `OrgSettings` | `autoMatchEnabled` | `Boolean` | Org config panel |
| `OrgSettings` | `departmentRestriction` | `Boolean` | Org config panel |
| `Vehicle` | `fuelType` | `Enum(PETROL, DIESEL, ELECTRIC, HYBRID)` | Vehicle card display |
| `Vehicle` | `status` | `Enum(VERIFIED, PENDING, REJECTED)` | Vehicle card status badge |
| `Trip` | `callerRole` (computed) | — | Driver vs Passenger action buttons |

---

## Section 17 — Integration Handshake Order

When backend is ready, integrate in this sequence:

1. `frontend/.env.local` → add `NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1`
2. Test Auth flow end-to-end — login, tokens stored, redirects correct
3. Wire **Vehicles**: replace `INITIAL_VEHICLES` mock in `dashboard/page.tsx` with `GET /vehicles`
4. Wire **Saved Places**: replace `INITIAL_SAVED_PLACES` with `GET /settings/saved-places`
5. Wire **Find a Ride**: call `POST /rides/search` on route confirm step
6. Wire **Offer a Ride**: call `POST /rides` on "Publish Ride" click
7. Wire **Book Now**: call `POST /rides/:id/join-requests` instead of local trip creation
8. Wire **My Trips**: replace `INITIAL_TRIPS` with `GET /trips`
9. Wire **Trip Status**: `PATCH /trips/:id/status` for driver buttons
10. Wire **Live Tracking**: Socket.io `/tracking` in `RouteMap.tsx`
11. Wire **Chat**: Socket.io `/chat` in chat modal
12. Wire **Wallet**: `GET /wallet` + recharge + verify
13. Wire **Payment**: `POST /payments/trips/:tripId/pay`
14. Wire **Ride History**: `GET /trips/history`
15. Wire **Reports**: all `GET /reports/*`

---

## Section 18 — Error Handling Contract

Frontend reads errors in this exact shape — **please follow this on all endpoints**:
```json
{
  "message": "Human-readable error summary",
  "errors": [
    { "field": "email", "message": "Invalid email address" }
  ]
}
```

| HTTP Status | Frontend behaviour |
|---|---|
| `400` | Shows `message` as error toast |
| `401` | Clears tokens, redirects to `/login` |
| `402` | Shows wallet insufficient balance message inline |
| `403` | Shows `message` inline (pending/rejected account) |
| `404` | Shows not-found message |
| `409` | Shows conflict message (e.g. cannot delete vehicle) |
| `500` | Shows generic "Something went wrong" toast |
