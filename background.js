// Handle sounds and notifications
const SOUND_CONFIG = {
  BUY: 'sounds/buy.wav',
  SELL: 'sounds/sell.wav'
};

// Function to play sound through a tab
function playSoundInTab(type, tabId) {
  return new Promise((resolve, reject) => {
    const soundUrl = chrome.runtime.getURL(SOUND_CONFIG[type.toUpperCase()]);
    console.log('Playing sound in tab:', soundUrl);

    // Inject audio element into the tab
    chrome.scripting.executeScript({
      target: { tabId },
      func: (soundUrl) => {
        // Create a muted audio context first
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        audioContext.resume().then(() => {
          const audio = new Audio(soundUrl);
          // Add user gesture requirement warning
          audio.onplay = () => {
            console.log('Audio played successfully');
          };
          audio.onerror = (e) => {
            console.error('Audio playback failed:', e);
          };
          audio.play()
            .catch(error => {
              console.warn('Audio autoplay blocked. Will play on next user interaction.');
              // Store the audio for later
              window._pendingTradeSound = audio;
              // Try to play on next user interaction
              const playOnInteraction = () => {
                if (window._pendingTradeSound) {
                  window._pendingTradeSound.play()
                    .then(() => {
                      window._pendingTradeSound = null;
                      document.removeEventListener('click', playOnInteraction);
                    })
                    .catch(console.error);
                }
              };
              document.addEventListener('click', playOnInteraction, { once: true });
            });
        });
      },
      args: [soundUrl]
    })
    .then(() => {
      console.log('Sound injection successful');
      resolve();
    })
    .catch((error) => {
      console.error('Error injecting sound:', error);
      reject(error);
    });
  });
}

// Separate function to handle trade notifications
function playTradeNotification(trade, tabId, sendResponse) {
  console.log('Playing trade notification for:', trade.type);
  
  // Play sound based on trade type
  playSoundInTab(trade.type, tabId)
    .then(() => {
      // Create notification
      console.log('Creating notification for trade:', trade);
      chrome.notifications.create('', {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icon48.png'),
        title: `${trade.type} Alert`,
        message: `${trade.tokenName}: ${trade.totalUSD} @ ${trade.price}`,
        priority: 2
      }, (notificationId) => {
        if (chrome.runtime.lastError) {
          console.error('Notification creation failed:', chrome.runtime.lastError);
          sendResponse({ success: false, error: chrome.runtime.lastError });
        } else {
          console.log('Notification created with ID:', notificationId);
          sendResponse({ success: true, notificationId });
        }
      });
    })
    .catch(error => {
      console.error('Error in trade handling:', error);
      // Still try to create notification even if sound fails
      chrome.notifications.create('', {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icon48.png'),
        title: `${trade.type} Alert`,
        message: `${trade.tokenName}: ${trade.totalUSD} @ ${trade.price}`,
        priority: 2
      }, (notificationId) => {
        if (chrome.runtime.lastError) {
          console.error('Notification creation failed:', chrome.runtime.lastError);
          sendResponse({ success: false, error: chrome.runtime.lastError });
        } else {
          console.log('Notification created with ID (sound failed):', notificationId);
          sendResponse({ success: true, notificationId, soundError: error.message });
        }
      });
    });
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background script received message:', message);
  console.log('Message sender:', sender);

  if (message.action === 'NEW_TRADE') {
    try {
      console.log('Received NEW_TRADE message:', message);
      const trade = message.trade;
      
      // Store the trade first
      storeTrade(trade);
      
      // Check if we have a valid tab ID
      const tabId = sender.tab?.id;
      if (!tabId) {
        console.warn('No tab ID available, getting active tab');
        // Get the current active tab
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
          if (tabs[0]) {
            playTradeNotification(trade, tabs[0].id, sendResponse);
          } else {
            console.error('No active tab found');
            sendResponse({ success: false, error: 'No active tab found' });
          }
        });
        return true; // Keep the message port open
      }
      
      // Play sound and show notification
      playTradeNotification(trade, tabId, sendResponse);
      
    } catch (error) {
      console.error('Error in message handler:', error);
      sendResponse({ success: false, error: error.message });
    }
  }
  
  // Required for async sendResponse
  return true;
});

// Store trade in chrome.storage
function storeTrade(trade) {
  chrome.storage.local.get(['tradeHistory'], (result) => {
    const history = result.tradeHistory || [];
    history.push(trade);
    
    // Keep only last 1000 trades
    if (history.length > 1000) {
      history.shift();
    }
    
    chrome.storage.local.set({ tradeHistory: history });
  });
}

// Keep service worker alive
chrome.runtime.onStartup.addListener(() => {
  keepAlive();
});

function keepAlive() {
  chrome.runtime.getPlatformInfo(() => {
    setTimeout(keepAlive, 25000);
  });
}

// Initialize service worker
console.log('Background service worker initialized'); 