const { sql, send, methodGuard } = require('../../lib/db.js');
const { requireAuth } = require('../../lib/auth.js');
const m = require('../../lib/mappers.js');

module.exports = async (req, res) => {
  if (!methodGuard(req, res, ['GET'])) return;
  const session = requireAuth(req, res, ['admin']);
  if (!session) return;

  const limit = Math.min(Number((req.query && req.query.limit) || 100), 500);
  const { rows } = await sql`
    SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ${limit}
  `;
  return send(res, 200, rows.map(m.auditLog));
};
