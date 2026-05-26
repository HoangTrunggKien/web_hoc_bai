const { sql, send, readJsonBody, methodGuard } = require('../../lib/db.js');
const { requireAuth } = require('../../lib/auth.js');
const { logAudit } = require('../../lib/audit.js');
const m = require('../../lib/mappers.js');

module.exports = async (req, res) => {
  if (!methodGuard(req, res, ['GET', 'POST'])) return;
  const session = requireAuth(req, res);
  if (!session) return;

  if (req.method === 'GET') {
    const classId = m.parseId(req.query && req.query.classId);
    let rows;
    if (classId) {
      ({ rows } = await sql`SELECT * FROM assignments WHERE class_id=${classId} ORDER BY id DESC`);
    } else {
      ({ rows } = await sql`SELECT * FROM assignments ORDER BY id DESC`);
    }
    return send(res, 200, rows.map(m.assignment));
  }

  // POST
  if (!['teacher', 'admin'].includes(session.role)) {
    return send(res, 403, { message: 'Chỉ giáo viên/admin được giao bài' });
  }
  let body;
  try { body = await readJsonBody(req); } catch { return send(res, 400, { message: 'Body không hợp lệ' }); }

  const classId = m.parseId(body.classId);
  if (!classId) return send(res, 400, { message: 'classId không hợp lệ' });

  const title = String(body.title || '').trim();
  if (!title) return send(res, 400, { message: 'Thiếu tiêu đề' });
  const description = body.description || null;
  const type = body.type || null;
  const dueAt = body.dueAt ? new Date(body.dueAt).toISOString() : null;
  const questions = JSON.stringify(body.questions || []);
  const attachments = JSON.stringify(body.attachments || body.resources || []);
  const assignmentUrl = body.assignmentUrl || null;

  const { rows } = await sql`
    INSERT INTO assignments (class_id, title, description, type, due_at, questions, attachments, assignment_url)
    VALUES (${classId}, ${title}, ${description}, ${type}, ${dueAt}, ${questions}::jsonb, ${attachments}::jsonb, ${assignmentUrl})
    RETURNING *
  `;
  await logAudit('CREATE_ASSIGNMENT', { assignmentId: rows[0].id, classId }, session.sub);
  return send(res, 201, m.assignment(rows[0]));
};
