const { sql, send, methodGuard } = require('../../../../lib/db.js');
const { requireAuth } = require('../../../../lib/auth.js');
const { logAudit } = require('../../../../lib/audit.js');
const m = require('../../../../lib/mappers.js');

module.exports = async (req, res) => {
  if (!methodGuard(req, res, ['DELETE'])) return;
  const session = requireAuth(req, res);
  if (!session) return;

  const classId = m.parseId(req.query && req.query.id);
  const username = String((req.query && req.query.username) || '').toLowerCase();
  if (!classId || !username) return send(res, 400, { message: 'Thiếu tham số' });

  // teacher chủ lớp / admin / chính học sinh đó được rời lớp
  const owner = await sql`SELECT teacher FROM classes WHERE id=${classId} LIMIT 1`;
  const isOwner = owner.rows[0] && owner.rows[0].teacher === session.sub;
  const isSelf = session.sub === username;
  if (!isOwner && session.role !== 'admin' && !isSelf) {
    return send(res, 403, { message: 'Không có quyền' });
  }

  const { rowCount } = await sql`DELETE FROM enrollments WHERE class_id=${classId} AND student=${username}`;
  if (!rowCount) return send(res, 404, { message: 'Không tìm thấy enrollment' });
  await logAudit('REMOVE_ENROLLMENT', { classId, student: username }, session.sub);
  return send(res, 200, { ok: true });
};
