import { CONFIG, getMermaidHints } from './config.js';
import { debounce, ensureDiagramVisible, showToast } from './utils.js';
import { initializeMermaid, renderDiagram, applyDarkMode } from './diagram.js';
import { FirebaseManager } from './firebase-manager.js';
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

    // --- Firebase Integration ---
    const firebaseManager = new FirebaseManager((user) => {
        updateAuthUI(user);
    });

    // Auth UI Elements
    const avatarBtn = document.getElementById('avatar-btn');
    const avatarMenu = document.getElementById('avatar-menu');
    const avatarInitialsImg = document.getElementById('avatar-initials-img');
    const avatarInitials = document.getElementById('avatar-initials');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const loggedInView = document.getElementById('logged-in-view');
    const loggedOutView = document.getElementById('logged-out-view');
    const userAvatar = document.getElementById('user-avatar');
    const userAvatarName = document.getElementById('user-avatar-name');
    const userName = document.getElementById('user-name');
    const loginModal = document.getElementById('login-modal');
    const closeLoginModalBtn = document.getElementById('close-login-modal');
    const googleLoginBtn = document.getElementById('google-login-btn');

    // Cloud UI Elements
    const cloudBtns = document.getElementById('cloud-btns');
    const cloudSaveBtn = document.getElementById('cloud-save-btn');
    const cloudLoadBtn = document.getElementById('cloud-load-btn');
    const saveModal = document.getElementById('save-modal');
    const closeSaveModalBtn = document.getElementById('close-save-modal');
    const cancelSaveBtn = document.getElementById('cancel-save-btn');
    const confirmSaveBtn = document.getElementById('confirm-save-btn');
    const diagramTitleInput = document.getElementById('diagram-title');
    const loadModal = document.getElementById('load-modal');
    const closeLoadModalBtn = document.getElementById('close-load-modal');
    const diagramList = document.getElementById('diagram-list');

    // Toggle menu
    avatarBtn.addEventListener('click', () => {
        const isOpen = avatarMenu.classList.contains('show');
        avatarMenu.classList.toggle('show');
        avatarBtn.setAttribute('aria-expanded', !isOpen);
        avatarMenu.setAttribute('aria-hidden', isOpen);
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!avatarBtn.contains(e.target) && !avatarMenu.contains(e.target)) {
            avatarMenu.classList.remove('show');
            avatarBtn.setAttribute('aria-expanded', 'false');
            avatarMenu.setAttribute('aria-hidden', 'true');
        }
    });

    // Close menu on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && avatarMenu.classList.contains('show')) {
            avatarMenu.classList.remove('show');
            avatarBtn.setAttribute('aria-expanded', 'false');
            avatarMenu.setAttribute('aria-hidden', 'true');
        }
    });

    // Auth Functions
    function updateAuthUI(user) {
        if (user) {
            loginBtn.style.display = 'none';
            userName.textContent = user.displayName || user.email;
            cloudBtns.style.display = '';
            avatarBtn.classList.add('logged-in');
            if (user.photoURL) {
                userAvatar.src = user.photoURL;
                userAvatarName.style.display = 'none';
                avatarInitialsImg.style.display = '';
                avatarInitialsImg.style.width = '32px';
                avatarInitialsImg.style.height = '32px';
                avatarInitialsImg.src = user.photoURL;
                avatarInitials.style.display = 'none';
            } else {
                userAvatar.style.display = 'none';
                userAvatarName.textContent = user.displayName;
                avatarInitialsImg.style.display = 'none';
                avatarInitialsImg.src = '';
                avatarInitials.style.display = '';
                avatarInitials.textContent = user.displayName;
            }
            loggedInView.style.display = 'block';
            loggedOutView.style.display = 'none';
        } else {
            loginBtn.style.display = 'inline-flex';
            cloudBtns.style.display = 'none';
            avatarBtn.classList.remove('logged-in');
            avatarInitialsImg.style.display = 'none';
            avatarInitialsImg.src = '';
            avatarInitials.style.display = '';
            loggedInView.style.display = 'none';
            loggedOutView.style.display = 'block';
        }
    }

    // Event Listeners
    loginBtn.addEventListener('click', () => {
        loginModal.classList.add('show');
    });

    closeLoginModalBtn.addEventListener('click', () => {
        loginModal.classList.remove('show');
    });

    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === loginModal) loginModal.classList.remove('show');
        if (e.target === saveModal) saveModal.classList.remove('show');
        if (e.target === loadModal) loadModal.classList.remove('show');
        if (e.target === previewModal) previewModal.classList.remove('show');
    });

    // Preview Modal Elements
    const previewModal = document.getElementById('preview-modal');
    const closePreviewModalBtn = document.getElementById('close-preview-modal');
    const previewTitle = document.getElementById('preview-title');
    const previewImage = document.getElementById('preview-image');
    const previewImageContainer = document.getElementById('preview-image-container');

    closePreviewModalBtn.addEventListener('click', () => {
        previewModal.classList.remove('show');
    });

    // Show thumbnail preview
    function showThumbnailPreview(thumbnail, title) {
        if (thumbnail) {
            previewTitle.textContent = title || 'Diagram Preview';
            previewImage.src = thumbnail;
            previewImage.style.display = 'block';
            previewImageContainer.innerHTML = '';
            previewImageContainer.appendChild(previewImage);
        } else {
            previewTitle.textContent = title || 'Diagram Preview';
            previewImageContainer.innerHTML = `
                <div class="preview-no-image">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                    </svg>
                    <span>No preview available</span>
                </div>
            `;
        }
        previewModal.classList.add('show');
    }

    googleLoginBtn.addEventListener('click', async () => {
        try {
            await firebaseManager.loginWithGoogle();
            loginModal.classList.remove('show');
            showToast('Logged in with Google successfully!');
        } catch (error) {
            showToast('Login failed: ' + error.message, true);
        }
    });

    logoutBtn.addEventListener('click', async () => {
        try {
            await firebaseManager.logout();
            showToast('Logged out successfully!');
            avatarMenu.classList.remove('show');
            avatarMenu.setAttribute('aria-hidden', 'true');
        } catch (error) {
            showToast('Logout failed: ' + error.message, true);
        }
    });

    // Cloud Save
    const saveDiagramList = document.getElementById('save-diagram-list');
    
    cloudSaveBtn.addEventListener('click', async () => {
        saveModal.classList.add('show');
        diagramTitleInput.value = '';
        diagramTitleInput.focus();
        await loadSaveDiagrams();
    });

    closeSaveModalBtn.addEventListener('click', () => saveModal.classList.remove('show'));
    cancelSaveBtn.addEventListener('click', () => saveModal.classList.remove('show'));

    // Load diagrams for save modal
    async function loadSaveDiagrams() {
        saveDiagramList.innerHTML = '<div class="diagram-loading"><div class="loading-spinner"></div><span>Loading...</span></div>';
        try {
            const diagrams = await firebaseManager.getUserDiagrams();

            if (diagrams.length === 0) {
                saveDiagramList.innerHTML = '<div class="diagram-empty-text">No existing diagrams</div>';
                return;
            }

            saveDiagramList.innerHTML = '';
            diagrams.forEach(diagram => {
                const item = document.createElement('div');
                item.className = 'diagram-item save-item';

                const date = diagram.updatedAt ? new Date(diagram.updatedAt.seconds * 1000).toLocaleDateString() : 'Unknown date';
                
                // Thumbnail HTML for save modal
                const thumbnailHtml = diagram.thumbnail 
                    ? `<img src="${diagram.thumbnail}" alt="Preview" class="diagram-thumbnail diagram-thumbnail-sm">`
                    : `<div class="diagram-thumbnail-placeholder diagram-thumbnail-sm">
                         <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                           <path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5z"/>
                         </svg>
                       </div>`;
                
                item.innerHTML = `
                    ${thumbnailHtml}
                    <div class="diagram-item-info">
                        <div class="diagram-item-title">${escapeHtml(diagram.title)}</div>
                        <div class="diagram-item-date">${date}</div>
                    </div>
                    <div class="diagram-item-actions">
                        <button class="update-btn btn btn-sm btn-secondary" data-id="${diagram.id}" data-title="${escapeHtml(diagram.title)}">Update</button>
                    </div>
                `;

                item.querySelector('.update-btn').addEventListener('click', async (e) => {
                    const btn = e.target;
                    const diagramId = btn.dataset.id;
                    const diagramTitle = btn.dataset.title;
                    
                    const code = editor.getValue();
                    const thumbnail = createThumbnail();
                    try {
                        btn.disabled = true;
                        btn.textContent = 'Updating...';
                        await firebaseManager.updateDiagram(diagramId, code, thumbnail);
                        saveModal.classList.remove('show');
                        showToast(`"${diagramTitle}" updated!`);
                    } catch (error) {
                        showToast('Failed to update: ' + error.message, true);
                    } finally {
                        btn.disabled = false;
                        btn.textContent = 'Update';
                    }
                });

                // Thumbnail click handler for preview in save modal
                const thumbnailEl = item.querySelector('.diagram-thumbnail, .diagram-thumbnail-placeholder');
                if (thumbnailEl) {
                    thumbnailEl.addEventListener('click', (e) => {
                        e.stopPropagation();
                        showThumbnailPreview(diagram.thumbnail, diagram.title);
                    });
                }

                saveDiagramList.appendChild(item);
            });
        } catch (error) {
            saveDiagramList.innerHTML = '<div class="diagram-empty-text">Failed to load diagrams</div>';
            console.error('Error loading diagrams:', error);
        }
    }

    // Save new diagram
    confirmSaveBtn.addEventListener('click', async () => {
        const title = diagramTitleInput.value.trim();
        if (!title) {
            showToast('Please enter a diagram name.', true);
            return;
        }

        const code = editor.getValue();
        const thumbnail = createThumbnail();
        try {
            confirmSaveBtn.disabled = true;
            confirmSaveBtn.textContent = 'Saving...';
            await firebaseManager.saveDiagram(title, code, thumbnail);
            saveModal.classList.remove('show');
            diagramTitleInput.value = '';
            showToast('Diagram saved to cloud!');
        } catch (error) {
            showToast('Failed to save: ' + error.message, true);
        } finally {
            confirmSaveBtn.disabled = false;
            confirmSaveBtn.textContent = 'Save New';
        }
    });

    // Cloud Load
    cloudLoadBtn.addEventListener('click', async () => {
        loadModal.classList.add('show');
        await loadDiagrams();
    });

    closeLoadModalBtn.addEventListener('click', () => loadModal.classList.remove('show'));

    async function loadDiagrams() {
        diagramList.innerHTML = '<div class="loading-spinner">Loading...</div>';
        try {
            const diagrams = await firebaseManager.getUserDiagrams();

            if (diagrams.length === 0) {
                diagramList.innerHTML = '<div class="loading-spinner">No diagrams found.</div>';
                return;
            }

            diagramList.innerHTML = '';
            diagrams.forEach(diagram => {
                const item = document.createElement('div');
                item.className = 'diagram-item';

                const date = diagram.createdAt ? new Date(diagram.createdAt.seconds * 1000).toLocaleDateString() : 'Unknown date';
                
                // Thumbnail HTML
                const thumbnailHtml = diagram.thumbnail 
                    ? `<img src="${diagram.thumbnail}" alt="Preview" class="diagram-thumbnail">`
                    : `<div class="diagram-thumbnail-placeholder">
                         <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                           <path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5z"/>
                         </svg>
                       </div>`;
                
                item.innerHTML = `
                    ${thumbnailHtml}
                    <div class="diagram-item-info">
                        <div class="diagram-item-title">${escapeHtml(diagram.title)}</div>
                        <div class="diagram-item-date">${date}</div>
                    </div>
                    <div class="diagram-item-actions">
                        <button class="load-btn btn btn-sm btn-primary" data-id="${diagram.id}">Load</button>
                        <button class="diagram-item-btn delete-btn" data-id="${diagram.id}" title="Delete diagram">
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                                <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                            </svg>
                        </button>
                    </div>
                `;

                // Store code in data attribute or closure
                item.querySelector('.load-btn').addEventListener('click', () => {
                    editor.setValue(diagram.code);
                    loadModal.classList.remove('show');
                    showToast(`Loaded "${diagram.title}"`);
                });

                // Thumbnail click handler for preview
                const thumbnailEl = item.querySelector('.diagram-thumbnail, .diagram-thumbnail-placeholder');
                if (thumbnailEl) {
                    thumbnailEl.addEventListener('click', (e) => {
                        e.stopPropagation();
                        showThumbnailPreview(diagram.thumbnail, diagram.title);
                    });
                }

                // Delete button handler
                item.querySelector('.delete-btn').addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (confirm(`Are you sure you want to delete "${diagram.title}"?`)) {
                        try {
                            await firebaseManager.deleteDiagram(diagram.id);
                            item.remove();
                            showToast(`Deleted "${diagram.title}"`);
                            
                            // Check if list is empty
                            if (diagramList.children.length === 0) {
                                diagramList.innerHTML = `
                                    <div class="diagram-empty">
                                        <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5z"/>
                                        </svg>
                                        <span class="diagram-empty-text">No diagrams saved yet</span>
                                    </div>
                                `;
                            }
                        } catch (error) {
                            showToast(`Error: ${error.message}`, 'error');
                        }
                    }
                });

                diagramList.appendChild(item);
            });
        } catch (error) {
            diagramList.innerHTML = `<div class="loading-spinner" style="color: red;">Error: ${error.message}</div>`;
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Generate SVG thumbnail as Base64
    function createThumbnail() {
        const diagramContainer = document.getElementById('mermaid-diagram');
        const svgElement = diagramContainer.querySelector('svg');
        
        if (!svgElement) {
            return null;
        }

        const restore = ensureDiagramVisible();

        try {
            // Clone SVG to avoid modifying the original
            const clonedSvg = svgElement.cloneNode(true);
            
            // Try to get dimensions from viewBox first, then getBBox
            let viewBox = svgElement.getAttribute('viewBox');
            let x = 0, y = 0, width = 0, height = 0;
            
            if (viewBox) {
                const parts = viewBox.split(/[\s,]+/).map(Number);
                if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
                    [x, y, width, height] = parts;
                }
            }
            
            // If viewBox is invalid, try getBBox
            if (width === 0 || height === 0) {
                try {
                    const bbox = svgElement.getBBox();
                    x = bbox.x;
                    y = bbox.y;
                    width = bbox.width;
                    height = bbox.height;
                } catch (e) {
                    // getBBox failed, will use defaults
                }
            }
            
            // If still no dimensions, use default
            if (width === 0 || height === 0) {
                width = 800;
                height = 600;
                x = 0;
                y = 0;
            }
            
            clonedSvg.setAttribute('viewBox', `${x - 10} ${y - 10} ${width + 20} ${height + 20}`);
            clonedSvg.setAttribute('width', '600');
            clonedSvg.setAttribute('height', '450');
            clonedSvg.style.background = 'white';

            // Serialize SVG to string
            const serializer = new XMLSerializer();
            const svgString = serializer.serializeToString(clonedSvg);
            
            // Convert to Base64
            const base64 = btoa(unescape(encodeURIComponent(svgString)));
            return `data:image/svg+xml;base64,${base64}`;
        } catch (error) {
            console.error('Error creating thumbnail:', error);
            return null;
        } finally {
            // Restore original visibility
            restore();
        }
    }
});
