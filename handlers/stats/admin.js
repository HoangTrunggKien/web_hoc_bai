const { sql, send, methodGuard } = require('../../lib/db.js');
const { requireAuth } = require('../../lib/auth.js');

module.exports = async (req, res) => {
  if (!methodGuard(req, res, ['GET'])) return;
  const session = requireAuth(req, res, ['admin']);
  if (!session) return;

  // Counts theo role
  const roleCounts = await sql`
    SELECT role, COUNT(*)::int AS count FROM users GROUP BY role ORDER BY role
  `;

  // System summary
  const summary = await sql`
    SELECT
      (SELECT COUNT(*)::int FROM users) AS user_count,
      (SELECT COUNT(*)::int FROM classes) AS class_count,
      (SELECT COUNT(*)::int FROM enrollments) AS enrollment_count,
      (SELECT COUNT(*)::int FROM assignments) AS assignment_count,
      (SELECT COUNT(*)::int FROM submissions) AS submission_count,
      (SELECT COUNT(*)::int FROM submissions WHERE score IS NOT NULL) AS graded_count,
      (SELECT COALESCE(AVG(score),0)::numeric(5,2) FROM submissions WHERE score IS NOT NULL) AS avg_score
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
      FROM submissions WHERE score IS NOT NULL
    ) sub
    GROUP BY bucket ORDER BY bucket
  `;

  // Login activity 14 days (from audit log)
  const logins = await sql`
    SELECT to_char(DATE(created_at), 'YYYY-MM-DD') AS day, COUNT(*)::int AS count
    FROM audit_log
    WHERE action='LOGIN' AND created_at >= NOW() - INTERVAL '14 days'
    GROUP BY day ORDER BY day
  `;

  // Top actions in last 200 logs
  const topActions = await sql`
    SELECT action, COUNT(*)::int AS count
    FROM audit_log
    WHERE created_at >= NOW() - INTERVAL '30 days'
    GROUP BY action ORDER BY count DESC LIMIT 10
  `;

  send(res, 200, {
    summary: summary.rows[0],
    roleCounts: roleCounts.rows,
    histogram: histogram.rows,
    logins: logins.rows,
    topActions: topActions.rows,
  });
};
