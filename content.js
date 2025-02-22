// Keep track of processed rows to avoid duplicates
let processedRows = new Set();
let isMonitoring = false;
let observer = null;
let monitorStats = null;
let infoBox = null;
let isInitialDelay = false;
let isInitialized = false;

// UI Configuration Constants
const UI_CONFIG = {
  INFOBOX: {
    MIN_WIDTH: 300,    // Minimum width of infobox in pixels
    MIN_HEIGHT: 240,   // Minimum height of infobox in pixels
    DEBUG_HEIGHT: 600  // Height of infobox when debug panel is open
  },
  DEBUG: {
    OUTPUT_HEIGHT: 200 // Max height of debug output in pixels
  }
};

const MONITOR_THEMES = {
  matrix: {
    name: 'The Matrix',
    colors: {
      background: 'rgba(0, 20, 0, 0.9)',
      border: '#00ff00',
      text: '#00ff00',
      title: '#00ff00',
      accent: 'rgba(0, 255, 0, 0.1)'
    }
  },
  cyberpunk: {
    name: 'Night City',
    colors: {
      background: 'rgba(20, 0, 30, 0.9)',
      border: '#ff00ff',
      text: '#00ffff',
      title: '#ff00ff',
      accent: 'rgba(255, 0, 255, 0.1)'
    }
  },
  hacker: {
    name: 'Elite Hacker',
    colors: {
      background: 'rgba(0, 0, 0, 0.95)',
      border: '#0f0',
      text: '#0f0',
      title: '#fff',
      accent: 'rgba(0, 255, 0, 0.1)'
    }
  },
  trader: {
    name: 'Pro Trader',
    colors: {
      background: 'rgba(28, 32, 38, 0.9)',
      border: '#ffd700',
      text: '#ffffff',
      title: '#ffd700',
      accent: 'rgba(255, 215, 0, 0.1)'
    }
  },
  crypto: {
    name: 'Bitcoin Orange',
    colors: {
      background: 'rgba(30, 20, 0, 0.9)',
      border: '#ff9900',
      text: '#ffffff',
      title: '#ff9900',
      accent: 'rgba(255, 153, 0, 0.1)'
    }
  },
  stark: {
    name: 'Stark Industries',
    colors: {
      background: 'rgba(40, 40, 45, 0.9)',
      border: '#e63e3e',
      text: '#ffffff',
      title: '#e63e3e',
      accent: 'rgba(230, 62, 62, 0.1)'
    }
  },
  wakanda: {
    name: 'Wakanda Forever',
    colors: {
      background: 'rgba(30, 0, 30, 0.9)',
      border: '#b967ff',
      text: '#ffffff',
      title: '#b967ff',
      accent: 'rgba(185, 103, 255, 0.1)'
    }
  },
  shield: {
    name: 'S.H.I.E.L.D.',
    colors: {
      background: 'rgba(20, 20, 25, 0.9)',
      border: '#3e7be6',
      text: '#ffffff',
      title: '#3e7be6',
      accent: 'rgba(62, 123, 230, 0.1)'
    }
  },
  default: {
    name: 'Default',
    colors: {
      background: 'rgba(33, 33, 33, 0.9)',
      border: 'rgba(76, 175, 80, 0.6)',
      text: '#ffffff',
      title: '#4CAF50',
      accent: 'rgba(76, 175, 80, 0.1)'
    }
  }
};

