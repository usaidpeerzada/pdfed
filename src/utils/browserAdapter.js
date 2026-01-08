// pdfed - Browser Adapter
// Provides cross-browser compatibility layer for extension APIs

/**
 * Unified browser API - works across Chrome, Firefox, Edge
 */
export const browser = (() => {
  // Check for Firefox's browser API
  if (typeof globalThis.browser !== 'undefined') {
    return globalThis.browser;
  }
  
  // Fall back to Chrome's chrome API
  if (typeof globalThis.chrome !== 'undefined') {
    return globalThis.chrome;
  }
  
  // Mock for testing
  console.warn('pdfed: No browser extension API found - running in mock mode');
  return createMockBrowser();
})();

/**
 * Create mock browser API for testing
 */
function createMockBrowser() {
  return {
    runtime: {
      getURL: (path) => `mock://${path}`,
      sendMessage: async () => ({}),
      onMessage: { addListener: () => {} }
    },
    tabs: {
      sendMessage: async () => ({}),
      query: async () => [],
      onRemoved: { addListener: () => {} }
    },
    action: {
      onClicked: { addListener: () => {} }
    },
    scripting: {
      executeScript: async () => {}
    },
    storage: {
      local: {
        get: async () => ({}),
        set: async () => {}
      }
    }
  };
}

/**
 * Detect current browser
 */
export function detectBrowser() {
  const ua = navigator.userAgent;
  
  if (ua.includes('Firefox')) {
    return 'firefox';
  }
  if (ua.includes('Edg/')) {
    return 'edge';
  }
  if (ua.includes('Safari') && !ua.includes('Chrome')) {
    return 'safari';
  }
  if (ua.includes('Chrome')) {
    return 'chrome';
  }
  
  return 'unknown';
}

/**
 * Check if running as extension
 */
export function isExtensionContext() {
  return (
    typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id
  ) || (
    typeof browser !== 'undefined' && browser.runtime && browser.runtime.id
  );
}

/**
 * Get extension URL for a resource
 */
export function getExtensionURL(path) {
  if (chrome?.runtime?.getURL) {
    return chrome.runtime.getURL(path);
  }
  if (browser?.runtime?.getURL) {
    return browser.runtime.getURL(path);
  }
  return path;
}

/**
 * Send message to background script
 */
export async function sendMessage(message) {
  return new Promise((resolve, reject) => {
    const api = chrome || browser;
    
    if (!api?.runtime?.sendMessage) {
      reject(new Error('No extension API available'));
      return;
    }
    
    api.runtime.sendMessage(message, (response) => {
      if (api.runtime.lastError) {
        reject(new Error(api.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Browser-specific feature detection
 */
export const features = {
  // Firefox supports webRequest in MV3, Chrome doesn't
  hasWebRequest: detectBrowser() === 'firefox',
  
  // Service workers vs event pages
  usesServiceWorker: detectBrowser() !== 'firefox',
  
  // Safari has limited MV3 support
  hasFullMV3: detectBrowser() !== 'safari'
};

export default browser;
