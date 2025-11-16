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
import { mkdtemp, writeFile, readFile, rm } from 'fs/promises';

const PORT = 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

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

    try {
        const tempDir = await mkdtemp(path.join(tmpdir(), 'freyr-download-'));
        const playlistPath = path.join(tempDir, 'playlist.txt');
        const downloadsDir = path.join(tempDir, 'downloads');

        await writeFile(playlistPath, playlistText, 'utf8');

        // Run Freyr CLI to download songs
        const cliPath = path.join(REPO_ROOT, 'cli.js');
        await new Promise((resolve, reject) => {
            const child = spawn('node', [
                cliPath,
                '--no-logo',
                '--no-header',
                '--no-bar',
                '--directory', downloadsDir,
                '-i', playlistPath,
            ], {
                cwd: REPO_ROOT,
            });

            child.stdout.on('data', d => console.log('[freyr]', d.toString()));
            child.stderr.on('data', d => console.error('[freyr]', d.toString()));

            child.on('error', reject);
            child.on('close', code => {
                if (code === 0) resolve();
                else reject(new Error(`freyr exited with code ${code}`));
            });
        });

        // Zip the downloads directory with no compression (-0)
        const zipPath = path.join(tempDir, 'playlist.zip');
        await new Promise((resolve, reject) => {
            const zip = spawn('zip', ['-r0', zipPath, path.basename(downloadsDir)], {
                cwd: tempDir,
            });

            zip.stdout.on('data', d => console.log('[zip]', d.toString()));
            zip.stderr.on('data', d => console.error('[zip]', d.toString()));

            zip.on('error', reject);
            zip.on('close', code => {
                if (code === 0) resolve();
                else reject(new Error(`zip exited with code ${code}`));
            });
        });

        const zipData = await readFile(zipPath);

        res.writeHead(200, {
            'Content-Type': 'application/zip',
            'Content-Disposition': 'attachment; filename="playlist.zip"',
            'Content-Length': zipData.length,
            'Access-Control-Allow-Origin': '*',
        });
        res.end(zipData);

        // Clean up temporary directory (best-effort)
        rm(tempDir, { recursive: true, force: true }).catch(err => {
            console.error('Failed to clean up temp dir:', err);
        });
    } catch (error) {
        console.error('Download error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: error.message || 'Download failed' }));
    }
}

server.listen(PORT, () => {
    console.log(`✓ CORS Proxy server running on http://localhost:${PORT}`);
    console.log(`  Use this server to bypass CORS restrictions`);
    console.log(`  Press Ctrl+C to stop`);
});
