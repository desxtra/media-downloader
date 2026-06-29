import { createServer } from 'http';
import { readFileSync, readdirSync, statSync, mkdirSync, unlinkSync, existsSync, rmdirSync } from 'fs';
import { spawn } from 'child_process';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

// Use yt-dlp from virtual environment
const YT_DLP_PATH = join(__dirname, '.venv', 'bin', 'yt-dlp');

// Read frontend files once at startup
let indexHtml, scriptJs;
try {
    indexHtml = readFileSync(join(__dirname, 'public', 'index.html'), 'utf8');
    scriptJs = readFileSync(join(__dirname, 'public', 'script.js'), 'utf8');
    console.log('Loaded frontend files');
} catch (error) {
    console.error('Failed to load frontend files:', error.message);
    process.exit(1);
}

// User session management
const userSessions = new Map(); // sessionId -> { lastActivity: timestamp, files: [] }
const fileExpirations = new Map(); // filePath -> { sessionId, expirationTime }

// Generate unique session ID
function generateSessionId() {
    return randomBytes(8).toString('hex'); // 16 character session ID
}

// Parse cookies from request
function parseCookies(cookieHeader) {
    const cookies = {};
    if (cookieHeader) {
        cookieHeader.split(';').forEach(cookie => {
            const [name, value] = cookie.trim().split('=');
            if (name && value) {
                cookies[name] = value;
            }
        });
    }
    return cookies;
}

// Set session cookie - FIXED: Remove HttpOnly to allow JavaScript access
function setSessionCookie(res, sessionId) {
    const expires = new Date(Date.now() + 30 * 60 * 1000).toUTCString(); // 30 minutes
    res.setHeader('Set-Cookie', `sessionId=${sessionId}; Path=/; Expires=${expires}; SameSite=Lax`);
}

// Clean up empty user directories
function cleanupEmptyUserDirectory(sessionId) {
    const userDir = join(__dirname, 'downloads', sessionId);
    
    try {
        if (existsSync(userDir)) {
            const files = readdirSync(userDir);
            if (files.length === 0) {
                // Directory is empty, remove it
                rmdirSync(userDir);
                console.log(`Cleaned up empty user directory: ${userDir}`);
                return true;
            }
        }
    } catch (error) {
        console.log(`Could not clean up user directory ${userDir}:`, error.message);
    }
    return false;
}

// Clean up expired sessions and files
function cleanupExpiredSessions() {
    const now = Date.now();
    const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes session timeout
    
    for (const [sessionId, session] of userSessions.entries()) {
        if (now - session.lastActivity > SESSION_TIMEOUT) {
            // Clean up user's files
            if (session.files) {
                session.files.forEach(filePath => {
                    try {
                        if (existsSync(filePath)) {
                            unlinkSync(filePath);
                            console.log(`Cleaned up expired session file: ${filePath}`);
                        }
                        fileExpirations.delete(filePath);
                    } catch (error) {
                        console.log(`Could not clean up file ${filePath}:`, error.message);
                    }
                });
            }
            
            // Clean up user directory if empty
            cleanupEmptyUserDirectory(sessionId);
            
            userSessions.delete(sessionId);
            console.log(`Cleaned up expired session: ${sessionId}`);
        }
    }
}

// Run cleanup every minute
setInterval(cleanupExpiredSessions, 60 * 1000);

// Create downloads directory if it doesn't exist
function ensureDownloadDir() {
    const downloadDir = join(__dirname, 'downloads');
    try {
        mkdirSync(downloadDir, { recursive: true });
    } catch (error) {
        console.log(`Download directory already exists: ${downloadDir}`);
    }
}

// Call this on startup
ensureDownloadDir();

