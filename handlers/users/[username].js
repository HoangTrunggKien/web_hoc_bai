const bcrypt = require('bcryptjs');
const { sql, send, readJsonBody, methodGuard } = require('../../lib/db.js');
const { requireAuth } = require('../../lib/auth.js');
const { logAudit } = require('../../lib/audit.js');
const m = require('../../lib/mappers.js');

module.exports = async (req, res) => {
  if (!methodGuard(req, res, ['GET', 'PATCH', 'DELETE'])) return;
  const session = requireAuth(req, res);
  if (!session) return;

  const username = String((req.query && req.query.username) || '').toLowerCase();
  if (!username) return send(res, 400, { message: 'Thiếu username' });

  const isSelf = session.sub === username;
  const isAdmin = session.role === 'admin';

  if (req.method === 'GET') {
    const { rows } = await sql`SELECT * FROM users WHERE username=${username} LIMIT 1`;
    if (!rows[0]) return send(res, 404, { message: 'Không tìm thấy' });
    return send(res, 200, m.user(rows[0]));
  }

  if (req.method === 'PATCH') {
    if (!isSelf && !isAdmin) return send(res, 403, { message: 'Không có quyền' });
    let body;
    try { body = await readJsonBody(req); } catch { return send(res, 400, { message: 'Body không hợp lệ' }); }

    const fullName = body.fullName != null ? String(body.fullName).trim() : null;
    const contact = body.contact != null ? String(body.contact).trim() : null;
    const phone = body.phone != null ? String(body.phone).trim() : null;
    const password = body.password;
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;

    const { rows } = await sql`
      UPDATE users SET
        full_name     = COALESCE(${fullName}, full_name),
        contact       = COALESCE(${contact}, contact),
        phone         = COALESCE(${phone}, phone),
        password_hash = COALESCE(${passwordHash}, password_hash)
      WHERE username = ${username}
      RETURNING *
    `;
    if (!rows[0]) return send(res, 404, { message: 'Không tìm thấy' });
    await logAudit('UPDATE_USER', { username, fields: Object.keys(body) }, session.sub);
    return send(res, 200, m.user(rows[0]));
  }

  if (req.method === 'DELETE') {
    if (!isAdmin) return send(res, 403, { message: 'Chỉ admin được xóa tài khoản' });
    const { rowCount } = await sql`DELETE FROM users WHERE username=${username}`;
    if (!rowCount) return send(res, 404, { message: 'Không tìm thấy' });
    await logAudit('DELETE_USER', { username }, session.sub);
    return send(res, 200, { ok: true });
  }
};
