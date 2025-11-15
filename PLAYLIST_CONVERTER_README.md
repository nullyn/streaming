# Playlist Converter Script

This repository includes a custom Python script (`convert_to_spotify_urls.py`) that automates converting plain text track names to Spotify URLs and downloading them with `freyr`.

## Features

- ✅ **Text to Spotify URL Conversion**: Converts track names to Spotify URLs using Spotify Web API
- ✅ **Format Selection**: Choose between M4A or MP3 output formats
- ✅ **Auto-conversion**: Automatically converts M4A to MP3 if selected
- ✅ **Date-organized Storage**: Creates dated folders (e.g., `15-Nov-2025`) in your Music directory
- ✅ **Flat File Structure**: All songs stored directly in the date folder (no artist/album subfolders)
- ✅ **Batch Processing**: Process multiple tracks from a text file

## Prerequisites

1. **Python 3** with `requests` library:
   ```bash
   pip3 install requests
   ```

2. **ffmpeg** (for MP3 conversion):
   ```bash
   brew install ffmpeg  # macOS
   # or
   sudo apt-get install ffmpeg  # Linux
   ```

3. **Spotify API Credentials**:
   - Go to [https://developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
   - Log in with your Spotify account
   - Click "Create app"
   - Fill in app name and description
   - Copy your **Client ID** and **Client Secret**

4. **freyr** installed (see main README)

## Setup

1. Clone this repository and navigate to it:
   ```bash
   git clone https://github.com/miraclx/freyr-js.git
   cd freyr-js
   ```

2. Make the script executable:
   ```bash
   chmod +x convert_to_spotify_urls.py
   ```

3. Edit the script and add your Spotify API credentials (lines 14-15):
   ```python
   CLIENT_ID = "your_client_id_here"
   CLIENT_SECRET = "your_client_secret_here"
   ```

## Usage

### 1. Create Your Playlist File

Create a text file named `my-playlist.txt` with your track names (one per line):

```
Thunderstruck AC/DC
Code Red AC/DC
Paradise City Guns N' Roses
Mystical Magical Benson Boone
Blurred Lines Robin Thicke
Breaking the Law Judas Priest
```

Format: `[Track Name] [Artist Name]`

### 2. Run the Converter Script

```bash
./convert_to_spotify_urls.py
```

The script will:
1. Search Spotify for each track
2. Generate `spotify-urls.txt` with Spotify URLs
3. Prompt you to choose output format:
   - `1` for M4A (smaller file size)
   - `2` for MP3 (more compatible)
4. Download all tracks using freyr
5. Convert to MP3 if selected
6. Move all files to `~/Music/[DD-MMM-YYYY]/`

### 3. Find Your Music

All downloaded tracks will be in:
```
~/Music/15-Nov-2025/
├── 01 Thunderstruck.mp3
├── 12 Code Red.mp3
├── 06 Paradise City.mp3
├── 01 Mystical Magical.mp3
├── 01 Blurred Lines.mp3
└── 03 Breaking the Law.mp3
```

## Output

- **Bitrate**: 320kbps
- **Format**: M4A or MP3 (your choice)
- **Metadata**: Full track metadata and album art embedded
- **Organization**: Flat structure in dated folder (`~/Music/DD-MMM-YYYY/`)

## Example Run

```bash
$ ./convert_to_spotify_urls.py
🔑 Getting Spotify access token...
✅ Token obtained

🔍 Converting 6 tracks...

Searching: Thunderstruck AC/DC
  ✅ Found: Thunderstruck - AC/DC

Searching: Code Red AC/DC
  ✅ Found: Code Red - AC/DC

...

✅ Done! Converted 6/6 tracks
📄 Output saved to: spotify-urls.txt

🎵 Choose output format:
  1) m4a (default, smaller file size)
  2) mp3 (more compatible)
Enter choice (1 or 2): 2

📦 Selected format: mp3
📁 Output directory: ~/Music/15-Nov-2025

⬇️  Downloading 6 tracks...
[freyr download output]

📦 Organizing files...
  🔄 Converting: 01 Thunderstruck.m4a -> 01 Thunderstruck.mp3
  🔄 Converting: 12 Code Red.m4a -> 12 Code Red.mp3
  ...

✅ Complete!
  🔄 Converted: 6 files to mp3
  📂 Location: ~/Music/15-Nov-2025

🎧 Your music is ready!
```

## Script Workflow

```
my-playlist.txt
      ↓
Spotify API Search
      ↓
spotify-urls.txt
      ↓
freyr Download (M4A, 320kbps)
      ↓
Format Conversion (if MP3 selected)
      ↓
Move to ~/Music/[DATE]/
      ↓
Cleanup temp folders
```

## Customization

Edit the script to change:

- **Input file**: Line 76 (`input_file = Path("my-playlist.txt")`)
- **Output directory**: Line 135 (`music_dir = Path("~/Music")`)
- **Date format**: Line 134 (`strftime("%d-%b-%Y")`)
- **Default bitrate**: Already 320kbps in freyr

## Troubleshooting

### "Invalid Query" errors
- Make sure your playlist file uses format: `Track Name Artist Name`
- Don't use music service URLs in the playlist file

### "Failed to get token"
- Verify your Spotify Client ID and Client Secret are correct
- Check internet connection

### "Conversion failed, keeping m4a"
- Make sure ffmpeg is installed: `which ffmpeg`
- Install if missing: `brew install ffmpeg`

### Empty output folder
- Check that freyr downloaded successfully (look for download messages)
- Verify the script didn't encounter errors during file moving

## Notes

- Each run creates a new dated folder based on the current date
- If you run the script multiple times in one day, files go to the same folder
- The script cleans up temporary artist/album folders after moving files
- Tracks already downloaded are skipped by freyr automatically

## License

This script is provided as-is for use with freyr-js. See the main LICENSE file for freyr-js licensing.
