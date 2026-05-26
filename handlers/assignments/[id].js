const { sql, send, readJsonBody, methodGuard } = require('../../lib/db.js');
const { requireAuth } = require('../../lib/auth.js');
const { logAudit } = require('../../lib/audit.js');
const m = require('../../lib/mappers.js');

module.exports = async (req, res) => {
  if (!methodGuard(req, res, ['GET', 'PATCH', 'DELETE'])) return;
  const session = requireAuth(req, res);
  if (!session) return;

  const id = m.parseId(req.query && req.query.id);
  if (!id) return send(res, 400, { message: 'assignmentId không hợp lệ' });

  if (req.method === 'GET') {
    const { rows } = await sql`SELECT * FROM assignments WHERE id=${id} LIMIT 1`;
    if (!rows[0]) return send(res, 404, { message: 'Không tìm thấy' });
    return send(res, 200, m.assignment(rows[0]));
  }

  // PATCH/DELETE: chỉ teacher chủ lớp / admin
  const owner = await sql`
    SELECT c.teacher FROM assignments a JOIN classes c ON c.id = a.class_id WHERE a.id=${id} LIMIT 1
  `;
  if (!owner.rows[0]) return send(res, 404, { message: 'Không tìm thấy' });
  const isOwner = owner.rows[0].teacher === session.sub;
  if (!isOwner && session.role !== 'admin') return send(res, 403, { message: 'Không có quyền' });

  if (req.method === 'PATCH') {
    let body;
    try { body = await readJsonBody(req); } catch { return send(res, 400, { message: 'Body không hợp lệ' }); }
    const title = body.title != null ? String(body.title).trim() : null;
    const description = body.description != null ? String(body.description) : null;
    const type = body.type != null ? String(body.type) : null;
    const dueAt = body.dueAt ? new Date(body.dueAt).toISOString() : null;
    const questions = body.questions != null ? JSON.stringify(body.questions) : null;
    const attachments = body.attachments != null ? JSON.stringify(body.attachments) : null;
    const assignmentUrl = body.assignmentUrl != null ? String(body.assignmentUrl) : null;

    const { rows } = await sql`
      UPDATE assignments SET
        title          = COALESCE(${title}, title),
        description    = COALESCE(${description}, description),
        type           = COALESCE(${type}, type),
        due_at         = COALESCE(${dueAt}::timestamptz, due_at),
        questions      = COALESCE(${questions}::jsonb, questions),
        attachments    = COALESCE(${attachments}::jsonb, attachments),
        assignment_url = COALESCE(${assignmentUrl}, assignment_url)
      WHERE id = ${id}
      RETURNING *
    `;
    await logAudit('UPDATE_ASSIGNMENT', { assignmentId: id }, session.sub);
    return send(res, 200, m.assignment(rows[0]));
  }

  if (req.method === 'DELETE') {
    await sql`DELETE FROM assignments WHERE id=${id}`;
    await logAudit('DELETE_ASSIGNMENT', { assignmentId: id }, session.sub);
    return send(res, 200, { ok: true });
  }
};
