// POST /api/payment/incomplete
// Body: { paymentId, accessToken }
//
// Called from the frontend's onIncompletePaymentFound callback.
// Flow:
//   1. Verify Pi identity via /v2/me
//   2. Fetch payment status via Pi Platform API (server key)
//   3. Verify ownership (payment.user_uid === verified.uid)
//   4. Resolve: complete if ready, cancel if cancelled, mark pending otherwise
//   5. Idempotent: same paymentId processed only once per process lifetime
//
// NOTE: in-memory idempotency guard is temporary.
//       Replaced by persistent storage in TASK 07 (Supabase).

const processedPayments = new Map(); // paymentId -> { action, at }

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
  const accessToken =
    body && typeof body.accessToken === 'string' ? body.accessToken.trim() : '';

  if (!paymentId) {
    return res.status(400).json({
      ok: false,
      error: 'MISSING_PAYMENT_ID',
      message: 'paymentId مطلوب.'
    });
  }

  if (!accessToken) {
    return res.status(400).json({
      ok: false,
      error: 'MISSING_TOKEN',
      message: 'accessToken مطلوب.'
    });
  }

  const PI_API_KEY = process.env.PI_API_KEY;
  if (!PI_API_KEY) {
    console.error('[payment/incomplete] PI_API_KEY not configured');
    return res.status(500).json({
      ok: false,
      error: 'SERVER_MISCONFIGURED',
      message: 'الخادم غير مهيأ.'
    });
  }

  // Idempotency: return previous result if already resolved
  const cached = processedPayments.get(paymentId);
  if (cached) {
    return res.status(200).json({
      ok: true,
      paymentId,
      action: cached.action,
      idempotent: true
    });
  }

  // 1) Verify user identity via Pi Platform API
  let uid;
  try {
    const meRes = await fetch('https://api.minepi.com/v2/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (meRes.status === 401) {
      return res.status(401).json({
        ok: false,
        error: 'INVALID_TOKEN',
        message: 'رمز Pi غير صالح.'
      });
    }

    if (!meRes.ok) {
      return res.status(502).json({
        ok: false,
        error: 'PI_API_ERROR',
        message: 'فشل التحقق من الهوية.'
      });
    }

    const me = await meRes.json();
    uid = me && typeof me.uid === 'string' ? me.uid : '';

    if (!uid) {
      return res.status(502).json({
        ok: false,
        error: 'PI_API_MISSING_UID',
        message: 'استجابة Pi غير مكتملة.'
      });
    }
  } catch (err) {
    console.error('[payment/incomplete] /v2/me failed:', err && err.message);
    return res.status(502).json({
      ok: false,
      error: 'PI_API_UNREACHABLE',
      message: 'تعذّر الاتصال بـ Pi API.'
    });
  }

  // 2) Fetch payment from Pi Platform API
  let payment;
  try {
    const payRes = await fetch(
      `https://api.minepi.com/v2/payments/${encodeURIComponent(paymentId)}`,
      {
        headers: {
          'Authorization': `Key ${PI_API_KEY}`,
          'Accept': 'application/json'
        }
      }
    );

    if (payRes.status === 404) {
      return res.status(404).json({
        ok: false,
        error: 'PAYMENT_NOT_FOUND',
        message: 'الدفعة غير موجودة.'
      });
    }

    if (!payRes.ok) {
      console.error('[payment/incomplete] Pi payments GET:', payRes.status);
      return res.status(502).json({
        ok: false,
        error: 'PI_API_ERROR',
        message: 'فشل جلب حالة الدفعة.'
      });
    }

    payment = await payRes.json();
  } catch (err) {
    console.error('[payment/incomplete] fetch failed:', err && err.message);
    return res.status(502).json({
      ok: false,
      error: 'PI_API_UNREACHABLE',
      message: 'تعذّر الاتصال بـ Pi API.'
    });
  }

  // 3) Ownership check
  const paymentUid =
    payment && payment.user_uid ? String(payment.user_uid) : '';

  if (paymentUid && paymentUid !== uid) {
    return res.status(403).json({
      ok: false,
      error: 'PAYMENT_NOT_OWNED',
      message: 'هذه الدفعة لا تنتمي إلى هذا المستخدم.'
    });
  }

  // 4) Determine action from Pi status flags
  const status = (payment && payment.status) || {};
  const isCancelled = !!status.cancelled;
  const isUserCancelled = !!status.user_cancelled;
  const isApproved = !!status.developer_approved;
  const isCompleted = !!status.developer_completed;
  const isVerified = !!status.transaction_verified;
  const txid =
    payment && payment.transaction && payment.transaction.txid
      ? String(payment.transaction.txid)
      : null;

  let action;

  if (isCancelled || isUserCancelled) {
    action = 'cancelled';
  } else if (isCompleted && isVerified) {
    action = 'already_completed';
  } else if (isApproved && isVerified && txid) {
    // Ready to complete
    try {
      const completeRes = await fetch(
        `https://api.minepi.com/v2/payments/${encodeURIComponent(paymentId)}/complete`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Key ${PI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ txid })
        }
      );

      if (!completeRes.ok) {
        console.error('[payment/incomplete] complete:', completeRes.status);
        return res.status(502).json({
          ok: false,
          error: 'COMPLETION_FAILED',
          message: 'فشل إكمال الدفعة.'
        });
      }

      action = 'completed';
    } catch (err) {
      console.error('[payment/incomplete] complete fetch:', err && err.message);
      return res.status(502).json({
        ok: false,
        error: 'PI_API_UNREACHABLE',
        message: 'تعذّر الاتصال بـ Pi API.'
      });
    }
  } else if (isApproved && !isVerified) {
    action = 'pending_signature';
  } else {
    action = 'pending';
  }

  // Record for idempotency (temporary, in-memory)
  processedPayments.set(paymentId, { action, at: Date.now() });

  // TASK 07 will persist this to Supabase (audit_events, payments tables).
  return res.status(200).json({
    ok: true,
    paymentId,
    action,
    txid,
    status: {
      cancelled: isCancelled,
      userCancelled: isUserCancelled,
      developerApproved: isApproved,
      developerCompleted: isCompleted,
      transactionVerified: isVerified
    }
  });
}