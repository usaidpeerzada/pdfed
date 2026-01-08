
export class SignatureModal {
    constructor(onSave) {
        this.onSave = onSave;
        this.activeTab = 'draw';
        this.canvas = null;
        this.ctx = null;
        this.isDrawing = false;
        this.points = [];
        this.fonts = ['Dancing Script', 'Great Vibes', 'Sacramento', 'Allura'];
        this.selectedFont = 'Dancing Script';
        this._injectStyles();
    }

    open() {
        this._createModal();
        this._initCanvas();
    }

    _createModal() {
        if (document.getElementById('pdfed-signature-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'pdfed-signature-modal';
        modal.className = 'pdfed-modal-overlay';
        
        modal.innerHTML = `
            <div class="pdfed-modal-card">
                <div class="pdfed-modal-header">
                    <span class="pdfed-modal-title">Create Signature</span>
                    <button class="pdfed-modal-close">×</button>
                </div>
                
                <div class="pdfed-modal-tabs">
                    <button class="pdfed-tab active" data-tab="draw">Draw</button>
                    <button class="pdfed-tab" data-tab="type">Type</button>
                    <button class="pdfed-tab" data-tab="upload">Upload</button>
                </div>
                
                <div class="pdfed-modal-content">
                    <!-- DRAW TAB -->
                    <div id="pdfed-tab-draw" class="pdfed-tab-pane active">
                         <div class="pdfed-sig-canvas-wrapper">
                            <canvas id="pdfed-sig-canvas" width="500" height="200"></canvas>
                            <div class="pdfed-sig-baseline">Sign Here</div>
                         </div>
                         <div class="pdfed-sig-controls">
                            <button class="pdfed-btn-text" id="pdfed-sig-clear">Clear</button>
                            <div class="pdfed-color-picker">
                                <button class="pdfed-color-dot active" style="background:#000" data-color="#000000"></button>
                                <button class="pdfed-color-dot" style="background:#0047AB" data-color="#0047AB"></button> <!-- Cobalt Blue -->
                                <button class="pdfed-color-dot" style="background:#CC0000" data-color="#CC0000"></button>
                            </div>
                         </div>
                    </div>

                    <!-- TYPE TAB -->
                    <div id="pdfed-tab-type" class="pdfed-tab-pane">
                        <input type="text" class="pdfed-sig-input" placeholder="Type your name" id="pdfed-sig-text-input">
                        <div class="pdfed-font-list" id="pdfed-font-list">
                            <!-- Fonts Injected Here -->
                        </div>
                    </div>

                    <!-- UPLOAD TAB -->
                    <div id="pdfed-tab-upload" class="pdfed-tab-pane">
                        <div class="pdfed-upload-area" id="pdfed-sig-upload-area">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="17 8 12 3 7 8"></polyline>
                                <line x1="12" y1="3" x2="12" y2="15"></line>
                            </svg>
                            <span>Click to upload image</span>
                            <input type="file" id="pdfed-sig-file" accept="image/*" style="display:none">
                        </div>
                    </div>
                </div>

                <div class="pdfed-modal-footer">
                    <button class="pdfed-btn-secondary" id="pdfed-sig-cancel">Cancel</button>
                    <button class="pdfed-btn-primary" id="pdfed-sig-save">Create Signature</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this._bindEvents(modal);
        
        // Load fonts
        const fontLink = document.createElement('link');
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Allura&family=Dancing+Script&family=Great+Vibes&family=Sacramento&display=swap';
        fontLink.rel = 'stylesheet';
        document.head.appendChild(fontLink);
        
        this._renderFonts(); // For Type tab
    }

    _bindEvents(modal) {
        // Close
        modal.querySelector('.pdfed-modal-close').onclick = () => this.close();
        modal.querySelector('#pdfed-sig-cancel').onclick = () => this.close();
        
        // Tabs
        const tabs = modal.querySelectorAll('.pdfed-tab');
        tabs.forEach(tab => {
            tab.onclick = () => {
                // Switch Tab UI
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.activeTab = tab.dataset.tab;
                
                // Switch Content
                modal.querySelectorAll('.pdfed-tab-pane').forEach(p => p.classList.remove('active'));
                modal.querySelector(`#pdfed-tab-${this.activeTab}`).classList.add('active');
            };
        });

        // Save
        modal.querySelector('#pdfed-sig-save').onclick = () => this._handleSave();
        
