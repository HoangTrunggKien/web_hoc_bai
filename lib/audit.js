const { sql } = require('./db.js');

async function logAudit(action, details, userId) {
  try {
    await sql`
      INSERT INTO audit_log (action, details, user_id)
      VALUES (${action}, ${JSON.stringify(details || {})}::jsonb, ${userId || 'anonymous'})
    `;
  } catch (err) {
    console.error('audit log failed:', err.message);
  }
}

module.exports = { logAudit };
