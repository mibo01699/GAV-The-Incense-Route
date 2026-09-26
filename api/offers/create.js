// POST /api/offers/create
// Body: { title, description, pricePi, stock, unit, weightGrams, imageUrl, gps }
// Header: Authorization: Bearer <pi_access_token>

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) {
    return res.status(401).json({ message: 'Missing token' });
  }

  // التحقق من الهوية عبر Pi API
  let piUser;
  try {
    const piRes = await fetch('https://api.minepi.com/v2/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!piRes.ok) {
      return res.status(401).json({ message: 'Invalid token' });
    }
    piUser = await piRes.json();
  } catch (err) {
    return res.status(502).json({ message: 'Pi verification failed' });
  }

  const {
    title, description, pricePi, stock, unit,
    weightGrams, imageUrl, gps
  } = req.body || {};

  // التحقق من المدخلات
  if (!title || title.length > 80) {
    return res.status(400).json({ message: 'عنوان غير صالح' });
  }
  if (!description || description.length > 500) {
    return res.status(400).json({ message: 'وصف غير صالح' });
  }
  if (typeof pricePi !== 'number' || pricePi < 0.001) {
    return res.status(400).json({ message: 'السعر يجب أن يكون ≥ 0.001 Pi' });
  }
  if (typeof stock !== 'number' || stock < 1) {
    return res.status(400).json({ message: 'الكمية غير صالحة' });
  }
  if (!imageUrl || !/^https?:\/\//.test(imageUrl)) {
    return res.status(400).json({ message: 'رابط الصورة غير صالح' });
  }
  if (!gps || typeof gps.lat !== 'number' || typeof gps.lng !== 'number') {
    return res.status(400).json({ message: 'GPS مطلوب' });
  }

  // هنا: خزّن العرض في قاعدة البيانات
  // مثال (pseudo-code):
  // const offer = await db.offers.insert({
  //   uid: piUser.uid,
  //   username: piUser.username,
  //   title, description, pricePi, stock, unit, weightGrams,
  //   imageUrl,
  //   lat: gps.lat, lng: gps.lng,
  //   status: 'pending',
  //   createdAt: new Date()
  // });

  // مؤقتًا: إرجاع نجاح (لأنه لا توجد DB بعد)
  return res.status(201).json({
    ok: true,
    message: 'تم نشر العرض',
    offerId: 'temp_' + Date.now()
  });
}