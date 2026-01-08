// pdfed - Content Script Entry Point
import { PDFDetector } from './pdfDetector.js';
import { ToolbarInjector } from './injector.js';

class PDFEdContent {
  constructor() {
    this.detector = new PDFDetector();
    this.injector = new ToolbarInjector();
    this.isToolbarVisible = false;
    this.init();
  }

  init() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sendResponse);
      return true; 
    });

    if (this.detector.isPDFPage()) {
      console.log('pdfed: PDF detected');
    }
  }

  handleMessage(message, sendResponse) {
    switch (message.action) {
      case 'CHECK_PDF':
        sendResponse({ isPDF: this.detector.isPDFPage() });
        break;
        
      case 'SHOW_TOOLBAR':
        this.showToolbar();
        sendResponse({ success: true }); // Acknowledge command received
        break;
        
      case 'HIDE_TOOLBAR':
        this.hideToolbar();
        sendResponse({ success: true });
        break;
        
      default:
        sendResponse({ error: 'Unknown action' });
    }
  }

  showToolbar() {
    if (this.isToolbarVisible) return;
    
    // Set flag immediately to prevent double injection
    this.isToolbarVisible = true;

    // Request PDF data from the Service Worker (Bypasses CORS)
    chrome.runtime.sendMessage(
      { action: 'GET_PDF_DATA', url: window.location.href }, 
      (response) => {
        // Handle connection errors
        if (chrome.runtime.lastError) {
          console.error("pdfed: Runtime error", chrome.runtime.lastError.message);
          this.isToolbarVisible = false; // Reset on error
          return;
        }

        // Handle successful fetch
        if (response && response.success) {
          console.log("pdfed: PDF data loaded via background. Injecting UI...");
          this.injector.inject(response.data); 
        } else {
          console.error("pdfed: Failed to load PDF data", response?.error);
          this.isToolbarVisible = false; // Reset on error
          alert("Error: Please enable 'Allow access to file URLs' in extension settings.");
        }
      }
    );
  }

  hideToolbar() {
    if (this.isToolbarVisible) {
      this.injector.remove();
      this.isToolbarVisible = false;
    }
  }
}

const pdfed = new PDFEdContent();
export { pdfed };
