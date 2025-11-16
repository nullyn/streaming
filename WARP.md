# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

Freyr is a service-agnostic music downloader that extracts metadata from streaming services (Spotify, Apple Music, Deezer), sources audio from YouTube Music, and produces organized, metadata-rich AAC files.

## Common Commands

### Development Setup
```bash
# Install dependencies
npm install

# Link for global CLI usage
npm link

# Or with Yarn
yarn install
yarn link
```

### Testing
```bash
# Run all tests
npm test -- --all

# Run tests for a specific service
npm test -- spotify
npm test -- apple_music
npm test -- deezer

# Run tests for a specific resource type
npm test -- spotify.track
npm test -- apple_music.album
npm test -- deezer.artist

# Use a custom test suite
npm test -- --all --suite ./custom-suite.json

# Run tests in a docker container
npm test -- spotify --docker freyr-dev:latest

# Customize test working directory
npm test -- spotify.track --name run-1 --stage ./test-runs
```

### Code Quality
```bash
# Linting (ESLint with Prettier)
npx eslint .

# Format code
npx prettier --write .
```

### Docker
```bash
# Build local development image
docker build -t freyr-dev .

# Run freyr in docker
docker run -it --rm -v $PWD:/data freyrcli/freyrjs [args...]

# Drop into container shell
docker run -it --entrypoint bash freyr-dev
```

### Running the CLI
```bash
# Download a track
freyr spotify:track:5FNS5Vj69AhRGJWjhrAd01

# Download with custom directory
freyr -d ~/Music spotify:album:2D23kwwoy2JpZVuJwzE42B

# Batch download from file
freyr -i ./queue.txt

# Download with filters
freyr --filter title="all*good girls*hell" --filter artist="*eilish" [query]

# Convert between URIs and URLs
freyr urify https://open.spotify.com/album/2D23kwwoy2JpZVuJwzE42B
```

## Architecture

### Service Layer (`src/services/`)
Freyr implements a plugin-based architecture where each streaming service is a separate module:

- **`spotify.js`** - Spotify metadata extraction via OAuth2
- **`apple_music.js`** - Apple Music metadata with automated token acquisition
- **`deezer.js`** - Deezer metadata (no auth required)
- **`youtube.js`** - YouTube/YouTube Music audio sourcing

All services implement a common interface using the `symbols.meta` pattern for:
- Service identification (`ID`, `VALID_URL` regex)
- Capabilities (`PROPS.isQueryable`, `PROPS.isSourceable`)
- Supported bitrates and resource types

### Core Architecture (`src/freyr.js`)
- `FreyrCore.ENGINES` - Registry of all service implementations
- `identifyService(url)` - Pattern matches URL to appropriate service
- `collateSources()` - Returns audio source providers (YouTube, YouTube Music)
- `sortSources()` - Orders sources by preference for audio acquisition

### CLI Layer (`cli.js`)
The CLI is a monolithic file (~2500+ lines) handling:
- **Argument parsing** - Commander.js-based CLI interface
- **Authentication flow** - OAuth server management via `cli_server.js`
- **Download pipeline** - Multi-stage concurrent processing:
  - Query parsing → Metadata extraction → Audio sourcing → Download → Encoding → Metadata embedding
- **Progress tracking** - `xprogress` for real-time download visualization
- **File management** - Structured output organization

### Processing Pipeline
```
Query → Service Identification → Metadata Extraction
  ↓
Audio Source Search (YouTube Music/YouTube)
  ↓
Concurrent Download (libxget chunked downloads)
  ↓
FFmpeg Encoding (Wasm-based, 320kbps AAC by default)
  ↓
Metadata Embedding (AtomicParsley)
  ↓
File Organization (<Artist>/<Album>/<Track>)
```

### Concurrency Model (`conf.json`)
Freyr uses staged concurrency for different operations:
- `queries`: Simultaneous streaming service queries
- `tracks`: Parallel track processing
- `trackStage`: Pre-processing queue size
- `downloader`: Concurrent track downloads
- `encoder`: FFmpeg encoding parallelism
- `embedder`: Metadata embedding parallelism

