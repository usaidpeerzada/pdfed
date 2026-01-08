/**
 * pdfed - Canvas Layer
 * Transparent overlay for interactive PDF annotations
 * 
 * Responsibilities:
 * - Position overlay on top of PDF viewer
 * - Capture and dispatch mouse/touch events
 * - Render real-time annotation previews
 * - Manage annotation objects on canvas
 */

/** @typedef {'select'|'text'|'highlight'|'underline'|'strikethrough'|'draw'|'shapes'|'image'} ToolMode */
/** @typedef {{x: number, y: number}} Point */
/** @typedef {{id: string, type: string, bounds: DOMRect, data: any}} Annotation */

export class CanvasLayer {
  constructor(container, onAnnotationComplete) {
    this.canvas = null;
    this.ctx = null;
    this.container = container;
    this.onAnnotationComplete = onAnnotationComplete;
    
    // State
    this.mode = 'select';
    this.isDrawing = false;
    this.startPoint = null;
    this.currentPoint = null;
    this.pathPoints = [];
    this.annotations = [];
    this.imageCache = new Map();
    
    // Tool options
    this.options = {
      color: '#000000',
      highlightColor: '#ffff00',
      strokeWidth: 2,
      fontSize: 16,
      opacity: 0.5
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
    this._createCanvas();
    this._bindEvents();
    this._observeResize();
  }

  _createCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'pdfed-canvas-layer';
    
    // Determine positioning
    this.isFixed = (this.container === document.body);

    this.canvas.style.cssText = `
      position: ${this.isFixed ? 'fixed' : 'absolute'};
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none; 
      z-index: 2147483640;
      touch-action: none;
      background: transparent;
    `;
    
    this.ctx = this.canvas.getContext('2d');
    this._resizeCanvas();
    
    this.container.appendChild(this.canvas);
  }

  _resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    let width, height;

