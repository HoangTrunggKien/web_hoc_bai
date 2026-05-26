const { sql, send, readJsonBody, methodGuard } = require('../../lib/db.js');
const { requireAuth } = require('../../lib/auth.js');
const { logAudit } = require('../../lib/audit.js');
const m = require('../../lib/mappers.js');

module.exports = async (req, res) => {
  if (!methodGuard(req, res, ['GET', 'POST'])) return;
  const session = requireAuth(req, res);
  if (!session) return;

  if (req.method === 'GET') {
    const code = req.query && req.query.code;
    const teacher = req.query && req.query.teacher;
    let rows;
    if (code) {
      ({ rows } = await sql`SELECT * FROM classes WHERE code=${code} LIMIT 1`);
    } else if (teacher) {
      ({ rows } = await sql`SELECT * FROM classes WHERE teacher=${teacher} ORDER BY id`);
    } else {
      ({ rows } = await sql`SELECT * FROM classes ORDER BY id`);
    }
    return send(res, 200, rows.map(m.klass));
  }

  // POST tạo lớp
  if (!['teacher', 'admin'].includes(session.role)) {
    return send(res, 403, { message: 'Chỉ giáo viên/admin được tạo lớp' });
  }
  let body;
  try { body = await readJsonBody(req); } catch { return send(res, 400, { message: 'Body không hợp lệ' }); }

  const name = String(body.name || '').trim();
  const code = String(body.code || '').trim();
  const teacher = String(body.teacher || session.sub).trim();
  if (!name || !code) return send(res, 400, { message: 'Thiếu tên hoặc mã lớp' });

  const dup = await sql`SELECT 1 FROM classes WHERE code=${code} LIMIT 1`;
  if (dup.rows.length) return send(res, 409, { message: 'Mã lớp đã tồn tại' });

  const { rows } = await sql`
    INSERT INTO classes (name, code, teacher)
    VALUES (${name}, ${code}, ${teacher})
    RETURNING *
  `;
  await logAudit('CREATE_CLASS', { classId: rows[0].id, name }, session.sub);
  return send(res, 201, m.klass(rows[0]));
};
