// POST /api/payment/approve
// Body: { paymentId }
//
// Called from the frontend's onReadyForServerApproval callback.
// Pi Platform API: POST https://api.minepi.com/v2/payments/{paymentId}/approve
// Authorization: Key <PI_API_KEY>
//
// The user CANNOT interact with the payment dialog until this succeeds.

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

  const paymentId =
    body && typeof body.paymentId === 'string' ? body.paymentId.trim() : '';

  if (!paymentId) {
    return res.status(400).json({
      ok: false,
      error: 'MISSING_PAYMENT_ID',
      message: 'paymentId مطلوب.'
    });
  }

  if (paymentId.length > 128 || !/^[A-Za-z0-9_-]+$/.test(paymentId)) {
    return res.status(400).json({
      ok: false,
      error: 'INVALID_PAYMENT_ID',
      message: 'paymentId غير صالح.'
    });
  }

  const PI_API_KEY = process.env.PI_API_KEY;
  if (!PI_API_KEY) {
    console.error('[payment/approve] PI_API_KEY not configured');
    return res.status(500).json({
      ok: false,
      error: 'SERVER_MISCONFIGURED',
      message: 'الخادم غير مهيأ.'
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  let piRes;
  try {
    piRes = await fetch(
      `https://api.minepi.com/v2/payments/${encodeURIComponent(paymentId)}/approve`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Key ${PI_API_KEY}`,
          'Accept': 'application/json'
        },
        signal: controller.signal
      }
    );
  } catch (err) {
    clearTimeout(timer);
    if (err && err.name === 'AbortError') {
      return res.status(504).json({
        ok: false,
        error: 'PI_API_TIMEOUT',
        message: 'انتهت مهلة الموافقة.'
      });
    }
    console.error('[payment/approve] fetch failed:', err && err.message);
    return res.status(502).json({
      ok: false,
      error: 'PI_API_UNREACHABLE',
      message: 'تعذّر الاتصال بـ Pi API.'
    });
  }
  clearTimeout(timer);

  if (!piRes.ok) {
    const text = await piRes.text().catch(() => '');
    console.error('[payment/approve] Pi returned', piRes.status, text);
    return res.status(502).json({
      ok: false,
      error: 'PI_APPROVAL_FAILED',
      message: 'فشلت الموافقة على الدفعة.'
    });
  }

  return res.status(200).json({
    ok: true,
    paymentId,
    approved: true
  });
}