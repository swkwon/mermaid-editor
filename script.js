// Constants
const CONFIG = {
    SPLIT_SIZES_KEY: 'split-sizes',
    MERMAID_CODE_KEY: 'mermaid-code',
    BACKGROUND_PATTERN_KEY: 'background-pattern',
    DARK_MODE_KEY: 'dark-mode',
    AUTOSAVE_TTL: 60 * 60 * 1000, // 1 hour
    DEBOUNCE_DELAY: 300,
    TOAST_DURATION: 3000,
    PADDING: 20,
    LOAD_TIMEOUT: 10000,
    MAX_DIMENSION: 16384,
    DEFAULT_SPLIT_SIZES: [50, 50],
    MESSAGES: {
        URL_COPIED: 'Share URL copied to clipboard!',
        URL_COPY_FAILED: 'Failed to copy URL.',
        FILE_SAVED: 'File saved successfully!',
        FILE_SAVE_FAILED: 'Failed to save file.',
        FILE_LOADED: 'File loaded successfully!',
        FILE_LOAD_FAILED: 'Failed to read file.',
        NO_DIAGRAM: 'No diagram to download.',
        DIAGRAM_TOO_LARGE: 'Diagram size is too large to export.',
        IMAGE_TIMEOUT: 'Image loading timeout. Please try a simpler diagram.',
        INVALID_DIMENSIONS: 'Invalid diagram dimensions. Please try regenerating the diagram.',
        IMAGE_NOT_LOADED: 'Image not fully loaded. Please try again.',
        CANVAS_FAILED: 'Failed to create canvas context.',
        EXPORT_FAILED: 'Failed to export image. Browser security policy blocked the export.',
        EXPORT_EMPTY: 'Failed to generate image. Please try a smaller or simpler diagram.',
        EXPORT_ERROR: 'Failed to export image. Some diagram features may not be compatible.',
        IMAGE_LOAD_ERROR: 'Failed to load image. The SVG may contain unsupported features.',
        URL_DECODE_FAILED: 'Failed to load code from URL.',
        ENCODE_FAILED: 'Failed to encode diagram. Please try a different diagram type.',
        PDF_SUCCESS: 'PDF downloaded successfully!',
        PDF_FAILED: 'Failed to generate PDF.',
        CLIPBOARD_SUCCESS: 'Image copied to clipboard!',
        CLIPBOARD_FAILED: 'Failed to copy image to clipboard.',
        CLIPBOARD_NOT_SUPPORTED: 'Clipboard API is not supported in your browser.'
    }
};

// Utility Functions
const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
};

