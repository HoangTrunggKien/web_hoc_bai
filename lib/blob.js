const { put, del } = require('@vercel/blob');

async function uploadStream(name, stream, contentType) {
  return put(name, stream, {
    access: 'public',
    addRandomSuffix: true,
    contentType: contentType || 'application/octet-stream',
  });
}

async function deleteByUrl(url) {
  if (!url) return;
  try { await del(url); } catch { /* ignore */ }
}

module.exports = { uploadStream, deleteByUrl };
