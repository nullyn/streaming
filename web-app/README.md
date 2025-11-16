# Playlist Screenshot Reader

A web application that extracts song information from playlist screenshots using AI vision models.

## Features

- **Drag & Drop Interface** - Simply drag a playlist screenshot onto the page
- **Multiple AI Providers** - Choose from OpenAI, Claude, or GLM
- **AI Vision Processing** - Accurate text extraction with context understanding
- **Smart Recognition** - AI understands playlist layouts and extracts structured data
- **Interactive Editing** - Review, edit, and confirm each song
- **Remove Songs** - Click the X button to remove unwanted entries
- **Export to File** - Save your playlist as a text file

## How to Use

1. **Get an API Key** (choose one provider)
   - **OpenAI**: [platform.openai.com/api-keys](https://platform.openai.com/api-keys) (~$0.01-0.02/image)
   - **Claude**: [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) (~$0.008/image)
   - **GLM**: [open.bigmodel.cn/usercenter/apikeys](https://open.bigmodel.cn/usercenter/apikeys) (~$0.005/image)

2. **Configure the App**
   - Open `index.html` in a web browser
   - Click the "⚙️ API Configuration" section
   - Select your preferred AI provider
   - Paste your API key (it's stored locally in your browser)

3. **Upload a screenshot** of your playlist by:
   - Dragging and dropping it onto the upload area
   - Or clicking the upload area to browse for a file

4. **Extract Songs**
   - Preview the screenshot and click "Extract Songs"
   - Wait for AI processing (progress bar will show status)

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
- **AI Vision Models** - Multiple provider support

## Supported AI Providers

| Provider | Model | Cost/Image | Best For |
|----------|-------|------------|----------|
| **OpenAI** | GPT-4o-mini | ~$0.01-0.02 | Best overall accuracy |
| **Claude** | Claude 3.5 Haiku | ~$0.008 | Excellent vision understanding |
| **GLM** | GLM-4V-Plus | ~$0.005 | Chinese language support |

- API keys stored locally in your browser
- Much more accurate than traditional OCR
- Choose the provider that best fits your needs and budget

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
