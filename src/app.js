// --- State ---
let rectangles = [];
let selectedId = null;
let nextId = 1;

// Pastel colors for rectangles
const PASTEL_COLORS = [
  '#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF',
  '#DCC6FF', '#FFB3E6', '#B3FFE0', '#B3D9FF', '#FFB3B3',
  '#C9FFB3', '#FFD6B3', '#B3FFD9', '#E6B3FF', '#B3FF9C',
];
let nextColorIndex = 0;

function getNextColor() {
  const color = PASTEL_COLORS[nextColorIndex % PASTEL_COLORS.length];
  nextColorIndex++;
  return color;
}

// Scale: 1 inch = 20 pixels
const PX_PER_INCH = 20;

// Pan/Zoom state
let zoomLevel = 1.0;
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 5.0;

// --- DOM refs ---
const minWidthInput = document.getElementById('minWidth');
const maxWidthInput = document.getElementById('maxWidth');
const minHeightInput = document.getElementById('minHeight');
const maxHeightInput = document.getElementById('maxHeight');
const rectNameInput = document.getElementById('rectName');
const addBtn = document.getElementById('addRectangle');
const rectList = document.getElementById('rectangleList');
const canvas = document.getElementById('canvas');
const gridSvg = document.getElementById('grid');
const rectsSvg = document.getElementById('rectangles');
const zoomIndicator = document.getElementById('zoomIndicator');

// --- Viewport / Pan/Zoom (viewBox-based) ---
// viewBoxOrigin is the top-left corner of the visible area in world pixels
// (1 world pixel = 1/20 inch)
let viewBoxOriginX = 0;
let viewBoxOriginY = 0;

function getViewBox() {
  const { w, h } = getCanvasSize();
  const vbW = w / zoomLevel;
  const vbH = h / zoomLevel;
  return {
    x: viewBoxOriginX,
    y: viewBoxOriginY,
    w: vbW,
    h: vbH
  };
}

function applyViewBox() {
  const vb = getViewBox();
  const vbStr = `${vb.x} ${vb.y} ${vb.w} ${vb.h}`;
  gridSvg.setAttribute('viewBox', vbStr);
  rectsSvg.setAttribute('viewBox', vbStr);
  zoomIndicator.textContent = Math.round(zoomLevel * 100) + '%';
}

function getCanvasSize() {
  return { w: gridSvg.clientWidth, h: gridSvg.clientHeight };
}

// --- Grid ---
function drawGrid() {
  const vb = getViewBox();

  const inchPx = PX_PER_INCH;
  const inchStartX = Math.floor(vb.x / inchPx);
  const inchEndX = Math.ceil((vb.x + vb.w) / inchPx);
  const inchStartY = Math.floor(vb.y / inchPx);
  const inchEndY = Math.ceil((vb.y + vb.h) / inchPx);

  const y1 = inchStartY * inchPx;
  const y2 = inchEndY * inchPx;
  const x1 = inchStartX * inchPx;
  const x2 = inchEndX * inchPx;

  let lines = '';
  for (let i = inchStartX; i <= inchEndX; i++) {
    const px = i * inchPx;
    const opacity = i % 4 === 0 ? 0.25 : 0.1;
    lines += `<line x1="${px}" y1="${y1}" x2="${px}" y2="${y2}" stroke="rgba(255,255,255,${opacity})" stroke-width="1"/>`;
  }
  for (let i = inchStartY; i <= inchEndY; i++) {
    const py = i * inchPx;
    const opacity = i % 4 === 0 ? 0.25 : 0.1;
    lines += `<line x1="${x1}" y1="${py}" x2="${x2}" y2="${py}" stroke="rgba(255,255,255,${opacity})" stroke-width="1"/>`;
  }

  gridSvg.innerHTML = lines;
  applyViewBox();
}

// --- Constraints ---
function getConstraints() {
  return {
    minWidth: parseFloat(minWidthInput.value) || 1,
    maxWidth: parseFloat(maxWidthInput.value) || 12,
    minHeight: parseFloat(minHeightInput.value) || 1,
    maxHeight: parseFloat(maxHeightInput.value) || 12,
  };
}