// Function to parse trade data from a row
function parseTradeRow(row) {
  try {
    // Get type from first cell
    const typeCell = row.querySelector('td:first-child');
    if (!typeCell) throw new Error('Type cell not found');
    const type = typeCell.textContent.trim().split('\n')[0];
    
    // Get token info from second cell
    const tokenCell = row.querySelector('td:nth-child(2)');
    if (!tokenCell) throw new Error('Token cell not found');
    
    // Extract text and SVG content
    let tokenTexts = [];
    let tokenSvgs = [];
    tokenCell.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.trim();
        if (text) tokenTexts.push(text);
      } else if (node.nodeName === 'svg') {
        tokenSvgs.push(node.outerHTML);
      } else if (node.textContent) {
        const text = node.textContent.trim();
        if (text) tokenTexts.push(text);
      }
    });
    const tokenName = tokenTexts.join(' - ');
    
    // Get total from third cell
    const totalCell = row.querySelector('td:nth-child(3)');
    if (!totalCell) throw new Error('Total cell not found');
    const totalUSD = totalCell.textContent.trim();
    
    // Get amount from fourth cell
    const amountCell = row.querySelector('td:nth-child(4)');
    if (!amountCell) throw new Error('Amount cell not found');
    const amount = amountCell.textContent.trim();
    
    // Get price from fifth cell
    const priceCell = row.querySelector('td:nth-child(5)');
    if (!priceCell) throw new Error('Price cell not found');
    const price = priceCell.textContent.trim();

    // Get time from the time cell (7th column)
    const timeCell = row.querySelector('td:nth-child(7)');
    if (!timeCell) throw new Error('Time cell not found');
    const timeText = timeCell.textContent.trim();
    
    // Convert relative time to timestamp
    const now = new Date();
    let timestamp = now.getTime();
    if (timeText.includes('h ago')) {
      const hours = parseInt(timeText);
      timestamp = now.getTime() - (hours * 60 * 60 * 1000);
    } else if (timeText.includes('m ago')) {
      const minutes = parseInt(timeText);
      timestamp = now.getTime() - (minutes * 60 * 1000);
    }

    return {
      type,
      tokenName,
      tokenSvgs,  // Include SVGs if needed
      totalUSD,
      amount,
      price,
      timestamp: timestamp,
      time: timeText
    };
  } catch (error) {
    console.error('Error parsing row:', error);
    console.log('Row HTML:', row.outerHTML);
    throw error;
  }
}

// Function to handle new trades
function handleNewTrade(trade) {
  if (!isMonitoring || isInitialDelay) return;
  
  // Create infobox if it doesn't exist
  if (!infoBox) {
    infoBox = createInfoBox();
    document.body.appendChild(infoBox);
  }
  
  // Add trade to log
  const logContent = infoBox.querySelector('#trade-log-content');
  if (!logContent) {
    console.error('Trade log content element not found');
    return;
  }
  
  const entry = document.createElement('div');
  entry.className = `trade-entry ${trade.type.toLowerCase()}`; // here it sets the color of the trade
  
  const timestamp = new Date().toLocaleTimeString();
  entry.innerHTML = `
    <div class="trade-timestamp">${timestamp}</div>
    ${trade.type} ${trade.tokenName}: ${trade.totalUSD} @ ${trade.price}
  `;
  
  // Ensure we're appending to the existing content
  if (logContent.firstChild) {
    logContent.insertBefore(entry, logContent.firstChild);
  } else {
    logContent.appendChild(entry);
  }
  
  // Keep only last 50 entries to prevent too much DOM content
  while (logContent.children.length > 50) {
    logContent.removeChild(logContent.lastChild);
  }

  chrome.runtime.sendMessage({
    action: 'NEW_TRADE',
    trade: trade
  });
  
  // Update stats
  if (monitorStats) {
    monitorStats.recordTrade(trade);
  }
}

// Set up the mutation observer
function setupObserver() {
  observer = new MutationObserver((mutations) => {
    if (!isMonitoring) return;
    
    // Get reference to our target trade table
    const tradeTable = document.querySelector('#tabs-leftTabs--tabpanel-2 .g-table-content table tbody');
    if (!tradeTable) return;
    
    // Get the current top row from the trade table
    const topRow = tradeTable.querySelector('tr:first-child');
    if (!topRow) return;
    
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          // Only process new rows that are added after monitoring starts
          if (node.nodeName === 'TR' && 
              !processedRows.has(node) && 
              document.readyState === 'complete') {  // Ensure page is fully loaded
            
            // Verify this TR is actually inside our trade table
            if (!tradeTable.contains(node)) {
              return;  // Skip if the TR is not in our target table
            }
            
            // Compare the content of the detected new row with the actual top row
            const newRowContent = node.textContent.trim();
            const topRowContent = topRow.textContent.trim();
            
            console.log('Comparing rows:', {
              newRow: newRowContent,
              topRow: topRowContent
            });
            
            // Only proceed if the contents match
            if (newRowContent !== topRowContent) {
              console.log('Skipping non-matching row');
              return;
            }
            
            // Log the full row HTML and structure
            console.log('Processing New Row:', {
              fullHTML: node.outerHTML,
              cells: Array.from(node.cells).map(cell => ({
                index: cell.cellIndex,
                content: cell.innerHTML,
                textContent: cell.textContent
              })),
              attributes: Array.from(node.attributes).map(attr => ({
                name: attr.name,
                value: attr.value
              }))
            });

            const trade = parseTradeRow(node);
            processedRows.add(node);
            handleNewTrade(trade);
          }
        });
      }
    });
  });

  // Start observing only after the page is fully loaded
  if (document.readyState === 'complete') {
    startObserving();
  } else {
    window.addEventListener('load', startObserving);
  }
}

