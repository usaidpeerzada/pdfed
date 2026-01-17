/** @typedef {'select'|'text'|'highlight'|'underline'|'strikethrough'|'draw'|'shapes'|'image'|'redact'} ToolMode */
/** @typedef {{x: number, y: number}} Point */
/** @typedef {{id: string, type: string, bounds: DOMRect, data: any}} Annotation */

export class CanvasLayer {
  constructor(container, onAnnotationComplete, onModeChange = null) {
    this.canvas = null;
    this.ctx = null;
    this.container = container;
    this.onAnnotationComplete = onAnnotationComplete;
    this.onModeChange = onModeChange; // Callback to notify parent of mode changes

    // State
    this.mode = "select";
    this.isDrawing = false;
    this.startPoint = null;
    this.currentPoint = null;
    this.pathPoints = [];
    this.annotations = [];
    this.imageCache = new Map();

    // Multi-Page Support
    this.canvases = new Map(); // pageNum -> { canvas, ctx }
    this.activePage = 1;
    this.isMultiPage = false;

    // Tool options
    this.options = {
      color: "#000000",
      highlightColor: "#ffff00",
      strokeWidth: 2,
      fontSize: 16,
      opacity: 0.5,
    };

    // Bound event handlers
    this._onMouseDown = this._handleMouseDown.bind(this);
    this._onMouseMove = this._handleMouseMove.bind(this);
    this._onMouseUp = this._handleMouseUp.bind(this);
    this._onTouchStart = this._handleTouchStart.bind(this);
    this._onTouchMove = this._handleTouchMove.bind(this);
    this._onTouchEnd = this._handleTouchEnd.bind(this);
    this._onDoubleClick = this._handleDoubleClick.bind(this);

    this._init();
  }

  _init() {
    // 1. Try to create canvases immediately (handles Native Viewer or pre-loaded Custom Viewer)
    this._createCanvases();

    // 2. Start the Hunter to catch async page matching (Custom Viewer late load)
    let attempts = 0;
    const hunter = setInterval(() => {
      // If we successfully engaged Multi-Page mode, stop hunting
      if (this.isMultiPage && this.canvases.size > 0) {
        clearInterval(hunter);
        return;
      }

      // Try again
      this._createCanvases();

      attempts++;
      if (attempts > 20) clearInterval(hunter);
    }, 250);

    this._bindEvents();
  }

  // Method removed: _findPagesAndAttach (superseded by robust _createCanvases)

  _createCanvases() {
    this.canvases.clear();
    this.isMultiPage = true;

    // 1. Check for pages
    let potentialPages = document.querySelectorAll(
      ".page, .pdfed-page, .canvasWrapper"
    );

    // 2. GLOBAL FALLBACK (Native Viewer or Pre-Load)
    if (potentialPages.length === 0) {
      // If we already have a functional Global Canvas, do nothing (keep hunting for pages)
      if (this.canvas && document.body.contains(this.canvas)) {
        // Maintenance: Ensure map is synced
        if (!this.canvases.has(1)) {
          this.canvases.set(1, { canvas: this.canvas, ctx: this.ctx });
        }
        return;
      }

      console.warn("pdfed: No pages found. Initializing Global Overlay.");

      // Find embed if possible
      const nativeEmbed = document.querySelector(
        'embed[type="application/pdf"]'
      );
      if (nativeEmbed) {
        this.container = nativeEmbed.parentElement || document.body;
      }

      this.isMultiPage = false;
      this._createGlobalCanvas();
      return;
    }

    // 3. MULTI-PAGE FOUND (Switching Mode)
    // If we previously fell back to global canvas, remove it now!
    if (this.canvas && this.canvas.parentNode) {
      console.log(
        "pdfed: Removing temporary Global Canvas (Switching to Multi-Page)"
      );
      this.canvas.parentNode.removeChild(this.canvas);
      this.canvas = null;
      this.ctx = null;
    }

    this.canvases.clear();
    this.isMultiPage = true;

    potentialPages.forEach((pageContainer, index) => {
      if (pageContainer.clientHeight < 50) return;

      // robust page number parsing
      const pageNum = parseInt(
        pageContainer.getAttribute("data-page-number") ||
          pageContainer.dataset.page ||
          index + 1
      );

      this._createPageCanvas(pageContainer, pageNum);
    });

    this.activePage = 1;
    this._redraw(); // Ensure initial state is rendered
  }