function clampDim(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

// --- Sidebar list ---
function renderList() {
  rectList.innerHTML = '';
  const constraints = getConstraints();

  if (rectangles.length === 0) {
    rectList.innerHTML = '<div class="empty-state">No rectangles yet.<br>Add one to get started.</div>';
    return;
  }

  rectangles.forEach((r) => {
    const li = document.createElement('li');
    li.className = 'rectangle-item' + (r.id === selectedId ? ' active' : '');
    li.dataset.id = r.id;

    li.innerHTML = `
      <span class="rect-color-indicator" style="background:${r.color}"></span>
      <div class="rect-info">
        <span class="rect-name" title="${r.name}">${r.name}</span>
        <span class="rect-dims">${r.width.toFixed(1)}" × ${r.height.toFixed(1)}"</span>
        <span class="rect-constraints">W: ${constraints.minWidth}-${constraints.maxWidth}" H: ${constraints.minHeight}-${constraints.maxHeight}"</span>
      </div>
      <div class="rect-actions">
        <button class="btn-action btn-rotate-btn" data-action="rotate" data-id="${r.id}" title="Rotate 90°">&#8635;</button>
        <button class="btn-action" data-action="delete" data-id="${r.id}" title="Delete">&times;</button>
      </div>
    `;

    li.addEventListener('click', (e) => {
      if (e.target.closest('.btn-action')) return;
      selectRectangle(r.id);
    });

    const nameSpan = li.querySelector('.rect-name');
    nameSpan.addEventListener('click', (e) => {
      e.stopPropagation();
      startEditName(r.id, li);
    });

    li.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteRectangle(r.id);
    });

    li.querySelector('[data-action="rotate"]').addEventListener('click', (e) => {
      e.stopPropagation();
      rotateRectangle(r.id);
    });

    rectList.appendChild(li);
  });
}

// --- Edit name in sidebar ---
function startEditName(id, listItem) {
  const rect = rectangles.find((r) => r.id === id);
  if (!rect) return;

  const nameSpan = listItem.querySelector('.rect-name');
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'rect-name-input';
  input.value = rect.name;
  nameSpan.replaceWith(input);
  input.focus();
  input.select();

  function finishEdit() {
    const newName = input.value.trim() || rect.name;
    rect.name = newName;
    renderList();
    renderRectangles();
  }

  input.addEventListener('blur', finishEdit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') {
      input.value = rect.name;
      input.blur();
    }
  });
}

