// pdfed - StateManager Tests
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StateManager } from '../../src/core/StateManager.js';

// Mock chrome storage API
global.chrome = {
  storage: {
    local: {
      get: vi.fn(() => Promise.resolve({})),
      set: vi.fn(() => Promise.resolve())
    }
  }
};

describe('StateManager', () => {
  let state;

  beforeEach(() => {
    state = new StateManager();
  });

  describe('initialization', () => {
    it('should initialize with default state', () => {
      expect(state.get('activeTool')).toBe('select');
      expect(state.get('activeColor')).toBe('#000000');
      expect(state.get('fontSize')).toBe(16);
      expect(state.get('currentPage')).toBe(1);
      expect(state.get('isModified')).toBe(false);
    });

    it('should return full state when no key specified', () => {
      const fullState = state.get();
      expect(fullState).toHaveProperty('activeTool');
      expect(fullState).toHaveProperty('activeColor');
      expect(fullState).toHaveProperty('fontSize');
    });
  });

  describe('state updates', () => {
    it('should update single value', () => {
      state.set({ activeTool: 'text' });
      expect(state.get('activeTool')).toBe('text');
    });

    it('should update multiple values', () => {
      state.set({ fontSize: 24, activeColor: '#ff0000' });
      expect(state.get('fontSize')).toBe(24);
      expect(state.get('activeColor')).toBe('#ff0000');
    });

    it('should mark as modified after update', () => {
      state.set({ activeTool: 'draw' });
      expect(state.get('isModified')).toBe(true);
    });

    it('should set active tool via convenience method', () => {
      state.setActiveTool('highlight');
      expect(state.get('activeTool')).toBe('highlight');
    });
  });

  describe('undo/redo', () => {
    it('should not undo when no history', () => {
      const result = state.undo();
      expect(result).toBe(false);
    });

    it('should undo state change', () => {
      state.set({ fontSize: 24 }, true);
      state.set({ fontSize: 32 }, true);
      
      state.undo();
      expect(state.get('fontSize')).toBe(24);
    });

    it('should redo undone change', () => {
      state.set({ fontSize: 24 }, true);
      state.set({ fontSize: 32 }, true);
      
      state.undo();
      state.redo();
      expect(state.get('fontSize')).toBe(32);
    });

    it('should report undo availability correctly', () => {
      expect(state.canUndo()).toBe(false);
      
      state.set({ fontSize: 24 }, true);
      expect(state.canUndo()).toBe(true);
    });

    it('should report redo availability correctly', () => {
      expect(state.canRedo()).toBe(false);
      
      state.set({ fontSize: 24 }, true);
      state.undo();
      expect(state.canRedo()).toBe(true);
    });

    it('should limit history size', () => {
      for (let i = 0; i < 60; i++) {
        state.set({ fontSize: i }, true);
      }
      
      expect(state.history.length).toBeLessThanOrEqual(51); // maxHistory + 1 for current
    });
  });

  describe('subscriptions', () => {
    it('should notify listeners on state change', () => {
      const callback = vi.fn();
      state.subscribe('fontSize', callback);
      
      state.set({ fontSize: 32 });
      
      expect(callback).toHaveBeenCalledWith(32, 'fontSize', expect.any(Object));
    });

    it('should notify global listeners', () => {
      const callback = vi.fn();
      state.subscribe('*', callback);
      
      state.set({ fontSize: 32 });
      
      expect(callback).toHaveBeenCalled();
    });

    it('should unsubscribe correctly', () => {
      const callback = vi.fn();
      const unsubscribe = state.subscribe('fontSize', callback);
      
      unsubscribe();
      state.set({ fontSize: 32 });
      
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      state.set({ fontSize: 48, activeColor: '#00ff00' });
      state.reset();
      
      expect(state.get('fontSize')).toBe(16);
      expect(state.get('activeColor')).toBe('#000000');
      expect(state.get('isModified')).toBe(false);
    });

    it('should clear history on reset', () => {
      state.set({ fontSize: 24 }, true);
      state.set({ fontSize: 32 }, true);
      state.reset();
      
      expect(state.history).toHaveLength(0);
      expect(state.historyIndex).toBe(-1);
    });
  });

  describe('persistence', () => {
    it('should persist state to storage', async () => {
      state.set({ fontSize: 24 });
      await state.persist();
      
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        pdfedState: expect.objectContaining({ fontSize: 24 })
      });
    });

    it('should load state from storage', async () => {
      chrome.storage.local.get = vi.fn(() => 
        Promise.resolve({ pdfedState: { fontSize: 36 } })
      );
      
      await state.load();
      expect(state.get('fontSize')).toBe(36);
    });

    it('should handle storage errors gracefully', async () => {
      chrome.storage.local.set = vi.fn(() => Promise.reject(new Error('Storage error')));
      
      // Should not throw
      await expect(state.persist()).resolves.not.toThrow();
    });
  });
});
