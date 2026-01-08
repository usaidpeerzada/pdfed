
import { PDFDocument } from 'pdf-lib';

export class PageOperations {
    constructor(engine, onReload, getActivePage) {
        this.engine = engine;
        this.onReload = onReload;
        this.getActivePage = getActivePage;
    }

    _getCurrentPage() {
        if (this.getActivePage) return this.getActivePage();
        return this.engine.currentPage;
    }

    // ============ Actions ============

    async rotateCurrentPage(direction) {
        const pageNum = this._getCurrentPage();
        if (!pageNum) return;

        const angle = direction === 'left' ? -90 : 90;
        
        // Construct mutation for ALL pages (preserve others, rotate target)
        const totalPages = this.engine.totalPages;
        const operations = [];
        
        for (let i = 0; i < totalPages; i++) {
            operations.push({
                originalIndex: i,
                rotation: (i === pageNum - 1) ? angle : 0
            });
        }

        try {
            const newBytes = await this.engine.applyPageMutations(operations);
            this.onReload(newBytes);
        } catch (e) {
            console.error('Rotate failed', e);
            alert('Failed to rotate page');
        }
    }

    async deleteCurrentPage() {
        if (this.engine.totalPages <= 1) {
            alert('Cannot delete the last page.');
            return;
        }

        if (!confirm('Are you sure you want to delete the current page?')) return;

        const pageNum = this._getCurrentPage();
        const totalPages = this.engine.totalPages;
        
        // Filter out the deleted page
        const operations = [];
        for (let i = 0; i < totalPages; i++) {
            if (i !== pageNum - 1) {
                operations.push({ originalIndex: i, rotation: 0 });
            }
        }

        try {
            const newBytes = await this.engine.applyPageMutations(operations);
            this.onReload(newBytes);
        } catch (e) {
            console.error('Delete failed', e);
        }
    }

    async extractCurrentPage() {
        const pageNum = this._getCurrentPage();
        
        try {
            // Create new doc with Just this page
            const srcDoc = this.engine.pdfLibDoc;
            const newDoc = await PDFDocument.create();
            const [copiedPage] = await newDoc.copyPages(srcDoc, [pageNum - 1]);
            newDoc.addPage(copiedPage);
            
            const pdfBytes = await newDoc.save();
            this._download(pdfBytes, `page-${pageNum}.pdf`);
        } catch (e) {
            console.error('Extract failed', e);
        }
    }

    async insertPDF() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/pdf';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const arrayBuffer = await file.arrayBuffer();
                const insertBytes = new Uint8Array(arrayBuffer);
                
                // Merge Logic: Append to end? Or After current page?
                // "Insert" usually implies after current.
                // But simplified: Append to end.
                // Or complex: Insert at current index.
                
                // Let's Insert AFTER Current Page.
                await this._mergeAtCurrent(insertBytes);
            } catch (err) {
                console.error('Insert failed', err);
            }
        };
        input.click();
    }

    async _mergeAtCurrent(insertBytes) {
        const srcDoc = this.engine.pdfLibDoc;
        const insertDoc = await PDFDocument.load(insertBytes);
        
        const newDoc = await PDFDocument.create();
        
        const pageNum = this._getCurrentPage(); // 1-based
        const totalPages = this.engine.totalPages;

        // 1. Copy pages BEFORE current (inclusive)
        // Actually usually "Insert" is "Add new page here".
        // Let's do: Pages 1..Current, Then New PDF, Then Rest.
        
        // Step A: Copy 0 to pageNum (exclusive? equal to slice)
        // slice(0, pageNum) gets 0..pageNum-1.
        const preIndices = Array.from({length: pageNum}, (_, i) => i);
        if (preIndices.length > 0) {
            const prePages = await newDoc.copyPages(srcDoc, preIndices);
            prePages.forEach(p => newDoc.addPage(p));
        }

        // Step B: Copy Inserted Doc
        const insertIndices = insertDoc.getPageIndices();
        const insertedPages = await newDoc.copyPages(insertDoc, insertIndices);
        insertedPages.forEach(p => newDoc.addPage(p));

        // Step C: Copy Rest
        const postIndices = Array.from({length: totalPages - pageNum}, (_, i) => i + pageNum);
        if (postIndices.length > 0) {
            const postPages = await newDoc.copyPages(srcDoc, postIndices);
            postPages.forEach(p => newDoc.addPage(p));
        }

        const newBytes = await newDoc.save();
        this.onReload(newBytes);
    }

    _download(bytes, filename) {
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }
}