// --- Canvas rendering ---
function renderRectangles() {
  rectsSvg.innerHTML = '';

  rectangles.forEach((r) => {
    const rx = r.x * PX_PER_INCH;
    const ry = r.y * PX_PER_INCH;
    const rw = r.width * PX_PER_INCH;
    const rh = r.height * PX_PER_INCH;

    // Create a group for the rectangle
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.dataset.id = r.id;

    // Rectangle shape
    const svgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    svgRect.setAttribute('x', rx);
    svgRect.setAttribute('y', ry);
    svgRect.setAttribute('width', rw);
    svgRect.setAttribute('height', rh);
    svgRect.setAttribute('rx', 3);
    svgRect.setAttribute('fill', r.color + '40');
    svgRect.setAttribute('stroke', r.color);
    svgRect.setAttribute('stroke-width', r.id === selectedId ? 2.5 : 2);
    svgRect.style.cursor = 'move';

    svgRect.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      selectRectangle(r.id);
      startDrag(e, r.id);
    });

    svgRect.addEventListener('touchstart', (e) => {
      e.stopPropagation();
      e.preventDefault();
      selectedId = r.id;
      renderList();
      if (e.touches.length === 1) {
        const t = e.touches[0];
        startDrag({ clientX: t.clientX, clientY: t.clientY, stopPropagation: ()=>{} }, r.id);
      }
    }, { passive: false });

    g.appendChild(svgRect);

    // Scaled label font based on rectangle size
    const labelFontSize = Math.min(
      Math.max(rw / r.name.length * 1.2, 8),
      Math.max(rh * 0.3, 8),
      28
    );

    // Label: name centered in rectangle
    const labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    labelText.setAttribute('x', rx + rw / 2);
    labelText.setAttribute('y', ry + rh / 2 - labelFontSize * 0.6);
    labelText.classList.add('rect-label');
    labelText.style.fontSize = (labelFontSize / zoomLevel) + 'px';
    labelText.textContent = r.name;
    g.appendChild(labelText);

    // Label: dimensions below name
    const dimFontSize = Math.max(labelFontSize * 0.75, 8);
    const labelDims = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    labelDims.setAttribute('x', rx + rw / 2);
    labelDims.setAttribute('y', ry + rh / 2 + dimFontSize * 0.6);
    labelDims.classList.add('rect-label-dims');
    labelDims.style.fontSize = (dimFontSize / zoomLevel) + 'px';
    labelDims.textContent = `${r.width.toFixed(1)}" × ${r.height.toFixed(1)}"`;
    g.appendChild(labelDims);

    // Resize handles when selected
    if (r.id === selectedId) {
      const handleSize = window.innerWidth <= 768 ? 24 : 10;
      const positions = [
        { pos: 'nw', cx: rx, cy: ry },
        { pos: 'n', cx: rx + rw / 2, cy: ry },
        { pos: 'ne', cx: rx + rw, cy: ry },
        { pos: 'e', cx: rx + rw, cy: ry + rh / 2 },
        { pos: 'se', cx: rx + rw, cy: ry + rh },
        { pos: 's', cx: rx + rw / 2, cy: ry + rh },
        { pos: 'sw', cx: rx, cy: ry + rh },
        { pos: 'w', cx: rx, cy: ry + rh / 2 },
      ];

      positions.forEach(({ pos, cx: hCx, cy: hCy }) => {
        const h = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        h.setAttribute('x', hCx - handleSize / 2);
        h.setAttribute('y', hCy - handleSize / 2);
        h.setAttribute('width', handleSize);
        h.setAttribute('height', handleSize);
        h.setAttribute('rx', 3);
        h.setAttribute('fill', r.color);
        h.setAttribute('stroke', '#fff');
        h.setAttribute('stroke-width', 1.5);
        h.style.cursor = `${pos}-resize`;
        h.dataset.handle = pos;
        h.dataset.id = r.id;

        h.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          startResize(e, r.id, pos);
        });

        h.addEventListener('touchstart', (e) => {
          e.stopPropagation();
          e.preventDefault();
          if (e.touches.length === 1) {
            const t = e.touches[0];
            startResize({ clientX: t.clientX, clientY: t.clientY }, r.id, pos);
          }
        }, { passive: false });

        rectsSvg.appendChild(h);
      });
    }

    rectsSvg.appendChild(g);
  });
}

// --- Deferred render to avoid destroying touch targets ---
let deferredRender = false;

function requestRender() {
  if (!deferredRender) {
    deferredRender = true;
    requestAnimationFrame(() => {
      deferredRender = false;
      renderRectangles();
    });
  }
}

// --- Select / Delete / Rotate ---
function selectRectangle(id) {
  selectedId = id;
  renderList();
  renderRectangles();
}

function deleteRectangle(id) {
  rectangles = rectangles.filter((r) => r.id !== id);
  if (selectedId === id) selectedId = null;
  renderList();
  renderRectangles();
}

function rotateRectangle(id) {
  const rect = rectangles.find((r) => r.id === id);
  if (!rect) return;
  // Swap width and height to rotate 90°
  const temp = rect.width;
  rect.width = rect.height;
  rect.height = temp;
  renderList();
  renderRectangles();
}