// Function to schedule file deletion
function scheduleFileDeletion(filePath, sessionId, delay = 3 * 60 * 1000) { // 3 minutes default
    const expirationTime = Date.now() + delay;
    
    fileExpirations.set(filePath, { sessionId, expirationTime });
    
    // Update user session
    if (userSessions.has(sessionId)) {
        const session = userSessions.get(sessionId);
        session.lastActivity = Date.now();
        if (!session.files.includes(filePath)) {
            session.files.push(filePath);
        }
    }
    
    setTimeout(() => {
        try {
            if (existsSync(filePath)) {
                unlinkSync(filePath);
                fileExpirations.delete(filePath);
                
                // Remove from user session
                if (userSessions.has(sessionId)) {
                    const session = userSessions.get(sessionId);
                    session.files = session.files.filter(f => f !== filePath);
                }
                
                console.log(`Auto-deleted expired file: ${filePath}`);
                
                // Check if user directory is now empty and clean it up
                cleanupEmptyUserDirectory(sessionId);
            }
        } catch (error) {
            console.log(`Could not delete expired file ${filePath}:`, error.message);
        }
    }, delay);
}

function downloadMedia(url, service, format = null, sessionId) {
    return new Promise((resolve, reject) => {
        let args = [];
        const userDir = join(__dirname, 'downloads', sessionId);
        
        // Ensure user directory exists
        try {
            mkdirSync(userDir, { recursive: true });
        } catch (error) {
            console.log(`User directory already exists: ${userDir}`);
        }
        
        // Configure based on service and format
        switch (service) {
            case 'youtube':
                if (format === 'mp3') {
                    args = [
                        '-x', 
                        '--audio-format', 'mp3',
                        '--audio-quality', '0',
                        '--format', 'bestaudio/best',
                        '--restrict-filenames',
                        '--no-overwrites',
                        '-o', `${userDir}/%(title)s.%(ext)s`,
                        url
                    ];
                } else {
                    args = [
                        '--format', 'best[height<=1080]',
                        '--restrict-filenames',
                        '--no-overwrites',
                        '-o', `${userDir}/%(title)s.%(ext)s`,
                        url
                    ];
                }
                break;
                
            case 'facebook':
                args = [
                    '--format', 'best',
                    '--restrict-filenames',
                    '--no-overwrites',
                    '-o', `${userDir}/%(title)s.%(ext)s`,
                    url
                ];
                break;
                
            case 'instagram':
                args = [
                    '--format', 'best',
                    '--restrict-filenames',
                    '--no-overwrites',
                    '-o', `${userDir}/%(title)s.%(ext)s`,
                    url
                ];
                break;
                
            case 'tiktok':
                args = [
                    '--format', 'best',
                    '--restrict-filenames',
                    '--no-overwrites',
                    '-o', `${userDir}/%(title)s.%(ext)s`,
                    url
                ];
                break;
                
            case 'terabox':
                args = [
                    '--format', 'best',
                    '--restrict-filenames',
                    '--no-overwrites',
                    '-o', `${userDir}/%(title)s.%(ext)s`,
                    url
                ];
                break;
                
            default:
                reject(new Error('Invalid service'));
                return;
        }
        
        console.log(`Running: ${YT_DLP_PATH} ${args.join(' ')}`);
        
        const process = spawn(YT_DLP_PATH, args);
        
        let output = '';
        let errorOutput = '';
        let finalFilename = '';
        
        process.stdout.on('data', (data) => {
            const dataStr = data.toString();
            output += dataStr;
            console.log(`[yt-dlp] ${dataStr.trim()}`);
            
            // Extract filename from various yt-dlp output patterns
            const patterns = [
                new RegExp(`\\[download\\] Destination: .*?${sessionId}/(.*)`),
                new RegExp(`\\[ExtractAudio\\] Destination: .*?${sessionId}/(.*)`),
                new RegExp(`\\[Merger\\] Merging formats into ".*?${sessionId}/(.*)"`)
            ];
            
            for (const pattern of patterns) {
                const match = dataStr.match(pattern);
                if (match) {
                    finalFilename = match[1];
                    break;
                }
            }
        });
        
        process.stderr.on('data', (data) => {
            errorOutput += data.toString();
            console.error(`[yt-dlp ERROR] ${data.toString().trim()}`);
        });
        
        process.on('close', (code) => {
            if (code === 0) {
                // Schedule auto-deletion for the downloaded file
                if (finalFilename) {
                    const filePath = join(userDir, finalFilename);
                    scheduleFileDeletion(filePath, sessionId, 3 * 60 * 1000); // 3 minutes
                }
                
                resolve({ 
                    success: true, 
                    message: `Download completed: ${finalFilename || 'Unknown file'}`,
                    filename: finalFilename || 'unknown'
                });
            } else {
                reject(new Error(`Download failed: ${errorOutput || 'Unknown error'}`));
            }
        });
        
        process.on('error', (error) => {
            reject(new Error(`Failed to start download process: ${error.message}`));
        });
    });
}

