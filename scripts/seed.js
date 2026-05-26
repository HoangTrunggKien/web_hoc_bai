/* eslint-disable no-console */
// Run: node scripts/seed.js  (sau khi `vercel env pull .env.local`)
// Hoặc: node scripts/seed.js --schema-only  (chỉ chạy DDL, không insert)

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { sql } = require('../lib/db.js');

const SCHEMA_ONLY = process.argv.includes('--schema-only');

const DEFAULT_USERS = [
  { username: 'admin',       fullName: 'Quản trị viên', role: 'admin',   password: '123456', contact: 'admin@geoconnect.vn',       phone: '0123456789' },
  { username: 'giaovien01',  fullName: 'Cô Lan',        role: 'teacher', password: '123',    contact: 'giaovien01@geoconnect.vn',  phone: '0987654321' },
  { username: 'phuhuynh01',  fullName: 'Anh Minh',      role: 'parent',  password: '123',    contact: 'phuhuynh01@geoconnect.vn',  phone: '0912345678' },
  { username: 'phuhuynh02',  fullName: 'Chị Hương',     role: 'parent',  password: '123',    contact: 'phuhuynh02@geoconnect.vn',  phone: '0923456789' },
  { username: 'phuhuynh03',  fullName: 'Anh Tuấn',      role: 'parent',  password: '123',    contact: 'phuhuynh03@geoconnect.vn',  phone: '0934567890' },
  { username: 'hocsinh01',   fullName: 'Hồng Anh',      role: 'student', password: '123',    contact: 'hocsinh01@geoconnect.vn',   phone: '0912345670', studentCode: '12345' },
  { username: 'hocsinh02',   fullName: 'Minh Khoa',     role: 'student', password: '123',    contact: 'hocsinh02@geoconnect.vn',   phone: '0923456780', studentCode: '67890' },
  { username: 'hocsinh03',   fullName: 'An Nhi',        role: 'student', password: '123',    contact: 'hocsinh03@geoconnect.vn',   phone: '0934567890', studentCode: '54321' },
];

async function runSchema() {
  const ddl = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  // Chạy toàn bộ DDL trong một query — pg `simple query protocol` hỗ trợ
  // multi-statement khi không pass params. Cách này đảm bảo CREATE TABLE
  // và CREATE INDEX cùng visible trong cùng session.
  await sql.query(ddl);
  console.log('✓ Schema áp dụng');
}

async function seedUsers() {
  for (const u of DEFAULT_USERS) {
    const hash = await bcrypt.hash(u.password, 10);
    await sql`
      INSERT INTO users (username, full_name, role, password_hash, contact, phone, student_code)
      VALUES (${u.username}, ${u.fullName}, ${u.role}, ${hash}, ${u.contact}, ${u.phone}, ${u.studentCode || null})
      ON CONFLICT (username) DO UPDATE SET
        full_name     = EXCLUDED.full_name,
        role          = EXCLUDED.role,
        password_hash = EXCLUDED.password_hash,
        contact       = EXCLUDED.contact,
        phone         = EXCLUDED.phone,
        student_code  = EXCLUDED.student_code
    `;
  }
  console.log(`✓ Seed ${DEFAULT_USERS.length} default users`);
}

(async () => {
  try {
    if (!process.env.POSTGRES_URL) {
      throw new Error('POSTGRES_URL chưa set. Chạy `vercel env pull .env.local` trước.');
    }
    await runSchema();
    if (!SCHEMA_ONLY) await seedUsers();
    console.log('Done.');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
})();
