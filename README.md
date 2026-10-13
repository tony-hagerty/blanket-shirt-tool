# Blanket Shirt Tool

A web-based rectangle layout tool for designing quilt blocks, patchwork layouts, and other rectangular arrangements (mainly for t-shirts). Built with vanilla HTML, CSS, and JavaScript -- no frameworks or build step. Fonts (Inter Tight and Inter) load from Google Fonts, with system fallbacks.

## Features

- **Canvas Drawing** -- Drag, resize, and arrange pieces on a graph-paper canvas (1 square = 1 inch)
- **Dimension Constraints** -- Set min/max width and height limits to keep rectangles within desired bounds
- **Color Coding** -- Each new piece gets a pastel color; click its swatch in the sidebar to pick another or choose a custom one
- **Custom Names** -- Name each piece; click the name in the sidebar to edit inline
- **Rotation** -- Rotate pieces 90° via the sidebar button (swaps width and height)
- **Pan & Zoom** -- Drag the background to pan; scroll or pinch to zoom (10% -- 500%); **Fit** frames every piece
- **Keyboard** -- `Delete`/`Backspace` removes the selected piece, `Esc` deselects
- **Save / Open** -- Export the layout to a JSON file or open one back up
- **Mobile Support** -- Slide-out sidebar, pinch-to-zoom, and touch drag/resize
- **Light & Dark** -- Follows your system color scheme

## File Structure

```
├── index.html          # Main application page
├── src/
│   ├── app.js          # Application logic
│   └── styles.css      # Styles and responsive breakpoints
└── README.md
```

## Usage

1. Open `index.html` in any modern browser.
2. Set the min/max dimension constraints in the sidebar.
3. Optionally type a name and click **Add** (or press Enter).
4. Click a piece on the canvas to select it. Drag to move, or use the corner/edge handles to resize.
5. Click a piece's name in the sidebar to rename it.
6. Use the rotate (↻) or delete (×) buttons on each sidebar entry.
7. Scroll the canvas to zoom, or pinch on mobile.
8. Click **Save** to export your layout, or **Open…** to restore one.
