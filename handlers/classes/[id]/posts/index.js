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
    const { rows } = await sql`SELECT * FROM class_posts WHERE class_id=${classId} ORDER BY created_at DESC`;
    return send(res, 200, rows.map(m.classPost));
  }

  if (!['teacher', 'admin'].includes(session.role)) {
    return send(res, 403, { message: 'Chỉ giáo viên/admin được đăng bài' });
  }
  let body;
  try { body = await readJsonBody(req); } catch { return send(res, 400, { message: 'Body không hợp lệ' }); }
  const title = String(body.title || '').trim();
  if (!title) return send(res, 400, { message: 'Thiếu tiêu đề' });
  const description = body.description || null;
  const files = JSON.stringify(body.files || []);

  const { rows } = await sql`
    INSERT INTO class_posts (class_id, title, description, files, created_by)
    VALUES (${classId}, ${title}, ${description}, ${files}::jsonb, ${session.sub})
    RETURNING *
  `;
  await logAudit('CREATE_CLASS_POST', { postId: rows[0].id, classId }, session.sub);
  return send(res, 201, m.classPost(rows[0]));
};
