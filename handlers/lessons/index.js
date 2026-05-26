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
    const chapter = req.query && req.query.chapter ? Number(req.query.chapter) : null;
    let rows;
    if (classId && chapter) {
      ({ rows } = await sql`SELECT * FROM lessons WHERE class_id=${classId} AND chapter=${chapter} ORDER BY chapter, id`);
    } else if (classId) {
      ({ rows } = await sql`SELECT * FROM lessons WHERE class_id=${classId} ORDER BY chapter, id`);
    } else if (chapter) {
      ({ rows } = await sql`SELECT * FROM lessons WHERE chapter=${chapter} ORDER BY chapter, id`);
    } else {
      ({ rows } = await sql`SELECT * FROM lessons ORDER BY chapter, id`);
    }
    return send(res, 200, rows.map(m.lesson));
  }

  // POST
  if (!['teacher', 'admin'].includes(session.role)) {
    return send(res, 403, { message: 'Chỉ giáo viên/admin được tạo bài giảng' });
  }
  let body;
  try { body = await readJsonBody(req); } catch { return send(res, 400, { message: 'Body không hợp lệ' }); }

  const title = String(body.title || '').trim();
  if (!title) return send(res, 400, { message: 'Thiếu tiêu đề' });
  const chapter = body.chapter != null ? Number(body.chapter) : null;
  const description = body.description || null;
  const content = body.content || null;
  const resources = JSON.stringify(body.resources || []);
  const duration = body.duration != null ? Number(body.duration) : null;
  const lessonUrl = body.lessonUrl || null;
  const classId = m.parseId(body.classId);

  const { rows } = await sql`
    INSERT INTO lessons (class_id, title, chapter, description, content, resources, duration, lesson_url)
    VALUES (${classId}, ${title}, ${chapter}, ${description}, ${content}, ${resources}::jsonb, ${duration}, ${lessonUrl})
    RETURNING *
  `;
  await logAudit('CREATE_LESSON', { lessonId: rows[0].id, title }, session.sub);
  return send(res, 201, m.lesson(rows[0]));
};
