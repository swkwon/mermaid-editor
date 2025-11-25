import { CONFIG, getMermaidHints } from './config.js';
import { debounce } from './utils.js';
import { initializeMermaid, renderDiagram, applyDarkMode } from './diagram.js';
import { FirebaseManager } from './firebase-manager.js';
import { showToast } from './utils.js';
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
    // const userProfile = document.getElementById('user-profile');
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
            // userProfile.style.display = 'flex';
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
            // userProfile.style.display = 'none';
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
    });

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
    cloudSaveBtn.addEventListener('click', () => {
        saveModal.classList.add('show');
        diagramTitleInput.focus();
    });

    closeSaveModalBtn.addEventListener('click', () => saveModal.classList.remove('show'));
    cancelSaveBtn.addEventListener('click', () => saveModal.classList.remove('show'));

    confirmSaveBtn.addEventListener('click', async () => {
        const title = diagramTitleInput.value.trim();
        if (!title) {
            showToast('Please enter a diagram name.', true);
            return;
        }

        const code = editor.getValue();
        try {
            confirmSaveBtn.disabled = true;
            confirmSaveBtn.textContent = 'Saving...';
            await firebaseManager.saveDiagram(title, code);
            saveModal.classList.remove('show');
            diagramTitleInput.value = '';
            showToast('Diagram saved to cloud!');
        } catch (error) {
            showToast('Failed to save: ' + error.message, true);
        } finally {
            confirmSaveBtn.disabled = false;
            confirmSaveBtn.textContent = 'Save';
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

                item.innerHTML = `
                    <div class="diagram-info">
                        <h3>${escapeHtml(diagram.title)}</h3>
                        <div class="diagram-meta">Last modified: ${date}</div>
                    </div>
                    <div class="diagram-actions">
                        <button class="btn btn-sm btn-primary load-btn" data-id="${diagram.id}">Load</button>
                    </div>
                `;

                // Store code in data attribute or closure
                item.querySelector('.load-btn').addEventListener('click', () => {
                    editor.setValue(diagram.code);
                    loadModal.classList.remove('show');
                    showToast(`Loaded "${diagram.title}"`);
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
});
