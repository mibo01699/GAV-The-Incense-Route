/* ============================================================
   GAV – The Incense Route
   Module: Router & Navigation
   Path:   public/js/core/router.js
   ============================================================ */

(function () {
    'use strict';

    const VALID_VIEWS = [
        'marketplace', 'merchant', 'pos', 'registry', 'supply-chain',
        'barter', 'payments', 'invoices', 'orders', 'audit', 'reference-index'
    ];
    const DEFAULT_VIEW = 'marketplace';
    const DESKTOP_BP = 1024;

    if (window.__GAV_ROUTER_LOADED__ === true) {
        if (window.console && console.warn) console.warn('[GAV/router] Already loaded.');
        return;
    }
    window.__GAV_ROUTER_LOADED__ = true;

    const state = { currentView: DEFAULT_VIEW, sidebarOpen: false, initialized: false };

    function safeLog(level, msg, data) {
        if (!window.console) return;
        const fn = console[level] || console.log;
        if (data !== undefined) fn.call(console, '[GAV/router] ' + msg, data);
        else fn.call(console, '[GAV/router] ' + msg);
    }

    function isDesktop() { return window.innerWidth >= DESKTOP_BP; }

    function parseHash() {
        const raw = (window.location.hash || '').replace('#', '').trim();
        if (!raw) return DEFAULT_VIEW;
        return VALID_VIEWS.indexOf(raw) !== -1 ? raw : DEFAULT_VIEW;
    }

    function writeHash(view) {
        const desired = '#' + view;
        if (window.location.hash !== desired) {
            if (window.history && typeof window.history.replaceState === 'function') {
                window.history.replaceState(null, '', desired);
            } else {
                window.location.hash = desired;
            }
        }
    }

    function switchView(viewName, options) {
        options = options || {};
        if (VALID_VIEWS.indexOf(viewName) === -1) viewName = DEFAULT_VIEW;

        const panels = document.querySelectorAll('.view');
        for (let i = 0; i < panels.length; i++) {
            const el = panels[i];
            if (el.id === 'view-' + viewName) el.classList.add('active');
            else el.classList.remove('active');
        }

        const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
        for (let i = 0; i < navItems.length; i++) {
            const el = navItems[i];
            if (el.getAttribute('data-view') === viewName) el.classList.add('active');
            else el.classList.remove('active');
        }

        const bottomItems = document.querySelectorAll('.bottom-nav .bottom-nav-item');
        for (let i = 0; i < bottomItems.length; i++) {
            const el = bottomItems[i];
            if (el.getAttribute('data-view') === viewName) el.classList.add('active');
            else el.classList.remove('active');
        }

        if (options.skipHash !== true) writeHash(viewName);
        if (!isDesktop() && state.sidebarOpen) closeSidebar();

        const main = document.getElementById('main-content');
        if (main && typeof main.scrollTo === 'function') main.scrollTo({ top: 0, behavior: 'smooth' });
        else if (window.scrollTo) window.scrollTo({ top: 0, behavior: 'smooth' });

        const previous = state.currentView;
        state.currentView = viewName;

        if (previous !== viewName) {
            try {
                window.dispatchEvent(new CustomEvent('gav:view:change', {
                    detail: { from: previous, to: viewName }
                }));
            } catch (e) { /* noop */ }
        }
        safeLog('info', 'Switched → ' + viewName);
    }

    function openSidebar() {
        const sidebar = document.getElementById('sidebar');
        const toggle = document.getElementById('menu-toggle');
        if (!sidebar) return;
        sidebar.classList.add('open');
        if (toggle) toggle.classList.add('active');
        state.sidebarOpen = true;
    }

    function closeSidebar() {
        const sidebar = document.getElementById('sidebar');
        const toggle = document.getElementById('menu-toggle');
        if (!sidebar) return;
        sidebar.classList.remove('open');
        if (toggle) toggle.classList.remove('active');
        state.sidebarOpen = false;
    }

    function toggleSidebar() { state.sidebarOpen ? closeSidebar() : openSidebar(); }

    function onNavItemClick(e) {
        const target = e.target.closest ? e.target.closest('[data-view]') : null;
        if (!target) return;
        const view = target.getAttribute('data-view');
        if (!view) return;
        if (target.tagName === 'A') e.preventDefault();
        switchView(view);
    }

    function onHashChange() {
        const view = parseHash();
        if (view !== state.currentView) switchView(view, { skipHash: true });
    }

    function onResize() {
        if (isDesktop() && state.sidebarOpen) closeSidebar();
    }

    function onKeyDown(e) {
        if (e.key === 'Escape' && state.sidebarOpen) closeSidebar();
    }

    function onAuthLogout() { switchView(DEFAULT_VIEW); }

    function bindEvents() {
        document.addEventListener('click', function (e) {
            const target = e.target.closest ? e.target.closest('[data-view]') : null;
            if (target) onNavItemClick(e);
        }, false);

        const toggle = document.getElementById('menu-toggle');
        if (toggle) toggle.addEventListener('click', toggleSidebar, false);

        window.addEventListener('hashchange', onHashChange, false);
        window.addEventListener('resize', onResize, false);
        window.addEventListener('keydown', onKeyDown, false);
        window.addEventListener('gav:auth:logout', onAuthLogout, false);
    }

    function init() {
        if (state.initialized) return;
        state.initialized = true;
        bindEvents();
        switchView(parseHash(), { skipHash: true });
        safeLog('info', 'Router initialized.');
    }

    window.GavRouter = Object.freeze({
        init: init,
        go: function (view) { switchView(view); },
        current: function () { return state.currentView; },
        isSidebarOpen: function () { return state.sidebarOpen === true; },
        openSidebar: openSidebar,
        closeSidebar: closeSidebar,
        toggleSidebar: toggleSidebar,
        views: VALID_VIEWS.slice()
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();