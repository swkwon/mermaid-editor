import { CONFIG } from './config.js';

let panZoomInstance = null;

/**
 * Initialize Mermaid with given dark mode setting
 */
export const initializeMermaid = (isDarkMode) => {
    window.mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'loose',
        suppressErrors: true,
        theme: isDarkMode ? 'dark' : 'default',
        flowchart: {
            htmlLabels: true,
            useMaxWidth: false
        },
        gantt: {
            displayMode: 'compact',
            todayMarker: 'off'
        }
    });
};

/**
 * Apply background pattern to diagram
 */
export const applyBackground = (pattern) => {
    const mermaidDiagram = document.getElementById('mermaid-diagram');
    const toggleBackgroundBtn = document.getElementById('toggle-background-btn');
    const isDark = document.body.classList.contains('dark-mode');
    
    switch (pattern) {
        case 'dot': {
            const dotColor = isDark ? '#444' : '#d0d0d0';
            mermaidDiagram.style.backgroundImage = `radial-gradient(circle, ${dotColor} 1px, transparent 1px)`;
            mermaidDiagram.style.backgroundSize = '20px 20px';
            toggleBackgroundBtn.setAttribute('data-pattern', 'dot');
            break;
        }
        case 'grid': {
            const lineColor = isDark ? '#444' : '#e0e0e0';
            mermaidDiagram.style.backgroundImage = `linear-gradient(${lineColor} 1px, transparent 1px), linear-gradient(90deg, ${lineColor} 1px, transparent 1px)`;
            mermaidDiagram.style.backgroundSize = '20px 20px';
            toggleBackgroundBtn.setAttribute('data-pattern', 'grid');
            break;
        }
        case 'none':
        default: {
            mermaidDiagram.style.backgroundImage = 'none';
            toggleBackgroundBtn.setAttribute('data-pattern', 'none');
            break;
        }
    }
};

/**
 * Apply dark mode to the application
 */
export const applyDarkMode = (isDark, currentBackground, renderCallback) => {
    if (isDark) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
    
    // Update Mermaid theme
    initializeMermaid(isDark);
    
    // Re-render diagram with new theme
    renderCallback();
    
    // Reapply background pattern with new colors
    applyBackground(currentBackground);
};

/**
 * Update zoom level display
 */
export const updateZoomLevel = (zoom) => {
    const zoomLevelEl = document.getElementById('zoom-level');
    if (zoomLevelEl) {
        zoomLevelEl.textContent = `${Math.round(zoom * 100)}%`;
    }
};

/**
 * Render Mermaid diagram from code
 */
