const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Database = require('../database');

const router = express.Router();
const db = new Database();

// JWT Secret (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'your-dashboard-secret-key-change-in-production';

// Middleware to authenticate dashboard sessions
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// POST /dashboard/auth/login - Dashboard login
router.post('/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        // Get user from database
        const user = await db.getUserByUsername(username);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Verify password
        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { 
                id: user.id, 
                username: user.username,
                email: user.email 
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful',
            token: token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                apiKey: user.api_key
            }
        });

    } catch (error) {
        console.error('Dashboard login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// POST /dashboard/auth/register - Dashboard user registration
router.post('/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ 
                error: 'Username, email, and password are required' 
            });
        }

        if (password.length < 6) {
            return res.status(400).json({ 
                error: 'Password must be at least 6 characters long' 
            });
        }

        // Check if user already exists
        const existingUser = await db.getUserByUsername(username);
        if (existingUser) {
            return res.status(409).json({ error: 'Username already exists' });
        }

        const existingEmail = await db.getUserByEmail(email);
        if (existingEmail) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        // Hash password and generate API key
        const passwordHash = await bcrypt.hash(password, 10);
        const apiKey = require('crypto').randomBytes(32).toString('hex');

        // Create user
        const result = await db.createUser(username, email, passwordHash, apiKey);

        // Generate JWT token
        const token = jwt.sign(
            { 
                id: result.id, 
                username: username,
                email: email 
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            message: 'User registered successfully',
            token: token,
            user: {
                id: result.id,
                username: username,
                email: email,
                apiKey: apiKey
            }
        });

    } catch (error) {
        console.error('Dashboard registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// GET /dashboard/user/profile - Get user profile
router.get('/user/profile', authenticateToken, async (req, res) => {
    try {
        const user = await db.getUserById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                apiKey: user.api_key,
                created_at: user.created_at
            }
        });

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Failed to get user profile' });
    }
});

// GET /dashboard/devices - Get user devices with locations
router.get('/devices', authenticateToken, async (req, res) => {
    try {
        const devices = await db.getUserDevices(req.user.id);
        
        // Add location and status info to each device
        const enrichedDevices = await Promise.all(
            devices.map(async (device) => {
                const [location, logs] = await Promise.all([
                    db.getLatestLocation(device.device_id),
                    db.getDeviceLogs(device.device_id, 5)
                ]);

                const lastSeenTime = new Date(device.last_seen);
                const isOnline = Date.now() - lastSeenTime.getTime() < 5 * 60 * 1000; // 5 minutes

                return {
                    id: device.device_id,
                    name: device.device_name,
                    model: device.device_model,
                    androidVersion: device.android_version,
                    status: device.status,
                    isLocked: device.is_locked === 1,
                    alarmActive: device.alarm_active === 1,
                    batteryLevel: device.battery_level,
                    lastSeen: device.last_seen,
                    isOnline: isOnline,
                    location: location,
                    recentLogs: logs.slice(0, 3) // Only show latest 3 logs
                };
            })
        );

        res.json({
            devices: enrichedDevices,
            count: enrichedDevices.length,
            summary: {
                total: enrichedDevices.length,
                online: enrichedDevices.filter(d => d.isOnline).length,
                locked: enrichedDevices.filter(d => d.isLocked).length,
                alarming: enrichedDevices.filter(d => d.alarmActive).length
            }
        });

    } catch (error) {
        console.error('Get dashboard devices error:', error);
        res.status(500).json({ error: 'Failed to get devices' });
    }
});

// GET /dashboard/devices/:deviceId - Get specific device details
router.get('/devices/:deviceId', authenticateToken, async (req, res) => {
    try {
        const { deviceId } = req.params;
        
        const device = await db.getDeviceById(deviceId);
        if (!device || device.user_id !== req.user.id) {
            return res.status(404).json({ error: 'Device not found' });
        }

        // Get comprehensive device data
        const [location, locationHistory, commands, logs, geofences] = await Promise.all([
            db.getLatestLocation(deviceId),
            db.getLocationHistory(deviceId, 50),
            db.getCommandHistory(deviceId, 20),
            db.getDeviceLogs(deviceId, 30),
            db.getDeviceGeofences(deviceId)
        ]);

        const lastSeenTime = new Date(device.last_seen);
        const isOnline = Date.now() - lastSeenTime.getTime() < 5 * 60 * 1000;

        res.json({
            device: {
                id: device.device_id,
                name: device.device_name,
                model: device.device_model,
                androidVersion: device.android_version,
                status: device.status,
                isLocked: device.is_locked === 1,
                alarmActive: device.alarm_active === 1,
                batteryLevel: device.battery_level,
                lastSeen: device.last_seen,
                isOnline: isOnline,
                createdAt: device.created_at
            },
            location: location,
            locationHistory: locationHistory,
            commands: commands,
            logs: logs,
            geofences: geofences
        });

    } catch (error) {
        console.error('Get device details error:', error);
        res.status(500).json({ error: 'Failed to get device details' });
    }
});

