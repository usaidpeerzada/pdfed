// pdfed - State Manager
// Centralized state management with undo/redo support

export class StateManager {
  constructor() {
    this.state = {
      activeTool: 'select',
      activeColor: '#000000',
      highlightColor: '#ffff00',
      fontSize: 16,
      strokeWidth: 2,
      opacity: 1,
      currentPage: 1,
      totalPages: 0,
      zoom: 100,
      selection: null,
      isModified: false
    };
    
    this.history = [];
    this.historyIndex = -1;
    this.maxHistory = 50;
    this.listeners = new Map();
  }

  /**
   * Get current state or a specific key
   * @param {string} key - Optional state key
   */
  get(key) {
    if (key) {
      return this.state[key];
    }
    return { ...this.state };
  }

  /**
   * Update state
   * @param {object} updates - Key-value pairs to update
   * @param {boolean} addToHistory - Whether to add to undo history
   */
  set(updates, addToHistory = false) {
    const prevState = { ...this.state };
    
    this.state = {
      ...this.state,
      ...updates,
      isModified: true
    };

    if (addToHistory) {
      this.addToHistory(prevState);
    }

    this.notifyListeners(updates);
  }

  /**
   * Set active tool
   * @param {string} toolId - Tool identifier
   */
  setActiveTool(toolId) {
    this.set({ activeTool: toolId });
  }

  /**
   * Add entry to history for undo
   * @param {object} prevState - Previous state
   */
  addToHistory(prevState) {
    // Remove any redo history
    this.history = this.history.slice(0, this.historyIndex + 1);
    
    this.history.push({
      timestamp: Date.now(),
      state: prevState
    });

    // Limit history size
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    } else {
      this.historyIndex++;
    }
  }

  /**
   * Undo last action
   */
  undo() {
    if (this.historyIndex < 0) {
      console.log('pdfed: Nothing to undo');
      return false;
    }

    const previousEntry = this.history[this.historyIndex];
    
    // Save current for redo
    if (this.historyIndex === this.history.length - 1) {
      this.history.push({
        timestamp: Date.now(),
        state: { ...this.state }
      });
    }

    this.state = { ...previousEntry.state };
    this.historyIndex--;
    
    this.notifyListeners({ _undo: true });
    return true;
  }

  /**
   * Redo last undone action
   */
  redo() {
    if (this.historyIndex >= this.history.length - 2) {
      console.log('pdfed: Nothing to redo');
      return false;
    }

    this.historyIndex++;
    const nextEntry = this.history[this.historyIndex + 1];
    
    if (nextEntry) {
      this.state = { ...nextEntry.state };
      this.notifyListeners({ _redo: true });
      return true;
    }

    return false;
  }

  /**
   * Check if undo is available
   */
  canUndo() {
    return this.historyIndex >= 0;
  }

  /**
   * Check if redo is available
   */
  canRedo() {
    return this.historyIndex < this.history.length - 2;
  }

  /**
   * Subscribe to state changes
   * @param {string} event - Event name or '*' for all
   * @param {function} callback - Callback function
   */
  subscribe(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event).delete(callback);
    };
  }

  /**
   * Notify listeners of state changes
   * @param {object} updates - Changed state keys
   */
  notifyListeners(updates) {
    // Notify specific listeners
    for (const key of Object.keys(updates)) {
      const listeners = this.listeners.get(key);
      if (listeners) {
        for (const callback of listeners) {
          callback(updates[key], key, this.state);
        }
      }
    }

    // Notify global listeners
    const globalListeners = this.listeners.get('*');
    if (globalListeners) {
      for (const callback of globalListeners) {
        callback(updates, this.state);
      }
    }
  }

  /**
   * Reset state to initial
   */
  reset() {
    this.state = {
      activeTool: 'select',
      activeColor: '#000000',
      highlightColor: '#ffff00',
      fontSize: 16,
      strokeWidth: 2,
      opacity: 1,
      currentPage: 1,
      totalPages: 0,
      zoom: 100,
      selection: null,
      isModified: false
    };
    this.history = [];
    this.historyIndex = -1;
    this.notifyListeners({ _reset: true });
  }

  /**
   * Persist state to storage
   */
  async persist() {
    try {
      await chrome.storage.local.set({ 
        pdfedState: this.state 
      });
    } catch (error) {
      console.error('pdfed: Failed to persist state:', error);
    }
  }

  /**
   * Load state from storage
   */
  async load() {
    try {
      const result = await chrome.storage.local.get('pdfedState');
      if (result.pdfedState) {
        this.state = { ...this.state, ...result.pdfedState };
      }
    } catch (error) {
      console.error('pdfed: Failed to load state:', error);
    }
  }
}
