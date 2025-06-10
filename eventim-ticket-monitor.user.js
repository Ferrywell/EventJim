// ==UserScript==
// @name         Eventim Rock am Ring 2026 Ticket Monitor
// @namespace    http://tampermonkey.net/
// @version      2.0
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
        selectedElementName: ''
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
            if (saved) Object.assign(config, JSON.parse(saved));
        } catch (e) { console.log('Could not load settings:', e); }
    }
    function saveSettings() {
        try {
            localStorage.setItem('eventim_monitor_settings', JSON.stringify(config));
        } catch (e) { console.log('Could not save settings:', e); }
    }

    // --- GUI Creation ---
    function createGUI() {
        if (document.getElementById('eventim-monitor-gui')) return;
        const gui = document.createElement('div');
        gui.id = 'eventim-monitor-gui';
        gui.style.cssText = 'position:fixed;top:40px;right:40px;z-index:99999;width:350px;background:#fff;border:2px solid #1e3c72;border-radius:10px;box-shadow:0 8px 32px rgba(30,60,114,0.18);font-family:Helvetica,Arial,sans-serif;';
        gui.innerHTML = `
            <div style="background:linear-gradient(90deg,#1e3c72 0%,#2a5298 100%);color:#fff;padding:14px 18px 10px 18px;font-size:1.18rem;font-weight:700;letter-spacing:1px;display:flex;align-items:center;justify-content:space-between;border-radius:10px 10px 0 0;">
                <span>Eventim Ticket Monitor</span>
                <button id="etm-close-btn" style="background:none;border:none;color:#fff;font-size:1.2em;cursor:pointer;">&times;</button>
            </div>
            <div style="padding:18px;">
                <div style="margin-bottom:16px;">
                    <label>Webhook URL:</label>
                    <input id="webhook-input" type="text" style="width:100%;margin-bottom:6px;" placeholder="https://discord.com/api/webhooks/...">
                    <label>Notify User:</label>
                    <input id="notify-user-input" type="text" style="width:100%;margin-bottom:6px;" placeholder="@username or Discord ID">
                    <button id="test-webhook-btn" style="margin-bottom:8px;">Test Webhook</button>
                    <span id="webhook-status" style="margin-left:8px;font-size:0.97em;"></span>
                </div>
                <div style="margin-bottom:16px;">
                    <label>Check Interval (sec):</label>
                    <input id="check-interval" type="number" min="5" max="60" style="width:100%;margin-bottom:6px;">
                    <label>Refresh Interval (sec):</label>
                    <input id="refresh-interval" type="number" min="10" max="300" style="width:100%;margin-bottom:6px;">
                    <label>Discord Update (min):</label>
                    <input id="discord-interval" type="number" min="1" max="60" style="width:100%;margin-bottom:6px;">
                    <label>Ticket Quantity:</label>
                    <input id="ticket-quantity" type="number" min="1" max="10" style="width:100%;margin-bottom:6px;">
                </div>
                <div style="margin-bottom:16px;">
                    <button id="eyedropper-btn" style="margin-bottom:8px;">Select Element</button>
                    <div id="monitoring-info" style="font-size:12px;color:#1e3c72;margin-bottom:8px;"></div>
                </div>
                <div style="margin-bottom:16px;">
                    <button id="start-btn">Start</button>
                    <button id="stop-btn">Stop</button>
                    <button id="refresh-btn">Refresh</button>
                </div>
                <div id="status-content" style="font-size:13px;color:#495057;margin-bottom:8px;"></div>
            </div>
            <div style="background:#f8fafc;color:#495057;font-size:0.95em;text-align:center;padding:10px 0 10px 0;border-radius:0 0 10px 10px;">© Ferrywell - Private Use Only</div>
        `;
        document.body.appendChild(gui);
    }

    // --- GUI Update ---
    function updateGUI() {
        // Set input values from config
        document.getElementById('check-interval').value = config.checkInterval / 1000;
        document.getElementById('refresh-interval').value = config.refreshInterval / 1000;
        document.getElementById('discord-interval').value = config.discordUpdateInterval / 60000;
        document.getElementById('ticket-quantity').value = config.ticketQuantity;
        document.getElementById('webhook-input').value = config.webhookUrl || '';
        document.getElementById('notify-user-input').value = config.notifyUser || '';
        updateMonitoringInfo();
        updateStatusDisplay();
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

    // --- Status Display ---
    function updateStatusDisplay() {
        const statusEl = document.getElementById('status-content');
        if (!statusEl) return;
        let status = '';
        if (ticketsFound) {
            status = '<span style="color:#28a745;">Tickets Found!</span>';
        } else if (isMonitoring) {
            status = '<span style="color:#1e3c72;">Monitoring...</span>';
        } else {
            status = '<span style="color:#ffc107;">Stopped</span>';
        }
        statusEl.innerHTML = `Status: ${status}<br>Checks: ${checkCount}`;
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
        if (!url) { alert('Please enter a webhook URL first'); return; }
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
                alert('Webhook test successful!');
            } else {
                alert('Webhook test failed. Check your URL.');
            }
        }).catch(function(error) {
            alert('Webhook test failed: ' + error.message);
        });
    }

    // --- Element Picker ---
    function startElementSelection() {
        if (isSelectingElement) { stopElementSelection(); return; }
        isSelectingElement = true;
        document.body.style.cursor = 'crosshair';
        document.addEventListener('mouseover', highlightElement);
        document.addEventListener('click', selectElement, true);
        document.addEventListener('keydown', cancelSelection);
        alert('Element selection mode active. Click on the + button you want to monitor.');
    }
    function stopElementSelection() {
        isSelectingElement = false;
        document.body.style.cursor = 'default';
        document.removeEventListener('mouseover', highlightElement);
        document.removeEventListener('click', selectElement, true);
        document.removeEventListener('keydown', cancelSelection);
        removeTemporaryHighlight();
    }
    function highlightElement(event) {
        if (!isSelectingElement) return;
        if (event.target.closest('#eventim-monitor-gui')) return;
        removeTemporaryHighlight();
        const element = event.target;
        const highlight = document.createElement('div');
        highlight.className = 'element-highlight temp-highlight';
        const rect = element.getBoundingClientRect();
        highlight.style.cssText = `position:fixed;top:${rect.top + window.scrollY}px;left:${rect.left + window.scrollX}px;width:${rect.width}px;height:${rect.height}px;z-index:99998;border:3px solid gold;border-radius:6px;pointer-events:none;`;
        document.body.appendChild(highlight);
    }
    function selectElement(event) {
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
        alert('Element selected: ' + config.selectedElementName);
    }
    function cancelSelection(event) {
        if (event.key === 'Escape') stopElementSelection();
    }
    function removeTemporaryHighlight() {
        const tempHighlight = document.querySelector('.temp-highlight');
        if (tempHighlight) tempHighlight.remove();
    }
    function highlightSelectedElement() {
        if (elementHighlight) elementHighlight.remove();
        if (!config.selectedElementSelector) return;
        const element = document.querySelector(config.selectedElementSelector);
        if (!element) return;
        elementHighlight = document.createElement('div');
        elementHighlight.className = 'element-highlight';
        const rect = element.getBoundingClientRect();
        elementHighlight.style.cssText = `position:fixed;top:${rect.top + window.scrollY}px;left:${rect.left + window.scrollX}px;width:${rect.width}px;height:${rect.height}px;z-index:99997;border:3px solid gold;border-radius:6px;pointer-events:none;`;
        document.body.appendChild(elementHighlight);
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

    // --- Monitoring Logic (stub, can be expanded) ---
    function startMonitoring() {
        if (isMonitoring) return;
        isMonitoring = true;
        ticketsFound = false;
        checkCount = 0;
        updateStatusDisplay();
        monitorInterval = setInterval(checkButtonAvailability, config.checkInterval);
    }
    function stopMonitoring() {
        isMonitoring = false;
        if (monitorInterval) clearInterval(monitorInterval);
        monitorInterval = null;
        updateStatusDisplay();
    }
    function checkButtonAvailability() {
        checkCount++;
        updateStatusDisplay();
        let btn = null;
        if (config.selectedElementSelector) {
            btn = document.querySelector(config.selectedElementSelector);
        }
        if (!btn) return;
        const isDisabled = btn.disabled || btn.classList.contains('disabled');
        if (!isDisabled) {
            ticketsFound = true;
            updateStatusDisplay();
            stopMonitoring();
            alert('Tickets available!');
        }
    }

    // --- Bind Events ---
    function bindEvents() {
        document.getElementById('etm-close-btn').onclick = function() {
            document.getElementById('eventim-monitor-gui').style.display = 'none';
        };
        document.getElementById('test-webhook-btn').onclick = testWebhook;
        document.getElementById('eyedropper-btn').onclick = startElementSelection;
        document.getElementById('start-btn').onclick = function() { saveSettingsFromGUI(); startMonitoring(); };
        document.getElementById('stop-btn').onclick = stopMonitoring;
        document.getElementById('refresh-btn').onclick = function() { window.location.reload(); };
        document.getElementById('check-interval').onchange = saveSettingsFromGUI;
        document.getElementById('refresh-interval').onchange = saveSettingsFromGUI;
        document.getElementById('discord-interval').onchange = saveSettingsFromGUI;
        document.getElementById('ticket-quantity').onchange = saveSettingsFromGUI;
        document.getElementById('webhook-input').onchange = saveSettingsFromGUI;
        document.getElementById('notify-user-input').onchange = saveSettingsFromGUI;
    }

    // --- Initialization ---
    function init() {
        loadSettings();
        createGUI();
        updateGUI();
        bindEvents();
        highlightSelectedElement();
    }

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})(); 