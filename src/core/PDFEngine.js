// pdfed - PDF Engine
// Wrapper around PDF.js (rendering) and pdf-lib (manipulation)

import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, rgb, StandardFonts, PDFTextField, PDFCheckBox, PDFDropdown } from 'pdf-lib';

// Set up PDF.js worker
// IMPORTANT: Disable worker for file:// URLs to avoid postMessage security errors
if (window.location.protocol === 'file:') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = ''; // Disable worker, run in main thread
} else {
  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/pdf.worker.min.js');
}

export class PDFEngine {
  constructor() {
    this.pdfJsDoc = null;      // PDF.js document (for rendering)
    this.pdfLibDoc = null;     // pdf-lib document (for modifications)
    this.originalBytes = null; // Original PDF bytes for reload
    this.currentPage = 1;
    this.totalPages = 0;
    this.scale = 1.5;
    this.canvas = null;
    this.ctx = null;
    this.annotations = [];     // Track all annotations
    this.mode = 'select';
  }

  /**
   * Initialize the PDF engine
   * Note: Loading may fail due to CORS - tools will still work for annotations
   */
  async initialize(pdfData = null) {
      try {
        // 1. If we have data passed from background, use it directly (Fixes file:// CORS)
        if (pdfData) {
          console.log('pdfed: Initializing with background data');
          await this.loadDocument(pdfData);
          return;
        }

        // 2. Fallback: Detect URL (Existing logic)
        const pdfUrl = this.detectPDFSource();
        if (pdfUrl) {
          await this.loadDocument(pdfUrl);
        }
      } catch (error) {
        console.warn('pdfed: PDF loading deferred (may be CORS restricted). Annotations will work.');
        this.isInitialized = true;
      }
  }

