// pdfed - Background Service Worker
// Handles extension icon clicks and toolbar injection

const PDFED_STATE = {
  activeTabs: new Map() // Track tabs where toolbar is active
};

// Listen for extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  
  try {
    // Check if we're on a PDF page
    const isPDF = await checkIfPDFPage(tab);
    
    if (isPDF) {
      // Toggle toolbar
      const isActive = PDFED_STATE.activeTabs.get(tab.id);
      
      if (isActive) {
        // Hide toolbar
        await chrome.tabs.sendMessage(tab.id, { action: 'HIDE_TOOLBAR' });
        PDFED_STATE.activeTabs.delete(tab.id);
      } else {
        // Show toolbar
        await injectToolbar(tab.id);
        PDFED_STATE.activeTabs.set(tab.id, true);
      }
    } else {
      // Not a PDF page - show notification
      console.log('pdfed: Not a PDF page');
    }
  } catch (error) {
    console.error('pdfed error:', error);
  }
});

// Check if current page is a PDF
async function checkIfPDFPage(tab) {
  // Check URL for PDF extension
  if (tab.url && tab.url.toLowerCase().includes('.pdf')) {
    return true;
  }
  
  // Check content type by sending message to content script
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'CHECK_PDF' });
    return response?.isPDF || false;
  } catch {
    // Content script might not be loaded yet
    return false;
  }
}

// Inject toolbar into the page
async function injectToolbar(tabId) {
  try {
    // First, try to send message to check if content script is already loaded
    try {
      await chrome.tabs.sendMessage(tabId, { action: 'SHOW_TOOLBAR' });
      console.log('pdfed: Toolbar shown (content script already loaded)');
      return;
    } catch (e) {
      // Content script not loaded yet, inject it
      console.log('pdfed: Content script not found, injecting...');
    }
    
    // Inject content script and CSS
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/index.js']
    });
    
    // Wait a bit for script to initialize, then send message
    setTimeout(async () => {
      try {
        await chrome.tabs.sendMessage(tabId, { action: 'SHOW_TOOLBAR' });
      } catch (e) {
        console.error('pdfed: Failed to show toolbar after injection:', e);
      }
    }, 100);
    
  } catch (error) {
    console.error('Failed to inject toolbar:', error);
  }
}

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  PDFED_STATE.activeTabs.delete(tabId);
});

// Handle messages from content scripts
// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'GET_PDF_DATA') {
    // 1. Get the URL from the message (or default to sender tab's URL)
    const urlToFetch = message.url || sender.tab.url;

    // 2. Fetch the local file (Allowed in SW if "Allow access to file URLs" is ON)
    fetch(urlToFetch)
      .then(response => {
        if (!response.ok) throw new Error(`Network error: ${response.status}`);
        return response.blob();
      })
      .then(blob => {
        // 3. Convert Blob to Base64 (DataURL) to send over messaging
        const reader = new FileReader();
        reader.onloadend = () => {
          // Success: Send the data back
          sendResponse({ success: true, data: reader.result });
        };
        reader.onerror = () => {
          sendResponse({ success: false, error: "Failed to read file blob" });
        };
        reader.readAsDataURL(blob);
      })
      .catch(error => {
        console.error('PDF Fetch Error:', error);
        sendResponse({ success: false, error: error.message });
      });

    return true; // Keep message channel open for async response
  }
});


console.log('pdfed service worker initialized');
