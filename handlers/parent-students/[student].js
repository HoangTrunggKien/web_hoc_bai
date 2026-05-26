const { sql, send, methodGuard } = require('../../lib/db.js');
const { requireAuth } = require('../../lib/auth.js');
const { logAudit } = require('../../lib/audit.js');

module.exports = async (req, res) => {
  if (!methodGuard(req, res, ['DELETE'])) return;
  const session = requireAuth(req, res);
  if (!session) return;

  const studentUsername = String((req.query && req.query.student) || '').toLowerCase();
  const parentParam = req.query && req.query.parent ? String(req.query.parent).toLowerCase() : null;
  if (!studentUsername) return send(res, 400, { message: 'Thiếu student' });

  const parentUsername = session.role === 'parent' ? session.sub : (parentParam || null);
  if (!parentUsername) return send(res, 400, { message: 'Thiếu parent' });
  if (session.role !== 'admin' && session.sub !== parentUsername) {
    return send(res, 403, { message: 'Không có quyền' });
  }

  const { rowCount } = await sql`DELETE FROM parent_students WHERE parent=${parentUsername} AND student=${studentUsername}`;
  if (!rowCount) return send(res, 404, { message: 'Không tìm thấy liên kết' });
  await logAudit('UNLINK_PARENT_STUDENT', { parent: parentUsername, student: studentUsername }, session.sub);
  return send(res, 200, { ok: true });
};
