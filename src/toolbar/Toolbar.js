import { StateManager } from "../core/StateManager.js";
import { PDFEngine } from "../core/PDFEngine.js";
import { PDFViewer } from "../core/PDFViewer.js";
import { CanvasLayer } from "../core/CanvasLayer.js";
import { TextTool } from "./tools/TextTool.js";
import { SignatureModal } from "./SignatureModal.js";
import { StampModal } from "./StampModal.js";
import { PageOrganizer } from "./PageOrganizer.js";
import { PageOperations } from "./PageOperations.js";
import { WatermarkModal } from "./WatermarkModal.js";
import { HeaderFooterModal } from "./HeaderFooterModal.js";
import { SecurityModal } from "./SecurityModal.js";
import { RedactModal } from "./RedactModal.js";

// SVG Icons (Lucide-style)
const ICONS = {
  select:
    '<svg viewBox="0 0 24 24"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="M13 13l6 6"/></svg>',
  text: '<svg viewBox="0 0 24 24"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>',
  highlight:
    '<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  underline:
    '<svg viewBox="0 0 24 24"><path d="M6 4v6a6 6 0 0 0 12 0V4"/><line x1="4" y1="20" x2="20" y2="20"/></svg>',
  strikethrough:
    '<svg viewBox="0 0 24 24"><path d="M16 4H9a3 3 0 0 0-2.83 4"/><path d="M14 12a4 4 0 0 1 0 8H6"/><line x1="4" y1="12" x2="20" y2="12"/></svg>',
  draw: '<svg viewBox="0 0 24 24"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/></svg>',
  shapes:
    '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>',
  image:
    '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg>',
  signature:
    '<svg viewBox="0 0 24 24"><path d="M2 17c.64.62 1.61.76 2.37.25.78-.52 1.27-1.37 1.63-2.25.71-1.73 1-3.5 2-5.25.52-.92 1.24-1.75 2.24-2.18 1-.43 2.24-.24 3.01.54.8.8 1 2 .68 3.07-.32 1.07-1 2-1.68 2.82-.68.82-1.5 1.5-2.25 2.25"/><path d="M12 21c1.65 0 3 0 4.5-1.5s1.5-3 1.5-4.5"/><path d="M19 15c1-1 2.5-2.5 2.5-3.5 0-1.65-1.35-3-3-3s-3 1.35-3 3c0 1 1.5 2.5 2.5 3.5"/></svg>',
  stamp:
    '<svg viewBox="0 0 24 24"><rect x="3" y="17" width="18" height="4" rx="1"/><path d="M6 17V7a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v10"/></svg>',
  comment:
    '<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  pages:
    '<svg viewBox="0 0 24 24"><rect x="8" y="2" width="12" height="18" rx="1"/><path d="M4 6h4"/><path d="M4 10h4"/><path d="M4 14h4"/></svg>',
  undo: '<svg viewBox="0 0 24 24"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>',
  redo: '<svg viewBox="0 0 24 24"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg>',
  redo: '<svg viewBox="0 0 24 24"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg>',
  save: '<svg viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',
  date: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  watermark:
    '<svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>',
  headfoot:
    '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/></svg>',
  redact:
    '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="1" fill="currentColor"/><line x1="7" y1="12" x2="17" y2="12" stroke="#fff" stroke-width="2"/></svg>',
  lock: '<svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
};

// Tool definitions with shortcuts
const TOOLS = {
  select: {
    id: "select",
    icon: ICONS.select,
    label: "Select",
    shortcut: "V",
    group: "general",
  },
  text: {
    id: "text",
    icon: ICONS.text,
    label: "Text",
    shortcut: "T",
    group: "edit",
  },
  draw: {
    id: "draw",
    icon: ICONS.draw,
    label: "Draw",
    shortcut: "D",
    group: "edit",
  },
  shapes: {
    id: "shapes",
    icon: ICONS.shapes,
    label: "Shapes",
    shortcut: "S",
    group: "edit",
  },
  image: {
    id: "image",
    icon: ICONS.image,
    label: "Image",
    shortcut: "I",
    group: "edit",
  },
  highlight: {
    id: "highlight",
    icon: ICONS.highlight,
    label: "Highlight",
    shortcut: "H",
    group: "annotate",
  },
  underline: {
    id: "underline",
    icon: ICONS.underline,
    label: "Underline",
    shortcut: "U",
    group: "annotate",
  },
  strikethrough: {
    id: "strikethrough",
    icon: ICONS.strikethrough,
    label: "Strike",
    shortcut: "",
    group: "annotate",
  },
  comment: {
    id: "comment",
    icon: ICONS.comment,
    label: "Comment",
    shortcut: "C",
    group: "annotate",
  },
  redact: {
    id: "redact",
    icon: ICONS.redact,
    label: "Redact",
    shortcut: "R",
    group: "annotate",
  },
  signature: {
    id: "signature",
    icon: ICONS.signature,
    label: "Sign",
    shortcut: "",
    group: "sign",
  },
  stamp: {
    id: "stamp",
    icon: ICONS.stamp,
    label: "Stamp",
    shortcut: "",
    group: "sign",
  },
  pages: {
    id: "pages",
    icon: ICONS.pages,
    label: "Organize",
    shortcut: "P",
    group: "actions",
  },
  watermark: {
    id: "watermark",
    icon: ICONS.watermark,
    label: "Watermark",
    shortcut: "W",
    group: "actions",
  },
  headfoot: {
    id: "headfoot",
    icon: ICONS.headfoot,
    label: "Header/Footer",
    shortcut: "",
    group: "actions",
  },
  lock: {
    id: "lock",
    icon: ICONS.lock,
    label: "Protect",
    shortcut: "L",
    group: "actions",
  },
  undo: {
    id: "undo",
    icon: ICONS.undo,
    label: "Undo",
    shortcut: "⌘Z",
    group: "actions",
  },
  redo: {
    id: "redo",
    icon: ICONS.redo,
    label: "Redo",
    shortcut: "⌘⇧Z",
    group: "actions",
  },
  save: {
    id: "save",
    icon: ICONS.save,
    label: "Save",
    shortcut: "⌘S",
    group: "actions",
  },
};