const collectCssStyles = () => {
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

const getSvgDimensions = (svgElement) => {
    const viewport = svgElement.querySelector('.svg-pan-zoom_viewport');
    return viewport ? viewport.getBBox() : 
           (svgElement.viewBox?.baseVal?.width > 0 ? svgElement.viewBox.baseVal : svgElement.getBBox());
};

const createErrorDisplay = (errorMessage) => {
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

const prepareSvgForExport = (svgElement) => {
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

const copyImageToClipboard = async (svgElement, bbox) => {
    return new Promise((resolve, reject) => {
        convertSvgToImage(
            svgElement,
            bbox,
            'png',
            async (dataUrl) => {
                try {
                    // Convert data URL to blob
                    const response = await fetch(dataUrl);
                    const blob = await response.blob();
                    
                    // Use Clipboard API to copy image
                    await navigator.clipboard.write([
                        new ClipboardItem({
                            [blob.type]: blob
                        })
                    ]);
                    
                    resolve();
                } catch (error) {
                    console.error('Failed to copy image to clipboard:', error);
                    reject(error);
                }
            },
            (errorMessage) => {
                reject(new Error(errorMessage));
            }
        );
    });
};

const convertSvgToImage = (svgElement, bbox, format, onSuccess, onError) => {
    const { width, height, x, y } = bbox;
    const clonedSvg = prepareSvgForExport(svgElement);
    
    console.log('Export size:', { 
        width, 
        height,
        aspectRatio: (width / height).toFixed(2)
    });
    
    // Set SVG attributes
    Object.assign(clonedSvg.style, { width: '', height: '', maxWidth: '' });
    clonedSvg.setAttribute('width', width);
    clonedSvg.setAttribute('height', height);
    clonedSvg.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
    
    // Serialize and encode
    const svgXML = new XMLSerializer().serializeToString(clonedSvg).replace(/\0/g, '');
    
    let svgDataUrl;
    try {
        svgDataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgXML)));
    } catch (e) {
        console.error('SVG encoding error:', e);
        onError(CONFIG.MESSAGES.ENCODE_FAILED);
        return;
    }
    
    // Convert to image
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    const loadTimeout = setTimeout(() => {
        console.error('Image loading timeout');
        onError(CONFIG.MESSAGES.IMAGE_TIMEOUT);
    }, CONFIG.LOAD_TIMEOUT);
    
    img.onload = () => {
        clearTimeout(loadTimeout);
        
        try {
            console.log('Image loaded successfully!');
            console.log('Image natural dimensions:', img.naturalWidth, 'x', img.naturalHeight);
            console.log('Expected dimensions:', width, 'x', height);

            if (width <= 0 || height <= 0) {
                console.error('Invalid dimensions:', { width, height });
                onError(CONFIG.MESSAGES.INVALID_DIMENSIONS);
                return;
            }

            if (!img.complete || img.naturalWidth === 0) {
                console.error('Image not fully loaded:', { complete: img.complete, naturalWidth: img.naturalWidth });
                onError(CONFIG.MESSAGES.IMAGE_NOT_LOADED);
                return;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width + CONFIG.PADDING * 2;
            canvas.height = height + CONFIG.PADDING * 2;

            console.log('Canvas created with size:', canvas.width, 'x', canvas.height);

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                console.error('Failed to get canvas context');
                onError(CONFIG.MESSAGES.CANVAS_FAILED);
                return;
            }
            
            // Use dark background if dark mode is enabled
            const isDarkMode = document.body.classList.contains('dark-mode');
            ctx.fillStyle = isDarkMode ? '#1e1e2e' : 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            console.log(`${isDarkMode ? 'Dark' : 'White'} background filled`);
            
            console.log('Drawing image at:', CONFIG.PADDING, CONFIG.PADDING, 'with size:', width, height);
            ctx.drawImage(img, CONFIG.PADDING, CONFIG.PADDING, width, height);
            console.log('Image drawn successfully');

            const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
            let dataUrl;
            try {
                dataUrl = canvas.toDataURL(mimeType);
            } catch (e) {
                console.error('Canvas to data URL error:', e);
                onError(CONFIG.MESSAGES.EXPORT_FAILED);
                return;
            }
            
            if (!dataUrl || dataUrl === 'data:,' || dataUrl.length < 100) {
                console.error('Generated data URL is empty or invalid');
                console.log('Canvas size:', canvas.width, 'x', canvas.height);
                console.log('Image size:', img.width, 'x', img.height);
                console.log('Data URL length:', dataUrl ? dataUrl.length : 0);
                onError(CONFIG.MESSAGES.EXPORT_EMPTY);
                return;
            }

            onSuccess(dataUrl);
        } catch (e) {
            console.error('Image conversion error:', e);
            onError(CONFIG.MESSAGES.EXPORT_ERROR);
        }
    };
    
    img.onerror = (e) => {
        clearTimeout(loadTimeout);
        console.error('Image load error:', e);
        console.log('SVG Data URL length:', svgDataUrl ? svgDataUrl.length : 0);
        console.log('SVG XML preview:', svgXML.substring(0, 500));
        onError(CONFIG.MESSAGES.IMAGE_LOAD_ERROR);
    };
    
    img.src = svgDataUrl;
};

