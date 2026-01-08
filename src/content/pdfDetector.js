// pdfed - PDF Detection Utility
// Detects if current page is a PDF document

export class PDFDetector {
  constructor() {
    this.pdfIndicators = {
      urlPatterns: [/\.pdf($|\?|#)/i],
      mimeTypes: ['application/pdf'],
      embedTypes: ['application/pdf', 'application/x-pdf']
    };
  }

  /**
   * Check if current page is a PDF
   * @returns {boolean}
   */
  isPDFPage() {
    return (
      this.checkURL() ||
      this.checkContentType() ||
      this.checkEmbeddedPDF() ||
      this.checkPDFViewer()
    );
  }

  /**
   * Check URL for PDF extension
   */
  checkURL() {
    const url = window.location.href;
    return this.pdfIndicators.urlPatterns.some(pattern => pattern.test(url));
  }

  /**
   * Check document content type
   */
  checkContentType() {
    // Check if browser's built-in PDF viewer is active
    const contentType = document.contentType;
    return this.pdfIndicators.mimeTypes.includes(contentType);
  }

  /**
   * Check for embedded PDF elements
   */
  checkEmbeddedPDF() {
    // Check for embed or object elements with PDF
    const embeds = document.querySelectorAll('embed[type="application/pdf"], object[type="application/pdf"]');
    if (embeds.length > 0) return true;

    // Check for iframe with PDF
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      if (iframe.src && this.pdfIndicators.urlPatterns.some(p => p.test(iframe.src))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check for browser's built-in PDF viewer
   */
  checkPDFViewer() {
    // Chrome's PDF viewer creates a specific structure
    const chromeViewer = document.querySelector('embed[type="application/pdf"]');
    if (chromeViewer) return true;

    // Firefox PDF.js viewer
    const firefoxViewer = document.getElementById('viewer') && 
                          document.querySelector('.pdfViewer');
    if (firefoxViewer) return true;

    // Check for PDF.js viewer container
    const pdfJsViewer = document.getElementById('viewerContainer');
    if (pdfJsViewer) return true;

    return false;
  }

  /**
   * Get the PDF source URL
   * @returns {string|null}
   */
  getPDFSource() {
    // Direct PDF URL
    if (this.checkURL()) {
      return window.location.href;
    }

    // Embedded PDF
    const embed = document.querySelector('embed[type="application/pdf"]');
    if (embed) {
      return embed.src || window.location.href;
    }

    // Object element
    const obj = document.querySelector('object[type="application/pdf"]');
    if (obj) {
      return obj.data || window.location.href;
    }

    return window.location.href;
  }
}
