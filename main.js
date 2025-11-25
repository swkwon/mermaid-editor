import { CONFIG, getMermaidHints } from './config.js';
import { debounce } from './utils.js';
import { initializeMermaid, renderDiagram, applyDarkMode } from './diagram.js';
import {
    setupUrlCodeLoading,
    setupCopyUrlButton,
    setupFileButtons,
    setupExportMenu,
    setupCopyImageButton,
    setupBackgroundToggle,
    setupDarkModeToggle,
    setupZoomControls,
    setupKeyboardShortcuts,
    setupViewToggle,
    setupSampleSelector,
    setupThemeSelector,
    setupSponsorModal,
    setupWindowResize
} from './ui.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Get saved split sizes
    const savedSizes = localStorage.getItem(CONFIG.SPLIT_SIZES_KEY);
    const initialSizes = savedSizes ? JSON.parse(savedSizes) : CONFIG.DEFAULT_SPLIT_SIZES;

    // Initialize state variables (using objects to pass by reference)
    const currentBackground = { value: localStorage.getItem(CONFIG.BACKGROUND_PATTERN_KEY) || 'dot' };
    const currentTheme = localStorage.getItem('editorTheme') || 'material-darker';
    const isDarkMode = { value: localStorage.getItem(CONFIG.DARK_MODE_KEY) === 'true' };

    // Initialize Split.js
    window.Split(['#editor-pane', '#diagram-pane'], {
        sizes: initialSizes,
        minSize: 200,
        gutterSize: 10,
        cursor: 'col-resize',
        onDragEnd: (sizes) => {
            localStorage.setItem(CONFIG.SPLIT_SIZES_KEY, JSON.stringify(sizes));
        }
    });

    // Initialize Mermaid
    initializeMermaid(isDarkMode.value);

    // Initialize CodeMirror
    const mermaidInput = document.getElementById('mermaid-input');
    const editor = window.CodeMirror(document.querySelector('.editor-wrapper'), {
        value: mermaidInput.value,
        mode: 'yaml',
        theme: currentTheme,
        lineNumbers: true,
        lineWrapping: true,
        indentUnit: 4,
        tabSize: 4,
        indentWithTabs: false,
        autofocus: true,
        styleActiveLine: { nonEmpty: true },
        matchBrackets: true,
        extraKeys: {
            'Ctrl-Space': 'autocomplete'
        },
        hintOptions: {
            hint: getMermaidHints,
            completeSingle: false
        }
    });

    // Create render callback
    const renderCallback = () => renderDiagram(editor);
    const debouncedRender = debounce(renderCallback, CONFIG.DEBOUNCE_DELAY);

    // Setup CodeMirror change handler
    editor.on('change', (cm, change) => {
        const data = {
            code: editor.getValue(),
            timestamp: Date.now()
        };
        localStorage.setItem(CONFIG.MERMAID_CODE_KEY, JSON.stringify(data));
        debouncedRender();

        // Auto-trigger autocomplete while typing
        if (change.origin === '+input') {
            // Skip if autocomplete is already showing
            if (cm.state.completionActive) {
                return;
            }

            const cursor = cm.getCursor();
            const line = cm.getLine(cursor.line);
            const char = line.charAt(cursor.ch - 1);
            
            // Don't show hints for space, newline, or special punctuation
            if (char && char.match(/[a-zA-Z0-9\-<>*.=|]/)) {
                cm.showHint({
                    hint: getMermaidHints,
                    completeSingle: false
                });
            }
        }
    });

    // Setup UI components
    setupThemeSelector(editor, currentTheme);
    setupSampleSelector(editor, renderCallback);
    setupCopyUrlButton(editor);
    setupFileButtons(editor, renderCallback);
    setupExportMenu();
    setupCopyImageButton();
    setupBackgroundToggle(currentBackground);
    setupDarkModeToggle(isDarkMode, currentBackground, renderCallback);
    setupZoomControls();
    setupKeyboardShortcuts();
    setupViewToggle(renderCallback);
    setupSponsorModal();
    setupWindowResize(renderCallback);

    // Apply initial dark mode
    applyDarkMode(isDarkMode.value, currentBackground.value, renderCallback);

    // Load initial code from URL or localStorage
    const loadedFromUrl = setupUrlCodeLoading(editor);

    if (!loadedFromUrl) {
        const savedData = localStorage.getItem(CONFIG.MERMAID_CODE_KEY);
        if (savedData) {
            try {
                const parsedData = JSON.parse(savedData);
                const oneHour = CONFIG.AUTOSAVE_TTL;

                if (parsedData && parsedData.timestamp && parsedData.code) {
                    if (Date.now() - parsedData.timestamp < oneHour) {
                        editor.setValue(parsedData.code);
                    } else {
                        console.log('Auto-saved code expired.');
                        localStorage.removeItem(CONFIG.MERMAID_CODE_KEY);
                    }
                }
            } catch (e) {
                console.log('Invalid or legacy auto-save data found.');
            }
        }
    }

    // Initial render
    await renderCallback();
});
