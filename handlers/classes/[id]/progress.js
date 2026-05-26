const { sql, send, methodGuard } = require('../../../lib/db.js');
const { requireAuth } = require('../../../lib/auth.js');
const m = require('../../../lib/mappers.js');

module.exports = async (req, res) => {
  if (!methodGuard(req, res, ['GET'])) return;
  const session = requireAuth(req, res);
  if (!session) return;

  const classId = m.parseId(req.query && req.query.id);
  if (!classId) return send(res, 400, { message: 'classId không hợp lệ' });

  if (!['teacher', 'admin', 'parent'].includes(session.role)) {
    return send(res, 403, { message: 'Không có quyền' });
  }

  // Aggregate qua 1 query: mỗi student trong lớp + counts
  const { rows } = await sql`
    WITH stats AS (
      SELECT a.id AS assignment_id, a.class_id, s.student, s.score
      FROM assignments a
      LEFT JOIN submissions s ON s.assignment_id = a.id
      WHERE a.class_id = ${classId}
    )
    SELECT
      u.username,
      u.full_name,
      (SELECT COUNT(*) FROM assignments WHERE class_id = ${classId})::int AS total,
      COUNT(stats.assignment_id) FILTER (WHERE stats.student = u.username)::int AS completed,
      COUNT(stats.assignment_id) FILTER (WHERE stats.student = u.username AND stats.score IS NOT NULL)::int AS graded,
      COALESCE(SUM(stats.score) FILTER (WHERE stats.student = u.username), 0) AS total_score
    FROM enrollments e
    JOIN users u ON u.username = e.student
    LEFT JOIN stats ON true
    WHERE e.class_id = ${classId}
    GROUP BY u.username, u.full_name
    ORDER BY u.full_name
  `;

  const out = rows.map(r => {
    const total = Number(r.total) || 0;
    const completed = Number(r.completed) || 0;
    const graded = Number(r.graded) || 0;
    const totalScore = Number(r.total_score) || 0;
    return {
      studentUsername: r.username,
      studentName: r.full_name,
      classId: 'class_' + classId,
      totalAssignments: total,
      completedAssignments: completed,
      gradedAssignments: graded,
      completionPercent: total > 0 ? Math.round((completed / total) * 100) : 0,
      averageScore: graded > 0 ? Number((totalScore / graded).toFixed(1)) : 0,
    };
  });

  return send(res, 200, out);
};
