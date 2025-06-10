// ==UserScript==
// @name         Eventim Rock am Ring 2026 Ticket Monitor
// @namespace    http://tampermonkey.net/
// @version      2.3.0
// @description  Monitor Rock am Ring 2026 tickets with GUI controls (refactored and improved)
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

    // --- Configuration and State ---
    let config = {
        refreshInterval: 30000,
        checkInterval: 15000,
        discordUpdateInterval: 600000,
        alertSoundInterval: 10000,
        ticketQuantity: 2,
        webhookUrl: '',
        notifyUser: '',
        selectedElementSelector: '',
        selectedElementName: '',
        guiCollapsedStates: {
            settings: false,
            discord: false
        },
        iframeMode: false
    };
    let monitorInterval = null;
    let checkCount = 0;
    let startTime = Date.now();
    let ticketsFound = false;
    let isMonitoring = false;
    let isSelectingElement = false;
    let selectedElement = null;
    let elementHighlight = null;
    let lastDiscordUpdate = 0;

    // --- Storage Helpers ---
    function loadSettings() {
        try {
            const saved = localStorage.getItem('eventim_monitor_settings');
            if (saved) {
                Object.assign(config, JSON.parse(saved));
                const savedData = JSON.parse(saved);
                checkCount = savedData.checkCount !== undefined ? savedData.checkCount : 0;
            }
        } catch (e) { logDebug('Could not load settings:', e); }
    }
    function saveSettings() {
        try {
            const settingsToSave = { ...config, checkCount: checkCount };
            localStorage.setItem('eventim_monitor_settings', JSON.stringify(settingsToSave));
        } catch (e) { logDebug('Could not save settings:', e); }
    }

    // --- GUI Creation ---
    function createGUI() {
        if (document.getElementById('eventim-monitor-gui')) return;
        const gui = document.createElement('div');
        gui.id = 'eventim-monitor-gui';
        gui.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999;width:380px;background:#f8f9fa;border:1px solid #dee2e6;border-radius:5px;box-shadow:0 4px 8px rgba(0,0,0,0.1);font-family:Helvetica,Arial,sans-serif;user-select:none;display:flex;flex-direction:column;max-height:calc(100vh - 40px);overflow:hidden;';
        gui.innerHTML = `
            <div id="etm-gui-header" style="background:#1e3c72;color:#fff;padding:12px 15px;font-size:1.1em;font-weight:600;letter-spacing:0.5px;display:flex;align-items:center;justify-content:space-between;border-radius:4px 4px 0 0;cursor:move;">
                <span>Eventim Ticket Monitor</span>
                <button id="etm-close-btn" style="background:none;border:none;color:#fff;font-size:1.4em;line-height:0.8;cursor:pointer;">&times;</button>
            </div>
            <div id="etm-status-bar" style="background:#e9ecef;color:#495057;font-size:0.9em;padding:8px 15px;border-bottom:1px solid #dee2e6;display:flex;align-items:center;justify-content:space-between;border-radius:0;"></div>
            <div id="etm-notification" style="display:none;padding:8px 15px;font-size:0.9em;color:#fff;background:#1e3c72;border-radius:0;"></div>
            <div style="padding:15px;flex-grow:1;overflow-y:auto;">
                <div class="etm-collapsible" data-section="settings" style="margin-bottom:15px;">
                    <div class="etm-collapser" style="font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #ced4da;"><span>⚙️ Settings</span> <span class="etm-arrow" style="font-size:0.8em;">▼</span></div>
                    <div class="etm-collapsible-content" style="padding-top:10px;">
                        <label style="display:block;margin-bottom:5px;font-size:0.9em;">Check Interval (sec):</label>
                        <input id="check-interval" type="number" min="5" max="60" style="width:100%;padding:8px;border:1px solid #ced4da;border-radius:3px;margin-bottom:10px;box-sizing:border-box;">
                        <label style="display:block;margin-bottom:5px;font-size:0.9em;">Refresh Interval (sec):</label>
                        <input id="refresh-interval" type="number" min="10" max="300" style="width:100%;padding:8px;border:1px solid #ced4da;border-radius:3px;margin-bottom:10px;box-sizing:border-box;">
                        <label style="display:block;margin-bottom:5px;font-size:0.9em;">Ticket Quantity:</label>
                        <input id="ticket-quantity" type="number" min="1" max="10" style="width:100%;padding:8px;border:1px solid #ced4da;border-radius:3px;margin-bottom:10px;box-sizing:border-box;">
                        <label style="display:flex;align-items:center;margin-bottom:10px;">
                            <input type="checkbox" id="iframe-mode-checkbox" style="margin-right:8px;">
                            <span style="font-size:0.9em;">Enable Iframe Mode (Experimental)</span>
                        </label>
                    </div>
                </div>
                <div class="etm-collapsible" data-section="discord" style="margin-bottom:15px;">
                    <div class="etm-collapser" style="font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #ced4da;"><span>💬 Discord</span> <span class="etm-arrow" style="font-size:0.8em;">▼</span></div>
                    <div class="etm-collapsible-content" style="padding-top:10px;">
                        <label style="display:block;margin-bottom:5px;font-size:0.9em;">Webhook URL:</label>
                        <input id="webhook-input" type="text" style="width:100%;padding:8px;border:1px solid #ced4da;border-radius:3px;margin-bottom:10px;box-sizing:border-box;" placeholder="https://discord.com/api/webhooks/...">
                        <label style="display:block;margin-bottom:5px;font-size:0.9em;">Notify User:</label>
                        <input id="notify-user-input" type="text" style="width:100%;padding:8px;border:1px solid #ced4da;border-radius:3px;margin-bottom:10px;box-sizing:border-box;" placeholder="@username or Discord ID">
                        <label style="display:block;margin-bottom:5px;font-size:0.9em;">Discord Update (min):</label>
                        <input id="discord-interval" type="number" min="1" max="60" style="width:100%;padding:8px;border:1px solid #ced4da;border-radius:3px;margin-bottom:10px;box-sizing:border-box;">
                        <button id="test-webhook-btn" style="padding:8px 15px;background:#007bff;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:0.9em;">Test Webhook</button>
                        <span id="webhook-status" style="margin-left:8px;font-size:0.8em;color:#6c757d;"></span>
                    </div>
                </div>
                <div style="margin-bottom:15px;">
                    <button id="eyedropper-btn" style="padding:8px 15px;background:#28a745;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:0.9em;margin-right:10px;">Select Element</button>
                    <div id="monitoring-info" style="font-size:0.85em;color:#343a40;margin-top:10px;"></div>
                </div>
                <div style="display:flex;justify-content:space-around;padding-top:10px;border-top:1px solid #dee2e6;">
                    <button id="start-btn" style="padding:10px 20px;background:#1e3c72;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:1em;flex-grow:1;margin-right:5px;">Start</button>
                    <button id="stop-btn" style="padding:10px 20px;background:#dc3545;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:1em;flex-grow:1;margin-right:5px;">Stop</button>
                    <button id="refresh-btn" style="padding:10px 20px;background:#6c757d;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:1em;flex-grow:1;">Refresh</button>
                </div>
            </div>
            <div style="background:#e9ecef;color:#6c757d;font-size:0.8em;text-align:center;padding:8px 0;border-radius:0 0 5px 5px;border-top:1px solid #dee2e6;">© Ferrywell - Private Use Only</div>
        `;
        document.body.appendChild(gui);
    }

    // --- Collapsible Sections ---
    function setupCollapsibles() {
        document.querySelectorAll('.etm-collapsible').forEach(collapsibleDiv => {
            const collapser = collapsibleDiv.querySelector('.etm-collapser');
            const content = collapsibleDiv.querySelector('.etm-collapsible-content');
            const arrow = collapsibleDiv.querySelector('.etm-arrow');
            const section = collapsibleDiv.dataset.section;

            if (config.guiCollapsedStates[section] === true) {
                content.style.display = 'none';
                arrow.textContent = '►';
            } else {
                content.style.display = '';
                arrow.textContent = '▼';
            }

            collapser.onclick = function() {
                if (content.style.display === 'none') {
                    content.style.display = '';
                    arrow.textContent = '▼';
                    config.guiCollapsedStates[section] = false;
                } else {
                    content.style.display = 'none';
                    arrow.textContent = '►';
                    config.guiCollapsedStates[section] = true;
                }
                saveSettings();
            };
        });
    }

    // --- Draggable GUI ---
    function makeDraggable(el, handle) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        handle.onmousedown = dragMouseDown;
        function dragMouseDown(e) {
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }
        function elementDrag(e) {
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            el.style.top = (el.offsetTop - pos2) + "px";
            el.style.left = (el.offsetLeft - pos1) + "px";
        }
        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }

    // --- Notification Helper ---
    let notificationTimeout = null;
    function showNotification(msg, color = '#1e3c72', persist = false) {
        const note = document.getElementById('etm-notification');
        if (!note) return;
        note.textContent = msg;
        note.style.background = color;
        note.style.display = 'block';
        if (notificationTimeout) clearTimeout(notificationTimeout);
        if (!persist) {
            notificationTimeout = setTimeout(() => { note.style.display = 'none'; }, 4000);
        }
    }

    // --- Debug Logger ---
    function logDebug(...args) {
        console.log('[EventimMonitor]', ...args);
    }

    // --- GUI Update ---
    function updateGUI() {
        document.getElementById('check-interval').value = config.checkInterval / 1000;
        document.getElementById('refresh-interval').value = config.refreshInterval / 1000;
        document.getElementById('discord-interval').value = config.discordUpdateInterval / 60000;
        document.getElementById('ticket-quantity').value = config.ticketQuantity;
        document.getElementById('webhook-input').value = config.webhookUrl || '';
        document.getElementById('notify-user-input').value = config.notifyUser || '';
        updateMonitoringInfo();
        updateStatusBar();
        updateWebhookStatus();
    }

    // --- Webhook Status ---
    function updateWebhookStatus() {
        const webhookInput = document.getElementById('webhook-input');
        const webhookStatus = document.getElementById('webhook-status');
        if (!webhookInput || !webhookStatus) return;
        const url = webhookInput.value.trim();
        if (!url) {
            webhookStatus.innerHTML = '<span style="color: #6c757d;">No webhook configured</span>';
        } else if (url.includes('discord.com/api/webhooks/')) {
            webhookStatus.innerHTML = '<span style="color: #28a745;">Valid Discord webhook</span>';
        } else {
            webhookStatus.innerHTML = '<span style="color: #ffc107;">Invalid webhook URL</span>';
        }
    }

    // --- Monitoring Info ---
    function updateMonitoringInfo() {
        const info = document.getElementById('monitoring-info');
        if (!info) return;
        if (config.selectedElementName && config.selectedElementSelector) {
            info.style.display = 'block';
            info.innerHTML = `<b>Monitoring:</b> ${config.selectedElementName}<br><span style="font-size:10px;color:#adb5bd;">CSS: ${config.selectedElementSelector}</span>`;
        } else {
            info.style.display = 'block';
            info.innerHTML = '<span style="color:#ffc107;">No element selected! Click "Select Element" and then click the + button you want to monitor.</span>';
        }
    }

    // --- Status Bar Update ---
    function updateStatusBar() {
        const statusEl = document.getElementById('etm-status-bar');
        if (!statusEl) return;
        let status = '';
        if (ticketsFound) {
            status = '<span style="color:#28a745;font-weight:600;">Tickets in cart!</span>';
        } else if (isMonitoring) {
            status = '<span style="color:#1e3c72;">Monitoring...</span>';
        } else {
            status = '<span style="color:#ffc107;">Stopped</span>';
        }
        statusEl.innerHTML = `Status: ${status} <span>Checks: ${checkCount}</span>`;
    }

    // --- Auto-Refresh Logic ---
    let refreshIntervalId = null;
    function startAutoRefresh() {
        if (refreshIntervalId) clearInterval(refreshIntervalId);
        if (config.refreshInterval > 0) {
            refreshIntervalId = setInterval(() => {
                logDebug('Auto-refreshing page');
                showNotification('Auto-refreshing page...', '#1e3c72');
                if (config.iframeMode && contentIframe && contentIframe.contentWindow) {
                    logDebug('Reloading iframe.');
                    contentIframe.contentWindow.location.reload();
                } else {
                    logDebug('Reloading main window.');
                    window.location.reload();
                }
            }, config.refreshInterval);
        }
    }
    function stopAutoRefresh() {
        if (refreshIntervalId) clearInterval(refreshIntervalId);
        refreshIntervalId = null;
    }

    // --- Save Settings from GUI ---
    function saveSettingsFromGUI() {
        config.checkInterval = parseInt(document.getElementById('check-interval').value) * 1000;
        config.refreshInterval = parseInt(document.getElementById('refresh-interval').value) * 1000;
        config.discordUpdateInterval = parseInt(document.getElementById('discord-interval').value) * 60000;
        config.ticketQuantity = parseInt(document.getElementById('ticket-quantity').value);
        config.webhookUrl = document.getElementById('webhook-input').value.trim();
        config.notifyUser = document.getElementById('notify-user-input').value.trim();
        saveSettings();
        updateGUI();
    }

    // --- Webhook Test ---
    function testWebhook() {
        const url = document.getElementById('webhook-input').value.trim();
        if (!url) { showNotification('Please enter a webhook URL first', '#dc3545'); return; }
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                embeds: [{
                    title: 'Test Message',
                    description: 'Webhook test successful!',
                    color: 0x00d4aa,
                    timestamp: new Date().toISOString()
                }]
            })
        }).then(function(response) {
            if (response.ok) {
                showNotification('Webhook test successful!', '#28a745');
            } else {
                showNotification('Webhook test failed. Check your URL.', '#dc3545');
            }
        }).catch(function(error) {
            showNotification('Webhook test failed: ' + error.message, '#dc3545');
        });
    }

    // --- Iframe Mode Logic ---
    let contentIframe = null;
    function enableIframeMode() {
        logDebug('Enabling Iframe Mode');
        showNotification('Enabling Iframe Mode (Experimental)... Page will reload.', '#ffc107', true);

        // Hide current page content
        document.body.style.visibility = 'hidden';

        // Create iframe
        contentIframe = document.createElement('iframe');
        contentIframe.id = 'eventim-content-iframe';
        contentIframe.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;border:none;z-index:99998;';
        contentIframe.src = window.location.href;
        document.body.appendChild(contentIframe);

        // Ensure GUI is on top
        const gui = document.getElementById('eventim-monitor-gui');
        if (gui) gui.style.zIndex = 99999;

        // Listen for iframe load to restore visibility and possibly resume monitoring
        contentIframe.onload = function() {
            logDebug('Iframe loaded.');
            // Restore visibility after iframe content is rendered
            document.body.style.visibility = 'visible';
            // Additional checks/resumes if needed for iframe content
            restoreMonitoringState(); // Try to resume monitoring inside iframe
        };

        // Reload the page to ensure iframe takes over
        window.location.reload();
    }

    function disableIframeMode() {
        logDebug('Disabling Iframe Mode');
        showNotification('Disabling Iframe Mode... Page will reload.', '#1e3c72', true);

        if (contentIframe) {
            contentIframe.remove();
            contentIframe = null;
        }
        // Restore original body visibility (in case it was hidden by iframe mode)
        document.body.style.visibility = ''; 
        // Reload the page to revert to normal browsing
        window.location.reload();
    }

    // --- Utility to get current document context (main window or iframe) ---
    function getCurrentDocument() {
        if (config.iframeMode && contentIframe && contentIframe.contentDocument) {
            return contentIframe.contentDocument;
        }
        return document;
    }

    // --- Element Picker (adapted for iframe) ---
    function startElementSelection() {
        if (isSelectingElement) stopElementSelection(); return;
        isSelectingElement = true;
        document.body.style.cursor = 'crosshair';
        document.addEventListener('mouseover', highlightElement);
        document.addEventListener('click', selectElement, true);
        document.addEventListener('keydown', cancelSelection);
        showNotification('Element selection mode active. Click the + button you want to monitor.', '#ffc107', true);
        logDebug('Element picker activated');
    }
    function stopElementSelection() {
        isSelectingElement = false;
        document.body.style.cursor = 'default';
        document.removeEventListener('mouseover', highlightElement);
        document.removeEventListener('click', selectElement, true);
        document.removeEventListener('keydown', cancelSelection);
        removeTemporaryHighlight();
        logDebug('Element picker deactivated');
    }
    function highlightElement(event) {
        // Ensure highlight works on the current document context
        const currentDoc = getCurrentDocument();
        if (!isSelectingElement) return;
        if (event.target.closest('#eventim-monitor-gui')) return;

        removeTemporaryHighlight();
        const element = event.target;
        const highlight = currentDoc.createElement('div'); // Create highlight in current document
        highlight.className = 'element-highlight temp-highlight';
        const rect = element.getBoundingClientRect();

        // Adjust position if in iframe mode
        let top = rect.top + (config.iframeMode ? contentIframe.offsetTop : window.scrollY);
        let left = rect.left + (config.iframeMode ? contentIframe.offsetLeft : window.scrollX);

        highlight.style.cssText = `position:fixed;top:${top}px;left:${left}px;width:${rect.width}px;height:${rect.height}px;z-index:99998;border:3px solid gold;border-radius:6px;pointer-events:none;`;
        currentDoc.body.appendChild(highlight);
    }
    function selectElement(event) {
        const currentDoc = getCurrentDocument();
        if (!isSelectingElement) return;
        if (event.target.closest('#eventim-monitor-gui')) return;
        event.preventDefault();
        event.stopPropagation();
        selectedElement = event.target;
        config.selectedElementSelector = generateSelector(selectedElement);
        config.selectedElementName = getElementDisplayName(selectedElement);
        saveSettings();
        stopElementSelection();
        highlightSelectedElement();
        updateMonitoringInfo();
        showNotification('Element selected: ' + config.selectedElementName, '#28a745', true);
        logDebug('Element selected:', config.selectedElementName, config.selectedElementSelector);
    }
    function cancelSelection(event) {
        if (event.key === 'Escape') stopElementSelection();
    }
    function removeTemporaryHighlight() {
        const tempHighlight = document.querySelector('.temp-highlight');
        if (tempHighlight) tempHighlight.remove();
    }
    function highlightSelectedElement() {
        const currentDoc = getCurrentDocument();
        if (elementHighlight) elementHighlight.remove();
        if (!config.selectedElementSelector) return;
        const element = currentDoc.querySelector(config.selectedElementSelector); // Query in current document
        if (!element) {
            logDebug('Element for persistent highlight not found in current document.');
            return;
        }
        elementHighlight = currentDoc.createElement('div'); // Create highlight in current document
        elementHighlight.className = 'element-highlight';
        const rect = element.getBoundingClientRect();

        // Adjust position if in iframe mode
        let top = rect.top + (config.iframeMode ? contentIframe.offsetTop : window.scrollY);
        let left = rect.left + (config.iframeMode ? contentIframe.offsetLeft : window.scrollX);

        elementHighlight.style.cssText = `position:fixed;top:${top}px;left:${left}px;width:${rect.width}px;height:${rect.height}px;z-index:99997;border:3px solid gold;border-radius:6px;pointer-events:none;`;
        currentDoc.body.appendChild(elementHighlight); // Append to current document body
    }
    function generateSelector(element) {
        if (element.id) return '#' + element.id;
        if (element.getAttribute('data-qa')) return '[data-qa="' + element.getAttribute('data-qa') + '"]';
        if (element.className) return '.' + Array.from(element.classList).join('.');
        return element.tagName.toLowerCase();
    }
    function getElementDisplayName(element) {
        if (element.getAttribute('aria-label')) return element.getAttribute('aria-label');
        if (element.getAttribute('title')) return element.getAttribute('title');
        if (element.textContent && element.textContent.trim().length > 0) return element.textContent.trim();
        return element.tagName;
    }

    // --- Monitoring Logic (adapted for iframe) ---
    function startMonitoring() {
        if (isMonitoring) return;
        isMonitoring = true;
        ticketsFound = false;
        updateStatusBar();
        showNotification('Monitoring started.', '#1e3c72');
        logDebug('Monitoring started');
        monitorInterval = setInterval(checkAndBuyTickets, config.checkInterval);
        checkAndBuyTickets(); // Run immediately
        startAutoRefresh();
        saveMonitoringState();
    }
    function stopMonitoring() {
        isMonitoring = false;
        if (monitorInterval) clearInterval(monitorInterval);
        monitorInterval = null;
        stopAutoRefresh();
        updateStatusBar();
        showNotification('Monitoring stopped.', '#ffc107');
        logDebug('Monitoring stopped');
        saveMonitoringState();
    }
    async function checkAndBuyTickets() {
        checkCount++;
        saveSettings();
        updateStatusBar();
        showNotification('Checking for tickets... (Check #' + checkCount + ')', '#1e3c72');
        logDebug('Checking for tickets...', 'Check #' + checkCount);

        const currentDoc = getCurrentDocument(); // Get current document context
        let btn = null;
        if (config.selectedElementSelector) {
            btn = currentDoc.querySelector(config.selectedElementSelector);
        }
        if (!btn) {
            showNotification('Selected element not found on page.', '#dc3545', true);
            logDebug('Selected element not found:', config.selectedElementSelector);
            return;
        }
        if (btn.disabled || btn.classList.contains('disabled')) {
            showNotification('Tickets not available yet.', '#ffc107');
            logDebug('Tickets not available yet.');
            return;
        }
        for (let i = 0; i < config.ticketQuantity; i++) {
            btn.click();
            await new Promise(r => setTimeout(r, 200));
        }
        let cartBtn = await waitForCartButton(currentDoc); // Pass currentDoc
        if (cartBtn) {
            cartBtn.click();
            ticketsFound = true;
            updateStatusBar();
            stopMonitoring();
            showNotification('Tickets added to cart! Proceeding to checkout...', '#28a745', true);
            logDebug('Tickets added to cart! Proceeding to checkout...');
            let checkoutBtn = await waitForCheckoutButton(currentDoc); // Pass currentDoc
            if (checkoutBtn) {
                checkoutBtn.click();
                logDebug('Proceeded to checkout.');
            }
        }
    }
    function waitForCartButton(docContext, timeout = 5000) {
        return new Promise(resolve => {
            const start = Date.now();
            (function check() {
                let btn = docContext.querySelector('[data-qa="cart-button"], .add-to-cart, .btn-cart, button[aria-label*="cart"], button[aria-label*="Checkout"], button[data-qa*="checkout"]');
                if (btn && !btn.disabled && !btn.classList.contains('disabled')) return resolve(btn);
                if (Date.now() - start > timeout) return resolve(null);
                setTimeout(check, 200);
            })();
        });
    }
    function waitForCheckoutButton(docContext, timeout = 5000) {
        return new Promise(resolve => {
            const start = Date.now();
            (function check() {
                let btn = docContext.querySelector('button[data-qa*="checkout"], button[aria-label*="Checkout"], .btn-checkout');
                if (btn && !btn.disabled && !btn.classList.contains('disabled')) return resolve(btn);
                if (Date.now() - start > timeout) return resolve(null);
                setTimeout(check, 200);
            })();
        });
    }

    // --- Bind Events (add iframe toggle) ---
    function bindEvents() {
        document.getElementById('etm-close-btn').onclick = function() {
            document.getElementById('eventim-monitor-gui').style.display = 'none';
        };
        document.getElementById('test-webhook-btn').onclick = testWebhook;
        document.getElementById('eyedropper-btn').onclick = startElementSelection;
        document.getElementById('start-btn').onclick = function() { saveSettingsFromGUI(); startMonitoring(); };
        document.getElementById('stop-btn').onclick = stopMonitoring;
        document.getElementById('refresh-btn').onclick = function() { saveMonitoringState(); window.location.reload(); };
        document.getElementById('check-interval').onchange = saveSettingsFromGUI;
        document.getElementById('refresh-interval').onchange = saveSettingsFromGUI;
        document.getElementById('discord-interval').onchange = saveSettingsFromGUI;
        document.getElementById('ticket-quantity').onchange = saveSettingsFromGUI;
        document.getElementById('webhook-input').onchange = saveSettingsFromGUI;
        document.getElementById('notify-user-input').onchange = saveSettingsFromGUI;
        document.getElementById('iframe-mode-checkbox').onchange = function() {
            config.iframeMode = this.checked;
            saveSettings();
            if (config.iframeMode) {
                enableIframeMode();
            } else {
                disableIframeMode();
            }
        };
        setupCollapsibles();
        makeDraggable(document.getElementById('eventim-monitor-gui'), document.getElementById('etm-gui-header'));

        // Ensure GUI starts on top if iframe mode is active on load
        if (config.iframeMode) {
            const gui = document.getElementById('eventim-monitor-gui');
            if (gui) gui.style.zIndex = 99999;
        }
    }

    // --- Initialization (check for iframe mode on init) ---
    function init() {
        loadSettings();
        createGUI();
        updateGUI();
        bindEvents();

        // Apply iframe mode or highlight based on saved state
        if (config.iframeMode) {
            enableIframeMode(); // This will reload the page into the iframe
        } else {
            highlightSelectedElement();
        }

        // Update iframe checkbox state
        const iframeCheckbox = document.getElementById('iframe-mode-checkbox');
        if (iframeCheckbox) iframeCheckbox.checked = config.iframeMode;
    }

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})(); 