const { sql, send, readJsonBody, methodGuard } = require('../../lib/db.js');
const { requireAuth } = require('../../lib/auth.js');
const m = require('../../lib/mappers.js');

module.exports = async (req, res) => {
  if (!methodGuard(req, res, ['GET', 'POST'])) return;
  const session = requireAuth(req, res);
  if (!session) return;

  if (req.method === 'GET') {
    const recipientParam = req.query && req.query.recipient ? String(req.query.recipient).toLowerCase() : null;
    const senderParam = req.query && req.query.sender ? String(req.query.sender).toLowerCase() : null;
    let rows;
    // ?sender=<username> — list notifications mình đã gửi (teacher xem history)
    if (senderParam) {
      if (senderParam !== session.sub && session.role !== 'admin') {
        return send(res, 403, { message: 'Không có quyền xem' });
      }
      ({ rows } = await sql`SELECT * FROM notifications WHERE sender=${senderParam} ORDER BY created_at DESC LIMIT 200`);
    } else if (session.role === 'admin' && recipientParam) {
      ({ rows } = await sql`SELECT * FROM notifications WHERE recipient=${recipientParam} ORDER BY created_at DESC`);
    } else if (session.role === 'admin' && !recipientParam) {
      ({ rows } = await sql`SELECT * FROM notifications ORDER BY created_at DESC LIMIT 200`);
    } else {
      ({ rows } = await sql`SELECT * FROM notifications WHERE recipient=${session.sub} ORDER BY created_at DESC`);
    }
    return send(res, 200, rows.map(m.notification));
  }

  // POST: teacher/admin gửi thông báo
  if (!['teacher', 'admin'].includes(session.role)) {
    return send(res, 403, { message: 'Không có quyền gửi thông báo' });
  }
  let body;
  try { body = await readJsonBody(req); } catch { return send(res, 400, { message: 'Body không hợp lệ' }); }

  const recipient = String(body.recipientUsername || '').toLowerCase();
  const title = String(body.title || '').trim();
  const message = body.message || '';
  const type = body.type || 'general';
  const senderName = body.senderName || null;
  if (!recipient || !title) return send(res, 400, { message: 'Thiếu recipient hoặc title' });

  const { rows } = await sql`
    INSERT INTO notifications (recipient, sender, sender_name, title, message, type)
    VALUES (${recipient}, ${session.sub}, ${senderName}, ${title}, ${message}, ${type})
    RETURNING *
  `;
  return send(res, 201, m.notification(rows[0]));
};
