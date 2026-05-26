const { sql, send, methodGuard } = require('../../lib/db.js');
const { requireAuth } = require('../../lib/auth.js');

module.exports = async (req, res) => {
  if (!methodGuard(req, res, ['GET'])) return;
  const session = requireAuth(req, res, ['teacher', 'admin']);
  if (!session) return;

  const teacher = (req.query && req.query.teacher) || session.sub;
  if (teacher !== session.sub && session.role !== 'admin') {
    return send(res, 403, { message: 'Không có quyền' });
  }

  // Summary counts
  const summary = await sql`
    SELECT
      (SELECT COUNT(*)::int FROM classes WHERE teacher=${teacher}) AS class_count,
      (SELECT COUNT(*)::int FROM enrollments WHERE class_id IN (SELECT id FROM classes WHERE teacher=${teacher})) AS student_count,
      (SELECT COUNT(*)::int FROM assignments WHERE class_id IN (SELECT id FROM classes WHERE teacher=${teacher})) AS assignment_count,
      (SELECT COUNT(*)::int FROM submissions WHERE assignment_id IN (SELECT id FROM assignments WHERE class_id IN (SELECT id FROM classes WHERE teacher=${teacher}))) AS submission_count,
      (SELECT COUNT(*)::int FROM submissions WHERE score IS NOT NULL AND assignment_id IN (SELECT id FROM assignments WHERE class_id IN (SELECT id FROM classes WHERE teacher=${teacher}))) AS graded_count,
      (SELECT COALESCE(AVG(score),0)::numeric(5,2) FROM submissions WHERE score IS NOT NULL AND assignment_id IN (SELECT id FROM assignments WHERE class_id IN (SELECT id FROM classes WHERE teacher=${teacher}))) AS avg_score
  `;

  // Score histogram (5 buckets)
  const histogram = await sql`
    SELECT bucket, COUNT(*)::int AS count FROM (
      SELECT CASE
        WHEN score < 5    THEN '0-5'
        WHEN score < 6.5  THEN '5-6.5'
        WHEN score < 8    THEN '6.5-8'
        WHEN score < 9    THEN '8-9'
        ELSE '9-10'
      END AS bucket
      FROM submissions
      WHERE score IS NOT NULL AND assignment_id IN (SELECT id FROM assignments WHERE class_id IN (SELECT id FROM classes WHERE teacher=${teacher}))
    ) sub
    GROUP BY bucket ORDER BY bucket
  `;

  // Completion rate per class
  const completion = await sql`
    SELECT
      c.id, c.name,
      (SELECT COUNT(*)::int FROM enrollments WHERE class_id=c.id) AS total_students,
      (SELECT COUNT(*)::int FROM assignments WHERE class_id=c.id) AS total_assignments,
      (SELECT COUNT(*)::int FROM submissions WHERE assignment_id IN (SELECT id FROM assignments WHERE class_id=c.id)) AS total_submissions,
      (SELECT COALESCE(AVG(score),0)::numeric(5,2) FROM submissions WHERE score IS NOT NULL AND assignment_id IN (SELECT id FROM assignments WHERE class_id=c.id)) AS avg_score
    FROM classes c WHERE c.teacher=${teacher}
    ORDER BY c.id
  `;

  // Activity 7 days
  const activity = await sql`
    SELECT to_char(DATE(submitted_at), 'YYYY-MM-DD') AS day, COUNT(*)::int AS count
    FROM submissions
    WHERE assignment_id IN (SELECT id FROM assignments WHERE class_id IN (SELECT id FROM classes WHERE teacher=${teacher}))
      AND submitted_at >= NOW() - INTERVAL '7 days'
    GROUP BY day ORDER BY day
  `;

  send(res, 200, {
    summary: summary.rows[0],
    histogram: histogram.rows,
    completion: completion.rows.map(r => ({
      classId: 'class_' + r.id, name: r.name,
      totalStudents: Number(r.total_students),
      totalAssignments: Number(r.total_assignments),
      totalSubmissions: Number(r.total_submissions),
      avgScore: Number(r.avg_score),
    })),
    activity: activity.rows,
  });
};
