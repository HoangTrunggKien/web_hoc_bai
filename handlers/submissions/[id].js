const { sql, send, readJsonBody, methodGuard } = require('../../lib/db.js');
const { requireAuth } = require('../../lib/auth.js');
const { logAudit } = require('../../lib/audit.js');
const m = require('../../lib/mappers.js');

module.exports = async (req, res) => {
  if (!methodGuard(req, res, ['GET', 'PATCH'])) return;
  const session = requireAuth(req, res);
  if (!session) return;

  const id = m.parseId(req.query && req.query.id);
  if (!id) return send(res, 400, { message: 'submissionId không hợp lệ' });

  // Get submission + class info để check quyền
  const ctx = await sql`
    SELECT s.*, c.teacher AS class_teacher
    FROM submissions s
    JOIN assignments a ON a.id = s.assignment_id
    JOIN classes c ON c.id = a.class_id
    WHERE s.id = ${id}
    LIMIT 1
  `;
  if (!ctx.rows[0]) return send(res, 404, { message: 'Không tìm thấy bài nộp' });
  const row = ctx.rows[0];
  const isOwner = row.class_teacher === session.sub;
  const isStudent = row.student === session.sub;

  if (req.method === 'GET') {
    if (!isOwner && session.role !== 'admin' && !isStudent) {
      // parent của student được xem
      if (session.role === 'parent') {
        const link = await sql`SELECT 1 FROM parent_students WHERE parent=${session.sub} AND student=${row.student} LIMIT 1`;
        if (!link.rows.length) return send(res, 403, { message: 'Không có quyền' });
      } else {
        return send(res, 403, { message: 'Không có quyền' });
      }
    }
    return send(res, 200, m.submission(row));
  }

  // PATCH: chấm điểm
  if (!isOwner && session.role !== 'admin') return send(res, 403, { message: 'Chỉ giáo viên chủ lớp được chấm' });

  let body;
  try { body = await readJsonBody(req); } catch { return send(res, 400, { message: 'Body không hợp lệ' }); }
  const score = body.score == null ? null : Number(body.score);
  const feedback = body.feedback != null ? String(body.feedback) : null;
  if (score != null && (Number.isNaN(score) || score < 0 || score > 100)) {
    return send(res, 400, { message: 'Điểm không hợp lệ' });
  }

  const { rows } = await sql`
    UPDATE submissions SET
      score    = ${score},
      feedback = COALESCE(${feedback}, feedback),
      graded_at = CASE WHEN ${score}::numeric IS NULL THEN NULL ELSE now() END
    WHERE id = ${id}
    RETURNING *
  `;
  await logAudit('GRADE_SUBMISSION', { submissionId: id, score }, session.sub);
  return send(res, 200, m.submission(rows[0]));
};