// GET /dashboard/map-data - Get all devices for map display
router.get('/map-data', authenticateToken, async (req, res) => {
    try {
        const devices = await db.getUserDevices(req.user.id);
        const mapData = [];

        for (const device of devices) {
            const location = await db.getLatestLocation(device.device_id);
            if (location) {
                const lastSeenTime = new Date(device.last_seen);
                const isOnline = Date.now() - lastSeenTime.getTime() < 5 * 60 * 1000;

                mapData.push({
                    deviceId: device.device_id,
                    name: device.device_name,
                    model: device.device_model,
                    isOnline: isOnline,
                    isLocked: device.is_locked === 1,
                    alarmActive: device.alarm_active === 1,
                    batteryLevel: device.battery_level,
                    location: {
                        latitude: location.latitude,
                        longitude: location.longitude,
                        accuracy: location.accuracy,
                        address: location.address,
                        timestamp: location.timestamp,
                        age: Date.now() - new Date(location.timestamp).getTime()
                    }
                });
            }
        }

        res.json({
            devices: mapData,
            count: mapData.length
        });

    } catch (error) {
        console.error('Get map data error:', error);
        res.status(500).json({ error: 'Failed to get map data' });
    }
});

// GET /dashboard/analytics - Get user analytics
router.get('/analytics', authenticateToken, async (req, res) => {
    try {
        const { timeframe = '7d' } = req.query;
        
        // Calculate date range
        let startDate = new Date();
        switch (timeframe) {
            case '24h':
                startDate.setHours(startDate.getHours() - 24);
                break;
            case '7d':
                startDate.setDate(startDate.getDate() - 7);
                break;
            case '30d':
                startDate.setDate(startDate.getDate() - 30);
                break;
            default:
                startDate.setDate(startDate.getDate() - 7);
        }

        // Get basic device statistics
        const deviceStats = await db.getDeviceStatistics(req.user.id);
        
        // Get command statistics
        const commandStats = await db.all(
            `SELECT command_type, COUNT(*) as count, status 
             FROM commands 
             WHERE user_id = ? AND sent_at >= ? 
             GROUP BY command_type, status`, 
            [req.user.id, startDate.toISOString()]
        );

        // Get activity logs
        const activityLogs = await db.all(
            `SELECT dl.*, d.device_name 
             FROM device_logs dl 
             JOIN devices d ON dl.device_id = d.device_id 
             WHERE d.user_id = ? AND dl.timestamp >= ? 
             ORDER BY dl.timestamp DESC 
             LIMIT 50`, 
            [req.user.id, startDate.toISOString()]
        );

        // Process command statistics
        const commandSummary = {};
        commandStats.forEach(stat => {
            if (!commandSummary[stat.command_type]) {
                commandSummary[stat.command_type] = { total: 0, completed: 0, pending: 0, failed: 0 };
            }
            commandSummary[stat.command_type].total += stat.count;
            commandSummary[stat.command_type][stat.status] = stat.count;
        });

        res.json({
            timeframe: timeframe,
            devices: deviceStats,
            commands: {
                summary: commandSummary,
                total: commandStats.reduce((sum, stat) => sum + stat.count, 0)
            },
            recentActivity: activityLogs.slice(0, 20)
        });

    } catch (error) {
        console.error('Get analytics error:', error);
        res.status(500).json({ error: 'Failed to get analytics' });
    }
});

// POST /dashboard/user/refresh-api-key - Refresh user API key
router.post('/user/refresh-api-key', authenticateToken, async (req, res) => {
    try {
        const newApiKey = require('crypto').randomBytes(32).toString('hex');
        await db.refreshUserApiKey(req.user.id, newApiKey);

        res.json({
            message: 'API key refreshed successfully',
            apiKey: newApiKey
        });

    } catch (error) {
        console.error('Refresh API key error:', error);
        res.status(500).json({ error: 'Failed to refresh API key' });
    }
});

module.exports = router;