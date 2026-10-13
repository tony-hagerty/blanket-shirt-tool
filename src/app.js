// --- Constants ---
const SVG_NS = 'http://www.w3.org/2000/svg';
const PX_PER_INCH = 20; // world units: 1 inch = 20 px at 100% zoom
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 5.0;

const PASTEL_COLORS = [
  '#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF',
  '#DCC6FF', '#FFB3E6', '#B3FFE0', '#B3D9FF', '#FFB3B3',
  '#C9FFB3', '#FFD6B3', '#B3FFD9', '#E6B3FF', '#B3FF9C',
];

// Resize handle positions as fractions of the rectangle's width/height
const HANDLES = {
  nw: [0, 0], n: [0.5, 0], ne: [1, 0], e: [1, 0.5],
  se: [1, 1], s: [0.5, 1], sw: [0, 1], w: [0, 0.5],
};

// --- State ---
let rectangles = [];
let selectedId = null;
let nextId = 1;
let nextColorIndex = 0;

// Viewport: top-left corner of the visible area in world px, plus zoom
let viewX = 0;
let viewY = 0;
let zoomLevel = 1.0;

// --- DOM refs ---
const $ = (id) => document.getElementById(id);
const minWidthInput = $('minWidth');
const maxWidthInput = $('maxWidth');
const minHeightInput = $('minHeight');
const maxHeightInput = $('maxHeight');
const rectNameInput = $('rectName');
const addForm = $('addForm');
const rectList = $('rectangleList');
const summary = $('summary');
const canvas = $('canvas');
const gridSvg = $('grid');
const rectsSvg = $('rectangles');
const zoomIndicator = $('zoomIndicator');
const sidebar = $('sidebar');
const sidebarToggle = $('sidebarToggle');
const fileInput = $('fileInput');
const colorPicker = $('colorPicker');
const colorGrid = $('colorGrid');
const customColor = $('customColor');

// --- Helpers ---
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function getConstraints() {
  // Blank, zero or negative limits fall back to the defaults
  const read = (input, fallback) => Math.max(parseFloat(input.value), 0) || fallback;
  return {
    minWidth: read(minWidthInput, 1),
    maxWidth: read(maxWidthInput, 12),
    minHeight: read(minHeightInput, 1),
    maxHeight: read(maxHeightInput, 12),
  };
}


// Clamp a resized dimension to the limits, but widen the range to include
// where it started. A piece that's already outside the limits (after a
// rotate, or after the limits changed) then resizes smoothly instead of
// snapping to the limit the moment it's touched.
function clampResize(val, orig, min, max) {
  return clamp(val, Math.min(min, orig), Math.max(max, orig));
}

function getNextColor() {
  return PASTEL_COLORS[nextColorIndex++ % PASTEL_COLORS.length];
}

function formatDims(r) {
  return `${r.width.toFixed(1)}″ × ${r.height.toFixed(1)}″`;
}

// Dark ink on light colors, white on dark ones
function labelColorFor(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b < 140 ? '#fff' : null;
}

function findRect(id) {
  return rectangles.find((r) => r.id === id);
}

function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const key in attrs) el.setAttribute(key, attrs[key]);
  return el;
}

function screenToWorld(clientX, clientY) {
  const box = canvas.getBoundingClientRect();
  return {
    x: viewX + (clientX - box.left) / zoomLevel,
    y: viewY + (clientY - box.top) / zoomLevel,
  };
}

// Pan so that the given world point sits under the given screen point
function pinWorldTo(world, clientX, clientY) {
  const box = canvas.getBoundingClientRect();
  viewX = world.x - (clientX - box.left) / zoomLevel;
  viewY = world.y - (clientY - box.top) / zoomLevel;
}

// --- Rendering ---
function render() {
  renderView();
  renderList();
}

// Everything that depends on pan/zoom
function renderView() {
  const w = canvas.clientWidth / zoomLevel;
  const h = canvas.clientHeight / zoomLevel;
  const viewBox = `${viewX} ${viewY} ${w} ${h}`;
  gridSvg.setAttribute('viewBox', viewBox);
  rectsSvg.setAttribute('viewBox', viewBox);
  zoomIndicator.textContent = Math.round(zoomLevel * 100) + '%';

  drawGrid(w, h);
  renderCanvas();
}

