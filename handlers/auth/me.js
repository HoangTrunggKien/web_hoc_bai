const { sql, send, methodGuard } = require('../../lib/db.js');
const { requireAuth } = require('../../lib/auth.js');

module.exports = async (req, res) => {
  if (!methodGuard(req, res, ['GET'])) return;
  const session = requireAuth(req, res);
  if (!session) return;

  const { rows } = await sql`SELECT * FROM users WHERE username = ${session.sub} LIMIT 1`;
  const row = rows[0];
  if (!row) return send(res, 401, { message: 'User không tồn tại' });

  return send(res, 200, {
    username: row.username,
    fullName: row.full_name,
    role: row.role,
    contact: row.contact,
    phone: row.phone,
    studentCode: row.student_code,
    selectedStudentUsername: row.selected_student_username,
  });
};
