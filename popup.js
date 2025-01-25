// Get current tab URL and update UI accordingly
async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// Update UI based on monitoring status
function updateStatus(isMonitoring) {
  const statusDiv = document.getElementById('currentStatus');
  const toggleCheckbox = document.getElementById('toggleMonitoring');
  
  statusDiv.textContent = isMonitoring ? 'Monitoring Active' : 'Monitoring Inactive';
  statusDiv.className = `status ${isMonitoring ? 'active' : 'inactive'}`;
  toggleCheckbox.checked = isMonitoring;
}

// Initialize popup
async function initPopup() {
  const tab = await getCurrentTab();
  
  // Get stored monitoring state for this URL
  const url = new URL(tab.url);
  const key = `monitor_${url.pathname}`;
  
  chrome.storage.local.get([key, `${key}_prefs`], (result) => {
    const isMonitoring = result[key] || false;
    const prefs = result[`${key}_prefs`] || { theme: 'default' };
    updateStatus(isMonitoring);
    document.getElementById('themeSelect').value = prefs.theme;
  });
  
  // Handle toggle changes
  document.getElementById('toggleMonitoring').addEventListener('change', async (e) => {
    const isMonitoring = e.target.checked;
    const tab = await getCurrentTab();
    const url = new URL(tab.url);
    const key = `monitor_${url.pathname}`;
    
    // Store the monitoring state
    chrome.storage.local.set({ [key]: isMonitoring });
    
    // Update content script
    chrome.tabs.sendMessage(tab.id, {
      action: 'TOGGLE_MONITORING',
      isMonitoring: isMonitoring
    });
    
    updateStatus(isMonitoring);
  });
  
  // Handle theme changes
  document.getElementById('themeSelect').addEventListener('change', async (e) => {
    const theme = e.target.value;
    const tab = await getCurrentTab();
    const url = new URL(tab.url);
    const key = `monitor_${url.pathname}_prefs`;
    
    chrome.storage.local.get([key], (result) => {
      const prefs = result[key] || {};
      prefs.theme = theme;
      chrome.storage.local.set({ [key]: prefs });
      
      // Update content script
      chrome.tabs.sendMessage(tab.id, {
        action: 'UPDATE_THEME',
        theme: theme
      });
    });
  });
  
  // Options button
  document.getElementById('openOptions').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Reset page settings
  document.getElementById('resetPage').addEventListener('click', async () => {
    const tab = await getCurrentTab();
    const url = new URL(tab.url);
    const baseKey = `monitor_${url.pathname}`;
    
    // Clear all settings for this page
    chrome.storage.local.remove([
      `infopos_${url.pathname}`,
      `${baseKey}_prefs`,
      `${baseKey}_size`
    ]);
    
    // Notify content script
    chrome.tabs.sendMessage(tab.id, {
      action: 'RESET_ALL'
    });
  });

  // Check notification permission
  const notificationPermission = await checkNotificationPermission();
  if (notificationPermission !== 'granted') {
    const permissionDiv = document.createElement('div');
    permissionDiv.className = 'notification-permission';
    permissionDiv.innerHTML = `
      <div class="warning">
        Notifications are not enabled
        <button id="enableNotifications">Enable Notifications</button>
      </div>
    `;
    document.body.insertBefore(permissionDiv, document.body.firstChild);
    
    document.getElementById('enableNotifications').addEventListener('click', async () => {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        permissionDiv.remove();
      }
    });
  }
}

async function checkNotificationPermission() {
  // Check if browser supports notifications
  if (!('Notification' in window)) {
    console.error('This browser does not support notifications');
    return 'denied';
  }
  
  // Check if permission is already granted
  if (Notification.permission === 'granted') {
    return 'granted';
  }
  
  return Notification.permission;
}

document.addEventListener('DOMContentLoaded', initPopup); 