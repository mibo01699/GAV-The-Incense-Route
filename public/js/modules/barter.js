/* ============================================================
   GAV – The Incense Route
   Module: Barter Festivals
   Path:   public/js/modules/barter.js

   PURPOSE:
     - List barter festivals from the server.
     - Show festival details, participants, offers, and windows.
     - Join / Leave a festival (server-verified).
     - NEVER performs any currency transaction.
     - Barter is goods-for-goods only (no Pi price fields here).

   ENDPOINTS USED (via GavApi.endpoints):
     - listBarterEvents()   → GET  /api/v1/barter/festivals
     - joinBarterEvent(id)  → POST /api/v1/barter/festivals/:id/offers
     - leaveBarterEvent(id) → POST /api/v1/barter/festivals/:id/leave

   CONSTRAINTS:
     - No direct fetch() — always through GavApi.endpoints.
     - No GCV, no YER, no fiat. No price fields anywhere here.
     - Server-verified identity via GavApi.withAuth() for joins.
     - UI updates only after server confirmation.
     - XSS-safe: all rendered text goes through escapeHtml().
     - Graceful handling if the server has not yet implemented
       some endpoints (404 → friendly Arabic empty state).
   ============================================================ */

(function () {
    'use strict';

    /* --------------------------------------------
       Constants
       -------------------------------------------- */
    const VIEW_NAME        = 'barter';
    const CONTAINER_ID     = 'barter-events';

    const STATUS_LABELS = Object.freeze({
        upcoming: 'قادمة',
        open:     'مفتوحة',
        active:   'جارية',
        closed:   'مغلقة',
        ended:    'انتهت',
        cancelled:'ملغاة'
    });

    const STATUS_VARIANTS = Object.freeze({
        upcoming:  'info',
        open:      'success',
        active:    'success',
        closed:    'danger',
        ended:     'danger',
        cancelled: 'danger'
    });

    /* --------------------------------------------
       Duplicate-load guard
       -------------------------------------------- */
    if (window.__GAV_BARTER_LOADED__ === true) {
        if (window.console && console.warn) {
            console.warn('[GAV/barter] Module already loaded — skipping.');
        }
        return;
    }
    window.__GAV_BARTER_LOADED__ = true;

    /* --------------------------------------------
       State
       -------------------------------------------- */
    const state = {
        events:        [],
        loading:       false,
        loadedOnce:    false,
        loadError:     null,
        endpointMissing: false,   // set true on 404 from server
        busyIds:       {}         // { festivalId: true } during join/leave
    };

    /* --------------------------------------------
       Utilities
       -------------------------------------------- */
    function safeLog(level, msg, data) {
        if (!window.console) return;
        const fn = console[level] || console.log;
        if (data !== undefined) fn.call(console, '[GAV/barter] ' + msg, data);
        else                     fn.call(console, '[GAV/barter] ' + msg);
    }

    function $(id) { return document.getElementById(id); }

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatDate(iso) {
        if (!iso) return '—';
        try {
            const d = new Date(iso);
            if (isNaN(d.getTime())) return '—';
            const yyyy = d.getFullYear();
            const mm   = String(d.getMonth() + 1).padStart(2, '0');
            const dd   = String(d.getDate()).padStart(2, '0');
            const hh   = String(d.getHours()).padStart(2, '0');
            const mi   = String(d.getMinutes()).padStart(2, '0');
            return yyyy + '/' + mm + '/' + dd + ' · ' + hh + ':' + mi;
        } catch (_) {
            return '—';
        }
    }

    function formatWindow(startIso, endIso) {
        const s = formatDate(startIso);
        const e = formatDate(endIso);
        if (s === '—' && e === '—') return 'غير محدد';
        if (s === '—') return 'حتى ' + e;
        if (e === '—') return 'من ' + s;
        return s + ' → ' + e;
    }

    function statusLabel(status) {
        if (!status) return '—';
        return STATUS_LABELS[status] || String(status);
    }

    function statusVariant(status) {
        if (!status) return 'info';
        return STATUS_VARIANTS[status] || 'info';
    }

    /**
     * Normalize different possible server response shapes into an array.
     * Accepts:
     *   [ ... ]
     *   { festivals: [...] }
     *   { events: [...] }
     *   { data: [...] }
     *   { data: { festivals: [...] } }
     */
    function normalizeEvents(data) {
        if (!data) return [];
        if (Array.isArray(data)) return data;
        if (Array.isArray(data.festivals)) return data.festivals;
        if (Array.isArray(data.events))    return data.events;
        if (data.data) {
            if (Array.isArray(data.data)) return data.data;
            if (Array.isArray(data.data.festivals)) return data.data.festivals;
            if (Array.isArray(data.data.events))    return data.data.events;
        }
        return [];
    }

    /* --------------------------------------------
       Renderers
       -------------------------------------------- */
    function renderLoading() {
        const wrap = $(CONTAINER_ID);
        if (!wrap) return;
        wrap.innerHTML =
            '<div class="empty-state">' +
                '<p>جاري تحميل مهرجانات المقايضة...</p>' +
            '</div>';
    }

    function renderEmpty(customMsg) {
        const wrap = $(CONTAINER_ID);
        if (!wrap) return;
        const msg = customMsg || 'لا توجد فعاليات مقايضة حالياً.';
        wrap.innerHTML =
            '<div class="empty-state">' +
                '<p>' + escapeHtml(msg) + '</p>' +
            '</div>';
    }

    function renderError(msg) {
        const wrap = $(CONTAINER_ID);
        if (!wrap) return;
        wrap.innerHTML =
            '<div class="empty-state">' +
                '<p>' + escapeHtml(msg || 'تعذّر تحميل الفعاليات.') + '</p>' +
            '</div>';
    }

    function renderNotAvailable() {
        const wrap = $(CONTAINER_ID);
        if (!wrap) return;
        wrap.innerHTML =
            '<div class="empty-state">' +
                '<p>خدمة مهرجانات المقايضة قيد التفعيل على الخادم.</p>' +
                '<p class="text-muted" style="margin-top:0.5rem;font-size:0.85rem;">' +
                    'يرجى المحاولة لاحقاً.' +
                '</p>' +
            '</div>';
    }

    function renderEventItem(ev) {
        if (!ev || typeof ev !== 'object') return '';

        const id       = escapeHtml(ev.id || ev.festivalId || '');
        const name     = escapeHtml(ev.name || ev.title || 'فعالية مقايضة');
        const location = escapeHtml(ev.location || ev.place || '—');
        const window_  = escapeHtml(formatWindow(
                            ev.startAt || ev.startsAt,
                            ev.endAt   || ev.endsAt
                        ));
        const status   = ev.status || 'upcoming';

        const participants = Number(
            ev.participantsCount ||
            ev.participants      ||
            (Array.isArray(ev.participants) ? ev.participants.length : 0)
        ) || 0;

        const offeredCount = Array.isArray(ev.offeredItems)
            ? ev.offeredItems.length
            : (Array.isArray(ev.offers) ? ev.offers.length : 0);

        const wantedCount = Array.isArray(ev.wantedItems)
            ? ev.wantedItems.length
            : 0;

        const isJoined = ev.joined === true ||
                         ev.isJoined === true ||
                         ev.myParticipation === 'joined';

        const isClosed = (status === 'closed' ||
                          status === 'ended' ||
                          status === 'cancelled');

        const badge = '<span class="badge badge-' +
            statusVariant(status) + '">' +
            escapeHtml(statusLabel(status)) +
            '</span>';

        let actionBtn = '';
        if (isClosed) {
            actionBtn = '<button class="btn btn-secondary" disabled>مغلقة</button>';
        } else if (isJoined) {
            actionBtn = '<button class="btn btn-secondary" ' +
                        'data-barter-leave="' + id + '">مغادرة</button>';
        } else {
            actionBtn = '<button class="btn btn-primary" ' +
                        'data-barter-join="' + id + '">انضم</button>';
        }

        return '' +
            '<div class="list-item" data-event-id="' + id + '">' +
                '<div class="list-item-icon">🔄</div>' +
                '<div class="list-item-body">' +
                    '<div class="list-item-title">' + name + ' ' + badge + '</div>' +
                    '<div class="list-item-subtitle">📍 ' + location + ' · 🗓 ' + window_ + '</div>' +
                    '<div class="list-item-subtitle">' +
                        '👥 ' + participants + ' مشارك · ' +
                        '📦 معروض: ' + offeredCount + ' · ' +
                        '🎯 مطلوب: ' + wantedCount +
                    '</div>' +
                '</div>' +
                '<div class="list-item-meta">' +
                    actionBtn +
                '</div>' +
            '</div>';
    }

    function renderEvents() {
        const wrap = $(CONTAINER_ID);
        if (!wrap) return;

        if (state.endpointMissing) {
            renderNotAvailable();
            return;
        }
        if (!state.events.length) {
            renderEmpty();
            return;
        }
        wrap.innerHTML = state.events.map(renderEventItem).join('');
    }

    /* --------------------------------------------
       Data fetch
       -------------------------------------------- */
    async function loadEvents(options) {
        options = options || {};
        if (state.loading) return;
        if (!options.force && state.loadedOnce) return;

        if (!window.GavApi || !window.GavApi.endpoints ||
            typeof window.GavApi.endpoints.listBarterEvents !== 'function') {
            renderError('خدمة المقايضة غير جاهزة.');
            return;
        }

        state.loading = true;
        state.loadError = null;
        renderLoading();

        let res;
        try {
            res = await window.GavApi.endpoints.listBarterEvents();
        } catch (err) {
            state.loading = false;
            safeLog('error', 'loadEvents threw:', err);
            renderError('تعذّر الاتصال بخادم GAV.');
            return;
        }

        state.loading = false;

        if (!res || !res.ok) {
            const status = res && res.status;

            if (status === 404) {
                // Endpoint not yet implemented — this is expected and safe.
                state.endpointMissing = true;
                state.loadedOnce = true;
                renderNotAvailable();
                safeLog('info', 'barter/festivals endpoint not yet available (404).');
                return;
            }

            state.loadError = (res && res.error) || 'تعذّر تحميل الفعاليات.';
            renderError(state.loadError);
            safeLog('warn', 'loadEvents failed:', res);
            return;
        }

        state.events = normalizeEvents(res.data);
        state.loadedOnce = true;
        state.endpointMissing = false;

        renderEvents();
        safeLog('info', 'Loaded ' + state.events.length + ' barter festival(s).');
    }

    /* --------------------------------------------
       Join
       -------------------------------------------- */
    async function joinEvent(eventId) {
        if (!eventId) return;
        if (state.busyIds[eventId]) return;

        if (!window.GavApi || !window.GavApi.endpoints ||
            typeof window.GavApi.endpoints.joinBarterEvent !== 'function') {
            if (typeof window.showToast === 'function') {
                window.showToast('error', 'خدمة المقايضة غير جاهزة.');
            }
            return;
        }

        state.busyIds[eventId] = true;

        const res = await window.GavApi.withAuth(function () {
            return window.GavApi.endpoints.joinBarterEvent(eventId);
        });

        delete state.busyIds[eventId];

        if (!res || !res.ok) {
            const status = res && res.status;

            if (status === 404) {
                if (typeof window.showToast === 'function') {
                    window.showToast('warning',
                        'خدمة الانضمام قيد التفعيل على الخادم.');
                }
                return;
            }
            if (status === 401) {
                // withAuth already triggered overlay
                return;
            }
            if (typeof window.showToast === 'function') {
                window.showToast('error',
                    (res && res.error) || 'تعذّر الانضمام للفعالية.');
            }
            return;
        }

        if (typeof window.showToast === 'function') {
            window.showToast('success', 'تم الانضمام إلى الفعالية.');
        }

        // Update local state (server is source of truth; we reflect)
        state.events = state.events.map(function (ev) {
            const id = ev.id || ev.festivalId;
            if (id === eventId) {
                const count = Number(
                    ev.participantsCount ||
                    ev.participants ||
                    0
                );
                return Object.assign({}, ev, {
                    joined: true,
                    isJoined: true,
                    participantsCount: count + 1
                });
            }
            return ev;
        });

        renderEvents();
    }

    /* --------------------------------------------
       Leave
       -------------------------------------------- */
    async function leaveEvent(eventId) {
        if (!eventId) return;
        if (state.busyIds[eventId]) return;

        if (!window.GavApi || !window.GavApi.endpoints ||
            typeof window.GavApi.endpoints.leaveBarterEvent !== 'function') {
            if (typeof window.showToast === 'function') {
                window.showToast('error', 'خدمة المقايضة غير جاهزة.');
            }
            return;
        }

        const confirmed = window.confirm('هل أنت متأكد من مغادرة الفعالية؟');
        if (!confirmed) return;

        state.busyIds[eventId] = true;

        const res = await window.GavApi.withAuth(function () {
            return window.GavApi.endpoints.leaveBarterEvent(eventId);
        });

        delete state.busyIds[eventId];

        if (!res || !res.ok) {
            const status = res && res.status;

            if (status === 404) {
                if (typeof window.showToast === 'function') {
                    window.showToast('warning',
                        'خدمة المغادرة قيد التفعيل على الخادم.');
                }
                return;
            }
            if (status === 401) return;

            if (typeof window.showToast === 'function') {
                window.showToast('error',
                    (res && res.error) || 'تعذّرت المغادرة.');
            }
            return;
        }

        if (typeof window.showToast === 'function') {
            window.showToast('info', 'تم تسجيل مغادرتك للفعالية.');
        }

        state.events = state.events.map(function (ev) {
            const id = ev.id || ev.festivalId;
            if (id === eventId) {
                const count = Math.max(0, Number(
                    ev.participantsCount ||
                    ev.participants ||
                    0
                ) - 1);
                return Object.assign({}, ev, {
                    joined: false,
                    isJoined: false,
                    participantsCount: count
                });
            }
            return ev;
        });

        renderEvents();
    }

    /* --------------------------------------------
       Event handlers
       -------------------------------------------- */
    function onContainerClick(e) {
        const joinBtn  = e.target.closest
            ? e.target.closest('[data-barter-join]')
            : null;
        const leaveBtn = e.target.closest
            ? e.target.closest('[data-barter-leave]')
            : null;

        if (joinBtn) {
            const id = joinBtn.getAttribute('data-barter-join');
            if (id) joinEvent(id);
            return;
        }
        if (leaveBtn) {
            const id = leaveBtn.getAttribute('data-barter-leave');
            if (id) leaveEvent(id);
        }
    }

    function onViewChange(e) {
        const to = e && e.detail ? e.detail.to : null;
        if (to === VIEW_NAME) {
            loadEvents({ force: false });
        }
    }

    function onAuthLogout() {
        state.events = [];
        state.loadedOnce = false;
        state.loadError = null;
        state.endpointMissing = false;
        state.busyIds = {};
        renderEmpty();
    }

    function onAuthSuccess() {
        // Force reload after login so "joined" flags are up to date.
        if (state.loadedOnce) {
            state.loadedOnce = false;
            const currentView = window.GavRouter && window.GavRouter.current
                ? window.GavRouter.current()
                : null;
            if (currentView === VIEW_NAME) {
                loadEvents({ force: true });
            }
        }
    }

    /* --------------------------------------------
       Wiring
       -------------------------------------------- */
    function bindEvents() {
        const wrap = $(CONTAINER_ID);
        if (wrap) wrap.addEventListener('click', onContainerClick, false);

        window.addEventListener('gav:view:change', onViewChange, false);
        window.addEventListener('gav:auth:logout',  onAuthLogout,  false);
        window.addEventListener('gav:auth:success', onAuthSuccess, false);
    }

    /* --------------------------------------------
       Init
       -------------------------------------------- */
    let initialized = false;

    function init() {
        if (initialized) return;
        initialized = true;

        bindEvents();

        const currentView = window.GavRouter && window.GavRouter.current
            ? window.GavRouter.current()
            : null;

        if (currentView === VIEW_NAME) {
            loadEvents({ force: true });
        }

        safeLog('info', 'Barter module initialized.');
    }

    /* --------------------------------------------
       Public API
       -------------------------------------------- */
    window.GavBarter = Object.freeze({
        init:   init,
        reload: function () { return loadEvents({ force: true }); },
        join:   joinEvent,
        leave:  leaveEvent,
        getEvents: function () {
            return state.events.map(function (ev) {
                return Object.assign({}, ev);
            });
        },
        isEndpointMissing: function () {
            return state.endpointMissing === true;
        }
    });

    /* --------------------------------------------
       Bootstrap
       -------------------------------------------- */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();