function getDownloadedFiles(sessionId) {
    try {
        const userDir = join(__dirname, 'downloads', sessionId);
        let allFiles = [];
        
        if (!existsSync(userDir)) {
            return [];
        }
        
        const files = readdirSync(userDir);
        files.forEach(file => {
            const filePath = join(userDir, file);
            const stats = statSync(filePath);
            const expirationData = fileExpirations.get(filePath);
            
            let expiresIn = null;
            if (expirationData && expirationData.expirationTime) {
                const timeLeft = expirationData.expirationTime - Date.now();
                if (timeLeft > 0) {
                    const minutes = Math.floor(timeLeft / (60 * 1000));
                    const seconds = Math.floor((timeLeft % (60 * 1000)) / 1000);
                    expiresIn = `${minutes}m ${seconds}s`;
                }
            }
            
            // Determine service from filename or default to 'file'
            let service = 'file';
            if (file.includes('youtube') || file.match(/\.(mp3|mp4|webm)$/)) service = 'youtube';
            else if (file.includes('facebook')) service = 'facebook';
            else if (file.includes('instagram')) service = 'instagram';
            else if (file.includes('tiktok')) service = 'tiktok';
            else if (file.includes('terabox')) service = 'terabox';
            
            allFiles.push({
                name: file,
                service: service,
                size: (stats.size / (1024 * 1024)).toFixed(2) + ' MB',
                date: stats.mtime.toLocaleString(),
                expires: expiresIn,
                url: `/downloads/${sessionId}/${file}`
            });
        });
        
        // Sort by date, newest first
        return allFiles.sort((a, b) => new Date(b.date) - new Date(a.date));
    } catch (error) {
        console.error('Error reading user downloads directory:', error);
        return [];
    }
}

function serveFile(filePath, res) {
    try {
        const content = readFileSync(filePath);
        const ext = filePath.split('.').pop().toLowerCase();
        const mimeTypes = {
            'mp3': 'audio/mpeg',
            'mp4': 'video/mp4',
            'webm': 'video/webm',
            'm4a': 'audio/mp4',
            'webp': 'image/webp',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png'
        };
        
        res.writeHead(200, {
            'Content-Type': mimeTypes[ext] || 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${basename(filePath)}"`
        });
        res.end(content);
    } catch (error) {
        res.writeHead(404).end('File not found');
    }
}

// Get or create session ID from request
function getSessionId(req) {
    const cookies = parseCookies(req.headers.cookie);
    let sessionId = cookies.sessionId;
    
    if (!sessionId || !userSessions.has(sessionId)) {
        sessionId = generateSessionId();
        userSessions.set(sessionId, {
            lastActivity: Date.now(),
            files: []
        });
        console.log(`Created new session: ${sessionId}`);
    } else {
        // Update last activity for existing session
        const session = userSessions.get(sessionId);
        session.lastActivity = Date.now();
    }
    
    return sessionId;
}

