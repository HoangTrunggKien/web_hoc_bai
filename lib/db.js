// Postgres client — dùng `pg` driver để kết nối Supabase / bất kỳ Postgres nào.
// Wrapper `sql\`...\`` giữ nguyên syntax như @vercel/postgres (tagged template + sql.query()).

// Ensure `.env.local` được load khi chạy local (vercel dev / node script).
// Vercel production sẽ tự inject env, dotenv chỉ no-op vì file không tồn tại.
if (!process.env.POSTGRES_URL && !process.env.POSTGRES_URL_NON_POOLING) {
  try { require('dotenv').config({ path: require('path').join(process.cwd(), '.env.local') }); } catch (_) {}
}

const { Pool } = require('pg');

// Ưu tiên POSTGRES_URL_NON_POOLING cho serverless (kết nối trực tiếp, ít vấn đề với
// prepared statements và DDL). Fallback POSTGRES_URL nếu không có.
const connectionString =
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('[lib/db] No POSTGRES_URL_NON_POOLING/POSTGRES_URL env set');
}

// Reuse Pool across function invocations (Vercel keeps lambda warm short window)
let _pool = global._pgPool;
if (!_pool) {
  // Strip sslmode/* khỏi connection string vì pg version mới override ssl config
  // dựa trên URL params (verify-full) — bỏ qua URL flags, dùng explicit ssl object.
  const cleanedConnString = connectionString
    ? connectionString.replace(/[?&](sslmode|supa|pgbouncer|uselibpqcompat)=[^&]*/g, (m, p1, off, str) => {
        return str[off] === '?' && off + m.length < str.length ? '?' : '';
      })
    : connectionString;
  _pool = new Pool({
    connectionString: cleanedConnString,
    ssl: connectionString ? { rejectUnauthorized: false } : undefined,
    max: 5,
    idleTimeoutMillis: 30_000,
  });
  global._pgPool = _pool;
}

// Tagged-template wrapper:
//   await sql`SELECT * FROM users WHERE username = ${name}`
// → pool.query('SELECT * FROM users WHERE username = $1', [name])
function sql(strings, ...values) {
  if (!Array.isArray(strings)) {
    throw new Error('sql() must be used as a tagged template literal. Use sql.query() for plain text.');
  }
  let text = strings[0];
  for (let i = 0; i < values.length; i++) {
    text += '$' + (i + 1) + strings[i + 1];
  }
  return _pool.query(text, values);
}

// Plain-text query: sql.query('CREATE TABLE ...') hoặc sql.query('SELECT ...', [params])
sql.query = (text, params) => _pool.query(text, params);

function send(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(payload));
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; if (data.length > 5_000_000) reject(new Error('Body too large')); });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function methodGuard(req, res, allowed) {
  const method = (req.method || 'GET').toUpperCase();
  if (!allowed.includes(method)) {
    res.setHeader('Allow', allowed.join(', '));
    send(res, 405, { message: 'Method not allowed' });
    return false;
  }
  return true;
}

module.exports = { sql, send, readJsonBody, methodGuard };
