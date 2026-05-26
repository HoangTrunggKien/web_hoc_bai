const { sql, send, readJsonBody, methodGuard } = require('../../lib/db.js');
const { requireAuth } = require('../../lib/auth.js');
const { logAudit } = require('../../lib/audit.js');
const m = require('../../lib/mappers.js');

module.exports = async (req, res) => {
  if (!methodGuard(req, res, ['GET', 'PATCH', 'DELETE'])) return;
  const session = requireAuth(req, res);
  if (!session) return;

  const id = m.parseId(req.query && req.query.id);
  if (!id) return send(res, 400, { message: 'lessonId không hợp lệ' });

  if (req.method === 'GET') {
    const { rows } = await sql`SELECT * FROM lessons WHERE id=${id} LIMIT 1`;
    if (!rows[0]) return send(res, 404, { message: 'Không tìm thấy' });
    return send(res, 200, m.lesson(rows[0]));
  }

  if (!['teacher', 'admin'].includes(session.role)) {
    return send(res, 403, { message: 'Không có quyền' });
  }

  if (req.method === 'PATCH') {
    let body;
    try { body = await readJsonBody(req); } catch { return send(res, 400, { message: 'Body không hợp lệ' }); }
    const title = body.title != null ? String(body.title).trim() : null;
    const chapter = body.chapter != null ? Number(body.chapter) : null;
    const description = body.description != null ? String(body.description) : null;
    const content = body.content != null ? String(body.content) : null;
    const resources = body.resources != null ? JSON.stringify(body.resources) : null;
    const duration = body.duration != null ? Number(body.duration) : null;
    const lessonUrl = body.lessonUrl != null ? String(body.lessonUrl) : null;
    const classId = body.classId != null ? m.parseId(body.classId) : null;

    const { rows } = await sql`
      UPDATE lessons SET
        title       = COALESCE(${title}, title),
        chapter     = COALESCE(${chapter}, chapter),
        description = COALESCE(${description}, description),
        content     = COALESCE(${content}, content),
        resources   = COALESCE(${resources}::jsonb, resources),
        duration    = COALESCE(${duration}, duration),
        lesson_url  = COALESCE(${lessonUrl}, lesson_url),
        class_id    = COALESCE(${classId}, class_id),
        updated_at  = now()
      WHERE id = ${id}
      RETURNING *
    `;
    if (!rows[0]) return send(res, 404, { message: 'Không tìm thấy' });
    await logAudit('UPDATE_LESSON', { lessonId: id }, session.sub);
    return send(res, 200, m.lesson(rows[0]));
  }

  if (req.method === 'DELETE') {
    const { rowCount } = await sql`DELETE FROM lessons WHERE id=${id}`;
    if (!rowCount) return send(res, 404, { message: 'Không tìm thấy' });
    await logAudit('DELETE_LESSON', { lessonId: id }, session.sub);
    return send(res, 200, { ok: true });
  }
};
