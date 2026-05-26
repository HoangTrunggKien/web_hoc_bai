const { sql, send, methodGuard } = require('../../../lib/db.js');
const { requireAuth } = require('../../../lib/auth.js');
const m = require('../../../lib/mappers.js');

module.exports = async (req, res) => {
  if (!methodGuard(req, res, ['GET'])) return;
  const session = requireAuth(req, res);
  if (!session) return;

  const username = String((req.query && req.query.username) || '').toLowerCase();
  if (!username) return send(res, 400, { message: 'Thiếu username' });

  // Self / admin / parent của student / bất kỳ teacher
  const isSelf = session.sub === username;
  const isAdmin = session.role === 'admin';
  const isTeacher = session.role === 'teacher';

  let canView = isSelf || isAdmin || isTeacher;
  if (!canView && session.role === 'parent') {
    const link = await sql`SELECT 1 FROM parent_students WHERE parent=${session.sub} AND student=${username} LIMIT 1`;
    canView = link.rows.length > 0;
  }
  if (!canView) return send(res, 403, { message: 'Không có quyền' });

  const { rows } = await sql`
    SELECT c.* FROM classes c
    JOIN enrollments e ON e.class_id = c.id
    WHERE e.student = ${username}
    ORDER BY c.id
  `;
  return send(res, 200, rows.map(m.klass));
};
