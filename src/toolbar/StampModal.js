
export class StampModal {
    constructor(onSelect) {
        this.onSelect = onSelect;
        this.stamps = [
            { text: 'APPROVED', color: '#10B981', sub: 'VALIDATED' },
            { text: 'CONFIDENTIAL', color: '#EF4444', sub: 'DO NOT SHARE' },
            { text: 'DRAFT', color: '#6B7280', sub: 'WORK IN PROGRESS' },
            { text: 'FINAL', color: '#3B82F6', sub: 'OFFICIAL' },
            { text: 'REJECTED', color: '#DC2626', sub: 'VOID' },
            { text: 'URGENT', color: '#F59E0B', sub: 'PRIORITY' }
        ];
        this._injectStyles();
    }

    open() {
        this._createModal();
    }

    _createModal() {
        if (document.getElementById('pdfed-stamp-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'pdfed-stamp-modal';
        modal.className = 'pdfed-modal-overlay';
        
        modal.innerHTML = `
            <div class="pdfed-modal-card">
                <div class="pdfed-modal-header">
                    <span class="pdfed-modal-title">Select Stamp</span>
                    <button class="pdfed-modal-close">×</button>
                </div>
                
                <div class="pdfed-modal-content">
                    <div class="pdfed-stamp-grid">
                        ${this.stamps.map((s, i) => this._renderStampPreview(s, i)).join('')}
                    </div>
                </div>

                <div class="pdfed-modal-footer">
                    <button class="pdfed-btn-secondary" id="pdfed-stamp-cancel">Cancel</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this._bindEvents(modal);
    }

    _renderStampPreview(stamp, index) {
        // We use SVG for clean scaling rendering in the list
        const borderColor = stamp.color;
        const bgColor = `${stamp.color}15`; // 10% opacity
        
        return `
            <div class="pdfed-stamp-option" data-index="${index}">
                <div class="pdfed-stamp-preview" style="border-color: ${borderColor}; background: ${bgColor}; color: ${borderColor}">
                    <div class="pdfed-stamp-main">${stamp.text}</div>
                    <div class="pdfed-stamp-sub">${stamp.sub}</div>
                </div>
            </div>
        `;
    }

    _bindEvents(modal) {
        modal.querySelector('.pdfed-modal-close').onclick = () => this.close();
        modal.querySelector('#pdfed-stamp-cancel').onclick = () => this.close();
        
        modal.querySelectorAll('.pdfed-stamp-option').forEach(opt => {
            opt.onclick = () => {
                const index = parseInt(opt.dataset.index);
                const stamp = this.stamps[index];
                this._generateStampImage(stamp);
            };
        });
    }

    _generateStampImage(stamp) {
        const canvas = document.createElement('canvas');
        canvas.width = 300; 
        canvas.height = 120;
        const ctx = canvas.getContext('2d');
        
        // Config
        const color = stamp.color;
        
        // Draw Border
        ctx.strokeStyle = color;
        ctx.lineWidth = 6;
        
        // Rounded Rect? Or classic stamp box?
        // Let's do a double border box for "Premium" feel
        ctx.strokeRect(10, 10, 280, 100);
        
        ctx.lineWidth = 2;
        ctx.strokeRect(18, 18, 264, 84);

        // Fill
        ctx.fillStyle = `${color}20`; // Hex alpha
        ctx.fillRect(10, 10, 280, 100);
        
        // Text
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Main Text
        ctx.font = 'bold 36px "Helvetica Neue", Helvetica, Arial, sans-serif';
        ctx.fillText(stamp.text, 150, 50);
        
        // Sub Text
        ctx.font = 'bold 16px "Helvetica Neue", Helvetica, Arial, sans-serif';
        ctx.letterSpacing = '2px';
        ctx.fillText(stamp.sub, 150, 85);
        
        if (this.onSelect) {
            this.onSelect(canvas.toDataURL());
            this.close();
        }
    }

    close() {
        document.getElementById('pdfed-stamp-modal')?.remove();
    }

    _injectStyles() {
        if (document.getElementById('pdfed-stamp-styles')) return;
        // Reuse SignatureModal base styles if possible, but distinct enough
        const style = document.createElement('style');
        style.id = 'pdfed-stamp-styles';
        style.textContent = `
            #pdfed-stamp-modal .pdfed-modal-card { width: 600px; }
            
            .pdfed-stamp-grid {
                display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;
                padding: 10px;
                max-height: 400px; overflow-y: auto;
            }
            .pdfed-stamp-option {
                cursor: pointer; transition: transform 0.2s;
            }
            .pdfed-stamp-option:hover { transform: scale(1.03); }
            
            .pdfed-stamp-preview {
                border: 3px solid; border-radius: 8px;
                padding: 20px; text-align: center;
                display: flex; flex-direction: column; gap: 5px;
            }
            .pdfed-stamp-main { font-weight: 800; font-size: 24px; letter-spacing: 1px; }
            .pdfed-stamp-sub { font-weight: 600; font-size: 12px; opacity: 0.8; letter-spacing: 2px; }
        `;
        document.head.appendChild(style);
    }
}
