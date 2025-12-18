const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// -- STATE --
let strokes = [];
let historyStack = [];
let redoStack = [];

let currentTool = 'pen';
let currentColor = '#ffffff';
let isDarkTheme = true;
let isTransparent = false;
let isLocked = false;

// Text Settings
let textSettings = {
    size: 24,
    bold: false,
    underline: false
};
let isMenuOpen = false;

// Feature toggles
let shapeRecognitionEnabled = false;
let lineSnapEnabled = false;
let strokeWidth = 3;  // Default stroke width for pen/brush

// Camera
let cameraOffset = { x: 0, y: 0 };
let cameraZoom = 1;

// Interaction flags (CRITICAL - these were missing!)
let isDrawing = false;
let isPanning = false;

// Transform State
let transformState = {
    isDragging: false,
    action: null,
    targetIndex: -1,
    startPos: { x: 0, y: 0 },
    startValues: {},
    initialMouseDist: 0,
    initialMouseAngle: 0
};

// Multi-select state
let selectedIndices = [];  // Array of selected stroke indices
let isMarqueeSelecting = false;
let marqueeStart = { x: 0, y: 0 };
let marqueeEnd = { x: 0, y: 0 };

let points = [];
let lastPointerPos = { x: 0, y: 0 };


// -- INITIALIZATION --
function init() {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Tools
    document.querySelectorAll('[data-tool]').forEach(btn => {
        btn.addEventListener('click', () => {
            const tool = btn.dataset.tool;
            if (tool === 'lock') {
                toggleLock();
            } else {
                setTool(tool);
            }
        });
    });

    // Menu
    const menuBtn = document.getElementById('menu-btn');
    if (menuBtn) menuBtn.addEventListener('click', toggleMenu);

    // Text Settings
    const sizeInput = document.getElementById('text-size-input');
    if (sizeInput) sizeInput.addEventListener('change', (e) => textSettings.size = parseInt(e.target.value) || 24);

    const boldBtn = document.getElementById('text-bold-btn');
    if (boldBtn) boldBtn.addEventListener('click', () => {
        textSettings.bold = !textSettings.bold;
        boldBtn.classList.toggle('active', textSettings.bold);
    });

    const underlineBtn = document.getElementById('text-underline-btn');
    if (underlineBtn) underlineBtn.addEventListener('click', () => {
        textSettings.underline = !textSettings.underline;
        underlineBtn.classList.toggle('active', textSettings.underline);
    });

    // Shortcuts
    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            undo();
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
            e.preventDefault();
            redo();
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (transformState.targetIndex !== -1 && !isDrawing && !transformState.isDragging && currentTool === 'move') {
                saveState();
                strokes.splice(transformState.targetIndex, 1);
                transformState.targetIndex = -1;
                redraw();
            }
        }
    });

    // Colors
    document.querySelectorAll('[data-color]').forEach(btn => {
        btn.addEventListener('click', () => {
            const color = btn.dataset.color;
            if (color !== 'transparent') {
                currentColor = color;
                const hexInput = document.getElementById('hex-color-input');
                if (hexInput) hexInput.value = color.replace('#', '');
            }
        });
    });

    // Hex Input
    const hexInput = document.getElementById('hex-color-input');
    if (hexInput) {
        hexInput.addEventListener('input', (e) => {
            let val = e.target.value;
            if (!val.startsWith('#')) val = '#' + val;
            if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                currentColor = val;
            }
        });
    }

    // Actions
    const zoomIn = document.getElementById('zoom-in');
    const zoomOut = document.getElementById('zoom-out');
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    const themeToggle = document.getElementById('theme-toggle');
    const transparencyToggle = document.getElementById('transparency-toggle');
    const saveBtn = document.getElementById('save-btn');

    if (zoomIn) zoomIn.addEventListener('click', () => adjustZoom(0.1));
    if (zoomOut) zoomOut.addEventListener('click', () => adjustZoom(-0.1));
    if (undoBtn) undoBtn.addEventListener('click', undo);
    if (redoBtn) redoBtn.addEventListener('click', redo);
    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
    if (transparencyToggle) transparencyToggle.addEventListener('click', toggleTransparency);
    if (saveBtn) saveBtn.addEventListener('click', saveCanvas);

    // Feature Toggles
    const shapeRecogToggle = document.getElementById('shape-recognition-toggle');
    const lineSnapToggle = document.getElementById('line-snap-toggle');
    if (shapeRecogToggle) shapeRecogToggle.addEventListener('change', (e) => shapeRecognitionEnabled = e.target.checked);
    if (lineSnapToggle) lineSnapToggle.addEventListener('change', (e) => lineSnapEnabled = e.target.checked);

    // Stroke Width Slider
    const strokeWidthSlider = document.getElementById('stroke-width-slider');
    const strokeWidthValue = document.getElementById('stroke-width-value');
    if (strokeWidthSlider) {
        strokeWidthSlider.addEventListener('input', (e) => {
            strokeWidth = parseInt(e.target.value);
            if (strokeWidthValue) strokeWidthValue.textContent = strokeWidth + 'px';
        });
    }

    // Canvas Events
    canvas.addEventListener('mousedown', onPointerDown);
    canvas.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    currentColor = '#ffffff';
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    redraw();
}

function toggleMenu() {
    isMenuOpen = !isMenuOpen;
    const panel = document.getElementById('properties-panel');
    const btn = document.getElementById('menu-btn');
    if (panel) panel.style.display = isMenuOpen ? 'flex' : 'none';
    if (btn) btn.classList.toggle('active', isMenuOpen);
}

function toggleLock() {
    isLocked = !isLocked;
    const lockBtn = document.querySelector('[data-tool="lock"]');
    if (lockBtn) {
        lockBtn.classList.toggle('locked', isLocked);
        lockBtn.classList.toggle('active', isLocked);
    }
}

