/**
 * OCRService
 * Main orchestrator for OCR operations.
 * Handles page detection, processing queue, caching, and integration with PDF viewer.
 */
import { TesseractAdapter } from './TesseractAdapter.js';

// Page type constants
export const PageType = {
  NATIVE: 'native',      // Has embedded text layer
  SCANNED: 'scanned',    // Image-only, needs OCR
  MIXED: 'mixed',        // Has some text + some images
  EMPTY: 'empty'         // No content
};

// OCR status constants
export const OCRStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CACHED: 'cached'
};

export class OCRService {
  constructor() {
    this.adapter = new TesseractAdapter();
    this.cache = new Map(); // pageKey -> OCRResult
    this.pageTypes = new Map(); // pageNum -> PageType
    this.status = new Map(); // pageNum -> OCRStatus
    this.language = 'eng';
    
    // Callbacks
    this._onProgress = null;
    this._onStatusChange = null;
  }

  /**
   * Set OCR language
   * @param {string} langCode - Language code (e.g., 'eng', 'spa')
   */
  async setLanguage(langCode) {
    this.language = langCode;
    await this.adapter.initialize(langCode);
  }

  /**
   * Set progress callback
   * @param {Function} callback - (pageNum, progress) => void
   */
  onProgress(callback) {
    this._onProgress = callback;
    this.adapter.onProgress((progress) => {
      if (this._currentPage) {
        callback(this._currentPage, progress);
      }
    });
  }

  /**
   * Set status change callback
   * @param {Function} callback - (pageNum, status) => void
   */
  onStatusChange(callback) {
    this._onStatusChange = callback;
  }

  /**
   * Analyze a PDF page to determine if it needs OCR
   * @param {PDFPageProxy} page - PDF.js page object
   * @param {number} pageNum - Page number
   * @returns {Promise<PageType>}
   */
  async analyzePage(page, pageNum) {
    try {
      // Get text content
      const textContent = await page.getTextContent();
      const textItems = textContent.items.filter(item => item.str.trim().length > 0);
      
      // Get operator list to check for images
      const ops = await page.getOperatorList();
      const imageOps = [85, 86, 87, 88, 89]; // OPS.paintImageXObject, etc.
      const hasImages = ops.fnArray.some(op => imageOps.includes(op));
      
      let pageType;
      
      if (textItems.length > 10) {
        // Has substantial text
        pageType = hasImages ? PageType.MIXED : PageType.NATIVE;
      } else if (hasImages) {
        // Has images but no/little text - likely scanned
        pageType = PageType.SCANNED;
      } else {
        pageType = PageType.EMPTY;
      }
      
      this.pageTypes.set(pageNum, pageType);
      console.log(`pdfed: Page ${pageNum} detected as: ${pageType}`);
      
      return pageType;
    } catch (error) {
      console.error(`pdfed: Failed to analyze page ${pageNum}:`, error);
      return PageType.NATIVE; // Fallback
    }
  }

  /**
   * Check if a page needs OCR
   * @param {number} pageNum - Page number
   * @returns {boolean}
   */
  needsOCR(pageNum) {
    const type = this.pageTypes.get(pageNum);
    return type === PageType.SCANNED || type === PageType.MIXED;
  }

  /**
   * Process a single page with OCR
   * @param {HTMLCanvasElement} canvas - Rendered page canvas
   * @param {number} pageNum - Page number
   * @returns {Promise<OCRResult>}
   */
  async processPage(canvas, pageNum) {
    const cacheKey = this._getCacheKey(pageNum);
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      this._setStatus(pageNum, OCRStatus.CACHED);
      return this.cache.get(cacheKey);
    }
    
    this._currentPage = pageNum;
    this._setStatus(pageNum, OCRStatus.PROCESSING);
    
    try {
      // Initialize adapter if needed
      if (!this.adapter.initialized) {
        await this.adapter.initialize(this.language);
      }
      
      // Run OCR
      const result = await this.adapter.recognize(canvas);
      
      // Cache result
      this.cache.set(cacheKey, result);
      this._setStatus(pageNum, OCRStatus.COMPLETED);
      
      console.log(`pdfed: OCR completed for page ${pageNum}, found ${result.words.length} words`);
      
      return result;
    } catch (error) {
      this._setStatus(pageNum, OCRStatus.FAILED);
      throw error;
    } finally {
      this._currentPage = null;
    }
  }

  /**
   * Process multiple pages
   * @param {Array<{canvas: HTMLCanvasElement, pageNum: number}>} pages
   * @returns {Promise<Map<number, OCRResult>>}
   */
  async processPages(pages) {
    const results = new Map();
    
    for (const { canvas, pageNum } of pages) {
      try {
        const result = await this.processPage(canvas, pageNum);
        results.set(pageNum, result);
      } catch (error) {
        console.error(`pdfed: Failed to process page ${pageNum}:`, error);
      }
    }
    
    return results;
  }

  /**
   * Get OCR result for a page
   * @param {number} pageNum
   * @returns {OCRResult|null}
   */
  getResult(pageNum) {
    return this.cache.get(this._getCacheKey(pageNum)) || null;
  }

  /**
   * Get status of a page
   * @param {number} pageNum
   * @returns {OCRStatus}
   */
  getStatus(pageNum) {
    return this.status.get(pageNum) || OCRStatus.PENDING;
  }

  /**
   * Clear cache for a page
   * @param {number} pageNum
   */
  clearPage(pageNum) {
    this.cache.delete(this._getCacheKey(pageNum));
    this.status.delete(pageNum);
  }

  /**
   * Clear all cache
   */
  clearAll() {
    this.cache.clear();
    this.status.clear();
    this.pageTypes.clear();
  }

  /**
   * Get cache statistics
   * @returns {{cached: number, total: number}}
   */
  getCacheStats() {
    return {
      cached: this.cache.size,
      total: this.pageTypes.size
    };
  }

  /**
   * Terminate OCR service
   */
  async terminate() {
    await this.adapter.terminate();
    this.clearAll();
  }

  // Private methods
  _getCacheKey(pageNum) {
    return `page_${pageNum}_${this.language}`;
  }

  _setStatus(pageNum, status) {
    this.status.set(pageNum, status);
    this._onStatusChange?.(pageNum, status);
  }
}

// Singleton instance
let _instance = null;

/**
 * Get OCR service singleton
 * @returns {OCRService}
 */
export function getOCRService() {
  if (!_instance) {
    _instance = new OCRService();
  }
  return _instance;
}
