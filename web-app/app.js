// DOM Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const apiProviderSelect = document.getElementById('apiProvider');
const apiKeyInput = document.getElementById('apiKey');
const saveKeyBtn = document.getElementById('saveKeyBtn');
const keySavedMsg = document.getElementById('keySavedMsg');
const previewSection = document.getElementById('previewSection');
const preview = document.getElementById('preview');
const processBtn = document.getElementById('processBtn');
const progressSection = document.getElementById('progressSection');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const confirmationSection = document.getElementById('confirmationSection');
const songList = document.getElementById('songList');
const exportBtn = document.getElementById('exportBtn');
const downloadBtn = document.getElementById('downloadBtn');
const workingIndicator = document.getElementById('workingIndicator');
const resetBtn = document.getElementById('resetBtn');

let uploadedImage = null;
let uploadedImageBase64 = null;
let extractedSongs = [];
let exportedPlaylistText = '';

// Load saved provider and API key from localStorage
const savedProvider = localStorage.getItem('ai_provider') || 'openai';
apiProviderSelect.value = savedProvider;
loadApiKeyForProvider(savedProvider);
updateProviderUI(savedProvider);

// Handle provider change
apiProviderSelect.addEventListener('change', (e) => {
    const provider = e.target.value;
    localStorage.setItem('ai_provider', provider);
    loadApiKeyForProvider(provider);
    updateProviderUI(provider);
});

// Save API key button handler
saveKeyBtn.addEventListener('click', () => {
    const provider = apiProviderSelect.value;
    const key = apiKeyInput.value.trim();
    
    if (!key) {
        alert('Please enter an API key first');
        return;
    }
    
    localStorage.setItem(`${provider}_api_key`, key);
    
    // Show saved message
    keySavedMsg.style.display = 'block';
    
    // Collapse the API config section after 1.5 seconds
    setTimeout(() => {
        keySavedMsg.style.display = 'none';
        const detailsElement = document.querySelector('.api-config details');
        if (detailsElement) {
            detailsElement.open = false;
        }
    }, 1500);
});

// Auto-save API key when typing (after a delay)
let saveTimeout;
apiKeyInput.addEventListener('input', () => {
    clearTimeout(saveTimeout);
    keySavedMsg.style.display = 'none';
    
    saveTimeout = setTimeout(() => {
        const provider = apiProviderSelect.value;
        if (apiKeyInput.value.trim()) {
            localStorage.setItem(`${provider}_api_key`, apiKeyInput.value);
        }
    }, 1000);
});

function loadApiKeyForProvider(provider) {
    const key = localStorage.getItem(`${provider}_api_key`) || '';
    apiKeyInput.value = key;
}

function updateProviderUI(provider) {
    // Show/hide provider links
    document.querySelectorAll('.api-link').forEach(link => {
        link.style.display = link.dataset.provider === provider ? 'inline-block' : 'none';
    });
    
    // Show/hide provider info
    document.querySelectorAll('.info-text').forEach(info => {
        info.style.display = info.dataset.provider === provider ? 'block' : 'none';
    });
}

