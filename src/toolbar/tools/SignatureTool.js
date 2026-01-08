// pdfed - Signature Tool
// Draw, type, or upload signatures

export class SignatureTool {
  constructor(engine, state) {
    this.engine = engine;
    this.state = state;
    this.modal = null;
    this.signatureData = null;
    this.mode = 'draw'; // draw, type, upload
    this.canvas = null;
    this.ctx = null;
    this.isDrawing = false;
    this.lastPoint = null;
  }

  /**
   * Show signature creation modal
   */
  show() {
    this.createModal();
    document.body.appendChild(this.modal);
    this.setupCanvas();
    this.bindEvents();
  }

  /**
   * Create the signature modal
   */
  createModal() {
    this.modal = document.createElement('div');
    this.modal.className = 'pdfed-signature-modal';
    this.modal.innerHTML = `
      <div class="pdfed-signature-overlay"></div>
      <div class="pdfed-signature-dialog">
        <div class="pdfed-signature-header">
          <h3>Add Signature</h3>
          <button class="pdfed-sig-close" id="pdfed-sig-close">×</button>
        </div>
        
        <div class="pdfed-signature-tabs">
          <button class="pdfed-sig-tab active" data-mode="draw">Draw</button>
          <button class="pdfed-sig-tab" data-mode="type">Type</button>
          <button class="pdfed-sig-tab" data-mode="upload">Upload</button>
        </div>
        
        <div class="pdfed-signature-content">
          <!-- Draw Tab -->
          <div class="pdfed-sig-panel active" data-panel="draw">
            <canvas id="pdfed-sig-canvas" width="500" height="200"></canvas>
            <button class="pdfed-sig-clear" id="pdfed-sig-clear">Clear</button>
          </div>
          
          <!-- Type Tab -->
          <div class="pdfed-sig-panel" data-panel="type">
            <input 
              type="text" 
              id="pdfed-sig-text" 
              placeholder="Type your signature..."
              class="pdfed-sig-input"
            />
            <div class="pdfed-sig-fonts">
              <button class="pdfed-font-btn active" data-font="Brush Script MT">Brush Script</button>
              <button class="pdfed-font-btn" data-font="Lucida Handwriting">Lucida</button>
              <button class="pdfed-font-btn" data-font="Segoe Script">Segoe</button>
            </div>
            <div class="pdfed-sig-preview" id="pdfed-sig-preview"></div>
          </div>
          
          <!-- Upload Tab -->
          <div class="pdfed-sig-panel" data-panel="upload">
            <div class="pdfed-sig-dropzone" id="pdfed-sig-dropzone">
              <span>📁</span>
              <p>Drop image here or click to upload</p>
              <input type="file" id="pdfed-sig-file" accept="image/*" hidden />
            </div>
            <img id="pdfed-sig-uploaded" class="pdfed-sig-uploaded" style="display: none;" />
          </div>
        </div>
        
        <div class="pdfed-signature-footer">
          <button class="pdfed-sig-cancel" id="pdfed-sig-cancel">Cancel</button>
          <button class="pdfed-sig-apply" id="pdfed-sig-apply">Apply Signature</button>
        </div>
      </div>
    `;

    // Add styles
    this.addStyles();
  }

