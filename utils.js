import { CONFIG } from './config.js';

/**
 * Debounce utility function
 * Delays function execution until after a specified time has elapsed since the last call
 */
export const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
};

/**
 * Collect all inline CSS styles from the document
 * Used for embedding styles into exported SVG
 */
export const collectCssStyles = () => {
    return Array.from(document.styleSheets)
        .filter(sheet => !sheet.href)
        .flatMap(sheet => {
            try {
                return Array.from(sheet.cssRules || sheet.rules)
                    .map(rule => rule.cssText)
                    .filter(cssText => !/url\s*\((?!['"]?(?:data:|#))/i.test(cssText));
            } catch (e) {
                console.warn('Cannot access stylesheet:', e);
                return [];
            }
        })
        .join('\n');
};

/**
 * Temporarily make diagram pane visible for accurate measurements
 * Returns a restore function
 */
export const ensureDiagramVisible = () => {
    const diagramPane = document.getElementById('diagram-pane');
    if (!diagramPane) return () => {};
    
    const computedStyle = window.getComputedStyle(diagramPane);
    const isHidden = computedStyle.display === 'none' || 
                     computedStyle.visibility === 'hidden' ||
                     diagramPane.offsetWidth === 0;
    
    if (!isHidden) return () => {};
    
    const originalStyle = diagramPane.getAttribute('style') || '';
    
    diagramPane.setAttribute('style', `
        position: fixed !important;
        left: 0 !important;
        top: 0 !important;
        opacity: 0 !important;
        width: 800px !important;
        height: 600px !important;
        display: block !important;
        pointer-events: none !important;
        z-index: -9999 !important;
    `);
    
    void diagramPane.offsetHeight;
    
    return () => {
        if (originalStyle) {
            diagramPane.setAttribute('style', originalStyle);
        } else {
            diagramPane.removeAttribute('style');
        }
    };
};

/**
 * Get the dimensions of an SVG element
 * Accounts for svg-pan-zoom viewport if present
 * Temporarily shows diagram pane if hidden for accurate measurements
 */
export const getSvgDimensions = (svgElement) => {
    const restore = ensureDiagramVisible();
    
    try {
        const viewport = svgElement.querySelector('.svg-pan-zoom_viewport');
        return viewport ? viewport.getBBox() :
            (svgElement.viewBox?.baseVal?.width > 0 ? svgElement.viewBox.baseVal : svgElement.getBBox());
    } finally {
        restore();
    }
};

/**
 * Create an error display element for diagram syntax errors
 */
export const createErrorDisplay = (errorMessage) => {
    const errorDiv = document.createElement('div');
    Object.assign(errorDiv.style, {
        color: '#721c24',
        backgroundColor: '#f8d7da',
        border: '1px solid #f5c6cb',
        padding: '15px',
        borderRadius: '4px',
        textAlign: 'left',
        overflow: 'auto'
    });

    const title = document.createElement('div');
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '10px';
    title.textContent = 'Diagram Syntax Error:';
    errorDiv.appendChild(title);

    const pre = document.createElement('pre');
    Object.assign(pre.style, {
        margin: '0',
        whiteSpace: 'pre-wrap',
        fontFamily: 'monospace',
        fontSize: '14px'
    });
    pre.textContent = errorMessage;
    errorDiv.appendChild(pre);

    return errorDiv;
};

/**
 * Prepare SVG for export by cloning and injecting styles
 */
export const prepareSvgForExport = (svgElement) => {
    const clonedSvg = svgElement.cloneNode(true);

    // Inject styles
    const styleElement = document.createElement('style');
    styleElement.textContent = collectCssStyles();
    clonedSvg.insertBefore(styleElement, clonedSvg.firstChild);

    // Remove svg-pan-zoom transformations
    const clonedViewport = clonedSvg.querySelector('.svg-pan-zoom_viewport');
    if (clonedViewport) {
        clonedViewport.removeAttribute('transform');
        clonedViewport.removeAttribute('style');
    }

    return clonedSvg;
};

/**
 * Save file to disk using File System Access API or fallback
 */
export const saveFile = async (content, filename, mimeType) => {
    // Check if File System Access API is supported
    if ('showSaveFilePicker' in window) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: filename,
                types: [{
                    description: 'Text Files',
                    accept: { [mimeType]: ['.txt', '.mmd'] },
                }],
            });

            const writable = await handle.createWritable();
            await writable.write(content);
            await writable.close();
            return true;
        } catch (err) {
            if (err.name === 'AbortError') {
                return false; // User cancelled
            }
            throw err;
        }
    } else {
        // Fallback: Traditional download method
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return true;
    }
};

/**
 * Show toast notification
 */
export const showToast = (message) => {
    const toast = document.getElementById('toast-notification');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, CONFIG.TOAST_DURATION);
};