export const renderDiagram = async (editor) => {
    const mermaidDiagram = document.getElementById('mermaid-diagram');
    const mermaidTemp = document.getElementById('mermaid-temp');
    const diagramPane = document.getElementById('diagram-pane');

    // Helper to ensure an element is visible for rendering (offscreen but renderable)
    const ensureElementVisible = (element) => {
        if (!element) return () => {};
        
        const computedStyle = window.getComputedStyle(element);
        const isHidden = computedStyle.display === 'none' || 
                         computedStyle.visibility === 'hidden' ||
                         element.offsetWidth === 0;
        
        if (!isHidden) return () => {};
        
        // Save original inline styles
        const originalStyle = element.getAttribute('style') || '';
        
        // Force visibility - use opacity:0 instead of visibility:hidden
        // visibility:hidden still prevents proper size calculation in some browsers
        element.setAttribute('style', `
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
        
        // Force reflow
        void element.offsetHeight;
        
        return () => {
            if (originalStyle) {
                element.setAttribute('style', originalStyle);
            } else {
                element.removeAttribute('style');
            }
        };
    };

    // Restore functions - declared outside try so they can be called in catch
    let restoreDiagramPane = () => {};
    let restoreMermaidTemp = () => {};

    try {
        const mermaidCode = editor.getValue().trim();

        // Clear diagram if editor is empty
        if (!mermaidCode) {
            mermaidDiagram.innerHTML = '';
            if (panZoomInstance) {
                try { panZoomInstance.destroy(); } catch (e) { }
                panZoomInstance = null;
            }
            return;
        }

        // Parse validation first (prevents DOM injection)
        const parseResult = await window.mermaid.parse(mermaidCode);
        if (!parseResult) {
            return;
        }

        // Ensure both diagram pane and temp container are visible for proper rendering
        restoreDiagramPane = ensureElementVisible(diagramPane);
        restoreMermaidTemp = ensureElementVisible(mermaidTemp);

        const uniqueId = 'graphDiv-' + Date.now();

        // Render to temporary container first
        mermaidTemp.innerHTML = '';
        const result = await window.mermaid.render(uniqueId, mermaidCode);

        // Update diagram area only on success
        mermaidDiagram.innerHTML = result.svg;

        // Clear error markers on success
        editor.getAllMarks().forEach(mark => mark.clear());

        // Initialize SVG Pan Zoom
        const svgElement = mermaidDiagram.querySelector('svg');
        if (svgElement) {
            // Destroy existing pan-zoom instance
            if (panZoomInstance) {
                try { panZoomInstance.destroy(); } catch (e) { }
            }

            // Adjust SVG styles for pan-zoom compatibility
            svgElement.style.maxWidth = 'none';
            svgElement.style.height = '100%';
            svgElement.style.width = '100%';

            panZoomInstance = window.svgPanZoom(svgElement, {
                zoomEnabled: true,
                controlIconsEnabled: false,
                fit: true,
                center: true,
                minZoom: 0.5,
                maxZoom: 10,
                onZoom: function (newZoom) {
                    updateZoomLevel(newZoom);
                }
            });

            // Initial zoom level display
            updateZoomLevel(panZoomInstance.getZoom());
        }

        // Restore original visibility AFTER svg-pan-zoom initialization
        restoreDiagramPane();
        restoreMermaidTemp();
    } catch (e) {
        // Keep existing diagram on error
        mermaidTemp.innerHTML = '';

        // Calculate frontmatter lines
        const mermaidCode = editor.getValue();
        const lines = mermaidCode.split('\n');
        let frontmatterLines = 0;

        if (lines[0] && lines[0].trim() === '---') {
            for (let i = 1; i < lines.length; i++) {
                frontmatterLines++;
                if (lines[i] && lines[i].trim() === '---') {
                    frontmatterLines++;
                    break;
                }
            }
        }

        console.log('Frontmatter lines detected:', frontmatterLines);

        // Extract error line from message
        const errorMessage = e.message || e.str || String(e);
        let errorLine = null;

        // Pattern 1: "Parse error on line 15"
        let lineMatch = errorMessage.match(/line[\s:]+(\d+)/i);
        if (lineMatch) {
            errorLine = parseInt(lineMatch[1], 10) - 1 + frontmatterLines;
        }

        // Pattern 2: e.hash.line
        if (e.hash && e.hash.line !== undefined) {
            errorLine = e.hash.line - 1 + frontmatterLines;
        }

        // Pattern 3: e.hash.loc.first_line
        if (e.hash && e.hash.loc && e.hash.loc.first_line !== undefined) {
            errorLine = e.hash.loc.first_line - 1 + frontmatterLines;
        }

        console.log('Detected error line (before adjustment):', errorLine - frontmatterLines);
        console.log('Adjusted error line (with frontmatter):', errorLine);

        if (errorLine !== null && errorLine >= 0) {
            const lineLength = editor.getLine(errorLine)?.length || 0;

            // Clear existing markers
            editor.getAllMarks().forEach(mark => mark.clear());

            // Mark error line with red underline
            if (errorLine < editor.lineCount()) {
                editor.markText(
                    { line: errorLine, ch: 0 },
                    { line: errorLine, ch: lineLength },
                    {
                        className: 'error-line',
                        title: errorMessage
                    }
                );

                // Scroll to error line
                editor.scrollIntoView({ line: errorLine, ch: 0 }, 100);
            }
        }

        // Restore visibility on error as well
        restoreDiagramPane();
        restoreMermaidTemp();
    }
};

/**
 * Get pan-zoom instance
 */
export const getPanZoomInstance = () => panZoomInstance;

/**
 * Set pan-zoom instance
 */
export const setPanZoomInstance = (instance) => {
    panZoomInstance = instance;
};
