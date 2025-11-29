// Platform selection functionality
function showService(platform) {
    // Hide all service cards
    document.querySelectorAll('.service-card').forEach(card => {
        card.classList.remove('active');
    });
    
    // Show selected service card
    if (platform) {
        const selectedCard = document.getElementById(`${platform}-card`);
        if (selectedCard) {
            selectedCard.classList.add('active');
        }
    }
}

// Get session ID from cookies - improved version
function getSessionId() {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'sessionId' && value) {
            return value;
        }
    }
    return null;
}

// Set session ID in a way that's accessible to JavaScript
function setSessionId(sessionId) {
    // Set cookie that's accessible to JavaScript (without HttpOnly)
    const expires = new Date(Date.now() + 30 * 60 * 1000).toUTCString(); // 30 minutes
    document.cookie = `sessionId=${sessionId}; path=/; expires=${expires}; SameSite=Lax`;
}

// Initialize session on page load
function initializeSession() {
    let sessionId = getSessionId();
    if (!sessionId) {
        // If no session ID exists, we'll get one from the server on first API call
        console.log('No session ID found, will get one from server');
    } else {
        console.log('Found existing session ID:', sessionId);
    }
}

// YouTube download with format selection
async function downloadYouTube() {
    const input = document.getElementById('youtube-url');
    const button = document.getElementById('youtube-btn');
    const status = document.getElementById('youtube-status');
    const formatSelect = document.getElementById('youtube-format');
    
    const url = input.value.trim();
    const format = formatSelect.value;
    
    if (!url) {
        showStatus(status, 'Please enter a URL', 'error');
        return;
    }
    
    // Basic URL validation
    if (!isValidURL('youtube', url)) {
        showStatus(status, 'Please enter a valid YouTube URL', 'error');
        return;
    }
    
    // Update UI
    const originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Downloading ${format.toUpperCase()}...`;
    showStatus(status, `Starting ${format.toUpperCase()} download...`, 'info');
    
    try {
        const response = await fetch('/download/youtube', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url, format })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showStatus(status, result.message, 'success');
            input.value = ''; // Clear input on success
            // Refresh files list after download
            loadFiles();
        } else {
            showStatus(status, `Error: ${result.error}`, 'error');
        }
    } catch (error) {
        showStatus(status, `Network error: ${error.message}`, 'error');
    } finally {
        button.disabled = false;
        button.innerHTML = originalText;
    }
}

// Generic download for other platforms
async function download(service) {
    const input = document.getElementById(`${service}-url`);
    const button = document.getElementById(`${service}-btn`);
    const status = document.getElementById(`${service}-status`);
    
    const url = input.value.trim();
    
    if (!url) {
        showStatus(status, 'Please enter a URL', 'error');
        return;
    }
    
    // Basic URL validation
    if (!isValidURL(service, url)) {
        showStatus(status, `Please enter a valid ${service} URL`, 'error');
        return;
    }
    
    // Update UI
    const originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Downloading...';
    showStatus(status, 'Starting download...', 'info');
    
    try {
        const response = await fetch('/download', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url, service })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showStatus(status, result.message, 'success');
            input.value = ''; // Clear input on success
            // Refresh files list after download
            loadFiles();
        } else {
            showStatus(status, `Error: ${result.error}`, 'error');
        }
    } catch (error) {
        showStatus(status, `Network error: ${error.message}`, 'error');
    } finally {
        button.disabled = false;
        button.innerHTML = originalText;
    }
}

function isValidURL(service, url) {
    const patterns = {
        youtube: /youtube\.com|youtu\.be/,
        facebook: /facebook\.com/,
        instagram: /instagram\.com/,
        tiktok: /tiktok\.com/,
        terabox: /terabox\.com|1024tera\.com/
    };
    
    return patterns[service].test(url);
}

function showStatus(element, message, type) {
    element.textContent = message;
    element.className = `status ${type}`;
}

async function loadFiles() {
    const filesList = document.getElementById('files-list');
    const refreshBtn = document.getElementById('refresh-files');
    
    if (!filesList) return;
    
    filesList.innerHTML = '<div class="loading">Loading files...</div>';
    
    if (refreshBtn) {
        const originalHtml = refreshBtn.innerHTML;
        refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        refreshBtn.disabled = true;
    }
    
    try {
        const response = await fetch('/files');
        const data = await response.json();
        
        // Store the session ID from the response for debugging
        if (data.sessionId) {
            console.log('Server session ID:', data.sessionId);
            // Also set it in a JavaScript-accessible cookie
            setSessionId(data.sessionId);
        }
        
        if (data.files.length === 0) {
            filesList.innerHTML = '<div class="no-files">No files downloaded yet. Files will appear here after download and auto-delete after 3 minutes.</div>';
            return;
        }
        
        filesList.innerHTML = data.files.map(file => `
            <div class="file-item" data-service="${file.service}">
                <div class="file-info">
                    <div class="file-service-badge service-${file.service}">
                        <i class="${getServiceIcon(file.service)}"></i>
                        ${getServiceDisplayName(file.service)}
                    </div>
                    <div class="file-name">${file.name}</div>
                    <div class="file-details">
                        <span>${file.size}</span>
                        <span>•</span>
                        <span>${file.date}</span>
                        ${file.expires ? `<div class="file-expiry">Expires in: ${file.expires}</div>` : ''}
                    </div>
                </div>
                <div class="file-actions">
                    <button class="action-btn download-file-btn" onclick="downloadFile('${file.name}')">
                        <i class="fas fa-download"></i>
                        Download
                    </button>
                    <button class="action-btn delete-btn" onclick="deleteFile('${file.name}')">
                        <i class="fas fa-trash"></i>
                        Delete
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        filesList.innerHTML = `<div class="error">Error loading files: ${error.message}</div>`;
    } finally {
        if (refreshBtn) {
            refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
            refreshBtn.disabled = false;
        }
    }
}

