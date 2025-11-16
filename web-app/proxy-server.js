#!/usr/bin/env node
/**
 * Simple CORS Proxy Server for AI Vision APIs
 * Run with: node proxy-server.js
 */

import http from 'http';
import https from 'https';
import { URL } from 'url';

const PORT = 3000;

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
            const { endpoint, headers, body: requestBody } = JSON.parse(body);

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

server.listen(PORT, () => {
    console.log(`✓ CORS Proxy server running on http://localhost:${PORT}`);
    console.log(`  Use this server to bypass CORS restrictions`);
    console.log(`  Press Ctrl+C to stop`);
});
