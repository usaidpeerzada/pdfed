/**
 * OCRProgressModal
 * Beautiful modal UI for OCR processing progress.
 * Shows status, progress bar, and allows cancellation.
 */
export class OCRProgressModal {
  constructor() {
    this.container = null;
    this.isVisible = false;
    this._onCancel = null;
  }

  /**
   * Create modal DOM
   */
  /**
   * Create modal DOM with inline styles (CSP safe)
   */
  _create() {
    if (this.container) return;

    this.container = document.createElement('div');
    this.container.id = 'pdfed-ocr-modal';
    
    // Critical styles applied directly via JS to bypass CSP <style> blocks
    Object.assign(this.container.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      zIndex: '2147483647', // Max z-index
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      background: 'rgba(0, 0, 0, 0.5)',
      backdropFilter: 'blur(4px)'
    });

    this.container.innerHTML = `
      <div class="pdfed-ocr-dialog" style="
        position: relative;
        background: white;
        border-radius: 16px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        width: 400px;
        max-width: 90vw;
        overflow: hidden;
        animation: pdfed-ocr-slide-in 0.3s ease;
      ">
        <div class="pdfed-ocr-header" style="
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 20px 24px;
          border-bottom: 1px solid #f0f0f0;
        ">
          <div class="pdfed-ocr-icon" style="
            display: flex;
            align-items: center;
            justify-content: center;
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 10px;
            color: white;
          ">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>
          <h3 class="pdfed-ocr-title" style="
            margin: 0;
            font-size: 18px;
            font-weight: 600;
            color: #1a1a1a;
          ">OCR Processing</h3>
        </div>
        
        <div class="pdfed-ocr-content" style="padding: 24px;">
          <p class="pdfed-ocr-status" style="margin: 0 0 16px 0; font-size: 14px; color: #666;">Initializing OCR engine...</p>
          
          <div class="pdfed-ocr-progress-container" style="display: flex; align-items: center; gap: 12px;">
            <div class="pdfed-ocr-progress-bar" style="
              flex: 1;
              height: 8px;
              background: #e5e7eb;
              border-radius: 4px;
              overflow: hidden;
            ">
              <div class="pdfed-ocr-progress-fill" style="
                height: 100%;
                width: 0%;
                background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
                border-radius: 4px;
                transition: width 0.3s ease;
              "></div>
            </div>
            <span class="pdfed-ocr-progress-text" style="
              font-size: 14px;
              font-weight: 600;
              color: #1a1a1a;
              min-width: 40px;
              text-align: right;
            ">0%</span>
          </div>
          
          <p class="pdfed-ocr-details" style="
            display: flex;
            justify-content: space-between;
            margin: 16px 0 0 0;
            font-size: 13px;
            color: #888;
          ">
            <span class="pdfed-ocr-page">Page 1</span>
            <span class="pdfed-ocr-eta">Estimating time...</span>
          </p>
        </div>
        
        <div class="pdfed-ocr-footer" style="
          display: flex;
          justify-content: flex-end;
          padding: 16px 24px;
          background: #f9fafb;
          border-top: 1px solid #f0f0f0;
        ">
          <button class="pdfed-ocr-cancel-btn" style="
            padding: 8px 20px;
            font-size: 14px;
            font-weight: 500;
            color: #666;
            background: white;
            border: 1px solid #ddd;
            border-radius: 8px;
            cursor: pointer;
          ">Cancel</button>
        </div>
      </div>
    `;

    // Inject animation keyframes safely
    const styleSheet = document.createElement("style");
    styleSheet.textContent = `
      @keyframes pdfed-ocr-slide-in {
        from { opacity: 0; transform: translateY(-20px) scale(0.95); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
    `;
    document.head.appendChild(styleSheet);

    // Robust append (handle weird viewer DOMs)
    (document.body || document.documentElement).appendChild(this.container);

    // Bind cancel button
    const cancelBtn = this.container.querySelector('.pdfed-ocr-cancel-btn');
    cancelBtn.addEventListener('click', () => {
      this._onCancel?.();
      this.hide();
    });
    
    // Hover effects via JS since we can't easily use :hover in inline styles
    cancelBtn.addEventListener('mouseenter', () => {
      cancelBtn.style.background = '#f5f5f5';
      cancelBtn.style.borderColor = '#ccc';
    });
    cancelBtn.addEventListener('mouseleave', () => {
      cancelBtn.style.background = 'white';
      cancelBtn.style.borderColor = '#ddd';
    });
  }

  /**
   * Show the modal
   * @param {Object} options - Initial state
   */
  show(options = {}) {
    console.log("pdfed: OCRProgressModal.show() called");
    this._create();
    console.log("pdfed: Modal container created:", this.container);
    
    if (options.status) this.setStatus(options.status);
    if (options.page) this.setPage(options.page);
    if (options.progress !== undefined) this.setProgress(options.progress);
    
    // Use direct style instead of classList for extension compatibility
    this.container.style.display = 'flex';
    this.isVisible = true;
    console.log("pdfed: Modal should now be visible, display:", this.container.style.display);
  }

  /**
   * Hide the modal
   */
  hide() {
    if (this.container) {
      this.container.style.display = 'none';
    }
    this.isVisible = false;
  }

  /**
   * Update status text
   * @param {string} status
   */
  setStatus(status) {
    if (this.container) {
      this.container.querySelector('.pdfed-ocr-status').textContent = status;
    }
  }

  /**
   * Update progress
   * @param {number} progress - 0 to 1
   */
  setProgress(progress) {
    if (this.container) {
      const percent = Math.round(progress * 100);
      this.container.querySelector('.pdfed-ocr-progress-fill').style.width = `${percent}%`;
      this.container.querySelector('.pdfed-ocr-progress-text').textContent = `${percent}%`;
    }
  }

  /**
   * Update page info
   * @param {number} current
   * @param {number} total
   */
  setPage(current, total = 1) {
    if (this.container) {
      const text = total > 1 ? `Page ${current} of ${total}` : `Page ${current}`;
      this.container.querySelector('.pdfed-ocr-page').textContent = text;
    }
  }

  /**
   * Update ETA
   * @param {string} eta
   */
  setETA(eta) {
    if (this.container) {
      this.container.querySelector('.pdfed-ocr-eta').textContent = eta;
    }
  }

  /**
   * Set cancel callback
   * @param {Function} callback
   */
  onCancel(callback) {
    this._onCancel = callback;
  }

  /**
   * Show success state
   */
  showSuccess() {
    this.setStatus('OCR completed successfully!');
    this.setProgress(1);
    this.setETA('');
    
    setTimeout(() => this.hide(), 1500);
  }

  /**
   * Show error state
   * @param {string} message
   */
  showError(message) {
    this.setStatus(`Error: ${message}`);
    if (this.container) {
      const icon = this.container.querySelector('.pdfed-ocr-icon');
      if (icon) {
        icon.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
      }
    }
  }

  /**
   * Destroy modal
   */
  destroy() {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
}

// Singleton
let _modalInstance = null;

export function getOCRModal() {
  if (!_modalInstance) {
    _modalInstance = new OCRProgressModal();
  }
  return _modalInstance;
}
