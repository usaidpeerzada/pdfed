
import { PDFEngine } from '../core/PDFEngine.js';

export class PageOrganizer {
    constructor(engine, onUpdate) {
        this.engine = engine;
        this.onUpdate = onUpdate; // Callback to reload main viewer on change
        this.pages = []; // Local state: { originalIndex, rotation, isDeleted }
        this.draggedIndex = null;
        this._injectStyles();
    }

    async open() {
        if (!this.engine || !this.engine.pdfJsDoc) return;
        
        // Initialize State
        this.pages = Array.from({ length: this.engine.totalPages }, (_, i) => ({
            originalIndex: i, // 0-based
            rotation: 0,
            isDeleted: false,
            pageNum: i + 1
        }));

        this._createModal();
        await this._renderThumbnails();
    }

    _createModal() {
        if (document.getElementById('pdfed-organizer')) return;

        const modal = document.createElement('div');
        modal.id = 'pdfed-organizer';
        modal.className = 'pdfed-modal-overlay';
        
        modal.innerHTML = `
            <div class="pdfed-organizer-container">
                <div class="pdfed-organizer-header">
                    <div class="pdfed-organizer-title">Organize Pages</div>
                    <div class="pdfed-organizer-actions">
                         <button class="pdfed-btn-text" id="pdfed-org-cancel">Cancel</button>
                         <button class="pdfed-btn-primary" id="pdfed-org-apply">Apply Changes</button>
                    </div>
                </div>
                
                <div class="pdfed-organizer-grid" id="pdfed-org-grid">
                    <!-- Thumbnails Injected Here -->
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this._bindEvents(modal);
    }

    _bindEvents(modal) {
        modal.querySelector('#pdfed-org-cancel').onclick = () => this.close();
        modal.querySelector('#pdfed-org-apply').onclick = () => this._applyChanges();
    }

    async _renderThumbnails() {
        const grid = document.getElementById('pdfed-org-grid');
        grid.innerHTML = '';

        this.pages.forEach((page, index) => {
            if (page.isDeleted) return;

            const card = document.createElement('div');
            card.className = 'pdfed-page-card';
            card.draggable = true;
            card.dataset.index = index;
            
            // Visual rotation
            const rotation = page.rotation; 
            
            card.innerHTML = `
                <div class="pdfed-page-preview" style="transform: rotate(${rotation}deg)">
                    <canvas id="pdfed-thumb-${index}" class="pdfed-thumb-canvas"></canvas>
                    <div class="pdfed-page-overlay">
                        <button class="pdfed-action-btn rotate" title="Rotate">↻</button>
                        <button class="pdfed-action-btn delete" title="Delete">🗑</button>
                    </div>
                </div>
                <div class="pdfed-page-number">Page ${page.pageNum}</div>
            `;

            // DnD Events
            card.addEventListener('dragstart', (e) => this._handleDragStart(e, index));
            card.addEventListener('dragover', (e) => e.preventDefault()); // Allow drop
            card.addEventListener('drop', (e) => this._handleDrop(e, index));
            card.addEventListener('dragenter', (e) => card.classList.add('drag-over'));
            card.addEventListener('dragleave', (e) => card.classList.remove('drag-over'));

            // Actions
            card.querySelector('.rotate').onclick = (e) => {
                e.stopPropagation();
                page.rotation = (page.rotation + 90) % 360;
                this._renderThumbnails(); // Re-render to show rotation
            };
            
            card.querySelector('.delete').onclick = (e) => {
                e.stopPropagation();
                page.isDeleted = true;
                this._renderThumbnails();
            };

            grid.appendChild(card);
        });

        // Sequential Rendering to prevent freezing
        // 50 pages * Parallel Render = Lag
        // Sequential = Smooth UI
        for (let i = 0; i < this.pages.length; i++) {
             if (this.pages[i].isDeleted) continue;
             
             // Yield to main thread every few pages to keep UI responsive
             if (i % 5 === 0) await new Promise(r => setTimeout(r, 0));
             
             await this._renderCanvas(i, this.pages[i].pageNum);
        }
    }

    async _renderCanvas(index, pageNum) {
        const canvas = document.getElementById(`pdfed-thumb-${index}`);
        if (!canvas) return;
        
        try {
            // Render thumbnail at low resolution (Scale 0.2)
            // Typically 1.0 = 800px width. 0.2 = 160px width. Perfect for thumbnail.
            await this.engine.renderPage(pageNum, canvas, 0.2);
        } catch (e) {
            console.warn('Thumb render failed', e);
        }
    }
    
    _handleDragStart(e, index) {
        this.draggedIndex = index;
        e.dataTransfer.effectAllowed = 'move';
        // e.target.style.opacity = '0.5';
    }

    _handleDrop(e, targetIndex) {
        e.preventDefault();
        if (this.draggedIndex === null || this.draggedIndex === targetIndex) return;

        // Reorder array
        const item = this.pages[this.draggedIndex];
        
        // Remove
        this.pages.splice(this.draggedIndex, 1);
        // Insert
        this.pages.splice(targetIndex, 0, item);
        
        this.draggedIndex = null;
        this._renderThumbnails();
    }

    async _applyChanges() {
        const btn = document.getElementById('pdfed-org-apply');
        btn.innerText = 'Processing...';
        btn.disabled = true;

        try {
            // Filter deleted
            const operations = this.pages
                .filter(p => !p.isDeleted)
                .map(p => ({
                    originalIndex: p.originalIndex, // 0-based index of SOURCE page (NOT p.pageNum - 1, because p.pageNum is just label?)
                    // Wait. p.originalIndex IS the correct index in source doc.
                    // p.pageNum was just "Page 1", "Page 2" text.
                    rotation: p.rotation
                }));
            
            const newBytes = await this.engine.applyPageMutations(operations);
            
            if (this.onUpdate) {
                this.onUpdate(newBytes);
            }
            this.close();
        } catch (error) {
            alert('Failed to apply changes: ' + error.message);
            btn.innerText = 'Apply Changes';
            btn.disabled = false;
        }
    }

    close() {
        document.getElementById('pdfed-organizer')?.remove();
    }

    _injectStyles() {
        if (document.getElementById('pdfed-org-styles')) return;
        const style = document.createElement('style');
        style.id = 'pdfed-org-styles';
        style.textContent = `
            #pdfed-organizer .pdfed-organizer-container {
                position: fixed; inset: 20px;
                background: rgba(245, 245, 247, 0.95);
                backdrop-filter: blur(20px);
                border-radius: 12px;
                box-shadow: 0 0 0 1px rgba(0,0,0,0.1), 0 20px 40px rgba(0,0,0,0.2);
                display: flex; flex-direction: column;
                overflow: hidden;
            }
            .pdfed-organizer-header {
                padding: 16px 24px;
                display: flex; justify-content: space-between; align-items: center;
                background: rgba(255,255,255,0.5);
                border-bottom: 1px solid rgba(0,0,0,0.1);
            }
            .pdfed-organizer-title { font-size: 18px; font-weight: 600; color: #1d1d1f; }
            .pdfed-organizer-actions { display: flex; gap: 12px; }
            
            .pdfed-organizer-grid {
                flex: 1; overflow-y: auto; padding: 24px;
                display: grid; 
                grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                gap: 24px;
                align-content: start;
            }
            
            .pdfed-page-card {
                display: flex; flex-direction: column; align-items: center; gap: 8px;
                cursor: grab; position: relative;
            }
            .pdfed-page-card.drag-over .pdfed-page-preview {
                transform: scale(1.05); box-shadow: 0 0 0 3px #007aff;
            }
            
            .pdfed-page-preview {
                width: 100%; aspect-ratio: 1/1.4;
                background: white;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                border-radius: 4px; overflow: hidden;
                position: relative;
                transition: transform 0.2s;
            }
            .pdfed-thumb-canvas {
                width: 100%; height: 100%; object-fit: contain;
            }
            
            .pdfed-page-overlay {
                position: absolute; inset: 0;
                background: rgba(0,0,0,0.3);
                display: flex; align-items: center; justify-content: center; gap: 10px;
                opacity: 0; transition: opacity 0.2s;
            }
            .pdfed-page-card:hover .pdfed-page-overlay { opacity: 1; }
            
            .pdfed-action-btn {
                width: 36px; height: 36px; border-radius: 50%;
                background: white; border: none;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                cursor: pointer; font-size: 16px;
                display: flex; align-items: center; justify-content: center;
            }
            .pdfed-action-btn:hover { background: #f5f5f7; transform: scale(1.1); }
            .pdfed-action-btn.delete { color: #dc2626; }
            
            .pdfed-page-number {
                font-size: 12px; font-weight: 500; color: #6e6e73;
            }
        `;
        document.head.appendChild(style);
    }
}