function drawGrid(w, h) {
  // Every inch, with a heavier line every 4 inches. Skip the minor lines
  // once they get too dense to read.
  const step = zoomLevel * PX_PER_INCH < 6 ? 4 : 1;
  const x0 = Math.floor(viewX / PX_PER_INCH);
  const x1 = Math.ceil((viewX + w) / PX_PER_INCH);
  const y0 = Math.floor(viewY / PX_PER_INCH);
  const y1 = Math.ceil((viewY + h) / PX_PER_INCH);
  const line = (i, d) => `<path class="${i % 4 === 0 ? 'major' : 'minor'}" d="${d}" vector-effect="non-scaling-stroke"/>`;

  let lines = '';
  for (let i = Math.ceil(x0 / step) * step; i <= x1; i += step) {
    const x = i * PX_PER_INCH;
    lines += line(i, `M${x} ${y0 * PX_PER_INCH}V${y1 * PX_PER_INCH}`);
  }
  for (let i = Math.ceil(y0 / step) * step; i <= y1; i += step) {
    const y = i * PX_PER_INCH;
    lines += line(i, `M${x0 * PX_PER_INCH} ${y}H${x1 * PX_PER_INCH}`);
  }
  gridSvg.innerHTML = lines;
}

function renderCanvas() {
  rectsSvg.replaceChildren();

  rectangles.forEach((r) => {
    const x = r.x * PX_PER_INCH;
    const y = r.y * PX_PER_INCH;
    const w = r.width * PX_PER_INCH;
    const h = r.height * PX_PER_INCH;

    const g = svgEl('g', { 'data-id': r.id });
    const labelColor = labelColorFor(r.color);
    if (labelColor) g.style.setProperty('--swatch-ink', labelColor);
    g.appendChild(svgEl('rect', {
      x, y, width: w, height: h,
      fill: r.color,
      class: 'piece-shape' + (r.id === selectedId ? ' selected' : ''),
      'vector-effect': 'non-scaling-stroke',
    }));

    // Size labels in screen pixels so they fit the piece at any zoom
    const screenW = w * zoomLevel;
    const screenH = h * zoomLevel;
    const nameSize = Math.min(screenW * 0.85 / (Math.max(r.name.length, 4) * 0.55), screenH * 0.3, 26);
    if (nameSize >= 9) {
      const dimsSize = clamp(nameSize * 0.5, 9, 12);
      const showDims = screenH > nameSize + dimsSize * 2.5;
      const cx = x + w / 2;
      const cy = y + h / 2;

      const name = svgEl('text', {
        class: 'label-name',
        x: cx,
        y: showDims ? cy - (dimsSize * 0.8) / zoomLevel : cy,
        'font-size': nameSize / zoomLevel,
      });
      name.textContent = r.name;
      g.appendChild(name);

      if (showDims) {
        const dims = svgEl('text', {
          class: 'label-dims',
          x: cx,
          y: cy + (nameSize * 0.6) / zoomLevel,
          'font-size': dimsSize / zoomLevel,
        });
        dims.textContent = formatDims(r);
        g.appendChild(dims);
      }
    }

    rectsSvg.appendChild(g);
  });

  // Handles go last so they sit on top of every piece
  const sel = findRect(selectedId);
  if (sel) renderHandles(sel);
}

// Corner dots and edge pills, sized in screen pixels. Each sits on a larger
// invisible hit area so it's easy to grab with a finger.
function renderHandles(r) {
  const touch = matchMedia('(pointer: coarse)').matches;
  const px = (n) => n / zoomLevel; // screen px -> world units
  const dot = px(touch ? 16 : 11);
  const pillLong = px(touch ? 24 : 18);
  const pillShort = px(touch ? 8 : 6);
  const hit = px(touch ? 40 : 20);
  const screenW = r.width * PX_PER_INCH * zoomLevel;
  const screenH = r.height * PX_PER_INCH * zoomLevel;

  // Soft shadow; its offsets live in world units, so rebuild it per zoom
  const defs = svgEl('defs', {});
  const filter = svgEl('filter', { id: 'handle-shadow', x: '-100%', y: '-100%', width: '300%', height: '300%' });
  filter.appendChild(svgEl('feDropShadow', {
    dx: 0, dy: px(1), stdDeviation: px(1.5), 'flood-color': '#000', 'flood-opacity': 0.25,
  }));
  defs.appendChild(filter);
  rectsSvg.appendChild(defs);

  for (const [pos, [fx, fy]] of Object.entries(HANDLES)) {
    const isEdge = pos.length === 1;
    const horizontal = pos === 'n' || pos === 's';
    // Skip edge pills on pieces too small to fit them between the corners
    if (isEdge && (horizontal ? screenW : screenH) < 48) continue;

    const cx = (r.x + r.width * fx) * PX_PER_INCH;
    const cy = (r.y + r.height * fy) * PX_PER_INCH;
    const w = isEdge ? (horizontal ? pillLong : pillShort) : dot;
    const h = isEdge ? (horizontal ? pillShort : pillLong) : dot;

    const g = svgEl('g', { class: 'handle', 'data-handle': pos });
    g.style.cursor = `${pos}-resize`;
    g.appendChild(svgEl('rect', {
      class: 'handle-hit', x: cx - hit / 2, y: cy - hit / 2, width: hit, height: hit,
    }));
    g.appendChild(svgEl('rect', {
      class: 'handle-knob',
      x: cx - w / 2, y: cy - h / 2, width: w, height: h,
      rx: Math.min(w, h) / 2,
      filter: 'url(#handle-shadow)',
      'vector-effect': 'non-scaling-stroke',
    }));
    rectsSvg.appendChild(g);
  }
}

