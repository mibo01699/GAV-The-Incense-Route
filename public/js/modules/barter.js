/* ============================================================
   GAV – Module: Barter Festivals
   Path:   public/js/modules/barter.js
   ============================================================ */

(function () {
    'use strict';

    const VIEW_NAME = 'barter';
    const CONTAINER_ID = 'barter-events';

    const STAGE_LABELS = Object.freeze({
        upcoming: 'قادمة', open: 'مفتوحة', active: 'جارية',
        closed: 'مغلقة', ended: 'انتهت', cancelled: 'ملغاة'
    });

    const STAGE_VARIANTS = Object.freeze({
        upcoming: 'info', open: 'success', active: 'success',
        closed: 'danger', ended: 'danger', cancelled: 'danger'
    });

    if (window.__GAV_BARTER_LOADED__ === true) return;
    window.__GAV_BARTER_LOADED__ = true;

    const state = { events: [], loading: false, loadedOnce: false, endpointMissing: false, busyIds: {} };

    function safeLog(level, msg, data) {
        if (!window.console) return;
        const fn = console[level] || console.log;
        if (data !== undefined) fn.call(console, '[GAV/barter] ' + msg, data);
        else fn.call(console, '[GAV/barter] ' + msg);
    }

    function $(id) { return document.getElementById(id); }

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function formatDate(iso) {
        if (!iso) return '—';
        try {
            const d = new Date(iso);
            if (isNaN(d.getTime())) return '—';
            return d.getFullYear() + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + String(d.getDate()).padStart(2,'0');
        } catch (_) { return '—'; }
    }

    function formatWindow(s, e) {
        const a = formatDate(s), b = formatDate(e);
        if (a === '—' && b === '—') return 'غير محدد';
        if (a === '—') return 'حتى ' + b;
        if (b === '—') return 'من ' + a;
        return a + ' → ' + b;
    }

    function normalizeEvents(data) {
        if (!data) return [];
        if (Array.isArray(data)) return data;
        if (Array.isArray(data.festivals)) return data.festivals;
        if (Array.isArray(data.events)) return data.events;
        if (data.data) {
            if (Array.isArray(data.data)) return data.data;
            if (Array.isArray(data.data.festivals)) return data.data.festivals;
        }
        return [];
    }

    function renderLoading() {
        const wrap = $(CONTAINER_ID);
        if (wrap) wrap.innerHTML = '<div class="empty-state"><p>جاري التحميل...</p></div>';
    }

    function renderEmpty(msg) {
        const wrap = $(CONTAINER_ID);
        if (wrap) wrap.innerHTML = '<div class="empty-state"><p>' + escapeHtml(msg || 'لا توجد فعاليات مقايضة حالياً.') + '</p></div>';
    }

    function renderNotAvailable() {
        const wrap = $(CONTAINER_ID);
        if (wrap) wrap.innerHTML = '<div class="empty-state"><p>خدمة مهرجانات المقايضة قيد التفعيل.</p><p class="text-muted" style="margin-top:0.5rem;font-size:0.85rem;">يرجى المحاولة لاحقاً.</p></div>';
    }

    function renderEventItem(ev) {
        if (!ev || typeof ev !== 'object') return '';
        const id = escapeHtml(ev.id || ev.festivalId || '');
        const name = escapeHtml(ev.name || ev.title || 'فعالية مقايضة');
        const location = escapeHtml(ev.location || '—');
        const win = escapeHtml(formatWindow(ev.startAt || ev.startsAt, ev.endAt || ev.endsAt));
        const status = ev.status || 'upcoming';
        const count = Number(ev.participantsCount || (Array.isArray(ev.participants) ? ev.participants.length : 0)) || 0;
        const joined = ev.joined === true || ev.isJoined === true;
        const isClosed = (status === 'closed' || status === 'ended' || status === 'cancelled');
        const badge = '<span class="badge badge-' + (STAGE_VARIANTS[status] || 'info') + '">' + escapeHtml(STAGE_LABELS[status] || status) + '</span>';

        let action = '';
        if (isClosed) action = '<button class="btn btn-secondary" disabled>مغلقة</button>';
        else if (joined) action = '<button class="btn btn-secondary" data-barter-leave="' + id + '">مغادرة</button>';
        else action = '<button class="btn btn-primary" data-barter-join="' + id + '">انضم</button>';

        return '<div class="list-item" data-event-id="' + id + '">' +
            '<div class="list-item-icon">🔄</div>' +
            '<div class="list-item-body">' +
            '<div class="list-item-title">' + name + ' ' + badge + '</div>' +
            '<div class="list-item-subtitle">📍 ' + location + ' · 🗓 ' + win + '</div>' +
            '<div class="list-item-subtitle">👥 ' + count + ' مشارك</div>' +
            '</div>' +
            '<div class="list-item-meta">' + action + '</div>' +
            '</div>';
    }

    function renderEvents() {
        const wrap = $(CONTAINER_ID);
        if (!wrap) return;
        if (state.endpointMissing) { renderNotAvailable(); return; }
        if (!state.events.length) { renderEmpty(); return; }
        wrap.innerHTML = state.events.map(renderEventItem).join('');
    }

    async function loadEvents(options) {
        options = options || {};
        if (state.loading || (!options.force && state.loadedOnce)) return;
        if (!window.GavApi || !window.GavApi.endpoints || typeof window.GavApi.endpoints.listBarterEvents !== 'function') {
            renderEmpty('الخدمة غير جاهزة.'); return;
        }

        state.loading = true;
        renderLoading();

        let res;
        try { res = await window.GavApi.endpoints.listBarterEvents(); }
        catch (err) { state.loading = false; renderEmpty('تعذّر الاتصال.'); return; }

        state.loading = false;

        if (!res || !res.ok) {
            if (res && res.status === 404) {
                state.endpointMissing = true; state.loadedOnce = true;
                renderNotAvailable(); return;
            }
            renderEmpty((res && res.error) || 'تعذّر التحميل.'); return;
        }

        state.events = normalizeEvents(res.data);
        state.loadedOnce = true;
        state.endpointMissing = false;
        renderEvents();
    }

    async function joinEvent(id) {
        if (!id || state.busyIds[id]) return;
        if (!window.GavApi || typeof window.GavApi.endpoints.joinBarterEvent !== 'function') return;
        state.busyIds[id] = true;

        const res = await window.GavApi.withAuth(function () {
            return window.GavApi.endpoints.joinBarterEvent(id);
        });

        delete state.busyIds[id];

        if (!res || !res.ok) {
            if (res && res.status === 404) {
                if (typeof window.showToast === 'function') window.showToast('warning', 'الخدمة قيد التفعيل.');
                return;
            }
            if (typeof window.showToast === 'function') window.showToast('error', (res && res.error) || 'تعذّر الانضمام.');
            return;
        }
        if (typeof window.showToast === 'function') window.showToast('success', 'تم الانضمام.');
        state.events = state.events.map(function (ev) {
            const eid = ev.id || ev.festivalId;
            if (eid === id) return Object.assign({}, ev, { joined: true, participantsCount: (Number(ev.participantsCount || 0) + 1) });
            return ev;
        });
        renderEvents();
    }

    async function leaveEvent(id) {
        if (!id || state.busyIds[id]) return;
        if (!window.confirm('مغادرة الفعالية؟')) return;
        if (!window.GavApi || typeof window.GavApi.endpoints.leaveBarterEvent !== 'function') return;
        state.busyIds[id] = true;

        const res = await window.GavApi.withAuth(function () {
            return window.GavApi.endpoints.leaveBarterEvent(id);
        });

        delete state.busyIds[id];

        if (!res || !res.ok) {
            if (typeof window.showToast === 'function') window.showToast('error', (res && res.error) || 'تعذّرت المغادرة.');
            return;
        }
        if (typeof window.showToast === 'function') window.showToast('info', 'تم تسجيل المغادرة.');
        state.events = state.events.map(function (ev) {
            const eid = ev.id || ev.festivalId;
            if (eid === id) return Object.assign({}, ev, { joined: false, participantsCount: Math.max(0, Number(ev.participantsCount || 0) - 1) });
            return ev;
        });
        renderEvents();
    }

    function onContainerClick(e) {
        const j = e.target.closest ? e.target.closest('[data-barter-join]') : null;
        const l = e.target.closest ? e.target.closest('[data-barter-leave]') : null;
        if (j) { joinEvent(j.getAttribute('data-barter-join')); return; }
        if (l) leaveEvent(l.getAttribute('data-barter-leave'));
    }

    function onViewChange(e) {
        if (e && e.detail && e.detail.to === VIEW_NAME) loadEvents({ force: false });
    }

    function onAuthLogout() {
        state.events = []; state.loadedOnce = false; state.endpointMissing = false; state.busyIds = {};
        renderEmpty();
    }

    function bindEvents() {
        const wrap = $(CONTAINER_ID);
        if (wrap) wrap.addEventListener('click', onContainerClick, false);
        window.addEventListener('gav:view:change', onViewChange, false);
        window.addEventListener('gav:auth:logout', onAuthLogout, false);
    }

    let initialized = false;
    function init() {
        if (initialized) return;
        initialized = true;
        bindEvents();
        const cur = window.GavRouter && window.GavRouter.current ? window.GavRouter.current() : null;
        if (cur === VIEW_NAME) loadEvents({ force: true });
    }

    window.GavBarter = Object.freeze({
        init: init,
        reload: function () { return loadEvents({ force: true }); },
        join: joinEvent,
        leave: leaveEvent,
        getEvents: function () { return state.events.slice(); },
        isEndpointMissing: function () { return state.endpointMissing === true; }
    });

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();