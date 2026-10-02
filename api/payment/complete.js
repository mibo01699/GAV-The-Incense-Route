// POST /api/payment/complete
// Body: { paymentId, txid }
//
// Called from the frontend's onReadyForServerCompletion callback.
// Pi Platform API: POST https://api.minepi.com/v2/payments/{paymentId}/complete
// Authorization: Key <PI_API_KEY>
// Body: { txid }
//
// CRITICAL: Only after this returns HTTP 200 may the app deliver the goods.

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
  const txid =
    body && typeof body.txid === 'string' ? body.txid.trim() : '';

  if (!paymentId) {
    return res.status(400).json({
      ok: false,
      error: 'MISSING_PAYMENT_ID',
      message: 'paymentId مطلوب.'
    });
  }

  if (!txid) {
    return res.status(400).json({
      ok: false,
      error: 'MISSING_TXID',
      message: 'txid مطلوب.'
    });
  }

  if (!/^[A-Fa-f0-9]{64}$/.test(txid)) {
    return res.status(400).json({
      ok: false,
      error: 'INVALID_TXID',
      message: 'txid غير صالح (يجب أن يكون 64 حرفًا hex).'
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
    console.error('[payment/complete] PI_API_KEY not configured');
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
      `https://api.minepi.com/v2/payments/${encodeURIComponent(paymentId)}/complete`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Key ${PI_API_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ txid }),
        signal: controller.signal
      }
    );
  } catch (err) {
    clearTimeout(timer);
    if (err && err.name === 'AbortError') {
      return res.status(504).json({
        ok: false,
        error: 'PI_API_TIMEOUT',
        message: 'انتهت مهلة الإكمال.'
      });
    }
    console.error('[payment/complete] fetch failed:', err && err.message);
    return res.status(502).json({
      ok: false,
      error: 'PI_API_UNREACHABLE',
      message: 'تعذّر الاتصال بـ Pi API.'
    });
  }
  clearTimeout(timer);

  if (!piRes.ok) {
    const text = await piRes.text().catch(() => '');
    console.error('[payment/complete] Pi returned', piRes.status, text);
    return res.status(502).json({
      ok: false,
      error: 'PI_COMPLETION_FAILED',
      message: 'فشل إكمال الدفعة على Pi.'
    });
  }

  let piData = null;
  try {
    piData = await piRes.json();
  } catch {
    // Ignore — Pi returned 200, which is the only thing that matters.
  }

  // TASK 07 will persist this in Supabase (orders, payments, audit_events).
  return res.status(200).json({
    ok: true,
    paymentId,
    txid,
    completed: true,
    piStatus: piData && piData.status ? piData.status : null
  });
}