function renderList() {
  rectList.replaceChildren();

  if (rectangles.length === 0) {
    summary.textContent = '';
    rectList.innerHTML = '<li class="empty-state">Nothing here yet. Name a piece above and add it to the layout.</li>';
    return;
  }

  const constraints = getConstraints();
  const area = rectangles.reduce((sum, r) => sum + r.width * r.height, 0);
  summary.textContent = `${rectangles.length} · ${Math.round(area)} sq in`;

  rectangles.forEach((r, i) => {
    const li = document.createElement('li');
    li.className = 'piece' + (r.id === selectedId ? ' active' : '');
    li.dataset.id = r.id;
    li.innerHTML = `
      <span class="piece-index">${String(i + 1).padStart(2, '0')}</span>
      <button class="piece-swatch" data-action="color" title="Change color" aria-label="Change color"></button>
      <div class="piece-info">
        <span class="piece-name" title="Click to rename"></span>
        <span class="piece-dims"></span>
      </div>
      <div class="piece-actions">
        <button class="icon-btn" data-action="rotate" title="Rotate 90°" aria-label="Rotate">↻</button>
        <button class="icon-btn danger" data-action="delete" title="Delete" aria-label="Delete">×</button>
      </div>
    `;
    li.querySelector('.piece-swatch').style.background = r.color;
    li.querySelector('.piece-name').textContent = r.name;
    // Highlight whichever side is outside the current size limits
    const dims = li.querySelector('.piece-dims');
    const side = (value, min, max) => {
      const span = document.createElement('span');
      span.textContent = `${value.toFixed(1)}″`;
      if (value < min || value > max) {
        span.className = 'outside';
        span.title = `Outside the ${min}–${max}″ limit`;
      }
      return span;
    };
    dims.append(
      side(r.width, constraints.minWidth, constraints.maxWidth),
      ' × ',
      side(r.height, constraints.minHeight, constraints.maxHeight),
    );
    rectList.appendChild(li);
  });
}

// --- Actions ---
function selectRectangle(id) {
  selectedId = id;
  render();
}

function deleteRectangle(id) {
  rectangles = rectangles.filter((r) => r.id !== id);
  if (selectedId === id) selectedId = null;
  render();
}

function rotateRectangle(id) {
  const rect = findRect(id);
  if (!rect) return;
  [rect.width, rect.height] = [rect.height, rect.width];
  render();
}

function startEditName(id, li) {
  const rect = findRect(id);
  const nameSpan = li.querySelector('.piece-name');
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'piece-name-input';
  input.value = rect.name;
  nameSpan.replaceWith(input);
  input.focus();
  input.select();

  input.addEventListener('blur', () => {
    rect.name = input.value.trim() || rect.name;
    render();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') {
      input.value = rect.name;
      input.blur();
    }
  });
}

addForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const c = getConstraints();
  const width = (c.minWidth + c.maxWidth) / 2;
  const height = (c.minHeight + c.maxHeight) / 2;

  // Center the new piece in the visible canvas area
  const centerX = (viewX + canvas.clientWidth / zoomLevel / 2) / PX_PER_INCH;
  const centerY = (viewY + canvas.clientHeight / zoomLevel / 2) / PX_PER_INCH;

  const rect = {
    id: nextId++,
    name: rectNameInput.value.trim() || `Piece ${rectangles.length + 1}`,
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
    color: getNextColor(),
  };

  rectangles.push(rect);
  selectedId = rect.id;
  rectNameInput.value = '';
  render();
});

// Re-check which pieces are outside the limits as they're edited
[minWidthInput, maxWidthInput, minHeightInput, maxHeightInput].forEach((input) => {
  input.addEventListener('input', renderList);
});

