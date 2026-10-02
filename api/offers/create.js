// POST /api/offers/create
// Header: Authorization: Bearer <pi_access_token>
// Body: { title, description, pricePi, stock, unit, weightGrams, imageUrl, gps }
//
// TASK 06: temporary in-memory store.
// TASK 07 (Supabase) will persist this properly.

const globalStore = globalThis.__GAV_OFFERS__ || (globalThis.__GAV_OFFERS__ = []);

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

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) {
    return res.status(401).json({
      ok: false,
      error: 'MISSING_TOKEN',
      message: 'accessToken مطلوب.'
    });
  }

  let piUser;
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
    piUser = await meRes.json();
  } catch {
    return res.status(502).json({
      ok: false,
      error: 'PI_API_UNREACHABLE',
      message: 'تعذّر الاتصال بـ Pi API.'
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

  const title = body && typeof body.title === 'string' ? body.title.trim() : '';
  const description =
    body && typeof body.description === 'string' ? body.description.trim() : '';
  const pricePi = body ? Number(body.pricePi) : NaN;
  const stock = body ? Number(body.stock) : NaN;
  const unit = body && typeof body.unit === 'string' ? body.unit.trim() : '';
  const imageUrl = body && typeof body.imageUrl === 'string' ? body.imageUrl.trim() : '';
  const gps = body && body.gps ? body.gps : null;

  if (!title || title.length > 80) {
    return res.status(400).json({ ok: false, error: 'INVALID_TITLE', message: 'عنوان غير صالح.' });
  }
  if (description.length > 500) {
    return res.status(400).json({ ok: false, error: 'INVALID_DESCRIPTION', message: 'وصف طويل جدًا.' });
  }
  if (!Number.isFinite(pricePi) || pricePi < 0.001) {
    return res.status(400).json({ ok: false, error: 'INVALID_PRICE', message: 'السعر يجب أن يكون ≥ 0.001 Pi.' });
  }
  if (!Number.isInteger(stock) || stock < 1) {
    return res.status(400).json({ ok: false, error: 'INVALID_STOCK', message: 'الكمية غير صالحة.' });
  }
  if (!unit) {
    return res.status(400).json({ ok: false, error: 'INVALID_UNIT', message: 'وحدة التجزئة مطلوبة.' });
  }
  if (!/^https?:\/\//.test(imageUrl)) {
    return res.status(400).json({ ok: false, error: 'INVALID_IMAGE_URL', message: 'رابط الصورة غير صالح.' });
  }
  if (!gps || typeof gps.lat !== 'number' || typeof gps.lng !== 'number') {
    return res.status(400).json({ ok: false, error: 'INVALID_GPS', message: 'GPS مطلوب.' });
  }

  const offer = {
    id: 'off_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    uid: piUser.uid,
    username: piUser.username || '',
    title,
    description,
    pricePi,
    stock,
    unit,
    weightGrams: Number.isFinite(Number(body.weightGrams)) ? Number(body.weightGrams) : null,
    imageUrl,
    gps: { lat: gps.lat, lng: gps.lng },
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  globalStore.push(offer);

  return res.status(201).json({
    ok: true,
    offerId: offer.id,
    offer,
    storage: 'in_memory_temporary'
  });
}