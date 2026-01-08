// pdfed - Toolbar Injector
import { Toolbar } from '../toolbar/Toolbar.js';

export class ToolbarInjector {
  constructor() {
    this.toolbar = null;
    this.container = null;
  }

  /**
   * Inject toolbar into the page
   * @param {string} pdfData - Base64 encoded PDF data from background script
   */
  inject(pdfData) {
    if (this.container) {
      this.container.style.display = 'block';
      // If we already have a toolbar, we might want to update its data
      // depending on if the user navigated to a new PDF without a full reload.
      // For now, we assume simple toggle visibility.
      return;
    }

    // Create container
    this.container = document.createElement('div');
    this.container.id = 'pdfed-container';
    this.container.className = 'pdfed-container';

    // Create shadow DOM for style isolation
    const shadow = this.container.attachShadow({ mode: 'open' });

    // Inject styles
    const styles = document.createElement('link');
    styles.rel = 'stylesheet';
    styles.href = chrome.runtime.getURL('styles/toolbar.css');
    shadow.appendChild(styles);

    // Create toolbar wrapper
    const toolbarWrapper = document.createElement('div');
    toolbarWrapper.className = 'pdfed-toolbar-wrapper';
    shadow.appendChild(toolbarWrapper);

    // Initialize toolbar with the PDF DATA
    // We pass the data here so the Toolbar doesn't need to fetch it
    this.toolbar = new Toolbar(toolbarWrapper, pdfData);

    // Add to page
    document.body.appendChild(this.container);

    // Add animation class
    requestAnimationFrame(() => {
      toolbarWrapper.classList.add('pdfed-visible');
    });

    console.log('pdfed: Toolbar injected with data');
  }

  // ... rest of the class remains the same (remove, destroy)
  remove() {
    if (this.container) {
      const wrapper = this.container.shadowRoot?.querySelector('.pdfed-toolbar-wrapper');
      if (wrapper) {
        wrapper.classList.remove('pdfed-visible');
        wrapper.classList.add('pdfed-hidden');
        setTimeout(() => {
          if (this.container) {
            this.container.style.display = 'none';
          }
        }, 300);
      }
    }
  }

  destroy() {
    if (this.toolbar) {
      this.toolbar.destroy();
      this.toolbar = null;
    }
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
}