const server = createServer(async (req, res) => {
    console.log(`${req.method} ${req.url}`);
    
    // Get or create session ID
    const sessionId = getSessionId(req);
    
    // Set session cookie for all responses - FIXED: Now accessible to JavaScript
    setSessionCookie(res, sessionId);
    
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200).end();
        return;
    }
    
    // Serve frontend files
    if (req.method === 'GET' && req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' }).end(indexHtml);
        return;
    }
    
    if (req.method === 'GET' && req.url === '/script.js') {
        res.writeHead(200, { 'Content-Type': 'text/javascript' }).end(scriptJs);
        return;
    }
    
    // Serve downloaded files
    if (req.method === 'GET' && req.url.startsWith('/downloads/')) {
        const pathParts = req.url.split('/downloads/')[1].split('/');
        if (pathParts.length === 2) {
            const [fileSessionId, filename] = pathParts;
            
            // Verify session ownership
            if (fileSessionId !== sessionId) {
                res.writeHead(403).end('Access denied');
                return;
            }
            
            const filePath = join(__dirname, 'downloads', fileSessionId, filename);
            if (!existsSync(filePath)) {
                res.writeHead(404).end('File not found');
                return;
            }
            serveFile(filePath, res);
            return;
        }
    }
    
    // Get list of downloaded files for current session
    if (req.method === 'GET' && req.url === '/files') {
        const files = getDownloadedFiles(sessionId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ files, sessionId }));
        return;
    }
    
    // Handle YouTube download requests with format
    if (req.method === 'POST' && req.url === '/download/youtube') {
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', async () => {
            try {
                const { url, format } = JSON.parse(body);
                
                if (!url) {
                    throw new Error('Missing URL');
                }
                
                console.log(`YouTube download request from ${sessionId}: ${format} - ${url}`);
                
                const result = await downloadMedia(url, 'youtube', format, sessionId);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (error) {
                console.error('YouTube download error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }
    
    // Handle other download requests
    if (req.method === 'POST' && req.url === '/download') {
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', async () => {
            try {
                const { url, service } = JSON.parse(body);
                
                if (!url || !service) {
                    throw new Error('Missing URL or service');
                }
                
                console.log(`Download request from ${sessionId}: ${service} - ${url}`);
                
                const result = await downloadMedia(url, service, null, sessionId);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (error) {
                console.error('Download error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }
    
    // Delete file - only allowed for user's own files
    if (req.method === 'DELETE' && req.url.startsWith('/files/')) {
        const filename = req.url.split('/files/')[1];
        
        try {
            const filePath = join(__dirname, 'downloads', sessionId, filename);
            
            // Verify file exists and belongs to user
            if (!existsSync(filePath)) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'File not found' }));
                return;
            }
            
            const fs = await import('fs/promises');
            await fs.unlink(filePath);
            
            // Remove from expiration tracking and user session
            fileExpirations.delete(filePath);
            if (userSessions.has(sessionId)) {
                const session = userSessions.get(sessionId);
                session.files = session.files.filter(f => f !== filePath);
            }
            
            // Check if user directory is now empty and clean it up
            cleanupEmptyUserDirectory(sessionId);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'File deleted' }));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: error.message }));
        }
        return;
    }
    
    // 404 for other routes
    res.writeHead(404).end('Not found');
});

server.listen(PORT,'0.0.0.0', () => {
    console.log(`Media Downloader running at http://localhost:${PORT}`);
    console.log(`Downloads organized in user sessions: ${join(__dirname, 'downloads')}/<session-id>/`);
    console.log(`Using yt-dlp from: ${YT_DLP_PATH}`);
    console.log(`Files auto-delete after 3 minutes`);
    console.log(`User sessions expire after 30 minutes of inactivity`);
    console.log(`Empty user directories are automatically cleaned up`);
});

server.on('error', (error) => {
    console.error('Failed to start server:', error);
});