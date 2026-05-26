const { sql, send, readJsonBody, methodGuard } = require('../../../lib/db.js');
const { requireAuth } = require('../../../lib/auth.js');
const { logAudit } = require('../../../lib/audit.js');
const m = require('../../../lib/mappers.js');

module.exports = async (req, res) => {
  if (!methodGuard(req, res, ['GET', 'POST'])) return;
  const session = requireAuth(req, res);
  if (!session) return;

  const assignmentId = m.parseId(req.query && req.query.id);
  if (!assignmentId) return send(res, 400, { message: 'assignmentId không hợp lệ' });

  if (req.method === 'GET') {
    // teacher chủ lớp / admin xem all; student chỉ xem của mình
    const owner = await sql`
      SELECT c.teacher FROM assignments a JOIN classes c ON c.id = a.class_id WHERE a.id=${assignmentId} LIMIT 1
    `;
    if (!owner.rows[0]) return send(res, 404, { message: 'Không tìm thấy bài tập' });
    const isOwner = owner.rows[0].teacher === session.sub;

    let rows;
    if (isOwner || session.role === 'admin') {
      ({ rows } = await sql`SELECT * FROM submissions WHERE assignment_id=${assignmentId} ORDER BY submitted_at DESC`);
    } else if (session.role === 'student') {
      ({ rows } = await sql`SELECT * FROM submissions WHERE assignment_id=${assignmentId} AND student=${session.sub}`);
    } else if (session.role === 'parent') {
      // Cho parent xem submission của các con
      ({ rows } = await sql`
        SELECT s.* FROM submissions s
        JOIN parent_students ps ON ps.student = s.student
        WHERE s.assignment_id = ${assignmentId} AND ps.parent = ${session.sub}
      `);
    } else {
      return send(res, 403, { message: 'Không có quyền' });
    }
    return send(res, 200, rows.map(m.submission));
  }

  // POST: học sinh nộp bài (idempotent: replace existing)
  if (session.role !== 'student') return send(res, 403, { message: 'Chỉ học sinh được nộp bài' });
  let body;
  try { body = await readJsonBody(req); } catch { return send(res, 400, { message: 'Body không hợp lệ' }); }

  const answers = JSON.stringify(body.answers || []);
  const submissionFile = body.submissionFile ? JSON.stringify(body.submissionFile) : null;

  // Verify student được enroll vào lớp của assignment
  const enrollCheck = await sql`
    SELECT 1 FROM assignments a
    JOIN enrollments e ON e.class_id = a.class_id
    WHERE a.id=${assignmentId} AND e.student=${session.sub} LIMIT 1
  `;
  if (!enrollCheck.rows.length) return send(res, 403, { message: 'Bạn chưa tham gia lớp này' });

  const { rows } = await sql`
    INSERT INTO submissions (assignment_id, student, answers, submission_file, submitted_at)
    VALUES (${assignmentId}, ${session.sub}, ${answers}::jsonb, ${submissionFile}::jsonb, now())
    ON CONFLICT (assignment_id, student) DO UPDATE SET
      answers = EXCLUDED.answers,
      submission_file = EXCLUDED.submission_file,
      submitted_at = now(),
      score = NULL,
      graded_at = NULL,
      feedback = ''
    RETURNING *
  `;
  await logAudit('SUBMIT_ASSIGNMENT', { assignmentId, student: session.sub }, session.sub);
  return send(res, 201, m.submission(rows[0]));
};
