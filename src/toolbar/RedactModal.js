export class RedactModal {
  constructor(onSelect) {
    this.onSelect = onSelect;
    this.options = {
      fillColor: "#000000",
      pattern: "solid", // solid, striped, crosshatch
    };
    this._injectStyles();
  }

  open() {
    this._createModal();
  }

  _createModal() {
    if (document.getElementById("pdfed-redact-modal")) return;

    const modal = document.createElement("div");
    modal.id = "pdfed-redact-modal";
    modal.className = "pdfed-modal-overlay";

    modal.innerHTML = `
            <div class="pdfed-modal-card">
                <div class="pdfed-modal-header">
                    <span class="pdfed-modal-title">Redaction Options</span>
                    <button class="pdfed-modal-close">×</button>
                </div>
                
                <div class="pdfed-modal-content">
                    <div class="pdfed-redact-section">
                        <label class="pdfed-redact-label">Redaction Style</label>
                        <div class="pdfed-redact-patterns">
                            <button class="pdfed-pattern-btn active" data-pattern="solid" title="Solid Fill">
                                <div class="pdfed-pattern-preview pdfed-pattern-solid"></div>
                                <span>Solid</span>
                            </button>
                            <button class="pdfed-pattern-btn" data-pattern="striped" title="Striped">
                                <div class="pdfed-pattern-preview pdfed-pattern-striped"></div>
                                <span>Striped</span>
                            </button>
                            <button class="pdfed-pattern-btn" data-pattern="crosshatch" title="Crosshatch">
                                <div class="pdfed-pattern-preview pdfed-pattern-crosshatch"></div>
                                <span>Crosshatch</span>
                            </button>
                        </div>
                    </div>
                    
                    <div class="pdfed-redact-section">
                        <label class="pdfed-redact-label">Fill Color</label>
                        <div class="pdfed-redact-colors">
                            <button class="pdfed-color-btn active" data-color="#000000" style="background: #000000;" title="Black"></button>
                            <button class="pdfed-color-btn" data-color="#1f2937" style="background: #1f2937;" title="Dark Gray"></button>
                            <button class="pdfed-color-btn" data-color="#374151" style="background: #374151;" title="Gray"></button>
                            <button class="pdfed-color-btn" data-color="#dc2626" style="background: #dc2626;" title="Red"></button>
                            <button class="pdfed-color-btn" data-color="#2563eb" style="background: #2563eb;" title="Blue"></button>
                            <button class="pdfed-color-btn" data-color="#ffffff" style="background: #ffffff; border: 1px solid #374151;" title="White"></button>
                        </div>
                    </div>
                    
                    <div class="pdfed-redact-section">
                        <label class="pdfed-redact-label">Preview</label>
                        <div class="pdfed-redact-preview" id="pdfed-redact-preview">
                            <div class="pdfed-preview-inner" id="pdfed-preview-inner"></div>
                        </div>
                    </div>
                </div>

                <div class="pdfed-modal-footer">
                    <button class="pdfed-btn-secondary" id="pdfed-redact-cancel">Cancel</button>
                    <button class="pdfed-btn-primary" id="pdfed-redact-apply">Apply Redaction Style</button>
                </div>
            </div>
        `;

    document.body.appendChild(modal);
    this._bindEvents(modal);
    this._updatePreview();
  }

  _bindEvents(modal) {
    modal.querySelector(".pdfed-modal-close").onclick = () => this.close();
    modal.querySelector("#pdfed-redact-cancel").onclick = () => this.close();

    // Pattern selection
    modal.querySelectorAll(".pdfed-pattern-btn").forEach((btn) => {
      btn.onclick = () => {
        modal
          .querySelectorAll(".pdfed-pattern-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.options.pattern = btn.dataset.pattern;
        this._updatePreview();
      };
    });

    // Color selection
    modal.querySelectorAll(".pdfed-color-btn").forEach((btn) => {
      btn.onclick = () => {
        modal
          .querySelectorAll(".pdfed-color-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.options.fillColor = btn.dataset.color;
        this._updatePreview();
      };
    });

    // Apply button
    modal.querySelector("#pdfed-redact-apply").onclick = () => {
      if (this.onSelect) {
        this.onSelect(this.options);
      }
      this.close();
    };
  }

  _updatePreview() {
    const preview = document.getElementById("pdfed-preview-inner");
    if (!preview) return;

    const { fillColor, pattern } = this.options;

    // Set base color
    preview.style.backgroundColor = fillColor;

    // Set pattern
    preview.className = "pdfed-preview-inner";
    if (pattern === "striped") {
      preview.classList.add("pdfed-preview-striped");
    } else if (pattern === "crosshatch") {
      preview.classList.add("pdfed-preview-crosshatch");
    }
  }

  _getContrastColor(hexColor) {
    // Convert hex to RGB
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);

    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    return luminance > 0.5 ? "#000000" : "#ffffff";
  }

  close() {
    document.getElementById("pdfed-redact-modal")?.remove();
  }

  _injectStyles() {
    if (document.getElementById("pdfed-redact-styles")) return;

    const style = document.createElement("style");
    style.id = "pdfed-redact-styles";
    style.textContent = `
            /* Base Modal Styles */
            #pdfed-redact-modal {
                position: fixed;
                inset: 0;
                background: rgba(0,0,0,0.6);
                backdrop-filter: blur(4px);
                z-index: 2147483670;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                animation: pdfed-fade-in 0.2s ease-out;
            }
            
            #pdfed-redact-modal .pdfed-modal-card {
                background: #1f1f23;
                width: 480px;
                border-radius: 12px;
                box-shadow: 0 20px 40px rgba(0,0,0,0.4);
                overflow: hidden;
                border: 1px solid rgba(255,255,255,0.1);
            }
            
            #pdfed-redact-modal .pdfed-modal-header {
                padding: 16px 20px;
                border-bottom: 1px solid rgba(255,255,255,0.1);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            #pdfed-redact-modal .pdfed-modal-title {
                font-weight: 600;
                font-size: 16px;
                color: #fff;
            }
            
            #pdfed-redact-modal .pdfed-modal-close {
                background: none;
                border: none;
                font-size: 20px;
                color: #9ca3af;
                cursor: pointer;
            }
            
            #pdfed-redact-modal .pdfed-modal-close:hover {
                color: #fff;
            }
            
            #pdfed-redact-modal .pdfed-modal-content {
                padding: 20px;
            }
            
            #pdfed-redact-modal .pdfed-modal-footer {
                padding: 16px 20px;
                border-top: 1px solid rgba(255,255,255,0.1);
                display: flex;
                justify-content: flex-end;
                gap: 10px;
                background: rgba(0,0,0,0.2);
            }
            
            #pdfed-redact-modal .pdfed-btn-primary {
                background: #818cf8;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                font-weight: 500;
                cursor: pointer;
            }
            
            #pdfed-redact-modal .pdfed-btn-primary:hover {
                background: #6366f1;
            }
            
            #pdfed-redact-modal .pdfed-btn-secondary {
                background: transparent;
                border: 1px solid rgba(255,255,255,0.2);
                color: #a1a1aa;
                padding: 10px 20px;
                border-radius: 6px;
                font-weight: 500;
                cursor: pointer;
            }
            
            #pdfed-redact-modal .pdfed-btn-secondary:hover {
                background: rgba(255,255,255,0.05);
                color: #fff;
            }
            
            @keyframes pdfed-fade-in { from { opacity: 0; } to { opacity: 1; } }
            
            /* Redact-specific styles */
            
            .pdfed-redact-section {
                margin-bottom: 20px;
            }
            
            .pdfed-redact-label {
                display: block;
                font-weight: 600;
                color: #e4e4e7;
                margin-bottom: 10px;
                font-size: 13px;
            }
            
            .pdfed-redact-patterns {
                display: flex;
                gap: 12px;
            }
            
            .pdfed-pattern-btn {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 6px;
                padding: 12px 16px;
                background: rgba(255, 255, 255, 0.05);
                border: 2px solid rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s;
                color: #a1a1aa;
                font-size: 11px;
            }
            
            .pdfed-pattern-btn:hover {
                border-color: rgba(255, 255, 255, 0.2);
                background: rgba(255, 255, 255, 0.08);
            }
            
            .pdfed-pattern-btn.active {
                border-color: #818cf8;
                background: rgba(129, 140, 248, 0.1);
                color: #818cf8;
            }
            
            .pdfed-pattern-preview {
                width: 60px;
                height: 30px;
                border-radius: 4px;
                background: #000;
            }
            
            .pdfed-pattern-striped {
                background: repeating-linear-gradient(
                    45deg,
                    #000,
                    #000 4px,
                    #333 4px,
                    #333 8px
                );
            }
            
            .pdfed-pattern-crosshatch {
                background: 
                    repeating-linear-gradient(45deg, transparent, transparent 4px, #333 4px, #333 5px),
                    repeating-linear-gradient(-45deg, transparent, transparent 4px, #333 4px, #333 5px),
                    #000;
            }
            
            .pdfed-redact-colors {
                display: flex;
                gap: 10px;
            }
            
            .pdfed-color-btn {
                width: 32px;
                height: 32px;
                border-radius: 6px;
                border: 2px solid transparent;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .pdfed-color-btn:hover {
                transform: scale(1.1);
            }
            
            .pdfed-color-btn.active {
                border-color: #818cf8;
                box-shadow: 0 0 0 2px rgba(129, 140, 248, 0.3);
            }
            
            .pdfed-redact-input {
                width: 100%;
                padding: 10px 12px;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 6px;
                color: #fff;
                font-size: 14px;
                outline: none;
                transition: border-color 0.2s;
            }
            
            .pdfed-redact-input:focus {
                border-color: #818cf8;
            }
            
            .pdfed-redact-input::placeholder {
                color: #71717a;
            }
            
            .pdfed-redact-hint {
                display: block;
                margin-top: 6px;
                font-size: 11px;
                color: #71717a;
            }
            
            .pdfed-redact-preview {
                background: rgba(255, 255, 255, 0.03);
                border: 1px dashed rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                height: 60px;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 10px;
            }
            
            .pdfed-preview-inner {
                width: 100%;
                height: 100%;
                border-radius: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                font-size: 14px;
                letter-spacing: 2px;
                text-transform: uppercase;
            }
            
            .pdfed-preview-striped {
                background-image: repeating-linear-gradient(
                    45deg,
                    transparent,
                    transparent 4px,
                    rgba(255, 255, 255, 0.1) 4px,
                    rgba(255, 255, 255, 0.1) 8px
                ) !important;
            }
            
            .pdfed-preview-crosshatch {
                background-image: 
                    repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.1) 4px, rgba(255,255,255,0.1) 5px),
                    repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(255,255,255,0.1) 4px, rgba(255,255,255,0.1) 5px) !important;
            }
        `;
    document.head.appendChild(style);
  }
}
