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
    input[type="text"], input[type="number"], input[type="url"], textarea, select {
      width: 100%; padding: 12px; background: #1a1a1a;
      border: 1px solid #333; border-radius: 8px;
      color: #fff; font-size: 1rem; font-family: inherit;
    }
    input:focus, textarea:focus, select:focus {
      outline: none; border-color: #f0b90b;
    }
    textarea { resize: vertical; min-height: 80px; }
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
    .hint { color: #888; font-size: 0.8rem; margin-top: 4px; }
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
    .offer-item h4 { color: #f0b90b; margin-bottom: 8px; }
    .offer-item .price { font-size: 1.3rem; color: #f0b90b; margin: 8px 0; }
    .offer-item img {
      width: 100%; max-height: 200px; object-fit: cover;
      border-radius: 8px; margin-top: 8px;
    }
    .image-preview {
      margin-top: 12px; text-align: center;
    }
    .image-preview img {
      max-width: 100%; max-height: 300px;
      border-radius: 8px; border: 1px solid #333;
    }
    .image-status {
      font-size: 0.8rem; margin-top: 8px; color: #888;
    }
    .image-status.ok { color: #4caf50; }
    .image-status.err { color: #ff4444; }
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
    </div>

    <!-- CREATE VIEW -->
    <div id="create-view" style="display:none">
      <button class="btn btn-outline" onclick="hideCreateForm()">← رجوع للعروض</button>
      <form id="offer-form" onsubmit="submitOffer(event)">
        <div class="field">
          <label for="title">عنوان المنتج *</label>
          <input type="text" id="title" required maxlength="80"
                 placeholder="مثال: 10 كيلو قهوة يمنية">
        </div>
        <div class="field">
          <label for="description">وصف المنتج *</label>
          <textarea id="description" required maxlength="500"
                    placeholder="الجودة، المصدر، تاريخ الحصاد..."></textarea>
        </div>
        <div class="row">
          <div class="field">
            <label for="price">السعر بـ Pi *</label>
            <input type="number" id="price" required min="0.001"
                   step="0.001" placeholder="1.5">
          </div>
          <div class="field">
            <label for="stock">الكمية *</label>
            <input type="number" id="stock" required min="1" step="1" placeholder="10">
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
          </div>
        </div>

        <!-- NEW: Image Upload -->
        <div class="field">
          <label for="image-file">صورة المنتج *</label>
          <input type="file" id="image-file" accept="image/png,image/jpeg"
                 required onchange="handleImageSelect(event)">
          <div class="hint">
            ⚠️ شروط الصورة:
            <br>• الأبعاد الدنيا: 750 × 1500 بكسل
            <br>• الصيغة: PNG أو JPG/JPEG فقط
            <br>• الحجم الأقصى: 1 ميغابايت (سيُضغط تلقائيًا إن زاد)
            <br>• صورة حقيقية 100% — يُمنع الذكاء الاصطناعي
          </div>
          <div id="image-preview" class="image-preview" style="display:none">
            <img id="preview-img" alt="معاينة">
            <div id="image-status" class="image-status"></div>
          </div>
        </div>

        <div class="field">
          <label>
            <input type="checkbox" id="gps-consent" required>
            أوافق على استخدام GPS لتحديد موقعي التقريبي
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
      <div id="payment-status" style="margin-top:16px;color:#888"></div>
    </div>
  </div>

  <script>
    // ============================================================
    // GAV — Testnet Offers + Payments + Image Upload
    // ============================================================

    let currentUser = null;
    let currentToken = null;
    let pendingPaymentOffer = null;

    // Image constraints
    const IMG_MIN_W = 750;
    const IMG_MIN_H = 1500;
    const IMG_MAX_BYTES = 1024 * 1024; // 1 MB
    const IMG_FORMATS = ['image/png', 'image/jpeg', 'image/jpg'];
    const IMG_TARGET_QUALITY = 0.85;

    let compressedImageBase64 = null; // data URL

    // ============================================================
    // Session + Navigation
    // ============================================================
    function getSession() {
      try {
        return {
          token: sessionStorage.getItem('pi_access_token'),
          uid: sessionStorage.getItem('pi_uid'),
          username: sessionStorage.getItem('pi_username')
        };
      } catch (e) { return {}; }
    }

    function goBack() { window.location.href = '/'; }

    function showError(msg) {
      const el = document.getElementById('error-box');
      el.style.display = 'block';
      el.textContent = msg;
      setTimeout(() => { el.style.display = 'none'; }, 6000);
    }

    function showCreateForm() {
      document.getElementById('list-view').style.display = 'none';
      document.getElementById('create-view').style.display = 'block';
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

    // ============================================================
    // Image Handling — validation + compression
    // ============================================================
    function formatBytes(n) {
      if (n < 1024) return n + ' B';
      if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
      return (n / (1024 * 1024)).toFixed(2) + ' MB';
    }

    function readImage(file) {
      return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(url);
          resolve(img);
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('فشل قراءة الصورة'));
        };
        img.src = url;
      });
    }

    function canvasToBlob(canvas, type, quality) {
      return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), type, quality);
      });
    }

    function blobToDataURL(blob) {
      return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(new Error('فشل تحويل الصورة'));
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

      // Target the minimum allowed dimensions (aspect ratio preserved)
      const scale = Math.max(IMG_MIN_W / origW, IMG_MIN_H / origH);
      const targetW = Math.round(origW * scale);
      const targetH = Math.round(origH * scale);

      const canvas = drawScaled(img, targetW, targetH);
      const outputType = 'image/jpeg';

      let quality = IMG_TARGET_QUALITY;
      let blob = await canvasToBlob(canvas, outputType, quality);

      // Iteratively reduce quality until under 1 MB
      let attempts = 0;
      while (blob && blob.size > IMG_MAX_BYTES && quality > 0.4 && attempts < 6) {
        quality -= 0.1;
        blob = await canvasToBlob(canvas, outputType, quality);
        attempts++;
      }

      if (!blob) {
        throw new Error('فشل ضغط الصورة');
      }

      if (blob.size > IMG_MAX_BYTES) {
        throw new Error(
          'حتى بعد الضغط، حجم الصورة ' +
          formatBytes(blob.size) +
          ' يتجاوز 1 ميغابايت'
        );
      }

      const dataUrl = await blobToDataURL(blob);

      return {
        dataUrl,
        blob,
        width: targetW,
        height: targetH,
        size: blob.size,
        type: outputType,
        originalSize: file.size
      };
    }

    async function handleImageSelect(event) {
      const file = event.target.files && event.target.files[0];
      const preview = document.getElementById('image-preview');
      const status = document.getElementById('image-status');
      const previewImg = document.getElementById('preview-img');

      compressedImageBase64 = null;

      if (!file) {
        preview.style.display = 'none';
        return;
      }

      // 1. Format check
      if (!IMG_FORMATS.includes(file.type)) {
        status.className = 'image-status err';
        status.textContent = '✗ الصيغة يجب أن تكون PNG أو JPG/JPEG';
        preview.style.display = 'block';
        previewImg.src = '';
        event.target.value = '';
        return;
      }

      preview.style.display = 'block';
      status.className = 'image-status';
      status.textContent = '⏳ جاري معالجة الصورة...';

      try {
        const result = await compressImage(file);
        compressedImageBase64 = result.dataUrl;
        previewImg.src = result.dataUrl;
        status.className = 'image-status ok';
        status.textContent =
          '✓ جاهزة: ' + result.width + '×' + result.height +
          ' • ' + formatBytes(result.size) +
          (result.originalSize > result.size
            ? ' (مضغوطة من ' + formatBytes(result.originalSize) + ')'
            : '');
      } catch (err) {
        console.error('[GAV] image error:', err);
        status.className = 'image-status err';
        status.textContent = '✗ ' + err.message;
        previewImg.src = '';
        event.target.value = '';
      }
    }

    // ============================================================
    // Pi init + auth
    // ============================================================
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

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'فشل التحقق من الهوية');
      }

      currentToken = auth.accessToken;
      currentUser = data;
      sessionStorage.setItem('pi_access_token', currentToken);
      sessionStorage.setItem('pi_uid', data.uid);
      sessionStorage.setItem('pi_username', data.username || '');
    }

    // ============================================================
    // GPS
    // ============================================================
    async function getGPS() {
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          return reject(new Error('GPS غير مدعوم'));
        }
        navigator.geolocation.getCurrentPosition(
          pos => resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          }),
          () => reject(new Error('تم رفض الوصول إلى GPS')),
          { enableHighAccuracy: true, timeout: 10000 }
        );
      });
    }

    // ============================================================
    // Offers
    // ============================================================
    function escapeHtml(s) {
      return String(s || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    async function loadOffers() {
      const container = document.getElementById('offers-list');
      container.innerHTML = '<div style="text-align:center;padding:20px;color:#888">جاري التحميل...</div>';

      try {
        const res = await fetch('/api/offers/list', {
          headers: { 'Authorization': 'Bearer ' + currentToken }
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data.offers || data.offers.length === 0) {
          container.innerHTML =
            '<div style="text-align:center;padding:20px;color:#888">' +
            'لا توجد عروض بعد. أنشئ أول عرض!</div>';
          return;
        }

        container.innerHTML = data.offers.map(o => {
          const img = o.imageDataUrl
            ? '<img src="' + o.imageDataUrl + '" alt="' + escapeHtml(o.title) + '">'
            : '';
          return (
            '<div class="offer-item">' +
              '<h4>' + escapeHtml(o.title) + '</h4>' +
              '<p style="color:#999;font-size:0.9rem">' +
                escapeHtml(o.description || '') + '</p>' +
              img +
              '<div class="price">' + o.pricePi + ' Pi / ' + escapeHtml(o.unit) + '</div>' +
              '<p style="color:#888;font-size:0.8rem">متاح: ' + o.stock +
                ' • بواسطة ' + escapeHtml(o.username || 'مستخدم') + '</p>' +
              '<button class="btn" onclick="openPayment(' +
                "'" + o.id + "'," +
                "'" + escapeHtml(o.title) + "'," +
                o.pricePi +
              ')">💰 دفع ' + o.pricePi + ' Pi</button>' +
            '</div>'
          );
        }).join('');
      } catch (err) {
        container.innerHTML =
          '<div style="text-align:center;padding:20px;color:#ff4444">فشل تحميل العروض</div>';
      }
    }

    async function submitOffer(e) {
      e.preventDefault();
      document.getElementById('error-box').style.display = 'none';

      if (!compressedImageBase64) {
        showError('الرجاء اختيار صورة المنتج أولاً');
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
          weightGrams: parseInt(document.getElementById('weight').value, 10) || null,
          imageDataUrl: compressedImageBase64,
          gps
        };

        const res = await fetch('/api/offers/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + currentToken
          },
          body: JSON.stringify(offer)
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.message || 'فشل نشر العرض');
        }

        document.getElementById('offer-form').style.display = 'none';
        document.getElementById('success').style.display = 'block';
        setTimeout(() => {
          hideCreateForm();
          document.getElementById('offer-form').style.display = 'block';
          document.getElementById('success').style.display = 'none';
          document.getElementById('offer-form').reset();
          compressedImageBase64 = null;
          document.getElementById('image-preview').style.display = 'none';
        }, 1500);
      } catch (err) {
        showError