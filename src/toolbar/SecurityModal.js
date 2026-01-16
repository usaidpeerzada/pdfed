export class SecurityModal {
  constructor(onApply) {
    this.onApply = onApply;
    this.modal = null;

    // Default config
    this.config = {
      userPassword: "", // Password to open document
      ownerPassword: "", // Password to change permissions
      permissions: {
        printing: true,
        modifying: false,
        copying: true,
        annotating: true,
      },
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
    overlay.id = "pdfed-security-modal";

    overlay.innerHTML = `
      <style>
        #pdfed-security-modal {
          position: fixed; inset: 0; z-index: 2147483647;
          background: rgba(0,0,0,0.6); backdrop-filter: blur(8px);
          display: flex; align-items: center; justify-content: center;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
          animation: fadeIn 0.2s ease;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        
        .sec-panel {
          background: rgba(30, 30, 40, 0.95); backdrop-filter: blur(20px);
          border-radius: 16px; border: 1px solid rgba(255,255,255,0.1);
          box-shadow: 0 25px 50px rgba(0,0,0,0.5);
          width: 440px; max-height: 90vh; overflow: hidden;
          animation: slideUp 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } }
        
        .sec-header {
          padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.08);
          display: flex; justify-content: space-between; align-items: center;
        }
        .sec-title { font-size: 16px; font-weight: 600; color: #fff; display: flex; align-items: center; gap: 8px; }
        .sec-title svg { width: 20px; height: 20px; stroke: #818cf8; fill: none; }
        .sec-close {
          width: 28px; height: 28px; border-radius: 8px; border: none;
          background: rgba(255,255,255,0.1); color: #94a3b8; cursor: pointer;
          font-size: 18px; transition: all 0.2s;
        }
        .sec-close:hover { background: rgba(239,68,68,0.3); color: #f87171; }
        
        .sec-body { padding: 20px; display: flex; flex-direction: column; gap: 20px; }
        
        .sec-section {
          background: rgba(0,0,0,0.2); border-radius: 12px; padding: 16px;
          border: 1px solid rgba(255,255,255,0.05);
        }
        .sec-section-title {
          font-size: 12px; font-weight: 600; color: #94a3b8;
          text-transform: uppercase; letter-spacing: 0.5px;
          margin-bottom: 12px; display: flex; align-items: center; gap: 6px;
        }
        .sec-section-title svg { width: 14px; height: 14px; stroke: currentColor; fill: none; }
        
        .sec-field { margin-bottom: 12px; }
        .sec-field:last-child { margin-bottom: 0; }
        .sec-label { font-size: 11px; color: #64748b; margin-bottom: 6px; display: block; }
        
        .sec-input-wrap {
          position: relative; display: flex; align-items: center;
        }
        .sec-input {
          width: 100%; padding: 10px 40px 10px 12px; border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(0,0,0,0.3); color: #fff; font-size: 13px;
          transition: border-color 0.2s;
        }
        .sec-input:focus { outline: none; border-color: rgba(99,102,241,0.5); }
        .sec-input::placeholder { color: #475569; }
        .sec-toggle-vis {
          position: absolute; right: 8px; background: none; border: none;
          color: #64748b; cursor: pointer; padding: 4px;
        }
        .sec-toggle-vis:hover { color: #94a3b8; }
        .sec-toggle-vis svg { width: 18px; height: 18px; stroke: currentColor; fill: none; }
        
        .sec-strength {
          margin-top: 8px; height: 4px; border-radius: 2px;
          background: rgba(255,255,255,0.1); overflow: hidden;
        }
        .sec-strength-bar {
          height: 100%; width: 0%; border-radius: 2px;
          transition: all 0.3s ease;
        }
        .sec-strength-text { font-size: 10px; color: #64748b; margin-top: 4px; }
        
        .sec-perm-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
        }
        .sec-perm {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px; border-radius: 8px;
          background: rgba(255,255,255,0.03); cursor: pointer;
          transition: all 0.2s;
        }
        .sec-perm:hover { background: rgba(255,255,255,0.06); }
        .sec-perm input { display: none; }
        .sec-perm-check {
          width: 18px; height: 18px; border-radius: 4px;
          border: 2px solid rgba(255,255,255,0.2);
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s;
        }
        .sec-perm input:checked + .sec-perm-check {
          background: #818cf8; border-color: #818cf8;
        }
        .sec-perm-check svg { width: 12px; height: 12px; stroke: #fff; fill: none; opacity: 0; }
        .sec-perm input:checked + .sec-perm-check svg { opacity: 1; }
        .sec-perm-label { font-size: 12px; color: #e2e8f0; }
        
        .sec-footer {
          padding: 16px 20px; border-top: 1px solid rgba(255,255,255,0.08);
          display: flex; justify-content: flex-end; gap: 10px;
        }
        .sec-btn {
          padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 500;
          cursor: pointer; transition: all 0.2s; border: none;
        }
        .sec-btn-secondary { background: rgba(255,255,255,0.1); color: #94a3b8; }
        .sec-btn-secondary:hover { background: rgba(255,255,255,0.15); }
        .sec-btn-primary {
          background: linear-gradient(135deg, #6366f1 0%, #818cf8 100%); color: #fff;
        }
        .sec-btn-primary:hover { filter: brightness(1.1); box-shadow: 0 4px 15px rgba(99,102,241,0.4); }
        .sec-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        
        .sec-warning {
          background: rgba(234, 179, 8, 0.1); border: 1px solid rgba(234, 179, 8, 0.3);
          border-radius: 8px; padding: 12px; display: flex; gap: 10px;
          font-size: 12px; color: #fbbf24;
        }
        .sec-warning svg { width: 18px; height: 18px; stroke: currentColor; fill: none; flex-shrink: 0; }
      </style>
      
      <div class="sec-panel">
        <div class="sec-header">
          <span class="sec-title">
            <svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Protect Document
          </span>
          <button class="sec-close" id="sec-close">×</button>
        </div>
        
        <div class="sec-body">
          <div class="sec-warning">
            <svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <span>Remember your password! If you forget it, the document cannot be recovered.</span>
          </div>
          
          <div class="sec-section">
            <div class="sec-section-title">
              <svg viewBox="0 0 24 24"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
              Open Password
            </div>
            <div class="sec-field">
              <label class="sec-label">Password required to open this PDF</label>
              <div class="sec-input-wrap">
                <input type="password" class="sec-input" id="sec-user-pwd" placeholder="Enter password...">
                <button class="sec-toggle-vis" data-target="sec-user-pwd">
                  <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
              </div>
              <div class="sec-strength"><div class="sec-strength-bar" id="sec-strength-bar"></div></div>
              <div class="sec-strength-text" id="sec-strength-text"></div>
            </div>
            <div class="sec-field">
              <label class="sec-label">Confirm password</label>
              <div class="sec-input-wrap">
                <input type="password" class="sec-input" id="sec-user-pwd-confirm" placeholder="Confirm password...">
              </div>
            </div>
          </div>
          
          <div class="sec-section">
            <div class="sec-section-title">
              <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Permissions
            </div>
            <div class="sec-perm-grid">
              <label class="sec-perm">
                <input type="checkbox" id="sec-perm-print" checked>
                <span class="sec-perm-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></span>
                <span class="sec-perm-label">Allow Printing</span>
              </label>
              <label class="sec-perm">
                <input type="checkbox" id="sec-perm-copy" checked>
                <span class="sec-perm-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></span>
                <span class="sec-perm-label">Allow Copying</span>
              </label>
              <label class="sec-perm">
                <input type="checkbox" id="sec-perm-modify">
                <span class="sec-perm-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></span>
                <span class="sec-perm-label">Allow Modifying</span>
              </label>
              <label class="sec-perm">
                <input type="checkbox" id="sec-perm-annotate" checked>
                <span class="sec-perm-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></span>
                <span class="sec-perm-label">Allow Annotating</span>
              </label>
            </div>
          </div>
        </div>
        
        <div class="sec-footer">
          <button class="sec-btn sec-btn-secondary" id="sec-cancel">Cancel</button>
          <button class="sec-btn sec-btn-primary" id="sec-apply" disabled>Protect Document</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this.modal = overlay;
  }

  _setupEvents() {
    const modal = this.modal;

    // Close
    modal.querySelector("#sec-close").onclick = () => this.close();
    modal.querySelector("#sec-cancel").onclick = () => this.close();
    modal.addEventListener("click", (e) => {
      if (e.target === modal) this.close();
    });

    // Toggle password visibility
    modal.querySelectorAll(".sec-toggle-vis").forEach((btn) => {
      btn.onclick = () => {
        const input = modal.querySelector(`#${btn.dataset.target}`);
        input.type = input.type === "password" ? "text" : "password";
      };
    });

    // Password strength
    const userPwd = modal.querySelector("#sec-user-pwd");
    const confirmPwd = modal.querySelector("#sec-user-pwd-confirm");
    const strengthBar = modal.querySelector("#sec-strength-bar");
    const strengthText = modal.querySelector("#sec-strength-text");
    const applyBtn = modal.querySelector("#sec-apply");

    const updateStrength = (password) => {
      let strength = 0;
      if (password.length >= 6) strength++;
      if (password.length >= 10) strength++;
      if (/[A-Z]/.test(password)) strength++;
      if (/[0-9]/.test(password)) strength++;
      if (/[^A-Za-z0-9]/.test(password)) strength++;

      const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#10b981"];
      const labels = ["Weak", "Fair", "Good", "Strong", "Excellent"];

      strengthBar.style.width = `${(strength / 5) * 100}%`;
      strengthBar.style.background = colors[strength - 1] || "#ef4444";
      strengthText.textContent = password
        ? labels[strength - 1] || "Too short"
        : "";
    };

    const validatePasswords = () => {
      const pwd = userPwd.value;
      const confirm = confirmPwd.value;
      const match = pwd && confirm && pwd === confirm && pwd.length >= 4;
      applyBtn.disabled = !match;

      if (confirm && pwd !== confirm) {
        confirmPwd.style.borderColor = "#ef4444";
      } else {
        confirmPwd.style.borderColor = "";
      }
    };

    userPwd.oninput = (e) => {
      this.config.userPassword = e.target.value;
      updateStrength(e.target.value);
      validatePasswords();
    };

    confirmPwd.oninput = validatePasswords;

    // Permissions
    modal.querySelector("#sec-perm-print").onchange = (e) =>
      (this.config.permissions.printing = e.target.checked);
    modal.querySelector("#sec-perm-copy").onchange = (e) =>
      (this.config.permissions.copying = e.target.checked);
    modal.querySelector("#sec-perm-modify").onchange = (e) =>
      (this.config.permissions.modifying = e.target.checked);
    modal.querySelector("#sec-perm-annotate").onchange = (e) =>
      (this.config.permissions.annotating = e.target.checked);

    // Apply
    applyBtn.onclick = () => {
      // Use same password for owner if not specified separately
      this.config.ownerPassword = this.config.userPassword;
      if (this.onApply) this.onApply(this.config);
      this.close();
    };
  }
}