function toggleTheme() {
    isDarkTheme = !isDarkTheme;
    document.body.classList.toggle('theme-dark', isDarkTheme);
    document.body.classList.toggle('theme-light', !isDarkTheme);
    redraw();
}

function toggleTransparency() {
    isTransparent = !isTransparent;
    document.body.classList.toggle('transparent-bg', isTransparent);
    redraw();
}

function saveCanvas() {
    const link = document.createElement('a');
    link.download = 'drawly-canvas.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
}

function setTool(tool) {
    if (isLocked) return;
    currentTool = tool;

    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));

    const activeBtn = document.querySelector(`.tool-btn[data-tool="${tool}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    if (tool === 'hand') canvas.style.cursor = 'grab';
    else if (tool === 'text') canvas.style.cursor = 'text';
    else if (tool === 'move') canvas.style.cursor = 'default';
    else canvas.style.cursor = 'crosshair';

    transformState.targetIndex = -1;
    redraw();
}

// -- HISTORY --
function saveState() {
    historyStack.push(JSON.parse(JSON.stringify(strokes)));
    if (historyStack.length > 50) historyStack.shift();
    redoStack = [];
    updateHistoryUI();
}

function undo() {
    if (historyStack.length === 0) return;
    redoStack.push(JSON.parse(JSON.stringify(strokes)));
    strokes = historyStack.pop();
    redraw();
    updateHistoryUI();
}

function redo() {
    if (redoStack.length === 0) return;
    historyStack.push(JSON.parse(JSON.stringify(strokes)));
    strokes = redoStack.pop();
    redraw();
    updateHistoryUI();
}

function updateHistoryUI() {
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    if (undoBtn) undoBtn.style.opacity = historyStack.length > 0 ? 1 : 0.4;
    if (redoBtn) redoBtn.style.opacity = redoStack.length > 0 ? 1 : 0.4;
}


// -- BOUNDING BOX LOGIC --
function getStrokeBounds(s) {
    if (!s || !s.data) return { x: 0, y: 0, w: 0, h: 0, cx: 0, cy: 0 };

    if (s.type === 'text') {
        const size = s.data.style?.size || 24;
        ctx.font = `${s.data.style?.bold ? 'bold' : 'normal'} ${size}px "Kalam", cursive`;

        // Handle multi-line text
        const lines = (s.data.text || '').split('\n');
        const lineHeight = size * 1.2;

        // Measure max width
        let maxWidth = 0;
        lines.forEach(line => {
            const m = ctx.measureText(line);
            if (m.width > maxWidth) maxWidth = m.width;
        });

        const w = maxWidth;
        const h = lines.length * lineHeight;
        const cx = (s.data.x || 0) + w / 2;
        const cy = (s.data.y || 0) - h / 2;
        return { x: s.data.x || 0, y: (s.data.y || 0) - h, w, h, cx, cy };
    }
    else if (s.type === 'shape') {
        const d = s.data;
        if (d.type === 'rectangle' || d.type === 'diamond') {
            return { x: d.x || 0, y: d.y || 0, w: d.w || 0, h: d.h || 0, cx: (d.x || 0) + (d.w || 0) / 2, cy: (d.y || 0) + (d.h || 0) / 2 };
        }
        else if (d.type === 'circle') {
            const r = d.r || 0;
            return { x: (d.cx || 0) - r, y: (d.cy || 0) - r, w: r * 2, h: r * 2, cx: d.cx || 0, cy: d.cy || 0 };
        }
        else if (d.type === 'line' || d.type === 'arrow') {
            const mx = Math.min(d.x1 || 0, d.x2 || 0);
            const my = Math.min(d.y1 || 0, d.y2 || 0);
            const Mx = Math.max(d.x1 || 0, d.x2 || 0);
            const My = Math.max(d.y1 || 0, d.y2 || 0);
            return { x: mx, y: my, w: Mx - mx, h: My - my, cx: ((d.x1 || 0) + (d.x2 || 0)) / 2, cy: ((d.y1 || 0) + (d.y2 || 0)) / 2 };
        }
        else if (d.type === 'triangle') {
            // Always calculate bounds from actual triangle points
            const p1 = d.p1 || { x: 0, y: 0 };
            const p2 = d.p2 || { x: 0, y: 0 };
            const p3 = d.p3 || { x: 0, y: 0 };
            const minX = Math.min(p1.x, p2.x, p3.x);
            const maxX = Math.max(p1.x, p2.x, p3.x);
            const minY = Math.min(p1.y, p2.y, p3.y);
            const maxY = Math.max(p1.y, p2.y, p3.y);
            const w = maxX - minX;
            const h = maxY - minY;
            const cx = minX + w / 2;
            const cy = minY + h / 2;
            return { x: minX, y: minY, w, h, cx, cy };
        }
    }
    else if (s.type === 'path' || s.type === 'brush') {
        if (!Array.isArray(s.data) || s.data.length === 0) return { x: 0, y: 0, w: 0, h: 0, cx: 0, cy: 0 };
        let mnX = Infinity, mxX = -Infinity, mnY = Infinity, mxY = -Infinity;
        s.data.forEach(p => {
            if (!p) return;
            mnX = Math.min(mnX, p.x); mxX = Math.max(mxX, p.x);
            mnY = Math.min(mnY, p.y); mxY = Math.max(mxY, p.y);
        });
        if (!isFinite(mnX)) return { x: 0, y: 0, w: 0, h: 0, cx: 0, cy: 0 };
        const w = mxX - mnX;
        const h = mxY - mnY;
        const cx = mnX + w / 2;
        const cy = mnY + h / 2;
        return { x: mnX, y: mnY, w, h, cx, cy };
    }
    return { x: 0, y: 0, w: 0, h: 0, cx: 0, cy: 0 };
}


// -- POINTER HELPERS --
function getScreenPos(e) { return { x: e.clientX, y: e.clientY }; }

function toWorldPos(screen) {
    return {
        x: (screen.x - cameraOffset.x) / cameraZoom,
        y: (screen.y - cameraOffset.y) / cameraZoom
    };
}

function rotatePoint(p, center, angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dx = p.x - center.x;
    const dy = p.y - center.y;
    return {
        x: center.x + (dx * cos - dy * sin),
        y: center.y + (dx * sin + dy * cos)
    };
}


function onPointerDown(e) {
    if (isLocked) {
        if (currentTool === 'hand' || e.button === 1) {
            isPanning = true;
            canvas.style.cursor = 'grabbing';
            lastPointerPos = getScreenPos(e);
        }
        return;
    }

    const screen = getScreenPos(e);
    const world = toWorldPos(screen);
    lastPointerPos = screen;

    if (currentTool === 'text') {
        // Check if clicking on existing text to edit
        const hit = detectHit(world);
        if (hit !== -1 && strokes[hit]?.type === 'text') {
            editExistingText(hit, screen);
        } else {
            createOnCanvasInput(screen.x, screen.y, world.x, world.y);
        }
        return;
    }

    if (currentTool === 'hand' || e.button === 1) {
        isPanning = true;
        canvas.style.cursor = 'grabbing';
        return;
    }

    // Check Transform Handles
    if (transformState.targetIndex !== -1 && strokes[transformState.targetIndex]) {
        const handle = detectHandleHit(world, strokes[transformState.targetIndex]);
        if (handle) {
            saveState();
            transformState.isDragging = true;
            transformState.action = handle === 'rot' ? 'rotate' : 'resize';
            transformState.startPos = world;

            const s = strokes[transformState.targetIndex];
            const b = getStrokeBounds(s);

            transformState.startValues = {
                rotation: s.rotation || 0,
                scale: s.scale || 1,
                scaleX: s.scaleX || s.scale || 1,
                scaleY: s.scaleY || s.scale || 1,
                w: b.w, h: b.h, r: s.data?.r || 0,
                size: s.data?.style?.size || 24,
                cx: b.cx, cy: b.cy,
                handle: handle,
                // Triangle points for scaling
                p1: s.data?.p1 ? { x: s.data.p1.x, y: s.data.p1.y } : null,
                p2: s.data?.p2 ? { x: s.data.p2.x, y: s.data.p2.y } : null,
                p3: s.data?.p3 ? { x: s.data.p3.x, y: s.data.p3.y } : null,
                // Path/brush data for edge scaling
                data: Array.isArray(s.data) ? s.data.map(p => p ? { x: p.x, y: p.y } : null) : null,
                minX: b.x, minY: b.y, maxX: b.x + b.w, maxY: b.y + b.h
            };

            transformState.initialMouseDist = Math.hypot(world.x - b.cx, world.y - b.cy);
            transformState.initialMouseAngle = Math.atan2(world.y - b.cy, world.x - b.cx);

            return;
        }
    }

    if (currentTool === 'move') {
        const hit = detectHit(world);
        if (hit !== -1) {
            saveState();
            // Add to selection or set as single selection
            if (!selectedIndices.includes(hit)) {
                selectedIndices = [hit];
            }
            transformState.targetIndex = hit;
            transformState.isDragging = true;
            transformState.action = 'move';
            transformState.startPos = world;
            redraw();
        } else {
            // Start marquee selection on empty space
            selectedIndices = [];
            transformState.targetIndex = -1;
            isMarqueeSelecting = true;
            marqueeStart = world;
            marqueeEnd = world;
            redraw();
        }
        return;
    }

    if (['pen', 'brush', 'rectangle', 'diamond', 'circle', 'triangle', 'arrow', 'line', 'eraser'].includes(currentTool)) {
        if (currentTool === 'eraser') {
            const hit = detectHit(world);
            if (hit !== -1) {
                saveState();
                strokes.splice(hit, 1);
                redraw();
            }
            return;
        }
        saveState();
        isDrawing = true;
        points = [world];
    }
}

function onPointerMove(e) {
    const screen = getScreenPos(e);
    const world = toWorldPos(screen);

    if (isPanning) {
        const dx = screen.x - lastPointerPos.x;
        const dy = screen.y - lastPointerPos.y;
        cameraOffset.x += dx;
        cameraOffset.y += dy;
        lastPointerPos = screen;
        redraw();
        return;
    }
    lastPointerPos = screen;

    if (isLocked) return;

    if (transformState.isDragging && transformState.targetIndex !== -1) {
        const s = strokes[transformState.targetIndex];
        if (!s) return;

        const initial = transformState.startValues;

        if (transformState.action === 'move') {
            const dx = world.x - transformState.startPos.x;
            const dy = world.y - transformState.startPos.y;
            // Move all selected strokes
            const indicesToMove = selectedIndices.length > 0 ? selectedIndices : [transformState.targetIndex];
            indicesToMove.forEach(idx => moveStroke(idx, dx, dy));
            transformState.startPos = world;
            redraw();
        }
        else if (transformState.action === 'rotate') {
            const angle = Math.atan2(world.y - initial.cy, world.x - initial.cx);
            const deltaAngle = angle - transformState.initialMouseAngle;
            // Rotate all selected strokes
            const indicesToRotate = selectedIndices.length > 0 ? selectedIndices : [transformState.targetIndex];
            indicesToRotate.forEach(idx => {
                const stroke = strokes[idx];
                if (stroke) stroke.rotation = (stroke.rotation || 0) + deltaAngle * 0.1; // Reduced for smoother rotation
            });
            redraw();
        }
        else if (transformState.action === 'resize') {
            const distFromCenter = Math.hypot(world.x - initial.cx, world.y - initial.cy);
            const ratio = distFromCenter / (transformState.initialMouseDist || 1);
            const handle = initial.handle;

            // Check if this is an edge handle (non-uniform scaling)
            const isEdgeHandle = ['t', 'b', 'l', 'r'].includes(handle);

            // Multi-select: apply uniform scale to all selected strokes
            if (selectedIndices.length > 1) {
                selectedIndices.forEach(idx => {
                    const stroke = strokes[idx];
                    if (!stroke) return;
                    // Apply uniform scale ratio
                    stroke.scaleX = (stroke.scaleX || 1) * (1 + (ratio - 1) * 0.05);
                    stroke.scaleY = (stroke.scaleY || 1) * (1 + (ratio - 1) * 0.05);
                });
                redraw();
                return;
            }

            if (s.type === 'text') {
                let newSize = (initial.size || 24) * ratio;
                newSize = Math.max(12, Math.min(300, newSize));
                if (s.data.style) s.data.style.size = newSize;
            }
            else if (s.type === 'shape') {
                if (s.data.type === 'circle') {
                    s.data.r = Math.max(5, (initial.r || 10) * ratio);
                } else if (['rectangle', 'diamond'].includes(s.data.type)) {
                    if (isEdgeHandle) {
                        // Non-uniform scaling: l/r = width only, t/b = height only
                        if (handle === 'l' || handle === 'r') {
                            s.data.w = Math.max(10, (initial.w || 10) * ratio);
                        } else {
                            s.data.h = Math.max(10, (initial.h || 10) * ratio);
                        }
                    } else {
                        // Corner handles: uniform scaling
                        s.data.w = (initial.w || 10) * ratio;
                        s.data.h = (initial.h || 10) * ratio;
                    }
                } else if (s.data.type === 'triangle') {
                    // Non-uniform scaling with edge handles
                    if (isEdgeHandle) {
                        if (handle === 'l' || handle === 'r') {
                            s.scaleX = (initial.scaleX || 1) * ratio;
                        } else {
                            s.scaleY = (initial.scaleY || 1) * ratio;
                        }
                    } else {
                        // Corner handles: uniform scaling
                        s.scaleX = (initial.scaleX || 1) * ratio;
                        s.scaleY = (initial.scaleY || 1) * ratio;
                    }
                } else {
                    s.scale = (initial.scale || 1) * ratio;
                }
            }
            else if (s.type === 'path' || s.type === 'brush') {
                // For edge handles, stretch only one side by modifying points
                if (isEdgeHandle && initial.data) {
                    // Calculate anchor point (opposite side)
                    let anchorX, anchorY;
                    if (handle === 'l') anchorX = initial.maxX;  // Anchor right
                    else if (handle === 'r') anchorX = initial.minX;  // Anchor left
                    else if (handle === 't') anchorY = initial.maxY;  // Anchor bottom
                    else if (handle === 'b') anchorY = initial.minY;  // Anchor top

                    // Modify points to stretch from anchor
                    s.data = initial.data.map(p => {
                        if (!p) return p;
                        let newX = p.x, newY = p.y;
                        if (handle === 'l' || handle === 'r') {
                            // Horizontal stretch from anchor
                            newX = anchorX + (p.x - anchorX) * ratio;
                        } else {
                            // Vertical stretch from anchor
                            newY = anchorY + (p.y - anchorY) * ratio;
                        }
                        return { x: newX, y: newY };
                    });
                    // Reset scale transforms since we're modifying points directly
                    s.scaleX = 1;
                    s.scaleY = 1;
                } else {
                    // Corner handles: uniform scaling from center
                    s.scaleX = (initial.scaleX || 1) * ratio;
                    s.scaleY = (initial.scaleY || 1) * ratio;
                }
            }
            redraw();
        }
        return;
    }

    // Update marquee selection
    if (isMarqueeSelecting) {
        marqueeEnd = world;
        redraw();
        return;
    }

    if (isDrawing) {
        points.push(world);
        redraw();
    }

    // Cursor
    if (transformState.targetIndex !== -1 && currentTool === 'move' && strokes[transformState.targetIndex]) {
        const handle = detectHandleHit(world, strokes[transformState.targetIndex]);
        if (handle === 'rot') canvas.style.cursor = 'grab';
        else if (handle) canvas.style.cursor = 'nwse-resize';
        else canvas.style.cursor = 'default';
    }
}

function onPointerUp(e) {
    if (isPanning) {
        isPanning = false;
        canvas.style.cursor = (isLocked || currentTool === 'hand') ? 'grab' : getCursorForTool(currentTool);
        return;
    }
    if (isLocked) return;

    // Finish marquee selection
    if (isMarqueeSelecting) {
        isMarqueeSelecting = false;

        // Calculate marquee bounds
        const minX = Math.min(marqueeStart.x, marqueeEnd.x);
        const maxX = Math.max(marqueeStart.x, marqueeEnd.x);
        const minY = Math.min(marqueeStart.y, marqueeEnd.y);
        const maxY = Math.max(marqueeStart.y, marqueeEnd.y);

        // Find all strokes that intersect the marquee
        selectedIndices = [];
        strokes.forEach((s, i) => {
            if (!s) return;
            const b = getStrokeBounds(s);
            // Check if stroke bounds intersect marquee bounds
            if (b.x < maxX && b.x + b.w > minX && b.y < maxY && b.y + b.h > minY) {
                selectedIndices.push(i);
            }
        });

        // Set first selected as target for transforms
        if (selectedIndices.length > 0) {
            transformState.targetIndex = selectedIndices[0];
        }

        redraw();
        return;
    }

    if (transformState.isDragging) {
        transformState.isDragging = false;
        transformState.action = null;
    }
    if (isDrawing) {
        isDrawing = false;
        if (points.length > 2) processDrawing(points);
        points = [];
        redraw();
    }
}

function onWheel(e) {
    e.preventDefault();
    adjustZoom(e.deltaY * -0.001, getScreenPos(e));
}

function adjustZoom(delta, centerScreen) {
    if (!centerScreen) centerScreen = { x: canvas.width / 2, y: canvas.height / 2 };
    const worldBefore = toWorldPos(centerScreen);
    cameraZoom = Math.min(Math.max(cameraZoom + delta, 0.1), 5);
    cameraOffset.x = centerScreen.x - worldBefore.x * cameraZoom;
    cameraOffset.y = centerScreen.y - worldBefore.y * cameraZoom;
    const zoomDisplay = document.getElementById('zoom-display');
    if (zoomDisplay) zoomDisplay.textContent = Math.round(cameraZoom * 100) + '%';
    redraw();
}

function getCursorForTool(t) {
    if (t === 'hand') return 'grab';
    if (t === 'text') return 'text';
    if (t === 'move') return 'default';
    return 'crosshair';
}


function createOnCanvasInput(screenX, screenY, worldX, worldY) {
    if (document.getElementById('temp-text-input')) return;
    const fontWeight = textSettings.bold ? 'bold' : 'normal';
    const input = document.createElement('textarea');
    input.id = 'temp-text-input';
    input.style.position = 'absolute';
    input.style.left = screenX + 'px';
    input.style.top = screenY + 'px';
    input.style.font = `${fontWeight} ${textSettings.size}px "Kalam", cursive`;
    if (textSettings.underline) input.style.textDecoration = 'underline';
    const isLightOnLight = (!isDarkTheme && currentColor === '#ffffff');
    const isDarkOnDark = (isDarkTheme && (currentColor === '#000000' || currentColor === '#333333'));
    const safeColor = isLightOnLight ? '#000000' : (isDarkOnDark ? '#ffffff' : currentColor);
    input.style.color = safeColor;
    input.style.background = isDarkTheme ? 'rgba(50,50,50,0.8)' : 'rgba(255,255,255,0.8)';
    input.style.border = '1px solid var(--accent-color)';
    input.style.borderRadius = '4px';
    input.style.padding = '4px';
    input.style.outline = 'none';
    input.style.resize = 'none';
    input.style.zIndex = '1000';
    input.style.minWidth = '50px';

    const autoResize = () => {
        input.style.height = 'auto';
        input.style.height = input.scrollHeight + 'px';
        input.style.width = 'auto';
        input.style.width = Math.max(50, input.scrollWidth + 10) + 'px';
    };
    input.addEventListener('input', autoResize);
    document.body.appendChild(input);
    requestAnimationFrame(() => input.focus());
    let cleanupRun = false;
    const finish = () => {
        if (cleanupRun) return;
        cleanupRun = true;
        if (input.value.trim()) {
            saveState();
            strokes.push({
                type: 'text',
                data: { x: worldX, y: worldY + (textSettings.size * 0.8), text: input.value, style: { ...textSettings } },
                rotation: 0,
                scale: 1,
                color: safeColor
            });
            redraw();
        }
        if (input.parentNode) input.parentNode.removeChild(input);
    };
    input.addEventListener('blur', finish);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') { cleanupRun = true; if (input.parentNode) input.parentNode.removeChild(input); }
    });
}

// Edit existing text by clicking on it
function editExistingText(strokeIndex, screenPos) {
    const s = strokes[strokeIndex];
    if (!s || s.type !== 'text') return;

    if (document.getElementById('temp-text-input')) return;

    const textData = s.data;
    const size = textData.style?.size || 24;
    const fontWeight = textData.style?.bold ? 'bold' : 'normal';

    const input = document.createElement('textarea');
    input.id = 'temp-text-input';
    input.value = textData.text || '';
    input.style.position = 'absolute';
    input.style.left = screenPos.x + 'px';
    input.style.top = screenPos.y + 'px';
    input.style.font = `${fontWeight} ${size}px "Kalam", cursive`;
    if (textData.style?.underline) input.style.textDecoration = 'underline';
    input.style.color = s.color;
    input.style.background = isDarkTheme ? 'rgba(50,50,50,0.8)' : 'rgba(255,255,255,0.8)';
    input.style.border = '1px solid var(--accent-color)';
    input.style.borderRadius = '4px';
    input.style.padding = '4px';
    input.style.outline = 'none';
    input.style.resize = 'none';
    input.style.zIndex = '1000';
    input.style.minWidth = '50px';
    input.style.minHeight = size + 'px';

    const autoResize = () => {
        input.style.height = 'auto';
        input.style.height = input.scrollHeight + 'px';
        input.style.width = 'auto';
        input.style.width = Math.max(50, input.scrollWidth + 10) + 'px';
    };
    input.addEventListener('input', autoResize);
    document.body.appendChild(input);
    requestAnimationFrame(() => {
        input.focus();
        input.select();
        autoResize();
    });

    let cleanupRun = false;
    const finish = () => {
        if (cleanupRun) return;
        cleanupRun = true;
        saveState();
        if (input.value.trim()) {
            // Update existing text
            s.data.text = input.value;
        } else {
            // Delete if empty
            strokes.splice(strokeIndex, 1);
        }
        redraw();
        if (input.parentNode) input.parentNode.removeChild(input);
    };
    input.addEventListener('blur', finish);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') { cleanupRun = true; if (input.parentNode) input.parentNode.removeChild(input); }
    });
}


function processDrawing(pts) {
    // Handle brush strokes
    if (currentTool === 'brush') {
        strokes.push({ type: 'brush', data: [...pts], color: currentColor, rotation: 0, scale: 1, strokeWidth: strokeWidth });
        return;
    }

    // Handle shape tools
    const shape = recognizeShape(pts, currentTool);
    if (shape) {
        strokes.push({ type: 'shape', data: shape, color: currentColor, rotation: 0, scale: 1, strokeWidth: strokeWidth });
    } else if (currentTool === 'pen') {
        // Check if shape recognition is enabled for pen
        if (shapeRecognitionEnabled) {
            const detected = detectFreehandShape(pts);
            if (detected) {
                strokes.push({ type: 'shape', data: detected, color: currentColor, rotation: 0, scale: 1, strokeWidth: strokeWidth });
                return;
            }
        }
        strokes.push({ type: 'path', data: [...pts], color: currentColor, rotation: 0, scale: 1, strokeWidth: strokeWidth });
    }
}
// Detect shapes from freehand drawing
function detectFreehandShape(pts) {
    if (pts.length < 12) return null;

    const start = pts[0];
    const end = pts[pts.length - 1];

    // Calculate bounding box
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    pts.forEach(p => {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    });
    const width = maxX - minX;
    const height = maxY - minY;
    const cx = minX + width / 2;
    const cy = minY + height / 2;
    const maxDim = Math.max(width, height);

    // Check if closed (start near end) - more tolerant
    const closeDist = Math.hypot(start.x - end.x, start.y - end.y);
    const isClosed = closeDist < maxDim * 0.35;

    if (!isClosed) return null;

    // Calculate average distance from center
    let totalDist = 0;
    pts.forEach(p => {
        totalDist += Math.hypot(p.x - cx, p.y - cy);
    });
    const avgDist = totalDist / pts.length;

    // Calculate variance of distance from center
    let variance = 0;
    pts.forEach(p => {
        const dist = Math.hypot(p.x - cx, p.y - cy);
        variance += Math.pow(dist - avgDist, 2);
    });
    variance = variance / pts.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = stdDev / avgDist;

    // Aspect ratio check
    const aspectRatio = width / height;
    const isRoundish = aspectRatio > 0.5 && aspectRatio < 2.0;

    // CIRCLE DETECTION: More tolerant threshold
    // CV < 0.25 is fairly circular for hand-drawn shapes
    if (coefficientOfVariation < 0.25 && isRoundish) {
        return { type: 'circle', cx: cx, cy: cy, r: avgDist };
    }

    // Corner detection for polygon shapes
    const corners = detectCorners(pts, maxDim);

    // TRIANGLE DETECTION: 3 corners (allow 2-4 for tolerance)
    if (corners.length >= 2 && corners.length <= 4) {
        // Check if it's more "pointy" (triangle-like) vs "boxy" (rectangle-like)
        // Triangles have 3 dominant corners, rectangles have 4
        if (corners.length === 3 || (corners.length === 2 && coefficientOfVariation > 0.2)) {
            // Use detected corners or estimate from bounding box
            const p1 = corners[0] || { x: cx, y: minY };
            const p2 = corners[1] || { x: minX, y: maxY };
            const p3 = corners[2] || { x: maxX, y: maxY };
            return {
                type: 'triangle',
                p1: p1, p2: p2, p3: p3,
                x: minX, y: minY, w: width, h: height
            };
        }
    }

    // RECTANGLE DETECTION: 4+ corners or closed shape with high variance
    if (corners.length >= 4 || (isClosed && coefficientOfVariation > 0.25)) {
        return { type: 'rectangle', x: minX, y: minY, w: width, h: height };
    }

    // Fallback: if closed but didn't match circle/triangle, try rectangle
    if (isClosed && coefficientOfVariation > 0.2) {
        return { type: 'rectangle', x: minX, y: minY, w: width, h: height };
    }

    return null;
}

function detectCorners(pts, maxDim) {
    const corners = [];
    const threshold = 0.6; // Angle change threshold (radians)
    const minSpacing = Math.max(8, pts.length / 8); // Minimum points between corners

    for (let i = 3; i < pts.length - 3; i++) {
        const prev = pts[Math.max(0, i - 3)];
        const curr = pts[i];
        const next = pts[Math.min(pts.length - 1, i + 3)];

        const angle1 = Math.atan2(curr.y - prev.y, curr.x - prev.x);
        const angle2 = Math.atan2(next.y - curr.y, next.x - curr.x);
        let diff = Math.abs(angle2 - angle1);
        if (diff > Math.PI) diff = 2 * Math.PI - diff;

        if (diff > threshold) {
            // Check if we're too close to last detected corner
            if (corners.length === 0 ||
                Math.hypot(curr.x - corners[corners.length - 1].x,
                    curr.y - corners[corners.length - 1].y) > maxDim * 0.15) {
                corners.push({ x: curr.x, y: curr.y });
                i += Math.floor(minSpacing / 2); // Skip ahead to avoid duplicates
            }
        }
    }

    return corners;
}

function recognizeShape(pts, forcedTool) {
    const start = pts[0];
    let end = pts[pts.length - 1];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    pts.forEach(p => {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
    });
    const width = maxX - minX;
    const height = maxY - minY;

    if (forcedTool === 'rectangle') return { type: 'rectangle', x: minX, y: minY, w: width, h: height };
    if (forcedTool === 'circle') return { type: 'circle', cx: minX + width / 2, cy: minY + height / 2, r: Math.max(width, height) / 2 };
    if (forcedTool === 'triangle') {
        // Create triangle that points in drag direction
        // Apex at start point, base perpendicular at end point
        const apex = start;
        const baseCenter = end;

        // Calculate perpendicular direction for base
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.hypot(dx, dy);

        // Perpendicular unit vector
        const perpX = -dy / length;
        const perpY = dx / length;

        // Base width is proportional to triangle height
        const baseHalf = length * 0.5;

        return {
            type: 'triangle',
            p1: { x: apex.x, y: apex.y },                                    // Apex (start point)
            p2: { x: baseCenter.x + perpX * baseHalf, y: baseCenter.y + perpY * baseHalf },  // Base left
            p3: { x: baseCenter.x - perpX * baseHalf, y: baseCenter.y - perpY * baseHalf },  // Base right
            x: minX, y: minY, w: width, h: height
        };
    }

    // Line with snap logic
    if (forcedTool === 'line' || forcedTool === 'arrow') {
        let x2 = end.x, y2 = end.y;

        if (lineSnapEnabled) {
            const angle = Math.atan2(end.y - start.y, end.x - start.x);
            const dist = Math.hypot(end.x - start.x, end.y - start.y);
            const snapThreshold = Math.PI / 12; // 15 degrees

            // Snap to horizontal (0 or 180 degrees)
            if (Math.abs(angle) < snapThreshold || Math.abs(angle - Math.PI) < snapThreshold || Math.abs(angle + Math.PI) < snapThreshold) {
                y2 = start.y;
                x2 = start.x + (end.x > start.x ? dist : -dist);
            }
            // Snap to vertical (90 or -90 degrees)
            else if (Math.abs(angle - Math.PI / 2) < snapThreshold || Math.abs(angle + Math.PI / 2) < snapThreshold) {
                x2 = start.x;
                y2 = start.y + (end.y > start.y ? dist : -dist);
            }
        }

        if (forcedTool === 'line') return { type: 'line', x1: start.x, y1: start.y, x2: x2, y2: y2 };
        if (forcedTool === 'arrow') return { type: 'arrow', x1: start.x, y1: start.y, x2: x2, y2: y2 };
    }

    if (forcedTool === 'diamond') return { type: 'diamond', x: minX, y: minY, w: width, h: height };
    if (forcedTool === 'pen') {
        const dist = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y);
        const totalLength = pts.reduce((acc, p, i) => i === 0 ? 0 : acc + dist(pts[i - 1], p), 0);
        if (totalLength > 0 && dist(start, end) / totalLength > 0.85) {
            return { type: 'line', x1: start.x, y1: start.y, x2: end.x, y2: end.y };
        }
    }
    return null;
}

function redraw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!isTransparent) {
        ctx.fillStyle = isDarkTheme ? '#121212' : '#f4f4f5';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.setTransform(cameraZoom, 0, 0, cameraZoom, cameraOffset.x, cameraOffset.y);

    strokes.forEach((s, i) => {
        if (!s || !s.data) return;

        const isActive = i === transformState.targetIndex || selectedIndices.includes(i);
        ctx.strokeStyle = s.color;
        ctx.fillStyle = s.color;
        ctx.lineWidth = s.strokeWidth || 3;  // Use stored strokeWidth
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const b = getStrokeBounds(s);

        ctx.save();
        ctx.translate(b.cx, b.cy);
        ctx.rotate(s.rotation || 0);
        if (s.type === 'path' || s.type === 'brush' || (s.type === 'shape' && ['line', 'arrow', 'triangle'].includes(s.data.type))) {
            const sx = s.scaleX || s.scale || 1;
            const sy = s.scaleY || s.scale || 1;
            if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
        }

        // Brush strokes with soft edges
        if (s.type === 'brush') {
            ctx.shadowBlur = 15;
            ctx.shadowColor = s.color;
            ctx.lineWidth = s.strokeWidth || 6;
            ctx.beginPath();
            if (s.data[0]) ctx.moveTo(s.data[0].x - b.cx, s.data[0].y - b.cy);
            s.data.forEach(p => { if (p) ctx.lineTo(p.x - b.cx, p.y - b.cy); });
            ctx.stroke();
            ctx.shadowBlur = 0; // Reset shadow
        }
        else if (s.type === 'path') {
            ctx.lineWidth = s.strokeWidth || 3;
            ctx.beginPath();
            if (s.data[0]) ctx.moveTo(s.data[0].x - b.cx, s.data[0].y - b.cy);
            s.data.forEach(p => { if (p) ctx.lineTo(p.x - b.cx, p.y - b.cy); });
            ctx.stroke();
        }
        else if (s.type === 'shape') {
            const d = s.data;
            ctx.beginPath();
            if (d.type === 'rectangle') {
                ctx.rect(d.x - b.cx, d.y - b.cy, d.w, d.h);
            }
            else if (d.type === 'diamond') {
                const w = d.w, h = d.h;
                ctx.moveTo(0, -h / 2);
                ctx.lineTo(w / 2, 0);
                ctx.lineTo(0, h / 2);
                ctx.lineTo(-w / 2, 0);
                ctx.closePath();
            }
            else if (d.type === 'circle') {
                ctx.arc(0, 0, d.r || 0, 0, Math.PI * 2);
            }
            else if (d.type === 'triangle') {
                // Draw triangle from 3 points relative to center
                const p1 = d.p1 || { x: 0, y: 0 };
                const p2 = d.p2 || { x: 0, y: 0 };
                const p3 = d.p3 || { x: 0, y: 0 };
                ctx.moveTo(p1.x - b.cx, p1.y - b.cy);
                ctx.lineTo(p2.x - b.cx, p2.y - b.cy);
                ctx.lineTo(p3.x - b.cx, p3.y - b.cy);
                ctx.closePath();
            }
            else if (d.type === 'line' || d.type === 'arrow') {
                ctx.translate(-b.cx, -b.cy);
                ctx.moveTo(d.x1, d.y1);
                ctx.lineTo(d.x2, d.y2);
                if (d.type === 'arrow') {
                    const angle = Math.atan2(d.y2 - d.y1, d.x2 - d.x1);
                    const headLen = 15;
                    ctx.moveTo(d.x2, d.y2);
                    ctx.lineTo(d.x2 - headLen * Math.cos(angle - Math.PI / 6), d.y2 - headLen * Math.sin(angle - Math.PI / 6));
                    ctx.moveTo(d.x2, d.y2);
                    ctx.lineTo(d.x2 - headLen * Math.cos(angle + Math.PI / 6), d.y2 - headLen * Math.sin(angle + Math.PI / 6));
                }
            }
            ctx.stroke();
        }
        else if (s.type === 'text') {
            const size = s.data.style?.size || 24;
            const weight = s.data.style?.bold ? 'bold' : 'normal';
            ctx.font = `${weight} ${size}px "Kalam", cursive`;

            // Handle multi-line text
            const lines = (s.data.text || '').split('\n');
            const lineHeight = size * 1.2;
            const totalHeight = lines.length * lineHeight;
            let startY = -totalHeight / 2 + lineHeight / 2;

            lines.forEach((line, i) => {
                ctx.fillText(line, -b.w / 2, startY + (i * lineHeight));
            });

            if (s.data.style?.underline) {
                lines.forEach((line, i) => {
                    const lineWidth = ctx.measureText(line).width;
                    const y = startY + (i * lineHeight) + (size * 0.1);
                    ctx.beginPath();
                    ctx.lineWidth = Math.max(1, size / 10);
                    ctx.moveTo(-b.w / 2, y);
                    ctx.lineTo(-b.w / 2 + lineWidth, y);
                    ctx.stroke();
                });
            }
        }

        // Selection Box
        if (isActive && currentTool === 'move') {
            // Now hw/hh are in scaled coordinates
            const hw = b.w / 2;
            const hh = b.h / 2;

            ctx.strokeStyle = '#2196f3';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.rect(-hw - 4, -hh - 4, b.w + 8, b.h + 8);
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#2196f3';
            ctx.lineWidth = 1;
            const corners = [{ x: -hw, y: -hh }, { x: hw, y: -hh }, { x: -hw, y: hh }, { x: hw, y: hh }];

            // Rotation Handle
            ctx.beginPath();
            ctx.moveTo(0, -hh);
            ctx.lineTo(0, -hh - 20);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0, -hh - 20, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            corners.forEach(p => {
                ctx.beginPath();
                ctx.rect(p.x - 4, p.y - 4, 8, 8);
                ctx.fill();
                ctx.stroke();
            });

            // Edge handles (smaller, for non-uniform scaling)
            const edges = [
                { x: 0, y: -hh },  // top
                { x: 0, y: hh },   // bottom
                { x: -hw, y: 0 },  // left
                { x: hw, y: 0 }    // right
            ];
            edges.forEach(p => {
                ctx.beginPath();
                ctx.rect(p.x - 3, p.y - 3, 6, 6);
                ctx.fill();
                ctx.stroke();
            });
        }

        ctx.restore();
    });

    if (isDrawing && points.length > 0) {
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();
    }

    // Draw marquee selection rectangle
    if (isMarqueeSelecting) {
        const minX = Math.min(marqueeStart.x, marqueeEnd.x);
        const minY = Math.min(marqueeStart.y, marqueeEnd.y);
        const w = Math.abs(marqueeEnd.x - marqueeStart.x);
        const h = Math.abs(marqueeEnd.y - marqueeStart.y);

        ctx.strokeStyle = '#2196f3';
        ctx.fillStyle = 'rgba(33, 150, 243, 0.1)';
        ctx.lineWidth = 1 / cameraZoom;
        ctx.setLineDash([5 / cameraZoom, 5 / cameraZoom]);
        ctx.beginPath();
        ctx.rect(minX, minY, w, h);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
    }
}

function moveStroke(idx, dx, dy) {
    const s = strokes[idx];
    if (!s) return;

    if (s.type === 'shape') {
        const d = s.data;
        if (['rectangle', 'diamond'].includes(d.type)) {
            d.x += dx;
            d.y += dy;
        }
        else if (d.type === 'circle') {
            d.cx += dx;
            d.cy += dy;
        }
        else if (['line', 'arrow'].includes(d.type)) {
            d.x1 += dx;
            d.y1 += dy;
            d.x2 += dx;
            d.y2 += dy;
        }
        else if (d.type === 'triangle') {
            // Move all 3 points and bounding box
            if (d.p1) { d.p1.x += dx; d.p1.y += dy; }
            if (d.p2) { d.p2.x += dx; d.p2.y += dy; }
            if (d.p3) { d.p3.x += dx; d.p3.y += dy; }
            if (d.x !== undefined) d.x += dx;
            if (d.y !== undefined) d.y += dy;
        }
    } else if (s.type === 'text') {
        s.data.x += dx;
        s.data.y += dy;
    }
    else if (s.type === 'path') {
        s.data = s.data.map(p => ({ x: p.x + dx, y: p.y + dy }));
    }
}

function detectHit(pos) {
    for (let i = strokes.length - 1; i >= 0; i--) {
        const s = strokes[i];
        if (!s) continue;

        const b = getStrokeBounds(s);
        const centered = { x: pos.x - b.cx, y: pos.y - b.cy };
        const rotated = rotatePoint(centered, { x: 0, y: 0 }, -(s.rotation || 0));
        const scale = s.scale || 1;
        const local = { x: rotated.x / scale, y: rotated.y / scale };

        const hw = b.w / 2;
        const hh = b.h / 2;
        if (local.x >= -hw && local.x <= hw && local.y >= -hh && local.y <= hh) return i;
    }
    return -1;
}

function detectHandleHit(pos, s) {
    if (!s) return null;

    const b = getStrokeBounds(s);
    const hw = b.w / 2 + 4;
    const hh = b.h / 2 + 4;
    const handles = {
        // Corner handles (uniform resize)
        tl: { x: -hw, y: -hh },
        tr: { x: hw, y: -hh },
        bl: { x: -hw, y: hh },
        br: { x: hw, y: hh },
        // Edge handles (non-uniform resize)
        t: { x: 0, y: -hh },
        b: { x: 0, y: hh },
        l: { x: -hw, y: 0 },
        r: { x: hw, y: 0 },
        // Rotation handle
        rot: { x: 0, y: -hh - 20 }
    };

    const scale = s.scale || 1;
    const rot = s.rotation || 0;

    for (let k in handles) {
        const h = handles[k];
        const sx = h.x * scale;
        const sy = h.y * scale;
        const rotated = rotatePoint({ x: sx, y: sy }, { x: 0, y: 0 }, rot);
        const worldH = { x: rotated.x + b.cx, y: rotated.y + b.cy };

        if (Math.hypot(pos.x - worldH.x, pos.y - worldH.y) < 15) {
            return k === 'rot' ? 'rot' : k;
        }
    }
    return null;
}

// Start the app
init();
