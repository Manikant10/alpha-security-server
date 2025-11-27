// Global app state
let currentUser = null;
let authToken = null;
let map = null;
let socket = null;
let currentDevice = null;

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Check for stored auth token
    const storedToken = localStorage.getItem('auth_token');
    if (storedToken) {
        authToken = storedToken;
        validateTokenAndShowDashboard();
    } else {
        showLoginSection();
    }

    // Setup event listeners
    setupEventListeners();
}

function setupEventListeners() {
    // Auth form listeners
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('register-form').addEventListener('submit', handleRegister);
    
    // Dashboard listeners
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    document.getElementById('refresh-devices').addEventListener('click', loadDevices);
    document.getElementById('refresh-map').addEventListener('click', loadMapData);
    document.getElementById('refresh-api-key').addEventListener('click', refreshApiKey);
    document.getElementById('copy-api-key').addEventListener('click', copyApiKey);
    
    // Modal listeners
    document.querySelector('.modal-close').addEventListener('click', closeModal);
    document.getElementById('device-modal').addEventListener('click', function(e) {
        if (e.target === this) closeModal();
    });
    
    // Device action listeners
    document.getElementById('lock-device').addEventListener('click', () => sendCommand('lock'));
    document.getElementById('unlock-device').addEventListener('click', () => sendCommand('unlock'));
    document.getElementById('locate-device').addEventListener('click', () => sendCommand('locate'));
    document.getElementById('start-alarm').addEventListener('click', () => sendCommand('start-alarm'));
    document.getElementById('stop-alarm').addEventListener('click', () => sendCommand('stop-alarm'));
    document.getElementById('wipe-device').addEventListener('click', () => sendCommand('wipe'));
}

