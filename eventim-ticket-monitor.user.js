// ==UserScript==
// @name         Eventim Rock am Ring 2026 Ticket Monitor
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Monitor Rock am Ring 2026 tickets with GUI controls
// @author       Ferrywell
// @match        https://www.eventim.de/en/event/rock-am-ring-2026-camping-tickets-nuerburgring-20314942/*
// @match        https://www.eventim.de/*rock-am-ring-2026*
// @match        *://www.eventim.de/en/event/rock-am-ring-2026-camping-tickets-nuerburgring-20314942/*
// @grant        none
// @run-at       document-ready
// @updateURL    https://raw.githubusercontent.com/Ferrywell/EventJim/main/eventim-ticket-monitor.user.js
// @downloadURL  https://raw.githubusercontent.com/Ferrywell/EventJim/main/eventim-ticket-monitor.user.js
// ==/UserScript==

(function() {
    'use strict';

    // --- Core Configuration Object ---
    const DEFAULT_CONFIG = {
        refreshInterval: 30000,           // 30 seconds page refresh
        checkInterval: 15000,             // 15 seconds button check
        discordUpdateInterval: 600000,    // 10 minutes Discord status
        alertSoundInterval: 10000,        // 10 seconds sound alerts
        ticketQuantity: 2,                // number of tickets to purchase
        webhookUrl: '',                   // Discord webhook URL
        notifyUser: '',                   // Discord user to mention
        selectedElementSelector: '',      // CSS selector for target button
        selectedElementName: ''           // Human-readable element name
    };

    // --- Persistent Settings (localStorage) ---
    const STORAGE_KEY = 'eventimTicketMonitorConfig';

    function saveConfig(config) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
        } catch (e) {
            console.error('[Eventim Ticket Monitor] Failed to save config:', e);
        }
    }

    function loadConfig() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                // Merge with defaults to support new fields
                return { ...DEFAULT_CONFIG, ...parsed };
            }
        } catch (e) {
            console.error('[Eventim Ticket Monitor] Failed to load config:', e);
        }
        return { ...DEFAULT_CONFIG };
    }

    // --- Config Proxy for Auto-Save ---
    let config = loadConfig();
    config = new Proxy(config, {
        set(target, prop, value) {
            target[prop] = value;
            saveConfig(target);
            return true;
        }
    });

    // --- Initialization Log ---
    console.log('[Eventim Ticket Monitor] Initialized with config:', config);

    // --- Export config for later use (window-scoped for debugging) ---
    window.eventimTicketMonitorConfig = config;

    // --- Phase 2: Professional Eventim-Style GUI ---
    // Inject styles for the GUI
    function injectStyles() {
        const style = document.createElement('style');
        style.id = 'etm-monitor-styles';
        style.textContent = `
        /* Container */
        #etm-monitor-gui {
            position: fixed;
            top: 80px;
            right: 40px;
            z-index: 99999;
            min-width: 340px;
            max-width: 420px;
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            color: #495057;
            font-family: 'Helvetica Neue', Arial, sans-serif;
            border: 1.5px solid #e1e5e9;
            border-radius: 14px;
            box-shadow: 0 8px 32px rgba(30,60,114,0.18), 0 1.5px 6px #e1e5e9;
            overflow: hidden;
            user-select: none;
            transition: box-shadow 0.3s;
        }
        #etm-monitor-gui.etm-minimized .etm-body, #etm-monitor-gui.etm-minimized .etm-footer {
            display: none;
        }
        #etm-monitor-gui .etm-header {
            background: linear-gradient(90deg, #1e3c72 0%, #2a5298 100%);
            color: #fff;
            padding: 14px 18px 10px 18px;
            font-size: 1.18rem;
            font-weight: 700;
            letter-spacing: 1px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            cursor: move;
            border-bottom: 1.5px solid #e1e5e9;
        }
        #etm-monitor-gui .etm-header .etm-title {
            flex: 1;
        }
        #etm-monitor-gui .etm-header .etm-btn {
            background: none;
            border: none;
            color: #fff;
            font-size: 1.1em;
            margin-left: 8px;
            cursor: pointer;
            border-radius: 4px;
            padding: 2px 7px;
            transition: background 0.3s;
        }
        #etm-monitor-gui .etm-header .etm-btn:hover {
            background: rgba(255,255,255,0.13);
        }
        #etm-monitor-gui .etm-body {
            padding: 0 18px 0 18px;
            max-height: 500px;
            overflow-y: auto;
        }
        #etm-monitor-gui .etm-section {
            margin: 18px 0 0 0;
            background: #fff;
            border-radius: 10px;
            box-shadow: 0 1px 4px rgba(44,62,80,0.07);
            border: 1px solid #e1e5e9;
            overflow: hidden;
        }
        #etm-monitor-gui .etm-section-header {
            background: linear-gradient(90deg, #e1e5e9 0%, #f8fafc 100%);
            color: #1e3c72;
            font-weight: 600;
            font-size: 1rem;
            padding: 10px 16px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 1px solid #e1e5e9;
            user-select: none;
        }
        #etm-monitor-gui .etm-section-content {
            padding: 14px 16px 14px 16px;
            display: block;
            transition: max-height 0.3s;
        }
        #etm-monitor-gui .etm-section.etm-collapsed .etm-section-content {
            display: none;
        }
        #etm-monitor-gui .etm-section-header .etm-toggle {
            font-size: 1.1em;
            margin-left: 8px;
            color: #495057;
        }
        #etm-monitor-gui label {
            font-size: 0.98em;
            font-weight: 500;
            margin-bottom: 4px;
            display: block;
            color: #495057;
        }
        #etm-monitor-gui input[type="text"],
        #etm-monitor-gui input[type="number"] {
            width: 100%;
            padding: 7px 10px;
            border: 1px solid #e1e5e9;
            border-radius: 6px;
            font-size: 1em;
            margin-bottom: 10px;
            background: #f8fafc;
            color: #495057;
            transition: border 0.3s;
        }
        #etm-monitor-gui input[type="text"]:focus,
        #etm-monitor-gui input[type="number"]:focus {
            border: 1.5px solid #2a5298;
            outline: none;
        }
        #etm-monitor-gui .etm-btn-main {
            background: linear-gradient(90deg, #1e3c72 0%, #2a5298 100%);
            color: #fff;
            border: none;
            border-radius: 7px;
            padding: 10px 18px;
            font-size: 1em;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin: 0 8px 0 0;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(30,60,114,0.08);
            transition: background 0.3s, box-shadow 0.3s;
        }
        #etm-monitor-gui .etm-btn-main:hover {
            background: linear-gradient(90deg, #2a5298 0%, #1e3c72 100%);
            box-shadow: 0 4px 16px rgba(30,60,114,0.13);
        }
        #etm-monitor-gui .etm-btn-secondary {
            background: linear-gradient(90deg, #ffc107 0%, #ffeb3b 100%);
            color: #495057;
            border: none;
            border-radius: 7px;
            padding: 10px 18px;
            font-size: 1em;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin: 0 8px 0 0;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(255,193,7,0.08);
            transition: background 0.3s, box-shadow 0.3s;
        }
        #etm-monitor-gui .etm-btn-secondary:hover {
            background: linear-gradient(90deg, #ffeb3b 0%, #ffc107 100%);
            box-shadow: 0 4px 16px rgba(255,193,7,0.13);
        }
        #etm-monitor-gui .etm-footer {
            background: #f8fafc;
            color: #495057;
            font-size: 0.95em;
            text-align: center;
            padding: 10px 0 10px 0;
            border-top: 1.5px solid #e1e5e9;
            letter-spacing: 0.2px;
        }
        /* Custom Scrollbar */
        #etm-monitor-gui .etm-body::-webkit-scrollbar {
            width: 8px;
        }
        #etm-monitor-gui .etm-body::-webkit-scrollbar-thumb {
            background: #e1e5e9;
            border-radius: 6px;
        }
        #etm-monitor-gui .etm-body::-webkit-scrollbar-track {
            background: #fff;
        }
        /* Resizer */
        #etm-monitor-gui .etm-resizer {
            position: absolute;
            right: 2px;
            bottom: 2px;
            width: 18px;
            height: 18px;
            cursor: se-resize;
            z-index: 10;
            background: url('data:image/svg+xml;utf8,<svg width="18" height="18" xmlns="http://www.w3.org/2000/svg"><line x1="3" y1="15" x2="15" y2="3" stroke="%23e1e5e9" stroke-width="2"/><line x1="7" y1="15" x2="15" y2="7" stroke="%23e1e5e9" stroke-width="2"/></svg>') no-repeat center center;
            opacity: 0.7;
        }
        #etm-monitor-gui .etm-resizer:hover {
            opacity: 1;
        }
        `;
        document.head.appendChild(style);
    }

    // --- GUI HTML Structure ---
    function createGUI() {
        if (document.getElementById('etm-monitor-gui')) return;
        const gui = document.createElement('div');
        gui.id = 'etm-monitor-gui';
        gui.innerHTML = `
            <div class="etm-header" tabindex="0">
                <span class="etm-title">Eventim Ticket Monitor</span>
                <button class="etm-btn etm-btn-minimize" title="Minimize" aria-label="Minimize">&#8211;</button>
                <button class="etm-btn etm-btn-close" title="Close" aria-label="Close">&#10005;</button>
            </div>
            <div class="etm-body">
                <div class="etm-section etm-status-section">
                    <div class="etm-section-header">Status <span class="etm-toggle">&#9660;</span></div>
                    <div class="etm-section-content">
                        <div id="etm-status-content">Monitoring not started.</div>
                    </div>
                </div>
                <div class="etm-section etm-discord-section">
                    <div class="etm-section-header">Discord <span class="etm-toggle">&#9660;</span></div>
                    <div class="etm-section-content">
                        <label for="etm-webhook-url">Webhook URL</label>
                        <input type="text" id="etm-webhook-url" placeholder="Paste Discord webhook URL" autocomplete="off">
                        <label for="etm-notify-user">User to Mention</label>
                        <input type="text" id="etm-notify-user" placeholder="@username or Discord ID" autocomplete="off">
                        <button class="etm-btn-main" id="etm-test-webhook" type="button">Test Webhook</button>
                        <span id="etm-webhook-status" style="margin-left:8px;font-size:0.97em;"></span>
                    </div>
                </div>
                <div class="etm-section etm-settings-section">
                    <div class="etm-section-header">Settings <span class="etm-toggle">&#9660;</span></div>
                    <div class="etm-section-content">
                        <label for="etm-refresh-interval">Page Refresh Interval (ms)</label>
                        <input type="number" id="etm-refresh-interval" min="5000" step="1000">
                        <label for="etm-check-interval">Button Check Interval (ms)</label>
                        <input type="number" id="etm-check-interval" min="1000" step="1000">
                        <label for="etm-discord-update-interval">Discord Update Interval (ms)</label>
                        <input type="number" id="etm-discord-update-interval" min="60000" step="10000">
                        <label for="etm-alert-sound-interval">Alert Sound Interval (ms)</label>
                        <input type="number" id="etm-alert-sound-interval" min="1000" step="1000">
                        <label for="etm-ticket-quantity">Ticket Quantity</label>
                        <input type="number" id="etm-ticket-quantity" min="1" max="10">
                    </div>
                </div>
                <div class="etm-section etm-controls-section">
                    <div class="etm-section-header">Controls <span class="etm-toggle">&#9660;</span></div>
                    <div class="etm-section-content">
                        <label for="etm-element-selector">Target Button Selector</label>
                        <input type="text" id="etm-element-selector" placeholder="CSS selector for button">
                        <label for="etm-element-name">Element Name</label>
                        <input type="text" id="etm-element-name" placeholder="Human-readable name">
                        <button class="etm-btn-main" id="etm-btn-eyedropper" type="button">Pick Element</button>
                        <button class="etm-btn-main" id="etm-btn-start" type="button">Start</button>
                        <button class="etm-btn-secondary" id="etm-btn-stop" type="button">Stop</button>
                    </div>
                </div>
            </div>
            <div class="etm-footer">© Ferrywell - Private Use Only</div>
            <div class="etm-resizer" title="Resize"></div>
        `;
        document.body.appendChild(gui);
    }

    // --- GUI Interactivity ---
    function setupGUIEvents() {
        const gui = document.getElementById('etm-monitor-gui');
        if (!gui) return;

        // Minimize/close
        gui.querySelector('.etm-btn-minimize').onclick = () => {
            gui.classList.toggle('etm-minimized');
        };
        gui.querySelector('.etm-btn-close').onclick = () => {
            gui.style.display = 'none';
        };

        // Collapsible sections
        gui.querySelectorAll('.etm-section-header').forEach(header => {
            header.onclick = function() {
                const section = this.parentElement;
                section.classList.toggle('etm-collapsed');
                const toggle = this.querySelector('.etm-toggle');
                if (toggle) toggle.innerHTML = section.classList.contains('etm-collapsed') ? '&#9654;' : '&#9660;';
            };
        });

        // Draggable
        let isDragging = false, dragOffsetX = 0, dragOffsetY = 0;
        const header = gui.querySelector('.etm-header');
        header.addEventListener('mousedown', function(e) {
            if (e.target.classList.contains('etm-btn')) return;
            isDragging = true;
            dragOffsetX = e.clientX - gui.offsetLeft;
            dragOffsetY = e.clientY - gui.offsetTop;
            document.body.style.userSelect = 'none';
        });
        document.addEventListener('mousemove', function(e) {
            if (!isDragging) return;
            gui.style.left = (e.clientX - dragOffsetX) + 'px';
            gui.style.top = (e.clientY - dragOffsetY) + 'px';
            gui.style.right = 'auto';
        });
        document.addEventListener('mouseup', function() {
            isDragging = false;
            document.body.style.userSelect = '';
        });

        // Resizable
        const resizer = gui.querySelector('.etm-resizer');
        let isResizing = false, startW, startH, startX, startY;
        resizer.addEventListener('mousedown', function(e) {
            isResizing = true;
            startW = gui.offsetWidth;
            startH = gui.offsetHeight;
            startX = e.clientX;
            startY = e.clientY;
            e.preventDefault();
            e.stopPropagation();
        });
        document.addEventListener('mousemove', function(e) {
            if (!isResizing) return;
            let newW = Math.max(320, Math.min(600, startW + (e.clientX - startX)));
            let newH = Math.max(200, Math.min(700, startH + (e.clientY - startY)));
            gui.style.width = newW + 'px';
            gui.style.height = newH + 'px';
        });
        document.addEventListener('mouseup', function() {
            isResizing = false;
        });

        // Accessibility: ESC to close
        header.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') gui.style.display = 'none';
        });
    }

    // --- Bind GUI fields to config (settings persistence) ---
    function bindSettings() {
        // Discord
        const webhookInput = document.getElementById('etm-webhook-url');
        const notifyUserInput = document.getElementById('etm-notify-user');
        webhookInput.value = config.webhookUrl;
        notifyUserInput.value = config.notifyUser;
        webhookInput.oninput = () => config.webhookUrl = webhookInput.value.trim();
        notifyUserInput.oninput = () => config.notifyUser = notifyUserInput.value.trim();

        // Settings
        const refreshInput = document.getElementById('etm-refresh-interval');
        const checkInput = document.getElementById('etm-check-interval');
        const discordUpdateInput = document.getElementById('etm-discord-update-interval');
        const alertSoundInput = document.getElementById('etm-alert-sound-interval');
        const ticketQtyInput = document.getElementById('etm-ticket-quantity');
        refreshInput.value = config.refreshInterval;
        checkInput.value = config.checkInterval;
        discordUpdateInput.value = config.discordUpdateInterval;
        alertSoundInput.value = config.alertSoundInterval;
        ticketQtyInput.value = config.ticketQuantity;
        refreshInput.oninput = () => config.refreshInterval = parseInt(refreshInput.value) || 30000;
        checkInput.oninput = () => config.checkInterval = parseInt(checkInput.value) || 15000;
        discordUpdateInput.oninput = () => config.discordUpdateInterval = parseInt(discordUpdateInput.value) || 600000;
        alertSoundInput.oninput = () => config.alertSoundInterval = parseInt(alertSoundInput.value) || 10000;
        ticketQtyInput.oninput = () => config.ticketQuantity = Math.max(1, Math.min(10, parseInt(ticketQtyInput.value) || 2));

        // Controls
        const selectorInput = document.getElementById('etm-element-selector');
        const nameInput = document.getElementById('etm-element-name');
        selectorInput.value = config.selectedElementSelector;
        nameInput.value = config.selectedElementName;
        selectorInput.oninput = () => config.selectedElementSelector = selectorInput.value.trim();
        nameInput.oninput = () => config.selectedElementName = nameInput.value.trim();
    }

    // --- Initialize GUI ---
    function initGUI() {
        injectStyles();
        createGUI();
        setupGUIEvents();
        bindSettings();
    }

    // --- Run GUI on page load ---
    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', initGUI);
    } else {
        initGUI();
    }

    // --- Phase 3: Element Selection System ---
    function injectEyedropperStyles() {
        if (document.getElementById('etm-eyedropper-styles')) return;
        const style = document.createElement('style');
        style.id = 'etm-eyedropper-styles';
        style.textContent = `
        .etm-eyedropper-hover {
            outline: 3px solid gold !important;
            outline-offset: 2px !important;
            box-shadow: 0 0 12px 3px gold !important;
            transition: box-shadow 0.2s, outline 0.2s;
            pointer-events: none !important;
        }
        .etm-eyedropper-selected {
            outline: 3px solid gold !important;
            outline-offset: 2px !important;
            box-shadow: 0 0 18px 6px gold !important;
            animation: etm-pulse-glow 1.2s infinite alternate;
        }
        @keyframes etm-pulse-glow {
            0% { box-shadow: 0 0 18px 6px gold; }
            100% { box-shadow: 0 0 32px 12px gold; }
        }
        `;
        document.head.appendChild(style);
        console.log('[Eventim Monitor] Eyedropper styles injected');
    }

    // Utility: Check if node is inside GUI
    function isInsideGUI(node) {
        return node.closest && node.closest('#etm-monitor-gui');
    }

    // Utility: Generate robust selector
    function generateSelector(el) {
        if (!el) return '';
        console.log('[Eventim Monitor] Generating selector for:', el);
        // 1. ID
        if (el.id) return `#${el.id}`;
        // 2. data-qa
        if (el.hasAttribute('data-qa')) return `[data-qa="${el.getAttribute('data-qa')}"]`;
        // 3. Stepper/button classes
        const stepperClasses = ['js-stepper-more', 'btn-stepper-right'];
        for (const cls of stepperClasses) {
            if (el.classList.contains(cls)) return `.${cls}`;
        }
        // 4. data-unit-value
        if (el.hasAttribute('data-unit-value')) return `[data-unit-value="${el.getAttribute('data-unit-value')}"]`;
        // 5. Combined classes
        if (el.className) {
            const classes = Array.from(el.classList).filter(c => c && !c.startsWith('etm-'));
            if (classes.length) return '.' + classes.join('.');
        }
        // 6. Tag fallback
        return el.tagName.toLowerCase();
    }

    // Utility: Extract human-readable name
    function extractElementName(el) {
        if (!el) return '';
        console.log('[Eventim Monitor] Extracting name for:', el);
        // Try Eventim ticket structure
        let parent = el.closest('.pc-list-detail.event-list-head');
        if (parent) {
            const cat = parent.querySelector('.pc-list-category span');
            const title = parent.querySelector('.pc-list-title');
            if (cat && title) return `${cat.textContent.trim()} - ${title.textContent.trim()}`;
            if (title) return title.textContent.trim();
        }
        // Fallback: aria-label, title, text
        if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
        if (el.getAttribute('title')) return el.getAttribute('title');
        if (el.textContent && el.textContent.trim().length > 0) return el.textContent.trim();
        return el.tagName;
    }

    // Highlight tracking
    let selectedElement = null;
    function updateSelectedHighlight() {
        document.querySelectorAll('.etm-eyedropper-selected').forEach(e => e.classList.remove('etm-eyedropper-selected'));
        if (selectedElement && document.body.contains(selectedElement)) {
            selectedElement.classList.add('etm-eyedropper-selected');
        }
    }
    window.addEventListener('scroll', updateSelectedHighlight, true);
    window.addEventListener('resize', updateSelectedHighlight, true);

    // Eyedropper logic
    function activateEyedropper() {
        console.log('[Eventim Monitor] Activating eyedropper');
        injectEyedropperStyles();
        let lastHover = null;
        function onMouseMove(e) {
            const el = document.elementFromPoint(e.clientX, e.clientY);
            if (!el || isInsideGUI(el)) {
                if (lastHover) lastHover.classList.remove('etm-eyedropper-hover');
                lastHover = null;
                return;
            }
            if (lastHover && lastHover !== el) lastHover.classList.remove('etm-eyedropper-hover');
            if (!el.classList.contains('etm-eyedropper-hover')) el.classList.add('etm-eyedropper-hover');
            lastHover = el;
        }
        function onClick(e) {
            const el = document.elementFromPoint(e.clientX, e.clientY);
            if (!el || isInsideGUI(el)) return;
            e.preventDefault();
            e.stopPropagation();
            console.log('[Eventim Monitor] Element selected:', el);
            document.body.style.cursor = '';
            document.removeEventListener('mousemove', onMouseMove, true);
            document.removeEventListener('click', onClick, true);
            document.removeEventListener('keydown', onKeyDown, true);
            if (lastHover) lastHover.classList.remove('etm-eyedropper-hover');
            selectedElement = el;
            updateSelectedHighlight();
            // Save selector and name
            config.selectedElementSelector = generateSelector(el);
            config.selectedElementName = extractElementName(el);
            console.log('[Eventim Monitor] Saved selector:', config.selectedElementSelector);
            console.log('[Eventim Monitor] Saved name:', config.selectedElementName);
            // Update GUI fields
            const selectorInput = document.getElementById('etm-element-selector');
            const nameInput = document.getElementById('etm-element-name');
            if (selectorInput) selectorInput.value = config.selectedElementSelector;
            if (nameInput) nameInput.value = config.selectedElementName;
        }
        function onKeyDown(e) {
            if (e.key === 'Escape') {
                console.log('[Eventim Monitor] Eyedropper cancelled');
                document.body.style.cursor = '';
                document.removeEventListener('mousemove', onMouseMove, true);
                document.removeEventListener('click', onClick, true);
                document.removeEventListener('keydown', onKeyDown, true);
                if (lastHover) lastHover.classList.remove('etm-eyedropper-hover');
            }
        }
        document.body.style.cursor = 'crosshair';
        document.addEventListener('mousemove', onMouseMove, true);
        document.addEventListener('click', onClick, true);
        document.addEventListener('keydown', onKeyDown, true);
    }

    // Bind eyedropper to button
    function bindEyedropperButton() {
        const btn = document.getElementById('etm-btn-eyedropper');
        if (btn) {
            console.log('[Eventim Monitor] Binding eyedropper button');
            btn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                activateEyedropper();
            };
        } else {
            console.error('[Eventim Monitor] Eyedropper button not found');
        }
    }

    // Patch GUI init to bind eyedropper
    const origInitGUI = initGUI;
    initGUI = function() {
        origInitGUI();
        bindEyedropperButton();
        // Restore highlight if selector is set
        if (config.selectedElementSelector) {
            try {
                const el = document.querySelector(config.selectedElementSelector);
                if (el) {
                    selectedElement = el;
                    updateSelectedHighlight();
                }
            } catch (e) {
                console.error('[Eventim Monitor] Failed to restore highlight:', e);
            }
        }
    };

    // --- Phase 4: Discord Integration ---
    function isValidDiscordWebhook(url) {
        // Discord webhook URLs are like: https://discord.com/api/webhooks/{id}/{token}
        return /^https:\/\/(discord(app)?\.com|discord\.com)\/api\/webhooks\/[0-9]+\/[\w-]+$/i.test(url.trim());
    }

    function isValidDiscordUser(mention) {
        // Accepts <@id>, @username, or just a numeric ID
        if (!mention) return false;
        if (/^<@!?\d+>$/.test(mention)) return true;
        if (/^@\w{2,}/.test(mention)) return true;
        if (/^\d{15,20}$/.test(mention)) return true;
        return false;
    }

    async function sendDiscordTestWebhook(url, user) {
        const content = user && isValidDiscordUser(user)
            ? `${user} Test message from Eventim Ticket Monitor!`
            : 'Test message from Eventim Ticket Monitor!';
        const payload = {
            content,
            embeds: [{
                title: '🎫 Eventim Ticket Monitor',
                description: 'This is a test message. If you see this, your webhook is working! ✅',
                color: 0x00bfff
            }]
        };
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return true;
        } catch (e) {
            return false;
        }
    }

    function updateWebhookStatus(valid, msg, color) {
        const status = document.getElementById('etm-webhook-status');
        if (!status) return;
        status.textContent = msg;
        status.style.color = color;
    }

    function bindDiscordIntegration() {
        const webhookInput = document.getElementById('etm-webhook-url');
        const userInput = document.getElementById('etm-notify-user');
        const testBtn = document.getElementById('etm-test-webhook');
        const status = document.getElementById('etm-webhook-status');
        if (!webhookInput || !userInput || !testBtn || !status) return;

        function validate() {
            const url = webhookInput.value.trim();
            if (!url) {
                updateWebhookStatus(false, 'No webhook set', '#dc3545');
                return false;
            }
            if (!isValidDiscordWebhook(url)) {
                updateWebhookStatus(false, 'Invalid webhook URL', '#dc3545');
                return false;
            }
            updateWebhookStatus(true, 'Webhook looks valid', '#28a745');
            return true;
        }
        webhookInput.oninput = validate;
        userInput.oninput = function() {
            if (userInput.value && !isValidDiscordUser(userInput.value)) {
                updateWebhookStatus(false, 'User mention format invalid', '#ffc107');
            } else {
                validate();
            }
        };
        testBtn.onclick = async function() {
            if (!validate()) return;
            updateWebhookStatus(true, 'Testing...', '#ffb201');
            const ok = await sendDiscordTestWebhook(webhookInput.value, userInput.value);
            if (ok) {
                updateWebhookStatus(true, 'Test sent! Check Discord.', '#28a745');
            } else {
                updateWebhookStatus(false, 'Test failed! Check URL.', '#dc3545');
            }
        };
        // Initial validation
        validate();
    }

    // Patch GUI init to bind Discord integration
    const origInitGUI2 = initGUI;
    initGUI = function() {
        origInitGUI2();
        bindDiscordIntegration();
    };

    // --- Phase 5: Ticket Monitoring Logic ---
    let monitorInterval = null;
    let checkCount = 0;
    let monitoring = false;
    let lastButton = null;

    const fallbackSelectors = [
        () => config.selectedElementSelector,
        () => '.btn-stepper-right.js-stepper-more',
        () => '[data-qa="more-tickets"]',
        () => 'button[title="Increase amount"]',
        () => '.js-stepper-more',
        () => '.btn-stepper-right'
    ];

    function isButtonAvailable(btn) {
        if (!btn) return false;
        // Multi-strategy detection
        const disabled = btn.disabled === true;
        const hasDisabledClass = btn.classList.contains('disabled') || btn.classList.contains('sold-out');
        const dataMax = btn.getAttribute('data-max');
        const maxOk = dataMax ? parseInt(dataMax) > 0 : true;
        const opacity = window.getComputedStyle(btn).opacity;
        const cursor = window.getComputedStyle(btn).cursor;
        const ariaDisabled = btn.getAttribute('aria-disabled') === 'true';
        const visible = btn.offsetParent !== null;
        const inViewport = (() => {
            const rect = btn.getBoundingClientRect();
            return (
                rect.top >= 0 && rect.left >= 0 &&
                rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                rect.right <= (window.innerWidth || document.documentElement.clientWidth)
            );
        })();
        return !disabled && !hasDisabledClass && maxOk && opacity !== '0.5' && cursor !== 'not-allowed' && !ariaDisabled && visible && inViewport;
    }

    function findButton() {
        for (const getSelector of fallbackSelectors) {
            const sel = getSelector();
            if (!sel) continue;
            try {
                const btn = document.querySelector(sel);
                if (btn) return { btn, sel };
            } catch (e) {
                // Invalid selector, skip
            }
        }
        return { btn: null, sel: null };
    }

    function logMonitoring(checkNum, btn, sel, available, error) {
        const now = new Date();
        console.log(`%c[Eventim Monitor] Check #${checkNum} @ ${now.toLocaleTimeString()}`,
            'color:#1e3c72;font-weight:bold;',
            { selector: sel, button: btn, available, error });
        if (btn) {
            console.log('  - disabled:', btn.disabled);
            console.log('  - classes:', btn.className);
            console.log('  - data-max:', btn.getAttribute('data-max'));
            console.log('  - opacity:', window.getComputedStyle(btn).opacity);
            console.log('  - cursor:', window.getComputedStyle(btn).cursor);
            console.log('  - aria-disabled:', btn.getAttribute('aria-disabled'));
            console.log('  - visible:', btn.offsetParent !== null);
        }
        if (error) console.error('[Eventim Monitor] Error:', error);
    }

    function updateStatusSection(msg) {
        const status = document.getElementById('etm-status-content');
        if (status) status.textContent = msg;
    }

    function startMonitoring() {
        if (monitoring) return;
        monitoring = true;
        checkCount = 0;
        updateStatusSection('Monitoring started...');
        monitorInterval = setInterval(() => {
            checkCount++;
            let error = null;
            let btn, sel;
            try {
                const found = findButton();
                btn = found.btn;
                sel = found.sel;
                lastButton = btn;
                const available = isButtonAvailable(btn);
                logMonitoring(checkCount, btn, sel, available, null);
                updateStatusSection(`Check #${checkCount}: ${available ? 'AVAILABLE' : 'Not available'} (${sel || 'no selector'})`);
            } catch (e) {
                error = e;
                logMonitoring(checkCount, btn, sel, false, error);
                updateStatusSection(`Check #${checkCount}: ERROR (${e})`);
            }
        }, config.checkInterval);
    }

    function stopMonitoring() {
        monitoring = false;
        if (monitorInterval) clearInterval(monitorInterval);
        monitorInterval = null;
        updateStatusSection('Monitoring stopped.');
    }

    function bindMonitorButtons() {
        const startBtn = document.getElementById('etm-btn-start');
        const stopBtn = document.getElementById('etm-btn-stop');
        if (startBtn) startBtn.onclick = startMonitoring;
        if (stopBtn) stopBtn.onclick = stopMonitoring;
    }

    // Patch GUI init to bind monitor buttons
    const origInitGUI3 = initGUI;
    initGUI = function() {
        origInitGUI3();
        bindMonitorButtons();
    };

    // --- Phase 6: Auto-Purchase System ---
    let purchaseInProgress = false;
    let purchaseTimeout = null;

    function highlightElement(el, color = 'gold') {
        if (!el) return;
        el.style.outline = `3px solid ${color}`;
        el.style.outlineOffset = '2px';
        el.style.boxShadow = `0 0 12px 3px ${color}`;
    }

    function unhighlightElement(el) {
        if (!el) return;
        el.style.outline = '';
        el.style.outlineOffset = '';
        el.style.boxShadow = '';
    }

    function getQuantity() {
        const qtyEl = document.querySelector('.js-stepper-value');
        return qtyEl ? parseInt(qtyEl.textContent) : 0;
    }

    function findCheckoutButton() {
        const selectors = [
            '[data-qa="checkout-button"]',
            '.btn-checkout',
            'button[title="Checkout"]',
            'a[href*="checkout"]'
        ];
        for (const sel of selectors) {
            const btn = document.querySelector(sel);
            if (btn) return btn;
        }
        return null;
    }

    async function attemptPurchase() {
        if (purchaseInProgress) return;
        purchaseInProgress = true;
        updateStatusSection('Purchase in progress...');
        let error = null;
        try {
            // Step 1: Click the ticket button
            if (!lastButton) throw new Error('No ticket button found');
            highlightElement(lastButton, 'green');
            lastButton.click();
            // Step 2: Wait for quantity update
            await new Promise(resolve => setTimeout(resolve, 1000));
            const qty = getQuantity();
            if (qty < config.ticketQuantity) {
                throw new Error(`Quantity mismatch: got ${qty}, expected ${config.ticketQuantity}`);
            }
            // Step 3: Click checkout
            const checkoutBtn = findCheckoutButton();
            if (!checkoutBtn) throw new Error('Checkout button not found');
            highlightElement(checkoutBtn, 'green');
            checkoutBtn.click();
            updateStatusSection('Purchase sequence completed!');
        } catch (e) {
            error = e;
            updateStatusSection(`Purchase error: ${e.message}`);
        } finally {
            purchaseInProgress = false;
            if (lastButton) unhighlightElement(lastButton);
            const checkoutBtn = findCheckoutButton();
            if (checkoutBtn) unhighlightElement(checkoutBtn);
        }
    }

    // Patch monitoring logic to trigger purchase
    const origStartMonitoring = startMonitoring;
    startMonitoring = function() {
        origStartMonitoring();
        purchaseTimeout = setInterval(() => {
            if (monitoring && lastButton && isButtonAvailable(lastButton)) {
                attemptPurchase();
            }
        }, config.checkInterval);
    };

    const origStopMonitoring = stopMonitoring;
    stopMonitoring = function() {
        origStopMonitoring();
        if (purchaseTimeout) clearInterval(purchaseTimeout);
        purchaseTimeout = null;
    };

    // --- Phase 7: Audio Alert System ---
    let audioContext = null;
    let alertInterval = null;

    function initAudio() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    function playAlertSound() {
        initAudio();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.2);
    }

    function startAlertLoop() {
        if (alertInterval) clearInterval(alertInterval);
        playAlertSound();
        alertInterval = setInterval(playAlertSound, config.alertSoundInterval);
    }

    function stopAlertLoop() {
        if (alertInterval) clearInterval(alertInterval);
        alertInterval = null;
    }

    function bindAudioTestButton() {
        const testBtn = document.getElementById('etm-test-alert');
        if (testBtn) testBtn.onclick = playAlertSound;
    }

    // Patch monitoring logic to trigger alerts
    const origStartMonitoring2 = startMonitoring;
    startMonitoring = function() {
        origStartMonitoring2();
        if (lastButton && isButtonAvailable(lastButton)) {
            startAlertLoop();
        }
    };

    const origStopMonitoring2 = stopMonitoring;
    stopMonitoring = function() {
        origStopMonitoring2();
        stopAlertLoop();
    };

    // Patch GUI init to bind audio test button
    const origInitGUI4 = initGUI;
    initGUI = function() {
        origInitGUI4();
        bindAudioTestButton();
    };

    // --- Phase 8: Persistence ---
    const STORAGE_KEY_STATE = 'eventimTicketMonitorState';

    function saveState() {
        const state = {
            monitoring,
            selectedElementSelector: config.selectedElementSelector,
            selectedElementName: config.selectedElementName,
            lastButton: lastButton ? generateSelector(lastButton) : null
        };
        try {
            localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(state));
        } catch (e) {
            console.error('[Eventim Monitor] Failed to save state:', e);
        }
    }

    function loadState() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY_STATE);
            if (stored) {
                const state = JSON.parse(stored);
                if (state.monitoring) startMonitoring();
                if (state.selectedElementSelector) {
                    config.selectedElementSelector = state.selectedElementSelector;
                    config.selectedElementName = state.selectedElementName;
                    const el = document.querySelector(state.selectedElementSelector);
                    if (el) {
                        selectedElement = el;
                        updateSelectedHighlight();
                    }
                }
                if (state.lastButton) {
                    const btn = document.querySelector(state.lastButton);
                    if (btn) lastButton = btn;
                }
            }
        } catch (e) {
            console.error('[Eventim Monitor] Failed to load state:', e);
        }
    }

    // Patch monitoring logic to save state
    const origStartMonitoring3 = startMonitoring;
    startMonitoring = function() {
        origStartMonitoring3();
        saveState();
    };

    const origStopMonitoring3 = stopMonitoring;
    stopMonitoring = function() {
        origStopMonitoring3();
        saveState();
    };

    // Patch GUI init to load state
    const origInitGUI5 = initGUI;
    initGUI = function() {
        origInitGUI5();
        loadState();
    };

    // --- Phase 9: Discord Alerts ---
    async function sendDiscordAlert() {
        if (!config.webhookUrl || !isValidDiscordWebhook(config.webhookUrl)) return;
        const content = config.notifyUser && isValidDiscordUser(config.notifyUser)
            ? `${config.notifyUser} Ticket available!`
            : 'Ticket available!';
        const payload = {
            content,
            embeds: [{
                title: '🎫 Eventim Ticket Monitor',
                description: `**${config.selectedElementName || 'Ticket'}** is available!`,
                fields: [
                    { name: 'Quantity', value: config.ticketQuantity.toString(), inline: true },
                    { name: 'Link', value: window.location.href, inline: true }
                ],
                color: 0x00bfff
            }]
        };
        try {
            const res = await fetch(config.webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('HTTP ' + res.status);
        } catch (e) {
            console.error('[Eventim Monitor] Discord alert failed:', e);
        }
    }

    // Patch monitoring logic to trigger Discord alerts
    const origStartMonitoring4 = startMonitoring;
    startMonitoring = function() {
        origStartMonitoring4();
        if (lastButton && isButtonAvailable(lastButton)) {
            sendDiscordAlert();
        }
    };

    // --- Phase 10: Advanced Features ---
    const broadcastChannel = new BroadcastChannel('eventim-ticket-monitor');
    let lastRequestTime = 0;
    const RATE_LIMIT_MS = 1000; // 1 second between requests
    const MAX_RETRIES = 3;

    broadcastChannel.onmessage = function(e) {
        if (e.data.type === 'state') {
            const state = e.data.state;
            if (state.monitoring) startMonitoring();
            if (state.selectedElementSelector) {
                config.selectedElementSelector = state.selectedElementSelector;
                config.selectedElementName = state.selectedElementName;
                const el = document.querySelector(state.selectedElementSelector);
                if (el) {
                    selectedElement = el;
                    updateSelectedHighlight();
                }
            }
        }
    };

    function broadcastState() {
        const state = {
            monitoring,
            selectedElementSelector: config.selectedElementSelector,
            selectedElementName: config.selectedElementName
        };
        broadcastChannel.postMessage({ type: 'state', state });
    }

    function rateLimit() {
        const now = Date.now();
        if (now - lastRequestTime < RATE_LIMIT_MS) {
            return false;
        }
        lastRequestTime = now;
        return true;
    }

    async function retryFetch(url, options, retries = MAX_RETRIES) {
        try {
            const res = await fetch(url, options);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res;
        } catch (e) {
            if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                return retryFetch(url, options, retries - 1);
            }
            throw e;
        }
    }

    // Patch monitoring logic to use rate limiting and retry logic
    const origStartMonitoring5 = startMonitoring;
    startMonitoring = function() {
        origStartMonitoring5();
        broadcastState();
    };

    const origStopMonitoring5 = stopMonitoring;
    stopMonitoring = function() {
        origStopMonitoring5();
        broadcastState();
    };

    // Patch Discord alert to use rate limiting and retry logic
    const origSendDiscordAlert = sendDiscordAlert;
    sendDiscordAlert = async function() {
        if (!rateLimit()) return;
        try {
            await origSendDiscordAlert();
        } catch (e) {
            console.error('[Eventim Monitor] Discord alert failed:', e);
            updateStatusSection(`Discord alert failed: ${e.message}`);
        }
    };

})(); 