/* ============================================================
   GAV – The Incense Route
   Module: Pi Payment Flow (Client Orchestrator)
   Path:   public/js/modules/payment.js

   PURPOSE:
     - Provide GavPayment.startCheckout() used by POS / marketplace.
     - Orchestrate Pi.createPayment() with the official 3-phase
       server-side flow:

         1) Pi.createPayment() opens the Pi payment sheet.
         2) onReady → POST /api/v1/payments        (server creates & approves)
         3) onReady → POST /api/v1/payments/:id/approve  (server signs)
         4) User confirms in Pi Browser → onReady → we call
              POST /api/v1/payments/:id/complete   with txid
         5) onCancel / onError handled with Arabic messages.

     - Provide GavPayment.reconcile(payment) for
       onIncompletePaymentFound() callbacks.

   HARD RULES (Pi Compliance):
     - Pi-only. No GCV. No YER. No fiat. No conversion.
     - Approval + completion MUST happen server-side.
     - Client NEVER calls Pi.approvePayment / Pi.completePayment directly.
     - Client NEVER trusts amount/user from local storage.
     - Client NEVER invents txid.

   CONSTRAINTS:
     - No direct fetch() — always through GavApi.
     - Guarded against double submission.
     - Guarded against duplicate paymentId creation.
     - All UI text Arabic.
   ============================================================ */

