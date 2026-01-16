export class TextTool {
  constructor(onComplete) {
    this.onComplete = onComplete; // Callback when user hits Enter/clicks away
    this.input = null;
    this.pageNum = 1; // Track which page we're adding text to
    this.options = {
      fontSize: 16,
      color: "#000000",
    };

    // Bind methods
    this._handleInputBlur = this._handleInputBlur.bind(this);
    this._handleInputKeydown = this._handleInputKeydown.bind(this);

    this._injectStyles();
  }

  _injectStyles() {
    if (document.getElementById("pdfed-text-tool-styles")) return;

    const css = `
        .pdfed-text-wrapper {
          position: fixed;
          z-index: 2147483650;
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        
        .pdfed-text-wrapper textarea {
          background: transparent;
          border: 1px dashed rgba(129, 140, 248, 0.5); 
          padding: 6px;
          margin: 0;
          outline: none;
          resize: none;
          overflow: hidden;
          line-height: 1.2;
          border-radius: 6px;
          transition: border-color 0.2s;
        }
        
        .pdfed-text-wrapper textarea:focus {
          border-color: #818cf8;
          box-shadow: 0 0 0 2px rgba(129, 140, 248, 0.2);
        }

        .pdfed-text-format-bar {
          display: flex;
          align-items: center;
          background: rgba(23, 23, 23, 0.9);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          padding: 4px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: white;
          gap: 2px;
          animation: pdfed-slide-up 0.15s ease-out;
        }
        
        @keyframes pdfed-slide-up {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .pdfed-text-format-bar button {
          background: transparent;
          border: none;
          color: #a1a1aa;
          cursor: pointer;
          width: 24px;
          height: 24px;
          border-radius: 4px;
          font-size: 13px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
        }

        .pdfed-text-format-bar button:hover {
          background: rgba(255, 255, 255, 0.1);
          color: white;
        }

        .pdfed-text-format-bar button.active {
          background: rgba(129, 140, 248, 0.2);
          color: #818cf8;
        }

        .pdfed-drag-handle {
          color: #52525b;
          cursor: grab;
          padding: 0 4px;
          margin-right: 2px;
          display: flex;
          align-items: center;
        }
        
        .pdfed-bg-picker-label {
           display: flex; 
           align-items: center;
           cursor: pointer;
           padding: 0 4px;
           color: #d4d4d8;
           font-size: 11px;
           gap: 2px;
           border-left: 1px solid rgba(255,255,255,0.1);
           margin-left: 2px;
        }
        
        .pdfed-bg-picker-label:hover {
            color: white;
        }
        
        .pdfed-font-select {
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 4px;
            color: #e4e4e7;
            font-size: 11px;
            padding: 2px 4px;
            cursor: pointer;
            outline: none;
            transition: all 0.15s;
            -webkit-appearance: none;
            -moz-appearance: none;
            appearance: none;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 24 24' fill='none' stroke='%23a1a1aa' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 4px center;
            padding-right: 16px;
        }
        
        .pdfed-font-select:hover {
            background-color: rgba(255, 255, 255, 0.15);
            border-color: rgba(255, 255, 255, 0.25);
        }
        
        .pdfed-font-select:focus {
            border-color: #818cf8;
            box-shadow: 0 0 0 2px rgba(129, 140, 248, 0.2);
        }
        
        .pdfed-font-size-select {
            width: 52px;
        }
        
        .pdfed-font-family-select {
            width: 90px;
        }
        
        .pdfed-text-color-picker {
            width: 20px;
            height: 20px;
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 4px;
            padding: 0;
            cursor: pointer;
            background: none;
        }
      `;

    const style = document.createElement("style");
    style.id = "pdfed-text-tool-styles";
    style.textContent = css;
    document.head.appendChild(style);
  }

  /**
   * Activate the tool (prepare state)
   */
  activate() {
    // Nothing visual to do until user clicks
    document.body.style.cursor = "text";
  }

  /**
   * Deactivate the tool
   */
  deactivate() {
    this._removeInput();
    document.body.style.cursor = "default";
  }

  /**
   * Start text input at specific coordinates
   * Called by Toolbar when CanvasLayer detects a click
   * @param {number} x - Screen X coordinate
   * @param {number} y - Screen Y coordinate
   * @param {Object} [initialData] - Optional data for editing existing text
   */
  startInput(x, y, initialData = null) {
    if (this.input) this._handleInputBlur();

    // Store pageNum from initialData if available
    this.pageNum = initialData?.pageNum || 1;

    // 1. Create Wrapper
    this.wrapper = document.createElement("div");
    this.wrapper.className = "pdfed-text-wrapper";

    // Inline styles only for positioning that changes
    this.wrapper.style.left = `${x}px`;
    this.wrapper.style.top = `${y - 50}px`; // Offset up for format bar

    // 2. Create Input (TextArea)
    this.input = document.createElement("textarea");

    // Determine initial styles
    const fontSize = initialData?.fontSize || this.options.fontSize || 16;
    const color = initialData?.color || this.options.color || "#000000";
    const bgColor = initialData?.backgroundColor || "transparent";
    const fontFamily =
      initialData?.fontFamily ||
      this.options.fontFamily ||
      "Helvetica, Arial, sans-serif";
    this.currentBgColor = bgColor;
    this.currentFontFamily = fontFamily;
    this.currentFontSize = fontSize;

    // Inline styles for text properties
    Object.assign(this.input.style, {
      fontSize: `${fontSize}px`,
      fontFamily: fontFamily,
      color: color,
      backgroundColor: bgColor,
      fontWeight: initialData?.bold ? "bold" : "normal",
      fontStyle: initialData?.italic ? "italic" : "normal",
      textDecoration: [
        initialData?.underline ? "underline" : "",
        initialData?.strike ? "line-through" : "",
      ]
        .filter(Boolean)
        .join(" "),

      minWidth: "50px",
      minHeight: "1.4em",
    });

    if (initialData?.text) {
      this.input.value = initialData.text;
      // Exact positioning for editing
      this.wrapper.style.left = `${x}px`;
      this.wrapper.style.top = `${y - 50}px`;
    }

    // Auto-resize logic - grows width and height as user types
    const resize = () => {
      // Temporarily shrink to get accurate scroll dimensions
      this.input.style.width = "auto";
      this.input.style.height = "auto";

      // Calculate new dimensions based on content
      const minWidth = 100;
      const minHeight = parseInt(this.input.style.fontSize) * 1.5 || 24;

      // Get scroll dimensions (content size)
      const contentWidth = Math.max(this.input.scrollWidth, minWidth);
      const contentHeight = Math.max(this.input.scrollHeight, minHeight);

      // Apply with some padding
      this.input.style.width = contentWidth + 20 + "px";
      this.input.style.height = contentHeight + "px";
    };

    this.input.addEventListener("input", resize);
    // Also trigger resize on keydown to handle Enter for newlines
    this.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        // Allow newline, then resize after a tick
        setTimeout(resize, 0);
      }
    });

    // 3. Create Mini Formatting Toolbar
    this.formatBar = document.createElement("div");
    this.formatBar.className = "pdfed-text-format-bar";
    this.formatBar.innerHTML = `
      <div class="pdfed-drag-handle">
        <svg width="12" height="12" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>
      </div>
      <select id="pdfed-font-family" class="pdfed-font-select pdfed-font-family-select" title="Font Family">
        <option value="Helvetica, Arial, sans-serif" ${
          (initialData?.fontFamily || "Helvetica").includes("Helvetica")
            ? "selected"
            : ""
        }>Helvetica</option>
        <option value="Arial, sans-serif" ${
          initialData?.fontFamily?.includes("Arial") &&
          !initialData?.fontFamily?.includes("Helvetica")
            ? "selected"
            : ""
        }>Arial</option>
        <option value="Times New Roman, serif" ${
          initialData?.fontFamily?.includes("Times") ? "selected" : ""
        }>Times</option>
        <option value="Georgia, serif" ${
          initialData?.fontFamily?.includes("Georgia") ? "selected" : ""
        }>Georgia</option>
        <option value="Courier New, monospace" ${
          initialData?.fontFamily?.includes("Courier") ? "selected" : ""
        }>Courier</option>
        <option value="Verdana, sans-serif" ${
          initialData?.fontFamily?.includes("Verdana") ? "selected" : ""
        }>Verdana</option>
        <option value="Trebuchet MS, sans-serif" ${
          initialData?.fontFamily?.includes("Trebuchet") ? "selected" : ""
        }>Trebuchet</option>
        <option value="Impact, sans-serif" ${
          initialData?.fontFamily?.includes("Impact") ? "selected" : ""
        }>Impact</option>
      </select>
      <select id="pdfed-font-size" class="pdfed-font-select pdfed-font-size-select" title="Font Size">
        <option value="8" ${fontSize === 8 ? "selected" : ""}>8</option>
        <option value="10" ${fontSize === 10 ? "selected" : ""}>10</option>
        <option value="12" ${fontSize === 12 ? "selected" : ""}>12</option>
        <option value="14" ${fontSize === 14 ? "selected" : ""}>14</option>
        <option value="16" ${fontSize === 16 ? "selected" : ""}>16</option>
        <option value="18" ${fontSize === 18 ? "selected" : ""}>18</option>
        <option value="20" ${fontSize === 20 ? "selected" : ""}>20</option>
        <option value="24" ${fontSize === 24 ? "selected" : ""}>24</option>
        <option value="28" ${fontSize === 28 ? "selected" : ""}>28</option>
        <option value="32" ${fontSize === 32 ? "selected" : ""}>32</option>
        <option value="36" ${fontSize === 36 ? "selected" : ""}>36</option>
        <option value="48" ${fontSize === 48 ? "selected" : ""}>48</option>
        <option value="64" ${fontSize === 64 ? "selected" : ""}>64</option>
        <option value="72" ${fontSize === 72 ? "selected" : ""}>72</option>
      </select>
      <div style="width: 1px; height: 16px; background: rgba(255,255,255,0.1); margin: 0 4px;"></div>
      <button data-fmt="bold" title="Bold" ${
        initialData?.bold ? 'class="active"' : ""
      }>B</button>
      <button data-fmt="italic" title="Italic" ${
        initialData?.italic ? 'class="active"' : ""
      }>I</button>
      <button data-fmt="underline" title="Underline" ${
        initialData?.underline ? 'class="active"' : ""
      }>U</button>
      <button data-fmt="strike" title="Strikethrough" ${
        initialData?.strike ? 'class="active"' : ""
      } style="text-decoration: line-through;">S</button>
      <div style="width: 1px; height: 16px; background: rgba(255,255,255,0.1); margin: 0 4px;"></div>
      <input type="color" id="pdfed-text-color" class="pdfed-text-color-picker" title="Text Color" value="${color}">
      <label class="pdfed-bg-picker-label" title="Background Color">
          <span>Bg</span>
          <input type="color" id="pdfed-bg-picker" value="${
            bgColor !== "transparent" ? bgColor : "#ffffff"
          }" style="width:16px; height:16px; border:none; padding:0; background:none; cursor:pointer;">
      </label>
      <button id="pdfed-bg-transparent" title="No Background" style="width:auto; padding:0 6px; font-size:10px;">Clear</button>`;

    // Bind events
    const bgPicker = this.formatBar.querySelector("#pdfed-bg-picker");
    const bgNone = this.formatBar.querySelector("#pdfed-bg-transparent");
    const fontFamilySelect = this.formatBar.querySelector("#pdfed-font-family");
    const fontSizeSelect = this.formatBar.querySelector("#pdfed-font-size");
    const textColorPicker = this.formatBar.querySelector("#pdfed-text-color");

    bgPicker.addEventListener("input", (e) => {
      this.currentBgColor = e.target.value;
      this.input.style.backgroundColor = this.currentBgColor;
    });

    bgNone.addEventListener("click", (e) => {
      e.preventDefault();
      this.currentBgColor = "transparent";
      this.input.style.backgroundColor = "transparent";
    });

    // Font Family Handler
    this.currentFontFamily = fontFamilySelect.value;
    fontFamilySelect.addEventListener("change", (e) => {
      this.currentFontFamily = e.target.value;
      this.input.style.fontFamily = this.currentFontFamily;
      this.options.fontFamily = this.currentFontFamily;
    });

    // Font Size Handler
    this.currentFontSize = parseInt(fontSizeSelect.value);
    fontSizeSelect.addEventListener("change", (e) => {
      this.currentFontSize = parseInt(e.target.value);
      this.input.style.fontSize = `${this.currentFontSize}px`;
      this.options.fontSize = this.currentFontSize;
    });

    // Text Color Handler
    textColorPicker.addEventListener("input", (e) => {
      this.input.style.color = e.target.value;
      this.options.color = e.target.value;
    });

    // Drag Logic
    const handle = this.formatBar.querySelector(".pdfed-drag-handle");
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    handle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation(); // critical
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      initialLeft = this.wrapper.offsetLeft;
      initialTop = this.wrapper.offsetTop;
      document.addEventListener("mousemove", onDrag);
      document.addEventListener("mouseup", stopDrag);
    });

    const onDrag = (e) => {
      if (!isDragging || !this.wrapper) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      this.wrapper.style.left = `${initialLeft + dx}px`;
      this.wrapper.style.top = `${initialTop + dy}px`;
    };

    const stopDrag = () => {
      isDragging = false;
      document.removeEventListener("mousemove", onDrag);
      document.removeEventListener("mouseup", stopDrag);
      if (this.input) this.input.focus();
    };

    // 4. Bind Format Buttons
    this.formatBar.addEventListener("mousedown", (e) => {
      // Only handle format button clicks - let select and input elements work normally
      const btn = e.target.closest("button");
      if (!btn || !btn.dataset.fmt) return;

      e.preventDefault();
      e.stopPropagation();

      this._toggleFormat(btn.dataset.fmt);
      btn.classList.toggle("active");
    });

    // 5. Append
    this.wrapper.appendChild(this.formatBar);
    this.wrapper.appendChild(this.input);
    document.body.appendChild(this.wrapper);

    if (initialData?.text) resize();

    this.input.addEventListener("blur", this._handleInputBlur);
    this.input.addEventListener("keydown", this._handleInputKeydown);

    this.input.focus();
  }

  _toggleFormat(fmt) {
    switch (fmt) {
      case "bold":
        this.input.style.fontWeight =
          this.input.style.fontWeight === "bold" ? "normal" : "bold";
        break;
      case "italic":
        this.input.style.fontStyle =
          this.input.style.fontStyle === "italic" ? "normal" : "italic";
        break;
      case "underline":
        const currentU = this.input.style.textDecoration || "";
        if (currentU.includes("underline")) {
          this.input.style.textDecoration = currentU
            .replace("underline", "")
            .trim();
        } else {
          this.input.style.textDecoration = (currentU + " underline").trim();
        }
        break;
      case "strike":
        const currentS = this.input.style.textDecoration || "";
        if (currentS.includes("line-through")) {
          this.input.style.textDecoration = currentS
            .replace("line-through", "")
            .trim();
        } else {
          this.input.style.textDecoration = (currentS + " line-through").trim();
        }
        break;
      // ... etc
    }
  }

  /**
   * Update tool options (font size, color)
   * @param {Object} options
   */
  setOptions(options) {
    this.options = { ...this.options, ...options };

    // Update active input if exists
    if (this.input) {
      if (options.fontSize) this.input.style.fontSize = `${options.fontSize}px`;
      if (options.color) this.input.style.color = options.color;
    }
  }

  /**
   * Handle user finishing input (Enter or click away)
   * @private
   */
  _handleInputBlur(e) {
    if (!this.input || !this.wrapper) return;
    // 1. Prevent closing if clicking inside our own toolbar
    if (
      e &&
      e.relatedTarget &&
      this.wrapper &&
      this.wrapper.contains(e.relatedTarget)
    ) {
      this.input.focus();
      return;
    }

    const text = this.input.value.trim();

    if (text) {
      const rect = this.input.getBoundingClientRect();

      // 2. Prepare Style Data
      const textStyles = {
        // Font styles
        bold: this.input.style.fontWeight === "bold",
        italic: this.input.style.fontStyle === "italic",
        underline: this.input.style.textDecoration.includes("underline"),
        strike: this.input.style.textDecoration.includes("line-through"),

        // Pass the Background Color
        backgroundColor: this.currentBgColor || "transparent",

        // Inherit other options (color, fontSize)
        ...this.options,
      };

      // 3. Send to Toolbar - INCLUDE pageNum!
      this.onComplete(
        text,
        rect.left,
        rect.top, // Send Top-Left coordinate for consistency
        textStyles,
        { width: rect.width, height: rect.height },
        this.pageNum
      );
    }

    this._removeInput();
  }

  _handleInputKeydown(e) {
    // Allow Enter for newlines - commit with Cmd/Ctrl+Enter instead
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      this.input.blur(); // Triggers _handleInputBlur
    }
    // Cancel on Escape
    if (e.key === "Escape") {
      this._removeInput();
    }
  }

  _removeInput() {
    // Clean up events
    if (this.input) {
      this.input.removeEventListener("blur", this._handleInputBlur);
      this.input.removeEventListener("keydown", this._handleInputKeydown);
    }

    // Remove the entire wrapper (which contains input + buttons)
    if (this.wrapper && this.wrapper.parentNode) {
      this.wrapper.parentNode.removeChild(this.wrapper);
    }

    this.wrapper = null;
    this.input = null;
    this.formatBar = null;
  }

  destroy() {
    this.deactivate();
  }
}
