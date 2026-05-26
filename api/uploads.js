const { put } = require('@vercel/blob');
const { send, methodGuard } = require('../lib/db.js');
const { requireAuth } = require('../lib/auth.js');

async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;
  const session = requireAuth(req, res);
  if (!session) return;

  const filename = (req.query && (req.query.name || req.query.filename)) || `upload-${Date.now()}`;
  const contentType = req.headers['content-type'] || 'application/octet-stream';

  try {
    const blob = await put(filename, req, {
      access: 'public',
      addRandomSuffix: true,
      contentType,
    });
    const size = Number(req.headers['content-length'] || 0);
    return send(res, 201, {
      url: blob.url,
      pathname: blob.pathname,
      name: filename,
      size,
      type: contentType,
    });
  } catch (err) {
    console.error('upload failed:', err);
    return send(res, 500, { message: 'Tải lên thất bại' });
  }
}

module.exports = handler;
// Tắt body parser để stream raw vào Blob
module.exports.config = { api: { bodyParser: false } };
