const { sql, send, readJsonBody, methodGuard } = require('../../lib/db.js');
const { requireAuth } = require('../../lib/auth.js');
const { logAudit } = require('../../lib/audit.js');
const m = require('../../lib/mappers.js');

module.exports = async (req, res) => {
  if (!methodGuard(req, res, ['GET', 'PATCH', 'DELETE'])) return;
  const session = requireAuth(req, res);
  if (!session) return;

  const id = m.parseId(req.query && req.query.id);
  if (!id) return send(res, 400, { message: 'postId không hợp lệ' });

  if (req.method === 'GET') {
    const { rows } = await sql`SELECT * FROM class_posts WHERE id=${id} LIMIT 1`;
    if (!rows[0]) return send(res, 404, { message: 'Không tìm thấy' });
    return send(res, 200, m.classPost(rows[0]));
  }

  // Quyền: teacher chủ lớp / admin
  const ctx = await sql`
    SELECT cp.*, c.teacher AS class_teacher
    FROM class_posts cp JOIN classes c ON c.id = cp.class_id
    WHERE cp.id=${id} LIMIT 1
  `;
  if (!ctx.rows[0]) return send(res, 404, { message: 'Không tìm thấy' });
  const isOwner = ctx.rows[0].class_teacher === session.sub;
  if (!isOwner && session.role !== 'admin') return send(res, 403, { message: 'Không có quyền' });

  if (req.method === 'PATCH') {
    let body;
    try { body = await readJsonBody(req); } catch { return send(res, 400, { message: 'Body không hợp lệ' }); }
    const title = body.title != null ? String(body.title).trim() : null;
    const description = body.description != null ? String(body.description) : null;
    const files = body.files != null ? JSON.stringify(body.files) : null;

    const { rows } = await sql`
      UPDATE class_posts SET
        title = COALESCE(${title}, title),
        description = COALESCE(${description}, description),
        files = COALESCE(${files}::jsonb, files),
        updated_at = now()
      WHERE id = ${id}
      RETURNING *
    `;
    await logAudit('UPDATE_CLASS_POST', { postId: id }, session.sub);
    return send(res, 200, m.classPost(rows[0]));
  }

  if (req.method === 'DELETE') {
    await sql`DELETE FROM class_posts WHERE id=${id}`;
    await logAudit('DELETE_CLASS_POST', { postId: id }, session.sub);
    return send(res, 200, { ok: true });
  }
};
