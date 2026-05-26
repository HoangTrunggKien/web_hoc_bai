const { sql, send, readJsonBody, methodGuard } = require('../../lib/db.js');
const { requireAuth } = require('../../lib/auth.js');
const { logAudit } = require('../../lib/audit.js');
const m = require('../../lib/mappers.js');

module.exports = async (req, res) => {
  if (!methodGuard(req, res, ['GET', 'POST', 'DELETE'])) return;
  const session = requireAuth(req, res);
  if (!session) return;

  if (req.method === 'GET') {
    const parent = req.query && req.query.parent ? String(req.query.parent).toLowerCase() : null;
    const student = req.query && req.query.student ? String(req.query.student).toLowerCase() : null;

    if (session.role === 'parent') {
      // parent chỉ xem links của mình + thông tin học sinh
      const { rows } = await sql`
        SELECT u.* FROM parent_students ps
        JOIN users u ON u.username = ps.student
        WHERE ps.parent = ${session.sub}
        ORDER BY u.full_name
      `;
      return send(res, 200, rows.map(m.user));
    }

    if (session.role === 'student') {
      const { rows } = await sql`
        SELECT u.* FROM parent_students ps
        JOIN users u ON u.username = ps.parent
        WHERE ps.student = ${session.sub}
        ORDER BY u.full_name
      `;
      return send(res, 200, rows.map(m.user));
    }

    if (!['admin', 'teacher'].includes(session.role)) return send(res, 403, { message: 'Không có quyền' });

    let rows;
    if (parent) {
      ({ rows } = await sql`
        SELECT u.* FROM parent_students ps JOIN users u ON u.username=ps.student WHERE ps.parent=${parent}
      `);
    } else if (student) {
      ({ rows } = await sql`
        SELECT u.* FROM parent_students ps JOIN users u ON u.username=ps.parent WHERE ps.student=${student}
      `);
    } else {
      ({ rows } = await sql`
        SELECT ps.parent, ps.student, ps.created_at FROM parent_students ps ORDER BY ps.created_at DESC
      `);
      return send(res, 200, rows.map(m.parentStudent));
    }
    return send(res, 200, rows.map(m.user));
  }

  // POST: tạo liên kết phụ huynh-học sinh (parent tự link bằng studentCode, hoặc admin link bằng username)
  let body;
  try { body = await readJsonBody(req); } catch { return send(res, 400, { message: 'Body không hợp lệ' }); }

  let parentUsername = body.parentUsername ? String(body.parentUsername).toLowerCase() : session.sub;
  let studentUsername = body.studentUsername ? String(body.studentUsername).toLowerCase() : null;
  const studentCode = body.studentCode ? String(body.studentCode).trim() : null;

  if (session.role === 'parent') parentUsername = session.sub;
  else if (session.role !== 'admin') return send(res, 403, { message: 'Không có quyền' });

  if (!studentUsername && studentCode) {
    const r = await sql`SELECT username FROM users WHERE student_code=${studentCode} AND role='student' LIMIT 1`;
    if (!r.rows[0]) return send(res, 404, { message: 'Không tìm thấy học sinh với mã này' });
    studentUsername = r.rows[0].username;
  }
  if (!studentUsername) return send(res, 400, { message: 'Thiếu thông tin học sinh' });

  await sql`
    INSERT INTO parent_students (parent, student) VALUES (${parentUsername}, ${studentUsername})
    ON CONFLICT DO NOTHING
  `;
  await logAudit('LINK_PARENT_STUDENT', { parent: parentUsername, student: studentUsername }, session.sub);
  return send(res, 201, { ok: true, parentUsername, studentUsername });
};
