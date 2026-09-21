/* ============================================================
   GAV – The Incense Route
   Module: Barter Festivals
   Path:   public/js/modules/barter.js

   PURPOSE:
     - List barter events (name, location, window, participants).
     - Show event details and offered/wanted items.
     - Join / Leave an event (server-verified).
     - NEVER performs any currency transaction.
     - Barter is goods-for-goods only.

   CONSTRAINTS:
     - No direct fetch() — through GavApi.
     - No GCV, no YER, no fiat. No price fields at all here.
     - Server-verified identity via GavApi.withAuth().
     - UI updates only after server confirmation.
   ============================================================ */

(function () {
    'use strict';

    /* --------------------------------------------
       Constants
       -------------------------------------------- */
    const VIEW_NAME          = 'barter';
    const EVENTS_CONTAINER   = 'barter-events';

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
        events:     [],
        loading:    false,
        loadedOnce: false,
        busyIds:    {}          // eventId -> true while join/leave in flight
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
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const hh = String(d.getHours()).padStart(2, '0');
            const mi = String(d.getMinutes()).padStart(2, '0');
            return yyyy + '/' + mm + '/' + dd + ' · ' + hh + ':' + mi;
        } catch (_) {
            return '—';
        }
    }

    function normalizeEvents(data) {
        if (!data) return [];
        if (Array.isArray(data)) return data;
        if (Array.isArray(data.events)) return data.events;
        return [];
    }

    /* --------------------------------------------
       Renderers
       -------------------------------------------- */
    function renderLoading() {
        const wrap = $(EVENTS_CONTAINER);
        if (!wrap) return;
        wrap.innerHTML =
            '<div class="empty-state"><p>جاري تحميل فعاليات المقايضة...</p></div>';
    }

    function renderEmpty(customMsg) {
        const wrap = $(EVENTS_CONTAINER);
        if (!wrap) return;
        const msg = customMsg || 'لا توجد فعاليات مقايضة حالياً.';
        wrap.innerHTML =
            '<div class="empty-state"><p>' + escapeHtml(msg) + '</p></div>';
    }

    function renderError(msg) {
        const wrap = $(EVENTS_CONTAINER);
        if (!wrap) return;
        wrap.innerHTML =
            '<div class="empty-state"><p>' + escapeHtml(msg || 'تعذّر تحميل الفعاليات.') + '</p></div>';
    }

    function renderEventItem(ev) {
        const id       = escapeHtml(ev.id || '');
        const name     = escapeHtml(ev.name || 'فعالية مقايضة');
        const location = escapeHtml(ev.location || '—');
        const start    = formatDate(ev.startAt);
        const end      = formatDate(ev.endAt);
        const participants = Number(ev.participantsCount || ev.participants || 0);
        const isJoined = ev.joined === true;

        const offeredCount = Array.isArray(ev.offeredItems) ? ev.offeredItems.length : 0;
        const wantedCount  = Array.isArray(ev.wantedItems)  ? ev.wantedItems.length  : 0;

        const statusBadge = ev.status === 'open'
            ? '<span class="badge badge-success">مفتوحة</span>'
            : ev.status === 'closed'
                ? '<span class="badge badge-danger">مغلقة</span>'
                : '<span class="badge badge-info">قادمة</span>';

        const joinBtn = isJoined
            ? '<button class="btn btn-secondary" data-barter-leave="' + id + '">مغادرة</button>'
            : '<button class="btn btn-primary" data-barter-join="' + id + '">انضم</button>';

        return '' +
            '<div class="list-item" data-event-id="' + id + '">' +
                '<div class="list-item-icon">🔄</div>' +
                '<div class="list-item-body">' +
                    '<div class="list-item-title">' + name + ' ' + statusBadge + '</div>' +
                    '<div class="list-item-subtitle">' +
                        '📍 ' + location + ' · 🗓 ' + start + ' → ' + end +
                    '</div>' +
                    '<div class="list-item-subtitle">' +
                        '👥 ' + participants + ' مشارك · ' +
                        '📦 معروض: ' + offeredCount + ' · ' +
                        '🎯 مطلوب: ' + wantedCount +
                    '</div>' +
                '</div>' +
                '<div class="list-item-meta">' +
                    joinBtn +
                '</div>' +
            '</div>';
    }

    function renderEvents() {
        const wrap = $(EVENTS_CONTAINER);
        if (!wrap) return;

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

        if (!window.GavApi || !window.GavApi.endpoints) {
            renderError('خدمة المقايضة غير جاهزة.');
            return;
        }

        state.loading = true;
        renderLoading();

        const res = await window.GavApi.endpoints.listBarterEvents();

        state.loading = false;

        if (!res || !res.ok) {
            renderError((res && res.error) || 'تعذّر تحميل الفعاليات.');
            safeLog('warn', 'loadEvents failed:', res);
            return;
        }

        state.events = normalizeEvents(res.data);
        state.loadedOnce = true;

        renderEvents();
        safeLog('info', 'Loaded ' + state.events.length + ' barter event(s).');
    }

    /* --------------------------------------------
       Join / Leave — server-verified
       -------------------------------------------- */
    async function joinEvent(eventId) {
        if (!eventId || state.busyIds[eventId]) return;

        const res = await window.GavApi.withAuth(function () {
            return window.GavApi.post('/barter/events/' + encodeURIComponent(eventId) + '/join', {});
        });

        if (!res || !res.ok) {
            if (typeof window.showToast === 'function') {
                window.showToast('error', (res && res.error) || 'تعذّر الانضمام للفعالية.');
            }
            return;
        }

        if (typeof window.showToast === 'function') {
            window.showToast('success', 'تم الانضمام إلى الفعالية.');
        }

        // Update local state (server is source of truth; we just reflect)
        state.events = state.events.map(function (ev) {
            if (ev.id === eventId) {
                const count = Number(ev.participantsCount || ev.participants || 0);
                return Object.assign({}, ev, {
                    joined: true,
                    participantsCount: count + 1
                });
            }
            return ev;
        });
        renderEvents();
    }

    async function leaveEvent(eventId) {
        if (!eventId || state.busyIds[eventId]) return;

        const ok = window.confirm('هل أنت متأكد من مغادرة الفعالية؟');
        if (!ok) return;

        const res = await window.GavApi.withAuth(function () {
            return window.GavApi.post('/barter/events/' + encodeURIComponent(eventId) + '/leave', {});
        });

        if (!res || !res.ok) {
            if (typeof window.showToast === 'function') {
                window.showToast('error', (res && res.error) || 'تعذّرت المغادرة.');
            }
            return;
        }

        if (typeof window.showToast === 'function') {
            window.showToast('info', 'تم تسجيل مغادرتك للفعالية.');
        }

        state.events = state.events.map(function (ev) {
            if (ev.id === eventId) {
                const count = Math.max(0, Number(ev.participantsCount || ev.participants || 0) - 1);
                return Object.assign({}, ev, {
                    joined: false,
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
        const joinBtn  = e.target.closest ? e.target.closest('[data-barter-join]')  : null;
        const leaveBtn = e.target.closest ? e.target.closest('[data-barter-leave]') : null;

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
        state.busyIds = {};
        renderEmpty();
    }

    /* --------------------------------------------
       Wiring
       -------------------------------------------- */
    function bindEvents() {
        const wrap = $(EVENTS_CONTAINER);
        if (wrap) wrap.addEventListener('click', onContainerClick, false);

        window.addEventListener('gav:view:change', onViewChange, false);
        window.addEventListener('gav:auth:logout',  onAuthLogout,  false);
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
        init:      init,
        reload:    function () { return loadEvents({ force: true }); },
        join:      joinEvent,
        leave:     leaveEvent,
        getEvents: function () {
            return state.events.map(function (ev) { return Object.assign({}, ev); });
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