// API Configuration for different providers
const API_CONFIGS = {
    openai: {
        endpoint: 'https://api.openai.com/v1/chat/completions',
        model: 'gpt-4o-mini',
        buildRequest: (apiKey, base64Image) => ({
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: 'This is a screenshot of a music playlist. Extract ALL song titles and artist names. Return ONLY a JSON array with this exact format: [{"title": "Song Name", "artist": "Artist Name"}]. Do not include any other text, explanations, or markdown formatting. Just the raw JSON array.'
                        },
                        {
                            type: 'image_url',
                            image_url: { url: base64Image }
                        }
                    ]
                }],
                max_tokens: 2000
            })
        }),
        parseResponse: (data) => data.choices[0].message.content
    },
    claude: {
        endpoint: 'https://api.anthropic.com/v1/messages',
        model: 'claude-3-5-haiku-20241022',
        buildRequest: (apiKey, base64Image) => ({
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-3-5-haiku-20241022',
                max_tokens: 2000,
                messages: [{
                    role: 'user',
                    content: [
                        {
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: base64Image.startsWith('data:image/png') ? 'image/png' : 'image/jpeg',
                                data: base64Image.split(',')[1]
                            }
                        },
                        {
                            type: 'text',
                            text: 'This is a screenshot of a music playlist. Extract ALL song titles and artist names. Return ONLY a JSON array with this exact format: [{"title": "Song Name", "artist": "Artist Name"}]. Do not include any other text, explanations, or markdown formatting. Just the raw JSON array.'
                        }
                    ]
                }]
            })
        }),
        parseResponse: (data) => data.content[0].text
    },
    glm: {
        endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
        model: 'glm-4v-plus',
        buildRequest: (apiKey, base64Image) => ({
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'glm-4v-plus',
                messages: [{
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: 'This is a screenshot of a music playlist. Extract ALL song titles and artist names. Return ONLY a JSON array with this exact format: [{"title": "Song Name", "artist": "Artist Name"}]. Do not include any other text, explanations, or markdown formatting. Just the raw JSON array.'
                        },
                        {
                            type: 'image_url',
                            image_url: { url: base64Image }
                        }
                    ]
                }]
            })
        }),
        parseResponse: (data) => data.choices[0].message.content
    },
};

// Check if proxy server is available
let proxyCheckCache = null;
let proxyCheckTime = 0;

async function checkProxyAvailable() {
    // Cache result for 30 seconds
    if (proxyCheckCache !== null && Date.now() - proxyCheckTime < 30000) {
        return proxyCheckCache;
    }
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1000);
        
        const response = await fetch('http://localhost:3000', {
            method: 'OPTIONS',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        proxyCheckCache = response.ok;
        proxyCheckTime = Date.now();
        return proxyCheckCache;
    } catch (e) {
        proxyCheckCache = false;
        proxyCheckTime = Date.now();
        return false;
    }
}

// Initialize drag and drop
function initDragAndDrop() {
    // Click to upload
    dropZone.addEventListener('click', () => fileInput.click());
    
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    // Highlight drop zone when dragging over
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.add('drag-over');
        });
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.remove('drag-over');
        });
    });
    
    // Handle dropped files
    dropZone.addEventListener('drop', handleDrop);
    fileInput.addEventListener('change', handleFileSelect);
}

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles(files);
}

function handleFileSelect(e) {
    const files = e.target.files;
    handleFiles(files);
}

function handleFiles(files) {
    if (files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('image/')) {
            uploadedImage = file;
            displayPreview(file);
        } else {
            alert('Please upload an image file');
        }
    }
}

function displayPreview(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        uploadedImageBase64 = e.target.result;
        preview.src = uploadedImageBase64;
        dropZone.classList.add('hidden');
        previewSection.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}

