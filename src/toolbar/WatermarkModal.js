export class WatermarkModal {
  constructor(onApply, onRemove = null) {
    this.onApply = onApply;
    this.onRemove = onRemove;
    this.modal = null;
    this.previewCtx = null;
    this._previewScheduled = false;

    // Default config
    this.config = {
      text: "DRAFT",
      fontSize: 48,
      opacity: 0.3,
      color: "#888888",
      position: "diagonal",
      pageRange: "all",
    };
  }

  open() {
    if (this.modal) return;
    this._createModal();
    this._setupEvents();
    this._schedulePreview();
  }

  close() {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
      this.previewCtx = null;
    }
  }

  _createModal() {
    const overlay = document.createElement("div");
    overlay.id = "pdfed-watermark-modal";

    overlay.innerHTML = `
      <style>
        #pdfed-watermark-modal {
          position: fixed; inset: 0; z-index: 2147483647;
          background: rgba(0,0,0,0.6); backdrop-filter: blur(8px);
          display: flex; align-items: center; justify-content: center;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
        }
        #pdfed-watermark-modal * { box-sizing: border-box; }
        
        .wm-panel {
          background: rgba(30, 30, 40, 0.95);
          border-radius: 16px; border: 1px solid rgba(255,255,255,0.1);
          box-shadow: 0 25px 50px rgba(0,0,0,0.5);
          width: 440px; max-height: 90vh; overflow: hidden;
        }
        
        .wm-header {
          padding: 14px 18px; border-bottom: 1px solid rgba(255,255,255,0.08);
          display: flex; justify-content: space-between; align-items: center;
        }
        .wm-title { font-size: 15px; font-weight: 600; color: #fff; }
        .wm-close {
          width: 26px; height: 26px; border-radius: 6px; border: none;
          background: rgba(255,255,255,0.1); color: #94a3b8; cursor: pointer;
          font-size: 16px; line-height: 1;
        }
        .wm-close:hover { background: rgba(239,68,68,0.3); color: #f87171; }
        
        .wm-body { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
        
        .wm-preview {
          background: #fff; border-radius: 6px; height: 80px;
          display: flex; align-items: center; justify-content: center;
        }
        .wm-preview canvas { width: 100%; height: 100%; }
        
        .wm-presets { display: flex; gap: 6px; flex-wrap: wrap; }
        .wm-preset {
          padding: 5px 10px; border-radius: 5px; border: 1px solid rgba(255,255,255,0.15);
          background: rgba(255,255,255,0.05); color: #94a3b8;
          font-size: 11px; font-weight: 500; cursor: pointer;
        }
        .wm-preset:hover, .wm-preset.active {
          background: rgba(99,102,241,0.2); border-color: rgba(99,102,241,0.5); color: #a5b4fc;
        }
        
        .wm-field { display: flex; flex-direction: column; gap: 4px; }
        .wm-label { font-size: 11px; font-weight: 500; color: #94a3b8; }
        .wm-input {
          padding: 8px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1);
          background: rgba(0,0,0,0.3); color: #fff; font-size: 13px;
        }
        .wm-input:focus { outline: none; border-color: rgba(99,102,241,0.5); }
        
        .wm-row { display: flex; gap: 10px; }
        .wm-row .wm-field { flex: 1; }
        
        .wm-slider-row { display: flex; align-items: center; gap: 8px; }
        .wm-slider {
          flex: 1; height: 4px; border-radius: 2px;
          background: rgba(255,255,255,0.1); -webkit-appearance: none; cursor: pointer;
        }
        .wm-slider::-webkit-slider-thumb {
          -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%;
          background: #818cf8; cursor: pointer;
        }
        .wm-slider-value { font-size: 11px; color: #64748b; min-width: 35px; text-align: right; }
        
        .wm-positions { display: flex; gap: 6px; }
        .wm-pos-btn {
          flex: 1; padding: 8px; border-radius: 6px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.05); color: #94a3b8;
          font-size: 10px; font-weight: 500; cursor: pointer;
          display: flex; flex-direction: column; align-items: center; gap: 3px;
        }
        .wm-pos-btn svg { width: 20px; height: 20px; stroke: currentColor; fill: none; }
        .wm-pos-btn:hover, .wm-pos-btn.active {
          background: rgba(99,102,241,0.2); border-color: rgba(99,102,241,0.5); color: #a5b4fc;
        }
        
        .wm-pages { display: flex; gap: 6px; }
        .wm-page-btn {
          flex: 1; padding: 8px; border-radius: 6px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.05); color: #94a3b8;
          font-size: 11px; font-weight: 500; cursor: pointer;
        }
        .wm-page-btn:hover, .wm-page-btn.active {
          background: rgba(99,102,241,0.2); border-color: rgba(99,102,241,0.5); color: #a5b4fc;
        }
        
        .wm-footer {
          padding: 14px 18px; border-top: 1px solid rgba(255,255,255,0.08);
          display: flex; justify-content: space-between; gap: 8px;
        }
        .wm-footer-left { display: flex; gap: 8px; }
        .wm-footer-right { display: flex; gap: 8px; }
        .wm-btn {
          padding: 8px 16px; border-radius: 6px; font-size: 12px; font-weight: 500;
          cursor: pointer; border: none;
        }
        .wm-btn-secondary { background: rgba(255,255,255,0.1); color: #94a3b8; }
        .wm-btn-secondary:hover { background: rgba(255,255,255,0.15); }
        .wm-btn-danger { background: rgba(239,68,68,0.2); color: #f87171; }
        .wm-btn-danger:hover { background: rgba(239,68,68,0.3); }
        .wm-btn-primary {
          background: linear-gradient(135deg, #6366f1 0%, #818cf8 100%); color: #fff;
        }
        .wm-btn-primary:hover { filter: brightness(1.1); }
      </style>
      
      <div class="wm-panel">
        <div class="wm-header">
          <span class="wm-title">Add Watermark</span>
          <button class="wm-close" id="wm-close">×</button>
        </div>
        
        <div class="wm-body">
          <div class="wm-preview">
            <canvas id="wm-preview-canvas" width="380" height="70"></canvas>
          </div>
          
          <div class="wm-presets" id="wm-presets">
            <button class="wm-preset active" data-text="DRAFT">DRAFT</button>
            <button class="wm-preset" data-text="CONFIDENTIAL">CONFIDENTIAL</button>
            <button class="wm-preset" data-text="COPY">COPY</button>
            <button class="wm-preset" data-text="SAMPLE">SAMPLE</button>
            <button class="wm-preset" data-text="DO NOT COPY">DO NOT COPY</button>
          </div>
          
          <div class="wm-field">
            <label class="wm-label">Custom Text</label>
            <input type="text" class="wm-input" id="wm-text" placeholder="Enter watermark text..." value="DRAFT">
          </div>
          
          <div class="wm-row">
            <div class="wm-field">
              <label class="wm-label">Font Size</label>
              <div class="wm-slider-row">
                <input type="range" class="wm-slider" id="wm-size" min="24" max="96" value="48">
                <span class="wm-slider-value" id="wm-size-val">48pt</span>
              </div>
            </div>
            <div class="wm-field">
              <label class="wm-label">Opacity</label>
              <div class="wm-slider-row">
                <input type="range" class="wm-slider" id="wm-opacity" min="10" max="90" value="30">
                <span class="wm-slider-value" id="wm-opacity-val">30%</span>
              </div>
            </div>
          </div>
          
          <div class="wm-field">
            <label class="wm-label">Color</label>
            <input type="color" class="wm-input" id="wm-color" value="#888888" style="height: 36px; padding: 3px;">
          </div>
          
          <div class="wm-field">
            <label class="wm-label">Position</label>
            <div class="wm-positions" id="wm-positions">
              <button class="wm-pos-btn" data-pos="center">
                <svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                Center
              </button>
              <button class="wm-pos-btn active" data-pos="diagonal">
                <svg viewBox="0 0 24 24"><line x1="4" y1="20" x2="20" y2="4"/></svg>
                Diagonal
              </button>
              <button class="wm-pos-btn" data-pos="tile">
                <svg viewBox="0 0 24 24"><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="3" y="15" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/></svg>
                Tile
              </button>
            </div>
          </div>
          
          <div class="wm-field">
            <label class="wm-label">Apply To</label>
            <div class="wm-pages" id="wm-pages">
              <button class="wm-page-btn active" data-range="all">All Pages</button>
              <button class="wm-page-btn" data-range="current">Current Page</button>
            </div>
          </div>
        </div>
        
        <div class="wm-footer">
          <div class="wm-footer-left">
            <button class="wm-btn wm-btn-danger" id="wm-remove" style="display: none;">Remove Watermark</button>
          </div>
          <div class="wm-footer-right">
            <button class="wm-btn wm-btn-secondary" id="wm-cancel">Cancel</button>
            <button class="wm-btn wm-btn-primary" id="wm-apply">Apply</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this.modal = overlay;
    this.previewCtx = overlay
      .querySelector("#wm-preview-canvas")
      .getContext("2d");

    // Show remove button if callback provided
    if (this.onRemove) {
      overlay.querySelector("#wm-remove").style.display = "block";
    }
  }

  _setupEvents() {
    const modal = this.modal;
    const self = this;

    // Close
    modal
      .querySelector("#wm-close")
      .addEventListener("click", () => this.close());
    modal
      .querySelector("#wm-cancel")
      .addEventListener("click", () => this.close());
    modal.addEventListener("click", (e) => {
      if (e.target === modal) this.close();
    });

    // Presets - use event delegation for better performance
    modal.querySelector("#wm-presets").addEventListener("click", (e) => {
      const btn = e.target.closest(".wm-preset");
      if (!btn) return;
      modal
        .querySelectorAll(".wm-preset")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      this.config.text = btn.dataset.text;
      modal.querySelector("#wm-text").value = this.config.text;
      this._schedulePreview();
    });

    // Text input - with debounce
    const textInput = modal.querySelector("#wm-text");
    textInput.addEventListener("input", (e) => {
      this.config.text = e.target.value || "WATERMARK";
      modal
        .querySelectorAll(".wm-preset")
        .forEach((b) => b.classList.remove("active"));
      this._schedulePreview();
    });
    // Prevent event propagation issues
    textInput.addEventListener("keydown", (e) => e.stopPropagation());
    textInput.addEventListener("keyup", (e) => e.stopPropagation());

    // Font size
    modal.querySelector("#wm-size").addEventListener("input", (e) => {
      this.config.fontSize = parseInt(e.target.value);
      modal.querySelector(
        "#wm-size-val"
      ).textContent = `${this.config.fontSize}pt`;
      this._schedulePreview();
    });

    // Opacity
    modal.querySelector("#wm-opacity").addEventListener("input", (e) => {
      this.config.opacity = parseInt(e.target.value) / 100;
      modal.querySelector("#wm-opacity-val").textContent = `${e.target.value}%`;
      this._schedulePreview();
    });

    // Color
    modal.querySelector("#wm-color").addEventListener("input", (e) => {
      this.config.color = e.target.value;
      this._schedulePreview();
    });

    // Position - event delegation
    modal.querySelector("#wm-positions").addEventListener("click", (e) => {
      const btn = e.target.closest(".wm-pos-btn");
      if (!btn) return;
      modal
        .querySelectorAll(".wm-pos-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      this.config.position = btn.dataset.pos;
      this._schedulePreview();
    });

    // Page range - event delegation
    modal.querySelector("#wm-pages").addEventListener("click", (e) => {
      const btn = e.target.closest(".wm-page-btn");
      if (!btn) return;
      modal
        .querySelectorAll(".wm-page-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      this.config.pageRange = btn.dataset.range;
    });

    // Apply
    modal.querySelector("#wm-apply").addEventListener("click", () => {
      if (this.onApply) this.onApply(this.config);
      this.close();
    });

    // Remove
    modal.querySelector("#wm-remove").addEventListener("click", () => {
      if (this.onRemove) this.onRemove();
      this.close();
    });
  }

  // Debounced preview update for performance
  _schedulePreview() {
    if (this._previewScheduled) return;
    this._previewScheduled = true;
    requestAnimationFrame(() => {
      this._updatePreview();
      this._previewScheduled = false;
    });
  }

  _updatePreview() {
    if (!this.previewCtx) return;
    const ctx = this.previewCtx;
    const canvas = ctx.canvas;

    // Clear
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw watermark preview
    ctx.save();
    ctx.globalAlpha = this.config.opacity;
    ctx.fillStyle = this.config.color;
    const previewSize = Math.min(this.config.fontSize * 0.5, 28);
    ctx.font = `bold ${previewSize}px -apple-system, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (this.config.position === "diagonal") {
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(-Math.PI / 8);
      ctx.fillText(this.config.text, 0, 0);
    } else if (this.config.position === "tile") {
      const smallSize = previewSize * 0.7;
      ctx.font = `bold ${smallSize}px -apple-system, sans-serif`;
      for (let x = 60; x < canvas.width; x += 140) {
        for (let y = 25; y < canvas.height; y += 35) {
          ctx.fillText(this.config.text, x, y);
        }
      }
    } else {
      ctx.fillText(this.config.text, canvas.width / 2, canvas.height / 2);
    }

    ctx.restore();
  }
}
