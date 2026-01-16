/**
 * OCRCache
 * IndexedDB-based caching system for OCR results and edits.
 * Speeds up re-processing by caching recognized text and user edits.
 */

const DB_NAME = 'pdfed-ocr-cache';
const DB_VERSION = 1;
const STORE_RESULTS = 'ocr-results';
const STORE_EDITS = 'ocr-edits';

class OCRCache {
  constructor() {
    this.db = null;
    this._initPromise = null;
  }

  /**
   * Initialize IndexedDB connection
   */
  async init() {
    if (this.db) return this.db;
    if (this._initPromise) return this._initPromise;

    this._initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('pdfed: OCRCache IndexedDB error:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('pdfed: OCRCache initialized');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Store for OCR results: keyed by document hash + page number
        if (!db.objectStoreNames.contains(STORE_RESULTS)) {
          const resultsStore = db.createObjectStore(STORE_RESULTS, { keyPath: 'id' });
          resultsStore.createIndex('docHash', 'docHash', { unique: false });
          resultsStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Store for user edits: keyed by document hash + page number
        if (!db.objectStoreNames.contains(STORE_EDITS)) {
          const editsStore = db.createObjectStore(STORE_EDITS, { keyPath: 'id' });
          editsStore.createIndex('docHash', 'docHash', { unique: false });
        }

        console.log('pdfed: OCRCache database created');
      };
    });

    return this._initPromise;
  }

  /**
   * Generate a cache key for a page
   */
  _makeKey(docHash, pageNum) {
    return `${docHash}_page${pageNum}`;
  }

  /**
   * Cache OCR result for a page
   */
  async cacheResult(docHash, pageNum, result) {
    await this.init();
    
    const id = this._makeKey(docHash, pageNum);
    const record = {
      id,
      docHash,
      pageNum,
      result,
      timestamp: Date.now()
    };

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_RESULTS, 'readwrite');
      const store = tx.objectStore(STORE_RESULTS);
      const request = store.put(record);
      
      request.onsuccess = () => {
        console.log(`pdfed: Cached OCR result for page ${pageNum}`);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get cached OCR result for a page
   */
  async getResult(docHash, pageNum) {
    await this.init();
    
    const id = this._makeKey(docHash, pageNum);
    
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_RESULTS, 'readonly');
      const store = tx.objectStore(STORE_RESULTS);
      const request = store.get(id);
      
      request.onsuccess = () => {
        if (request.result) {
          console.log(`pdfed: Cache hit for page ${pageNum}`);
          resolve(request.result.result);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save user edits for a page
   */
  async saveEdits(docHash, pageNum, edits) {
    await this.init();
    
    const id = this._makeKey(docHash, pageNum);
    const record = {
      id,
      docHash,
      pageNum,
      edits,
      timestamp: Date.now()
    };

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_EDITS, 'readwrite');
      const store = tx.objectStore(STORE_EDITS);
      const request = store.put(record);
      
      request.onsuccess = () => {
        console.log(`pdfed: Saved ${edits.length} edits for page ${pageNum}`);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get saved edits for a page
   */
  async getEdits(docHash, pageNum) {
    await this.init();
    
    const id = this._makeKey(docHash, pageNum);
    
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_EDITS, 'readonly');
      const store = tx.objectStore(STORE_EDITS);
      const request = store.get(id);
      
      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result.edits);
        } else {
          resolve([]);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all edits for a document
   */
  async getAllEditsForDocument(docHash) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_EDITS, 'readonly');
      const store = tx.objectStore(STORE_EDITS);
      const index = store.index('docHash');
      const request = index.getAll(docHash);
      
      request.onsuccess = () => {
        const allEdits = [];
        for (const record of request.result) {
          for (const edit of record.edits) {
            allEdits.push({ ...edit, pageNum: record.pageNum });
          }
        }
        resolve(allEdits);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear cache for a document
   */
  async clearDocument(docHash) {
    await this.init();
    
    // Clear results
    await this._clearStoreByDocHash(STORE_RESULTS, docHash);
    // Clear edits
    await this._clearStoreByDocHash(STORE_EDITS, docHash);
    
    console.log(`pdfed: Cleared cache for document`);
  }

  async _clearStoreByDocHash(storeName, docHash) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const index = store.index('docHash');
      const request = index.getAllKeys(docHash);
      
      request.onsuccess = () => {
        for (const key of request.result) {
          store.delete(key);
        }
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear old cache entries (older than maxAge in ms)
   */
  async clearOldEntries(maxAge = 7 * 24 * 60 * 60 * 1000) { // 7 days default
    await this.init();
    
    const cutoff = Date.now() - maxAge;
    
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_RESULTS, 'readwrite');
      const store = tx.objectStore(STORE_RESULTS);
      const index = store.index('timestamp');
      const range = IDBKeyRange.upperBound(cutoff);
      const request = index.openCursor(range);
      
      let deletedCount = 0;
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          console.log(`pdfed: Cleared ${deletedCount} old cache entries`);
          resolve(deletedCount);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }
}

// Singleton instance
let _cacheInstance = null;

export function getOCRCache() {
  if (!_cacheInstance) {
    _cacheInstance = new OCRCache();
  }
  return _cacheInstance;
}

export { OCRCache };
