const { sql, send, readJsonBody, methodGuard } = require('../../../../lib/db.js');
const { requireAuth } = require('../../../../lib/auth.js');
const { logAudit } = require('../../../../lib/audit.js');
const m = require('../../../../lib/mappers.js');

module.exports = async (req, res) => {
  if (!methodGuard(req, res, ['GET', 'POST'])) return;
  const session = requireAuth(req, res);
  if (!session) return;

  const classId = m.parseId(req.query && req.query.id);
  if (!classId) return send(res, 400, { message: 'classId không hợp lệ' });

  if (req.method === 'GET') {
    // Trả về DS học sinh trong lớp (kèm thông tin user)
    const { rows } = await sql`
      SELECT u.*, e.id AS enrollment_id, e.enrolled_at
      FROM enrollments e
      JOIN users u ON u.username = e.student
      WHERE e.class_id = ${classId}
      ORDER BY u.full_name
    `;
    return send(res, 200, rows.map(r => ({
      ...m.user(r),
      enrollmentId: 'enr_' + r.enrollment_id,
      enrolledAt: r.enrolled_at ? new Date(r.enrolled_at).getTime() : null,
    })));
  }

  // POST: enroll một student
  let body;
  try { body = await readJsonBody(req); } catch { return send(res, 400, { message: 'Body không hợp lệ' }); }
  const student = String(body.studentUsername || '').trim().toLowerCase();
  if (!student) return send(res, 400, { message: 'Thiếu studentUsername' });

  // Authorization: student tự enroll bản thân, hoặc teacher/admin enroll bất kỳ
  if (student !== session.sub && !['teacher', 'admin'].includes(session.role)) {
    return send(res, 403, { message: 'Không có quyền' });
  }

  const userRow = await sql`SELECT role FROM users WHERE username=${student} LIMIT 1`;
  if (!userRow.rows[0] || userRow.rows[0].role !== 'student') {
    return send(res, 400, { message: 'Tài khoản không phải học sinh' });
  }

  const dup = await sql`SELECT 1 FROM enrollments WHERE class_id=${classId} AND student=${student} LIMIT 1`;
  if (dup.rows.length) return send(res, 409, { message: 'Học sinh đã tham gia lớp này' });

  const { rows } = await sql`
    INSERT INTO enrollments (class_id, student) VALUES (${classId}, ${student}) RETURNING *
  `;
  await logAudit('ENROLL_STUDENT', { classId, student }, session.sub);
  return send(res, 201, m.enrollment(rows[0]));
};
