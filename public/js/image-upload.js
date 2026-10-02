// ============================================================
// GAV — Image Upload Helper
// Handles direct file selection, validation, and browser-side
// compression for offer images.
//
// Requirements (Pi Ecosystem):
//   - Min dimensions: 750 x 1500 px
//   - Format: PNG or JPG/JPEG only
//   - Max size: 1 MB (auto-compressed if larger)
// ============================================================

window.GAVImage = (function () {
  'use strict';

  var IMG_MIN_W = 750;
  var IMG_MIN_H = 1500;
  var IMG_MAX_BYTES = 1024 * 1024;
  var IMG_FORMATS = ['image/png', 'image/jpeg', 'image/jpg'];
  var IMG_START_QUALITY = 0.85;
  var IMG_MIN_QUALITY = 0.40;
  var IMG_QUALITY_STEP = 0.10;

  var _currentDataUrl = null;

  function formatBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / (1024 * 1024)).toFixed(2) + ' MB';
  }

  function readImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
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
      var r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = function () { reject(new Error('فشل تحويل الصورة')); };
      r.readAsDataURL(blob);
    });
  }

  function drawScaled(img, targetW, targetH) {
    var canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(img, 0, 0, targetW, targetH);
    return canvas;
  }

  async function compressImage(file) {
    var img = await readImage(file);
    var origW = img.naturalWidth;
    var origH = img.naturalHeight;

    if (origW < IMG_MIN_W || origH < IMG_MIN_H) {
      throw new Error(
        'الأبعاد ' + origW + '×' + origH +
        ' أقل من الحد الأدنى ' + IMG_MIN_W + '×' + IMG_MIN_H
      );
    }

    var scale = Math.max(IMG_MIN_W / origW, IMG_MIN_H / origH);
    var targetW = Math.round(origW * scale);
    var targetH = Math.round(origH * scale);

    var canvas = drawScaled(img, targetW, targetH);

    var quality = IMG_START_QUALITY;
    var blob = await canvasToBlob(canvas, 'image/jpeg', quality);

    var attempts = 0;
    while (blob && blob.size > IMG_MAX_BYTES &&
           quality > IMG_MIN_QUALITY && attempts < 8) {
      quality = Math.max(IMG_MIN_QUALITY, quality - IMG_QUALITY_STEP);
      blob = await canvasToBlob(canvas, 'image/jpeg', quality);
      attempts++;
    }

    if (!blob) throw new Error('فشل ضغط الصورة');

    if (blob.size > IMG_MAX_BYTES) {
      throw new Error(
        'حتى بعد الضغط، الحجم ' + formatBytes(blob.size) +
        ' يتجاوز 1 ميغابايت.'
      );
    }

    var dataUrl = await blobToDataURL(blob);

    return {
      dataUrl: dataUrl,
      width: targetW,
      height: targetH,
      size: blob.size,
      originalSize: file.size,
      quality: quality
    };
  }

  async function handleFile(file, elements) {
    var preview = elements.preview;
    var status = elements.status;
    var previewImg = elements.previewImg;

    _currentDataUrl = null;

    if (!file) {
      preview.style.display = 'none';
      return null;
    }

    if (IMG_FORMATS.indexOf(file.type) === -1) {
      status.className = 'image-status err';
      status.textContent = '✗ الصيغة يجب أن تكون PNG أو JPG/JPEG';
      preview.style.display = 'block';
      previewImg.src = '';
      return null;
    }

    preview.style.display = 'block';
    status.className = 'image-status working';
    status.textContent = '⏳ جاري معالجة الصورة...';

    try {
      var result = await compressImage(file);
      _currentDataUrl = result.dataUrl;
      previewImg.src = result.dataUrl;

      var compressed = result.originalSize > result.size;
      status.className = 'image-status ok';
      status.style.whiteSpace = 'pre-line';
      status.textContent =
        '✓ جاهزة للنشر\n' +
        'الأبعاد: ' + result.width + '×' + result.height + ' بكسل\n' +
        'الحجم: ' + formatBytes(result.size) +
        (compressed
          ? ' (مضغوطة من ' + formatBytes(result.originalSize) + ')'
          : '') +
        '\nالجودة: ' + Math.round(result.quality * 100) + '%';
      return result;
    } catch (err) {
      console.error('[GAV] image error:', err);
      status.className = 'image-status err';
      status.textContent = '✗ ' + err.message;
      previewImg.src = '';
      _currentDataUrl = null;
      return null;
    }
  }

  return {
    handleFile: handleFile,
    getCurrentDataUrl: function () { return _currentDataUrl; },
    reset: function () { _currentDataUrl = null; }
  };
})();