function startObserving() {
  // Clear the processed rows set when starting fresh
  processedRows.clear();

  // Start observing changes to the trade table
  const tradeTable = document.querySelector('#tabs-leftTabs--tabpanel-2 .g-table-content table tbody');
  if (tradeTable) {
    observer.observe(tradeTable, {
      childList: true,
      subtree: true
    });
  }
}

// Handle monitoring toggle
function startMonitoring() {
  if (!observer) {
    setupObserver();
  }
  
  const tbody = document.querySelector('#tabs-leftTabs--tabpanel-2 .g-table-content table tbody');
  if (tbody) {
    // Set a flag to ignore trades during initial delay
    isInitialDelay = true;
    
    observer.observe(tbody, {
      childList: true,
      subtree: true
    });
    isMonitoring = true;
    
    // Create and show infobox
    if (!infoBox) {
      infoBox = createInfoBox();
    }
    infoBox.style.display = 'block';
    
    // Initialize stats
    if (!monitorStats) {
      monitorStats = new MonitorStats();
    }
    monitorStats.startUpdates();
    
    // Wait 3 seconds before processing any trades
    setTimeout(() => {
      console.log('Initial delay completed, now monitoring for new trades');
      isInitialDelay = false;
    }, 3000);
    
    // Restore saved position if exists
    const url = new URL(window.location.href);
    const posKey = `infopos_${url.pathname}`;
    chrome.storage.local.get([posKey], (result) => {
      if (result[posKey]) {
        infoBox.style.top = `${result[posKey].top}px`;
        infoBox.style.left = `${result[posKey].left}px`;
      }
    });
  }
}

// Stop monitoring
function stopMonitoring() {
  if (observer) {
    observer.disconnect();
    isMonitoring = false;
    processedRows.clear();
    
    // Hide infobox and stop updates
    if (infoBox) {
      infoBox.style.display = 'none';
    }
    if (monitorStats) {
      monitorStats.stopUpdates();
    }
  }
}

// Listen for toggle messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'TOGGLE_MONITORING') {
    if (message.isMonitoring) {
      startMonitoring();
    } else {
      stopMonitoring();
    }
  }
});

