# GeoConnect 6 — Vercel deployment

Hệ thống học tập Địa lý lớp 6, deploy trên Vercel:
- **Frontend**: HTML tĩnh + `app.js` thin client (fetch → REST API)
- **Backend**: Vercel Serverless Functions trong `/api/*`
- **Database**: Vercel Postgres (Neon) via `@vercel/postgres`
- **File storage**: Vercel Blob via `@vercel/blob`
- **Auth**: bcrypt + JWT trong HTTP-only cookie

## Cấu trúc

```
/                       HTML pages (~30 file), app.js, style.css, logo
/api/                   Serverless functions
  auth/                 login, register, logout, me
  users/                CRUD users + classes/submissions của user
  classes/              CRUD classes + enrollments + posts + progress
  assignments/          CRUD assignments + submissions
  submissions/          PATCH chấm điểm
  lessons/              CRUD lessons
  notifications/        list/create/mark-read
  posts/                PATCH/DELETE class posts
  parent/               GET/PUT selected child session
  parent-students/      link/unlink phụ huynh ↔ học sinh
  audit/                admin xem audit log
  uploads.js            POST file → Vercel Blob
/lib/                   db.js, auth.js, blob.js, audit.js, mappers.js
/scripts/               schema.sql + seed.js
package.json            deps: @vercel/postgres, @vercel/blob, bcryptjs, jsonwebtoken
vercel.json             cache headers cho /api
```

## Setup local

```bash
npm install
vercel link               # link với Vercel project
# Trong Vercel Dashboard → Storage: tạo Postgres + Blob (lần đầu)
vercel env pull .env.local
node scripts/seed.js      # tạo schema + seed 8 user mẫu
vercel dev                # http://localhost:3000
```

`.env.local` cần có (Vercel inject tự động trừ JWT_SECRET):
```
POSTGRES_URL=...
BLOB_READ_WRITE_TOKEN=...
JWT_SECRET=<openssl rand -base64 32>
```

## Tài khoản mẫu (seed)

| Username      | Password | Vai trò    |
| ------------- | -------- | ---------- |
| admin         | 123456   | admin      |
| giaovien01    | 123      | teacher    |
| phuhuynh01–03 | 123      | parent     |
| hocsinh01–03  | 123      | student    |

## Deploy

1. Push lên GitHub
2. Import repo vào Vercel
3. Storage tab: tạo Postgres + Blob (env tự inject)
4. Settings → Env: thêm `JWT_SECRET`
5. Deploy. Sau đó chạy seed cho prod:
   ```bash
   vercel env pull .env.local
   node scripts/seed.js
   ```

## Test

Login mỗi vai trò → mỗi role có dashboard riêng → tạo lớp → giao bài → nộp bài → chấm điểm. Tất cả file upload lên Vercel Blob, chỉ metadata (URL) lưu trong Postgres.
