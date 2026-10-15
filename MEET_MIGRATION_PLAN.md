# AppleTalk → Group Audio Meeting Platform (Google Meet style)
## Migration Plan — read & approve before implementation

> **TL;DR (Banglish):** Current app ta 1-on-1 random voice chat. Tumi chao eita Google Meet er moto group **audio** meeting banate — akta link generate hobe, sei link e click kore onek user join korbe, sudhu audio (video nai). Login page + admin panel thakbe, baki sob (matchmaking, friends, feed, premium, payments) remove hobe.
>
> **Sob cheye important kotha:** 1000–5000 user ek room e — eita **current P2P (simple-peer) diye kokhono possible na**. Amader akta **media server (SFU)** lagbe. Ami **LiveKit** recommend korchi (open-source, self-host possible, exactly ei kaajer jonno banano). Details niche.

---

## 1. Why the architecture must change (the scale problem)

Current call flow (`apps/web/src/hooks/useWebRTC.ts`):

```
User A  <────── direct P2P audio ──────>  User B
```

One `SimplePeer` connection = exactly 2 people. To add more people with this model ("mesh"), **every** user must open a separate connection to **every** other user:

| Users in room | Connections per user | Total audio streams |
|---|---|---|
| 2 | 1 | 1 |
| 10 | 9 | 45 |
| 100 | 99 | ~5,000 |
| 1,000 | 999 | ~500,000 |
| 5,000 | 4,999 | **~12.5 million** |

Mesh dies at ~8–10 users. **It is not an option here.**

### The correct model: SFU (Selective Forwarding Unit)

```
                    ┌─────────────────┐
   User A ─ 1 up ──>│                 │── down ─> everyone (only active speakers)
   User B ─ 1 up ──>│   MEDIA SERVER  │
   User C ─ 1 up ──>│      (SFU)      │
     ...            │                 │
   User 5000 ──────>│                 │
                    └─────────────────┘
```

Each user uploads **one** audio stream. The server forwards only the **active speakers** (loudest 3–10) down to everyone. This is exactly how Google Meet, Zoom, Discord, Twitter Spaces, and Clubhouse work. Clubhouse rooms hit thousands of listeners this way.

### Important consequence — "can 5000 people all talk at once?"

No system on earth lets 5,000 people talk simultaneously and be understood — and nobody wants that. The realistic, industry-standard model for large audio rooms:

- **Thousands can JOIN and LISTEN** ✅ (this is the "1k/2k/5k" number)
- **A managed set can SPEAK** — host/speakers always; audience uses **"raise hand"** → host lets them speak

So the meeting has **roles**:

| Role | Can speak? | Can hear? | Can manage? |
|---|---|---|---|
| **Host** (meeting creator) | ✅ | ✅ | ✅ mute/remove/promote others |
| **Speaker** (promoted) | ✅ | ✅ | ❌ |
| **Audience** (default for big meetings) | ❌ (raise hand to request) | ✅ | ❌ |

For **small meetings** (e.g. ≤ 50), we can default everyone to Speaker so it feels like a normal Meet call. For **big meetings**, audience-by-default keeps it sane. This is a **decision point** (see §8).

---

## 2. Recommended technology — LiveKit

