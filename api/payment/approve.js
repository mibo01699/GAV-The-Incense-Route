// Approve payment — required before user confirms transaction
// POST /api/payment/approve  { paymentId }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { paymentId } = req.body || {};
  if (!paymentId) {
    return res.status(400).json({ message: 'paymentId required' });
  }

  const PI_API_KEY = process.env.PI_API_KEY;
  if (!PI_API_KEY) {
    return res.status(500).json({ message: 'Server API key not configured' });
  }

  try {
    const piRes = await fetch(
      `https://api.minepi.com/v2/payments/${paymentId}/approve`,
      {
        method: 'POST',
        headers: {
          Authorization: `Key ${PI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!piRes.ok) {
      const err = await piRes.text();
      console.error('Approval failed:', err);
      return res.status(502).json({ message: 'Pi approval failed' });
    }

    return res.status(200).json({ approved: true, paymentId });
  } catch (err) {
    console.error('Approve error:', err);
    return res.status(500).json({ message: 'Internal error' });
  }
}