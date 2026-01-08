/**
 * pdfed - PDF Viewer
 * Renders PDF using PDF.js to replace Chrome's native embed
 * This allows our tool overlays to capture mouse events
 */

export class PDFViewer {
  /**
   * @param {Object} pdfJsDoc - PDF.js document object
   */
  constructor(pdfJsDoc) {
    this.pdfDoc = pdfJsDoc;
    this.container = null;
    this.pageCanvases = [];
    this.scale = 1.5; // Default zoom level
    this.currentPage = 1;
  }

  /**
   * Initialize the viewer - hide native embed and render PDF
   */
  async initialize() {
    this._hideNativeViewer();
    this._createContainer();
    await this._renderAllPages();
    console.log('pdfed: PDF Viewer initialized');
  }

  /**
   * Hide Chrome's native PDF embed element
   * @private
   */
  _hideNativeViewer() {
    // Hide the Chrome PDF plugin embed
    const embed = document.querySelector('embed[type="application/pdf"]');
    if (embed) {
      embed.style.display = 'none';
      console.log('pdfed: Hidden native PDF embed');
    }

    // Also hide any object elements
    const objects = document.querySelectorAll('object[type="application/pdf"]');
    objects.forEach(obj => obj.style.display = 'none');
  }

  /**
   * Create the viewer container
   * @private
   */
  _createContainer() {
    // Remove existing viewer if present
    const existing = document.getElementById('pdfed-viewer');
    if (existing) existing.remove();

    this.container = document.createElement('div');
    this.container.id = 'pdfed-viewer';
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 2147483630;
      background: #404040;
      overflow: auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 20px;
      gap: 10px;
    `;

    document.body.appendChild(this.container);
  }

  /**
   * Render all PDF pages
   * @private
   */
  async _renderAllPages() {
    if (!this.pdfDoc) {
      console.error('pdfed: No PDF document to render');
      return;
    }

    const numPages = this.pdfDoc.numPages;
    console.log(`pdfed: Rendering ${numPages} pages...`);

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      await this._renderPage(pageNum);
    }

    console.log('pdfed: All pages rendered');
  }

  /**
   * Render a single page
   * @param {number} pageNum - 1-indexed page number
   * @private
   */
  async _renderPage(pageNum) {
    try {
      const page = await this.pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: this.scale });

      // Create page wrapper
      const pageWrapper = document.createElement('div');
      pageWrapper.className = 'pdfed-page';
      pageWrapper.dataset.page = pageNum;
      pageWrapper.style.cssText = `
        position: relative;
        background: white;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        margin-bottom: 10px;
      `;

      // Create canvas for PDF rendering
      const canvas = document.createElement('canvas');
      canvas.className = 'pdfed-page-canvas';
      const ctx = canvas.getContext('2d');

      // Set canvas size with device pixel ratio for sharpness
      const dpr = window.devicePixelRatio || 1;
      canvas.width = viewport.width * dpr;
      canvas.height = viewport.height * dpr;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      ctx.scale(dpr, dpr);

      // Render PDF page to canvas
      await page.render({
        canvasContext: ctx,
        viewport: viewport
      }).promise;

      pageWrapper.appendChild(canvas);
      this.container.appendChild(pageWrapper);
      this.pageCanvases.push({ pageNum, canvas, viewport });
      
      // Render Interactive Form Layer
      const annotations = await page.getAnnotations();
      if (annotations && annotations.length > 0) {
        this._renderFormLayer(pageWrapper, viewport, annotations);
      }
      
      // Page tracking: Simple approach - just use page number from data attribute
      // IntersectionObserver removed due to performance issues

    } catch (error) {
      console.error(`pdfed: Failed to render page ${pageNum}:`, error);
    }
  }

  /**
   * Get page dimensions for coordinate mapping
   * @param {number} pageNum 
   * @returns {{width: number, height: number, canvas: HTMLCanvasElement}|null}
   */
  getPageInfo(pageNum) {
    const page = this.pageCanvases.find(p => p.pageNum === pageNum);
    if (!page) return null;
    
    return {
      width: page.viewport.width,
      height: page.viewport.height,
      canvas: page.canvas
    };
  }

  /**
   * Set zoom level and re-render
   * @param {number} scale 
   */
  async setZoom(scale) {
    this.scale = scale;
    this.pageCanvases = [];
    this.container.innerHTML = '';
    await this._renderAllPages();
  }

  /**
   * Scroll to a specific page
   * @param {number} pageNum 
   */
  scrollToPage(pageNum) {
    const pageEl = this.container.querySelector(`[data-page="${pageNum}"]`);
    if (pageEl) {
      pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /**
   * Show the native viewer and hide ours
   */
  showNativeViewer() {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }

    const embed = document.querySelector('embed[type="application/pdf"]');
    if (embed) {
      embed.style.display = '';
    }
  }

  /**
   * Clean up
   */
  destroy() {
    this.showNativeViewer();
    this.pageCanvases = [];
    this.pdfDoc = null;
  }
  /**
   * Render form widgets
   * @private
   */
  _renderFormLayer(container, viewport, annotations) {
    if (!document.getElementById('pdfed-form-styles')) {
        this._injectFormStyles();
    }

    const formLayer = document.createElement('div');
    formLayer.className = 'pdfed-form-layer';
    formLayer.style.cssText = `
        position: absolute;
        top: 0; left: 0; width: 100%; height: 100%;
        pointer-events: none;
        z-index: 1; 
    `;

    annotations.forEach(ann => {
        if (ann.subtype === 'Widget') {
            this._renderWidget(formLayer, viewport, ann);
        }
    });
    
    container.appendChild(formLayer);
  }

  _renderWidget(container, viewport, ann) {
      if (ann.readOnly) return;

      const rect = viewport.convertToViewportRectangle(ann.rect);
      // rect is [xMin, yMin, xMax, yMax] (PDF.js specific)
      const x = Math.min(rect[0], rect[2]);
      const y = Math.min(rect[1], rect[3]); // PDF coords usually y=bottom, but viewport transform fixes it?
      // Actually convertToViewportRectangle returns [x1, y1, x2, y2]
      // We calculate width/height
      const width = Math.abs(rect[2] - rect[0]);
      const height = Math.abs(rect[3] - rect[1]);
      
      // Safety check
      if (width < 2 || height < 2) return;

      const wrapper = document.createElement('div');
      wrapper.style.cssText = `
        position: absolute;
        left: ${x}px;
        top: ${y}px;
        width: ${width}px;
        height: ${height}px;
        pointer-events: auto;
      `;

      // Text Field
      if (ann.fieldType === 'Tx') {
        const input = ann.multiLine 
            ? document.createElement('textarea')
            : document.createElement('input');
        
        input.className = 'pdfed-form-input';
        if (ann.fieldValue) input.value = ann.fieldValue;
        
        // Data binding
        input.dataset.fieldName = ann.fieldName || ann.id;
        input.addEventListener('input', (e) => {
            // Signal change to Toolbar/Engine via Custom Event
            // stored in a global map or dispatched
            // For now, we update the DOM value which we can read on Save
            input.setAttribute('data-modified', 'true');
        });

        wrapper.appendChild(input);
        container.appendChild(wrapper);
      }
      
      // Checkbox / Radio (Btn)
      else if (ann.fieldType === 'Btn') {
          // Check flags for Checkbox vs PushButton
          // If it has exportValue or is toggle
          // Simplification: Render generic checkbox if looks small
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.className = 'pdfed-form-checkbox';
          
          if (ann.fieldValue === 'Yes' || ann.fieldValue === 'On' || ann.checkBox) {
              input.checked = true;
          }
          
          wrapper.appendChild(input);
          container.appendChild(wrapper);
      }
  }

  _injectFormStyles() {
      const style = document.createElement('style');
      style.id = 'pdfed-form-styles';
      style.textContent = `
        .pdfed-form-input {
            width: 100%;
            height: 100%;
            border: 1px solid rgba(0,0,0,0.1); /* Subtle default border */
            background: rgba(255,255,255,0.3); /* Slightly visible */
            border-radius: 4px;
            padding: 4px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            font-size: 13px;
            color: #1d1d1f;
            outline: none;
            transition: all 0.2s;
            resize: none;
        }
        .pdfed-form-input:hover {
            background: rgba(255,255,255,0.6);
            border-color: rgba(0,122,255,0.3);
        }
        .pdfed-form-input:focus {
            background: rgba(255,255,255,0.95);
            border-color: #007aff;
            box-shadow: 0 0 0 3px rgba(0,122,255,0.15);
        }
        
        .pdfed-form-checkbox {
            width: 100%;
            height: 100%;
            cursor: pointer;
            accent-color: #007aff;
        }
      `;
      document.head.appendChild(style);
   }

  getFormValues() {
      const values = {};
      if (!this.container) return values;
      
      const inputs = this.container.querySelectorAll('.pdfed-form-input, .pdfed-form-checkbox');
      inputs.forEach(input => {
          const name = input.dataset.fieldName;
          if (!name) return;
          
          if (input.type === 'checkbox') {
              values[name] = input.checked;
          } else {
              values[name] = input.value;
          }
      });
      return values;
  }
}