**[LiveKit](https://livekit.io)** — open-source WebRTC SFU, Apache-2.0 licensed.

Why it fits perfectly:
- ✅ Built for exactly this (large audio/video rooms, active-speaker detection built in)
- ✅ **Self-hostable** via a single binary or Docker (matches your existing Docker setup)
- ✅ **Audio-only is trivial** (just never publish video)
- ✅ Permissions via server-minted JWT — we grant `canPublish` to speakers, subscribe-only to audience. This maps 1:1 to our role model.
- ✅ Good JS client SDK (`livekit-client`) so we can build a fully custom Meet-style UI
- ✅ Free local dev mode: `livekit-server --dev` runs a single binary with a default key/secret (works on Windows)

**How a meeting link works with LiveKit:**
1. Host clicks "New meeting" → backend creates a `Meeting` row with a unique `code` (e.g. `apl-x7k2-mq9`) → returns link `https://app/meet/apl-x7k2-mq9`
2. Anyone opens the link → lobby page (enter name, mic check)
3. On "Join", frontend calls `POST /meetings/:code/token` → backend mints a **LiveKit access token** (JWT) with the right room name + permissions for that user's role
4. Frontend connects to the LiveKit server with that token → audio flows

**Alternatives considered:**
- **mediasoup** — more powerful, but much lower-level; weeks more work. ❌ overkill to wire up.
- **Jitsi** — full product, harder to deeply customize the UI. ⚠️ possible but heavier.
- **Agora / Twilio (paid SaaS)** — zero infra, trivial to scale, but closed-source and costs money per minute at scale. ✅ good fallback if you don't want to run a server. (Decision point §8.)

**My recommendation:** LiveKit — self-host for prod (Docker), `--dev` binary for local. Agora as the "no-ops, pay-as-you-go" alternative.

---

## 3. What STAYS, what gets REMOVED, what's NEW

### ✅ Stays (keep as-is or lightly adapted)
- **Login page** (`LoginPage.tsx`) — Google OAuth + "continue without login". Unchanged.
- **Auth system** — JWT, device fingerprint, Google OAuth, sessions. Unchanged.
- **Admin panel** — repurposed (see below). All user data (Google + anonymous) keeps being stored in the `User` table.
- **Infra** — NestJS, React/Vite, PostgreSQL, Redis, Prisma.
- Landing / FAQ / Privacy / Terms pages (optional keep).

### ❌ Removed (entire features deleted)
Backend modules: `matchmaking`, `friends`, `calls` (1-on-1), `reports`, `blocks` (folded into `admin` previously), `payments`, `notifications`, `posts`, `push` (optional), plus `SocketEmitter` matchmaking logic in `app.gateway.ts`.

Frontend: `HomePage` (matchmaking UI), `CallPage` (1-on-1), `FriendsPage`, `HistoryPage` (old call history), `PremiumPage`, `FeedPage`, `PostDetailPage`, `useMatchmaking`, `useWebRTC` (simple-peer), `useFriendSocket`, `friend.store`, all friend/call toasts.

DB models dropped: `Call`, `Friend`, `SharedImage`, `Report`, `Block`, `Subscription`, `Interest`, `PaymentRequest`, `Notification`, `ChatMessage`, `Post`, `PostLike`, `PostComment`. (`IpBan` optional keep for abuse control.)

Dependencies removed: `simple-peer`, Stripe, web-push, bull/matchmaking queue (Redis stays for other uses).

### 🆕 New
- **LiveKit** media server + `livekit-server-sdk` (backend token minting) + `livekit-client` (frontend).
- **Meeting** + **MeetingParticipant** DB models.
- **Meetings module** (REST) — create/get/end meeting, mint tokens, list meetings.
- **New Meet-style UI** — create/lobby/room screens, redesigned.
- **Admin additions** — view all users (Google + anon) with stored data; view meetings & participant logs.

---

## 4. New data model (Prisma)

```prisma
model Meeting {
  id             String    @id @default(cuid())
  code           String    @unique @db.VarChar(32)   // the shareable link slug
  title          String    @db.VarChar(120)
  hostId         String                               // User.id of creator
  status         String    @default("live") @db.VarChar(16) // 'live' | 'ended'
  audienceCanAsk Boolean   @default(true)             // raise-hand allowed
  everyoneSpeaks Boolean   @default(false)            // small-meeting mode: all join as speaker
  chatEnabled    Boolean   @default(false)            // host-gated: chat box closed until host opens it
  maxParticipants Int      @default(5000)
  startedAt      DateTime  @default(now())
  endedAt        DateTime?

  host           User      @relation(fields: [hostId], references: [id])
  participants   MeetingParticipant[]

  @@index([hostId])
  @@index([status])
}

model MeetingParticipant {
  id          String    @id @default(cuid())
  meetingId   String
  userId      String?                                 // null for pure-anonymous guest
  displayName String    @db.VarChar(60)
  role        String    @default("audience") @db.VarChar(16) // 'host'|'speaker'|'audience'
  joinedAt    DateTime  @default(now())
  leftAt      DateTime?

  meeting     Meeting   @relation(fields: [meetingId], references: [id], onDelete: Cascade)
  user        User?     @relation(fields: [userId], references: [id])

  @@index([meetingId])
  @@index([userId])
}
```

`User` model: keep as the user store. Strip the now-unused premium/stripe/interests columns in a later cleanup migration (optional, non-blocking).

---

## 5. New API surface (NestJS)

| Method | Route | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/v1/meetings` | user | Create meeting → returns `{ code, link, title }` |
| `GET` | `/api/v1/meetings/:code` | public | Meeting info for lobby (title, isLive, host, count) |
| `POST` | `/api/v1/meetings/:code/token` | user/guest | Mint LiveKit token (role-based grants) |
| `POST` | `/api/v1/meetings/:code/end` | host only | End meeting |
| `GET` | `/api/v1/meetings/mine` | user | My created/joined meetings |
| `POST` | `/api/v1/meetings/:code/promote` | host | Promote audience → speaker (approve raise-hand) |
| `POST` | `/api/v1/meetings/:code/kick` | host | Remove a participant |
| `PATCH` | `/api/v1/meetings/:code/chat` | host | Toggle `chatEnabled` (open/close chat for all) |
| **Admin** | | | |
| `GET` | `/api/v1/admin/users` | admin | All users (Google + anon) + stored data |
| `GET` | `/api/v1/admin/meetings` | admin | All meetings + participant logs |

In-meeting real-time controls (raise hand, host mute, promote notifications) ride over **LiveKit's data channel + participant metadata**, so we may not even need the Socket.io gateway for the meeting itself. (Decision point §8 — keep a thin gateway vs. go full LiveKit-native.)

---

## 6. New frontend screens (Meet-style redesign)

1. **Home / Dashboard** (`/`) — **modeled on the Google Meet landing page** (reference approved by user):
   - **Top bar:** AppleTalk logo (left) · centered **"Enter a code or link" input + Join button** · **"New" button** with dropdown (**Create a meeting for later** = generate link to share · **Start an instant meeting** = create + join now · ~~Schedule in Google Calendar~~ skipped for now) · help/settings/avatar (right).
   - **Left rail:** "Meetings" (active) · "Calls" (optional/later).
   - **Center:** friendly illustration + heading (e.g. "No meetings yet" / list of my recent meetings) + a prominent **New** button repeated in the center.
   - Clean, spacious, light-or-dark Meet aesthetic, AppleTalk green accent.
2. **Lobby** (`/meet/:code`) — meeting title, "Mic on/off" toggle + live mic level meter, device picker, "Join now". Audio-only (no camera preview).
3. **Meeting Room** (`/meet/:code/room`) — the core Meet-style screen:
   - Grid of **participant tiles** — avatar/initials, name, **speaking ring** (glows when talking), mute icon.
   - Active-speaker emphasis; audience shown as a count + collapsible list (so 5,000 tiles don't melt the browser — virtualized list).
   - Bottom control bar: **Mute/Unmute**, **Raise hand**, **Participants**, **Leave**.
   - **Host controls**: mute-all, mute one, promote (approve raised hands), remove, end meeting, **toggle chat on/off**.
   - **Chat (host-gated):** chat box is hidden/closed until the host enables it; once enabled, everyone can chat (LiveKit data channel). **Reactions** (quick emoji) available in-room.
4. **Admin panel** (`/admin`) — **fully redesigned** to match the new Meet-style look (not just new tabs). Functionality restyled:
   - **Users** tab — all users, both Google-login and guest, with their stored data (name, email, join history, meetings attended, created-at, ban controls).
   - **Meetings** tab — all meetings (live + ended), with participant logs (who joined, role, join/leave times, duration).
   - Clean dashboard layout, search/filter, consistent with the app's AppleTalk green theme.

Design language: clean Meet-like dark/light, big circular avatar tiles for audio, clear speaking indicators. Current green "AppleTalk" branding can stay or be rebranded (your call).

---

## 7. Phased implementation plan

> Each phase ends in a working, testable state. I'll stop for your check between phases if you want.

### Phase 0 — Setup & spike (foundation)
- Add LiveKit: run `livekit-server --dev` locally; add `livekit-server-sdk` (API) + `livekit-client` (web).
- Env vars: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.
- Prove the pipe: hardcoded room, mint a token, two browser tabs talk audio. ✅ de-risks everything.

### Phase 1 — Strip the old app
- Delete removed modules/pages/deps (§3). App still builds, login + admin still work.
- Prisma migration: drop old models, add `Meeting` + `MeetingParticipant`.

### Phase 2 — Meetings backend
- Meetings module: create / get / token / end / mine.
- Role-based LiveKit grants (host/speaker/audience). Participant rows recorded on join/leave (via LiveKit webhooks).

### Phase 3 — Meeting frontend (core)
- Dashboard (new meeting / join by code), Lobby (mic check), Room (tiles, speaking indicators, mute, leave).
- Audio-only publish/subscribe with active-speaker UI.

### Phase 4 — Host controls & scale UX
- Raise hand → promote flow, mute-all / mute-one / remove / end.
- Virtualized audience list, active-speaker-only rendering, join/leave toasts. Load-test with many simulated clients.

### Phase 5 — Admin + polish
- Admin: all-users view (Google + anon data), meetings & participant logs.
- Final Meet-style visual pass, empty/error states, mobile layout, reconnect handling.

### Phase 6 — Production
- Self-host LiveKit via Docker in `docker-compose.prod.yml` (+ TURN for strict networks), or switch to LiveKit Cloud / Agora.
- Deploy.

**Rough effort:** Phases 0–3 (a usable Meet clone) is the bulk; 4–6 is hardening and scale. I'll give precise per-phase estimates once you approve the approach.

---

## 8. Decisions

### ✅ All decided
1. **Speak model:** **Raise-hand style** — audience joins listen-only by default; they tap "raise hand" and the host promotes them to speaker. Host + promoted speakers can talk. *(Small meetings may still opt into "everyone speaks" via the `everyoneSpeaks` flag, but raise-hand is the default behavior.)*
2. **Media server:** **LiveKit, self-hosted** — `livekit-server --dev` binary for local dev, Docker in prod. Free, we run it.
3. **Join access:**
   - **Local testing (now):** pure **guest** join allowed (enter a name, join via link — no account needed). This keeps dev/testing fast.
   - **Production behavior:** **Google login required** — without a Google account, a user cannot join a meeting. Anonymous/guest path is a dev-only convenience.
   - Implemented as a config flag (`ALLOW_GUEST_JOIN`): `true` in local, `false` in prod.
4. **In-meeting chat + reactions:** **Host-gated chat.** Chat stays **closed by default**; only when the **host enables chat** does the chat box open for everyone. Controlled by a `chatEnabled` flag on the meeting that the host can toggle live. Reactions (quick emoji) available in-room.
5. **Branding:** **Keep "AppleTalk"** (name + green theme) for now.
6. **Old data:** **Everything removed, rebuilt fresh.** All old tables (friends/posts/calls/payments/etc.) dropped in the migration; schema rebuilt for meetings.
7. **Admin panel:** **Full redesign + functionality restyle** per this plan — not just added tabs. New admin UI matching the Meet-style look, with Users (Google + guest data) and Meetings (history + participant logs) management.

---

## 9. Risks & notes
- **TURN server** needed in production for users behind strict NAT/firewalls (LiveKit handles, but must be configured). Dev is fine without.
- **Bandwidth/CPU** of the SFU grows with active speakers, not total listeners — audio-only keeps this very cheap even at thousands of listeners.
- **Browser limits** — never render 5,000 DOM tiles; audience is a virtualized list + count. Already in the plan.
- **Mobile** — `livekit-client` works in mobile browsers; the React Native app (`apps/mobile`, currently a stub) would need its own LiveKit SDK later (out of scope unless you want it).

---

### ✅ Next step
All decisions in §8 are locked in. Say **go** — then I'll start at **Phase 0** (LiveKit setup + audio spike) and build up phase by phase, pausing for your check between phases.