// Authentication Functions
async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    // Add loading state
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="loading"></span> Authenticating...';
    submitBtn.disabled = true;
    
    try {
        const response = await fetch('/dashboard/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('auth_token', authToken);
            
            // Success animation
            submitBtn.innerHTML = '✅ Welcome!';
            submitBtn.style.background = 'linear-gradient(135deg, var(--success), #32CD32)';
            
            setTimeout(() => {
                showDashboard();
                showToast(`Welcome back, ${data.user.username}! 🎉`, 'success');
            }, 800);
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        // Error animation
        submitBtn.innerHTML = '❌ Login Failed';
        submitBtn.style.background = 'linear-gradient(135deg, var(--danger), #FF6B6B)';
        showAuthError(error.message || 'Login failed. Please try again.');
        
        // Reset button after delay
        setTimeout(() => {
            submitBtn.innerHTML = originalText;
            submitBtn.style.background = '';
            submitBtn.disabled = false;
        }, 2000);
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const username = document.getElementById('register-username').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    // Add loading state
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="loading"></span> Creating Account...';
    submitBtn.disabled = true;
    
    try {
        const response = await fetch('/dashboard/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('auth_token', authToken);
            
            // Success animation
            submitBtn.innerHTML = '🎉 Account Created!';
            submitBtn.style.background = 'linear-gradient(135deg, var(--success), #32CD32)';
            
            setTimeout(() => {
                showDashboard();
                showToast(`Welcome to Alpha Security, ${data.user.username}! 🚀`, 'success');
            }, 800);
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        // Error animation
        submitBtn.innerHTML = '❌ Registration Failed';
        submitBtn.style.background = 'linear-gradient(135deg, var(--danger), #FF6B6B)';
        showAuthError(error.message || 'Registration failed. Please try again.');
        
        // Reset button after delay
        setTimeout(() => {
            submitBtn.innerHTML = originalText;
            submitBtn.style.background = '';
            submitBtn.disabled = false;
        }, 2000);
    }
}

function handleLogout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('auth_token');
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    showLoginSection();
    showToast('Logged out successfully', 'success');
}

async function validateTokenAndShowDashboard() {
    try {
        const response = await fetch('/dashboard/user/profile', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            showDashboard();
        } else {
            localStorage.removeItem('auth_token');
            showLoginSection();
        }
    } catch (error) {
        localStorage.removeItem('auth_token');
        showLoginSection();
    }
}

// UI Functions
function showTab(tabName) {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const tabBtns = document.querySelectorAll('.tab-btn');
    
    // Reset active tabs
    tabBtns.forEach(btn => btn.classList.remove('active'));
    
    if (tabName === 'login') {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
        document.querySelector('.tab-btn').classList.add('active');
    } else {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
        document.querySelectorAll('.tab-btn')[1].classList.add('active');
    }
    
    // Clear error message
    document.getElementById('auth-error').style.display = 'none';
}

function showLoginSection() {
    document.getElementById('login-section').style.display = 'block';
    document.getElementById('dashboard-section').style.display = 'none';
}

function showDashboard() {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('dashboard-section').style.display = 'block';
    
    // Update user info
    document.getElementById('username-display').textContent = currentUser.username;
    document.getElementById('api-key-display').value = currentUser.apiKey;
    
    // Load dashboard data
    loadDevices();
    initializeMap();
    setupWebSocket();
}

function showAuthError(message) {
    const errorEl = document.getElementById('auth-error');
    errorEl.textContent = message;
    errorEl.style.display = 'block';
}

// Dashboard Functions
async function loadDevices() {
    try {
        const response = await fetch('/dashboard/devices', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            displayDevices(data.devices);
            updateSummaryCards(data.summary);
            loadMapData(); // Update map when devices are loaded
        } else {
            showToast('Failed to load devices', 'error');
        }
    } catch (error) {
        showToast('Failed to load devices', 'error');
    }
}

function displayDevices(devices) {
    const container = document.getElementById('devices-list');
    
    if (devices.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted">
                <p>No devices registered yet.</p>
                <p>Install the Alpha Security app on your Android device and register it using your API key.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = devices.map(device => `
        <div class="device-item" onclick="showDeviceModal('${device.id}')">
            <div class="device-header">
                <div class="device-name">${device.name}</div>
                <div class="device-status ${device.isOnline ? 'online' : 'offline'}">
                    ${device.isOnline ? 'Online' : 'Offline'}
                </div>
            </div>
            <div class="device-info">
                <div class="device-info-item">
                    <span>Model:</span>
                    <span>${device.model || 'Unknown'}</span>
                </div>
                <div class="device-info-item">
                    <span>Battery:</span>
                    <span>${device.batteryLevel ? device.batteryLevel + '%' : 'Unknown'}</span>
                </div>
                <div class="device-info-item">
                    <span>Last Seen:</span>
                    <span>${formatDateTime(device.lastSeen)}</span>
                </div>
                <div class="device-info-item">
                    <span>Location:</span>
                    <span>${device.location ? '📍 Available' : '❌ No location'}</span>
                </div>
            </div>
            <div class="device-badges">
                ${device.isLocked ? '<span class="badge locked">🔒 Locked</span>' : ''}
                ${device.alarmActive ? '<span class="badge alarm">🚨 Alarm Active</span>' : ''}
            </div>
        </div>
    `).join('');
}

function updateSummaryCards(summary) {
    document.getElementById('total-devices').textContent = summary.total;
    document.getElementById('online-devices').textContent = summary.online;
    document.getElementById('locked-devices').textContent = summary.locked;
    document.getElementById('alert-devices').textContent = summary.alarming;
}

// Map Functions
function initializeMap() {
    if (map) {
        map.remove();
    }
    
    map = L.map('map').setView([40.7128, -74.0060], 2); // Default to NYC
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    loadMapData();
}

async function loadMapData() {
    if (!map) return;
    
    try {
        const response = await fetch('/dashboard/map-data', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            displayDevicesOnMap(data.devices);
        }
    } catch (error) {
        console.error('Failed to load map data:', error);
    }
}

function displayDevicesOnMap(devices) {
    // Clear existing markers
    map.eachLayer(layer => {
        if (layer instanceof L.Marker) {
            map.removeLayer(layer);
        }
    });
    
    if (devices.length === 0) return;
    
    const bounds = [];
    
    devices.forEach(device => {
        const { location } = device;
        const lat = location.latitude;
        const lng = location.longitude;
        
        bounds.push([lat, lng]);
        
        // Create custom icon based on device status
        const iconColor = device.isOnline ? 'green' : 'red';
        const iconHtml = device.alarmActive ? '🚨' : (device.isLocked ? '🔒' : '📱');
        
        const customIcon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="background: ${iconColor}; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-size: 16px;">${iconHtml}</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
        
        const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
        
        const popupContent = `
            <div>
                <h4>${device.name}</h4>
                <p><strong>Model:</strong> ${device.model}</p>
                <p><strong>Status:</strong> ${device.isOnline ? 'Online' : 'Offline'}</p>
                <p><strong>Battery:</strong> ${device.batteryLevel || 'Unknown'}%</p>
                <p><strong>Accuracy:</strong> ${location.accuracy}m</p>
                <p><strong>Updated:</strong> ${formatDateTime(location.timestamp)}</p>
                ${location.address ? `<p><strong>Address:</strong> ${location.address}</p>` : ''}
                <button onclick="showDeviceModal('${device.deviceId}')" class="btn btn-primary" style="margin-top: 10px;">View Details</button>
            </div>
        `;
        
        marker.bindPopup(popupContent);
    });
    
    // Fit map to show all devices
    if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [20, 20] });
    }
}