// AI Vision Processing with Multiple Providers
async function processImage() {
    if (!uploadedImageBase64) return;
    
    const provider = apiProviderSelect.value;
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
        alert('Please enter your API key in the configuration section above.');
        return;
    }
    
    const config = API_CONFIGS[provider];
    if (!config) {
        alert('Invalid provider selected');
        return;
    }
    
    previewSection.classList.add('hidden');
    progressSection.classList.remove('hidden');
    progressBar.style.width = '30%';
    progressText.textContent = `Analyzing image with ${provider.toUpperCase()}...`;
    
    try {
        const requestConfig = config.buildRequest(apiKey, uploadedImageBase64);
        
        // Try to use local proxy server if available (bypasses CORS)
        const useProxy = await checkProxyAvailable();
        let response;
        
        if (useProxy) {
            // Use proxy server
            response = await fetch('http://localhost:3000', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    endpoint: config.endpoint,
                    headers: requestConfig.headers,
                    body: requestConfig.body
                })
            });
        } else {
            // Direct API call (may fail with CORS)
            response = await fetch(config.endpoint, requestConfig);
        }
        
        progressBar.style.width = '70%';
        progressText.textContent = 'Processing response...';
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || error.message || 'API request failed');
        }
        
        const data = await response.json();
        const content = config.parseResponse(data).trim();
        
        progressBar.style.width = '90%';
        progressText.textContent = 'Parsing songs...';
        
        // Parse the JSON response
        let songs;
        try {
            // Remove markdown code blocks if present
            const cleanContent = content.replace(/```json\n?|```\n?/g, '').trim();
            songs = JSON.parse(cleanContent);
        } catch (e) {
            console.error('Failed to parse JSON:', content);
            throw new Error('Failed to parse AI response. Please try again.');
        }
        
        if (!Array.isArray(songs) || songs.length === 0) {
            alert('No songs found in the image. Please try a clearer screenshot.');
            reset();
            return;
        }
        
        extractedSongs = songs;
        progressBar.style.width = '100%';
        
        setTimeout(() => {
            progressSection.classList.add('hidden');
            displaySongConfirmation();
        }, 300);
        
    } catch (error) {
        console.error('AI Processing Error:', error);
        
        let errorMessage = error.message;
        
        // Check if it's a CORS error
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            errorMessage = `CORS Error: Browser blocked the request to ${config.endpoint}.\n\n` +
                         `This is a browser security restriction. To fix this:\n` +
                         `1. Use a CORS proxy (see README)\n` +
                         `2. Run a local server instead of opening HTML directly\n` +
                         `3. Use a browser extension to bypass CORS (development only)`;
        }
        
        alert(`Failed to process image:\n\n${errorMessage}`);
        reset();
    }
}


// Display song confirmation UI
function displaySongConfirmation() {
    songList.innerHTML = '';
    
    extractedSongs.forEach((song, index) => {
        const songItem = document.createElement('div');
        songItem.className = 'song-item';
        songItem.dataset.index = index;
        
        songItem.innerHTML = `
            <div class="song-number">${index + 1}</div>
            <div class="song-details">
                <input type="text" 
                       class="song-input song-title-input" 
                       value="${song.title}" 
                       placeholder="Song title"
                       data-index="${index}"
                       data-field="title">
                <input type="text" 
                       class="song-input song-artist-input" 
                       value="${song.artist}" 
                       placeholder="Artist name"
                       data-index="${index}"
                       data-field="artist">
            </div>
            <button class="remove-btn" data-index="${index}" title="Remove song">×</button>
        `;
        
        songList.appendChild(songItem);
    });
    
    // Add event listeners
    document.querySelectorAll('.song-input').forEach(input => {
        input.addEventListener('input', handleSongEdit);
    });
    
    document.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', handleSongRemove);
    });
    
    confirmationSection.classList.remove('hidden');
}

function handleSongEdit(e) {
    const index = parseInt(e.target.dataset.index);
    const field = e.target.dataset.field;
    extractedSongs[index][field] = e.target.value;
}

function handleSongRemove(e) {
    const index = parseInt(e.target.dataset.index);
    const songItem = e.target.closest('.song-item');
    
    // Add fade-out animation
    songItem.style.opacity = '0';
    songItem.style.transform = 'translateX(50px)';
    
    setTimeout(() => {
        extractedSongs.splice(index, 1);
        displaySongConfirmation();
    }, 200);
}

// Export to file
function exportToFile() {
    if (extractedSongs.length === 0) {
        alert('No songs to export');
        return;
    }
    
    // Create clean content - one song per line, no special characters
    // Format: "Title - Artist" for Spotify API compatibility
    const content = extractedSongs
        .map(song => {
            // Clean special characters that might break Spotify API
            const cleanTitle = song.title.replace(/[\n\r\t]/g, ' ').trim();
            const cleanArtist = song.artist.replace(/[\n\r\t]/g, ' ').trim();
            
            // Return simple format: "Title - Artist"
            return cleanArtist ? `${cleanTitle} - ${cleanArtist}` : cleanTitle;
        })
        .join('\n');
    
    // Save for server-side download
    exportedPlaylistText = content;
    
    // Create download of playlist file
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'playlist-songs.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Swap buttons: hide export, show download
    exportBtn.classList.add('hidden');
    downloadBtn.classList.remove('hidden');
    downloadBtn.disabled = false;
    downloadBtn.textContent = 'Download Songs';
}

