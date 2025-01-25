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
        const audio = new Audio(soundUrl);
        audio.play();
      },
      args: [soundUrl]
    })
    .then(() => {
      console.log('Sound played successfully');
      resolve();
    })
    .catch((error) => {
      console.error('Error playing sound:', error);
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