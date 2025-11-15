#!/usr/bin/env python3
"""
Convert track names to Spotify URLs and download them
Reads from my-playlist.txt and outputs spotify-urls.txt
"""

import requests
import base64
import sys
import subprocess
import shutil
from pathlib import Path
from datetime import datetime

# Spotify API credentials
# Get these from: https://developer.spotify.com/dashboard
CLIENT_ID = "8c4c17ed4f484450b031965a88b6bd20"
CLIENT_SECRET = "b7e24ad737f14785b6fedef0ce18c245"

def get_spotify_token(client_id, client_secret):
    """Get Spotify API access token"""
    auth_string = f"{client_id}:{client_secret}"
    auth_bytes = auth_string.encode("utf-8")
    auth_base64 = base64.b64encode(auth_bytes).decode("utf-8")
    
    url = "https://accounts.spotify.com/api/token"
    headers = {
        "Authorization": f"Basic {auth_base64}",
        "Content-Type": "application/x-www-form-urlencoded"
    }
    data = {"grant_type": "client_credentials"}
    
    response = requests.post(url, headers=headers, data=data)
    if response.status_code != 200:
        print(f"❌ Failed to get token: {response.text}")
        sys.exit(1)
    
    return response.json()["access_token"]

def search_track(query, token):
    """Search for a track on Spotify"""
    url = "https://api.spotify.com/v1/search"
    headers = {"Authorization": f"Bearer {token}"}
    params = {
        "q": query,
        "type": "track",
        "limit": 1
    }
    
    response = requests.get(url, headers=headers, params=params)
    if response.status_code != 200:
        print(f"⚠️  Search failed for: {query}")
        return None
    
    data = response.json()
    if data["tracks"]["items"]:
        track = data["tracks"]["items"][0]
        return {
            "url": track["external_urls"]["spotify"],
            "name": track["name"],
            "artist": track["artists"][0]["name"]
        }
    return None

def main():
    # Check credentials
    if CLIENT_ID == "YOUR_CLIENT_ID_HERE" or CLIENT_SECRET == "YOUR_CLIENT_SECRET_HERE":
        print("❌ Please set your Spotify API credentials in the script")
        print("📝 Get them from: https://developer.spotify.com/dashboard")
        print("\nSteps:")
        print("1. Go to https://developer.spotify.com/dashboard")
        print("2. Log in with your Spotify account")
        print("3. Click 'Create app'")
        print("4. Fill in app name and description")
        print("5. Copy the Client ID and Client Secret")
        print("6. Update CLIENT_ID and CLIENT_SECRET in this script")
        sys.exit(1)
    
    input_file = Path("my-playlist.txt")
    output_file = Path("spotify-urls.txt")
    
    if not input_file.exists():
        print(f"❌ Input file not found: {input_file}")
        sys.exit(1)
    
    print("🔑 Getting Spotify access token...")
    token = get_spotify_token(CLIENT_ID, CLIENT_SECRET)
    print("✅ Token obtained\n")
    
    # Read input file
    with open(input_file, 'r') as f:
        lines = [line.strip() for line in f if line.strip()]
    
    results = []
    print(f"🔍 Converting {len(lines)} tracks...\n")
    
    for line in lines:
        # Skip line numbers if present
        if line and line[0].isdigit():
            line = ' '.join(line.split()[1:])
        
        if not line:
            continue
            
        print(f"Searching: {line}")
        result = search_track(line, token)
        
        if result:
            print(f"  ✅ Found: {result['name']} - {result['artist']}")
            results.append(result['url'])
        else:
            print(f"  ❌ Not found")
            results.append(f"# NOT FOUND: {line}")
        print()
    
    # Write output
    with open(output_file, 'w') as f:
        f.write('\n'.join(results))
    
    found_count = sum(1 for r in results if not r.startswith('#'))
    print(f"\n✅ Done! Converted {found_count}/{len(lines)} tracks")
    print(f"📄 Output saved to: {output_file}")
    
    # Ask for format preference
    print("\n🎵 Choose output format:")
    print("  1) m4a (default, smaller file size)")
    print("  2) mp3 (more compatible)")
    choice = input("Enter choice (1 or 2): ").strip()
    
    output_format = "m4a" if choice != "2" else "mp3"
    print(f"\n📦 Selected format: {output_format}")
    
    # Create dated folder in Music directory
    date_folder = datetime.now().strftime("%d-%b-%Y")
    music_dir = Path("/Users/nalin/Music") / date_folder
    music_dir.mkdir(parents=True, exist_ok=True)
    print(f"📁 Output directory: {music_dir}")
    
    # Download tracks
    print(f"\n⬇️  Downloading {found_count} tracks...\n")
    script_dir = Path(__file__).parent
    cli_path = script_dir / "cli.js"
    
    # Run freyr with custom output directory
    cmd = [str(cli_path), "get", "-i", str(output_file), "-d", str(script_dir)]
    subprocess.run(cmd)
    
    # Move and flatten all downloaded files
    print(f"\n📦 Organizing files...")
    converted_count = 0
    moved_count = 0
    
    for audio_file in script_dir.rglob("*.m4a"):
        if audio_file.is_file() and "node_modules" not in str(audio_file):
            dest_file = music_dir / audio_file.name
            
            if output_format == "mp3" and audio_file.suffix == ".m4a":
                # Convert m4a to mp3
                mp3_dest = dest_file.with_suffix(".mp3")
                print(f"  🔄 Converting: {audio_file.name} -> {mp3_dest.name}")
                result = subprocess.run(
                    ["ffmpeg", "-i", str(audio_file), "-codec:a", "libmp3lame", "-b:a", "320k", "-y", str(mp3_dest)],
                    capture_output=True
                )
                if result.returncode == 0:
                    converted_count += 1
                    audio_file.unlink()  # Remove original m4a
                else:
                    print(f"    ⚠️  Conversion failed, keeping m4a")
                    shutil.move(str(audio_file), str(dest_file))
                    moved_count += 1
            else:
                # Just move the file
                shutil.move(str(audio_file), str(dest_file))
                moved_count += 1
    
    # Clean up artist/album folders
    for item in script_dir.iterdir():
        if item.is_dir() and item.name not in ["node_modules", ".git", ".github", "src", "test", "media", date_folder]:
            shutil.rmtree(item)
    
    print(f"\n✅ Complete!")
    if converted_count > 0:
        print(f"  🔄 Converted: {converted_count} files to mp3")
    if moved_count > 0:
        print(f"  📁 Moved: {moved_count} files")
    print(f"  📂 Location: {music_dir}")
    print(f"\n🎧 Your music is ready!")

if __name__ == "__main__":
    main()
