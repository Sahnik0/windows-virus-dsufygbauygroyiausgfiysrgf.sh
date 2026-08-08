# Enterprise Carpooling Platform — Complete API & Frontend Integration Reference

Welcome to the REST API and Socket.io integration guide for the Enterprise Carpooling Platform backend. This document provides exact request/response specifications, authentication flows, data types, status codes, error models, and real-time Socket.io event schemas needed to build the frontend.

---

## Table of Contents
1. [General System Architecture & Base URL](#1-general-system-architecture--base-url)
2. [Authentication & Authorization Model](#2-authentication--authorization-model)
3. [Standard Response & Error Formats](#3-standard-response--error-formats)
4. [Module 1: Authentication (`/auth`)](#module-1-authentication-auth)
5. [Module 2: Organization Management (`/orgs`)](#module-2-organization-management-orgs)
6. [Module 3: User Management (`/users`)](#module-3-user-management-users)
7. [Module 4: Vehicles (`/vehicles`)](#module-4-vehicles-vehicles)
8. [Module 5: Saved Places (`/settings/saved-places`)](#module-5-saved-places-settingssaved-places)
9. [Module 6: Rides & Search (`/rides`)](#module-6-rides--search-rides)
10. [Module 7: Price Negotiations (`/rides/:id/negotiations`)](#module-7-price-negotiations-ridesidnegotiations)
11. [Module 8: Join Requests & Trip Lifecycle (`/rides` & `/trips`)](#module-8-join-requests--trip-lifecycle-rides--trips)
12. [Module 9: Live Tracking, In-Trip Chat & Call REST APIs](#module-9-live-tracking-in-trip-chat--call-rest-apis)
13. [Module 10: Wallet & Payments (`/wallet` & `/payments`)](#module-10-wallet--payments-wallet--payments)
14. [Module 11: Reports (`/reports`)](#module-11-reports-reports)
15. [Real-Time Socket.io Integration (`/tracking`, `/chat`, `/calls`)](#real-time-socketio-integration-tracking-chat-calls)

---

## 1. General System Architecture & Base URL

- **HTTP REST Base URL**: `http://localhost:3000/api/v1`
- **Socket.io Server URL**: `ws://localhost:3000` (or `http://localhost:3000`)
- **Health Check Endpoint**: `GET http://localhost:3000/health` → `200 OK` `{ "status": "ok" }`

---

## 2. Authentication & Authorization Model

### Headers
Every authenticated request must include the standard Bearer token header:
```http
Authorization: Bearer <accessToken>
```

### Roles & Scopes
- **`SUPER_ADMIN`**: Platform administrator (no org restriction). Can create orgs, provision org admins, view all users/reports across any organization.
- **`ORG_ADMIN`**: Organization administrator. Manages user approvals, employee list, vehicles, and reporting within their own organization (`orgId`).
- **`USER`**: Regular employee account. Belongs to a single organization (`orgId`). Can offer rides (if owning a vehicle) and search/book rides as a passenger.

### Account Approval Lifecycle
1. User registers (`POST /auth/register`) → Account created with `verificationStatus: "PENDING"`. Returns a short-lived `pendingToken`.
2. User uploads ID proof (`POST /auth/register/id-proof` with `Bearer <pendingToken>`).
3. Account remains `PENDING` until an `ORG_ADMIN` or `SUPER_ADMIN` approves it (`PATCH /users/:id/approve`).
4. Attempting to log in before approval returns `403 Forbidden` with status message `PENDING` or `REJECTED`.
5. Once `APPROVED`, `POST /auth/login` returns access and refresh tokens.

---

## 3. Standard Response & Error Formats

### Success Response
JSON payloads are returned directly or wrapped in standard objects:
```json
{
  "message": "Operation successful",
  "data": { ... }
}
```

### Error Response Schema
All API errors follow a predictable structure:
```json
{
  "message": "Specific error description or validation title",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email address"
    }
  ]
}
```

### Common HTTP Status Codes
- **`200 OK`**: Request succeeded.
- **`201 Created`**: Resource created successfully.
- **`400 Bad Request`**: Request validation error or invalid business logic state.
- **`401 Unauthorized`**: Token missing, expired, or invalid.
- **`402 Payment Required`**: Insufficient wallet balance for trip payment.
- **`403 Forbidden`**: Role permission denied, unapproved user status, or cross-org boundary violation.
- **`404 Not Found`**: Resource does not exist.
- **`409 Conflict`**: Conflict with existing state (e.g. active ride blocking vehicle deletion or out-of-turn offer).
- **`500 Internal Server Error`**: Unexpected server-side failure.

---

## Module 1: Authentication (`/auth`)

### 1. Register User
- **Method & Path**: `POST /auth/register`
- **Auth**: Public
- **Request Body**:
  ```json
  {
    "email": "employee@acme.com",
    "password": "Password123!",
    "firstName": "Jane",
    "lastName": "Doe",
    "phone": "+19876543210",
    "orgId": "acme-corp-org-id"
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "message": "Registration successful. Please upload an ID proof document to complete registration.",
    "user": {
      "id": "u-12345",
      "email": "employee@acme.com",
      "firstName": "Jane",
      "lastName": "Doe",
      "role": "USER",
      "verificationStatus": "PENDING"
    },
    "pendingToken": "eyJhbGciOiJIUzI1Ni..."
  }
  ```

### 2. Upload ID Proof
- **Method & Path**: `POST /auth/register/id-proof`
- **Auth**: `Authorization: Bearer <pendingToken>` (Accepts ONLY the `pendingToken` issued by `/register`)
- **Content-Type**: `multipart/form-data`
- **Form Field**: `idProof` (File: `.jpg`, `.jpeg`, `.png`, `.pdf`, max 5MB)
- **Response `200 OK`**:
  ```json
  {
    "message": "ID proof uploaded successfully. Your account is now pending admin approval.",
    "userId": "u-12345",
    "verificationStatus": "PENDING"
  }
  ```

### 3. Login
- **Method & Path**: `POST /auth/login`
- **Auth**: Public
- **Request Body**:
  ```json
  {
    "email": "employee@acme.com",
    "password": "Password123!"
  }
  ```
- **Response `200 OK`** (If Approved):
  ```json
  {
    "accessToken": "eyJhbGciOiJIUzI1Ni...",
    "refreshToken": "eyJhbGciOiJIUzI1Ni...",
    "user": {
      "id": "u-12345",
      "email": "employee@acme.com",
      "firstName": "Jane",
      "lastName": "Doe",
      "role": "USER",
      "orgId": "acme-corp-org-id",
      "verificationStatus": "APPROVED"
    }
  }
  ```
- **Response `403 Forbidden`** (If Pending):
  ```json
  {
    "message": "Your ID proof is under review. Please wait for admin approval."
  }
  ```
- **Response `403 Forbidden`** (If Rejected):
  ```json
  {
    "message": "Account registration rejected: ID document blurred and unreadable",
    "rejectionReason": "ID document blurred and unreadable"
  }
  ```

### 4. Refresh Access Token
- **Method & Path**: `POST /auth/refresh`
- **Auth**: Public
- **Request Body**:
  ```json
  {
    "refreshToken": "eyJhbGciOiJIUzI1Ni..."
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "accessToken": "eyJhbGciOiJIUzI1Ni..."
  }
  ```

### 5. Logout
- **Method & Path**: `POST /auth/logout`
- **Auth**: Public / Authenticated
- **Request Body**:
  ```json
  {
    "refreshToken": "eyJhbGciOiJIUzI1Ni..."
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "message": "Logged out successfully"
  }
  ```

---

## Module 2: Organization Management (`/orgs`)

### 1. Create Organization
- **Method & Path**: `POST /orgs`
- **Auth**: `SUPER_ADMIN`
- **Request Body**:
  ```json
  {
    "name": "Acme Corporation",
    "fuelCostPerLitre": 100.0,
    "costPerKmDefault": 15.0
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "id": "org-999",
    "name": "Acme Corporation",
    "fuelCostPerLitre": 100,
    "costPerKmDefault": 15,
    "createdAt": "2026-08-08T10:00:00.000Z",
    "updatedAt": "2026-08-08T10:00:00.000Z"
  }
  ```

### 2. List All Organizations
- **Method & Path**: `GET /orgs`
- **Auth**: `SUPER_ADMIN`
- **Response `200 OK`**: Array of org objects with `_count.users`.

### 3. Provision Org Admin
- **Method & Path**: `POST /orgs/:orgId/admins`
- **Auth**: `SUPER_ADMIN`
- **Request Body**:
  ```json
  {
    "email": "admin@acme.com",
    "password": "Password123!",
    "firstName": "Acme",
    "lastName": "Admin",
    "phone": "+1234567890"
  }
  ```
- **Response `201 Created`**: Returns created `ORG_ADMIN` user with `verificationStatus: "APPROVED"`.

### 4. List Org Admins
- **Method & Path**: `GET /orgs/:orgId/admins`
- **Auth**: `SUPER_ADMIN`
- **Response `200 OK`**: Array of `ORG_ADMIN` accounts for that organization.

### 5. Update Organization Settings
- **Method & Path**: `PATCH /orgs/:orgId/settings`
- **Auth**: `ORG_ADMIN` (own org) or `SUPER_ADMIN`
- **Request Body**:
  ```json
  {
    "fuelCostPerLitre": 105.5,
    "costPerKmDefault": 16.0
  }
  ```
- **Response `200 OK`**: Updated org settings object.

---

## Module 3: User Management (`/users`)

### 1. List Pending User Approvals
- **Method & Path**: `GET /users/pending`
- **Auth**: `ORG_ADMIN` (own org), `SUPER_ADMIN` (all or `?orgId=`)
- **Query Params**: `?orgId=uuid` (optional for SUPER_ADMIN)
- **Response `200 OK`**:
  ```json
  [
    {
      "id": "u-12345",
      "email": "employee@acme.com",
      "firstName": "Jane",
      "lastName": "Doe",
      "role": "USER",
      "orgId": "acme-corp-org-id",
      "verificationStatus": "PENDING",
      "idProofPath": "/uploads/id-proofs/u-12345-1786177.png",
      "idProofUploadedAt": "2026-08-08T10:05:00.000Z"
    }
  ]
  ```

### 2. View/Stream Uploaded ID Proof File
- **Method & Path**: `GET /users/:id/id-proof`
- **Auth**: `ORG_ADMIN` (own org), `SUPER_ADMIN`
- **Response `200 OK`**: Streams file (`image/png`, `application/pdf`, etc.).

### 3. Approve User Registration
- **Method & Path**: `PATCH /users/:id/approve`
- **Auth**: `ORG_ADMIN` (own org), `SUPER_ADMIN`
- **Response `200 OK`**:
  ```json
  {
    "message": "User successfully approved",
    "user": {
      "id": "u-12345",
      "email": "employee@acme.com",
      "verificationStatus": "APPROVED"
    }
  }
  ```

### 4. Reject User Registration
- **Method & Path**: `PATCH /users/:id/reject`
- **Auth**: `ORG_ADMIN` (own org), `SUPER_ADMIN`
- **Request Body**:
  ```json
  {
    "rejectionReason": "ID proof document image is blurred and unreadable"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "message": "User verification rejected",
    "user": {
      "id": "u-12345",
      "verificationStatus": "REJECTED",
      "rejectionReason": "ID proof document image is blurred and unreadable"
    }
  }
  ```

### 5. List Organization Users
- **Method & Path**: `GET /users`
- **Auth**: `ORG_ADMIN` (returns own org users), `SUPER_ADMIN` (`?orgId=`)
- **Response `200 OK`**: Array of user profiles.

### 6. Get User Details
- **Method & Path**: `GET /users/:id`
- **Auth**: `USER` (own profile only), `ORG_ADMIN` (own org users), `SUPER_ADMIN`
- **Response `200 OK`**: User profile object.

### 7. Update User Profile
- **Method & Path**: `PATCH /users/:id`
- **Auth**: `USER` / `ORG_ADMIN` (own profile), `ORG_ADMIN` (own org users), `SUPER_ADMIN`
- **Request Body**:
  ```json
  {
    "firstName": "Jane",
    "lastName": "Smith",
    "phone": "+19998887777"
  }
  ```
- **Response `200 OK`**: Updated user profile.

---

## Module 4: Vehicles (`/vehicles`)

### 1. Register Vehicle
- **Method & Path**: `POST /vehicles`
- **Auth**: `USER` / `ORG_ADMIN` (owner is automatically set to `req.user.id`)
- **Request Body**:
  ```json
  {
    "model": "Toyota Prius",
    "registrationNumber": "KA-01-AB-1234",
    "seatingCapacity": 4
  }
  ```
- **Response `201 Created`**: Vehicle object.

### 2. List Vehicles
- **Method & Path**: `GET /vehicles`
- **Auth**: Authenticated
- **Query Params**: `?all=true` (Org Admins can pass `?all=true` to view all vehicles in their org)
- **Response `200 OK`**: Array of vehicle objects.

### 3. Get Vehicle by ID
- **Method & Path**: `GET /vehicles/:id`
- **Auth**: Owner or `ORG_ADMIN` (same org)
- **Response `200 OK`**: Vehicle detail object.

### 4. Update Vehicle
- **Method & Path**: `PATCH /vehicles/:id`
- **Auth**: Vehicle owner only
- **Request Body**:
  ```json
  {
    "model": "Toyota Prius Prime",
    "seatingCapacity": 4
  }
  ```
- **Response `200 OK`**: Updated vehicle object.

### 5. Delete Vehicle
- **Method & Path**: `DELETE /vehicles/:id`
- **Auth**: Vehicle owner only
- **Response `200 OK`**: `{ "message": "Vehicle deleted successfully" }`
- **Response `409 Conflict`**: Returned if vehicle is attached to an active published/full ride.

---

## Module 5: Saved Places (`/settings/saved-places`)

### 1. Create Saved Place
- **Method & Path**: `POST /settings/saved-places`
- **Auth**: `USER` / `ORG_ADMIN`
- **Request Body**:
  ```json
  {
    "label": "Home",
    "address": "123 Tech Park Road, Koramangala, Bangalore",
    "latitude": 12.9352,
    "longitude": 77.6245
  }
  ```
- **Response `201 Created`**: Saved place object.

### 2. List Personal Saved Places
- **Method & Path**: `GET /settings/saved-places`
- **Auth**: Owner only (strict personal scoping)
- **Response `200 OK`**: Array of saved places.

### 3. Get Saved Place by ID
- **Method & Path**: `GET /settings/saved-places/:id`
- **Auth**: Owner only
- **Response `200 OK`**: Saved place detail object.

### 4. Update Saved Place
- **Method & Path**: `PATCH /settings/saved-places/:id`
- **Auth**: Owner only
- **Request Body**: `{ "label": "Office", "address": "456 IT Expressway, Whitefield" }`
- **Response `200 OK`**: Updated saved place object.

### 5. Delete Saved Place
- **Method & Path**: `DELETE /settings/saved-places/:id`
- **Auth**: Owner only
- **Response `200 OK`**: `{ "message": "Saved place deleted successfully" }`

---

## Module 6: Rides & Search (`/rides`)

### 1. Publish a Ride Offer
- **Method & Path**: `POST /rides`
- **Auth**: `USER` / `ORG_ADMIN` (Must own at least one registered vehicle)
- **Request Body**:
  ```json
  {
    "vehicleId": "v-12345",
    "pickupLabel": "Koramangala, Bangalore",
    "pickupLat": 12.9352,
    "pickupLng": 77.6245,
    "destinationLabel": "Whitefield, Bangalore",
    "destinationLat": 12.9698,
    "destinationLng": 77.7499,
    "departureAt": "2026-08-09T08:30:00.000Z",
    "availableSeats": 3,
    "farePerSeat": 150.00,
    "isRecurring": false
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "id": "r-9999",
    "driverId": "u-12345",
    "vehicleId": "v-12345",
    "pickupLabel": "Koramangala, Bangalore",
    "pickupLat": 12.9352,
    "pickupLng": 77.6245,
    "destinationLabel": "Whitefield, Bangalore",
    "destinationLat": 12.9698,
    "destinationLng": 77.7499,
    "departureAt": "2026-08-09T08:30:00.000Z",
    "availableSeats": 3,
    "farePerSeat": 150,
    "status": "PUBLISHED",
    "routeGeometry": "{\"type\":\"LineString\",\"coordinates\":[...]}",
    "routeDistanceKm": 17.24,
    "routeDurationMinutes": 35.5,
    "orgId": "acme-corp-org-id"
  }
  ```

### 2. Search Rides
- **Method & Path**: `POST /rides/search`
- **Auth**: `USER` / `ORG_ADMIN`
- **Request Body**:
  ```json
  {
    "pickupLat": 12.9352,
    "pickupLng": 77.6245,
    "destinationLat": 12.9698,
    "destinationLng": 77.7499,
    "departureDate": "2026-08-09",
    "seatsNeeded": 1,
    "isRecurring": false
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "searchRoute": {
      "distanceKm": 17.24,
      "durationMinutes": 35.5,
      "routeGeometry": "{\"type\":\"LineString\",...}",
      "routeSource": "osrm_driving"
    },
    "rides": [ /* Array of published rides matching criteria */ ]
  }
  ```

### 3. Discover Nearby Drivers (Passenger-Facing)
- **Method & Path**: `GET /rides/nearby-drivers`
- **Auth**: `USER`
- **Query Params**: `?lat=12.9352&lng=77.6245&radiusKm=2.0`
- **Response `200 OK`**: Array of `PUBLISHED` rides in org whose pickup point passes within radius.

### 4. Discover Nearby Passengers (Driver-Facing)
- **Method & Path**: `GET /rides/:id/nearby-passengers`
- **Auth**: Driver only (own ride)
- **Query Params**: `?radiusKm=2.0`
- **Response `200 OK`**: Array of passenger saved places within radius of driver pickup.

### 5. Get Ride Details
- **Method & Path**: `GET /rides/:id`
- **Auth**: Authenticated (same org)
- **Response `200 OK`**: Detailed ride object with vehicle and driver info.

---

## Module 7: Price Negotiations (`/rides/:id/negotiations`)

> **Product Rule**: Price negotiation is a turn-based structured process separate from chat. A passenger can initiate a counter-offer below listed price. Drivers and passengers exchange discrete counter-offers until one accepts or rejects.

### 1. Initiate Price Negotiation
- **Method & Path**: `POST /rides/:id/negotiations`
- **Auth**: Passenger only
- **Request Body**: `{ "amount": 120.00 }`
- **Response `201 Created`**: Negotiation object (`status: "OPEN"`).

### 2. List Ride Negotiations
- **Method & Path**: `GET /rides/:id/negotiations`
- **Auth**: Driver only (own ride)
- **Response `200 OK`**: List of open negotiations for driver review.

### 3. Get Negotiation Offer History
- **Method & Path**: `GET /rides/:id/negotiations/:negotiationId`
- **Auth**: Participant (Passenger or Driver)
- **Response `200 OK`**: Full history of counter-offers.

### 4. Send Counter-Offer
- **Method & Path**: `POST /rides/:id/negotiations/:negotiationId/counter`
- **Auth**: Participant (Must be caller's turn; cannot counter own offer twice in a row)
- **Request Body**: `{ "amount": 135.00 }`
- **Response `200 OK`**: Updated negotiation with new offer added.
- **Response `400 Bad Request`**: Returned if calling out of turn.

### 5. Accept Negotiation
- **Method & Path**: `PATCH /rides/:id/negotiations/:negotiationId/accept`
- **Auth**: Participant (Must accept the *other* party's latest offer)
- **Response `200 OK`**:
  ```json
  {
    "message": "Negotiation accepted",
    "agreedFare": 135.00,
    "negotiation": { "status": "ACCEPTED" }
  }
  ```

### 6. Reject Negotiation
- **Method & Path**: `PATCH /rides/:id/negotiations/:negotiationId/reject`
- **Auth**: Participant
- **Response `200 OK`**: Sets status to `REJECTED`.

---

## Module 8: Join Requests & Trip Lifecycle (`/rides` & `/trips`)

### 1. Submit Join Request
- **Method & Path**: `POST /rides/:id/join-requests`
- **Auth**: `USER`
- **Request Body**:
  ```json
  {
    "agreedFare": 135.00,
    "seatsRequested": 1,
    "initiatedBy": "PASSENGER"
  }
  ```
- **Rule**: `agreedFare` MUST equal listed `Ride.farePerSeat` OR match an `ACCEPTED` `Negotiation`. Unnegotiated arbitrary fares return `400 Bad Request`.

### 2. List Pending Join Requests
- **Method & Path**: `GET /rides/:id/join-requests`
- **Auth**: Driver only (own ride)
- **Response `200 OK`**: Array of pending join requests.

### 3. Accept Join Request
- **Method & Path**: `PATCH /rides/:id/join-requests/:requestId/accept`
- **Auth**: Reversed party (Driver accepts passenger request; Passenger accepts driver invitation)
- **Response `200 OK`**:
  ```json
  {
    "message": "Join request accepted and seat booked successfully",
    "booking": { "id": "b-111", "seatsBooked": 1, "status": "BOOKED" },
    "trip": { "id": "t-222", "status": "RIDE_BOOKED" },
    "joinRequest": { "status": "ACCEPTED" }
  }
  ```

### 4. Decline Join Request
- **Method & Path**: `PATCH /rides/:id/join-requests/:requestId/decline`
- **Auth**: Authorized participant
- **Response `200 OK`**: `{ "message": "Join request declined" }`

### 5. Get My Active Trips
- **Method & Path**: `GET /trips`
- **Auth**: `USER` / `ORG_ADMIN`
- **Response `200 OK`**: Trips where caller is driver or booked passenger.

### 6. Get Trip Details
- **Method & Path**: `GET /trips/:id`
- **Auth**: Participant or `SUPER_ADMIN`
- **Response `200 OK`**: Complete trip info, route, driver, and passenger list.

### 7. Advance Trip Lifecycle Status
- **Method & Path**: `PATCH /trips/:id/status`
- **Auth**: Driver only
- **Request Body**: `{ "status": "TRIP_STARTED" }`
- **Allowed States**: `RIDE_BOOKED` → `TRIP_STARTED` → `TRIP_IN_PROGRESS` → `TRIP_COMPLETED` → `PAYMENT_PENDING` → `PAYMENT_COMPLETED`.
- **Response `400 Bad Request`**: Returned if attempting an out-of-order transition (e.g. `TRIP_COMPLETED → RIDE_BOOKED`).

### 8. Get Paginated Trip History
- **Method & Path**: `GET /trips/history`
- **Auth**: `USER` / `ORG_ADMIN`
- **Query Params**: `?page=1&limit=20`
- **Response `200 OK`**: Paginated array of completed/payment-phase trips.

---

## Module 9: Live Tracking, In-Trip Chat & Call REST APIs

### 1. REST Fallback: Vehicle Location & Route Geometry
- **Method & Path**: `GET /trips/:id/location`
- **Auth**: Trip participant
- **Response `200 OK`**:
  ```json
  {
    "tripId": "t-222",
    "status": "TRIP_STARTED",
    "latestLocation": {
      "id": "loc-1",
      "lat": 12.9780,
      "lng": 77.6400,
      "recordedAt": "2026-08-08T11:00:00.000Z"
    },
    "routeGeometry": "{\"type\":\"LineString\",...}",
    "routeDistanceKm": 17.24,
    "routeDurationMinutes": 35.5
  }
  ```

### 2. REST Fallback: Get In-Trip Messages
- **Method & Path**: `GET /trips/:id/messages`
- **Auth**: Trip participant
- **Query Params**: `?page=1&limit=50`
- **Response `200 OK`**: Paginated chat history.

### 3. REST Fallback: Send In-Trip Message
- **Method & Path**: `POST /trips/:id/messages`
- **Auth**: Trip participant
- **Request Body**: `{ "content": "I am waiting at the pickup point" }`
- **Response `201 Created`**: Message object (also broadcasts real-time to `/chat` socket room).

### 4. Mark Messages as Read
- **Method & Path**: `PATCH /trips/:id/messages/read`
- **Auth**: Trip participant
- **Response `200 OK`**: `{ "message": "Messages marked as read", "count": 2 }`

---

## Module 10: Wallet & Payments (`/wallet` & `/payments`)

### 1. Get Wallet Balance
- **Method & Path**: `GET /wallet`
- **Auth**: `USER` / `ORG_ADMIN`
- **Response `200 OK`**:
  ```json
  {
    "id": "w-100",
    "userId": "u-12345",
    "balance": 500.00,
    "transactions": [ ... ]
  }
  ```

### 2. Create Wallet Recharge Order (Razorpay)
- **Method & Path**: `POST /wallet/recharge`
- **Auth**: `USER` / `ORG_ADMIN`
- **Request Body**: `{ "amount": 500.00 }`
- **Response `201 Created`**:
  ```json
  {
    "orderId": "order_sim_1786178039252",
    "amount": 500.00,
    "currency": "INR",
    "keyId": "rzp_test_placeholder"
  }
  ```

### 3. Verify Wallet Recharge (HMAC Signature)
- **Method & Path**: `POST /wallet/recharge/verify`
- **Auth**: `USER` / `ORG_ADMIN`
- **Request Body**:
  ```json
  {
    "razorpay_order_id": "order_sim_1786178039252",
    "razorpay_payment_id": "pay_123456789",
    "razorpay_signature": "<hmac_sha256_hex_signature>",
    "amount": 500.00
  }
  ```
- **Response `200 OK`**: `{ "message": "Wallet recharge successful", "balance": 1000.00 }`
- **Response `400 Bad Request`**: Returned if HMAC signature verification fails.

### 4. Pay for Trip (`PAYMENT_PENDING` Phase)
- **Method & Path**: `POST /payments/trips/:tripId/pay`
- **Auth**: Trip passenger
- **Request Body**: `{ "method": "WALLET" }` (Supported: `"WALLET"`, `"CASH"`, `"CARD"`, `"UPI"`)
- **Response `200 OK`** (Wallet / Cash):
  ```json
  {
    "message": "Payment completed via wallet",
    "payment": { "id": "p-1", "amount": 180, "status": "PAID", "method": "WALLET" },
    "trip": { "id": "t-222", "status": "PAYMENT_COMPLETED" }
  }
  ```
- **Response `402 Payment Required`** (Wallet): Returned if wallet balance is lower than trip fare (`"Insufficient wallet balance to pay for this trip"`).

### 5. Razorpay Webhook Callback
- **Method & Path**: `POST /payments/webhook`
- **Auth**: Razorpay Signature Header `x-razorpay-signature`
- **Behavior**: Idempotently marks payment `PAID` and advances trip status to `PAYMENT_COMPLETED`.

---

## Module 11: Reports (`/reports`)

> **Access Restriction**: Accessible ONLY by `ORG_ADMIN` (own org) and `SUPER_ADMIN` (`?orgId=`).

### 1. Organization Summary Report
- **Method & Path**: `GET /reports/summary`
- **Query Params**: `?startDate=2026-01-01&endDate=2026-12-31`
- **Response `200 OK`**:
  ```json
  {
    "orgId": "acme-corp-org-id",
    "totalTrips": 42,
    "totalDistanceKm": 684.50,
    "dateRange": { "startDate": "2026-01-01", "endDate": "2026-12-31" }
  }
  ```

### 2. Fuel Report
- **Method & Path**: `GET /reports/fuel`
- **Response `200 OK`**:
  ```json
  {
    "orgId": "acme-corp-org-id",
    "orgName": "Acme Corporation",
    "totalDistanceKm": 684.50,
    "assumedKmPerLitre": 15.0,
    "fuelCostPerLitre": 100.0,
    "estimatedFuelLitres": 45.63,
    "estimatedTotalFuelCost": 4563.00
  }
  ```

### 3. Cost Per Km Report
- **Method & Path**: `GET /reports/cost-per-km`
- **Response `200 OK`**:
  ```json
  {
    "orgId": "acme-corp-org-id",
    "orgName": "Acme Corporation",
    "costPerKmDefault": 15.0,
    "derivedFuelCostPerKm": 6.67,
    "fuelCostPerLitre": 100.0,
    "assumedKmPerLitre": 15.0
  }
  ```

### 4. Vehicle Cost Report
- **Method & Path**: `GET /reports/vehicle-cost`
- **Response `200 OK`**: Array of vehicles with `totalTrips`, `totalDistanceKm`, `estimatedFuelLitres`, and `estimatedFuelCost`.

---

## Real-Time Socket.io Integration (`/tracking`, `/chat`, `/calls`)

### Connection Setup
Connect using standard `socket.io-client` with JWT auth handshake token:
```javascript
import { io } from 'socket.io-client';

const token = 'YOUR_JWT_ACCESS_TOKEN';

const trackingSocket = io('http://localhost:3000/tracking', { auth: { token } });
const chatSocket = io('http://localhost:3000/chat', { auth: { token } });
const callsSocket = io('http://localhost:3000/calls', { auth: { token } });
```

---

### Namespace 1: `/tracking` (Live Vehicle Movement)

#### Client Emit: `join:trip`
- **Payload**: `{ "tripId": "t-222" }`
- **Behavior**: Joins room `trip:t-222`.

#### Server Event: `route:info` (Emitted to client on join)
- **Payload**:
  ```json
  {
    "tripId": "t-222",
    "routeGeometry": "{\"type\":\"LineString\",\"coordinates\":[[77.6245,12.9352],[77.64,12.978]...]}"
  }
  ```

#### Driver Emit: `location:update`
- **Payload**: `{ "tripId": "t-222", "lat": 12.9780, "lng": 77.6400 }`
- **Server Guard**: Allowed ONLY when `Trip.status` is `TRIP_STARTED` or `TRIP_IN_PROGRESS`.

#### Server Broadcast: `location:update` (Broadcasted to room `trip:t-222`)
- **Payload**:
  ```json
  {
    "tripId": "t-222",
    "lat": 12.9780,
    "lng": 77.6400,
    "etaMinutes": 12.5,
    "recordedAt": "2026-08-08T11:00:00.000Z"
  }
  ```
- **Throttling Note**: Server throttles live OSRM route ETA calculations to at most once per 30 seconds per trip.

---

### Namespace 2: `/chat` (In-Trip Messaging)

#### Client Emit: `join:trip`
- **Payload**: `{ "tripId": "t-222" }`

#### Client Emit: `message:send`
- **Payload**: `{ "tripId": "t-222", "content": "I am standing near Gate 2" }`

#### Server Broadcast: `message:new` (Broadcasted to room `trip:t-222`)
- **Payload**:
  ```json
  {
    "id": "msg-555",
    "tripId": "t-222",
    "senderId": "u-12345",
    "content": "I am standing near Gate 2",
    "createdAt": "2026-08-08T11:02:00.000Z",
    "sender": {
      "id": "u-12345",
      "firstName": "Jane",
      "lastName": "Doe",
      "role": "USER"
    }
  }
  ```

---

### Namespace 3: `/calls` (WebRTC Call Signaling)

> **Scope Note**: Backend handles call signaling state machine only (ringing, accept, reject, end). Audio transport is P2P WebRTC client-side.

#### 1. Initiate Call
- **Client Emit**: `call:initiate` → `{ "tripId": "t-222", "calleeId": "u-passenger-99" }`
- **Server Response to Caller**: `call:response` → `{ "status": "ringing", "callId": "call-777" }`
- **Server Event to Callee**: `call:incoming` →
  ```json
  {
    "callId": "call-777",
    "tripId": "t-222",
    "caller": { "id": "u-driver-1", "firstName": "John" }
  }
  ```
- **Offline Callee Case**: If callee is disconnected, server responds to caller:
  `call:response` → `{ "status": "callee_offline", "message": "Callee is currently offline..." }`

#### 2. Accept Call
- **Callee Emit**: `call:accept` → `{ "callId": "call-777" }`
- **Server Event to Caller**: `call:accepted` → `{ "callId": "call-777" }`

#### 3. Reject Call
- **Callee Emit**: `call:reject` → `{ "callId": "call-777" }`
- **Server Event to Caller**: `call:rejected` → `{ "callId": "call-777" }`

#### 4. End Call
- **Client Emit**: `call:end` → `{ "callId": "call-777" }`
- **Server Event to Other Party**: `call:ended` → `{ "callId": "call-777" }`