// One listener for every row in the list
rectList.addEventListener('click', (e) => {
  const li = e.target.closest('.piece');
  if (!li) return;
  const id = Number(li.dataset.id);
  const action = e.target.closest('[data-action]')?.dataset.action;

  if (action === 'color') openColorPicker(id, e.target);
  else if (action === 'delete') deleteRectangle(id);
  else if (action === 'rotate') rotateRectangle(id);
  else if (e.target.classList.contains('piece-name')) startEditName(id, li);
  else selectRectangle(id);
});

// --- Color picker ---
let colorTargetId = null;

PASTEL_COLORS.forEach((color) => {
  const btn = document.createElement('button');
  btn.className = 'color-option';
  btn.style.background = color;
  btn.dataset.color = color;
  btn.setAttribute('aria-label', color);
  colorGrid.appendChild(btn);
});

function setColor(color) {
  const rect = findRect(colorTargetId);
  if (!rect) return;
  rect.color = color;
  render();
}

function openColorPicker(id, anchor) {
  colorTargetId = id;
  const color = findRect(id).color.toUpperCase();
  colorGrid.querySelectorAll('.color-option').forEach((btn) => {
    btn.classList.toggle('current', btn.dataset.color === color);
  });
  if (/^#[0-9A-F]{6}$/.test(color)) customColor.value = color.toLowerCase();

  colorPicker.showPopover();
  // Sit just below the swatch, kept inside the viewport
  const a = anchor.getBoundingClientRect();
  const p = colorPicker.getBoundingClientRect();
  colorPicker.style.left = clamp(a.left - 8, 8, innerWidth - p.width - 8) + 'px';
  colorPicker.style.top = (a.bottom + p.height + 8 > innerHeight ? a.top - p.height - 8 : a.bottom + 8) + 'px';
}

colorGrid.addEventListener('click', (e) => {
  const color = e.target.dataset.color;
  if (!color) return;
  setColor(color);
  colorPicker.hidePopover();
});

customColor.addEventListener('input', () => setColor(customColor.value.toUpperCase()));

// --- Canvas gestures (Pointer Events cover mouse, pen and touch) ---
const pointers = new Map();
let gesture = null;

function startPinch() {
  const [a, b] = [...pointers.values()];
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  return {
    type: 'pinch',
    startDist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
    startZoom: zoomLevel,
    anchor: screenToWorld(mid.x, mid.y),
  };
}

function startPan(clientX, clientY, moved = false) {
  canvas.classList.add('panning');
  return { type: 'pan', startX: clientX, startY: clientY, origX: viewX, origY: viewY, moved };
}

canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (pointers.size === 2) {
    gesture = startPinch();
    return;
  }
  if (pointers.size > 2) return;

  const handle = e.target.closest('[data-handle]')?.dataset.handle;
  const pieceId = Number(e.target.closest('g[data-id]')?.dataset.id);
  const rect = handle ? findRect(selectedId) : findRect(pieceId);

  if (rect) {
    if (!handle) selectRectangle(rect.id);
    gesture = {
      type: handle ? 'resize' : 'move',
      handle,
      rect,
      constraints: getConstraints(),
      startX: e.clientX,
      startY: e.clientY,
      orig: { ...rect },
    };
  } else {
    gesture = startPan(e.clientX, e.clientY);
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId) || !gesture) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (gesture.type === 'pinch') {
    const [a, b] = [...pointers.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    zoomLevel = clamp(gesture.startZoom * dist / gesture.startDist, ZOOM_MIN, ZOOM_MAX);
    pinWorldTo(gesture.anchor, (a.x + b.x) / 2, (a.y + b.y) / 2);
    renderView();
    return;
  }

  const dxPx = e.clientX - gesture.startX;
  const dyPx = e.clientY - gesture.startY;

  if (gesture.type === 'pan') {
    viewX = gesture.origX - dxPx / zoomLevel;
    viewY = gesture.origY - dyPx / zoomLevel;
    if (Math.abs(dxPx) + Math.abs(dyPx) > 3) gesture.moved = true;
    renderView();
    return;
  }

  const dx = dxPx / (zoomLevel * PX_PER_INCH);
  const dy = dyPx / (zoomLevel * PX_PER_INCH);
  const { rect, orig, handle, constraints: c } = gesture;

  if (gesture.type === 'move') {
    rect.x = orig.x + dx;
    rect.y = orig.y + dy;
    renderCanvas();
    return;
  }

  // Resize: the opposite edge stays put
  if (handle.includes('e')) rect.width = clampResize(orig.width + dx, orig.width, c.minWidth, c.maxWidth);
  if (handle.includes('s')) rect.height = clampResize(orig.height + dy, orig.height, c.minHeight, c.maxHeight);
  if (handle.includes('w')) {
    rect.width = clampResize(orig.width - dx, orig.width, c.minWidth, c.maxWidth);
    rect.x = orig.x + orig.width - rect.width;
  }
  if (handle.includes('n')) {
    rect.height = clampResize(orig.height - dy, orig.height, c.minHeight, c.maxHeight);
    rect.y = orig.y + orig.height - rect.height;
  }
  render();
});

