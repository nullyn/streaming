// DOM Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const previewSection = document.getElementById('previewSection');
const preview = document.getElementById('preview');
const processBtn = document.getElementById('processBtn');
const progressSection = document.getElementById('progressSection');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const confirmationSection = document.getElementById('confirmationSection');
const songList = document.getElementById('songList');
const exportBtn = document.getElementById('exportBtn');
const resetBtn = document.getElementById('resetBtn');

let uploadedImage = null;
let extractedSongs = [];

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
        preview.src = e.target.result;
        dropZone.classList.add('hidden');
        previewSection.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}

// OCR Processing
async function processImage() {
    if (!uploadedImage) return;
    
    previewSection.classList.add('hidden');
    progressSection.classList.remove('hidden');
    progressBar.style.width = '0%';
    progressText.textContent = 'Initializing OCR...';
    
    try {
        const { data: { text } } = await Tesseract.recognize(
            uploadedImage,
            'eng',
            {
                logger: (m) => {
                    if (m.status === 'recognizing text') {
                        const progress = Math.round(m.progress * 100);
                        progressBar.style.width = `${progress}%`;
                        progressText.textContent = `Extracting text... ${progress}%`;
                    }
                }
            }
        );
        
        progressText.textContent = 'Parsing songs...';
        extractedSongs = parseSongsFromText(text);
        
        if (extractedSongs.length === 0) {
            alert('No songs found in the image. Please try a clearer screenshot.');
            reset();
            return;
        }
        
        progressSection.classList.add('hidden');
        displaySongConfirmation();
        
    } catch (error) {
        console.error('OCR Error:', error);
        alert('Failed to process image. Please try again.');
        reset();
    }
}

// Parse songs from OCR text
function parseSongsFromText(text) {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const songs = [];
    
    // Try to detect song patterns
    // Common patterns: "Title - Artist", "Title by Artist", "Artist: Title"
    let currentSong = null;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Skip common playlist UI elements
        if (line.match(/^(play|pause|shuffle|repeat|like|download|share|add|playlist|duration)/i)) {
            continue;
        }
        
        // Try to match "Title - Artist" or "Title by Artist"
        const dashMatch = line.match(/^(.+?)\s*[-–—]\s*(.+)$/);
        const byMatch = line.match(/^(.+?)\s+by\s+(.+)$/i);
        const colonMatch = line.match(/^(.+?):\s*(.+)$/);
        
        if (dashMatch) {
            songs.push({
                title: dashMatch[1].trim(),
                artist: dashMatch[2].trim()
            });
        } else if (byMatch) {
            songs.push({
                title: byMatch[1].trim(),
                artist: byMatch[2].trim()
            });
        } else if (colonMatch && colonMatch[2].length > 3) {
            songs.push({
                title: colonMatch[2].trim(),
                artist: colonMatch[1].trim()
            });
        } else if (line.length > 3 && !line.match(/^\d+$/)) {
            // If we have a potential song title without artist
            if (currentSong === null) {
                currentSong = { title: line, artist: '' };
            } else if (currentSong.artist === '') {
                // Next line might be the artist
                currentSong.artist = line;
                songs.push(currentSong);
                currentSong = null;
            } else {
                // Start a new song
                if (currentSong.title) {
                    songs.push(currentSong);
                }
                currentSong = { title: line, artist: '' };
            }
        }
    }
    
    // Add the last song if exists
    if (currentSong && currentSong.title) {
        songs.push(currentSong);
    }
    
    return songs;
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
    
    // Create text content
    let content = 'Playlist Songs\n';
    content += '='.repeat(50) + '\n\n';
    
    extractedSongs.forEach((song, index) => {
        content += `${index + 1}. ${song.title}${song.artist ? ' - ' + song.artist : ''}\n`;
    });
    
    // Create download
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'playlist-songs.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Reset everything
function reset() {
    uploadedImage = null;
    extractedSongs = [];
    fileInput.value = '';
    preview.src = '';
    
    previewSection.classList.add('hidden');
    progressSection.classList.add('hidden');
    confirmationSection.classList.add('hidden');
    dropZone.classList.remove('hidden');
    
    songList.innerHTML = '';
}

// Event listeners
processBtn.addEventListener('click', processImage);
exportBtn.addEventListener('click', exportToFile);
resetBtn.addEventListener('click', reset);

// Initialize on load
initDragAndDrop();