async function downloadSongs() {
    if (!exportedPlaylistText) {
        alert('Please export the playlist first!');
        return;
    }

    downloadBtn.disabled = true;
    downloadBtn.textContent = 'Downloading...';
    workingIndicator.classList.remove('hidden');
    
    const logViewer = document.getElementById('logViewer');
    const logContent = document.getElementById('logContent');
    const progressBar = document.getElementById('downloadProgressBar');
    const progressMessage = document.getElementById('downloadProgressMessage');
    
    logViewer.classList.remove('hidden');
    logContent.innerHTML = '';

    try {
        // Use Server-Sent Events for streaming progress
        const eventSource = new EventSource('http://localhost:3000/download-playlist?' + 
            new URLSearchParams({ playlistText: exportedPlaylistText }));
        
        // Actually we need to POST, so use fetch with streaming
        const response = await fetch('http://localhost:3000/download-playlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playlistText: exportedPlaylistText }),
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // Keep incomplete line in buffer

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        handleProgressUpdate(data, progressBar, progressMessage, logContent);
                        
                        // Handle download-ready event
                        if (data.stage === 'download-ready') {
                            // Convert base64 to blob and trigger download
                            const binaryString = atob(data.zipData);
                            const bytes = new Uint8Array(binaryString.length);
                            for (let i = 0; i < binaryString.length; i++) {
                                bytes[i] = binaryString.charCodeAt(i);
                            }
                            const blob = new Blob([bytes], { type: 'application/zip' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = data.filename;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                            
                            downloadBtn.textContent = 'Download Complete ✓';
                            return;
                        }
                        
                        if (data.stage === 'error') {
                            throw new Error(data.message);
                        }
                    } catch (e) {
                        console.error('Failed to parse progress data:', e);
                    }
                }
            }
        }

    } catch (error) {
        console.error('Download error:', error);
        alert(`Failed to download songs: ${error.message}`);
        downloadBtn.disabled = false;
        downloadBtn.textContent = 'Download Songs';
        workingIndicator.classList.add('hidden');
        logViewer.classList.add('hidden');
    }
}

function handleProgressUpdate(data, progressBar, progressMessage, logContent) {
    // Update progress bar
    if (data.progress !== undefined) {
        progressBar.style.width = `${data.progress}%`;
    }
    
    // Update message
    if (data.message) {
        progressMessage.textContent = data.message;
    }
    
    // Add log entry
    if (data.log) {
        const logLine = document.createElement('div');
        logLine.className = `log-line ${data.stage || ''}`;
        logLine.textContent = data.log;
        logContent.appendChild(logLine);
        logContent.scrollTop = logContent.scrollHeight;
    }
}

// Reset everything
function reset() {
    uploadedImage = null;
    extractedSongs = [];
    exportedPlaylistText = '';
    fileInput.value = '';
    preview.src = '';
    
    previewSection.classList.add('hidden');
    progressSection.classList.add('hidden');
    confirmationSection.classList.add('hidden');
    dropZone.classList.remove('hidden');
    workingIndicator.classList.add('hidden');
    downloadBtn.classList.add('hidden');
    exportBtn.classList.remove('hidden');
    exportBtn.disabled = false;
    exportBtn.textContent = 'Export to Playlist';
    
    songList.innerHTML = '';
}

// Event listeners
processBtn.addEventListener('click', processImage);
exportBtn.addEventListener('click', exportToFile);
downloadBtn.addEventListener('click', downloadSongs);
resetBtn.addEventListener('click', reset);

// Initialize on load
initDragAndDrop();