// Streamlined tool groups
const TOOL_GROUPS = [
  { id: "general", tools: ["select"] },
  { id: "edit", tools: ["text", "draw", "shapes", "image"] },
  { id: "annotate", tools: ["highlight", "comment", "redact"] },
  { id: "sign", tools: ["signature", "stamp"] },
  {
    id: "actions",
    tools: ["pages", "watermark", "headfoot", "lock", "undo", "redo", "save"],
  },
];

export class Toolbar {
  constructor(container, pdfData = null) {
    this.container = container;
    this.initialPdfData = pdfData;
    this.state = new StateManager();
    this.engine = null;
    this.pdfViewer = null;
    this.canvasLayer = null;

    // Tool instances
    // We only keep TextTool because it needs complex DOM UI (input box)
    // All other drawing tools are handled by CanvasLayer now
    this.textTool = null;

    // State
    this.currentTool = "select";
    this.isDragging = false;
    this.position = { x: 20, y: 20 };
    this.annotationHistory = [];

    this._init();
  }

  async _init() {
    this._render();
    this._bindEvents();
    await this._initializeEngine(this.initialPdfData);
    this._initializeTools();
  }

  async _initializeEngine(pdfData) {
    try {
      this.engine = new PDFEngine();
      await this.engine.initialize(pdfData);
      console.log("pdfed: PDF engine initialized with data");

      if (this.engine.pdfJsDoc) {
        this.pdfViewer = new PDFViewer(this.engine.pdfJsDoc);
        await this.pdfViewer.initialize();
        console.log("pdfed: PDF Viewer initialized");
      } else {
        console.warn("pdfed: No PDF document loaded");
      }
    } catch (error) {
      console.error("pdfed: Failed to initialize PDF engine:", error);
    }
  }

  _initializeTools() {
    // 1. Initialize Unified Canvas Layer
    // Mount to PDFViewer container if available, else body
    const mountPoint =
      (this.pdfViewer && this.pdfViewer.container) || document.body;
    this.canvasLayer = new CanvasLayer(
      mountPoint,
      this._handleAnnotationComplete.bind(this),
      this._handleModeChange.bind(this) // Mode change callback
    );

    // 2. Initialize Text Tool (UI only)
    // It will be triggered by _handleAnnotationComplete when user clicks in 'text' mode
    this.textTool = new TextTool(this._handleTextComplete.bind(this));

    console.log("pdfed: Canvas Layer & Tools initialized");
  }

  /**
   * Handle mode changes from CanvasLayer (e.g., auto-switch to select)
   */
  _handleModeChange(newMode) {
    console.log("pdfed: Mode changed to:", newMode);
    this.currentTool = newMode;
    this.state.setActiveTool(newMode);

    // Update UI to reflect the new mode
    this.container.querySelectorAll(".pdfed-tool-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tool === newMode);
    });

