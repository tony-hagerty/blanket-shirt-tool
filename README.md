# Blanket Shirt Tool

A web-based rectangle layout tool for designing quilt blocks, patchwork layouts, and other rectangular arrangements (mainly for t-shirts). Built with vanilla HTML, CSS, and JavaScript -- no frameworks or dependencies.

## Features

- **Canvas Drawing** -- Drag, resize, and arrange rectangles on a dark canvas with a grid (1 inch = 20 px scale)
- **Dimension Constraints** -- Set min/max width and height limits to keep rectangles within desired bounds
- **Color Coding** -- Each new rectangle gets a unique pastel color with a color indicator in the sidebar
- **Custom Names** -- Name each rectangle; click the name in the sidebar to edit inline
- **Rotation** -- Rotate rectangles 90° via the sidebar button (swaps width and height)
- **Pan & Zoom** -- Pan the canvas by dragging the background; zoom with scroll wheel (0.1x -- 5x)
- **Save / Load** -- Export the layout to a JSON file or load one back in
- **Mobile Support** -- Responsive layout with a slide-out sidebar, pinch-to-zoom, and touch drag/resize

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
3. Optionally type a name and click **+ Add Rectangle**.
4. Click a rectangle on the canvas to select it. Drag to move, or use the corner/edge handles to resize.
5. Click a rectangle's name in the sidebar to rename it.
6. Use the rotate (↻) or delete (×) buttons on each sidebar entry.
7. Scroll the canvas to zoom, or pinch on mobile.
8. Click **Save JSON** to export your layout, or **Load JSON** to restore one.