function endPointer(e) {
  if (!pointers.delete(e.pointerId)) return;

  // A tap on empty canvas clears the selection
  if (gesture?.type === 'pan' && !gesture.moved && e.type === 'pointerup' && selectedId !== null) {
    selectRectangle(null);
  }

  if (pointers.size === 0) {
    gesture = null;
    canvas.classList.remove('panning');
  } else if (gesture?.type === 'pinch' && pointers.size === 1) {
    // Lifting one finger of a pinch continues as a pan with the other
    const [p] = pointers.values();
    gesture = startPan(p.x, p.y, true);
  }
}

canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);

// Scroll wheel / trackpad zoom toward the cursor
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const anchor = screenToWorld(e.clientX, e.clientY);
  const delta = clamp(e.deltaY, -100, 100);
  zoomLevel = clamp(zoomLevel * Math.exp(-delta * 0.002), ZOOM_MIN, ZOOM_MAX);
  pinWorldTo(anchor, e.clientX, e.clientY);
  renderView();
}, { passive: false });

// --- Fit all pieces in view ---
function fitView() {
  if (rectangles.length === 0) {
    zoomLevel = 1.0;
    viewX = 0;
    viewY = 0;
    renderView();
    return;
  }

  const padding = 2; // inches
  const minX = Math.min(...rectangles.map((r) => r.x)) - padding;
  const minY = Math.min(...rectangles.map((r) => r.y)) - padding;
  const maxX = Math.max(...rectangles.map((r) => r.x + r.width)) + padding;
  const maxY = Math.max(...rectangles.map((r) => r.y + r.height)) + padding;

  const canvasW = canvas.clientWidth;
  const canvasH = canvas.clientHeight;
  zoomLevel = clamp(
    Math.min(canvasW / ((maxX - minX) * PX_PER_INCH), canvasH / ((maxY - minY) * PX_PER_INCH)),
    ZOOM_MIN,
    ZOOM_MAX,
  );
  viewX = ((minX + maxX) / 2) * PX_PER_INCH - canvasW / zoomLevel / 2;
  viewY = ((minY + maxY) / 2) * PX_PER_INCH - canvasH / zoomLevel / 2;
  renderView();
}

$('resetView').addEventListener('click', fitView);

// --- Keyboard ---
document.addEventListener('keydown', (e) => {
  if (e.target.matches('input') || colorPicker.matches(':popover-open')) return;
  if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId !== null) {
    deleteRectangle(selectedId);
  } else if (e.key === 'Escape' && selectedId !== null) {
    selectRectangle(null);
  }
});

// --- Sidebar toggle (mobile) ---
function setSidebarOpen(open) {
  sidebar.classList.toggle('open', open);
  sidebarToggle.setAttribute('aria-expanded', open);
}

sidebarToggle.addEventListener('click', () => {
  setSidebarOpen(!sidebar.classList.contains('open'));
});

// Close the sidebar when tapping the canvas
canvas.addEventListener('pointerdown', () => setSidebarOpen(false));

// --- Save / Load ---
$('saveLayout').addEventListener('click', () => {
  const data = {
    rectangles: rectangles.map(({ id, name, x, y, width, height, color }) => ({ id, name, x, y, width, height, color })),
    nextId,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'layout.json';
  a.click();
  // Revoking right away can cancel the download on iOS Safari
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

$('loadLayout').addEventListener('click', () => {
  fileInput.value = '';
  fileInput.click();
});

fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.rectangles)) throw new Error('No rectangles in file');
    rectangles = data.rectangles;
    nextId = data.nextId || Math.max(0, ...rectangles.map((r) => r.id)) + 1;
    nextColorIndex = rectangles.length;
    selectedId = null;
    renderList();
    fitView();
  } catch (err) {
    alert(`Couldn't open that file: ${err.message}`);
  }
});

// --- Init ---
window.addEventListener('resize', renderView);
render();