  /**
   * Add signature modal styles
   */
  addStyles() {
    if (document.getElementById('pdfed-signature-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'pdfed-signature-styles';
    styles.textContent = `
      .pdfed-signature-modal {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Inter', -apple-system, sans-serif;
      }
      
      .pdfed-signature-overlay {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(4px);
      }
      
      .pdfed-signature-dialog {
        position: relative;
        background: #1f2937;
        border-radius: 16px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        width: 560px;
        max-width: 90vw;
        animation: pdfed-modal-in 0.3s ease;
      }
      
      @keyframes pdfed-modal-in {
        from { opacity: 0; transform: scale(0.95) translateY(-20px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
      }
      
      .pdfed-signature-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px 24px;
        border-bottom: 1px solid rgba(75, 85, 99, 0.4);
      }
      
      .pdfed-signature-header h3 {
        color: #f9fafb;
        font-size: 18px;
        font-weight: 600;
        margin: 0;
      }
      
      .pdfed-sig-close {
        width: 32px;
        height: 32px;
        border: none;
        background: rgba(255, 255, 255, 0.1);
        color: #9ca3af;
        border-radius: 50%;
        font-size: 20px;
        cursor: pointer;
        transition: 0.2s;
      }
      
      .pdfed-sig-close:hover {
        background: rgba(255, 255, 255, 0.2);
        color: #fff;
      }
      
      .pdfed-signature-tabs {
        display: flex;
        padding: 16px 24px 0;
        gap: 8px;
      }
      
      .pdfed-sig-tab {
        padding: 10px 20px;
        border: none;
        background: transparent;
        color: #9ca3af;
        font-size: 14px;
        font-weight: 500;
        border-radius: 8px;
        cursor: pointer;
        transition: 0.2s;
      }
      
      .pdfed-sig-tab:hover {
        background: rgba(99, 102, 241, 0.1);
        color: #f9fafb;
      }
      
      .pdfed-sig-tab.active {
        background: #6366f1;
        color: #fff;
      }
      
      .pdfed-signature-content {
        padding: 24px;
      }
      
      .pdfed-sig-panel {
        display: none;
      }
      
      .pdfed-sig-panel.active {
        display: block;
      }
      
      #pdfed-sig-canvas {
        width: 100%;
        height: 200px;
        background: #fff;
        border-radius: 8px;
        cursor: crosshair;
        touch-action: none;
      }
      
      .pdfed-sig-clear {
        margin-top: 12px;
        padding: 8px 16px;
        border: 1px solid rgba(75, 85, 99, 0.4);
        background: transparent;
        color: #9ca3af;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        transition: 0.2s;
      }
      
      .pdfed-sig-clear:hover {
        background: rgba(255, 255, 255, 0.05);
        color: #f9fafb;
      }
      
      .pdfed-sig-input {
        width: 100%;
        padding: 16px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(75, 85, 99, 0.4);
        border-radius: 8px;
        color: #f9fafb;
        font-size: 24px;
        font-family: 'Brush Script MT', cursive;
      }
      
      .pdfed-sig-input::placeholder {
        color: #6b7280;
      }
      
      .pdfed-sig-fonts {
        display: flex;
        gap: 8px;
        margin-top: 12px;
      }
      
      .pdfed-font-btn {
        padding: 8px 12px;
        border: 1px solid rgba(75, 85, 99, 0.4);
        background: transparent;
        color: #9ca3af;
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        transition: 0.2s;
      }
      
      .pdfed-font-btn.active {
        background: #6366f1;
        border-color: #6366f1;
        color: #fff;
      }
      
      .pdfed-sig-preview {
        margin-top: 16px;
        padding: 24px;
        background: #fff;
        border-radius: 8px;
        min-height: 80px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 32px;
        color: #000;
      }
      
      .pdfed-sig-dropzone {
        border: 2px dashed rgba(75, 85, 99, 0.4);
        border-radius: 12px;
        padding: 48px 24px;
        text-align: center;
        cursor: pointer;
        transition: 0.2s;
      }
      
      .pdfed-sig-dropzone:hover {
        border-color: #6366f1;
        background: rgba(99, 102, 241, 0.05);
      }
      
      .pdfed-sig-dropzone span {
        font-size: 48px;
        display: block;
        margin-bottom: 12px;
      }
      
      .pdfed-sig-dropzone p {
        color: #9ca3af;
        font-size: 14px;
        margin: 0;
      }
      
      .pdfed-sig-uploaded {
        max-width: 100%;
        max-height: 200px;
        border-radius: 8px;
        margin-top: 16px;
      }
      
      .pdfed-signature-footer {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        padding: 16px 24px;
        border-top: 1px solid rgba(75, 85, 99, 0.4);
      }
      
      .pdfed-sig-cancel {
        padding: 10px 20px;
        border: 1px solid rgba(75, 85, 99, 0.4);
        background: transparent;
        color: #9ca3af;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: 0.2s;
      }
      
      .pdfed-sig-cancel:hover {
        background: rgba(255, 255, 255, 0.05);
        color: #f9fafb;
      }
      
      .pdfed-sig-apply {
        padding: 10px 24px;
        border: none;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        color: #fff;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        transition: 0.2s;
      }
      
      .pdfed-sig-apply:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
      }
    `;
    document.head.appendChild(styles);
  }

  /**
   * Setup canvas for drawing
   */
  setupCanvas() {
    this.canvas = this.modal.querySelector('#pdfed-sig-canvas');
    this.ctx = this.canvas.getContext('2d');
    
    // Set canvas resolution
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    
    // Configure drawing style
    this.ctx.strokeStyle = '#000';
    this.ctx.lineWidth = 2;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
  }

  /**
   * Bind all event listeners
   */
  bindEvents() {
    // Tab switching
    const tabs = this.modal.querySelectorAll('.pdfed-sig-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.mode));
    });

    // Canvas drawing
    this.canvas.addEventListener('mousedown', this.startDrawing.bind(this));
    this.canvas.addEventListener('mousemove', this.draw.bind(this));
    this.canvas.addEventListener('mouseup', this.stopDrawing.bind(this));
    this.canvas.addEventListener('mouseleave', this.stopDrawing.bind(this));

    // Touch support
    this.canvas.addEventListener('touchstart', this.handleTouch.bind(this));
    this.canvas.addEventListener('touchmove', this.handleTouch.bind(this));
    this.canvas.addEventListener('touchend', this.stopDrawing.bind(this));

    // Clear button
    this.modal.querySelector('#pdfed-sig-clear').addEventListener('click', () => {
      this.clearCanvas();
    });

    // Type input
    const input = this.modal.querySelector('#pdfed-sig-text');
    input.addEventListener('input', () => this.updatePreview());

    // Font buttons
    const fontBtns = this.modal.querySelectorAll('.pdfed-font-btn');
    fontBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        fontBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        input.style.fontFamily = btn.dataset.font;
        this.updatePreview();
      });
    });

    // File upload
    const dropzone = this.modal.querySelector('#pdfed-sig-dropzone');
    const fileInput = this.modal.querySelector('#pdfed-sig-file');
    
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', e => {
      e.preventDefault();
      dropzone.style.borderColor = '#6366f1';
    });
    dropzone.addEventListener('dragleave', () => {
      dropzone.style.borderColor = '';
    });
    dropzone.addEventListener('drop', e => {
      e.preventDefault();
      dropzone.style.borderColor = '';
      const file = e.dataTransfer.files[0];
      if (file) this.handleFile(file);
    });
    fileInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (file) this.handleFile(file);
    });

    // Close/cancel
    this.modal.querySelector('#pdfed-sig-close').addEventListener('click', () => this.close());
    this.modal.querySelector('#pdfed-sig-cancel').addEventListener('click', () => this.close());
    this.modal.querySelector('.pdfed-signature-overlay').addEventListener('click', () => this.close());

    // Apply
    this.modal.querySelector('#pdfed-sig-apply').addEventListener('click', () => this.apply());
  }

  /**
   * Switch between tabs
   */
  switchTab(mode) {
    this.mode = mode;
    
    // Update tabs
    this.modal.querySelectorAll('.pdfed-sig-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.mode === mode);
    });
    
    // Update panels
    this.modal.querySelectorAll('.pdfed-sig-panel').forEach(panel => {
      panel.classList.toggle('active', panel.dataset.panel === mode);
    });
  }

  /**
   * Drawing methods
   */
  startDrawing(e) {
    this.isDrawing = true;
    const rect = this.canvas.getBoundingClientRect();
    this.lastPoint = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  draw(e) {
    if (!this.isDrawing) return;
    
    const rect = this.canvas.getBoundingClientRect();
    const point = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };

    this.ctx.beginPath();
    this.ctx.moveTo(this.lastPoint.x, this.lastPoint.y);
    this.ctx.lineTo(point.x, point.y);
    this.ctx.stroke();

    this.lastPoint = point;
  }

  stopDrawing() {
    this.isDrawing = false;
  }

  handleTouch(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent(
      e.type === 'touchstart' ? 'mousedown' : 'mousemove',
      { clientX: touch.clientX, clientY: touch.clientY }
    );
    this.canvas.dispatchEvent(mouseEvent);
  }

  clearCanvas() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Update typed signature preview
   */
  updatePreview() {
    const input = this.modal.querySelector('#pdfed-sig-text');
    const preview = this.modal.querySelector('#pdfed-sig-preview');
    const activeFont = this.modal.querySelector('.pdfed-font-btn.active');
    
    preview.style.fontFamily = activeFont?.dataset.font || 'Brush Script MT';
    preview.textContent = input.value || 'Your signature';
  }

  /**
   * Handle file upload
   */
  handleFile(file) {
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = this.modal.querySelector('#pdfed-sig-uploaded');
      img.src = e.target.result;
      img.style.display = 'block';
      
      const dropzone = this.modal.querySelector('#pdfed-sig-dropzone');
      dropzone.style.display = 'none';
    };
    reader.readAsDataURL(file);
  }

  /**
   * Get signature data based on mode
   */
  getSignatureData() {
    switch (this.mode) {
      case 'draw':
        return {
          type: 'image',
          data: this.canvas.toDataURL('image/png')
        };
      case 'type':
        const input = this.modal.querySelector('#pdfed-sig-text');
        const font = this.modal.querySelector('.pdfed-font-btn.active')?.dataset.font;
        return {
          type: 'text',
          text: input.value,
          font: font
        };
      case 'upload':
        const img = this.modal.querySelector('#pdfed-sig-uploaded');
        return {
          type: 'image',
          data: img.src
        };
    }
  }

  /**
   * Apply signature to PDF
   */
  async apply() {
    this.signatureData = this.getSignatureData();
    
    if (!this.signatureData) {
      console.log('pdfed: No signature data');
      return;
    }

    // Store signature for placement
    this.state.set({ pendingSignature: this.signatureData });
    
    this.close();
    
    // Enable signature placement mode
    console.log('pdfed: Click on PDF to place signature');
    // The engine will handle placement on next click
  }

  /**
   * Close modal
   */
  close() {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
  }
}
