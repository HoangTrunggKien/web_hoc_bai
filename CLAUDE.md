# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

**GeoConnect 6** — Vietnamese-language web app for teaching 6th-grade Geography. Deploys to Vercel: static HTML frontend + Vercel Serverless Functions backend + Vercel Postgres + Vercel Blob + JWT cookie auth. UI text is in Vietnamese; preserve Vietnamese strings when editing.

## Running locally

```bash
npm install
vercel link
vercel env pull .env.local
node scripts/seed.js   # creates schema + seeds 8 demo users
vercel dev             # http://localhost:3000
```

`.env.local` needs `POSTGRES_URL`, `BLOB_READ_WRITE_TOKEN` (Vercel-injected), `JWT_SECRET` (manual). See `.env.example`.

Seed accounts (re-runnable with `node scripts/seed.js`):
- `admin` / `123456`
- `giaovien01` / `123` (teacher)
- `phuhuynh01–03` / `123` (parents)
- `hocsinh01–03` / `123` (students)

## Architecture

### Two-layer split
**Frontend** (`/` — root): ~30 static HTML files + `app.js` + `style.css`, served as static by Vercel. Each HTML page loads `app.js` and uses `window.GeoConnectApp.*` (now async) which calls REST endpoints under `/api/*`. UI inline scripts wrap their logic in `async function` IIFEs and `await` every data call.

**Backend** (`/api/*`): Vercel Serverless Functions (Node.js, CommonJS). Filename-based routing — e.g. `api/classes/[id].js` → `/api/classes/<n>`. Helpers in `/lib/`:
- `db.js` — `@vercel/postgres` `sql` tagged-template + `send/readJsonBody/methodGuard` HTTP helpers
- `auth.js` — JWT sign/verify, cookie set/clear, `requireAuth(req,res,roles?)` guard
- `blob.js` — Vercel Blob put/del wrappers
- `audit.js` — `logAudit(action,details,userId)` server-side
- `mappers.js` — DB row → JSON shape compatible with the original localStorage format (returns `id` as `'class_<n>'` etc., camelCase fields). All API handlers serialise via these.

### ID convention
DB primary keys are `bigserial`, but APIs return ids as prefixed strings (`'class_42'`, `'assign_42'`, etc.) to match the original frontend shape. `lib/mappers.parseId('class_42')` → `42`. The frontend's `app.js` has `stripPrefix()` for the same purpose when calling APIs.

### Auth flow
- `POST /api/auth/login` → bcrypt verify → JWT in `gc_session` HTTP-only cookie (7-day expiry, `Secure` only in prod) → returns user shape (no `password_hash`).
- `GET /api/auth/me` reads cookie, returns user. Frontend caches result in `_meCache` in `app.js`.
- Every protected handler starts with `const session = requireAuth(req, res, ['admin','teacher'])` (or omit roles for any-auth). It writes 401/403 directly and returns `null`.
- Logout: `POST /api/auth/logout` clears the cookie.

Plaintext passwords from the old localStorage version are gone — bcrypt hashes are seeded in `users.password_hash`.

### Role-based pages by filename prefix
Same convention as before. Each role's HTML files share a prefix and share an inline-script pattern:
- `admin-*` and `dashboard.html` → admin
- `teacher-*` and `teacher-dashboard.html` → teacher
- `parent-*` and `parent-dashboard.html` → parent
- `student-*` and `student-home.html` → student

Two consequences:
1. **Access control**: every protected page calls `await GeoConnectApp.ensureRoleAccess('<role>', 'login.html')` on `DOMContentLoaded`. It fetches `/api/auth/me`, redirects if missing/wrong role, and removes `body.loading` on success. New protected pages must do the same.
2. **Auto-built top nav**: `buildGlobalNav()` runs on `DOMContentLoaded` for any page whose `<body>` has class `dashboard-page`. It detects role from the filename prefix and renders the matching menu. Add new pages to `app.js` `buildGlobalNav()` `items = [...]`.

