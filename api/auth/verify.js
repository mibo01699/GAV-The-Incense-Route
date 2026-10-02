// POST /api/auth/verify
// Body: { accessToken }
// Returns: { ok, uid, username, yerBalance, sandbox }
//
// Source of truth for identity: Pi Platform API /v2/me.
// Never trust client-side uid/username.

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      ok: false,
      error: 'METHOD_NOT_ALLOWED',
      message: 'Method not allowed'
    });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({
      ok: false,
      error: 'INVALID_JSON',
      message: 'Invalid JSON body'
    });
  }

  const accessToken =
    body && typeof body.accessToken === 'string' ? body.accessToken.trim() : '';

  if (!accessToken) {
    return res.status(400).json({
      ok: false,
      error: 'MISSING_TOKEN',
      message: 'accessToken مطلوب.'
    });
  }

  if (accessToken.length > 4096) {
    return res.status(400).json({
      ok: false,
      error: 'TOKEN_TOO_LONG',
      message: 'accessToken غير صالح.'
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  let piRes;
  try {
    piRes = await fetch('https://api.minepi.com/v2/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      },
      signal: controller.signal
    });
  } catch (err) {
    clearTimeout(timer);
    if (err && err.name === 'AbortError') {
      return res.status(504).json({
        ok: false,
        error: 'PI_API_TIMEOUT',
        message: 'انتهت مهلة الاتصال بـ Pi API.'
      });
    }
    console.error('[auth/verify] Pi API request failed:', err && err.message);
    return res.status(502).json({
      ok: false,
      error: 'PI_API_UNREACHABLE',
      message: 'تعذّر الاتصال بـ Pi API.'
    });
  }
  clearTimeout(timer);

  if (piRes.status === 401) {
    return res.status(401).json({
      ok: false,
      error: 'INVALID_TOKEN',
      message: 'رمز Pi غير صالح أو منتهي.'
    });
  }

  if (!piRes.ok) {
    console.error('[auth/verify] Pi API returned', piRes.status);
    return res.status(502).json({
      ok: false,
      error: 'PI_API_ERROR',
      message: 'فشل التحقق من Pi.'
    });
  }

  let piData;
  try {
    piData = await piRes.json();
  } catch {
    return res.status(502).json({
      ok: false,
      error: 'PI_API_INVALID_RESPONSE',
      message: 'استجابة Pi غير صالحة.'
    });
  }

  const uid = piData && typeof piData.uid === 'string' ? piData.uid : '';
  const username =
    piData && typeof piData.username === 'string' ? piData.username : '';

  if (!uid) {
    return res.status(502).json({
      ok: false,
      error: 'PI_API_MISSING_UID',
      message: 'استجابة Pi غير مكتملة.'
    });
  }

  // Persistent storage arrives in TASK 07 (Supabase).
  // For now: return verified identity only.
  return res.status(200).json({
    ok: true,
    uid,
    username,
    yerBalance: 0,
    sandbox: true
  });
}