// Device Modal Functions
async function showDeviceModal(deviceId) {
    currentDevice = deviceId;
    
    try {
        const response = await fetch(`/dashboard/devices/${deviceId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            displayDeviceDetails(data);
            document.getElementById('device-modal').style.display = 'block';
        } else {
            showToast('Failed to load device details', 'error');
        }
    } catch (error) {
        showToast('Failed to load device details', 'error');
    }
}

function displayDeviceDetails(data) {
    const { device, location, logs } = data;
    
    document.getElementById('modal-device-name').textContent = device.name;
    
    const detailsHtml = `
        <div class="device-info">
            <div class="device-info-item">
                <span>Model:</span>
                <span>${device.model}</span>
            </div>
            <div class="device-info-item">
                <span>Android Version:</span>
                <span>${device.androidVersion}</span>
            </div>
            <div class="device-info-item">
                <span>Status:</span>
                <span class="device-status ${device.isOnline ? 'online' : 'offline'}">
                    ${device.isOnline ? 'Online' : 'Offline'}
                </span>
            </div>
            <div class="device-info-item">
                <span>Battery Level:</span>
                <span>${device.batteryLevel || 'Unknown'}%</span>
            </div>
            <div class="device-info-item">
                <span>Last Seen:</span>
                <span>${formatDateTime(device.lastSeen)}</span>
            </div>
            <div class="device-info-item">
                <span>Locked:</span>
                <span>${device.isLocked ? '🔒 Yes' : '🔓 No'}</span>
            </div>
            <div class="device-info-item">
                <span>Alarm:</span>
                <span>${device.alarmActive ? '🚨 Active' : '🔇 Inactive'}</span>
            </div>
        </div>
        
        ${location ? `
            <h4 style="margin-top: 20px;">📍 Current Location</h4>
            <div class="device-info">
                <div class="device-info-item">
                    <span>Coordinates:</span>
                    <span>${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}</span>
                </div>
                <div class="device-info-item">
                    <span>Accuracy:</span>
                    <span>${location.accuracy}m</span>
                </div>
                <div class="device-info-item">
                    <span>Updated:</span>
                    <span>${formatDateTime(location.timestamp)}</span>
                </div>
                ${location.address ? `
                    <div class="device-info-item">
                        <span>Address:</span>
                        <span>${location.address}</span>
                    </div>
                ` : ''}
            </div>
        ` : '<p style="color: #6c757d; margin-top: 20px;">No location data available</p>'}
        
        ${logs && logs.length > 0 ? `
            <h4 style="margin-top: 20px;">📋 Recent Activity</h4>
            <div style="max-height: 200px; overflow-y: auto;">
                ${logs.slice(0, 5).map(log => `
                    <div style="padding: 8px; border-bottom: 1px solid #e9ecef; font-size: 0.9rem;">
                        <span style="color: #6c757d;">${formatDateTime(log.timestamp)}</span> - 
                        <span style="text-transform: capitalize;">${log.log_type.replace('_', ' ')}</span>: 
                        ${log.message}
                    </div>
                `).join('')}
            </div>
        ` : ''}
    `;
    
    document.getElementById('device-details').innerHTML = detailsHtml;
}

function closeModal() {
    document.getElementById('device-modal').style.display = 'none';
    currentDevice = null;
}

// Device Command Functions
async function sendCommand(commandType) {
    if (!currentDevice) return;
    
    let endpoint;
    let payload = {};
    
    switch (commandType) {
        case 'lock':
            endpoint = `/api/commands/${currentDevice}/lock`;
            payload = { message: 'Device locked from dashboard' };
            break;
        case 'unlock':
            endpoint = `/api/commands/${currentDevice}/unlock`;
            break;
        case 'locate':
            endpoint = `/api/commands/${currentDevice}/locate`;
            payload = { highAccuracy: true };
            break;
        case 'start-alarm':
            endpoint = `/api/commands/${currentDevice}/alarm/start`;
            payload = { duration: 30, volume: 100, message: 'Security Alert - Alarm activated from dashboard' };
            break;
        case 'stop-alarm':
            endpoint = `/api/commands/${currentDevice}/alarm/stop`;
            break;
        case 'wipe':
            if (!confirm('This will ERASE ALL DATA on the device. Type OK to continue.')) {
                return;
            }
            endpoint = `/api/commands/${currentDevice}/wipe`;
            payload = { confirmWipe: 'CONFIRM_FACTORY_RESET' };
            break;
        default:
            return;
    }
    
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': currentUser.apiKey
            },
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            const data = await response.json();
            showToast(data.message, 'success');
            closeModal();
            loadDevices(); // Refresh device list
        } else {
            const error = await response.json();
            showToast(error.error || 'Command failed', 'error');
        }
    } catch (error) {
        showToast('Failed to send command', 'error');
    }
}

// WebSocket Functions
function setupWebSocket() {
    if (socket) {
        socket.disconnect();
    }
    
    socket = io();
    
    socket.on('connect', () => {
        console.log('Connected to server');
        socket.emit('join-user-room', currentUser.id);
    });
    
    socket.on('location-update', (data) => {
        showToast(`Location updated for ${data.deviceId}`, 'info');
        loadMapData(); // Refresh map
    });
    
    socket.on('command-executed', (data) => {
        showToast(`Command executed on ${data.deviceId}: ${data.status}`, data.status === 'completed' ? 'success' : 'warning');
        loadDevices(); // Refresh device list
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
    });
}

// Utility Functions
async function refreshApiKey() {
    if (!confirm('Are you sure you want to generate a new API key? The old key will stop working immediately.')) {
        return;
    }
    
    try {
        const response = await fetch('/dashboard/user/refresh-api-key', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            currentUser.apiKey = data.apiKey;
            document.getElementById('api-key-display').value = data.apiKey;
            showToast('API key refreshed successfully', 'success');
        } else {
            showToast('Failed to refresh API key', 'error');
        }
    } catch (error) {
        showToast('Failed to refresh API key', 'error');
    }
}

function copyApiKey() {
    const apiKeyInput = document.getElementById('api-key-display');
    apiKeyInput.select();
    document.execCommand('copy');
    showToast('API key copied to clipboard', 'success');
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Add icon based on type
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: '📍'
    };
    
    toast.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 1.2em;">${icons[type] || icons.info}</span>
            <span>${message}</span>
        </div>
    `;
    
    const container = document.getElementById('toast-container');
    container.appendChild(toast);
    
    // Auto remove after 5 seconds
    const timer = setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%) scale(0.8)';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
    
    // Allow manual dismissal on click
    toast.addEventListener('click', () => {
        clearTimeout(timer);
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%) scale(0.8)';
        setTimeout(() => toast.remove(), 300);
    });
    
    // Add cursor pointer for manual dismissal
    toast.style.cursor = 'pointer';
    toast.title = 'Click to dismiss';
}

function formatDateTime(dateString) {
    if (!dateString) return 'Never';
    
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    // If less than 1 minute ago
    if (diff < 60000) {
        return 'Just now';
    }
    
    // If less than 1 hour ago
    if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000);
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    }
    
    // If less than 24 hours ago
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }
    
    // Otherwise show full date
    return date.toLocaleString();
}

// Make functions available globally
window.showTab = showTab;
window.showDeviceModal = showDeviceModal;