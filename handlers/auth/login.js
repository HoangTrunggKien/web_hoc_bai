const bcrypt = require('bcryptjs');
const { sql, send, readJsonBody, methodGuard } = require('../../lib/db.js');
const { signJwt, setAuthCookie } = require('../../lib/auth.js');
const { logAudit } = require('../../lib/audit.js');

function normalize(v) { return String(v || '').trim().toLowerCase(); }

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

  const identifier = normalize(body.identifier);
  const password = body.password || '';
  const role = normalize(body.role);

  if (!identifier || !password) return send(res, 400, { message: 'Thiếu thông tin đăng nhập' });

  const { rows } = await sql`
    SELECT * FROM users
    WHERE lower(username) = ${identifier} OR lower(contact) = ${identifier}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return send(res, 401, { message: 'Sai tài khoản, mật khẩu hoặc vai trò đăng nhập.' });

  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) return send(res, 401, { message: 'Sai tài khoản, mật khẩu hoặc vai trò đăng nhập.' });

  if (role && role !== 'any' && row.role !== role) {
    return send(res, 401, { message: 'Sai tài khoản, mật khẩu hoặc vai trò đăng nhập.' });
  }

  const token = signJwt({ username: row.username, role: row.role });
  setAuthCookie(res, token);
  await logAudit('LOGIN', { username: row.username }, row.username);
  return send(res, 200, publicUser(row));
};
