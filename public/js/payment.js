/* ============================================================
   GAV – Module: Pi Payment Flow (Correct U2A Flow)
   Path:   public/js/modules/payment.js
   ============================================================ */

(function () {
    'use strict';

    const PAYMENT_TIMEOUT_MS = 180000;

    if (window.__GAV_PAYMENT_LOADED__ === true) return;
    window.__GAV_PAYMENT_LOADED__ = true;

    const state = { inFlight: false, lastResult: null };

    function safeLog(level, msg, data) {
        if (!window.console) return;
        const fn = console[level] || console.log;
        if (data !== undefined) fn.call(console, '[GAV/payment] ' + msg, data);
        else fn.call(console, '[GAV/payment] ' + msg);
    }

    function notify(type, msg) {
        if (typeof window.showToast === 'function') {
            try { window.showToast(type, msg); return; } catch (_) {}
        }
        safeLog(type === 'error' ? 'error' : 'info', msg);
    }

    function isPiReady() {
        return typeof window.Pi !== 'undefined' && window.Pi !== null &&
               typeof window.Pi.createPayment === 'function' &&
               window.__GAV_PI_READY__ === true;
    }

    function toPiAmount(amount) {
        const n = Number(amount);
        if (!isFinite(n) || n <= 0) return null;
        return Math.round(n * 10000000) / 10000000;
    }

    async function approveOnServer(paymentId) {
        try {
            const res = await window.GavApi.withAuth(function () {
                return window.GavApi.endpoints.approvePayment(paymentId);
            });
            if (!res || !res.ok) {
                return { ok: false, error: (res && res.error) || 'فشل الاعتماد.' };
            }
            return { ok: true };
        } catch (err) {
            return { ok: false, error: 'خطأ شبكة.' };
        }
    }

    async function completeOnServer(paymentId, txid) {
        try {
            const res = await window.GavApi.withAuth(function () {
                return window.GavApi.endpoints.completePayment(paymentId, txid);
            });
            if (!res || !res.ok) {
                return { ok: false, error: (res && res.error) || 'فشل الإكمال.' };
            }
            return { ok: true };
        } catch (err) {
            return { ok: false, error: 'خطأ شبكة.' };
        }
    }

    async function startCheckout(options) {
        options = options || {};

        if (state.inFlight) {
            return { ok: false, error: 'عملية دفع أخرى قيد التنفيذ.' };
        }

        const source = String(options.source || 'gav');
        const currency = String(options.currency || 'PI').toUpperCase();
        const items = Array.isArray(options.items) ? options.items : [];
        const total = Number(options.total);

        if (currency !== 'PI') return { ok: false, error: 'العملة غير مدعومة. Pi فقط.' };
        if (!items.length) return { ok: false, error: 'السلة فارغة.' };
        if (!isFinite(total) || total <= 0) return { ok: false, error: 'المبلغ غير صالح.' };

        if (!window.GavApi || !window.GavApi.hasSession || !window.GavApi.hasSession()) {
            notify('warning', 'الرجاء تسجيل الدخول أولاً.');
            return { ok: false, error: 'يجب تسجيل الدخول.' };
        }
        if (!isPiReady()) {
            notify('error', 'Pi SDK غير جاهز. افتح التطبيق في Pi Browser.');
            return { ok: false, error: 'Pi SDK غير جاهز.' };
        }

        state.inFlight = true;

        const amount = toPiAmount(total);
        if (!amount) { state.inFlight = false; return { ok: false, error: 'تعذّر حساب المبلغ.' }; }

        const memo = ('GAV/' + source).slice(0, 100);
        const metadata = { source, currency: 'PI', items, total: amount, createdAt: Date.now() };

        return await new Promise(function (resolve) {
            let settled = false;

            function finalize(result) {
                if (settled) return;
                settled = true;
                state.inFlight = false;
                state.lastResult = result;
                resolve(result);
            }

            const hardTimer = setTimeout(function () {
                if (!settled) {
                    notify('error', 'انتهت مهلة الدفع.');
                    finalize({ ok: false, error: 'انتهت المهلة.' });
                }
            }, PAYMENT_TIMEOUT_MS);

            try {
                window.Pi.createPayment(
                    { amount, memo, metadata },
                    {
                        onReadyForServerApproval: function (paymentId) {
                            safeLog('info', 'onReadyForServerApproval: ' + paymentId);
                            approveOnServer(paymentId).then(function (ap) {
                                if (!ap.ok) {
                                    notify('error', ap.error || 'فشل الاعتماد.');
                                    clearTimeout(hardTimer);
                                    finalize({ ok: false, error: ap.error, paymentId });
                                }
                            });
                        },
                        onReadyForServerCompletion: function (paymentId, txid) {
                            safeLog('info', 'onReadyForServerCompletion: ' + txid);
                            completeOnServer(paymentId, txid).then(function (cp) {
                                clearTimeout(hardTimer);
                                if (!cp.ok) {
                                    notify('error', cp.error || 'فشل الإكمال.');
                                    finalize({ ok: false, paymentId, txid, error: cp.error });
                                    return;
                                }
                                notify('success', 'تم إتمام الدفع بنجاح 🎉');
                                finalize({ ok: true, paymentId, txid });
                            });
                        },
                        onCancel: function (paymentId) {
                            notify('info', 'تم إلغاء عملية الدفع.');
                            clearTimeout(hardTimer);
                            finalize({ ok: false, cancelled: true, paymentId, error: 'تم الإلغاء.' });
                        },
                        onError: function (err, payment) {
                            const msg = (err && err.message) ? String(err.message).slice(0, 200) : 'فشل الدفع.';
                            notify('error', 'فشل: ' + msg);
                            clearTimeout(hardTimer);
                            finalize({ ok: false, error: msg, paymentId: payment && payment.identifier });
                        }
                    }
                );
            } catch (err) {
                clearTimeout(hardTimer);
                notify('error', 'تعذّر فتح نافذة الدفع.');
                finalize({ ok: false, error: 'تعذّر فتح النافذة.' });
            }
        });
    }

    async function reconcile(payment) {
        if (!payment || !payment.identifier) return { ok: false, error: 'بيانات غير مكتملة.' };
        const paymentId = payment.identifier;
        const txid = payment.transaction && payment.transaction.txid ? payment.transaction.txid : null;

        if (txid) {
            const cp = await completeOnServer(paymentId, txid);
            if (cp.ok) notify('success', 'تم إنهاء دفع سابق.');
            return cp;
        }

        try {
            const res = await window.GavApi.endpoints.reconcilePayment(paymentId, null);
            if (res && res.ok) notify('info', 'تمت المزامنة.');
            return res || { ok: false };
        } catch (err) {
            return { ok: false, error: 'تعذّرت المزامنة.' };
        }
    }

    window.GavPayment = Object.freeze({
        init: function () {},
        startCheckout: startCheckout,
        reconcile: reconcile,
        isBusy: function () { return state.inFlight === true; },
        lastResult: function () { return state.lastResult; }
    });

    safeLog('info', 'Payment module ready (U2A flow).');
})();