const jwt = require('jsonwebtoken');
const { send } = require('./db.js');

const COOKIE_NAME = 'gc_session';
const SECRET = process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me';
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function signJwt(user) {
  return jwt.sign({ sub: user.username, role: user.role }, SECRET, { expiresIn: '7d' });
}

function verifyJwt(token) {
  return jwt.verify(token, SECRET);
}

function isProd() {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
}

function setAuthCookie(res, token) {
  const flags = ['HttpOnly', 'Path=/', 'SameSite=Lax', `Max-Age=${MAX_AGE_SECONDS}`];
  if (isProd()) flags.push('Secure');
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; ${flags.join('; ')}`);
}

function clearAuthCookie(res) {
  const flags = ['HttpOnly', 'Path=/', 'SameSite=Lax', 'Max-Age=0'];
  if (isProd()) flags.push('Secure');
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; ${flags.join('; ')}`);
}

function parseCookies(req) {
  const header = req.headers && req.headers.cookie;
  if (!header) return {};
  return header.split(';').reduce((acc, part) => {
    const [k, ...v] = part.trim().split('=');
    if (!k) return acc;
    acc[k] = decodeURIComponent(v.join('='));
    return acc;
  }, {});
}

function getSession(req) {
  const token = parseCookies(req)[COOKIE_NAME];
  if (!token) return null;
  try { return verifyJwt(token); } catch { return null; }
}

function requireAuth(req, res, allowedRoles) {
  const session = getSession(req);
  if (!session) { send(res, 401, { message: 'Chưa đăng nhập' }); return null; }
  if (allowedRoles && allowedRoles.length && !allowedRoles.includes(session.role)) {
    send(res, 403, { message: 'Không có quyền truy cập' });
    return null;
  }
  return session;
}

module.exports = {
  COOKIE_NAME,
  signJwt,
  verifyJwt,
  setAuthCookie,
  clearAuthCookie,
  parseCookies,
  getSession,
  requireAuth,
};