// --- Direct DOM update (avoids full re-render during touch drag) ---
function updateRectDOM(r) {
  const group = rectsSvg.querySelector(`g[data-id="${r.id}"]`);
  if (!group) return;
  const rx = r.x * PX_PER_INCH;
  const ry = r.y * PX_PER_INCH;
  const rw = r.width * PX_PER_INCH;
  const rh = r.height * PX_PER_INCH;

  const svgRect = group.querySelector('rect');
  if (svgRect) {
    svgRect.setAttribute('x', rx);
    svgRect.setAttribute('y', ry);
    svgRect.setAttribute('width', rw);
    svgRect.setAttribute('height', rh);
  }

  const labelText = group.querySelector('.rect-label');
  if (labelText) {
    labelText.setAttribute('x', rx + rw / 2);
    labelText.setAttribute('y', ry + rh / 2 - parseFloat(labelText.style.fontSize) * 0.6);
  }

  const labelDims = group.querySelector('.rect-label-dims');
  if (labelDims) {
    labelDims.setAttribute('x', rx + rw / 2);
    labelDims.setAttribute('y', ry + rh / 2 + parseFloat(labelDims.style.fontSize) * 0.6);
    labelDims.textContent = `${r.width.toFixed(1)}" × ${r.height.toFixed(1)}"`;
  }

  // Update resize handles if this rectangle is selected
  if (r.id === selectedId) {
    const handleSize = window.innerWidth <= 768 ? 24 : 10;
    const positions = [
      { pos: 'nw', cx: rx, cy: ry },
      { pos: 'n', cx: rx + rw / 2, cy: ry },
      { pos: 'ne', cx: rx + rw, cy: ry },
      { pos: 'e', cx: rx + rw, cy: ry + rh / 2 },
      { pos: 'se', cx: rx + rw, cy: ry + rh },
      { pos: 's', cx: rx + rw / 2, cy: ry + rh },
      { pos: 'sw', cx: rx, cy: ry + rh },
      { pos: 'w', cx: rx, cy: ry + rh / 2 },
    ];

    positions.forEach(({ pos, cx: hCx, cy: hCy }) => {
      const h = rectsSvg.querySelector(`rect[data-handle="${pos}"][data-id="${r.id}"]`);
      if (h) {
        h.setAttribute('x', hCx - handleSize / 2);
        h.setAttribute('y', hCy - handleSize / 2);
        h.setAttribute('width', handleSize);
        h.setAttribute('height', handleSize);
      }
    });
  }
}

// --- Drag ---
function startDrag(e, id) {
  const rect = rectangles.find((r) => r.id === id);
  if (!rect) return;

  const startX = e.clientX;
  const startY = e.clientY;
  const origX = rect.x;
  const origY = rect.y;

  function onMove(ev) {
    const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
    const clientY = ev.touches ? ev.touches[0].clientY : ev.clientY;
    const dxInches = (clientX - startX) / (zoomLevel * PX_PER_INCH);
    const dyInches = (clientY - startY) / (zoomLevel * PX_PER_INCH);
    rect.x = origX + dxInches;
    rect.y = origY + dyInches;
    updateRectDOM(rect);
  }

  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onUp);
    renderRectangles();
  }

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('touchend', onUp);
}

// --- Resize ---
function startResize(e, id, handle) {
  const rect = rectangles.find((r) => r.id === id);
  if (!rect) return;

  const constraints = getConstraints();
  const startX = e.clientX;
  const startY = e.clientY;
  const origX = rect.x;
  const origY = rect.y;
  const origW = rect.width;
  const origH = rect.height;

  function onMove(ev) {
    const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
    const clientY = ev.touches ? ev.touches[0].clientY : ev.clientY;
    const dx = (clientX - startX) / (zoomLevel * PX_PER_INCH);
    const dy = (clientY - startY) / (zoomLevel * PX_PER_INCH);

    let newX = origX, newY = origY, newW = origW, newH = origH;

    if (handle.includes('e')) {
      newW = clampDim(origW + dx, constraints.minWidth, constraints.maxWidth);
    }
    if (handle.includes('w')) {
      const proposedW = origW - dx;
      newW = clampDim(proposedW, constraints.minWidth, constraints.maxWidth);
      newX = origX + (origW - newW);
    }
    if (handle.includes('s')) {
      newH = clampDim(origH + dy, constraints.minHeight, constraints.maxHeight);
    }
    if (handle.includes('n')) {
      const proposedH = origH - dy;
      newH = clampDim(proposedH, constraints.minHeight, constraints.maxHeight);
      newY = origY + (origH - newH);
    }

    rect.x = newX;
    rect.y = newY;
    rect.width = newW;
    rect.height = newH;

    updateRectDOM(rect);
    updateListDims(id);
  }

  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onUp);
    renderRectangles();
  }

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('touchend', onUp);
}

// --- Update sidebar dimensions without full re-render ---
function updateListDims(id) {
  const rect = rectangles.find((r) => r.id === id);
  if (!rect) return;

  const listItem = rectList.querySelector(`.rectangle-item[data-id="${id}"]`);
  if (!listItem) return;

  const dimsEl = listItem.querySelector('.rect-dims');
  if (dimsEl) {
    dimsEl.textContent = `${rect.width.toFixed(1)}" × ${rect.height.toFixed(1)}"`;
  }

  const group = rectsSvg.querySelector(`g[data-id="${id}"]`);
  if (group) {
    const dimsText = group.querySelector('.rect-label-dims');
    if (dimsText) {
      dimsText.textContent = `${rect.width.toFixed(1)}" × ${rect.height.toFixed(1)}"`;
    }
  }
}