(function () {
    'use strict';

    /* --------------------------------------------
       Constants
       -------------------------------------------- */
    const PAYMENT_TIMEOUT_MS = 180000; // 3 min hard cap
    const APPROVE_RETRIES    = 2;
    const APPROVE_RETRY_MS   = 1500;

    /* --------------------------------------------
       Duplicate-load guard
       -------------------------------------------- */
    if (window.__GAV_PAYMENT_LOADED__ === true) {
        if (window.console && console.warn) {
            console.warn('[GAV/payment] Module already loaded — skipping.');
        }
        return;
    }
    window.__GAV_PAYMENT_LOADED__ = true;

    /* --------------------------------------------
       State
       -------------------------------------------- */
    const state = {
        inFlight: false,
        pendingPaymentId: null,
        lastResult: null
    };

    /* --------------------------------------------
       Utilities
       -------------------------------------------- */
    function safeLog(level, msg, data) {
        if (!window.console) return;
        const fn = console[level] || console.log;
        if (data !== undefined) fn.call(console, '[GAV/payment] ' + msg, data);
        else                     fn.call(console, '[GAV/payment] ' + msg);
    }

    function isFinitePositive(n) {
        return typeof n === 'number' && isFinite(n) && n > 0;
    }

    function toPiString(amount) {
        // Pi SDK expects a decimal string with up to 7 decimals.
        const n = Number(amount);
        if (!isFinite(n) || n <= 0) return null;
        return n.toFixed(7).replace(/\.?0+$/, '');
    }

    function isPiReady() {
        return typeof window.Pi !== 'undefined' &&
               window.Pi !== null &&
               typeof window.Pi.createPayment === 'function' &&
               window.__GAV_PI_READY__ === true;
    }

    function makeMemo(source, total) {
        const src = String(source || 'gav').slice(0, 12);
        return 'GAV/' + src + ' — ' + toPiString(total) + ' π';
    }

    function sleep(ms) {
        return new Promise(function (r) { setTimeout(r, ms); });
    }

    /* --------------------------------------------
       Toast helpers (graceful if UI not ready)
       -------------------------------------------- */
    function notify(type, message) {
        if (typeof window.showToast === 'function') {
            try { window.showToast(type, message); return; } catch (_) {}
        }
        safeLog(type === 'error' ? 'error' : 'info', message);
    }

    /* --------------------------------------------
       Phase 1: Create payment on server
       Server calls Pi API /v2/payments (with API key)
       and returns { paymentId, amount, memo, metadata }
       -------------------------------------------- */
    async function createPaymentOnServer(payload) {
        const res = await window.GavApi.withAuth(function () {
            return window.GavApi.endpoints.createPayment(payload);
        });

        if (!res || !res.ok) {
            return {
                ok: false,
                error: (res && res.error) || 'تعذّر إنشاء طلب الدفع على الخادم.'
            };
        }

        const data = res.data || {};
        const paymentId = data.paymentId || data.identifier || null;

        if (!paymentId) {
            return {
                ok: false,
                error: 'استجابة خادم غير صالحة عند إنشاء الدفع.'
            };
        }

        return {
            ok: true,
            paymentId: paymentId,
            amount: data.amount,
            memo: data.memo,
            metadata: data.metadata || {}
        };
    }

    /* --------------------------------------------
       Phase 2: Approve payment on server
       Server calls Pi API /v2/payments/:id/approve
       (Client never calls Pi.approvePayment directly.)
       -------------------------------------------- */
    async function approvePaymentOnServer(paymentId) {
        let attempt = 0;
        let lastErr = null;

        while (attempt <= APPROVE_RETRIES) {
            const res = await window.GavApi.withAuth(function () {
                return window.GavApi.endpoints.approvePayment(paymentId);
            });

            if (res && res.ok) return { ok: true };

            lastErr = (res && res.error) || 'فشل اعتماد الدفع على الخادم.';
            attempt++;

            if (attempt <= APPROVE_RETRIES) {
                safeLog('warn', 'approve retry #' + attempt + ' — ' + lastErr);
                await sleep(APPROVE_RETRY_MS);
            }
        }

        return { ok: false, error: lastErr };
    }

    /* --------------------------------------------
       Phase 3: Complete payment on server
       Server calls Pi API /v2/payments/:id/complete
       with the txid returned by the Pi SDK.
       -------------------------------------------- */
    async function completePaymentOnServer(paymentId, txid) {
        if (!paymentId || !txid) {
            return { ok: false, error: 'بيانات إكمال الدفع غير مكتملة.' };
        }

        const res = await window.GavApi.withAuth(function () {
            return window.GavApi.endpoints.completePayment(paymentId, txid);
        });

        if (!res || !res.ok) {
            return {
                ok: false,
                error: (res && res.error) || 'فشل إكمال الدفع على الخادم.'
            };
        }

        return { ok: true, data: res.data || {} };
    }

    /* --------------------------------------------
       Legacy endpoint: /api/auth/verify fallback
       Some deployments proxy through BIGISH-YER.
       -------------------------------------------- */
    async function legacyVerifyFallback(accessToken) {
        try {
            const s = window.GavAuth && typeof window.GavAuth.getSession === 'function'
                ? window.GavAuth.getSession()
                : null;
            const token = accessToken || (s && s.accessToken);
            if (!token) return { ok: false, error: 'لا توجد جلسة موثقة.' };

            const res = await window.GavApi.endpoints.verifyAuth(token);
            if (!res || !res.ok) {
                return { ok: false, error: (res && res.error) || 'فشل التحقق من الجلسة.' };
            }
            return { ok: true };
        } catch (err) {
            safeLog('error', 'legacyVerifyFallback failed:', err);
            return { ok: false, error: 'تعذّر التحقق من الجلسة.' };
        }
    }

    /* --------------------------------------------
       MAIN: startCheckout()
       Called by GavPos / GavMarketplace / any caller.

       options = {
         source:   'pos' | 'marketplace' | 'barter' | ...,
         cart:     [{ id, name, price, qty }],
         total:    number (Pi),
         currency: 'PI'  // must be PI; anything else rejected
       }
       -------------------------------------------- */
    async function startCheckout(options) {
        options = options || {};

        // 1) Global lock
        if (state.inFlight) {
            safeLog('warn', 'Checkout already in progress — ignoring duplicate.');
            return { ok: false, error: 'عملية دفع أخرى قيد التنفيذ.' };
        }

        // 2) Validate options
        const source   = String(options.source || 'gav');
        const currency = String(options.currency || 'PI').toUpperCase();
        const cart     = Array.isArray(options.cart) ? options.cart : [];
        const total    = Number(options.total);

        if (currency !== 'PI') {
            return { ok: false, error: 'العملة غير مدعومة. GAV يقبل Pi فقط.' };
        }
        if (!cart.length) {
            return { ok: false, error: 'السلة فارغة.' };
        }
        if (!isFinitePositive(total)) {
            return { ok: false, error: 'المبلغ الكلي غير صالح.' };
        }

        // 3) Ensure verified session
        if (!window.GavApi || !window.GavApi.hasSession || !window.GavApi.hasSession()) {
            notify('warning', 'الرجاء تسجيل الدخول بحساب Pi أولاً.');
            return { ok: false, error: 'يجب تسجيل الدخول أولاً.' };
        }

        // 4) Ensure Pi SDK ready
        if (!isPiReady()) {
            notify('error', 'Pi SDK غير جاهز. افتح التطبيق في Pi Browser.');
            return { ok: false, error: 'Pi SDK غير جاهز.' };
        }

        // 5) Enter critical section
        state.inFlight = true;

        // Normalize cart → metadata items
        const items = cart.map(function (it) {
            return {
                id:    String(it.id || ''),
                name:  String(it.name || 'منتج'),
                qty:   Number(it.qty)   || 0,
                price: Number(it.price) || 0
            };
        });

        const amountStr = toPiString(total);
        if (!amountStr) {
            state.inFlight = false;
            return { ok: false, error: 'تعذّر حساب مبلغ Pi.' };
        }

        const memo = makeMemo(source, total);

        const metadataPayload = {
            source:   source,
            currency: 'PI',
            items:    items,
            total:    Number(amountStr),
            createdAt: Date.now()
        };

        // 6) Phase 1: ask server to create the payment
        const created = await createPaymentOnServer({
            amount:   Number(amountStr),
            memo:     memo,
            metadata: metadataPayload
        });

        if (!created.ok) {
            state.inFlight = false;
            notify('error', created.error || 'فشل إنشاء الدفع.');
            return { ok: false, error: created.error };
        }

        const paymentId = created.paymentId;
        state.pendingPaymentId = paymentId;

        safeLog('info', 'Payment created on server: ' + paymentId);

        // 7) Hand off to Pi SDK — the browser sheet opens
        return await new Promise(function (resolve) {
            let settled = false;

            function finalize(result) {
                if (settled) return;
                settled = true;
                state.inFlight = false;
                if (result.ok) {
                    state.pendingPaymentId = null;
                }
                state.lastResult = result;
                resolve(result);
            }

            // Hard timeout guard
            const hardTimer = setTimeout(function () {
                if (!settled) {
                    notify('error', 'انتهت مهلة عملية الدفع. تحقق من سجل المعاملات.');
                    finalize({ ok: false, error: 'انتهت مهلة الدفع.' });
                }
            }, PAYMENT_TIMEOUT_MS);

            try {
                window.Pi.createPayment(
                    {
                        amount:   Number(amountStr),
                        memo:     memo,
                        metadata: metadataPayload
                    },
                    {
                        // ---- onReady: user approved; we must approve server-side ----
                        onReady: function () {
                            safeLog('info', 'Pi sheet ready. Approving on server...');

                            approvePaymentOnServer(paymentId).then(function (ap) {
                                if (!ap.ok) {
                                    notify('error', ap.error || 'فشل اعتماد الدفع.');
                                    clearTimeout(hardTimer);
                                    finalize({ ok: false, error: ap.error, paymentId: paymentId });
                                    return;
                                }
                                safeLog('info', 'Server approve OK for ' + paymentId);
                                // Wait for onReady→onCancel/onError/complete via SDK.
                            }).catch(function (err) {
                                safeLog('error', 'approve promise threw:', err);
                                notify('error', 'خطأ في اعتماد الدفع على الخادم.');
                                clearTimeout(hardTimer);
                                finalize({ ok: false, error: 'خطأ اعتماد الدفع.', paymentId: paymentId });
                            });
                        },

                        // ---- onCancel: user dismissed the sheet ----
                        onCancel: function () {
                            safeLog('warn', 'User cancelled Pi payment sheet.');
                            notify('info', 'تم إلغاء عملية الدفع.');
                            clearTimeout(hardTimer);
                            finalize({
                                ok: false,
                                cancelled: true,
                                paymentId: paymentId,
                                error: 'تم الإلغاء.'
                            });
                        },

                        // ---- onError: SDK-level failure ----
                        onError: function (err) {
                            safeLog('error', 'Pi.createPayment onError:', err);
                            const msg = (err && err.message)
                                ? String(err.message).slice(0, 200)
                                : 'فشلت عملية الدفع.';
                            notify('error', 'فشل الدفع: ' + msg);
                            clearTimeout(hardTimer);
                            finalize({ ok: false, error: msg, paymentId: paymentId });
                        }
                    }
                );

                // ---- Post-creation async flow ----
                // The Pi SDK will drive onReady/onCancel/onError.
                // We also need to detect the transaction-completion callback,
                // which arrives through the returned object in newer SDK versions.

            } catch (err) {
                safeLog('error', 'Pi.createPayment threw:', err);
                clearTimeout(hardTimer);
                notify('error', 'تعذّر فتح نافذة الدفع.');
                finalize({ ok: false, error: 'تعذّر فتح نافذة الدفع.' });
            }

            // ---- Bridge for SDK "complete" callbacks ----
            // The Pi SDK resolves completion via a separate mechanism
            // (transactionId passed to onReady historically; in SDK 2.0
            // the transaction is delivered through the returned promise/object).
            // We expose a hook the SDK-side wrapper can call.
            window.__GAV_PAYMENT_BRIDGE__ = function (txid) {
                if (!txid) return;
                safeLog('info', 'Bridge txid received: ' + txid);
                completePaymentOnServer(paymentId, txid).then(function (cp) {
                    if (!cp.ok) {
                        notify('error', cp.error || 'فشل إكمال الدفع على الخادم.');
                        clearTimeout(hardTimer);
                        finalize({
                            ok: false,
                            paymentId: paymentId,
                            txid: txid,
                            error: cp.error
                        });
                        return;
                    }
                    notify('success', 'تم إتمام الدفع بنجاح 🎉');
                    clearTimeout(hardTimer);
                    finalize({
                        ok: true,
                        paymentId: paymentId,
                        txid: txid,
                        data: cp.data
                    });
                }).catch(function (err) {
                    safeLog('error', 'complete promise threw:', err);
                    clearTimeout(hardTimer);
                    finalize({
                        ok: false,
                        paymentId: paymentId,
                        txid: txid,
                        error: 'خطأ إكمال الدفع.'
                    });
                });
            };
        });
    }

    /* --------------------------------------------
       Reconcile incomplete payment
       Called from pi-auth.onIncompletePaymentFound().
       -------------------------------------------- */
    async function reconcile(payment) {
        if (!payment || !payment.identifier) {
            safeLog('warn', 'reconcile: missing payment identifier.');
            return { ok: false, error: 'بيانات غير مكتملة.' };
        }

        const paymentId = payment.identifier;
        const txid = payment.transaction && payment.transaction.txid
            ? payment.transaction.txid
            : null;

        safeLog('info', 'Reconciling incomplete payment: ' + paymentId + ' txid=' + (txid || '—'));

        // If already completed, tell server to record and finish.
        if (txid) {
            const cp = await completePaymentOnServer(paymentId, txid);
            if (cp.ok) {
                notify('success', 'تم إنهاء دفع سابق غير مكتمل.');
                return cp;
            }
            notify('warning', 'تعذّر إنهاء دفع سابق. سيُعاد المحاولة.');
            return cp;
        }

        // No txid yet: ask server to reconcile.
        try {
            const res = await window.GavApi.endpoints.reconcilePayment(paymentId, null);
            if (res && res.ok) {
                notify('info', 'تمت مزامنة دفع سابق مع الخادم.');
                return { ok: true };
            }
            return { ok: false, error: (res && res.error) || 'تعذّرت المزامنة.' };
        } catch (err) {
            safeLog('error', 'reconcile dispatch failed:', err);
            return { ok: false, error: 'تعذّر الاتصال بالخادم.' };
        }
    }

    /* --------------------------------------------
       Public API
       -------------------------------------------- */
    window.GavPayment = Object.freeze({
        init:            function () { /* stateless */ },
        startCheckout:   startCheckout,
        reconcile:       reconcile,
        isBusy:          function () { return state.inFlight === true; },
        pendingPaymentId: function () { return state.pendingPaymentId; },
        lastResult:      function () { return state.lastResult; }
    });

    /* --------------------------------------------
       Safety: clear bridge on unload
       -------------------------------------------- */
    window.addEventListener('beforeunload', function () {
        try { delete window.__GAV_PAYMENT_BRIDGE__; } catch (_) {}
    }, false);

    if (window.console && console.info) {
        console.info('[GAV/payment] Ready. Pi-only flow with server-side approve/complete.');
    }

})();