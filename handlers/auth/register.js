const bcrypt = require('bcryptjs');
const { sql, send, readJsonBody, methodGuard } = require('../../lib/db.js');
const { signJwt, setAuthCookie } = require('../../lib/auth.js');
const { logAudit } = require('../../lib/audit.js');

const ROLES = new Set(['admin', 'teacher', 'parent', 'student']);

function normalize(v) { return String(v || '').trim().toLowerCase(); }

function generateStudentCode() {
  return String(Math.floor(Math.random() * 90000) + 10000);
}

function publicUser(row) {
  return {
    username: row.username,
    fullName: row.full_name,
    role: row.role,
    contact: row.contact,
    phone: row.phone,
    studentCode: row.student_code,
  };
}

module.exports = async (req, res) => {
  if (!methodGuard(req, res, ['POST'])) return;
  let body;
  try { body = await readJsonBody(req); } catch { return send(res, 400, { message: 'Body không hợp lệ' }); }

  const fullName = String(body.fullName || '').trim();
  const contact = String(body.contact || '').trim();
  const role = normalize(body.role);
  const password = body.password;

  if (!fullName || !contact || !password) return send(res, 400, { message: 'Thiếu thông tin' });
  if (!ROLES.has(role)) return send(res, 400, { message: 'Vai trò không hợp lệ' });

  const username = normalize(contact);
  const exists = await sql`
    SELECT 1 FROM users WHERE lower(username) = ${username} OR lower(contact) = ${username} LIMIT 1
  `;
  if (exists.rows.length) return send(res, 409, { message: 'Tài khoản này đã tồn tại.' });

  const hash = await bcrypt.hash(password, 10);
  const studentCode = role === 'student' ? generateStudentCode() : null;

  const inserted = await sql`
    INSERT INTO users (username, full_name, role, password_hash, contact, student_code)
    VALUES (${username}, ${fullName}, ${role}, ${hash}, ${contact}, ${studentCode})
    RETURNING *
  `;
  const row = inserted.rows[0];

  const token = signJwt({ username: row.username, role: row.role });
  setAuthCookie(res, token);
  await logAudit('REGISTER', { username: row.username, role: row.role }, row.username);
  return send(res, 201, publicUser(row));
};
