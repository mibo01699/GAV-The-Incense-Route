// Complete payment — after user submits blockchain transaction
// POST /api/payment/complete  { paymentId, txid }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { paymentId, txid } = req.body || {};
  if (!paymentId || !txid) {
    return res.status(400).json({ message: 'paymentId and txid required' });
  }

  const PI_API_KEY = process.env.PI_API_KEY;
  if (!PI_API_KEY) {
    return res.status(500).json({ message: 'Server API key not configured' });
  }

  try {
    const piRes = await fetch(
      `https://api.minepi.com/v2/payments/${paymentId}/complete`,
      {
        method: 'POST',
        headers: {
          Authorization: `Key ${PI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ txid })
      }
    );

    if (!piRes.ok) {
      const err = await piRes.text();
      console.error('Completion failed:', err);
      return res.status(502).json({ message: 'Pi completion failed' });
    }

    // Record completed barter in DB, credit YER per YER_TOKENOMICS
    // Example: +500 YER to offer maker

    return res.status(200).json({ completed: true, paymentId, txid });
  } catch (err) {
    console.error('Complete error:', err);
    return res.status(500).json({ message: 'Internal error' });
  }
}