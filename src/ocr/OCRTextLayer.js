/**
 * OCRTextLayer
 * Renders OCR recognition results as an editable text overlay on scanned PDF pages.
 * Positions text elements precisely based on Tesseract bounding box coordinates.
 */
import { getOCRService } from './OCRService.js';

export class OCRTextLayer {
  /**
   * @param {HTMLElement} container - Container element for the text layer
   * @param {number} pageNum - Page number
   * @param {number} scale - Current viewport scale
   */
  constructor(container, pageNum, scale = 1) {
    this.container = container;
    this.pageNum = pageNum;
    this.scale = scale;
    this.ocrService = getOCRService();
    this.textElements = [];
    this.isEditing = false;
    this.layer = null;
    this.displayScale = 1;
    this.canvasWidth = 0;  // Stored for save-time coordinate scaling
    this.canvasHeight = 0;
    
    this._createLayer();
  }

  /**
   * Create the text layer container
   */
  _createLayer() {
    this.layer = document.createElement('div');
    this.layer.className = 'pdfed-ocr-text-layer';
    Object.assign(this.layer.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none', // Allow clicks to pass through when not editing
      zIndex: '10'
    });
    this.container.appendChild(this.layer);
  }

  /**
   * Render OCR results on the page
   * @param {Object} ocrResult - Result from OCRService.processPage()
   * @param {number} canvasWidth - Width of canvas used for OCR (optional)
   * @param {number} canvasHeight - Height of canvas used for OCR (optional)
   */
  render(ocrResult, canvasWidth = null, canvasHeight = null) {
    if (!ocrResult || !ocrResult.words || ocrResult.words.length === 0) {
      console.warn('pdfed: No OCR results to render');
      return;
    }

    this.clear();
    
    // Calculate scale factor based on container size vs OCR canvas size
    const containerRect = this.container.getBoundingClientRect();
    
    // Use provided canvas dimensions or estimate from word bounds
    if (!canvasWidth || !canvasHeight) {
      // Estimate canvas dimensions from word bounds (max x+width, max y+height)
      let maxX = 0, maxY = 0;
      for (const word of ocrResult.words) {
        const right = word.bounds.x + word.bounds.width;
        const bottom = word.bounds.y + word.bounds.height;
        if (right > maxX) maxX = right;
        if (bottom > maxY) maxY = bottom;
      }
      canvasWidth = maxX + 50; // Add margin
      canvasHeight = maxY + 50;
    }
    
    // Store canvas dimensions for save-time coordinate scaling
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    
    // Calculate scale to fit OCR coordinates to container display
    const scaleX = containerRect.width / canvasWidth;
    const scaleY = containerRect.height / canvasHeight;
    this.displayScale = Math.min(scaleX, scaleY); // Use uniform scale to prevent distortion
    
    console.log(`pdfed: OCR render - container: ${containerRect.width}x${containerRect.height}, canvas: ${canvasWidth}x${canvasHeight}, scale: ${this.displayScale.toFixed(3)}`);

    // Render each word as an editable span
    for (const word of ocrResult.words) {
      const element = this._createWordElement(word);
      this.layer.appendChild(element);
      this.textElements.push({ element, data: word });
    }
    
    console.log(`pdfed: Rendered ${ocrResult.words.length} OCR words on page ${this.pageNum}`);
  }

  /**
   * Create a positioned text element for a recognized word
   * @param {Object} word - Word data with bounds and text
   * @returns {HTMLElement}
   */
  _createWordElement(word) {
    const el = document.createElement('span');
    el.className = 'pdfed-ocr-word';
    el.textContent = word.text;
    el.dataset.confidence = word.confidence;

    // Get scale - prefer displayScale calculated from container, fall back to passed scale
    const scale = this.displayScale || this.scale || 1;
    
    // Position based on bounding box (scaled to container)
    const { x, y, width, height } = word.bounds;
    Object.assign(el.style, {
      position: 'absolute',
      left: `${x * scale}px`,
      top: `${y * scale}px`,
      width: `${width * scale}px`,
      height: `${height * scale}px`,
      fontSize: `${Math.max(10, height * scale * 0.8)}px`, // Slightly smaller than box, min 10px
      lineHeight: `${height * scale}px`,
      fontFamily: 'Arial, sans-serif',
      color: 'transparent', // Invisible until editing
      background: 'transparent',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      cursor: 'text',
      pointerEvents: 'none'
    });

    // Low confidence words get visual indicator
    if (word.confidence < 70) {
      el.dataset.lowConfidence = 'true';
    }

    return el;
  }

  /**
   * Enable editing mode - Industry-standard OCR UX (Adobe Acrobat/Foxit style)
   * Text is always visible in editable boxes, matching original document appearance
   */
  enableEditing() {
    if (this.isEditing) return;
    this.isEditing = true;

    this.layer.style.pointerEvents = 'auto';

    for (const { element, data } of this.textElements) {
      element.contentEditable = 'true';
      element.style.cursor = 'text';
      element.style.pointerEvents = 'auto';
      
      // Always visible - text displayed in clean editable boxes
      element.style.color = '#1a1a1a';
      element.style.background = 'rgba(255, 255, 255, 0.95)';
      element.style.border = '1px solid #d0d0d0';
      element.style.borderRadius = '2px';
      element.style.padding = '1px 3px';
      element.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
      element.style.transition = 'border-color 0.15s, box-shadow 0.15s';
      element.style.outline = 'none';
      
      // Low confidence: subtle warning indicator
      if (data.confidence < 70) {
        element.style.borderColor = '#f59e0b';
        element.style.borderStyle = 'dashed';
      }
      
      // Focus: blue selection highlight (like text selection)
      element.addEventListener('focus', () => {
        element.style.background = '#e8f4fc';
        element.style.borderColor = '#0066cc';
        element.style.boxShadow = '0 0 0 2px rgba(0, 102, 204, 0.2)';
        element.style.zIndex = '100';
        this._onWordFocus(element, data);
      });
      
      element.addEventListener('blur', () => {
        element.style.background = 'rgba(255, 255, 255, 0.95)';
        element.style.borderColor = data.confidence < 70 ? '#f59e0b' : '#d0d0d0';
        element.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
        element.style.zIndex = '';
        this._onWordBlur(element, data);
      });
      
      element.addEventListener('input', () => {
        // Mark as edited with green border
        element.style.borderColor = '#22c55e';
        element.style.borderStyle = 'solid';
        this._onWordEdit(element, data);
      });
    }

    console.log(`pdfed: OCR editing enabled - ${this.textElements.length} editable text boxes`);
  }

  /**
   * Disable editing mode
   */
  disableEditing() {
    if (!this.isEditing) return;
    this.isEditing = false;

    this.layer.style.pointerEvents = 'none';

    for (const { element } of this.textElements) {
      element.contentEditable = 'false';
      element.style.pointerEvents = 'none';
      // Keep text visible but non-interactive
      element.style.cursor = 'default';
    }

    console.log(`pdfed: OCR editing disabled`);
  }

  /**
   * Word focus handler
   */
  _onWordFocus(element, data) {
    element.style.outline = '2px solid #667eea';
    element.style.outlineOffset = '1px';
    element.style.zIndex = '100';
  }

  /**
   * Word blur handler
   */
  _onWordBlur(element, data) {
    element.style.outline = 'none';
    element.style.zIndex = '';

    // Update internal data with edited text
    data.editedText = element.textContent;
  }

  /**
   * Word edit handler
   */
  _onWordEdit(element, data) {
    data.editedText = element.textContent;
    data.isModified = true;
    element.style.borderColor = '#10b981'; // Green for modified
  }

  /**
   * Get all edits made on this page
   * @returns {Array<{original: string, edited: string, bounds: Object}>}
   */
  getEdits() {
    const edits = [];
    for (const { element, data } of this.textElements) {
      if (data.isModified) {
        edits.push({
          original: data.text,
          edited: data.editedText || element.textContent,
          bounds: data.bounds,
          confidence: data.confidence
        });
      }
    }
    return edits;
  }

  /**
   * Check if page has any edits
   * @returns {boolean}
   */
  hasEdits() {
    return this.textElements.some(({ data }) => data.isModified);
  }

  /**
   * Update scale (when zooming)
   * @param {number} newScale
   */
  setScale(newScale) {
    this.scale = newScale;
    
    // Re-position all elements
    for (const { element, data } of this.textElements) {
      const { x, y, width, height } = data.bounds;
      Object.assign(element.style, {
        left: `${x * this.scale}px`,
        top: `${y * this.scale}px`,
        width: `${width * this.scale}px`,
        height: `${height * this.scale}px`,
        fontSize: `${height * this.scale * 0.85}px`,
        lineHeight: `${height * this.scale}px`
      });
    }
  }

  /**
   * Clear all text elements
   */
  clear() {
    for (const { element } of this.textElements) {
      element.remove();
    }
    this.textElements = [];
  }

  /**
   * Destroy the layer
   */
  destroy() {
    this.clear();
    if (this.layer) {
      this.layer.remove();
      this.layer = null;
    }
  }

  /**
   * Get text content of the layer
   * @returns {string}
   */
  getTextContent() {
    return this.textElements
      .map(({ element }) => element.textContent)
      .join(' ');
  }
}
