const { sql, send, methodGuard } = require('../../../lib/db.js');
const { requireAuth } = require('../../../lib/auth.js');
const m = require('../../../lib/mappers.js');

module.exports = async (req, res) => {
  if (!methodGuard(req, res, ['PATCH', 'POST'])) return;
  const session = requireAuth(req, res);
  if (!session) return;

  const id = m.parseId(req.query && req.query.id);
  if (!id) return send(res, 400, { message: 'notificationId không hợp lệ' });

  const { rows } = await sql`
    UPDATE notifications SET is_read = true
    WHERE id = ${id} AND recipient = ${session.sub}
    RETURNING *
  `;
  if (!rows[0]) return send(res, 404, { message: 'Không tìm thấy thông báo' });
  return send(res, 200, m.notification(rows[0]));
};
