// GET /api/offers/list
// Header: Authorization: Bearer <pi_access_token>
//
// TASK 06b: temporary in-memory store.

const globalStore =
  globalThis.__GAV_OFFERS__ || (globalThis.__GAV_OFFERS__ = []);

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({
      ok: false,
      error: 'METHOD_NOT_ALLOWED',
      message: 'Method not allowed'
    });
  }

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) {
    return res.status(401).json({
      ok: false,
      error: 'MISSING_TOKEN',
      message: 'accessToken مطلوب.'
    });
  }

  try {
    const meRes = await fetch('https://api.minepi.com/v2/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!meRes.ok) {
      return res.status(401).json({
        ok: false,
        error: 'INVALID_TOKEN',
        message: 'رمز Pi غير صالح.'
      });
    }
  } catch {
    return res.status(502).json({
      ok: false,
      error: 'PI_API_UNREACHABLE',
      message: 'تعذّر الاتصال بـ Pi API.'
    });
  }

  // Return newest first, cap at 50
  const offers = globalStore
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 50);

  return res.status(200).json({
    ok: true,
    offers,
    count: offers.length,
    storage: 'in_memory_temporary'
  });
}