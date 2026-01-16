/**
 * OCROptionsModal
 * Modal for OCR settings shown before processing starts.
 * Allows user to select Force OCR, language, and other options.
 */
export class OCROptionsModal {
  constructor() {
    this.container = null;
    this._resolve = null;
    this._reject = null;
  }

  /**
   * Show the options modal and wait for user input
   * @param {Object} defaults - Default values
   * @returns {Promise<{forceOCR: boolean, language: string}>}
   */
  show(defaults = {}) {
    return new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
      this._create(defaults);
      this.container.style.display = 'flex';
    });
  }

  /**
   * Create the modal DOM
   */
  _create(defaults = {}) {
    if (this.container) {
      this.container.remove();
    }

    this.container = document.createElement('div');
    this.container.id = 'pdfed-ocr-options-modal';
    
    Object.assign(this.container.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      zIndex: '2147483647',
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      background: 'rgba(0, 0, 0, 0.5)',
      backdropFilter: 'blur(4px)'
    });

    const languages = [
      { code: 'eng', name: 'English' },
      { code: 'spa', name: 'Spanish' },
      { code: 'fra', name: 'French' },
      { code: 'deu', name: 'German' },
      { code: 'ita', name: 'Italian' },
      { code: 'por', name: 'Portuguese' },
      { code: 'rus', name: 'Russian' },
      { code: 'jpn', name: 'Japanese' },
      { code: 'chi_sim', name: 'Chinese (Simplified)' },
      { code: 'kor', name: 'Korean' },
      { code: 'ara', name: 'Arabic' },
      { code: 'hin', name: 'Hindi' },
    ];

    const langOptions = languages.map(l => 
      `<option value="${l.code}" ${l.code === (defaults.language || 'eng') ? 'selected' : ''}>${l.name}</option>`
    ).join('');

    this.container.innerHTML = `
      <div style="
        position: relative;
        background: white;
        border-radius: 16px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        width: 420px;
        max-width: 90vw;
        overflow: hidden;
      ">
        <div style="
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 20px 24px;
          border-bottom: 1px solid #f0f0f0;
        ">
          <div style="
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
          <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: #1a1a1a;">OCR Settings</h3>
        </div>
        
        <div style="padding: 24px;">
          <div style="margin-bottom: 20px;">
            <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 8px;">
              Language
            </label>
            <select id="pdfed-ocr-language" style="
              width: 100%;
              padding: 10px 12px;
              font-size: 14px;
              border: 1px solid #d1d5db;
              border-radius: 8px;
              background: white;
              color: #1f2937;
              cursor: pointer;
            ">
              ${langOptions}
            </select>
          </div>
          
          <div style="
            padding: 16px;
            background: #f9fafb;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
          ">
            <label style="display: flex; align-items: flex-start; gap: 12px; cursor: pointer;">
              <input type="checkbox" id="pdfed-ocr-force" style="
                width: 18px;
                height: 18px;
                margin-top: 2px;
                accent-color: #667eea;
              " ${defaults.forceOCR ? 'checked' : ''}>
              <div>
                <div style="font-size: 14px; font-weight: 500; color: #1f2937;">
                  Force OCR on All Pages
                </div>
                <div style="font-size: 13px; color: #6b7280; margin-top: 4px;">
                  Process all pages including those with native text. Use this if the PDF has corrupted text or copy protection.
                </div>
              </div>
            </label>
          </div>
        </div>
        
        <div style="
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 16px 24px;
          background: #f9fafb;
          border-top: 1px solid #f0f0f0;
        ">
          <button id="pdfed-ocr-cancel" style="
            padding: 10px 20px;
            font-size: 14px;
            font-weight: 500;
            color: #666;
            background: white;
            border: 1px solid #ddd;
            border-radius: 8px;
            cursor: pointer;
          ">Cancel</button>
          <button id="pdfed-ocr-start" style="
            padding: 10px 24px;
            font-size: 14px;
            font-weight: 500;
            color: white;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border: none;
            border-radius: 8px;
            cursor: pointer;
          ">Start OCR</button>
        </div>
      </div>
    `;

    (document.body || document.documentElement).appendChild(this.container);

    // Bind events
    this.container.querySelector('#pdfed-ocr-cancel').addEventListener('click', () => {
      this.hide();
      this._reject?.(new Error('User cancelled'));
    });

    this.container.querySelector('#pdfed-ocr-start').addEventListener('click', () => {
      const forceOCR = this.container.querySelector('#pdfed-ocr-force').checked;
      const language = this.container.querySelector('#pdfed-ocr-language').value;
      this.hide();
      this._resolve?.({ forceOCR, language });
    });

    // Hover effects
    const startBtn = this.container.querySelector('#pdfed-ocr-start');
    startBtn.addEventListener('mouseenter', () => {
      startBtn.style.opacity = '0.9';
      startBtn.style.transform = 'translateY(-1px)';
    });
    startBtn.addEventListener('mouseleave', () => {
      startBtn.style.opacity = '1';
      startBtn.style.transform = 'translateY(0)';
    });

    const cancelBtn = this.container.querySelector('#pdfed-ocr-cancel');
    cancelBtn.addEventListener('mouseenter', () => {
      cancelBtn.style.background = '#f5f5f5';
    });
    cancelBtn.addEventListener('mouseleave', () => {
      cancelBtn.style.background = 'white';
    });
  }

  hide() {
    if (this.container) {
      this.container.style.display = 'none';
    }
  }

  destroy() {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
}

// Singleton
let _optionsModalInstance = null;

export function getOCROptionsModal() {
  if (!_optionsModalInstance) {
    _optionsModalInstance = new OCROptionsModal();
  }
  return _optionsModalInstance;
}
