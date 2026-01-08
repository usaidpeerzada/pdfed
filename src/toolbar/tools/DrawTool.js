/**
 * pdfed - Draw Tool
 * Freehand drawing with smooth path interpolation
 * 
 * Features:
 * - Smooth freehand drawing
 * - Variable stroke width and color
 * - Path optimization for performance
 * - Touch support
 */

export class DrawTool {
  /**
   * @param {Function} onComplete - Callback when drawing is committed
   */
  constructor(onComplete) {
    /** @type {Function} */
    this.onComplete = onComplete;
    
    // State
    /** @type {boolean} */
    this.isActive = false;
    /** @type {boolean} */
    this.isDrawing = false;
    /** @type {{x: number, y: number}[]} */
    this.points = [];
    
    // Canvas
    /** @type {HTMLCanvasElement|null} */
    this.canvas = null;
    /** @type {CanvasRenderingContext2D|null} */
    this.ctx = null;
    
    // Options
    this.options = {
      strokeWidth: 2,
      color: '#000000'
    };
    
    // Bound handlers
    this._onMouseDown = this._handleMouseDown.bind(this);
    this._onMouseMove = this._handleMouseMove.bind(this);
    this._onMouseUp = this._handleMouseUp.bind(this);
    this._onTouchStart = this._handleTouchStart.bind(this);
    this._onTouchMove = this._handleTouchMove.bind(this);
    this._onTouchEnd = this._handleTouchEnd.bind(this);
  }

  /**
   * Activate draw tool
   */
  activate() {
    if (this.isActive) return;
    
    this.isActive = true;
    document.body.style.cursor = 'crosshair';
    
    this._createCanvas();
    
    document.addEventListener('mousedown', this._onMouseDown);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mouseup', this._onMouseUp);
    document.addEventListener('touchstart', this._onTouchStart, { passive: false });
    document.addEventListener('touchmove', this._onTouchMove, { passive: false });
    document.addEventListener('touchend', this._onTouchEnd);
  }

  /**
   * Deactivate draw tool
   */
  deactivate() {
    if (!this.isActive) return;
    
    this.isActive = false;
    this.isDrawing = false;
    document.body.style.cursor = 'default';
    
    this._removeCanvas();
    
    document.removeEventListener('mousedown', this._onMouseDown);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mouseup', this._onMouseUp);
    document.removeEventListener('touchstart', this._onTouchStart);
    document.removeEventListener('touchmove', this._onTouchMove);
    document.removeEventListener('touchend', this._onTouchEnd);
  }

  /**
   * Update options
   * @param {{strokeWidth?: number, color?: string}} options 
   */
  setOptions(options) {
    this.options = { ...this.options, ...options };
  }

