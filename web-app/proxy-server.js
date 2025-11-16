#!/usr/bin/env node
/**
 * Simple CORS Proxy Server for AI Vision APIs
 * Run with: node proxy-server.js
 */

import http from 'http';
import https from 'https';
import { URL, fileURLToPath } from 'url';
import path from 'path';
import { tmpdir } from 'os';
import { spawn } from 'child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm, readdir, copyFile } from 'fs/promises';

const PORT = 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

async function collectAudioFiles(rootDir, exts) {
    const results = [];

    async function walk(dir) {
        const entries = await readdir(dir, {withFileTypes: true});
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                await walk(fullPath);
            } else {
                const lower = entry.name.toLowerCase();
                if (exts.some(ext => lower.endsWith(ext))) {
                    results.push(fullPath);
                }
            }
        }
    }

    await walk(rootDir);
    return results;
}

const server = http.createServer((req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, anthropic-version');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Only allow POST
    if (req.method !== 'POST') {
        res.writeHead(405);
        res.end('Method not allowed');
        return;
    }

    // Get request body
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', () => {
        try {
            const payload = body ? JSON.parse(body) : {};

            // Handle playlist download endpoint
            if (req.url === '/download-playlist') {
                handleDownloadPlaylist(payload, res);
                return;
            }

            // Generic proxy for AI APIs
            const { endpoint, headers, body: requestBody } = payload;

            if (!endpoint) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Missing endpoint' }));
                return;
            }

            // Parse the target URL
            const targetUrl = new URL(endpoint);
            const protocol = targetUrl.protocol === 'https:' ? https : http;

            // Prepare request options
            const options = {
                hostname: targetUrl.hostname,
                port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
                path: targetUrl.pathname + targetUrl.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...headers
                }
            };

            // Make the proxied request
            const proxyReq = protocol.request(options, (proxyRes) => {
                let responseBody = '';

                proxyRes.on('data', chunk => {
                    responseBody += chunk;
                });

                proxyRes.on('end', () => {
                    res.writeHead(proxyRes.statusCode, {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(responseBody);
                });
            });

            proxyReq.on('error', (error) => {
                console.error('Proxy request error:', error);
                res.writeHead(500);
                res.end(JSON.stringify({ error: error.message }));
            });

            proxyReq.write(requestBody);
            proxyReq.end();

        } catch (error) {
            console.error('Server error:', error);
            res.writeHead(500);
            res.end(JSON.stringify({ error: error.message }));
        }
    });
});

