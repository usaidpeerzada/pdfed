export class HeaderFooterModal {
  constructor(onApply, onRemove = null) {
    this.onApply = onApply;
    this.onRemove = onRemove;
    this.modal = null;

    // Default config
    this.config = {
      header: {
        enabled: false,
        left: "",
        center: "",
        right: "{page} of {total}",
      },
      footer: {
        enabled: true,
        left: "",
        center: "Page {page}",
        right: "",
      },
      fontSize: 10,
      color: "#666666",
      margin: 30,
    };
  }

  open() {
    if (this.modal) return;
    this._createModal();
    this._setupEvents();
  }

  close() {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
  }

  _createModal() {
    const overlay = document.createElement("div");
    overlay.id = "pdfed-headfoot-modal";

    overlay.innerHTML = `
      <style>
        #pdfed-headfoot-modal {
          position: fixed; inset: 0; z-index: 2147483647;
          background: rgba(0,0,0,0.6); backdrop-filter: blur(8px);
          display: flex; align-items: center; justify-content: center;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
        }
        #pdfed-headfoot-modal * { box-sizing: border-box; }
        
        .hf-panel {
          background: rgba(30, 30, 40, 0.95);
          border-radius: 16px; border: 1px solid rgba(255,255,255,0.1);
          box-shadow: 0 25px 50px rgba(0,0,0,0.5);
          width: 480px; max-height: 90vh; overflow: hidden;
        }
        
        .hf-header {
          padding: 14px 18px; border-bottom: 1px solid rgba(255,255,255,0.08);
          display: flex; justify-content: space-between; align-items: center;
        }
        .hf-title { font-size: 15px; font-weight: 600; color: #fff; }
        .hf-close {
          width: 26px; height: 26px; border-radius: 6px; border: none;
          background: rgba(255,255,255,0.1); color: #94a3b8; cursor: pointer;
          font-size: 16px; line-height: 1;
        }
        .hf-close:hover { background: rgba(239,68,68,0.3); color: #f87171; }
        
        .hf-body { padding: 16px; display: flex; flex-direction: column; gap: 14px; }
        
        .hf-section {
          background: rgba(0,0,0,0.2); border-radius: 10px; padding: 12px;
          border: 1px solid rgba(255,255,255,0.05);
        }
        .hf-section-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 10px;
        }
        .hf-section-title {
          font-size: 12px; font-weight: 600; color: #e2e8f0;
          display: flex; align-items: center; gap: 6px;
        }
        .hf-section-title svg { width: 14px; height: 14px; stroke: currentColor; fill: none; }
        
        .hf-toggle {
          width: 40px; height: 22px; border-radius: 11px;
          background: rgba(255,255,255,0.1); border: none; cursor: pointer;
          position: relative;
        }
        .hf-toggle.active { background: rgba(99,102,241,0.6); }
        .hf-toggle::after {
          content: ''; position: absolute; top: 2px; left: 2px;
          width: 18px; height: 18px; border-radius: 50%; background: #fff;
          transition: transform 0.2s;
        }
        .hf-toggle.active::after { transform: translateX(18px); }
        
        .hf-inputs { display: flex; gap: 8px; }
        .hf-input-group { flex: 1; display: flex; flex-direction: column; gap: 3px; }
        .hf-input-label { font-size: 9px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
        .hf-input {
          padding: 7px 9px; border-radius: 5px; border: 1px solid rgba(255,255,255,0.1);
          background: rgba(0,0,0,0.3); color: #fff; font-size: 12px;
        }
        .hf-input:focus { outline: none; border-color: rgba(99,102,241,0.5); }
        .hf-input::placeholder { color: #475569; }
        
        .hf-tokens { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 10px; }
        .hf-tokens-label { font-size: 10px; color: #64748b; margin-right: 4px; }
        .hf-token {
          padding: 4px 8px; border-radius: 4px;
          background: rgba(99,102,241,0.2); border: 1px solid rgba(99,102,241,0.3);
          color: #a5b4fc; font-size: 10px; font-weight: 500;
          cursor: pointer;
        }
        .hf-token:hover { background: rgba(99,102,241,0.3); }
        
        .hf-options { display: flex; gap: 12px; }
        .hf-option { flex: 1; display: flex; flex-direction: column; gap: 4px; }
        .hf-option-label { font-size: 10px; font-weight: 500; color: #94a3b8; }
        
        .hf-slider-row { display: flex; align-items: center; gap: 8px; }
        .hf-slider {
          flex: 1; height: 4px; border-radius: 2px;
          background: rgba(255,255,255,0.1); -webkit-appearance: none; cursor: pointer;
        }
        .hf-slider::-webkit-slider-thumb {
          -webkit-appearance: none; width: 12px; height: 12px; border-radius: 50%;
          background: #818cf8; cursor: pointer;
        }
        .hf-slider-val { font-size: 10px; color: #64748b; min-width: 28px; text-align: right; }
        
        .hf-footer {
          padding: 14px 18px; border-top: 1px solid rgba(255,255,255,0.08);
          display: flex; justify-content: space-between; gap: 8px;
        }
        .hf-footer-left { display: flex; gap: 8px; }
        .hf-footer-right { display: flex; gap: 8px; }
        .hf-btn {
          padding: 8px 16px; border-radius: 6px; font-size: 12px; font-weight: 500;
          cursor: pointer; border: none;
        }
        .hf-btn-secondary { background: rgba(255,255,255,0.1); color: #94a3b8; }
        .hf-btn-secondary:hover { background: rgba(255,255,255,0.15); }
        .hf-btn-danger { background: rgba(239,68,68,0.2); color: #f87171; }
        .hf-btn-danger:hover { background: rgba(239,68,68,0.3); }
        .hf-btn-primary {
          background: linear-gradient(135deg, #6366f1 0%, #818cf8 100%); color: #fff;
        }
        .hf-btn-primary:hover { filter: brightness(1.1); }
      </style>
      
      <div class="hf-panel">
        <div class="hf-header">
          <span class="hf-title">Headers & Footers</span>
          <button class="hf-close" id="hf-close">×</button>
        </div>
        
        <div class="hf-body">
          <!-- Header Section -->
          <div class="hf-section">
            <div class="hf-section-header">
              <span class="hf-section-title">
                <svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16"/></svg>
                Header
              </span>
              <button class="hf-toggle" id="hf-header-toggle"></button>
            </div>
            <div class="hf-inputs" id="hf-header-inputs" style="display: none;">
              <div class="hf-input-group">
                <span class="hf-input-label">Left</span>
                <input type="text" class="hf-input hf-text-input" id="hf-header-left" data-section="header" data-pos="left" placeholder="Left...">
              </div>
              <div class="hf-input-group">
                <span class="hf-input-label">Center</span>
                <input type="text" class="hf-input hf-text-input" id="hf-header-center" data-section="header" data-pos="center" placeholder="Center...">
              </div>
              <div class="hf-input-group">
                <span class="hf-input-label">Right</span>
                <input type="text" class="hf-input hf-text-input" id="hf-header-right" data-section="header" data-pos="right" placeholder="Right..." value="{page} of {total}">
              </div>
            </div>
          </div>
          
          <!-- Footer Section -->
          <div class="hf-section">
            <div class="hf-section-header">
              <span class="hf-section-title">
                <svg viewBox="0 0 24 24"><path d="M4 12h16M4 18h16"/></svg>
                Footer
              </span>
              <button class="hf-toggle active" id="hf-footer-toggle"></button>
            </div>
            <div class="hf-inputs" id="hf-footer-inputs">
              <div class="hf-input-group">
                <span class="hf-input-label">Left</span>
                <input type="text" class="hf-input hf-text-input" id="hf-footer-left" data-section="footer" data-pos="left" placeholder="Left...">
              </div>
              <div class="hf-input-group">
                <span class="hf-input-label">Center</span>
                <input type="text" class="hf-input hf-text-input" id="hf-footer-center" data-section="footer" data-pos="center" placeholder="Center..." value="Page {page}">
              </div>
              <div class="hf-input-group">
                <span class="hf-input-label">Right</span>
                <input type="text" class="hf-input hf-text-input" id="hf-footer-right" data-section="footer" data-pos="right" placeholder="Right...">
              </div>
            </div>
          </div>
          
          <!-- Tokens -->
          <div class="hf-tokens" id="hf-tokens">
            <span class="hf-tokens-label">Insert:</span>
            <button class="hf-token" data-token="{page}">Page #</button>
            <button class="hf-token" data-token="{total}">Total</button>
            <button class="hf-token" data-token="{date}">Date</button>
            <button class="hf-token" data-token="{filename}">Filename</button>
          </div>
          
          <!-- Options -->
          <div class="hf-options">
            <div class="hf-option">
              <span class="hf-option-label">Font Size</span>
              <div class="hf-slider-row">
                <input type="range" class="hf-slider" id="hf-fontsize" min="8" max="16" value="10">
                <span class="hf-slider-val" id="hf-fontsize-val">10pt</span>
              </div>
            </div>
            <div class="hf-option">
              <span class="hf-option-label">Color</span>
              <input type="color" class="hf-input" id="hf-color" value="#666666" style="height: 28px; padding: 2px;">
            </div>
            <div class="hf-option">
              <span class="hf-option-label">Margin</span>
              <div class="hf-slider-row">
                <input type="range" class="hf-slider" id="hf-margin" min="20" max="60" value="30">
                <span class="hf-slider-val" id="hf-margin-val">30pt</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="hf-footer">
          <div class="hf-footer-left">
            <button class="hf-btn hf-btn-danger" id="hf-remove" style="display: none;">Remove Headers/Footers</button>
          </div>
          <div class="hf-footer-right">
            <button class="hf-btn hf-btn-secondary" id="hf-cancel">Cancel</button>
            <button class="hf-btn hf-btn-primary" id="hf-apply">Apply</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this.modal = overlay;

    // Show remove button if callback provided
    if (this.onRemove) {
      overlay.querySelector("#hf-remove").style.display = "block";
    }
  }

  _setupEvents() {
    const modal = this.modal;

    // Close
    modal
      .querySelector("#hf-close")
      .addEventListener("click", () => this.close());
    modal
      .querySelector("#hf-cancel")
      .addEventListener("click", () => this.close());
    modal.addEventListener("click", (e) => {
      if (e.target === modal) this.close();
    });

    // Header toggle
    const headerToggle = modal.querySelector("#hf-header-toggle");
    const headerInputs = modal.querySelector("#hf-header-inputs");
    headerToggle.addEventListener("click", () => {
      this.config.header.enabled = !this.config.header.enabled;
      headerToggle.classList.toggle("active", this.config.header.enabled);
      headerInputs.style.display = this.config.header.enabled ? "flex" : "none";
    });

    // Footer toggle
    const footerToggle = modal.querySelector("#hf-footer-toggle");
    const footerInputs = modal.querySelector("#hf-footer-inputs");
    footerToggle.addEventListener("click", () => {
      this.config.footer.enabled = !this.config.footer.enabled;
      footerToggle.classList.toggle("active", this.config.footer.enabled);
      footerInputs.style.display = this.config.footer.enabled ? "flex" : "none";
    });
    // Set initial state
    this.config.footer.enabled = true;

    // Text inputs - use event delegation and stop propagation
    modal.querySelectorAll(".hf-text-input").forEach((input) => {
      input.addEventListener("input", (e) => {
        const section = e.target.dataset.section;
        const pos = e.target.dataset.pos;
        this.config[section][pos] = e.target.value;
      });
      // Prevent keyboard events from propagating to parent handlers
      input.addEventListener("keydown", (e) => e.stopPropagation());
      input.addEventListener("keyup", (e) => e.stopPropagation());
      input.addEventListener("keypress", (e) => e.stopPropagation());
    });

    // Sync initial values from HTML
    this.config.header.right = modal.querySelector("#hf-header-right").value;
    this.config.footer.center = modal.querySelector("#hf-footer-center").value;

    // Track last focused input for token insertion
    let lastFocusedInput = null;
    modal.querySelectorAll(".hf-text-input").forEach((input) => {
      input.addEventListener("focus", () => {
        lastFocusedInput = input;
      });
    });

    // Token insertion - event delegation
    modal.querySelector("#hf-tokens").addEventListener("click", (e) => {
      const btn = e.target.closest(".hf-token");
      if (!btn || !lastFocusedInput) return;

      const token = btn.dataset.token;
      const input = lastFocusedInput;
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      const val = input.value;

      input.value = val.slice(0, start) + token + val.slice(end);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
      input.setSelectionRange(start + token.length, start + token.length);
    });

    // Font size
    modal.querySelector("#hf-fontsize").addEventListener("input", (e) => {
      this.config.fontSize = parseInt(e.target.value);
      modal.querySelector(
        "#hf-fontsize-val"
      ).textContent = `${this.config.fontSize}pt`;
    });

    // Color
    modal.querySelector("#hf-color").addEventListener("input", (e) => {
      this.config.color = e.target.value;
    });

    // Margin
    modal.querySelector("#hf-margin").addEventListener("input", (e) => {
      this.config.margin = parseInt(e.target.value);
      modal.querySelector(
        "#hf-margin-val"
      ).textContent = `${this.config.margin}pt`;
    });

    // Apply
    modal.querySelector("#hf-apply").addEventListener("click", () => {
      if (this.onApply) this.onApply(this.config);
      this.close();
    });

    // Remove
    modal.querySelector("#hf-remove").addEventListener("click", () => {
      if (this.onRemove) this.onRemove();
      this.close();
    });
  }
}
