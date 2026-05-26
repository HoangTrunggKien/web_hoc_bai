const { sql, send, readJsonBody, methodGuard } = require('../../lib/db.js');
const { requireAuth } = require('../../lib/auth.js');
const { logAudit } = require('../../lib/audit.js');
const m = require('../../lib/mappers.js');

module.exports = async (req, res) => {
  if (!methodGuard(req, res, ['GET', 'PATCH', 'DELETE'])) return;
  const session = requireAuth(req, res);
  if (!session) return;

  const id = m.parseId(req.query && req.query.id);
  if (!id) return send(res, 400, { message: 'classId không hợp lệ' });

  if (req.method === 'GET') {
    const { rows } = await sql`SELECT * FROM classes WHERE id=${id} LIMIT 1`;
    if (!rows[0]) return send(res, 404, { message: 'Không tìm thấy lớp' });
    return send(res, 200, m.klass(rows[0]));
  }

  // Auth: teacher chủ lớp hoặc admin
  const owner = await sql`SELECT teacher FROM classes WHERE id=${id} LIMIT 1`;
  if (!owner.rows[0]) return send(res, 404, { message: 'Không tìm thấy lớp' });
  const isOwner = owner.rows[0].teacher === session.sub;
  if (!isOwner && session.role !== 'admin') return send(res, 403, { message: 'Không có quyền' });

  if (req.method === 'PATCH') {
    let body;
    try { body = await readJsonBody(req); } catch { return send(res, 400, { message: 'Body không hợp lệ' }); }
    const name = body.name != null ? String(body.name).trim() : null;
    const code = body.code != null ? String(body.code).trim() : null;
    const status = body.status != null ? String(body.status).trim() : null;
    const teacher = body.teacher != null ? String(body.teacher).trim() : null;

    const { rows } = await sql`
      UPDATE classes SET
        name    = COALESCE(${name}, name),
        code    = COALESCE(${code}, code),
        status  = COALESCE(${status}, status),
        teacher = COALESCE(${teacher}, teacher)
      WHERE id = ${id}
      RETURNING *
    `;
    await logAudit('UPDATE_CLASS', { classId: id, fields: Object.keys(body) }, session.sub);
    return send(res, 200, m.klass(rows[0]));
  }

  if (req.method === 'DELETE') {
    await sql`DELETE FROM classes WHERE id=${id}`;
    await logAudit('DELETE_CLASS', { classId: id }, session.sub);
    return send(res, 200, { ok: true });
  }
};