  /**
   * Detect PDF source from current page
   */
  detectPDFSource() {
    // Check for direct PDF URL
    if (window.location.href.match(/\.pdf($|\?|#)/i)) {
      return window.location.href;
    }

    // Check for embedded PDF
    const embed = document.querySelector('embed[type="application/pdf"]');
    if (embed?.src) {
      return embed.src;
    }

    // Check object element
    const obj = document.querySelector('object[type="application/pdf"]');
    if (obj?.data) {
      return obj.data;
    }

    return window.location.href;
  }

  /**
   * Load a PDF document
   * @param {string|Uint8Array} source - URL, Data URL, or bytes
   */
    /**
   * Load a PDF document
   * @param {string|Uint8Array} source - URL, Data URL, or bytes
   */
  async loadDocument(source) {
    try {
      let pdfBytes;

      if (typeof source === 'string') {
        if (source.trim().startsWith('data:')) {
          console.log('pdfed: Parsing Base64 data URL...');
          
          // 1. ROBUST CLEANING: Remove the data URL prefix using regex
          // This handles "data:application/pdf;base64," and other variations
          const base64Data = source.replace(/^data:.*?;base64,/, '');
          
          // 2. Decode Base64
          const binaryString = atob(base64Data);
          const len = binaryString.length;
          pdfBytes = new Uint8Array(len);
          
          // 3. Convert to Bytes
          for (let i = 0; i < len; i++) {
            pdfBytes[i] = binaryString.charCodeAt(i);
          }
          
          // 4. Validate Header Immediately
          // The first 4 bytes of a valid PDF must be "%PDF"
          const header = String.fromCharCode(...pdfBytes.subarray(0, 4));
          if (header !== '%PDF') {
             console.error('pdfed: Invalid PDF Header found:', header);
             throw new Error(`Invalid PDF file structure. Expected '%PDF', found '${header}'`);
          }

        } else {
          // Fetch standard URL
          const response = await fetch(source);
          if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
          pdfBytes = await response.arrayBuffer();
        }
      } else {
        pdfBytes = source;
      }

      // 5. Ensure Uint8Array format
      if (pdfBytes instanceof ArrayBuffer) {
        this.originalBytes = new Uint8Array(pdfBytes);
      } else {
        this.originalBytes = pdfBytes; // Already Uint8Array
      }

      console.log(`pdfed: Loaded ${this.originalBytes.length} bytes`);
      
      // Cleanup previous doc to prevent memory leaks
      if (this.pdfJsDoc) {
          this.pdfJsDoc.destroy();
          this.pdfJsDoc = null;
      }

      // 6. Load with PDF.js
      // Note: We copy the array to prevent memory detachment issues between libraries
      const pdfJsData = new Uint8Array(this.originalBytes);
      this.pdfJsDoc = await pdfjsLib.getDocument({ data: pdfJsData }).promise;
      this.totalPages = this.pdfJsDoc.numPages;

      // 7. Load with pdf-lib
      // We pass the same bytes. pdf-lib is strict about headers.
      this.pdfLibDoc = await PDFDocument.load(this.originalBytes);

      console.log(`pdfed: Successfully loaded PDF with ${this.totalPages} pages`);
      return true;
      
    } catch (error) {
      console.error('pdfed: Failed to load PDF:', error);
      throw error;
    }
  }


  /**
   * Get a specific page
   * @param {number} pageNum - 1-indexed page number
   */
  async getPage(pageNum) {
    if (!this.pdfJsDoc) return null;
    return await this.pdfJsDoc.getPage(pageNum);
  }

  /**
   * Render a page to canvas
   * @param {number} pageNum - Page number
   * @param {HTMLCanvasElement} canvas - Target canvas
   * @param {number} scale - Optional scale override
   */
  async renderPage(pageNum, canvas, scale = null) {
    const page = await this.getPage(pageNum);
    if (!page) return;

    const renderScale = scale || this.scale;
    const viewport = page.getViewport({ scale: renderScale });
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext('2d');
    await page.render({
      canvasContext: ctx,
      viewport: viewport
    }).promise;

    this.currentPage = pageNum;
    return viewport;
  }

  // ============ Editing Methods ============

  /**
   * Add text to a page
   * @param {number} pageNum - Page number (1-indexed)
   * @param {string} text - Text content
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {object} options - Font options
   */
  async addText(pageNum, text, x, y, options = {}) {
    if (!this.pdfLibDoc) return;

    const page = this.pdfLibDoc.getPage(pageNum - 1);
    const font = await this.pdfLibDoc.embedFont(StandardFonts.Helvetica);
    
    const {
      size = 16,
      color = { r: 0, g: 0, b: 0 }
    } = options;

    page.drawText(text, {
      x,
      y: page.getHeight() - y, // PDF coordinates are bottom-up
      size,
      font,
      color: rgb(color.r, color.g, color.b)
    });

    this.annotations.push({
      type: 'text',
      pageNum,
      x, y, text, options
    });

    return true;
  }

  /**
   * Add image to a page
   * @param {number} pageNum - Page number
   * @param {Uint8Array} imageData - Image bytes
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} width - Image width
   * @param {number} height - Image height
   */
  async addImage(pageNum, imageData, x, y, width, height) {
    if (!this.pdfLibDoc) return;

    const page = this.pdfLibDoc.getPage(pageNum - 1);
    
    // Detect image type and embed
    let image;
    const header = new Uint8Array(imageData.slice(0, 4));
    const isPNG = header[0] === 0x89 && header[1] === 0x50;
    
    if (isPNG) {
      image = await this.pdfLibDoc.embedPng(imageData);
    } else {
      image = await this.pdfLibDoc.embedJpg(imageData);
    }

    page.drawImage(image, {
      x,
      y: page.getHeight() - y - height,
      width,
      height
    });

    this.annotations.push({
      type: 'image',
      pageNum, x, y, width, height
    });

    return true;
  }

  /**
   * Add rectangle (highlight, box, etc.)
   * @param {number} pageNum - Page number
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} width - Width
   * @param {number} height - Height
   * @param {object} options - Style options
   */
  async addRectangle(pageNum, x, y, width, height, options = {}) {
    if (!this.pdfLibDoc) return;

    const page = this.pdfLibDoc.getPage(pageNum - 1);
    
    const {
      color = { r: 1, g: 1, b: 0 },
      opacity = 0.5,
      borderColor,
      borderWidth = 0
    } = options;

    page.drawRectangle({
      x,
      y: page.getHeight() - y - height,
      width,
      height,
      color: rgb(color.r, color.g, color.b),
      opacity,
      borderColor: borderColor ? rgb(borderColor.r, borderColor.g, borderColor.b) : undefined,
      borderWidth
    });

    this.annotations.push({
      type: 'rectangle',
      pageNum, x, y, width, height, options
    });

    return true;
  }

  /**
   * Add line (for underline, strikethrough, etc.)
   * @param {number} pageNum - Page number
   * @param {number} x1 - Start X
   * @param {number} y1 - Start Y
   * @param {number} x2 - End X
   * @param {number} y2 - End Y
   * @param {object} options - Style options
   */
  async addLine(pageNum, x1, y1, x2, y2, options = {}) {
    if (!this.pdfLibDoc) return;

    const page = this.pdfLibDoc.getPage(pageNum - 1);
    const height = page.getHeight();
    
    const {
      color = { r: 0, g: 0, b: 0 },
      thickness = 1
    } = options;

    page.drawLine({
      start: { x: x1, y: height - y1 },
      end: { x: x2, y: height - y2 },
      thickness,
      color: rgb(color.r, color.g, color.b)
    });

    this.annotations.push({
      type: 'line',
      pageNum, x1, y1, x2, y2, options
    });

    return true;
  }

  // ============ Page Operations ============

  /**
   * Rotate a page
   * @param {number} pageNum - Page number
   * @param {number} degrees - Rotation degrees (90, 180, 270)
   */
  rotatePage(pageNum, degrees) {
    if (!this.pdfLibDoc) return;
    
    const page = this.pdfLibDoc.getPage(pageNum - 1);
    const currentRotation = page.getRotation().angle;
    page.setRotation({ type: 'degrees', angle: (currentRotation + degrees) % 360 });
  }

  /**
   * Delete a page
   * @param {number} pageNum - Page number
   */
  deletePage(pageNum) {
    if (!this.pdfLibDoc) return;
    this.pdfLibDoc.removePage(pageNum - 1);
    this.totalPages--;
  }

  /**
   * Reorder pages
   * @param {number} fromIndex - Original index (0-based)
   * @param {number} toIndex - New index (0-based)
   */
  async reorderPage(fromIndex, toIndex) {
    if (!this.pdfLibDoc) return;
    // Placeholder - use applyPageMutations for actual changes
    console.log(`pdfed: Reorder page ${fromIndex} to ${toIndex}`);
  }

  /**
   * Apply complex page operations (Reorder, Rotate, Delete)
   * @param {Array<{originalIndex: number, rotation: number}>} newPageOrder 
   * @returns {Uint8Array} New PDF bytes
   */
  async applyPageMutations(newPageOrder) {
      if (!this.pdfLibDoc) throw new Error('No PDF loaded');
      
      console.log('pdfed: Applying page mutations...', newPageOrder);

      // Create new document
      const newPdf = await PDFDocument.create();
      
      // Get indices to copy (0-based)
      const indices = newPageOrder.map(p => p.originalIndex);
      
      // Copy pages from current doc
      const copiedPages = await newPdf.copyPages(this.pdfLibDoc, indices);
      
      // Add pages to new doc with updated rotation
      newPageOrder.forEach((config, i) => {
          const page = copiedPages[i];
          const currentRotation = page.getRotation().angle;
          const extraRotation = config.rotation || 0;
          const finalRotation = (currentRotation + extraRotation) % 360;
          
          page.setRotation({ type: 'degrees', angle: finalRotation });
          newPdf.addPage(page);
      });
      
      // Save and return bytes
      const pdfBytes = await newPdf.save();
      return pdfBytes;
  }

  // ============ Mode Handlers ============

  enableSelectMode() {
    this.mode = 'select';
    document.body.style.cursor = 'default';
  }

  enableTextMode() {
    this.mode = 'text';
    document.body.style.cursor = 'text';
  }

  enableHighlightMode() {
    this.mode = 'highlight';
    document.body.style.cursor = 'crosshair';
  }

  enableDrawMode() {
    this.mode = 'draw';
    document.body.style.cursor = 'crosshair';
  }

  // ============ Save & Export ============

  /**
   * Save the modified PDF
   * @returns {Uint8Array} - Modified PDF bytes
   */
  async save(formValues = null) {
    if (!this.pdfLibDoc) {
      throw new Error('No PDF document loaded');
    }
    
    // Apply Form Values
    if (formValues && Object.keys(formValues).length > 0) {
        try {
            const form = this.pdfLibDoc.getForm();
            for (const [name, value] of Object.entries(formValues)) {
                try {
                    const field = form.getField(name);
                    if (!field) continue;
                    
                    if (field instanceof PDFTextField) {
                        field.setText(value);
                    } else if (field instanceof PDFCheckBox) {
                        if (value === true) field.check();
                        else field.uncheck();
                    } else if (field instanceof PDFDropdown) {
                        field.select(value);
                    }
                } catch (err) {
                    // Fail silently for individual fields
                }
            }
        } catch (e) {
            console.warn('pdfed: Error filling form data', e);
        }
    }

    const pdfBytes = await this.pdfLibDoc.save();
    return pdfBytes;
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.pdfJsDoc) {
      this.pdfJsDoc.destroy();
      this.pdfJsDoc = null;
    }
    this.pdfLibDoc = null;
    this.originalBytes = null;
    this.annotations = [];
  }
}
