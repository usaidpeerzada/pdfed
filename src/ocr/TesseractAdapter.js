/**
 * TesseractAdapter
 * Wrapper around Tesseract.js for OCR processing.
 * Handles worker lifecycle, language loading, and result parsing.
 */
import { createWorker, createScheduler } from 'tesseract.js';

export class TesseractAdapter {
  constructor() {
    this.scheduler = null;
    this.workers = [];
    this.initialized = false;
    this.language = 'eng';
    this.numWorkers = 1; // Can be increased for batch processing
  }

  /**
   * Initialize Tesseract workers
   * @param {string} language - OCR language code (default: 'eng')
   * @param {number} numWorkers - Number of parallel workers
   */
  async initialize(language = 'eng', numWorkers = 1) {
    if (this.initialized) {
      await this.terminate();
    }

    this.language = language;
    this.numWorkers = numWorkers;
    this.scheduler = createScheduler();

    console.log(`pdfed: Initializing Tesseract with ${numWorkers} worker(s), language: ${language}`);

    for (let i = 0; i < numWorkers; i++) {
      // Remove OEM arg (1) to use default, which is safer
      const worker = await createWorker(language, undefined, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            this._onProgress?.(m.progress);
          }
        }
      });
      
      // Explicitly ensure HOCR and box info are generated
      await worker.setParameters({
        tessedit_create_hocr: '1',
        tessedit_create_tsv: '1',
        tessedit_create_box: '1',
        tessedit_pageseg_mode: '3', // PSM_AUTO
      });
      
      this.workers.push(worker);
      this.scheduler.addWorker(worker);
    }

    this.initialized = true;
    console.log('pdfed: Tesseract initialized successfully');
  }

  /**
   * Set progress callback
   * @param {Function} callback - Progress callback (0-1)
   */
  onProgress(callback) {
    this._onProgress = callback;
  }

  /**
   * Recognize text from image data
   * @param {HTMLCanvasElement|ImageData|string} image - Image source
   * @returns {Promise<OCRResult>} OCR result with text and word positions
   */
  async recognize(image) {
    if (!this.initialized) {
      await this.initialize(this.language);
    }

    try {
      // Tesseract.js v5 API:
      // scheduler.addJob('recognize', image, recognizeOptions, outputOptions)
      // outputOptions controls which data formats are generated
      const recognizeOptions = {}; // Can add rectangle cropping here if needed
      const outputOptions = {
        text: true,
        hocr: true,
        tsv: true,
        blocks: true,
        layoutBlocks: true,
      };
      
      console.log('pdfed: Running OCR with output options:', outputOptions);
      const result = await this.scheduler.addJob('recognize', image, recognizeOptions, outputOptions);
      return this._parseResult(result);
    } catch (error) {
      console.error('pdfed: OCR recognition failed:', error);
      throw error;
    }
  }

  /**
   * Parse Tesseract result into structured format
   * @param {Object} result - Raw Tesseract result
   * @returns {OCRResult}
   */
  /**
   * Parse Tesseract result into structured format
   * @param {Object} result - Raw Tesseract result
   * @returns {OCRResult}
   */
  _parseResult(result) {
    const { data } = result;
    
    // Debug log the structure and content availability
    console.log('pdfed: Tesseract Raw Data Check:', {
      textLength: data.text ? data.text.length : 0,
      wordsCount: data.words ? data.words.length : 0,
      lists: Object.keys(data).filter(k => Array.isArray(data[k])),
      hocrLength: data.hocr ? data.hocr.length : 0,
      tsvLength: data.tsv ? data.tsv.length : 0,
      boxLength: data.box ? data.box.length : 0
    });

    let words = [];
    let lines = [];
    let paragraphs = [];

    // Strategy 1: Top-level arrays (Std)
    if (data.words && data.words.length > 0) {
      words = data.words.map(this._mapWord);
      lines = (data.lines || []).map(line => this._mapLine(line));
      paragraphs = (data.paragraphs || []).map(para => this._mapParagraph(para));
    } 
    // Strategy 2: Nested blocks
    else if (data.blocks && data.blocks.length > 0) {
      console.log('pdfed: Parsing nested blocks structure...');
      for (const block of data.blocks) {
        if (block.paragraphs) {
          for (const para of block.paragraphs) {
            paragraphs.push(this._mapParagraph(para));
            if (para.lines) {
              for (const line of para.lines) {
                lines.push(this._mapLine(line));
                if (line.words) {
                  for (const word of line.words) {
                     words.push(this._mapWord(word));
                  }
                }
              }
            }
          }
        }
      }
    }
    // Strategy 3: HOCR Fallback
    else if (data.hocr && data.hocr.length > 0) {
      console.log('pdfed: Objects missing, falling back to HOCR parsing...');
      const hocrResult = this._parseHOCR(data.hocr);
      if (hocrResult.words.length > 0) {
        words = hocrResult.words;
        console.log(`pdfed: HOCR fallback recovered ${words.length} words`);
      }
    }
    // Strategy 4: TSV Fallback (Raw Data)
    else if (data.tsv && data.tsv.length > 0) {
      console.log('pdfed: HOCR missing, falling back to TSV parsing...');
      const tsvResult = this._parseTSV(data.tsv);
      if (tsvResult.words.length > 0) {
        words = tsvResult.words;
        console.log(`pdfed: TSV fallback recovered ${words.length} words`);
      }
    }

    console.log(`pdfed: Final Parse: ${words.length} words, ${lines.length} lines, ${paragraphs.length} paragraphs`);

    return {
      text: data.text || '',
      confidence: data.confidence || 0,
      words,
      lines,
      paragraphs
    };
  }

  /**
   * Parse TSV string to extract words and bounds
   * TSV Format: level page_num block_num par_num line_num word_num left top width height conf text
   * Level 5 = Word
   */
  _parseTSV(tsv) {
    const words = [];
    const rows = tsv.trim().split('\n');
    
    // Skip header row
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i].split('\t');
        if (row.length < 12) continue;
        
        const level = parseInt(row[0], 10);
        // Level 5 is word
        if (level === 5) {
            const conf = parseInt(row[10], 10);
            const text = row[11]; // Text is the last column (index 11)
            
            // Skip low confidence garbage or empty text
            if (conf > 0 && text && text.trim()) {
                words.push({
                    text: text.trim(),
                    confidence: conf,
                    bounds: {
                        x: parseInt(row[6], 10),
                        y: parseInt(row[7], 10),
                        width: parseInt(row[8], 10),
                        height: parseInt(row[9], 10)
                    },
                    baseline: null
                });
            }
        }
    }
    return { words };
  }

  /**
   * Parse HOCR string to extract words and bounds using DOMParser
   * @param {string} hocr - HOCR HTML string
   * @returns {Object} { words: [] }
   */
  _parseHOCR(hocr) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(hocr, 'text/html');
      const wordElements = doc.querySelectorAll('.ocrx_word');
      const words = [];

      wordElements.forEach(el => {
        const title = el.getAttribute('title');
        const text = el.textContent;
        
        if (!title || !text || !text.trim()) return;

        // Parse title="bbox 100 200 150 220; x_wconf 95"
        const bboxMatch = title.match(/bbox (\d+) (\d+) (\d+) (\d+)/);
        const confMatch = title.match(/x_wconf (\d+)/);

        if (bboxMatch) {
          const x0 = parseInt(bboxMatch[1], 10);
          const y0 = parseInt(bboxMatch[2], 10);
          const x1 = parseInt(bboxMatch[3], 10);
          const y1 = parseInt(bboxMatch[4], 10);
          const confidence = confMatch ? parseInt(confMatch[1], 10) : 0;

          words.push({
            text: text,
            confidence: confidence,
            bounds: {
              x: x0,
              y: y0,
              width: x1 - x0,
              height: y1 - y0
            },
            baseline: null
          });
        }
      });

      return { words };
    } catch (e) {
      console.error("pdfed: HOCR DOM parsing failed", e);
      return { words: [] };
    }
  }

  _mapWord(word) {
    return {
      text: word.text || '',
      confidence: word.confidence || 0,
      bounds: word.bbox ? {
        x: word.bbox.x0 || 0,
        y: word.bbox.y0 || 0,
        width: (word.bbox.x1 || 0) - (word.bbox.x0 || 0),
        height: (word.bbox.y1 || 0) - (word.bbox.y0 || 0)
      } : { x: 0, y: 0, width: 0, height: 0 },
      baseline: word.baseline
    };
  }

  _mapLine(line) {
    return {
      text: line.text || '',
      confidence: line.confidence || 0,
      bounds: line.bbox ? {
        x: line.bbox.x0 || 0,
        y: line.bbox.y0 || 0,
        width: (line.bbox.x1 || 0) - (line.bbox.x0 || 0),
        height: (line.bbox.y1 || 0) - (line.bbox.y0 || 0)
      } : { x: 0, y: 0, width: 0, height: 0 },
      words: (line.words || []).map(w => w.text || '')
    };
  }

  _mapParagraph(para) {
    return {
      text: para.text || '',
      confidence: para.confidence || 0,
      bounds: para.bbox ? {
        x: para.bbox.x0 || 0,
        y: para.bbox.y0 || 0,
        width: (para.bbox.x1 || 0) - (para.bbox.x0 || 0),
        height: (para.bbox.y1 || 0) - (para.bbox.y0 || 0)
      } : { x: 0, y: 0, width: 0, height: 0 }
    };
  }

  /**
   * Terminate all workers
   */
  async terminate() {
    if (this.scheduler) {
      await this.scheduler.terminate();
    }
    this.workers = [];
    this.scheduler = null;
    this.initialized = false;
    console.log('pdfed: Tesseract workers terminated');
  }

  /**
   * Get supported languages
   * @returns {Array<{code: string, name: string}>}
   */
  static getSupportedLanguages() {
    return [
      { code: 'eng', name: 'English' },
      { code: 'spa', name: 'Spanish' },
      { code: 'fra', name: 'French' },
      { code: 'deu', name: 'German' },
      { code: 'ita', name: 'Italian' },
      { code: 'por', name: 'Portuguese' },
      { code: 'rus', name: 'Russian' },
      { code: 'jpn', name: 'Japanese' },
      { code: 'chi_sim', name: 'Chinese (Simplified)' },
      { code: 'chi_tra', name: 'Chinese (Traditional)' },
      { code: 'kor', name: 'Korean' },
      { code: 'ara', name: 'Arabic' },
      { code: 'hin', name: 'Hindi' },
    ];
  }
}
