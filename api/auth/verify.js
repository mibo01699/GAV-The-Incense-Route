// Server-side verification — Pi Platform API is source of truth
// Never trust client-side uid or username. Always call /me.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { accessToken } = req.body || {};
  if (!accessToken || typeof accessToken !== 'string') {
    return res.status(400).json({ message: 'accessToken required' });
  }

  try {
    const piRes = await fetch('https://api.minepi.com/v2/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!piRes.ok) {
      return res.status(401).json({ message: 'Invalid or expired Pi access token' });
    }

    const user = await piRes.json(); // { uid, username, credentials }

    // Minimal data: only store what's essential.
    // No email. No phone. No external tracking.
    const yerBalance = 0; // replace with DB query later

    return res.status(200).json({
      uid: user.uid,
      username: user.username || null,
      yerBalance
    });
  } catch (err) {
    console.error('Pi verification error:', err);
    return res.status(500).json({ message: 'Verification failed' });
  }
}