const saveFile = async (content, filename, mimeType) => {
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

document.addEventListener('DOMContentLoaded', async () => {
    // Get saved split sizes
    const savedSizes = localStorage.getItem(CONFIG.SPLIT_SIZES_KEY);
    const initialSizes = savedSizes ? JSON.parse(savedSizes) : CONFIG.DEFAULT_SPLIT_SIZES;

    // Initialize variables first
    let currentBackground = localStorage.getItem(CONFIG.BACKGROUND_PATTERN_KEY) || 'dot';
    let currentTheme = localStorage.getItem('editorTheme') || 'material-darker';
    let isDarkMode = localStorage.getItem(CONFIG.DARK_MODE_KEY) === 'true';

    // Initialize Split.js
    Split(['#editor-pane', '#diagram-pane'], {
        sizes: initialSizes,
        minSize: 200,
        gutterSize: 10,
        cursor: 'col-resize',
        onDragEnd: (sizes) => {
            localStorage.setItem(CONFIG.SPLIT_SIZES_KEY, JSON.stringify(sizes));
        }
    });

    mermaid.initialize({ 
        startOnLoad: false,
        securityLevel: 'strict',
        suppressErrors: true,
        theme: isDarkMode ? 'dark' : 'default',
        flowchart: { 
            htmlLabels: false,
            useMaxWidth: false
        },
        gantt: {
            displayMode: 'compact',
            todayMarker: 'off'
        }
    });

    const copyUrlBtn = document.getElementById('copy-url-btn');
    const saveTxtBtn = document.getElementById('save-txt-btn');
    const loadTxtBtn = document.getElementById('load-txt-btn');
    const loadTxtInput = document.getElementById('load-txt-input');
    const exportBtn = document.getElementById('export-btn');
    const exportMenu = document.getElementById('export-menu');
    const toggleBackgroundBtn = document.getElementById('toggle-background-btn');
    const copyImageBtn = document.getElementById('copy-image-btn');
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const mermaidInput = document.getElementById('mermaid-input');
    const mermaidDiagram = document.getElementById('mermaid-diagram');
    const toast = document.getElementById('toast-notification');
    const sampleSelector = document.getElementById('sample-selector');
    const themeSelector = document.getElementById('theme-selector');
    let panZoomInstance = null;

    // Initialize CodeMirror
    const editor = CodeMirror(document.querySelector('.editor-wrapper'), {
        value: mermaidInput.value,
        mode: 'yaml',
        theme: currentTheme,
        lineNumbers: true,
        lineWrapping: true,
        indentUnit: 4,
        tabSize: 4,
        indentWithTabs: false,
        autofocus: true,
        styleActiveLine: {nonEmpty: true},
        matchBrackets: true
    });

    // Sample codes for different diagram types
    const samples = {
        flowchart: `graph TD
    A[Start] --> B{Is it?}
    B -- Yes --> C[OK]
    C --> D[Rethink]
    D --> B
    B -- No --> E[End]`,
        sequence: `sequenceDiagram
    participant Alice
    participant Bob
    Alice->>John: Hello John, how are you?
    loop Healthcheck
        John->>John: Fight against hypochondria
    end
    Note right of John: Rational thoughts <br/>prevail...
    John-->>Alice: Great!
    John->>Bob: How about you?
    Bob-->>John: Jolly good!`,
        class: `classDiagram
    Class01 <|-- AveryLongClass : Cool
    Class03 *-- Class04
    Class05 o-- Class06
    Class07 .. Class08
    Class09 --> C2 : Where am i?
    Class09 --* C3
    Class09 --|> Class07
    Class07 : equals()
    Class07 : Object[] elementData
    Class01 : size()
    Class01 : int chimp
    Class01 : int gorilla
    Class08 <--> C2: Cool label`,
        state: `stateDiagram-v2
    [*] --> Still
    Still --> [*]
    Still --> Moving
    Moving --> Still
    Moving --> Crash
    Crash --> [*]`,
        er: `erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE-ITEM : contains
    CUSTOMER }|..|{ DELIVERY-ADDRESS : uses`,
        journey: `journey
    title My working day
    section Go to work
      Make tea: 5: Me
      Go upstairs: 3: Me
      Do work: 1: Me, Cat
    section Go home
      Go downstairs: 5: Me
      Sit down: 5: Me`,
        gantt: `gantt
    title A Gantt Diagram
    dateFormat  YYYY-MM-DD
    section Section
    todayMarker off
    A task           :a1, 2025-11-10, 30d
    Another task     :after a1  , 20d
    section Another
    Task in sec      :2025-11-20  , 12d
    another task      : 24d`,
        pie: `pie title Pets adopted by volunteers
    "Dogs" : 386
    "Cats" : 85
    "Rats" : 15`,
        quadrant: `quadrantChart
    title Reach and engagement of campaigns
    x-axis Low Reach --> High Reach
    y-axis Low Engagement --> High Engagement
    quadrant-1 We should expand
    quadrant-2 Need to promote
    quadrant-3 Re-evaluate
    quadrant-4 May be improved
    Campaign A: [0.3, 0.6]
    Campaign B: [0.45, 0.23]
    Campaign C: [0.57, 0.69]
    Campaign D: [0.78, 0.34]
    Campaign E: [0.40, 0.34]
    Campaign F: [0.35, 0.78]`,
        requirement: `requirementDiagram

    requirement test_req {
    id: 1
    text: the test text.
    risk: high
    verifymethod: test
    }

    element test_entity {
    type: simulation
    }

    test_entity - satisfies -> test_req`,
        git: `gitGraph
   commit
   commit
   branch develop
   checkout develop
   commit
   commit
   checkout main
   merge develop
   commit
   commit`,
        c4: `C4Context
  title System Context diagram for Internet Banking System
  Enterprise_Boundary(b0, "BankBoundary0") {
    Person(customerA, "Banking Customer A", "A customer of the bank, with personal bank accounts.")
    System(SystemAA, "Internet Banking System", "Allows customers to view information about their bank accounts, and make payments.")

    System_Ext(SystemE, "Mainframe Banking System", "Stores all of the core banking information about customers, accounts, transactions, etc.")

    System_Ext(SystemC, "E-mail System", "The internal Microsoft Exchange e-mail system.")
    System_Ext(SystemD, "Mainframe Banking System", "Stores all of the core banking information about customers, accounts, transactions, etc.")

    Rel(customerA, SystemAA, "Uses")
    Rel(SystemAA, SystemE, "Uses")
    Rel(SystemAA, SystemC, "Sends e-mails", "SMTP")
    Rel(SystemAA, SystemD, "Uses")
  }`,
        mindmap: `mindmap
  root((mindmap))
    Origins
      Long history
      ::icon(fa fa-book)
      Popularisation
        British popular psychology author Tony Buzan
    Research
      On effectiveness<br/>and features
      On Automatic creation
        Uses
            Creative techniques
            Strategic planning
            Argument mapping
    Tools
      Pen and paper
      Mermaid`,
        timeline: `timeline
    title History of Social Media Platform
    2002 : LinkedIn
    2004 : Facebook
         : Google
    2005 : Youtube
    2006 : Twitter`,
        sankey: `sankey-beta

Agricultural 'waste',Bio-conversion,124.729
Bio-conversion,Liquid,0.597
Bio-conversion,Losses,26.862
Bio-conversion,Solid,280.322
Bio-conversion,Gas,81.144`,
        xy: `xychart-beta
    title "Sales Revenue"
    x-axis [jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec]
    y-axis "Revenue (in $)" 4000 --> 11000
    bar [5000, 6000, 7500, 8200, 9500, 10500, 11000, 10200, 9200, 8500, 7000, 6000]
    line [5000, 6000, 7500, 8200, 9500, 10500, 11000, 10200, 9200, 8500, 7000, 6000]`,
        block: `block-beta
columns 1
  db("DB")
  blockArrowId6<["&nbsp;&nbsp;&nbsp;"]>(down)
  block:ID
    A
    B["A wide one in the middle"]
    C
  end
  space
  D
  ID --> D
  C --> D
  style B fill:#969,stroke:#333,stroke-width:4px`,
        packet: `packet-beta
0-15: "Source Port"
16-31: "Destination Port"
32-63: "Sequence Number"
64-95: "Acknowledgment Number"
96-99: "Data Offset"
100-105: "Reserved"
106: "URG"
107: "ACK"
108: "PSH"
109: "RST"
110: "SYN"
111: "FIN"
112-127: "Window"
128-143: "Checksum"
144-159: "Urgent Pointer"
160-191: "(Options and Padding)"
192-255: "Data"`,
        kanban: `---
config:
  kanban:
    ticketBaseUrl: 'https://mermaidchart.atlassian.net/browse/#TICKET#'
---
kanban
  Todo
    [Create Documentation]
    docs[Create Blog about the new diagram]
  [In progress]
    id6[Create renderer so that it works in all cases.]
  Ready for test
    id4[Create parsing tests]@{ ticket: MC-2038, assigned: 'K.Sveidqvist', priority: 'High' }
  Done
    id5[define getData]`,
        architecture: `architecture-beta
    group api(cloud)[API]

    service db(database)[Database] in api
    service disk1(disk)[Storage] in api
    service disk2(disk)[Storage] in api
    service server(server)[Server] in api

    db:L -- R:server
    disk1:T -- B:server
    disk2:T -- B:db`,
        radar: `---
title: "Grades"
---
radar-beta
  axis m["Math"], s["Science"], e["English"]
  axis h["History"], g["Geography"], a["Art"]
  curve a["Alice"]{85, 90, 80, 70, 75, 90}
  curve b["Bob"]{70, 75, 85, 80, 90, 85}

  max 100
  min 0`,
        treemap: `treemap-beta
"Category A"
    "Item A1": 10
    "Item A2": 20
"Category B"
    "Item B1": 15
    "Item B2": 25`
    };

    // Theme selector initialization and change event
    themeSelector.value = currentTheme;
    themeSelector.addEventListener('change', function() {
        const newTheme = this.value;
        editor.setOption('theme', newTheme);
        localStorage.setItem('editorTheme', newTheme);
        currentTheme = newTheme;
    });

    // Handle sample selection
    sampleSelector.addEventListener('change', (e) => {
        const selectedType = e.target.value;
        if (selectedType && samples[selectedType]) {
            editor.setValue(samples[selectedType]);
            renderDiagram();
        }
    });

    // CodeMirror handles its own change events
    editor.on('change', () => {
        const data = {
            code: editor.getValue(),
            timestamp: Date.now()
        };
        localStorage.setItem(CONFIG.MERMAID_CODE_KEY, JSON.stringify(data));
        debouncedRender();
    });

    const showToast = (message) => {
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, CONFIG.TOAST_DURATION);
    };

    const downloadDiagram = (format) => {
        const svgElement = mermaidDiagram.querySelector('svg');
        if (!svgElement) {
            showToast(CONFIG.MESSAGES.NO_DIAGRAM);
            return;
        }

        // Calculate size and position
        console.log('SVG element info:', {
            clientWidth: svgElement.clientWidth,
            clientHeight: svgElement.clientHeight,
            viewBox: svgElement.getAttribute('viewBox')
        });
        
        const bbox = getSvgDimensions(svgElement);
        const { width, height, x, y } = bbox;
        console.log('Using BBox:', { x, y, width, height });

        // Check if dimensions exceed browser limits
        if (width > CONFIG.MAX_DIMENSION || height > CONFIG.MAX_DIMENSION) {
            console.warn('Diagram dimensions exceed maximum allowed size:', { width, height });
            showToast(CONFIG.MESSAGES.DIAGRAM_TOO_LARGE);
            return;
        }

        // Convert SVG to image and download
        convertSvgToImage(
            svgElement,
            bbox,
            format,
            (dataUrl) => {
                const link = document.createElement('a');
                link.download = `diagram.${format}`;
                link.href = dataUrl;
                link.click();
            },
            (errorMessage) => {
                showToast(errorMessage);
            }
        );
    };

    const renderDiagram = async () => {
        const mermaidTemp = document.getElementById('mermaid-temp');
        
        try {
            const mermaidCode = editor.getValue();
            
            // 먼저 parse로 유효성 검사 (DOM 삽입 방지)
            const parseResult = await mermaid.parse(mermaidCode);
            if (!parseResult) {
                // parse 실패 시 차트 유지
                return;
            }
            
            const uniqueId = 'graphDiv-' + Date.now();
            
            // 임시 컨테이너에 먼저 렌더링 시도
            mermaidTemp.innerHTML = '';
            const result = await mermaid.render(uniqueId, mermaidCode);
            
            // 성공했을 때만 실제 다이어그램 영역 업데이트
            mermaidDiagram.innerHTML = result.svg;
            
            // 에러 마커 제거 (성공 시)
            editor.getAllMarks().forEach(mark => mark.clear());

            // Initialize SVG Pan Zoom
            const svgElement = mermaidDiagram.querySelector('svg');
            if (svgElement) {
                // Log original SVG size before applying pan-zoom
                const viewport = svgElement.querySelector('.svg-pan-zoom_viewport') || svgElement;
                const bbox = viewport.getBBox();
                console.log('=== Rendered Diagram Info ===');
                console.log('Original SVG size:', {
                    width: bbox.width,
                    height: bbox.height,
                    x: bbox.x,
                    y: bbox.y,
                    aspectRatio: (bbox.width / bbox.height).toFixed(2)
                });
                console.log('SVG viewBox:', svgElement.getAttribute('viewBox'));
                console.log('============================');
                
                // Destroy existing instance if present (prevent memory leaks)
                if (panZoomInstance) {
                    try { panZoomInstance.destroy(); } catch(e) {}
                }

                // Adjust Mermaid SVG style (prevent conflict with PanZoom)
                // Remove max-width set by Mermaid and set to 100% to fill the container
                svgElement.style.maxWidth = 'none';
                svgElement.style.height = '100%';
                svgElement.style.width = '100%';

                panZoomInstance = svgPanZoom(svgElement, {
                    zoomEnabled: true,
                    controlIconsEnabled: false,
                    fit: true,
                    center: true,
                    minZoom: 0.5,
                    maxZoom: 10,
                    onZoom: function(newZoom) {
                        const zoomLevelEl = document.getElementById('zoom-level');
                        if (zoomLevelEl) {
                            zoomLevelEl.textContent = `${Math.round(newZoom * 100)}%`;
                        }
                    }
                });
                
                // Initial zoom level display
                const zoomLevelEl = document.getElementById('zoom-level');
                if (zoomLevelEl) {
                    zoomLevelEl.textContent = `${Math.round(panZoomInstance.getZoom() * 100)}%`;
                }
            }
        } catch (e) {
            // parse 실패 또는 render 실패 시 차트 유지
            mermaidTemp.innerHTML = '';
            
            // Frontmatter 줄 수 계산
            const mermaidCode = editor.getValue();
            const lines = mermaidCode.split('\n');
            let frontmatterLines = 0;
            
            // Frontmatter 감지: 첫 줄이 ---로 시작하면
            if (lines[0] && lines[0].trim() === '---') {
                // 두 번째 ---를 찾아서 frontmatter 줄 수 계산
                for (let i = 1; i < lines.length; i++) {
                    frontmatterLines++;
                    if (lines[i] && lines[i].trim() === '---') {
                        frontmatterLines++; // 마지막 --- 포함
                        break;
                    }
                }
            }
            
            console.log('Frontmatter lines detected:', frontmatterLines);
            
            // 에러 메시지에서 줄 번호 추출 (다양한 패턴 지원)
            const errorMessage = e.message || e.str || String(e);
            let errorLine = null;
            
            // 패턴 1: "Parse error on line 15"
            let lineMatch = errorMessage.match(/line[\s:]+(\d+)/i);
            if (lineMatch) {
                errorLine = parseInt(lineMatch[1], 10) - 1 + frontmatterLines;
            }
            
            // 패턴 2: e.hash.line (파서 에러 객체)
            if (e.hash && e.hash.line !== undefined) {
                errorLine = e.hash.line - 1 + frontmatterLines;
            }
            
            // 패턴 3: e.hash.loc.first_line
            if (e.hash && e.hash.loc && e.hash.loc.first_line !== undefined) {
                errorLine = e.hash.loc.first_line - 1 + frontmatterLines;
            }
            
            console.log('Detected error line (before adjustment):', errorLine - frontmatterLines);
            console.log('Adjusted error line (with frontmatter):', errorLine);
            
            if (errorLine !== null && errorLine >= 0) {
                const lineLength = editor.getLine(errorLine)?.length || 0;
                
                // 기존 마커 제거
                editor.getAllMarks().forEach(mark => mark.clear());
                
                // 에러 라인에 빨간색 밑줄 표시
                if (errorLine < editor.lineCount()) {
                    editor.markText(
                        { line: errorLine, ch: 0 },
                        { line: errorLine, ch: lineLength },
                        { 
                            className: 'error-line',
                            title: errorMessage
                        }
                    );
                    
                    // 에러 라인으로 스크롤
                    editor.scrollIntoView({ line: errorLine, ch: 0 }, 100);
                }
            }
        }
    };

    // Debounce function: executes the function if there are no further calls for the specified time.
    const debouncedRender = debounce(renderDiagram, CONFIG.DEBOUNCE_DELAY);

    const setMermaidCodeFromUrl = () => {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        if (code) {
            try {
                // Base64 decode then URI decode
                const decodedCode = decodeURIComponent(atob(code));
                editor.setValue(decodedCode);
                return true;
            } catch (e) {
                console.error('URL parameter decoding error:', e);
                showToast(CONFIG.MESSAGES.URL_DECODE_FAILED);
            }
        }
        return false;
    };

    copyUrlBtn.addEventListener('click', () => {
        const mermaidCode = editor.getValue();
        // URI encode then Base64 encode
        const encodedCode = btoa(encodeURIComponent(mermaidCode));
        const url = `${window.location.origin}${window.location.pathname}?code=${encodedCode}`;
        
        navigator.clipboard.writeText(url).then(() => {
            showToast(CONFIG.MESSAGES.URL_COPIED);
        }, (err) => {
            console.error('Clipboard copy failed:', err);
            showToast(CONFIG.MESSAGES.URL_COPY_FAILED);
        });
    });

    // Save text file
    saveTxtBtn.addEventListener('click', async () => {
        const text = editor.getValue();
        
        try {
            const saved = await saveFile(text, 'mermaid-diagram.txt', 'text/plain');
            if (saved) {
                showToast(CONFIG.MESSAGES.FILE_SAVED);
            }
        } catch (err) {
            console.error('File save error:', err);
            showToast(CONFIG.MESSAGES.FILE_SAVE_FAILED);
        }
    });

    // Click load text file button
    loadTxtBtn.addEventListener('click', () => {
        loadTxtInput.click();
    });

    // Handle file selection
    loadTxtInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            editor.setValue(content);
            
            // Render diagram
            renderDiagram();
            
            // Update auto-save
            const data = {
                code: content,
                timestamp: Date.now()
            };
            localStorage.setItem(CONFIG.MERMAID_CODE_KEY, JSON.stringify(data));
            
            showToast(CONFIG.MESSAGES.FILE_LOADED);
        };
        reader.onerror = () => {
            showToast(CONFIG.MESSAGES.FILE_LOAD_FAILED);
        };
        reader.readAsText(file);
        
        // Reset to allow selecting the same file again
        loadTxtInput.value = '';
    });

    // Unified export button toggle
    exportBtn.addEventListener('click', () => {
        const parent = exportBtn.closest('.export-dropdown');
        const isOpen = parent.classList.contains('open');
        parent.classList.toggle('open');
        exportBtn.setAttribute('aria-expanded', String(!isOpen));
        exportMenu.setAttribute('aria-hidden', String(isOpen));
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!exportMenu.contains(e.target) && !exportBtn.contains(e.target)) {
            const parent = exportBtn.closest('.export-dropdown');
            if (parent.classList.contains('open')) {
                parent.classList.remove('open');
                exportBtn.setAttribute('aria-expanded', 'false');
                exportMenu.setAttribute('aria-hidden', 'true');
            }
        }
    });

    // Export menu selection
    exportMenu.addEventListener('click', (e) => {
        const btn = e.target.closest('.export-item');
        if (!btn) return;
        const format = btn.getAttribute('data-format');
        const parent = exportBtn.closest('.export-dropdown');
        parent.classList.remove('open');
        exportBtn.setAttribute('aria-expanded', 'false');
        exportMenu.setAttribute('aria-hidden', 'true');

        if (format === 'png' || format === 'jpg') {
            downloadDiagram(format);
        } else if (format === 'svg') {
            const svgElement = mermaidDiagram.querySelector('svg');
            if (!svgElement) { showToast(CONFIG.MESSAGES.NO_DIAGRAM); return; }
            try {
                const clonedSvg = prepareSvgForExport(svgElement);
                const bbox = getSvgDimensions(svgElement);
                const { width, height, x, y } = bbox;
                clonedSvg.setAttribute('width', width);
                clonedSvg.setAttribute('height', height);
                clonedSvg.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
                if (!clonedSvg.hasAttribute('xmlns')) clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                if (!clonedSvg.hasAttribute('xmlns:xlink')) clonedSvg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
                const serializer = new XMLSerializer();
                const svgString = serializer.serializeToString(clonedSvg);
                const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
                const url = URL.createObjectURL(svgBlob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'diagram.svg';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                showToast('SVG downloaded successfully!');
            } catch (error) {
                console.error('SVG download error:', error);
                showToast('Failed to download SVG');
            }
        } else if (format === 'pdf') {
            const svgElement = mermaidDiagram.querySelector('svg');
            if (!svgElement) { showToast(CONFIG.MESSAGES.NO_DIAGRAM); return; }
            try {
                const bbox = getSvgDimensions(svgElement);
                convertSvgToImage(
                    svgElement,
                    bbox,
                    'png',
                    (dataUrl) => {
                        try {
                            const { jsPDF } = window.jspdf || {};
                            if (!jsPDF) { showToast(CONFIG.MESSAGES.PDF_FAILED); return; }
                            const orientation = bbox.width > bbox.height ? 'landscape' : 'portrait';
                            const pdf = new jsPDF({ orientation, unit: 'pt', format: 'a4' });
                            const pageWidth = pdf.internal.pageSize.getWidth();
                            const pageHeight = pdf.internal.pageSize.getHeight();
                            const margin = 20;
                            const imgWidth = bbox.width + CONFIG.PADDING * 2;
                            const imgHeight = bbox.height + CONFIG.PADDING * 2;
                            const maxWidth = pageWidth - margin * 2;
                            const maxHeight = pageHeight - margin * 2;
                            const scale = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
                            const renderWidth = imgWidth * scale;
                            const renderHeight = imgHeight * scale;
                            const offsetX = (pageWidth - renderWidth) / 2;
                            const offsetY = (pageHeight - renderHeight) / 2;
                            pdf.addImage(dataUrl, 'PNG', offsetX, offsetY, renderWidth, renderHeight);
                            pdf.save('diagram.pdf');
                            showToast(CONFIG.MESSAGES.PDF_SUCCESS);
                        } catch (err) {
                            console.error('PDF generation error:', err);
                            showToast(CONFIG.MESSAGES.PDF_FAILED);
                        }
                    },
                    (errorMessage) => { console.error('Failed to convert SVG for PDF:', errorMessage); showToast(CONFIG.MESSAGES.PDF_FAILED); }
                );
            } catch (err) {
                console.error('PDF export error:', err);
                showToast(CONFIG.MESSAGES.PDF_FAILED);
            }
        }
    });

    // Copy image to clipboard
    copyImageBtn.addEventListener('click', async () => {
        const svgElement = mermaidDiagram.querySelector('svg');
        if (!svgElement) {
            showToast(CONFIG.MESSAGES.NO_DIAGRAM);
            return;
        }

        // Check if Clipboard API is supported
        if (!navigator.clipboard || !navigator.clipboard.write) {
            showToast(CONFIG.MESSAGES.CLIPBOARD_NOT_SUPPORTED);
            return;
        }

        const bbox = getSvgDimensions(svgElement);
        const { width, height } = bbox;

        // Check if dimensions exceed browser limits
        if (width > CONFIG.MAX_DIMENSION || height > CONFIG.MAX_DIMENSION) {
            console.warn('Diagram dimensions exceed maximum allowed size:', { width, height });
            showToast(CONFIG.MESSAGES.DIAGRAM_TOO_LARGE);
            return;
        }

        try {
            await copyImageToClipboard(svgElement, bbox);
            showToast(CONFIG.MESSAGES.CLIPBOARD_SUCCESS);
        } catch (error) {
            console.error('Clipboard copy error:', error);
            showToast(CONFIG.MESSAGES.CLIPBOARD_FAILED);
        }
    });

    // Background pattern toggle
    const applyBackground = (pattern) => {
        const isDark = document.body.classList.contains('dark-mode');
        if (pattern === 'dot') {
            const dotColor = isDark ? '#444' : '#d0d0d0';
            mermaidDiagram.style.backgroundImage = `radial-gradient(circle, ${dotColor} 1px, transparent 1px)`;
            mermaidDiagram.style.backgroundSize = '20px 20px';
            toggleBackgroundBtn.setAttribute('data-pattern', 'dot');
        } else {
            const lineColor = isDark ? '#444' : '#e0e0e0';
            mermaidDiagram.style.backgroundImage = `linear-gradient(${lineColor} 1px, transparent 1px), linear-gradient(90deg, ${lineColor} 1px, transparent 1px)`;
            mermaidDiagram.style.backgroundSize = '20px 20px';
            toggleBackgroundBtn.setAttribute('data-pattern', 'grid');
        }
    };

    toggleBackgroundBtn.addEventListener('click', () => {
        currentBackground = currentBackground === 'dot' ? 'grid' : 'dot';
        localStorage.setItem(CONFIG.BACKGROUND_PATTERN_KEY, currentBackground);
        applyBackground(currentBackground);
    });

    // Apply saved background pattern
    applyBackground(currentBackground);

    // Dark mode toggle
    const applyDarkMode = (isDark) => {
        if (isDark) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
        // Update Mermaid theme
        mermaid.initialize({ 
            startOnLoad: false,
            securityLevel: 'strict',
            suppressErrors: true,
            theme: isDark ? 'dark' : 'default',
            flowchart: { 
                htmlLabels: false,
                useMaxWidth: false
            },
            gantt: {
                displayMode: 'compact',
                todayMarker: 'off'
            }
        });
        // Re-render diagram with new theme
        renderDiagram();
        // Reapply background pattern with new colors
        applyBackground(currentBackground);
    };

    // Initialize dark mode
    applyDarkMode(isDarkMode);

    // Dark mode toggle button
    darkModeToggle.addEventListener('click', () => {
        isDarkMode = !isDarkMode;
        localStorage.setItem(CONFIG.DARK_MODE_KEY, isDarkMode);
        applyDarkMode(isDarkMode);
    });

    // Zoom level update function
    const updateZoomLevel = (zoom) => {
        const zoomLevelEl = document.getElementById('zoom-level');
        if (zoomLevelEl) {
            zoomLevelEl.textContent = `${Math.round(zoom * 100)}%`;
        }
    };

    // Zoom controls
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const zoomResetBtn = document.getElementById('zoom-reset-btn');

    zoomInBtn?.addEventListener('click', () => {
        if (panZoomInstance) {
            panZoomInstance.zoomIn();
            updateZoomLevel(panZoomInstance.getZoom());
        }
    });

    zoomOutBtn?.addEventListener('click', () => {
        if (panZoomInstance) {
            panZoomInstance.zoomOut();
            updateZoomLevel(panZoomInstance.getZoom());
        }
    });

    zoomResetBtn?.addEventListener('click', () => {
        if (panZoomInstance) {
            panZoomInstance.resetZoom();
            panZoomInstance.resize();
            panZoomInstance.fit();
            panZoomInstance.center();
            updateZoomLevel(panZoomInstance.getZoom());
        }
    });

    // Keyboard shortcuts for zoom controls and panning
    document.addEventListener('keydown', (e) => {
        // Check if target is not the editor to avoid conflicts
        if (e.target.classList.contains('CodeMirror')) return;
        
        if (e.ctrlKey || e.metaKey) {
            if (e.key === '+' || e.key === '=') {
                e.preventDefault();
                if (panZoomInstance) {
                    panZoomInstance.zoomIn();
                    updateZoomLevel(panZoomInstance.getZoom());
                }
            } else if (e.key === '-' || e.key === '_') {
                e.preventDefault();
                if (panZoomInstance) {
                    panZoomInstance.zoomOut();
                    updateZoomLevel(panZoomInstance.getZoom());
                }
            } else if (e.key === '0') {
                e.preventDefault();
                if (panZoomInstance) {
                    panZoomInstance.resetZoom();
                    panZoomInstance.resize();
                    panZoomInstance.fit();
                    panZoomInstance.center();
                    updateZoomLevel(panZoomInstance.getZoom());
                }
            } else if (e.key === 'i' || e.key === 'k' || e.key === 'j' || e.key === 'l') {
                e.preventDefault();
                if (panZoomInstance) {
                    const pan = panZoomInstance.getPan();
                    const panStep = 50; // pixels to move per key press
                    
                    switch (e.key) {
                        case 'i':
                            panZoomInstance.pan({ x: pan.x, y: pan.y - panStep });
                            break;
                        case 'k':
                            panZoomInstance.pan({ x: pan.x, y: pan.y + panStep });
                            break;
                        case 'j':
                            panZoomInstance.pan({ x: pan.x - panStep, y: pan.y });
                            break;
                        case 'l':
                            panZoomInstance.pan({ x: pan.x + panStep, y: pan.y });
                            break;
                    }
                }
            }
        }
    });

    // Handle URL parameters and initial render
    const loadedFromUrl = setMermaidCodeFromUrl();
    
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
                // Ignore if legacy format (plain text) or invalid JSON
                console.log('Invalid or legacy auto-save data found.');
            }
        }
    }

    await renderDiagram();
});



