import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CanvasLayer } from '../../src/core/CanvasLayer';

describe('CanvasLayer', () => {
  let container;
  let canvasLayer;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    container = document.getElementById('app');
    // Mock onAnnotationComplete
    canvasLayer = new CanvasLayer(container, vi.fn());
  });

  describe('initialization', () => {
    it('should create a global canvas if no pages found', () => {
      expect(canvasLayer.isMultiPage).toBe(false);
      expect(canvasLayer.canvas).toBeTruthy();
      expect(container.contains(canvasLayer.canvas)).toBe(true);
    });

    it('should detect pages and create per-page canvases', () => {
      // Setup DOM with pages
      document.body.innerHTML = `
        <div id="viewer">
            <div class="page" data-page-number="1" style="width: 100px; height: 100px;"></div>
            <div class="page" data-page-number="2" style="width: 100px; height: 100px;"></div>
        </div>
      `;
      const viewer = document.getElementById('viewer');
      
      // Mock clientHeight for JSDOM
      const pages = document.querySelectorAll('.page');
      pages.forEach(p => {
        Object.defineProperty(p, 'clientHeight', { value: 100, configurable: true });
        Object.defineProperty(p, 'clientWidth', { value: 100, configurable: true });
      });
      
      // Re-init
      canvasLayer = new CanvasLayer(viewer, vi.fn());
      
      // Wait for Hunter or force init
      canvasLayer._createCanvases();
      
      expect(canvasLayer.isMultiPage).toBe(true);
      expect(canvasLayer.canvases.size).toBe(2);
      expect(canvasLayer.canvases.has(1)).toBe(true);
      expect(canvasLayer.canvases.has(2)).toBe(true);
    });
  });

  describe('coordinate conversion', () => {
    it('should return correct screen coordinates from page coordinates', () => {
        // Mock a single page logic for simplicity
        canvasLayer.isMultiPage = false;
        canvasLayer._createGlobalCanvas();
        
        // Mock getBoundingClientRect
        vi.spyOn(canvasLayer.canvas, 'getBoundingClientRect').mockReturnValue({
            left: 10, top: 20, width: 100, height: 100
        });

        const point = { x: 50, y: 50, pageNum: 1 };
        const screen = canvasLayer._getScreenFromPage(point);
        
        expect(screen.x).toBe(60); // 10 + 50
        expect(screen.y).toBe(70); // 20 + 50
    });
  });
});