// --- Add rectangle ---
addBtn.addEventListener('click', () => {
  const constraints = getConstraints();

  const defaultW = (constraints.minWidth + constraints.maxWidth) / 2;
  const defaultH = (constraints.minHeight + constraints.maxHeight) / 2;

  // Center in visible canvas area
  const centerX = (viewBoxOriginX + canvas.clientWidth / zoomLevel / 2) / PX_PER_INCH;
  const centerY = (viewBoxOriginY + canvas.clientHeight / zoomLevel / 2) / PX_PER_INCH;
  const x = centerX - defaultW / 2;
  const y = centerY - defaultH / 2;

  const customName = rectNameInput.value.trim();
  const name = customName || `Rectangle ${nextId}`;
  const color = getNextColor();

  const rect = {
    id: nextId++,
    name,
    x,
    y,
    width: defaultW,
    height: defaultH,
    color,
  };

  rectangles.push(rect);
  selectedId = rect.id;
  rectNameInput.value = '';
  renderList();
  renderRectangles();
});

rectNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addBtn.click();
});

// --- Canvas pan handler ---
let isPanning = false;
let panStartMouseX = 0;
let panStartMouseY = 0;

function startPan(clientX, clientY) {
  if (isPanning) return;
  isPanning = true;
  panStartMouseX = clientX;
  panStartMouseY = clientY;
  canvas.classList.add('panning');
}

function onPanMove(clientX, clientY) {
  if (!isPanning) return;
  const dx = clientX - panStartMouseX;
  const dy = clientY - panStartMouseY;
  viewBoxOriginX -= dx / zoomLevel;
  viewBoxOriginY -= dy / zoomLevel;
  panStartMouseX = clientX;
  panStartMouseY = clientY;
  drawGrid();
  renderRectangles();
}

function stopPan() {
  if (isPanning) {
    isPanning = false;
    canvas.classList.remove('panning');
  }
}

canvas.addEventListener('mousedown', (e) => {
  if (e.target === canvas || e.target === gridSvg || e.target === rectsSvg) {
    startPan(e.clientX, e.clientY);
    e.preventDefault();
  }
});

document.addEventListener('mousemove', (e) => {
  onPanMove(e.clientX, e.clientY);
});

document.addEventListener('mouseup', stopPan);

// Touch pan support
canvas.addEventListener('touchstart', (e) => {
  if ((e.target === canvas || e.target === gridSvg || e.target === rectsSvg) && e.touches.length === 1) {
    const t = e.touches[0];
    startPan(t.clientX, t.clientY);
    e.preventDefault();
  }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  if (isPanning && e.touches.length === 1) {
    const t = e.touches[0];
    onPanMove(t.clientX, t.clientY);
    e.preventDefault();
  }
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
  if (e.touches.length === 0) {
    stopPan();
    initialPinchDist = null;
  }
});

// --- Pinch-to-zoom ---
let initialPinchDist = null;
let initialZoomForPinch = 1.0;
let pinchCenterX = 0;
let pinchCenterY = 0;

function getPinchDist(e) {
  const dx = e.touches[0].clientX - e.touches[1].clientX;
  const dy = e.touches[0].clientY - e.touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

canvas.addEventListener('touchstart', (e) => {
  if (e.touches.length === 2) {
    initialPinchDist = getPinchDist(e);
    initialZoomForPinch = zoomLevel;
    pinchCenterX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    pinchCenterY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    e.preventDefault();
  }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  if (e.touches.length === 2 && initialPinchDist !== null) {
    e.preventDefault();
    const currentDist = getPinchDist(e);
    const scale = currentDist / initialPinchDist;
    const newZoom = clampDim(initialZoomForPinch * scale, ZOOM_MIN, ZOOM_MAX);

    // Zoom toward pinch center
    const canvasRect = canvas.getBoundingClientRect();
    const worldX = viewBoxOriginX + (pinchCenterX - canvasRect.left) / zoomLevel;
    const worldY = viewBoxOriginY + (pinchCenterY - canvasRect.top) / zoomLevel;

    zoomLevel = newZoom;
    viewBoxOriginX = worldX - (pinchCenterX - canvasRect.left) / zoomLevel;
    viewBoxOriginY = worldY - (pinchCenterY - canvasRect.top) / zoomLevel;

    drawGrid();
    renderRectangles();
  }
}, { passive: false });

// --- Canvas click to deselect ---
canvas.addEventListener('click', (e) => {
  if (e.target === canvas || e.target === gridSvg || e.target === rectsSvg) {
    selectedId = null;
    renderList();
    renderRectangles();
  }
});

// --- Zoom with scroll wheel ---
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();

  const canvasRect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - canvasRect.left;
  const mouseY = e.clientY - canvasRect.top;

  // Mouse position in viewBox units
  const worldX = viewBoxOriginX + mouseX / zoomLevel;
  const worldY = viewBoxOriginY + mouseY / zoomLevel;

  const oldZoom = zoomLevel;
  const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
  zoomLevel = clampDim(zoomLevel * zoomFactor, ZOOM_MIN, ZOOM_MAX);

  // Adjust viewBox origin so zoom targets mouse position
  viewBoxOriginX = worldX - mouseX / zoomLevel;
  viewBoxOriginY = worldY - mouseY / zoomLevel;

  drawGrid();
  renderRectangles();
}, { passive: false });

