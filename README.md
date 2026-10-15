# 🥭 MangoTalk

> **Talk to strangers. Voice only. No camera.**

MangoTalk is a voice-first anonymous random chat platform. Think Omegle — but voice-only, privacy-centric, and built for a global (South-Asia-first) audience. Users get matched with strangers in ~30 seconds based on shared interests and region, then just start talking.

---

## 📌 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Development Roadmap](#-development-roadmap)
- [Team](#-team)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎯 Overview

| | |
|---|---|
| **Project** | MangoTalk — Voice Chat Platform |
| **Status** | Pre-Development / Planning |
| **Platforms** | Web (PWA), Android, iOS |
| **Timeline** | 12 months to public launch |
| **Audience** | 18–30, students, language learners, expats, accessibility users |

**Mission:** Build the most authentic, safe, and fun anonymous voice chat experience — starting from South Asia.

---

## ✨ Features

### Free (all users)
- 🎤 **Voice-only chat** — real-time 1-on-1 anonymous calls (WebRTC)
- 🎯 **Interest-based matching** — pair on what you care about
- 🌍 **Country / region filter** — practice languages, meet locals
- 📸 **Safe image sharing** — AI-moderated before delivery
- 🎮 **In-chat mini-games** — Tic-Tac-Toe ice breaker
- 📜 **Call history & reconnect** — pick up dropped chats
- 👥 **Anonymous friends system** — keep the good matches
- 🚫 **Report & block** — one-tap safety

### Premium (paid tier)
- 🤖 **AI gender matching** — voice-pattern based pairing
- ⚡ **Priority queue** — skip the wait
- 🎨 **Advanced filters** — age, language, mood
- 🔒 **Ad-free + extended history**

---

## 🛠 Tech Stack

### Frontend
| Layer | Technology |
|---|---|
| Web | React.js + TypeScript (PWA) |
| Mobile | React Native (Android & iOS) |
| Styling | Tailwind CSS + shadcn/ui |
| State | Zustand |
| Voice | WebRTC + simple-peer |

### Backend
| Layer | Technology |
|---|---|
| API | Node.js + NestJS |
| Realtime | Socket.io (signaling, presence) |
| Matchmaking | Redis + Bull Queue |
| Database | PostgreSQL |
| Cache | Redis |
| Storage | AWS S3 / Cloudflare R2 |
| Auth | JWT + device fingerprinting (anonymous) |

### AI & Moderation
| Component | Technology |
|---|---|
| Image moderation | AWS Rekognition / Google Vision |
| Voice gender filter | Custom TensorFlow model |
| Audio moderation | AssemblyAI / Symbl.ai |

### Infrastructure
| Component | Technology |
|---|---|
| Cloud | AWS (EC2, RDS, S3, CloudFront) |
| Containers | Docker + Kubernetes (EKS) |
| CI/CD | GitHub Actions |
| Monitoring | Grafana + Prometheus + Sentry |
| CDN / Security | Cloudflare + AWS WAF |

---

## 📁 Project Structure

```
mangotalk/
├── apps/
│   ├── web/                 # React PWA (landing + chat client)
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── hooks/
│   │   │   ├── lib/         # webrtc, socket clients
│   │   │   └── store/       # zustand state
│   │   └── package.json
│   │
│   ├── mobile/              # React Native app
│   │   ├── src/
│   │   └── package.json
│   │
│   └── api/                 # NestJS backend
│       ├── src/
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   ├── matchmaking/
│       │   │   ├── signaling/
│       │   │   ├── friends/
│       │   │   ├── moderation/
│       │   │   └── payments/
│       │   ├── common/
│       │   └── main.ts
│       └── package.json
│
├── packages/
│   ├── ui/                  # shared components / design tokens
│   ├── types/               # shared TS types
│   └── config/              # eslint, tsconfig, etc.
│
├── infra/                   # docker, k8s manifests, terraform
├── docs/                    # architecture & API docs
├── docker-compose.yml
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js >= 20.x
- pnpm >= 9.x (monorepo package manager)
- Docker & Docker Compose
- PostgreSQL 16 & Redis 7 (or use Docker)

### Installation

```bash
# 1. Clone the repo
git clone https://github.com/your-org/mangotalk.git
cd mangotalk

# 2. Install dependencies (monorepo)
pnpm install

# 3. Copy environment variables
cp .env.example .env
# → fill in the values (see below)

# 4. Start infra (Postgres + Redis)
docker-compose up -d

# 5. Run database migrations
pnpm --filter api migrate:dev

# 6. Start everything in dev mode
pnpm dev
```

### Run individual apps

```bash
pnpm --filter web dev        # web client     → http://localhost:5173
pnpm --filter api dev        # backend API    → http://localhost:3000
pnpm --filter mobile start   # React Native (Expo / Metro)
```

---

## 🔐 Environment Variables

Create a `.env` file based on `.env.example`:

```env
# Server
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/mangotalk
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=your_jwt_secret_here

# WebRTC / TURN
TURN_SERVER_URL=turn:your-turn-server:3478
TURN_USERNAME=
TURN_CREDENTIAL=

# AI / Moderation
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=
ASSEMBLYAI_API_KEY=

# Payments
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

> ⚠️ Never commit `.env` to version control.

---

## 🗓 Development Roadmap

| Phase | Months | Focus | Key Deliverables |
|---|---|---|---|
| **1 — Foundation** | 1–2 | Setup & core voice | Architecture, auth, WebRTC signaling, basic UI |
| **2 — Core Features** | 3–5 | Matching & social | Matchmaking, country filter, image sharing, friends, games |
| **3 — Premium & AI** | 6–7 | Monetization | Payments, AI gender filter, premium dashboard |
| **4 — Mobile App** | 8–10 | Cross-platform | React Native parity, push notifications, store submission |
| **5 — Testing & Launch** | 11–12 | Ship it 🚀 | Load/security testing, beta, public launch |

### Milestones
- [ ] **Beta launch** (Month 11) — 1,000 invite-only users
- [ ] **Public launch** (Month 12) — 10,000 users
- [ ] **Break-even** (Month 20) — ~5,000 premium subscribers

---

## 👥 Team

| Role | Count |
|---|---|
| Project Manager | 1 |
| Backend Developer | 2 |
| Frontend Developer | 2 |
| Mobile Developer | 2 |
| ML / AI Engineer | 1 |
| UI/UX Designer | 1 |
| QA Engineer | 1 |
| DevOps Engineer | 1 |

**Total:** 11 people · Remote-first · Daily standups + weekly sprint reviews

---

## 🤝 Contributing

1. Create a branch: `git checkout -b feature/your-feature`
2. Follow the commit convention: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`
3. Run linting & tests before pushing: `pnpm lint && pnpm test`
4. Open a Pull Request against `develop`
5. Request review from at least one team member

### Branch Strategy
- `main` — production
- `develop` — integration / staging
- `feature/*` — new features
- `fix/*` — bug fixes

---

## 📊 Success Metrics (6 months post-launch)

- **DAU:** 50,000+
- **Avg. call duration:** 8+ minutes
- **Day-7 retention:** 35%+
- **Match success rate:** 90%+ (within 30s)
- **App Store rating:** 4.3+ stars
- **Premium conversion:** 3–5% of MAU

---

## 📄 License

© 2026 MangoTalk Inc. All rights reserved.

This is proprietary software. Unauthorized copying, distribution, or modification is prohibited.

---

<div align="center">

**🥭 MangoTalk — Where Every Stranger Becomes a Story**

*No camera. No sign up. Just your voice.*

</div>