        // Draw Clear
        modal.querySelector('#pdfed-sig-clear').onclick = () => {
             this.ctx.clearRect(0,0, this.canvas.width, this.canvas.height);
        };
        
        // Colors
        modal.querySelectorAll('.pdfed-color-dot').forEach(dot => {
            dot.onclick = () => {
                modal.querySelectorAll('.pdfed-color-dot').forEach(d => d.classList.remove('active'));
                dot.classList.add('active');
                this.ctx.strokeStyle = dot.dataset.color;
            };
        });
        
        // Upload
        const uploadArea = modal.querySelector('#pdfed-sig-upload-area');
        const fileInput = modal.querySelector('#pdfed-sig-file');
        uploadArea.onclick = () => fileInput.click();
        fileInput.onchange = (e) => this._handleFile(e);
        
        // Type Input
        const textInput = modal.querySelector('#pdfed-sig-text-input');
        if (textInput) {
            textInput.oninput = () => this._renderFonts();
            // Critical: Stop propagation so Toolbar/Canvas don't steal focus
            textInput.addEventListener('keydown', (e) => e.stopPropagation());
            textInput.addEventListener('mousedown', (e) => e.stopPropagation());
            textInput.addEventListener('click', (e) => e.stopPropagation());
        }
    }

    _initCanvas() {
        this.canvas = document.getElementById('pdfed-sig-canvas');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        
        // High DPI
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
        this.ctx.lineWidth = 2;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.strokeStyle = '#000';

        // Drawing Events
        let isDrawing = false;
        
        const getPos = (e) => {
             const r = this.canvas.getBoundingClientRect();
             return { 
                 x: e.clientX - r.left, 
                 y: e.clientY - r.top 
             };
        };

        this.canvas.onmousedown = (e) => {
            isDrawing = true;
            const p = getPos(e);
            this.ctx.beginPath();
            this.ctx.moveTo(p.x, p.y);
        };
        
        window.onmousemove = (e) => {
            if (!isDrawing) return;
            const p = getPos(e);
            this.ctx.lineTo(p.x, p.y);
            this.ctx.stroke();
        };
        
        window.onmouseup = () => isDrawing = false;
    }
    
    _renderFonts() {
        const list = document.getElementById('pdfed-font-list');
        const input = document.getElementById('pdfed-sig-text-input');
        const val = input?.value || 'Signature';
        
        if (input) input.style.fontFamily = `"${this.selectedFont}", cursive`;
        if (!list) return;
        
        list.innerHTML = this.fonts.map(font => `
            <div class="pdfed-font-option ${this.selectedFont === font ? 'active' : ''}" 
                 style="font-family: '${font}', cursive"
                 data-font="${font}">
                ${val}
            </div>
        `).join('');
        
        list.querySelectorAll('.pdfed-font-option').forEach(opt => {
            opt.onclick = () => {
                this.selectedFont = opt.dataset.font;
                this._renderFonts();
            };
        });
    }

    async _handleSave() {
        let items = null;
        
        if (this.activeTab === 'draw') {
            // Trim empty space? MVP: Just send full canvas dataURL
            items = this.canvas.toDataURL('image/png');
        } else if (this.activeTab === 'type') {
            // Render text to canvas then export
            const tempCanvas = document.createElement('canvas');
            const val = document.getElementById('pdfed-sig-text-input').value || 'Signature';
            const ctx = tempCanvas.getContext('2d');
            ctx.font = `60px "${this.selectedFont}"`;
            const width = ctx.measureText(val).width + 20;
            tempCanvas.width = width;
            tempCanvas.height = 100;
            ctx.font = `60px "${this.selectedFont}"`; // Set again after resize
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#000';
            ctx.fillText(val, 10, 50);
            items = tempCanvas.toDataURL('image/png');
        } else if (this.activeTab === 'upload') {
            // Image already loaded? handled in _handleFile
             items = this.uploadedImage;
        }

        if (items && this.onSave) {
            this.onSave(items);
            this.close();
        }
    }
    
    _handleFile(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (evt) => {
                this.uploadedImage = evt.target.result;
                // Show preview
                const area = document.getElementById('pdfed-sig-upload-area');
                area.innerHTML = `<img src="${evt.target.result}" style="max-height:100%;max-width:100%">`;
            };
            reader.readAsDataURL(file);
        }
    }

    close() {
        const el = document.getElementById('pdfed-signature-modal');
        if (el) el.remove();
    }

    _injectStyles() {
        if (document.getElementById('pdfed-sign-styles')) return;
        const style = document.createElement('style');
        style.id = 'pdfed-sign-styles';
        style.textContent = `
            .pdfed-modal-overlay {
                position: fixed; inset: 0;
                background: rgba(0,0,0,0.4);
                backdrop-filter: blur(4px);
                z-index: 2147483670;
                display: flex; align-items: center; justify-content: center;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                animation: pdfed-fade-in 0.2s ease-out;
            }
            .pdfed-modal-card {
                background: white; width: 500px;
                border-radius: 12px;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                overflow: hidden;
                display: flex; flex-direction: column;
            }
            .pdfed-modal-header {
                padding: 16px 20px; border-bottom: 1px solid #e5e7eb;
                display: flex; justify-content: space-between; align-items: center;
            }
            .pdfed-modal-title { font-weight: 600; font-size: 16px; color: #111827; }
            .pdfed-modal-close {
                background: none; border: none; font-size: 20px; color: #6b7280; cursor: pointer;
            }
            .pdfed-modal-tabs {
                display: flex; border-bottom: 1px solid #e5e7eb; background: #f9fafb;
                padding: 0 20px;
            }
            .pdfed-tab {
                padding: 12px 16px; background: none; border: none;
                border-bottom: 2px solid transparent; color: #6b7280;
                font-weight: 500; cursor: pointer; transition: all 0.2s;
            }
            .pdfed-tab.active { border-bottom-color: #007aff; color: #007aff; }
            
            .pdfed-modal-content { padding: 20px; min-height: 250px; }
            .pdfed-tab-pane { display: none; }
            .pdfed-tab-pane.active { display: block; }

            .pdfed-sig-canvas-wrapper {
                border: 1px solid #e5e7eb; border-radius: 8px;
                height: 200px; position: relative;
                background: #fff;
            }
            #pdfed-sig-canvas { width: 100%; height: 100%; cursor: crosshair; }
            .pdfed-sig-baseline {
                position: absolute; bottom: 40px; left: 20px; right: 20px;
                border-bottom: 1px dashed #e5e7eb;
                color: #e5e7eb; pointer-events: none; font-size: 24px; text-align: center;
            }

            .pdfed-sig-controls {
                display: flex; justify-content: space-between; margin-top: 10px;
            }
            .pdfed-btn-text { background: none; border: none; color: #007aff; cursor: pointer; }
            
            .pdfed-color-picker { display: flex; gap: 8px; }
            .pdfed-color-dot {
                width: 20px; height: 20px; border-radius: 50%; border: 2px solid white;
                box-shadow: 0 0 0 1px #e5e7eb; cursor: pointer;
            }
            .pdfed-color-dot.active { box-shadow: 0 0 0 2px #007aff; }

            .pdfed-sig-input {
                width: 100%; padding: 12px; border: 1px solid #e5e7eb; border-radius: 6px;
                font-size: 16px; margin-bottom: 16px; outline: none;
            }
            .pdfed-sig-input:focus { border-color: #007aff; }
            
            .pdfed-font-list {
                display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
                max-height: 200px; overflow-y: auto;
            }
            .pdfed-font-option {
                border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px;
                font-size: 24px; text-align: center; cursor: pointer;
            }
            .pdfed-font-option:hover { background: #f3f4f6; }
            .pdfed-font-option.active { border-color: #007aff; background: #eff6ff; }
            
            .pdfed-upload-area {
                border: 2px dashed #e5e7eb; border-radius: 8px; height: 200px;
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                color: #6b7280; cursor: pointer; gap: 10px;
            }
            .pdfed-upload-area:hover { border-color: #007aff; color: #007aff; background: #eff6ff; }

            .pdfed-modal-footer {
                padding: 16px 20px; border-top: 1px solid #e5e7eb;
                display: flex; justify-content: flex-end; gap: 10px;
                background: #f9fafb;
            }
            .pdfed-btn-primary {
                background: #007aff; color: white; border: none; padding: 8px 16px;
                border-radius: 6px; font-weight: 500; cursor: pointer;
            }
            .pdfed-btn-primary:hover { background: #006ae6; }
            .pdfed-btn-secondary {
                background: white; border: 1px solid #e5e7eb; color: #374151;
                padding: 8px 16px; border-radius: 6px; font-weight: 500; cursor: pointer;
            }
            .pdfed-btn-secondary:hover { background: #f9fafb; }
            
            @keyframes pdfed-fade-in { from { opacity: 0; } to { opacity: 1; } }
        `;
        document.head.appendChild(style);
    }
}