    if (this.isFixed) {
        width = window.innerWidth;
        height = window.innerHeight;
    } else {
        // Container scroll dimensions
        width = this.container.scrollWidth;
        height = this.container.scrollHeight;
    }
    
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    
    this.ctx.scale(dpr, dpr);
    this._redraw();
  }

  _observeResize() {
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => this._resizeCanvas(), 100);
    });
  }

  _bindEvents() {
    document.addEventListener('mousedown', this._onMouseDown);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mouseup', this._onMouseUp);
    document.addEventListener('dblclick', this._onDoubleClick);
    document.addEventListener('touchstart', this._onTouchStart, { passive: false });
    document.addEventListener('touchmove', this._onTouchMove, { passive: false });
    document.addEventListener('touchend', this._onTouchEnd);
  }

  // ============ Event Handlers ============
  _getAnnotationAt(x, y, tolerance = 10) {
      // Loop backwards (top-most items first)
      for (let i = this.annotations.length - 1; i >= 0; i--) {
          const ann = this.annotations[i];
          const b = ann.bounds;
          
          // Enhanced collision detection with tolerance
          if (x >= b.x - tolerance && x <= b.x + b.width + tolerance && 
              y >= b.y - tolerance && y <= b.y + b.height + tolerance) {
              return ann;
          }
      }
      return null;
  }

  _handleMouseDown(e) {
    if (this._shouldIgnoreEvent(e)) return;
    if (this._isOverToolbar(e)) return;
    
    // Cache rect for drag operations
    this._dragRect = this.canvas.getBoundingClientRect();
    
    const point = this._getPoint(e);
    
    // Check for hit first regardless of mode (for smart features)
    const hit = this._getAnnotationAt(point.x, point.y);
    
    // MODE: SELECT - Dragging logic
    if (this.mode === 'select') {
        // 1. Check for Resize Handle Hit (if selection exists)
        if (this.selectedAnnotation) {
            const handle = this._getHandleAt(point.x, point.y, this.selectedAnnotation);
            if (handle) {
                this.isResizing = true;
                this.resizeHandle = handle;
                this.startResizeBounds = { ...this.selectedAnnotation.bounds }; // Snapshot
                this.startResizePoint = point;
                this.canvas.style.pointerEvents = 'auto';
                return;
            }
        }

        if (hit) {
            this.canvas.style.pointerEvents = 'auto'; 
            this.selectedAnnotation = hit;
            this.isDraggingAnnotation = true;
            this.dragOffset = { 
                x: point.x - hit.bounds.x, 
                y: point.y - hit.bounds.y 
            };
            this._redraw(); 
            return;
        } else {
            // Deselect if clicking empty space
            this.selectedAnnotation = null;
            this.isDraggingAnnotation = false;
            this._redraw();
            this.canvas.style.pointerEvents = 'none'; 
            return;
        }
    }
    
    // MODE: TEXT - Smart Edit Logic
    if (this.mode === 'text' && hit && hit.type === 'text') {
        // User clicked existing text -> EDIT IT
        if (this.onAnnotationComplete) {
            this.onAnnotationComplete({
                type: 'text-edit', // Special event for Toolbar
                annotation: hit
            });
            // Remove from canvas temporarily while editing
            this.removeAnnotation(hit.id);
        }
        return;
    }
    
    this.isDrawing = true;
    this.startPoint = this._getPoint(e);
    this.currentPoint = this.startPoint;
    this.pathPoints = [this.startPoint];
    
    // Note: pointer-events: auto is handled by setMode(), not here.
    e.preventDefault();
  }

  _handleMouseMove(e) {
    // PERFORMANCE: Skip all processing if not in an interactive state
    const isInteracting = this.isDrawing || this.isDraggingAnnotation || this.isResizing;
    
    if (!isInteracting) {
        // For hover effects, use cheap offsetX/Y if target is canvas
        // Otherwise skip entirely to avoid layout thrashing
        if (e.target !== this.canvas) return;
        
        const point = { x: e.offsetX, y: e.offsetY };
        
        // Check resize handles first
        if (this.mode === 'select' && this.selectedAnnotation) {
            const handle = this._getHandleAt(point.x, point.y, this.selectedAnnotation);
            if (handle) {
                const cursors = {
                    'tl': 'nwse-resize', 'br': 'nwse-resize',
                    'tr': 'nesw-resize', 'bl': 'nesw-resize'
                };
                this.canvas.style.cursor = cursors[handle];
                return;
            }
        }

        const hit = this._getAnnotationAt(point.x, point.y);
        
        if (this.mode === 'select') {
            this.canvas.style.cursor = hit ? 'move' : 'default';
            this.canvas.style.pointerEvents = hit ? 'auto' : 'none';
        } else if (this.mode === 'text') {
            this.canvas.style.cursor = 'text';
            this.canvas.style.pointerEvents = 'auto';
        }
        return;
    }
    
    // Interactive state - use cached rect
    const point = this._getPoint(e);

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
        
        if (handle.includes('t')) { newY += dy; newH -= dy; }
        if (handle.includes('b')) { newH += dy; }
        if (handle.includes('l')) { newX += dx; newW -= dx; }
        if (handle.includes('r')) { newW += dx; }
        
        // Constraints
        if (newW > 10 && newH > 10) {
            this.selectedAnnotation.bounds = { x: newX, y: newY, width: newW, height: newH };
            this._redraw();
        }
        return;
    }

    // Handle annotation dragging in select mode
    if (this.isDraggingAnnotation && this.selectedAnnotation) {
        this.selectedAnnotation.bounds.x = point.x - this.dragOffset.x;
        this.selectedAnnotation.bounds.y = point.y - this.dragOffset.y;
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
          'tl': { x: b.x - padding, y: b.y - padding },
          'tr': { x: b.x + b.width + padding, y: b.y - padding },
          'bl': { x: b.x - padding, y: b.y + b.height + padding },
          'br': { x: b.x + b.width + padding, y: b.y + b.height + padding }
      };
      
      for (const [key, h] of Object.entries(handles)) {
          if (Math.abs(x - h.x) <= tolerance && Math.abs(y - h.y) <= tolerance) {
              return key;
          }
      }
      return null; 
  }

  _handleMouseUp(e) {
    this._dragRect = null; // Clear cache
    // End annotation dragging or resizing
    if (this.isDraggingAnnotation || this.isResizing) {
        this.isDraggingAnnotation = false;
        this.isResizing = false;
        this.resizeHandle = null;
        
        // Keep selection active but reset events if not over item
        // Actually, if we just finished dragging, we are probably over it or nearby.
        // We let mousemove handle cursor/events reset
        return;
    }
    
    if (!this.isDrawing) return;
    
    this.isDrawing = false;
    
    // Handle Text Click - spawn text input
    if (this.mode === 'text') {
       this.pathPoints = []; 
       this.startPoint = null;
       this.currentPoint = null;
       
       if (this.onAnnotationComplete) {
           this.onAnnotationComplete({
               type: 'text-start',
               x: e.clientX,
               y: e.clientY
           });
       }
       return;
    }

    // Handle Comment Click - spawn sticky note
    if (this.mode === 'comment') {
       const x = e.clientX;
       const y = e.clientY;
       const id = `ann_cmt_${Date.now()}`;
       const annotation = {
           id,
           type: 'comment',
           bounds: { x, y, width: 32, height: 32 }, // Fixed icon size
           data: { text: '' } // Start empty
       };
       this.annotations.push(annotation);
       this._redraw();
       
       // Trigger edit immediately
       if (this.onAnnotationComplete) {
           this.onAnnotationComplete({
               type: 'comment-edit',
               annotation
           });
       }
       return;
    }

    this._finalizeAnnotation();
  }


  _handleTouchStart(e) {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    this._handleMouseDown({ 
      clientX: touch.clientX, 
      clientY: touch.clientY,
      preventDefault: () => e.preventDefault()
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
    if (hit && hit.type === 'text') {
        if (this.onAnnotationComplete) {
            this.onAnnotationComplete({
                type: 'text-edit',
                annotation: hit
            });
            this.removeAnnotation(hit.id);
        }
    }
    
    // Double click on Comment -> Edit
    if (hit && hit.type === 'comment') {
        if (this.onAnnotationComplete) {
            this.onAnnotationComplete({
                type: 'comment-edit',
                annotation: hit
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

  _redraw() {
    // Clear the entire canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Force a new path to prevent previous paths from bleeding over
    this.ctx.beginPath();
    
    for (const annotation of this.annotations) {
      this._renderAnnotation(annotation);
    }
    
    // Draw selection box if an annotation is selected
    if (this.selectedAnnotation && this.mode === 'select') {
      this._drawSelectionBox(this.selectedAnnotation);
    }
  }
  
  _drawSelectionBox(annotation) {
    const ctx = this.ctx;
    const b = annotation.bounds;
    const padding = 6; 
    
    ctx.save();
    
    // 1. Selection Box Border & Fill
    ctx.translate(0.5, 0.5); // Sharp lines
    ctx.strokeStyle = '#818cf8'; // Indigo 400
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]); // Elegant dash
    
    // Very subtle highlight fill
    ctx.fillStyle = 'rgba(129, 140, 248, 0.04)';
    ctx.fillRect(b.x - padding, b.y - padding, b.width + (padding * 2), b.height + (padding * 2));
    ctx.strokeRect(b.x - padding, b.y - padding, b.width + (padding * 2), b.height + (padding * 2));
    
    // 2. Corner Handles (Circular with shadow)
    ctx.setLineDash([]); 
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;

    const r = 5; // Radius
    const corners = [
      { x: b.x - padding, y: b.y - padding },
      { x: b.x + b.width + padding, y: b.y - padding },
      { x: b.x - padding, y: b.y + b.height + padding },
      { x: b.x + b.width + padding, y: b.y + b.height + padding }
    ];
    
    corners.forEach(c => {
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
    
    ctx.restore();
  }

  _drawCurrentAnnotation() {
    if (!this.startPoint || !this.currentPoint) return;
    
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath(); // Ensure fresh path for preview
    
    switch (this.mode) {
      case 'highlight':
      case 'underline':
      case 'strikethrough':
        this._drawHighlightPreview();
        break;
      case 'draw':
        this._drawFreehandPreview();
        break;
      case 'shapes':
        this._drawShapePreview();
        break;
    }
    
    ctx.restore();
  }

  _drawHighlightPreview() {
    if (!this.startPoint || !this.currentPoint) return;
    const ctx = this.ctx;
    const { startPoint, currentPoint } = this;
    const x = Math.min(startPoint.x, currentPoint.x);
    const y = Math.min(startPoint.y, currentPoint.y);
    const width = Math.abs(currentPoint.x - startPoint.x);
    const height = Math.abs(currentPoint.y - startPoint.y);
    
    if (this.mode === 'highlight') {
      ctx.fillStyle = this._hexToRgba(this.options.highlightColor, this.options.opacity);
      ctx.fillRect(x, y, width, height);
    } else {
      ctx.strokeStyle = this.options.color;
      ctx.lineWidth = 2;
      const lineY = this.mode === 'underline' 
        ? Math.max(startPoint.y, currentPoint.y) 
        : (startPoint.y + currentPoint.y) / 2;
      ctx.moveTo(startPoint.x, lineY);
      ctx.lineTo(currentPoint.x, lineY);
      ctx.stroke();
    }
  }

  _drawFreehandPreview() {
    if (this.pathPoints.length < 2) return;
    const ctx = this.ctx;
    ctx.strokeStyle = this.options.color;
    ctx.lineWidth = this.options.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
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

  _drawShapePreview() {
    if (!this.startPoint || !this.currentPoint) return;
    const ctx = this.ctx;
    const { startPoint, currentPoint } = this;
    const x = Math.min(startPoint.x, currentPoint.x);
    const y = Math.min(startPoint.y, currentPoint.y);
    const width = Math.abs(currentPoint.x - startPoint.x);
    const height = Math.abs(currentPoint.y - startPoint.y);
    
    ctx.strokeStyle = this.options.color;
    ctx.lineWidth = this.options.strokeWidth;
    ctx.strokeRect(x, y, width, height);
  }

  _renderAnnotation(annotation) {
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath(); // Essential: Reset path state for each annotation

    switch (annotation.type) {
    case 'text':
        const data = annotation.data;
        
        // 1. Draw Background (if exists and not transparent)
        if (data.backgroundColor && data.backgroundColor !== 'transparent') {
            ctx.fillStyle = data.backgroundColor;
            ctx.fillRect(annotation.bounds.x, annotation.bounds.y, annotation.bounds.width, annotation.bounds.height);
        }
        
        // 2. Configure Font
        let fontStr = '';
        if (data.bold) fontStr += 'bold ';
        if (data.italic) fontStr += 'italic ';
        fontStr += `${data.fontSize}px Helvetica, Arial, sans-serif`;
        ctx.font = fontStr;
        
        // 3. Draw Text
        ctx.fillStyle = data.color || '#000000';
        // Adjust Y slightly down for baseline if using fillText (canvas draws from baseline)
        // Or closer to top-left if using textBaseline = 'top'
        ctx.textBaseline = 'top'; 
        ctx.fillText(data.text, annotation.bounds.x, annotation.bounds.y);
        
        // 4. Decorations (Underline/Strike)
        if (data.underline || data.strike) {
            const textWidth = ctx.measureText(data.text).width;
            ctx.lineWidth = 1;
            ctx.strokeStyle = data.color;
            
            if (data.underline) {
                const lineY = annotation.bounds.y + annotation.bounds.height - 2;
                ctx.beginPath(); ctx.moveTo(annotation.bounds.x, lineY); ctx.lineTo(annotation.bounds.x + textWidth, lineY); ctx.stroke();
            }
            if (data.strike) {
                const lineY = annotation.bounds.y + (annotation.bounds.height / 2);
                ctx.beginPath(); ctx.moveTo(annotation.bounds.x, lineY); ctx.lineTo(annotation.bounds.x + textWidth, lineY); ctx.stroke();
            }
        }
        break;
      case 'highlight':
        ctx.fillStyle = this._hexToRgba(annotation.data.color, annotation.data.opacity);
        ctx.fillRect(
          annotation.bounds.x, annotation.bounds.y, 
          annotation.bounds.width, annotation.bounds.height
        );
        break;
        
      case 'underline':
      case 'strikethrough':
        ctx.strokeStyle = annotation.data.color;
        ctx.lineWidth = 2;
        ctx.moveTo(annotation.bounds.x, annotation.bounds.y);
        ctx.lineTo(annotation.bounds.x + annotation.bounds.width, annotation.bounds.y);
        ctx.stroke();
        break;
        
      case 'draw':
        const points = annotation.data.points;
        if (points && points.length >= 2) {
            ctx.strokeStyle = annotation.data.color;
            ctx.lineWidth = annotation.data.strokeWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            ctx.moveTo(points[0].x, points[0].y);
            // Draw lines (using simple lines for reliability)
            for (let i = 1; i < points.length; i++) {
              ctx.lineTo(points[i].x, points[i].y);
            }
            ctx.stroke();
        }
        break;
        
      case 'shapes':
        ctx.strokeStyle = annotation.data.color;
        ctx.lineWidth = annotation.data.strokeWidth;
        ctx.strokeRect(
          annotation.bounds.x, annotation.bounds.y, 
          annotation.bounds.width, annotation.bounds.height
        );
        break;
        
      case 'image':
        const img = this.imageCache.get(annotation.id);
        if (img) {
             ctx.drawImage(img, annotation.bounds.x, annotation.bounds.y, annotation.bounds.width, annotation.bounds.height);
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
        
      case 'comment':
        ctx.save();
        ctx.translate(annotation.bounds.x, annotation.bounds.y);
        
        // Premium Shadow (Soft & diffused)
        ctx.shadowColor = 'rgba(0,0,0,0.12)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 6;
        
        // Gradient Body (Apple Notes Yellow)
        const grad = ctx.createLinearGradient(0, 0, 0, 32);
        grad.addColorStop(0, '#FFE868'); // Light
        grad.addColorStop(1, '#F2C94C'); // Darker
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
        ctx.shadowColor = 'transparent';
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Icon Symbol: Mini Lines (Slate color)
        ctx.fillStyle = 'rgba(60, 60, 67, 0.4)'; // #3c3c43
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
    
    if (width < 5 && height < 5 && mode !== 'draw') return null;
    
    switch (mode) {
      case 'highlight':
        return {
          id,
          type: 'highlight',
          bounds: { x, y, width, height },
          data: { color: this.options.highlightColor, opacity: this.options.opacity }
        };
      case 'underline':
        return {
          id,
          type: 'underline',
          bounds: { x: startPoint.x, y: Math.max(startPoint.y, currentPoint.y), width, height: 2 },
          data: { color: this.options.color }
        };
      case 'strikethrough':
        return {
          id,
          type: 'strikethrough',
          bounds: { x: startPoint.x, y: (startPoint.y + currentPoint.y) / 2, width, height: 2 },
          data: { color: this.options.color }
        };
      case 'draw':
        if (this.pathPoints.length < 2) return null;
        return {
          id,
          type: 'draw',
          bounds: this._calculatePathBounds(),
          data: { 
            points: [...this.pathPoints], // Safe copy
            color: this.options.color,
            strokeWidth: this.options.strokeWidth
          }
        };
      case 'shapes':
        return {
          id,
          type: 'shapes',
          bounds: { x, y, width, height },
          data: { color: this.options.color, strokeWidth: this.options.strokeWidth }
        };
      default:
        return null;
    }
  }

  _calculatePathBounds() {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
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
    
    // CRITICAL FIX: Toggle pointer events on the canvas layer
    if (mode === 'select') {
      this.canvas.style.pointerEvents = 'none'; // Pass-through
    } else {
      this.canvas.style.pointerEvents = 'auto'; // Capture
    }
    
    const cursors = {
      select: 'default',
      text: 'text',
      highlight: 'crosshair',
      underline: 'crosshair',
      strikethrough: 'crosshair',
      draw: 'crosshair',
      shapes: 'crosshair',
      image: 'copy'
    };
    
    const cursor = cursors[mode] || 'default';
    document.body.style.cursor = cursor;
    this.canvas.style.cursor = cursor;
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
    this.annotations = this.annotations.filter(a => a.id !== id);
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
      // Use provided position or Default
      const x = position ? position.x : (window.scrollX + 100);
      const y = position ? position.y : (window.scrollY + 100);
      
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
        type: 'image',
        bounds: { x, y, width, height },
        data: { dataUrl }
      };
      
      this.imageCache.set(id, img);
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
    const toolbar = document.querySelector('#pdfed-container');
    if (toolbar && toolbar.contains(e.target)) return true;

    // 2. Is it over a Text Input / Format Bar?
    if (e.target.closest('.pdfed-text-wrapper')) return true;
    
    // 3. Is it over Comment Popup? (Fix for Critical Bug Step 1010)
    if (e.target.closest('#pdfed-comment-popup') || e.target.closest('.pdfed-comment-popup')) return true;

    // 4. Is it a Form Field? (Interactive Forms)
    if (e.target.closest('.pdfed-form-layer')) return true;

    return false;
  }
  _getPoint(e) {
    // Optimization: Use cached rect during drag/draw to prevent layout thrashing
    const rect = this._dragRect || this.canvas.getBoundingClientRect();
    return { 
        x: e.clientX - rect.left, 
        y: e.clientY - rect.top 
    };
  }


  _isOverToolbar(e) {
    const toolbar = document.querySelector('#pdfed-container');
    if (!toolbar) return false;
    const rect = toolbar.getBoundingClientRect();
    return (
      e.clientX >= rect.left && e.clientX <= rect.right &&
      e.clientY >= rect.top && e.clientY <= rect.bottom
    );
  }

  _hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  destroy() {
    document.removeEventListener('mousedown', this._onMouseDown);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mouseup', this._onMouseUp);
    document.removeEventListener('dblclick', this._onDoubleClick);
    document.removeEventListener('touchstart', this._onTouchStart);
    document.removeEventListener('touchmove', this._onTouchMove);
    document.removeEventListener('touchend', this._onTouchEnd);
    
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    
    this.canvas = null;
    this.ctx = null;
    this.annotations = [];
  }
}