// --- Reset zoom/pan to fit rectangles ---
function resetView() {
  zoomLevel = 1.0;

  if (rectangles.length === 0) {
    viewBoxOriginX = 0;
    viewBoxOriginY = 0;
    drawGrid();
    renderRectangles();
    return;
  }

  // Find bounding box of all rectangles
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  rectangles.forEach((r) => {
    if (r.x < minX) minX = r.x;
    if (r.y < minY) minY = r.y;
    if (r.x + r.width > maxX) maxX = r.x + r.width;
    if (r.y + r.height > maxY) maxY = r.y + r.height;
  });

  const padding = 2; // inches
  minX -= padding;
  minY -= padding;
  maxX += padding;
  maxY += padding;

  const { w: canvasW, h: canvasH } = getCanvasSize();
  const contentW = (maxX - minX) * PX_PER_INCH;
  const contentH = (maxY - minY) * PX_PER_INCH;
  const scale = Math.min(canvasW / contentW, canvasH / contentH);
  zoomLevel = Math.max(ZOOM_MIN, Math.min(scale, ZOOM_MAX));

  // Center the view on the content
  const centerX = ((minX + maxX) / 2) * PX_PER_INCH;
  const centerY = ((minY + maxY) / 2) * PX_PER_INCH;
  viewBoxOriginX = centerX - (canvasW / zoomLevel) / 2;
  viewBoxOriginY = centerY - (canvasH / zoomLevel) / 2;

  drawGrid();
  renderRectangles();
}

const resetBtn = document.getElementById('resetView');
if (resetBtn) {
  resetBtn.addEventListener('click', resetView);
}

// --- Sidebar toggle (mobile) ---
const sidebarToggle = document.getElementById('sidebarToggle');
const sidebar = document.querySelector('.sidebar');

if (sidebarToggle && sidebar) {
  sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });

  // Close sidebar when tapping outside
  document.addEventListener('touchend', (e) => {
    if (!sidebar.contains(e.target) && e.target !== sidebarToggle && !sidebarToggle.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  });
}

// --- Save layout to JSON file ---
const saveBtn = document.getElementById('saveLayout');
const fileInput = document.getElementById('fileInput');
const loadBtn = document.getElementById('loadLayout');

if (saveBtn) {
  saveBtn.addEventListener('click', () => {
    const data = {
      rectangles: rectangles.map((r) => ({
        id: r.id,
        name: r.name,
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        color: r.color,
      })),
      nextId,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'layout.json';
    a.click();
    URL.revokeObjectURL(url);
  });
}

// --- Load layout from JSON file ---
if (loadBtn && fileInput) {
  loadBtn.addEventListener('click', () => {
    fileInput.value = '';
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.rectangles && Array.isArray(data.rectangles)) {
          rectangles = data.rectangles;
          nextId = data.nextId || rectangles.length + 1;
          selectedId = null;
          renderList();
          renderRectangles();
        }
      } catch (err) {
        console.error('Failed to load layout:', err);
      }
    };
    reader.readAsText(file);
  });
}

// --- Init ---
function init() {
  drawGrid();
  renderList();
  renderRectangles();
}

window.addEventListener('resize', () => {
  drawGrid();
  renderRectangles();
});

init();
