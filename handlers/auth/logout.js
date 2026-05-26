const { send, methodGuard } = require('../../lib/db.js');
const { clearAuthCookie, getSession } = require('../../lib/auth.js');
const { logAudit } = require('../../lib/audit.js');

module.exports = async (req, res) => {
  if (!methodGuard(req, res, ['POST'])) return;
  const session = getSession(req);
  clearAuthCookie(res);
  if (session) await logAudit('LOGOUT', {}, session.sub);
  return send(res, 200, { ok: true });
};