  /**
   * Create drawing canvas
   * @private
   */
  _createCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'pdfed-draw-canvas';
    this.canvas.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: auto;
      z-index: 2147483641;
      touch-action: none;
      cursor: crosshair;
    `;
    
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.canvas.style.width = `${window.innerWidth}px`;
    this.canvas.style.height = `${window.innerHeight}px`;
    
    this.ctx = this.canvas.getContext('2d');
    this.ctx.scale(dpr, dpr);
    
    document.body.appendChild(this.canvas);
    console.log('pdfed: Draw canvas created');
  }

  /**
   * Remove canvas
   * @private
   */
  _removeCanvas() {
    if (this.canvas?.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
  }

  // ============ Event Handlers ============

  /**
   * @param {MouseEvent} e 
   * @private
   */
  _handleMouseDown(e) {
    if (this._isOverToolbar(e)) return;
    
    this.isDrawing = true;
    this.points = [{ x: e.clientX, y: e.clientY }];
    
    this.canvas.style.pointerEvents = 'auto';
    e.preventDefault();
  }

  /**
   * @param {MouseEvent} e 
   * @private
   */
  _handleMouseMove(e) {
    if (!this.isDrawing) return;
    
    const lastPoint = this.points[this.points.length - 1];
    const newPoint = { x: e.clientX, y: e.clientY };
    
    // Only add point if moved enough (reduces noise)
    const distance = Math.hypot(newPoint.x - lastPoint.x, newPoint.y - lastPoint.y);
    if (distance > 2) {
      this.points.push(newPoint);
      this._drawPath();
    }
  }

  /**
   * @param {MouseEvent} e 
   * @private
   */
  _handleMouseUp(e) {
    if (!this.isDrawing) return;
    
    this.isDrawing = false;
    this.canvas.style.pointerEvents = 'none';
    
    this._commitDrawing();
  }

  /**
   * @param {TouchEvent} e 
   * @private
   */
  _handleTouchStart(e) {
    if (e.touches.length !== 1) return;
    
    const touch = e.touches[0];
    this._handleMouseDown({
      clientX: touch.clientX,
      clientY: touch.clientY,
      preventDefault: () => e.preventDefault()
    });
  }

  /**
   * @param {TouchEvent} e 
   * @private
   */
  _handleTouchMove(e) {
    if (e.touches.length !== 1) return;
    
    const touch = e.touches[0];
    e.preventDefault();
    this._handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
  }

  /**
   * @param {TouchEvent} e 
   * @private
   */
  _handleTouchEnd(e) {
    this._handleMouseUp(e);
  }

  // ============ Drawing ============

  /**
   * Draw smooth path
   * @private
   */
  _drawPath() {
    if (!this.ctx || this.points.length < 2) return;
    
    const ctx = this.ctx;
    
    // Clear and redraw entire path for smoothness
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    ctx.strokeStyle = this.options.color;
    ctx.lineWidth = this.options.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.beginPath();
    ctx.moveTo(this.points[0].x, this.points[0].y);
    
    // Use quadratic curves for smooth lines
    for (let i = 1; i < this.points.length - 1; i++) {
      const p1 = this.points[i];
      const p2 = this.points[i + 1];
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      ctx.quadraticCurveTo(p1.x, p1.y, midX, midY);
    }
    
    // Draw to last point
    const lastPoint = this.points[this.points.length - 1];
    ctx.lineTo(lastPoint.x, lastPoint.y);
    ctx.stroke();
  }

  // ============ Commit Drawing ============

  /**
   * Commit drawing and notify parent
   * @private
   */
  _commitDrawing() {
    if (this.points.length < 2) {
      this._clearCanvas();
      return;
    }
    
    // Optimize path - reduce points while maintaining shape
    const optimizedPoints = this._optimizePath(this.points);
    
    const annotation = {
      type: 'draw',
      points: optimizedPoints,
      options: { ...this.options }
    };
    
    if (this.onComplete) {
      this.onComplete(annotation);
    }
    
    // Keep drawing on canvas for visual persistence
    // Clear after small delay to allow visual feedback
    setTimeout(() => {
      this._clearCanvas();
    }, 50);
    
    this.points = [];
  }

  /**
   * Optimize path using Ramer-Douglas-Peucker algorithm
   * @param {{x: number, y: number}[]} points 
   * @param {number} epsilon 
   * @returns {{x: number, y: number}[]}
   * @private
   */
  _optimizePath(points, epsilon = 2) {
    if (points.length <= 2) return points;
    
    // Find point with maximum distance from line
    let maxDistance = 0;
    let maxIndex = 0;
    
    const start = points[0];
    const end = points[points.length - 1];
    
    for (let i = 1; i < points.length - 1; i++) {
      const distance = this._perpendicularDistance(points[i], start, end);
      if (distance > maxDistance) {
        maxDistance = distance;
        maxIndex = i;
      }
    }
    
    // If max distance > epsilon, recursively simplify
    if (maxDistance > epsilon) {
      const left = this._optimizePath(points.slice(0, maxIndex + 1), epsilon);
      const right = this._optimizePath(points.slice(maxIndex), epsilon);
      return left.slice(0, -1).concat(right);
    }
    
    return [start, end];
  }

  /**
   * Calculate perpendicular distance from point to line
   * @param {{x: number, y: number}} point 
   * @param {{x: number, y: number}} lineStart 
   * @param {{x: number, y: number}} lineEnd 
   * @returns {number}
   * @private
   */
  _perpendicularDistance(point, lineStart, lineEnd) {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    
    if (dx === 0 && dy === 0) {
      return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);
    }
    
    const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (dx * dx + dy * dy);
    const nearestX = lineStart.x + t * dx;
    const nearestY = lineStart.y + t * dy;
    
    return Math.hypot(point.x - nearestX, point.y - nearestY);
  }

  /**
   * Clear canvas
   * @private
   */
  _clearCanvas() {
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
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
   * Clean up
   */
  destroy() {
    this.deactivate();
  }
}
