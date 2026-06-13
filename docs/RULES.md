# Media Database Manager — AI Agent Rules

> Rules for AI coding agents working on this repository.

---

## 1. Knowledge Honesty

- Never fabricate information about the repository
- If information is missing: `TODO: missing input`
- If unsure about impact: `TODO: decision needed`
- Distinguish between **observed facts**, **assumptions**, and **proposed changes**

## 2. Anti-Hallucination Safeguards

Before writing or modifying code:

1. Verify the target file exists
2. Verify the function/variable being referenced exists
3. Verify column names against `server/scripts/initDb.js` (DB schema source of truth)
4. Verify API endpoints against `server/routes/*.js`

## 3. Project-Specific Rules

### Database

- `files` table has **NO `user_id` column** — ownership via `folder_id → folders.user_id`
- `scans` table has **NO `scan_type` column** — use `scan_options` (JSON)
- All file queries MUST `JOIN folders` to filter by `user_id`
- Use `JOIN` not `LEFT JOIN` when `WHERE` filters on `folders.*`
- DB schema source of truth: `server/scripts/initDb.js`

### Authentication

- All protected routes get `req.userId` from `extractUserId` middleware
- Use `req.userId` (not `req.user.id`) for consistency
- Don't apply `authenticateToken` inside route files — it's applied in `index.js`
- Exception: `auth.js` routes that need per-route auth (profile, logout)
- Exception: `admin.js` applies its own `authenticateToken + requireAdmin`

### Async Patterns

- Scan routes (`scan.js`) use **async/await with Promise wrappers**
- Other routes (`stats.js`, `search.js`, `delete.js`) use **callback-based** patterns
- When modifying scan logic, use `dbRunAsync`/`dbGetAsync`/`dbAllAsync` from `scan.js`
- Never use `setTimeout` for sequencing — use `await` or `db.serialize()`

### Frontend

- UI library: Ant Design 5.x (`antd`)
- Charts: Recharts 3.x
- State: React Context (AuthContext) — no Redux
- API: `ApiService` class in `services/api.js` — all endpoints go through this
- No routing library — single-page with Tabs

### File Structure

```
client/src/components/    ← All UI components (flat, no nesting)
client/src/contexts/      ← AuthContext only
client/src/services/      ← api.js only
client/src/utils/         ← clipboard.js only
server/routes/            ← All API route handlers
server/middleware/         ← auth.js middleware only
server/scripts/           ← initDb.js only
```

## 4. Scope Control

- Do NOT add new npm dependencies without explicit approval
- Do NOT modify `server/middleware/auth.js` without understanding all consumers
- Do NOT add `user_id` to `files` table — this is by design
- Do NOT use `LEFT JOIN` when `WHERE` clause requires the joined table's columns

## 5. Documentation Requirements

After any code change:

1. Update `CHANGELOG.md` with date and description
2. If DB schema changed → update `docs/DATABASE.md`
3. If API changed → update `docs/API.md`
4. If architecture changed → update `docs/SYSTEM_DESIGN.md`
5. Bump version in root `package.json` (semver)

## 6. Version Convention

- `package.json` (root): Project version
- `server/package.json`: May lag — not authoritative
- `client/package.json`: CRA default — not authoritative
- **Root `package.json` is the version source of truth**
