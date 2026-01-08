// pdfed - Test Setup
// Global setup for all tests

import { vi } from 'vitest';

// Mock chrome extension API
global.chrome = {
  runtime: {
    id: 'test-extension-id',
    getURL: (path) => `chrome-extension://test/${path}`,
    sendMessage: vi.fn(() => Promise.resolve({})),
    onMessage: {
      addListener: vi.fn()
    },
    lastError: null
  },
  tabs: {
    sendMessage: vi.fn(() => Promise.resolve({})),
    query: vi.fn(() => Promise.resolve([])),
    onRemoved: {
      addListener: vi.fn()
    }
  },
  action: {
    onClicked: {
      addListener: vi.fn()
    }
  },
  scripting: {
    executeScript: vi.fn(() => Promise.resolve())
  },
  storage: {
    local: {
      get: vi.fn(() => Promise.resolve({})),
      set: vi.fn(() => Promise.resolve())
    }
  }
};

// Mock browser API (Firefox)
global.browser = global.chrome;

// Mock fetch for PDF loading
global.fetch = vi.fn(() =>
  Promise.resolve({
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    ok: true
  })
);

// Mock URL APIs
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

// Mock document.contentType
Object.defineProperty(document, 'contentType', {
  value: 'text/html',
  writable: true
});

// Console spy to catch errors during tests
const originalError = console.error;
console.error = (...args) => {
  // Suppress expected errors in tests
  if (args[0]?.includes?.('pdfed')) {
    return;
  }
  originalError.apply(console, args);
};