    // Hide property panel when switching to select
    if (newMode === "select") {
      const panel = this.container.querySelector("#pdfed-property-panel");
      if (panel) panel.style.display = "none";
    }
  }

  // ============ Rendering (No Changes Needed) ============
  _render() {
    this.container.innerHTML = `
      <div class="pdfed-toolbar" id="pdfed-toolbar">
        <div class="pdfed-toolbar-header" id="pdfed-drag-handle">
          <span class="pdfed-logo">pdfed</span>
          <button class="pdfed-close-btn" id="pdfed-close" title="Close toolbar">×</button>
        </div>
        <div class="pdfed-toolbar-body">
          ${this._renderToolGroups()}
        </div>
        <div class="pdfed-property-panel" id="pdfed-property-panel" style="display: none;"></div>
        <input type="file" id="pdfed-image-input" accept="image/*" style="display: none;">
      </div>
    `;
    this._applyPosition();
  }

  _renderToolGroups() {
    return TOOL_GROUPS.map(
      (group) => `
      <div class="pdfed-tool-group" data-group="${group.id}">
        ${group.tools.map((toolId) => this._renderTool(TOOLS[toolId])).join("")}
      </div>
    `
    ).join('<div class="pdfed-divider"></div>');
  }

  _renderTool(tool) {
    if (!tool) return "";
    const isActive = this.currentTool === tool.id;
    const tooltip = tool.shortcut
      ? `${tool.label} (${tool.shortcut})`
      : tool.label;
    return `
      <button 
        class="pdfed-tool-btn ${isActive ? "active" : ""}" 
        data-tool="${tool.id}"
        data-tooltip="${tooltip}"
        aria-label="${tool.label}"
      >
        <span class="pdfed-tool-icon">${tool.icon}</span>
      </button>
    `;
  }

  // ============ Event Binding ============
  _bindEvents() {
    const toolbar = this.container.querySelector("#pdfed-toolbar");
    const dragHandle = this.container.querySelector("#pdfed-drag-handle");
    const closeBtn = this.container.querySelector("#pdfed-close");

    toolbar.addEventListener("click", (e) => {
      const toolBtn = e.target.closest(".pdfed-tool-btn");
      if (toolBtn) {
        this._selectTool(toolBtn.dataset.tool);
      }
    });

    toolbar.addEventListener("input", (e) => {
      if (e.target.tagName === "INPUT") {
        this._handlePropertyChange(e);
      }
    });

    // Color pickers fire 'change' event, not 'input'
    toolbar.addEventListener("change", (e) => {
      if (e.target.tagName === "INPUT" && e.target.type === "color") {
        this._handlePropertyChange(e);
      }
    });

    closeBtn.addEventListener("click", () => {
      // 1. Destroy all child components
      if (this.pdfViewer) this.pdfViewer.destroy();
      if (this.canvasLayer) this.canvasLayer.destroy();
      if (this.textTool) this.textTool.destroy();
      if (this.engine) this.engine.destroy();

      // 2. Remove the Main Toolbar Container from DOM
      // (Assuming this.container is the parent wrapper injected into the page)
      if (this.container && this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
      }

      // 3. Optional: Send message to background to update icon state
      chrome.runtime.sendMessage({ action: "TOOLBAR_CLOSED" });

      // 4. Force reload page (nuclear option if cleanup is messy)
      // window.location.reload();
    });

    this._setupDrag(dragHandle, toolbar);

    this._handleKeydown = this._handleKeydown.bind(this);
    document.addEventListener("keydown", this._handleKeydown);

    // Image Input
    const imageInput = this.container.querySelector("#pdfed-image-input");
    if (imageInput) {
      imageInput.addEventListener("change", this._handleImageUpload.bind(this));
    }
  }

  _setupDrag(handle, toolbar) {
    let startX, startY, startLeft, startTop;

    handle.addEventListener("mousedown", (e) => {
      if (e.target.closest(".pdfed-close-btn")) return;

      this.isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = this.position.x;
      startTop = this.position.y;
      toolbar.classList.add("dragging");
    });

    document.addEventListener("mousemove", (e) => {
      if (!this.isDragging) return;
      this.position.x = startLeft + (e.clientX - startX);
      this.position.y = startTop + (e.clientY - startY);
      this._applyPosition();
    });

    document.addEventListener("mouseup", () => {
      if (this.isDragging) {
        this.isDragging = false;
        toolbar.classList.remove("dragging");
      }
    });
  }

  _applyPosition() {
    const toolbar = this.container.querySelector("#pdfed-toolbar");
    if (toolbar) {
      toolbar.style.left = `${this.position.x}px`;
      toolbar.style.top = `${this.position.y}px`;
    }
  }

  _handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      if (this.canvasLayer) {
        this.canvasLayer.addImage(dataUrl);
        // Switch to 'select' so user can move/resize immediately
        this._selectTool("select");
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  // ============ Tool Selection ============
  _selectTool(toolId) {
    console.log("pdfed: Tool selected -", toolId);
    // Actions
    switch (toolId) {
      case "undo":
        this._handleUndo();
        return;
      case "redo":
        this._handleRedo();
        return;
      case "save":
        this._handleSave();
        return;
      case "image":
        const input = this.container.querySelector("#pdfed-image-input");
        if (input) input.click();
        return;
    }

    // Deactivate previous
    this._deactivateCurrentTool();

    // Set State
    this.currentTool = toolId;
    this.state.setActiveTool(toolId);

    // Update UI
    this.container.querySelectorAll(".pdfed-tool-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tool === toolId);
    });

    this._showPropertyPanel(toolId);
    this._activateTool(toolId);
  }

  _deactivateCurrentTool() {
    if (this.textTool) this.textTool.deactivate();
    // CanvasLayer handles the rest (cursor reset, pointer events) automatically
    // when we switch modes via setMode()
  }

  _activateTool(toolId) {
    console.log(`pdfed: Tool activated - ${toolId}`);

    // Set mode on CanvasLayer for drawing/interaction tools
    if (this.canvasLayer) {
      this.canvasLayer.setMode(toolId);
    }

    // Additional specific handling
    switch (toolId) {
      case "signature":
        this._showSignatureModal();
        break;
      case "stamp":
        this._addStamp();
        break;
      case "pages":
        this._showPagesPanel();
        break;
      case "watermark":
        this._showWatermarkModal();
        break;
      case "headfoot":
        this._showHeaderFooterModal();
        break;
      case "lock":
        this._showSecurityModal();
        break;
      case "redact":
        this._showRedactModal();
        break;
    }
  }

  // ============ Property Panel ============
  _showPropertyPanel(toolId) {
    const panel = this.container.querySelector("#pdfed-property-panel");
    const tool = TOOLS[toolId];

    if (!tool || tool.group === "actions" || tool.group === "general") {
      panel.style.display = "none";
      return;
    }

    panel.style.display = "block";
    panel.innerHTML = this._getPropertyPanelContent(toolId);
  }

  _getPropertyPanelContent(toolId) {
    switch (toolId) {
      case "text":
        return `
          <div class="pdfed-props">
            <label>Font Size</label>
            <input type="range" min="8" max="72" value="16" id="pdfed-font-size" data-option="fontSize">
            <span id="pdfed-font-size-value">16px</span>
          </div>
          <div class="pdfed-props">
            <label>Color</label>
            <input type="color" value="#000000" id="pdfed-text-color" data-option="color">
          </div>
        `;
      case "highlight":
      case "underline":
      case "strikethrough":
        return `
          <div class="pdfed-props">
            <label>Color</label>
            <input type="color" value="${
              toolId === "highlight" ? "#ffff00" : "#000000"
            }" id="pdfed-highlight-color" data-option="highlightColor">
          </div>
          <div class="pdfed-props">
            <label>Opacity</label>
            <input type="range" min="10" max="100" value="40" id="pdfed-highlight-opacity" data-option="opacity">
          </div>
        `;
      case "draw":
        return `
          <div class="pdfed-props">
            <label>Stroke Width</label>
            <input type="range" min="1" max="20" value="2" id="pdfed-stroke-width" data-option="strokeWidth">
          </div>
          <div class="pdfed-props">
            <label>Color</label>
            <input type="color" value="#000000" id="pdfed-stroke-color" data-option="drawColor">
          </div>
        `;
      case "shapes":
        return `
          <div class="pdfed-props">
            <label>Stroke Width</label>
            <input type="range" min="1" max="10" value="2" id="pdfed-shape-stroke" data-option="strokeWidth">
          </div>
          <div class="pdfed-props">
            <label>Color</label>
            <input type="color" value="#000000" id="pdfed-shape-color" data-option="shapeColor">
          </div>
        `;
      default:
        return "";
    }
  }

  _handlePropertyChange(e) {
    const input = e.target;
    const option = input.dataset?.option;

    if (!option) return;

    // Force float parsing
    let value = input.value;
    if (input.type === "range") {
      value = parseFloat(input.value);
    }

    // Debug log
    console.log(`pdfed: Property changed ${option} = ${value}`);

    // Handle Opacity Special Case (Slider is 1-100, we need 0.0-1.0)
    let finalValue = value;
    if (option === "opacity") {
      finalValue = value / 100;
    }

    // Update the visual label next to slider (e.g. "16px")
    const display = input.nextElementSibling; // <span id="...">
    if (display) {
      // Check if it's the font size label or generic
      if (option === "fontSize") {
        display.textContent = `${value}px`;
      } else if (option === "opacity") {
        display.textContent = `${value}%`;
      } else {
        display.textContent = value;
      }
    }

    const options = { [option]: finalValue };

    // 1. Update Text Tool if active (font size, color)
    if (this.currentTool === "text" && this.textTool) {
      this.textTool.setOptions(options);
    }

    // 2. Update Canvas Layer (stroke width, color, opacity)
    if (this.canvasLayer) {
      this.canvasLayer.setOptions(options);
    }
  }

  // ============ Tool Completion Handlers ============

  /**
   * Main callback from CanvasLayer
   * Handles Draw, Highlight, Shapes, and triggers Text input
   */
  _handleAnnotationComplete(annotation) {
    console.log("pdfed: Annotation received:", annotation);

    // Special Case: Text Start Event (Updated for page-relative)
    if (annotation.type === "text-start") {
      // annotation.x/y are now PAGE-RELATIVE, but startInput still expects screen coords
      // Convert back temporarily for UI positioning
      const screenPoint = this.canvasLayer._getScreenFromPage(annotation);
      this.textTool.startInput(screenPoint.x, screenPoint.y, {
        pageNum: annotation.pageNum,
      });
      return;
    }

    // Special Case: Text Edit Event (Updated for page-relative)
    if (annotation.type === "text-edit") {
      const ann = annotation.annotation;
      const screenPoint = this.canvasLayer._getScreenFromPage(ann);
      // Reactivate TextTool with existing content at correct screen position
      this.textTool.startInput(screenPoint.x, screenPoint.y, {
        text: ann.data.text,
        pageNum: ann.pageNum,
        ...ann.data,
      });
      return;
    }

    // Special Case: Comment Edit Event
    if (annotation.type === "comment-edit") {
      this._showCommentPopup(annotation.annotation);
      return;
    }

    // *** RENDER ON SAVE STRATEGY ***
    // We no longer add to engine incrementally.
    // All annotations are applied fresh during _handleSave()
    /*
    if (this.engine && annotation.pageNum) {
        ... (removed legacy code)
    }
    */

    // Store in history with page info
    this.annotationHistory.push({
      ...annotation,
      timestamp: Date.now(),
    });
  }

  _handleTextComplete(text, x, y, options, size, pageNum) {
    console.log("pdfed: Text added:", text, "screen coords:", x, y);

    // Convert screen coordinates to page-relative coordinates
    let pageX = x;
    let pageY = y;

    if (this.canvasLayer) {
      // Use CanvasLayer's coordinate conversion
      const pageCoords = this.canvasLayer._getPageCoordinates(x, y);
      if (pageCoords) {
        pageX = pageCoords.x;
        pageY = pageCoords.y;
        // Use detected page if not provided
        if (!pageNum) pageNum = pageCoords.pageNum;
      }

      console.log(
        "pdfed: Converted to page coords:",
        pageX,
        pageY,
        "on page",
        pageNum
      );

      this.canvasLayer.annotations.push({
        id: `text_${Date.now()}`,
        type: "text",
        pageNum: pageNum || this.canvasLayer.activePage || 1,
        bounds: {
          x: pageX,
          y: pageY,
          width: size?.width || 100,
          height: size?.height || 20,
        },
        data: {
          text: text,
          ...options,
        },
      });
      this.canvasLayer._redraw();
    }

    this.annotationHistory.push({
      type: "text",
      data: { text, x: pageX, y: pageY, options },
    });
  }

  // ============ Actions ============
  _handleUndo() {
    // 1. Undo from History
    const undone = this.annotationHistory.pop();

    // 2. Undo from Canvas (Visual)
    if (this.canvasLayer) {
      this.canvasLayer.undo();
    }

    // 3. Undo from Engine (File) - Complex, usually requires reload
    console.log("pdfed: Undo", undone);
    this.state.undo();
  }

  _handleRedo() {
    this.state.redo();
    console.log("pdfed: Redo");
  }

  async _handleSave() {
    if (!this.engine) return;
    try {
      console.log("pdfed: Starting Render-on-Save process...");

      // 1. Reset Engine to clean slate (Original PDF)
      await this.engine.reset();

      // 2. Re-apply ALL visual annotations from CanvasLayer
      // This ensures moves, deletes, and undos are correctly reflected
      if (this.canvasLayer) {
        const annotations = this.canvasLayer.getAnnotations();
        console.log(`pdfed: Re-applying ${annotations.length} annotations...`);

        for (const ann of annotations) {
          await this._applyAnnotationToEngine(ann);
        }

        // Apply simulation (Watermarks / Headers)
        if (this.canvasLayer.simulatedWatermark) {
          await this.engine.applyWatermark(this.canvasLayer.simulatedWatermark);
        }
        if (this.canvasLayer.simulatedHeaderFooter) {
          await this.engine.applyHeaderFooter(
            this.canvasLayer.simulatedHeaderFooter
          );
        }
      }

      // 3. Save with Form Values
      let formValues = null;
      if (this.pdfViewer && this.pdfViewer.getFormValues) {
        formValues = this.pdfViewer.getFormValues();
      }

      const pdfBytes = await this.engine.save(formValues);
      this._downloadPDF(pdfBytes);
      console.log("pdfed: PDF saved successfully");
    } catch (error) {
      console.error("pdfed: Save failed:", error);
      alert("Failed to save PDF. Please try again.");
    }
  }

  async _applyAnnotationToEngine(annotation) {
    if (!this.engine || !annotation.pageNum) return;

    // SCALING CRITICAL FIX:
    // Canvas coordinates are in Screen Pixels (scaled by this.pdfViewer.scale, e.g. 1.5)
    // PDFEngine expects PDF Points (unscaled, 72dpi).
    // We MUST divide by scale to normalize.
    const scale = this.pdfViewer ? this.pdfViewer.scale : 1;

    const { bounds, data, type, pageNum } = annotation;
    // Safety defaults
    const color = this._hexToRgb(data.color || "#000000");

    // Normalize Bounds
    const normX = bounds.x / scale;
    const normY = bounds.y / scale;
    const normW = bounds.width / scale;
    const normH = bounds.height / scale;

    try {
      switch (type) {
        case "text":
          await this.engine.addText(
            pageNum,
            data.text || "",
            normX,
            normY,
            {
              size: (data.fontSize || 16) / scale, // Normalize font size too
              color,
            }
          );
          break;

        case "highlight":
          await this.engine.addRectangle(
            pageNum,
            normX,
            normY,
            normW,
            normH,
            {
              color,
              opacity: data.opacity || 0.3,
            }
          );
          break;

        case "underline":
        case "strikethrough":
          await this.engine.addLine(
            pageNum,
            normX,
            normY + normH / 2, // Midpoint relative to normalized box
            normX + normW,
            normY + normH / 2,
            { color, thickness: 2 / scale }
          );
          break;

        case "shapes": // Rectangles
          await this.engine.addRectangle(
            pageNum,
            normX,
            normY,
            normW,
            normH,
            {
              color: { r: 0, g: 0, b: 0 }, // Transparent fill?
              borderColor: color,
              borderWidth: (data.strokeWidth || 2) / scale,
              opacity: 0, // No fill for shapes usually
            }
          );
          break;

        case "redact":
          await this.engine.addRectangle(
            pageNum,
            normX,
            normY,
            normW,
            normH,
            {
              color: { r: 0, g: 0, b: 0 }, // Black
              opacity: 1,
            }
          );
          break;

        case "draw":
          if (data.points && data.points.length > 1) {
            for (let i = 0; i < data.points.length - 1; i++) {
              await this.engine.addLine(
                pageNum,
                data.points[i].x / scale,
                data.points[i].y / scale,
                data.points[i + 1].x / scale,
                data.points[i + 1].y / scale,
                { color, thickness: (data.strokeWidth || 2) / scale }
              );
            }
          }
          break;

        case "image":
        case "signature":
        case "stamp":
          if (data.dataUrl) {
            // Convert Data URL to Uint8Array
            // Simple check for base64 type
            const parts = data.dataUrl.split(",");
            if (parts.length === 2) {
              const bin = atob(parts[1]);
              const len = bin.length;
              const bytes = new Uint8Array(len);
              for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);

              await this.engine.addImage(
                pageNum,
                bytes,
                normX,
                normY,
                normW,
                normH
              );
            }
          }
          break;
      }
    } catch (err) {
      console.error(
        "pdfed: Error applying annotation to engine:",
        err,
        annotation
      );
    }
  }

  _hexToRgb(hex) {
    if (!hex) return { r: 0, g: 0, b: 0 };
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return { r, g, b };
  }

  _downloadPDF(pdfBytes) {
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pdfed-edited.pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  _showSignatureModal() {
    const modal = new SignatureModal((dataUrl) => {
      if (this.canvasLayer) {
        // Calculate center based on CURRENT VIEWPORT
        // FIX: Use window scroll to place it in center of screen, not top of doc
        const x = window.scrollX + window.innerWidth / 2 - 100;
        const y = window.scrollY + window.innerHeight / 2 - 50;

        // 1. Add to Visual Canvas immediately
        this.canvasLayer.addImage(dataUrl, { x, y });

        // 2. Select it so user can move it
        this._selectTool("select");
      }
    });
    modal.open();
  }

  _addStamp() {
    const modal = new StampModal((dataUrl) => {
      if (this.canvasLayer) {
        // FIX: Center on screen
        const x = window.scrollX + window.innerWidth / 2 - 150;
        const y = window.scrollY + window.innerHeight / 2 - 60;

        console.log("pdfed: Adding stamp at", x, y);
        this.canvasLayer.addImage(dataUrl, { x, y });
        this._selectTool("select");
      }
    });
    modal.open();
  }

  _showPagesPanel() {
    this._togglePagesDrawer();
  }

  _showWatermarkModal() {
    const modal = new WatermarkModal(async (config) => {
      try {
        console.log("pdfed: Applying watermark...", config);

        // 1. Update Engine (Backend)
        const newBytes = await this.engine.applyWatermark(config);
        this.engine.originalBytes = newBytes; // Update source

        // 2. Update Visuals (Frontend)
        if (this.canvasLayer) {
          this.canvasLayer.setSimulatedWatermark(config);
        }

        console.log("pdfed: Watermark applied (SIMULATED)");
      } catch (error) {
        console.error("pdfed: Failed to apply watermark:", error);
      }
    });
    modal.open();
  }

  _showHeaderFooterModal() {
    const modal = new HeaderFooterModal(
      async (config) => {
        try {
          console.log("pdfed: Applying headers/footers...", config);
          const newBytes = await this.engine.applyHeaderFooter(config);

          // OPTIMIZATION: Don't reload PDF viewer (avoids lag/reload flash)
          // Instead, update the internal state and simulate the watermark on the canvas layer
          this.engine.originalBytes = newBytes; // Update source of truth for Save

          if (this.canvasLayer) {
            this.canvasLayer.setSimulatedHeaderFooter(config);
          }

          console.log("pdfed: Headers/footers applied (SIMULATED)");
        } catch (error) {
          console.error("pdfed: Failed to apply headers/footers", error);
          alert("Failed to apply headers/footers. Please try again.");
        }
      },
      () => {
        // Remove callback
        if (this.canvasLayer) this.canvasLayer.setSimulatedHeaderFooter(null);
      }
    );
    modal.open();
  }

  _showSecurityModal() {
    const modal = new SecurityModal(async (config) => {
      try {
        console.log("pdfed: Encrypting document...");
        const newBytes = await this.engine.encryptDocument(config);

        // Download the encrypted file instead of reloading (encrypted file can't be edited without password)
        const blob = new Blob([newBytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "protected-document.pdf";
        a.click();
        URL.revokeObjectURL(url);

        console.log("pdfed: Document protected and downloaded");
        alert(
          "✓ Protected PDF has been downloaded. Open it to verify the password protection."
        );
      } catch (error) {
        console.error("pdfed: Failed to encrypt document", error);
        alert("Failed to protect document. Please try again.");
      }
    });
    modal.open();
  }

  _showRedactModal() {
    const modal = new RedactModal((options) => {
      console.log("pdfed: Redact options selected:", options);
      // Store redact options for use when drawing
      this.redactOptions = options;

      // Update canvas layer options
      if (this.canvasLayer) {
        this.canvasLayer.options.redactFillColor = options.fillColor;
        this.canvasLayer.options.redactPattern = options.pattern;
      }
    });
    modal.open();
  }

  _togglePagesDrawer() {
    let host = this.container.querySelector("#pdfed-drawer-host");

    if (host) {
      host.style.display = host.style.display === "none" ? "block" : "none";
      return;
    }

    // Create Host & Shadow
    host = document.createElement("div");
    host.id = "pdfed-drawer-host";
    // Position Host relative to toolbar
    host.style.cssText =
      "position: absolute; top: 100%; left: 0; right: 0; z-index: -1;";

    const shadow = host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
          :host {
              display: block;
              animation: slideDown 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
          }
          .drawer {
              background: rgba(20, 20, 30, 0.85);
              backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
              border-radius: 0 0 16px 16px;
              padding: 12px 24px;
              display: flex; justify-content: space-evenly; align-items: center;
              box-shadow: 0 20px 40px rgba(0,0,0,0.4);
              border-top: 1px solid rgba(255,255,255,0.08);
              margin-top: -5px; padding-top: 20px;
          }
          @keyframes slideDown { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
          
          button {
              appearance: none; -webkit-appearance: none;
              background: transparent; border: none; box-shadow: none;
              color: #94a3b8;
              display: flex; flex-direction: column; align-items: center; gap: 6px;
              cursor: pointer; 
              font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif;
              font-size: 11px; font-weight: 500; letter-spacing: 0.3px;
              padding: 8px 12px;
              border-radius: 8px;
              transition: all 0.2s ease;
              min-width: 60px;
          }
          button:hover { 
              background: rgba(255, 255, 255, 0.08);
              color: #ffffff; 
              transform: translateY(-2px);
          }
          svg { 
              width: 22px; height: 22px; 
              stroke: currentColor; fill: none; stroke-width: 1.5; 
              filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
          }
      `;
    shadow.appendChild(style);

    const drawer = document.createElement("div");
    drawer.className = "drawer";
    shadow.appendChild(drawer);

    this.container.querySelector(".pdfed-toolbar").appendChild(host);
    this._renderDrawerContent(drawer);
  }

  _renderDrawerContent(drawer) {
    // Icons
    const icons = {
      grid: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
      rotate:
        '<svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>',
      delete:
        '<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
      insert:
        '<svg viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M12 10v8"/><path d="M8 14h8"/></svg>',
      extract:
        '<svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    };

    const ops = new PageOperations(
      this.engine,
      this._handlePageUpdate.bind(this),
      () => (this.pdfViewer ? this.pdfViewer.currentPage : 1)
    );

    const btns = [
      {
        label: "Grid View",
        icon: icons.grid,
        action: () => {
          if (!this.pageOrganizer)
            this.pageOrganizer = new PageOrganizer(
              this.engine,
              this._handlePageUpdate.bind(this)
            );
          this.pageOrganizer.open();
          this._togglePagesDrawer(); // Close drawer
        },
      },
      {
        label: "Rotate",
        icon: icons.rotate,
        action: () => ops.rotateCurrentPage("right"),
      },
      {
        label: "Delete",
        icon: icons.delete,
        action: () => ops.deleteCurrentPage(),
      },
      { label: "Insert", icon: icons.insert, action: () => ops.insertPDF() },
      {
        label: "Extract",
        icon: icons.extract,
        action: () => ops.extractCurrentPage(),
      },
    ];

    drawer.innerHTML = btns
      .map(
        (b, i) => `
          <button class="pdfed-drawer-btn" id="pdfed-drawer-btn-${i}">
              ${b.icon}
              <span>${b.label}</span>
          </button>
      `
      )
      .join("");

    btns.forEach((b, i) => {
      drawer.querySelector(`#pdfed-drawer-btn-${i}`).onclick = b.action;
    });
  }

  async _handlePageUpdate(newBytes) {
    console.log("pdfed: Reloading document structure...");

    // 1. Reload Engine with new bytes
    await this.engine.loadDocument(newBytes);

    // 2. Clear historic annotation tracking
    this.engine.annotations = [];

    // 3. Re-create View
    // On file:// URLs with disabled worker, pdfJsDoc will be null.
    // We accept this for performance (snappy drawing).
    // To show updates, we simply reload the Native Chrome Viewer with the new Blob.
    if (!this.engine.pdfJsDoc) {
      console.log("pdfed: PDF.js unavailable, updating Native Viewer...");
      const blob = new Blob([newBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      // Find the native embed/object
      const embed =
        document.querySelector('embed[type="application/pdf"]') ||
        document.querySelector('object[type="application/pdf"]');

      if (embed) {
        // Reload the embed with the new content
        // We clone/replace to force a clean reload without history issues
        const newEmbed = embed.cloneNode(true);
        newEmbed.src = url;
        // If it's an object tag, it uses data
        if (newEmbed.tagName === "OBJECT") newEmbed.data = url;

        embed.parentNode.replaceChild(newEmbed, embed);
        console.log("pdfed: Native Viewer updated");
      } else {
        // Fallback if no embed found (unlikely in Chrome PDF Viewer)
        // Download it so user can at least see it
        const a = document.createElement("a");
        a.href = url;
        a.download = "pdfed-modified.pdf";
        a.click();
      }
      return;
    }

    // If PDF.js IS available (e.g. web URLs), use standard re-render
    if (this.pdfViewer) {
      this.pdfViewer.destroy();
    }

    this.pdfViewer = new PDFViewer(this.engine.pdfJsDoc);
    await this.pdfViewer.initialize();

    // 5. Re-bind Tools
    if (this.canvasLayer) {
      this.canvasLayer.destroy();
      this.canvasLayer = null;
    }
    this._initializeTools();
  }

  // ============ Keyboard Shortcuts ============
  _handleKeydown(e) {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    const isCmd = e.ctrlKey || e.metaKey;

    if (isCmd && e.key === "z" && !e.shiftKey) {
      e.preventDefault();
      this._handleUndo();
    } else if (isCmd && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
      e.preventDefault();
      this._handleRedo();
    } else if (isCmd && e.key === "s") {
      e.preventDefault();
      this._handleSave();
    } else if (e.key === "Escape") {
      this._selectTool("select");
    }

    if (!isCmd) {
      // Lock tool switching: only allow hotkeys when in 'select' mode
      // User must explicitly click tool button or press Escape to switch
      if (this.currentTool !== 'select') return;

      switch (e.key.toLowerCase()) {
        case "v":
          this._selectTool("select");
          break;
        case "t":
          this._selectTool("text");
          break;
        case "h":
          this._selectTool("highlight");
          break;
        case "d":
          this._selectTool("draw");
          break;
      }
    }
  }

  _hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return { r, g, b };
  }

  _showCommentPopup(annotation) {
    if (document.getElementById("pdfed-comment-popup")) {
      document.getElementById("pdfed-comment-popup").remove();
    }

    // Inject Premium Apple-Style CSS
    if (!document.getElementById("pdfed-comment-styles")) {
      const style = document.createElement("style");
      style.id = "pdfed-comment-styles";
      style.textContent = `
            .pdfed-comment-popup {
                position: fixed;
                z-index: 2147483660;
                width: 280px;
                background: rgba(255, 255, 255, 0.92);
                backdrop-filter: blur(24px);
                -webkit-backdrop-filter: blur(24px);
                border-radius: 12px;
                box-shadow: 0 12px 40px rgba(0,0,0,0.2), 0 0 0 0.5px rgba(0,0,0,0.1);
                display: flex;
                flex-direction: column;
                overflow: hidden;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
                transform-origin: top left;
                animation: pdfed-spring 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                border: 1px solid rgba(255,255,255,0.2);
            }

            @keyframes pdfed-spring {
                from { opacity: 0; transform: scale(0.9) translateY(10px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
            }

            .pdfed-comment-header {
                padding: 12px 16px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid rgba(0,0,0,0.06);
                background: rgba(255,255,255,0.5);
            }

            .pdfed-comment-title {
                font-weight: 600;
                font-size: 13px;
                color: #1d1d1f;
                letter-spacing: -0.01em;
            }

            .pdfed-btn-close {
                width: 22px;
                height: 22px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                border: none;
                background: rgba(0,0,0,0.06);
                color: #424245;
                font-size: 14px;
                cursor: pointer;
                transition: all 0.2s;
            }
            .pdfed-btn-close:hover { background: rgba(0,0,0,0.12); color: #000; }

            .pdfed-comment-textarea {
                width: 100%;
                min-height: 110px;
                padding: 16px;
                background: transparent;
                border: none;
                outline: none;
                font-size: 14px;
                line-height: 1.5;
                color: #1d1d1f;
                font-family: inherit;
                resize: none;
            }
            .pdfed-comment-textarea::placeholder { color: #86868b; }

            .pdfed-comment-footer {
                padding: 8px 16px 12px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: rgba(255,255,255,0.3);
            }

            .pdfed-btn-action {
                background: transparent;
                border: none;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                padding: 6px 12px;
                border-radius: 6px;
                transition: all 0.2s;
            }

            .pdfed-btn-delete {
                color: #ff3b30;
                padding-left: 0;
            }
            .pdfed-btn-delete:hover { opacity: 0.8; }

            .pdfed-btn-save {
                background: #007aff;
                color: white;
                font-weight: 600;
                padding: 6px 16px;
                border-radius: 16px;
                box-shadow: 0 2px 8px rgba(0, 122, 255, 0.25);
            }
            .pdfed-btn-save:hover { background: #006ae6; transform: translateY(-1px); }
            .pdfed-btn-save:active { transform: translateY(0); }
          `;
      document.head.appendChild(style);
    }

    const popup = document.createElement("div");
    popup.id = "pdfed-comment-popup";
    popup.className = "pdfed-comment-popup";

    // Smart Positioning (keep on screen)
    const x = annotation.bounds.x + 40;
    const y = annotation.bounds.y;
    popup.style.left = `${x}px`;
    popup.style.top = `${y}px`;

    popup.innerHTML = `
        <div class="pdfed-comment-header">
            <span class="pdfed-comment-title">Note</span>
            <button class="pdfed-btn-close" title="Close">×</button>
        </div>
        <textarea class="pdfed-comment-textarea" placeholder="Add a comment...">${
          annotation.data.text || ""
        }</textarea>
        <div class="pdfed-comment-footer">
            <button class="pdfed-btn-action pdfed-btn-delete">Delete</button>
            <button class="pdfed-btn-action pdfed-btn-save">Done</button>
        </div>
      `;

    document.body.appendChild(popup);

    // Boundary check
    const rect = popup.getBoundingClientRect();
    if (rect.right > window.innerWidth)
      popup.style.left = `${window.innerWidth - rect.width - 20}px`;
    if (rect.bottom > window.innerHeight)
      popup.style.top = `${window.innerHeight - rect.height - 20}px`;

    const textarea = popup.querySelector("textarea");
    textarea.focus();

    // Handlers
    popup.querySelector(".pdfed-btn-save").onclick = () => {
      const text = textarea.value.trim();
      if (text) {
        annotation.data.text = text;
        if (this.canvasLayer) this.canvasLayer._redraw();
      } else {
        // Empty text -> Delete on save? Or just save empty?
        // Let's allow saving empty or deleting.
        // Acrobat keeps empty notes.
        annotation.data.text = "";
      }
      popup.remove();
      this._selectTool("select");
    };

    popup.querySelector(".pdfed-btn-close").onclick = () => popup.remove();

    popup.querySelector(".pdfed-btn-delete").onclick = () => {
      if (confirm("Delete this note?")) {
        if (this.canvasLayer) this.canvasLayer.removeAnnotation(annotation.id);
        popup.remove();
      }
    };
  }

  destroy() {
    document.removeEventListener("keydown", this._handleKeydown);
    this.textTool?.destroy();
    this.canvasLayer?.destroy();
    this.engine?.destroy();
    this.textTool = null;
    this.canvasLayer = null;
    this.engine = null;
  }
}