### Authentication
- **Spotify**: OAuth2 with client credentials stored in `conf.json`
- **Apple Music**: Automated developer token extraction from web
- **Deezer**: No authentication required
- Session persistence via `Conf` package in platform-specific directories

### Dependencies of Note
- **`@ffmpeg/ffmpeg`** - WebAssembly FFmpeg (no native dependency)
- **`libxget`** - Chunked concurrent downloads
- **`AtomicParsley`** - External binary for metadata embedding (must be in PATH or `bins/{posix,windows}/`)
- **`youtube-dl-exec`** - Audio extraction from YouTube

## Key Utilities

### `src/async_queue.js`
Concurrency-controlled promise queue for managing parallel operations.

### `src/file_mgr.js`
File lifecycle management with atomic operations and cleanup tracking.

### `src/filter_parser.js`
Query language parser for track filtering (glob patterns, ranges, boolean logic).

### `src/parse_range.js`
Parses range specifications like `3..7`, `..=5` for numeric and time-based filtering.

### `src/stack_logger.js`
Structured logging with debug stack traces (enabled via `SHOW_DEBUG_STACK` env var).

## Configuration

### Project Config (`conf.json`)
Contains defaults for:
- Server configuration (OAuth callback)
- Concurrency limits
- Download sources order
- Streaming service credentials
- Image dimensions for cover art

### User Config
Persistent per-user settings stored in:
- macOS: `~/Library/Preferences/FreyrCLI/d3fault.x4p`
- Linux: `~/.config/FreyrCLI/d3fault.x4p`

### Environment Variables
- `SHOW_DEBUG_STACK` - Enable extended debug logging
- `ATOMIC_PARSLEY_PATH` - Override AtomicParsley binary location
- `NODE_ARGS` - Additional Node.js arguments for test runner
- `DOCKER_ARGS` - Additional Docker arguments for test runner

## Code Style

### ESLint Configuration
- ES6 modules (`type: "module"` in package.json)
- Prettier integration with custom rules:
  - Single quotes
  - No bracket spacing
  - Print width: 130
  - Arrow function parens: avoid
- Unused variables with `_` prefix are ignored

### Common Patterns
- ES6 imports/exports exclusively
- Promises with Bluebird for utilities (`.delay()`, `.map()` with concurrency)
- Symbol-based metadata on classes (`symbols.meta`)
- Async/await for asynchronous operations
- Streams for large file operations

## Testing

### Test Structure (`test/index.js`)
Custom test runner (not Jest/Mocha) that:
- Loads test suites from JSON files (see `test/default.json`)
- Spawns CLI as child process
- Captures stdout/stderr to log files
- Supports retry logic (3 attempts)
- Validates expectations (file existence, metadata)

### Test Suites
JSON format:
```json
{
  "service_name": {
    "resource_type": {
      "uri": "service:type:id",
      "filter": ["optional=filter"],
      "expect": {
        // validation rules
      }
    }
  }
}
```

## Binary Dependencies

### AtomicParsley
Required for metadata embedding. Freyr checks in order:
1. `bins/posix/` or `bins/windows/` (project directory)
2. System PATH
3. `ATOMIC_PARSLEY_PATH` environment variable

Minimum version: `20230114` (from miraclx/atomicparsley fork)

## Development Notes

### Return Codes
- `0`: Success
- `1`: Invalid query
- `2`: Invalid flag value
- `3`: Invalid/nonexistent config
- `4`: Network error
- `5`: Working directory error
- `6`: Failed to initialize FreyrCore
- `7`: Dependency path error

### Modifying Services
When adding/modifying service implementations:
1. Implement `symbols.meta` with required properties
2. Add to `FreyrCore.ENGINES` array
3. Implement `parseURI()`, `isAuthed()`, `hasOnceAuthed()`, `newAuth()` methods
4. Add URL regex pattern to `VALID_URL`
5. Update tests in `test/default.json`

### Audio Quality
Freyr encodes to AAC (m4a) with configurable bitrates: 96, 128, 160, 192, 256, 320kbps (default: 320kbps).
