const bcrypt = require('bcryptjs');
const { sql, send, readJsonBody, methodGuard } = require('../../lib/db.js');
const { requireAuth } = require('../../lib/auth.js');
const { logAudit } = require('../../lib/audit.js');
const m = require('../../lib/mappers.js');

const ROLES = new Set(['admin', 'teacher', 'parent', 'student']);
const norm = (v) => String(v || '').trim().toLowerCase();

module.exports = async (req, res) => {
  if (!methodGuard(req, res, ['GET', 'POST'])) return;
  const session = requireAuth(req, res);
  if (!session) return;

  if (req.method === 'GET') {
    const role = norm(req.query && req.query.role);
    let rows;
    if (role && ROLES.has(role)) {
      ({ rows } = await sql`SELECT * FROM users WHERE role = ${role} ORDER BY username`);
    } else {
      ({ rows } = await sql`SELECT * FROM users ORDER BY username`);
    }
    return send(res, 200, rows.map(m.user));
  }

  // POST: admin tạo user
  if (session.role !== 'admin') return send(res, 403, { message: 'Chỉ admin được tạo tài khoản' });
  let body;
  try { body = await readJsonBody(req); } catch { return send(res, 400, { message: 'Body không hợp lệ' }); }

  const username = norm(body.username || body.contact);
  const fullName = String(body.fullName || '').trim();
  const role = norm(body.role);
  const password = body.password;
  const contact = String(body.contact || '').trim();
  const phone = String(body.phone || '').trim();
  const studentCode = body.studentCode || (role === 'student' ? String(Math.floor(Math.random()*90000)+10000) : null);

  if (!username || !fullName || !password || !ROLES.has(role)) {
    return send(res, 400, { message: 'Thiếu thông tin hoặc vai trò không hợp lệ' });
  }
  const exists = await sql`SELECT 1 FROM users WHERE lower(username)=${username} LIMIT 1`;
  if (exists.rows.length) return send(res, 409, { message: 'Tài khoản đã tồn tại' });

  const hash = await bcrypt.hash(password, 10);
  const { rows } = await sql`
    INSERT INTO users (username, full_name, role, password_hash, contact, phone, student_code)
    VALUES (${username}, ${fullName}, ${role}, ${hash}, ${contact || null}, ${phone || null}, ${studentCode})
    RETURNING *
  `;
  await logAudit('CREATE_USER', { username }, session.sub);
  return send(res, 201, m.user(rows[0]));
};