// Add the infobox HTML and styles
function createInfoBox() {
  const styles = `
    #tradeMonitorInfo {
      position: fixed;
      top: 20px;
      left: 20px;
      z-index: 10000;
      background: rgba(33, 33, 33, 0.9);
      color: #fff;
      padding: 15px;
      border-radius: 8px;
      border: 2px solid rgba(76, 175, 80, 0.6);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      font-size: 12px;
      min-width: ${UI_CONFIG.INFOBOX.MIN_WIDTH}px;
      min-height: ${UI_CONFIG.INFOBOX.MIN_HEIGHT}px;
      width: 300px;
      height: ${UI_CONFIG.INFOBOX.MIN_HEIGHT}px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      cursor: default;
      user-select: none;
      resize: both;
      overflow: auto;
    }
    #tradeMonitorInfo .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      padding-bottom: 5px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      cursor: move;
    }
    #tradeMonitorInfo .title {
      font-weight: bold;
      color: #4CAF50;
    }
    #tradeMonitorInfo .controls {
      display: flex;
      gap: 5px;
    }
    #tradeMonitorInfo .controls button {
      background: transparent;
      border: none;
      color: #fff;
      cursor: pointer;
      padding: 2px;
      opacity: 0.7;
    }
    #tradeMonitorInfo .controls button:hover {
      opacity: 1;
    }
    #tradeMonitorInfo .stats {
      display: grid;
      gap: 5px;
    }
    #tradeMonitorInfo .stat-row {
      display: flex;
      justify-content: space-between;
    }
    #tradeMonitorInfo .label {
      color: #9E9E9E;
      margin-right: 10px;
    }
    #tradeMonitorInfo .value {
      color: #fff;
    }
    #tradeMonitorInfo .last-trade {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid rgba(255,255,255,0.1);
    }
    #tradeMonitorInfo .error {
      color: #ff5252;
      margin-top: 5px;
    }
    #tradeMonitorInfo .debug-panel {
      display: none;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid rgba(255,255,255,0.1);
    }
    #tradeMonitorInfo .debug-panel.visible {
      display: block;
    }
    #tradeMonitorInfo .debug-panel .debug-title {
      color: #ff9800;
      font-weight: bold;
      margin-bottom: 8px;
    }
    #tradeMonitorInfo .debug-buttons {
      display: grid;
      gap: 5px;
    }
    #tradeMonitorInfo .debug-button {
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.2);
      color: #fff;
      padding: 4px 8px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 11px;
      text-align: left;
    }
    #tradeMonitorInfo .debug-button:hover {
      background: rgba(255,255,255,0.2);
    }
    #tradeMonitorInfo .debug-output {
      margin-top: 8px;
      padding: 8px;
      background: rgba(0,0,0,0.3);
      border-radius: 4px;
      font-family: monospace;
      font-size: 11px;
      white-space: pre-wrap;
      max-height: ${UI_CONFIG.DEBUG.OUTPUT_HEIGHT}px;
      overflow-y: auto;
    }
    #tradeMonitorInfo .debug-console-controls {
      display: flex;
      justify-content: flex-end;
      gap: 5px;
      margin: 5px 0;
    }
    #tradeMonitorInfo .icon-button {
      background: transparent;
      border: none;
      color: #fff;
      cursor: pointer;
      padding: 2px 5px;
      opacity: 0.7;
      font-size: 14px;
    }
    #tradeMonitorInfo .icon-button:hover {
      opacity: 1;
    }
    #tradeMonitorInfo .trade-log {
      max-height: 140px;
      overflow-y: auto;
      background: rgba(0,0,0,0.2);
      padding: 5px;
      border-radius: 4px;
    }
    #tradeMonitorInfo #trade-log-content {
      font-family: monospace;
      font-size: 12px;
    }
    #tradeMonitorInfo .trade-entry {
      margin: 2px 0;
      padding: 2px 4px;
      border-left: 2px solid;
    }
    #tradeMonitorInfo .trade-entry.buy {
      border-color: #4CAF50;
    }
    #tradeMonitorInfo .trade-entry.sell {
      border-color: #f44336;
    }
    #tradeMonitorInfo .trade-timestamp {
      color: #888;
      font-size: 10px;
    }
    #tradeMonitorInfo.debug-open {
      height: ${UI_CONFIG.INFOBOX.DEBUG_HEIGHT}px !important;
    }
  `;

  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);

  const infoBox = document.createElement('div');
  infoBox.id = 'tradeMonitorInfo';
  infoBox.innerHTML = `
    <div class="header">
      <div class="title">Any Trade Monitor</div>
      <div class="controls">
        <button id="copyDebug" title="Copy Debug Info">📋</button>
        <button id="toggleDebug" title="Toggle Debug Panel">🔧</button>
        <button id="reset" title="Reset">⟲</button>
      </div>
    </div>
    <div class="content">
      <div class="stats">
        <div class="stat-row">
          <span class="label">Status:</span>
          <span class="value" id="monitorStatus">Active</span>
        </div>
        <div class="stat-row">
          <span class="label">Trades Detected:</span>
          <span class="value" id="tradeCount">0</span>
        </div>
        <div class="stat-row">
          <span class="label">Time Elapsed:</span>
          <span class="value" id="timeElapsed">00:00:00</span>
        </div>
        <div class="stat-row">
          <span class="label">Memory Usage:</span>
          <span class="value" id="memoryUsage">-</span>
        </div>
      </div>
      <div class="last-trade">
        <div class="label">Last Trade:</div>
        <div class="value trade-log" id="lastTrade">
          <div id="trade-log-content">
          </div>
        </div>
      </div>
      <div id="errorMessages" class="error"></div>
      <div class="debug-panel">
        <div class="debug-title">Debug Tools</div>
        <div class="debug-buttons">
          <button class="debug-button" id="readLastTrade">📖 Read Last Transaction</button>
          <button class="debug-button" id="simulateTrade">🔄 Simulate New Trade</button>
          <button class="debug-button" id="validateDOM">🔍 Validate DOM Structure</button>
          <button class="debug-button" id="testNotifications">🔔 Test Notifications</button>
        </div>
        <div class="debug-console-controls">
          <button class="icon-button" id="copyDebugConsole" title="Copy Console">📋</button>
          <button class="icon-button" id="clearDebug" title="Clear Console">🗑️</button>
        </div>
        <div class="debug-output"></div>
      </div>
    </div>
  `;

  document.body.appendChild(infoBox);
  setupDraggable(infoBox);
  setupInfoBoxControls(infoBox);
  return infoBox;
}

