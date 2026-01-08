// pdfed - PDFEngine Tests
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock PDF.js and pdf-lib for unit tests
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(() => ({
    promise: Promise.resolve({
      numPages: 2,
      getPage: vi.fn(() => Promise.resolve({
        getViewport: vi.fn(() => ({ width: 612, height: 792 })),
        render: vi.fn(() => ({ promise: Promise.resolve() }))
      })),
      destroy: vi.fn()
    })
  }))
}));

vi.mock('pdf-lib', () => ({
  PDFDocument: {
    load: vi.fn(() => Promise.resolve({
      getPage: vi.fn(() => ({
        getHeight: () => 792,
        getWidth: () => 612,
        drawText: vi.fn(),
        drawImage: vi.fn(),
        drawRectangle: vi.fn(),
        drawLine: vi.fn(),
        getRotation: () => ({ angle: 0 }),
        setRotation: vi.fn()
      })),
      getPages: vi.fn(() => [{}]),
      embedFont: vi.fn(() => Promise.resolve({})),
      embedPng: vi.fn(() => Promise.resolve({})),
      embedJpg: vi.fn(() => Promise.resolve({})),
      removePage: vi.fn(),
      save: vi.fn(() => Promise.resolve(new Uint8Array([1, 2, 3])))
    }))
  },
  rgb: vi.fn((r, g, b) => ({ r, g, b })),
  StandardFonts: { Helvetica: 'Helvetica' }
}));

// Mock chrome API
global.chrome = {
  runtime: {
    getURL: (path) => `chrome-extension://test/${path}`
  }
};

describe('PDFEngine', () => {
  let PDFEngine;
  let engine;

  beforeEach(async () => {
    // Dynamic import to allow mocks to be set up first
    const module = await import('../../src/core/PDFEngine.js');
    PDFEngine = module.PDFEngine;
    engine = new PDFEngine();
  });

  describe('initialization', () => {
    it('should create engine with default state', () => {
      expect(engine.pdfJsDoc).toBeNull();
      expect(engine.pdfLibDoc).toBeNull();
      expect(engine.currentPage).toBe(1);
      expect(engine.scale).toBe(1.5);
      expect(engine.mode).toBe('select');
    });

    it('should detect PDF source from URL', () => {
      // Mock window.location
      const originalLocation = window.location;
      delete window.location;
      window.location = { href: 'https://example.com/document.pdf' };
      
      const source = engine.detectPDFSource();
      expect(source).toBe('https://example.com/document.pdf');
      
      window.location = originalLocation;
    });
  });

  describe('document loading', () => {
    it('should load PDF from bytes', async () => {
      const mockBytes = new Uint8Array([37, 80, 68, 70]); // %PDF
      await engine.loadDocument(mockBytes);
      
      expect(engine.pdfJsDoc).not.toBeNull();
      expect(engine.pdfLibDoc).not.toBeNull();
      expect(engine.totalPages).toBe(2);
    });
  });

  describe('editing operations', () => {
    beforeEach(async () => {
      const mockBytes = new Uint8Array([37, 80, 68, 70]);
      await engine.loadDocument(mockBytes);
    });

    it('should add text annotation', async () => {
      const result = await engine.addText(1, 'Hello World', 100, 200, {
        size: 16,
        color: { r: 0, g: 0, b: 0 }
      });
      
      expect(result).toBe(true);
      expect(engine.annotations).toHaveLength(1);
      expect(engine.annotations[0].type).toBe('text');
    });

    it('should add rectangle (highlight)', async () => {
      const result = await engine.addRectangle(1, 50, 100, 200, 30, {
        color: { r: 1, g: 1, b: 0 },
        opacity: 0.5
      });
      
      expect(result).toBe(true);
      expect(engine.annotations).toHaveLength(1);
      expect(engine.annotations[0].type).toBe('rectangle');
    });

    it('should add line (underline)', async () => {
      const result = await engine.addLine(1, 50, 150, 250, 150, {
        color: { r: 1, g: 0, b: 0 },
        thickness: 2
      });
      
      expect(result).toBe(true);
      expect(engine.annotations).toHaveLength(1);
      expect(engine.annotations[0].type).toBe('line');
    });
  });

  describe('page operations', () => {
    beforeEach(async () => {
      const mockBytes = new Uint8Array([37, 80, 68, 70]);
      await engine.loadDocument(mockBytes);
    });

    it('should rotate page', () => {
      // Just verify the method doesn't throw
      expect(() => engine.rotatePage(1, 90)).not.toThrow();
    });

    it('should delete page', () => {
      const initialPages = engine.totalPages;
      engine.deletePage(1);
      expect(engine.totalPages).toBe(initialPages - 1);
    });
  });

  describe('mode switching', () => {
    it('should switch to text mode', () => {
      engine.enableTextMode();
      expect(engine.mode).toBe('text');
    });

    it('should switch to highlight mode', () => {
      engine.enableHighlightMode();
      expect(engine.mode).toBe('highlight');
    });

    it('should switch to draw mode', () => {
      engine.enableDrawMode();
      expect(engine.mode).toBe('draw');
    });

    it('should switch to select mode', () => {
      engine.enableSelectMode();
      expect(engine.mode).toBe('select');
    });
  });

  describe('save functionality', () => {
    beforeEach(async () => {
      const mockBytes = new Uint8Array([37, 80, 68, 70]);
      await engine.loadDocument(mockBytes);
    });

    it('should save modified PDF', async () => {
      await engine.addText(1, 'Test', 100, 100);
      const savedBytes = await engine.save();
      
      expect(savedBytes).toBeInstanceOf(Uint8Array);
      expect(savedBytes.length).toBeGreaterThan(0);
    });

    it('should throw error when saving without document', async () => {
      const emptyEngine = new PDFEngine();
      await expect(emptyEngine.save()).rejects.toThrow('No PDF document loaded');
    });
  });

  describe('cleanup', () => {
    it('should clean up resources on destroy', async () => {
      const mockBytes = new Uint8Array([37, 80, 68, 70]);
      await engine.loadDocument(mockBytes);
      
      engine.destroy();
      
      expect(engine.pdfJsDoc).toBeNull();
      expect(engine.pdfLibDoc).toBeNull();
      expect(engine.annotations).toHaveLength(0);
    });
  });
});
