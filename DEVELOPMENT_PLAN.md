# MangoTalk — Full Development Plan

> **Talk to strangers. Voice only. No camera.**
>
> Platform: Web PWA + Android + iOS | Stack: React / NestJS / WebRTC / PostgreSQL / Redis

---

## Table of Contents

1. [Current State](#1-current-state)
2. [Architecture Overview](#2-architecture-overview)
3. [Database Schema](#3-database-schema)
4. [API Design](#4-api-design)
5. [WebRTC & Signaling Architecture](#5-webrtc--signaling-architecture)
6. [Matchmaking System](#6-matchmaking-system)
7. [Phase-by-Phase Plan](#7-phase-by-phase-plan)
   - [Phase 0 — Monorepo Setup (Week 1–2)](#phase-0--monorepo-setup-week-12)
   - [Phase 1 — Foundation (Month 1–2)](#phase-1--foundation-month-12)
   - [Phase 2 — Core Features (Month 3–5)](#phase-2--core-features-month-35)
   - [Phase 3 — Premium & AI (Month 6–7)](#phase-3--premium--ai-month-67)
   - [Phase 4 — Mobile App (Month 8–10)](#phase-4--mobile-app-month-810)
   - [Phase 5 — Testing & Launch (Month 11–12)](#phase-5--testing--launch-month-1112)
8. [Infrastructure & DevOps](#8-infrastructure--devops)
9. [AI & Moderation Pipeline](#9-ai--moderation-pipeline)
10. [Payment System](#10-payment-system)
11. [Security Checklist](#11-security-checklist)
12. [Testing Strategy](#12-testing-strategy)
13. [Sprint Breakdown (First 8 Weeks)](#13-sprint-breakdown-first-8-weeks)
14. [Team Task Allocation](#14-team-task-allocation)
15. [Definition of Done](#15-definition-of-done)

---

## 1. Current State

| Asset | Status |
|---|---|
| README.md | Done — full product vision |
| mangotalk_landing.html | Done — responsive landing page |
| Monorepo scaffold | **Not started** |
| Backend API (NestJS) | **Not started** |
| WebRTC signaling | **Not started** |
| Web client (React) | **Not started** |
| Matchmaking engine | **Not started** |
| Mobile app | **Not started** |
| AI moderation | **Not started** |
| Payments (Stripe) | **Not started** |
| Infrastructure (Docker, K8s) | **Not started** |

**Starting point:** Planning documents + landing page only. Every line of application code is greenfield.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENTS                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Web PWA     │  │  Android App │  │  iOS App             │  │
│  │  React + TS  │  │  React Native│  │  React Native        │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
└─────────┼────────────────┼───────────────────────┼──────────────┘
          │ HTTPS / WSS    │ HTTPS / WSS           │ HTTPS / WSS
          ▼                ▼                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE CDN / WAF                          │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                  ┌─────────▼──────────┐
                  │   NestJS API       │
                  │   (REST + WS)      │
                  │   Port 3000        │
                  └────┬──────┬────────┘
             ┌─────────┘      └────────────┐
             ▼                              ▼
   ┌──────────────────┐          ┌──────────────────┐
   │  PostgreSQL 16   │          │  Redis 7         │
   │  (primary data)  │          │  (sessions,      │
   │                  │          │   matchmaking,   │
   │                  │          │   pub/sub)       │
   └──────────────────┘          └──────────────────┘

WebRTC audio flows DIRECTLY peer-to-peer (not through server)
STUN: Google public / TURN: self-hosted coturn
```

### Key Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| API framework | NestJS (not Express/Fastify raw) | Modules, DI, guards, interceptors out of the box |
| ORM | Prisma | Type-safe, auto-migrations, good Postgres support |
| Realtime | Socket.io | Rooms abstraction, auto-reconnect, fallbacks |
| WebRTC lib | simple-peer (web) / react-native-webrtc (mobile) | Minimal API over raw WebRTC |
| State (web) | Zustand | Simple, no boilerplate, TypeScript-native |
| Monorepo tool | pnpm workspaces | Disk-efficient, fast, native workspace protocol |
| CSS | Tailwind + shadcn/ui | Utility-first + accessible headless components |
| Payments | Stripe | Best DX, webhooks, subscription support |
| Image moderation | AWS Rekognition | Managed, accurate, pay-per-use |
| TURN server | Self-hosted coturn on EC2 | Cost savings vs. Twilio TURN at scale |

---

## 3. Database Schema

### Prisma Schema (`apps/api/prisma/schema.prisma`)

```prisma
// User (anonymous — no email/password)
model User {
  id              String    @id @default(cuid())
  deviceId        String    @unique          // SHA-256 of device fingerprint
  anonAlias       String                     // "Mango#4821"
  region          String?                    // "BD", "IN", "US"
  interests       String[]                   // ["music", "gaming"]
  isPremium       Boolean   @default(false)
  premiumUntil    DateTime?
  stripeCustomerId String?  @unique
  isBanned        Boolean   @default(false)
  banUntil        DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  sessions        Session[]
  callsAsA        Call[]    @relation("CallParticipantA")
  callsAsB        Call[]    @relation("CallParticipantB")
  sentReports     Report[]  @relation("Reporter")
  receivedReports Report[]  @relation("Reported")
  friends         Friend[]  @relation("UserFriends")
  friendOf        Friend[]  @relation("FriendOfUser")
  sharedImages    SharedImage[]
}

// JWT session token tracking
model Session {
  id          String   @id @default(cuid())
  userId      String
  token       String   @unique
  deviceInfo  Json
  expiresAt   DateTime
  createdAt   DateTime @default(now())

  user        User     @relation(fields: [userId], references: [id])
}

// A completed or ongoing voice call
model Call {
  id            String    @id @default(cuid())
  participantA  String
  participantB  String
  startedAt     DateTime  @default(now())
  endedAt       DateTime?
  durationSecs  Int?
  endReason     String?   // "hangup" | "disconnect" | "skip" | "ban"
  roomId        String    @unique

  userA         User      @relation("CallParticipantA", fields: [participantA], references: [id])
  userB         User      @relation("CallParticipantB", fields: [participantB], references: [id])
  sharedImages  SharedImage[]

  @@index([participantA])
  @@index([participantB])
}

// Anonymous friends (users can keep a chat partner after call)
model Friend {
  id          String   @id @default(cuid())
  userId      String
  friendId    String
  nickname    String?
  addedAt     DateTime @default(now())
  lastCallAt  DateTime?

  user        User     @relation("UserFriends", fields: [userId], references: [id])
  friend      User     @relation("FriendOfUser", fields: [friendId], references: [id])

  @@unique([userId, friendId])
}

// AI-moderated image sharing within a call
model SharedImage {
  id            String   @id @default(cuid())
  callId        String
  senderId      String
  s3Key         String
  moderationStatus String @default("pending") // "pending" | "approved" | "rejected"
  moderationScore Float?
  deliveredAt   DateTime?
  createdAt     DateTime @default(now())

  call          Call     @relation(fields: [callId], references: [id])
  sender        User     @relation(fields: [senderId], references: [id])
}

// Reports for safety
model Report {
  id           String   @id @default(cuid())
  reporterId   String
  reportedId   String
  callId       String?
  reason       String   // "hate_speech" | "inappropriate" | "spam" | "other"
  description  String?
  status       String   @default("open") // "open" | "reviewed" | "actioned"
  createdAt    DateTime @default(now())

  reporter     User     @relation("Reporter", fields: [reporterId], references: [id])
  reported     User     @relation("Reported", fields: [reportedId], references: [id])

  @@index([reportedId])
}

// Blocked users
model Block {
  id          String   @id @default(cuid())
  blockerId   String
  blockedId   String
  createdAt   DateTime @default(now())

  @@unique([blockerId, blockedId])
}

// Stripe subscriptions
model Subscription {
  id                   String    @id @default(cuid())
  userId               String    @unique
  stripeSubscriptionId String    @unique
  status               String    // "active" | "canceled" | "past_due"
  currentPeriodEnd     DateTime
  plan                 String    @default("premium")
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt
}

// Interest tags lookup table
model Interest {
  id    String @id @default(cuid())
  slug  String @unique  // "music", "gaming", "language_learning"
  label String          // "Music", "Gaming", "Language Learning"
  emoji String?
}
```

---

## 4. API Design

### REST Endpoints (`/api/v1/`)

```
AUTH
  POST   /auth/init           — device fingerprint → JWT pair
  POST   /auth/refresh        — refresh token → new access token

USERS
  GET    /users/me            — current user profile
  PATCH  /users/me            — update alias, region, interests
  GET    /users/me/history    — paginated call history
  DELETE /users/me            — delete account

FRIENDS
  GET    /friends             — list friends
  POST   /friends/:userId     — add friend after call
  DELETE /friends/:userId     — remove friend
  PATCH  /friends/:userId     — update nickname

REPORTS
  POST   /reports             — submit report (body: reportedId, reason, callId)

IMAGES
  POST   /images/upload       — presigned S3 URL (returns uploadUrl + imageId)
  GET    /images/:id/status   — poll moderation status

PAYMENTS
  POST   /payments/subscribe  — create Stripe subscription
  POST   /payments/cancel     — cancel subscription
  GET    /payments/status     — current subscription status
  POST   /payments/webhook    — Stripe webhook (public, no auth)

ADMIN
  GET    /admin/reports       — list open reports
  POST   /admin/reports/:id/action — ban/warn/dismiss
  GET    /admin/stats         — DAU, call metrics

HEALTH
  GET    /health              — liveness probe
  GET    /health/ready        — readiness probe
```

### Socket.io Events

```
Client → Server:
  matchmaking:join      { interests[], region, isPremium }
  matchmaking:cancel    {}
  call:ready            { roomId }
  call:end              { roomId, reason }
  webrtc:offer          { roomId, sdp }
  webrtc:answer         { roomId, sdp }
  webrtc:ice-candidate  { roomId, candidate }
  game:move             { roomId, gameType, move }
  image:send            { roomId, imageId }
  friend:ping           { friendId }

Server → Client:
  matchmaking:matched   { roomId, partnerId, peerType: "initiator" | "receiver" }
  matchmaking:queued    { position, estimatedWait }
  call:partner-left     { roomId, reason }
  webrtc:offer          { sdp }
  webrtc:answer         { sdp }
  webrtc:ice-candidate  { candidate }
  game:move             { move, result }
  image:delivered       { imageId, status }
  notification:friend   { type, from }
```

---

## 5. WebRTC & Signaling Architecture

```
User A                  Signaling Server               User B
  |                    (NestJS + Socket.io)               |
  |── matchmaking:join ──────────────────────────────────>|
  |<─────────────────── matchmaking:joined ───────────────|
  |                                                        |
  |<────── matchmaking:matched (peerType: initiator) ─────|
  |<────── matchmaking:matched (peerType: receiver)  ─────|
  |                                                        |
  |── (create RTCPeerConnection) ────────────────────────>|
  |── webrtc:offer ─────────────────────────────────────>|── webrtc:offer ──>|
  |                                               |<── webrtc:answer ──────--|
  |<────────────────── webrtc:answer ─────────────|                          |
  |── webrtc:ice-candidate ─────────────────────>|── webrtc:ice-candidate ──>|
  |<─────────── webrtc:ice-candidate ────────────|<── webrtc:ice-candidate ──|
  |                                                        |
  |<═══════════════ DIRECT P2P AUDIO STREAM ══════════════|
```

### TURN Server Strategy
- **Development:** Google STUN (`stun:stun.l.google.com:19302`)
- **Production:** Self-hosted `coturn` on `t3.small` EC2 (enough for ~500 concurrent TURN sessions)
- **Fallback:** Twilio TURN (pay-per-use) if coturn is overloaded

### Audio Quality Settings
```typescript
const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  sampleRate: 48000,
  channelCount: 1,         // mono for bandwidth
};
```

---

## 6. Matchmaking System

### Algorithm (Redis + Bull Queue)

```
1. User joins queue → POST to Redis sorted set:
   Key: "queue:{region}"
   Score: timestamp (FIFO) | (isPremium ? timestamp - 1e12 : timestamp)
   Value: JSON { userId, interests[], region, isPremium, joinedAt }

2. Matchmaking worker (Bull job every 500ms):
   a. Pop top N users from queue (N = 100)
   b. For each user, find best match:
      - Same region (if filter set)
      - Max interest overlap (Jaccard similarity)
      - No existing block between them
      - Not same session device
   c. If match found:
      - Remove both from queue
      - Create Call record
      - Emit matchmaking:matched to both via Socket.io rooms
   d. If no match after 10s: relax region filter
   e. If no match after 30s: relax all filters, match anyone

3. Premium priority:
   - Premium users' queue score is timestamp - 1_000_000_000_000
   - Effectively always ahead of free users in sorted set

4. On disconnect during queue:
   - Socket.io disconnect event → remove from Redis queue
```

### Queue Data Structure
```
ZADD queue:BD  <timestamp>  '{"userId":"xxx","interests":["music"]}'
ZADD queue:ANY <timestamp>  '{"userId":"xxx","interests":["music"]}'

# Premium
ZADD queue:BD  <timestamp - 1e12>  '{"userId":"yyy","isPremium":true,...}'
```

---

## 7. Phase-by-Phase Plan

---

### Phase 0 — Monorepo Setup (Week 1–2)

**Goal:** Every developer can clone and run the full stack locally in one command.

#### Tasks

- [ ] Initialize git repository on GitHub (`mangotalk/mangotalk`)
- [ ] Set up pnpm workspace (`pnpm-workspace.yaml`)
- [ ] Create root `package.json` with scripts: `dev`, `build`, `test`, `lint`
- [ ] Create `packages/types/` — shared TypeScript types (User, Call, SocketEvents, etc.)
- [ ] Create `packages/config/` — shared ESLint, Prettier, tsconfig base
- [ ] Create `apps/api/` — NestJS scaffold (`nest new`)
- [ ] Create `apps/web/` — Vite + React + TypeScript scaffold
- [ ] Create `apps/mobile/` — Expo + React Native scaffold
- [ ] Create `docker-compose.yml` — PostgreSQL 16 + Redis 7 + coturn
- [ ] Create `.env.example` with all required variables
- [ ] Set up Husky + lint-staged (pre-commit: lint + type-check)
- [ ] Set up GitHub Actions: `ci.yml` (lint → test → build on every PR)
- [ ] Configure branch protection: `main` and `develop` require PR + CI green
- [ ] Write `CONTRIBUTING.md` with local dev setup steps

#### File Structure After Phase 0

```
mangotalk/
├── apps/
│   ├── api/          (NestJS)
│   ├── web/          (Vite + React)
│   └── mobile/       (Expo)
├── packages/
│   ├── types/
│   └── config/
├── infra/
│   ├── docker/
│   └── k8s/          (empty for now)
├── docker-compose.yml
├── pnpm-workspace.yaml
├── .env.example
└── turbo.json        (Turborepo for build caching)
```

#### Deliverable
`git clone && pnpm install && docker-compose up -d && pnpm dev` — all three apps start.

---

### Phase 1 — Foundation (Month 1–2)

**Goal:** Two users can connect anonymously and have a real-time voice call.

#### Sprint 1 (Weeks 1–2): Auth + Database

**Backend:**
- [ ] Set up Prisma with PostgreSQL — run initial migration
- [ ] Implement `AuthModule`:
  - `POST /auth/init` — accept `deviceFingerprint` (SHA-256 client-side), create `User` if new, return `{ accessToken, refreshToken, user }`
  - `POST /auth/refresh` — rotate tokens
  - `JwtAuthGuard` and `@CurrentUser()` decorator
  - Device fingerprint logic: `navigator.userAgent + canvas hash + WebGL hash` on client
- [ ] Global exception filter, request logging middleware
- [ ] Health check endpoints (`/health`, `/health/ready`)
- [ ] Unit tests for `AuthService` (jest)

**Web Client:**
- [ ] Vite project with React 19 + TypeScript strict mode
- [ ] Tailwind CSS + shadcn/ui install and configure
- [ ] Zustand store: `useAuthStore` — persists token to `localStorage`
- [ ] Anonymous auth flow: on first load → fingerprint device → call `/auth/init` → store token
- [ ] Axios instance with auto-refresh on 401
- [ ] Basic layout: nav header + main area
- [ ] "Join as anonymous" landing → profile setup (alias, region, interests) → home

#### Sprint 2 (Weeks 3–4): Socket.io + Signaling

**Backend:**
- [ ] Install `@nestjs/websockets`, `socket.io`
- [ ] `SignalingGateway` — handles all WebSocket events
- [ ] JWT auth middleware for Socket.io (`socket.handshake.auth.token`)
- [ ] Room management: create room on match, join both users
- [ ] Forward WebRTC signaling events: offer, answer, ICE candidates
- [ ] Socket.io Redis adapter (`@socket.io/redis-adapter`) for horizontal scaling

**Web Client:**
- [ ] `useSocket` hook — singleton Socket.io connection with auto-reconnect
- [ ] `useWebRTC` hook — wraps `simple-peer`:
  - Get user media (mic only)
  - Create peer (initiator or receiver)
  - Handle offer/answer/ICE via socket
  - Expose `remoteStream` for `<audio autoPlay />`
- [ ] Basic call UI: "waiting..." → matched → audio playing → "end call"

#### Sprint 3 (Weeks 5–6): Matchmaking Engine

**Backend:**
- [ ] Bull Queue setup (`@nestjs/bull`, `bull`, `ioredis`)
- [ ] `MatchmakingModule` with `MatchmakingService`:
  - `joinQueue(userId, prefs)` — add to Redis sorted set
  - `leaveQueue(userId)` — remove from Redis
  - `MatchmakingProcessor` (Bull worker) — runs every 500ms, finds pairs, emits `matchmaking:matched`
- [ ] Interest matching algorithm (Jaccard similarity)
- [ ] Region filter with 30s fallback
- [ ] Block list check before matching
- [ ] `Call` record created on match

**Web Client:**
- [ ] Matchmaking UI: interest tag selector (multi-select), region dropdown
- [ ] Queue state: "searching...", estimated wait, cancel button
- [ ] `useMatchmaking` hook — emit join/cancel, listen for matched event
- [ ] Transition: matched → WebRTC call setup → call screen

#### Sprint 4 (Weeks 7–8): Polish & Stability

- [ ] Handle all disconnect scenarios: tab close, network drop, partner disconnect
- [ ] Reconnection logic (socket auto-reconnect → rejoin call if within 10s)
- [ ] Call timer UI
- [ ] "Skip" button — ends call, immediately re-queues
- [ ] Error states: mic permission denied, no mic found, network error
- [ ] Rate limiting on API (throttle guard)
- [ ] Basic CSP headers
- [ ] Internal demo with team — collect bugs

#### Phase 1 Deliverable
A real working voice chat: two browser tabs on the same machine can match and talk.

---

### Phase 2 — Core Features (Month 3–5)

**Goal:** Full free-tier feature set.

#### 2.1 Country / Region Filter

- [ ] IP-to-region lookup on `auth/init` using `maxmind/geoip-lite`
- [ ] User can override region manually
- [ ] Region stored on `User`, passed to matchmaking queue key
- [ ] Queue keys: `queue:BD`, `queue:IN`, `queue:US`, etc. + `queue:ANY`

#### 2.2 Interest-Based Matching

- [ ] Seed `Interest` table with 30 initial tags (music, gaming, anime, language_learning, etc.)
- [ ] `GET /interests` — fetch available tags
- [ ] Profile setup wizard on web: pick up to 5 interests
- [ ] Interest matching wired into matchmaking algorithm
- [ ] Analytics: track match overlap scores

#### 2.3 Safe Image Sharing

- [ ] `POST /images/upload` — return presigned S3 URL (expires in 5min)
- [ ] Client uploads directly to S3 (avoids server bandwidth)
- [ ] After upload: client calls `POST /images/confirm` → triggers moderation
- [ ] AWS Rekognition `DetectModerationLabels` async job
- [ ] SNS topic → Lambda → API webhook → update `SharedImage.moderationStatus`
- [ ] If approved: server sends `image:delivered` to recipient via Socket.io
- [ ] If rejected: sender gets `image:rejected` event
- [ ] Image display in chat (small thumbnail, tap to expand)
- [ ] Images auto-deleted from S3 after 24h (S3 lifecycle rule)

#### 2.4 In-Chat Mini-Games (Tic-Tac-Toe)

- [ ] Game state managed server-side (prevents cheating)
- [ ] `game:move` event — server validates + broadcasts result
- [ ] Win/draw/loss detection server-side
- [ ] Game UI overlay on call screen
- [ ] Rematch button

#### 2.5 Call History & Reconnect

- [ ] `GET /users/me/history` — paginated list of past calls with duration, partner alias, date
- [ ] "Reconnect" button on history — re-queues targeting that specific user (they must also opt in)
- [ ] Call history page on web app

#### 2.6 Anonymous Friends System

- [ ] "Add friend" button shown for 30s after call ends
- [ ] `POST /friends/:userId` — requires shared call in the last 5 minutes
- [ ] Friends list page: nickname, last call, quick-connect button
- [ ] "Friend ping" — notify friend you want to chat (if they're online)
- [ ] Mutual friendship required (both must add each other)

#### 2.7 Report & Block

- [ ] One-tap report during call: bottom sheet with reason options
- [ ] `POST /reports` → creates report record
- [ ] Auto-block reported user from future matches
- [ ] `POST /blocks` — manual block
- [ ] Block list checked during matchmaking
- [ ] Admin review queue for reports (basic admin UI at `/admin`)
- [ ] Automated temp-ban if user accumulates 3+ reports in 24h (pending review)

#### 2.8 Push Notifications (Web)

- [ ] Web Push API integration (service worker)
- [ ] Notification types: friend ping, reconnect request
- [ ] `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` env vars
- [ ] `POST /push/subscribe` — store push subscription
- [ ] Trigger push from `FriendsService` when friend pings

#### Phase 2 Deliverable
Complete free-tier experience. Internal beta with 50 testers.

---

### Phase 3 — Premium & AI (Month 6–7)

**Goal:** Monetization live, AI gender filter working.

#### 3.1 Stripe Payments

- [ ] Stripe product + price created (monthly `$4.99`, yearly `$39.99`)
- [ ] `POST /payments/subscribe` — create Stripe customer + subscription → return `clientSecret` for Stripe.js
- [ ] Stripe.js embedded payment form on web (Payment Element)
- [ ] `POST /payments/webhook` — handle: `customer.subscription.created`, `updated`, `deleted`, `invoice.payment_failed`
- [ ] Webhook updates `User.isPremium`, `User.premiumUntil`, `Subscription` record
- [ ] Cancel subscription flow with confirmation modal
- [ ] Premium badge on profile (visible to match partner during call)
- [ ] Premium status check in matchmaking (priority queue)

#### 3.2 AI Voice Gender Classification

- [ ] Train lightweight TensorFlow.js model:
  - Dataset: Mozilla Common Voice (labeled by gender)
  - Features: MFCC coefficients extracted from first 3s of call
  - Architecture: CNN → Binary classification (M/F/Unknown)
  - Target: >85% accuracy
- [ ] Model served from `apps/api` via TensorFlow.js Node
- [ ] Audio sample sent to server for classification at call start (first 3s buffered)
- [ ] Premium matchmaking filter: `preferredGender: "M" | "F" | "any"`
- [ ] Fallback: if model confidence < 70%, classify as "Unknown" and match normally

#### 3.3 Priority Queue

- [ ] Premium users use negative timestamp score (ahead of queue)
- [ ] "Estimated wait" shows premium vs free tier times
- [ ] Skip-the-line UI indicator: "⚡ Premium match"

#### 3.4 Advanced Filters (Premium)

- [ ] Age verification (honor system — user inputs age range, no real verification)
- [ ] Language filter (select from 20 languages)
- [ ] Mood tags (chill, rant, debate, help me)
- [ ] These filters stored on matchmaking queue entry and matched similarly to interests

#### 3.5 Ad-Free + Extended History

- [ ] Free tier: banner ad in waiting screen (Google AdSense)
- [ ] Premium: `isPremium` flag → no ads rendered
- [ ] Free tier call history: last 10 calls
- [ ] Premium call history: unlimited, with search

#### 3.6 Premium Dashboard

- [ ] `/premium` page: usage stats, manage subscription, filter settings
- [ ] Subscription expiry countdown
- [ ] Upgrade prompt at strategic moments (queue wait > 30s)

#### Phase 3 Deliverable
Stripe live in test mode, gender AI model at >85% accuracy, premium features functional.

---

### Phase 4 — Mobile App (Month 8–10)

**Goal:** Native iOS + Android apps with feature parity.

#### 4.1 React Native Setup

- [ ] Expo SDK 51+ with bare workflow (needed for native WebRTC modules)
- [ ] EAS Build configured for Android + iOS
- [ ] `react-native-webrtc` installed and linked
- [ ] `@react-native-async-storage/async-storage` for token storage
- [ ] `react-native-permissions` for mic access
- [ ] Navigation: `@react-navigation/native` with stack + tab navigator

#### 4.2 Shared Code Strategy

- [ ] `packages/types/` already shared
- [ ] Extract `packages/sdk/` — shared API client (Axios), socket hooks, matchmaking logic
- [ ] Web and mobile both import from `@mangotalk/sdk`
- [ ] UI components are NOT shared (native vs web differ too much)

#### 4.3 Native Modules

- [ ] Background audio: `react-native-incall-manager` (keeps call alive when screen off)
- [ ] Haptics: `expo-haptics` (on match, on call end)
- [ ] Notifications: `expo-notifications` (FCM + APNs)
- [ ] Microphone permission flow with rationale screen

#### 4.4 Push Notifications (Mobile)

- [ ] FCM setup for Android
- [ ] APNs setup for iOS (requires Apple Developer account)
- [ ] `POST /push/subscribe-mobile` — store FCM/APNs token
- [ ] Notification on friend ping, reconnect request
- [ ] Deep link: notification tap → open app → specific screen

#### 4.5 App Store Submissions

- [ ] Play Store: create app listing, screenshots, privacy policy URL
- [ ] App Store: create app listing, age rating (17+), privacy policy
- [ ] Privacy policy page (legal requirement for both stores)
- [ ] Terms of service page
- [ ] Safety & moderation section in App Store description
- [ ] COPPA compliance (18+ requirement enforced)

#### Phase 4 Deliverable
TestFlight (iOS) + Play Console internal testing track live. Both apps functional.

---

### Phase 5 — Testing & Launch (Month 11–12)

**Goal:** 1,000 beta users → public launch.

#### 5.1 Load Testing

- [ ] k6 scripts simulating: 1K concurrent users in queue, 500 concurrent WebRTC calls
- [ ] Target: matchmaking p95 < 30s, API p95 < 200ms, Socket.io p95 < 100ms
- [ ] Identify bottlenecks: scale NestJS horizontally if needed, tune Bull queue concurrency
- [ ] coturn load test: ensure 200+ concurrent TURN relayed calls stable

#### 5.2 Security Testing

- [ ] OWASP ZAP automated scan on API
- [ ] Verify: no JWT secret in logs, tokens expire correctly, refresh tokens are one-use
- [ ] SQL injection test (Prisma parameterizes, but verify)
- [ ] Rate limiting: brute force on `/auth/init`, report spam, image upload abuse
- [ ] CORS: locked to production domain only
- [ ] Content Security Policy headers verified
- [ ] Stripe webhook signature verification test

#### 5.3 Beta Program (Month 11)

- [ ] Invite-only via waitlist from landing page
- [ ] 1,000 users, South Asia focus (BD, IN, PK)
- [ ] Feedback survey after 3 calls
- [ ] Crash monitoring: Sentry alerts configured
- [ ] Daily DAU/call-duration metrics in Grafana
- [ ] Weekly bug-bash sessions

#### 5.4 Public Launch (Month 12)

- [ ] App Store + Play Store public release
- [ ] Landing page CTA → app download links
- [ ] Press kit prepared (logo, screenshots, product description)
- [ ] Product Hunt launch
- [ ] Social media campaign (TikTok voice demo videos)
- [ ] Community Discord for early users

---

## 8. Infrastructure & DevOps

### docker-compose.yml (Local Dev)

```yaml
version: '3.9'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: mangotalk
      POSTGRES_USER: mangotalk
      POSTGRES_PASSWORD: devpassword
    ports: ["5432:5432"]
    volumes: [postgres_data:/var/lib/postgresql/data]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  coturn:
    image: coturn/coturn:alpine
    ports:
      - "3478:3478/udp"
      - "3478:3478/tcp"
    environment:
      DETECT_EXTERNAL_IP: "yes"
      TURN_USERNAME: dev
      TURN_PASSWORD: devpassword

volumes:
  postgres_data:
```

### AWS Production Architecture

```
Route53 → CloudFront → EC2 (NestJS, 2x t3.medium, Auto Scaling)
                     → S3 (static web assets)
                     → RDS PostgreSQL 16 (db.t3.medium, Multi-AZ)
                     → ElastiCache Redis (cache.t3.micro)
                     → EC2 coturn (t3.small)
```

### GitHub Actions CI/CD

```yaml
# .github/workflows/ci.yml
on: [push, pull_request]
jobs:
  ci:
    steps:
      - pnpm install
      - pnpm lint
      - pnpm type-check
      - pnpm test
      - pnpm build

# .github/workflows/deploy.yml
on:
  push:
    branches: [main]
jobs:
  deploy:
    steps:
      - Build Docker image
      - Push to ECR
      - Deploy to ECS (rolling update)
```

### Monitoring Stack

| Tool | Purpose |
|---|---|
| Sentry | Error tracking (web + api + mobile) |
| Prometheus | Metrics scraping |
| Grafana | Dashboards: DAU, call duration, queue length, error rate |
| PagerDuty | On-call alerts (API down, error spike) |
| Datadog (optional) | APM if budget allows |

### Key Metrics to Track

- Matchmaking queue depth (per region)
- Match success rate (% matched within 30s)
- WebRTC connection success rate
- TURN relay usage % (ideally < 20% of calls)
- API error rate (target < 0.1%)
- P95 call setup time

---

## 9. AI & Moderation Pipeline

### Image Moderation Flow

```
Client uploads image to S3 (presigned URL)
  ↓
Client calls POST /images/confirm { imageId }
  ↓
API queues moderation job (Bull)
  ↓
Worker calls AWS Rekognition DetectModerationLabels
  ↓
If any label with confidence > 75%:
  → Mark rejected, notify sender, log for review
Else:
  → Mark approved, emit image:delivered to recipient
  ↓
S3 lifecycle: delete after 24h
```

### Rekognition Categories to Block

- `Explicit Nudity`, `Suggestive`, `Violence`, `Visually Disturbing`, `Drugs`, `Tobacco`, `Alcohol`, `Gambling`, `Hate Symbols`
- Threshold: 75% confidence (tunable)

### Voice Gender Classification

```
Model Training:
  Dataset: Mozilla Common Voice (~200K samples, gender labeled)
  Features: 40 MFCC coefficients × 128 time frames = 5,120 features
  Architecture:
    Conv2D(32) → MaxPool → Conv2D(64) → MaxPool → Flatten → Dense(128) → Dropout(0.3) → Dense(2)
  Framework: TensorFlow 2.x → export to TensorFlow.js
  Training: Google Colab / EC2 p3.2xlarge
  Target accuracy: >85%

Inference:
  - At call start, client buffers 3s of audio
  - Audio sent to API as WAV blob (POST /ai/classify-gender)
  - Server runs TFJS inference (<50ms)
  - Result stored on matchmaking queue entry
  - Only used for premium gender filter
```

### Audio Moderation (Future v2)

- AssemblyAI real-time transcription on opt-in clips
- Keyword detection for severe violations (slurs, threats)
- Flag for manual review, not auto-action
- Requires explicit user disclosure + consent

---

## 10. Payment System

### Stripe Integration Checklist

- [ ] Create Stripe account, get test keys
- [ ] Create Product: "MangoTalk Premium"
- [ ] Create Prices: `price_monthly` ($4.99/mo), `price_yearly` ($39.99/yr)
- [ ] Install `stripe` npm package in `apps/api`
- [ ] `StripeModule` with `StripeService`
- [ ] Embed Stripe Payment Element (not Checkout redirect — better UX)
- [ ] Webhook endpoint: verify `stripe-signature` header
- [ ] Handle `customer.subscription.*` events → sync `User.isPremium`
- [ ] Handle `invoice.payment_failed` → email user (via SendGrid)
- [ ] Test all webhook events with `stripe listen --forward-to localhost:3000/payments/webhook`

### Premium Feature Gate

```typescript
// apps/api/src/common/guards/premium.guard.ts
@Injectable()
export class PremiumGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const user = ctx.switchToHttp().getRequest().user;
    if (!user.isPremium) throw new ForbiddenException('Premium required');
    return true;
  }
}
```

---

## 11. Security Checklist

- [ ] JWT: short-lived access tokens (15min), longer refresh tokens (30 days, one-use)
- [ ] Device fingerprint: never expose raw fingerprint, store hash only
- [ ] Rate limiting: 10 req/min on `/auth/init`, 100 req/min global per IP
- [ ] CORS: whitelist only `https://mangotalk.com` and `https://app.mangotalk.com`
- [ ] Helmet.js: sets security headers (CSP, HSTS, X-Frame-Options, etc.)
- [ ] Input validation: class-validator on all DTOs, never trust client data
- [ ] SQL injection: Prisma parameterizes all queries — no raw SQL
- [ ] Image uploads: S3 presigned URLs expire in 5min, MIME type check on S3 + server
- [ ] Stripe webhook: verify signature every time, no exceptions
- [ ] No PII in logs: alias only, never deviceId or IP in application logs
- [ ] Secrets: all in AWS Secrets Manager / `.env` never committed
- [ ] GDPR-adjacent: "delete my account" removes all user data (DSAR readiness)
- [ ] Age gate: 18+ checkbox + ToS acceptance on first launch

---

## 12. Testing Strategy

### Test Pyramid

```
           /\
          /E2E\         Playwright (5–10 critical flows)
         /──────\
        / Integ  \      NestJS test client + real DB (30–40 tests)
       /──────────\
      /   Unit     \    jest (100+ tests for services, algorithms)
     /______________\
```

### Unit Tests

- `MatchmakingService` — pairing algorithm, edge cases
- `AuthService` — token generation, refresh, expiry
- `ModerationService` — Rekognition result parsing
- All Prisma service methods (mock Prisma client)

### Integration Tests

- Full auth flow: init → refresh → protected route
- Matchmaking: two users join → match within timeout
- Image upload → moderation → delivery
- Stripe webhook: subscription created → user upgraded
- Report → auto-block → blocked users not matched

### E2E Tests (Playwright)

- Anonymous login flow
- Full voice call (two browser contexts with mic mock)
- Image share (moderation mocked)
- Friend add after call
- Premium upgrade flow (Stripe test mode)

### Mobile Tests

- Jest + React Native Testing Library for component tests
- Detox for E2E on Android emulator

---

## 13. Sprint Breakdown (First 8 Weeks)

| Sprint | Weeks | Backend | Frontend | Infra/DevOps |
|---|---|---|---|---|
| 0 | 1–2 | NestJS scaffold, Prisma setup, health endpoints | Vite+React scaffold, Tailwind, auth store | Monorepo, Docker Compose, GitHub Actions |
| 1 | 3–4 | Auth module (device fingerprint, JWT) | Anonymous login flow, profile setup UI | CI pipeline green |
| 2 | 5–6 | Socket.io gateway, WebRTC signaling relay | `useSocket`, `useWebRTC` hooks, basic call UI | coturn local |
| 3 | 7–8 | Matchmaking engine (Redis + Bull) | Queue UI, interest selector, call screen | Redis local, Bull dashboard |
| 4 | 9–10 | Call history, friends API, report API | History page, friends list, report modal | S3 bucket setup |
| 5 | 11–12 | Image moderation pipeline | Image share in call | Rekognition IAM setup |
| 6 | 13–14 | Mini-games (Tic-Tac-Toe), advanced matching | Game overlay UI | — |
| 7 | 15–16 | Stripe integration, premium guard | Pricing page, payment flow, premium features | Stripe test mode |
| 8 | 17–18 | AI gender classifier, priority queue | Advanced filter UI | TF model training |

---

## 14. Team Task Allocation

| Role | Phase 0 | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|---|---|---|---|---|---|
| **Backend Dev 1** | Monorepo, Prisma | Auth, SignalingGateway | Image moderation, Friends | Stripe, Subscriptions | API mobile endpoints |
| **Backend Dev 2** | Docker Compose | Matchmaking engine | Report/Block, Games | AI gender service | Push notifications |
| **Frontend Dev 1** | Vite scaffold | useWebRTC, Call UI | Call history, Image share | Premium UI, Dashboard | — |
| **Frontend Dev 2** | shadcn/ui setup | Auth flow, Queue UI | Friends list, Report UI | Pricing page, Payment flow | — |
| **Mobile Dev 1** | Expo scaffold | — | — | — | Auth + Call screen |
| **Mobile Dev 2** | — | — | — | — | Friends, History, Push |
| **ML/AI Engineer** | — | — | (start data collection) | TF model train + deploy | Mobile model inference |
| **UI/UX Designer** | Design system | Call UI mocks | Games, Image UI | Premium screens | Mobile designs |
| **QA Engineer** | Test setup | Auth + call test cases | Feature regression suite | Payment test flows | Mobile test plan |
| **DevOps** | GitHub Actions, Docker | — | S3, Rekognition | AWS prod setup | ECS deployment |
| **PM** | Sprint planning, backlog | Feature spec refinement | Beta planning | Launch prep | Store submissions |

---

## 15. Definition of Done

A feature is **done** when ALL of the following are true:

- [ ] Code is merged to `develop` via PR (with at least 1 approval)
- [ ] Unit tests written and passing (≥80% coverage on new code)
- [ ] Integration test added if it touches API or database
- [ ] No TypeScript errors (`pnpm type-check` passes)
- [ ] ESLint passing (`pnpm lint` passes)
- [ ] Tested manually in Chrome + Firefox (web) or iOS + Android emulator (mobile)
- [ ] Error states handled (network failure, permission denied, etc.)
- [ ] Loading states present (no UI flicker)
- [ ] Mobile responsive (web features)
- [ ] Sentry error tracking in place for new errors
- [ ] PM has accepted the feature in staging

---

## Appendix A: Environment Variables Reference

```env
# Server
NODE_ENV=development|production
PORT=3000
API_BASE_URL=https://api.mangotalk.com

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/mangotalk
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=<32+ random bytes>
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=30d

# WebRTC / TURN
STUN_SERVER_URL=stun:stun.l.google.com:19302
TURN_SERVER_URL=turn:turn.mangotalk.com:3478
TURN_USERNAME=<from coturn config>
TURN_CREDENTIAL=<from coturn config>

# AWS
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=mangotalk-images-prod

# AI / Moderation
ASSEMBLYAI_API_KEY=               # future audio moderation
REKOGNITION_MIN_CONFIDENCE=75

# Payments (Stripe)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_MONTHLY=price_...
STRIPE_PRICE_YEARLY=price_...

# Push Notifications
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:hello@mangotalk.com
FCM_SERVER_KEY=                   # Firebase (mobile Android)

# Monitoring
SENTRY_DSN=https://...@sentry.io/...

# Frontend (VITE_ prefix for Vite client bundle)
VITE_API_URL=https://api.mangotalk.com
VITE_SOCKET_URL=wss://api.mangotalk.com
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
VITE_VAPID_PUBLIC_KEY=
```

---

## Appendix B: Key NPM Packages

### `apps/api`
```json
{
  "@nestjs/core": "^10",
  "@nestjs/websockets": "^10",
  "socket.io": "^4",
  "@socket.io/redis-adapter": "^8",
  "@nestjs/bull": "^10",
  "bull": "^4",
  "ioredis": "^5",
  "prisma": "^5",
  "@prisma/client": "^5",
  "stripe": "^14",
  "@aws-sdk/client-rekognition": "^3",
  "@aws-sdk/client-s3": "^3",
  "@tfjs/tfjs-node": "^4",
  "helmet": "^7",
  "class-validator": "^0.14",
  "class-transformer": "^0.5",
  "jsonwebtoken": "^9",
  "bcryptjs": "^2",
  "web-push": "^3"
}
```

### `apps/web`
```json
{
  "react": "^19",
  "react-dom": "^19",
  "typescript": "^5",
  "vite": "^5",
  "tailwindcss": "^3",
  "zustand": "^4",
  "socket.io-client": "^4",
  "simple-peer": "^9",
  "axios": "^1",
  "@stripe/stripe-js": "^3",
  "@stripe/react-stripe-js": "^2",
  "react-router-dom": "^6"
}
```

### `apps/mobile`
```json
{
  "expo": "~51",
  "react-native": "0.74",
  "react-native-webrtc": "^118",
  "socket.io-client": "^4",
  "@react-navigation/native": "^6",
  "expo-notifications": "~0.28",
  "expo-haptics": "~13",
  "react-native-incall-manager": "^4",
  "@react-native-async-storage/async-storage": "^1"
}
```

---

*Last updated: June 2026 | Version: 1.0 | Status: Active Development*