async function handleDownloadPlaylist(payload, res) {
    const { playlistText } = payload || {};

    if (!playlistText || typeof playlistText !== 'string') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing playlistText' }));
        return;
    }

    // Set up Server-Sent Events for progress streaming
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
    });

    const sendProgress = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
        const tempDir = await mkdtemp(path.join(tmpdir(), 'freyr-download-'));
        const playlistPath = path.join(tempDir, 'my-playlist.txt');
        const spotifyUrlsPath = path.join(tempDir, 'spotify-urls.txt');
        const downloadsDir = path.join(tempDir, 'downloads');

        // Create downloads directory
        await mkdir(downloadsDir, { recursive: true });

        // Write the song titles
        await writeFile(playlistPath, playlistText, 'utf8');

        const songLines = playlistText.trim().split('\n').filter(line => line.trim());
        let totalSongs = songLines.length;

        sendProgress({ stage: 'init', message: `Preparing to download ${totalSongs} songs...`, progress: 0 });

        // Check if we need to convert song titles to Spotify URLs
        const firstLine = playlistText.split('\n')[0] || '';
        const hasValidQuery = firstLine.match(/^(https?:\/\/|spotify:|apple_music:|deezer:)/);

        let finalPlaylistPath = playlistPath;

        if (!hasValidQuery) {
            sendProgress({ stage: 'convert', message: 'Converting song titles to Spotify URLs...', progress: 5 });
            const converterScript = path.join(REPO_ROOT, 'convert_to_spotify_urls.py');

            await new Promise((resolve, reject) => {
                const converter = spawn('python3', [converterScript], {
                    cwd: tempDir,
                    env: {
                        ...process.env,
                        FREYR_WEB_APP: '1',
                    },
                });

                converter.stdout.on('data', d => {
                    const log = d.toString();
                    console.log('[convert]', log);
                    sendProgress({ stage: 'convert', log: log.trim() });
                });
                converter.stderr.on('data', d => {
                    const log = d.toString();
                    console.error('[convert]', log);
                    sendProgress({ stage: 'convert', log: log.trim() });
                });

                converter.on('error', reject);
                converter.on('close', code => {
                    if (code === 0) resolve();
                    else reject(new Error(`Converter exited with code ${code}`));
                });
            });

            finalPlaylistPath = spotifyUrlsPath;

            // Recompute totalSongs based on actual Spotify URLs (excluding comments)
            try {
                const spotifyContent = await readFile(spotifyUrlsPath, 'utf8');
                const urlLines = spotifyContent
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line && !line.startsWith('#'));
                if (urlLines.length > 0) {
                    totalSongs = urlLines.length;
                }
            } catch (e) {
                console.error('Failed to read spotify-urls.txt:', e);
            }

            sendProgress({
                stage: 'convert',
                message: `URLs converted successfully for ${totalSongs} songs`,
                progress: 10,
            });
        }

        // Run Freyr CLI to download songs
        sendProgress({ stage: 'download', message: 'Starting downloads...', progress: 15 });
        const cliPath = path.join(REPO_ROOT, 'cli.js');

        let completedSongs = 0;
        await new Promise((resolve, reject) => {
            const child = spawn('node', [
                cliPath,
                '--no-logo',
                '--no-header',
                '--directory', downloadsDir,
                '-i', finalPlaylistPath,
            ], {
                cwd: REPO_ROOT,
            });

            child.stdout.on('data', d => {
                const log = d.toString();
                console.log('[freyr]', log);
                sendProgress({ stage: 'download', log: log.trim() });

                // Track completed songs based on per-track completion lines
                // Example: "  • [✓] 01 Slow Dance"
                log.split('\n').forEach(line => {
                    const trimmed = line.trim();
                    if (!trimmed) return;
                    if (trimmed.includes('• [✓]') && !trimmed.includes('Got ')) {
                        if (totalSongs > 0 && completedSongs < totalSongs) {
                            completedSongs++;
                            const downloadProgress = 15 + Math.floor((completedSongs / totalSongs) * 65);
                            const clamped = Math.min(downloadProgress, 80);
                            sendProgress({
                                stage: 'download',
                                message: `Downloaded ${completedSongs}/${totalSongs} songs`,
                                progress: clamped,
                            });
                        }
                    }
                });
            });

            child.stderr.on('data', d => {
                const log = d.toString();
                console.error('[freyr]', log);
                sendProgress({ stage: 'download', log: log.trim() });
            });

            child.on('error', reject);
            child.on('close', code => {
                if (code === 0) resolve();
                else reject(new Error(`freyr exited with code ${code}`));
            });
        });

        // Convert audio to MP3 and flatten into a single directory
        sendProgress({
            stage: 'convert-audio',
            message: 'Converting tracks to MP3 and organizing files...',
            progress: 85,
        });

        const flatDir = path.join(tempDir, 'songs');
        await mkdir(flatDir, { recursive: true });

        const audioFiles = await collectAudioFiles(downloadsDir, ['.m4a', '.mp3']);
        let processed = 0;
        const totalAudio = audioFiles.length;

        for (const srcPath of audioFiles) {
            const ext = path.extname(srcPath).toLowerCase();
            const baseName = path.basename(srcPath, ext);
            const destMp3Path = path.join(flatDir, `${baseName}.mp3`);

            if (ext === '.m4a') {
                await new Promise((resolve, reject) => {
                    const ff = spawn('ffmpeg', [
                        '-y',
                        '-i', srcPath,
                        '-codec:a', 'libmp3lame',
                        '-b:a', '320k',
                        destMp3Path,
                    ]);

                    ff.stdout.on('data', d => {
                        const log = d.toString();
                        console.log('[ffmpeg]', log);
                        sendProgress({ stage: 'convert-audio', log: log.trim() });
                    });
                    ff.stderr.on('data', d => {
                        const log = d.toString();
                        console.error('[ffmpeg]', log);
                        sendProgress({ stage: 'convert-audio', log: log.trim() });
                    });

                    ff.on('error', reject);
                    ff.on('close', code => {
                        if (code === 0) resolve();
                        else reject(new Error(`ffmpeg exited with code ${code}`));
                    });
                });
            } else {
                await copyFile(srcPath, destMp3Path);
            }

            processed++;
            if (totalAudio > 0) {
                const convProgress = 85 + Math.floor((processed / totalAudio) * 5);
                const clampedConv = Math.min(convProgress, 90);
                sendProgress({
                    stage: 'convert-audio',
                    message: `Prepared ${processed}/${totalAudio} tracks`,
                    progress: clampedConv,
                });
            }
        }

        sendProgress({ stage: 'zip', message: 'Zipping downloads...', progress: 90 });

        // Zip the flattened songs directory with no compression (-0)
        const zipPath = path.join(tempDir, 'playlist.zip');
        await new Promise((resolve, reject) => {
            const zip = spawn('zip', ['-r0', zipPath, '.'], {
                cwd: flatDir,
            });

            zip.stdout.on('data', d => {
                const log = d.toString();
                console.log('[zip]', log);
                sendProgress({ stage: 'zip', log: log.trim() });
            });
            zip.stderr.on('data', d => {
                const log = d.toString();
                console.error('[zip]', log);
                sendProgress({ stage: 'zip', log: log.trim() });
            });

            zip.on('error', reject);
            zip.on('close', code => {
                if (code === 0) resolve();
                else reject(new Error(`zip exited with code ${code}`));
            });
        });

        const zipData = await readFile(zipPath);

        sendProgress({ stage: 'complete', message: 'Download complete!', progress: 100, zipSize: zipData.length });

        // Send the zip file as base64 in the final event
        res.write(`data: ${JSON.stringify({ 
            stage: 'download-ready', 
            zipData: zipData.toString('base64'),
            filename: 'playlist.zip'
        })}\n\n`);
        res.end();

        // Clean up temporary directory (best-effort)
        rm(tempDir, { recursive: true, force: true }).catch(err => {
            console.error('Failed to clean up temp dir:', err);
        });
    } catch (error) {
        console.error('Download error:', error);
        sendProgress({ stage: 'error', message: error.message || 'Download failed' });
        res.end();
    }
}

server.listen(PORT, () => {
    console.log(`✓ CORS Proxy server running on http://localhost:${PORT}`);
    console.log(`  Use this server to bypass CORS restrictions`);
    console.log(`  Press Ctrl+C to stop`);
});
