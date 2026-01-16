import * as pdfjsLib from "pdfjs-dist";
import {
  PDFDocument,
  rgb,
  StandardFonts,
  PDFTextField,
  PDFCheckBox,
  PDFDropdown,
} from "pdf-lib";

// Set up PDF.js worker
const setupWorker = async () => {
  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL(
    "lib/pdf.worker.min.js"
  );
  console.log("pdfed: Worker configured via chrome.runtime.getURL");
};

// Initialize worker immediately
setupWorker();

export class PDFEngine {
  constructor() {
    this.pdfJsDoc = null; // PDF.js document (for rendering)
    this.pdfLibDoc = null; // pdf-lib document (for modifications)
    this.originalBytes = null; // Original PDF bytes for reload
    this.currentPage = 1;
    this.totalPages = 0;
    this.scale = 1.5;
    this.canvas = null;
    this.ctx = null;
    this.annotations = []; // Track all annotations
    this.mode = "select";
  }

  /**
   * Initialize the PDF engine
   * Note: Loading may fail due to CORS - tools will still work for annotations
   */
  async initialize(pdfData = null) {
    // Ensure worker is ready
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      await setupWorker();
    }

    try {
      // 1. If we have data passed from background, use it directly (Fixes file:// CORS)
      if (pdfData) {
        console.log("pdfed: Initializing with background data");
        await this.loadDocument(pdfData);
        return;
      }

      // 2. Fallback: Detect URL (Existing logic)
      const pdfUrl = this.detectPDFSource();
      if (pdfUrl) {
        await this.loadDocument(pdfUrl);
      }
    } catch (error) {
      console.warn(
        "pdfed: PDF loading deferred (may be CORS restricted). Annotations will work."
      );
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
  async loadDocument(source) {
    try {
      let pdfBytes;

      if (typeof source === "string") {
        if (source.trim().startsWith("data:")) {
          console.log("pdfed: Parsing Base64 data URL...");
          const base64Data = source.replace(/^data:.*?;base64,/, "");
          const binaryString = atob(base64Data);
          const len = binaryString.length;
          pdfBytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            pdfBytes[i] = binaryString.charCodeAt(i);
          }
        } else if (
          source.match(/^https?:\/\//) ||
          source.match(/^file:\/\//) ||
          source.match(/^\//)
        ) {
          // It's a URL (http, file, or relative path)
          const response = await fetch(source);
          if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
          pdfBytes = await response.arrayBuffer();
        } else {
          // It's likely a raw Base64 string (no data: prefix)
          try {
            const binaryString = atob(source);
            const len = binaryString.length;
            pdfBytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              pdfBytes[i] = binaryString.charCodeAt(i);
            }
          } catch (e) {
            // If atob fails, it might be a weird path or invalid data
            throw new Error(
              "Invalid PDF source: Could not parse as URL or Base64"
            );
          }
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

      // Cleanup previous docs to prevent memory leaks
      if (this.pdfJsDoc) {
        this.pdfJsDoc.destroy();
        this.pdfJsDoc = null;
      }
      this.pdfLibDoc = null;

      try {
        this.pdfLibDoc = await PDFDocument.load(this.originalBytes.slice());
        console.log("pdfed: pdf-lib document loaded successfully");
      } catch (pdfLibError) {
        console.error("pdfed: pdf-lib loading failed:", pdfLibError);
        throw pdfLibError;
      }

      try {
        const loadingTask = pdfjsLib.getDocument({
          data: this.originalBytes.slice(), // Use a copy of the data
          disableAutoFetch: true, // Don't auto-fetch additional data
          disableRange: true, // Don't use range requests
          disableStream: true, // Don't stream - we have all data already
          isEvalSupported: false, // Disable eval for security
        });

        this.pdfJsDoc = await loadingTask.promise;
        this.totalPages = this.pdfJsDoc.numPages;
        console.log(`pdfed: PDF.js loaded with ${this.totalPages} pages`);
      } catch (pdfJsError) {
        // PDF.js failed but pdf-lib is loaded - we can still do manipulations
        console.warn("pdfed: PDF.js loading failed:", pdfJsError.message);
        // Get page count from pdf-lib instead
        this.totalPages = this.pdfLibDoc.getPageCount();
      }

      console.log(`pdfed: Document ready with ${this.totalPages} pages`);
      return true;
    } catch (error) {
      console.error("pdfed: Failed to load PDF:", error);
      throw error;
    }
  }

  /**
   * Reset document to original state (for fresh save)
   * This allows us to re-apply all annotations from scratch
   */
  async reset() {
    if (!this.originalBytes) return;

    try {
      // Only reload the pdf-lib document (used for saving)
      // We do NOT need to reload PDF.js (viewer is fine)
      this.pdfLibDoc = await PDFDocument.load(this.originalBytes.slice());
      this.annotations = [];
      console.log("pdfed: Engine reset to original state");
    } catch (e) {
      console.error("pdfed: Failed to reset engine", e);
      throw e;
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

    const ctx = canvas.getContext("2d");
    await page.render({
      canvasContext: ctx,
      viewport: viewport,
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

    const { size = 16, color = { r: 0, g: 0, b: 0 } } = options;

    page.drawText(text, {
      x,
      y: page.getHeight() - y, // PDF coordinates are bottom-up
      size,
      font,
      color: rgb(color.r, color.g, color.b),
    });

    this.annotations.push({
      type: "text",
      pageNum,
      x,
      y,
      text,
      options,
    });

    return true;
  }

  /**
   * Add text annotation with background (for OCR text replacement)
   * Draws a white rectangle first to cover original content, then draws new text
   * @param {number} pageNum - Page number (1-indexed)
   * @param {Object} config - Text configuration
   */
  async addTextAnnotation(pageNum, config) {
    if (!this.pdfLibDoc) return;

    const {
      text,
      x,
      y,
      width,
      height,
      fontSize = 12,
      fontFamily = 'Helvetica',
      color = { r: 0, g: 0, b: 0 },
      backgroundColor = null
    } = config;

    const page = this.pdfLibDoc.getPage(pageNum - 1);
    const pageHeight = page.getHeight();
    const font = await this.pdfLibDoc.embedFont(StandardFonts.Helvetica);

    // Convert to PDF coordinates (bottom-up)
    const pdfY = pageHeight - y - height;

    // Draw white background to cover original text
    if (backgroundColor) {
      page.drawRectangle({
        x: x,
        y: pdfY,
        width: width,
        height: height,
        color: rgb(
          backgroundColor.r / 255,
          backgroundColor.g / 255,
          backgroundColor.b / 255
        ),
        borderWidth: 0,
      });
    }

    // Draw the new text
    page.drawText(text, {
      x: x + 2, // Small padding
      y: pdfY + 2, // Position near bottom of box
      size: fontSize,
      font,
      color: rgb(color.r, color.g, color.b),
    });

    this.annotations.push({
      type: "ocrTextEdit",
      pageNum,
      config,
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
      height,
    });

    this.annotations.push({
      type: "image",
      pageNum,
      x,
      y,
      width,
      height,
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
      borderWidth = 0,
    } = options;

    page.drawRectangle({
      x,
      y: page.getHeight() - y - height,
      width,
      height,
      color: rgb(color.r, color.g, color.b),
      opacity,
      borderColor: borderColor
        ? rgb(borderColor.r, borderColor.g, borderColor.b)
        : undefined,
      borderWidth,
    });

    this.annotations.push({
      type: "rectangle",
      pageNum,
      x,
      y,
      width,
      height,
      options,
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

    const { color = { r: 0, g: 0, b: 0 }, thickness = 1 } = options;

    page.drawLine({
      start: { x: x1, y: height - y1 },
      end: { x: x2, y: height - y2 },
      thickness,
      color: rgb(color.r, color.g, color.b),
    });

    this.annotations.push({
      type: "line",
      pageNum,
      x1,
      y1,
      x2,
      y2,
      options,
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
    page.setRotation({
      type: "degrees",
      angle: (currentRotation + degrees) % 360,
    });
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
    if (!this.pdfLibDoc) throw new Error("No PDF loaded");

    console.log("pdfed: Applying page mutations...", newPageOrder);

    // Create new document
    const newPdf = await PDFDocument.create();

    // Get indices to copy (0-based)
    const indices = newPageOrder.map((p) => p.originalIndex);

    // Copy pages from current doc
    const copiedPages = await newPdf.copyPages(this.pdfLibDoc, indices);

    // Add pages to new doc with updated rotation
    newPageOrder.forEach((config, i) => {
      const page = copiedPages[i];
      const currentRotation = page.getRotation().angle;
      const extraRotation = config.rotation || 0;
      const finalRotation = (currentRotation + extraRotation) % 360;

      page.setRotation({ type: "degrees", angle: finalRotation });
      newPdf.addPage(page);
    });

    // Save and return bytes
    const pdfBytes = await newPdf.save();
    return pdfBytes;
  }

  // ============ Mode Handlers ============

  enableSelectMode() {
    this.mode = "select";
    document.body.style.cursor = "default";
  }

  enableTextMode() {
    this.mode = "text";
    document.body.style.cursor = "text";
  }

  enableHighlightMode() {
    this.mode = "highlight";
    document.body.style.cursor = "crosshair";
  }

  enableDrawMode() {
    this.mode = "draw";
    document.body.style.cursor = "crosshair";
  }

  // ============ Save & Export ============

  /**
   * Save the modified PDF
   * @returns {Uint8Array} - Modified PDF bytes
   */
  async save(formValues = null) {
    if (!this.pdfLibDoc) {
      throw new Error("No PDF document loaded");
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
        console.warn("pdfed: Error filling form data", e);
      }
    }

    const pdfBytes = await this.pdfLibDoc.save();
    return pdfBytes;
  }

  // ============ Watermark Methods ============

  /**
   * Apply text watermark to PDF pages
   * @param {Object} config - Watermark configuration
   * @param {string} config.text - Watermark text
   * @param {number} config.fontSize - Font size in points
   * @param {number} config.opacity - Opacity (0-1)
   * @param {string} config.color - Hex color
   * @param {string} config.position - 'center', 'diagonal', or 'tile'
   * @param {string} config.pageRange - 'all' or 'current'
   * @returns {Uint8Array} Modified PDF bytes
   */
  async applyWatermark(config) {
    if (!this.pdfLibDoc) throw new Error("No document loaded");

    const { text, fontSize, opacity, color, position, pageRange } = config;

    // Parse hex color to RGB
    const r = parseInt(color.slice(1, 3), 16) / 255;
    const g = parseInt(color.slice(3, 5), 16) / 255;
    const b = parseInt(color.slice(5, 7), 16) / 255;

    // Get font
    const font = await this.pdfLibDoc.embedFont(StandardFonts.Helvetica);

    // Determine pages to watermark
    const pages = this.pdfLibDoc.getPages();
    const targetPages =
      pageRange === "current" ? [pages[this.currentPage - 1]] : pages;

    for (const page of targetPages) {
      const { width, height } = page.getSize();
      const textWidth = font.widthOfTextAtSize(text, fontSize);
      const textHeight = fontSize;

      if (position === "diagonal") {
        // Diagonal watermark across center
        page.drawText(text, {
          x: width / 2 - textWidth / 2,
          y: height / 2,
          size: fontSize,
          font,
          color: rgb(r, g, b),
          opacity,
          rotate: { type: "degrees", angle: -45 },
        });
      } else if (position === "tile") {
        // Tile pattern
        const spacingX = textWidth + 100;
        const spacingY = textHeight + 80;
        for (let x = 50; x < width; x += spacingX) {
          for (let y = 50; y < height; y += spacingY) {
            page.drawText(text, {
              x,
              y,
              size: fontSize * 0.6,
              font,
              color: rgb(r, g, b),
              opacity,
            });
          }
        }
      } else {
        // Center
        page.drawText(text, {
          x: width / 2 - textWidth / 2,
          y: height / 2 - textHeight / 2,
          size: fontSize,
          font,
          color: rgb(r, g, b),
          opacity,
        });
      }
    }

    return await this.pdfLibDoc.save();
  }

  // ============ Header/Footer Methods ============

  /**
   * Apply headers and footers to PDF pages
   * @param {Object} config - Header/footer configuration
   * @returns {Uint8Array} Modified PDF bytes
   */
  async applyHeaderFooter(config) {
    if (!this.pdfLibDoc) throw new Error("No document loaded");

    const { header, footer, fontSize, color, margin } = config;

    // Parse color
    const r = parseInt(color.slice(1, 3), 16) / 255;
    const g = parseInt(color.slice(3, 5), 16) / 255;
    const b = parseInt(color.slice(5, 7), 16) / 255;

    const font = await this.pdfLibDoc.embedFont(StandardFonts.Helvetica);
    const pages = this.pdfLibDoc.getPages();
    const totalPages = pages.length;
    const today = new Date().toLocaleDateString();
    const filename = "Document"; // Could be enhanced with actual filename

    // Token replacement helper
    const replaceTokens = (text, pageNum) => {
      return text
        .replace(/\{page\}/g, pageNum.toString())
        .replace(/\{total\}/g, totalPages.toString())
        .replace(/\{date\}/g, today)
        .replace(/\{filename\}/g, filename);
    };

    pages.forEach((page, index) => {
      const { width, height } = page.getSize();
      const pageNum = index + 1;

      // Draw header
      if (header.enabled) {
        const y = height - margin;

        if (header.left) {
          page.drawText(replaceTokens(header.left, pageNum), {
            x: margin,
            y,
            size: fontSize,
            font,
            color: rgb(r, g, b),
          });
        }
        if (header.center) {
          const text = replaceTokens(header.center, pageNum);
          const textWidth = font.widthOfTextAtSize(text, fontSize);
          page.drawText(text, {
            x: (width - textWidth) / 2,
            y,
            size: fontSize,
            font,
            color: rgb(r, g, b),
          });
        }
        if (header.right) {
          const text = replaceTokens(header.right, pageNum);
          const textWidth = font.widthOfTextAtSize(text, fontSize);
          page.drawText(text, {
            x: width - margin - textWidth,
            y,
            size: fontSize,
            font,
            color: rgb(r, g, b),
          });
        }
      }

      // Draw footer
      if (footer.enabled) {
        const y = margin;

        if (footer.left) {
          page.drawText(replaceTokens(footer.left, pageNum), {
            x: margin,
            y,
            size: fontSize,
            font,
            color: rgb(r, g, b),
          });
        }
        if (footer.center) {
          const text = replaceTokens(footer.center, pageNum);
          const textWidth = font.widthOfTextAtSize(text, fontSize);
          page.drawText(text, {
            x: (width - textWidth) / 2,
            y,
            size: fontSize,
            font,
            color: rgb(r, g, b),
          });
        }
        if (footer.right) {
          const text = replaceTokens(footer.right, pageNum);
          const textWidth = font.widthOfTextAtSize(text, fontSize);
          page.drawText(text, {
            x: width - margin - textWidth,
            y,
            size: fontSize,
            font,
            color: rgb(r, g, b),
          });
        }
      }
    });

    return await this.pdfLibDoc.save();
  }

  // ============ Security/Encryption Methods ============

  /**
   * Encrypt PDF with password protection
   * @param {Object} config - Security configuration
   * @param {string} config.userPassword - Password to open document
   * @param {string} config.ownerPassword - Password to change permissions
   * @param {Object} config.permissions - Permission flags
   * @returns {Uint8Array} Encrypted PDF bytes
   */
  async encryptDocument(config) {
    if (!this.pdfLibDoc) throw new Error("No document loaded");

    const { userPassword, ownerPassword, permissions } = config;

    const encryptionOptions = {
      userPassword,
      ownerPassword: ownerPassword || userPassword,
      permissions: {
        printing: permissions.printing ? "highResolution" : "none",
        modifying: permissions.modifying,
        copying: permissions.copying,
        annotating: permissions.annotating,
        fillingForms: true,
        contentAccessibility: true,
        documentAssembly: permissions.modifying,
      },
    };

    // Create a new encrypted document
    const encryptedDoc = await PDFDocument.create();

    // Copy all pages to new document
    const pages = await encryptedDoc.copyPages(
      this.pdfLibDoc,
      this.pdfLibDoc.getPageIndices()
    );
    pages.forEach((page) => encryptedDoc.addPage(page));

    // Save with encryption
    return await encryptedDoc.save(encryptionOptions);
  }

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