  _createPageCanvas(pageContainer, pageNum) {
    const style = window.getComputedStyle(pageContainer);
    if (style.position === "static") {
      pageContainer.style.position = "relative";
    }

    let canvas = pageContainer.querySelector(
      `.pdfed-annotation-layer[data-page="${pageNum}"]`
    );
    let ctx;

    // 2. Reuse or Create
    if (canvas) {
      // Existing canvas found! Re-bind context.
      ctx = canvas.getContext("2d");
    } else {
      // Create the per-page canvas
      canvas = document.createElement("canvas");
      canvas.className = "pdfed-annotation-layer";
      canvas.dataset.page = pageNum;

      // Position: Absolute fills the PARENT
      canvas.style.cssText = `
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: auto; /* Allow drawing */
          z-index: 50; /* Above text, below UI */
          touch-action: none;
          background: transparent;
        `;

      // High-DPI Scaling (Retina Fix)
      const dpr = window.devicePixelRatio || 1;
      const width = pageContainer.clientWidth;
      const height = pageContainer.clientHeight;

      canvas.width = width * dpr;
      canvas.height = height * dpr;

      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);

      pageContainer.appendChild(canvas);
    }
    this.canvases.set(pageNum, { canvas, ctx });
  }

  _createGlobalCanvas() {
    // 1. Find the Native Embed
    const embed =
      document.querySelector("embed") || document.querySelector("object");

    this.canvas = document.createElement("canvas");
    this.canvas.id = "pdfed-canvas-layer";

    if (embed) {
      console.log("pdfed: Native Viewer Detected - pinning to Embed Shadow");
      this.canvas.style.cssText = `
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%; 
          pointer-events: none;
          z-index: 2147483640;
        `;

      if (document.body.style.position === "")
        document.body.style.position = "relative";
      document.body.appendChild(this.canvas);
    } else {
      // Standard Fallback
      this.canvas.style.cssText = `
          position: absolute;
          top: 0; left: 0;
          width: 100%; height: 100%;
          pointer-events: none;
          z-index: 2147483640;
        `;
      this.container.appendChild(this.canvas);
    }

    this.ctx = this.canvas.getContext("2d");
    this._resizeCanvas();
    this.canvases.set(1, { canvas: this.canvas, ctx: this.ctx });
    this.activePage = 1;
    this.currentPageNum = 1;
    console.log(
      "pdfed: Global canvas initialized. activePage =",
      this.activePage
    );
  }

  _resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;

    // Get the LARGEST possible height to ensure we cover the whole scroll area
    const h = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.offsetHeight,
      document.body.clientHeight,
      document.documentElement.clientHeight
    );

    const w = document.documentElement.scrollWidth;

    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;

    this.ctx.scale(dpr, dpr);
    this._redraw();
  }

  _resizeCanvas() {
    if (!this.canvas) return;

    const dpr = window.devicePixelRatio || 1;
    let width, height;

    // CHANGE: Calculate full scrollable dimensions
    if (this.container === document.body) {
      // Use documentElement to capture the full page height including scroll
      width = document.documentElement.scrollWidth;
      height = document.documentElement.scrollHeight;
    } else {
      width = this.container.scrollWidth;
      height = this.container.scrollHeight;
    }

    // Avoid zero-size canvas issues
    if (width === 0) width = window.innerWidth;
    if (height === 0) height = window.innerHeight;

    // Update internal canvas resolution
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;

    // Update CSS display size
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    // Normalize coordinate system
    this.ctx.scale(dpr, dpr);
    this._redraw();
  }

  _observeResize() {
    let resizeTimeout;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => this._resizeCanvas(), 100);
    });
  }

  _bindEvents() {
    document.addEventListener("mousedown", this._onMouseDown);
    document.addEventListener("mousemove", this._onMouseMove);
    document.addEventListener("mouseup", this._onMouseUp);
    document.addEventListener("dblclick", this._onDoubleClick);
    document.addEventListener("touchstart", this._onTouchStart, {
      passive: false,
    });
    document.addEventListener("touchmove", this._onTouchMove, {
      passive: false,
    });
    document.addEventListener("touchend", this._onTouchEnd);
  }

  // ============ Event Handlers ============
  /**
   * Convert screen coordinates to PAGE-RELATIVE coordinates
   * This fixes the scrolling issue completely
   */
  _getPageRelativePoint(e) {
    // 1. Find the canvas element under the mouse
    const element = document.elementFromPoint(e.clientX, e.clientY);
    const canvas = element?.closest(".pdfed-annotation-layer");

    // If not over a canvas, use the active one
    const targetCanvas = canvas || this.canvases.get(this.activePage)?.canvas;

    if (!targetCanvas) return null;

    // 2. Get the specific rect for THIS page's canvas
    const rect = targetCanvas.getBoundingClientRect();
    const pageNum = parseInt(targetCanvas.dataset.page);

    // 3. Update active page automatically
    if (pageNum && this.activePage !== pageNum) {
      this.activePage = pageNum;
    }

    // 4. Return coordinates relative to THIS PAGE (0,0 is top-left of page)
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pageNum: pageNum || this.activePage,
    };
  }

  /**
   * Updated hit testing for page-relative coordinates
   */
  _getAnnotationAt(x, y) {
    // Loop backwards (top-most first)
    for (let i = this.annotations.length - 1; i >= 0; i--) {
      const ann = this.annotations[i];

      // Only check annotations on current active page
      if (ann.pageNum !== this.activePage && ann.pageNum !== undefined)
        continue;

      const b = ann.bounds;
      if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) {
        return ann;
      }
    }
    return null;
  }

  _handleMouseDown(e) {
    console.log("pdfed: === MOUSEDOWN ===");
    console.log("pdfed: mode =", this.mode);
    console.log("pdfed: isMultiPage =", this.isMultiPage);
    console.log("pdfed: canvases.size =", this.canvases.size);
    console.log("pdfed: annotations.length =", this.annotations.length);
    console.log("pdfed: e.target =", e.target.tagName, e.target.className);

    if (this._shouldIgnoreEvent(e)) {
      console.log("pdfed: BLOCKED by _shouldIgnoreEvent");
      return;
    }
    if (this._isOverToolbar(e)) {
      console.log("pdfed: BLOCKED by _isOverToolbar");
      return;
    }

    // 1. Multi-Page Detection: Find which page was clicked
    const pageInfo = this._getPageCoordinates(e.clientX, e.clientY);
    console.log("pdfed: pageInfo =", pageInfo);

    if (!pageInfo) {
      console.log(
        "pdfed: BLOCKED - pageInfo is null (click outside all canvases)"
      );
      return;
    }

    const clickedPageNum = pageInfo.pageNum;
    this.activePage = clickedPageNum;
    this.currentPageNum = clickedPageNum;

    // 2. Cache rect for drag operations
    const page = this.canvases.get(this.activePage);
    if (!page) {
      console.log(
        "pdfed: BLOCKED - no page found in canvases map for",
        this.activePage
      );
      return;
    }

    this._dragRect = page.canvas.getBoundingClientRect();

    // 3. Use the coordinates from pageInfo (already page-relative)
    const point = { x: pageInfo.x, y: pageInfo.y, pageNum: clickedPageNum };
    console.log("pdfed: point =", point);

    // 4. Hit Testing (using page coords)
    const hit = this._getAnnotationAt(point.x, point.y);
    console.log("pdfed: hit =", hit ? hit.id : "null");

    // Log all annotations for debugging
    this.annotations.forEach((ann) => {
      console.log(
        `pdfed: annotation ${ann.id}: pageNum=${ann.pageNum}, bounds=`,
        ann.bounds
      );
    });

    // MODE: SELECT
    if (this.mode === "select") {
      console.log("pdfed: SELECT MODE");
      if (this.selectedAnnotation) {
        const handle = this._getHandleAt(
          point.x,
          point.y,
          this.selectedAnnotation
        );
        if (handle) {
          console.log("pdfed: RESIZE handle hit:", handle);
          this.isResizing = true;
          this.resizeHandle = handle;
          this.startResizeBounds = { ...this.selectedAnnotation.bounds };
          this.startResizePoint = point;
          if (this.canvas) this.canvas.style.pointerEvents = "auto";
          return;
        }
      }

      if (hit) {
        console.log("pdfed: HIT! Starting drag on:", hit.id);
        this.selectedAnnotation = hit;
        this.isDraggingAnnotation = true;
        this.dragOffset = {
          x: point.x - hit.bounds.x,
          y: point.y - hit.bounds.y,
        };
        console.log("pdfed: dragOffset =", this.dragOffset);
        this._redraw();
        if (page.canvas) page.canvas.style.pointerEvents = "auto";
        return;
      } else {
        console.log("pdfed: NO HIT - deselecting");
        this.selectedAnnotation = null;
        this.isDraggingAnnotation = false;
        this._redraw();
        return;
      }
    }

    // MODE: TEXT EDIT (Smart Click)
    if (this.mode === "text" && hit && hit.type === "text") {
      if (this.onAnnotationComplete) {
        this.onAnnotationComplete({
          type: "text-edit",
          annotation: hit,
          pageNum: this.currentPageNum, // Pass page context
        });
        this.removeAnnotation(hit.id);
      }
      return;
    }

    // Note: Auto-switch to select on empty click was removed as it prevented
    // drawing tools from working. Users can click the Select tool button instead.

    // MODE: DRAWING / NEW ANNOTATION
    this.isDrawing = true;
    this.startPoint = point;
    this.currentPoint = point;
    this.pathPoints = [point];

    e.preventDefault();
  }

  _handleMouseMove(e) {
    // PERFORMANCE: Skip all processing if not in an interactive state
    const isInteracting =
      this.isDrawing || this.isDraggingAnnotation || this.isResizing;

    if (!isInteracting) {
      const isOverCanvas = this.isMultiPage
        ? e.target.classList.contains("pdfed-annotation-layer")
        : e.target === this.canvas;

      if (!isOverCanvas) return;

      // Get page-relative point for hit testing
      const point = this._getPageRelativePoint(e) || {
        x: e.offsetX,
        y: e.offsetY,
      };

      // Check resize handles first
      if (this.mode === "select" && this.selectedAnnotation) {
        const handle = this._getHandleAt(
          point.x,
          point.y,
          this.selectedAnnotation
        );
        if (handle) {
          const cursors = {
            tl: "nwse-resize",
            br: "nwse-resize",
            tr: "nesw-resize",
            bl: "nesw-resize",
          };
          this.canvas.style.cursor = cursors[handle];
          return;
        }
      }

      const hit = this._getAnnotationAt(point.x, point.y);

      if (this.mode === "select") {
        const cursor = hit ? "move" : "default";
        const pointerEvents = hit ? "auto" : "none";

        if (this.isMultiPage) {
          // Apply to relevant page canvas
          if (point.pageNum) {
            const page = this.canvases.get(point.pageNum);
            if (page) {
              page.canvas.style.cursor = cursor;
              page.canvas.style.pointerEvents = pointerEvents;
            }
          }
        } else if (this.canvas) {
          this.canvas.style.cursor = cursor;
          this.canvas.style.pointerEvents = pointerEvents;
        }
      } else if (this.mode === "text") {
        if (this.isMultiPage && point.pageNum) {
          const page = this.canvases.get(point.pageNum);
          if (page) {
            page.canvas.style.cursor = "text";
            page.canvas.style.pointerEvents = "auto";
          }
        } else if (this.canvas) {
          this.canvas.style.cursor = "text";
          this.canvas.style.pointerEvents = "auto";
        }
      }
      return;
    }

    // Interactive state
    let point;
    if (
      (this.isDraggingAnnotation || this.isResizing) &&
      this.selectedAnnotation
    ) {
      // DYNAMIC PAGE DETECTION (Cross-Page Dragging)
      const pageInfo = this._getPageCoordinates(e.clientX, e.clientY);

      if (pageInfo) {
        // Update Annotation's Page if changed
        if (
          this.isDraggingAnnotation &&
          pageInfo.pageNum !== this.selectedAnnotation.pageNum
        ) {
          console.log(`pdfed: Moved annotation to Page ${pageInfo.pageNum}`);
          this.selectedAnnotation.pageNum = pageInfo.pageNum;
        }
        point = { x: pageInfo.x, y: pageInfo.y };
      } else {
        // Fallback: Use coordinate relative to the annotation's current page
        // (Handles drifting slightly off-page during drag)
        point = this._getPagePoint(
          e.clientX,
          e.clientY,
          this.selectedAnnotation.pageNum
        );
      }
    } else {
      // GENERAL: Use coordinate relative to hovered page
      const p = this._getPageCoordinates(e.clientX, e.clientY);
      point = p ? { x: p.x, y: p.y, pageNum: p.pageNum } : null;
    }

    if (!point) return;

    // Handle Resize
    if (this.isResizing && this.selectedAnnotation) {
      const dx = point.x - this.startResizePoint.x;
      const dy = point.y - this.startResizePoint.y;
      const b = this.startResizeBounds;
      const handle = this.resizeHandle;

      // Calculate new bounds based on handle
      let newX = b.x;
      let newY = b.y;
      let newW = b.width;
      let newH = b.height;

      if (handle.includes("t")) {
        newY += dy;
        newH -= dy;
      }
      if (handle.includes("b")) {
        newH += dy;
      }
      if (handle.includes("l")) {
        newX += dx;
        newW -= dx;
      }
      if (handle.includes("r")) {
        newW += dx;
      }

      // Constraints
      if (newW > 10 && newH > 10) {
        this.selectedAnnotation.bounds = {
          x: newX,
          y: newY,
          width: newW,
          height: newH,
        };
        this._redraw();
      }
      return;
    }

    // Handle annotation dragging in select mode
    if (this.isDraggingAnnotation && this.selectedAnnotation) {
      const newX = point.x - this.dragOffset.x;
      const newY = point.y - this.dragOffset.y;
      const dx = newX - this.selectedAnnotation.bounds.x;
      const dy = newY - this.selectedAnnotation.bounds.y;

      this.selectedAnnotation.bounds.x = newX;
      this.selectedAnnotation.bounds.y = newY;

      // (Text annotations and others rely on this)
      if (this.selectedAnnotation.x !== undefined) {
        this.selectedAnnotation.x = this.selectedAnnotation.bounds.x;
      }
      if (this.selectedAnnotation.y !== undefined) {
        this.selectedAnnotation.y = this.selectedAnnotation.bounds.y;
      }
      if (
        this.selectedAnnotation.type === "draw" &&
        this.selectedAnnotation.data.points
      ) {
        this.selectedAnnotation.data.points =
          this.selectedAnnotation.data.points.map((pt) => ({
            x: pt.x + dx,
            y: pt.y + dy,
            pageNum: pt.pageNum,
          }));
      }

      this._redraw();
      return;
    }

    if (!this.isDrawing) return;

    this.currentPoint = point;
    this.pathPoints.push(this.currentPoint);

    this._redraw();
    this._drawCurrentAnnotation();
  }

  _getHandleAt(x, y, annotation) {
    const b = annotation.bounds;
    const padding = 6;
    const tolerance = 10;

    const handles = {
      tl: { x: b.x - padding, y: b.y - padding },
      tr: { x: b.x + b.width + padding, y: b.y - padding },
      bl: { x: b.x - padding, y: b.y + b.height + padding },
      br: { x: b.x + b.width + padding, y: b.y + b.height + padding },
    };

    for (const [key, h] of Object.entries(handles)) {
      if (Math.abs(x - h.x) <= tolerance && Math.abs(y - h.y) <= tolerance) {
        return key;
      }
    }
    return null;
  }

  _handleMouseUp(e) {
    if (this.isResizing) {
      this.isResizing = false;
      this.resizeHandle = null;
      return;
    }

    if (this.isDraggingAnnotation) {
      this.isDraggingAnnotation = false;
      // Reset pointer events to let PDF viewer work again (unless in draw mode)
      // optional: this._resetPointerEvents();
      return;
    }

    if (this.isDrawing) {
      this.isDrawing = false;

      // Finalize annotation
      let bounds, data;
      let type = this.mode;

      if (this.mode === "draw") {
        if (this.pathPoints.length < 2) return;
        // For freehand, bounds is the bounding box of all points
        bounds = this._calculatePathBounds(this.pathPoints);
        data = {
          points: [...this.pathPoints],
          color: this.options.color,
          strokeWidth: this.options.strokeWidth,
        };
      } else if (this.mode === "highlight" || this.mode === "shapes") {
        // Calculate Rect
        const x = Math.min(this.startPoint.x, this.currentPoint.x);
        const y = Math.min(this.startPoint.y, this.currentPoint.y);
        const w = Math.abs(this.currentPoint.x - this.startPoint.x);
        const h = Math.abs(this.currentPoint.y - this.startPoint.y);

        if (w < 2 && h < 2) return; // Ignore micro-clicks

        bounds = { x, y, width: w, height: h };
        data = { ...this.options };
      } else if (this.mode === "redact") {
        // Redact: Calculate Rect with redact options
        const x = Math.min(this.startPoint.x, this.currentPoint.x);
        const y = Math.min(this.startPoint.y, this.currentPoint.y);
        const w = Math.abs(this.currentPoint.x - this.startPoint.x);
        const h = Math.abs(this.currentPoint.y - this.startPoint.y);

        if (w < 2 && h < 2) return; // Ignore micro-clicks

        bounds = { x, y, width: w, height: h };
        data = {
          fillColor: this.options.redactFillColor || "#000000",
          pattern: this.options.redactPattern || "solid",
        };
      } else if (this.mode === "text") {
        // Start Text Input (Handled by Toolbar)
        this.onAnnotationComplete({
          type: "text-start",
          x: this.currentPoint.x,
          y: this.currentPoint.y,
          pageNum: this.currentPageNum,
        });
        return;
      } else if (this.mode === "comment") {
        // Comment Tool: Create Icon
        bounds = {
          x: this.currentPoint.x,
          y: this.currentPoint.y,
          width: 32,
          height: 32,
        };
        data = { contents: "" };
      }

      if (bounds) {
        const newAnnotation = {
          id: `ann_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          type: type,
          pageNum: this.currentPageNum || this.activePage || 1,
          bounds: bounds,
          data: data,
        };
        this.annotations.push(newAnnotation);
        this._redraw();
        if (this.onAnnotationComplete) {
          this.onAnnotationComplete(newAnnotation);
        }
      }
    }
  }

  _handleTouchStart(e) {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    this._handleMouseDown({
      clientX: touch.clientX,
      clientY: touch.clientY,
      preventDefault: () => e.preventDefault(),
    });
  }

  _handleTouchMove(e) {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    e.preventDefault();
    this._handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
  }

  _handleTouchEnd(e) {
    this._handleMouseUp(e);
  }

  _handleDoubleClick(e) {
    const point = this._getPoint(e);
    if (this._shouldIgnoreEvent(e)) return;

    const hit = this._getAnnotationAt(point.x, point.y);

    // Double click on Text -> Edit (Regardless of current tool, usually Select)
    if (hit && hit.type === "text") {
      if (this.onAnnotationComplete) {
        this.onAnnotationComplete({
          type: "text-edit",
          annotation: hit,
        });
        this.removeAnnotation(hit.id);
      }
    }

    // Double click on Comment -> Edit
    if (hit && hit.type === "comment") {
      if (this.onAnnotationComplete) {
        this.onAnnotationComplete({
          type: "comment-edit",
          annotation: hit,
        });
      }
      return;
    }

    /* 
    // Double Click Creation Disabled per User Request (Step 996)
    // No hit -> Create New Comment (User Request: "click to drop comment")
    // We use double-click to avoid conflict with drag-selection
    const id = `ann_cmt_${Date.now()}`;
    const annotation = {
       id,
       type: 'comment',
       bounds: { x: point.x, y: point.y, width: 32, height: 32 },
       data: { text: '' }
    };
    this.annotations.push(annotation);
    this._redraw();
    
    if (this.onAnnotationComplete) {
        this.onAnnotationComplete({
            type: 'comment-edit',
            annotation
        });
    }
    */
  }

  // ============ Drawing Methods ============

  setSimulatedWatermark(config) {
    this.simulatedWatermark = config;
    this._redraw(); // Force immediate repaint
  }

  setSimulatedHeaderFooter(config) {
    this.simulatedHeaderFooter = config;
    this._redraw(); // Force immediate repaint
  }

  _redraw() {
    // Clear all canvases
    this.canvases.forEach(({ ctx, canvas }) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // FIX: Pass canvas object, not width/height integers
      this._renderSimulationOnContext(ctx, canvas);
    });

    // Render all annotations
    this.annotations.forEach((ann) => {
      // Only render if it belongs to a known page
      if (!ann.pageNum) return;

      const page = this.canvases.get(ann.pageNum);
      if (page) {
        this._renderAnnotation(page.ctx, ann);
      }
    });

    // Render current interaction (drawing line / drag box)
    if (this.isDrawing && this.currentPoint) {
      const page = this.canvases.get(this.currentPageNum);
      if (page) {
        this._renderInteraction(page.ctx);
      }
    }
  }

  _hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  _renderInteraction(ctx) {
    if (!this.startPoint || !this.currentPoint) return;

    ctx.save();
    ctx.beginPath();

    // 1. Calculate common dimensions for shape tools
    const x = Math.min(this.startPoint.x, this.currentPoint.x);
    const y = Math.min(this.startPoint.y, this.currentPoint.y);
    const width = Math.abs(this.currentPoint.x - this.startPoint.x);
    const height = Math.abs(this.currentPoint.y - this.startPoint.y);

    switch (this.mode) {
      case "highlight":
        ctx.fillStyle = this._hexToRgba(
          this.options.highlightColor,
          this.options.opacity
        );
        ctx.fillRect(x, y, width, height);
        break;

      case "underline":
      case "strikethrough":
        ctx.strokeStyle = this.options.color;
        ctx.lineWidth = 2;
        // Determine line Y position
        const lineY =
          this.mode === "underline"
            ? Math.max(this.startPoint.y, this.currentPoint.y)
            : (this.startPoint.y + this.currentPoint.y) / 2;

        ctx.moveTo(this.startPoint.x, lineY);
        ctx.lineTo(this.currentPoint.x, lineY);
        ctx.stroke();
        break;

      case "draw":
        if (this.pathPoints.length < 2) break;

        ctx.strokeStyle = this.options.color;
        ctx.lineWidth = this.options.strokeWidth;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        ctx.moveTo(this.pathPoints[0].x, this.pathPoints[0].y);

        // Use quadratic curves for smoother drawing
        for (let i = 1; i < this.pathPoints.length - 1; i++) {
          const p1 = this.pathPoints[i];
          const p2 = this.pathPoints[i + 1];
          const midX = (p1.x + p2.x) / 2;
          const midY = (p1.y + p2.y) / 2;
          ctx.quadraticCurveTo(p1.x, p1.y, midX, midY);
        }

        // Connect to last point
        const last = this.pathPoints[this.pathPoints.length - 1];
        ctx.lineTo(last.x, last.y);
        ctx.stroke();
        break;

      case "shapes":
      case "redact":
        if (this.mode === "redact") {
          // Preview style for Redact
          ctx.fillStyle = "rgba(0, 0, 0, 0.3)"; // Semi-transparent black
          ctx.fillRect(x, y, width, height);
          ctx.strokeStyle = "#000000";
          ctx.lineWidth = 1;
          ctx.setLineDash([5, 5]);
          ctx.strokeRect(x, y, width, height);
          ctx.setLineDash([]);
        } else {
          // Regular Rectangle Shape
          ctx.strokeStyle = this.options.color;
          ctx.lineWidth = this.options.strokeWidth;
          ctx.strokeRect(x, y, width, height);
        }
        break;
    }

    ctx.restore();
  }

  _drawSelectionBox(annotation) {
    let ctx = this.ctx;
    if (this.isMultiPage) {
      const pageNum = annotation.pageNum || 1;
      const page = this.canvases.get(pageNum);
      if (!page) return; // Can't draw if page missing
      ctx = page.ctx;
    }

    const b = annotation.bounds;
    const padding = 6;

    ctx.save();

    // 1. Selection Box Border & Fill
    ctx.translate(0.5, 0.5); // Sharp lines
    ctx.strokeStyle = "#818cf8"; // Indigo 400
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]); // Elegant dash

    // Very subtle highlight fill
    ctx.fillStyle = "rgba(129, 140, 248, 0.04)";
    ctx.fillRect(
      b.x - padding,
      b.y - padding,
      b.width + padding * 2,
      b.height + padding * 2
    );
    ctx.strokeRect(
      b.x - padding,
      b.y - padding,
      b.width + padding * 2,
      b.height + padding * 2
    );

    // 2. Corner Handles (Circular with shadow)
    ctx.setLineDash([]);
    ctx.fillStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.shadowColor = "rgba(0, 0, 0, 0.15)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;

    const r = 5; // Radius
    const corners = [
      { x: b.x - padding, y: b.y - padding },
      { x: b.x + b.width + padding, y: b.y - padding },
      { x: b.x - padding, y: b.y + b.height + padding },
      { x: b.x + b.width + padding, y: b.y + b.height + padding },
    ];

    corners.forEach((c) => {
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    ctx.restore();
  }

  _drawCurrentAnnotation() {
    if (!this.startPoint || !this.currentPoint) return;

    let ctx = this.ctx;
    if (this.isMultiPage) {
      const page = this.canvases.get(this.activePage);
      if (!page) return;
      ctx = page.ctx;
    }

    ctx.save();
    ctx.beginPath(); // Ensure fresh path for preview

    switch (this.mode) {
      case "highlight":
      case "underline":
      case "strikethrough":
        this._drawHighlightPreview(ctx);
        break;
      case "draw":
        this._drawFreehandPreview(ctx);
        break;
      case "shapes":
      case "redact":
        this._drawShapePreview(ctx);
        break;
    }

    ctx.restore();
  }

  _drawHighlightPreview(ctx) {
    if (!this.startPoint || !this.currentPoint || !ctx) return;
    const { startPoint, currentPoint } = this;
    const x = Math.min(startPoint.x, currentPoint.x);
    const y = Math.min(startPoint.y, currentPoint.y);
    const width = Math.abs(currentPoint.x - startPoint.x);
    const height = Math.abs(currentPoint.y - startPoint.y);

    if (this.mode === "highlight") {
      ctx.fillStyle = this._hexToRgba(
        this.options.highlightColor,
        this.options.opacity
      );
      ctx.fillRect(x, y, width, height);
    } else {
      ctx.strokeStyle = this.options.color;
      ctx.lineWidth = 2;
      const lineY =
        this.mode === "underline"
          ? Math.max(startPoint.y, currentPoint.y)
          : (startPoint.y + currentPoint.y) / 2;
      ctx.moveTo(startPoint.x, lineY);
      ctx.lineTo(currentPoint.x, lineY);
      ctx.stroke();
    }
  }

  _drawFreehandPreview(ctx) {
    if (this.pathPoints.length < 2 || !ctx) return;
    ctx.strokeStyle = this.options.color;
    ctx.lineWidth = this.options.strokeWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.moveTo(this.pathPoints[0].x, this.pathPoints[0].y);
    for (let i = 1; i < this.pathPoints.length - 1; i++) {
      const p1 = this.pathPoints[i];
      const p2 = this.pathPoints[i + 1];
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      ctx.quadraticCurveTo(p1.x, p1.y, midX, midY);
    }
    const lastPoint = this.pathPoints[this.pathPoints.length - 1];
    ctx.lineTo(lastPoint.x, lastPoint.y);
    ctx.stroke();
  }

  _drawShapePreview(ctx) {
    if (!this.startPoint || !this.currentPoint || !ctx) return;
    const { startPoint, currentPoint } = this;
    const x = Math.min(startPoint.x, currentPoint.x);
    const y = Math.min(startPoint.y, currentPoint.y);
    const width = Math.abs(currentPoint.x - startPoint.x);
    const height = Math.abs(currentPoint.y - startPoint.y);

    if (this.mode === "redact") {
      // Redact preview: Red border with semi-transparent red fill
      ctx.fillStyle = "rgba(239, 68, 68, 0.3)";
      ctx.fillRect(x, y, width, height);
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(x, y, width, height);
      ctx.setLineDash([]);
    } else {
      // Regular shapes
      ctx.strokeStyle = this.options.color;
      ctx.lineWidth = this.options.strokeWidth;
      ctx.strokeRect(x, y, width, height);
    }
  }

  _renderAnnotation(ctx, annotation) {
    if (!ctx) return;

    // PER-PAGE COORDINATE LOGIC
    // ctx is already the Page Canvas Context (0,0 = Page Top-Left)
    // annotation.x/y are relative to Page Top-Left.
    // So we just draw directly!

    let drawX = annotation.x;
    let drawY = annotation.y;

    // Bounds fallback (for older annotations)
    if (drawX === undefined && annotation.bounds) {
      drawX = annotation.bounds.x;
      drawY = annotation.bounds.y;
    }

    ctx.save();
    ctx.beginPath();
    switch (annotation.type) {
      case "text":
        const data = annotation.data;
        const fontSize = data.fontSize || 16;
        const lineHeight = fontSize * 1.3; // 1.3x line height for readability

        // 1. Draw Background (if exists and not transparent)
        if (data.backgroundColor && data.backgroundColor !== "transparent") {
          ctx.fillStyle = data.backgroundColor;
          ctx.fillRect(
            annotation.bounds.x,
            annotation.bounds.y,
            annotation.bounds.width,
            annotation.bounds.height
          );
        }

        // 2. Configure Font
        let fontStr = "";
        if (data.bold) fontStr += "bold ";
        if (data.italic) fontStr += "italic ";
        const fontFamily = data.fontFamily || "Helvetica, Arial, sans-serif";
        fontStr += `${fontSize}px ${fontFamily}`;
        ctx.font = fontStr;

        // 3. Draw Text (multiline support)
        ctx.fillStyle = data.color || "#000000";
        ctx.textBaseline = "top";

        // Split text by newlines and render each line
        const lines = (data.text || "").split("\n");
        let currentY = annotation.bounds.y;

        lines.forEach((line, lineIndex) => {
          ctx.fillText(line, annotation.bounds.x, currentY);

          // 4. Decorations (Underline/Strike) - per line
          if (data.underline || data.strike) {
            const textWidth = ctx.measureText(line).width;
            ctx.lineWidth = 1;
            ctx.strokeStyle = data.color;

            if (data.underline) {
              const underlineY = currentY + fontSize + 2;
              ctx.beginPath();
              ctx.moveTo(annotation.bounds.x, underlineY);
              ctx.lineTo(annotation.bounds.x + textWidth, underlineY);
              ctx.stroke();
            }
            if (data.strike) {
              const strikeY = currentY + fontSize / 2;
              ctx.beginPath();
              ctx.moveTo(annotation.bounds.x, strikeY);
              ctx.lineTo(annotation.bounds.x + textWidth, strikeY);
              ctx.stroke();
            }
          }

          currentY += lineHeight;
        });
        break;
      case "highlight":
        ctx.fillStyle = this._hexToRgba(
          annotation.data.color,
          annotation.data.opacity
        );
        ctx.fillRect(
          annotation.bounds.x,
          annotation.bounds.y,
          annotation.bounds.width,
          annotation.bounds.height
        );
        break;

      case "underline":
      case "strikethrough":
        ctx.strokeStyle = annotation.data.color;
        ctx.lineWidth = 2;
        ctx.moveTo(annotation.bounds.x, annotation.bounds.y);
        ctx.lineTo(
          annotation.bounds.x + annotation.bounds.width,
          annotation.bounds.y
        );
        ctx.stroke();
        break;

      case "draw":
        const points = annotation.data.points;
        if (points && points.length >= 2) {
          ctx.strokeStyle = annotation.data.color;
          ctx.lineWidth = annotation.data.strokeWidth;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";

          ctx.moveTo(points[0].x, points[0].y);
          // Draw lines (using simple lines for reliability)
          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
          }
          ctx.stroke();
        }
        break;

      case "shapes":
        ctx.strokeStyle = annotation.data.color;
        ctx.lineWidth = annotation.data.strokeWidth;
        ctx.strokeRect(
          annotation.bounds.x,
          annotation.bounds.y,
          annotation.bounds.width,
          annotation.bounds.height
        );
        break;

      case "redact":
        // Redact: Filled rectangle with custom options (permanently obscures content)
        const redactData = annotation.data || {};
        const fillColor = redactData.fillColor || "#000000";
        const pattern = redactData.pattern || "solid";

        // Draw base fill
        ctx.fillStyle = fillColor;
        ctx.fillRect(
          annotation.bounds.x,
          annotation.bounds.y,
          annotation.bounds.width,
          annotation.bounds.height
        );

        // Draw pattern overlay
        if (pattern === "striped" || pattern === "crosshatch") {
          ctx.save();
          ctx.beginPath();
          ctx.rect(
            annotation.bounds.x,
            annotation.bounds.y,
            annotation.bounds.width,
            annotation.bounds.height
          );
          ctx.clip();

          ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
          ctx.lineWidth = 1;

          const step = 8;
          const x = annotation.bounds.x;
          const y = annotation.bounds.y;
          const w = annotation.bounds.width;
          const h = annotation.bounds.height;

          // Diagonal lines (45 deg)
          for (let i = -h; i < w + h; i += step) {
            ctx.beginPath();
            ctx.moveTo(x + i, y);
            ctx.lineTo(x + i - h, y + h);
            ctx.stroke();
          }

          // Add reverse diagonals for crosshatch
          if (pattern === "crosshatch") {
            for (let i = -h; i < w + h; i += step) {
              ctx.beginPath();
              ctx.moveTo(x + i, y + h);
              ctx.lineTo(x + i + h, y);
              ctx.stroke();
            }
          }
          ctx.restore();
        }
        break;

      case "image":
        const img = this.imageCache.get(annotation.id);
        if (img) {
          ctx.drawImage(
            img,
            annotation.bounds.x,
            annotation.bounds.y,
            annotation.bounds.width,
            annotation.bounds.height
          );
        } else {
          // Load if not in cache
          const newImg = new Image();
          newImg.onload = () => {
            this.imageCache.set(annotation.id, newImg);
            this._redraw();
          };
          newImg.src = annotation.data.dataUrl;
        }
        break;

      case "comment":
        ctx.save();
        ctx.translate(annotation.bounds.x, annotation.bounds.y);

        // Premium Shadow (Soft & diffused)
        ctx.shadowColor = "rgba(0,0,0,0.12)";
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 6;

        // Gradient Body (Apple Notes Yellow)
        const grad = ctx.createLinearGradient(0, 0, 0, 32);
        grad.addColorStop(0, "#FFE868"); // Light
        grad.addColorStop(1, "#F2C94C"); // Darker
        ctx.fillStyle = grad;

        // Rounded Rect Shape
        const r = 6;
        const w = 32;
        const h = 32;
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.lineTo(w - r, 0);
        ctx.quadraticCurveTo(w, 0, w, r);
        ctx.lineTo(w, h - r);
        ctx.quadraticCurveTo(w, h, w - r, h);
        ctx.lineTo(r, h);
        ctx.quadraticCurveTo(0, h, 0, h - r);
        ctx.lineTo(0, r);
        ctx.quadraticCurveTo(0, 0, r, 0);
        ctx.fill();

        // Inner Highlight Border (Top/Left light)
        ctx.shadowColor = "transparent";
        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Icon Symbol: Mini Lines (Slate color)
        ctx.fillStyle = "rgba(60, 60, 67, 0.4)"; // #3c3c43
        // Line 1
        ctx.fillRect(8, 10, 16, 2);
        // Line 2
        ctx.fillRect(8, 15, 16, 2);
        // Line 3 (Short)
        ctx.fillRect(8, 20, 10, 2);

        ctx.restore();
        break;
    }
    ctx.restore();
  }

  // ============ Annotation Finalization ============

  _finalizeAnnotation() {
    if (!this.startPoint || !this.currentPoint) return;

    const annotation = this._createAnnotation();
    // Safety: Reset state regardless of success to prevent stuck states
    this.startPoint = null;
    this.currentPoint = null;
    this.pathPoints = [];

    if (!annotation) return;

    this.annotations.push(annotation);
    this._redraw();

    if (this.onAnnotationComplete) {
      this.onAnnotationComplete(annotation);
    }
  }

  _createAnnotation() {
    if (!this.startPoint || !this.currentPoint) return null;

    const id = `ann_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const { startPoint, currentPoint, mode } = this;

    const x = Math.min(startPoint.x, currentPoint.x);
    const y = Math.min(startPoint.y, currentPoint.y);
    const width = Math.abs(currentPoint.x - startPoint.x);
    const height = Math.abs(currentPoint.y - startPoint.y);

    const pageNum = this.isMultiPage ? this.activePage : 1;

    if (width < 5 && height < 5 && mode !== "draw") return null;

    let annotation = null;

    switch (mode) {
      case "highlight":
        annotation = {
          id,
          type: "highlight",
          bounds: { x, y, width, height },
          data: {
            color: this.options.highlightColor,
            opacity: this.options.opacity,
          },
        };
        break;
      case "underline":
        annotation = {
          id,
          type: "underline",
          bounds: {
            x: startPoint.x,
            y: Math.max(startPoint.y, currentPoint.y),
            width,
            height: 2,
          },
          data: { color: this.options.color },
        };
        break;
      case "strikethrough":
        annotation = {
          id,
          type: "strikethrough",
          bounds: {
            x: startPoint.x,
            y: (startPoint.y + currentPoint.y) / 2,
            width,
            height: 2,
          },
          data: { color: this.options.color },
        };
        break;
      case "draw":
        if (this.pathPoints.length < 2) return null;
        annotation = {
          id,
          type: "draw",
          bounds: this._calculatePathBounds(),
          data: {
            points: [...this.pathPoints],
            color: this.options.color,
            strokeWidth: this.options.strokeWidth,
          },
        };
        break;
      case "shapes":
        annotation = {
          id,
          type: "shapes",
          bounds: { x, y, width, height },
          data: {
            color: this.options.color,
            strokeWidth: this.options.strokeWidth,
          },
        };
        break;
      case "redact":
        annotation = {
          id,
          type: "redact",
          bounds: { x, y, width, height },
          data: { color: "#000000" },
        };
        break;
      default:
        return null;
    }

    if (annotation) {
      annotation.pageNum = pageNum;
    }

    return annotation;
  }

  _calculatePathBounds() {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const point of this.pathPoints) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  // ============ Public API ============

  setMode(mode) {
    this.mode = mode;
    // Setting to 'none' in select mode was blocking all interactions
    const pointerEvents = "auto";

    if (this.isMultiPage) {
      this.canvases.forEach(({ canvas }) => {
        canvas.style.pointerEvents = pointerEvents;
        canvas.style.cursor = this._getCursorForMode(mode);
      });
    } else if (this.canvas) {
      this.canvas.style.pointerEvents = pointerEvents;
      this.canvas.style.cursor = this._getCursorForMode(mode);
    }

    document.body.style.cursor = this._getCursorForMode(mode);
  }

  _getCursorForMode(mode) {
    const cursors = {
      select: "default",
      text: "text",
      highlight: "crosshair",
      underline: "crosshair",
      strikethrough: "crosshair",
      draw: "crosshair",
      shapes: "crosshair",
      image: "copy",
      redact: "crosshair",
    };
    return cursors[mode] || "default";
  }

  setOptions(options) {
    this.options = { ...this.options, ...options };
  }

  getAnnotations() {
    return [...this.annotations];
  }

  clearAnnotations() {
    this.annotations = [];
    this._redraw();
  }

  removeAnnotation(id) {
    this.annotations = this.annotations.filter((a) => a.id !== id);
    this._redraw();
  }

  undo() {
    const removed = this.annotations.pop();
    this._redraw();
    return removed;
  }

  addImage(dataUrl, position = null) {
    const img = new Image();
    img.onload = () => {
      // Use provided position or Default (Screen Center)
      // Toolbar passes Document Absolute (scrollY included).
      let globalX = position ? position.x : window.scrollX + 100;
      let globalY = position ? position.y : window.scrollY + 100;

      let pageNum = this.activePage || 1;
      let finalX = globalX;
      let finalY = globalY;

      // Multi-Page: Map to Page Relative
      if (this.isMultiPage) {
        // Convert Document Absolute -> Viewport Relative (ClientXY)
        const clientX = globalX - window.scrollX;
        const clientY = globalY - window.scrollY;

        const coords = this._getPageCoordinates(clientX, clientY);
        if (coords) {
          pageNum = coords.pageNum;
          finalX = coords.x;
          finalY = coords.y;
        } else {
          // Fallback: If dropped in gutter, put on active page center?
          // Or keep global if fallback?
          // Let's assume active page top-left + offset
          finalX = 100;
          finalY = 100;
        }
      }

      // Scale down if huge
      let width = img.width;
      let height = img.height;
      const maxSize = 300;
      if (width > maxSize || height > maxSize) {
        const ratio = width / height;
        if (width > height) {
          width = maxSize;
          height = maxSize / ratio;
        } else {
          height = maxSize;
          width = maxSize * ratio;
        }
      }

      const id = `ann_img_${Date.now()}`;
      const annotation = {
        id,
        type: "image",
        pageNum: pageNum, // Assign correct page
        bounds: { x: finalX, y: finalY, width, height },
        data: { dataUrl },
      };

      this.imageCache.set(id, img);

      // Persist & Draw
      this.annotations.push(annotation);
      this.selectedAnnotation = annotation;
      this._redraw();

      if (this.onAnnotationComplete) {
        this.onAnnotationComplete(annotation);
      }
    };
    img.src = dataUrl;
  }

  // ============ Utility Methods ============

  _shouldIgnoreEvent(e) {
    // 1. Is it over the Main Toolbar?
    const toolbar = document.querySelector("#pdfed-container");
    if (toolbar && toolbar.contains(e.target)) return true;

    // 2. Is it over a Text Input / Format Bar?
    if (e.target.closest(".pdfed-text-wrapper")) return true;
    if (
      e.target.closest("#pdfed-comment-popup") ||
      e.target.closest(".pdfed-comment-popup")
    )
      return true;

    // 3. Is it over any Modal? (Watermark, Header/Footer, Redact, Security, Signature, Stamp)
    if (e.target.closest("#pdfed-watermark-modal")) return true;
    if (e.target.closest("#pdfed-headfoot-modal")) return true;
    if (e.target.closest("#pdfed-redact-modal")) return true;
    if (e.target.closest("#pdfed-security-modal")) return true;
    if (e.target.closest("#pdfed-signature-modal")) return true;
    if (e.target.closest("#pdfed-stamp-modal")) return true;
    if (e.target.closest(".pdfed-modal-overlay")) return true;
    if (e.target.closest(".wm-panel")) return true;
    if (e.target.closest(".hf-panel")) return true;

    // 4. Is it a Form Field? (Interactive Forms)
    if (e.target.closest(".pdfed-form-layer")) return true;

    return false;
  }
  _getPoint(e) {
    // Optimization: Use cached rect during drag/draw to prevent layout thrashing
    let rect = this._dragRect;

    if (!rect) {
      if (this.isMultiPage) {
        const page = this.canvases.get(this.activePage);
        if (!page) return { x: 0, y: 0 };
        rect = page.canvas.getBoundingClientRect();
      } else {
        rect = this.canvas.getBoundingClientRect();
      }
    }

    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  // CanvasLayer.js - Add these methods

  /**
   * Convert page-relative coords back to screen coords for UI elements
   */
  _getScreenFromPage(pointOrAnnotation) {
    const page = this.isMultiPage
      ? this.canvases.get(pointOrAnnotation.pageNum)
      : { canvas: this.canvas };
    if (!page?.canvas) return { x: 0, y: 0 };

    const rect = page.canvas.getBoundingClientRect();
    const x =
      pointOrAnnotation.x !== undefined
        ? rect.left + pointOrAnnotation.x
        : rect.left + pointOrAnnotation.bounds.x;
    const y =
      pointOrAnnotation.y !== undefined
        ? rect.top + pointOrAnnotation.y
        : rect.top + pointOrAnnotation.bounds.y;

    return { x, y };
  }

  _getPageCoordinates(clientX, clientY) {
    // Finds which page is under the point and returns Page-Relative Coords
    if (!this.isMultiPage) {
      // GLOBAL CANVAS MODE - always return page 1
      if (!this.canvas) {
        // Fallback: If canvas not ready yet, use document-relative coords
        console.warn("pdfed: _getPageCoordinates called before canvas ready");
        return { pageNum: 1, x: clientX, y: clientY + window.scrollY };
      }
      const rect = this.canvas.getBoundingClientRect();
      return { pageNum: 1, x: clientX - rect.left, y: clientY - rect.top };
    }

    // MULTI-PAGE MODE - find which page was clicked
    for (const [pageNum, { canvas }] of this.canvases.entries()) {
      const rect = canvas.getBoundingClientRect();
      if (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      ) {
        return { pageNum, x: clientX - rect.left, y: clientY - rect.top };
      }
    }

    // Fallback: Return first page if click is outside all canvas bounds
    // This can happen when canvases aren't visible yet
    if (this.canvases.size > 0) {
      const [pageNum, { canvas }] = [...this.canvases.entries()][0];
      const rect = canvas.getBoundingClientRect();
      return { pageNum, x: clientX - rect.left, y: clientY - rect.top };
    }

    return null;
  }

  _getPagePoint(clientX, clientY, pageNum) {
    if (!this.isMultiPage || !pageNum) {
      if (!this.canvas) return { x: 0, y: 0 };
      const rect = this.canvas.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    }

    const page = this.canvases.get(pageNum);
    if (!page) return { x: 0, y: 0 };

    const rect = page.canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  _isOverToolbar(e) {
    const toolbar = document.querySelector("#pdfed-container");
    if (!toolbar) return false;
    const rect = toolbar.getBoundingClientRect();
    return (
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom
    );
  }

  _hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // ============ Simulation Methods (Optimistic UI) ============
  setSimulatedWatermark(config) {
    this.simulatedWatermark = config;
    this._redraw();
  }

  setSimulatedHeaderFooter(config) {
    this.simulatedHeaderFooter = config;
    this._redraw();
  }

  _drawSimulations() {
    // Multi-Page support: Draw on ALL pages
    if (this.isMultiPage) {
      this.canvases.forEach(({ ctx, canvas }, pageNum) => {
        this._renderSimulationOnContext(ctx, canvas, pageNum);
      });
    } else {
      // Fallback Global
      if (this.ctx && this.canvas) {
        this._renderSimulationOnContext(this.ctx, this.canvas, 1);
      }
    }
  }

  _renderSimulationOnContext(ctx, canvas, pageNum = 1) {
    if (!ctx || !canvas) return;

    // Handle Retina/HighDPI scaling by using logical dimensions
    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = canvas.height / (window.devicePixelRatio || 1);

    // Watermark
    if (this.simulatedWatermark) {
      const { text, fontSize, opacity, color, position } =
        this.simulatedWatermark;
      const displayText = this._replaceTokens(text, pageNum);

      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      if (position === "diagonal") {
        const fontStr = `${fontSize}px Helvetica, sans-serif`;
        ctx.font = fontStr;
        ctx.translate(width / 2, height / 2);
        ctx.rotate((-45 * Math.PI) / 180);
        ctx.fillText(displayText, 0, 0);
      } else if (position === "center") {
        ctx.font = `${fontSize}px Helvetica, sans-serif`;
        ctx.fillText(displayText, width / 2, height / 2);
      } else if (position === "tile") {
        const displayText = this._replaceTokens(text, pageNum); // Reuse replaced text
        // Tile logic
        const fSize = fontSize * 0.6;
        ctx.font = `${fSize}px Helvetica, sans-serif`;

        // Approximate text width
        const metrics = ctx.measureText(displayText);
        const textWidth = metrics.width;
        const spacingX = textWidth + 100;
        const spacingY = fSize + 80;

        ctx.translate(0, 0); // Reset
        for (let x = 50; x < width; x += spacingX) {
          for (let y = 50; y < height; y += spacingY) {
            ctx.fillText(displayText, x, y);
          }
        }
      } else {
        // center
        ctx.font = `${fontSize}px Helvetica, sans-serif`;
        ctx.fillText(text, width / 2, height / 2);
      }
      ctx.restore();
    }

    // Header/Footer
    if (this.simulatedHeaderFooter) {
      const { header, footer, fontSize, color, margin } =
        this.simulatedHeaderFooter;

      ctx.save();
      ctx.fillStyle = color;
      ctx.font = `${fontSize}px Helvetica, sans-serif`;

      // Header
      if (header?.enabled) {
        const y = margin + fontSize; // Adjust for baseline
        if (header.left) {
          ctx.textAlign = "left";
          ctx.fillText(this._replaceTokens(header.left, pageNum), margin, y);
        }
        if (header.center) {
          ctx.textAlign = "center";
          ctx.fillText(
            this._replaceTokens(header.center, pageNum),
            width / 2,
            y
          );
        }
        if (header.right) {
          ctx.textAlign = "right";
          ctx.fillText(
            this._replaceTokens(header.right, pageNum),
            width - margin,
            y
          );
        }
      }

      // Footer
      if (footer?.enabled) {
        const y = height - margin;
        if (footer.left) {
          ctx.textAlign = "left";
          ctx.fillText(this._replaceTokens(footer.left, pageNum), margin, y);
        }
        if (footer.center) {
          ctx.textAlign = "center";
          ctx.fillText(
            this._replaceTokens(footer.center, pageNum),
            width / 2,
            y
          );
        }
        if (footer.right) {
          ctx.textAlign = "right";
          ctx.fillText(
            this._replaceTokens(footer.right, pageNum),
            width - margin,
            y
          );
        }
      }
      ctx.restore();
    }
  }

  _replaceTokens(text, pageNum = 1) {
    if (!text) return "";
    const date = new Date().toLocaleDateString();
    // Estimate total based on canvases size or default to 1
    const total = this.isMultiPage ? this.canvases.size || 1 : 1;

    return text
      .replace("{page}", pageNum.toString())
      .replace("{total}", total.toString())
      .replace("{date}", date)
      .replace("{filename}", "document.pdf");
  }

  destroy() {
    document.removeEventListener("mousedown", this._onMouseDown);
    document.removeEventListener("mousemove", this._onMouseMove);
    document.removeEventListener("mouseup", this._onMouseUp);
    document.removeEventListener("dblclick", this._onDoubleClick);
    document.removeEventListener("touchstart", this._onTouchStart);
    document.removeEventListener("touchmove", this._onTouchMove);
    document.removeEventListener("touchend", this._onTouchEnd);

    // Multi-Page Cleanup
    if (this.isMultiPage) {
      this.canvases.forEach(({ canvas }) => {
        if (canvas && canvas.parentNode) {
          canvas.parentNode.removeChild(canvas);
        }
      });
      this.canvases.clear();
    }

    // Legacy Cleanup
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }

    this.canvas = null;
    this.ctx = null;
    this.annotations = [];
  }
}