function getServiceIcon(service) {
    const icons = {
        youtube: 'fab fa-youtube',
        facebook: 'fab fa-facebook',
        instagram: 'fab fa-instagram',
        tiktok: 'fab fa-tiktok',
        terabox: 'fas fa-cloud'
    };
    return icons[service] || 'fas fa-file';
}

function getServiceDisplayName(service) {
    const names = {
        youtube: 'YOUTUBE',
        facebook: 'FACEBOOK',
        instagram: 'INSTAGRAM',
        tiktok: 'TIKTOK',
        terabox: 'TERABOX'
    };
    return names[service] || service.toUpperCase();
}

function downloadFile(filename) {
    const sessionId = getSessionId();
    console.log('Download file - Session ID:', sessionId, 'Filename:', filename);
    
    if (!sessionId) {
        alert('Session error. Please refresh the page and try again.');
        return;
    }
    
    // Open in new tab for download
    const downloadUrl = `/downloads/${sessionId}/${filename}`;
    console.log('Opening download URL:', downloadUrl);
    window.open(downloadUrl, '_blank');
}

async function deleteFile(filename) {
    if (!confirm(`Are you sure you want to delete "${filename}"?`)) {
        return;
    }
    
    const sessionId = getSessionId();
    console.log('Delete file - Session ID:', sessionId, 'Filename:', filename);
    
    if (!sessionId) {
        alert('Session error. Please refresh the page and try again.');
        return;
    }
    
    try {
        const response = await fetch(`/files/${filename}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            loadFiles(); // Refresh the list
        } else {
            alert(`Error deleting file: ${result.error}`);
        }
    } catch (error) {
        alert(`Error deleting file: ${error.message}`);
    }
}

function filterFiles(service) {
    const fileItems = document.querySelectorAll('.file-item');
    fileItems.forEach(item => {
        if (service === 'all' || item.dataset.service === service) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// Enhanced cookie debug function
function debugCookies() {
    console.log('Current cookies:', document.cookie);
    console.log('Session ID from cookies:', getSessionId());
}

// Allow Enter key to trigger download
document.addEventListener('DOMContentLoaded', function() {
    console.log('Page loaded, initializing session...');
    
    // Initialize session
    initializeSession();
    
    // Debug cookies
    debugCookies();
    
    const inputs = ['youtube-url', 'facebook-url', 'instagram-url', 'tiktok-url', 'terabox-url'];
    
    inputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    const service = id.split('-')[0];
                    if (service === 'youtube') {
                        downloadYouTube();
                    } else {
                        download(service);
                    }
                }
            });
        }
    });
    
    // Load files on page load
    loadFiles();
    
    // Auto-refresh files every 30 seconds to update expiration timers
    setInterval(loadFiles, 30000);
});