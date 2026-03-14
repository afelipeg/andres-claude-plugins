# Next Session — 09 Mar 2027
**Status entering session:** QA-ready build deployed to Vercel + Railway. All 40 tests passing.

---

## 0. Pre-flight (do first, ~2 min)

No Railway env vars needed. Admin user is hardcoded in `apps/api/src/routes/auth.ts`.
Verify login works after Railway redeploys:
```bash
curl -X POST https://polanyi-plinth-production.up.railway.app/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dedalo@polanyi.tech","password":"[your password]"}'
# Expect: {"user":{"email":"dedalo@polanyi.tech","role":"admin",...},"token":"..."}
```

---

## 1. User Management (inside /app)

### Goal
A settings area where the admin can invite team members, manage access, and see who has logged in — standard SaaS pattern.

### Scope
- `/app/settings/users` — user list table (name, email, role, last login, status)
- Invite flow: admin enters email → backend sends invite token (or shows a one-time link for MVP)
- Role picker: `admin` | `engine_user` | `viewer`
- Deactivate / revoke user (soft-delete in userStore or DB)
- `/app/settings/profile` — current user can change their own name/password

### Backend work needed
- `POST /v1/auth/invite` — create a pending invite record (in-memory or DB)
- `POST /v1/auth/accept-invite` — accept invite, set password, activate account
- `GET /v1/users` (admin-only) — list all users
- `PATCH /v1/users/:id` — update role or deactivate
- `DELETE /v1/users/:id` — revoke

### Note
Auth is currently in-memory (`userStore` Map in `apps/api/src/routes/auth.ts`). For persistence across Railway restarts, wire to PostgreSQL (`packages/memory`) before shipping user management.

---

## 2. Settings Section (/app/settings)

### Goal
A full SaaS-style settings area — account, team, billing, notifications. Accessible via sidebar nav.

### Pages to build
| Route | Content |
|---|---|
| `/app/settings` | Redirect → `/app/settings/profile` |
| `/app/settings/profile` | Name, email, change password |
| `/app/settings/users` | User management (see §1) |
| `/app/settings/billing` | Plan, usage, invoice history (wire to billing engine) |
| `/app/settings/notifications` | Email alert preferences |

### Sidebar change
Add "Settings" item to `apps/web/src/components/Layout.tsx` sidebar nav, with gear icon (lucide `Settings`), grouped below the engine pages.

---

## 3. Code Refactor — Is it viable?

**Yes, but scope it carefully.** Here's the honest assessment:

### What's safe to refactor (low risk)
- `apps/web/src/pages/*` — pages are self-contained, safe to restructure
- Extract shared `<PageHeader>` component (title + description used on every engine page)
- Extract `<Section>` wrapper used in Integrations + Settings
- `useEngine.ts` already fixed (individual Zustand selectors) — no further refactor needed

### What needs care (medium risk)
- `apps/api/src/routes/` — adding DB persistence for userStore touches auth.ts. Do this as a standalone task, not mixed with feature work.
- `packages/engines/` — no refactor needed, engines are clean. Don't touch unless adding a skill.

### What to avoid tomorrow
- Do NOT refactor `packages/core`, `packages/agent`, or `packages/events` — these are battle-tested with 40 tests. Risk-reward is bad.
- Do NOT change `vite.config.ts` browserStubs — fragile, works, leave it.

### Recommendation
Refactor only what's blocking the session's features. If building `/app/settings`, create new files rather than restructuring existing ones. Defer large-scale refactor to a dedicated session after E2E tests are green.

---

## 4. Pending from Bloque 2 (still open)

- [ ] E2E smoke tests (NEXT_SESSION.md §2.1–2.4): login → run engine → verify result
- [ ] Docker compose migration ordering: 001→002→003→004_schedules→005_files
- [ ] Fly.io deploy (alternative to Railway) — optional
- [ ] HFL escalation from Delivery Engine when score < 40

---

## 5. QA Checklist (verify at session start)

| Page | Expected |
|---|---|
| `plinth.polanyi.tech` | Landing loads, #how-it-works shows teaser cards |
| `/login` | Sign-in form only, no Register tab |
| `/app` (after login) | Dashboard loads, no blank pages |
| `/app/leak-detector` | Form works, no React #185 error |
| `/app/integrations` | API key section, MCP tabs, 6 platform connectors |
| `/app/command-center` | Pipeline runs end-to-end |

---

## 6. Architecture state (v3.2.0 + session changes)

```
apps/web  — Vite 5 + React 19 + Zustand 5
  /demo/* — investor demo (in-browser engines)
  /app/*  — real backend (Railway API)
    /login           ← sign-in only, no register
    /app/integrations ← API keys + MCP + connectors
    /app/settings    ← TODO next session

apps/api  — Hono + Railway
  ADMIN_EMAIL + ADMIN_PASSWORD env vars → seed admin on startup
  POST /v1/auth/register → 403 (closed)
```
