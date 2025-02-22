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

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background script received message:', message);
  console.log('Message sender:', sender);

  if (message.action === 'NEW_TRADE') {
    try {
      console.log('Received NEW_TRADE message:', message);
      const trade = message.trade;
      
      // Play sound based on trade type
      console.log('Attempting to play sound for type:', trade.type);
      Promise.resolve(playSoundInTab(trade.type, sender.tab.id))
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
              console.error('Last error details:', chrome.runtime.lastError);
              sendResponse({ success: false, error: chrome.runtime.lastError });
            } else {
              console.log('Notification created with ID:', notificationId);
              sendResponse({ success: true, notificationId });
            }
          });
        })
        .catch(error => {
          console.error('Error in trade handling:', error);
          sendResponse({ success: false, error: error.message });
        });
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

// Request wake lock when possible
async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      const wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => {
        console.log('Wake Lock released');
        // Try to reacquire
        setTimeout(requestWakeLock, 1000);
      });
    }
  } catch (err) {
    console.error(`Wake Lock error: ${err.name}, ${err.message}`);
  }
}

// Handle system suspend/resume
chrome.power.onSuspend.addListener(() => {
  console.log('System suspending - saving state');
  // Save any important state
});

chrome.power.onResume.addListener(() => {
  console.log('System resuming - restoring state');
  requestWakeLock();
  // Restore monitoring state
}); 