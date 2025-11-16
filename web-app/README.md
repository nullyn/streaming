# Playlist Screenshot Reader

A web application that extracts song information from playlist screenshots using OCR (Optical Character Recognition).

## Features

- **Drag & Drop Interface** - Simply drag a playlist screenshot onto the page
- **OCR Processing** - Uses Tesseract.js to extract text from images
- **Smart Parsing** - Automatically detects song titles and artist names
- **Interactive Editing** - Review, edit, and confirm each song
- **Remove Songs** - Click the X button to remove unwanted entries
- **Export to File** - Save your playlist as a text file

## How to Use

1. **Open `index.html`** in a web browser
2. **Upload a screenshot** of your playlist by:
   - Dragging and dropping it onto the upload area
   - Or clicking the upload area to browse for a file
3. **Preview** the screenshot and click "Extract Songs"
4. **Wait** for the OCR processing (progress bar will show status)
5. **Review and Edit** the extracted songs:
   - Edit song titles and artist names directly in the text fields
   - Click the red X button to remove any incorrect entries
6. **Export** your playlist to a text file

## Supported Screenshot Formats

- PNG
- JPEG/JPG
- WebP
- Any image format supported by modern browsers

## Tips for Best Results

- Use high-resolution screenshots
- Ensure text is clear and readable
- Crop the screenshot to focus on the playlist area
- Avoid screenshots with overlapping elements or poor contrast

## Technology Stack

- **HTML5** - Structure
- **CSS3** - Styling with modern gradients and animations
- **JavaScript (ES6+)** - Application logic
- **Tesseract.js** - OCR engine for text extraction

## Local Development

No build process required! Simply:

```bash
# Navigate to the web-app directory
cd web-app

# Open index.html in your browser
open index.html  # macOS
# or
start index.html # Windows
# or
xdg-open index.html # Linux
```

## Browser Compatibility

Works in all modern browsers that support:
- ES6+ JavaScript
- FileReader API
- Drag and Drop API
- WebAssembly (for Tesseract.js)

Tested on:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Future Enhancements

Potential features for future development:
- Integration with Freyr CLI for automatic downloads
- Support for multiple image uploads
- Batch processing
- Export to different formats (JSON, CSV, M3U)
- Direct integration with streaming services APIs

## License

Part of the Freyr project - see main repository for license information.
