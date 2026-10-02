<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>إنشاء عرض مقايضة | GAV</title>
  <script src="https://sdk.minepi.com/pi-sdk.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0a0a0a; color: #fff;
      min-height: 100vh; direction: rtl;
    }
    #app { padding: 20px; max-width: 600px; margin: 0 auto; }
    .header { display: flex; align-items: center; padding: 16px 0; gap: 12px; }
    .back {
      color: #f0b90b; font-size: 1.5rem; text-decoration: none;
      cursor: pointer; background: none; border: none;
    }
    h1 { color: #f0b90b; font-size: 1.3rem; }
    .field { margin: 16px 0; }
    label { display: block; margin-bottom: 6px; color: #ccc; font-size: 0.9rem; }
    input[type="text"], input[type="number"], textarea, select {
      width: 100%; padding: 12px; background: #1a1a1a;
      border: 1px solid #333; border-radius: 8px;
      color: #fff; font-size: 1rem; font-family: inherit;
    }
    input:focus, textarea:focus, select:focus {
      outline: none; border-color: #f0b90b;
    }
    textarea { resize: vertical; min-height: 80px; }
    input[type="file"] {
      width: 100%; padding: 12px; background: #1a1a1a;
      border: 1px solid #333; border-radius: 8px;
      color: #fff; font-size: 0.9rem; font-family: inherit;
      cursor: pointer;
    }
    input[type="file"]::file-selector-button {
      background: #f0b90b; color: #000; border: none;
      padding: 8px 16px; border-radius: 6px;
      font-size: 0.9rem; font-weight: 600; cursor: pointer;
      margin-left: 12px;
    }
    .btn {
      background: #f0b90b; color: #000; border: none;
      padding: 14px 28px; border-radius: 12px;
      font-size: 1rem; font-weight: 600; cursor: pointer;
      width: 100%; margin-top: 20px;
    }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-outline {
      background: transparent; border: 2px solid #f0b90b;
      color: #f0b90b; margin-top: 10px;
    }
    .row { display: flex; gap: 12px; }
    .row > * { flex: 1; }
    .hint { color: #888; font-size: 0.8rem; margin-top: 4px; line-height: 1.6; }
    .success {
      background: #1a3a1a; border: 1px solid #4caf50;
      color: #4caf50; padding: 16px; border-radius: 12px;
      margin-top: 20px; text-align: center;
    }
    .error-box {
      background: #3a1a1a; border: 1px solid #ff4444;
      color: #ff4444; padding: 12px; border-radius: 8px;
      margin: 12px 0;
    }
    .spinner {
      width: 20px; height: 20px; border: 2px solid #333;
      border-top-color: #f0b90b; border-radius: 50%;
      animation: spin 1s linear infinite;
      display: inline-block; vertical-align: middle; margin-left: 8px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .card {
      background: #1a1a1a; border-radius: 16px;
      padding: 20px; margin: 16px 0; border: 1px solid #333;
    }
    .offer-item {
      background: #151515; border: 1px solid #333;
      border-radius: 12px; padding: 16px; margin: 12px 0;
    }
    .offer-item h4 { color: #f0b90b; margin-bottom: 8px; font-size: 1.05rem; }
    .offer-item .desc { color: #999; font-size: 0.9rem; margin-bottom: 10px; }
    .offer-item .price { font-size: 1.3rem; color: #f0b90b; margin: 8px 0; font-weight: 700; }
    .offer-item .meta { color: #888; font-size: 0.8rem; margin-bottom: 12px; }
    .offer-item img {
      width: 100%; max-height: 240px; object-fit: cover;
      border-radius: 8px; margin-bottom: 12px; border: 1px solid #222;
    }
    .image-preview {
      margin-top: 12px; text-align: center;
    }
    .image-preview img {
      max-width: 100%; max-height: 320px;
      border-radius: 8px; border: 1px solid #333;
    }
    .image-status {
      font-size: 0.8rem; margin-top: 10px; color: #888;
      padding: 8px; border-radius: 6px; background: #151515;
      line-height: 1.6;
    }
    .image-status.ok { color: #4caf50; border: 1px solid #2a5a2a; }
    .image-status.err { color: #ff4444; border: 1px solid #5a2a2a; }
    .image-status.working { color: #f0b90b; }
    .nav-hint {
      text-align: center; color: #666; font-size: 0.75rem;
      margin-top: 30px; padding-top: 20px; border-top: 1px solid #222;
    }
    .empty-state {
      text-align: center; padding: 30px 20px; color: #888;
    }
  </style>
</head>
<body>
  <div id="app">
    <div class="header">
      <button class="back" onclick="goBack()">→</button>
      <h1>🤝 عروض المقايضة</h1>
    </div>

    <div id="error-box" class="error-box" style="display:none"></div>

    <!-- LIST VIEW -->
    <div id="list-view">
      <button class="btn" onclick="showCreateForm()">+ إنشاء عرض جديد</button>
      <div id="offers-list"></div>
      <div class="nav-hint">
        GAV - The Incense Route • Testnet • Pi-only
      </div>
    </div>

    <!-- CREATE VIEW -->
    <div id="create-view" style="display:none">
      <button class="btn btn-outline" onclick="hideCreateForm()">← رجوع للعروض</button>

      <form id="offer-form" onsubmit="submitOffer(event)">
        <div class="field">
          <label for="title">عنوان المنتج *</label>
          <input type="text" id="title" required maxlength="80"
                 placeholder="مثال: 10 كيلو قهوة يمنية">
          <div class="hint">حتى 80 حرفًا</div>
        </div>

        <div class="field">
          <label for="description">وصف المنتج *</label>
          <textarea id="description" required maxlength="500"
                    placeholder="الجودة، المصدر، تاريخ الحصاد..."></textarea>
          <div class="hint">حتى 500 حرف</div>
        </div>

        <div class="row">
          <div class="field">
            <label for="price">السعر بـ Pi *</label>
            <input type="number" id="price" required min="0.001"
                   step="0.001" placeholder="1.5">
            <div class="hint">≥ 0.001 Pi</div>
          </div>
          <div class="field">
            <label for="stock">الكمية *</label>
            <input type="number" id="stock" required min="1" step="1"
                   placeholder="10">
            <div class="hint">عدد صحيح ≥ 1</div>
          </div>
        </div>

        <div class="row">
          <div class="field">
            <label for="unit">وحدة التجزئة *</label>
            <select id="unit" required>
              <option value="kg">كيلوغرام</option>
              <option value="g">غرام</option>
              <option value="piece">قطعة</option>
              <option value="box">صندوق</option>
              <option value="liter">لتر</option>
              <option value="bundle">حزمة</option>
            </select>
          </div>
          <div class="field">
            <label for="weight">الوزن (غرام)</label>
            <input type="number" id="weight" min="0" step="1" placeholder="1000">
            <div class="hint">اختياري</div>
          </div>
        </div>

        <!-- IMAGE UPLOAD -->
        <div class="field">
          <label for="image-file">صورة المنتج *</label>
          <input type="file" id="image-file"
                 accept="image/png,image/jpeg"
                 required
                 onchange="handleImageSelect(event)">
          <div class="hint">
            ⚠️ شروط الصورة:
            <br>• الأبعاد الدنيا: 750 × 1500 بكسل
            <br>• الصيغة: PNG أو JPG/JPEG فقط
            <br>• الحجم الأقصى: 1 ميغابايت (يُضغط تلقائيًا إن زاد)
            <br>• صورة حقيقية 100% — يُمنع الذكاء الاصطناعي
          </div>
          <div id="image-preview" class="image-preview" style="display:none">
            <img id="preview-img" alt="معاينة">
            <div id="image-status" class="image-status"></div>
          </div>
        </div>

        <div class="field">
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
            <input type="checkbox" id="gps-consent" required
                   style="width:auto;margin:0">
            <span>أوافق على استخدام GPS لتحديد موقعي التقريبي</span>
          </label>
        </div>

        <button type="submit" class="btn" id="submit-btn">نشر العرض</button>
      </form>

      <div id="success" class="success" style="display:none">
        ✅ تم نشر العرض بنجاح
      </div>
    </div>

    <!-- PAYMENT VIEW -->
    <div id="payment-view" style="display:none">
      <h2 style="color:#f0b90b;margin-bottom:16px">إتمام الدفع بـ Pi</h2>
      <div class="card" id="payment-summary"></div>
      <button class="btn" id="pay-btn" onclick="startPayment()">
        💰 ادفع بـ Pi
      </button>
      <button class="btn btn-outline" onclick="hidePayment()">إلغاء</button>
      <div id="payment-status" style="margin-top:16px;color:#888;text-align:center;line-height:1.6"></div>
    </div>
  </div>
  <script>
    // ============================================================
    // GAV — Testnet: Offers + Direct Image Upload + Pi Payments
    // ============================================================

    let currentUser = null;
    let currentToken = null;
    let pendingPaymentOffer = null;
    let compressedImageDataUrl = null;

    const IMG_MIN_W = 750;
    const IMG_MIN_H = 1500;
    const IMG_MAX_BYTES = 1024 * 1024;
    const IMG_FORMATS = ['image/png', 'image/jpeg', 'image/jpg'];
    const IMG_START_QUALITY = 0.85;
    const IMG_MIN_QUALITY = 0.40;
    const IMG_QUALITY_STEP = 0.10;

    function getSession() {
      try {
        return {
          token: sessionStorage.getItem('pi_access_token'),
          uid: sessionStorage.getItem('pi_uid'),
          username: sessionStorage.getItem('pi_username')
        };
      } catch (e) {
        return {};
      }
    }

    function saveSession(token, user) {
      try {
        sessionStorage.setItem('pi_access_token', token);
        sessionStorage.setItem('pi_uid', user.uid);
        sessionStorage.setItem('pi_username', user.username || '');
      } catch (e) {
        console.warn('sessionStorage unavailable');
      }
    }

    function goBack() {
      window.location.href = '/';
    }

    function showError(msg) {
      const el = document.getElementById('error-box');
      el.style.display = 'block';
      el.textContent = msg;
      setTimeout(function () { el.style.display = 'none'; }, 7000);
    }

    function showCreateForm() {
      document.getElementById('list-view').style.display = 'none';
      document.getElementById('create-view').style.display = 'block';
      resetForm();
    }

    function hideCreateForm() {
      document.getElementById('create-view').style.display = 'none';
      document.getElementById('list-view').style.display = 'block';
      loadOffers();
    }

    function hidePayment() {
      document.getElementById('payment-view').style.display = 'none';
      document.getElementById('list-view').style.display = 'block';
      pendingPaymentOffer = null;
    }

    function resetForm() {
      const form = document.getElementById('offer-form');
      if (form) form.reset();
      compressedImageDataUrl = null;
      const preview = document.getElementById('image-preview');
      if (preview) preview.style.display = 'none';
      const status = document.getElementById('image-status');
      if (status) { status.className = 'image-status'; status.textContent = ''; }
      document.getElementById('success').style.display = 'none';
      form.style.display = 'block';
    }

    function escapeHtml(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function formatBytes(n) {
      if (n < 1024) return n + ' B';
      if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
      return (n / (1024 * 1024)).toFixed(2) + ' MB';
    }

    function readImage(file) {
      return new Promise(function (resolve, reject) {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = function () {
          URL.revokeObjectURL(url);
          resolve(img);
        };
        img.onerror = function () {
          URL.revokeObjectURL(url);
          reject(new Error('فشل قراءة الصورة'));
        };
        img.src = url;
      });
    }

    function canvasToBlob(canvas, type, quality) {
      return new Promise(function (resolve) {
        canvas.toBlob(function (blob) { resolve(blob); }, type, quality);
      });
    }

    function blobToDataURL(blob) {
      return new Promise(function (resolve, reject) {
        const r = new FileReader();
        r.onload = function () { resolve(r.result); };
        r.onerror = function () { reject(new Error('فشل تحويل الصورة')); };
        r.readAsDataURL(blob);
      });
    }

    function drawScaled(img, targetW, targetH) {
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetW, targetH);
      ctx.drawImage(img, 0, 0, targetW, targetH);
      return canvas;
    }

    async function compressImage(file) {
      const img = await readImage(file);
      const origW = img.naturalWidth;
      const origH = img.naturalHeight;

      if (origW < IMG_MIN_W || origH < IMG_MIN_H) {
        throw new Error(
          'الأبعاد ' + origW + '×' + origH +
          ' أقل من الحد الأدنى ' + IMG_MIN_W + '×' + IMG_MIN_H
        );
      }

      const scale = Math.max(IMG_MIN_W / origW, IMG_MIN_H / origH);
      const targetW = Math.round(origW * scale);
      const targetH = Math.round(origH * scale);

      const canvas = drawScaled(img, targetW, targetH);

      let quality = IMG_START_QUALITY;
      let blob = await canvasToBlob(canvas, 'image/jpeg', quality);

      let attempts = 0;
      while (blob && blob.size > IMG_MAX_BYTES &&
             quality > IMG_MIN_QUALITY && attempts < 8) {
        quality = Math.max(IMG_MIN_QUALITY, quality - IMG_QUALITY_STEP);
        blob = await canvasToBlob(canvas, 'image/jpeg', quality);
        attempts++;
      }

      if (!blob) {
        throw new Error('فشل ضغط الصورة');
      }

      if (blob.size > IMG_MAX_BYTES) {
        throw new Error(
          'حتى بعد الضغط، الحجم ' + formatBytes(blob.size) +
          ' يتجاوز 1 ميغابايت. جرّب صورة أبسط.'
        );
      }

      const dataUrl = await blobToDataURL(blob);

      return {
        dataUrl: dataUrl,
        width: targetW,
        height: targetH,
        size: blob.size,
        originalSize: file.size,
        originalWidth: origW,
        originalHeight: origH,
        quality: quality
      };
    }

    async function handleImageSelect(event) {
      const file = event.target.files && event.target.files[0];
      const preview = document.getElementById('image-preview');
      const status = document.getElementById('image-status');
      const previewImg = document.getElementById('preview-img');

      compressedImageDataUrl = null;

      if (!file) {
        preview.style.display = 'none';
        return;
      }

      if (IMG_FORMATS.indexOf(file.type) === -1) {
        status.className = 'image-status err';
        status.textContent = '✗ الصيغة يجب أن تكون PNG أو JPG/JPEG';
        preview.style.display = 'block';
        previewImg.src = '';
        event.target.value = '';
        return;
      }

      preview.style.display = 'block';
      status.className = 'image-status working';
      status.textContent = '⏳ جاري معالجة الصورة...';

      try {
        const result = await compressImage(file);
        compressedImageDataUrl = result.dataUrl;
        previewImg.src = result.dataUrl;

        const compressed = result.originalSize > result.size;
        status.className = 'image-status ok';
        status.textContent =
          '✓ جاهزة للنشر\n' +
          'الأبعاد: ' + result.width + '×' + result.height + ' بكسل\n' +
          'الحجم: ' + formatBytes(result.size) +
          (compressed
            ? ' (مضغوطة من ' + formatBytes(result.originalSize) + ')'
            : '') +
          '\nالجودة: ' + Math.round(result.quality * 100) + '%';
        status.style.whiteSpace = 'pre-line';
      } catch (err) {
        console.error('[GAV] image error:', err);
        status.className = 'image-status err';
        status.textContent = '✗ ' + err.message;
        previewImg.src = '';
        compressedImageDataUrl = null;
        event.target.value = '';
      }
    }

    async function initPi() {
      if (typeof Pi === 'undefined') {
        throw new Error('Pi SDK not loaded. Open this app inside Pi Browser.');
      }
      await Pi.init({ version: '2.0', sandbox: true });
    }

    async function ensureAuth() {
      const s = getSession();
      if (s.token) {
        currentToken = s.token;
        currentUser = { uid: s.uid, username: s.username };
        return;
      }

      const auth = await Pi.authenticate(
        ['username', 'payments'],
        onIncompletePaymentFound
      );

      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: auth.accessToken })
      });

      const data = await res.json().catch(function () { return {}; });
      if (!res.ok) {
        throw new Error(data.message || 'فشل التحقق من الهوية');
      }

      currentToken = auth.accessToken;
      currentUser = data;
      saveSession(currentToken, data);
    }

    async function getGPS() {
      return new Promise(function (resolve, reject) {
        if (!navigator.geolocation) {
          return reject(new Error('GPS غير مدعوم على هذا الجهاز'));
        }
        navigator.geolocation.getCurrentPosition(
          function (pos) {
            resolve({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude
            });
          },
          function () {
            reject(new Error('تم رفض الوصول إلى GPS'));
          },
          { enableHighAccuracy: true, timeout: 12000 }
        );
      });
    }

    async function loadOffers() {
      const container = document.getElementById('offers-list');
      container.innerHTML = '<div class="empty-state">جاري التحميل...</div>';

      try {
        const res = await fetch('/api/offers/list', {
          headers: { 'Authorization': 'Bearer ' + currentToken }
        });
        const data = await res.json().catch(function () { return {}; });

        if (!res.ok || !data.offers || data.offers.length === 0) {
          container.innerHTML =
            '<div class="empty-state">لا توجد عروض بعد. أنشئ أول عرض!</div>';
          return;
        }

        container.innerHTML = data.offers.map(function (o) {
          const imgHtml = o.imageDataUrl
            ? '<img src="' + o.imageDataUrl + '" alt="' +
              escapeHtml(o.title) + '">'
            : '';
          return (
            '<div class="offer-item">' +
              '<h4>' + escapeHtml(o.title) + '</h4>' +
              '<p class="desc">' + escapeHtml(o.description || '') + '</p>' +
              imgHtml +
              '<div class="price">' + o.pricePi + ' π / ' +
                escapeHtml(o.unit) + '</div>' +
              '<p class="meta">متاح: ' + o.stock + ' • بواسطة ' +
                escapeHtml(o.username || 'مستخدم') + '</p>' +
              '<button class="btn" onclick="openPayment(' +
                "'" + o.id + "'," +
                "'" + escapeHtml(o.title).replace(/'/g, "\\'") + "'," +
                o.pricePi +
              ')">💰 دفع ' + o.pricePi + ' Pi</button>' +
            '</div>'
          );
        }).join('');
      } catch (err) {
        console.error('[GAV] loadOffers error:', err);
        container.innerHTML =
          '<div class="empty-state" style="color:#ff4444">' +
          'فشل تحميل العروض</div>';
      }
    }

    async function submitOffer(e) {
      e.preventDefault();
      document.getElementById('error-box').style.display = 'none';

      if (!compressedImageDataUrl) {
        showError('الرجاء اختيار صورة المنتج أولاً');
        return;
      }

      const gpsConsent = document.getElementById('gps-consent');
      if (!gpsConsent.checked) {
        showError('يجب الموافقة على استخدام GPS');
        return;
      }

      const btn = document.getElementById('submit-btn');
      btn.disabled = true;
      btn.innerHTML = 'جارٍ النشر... <span class="spinner"></span>';

      try {
        await ensureAuth();
        const gps = await getGPS();

        const offer = {
          title: document.getElementById('title').value.trim(),
          description: document.getElementById('description').value.trim(),
          pricePi: parseFloat(document.getElementById('price').value),
          stock: parseInt(document.getElementById('stock').value, 10),
          unit: document.getElementById('unit').value,
          weightGrams:
            parseInt(document.getElementById('weight').value, 10) || null,
          imageDataUrl: compressedImageDataUrl,
          gps: gps
        };

        const res = await fetch('/api/offers/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + currentToken
          },
          body: JSON.stringify(offer)
        });

        const data = await res.json().catch(function () { return {}; });
        if (!res.ok) {
          throw new Error(data.message || 'فشل نشر العرض');
        }

        document.getElementById('offer-form').style.display = 'none';
        document.getElementById('success').style.display = 'block';

        setTimeout(function () {
          hideCreateForm();
        }, 1500);
      } catch (err) {
        console.error('[GAV] submitOffer error:', err);
        showError(err.message || 'حدث خطأ غير متوقع');
        btn.disabled = false;
        btn.textContent = 'نشر العرض';
      }
    }

    function openPayment(offerId, title, pricePi) {
      pendingPaymentOffer = {
        id: offerId,
        title: title,
        pricePi: pricePi
      };

      document.getElementById('list-view').style.display = 'none';
      document.getElementById('create-view').style.display = 'none';
      document.getElementById('payment-view').style.display = 'block';

      document.getElementById('payment-summary').innerHTML =
        '<h3 style="color:#f0b90b">' + escapeHtml(title) + '</h3>' +
        '<p style="font-size:1.6rem;color:#f0b90b;margin-top:8px;' +
        'font-weight:700">' + pricePi + ' π</p>' +
        '<p style="color:#888;font-size:0.8rem;margin-top:8px">' +
        'شبكة Pi التجريبية (Testnet)</p>';

      document.getElementById('payment-status').textContent = '';
      document.getElementById('pay-btn').disabled = false;
      document.getElementById('pay-btn').textContent = '💰 ادفع بـ Pi';
    }

    async function startPayment() {
      const btn = document.getElementById('pay-btn');
      const status = document.getElementById('payment-status');

      if (!pendingPaymentOffer) return;

      btn.disabled = true;
      btn.innerHTML = 'جارٍ إنشاء الدفعة... <span class="spinner"></span>';
      status.textContent = '';

      try {
        await ensureAuth();

        await Pi.createPayment(
          {
            amount: pendingPaymentOffer.pricePi,
            memo: ('مقايضة: ' + pendingPaymentOffer.title).slice(0, 100),
            metadata: {
              offerId: pendingPaymentOffer.id,
              sellerUid: currentUser ? currentUser.uid : null
            }
          },
          {
            onReadyForServerApproval: async function (paymentId) {
              status.textContent = 'بانتظار موافقة الخادم...';
              const res = await fetch('/api/payment/approve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paymentId: paymentId })
              });
              const data = await res.json().catch(function () { return {}; });
              if (!res.ok) {
                throw new Error(data.message || 'فشلت الموافقة على الدفعة');
              }
              status.textContent =
                'تمت الموافقة. أكمل التوقيع في محفظة Pi.';
            },

            onReadyForServerCompletion: async function (paymentId, txid) {
              status.textContent = 'جارٍ إكمال الدفعة...';
              const res = await fetch('/api/payment/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paymentId: paymentId, txid: txid })
              });
              const data = await res.json().catch(function () { return {}; });
              if (!res.ok) {
                throw new Error(data.message || 'فشل إكمال الدفعة');
              }
              status.innerHTML =
                '<span style="color:#4caf50;font-size:1.1rem">' +
                '✅ تم الدفع بنجاح</span>';
              setTimeout(function () { hidePayment(); }, 2000);
            },

            onCancel: function () {
              status.innerHTML =
                '<span style="color:#ff9800">تم إلغاء الدفعة.</span>';
              btn.disabled = false;
              btn.textContent = '💰 ادفع بـ Pi';
            },

            onError: function (error, payment) {
              console.error('[GAV] Payment error:', error, payment);
              status.innerHTML =
                '<span style="color:#ff4444">' +
                'حدث خطأ في الدفع. الرجاء المحاولة مرة أخرى.</span>';
              btn.disabled = false;
              btn.textContent = '💰 ادفع بـ Pi';
            }
          }
        );
      } catch (err) {
        console.error('[GAV] startPayment error:', err);
        status.innerHTML =
          '<span style="color:#ff4444">' +
          escapeHtml(err.message || 'فشل بدء الدفع') +
          '</span>';
        btn.disabled = false;
        btn.textContent = '💰 ادفع بـ Pi';
      }
    }

    async function onIncompletePaymentFound(payment) {
      console.warn('[GAV] Incomplete payment:', payment && payment.identifier);
      const token = currentToken || getSession().token;
      if (!token) return;
      try {
        await fetch('/api/payment/incomplete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentId: payment.identifier,
            accessToken: token
          })
        });
      } catch (err) {
        console.warn('[GAV] incomplete recovery failed:', err);
      }
    }

    (async function () {
      try {
        await initPi();
        await ensureAuth();
        loadOffers();
      } catch (err) {
        console.error('[GAV] bootstrap error:', err);
        showError(err.message || 'فشل تحميل التطبيق');
        const container = document.getElementById('offers-list');
        container.innerHTML =
          '<div class="empty-state" style="color:#ff4444">' +
          escapeHtml(err.message || 'فشل تحميل التطبيق') + '</div>';
      }
    })();
  </script>
</body>
</html>