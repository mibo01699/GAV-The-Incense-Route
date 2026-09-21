/* ============================================================
   GAV – The Incense Route
   Module: Router & Navigation
   Path:   public/js/core/router.js

   PURPOSE:
     - Hash-based routing between the 11 views.
     - Sync .nav-item and .bottom-nav-item active states.
     - Toggle sidebar open/close on mobile.
     - Sync sidebar overlay/backdrop.
     - Expose GavRouter API for other modules.
     - React to auth events (gav:auth:success / gav:auth:logout).

   CONSTRAINTS:
     - No external libraries.
     - No DOM creation — only toggling classes/attributes.
     - Never breaks if a view is missing.
     - Never triggers network calls.
   ============================================================ */

(function () {
    'use strict';

    /* --------------------------------------------
       Constants
       -------------------------------------------- */
    const VALID_VIEWS = [
        'marketplace',
        'merchant',
        'pos',
        'registry',
        'supply-chain',
        'barter',
        'payments',
        'invoices',
        'orders',
        'audit',
        'reference-index'
    ];

    const DEFAULT_VIEW  = 'marketplace';
    const HASH_PREFIX   = '#';
    const DESKTOP_BP    = 1024; // matches CSS @media (min-width: 1024px)

    /* --------------------------------------------
       Duplicate-load guard
       -------------------------------------------- */
    if (window.__GAV_ROUTER_LOADED__ === true) {
        if (window.console && console.warn) {
            console.warn('[GAV/router] Module already loaded — skipping.');
        }
        return;
    }
    window.__GAV_ROUTER_LOADED__ = true;

    /* --------------------------------------------
       Internal state
       -------------------------------------------- */
    const state = {
        currentView: DEFAULT_VIEW,
        sidebarOpen: false,
        initialized: false
    };

    /* --------------------------------------------
       Utilities
       -------------------------------------------- */
    function safeLog(level, msg, data) {
        if (!window.console) return;
        const fn = console[level] || console.log;
        if (data !== undefined) fn.call(console, '[GAV/router] ' + msg, data);
        else                     fn.call(console, '[GAV/router] ' + msg);
    }

    function isDesktop() {
        return window.innerWidth >= DESKTOP_BP;
    }

    function parseHash() {
        const raw = (window.location.hash || '').replace(HASH_PREFIX, '').trim();
        if (!raw) return DEFAULT_VIEW;
        return VALID_VIEWS.indexOf(raw) !== -1 ? raw : DEFAULT_VIEW;
    }

    function writeHash(view) {
        const desired = HASH_PREFIX + view;
        if (window.location.hash !== desired) {
            // Use replaceState to avoid flooding history with every nav click.
            if (window.history && typeof window.history.replaceState === 'function') {
                window.history.replaceState(null, '', desired);
            } else {
                window.location.hash = desired;
            }
        }
    }

    /* --------------------------------------------
       View switching
       -------------------------------------------- */
    function switchView(viewName, options) {
        options = options || {};

        if (VALID_VIEWS.indexOf(viewName) === -1) {
            safeLog('warn', 'Unknown view requested: ' + viewName);
            viewName = DEFAULT_VIEW;
        }

        // Update view panels
        const panels = document.querySelectorAll('.view');
        for (let i = 0; i < panels.length; i++) {
            const el = panels[i];
            const id = el.id || '';
            if (id === 'view-' + viewName) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        }

        // Update sidebar nav items
        const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
        for (let i = 0; i < navItems.length; i++) {
            const el = navItems[i];
            if (el.getAttribute('data-view') === viewName) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        }

        // Update bottom nav items
        const bottomItems = document.querySelectorAll('.bottom-nav .bottom-nav-item');
        for (let i = 0; i < bottomItems.length; i++) {
            const el = bottomItems[i];
            if (el.getAttribute('data-view') === viewName) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        }

        // Persist in hash (unless suppressed)
        if (options.skipHash !== true) {
            writeHash(viewName);
        }

        // Auto-close sidebar on mobile after navigation
        if (!isDesktop() && state.sidebarOpen) {
            closeSidebar();
        }

        // Scroll to top of main content
        const main = document.getElementById('main-content');
        if (main && typeof main.scrollTo === 'function') {
            main.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (window.scrollTo) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        // Update state + emit event
        const previous = state.currentView;
        state.currentView = viewName;

        if (previous !== viewName) {
            try {
                window.dispatchEvent(new CustomEvent('gav:view:change', {
                    detail: { from: previous, to: viewName }
                }));
            } catch (e) {
                safeLog('warn', 'dispatchEvent gav:view:change failed:', e);
            }
        }

        safeLog('info', 'Switched view → ' + viewName);
    }

    /* --------------------------------------------
       Sidebar controls
       -------------------------------------------- */
    function openSidebar() {
        const sidebar = document.getElementById('sidebar');
        const toggle  = document.getElementById('menu-toggle');
        if (!sidebar) return;
        sidebar.classList.add('open');
        if (toggle) toggle.classList.add('active');
        state.sidebarOpen = true;
    }

    function closeSidebar() {
        const sidebar = document.getElementById('sidebar');
        const toggle  = document.getElementById('menu-toggle');
        if (!sidebar) return;
        sidebar.classList.remove('open');
        if (toggle) toggle.classList.remove('active');
        state.sidebarOpen = false;
    }

    function toggleSidebar() {
        if (state.sidebarOpen) closeSidebar();
        else                   openSidebar();
    }

    /* --------------------------------------------
       Click handlers
       -------------------------------------------- */
    function onNavItemClick(e) {
        const target = e.target.closest ? e.target.closest('[data-view]') : null;
        if (!target) return;
        const view = target.getAttribute('data-view');
        if (!view) return;

        // If it's an <a href="#...">, prevent default and route manually
        if (target.tagName === 'A') {
            e.preventDefault();
        }

        switchView(view);
    }

    function onMenuToggleClick() {
        toggleSidebar();
    }

    function onHashChange() {
        const view = parseHash();
        if (view !== state.currentView) {
            switchView(view, { skipHash: true });
        }
    }

    function onResize() {
        // When switching to desktop, force-close mobile sidebar state
        if (isDesktop() && state.sidebarOpen) {
            closeSidebar();
        }
    }

    function onKeyDown(e) {
        // Close sidebar on Escape
        if (e.key === 'Escape' && state.sidebarOpen) {
            closeSidebar();
        }
    }

    /* --------------------------------------------
       Auth event reactions
       -------------------------------------------- */
    function onAuthSuccess() {
        // No forced navigation; business modules may redirect later.
        safeLog('info', 'Auth success event received by router.');
    }

    function onAuthLogout() {
        // Send user back to marketplace on logout.
        switchView(DEFAULT_VIEW);
        safeLog('info', 'Auth logout event received by router.');
    }

    /* --------------------------------------------
       Wiring
       -------------------------------------------- */
    function bindEvents() {
        // Delegate nav clicks (works for sidebar + bottom nav + any [data-view])
        document.addEventListener('click', function (e) {
            const target = e.target.closest ? e.target.closest('[data-view]') : null;
            if (!target) return;
            onNavItemClick(e);
        }, false);

        // Menu toggle
        const toggle = document.getElementById('menu-toggle');
        if (toggle) {
            toggle.addEventListener('click', onMenuToggleClick, false);
        }

        // Hash + resize + keyboard
        window.addEventListener('hashchange', onHashChange, false);
        window.addEventListener('resize', onResize, false);
        window.addEventListener('keydown', onKeyDown, false);

        // Auth events
        window.addEventListener('gav:auth:success', onAuthSuccess, false);
        window.addEventListener('gav:auth:logout',  onAuthLogout,  false);
    }

    /* --------------------------------------------
       Initialization
       -------------------------------------------- */
    function init() {
        if (state.initialized) return;
        state.initialized = true;

        bindEvents();

        const initialView = parseHash();
        switchView(initialView, { skipHash: true });

        safeLog('info', 'Router initialized. Initial view = ' + initialView);
    }

    /* --------------------------------------------
       Public API
       -------------------------------------------- */
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

    /* --------------------------------------------
       Bootstrap
       -------------------------------------------- */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();