`body.loading` (from `style.css`) hides dashboard content until `ensureRoleAccess` resolves — prevents flash. New protected pages must include both `dashboard-page` and `loading` in `<body class>`.

### Database schema (`scripts/schema.sql`)
10 tables, all idempotent (`CREATE TABLE IF NOT EXISTS`). Highlights:
- `users.username text PRIMARY KEY` (natural key — every other table FKs to it).
- `users.selected_student_username` — replaces the old `parent_setup_*` localStorage keys.
- `enrollments` `UNIQUE(class_id, student)`; `submissions` `UNIQUE(assignment_id, student)`.
- JSONB columns for shape-preserving fields: `assignments.questions/attachments`, `submissions.answers/submission_file`, `lessons.resources`, `class_posts.files`, `audit_log.details`.
- File metadata is stored **inline as JSONB** (`{url, name, size, type}`) — there is no `attachments` table. Files themselves live in Vercel Blob.

### Cross-entity relationships (now in DB)
- **Enrollments** link students to classes; teachers own a class via `class.teacher = username`.
- **Parent–student** links (`parent_students` table) — separate from enrollments. Parent picks a child via `parent-setup.html` → `POST /api/parent-students` (with `studentCode`) + `PUT /api/parent/session` writes `users.selected_student_username`.
- **Submissions** join student×assignment with `UNIQUE`; teachers grade via `PATCH /api/submissions/[id]`.
- **Class posts** are an announcement/comment feed per class, distinct from assignments.

### Page-specific behavior
Every HTML page embeds an inline `<script>` at the bottom that orchestrates the page UI by calling `GeoConnectApp.*` helpers — every data call is async. Larger flows (e.g. `student-practice.html`, `teacher-manage-lessons.html`, `teacher-assignments.html`, `teacher-class-detail.html`) contain substantial inline JS. There is no shared component system — copy/paste is the norm; if you change a UI pattern that appears on multiple pages, update each one.

### File uploads
- Frontend: `await GeoConnectApp.uploadFile(file)` posts the file body directly to `POST /api/uploads?name=<filename>` and returns `{url, pathname, name, size, type}`.
- Backend: `api/uploads.js` disables Vercel's body parser (`module.exports.config = { api: { bodyParser: false } }` after `module.exports = handler`) and streams the request into `@vercel/blob.put()`.
- Frontend then includes the returned metadata when calling `submitAssignment` / `createClassPost` / etc. **Never** base64-encode files into the DB — use Blob.

### Styles
`style.css` holds all global styles. Page-specific tweaks live in inline `<style>` blocks at the top of each HTML file. The `dashboard-page` body class adds top padding to make room for the injected global nav. The `loading` body class hides `.dashboard-content / .dashboard-sidebar / main / .auth-card` until auth check resolves.

## Common tasks

- **Add a new entity**: `scripts/schema.sql` (CREATE TABLE) → `lib/mappers.js` (row→JSON) → `/api/<entity>/index.js` + `[id].js` handlers → expose helpers on `window.GeoConnectApp` in `app.js`.
- **Add a new role-protected page**: `<body class="dashboard-page loading">`, inline script wraps `DOMContentLoaded` in async, calls `await GeoConnectApp.ensureRoleAccess(role, 'login.html')`, returns early if false. Add nav entry in `buildGlobalNav()` in `app.js` if needed.
- **Reset state during dev**: `node scripts/seed.js` re-runs schema (idempotent) + re-seeds users (UPSERT). To wipe data, drop tables in Postgres dashboard and re-run.

## Avoid
- Never reintroduce `localStorage` for cross-session data — DB is the source of truth.
- Never base64-encode files into DB columns — go through Vercel Blob.
- Never store plaintext passwords. Use `bcrypt.hash(pw, 10)`.
- Never call `requireAuth` with hardcoded role checks duplicated inline — use the `roles` parameter.
- The `clear-storage.html` page is a leftover from the localStorage era; don't rely on it.
