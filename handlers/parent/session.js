const { sql, send, readJsonBody, methodGuard } = require('../../lib/db.js');
const { requireAuth } = require('../../lib/auth.js');

module.exports = async (req, res) => {
  if (!methodGuard(req, res, ['GET', 'PUT'])) return;
  const session = requireAuth(req, res, ['parent']);
  if (!session) return;

  if (req.method === 'GET') {
    const { rows } = await sql`
      SELECT u.selected_student_username AS sel,
             c.full_name AS sel_name,
             c.username AS sel_username,
             c.student_code AS sel_code
      FROM users u
      LEFT JOIN users c ON c.username = u.selected_student_username
      WHERE u.username = ${session.sub} LIMIT 1
    `;
    const r = rows[0] || {};
    return send(res, 200, {
      selectedStudentUsername: r.sel || null,
      selectedStudent: r.sel_username ? { username: r.sel_username, fullName: r.sel_name, studentCode: r.sel_code } : null,
    });
  }

  // PUT: cập nhật selected child
  let body;
  try { body = await readJsonBody(req); } catch { return send(res, 400, { message: 'Body không hợp lệ' }); }
  const studentUsername = body.studentUsername != null ? String(body.studentUsername).toLowerCase() : null;

  if (studentUsername) {
    // Verify link exists
    const link = await sql`SELECT 1 FROM parent_students WHERE parent=${session.sub} AND student=${studentUsername} LIMIT 1`;
    if (!link.rows.length) return send(res, 400, { message: 'Học sinh chưa được liên kết với phụ huynh' });
  }
  await sql`UPDATE users SET selected_student_username=${studentUsername} WHERE username=${session.sub}`;
  return send(res, 200, { ok: true, selectedStudentUsername: studentUsername });
};
