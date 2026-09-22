/* ============================================================
   GAV – Module: Pi Payment Flow
   Path:   public/js/modules/payment.js
   ============================================================ */

(function () {
    'use strict';

    const PAYMENT_TIMEOUT_MS = 180000;
    const APPROVE_RETRIES = 2;
    const APPROVE_RETRY_MS = 1500;

    if (window.__GAV_PAYMENT_LOADED__ === true) return;
    window.__GAV_PAYMENT_LOADED__ = true;

    const state = { inFlight: false, pendingPaymentId: null, lastResult: null };

    function safeLog(level, msg, data) {
        if (!window.console) return;
        const fn = console[level] || console.log;
        if (data !== undefined) fn.call(console, '[GAV/payment] ' + msg, data);
        else fn.call(console, '[GAV/payment] ' + msg);
    }

    function isPositive(n) { return typeof n === 'number' && isFinite(n) && n > 0; }

    function toPiString(amount) {
        const n = Number(amount);
        if (!isFinite(n) || n <= 0) return null;
        return n.toFixed(7).replace(/\.?0+$/, '');
    }

    function isPiReady() {
        return typeof window.Pi !== 'undefined' && window.Pi !== null &&
               typeof window.Pi.createPayment === 'function' &&
               window.__GAV_PI_READY__ === true;
    }

    function notify(type, msg) {
        if (typeof window.showToast === 'function') {
            try { window.showToast(type, msg); return; } catch (_) {}
        }
        safeLog(type === 'error' ? 'error' : 'info', msg);
    }

    function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

    async function createPaymentOnServer(payload) {
        const res = await window.GavApi.withAuth(function () {
            return window.GavApi.endpoints.createPayment(payload);
        });
        if (!res || !res.ok) return { ok: false, error: (res && res.error) || 'تعذّر إنشاء الدفع.' };

        const data = res.data || {};
        const id = data.paymentId || data.identifier || null;
        if (!id) return { ok: false, error: 'استجابة خادم غير صالحة.' };
        return { ok: true, paymentId: id, amount: data.amount, memo: data.memo, metadata: data.metadata || {} };
    }

    async function approvePaymentOnServer(paymentId) {
        let attempt = 0, lastErr = null;
        while (attempt <= APPROVE_RETRIES) {
            const res = await window.GavApi.withAuth(function () {
                return window.GavApi.endpoints.approvePayment(paymentId);
            });
            if (res && res.ok) return { ok: true };
            lastErr = (res && res.error) || 'فشل اعتماد الدفع.';
            attempt++;
            if (attempt <= APPROVE_RETRIES) await sleep(APPROVE_RETRY_MS);
        }
        return { ok: false, error: lastErr };
    }

    async function completePaymentOnServer(paymentId, txid) {
        if (!paymentId || !txid) return { ok: false, error: 'بيانات غير مكتملة.' };
        const res = await window.GavApi.withAuth(function () {
            return window.GavApi.endpoints.completePayment(paymentId, txid);
        });
        if (!res || !res.ok) return { ok: false, error: (res && res.error) || 'فشل الإكمال.' };
        return { ok: true, data: res.data || {} };
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

        if (currency !== 'PI') return { ok: false, error: 'العملة غير مدعومة. GAV يقبل Pi فقط.' };
        if (!items.length) return { ok: false, error: 'السلة فارغة.' };
        if (!isPositive(total)) return { ok: false, error: 'المبلغ غير صالح.' };

        if (!window.GavApi || !window.GavApi.hasSession || !window.GavApi.hasSession()) {
            notify('warning', 'الرجاء تسجيل الدخول أولاً.');
            return { ok: false, error: 'يجب تسجيل الدخول.' };
        }
        if (!isPiReady()) {
            notify('error', 'Pi SDK غير جاهز. افتح التطبيق في Pi Browser.');
            return { ok: false, error: 'Pi SDK غير جاهز.' };
        }

        state.inFlight = true;

        const amountStr = toPiString(total);
        if (!amountStr) { state.inFlight = false; return { ok: false, error: 'تعذّر حساب المبلغ.' }; }

        const memo = ('GAV/' + source + ' — ' + amountStr + ' π').slice(0, 200);
        const metadata = {
            source: source,
            currency: 'PI',
            items: items,
            total: Number(amountStr),
            createdAt: Date.now()
        };

        const created = await createPaymentOnServer({
            amount: Number(amountStr),
            memo: memo,
            metadata: metadata,
            currency: 'PI'
        });

        if (!created.ok) {
            state.inFlight = false;
            notify('error', created.error || 'فشل إنشاء الدفع.');
            return { ok: false, error: created.error };
        }

        const paymentId = created.paymentId;
        state.pendingPaymentId = paymentId;
        safeLog('info', 'Payment created: ' + paymentId);

        return await new Promise(function (resolve) {
            let settled = false;

            function finalize(result) {
                if (settled) return;
                settled = true;
                state.inFlight = false;
                if (result.ok) state.pendingPaymentId = null;
                state.lastResult = result;
                resolve(result);
            }

            const hardTimer = setTimeout(function () {
                if (!settled) {
                    notify('error', 'انتهت مهلة الدفع.');
                    finalize({ ok: false, error: 'انتهت المهلة.' });
                }
            }, PAYMENT_TIMEOUT_MS);

            window.__GAV_PAYMENT_BRIDGE__ = function (txid) {
                if (!txid) return;
                safeLog('info', 'Bridge txid: ' + txid);
                completePaymentOnServer(paymentId, txid).then(function (cp) {
                    clearTimeout(hardTimer);
                    if (!cp.ok) {
                        notify('error', cp.error || 'فشل الإكمال.');
                        finalize({ ok: false, paymentId: paymentId, txid: txid, error: cp.error });
                        return;
                    }
                    notify('success', 'تم إتمام الدفع 🎉');
                    finalize({ ok: true, paymentId: paymentId, txid: txid, data: cp.data });
                }).catch(function (err) {
                    clearTimeout(hardTimer);
                    finalize({ ok: false, paymentId: paymentId, txid: txid, error: 'خطأ الإكمال.' });
                });
            };

            try {
                window.Pi.createPayment(
                    {
                        amount: Number(amountStr),
                        memo: memo,
                        metadata: metadata
                    },
                    {
                        onReadyForServerApproval: function () {
                            safeLog('info', 'onReadyForServerApproval');
                            approvePaymentOnServer(paymentId).then(function (ap) {
                                if (!ap.ok) {
                                    notify('error', ap.error || 'فشل الاعتماد.');
                                    clearTimeout(hardTimer);
                                    finalize({ ok: false, error: ap.error, paymentId: paymentId });
                                }
                            }).catch(function (err) {
                                safeLog('error', 'approve threw:', err);
                                clearTimeout(hardTimer);
                                finalize({ ok: false, error: 'خطأ الاعتماد.', paymentId: paymentId });
                            });
                        },
                        onReadyForServerCompletion: function (pid, txid) {
                            safeLog('info', 'onReadyForServerCompletion: ' + txid);
                            if (typeof window.__GAV_PAYMENT_BRIDGE__ === 'function') {
                                window.__GAV_PAYMENT_BRIDGE__(txid);
                            }
                        },
                        onCancel: function () {
                            safeLog('warn', 'onCancel');
                            notify('info', 'تم إلغاء الدفع.');
                            clearTimeout(hardTimer);
                            finalize({ ok: false, cancelled: true, paymentId: paymentId, error: 'تم الإلغاء.' });
                        },
                        onError: function (err) {
                            safeLog('error', 'onError:', err);
                            const msg = (err && err.message) ? String(err.message).slice(0, 200) : 'فشل الدفع.';
                            notify('error', 'فشل: ' + msg);
                            clearTimeout(hardTimer);
                            finalize({ ok: false, error: msg, paymentId: paymentId });
                        }
                    }
                );
            } catch (err) {
                safeLog('error', 'Pi.createPayment threw:', err);
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
            const cp = await completePaymentOnServer(paymentId, txid);
            if (cp.ok) notify('success', 'تم إنهاء دفع سابق.');
            return cp;
        }

        try {
            const res = await window.GavApi.endpoints.reconcilePayment(paymentId, null);
            if (res && res.ok) notify('info', 'تمت مزامنة دفع سابق.');
            return res || { ok: false };
        } catch (err) {
            safeLog('error', 'reconcile failed:', err);
            return { ok: false, error: 'تعذّرت المزامنة.' };
        }
    }

    window.GavPayment = Object.freeze({
        init: function () { /* stateless */ },
        startCheckout: startCheckout,
        reconcile: reconcile,
        isBusy: function () { return state.inFlight === true; },
        pendingPaymentId: function () { return state.pendingPaymentId; },
        lastResult: function () { return state.lastResult; }
    });

    safeLog('info', 'Payment module ready.');
})();