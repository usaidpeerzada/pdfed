/**
 * pdfed - Highlight Tool
 * Drag to create highlight, underline, or strikethrough annotations
 * 
 * Features:
 * - Drag to select area
 * - Supports highlight (filled rect), underline, strikethrough
 * - Customizable color and opacity
 * - Live preview while dragging
 */

export class HighlightTool {
  /**
   * @param {'highlight'|'underline'|'strikethrough'} type - Annotation type
   * @param {Function} onComplete - Callback when annotation is committed
   */
  constructor(type, onComplete) {
    /** @type {'highlight'|'underline'|'strikethrough'} */
    this.type = type;
    /** @type {Function} */
    this.onComplete = onComplete;
    
    // State
    /** @type {boolean} */
    this.isActive = false;
    /** @type {boolean} */
    this.isDragging = false;
    /** @type {{x: number, y: number}|null} */
    this.startPoint = null;
    /** @type {{x: number, y: number}|null} */
    this.endPoint = null;
    
    // Preview canvas
    /** @type {HTMLCanvasElement|null} */
    this.previewCanvas = null;
    /** @type {CanvasRenderingContext2D|null} */
    this.previewCtx = null;
    
    // Options
    this.options = {
      color: type === 'highlight' ? '#ffff00' : '#000000',
      opacity: 0.4
    };
    
    // Bound handlers
    this._onMouseDown = this._handleMouseDown.bind(this);
    this._onMouseMove = this._handleMouseMove.bind(this);
    this._onMouseUp = this._handleMouseUp.bind(this);
  }

  /**
   * Activate tool
   */
  activate() {
    if (this.isActive) return;
    
    this.isActive = true;
    document.body.style.cursor = 'crosshair';
    
    this._createPreviewCanvas();
    
    document.addEventListener('mousedown', this._onMouseDown);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mouseup', this._onMouseUp);
  }

  /**
   * Deactivate tool
   */
  deactivate() {
    if (!this.isActive) return;
    
    this.isActive = false;
    this.isDragging = false;
    document.body.style.cursor = 'default';
    
    this._removePreviewCanvas();
    
    document.removeEventListener('mousedown', this._onMouseDown);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mouseup', this._onMouseUp);
  }

  /**
   * Update options
   * @param {{color?: string, opacity?: number}} options 
   */
  setOptions(options) {
    this.options = { ...this.options, ...options };
  }

  /**
   * Set annotation type
   * @param {'highlight'|'underline'|'strikethrough'} type 
   */
  setType(type) {
    this.type = type;
    this.options.color = type === 'highlight' ? '#ffff00' : '#000000';
  }

  // ============ Event Handlers ============

  /**
   * @param {MouseEvent} e 
   * @private
   */
  _handleMouseDown(e) {
    if (this._isOverToolbar(e)) return;
    
    this.isDragging = true;
    this.startPoint = { x: e.clientX, y: e.clientY };
    this.endPoint = { x: e.clientX, y: e.clientY };
    
    e.preventDefault();
  }

  /**
   * @param {MouseEvent} e 
   * @private
   */
  _handleMouseMove(e) {
    if (!this.isDragging) return;
    
    this.endPoint = { x: e.clientX, y: e.clientY };
    this._drawPreview();
  }

  /**
   * @param {MouseEvent} e 
   * @private
   */
  _handleMouseUp(e) {
    if (!this.isDragging) return;
    
    this.isDragging = false;
    this.endPoint = { x: e.clientX, y: e.clientY };
    
    this._commitAnnotation();
    this._clearPreview();
  }

  // ============ Preview Canvas ============

  /**
   * Create preview canvas
   * @private
   */
  _createPreviewCanvas() {
    this.previewCanvas = document.createElement('canvas');
    this.previewCanvas.id = 'pdfed-highlight-preview';
    this.previewCanvas.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: auto;
      z-index: 2147483641;
      cursor: crosshair;
    `;
    
    const dpr = window.devicePixelRatio || 1;
    this.previewCanvas.width = window.innerWidth * dpr;
    this.previewCanvas.height = window.innerHeight * dpr;
    this.previewCanvas.style.width = `${window.innerWidth}px`;
    this.previewCanvas.style.height = `${window.innerHeight}px`;
    
    this.previewCtx = this.previewCanvas.getContext('2d');
    this.previewCtx.scale(dpr, dpr);
    
    document.body.appendChild(this.previewCanvas);
    console.log('pdfed: Highlight canvas created');
  }

  /**
   * Remove preview canvas
   * @private
   */
  _removePreviewCanvas() {
    if (this.previewCanvas?.parentNode) {
      this.previewCanvas.parentNode.removeChild(this.previewCanvas);
    }
    this.previewCanvas = null;
    this.previewCtx = null;
  }

  /**
   * Clear preview
   * @private
   */
  _clearPreview() {
    if (this.previewCtx && this.previewCanvas) {
      this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
    }
  }

  /**
   * Draw preview
   * @private
   */
  _drawPreview() {
    if (!this.previewCtx || !this.startPoint || !this.endPoint) return;
    
    this._clearPreview();
    
    const ctx = this.previewCtx;
    const { startPoint, endPoint } = this;
    
    const x = Math.min(startPoint.x, endPoint.x);
    const y = Math.min(startPoint.y, endPoint.y);
    const width = Math.abs(endPoint.x - startPoint.x);
    const height = Math.abs(endPoint.y - startPoint.y);
    
    ctx.save();
    
    if (this.type === 'highlight') {
      ctx.fillStyle = this._hexToRgba(this.options.color, this.options.opacity);
      ctx.fillRect(x, y, width, height);
    } else {
      // Underline or strikethrough
      ctx.strokeStyle = this.options.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      const lineY = this.type === 'underline'
        ? Math.max(startPoint.y, endPoint.y)
        : (startPoint.y + endPoint.y) / 2;
      
      ctx.moveTo(x, lineY);
      ctx.lineTo(x + width, lineY);
      ctx.stroke();
    }
    
    ctx.restore();
  }

  // ============ Commit Annotation ============

  /**
   * Commit annotation and notify parent
   * @private
   */
  _commitAnnotation() {
    if (!this.startPoint || !this.endPoint) return;
    
    const x = Math.min(this.startPoint.x, this.endPoint.x);
    const y = Math.min(this.startPoint.y, this.endPoint.y);
    const width = Math.abs(this.endPoint.x - this.startPoint.x);
    const height = Math.abs(this.endPoint.y - this.startPoint.y);
    
    // Minimum size check
    if (width < 10 || height < 5) {
      this.startPoint = null;
      this.endPoint = null;
      return;
    }
    
    const annotation = {
      type: this.type,
      bounds: { x, y, width, height },
      options: { ...this.options }
    };
    
    if (this.onComplete) {
      this.onComplete(annotation);
    }
    
    this.startPoint = null;
    this.endPoint = null;
  }

  // ============ Utility ============

  /**
   * Check if click is over toolbar (Shadow DOM aware)
   * @param {MouseEvent} e 
   * @returns {boolean}
   * @private
   */
  _isOverToolbar(e) {
    let element = e.target;
    while (element) {
      if (element.id === 'pdfed-container' || element.id === 'pdfed-toolbar') {
        return true;
      }
      element = element.parentElement || element.getRootNode()?.host;
    }
    return false;
  }

  /**
   * @param {string} hex 
   * @param {number} alpha 
   * @returns {string}
   * @private
   */
  _hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  /**
   * Clean up
   */
  destroy() {
    this.deactivate();
  }
}