// Draggable functionality
function setupDraggable(element) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  const header = element.querySelector('.header');
  header.onmousedown = dragMouseDown;

  function dragMouseDown(e) {
    if (e.target.tagName === 'BUTTON' || e.target.closest('.debug-panel')) return;
    
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
    
    const newTop = element.offsetTop - pos2;
    const newLeft = element.offsetLeft - pos1;
    
    element.style.top = newTop + "px";
    element.style.left = newLeft + "px";
    
    // Save position
    const url = new URL(window.location.href);
    const posKey = `infopos_${url.pathname}`;
    chrome.storage.local.set({
      [posKey]: { top: newTop, left: newLeft }
    });
  }

  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

class MonitorStats {
  constructor() {
    this.startTime = new Date();
    this.tradeCount = 0;
    this.lastTrade = null;
    this.errors = [];
    this.updateInterval = null;
  }

  startUpdates() {
    this.updateInterval = setInterval(() => this.updateDisplay(), 1000);
  }

  stopUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
  }

  updateDisplay() {
    const elapsedTime = Math.floor((new Date() - this.startTime) / 1000);
    const hours = Math.floor(elapsedTime / 3600);
    const minutes = Math.floor((elapsedTime % 3600) / 60);
    const seconds = elapsedTime % 60;
    
    document.getElementById('timeElapsed').textContent = 
      `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    
    // Update memory usage if available
    if (performance.memory) {
      const memoryUsage = Math.round(performance.memory.usedJSHeapSize / (1024 * 1024));
      document.getElementById('memoryUsage').textContent = `${memoryUsage}MB`;
    }
  }

  recordTrade(trade) {
    this.tradeCount++;
    this.lastTrade = trade;
    
    document.getElementById('tradeCount').textContent = this.tradeCount;

    /*
    // this is the bug
    document.getElementById('lastTrade').textContent = 
      `${trade.type} ${trade.tokenName} - ${trade.totalUSD}`;
      */
  }

  addError(error) {
    this.errors.push({ time: new Date(), message: error });
    document.getElementById('errorMessages').textContent = error;
  }

  getDebugInfo() {
    return {
      startTime: this.startTime,
      tradeCount: this.tradeCount,
      lastTrade: this.lastTrade,
      errors: this.errors,
      memoryUsage: performance.memory ? performance.memory.usedJSHeapSize : 'N/A'
    };
  }
}

// Add event listeners for infobox controls
function setupInfoBoxControls(infoBox) {
  const resetBtn = infoBox.querySelector('#reset');
  const copyDebugBtn = infoBox.querySelector('#copyDebug');

  function applyTheme(themeName) {
    const theme = MONITOR_THEMES[themeName] || MONITOR_THEMES.default;
    const colors = theme.colors;
    
    infoBox.style.background = colors.background;
    infoBox.style.borderColor = colors.border;
    infoBox.style.color = colors.text;
    infoBox.querySelector('.title').style.color = colors.title;
    
    // Update other elements
    infoBox.querySelectorAll('.stat-row .value').forEach(el => {
      el.style.color = colors.text;
    });
  }

  // Save size after resize
  let resizeTimeout;
  infoBox.addEventListener('mouseup', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      const pageUrl = new URL(window.location.href);
      const sizeKey = `monitor_${pageUrl.pathname}_size`;
      chrome.storage.local.set({
        [sizeKey]: {
          width: infoBox.offsetWidth,
          height: infoBox.offsetHeight
        }
      });
    }, 100);
  });

  // Restore saved size
  const pageUrl = new URL(window.location.href);
  const sizeKey = `monitor_${pageUrl.pathname}_size`;
  chrome.storage.local.get([sizeKey], (result) => {
    if (result[sizeKey]) {
      infoBox.style.width = `${result[sizeKey].width}px`;
      infoBox.style.height = `${result[sizeKey].height}px`;
      
      // Restore debug panel state if it was open
      if (result[sizeKey].debugOpen) {
        const debugPanel = infoBox.querySelector('.debug-panel');
        debugPanel.classList.add('visible');
        const previousHeight = result[sizeKey].previousHeight;
        infoBox.style.height = `${previousHeight}px`;
      }
    }
  });

  // Update reset button
  resetBtn.title = 'Reset';
  resetBtn.addEventListener('click', () => {
    infoBox.style.top = '20px';
    infoBox.style.left = '20px';
    infoBox.style.width = '300px';
    infoBox.style.height = '240px';
    
    // Clear saved position and preferences
    const posKey = `infopos_${pageUrl.pathname}`;
    const prefsKey = `monitor_${pageUrl.pathname}_prefs`;
    const sizeKey = `monitor_${pageUrl.pathname}_size`;
    chrome.storage.local.remove([posKey, prefsKey, sizeKey]);
    applyTheme('default');
  });

  // Handle reset message from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'RESET_ALL') {
      resetBtn.click();
    }
  });

  copyDebugBtn.addEventListener('click', () => {
    const debugInfo = monitorStats.getDebugInfo();
    navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2))
      .then(() => {
        const oldTitle = copyDebugBtn.title;
        copyDebugBtn.title = 'Copied!';
        setTimeout(() => {
          copyDebugBtn.title = oldTitle;
        }, 1000);
      });
  });

  // Listen for theme updates
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'UPDATE_THEME') {
      applyTheme(message.theme);
    }
  });

  // Load initial theme
  const prefsKey = `monitor_${pageUrl.pathname}_prefs`;
  chrome.storage.local.get([prefsKey], (result) => {
    const prefs = result[prefsKey] || { theme: 'default' };
    applyTheme(prefs.theme);
  });

  // Debug panel controls
  const toggleDebugBtn = infoBox.querySelector('#toggleDebug');
  const debugPanel = infoBox.querySelector('.debug-panel');
  const debugOutput = debugPanel.querySelector('.debug-output');
  let previousHeight = null;

  function logDebug(message, data = null) {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    
    // Log to debug panel
    debugOutput.innerHTML = `${logMessage}\n${data ? JSON.stringify(data, null, 2) : ''}\n\n${debugOutput.innerHTML}`;
    
    // Log to console
    console.log(logMessage, data);
  }

  toggleDebugBtn.addEventListener('click', () => {
    const isDebugOpen = debugPanel.style.display === 'block';
    
    debugPanel.style.display = debugPanel.style.display === 'none' ? 'block' : 'none';
    
    // Toggle debug-open class on parent
    if (debugPanel.style.display === 'block') {
      infoBox.classList.add('debug-open');
    } else {
      infoBox.classList.remove('debug-open');
    }
  });

  // Read Last Transaction
  infoBox.querySelector('#readLastTrade').addEventListener('click', () => {
    const tbody = document.querySelector('#tabs-leftTabs--tabpanel-2 .g-table-content tbody');
    if (!tbody) {
      logDebug('Error: Table body not found');
      return;
    }

    const lastRow = tbody.querySelector('tr.g-table-row:first-child');
    if (!lastRow) {
      logDebug('Error: No trades found in table');
      return;
    }

    try {
      // Log the full HTML first
      console.log('Full Row HTML:');
      console.log(lastRow.outerHTML);
      
      const trade = parseTradeRow(lastRow);
      logDebug('Last trade parsed:', trade);
      
      // Log detailed cell information for debugging
      console.log('Cell Contents:');
      console.log('Type Cell:', lastRow.querySelector('td:first-child').outerHTML);
      console.log('Token Cell:', lastRow.querySelector('td:nth-child(2)').outerHTML);
      console.log('Total Cell:', lastRow.querySelector('td:nth-child(3)').outerHTML);
      console.log('Amount Cell:', lastRow.querySelector('td:nth-child(4)').outerHTML);
      console.log('Price Cell:', lastRow.querySelector('td:nth-child(5)').outerHTML);
    } catch (error) {
      logDebug('Error parsing last trade:', error);
      console.log('Row HTML at time of error:', lastRow.outerHTML);
    }
  });

  // Simulate New Trade
  infoBox.querySelector('#simulateTrade').addEventListener('click', () => {
    const sampleTrades = [
      {
        type: "Buy",
        tokenName: "YZI",
        tokenSvgs: [],
        totalUSD: "$4,208.93",
        amount: "33.7M",
        price: "$0.00012",
        timestamp: 1737808085017,
        time: "6h ago"
      },
      {
        type: "Sell",
        tokenName: "YZI",
        tokenSvgs: [],
        totalUSD: "$4,208.93",
        amount: "33.7M",
        price: "$0.00012",
        timestamp: 1737808085017,
        time: "3h ago"
      }
    ];

    const randomTrade = sampleTrades[Math.floor(Math.random() * sampleTrades.length)];
    logDebug('Simulating trade:', randomTrade);
    handleNewTrade(randomTrade);
  });

  // Validate DOM Structure
  infoBox.querySelector('#validateDOM').addEventListener('click', () => {
    const results = {
      table: !!document.querySelector('#tabs-leftTabs--tabpanel-2 .g-table-content table'),
      tbody: !!document.querySelector('#tabs-leftTabs--tabpanel-2 .g-table-content table tbody'),
      rows: document.querySelectorAll('#tabs-leftTabs--tabpanel-2 .g-table-content table tbody tr').length,
      selectors: {
        type: !!document.querySelector('td:first-child div'),
        token: !!document.querySelector('td:nth-child(2)'),
        total: !!document.querySelector('td:nth-child(3) div'),
        amount: !!document.querySelector('td:nth-child(4) div'),
        price: !!document.querySelector('td:nth-child(5) div')
      }
    };

    logDebug('DOM Structure Validation:', results);
  });

  // Test Notifications
  infoBox.querySelector('#testNotifications').addEventListener('click', () => {
    const testTrade = {
      type: "SELL",
      tokenName: "DEBUG",
      tokenSvgs: [],
      totalUSD: "$4,208.93",
      amount: "33.7M",
      price: "$0.00012",
      timestamp: 1737808085017,
      time: "3h ago"      
    };

    console.log('Sending test trade message to background.js:', {
      action: 'NEW_TRADE',
      trade: testTrade
    });

    chrome.runtime.sendMessage({
      action: 'NEW_TRADE',
      trade: testTrade
    }, response => {
      if (chrome.runtime.lastError) {
        console.error('Error sending message:', chrome.runtime.lastError);
      } else {
        console.log('Message sent successfully, response:', response);
      }
    });

    logDebug('Test notification sent:', testTrade);
  });

  // Clear Debug Console
  infoBox.querySelector('#clearDebug').addEventListener('click', () => {
    debugOutput.innerHTML = '';
    logDebug('Debug console cleared');
  });

  // Copy Debug Console
  infoBox.querySelector('#copyDebugConsole').addEventListener('click', () => {
    const consoleText = debugOutput.textContent;
    navigator.clipboard.writeText(consoleText).then(() => {
      const copyBtn = infoBox.querySelector('#copyDebugConsole');
      const originalText = copyBtn.textContent;
      copyBtn.textContent = '✓';
      setTimeout(() => {
        copyBtn.textContent = originalText;
      }, 1000);
    });
  });
}

// Function to wait for trade table and restore monitoring
function waitForTableAndRestore() {
  if (isInitialized) return;  // Prevent multiple initializations

  // Check if monitoring was enabled
  const url = new URL(window.location.href);
  const key = `monitor_${url.pathname}`;
  
  chrome.storage.local.get([key], (result) => {
    if (result[key]) {
      // Check if table exists
      const tbody = document.querySelector('#tabs-leftTabs--tabpanel-2 .g-table-content table tbody');
      if (tbody) {
        isInitialized = true;  // Mark as initialized
        startMonitoring();
      } else {
        // If table doesn't exist yet, wait and try again
        setTimeout(waitForTableAndRestore, 500);
      }
    }
  });
}

// Try to restore only after the page is fully loaded
window.addEventListener('load', () => {
  // Give a short delay after load to ensure dynamic content is ready
  setTimeout(waitForTableAndRestore, 1000);
}); 