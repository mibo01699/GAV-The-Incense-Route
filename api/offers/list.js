// GET /api/offers/list
// Header: Authorization: Bearer <pi_access_token>
//
// TASK 06: temporary in-memory store for Testnet smoke testing.
// TASK 07 (Supabase) will replace this with a real repository.
// Do NOT rely on this persisting across cold starts.

const globalStore = globalThis.__GAV_OFFERS__ || (globalThis.__GAV_OFFERS__ = []);

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

  return res.status(200).json({
    ok: true,
    offers: globalStore,
    count: globalStore.length,
    storage: 'in_memory_temporary'
  });
}